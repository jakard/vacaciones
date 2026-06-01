# 12 — Apple HIG audit (Sonoma / iOS 17 / visionOS-era lens)

Reviewer: a Senior Designer on a Human Interface team, briefed to ship Time Off
under the Apple Design Resources bar. Codebase audited at commit `61e661a`:
`app/index.html` (60 lines), `app/styles.css` (4,152 lines), `app/app.js` (3,784 lines).

This is not the same review as docs 08-11. Those covered UX flow, visual
hierarchy, accessibility and copy. This document is opinionated about
**material design language under the modern Apple discipline** — depth, motion,
typography, restraint, platform convention. The team has already removed Press
Start 2P, fixed contrast on parchment, added a focus ring, added a Dark Knight
skin that proves they know what restrained looks like. Good. The next move is
to stop treating the parchment Pirate skin as the "fun default" and the rest as
afterthoughts. **The Pirate skin, as it stands, is the cringe.** Senior product
adopters at Google will load the page once, see a pirate cartoon and
pixel-shadow boxes, and never come back unless they manually toggle to Dark
Knight. The audit makes that case ruthlessly and tells you what to ship.

---

## 0. Headline

> **Make Dark Knight the default skin, and rebuild the Pirate skin from
> scratch as a *whisper* of pirate (one wordmark mark, one accent color,
> one mascot in a single delightful surface) rather than a costume the whole
> product wears.**

Everything else is a corollary.

---

## 1. The skin problem is the product problem

`app/app.js:170-178` reads:

```js
const skin = {
  current() { return localStorage.getItem('vacaciones.skin') || 'pirate'; },
  ...
};
skin.set(skin.current());
```

A new TAM lands on `https://vacaciones-dev-b3158.web.app`, gets the pirate
parchment skin by default, sees the harbor SVG with two pirates on laptops,
sees `TIME OFF` in 32px gold with a 2px+4px hard text-shadow stack
(`styles.css:507-510`), and sees a mascot turtle bobbing in the corner. The
first instinct of a senior IC at Google is to close the tab. They are not the
audience for a vacation game; they are the audience for a vacation tool. If
the product can be a tool that *winks* at piracy, it works. If it has to be a
game that pretends to do work, it does not.

The team already built the right thing — **Dark Knight**. The skin starts at
`styles.css:3415`:

- Geist + Geist Mono — the kind of typeface a modern dev tool uses.
- Warm-dark `#1F1E1D` background, amber `#D97757` accent — restrained, calm.
- 1px borders, 8-10px radius, gentle `0 1px 2px rgba(0,0,0,0.3)` shadows.
- Tabs that are simple text + 2px underline (`styles.css:3737-3753`).
- Status badges that are 11px outline pills with semantic color tinting
  (`styles.css:3763-3778`).
- Form labels that are 13px sentence case `var(--color-muted)` rather than
  11px caps `letter-spacing: 1px`.

This is the skin that would survive an Apple critique. Make it the default.
Move the pirate fantasy to an opt-in **"theme"** the way macOS lets you set
Light/Dark/Auto. The default should be the modern, restrained surface; the
pirate skin should be the personality lever, not the front door.

Concrete acceptance: change the fallback in `skin.current()` from `'pirate'`
to `'dark-knight'`, ship a `prefers-color-scheme: dark` autoselect that picks
`dark-knight` for dark / `basic` for light when no preference is stored, and
move skin selection into a "Theme" submenu of an Account/Profile sheet rather
than a 🎨 button in the header.

---

## 2. The pixel-shadow box stack is the whole identity problem in one prop

Look at `.panel` (`styles.css:232-242`):

```css
.panel {
  background: var(--parchment);
  box-shadow:
    0 0 0 2px var(--wood-dark),
    inset 2px 2px 0 var(--parchment-bright),
    inset -2px -2px 0 var(--parchment-dim),
    6px 6px 0 0 var(--shadow-deep);
}
```

Four shadows. A 2px outer border via offsetless shadow. A 2px inner
highlight. A 2px inner shadow. A 6px hard offset drop. **This is a pixel-art
box drawn in CSS**, and it is repeated on `.panel`, `.team-card`,
`.bounty`, `.create-card`, `.wallet-panel`, `.empty-card` (with a dashed
border-image to make it worse, `styles.css:715-722`), `.scroll`,
`.member-card`, `.podium-place`, `.modal`. Every surface in the product wears
the same costume. The eye has no priority. Even the high-touch modal at
`styles.css:2555-2566` carries the same stack with a slightly larger drop.

