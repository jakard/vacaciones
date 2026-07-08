// Plain / corporate voice overlay. When "Pirate mode" is OFF, t() consults
// this map FIRST (keyed by the same pirate-English source string), and uses
// the {en|es} corporate wording for the active language. Any string not in
// this map is not pirate-flavored, so it falls through to the normal path
// (pirate-ES dict for Spanish, the key itself for English) — which for a
// neutral string is identical in both voices.
//
// Glossary (pirate → corporate): doubloon→credit · bounty→coverage request ·
// crew→team · crewmate→teammate · coverer→cover · chest→wallet · voyage→cover
// · Voyage Rank→Level · Wall of Fame→Leaderboard · tavern→Recognition ·
// (thank-you) scroll→thank-you note · tip hat→say thanks · Crown's stipend→
// monthly allowance · shore leave→time off · harbour→(neutral).
//
// Keys with {placeholders} keep the SAME placeholders in both voices.
export const PLAIN = {
  // ---- Ranks (Level ladder) ----
  'Cabin Boy': { en: 'Newcomer', es: 'Novato' },
  'Deckhand': { en: 'Contributor', es: 'Colaborador' },
  'Mate': { en: 'Regular', es: 'Habitual' },
  'Bosun': { en: 'Reliable', es: 'De confianza' },
  'Quartermaster': { en: 'Seasoned', es: 'Experimentado' },
  'First Mate': { en: 'Expert', es: 'Experto' },
  'Captain': { en: 'Leader', es: 'Líder' },
  'Commodore': { en: 'Champion', es: 'Campeón' },

  // ---- Achievements ----
  'Set Sail': { en: 'First Cover', es: 'Primera cobertura' },
  'Old Salt': { en: 'Veteran', es: 'Veterano' },
  "Captain's Hat": { en: 'Century Club', es: 'Club del centenar' },
  'Treasure Hunter': { en: 'Top Earner', es: 'Gran acumulador' },
  'Weekend Warrior': { en: 'Weekend Cover', es: 'Cobertura de fin de semana' },
  'Generous Sea Dog': { en: 'Team Player', es: 'Buen compañero' },
  'Live Free': { en: 'Use It or Lose It', es: 'Úsalo o piérdelo' },
  'Loyal Crew': { en: 'Multi-Team', es: 'Multiequipo' },

  // ---- Ledger labels ----
  'Welcome chest': { en: 'Welcome grant', es: 'Bono de bienvenida' },
  'Crown’s stipend': { en: 'Monthly allowance', es: 'Asignación mensual' },
  'Stipend expired': { en: 'Allowance expired', es: 'Asignación caducada' },
  'Bounty posted (escrow)': { en: 'Request posted (held)', es: 'Solicitud publicada (retenido)' },
  'Bounty refunded': { en: 'Request refunded', es: 'Solicitud reembolsada' },
  'Covered a crewmate': { en: 'Covered a teammate', es: 'Cubriste a un compañero' },
  'Harbour fee': { en: 'Service fee', es: 'Comisión' },
  'Captain’s advance': { en: 'Manager advance', es: 'Adelanto del manager' },

  // ---- Core nouns / short labels ----
  'doubloons': { en: 'credits', es: 'créditos' },
  'Total doubloons': { en: 'Total credits', es: 'Créditos totales' },
  'Total doubloons in this crew': { en: 'Total credits in this team', es: 'Créditos totales en este equipo' },
  'Your treasure chest': { en: 'Your wallet', es: 'Tu cartera' },
  'Your doubloons': { en: 'Your credits', es: 'Tus créditos' },
  'Captain’s log': { en: 'Transaction history', es: 'Historial de movimientos' },
  'Crew': { en: 'Team', es: 'Equipo' },
  'Crews': { en: 'Teams', es: 'Equipos' },
  'Your Crews': { en: 'Your Teams', es: 'Tus equipos' },
  'a crewmate': { en: 'a teammate', es: 'un compañero' },
  'A crewmate': { en: 'A teammate', es: 'Un compañero' },
  'Post a bounty': { en: 'Post a request', es: 'Publicar una solicitud' },
  'Post bounty': { en: 'Post request', es: 'Publicar solicitud' },
  'Bounty detail': { en: 'Request detail', es: 'Detalle de la solicitud' },
  'Your bounty': { en: 'Your request', es: 'Tu solicitud' },
  'Edit bounty': { en: 'Edit request', es: 'Editar solicitud' },
  'Cover this bounty': { en: 'Cover this request', es: 'Cubrir esta solicitud' },
  'Voyage Rank + Wall of Fame': { en: 'Level + Leaderboard', es: 'Nivel + Clasificación' },
  'Wall of Fame': { en: 'Leaderboard', es: 'Clasificación' },
  'The Tavern · recent scrolls': { en: 'Recognition · recent notes', es: 'Reconocimiento · notas recientes' },
  'Thank-You Scrolls': { en: 'Thank-you notes', es: 'Notas de agradecimiento' },
  'Send Thank-You Scroll': { en: 'Send thank-you note', es: 'Enviar nota de agradecimiento' },
  'Send a thank-you scroll': { en: 'Send a thank-you note', es: 'Enviar una nota de agradecimiento' },
  'Send scroll': { en: 'Send note', es: 'Enviar nota' },
  'Tip hat': { en: 'Say thanks', es: 'Agradecer' },
  'Covering a bounty': { en: 'Covering a request', es: 'Cubrir una solicitud' },
  'Grant bonus doubloons': { en: 'Grant bonus credits', es: 'Otorgar créditos extra' },
  'Send doubloons': { en: 'Send credits', es: 'Enviar créditos' },
  'The doubloon economy': { en: 'How credits work', es: 'Cómo funcionan los créditos' },
  'Single coverer': { en: 'Single cover', es: 'Una sola persona' },
  'Crew coverage': { en: 'Team coverage', es: 'Cobertura en equipo' },
  'Crew coverers': { en: 'Covers', es: 'Quienes cubren' },
  'What you’re covered for · pick any': { en: 'What you need covered · pick any', es: 'Qué necesitas cubrir · elige las que apliquen' },
  'SLA the coverer should hold': { en: 'SLA the cover should hold', es: 'SLA que debe mantener quien cubre' },

  // ---- Crew management ----
  'Create crew': { en: 'Create team', es: 'Crear equipo' },
  'Form a crew': { en: 'Create a team', es: 'Crear un equipo' },
  'Manage crew': { en: 'Manage team', es: 'Gestionar equipo' },
  'Disband crew': { en: 'Delete team', es: 'Eliminar equipo' },
  'Disband this crew?': { en: 'Delete this team?', es: '¿Eliminar este equipo?' },
  'Disband…': { en: 'Delete…', es: 'Eliminar…' },
  'Crew settings': { en: 'Team settings', es: 'Ajustes del equipo' },
  'Crew identity': { en: 'Team identity', es: 'Identidad del equipo' },
  'Crew name': { en: 'Team name', es: 'Nombre del equipo' },
  'Crew photo URL (optional)': { en: 'Team photo URL (optional)', es: 'URL de foto del equipo (opcional)' },
  'Crew not found': { en: 'Team not found', es: 'Equipo no encontrado' },
  'Remove from crew': { en: 'Remove from team', es: 'Quitar del equipo' },
  'Remove from crew?': { en: 'Remove from team?', es: '¿Quitar del equipo?' },
  'Sign on with a crew': { en: 'Join a team', es: 'Unirte a un equipo' },
  'Back to your crews': { en: 'Back to your teams', es: 'Volver a tus equipos' },
  'Rename the crew or set its photo.': { en: 'Rename the team or set its photo.', es: 'Renombra el equipo o cambia su foto.' },
  'Only the crew manager can edit settings.': { en: 'Only the team manager can edit settings.', es: 'Solo el manager del equipo puede editar los ajustes.' },
  'Ask a crew manager to share an invite link.': { en: 'Ask a team manager to share an invite link.', es: 'Pide a un manager del equipo un enlace de invitación.' },
  'Paste the invite link a crew manager shared.': { en: 'Paste the invite link a team manager shared.', es: 'Pega el enlace de invitación que compartió un manager.' },
  'Crew ID (internal reference — invites use manager-shared links)': { en: 'Team ID (internal reference — invites use manager-shared links)', es: 'ID del equipo (referencia interna — las invitaciones usan enlaces del manager)' },
  'Crew name cannot be empty.': { en: 'Team name cannot be empty.', es: 'El nombre del equipo no puede estar vacío.' },
  'Crew name does not match.': { en: 'Team name does not match.', es: 'El nombre del equipo no coincide.' },
  'Crew updated.': { en: 'Team updated.', es: 'Equipo actualizado.' },
  'Crew settings saved.': { en: 'Team settings saved.', es: 'Ajustes del equipo guardados.' },
  'Crew disbanded.': { en: 'Team deleted.', es: 'Equipo eliminado.' },
  'No crew yet.': { en: 'No team yet.', es: 'Aún sin equipo.' },
  'No crew loaded.': { en: 'No team loaded.', es: 'No hay equipo cargado.' },
  'Loading crew settings…': { en: 'Loading team settings…', es: 'Cargando ajustes del equipo…' },
  'Mustering the crew…': { en: 'Loading the team…', es: 'Cargando el equipo…' },
  'Type the crew name to confirm': { en: 'Type the team name to confirm', es: 'Escribe el nombre del equipo para confirmar' },
  'Could not load the crew: {msg}': { en: 'Could not load the team: {msg}', es: 'No se pudo cargar el equipo: {msg}' },
  'Could not load your crews: {msg}': { en: 'Could not load your teams: {msg}', es: 'No se pudieron cargar tus equipos: {msg}' },
  'You may have been pressed elsewhere, or the crew ID is wrong.': { en: 'You may have been moved, or the team ID is wrong.', es: 'Quizá te movieron, o el ID del equipo es incorrecto.' },

  // ---- Parametrized messages ----
  'Bounty from {name}, {status}, {n} doubloons': { en: 'Request from {name}, {status}, {n} credits', es: 'Solicitud de {name}, {status}, {n} créditos' },
  'Bounty posted for {n} doubloons.': { en: 'Request posted for {n} credits.', es: 'Solicitud publicada por {n} créditos.' },
  'Bounty cancelled.': { en: 'Request cancelled.', es: 'Solicitud cancelada.' },
  'Bounty cancelled. {n} doubloons refunded.': { en: 'Request cancelled. {n} credits refunded.', es: 'Solicitud cancelada. {n} créditos reembolsados.' },
  'Bounty updated.': { en: 'Request updated.', es: 'Solicitud actualizada.' },
  'Cancel bounty': { en: 'Cancel request', es: 'Cancelar solicitud' },
  'Cancel bounty?': { en: 'Cancel request?', es: '¿Cancelar la solicitud?' },
  'Cancel this bounty? <strong>{n} doubloons</strong> will be refunded to the requester.': { en: 'Cancel this request? <strong>{n} credits</strong> will be refunded to the requester.', es: '¿Cancelar esta solicitud? Se reembolsarán <strong>{n} créditos</strong> al solicitante.' },
  'Cancel this bounty? Nothing to refund.': { en: 'Cancel this request? Nothing to refund.', es: '¿Cancelar esta solicitud? No hay nada que reembolsar.' },
  'Force complete bounty?': { en: 'Force complete request?', es: '¿Forzar el cierre de la solicitud?' },
  'Bounty force-completed.': { en: 'Request force-completed.', es: 'Solicitud completada a la fuerza.' },
  'Bounty force-completed. Released {n} doubloons over 1 day.': { en: 'Request force-completed. Released {n} credits over 1 day.', es: 'Solicitud completada a la fuerza. Se liberaron {n} créditos de 1 día.' },
  'Bounty force-completed. Released {n} doubloons over {d} days.': { en: 'Request force-completed. Released {n} credits over {d} days.', es: 'Solicitud completada a la fuerza. Se liberaron {n} créditos de {d} días.' },
  'Voyage accepted in full. {n} doubloons in escrow.': { en: 'Cover accepted in full. {n} credits held.', es: 'Cobertura aceptada por completo. {n} créditos retenidos.' },
  'Took 1 account-day. {n} doubloons in escrow.': { en: 'Reserved 1 account-day. {n} credits held.', es: 'Reservaste 1 cuenta-día. {n} créditos retenidos.' },
  'Took {d} account-days. {n} doubloons in escrow.': { en: 'Reserved {d} account-days. {n} credits held.', es: 'Reservaste {d} cuentas-día. {n} créditos retenidos.' },
  '{a} of {b} account-days · {n} doubloons': { en: '{a} of {b} account-days · {n} credits', es: '{a} de {b} cuentas-día · {n} créditos' },
  'Take {n} account-days': { en: 'Reserve {n} account-days', es: 'Reservar {n} cuentas-día' },
  'Claim accounts to cover': { en: 'Choose accounts to cover', es: 'Elige las cuentas a cubrir' },
  'Claim ({n} left)': { en: 'Cover ({n} left)', es: 'Cubrir ({n} libres)' },
  'Tap the account-days you can cover. Claimed cells are locked.': { en: 'Select the account-days you can cover. Taken cells are locked.', es: 'Selecciona las cuentas-día que puedes cubrir. Las celdas tomadas están bloqueadas.' },
  '{x}× multiplier on Saturdays and Sundays. Doubloons leave your chest and sit in escrow until a crewmate covers.': { en: '{x}× on Saturdays and Sundays. Credits leave your wallet and sit in escrow until a teammate covers.', es: '{x}× los sábados y domingos. Los créditos salen de tu cartera y quedan en depósito hasta que un compañero cubre.' },
  'Earned {n} doubloons by covering.': { en: 'Earned {n} credits by covering.', es: 'Ganaste {n} créditos cubriendo.' },
  'Welcome chest opened (+{n} doubloons).': { en: 'Welcome grant received (+{n} credits).', es: 'Bono de bienvenida recibido (+{n} créditos).' },
  "Crown's stipend: +{n} doubloons (expires monthly).": { en: 'Monthly allowance: +{n} credits (expires monthly).', es: 'Asignación mensual: +{n} créditos (caduca cada mes).' },
  'Harbour fee: {n} doubloons.': { en: 'Service fee: {n} credits.', es: 'Comisión: {n} créditos.' },
  'Earn <strong>{n}</strong> more doubloons to reach <strong>{rank}</strong>.': { en: 'Earn <strong>{n}</strong> more credits to reach <strong>{rank}</strong>.', es: 'Gana <strong>{n}</strong> créditos más para llegar a <strong>{rank}</strong>.' },
  'Highest rank achieved. Your name will be sung in shanties.': { en: 'Highest level reached. Nice work.', es: 'Nivel máximo alcanzado. Buen trabajo.' },
  '{n} doubloons earned lifetime': { en: '{n} credits earned lifetime', es: '{n} créditos ganados en total' },
  'Sent {n} doubloons to {name}.': { en: 'Sent {n} credits to {name}.', es: 'Enviados {n} créditos a {name}.' },
  'Topped up {n} crewmates (+{coins} each).': { en: 'Topped up {n} teammates (+{coins} each).', es: 'Completados {n} compañeros (+{coins} cada uno).' },
  'Crew "{name}" formed. 125 doubloons in your chest.': { en: 'Team "{name}" created. 125 credits in your wallet.', es: 'Equipo "{name}" creado. 125 créditos en tu cartera.' },
  'Signed aboard! 125 doubloons in your chest.': { en: 'Joined! 125 credits in your wallet.', es: '¡Te uniste! 125 créditos en tu cartera.' },
  'You’re already aboard that crew.': { en: 'You’re already on that team.', es: 'Ya estás en ese equipo.' },
  'Could not register your sailor card: {msg}': { en: 'Could not set up your profile: {msg}', es: 'No se pudo configurar tu perfil: {msg}' },
  'Could not send the scroll: {msg}': { en: 'Could not send the note: {msg}', es: 'No se pudo enviar la nota: {msg}' },
  'Thank-you scroll sent.': { en: 'Thank-you note sent.', es: 'Nota de agradecimiento enviada.' },
  'You cannot send a scroll to yourself.': { en: 'You cannot send a note to yourself.', es: 'No puedes enviarte una nota a ti mismo.' },
  'Send the first scroll to a crewmate who covered you well.': { en: 'Send the first note to a teammate who covered you well.', es: 'Envía la primera nota a un compañero que te cubrió bien.' },
  'The tavern is quiet.': { en: 'No recognition yet.', es: 'Aún no hay reconocimientos.' },
  'Peer recognition, decoupled from doubloons. Hand someone a tip of the hat for a good cover.': { en: 'Peer recognition, separate from credits. Say thanks to someone for a good cover.', es: 'Reconocimiento entre compañeros, separado de los créditos. Agradece a quien cubrió bien.' },
  'No doubloons yet — the chest will fill as you act.': { en: 'No credits yet — your wallet fills as you act.', es: 'Aún sin créditos — tu cartera se llena con tus acciones.' },

  // ---- Members / admin ----
  '{name} was removed from the crew.': { en: '{name} was removed from the team.', es: '{name} fue retirado del equipo.' },
  'This will remove <strong>{name}</strong> from the crew. They can be re-invited, but their wallet for this crew is sealed.': { en: 'This will remove <strong>{name}</strong> from the team. They can be re-invited, but their wallet for this team is sealed.', es: 'Esto quitará a <strong>{name}</strong> del equipo. Puede volver con otra invitación, pero su cartera en este equipo queda sellada.' },
  'You become the quartermaster. Every crewmate starts with 125 doubloons — enough to cover 25 business days right away.': { en: 'You become the manager. Every teammate starts with 125 credits — enough to cover 25 business days right away.', es: 'Tú quedas como manager. Cada compañero empieza con 125 créditos — suficiente para cubrir 25 días laborables desde ya.' },
  'granted {n} doubloons to {name}': { en: 'granted {n} credits to {name}', es: 'otorgó {n} créditos a {name}' },
  'left the crew (account deletion)': { en: 'left the team (account deletion)', es: 'dejó el equipo (cuenta eliminada)' },
  'cancelled a bounty': { en: 'cancelled a request', es: 'canceló una solicitud' },
  'edited a bounty': { en: 'edited a request', es: 'editó una solicitud' },
  'force-completed a bounty': { en: 'force-completed a request', es: 'forzó el cierre de una solicitud' },
  'force-completed a bounty (released {n} doubloons over {d} days)': { en: 'force-completed a request (released {n} credits over {d} days)', es: 'forzó el cierre de una solicitud (liberó {n} créditos de {d} días)' },
  'changed crew settings': { en: 'changed team settings', es: 'cambió los ajustes del equipo' },
  'updated crew name / photo': { en: 'updated team name / photo', es: 'actualizó nombre / foto del equipo' },
  'this crewmate': { en: 'this teammate', es: 'este compañero' },
  'Permanently deletes this crew and everything in it — bounties, wallets, ledger, scrolls, audit log. Blocked while bounties are open or active.': { en: 'Permanently deletes this team and everything in it — requests, wallets, transaction history, notes, audit log. Blocked while requests are open or active.', es: 'Elimina permanentemente este equipo y todo lo que contiene — solicitudes, carteras, historial, notas, auditoría. Bloqueado mientras haya solicitudes abiertas o activas.' },
  'This permanently deletes <strong>{name}</strong> — every bounty record, wallet, ledger entry, scroll, and the audit log. It cannot be undone.': { en: 'This permanently deletes <strong>{name}</strong> — every request record, wallet, transaction, note, and the audit log. It cannot be undone.', es: 'Esto elimina permanentemente <strong>{name}</strong> — cada solicitud, cartera, movimiento, nota y el registro de auditoría. No se puede deshacer.' },
  'This permanently removes you from every crew, erases your profile, and deletes your sign-in. It cannot be undone.': { en: 'This permanently removes you from every team, erases your profile, and deletes your sign-in. It cannot be undone.', es: 'Esto te retira permanentemente de todos los equipos, borra tu perfil y elimina tu acceso. No se puede deshacer.' },
  'Blocked while you have open or active bounties, or while you are the last manager of a crew with other members.': { en: 'Blocked while you have open or active requests, or while you are the last manager of a team with other members.', es: 'Bloqueado mientras tengas solicitudes abiertas o activas, o seas el último manager de un equipo con más miembros.' },
  'Leaves all crews and erases your profile. Crew financial records keep an anonymous ID.': { en: 'Leaves all teams and erases your profile. Team financial records keep an anonymous ID.', es: 'Sales de todos los equipos y se borra tu perfil. Los registros financieros conservan un ID anónimo.' },
  'This will credit each crewmate who received the old 20-doubloon grant with the missing <strong>105 doubloons</strong> so everyone hits the new 125 starting balance. It runs once per crewmate (idempotent).': { en: 'This will credit each teammate who received the old 20-credit grant with the missing <strong>105 credits</strong> so everyone reaches the new 125 starting balance. It runs once per teammate (idempotent).', es: 'Esto abonará a cada compañero que recibió el bono antiguo de 20 los <strong>105 créditos</strong> que faltan para llegar a 125. Se ejecuta una sola vez por compañero (idempotente).' },
  'Top up starter chest?': { en: 'Top up starting balance?', es: '¿Completar el saldo inicial?' },

  // ---- Empty states / board ----
  'The bounty board is empty.': { en: 'No requests yet.', es: 'Aún no hay solicitudes.' },
  'Post one yourself — your crewmates earn doubloons by covering you.': { en: 'Post one yourself — your teammates earn credits by covering you.', es: 'Publica una — tus compañeros ganan créditos cubriéndote.' },
  'The wall fills as crewmates earn doubloons by covering each other.': { en: 'The leaderboard fills as teammates earn credits by covering each other.', es: 'La clasificación se llena cuando los compañeros ganan créditos cubriéndose.' },
  'One crewmate takes the whole window. Some clients want only one person on the rotation.': { en: 'One teammate takes the whole window. Some clients want only one person on the rotation.', es: 'Un compañero toma toda la ventana. Algunos clientes quieren una sola persona en la rotación.' },
  'Several crewmates can split the days. Long vacations get covered faster.': { en: 'Several teammates can split the days. Long time off gets covered faster.', es: 'Varios compañeros se reparten los días. El tiempo libre largo se cubre antes.' },

  // ---- Login / onboarding ----
  'Going on vacation? Post a bounty. A crewmate covers your accounts — with your briefing in hand — and earns doubloons for it.': { en: 'Going on vacation? Post a request. A teammate covers your accounts — with your briefing in hand — and earns credits for it.', es: '¿Te vas de vacaciones? Publica una solicitud. Un compañero cubre tus cuentas — con tu briefing en mano — y gana créditos por ello.' },
  'Going out? Post a bounty with your days, reachability, and context.': { en: 'Going out? Post a request with your days, reachability, and context.', es: '¿Te vas? Publica una solicitud con tus días, disponibilidad y contexto.' },
  'A crewmate claims it and gets your briefing — accounts, meetings, SLA.': { en: 'A teammate claims it and gets your briefing — accounts, meetings, SLA.', es: 'Un compañero la reclama y recibe tu briefing — cuentas, reuniones, SLA.' },
  'They earn doubloons day by day. Spend yours on your next trip.': { en: 'They earn credits day by day. Spend yours on your next trip.', es: 'Ganan créditos día a día. Gasta los tuyos en tu próximo viaje.' },
  'Pick a crew to manage bounties, or raise your own colours.': { en: 'Pick a team to manage requests, or create your own.', es: 'Elige un equipo para gestionar solicitudes, o crea el tuyo.' },

  // ---- Mascot lines ----

  // ---- Avatar / skins ----

  // ---- Misc leftovers ----
  'Unreachable — true shore leave': { en: 'Unreachable — fully off', es: 'Ilocalizable — desconexión total' },
  'Shore leave from': { en: 'Time off from', es: 'Tiempo libre desde' },
  'No meetings in this window. (Clear sailing!)': { en: 'No meetings in this window.', es: 'Sin reuniones en esta ventana.' },
  'Nothing new in the harbour.': { en: 'Nothing new right now.', es: 'Nada nuevo por ahora.' },
  'Loading the harbor…': { en: 'Loading…', es: 'Cargando…' },
  'What a day of coverage costs': { en: 'What a day of coverage costs', es: 'Cuánto cuesta un día de cobertura' },
  'What counts as a real emergency': { en: 'What counts as a real emergency', es: 'Qué cuenta como emergencia real' },
  'What counts as a real emergency? (optional)': { en: 'What counts as a real emergency? (optional)', es: '¿Qué cuenta como emergencia real? (opcional)' },
  'Pick dates above to see your meetings in that window.': { en: 'Pick dates above to see your meetings in that window.', es: 'Elige fechas arriba para ver tus reuniones en esa ventana.' },

  // ---- Help page ----
  'How Time Off works': { en: 'How Time Off works', es: 'Cómo funciona Time Off' },
  "Your purse, your starter chest, the Crown's stipend": { en: 'Your balance, your starting grant, the monthly allowance', es: 'Tu saldo, tu bono inicial, la asignación mensual' },
  'Every crewmate starts with <strong>125 doubloons</strong> the first time they join a crew — enough to cover ~25 business days of leave right away. On top of that, the Crown drops <strong>11 doubloons</strong> every month into your stipend purse. Stipend doubloons expire at the end of each month, so spend them or lose them. Earned doubloons (the ones you got by covering crewmates) never expire.': {
    en: 'Every teammate starts with <strong>125 credits</strong> the first time they join a team — enough to cover ~25 business days of leave right away. On top of that, the company adds <strong>11 credits</strong> every month to your allowance balance. Allowance credits expire at the end of each month, so spend them or lose them. Earned credits (the ones you got by covering teammates) never expire.',
    es: 'Cada compañero empieza con <strong>125 créditos</strong> al unirse a su primer equipo — suficiente para cubrir ~25 días laborables desde ya. Además, la empresa añade <strong>11 créditos</strong> cada mes a tu saldo de asignación. La asignación caduca a fin de mes: úsala o piérdela. Los créditos ganados (cubriendo a compañeros) no caducan nunca.',
  },
  "One day costs <strong>5 doubloons</strong> (Mon–Fri). Weekend days cost <strong>10</strong>. Holidays don't have special rates yet — they cost what their weekday says.": {
    en: "One day costs <strong>5 credits</strong> (Mon–Fri). Weekend days cost <strong>10</strong>. Holidays don't have special rates yet — they cost what their weekday says.",
    es: 'Un día cuesta <strong>5 créditos</strong> (lun–vie). Los días de fin de semana cuestan <strong>10</strong>. Los festivos aún no tienen tarifa especial — cuestan lo que diga su día de la semana.',
  },
  'Posting a bounty': { en: 'Posting a request', es: 'Publicar una solicitud' },
  "Pick a date range, pick which days you actually want covered (toggle weekends off if you're not asking for them), set how reachable you'll be, what kinds of work need covering, and an SLA. Costs come straight from your wallet (stipend first, then earned). Single coverer mode is the default — one crewmate takes everything. Crew mode lets multiple crewmates split days; the bounty stays open until every day is claimed.": {
    en: "Pick a date range, pick which days you actually want covered (toggle weekends off if you're not asking for them), set how reachable you'll be, what kinds of work need covering, and an SLA. Costs come straight from your wallet (allowance first, then earned). Single-cover mode is the default — one teammate takes everything. Team mode lets multiple teammates split days; the request stays open until every day is claimed.",
    es: 'Elige un rango de fechas, marca qué días quieres cubiertos (quita los findes si no los pides), define tu disponibilidad, qué tipos de trabajo hay que cubrir y un SLA. El coste sale de tu cartera (primero la asignación, luego lo ganado). El modo de una sola persona es el predeterminado — un compañero lo toma todo. El modo equipo permite repartir días; la solicitud sigue abierta hasta que todos los días estén reclamados.',
  },
  'Browse the Bounty Board. Click any open bounty to see the full briefing. In crew mode you pick which days you can cover; in single mode you take the whole window. Doubloons release to you one day at a time as the days pass, paid out by a daily cron.': {
    en: 'Browse the requests. Click any open request to see the full briefing. In team mode you pick which days you can cover; in single-cover mode you take the whole window. Credits release to you one day at a time as the days pass, paid out by a daily job.',
    es: 'Recorre las solicitudes. Haz clic en cualquiera abierta para ver el briefing completo. En modo equipo eliges qué días puedes cubrir; en modo individual tomas toda la ventana. Los créditos se te liberan día a día, pagados por una tarea diaria.',
  },
  "Your rank (Cabin Boy → Commodore) is based on lifetime doubloons earned by covering. The Wall of Fame ranks crewmates by what they earned in the last 90 days, so old salts can't sit on their laurels.": {
    en: 'Your level (Newcomer → Champion) is based on lifetime credits earned by covering. The Leaderboard ranks teammates by what they earned in the last 90 days, so veterans can’t rest on their laurels.',
    es: 'Tu nivel (Novato → Campeón) se basa en los créditos ganados cubriendo en toda tu historia. La Clasificación ordena a los compañeros por lo ganado en los últimos 90 días, así que los veteranos no pueden dormirse en los laureles.',
  },
  "Recognition that isn't tied to doubloons. Send a scroll to a crewmate who covered you well, or tip your hat to anyone on the Wall of Fame.": {
    en: "Recognition that isn't tied to credits. Send a thank-you note to a teammate who covered you well, or say thanks to anyone on the Leaderboard.",
    es: 'Reconocimiento que no depende de créditos. Envía una nota de agradecimiento a quien te cubrió bien, o agradece a cualquiera de la Clasificación.',
  },
  'Optional. Connect Calendar in the post form to pick which meetings the coverer should attend. When you accept a bounty you can add a coverage marker + the meetings to your own Calendar with one click.': {
    en: 'Optional. Connect Calendar in the post form to pick which meetings the cover should attend. When you accept a request you can add a coverage marker + the meetings to your own Calendar with one click.',
    es: 'Opcional. Conecta Calendar en el formulario para elegir qué reuniones debe atender quien cubra. Al aceptar una solicitud puedes añadir un marcador de cobertura + las reuniones a tu propio Calendar con un clic.',
  },
  'If your crew has a Gemini API key in Settings, the requester can hit "✨ Generate briefing" on their bounty and Gemini will draft a structured briefing (orientation, accounts, what to do, emergency protocol, open questions). The coverer reads it inside the bounty detail.': {
    en: 'If your team has a Gemini API key in Settings, the requester can hit "✨ Generate briefing" on their request and Gemini will draft a structured briefing (orientation, accounts, what to do, emergency protocol, open questions). The cover reads it inside the request detail.',
    es: 'Si tu equipo tiene una clave de Gemini en Ajustes, el solicitante puede pulsar "✨ Generar briefing" en su solicitud y Gemini redactará un briefing estructurado (orientación, cuentas, qué hacer, protocolo de emergencia, preguntas abiertas). Quien cubre lo lee dentro del detalle.',
  },
  'A morning summary of open bounties, doubloons earned, and new scrolls. Transactional emails (acceptance, cancellations) stay on.': {
    en: 'A morning summary of open requests, credits earned, and new thank-you notes. Transactional emails (acceptance, cancellations) stay on.',
    es: 'Un resumen matutino de solicitudes abiertas, créditos ganados y notas de agradecimiento nuevas. Los correos transaccionales (aceptaciones, cancelaciones) siguen activos.',
  },
  'Optional. Lets you pick which meetings the coverer should attend, with Meet/Teams/Zoom links included.': {
    en: 'Optional. Lets you pick which meetings the cover should attend, with Meet/Teams/Zoom links included.',
    es: 'Opcional. Te deja elegir qué reuniones debe atender quien cubra, con enlaces de Meet/Teams/Zoom incluidos.',
  },
};
