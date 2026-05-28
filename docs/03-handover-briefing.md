# Coverage Briefing — Modelo de información y auto-población desde Google Workspace

Cuando un TAM se va OOO 1-2 semanas, su colega levanta el portafolio. El "Coverage Briefing" es el artefacto estructurado: contexto por cliente + contexto de portafolio, auto-poblado donde la data ya vive en Workspace.

---

## Parte A — Modelo de información

Dos niveles: **header de portafolio** (uno por briefing) y **tarjeta por cliente** (una por cuenta).

**Tier:** `R = requerido para enviar`, `M = MVP default-on`, `F = opcional/expansion`.

### A.1 Header de portafolio

| Campo | Tier | Propósito |
|---|---|---|
| Ventana de cobertura (start, end, timezone) | R | Limita todas las queries. |
| TAM solicitante (nombre, email, teléfono, contacto personal) | R | Identifica al que se va. |
| TAM cubriendo (nombre, email) | R | Se setea al aceptar. |
| Manager / contacto de escalación | R | A quién escala el cubriente si hay fuego. |
| Skip-level / escalación secundaria | F | Cuando el manager también está OOO. |
| Política de alcance | R | `unreachable`, `email-only-emergencies`, `phone-emergencies`, `daily-check-in`. |
| Definición de emergencia | M | Free text: "qué cuenta como despertarme de verdad". |
| SLA de respuesta que debe sostener el cubriente | R | "P1 en 2h, P2 en 1 día hábil". |
| Referencia a rotación on-call | F | Link a PagerDuty/oncall si aplica. |
| Canales Slack/Chat a unirse | M | Específicos del cliente y del equipo. |
| Reuniones recurrentes a ATENDER | M | Decisión por cada recurrente en la ventana. |
| Reuniones recurrentes a DECLINAR | M | Lista explícita — ahorra tiempo y face. |
| Texto del auto-responder de Gmail | M | Drafteado por la app, editado por el user, escrito vía Gmail Settings API al día de inicio. |
| Timestamp de freshness | R | Auto-set en submit; el cubriente ve staleness. |
| Read receipt / ack | R | El cubriente hace clic "Lo leí" antes de que la solicitud quede "activa". Audit trail. |

**Mínimo viable para enviar** = ventana + ambos TAMs + escalación + alcance + SLA + ack. Lo demás puede estar vacío.

### A.2 Tarjeta por cliente

Cuatro zonas en este orden (es el orden en que se lee bajo presión): **identidad → act-on-now → awareness → gotchas**.

#### A.2.1 Identidad

| Campo | Tier |
|---|---|
| Nombre cuenta + logo | R |
| Tier de cuenta (Strategic / Enterprise / Growth) | R |
| ARR / bucket de contrato | M (bucket, no monto exacto — evita filtrar sensible) |
| Fecha de renovación | M |
| Stakeholders del cliente (nombre, rol, email, canal preferido, tono) | R |
| Equipo interno Google (AE, SE, CSM, PSO) | M |
| Productos Google del cliente | M |
| Región / timezone | M |
| **Temperatura de la relación** | M (`Healthy` / `Watch` / `At-risk` / `Escalated` — alta señal) |

#### A.2.2 Act-on-now (lo urgente)

Lo que el cubriente escanea primero. Cada item tiene owner + due date.

| Campo | Tier |
|---|---|
| Escalaciones abiertas | R si existen — título, severidad, fecha, owner, último update, link al ticket |
| Action items pendientes con el cliente | R si existen — qué se prometió, para cuándo |
| Aprobaciones pendientes | M (SOW, crédito, sign-off técnico) |
| Proyectos técnicos in-flight con entrega en ventana | M ("migración corte 3 junio") |
| Reuniones agendadas en ventana | M (de Calendar; por reunión: atender/declinar/reagendar) |
| Asks del cliente esperando respuesta | M ("Acme preguntó X el 20 mayo; sin respuesta") |
| Asks internos bloqueando al cliente | F |
| Deadlines duros en la ventana | R si existen (renovaciones, cláusulas, compliance) |

#### A.2.3 Awareness (contexto)