An Apple designer would think in **elevation tiers**:

| Tier | Use | Treatment |
|---|---|---|
| 0 | Background | Flat |
| 1 | Inline content (list rows) | `1px solid border-subtle`, no shadow |
| 2 | Cards (bounty, team) | `border-subtle` + `0 1px 2px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.02)` |
| 3 | Floating menus (bell dropdown) | `0 4px 12px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)` |
| 4 | Sheets / modals | `0 16px 48px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)` plus a scrim |
| 5 | Active drag overlay | Tier-4 plus a subtle 1.02 scale |

Dark Knight already does tier 2 well at `styles.css:3580-3586`. Pirate does
not have tiers at all. **Concrete fix:** define `--elev-1` through
`--elev-4` as CSS custom properties at the `:root` level, set Pirate-skin
overrides to gentle shadows (not the 6px hard offset), and remove the
`inset highlight + inset shadow + 6px hard drop` stack from every surface
that isn't the **single most important** card on the page. Right now every
container competes equally.

The dashed border on `.empty-card` (`styles.css:715`) is the worst single
expression of this — a stitched piratey "you are looking at a sign" frame.
Apple's empty states are quiet: a 56px outline glyph (Symbols Pro,
`pencil.slash` weight ultralight), 17pt headline, 13pt body, no border.
Replace it.

---

## 3. Typography — the hierarchy is fighting itself

In the Pirate skin (which is what 99% of users see on first visit), the type
system is technically Inter everywhere, with Silkscreen reserved for "coin
counters" (`styles.css:31-44`). On paper this is fine. In practice:

### 3.1 Two parallel scales, neither following 8pt rhythm

`styles.css:32-39` defines:
- `--fs-hero: 32` / `--fs-h1: 22` / `--fs-h2: 18` / `--fs-body-lg: 18` /
  `--fs-body: 16` / `--fs-meta: 14` / `--fs-button: 13` / `--fs-coin: 20`.

There are **four** sizes between 13 and 22 (13/14/16/18/20/22). Apple's
modern type scale uses semantic names — Large Title 34 / Title1 28 / Title2
22 / Title3 20 / Headline 17 / Body 17 / Callout 16 / Subhead 15 / Footnote
13 / Caption 12. The Time Off scale is *almost* there, but the gap between
Body (16) and Body Large (18) is 2 px — a Tim Cook-era Apple designer would
collapse this to a single 17pt body and let bold + line height handle weight,
not size.

The Silkscreen exception for coins is the single tone-deaf choice in the
type system. The doubloon counter at `styles.css:185-199` and 974, 1112,
1178, 1249 is rendered as `font-family: 'Silkscreen', monospace; font-size:
20-28px;`. Silkscreen is a *bitmap* face — at 20px on a 1× display, its
strokes look ragged next to Inter body text. **This is the single most "this
is a game" signal in the product.** Compare to how Apple Wallet renders a
balance — SF Pro Rounded Bold tabular figures at 24pt. A modern-feeling
balance is a numerical font with `font-feature-settings: "tnum" 1, "ss01" 1`,
not a pixel font with no antialiasing.

**Fix:** replace Silkscreen across the entire codebase with
`font-feature-settings: "tnum" 1` Inter Bold (or Geist Mono in Dark Knight)
at the same size. The "coin" feeling can come from the gold SVG, not the
typeface. Search-and-replace: `'Silkscreen', monospace` → `var(--font-mono)`
and let each skin define `--font-mono` (Dark Knight already does at
`styles.css:3459`).

### 3.2 ALL-CAPS storm

Every panel-title, every tab label, every status badge, every button, every
filter chip, every section heading is ALL-CAPS with `letter-spacing: 1-2px`.
`renderPostTab` at `app.js:3093-3179` shows it most clearly — six 11px
ALL-CAPS labels in a single form (`Shore leave from`, `Returning by`,
`Timezone`, `What you're covered for`, `How reachable while away`,
`Coverage mode`). The brain has to *decode* these. A senior Apple designer
would write them as sentence-case labels at 13pt regular weight, period.

