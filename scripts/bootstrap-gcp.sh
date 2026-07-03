#!/usr/bin/env bash
# =============================================================================
# Time Off — bootstrap a brand-new GCP / Firebase environment from zero.
#
# Stands up an entirely separate project (its own Firebase project, Web App
# config, Firestore, Auth, Cloud Functions, Hosting) and deploys the app to it.
# Idempotent: safe to re-run; each step checks whether it already exists.
#
# WHAT IT AUTOMATES
#   1. Create the GCP project (+ Firebase)
#   2. Link a billing account (required for Cloud Functions / Blaze)
#   3. Enable every API the app needs
#   4. Create the Firestore (native) database
#   5. Register a Web App and write app/firebase-config.js
#   6. Add a .firebaserc alias
#   7. (optional) Enable the Google sign-in provider via the Identity Toolkit
#      Admin API, if you pass --google-client-id / --google-client-secret
#   8. Build functions and deploy firestore rules+indexes, functions, hosting
#
# WHAT STAYS MANUAL (Google requires a console for these)
#   - OAuth consent screen: app name, support email, and — for the Google
#     Calendar integration — the calendar.readonly + calendar.events scopes,
#     plus either test users (testing mode) or app verification (production).
#   - If you don't pass OAuth creds, enabling Google sign-in is one console
#     click (Authentication → Sign-in method → Google → Enable) which
#     auto-creates the OAuth client.
#   - Per-team Gemini API key (entered in the app's Settings tab).
#   - Outbound email extension (see functions/MAIL_SETUP.md).
#
# PREREQUISITES (must be installed and authenticated)
#   gcloud   ->  gcloud auth login   (and gcloud auth application-default login
#                                      is NOT required; we use user creds)
#   firebase ->  firebase login
#   node, npm
#
# USAGE
#   scripts/bootstrap-gcp.sh \
#     --project-id timeoff-acme-prod \
#     --project-name "Time Off (Acme)" \
#     --billing-account 0X0X0X-0X0X0X-0X0X0X \
#     [--region us-central1] \
#     [--firestore-location nam5] \
#     [--alias prod-acme] \
#     [--google-client-id <id> --google-client-secret <secret>] \
#     [--yes]                # skip the confirmation prompt
#     [--skip-deploy]        # provision only, don't deploy
#
# Run it from the repo root (or anywhere — it cd's to the repo root itself).
# Recommended host: your machine (Git Bash on Windows works) or Google Cloud
# Shell, where gcloud + firebase are preinstalled.
# =============================================================================
set -euo pipefail

# ---- pretty logging ---------------------------------------------------------
if [ -t 1 ]; then B=$'\033[1m'; G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[31m'; C=$'\033[36m'; N=$'\033[0m'; else B=; G=; Y=; R=; C=; N=; fi
step() { printf '\n%s==>%s %s%s%s\n' "$C" "$N" "$B" "$1" "$N"; }
info() { printf '    %s\n' "$1"; }
ok()   { printf '    %s✓%s %s\n' "$G" "$N" "$1"; }
warn() { printf '    %s!%s %s\n' "$Y" "$N" "$1"; }
die()  { printf '\n%sError:%s %s\n' "$R" "$N" "$1" >&2; exit 1; }

# ---- repo root --------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# ---- defaults + arg parsing -------------------------------------------------
PROJECT_ID=""
PROJECT_NAME=""
BILLING_ACCOUNT=""
REGION="us-central1"
FIRESTORE_LOCATION="nam5"
ALIAS=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
ASSUME_YES=0
SKIP_DEPLOY=0

while [ $# -gt 0 ]; do
  case "$1" in
    --project-id)           PROJECT_ID="${2:?}"; shift 2 ;;
    --project-name)         PROJECT_NAME="${2:?}"; shift 2 ;;
    --billing-account)      BILLING_ACCOUNT="${2:?}"; shift 2 ;;
    --region)               REGION="${2:?}"; shift 2 ;;
    --firestore-location)   FIRESTORE_LOCATION="${2:?}"; shift 2 ;;
    --alias)                ALIAS="${2:?}"; shift 2 ;;
    --google-client-id)     GOOGLE_CLIENT_ID="${2:?}"; shift 2 ;;
    --google-client-secret) GOOGLE_CLIENT_SECRET="${2:?}"; shift 2 ;;
    --yes|-y)               ASSUME_YES=1; shift ;;
    --skip-deploy)          SKIP_DEPLOY=1; shift ;;
    -h|--help)              sed -n '2,60p' "$0"; exit 0 ;;
    *) die "Unknown argument: $1 (try --help)" ;;
  esac
