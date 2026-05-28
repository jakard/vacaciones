# Diseño de la economía de monedas ("CoverCoin")

**TL;DR:** Economía cerrada P2P. Cada miembro recibe **20 monedas de bienvenida** al unirse + **10 monedas mensuales** (las mensuales expiran si no se gastan). Cobertura cuesta **5 monedas/día**, con multiplicador **2x en fin de semana y feriados**. El reconocimiento usa un **leaderboard rolling de 90 días** de "monedas ganadas" (no balance total) — esto mata el hoarding.

---

## 1. Asignación inicial

**20 monedas planas al unirse**, sin importar tenure o rol.

- 20 monedas ≈ 4 días de cobertura al precio recomendado (5/día) → ~una semana típica. El nuevo miembro puede pedir cobertura real en su primer trimestre sin sentirse pobre.
- Plano evita dos fallas: (a) por tenure entrincha ventaja del veterano, (b) por rol convierte reconocimiento entre pares en refuerzo de jerarquía.
- Es un grant, no recurrente — funciona como runway. El stipend mensual es el "salario".

**Edge case:** join a mitad de mes → stipend prorrateado además del grant.

---

## 2. Política de emisión (minting)

**Híbrido: stipend mensual chico (10 monedas) que expira + ganar cubriendo.**

| Modelo | Pros | Contras |
|---|---|---|
| Solo stipend mensual fijo | Predecible | Inflación si no se gasta; premia inactividad |
| Solo ganar cubriendo (cerrado) | Suma cero, sin inflación | Nuevos miembros y los que viajan poco se mueren de hambre |
| **Híbrido stipend + ganar** ✅ | Liquidez + señal real | Dos sistemas para balancear |
| Atado a PTO (20 días PTO = 20×rate monedas/año) | Elegante filosóficamente | Requiere integración HR día 1; castiga a quien tiene menos PTO |

