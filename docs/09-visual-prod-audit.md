# Vacaciones — Visual Production Audit (v1.0)

Source: design audit performed against `app/styles.css` (3348 lines) and `app/app.js`
(3423 lines, template-literal renders + inline SVG sprite table at line 635), dated
2026-05-29. Three skins shipped: `pirate` (default), `basic`, `hc`. Press Start 2P
and Pixelify Sans were removed in commit `cf9f30f`; the Pirate skin now uses Inter for
everything except the doubloon counters (Silkscreen).

This audit is ruthless on purpose. The app is *close* to production but is being held
back by a handful of fixable visual problems — most of them legacy from the now-dead
pixel typography (8px caps), and a fundamental skin-coverage gap on features added
after the original Mêlée Night doc was written.

---

## 1. First-impression score by skin

| Skin | Hierarchy | Contrast | Density | Polish | Brand identity | Avg |
|---|---|---|---|---|---|---|
| Pirate | 6 | 7 | 5 | 6 | 9 | **6.6** |
| Basic | 7 | 8 | 7 | 7 | 4 | **6.6** |
| HC | 8 | 10 | 6 | 5 | 7 | **7.2** |

### Pirate (default)

Strongest brand. The login screen (`renderHarborBg`, `app.js:2245`) does its job —
moonlit indigo sky, fat cream moon with two ditherer dots, tall ship silhouette,
two lit dock lanterns. It's the only screen on the whole product that earns its
fiction. But the moment you land on Home, the brand drops to chrome:
parchment-on-indigo panels in a grid, hard-edged shadows, lots of small ALL-CAPS
1px-letterspaced text. The panel chrome (`.panel`, line 231) is technically correct
— `0 0 0 2px wood-dark` outer border, `inset 2px 2px` highlight + `inset -2px -2px`
shade, `6px 6px shadow-deep` drop — but the stack reads slightly muddy at 1× DPR
because the highlight is `--parchment-bright` (#F7E7C2) on `--parchment` (#E8D7A8),
a 1.06:1 ratio. On a HiDPI MBP it's crisp; on a 1080p Windows monitor it's mush.

Hierarchy drops badly on the Bounty Board. See §2.

Polish 6/10: the `--shadow-deep #06080F` hard drop is the right move; the issue is
that every clickable surface (team-card, bounty, member-card, modal, podium-place,
scroll, panel) repeats the same 4-shadow stack. The screen ends up with no visual
priority — every container shouts the same volume.

### Basic

Inter, white panels, blue CTA. Works fine as a generic CRM. But it has zero
brand. The login screen is just `VACACIONES` in 32px Inter on `#fafbfd`, no
mascot, no harbor SVG (`[data-skin="basic"] .login-bg { display: none; }`,
line 2996; mascot hidden line 2999). The user has no idea what app they're
in. *That's a problem* — Basic is the skin for people who hate the pirate
schtick; it can't be brand-stripped to the point of being unidentifiable.
Recommend: keep wordmark, drop pirate decor, but add a tiny doubloon icon
or color accent so it still says "this is the coin app."

The `bounty-scope`, `bd-section`, `meeting-row`, `tavern`, `scroll`, `tip-hat`,
`react-btn`, `audit-list`, `stan-portrait`, `crew-coverers`, and `day-card.mine`
selectors **fall through to Pirate parchment** on Basic — see §6 for the list.
This is the biggest single hit to Basic.

Identity score 4/10 is harsh but earned.

### HC

Best functional skin. Pure black/white/yellow palette, Atkinson Hyperlegible
20px body, 3px black borders, 4px yellow drop-shadow. Tabs read at a glance,
status badges have giant labels, focus outlines are 4px solid. This is the
skin a screen-reader-adjacent user can use. It scores the highest because the
constraint *is* the polish.

The polish 5/10 is for the chrome stack. The 4px yellow drop on top of black is
correct for accessibility but visually clashes with the magenta `--voodoo-violet`
on the `ai-briefing` and `rank-hero` blocks — and that pinky magenta with a yellow
drop shadow on a black bg crosses into Vegas-casino territory. Also: the same
fall-through problem as Basic. `scroll`, `tavern`, `react-btn`, etc. all hit a
white parchment-on-black combination with no HC override — they technically work
because the parchment vars get redefined globally, but the contrast on `.tavern h2 {
color: var(--brass); }` (line 2277) → on HC `--brass` is `#ffff00`, on the page
bg `#000`, giving 19.6:1 — fine. The real visual failure is the magenta `ai-briefing`
heading reading "✨ AI briefing" — yellow on magenta, 4.3:1 only.

---

## 2. Visual hierarchy

**On the Bounty Board, the eye lands on the wrong thing.** Look at
`renderBountyCard` (`app.js:2495`) and the `.bounty` grid (`styles.css:837–921`):

```
grid-template-areas:
  "status status doubloons"
  "requester window doubloons"
  "scope scope scope"
  "chips chips chips"
  "sla sla action";
```

Five rows. The doubloon column on the right is the visual winner —
Silkscreen 26px in `--ink-pure` with a coin glyph, top-right, taking ~80px of
horizontal space. Good. But the *information density* of the rest fights it:

- The status badge (`status-badge`, line 703) is 8px ALL CAPS with three inner
  shadows + a 1px black outer border. With Inter at 8px, the letterforms collapse
  to grey blobs unless you zoom in.
- The crew mode pill ("🏴‍☠️ CREW · 2/5") is 8px ALL CAPS, voodoo-violet,
  immediately next to status. Two 8px badges side-by-side with similar shape
  read as one shapeless decoration.
- The "YOU" mine-pill is *also* 8px ALL CAPS, in elaine-cyan.
- The own-tag "YOUR BOUNTY" is *also* 8px ALL CAPS, parchment-dim.
- The taken-by-label "COVERED BY" is *also* 8px ALL CAPS.

That's **five 8px ALL CAPS labels** competing on one card. The original 8px
came from Press Start 2P where letters were 6px wide and meant to be tiny.
Inter at 8px is not crisp at 8px; it's blurry. The card is also sectioned by
a `.bounty-scope` strip with a 3px brass left border (line 912) — yet another
visual element saying "look at me."

**Where CTAs lose**:
- The `Take voyage` / `Claim days` button is the rightmost grid cell, level
  with the SLA line, *below* the price column. It's the call to action but
  it ends up sitting between the SLA (light grey) and the requester (already
  in the top row), so the gravity of the card is "price + status." The user
  has to scan down to find the action.
- On crew-mode bounties, the action is *replaced* by a `.taken-by.crew-coverers`
  stack of avatar mini's. That's even worse — the action button vanishes
  exactly when the card most needs to say "you can still join."

**Fix sketch for the bounty card** (high leverage, low risk):

1. Collapse status + mode + mine into a single inline strip — *one* badge with the status, a thin pill with mode (if crew), and a tiny "you" dot. Lose the redundant own-tag/taken-by labels — replace with an icon.
2. Promote the action button to either bottom-right with a 1px hairline above it, or move it to the right of the price (vertical pair: price on top, button below, same column).
3. Bump status badge from 8px to 11px Inter 700.
4. Kill the `.bounty-scope` brass left border — that 3px stripe is visual noise on every card. The label "Scope:" is enough.

Other hierarchy hits:
- **Home page** (`renderHome`, `app.js:2319`) — the team card has the team name in
  Press-Start-leftover-style **`font-size: 12px`** (line 582) inside a 64px-tall
  card. The team name should be the dominant element; instead the team-id-chip
  in Silkscreen 14px wins. Bump team name to 16-18px Inter 600.
- **Treasure Chest** — the rank-hero panel (`styles.css:1356`) is good. The
  three balance buckets below are equal-weight: each is 28px Silkscreen. But
  the third "Total" bucket has a dark `--ink-abyss` background that screams
  louder than the other two. Then the captain's log header sits a margin
  below. The user's eye does: rank → total (dark) → log header → balances.
  The balances row should lead, then total, then log.

---

## 3. Typography

The Inter-everywhere migration was correct. There are still bugs.

**Current sizes on Pirate (from `:root` block at `styles.css:30`):**
- `--fs-hero: 32px` (login wordmark)
- `--fs-h1: 22px` (page titles)
- `--fs-h2: 18px` (section + modal + panel titles)
- `--fs-body-lg: 18px`
- `--fs-body: 16px`
- `--fs-meta: 14px`
- `--fs-button: 13px`
- `--fs-coin: 20px` (Silkscreen)

**Problems**:

1. **H2 and body-lg both 18px.** The section heading is the same size as a paragraph. Hierarchy collapses. Bump H2 to 19px or 20px, or drop body-lg to 17px.
2. **Inconsistent font weights for the same role.** Section h2 = 700 (line 98), but `bounty-window strong` is set to `font-weight: 400` (line 881) even though it's the main window display. Similarly `scroll-head strong` is 400 (line 2326). The "strong" tag is being used semantically but visually neutered.
3. **The 8px ALL CAPS treatment, applied to Inter, looks wrong everywhere.** It made sense when the body font was Press Start 2P at the same size — that font's letterforms were 6px wide grids with 2px stroke. Inter at 8px is sub-rendering hell. Locations: `.status-badge`, `.own-tag`, `.taken-by-label`, `.mode-pill`, `.mine-pill`, `.role-badge`, `.podium-rank`, `.wof-rank-num`, `.rank-chip`, `.bd-label`, `.bd-section h4`, `.badge-name` (which is 7px!). The Pirate skin override (line 2791) tries to fix it by setting `font-weight: 700` but the size is still 8px (`font-size: 8px` is left untouched on these selectors). **Recommended scale:** drop the 8/7px caps treatment everywhere. Use:
   - Badges and pills: 11px Inter 700, letter-spacing 0.3px, NOT uppercase (preserve case helps recognition).
   - Tiny labels (`.bd-label`, `panel-title`): 12px Inter 600, uppercase, letter-spacing 1px is fine at this size.
   - Body inputs: 16px Inter 500.

4. **Letter-spacing fight with Inter.** Inter is optimized for tight tracking
   (the type designer designed it with `letter-spacing: -0.011em` for body).
   The Pirate-skin override applies `letter-spacing: 0.5px` to all buttons
   and pills, AND `:root .login-title { letter-spacing: -0.5px; }`, AND
   `:root h1, h2, h3, h4 { letter-spacing: -0.005em; }`. Three different
   tracking decisions in one skin. Pick a rule: tight (-0.01em) for display,
   default for body, +0.5px reserved ONLY for ALL CAPS micro-labels.

5. **Tightened scale recommendation**:
   ```
   --fs-hero    36px   (login wordmark)
   --fs-h1      24px   (page titles, weight 800)
   --fs-h2      19px   (section, weight 700)
   --fs-h3      16px   (subsection, weight 700)
   --fs-body-lg 17px   (lead paragraph)
   --fs-body    15px   (body)
   --fs-meta    13px   (caption, secondary)
   --fs-button  13px   (buttons — NOT uppercase except where icon-only)
   --fs-pill    11px   (mode + status pills — NOT uppercase)
   --fs-coin    22px   (Silkscreen)
   ```

6. **The wordmark on login is mixed up.** `:root .login-title` (line 2771) has
   `font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase;`. Inter
   900 at 32px with `-0.5px` tracking is visually congested. For the wordmark
   only, recommend Inter 800 with `letter-spacing: 4px` (the old Press Start
   spacing) — *that* spacing earns its keep when the word is the focal point.

---

## 4. Colour audit (Mêlée Night 16)

**Inventory** (count of usages in `app/styles.css`, grep on the var name):

| Token | Hex | Usages | Doing distinct work? |
|---|---|---|---|
| `--ink-abyss` | #0F1A2E | 28 | yes |
| `--ink-sea` | #1E2D4A | 14 | yes |
| `--parchment` | #E8D7A8 | 47 | yes |
| `--parchment-bright` | #F7E7C2 | 33 | YES, but conflicts with `--cream` (same hex) |
| `--parchment-dim` | #C4A86B | 27 | yes |
| `--wood-dark` | #5A3A1F | 50+ | yes |
| `--ink-pure` | #1A0E08 | 50+ | yes |
| `--ink-faded` | #6B4F30 | 24 | yes |
| `--cream` | #F7E7C2 | 20 | **DUPLICATE of `--parchment-bright`** |
| `--brass` | #E0A93B | 40+ | yes |
| `--brass-bright` | #FFD86B | 21 | yes |
| `--brass-deep` | #8C6418 | 16 | borderline — see below |
| `--doubloon` | #FFCB47 | 9 | YES (3px brighter than brass, hits as gold) |
| `--elaine-cyan` | #5BC9D1 | 7 | yes |
| `--lechuck-red` | #C8362D | 14 | yes |
| `--moonbeam` | #A6C2E8 | 9 | yes |
| `--shadow-deep` | #06080F | 50+ | yes |
| `--voodoo-violet` | #5B3A8C | 6 | yes |
| `--brass-soft` | #e8f0fe | 0 (in Pirate) | ONLY EXISTS in basic skin override at line 2827 — undeclared in Pirate, broken if a Pirate-skin rule references it |

**Findings:**

1. **`--cream` and `--parchment-bright` are the same colour** (#F7E7C2). 53 total usages
   across two tokens for one hex. Audit which usages are semantically "cream on
   dark" vs "bright parchment surface." If they're meaningfully different roles
   keep the tokens; alias one to the other so the hex is in one place.

2. **The four brass tokens — brass / brass-bright / brass-deep / doubloon — are
   doing close-but-distinct work.** brass (#E0A93B) for primary action button.
   brass-bright (#FFD86B) for hover + inset highlight. brass-deep (#8C6418) for
   inset shade + 3D illusion bottom. doubloon (#FFCB47) for coin glyph and "earned"
   amounts. The gap between brass and doubloon is 3% lightness — easy to confuse.
   If you're going to keep both, doubloon should be a clearly more saturated
   yellow (FFCB47 → #FFC107 or similar). Otherwise alias doubloon → brass-bright
   and lose the duplicate.

3. **`brass-soft` is a Basic-skin-only token** (line 2827) and is never used outside
   `[data-skin="basic"]` rules. If anything in a Pirate-skin rule were to ever
   reference it the variable would resolve to `unset` and crash. Currently safe.
   Either rename to `--basic-primary-soft` or document the convention.

4. **WCAG AA contrast spot checks on the Pirate live skin**:

   | Pair | Ratio | Pass? |
   |---|---|---|
   | `--cream` #F7E7C2 on `--ink-sea` #1E2D4A | 12.4:1 | yes |
   | `--parchment-dim` #C4A86B on `--ink-sea` #1E2D4A (`.email`, `.bell-meta`) | 7.6:1 | yes |
   | `--brass` #E0A93B on `--ink-sea` #1E2D4A | 7.0:1 | yes |
   | `--ink-faded` #6B4F30 on `--parchment` #E8D7A8 (`.muted` in panel) | 4.32:1 | yes — barely |
   | `--ink-faded` #6B4F30 on `--parchment-bright` #F7E7C2 (`.bd-label`, `.ledger small`) | 5.0:1 | yes |
   | `--parchment-dim` #C4A86B on `--ink-pure` #1A0E08 (status-done badge text) | 8.4:1 | yes |
   | `--brass-deep` #8C6418 on `--brass` #E0A93B (button inset shade) | 1.96:1 | n/a (visual bevel only, not text) |
   | **`.bell-meta` `--ink-faded` on `--parchment` (`color: var(--ink-faded); font-size: 12px;`)** | 4.32:1 | **borderline at 12px — recommend bumping to 13px or darkening to `--ink-pure`** |
   | `.podium-rank` 10px on `.podium-place.second` #D9D9D9 | 12.0:1 | yes |
   | `--brass` #E0A93B on `--wood-dark` #5A3A1F (header brand text) | 4.7:1 | yes |
   | **`.coin-pill` `--doubloon` #FFCB47 on `--ink-abyss` #0F1A2E (Silkscreen, 20px)** | 12.4:1 | yes |
   | **The `:active` brass button has `--brass-bright` highlight in inset, but the foreground text is `--ink-pure` on `--brass-bright` #FFD86B** | 11.3:1 | yes |
   | **Mascot bubble: `--ink-pure` on `--parchment`** | 13.8:1 | yes |

5. **Borderline / failing pairs**:
   - **`.scroll-msg` `--ink-pure` on `--parchment`** is fine but the `scroll-msg` has `border-top: 1px dashed var(--parchment-dim)` — a dashed line of #C4A86B on #E8D7A8 is barely visible (1.2:1). It's intended as a separator; use `--wood-dark` 1px dashed instead.
   - **`.taken-by` `--ink-pure` text on `--moonbeam` #A6C2E8** background → 9.7:1, fine. But the `.taken-by-label` "COVERED BY" at 8px is so small the contrast is moot — it's the size that fails, not the colour.
   - **`.skin-card-meta small` `--ink-faded` 13px on `--parchment`** → 4.3:1 at 13px is AA-borderline. Bump to 14px.
   - **Pirate skin button text** — `letter-spacing: 0.5px` + `text-transform: uppercase` + Inter 13px at 600 weight on `--brass` #E0A93B. With `--ink-pure` text → 6.4:1, comfortable. Fine.

6. **Color used on HC that fails its own promise**: yellow `#ffff00` on magenta
   `#ff00ff` (the `[data-skin="hc"] .ai-briefing h4`, line 3284). Ratio 4.3:1. Fails
   AAA for an a11y skin and embarrasses the brand promise. Recommend yellow text on
   black background, with magenta confined to a thick left border.

---

## 5. Component polish punch list

| # | Component | File / selector | Issue | Fix |
|---|---|---|---|---|
| 1 | Bounty card | `styles.css:837–921`, `app.js:2495` | Five 8px ALL CAPS labels competing; CTA buried; brass left-border stripe on every scope line | See §2 fix sketch. Also: drop `.bounty-scope` 3px brass `border-left`; use a single chip glyph. |
| 2 | Parchment panel chrome | `styles.css:231–241` | Stacked box-shadows are correct but `inset 2px 2px 0 var(--parchment-bright)` highlight is invisible at 1× — 1.06:1 against parchment | Use `inset 2px 2px 0 #FFF1C5` (lighter than parchment-bright) so the bevel actually catches the eye |
| 3 | Modal scrim | `styles.css:2425–2438` | The dithered 4px scrim pattern is *too obvious* — the 4x4 black-on-translucent checker reads as a busted texture, not a deliberate stylization, at typical viewport sizes | Drop scrim to `rgba(15,26,46,0.72)` with `backdrop-filter: blur(2px)` for Basic; keep dither only on Pirate but reduce contrast — `rgba(0,0,0,0.18)` on the 25% stops, not `0.4` |
| 4 | Day-card picker | `styles.css:1815–1864` | `font-size: 9px` ALL CAPS on `strong`; `:hover` does `transform: translate(-1px,-1px)` with no box-shadow change (looks like a jitter, not a lift); selected weekend is `--lechuck-red` — alarming for what is a friendly "weekend rate ×1.6" cell | Bump `strong` to 11px Inter 700 non-caps. Add a 2px outer shadow on hover so the lift reads. Selected weekend should be brass with a "×2" superscript, not red. |
| 5 | Member-card kebab | `styles.css:2024–2033` | `font-size: 22px` for `⋮` is unidiomatic; opens via JS that's not consistent with other dropdowns; no focus-visible style | Use a 32×32 ghost button with three vertical dots SVG. `:hover` background = `var(--parchment-bright)`. Wire focus-visible to the same brass-dashed outline buttons use. |
| 6 | Audit log entries | `styles.css:2043–2054`, `app.js:3048–3082` | Two columns of `28px 1fr` with `font-size: 16px` icon; reads as a flat list with no time-grouping; emoji icons (`🗑✏⚙💰`) mix with text rhythm awkwardly | Bump time to 13px and right-align it. Replace emoji icons with inline 16×16 SVG glyphs (you already have the pattern). Add subtle day-separator headers ("Today / Yesterday / Earlier this week"). |
| 7 | Scroll reactions | `styles.css:2059–2087` | `.react-btn` is 14px font with a 11px Silkscreen count — three different font metrics on one button (emoji + Silkscreen + bg pixel border) | Make the count Inter 12px 700 to match the button's body text. Drop the 1px outer shadow on hover — the inset on `.mine` is enough state. |
| 8 | AI briefing panel | `styles.css:2092–2105`, `app.js:1994` | Voodoo-violet gradient background reads as "premium" but the brass-bright `h4 { color: var(--brass-bright); }` headline against `linear-gradient(180deg, #5B3A8C 0%, #3a1e60 100%)` is 5.6:1 — fine, but the *3px brass left border* + a violet gradient + cream body text + brass-bright bold-strong inline = four colors on one block | Simplify: pick voodoo-violet `background` (flat, not gradient — gradients on small content blocks waste the effect), `border-left: 4px solid var(--brass-bright)`, drop the `strong` brass-bright override (use cream-bold). |
| 9 | Login harbour SVG | `app.js:2245–2313` | Stunning at 320×200 viewBox. Two issues: `preserveAspectRatio="xMidYMid slice"` means on tall portrait viewports the left/right palms get cropped while the moon disappears upward. Also: the 2-frame torch flicker promised by docs/06 is NOT IMPLEMENTED — the lantern dots are static. | Switch to `xMidYMid meet` with a hand-coded bottom-margin filler that extends the dock plank. Add `<animate>` on the lantern fill colors with `dur="300ms"; values="#FFCB47;#FFE090;#FFCB47"`. |
| 10 | Stan portrait | `app.js:680–703`, `styles.css:2208–2217` | The SVG art is fine, but `.stan-portrait` background is `var(--moonbeam)` (#A6C2E8, light blue). The portrait already has `<rect width="24" height="24" fill="#0F1A2E"/>` as its own background — putting it on moonbeam gives a 2px blue halo. | Either: (a) drop the SVG inner background fill and rely on `.stan-portrait` background; or (b) drop the CSS background and let the SVG's own ink-abyss frame the face. (a) is cleaner. |
| 11 | Doubloon SVG | `index.html:15–30`, `app.js:636–649` | The 16×16 art is perfect for the inline use. Two cosmetic issues: the highlight pixel at `x=4 y=4` (`#FFD86B`) sits in the upper-left corner of the inner gold square — it should be one pixel inset (top: `x=5 y=5`) so it doesn't touch the bezel. Also: on member-stat and ledger usage, the SVG renders at `width: 16; height: 16` inline but the surrounding text is 18px Silkscreen — the coin sits visually low on the baseline. | Fix inset of highlight. Add `vertical-align: -2px` to coin SVG instances in `.bucket strong`, `.member-stat`, `.podium-score`. |
| 12 | Avatar tiles | `styles.css:2154–2191` | All ten avatars use `<rect width="32" height="32" fill="#1E2D4A"/>` as inner background. The tile background is parchment-bright. Looks like blue-on-cream postage stamps. Effective but inconsistent with how `.team-flag` sits on parchment. | Either add a 1px brass frame around each avatar to match the team-flag treatment, or drop the inner blue rect and let the parchment show through. |
| 13 | Bell badge | `styles.css:1607–1622` | `bell-badge` uses `--lechuck-red` for unread notifications. Red dot on top of a brass-framed bell on top of dark-blue header chrome. Three saturated colors stacked. | Use `--brass` for the unread count, change the badge text colour to `--ink-pure`. Red should be reserved for danger states. |
| 14 | Tabs row | `styles.css:654–697` | `font-size: 10px` ALL CAPS on tab labels. Same problem as everywhere else: Inter 10px is unreadable | Bump to 13px Inter 600, non-caps. |
| 15 | Section margins | `styles.css:210`, `2243` | `section { margin-bottom: var(--sp-6); }` (32px). On panel-after-panel pages (chest, settings) this stacks too tall — 32px sections + 24px between panels = 56px between major blocks. | Drop section margin to `--sp-5` (24px) on multi-panel layouts. |
| 16 | Filter chips | `styles.css:728–743` | `font-size: 8px` ALL CAPS — yes, here too. Plus the active chip background is `--brass` with `inset 0 0 0 2px var(--brass-bright)` — a 2px brighter inner ring that with Inter 8px caps reads as a glow halo, not a state | Move to 12px Inter 600, not-caps, with a `box-shadow: 0 0 0 2px var(--brass)` outer ring on active and *no* inner. |
| 17 | Modal title bar | `styles.css:2452–2458` | `font-family: var(--font-display)` (Inter), `font-size: var(--fs-h2)` (18px), but the pirate override at line 2772 forces `font-size: 13px` — so the modal title is *smaller* than the body text inside the modal | Pick one: 14px caps OR 17-18px normal-case. Recommend the latter to follow the Inter-everywhere decision. |
| 18 | Login mascot bubble | `styles.css:487–498` | Tiny 14px text at fixed 180px max width with no tail/pointer to the turtle | Add a 4-pixel triangle tail on the bottom-left of the bubble pointing to the turtle's head. Reuse the `::before` triangle trick from `.stan-speech`. |
| 19 | Coin-shower | `styles.css:1316–1332` | `font-size: 22px` Silkscreen "+N" floats up 48px in 900ms steps(6) — fine. But there's no fade-in or pulse — it just appears | Add `0% { transform: translateY(-8px) scale(0.6); opacity: 0; }` to give a 60ms pop on entry. |
| 20 | Toast | `styles.css:1278–1310` | Toast bg colors are skin-aware but the `.toast-icon` color hard-codes `var(--lechuck-red)` etc. — on HC the toast-icon class isn't overridden so the icon colour is `--lechuck-red` mapped to `#ff0000` on a `#ff0000` `.toast.error` bg → invisible | Add HC overrides: `.toast.error .toast-icon { color: #fff; }`. |

---

## 6. Cross-skin consistency — what breaks on Basic and HC

These selectors have NO override block for `[data-skin="basic"]` or `[data-skin="hc"]`,
so they inherit Pirate parchment/wood-dark colors via the var redefinition. On Basic
the vars are mostly white/grey — looks OK in 60% of cases. On HC, parchment maps to
`#fff`, wood-dark to `#000`, brass to `#ffff00` — sometimes that lands fine,
sometimes it doesn't:

**Broken or off-brand on Basic:**

1. `.tavern h2 { color: var(--brass); }` — on Basic, brass = `#1a73e8` (Google blue), so the Tavern heading turns blue. Inconsistent with section headings elsewhere on Basic (which are `var(--color-text)`). **Fix:** `[data-skin="basic"] .tavern h2 { color: var(--color-text); }`.
2. `.scroll::before { content: '🪶'; background: var(--brass); ... box-shadow: inset 1px 1px 0 var(--brass-bright), inset -1px -1px 0 var(--brass-deep), 0 0 0 2px var(--wood-dark); }` (line 2302). On Basic this becomes a blue corner badge with a blue inset and grey border — looks like a corrupted Slack reaction. **Fix:** flat blue badge, no insets. `[data-skin="basic"] .scroll::before { box-shadow: 0 0 0 1px var(--color-border); }`.
3. `.tip-hat` (line 2344) — `font-family: var(--font-display); font-size: 7px; background: var(--parchment-bright); box-shadow: inset 1px 1px 0 var(--parchment-bright), inset -1px -1px 0 var(--parchment-dim), 0 0 0 1px var(--wood-dark);`. On Basic the parchment vars become whites — the bg is `#fff`, inset is `#fff`, border is `#d2d5d9` — fine, but the 7px font is unreadable Inter. **Fix:** general bump to 11px Inter 700.
4. `.bd-section { background: var(--parchment-bright); border-left: 3px solid var(--brass); }` (line 2406). On Basic, brass = Google blue. A blue-bordered grey card inside the bounty detail modal — clashes with Basic's clean look. **Fix:** `[data-skin="basic"] .bd-section { border-left-color: var(--color-border); background: #fbfbfd; }`.
5. `.crew-coverers / .coverer-stack .avatar-mini { box-shadow: 0 0 0 1px var(--wood-dark), 0 0 0 2px var(--parchment); }` (line 1757). On Basic the parchment becomes #ffffff, wood-dark becomes #d2d5d9 — fine, almost invisible halo (1px grey on white). Avatar stack pictures lose visual separation. **Fix:** `[data-skin="basic"] .coverer-stack .avatar-mini { box-shadow: 0 0 0 2px white, 0 0 0 3px #d2d5d9; }`.
6. `.day-card.mine { background: var(--elaine-cyan); }` (line 1796). On Basic that's the original `#5BC9D1` cyan — works, but doesn't match Basic's blue accent vocabulary. **Fix:** `[data-skin="basic"] .day-card.mine { background: var(--color-primary-soft); border: 1px solid var(--color-primary); color: var(--color-primary); }`.
7. `.audit-entry { background: var(--parchment-bright); border: 1px solid var(--wood-dark); }` (line 2043). On Basic, becomes a 1px grey border around white — invisible against the surrounding white panel. **Fix:** add a subtle background tint or remove border in favor of bottom 1px hairline.
8. `.meeting-links a { background: var(--moonbeam); padding: 2px 6px; border: 1px solid var(--wood-dark); }` (line 1917). Moonbeam (#A6C2E8) doesn't get a Basic override — these chips stay pirate-blue on a white-on-white Basic card. Stands out wrongly. **Fix:** `[data-skin="basic"] .meeting-links a { background: var(--color-primary-soft); border-color: var(--color-primary-soft); color: var(--color-primary); }`.
9. `.empty-card` has `border-image` (line 633) — a 4px dashed wood-dark zigzag border. On Basic this `border-image` is overridden to `none` (line 2913) but the `border-width: 4px; border-style: solid;` from the original rule still apply, leaving a 4px transparent border on Basic empty cards — a 4px white-on-white margin. Visible only as wasted space. **Fix:** add `[data-skin="basic"] .empty-card { border: 0; }`.

**Broken or off-brand on HC:**

10. **`.tavern .scroll::before { content: '🪶'; background: var(--brass); }`** — on HC the `🪶` emoji on `#ffff00` bg inside a black 2px border is visually fine, but the emoji renders in colour (gold/grey) on a colour-only-in-yellow palette. Replace with `🪶` outlined SVG.
11. **`.ai-briefing` on HC** maps to `linear-gradient(180deg, #ff00ff 0%, #3a1e60 100%)` (because `--voodoo-violet` overrides to magenta but the gradient stop `#3a1e60` is hard-coded). Magenta-to-dark-magenta-violet gradient. **Fix:** add `[data-skin="hc"] .ai-briefing { background: #ff00ff; }` (flat).
12. **`.rank-hero` on HC** same problem — line 1357 hard-codes `#3a1e60` in the gradient. **Fix:** flatten on HC.
13. **`.bell-dropdown .dropdown-title { background: var(--wood-dark); color: var(--brass); }`** — on HC that's `#000` text bg with `#ffff00` text. Works. But the list items below have `.bell-list li { border-bottom: 1px solid var(--parchment-dim); }` and on HC parchment-dim is `#ffff00` — 1px yellow lines between list items. Bright and busy.
14. **`.skin-card-meta`** — `.skin-card { border: 2px solid var(--wood-dark); }` (line 3308) — on HC that's 2px black on a 4px yellow drop. Card border ends up thinner than the drop shadow. Inverted hierarchy. **Fix:** `[data-skin="hc"] .skin-card { border: 3px solid #000; }`.
15. **`.podium-place.first { background: #FFD86B; }`** is hard-coded — on HC it stays peach-gold, which doesn't match the yellow/white/black palette. **Fix:** `[data-skin="hc"] .podium-place.first { background: #ffff00; }`.
16. **`.coin-pill` in the header on HC** — line 184–198, has `background: var(--ink-abyss); color: var(--doubloon);` which on HC = `#000` bg, `#ffff00` text. Works. But it's nested in a `--brass` ring + `--brass-bright` inset + `--brass-deep` inset — three different yellows in 1px increments, the inset highlight reads identical to the ring on HC.

---

## 7. Iconography — emoji + SVG mix

Current mix:
- **Inline pixel-art SVG**: doubloon (16×16), flag (32×32), turtle (32×32), stan (24×24), 10 avatars (32×32 each), and the entire login harbour scene.
- **Emoji**: 🪙 (everywhere there's no SVG doubloon — 🪙 is used in Help docs, achievements, status badges), 🍻 ⚓ 🪶 🏴‍☠️ 🦜 (reactions, podium emoji, mode pills, rank icons), 🔔 🔇 🔊 🎨 🔍 (header controls), 📥 ↻ ▶ ◀ ✏ ✨ 💰 🗑 ⚙ 👤 👑 (action buttons), 📅 🤖 (help docs).

**Coherence assessment**: it's a mix that *almost* works on Pirate because the SVG is hand-painted pixel art and the emoji rendering is browser-default Twemoji-style. On Pirate at typical zoom, the mix reads as "old pixel game + retro Mac emojis" — the same kind of mismatch you'd see in a 1996 shareware screensaver. Not terrible. But it absolutely breaks the visual logic of:

- **HC skin**: emoji render in colour. HC's whole rule is yellow/black/white. The `🏴‍☠️` flag on a podium place, the `🦜` parrot for #3, the `🪙` in achievements — all colour emoji on what should be a 3-tone palette. **High priority.**
- **Basic skin**: emoji are fine in Basic since Basic is naturally colourful — but the inline pixel-art turtle as empty-state mascot reads as a cute mistake on an otherwise CRM-looking page.

**Recommendations:**

1. **HC**: Replace every colour emoji currently used as a *meaningful* icon (status, action, rank, mode) with a 16×16 inline SVG glyph in yellow or white. Keep emoji only in user-facing content (reactions are intentional: 🪙🍻🏴‍☠️⚓🦜).
2. **Pirate**: convert the 10 most-used action emojis (▶ ◀ ✏ 🔔 🔇 🔊 🎨 ↻ 📥 ✨) to inline pixel SVG. The existing 16×16 pixel-art style would unify the header chrome instantly. The remaining "narrative" emojis (🪙🍻🏴‍☠️⚓🦜🪶) stay as emoji since they're decorative.
3. **Basic**: the inline pixel-art mascot (turtle, stan) is *out of place*. Either drop the mascot on Basic (`[data-skin="basic"] .empty-mascot { display: none; }`) or swap to a clean 96×96 line-art SVG for Basic only.
4. **The 🏴‍☠️ pirate-flag emoji is rendered inside Inter-styled .mode-pill labels with letter-spacing 0.5px** — the emoji glyph is much wider than expected and pushes the text out unevenly. Either drop emoji inside `.mode-pill` or replace with the inline `SVG.flag` 16×16 art.

---

## 8. Empty / loading / error state visuals

**Loading**: `<div class="loading"><span class="loading-doubloon">${SVG.doubloon}</span>…</div>` is repeated five places (`app.js:2173, 2850, 2928, 2981`). The doubloon does the 4-step `coin-spin` `scaleX(1) → 0.5 → 0 → 0.5 → 1`. It works. But the loading copy is six different strings ("Loading the harbor", "Reading the ship's logs", "Mustering the crew", "Loading the captain's ledger") which is charming but inconsistent. **Recommendation:** unify on three loading strings keyed by domain: data ("Loading…"), crew ("Mustering crew…"), economy ("Counting the coins…").

**Empty cards**: `.empty-card` (`styles.css:625–648`) uses a 4px wood-dark dashed border (via `border-image: repeating-linear-gradient(45deg, var(--wood-dark) 0 8px, transparent 8px 16px) 4`). This is the only place on the whole product using `border-image`. It looks **off** at 1× DPR because gradient-derived dashes don't subpixel-render the way SVG dashes do. **Fix:** swap to a regular `border: 4px dashed var(--wood-dark)` and use `outline-style: dashed` to get crisper rendering. Or move to inline SVG border element.

**Empty card variants** (turtle mascot + "No covers yet" / "The bounty board is empty" / "No crew yet" / "Empty roster" / "Crew not found") all use the same `SVG.turtle` mascot at 96×96. The inconsistency in *the text rhythm* hurts more than the visuals: "**No covers yet.**" + "The wall fills as crewmates earn doubloons" is two sentences, while "**The bounty board is empty.**" + "Post one yourself — your crewmates earn doubloons by covering you." is two sentences with an em-dash. Standardize on one-sentence-bold + one-sentence-muted.

**Error states**: There is no visual error state component. Errors land as toasts only (`#toast` div, `app.js` uses `showToast(err.message, 'error')`). Toast `font-family: Inter 16px` on `#F0C8C5` bg with `--ink-pure` text — fine. But:
- **Toast bg on Pirate `.toast.error` = `#F0C8C5`** (line 1302). On Basic that's unchanged (no `[data-skin="basic"] .toast.error` override), so we get a peachy-pink toast on a Material-looking Basic skin — out of place. **Fix:** `[data-skin="basic"] .toast.error { background: #fce8e6; color: #c5221f; }`.
- **No inline form error**. Per the UX audit `docs/05-ux-audit.md` §73, inline field errors are needed. Not yet built.

---

## 9. Production-ready visual checklist

### Must fix before launch

- [ ] **Typography**: Remove every 8px ALL CAPS Inter usage. Bump to 11–12px Inter 700 with normal case. Affects `.status-badge, .own-tag, .taken-by-label, .mode-pill, .mine-pill, .role-badge, .podium-rank, .wof-rank-num, .rank-chip, .bd-label, .bd-section h4, .badge-name, .filter-chip, .tab` (line refs in §3 and §5). Single most impactful change.
- [ ] **Skin coverage gap**: Add `[data-skin="basic"]` AND `[data-skin="hc"]` overrides for `.tavern h2, .scroll::before, .tip-hat, .bd-section, .crew-coverers .avatar-mini, .day-card.mine, .audit-entry, .meeting-links a, .empty-card, .toast.error, .toast.success, .toast.info, .toast-icon` (§6). Use the 8 listed fixes verbatim.
- [ ] **`.bell-meta` 12px contrast borderline** — bump to 13px.
- [ ] **HC `.ai-briefing` flat magenta** (not gradient) — `background: #ff00ff;` only; gradient breaks the palette.
- [ ] **HC `.bell-list li` border** — change yellow inter-line border to 2px black hairline.
- [ ] **HC emoji icons in status/mode/rank/action** — replace with monochrome inline SVG (yellow or white).
- [ ] **Basic empty-card transparent 4px border** — set `border: 0` on Basic.
- [ ] **Basic login screen brand identity** — keep wordmark, add a 16×16 doubloon icon to the left of the wordmark so the brand isn't *just* the word "VACACIONES".
- [ ] **Bounty-card hierarchy**: collapse the 5-row grid to 3 rows (header, body, action). Bump status badge to 11px. Drop `.bounty-scope` brass left border. Drop "OWN" and "TAKEN-BY" ALL CAPS labels in favor of icon + name.
- [ ] **Login harbour**: torch flicker animation is documented but not implemented.
- [ ] **Coin SVG vertical alignment** in `.bucket strong`, `.member-stat`, `.podium-score` — coin sits below baseline.
- [ ] **Avatar inner blue rect bleeding through avatar-tile background** — drop the inner `<rect width="32" height="32" fill="#1E2D4A"/>` from each avatar SVG so the avatar tile background shows through.
- [ ] **Modal title pirate-override smaller than body** — pirate skin `:root .modal-title { font-size: 13px; }` (line 2772) overrides the base 18px to 13px. That's the modal *title* smaller than the *body*. Bump to 15–16px.

### Polish (not blocking)

- [ ] Drop duplicate `--cream` / `--parchment-bright` to a single token.
- [ ] Tighten the type scale (§3 recommended scale).
- [ ] `--brass-soft` is Basic-only and undocumented — rename to `--basic-primary-soft` or drop.
- [ ] Audit-log day groupings (Today / Yesterday / This week).
- [ ] Loading-string consolidation to 3 keys.
- [ ] Coin shower fade-in pop on entry.
- [ ] `.empty-card` swap `border-image` → `border-style: dashed`.
- [ ] Stan portrait — drop inner ink-abyss rect, let CSS background frame the face.
- [ ] Member-card kebab → SVG vertical dots ghost button.
- [ ] Replace 10 most-used action emoji with inline 16×16 SVG to unify icon style.
- [ ] Tip-hat button → 11px Inter 700.
- [ ] Day-card weekend-selected `--lechuck-red` → `--brass` with `×2` superscript.

---

## 10. Five highest-leverage visual fixes for v1.0

Ranked by hit-per-hour.

**1. Kill every 8px ALL CAPS Inter label. (≈1.5 hours.)** Tightens 14+ components in one pass. Single biggest visual lift. Find/replace `font-size: 7px` and `font-size: 8px` in `styles.css`, bump to 11px, drop `text-transform: uppercase` where the size allows.

**2. Add Basic + HC overrides for the 13 fall-through selectors in §6. (≈2 hours.)** Right now Basic and HC are partial — the "later-added" components (tavern, scrolls, reactions, audit, AI briefing, day-card.mine, meeting-links) leak Pirate parchment colours through. Adding ~30 lines of CSS to each `data-skin` block closes the gap.

**3. Restructure the bounty card. (≈3 hours.)** It's the single most-viewed card in the app. Current 5-row grid with 5 competing ALL CAPS pills + buried CTA is hostile to scanning. Fix per §2 sketch (collapse to 3 rows, promote CTA, kill scope stripe). This will visibly raise quality more than any other single change.

**4. Tighten the type scale + restore wordmark spacing. (≈1 hour.)** Implement the recommended scale in §3. Set `--fs-h2: 20px` so headings beat body. Restore `letter-spacing: 4px` on `.login-title` (the one place wide tracking earns its keep). Drop the `letter-spacing: -0.005em` from h1-h4 since Inter ships with appropriate built-in tracking.

**5. Login screen polish — torch flicker + Basic brand identity. (≈1.5 hours.)** First impression matters more than any other screen. (a) Add the 3-frame torch flicker animation on the two harbour lanterns per docs/06. (b) On Basic, add a 16×16 inline doubloon SVG next to the wordmark so the login screen identifies the app at a glance.

---

## Appendix — quick reference of selectors mentioned

| Selector | File | Line |
|---|---|---|
| `:root` palette | styles.css | 9–57 |
| `.panel` chrome | styles.css | 231–241 |
| `.btn`, `.btn-secondary`, etc. | styles.css | 261–336 |
| `.team-card` (home) | styles.css | 543–602 |
| `.bounty` grid (legacy) | styles.css | 837–921 |
| `.bounty` grid (override later) | styles.css | 1127–1180 |
| `.tabs / .tab` | styles.css | 654–697 |
| `.status-badge` | styles.css | 703–716 |
| `.filter-chip` | styles.css | 728–743 |
| `.bucket` (wallet) | styles.css | 1017–1066 |
| `.rank-hero / .rank-emblem` | styles.css | 1356–1411 |
| `.podium-place / .wof-row` | styles.css | 1471–1573 |
| `.mode-pill / .mine-pill` | styles.css | 1727–1747 |
| `.day-card` picker | styles.css | 1809–1864 |
| `.member-card / .kebab` | styles.css | 1962–2033 |
| `.audit-entry` | styles.css | 2038–2054 |
| `.react-btn` (scroll reactions) | styles.css | 2059–2087 |
| `.ai-briefing` | styles.css | 2092–2105 |
| `.scroll / .tip-hat` (Tavern) | styles.css | 2284–2355 |
| `.bd-section` (bounty detail) | styles.css | 2406–2419 |
| `.modal-scrim / .modal` | styles.css | 2425–2472 |
| Pirate skin overrides | styles.css | 2763–2802 |
| Basic skin overrides | styles.css | 2805–3036 |
| HC skin overrides | styles.css | 3039–3294 |
| `SVG` sprite table | app.js | 635–729 |
| `renderLogin / renderHarborBg` | app.js | 2217–2313 |
| `renderHome` | app.js | 2319–2373 |
| `renderBountyCard` | app.js | 2495–2571 |
| `renderChestTab` | app.js | 2574–2645 |
| `renderPostTab` | app.js | 2759–2845 |
| `renderTavern` | app.js | 3089–3134 |

— end audit, 2026-05-29
