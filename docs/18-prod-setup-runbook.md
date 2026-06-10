# 18 — Production project runbook

> Status 2026-06-10: the prod Firebase project **`timeoff-prod-rs`**
> exists (created via CLI) and `.firebaserc` carries `dev` / `prod`
> aliases. The dev project `vacaciones-dev-b3158` keeps serving the
> current live URL until cutover. The steps below are the remaining
> one-time manual setup — most need the Console because they involve
> billing or OAuth consent.

## One-time setup (in order)

1. **Billing** — attach a Blaze plan to `timeoff-prod-rs`
   (required for Cloud Functions):
   https://console.firebase.google.com/project/timeoff-prod-rs/usage/details

2. **Firestore database** — create the default database, location
   `nam5` (us-central, matches dev):
   ```bash
   firebase firestore:databases:create "(default)" --location nam5 --project prod
   ```

3. **Auth** — enable the Google sign-in provider:
   Console → Authentication → Sign-in method → Google → Enable.
   Add the prod hosting domain to Authorized domains (auto-added for
   `timeoff-prod-rs.web.app`).

4. **Rules + indexes** (no billing needed, do anytime after step 2):
   ```bash
   firebase deploy --only firestore --project prod
   ```

5. **Functions + hosting** (after step 1):
   ```bash
   npm run build && firebase deploy --project prod
   ```

6. **Frontend config** — `app/app.js` hardcodes the dev
   `firebaseConfig` (projectId, appId, authDomain). Before prod cutover,
   register a Web App in the prod project (Console → Project settings →
   Your apps) and parameterize the config (the Vite migration in
   docs/17 §4-A5 makes this an env-file switch; until then, a manual
   swap at deploy time).

7. **Email** — install the Trigger Email extension on prod with the
   production SMTP credentials (see `functions/MAIL_SETUP.md`).

8. **Gemini key** — re-enter per-crew API keys on prod (they live in
   Firestore `teams/{id}/private/settings`, which does not migrate
   automatically).

9. **CI** — set repo variable `ENABLE_DEPLOY=true` + secret
   `FIREBASE_TOKEN` (`firebase login:ci`) once the GitHub remote
   exists. Main-branch pushes then deploy dev automatically; prod
   deploys stay manual (`--project prod`) until we add a tagged-release
   job per docs/17 §4-A2.

## Daily use

```bash
firebase use dev    # default — safe to deploy freely
firebase use prod   # only for explicit prod releases
firebase deploy --only hosting --project dev   # or pass --project explicitly
```

Rule of thumb: **never run a bare `firebase deploy` while `prod` is the
active alias.** Pass `--project` explicitly in scripts and CI.

## Data migration (when the pilot crew moves)

One-off export/import via gcloud (requires billing on both projects):
```bash
gcloud firestore export gs://vacaciones-dev-b3158-export --project vacaciones-dev-b3158
gcloud firestore import gs://vacaciones-dev-b3158-export --project timeoff-prod-rs
```
Or, for a single small crew, a 50-line Admin-SDK copy script is simpler
and lets you rewrite the teamId. Decide at cutover.
