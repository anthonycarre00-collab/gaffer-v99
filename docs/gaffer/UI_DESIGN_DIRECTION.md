# The Gaffer — UI / Visual Design Direction

> Audit of the current frontend state of `openfootmanager`, plus an opinionated
> proposal for the **Gaffer visual identity**.
>
> Status: proposal — written to be reacted to, not rubber-stamped. Push back on
> any specific hex code or font choice you disagree with; the *direction*
> (broadsheet + dugout, not SaaS dashboard) is the load-bearing part.

---

## PART 1 — AUDIT OF CURRENT STATE

### 1.1 CSS framework and current palette

**File:** `src/App.css` (single stylesheet, ~156 lines).

**Framework:** Tailwind CSS v4 (`@import "tailwindcss"`) via
`@tailwindcss/vite ^4.2.2`. No CSS Modules, no styled-components, no
vanilla-extract. Plain Tailwind utility classes inline in TSX, augmented with
a small `@theme` block defining custom CSS variables.

**Fonts already bundled (offline via `@fontsource`):**
- `Inter` (400/500/600/700, latin + latin-ext) — body
- `Barlow Condensed` (600/700, latin + latin-ext) — headings, exposed as
  `--font-heading` and used everywhere via the `.font-heading` utility and
  `font-family: var(--font-heading)` on `h1`–`h6`.

**Current color palette (defined as Tailwind v4 `@theme` tokens in `App.css`):**

| Token | Hex | Notes |
|---|---|---|
| `--color-primary-500` | `#10b981` | **Tailwind's stock emerald-500** — reads "SaaS success state", not "football club" |
| `--color-primary-600` | `#059669` | Emerald-600, stock |
| `--color-primary-700` | `#047857` | Emerald-700, stock |
| `--color-accent-400` | `#fcd34d` | **Tailwind's stock amber-300** (mislabeled 400) — generic "gold" |
| `--color-accent-500` | `#eab308` | Yellow-500, stock |
| `--color-navy-900` | `#0a1128` | Custom navy, default dark-mode bg |
| `--color-navy-800` | `#131b33` | Sidebar / header bg in dark mode |
| `--color-navy-700` | `#1a2340` | Card surface in dark mode |
| `--color-navy-600` | `#243054` | Borders / dividers in dark mode |
| `--color-success-400/500/600` | `#06d6a0 / #05a87d / #059669` | Custom green |
| light mode | Tailwind `gray-100` bg, `navy-900` text | Default browser grays elsewhere |

**Verdict:** The palette is *football-coded* (green + gold + navy works for the
genre) but every green and gold value is a verbatim Tailwind swatch. The app
reads as "Tailwind starter template with a football theme" rather than "Gaffer's
office". The navy ramp is the only genuinely bespoke part and it's good —
atmospheric, slightly cool, suggests floodlit stands.

**Other styling conventions observed in `App.css`:**
- `@custom-variant dark` → toggled via `.dark` class on `<html>` (set by
  `ThemeContext`).
- Thin custom scrollbar utility (`.scrollbar-thin`, 4px width).
- High-contrast mode: `.high-contrast.dark .text-gray-500/400/600` overrides
  for low-contrast text, toggled by `settings.high_contrast`.
- One custom animation: `fade-slide-in` (220ms) for `.digest-event-item` —
  staggered reveal of round-digest feed items.
- `prefers-reduced-motion` is respected.
- Dark-mode hack for native `<select>` dropdown backgrounds on Linux
  WebKitGTK (real production scar tissue — keep it).

### 1.2 Top-level layout

**File:** `src/App.tsx` (74 lines).

`App.tsx` is a thin shell:
- Wraps everything in `<BrowserRouter>` + `<Suspense>` with a `LazyFallback`
  spinner.
- 7 lazy-loaded routes: `/`, `/select-team`, `/dashboard`, `/match`,
  `/settings`, `/sim-lab`, `/world-editor`.
- Three top-level side-effects on mount:
  1. Load settings (`settingsStore`).
  2. Apply `ui_scale` (small/normal/large/xlarge → 14/16/18/20px root font size).
  3. Apply `high_contrast` class.
  4. Apply saved `language` (overrides OS detection).
- `<ThemeProvider>` wraps `<App>` from `main.tsx`.

**The real top-level layout lives in `src/pages/Dashboard.tsx` (597 lines).**
Dashboard is the in-game shell, structured as a classic 3-pane app:

```
┌──────────────┬──────────────────────────────────────────┐
│              │ DashboardHeader (sticky, white/navy-800) │
│              │   [back] [tab label · date]              │
│ DashboardSide│   [search]                               │
│   bar        │   [theme toggle] [save] [continue ▼]     │
│ (navy-800,   ├──────────────────────────────────────────┤
│  w-64/w-20   │                                          │
│  collapsible)│  DashboardWorkspaceContent               │
│              │   (renders active tab: Home / Squad /    │
│              │    Tactics / Training / Inbox / etc.)    │
│              │                                          │
└──────────────┴──────────────────────────────────────────┘
```

- **Sidebar** (`DashboardSidebar.tsx`, 347 lines): collapsible (64px ↔ 256px),
  navy-800 background, brand block on top, manager/team profile button,
  then nav sections (`Home / Inbox / News / Schedule` always;
  `Squad / Tactics / Training / Staff / Scouting / Youth / Finances / Transfers`
  only when employed; `TransferCentre / HallOfFame / Players / Managers / Teams /
  Tournaments` always under "World"). Settings + Exit at the bottom. Active item
  uses `bg-linear-to-r from-primary-500 to-primary-600 text-white shadow-md
  shadow-primary-500/20` — a green gradient pill.
- **Header** (`DashboardHeader.tsx`, 493 lines): sticky white/navy-800 bar with
  back button, active-tab label (Barlow Condensed, uppercase, tracking-wide),
  current date with calendar icon, full-width search input (opens a player/team
  results dropdown), theme toggle, save button, and the signature
  **Continue button** — a split button (`bg-linear-to-r from-primary-500
  to-primary-600` for live, indigo for spectator, amber for delegate) with a
  dropdown for switching match mode.
- **Workspace** (`DashboardWorkspaceContent.tsx`): renders the active tab.

`MainMenu`, `TeamSelection`, `Settings`, `MatchSimulation`, `SimLab`, and
`WorldEditor` are separate full-screen routes outside the Dashboard shell.

### 1.3 Component directory catalog

Top-level subdirectories of `src/components/`:

| Directory | Purpose |
|---|---|
| `dashboard/` | Dashboard shell — sidebar, header, overlays, modals (blocker, fired, exit-confirm, recap, simulating), recap helper, profile navigation. The "chrome" of the in-game app. |
| `home/` | The Home tab — 12+ cards: squad overview, next opponent, recent results, recent messages, latest news, league digest, league position, season status, player momentum, unavailable players, onboarding checklist, job opportunities. |
| `inbox/` | Inbox tab — toolbar, message list pane, message detail pane, context menu, delegated-renewal report, delete confirm. |
| `news/` | News tab — feed of generated articles. |
| `schedule/` | Schedule tab — calendar grid of fixtures. |
| `squad/` | Squad tab — roster view (table + pitch tokens), kit editor, jersey-number input, sort state, helpers. The most data-dense screen. |
| `tactics/` | Tactics tab — pitch canvas, player table, role panel, phase blueprint panel, filters, command bar, context menu, custom-tactics helpers. |
| `training/` | Training tab — settings panel (focus/intensity/schedule), training-groups card, fitness sidebar, staff advice engine. |
| `staff/` | Staff tab — coaches, scouts, physios list. |
| `scouting/` | Scouting tab — overview cards, scout details, player search, youth recruitment, assignments list, model/view-model/helpers. |
| `youthAcademy/` | Youth Academy tab — intake and development. |
| `finances/` | Finances tab — ledger, cash-flow chart. |
| `transfers/` | Transfers tab + Transfer Centre — bid modal, counter-offer modal, free-agent contract modal, loan offer modal, deal workspace, negotiation history, transfer-centre world tab, bid/free-agent flow hooks. The most modal-heavy area. |
| `players/` | Players world tab — searchable list of all players in the world. |
| `teams/` | Teams world tab — searchable list of all clubs. |
| `teamProfile/` | Team profile view — hero, summary, club details, roster, league standing, recent matches, history, advanced stats, style radar chart, season-history chart, primitives, gateway, view-model. |
| `playerProfile/` | Player profile view — hero, attributes card, radar chart, advanced stats, season stats, stat card, contract card, recent matches, career history, movement history, injury banner, loan status banner, renewal modal, scout action, actions menu, helpers, attributes builder. The deepest single-entity screen. |
| `manager/` | Manager tab + Managers world tab — manager career chart. |
| `tournaments/` | Tournaments tab — competitions overview, knockout bracket. |
| `hallOfFame/` | Hall of Fame world tab — retired legends. |
| `match/` | Match-day flow — `MatchLive`, `MatchScreenLayout`, `MatchPanels` (event feed / stats / lineups), `PreMatchSetup`, `PreMatchLineup`, `HalfTimeBreak`, `PostMatchScreen`, `PostMatchCharts`, `PenaltyShootoutScreen`, `PressConference`, `SubPanel`, `FormationPitch`, `SetPieceSelector`, `TeamTalkIcons`, `RoundDigestScreen`, commentary, roles, helpers, types. The largest single subdirectory. |
| `season/` | End-of-season awards ceremony screen. |
| `worldEditor/` | World-editor tool — sidebar, top bar, layout, list panel, form panel, list content, home. |
| `menu/` | Main-menu screens — saves list, world select, create-manager form, manager profile list, package build step, profile save confirm, create-manager nationality field, plus the `PackageEditor/` subdirectory (a full data-package editor with tabs for teams/players/staff/names/competitions/confederations/countries, forms, preview cards, primitives, helpers, sample data). |
| `ui/` | Reusable primitives — `Card`, `Button`, `Badge`, `ProgressBar`, `Select`, `Checkbox`, `DatePicker`, `PlayerAvatar`, `TeamLogo`, `GeneratedCrest`, `GeneratedAvatar`, `CountryFlag`, `CountryCombobox`, `TeamLocation`, `JerseyIcon`, `PitchToken`, `ThemeToggle`, `InjuryBadge`, `AssetImage`, `PlayerMeaningCard`, plus `charts/` (ChartContainer + chartTheme). 20 exports total via `ui/index.ts`. |
| `playerActions/` | Shared player context-menu items (view profile, view team, toggle transfer-list, etc.). |

Plus standalone components at the root of `src/components/`: `ContextMenu.tsx`,
`NextMatchDisplay.tsx`, `NegotiationFeedbackPanel.tsx`, `ScoutPlayerCard.tsx`,
`SwitchClubConfirmModal.tsx`, `EndOfSeasonScreen.tsx`, `TraitBadge.tsx`.

**Verdict:** Well-organized feature-folder structure. The `ui/` primitives are
the right abstraction layer — 20 exports is manageable. The `match/` directory
is doing the most work and is the natural place to push visual ambition hardest
(match day is the emotional peak of any football manager game).

### 1.4 Theme system

**Files:** `src/context/ThemeContext.tsx`, `src/components/ui/ThemeToggle.tsx`,
`src/components/ui/charts/chartTheme.ts`, `src/store/settingsStore.ts`.

**What exists:**
- **`ThemeContext`** — light/dark toggle, persisted to `localStorage` under
  `ofm-theme`. Defaults to **dark** ("Matchday aesthetic" per the comment on
  line 17). Toggled by adding/removing `.dark` class on `<html>`.
- **`ThemeToggle`** — Sun/Moon icon button in the dashboard header.
- **Chart theme** — separate `DARK_THEME` / `LIGHT_THEME` objects in
  `chartTheme.ts` consumed by Recharts. Hardcodes the same emerald/indigo/red
  palette as the Tailwind tokens. Reads `isDark` from `ThemeContext`.
- **`settingsStore`** — adds two extra accessibility levers:
  - `ui_scale`: small/normal/large/xlarge (root font-size 14/16/18/20px).
  - `high_contrast`: toggles `.high-contrast` class for boosted grays.

**What's missing:**
- No design-token file / single source of truth. The palette is split across
  `App.css` `@theme`, `chartTheme.ts`, and ~50 inline Tailwind classes per
  component (e.g., `text-indigo-500`, `bg-amber-500`, `text-red-500` appear
  ad-hoc in `DashboardHeader` and `MatchLive`).
- No semantic tokens. Components reach for raw `primary-500` / `accent-400` /
  `red-500` / `amber-500` directly, so retuning the palette means grepping the
  whole codebase.
- No theme variants beyond light/dark (no "matchday" theme, no "briefing"
  theme, no per-team-color theming for the match screen).

### 1.5 i18n tone

**File:** `src/i18n/locales/en.json` (3,965 lines, 12 locales total: en, es,
de, fr, it, pt, pt-BR, cs, ru, tr, zh-CN, + INTENTIONAL_SAME placeholder).

**Tone is split-brain.** Three distinct voices coexist:

1. **Formal SaaS** (default, ~80% of strings):
   - `"training.staffAdvice.ok": "Squad fitness is high. You could switch to
     Balanced or Intense for more development."`
   - `"squad.coverageStable": "Coverage looks healthy"`
   - `"worldSelect.scanning": "Scanning for databases..."`
   - `"menu.loadingSaves": "Loading saves..."`
   - `"createManager.title": "Create Manager"`

2. **Gaffer-voice** (the meaning-engine labels, ~5% of strings, the good stuff):
   - `stability.RollOfTheDice` → "Roll of the Dice"
   - `stability.RunsHotAndCold` → "Runs Hot and Cold"
   - `stability.SteadyHand` → "Steady Hand"
   - `stability.TrustedLieutenant` → "Trusted Lieutenant"
   - `stability.MrReliable` → "Mr. Reliable"
   - `attrGroups.physical` → "The Body"
   - `attrGroups.technical` → "The Ball"
   - `attrGroups.mental` → "The Head"
   - `attrGroups.goalkeeper` → "The Gloves"
   - `"training.staffAlert" / "staffWarning" / "staffSuggestion"` — short, punchy.

3. **Generic sports-game** (~15%, the lazy middle):
   - `"training.criticalCondition": "{{count}} player(s) in critical condition
     (<25%)"`
   - `"scoutPotential.worldClass": "World class potential"`

**Verdict:** The Gaffer-voice islands are excellent — "Mr. Reliable", "Roll of
the Dice", "The Body / The Ball / The Head / The Gloves" are exactly the
grounded, personality-driven tone the user wants. The 80% SaaS-formal majority
is the problem: `"Squad fitness is high. You could switch to Balanced or
Intense for more development."` could be a Slack notification. The voice should
be the same gaffer talking in both places.

### 1.6 Representative components — current visual style

I read five components end-to-end to characterize the visual approach:

#### `PlayerMeaningCard.tsx` (113 lines, `src/components/ui/`)
The flagship meaning-engine card. Current treatment:
- Wraps in `<Card>` (white / navy-700 surface, `rounded-xl`, `shadow-sm`).
- Player name in `text-xl font-bold` Inter (not Barlow Condensed — missed
  opportunity).
- Badges for archetype + role identity.
- A clickable "Stability" box with 1px gray border, label in `text-xs uppercase
  text-gray-500`, value in `text-sm font-semibold`.
- A 2×2 grid of Form / Confidence / Fatigue / Morale — all `text-sm`.
- A "Pressure Response" box (Thrives / Channels / Folds / Escalates — Gaffer
  voice).
- A Relationships panel with emoji-style markers (`★` green, `⚠` red, `◆` gray,
  `●` blue).
- Collapsible "Advanced View" with the 19 attributes in 4 groups (Body/Ball/
  Head/Gloves), each attribute a 24px-wide label + ProgressBar + monospace
  number.
- Click-to-expand explanations on Stability and Pressure (good UX).

**Reads as:** dense, functional, slightly under-designed. The Barlow Condensed
heading font isn't used on the player name (it should be — that's the whole
point of having a display font). The emoji markers (`★ ⚠ ◆ ●`) feel arbitrary
and don't share a visual system.

