# Time Off — Industrial-Design Audit (v1.0)

> Lens: industrial-product designer (Rams / Fukasawa / Ive heritage). Form follows function, but form is never neutral. Less, but better. Materials must be honest. Nothing decorative survives unless it earns its keep.

Source: `app/app.js` (3784 lines), `app/styles.css` (4152 lines), `app/index.html`, four prior audits (`docs/08-11`), and the live build at `https://vacaciones-dev-b3158.web.app`. Read against the Mêlée Night 16 design intent in `docs/06`.

This is not a hierarchy audit (see 09). Not an a11y audit (see 10). Not a copy audit (see 11). This is about whether **the object itself feels well-made when you pick it up**.

I am being uncompromising on purpose. The product is honest enough to be evangelized inside a place like Google — I would not feel embarrassed to show it. But several decisions are still "decorated software" instead of "designed software," and at TAM-level discernment the difference matters.

---

## TL;DR — the single biggest move

**Commit to one material per skin. Right now the Pirate skin is a salad: parchment + pixel sprites + emoji + a Geist gradient mascot bubble + Inter type — five distinct visual languages competing inside the same panel.** Until you pick one and let it own the surface, the product reads as "themed UI kit" rather than "designed tool."

The original Mêlée Night doc (`docs/06`) is a coherent vision. The current implementation has retreated from it (Inter everywhere) without finishing the retreat (the panel chrome, the +N coin float, the dithered scrim, the inset bevels, the stepped animations are all still here). Pick a side. Either go all-in pixel — including the type, the icons, the gradients — or strip the chrome to a flat Apple-Notes-style parchment and let typography carry the warmth.

The Basic and Dark Knight skins do that better than Pirate does. Pirate is the founder's identity but it's the least-disciplined skin.

---

## What's working (so the criticism lands fairly)

Before the dissection, the things I would not change:

- **Login screen.** `renderHarborBg` (`app.js:2423`) is the only screen on this product that earns its fiction. Hand-drawn 320×200 SVG, ocean gradient, dithered sun beams, distant tall ship, palm trees. Restraint: no animation other than the turtle bob. This is what the rest of the product should aspire to.
- **8px spacing grid** (`--sp-1` through `--sp-7` in `styles.css:51–58`). Disciplined. No drift on inner panels.
- **Doubloon SVG sprite** in `index.html:16–32` — hand-coded 16×16 with a four-tone palette (`#5A3A1F` wood ring, `#FFCB47` field, `#E0A93B` body, `#8C6418` glyph, `#FFD86B` highlight). This is the single piece of brand asset on the product that is *genuinely* well-made. Every other "pirate" element is a hat the product is wearing; this is a tool the product owns.
- **`steps()` animations** (`styles.css:548–554` spinner, `587–591` turtle bob, `2608–2614` loading-doubloon spin). Stepped, not eased. Honest about being a digital surface.
- **Skin abstraction is correct.** `[data-skin="…"]` swapping a small set of CSS variables is the right architecture. The problem is what the skins choose to express through them.

Now, the findings.

---

## Findings

### 1. The Pirate panel chrome stack does not earn five box-shadows. P1 / M.

Every clickable surface on the Pirate skin — `.panel`, `.team-card`, `.bounty`, `.create-card`, `.member-card`, `.podium-place`, `.scroll`, `.modal`, `.empty-card` — repeats the same four-layer `box-shadow`: 2px wood-dark outer border, inset 2px top-left highlight, inset 2px bottom-right shade, 4px hard drop. A Braun radio has one chamfer, not four. Every container shouts at the same volume — the visual system has no hierarchy because every surface signals "I am a chiseled object." On the Bounty Board the user sees 6–8 panels all claiming to be the foreground.

**Material restraint, not more decoration.** Reserve the full bevel for the *primary* container on each screen (wallet panel, active bounty card, modal). Demote secondary containers to a single outer 2px wood border, no inset, no drop. Team-list cards on Home and ledger rows in the Chest should be tertiary — flat parchment with a single bottom-edge rule, no bevel. Three tiers, not one.

Concrete edit: introduce `.panel--primary / --secondary / --tertiary` modifiers and strip the bevel from `.team-card`, `.ledger li`, `.audit-entry`, `.bell-list li`, `.scroll`, `.member-card`. Bevel survives only on `.panel.wallet-panel`, `.modal`, `.create-card`, and the active `.bounty`.

