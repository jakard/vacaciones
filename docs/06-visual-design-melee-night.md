# Vacaciones Design System — "Mêlée Night 16"

Source: swarm agent visual design report, 2026-05-29. A LucasArts/Monkey Island-inspired 8-bit visual system, achievable with vanilla HTML + CSS + inline SVG.

> Codename: *Isla del Coco*. The fiction is a fictional pirate island where TAMs trade coins for coverage. The vibe is playful + game-like *without* being a toy.

---

## Aesthetic anchors

The Secret of Monkey Island (1990) and LeChuck's Revenge (1991) on the SCUMM engine. Signature traits we steal:

- Low-resolution, hand-painted feel — backgrounds read more like illustrated book plates than tile grids.
- Heavy **dithering** to fake intermediate colors (2-pixel checker patterns on every gradient).
- Night dominant — desaturated indigo/teal-purple background lets one warm light source carry the scene.
- Warm pools of light (torch, lantern) against cool indigo shadow.
- 1-pixel pure-black silhouette around every sprite.
- The SCUMM bottom panel — wooden/parchment background, beveled gold-on-brown edges, square corners.
- Dialog as floating colored text, not boxes. Each character has an assigned hue.
- Stepped animation at ~6–10 fps. *Never* eased.
- Single bright pixel for specular highlights.
- Cursor changes shape over hotspots.

What to leave out: CRT scanlines, glassmorphism, full-screen chiptune music, rounded corners, dark mode toggle, ease easing of any kind.

---

## Palette — Mêlée Night 16

A custom 16-color palette tuned to the Monkey Island night-on-Mêlée vibe.

| Role | Token | Hex |
|---|---|---|
| Background deep | `--ink-abyss` | `#0F1A2E` |
| Background mid | `--ink-sea` | `#1E2D4A` |
| Surface panel | `--parchment` | `#E8D7A8` |
| Surface alt | `--parchment-dim` | `#C4A86B` |
| Border / table rule | `--wood-dark` | `#5A3A1F` |
| Text default (on parchment) | `--ink-pure` | `#1A0E08` |
| Text muted | `--ink-faded` | `#6B4F30` |
| Text inverted (on dark) | `--cream` | `#F7E7C2` |
| Primary action | `--brass` | `#E0A93B` |
| Primary hover | `--brass-bright` | `#FFD86B` |
| Success / credit / coin | `--doubloon` | `#FFCB47` |
| Info / link / selection accent | `--elaine-cyan` | `#5BC9D1` |
| Danger / debit / error | `--lechuck-red` | `#C8362D` |
| Highlight (focus row) | `--moonbeam` | `#A6C2E8` |
| Shadow | `--shadow-deep` | `#06080F` |
| Voodoo (rare badges, modal scrim) | `--voodoo-violet` | `#5B3A8C` |

All combos meet WCAG AA contrast. Tuned by hand — don't substitute brighter alternatives that fail contrast.

---

## Typography

Three Google Fonts, all woff2, zero asset pipeline.

| Use | Font | Weight |
|---|---|---|
| Display / wordmark / button | Press Start 2P | 400 |
| Body / UI text | VT323 | 400 |
| Numeric / coin amounts | Silkscreen | 400, 700 |

**Pixel-aligned type scale** — Press Start 2P locked to 8/12/16/24/32 only. VT323 at 16/20/24/28/32. Silkscreen at 20.

Font hygiene: `-webkit-font-smoothing: none`, `font-smooth: never`, `text-rendering: geometricPrecision`.

---

## Chrome — the parchment panel

Every panel is a parchment notice nailed to a wooden board. Implemented entirely via stacked `box-shadow`s — no images.

```css
.panel {
  background: var(--parchment);
  color: var(--ink-pure);
  padding: 16px;
  border-radius: 0;
  box-shadow:
    0 0 0 2px var(--wood-dark),         /* outer pixel border */
    inset 2px 2px 0 #F7E7C2,            /* top-left highlight */
    inset -2px -2px 0 var(--parchment-dim), /* bottom-right shade */
    4px 4px 0 0 var(--shadow-deep);     /* hard drop shadow */
}
```

Buttons are beveled with the same stacking trick. `:active` does `transform: translate(3px,3px)` and drops the offset shadow — instant depress effect, no library.

