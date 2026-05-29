# Vacaciones — Copy & Microcopy Audit (Pre-Launch)

Source: end-to-end pass over `app/app.js` and `functions/src/http/*.ts`. Audience for the product: adult Google TAMs. Audience for this audit: the future contributor who picks up the codebase. Goal: ship copy you can be proud of in week one.

---

## 1. Voice & tone — pick a side

The app currently swings between two registers within the same line of sight:

- **Pirate flavour** (load-bearing): `Ahoy, weary TAM!`, `Hoist`, `Aye`, `Set sail`, `Anchors aweigh`, `Crown's stipend`, `Harbour fee`, `Captain's log`, `shore leave`, `the tavern echoes`.
- **Neutral SaaS** (functional necessities): `Settings`, `Audit log`, `Save`, `Submit`, `Cancel`, `Sign out`, `Refresh`, `Cost breakdown`, `Reachability`.

The mix is *mostly* charming but breaks in a few places. Worst offender: putting `Tales of Monkey Coverage` next to `SIGN IN WITH GOOGLE` (the Google button copy is locked by Google's brand guidelines — that's fine, but it's the only literal-Google string on the whole login screen, and the contrast is jarring). Best moment: the `Crown's stipend` bucket label sitting next to `Earned` — both register-perfect.

**Recommendation: keep the pirate skin, but quarantine it.** Treat pirate as a *flavour layer* on top of functional copy, never *instead of* functional copy. The user must always be able to read a button and know what it does without translating from pirate.

### The 5-rule style guide (hand this to the next contributor)

1. **Verbs are pirate; nouns are clear.** "Hoist", "Take voyage", "Set sail" are fine on buttons because the surrounding context makes the action unambiguous. But "your purse / chest / treasure" stacked together makes a user hunt for which one is *the* balance. Use `Treasure chest` for the wallet page, `doubloons` for the unit, and stop inventing synonyms.
2. **No pirate accent on user-typed strings.** No "ye", "yer", "'em" in form labels, error messages, or anywhere a user is asked to do something. The accent is fine in Stan's mouth and in the Wall of Fame's flavour text. It is not fine on `Crew name cannot be empty.`
3. **Never sacrifice clarity for the joke.** If the joke costs the user a re-read, the joke is wrong. `Hoist` for "create a crew" is a 50/50 — most TAMs will get it from context (the input next to it says "Crew name"), but it would not survive being moved anywhere else.
4. **One word per concept.** Doubloons, not coins. Crew, not team. Crewmate, not member or teammate. Bounty, not request. We use all of these synonyms today; pick one each and grep them out.
5. **Microcopy carries weight; spend it on context, not on flavour.** Inline help text under a field should answer "what do I put here?" — not "what would Guybrush Threepwood say?"

A practical effect of the rule: words like `team`, `request`, `manager`, `member`, `coin` should be search-and-replaced (where they're user-visible) to `crew`, `bounty`, `captain`, `crewmate`, `doubloon`. Internal code variables stay as-is.

---

## 2. CTAs — the "shouted across the office" test

For each button I asked: if someone reads only the button label (no context, no preceding paragraph), do they know what'll happen when they press it?

| Existing label | Verdict | Proposed swap (if any) |
| --- | --- | --- |
| `SIGN IN WITH GOOGLE` (login) | Pass — locked anyway | Keep |
| `Hoist` (create crew, home) | Borderline. Solo it sounds nautical-but-unclear. | `Hoist the colours` (still pirate, more decisive) — or `Form crew` if you want to play it safe |
| `Aye` (join crew, home) | Fails. The word "Aye" on a button next to an ID field tells me nothing. | `Sign on` (already used as the panel title — match it) |
| `Set sail` (last Stan scene primary) | Pass — celebratory, lands at the right moment | Keep |
| `Aye, next` (Stan scenes 1–4) | Slightly cute-for-cute's-sake. | `Next ▸` — the rhythm of clicking through onboarding doesn't need pirate every time |
| `Skip` (Stan, first scene only) | Pass | Keep |
| `Back` (Stan, scenes 2+) | Pass | Keep |
| `Take voyage` (bounty card primary) | Pass — vivid, and the surrounding card makes the meaning obvious | Keep |
| `Cover this` (not currently used in code) | n/a — but if added, use this for the "take just one bounty" CTA in a digest email |
| `Take N days` (claim modal) | Pass — the N is load-bearing and good | Keep |
| `Claim days (N left)` (crew-mode bounty) | Pass — pluralisation handled, count load-bearing | Keep, but consider `Pick days (N left)` since the action that follows is a picker, not a claim. Avoid surprising users who expect "claim" to be a one-tap commit. |
| `Aye` joining a crew | See above | Replace |
| `Form a crew` (panel title) | Pass | Keep |
| `Sign on with a crew` (panel title) | Pass — strong | Keep |
| `Post bounty` (form submit) | Pass | Keep |
| `Posting…` (busy state) | Pass | Keep |
| `Save key` (settings) | Pass | Keep |
| `Top up to 125` (settings) | Pass, but only after you read the paragraph above it. Move the explanation **into** the button: | `Top up everyone to 125 doubloons` |
| `🪶 Send Thank-You Scroll` (completed bounty modal) | Pass — the emoji + capitalisation telegraph "this is the special thing" | Keep |
| `Add coverage marker + N meetings to my calendar` | Long, but every word is doing work. Pass. | Keep |
| `Force complete` (manager admin) | Pass for the audience (it's a manager-only escape hatch) | Keep |
| `Aye, complete it` (force-complete confirm) | Mixed — fine | Keep |
| `Aye, top up` | Fine | Keep |
| `Aye, cancel` (cancel bounty) | **Slightly dangerous.** "Aye, cancel" reads ambiguously when the modal is titled `CANCEL BOUNTY?` — "Aye" could be answering the question with "yes, I do want to cancel" OR "yes, I want to cancel the cancellation". | `Yes, cancel bounty` — drop the pirate on destructive confirms |
| `Aye, remove` (remove member) | Same problem | `Yes, remove from crew` |
| `Aye, clear it` (clear Gemini key) | Same | `Yes, clear key` |
| `Aye, promote` / `Aye, demote` | Less ambiguous because the verbs differ from the modal title | Keep |
| `Nevermind` (secondary on destructive modals) | Sweet, but spell it `Never mind` (two words is the standard form) | `Never mind` or `Cancel` |
| `Send scroll` (scroll compose modal primary) | Pass | Keep |
| `Send doubloons` (grant bonus primary) | Pass | Keep |
| `Save` (manage crew, edit bounty) | Pass | Keep |
| `Close` (skin/avatar/member admin modals) | Pass | Keep |
| `Cancel` (most secondaries) | Pass | Keep |
| `AYE` (the *default* `primaryLabel` in `showModal` — line 1823) | **Active landmine** | Change the default to `OK`. Every modal *should* specify its own label; the default is a footgun. |

Two structural notes:

- The default `primaryLabel = 'AYE'` in `showModal` (line 1823) is the worst kind of subtle bug: if anyone adds a modal in the future and forgets to set `primaryLabel`, they'll ship a button labelled `AYE` for a non-pirate action. Change the default.
- The `forceCompleteBounty` modal body says `"This marks the bounty as completed immediately and burns the harbour fee."` That's correct but somewhat scary. Add a positive framing: `"Use when the coverer can't finish. The requester is charged in full; the coverer keeps everything they've earned so far."`

---

## 3. Toasts — quoted and judged

Every `showToast(...)` call in `app/app.js`, in order of appearance:

| Line | Current message | Kind | Verdict |
| --- | --- | --- | --- |
| 580 | `${icon}  Achievement unlocked: ${name}` | success | Good |
| 823 | `Could not register your sailor card: ${err.message}` | error | "sailor card" is opaque flavour for the user — say `Could not finish sign-in: ${err.message}` |
| 856 / 862 | `err.message` (raw) | error | Brittle. See §6 for the fix at the Functions side. |
| 877 | `Could not load your crews: ${err.message}` | error | Good |
| 983 | `Crew "${name}" formed. 125 doubloons in your chest.` | success | Good — gives the next action (you have money to spend) |
| 997 | `You're already aboard that crew.` | info | Good |
| 998 | `Signed aboard! 125 doubloons in your chest.` | success | Good |
| 1011 | `Pick a valid date window.` | error | OK but bland. `Pick a start and end date — end can't be earlier than start.` is more actionable. |
| 1012 | `Pick at least one reachability option.` | error | OK |
| 1017 | `Pick at least one day to be covered.` | error | Good |
| 1035 | `Bounty posted for ${N} doubloons. Anchors aweigh!` | success | Great — celebratory, names the number, sets sail |
| 1063 | `Voyage accepted in full. ${N} doubloons in escrow.` / `Took ${days} day${s}. ${N} doubloons in escrow.` | success | Good — but "in escrow" is jargon. New TAM doesn't know what escrow means here. Say `You'll earn ${N} doubloons as the days pass.` |
| 1174 | `Pirate avatar set.` | success | OK |
| 1177 | `Could not set avatar: ${err.message}` | error | Good |
| 1185–87 | `Bounty cancelled. ${N} doubloons refunded.` / `Bounty cancelled.` | success | Good |
| 1228 | `Calendar: ${err.message}` | error | Lazy — strips context. Say `Couldn't fetch your calendar: ${err.message}` |
| 1238 | `Calendar connected.` | success | Good |
| 1242 | `Could not connect calendar: ${err.message}` | error | Good |
| 1286 | `Calendar connect failed: ${err.message}` | error | Slightly developer-tone | `Couldn't connect calendar: ${err.message}` |
| 1293 | `Everything already on your calendar.` | info | Good |
| 1321 | `Added ${bits.join(' + ')} to your calendar.` | success | Good, but lacks next-step. `Added ${...} to your calendar. Open your calendar app to confirm.` |
| 1324 | `Nothing new to add.` | info | OK |
| 1332 | `Invite link copied. Hand it to a crewmate.` | success | Great |
| 1339 | `🪶 Thank-you scroll sent. The tavern echoes.` | success | Charming, but "the tavern echoes" is filler — drop it. `🪶 Scroll sent — it'll show up in the tavern.` |
| 1342 | `Could not send the scroll: ${err.message}` | error | Good |
| 1419 | `Crew name cannot be empty.` | error | Good |
| 1448 | `Nothing to export.` | info | Good |
| 1473 | `Exported ${N} ledger entries.` | success | Good |
| 1531 | `Pick at least one reachability option.` | error | Good |
| 1544 | `Bounty updated.` | success | Good — minimal is fine here |
| 1557 | `You cannot send a scroll to yourself.` | error | Good |
| 1579 | `Write something — even a few words.` | error | Lovely |
| 1603 / 1616 / 1628 / 1730 | `Could not load ${X}: ${err.message}` | error | Good (consistent prefix) |
| 1635 | `${displayName} is now a ${role}.` | success | Good |
| 1644 | `${displayName} was removed from the crew.` | success | Good |
| 1652 | `Sent ${N} doubloons to ${displayName}.` | success | Good |
| 1661 | `Bounty force-completed.` | success | OK but loses the *who* — say `Bounty force-completed. ${requesterName}'s coverer keeps their earned doubloons.` if you can plumb the name through. |
| 1690 | `Pick an amount between 1 and 500.` | error | Good |
| 1693 | `Add a short reason (audit trail).` | error | Good |
| 1744 | `Everyone is already at the new grant.` | info | Good |
| 1746 | `Topped up ${N} crewmate(s) (+${perUser} each).` | success | Good |
| 1761 | `✨ Briefing generated.` | success | Good |
| 1766 | `Briefing failed: ${err.message}` | error | Slightly developer-tone — say `Couldn't generate briefing: ${err.message}` |
| 1782 | `Crew settings saved.` | success | Good |
| 3209 | `Skin applied.` | success | Good |
| 3230 | `Paste an API key first.` | error | Good |
| 3231 | `Key looks too short. Double-check.` | error | Good |

**Pattern observation:** error toasts are inconsistent on the verb. Half use `Could not …`, half use `… failed`, a few are direct (`Calendar: …`). Standardise on `Couldn't …: …` everywhere. Short, friendly, blameless.

---

## 4. Stan onboarding — rewrite

Today (constants at line 84):

> 1. "Ahoy! I'm Stan, harbormaster of Mêlée Bay. New deckhand, are ye? Let me show ye the ropes."
> 2. "Doubloons are how we trade coverage. 5 buy ye one day of shore leave. Weekend? Twice as dear — the Crown insists."
> 3. "Yer starter chest holds 125 doubloons — 25 business days of leave from the jump. Spend wisely."
> 4. "Every month the Crown drops 11 more stipend coins in yer purse — that's the year-after-year budget. Use 'em or watch 'em vanish at month's end."
> 5. "Cover a crewmate's bounty and earn their doubloons as the days pass. Patience, sailor — payouts release one day at a time."
> 6. "Top earners over 90 days get the captain's hat on the Wall of Fame. Now hoist a crew and post yer first bounty!"

Critique: scenes 2–4 dump three numbers in a row (5, 125, 11) without giving them weight; a returning user will not remember which is which. Scene 3 says "from the jump" — likely opaque to non-US English speakers. The "ye/yer/'em" volume is highest here and feels overdone — Stan can establish accent in scene 1 and dial it back. Scene 5's "Patience, sailor" is condescending to an adult user.

**Proposed rewrite** (still warm, still Stan, less accent):

1. **"Ahoy. I'm Stan, harbormaster of Mêlée Bay. New face on the docks — let me show you how this works."**
2. **"This is a coverage market. When you go on shore leave, you post a bounty. A crewmate covers you. They get paid in doubloons."**
3. **"One weekday of coverage costs 5 doubloons. Weekends are 10 — the Crown takes its cut."**
4. **"Your starter chest holds 125 doubloons, enough for 25 business days. Every month the Crown adds 11 more (use them by month's end, or they expire)."**
5. **"Cover a crewmate, and their doubloons land in your chest one day at a time as the coverage runs. Top earners get the captain's hat on the Wall of Fame."**
6. **"Ready? Form a crew with your colleagues, or sign on to one with an invite link."**

Six scenes instead of six; trimmed roughly 30% of words; the only "ye" left is in Stan's voice, not the user's reading. Scene 5 collapses two old scenes (5 + 6) because the Wall of Fame mention belongs with the earning explanation.

---

## 5. Empty states

Every `empty-card` in the app:

| Where | Current copy | Recommendation |
| --- | --- | --- |
| Home, no crews | `No crew yet.` / `Form one with your colleagues, or sign on with an invite link.` | Add a CTA scroll target: `▶ Form a crew below.` (anchor link to `#new-team-name`). The form is two panels away; first-time users miss it. |
| Team not found | `Crew not found.` / `You may have been pressed elsewhere, or the crew ID is wrong.` | "Pressed elsewhere" is flavour that loses non-pirate users. Replace with `You may have left this crew, or the link is wrong.` |
| Bounty board, all empty | `The bounty board is empty.` / `Post one yourself — your crewmates earn doubloons by covering you.` + link to post | Good — keep |
| Bounty board, filtered to a non-`all` filter with 0 hits | `No ${filter} bounties.` / `Switch the filter above to see other bounties.` | The label "no open bounties" / "no taken bounties" reads strange. Use `No bounties match this filter.` and reset filter as a button: `[ Show all ]` |
| Wall of Fame, no covers yet | `No covers yet.` / `The wall fills as crewmates earn doubloons by covering each other.` | Add CTA: `▶ Browse the bounty board` |
| Crew members, empty roster | `Empty roster.` / `Should never see this — refresh.` | The "should never see this" admission is for developers. Say `No crewmates yet. Try refreshing.` |
| Settings, non-manager | `Captain's quarters.` / `Only the crew manager can edit settings.` | Good |
| Chest, no ledger | `Your ledger is empty for now.` | Add `Post a bounty or take a voyage to start filling it.` |
| Tavern, no scrolls | `The tavern is quiet.` / `Send the first scroll to a crewmate who covered you well.` | Good |
| Meetings picker, no meetings | `No meetings in this window. (Cleared shore leave!)` | Charming, keep |

**One pattern to apply:** every empty state should end with a CTA verb. Today only ~40% do. The lowest-leverage empty state (`No bounties match this filter.`) becomes the most actionable if you add a reset chip.

---

## 6. Cloud Functions error strings — tone pass

Every user-facing `HttpsError` message bubbles up through `showToast(err.message, 'error', ...)`. The ones that feel developer-written:

| File | Current | Recommended |
| --- | --- | --- |
| `acceptCoverageRequest.ts:108` | `Bounty is ${status}, cannot accept.` | `This bounty is ${status} — only open bounties can be taken.` |
| `acceptCoverageRequest.ts:215` | `Day ${k} is already claimed by another crewmate.` | Good as-is but consider showing the *crewmate's name* if you can plumb it. |
| `cancelBounty.ts:55` | `Already cancelled.` | `Already cancelled — nothing to do.` |
| `cancelBounty.ts:69` | `Only the requester or a manager can cancel a bounty.` | Good |
| `cancelBounty.ts:44` (and many others) | `Not in this crew.` | Brusque. `You're not a member of this crew.` |
| `removeMember.ts:32` | `Use the leave flow instead of removing yourself.` | There is no "leave flow" yet — this hints at a feature that doesn't exist. Replace: `You can't remove yourself. Ask another captain to remove you, or leave the crew from your profile.` |
| `removeMember.ts:63` | `Cannot remove the crew owner.` | `The crew owner can't be removed. Transfer ownership first.` (note: transfer-ownership isn't a feature yet — either soften further or ship that feature) |
| `removeMember.ts:76` | `Cannot remove the last manager.` | `Promote another crewmate to captain before removing this one — the crew can't be left captain-less.` |
| `updateMemberRole.ts:68` | `Cannot demote the last manager.` | Same fix as above. |
| `forceCompleteBounty.ts:54` | `Cancelled — use the appropriate action.` | "The appropriate action" is hostile / unclear. Replace: `This bounty is already cancelled.` |
| `forceCompleteBounty.ts:40` | `Only managers can force-complete a bounty.` | Good |
| `createCoverageRequest.ts:175` | `Insufficient coins (need ${N}, have ${have}).` | Good — clear and quantitative. Could be friendlier: `You need ${N} doubloons but only have ${have}.` |
| `acceptCoverageRequest.ts:130` | `Requester has insufficient coins (have ${total}, need ${amount}).` | Friendlier: `The requester doesn't have enough doubloons to cover this bounty.` |
| `acceptCoverageRequest.ts:244` | `Requester is out of doubloons for this claim (have ${total}, need ${cost}).` | Same fix |
| `joinTeam.ts:40` | `Team not found.` | `Crew not found — the invite link may be wrong.` |
| `joinTeam.ts:50` / `createTeam.ts:41` | `User profile not initialized.` | Developer-tone. Replace: `Something's not right with your profile. Try signing out and back in.` |
| `generateBriefing.ts:71` | `No Gemini API key configured. Ask your crew manager to set one in Settings.` | Already the best one. Keep. |
| `generateBriefing.ts:145` | `Gemini API error (${status}): ${errText}` | Leaks raw HTML/JSON to the user. Truncate further and say: `The briefing service rejected the request (${status}). Try again in a minute.` |
| `getAuditLog.ts:48` | `Manager only.` | Too curt for an unintended-touch case. `Only the crew captain can see the audit log.` |
| Every `Sign in required.` | The token is `unauthenticated` — the user can't actually be unauthenticated and see a UI button at the same time, so this only fires on a Firebase auth glitch. Say: `Sign-in expired. Please sign in again.` |