done

[ -n "$PROJECT_ID" ] || die "--project-id is required (a globally-unique GCP project id, e.g. timeoff-acme-prod)"
[ -n "$PROJECT_NAME" ] || PROJECT_NAME="Time Off"
[ -n "$ALIAS" ] || ALIAS="$PROJECT_ID"
# Display names cannot contain characters like ()
CLEAN_NAME="$(printf '%s' "$PROJECT_NAME" | tr -d '()')"

# ---- preflight --------------------------------------------------------------
step "Preflight"
command -v gcloud   >/dev/null 2>&1 || die "gcloud not found. Install the Google Cloud SDK."
command -v firebase >/dev/null 2>&1 || die "firebase not found. Install with: npm i -g firebase-tools"
command -v node     >/dev/null 2>&1 || die "node not found."
command -v npm      >/dev/null 2>&1 || die "npm not found."

GACCT="$(gcloud config get-value account 2>/dev/null || true)"
[ -n "$GACCT" ] && [ "$GACCT" != "(unset)" ] || die "Not logged in to gcloud. Run: gcloud auth login"
ok "gcloud account: $GACCT"

firebase login:list >/dev/null 2>&1 || die "Not logged in to firebase. Run: firebase login"
ok "firebase CLI authenticated"
ok "target project id: $PROJECT_ID   (alias: $ALIAS)"

if [ "$ASSUME_YES" -ne 1 ]; then
  printf '\n%sThis will CREATE a new GCP project and deploy Time Off to it.%s\n' "$B" "$N"
  printf 'Project: %s (%s)\nBilling: %s\nRegion:  %s   Firestore: %s\n' \
    "$PROJECT_ID" "$CLEAN_NAME" "${BILLING_ACCOUNT:-<none — Functions will fail without Blaze>}" "$REGION" "$FIRESTORE_LOCATION"
  printf 'Continue? [y/N] '
  read -r reply
  case "$reply" in y|Y|yes|YES) ;; *) die "Aborted." ;; esac
fi

# =============================================================================
# 1. Create the GCP project
# =============================================================================
step "1/8  Create GCP project"
if gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  ok "project already exists — reusing"
else
  gcloud projects create "$PROJECT_ID" --name="$CLEAN_NAME" \
    || die "Project create failed. The id must be globally unique and 6–30 chars, lowercase/digits/hyphens."
  ok "created project $PROJECT_ID"
fi
gcloud config set project "$PROJECT_ID" >/dev/null 2>&1

# =============================================================================
# 2. Link billing (Blaze) — required for Cloud Functions
# =============================================================================
step "2/8  Billing"
CURRENT_BILLING="$(gcloud billing projects describe "$PROJECT_ID" --format='value(billingAccountName)' 2>/dev/null || true)"
if [ -n "$CURRENT_BILLING" ]; then
  ok "billing already linked ($CURRENT_BILLING)"
elif [ -n "$BILLING_ACCOUNT" ]; then
  gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT" \
    || die "Could not link billing account $BILLING_ACCOUNT. Check the id and that you have permission."
  ok "linked billing account $BILLING_ACCOUNT"
else
  warn "No --billing-account given. Cloud Functions REQUIRE the Blaze plan."
  warn "Available billing accounts:"
  gcloud billing accounts list --format='table(name,displayName,open)' 2>/dev/null || true
  warn "Re-run with --billing-account <ID>, or link it in the console before deploying."
fi

# =============================================================================
# 3. Add Firebase + enable APIs
# =============================================================================
step "3/8  Add Firebase and enable APIs"
if firebase projects:list 2>/dev/null | grep -q "$PROJECT_ID"; then
  ok "Firebase already enabled on project"
else
  firebase projects:addfirebase "$PROJECT_ID" || die "firebase projects:addfirebase failed"
  ok "added Firebase to project"
fi

info "enabling required APIs (this can take a minute)…"
gcloud services enable \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  eventarc.googleapis.com \
  pubsub.googleapis.com \
  cloudscheduler.googleapis.com \
  firestore.googleapis.com \
  firebase.googleapis.com \
  firebasehosting.googleapis.com \
  identitytoolkit.googleapis.com \
  serviceusage.googleapis.com \
  storage.googleapis.com \
  --project "$PROJECT_ID" \
  || die "Enabling APIs failed (billing may be required)."
