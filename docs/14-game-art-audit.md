# Time Off — AAA Game Art Direction Audit (v1.0)

> Lens: AAA art director. The vocabulary of *Hades*, *Disco Elysium*, *Death Stranding 2*, *Cult of the Lamb*, *Slay the Spire*. Every screen is a frame in the wider narrative. Every animation costs cycles for a reason. Every asset commits to a single moodboard or it gets pulled from the build.
>
> Source: `app/app.js` (3,784 lines), `app/styles.css` (4,152 lines), `app/index.html`, four skins (Pirate, Basic, HC, Dark Knight), and the live build at https://vacaciones-dev-b3158.web.app. Read against prior audits 09 (visual prod) and 13 (industrial design).
>
> I am being brutally direct because that is how an art director earns their seat. The product is not bad. It is, however, *not yet a world*. It is a UI in a costume. A AAA studio would not ship the current asset bar. We would ship a focused 60% of the surface area, finished to the standard the doubloon SVG already meets.

---

## TL;DR — the single biggest move

**The doubloon SVG is the only asset on this product that was actually *made*. Everything else was found or stitched.** That coin (16×16, four-tone palette: `#5A3A1F` ring, `#FFCB47` field, `#E0A93B` body, `#8C6418` glyph, `#FFD86B` highlight, `index.html:16–32`) is shipping-quality. The 10 avatar SVGs (`app.js:778–796`), the harbor scene (`app.js:2424–2646`), and Stan's portrait (`app.js:748–771`) are *close* but each commits a sin. Everything else — rank emblems, achievement badges, status pills, podium icons, mode pills, reaction emoji — is **vendor Twemoji rendered through the OS**.

A pirate-themed product where the pirate signifiers are *imported from the operating system* is not a world. It is a wrapper. The single move that elevates Time Off from "Google internal hackathon" to "I would screenshot this" is **finishing the sprite sheet docs/06 promised** — 10 sprites in the original Mêlée Night vision. Two shipped (doubloon, turtle). The rest still render as `🏴‍☠️`, `⚓`, `📜`, `🪙`, `🦜`, `🪶`, `👑`, `⚔️`, `🌅`, `🪢`, `🎺` on user machines, looking different per OS. Until that sheet is complete, the world does not hold.

---

## Findings

### 1. Stan does not move. The "opening cinematic" is a static portrait you click six times. P1 / M.

`renderStanScene` (`app.js:2036–2069`) loops through six modal scenes (`STAN_SCENES`, `app.js:85–92`). On every scene the **same 24×24 portrait** sits in the same `.stan-portrait` box with the same `--moonbeam` background. Stan says one of six different lines, the user clicks "Next." Six times.

This is not an opening cinematic. It is six dialog boxes stacked behind one another. The art direction does *nothing* to differentiate scenes:

- **No composition variation.** Stan could be by the dock for "Doubloons are how we trade coverage," at a chalkboard for "5 buy you one day," holding a calendar for "stipend expires monthly." Each scene should be its own 96×96 vignette — the way *Hades* introduces each god through a distinct shrine pose.
- **No idle.** No blink, no eyebrow raise, no breathing. *Cult of the Lamb* gives every NPC a 2-frame idle and adds 30 minutes of perceived life to a 5-second interaction.
- **No pacing.** Scenes 4 and 5 ("the Crown drops 11 doubloons every month," "Cover a crewmate's bounty and earn") are dense. Scene 1 is light. All weighted identically — same modal size, same Next button. Users fatigue out by scene 3.

**Fix:** author six composited tableaux. Re-use the harbor SVG as backdrop with Stan posed differently in each. Promote `.stan-progress` dots to *islands on a map at the bottom of the modal* — visited / current / unseen, so the user sees what's coming. This is how the *Hades* tutorial frames Mirror upgrades. Six visited islands, not six interchangeable click-to-continues.

---

### 2. The doubloon shower is decoration, not transaction. It fires straight up from the wrong anchor. P1 / S.

`launchCoinShower` (`app.js:1897–1909`) anchors to `.coin-pill`, spawns a `+N` Silkscreen 22px gold element 12px left of the pill's center, and floats it **upward** 48px over 900ms via `coin-float` (`styles.css:1411–1414`).

Three failures:

1. **The shower originates AT the wallet, then floats UP and AWAY from it.** This is backward. In *Slay the Spire*, gold flies *from the chest to the gold counter*. In *Hades*, obol drops travel *from enemy to Zagreus to HUD*. Money moves *toward* the wallet. Time Off currently shows coins escaping the pill — visually saying "your money is leaving" exactly when the user got paid. The single most expensive art-direction bug because it inverts the feedback semantics.