**Cross-cutting fix:** `parsed.error.message` from Zod is straight-from-the-library and is *very* developer-tone (e.g. `"Required at \"teamId\""`). Wrap every Zod failure in a single helper and replace with `"Something went wrong with that form — refresh and try again."`. The diagnostic detail stays in `functions.logger`.

---

## 7. Form field labels — the post-bounty audit

The labels today:

- `Shore leave from` / `Returning by` — Good. Concrete, in-character, unambiguous.
- `Timezone` — Good.
- `What you're covered for · pick any` — Good label; "pick any" hint is the right length.
- `How reachable while away · pick any` — Good. "How reachable" is plain English; previously was just "Reachability".
- `Days to be covered · click to toggle` — Good. The hint is necessary because the UI affords are not obvious.
- `Coverage mode` — fine label; the radio-card copy beneath does the work.
- `Coverage scope · which accounts / responsibilities` — **Slightly TAM-y, slightly opaque.** "Coverage scope" is internal jargon. Recommend: `What you need covered · which accounts and responsibilities`. The placeholder `"e.g. Acme + 2 SMBs · my weekly 1:1s with BigCorp"` is gold — the most useful microcopy in the form, keep it.
- `Meetings to be covered` — Good
- `SLA the coverer should hold` — **The acronym is fine for the audience** (Google TAMs all know SLA), but "should hold" is awkward. Recommend: `Response time the coverer should commit to (SLA)`.
- `What counts as a real emergency? (optional)` — Excellent label — sets a serious tone in the right place. Placeholder `"Wake me only if Acme's production is down."` is great.

