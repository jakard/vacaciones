# 16 — Product Excellence Synthesis

> Synthesizer's brief: read audits 12 (Apple HIG), 13 (industrial design),
> 14 (AAA game art), 15 (Google big-tech UX) end to end. Build the punch list
> the founder runs Monday morning. Take sides where the experts disagree.
> Audited at commit `61e661a` on 2026-06-01.

---

## Executive summary

The product is technically launch-able and emotionally not yet shippable to a senior TAM at Google. Across four lenses, the same indictment repeats: **the Pirate skin is the front door, and the front door is doing damage.** Three of four experts (Apple, industrial, Google UX) say demote it; the fourth (game art) says finish it to AAA standard or stop pretending. All four agree the parchment-pixel-shadow chrome is the loudest signal of "this is a passion project" and the easiest to fix. Underneath that, the actual P0 bugs are quiet: a `.bounty` CSS rule defined twice that breaks desktop layout, a timezone/UTC mismatch that silently drifts the doubloon economy at day boundaries, and a zero-notification posture that traps the product inside its own URL. Fix those three, demote the skin, distill the bounty card to three lines, and Time Off goes from "wait, this exists?" mocked to "wait, this exists?" celebrated. The rest is a year of polish — what to ship this quarter is on the punch list below.

---

## Top 10 punch list (ranked by agreement × severity × low effort)

### 1. Make Dark Knight the default skin; demote Pirate to an opt-in personality theme. P0 / S.

**Where:** `app/app.js:170-178` (`skin.current()` fallback to `'pirate'`); skin picker `app.js:1414-1436`; SKIN_OPTIONS `app.js:163-168`.