2. **The coin count is text, not coins.** A `+5` Silkscreen glyph is a number. AAA juice spawns 5 actual 16×16 doubloon SVGs (we own this asset!) on a slight arc, frame-staggered (`animation-delay: 0ms, 40ms, 80ms…`). Each coin spins on `coin-spin` keyframes as it travels. Then a `+5` text fades into the pill on landing — what *Hades* calls "collect → register." 60 lines of CSS.

3. **It does not fire when it should.** Currently fires only on `coverageRelease` ledger events (`app.js:983–986`). Silent on: bounty acceptance, scroll receipt, achievement unlock, rank promotion, calendar event addition, crew claim submission. The juiciest moments give no visual reward.

**Fix sketch:** `launchCoinShower(amount, sourceEl)` reads the source element's rect, computes `--dx/--dy` deltas to `.coin-pill`, spawns `Math.min(8, amount)` actual doubloon SVGs along that vector with staggered delays, lands them on the pill. Same animation budget; meaning gained is enormous.

---

### 3. The harbor SVG is breathtaking and entirely dead. P1 / S.

`renderHarborBg` (`app.js:2424–2646`) is **220 lines of hand-coded SVG rectangles**: multi-stop sky gradient (indigo → violet → red → amber → gold), three-stop ocean, hand-built sun with reflected beams, a distant pirate ship with red sail, twin palms, beach umbrella, two pirates on chair and towel with their own laptops, treasure chest spilling coins, a small red crab. It is, frankly, **staggeringly good** as a pixel illustration. The only screen on the product that earns its fiction.

But **nothing animates.** Not one element. The moon doesn't rise. The water doesn't shimmer. The torches don't flicker (docs/06 promised three-frame flicker; docs/09 finding #9 flagged; still not built). The crab doesn't scuttle. The pirate's laptop cursor doesn't blink. The chest coins don't sparkle.

A AAA shipping login — *Death Stranding 2* menu, *Hades 2* title — does **3-5 living elements minimum**. The harbor has zero.

The easiest 1-day win on the audit. Animate in priority order, all `steps()` to honor the existing motion language:

1. **Sun beam shimmer** (`app.js:2461–2464`) — 3-frame opacity flicker on the three beam rectangles, 600ms `steps(3)` infinite, staggered phase.
2. **Lantern flicker** — none in current scene (docs/06 specified three). Add two 8×8 brass lanterns on the palms; 3-frame yellow/amber/dim cycle, 300ms `steps(3)`.
3. **Ocean wave parallax** — the `--moonbeam` opacity wave rects can phase-shift 1px horizontally per frame, 800ms `steps(2)`.
4. **Pirate laptop cursor blink** (`app.js:2587`) — toggle the cursor pixel on/off every 600ms.
5. **Crab sidestep** (`app.js:2637–2645`) — 6-pixel crab does `translate(2px,0)` then back, 1.2s `steps(2)` infinite. The crab walks. Tiny crustacean parallax sells "living world."

**Optional high-leverage add:** time-of-day variants. Dawn (cool blue → soft pink, no sun) for sign-ins before 10 AM local; current sunset for 6 PM-onward; bright midday in between. The *Animal Crossing* trick. Three SVGs. Login becomes a place that responds to the user's day.

---

### 4. The rank ladder is OS emoji. Every promotion is a Unicode lookup. P0 / M.

`RANKS` (`app.js:103–112`): Cabin Boy 🧒, Deckhand ⚓, Mate 🪢, Bosun 🎺, Quartermaster 📜, First Mate 🪙, Captain 👑, Commodore ⚔️.

On macOS this renders as Apple Color Emoji. On Windows 11, Segoe UI Emoji. On Android, Noto. The "Captain 👑" rank is a yellow crown with red velvet on macOS, a flatter outline on Windows. **The single most prestigious thing the gamification gives the user looks different on every machine.**

The rank-hero panel (`renderChestTab`, `.rank-hero`, `styles.css:1438`) displays the emoji at 38px (`styles.css:1461`) inside a 64×64 brass emblem. At 38px, the OS-native bitmap is grotesquely scaled. On Apple the saturation is out of palette with the parchment surround. On Windows the chunky corner antialiasing fights the pixel-art chrome.

**Fix:** author eight hand-drawn 32×32 inline SVG rank emblems in the doubloon's four-tone palette. Pose them as a ladder — Cabin Boy is a small figure with a swab; Commodore is a captain on a ship's deck. The user *advances through poses*, not Unicode codepoints. Same fix for `ACHIEVEMENTS` (`app.js:115–124`): 🌅 ⚓ 🎩 💎 🌊 📜 🔥 🏴. One day of pixel art, total.