**Inline help paragraphs — are they earning their space?**

| Where | Current | Verdict |
| --- | --- | --- |
| Post tab intro | `${WEEKEND_MULTIPLIER}× multiplier on Saturdays and Sundays. Doubloons leave your chest and sit in escrow until a crewmate covers.` | Pulls weight. Keep. |
| Manage crew helper | `Paste a square image URL. Leave blank to use the default flag.` | Pulls weight. Keep. |
| Settings — key storage | `These settings only the manager can change. Secret keys are stored server-side and never returned to the browser — only metadata (last 4 chars, set date).` | Important. Keep. |
| Settings — Gemini | `Used by future AI-powered features (briefing extraction, smart bounty drafts).` | "Future" is misleading — briefing extraction is shipped. Update to `Used for AI bounty briefings (and future AI features).` |
| Settings — backfill | `The starter chest used to be 20 doubloons; it's now 125 (covers 25 business days). Top up any existing crewmate who got the old grant so everyone starts on the new floor.` | Pulls weight, but this is **only relevant during the legacy-grant transition**. Add `(Once everyone is at 125, this panel can be removed.)` so a future contributor knows when to delete it. |
| Bounty edit modal | `Dates + selected days are locked to keep the escrow contract intact.` | Pulls weight, but "escrow contract" is jargon. `Dates and days can't change — they're already paid for.` |
| Meetings picker (not-connected) | `Optional. Lets you pick which meetings the coverer should attend, with Meet/Teams/Zoom links included.` | Good. Keep. |
| Home — form a crew | `You become the quartermaster. Every crewmate starts with 125 doubloons — enough to cover 25 business days right away.` | "Quartermaster" appears nowhere else in the codebase — replace with `manager` for consistency. `You become the manager. Every crewmate starts with 125 doubloons — enough to cover 25 business days right away.` |
| Home — sign on | `Paste the crew ID (or invite link) a teammate shared.` | Good. Keep. |

