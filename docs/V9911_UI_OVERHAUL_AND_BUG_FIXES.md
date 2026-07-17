# V99.11 Master Plan — UI Overhaul and Bug Fixes

**Created:** 2026-07-17
**Base commit:** `e2d8533`
**Source:** Comprehensive codebase audit + Gaffer UI Spec analysis + 10-season simulation report findings.

---

## PART A: Remaining Backend Items (6 items)

### A1: Item 17 Fix — `league_tables_for_season` returns wrong data
**File:** `domain/src/world_history.rs:195`
**Problem:** Returns ALL tables, not filtered by season.
**Fix:** Change to return a filtered Vec.
**Effort:** S

### A2: Item 18 — Milestone news (100th appearance, 50th goal, debut goal)
**Files:** `domain/src/news.rs`, `ofm_core/src/news.rs`, `turn/post_match.rs`
**Approach:** Add `NewsCategory::PlayerMilestone`. In `apply_player_stats`, snapshot pre-match career totals before incrementing. Check thresholds (1, 25, 50, 100, 200). Enqueue `NewsArticle` with dedup ID.
**Effort:** M

### A3: Item 19 — Comeback/shock news
**Files:** `ofm_core/src/news/match_report.rs`
**Approach:** Add `detect_narrative()` — iterate `report.goals` chronologically, track running goal-diff. If eventual winner was ≥2 behind → comeback. For Cup fixtures, look up pyramid tiers — if winner's tier > loser's tier → giant-killing.
**Effort:** M

### A4: Item 21 — Career-threatening injuries
**Files:** `domain/src/player.rs`, `db/src/sql/v045_*.sql`, `db/src/migrations.rs`, `player_wear.rs`, `turn/mod.rs`
**Approach:** Add `injury_history: Vec<String>` + `chronic_injury_count: u8` to Player. New DB migration. Expand injury pool with 4 severe injuries (ACL, broken leg, Achilles, knee cartilage). 0.05% chance → 150-270 days + permanent attribute penalty on recovery.
**Effort:** L

### A5: Item 26 — Youth facility
**Files:** `domain/src/team.rs`, `ofm_core/src/club.rs`, `commands/club.rs`, `regen/mod.rs`, `FinancesTab.tsx`
**Approach:** Add `Youth` variant to `FacilityType` + `youth: u8` to `Facilities`. Wire into `regen/mod.rs` academy quality bias. Update FinancesTab UI.
**Effort:** M

### A6: UI-8 + UI-10 — Card consolidation + `.gaffer-surface` utility
**Files:** `src/App.css`, `src/components/ui/Card.tsx`
**Approach:** Delete unused `.gaffer-card` class. Create `.gaffer-surface` utility for recurring surface pattern. Update Card.tsx.
**Effort:** S

---

## PART B: Full UI Restyle (per Gaffer UI Spec)

### Phase B1: Foundation — Design Tokens
**File:** `src/App.css`

Replace existing `@theme` tokens with the UI Spec's palette:
- `--carbon-0:#0f1216` (app bg) → replaces `--color-pitch-black`
- `--carbon-1:#161b21` (card/sidebar bg) → replaces `--color-navy-700`
- `--carbon-2:#1c222a` (recessed) → replaces `--color-navy-800`
- `--carbon-3:#232b34` (hover/active) → new
- `--slate-line:#333e4a` (borders) → replaces `--color-navy-600`
- `--slate-line-soft:#2a323c` (dividers) → new
- `--ink:#e9e6dd` (primary text) → replaces `--color-chalk`
- `--ink-dim:#9aa4b2` (secondary text) → replaces `--color-concrete`
- `--ink-faint:#5f6b7a` (tertiary text) → new
- `--brass:#c6a15b` → replaces `--color-accent-500`
- `--brass-bright:#e0bd7c` → replaces `--color-accent-400`
- `--brass-dim:#8a744a` → replaces `--color-accent-600`
- `--green:#5c9a6d` → replaces `--color-primary-500`
- `--red:#b5544a` → replaces `--color-danger-500`
- `--radius:3px` → standardize everywhere

Add spec body background (§8.1 pitch-mow pattern).
Add signature motifs: `.brass-marker`, `.hero-panel` (corner brackets), `.dossier-panel`.
Remove light mode — always dark.
Swap fonts: Barlow Condensed → Oswald, IBM Plex Mono → JetBrains Mono.
Remove conflicting texture classes (keep only dossier + tactics board).

### Phase B2: Chrome — Sidebar + Top Bar
**Files:** `DashboardSidebar.tsx`, `DashboardHeader.tsx`

Sidebar: 208px width, carbon gradient bg, brass left-border active state, brass-marker section labels.
Top bar: 52px fixed height, stat blocks (matchday/position/budget/morale), brass bottom border, next-fixture chip.

### Phase B3: Card Component
**File:** `Card.tsx`

Always `--carbon-1` bg, `--slate-line` border, 3px radius, spec shadow. CardHeader gets brass-marker. CardBody padding 14px. Remove default texture (opt-in via `.dossier-panel`).

### Phase B4: Per-Screen Restyle (16 screens)
Each screen: 12-column grid, token migration, brass markers, table styling, empty states, mono numerics, Gaffer interpretation layer.

Priority order: Dashboard → Squad → Schedule → Tactics (dedicated §9 layout) → Tournaments → Transfers → Scouting → Finances → News → Staff → Youth → Manager → Teams → Players → Inbox → Match screens.

Tactics: Do NOT touch formation/drag-drop/click-assignment logic. Only restyle pitch/tokens/rails.

### Phase B5: Color Token Migration (global)
Replace 1,746 `text-gray-*`/`bg-gray-*` with spec tokens across 187 files.

### Phase B6: GafferIcons Expansion
Add 9 new football-specific icons to replace remaining lucide-react in sidebar/header.

---

## Guardrails
1. Do NOT touch tactics logic — only restyle containers/visuals.
2. Do NOT remove the Gaffer interpretation layer — raw numbers must pass through `interpretXxx()`.
3. Do NOT introduce light mode — spec forbids it.
4. Do NOT use gradients other than specified.
5. Work one screen at a time — verify function after each.
6. Test: `npx tsc --noEmit` after each phase.

## Estimated Effort
- Part A (backend): ~2 days
- Part B (UI): ~3 days
- Total: ~5 days
