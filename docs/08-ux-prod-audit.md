# 08 — Production-launch UX audit

Live: `https://vacaciones-dev-b3158.web.app`. Code at `app/{index.html,styles.css,app.js}` (3,423 lines) + `functions/src/`. Audited 2026-05-29 against commit `98d9b5c`. Doc 05 covered an earlier three-section build; the shipped app has tabs, scrolls, Calendar, Gemini, audit log, so this doc supersedes 05's priorities.

The build is feature-complete. Most of what follows is launch-blocker friction, not missing features.

---

## 1. Cardinal flows, scene by scene

### 1.1 First sign-in + Stan onboarding
Click Google → popup → `onAuthStateChanged` `app.js:809` → `initUser` → 6-card Stan modal `app.js:1858` → "Set sail" closes onto empty Home.

- **6 monologue cards then a blank Home.** Scene 6 says "hoist a crew and post yer first bounty" — wrong for an invited user. The new arrival sees two equal panels (Form / Join) and no signal which is theirs. (`app.js:83–90`)
- **"Skip" only on scene 0.** From scene 1 the secondary becomes "Back." Locked-in users must click forward 5 more times. (`app.js:1875`)
- **Avatar picker is not in onboarding.** The pixel avatars are the most fun part of the build and most users will never find the header dropdown to set one.

### 1.2 Create your first crew → Bounty Board
Home → type name in `#new-team-name` → "Hoist" or Enter (`app.js:3409`) → `createTeam` → navigate to team (`app.js:987`) → empty board.

- **No "what now?" on empty board.** Copy says "Post one yourself" — pointless with no crewmates. Highlight `🔗 SHARE INVITE` in the header (`app.js:2417`) when memberUids.length === 1.
- **"Hoist" / "Aye" / "Set sail"** are charming once, cost a beat every time. Keep theme in headings and Stan voice; move CTAs to plain verbs ("Form crew" / "Join crew").

### 1.3 Join via invite link
`#/join/<teamId>` → if signed out, sign in → hash *should* persist → `applyRoute` resolves and joins.

- **Invite link lost across auth.** Google popup on Safari/iOS routinely clears the hash. `applyRoute` `app.js:766` resolves *after* `initUser` finishes. Persist `pendingJoinId` to localStorage before sign-in and consume post-login. Currently brittle. **Launch blocker.**
- **Already-member case toasts but also navigates** (`app.js:997`, `app.js:1001`) — fine, but the toast reads like a near-error.
- **"Form a crew" and "Sign on" presented as peers** for invited users — only Join is relevant; hide Form when a pending join intent is detected.

### 1.4 Post a bounty (single coverer)
Tab → form → submit → toast → back to board (`renderPostTab` `app.js:2759`, `postBounty` `app.js:1006`).

- **No draft persistence.** Refresh = retype everything except `timezone` and `sla`. `state.formState` is in-memory only.
- **No "balance after" preview.** Cost shows "25 doubloons" but never "balance after: 100." Fatal for users scraping their wallet (`app.js:2833`).
- **Coverage mode is buried** below the day picker (`app.js:2804`). It's a meaningful product choice that belongs near the date row.
- **Calendar OAuth ask is scary, unprefaced.** Read + write scopes via `signInWithPopup` (`app.js:407`) — no "why we need this" line. Many users balk.
- **Gemini briefing lives on bounty detail, not the post flow.** Three navigations to do an action that intuitively belongs in posting (`app.js:2002`).
- **Validation errors are toasts.** Three separate toasts at `app.js:1011, 1012, 1017` with no field highlight.

### 1.5 Post a bounty (crew mode)
Same form, mode radio = "Crew coverage."

- **Form doesn't change** when mode switches — no reassuring copy that the bounty stays open until every day claimed.
- **No floor on per-coverer days.** A crewmate can claim one day of a 10-day bounty; sometimes you want a minimum.

### 1.6 Accept a single-coverer bounty
Board card → click button or card → detail modal (`showBountyDetail` `app.js:1893`) → "Take voyage" → `acceptRequest` `app.js:1049` → toast + coin shower.

- **Card click vs button click diverge.** The button uses `e.stopPropagation()` (`app.js:3170`) and accepts immediately, skipping the briefing. The card opens detail. Fast users skip what they should read. Remove the button from cards; accept only from detail.
- **`showBountyDetail` is one 200-line conditional** (`app.js:1893–2097`) covering open, accepted, completed, cancelled, requester-edit, manager-force-complete, thank-you scroll. Refactor into named sub-views before edge cases leak.

### 1.7 Claim days of a crew bounty
Card "Claim days (N left)" → `startCrewClaim` → custom inline modal (`showCrewClaimModal` `app.js:1075`) → toggle day grid → "Take N days" → `acceptRequest(bountyId, days)`.