The Dark Knight override at `styles.css:3501-3528` already strips text-
transform and letter-spacing on every label, badge and chip. Carry that
pattern back into Pirate too — the "uppercase letter-spacing for emphasis"
trope is mid-2010s Material Design and reads as dated.

### 3.3 Line height is overcooked on body

`html, body { line-height: 1.55; }` (`styles.css:71`). For 16px Inter this
is generous. For 14px meta (`.muted`, `.bd-label`, etc.) the same 1.55 makes
small text gappy. Apple uses 1.29-1.37 for body and 1.22 for small caption.
Set `--line-body: 1.45` and override `--line-tight: 1.25` for any element
under 13pt.

### 3.4 The wordmark text-shadow

`.login-title` (`styles.css:503-513`): `text-shadow: 2px 2px 0 shadow-deep,
4px 4px 0 rgba(0,0,0,0.6); letter-spacing: 6px;`. Two hard offset shadows
plus 6px tracking. This is what a 1995 Quake mod menu looked like. It is the
first thing a user sees. The `.login-title` already lives inside a glass
card with `backdrop-filter: blur(6px)` (`styles.css:497`), which is
correct — but the title on top of it is fighting the glass with two hard
shadows. Pick one or the other. Apple would pick: 36pt SF Pro semibold,
zero shadow, on the blur card, period.

---

## 4. The login hero is the single most consequential cringe

The login screen at `app/app.js:2395-2421` and `renderHarborBg` at
`app/app.js:2424` onward render a **2,540-line inline SVG** of two pirates
sitting in beach chairs with little laptops on their knees, under palm
trees, with a parrot, a beach umbrella, a tall ship on the horizon, a
setting pixel sun.

Reading the SVG source out loud: rects for the sky, stars, sun, ship, ocean
waves, beach, palm trees, coconuts, parrot, umbrella, chair, two pirates'
bodies, heads, eyepatches, beards, tricorn hats, bandanas, laptops. The
craftsmanship of the pixel art is *real* — see `app.js:2497-2614`. It is also
the single largest signal that this is not a serious enterprise app.

A senior Apple designer would not ship this on the front door. The Apple Card
sign-up flow has *one* abstract gradient and a single hero icon. Notes opens
on a clean blank page. Reminders opens on a list. The current Time Off hero
puts the cartoon ahead of the value proposition.

**What to do instead:** keep the SVG, but never show it on the front door.
Move it to a `/about` page or — better — to a small 64x64 doubloon-on-
parchment thumbnail next to a clean two-column login layout:

- Left column: tagline (*"Coverage marketplace for Google TAMs. Post a
  bounty, take time off without dropping the ball."* — borrow from
  `index.html:7`).
- Right column: a single `Continue with Google` button (Apple-style, full
  width, neutral grey with the Google `G` mark), small print: *"Read-only
  access to your Calendar after you opt in."*
- Above the columns: a 28px wordmark in Inter Semibold, no text-shadow, the
  doubloon SVG sized to 24x24.

The pirate scene becomes a 200x140px illustration *inside* a "Stan's
Onboarding" sheet for new users, not the unauthenticated home page. That
turns the pixel art from a liability into a delightful Easter egg.

Concrete acceptance: rip `renderHarborBg`'s 200+ rects out of `renderLogin`
and keep them under a feature-flagged decorative SVG that appears only on
the empty-Home state for first-time users. Replace `.login-screen
background: linear-gradient(180deg, #1A0E40 → #FFCB47)` with a calm
`linear-gradient(180deg, #FAF9F5 → #F1EDE5)` on the Pirate skin
specifically (the Dark Knight version already does this correctly at
`styles.css:3927-3929`).

---

## 5. The modal scrim is broken

`.modal-scrim` at `styles.css:2540-2554`:

```css
.modal-scrim {
  background: rgba(15, 26, 46, 0.78);
  background-image:
    linear-gradient(45deg, rgba(0,0,0,0.4) 25%, transparent 25%, transparent 75%, rgba(0,0,0,0.4) 75%),
    linear-gradient(45deg, rgba(0,0,0,0.4) 25%, transparent 25%, transparent 75%, rgba(0,0,0,0.4) 75%);
  background-size: 4px 4px;
  background-position: 0 0, 2px 2px;
}
```