---

## 8. "Doubloons" vs "coins" — inventory

The pirate-flavour intent is **doubloons**. The slip-ups:

| Where | Says "coins" / "coin" | Fix |
| --- | --- | --- |
| `app.js:580` toast title for unlock | `🪙` icon only — fine | n/a |
| `app.js:1011` cost calc internal var `totalCoins` | Internal — fine | leave |
| `acceptCoverageRequest.ts:130` | `Requester has insufficient coins …` | "doubloons" |
| `createCoverageRequest.ts:175` | `Insufficient coins (need ${N}, have ${have})` | "doubloons" |
| `app.js:2611` chest | `No doubloons yet — the chest will fill as you act.` | Already correct — keep |
| `LEDGER_TYPE_LABELS.stipendMint` = `"Crown's stipend"` | OK | keep |
| `notifs` (line 598) | `"Crown's stipend: +${N} doubloons (expire monthly)."` | Good — keep |
| `STAN_SCENES[3]` | `"…drops 11 more stipend coins in yer purse…"` | Inconsistent. Rewrite to "doubloons". |
| `app.js:202–205` (audio function names `coin()`) | Internal — fine | leave |
| `app.js:2118` header pill `title="Total doubloons in this crew"` | Correct | keep |

**Recommendation: standardise on "doubloons" in every user-facing string. Internal code variables can stay `coins`/`totalCoins` — that's a code-clarity-vs-language consistency tradeoff, and code clarity wins for variable names.** The grep-replace targets are the two HTTP-error strings above and the Stan scene.