- **Bypasses `showModal`.** Custom `document.createElement` (`app.js:1124–1168`) means no Escape-to-close, no shared button styling.
- **No briefing access from the claim modal.** Coverer about to commit 7 days can't read scope/SLA/AI briefing without cancelling first.
- **Total cost not prominent.** Only shown in body text (`app.js:1115`).

### 1.8 Add meetings + coverage marker to coverer's calendar
Detail modal → "📅 Add coverage marker + N meetings" (`app.js:2037`) → `addAllBountyMeetings` `app.js:1281` → sequential `addEvent` calls.

- **No spinner during the loop.** Same button, no toast until done. 30-meeting bounty = silent multi-second freeze.
- **Per-meeting errors are swallowed** (`app.js:1303` console.error only). Green success toast even when 12 of 30 failed.
- **Token refresh popup mid-loop.** A 401 between meeting 5 and 6 pops the OAuth prompt in the middle of the loop (`app.js:1267`). Refresh once *before* the loop.
- **Idempotency is `localStorage` only** (`app.js:506`). Switch browsers, mid-loop retries duplicate. Move to server.
- **The button only lives in the detail modal.** A coverer who took the bounty 4 weeks ago has to remember to dig back in; surface on the card while it's still pending.

### 1.9 Manager: grant bonus, promote, remove
Crew tab → kebab → `showMemberAdminModal` `app.js:1700` → three buttons → confirmation modal per action.

- **Three actions, one Close button.** Different danger levels stacked vertically; "Grant bonus" has no confirmation gate, the others do — inconsistent.
- **No bulk action.** 5 thank-you bonuses = 5× kebab→manage→form→confirm.
- **Role badge refresh is post-toast.** Manager has to wait for `refreshCrewMembers` (`app.js:1637`) to verify the change took.

### 1.10 Manager: cancel a bounty, force-complete one
Cancel: `confirmCancelBounty` `app.js:1429` — decent, shows refund. Force-complete: red button inside detail modal for managers only (`app.js:2086`).

- **Force-complete doesn't release coverer coins.** Looking at `forceCompleteBounty.ts:32–88`, it burns the fee, flips status, no `coverageRelease` ledger entries. The coverer loses unreleased earnings silently. The button copy says "Force complete" — manager has no idea that's what happens. **Launch blocker — actual coin loss.**
- **Cancel-with-coverer gives the coverer no signal.** The bounty just vanishes from their view (filter excludes cancelled, `app.js:940`). No toast, no scroll.

### 1.11 Export ledger CSV
Treasure Chest → "📥 Download CSV" (`app.js:2625`) → `exportLedgerCsv` `app.js:1445` → blob download.

- **Only exports last 40 entries** because that's the ledger subscription limit (`app.js:908`). Button copy implies full history. Real bug for long-term users.
- **CSV uses raw type codes** (`escrowIn`, `feeBurn`). Use `LEDGER_TYPE_LABELS` from `app.js:62`.
- **No date filter.**

### 1.12 Send a thank-you scroll + react
Path A: completed bounty detail → "🪶 Send Thank-You Scroll" (`app.js:2072`). Path B: Wall of Fame → "🪶 TIP HAT" (`app.js:2914`) → `showSendScrollModal` `app.js:1555` → Tavern updates live → reactions via 5 fixed emojis.

- **No entry from the Bounty Board "Done" filter.** Done bounties are the prime "thank-you" trigger; no affordance on the card.
- **240-char limit is tight** for a heartfelt thanks.
- **Reaction race condition.** `reactToScrollAction` `app.js:1770` reads `t.dataset.mine` from the DOM at click time; live-update can leave it stale.
- **No animation on reaction.** Compare to the coin shower on earnings — the gold-standard moment. Reactions deserve a similar treat.

---

## 2. Top 12 friction points, ranked