This applies a **checkered dithered pattern** over the entire screen behind
the modal. It is the Adventure Game ™ pattern. In the Pirate skin this is
charming once; in any serious enterprise context it is unusable. The modal
content beneath the scrim becomes hard to ignore because the eye keeps
catching the 4x4 dither.

Apple in 2024 uses one scrim treatment: `background: rgba(0,0,0,0.38);
backdrop-filter: blur(20px) saturate(180%);`. Vibrancy + saturation does
all the work. The blur makes the background recede; the saturation keeps
the modal in context. The dither must die.

Dark Knight already does the right thing at `styles.css:3818-3826`:
`background: rgba(0,0,0,0.7); backdrop-filter: blur(2px);` — though
`blur(2px)` is too mild. Push it to `blur(20px) saturate(180%)` and use
the same treatment across all four skins.

There is no close (×) affordance on the modal. The current pattern at
`app.js:1938-2028` puts an "OK" primary and (sometimes) a "Cancel" or
custom secondary at the bottom-right. Two issues:

1. Apple sheets always have a "Done" (top-right) or "Cancel" (top-left) in
   the chrome, *plus* contextual primary actions in the body or bottom
   toolbar. Time Off conflates "close the modal" with "complete the
   action" — see `showBountyDetail` where the primary on a completed bounty
   is "Send Thank-You Scroll" with no "Close" — only a "Close" secondary,
   which is the wrong button geometry.
2. Esc-to-close works (`app.js:1978-1983`) but is invisible. Users on
   trackpads expect a close affordance.

**Fix:** add a small × control to the top-right of `.modal-title` styled
as an SF-Symbol-equivalent (`mask-image` of an X glyph, 32x32 tap target,
`color: var(--color-muted)`). Keep the body buttons for action commitment.

---

## 6. Motion — all `steps(N)`, no spring

Search the entire stylesheet for transitions (`grep transition`,
`grep @keyframes`). What you find:

- `animation: spin-step 600ms steps(4) infinite` on the loading doubloon
  (`styles.css:549, 2605`)
- `animation: turtle-bob 1.6s steps(2) infinite` on the mascot
  (`styles.css:585`)
- `animation: toast-in 240ms steps(4)` (`styles.css:1375`)
- `animation: coin-float 900ms steps(6) forwards` (`styles.css:1409`)
- `transition: width 0.3s steps(8)` on the rank bar (`styles.css:1492`)
- `transition: none` on `.btn` (`styles.css:277`)

Every single piece of motion in this product is **chunked steps()**, which
is the pixel-art animation discipline (4-frame walk cycle, 6-frame
explosion). It is the right call for a console game from 1992. It is the
wrong call for a 2026 web app.

Apple in 2024 uses **spring physics**. The actual easing curves Apple ships:

- `cubic-bezier(0.22, 1, 0.36, 1)` — "out quint" for affordance feedback
- `cubic-bezier(0.5, 0, 0.5, 1)` — symmetric for crossfades
- spring damping ~0.8, stiffness ~200 for sheets

Every transition under 200ms. Sheet transitions 350-500ms. **Linear or
stepped motion is reserved for loading indicators, never for user
affordances.**

**Concrete fix:** introduce a `--ease-out` and `--ease-spring` token at
the root, replace every `steps(N)` with the equivalent smooth curve on
non-Pirate skins, and on the Pirate skin only keep the stepped motion for
the loading doubloon and the coin-float (where the chunked motion is
diegetic). Buttons need a `transition: transform 120ms var(--ease-out),
box-shadow 120ms var(--ease-out)` so the hover/active states feel snappy.

The current `:active` treatment on buttons literally **translates the
button 3px** (`styles.css:281`) — Apple uses opacity dim + 0.96 scale,
which feels firm rather than wobbly.

---

## 7. The header is structurally wrong for the device

`#header` at `styles.css:127-140`:

```css
#header {
  height: 48px;
  background: var(--wood-dark);
  position: sticky;
  box-shadow:
    0 2px 0 var(--brass),
    0 4px 0 var(--shadow-deep);
}
```

