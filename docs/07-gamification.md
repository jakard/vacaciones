# Vacaciones — Gamification Design Doc

**Status:** Design proposal, v0.1
**Audience:** Owner / PM / design partner
**Scope:** The game-feel layer on top of the existing coin economy. No production code.

---

## 0. Design posture

Before mechanics, three commitments that decide every downstream call:

1. **The product's real job is to make TAMs comfortable taking time off.** Every game mechanic must pass the test: *does this make someone more or less likely to take their vacation?* If a mechanic risks discouraging absence, it gets cut, no matter how fun it sounds.
2. **Pirate framing is theatre, not theme park.** The vocabulary, art, and sound design lean Monkey Island. The *logic* underneath stays calm, professional, and explicable to an L+1 manager who has never played a video game. The fiction is a wrapper, not a maze.
3. **Intrinsic over extrinsic.** Research consistently shows that gamification systems built purely on points/badges/leaderboards as controlling rewards undermine the very motivation they try to build ([Self-Determination Theory in gamification](https://link.springer.com/article/10.1007/s11528-024-00968-9); [Habitica counterproductive effects study](https://www.sciencedirect.com/science/article/abs/pii/S1071581918305135)). We design for **autonomy** (your choice to cover or not), **competence** (visible mastery of TAM craft), and **relatedness** (your crew sees you), and we treat points as feedback, not bait.

Reference frameworks we lean on:

- **Octalysis** (Yu-kai Chou) — we deliberately target the *white-hat* core drives (Epic Meaning, Development & Accomplishment, Empowerment of Creativity, Social Influence) and keep the *black-hat* drives (Scarcity, Unpredictability, Loss & Avoidance) on a short leash. ([Octalysis overview](https://yukaichou.com/gamification-examples/octalysis-gamification-framework/))
- **Fogg Behavior Model (B = MAP)** — we design the *prompt* in low-friction moments where motivation and ability already exist (e.g. PTO request is being created → "post a bounty?" prompt right there). ([B=MAP explainer](https://medium.com/@omforux25/fogg-behavior-model-b-map-the-3-simple-keys-to-driving-user-action-9efdd9cc9644))
- **Self-Determination Theory** — autonomy, competence, relatedness as the three boxes every mechanic should check at least one of.

---

## 1. Gamification mechanics inventory

> "Effort" assumes 1 backend + 1 frontend dev working in the existing codebase. "Risk" is *workplace risk*, not technical risk.

| # | Name | What it does | Behavior it incentivizes (+ anti-behavior) | UI surface | Effort | Risk |
|---|---|---|---|---|---|---|
| 1 | **Voyage Log (XP & Captain's Rank)** | A separate, non-spendable XP score climbs as you cover voyages. Ranks: Cabin Boy → Deckhand → Bo'sun → First Mate → Quartermaster → Captain → Commodore. | Recognizes career-scale contribution without inflating spendable balance. **Anti:** people optimizing for XP could over-cover and skip *their own* PTO. Mitigation: XP also accrues, smaller, from *taking* PTO that was successfully covered. | Profile card; tiny rank pip next to name in every list. | Medium | Medium — must reward both sides of the trade |
| 2 | **Ship's Logbook (achievements)** | One-time named badges for narrative milestones: *Maiden Voyage* (first cover), *Letter of Marque* (first time covering a P1 escalation), *Mended Sails* (covered a vacation that had no other takers for 24h), *Crew Builder* (referred a teammate who joined), *Shore Leave* (took 5+ days of your own PTO this quarter, covered). | Reinforces a wide variety of good behaviors, not just "cover more". Per Stack Overflow research, dispersed small badges beat one big one. **Anti:** badge-hunting can crowd out judgment ("I'll cover a P1 just to get the badge"). | Profile tab "Logbook"; one-line toast at the moment of earning, with the post that triggered it (Stack Overflow's key fix from 2010). | Medium | Low |
| 3 | **The Tides (daily payout celebration)** | Existing daily cron payout becomes a small in-app event: "The tide is in." A subtle coin-clink sound on the next app open, with a "+10 doubloons earned overnight while you slept" card. | Turns invisible accrual into felt reward — competence feedback in SDT terms. **Anti:** none meaningful, this is just dressing up an event that already happens. | Home / treasure chest screen on first open of the day. | Small | None |
| 4 | **Captain's Orders (weekly quests)** | 2-3 lightweight, system-generated quests per week. Examples: "Cover one weekend day", "Post a bounty 14+ days in advance", "Thank a crewmate who covered you". Small doubloon reward + Logbook stamp. | Steers toward *healthy* behaviors (advance planning, gratitude, weekend coverage) rather than raw volume. **Anti:** quests that nudge people to cover when they shouldn't. Rule: a quest can never require covering, only *being open to* covering or *taking your own PTO*. | "Captain's Orders" card on home; resets Monday 09:00 local. | Medium | Medium — quest content needs review |
| 5 | **Avatar & Cosmetics (the Tailor's Shop)** | Coin-purchasable cosmetic items for an 8-bit pirate avatar: hats, coats, parrots, eyepatches, peg leg, ship background. Some items unlocked via Logbook badges, not coins. | Gives spendable coins somewhere to go besides hoarding; lets users express identity without leaking into real career data. **Anti:** pay-to-look-cool can feel hollow; mitigate by making the rare items achievement-gated, not price-gated. | "Tailor's Shop" tab; avatar shows in leaderboard and feed. | Large (art is the cost) | Low |
| 6 | **The Crew's Hold (team treasury, optional)** | A team-level shared coin pool that crew members can voluntarily tip into; funds team-only cosmetic banners or a quarterly real-world perk (lunch, swag). | Builds relatedness, gives a pro-social home for excess coins. **Anti:** social pressure to tip in. Mitigation: tipping is private; only aggregate visible. | Crew page; opt-in. | Medium | Medium — needs clear opt-in / opt-out |
| 7 | **Bounty Board (request listing reframed)** | The list of open coverage requests rendered as a cork board with pinned scrolls. Each "bounty" shows: dates, region, sketch of difficulty (👤 / 👤👤 / 👤👤👤), reward in doubloons. | Makes the open queue feel browseable and inviting. **Anti:** difficulty stars could stigmatize "hard" clients. Use a neutral icon (anchor count?) and never expose client names in the marker. | Main "Bounties" screen, primary nav. | Small (mostly visual) | Low |
| 8 | **Storm Events (rare multipliers)** | 1-2 times per quarter, the system runs a 5-7 day "Storm" with a 2x or 3x doubloon multiplier on *unfilled* bounties that were posted >7 days in advance. Announced one week ahead. | Clears the backlog of hard-to-fill requests; rewards covers that matter most. **Anti:** if predictable, people hoard requests for storms. Mitigation: Storms only multiply *previously posted* requests, never new ones, and are RNG-triggered within a window. | Banner on home + push; "Storm" badge on eligible bounties. | Medium | Medium — needs design review for fairness |
| 9 | **The Tavern (recognition feed)** | A team-scoped activity feed: voyages completed, ranks earned, thanks given. Users can leave a one-emoji "toast" on any entry (no full comments, no reactions race). | Visibility for good behavior; relatedness. Per HeyTaco research, ranking by *giving* (not receiving) increases helping behavior — so we surface "most generous toaster of the week" instead of "most toasted". **Anti:** popularity contests, exclusion of quiet contributors. | "Tavern" tab; ephemeral, last 14 days only. | Medium | Medium |
| 10 | **Thank-You Scrolls (peer recognition)** | After a voyage ends, the covered person gets a one-tap prompt: "Send a scroll to {coverer}?" Sends a short, warm, non-monetary thank-you (with an optional canned doodle). | Closes the loop emotionally. Per Bonusly/HeyTaco research, peer recognition is where culture is built — but we deliberately *don't* attach coins to it, to keep it sincere. | Post-voyage modal; appears once, dismissible. | Small | Low |
| 11 | **The Map Room (personal stats)** | A private dashboard: doubloons earned/spent, PTO days taken vs. eligible, voyages completed, average notice given. | Self-knowledge → competence feedback. The PTO-taken stat is the most important one and gets the largest font. **Anti:** if exposed to managers, becomes surveillance. Strictly private. | Profile → Map Room. | Small | High if leaked to managers — must stay user-only |
| 12 | **Captain of the Month** | One per crew, chosen *not* by coin count but by a blended score: voyages completed × thank-yous received × bounties posted with healthy notice. | Captures quality, not just volume; named explicitly to dilute leaderboard fixation. **Anti:** still a ranking. Mitigation: rotate categories (see #14), and "Captain" is honorific, no extra perks beyond a profile flair. | Crew page; announced 1st of month. | Medium | Medium |
| 13 | **Easter Egg: The Monkey** | Konami code on the home screen reveals a tiny pixel monkey who says one of ~40 lines of advice ("Look behind you, a three-headed PM!"). Pure flavor. | Delight; signals personality without taxing daily UX. | Hidden. | Small | None |
| 14 | **Wall of Fame (leaderboard, redesigned — see §4)** | Multiple rotating, narrow leaderboards instead of one master ranking. | See §4. | Home → "Wall of Fame". | Medium | Medium |
| 15 | **End-of-Quarter Awards Ceremony** | Quarterly in-app screen takeover: a parchment scroll names 5-7 quarter awards — *Most Voyages*, *Steady Hand* (most consistent notice given), *Lifesaver* (covered most last-minute bounties), *Shore Leave Champion* (took the most PTO without leaving gaps). | Drives anticipation, gives multiple paths to recognition, *explicitly celebrates taking PTO*. | One-time full-screen on first open after quarter end. | Medium | Low |

---

## 2. Pirate framing — translation table

Don't pirate-ify literally everything. Anywhere money, HR, or escalation language touches reality, **stay neutral**. The fiction lives in the verbs and the cosmetic layer, not the legal layer.

| Real concept | Pirate-frame term | Where it's safe / unsafe to use |
|---|---|---|
| Coins (the currency) | **Doubloons** | Safe everywhere. Short, recognized, fits Monkey Island. (Pieces of eight is more authentic but too clunky in dense UIs.) |
| Wallet / balance | **Treasure chest** | Safe on home screen. In transaction history, just say "balance" to keep audit clarity. |
| Monthly stipend (10 coins) | **Crown's stipend** (the user is a privateer with a letter of marque, getting a monthly retainer from the Admiralty) | Safe. *Avoid* "grog ration" — implies alcohol, awkward at a workplace. |
| Onboarding grant (20 coins) | **Signing purse** | Safe. |
| Expiry of unspent stipend | "The Crown reclaims unused stipend at month's end." | Safe but state it plainly the first time; don't make it cute. |
| Daily payout from coverage | **The tide brings doubloons** | Safe in animation; in the ledger, "daily payout". |
| 1-coin transaction fee | **Harbormaster's fee** | Safe — short, in-fiction, explains *why* a fee exists. |
| Coverage request | **Bounty** (when posting) / **Voyage** (when accepted) | Safe. The two-word system captures the lifecycle: a bounty is *posted*, a voyage is *sailed*. |
| Person being covered | "Bounty poster" / sometimes "the client" inside the voyage view | Don't try to pirate-ify the *person*. They're not a "merchant" or "captive". |
| Coverer | **Crewmate sailing the voyage** / informally **the mercenary** | "Mercenary" is fun in copy ("Need a mercenary?") but *never* used as a label in serious flows. |
| Team | **Crew** | Safe everywhere. |
| Manager | (leave neutral: "your manager") | **Do not** call managers "Captain". Power dynamic + game frame = mockery risk. Reserve "Captain" only for the *peer-elected* Captain of the Month. |
| Skip-level / leadership | (leave neutral) | Same reason. Do not pirate-ify the org chart. |
| Leaderboard | **Wall of Fame** (sometimes **The Roster**) | Safe. |
| Achievement | **Logbook stamp** | Safe. |
| XP | **Sea-time** | Safe. |
| Rank (XP-based) | **Voyage rank** (Cabin Boy → Commodore) | Safe. *Distinct* from job title — and we say so. |
| Quest | **Captain's Orders** (system quests), **Bounty** (peer requests) | Safe. |
| Notification | **Spyglass** (the icon) / **dispatch** (in copy) | Safe, optional. |
| Onboarding | **Maiden Voyage** | Safe. |
| Settings | (leave neutral: "Settings") | Don't pirate-ify config. People panic when they can't find Settings. |
| Privacy / data export | (leave neutral) | Same. |
| Escalation / P1 incident | (leave neutral) | Do not call a customer crisis a "kraken" in any user-facing flow. Pirate flavor in serious moments reads as dismissive. |

**Rule of thumb:** if a screen could appear in a screenshot during an HR conversation, strip the pirate flavor from that screen.

---

## 3. Onboarding game loop — first 5 minutes

The user has just signed in with their Google account. They have no crew. They have 20 doubloons in their signing purse. The goal of this loop is to leave them with: a sense of place, one completed action, one promised future reward, and a single concrete next step.

### Scene 1 — Arrival on Mêlée (0:00–0:30)
- Pixel ship pulls into a port. Brief animation, skippable on tap.
- Title card: **"Welcome aboard, {first name}."**
- Voice (text-only): a single NPC, **Stan the Harbormaster**, in a small chat bubble: *"Fresh face, eh? Sign the ledger and I'll show you the ropes. Won't cost you a doubloon."*
- One CTA: **Sign the Ledger**.

> **NPC choice:** A *single* recurring NPC is enough. Stan is loud, mercantile, faintly absurd — recognizable to Monkey Island fans, parseable to everyone else as "the helpful guy in a tutorial". He does *not* talk like a pirate ("yarr"). He talks like a fast-talking salesman who happens to wear a tricorn. This keeps copy readable and translatable.

### Scene 2 — The signing purse (0:30–1:00)
- Treasure chest opens on-screen. Coins clink. **20 doubloons** appear in the corner with a small "+20" counter.
- Stan: *"That's your signing purse. The Crown gives you ten more on the first of every month — so don't sit on 'em, they expire."*
- One CTA: **Got it.**

### Scene 3 — Find your crew (1:00–2:30)
- Stan: *"Now. No pirate sails alone. Who're you with?"*
- The app shows a search box with a hint based on the user's Google Workspace org unit — *"Looks like you might be with the GCP Retail TAM crew. That right?"*
- User picks an existing crew or creates one.
- **Quest completion:** *Logbook stamp: "Found a Crew."* Toast appears with a +5 doubloon reward.
- Stan: *"Welcome to the {crew name}. They're a good lot. Mostly."*

> **If no obvious crew:** offer "Sail solo for now" — does not block onboarding. A solo user can still post and accept bounties; they just don't have a Tavern feed yet.

### Scene 4 — The board (2:30–4:00)
- Stan walks the user to the **Bounty Board** with a literal pointing animation.
- Two demo bounties are pinned: one in their crew, one cross-crew.
- Stan: *"This is where you'll find work, and where you'll post when you need cover. Want to give it a spin? Post a fake bounty — I'll buy it back."*
- The user is walked through posting a *practice bounty* (dates locked to a test window). On completion, Stan "buys" it.
- **Quest completion:** Logbook stamp *"Maiden Voyage Posted"* + 5 doubloons.

### Scene 5 — Your map and the goodbye (4:00–5:00)
- Stan: *"Last thing. Your Map Room — that's where you'll see your doubloons, your voyages, and your shore leave. Take it. The Crown's not paying you to skip vacations."*
- A subtle but unmissable card: **"Shore Leave Tracker — 0 days taken this quarter. Aim for {X}."** (Where X is their org's recommended quarterly PTO.)
- Stan: *"Now: post a real bounty when you've got time off coming. The crew'll handle it."*
- Final CTA: **Open the Bounty Board.**

### What the user leaves with
- 30 doubloons (20 signing purse + 10 onboarding quest rewards)
- 2 Logbook stamps
- Membership in a crew (or known solo status)
- One concrete next step ("post a real bounty")
- Implicit message: **the app wants you to take time off.**

---

## 4. The Wall of Fame — leaderboard, redesigned

The existing 90-day "coins earned" leaderboard, in its raw form, is a flawed mechanic for this product. Three problems documented in the research:

1. **Bottom-rank demotivation.** 31% of users in leaderboard-only systems report negative effects; lower performers feel cumulative failure. ([JMIR Serious Games](https://yukaichou.com/advanced-gamification/how-to-design-effective-leaderboards-boosting-motivation-and-engagement/))
2. **Wrong incentive.** Ranking by *receiving* (here: coins earned by covering) suppresses helping behavior; ranking by *giving* increases it ([HeyTaco research](https://heytaco.com/research/designing-peer-recognition-for-engagement)).
3. **Equity gap.** TAMs with little PTO to post can't compete on coin earnings — junior or recently-hired employees especially.

The redesign: **stop having one leaderboard.** Have a rotating Wall of Fame with multiple narrow boards, each celebrating a different virtue.

### What the user sees
- Tab labeled **"Wall of Fame"**, illustrated as a tavern wall of framed portraits.
- **Top section: This Week's Captain** — single highlighted portrait of the user who scored highest on a *rotating weekly category*. Categories cycle: Most Voyages Sailed, Steadiest Hand (best notice given when posting), Most Generous Toaster (most thank-you scrolls sent), Storm Chaser (during a Storm event week).
- **Middle section: The Top Three Crews** — crews ranked by *aggregate* voyages completed in the last 30 days, normalized for crew size. Team-level, not individual.
- **Bottom section: Personal Best wall** — *the user's own portraits and stamps over time.* Always shows them at the "top" of their own wall. (This is the relative/personal-progress fix from leaderboard research.)
- **Hidden by default:** the global 90-day all-doubloon ranking still exists in the database (you want it for ops), but it's behind a "See the Global Roster" button, not the front door.

### Specifics
- **No bottom-ranked names ever appear.** No "you are #427 of 600." Period.
- **Weekly Captain stays up for 7 days,** then moves to a small "Past Captains" gallery scroll. No accumulation race.
- **Captain of the Month (mechanic #12)** is the named, per-crew flagship — peer-visible, but one per crew, recognizing different virtues each month.
- **Quarterly Awards Ceremony (mechanic #15)** is the big moment.
- **Opt-out** on every public surface. A user can hide from the Wall of Fame at any time, no questions asked. (SDT autonomy.)

---

## 5. Notification & feedback moments

Calibrated to fire **at most ~3 user-visible game-feel events per day** on average. Anything denser than that becomes wallpaper. Most are in-app only; push notifications are reserved for the times listed as **PUSH**.

| Trigger | Feedback | Sound? | Why |
|---|---|---|---|
| First app open of the day | Tide animation + "+N doubloons earned overnight" card | Yes (one coin clink) | Felt reward for invisible accrual |
| You accept a bounty | "Voyage accepted!" stinger + scroll-unfurl animation | Yes (short fanfare, ~0.8s) | The biggest committing action in the app deserves a beat |
| Someone accepts your bounty | **PUSH**: "{name} signed on for your voyage. You can rest easy." | No | Outside the app; the message is the reward |
| You earn a Logbook stamp | Toast at top of screen, badge slides in, links to the post that earned it | Yes (chime) | Stack Overflow's lesson: always say *why* |
| You rank up (Voyage Rank) | Full-screen takeover, parchment unfurls, "You are now First Mate." Skippable. | Yes (longer fanfare) | Rare events earn loud feedback |
| Daily payout completes | The Tides moment, see above | Yes | Already covered |
| Quest complete | Inline checkmark on the quest card, small +N doubloon toast | Subtle tick | Don't escalate small wins |
| Storm Event begins | **PUSH** + home banner with stormy-sea art | Yes (thunderclap, in-app only) | This is the call to action of the quarter |
| Storm Event ending in 24h | **PUSH** | No | Mild urgency, not panic |
| Captain of the Month named | **PUSH** to crew, animated portrait reveal on Wall of Fame | Yes (cheer) | Public recognition is the whole point |
| Quarterly Awards Ceremony | Full-screen scroll on next open after quarter end | Yes (full fanfare, longer) | Once a quarter, go big |
| You receive a Thank-You Scroll | In-app: scroll slides down from top, expands to show the message | Yes (warm chime) | Emotional close-the-loop |
| You toast someone in the Tavern | Tiny "🍻" animation on the tapped entry | No | Don't ceremony-ize routine acts |
| You take PTO that gets covered | In-app: "Bon voyage, sailor. The crew's got the wheel." | Yes (soft bell) | The most important moment in the whole product |
| You return from PTO that was covered | In-app on first open after return: "Welcome back. {coverer} kept the ship afloat. Send a scroll?" | No | Sets up mechanic #10 |
| Easter egg (Konami) | Monkey appears, says one line | Yes (monkey noise) | Just because |

**Quiet hours:** No push between 18:00 and 09:00 local for the user, ever, with the only exception being "someone accepted your bounty" within 2h of you posting it (active intent window).

**Do-Not-Disturb during PTO:** if the user has marked a coverage window for themselves, the app goes nearly silent during that window. No quests, no Storm pings, no daily payout chimes. They can opt in if they want them.

---

## 6. Anti-gaming and equity guardrails

Every abuse pattern + a specific countermeasure.

| Abuse pattern | Why it happens | Guardrail |
|---|---|---|
| **Coin laundering between friends** ("I'll post a fake 1-day bounty, you cover it, then vice versa") | Doubloon-hunting for cosmetics or leaderboard | **Structural:** A bounty + cover pair between the same two users is rate-limited (e.g. max 2 voyages per quarter between any single pair count for leaderboard/quest credit; the underlying real coverage still works). **Statistical:** flag clustering — if user A and user B trade 80%+ of each other's voyages, surface to ops, not punitively. |
| **Manager-favorite quests** (manager assigns lucrative "quests" to favorites) | Discretionary reward power corrupts | **Structural:** managers can't assign coin-bearing quests at all in v1. All Captain's Orders are system-generated and uniform across a crew. If we add manager quests later, doubloon amount is capped and quest is visible to whole crew. |
| **Junior employees can't say no** to cover requests from senior peers | Hierarchy + visible activity feed | **Structural:** Bounties are posted to the *board*, never DMed to an individual. There is no "ask {person} to cover" feature in v1. Acceptance is one-way (volunteer-only). **Social:** the Logbook explicitly does *not* reward "accept rate" or "speed of accepting"; only completion. |
| **Low-PTO employees can't earn doubloons** (recently joined, just used PTO) | Coverage volume gates the economy | **Structural:** Voyage Rank, Logbook stamps, and Wall of Fame rotate categories so *posting* and *gratitude given* are as visible as *covering*. **Structural:** baseline Crown's stipend exists exactly so newcomers always have coins to spend on cosmetics. |
| **Streak abuse / showing up sick to keep a streak** | Loss aversion (the Duolingo problem) | **Structural:** *no daily login streak at all.* The closest thing we have is monthly Crown's stipend, which lapses, but that's monetary, not a "streak". The only streak-like display is on the Wall of Fame's *past Captains*, which is celebration not pressure. |
| **Discouraging managers from approving PTO** (because their team's "Captain of the Month" went on leave) | Captain mechanic anchored to activity | **Structural:** the Captain blend includes a "Shore Leave taken" factor *positively*. Being on PTO doesn't disqualify; it counts. **Social:** quarterly *Shore Leave Champion* award explicitly celebrates the person who took the most PTO. |
| **Public shaming via low rank** | Leaderboards | **Structural:** no bottom-rank visibility (see §4). |
| **Workaholic optimization** (sacrificing your own PTO to climb) | Voyage Rank too coverage-weighted | **Structural:** the *Shore Leave* Logbook stamp + Quarterly Award + Voyage Rank XP for taking PTO. **Statistical:** if a user has 0 PTO taken in a quarter and >10 voyages covered, the app proactively nudges with "the crew can sail without you for a week." |
| **Manager surveillance via Map Room** | Cool data, wrong audience | **Structural:** Map Room is user-only. Doubloon and PTO data are not exposed in any manager dashboard in v1. If managers ever get visibility (e.g. an opt-in "share with my manager" link), it's user-initiated and revocable. |
| **Storm Event hoarding** (waiting to post until a Storm is announced) | Multipliers | **Structural:** Storms only multiply pre-existing bounties posted ≥7 days before the Storm started. Posting *during* a Storm gets normal rates. |
| **Cosmetic flexing as in-group signal** (expensive avatars = clique) | Status display | **Structural:** the rarest cosmetics are not coin-purchasable, they're Logbook-locked, so they signal contribution variety, not wealth. **Structural:** all cosmetics are free to *view*; you can always see another player's tailored look. |

---

## 7. What NOT to do — anti-pattern list

1. **No daily login streaks.** Duolingo's research is clear: streaks work via loss aversion, and the resulting compulsion is incompatible with a workplace that's also trying to be healthy. ([Duolingo loss aversion](https://www.justanotherpm.com/blog/the-psychology-behind-duolingos-streak-feature))
2. **No HP / damage / punishment mechanics.** Habitica's HP-loss-from-skipped-tasks is the single most-cited reason users churn from that app; it amplifies self-criticism. We never penalize the user for inaction beyond the existing stipend expiry.
3. **No leaderboard at the top of the home screen.** The default is your own portrait wall, not the global ranking. The global ranking is reachable but never thrust at you.
4. **No "you must cover X to keep your rank."** Voyage Rank only goes up, never down. Sea-time accumulates, period.
5. **No pirate-flavored copy in serious flows.** PTO denials, payroll-adjacent messages, error states, and any HR-touching screen are flat, professional, and pirate-free.
6. **No manager-visible coin balance or coverage stats** without explicit user opt-in. The moment a manager can see "this person hasn't covered enough", we have built a surveillance tool.
7. **No coin-attached peer recognition.** Thank-You Scrolls are *not* worth doubloons. Bonusly's own research shows that monetary peer recognition has higher participation, but in our product the explicit decoupling is what keeps gratitude sincere. ([Bonusly gamification](https://bonusly.com/post/gamification))
8. **No randomized loot boxes** for cosmetics. Cosmetics are clearly priced or clearly achievement-locked. No gambling loops on workplace currency.
9. **No public "you are #N of M" callouts** anywhere. We can show that someone is *in* the top 10; we never show someone where they sit *outside* it.
10. **No mandatory tutorial.** The Stan onboarding flow is skippable at every step. Adults at Google have been onboarded to enough apps.
11. **No childish copy that mocks the user's job.** Tagline test: would a Director-level TAM screenshot this and laugh *at* the app, or *with* the app? If the former, rewrite.

---

## 8. Top 7 to ship in v1 — ordered by ROI

| Rank | Mechanic | Why it's in the top 7 |
|---|---|---|
| 1 | **Pirate visual identity + Bounty Board (mechanic 7)** | This is the cheapest, most legible game-feel win. The economy already works; reskinning the request list as a cork-board of bounties and the wallet as a treasure chest gives 60% of the "feels like a game" benefit for ~10% of the work. Lands the Monkey Island vibe immediately. |
| 2 | **Stan-led onboarding (§3)** | First impression governs everything. A new user who experiences the Maiden Voyage flow has a story to tell their crewmates. Without it, the same product feels like an internal CRUD app. Medium effort, enormous compound return because every new user passes through it. |
| 3 | **Ship's Logbook / achievements (mechanic 2)** | Cheap to ship incrementally, satisfies multiple Octalysis drives (accomplishment, social influence, ownership), and per Stack Overflow research, lots of small badges meaningfully steers behavior across the contributor spectrum. The trick is the catalog of badges, not the engine. |
| 4 | **Voyage Log / XP & Rank (mechanic 1)** | The career-scale progression that gives the product longevity past month two. Without it, the only thing climbing is the coin balance, which is also being spent. Voyage Rank is the thing a 2-year user is proud of. |
| 5 | **The Tides daily payout celebration (mechanic 3)** | Tiny effort, huge daily reinforcement. Turns a silent cron into a tiny daily delight. The single best ROI mechanic of any in the list per unit work. |
| 6 | **Wall of Fame, restructured (§4 / mechanic 14)** | The existing leaderboard is already in scope; *redesigning* it before launch is much cheaper than fixing it after harm. Shipping the multi-narrow-board version instead of a single rank list prevents the bottom-demotivation pattern from ever forming. |
| 7 | **Thank-You Scrolls (mechanic 10)** | The single most important *social* mechanic. Closes the emotional loop after coverage, builds the felt sense that a real crew exists, and explicitly does not require any coin engine work. Small surface, huge culture lever. |

Deferred to v1.5 / v2: Avatar cosmetics (large art cost), Storm Events (needs ops buy-in for fairness review), Crew's Hold treasury (legal/HR review), Captain of the Month (better to wait until we have 30 days of data to tune the blended score), Quarterly Awards (waits for the first full quarter of data anyway).

---

## 9. Open questions for the owner

1. **Crew scope: how big is a "crew" by default?** Is it the user's direct team (5-10 people), their pod (~30), or their TAM org (~200)? This decides whether the Tavern feed is intimate or noisy, and whether "Captain of the Month" is meaningful or anonymous. Strong recommendation: direct team (5-15 people), with opt-in cross-crew bounty visibility.
2. **Manager visibility: is this an employee tool or a manager tool?** Specifically — do managers get any dashboard at all in v1? Our default position is "no, this is an employee-trust tool", but if the manager org is funding the project they may expect visibility. This decision propagates into every mechanic that touches stats.
3. **Doubloon real-world redemption: yes or no, ever?** Bonusly's data shows non-monetary points have 50% lower participation by month 18. We've designed assuming coins stay virtual (cosmetics only). If the plan is for doubloons to eventually buy real perks (a Google swag credit, a coffee gift card), the equity guardrails in §6 need to be tightened significantly because the abuse incentive goes up.
4. **NPC voice: how pirate is Stan?** Recommendation is "fast-talking salesman, recognizably Monkey-Island-coded, but not literally yarr-ing". But the owner may want him fully in dialect, or fully neutral. This decision shapes the entire writing tone of the app and should be made before any copy is locked.
5. **PTO data source — and trust.** Are we using Google's internal PTO system as the source of truth, or self-reported dates in the app? If self-reported, the "Shore Leave Champion" mechanic is gameable (declare PTO, work anyway). If integrated with the real system, we need privacy review *especially* because of mechanic 11 (Map Room) and §6 (manager surveillance guardrail).

---

## Sources

- [The Octalysis Framework — Yu-kai Chou](https://yukaichou.com/gamification-examples/octalysis-gamification-framework/)
- [Self-Determination Theory + gamification research (Springer)](https://link.springer.com/article/10.1007/s11528-024-00968-9)
- [Fogg Behavior Model (B=MAP) explainer](https://medium.com/@omforux25/fogg-behavior-model-b-map-the-3-simple-keys-to-driving-user-action-9efdd9cc9644)
- [Counterproductive effects of gamification — Habitica study (Elsevier)](https://www.sciencedirect.com/science/article/abs/pii/S1071581918305135)
- [Stack Overflow badges explained (2021)](https://stackoverflow.blog/2021/04/12/stack-overflow-badges-explained/)
- [Improvements to the Stack Overflow Badge System (2010)](https://stackoverflow.blog/2010/07/12/improvements-to-badge-system/)
- [Designing Peer Recognition for Engagement — HeyTaco research](https://heytaco.com/research/designing-peer-recognition-for-engagement)
- [The Pros and Cons of Gamification in the Workplace — Bonusly](https://bonusly.com/post/gamification)
- [Duolingo streaks and loss aversion](https://www.justanotherpm.com/blog/the-psychology-behind-duolingos-streak-feature)
- [Leaderboards that motivate, not demotivate — Yu-kai Chou](https://yukaichou.com/advanced-gamification/how-to-design-effective-leaderboards-boosting-motivation-and-engagement/)
- [Gartner: 80% of enterprise gamification fails — Centrical](https://centrical.com/will-80-of-gamification-projects-fail/)
- [Pieces o' Eight — Monkey Island Wiki](https://monkeyisland.fandom.com/wiki/Pieces_o'_Eight)
- [Paid Leave and Mental Health — Bloomberg Law](https://news.bloomberglaw.com/daily-labor-report/paid-leave-covers-mental-health-days-but-stigma-still-clouds-use)
