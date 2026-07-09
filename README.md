# Unplugged

A vacation-coverage **marketplace** for Google TAMs with a virtual
doubloon economy. When you go OOO you post a *bounty*; crewmates claim
your days (all of them, or a split in crew mode), the doubloons you
escrowed release to them day by day, and the context — SLA,
reachability, scope, meetings, an AI briefing — travels with the claim.
Earned doubloons never expire; the monthly stipend does. Top coverers
over a rolling 90 days get the Wall of Fame.

**Live:** https://vacaciones-dev-b3158.web.app
*(internally codenamed "Vacaciones"; user-facing name is Unplugged)*

## Architecture (actual)

The product is a **vanilla ES-module SPA** + **Firebase**. There is no
frontend framework and no build step (yet — see the plan in
[docs/17](docs/17-master-improvement-plan.md), which migrates this to
Vite + TypeScript incrementally).

```
app/                  ← the deployed frontend (Firebase Hosting)
  index.html          ← 60 lines; loads Firebase SDK from gstatic CDN
  app.js              ← single-file SPA: state, hash router, renderers
  styles.css          ← design system + 4 skins via [data-skin=...]
functions/src/
  http/               ← 22 onCall callables (zod-validated, Admin SDK)
  scheduled/          ← dailyCoverageRelease, monthlyStipendMint, dailyDigest
  services/           ← wallet.ts (ledger engine), mail.ts (outbound email)
  _shared/            ← build-time copy of shared/ (scripts/copy-shared.js)
shared/               ← TS source of truth for economy constants + types
firestore.rules       ← deny-by-default; money writes only via callables
firebase.json         ← hosting rewrites /api/* → callables, headers, emulators
docs/                 ← 17 design/audit/plan documents (read 16 + 17 first)
```

- **Auth**: Firebase Auth, Google provider.
- **Money**: append-only `ledgerEntries` with deterministic idempotency
  keys; wallets are projections; all mutations inside Firestore
  transactions (`functions/src/services/wallet.ts`).
- **Email**: callables/schedulers queue docs into `mail/`; the Firebase
  "Trigger Email" extension delivers them (see `functions/MAIL_SETUP.md`).
- **AI briefing**: per-crew Gemini API key stored server-side
  (`teams/{id}/private/settings`), called from `generateBriefing`.
- **Skins**: pirate · basic · high-contrast · dark-knight (default
  follows OS `prefers-color-scheme`).

## Develop

```bash
npm --prefix functions run build     # typecheck + compile functions
npm --prefix functions test          # economy test suite (needs Java for emulator)
firebase emulators:start             # needs Java (e.g. winget install Microsoft.OpenJDK.21)
firebase deploy --only hosting       # frontend
firebase deploy --only functions     # backend
```

There is currently **one** Firebase project (`vacaciones-dev-b3158`)
serving as both dev and prod — splitting them is Sprint-1 work in
[docs/17](docs/17-master-improvement-plan.md) §4.

## Stand up a fresh environment

To provision an entirely new GCP/Firebase project (own config, own data,
own auth) and deploy to it in one command:

```bash
scripts/bootstrap-gcp.sh --project-id timeoff-acme-prod \
  --project-name "Unplugged (Acme)" --billing-account <ID> --alias prod-acme
```

It creates the project, links billing, enables APIs, creates Firestore,
registers a Web App (writing `app/firebase-config.js` — the only
environment-specific file), and deploys. Full guide + the manual OAuth
consent steps: [docs/19](docs/19-bootstrap-new-environment.md).

## Where to read next

- [docs/17 — Master improvement plan](docs/17-master-improvement-plan.md)
  (competitive landscape, architecture decisions, roadmap)
- [docs/16 — Product excellence synthesis](docs/16-product-excellence-synthesis.md)
  (the 12-item launch gate)
- [docs/02 — Economy design](docs/02-economy-design.md) (why the numbers
  are what they are)

Historical note: the repo originally scaffolded an Angular frontend
(`web/`, removed 2026-06-10 — see git history). The vanilla `app/`
shipped instead and is the only frontend.