El híbrido gana porque la literatura de game economy es clara: **cada faucet necesita un sink, y los stipends que no expiran se vuelven hoards** ([1kx, Sinks & Faucets](https://medium.com/1kxnetwork/sinks-faucets-lessons-on-designing-effective-virtual-game-economies-c8daf6b88d05); [Android Devs Blog](https://android-developers.googleblog.com/2015/10/virtual-currency-sources-and-sinks.html)). Bonusly usa explícitamente un allowance mensual que expira por la misma razón ([Bonusly Help](https://help.bonus.ly/en/articles/357159-setting-the-monthly-allowance)).

**Regla concreta:** El día 1 de cada mes, cada miembro activo recibe 10 monedas en su balance gastable. Esas 10 monedas decaen a fin de mes si no se gastan. Las monedas *ganadas cubriendo* NO decaen — esas son el trofeo.

**Dos buckets:**
- **Stipend bucket** (resetea mensual, úsalo o piérdelo) — mantiene la economía fluyendo.
- **Earned bucket** (permanente, lo que lee el leaderboard) — mantiene la señal honesta.

---

## 3. Precio de cobertura

**Plano: 5 monedas/día completo, multiplicador 2x para fin de semana y feriados. Nada más en Fase 1.**

- Subastas son tentadoras pero introducen overhead de negociación y ansiedad de price discovery en cada solicitud. Un equipo de 5-15 no tiene liquidez para subastas saludables — usualmente tendrías un solo bidder, que es un precio fijo con pasos extra.
- Pricing por demanda (feriados cuestan más) **sí** vale mantenerlo: cubrir el 24 de diciembre vale más que un 12 de febrero. Un multiplicador 2x en fines de semana + lista configurable de feriados captura 80% del valor con 5% de la complejidad.

**Por qué 5 monedas/día:** Con stipend de 10/mes, un miembro puede pedir 2 días de cobertura laboral al mes solo con stipend. Más allá requiere ganar cubriendo a otros — que es el loop de comportamiento intencional. El número también está debajo de las 20 monedas del onboarding grant para que nuevos pidan ausencia significativa de inmediato.

**Fase 2:** campo opcional de "tip" (requester ofrece 6 o 7 monedas para atraer cobertura en slot poco apetecible), después bidding real para semanas alta demanda.

---

## 4. Anti-gaming

| Modo de falla | Mitigación |
|---|---|
| **Colusión** (A y B se "cubren" en papel) | Solicitudes deben referenciar PTO real (integración con calendar en Fase 2; honor system + log visible al manager en Fase 1). Prompts random "¿esta cobertura ocurrió?" al manager del coverer trimestralmente. |
| **Hoarding** (nunca tomar vacaciones, topear el board) | Dos defensas: (1) leaderboard rankea **monedas ganadas en últimos 90 días**, no balance lifetime — el oro viejo decae de la vista; (2) stipend mensual expira, así rehusarte a participar solo pierde monedas. |
| **Inflación** | Expiry del stipend es el sink principal. Sink secundario: **1 moneda de comisión por transacción** (se quema). A ~10 días cubiertos/mes a nivel equipo, ~10 monedas/mes salen del sistema. Si el balance equipo crece >20% YoY, baja stipend. |
| **Free-riders** (siempre cubierto, nunca cubre, balance → 0) | **Sin balances negativos en Fase 1.** Al llegar a 0, aún puede postear, pero queda flag "unfunded — requires manager approval". El manager aprueba un advance una vez (capped en 10/trimestre por reporte) o declina. Fuerza la conversación al canal correcto sin que la app sea el malo. |
| **Imbalance nuevos vs. veteranos** | 20-coin grant + stipend → Day-1 joiner puede pedir cobertura completa de una semana inmediatamente. Ventana rolling de 90d → veterano de 5 años no tiene ventaja permanente. |
| **Reverse free-rider** (cubre mucho, balance explota, no sabe en qué gastar) | Es el problema *bueno* — son los ganadores. Añadir acción "gift coins" (transferir a otro miembro, capped 5/transferencia/semana para evitar lavado). |

Comisión + expiry del stipend = sinks. Stipend + pagos de cobertura = faucets. La guía de game economy es clara ([Machinations.io](https://machinations.io/articles/what-is-game-economy-inflation-how-to-foresee-it-and-how-to-overcome-it-in-your-game-design); [PulseGeek](https://pulsegeek.com/articles/inflation-in-video-game-economies-causes-and-fixes/)): este balance faucet/sink es la palanca más importante. Si lo aciertas, casi todo lo demás se encoge.

---

## 5. Reconocimiento

**Leaderboard rolling de 90 días por "monedas ganadas", badge trimestral, visibilidad del manager.**

- **Métrica: monedas ganadas en últimos 90 días.** No balance total. Esto resuelve la tensión spend-down vs. accumulation — gastar no afecta tu rank porque el rank es flujo, no stock.
- **Sin reset duro.** Resets se sienten punitivos y causan gaming de fin de período. Ventanas rolling son continuas.
- **Badge trimestral "Most Helpful Teammate"** al top 1-2 del trimestre. Se muestra en la app, en digest semanal del equipo, y (la parte clave) **se adjunta automáticamente como nota al manager del miembro vía Slack/email digest configurable**. La visibilidad del manager es la recompensa real — aparece en conversaciones de performance.
- **Perk tangible (opcional, financiado por la org):** ganador trimestral obtiene primera elección en próxima ventana de vacaciones, o un presupuesto chico (almuerzo, swag).
- **Leaderboard secundario: "Coins given".** Premia ser cliente dispuesto también — importante porque si nadie pide, nadie gana.

---

## 6. Edge cases

- **Nadie acepta:** auto-escala después de 48h al manager del requester, quien puede (a) reasignar, (b) subir el bounty con monedas bonus minteadas por manager, o (c) declinar el PTO. La app NO algoritmiza esto — es decisión de manager.
- **Coverer abandona a mitad:** monedas se escrowing al aceptar, se liberan en increments diarios. Abandonar pierde la porción no liberada → vuelve al requester. Disputas ("cubrí lun-mié, después me enfermé") van a review del manager, SLA 7 días.
- **Alguien deja el equipo:** monedas earned se queman (no se redistribuyen — redistribuir crea perverso "qué bueno que se fue"). Su contribución lifetime queda como artefacto histórico en el leaderboard.
- **Cobertura parcial:** Fase 1 solo medio día (2 monedas) y día completo (5 monedas). "Solo on-call" o "solo cliente específico" es real pero complejo — Fase 2.
- **Múltiples coverers para una ausencia:** Fase 1 — requester elige uno; si necesita cobertura split, postea dos solicitudes. Fase 2 — split nativo con distribución proporcional.

---

## 7. Fase 1 vs Fase 2

**Fase 1 (envía esto):**
- 20 monedas grant + 10 monedas stipend mensual expirable
- 5 monedas/día plano, 2x fin de semana/feriado
- Un solo coverer, medio día y día completo
- Escrow + liberación diaria
- Leaderboard rolling 90d, badge trimestral con digest al manager
- Sin balances negativos; solicitudes unfunded requieren aprobación de manager
- 1 moneda de comisión por transacción
- Disputes manuales vía manager
- PTO por honor system (sin integración calendar todavía)

**Fase 2 (después):**
- Integración Calendar / sistema PTO para verificar ausencias automáticamente
- Campo tip/bid en solicitudes para slots poco apetecibles
- Pricing dinámico por demanda en semanas de alta demanda
- Split multi-coverer
- Scopes custom de cobertura (solo on-call, clientes específicos)
- Transferencias entre miembros (gift coins)
- Cobertura cross-team
- Pricing configurable por equipo

El corte de Fase 1 es **deliberadamente aburrido**. Aburrido es el punto: lo *interesante* es el loop social de reconocimiento, no las mecánicas de la moneda. Saca las mecánicas del medio para que el reconocimiento haga su trabajo.