| # | Friction | What it feels like | Fix | Where | Effort |
|---|---|---|---|---|---|
| 1 | Force-complete strands coverer coins | Tomorrow the coverer has no doubloons and no explanation | Release remaining day coins before flipping status; rename button to "Complete + release remaining" | `functions/src/http/forceCompleteBounty.ts:32–88`, `app.js:3316` | M |
| 2 | Invite link breaks across auth | "I clicked, it took me to my crews, not the new one" | Persist `pendingJoinId` to localStorage at `applyRoute`; consume post-auth | `app.js:776`, `app.js:809` | S |
| 3 | AI briefing renders raw markdown as text | Asterisks and pound signs everywhere | Render `aiBriefing.content` through a tiny md→HTML helper | `app.js:1997` | S |
| 4 | Post form has no draft persistence, no balance-after | Refresh = retype; surprise overdraft | Persist `state.formState` on each input; add `totalBalance - cost` line to preview | `app.js:3370`, `app.js:2833` | S |
| 5 | CSV export silently caps at 40 rows | Power user sees a sliver of their history | Re-query without limit on export, or paginate server-side | `app.js:1445`, `app.js:903` | M |
| 6 | Validation errors are toasts pointing nowhere | "Which field?" | Inline `aria-invalid` + red field + helper text; drop duplicate toast | `app.js:1011–1019` | M |
| 7 | Card click vs button click on bounties have different intents | Fast user accepts without reading briefing | Remove "Take voyage" from the card; only detail modal accepts | `app.js:2519–2538`, `app.js:3168` | S |
| 8 | Calendar add-meetings: no progress, swallowed errors, mid-loop OAuth | Silent multi-second freeze; partial success looks total | Spinner state, per-meeting try/catch with toasts, refresh token before loop | `app.js:1281–1326` | M |
| 9 | Bounty cancelled mid-flight: coverer gets no signal | Their voyage vanishes silently | Backend writes notification on cancel; surface in bell | `functions/src/http/cancelBounty.ts:91`, `app.js:588` | L |
| 10 | Pirate-themed CTAs ("Hoist" / "Aye" / "Set sail") | First five clicks cost a beat each | Plain verbs on CTAs; theme stays in headings, scrolls, and Stan voice | Login + Home | S |
| 11 | Stan onboarding ignores the invited-user fork | Drop-off on first run | Replace last 2 scenes with a forked CTA: "I was invited" vs "Starting fresh" | `app.js:83–90`, `app.js:1858` | M |
| 12 | Modals broken by iOS keyboard, no Escape, no aria-labels on icon-only buttons | Mobile users get content cut off; screenreaders silent | `max-height: dvh`, sticky-bottom action row, Escape handler, aria-labels on bell/sound/skin/kebab | `styles.css:2549`, `app.js:3420` | M |

---

## 3. Information architecture

Current tabs: **Bounty Board · Treasure Chest · Wall of Fame · Crew · Post Bounty · Settings.** Opinionated take:

- **Bounty Board** is the right default. Keep. Filter chips are a sub-tab; they work.
- **Wall of Fame should fold into Treasure Chest** ("Where you stand" section under rank). It only matters once a few weeks; doesn't deserve a top-level slot. Tavern is *under* Wall of Fame today (`app.js:2922`) — that hides peer recognition behind a leaderboard. Promote **Tavern** to its own tab.
- **Treasure Chest** mixes rank + wallet + achievements + ledger + CSV. Rename to **Wallet** or **Purse**. Achievements stay, they're the gamification side.
- **Crew** is correct. Replace the kebab → modal-on-modal admin pattern with an inline expander on the member card.
- **Post Bounty** as a tab is fine, but the future-state should be a sticky **+ Post bounty** button visible on every team tab, launching `#/team/{id}/post` as a route. Remove from the tab strip.
- **Settings** today mashes three concerns: identity (name/photo, also reachable via header MANAGE), admin (top-up, audit log), integrations (Gemini key). Split into three sub-sections within Settings.

Recommended tabs: **Bounty Board · Wallet · Crew · Tavern · Settings** (and a sticky + Post Bounty button). Five tabs, each unambiguous.

**Modal vs sub-page:** Bounty detail stays modal but must be refactored. Manage Crew should be Settings → Identity (not a separate modal). Member admin should be inline. Crew claim should use `showModal` like everything else.

---

## 4. Loading / empty / error patterns

Done well: `loading-doubloon` spinner is used consistently in Wall of Fame, settings, members (`app.js:2849, 2927, 2980`). Empty-card with turtle is consistent across Home, Bounty Board, Wall of Fame, Tavern, Members.

Done badly:

- **`renderTeam` shows "Crew not found" while teams are still loading** (`app.js:2382`). 200ms latency = false negative. Distinguish "subscribing" from "subscribed and empty."
- **Bounty Board has no loading state** (`app.js:2433`) — renders empty list, looks like "no bounties" until live listener fires. Add skeleton rows.
- **Wallet/ledger has no loading state** — same issue.
- **Calendar loading is inline but non-blocking.** User can submit before meetings finish loading and lose meeting context (`app.js:2702`).
- **Error toasts leak raw error.messages.** `app.js:823, 856, 1045, 1766` — users see `FirebaseError: Missing or insufficient permissions` and raw Gemini 400 text. Build a tiny error-mapper.
- **No `navigator.onLine` indicator.** Firestore queues silently; a posted-while-offline bounty gives no signal.
- **No error boundary.** A throw in any `renderXxx` blanks the `#app` div.

---

## 5. Edge cases not handled cleanly

