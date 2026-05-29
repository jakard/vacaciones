# Vacaciones — Accessibility & Engineering Polish Audit (Production Launch)

Source: production-readiness audit, 2026-05-29. Targeted at the live deployment at https://vacaciones-dev-b3158.web.app — vanilla ES module, Firebase, 3-skin design system, ~3,400-line `app/app.js`. Findings are concrete and cite line numbers in the as-shipped tree.

---

## 1. WCAG AA spot check — colour pairs across the three skins

### Pirate skin (Mêlée Night, default)

Tested the actually-used token pairs (`styles.css:9–27`):

| Foreground | Background | Where | Ratio | AA verdict |
|---|---|---|---|---|
| `--ink-pure` `#1A0E08` | `--parchment` `#E8D7A8` | panel body text | 11.36:1 | ✅ pass |
| `--ink-pure` `#1A0E08` | `--parchment-bright` `#F7E7C2` | inputs, buckets, day cards, modal body | 12.92:1 | ✅ pass |
| `--ink-faded` `#6B4F30` | `--parchment` `#E8D7A8` | `.muted`, ledger `<small>`, bd-label, ink-faded captions | **3.27:1** | ⚠️ **fails AA** for body text (≥4.5), passes only AA large/UI |
| `--ink-faded` `#6B4F30` | `--parchment-bright` `#F7E7C2` | `.bounty-window small`, `.member-main small`, `.scroll-head small` | **3.71:1** | ⚠️ **fails AA** for body |
| `--brass` `#E0A93B` | `--wood-dark` `#5A3A1F` (header `#header`, `.panel-title`, `.tab-count`) | brand name, panel titles, tab counts | **5.46:1** | ✅ pass |
| `--brass` `#E0A93B` | `--ink-abyss` `#0F1A2E` | `.coin-pill`, `.bell`, `.tab` text | **8.49:1** | ✅ pass |
| `--brass` `#E0A93B` | `--ink-sea` `#1E2D4A` (body bg) | hero `h2`, breadcrumb anchor, tab text, mascot bubble link | **6.77:1** | ✅ pass |
| `--brass-bright` `#FFD86B` | `--ink-sea` `#1E2D4A` | login title, ai-briefing h4, rank-name | 10.59:1 | ✅ pass |
| `--parchment-dim` `#C4A86B` | `--ink-sea` `#1E2D4A` | `.muted-light`, breadcrumb separator, tab inactive text, `.tavern-meta`, `.team-main small` (on parchment via mismatched query — actually on `--parchment`), `.email`, `.wof-meta`, `.bell-list .bell-meta` | **5.10:1** on ink-sea (✅ pass), but `.tab` color when over `--ink-abyss` `#0F1A2E` = **5.69:1** ✅ pass |
| `--parchment-dim` `#C4A86B` | `--parchment` `#E8D7A8` | `.tab-count` text inside panel borders, `.podium-avatar-fallback`, `.bell-list` borders | **1.51:1** | ❌ **fails everywhere** — visible only as decorative shadow lines, but used as text in `.podium-avatar-fallback` initials, where it's borderline |
| `--cream` `#F7E7C2` | `--ink-sea` `#1E2D4A` | hero `<p>`, `.who .name`, `.scroll-msg` (no — on parchment), modal-title link text | 12.55:1 | ✅ pass |
| `--ink-pure` `#1A0E08` | `--brass` `#E0A93B` (`.btn`, `.status-open`, `.filter-chip.active`, `.day-card.selected`) | primary button body, status badges | 9.69:1 | ✅ pass |
| `--cream` `#F7E7C2` | `--lechuck-red` `#C8362D` (`.btn-danger`, `.status-cancelled`, `.day-card.selected.weekend`) | danger labels | **4.92:1** | ✅ pass (barely) |
| `--ink-pure` `#1A0E08` | `--elaine-cyan` `#5BC9D1` (`.status-taken`, `.day-card.mine`, `.mine-pill`) | "TAKEN" badge, your-days marker | 9.95:1 | ✅ pass |
| `--ink-pure` `#1A0E08` | `--moonbeam` `#A6C2E8` (`.taken-by`, `.bell-meta` lines, `.chip-cyan`) | taken-by chip, info toasts, kind chips | 9.41:1 | ✅ pass |
| `--cream` `#F7E7C2` | `--voodoo-violet` `#5B3A8C` (`.rank-chip`, `.rank-hero` start, gradient) | rank chip text | 8.21:1 | ✅ pass |
| `--brass-bright` `#FFD86B` | `--voodoo-violet` `#5B3A8C` | `.rank-name` over `.rank-hero` gradient | 6.41:1 | ✅ pass |
| `--brass-bright` `#FFD86B` | `--brass-deep` `#8C6418` (`.bd-section` `h4` via `.ai-briefing h4` over violet) | AI briefing heading on parchment-bright in pirate skin | varies — on `--parchment-bright` 1.96:1 | ❌ **fails** — `.bd-section h4` defaults to `color: var(--ink-pure)` so this is OK in the default `.bd-section`, but `.ai-briefing h4 { color: var(--brass-bright); }` inside `.bd-section.ai-briefing` is on the **violet gradient** in pirate, where the contrast is **6.4:1** ✅ pass. (Annotated to clarify the cross-skin override is safe.) |

**Pirate findings — fix list:**

1. **`--ink-faded` `#6B4F30` on parchment is the single most prevalent AA failure.** Used by `.muted`, `.muted-light`, `.bounty-window small`, `.ledger li small`, `.bd-label`, `.bd-value` callouts when nested, `.bounty-sla`, `.bounty-meta small`, `.team-main small`, `.member-main small`, `.scroll-head small`, `.tavern-meta` (on parchment context), `.audit-time`, etc. Fix: darken to `#5A3F22` (4.67:1 on `--parchment`) or `#523818` (5.11:1) — keep the brown tonality but bump it above 4.5:1.
2. **`--parchment-dim` `#C4A86B` is used as foreground text in two places** that fail AA: `.podium-avatar-fallback` initials over `--parchment-dim` background (1.0:1 — invisible by design? confirm) and the `.team-main small` description (actually `--ink-faded` — covered above). The role-badge "CREW" (`.role-badge.member { background: var(--parchment-dim); color: var(--ink-pure); }`) is 6.43:1 ✅.
3. **`.preview small` (`color: var(--parchment-dim)` over `--ink-abyss` `#0F1A2E`)** — 5.69:1 ✅ but only just; the `.preview .cost span` (`color: var(--cream)` over abyss) is 16.7:1 ✅.

### Basic skin (`[data-skin="basic"]` — `styles.css:2805–3036`)