---

### 2. The `.bounty` rule is defined twice — desktop layout falls back to auto-placement. P0 / S.

`styles.css:919` defines `.bounty` with `grid-template-areas` covering five named regions (status/requester/window/doubloons/scope/chips/sla/action). `styles.css:1216` redefines `.bounty` with `grid-template-columns: 32px 1fr auto auto` and **no grid-template-areas**. Because the second rule has identical specificity and appears later, it wins on desktop.

Result: on widths above 720px, every child element of the bounty card has a `grid-area:` property pointing at a name that does not exist in the active grid template, so the browser falls back to auto-placement. The cards on the live site read tolerably only because `.bounty-status-area` happens to come first in DOM order. On a 1440px+ monitor the layout has none of the geometric intent the Mêlée Night doc described.

This is a P0 because (a) it's a real bug masquerading as an aesthetic quibble, and (b) the second rule is *legacy* from the old single-row bounty design that was deleted from the JS. It's a CSS ghost.

**Fix:** delete `styles.css:1216–1228` and the `.bounty-flag`, `.bounty-meta`, `.bounty-price` rules at `:1229–1262` that go with it. They're orphaned — `renderBountyCard` does not emit `bounty-flag`, `bounty-meta`, or `bounty-price` selectors. Then promote the desktop `grid-template-areas` from the @media block at `:1006` back to the main rule.

---

### 3. Emoji are not a coherent icon system. P1 / M.

The product uses emoji as iconography in at least eight surfaces: rank icons (`app.js:103–112`), achievement icons (`:115–119`), reachability options (`:48–53`), coverage kinds (`:55–62`), podium emojis (`:3211–3213`), the AI briefing sparkle, the header toggle row (🔔 🔊 🎨), and the manage-crew controls (✏ 🔗 🗑 🏁 📥).

Three concrete problems:

1. **Emoji render differently per OS.** A pirate flag is chunky Apple Color Emoji on macOS, a Segoe line drawing on Windows 11, a Noto vector on Android. "Captain's Hat" (🎩) is a top hat on Apple, a wizard hat on some Linux distros. You have a hand-drawn 16×16 `--brass` SVG doubloon next to a multicolor Apple emoji — visual languages that actively reject each other.
2. **They're sized inconsistently.** The rank-emblem is 64×64 (`styles.css:1454`) holding a 38px emoji that floats inside the box. Achievement badges are 36×36 holding 24px emoji. Status filter chips at 11px have an inline emoji baseline that varies by glyph.
3. **The pirate fiction breaks at every emoji.** A pirate-themed product where the pirate signifiers are imported from the OS is not committing to its own world.

The Mêlée Night doc (`docs/06:115–128`) explicitly specified **10 inline SVG sprites**. Two exist (doubloon, turtle); the rest became emoji. **Finish the sprite sheet.** Replace at minimum the eight rank icons, six coverage-kind icons, and four reachability icons with 16×16 inline SVG in the doubloon's four-tone palette. One day of work; the visual identity moves from "OS emoji on parchment" to "hand-made tool."

The other honest move is to **delete emoji entirely** on the Pirate skin and let typography carry. Either is honest. The current state is "themed default UI."

---

### 4. The bounty card is doing too much. Three lines and a doubloon. P1 / M.

The current card renders nine visual blocks: status badge + crew pill + YOU pill / requester avatar + name / date window + day count + timezone / doubloon amount + "doubloons" / scope box / reachability chips + kind chips / SLA text / action. ~13 text elements, 3+ chips. On a list of 12 open bounties this is overwhelming — the eye cannot land.

Ask the Rams question: *what is this card asking the user to do?* Decide whether to take it. To decide, the user needs three things: **who, when, how much**. Everything else is detail that belongs in the modal.

**Distill to three slots:** (1) requester avatar + name + status verb; (2) date window in plain English + tiny timezone tag; (3) doubloon amount and a single CTA button on the right.

Cut from the card: SLA preview, scope preview, reachability chips, coverage-kind chips, crew progress pill (replace with a thin progress bar under line 2 only in crew mode). The chips are valuable but in the *detail*, not in the list. A bounty list is for triage; the detail is for commitment. A useful comparison: GitHub's Pull Request list. Five lines of metadata per row max. Time Off's current card has eight.

