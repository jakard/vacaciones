# Time Off — Big-tech UX audit through a Google internal tooling lens

**Auditor lens:** I have shipped internal Google tools — the ones that get screenshotted into team channels with "wait, this exists?" and the ones that get screenshotted with "lol, ship it back." Buganizer, Critique, Moma, OOO. This is the standard I'm holding Time Off to: would a senior TAM, who has 17 tabs open in Chrome and 9 unread Buganizer comments, choose this over the existing OOO-in-Calendar + a shared sheet?

**Headline:** Time Off has a clever economy and a launchable Phase 1 — but four things keep it from being something a TAM screenshots into `#tam-na` with "everyone use this": (1) it is keyboard-poor in a way Buganizer never was, (2) the Bounty Board is too low-density for power use, (3) it has zero presence in Slack/email — coverage *lives* in those channels and Time Off is a destination instead of a notification, and (4) the pirate frame is loudest exactly where it should be quietest (form labels, system errors, every CTA). Fix those four and you go from "cute side project" to "actually adopted."

This audit assumes the prior visual / HIG / industrial-design / copy / a11y work has landed. I am not re-grading those. I am asking: **does this clear the bar a Google L5 PM would set for an internal-tools launch review?**

---

## 0. The unfair test: imagine the demo

A TAM lead opens Time Off in front of their skip-level and says: "this is how my team rotates coverage now." For five minutes, every tap, every render, every word has to either advance the pitch or stay invisible. Hold each finding below against that mental tape.

The tape today snags in four predictable places:

1. **Login → first crew → first bounty posted** — minimum nine clicks, mandatory six-scene Stan onboarding, a date picker, a day grid, four label groups, an SLA free-text. A TAM under demo pressure dies somewhere around scene three of Stan. The "1-click I'll be out next week" path doesn't exist.
2. **Skip-level scrolls the Bounty Board** — they see four cards in their viewport. Buganizer shows 30. The skip-level asks "what does this look like with 50?" and there is no answer.
3. **Skip-level asks "how does my team find out about a bounty?"** — the answer is "they open the app and look at the bell." That is a 2014 answer. The Slack-native, Chat-native, email-native, Calendar-native answers all need to exist by demo two.
4. **Skip-level asks about an EU report leaving the company** — the answer is "we ... can't delete them, but their wallet is sealed." That is not an answer. It is a finding waiting to be filed.

Everything below is a fix for one of those four.

---

## 1. Findings

### Finding 1 — There is no command palette, no shortcuts, no `?` cheat-sheet. For a TAM tool this is the cardinal sin. (P1 / M)

**Where:** `app/app.js:3759-3782` — the entire keyboard event handler.

The keyboard surface today is: Enter in the team-name input, Enter in the join input, Escape closes the bell, Enter/Space on focused bounty cards and day-cards. That is *it*. There is no `Cmd-K` palette, no `/` to focus search, no `g b` to go to Bounty Board, no `n` to post new, no `j/k` to move down the bounty list, no `?` to show keyboard help. Buganizer has had `j/k` since 2009. Critique has `Cmd-J` for jump-to-file. Even Gmail — which is for casual users — has `c` to compose.

This matters because every TAM I have ever shadowed has Chrome's address bar muscle memory bound to *what they have to type next.* When they evaluate a tool, they reflexively press `?` within 20 seconds of landing on the home page. Time Off responds to that keystroke by typing `?` into the bounty search input — if they remembered to focus it first. Otherwise it does nothing.

**Concrete fix (one PR):**
- `?` opens a modal listing every shortcut.
- `Cmd/Ctrl-K` opens a command palette over the modal layer with fuzzy-search across: every team you're in, every open bounty's requester+scope, every tab inside the current team, every settings action a manager can do. The palette is the answer to "I don't remember what menu this is under."
- `n` from anywhere in a team view → Post Bounty. `g b / g c / g w / g m / g s` for Bounty board / Chest / Wall of Fame / Members / Settings.
- `j/k` on Bounty Board to move focus across cards (you already have `tabindex="0"` and Enter/Space wired — just add the arrow handlers).
- `/` focuses `#bounty-search`.
- `Esc` already closes the bell — extend to close the topmost modal (the focus-trap handler at `app.js:1978` only triggers when the modal is already topmost; works fine).

Effort: a single self-contained file, ~250 lines. The payoff is everyone who tests this on day one feels "this is a serious tool." Today they feel "this is a webform."

### Finding 2 — Bounty card density is wrong by a factor of three for power use. (P1 / M)

**Where:** `app/styles.css:919-1020` — the `.bounty` grid is six rows tall × auto width. Each card is roughly 180px high at 1440px viewport.

Run the math. A 1080p laptop shows ~5 bounty cards above the fold. A 27" desktop maxes around 8 with sidebar. Buganizer's default issue list shows 30. Sheets' OOO tracker, the thing Time Off is replacing, fits 25 rows. A power-using TAM with three reports each posting bounties for spring break is going to be scrolling.

Today's card has:
1. status badge row
2. requester row
3. window row
4. doubloons column (full height on right)
5. scope row
6. chips row
7. SLA row
8. action row

That is decorator-heavy. The scope, SLA, kinds chips, and reachability chips are all *clickthrough* data — they belong in the detail modal, not the card. The grid even has a second redefinition at `app/styles.css:1216-1228` (already flagged in 13-industrial-design-audit.md, finding 2). Fix that and shrink concurrently.

**Concrete fix:** introduce a "compact" view toggle next to the filters (and remember the choice in localStorage). Compact = one row, table-shaped:

```
[status] [requester avatar+name]  [Apr 22 → Apr 26 · 5d]  [25🪙]  [Take voyage]
```