- **Owner cannot delete or leave their own crew.** There's no `deleteCrew` or `leaveTeam` function. A dead crew has no exit path. Add owner-only delete that refunds escrowed coins and archives the audit log.
- **Removing a coverer mid-voyage** (`removeMember.ts:81`) deletes the member doc but leaves `dayCoverers` referencing them. `dailyCoverageRelease` keeps paying. Ex-member sees coins on the leaderboard but can't spend them. Desired: refuse the removal with "this crewmate is mid-voyage" until covered bounties are reassigned or cancelled.
- **Cancelling a fully-claimed crew bounty** (`cancelBounty.ts:73–88`) refunds the requester but coverers who claimed days get nothing for expected earnings — no notification. Desired: write a notification entry per affected coverer and show in the bell.
- **Gemini key removed mid-generation** → user sees `failed-precondition: No Gemini API key configured` after clicking a visible button. Subscribe to crew settings live so the button disables instantly when the key clears.
- **Calendar token expires mid loop** → OAuth popup appears between meeting 5 and 6. Dismissing it leaves remaining meetings silently un-added, and the local "added" cache is incomplete. Refresh token before the loop; abort loop on user-cancelled OAuth with a clear toast.
- **Two coverers race for the same day** in crew mode. Transaction resolves correctly but the toast at `app.js:1062` ("Took N days") hides the delta between requested and granted. Show "2 days were taken while you were deciding" when `requested > granted`.
- **Sign-out leaves open modals visible** over a blank main view (`app.js:828`). Tear down `.modal-scrim` in the auth handler.
- **Two browser windows = double achievement unlock toast** because the ledger listener fires in each window (`app.js:923`). Rate-limit via a `last_unlock_ts` in localStorage.
- **Achievement persistence is per-browser** (`app.js:239`) — switching machines re-unlocks all of them with toasts and sounds. Move to user doc.

---

## 6. Production-launch checklist

**Must-fix before launch:**

1. Force-complete must release coverer coins (5.1 above, `forceCompleteBounty.ts`).
2. Persist pending join ID across auth (`app.js:776`).
3. Friendly error mapping for all `showToast(err.message, 'error', ...)` callsites.
4. Markdown renderer for AI briefing (`app.js:1997`).
5. CSV export full ledger, not just 40 rows.
6. Loading skeletons on Bounty Board + Wallet.
7. Inline validation on Post Bounty.
8. Form draft persistence.
9. Sign-out closes open modals.
10. Active-coverage guard on Remove Member.
11. `renderTeam` shows loading vs "Crew not found" correctly.
12. Remove "Take voyage" from the card (accidental-click guard).
13. Stan onboarding fork: invited vs. starter.
14. Keyboard nav for modals — Escape closes, Enter submits. Currently only the bell honours Escape (`app.js:3420`).
15. `aria-label`s on all icon-only buttons. Some present (`app.js:2123–2132`), kebabs and reactions missing.
16. Mobile dvh on modals (`styles.css:2549, 2605`).
17. Confirm destructive actions with name re-type — especially Remove Member.
18. Offline banner via `navigator.onLine`.

**Polish (post-v1.0):**

- Toast queue / stacking animation.
- Hover lift on bounty cards (currently only `cursor: pointer`).
- Copy-paste affordance on team ID chip (`app.js:2346`).
- Empty Tavern with example scrolls.
- Localisation hooks — user is Spanish-first per memory; pirate copy is EN only. Decide ES default + EN-pirate skin, or EN only.
- `<title>` updates per route.
- Print CSS for ledger / briefing (TAMs forward briefings via PDF in practice).
- Service worker for offline shell.
- Move avatar pick into the onboarding flow.

---

## 7. Five highest-leverage UX changes for v1.0

If only five ship before launch:

1. **Fix the invite-link auth round-trip.** Without this, the primary growth loop is broken on Safari/iOS. (Item 2 in the table; `app.js:776`, `app.js:809`. S.)
2. **Force-complete must release coverer earnings and the copy must say so.** Today, a "tidy-up" admin action is silently confiscating real coin earnings. Until fixed, no manager should touch the button. (Item 1; `forceCompleteBounty.ts`. M.)
3. **Render AI briefing as actual markdown, *and* surface "Generate briefing" inside the Post Bounty flow.** The most innovative feature in the app is hidden two clicks deep and renders as ASCII soup when it does show. (Item 3 + sub-point in 1.4; `app.js:1997, 2759`. M.)
4. **Persist the Post Bounty form locally + show "balance after" in the cost preview.** Two small changes that fix the two most common reasons a returning requester abandons a post: lost work and surprise overdraft. (Item 4; `app.js:3370, 2833`. S.)
5. **Inline validation + friendly error mapping.** Every error flow today screams developer mode. Even one polished error path materially changes how the app feels. (Items 3 and 6; scattered `showToast(err.message, 'error', ...)` callsites. M.)

Everything else in this audit is real, but these five make the difference between "you can demo it" and "you can ship it."