Rewrite `renderBountyCard` (`app.js:2829`) to a 3-row grid with no nested grid, no chips, no SLA, no scope; the modal at `app.js:2147–2169` already has all of that. Card density drops by ~60% and the list becomes scannable.

---

### 5. The doubloon counter typography is two systems pretending to be one. P1 / S.

Silkscreen is a 12-pixel bitmap font (~5px x-height). Inter is a hinted variable font designed for any size. The bounty card sets the doubloon amount in Silkscreen 26px (`styles.css:973–979`) next to "doubloons" in Inter 14px (`:980–985`). These two fonts have wildly different x-heights and baselines, so the doubloon glyph sits ~4px lower than the cap-height of the label, looking off.

Worse, on the Pirate skin where everything else is Inter, the Silkscreen number is the *only* truly pixel element in the running text. It announces itself: "I am the legacy." But the surrounding elements (Inter button, Inter scope, Inter chip labels) have moved on.

**Two valid resolutions, pick one:**

- **Commit to pixel for numbers only**, but treat Silkscreen as the *brand* numeric font and use it consistently in the wallet bucket (`styles.css:1111`), bounty card (`:974`), preview (`:1325`), member stat (`:2095`), wof score (`:1650`), ledger amount (`:1177`), and rank-emblem fallback. Then *kern it* — Silkscreen has loose default spacing; tighten to `letter-spacing: -1px` so a four-digit number doesn't span 80px.
- **Drop Silkscreen entirely on the Pirate skin** and use Inter tabular-numerals (`font-variant-numeric: tabular-nums`) at the same sizes. The numeric values become typographically continuous with the rest of the UI. This is what Basic does and it's why Basic feels lighter.

Currently you have Silkscreen for *some* numbers and Inter for *others* (the rank-progress copy "Earn 23 more doubloons to reach Mate" is Inter; the bucket value is Silkscreen). That's the indecision showing.

---

### 6. The Dark Knight skin uses the wrong typeface for its purpose. P2 / S.

Dark Knight (`styles.css:3415`) declares `'Geist'` for both body and display, and `'Geist Mono'` for numbers and code. Geist is Vercel's display sans — good for marketing pages, awkward for dense product UI. The body type at 16px / line-height 1.6 reads heavy and slightly mechanical in a panel context.

The natural choice for a "warm-dark + amber accent + dev-tool calm" brief is **Inter** (which the rest of the product already uses) at 15px, with Geist Mono kept *only* for code, numbers, and the team-id chip. Using Geist as the body font on a dense list view subtly fights the legibility argument the skin is trying to make.

A simpler stack would also reduce font payload — the product currently imports Inter, Geist, Geist Mono, Silkscreen, Atkinson Hyperlegible all on the first paint via the single `@import url(…)` at `styles.css:1`. 5 typefaces × multiple weights. The font network cost is real on first load.

---

### 7. The login wordmark carries three contradictory styles. P1 / S.

`.login-title` (`styles.css:503–513`) draws Inter weight 900 at 32px with a *stacked pixel-art shadow* (2px + 4px) and 6px letter-spacing — uppercase. Three vocabulary collisions: Inter (humanist sans), pixel shadow stack (arcade), 6px spacing (mid-century display). The 6px space breaks the kerning Inter was designed with — "I" and "M" in TIME float apart as unrelated glyphs. And the stacked shadow appears *nowhere else* on the product; buttons have a single 3,3 offset, headings have none. The wordmark suddenly cosplays as an 80s arcade marquee.

This is the founder's identity question. Either commit to pixel typography (Silkscreen 32px, or a custom pixel logotype matching the doubloon vocabulary) — then the brand is honest. Or commit to modern type (Inter 800, letter-spacing 0.04em, no shadow, `--brass-bright` on the dark sky) and let the harbor SVG carry the fiction. The current state reads as a *costume* of pixel art rather than pixel art itself.

---

### 8. `image-rendering: pixelated` on `<body>` blocks-up Google profile photos. P1 / S.