That fits ~22 per fold. Keep today's card style as "comfortable" and default new accounts to it. Power users hit `Cmd-K → toggle density` or a tiny ⊟/⊞ icon.

The detail modal already exists and is excellent — every chip, scope, SLA, briefing is two keystrokes away. So nothing of value is lost by sliming the cards.

### Finding 3 — Zero outbound notifications. Bell only. This is 2014 design. (P0 / L)

**Where:** `app/app.js:656-697` (computeNotifications) and the absence of any function in `functions/src/` named `send*Email`, `send*Slack`, or `notify*`.

Today, the *only* way a TAM learns "someone took my bounty," "your coverer dropped out," "you owe a thank-you scroll" is by **opening Time Off and clicking the bell.** That is the single biggest reason this product will die in production. Coverage decisions happen in Slack, in mail threads, in calendar invites — not in a destination web app. Buganizer wins because comments hit your inbox. OOO wins because it shows in everyone's Calendar.

Time Off needs three notification channels by GA — pick any one and ship; do all three over six months:

1. **Email (lowest effort, ship in 1 day with Firebase Send Mail Trigger):**
   - On `coverageRequest.created` to teammates: "Pat posted a 25-doubloon bounty for Apr 22-26. [Take voyage]"
   - On `coverageRequest.accepted` to requester: "Sam took your bounty. They've added it to their Calendar. [View bounty]"
   - On `coverageRequest.completed` to requester: prompt to send a thank-you scroll, with link.
   - Daily digest 8am local: "3 open bounties in Argo crew · 12 doubloons available this week."

2. **Slack / Chat unfurl (medium):** an Apps Script or unfurl bot that, when someone pastes `https://time-off/#/team/X/bounty/Y` in Slack, renders the same info the bounty detail modal does. Lets coverage conversations happen *in Slack* and link in for the action.

3. **Calendar push (high):** when a bounty is posted, automatically post a tentative all-day event "TAM Coverage Bounty: $name" on each crew member's secondary calendar (visible only to them). When taken, it stays on the coverer's calendar and gets a "Original requester: $name" body. Today you let coverers `+ add to calendar` manually (`app.js:1314+`) — invert that so the default is "yes, push to my calendar."

This single fix is the difference between a tool people remember and a tool people open once a quarter.

### Finding 4 — "Time-to-first-bounty" is north of 4 minutes. Should be under 30 seconds for the common case. (P1 / M)

**Where:** `app.js:3093-3179` — the Post Bounty form has 11 fields: dates × 2, timezone, coverage kinds (6 checkboxes), reachability (4 checkboxes), days-to-cover grid, coverage mode (2 radios), scope, meetings selector, SLA, emergency definition. Plus the Stan welcome modal forces six clicks before the user can do anything (`app.js:85-92`).

A senior TAM saying "I'm out next Mon-Fri, find someone" doesn't want to define reachability semantics. They want to ship the request.

**Concrete fix — two-tier form:**

Top of Post Bounty:
```
Going on shore leave?
[Tomorrow] [Next Mon-Fri] [Next 2 weeks] [Pick custom dates]
```

The first three options post a bounty in 2 clicks with sensible defaults: weekdays only, "email only — emergencies," all coverage kinds checked, no specific meetings, SLA = team default from Settings. That is 80% of the demand. A `Customize` link below expands the full form for the cases that need it.

While we're here: the Stan onboarding (`app.js:85-92`) is six scenes long and *blocking*. A TAM has been doing internal demos for 8 years; they do not need six dialog boxes to understand a 5-doubloon-per-day economy. Make it three scenes (Stan, doubloons, "first bounty"), make Skip the primary button in scene 1, and never show it again unless they hit a `/help` link. The prior copy audit (doc 11, section 4) hinted at this — go further and *cut it in half.*

### Finding 5 — The pirate theme contaminates the action surface. Charm in the chrome, business in the buttons. (P1 / S)

**Where:** Everywhere CTAs and system text live. Scattered examples:
- `app.js:1051` — `Crew "${name}" formed. 125 doubloons in your chest.` → fine in a toast, but "in your chest" is fluff.
- `app.js:1066` — `Signed aboard! 125 doubloons in your chest.`
- `app.js:1103` — `Bounty posted for ${...} doubloons. Anchors aweigh!` 
- `app.js:1129` — `Voyage accepted in full. ${} doubloons in escrow.` → "Voyage accepted" instead of "Coverage accepted."
- `app.js:1407` — `🪶 Thank-you scroll sent. The tavern echoes.` 
- `app.js:1734` — `${displayName} is now a ${role === 'manager' ? 'captain' : 'crewmate'}.`
- `app.js:2694, 2702` — `Hoist` / `Aye` as primary button labels for Create Team / Join Team.

A TAM going through this looks at a button labeled `Hoist` and thinks: "I don't know what this does in 0.2 seconds, therefore this tool wastes my time." `Aye` is worse — half the room reads it as "ah-yee" and gets confused.

**Rule:** *Action verbs and system messages use professional English. Decorative copy (page titles, empty states, the Tavern section header, achievement names) can keep the pirate voice.* This is the same line Stripe drew between marketing voice and product voice.

Specific swaps:
- `Hoist` → `Create crew`
- `Aye` → `Join`
- `Take voyage` → `Cover this bounty` (or just `Cover`) — "take voyage" reads as "go on vacation," the *opposite* of the action
- `Anchors aweigh!` (post-bounty toast) → cut, just say `Bounty posted. 25 doubloons in escrow.`
- `The tavern echoes.` → cut
- `Signed aboard!` → `Joined "{crew name}". 125 doubloons added.`
- `Loading the harbor…` → `Loading…` (charm goes from chrome to the doubloon SVG, which is plenty)
- `is now a captain` → `is now a manager` (the role badge can still say CAPTAIN in the UI — but the toast confirming the action needs to be unambiguous)

