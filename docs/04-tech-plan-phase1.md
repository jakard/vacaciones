# Plan técnico — Fase 1

**Stack base (definido):** Angular (frontend) + Node.js sobre Cloud Functions for Firebase (backend) + **Firestore** (DB) + Firebase Auth.

> **Revisión 2026-05-28:** plan original recomendaba NestJS + Postgres en Cloud Run. El usuario decidió Firebase — toda la arquitectura cambia para alinearse al ecosistema Firebase. Este documento ya refleja el stack Firebase. Las decisiones marcadas **[A confirmar]** quedan para que ratifiques.

---

## 1. Backend — Cloud Functions for Firebase

**Recomendación: Cloud Functions for Firebase v2 (Node.js + TypeScript), sin NestJS.**

| Opción | Pros | Contras |
|---|---|---|
| **Cloud Functions for Firebase v2** ✅ | Cero infra; integración nativa con Firestore Auth Triggers; deploy 1 comando; scheduled functions con `onSchedule`; HTTP callable functions auth-aware desde Angular. | Cold starts (~1-2s); 9 min timeout duro; menos estructura — disciplina manual. |
| NestJS sobre Cloud Run | Estructura clara; familiar al equipo Angular. | Pierde mucho del valor Firebase (triggers, callable functions). Otro componente de infra. |
| NestJS dentro de una sola Cloud Function | Estructura + Firebase. | Cold start lento (~3-5s con todo el framework cargando); incompatible con triggers granulares. |

**Por qué Functions ganan ahora:** con Firebase como DB y Auth, NestJS solo agrega peso. Cloud Functions v2 + TypeScript con una estructura limpia de carpetas (`functions/src/{wallet,coverage,briefings,workspace,scheduled}`) y servicios reutilizables resuelve el problema sin framework.

**Estructura del código de Functions:**
```
functions/src/
├── http/              # onCall / onRequest HTTP endpoints
├── triggers/          # onCreate / onUpdate / onWrite de Firestore
├── scheduled/         # onSchedule (release diario, stipend mensual, leaderboard)
├── services/          # wallet, ledger, briefing, workspace — lógica pura testeable
├── lib/               # admin SDK init, error wrapping, validators (zod)
└── index.ts           # exports
```

---

## 2. Base de datos — Firestore

**El wallet sigue siendo un ledger.** Firestore puede manejarlo bien si seguís reglas estrictas:

- **Transacciones ACID multi-document funcionan.** Firestore soporta transacciones atómicas sobre hasta 500 documentos. Toda operación de wallet (escribir `ledger_entries/{id}` + actualizar `wallets/{userId}`) va dentro de una `db.runTransaction(...)`.
- **Idempotency por document ID.** Cada entrada de ledger tiene un `id` determinístico (ej. `{requestId}_{type}_{date}` para releases diarios). `create` falla si el doc ya existe → no se doblan transacciones por retries.
- **Append-only enforcement por Security Rules.** `ledger_entries` no admite `update` ni `delete` desde ningún cliente. Solo Admin SDK (Cloud Functions) puede escribir.
- **Wallet doc es proyección.** La fuente de verdad es la colección `ledger_entries`. La proyección permite leer balance sin reducir todos los entries.

**Trade-offs honestos vs. Postgres:**
- **Leaderboards agregados son más caros.** Firestore tiene `count()` / `sum()` / `avg()` nativos desde 2023 pero contar/sumar leerá los docs igual (cuesta por read). Solución: scheduled function diaria que computa el leaderboard rolling 90d y lo escribe en `/teams/{teamId}/leaderboard/current`. Lectura del leaderboard = 1 doc.
- **Schema migrations manuales.** No hay `prisma migrate`. Cambios de esquema se hacen vía scripts de Admin SDK que iteran y actualizan docs. Hay que diseñar el modelo upfront con más cuidado.
- **Sin joins.** Cada relación es por ID con un read adicional, o por denormalización. Para Fase 1 esto es manejable.
- **Costo dominado por reads.** Una vista de leaderboard que lee 15 wallets = 15 reads. Diseñar pensando en "1 view = N reads". Cache agresivo del lado cliente con AngularFire.