A 48px header on desktop is tight (Apple uses 52-60), and the
`0 2px 0 brass, 0 4px 0 shadow` is the same hard double-offset shadow stack
as everywhere else. The header looks like a wooden plank glued to the top.

Look at what's *in* the header at `app.js:2283-2317`. From left: brand mark
+ "TIME OFF" wordmark. From right: coin pill (Silkscreen, 20px gold on
indigo with 4-shadow stack), rank chip (voodoo violet, 11px caps), bell with
red dot badge, 🎨 paint emoji button, 🔊/🔇 emoji button, avatar img with
2px brass + 4px shadow ring, full name, full email, sign-out button.

**Eight elements in a 48px bar.** On a 1366×768 ChromeBook this is going to
wrap. On a 540px breakpoint it does wrap badly — `.who { display: none; }`
hides name+email but the rest stays. The information density is wrong
for a header: rank chip and the wallet pill are header-elevated stats that
on Apple Settings would live on the *root* of the wallet view, not in the
chrome.

**Fix:** keep only brand, bell, avatar in the header. Move the coin pill
and rank chip into a "Wallet" tile on the Home page and into the
Treasure Chest tab. Move the sign-out button into a profile sheet that
opens from tapping the avatar. The skin/sound toggles belong in that same
profile sheet under "Settings", not as header chrome.

This is what a 2024 Apple designer would call **chrome restraint**. The
header should be a *navigation surface*, not a HUD.

---

## 8. Iconography — emojis are not icons

Across `app.js`, every action surface uses an emoji as its icon glyph:

- 🌴 🌊 ⚓ 🪙 📅 📧 📞 💬 🤝 📟 🔥 (reachability + coverage kinds,
  `app.js:48-62`)
- 🪶 (scroll), 🏴‍☠️ (crew mode), 👤 (single coverer)
- 🔔 (bell), 🎨 (skin picker), 🔊 / 🔇 (sound)
- 📥 (CSV download), ↻ (refresh), ▶ (arrow), ✏ (manage), 🔗 (invite link),
  🏁 (force-complete), 🪙 (coin)
- 🧒 ⚓ 🪢 🎺 📜 🪙 👑 ⚔️ (rank icons, `app.js:103-112`)
- 🌅 ⚓ 🎩 💎 🌊 📜 🔥 🏴 (achievement icons, `app.js:115-124`)

There are three problems with this:

1. **Cross-platform inconsistency.** A 🏴‍☠️ ZWJ sequence on macOS Safari is
   a beautifully rendered pirate flag in full color. On Chrome on Windows
   10 (the modal Google TAM laptop) it's a plain black flag with a small
   Mac-only emoji-mode fallback. On older Chrome on Linux it's two boxes.
2. **Inconsistent visual weight.** Emojis are stand-alone tiny illustrations.
   They render at OS-default styles and ignore your color tokens. A real
   icon system uses a single stroke weight, color, and corner radius.
3. **No way to color-key to status.** A status badge of "OPEN" deserves an
   icon that picks up the badge color. An emoji doesn't.

Apple's discipline: **SF Symbols 5** — outline, fill, multicolor,
hierarchical, with weight matching the text it sits next to. On the web,
the equivalent is **Phosphor** or **Lucide** at the same stroke weight,
or hand-rolled 16x16 SVG glyphs with a fill that inherits from `currentColor`.

**Concrete fix:** define an icon set under `app/icons.js` or inline as
constants — `IconClock`, `IconMail`, `IconPhone`, `IconCalendar`,
`IconMessageCircle`, `IconHandshake`, `IconPager`, `IconFlame`,
`IconAnchor`, `IconCrown`, `IconScroll`, `IconCoin`. Each is a 16x16 SVG,
`stroke="currentColor"`, `stroke-width="1.5"`, `fill="none"`. Reachability,
coverage kinds, achievements, ranks, toolbar all use the same set. Keep
emoji only in the celebratory copy ("Top covers in the last 90 days, 🏆") —
never on a structural element.

The pirate-themed icons (anchor, scroll, coin, crown) can stay; an outline
anchor at 1.5px stroke is on-theme without screaming. The cartoon emojis
(🧒, 🤝, 🪶) should be replaced with the corresponding outline glyph.

---