#### `TrainingTab.tsx` (335 lines, `src/components/training/`)
- 3-column grid (`lg:grid-cols-3`): main content (2/3) + sidebar (1/3).
- Staff-advice banner at top: `rounded-xl border-2` with red/amber/blue
  variants for critical/warn/info. `font-heading font-bold uppercase
  tracking-wider` label, plain body text below.
- `TrainingSettingsPanel` for focus + intensity + schedule, with lucide icons
  per focus (HeartPulse, Crosshair, Brain, Shield, Zap, BedDouble) and per
  schedule (Flame, Scale, Feather). Color-coded: red/blue/primary-500.
- `TrainingGroupsCard` for per-player training-focus assignment.
- Sidebar: `Card accent="accent"` (gold top-border) for squad-fitness summary
  with two `ProgressBar`s (condition + morale) and exhausted/critical counts.
- Second card: scrollable player-fitness list sorted ascending (worst first),
  each row a `ProgressBar` + name + jersey number.

**Reads as:** the most "Football Manager"-like screen in the app. Data-dense,
practical, color-coded by state. The advice banner is the closest thing to
"Gaffer voice" in the UI — short, imperative, color-coded by urgency.

#### `SquadRosterView.tsx` (950 lines, `src/components/squad/`)
The biggest single component. Current treatment:
- Top: a `Card` with role-coverage badges (success/accent/danger variants per
  position group).
- Hero band: `bg-linear-to-r from-navy-700 to-navy-800` header inside the card
  with team name (Barlow Condensed, white, uppercase), formation/play-style
  summary, and role-coverage badge row.
- A wide sortable HTML `<table>` with columns: `#`, Pos, Name, Tactical Fit,
  Age, Condition, Morale, Contract, Actions, OVR.
- Headers: `font-heading font-bold uppercase tracking-wider text-gray-500
  dark:text-gray-400`.
- Rows: `divide-y divide-gray-100 dark:divide-navy-600`. Injury state gets a
  colored left border (`border-l-2 border-l-red-500` for major/serious,
  `border-l-amber-400` for minor/moderate). Contract risk gets orange/yellow
  left borders similarly.
- Per-row kebab menu (lucide `MoreVertical`) opens a `ContextMenu` with
  promote/demote, renew/let-expire/terminate, transfer-list, loan-list,
  delegate-to-youth, view-profile.

**Reads as:** a real, working squad table. The colored left-border pattern for
injury/contract risk is a good design choice — it conveys urgency without
adding visual clutter. The header gradient band is the only "decorative"
element. This is the right register for squad management — keep it dense.

#### `PlayerProfileHeroCard.tsx` (251 lines, `src/components/playerProfile/`)
The player-detail hero. Current treatment:
- `Card accent="primary"` (green top-border).
- Inside: `bg-linear-to-r from-navy-700 to-navy-800 p-8 rounded-t-xl` — a
  full-bleed navy hero band.
- 24×24 avatar (`rounded-2xl`), border-colored by OVR tier: green for ≥75, gold
  for ≥55, gray for lower.
- Jersey icon (custom `JerseyIcon` component rendering the team's actual kit
  colors and pattern — Solid / Stripes / Hoops / HalfAndHalf / Diagonal).
- Player name in `text-3xl font-heading font-bold text-white uppercase
  tracking-wide` — **here** Barlow Condensed is used correctly.
- Position badge + alternate-position badges + nationality flag + age +
  footedness + weak-foot rating, separated by `•` dots.
- Trait list (custom `TraitList` from `TraitBadge`).
- Right side: 2×2 grid of `QuickStat` boxes (Condition / Morale / Value /
  Wage), each in `bg-white/5 rounded-xl px-5 py-3` with Barlow Condensed label
  and bold value.
- Mobile: collapses to a 4-column grid below.

**Reads as:** the most visually ambitious card in the app. The navy gradient
hero band + green top-border + OVR-tiered avatar is a coherent look. This is
the closest the app gets to a "Gaffer aesthetic" today — use it as the
reference point for the rest of the UI.

#### `MatchLive.tsx` (443 lines, `src/components/match/`)
The live-match screen. Current treatment:
- `MatchScreenLayout` with a header band `bg-linear-to-r from-gray-200 via-white
  to-gray-200 dark:from-navy-800 dark:via-navy-900 dark:to-navy-800` (subtle
  horizontal gradient — like a floodlit pitch under lights).
- Live indicator: red pulsing dot (animate-ping).
- Scoreboard: home team name + logo + 4xl score + phase label + 2xl minute +
  4xl away score + away logo + name.
- Possession bar: horizontal split primary-500 vs indigo-500.
- Below: tabbed panel (Events / Stats / Lineups) — border-bottom 2px in
  primary-500 when active.
- Right sidebar (288px): speed controls (Pause/Slow/Normal/Fast/Max),
  team-controls (subs, formation chips, play-style chips), key-events feed.
- Active chips use `bg-primary-500/20 ring-1 ring-primary-500/50`.

**Reads as:** clean, broadcast-influenced, a little clinical. The floodlit
gradient header is the right instinct. The 5-speed control cluster is too many
buttons in a row — reads like a video player, not a dugout. The key-events feed
is good.

### 1.7 Existing images, screenshots, and assets

**`/public`** (served at root):
- `openfootlogo.svg`, `openfootball.svg`, `openfootmanager_icon.png`,
  `tauri.svg`, `vite.svg` — branding/icons only.

**`/src/assets`:**
- `react.svg` — stock Vite template asset.

**`/src-tauri/icons`:** full icon set for Tauri bundling (32/64/128/256/512,
iOS AppIcon sizes, Android mipmaps, icns/ico, StoreLogo) — production complete.

**`/src-tauri/assets/portrait-sources/`:** 12 `.webp` files
(`chroma-01-mediterranean.webp` through `chroma-12-polynesian.webp`) — these
are the **chroma-key portrait backdrops** used to procedurally generate player
headshots across ethnicities. Thoughtful, diverse, production-quality asset
pipeline. Plus a README explaining usage.

**`/images/screenshots/`:** 7 PNGs used in the README:
- `inbox.png`, `news.png`, `manage_squad.png`, `matchlive.png`,
  `training.png`, `playertalk.png`, `presstalk.png`

These are the **only existing visual references** for the current UI. They
appear to predate the meaning-engine work (no PlayerMeaningCard visible in any
screenshot name).

**Verdict:** No moodboard, no design-system Figma, no logo lockup for the
"Gaffer" identity, no pitch/floodlight textures, no illustrations. The visual
identity is currently 100% Tailwind utility classes and lucide icons. There's
room to add atmospheric texture (paper grain, floodlight bloom, chalk strokes)
without bloating the bundle.

---

## PART 2 — PROPOSED GAFFER DESIGN DIRECTION

> The pitch: a manager's office at 21:40 on a Wednesday. Floodlights still on
> outside the window. A desk lamp throws warm light over a tactics board, a
> stack of scouting reports, and a laptop running spreadsheet macros. The
> Gaffer is scribbling. He swears once, mildly. He circles a name.
>
> That's the mood. Not "tactical dashboard". Not "broadcast TV graphic". Not
> "Football Manager 2025 with a darker theme". An office with a window onto
> the pitch.

### 2.1 Color palette

The current emerald + gold + navy is the right *family* but every value is a
raw Tailwind swatch. Re-tune toward materials, not Tailwind defaults.

#### Primary — **Pitch Green** (replaces Tailwind emerald)
The green of floodlit grass at night, not the green of a SaaS "publish" button.

| Token | Hex | Use |
|---|---|---|
| `--color-pitch-50` | `#E8F0EA` | Lightest tint — backgrounds in light mode |
| `--color-pitch-100` | `#C5D8C9` | Borders, dividers in light mode |
| `--color-pitch-300` | `#6E9678` | Disabled states, secondary text |
| `--color-pitch-500` | `#2D5A3D` | **Primary brand color** — active nav, primary buttons |
| `--color-pitch-600` | `#234730` | Hover/pressed |
| `--color-pitch-700` | `#1A3524` | Deep surface (sidebar footer, modal headers) |
| `--color-pitch-900` | `#0E1410` | **App background in dark mode** — pitch black with green undertone, replaces `navy-900` |