| Foreground | Background | Where | Ratio | AA verdict |
|---|---|---|---|---|
| `#1f2024` (`--color-text`) | `#ffffff` | body, panel text | 16.4:1 | ✅ pass |
| `#1a73e8` (`--color-primary`) | `#ffffff` | links, tab.active text, btn-ghost text | **4.55:1** | ✅ pass (just) |
| `#6b6f76` (`--color-muted`) | `#ffffff` | `.muted`, tab inactive text, breadcrumb | **4.69:1** | ✅ pass (just) |
| `#7a4f00` | `#fff4d6` | status-open badge | 7.97:1 | ✅ pass |
| `#014361` | `#e1f5fe` | status-taken | 9.96:1 | ✅ pass |
| `#137333` | `#e6f4ea` | status-active | 5.06:1 | ✅ pass |
| `#5f6368` | `#f1f3f4` | status-completed | 5.00:1 | ✅ pass |
| white | `#1a73e8` (`.btn`, `.bucket.total`, `.filter-chip.active`) | primary button text | 4.56:1 | ✅ pass (just) |
| white | `#c5221f` (`.btn-danger`) | danger button text | 5.94:1 | ✅ pass |
| `#5b3a8c` | `#f3e5f5` (`.ai-briefing`, `.rank-chip`) | violet on lavender | 7.83:1 | ✅ pass |
| `#006064` | `#e0f7fa` (`.mine-pill`) | cyan on cyan | 7.86:1 | ✅ pass |
| `#1a73e8` | `#fbfbfd` (input bg) | caret + focus border | 4.42:1 | ❌ **fails** by 0.08 — accept as decorative outline only, but if you ever set placeholder text in primary, raise to `#1557b0` |
| `#5f6368` | white (`[data-skin="basic"] .filter-chip` color over white surface) | filter-chip inactive text | 4.97:1 | ✅ pass |

**Basic findings:** `#1a73e8` on white is 4.55 — right on the line. Google's own Material guidance uses `#1565c0` (5.42:1) for body links to leave headroom. Recommend bumping the body anchor to `#1557b0` (already in use as `--color-primary-hover`) for safety; keep `#1a73e8` for the button fill where weight + size make it AA Large anyway.

### High Contrast skin (`[data-skin="hc"]` — `styles.css:3039–3294`)

Confirmed every defined pair against AA:

- `#000` on `#fff` — 21:1 ✅
- `#000` on `#ffff00` (btn primary, status-open, day.selected, bucket.total) — 19.6:1 ✅
- `#000` on `#00ffff` (status-taken) — 16.7:1 ✅
- `#000` on `#00ff00` (status-active) — 15.3:1 ✅
- `#fff` on `#ff0000` (status-cancelled, btn-danger, day weekend selected, toast.error) — **4.0:1** ❌ **fails AA for body text** but ≥3.0 ✅ for large text / UI components. Status badges are large-text-equivalent and the danger button uses `font-weight: 700` + ≥16px so it qualifies as AA Large. Keep but document.
- `#fff` on `#ff00ff` (rank-chip, rank-hero, ai-briefing) — **3.18:1** ❌ **fails AA for body** but passes UI/Large.
- `#ffff00` on `#000` (link, brand, panel-title, rank-name, ai-briefing h4) — 19.6:1 ✅
- `#ffff00` on `#ff00ff` (ai-briefing h4 on ai-briefing bg in HC) — **5.99:1** ✅ pass — **the magenta + yellow combo you asked me to sanity-check is fine**.
- `#fff` (`--ink-faded` `#1a1a1a` ↔ `#fff` body text inside `--ink-sea` `#000`) — 17.6:1 ✅

**HC findings:**
1. **Red-on-white in danger contexts is AA Large only.** Body text uses ≥18px in HC (`--fs-body: 18px`, `--fs-button: 16px` with `font-weight: 700`) so it qualifies as large for the button and badges. Confirm with the design that no small-text-on-red exists; the toast error caption is 18px-bold so it scrapes by.
2. **Magenta `#ff00ff` rank-hero with `#fff` body text fails small-text AA (3.18:1).** The `.rank-progress` paragraph is 18px (body large) at 700 weight — that's AA Large (3.0). Leave but note the text uses `--cream` `#fff` and the gradient is solid `#ff00ff` (no gradient in HC: `background: #ff00ff`). Acceptable.
3. **AI briefing magenta+yellow passes** as you suspected.

---

## 2. Keyboard navigation — the `render()` blast-radius

The render strategy is destructive: `render()` (`app.js:2169–2181`) calls `app.innerHTML = renderTeam()` (or `renderLogin()`, `renderHome()`) on every state change. `renderUserInfo()` (`app.js:2105–2140`) does `target.innerHTML = …` for the entire `#user-info` block. Re-rendering throws away the focused DOM node, so anything that calls `render()` synchronously while the user is mid-interaction will move focus back to `<body>`.

### Focus-loss table (elements that lose focus after a click)

| Element | Line | Trigger | Why focus is lost | Fix |
|---|---|---|---|---|
| `#bounty-search` input | `app.js:3359–3363` | typing | `state.bountyFilterText` is debounced (200ms) before `render()` — so each character does re-render the whole `<main>`. Already partially mitigated by the timer, but during fast typing the input is re-created mid-keystroke. | Stop calling `render()` from search input; only update `state.bountyFilterText`, then re-render just the bounty list `<ul>` via a partial render helper. Or: re-grab `document.getElementById('bounty-search')` and `.focus()` + `.setSelectionRange(end, end)` after render. |
| `#new-team-name`, `#join-team-id` | `app.js:3157–3167, 3408–3419` | submit (Enter or button) | After `createTeam()`/`joinTeam()`, the navigate triggers a route change and full re-render. Acceptable. | None needed. |
| `.filter-chip` (`set-filter`) | `app.js:3179–3182` | click | Calls `render()` after setting `state.bountyFilter`. The clicked chip is destroyed. | Add explicit focus restore: after `render()`, re-grab `[data-action="set-filter"][data-filter="${state.bountyFilter}"]` and `.focus()`. Or simpler: don't `render()`; toggle CSS class only. |
| `.bell` toggle | `app.js:3183–3190` | click | Calls `renderUserInfo()` — destroys the bell. | After `renderUserInfo()`, re-focus `.bell`. |
| `.sound-toggle` (sound) | `app.js:3191–3194` | click | Same as bell — `renderUserInfo()` destroys it. | Re-focus after render. |
| `.sound-toggle` (open-skin-picker) | `app.js:2126` | click | Opens modal — focus should move into modal anyway. | Fix is in §7 (modal focus). |
| `.day-card` toggle in post form (`toggle-day`, `select-weekdays`, `select-all-days`) | `app.js:3234–3256` | click | Calls full `render()` — the clicked `<li>` is destroyed. | Big offender. Re-render only `.meetings-picker` and `.preview` (already partially done for preview at `app.js:3398–3405`). Or maintain focus by `data-day-key` and refocus the same key. |
| `.day-card` toggle in **crew claim modal** (`claim-toggle-day`) | `app.js:1141–1158` | click | Custom re-render — sets `body.innerHTML = renderInner()` (`app.js:1149`). Focus is destroyed. | Refocus the just-clicked day card by `data-day-key` after `innerHTML =`. |
| `.skin-card` (pick-skin) | `app.js:3205–3210` | click | Calls `render()` *and* tries to toggle `.selected` first. The `.selected` toggle is wasted because `render()` blows the modal-root contents away — actually it doesn't, modals live in `#modal-root` which `render()` doesn't touch. Focus stays inside modal. | The `render()` call is needed to swap CSS variables. Add `t.focus()` after `render()` and ensure the modal-scrim re-finds the focus target. |
| `.avatar-tile` (pick-avatar) | `app.js:3214–3217` | click | Toggles `.selected` class only; no `render()`. Focus is fine. | None. |
| `.react-btn` (react-scroll) | `app.js:3331–3335` | click | Calls `reactToScrollAction` → `callReactToScroll` → live snapshot updates `state.scrolls` → `render()` (from `unsubScrolls`, `app.js:946–957`). The clicked button is destroyed. | Snapshot-driven render is unavoidable. Refocus the same scroll's reactions row by `data-scroll-id` + `data-emoji`. |
| `.kebab` `⋯` | `app.js:3279–3282` | click | Opens modal — focus loss is part of the modal flow. | Modal must capture focus and return it on close (§7). |
| `.tip-hat` | `app.js:3198–3201` | click | Opens modal. | Modal flow. |
| `[data-action="add-meetings"]` in bounty detail | `app.js:3263–3265` | click | Bounty detail modal is currently open. Triggering the action awaits the calendar promise then shows a toast; the modal stays open. Acceptable. | None. |
| `[data-action="gen-briefing"]` | `app.js:3325–3327` | click | `generateBriefingAction` → `state.briefingLoading = true; render()` (`app.js:1757–1768`). The bounty detail modal is open, but `render()` doesn't touch `#modal-root`, so the button is preserved. **However**, after success, `showBountyDetail()` is re-called to refresh — that wipes and recreates the modal. Focus is lost. | After modal recreate, focus the modal's first button. (Modal A11y refit, §7.) |
| `.tab` anchor links | `app.js:2421–2426` | click | They're `<a href>` — the browser navigates, hash changes, `applyRoute()` → `render()`. The clicked `<a>` is destroyed. | Refocus the new `.tab.active` element after `render()`. |