## 9. Form density on Post Bounty is wrong for the platform

`renderPostTab` at `app.js:3093-3178`. The form has, in this order:

1. Two date inputs side by side (Shore leave from / Returning by)
2. A timezone input (text, full-width)
3. Six "What you're covered for" checkboxes in a 2-column grid
4. Four "How reachable" checkboxes in a 2-column grid
5. A day picker grid of up to 30+ day cards
6. A two-option radio "Coverage mode"
7. A free-text "Coverage scope" input
8. A meetings picker (if Calendar connected)
9. An SLA text input
10. An emergency definition textarea
11. The cost preview tile + Post button

That's eleven sections. On an Apple form this would be **three sheets** or
**one sheet with three tabs / three accordion sections**:

- **When**: dates, timezone, day picker.
- **Coverage**: mode (segmented), scope, kinds (multi-select), reachability
  (multi-select), meetings.
- **Expectations**: SLA, emergency definition.

The current single-page form makes the user scroll three viewports on a
1080p screen before hitting "Post bounty." Apple's pattern for
multi-section forms is the `UITableView` grouped style — section headers in
medium-weight 13pt, items in 17pt rows, the form chunked into 3-7 sections
that fit on screen with breathing room.

Beyond layout, the form has too many decisions of equal weight. The
**Coverage mode** radio is buried at position 6 — but it changes how the
day picker behaves. Move it to position 1, render it as a segmented
control (Apple's `UISegmentedControl`-equivalent — Time Off has the right
visual at `styles.css:1773-1810` as `.mode-toggle` but it's pitched as two
boxes with check-radios, which is the wrong metaphor). A segmented
control should be:

```
[ Single coverer | Crew coverage ]   (one row, single selection, animated highlight)
```

Not two radio cards stacked or side-by-side. Same for filter chips at
`.filter-row` — those `All / Open / Taken / Done / Mine` chips should be a
segmented control, not five independent rounded pills (`styles.css:810-825`).

Reachability and coverage kinds — these are multi-select, so chips
(deselectable) are right, but the current `.check-pixel` style renders
each as a giant 8px-padded checkbox row. Apple's pattern: a set of
borderless pills with `--background: rgba(0,0,0,0.05)` unselected,
`--background: tint-color, --color: white` selected, animated transition.
The two-column grid is fine; the checkbox + label structure should be
collapsed into a single tap-target chip.

---

## 10. The Bounty card grid layout is too clever

`.bounty` at `styles.css:919-942`:

```css
grid-template-areas:
  "status status doubloons"
  "requester window doubloons"
  "scope scope scope"
  "chips chips chips"
  "sla sla action";
```

Five-row grid template. The eye lands on doubloons (good — that's the
buy/sell decision), but then has to scan four more zones to find out
*what* it's buying. Apple's pattern for transactional list rows in Mail,
Messages, Wallet:

- Avatar — 40px circle, left.
- Title — 17pt semibold, requester + relative time.
- Body preview — 15pt regular, 2-line clamp of scope + reachability.
- Trailing — right-aligned price (or status badge), 17pt monospaced tnum.

Total: 3 lines, single column, predictable. Five-row card with eight zones
makes the eye work twice as hard. The status pill (top-left) and the
remaining-days pill ("CREW · 3/7") read as confetti. Status conveys
"open / taken / done" — fine — but the visual treatment of three pills in
a row at the top of the card is more cluttered than the actual signal.

Look at the responsive grid at `styles.css:1007-1021`:
```
"status doubloons"
"requester doubloons"
"window window"
"scope scope"
"chips chips"
"sla sla"
"action action"
```
Six rows on tablet, seven on phone. Compare to Apple Maps' merchant cards
(Address Bar / Hours / Phone) — three rows max, each with a single tap
affordance.

**Concrete fix:** redesign `.bounty` as a single row with three columns:

```
[avatar 40] [title + meta 2-line clamp] [price + status, right-aligned]
```

Click the row → modal/sheet shows everything else (scope, SLA, chips,
emergency definition). Mobile: same layout, tighter. Save the grid magic
for a richer detail view, not the list.

---

## 11. Color palette has too many semantic shades