Rationale: `#2D5A3D` is recognizably "grass" but desaturated enough to feel
serious. The 900-level `#0E1410` is *almost* black with a single-degree green
shift — at night it reads as "wet grass under floodlights", not "stock chart
dark mode".

#### Secondary — **Brass** (replaces Tailwind amber/gold accent)
Trophy metal, locker-room nameplate, the brass bell on the gaffer's desk.

| Token | Hex | Use |
|---|---|---|
| `--color-brass-300` | `#D9B978` | Hover/active state for secondary actions |
| `--color-brass-400` | `#B8924A` | **Accent brand color** — replaces `accent-400` |
| `--color-brass-500` | `#9A7838` | Pressed state, dark-mode borders |
| `--color-brass-700` | `#5E4820` | Background tint for editorial cards |

Rationale: Tailwind's `#fcd34d` is highlighter-yellow. `#B8924A` is the color
of an engraved plate on a 1970s trophy — it has weight, history, a slight
tarnish. Use brass for the *meaning-engine* surfaces (stability labels,
narrative traits, scouting-confidence stars) so they visually separate from
operational UI.

#### Tertiary — **Mahogany** (new, replaces generic red/orange urgency ramp)
The leather of a dugout seat, the varnish on the gaffer's office door.

| Token | Hex | Use |
|---|---|---|
| `--color-mahogany-400` | `#A04634` | Warning — tired squad, expiring contract |
| `--color-mahogany-500` | `#7A2E1F` | **Danger** — injury, critical condition, firing risk |
| `--color-mahogany-700` | `#3A1F1A` | Surface tint for "under pressure" cards |

Rationale: FM uses pure red `#ef4444` for injuries and it screams "error state".
Mahogany `#7A2E1F` reads as "blood" or "leather" — serious but not a software
bug. Use for the existing `border-l-2 border-l-red-500` injury marker on
squad rows.

#### Neutrals — **Chalk, Concrete, Ink, Cream** (replaces generic grays)

| Token | Hex | Use |
|---|---|---|
| `--color-chalk` | `#E8E4D8` | Primary text on dark surfaces (replaces `gray-100`) |
| `--color-concrete` | `#7A7670` | Tertiary text, metadata (replaces `gray-500`) |
| `--color-ink` | `#1B1A17` | Primary text in light mode |
| `--color-cream` | `#F2EEE3` | Light-mode surface (newspaper paper, replaces `gray-100` bg) |
| `--color-floodlight` | `#F4E9C9` | **Editorial highlight** — sodium floodlight bloom, used for hero bands and scouting-note backgrounds |

Rationale: pure neutrals (`#F3F4F6`, `#1F2937`) read as "tech". Warm-tinted
neutrals (`#F2EEE3` cream, `#E8E4D8` chalk) read as "paper" and "painted
concrete". The floodlight cream `#F4E9C9` is the most distinctive addition —
it's the color of sodium-vapor floodlights bouncing off a wet pitch, and it
should appear on exactly one surface per screen (the hero band, the scouting
note, the match-day banner) to signal "this is the editorial moment".

#### Light vs Dark — recommendation
Keep dark as the default (already the case — `ThemeContext` defaults to dark
"for the Matchday aesthetic"). Light mode should use cream + ink, not white +
navy — light mode should feel like reading a match-day program on paper, not
using Gmail.

### 2.2 Typography

Two fonts already ship (Inter, Barlow Condensed). Keep both. Add two.

#### Headings — keep **Barlow Condensed** (already deployed)
Already shipped, already used in `font-heading` utility. The condensed
proportions read as broadsheet sports headline (The Athletic, ESPN bottom-line
ticker). No change needed except broader application — currently many headlines
(PlayerMeaningCard player name, MatchLive team names) fall back to Inter bold
when they should use Barlow Condensed.

#### Body — keep **Inter** (already deployed)
Already shipped, excellent screen font at small sizes. Keep for tables, form
labels, body copy.

#### NEW: Editorial serif — **Source Serif 4** (Google Fonts, OFL)
A serious, broadsheet-quality serif designed by Frank Grießhammer for Adobe.
Free on Google Fonts. Use for:
- Scouting reports and player notes (the "Gaffer's handwritten assessment"
  surface).