---

## 9. Help page (`#/help`)

Currently in `renderHelp()` (line 2183), the help page is one panel with eight `<h3>` sections crammed into a single column. Critique:

- **Right length, wrong shape.** ~400 words is the right ballpark for a one-page reference, but cramming it into one panel means the user scans for "where do I look up X" and has to read everything. Section anchors would let users land on the answer.
- **Answers some new-TAM questions, misses others.** What it covers: economy, cost, posting, taking, ranks, scrolls, calendar, briefings. What it doesn't: "How do I cancel a bounty?", "What happens if my coverer disappears?" (force-complete), "Can I leave a crew?" (no — that's actually a missing feature, and the help page should be honest), "What does 'escrow' mean?" (the help page uses the word but never defines it), "Can I edit a posted bounty?" (yes, the doc should say so), "What's the difference between 'taken' and 'active'?".
- **Pirate density too high.** The help page is where worried users land. Less swagger, more clarity.

**Suggested sectioning rewrite** (anchors → headlines):

1. `#economy` — The doubloon economy (cost, starter chest, stipend)
2. `#posting` — Posting a bounty (single vs crew mode, scope, SLA)
3. `#taking` — Taking a voyage (browse, claim, payouts over time)
4. `#managing` — Managing your bounty (edit, cancel, force-complete, scrolls)
5. `#ranks` — Voyage rank & Wall of Fame
6. `#calendar` — Google Calendar integration (optional)
7. `#ai` — AI briefings (manager-configured)
8. `#captains` — Captain-only powers (settings, audit log, member admin, bonuses)
9. `#faq` — Common questions (3–5: "what if my coverer disappears?", "can I refund a bounty?", "what does escrow mean?", "can I leave a crew?")

