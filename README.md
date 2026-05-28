# Vacaciones

Vacation coverage app for Google Technical Account Managers with a virtual-currency economy.

When a TAM goes OOO, they post a coverage request and pay virtual coins to whichever colleague accepts to cover them. The coverer earns those coins, which they can later spend when they themselves want to go on vacation. The top earners in a rolling 90-day window get recognition.

The app is single-domain (Google Workspace SSO restricted by domain), data lives in Firestore, and the briefing for each coverage request can auto-populate from Gmail / Calendar / Drive / Sheets via incremental OAuth consent.

## Architecture

- **Frontend**: Angular 21+ with AngularFire, Angular Material, Tailwind (Vitest as test runner)
- **Backend**: Cloud Functions for Firebase v2 (Node 22 + TypeScript)
- **Database**: Firestore (region `nam5`)
- **Auth**: Firebase Auth with Google provider, restricted by `hd=`
- **Workspace integration**: `googleapis` + incremental OAuth, refresh tokens encrypted via Cloud KMS, accessed only from Functions
- **Hosting**: Firebase Hosting (web) + Cloud Functions (backend)

See `docs/` for the design history:

- [`01-research-existing-solutions.md`](docs/01-research-existing-solutions.md) — competitive landscape & gap analysis
- [`02-economy-design.md`](docs/02-economy-design.md) — coin economy (grant, stipend, pricing, anti-gaming, recognition)
- [`03-handover-briefing.md`](docs/03-handover-briefing.md) — TAM briefing information model + Workspace auto-population
- [`04-tech-plan-phase1.md`](docs/04-tech-plan-phase1.md) — technical plan and decisions

## Repo layout

```
.
├── web/             # Angular app (Firebase Hosting)
├── functions/       # Cloud Functions (Firebase)
├── shared/          # Shared TypeScript types between web and functions
├── docs/            # Design docs
├── firebase.json    # Firebase project config
├── firestore.rules  # Firestore Security Rules
├── firestore.indexes.json
└── package.json     # npm workspaces root
```

## Local development

### Prerequisites

- Node 22+
- npm 11+
- Firebase CLI (`npm i -g firebase-tools`)
- A Firebase project (free Spark tier is enough for dev)
- Java 11+ (required by Firestore emulator)

### Setup

```bash
# 1. Install dependencies for all workspaces
npm install

# 2. Build shared types (web and functions both import from here)
npm run build:shared

# 3. Configure Firebase project
# Edit .firebaserc to point to your Firebase project IDs:
#   - default: dev project
#   - staging: staging project
#   - production: production project
firebase use default

# 4. Run the emulators (Auth + Firestore + Functions + Hosting)
npm run dev
```

The emulator UI is at http://localhost:4000.

### Building & deploying

```bash
# Build everything
npm run build

# Deploy everything
npm run deploy

# Deploy individual pieces
npm run deploy:web
npm run deploy:functions
npm run deploy:rules
```

## Status

Phase 0 (research + design) complete as of 2026-05-28. Phase 1 scaffolding in progress.

See [`docs/04-tech-plan-phase1.md`](docs/04-tech-plan-phase1.md) section "Primer milestone" for the next-up scope.
