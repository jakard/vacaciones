# Investigación: ¿ya existe esta solución?

**Veredicto:** la combinación exacta (marketplace P2P de cobertura + moneda virtual ganada por cubrir + tabla de reconocimiento + contexto estructurado de TAM) **no existe como producto enviado**. Cada ingrediente sí existe por separado.

---

## Lo que sí existe

### 1. Apps de intercambio de turnos (sin moneda)
[Deputy](https://www.deputy.com/features/shift-swapping), [WorkJam](https://www.workjam.com/products/flexible-shift-management/), [Workforce.com](https://www.workforce.com/software/shift-swapping), [MangoApps](https://www.mangoapps.com/apps/shift-marketplace), [ShiftTrader](https://shifttrader.app/). Todas enfocadas en trabajo por hora / retail. Ninguna apunta a knowledge workers con portafolio de clientes. Ninguna recompensa al que cubre más allá de un "gracias".

### 2. El precedente más cercano: **shift bidding** por puntos
Centros de llamadas y hospitales grandes (ver [Verint](https://wfo.mt2.verintcloudservices.com/OnlineHelp/en_US/wfm/WFM_ReqMgmt/wfm_RM_auction_workflow.htm), [MyShyft](https://www.myshyft.com/blog/shift-bidding-systems/), [AIHR](https://www.aihr.com/hr-glossary/shift-bidding/)) usan puntos asignados por el empleador para licitar por turnos preferidos. **Pero los puntos vienen del empleador, no de los compañeros.** No hay transacción P2P, no hay marketplace, no hay "cuanto más cubres, más ganas". Esta es la diferencia clave.

### 3. Monedas de reconocimiento (modelo correcto, caso de uso equivocado)
[Bonusly](https://bonusly.com/), [HeyTaco](https://heytaco.com/), [Matter](https://matterapp.com/), [Karma](https://karmabot.chat/), [Disco](https://slack.com/), [Kudos](https://www.kudos.com/). Todas dan puntos por buenas vibras. Nadie ha conectado una moneda de kudos a una **obligación de servicio recíproca concreta** como cobertura. Las monedas se ganan *porque alguien realmente cubrió trabajo*, no por ser "genial" — ese es un señal mucho más fuerte.

### 4. Time banking (modelo correcto, dominio equivocado)
1 hora de ayuda = 1 crédito. [hOurworld](https://hourworld.org/_TimeAndTalents.htm), [TimeRepublik](https://timerepublik.com/), [Community Weaver](https://timebanking.org/) (open source, ~200 time banks en EEUU). Repos OSS: [vzhan100/Time-Banking](https://github.com/vzhan100/Time-Banking), [codehesion/timebank](https://github.com/codehesion/timebank) — casi todos abandonados (proyectos de hobby).
- Lección: "1 hora = 1 crédito sin importar la skill" es ideológicamente importante en time banking pero **no encaja en cobertura corporativa** — cubrir 1 semana de un Enterprise no equivale a 1 semana de un SMB.
- Bloqueador de adopción crónico: liquidez. No es fácil mantener vivo un time bank.

### 5. PTO monetization (problema diferente)
[PTO Exchange](https://www.ptoexchange.com/), [Strada Buy/Sell PTO](https://marketplace.workday.com/en-US/apps/414034/buysell-pto/overview): convierten PTO no usado en dinero/401(k)/caridad. Es admin de beneficios, no marketplace. No resuelve cobertura.

### 6. Swap de on-call (cultura más cercana al flujo TAM)
[PagerDuty overrides](https://support.pagerduty.com/main/docs/my-on-call-shifts), [Pagerly](https://www.pagerly.io/), [rotation.app](https://rotation.app/), [rota-slackbot](https://github.com/kmaida/rota-slackbot). Sin moneda. La convención es reciprocidad informal ("yo te cubro, tú me cubres"). Es la base cultural sobre la que ya operan los TAMs.

### 7. Específico para TAMs de Google
No hay nada público. Los procesos internos de Google no están documentados externamente. Las páginas de [Google Cloud TAM](https://cloud.google.com/tam) describen el rol, no las operaciones internas.

---

## Lecciones clave para construir

**Lo que hace funcionar sistemas de moneda peer-to-peer:**
- **Emisión diaria/semanal, no en lump sums.** HeyTaco supera a Bonusly en engagement porque "úsalo o piérdelo" crea un loop de hábito.
- **Transparencia mata el cheating mejor que algoritmos.** Bonusly publicó que [el ledger visible + presión social](https://bonusly.com/post/transparency-gaming-the-system) previene la mayoría del gaming. Cero incidentes reportados de colusión.
- **Las monedas deben canjearse por algo que el receptor *realmente* quiera.** Karma ya incluye "Día libre" como canje — exactamente tu modelo, pero al revés (moneda → cobertura en vez de cobertura → moneda).

**Modos de falla comunes:**
- **Colusión recíproca** ("yo solicito, tú cubres, luego cambiamos de papel los mismos días").
- **Espiral de muerte de liquidez** — los time banks suelen morir porque no hay con quién gastar créditos cuando uno los quiere usar.
- **Inflación / hoarders** — los top accumulators acaparan; nuevos miembros no pueden alcanzarlos; las recompensas se vuelven inalcanzables.
- **Problema de equidad** — empleados senior con pocas vacaciones acumulan; junior con hijos se queman. Tu "reconocimiento al que más monedas tiene" puede ocultar esto.
- **Veto del manager** — la cobertura NO es decisión peer-to-peer en la mayoría de orgs; el manager debe aprobar. Si la app finge lo contrario, será bypaseada.

**El problema más difícil para TAMs no es el matching, es la transferencia de contexto.** Quien resuelva "briefing de 5 minutos de un portafolio de 8 clientes" gana más que quien resuelva "match de solicitud a coverer".

---

## Top 5 takeaways

1. **Diferénciate en el handoff de contexto, no en la moneda.** La economía de monedas es el gancho; la plantilla estructurada "esto es todo lo que necesitas saber para cuidar 8 clientes por 2 semanas" es el moat real.
2. **Roba el playbook de transparencia anti-cheat de Bonusly.** Ledger público, top earners visibles, historial de transacciones. No construyas detección de colusión — construye visibilidad de colusión.
3. **No fijes una moneda por día; escala el valor con dificultad de cobertura** (duración, tier de cliente, premium por feriado). Sino replicas la falla de time banks ("ningún senior quiere cubrir").
4. **Slack-first, manager-approved.** El flujo de aprobación es no-negociable en enterprise. La capa de monedas va encima del flujo de aprobación, no en lugar de él.
5. **Planifica liquidez desde la semana uno.** Subsidio inicial por empleado, quórum mínimo (no lanzar en equipo de 5), evento trimestral de "vaciado de monedas" (top earners obtienen perks reales) para que las monedas nunca se sientan inútiles.