Add a sticky table of contents on the left at desktop widths, collapsed at mobile.

---

## 10. Localization readiness

The app is template-literal English everywhere. If/when the project i18ns:

**Strings that need pluralisation handling** (the codebase currently hand-builds these — flag for an i18n library's plural API):

- `${days} day${days === 1 ? '' : 's'}` — appears at lines 1062, 1133, 1153, 1320, 1746, 1934, 1961, 2553, 2899, 2912, 2937, 2954
- `${members.length} crewmate${... === 1 ? '' : 's'}` — lines 2344, 2412, 2937
- `${voyages} voyage${... === 1 ? '' : 's'}` — lines 2899, 2912, 2954
- `min ago` / `h ago` / `d ago` (`timeAgo`, line 349) — date-relative formatting is locale-sensitive; ship with `Intl.RelativeTimeFormat` if you i18n.

**Strings interpolated with numbers that need locale-aware number formatting:**

- Every `${N} doubloons` — currently `${N}` is raw; in many locales (de-DE, fr-FR, es-ES) "125" should be displayed differently if it grows. Use `Intl.NumberFormat` once translation kicks off.

**Strings concatenated from multi-piece flavours that won't survive translation:**

- `'Added ${bits.join(' + ')} to your calendar.'` (1321) — the conjunction "+" won't translate. Use a list-formatter.
- `'Took ${days} day${s}. ${N} doubloons in escrow.'` (1062) — two-sentence message; treat each as an i18n key.

**Strings that lean on English idioms** and will need conceptual rewrites, not literal translations:

- `Anchors aweigh!` (1035), `the tavern echoes` (1339), `Your name will be sung in shanties.` (2587), `clearer shore leave!` — these are flavour and need creative translation, not literal.

**Strings that look like data but aren't:**

- `STATUS_LABEL`, `LEDGER_TYPE_LABELS`, `REACHABILITY_OPTIONS.short` and `.label`, `COVERAGE_KIND_OPTIONS.label`, `RANKS.name`, `ACHIEVEMENTS.name`, `MASCOT_LINES`, `STAN_SCENES`, `SKIN_OPTIONS.label/desc` — these are the *first* things to externalise. They're already structured as data; just move them into a `locales/en.json` and refer to them by key.

**Date/time formatting:** good news — `formatDate`/`formatDateTime` already use `toLocaleDateString(undefined, …)` and `toLocaleString(undefined, …)`, so they pick up the user's locale for free.

---

## 11. v1 copy diff — high-leverage swaps for one commit

Twenty-one specific changes the owner can ship before launch. Each is a literal find-and-replace (or near-enough).

1. `app.js:1823` — `primaryLabel = 'AYE'` → `primaryLabel = 'OK'` (the default landmine)
2. `app.js:2368` — Join CTA button `Aye` → `Sign on`
3. `app.js:1439` — `Aye, cancel` → `Yes, cancel bounty`
4. `app.js:3309` — `Aye, remove` → `Yes, remove from crew`
5. `app.js:3341` — `Aye, clear it` → `Yes, clear key`
6. `app.js:1874` — `Aye, next` → `Next ▸` (or `Next`)
7. `app.js:1440` / `app.js:3342` — `Nevermind` → `Never mind`
8. `app.js:823` — `Could not register your sailor card: ${err.message}` → `Could not finish sign-in: ${err.message}`
9. `app.js:1062` — `${N} doubloons in escrow.` → `You'll earn ${N} doubloons as the days pass.`
10. `app.js:1228` — `Calendar: ${err.message}` → `Couldn't fetch your calendar: ${err.message}`
11. `app.js:1339` — `🪶 Thank-you scroll sent. The tavern echoes.` → `🪶 Scroll sent — it'll show up in the tavern.`
12. `app.js:2357` — `You become the quartermaster.` → `You become the manager.`
13. `app.js:84` (STAN_SCENES) — full 6-scene rewrite (see §4)
14. `app.js:87` — Stan scene 4 mentions "stipend coins"; change to "stipend doubloons"
15. `app.js:1512` — `Dates + selected days are locked to keep the escrow contract intact.` → `Dates and days can't change — they're already paid for.`
16. `app.js:2997` (Settings, Gemini help) — `Used by future AI-powered features…` → `Used for AI bounty briefings (and future AI features).`
17. `app.js:2482` — Empty-bounty-filter copy → `No bounties match this filter.` with a `[ Show all ]` reset chip
18. `app.js:2932` — `Should never see this — refresh.` → `No crewmates yet. Try refreshing.`
19. `app.js:2386` — `You may have been pressed elsewhere, or the crew ID is wrong.` → `You may have left this crew, or the link is wrong.`
20. `createCoverageRequest.ts:175` — `Insufficient coins (need ${N}, have ${have}).` → `You need ${N} doubloons but only have ${have}.`
21. `removeMember.ts:76` & `updateMemberRole.ts:68` — `Cannot demote/remove the last manager.` → `Promote another crewmate to captain first — the crew can't be left captain-less.`

Bonus, if you're feeling brave: a 22nd swap. `cancelBounty.ts:44`, `removeMember.ts:48`, `sendScroll.ts:48`, `updateMemberRole.ts:43`, `forceCompleteBounty` chain — every `Not in this crew.` → `You're not a member of this crew.` That's the single most user-hostile string in the entire backend, and it appears five times.

---

## Closing thought

Vacaciones is one of those products where copy *is* the product — the pirate skin is the differentiator from the boring SaaS PTO tools that already exist. Don't dilute it, but don't let it block users either. The rule is: **users come for the pirate, but they leave for the friction.** A crisp "Yes, remove from crew" is more on-brand than a confusing "Aye, remove" — because the brand is "we respect your time", and that respect is what makes the pirate flavour feel earned instead of cringe.
