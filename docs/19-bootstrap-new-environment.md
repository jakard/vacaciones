# 19 — Bootstrap a brand-new environment from zero

`scripts/bootstrap-gcp.sh` stands up an **entirely separate** Time Off
environment — its own GCP/Firebase project, Web App config, Firestore, Auth,
Cloud Functions and Hosting — and deploys the app to it. Use it to spin up a
customer's dedicated tenant, a staging clone, or a fresh production project.

It is **idempotent**: safe to re-run. Every step checks whether the resource
already exists before creating it.

---

## Prerequisites

Installed and authenticated on the machine you run it from:

| Tool | Get it | Auth |
|---|---|---|
| `gcloud` | Google Cloud SDK | `gcloud auth login` |
| `firebase` | `npm i -g firebase-tools` | `firebase login` |
| `node`, `npm` | Node 22+ | — |

You also need a **billing account** you can attach (Cloud Functions require the
Blaze plan) and permission to create projects in your org (or no org, for a
personal account).

> Easiest host: **Google Cloud Shell** — `gcloud` and `firebase` are
> preinstalled and already authenticated. On Windows, **Git Bash** works.

---

## Run it

```bash
scripts/bootstrap-gcp.sh \
  --project-id   timeoff-acme-prod \
  --project-name "Time Off (Acme)" \
  --billing-account 0X0X0X-0X0X0X-0X0X0X \
  --alias        prod-acme
```

Flags:

| Flag | Required | Default | Notes |
|---|---|---|---|
| `--project-id` | ✅ | — | Globally-unique GCP id (6–30 chars, `a-z0-9-`) |
| `--project-name` | | `Time Off` | Display name (parentheses stripped) |
| `--billing-account` | strongly | — | `gcloud billing accounts list` to find yours |
| `--region` | | `us-central1` | Cloud Functions region |
| `--firestore-location` | | `nam5` | e.g. `nam5`, `eur3`, `us-central1` |
| `--alias` | | =project-id | Alias added to `.firebaserc` |
| `--google-client-id` / `--google-client-secret` | | — | Auto-enable Google sign-in (see below) |
| `--yes` / `-y` | | — | Skip the confirmation prompt |
| `--skip-deploy` | | — | Provision only; deploy later |

Find your billing account id first if you don't have it:

```bash
gcloud billing accounts list
```

---

## What it automates (8 steps)

1. **Create the GCP project** (`gcloud projects create`).
2. **Link billing** (`gcloud billing projects link`) — required for Functions.
3. **Add Firebase + enable APIs** — functions, build, artifact registry, run,
   eventarc, pubsub, scheduler, firestore, hosting, identitytoolkit, storage
   (+ Calendar & Generative Language for the optional features).
4. **Create the Firestore** native database in `--firestore-location`.
5. **Register a Web App** and write `app/firebase-config.js` from its SDK
   config (apiKey, appId, authDomain, projectId, storageBucket,
   messagingSenderId). This file is what `app/app.js` imports — nothing else
   in the code is environment-specific.
6. **Add a `.firebaserc` alias** so `firebase use <alias>` targets the project.
7. **Enable the Google sign-in provider** — automatically via the Identity
   Toolkit Admin API *if* you pass `--google-client-id`/`--google-client-secret`;
   otherwise it prints the one-click console link.
8. **Build and deploy** `firestore` (rules + indexes), `functions`, `hosting`.

At the end it prints the live URL (`https://<project-id>.web.app`) and the
remaining manual steps.

---

## What stays manual (Google requires a console UI)

- **OAuth consent screen.** Set the app name and support email. **For the
  Google Calendar integration** you must add the scopes
  `.../auth/calendar.readonly` and `.../auth/calendar.events`, and either add
  test users (testing mode) or submit the app for verification (production).
  Without this, sign-in still works and the whole economy works — only the
  optional "pull my meetings" / "add coverage to my calendar" features need it.
- **Google sign-in provider**, if you didn't pass OAuth creds: one click at
  `console.firebase.google.com/project/<id>/authentication/providers`
  (auto-creates the OAuth client).
- **Per-team Gemini key** — each team's manager pastes their own key in the
  app's Settings tab (stored server-side, never in code).
- **Outbound email** — install the Trigger Email extension per
  [`functions/MAIL_SETUP.md`](../functions/MAIL_SETUP.md).

### Fully-scripted Google sign-in (optional)

If you want the script to enable Google sign-in with no console click, create
an OAuth 2.0 **Web** client id + secret first (APIs & Services → Credentials),
add `https://<project-id>.firebaseapp.com/__/auth/handler` to its authorized
redirect URIs, then pass:

```bash
  --google-client-id  <id>.apps.googleusercontent.com \
  --google-client-secret <secret>
```

The script POSTs it to the Identity Toolkit Admin API
(`defaultSupportedIdpConfigs?idpId=google.com`).

---

## After it finishes

```bash
firebase use <alias>              # target the new project for future commands
# commit the new config if this is now your source of truth:
git add app/firebase-config.js .firebaserc && git commit -m "point at <project-id>"
```

`app/firebase-config.js` is **not secret** — the Web API key and IDs are public
by design (security is Firestore Rules + App Check). It's fine to commit.

To re-deploy later without re-provisioning:

```bash
npm run build:shared && npm run build:functions
firebase deploy --only firestore,functions,hosting --project <project-id>
```