Doc 11 already hinted at this. My added stake: in a Google internal tool, the test is not "is this charming?" — it's "would a senior person feel like this is wasting their time?" Right now the toasts feel like the app is winking at them. They don't have time for winking.

### Finding 6 — There is no audit-grade reversal for manager actions. Force-complete is a one-way door. (P1 / S)

**Where:** `functions/src/http/forceCompleteBounty.ts` (entirety) and `app.js:1757-1768`. Also `removeMember.ts`, `grantBonusDoubloons.ts`.

When a manager `force-completes` a bounty, the doubloons get released, the bounty status flips to completed, and... that's it. There is no "Undo within 60 seconds" toast. There is no "this released $N to $coverer over $days — reverse?" confirmation modal showing what's about to happen. The audit log records *that* it happened (`app.js:3404-3406`) but not in a way you can act on — you can't undo from the log.

Same pattern for `grantBonusDoubloons` (you can grant 500 doubloons by accident — no recall), `removeMember` (booting a teammate is irreversible).

A Google internal tool with manager actions over real currency would never ship without:
1. **Per-action preview before execution:** "This will release 25 doubloons to Sam over 5 days. Continue?" — the prompt today (`app.js:3653`) is generic.
2. **30-second toast-level undo** for grantBonus, forceComplete, removeMember. Inverse function + scheduled timer; if user clicks Undo, run a counter-action with `reason: "Undo within 30s"`.
3. **A "Reversed" entry in the audit log** when undo fires.

Bear in mind that *real money is not at stake.* But the perception is — managers who fat-finger this in front of their team are not coming back. And every doubloon eventually represents a day off; the social weight is real.

### Finding 7 — Wallet/ledger has no concept of "shared view" — so managers cannot see what their team can spend. (P1 / M)

**Where:** Wallet doc is at `teams/{teamId}/wallets/{uid}`, queried in `app.js:965-969` with strict per-uid scope. The members tab (`app.js:3260-3302`) shows lifetime earned / voyages / 90d earned but not **balance**.

A manager planning Q3 coverage needs to know: "does my team have the doubloons to cover the leave they want to take?" Today they have to walk over to each report and ask. That kills the whole pitch about replacing the spreadsheet — the spreadsheet has the numbers in one view.

**Concrete fix:** add a manager-only column on the Members tab (gate in `getCrewMembers.ts`) showing each member's `earnedBalance + stipendBalance` and their last 30-day spend. Add a small panel at the top showing **crew totals**: `Crew chest: 1,247 doubloons · 312 spent last 30d · 4 unfunded requests`. That panel is the screenshot that ends up in `#tam-leads` channels.

Crucially: this is *aggregate visibility*, not third-party spend. A manager seeing their report's *balance* is appropriate org behavior; a manager seeing their report's *full ledger* is overreach. Keep ledger queries per-uid as today.

### Finding 8 — Leaderboard hard-capped at top 10, no "where am I" jump, no "see all." (P1 / S)

**Where:** `functions/src/http/getLeaderboard.ts:97` — `entries.slice(0, 10)`. Then `app.js:3197-3258` renders top 3 as podium and `rest` as a list (so 7 visible).

For a crew of 12 the bottom 5 never appear. For a crew of 30 (which absolutely happens — TAMs cross-functional pods are large) the bottom 20 don't appear. The Wall of Fame is then **structurally invisible** to most of the team. The *whole point* of the leaderboard, per doc 02 section 5, is that visibility creates the recognition incentive. Today only the top earners get visibility — which is exactly the perverse incentive that punishes new TAMs and creates hoarding behavior.