`styles.css:75` applies `image-rendering: pixelated` to the body. This forces nearest-neighbor scaling on *every* raster image including Google profile photos in the header, bounty cards, member list, and leaderboard. A 96×96 source photo at 32×32 (the typical G-people URL) renders as hard nearest-neighbor blocks — a portrait that looks deliberately broken. Material honesty violated in the opposite direction: a pixel rendering forced onto material (someone's face) that was not designed at 32×32.

**Fix:** scope `image-rendering: pixelated` to inline SVG sprites only (`.brand-logo svg`, `.empty-mascot svg`, `.bounty-flag svg`, `.mascot-sprite svg`, `.stan-portrait svg`, `.avatar-tile-art svg`, `.team-flag svg`) and remove it from `body`. On the Pirate skin, keep it on `.avatar-img` only when the user has picked a custom pirate avatar — Google-photo fallbacks render smoothly.

---

### 9. The header has eight elements with three competing metaphors. P2 / S.

The header right side (`renderUserInfo`, `app.js:2295–2317`) contains: coin-pill, rank-chip, bell, theme-toggle 🎨, sound-toggle 🔊/🔇, avatar-slot, who-block, SIGN OUT. Three are display chips, three are 32×32 emoji-labeled buttons, one is a clickable image, one is a styled "btn-secondary" that competes visually with primary actions elsewhere.

Specific problems: the 🎨 palette emoji for theme is non-obvious; the sound toggle takes header real estate for a feature most users will never enable; the SIGN OUT button inherits full `.btn-secondary` chrome (parchment + bevel + drop shadow) which makes it visually equal to the most important CTA on the page.

**Restructure to four:** coin-pill, bell, avatar (clicking opens a dropdown with rank, theme, sound, sign out). The header becomes one cell of dignity instead of an octopus.

---

### 10. The day-picker card weekend states are pictorially incoherent. P2 / S.

`.day-card.weekend` (`styles.css:1932`) — Saturday and Sunday cards — get a lighter parchment background (`#F4E3B4`) by default. When *selected*, weekend cards become **`var(--lechuck-red)` red with cream text** (`:1940–1946`). This conflates two things: "this is a weekend day, costs more" and "this is selected (i.e., I want it covered)."

A red weekend selection in a list of brass weekday selections looks like a *warning* — like the user has made a mistake. But the user actually wants the weekend covered; the red is supposed to say "pricey." That's two different semantics on one color.

A cleaner version:

- **Selected weekday:** brass background + ink text. Standard.
- **Selected weekend:** brass background + ink text, with a subtle 10px wide dark-red triangle in the top-right corner of the card (or a small `2×` doubloon multiplier glyph). The color says *selected*; the glyph says *premium*.
- **Unselected weekend:** lighter parchment tone (already correct).

This is the Fukasawa principle — *form follows expression* — applied. One affordance per visual variable.

---

### 11. The Stan onboarding has six scenes. Cut to three. P2 / M.

`renderStanScene` (`app.js:2036`) drives a six-scene tour through `STAN_SCENES` (`app.js:85–92`). The user reads narrative copy ("Doubloons are how we trade coverage. 5 buy you one day of shore leave…"), clicks Next, reads, clicks Next. On scene three they realize there are six. The cognitive flow mismatches the affordance (a tiny modal).

The other issue: the portrait floats on `--moonbeam #A6C2E8` (`styles.css:2327`) — a cool blue against the rest of the product's warm parchment. Color discipline breaks here. Use parchment behind the portrait and let Stan be lit from within, not framed by an outside cold panel.

A better tutorial *teaches by doing*: highlight the actual "Post Bounty" tab, show a doubloon counter animating, then let the user post a real bounty with prefilled defaults. The system explains itself by being used.

---

### 12. The mode-toggle (single vs crew) wastes a control on something most users never change. P2 / S.

`renderPostTab` (`app.js:3138–3156`) renders a 2-column mode toggle: "👤 Single coverer" vs "🏴‍☠️ Crew coverage." Both options are presented at the same visual weight as a top-level decision. But the data tells a different story: single-coverer is the default for short windows (1–5 days), crew makes sense only for windows ≥1 week. Posting a 2-day bounty in crew mode is over-engineering.

A Rams version of this would:

1. Default to single coverer with no explicit toggle.
2. Auto-suggest crew mode *only when the window is ≥7 days*, via a small inline note under the date inputs: "Long window — let multiple crewmates split the days? [Enable crew mode]"
3. Make crew mode a small text-link toggle, not a 1/2-screen-wide visual decision.

The current toggle takes the same visual real-estate as the date inputs but represents a much narrower decision. That's affordance over-investment.

---

### 13. The action-row at the bottom of Post is asymmetric and slightly visually broken. P2 / S.

`styles.css:1303–1343` defines `.preview-row` as a flex row with `flex: 1` on the `.preview` (the doubloon cost display) and a `.btn-large` button to its right. On desktop this works. On the breakpoint at 720px the buttons go full-width but the preview keeps its 240px min-width, so the preview block + button stack vertically with the button below — fine. But on a *very* narrow viewport (e.g. 380px Pixel mini), the preview cost (`28px Silkscreen` in `--doubloon` color on `--ink-abyss` indigo) is in a panel that visually competes with the brass "Post bounty" button. They are both saturated, both warm — neither yields to the other.

The post-bounty interaction is a *commit*. The cost preview should be the quiet, factual prelude; the button should be the loud action. Currently they argue.

Fix: drop the preview's `box-shadow: 0 0 0 2px var(--brass);` (`styles.css:1319`) — replace with a 1px solid `var(--wood-dark)`. Reduce the cost number to 22px (still readable). The button keeps its full bevel. Now the preview is information, the button is action.

---

### 14. The "this is yours" indicator has five different visual treatments. P2 / S.

The product marks self-ownership in five ways: `.own-tag` muted uppercase text on the bounty card (`app.js:2852`), `(you)` parenthetical in the bounty detail (`:2093`), color-only on ledger entries, the moonbeam-blue `.wof-row.you` block (`styles.css:1631`) on the leaderboard, and the cyan `.mine-pill` on crew bounties (`app.js:2879`).

None of those treatments is wrong individually; the system is wrong because there is no *single* you-token. Pick one — a brass chevron `▸`, a tiny brass dot, a left-edge brass rule — and apply it consistently. One input gesture across every surface, as on the iPod click-wheel.

---

### 15. The `+N` coin float animation has no spatial anchor. P2 / S.

`styles.css:1398–1414` defines `.coin-shower .pop` — a Silkscreen 22px gold `+N` glyph that floats upward 48px and fades. Triggered by `audio.coin()` events on earning doubloons. The problem: it's positioned via JS at the click coordinates of whatever button just fired, then floats straight up.

In a physical product (or in an iOS app), the +N would *originate from the action source and travel to the wallet*. Tap "Take voyage," the doubloons spawn from the button and float up to the coin-pill in the header. That's an honest motion — it tells the user *where their money is going*. A pure 48px-upward float is decoration without information.

**Fix:** add a CSS variable `--coin-target-x / --coin-target-y` set by JS to the header coin-pill's center, then update `@keyframes coin-float` to animate `translate()` from the source to the target instead of straight up. The visual budget is the same; the meaning gained is enormous.

This is the difference between a delightful particle effect and a confirmation of a transaction. Currently it's the former; it could be the latter.

---

### 16. The `--moonbeam` color is overloaded with three semantics. P2 / S.

`--moonbeam: #A6C2E8` is used for:

1. The "you" highlight on the Wall of Fame row (`styles.css:1632`)
2. The Stan portrait background (`:2327`)
3. The chip-cyan and meeting-link backgrounds (`:865`, `:2007`)
4. The taken-by coverer chip background (`:1036`)
5. The toast info background (`:1389`)

Five distinct semantic uses, one color. Pick the strongest claim (probably "this is yours" — the WoF "you" row) and use moonbeam *only* there. The other four uses degrade to either parchment-bright or a new neutral. A color should mean one thing.

This is the principle Apple HIG borrows from Tufte: minimize the number of categorical visual variables. A user shouldn't have to learn that moonbeam means "you" sometimes and "meeting link" other times.

---

### 17. Mobile ergonomics: the 32×32 control targets in the header fail Fitts's Law. P1 / S.

The bell, sound, theme, and avatar buttons in the header (`styles.css:1675–1687`, `:1754–1767`, `:2255–2261`) are all 32×32. On mobile (< 540px) the breakpoint at `:2649` hides the `.who` block but does not enlarge the controls. Apple HIG, Material, WCAG 2.5.5 all converge on **44×44 minimum** touch target. 32×32 is too small for a thumb on a moving subway.

This is the most direct industrial-ergonomics violation. A handheld tool's controls must fit the hand using them. The 32×32 target is one finger pad's width — fine for a mouse, hostile for a thumb.

**Fix:** on `@media (max-width: 720px)`, set `.bell, .sound-toggle, .avatar-slot { width: 44px; height: 44px; }` and proportionally enlarge the inner emoji to 20–22px. Below 380px (Pixel mini), drop one of the buttons rather than shrink them — but never shrink below 44.

---

### 18. The Dark Knight skin lacks an identity moment. P2 / M.

Pirate has the harbor SVG. Basic has the clean blue CTA. HC has high-yellow-on-black severity. Dark Knight has `#D97757` amber on `#1F1E1D` warm-near-black and good legibility (`styles.css:3672–3679`) — but no story. Switch to it and you get a competent dev-tool dark UI without a moment.

Two options: (a) "captain's quarters at night" — add a single amber lantern SVG at the top-right with one-frame flicker, keeping the pirate fiction in low light, or (b) lean explicit into the dev-tool aesthetic — add a monospaced `> _` cursor next to the wordmark (it already shows up in the skin preview at `styles.css:4136`). Either way the skin needs to do *one* unmistakable thing. Currently it does nothing memorable.

---

### 19. The skin picker preview previews the wordmark but not the chrome. P2 / S.

`showSkinPicker` (`app.js:1414–1436`) renders 4 cards, each with a `.skin-preview-{id}` showing only the wordmark at the skin's font + color (`styles.css:4133–4136`). The user picks based on a 96px tall sample of typography. But the *actual* differences between skins are in the chrome: parchment vs flat-white vs black-borders vs warm-dark-borders.

A more honest picker would render a tiny representative card inside each preview — a 1:1 scaled-down bounty card or wallet bucket. The user picks based on what their actual list will look like, not on how the wordmark looks. This is the IKEA dressing-room principle: you pick the chair you'll sit in, not the showroom wallpaper.

---

### 20. The audio system is invisible by default; the click sound is overhead. P2 / S.

`audio.enabled` defaults to off (`app.js:182`) — correct decision for a workplace tool. But new users will never discover it. Add a one-time tooltip the first time it's enabled ("Sound on — earned doubloons will chime").

More importantly, give audio a *purpose beyond confirmation*. The coin-earn chime (880Hz + 1320Hz square stacks) is genuinely delightful — it tells the user "you got paid." The click sound on every tap (220Hz → 110Hz) is decoration. Drop it; keep coin and toast. Feedback should be informational, not affirmational.

---

### 21. The bounty card status color palette is a rainbow. P1 / S.

`styles.css:794–798` defines five status colors:

```css
.status-open      { background: #FFCB47; color: ink-pure; }  /* yellow */
.status-taken     { background: #5BC9D1; color: ink-pure; }  /* cyan */
.status-active    { background: #6BD18E; color: ink-pure; }  /* green */
.status-done      { background: #C4A86B; color: ink-pure; }  /* parchment-dim brown */
.status-cancelled { background: #C8362D; color: cream; }     /* red */
```

Five colors for five states. That's a lot of color information. A Braun calculator has a black case, a black face, white digits, and *one* red key (the C key). Time Off uses five fully saturated colors to convey state — every bounty card carries one of these like a stamp.

The problem is not that the colors are wrong; it's that they're all at the same saturation. Status of "open" doesn't need to be the same intensity as "cancelled." Cancelled is exceptional; open is the *default* state of the bounty board. The yellow on every card just adds visual chatter.

**Cleaner palette:**

- `open` — no badge or a tiny brass dot (the default — no announcement needed)
- `taken` — soft cyan outline + cyan text (it's in progress, no big deal)
- `active` — soft green outline + green text (similar)
- `done` — neutral grey, low contrast (it's history)
- `cancelled` — red outline + red text (genuinely exceptional)

Reserve the *filled* badges for cancelled only. Other states become *outline* badges. Visual quietude returns to a board that's mostly successful.

---

### 22. The parchment metaphor dissolves on a long list. P1 / M.

Industrial-design check: use the tool for a sustained session. The Pirate skin's parchment metaphor works on a *short* list (3–5 panels). At 20+ panels — what a real busy crew will see — the eye stops noticing texture and starts noticing noise. The inset 2,2 highlight on `--parchment-bright` against `--parchment` is a 1.06:1 contrast ratio at 1× DPR. On a 1080p Windows monitor at office distance the inner bevels just become 1px of mush around every card.

Two-line fix: (1) reduce the inset highlight on secondary surfaces to 1px (`styles.css:1162` ledger, `:2284` avatar-tile, `:2466` tip-hat) — dense lists lose the inner bevel entirely. (2) On the primary surfaces that keep the bevel, raise `--parchment-bright` from `#F7E7C2` to `#FBF0CC` (1.13:1) so the chamfer is legible at 1× DPR too.

The Fukasawa test: does the material still feel like material the 50th time you handle it? Currently parchment-on-dense-list becomes decoration.

---

### 23. Reduce-motion respect is correct but coin-shower is exempted. P2 / S.

`styles.css:4145–4152` sets `animation-duration: 0.001ms !important` on everything except `.mascot-sprite` and `.loading-doubloon` (which are killed explicitly). The coin-shower `.pop` (`:1403–1414`) at 900ms steps(6) is included in the global suppression — good.

But the coin-shower is the *single most diegetic affordance* the product has — it's how the system says "you got paid." With reduce-motion on, the affordance disappears entirely. The system goes silent on the most important action.

**Fix:** with reduce-motion on, replace the float-up animation with a brief 200ms opacity-1-then-opacity-0 fade on the `+N` element, no translation. The user still sees the message; they just don't get the motion. This is a kinder accessibility default than killing the affordance.

---

### 24. Post Bounty is a tab when it should be a button. P2 / S.

The team navigation (`renderTeam`, `app.js:2754–2761`) renders six tabs as peers: Bounty Board / Treasure Chest / Wall of Fame / Crew / Post Bounty / Settings. Posting a bounty is the *active commercial transaction* on this product — it's not a destination, it's an action. Putting it alongside passive destinations like "Hall of Fame" is a category mistake.

A cleaner shape: leave Bounty Board as the default tab, Crew / Treasure / Hall of Fame / Settings as secondary tabs, and promote **Post a Bounty** to a brass primary button in the team header next to the "Share invite" affordance. Now the most important verb on the page reads as a verb.

---

## What I would do tomorrow morning

Three changes, ranked by impact-per-effort:

1. **Delete `.bounty` at `styles.css:1216`** and the four orphaned `.bounty-flag / .bounty-meta / .bounty-price` rules below it. Re-promote `grid-template-areas` to the canonical rule. (Finding #2; 30 minutes.)
2. **Replace the rank, achievement, reachability, and coverage-kind emoji with inline SVG in the four-tone doubloon palette.** This single move transforms the Pirate skin from "themed software" to "designed object." (Finding #3; one day.)
3. **Distill the bounty card to three lines.** Cut the chips, scope preview, and SLA from the list view; let them live in the modal. (Finding #4; half a day.)

Together those three are 1.5 days of work. The lift in perceived quality is disproportionate.

---

## Where I would stop

Three things I would *not* fix even though they're slightly off:

- **The double-drop-shadow on the wordmark.** It's the founder's identity even if it's typographically wrong. Leave it. (Finding #7, partly.) Costume identity beats no identity in a launch context.
- **The audio click on every tap.** It's off by default. Leave it for the users who want it.
- **The mascot turtle's 1.6s bob.** It's the friendliest thing on the login screen. It survives the "would I keep this?" test.

The product is closer to evangelization-ready than these findings suggest. The remaining work is mostly subtractive — cut, restrain, commit. A Rams workshop, not a redesign.

---

## Postscript — the warmth test

The Stan-the-talking-shopkeeper warmth is real in the *copy* (the doubloon vocabulary, the rank names Cabin Boy → Commodore, the Crown's stipend, the Captain's log). It survives the daily-use test there. But the *visual* warmth — the parchment, the hard-pixel shadows, the multicolor emoji — degrades into clutter on a busy bounty board. The copy is signal; the visual decoration becomes noise.

A Rams version of Time Off would keep every word of the copy, replace every emoji with a hand-drawn 16×16 sprite, halve the panel bevels, and let the typography breathe. The pirate fiction would survive in language and in the hand-made icons. Everything else would yield to the work being done.

That's what I would ship.