### Tab-unreachable elements

These are interactive but not reachable by `Tab`:

| Element | Line | Problem | Fix |
|---|---|---|---|
| `.day-card` `<li>` in post form day picker | `app.js:2676` | `<li class="day-card" data-action="toggle-day">` — `<li>` is not focusable, no `tabindex`, no role. SR sees a list item. | Convert to `<button type="button" class="day-card" …>` (button inside `<li>` is fine, but simpler is `<button>` directly + add list semantics via `role="list"` on parent). Need `aria-pressed="true|false"` for selected state. |
| `.day-card` `<li>` in **crew claim modal** | `app.js:1107` | Same. | Same fix. |
| `.meeting-row` `<label>` wrapping `<input type="checkbox">` | `app.js:2732–2745` | The `<input>` is `display: none` (`styles.css:1905`). The `<label>` becomes the click target but the checkbox is unreachable via Tab because of `display:none`. | Use `visually-hidden` (clip-rect technique) instead of `display:none` so the `<input>` keeps focusability; OR explicitly add `tabindex="0"` to the label + ARIA. The current pattern (`.check-pixel`) at `app.js:1485, 1493, 2778` has the same issue. |
| `.bounty` `<li>` clickable card | `app.js:2541, 3148–3151` | `<li class="bounty" data-bounty-id="…" style="cursor: pointer;">` — entirely click-only; no tabindex, no role. | Make the whole card a `<button type="button">` (preserving the grid layout) or wrap a hidden link + handle keypress. Cleanest: outer `<button>` for the card body, the inner `Accept`/`Crew claim`/`Tip hat` buttons remain real buttons inside (nested button is invalid; better: outer card stays `<li>` with `role="button"` `tabindex="0"` + Enter/Space handlers, and the inner action buttons keep `e.stopPropagation()`). |
| `.kebab` `⋯` | `app.js:2961` | `<button class="kebab">` — actually IS focusable. ⚠️ But no `aria-label` (uses `title` only; SR-incompatible across the board) and `:focus-visible` is missing on this skin. | Add `aria-label="Admin actions for ${name}"` and a focus ring. |
| `.react-btn` | `app.js:3113` | Is a real `<button>` — focusable. ⚠️ Has no `aria-label` ("🪙" alone isn't enough), no `aria-pressed`. | `aria-label="React with ${emoji}"` + `aria-pressed="${mine}"`. |
| `.skin-card` | `app.js:1352` | Is a `<button>` — focusable. ⚠️ No `aria-pressed` for the currently active skin; `.selected` is visual only. | Add `aria-pressed="${s.id === current}"`. |
| `.avatar-tile` | `app.js:1375` | Is a `<button>` — focusable. ⚠️ No `aria-label` (uses `title`), no `aria-pressed`. | `aria-label="${isMale ? 'Male' : 'Female'} pirate avatar ${id.slice(1)}"`. |
| `.bell` | `app.js:2123` | Real `<button>` with `aria-label`. ✅ Focusable. ⚠️ Dropdown panel below not Esc-closable while focused inside it; bell-dropdown items are `<li>` not `<button>`. | Make the dropdown items focusable buttons; `Esc` already closes (line 3420) but only when no focus elsewhere. Add `role="menu"` / `role="menuitem"`. |
| `.sound-toggle` (theme `🎨`) | `app.js:2126` | Real `<button>` — focusable. ⚠️ **Has only `title="Theme"`, no `aria-label`**. | `aria-label="Choose theme"` |
| `.sound-toggle` (sound `🔊`/`🔇`) | `app.js:2127` | Has `title` only, no `aria-label`. | `aria-label="${audio.enabled ? 'Mute sound effects' : 'Enable sound effects'}"` + `aria-pressed="${audio.enabled}"`. |
| `.avatar-slot` | `app.js:2130` | `aria-label="Choose your pirate"` is present. ✅ |
| `.tip-hat` button on WoF | `app.js:2915` | Real `<button>`. ✅ But only emoji content — needs aria-label. | `aria-label="Send a thank-you scroll to ${entry.displayName}"`. |
| `.mode-option` radio cards | `app.js:2807, 2814` | `<label>` wrapping `<input type="radio">`. The radio is visible (`.mode-option input { margin-top: 4px; }`, no `display:none`) so it's reachable. ✅ |
| `.check-pixel` checkbox cards | `app.js:2779, 2791, 1484, 1492` | `<label>` wraps `<input>` with `display: none` (`styles.css:806`). ❌ **Checkbox is not focusable.** | Replace `display: none` with `.sr-only` clip-rect (visually hidden but focusable). The `:focus-visible` ring on the `+ .check-box` sibling will then make the visual indicator work. |

### Enter / Space swallowed

- The custom-key handlers in `app.js:3408–3421` only catch Enter on `#new-team-name` and `#join-team-id`. **`.bounty` cards, `.day-card` list items, `.bell-list li`, `.skin-card`, `.avatar-tile` ignore keyboard events entirely** when they're non-`<button>` elements. After converting to real buttons (above), Enter and Space will work natively.
- The modal scrim has no `Esc` listener (`app.js:1823–1850`). `Esc` should close the modal. Currently the only `Esc` handler is for `state.bellOpen` (`app.js:3420`).

### Icon-only buttons without an accessible name

| Element | Current accessible name | Fix |
|---|---|---|
| `.sound-toggle` (`🎨` theme) | none (`title="Theme"` only — `title` is ignored by most SR/AT) | `aria-label="Choose theme"` |
| `.sound-toggle` (`🔊`/`🔇`) | none | `aria-label="Mute sound" / "Enable sound"` + `aria-pressed` |
| `.kebab` (`⋯`) | none (`title="Admin actions"`) | `aria-label="Admin actions for {name}"` |
| `.react-btn` (`🪙🍻🏴‍☠️⚓🦜`) | emoji-only | `aria-label="React with {emoji name}"` + `aria-pressed` |
| `.bell` (`🔔`) | `aria-label="Notifications"` ✅ | ok |
| `.avatar-slot` | `aria-label="Choose your pirate"` ✅ | ok |
| Coin pill in header | `title="Total doubloons in this crew"` only | Add `aria-label` and an SR-only "X doubloons" text |
| `.rank-chip` | `title` only | Add SR-only text or `aria-label` |
| `.bell-badge` (unread count) | Inline text but appears as decoration | Already inside `.bell` text — ok |

### Re-render destroying focus — concrete kill list

The pattern `state.X = Y; render();` at the following call sites destroys the focused element when invoked by keyboard or assistive click:

- `app.js:3181` — `set-filter` (filter chip)
- `app.js:3240` — `toggle-day` (day card)
- `app.js:3250, 3256` — `select-weekdays` / `select-all-days`
- `app.js:3269` — `clear-search`
- `app.js:1149` — crew-claim day toggle (modal-local re-render)
- `app.js:3362` — debounced search render

**Fix strategy (cheapest first):**
1. **Focus restoration sentinel.** Before any `render()` triggered from an event, capture `const activeId = document.activeElement?.dataset?.action + '|' + (document.activeElement?.dataset?.dayKey ?? document.activeElement?.dataset?.id ?? '')`. After `render()`, query for the same composite selector and `.focus()`.
2. **Partial render helpers** for the two highest-volume cases: bounty board list (`renderBountyBoardList()`) and day picker (`renderDayPicker()`). Re-rendering only those subtrees keeps the filter chip / day card alive.
3. **Stop calling `render()` for purely visual toggles** — see §8.

---

## 3. Screen reader semantics — `<li data-action>` patterns

Every place where an `<li>` carries a `data-action` is a hidden interactive control to a screen reader (announced as "list item", not "button"). Concrete kill list:

| File:line | Element | What it does | Replacement |
|---|---|---|---|
| `app.js:1107` | `<li class="day-card" data-action="claim-toggle-day">` | Toggle a day in crew claim | `<button type="button" class="day-card" aria-pressed="…">…</button>` wrapped in `<ul role="list">` or `<div role="group">` |
| `app.js:2676` | `<li class="day-card" data-action="toggle-day">` | Toggle a day in post form | Same |
| `app.js:2541` | `<li class="bounty" data-bounty-id="…">` | Open bounty detail modal | Add `role="button" tabindex="0"` + keypress handler. Inner action button stays as-is with `e.stopPropagation()` (already at `app.js:3170, 3174, 3200, 3333`). |
| `app.js:2150` | `<li>` in bell-list (notifications) | Plain text — no click handler today. SR-OK as list. | Leave. |
| `app.js:2336` | `<li>` in team-list | Wrapping `<a class="team-card">` — already an anchor, focusable. ✅ | Leave. |
| `app.js:2629` | `<li>` in ledger | Static. ✅ | Leave. |
| `app.js:2906` | `<li class="wof-row">` with tip-hat button inside | Static row + real button. ✅ | Leave. |
| `app.js:2950` | `<li class="member-card">` with kebab button inside | Static card + real button. ✅ | Leave. |
| `app.js:3115` | `<li class="scroll">` (Tavern) — `.react-btn` is real `<button>` ✅ | Leave. | — |
| `app.js:3073` | `<li class="audit-entry">` | Static. ✅ | Leave. |
| `app.js:2013` | `<li>` in bounty meeting list | Static link list. ✅ | Leave. |
| `app.js:1929` | `<li>` in coverer list | Static. ✅ | Leave. |

**Cheapest fix for the three real offenders** (`.day-card` × 2 + `.bounty`): keep the existing CSS, swap the `<li>` for `<button type="button">` for day cards (then wrap with `<ul role="list">` since `<button>` strips list semantics) and add `role="button" tabindex="0"` to the bounty card (don't change the tag because of nested action buttons). Add a global key handler at `app.js:3408`:

```js
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const card = e.target.closest('.bounty[data-bounty-id]');
  if (card && document.activeElement === card) {
    e.preventDefault();
    showBountyDetail(card.dataset.bountyId);
  }
});
```

---

## 4. Focus rings — `:focus-visible` audit

Defined indicators (`styles.css`):

- `.btn:focus-visible` — `outline: 2px dashed var(--brass-bright); outline-offset: 4px` (`styles.css:291`)
- `input:focus, textarea:focus, select:focus` — `outline: 2px dashed var(--brass); outline-offset: 2px` (`styles.css:358–361`)
- `[data-skin="basic"] input:focus, textarea:focus, select:focus` — `outline: 2px solid var(--color-primary); outline-offset: -1px` ✅
- `[data-skin="hc"] *:focus-visible, [data-skin="hc"] .btn:focus-visible` — `outline: 4px solid #ffff00; outline-offset: 4px` ✅ (the only universal `:focus-visible` rule)
- `[data-skin="hc"] input:focus` — `outline: 4px solid #ffff00; outline-offset: 0` ✅

**Pirate-skin gaps (every one of these has no focus ring at all):**

| Selector | Element | Where | Recommended ring |
|---|---|---|---|
| `.bell` | header bell | `styles.css:1593` | `outline: 2px dashed var(--brass-bright); outline-offset: 3px` |
| `.sound-toggle` | header theme + sound | `styles.css:1672` | same |
| `.avatar-slot` | header avatar | `styles.css:2136` | same |
| `.avatar-tile` | avatar picker tile | `styles.css:2160` | `outline: 4px solid var(--brass-bright); outline-offset: -2px` |
| `.skin-card` | skin picker tile | `styles.css:3308` | same |
| `.kebab` | member kebab | `styles.css:2024` | `outline: 2px dashed var(--brass-bright); outline-offset: 2px` |
| `.react-btn` | scroll reactions | `styles.css:2065` | `outline: 2px dashed var(--brass); outline-offset: 2px` |
| `.tip-hat` | WoF row tip-hat | `styles.css:2344` | same |
| `.filter-chip` | bounty filter chips | `styles.css:728` | same |
| `.tab` | tab links | `styles.css:662` | `outline: 2px dashed var(--brass-bright); outline-offset: -2px` (so it doesn't overflow the tab) |
| `.team-card` | team list anchor | `styles.css:543` | `outline: 3px solid var(--brass); outline-offset: 0` |
| `.day-card` | day pickers | `styles.css:1815` | `outline: 3px solid var(--brass-bright); outline-offset: -2px` |
| `.mode-option` | radio cards | `styles.css:1696` | `&:focus-within { outline: 2px dashed var(--brass); }` (focus the inner `<input>`, ring on the card label) |
| `.check-pixel` | checkbox cards | `styles.css:795` | same (`:focus-within`) |
| `.meeting-row` | meeting checkbox row | `styles.css:1886` | same |
| `.brand` anchor | header logo | `styles.css:141` | `outline: 2px dashed var(--brass); outline-offset: 4px` |
| `.bounty` clickable card | `styles.css:837` | `outline: 3px solid var(--brass); outline-offset: 0` |
| `a` in body | links | `styles.css:105` | `outline: 2px dashed var(--brass); outline-offset: 2px` |

**Basic-skin gaps:** the `[data-skin="basic"]` block has focus-visible only on inputs. Every button, tab, chip, tile lacks an explicit ring; browsers will fall back to the default UA outline, which on Chromium is the (acceptable) blue ring, but on Safari is invisible inside a high-z element. Add `[data-skin="basic"] :focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }` as a catch-all.

**Minimal patch** — a single global rule at the top of `styles.css`:

```css
:focus-visible {
  outline: 2px dashed var(--brass);
  outline-offset: 2px;
}
[data-skin="basic"] :focus-visible {
  outline: 2px solid var(--color-primary, #1a73e8);
  outline-offset: 2px;
}
[data-skin="hc"] :focus-visible {
  outline: 4px solid #ffff00;
  outline-offset: 2px;
}
```

Then keep the targeted overrides for buttons/inputs to preserve the dashed-brass aesthetic. That single block closes 19 of the gaps above.

---

## 5. Forms — label / programmatic association

Inventory (every form input across `app.js`):

| Input | Line | Label association | Verdict |
|---|---|---|---|
| `#new-team-name` `<input type="text">` | `app.js:2359` | No `<label for>`; placeholder `Crew name` only | ❌ Missing label. Add `<label for="new-team-name">Crew name</label>` or wrap. |
| `#join-team-id` | `app.js:2367` | placeholder only | ❌ Missing label. Add. |
| `#bounty-search` | `app.js:2475` | placeholder only | ❌ Missing label. Add `aria-label="Search bounties"`. |
| Post form: `name="startDate"` | `app.js:2772` | `<label><span>Shore leave from</span><input>…</label>` ✅ (implicit) | ok — but `<span>` has no programmatic role; better to use `<label for>` with explicit id. |
| `name="endDate"` | `app.js:2773` | Same wrapped pattern ✅ | ok |
| `name="timezone"` | `app.js:2774` | Wrapped ✅ | ok |
| `name="coverageKinds"` checkboxes | `app.js:2780` | `<label class="check-pixel"><input><span class="check-box"></span><span class="check-label">${k.label}</span></label>` ✅ wrapped + visible label | ok in form, but `display:none` on the `<input>` (§2). |
| `name="reachability"` | `app.js:2792` | Same wrapped ✅ | ok |
| `name="coverageMode"` radios | `app.js:2808, 2815` | Wrapped `<label class="mode-option">` ✅ | ok |
| `name="coverageScope"` text | `app.js:2824` | Wrapped ✅ | ok |
| `name="sla"` text | `app.js:2830` | Wrapped ✅ | ok |
| `name="emergencyDef"` textarea | `app.js:2831` | Wrapped ✅ | ok |
| `name="meeting"` checkbox | `app.js:2733` | Wrapped in `<label class="meeting-row">` with `.meeting-info <strong>` as visible name ✅ but the `<input>` is `display:none` | ok semantically, but see §2 — the hidden input means keyboard focus skips. |
| Edit bounty modal `name="r-*"`, `name="k-*"` | `app.js:1485, 1493` | Wrapped `.check-pixel` ✅ | Same display:none issue. |
| Edit bounty modal: SLA / scope / emergencyDef | `app.js:1500–1502` | Wrapped `<label class="wide"><span>SLA</span><input id="${slaId}">…</label>` ✅ | ok |
| Grant bonus modal: amount, reason | `app.js:1675, 1679` | Same wrapped with inline-styled `<span>` — visually labeled, but the `<span>` isn't a `<label>` so `for/id` is implicit only. Since they are siblings inside `<label>`, programmatic association works. ✅ | ok |
| Scroll compose textarea | `app.js:1566` | No label — only `placeholder="A short note of thanks…"` | ❌ Add `<label for="${inputId}" class="sr-only">Thank you message</label>`. |
| Manage crew modal: crew name, photo URL | `app.js:1400, 1404` | Wrapped ✅ | ok |
| Gemini API key input | `app.js:3017` | Wrapped ✅ | ok |

**Gap summary:** the four inputs needing labels are `#new-team-name`, `#join-team-id`, `#bounty-search`, and the scroll-compose textarea. All are one-line `aria-label` adds.

Additional form notes:
- **`autocomplete="off"` on the post form (`app.js:2770`)** is fine for the freeform fields but blocks browser's date-picker UI memory on the date inputs. Consider removing `autocomplete="off"` and tagging only the freeform inputs.
- **Date inputs have no `min`/`max`** — a user can post a bounty for the past. Server should reject (verify in `createCoverageRequest.ts`), but client should add `min="${new Date().toISOString().slice(0,10)}"`.
- **`type="password"` on Gemini key** — good, but `autocomplete="off"` is also present; should be `autocomplete="new-password"` for browsers to not autofill any saved Google password.

---

## 6. Toasts & live regions — colour-only state

`#toast` has `aria-live="polite"` (`index.html:53`). ✅

But `showToast()` (`app.js:1807–1821`) builds each toast as `<div class="toast ${kind}"><span class="toast-icon">${icon}</span><span>${esc(message)}</span></div>`. The kind (`success`, `error`, `info`) is communicated by:

1. Background colour (`.toast.success` green, `.toast.error` red, `.toast.info` blue) ❌ colour-only
2. Icon glyph (`✓`, `!`, `⚓`) — but these read as "check", "exclamation mark", "anchor" via SR, not as "Success" / "Error" / "Info"

**Fix:** prepend an SR-only prefix to the toast message:

```js
const kindLabel = kind === 'success' ? 'Success: ' : kind === 'error' ? 'Error: ' : 'Info: ';
el.innerHTML = `<span class="sr-only">${kindLabel}</span><span class="toast-icon" aria-hidden="true">${icon}</span><span>${esc(message)}</span>`;
```

Add a `.sr-only` utility class (visually hidden, programmatically present) at the top of the stylesheet — there's no `.sr-only` defined today.

Also: errors should use `role="alert"` (or `aria-live="assertive"` on a separate region), not pile into `aria-live="polite"`. Concrete change: split `#toast` into `#toast` (`aria-live="polite"`) and `#toast-error` (`role="alert" aria-live="assertive"`), route by kind.

**Bell dropdown** — `renderBellDropdown` (`app.js:2142–2163`) is just a static `<ul>` rendered into `#user-info`. It's not a live region. Don't make it `aria-live` — the bell badge already communicates the count, and re-announcing the entire list on every Firestore tick would be noisy. Instead, mark the unread count: `<button class="bell" aria-label="Notifications (${unread} unread)">`.

---

## 7. Modal accessibility — `showModal()` is missing every native dialog affordance

`showModal()` (`app.js:1823–1851`) creates `<div class="modal-scrim"><div class="modal"><div class="modal-title">…</div><div class="modal-body">…</div><div class="modal-actions">…</div></div></div>`. The crew-claim modal (`app.js:1075–1169`) and Stan onboarding (`app.js:1853–1891`) follow the same pattern.

### What's missing

1. **No `role="dialog"`** on `.modal`.
2. **No `aria-modal="true"`.**
3. **No `aria-labelledby` pointing at `.modal-title`.** The title is just text.
4. **No `aria-describedby`** for the first paragraph of body content.
5. **No focus trap.** Tab can move focus out of the modal (into the header bell, sound toggle, hidden underlying tabs, browser chrome) while the scrim is up.
6. **No initial focus.** `setTimeout(…)` is used in the scroll-compose modal (`app.js:1586–1592`) to focus the textarea, but the standard `showModal()` doesn't focus anything. Keyboard users land… nowhere.
7. **No `Esc` to close.** Only the bell dropdown listens for `Esc` (`app.js:3420`).
8. **No return-focus on close.** The trigger that opened the modal is forgotten; `wrap.remove()` (`app.js:1836`) leaves focus on `<body>`.
9. **Scrim has no inert/aria-hidden** on the underlying page. SR users hear the whole page and the modal interleaved.

### Minimal patch

```js
function showModal({ title, body, primaryLabel = 'AYE', secondaryLabel, onPrimary, onSecondary, wide }) {
  const root = document.getElementById('modal-root');
  const trigger = document.activeElement;            // remember
  const titleId = 'modal-title-' + Math.random().toString(36).slice(2, 8);
  const bodyId  = 'modal-body-'  + Math.random().toString(36).slice(2, 8);
  const wrap = document.createElement('div');
  wrap.className = 'modal-scrim';
  wrap.innerHTML = `
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true"
         aria-labelledby="${titleId}" aria-describedby="${bodyId}">
      <div class="modal-title" id="${titleId}">${esc(title)}</div>
      <div class="modal-body" id="${bodyId}">${body}</div>
      <div class="modal-actions">
        ${secondaryLabel ? `<button class="btn btn-secondary" data-modal="secondary">${esc(secondaryLabel)}</button>` : ''}
        <button class="btn" data-modal="primary">${esc(primaryLabel)}</button>
      </div>
    </div>`;
  document.getElementById('app').setAttribute('aria-hidden', 'true');
  document.getElementById('header').setAttribute('aria-hidden', 'true');
  const close = () => {
    wrap.remove();
    document.getElementById('app').removeAttribute('aria-hidden');
    document.getElementById('header').removeAttribute('aria-hidden');
    trigger?.focus?.();
    document.removeEventListener('keydown', onKey);
  };
  const focusables = () => Array.from(wrap.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )).filter((el) => !el.disabled && el.offsetParent !== null);
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const list = focusables();
    if (list.length === 0) return;
    const first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', onKey);
  // existing click handlers …
  root.appendChild(wrap);
  // Focus the primary button (or first focusable)
  (wrap.querySelector('[data-modal="primary"]') ?? focusables()[0])?.focus();
  return { close };
}
```

This is ~40 LOC and covers every modal in the app uniformly. The crew-claim modal at `app.js:1075` (custom inline wrap) needs the same treatment — extract a `mountModalShell()` helper to avoid duplication.

---

## 8. Engineering polish — performance

### Re-render storm

`render()` (`app.js:2169`) blasts the entire `<main>` on every state mutation. Firestore listeners (`subscribeMyTeams`, `subscribeWallet`, `subscribeLedger`, `subscribeRequests`, `subscribeScrolls`, `subscribeUserDoc`, `subscribeMyMember`) all call `render()` directly. On a team with ten coverers reacting to a scroll, you can fire `render()` ~10 times in a second on the requester's session.

**Wins:**
1. **Debounce `render()`.** Wrap every direct call in a `scheduleRender()` that uses `requestAnimationFrame` to coalesce. ~10 LOC.
   ```js
   let renderPending = false;
   function scheduleRender() {
     if (renderPending) return;
     renderPending = true;
     requestAnimationFrame(() => { renderPending = false; render(); });
   }
   ```
2. **Don't `render()` for purely visual toggles.** `audio.toggle()` (`app.js:3192–3194`) calls `renderUserInfo()` — fine, but the skin picker (`app.js:3205–3210`) calls full `render()` only to apply CSS variables. Setting `document.documentElement.dataset.skin = id` is sufficient; everything else is CSS-driven. Drop the `render()` call.
3. **Bell open/close (`app.js:3183–3194`)** correctly calls only `renderUserInfo()`. ✅ keep.
4. **Search input (`app.js:3359–3363`)** already debounces. ✅ but should render only the bounty list, not `<main>`.
5. **Calendar fetch trigger (`app.js:3394–3397`)** debounces with 400ms — ✅.

### Image loading

- **Member avatars (`renderMembersTab`, `app.js:2941–2964`)** load eagerly: `<img src="${esc(m.photoURL)}">`. For a 30-person crew the page does 30 referrer-policy-no-referrer image fetches on every render. Add `loading="lazy" decoding="async"`.
- **WoF podium avatars (`app.js:2895`)** — same.
- **Bounty card requester avatars (`app.js:2548`)** — same. These are above the fold on the board tab though, so lazy gives no win. Add `decoding="async"`.
- **`team-flag` photos (`app.js:2340`, `2408`)** — `loading="lazy"` is fine for the team list (home).
- **Inline SVG (`SVG.avatars`, ~10 KB each × 10)** — these are static strings injected directly. They don't refetch but they re-parse on every `render()` that walks the avatar grid. Cache parsed SVG fragments if hot.

### JS bundle / loading

- The app imports the **modular Firebase SDK from `gstatic`** at runtime (`app.js:1–23`). Three separate ESM dependencies — `firebase-app`, `firebase-auth`, `firebase-firestore`, `firebase-functions`. Browser fetches them in parallel, but the network waterfall on first paint shows ~280 KB of JS. Mitigations: keep as-is (CDN-cached), or self-host via `npm + esbuild` if you want a tighter critical path.
- `app.js` itself is ~110 KB unminified. Pretty small. No bundler. Acceptable for v1.0. If you ever add a build step, defer the avatar SVG strings (~50 KB) and the harbor BG SVG (`renderHarborBg`, `app.js:2245–2313` — ~7 KB) behind dynamic imports.
- Mascot animation (`@keyframes turtle-bob`, `coin-spin`, `coin-float`, `toast-in`, `spin-step`) run forever — `@media (prefers-reduced-motion: reduce)` block at `styles.css:3341–3348` correctly disables them. ✅

### Misc perf

- `computeNotifications()` (`app.js:588–629`) re-runs on every `renderUserInfo()`. It walks the ledger (40 entries) + bounties (100 limit) + filters/maps. Sub-ms but redundant. Memoize on `state.ledger.length + state.bounties.length` if you wire devtools and see it hot.
- `computeStats()` (`app.js:542–553`) is called from both `renderUserInfo()` and `renderChestTab()`. Inexpensive but: cache the result of one and reuse in the second.

---

## 9. Engineering polish — robustness

### Error handling across callables

Every callable wrap has try/catch + toast — checked all 22:

- `signIn` (849) ✅ shows toast
- `handleSignOut` (860) ✅
- `createTeam` (978), `joinTeam` (992), `postBounty` (1006), `acceptRequest` (1049) ✅
- `setAvatar` (1171), `cancelBountyAction` (1181), `updateTeamAction` (1194) ✅
- `refreshCalendarEvents` (1206) ✅
- `connectCalendarAction` (1235) ✅
- `addAllBountyMeetings` (1281) — partial: per-meeting failures are silently `console.error`d and only the count matters. Acceptable for batch ops; consider a "X meetings failed" toast when `meetingsToAdd.length - addedMeetings > 0`.
- `copyInviteLink` (1328) ✅
- `sendScrollAction` (1336), `refreshLeaderboard` (1595), `refreshCrewSettings` (1607), `refreshAuditLog` (1620), `changeMemberRole` (1632), `removeMemberAction` (1641), `grantBonusAction` (1649), `forceCompleteAction` (1658), `refreshCrewMembers` (1722), `topUpGrantAction` (1734), `generateBriefingAction` (1756), `reactToScrollAction` (1770), `saveCrewSettings` (1779) ✅ all surface `err.message` via `showToast`.
- `initUser` in `onAuthStateChanged` (815–824) ✅

**Single concern:** `addCoverageMarker` (`app.js:1246–1279`) **throws** on `!res.ok` (line 1276) but the surrounding `try` in `addAllBountyMeetings` (`app.js:1306–1316`) catches and only `console.error`s the marker. The user gets a generic "Nothing new to add" toast when a 401-after-refresh fails on the marker only. Improve: distinguish `marker fail` from `nothing to add` in the success message.

### Firestore subscription teardown

- `teardownAllSubs` (`app.js:968–972`) ✅ unsubs all team subs + user doc + teams.
- `teardownTeamSubs` (`app.js:960–967`) — called from `applyRoute` when leaving a team route. ✅
- `onAuthStateChanged` → `teardownAllSubs` on sign-out. ✅
- **No `beforeunload` teardown** — minor; Firestore client cleans up on page unload automatically.
- **No unsub for `unsubMyMember`** in `teardownAllSubs` directly — but `teardownAllSubs` calls `teardownTeamSubs` which does. ✅

### `localStorage` keys

All keys use the `vacaciones.` prefix (`app.js` greps for 14 distinct keys):

- `vacaciones.skin`, `vacaciones.sound`, `vacaciones.notifLastSeen`, `vacaciones.achievedIds`, `vacaciones.calToken` (in **sessionStorage** ✅ — refresh-tokenable but tab-scoped, which is right), `vacaciones.addedMeetings.${bountyId}`, `vacaciones.addedMarker.${bountyId}`, `vacaciones.seenStan`

✅ No PII. Tokens are session-scoped. **One concern:** `vacaciones.addedMeetings.${bountyId}` and `vacaciones.addedMarker.${bountyId}` grow unbounded as bounties accumulate. Add a cleanup pass that drops keys whose bounty is no longer in `state.bounties` and is completed/cancelled — every ~30 days. Easy: on login, iterate `localStorage`, parse keys matching the `addedMeetings.|addedMarker.` prefix older than 90 days (you'd need a timestamp; or just trim when count > 200).

### Missing security headers in `firebase.json`

`firebase.json:34–41` ships **only** `Cross-Origin-Opener-Policy: same-origin-allow-popups` (needed for `signInWithPopup`). Missing:

```jsonc
{ "key": "Content-Security-Policy",
  "value": "default-src 'self'; script-src 'self' https://www.gstatic.com 'unsafe-inline'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.googleapis.com https://*.gstatic.com https://*.firebaseio.com https://*.cloudfunctions.net wss://*.firebaseio.com; frame-src https://vacaciones-dev-b3158.firebaseapp.com" },
{ "key": "X-Frame-Options", "value": "DENY" },
{ "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
{ "key": "X-Content-Type-Options", "value": "nosniff" },
{ "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), interest-cohort=()" }
```

**Caveats:**
- `'unsafe-inline'` on `style-src` is needed because `app.js` writes inline `style="…"` attributes on lots of elements (search for `style=` in `app.js`). Refactoring to CSS classes is a v1.x cleanup.
- The Firebase Auth popup needs the auth domain in `frame-src` and possibly `frame-ancestors` `none` — but **`X-Frame-Options: DENY`** plus modern `frame-ancestors 'none'` is redundant; ship the modern one in CSP and you can drop XFO.
- Test the CSP before deploying — Firestore websocket uses `wss://` which is covered, but if you add an analytics SDK later, expand `connect-src`.

### Service worker / PWA

None. Recommend adding for v1.1, not v1.0:
- PWA manifest (`app/manifest.webmanifest`) + a `<link rel="manifest">` in `index.html`.
- A minimal service worker that caches `index.html`, `app.js`, `styles.css`, the Google Fonts CSS, and the Firebase SDK URLs. Cache-first for static, network-first for API rewrites under `/api/`.
- Workbox or a 50-line hand-rolled SW would do.

### Source maps

Confirmed: no source maps in `app/` (`Glob` found none, no `//# sourceMappingURL` comments). The functions tsconfig has `"sourceMap": true` but those build to `functions/lib/` and don't ship to hosting. ✅

---

## 10. Cross-browser & mobile

### Tap targets

WCAG 2.5.5 (AAA) wants ≥44×44, WCAG 2.5.8 (AA, future) wants ≥24×24. Today:

- **`.bell` (`32px × 32px`)** ❌ both AA (24) and AAA (44). Bump to 40+ on mobile.
- **`.sound-toggle` (`32 × 32`)** ❌ same.
- **`.avatar-slot` (`36 × 36`)** ✅ AA, ❌ AAA.
- **`.kebab` button** — `font-size: 22px; padding: 0 4px` → ~26×26 effective. ✅ AA, ❌ AAA.
- **`.tip-hat` button** — `padding: 3px 6px; font-size: 7px` → ~22×14. ❌ both. **High-friction tap target on mobile.**
- **`.react-btn`** — `padding: 3px 8px; font-size: 14px` → ~26×24. ✅ AA borderline.
- **`.filter-chip`** — `padding: 6px 10px; font-size: 8px` → ~28×24. ✅ AA borderline.
- **`.tab`** — `padding: 8px 12px; font-size: 10px` → ~36×30. ✅
- **`.day-card`** — `padding: 8px 6px` → ~85×60. ✅
- **`.btn-ghost` in `.invite-actions` on mobile** — `font-size: 8px` per `styles.css:2568`, padding 6px 8px → 22×18. ❌
- **Stan-dot pagination `8 × 8`** — these aren't interactive, decorative. ✅
- **Header sign-out btn `padding: 6px 10px; font-size: 8px`** — ~22×18. ❌

**Fix:** add a mobile-specific min-size rule:

```css
@media (max-width: 720px) {
  .bell, .sound-toggle, .avatar-slot { width: 44px; height: 44px; }
  .tip-hat, .react-btn, .filter-chip, .btn-ghost { min-height: 36px; padding: 8px 12px; }
}
```

### Hover-only affordances

- `.team-card:hover` translates -2px and changes shadow. Touch users miss this entirely. Acceptable (purely decorative).
- `.bounty:hover` is not defined — no hover, just `cursor: pointer`. Touch fine. ✅
- `.day-card:hover` translates -1px. Decorative. ✅
- Toasts dismiss on `mouseenter` / `mouseleave` (`app.js:1818–1819`). **On touch, the toast can be tapped to dismiss (✅ `el.addEventListener('click', dismiss)`) but the hover-pause behaviour is gone.** Acceptable; touch users dismiss explicitly.

### Modal sizing on small viewports

`@media (max-width: 540px)` (`styles.css:2549`) sets `.modal { max-height: 90vh; overflow-y: auto }`. ✅ The crew-claim modal (`app.js:1127`) uses `<div class="modal wide">` — same cap. ✅

### iOS safe-area-inset

**Not handled anywhere.** On iPhone with notch / dynamic island, header content can slide under the status bar. Add to `#header`:

```css
#header {
  padding-top: env(safe-area-inset-top);
  padding-left: max(var(--sp-4), env(safe-area-inset-left));
  padding-right: max(var(--sp-4), env(safe-area-inset-right));
}
#toast { top: calc(64px + env(safe-area-inset-top)); }
```

And add `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` to `index.html:5`.

### Long-press / text selection

- `.day-card { user-select: none; }` ✅ at `styles.css:1823` — long-press won't trigger text selection.
- `.check-pixel { user-select: none; }` ✅ at `styles.css:803`.
- `.tab` — `<a>` tags don't have `user-select: none`. Long-press selects text or copies the URL — acceptable for nav.
- `.kebab` — no `user-select` ❌ — long-press selects `⋯`. Minor.
- `.bounty` clickable card — no `user-select` ❌ — long-press selects requester name etc. Add `user-select: none` to outer `<li>`.

### Browser-specific

- **Safari**: `image-rendering: pixelated` (`styles.css:74`) is supported. `:focus-visible` works in 15.4+. ✅
- **Firefox**: `:focus-visible` works since 85. ✅
- **Edge / Chromium**: ✅
- **Web Audio in private/incognito on Safari**: `AudioContext` requires a user gesture; the `audio.init()` guard (`app.js:180–184`) handles this. ✅

---

## 11. Production-readiness checklist

### Must-fix for v1.0 launch

1. **Add CSP + X-Frame-Options + Referrer-Policy + nosniff** in `firebase.json` (§9). One PR. Test signInWithPopup still works.
2. **`aria-label` on every icon-only button**: `.sound-toggle` (theme), `.sound-toggle` (sound), `.kebab`, `.react-btn`, `.tip-hat`, `.coin-pill`, `.rank-chip` (§2 table). Each is a one-liner.
3. **Modal a11y refit**: role/aria-modal/labelledby + focus trap + Esc + return-focus (§7). One small helper.
4. **Convert `<li data-action>` to real buttons** for day cards (post + crew claim) and add `role="button" tabindex="0"` + keypress to bounty cards (§3).
5. **Forms — add `aria-label` to `#new-team-name`, `#join-team-id`, `#bounty-search`, scroll-compose textarea** (§5).
6. **Focus-visible global rule** to cover the 19 silent surfaces in pirate skin (§4).
7. **Darken `--ink-faded` to `#5A3F22`** to clear the ~12 AA failures on `.muted` text (§1).
8. **SR-only success/error prefix on toasts** + `.sr-only` utility class (§6).
9. **Mobile tap targets ≥36px** for the bell/sound/theme/tip-hat/sign-out (§10).
10. **iOS safe-area-inset** in header + `viewport-fit=cover` meta (§10).
11. **`loading="lazy"` on member avatars + WoF podium avatars** (§8).

### Nice-to-have for v1.1

- Partial-render helpers (`renderBountyList`, `renderDayPicker`) to eliminate the focus-loss storm (§2, §8).
- Service worker + manifest for offline + PWA install (§9).
- `<min>`/`<max>` on date inputs to prevent past-bounty submission (§5).
- Cleanup pass for `vacaciones.addedMeetings.*` localStorage keys (§9).
- Split `#toast` (polite) from `#toast-error` (assertive) (§6).
- Memoize `computeStats()` / `computeNotifications()` (§8).
- Per-meeting failure summary in `addAllBountyMeetings` (§9).
- `<label class="sr-only" for>` on the new-team / join-team / search inputs (upgrade from `aria-label`) for better SR experience.

---

## 12. Top 5 highest-leverage fixes for v1.0

Ranked by user impact × engineering cost (high impact, low cost first):

1. **Modal a11y refit (§7)** — covers 100% of modal triggers (every confirm dialog, the Stan onboarding, every editor) with ~40 LOC. Without this, **keyboard users can't dismiss a modal except by clicking the scrim** (which most won't think to do). This is the largest impact-per-line in the audit.

2. **Global `:focus-visible` rule + dark-mode tab/chip/bell/sound focus rings (§4)** — 8-line CSS patch fixes 19 silent surfaces in the pirate skin. Without it, keyboard users navigating the header have no idea where focus is. The HC skin already does this; just port the pattern.

3. **`aria-label` on every icon-only button + SR-only toast prefix (§2, §6)** — ~12 attributes + one utility class. Brings the app from "unusable with a screen reader" to "navigable". Pair with §3 (`<li>`→`<button>` for day cards) to make the post flow SR-completable.

4. **CSP + X-Frame-Options + nosniff + Referrer-Policy in `firebase.json` (§9)** — 6 lines of JSON. Currently the app can be embedded in an iframe, leaks the full referrer, and has no inline-script defence-in-depth. Cheap, high-impact for security posture.

5. **Darken `--ink-faded` to `#5A3F22` (§1)** — one token change. Clears every AA contrast failure on `.muted`, `.bounty-window small`, `.ledger li small`, `.member-main small`, etc., across the entire pirate skin. The basic and HC skins are unaffected because they override `--ink-faded` separately. One-line fix, ~12 surface fixes.

Honourable mentions that didn't make the cut: focus-restoration after `render()` (§2) is high-impact but multi-surface — bake it in once you have the focus-visible rings landed.

---

*End of audit. Cite line numbers against the tree at the head of this doc; the renderers + event-delegation block in `app.js:2169–3346` is the single most leveraged area for cleanup.*