---

### 5. The achievement unlock is a toast, not a fanfare. P1 / S.

`persistAchievements` (`app.js:643–654`) on a satisfied achievement fires `showToast(\`${a.icon} Achievement unlocked: ${a.name}\`)` and plays `audio.rank()`. Same component, same animation, same chrome as "Bounty posted. Anchors aweigh!" There is no differentiation between "you posted a bounty" and "you unlocked Captain's Hat for the first time after months of covering."

Compare *Hades*: a new Mirror upgrade dims the screen, scales the icon 0 → 1.2 → 1.0 with a particle burst, plays a 5-second composed sting, types the name one letter at a time. 3 seconds; impossible to miss. Compare *Cult of the Lamb*: every devotion-tier unlock pans the camera, plays a chorus, shows the building rise. 8 seconds of weight.

Time Off's unlock is a polite Slack notification. The audio (three-note ascending arpeggio) is correct; the visual is missing.

**Fix:** introduce `showAchievementBurst({ icon, name })`. Centers a 200×200 transparent overlay; spawns the achievement icon scaled 0.4 → 1.0 in 400ms `steps(6)`; emits 8 doubloon-SVG particles radiating outward; writes the name beneath in Inter 22px brass with `steps()` typewriter reveal (~30ms/char); fades after 2.5s. Re-uses the existing coin-shower system (for unlocks the direction is *outward* from the icon, then particles land in the wallet). ~120 lines of CSS+JS.