ok "APIs enabled"
# Calendar + Gemini are optional features; enabling is harmless.
gcloud services enable calendar-json.googleapis.com generativelanguage.googleapis.com \
  --project "$PROJECT_ID" >/dev/null 2>&1 && ok "Calendar + Generative Language APIs enabled (optional features)" || warn "Calendar/Gemini APIs not enabled (optional — enable later if you use those features)"

# =============================================================================
# 4. Create the Firestore database
# =============================================================================
step "4/8  Firestore database"
if gcloud firestore databases describe --project "$PROJECT_ID" >/dev/null 2>&1; then
  ok "Firestore database already exists"
else
  gcloud firestore databases create --location="$FIRESTORE_LOCATION" --project "$PROJECT_ID" \
    || die "Firestore create failed. Pick a valid --firestore-location (e.g. nam5, eur3, us-central1)."
  ok "created Firestore database in $FIRESTORE_LOCATION"
fi

# =============================================================================
# 5. Register a Web App and capture its config
# =============================================================================
step "5/8  Web App + firebase-config.js"
APP_ID="$(firebase apps:list WEB --project "$PROJECT_ID" 2>/dev/null | awk -F'│' '/1:.*:web:/{gsub(/ /,"",$3); print $3; exit}')"
if [ -z "$APP_ID" ]; then
  # Some CLI versions format the table differently — fall back to grep.
  APP_ID="$(firebase apps:list WEB --project "$PROJECT_ID" 2>/dev/null | grep -oE '1:[0-9]+:web:[0-9a-f]+' | head -1 || true)"
fi
if [ -z "$APP_ID" ]; then
  info "creating Web App…"
  firebase apps:create WEB "Time Off" --project "$PROJECT_ID" >/dev/null \
    || die "firebase apps:create WEB failed"
  APP_ID="$(firebase apps:list WEB --project "$PROJECT_ID" 2>/dev/null | grep -oE '1:[0-9]+:web:[0-9a-f]+' | head -1 || true)"
fi
[ -n "$APP_ID" ] || die "Could not determine the Web App id."
ok "Web App id: $APP_ID"

SDK_RAW="$(firebase apps:sdkconfig WEB "$APP_ID" --project "$PROJECT_ID" 2>/dev/null)" \
  || die "firebase apps:sdkconfig failed"

# Data goes to node via env (quoted heredoc = no bash interpolation, no
# quoting hell). node regex-extracts the six fields — the sdkconfig output
# format varies across CLI versions, but every version emits "key": "value".
export SDK_RAW PROJECT_ID APP_ID
export OUT_FILE="$REPO_ROOT/app/firebase-config.js"
node <<'NODE'
const fs = require('fs');
const raw = process.env.SDK_RAW || '';
const pick = (k) => {
  const m = raw.match(new RegExp('"?' + k + '"?\\s*:\\s*"([^"]*)"'));
  return m ? m[1] : '';
};
const cfg = {
  projectId: pick('projectId') || process.env.PROJECT_ID,
  appId: pick('appId') || process.env.APP_ID,
  storageBucket: pick('storageBucket') || (process.env.PROJECT_ID + '.appspot.com'),
  apiKey: pick('apiKey'),
  authDomain: pick('authDomain') || (process.env.PROJECT_ID + '.firebaseapp.com'),
  messagingSenderId: pick('messagingSenderId'),
};
if (!cfg.apiKey) { console.error('Could not parse apiKey from sdkconfig output:\n' + raw); process.exit(1); }
const out =
  '// Firebase Web App configuration — GENERATED by scripts/bootstrap-gcp.sh.\n' +
  '// NOT secret (public by design; security is Firestore Rules + App Check).\n' +
  'export const firebaseConfig = ' + JSON.stringify(cfg, null, 2) + ';\n';
fs.writeFileSync(process.env.OUT_FILE, out);
console.log('wrote ' + process.env.OUT_FILE);
NODE
grep -q "apiKey" "$REPO_ROOT/app/firebase-config.js" || die "firebase-config.js was not written correctly."
ok "wrote app/firebase-config.js"