Inputs flip the shadow direction (dark on top, light on bottom) to look recessed.

---

## Animations

Stepped only. `steps(N)` or `linear`. No `ease-*`, no `cubic-bezier`.

| Animation | Duration | Timing |
|---|---|---|
| Coin spin | 600ms | steps(4) infinite |
| +N coin float-up | 900ms | steps(6) once |
| Button press | instant | (no transition, `:active` transform) |
| Toast fly-in | 240ms | steps(4) |
| Toast dismiss | 180ms | steps(3) |
| Sprite idle (turtle/parrot) | 1.6s | steps(2) infinite |
| Torch flame | 300ms | steps(3) infinite |
| Skeleton shimmer | 1200ms | steps(8) infinite |
| Marching-ants focus | 600ms | steps(8) infinite |

Respect `prefers-reduced-motion` — kill idle loops; keep state-feedback steps.

---

## Sprites (inline SVG, `shape-rendering: crispEdges`)

10 starter sprites, all originally drawn (no asset rips):

1. **Doubloon** (16×16) — coin balance, +/- toasts, button icon. 4-frame stepped spin.
2. **Palm sprout** (16×16) — Open bounty status; logo element.
3. **Anchor** (16×16) — Claimed/Accepted status.
4. **Skull** (16×16) — Errors, expired bounties. 2-frame eye blink.
5. **Parrot** (32×32) — info toasts. 2-frame rocking idle.
6. **Pirate tricorne** (16×16) — top-coverer / leaderboard badge.
7. **Scroll** (16×16) — request item icon.
8. **Torch** (16×16) — active highlight. 3-frame flame loop.
9. **Compass** (24×24) — navigation / find-coverage CTA.
10. **Turtle (Capitán Caparazón)** (96×96) — mascot for empty states.

---

## Sound — optional, ~30 lines

Three Web Audio-generated SFX, default off, with a header mute toggle:

- **Click**: square 220 Hz → 110 Hz over 60ms, gain 0.05.
- **Coin earn**: two stacked squares — 880 Hz 40ms then 1320 Hz 80ms, gain 0.08.
- **Toast**: triangle 660 Hz → 990 Hz over 120ms, gain 0.04.

Lazy-init `AudioContext` on first user gesture. Skip background music entirely — hostile in a work setting.

---

## Login screen — the first impression

Full-viewport pixel illustration (inline SVG): moonlit dock at a Mêlée-Island-ish port. Indigo sky + sea, fat low moon (`--cream`) with a 2-pixel dither halo. Tall ship silhouette right (3 masts + crow's-nest lantern). Three lit dock lanterns left dropping warm `--brass` dithered streaks onto water. A palm tree in the corner.

Centered wordmark: `VACACIONES` in Press Start 2P 32px `--brass-bright` with a 2px `--shadow-deep` offset shadow. Tagline below in VT323 24px `--cream`: `TALES OF MONKEY COVERAGE`.

Single parchment panel below, 360px wide, with two beveled buttons: `⚓ SIGN IN WITH GOOGLE` (brass primary) over `WHAT IS THIS?` (parchment secondary).

Bottom-right: 32×32 turtle mascot (Capitán Caparazón) with a 2-frame idle bob and a randomized 8px speech bubble: *"Welcome aboard, TAM." / "Coins or coverage?" / "Need a week off?"*

Subtle 3-frame torch flicker on the two lanterns (300ms). Everything else dead still.

---

## TL;DR for the implementer

Build the whole UI on `--parchment` panels floating over a deep-indigo `--ink-sea` body, using stacked hard `box-shadow`s for every bevel/border/drop. Type is Press Start 2P for headings/buttons at 8/12/16/24/32, VT323 for body at 16/20/24, Silkscreen for coin counters. Use Mêlée Night 16 as CSS vars; warm brass on cool indigo for CTAs, `--lechuck-red` for danger. Every animation is `steps()`. Icons are inline SVG with `shape-rendering: crispEdges`. Mascot is a turtle (Capitán Caparazón). Login is a hand-painted SVG harbor scene with the wordmark over it. Skip scanlines, ease, blur, rounded corners, dark mode, and chiptune background music. Ship it in a day.