| Campo | Tier |
|---|---|
| Resumen actividad 30 días | M ("3 reuniones, 12 threads, 2 docs editados") |
| Recaps de reuniones recientes | F (notas Gemini, últimas 2-3) |
| Iniciativas técnicas activas | M (multi-quarter, owner, fase actual) |
| Docs recientes en folder del cliente | F (últimos 5 modificados) |
| Spaces de Chat relevantes | M (nombres + links) |
| Topics de Gmail recientes | F (top N por recencia) |
| Narrativa estratégica | M (1-3 frases: hacia dónde va esta cuenta) |

#### A.2.4 Gotchas ("ojo con X")

El campo que previene bolas caídas. Es el más saltado si no se prompea fuerte.

| Campo | Tier |
|---|---|
| Temas sensibles a evitar | M ("no toques pricing — negociación activa") |
| Política interna | F ("Stakeholder X reporta a Y que se opone a la solución") |
| Preferencias y manías de comunicación | M ("CTO solo lee emails los martes". "Nunca CC al de procurement") |
| Issues sin resolver conocidos | M ("Beta Z aún con data residency abierto") |
| Cosas que el cliente NO debe saber en esta ventana | F (sunset bajo embargo, etc.) |
| Checklist de hand-off-back | F (qué reporta el cubriente al volver) |

**Requerido por cliente:** identidad + checkbox afirmativo "no hay escalaciones ni deliverables pendientes". Si Calendar muestra reuniones con el cliente en la ventana → app rechaza enviar briefing con cero tarjeta para esa cuenta.

**Suprimir clientes:** user puede marcar "sin actividad esperada en ventana — skip". Aún produce stub con solo identidad → el cubriente sabe que existe la cuenta si algo aterriza.

---

## Parte B — Auto-población desde Google Workspace

### B.1 La decisión arquitectónica clave: snapshot vs. acceso delegado

| | **Modelo 1: Snapshot** | **Modelo 2: Acceso delegado live** |
|---|---|---|
| Qué | App pulea con OAuth del requester, renderiza briefing congelado. | App tiene refresh token a través de la ventana; cubriente puede drill-in y pulear data live. O: requester usa Gmail Delegation (feature nativa Workspace) para cliente específico, expira en ventana end. |
| ¿Quién ve raw email del requester? | Nadie post-extracción. La app lo tiene server-side bajo consent del requester. | El cubriente, scoped al subset taggeado del cliente. |
| Boundary de privacidad | Filoso. El briefing es artefacto derivado. | Suave. El cubriente transitivamente ve email personal si filtering es imperfecto. |
| Modelo de consent | OAuth único del requester al hacer briefing. | Gmail delegation (feature Workspace, controlled por requester, sin DWD) o tokens per-message vía app. |
| Risk implementación | App se vuelve warehouse de info del cliente → carga de security review. | Filtering tiene que ser bulletproof + revocación al fin de ventana. |
| Comfort del manager del TAM | Alto — solo doc derivado. | Más bajo — "le di mi email a un colega". |
| Refresh on staleness | Re-extraer manual. | Automático. |

**Recomendación: Default Modelo 1, con affordance de "live drilldown" que usa feature nativa de Gmail Delegate** (el requester la configura para un cliente específico, expira en window end).