Tier the celebration: keep the toast for "trivial" achievements (Set Sail — first voyage); reserve the burst for milestones (Captain's Hat, Treasure Hunter, Old Salt). Match rarity to celebration.

---

### 6. The "Wall of Fame" feels like LinkedIn endorsements, not a leaderboard. P1 / M.

`renderWofTab` (`app.js:3182–3258`) renders a podium (top 3) plus a flat list (rest). Podium uses emoji trophies — `🏴‍☠️` for #1, `⚓` for #2, `🦜` for #3 (`app.js:3210–3215`). Three places are equal-height boxes with backgrounds `#FFD86B / #D9D9D9 / #C49B5C`. Each card holds: emoji, rank label, avatar, name, score in Silkscreen 22px, voyage count.

Art-direction problems:

1. **The podium is a vertical bar chart of equal weight.** *Death Stranding 2*'s Strand contracts, *Hades*' Chaos Gate tally, the *Bloodborne* Hunter's Dream tablets — the #1 spot is always **visually different**: bigger, framed differently, often with its own background motion. Time Off's three places read as "three trophies of equal weight." The eye doesn't know where to land.

2. **The trophies are emoji.** Two skull-and-crossbones emoji on the same product render differently per OS. *The prestige object is a Unicode hand-off.* Sloppiest moment in the entire UI.

3. **No story.** The `.wof-meta` strip shows `lb.windowDays` and `lb.generatedAtMs` — administrative data. The user wants *narrative*: "You moved up 2 positions this week," "Crewmate X is 8 doubloons ahead — one weekend cover and you pass them," "You held #1 for 3 days in May." All derivable from the existing ledger.

4. **The "you" row** (`.wof-row.you`, `styles.css:1631–1634`) gets `--moonbeam` background and a 2px brass ring. That's a highlight, not a celebration. A top-10 row should pulse softly (cyan glow, 1.2s `steps(2)`).

**Fix sketch:**

```
THE WALL OF FAME · 90 DAYS
You are #4 · 2 spots from the podium      ← story header
        ┌──────────┐
        │  GOLD    │                       ← #1 elevated, gold parchment,
        │ ▲ avatar │                       │  torch sprites flanking with
        │ 220 ◊    │                       │  3-frame flicker
        └──────────┘
 ┌────┐                ┌────┐               ← #2 silver, #3 bronze
 │ #2 │                │ #3 │                  smaller, no torches
 │180◊│                │140◊│
 └────┘                └────┘
─────────────────────────────
 #4 [you]  Raul S.    120 ◊  ▲2 ↑           ← brass pin, movement chevron
 #5  Alex Y.          110 ◊
 #6  Pri B.           100 ◊
```

Custom 24×24 SVG trophies in palette (hand-drawn flag/anchor/parrot). Torch sprites on #1 only. Every row gets a movement chevron (`▲2`, `▼1`, `=`).

The Tavern currently nests under the Wall of Fame in the same tab (`renderWofTab` ends with `${renderTavern()}` at `app.js:3256`). No visual transition — you scroll past the leaderboard and the scrolls just begin. Add a wooden-plank divider with a hanging-lantern SVG. Or split into two tabs.

---

### 7. The Tavern is a Slack channel pretending to be a tavern. P1 / S.

`renderTavern` (`app.js:3425–3470`) is, semantically, a list of thank-you scrolls. Each scroll is a `.scroll` panel with a `🪶` (feather emoji) absolutely positioned at the top-left corner. Scroll shows from-avatar → arrow → to-avatar in `.scroll-head`, then message in `.scroll-msg` separated by a dashed border, then a reaction bar with five emoji buttons (🪙🍻🏴‍☠️⚓🦜).

This *should* be the warmest screen on the product — public peer recognition. A game-feel version would look like an **actual tavern**: wooden walls, hanging lanterns, scrolls as parchment nailed to the wall with brass tacks. Re-reading the most recent message would feel like reading the newest pin on the community board.

What ships is **Slack with parchment backgrounds**. No tavern. No lanterns. No tacks. No wall. The 🪶 emoji corner badge is the only signifier; it's a Unicode quill that renders differently per OS.

**Fixes:**

1. **The wall.** Style `.tavern` with a repeating wood-plank background: `repeating-linear-gradient(0deg, #5A3A1F 0, #5A3A1F 96px, #4A2E18 96px, #4A2E18 192px)` plus 1-pixel highlight stripes at every plank seam. 20 lines of CSS, big atmosphere.
2. **The scrolls need to be scrolls.** Add top curl + bottom curl SVG segments to the `.scroll` component (8×320 px each). Corners taper. Each scroll looks rollable.
3. **Brass tacks.** Two 6×6 brass dot SVGs at the top corners pinning each scroll to the plank wall. Tiny detail; massive narrative payoff.
4. **Real reactions.** Author 5 reaction sprites in palette: doubloon (own it), tankard, flag, anchor, parrot. Replace the emoji.
5. **The compose box** (`showSendScrollModal`, `app.js:1654–1692`) becomes a scroll laid flat with a brass-ink character count and a *wax-seal submit button* — a `--lechuck-red` SVG circle with a tricorne stamp. "Send scroll" → "Seal with wax."

~150 lines of CSS, 6 new SVGs. The Tavern stops being a list and becomes a place.

---

### 8. The bounty card is technically a card, visually a spreadsheet row. P1 / M.

`renderBountyCard` (`app.js:2829–2905`) renders a 5-row grid: status / mode pill / mine pill | requester avatar + name | date window + day count + tz | doubloon amount | scope strip | reachability + kind chips | SLA text | action button. Up to **15 visual elements per card**, including a 3px brass left-border on `.bounty-scope`.

In *Slay the Spire* a card is paper with a hand-drawn illustration, a title, cost in the top-left, 12 words of body, a rarity gem. **Four to six elements.** Deeply hierarchic — illustration first, title second, cost third. A user triages a 10-card hand in 4 seconds.

**Prescription** (also called for in industrial-design audit #4 — restating with art lens):

```
┌──────────────────────────────────────────────┐
│ ▣▣▣▣▣▣▣  ← 32px hand-drawn illustration band │
│           (palm + sleeping pirate sprite)    │
│                                              │
│  Raul S.        Jun 5 → Jun 12     [25 ◊]   │
│  Acme + 2 SMBs  6 days · PST                │
│                                              │
│                                      [Take]  │
└──────────────────────────────────────────────┘
```

Three lines. The chips, SLA, scope all live in the modal (`app.js:2147–2169` already has them). The illustration band changes based on the **kind** of leave — `inbox` shows an envelope sprite, `meetings` shows a calendar, `escalations` shows a flame. With six coverage-kind sprites authored once, every bounty card gains a visual identity.

For crew-mode: the illustration band gets a horizontal progress bar at the bottom — 6 segments, filled for claimed days, hollow for open. The user reads the bar in 0.5s. No `🏴‍☠️ CREW · 3/6` text pill needed.

This is the same density rule *Slay the Spire* uses. Card density drops ~60% and the bounty board becomes scannable.

---

### 9. The skin system is four parallel games. None is fully art-directed. P2 / M.

`SKIN_OPTIONS` (`app.js:163–168`): Pirate, Basic, HC, Dark Knight. In a AAA studio, the player does not pick the art direction. The studio picks and commits — every screen has been hand-tuned for that one direction. Time Off ships four mutually exclusive languages and **none is fully finished**. Docs/09 enumerated 13 selectors that fall through Pirate parchment on Basic/HC; some are still partial. Dark Knight's scrolls, rank-hero gradient, achievement icons, podium colors are still Pirate-default.

Two paths:

1. **Demote skin to a developer toggle.** Ship one default per audience. Default = Dark Knight for TAMs (warm dark, amber accent — feels like a tool TAMs use anyway, similar to Datadog/Linear). Pirate is fun but on a Wednesday afternoon with 11 customer escalations, Pirate is *loud*. Pirate becomes `?skin=pirate` for Saturday Mode. HC stays as accessibility skin auto-activated by `prefers-contrast: more`. Basic is dropped — it has nothing to say.

2. **Commit to all four but make each its own *place*, not a re-skin.** Pirate = the **harbor**. Dark Knight = **captain's quarters at night**. Basic = **harbormaster's logbook by daylight**. HC = **the lighthouse**. Re-author the login, the empty-mascot, the chip colors, the chrome, the typography per skin. 3 weeks. The product becomes a multi-world experience.

Option (1) ships in 2 hours and raises the quality bar substantially. Option (2) is the right answer if the founders are evangelizing as a visual showcase. The current state — four parallel skins, none fully finished — is the worst of both worlds.

---

### 10. The status badges are five identical-saturation stickers. P1 / S.

`.status-open / .status-taken / .status-active / .status-done / .status-cancelled` (`styles.css:794–798`):

- `open` `#FFCB47` doubloon gold — full saturation
- `taken` `#5BC9D1` elaine cyan — full saturation
- `active` `#6BD18E` green — full saturation
- `done` `#C4A86B` parchment-dim brown — medium
- `cancelled` `#C8362D` lechuck red — full saturation

Four of five at maximum saturation. On a board with 12 cards, this is a fruit-salad of badges and **the eye cannot triage**. Worse, the gold "open" badge competes with the gold doubloon coin on the same card — two gold accents per active row.

*Disco Elysium*'s skill checks are white/red — that's it. *Hades*' aspect upgrades are monochrome grey except the equipped one (gold). Exception is loud; default is quiet.

Time Off:
- `open` → **no badge.** Default state. Saying nothing says "fresh, take it."
- `taken`/`active` → soft cyan/green outline + text, low-saturation backgrounds (~30% opacity).
- `done` → small grey text label, low contrast.
- `cancelled` → full-saturation red filled badge. **The only one that shouts** because it is genuinely exceptional.

The board becomes mostly chrome and parchment with the rare cancelled card drawing the eye. Currently every card shouts at the same volume.

Bonus: the `--status-active` `#6BD18E` mint green is the **only green pixel on the Pirate skin** — Mêlée Night 16 (docs/06:31–49) has no green token. It was added later, by web-convention analogy. Drop it; reuse cyan.

---

### 11. The avatars are 10 nearly-identical pirate portraits with built-in blue backgrounds. P1 / S.

`SVG.avatars` (`app.js:778–796`) — 10 hand-painted 32×32 portraits. The art is competent; each has distinct silhouette signifiers (hat, hair, accessory). Three issues remain:

1. **They're labeled `m1`–`m5` / `f1`–`f5`** in the picker (`app.js:1444`). The user picks "M1" or "F2." *Hades* names every shade in the Pool of Styx; *Stardew Valley* names every villager. Naming is the cheapest way to make a portrait *be* a character. Author 10 names ("Captain Olwen," "Bandana Mei," "Red-Feather Vega," "Old Salt Aram," "Scarlet Po") and surface them in the picker. The user doesn't pick `M1`; they pick a crewmate.

2. **All face forward, neutral pose.** No glance, no wink, no half-smile. *Among Us* beans are intentionally ambiguous; pirates should not be. Vary the head tilt by 4 pixels on two of the ten; have one wink (the eyepatch covers it).

3. **The `<rect width="32" height="32" fill="#1E2D4A"/>` inner background bleeds through.** Docs/09 finding #12 flagged this; still unfixed. The avatar tile bg is `--parchment-bright` cream; the avatar is on an ink-sea blue. Blue-on-cream reads as "postage stamps from another country glued to a postage album." **Drop the inner rect.** Let the parchment show through. Avatars become portraits *on parchment* — closer to the WANTED-poster fiction the pirate theme implies.

---

### 12. The audio click on every tap is placeholder. Strip it. P2 / S.

`audio.click()` (`app.js:205`) — 220 → 110 Hz square, 60ms, fires on every `data-action` click (`app.js:3490`). The intent is "every action makes a sound." The result is **noise**.

A pinball machine doesn't click on every press. It chimes on score, dings on tilt, sings on multiball. In games, sound is reserved for **meaningful state transitions** — hit, miss, level-up, item-pick. Time Off's `audio.click` fires on opening dropdowns, closing modals, hovering chips, picking days.

Keep `audio.coin` on payouts (good), `audio.rank` on achievement/promotion (good), `audio.toast` on toast appear (good). **Delete the `audio.click()` call** at `app.js:3490`. Add a single `audio.success` (octave higher than coin) for non-money confirmations (avatar set, skin set, crew formed). The soundscape gains information: low chimes for state, gold chimes for money, ascending arpeggio for rank, no chatter.

Bonus: the Web Audio sounds aren't bad — coin's two-tone is genuinely cute. But six tones across three functions is *Atari prototype*. A 1-day investment in a small WAV sample bank (coin drop, scroll unroll, achievement fanfare, ambient gull, ship bell) moves the audio to *shipping retro game*.

---

### 13. The login wordmark fights three styles in one logotype. P1 / S.

`.login-title` (`styles.css:503–513`):

```css
font-family: var(--font-display);  /* Inter */
font-size: 32px;
color: var(--brass-bright);
text-shadow: 2px 2px 0 var(--shadow-deep), 4px 4px 0 rgba(0, 0, 0, 0.6);
letter-spacing: 6px;
font-weight: 900;
```

Inter at 900 weight (humanist sans, designed for tight tracking) + 6px letter-spacing (mid-century display) + a stacked 2px/4px pixel-art drop shadow (arcade marquee). **Three vocabularies welded onto seven letters.** Currently the wordmark cosplays as an 80s arcade marquee while being typeset in a Google Web Font.

Three valid resolutions:

1. **Commit to pixel.** Author a custom pixel logotype in the doubloon's palette with a single 2px hard drop. The wordmark becomes a *thing*, not a font choice.
2. **Commit to modern.** Inter 800 at 32px, `letter-spacing: 0.04em`, **no shadow**, `--brass-bright` on the dark sky. The harbor SVG carries the fiction.
3. **Author a hand-lettered SVG wordmark.** Six letters, drawn once, 240×56 px. A AAA logotype is almost always SVG, not a font.

Whichever path: the current state is putting glitter on a business card.

---

### 14. The "you" indicator has five different visual treatments. P1 / S.

Self-ownership is marked five ways:
- `.own-tag` muted uppercase text on bounty cards (`app.js:2852`)
- `(you)` parenthetical in detail modal (`:2093`)
- color-only on ledger entries
- `.wof-row.you` moonbeam-blue block (`styles.css:1631`)
- cyan `.mine-pill` on crew bounties (`app.js:2879`)
- plus `.member-card.me` (`styles.css:2066`) which is also `--moonbeam`

Six variations actually, with no consistent shape. A character's self-indicator in any AAA game is **one shape across every surface** — Zagreus's icon is the same shape on every *Hades* menu; in *Civ VI* your civ's color is yours everywhere.

**Pick one:** a 4×4 brass square on the left edge of any card belonging to the current user — a flag pin. Works on bounty cards, leaderboard rows, ledger entries, crew tiles, Tavern scrolls. Five surfaces, one mark, one color (`--brass`). The iPod click-wheel principle.

---

### 15. The day-card weekend "selected" state is red. Red means danger everywhere else. P1 / S.

`.day-card.selected.weekend` (`styles.css:1940–1946`) — when the user toggles a Saturday/Sunday ON, the card becomes `--lechuck-red` `#C8362D` with cream text. Intent: "you've selected a weekend, which costs 2× — be aware."

The failure: **red is the danger color everywhere else.** Toast error backgrounds, cancelled status, `.btn-danger`, force-complete. When a Saturday turns blood-red, the message is "warning — this is wrong." But the user *wants* the weekend covered. The visual *miscommunicates the affordance*.

Fix: selected weekend = brass + ink (like a weekday selected) **with a 10×10 dark-red triangle in the top-right corner** indicating "premium rate ×2." Color says *selected*; corner glyph says *expensive*. One semantic per visual variable. Or use `--brass-deep` (#8C6418) instead of red — stays in the warm-yellow family, communicates "richer/more expensive" through saturation, doesn't trigger danger reflex.

---

### 16. The voodoo-violet gradient on AI briefing and rank-hero is the only place gradients appear in chrome. P2 / S.

`.ai-briefing` (`styles.css:2178`) and `.rank-hero` (`styles.css:1439`) both use `linear-gradient(180deg, var(--voodoo-violet) 0%, #3a1e60 100%)`. On the rest of the product **every other surface is a flat color** with hard `box-shadow` chamfers. Gradients are nowhere else in the Pirate vocabulary.

When you reach the rank-hero or AI briefing, **a gradient appears out of nowhere**. It reads as a "premium feature" tier badge — like the visual language is suddenly trying to sell you something. Drop the gradient on these two; use flat `--voodoo-violet` with a 2px brass border. (The harbor SVG's gradients are *fine* — those are illustration, not chrome. Illustrations get gradients; UI chrome doesn't.)

---

### 17. The Dark Knight skin is competent and not memorable. P2 / M.

`[data-skin="dark-knight"]` (`styles.css:3415` onward) is the cleanest skin in CSS quality. Type hierarchy is rational (Geist + Geist Mono). It is a *competent dev-tool dark UI* — no story, no moment, no reason to choose over macOS dark mode.

Industrial-design #18 noted this. The art-direction push: **commit to "captain's quarters at night" or commit to "developer terminal."** Either:

- **Captain's quarters.** Add a single warm 16×16 amber lantern in the top-right of login with the 3-frame flicker. The brass amber `#D97757` already reads as candlelight. Empty-state mascot becomes a sleeping turtle in a hammock. Wordmark gets a soft amber glow. Panel parchment becomes warm-grey aged parchment in candlelight. **Dark Knight = night-shift skin.**
- **Developer terminal.** The skin preview at `styles.css:4136` already shows `> Time Off_` — a terminal prompt. Lean into it. Wordmark becomes `> time off_` with a blinking cursor. Headings get `>` prefix. Doubloon renders as ASCII `[$]`. Specific audience, very memorable.

Currently the skin does neither. It's a Tailwind dark-mode preset.

---

### 18. The empty-state turtle is the wrong mascot for the wrong moments. P2 / S.

`SVG.turtle` (`app.js:728–747`) — a 32×32 sea turtle. Appears on five empty states: no crew yet, no covers yet, bounty board empty, no scrolls, crew not found. The turtle is well-drawn but has **no narrative relationship to the failure state**. It just sits there in every empty card, generic.

A *Hades* empty Codex has Achilles saying "no chronicled meetings yet, lad" — pose specific to the context. Time Off's mascot has no line and no pose specific to anything.

**Fix:** author 5 emotional poses: turtle waving for "no crew, form one"; turtle reading a blank scroll for "no scrolls"; turtle squinting at the horizon for "no bounties — be the first"; turtle holding a map for "crew not found, check link." Each 32×32, hand-drawn, with a context-specific line.

Also: the turtle is *slowness*. A coverage marketplace is about speed and trust. The harbor scene already has a parrot on the right palm tree (`app.js:2533–2539`). **Promote the parrot to mascot.** Parrots = messages, repetition, social. Author 5 parrot poses. Empty states become parrot states.

---

### 19. The hero greeting calls the user "RAUL" like a drill sergeant. P2 / S.

`renderHome` (`app.js:2657`): `<h1>WELCOME ABOARD, ${esc(firstName(state.user?.displayName)).toUpperCase()}</h1>`. Renders as `WELCOME ABOARD, RAUL` in Inter 22px 700 with letter-spacing 2px.

Human names look brittle in ALL CAPS with tracker spacing. "RAUL" reads aggressive — like HR. In a friendly UI (*Cult of the Lamb*, *Untitled Goose Game*), the hero greeting uses **the user's chosen name in mixed-case at normal weight**, often emphasised with color.

Fix: drop `.toUpperCase()`. Render as `Welcome aboard, <em style="color: var(--brass); font-style: normal; font-weight: 600;">Raul</em>`. The hero becomes a *greeting*, not a *summons*.

---

### 20. The chip system has nine variations. Three is enough. P2 / S.

The product has 9 "chip-like" primitives: `.tab`, `.filter-chip`, `.status-badge`, `.mode-pill`, `.mine-pill`, `.own-tag`, `.role-badge`, `.rank-chip`, `.chip`. Each has slightly different padding, font-size, letter-spacing, box-shadow, case treatment. The Pirate skin override (`styles.css:2906–2914`) tries to unify them, but base styles still differ.

A AAA UI system has **3 chip types maximum**, distinguished by *function*: action chip (clickable, has hover), state chip (display-only, color-encoded), filter chip (toggleable). Consolidate: `.status-badge`, `.mode-pill`, `.mine-pill`, `.own-tag`, `.role-badge`, `.rank-chip` → single `.tag` with color modifiers. Tab stays. Filter-chip stays. Generic `.chip` becomes the passive sibling of `.tag`. Three components, ~80% less CSS, complete consistency.

---

### 21. There is no signature easter egg. The product asks to be shared and provides no fuel. P2 / S.

A pirate-themed product has, at minimum, **one moment the user will screenshot**. *Sea of Thieves* has the first chest. *Subnautica* has the leviathan. *Disco Elysium* has the composure check.

What is Time Off's screenshot moment? The login screen is closest but every TAM sees it every visit — not a *moment*. Stan onboarding is one-time but the art doesn't earn the share (see #1). The coin shower is too fast and fires away from the wallet (#2). Rank promotion is a toast (#5). The Wall of Fame has no #1 ceremony (#6). The Tavern has no fresh-scroll moment (#7).

**The opportunity: the Commodore rank promotion.** Highest rank (`app.js:111`), ~800 lifetime doubloons — months of covering. When a user hits Commodore, the app should *commit*. Full-screen scene: the harbor SVG re-uses, sun rising (dawn time-of-day variant), the user's chosen avatar walks onto the deck of the distant ship in 3 frames, the wordmark expands to "COMMODORE OLWEN" (or whatever pirate name they chose), the rank emblem floats up. 5 seconds, one-time only.

**That is the screenshot. That is the share moment.** Currently the Commodore unlock fires `audio.rank()` and shows a generic toast. The product asks for evangelism and provides nothing to evangelize *with*.

One day of work for one screenshot moment. The highest-leverage art-direction asset Time Off could ship.

---

## What I would ship tomorrow

Three priorities, ranked by leverage:

1. **Finish the sprite sheet.** Author the 20+ remaining sprites in docs/06's promise + the new ones identified in this audit, all in the doubloon's four-tone palette. Two days of one good pixel artist. **Every screen on the product becomes more cohesive on the same day.** (Findings #4, #6, #7, #11, #18.)

2. **Fix the coin shower to fly toward the wallet, spawn actual coin sprites, and fire on more events.** Half a day. The most-fired animation on the product becomes meaningful instead of decorative. (Finding #2.)

3. **The Commodore moment.** One day. Builds the screenshot. Builds the evangelism story. (Finding #21.)

Together: 3.5 days. Moves Time Off from "good Phase-1 product" to "a thing TAMs will screenshot and share."

---

## Where I would not spend a frame

- **The doubloon SVG.** Don't touch it. It's the gold standard for the rest of the assets to match.
- **The login harbor scene composition.** Animate it (per #3); do not redraw it. The only piece that earns its fiction.
- **The audio coin chime.** Two stacked square waves is correct for the pirate retro vocabulary. Don't replace with sampled WAV — the chiptune is the point.

The product is closer to being a *world* than the findings list suggests. The remaining work is almost entirely **finishing assets to the standard the doubloon set**. Pick the moodboard, finish the sprites, animate the world, give the user a moment.

That's what I would ship.

---

## Appendix — sprite sheet shopping list

Authored once, used forever. All 16×16 unless noted, doubloon four-tone palette + optional `#FFD86B` highlight + `#1A0E08` shadow.

| Sprite | Used in | Replaces emoji |
|---|---|---|
| **Anchor** (16×16) | Deckhand rank, `status-active`, reactions | ⚓ |
| **Knot** (16×16) | Mate rank | 🪢 |
| **Bugle** (16×16) | Bosun rank | 🎺 |
| **Scroll** (16×16) | Quartermaster, Tavern, AI briefing | 📜 |
| **Coin-pile** (16×16) | First Mate rank, ledger | 🪙 |
| **Crown** (16×16) | Captain rank, leaderboard #1 | 👑 |
| **Crossed swords** (16×16) | Commodore rank, force-complete | ⚔️ |
| **Sunrise** (16×16) | Set Sail achievement | 🌅 |
| **Pirate tricorne** (16×16) | Captain's Hat achievement | 🎩 |
| **Diamond** (16×16) | Treasure Hunter achievement | 💎 |
| **Wave** (16×16) | Weekend Warrior, weekend day-card | 🌊 |
| **Flame** (16×16) | Live Free, escalations kind | 🔥 |
| **Flag** (16×16) | Loyal Crew, Tavern reactions | 🏴 |
| **Parrot** (24×24) | Wall of Fame #3, mascot for empty states | 🦜 |
| **Tankard** (16×16) | Tavern reaction | 🍻 |
| **Quill** (12×12) | Tavern scroll corner badge | 🪶 |
| **Envelope** (16×16) | Inbox coverage kind | 📬 |
| **Calendar grid** (16×16) | Meetings, daily check-in, AI briefing | 📅 |
| **Handshake** (16×16) | 1:1s coverage kind | 🤝 |
| **Chat bubble** (16×16) | Slack/Chat kind | 💬 |
| **Pager** (16×16) | On-call kind | 📟 |
| **Email at-sign** (16×16) | Email reachability | 📧 |
| **Phone** (16×16) | Phone reachability | 📞 |
| **Palm island** (16×16) | Unreachable reachability | 🌴 |

24 sprites. A competent pixel artist ships this in 2 days. The visual identity of the product is *complete* after that 2 days. Everything else is polish.

— end audit, 2026-06-01