`styles.css:13-29` lists ~20 named colors. `--ink-abyss`, `--ink-sea`,
`--ink-pure`, `--ink-faded`. `--parchment`, `--parchment-bright`,
`--parchment-dim`. `--brass`, `--brass-bright`, `--brass-deep`,
`--doubloon`. `--elaine-cyan`, `--lechuck-red`, `--moonbeam`,
`--voodoo-violet`. The names are charming. The palette is illegible —
nobody can map `--moonbeam` to "you're seeing this when a bounty is
covered" without grepping.

Apple's iOS 17 palette has 10 semantic colors (`label`, `secondaryLabel`,
`tertiaryLabel`, `quaternaryLabel`, `systemFill`, `secondarySystemFill`,
...). Each maps to a role and adapts per appearance (light/dark).

**Fix:** rename to roles, not characters. `--surface`, `--surface-elev`,
`--label`, `--label-secondary`, `--label-tertiary`, `--accent`,
`--accent-pressed`, `--success`, `--warning`, `--error`, `--info`. Keep
the character names for one place only — the Pirate skin's gold accent
color, where `--accent: var(--brass)` is its only public name. Then
every component speaks role names. Dark Knight's `--color-primary`,
`--color-text`, etc. (`styles.css:3422-3433`) does exactly this. Lift
it to root.

---

## 12. The skin picker icon is broken Apple convention

`.sound-toggle` at `app.js:2304` uses the 🎨 paint palette emoji as the
button glyph for "Choose theme." Two problems:

1. Apple uses a **gear icon** in the chrome for settings, and a
   **paintbrush icon** specifically for appearance. 🎨 paint palette is
   the right metaphor but wrong glyph weight — an emoji is decorative.
2. Theme switching does not belong in the header chrome at all. It
   belongs in Settings, which on iOS is a Settings tab, on macOS is
   `Cmd+,`, on web is typically under an Account / Profile menu. The
   Time Off team treats Theme as a top-level affordance — they shouldn't.

If theme switching is important enough for the chrome (it is not), the
correct treatment is a `Cmd+T` global keyboard shortcut + a Settings
sheet item. Strip the 🎨 button from the header, add a Settings sheet
that opens from tapping the avatar, and put `Theme: Dark Knight (Default) / Pirate / Basic /
High Contrast` as the second row.

---

## 13. Focus rings are inconsistent across skins

The global focus ring is set at `styles.css:300-307`:

```css
outline: 2px dashed var(--brass-bright);
outline-offset: 3px;
```

A **dashed** outline. In 2024 Apple uses a 3px ring of the system tint
color at 8px offset, **solid**, with a `transition: outline-offset 120ms
ease-out` for the focus-in animation. Dashed outlines are an early-2000s
ASP.NET trope.

Dark Knight already fixes this at `styles.css:4079-4088`:
`outline: 2px solid var(--color-primary); outline-offset: 2px;` —
correct. Lift this back into the base.

---

## 14. Accessibility-as-design — Dynamic Type, reduced motion

Two pluses, two minuses.

**Plus 1:** `prefers-reduced-motion` is correctly handled at
`styles.css:315-322`. The mascot bob and loading doubloon respect it.

**Plus 2:** Atkinson Hyperlegible on the HC skin (`styles.css:3180`) is
a deliberate, expensive accessibility choice. Respect.

**Minus 1:** No `prefers-color-scheme` autoselect. The skin defaults to
Pirate regardless of the user's OS dark/light setting. An Apple-class
product reads the OS theme and picks the appropriate default skin on
first visit. `app.js:171` should be:

```js
current() {
  const stored = localStorage.getItem('vacaciones.skin');
  if (stored) return stored;
  return matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark-knight'
    : 'basic';
}
```

**Minus 2:** No Dynamic Type. On iOS the user can choose XS to XXXL body
size; the type scale flexes. Time Off has hard-coded pixel sizes from
`--fs-meta: 14` to `--fs-hero: 32`. On the basic skin a `prefers-* `
larger-text user has no escape valve. Adopting `rem`-based sizing keyed
to a root `font-size: clamp(14px, calc(14px + 0.2vw), 16px)` solves the
big-text case without restyling everything.

---

## 15. Quick punch list — small, high-impact

Things that won't appear as their own finding but should be fixed in the
sweep:

- `app.js:2750` — `<button class="btn-ghost" data-action="manage-crew">✏ MANAGE</button>` — the ✏ pencil emoji at button start is misaligned and ALL-CAPS. Replace with a 16px outline pencil SVG, sentence case "Manage", text after icon.
- `app.js:2751` — same for `🔗 SHARE INVITE`. Use `link.simple` outline glyph + "Share invite".
- `app.js:2959` — `📥 Download CSV` button. Outline `arrow.down.to.line` + "Download CSV".
- `app.js:2854, 2856` — `Claim days` / `Take voyage` button labels. "Take voyage" is on-brand but uppercase letter-spaced. Drop the caps. "Take voyage" sentence-case is still fun and pirate; "TAKE VOYAGE" in 13px caps reads as a bus terminal sign.
- `app.js:3174` — `Post bounty` button at the bottom of the form. Same — sentence case. Apple buttons are never ALL-CAPS unless they are 11pt micro-actions.
- `styles.css:138-140` — replace the `0 2px 0 var(--brass), 0 4px 0 var(--shadow-deep)` header shadow stack with a single `1px 0 0 0 var(--separator)` border.
- `styles.css:481` — the radial vignette on `.login-screen::after` was a band-aid to make the title legible on the lurid gradient. Once the gradient is calmed, the vignette can come off entirely.
- `styles.css:585-591` — the mascot turtle bobs in 2-frame `steps(2)` motion. It is a marketing accent, not a loading state. Either let it bob with a smooth spring at 250ms cycle or, better, remove it from the chrome entirely and reserve it for the empty-state of an empty crew board.
- `app.js:2664, 2718, 2814, 3190, 3308` — five separate locations each render `<div class="empty-mascot">${SVG.turtle}</div>` inside an `.empty-card`. Five empty states all show the same turtle with the same dashed pirate frame. Pick **two** empty-state surfaces and reserve the mascot for those; the others should be quiet `(no items yet)` text with an outline icon.
- `app.js:2657` — `WELCOME ABOARD, ${firstName.toUpperCase()}`. The forced uppercase on the user's first name reads as shouting. Drop it.
- `app.js:2745` — `${team.name.toUpperCase()}` on the team header. Same.

---

## 16. Sound design

`audio` at `app.js:180-214` is a Web Audio chiptune SFX synthesizer. It's
clever. It is also the wrong sound for the product:

- `audio.click()` is a 220 → 110 Hz square wave at 60ms. Hard-edged. The
  kind of click you get in DOS.
- `audio.coin()` is a 880 + 1320 Hz square at 50+100ms — diegetic to the
  pirate fiction but the wrong UI vocabulary for an enterprise tool.

If sound stays opt-in (it is, defaults off), the discipline should be:
**every effect 80-150ms, soft attack, equalized, sub-bass-trimmed.** Apple
UI sounds are 100-200ms triangle-or-sine envelopes, not square-wave
oscillators. Either rewrite the synth or remove sound entirely; the
chiptune SFX library is a feature only the pirate-skin user wants, and
the rest of the userbase will leave it off forever.

---

## 17. What this looks like when fixed

The desired end state in two sentences:

> A first-time visitor on a stock Chrome on Windows 11 lands on a calm,
> warm-dark surface with a single wordmark, a single ⌘+G primary action,
> and one piece of microcopy. The pirate fiction lives entirely in the
> microcopy and the optional theme, never in the chrome.

The default skin is Dark Knight (or a new Light-mode equivalent if the OS
asks). Pirate becomes the personality theme for the 20% of users who want
to live in the bit; for the other 80% it is a delightful Easter egg they
discover the first time they tap the avatar → Settings → Theme. The login
hero is a 28px wordmark, a small doubloon icon, and `Continue with Google`.
The Post Bounty form is a three-section sheet with segmented controls and
a single primary button. Bounty cards are 3-line list rows with avatar,
title+meta, and right-aligned price. Modals carry a top-right close
control, a calmly blurred scrim, and spring animations under 350ms.

The team has already proven they can build this — the Dark Knight skin
*is* this. Make it the front door, retire the pixel-shadow chrome from
the rest of the product, and bring the pirate fiction back as a wink, not
the whole costume.

---

*Audited at commit `61e661a` on 2026-06-01.*