**Reglas de Security a planificar desde el día 1:**
```
// Cliente puede leer su propio wallet, no escribirlo
match /teams/{teamId}/wallets/{userId} {
  allow read: if request.auth.uid == userId
              && request.auth.uid in get(/databases/$(db)/documents/teams/$(teamId)).data.member_ids;
  allow write: if false;  // solo Admin SDK
}

// Ledger entries: solo lectura para el dueño y manager
match /teams/{teamId}/ledger_entries/{entryId} {
  allow read: if request.auth.uid == resource.data.user_id
              || isManager(teamId, request.auth.uid);
  allow create, update, delete: if false;  // solo Admin SDK
}
```

---

## 3. Auth — Firebase Auth con Google provider

**Recomendación: Firebase Auth, no Passport.**

**Flujo simplificado:**
1. Angular usa `@angular/fire/auth` + `GoogleAuthProvider`.
2. `signInWithPopup` / `signInWithRedirect` dispara OAuth Google — Firebase maneja todo el dance.
3. Firebase Auth devuelve un ID Token JWT al cliente.
4. Cliente lo pasa en cada Callable Function — Firebase verifica automáticamente.
5. Trigger `onCreate` del usuario en Auth dispara una Function que crea el doc `/users/{uid}` y dispara el onboarding grant.

**Es muchísimo más simple que el plan anterior con Passport.** No hay refresh tokens propios, no hay JWT custom, no hay cookies HttpOnly que manejar.

**Workspace API scopes (para integraciones del briefing) — el gotcha:**
- Firebase Auth con Google provider por default solo pide `openid email profile`.
- Para Gmail/Calendar/Drive/Sheets necesitás scopes adicionales. Dos opciones:
  - **(a) Pedir scopes al login** vía `provider.addScope('https://www.googleapis.com/auth/calendar.readonly')`. Da el `accessToken` con esos scopes en el callback.
  - **(b) Consent incremental** después del login — usar el cliente `google-auth-library` separado dentro de una Function para correr el OAuth con scopes Workspace. Más complejo pero mejor UX (no pedís todo de entrada).
- **Importante:** Firebase Auth NO te da automáticamente el refresh token de Google con scopes Workspace — solo el access token de corta vida. Para acceso prolongado vas a necesitar correr OAuth tradicional con `google-auth-library` aparte y guardar el `refresh_token` cifrado en Firestore. Esto se hace en una Function al activar cada feature.

**Domain restriction:** Firebase Auth permite restringir por dominio con `provider.setCustomParameters({ hd: 'google.com' })`. **[A confirmar]** ¿Single domain o multi-tenant?

---

## 4. Integración Google Workspace

