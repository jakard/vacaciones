# Outbound email setup

Time Off queues every outbound email by writing a document to the
`mail/{auto-id}` collection in Firestore (Admin SDK only — clients can
never write here). To actually send those emails, install the official
Firebase **"Trigger Email from Firestore"** extension.

## One-time install

```bash
firebase ext:install firebase/firestore-send-email --project=vacaciones-dev-b3158
```

Answer the prompts as follows:

| Prompt                              | Value                                                    |
| ----------------------------------- | -------------------------------------------------------- |
| Collection name                     | `mail`                                                   |
| Default `from` address              | `Time Off <noreply@<your-domain-or-gmail>>`              |
| Default reply-to                    | leave blank                                              |
| SMTP connection URI                 | see "SMTP provider" below                                |
| Users collection                    | (skip)                                                   |
| Templates collection                | (skip — we render HTML inline)                           |
| TTL — auto-delete sent docs after   | `30 days`                                                |

## SMTP provider options

### Option A — Resend.com (recommended, free tier 100/day · 3000/month)

1. Sign up at https://resend.com
2. Add and verify a sending domain (or use the shared `onboarding@resend.dev` for testing).
3. Create an API key in the Resend dashboard.
4. SMTP URI for the extension:
   ```
   smtps://resend:<API_KEY>@smtp.resend.com:465
   ```

### Option B — SendGrid (free tier 100/day)

1. Create a sender identity / verify domain.
2. Generate an API key.
3. SMTP URI:
   ```
   smtps://apikey:<API_KEY>@smtp.sendgrid.net:465
   ```

### Option C — Gmail with App Password (dev / personal demos only)

1. Turn on 2FA on the Gmail account.
2. Generate an App Password at https://myaccount.google.com/apppasswords.
3. SMTP URI (note: `<APP_PASSWORD>` is the 16-character generated value):
   ```
   smtps://<your-gmail>%40gmail.com:<APP_PASSWORD>@smtp.gmail.com:465
   ```
4. Gmail caps at ~500 messages/day per sender — fine for a small crew, not for launch.

## What gets queued

Three sources currently write to `mail`:

| Source                            | Trigger                                                | Idempotency key                                              |
| --------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| `acceptCoverageRequest`           | A crewmate claims (some of) a bounty                   | `{requestId}_accepted_{covererUid}_{firstDayKey or 'all'}`   |
| `cancelBounty`                    | Requester or manager cancels                           | `{requestId}_cancelled_{covererUid}` per affected coverer    |
| `dailyDigest`  (scheduled, daily) | One per crewmate per crew per day with new activity    | `digest_{uid}_{teamId}_{YYYY-MM-DD}`                         |

Each call sets `idempotencyKey`, so retries / replays don't double-send.

## Disabling email per user

`/users/{uid}.digestEnabled = false` skips the daily digest for that user.
Transactional emails (accept, cancel) ignore this flag — those are
operational, not promotional. If you need a full "stop all email" toggle,
add `mailsDisabled: true` to the user doc and read it in `queueMail`
before writing.

## Local dev

The functions emulator never installs extensions. To smoke-test locally,
either:
- check the `mail/` collection in the Firestore emulator UI after running
  a flow (the document content is what would have been sent), or
- temporarily point `queueMail` at `console.log` instead of `db.collection('mail')`.

## Verifying production

After install:

```bash
firebase ext:list --project=vacaciones-dev-b3158
# Should show: firebase/firestore-send-email installed in v0.x.y
```

Trigger an `acceptCoverageRequest` call from the app, then check:

```bash
firebase firestore:read mail --limit 5 --project=vacaciones-dev-b3158
```

Each doc grows a `delivery` field with `state: SUCCESS` once sent. If
delivery fails, `delivery.error` carries the SMTP response — that's the
fastest way to diagnose auth / quota issues.