Razones:
1. Workspace ya tiene "mail delegate" nativo → el trust boundary vive dentro de Google, no dentro de nuestra app.
2. **Domain-wide delegation es la herramienta equivocada.** La [guía de Google](https://knowledge.workspace.google.com/admin/apps/domain-wide-delegation-best-practices) dice evita DWD cuando OAuth user consent alcanza. DWD impersona a cualquiera en el dominio vía service account key, no tiene boundary per-user, y requeriría que el admin Workspace del cliente instale la app — que el tenant interno Workspace de Google no hará para una app random.
3. Snapshot mantiene la huella de datos de la app más chica → simplifica el security review (que la app va a enfrentar dentro de Google).
4. Mail delegation es elección del user, per-cliente, opt-in.

### B.2 Mapeo campo → fuente Workspace

Scopes dados con la versión **más estrecha** que funciona. Prefiere `.metadata` y `.readonly`. Consent incremental.

| Campo del briefing | Fuente Workspace | Scope OAuth | Nota |
|---|---|---|---|
| OOO status del cubriente | Calendar | `calendar.events.readonly` | Confirma que el cubriente no esté OOO en overlap. |
| Auto-responder del requester | Gmail | `gmail.settings.basic` | Escribir, no leer. Toggle por job agendado en límites de ventana. |
| Account list (qué clientes están en el book) | Sheets + Drive | `drive.metadata.readonly` (discovery) + `drive.file` (Picker, sin sensitive) + `spreadsheets.readonly` | El portfolio doc es la fuente de verdad. No inferir cuentas del email — muy ruidoso. **Discovery**: Drive `files.list q="name contains 'portfolio' or name contains 'book' and mimeType='application/vnd.google-apps.spreadsheet' and 'me' in owners"`, ordenado por `viewedByMeTime desc`. Top 3 candidatos al user para confirmar. |
| Tier, ARR, renovación | Sheets | `spreadsheets.readonly` | Columnas no estandarizadas → UI de mapping requerida ("¿cuál columna es ARR?"). |
| Stakeholders | People + Gmail headers | `contacts.readonly`, `directory.readonly`, `gmail.metadata` | Metadata alcanza para extraer participantes — no necesita body. |
| Equipo interno Google | Directory API o People | `directory.readonly` | Path libre de DWD: usa `people.searchDirectoryPeople`, no Admin SDK. |
| Reuniones agendadas en ventana | Calendar | `calendar.events.readonly` | Filtra attendees por dominio del cliente. Señal más limpia. |
| 1:1s recurrentes con stakeholders | Calendar | `calendar.events.readonly` | Filtra `recurringEventId != null`. |
| **Action items pendientes con cliente** | Gmail + Docs + Tasks | `gmail.readonly` + `tasks.readonly` + `docs.readonly` | **Auto-pop de más alto valor.** (1) Gmail: threads donde el último mensaje *del cliente* sigue sin respuesta más de N días. (2) Google Tasks. (3) Parsing de la sección "Action items" de notas Gemini recientes. Extracción LLM sobre threads candidatos → items estructurados → el TAM cura. |
| Aprobaciones pendientes | Heurística Gmail + Docs | `gmail.readonly` + `docs.readonly` | Patrones: "Please review", "SOW", "approval". Plus Docs donde el TAM comentó sin resolver. Alta tasa de falsos positivos → muestra como sugerencias, no auto-fill. |
| Escalaciones abiertas | Sheets o ticketing externo | `spreadsheets.readonly` | La mayoría de orgs TAM tienen tool de escalación que NO es Workspace → mostly manual. |
| Resumen actividad 30 días | Gmail metadata + Calendar + Drive | `gmail.metadata` + `calendar.events.readonly` + `drive.metadata.readonly` | Solo counts — sin contenido. Barato. |
| Recaps de reuniones | Drive + Meet REST | `drive.readonly` o `meetings.space.readonly` | Notas Gemini "Take notes for me" son Docs en Drive del organizer compartidos con attendees. Transcripts API auto-borran a los 30 días. |
| Docs recientes en folder | Drive | `drive.metadata.readonly` | Requiere mapeo folder→cliente (configurado una vez en onboarding). |
| Iniciativas técnicas | Docs | `docs.readonly` | Lee "client tracker" designado por cliente (link configurado en tarjeta). Extracción de secciones h2. Mejor cuando el TAM ya mantiene esos docs. |
| Chat spaces relevantes | Chat | `chat.spaces.readonly` | `spaces.list` filtrado por match de nombre con cliente. |
| Topics de Gmail recientes | Gmail | `gmail.metadata` o `gmail.readonly` | Metadata-only para headers; readonly solo si queremos snippets. |
| **Gotchas / narrativa estratégica** | Free text | — | Mostly manual. **No fingimos auto-generar política.** Promptea fuerte al TAM; muestra gotchas del briefing anterior como punto de partida. |

### B.3 Privacy & permission boundaries

1. **No hay OAuth del cubriente hacia data del requester.** Toda la auto-población ocurre bajo identidad y consent del requester. El briefing se renderiza como artefacto derivado.
2. **Scope minimization.** Drive: `drive.file` vía Picker para el portfolio sheet siempre que sea posible; `drive.metadata.readonly` para counts; `drive.readonly` solo cuando se necesita Gemini-recap full read. Gmail: `gmail.metadata` alcanza para participant-graph, counts, subjects; upgrade a `gmail.readonly` solo cuando "auto-extract action items" está prendido por el user.
3. **Consent incremental.** No pidas todos los scopes el Día 1. Primera corrida pide Calendar + portfolio sheet. El user activa "auto-extract action items from email" después → eso dispara el consent de Gmail.
4. **Sin DWD.** Por la propia guía de Google, OAuth per-user → elimina necesidad de que admin Workspace del cliente instale la app (no-go para tool TAM-interno self-serve).
5. **Retención del briefing.** Auto-purga al window end + retention (ej. 14 días). User puede extender.
6. **PII del cliente en briefings.** Trata nombres + stakeholders como sensible pero permitido; flag campos free-text que parezcan tener body de email (regex sobre "wrote:" / quoted-printable) y advierte al user antes del save.
7. **Audit log.** Cada view del cubriente de cada campo del briefing se logea; el requester ve quién miró qué.

### B.4 Automaciones OOO-trigger sugeridas

- **T-7d antes de ventana:** reminder draft briefing.
- **T-0 inicio:** escribe Gmail vacation responder vía `gmail.settings.basic`, postea Calendar `outOfOffice` vía `calendar.events`, setea status Chat (sin scope REST público — ver open questions).
- **T-end:** revoca tokens delegados in-app, archiva briefing, manda email hand-back al requester.

---

## Open questions

1. **Status custom Chat vía API.** Setear "Out of office" en Chat no tiene scope REST público. Confirmar al momento del build; quizás depender de Calendar `outOfOffice` para drivear el indicador chat nativamente.
2. **Lookup stakeholder cross-domain.** `directory.readonly` solo devuelve el directorio Workspace del requester. Stakeholders del cliente `@customer.com` aparecen en headers pero sin profile rico salvo que el TAM los tenga como contactos personales.
3. **Accuracy de discovery del portfolio doc.** Heurística "buscar sheet con nombre tipo portfolio tracker" pega 60-70%. ¿UX de failover para el otro 30%? (Probablemente: Google Picker explícito.)
4. **Cuentas multi-TAM.** Si dos TAMs comparten cuenta, ¿qué briefing gana o se mergean? Probable: noción "TAM primario" por cuenta.
5. **¿Qué pasa con el book del cubriente durante la ventana?** Out of scope v1, pero vale flag — cobertura encadenada es real.
6. **Notificación al cliente.** ¿Le decimos al cliente que el TAM está OOO y quién cubre? Si sí, ¿quién dispara el email y desde qué identidad? (Probable: el requester, vía draft templated creado con `gmail.compose`.)
7. **Variancia disponibilidad de Meet recap.** Gemini "Take notes for me" requiere Business Standard+ y opt-in del host. Muchas reuniones no tendrán recap. Sección recap debe estar vacía gracefully.
8. **Calidad de extracción de action items.** LLM sobre threads de Gmail es la feature de auto-pop más poderosa *y* la más riesgosa por falsos positivos, items perdidos, y privacy. Necesita su propio eval harness.
9. **Diff de briefing en update.** Si el requester actualiza el briefing después de que el cubriente lo leyó, ¿el cubriente ve highlight de diff? (Recomendado: sí.)
10. **Experiencia móvil de lectura.** El cubriente leerá en tránsito, entre reuniones. El modelo de info de arriba es más denso que una pantalla de phone — la tarjeta por cliente necesita view colapsado "solo act-on-now". Prototipear UX en paralelo.

---

## Sources (Google APIs)

- [Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)
- [Gmail vacation settings](https://developers.google.com/workspace/gmail/api/guides/vacation_settings)
- [Calendar API scopes](https://developers.google.com/workspace/calendar/api/auth)
- [Calendar OOO events](https://developers.google.com/workspace/calendar/api/guides/calendar-status)
- [Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Drive files.list](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list)
- [People.searchDirectoryPeople](https://developers.google.com/people/api/rest/v1/people/searchDirectoryPeople)
- [OAuth 2.0 Scopes master list](https://developers.google.com/identity/protocols/oauth2/scopes)
- [Chat API auth](https://developers.google.com/workspace/chat/authenticate-authorize)
- [Meet REST API](https://developers.google.com/workspace/meet/api/guides/overview)
- [DWD best practices](https://knowledge.workspace.google.com/admin/apps/domain-wide-delegation-best-practices)