# =============================================================================
# 6. .firebaserc alias
# =============================================================================
step "6/8  .firebaserc alias"
export RC_FILE="$REPO_ROOT/.firebaserc" RC_ALIAS="$ALIAS" RC_PROJECT="$PROJECT_ID"
node <<'NODE'
const fs = require('fs');
const file = process.env.RC_FILE;
let data = { projects: {} };
try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
data.projects = data.projects || {};
data.projects[process.env.RC_ALIAS] = process.env.RC_PROJECT;
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
NODE
ok "added alias '$ALIAS' -> $PROJECT_ID in .firebaserc"

# =============================================================================
# 7. Google sign-in provider (optional automated path)
# =============================================================================
step "7/8  Google sign-in provider"
if [ -n "$GOOGLE_CLIENT_ID" ] && [ -n "$GOOGLE_CLIENT_SECRET" ]; then
  info "enabling Google provider via Identity Toolkit Admin API…"
  ACCESS_TOKEN="$(gcloud auth print-access-token)"
  BODY="$(printf '{"enabled":true,"clientId":"%s","clientSecret":"%s"}' "$GOOGLE_CLIENT_ID" "$GOOGLE_CLIENT_SECRET")"
  HTTP_CODE="$(curl -sS -o /tmp/idp_resp.json -w '%{http_code}' \
    -X POST "https://identitytoolkit.googleapis.com/admin/v2/projects/$PROJECT_ID/defaultSupportedIdpConfigs?idpId=google.com" \
    -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
    -d "$BODY" || echo 000)"
  if [ "$HTTP_CODE" = "200" ]; then
    ok "Google sign-in enabled with the provided OAuth client"
  elif grep -q "ALREADY_EXISTS\|already exists" /tmp/idp_resp.json 2>/dev/null; then
    ok "Google provider already configured"
  else
    warn "Automated enable returned HTTP $HTTP_CODE. Response:"; cat /tmp/idp_resp.json 2>/dev/null || true
    warn "Enable it manually: Console → Authentication → Sign-in method → Google."
  fi
else
  warn "No --google-client-id / --google-client-secret provided."
  warn "Enable Google sign-in (one click, auto-creates the OAuth client):"
  warn "  https://console.firebase.google.com/project/$PROJECT_ID/authentication/providers"
  warn "For the Calendar integration you must ALSO add these scopes to the OAuth"
  warn "consent screen and add test users (or verify the app):"
  warn "  .../auth/calendar.readonly   .../auth/calendar.events"
fi

# =============================================================================
# 8. Build + deploy
# =============================================================================
if [ "$SKIP_DEPLOY" -eq 1 ]; then
  step "8/8  Deploy (skipped: --skip-deploy)"
  warn "Provisioning done. To deploy later:"
  warn "  npm run build:shared && npm run build:functions"
  warn "  firebase deploy --only firestore,functions,hosting --project $PROJECT_ID"
else
  step "8/8  Build and deploy"
  info "building shared + functions…"
  ( npm run build:shared >/dev/null 2>&1 && npm run build:functions >/dev/null 2>&1 ) \
    || die "Build failed. Run 'npm ci' at the repo root, then re-run with --skip-deploy... --alias to just deploy."
  ok "build clean"
  info "deploying firestore rules+indexes, functions, hosting… (first functions deploy is slow)"
  firebase deploy --only firestore,functions,hosting --project "$PROJECT_ID" \
    || die "Deploy failed (see output above). Common cause: billing not on Blaze."
  ok "deployed"
fi

# =============================================================================
# Summary
# =============================================================================
step "Done"
HOSTING_URL="https://${PROJECT_ID}.web.app"
printf '%sEnvironment %s is live.%s\n' "$B" "$PROJECT_ID" "$N"
printf '  Hosting:  %s\n' "$HOSTING_URL"
printf '  Console:  https://console.firebase.google.com/project/%s/overview\n' "$PROJECT_ID"
printf '  Alias:    firebase use %s\n\n' "$ALIAS"
printf '%sRemaining manual steps%s\n' "$B" "$N"
printf '  1. Google sign-in: enable it in the Auth console if not already (link above).\n'
printf '  2. Calendar (optional): add calendar.readonly + calendar.events scopes to the\n'
printf '     OAuth consent screen; add test users or submit for verification.\n'
printf '  3. Gemini briefings (optional): each team pastes its own key in Settings.\n'
printf '  4. Email (optional): install the Trigger Email extension — functions/MAIL_SETUP.md.\n'
printf '  5. Commit app/firebase-config.js + .firebaserc if this is the new source of truth.\n\n'