**Agreed:** Apple HIG (#1), Google UX (Finding 26), Game art (#9 option 1). Industrial design dissents *partially* — the Rams lens says the Pirate skin is the founder's identity and demotion is the wrong cut; commit to it instead. **Resolution:** the three lenses that talk about the user (Apple, Google, game) all converge — the user opening this in an enterprise context sees parchment and quits. The founder's identity has to survive *opt-in*, not by being inflicted on every first visitor. Add `prefers-color-scheme` autoselect, move skin selection out of header chrome into a Settings sheet, keep Pirate as the personality lever.

### 2. Wire outbound notifications — email digest, Slack/Chat unfurl, Calendar push. P0 / L.

**Where:** `app/app.js:656-697` (computeNotifications is bell-only); `functions/src/http/` contains no `send*Email`, no `notify*`.

**Agreed:** Google UX (Finding 3) as the single most-load-bearing fix. Game art and Apple HIG don't address this; industrial design doesn't address it. **It's flagged by only one expert — and outranks much of what three flagged — because it changes whether the product gets used at all.** Coverage decisions happen in Slack threads, mail threads, Calendar invites. A destination-only tool dies in production. Ship in three tiers; the email-digest layer is one day with Firebase Send Mail Trigger.

### 3. Fix the timezone / UTC mismatch silently breaking coverage cost and daily release. P0 / S.

**Where:** `app/app.js:362-375` (computeCoverageCost) + `app.js:380-382` (formatDateKey, UTC-only) + the editable-but-unread timezone field at `app.js:3108`; scheduled `dailyCoverageRelease`.

**Agreed:** Google UX (Finding 9). Solo finding — but it is a P0 because it is a correctness bug in the *core economy* doc 02 spent 9KB designing. A Tokyo TAM's bounty drifts a UTC day at boundary weeks; the cron credits doubloons in a window that doesn't match the requester's local week. Pick a canonical timezone per crew, key cost math and the release cron off `YYYY-MM-DD` in that TZ. Cheap; silent; embarrassing if a user catches it before you do.

### 4. Delete the duplicate `.bounty` CSS rule killing desktop layout. P0 / S.

**Where:** `app/styles.css:919` (canonical `grid-template-areas`) vs `app/styles.css:1216` (orphaned `grid-template-columns`); orphaned `.bounty-flag/.bounty-meta/.bounty-price` rules at `:1229-:1262` that `renderBountyCard` does not even emit.

**Agreed:** Industrial design (#2). Solo finding but unambiguous: a real CSS ghost, the second rule wins on desktop, every child `grid-area:` points at a non-existent region, the cards on `≥720px` render only because DOM order accidentally aligns. 30 minutes of work; the desktop layout the Mêlée Night doc actually described comes back online. Catches a real bug; can be fixed in the same PR as #5.

### 5. Distill the bounty card from 9-15 elements down to 3 lines. P1 / M.

**Where:** `app/app.js:2829-2905` (renderBountyCard); `app/styles.css:919-1020` (grid).

**Agreed:** Apple HIG (#10), industrial design (#4), game art (#8), Google UX (Finding 2). **All four experts independently flagged this with the same prescription**: avatar + name + status on line 1, dates + tz on line 2, price + CTA on line 3. Chips, scope, SLA already live in the existing detail modal (`app.js:2147-2169`). Game art adds the high-leverage delta: a 32px illustration band whose contents vary by coverage kind (envelope / calendar / flame), which requires the sprite sheet from item #6. Apple says do this in spring physics, not steps(). Google UX adds: ship a compact/comfortable density toggle persisted to localStorage.

### 6. Finish the sprite sheet docs/06 promised — replace OS-emoji rank, achievement, reachability, coverage-kind icons with hand-drawn 16×16 SVG. P1 / M.

**Where:** `app/app.js:103-112` (RANKS), `:115-124` (ACHIEVEMENTS), `:48-53` (REACHABILITY_OPTIONS), `:55-62` (COVERAGE_KIND_OPTIONS), `:3211-3215` (podium emojis). Header buttons at `app.js:2304-2305` (🎨 🔊 🔇).

**Agreed:** Apple HIG (#8), industrial design (#3), game art (#4, plus 24-sprite appendix). Google UX (#5) hits this from the copy side — "swap action verbs out of pirate" — same underlying problem of inconsistent vocabulary. The 🏴‍☠️ ZWJ sequence renders red-velvet on macOS Safari and a flat outline on Chrome on Windows (the modal Google TAM laptop); the rank emblem floats a 38px OS bitmap inside a 64×64 brass frame. Game art's appendix is the buy list — 24 sprites in the doubloon's four-tone palette. **Two days of pixel work** transforms the visual identity. Keep emojis only for celebratory copy ("Top covers in the last 90 days").

### 7. Add a Cmd-K command palette, j/k navigation, `?` cheat-sheet. P1 / M.

**Where:** `app/app.js:3759-3782` (current 23-line keydown handler with no `?`, no `Cmd-K`, no `j/k`, no `g b`).

**Agreed:** Google UX (Finding 1) as the single biggest "is this a serious tool" signal on day one. Solo finding — but it ranks high because (a) a TAM reflexively presses `?` within 20 seconds of landing, (b) Buganizer has had j/k since 2009 and that's the comparison set, (c) it's a single self-contained file (~250 lines) and unlocks every keyboard-driven user. Pair with `n` to Post Bounty, `g b/c/w/m/s` for tabs, `/` to focus `#bounty-search`.

### 8. Strip pirate framing out of action verbs, system messages, toasts — keep charm in the chrome, business in the buttons. P1 / S.

**Where:** `app.js:2694` ('Hoist'), `:2702` ('Aye'), `:2856` ('Take voyage'), `:1103` ('Anchors aweigh!'), `:1734` ('captain'/'crewmate' in role-change toasts), `:1407` ('The tavern echoes.'), `:2657` (`.toUpperCase()` on the user's first name), `:2745` (`.toUpperCase()` on team name).

**Agreed:** Google UX (Finding 5), Apple HIG (quick punch list §15, plus the ALL-CAPS storm at §3.2), game art (#19 the "RAUL" greeting). Industrial design tacitly agrees in the "warmth test" postscript. **The rule:** action verbs and system messages use professional English; decorative copy (page titles, empty states, Tavern, achievement names) keeps the pirate voice. Stripe-style separation between marketing voice and product voice. Concrete swaps: `Hoist` → `Create crew`, `Aye` → `Join`, `Take voyage` → `Cover` (the current label literally reads as "go on vacation" — the *opposite* of the action), `is now a captain` → `is now a manager`. Drop `.toUpperCase()` on user names.

### 9. Add GDPR delete-my-account, disband-crew, export-my-data + invite-token rotation. P0 / L (combined).

**Where:** `functions/src/http/` has no `deleteUser.ts`, no `deleteTeam.ts`, no `exportMyData.ts`. The removeMember modal (`app.js:3644`) says "wallet is sealed" i.e. data persists. Invite link uses raw `teamId` as the share token (`app.js:1396-1402`, joinTeam `app.js:1060-1072`), with a 125-doubloon onboarding grant and no revoke / cap / approval gate.

**Agreed:** Google UX (Findings 10 + 11) — both are P0/P1 launch-review gates. Solo finding from one expert, but a Google internal launch-review will *not* clear this. Pair them in a single PR: self-service "Delete my account" under avatar menu; manager "Disband crew" in Settings; CSV-extending JSON export; rotating expiring capped-uses `crew_invite_token` separated from the database doc-id. Without this, Time Off ships behind a "beta" label for 14 months while legal works through it.

### 10. Strip the four-shadow chrome stack — three tiers of elevation, not one. P1 / M.

**Where:** `app/styles.css:232-242` (`.panel`), reused on `.team-card` (`:625`), `.bounty` (`:919`), `.create-card` (`:1276`), `.ledger li` (`:1156`), `.wallet-panel`, `.member-card` (`:2052`), `.scroll` (`:2406`), `.empty-card` (with dashed border-image at `:707-730`), `.modal` (`:2555`).

**Agreed:** Apple HIG (#2), industrial design (#1). Game art doesn't address chrome elevation directly but its overall "commit to one material" thesis (#9) implies it. **Both experts give the same prescription**: introduce `--elev-1..--elev-4` tokens at `:root`, apply by role (list row vs card vs floating menu vs sheet), and reserve the full bevel for the *single most important* container on each screen. Dark Knight already nails the modern pattern at `styles.css:3580-3586` — promote it to the universal base. Same PR: kill the dashed pirate-stitching border on `.empty-card` (it is the loudest decoration in the codebase).

---

## Conflicts and resolutions

### Conflict 1: Apple restraint vs. game-art juice

- **Apple HIG (#6):** every transition is `steps(N)`, which is pixel-art animation discipline; replace with spring physics, 120ms cubic-bezier(0.22,1,0.36,1) for buttons, 350-500ms eased curves for sheets. Linear/stepped motion belongs only on loading indicators.
- **Game art (#3):** finish the harbor scene's promised three-frame torch flicker, lantern flicker, wave parallax, crab sidestep, laptop cursor blink — *all `steps()` to honor the existing motion language.*

**Tension:** one expert wants spring physics everywhere; one wants stepped motion as the product's signature.

**Resolution — take game art's side, scoped.** Apple's prescription is correct for affordance feedback (buttons, sheets, toasts, focus rings) and that's where spring/eased motion goes. But the harbor scene, the coin shower, the empty-state turtle, the loading doubloon — those are diegetic, hand-crafted illustration. They earn their `steps()`. Make the rule explicit: **eased motion on UI affordances, stepped motion on illustration**. Apple HIG itself concedes this at §6 ("on the Pirate skin only keep the stepped motion for the loading doubloon and the coin-float — where the chunked motion is diegetic"). Game art's harbor animation list is the most concrete one-day win on the audit and it would be silly to lose it to spring-physics dogma.

### Conflict 2: Demote skins to two vs. commit to four as four "places"

- **Apple HIG, Google UX:** four skins reads as brand confusion. Demote to Pirate (default for delight) + High Contrast (a11y). Move Basic + Dark Knight behind a settings flag.
- **Google UX dissents from itself:** simultaneously argues default = Dark Knight, Pirate = opt-in personality (Finding 26 vs. earlier section).
- **Game art (#9):** Option 1 — demote skin to a developer toggle, default Dark Knight for TAMs, Pirate as `?skin=pirate` Saturday Mode. Option 2 — commit to all four but make each a *place* (Pirate = harbor, Dark Knight = captain's quarters at night, Basic = harbormaster's logbook, HC = the lighthouse). Option 2 = 3 weeks; option 1 = 2 hours.
- **Industrial design:** doesn't argue for demotion; argues each skin needs more identity (#18 Dark Knight lacks a moment).

**Tension:** Apple/UX want fewer skins; game art wants either fewer or fully-finished four; industrial design wants more identity per skin.

**Resolution — take Apple + Google UX's side now; game art's option 2 only if the founders commit to a 3-week sprint.** Default = Dark Knight on first visit (or follow OS dark/light preference). Pirate becomes opt-in. Basic and HC stay as principled accessibility / preference choices. The Dark Knight skin gets *one* identity moment in the same pass (industrial design #18: a single amber lantern flicker or the `> _` terminal cursor — pick one). Option 2's "four places" is a six-month investment and not on the launch-gate critical path.

### Conflict 3: Bounty card needs an illustration band vs. bounty card needs to be a quiet table row

- **Game art (#8):** distill to three lines AND add a 32px hand-drawn illustration band varying by coverage kind. Hands the bounty board a visual identity.
- **Apple HIG (#10), industrial design (#4):** distill to three lines, no illustration. Apple list-row model — avatar, title+meta, right-aligned price.
- **Google UX (Finding 2):** add a compact/comfortable density toggle. Compact = one table-shaped row with no illustration, 22 per fold.

**Tension:** illustration band fights table density.

**Resolution — ship Apple + Google UX's version first; add game art's illustration band only on the "comfortable" density mode.** Power users will use compact (22 cards per fold beats 5). The comfortable mode keeps the illustration band — the kind chips of the bounty have a single hand-drawn 32×24 sprite. The detail modal already carries the chips/SLA/scope so nothing is lost. **This is the unifying answer**: density toggle is the unlocking primitive — illustration ships in the comfortable mode, table ships in the compact mode, both are useful, both ship in the same PR.

### Conflict 4: Add a Commodore promotion cinematic vs. stop animating empty things

- **Game art (#21):** ship the Commodore rank promotion as the share-moment screenshot — full-screen scene, avatar walks onto the ship, wordmark expands to "COMMODORE OLWEN," rank emblem floats up, 5 seconds, one-time only. The single highest-leverage art-direction asset.
- **Apple HIG (#15):** the mascot turtle bobs in 2-frame `steps(2)` on every chrome surface; remove it from the chrome entirely, reserve it for empty states only. Strip decoration that doesn't earn its keep.
- **Industrial design (#23):** even reduce-motion should still play the coin shower as a 200ms opacity fade — the affordance is too important to disappear.

**Tension:** Apple wants less motion in chrome; game art wants more motion at the right moments; industrial design wants motion to *mean* something.

**Resolution — all three are consistent, not conflicting.** The principle is: **motion serves information**. Strip motion that decorates (turtle bobbing on every screen; coin float on +N text that travels away from the wallet). Reserve motion for moments that transact information (coin sprites flying *toward* the wallet; Commodore promotion as the one-time celebration; rank-up animations; achievement bursts for milestone unlocks only — toasts for trivial ones). The Commodore cinematic does not contradict Apple; it embodies what Apple calls "motion as meaning."

### Conflict 5: Charm everywhere vs. business in CTAs

- **Industrial design postscript:** the warmth is in the *copy* (doubloon vocabulary, Cabin Boy → Commodore, the Crown's stipend). Keep every word.
- **Google UX (Finding 5):** action verbs and system messages use professional English; decorative copy keeps the pirate voice. `Hoist` → `Create crew`.
- **Game art (#19):** drop `.toUpperCase()` on user names so the greeting feels like a greeting, not a summons.

**Tension:** the Rams lens says copy is the warmth's home; the Google lens says copy on CTAs is the warmth's failure.

**Resolution — Google UX wins on action surfaces; industrial design wins on narrative surfaces.** The line is precise: **chrome (CTAs, system errors, toasts, form labels, navigation) = professional English. Narrative (page titles, empty states, the Tavern, achievement names, rank names, Stan dialog) = pirate voice.** Stripe and Buganizer both ship this discipline. The audit list of swaps in item #8 is exactly this rule applied. The pirate vocabulary survives in five places and disappears from five others.

---

## Launch gate — the minimum bar for an internal Google pitch

Before this is shown to anyone above the founder's own skip-level, all of the following must be true:

1. **Default skin is not Pirate.** `skin.current()` defaults to `dark-knight` or follows `prefers-color-scheme`. Pirate is opt-in.
2. **The `.bounty` duplicate CSS rule is deleted.** Desktop layout matches the Mêlée Night doc's intent. (#4 above)
3. **Coverage cost and daily release respect a per-crew canonical timezone.** No silent day-boundary drift. (#3 above)
4. **Outbound email digest works.** At minimum: 8am daily digest "N open bounties, M doubloons available this week" + per-event emails on `created` / `accepted` / `completed`. Slack and Calendar can wait six months. Email cannot. (#2 above)
5. **Self-service delete-my-account exists.** Manager "Disband crew" exists. Data export (JSON) exists. (#9 above)
6. **Invite link is not the database doc-id.** Rotating capped-uses token under `teams/{tid}/private/inviteTokens`. (#9 above)
7. **Bounty card is three lines.** Chips, scope, SLA live in the detail modal only. (#5 above)
8. **`Hoist`, `Aye`, `Take voyage` are renamed.** Action verbs and system messages use professional English. (#8 above)
9. **The four-shadow bevel stack is gone from secondary surfaces.** Three elevation tiers, not one. The dashed pirate-frame on `.empty-card` is gone. (#10 above)
10. **Rank emblems, achievement icons, coverage-kind icons, reachability icons are not OS emoji.** Hand-drawn SVG in the doubloon palette, minimum 16 sprites authored. (#6 above)
11. **The header carries brand + bell + avatar only.** Coin pill, rank chip, sound toggle, skin toggle, sign-out move into a Profile sheet or onto the Wallet tile.
12. **Mobile touch targets are 44×44.** Bell, sound, theme, avatar at `@media (max-width: 720px)`. (industrial design #17)

That is twelve items, not five. It is the minimum because each gap on this list is something a Google L5 reviewer will ask about, write down, and use as a reason to defer. Ship all twelve and the pitch lands. Ship eight of twelve and you are back in two months. Ship five of twelve and the demo gets back-channel feedback that never reaches you.

---

## Themes the audits revealed

1. **The Pirate skin is doing damage that the founder cannot feel.** Three experts arrived at it independently. The skin is the founder's identity expression; the user experiences it as cosplay. Demotion is not betrayal — it is the move that lets the pirate voice survive at all, in the places where it earns its keep (Tavern, rank names, empty states).

2. **The chrome is shouting at the same volume everywhere.** Four-layer box-shadow on every surface (`.panel`, `.team-card`, `.bounty`, `.modal`), five fully-saturated status badge colors, six different "you" indicators, five empty-state turtles, ALL-CAPS labels on every chip/badge/tab/button. The eye has nowhere to land. The fix is universal: pick a hierarchy, demote the secondary, and let one thing be loud on each screen.

3. **Motion is decoration where it should be transaction.** The `+N` coin float spawns at the wallet and travels *away*. Achievements toast like a Slack notification. The Wall of Fame podium has equal-weight tiles. The harbor scene is a still painting of a living world. The fix is the same one in four places: motion should serve information, and the highest-leverage information is "where did your money go" and "you achieved something rare."

4. **Time Off is a destination in a world of channels.** Coverage decisions happen in Slack, mail threads, Calendar invites. The bell is a 2014 model. The product needs to render its notifications in three places: in-app bell, email digest, Slack unfurl. Until then, every user has to remember to visit.

5. **Manager surface is wedding-website-grade.** One setting (Gemini key), one button (backfill), one read-only audit log, four per-member actions. No filters, no bulk, no export, no transfer-ownership, no crew economy panel. The TAM lead who screenshots their team's spend into `#tam-leads` is the evangelism mechanism. The current Settings tab gives them nothing to screenshot.

6. **The doubloon SVG is the proof of what good looks like.** The 16×16 four-tone coin in `index.html:16-32` is shipping-quality; every other "pirate" asset is OS-emoji rendered through the user's font table. Finishing the sprite sheet from `docs/06` (24 sprites in the same vocabulary) takes two days and moves the product from "themed software" to "designed object." Three of four experts independently call this out as the single highest-leverage art-direction move.

7. **There are silent correctness bugs hiding under the visual ones.** The duplicate `.bounty` rule. The timezone/UTC mismatch in cost math. The single-token bell read-state. The team-ID-as-invite-token security hole. The launch readiness conversation has been about polish; these are real bugs that need P0 attention before polish.

---

## What to NOT do (anti-recommendations from the conflict resolutions)

1. **Do not strip warmth from the product to "look serious."** The Rams lens is right that the copy carries the warmth — the doubloon vocabulary, Cabin Boy → Commodore, the Crown's stipend, the Tavern, achievement names — and those *all stay*. The cut is surgical: chrome reverts to professional English, narrative stays piratey.

2. **Do not replace `steps()` animation everywhere with spring physics.** Apple's prescription is correct for UI affordances and wrong for illustration. The harbor scene's torch flicker, lantern flicker, crab sidestep, and the loading doubloon stay stepped. That is the discipline. Spring goes on buttons, sheets, focus rings, modals.

3. **Do not commit to "four skins as four places."** Game art's option 2 is a 3-week sprint that does not fit on the launch-gate critical path. Default to Dark Knight, ship the Pirate skin as a polished opt-in personality theme, leave Basic and HC as accessibility choices, defer the four-places narrative.

4. **Do not delete the Commodore promotion celebration to satisfy "less motion."** Apple's "remove decoration that doesn't earn its keep" is the same rule as game art's "ship a one-time cinematic for the single most prestigious moment." Both are saying motion = meaning. The Commodore moment earns its frames.

5. **Do not drop achievement / rank gamification to "ship faster."** Google UX's Phase-1 scope cut suggests achievements are "cute, low value, doesn't influence behavior." That is the cynical read. The Rams reading is correct: achievements are recognition decoupled from currency, and they are the warmest non-Tavern moment in the product. Trim the unlock toast (#8) into a tiered burst (#5 game art), don't strip the system.

6. **Do not pursue the doubloon-as-recognition-only A/B (Google UX #29) before the gate clears.** That is a strategic philosophy debate worth having post-launch with data, not a precondition to shipping. Doc 02 already designed for recognition-coded behavior; ship the existing model.

7. **Do not commission a 24-sprite sheet without first auditing which 8 ship the most leverage.** Game art's appendix lists 24 sprites; the launch gate needs 16 of them (8 ranks + 6 coverage-kind + 2 reachability). Defer the Tavern reaction sprites, the parrot mascot, the empty-state pose set to the second sprint.

8. **Do not promote Post Bounty out of the tab nav into a primary header button alone.** Industrial design #24 and Google UX (Finding 21 by implication) both argue for it. But the gate also calls for a Cmd-K command palette (item #7), and `n` from anywhere going to Post Bounty (Google UX Finding 1) eclipses the header-button discoverability question. Ship the keyboard surface first; the tab-vs-button question becomes lower priority once keyboard works.

---

*Synthesis prepared 2026-06-01. Source audits: docs/12 (Apple HIG), docs/13 (industrial design — Rams/Fukasawa/Ive), docs/14 (AAA game art direction), docs/15 (Google big-tech UX through Buganizer/Critique/Moma lens). All findings traceable to source-line citations in the audit reports.*
