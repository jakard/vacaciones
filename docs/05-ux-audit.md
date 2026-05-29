# Vacaciones — UX/Usability Audit and Redesign

Source: swarm agent UX audit, 2026-05-29. Operationalises the top friction points found on the vanilla single-page build at `app/`.

---

## Framing

Vacaciones is a calm, low-frequency tool: a typical TAM touches it 2–6 times a year. The cardinal sins in this category are **forgetting users between visits** and **failing to answer "what now?" in two seconds**. Audit below is biased toward that reality.

---

## Top 10 friction points

1. **Team page is a wall of three sections with no decided hierarchy.** Returning requester wants to post, coverer wants to scan, curious user wants balance — and the page makes everyone scroll. Cost preview is below the fold on a 13" laptop.
   *Fix:* sticky action bar at top with `[ Post a request ]` + balance pill + `Browse requests (N open)` chip. Lead with **Open requests**, then a compact wallet strip, then the post form behind a button.
2. **No reason to come back.** No notification surface, no "what changed" signal. A coverer who never opens earns nothing.
   *Fix:* (a) browser push / email digest opt-in per team, (b) "new since last visit" pill, (c) weekly summary email.
3. **Wallet shows balances, doesn't tell a story.** Lifetime totals; the actually-meaningful 90-day-earned number is invisible.
   *Fix:* replace Total with **"Earned (last 90d)"** + trend sparkline. Stipend shows expiry countdown. Add one rank line: *"You're #3 of 12 this quarter."*
4. **Coverer can't tell what they're signing up for.** Date window, SLA, coin price — no who, no portfolio scope, no hot-items context.
   *Fix:* expand each row to the full Coverage Briefing from doc 03. Require an explicit confirmation step on Accept.
5. **Team ID is the whole invite mechanism.** Opaque string, no copy button, no link, no QR.
   *Fix:* `Share invite` copies `#/join/{teamId}` and toasts "Copied." Join form accepts ID *or* link.
6. **Post form is form-shaped, not flow-shaped.** Two dates + dropdowns + free-text timezone + a small cost chip.
   *Fix:* 3-step wizard — pick dates (weekends visually shaded 2x), set expectations (visual radio cards + chip presets for SLA), confirm (large cost panel: `25 coins · balance after: 8` + CTA).
7. **Sign-out is the most prominent header control.** Crowds out room for nav.
   *Fix:* collapse user info into an avatar dropdown. Reclaim space for real nav: `Teams · Leaderboard · Activity`.
8. **SLA / reachability microcopy is jargon-y and pre-filled.** New users have no idea if defaults are reasonable.
   *Fix:* labeled presets ("Light", "Standard", "Heavy on-call"). Descriptive reachability cards. Safer defaults.
9. **No leaderboard surface anywhere.** The economy's defining feature is invisible.
   *Fix:* leaderboard card on team page (top 3 + user's rank). Dedicated `/leaderboard` page. Quarterly badge as a real visual artifact.
10. **Toasts are the entire feedback system.** Raw `err.message` auto-dismissed in 3–5s.
    *Fix:* distinguish inline form errors, action toasts with undo, and persistent page-level banners. Translate Firestore error codes.

---

## Proposed IA

Current: Login → Home (teams) → Team (everything).

Proposed:

- **`/`** — header nav + your teams + cross-team activity feed.
- **`/team/{id}`** — overview: open requests (lead), team leaderboard preview, compact wallet, `Post bounty` CTA.
- **`/team/{id}/request/new`** — wizard.
- **`/team/{id}/request/{rid}`** — read-only briefing detail (where doc 03's data model lives).
- **`/team/{id}/wallet`** — full ledger with filters and CSV export.
- **`/team/{id}/members`** — roster with rank, 90d earned, badges, share invite. Manager-only controls live here.
- **`/team/{id}/leaderboard`** — full 90d board + quarterly winners + secondary "Coins given" board.
- **`/help`** — economy rules explained.

Missing entirely today: notification center (bell + list), profile page, help/about page.

---

## Critical micro-interactions

1. **Coin shower on earning.** Number tweens, soft pulse, floating `+5` chip.
2. **Skeleton screens** for teams list, ledger, requests.
3. **Cost preview pulses on date change.**
4. **Auto-focus + Enter-to-submit** on Create/Join inputs.
5. **Click-to-copy** on team ID with "Copied!" flash.
6. **Hover preview** on requester avatar in request rows.
7. **Optimistic UI for accept** (disable + spinner immediately).
8. **One-time confetti** on first post and first cover.
9. **Hover-to-persist** on toasts.
10. **Keyboard shortcuts** — `n` for new request, `g h` for home, `?` for shortcut sheet.

---

## Loading / empty / error system

- **Loading**: skeleton blocks matching final row geometry. Never centered "Loading…".
- **Empty (zero teams)**: explainer + primary `Create a team` + secondary `Paste invite link`.
- **Empty (zero requests)**: "No one's asking — when a teammate posts, you'll see it here and earn coins for covering. [Notify me]".
- **Empty (zero ledger)**: hide the section entirely; one-line "Activity will appear here as you post, cover, or earn."
- **Inline field error**: red text under field, field bordered red.
- **Inline action error**: in-form red banner with actionable text ("Not enough coins — you have 8, this costs 25. [Earn by covering]").
- **Page-level error**: top banner, persistent, friendly translation + Retry. Log raw `err.message` to console.
- **Offline**: top banner via `navigator.onLine`. Firestore handles sync.

---

## 30-second rehearsal

**First-time user (joining via invite link)** wants to be in a team and understand coins in 30s. Currently blocked by: no invite-link flow, no welcome modal, no inline briefing.

**Returning requester** wants to post and forget in 30s. Currently blocked by: form is below two sections, no `n` shortcut, defaults not remembered, no "balance after" preview.

**Returning coverer** wants to find a coverable request and accept in 30s. Currently blocked by: no notification surface, no briefing on rows, no daily-release visibility.

---

## Top 5 priorities — rank-ordered

1. **Notification surface + outbound digest.** Bell icon + browser push + weekly email summarizing open requests. Without this the marketplace dies of forgotten-ness.
2. **Restructure the Team page around the user's primary task.** Sticky `+ Post request` + balance pill + open-request chip at top. Lead with Open requests. Demote the form behind a button.
3. **Expand the briefing inline + add a confirmation step on Cover.** Each row expands to show requester identity, portfolio scope, hot items, explicit "what you're agreeing to" before escrow.
4. **Make the wallet meaningful, not just a balance.** Replace Total with "Earned (last 90d)" + sparkline; stipend expiration countdown; user rank one line below. Add `/wallet` page with full ledger filters.
5. **Invite links + onboarding modal.** Replace team-ID-paste with copyable invite links. Welcome modal explains coins/stipend/expiry on first join. Persist `seenWelcome` flag.

Everything else in the audit is real but secondary. Ship those five and the app stops being a competent prototype and starts being a product.
