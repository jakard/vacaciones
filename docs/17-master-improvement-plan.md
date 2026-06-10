# 17 — Master Improvement Plan: Approach, Design & Usability

> Prepared 2026-06-10 at commit `a24071e`. Inputs: full code analysis of
> `app/` (8,041 lines across 3 files), `functions/src/` (22 callables, 3
> scheduled, 2 services), `shared/`, `web/`, the 16 prior docs, and fresh
> 2026 competitive research on the web. Goal stated by the founder:
> **"the best application available for this purpose."**
>
> This plan does not repeat the 12-item launch gate from
> [doc 16](16-product-excellence-synthesis.md) — it absorbs it. Items
> 1–3 of the top-10 shipped at `a24071e`; the rest are slotted into the
> roadmap below alongside everything new.

---

## 1. Executive summary

Time Off occupies a real gap. After surveying the 2026 landscape across
five adjacent categories — PTO trackers, shift-swap marketplaces, on-call
override tools, recognition economies, and AI OOO-prep assistants —
**no shipping product combines a coverage *marketplace* for knowledge
workers with an earned-currency incentive and structured knowledge
handoff.** The closest mechanical analog (Shyft's Shift Marketplace)
serves hourly retail workers and transfers zero context; the closest
cultural analog (Google's own Peer Bonus / gThanks) rewards after the
fact and guarantees nothing. That's the moat — and the pitch.

The product itself is feature-rich and economically sound (ledger with
idempotency keys, escrow, per-day release, timezone-correct as of
`a24071e`), but it stands on engineering that cannot support success:
**zero automated tests guard a virtual economy**, production and
development are the same Firebase project, the economy math exists in
two places that can drift, an abandoned Angular scaffold confuses the
repo, and the 3,829-line single-file frontend re-renders the entire DOM
on every state change. None of this is visible to users today; all of it
determines whether the team can move fast without breaking money next
quarter.

The plan has three thrusts, sequenced so each unblocks the next:

- **Thrust A — Trustworthy foundations** (engineering): economy test
  suite against the Firestore emulator, prod/dev project split, one
  source of truth for economy math, delete the dead Angular scaffold,
  CI, error monitoring. ~2 weeks, mostly mechanical.
- **Thrust B — Adoption engine** (usability): live where TAMs live
  (Chat/Slack webhooks + the email digest that already shipped),
  60-second time-to-first-bounty, Cmd-K + keyboard surface, coverer
  auto-matching, PWA installability. This is what converts a demo into
  a habit.
- **Thrust C — Designed object** (design): finish the launch gate's
  visual items — elevation tokens, sprite sheet, 3-line bounty card,
  professional verbs — then go beyond with a semantic-token refactor
  that cuts per-skin CSS cost ~60%.

North-star metric: **% of vacations in active crews that start with
coverage fully claimed ≥3 days before day 1.** Everything below serves
that number.

---

## 2. Competitive landscape (June 2026)

### 2.1 The five adjacent categories

**A. PTO / leave management** —
[Vacation Tracker](https://vacationtracker.io/),
[TimeOff.Management](https://timeoff.management/),
[absentify](https://absentify.com/), BambooHR, Workday.
Track *who is away* and route approvals; calendar/Slack/Teams
integrations are table stakes. absentify goes furthest with a
"substitute" you can assign per absence — assignment, not a market.
**None create an incentive for anyone to actually cover.** They answer
"who's out?", not "who's got it covered?".

**B. Shift-swap marketplaces (hourly workforce)** —
[Shyft](https://www.myshyft.com/shift-marketplace/) (1M+ hourly workers;
Starbucks, McDonald's, Old Navy),
[Deputy](https://www.deputy.com/features/shift-swapping),
[When I Work](https://connecteam.com/shift-trade-apps/), 7shifts.
The closest *mechanic* to Time Off: post a shift to a marketplace,
coworkers claim it, manager approves, and on Shyft a worker can even
attach a **cash incentive** to an unpopular shift. Deputy auto-suggests
"available, qualified, cost-efficient" candidates — matching, not just
listing. But the unit is an hourly shift: no knowledge transfer, no
briefing, no meetings/inbox/escalations, no enterprise SSO posture, no
sense of *earned* currency (it's cash or goodwill).

**C. On-call override tools (engineering)** —
[PagerDuty schedule overrides](https://support.pagerduty.com/main/docs/edit-schedules),
multi-overrides for vacation, "unassigned shifts" volunteers, and the new
[Shift Agent](https://community.pagerduty.com/ask-a-product-question-2/intelligent-override-management-with-pagerduty-s-shift-agent-776)
that finds coverage and completes overrides "in two clicks in chat."
Opsgenie and Grafana OnCall are equivalent. This is the engineering-grade
ceiling for *rotation* coverage — but it is scoped to paging. A TAM's
vacation is inbox + meetings + escalations + customer 1:1s, which no
on-call tool models. And there is **zero incentive layer**: overrides run
on goodwill and reciprocity that decays in larger teams.

**D. Recognition economies** —
[Bonusly](https://bonusly.com/post/a-look-at-googles-peer-to-peer-bonus-system),
[HeyTaco](https://heytaco.com/how), Motivosity; internally at Google,
**Peer Bonus (~$175, manager-approved) and gThanks/Kudos already exist**.
Two hard lessons from this category: (1) HeyTaco claims ~67% daily
engagement *because it lives entirely inside chat* — friction of "open
another tab" is what kills Bonusly-style adoption; (2) point economies
drift toward feeling transactional and cluster at expiry boundaries —
Time Off's expiring monthly stipend is actually the right design here
(use-it-or-lose-it fights hoarding), but the *earned* balance must never
expire (it doesn't — correct).

**E. AI OOO-prep assistants** —
[Microsoft Copilot's out-of-office prep flow](https://microsoft.github.io/agent-academy/cowork-collective/out-of-office-prep/)
builds a handoff plan, proposes calendar actions, OOF auto-replies, and
Teams messages from a single prompt.
[Slack's OOO template](https://slack.com/templates/out-of-office-plan)
is the manual version. These transfer *context* but provide no
marketplace, no guarantee anyone accepts, no economy.

### 2.2 Feature matrix

| Capability | PTO trackers | Shift-swap | On-call tools | Recognition | **Time Off today** |
|---|---|---|---|---|---|
| Knows who's away | ✅ | ✅ | ✅ | — | ✅ |
| Marketplace where coverage is *claimed* | — | ✅ | partial (volunteers) | — | ✅ |
| Incentive to cover | — | cash (Shyft) | — | after-the-fact | ✅ earned currency |
| Knowledge handoff (briefing, SLA, meetings) | — | — | — | — | ✅ + Gemini |
| Multi-person split of one absence | — | — | — | — | ✅ crew mode |
| Lives in chat (Slack/Teams/Chat) | ✅ | ✅ | ✅ (Shift Agent) | ✅ | ❌ **gap** |
| Auto-suggest who should cover | — | ✅ Deputy | ✅ Shift Agent | — | ❌ **gap** |
| Manager approval gate | ✅ | ✅ | — | — | ❌ (by design; offer as option) |
| Mobile app / installable | ✅ | ✅ | ✅ | ✅ | ❌ **gap** |
| Audit/compliance surface | ✅ | ✅ | ✅ | — | partial (audit log) |

### 2.3 Position and pitch

**Unique position:** *the only tool where taking vacation is a
transaction the team can profit from — coverage is claimed, not begged
for, and the context moves with the coins.*

Pitch discipline for a Google audience (from the matrix + doc 15):

1. **Lead with the marketplace + briefing**, never with scrolls or
   leaderboards — gThanks and Peer Bonus already own "recognition" at
   Google; duplicating them reads as naive. Scrolls stay as familiar
   garnish, not headline.
2. **Concede category B/C exist** and position against them: "Shyft for
   knowledge work — where what transfers isn't an 8-hour shift, it's
   your accounts, your escalations, and your meetings, with an AI
   briefing attached."
3. **The bar in 2026 is agentic-in-chat** (PagerDuty Shift Agent). The
   roadmap must end with "claim coverage from Chat in two clicks," or
   Time Off will be the destination-site dinosaur in its own demo.

### 2.4 What NOT to build (anti-scope)

- **Full PTO tracking / approval workflows** — Workday/Calendar OOO own
  this. Integrate (read OOO events to *suggest* posting a bounty), never
  duplicate.
- **A rewards catalog** (gift cards etc.) — that's Bonusly/HeyTaco's
  business and a procurement nightmare inside a big company. Doubloons
  stay an internal coverage currency; if leadership later wants to map
  quarterly top-coverers to Peer Bonus nominations, that's a manager
  ritual, not product surface.
- **A second recognition feed** — scrolls exist and are enough.
- **Native iOS/Android apps** — PWA + chat integrations cover the
  mobile moment (check the board, claim a day) at 5% of the cost.

---

## 3. Code & architecture analysis

### 3.1 What's structurally good (keep)

- **The ledger design** (`functions/src/services/wallet.ts`) is the best
  code in the repo: append-only entries keyed by deterministic
  idempotency IDs, wallet as a projection, all reads-before-writes
  inside transactions. This is bank-grade thinking and the reason the
  economy survived the forceCompleteBounty and timezone bugs without
  data corruption.
- **Deny-by-default Firestore rules** with callable-only writes — the
  client never mutates money. Correct.
- **Zod validation on every callable**; consistent error mapping.
- **No-framework frontend was the right MVP call** — it shipped 60+
  features in two weeks with zero build pipeline. The problem isn't the
  absence of React; it's the absence of *modules* (see 3.2).
- **Docs culture** — 16 docs of design history is more than most funded
  startups have.

### 3.2 The debts that now have interest (fix in Thrust A)

1. **Zero automated tests.** Not one test file outside the abandoned
   `web/tsconfig.spec.json`. The product's core is *money invariants*
   (escrow in == releases + refunds + burns; no negative balances; no
   double-release), which are exactly the kind of thing emulator-based
   integration tests catch and humans don't. Both economy bugs found by
   the audits (forceComplete not releasing; UTC drift) would have been
   caught by a 20-case suite.
2. **Prod is dev.** `.firebaserc` has a single project
   (`vacaciones-dev-b3158`) with `-dev-` literally in the name, serving
   the live URL. One `firestore.rules` typo away from a public incident.
3. **Economy math duplicated.** `ECONOMY` constants and
   `computeCoverageCost` exist independently in `app/app.js:42-43,384-392`
   and `shared/src/economy/*` (compiled into functions via the
   `copy-shared.js` prebuild hack). The defensive "Cost calc mismatch"
   check in `createCoverageRequest.ts:144-150` exists *because* the team
   already distrusts this duplication. One pricing change applied to one
   side = users see one price, get charged another.
4. **Dead Angular scaffold** (`web/`, plus a README that still describes
   "Angular 21 + AngularFire + Material + Tailwind" as the architecture).
   Anyone new to the repo — humans or agents — wastes their first hour
   on the wrong frontend. (Decision recorded 2026-05-28 chose Angular;
   reality shipped vanilla. Reality won; the repo should admit it.)
5. **Full-DOM re-render on every state change** (`render()` in
   `app/app.js`). Already caused the focus-loss bug class twice (day
   picker, mode toggle — both patched with surgical re-renders). Each
   new interactive component will re-hit this until rendering is
   incremental or at least region-scoped.
6. **4-skin CSS by override multiplication.** `styles.css` is 4,152
   lines because every component gets re-styled per skin
   (`[data-skin="basic"] .bounty {...}` × 4). Cost of every new
   component = 1 + 4 overrides; the audits already found basic/hc gaps
   on newer components. The fix is semantic tokens (see §5.3).
7. **No CI, no monitoring, no analytics.** Deploys are manual from a
   laptop; errors surface only if a user screenshots them; adoption
   claims will have zero data behind them at pitch time.
8. **Invite token = database doc ID** (`joinTeam`, share link) — already
   flagged P0 in doc 16's launch gate; restated here because it belongs
   to Thrust A's security pass alongside App Check.

### 3.3 The explicit architecture decision

**Recommendation: stay vanilla, become modular. Do not resurrect
Angular; do not rewrite in React.**

Rationale: the product is one developer + agents moving fast; the
frontend is fundamentally render-templates-from-state; the pain points
(no types, no modules, no tests, focus-destroying re-render) are all
addressable *incrementally* with Vite + TypeScript + ES modules at ~20%
of a rewrite's cost. A rewrite would freeze user-visible progress for
a month right when the launch gate matters. The `web/` scaffold gets
deleted (history stays in git), the README gets rewritten to describe
reality.

Target frontend layout after Thrust A:

```
app/
  index.html
  src/
    main.ts            // boot, auth listener, router
    state.ts           // typed AppState + pub/sub (no framework)
    api.ts             // callable wrappers (typed against shared/)
    render/            // per-screen render modules
      bounties.ts  chest.ts  wof.ts  members.ts  post.ts  settings.ts
    components/        // modal.ts, toast.ts, daypicker.ts, card.ts
    skins.ts  audio.ts  calendar.ts  markdown.ts
  styles/
    tokens.css         // semantic tokens (see §5.3)
    base.css  components.css  skins/{pirate,basic,hc,dark-knight}.css
shared/                // single source of truth, imported by BOTH sides
functions/
```

Vite gives: TS without ceremony, `import { ECONOMY } from '@shared/economy'`
on the client (kills debt #3), hashed bundles, dead-code elimination,
and a dev server. The migration is mechanical: split `app.js` along its
existing comment banners (the file is already organized in sections),
one module per PR, `app.js` shrinking until deleted.

---

## 4. Thrust A — Trustworthy foundations (engineering)

| # | Move | Detail | Effort |
|---|---|---|---|
| A1 | **Economy test suite** | Vitest + Firebase emulator. ~25 integration cases: post→accept→daily-release→complete happy path; crew-mode partial claims; cancel-with-partial-release refund math; forceComplete pays remaining days exactly once (re-run = no-op); timezone boundary cases (Tokyo/PT, DST entry/exit); stipend expiry; idempotency under replay; rules tests (client cannot write wallets/ledger/mail). Add `npm test` to CI gate. | M |
| A2 | **Split prod/dev projects** | New `vacaciones-prod` Firebase project; `.firebaserc` targets `dev`/`prod`; `firebase use`; hosting targets; copy Auth config + indexes; migrate the pilot crew's data once with a one-off script. Deploys to prod only via CI on tagged release. | S–M |
| A3 | **One source of truth for economy** | Client imports `shared/src/economy` via Vite alias (after A5 bootstrap, this is trivial); delete `computeCoverageCost`/`ECONOMY` from `app.js`; keep the server-side mismatch check for one release as a canary, then remove. | S |
| A4 | **Delete `web/`, rewrite README** | `git rm -r web/`; README describes the vanilla+Vite reality, links docs, states the launch-gate status. | S |
| A5 | **Vite + TS bootstrap** | Vite serving `app/` as-is (app.js becomes the single entry, untyped); then peel modules per §3.3 one PR at a time. No user-visible change. | M |
| A6 | **CI (GitHub Actions)** | PR: typecheck functions + app, run A1 suite against emulator, `firebase hosting:channel:deploy` preview URL on every PR. Main: deploy dev. Tag: deploy prod. | S |
| A7 | **Error monitoring + analytics** | Sentry (or GCP Error Reporting) for both app and functions; minimal product analytics (GA4 or PostHog): `bounty_posted`, `bounty_claimed`, `time_to_first_bounty`, `digest_opened`, `skin_selected`. The pitch needs these numbers. | S |
| A8 | **Security pass** | Rotating capped invite tokens under `teams/{tid}/private/inviteTokens` (kills teamId-as-token); App Check (reCAPTCHA Enterprise) on callables; CSP: drop `'unsafe-inline'` for scripts (Vite hashing enables nonces); GDPR trio — `deleteMyAccount`, `disbandCrew`, `exportMyData` callables (doc 16 gate items #5–6). | M–L |

Exit criteria for Thrust A: a PR that breaks escrow math cannot merge;
a bad deploy cannot touch real users; the repo has one frontend and one
copy of the price list.

---

## 5. Thrust C — Designed object (design)

(Numbered C but can run interleaved with B; the launch-gate visual items
block the pitch.)

### 5.1 Finish the launch gate (from doc 16, unchanged priorities)

- Delete duplicate `.bounty` CSS rule (`styles.css:919` vs `:1216`) — P0/S.
- 3-line bounty card + compact/comfortable density toggle — P1/M.
- Hand-drawn 16×16 sprite set (8 ranks, 6 coverage kinds, 2 reachability)
  replacing OS emoji in structural UI — P1/M.
- Professional verbs on chrome (`Hoist`→`Create crew`, `Aye`→`Join`,
  `Take voyage`→`Cover`); pirate voice stays on narrative surfaces — P1/S.
- Elevation tokens `--elev-1..4` replacing the universal 4-shadow stack;
  kill the dashed `.empty-card` border — P1/M.
- Header reduced to brand + bell + avatar; coin/rank/sound/skin into a
  Profile sheet — P1/S.
- 44×44 touch targets at `≤720px` — P1/S.

### 5.2 Motion discipline (codify doc 16's resolution)

Two explicit token families in `tokens.css`:
`--ease-affordance: cubic-bezier(0.22,1,0.36,1)` (120ms buttons, 350ms
sheets) for UI feedback, and `steps(N)` reserved for diegetic pirate
illustration (loading doubloon, coin shower, harbor scene). One rule,
written in the stylesheet header, enforced in review.

### 5.3 Semantic-token refactor (the structural design move)

Today each skin restyles components. Invert it: components consume
**semantic tokens only** (`--surface-card`, `--surface-raised`,
`--text-primary`, `--text-muted`, `--accent`, `--accent-soft`,
`--border-default`, `--border-strong`, `--radius-card`, `--elev-*`,
`--font-body/display/mono`), and a skin is just a token sheet (~80
lines) plus at most a dozen personality overrides (Pirate's bevels,
HC's forced borders). Expected effect: `styles.css` shrinks ~40%,
per-skin gaps (the basic/hc drift the audits caught) become impossible
by construction, and a future "company brand" skin for a pitch demo
costs an afternoon. Dark Knight already approximates this pattern —
promote its variable set to the canonical semantic layer.

### 5.4 The one cinematic that earns its frames

Ship the Commodore rank-up moment (doc 14 #21, doc 16 conflict 4) as the
single celebratory set-piece — one-time, 5 seconds, screenshot-worthy.
Everything else stays quiet. This is the "internal screenshot test"
winner that markets the product in Slack channels by itself.

---

## 6. Thrust B — Adoption engine (usability)

Ordered by expected impact on the north star.

### B1. Live in chat (the #1 lever — every category teaches this)

- **Phase 1 (S):** outbound webhooks per crew — Google Chat space +
  Slack incoming webhook URLs in Crew Settings; post on
  `bounty_created` / `claimed` / `fully_covered` / `cancelled` with a
  deep link. The email layer shipped at `a24071e`; this is the same
  event fan-out, one more sink.
- **Phase 2 (M):** link unfurls + a `/timeoff` slash command (post "I'm
  out next Thu–Fri" from chat; claim with a button click). This is the
  PagerDuty-Shift-Agent bar: *coverage in two clicks without leaving
  chat.*

### B2. Sixty-second first bounty

- "**I'm out next week**" preset button on the empty board and in Cmd-K:
  pre-fills Mon–Fri of next week, default reachability, team-default
  SLA; user confirms in one review screen. Measure `time_to_first_bounty`
  (A7); target p50 < 60s from first login.
- **Calendar OOO detection** (read `eventType=outOfOffice` with the
  existing incremental-consent flow): banner "You're OOO Jul 14–18 with
  no coverage — post it?" This converts the tool from
  remember-to-visit to it-noticed-first, and no competitor in any
  category does it for knowledge work.

### B3. Coverer auto-matching (Deputy's lesson, knowledge-work edition)

Rank crewmates on the bounty detail + in the chat ping by: doubloon
balance pressure (low earned balance = wants income), past coverage of
this requester (context already transferred), calendar load that week
(via existing freebusy consent), timezone overlap with the bounty's
days. Show top-3 "good matches" with one-click *invite to cover* (a
scroll-style nudge, not an assignment). Manager-assign stays out —
the market is the product; suggestions grease it.

### B4. Keyboard surface

Cmd-K command palette (post, claim, search, go-to-tab, theme), `j/k`
list navigation, `?` cheat sheet, `n` = new bounty, `/` = search.
~250 self-contained lines (doc 15 Finding 1); disproportionate
credibility with the Buganizer-native audience.

### B5. PWA + mobile ergonomics

`manifest.json` + service worker (cache-first static, network-first
data) + the 44px target pass = installable on a phone home screen in a
day of work. The mobile moment is "claim a day from the couch" — chat
notifications (B1) deep-linking into an installable PWA covers it
without native apps.

### B6. Optional manager approval gate (regulated-team mode)

Crew setting: `claimsRequireApproval` (default **off**). When on, a
claim parks as `pending` until manager taps approve (audit-logged).
Shyft/Deputy ship this for a reason: some orgs can't let coverage
self-assign. Keeping it off by default preserves the marketplace feel.

### B7. Empty states that onboard

Day-1 crew: seeded "example bounty" card (clearly marked, dismissible)
showing what a good post looks like — with the briefing panel filled.
Day-90 quiet board: digest of crew stats instead of a lonely turtle.

---

## 7. Roadmap

**Sprint 1 (week 1–2) — "Can't break money, can't lose the repo"**
A1 economy tests · A2 prod/dev split · A4 delete `web/` + README ·
A6 CI · launch-gate quickies (duplicate `.bounty` rule, verbs, header,
touch targets). *Exit: green CI gate; prod isolated; gate items 8/12.*

**Sprint 2 (week 3–4) — "Looks designed, reads professional"**
A5 Vite bootstrap · A3 shared economy import · 3-line bounty card +
density toggle · elevation tokens · sprite sheet (16 sprites) ·
A8 invite tokens + GDPR callables. *Exit: launch gate 12/12 → pitch-ready.*

**Sprint 3 (week 5–6) — "It comes to you"**
B1 phase 1 webhooks · B2 preset + OOO detection · B4 Cmd-K · A7
monitoring/analytics live · email extension installed in prod
(`functions/MAIL_SETUP.md`). *Exit: north-star metric measurable; pilot
crew of 5–10 real TAMs.*

**Sprint 4+ (quarter) — "Best in category"**
B3 auto-matching · B1 phase 2 slash command/unfurls · B5 PWA · B6
approval mode · §5.3 token refactor · §5.4 Commodore cinematic ·
docs/06 remaining sprites.

### Success metrics

| Metric | Target (pilot quarter) |
|---|---|
| North star: vacations fully claimed ≥3 days before start | ≥70% |
| Time to first bounty (new user, p50) | < 60 s |
| Bounties claimed < 48 h after posting | ≥80% |
| Weekly active coverers / crew size | ≥40% |
| Digest open rate / chat-ping click-through | ≥35% |
| Economy invariant violations (tests + prod monitors) | 0 |

### Top risks

1. **Economy regression while refactoring** — mitigated by A1 *before*
   A3/A5 (tests precede the moves they protect).
2. **Pirate-theme rejection by the first senior audience** — mitigated
   at `a24071e` (Dark Knight default) + Sprint 2 verb/copy pass; keep
   Pirate one click away, never the first impression.
3. **Perverse incentives** (hoarding, coverage-sniping, leaderboard
   pressure) — watch with A7 analytics; the expiring stipend and
   non-expiring earned split is the right design per category-D
   evidence; revisit only with data.
4. **Chat-platform review friction** (Slack app directory / Chat app
   publishing) — phase 1 uses plain incoming webhooks precisely to
   defer this; the slash-command app comes only after the pilot proves
   pull.
5. **Single-maintainer bus factor** — partially mitigated by A1/A6
   (agents can refactor safely against a test gate) and the docs set.

---

## 8. Sources (competitive research, June 2026)

- Shift marketplaces: [Shyft Shift Marketplace](https://www.myshyft.com/shift-marketplace/) · [Deputy shift swapping](https://www.deputy.com/features/shift-swapping) · [Connecteam round-up](https://connecteam.com/shift-trade-apps/) · [7shifts trades](https://kb.7shifts.com/hc/en-us/articles/4417505341715-How-to-Trade-Shifts-for-Employees)
- On-call: [PagerDuty overrides](https://support.pagerduty.com/main/docs/edit-schedules) · [My On-Call Shifts](https://support.pagerduty.com/main/docs/my-on-call-shifts) · [Shift Agent (agentic overrides in chat)](https://community.pagerduty.com/ask-a-product-question-2/intelligent-override-management-with-pagerduty-s-shift-agent-776)
- PTO/leave: [Vacation Tracker](https://vacationtracker.io/) · [TimeOff.Management](https://timeoff.management/) · [absentify (substitutes)](https://absentify.com/) · [Slack OOO template](https://slack.com/templates/out-of-office-plan)
- Recognition: [HeyTaco how-it-works](https://heytaco.com/how) · [HeyTaco vs Bonusly](https://heytaco.com/alternatives/bonusly) · [Google's peer bonus system (Bonusly blog)](https://bonusly.com/post/a-look-at-googles-peer-to-peer-bonus-system) · [Digitizing Google peer recognition (Medium)](https://medium.com/@K3ARN3Y/how-google-does-peer-recognition-188446e329dd)
- AI OOO prep: [Microsoft Copilot OOO prep](https://microsoft.github.io/agent-academy/cowork-collective/out-of-office-prep/) · [Resolution vacation coverage template](https://www.resolution.de/post/vacation-coverage-plan-template/)

*Internal inputs: docs/01 (Phase-0 research, 2026-05-28), docs/08–11
(production audits), docs/12–16 (expert swarm + synthesis), full source
tree at commit `a24071e`.*