**Concrete fixes (all small):**
1. Bump backend limit to 50, or remove the cap entirely (you've already validated `windowDays: z.number().int().min(1).max(365)` — same pattern with a `limit` param defaulting to 100).
2. Front-end: always render *the current user's row* even if they're #43. Pin it at the bottom of the list with a separator: `You are #43 with 6 doubloons in this window.`
3. Replace the `top3` podium for tiny crews (length < 3). Right now a 1-person crew sees a single podium tile floating, which looks broken (`app.js:3200-3203`).
4. Add a `windowDays` selector — 30 / 90 / 365 / All time. Some TAM org cultures will prefer monthly, some quarterly. Defaulting to 90 is fine; not letting people change it is wrong.

### Finding 9 — Coverage cost has a quiet bug at the day-boundary that will eat doubloons silently. (P0 / S)

**Where:** `app.js:362-375` (`computeCoverageCost`) and `app.js:386-407` (`computeCostFromKeys`).

`computeCoverageCost` walks UTC-day-by-day from `windowStart` to `windowEnd` inclusive. `formatDateKey` (`app.js:380-382`) also serializes UTC dates. But the post-form sends `windowStartIso: start.toISOString()` where `start = parseLocalDate(f.startDate)` (`app.js:355-360`) — which constructs a date *at UTC midnight from a local-date input.* That works.

The bug: the **timezone** field is free-text user input (`app.js:3108`), defaulting to `Intl.DateTimeFormat().resolvedOptions().timeZone`. But the cost calculation never uses the timezone — it always treats days as UTC days. So a TAM in `Asia/Tokyo` who says "I'm out Apr 22-26 my local time" gets a bounty whose `windowStart` is Apr 21 23:00 UTC and whose UTC-day calculation either correctly returns 5 days or slips a day depending on Tokyo offset that week. Worse: when the daily release cron (`scheduled/dailyCoverageRelease.ts`) fires at the cloud function's UTC midnight, it credits doubloons in a window that doesn't line up with the requester's local week.

I haven't read the cron yet — but the front-end clearly assumes UTC and the bounty doc has both an ISO `windowStart` *and* a separate `timezone` string. That mismatch is a P0 because: (a) people will notice when the cron pays one day early or late, (b) the math of "11 stipend per month, 5 coverage per day" depends on day boundaries being unambiguous.

**Concrete fix:**
- Either: pick a canonical timezone *per crew* (settings field) and quantize all bounty windows to it. Cron schedules per crew at that TZ's midnight.
- Or: store `windowStartKey` and `windowEndKey` as `YYYY-MM-DD` *in the requester's timezone* alongside ISO, and have the cron compare those keys against the requester's TZ "today" rather than UTC.
- Or, at minimum: hide the timezone field from the post form. It is currently editable user input that nothing reads.

This is a P0 because it's a silent correctness bug in the *core economy*. Doc 02 spends 9KB explaining the design; the implementation undermines it on day-boundary edges.

### Finding 10 — There is no team-delete, no member-delete, no data export. GDPR/DSAR story is "the user complains to support." (P0 / L)

**Where:** `functions/src/http/` — no `deleteTeam.ts`, no `deleteUser.ts`, no `exportMyData.ts`. The `removeMember` function exists but the comment in the modal (`app.js:3644`) says "their wallet for this crew is sealed" — i.e., the data persists indefinitely.

For an EU-based TAM (and there are *many*), the GDPR right-to-erasure is law, not optional. For any Google-internal launch, the data-protection review will ask three questions:
1. How does a user delete their account?
2. How does an org delete a team?
3. How does a user export their data?

Time Off's answer to all three today is "they can't from the UI." If the answer remains "file a bug" you will not get past launch review.

**Concrete fix:**
1. Add a self-service `Delete my account` action under the avatar menu. It: leaves every team they're in (preserving ledger entries with the displayName replaced by "Former crewmate"), deletes the `/users/{uid}` doc, and nukes their Firebase Auth row via the `users.delete()` admin SDK call. Soft-delete with a 30-day grace if you want.
2. Add a manager-only `Disband crew` action in Settings. It: cancels all open bounties (refunding escrow), tombstones the crew doc, archives the ledger collection to an export bucket on the way out.
3. Add `Export my data (JSON)` on the Treasure Chest tab. Today you have CSV ledger export (`app.js:1513`); extend to a JSON dump of `users/{uid}` + every team they were in + every bounty they posted or covered.

This finding alone would be the difference between "Time Off ships to GA" and "Time Off ships behind a 'beta' label for 14 months while legal works through it."

### Finding 11 — The team-ID is the share token and the database key, simultaneously. There is no rotation, no expiry, no membership cap. (P1 / S)

**Where:** `app.js:1396-1402` — `copyInviteLink` returns `/#/join/{teamId}`. Then `joinTeam` (`app.js:1060-1072`) accepts any UID with the right team-ID string into the crew, conferring a 125-doubloon onboarding grant.

The team-ID is a Firestore doc ID, displayed everywhere in the UI (`app.js:2680`, `app.js:2746`). Anyone who screenshots that ID — into a bug, into a Slack channel, into a presentation — has shared a permanent invite link. There is no revoke. There is no max-members cap. There is no "approve join requests" gate. Combined with the 125-doubloon welcome grant, the obvious abuse case is: an insider scrapes team-IDs from any screen the manager shares, joins from a throwaway, mints 125 doubloons. Doubloons are play money, but the *audit trail* a manager sees ("Who is John Doe? Why are they in my crew?") is a real trust hit.

**Concrete fix:**
1. Separate the invite token from the team-ID. Generate a `crew_invite_token` (rotating, expiring, capped-uses) stored under `teams/{tid}/private/inviteTokens`. The share-link uses the token. The team-ID stays internal.
2. Settings → `Invites` panel: list of active tokens, "regenerate" / "revoke," cap-uses / expiry.
3. Optional approval gate: a `pendingMembers` collection where joins land until manager accepts. Default off; turn on per crew via a setting.

For Google-internal use the simpler bar is enforcing **@google.com email domain** match in the Cloud Function — but for an open-source pitch, the token rotation is the right answer.

### Finding 12 — Bell notifications have no read state, no archive, no link-out. (P1 / S)

**Where:** `app.js:656-697` (computeNotifications), `app.js:2320-2341` (renderBellDropdown), `app.js:241` (`notifLastSeen` is a single timestamp).

Today the bell:
- Counts unread (`app.js:2293`) using a single "last opened" timestamp.
- Shows up to 20 items synthesized from the ledger and bounty list.
- Does not let you click an item to deep-link to the relevant bounty.
- Does not let you dismiss individual items.
- Does not persist beyond the 40-item live ledger window — anything older than that, you cannot reach.

Compare to Buganizer's notification panel: each row is a link to the issue, has its own read/unread state, and can be archived. The `notifLastSeen` model is what Twitter had in 2012.

**Concrete fix:**
- Each `n` entry needs an optional `bountyId` field. Rendering wraps the row in `<a href="#/team/{tid}?bounty={bid}">` and `showBountyDetail` runs on load.
- Per-notification dismiss button (X on hover). State persists in localStorage keyed by entry ID.
- Notification source-of-truth becomes Firestore `/users/{uid}/notifications` with read/dismissed flags. Subscribe in `subscribeUserDoc`-equivalent.

Bonus: pair with Finding 3 (email notifications). The bell + email + Slack are three rendering channels off the same backend notification stream.

### Finding 13 — The Members tab does not surface "currently out / coming back / available to cover." That's the only question anyone has. (P1 / M)

**Where:** `app.js:3260-3302` — renders avatar, role, voyages, 90d-earned. Misses the live status.

A TAM lead opening the Members tab at 9am Monday wants to answer: "who's out this week, who's back, who's covering, who has open bounties?" That data exists across `state.bounties`; nothing surfaces it on Members.

**Concrete fix:** add a status pill per member, derived from bounties: `Out Apr 22-26` (their own open or active bounty in the future / current), `Covering Sam's voyage` (they're a coverer on an active bounty), `Available` (default). Also: sort by status — out-today members first, then covering, then idle.

This becomes the *one screen* a TAM lead screenshots into `#team-news` every Monday. That alone justifies the build cost.

### Finding 14 — The Stan welcome shows once, then never re-explains. There is no "what changed in v1.2" surface. (P2 / S)

**Where:** `app.js:884-887` — `seenStan = localStorage.getItem('vacaciones.seenStan')`. Once true, never re-shown unless localStorage is cleared.

A power user who has used Time Off for six months never sees onboarding content again. That's fine. But: when the team adds a new feature (audit log, force-complete, AI briefing), there's no surface to tell users. Internal Google tools solve this with a small "What's new" badge — a yellow dot on the avatar, clicking shows a 3-line changelog modal, marked-seen after.

**Concrete fix:** `state.userDoc.lastSeenVersion` + a const `CURRENT_VERSION = 12` in the client. When mismatch, show a small What's new modal once with 2-3 bulleted recent changes. Cheap, low risk, signals product velocity.

### Finding 15 — `getCrewMembers` does an aggregate query per page-load with no caching, no pagination, and surfaces *every member every time.* Will not scale to 50-member crews. (P2 / M)

**Where:** `functions/src/http/getCrewMembers.ts` (not read in full, but called at `app.js:3271`+ on every Members tab visit; the loop `app.js:3275-3299` renders all of them un-paginated).

50 members is realistic for a TAM org pod. At that size:
- Each load fetches 50 user docs server-side, 50 wallet docs, 50 lifetime-earned aggregates.
- Each render does 50 avatar SVG embeds (the inline `m1`...`f5` SVG blobs in `app.js:776-797` are roughly 1KB each).
- No infinite scroll, no search.

Today's UX is fine for the demo crew of 4. The first TAM pod with 30 members will hit a noticeable hitch (200-400ms). The first pod with 80 members (cross-region TAM org) will see the page jank.

**Concrete fix (incremental):**
- Page-size 25 with `Load more` button.
- Add a member search (`/` keyboard shortcut to focus from anywhere in the tab).
- Cache the result for 60 seconds (state already supports — just don't re-fetch on every tab visit if `crewMembers.length > 0 && lastFetchMs > now - 60_000`).

Phase-2 — denormalize each member's `earnedLast90d` onto a per-team `members/{uid}` doc updated by the cron, so reads are O(1) per row.

### Finding 16 — Calendar integration is single-token, primary-calendar-only, no work calendar support, no domain restriction. (P1 / M)

**Where:** `app.js:457-538` (calendar module) — hardcodes `/calendars/primary/events`.

A Google TAM has at minimum two calendars: their primary `@google.com` and often shared team calendars (`tam-coverage-na@google.com`). Time Off only ever reads/writes the primary. So:
- A TAM whose meetings are on a team calendar will see "no meetings in this window" and miss the whole feature.
- A TAM who clicks "add coverage marker" gets it on their personal calendar only — the team rotation calendar that managers actually watch stays empty.

Worse: there's no domain restriction on the OAuth flow (`app.js:475-484`). A user can sign in with `pat@gmail.com`, post bounties using their personal Gmail Calendar. That's fine for the public demo. For Google-internal positioning, the manager would expect a domain pin to corp.

**Concrete fix:**
- `calendar.listCalendars()` first, render a `[Primary ▾]` picker, persist choice per team in localStorage. Use that calendarId everywhere instead of `primary`.
- When marking the coverage on accept, write to *the requester's* configured team calendar (if both consent), not just the coverer's personal one.
- Admin setting: "Only allow members whose email matches @example.com to join this crew."

### Finding 17 — The economy has no team-budget concept; you cannot run "the crew's spending is too high this quarter." (P2 / L)

**Where:** Nothing aggregates spend at the crew level. `getLeaderboard.ts` only sums `coverageRelease` (earnings).

Doc 02 anticipates this in section 4 — "if balance equipo crece >20% YoY, baja stipend" — but there is no instrumentation in-app or in Firestore to *measure* that. Manager has to export every member's CSV, sum manually.

**Concrete fix:** a manager-only "Crew economy" panel on Settings showing:
- Total spent this month / last month / this quarter
- Total earned this month / last month / this quarter
- Stipend expired this month (the actual sink)
- 30-day net velocity
- A simple chart (sparkline) of monthly spend over the last 12 months.

Plus a settings knob: "Increase / decrease monthly stipend for this crew" (currently hardcoded `ECONOMY.MONTHLY_STIPEND = 11` in `app.js:41`). The whole point of the configurable economy in doc 02 is that managers tune it for their crew's velocity.

### Finding 18 — Onboarding does not teach the value prop, only the mechanics. (P2 / M)

**Where:** `app.js:85-92` — six Stan scenes about doubloons, stipend, leaderboard. Nothing about *why* coverage marketplace > the existing PTO sheet.

Stan's monologue today reads like a tutorial for a game. A senior TAM wants 30 seconds of "this fixes the rotation problem in the next planning cycle." Stan should say *in scene 1*:

> "Your team already covers each other on PTO — usually by guessing in a Slack thread. Time Off makes that visible and rewards the people who quietly carry the team."

That value prop is currently buried in the README and absent from the product. Add a 1-line subtitle under "WELCOME ABOARD, ${name}" on the Home view (`app.js:2657`) that pitches the problem, not the mechanics.

### Finding 19 — Pulling out the Big-tech "screenshot test." (P1 / S)

**The screen a TAM would screenshot to sell this:** the Bounty Detail modal with a populated AI briefing, meetings listed, "Add to my calendar" button, doubloon math visible. That screen is *good.* It's the screen I would put in a one-pager.

**The screen a TAM would screenshot to mock this:** the Stan welcome scenes, especially scenes 3-4 which read "Your starter chest holds 125 doubloons" and "The Crown drops 11 more stipend doubloons" with no context. Out of context — and a screenshot is always out of context — they read as fan-fiction in a productivity tool.

**Concrete fix for the mockable screen:**
- Cut Stan to one scene with both a left "what & why" column ("Your team already covers each other on PTO. Time Off tracks it and pays them back.") and a right "first action" CTA ("Form your crew →").
- Move the doubloon mechanics to an *optional* "How the economy works" panel users can expand. The TAM who cares will expand; the rest will go straight to action.

Also: the bottom of the Help page (`app.js:2361+`) is a strong reference doc. Link to it from every empty state. Today empty states say "Post one yourself" with a back-arrow link to `/post` — they should *also* say "or read how doubloons work →" with a deep link to a specific anchor in `/help`.

### Finding 20 — There is no in-product way to invite a *specific* user. You must share a link. (P1 / S)

**Where:** `app.js:1396-1402` — `copyInviteLink` is the only invite path. There is no "Invite by email," no "Invite from your @company directory."

For a TAM who is forming a crew of 8 specific reports, the flow is: copy invite link, paste into a fresh Gmail draft, send to each person, hope they click. Compare to the OOO experience, where you simply type a name and it autocompletes from corp directory.

**Concrete fix:** Settings → `Invite by email` text input. Type email, pick role (`crewmate` / `captain`), the function `inviteMember` writes a pre-approved row to `teams/{tid}/pendingInvites/{email}` with a token. When that user signs in, `initUser` (`functions/src/http/initUser.ts`) checks for any pending invites matching their email and auto-joins. Bonus: drop a templated email at the invitee.

This is the same lift as Finding 11 (invite tokens) with one extra field.

### Finding 21 — The "Tavern" (recent scrolls) lives at the bottom of the Wall of Fame tab. Recognition is buried. (P2 / S)

**Where:** `app.js:3256` — `renderTavern()` is appended after the WoF list. Most users never scroll that far on first visit.

The scrolls system is the *most novel* feature of Time Off and it's the one buried hardest. Recognition decoupled from the currency is a real design win and right now nobody sees it.

**Concrete fix:**
- Move the Tavern to a top-of-the-Wall-of-Fame strip — *above* the podium. "Recent kudos from your crew" — limit to 3 most-recent. Click → opens the Tavern in full.
- OR — make the Tavern its own tab. The current 6-tab nav (`app.js:2755-2760`) has room for one more if Post-Bounty becomes a header button instead of a tab (this dovetails with doc 13, finding 24).

### Finding 22 — There is no team rotation, no recurring bounty. Every PTO is filed manually. (P2 / L)

**Where:** Nothing in `functions/src/` named `rotation`. The post form has no "repeat this" toggle.

Most TAM team rituals include a recurring on-call rotation. Time Off models one-off bounties only. The first power user will ask "can I set a recurring weekly bounty for my Friday on-call?" and the answer today is no.

**Concrete fix (Phase 2):**
- Post Bounty → optional "Repeat: every {week / month / custom}" + "Repeat for: 3 / 6 / 12 occurrences."
- A daily cron generates the next instance N days before its window starts.
- Auto-mints a notification: "Your recurring Friday on-call bounty is open for next week — confirm or skip."

For pure rotation (no doubloons exchanged — pure visibility), allow setting the bounty to 0 doubloons with a "rotation" tag. This unlocks the "we already use this for OOO, may as well use it for rotation" pitch.

### Finding 23 — The post form's day picker re-renders the whole grid on every keystroke in the meetings checkbox. (P2 / S)

**Where:** `app.js:3692-3704` — input/change listeners both call `syncFormStateFromDom`, which triggers `renderDayPicker` + `renderMeetingsPicker` via direct `outerHTML` swap (`app.js:3737-3748`). That part is *good* (avoids focus loss). But:

`renderDayPicker` reads `state.formState.selectedDayKeys`. When the user toggles a meeting (which doesn't change days), the meetings picker re-renders unnecessarily. When dates change, both re-render. When dates *don't* change, the meetings picker still re-renders on any input change because the condition `if (datesChanged)` gates the surgical update but every input event still triggers the listener and then bails. That's fine performance-wise — but the listener also calls `data.getAll('meeting')` which churns through `state.calendarEvents` (`app.js:3729`). With 50+ meetings in a window this is the kind of jank a TAM notices.

**Concrete fix:** memoize the meetings recompute; only re-run when the meeting checkboxes actually changed, not when scope/SLA/emergency text changed. Or — and this is better — diff the FormData against the previous serialized form state and skip downstream work if unchanged.

Same pattern: `state.calendarEvents` filter in `app.js:1292` (`f.meetings = state.formState.meetings.filter(...)`) runs every time `refreshCalendarEvents` fires. Fine for 5 events; pathological for 200.

### Finding 24 — There is no "draft" for bounties — close the tab mid-post and lose everything. (P2 / S)

**Where:** `state.formState` lives in memory only (`app.js:243-256`). The form is multi-step and substantial. Refresh = clean slate. Worse: there is no localStorage persistence even though the rest of the app is comfortable with it (`vacaciones.skin`, `vacaciones.sound`, `vacaciones.notifLastSeen`, `vacaciones.achievedIds`, `vacaciones.addedMeetings.*`).

The `STATUS_LABEL` (`app.js:80-83`) even includes a `draft` state — but it isn't used anywhere in code.

**Concrete fix:** persist `state.formState` to `localStorage.vacaciones.draft.{teamId}` on every `syncFormStateFromDom`, restore on render. Show a small "Draft restored from your last visit" banner with a `Discard` button. Optionally surface drafts on the Bounty Board as ghost cards: "Draft · resume editing →" — only visible to you.

### Finding 25 — Accessibility of the day-picker grid is uneven. (P1 / S)

**Where:** `app.js:3010` adds `role="button" tabindex="0" aria-pressed="..."` — good. But `app.js:1175` (the crew-claim modal day grid) does *not* have those attributes. So claiming days in a crew bounty is mouse-only. The keyboard handler at `app.js:3777-3781` checks `document.activeElement?.matches?.('.day-card[data-day-key][role="button"]')` which fails on the modal grid.

**Concrete fix:** parameterize the day-card render so both surfaces share the same a11y attributes; add the keyboard activation handler to the modal too.

This is a regression of doc 10's accessibility audit. Worth catching now.

### Finding 26 — Skin switcher in the header is a discoverability win and a clarity problem. (P2 / S)

**Where:** `app.js:2304` — palette emoji 🎨 in the header.

Four skins is two too many. Pirate (default) + High Contrast (a11y need) is the principled set. Basic + Dark Knight are bikeshedding — they signal "we don't know what our brand is" rather than "we offer accessibility choices." A TAM seeing four skins on day one wonders: "wait, *which one is the real one?*"

**Concrete fix:** Demote Basic and Dark Knight to "experiments" behind a settings flag. Keep Pirate (default) and High Contrast as the only two visible options. The skin button becomes a 1-line toggle: "Use high-contrast theme [off/on]." Less choice paralysis, stronger brand statement.

If you keep all four skins, at minimum: in the skin picker (`app.js:1414-1436`), reorder to lead with Pirate, then HC, then the alternates as a separate group labeled "Experiments." Today they're all peers.

### Finding 27 — Manager admin surface is wedding-website-grade, not Buganizer-grade. (P1 / M)

**Where:** Settings tab (`app.js:3304-3423`), Members tab (`app.js:3260-3302`).

A manager today gets:
- 1 setting: Gemini API key.
- 1 setting: backfill grant button.
- 1 action: audit log (read-only).
- Inline per-member: bonus / promote / demote / remove.

What's missing for a manager who actually runs a team:
- **Search/filter on Audit Log** (`app.js:3382-3419` is a flat 50-item list). Filter by action type, by actor, by date range.
- **Bulk member actions:** invite multiple at once, promote multiple, set role per email at invite time.
- **Crew settings beyond Gemini:** holidays calendar (referenced in doc 02 section 3 "2x for fin de semana y feriados" — currently weekends are 2x but holidays aren't ever specified), stipend amount override, transaction fee on/off, max-uses on the invite link.
- **An export of the entire crew state** — bounties + ledger + members — as a single ZIP, for backup / disaster recovery / handoff to a new manager.
- **A "transfer ownership" action** — what happens when the crew owner leaves the company? Today, nothing. The owner UID stays, manager can't change it (`updateMemberRole.ts` likely guards owner — but no way to swap).

Each of these is small in isolation. The aggregate gap is what makes the Settings tab feel like an afterthought rather than a control room.

### Finding 28 — There is no team-default for the Post Bounty form. Every crew member fills out the same SLA every time. (P2 / S)

**Where:** `app.js:251` — `sla: 'P1 within 2h, P2 next business day'` is a hardcoded default in `state.formState`. The same defaults for `reachability: ['email-only-emergencies']` (`app.js:247`).

A TAM crew has a *team SLA* — not a per-bounty SLA. Define it once at the crew level, and every Post Bounty form prefills with the team default. This is the kind of detail that makes the form feel team-aware rather than personal-todo.

**Concrete fix:** add `defaultSla`, `defaultReachability`, `defaultCoverageKinds` to `teams/{tid}` doc. Manager edits in Settings. New bounties prefill from there.

### Finding 29 — Doubloon-as-currency framing creates the cognitive overhead of money without the legal commitment of money. (P2 / M — *thinking out loud*)

This is a strategic finding, not a bug.

The doubloon economy is the single feature that makes this product memorable and probably the single feature that will lose 30% of pilots. Two possible reads:
1. **Money-coded.** "5 doubloons / day, 10 on weekends" reads as price discovery. Then "the Crown drops 11 more" reads as a salary. Then "feeBurn" reads as a transaction tax. Players who read it as money will accumulate, optimize, complain when the rate changes, treat the leaderboard as a wealth ranking.
2. **Recognition-coded.** Doubloons are play tokens; the leaderboard is who-helped-most; the stipend exists so participation always gets you a token to spend. Players who read it this way don't optimize, they participate.

Doc 02 explicitly designs for read #2 (90-day rolling, expiring stipend, 1-doubloon transaction burn as sink). But the product surface reinforces read #1 hard: the chest tab has a "Total doubloons" number front and center (`app.js:2940-2944`), the post form shows the cost prominently (`app.js:3168-3173`), the toast "25 doubloons in escrow" emphasizes the price.

A Google PM in scope-cut review would push to test a minimal version with **only the recognition layer:** "you covered Sam for 5 days" / "Top covers this quarter" — no balance, no escrow, no price multipliers. If that minimum drives the right behavior, the doubloon mechanics survive only as a faucet/sink internal detail, never surfaced.

**Concrete fix (recommended A/B):** introduce a `data-economy-mode` knob at the crew level. Mode A = full doubloon currency (today). Mode B = "Recognition only" — same backend, but the UI hides the chest balance, hides the cost in Post Bounty, replaces "25 doubloons" with "5 days of coverage" everywhere, and the leaderboard ranks by *days covered* not earned doubloons. Compare adoption.

If you can't A/B, at minimum let managers configure whether balances are visible — some teams will adopt faster with the currency hidden.

### Finding 30 — Empty states are friendly. Day-7 / day-90 states are missing. (P2 / S)

**Where:** Empty states are good on day 1 (`app.js:2662-2667`, `app.js:2812-2818`, `app.js:3187-3193`). What about day 7, day 30, day 90?

A specific failure mode: a crew forms, two members post one bounty each, nobody covers, both bounties auto-expire. Day 7, the Bounty Board reads "No completed bounties" / "No taken bounties" — the Wall of Fame says "No covers yet" — the Tavern says "The tavern is quiet." The crew quietly abandons the tool.

**Concrete fix:** introduce a "Crew nudge" at the top of the Bounty Board for crews stuck in dead states:
- Day 7 with no bounties: "Most crews see their first bounty in week 1. Be the first to post one →"
- Day 14 with bounties posted but none taken: "These bounties have been open for 5+ days. Lower the SLA, sweeten the doubloons, or DM a crewmate." Possibly with a manager-only auto-prompt to grant a 5-doubloon tip.
- Day 30 with low utilization: a captain-only "Crew engagement report" with a suggestion: "3 of 8 crewmates haven't posted yet. Want to send a reminder?"

These nudges are the difference between Time Off being a tool that *works* and a tool that *converts.*

---

## 2. The screenshot test — what gets shared, what gets mocked

- **Sells the product:** Bounty Detail modal with an AI briefing populated, meetings listed, "Add to my calendar" button. Information-dense, time-saving, the briefing is a savings the TAM can articulate to their manager.
- **Mocks the product:** Stan onboarding scene 3 ("The Crown drops 11 more stipend doubloons"). Out of context it reads as fan-fiction. Cut Stan to one scene, lead with the value prop (Finding 18).
- **Confuses the product:** Empty Bounty Board on day 1 — friendly turtle, but no concrete next-3-things CTA.
- **Almost-enterprise:** Settings tab with audit log — would be exceptional with Finding 27's search / filter / export.

## 3. The ritual question

Coverage is decided in (1) the team Slack/Chat pivot, (2) the 1:1 with the manager, (3) the weekly team sync. Time Off plugs into none of these today. If forced to pick *one* finding to ship next, it is **Finding 3 (outbound notifications)** — because notifications turn Time Off from "yet another tab" into "an extension of how you already work."

---

## 4. What a Google PM would cut, what would survive

**Survives the scope cut:**
- Coverage marketplace + escrow.
- AI briefing (the killer feature for the busy TAM).
- Calendar integration (especially with Finding 16's fixes).
- Audit log + manager admin (with Finding 6 and 27).
- Thank-you scrolls (cheap, high-warmth).

**Gets cut or deferred:**
- The pirate skin (becomes optional opt-in, not default).
- Achievements (Cabin Boy → Commodore — cute, low value, doesn't influence behavior).
- The Tavern at the bottom of WoF — folded into the bell + email digest.
- Sound effects (turn off by default, settings-only).
- The custom pixel-art avatars (use real Google photos; ship faster).

The principle: **the playful frame should be opt-in for the target persona, not opt-out.** A senior TAM should be able to use this for six months without ever seeing the words "doubloon" or "ahoy."

---

## 5. The five-second pitch test

A TAM scrolls past your one-pager in a 30-minute review. They read the first sentence and the screenshot caption. Right now your pitch is "A pirate-themed coverage marketplace for Google TAMs" — `app/index.html:7`. That sentence loses you the audience.

Try: **"Time Off — turn ad-hoc PTO coverage into a tracked, recognized team ritual. Two clicks to post, two clicks to claim, briefings written for you."**

The pirate frame is the *delight* layer, not the *positioning* layer. Hide it for the executive read. Surface it inside the tool, where it earns the warmth that the audit logs and the bell can't.

---

## 6. The shortlist — five fixes that ship this quarter

If you can only do five things from this audit, do these in order:

1. **Email + Calendar notifications** (Finding 3) — turns this from destination to channel.
2. **Cmd-K command palette + keyboard shortcuts + `?` cheat-sheet** (Finding 1) — signals "serious tool" on day one.
3. **One-click "I'm out next week" fast-post path** (Finding 4) — collapses time-to-first-bounty by 4×.
4. **Manager-grade Settings + crew economy panel + crew totals on Members** (Findings 7, 13, 17, 27) — turns the manager from skeptic to evangelist.
5. **GDPR delete + invite token rotation + multi-calendar** (Findings 10, 11, 16) — clears the launch-review gate.

Everything else can ship over a year. Without these five, the demo lands as a project. With them, it lands as a tool.

---

## 7. Closing — the warmth-vs-trust trade

Time Off has more warmth than 95% of internal Google tools. That is a moat, not a liability. The mistake would be to read the findings above and strip warmth out of the product — that's the wrong overcorrection. The right move is to put the warmth where users *feel* it (illustrations, empty states, the Tavern, achievement names) and pull it out of where it *blocks* them (CTAs, system errors, form labels, settings).

A senior TAM should be able to do their job in the app without ever once being asked to think like a pirate. When they're done with the job and have a spare 30 seconds, they should be able to read about being a pirate. That separation — work mode vs. delight mode — is the line every great consumer-grade internal tool draws. Buganizer doesn't make jokes during a triage; it makes them in the holiday header. Time Off should do the same.