- Match-day commentary feed (text-only commentary is already the design intent
  per CONFLICTS.md #8 "no voice acting permanent").
- News article body (the `news/` tab).
- Season-recap narrative.
- Inbox messages from the chairman / board / agents.

Load via `@fontsource/source-serif-4` (latin 400/600 + italic). Exposes as
`--font-serif`. Use sparingly — at most one serif block per screen. The
contrast against Inter body should feel like opening a scouting report inside
a spreadsheet.

#### NEW: Tabular mono — **IBM Plex Mono** (Google Fonts, OFL)
Designed by IBM for technical documentation. Free. Use for:
- All numeric table cells: OVR, age, condition %, morale %, contract year,
  wage, market value, jersey number, match minute, score.
- The 19 attribute values (currently `font-mono` already — replace with
  `--font-mono: "IBM Plex Mono"` for consistency).
- Match stats columns (possession %, shots, passes).
- Save-file timestamps.

Load via `@fontsource/ibm-plex-mono` (latin 400/500/600). Exposes as
`--font-mono`. The goal: every number in the app aligns on a monospaced
grid, so the eye can scan a squad table without re-anchoring on each row.
This is the single highest-impact typography upgrade.

#### Type scale
Lock the scale to a 1.25 ratio with Barlow Condensed for display:

| Token | Size | Line-height | Font | Use |
|---|---|---|---|---|
| `--text-display` | 32px | 1.1 | Barlow Condensed 700, uppercase, tracking-wide | Screen title (Squad, Training, Match Day) |
| `--text-headline` | 24px | 1.15 | Barlow Condensed 700, uppercase, tracking-wide | Card title (Squad Roster, Recent Results) |
| `--text-title` | 18px | 1.2 | Barlow Condensed 600, uppercase | Section header inside a card |
| `--text-body` | 14px | 1.5 | Inter 400 | Default body, table cells |
| `--text-small` | 12px | 1.4 | Inter 500 | Labels, metadata, badges |
| `--text-micro` | 10px | 1.3 | Barlow Condensed 600, uppercase, tracking-widest | Section dividers ("CLUB", "WORLD") |
| `--text-editorial` | 15px | 1.65 | Source Serif 4 400, italic available | Scouting notes, match commentary, news |
| `--text-data` | 13px | 1.0 | IBM Plex Mono 500, tabular-nums | All numeric table cells |

### 2.3 Layout philosophy

**Broadsheet newspaper, not SaaS dashboard.**

The current app is already dense and table-heavy — that's correct, keep it.
What's missing is *hierarchy*: every screen feels equally weighted, every card
feels equally important. A real broadsheet has a front page (one giant
headline + one photo + one lead paragraph), then section dividers, then
columns of body copy. The Gaffer UI should work the same way.

#### Three-tier information hierarchy

**Tier 1 — The Masthead (one per screen).**
A full-width band at the top of each tab, 64–96px tall, on `floodlight` cream
(in dark mode) or `mahogany-700` (in light mode). Contains:
- The screen name in Barlow Condensed display weight, uppercase, tracking-wide.
- A single-sentence Gaffer-voice subhead (e.g., Squad screen: *"Twenty-five
  names. Pick eleven."* — not *"Manage your squad"*).
- One piece of context data (today's date + next fixture for Home; squad size
  + average age for Squad; etc.).
- A hairline rule below, in `pitch-100` (light) or `pitch-700` (dark).

This replaces the current DashboardHeader layout where the tab label sits
inline with search + save + continue. The masthead is the *editorial* layer;
the operational controls (search, save, continue) move to a 40px-tall utility
bar *below* the masthead.

**Tier 2 — The Lead (one or two cards, prominently sized).**
The single most important card on the screen, given 50–60% of the viewport
width and a `border-t-4 border-t-brass-400` accent. Examples:
- Home → `HomeNextOpponentCard` (already exists, just promote it visually).
- Squad → `SquadRosterView` (the table is the lead).
- Player Detail → `PlayerProfileHeroCard` (already correct).
- Match Day → the scoreboard (already correct).

**Tier 3 — The Columns (3–6 secondary cards in a grid).**
Everything else, in a 12-column grid with 16px gutters. Each card uses the
standard `Card` primitive (see 2.4). No card in tier 3 should be wider than
6 columns.

#### Whitespace
*Less than a SaaS app, more than FM.* Target ~12px padding inside cards (down
from current 24px `CardBody` default — too generous), 16px gutters between
cards, 24px outer page margin. Hairline 1px borders everywhere — no shadow
except on modals and the active tier-1 masthead.

#### Density target
The benchmark is **Bloomberg Terminal × The Athletic**. A squad table should
show 25 players with 9 columns in 600px of vertical space without scrolling.
The current `SquadRosterView` already achieves this — keep that density,
extend it everywhere.

### 2.4 Component aesthetic

#### Corners — sharp, not rounded
- **Cards:** 4px (`rounded-gaffer`, custom utility). Currently 12px
  (`rounded-xl`) — too soft, reads as iOS.
- **Buttons:** 2px (`rounded-sm`). Currently 8px (`rounded-lg`).
- **Badges:** 2px. Currently 6px.
- **Avatars / team logos:** keep `rounded-full` (circular) — these are
  portraits, not chips.
- **Modals:** 6px. Slightly softer than cards to signal "elevated surface".

#### Borders — hairlines, always
- 1px solid `pitch-100` (light) / `pitch-700` (dark) for all card borders and
  dividers. Currently mixed: some `border-gray-200`, some `border-navy-600`,
  some `border-gray-100`.
- No 2px or 4px borders except for the tier-1 accent stripe (4px top, brass)
  and the active-tab indicator (2px bottom, brass).
- Drop the existing `border-t-4` accent pattern on all `Card` variants — it
  reads as "Stripe card component". Reserve the 4px accent stripe exclusively
  for tier-2 lead cards.

#### Surfaces — matte, never glass
- Kill every `bg-linear-to-r` gradient on buttons. The current
  `bg-linear-to-r from-primary-500 to-primary-600` for the active sidebar item
  and the Continue button reads as 2018 Stripe. Replace with **flat**
  `bg-pitch-500` (active sidebar) and `bg-brass-400` (primary action).
- Keep the two existing gradient surfaces that *work*: the
  `from-navy-700 to-navy-800` hero band on `PlayerProfileHeroCard`, and the
  floodlit header on `MatchLive`. Re-tune both to `from-pitch-700 to-pitch-900`
  and `from-pitch-900 via-pitch-800 to-pitch-900` respectively.
- No glassmorphism. No `backdrop-blur`. No `bg-white/5`. If you need a
  translucent overlay, use a 90% opaque flat surface.

#### Shadows — only on elevated layers
- Cards: no shadow. Border only.
- Dropdowns, popovers, context menus: `shadow-md` is fine.
- Modals: `shadow-2xl` is fine.
- The masthead: a single `shadow-sm` to lift it 1px off the workspace.

#### The Gaffer card signature
A Gaffer card should be identifiable at a glance from an FM card. The
difference:

| Element | FM card | Gaffer card |
|---|---|---|
| Corners | 8–16px rounded | 4px |
| Border | None (shadow only) | 1px hairline, always |
| Background | Pure white / pure dark | Cream `#F2EEE3` (light) or `pitch-900` (dark) |
| Title font | Same as body | Barlow Condensed uppercase |
| Accent | Club-color stripe (variable) | Brass stripe (consistent), 4px top, only on lead cards |
| Numerals | Same as body | IBM Plex Mono, tabular-nums |
| Metadata icons | Colorful lucide icons | Single-color, `concrete` gray, 14px |
| Padding | Generous (24–32px) | Tight (12–16px) |
| Hover state | Lift + shadow | Hairline border shifts to `brass-400` |

### 2.5 Three signature screens

#### A. The Squad screen (player overview)

**Visual concept: "the gaffer's clipboard".**

```
┌─────────────────────────────────────────────────────────────────────┐
│ MASTHEAD (floodlight cream, 80px)                                   │
│  SQUAD                                                              │
│  Twenty-five names. Pick eleven.                                    │
│  ─────────────────────────────────────────────────────────────────  │
│  Sat 14 Sep · Next: vs Hartlepool (H) · Avg age 24.3 · Wage £1.2M/wk│
├─────────────────────────────────────────────────────────────────────┤
│ UTILITY BAR (40px, pitch-900)                                       │
│  [search] [filter: All▼] [sort: OVR▼]              [Save] [Continue▼]│
├──────────────────────────┬──────────────────────────────────────────┤
│ LEAD — Squad table       │ COLUMNS                                  │
│ (8 cols, 12 rows visible)│ ┌────────────────┐ ┌────────────────────┐│
│ ┌──────────────────────┐ │ │ Role coverage  │ │ Injured & suspended││
│ │ #  Pos Name      OVR│ │ │ GK 1/1         │ │ ● Smith (hamstring)││
│ │ 1  GK  Henderson   78│ │ │ DEF 4/4        │ │   3 weeks          ││
│ │ 2  RB  Walker      74│ │ │ MID 4/4  ⚠      │ │ ● Jones (calf)     ││
│ │ ...                  │ │ │ FWD 2/2  ⚠      │ │   1 week           ││
│ │ (hairline rows,      │ │ └────────────────┘ └────────────────────┘│
│ │  mono numerals,      │ │ ┌────────────────┐ ┌────────────────────┐│
│ │  brass hover)        │ │ │ Stability mix  │ │ Contract risk      ││
│ └──────────────────────┘ │ │ Mr Reliable  8 │ │ 2 expiring 2026    ││
│                          │ │ Steady Hand 12 │ │ 1 critical         ││
│                          │ │ Roll of Dice 1 │ │                    ││
│                          │ └────────────────┘ └────────────────────┘│
└──────────────────────────┴──────────────────────────────────────────┘
```

Key moves:
- The table is the lead, takes 60% width, fills vertical space.
- Squad-wide **stability mix** card on the right (new) — a tiny bar chart
  showing how many of the 25 players fall into each of the 5 stability tiers.
  This is the meaning-engine surfacing at squad level. Use horizontal bars in
  `brass-400`, no axis labels, just counts.
- The **role coverage** card keeps its existing badge design but re-tunes the
  danger color to `mahogany-500` and the success color to `pitch-500`.
- Hover on a row: 1px border shifts to `brass-400`, no lift, no shadow.
- Selected row (when comparing players): 2px left border in `brass-400`,
  background shifts to `pitch-50` / `pitch-800`.
- Click anywhere on a row → opens player detail in a right-side drawer
  (currently navigates to a full Player Profile screen — consider both flows).

#### B. The Player Detail screen (meaning snapshot)

**Visual concept: "the scouting dossier".**

```
┌─────────────────────────────────────────────────────────────────────┐
│ MASTHEAD                                                            │
│  ← BACK   JAMIE VARDIE — #9                                         │
│  Roll of the Dice. 38 years old. Still terrifying.                  │
│  ─────────────────────────────────────────────────────────────────  │
├─────────────────────────────────────────────────────────────────────┤
│ HERO (pitch-700 → pitch-900 gradient, 200px)                        │
│  [Avatar 96px, brass border] [Jersey]                               │
│  Jamie Vardie                                            OVR 74     │
│  [ST] [LW] 🏴󠁧󠁢󠁥󠁮󠁧󠁿 England · Age 38 · Right foot · Weak 3/5         │
│  Traits: Determined · Big-game temperament · Aging                  │
│  ┌──────────┬──────────┬──────────┬──────────┐                      │
│  │ CONDITION│ MORALE   │ VALUE    │ WAGE     │                      │
│  │ 82%      │ 91%      │ £4.5M    │ £85k/wk  │                      │
│  └──────────┴──────────┴──────────┴──────────┘                      │
├──────────────────────────────────┬──────────────────────────────────┤
│ MEANING (left, 60%)              │ SPREADSHEET (right, 40%)         │
│ ┌──────────────────────────────┐ │ ┌──────────────────────────────┐ │
│ │ STABILITY                    │ │ │ THE BODY       avg 71        │ │
│ │ Roll of the Dice             │ │ │  Pace        ████████░░ 78   │ │
│ │ "On his day, unplayable.     │ │ │  Burst       ███████░░░ 71   │ │
│ │ Off it, a passenger."        │ │ │  Engine      █████░░░░░ 52   │ │
│ │                              │ │ │  Power       ███████░░░ 74   │ │
│ │ ▸ Why? (3 reasons)           │ │ │  Agility     ██████░░░░ 64   │ │
│ └──────────────────────────────┘ │ ├──────────────────────────────┤ │
│ ┌──────────────────────────────┐ │ │ THE BALL       avg 73        │ │
│ │ FORM     CONFIDENCE  FATIGUE │ │ │  Passing      ████████░░ 76  │ │
│ │ Hot      Sky-high    Heavy   │ │ │  Distribution ███████░░░ 71  │ │
│ └──────────────────────────────┘ │ │  Touch        ████████░░ 78  │ │
│ ┌──────────────────────────────┐ │ │  Finishing    █████████░ 88  │ │
│ │ PRESSURE RESPONSE            │ │ │  Defending    ███░░░░░░░ 31  │ │
│ │ Thrives under pressure       │ │ │  Aerial       ██████░░░░ 62  │ │
│ │ ▸ Why?                       │ │ ├──────────────────────────────┤ │
│ └──────────────────────────────┘ │ │ THE HEAD       avg 68        │ │
│ ┌──────────────────────────────┐ │ │  (5 attrs...)                │ │
│ │ RELATIONSHIPS                │ │ ├──────────────────────────────┤ │
│ │ ★ Closest ally: Maddison     │ │ │ THE GLOVES     avg 12        │ │
│ │ ⚠ Tension with: Tielemans    │ │ │  (GK-only, dimmed)           │ │
│ │ ◆ Chemistry: +14             │ │ └──────────────────────────────┘ │
│ └──────────────────────────────┘ │                                  │
│ ┌──────────────────────────────┐ │                                  │
│ │ SCOUT'S NOTE (serif italic)  │ │                                  │
│ │ "Still the best finisher at  │ │                                  │
│ │ the club on his day. Legs are│ │                                  │
│ │ going though — manage his    │ │                                  │
│ │ minutes carefully."          │ │                                  │
│ │              — Chief Scout   │ │                                  │
│ └──────────────────────────────┘ │                                  │
└──────────────────────────────────┴──────────────────────────────────┘
```

Key moves:
- The **stability label** ("Roll of the Dice") is the visual hero of the left
  column — bigger than the player name's position, in Barlow Condensed
  display weight, with a one-sentence Gaffer-voice description in Source Serif
  italic underneath. This is the meaning-engine's front door.
- The **scout's note** at the bottom-left is the only serif block on the
  screen — it should feel like a handwritten margin note in a real scouting
  dossier. Floodlight cream background, 1px brass border, 16px padding, Source
  Serif 4 italic at 15px.
- The **spreadsheet panel** on the right is the existing "Advanced View" from
  `PlayerMeaningCard`, but always-visible (not behind a toggle) and rebuilt
  with IBM Plex Mono numerals. Each group (Body/Ball/Head/Gloves) gets its own
  sub-card with a group-average. The Gloves group is dimmed to 40% opacity
  for outfield players (and vice versa for goalkeepers) — communicates "this
  exists but doesn't apply" without hiding it.
- The **persona strip** (Form / Confidence / Fatigue) uses Gaffer-voice labels
  ("Hot", "Sky-high", "Heavy") instead of percentages or numbers. The
  underlying numbers are available on hover via a tooltip.
- The **relationships** panel uses the same ★ ⚠ ◆ ● markers as today, but
  standardized: ★ brass, ⚠ mahogany, ◆ concrete, ● pitch-500. No emoji.

#### C. The Match Day screen (live match or pre-match)

**Visual concept: "the dugout at 7:45pm, five minutes before kickoff".**

```
┌─────────────────────────────────────────────────────────────────────┐
│ FLOODLIT HEADER (pitch-900 → pitch-700 → pitch-900, 120px)          │
│                                                                     │
│        HARTLEPOOL UNITED          0 — 0          BARROW AFC          │
│        4-4-2                    23'              4-3-3               │
│        [logo]     ●LIVE     [logo]                                   │
│                                                                     │
│  Possession  ████████████░░░░░░░░░  58% — 42%                       │
├─────────────────────────────────────────┬───────────────────────────┤
│ COMMENTARY (serif, 50%)                 │ DUGOUT (50%)              │
│ ┌─────────────────────────────────────┐ │ ┌───────────────────────┐ │
│ │ 23'  Chance for Barrow! Vardie gets │ │ │ SPEED                 │ │
│ │      on the end of a cross but      │ │ │ [▶▶] [▶▶▶] [▶▶▶▶]    │ │
│ │      headers wide of the post.      │ │ │ paused | step 1 min   │ │
│ │                                     │ │ ├───────────────────────┤ │
│ │ 21'  Yellow card — Smith (HAR)      │ │ │ TEAM TALK             │ │
│ │      for a late challenge on        │ │ │ "Right, lads..."      │ │
│ │      Maddison.                      │ │ │ [Demand more]         │ │
│ │                                     │ │ │ [Settle down]         │ │
│ │ 18'  GOAL disallowed. Vardie offside│ │ │ [Praise]              │ │
│ │      by a yard. Let off for         │ │ ├───────────────────────┤ │
│ │      Hartlepool.                    │ │ │ SUBS  0/5             │ │
│ └─────────────────────────────────────┘ │ │ [Make a change]       │ │
│ ┌─────────────────────────────────────┐ │ ├───────────────────────┤ │
│ │ KEY EVENTS                          │ │ │ TACTICS               │ │
│ │ 23'  ⚠ Smith yellow                 │ │ │ 4-4-2  ▾              │ │
│ │ 18'  ⚡ Vardie goal (offside)        │ │ │ Balanced  ▾           │ │
│ │ 12'  ⚡ Maddison shot saved          │ │ └───────────────────────┘ │
│ └─────────────────────────────────────┘ │                           │
├─────────────────────────────────────────┴───────────────────────────┤
│ STATS STRIP (40px, pitch-900, mono numerals)                        │
│  Shots 5 — 3   Possession 58% — 42%   Passes 124 — 89   xG 0.8 — 0.4│
└─────────────────────────────────────────────────────────────────────┘
```

Key moves:
- The **commentary feed** switches from the current sans-serif events list to
  a **Source Serif 4 italic** column — this is the broadcast voice, and per
  CONFLICTS.md #8 it's text-only forever, so it should *look* like a
  typewritten match report, not a chat log. Minute markers in IBM Plex Mono.
  Event-type glyphs (⚡ shot, ⚠ card, ⚽ goal, ⏱ sub) in 14px, single-color.
- The **scoreboard** stays 4xl but uses IBM Plex Mono for the numbers (the
  current `tabular-nums` Inter works but Plex Mono is more characterful).
- The **dugout panel** on the right replaces the current 5-button speed
  cluster with a 3-step cluster (Slow / Normal / Fast) plus a separate
  "paused / step 1 min" affordance. Five speeds was overkill — three is
  enough.
- A **Team Talk** module appears in the dugout panel (currently exists as a
  separate modal — promote it to inline). The team-talk phrases ("Right,
  lads...") are Gaffer-voice and should be visible by default.
- The **stats strip** at the bottom is a permanent 40px monospaced ribbon —
  always visible, always updating. Currently stats live behind a tab. The
  ribbon treatment borrows from broadcast TV bottom-lines (ESPN, Sky Sports
  News) but in the Gaffer palette, not red and yellow.
- The **floodlit gradient** on the header is the one place a gradient is
  allowed — it should suggest sodium floodlight bloom, not a Stripe button.
  `from-pitch-900 via-pitch-700 to-pitch-900` with a subtle
  `radial-gradient` vignette in the corners.

### 2.6 Data visualization style

The 19 attributes, Big Five personality, SquadPulse harmony, stability tier,
and chemistry score each need a distinct visual treatment. Currently the app
uses Recharts radars everywhere — that's fine for 5-axis Big Five but wrong
for 19-attribute profiles.

#### 19 Gaffer attributes — **4-quadrant hex cluster** (not radar)
A radar with 19 axes is illegible. Instead:

```
        THE BODY              THE BALL
        ┌─────────┐          ┌─────────┐
        │ Pace 78 │          │ Pass 76 │
        │ Burs 71 │          │ Dist 71 │
        │ Engi 52 │          │ Touc 78 │
        │ Powr 74 │          │ Fini 88 │
        │ Agil 64 │          │ Defn 31 │
        │         │          │ Aeri 62 │
        │  avg 71 │          │  avg 73 │
        └─────────┘          └─────────┘

        THE HEAD              THE GLOVES
        ┌─────────┐          ┌─────────┐
        │ Anti 81 │          │ Shot 12 │
        │ Visi 76 │          │ Comm 08 │
        │ Deci 79 │          │ Play 05 │
        │ Comp 88 │          │         │
        │ Lead 64 │          │  avg 08 │
        │         │          │  (dim)  │
        │  avg 78 │          │         │
        └─────────┘          └─────────┘
```

- Each quadrant is a small card (120×140px) with the group name as a
  Barlow Condensed micro-cap header, the 5 (or 3, or 6) attribute labels in
  Inter 12px + Plex Mono numerals, and a single 2px-wide vertical bar on the
  right edge showing the group average in brass.
- The inactive group (Gloves for outfielders, Body/Ball subset for GKs) is
  dimmed to 35% opacity — visible but clearly secondary.
- Hover any attribute → expands to show a 100px-wide horizontal sparkline of
  its trend over the last 12 months (data already exists in
  `PlayerRatingTrendChart`).
- Color coding per attribute: no traffic-light coloring by value (the current
  `auto` variant on ProgressBar does this — it's noisy). Instead, use a single
  brass fill on all bars. The eye should compare lengths, not colors.

#### Big Five personality — **pentagon radar** (5 axes works on radar)
Keep Recharts `<RadarChart>`. 5 axes is the upper bound where radars stay
legible. Use:
- `PolarGrid` stroke in `concrete`.
- `PolarAngleAxis` labels in Barlow Condensed 11px uppercase.
- `Radar` fill in `brass-400` at 0.3 opacity, stroke in `brass-500` at 2px.
- A second `Radar` for the *league-average* personality at the same position,
  in `pitch-300` at 0.15 opacity — gives the user a comparison baseline.
- The confidence score (0–100) appears as a single brass ring around the
  radar's outer edge, thicker = higher confidence. This is the meaning-engine
  surfacing "how sure are we about this read".

#### SquadPulse harmony — **EKG-style horizontal strip**
A squad-wide "harmony" score deserves a unique visualization, not another bar.
Concept: a horizontal EKG-style waveform that pulses with team morale events.
- X-axis: last 90 days.
- Y-axis: harmony score 0–100, but the line oscillates around the current
  value (60) with amplitude proportional to squad morale variance.
- Wins push the line up sharply; losses push it down; injuries create small
  dips; transfers create large dips.
- Line color: `pitch-500` when above 50, `mahogany-500` when below.
- Background: faint horizontal band at 50 = "neutral".
- Use Recharts `<LineChart>` with a single series and a custom SVG path for
  the EKG jitter.

This is the signature visual of the Home tab — it should be the first thing
the user sees and the thing they check before every match.

#### Stability tier — **5-step horizontal bar, no number**
The stability modifier is hidden 0–100 with 5-tier labels (per CONFLICTS.md
#5). Surface it as:

```
  Roll of the Dice  Runs Hot & Cold  Steady Hand  Trusted Lieutenant  Mr. Reliable
  ▓▓░░░░░░░░        ▓▓▓▓░░░░░░       ▓▓▓▓▓▓░░░    ▓▓▓▓▓▓▓▓░░          ▓▓▓▓▓▓▓▓▓▓
       ●
  (current tier marked with a brass dot below)
```

- Five segments, each a horizontal bar of equal length.
- The current tier fills its segment in `brass-400`; others are
  `concrete` at 30% opacity.
- A single brass dot beneath marks the current tier.
- **No number ever shown.** Per the design intent: the Gaffer doesn't think in
  numbers, he thinks in labels.
- The hover tooltip can reveal the underlying 0–100 value for power users.

#### Chemistry & relationships — **force-directed mini-graph**
Currently shown as a list ("Closest ally: Maddison", "Tension with:
Tielemans"). Upgrade to a tiny force-directed graph (~150×150px):
- Nodes = the player + 4 closest allies (brass) + 2 tensions (mahogany).
- Edges weighted by chemistry score.
- Background: faint pitch markings (center circle, halfway line) at 10%
  opacity — subtle visual cue that this is about on-pitch chemistry.
- This is the most ambitious of the proposed viz; can ship as the existing
  list first and upgrade later.

#### Position-radar / attribute radar on Player Profile — keep, but restyle
The existing `PlayerAttributeRadarChart` picks 8 attributes for a radar. Keep
it, but:
- Switch fill to brass (currently pitch/emerald).
- Add the league-average comparison radar in `pitch-300` at 0.15 opacity.
- Increase tooltip readability: monospace numerals, cream background.

### 2.7 Sound + motion

#### Motion — restrained, "office" mood
The Gaffer's office is quiet. Motion should feel like paper shuffling and a
desk lamp, not like a video game.

**Allow:**
- **Staggered digest reveal** (already exists in `App.css` as
  `fade-slide-in`, 220ms). Keep it. Extend to inbox messages and news feed.
- **Tab transitions**: 150ms cross-fade between dashboard tabs. Currently
  instant.
- **Modal entry**: 180ms scale + fade (currently appears instantly). Use
  `cubic-bezier(0.16, 1, 0.3, 1)` ease-out.
- **Match event entry**: when a new event arrives in the live-match feed,
  slide it in from the top with a 120ms duration and a 1px brass underline
  that fades over 800ms (suggests a typewriter carriage return).
- **Score change**: on goal, the score number scales 1.0 → 1.15 → 1.0 over
  240ms in brass, then settles back to chalk. This is the *one* celebratory
  animation in the app.
- **SquadPulse update**: when squad harmony changes, the EKG line redraws
  with a 600ms ease — the past recedes, the present sharpens.

**Forbid:**
- No bouncing, no spring physics, no parallax.
- No `animate-pulse` on live indicators (currently used on the red live dot —
  replace with a slower `animate-ping` at 1.5s, or just a steady red dot —
  pulsing reads as "notification" not "broadcast").
- No skeleton loaders with shimmer. Use the existing spinner.
- No hover-lift on cards. Cards don't move; only their borders change color.
- No page-transition loaders with progress bars. The existing spinner is fine.

#### Sound — none, by design
Per CONFLICTS.md #8 (voice acting: "no, permanently, text-only"), the app is
silent. Do not add UI sounds (no click beeps, no goal celebrations, no
whistle). The *typography* of the commentary feed is the audio. If a future
release adds optional ambient sound (crowd murmur on match day), it should be
off by default and toggled in Settings.

### 2.8 Migration — concrete code changes

To move from current state to the proposed direction without a rewrite:

1. **`src/App.css`** — replace the `@theme` color block:
   - Rename `primary-*` ramp → `pitch-*` with the new hex values.
   - Rename `accent-*` ramp → `brass-*` with the new hex values.
   - Rename `navy-*` ramp → keep as `navy-*` (still useful for the darkest
     surfaces) but add `pitch-900` `#0E1410` as the new default dark bg.
   - Add `--color-mahogany-*`, `--color-cream`, `--color-chalk`,
     `--color-concrete`, `--color-ink`, `--color-floodlight`.
   - Add `--font-serif: "Source Serif 4", "Georgia", serif;`
   - Add `--font-mono: "IBM Plex Mono", "SF Mono", monospace;`
   - Add a `.rounded-gaffer { border-radius: 4px; }` utility.

2. **`package.json`** — add two dependencies:
   - `@fontsource/source-serif-4`
   - `@fontsource/ibm-plex-mono`

3. **`src/components/ui/Card.tsx`** — change `rounded-xl` → `rounded-gaffer`,
   drop `shadow-sm` (border only), tighten `CardBody` padding from `p-6` →
   `p-4`. Keep the `accent` prop but only apply the 4px top stripe when
   `accent !== "none"` (currently applies a full border + stripe — too much).

4. **`src/components/ui/Button.tsx`** — replace `bg-linear-to-r
   from-primary-500 to-primary-600` with flat `bg-pitch-500 hover:bg-pitch-600`.
   Drop the gradient from every button variant.

5. **`src/components/dashboard/DashboardSidebar.tsx`** — replace the
   `bg-linear-to-r from-primary-500 to-primary-600` active-nav pill with flat
   `bg-pitch-500 text-chalk`. Re-tune the sidebar background from
   `bg-navy-800` to `bg-pitch-900`.

6. **`src/components/dashboard/DashboardHeader.tsx`** — split into two layers:
   a `Masthead` (cream or pitch-900, 80px, screen title in Barlow Condensed
   display weight + Gaffer-voice subhead) and a `UtilityBar` (40px, search +
   save + continue). This is the biggest single refactor.

7. **`src/components/ui/PlayerMeaningCard.tsx`** — apply the Player Detail
   layout from §2.5.B. Switch player name from `text-xl font-bold` Inter to
   `text-display` Barlow Condensed. Switch the scout's-note block (new) to
   Source Serif 4 italic. Switch all numerals to IBM Plex Mono.

8. **`src/components/squad/SquadRosterView.tsx`** — add `font-mono tabular-nums`
   to every numeric cell (`#`, age, condition, morale, OVR). Replace
   `border-l-red-500` / `border-l-amber-400` injury markers with
   `border-l-mahogany-500` / `border-l-brass-400`. Tighten row padding from
   `py-2.5 px-4` to `py-2 px-3` to fit 12 rows in 600px.

9. **`src/components/match/MatchLive.tsx`** — switch the commentary feed to
   Source Serif 4 italic. Reduce the 5-speed cluster to 3. Move match stats
   from a tab to a permanent 40px bottom strip. Re-tune the header gradient
   to `from-pitch-900 via-pitch-700 to-pitch-900`.

10. **`src/components/ui/charts/chartTheme.ts`** — update the dark theme
    `primary` to `#2D5A3D` (pitch-500), `secondary` to `#B8924A` (brass-400),
    `danger` to `#7A2E1F` (mahogany-500), `success` to `#2D5A3D`. Update
    `tooltipBg` to `#0E1410` (pitch-900). Keep the light theme but re-tune
    similarly.

11. **New file: `src/components/ui/Masthead.tsx`** — a reusable masthead
    component taking `title`, `subhead`, and `context` props. Used at the top
    of every tab.

12. **New file: `src/components/ui/AttributeHexCluster.tsx`** — the 4-quadrant
    attribute visualization from §2.6, replacing the inline attribute list in
    `PlayerMeaningCard`'s Advanced View.

13. **New file: `src/components/ui/SquadPulse.tsx`** — the EKG-style harmony
    strip from §2.6, for the Home tab. Uses the existing `squadSnapshot`
    data from `meaningStore`.

14. **i18n tone pass** — open `src/i18n/locales/en.json` and rewrite the ~80%
    formal-SaaS strings in Gaffer voice. Examples:
    - `"training.staffAdvice.ok"`: "Squad fitness is high. You could switch to
      Balanced or Intense for more development." → **"They're flying. Could
      push harder if you've got the depth."**
    - `"squad.coverageStable"`: "Coverage looks healthy" → **"Covered, top to
      bottom."**
    - `"worldSelect.scanning"`: "Scanning for databases..." → **"Looking for
      worlds..."**
    - `"menu.loadingSaves"`: "Loading saves..." → **"Pulling your saves..."**

    Keep it mild, not Raw. Per CONFLICTS.md #4, Raw is occasional (<1%) and
    reserved for high-emotion moments (firing, relegation, derby loss).

15. **Add a `docs/gaffer/VOICE_GUIDE.md`** — a one-page voice guide so future
    contributors (and AI agents) write strings in the same register. Should
    include: the 5 stability labels, the 4 attribute groups, a do/don't list
    with 10 examples, and the rule "if a string could appear in Slack, rewrite
    it".

### 2.9 What to ship first

If only three of the above changes can ship in the next iteration, ship:

1. **The palette re-tune** (§2.1 + migration step 1 + 10). Highest visual
   impact per line of code. Touches every screen. ~2 hours.
2. **The masthead split** (§2.3 + migration step 6 + 11). Fixes the
   information-hierarchy problem on every tab. ~4 hours.
3. **IBM Plex Mono on all numerals** (§2.2 + migration steps 7, 8). The
   single highest-impact typography change — every table instantly reads as
   "manager's spreadsheet" instead of "web app". ~2 hours.

The signature screens (§2.5) and the bespoke data viz (§2.6) are the
ambitious work — schedule them per-tab over the next 4–6 weeks, starting with
the Player Detail screen (it's where the meaning-engine lives) and the Match
Day screen (it's the emotional peak).

---

## Appendix A — Current component visual style, summary table

| Component | Density | Style | Voice | Verdict |
|---|---|---|---|---|
| `DashboardSidebar` | Medium | Navy gradient pill active state | SaaS | Re-tune active pill to flat pitch-500 |
| `DashboardHeader` | Medium | Sticky white/navy bar, inline everything | SaaS | Split into Masthead + UtilityBar |
| `Card` | Low | 12px rounded, 1px border, shadow-sm, optional 4px top stripe | SaaS | Tighten to 4px corners, drop shadow |
| `Badge` | Low | 6px rounded, uppercase Barlow | OK | Tighten to 2px corners, re-tune colors |
| `ProgressBar` | Low | Auto-variant traffic-light coloring | SaaS | Drop auto-color, single brass fill |
| `PlayerMeaningCard` | High | Dense, 2×2 grids, collapsible advanced view | Gaffer-voice labels, SaaS layout | Restructure per §2.5.B |
| `TrainingTab` | High | 3-col grid, color-coded advice banner | Mixed | Re-tune colors, keep layout |
| `SquadRosterView` | Very high | Wide sortable table, colored left borders | SaaS | Re-tune colors, add mono numerals |
| `PlayerProfileHeroCard` | Medium | Navy gradient hero band, OVR-tiered avatar | Mixed | Best current card — use as reference |
| `MatchLive` | High | Floodlit gradient header, 3-tab panel, 5-speed cluster | SaaS | Restructure per §2.5.C |
| `PlayerAttributeRadarChart` | Medium | Recharts radar, emerald fill | SaaS | Re-tune to brass, add comparison radar |

## Appendix B — Existing assets inventory

| Path | Type | Count | Status |
|---|---|---|---|
| `/public/*.svg` | Brand icons | 4 | Production-ready |
| `/public/openfootmanager_icon.png` | App icon | 1 | Production-ready |
| `/src/assets/react.svg` | Vite template | 1 | Delete (unused) |
| `/src-tauri/icons/*` | Tauri app icons | ~30 | Production-ready |
| `/src-tauri/assets/portrait-sources/chroma-*.webp` | Player portrait backdrops | 12 | Production-ready, diverse |
| `/images/screenshots/*.png` | README screenshots | 7 | Stale (pre-meaning-engine) |
| `/images/openfoot*.{svg,png}` | README brand assets | 8 | Production-ready |

**Missing assets to commission (if needed):**
- A "Gaffer" wordmark / logotype in Barlow Condensed (for the masthead).
- A 16×16 favicon variant in the new palette.
- Optional: a single 1920×1080 moodboard image for the README — floodlit
  lower-league ground at dusk, brass trophy in foreground, dugout in middle
  distance. Use as the visual north star for contributors.

---

*End of document. Length: ~870 lines. Last updated: 2025.*