- **SDK:** [`googleapis`](https://www.npmjs.com/package/googleapis) (oficial de Google, mantenido). Se usa desde Cloud Functions, no desde el cliente.
- **Tokens:** guardar `refresh_token` por usuario en Firestore, cifrado con [Cloud KMS](https://cloud.google.com/kms). Path sugerido: `/users/{uid}/workspace_tokens/{provider}`. Security Rules: `allow read, write: if false` (solo Admin SDK).
- **Trabajo en background:** las extracciones del briefing (Gmail, Calendar, Drive, Sheets) son lentas.
  - **Recomendación: Cloud Tasks + Cloud Functions HTTP.** Ya estás en GCP, integración nativa. Una Function dispara: "enqueue tarea de extracción Gmail para usuario X cliente Y". Cloud Tasks la dispara con retry policy, llama a otra Function HTTP que hace el trabajo.
  - Alternativa más simple para Fase 1: una Function `onCall` que hace todo inline si toma menos de 60s. Funciona para portfolios chicos (~5 clientes); con 15+ clientes hay que partir a Tasks.

---

## 5. Frontend — Angular

- **Versión:** Angular 18+ (standalone components, signals, control flow nuevo `@if`/`@for`).
- **Firebase SDK: [AngularFire](https://github.com/angular/angularfire).** Wrappers Angular-idiomáticos para Auth + Firestore. Da observables Firestore directos, perfecto con signals (`toSignal(...)`).
- **State:** signals para state local + observables de AngularFire convertidos a signals con `toSignal`. NgRx SignalStore solo si hace falta (probablemente no en Fase 1).
- **UI:** **Angular Material** + Tailwind. Material para componentes complejos (date pickers, tablas, dialogs); Tailwind para layout y estilos custom.
- **Forms:** Reactive Forms (forzoso para validaciones de wallet/briefing).
- **API calls:** **Callable Functions** con `@angular/fire/functions` (`httpsCallable`). Mucho mejor que HTTP plano — Firebase mete el token Auth automáticamente, manejo de errores tipado.
- **i18n:** Angular i18n built-in. Default `es` con `en` como segundo. **[A confirmar]** ¿Importante en Fase 1 o lo dejamos para después?

---

## 6. Estructura del repo — Firebase project nativo

**Recomendación: estructura nativa Firebase con workspace npm.**

```
vacaciones/
├── web/                   # Angular (firebase deploy --only hosting)
│   ├── src/
│   └── angular.json
├── functions/             # Cloud Functions (firebase deploy --only functions)
│   ├── src/
│   │   ├── http/
│   │   ├── triggers/
│   │   ├── scheduled/
│   │   ├── services/
│   │   └── index.ts
│   └── package.json
├── shared/                # types + validators compartidos (npm workspace)
│   ├── src/
│   └── package.json
├── firebase.json          # config Firebase (hosting, functions, firestore)
├── firestore.rules        # Security Rules
├── firestore.indexes.json
├── package.json           # workspaces: ["web", "functions", "shared"]
└── .firebaserc            # alias prod / staging
```

**Por qué este layout en vez de Nx:**
- `firebase init` y `firebase deploy` son los comandos canónicos del ecosistema. Pelearse con Nx para que respete esto no compensa para Fase 1.
- Npm workspaces (built-in) alcanzan para compartir `shared/` types entre `web/` y `functions/`.
- Si el proyecto crece a varios apps/libs, ahí sí evaluar Nx.

---

## 7. Hosting — Firebase

- **Frontend Angular:** Firebase Hosting (CDN global, despliegues atómicos, preview channels por PR).
- **Backend:** Cloud Functions for Firebase v2 (region `us-central1` o `europe-west1` según ubicación del equipo).
- **DB:** Firestore en modo Native (no Datastore mode), region multi-region `nam5` o single-region.
- **Auth:** Firebase Auth.
- **Secrets:** Secret Manager + acceso desde Functions vía `defineSecret()`.
- **CI/CD:** GitHub Actions con `firebase-tools` (más simple que Cloud Build para empezar).

**Costo estimado dev/staging:** **~$0-5/mes** mientras estés dentro de Spark/Blaze free tier. Firestore 1GB + 50k reads/día gratis. Functions 2M invocaciones/mes gratis. Hosting 10GB egress/mes gratis. Es uno de los grandes pros del cambio a Firebase.

---

## 8. Testing

- **Backend (Functions):** Jest + **Firestore Emulator Suite** (oficial Firebase). Tests de integración corren contra Firestore local real, no mocks — esto es no-negociable para el ledger.
- **Frontend:** Vitest (default de Angular 21+) + Angular Testing Library para component tests; Playwright para E2E (apuntando al emulador).
- **Wallet con property-based tests** (`fast-check`): propiedades como "suma total del sistema = grants minteados + stipends minteados - stipends expirados - fees quemados". Si esta propiedad se rompe en cualquier secuencia, hay un bug.
- **Emulator Suite** te da Auth + Firestore + Functions + Hosting locales con un comando: `firebase emulators:start`. Dev y CI usan el mismo setup.

---

## 9. Modelo de datos en Firestore — primera versión

```
/users/{uid}
  email, displayName, photoURL, googleUserId, createdAt

/teams/{teamId}
  name, ownerUid, createdAt
  memberUids: string[]              # denormalizado para queries de membership

/teams/{teamId}/members/{uid}
  role: 'member' | 'manager'
  joinedAt, onboardingGrantReceivedAt

/teams/{teamId}/wallets/{uid}       # PROYECCIÓN — sin escritura desde cliente
  earnedBalance, stipendBalance, stipendPeriodStart
  updatedAt, lastEntryId

/teams/{teamId}/coverageRequests/{requestId}
  requesterUid, covererUid (null until accepted)
  windowStart (Timestamp), windowEnd (Timestamp), timezone
  reachability, sla, emergencyDef
  status: 'draft' | 'open' | 'accepted' | 'active' | 'completed' | 'cancelled'
  totalCoinsOffered, coinsEscrowed, coinsReleased
  briefingId, createdAt, updatedAt

/teams/{teamId}/coverageRequests/{requestId}/briefing/{briefingId}
  managerEscalation, skipLevel
  recurringMeetingsAttend: [], recurringMeetingsDecline: []
  autoResponderText, ackAt, createdAt, updatedAt

/teams/{teamId}/coverageRequests/{requestId}/briefing/{briefingId}/clientCards/{cardId}
  accountName, tier, arrBucket, renewalDate
  identity: {}, actOnNow: {}, awareness: {}, gotchas: {}

/teams/{teamId}/ledgerEntries/{entryId}        # APPEND-ONLY, fuente de verdad
  uid, type ('grant' | 'stipendMint' | 'stipendExpire' | 'escrowIn'
             | 'escrowOut' | 'coverageRelease' | 'feeBurn' | 'managerAdvance')
  amountSigned, balanceBucket: 'earned' | 'stipend'
  relatedRequestId (opcional), createdAt
  # entryId = idempotency key (ej. `${requestId}_release_${YYYY-MM-DD}`)

/teams/{teamId}/leaderboards/current           # ROLLUP regenerado diariamente
  windowStart, windowEnd, generatedAt
  rankings: [{uid, earnedInWindow}, ...]

/users/{uid}/workspaceTokens/{provider}        # CIFRADO, solo Admin SDK
  encryptedRefreshToken, scopes: [], updatedAt
```

**Patrones clave Firestore:**

1. **`wallets/{uid}` es proyección, no fuente.** La verdad es `ledgerEntries`. Cada transacción atómica crea un `ledgerEntry` (con `create()`, no `set()` — falla si el ID ya existe) Y actualiza `wallets/{uid}`. Si fallan ambas, ninguna persiste.

2. **`leaderboards/current` es rollup denormalizado.** Una Function scheduled corre diariamente: lee últimos 90d de `ledgerEntries` con `type == 'coverageRelease'`, agrupa por uid, escribe el ranking. Vista del leaderboard = 1 read.

3. **`memberUids` array en `teams`** permite queries tipo "qué teams pertenezco" con `where('memberUids', 'array-contains', myUid)`. Trade-off conocido: máximo 10 elementos en `array-contains-any`; cap de team a 10-15 members alcanza para Fase 1.

4. **Subcollections para briefings y client cards** porque son strictly contenidos dentro de un `coverageRequest`. Esto mantiene el doc principal chico.

5. **Idempotency por document ID** en `ledgerEntries`. Ejemplo: el release diario de `requestId=abc123` el día 2026-06-03 tiene ID `abc123_release_2026-06-03`. Si la function se ejecuta 2 veces por algún reintento, el segundo `create()` falla cleanly.

6. **Índices compuestos a definir en `firestore.indexes.json`** desde el día 1:
   - `coverageRequests` por `(teamId, status, windowStart)` para listar requests abiertas
   - `ledgerEntries` por `(uid, type, createdAt)` para historial del wallet
   - `ledgerEntries` por `(type, createdAt)` para el agregado del leaderboard

---

## 10. Primer milestone (2-3 semanas)

Algo deployado en Cloud Run + Firebase con:

1. Login Google OAuth funcionando, sesión persistida.
2. Crear/joinear team (1 manager, hasta 5 miembros).
3. Wallet con 20 monedas grant + stipend que se mintea al join.
4. Crear solicitud de cobertura básica (ventana + texto libre, sin briefing estructurado todavía).
5. Aceptar solicitud → escrow se mueve.
6. Cron diario simulado: libera monedas progresivamente.
7. Vista de wallet con historial básico (ledger_entries).

**No incluye en milestone 1:** briefing estructurado, integración Workspace APIs, leaderboard, badges, manager approval. Esos son milestones 2 y 3.

---

## Decisiones que necesito de vos (resumen — versión Firebase)

1. **Single domain o multi-tenant?** *(default sugerido: single domain restringido por `hd=` en Fase 1)*
2. **Región Firestore?** *(default sugerido: `nam5` multi-region o single-region según ubicación de la mayoría del equipo)*
3. **Workspace scopes — pedir al login o consent incremental?** *(recomiendo incremental: arrancás con `openid email profile` y pedís Calendar/Gmail/Drive después cuando el user activa briefings)*
4. **i18n en Fase 1?** *(default sugerido: solo `es`, agregar `en` en Fase 2)*
5. **Workspaces npm o Nx?** *(recomiendo npm workspaces simples — Nx solo si crece)*

Con esas decisiones cerradas, el siguiente paso es scaffold del repo (`firebase init` + `ng new` + estructura `functions/services/`) y arrancar el milestone 1.
