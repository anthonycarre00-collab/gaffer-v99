# Gaffer V99.5 — Full Forensic Codebase Analysis

**Date:** 2026-07-13
**Commit analysed:** `6bea494` (origin/main)
**Analyst:** Z (AI assistant)
**Mode:** ANALYSIS ONLY — no code changes

---

## 0. Executive Summary

The Gaffer codebase is a Tauri 2 + React 19 + TypeScript desktop football manager game with a 6-crate Rust workspace (`domain`, `engine`, `ofm_core`, `db`, `sim-bench`, `ofm-cli`) and a comprehensive React frontend. The architecture is sound — clean separation of concerns, strong type safety, extensive test coverage, and a well-organised daily turn loop.

**However**, the forensic analysis reveals three systemic problem classes:

1. **V99.4 feature persistence gap (CRITICAL):** The domain types were extended with new fields (player fame, release clauses, career events, partnerships, transfer requests, manager personality, team board type), and the `ofm_core` logic consumes them — but **the `db` repositories were never updated to round-trip them**. Every save/reload silently resets these fields to defaults. This means V99.4 features work within a session but break after saving and loading.

2. **Match engine path divergence (HIGH):** The full-engine path (`engine/resolution.rs`) and the live-match path (`engine/live_match/zone_resolution.rs`) have diverged on `tactics_multiplier` and `partnership_bonus`. The live path — the user's primary play mode — ignores both, producing asymmetric results between watching a match live and delegating it.

3. **Frontend polish debt (MEDIUM):** Broken Tailwind class fragments in 8 files, invisible Continue button on light theme, hardcoded English strings in dashboard modals, ~470 LOC of dead code (PackageBuildStep + GafferIcons), and whole-store subscriptions causing unnecessary re-renders.

The original V99.2 master plan's six interlocking issues have been **substantially addressed** in the V99.3–V99.4 sprint work (economy re-tune, transfer market unfreeze, world vitality, OVR formula fix, live-match modifiers, performance optimisations). The remaining issues are persistence wiring, engine path unification, and frontend polish.

---

## 1. Architecture Overview

### Rust Workspace (6 crates)

| Crate | Lines | Role |
|---|---|---|
| `domain` | ~3,500 | Pure data model (Player, Team, Manager, League, Fixture, etc.) — no logic |
| `engine` | ~5,000 | Match simulation: full 90-min engine + `sparse_sim` + live match stepper |
| `ofm_core` | ~35,000 | Game state, turn loop, transfers, contracts, AI, scheduling, regen, narrative |
| `db` | ~8,000 | SQLite persistence, 44 migrations, save manager, repositories |
| `sim-bench` | ~800 | Standalone CLI for benchmarking match engine |
| `ofm-cli` | ~50 | Bare CLI (not wired into Tauri) |

### Frontend Structure

| Area | Files | Lines | Notes |
|---|---|---|---|
| `src/pages/` | 7 | ~4,500 | MainMenu, TeamSelection, Dashboard, MatchSimulation, Settings, SimLab, WorldEditor |
| `src/components/` | ~150 | ~40,000 | UI primitives, menu, dashboard tabs, match, playerProfile, transfers, tactics, etc. |
| `src/hooks/` | 8 | ~700 | useAdvanceTime, useDigestAdvance, useFetchedSquad, useUndoRedo, etc. |
| `src/services/` | 14 | ~2,400 | Tauri invoke wrappers |
| `src/lib/` | ~30 | ~3,000 | Utility functions (gafferEngine, countries, valueFormatting, etc.) |
| `src/store/` | 4 | ~1,200 | zustand stores (gameStore, settingsStore, meaningStore, types) |
| `src/i18n/` | 15 | ~25,000 | 11 locale JSON files + index + tests |

### Tauri Commands

133 registered commands across 12 functional groups (game lifecycle, saves, slices, time, live match, squad/tactics, contracts, transfers/scouting, messages, finance, staff, season, stats, jobs, portraits, meaning, sim lab, package editor, press conference, settings).

---

## 2. Critical Issues — P0 (Data Loss)

### P0-1: V99.4 player fields not persisted

**File:** `src-tauri/crates/db/src/repositories/player_repo.rs:46-145`

The `INSERT INTO players` statement and `load_all_players` SELECT do NOT include:
- `release_clause: Option<u64>` (V99.4 T4.4)
- `transfer_request_date: Option<String>` (V99.4 T1.3)
- `low_morale_days: u32` (V99.4 T1.3)
- `career_events: Vec<CareerEvent>` (V99.4 T2.1)
- `partnerships: HashMap<String, u32>` (V99.4 T2.2)
- `fame: PlayerFame` (V99.4 T4.1)

`row_to_player` uses `..Default::default()` for trailing fields, so every save/reload resets these to defaults.

**Impact:** Career events accumulated over a season are erased on save. Partnerships that took a season to build vanish. Player fame resets to Unknown. Release clauses disappear. Transfer request counters reset.

**Fix:** Add a v045 migration with `ALTER TABLE players ADD COLUMN ...` for each field, and update `player_repo.rs` INSERT/SELECT to include them.

### P0-2: V99.4 manager personality not persisted

**File:** `src-tauri/crates/db/src/repositories/manager_repo.rs:8-37`

The `managers` table has 14 columns but no `personality_json`. On load, `..Default::default()` resets personality to `ManagerPersonality::default()` (Balanced/SquadBuilder/Reserved, all 50s).

**Impact:** AI manager personalities (V99.4 T1.7) are wiped on every save/reload. `tactics_effectiveness_multiplier()` returns 1.0 (neutral) for every AI manager after load.

**Fix:** Add `personality_json TEXT DEFAULT NULL` column to `managers` table (v045 migration), and read/write it in `manager_repo`.

### P0-3: V99.4 team board_type not persisted

**File:** `src-tauri/crates/db/src/repositories/team_repo.rs:252`

`load` constructs Team with `board_type: BoardType::default()` (Sensible). No `board_type` column in the table.

**Impact:** V99.4 T4.7 board types (SugarDaddy, PennyPinching, Ambitious) reset to Sensible on every save/reload.

**Fix:** Add `board_type TEXT NOT NULL DEFAULT 'Sensible'` column to `teams` table (v045 migration), and read/write in `team_repo`.

---

## 3. High-Severity Issues — P1 (Feature Breakage)

### P1-1: Live match path ignores `tactics_multiplier`

**File:** `src-tauri/crates/engine/src/live_match/zone_resolution.rs:130-135, 230-239`

The full engine path multiplies `att_mod`/`def_mod` by `ctx.team(att_side).tactics_multiplier` (manager tactical acumen). The live_match path's `resolve_midfield` and `resolve_attacking_third` do NOT.

**Impact:** V99.4 T1.7 (manager tactical acumen) has zero effect in live matches — the user's primary play mode.

**Fix:** Add `× att_team.tactics_multiplier` to the modifier chain in `zone_resolution.rs`.

### P1-2: Live match path doesn't set `partnership_bonus`

**File:** `src-tauri/crates/ofm_core/src/live_match_manager/team_builder.rs:475-513`

`to_engine_player()` constructs `PlayerData { ... ..Default::default() }`. The `..Default::default()` covers `partnership_bonus` which defaults to 0.0 (no bonus). The full-engine path's `build_engine_team` in `turn/mod.rs:658` calls `compute_partnership_bonus(p, team_id)` and sets it correctly.

**Impact:** V99.4 T2.2 (partnership goal boost) only works in CPU-simmed user matches (full engine), not in live matches. Asymmetric gameplay.

**Fix:** Set `partnership_bonus` in `to_engine_player()` by calling `compute_partnership_bonus`.

### P1-3: `derive_importance` is dead code — fixtures never get smart classification

**File:** `src-tauri/crates/ofm_core/src/schedule.rs:13`

`fn derive_importance(...)` is `#[allow(dead_code)]`. Fixture creation sites hardcode `FixtureImportance::League`/`Cup`/`Friendly`.

**Impact:** V99.4 T1.5 `pressure_multiplier` only ever returns 0.5/1.0/1.2. The `CupFinal` (1.8), `ContinentalFinal` (2.0), `Massive` (2.5) tiers never trigger. Stability/clutch modifier scaling is muted for big games.

**Fix:** Wire `derive_importance` into fixture creation sites, passing team reputations.

### P1-4: Trait name mismatch makes `trait_bonus` largely inert

**File:** `src-tauri/crates/engine/src/shared.rs:98-180`

`trait_bonus()` checks for trait names like `"Sharpshooter"`, `"Dribbler"`, `"Playmaker"`, `"Tank"`, `"AerialDominance"`, `"HotHead"`. The actual `PlayerTrait` enum is: `Speedster, Explosive, Workhorse, Powerhouse, Twisty, Orchestrator, Predator, VelvetTouch, BallWinner, Rock, SetPieceSpecialist, Leader, CoolHead, Visionary, SafeHands, CatReflexes, Commander, CompleteForward, EngineRoom, Wonderkid`.

Only ~9/20 trait names match. The other 11 trait bonuses never fire.

**Impact:** Players with `Speedster`, `Powerhouse`, `Twisty`, `Orchestrator`, `Predator`, `VelvetTouch` traits get no bonus in the engine.

**Fix:** Update `trait_bonus()` to use the actual `PlayerTrait` enum variant names.

### P1-5: Hardcoded year 2026 in `club_appeal_score`

**File:** `src-tauri/crates/ofm_core/src/contracts.rs:1250`

```rust
let approx_age = 2026 - birth_year;
```

**Impact:** As the career progresses past 2026, age calculations drift. Veterans get +10 appeal they may not deserve; young players get -5.

**Fix:** Pass `current_date` to `club_appeal_score` instead of hardcoded 2026.

### P1-6: AI manager personality doesn't drive training or transfers

**File:** `src-tauri/crates/ofm_core/src/ai_training.rs:50`

`style_weekly_cycle(play_style)` reads `team.play_style`, not `manager.personality.tactical_style`. The `ManagerPersonality::preferred_play_style()` and `preferred_formation()` methods are never called.

**Impact:** V99.4 T1.7 personalities are generated and stored but have only one effective consumer: `tactics_effectiveness_multiplier()` (which itself is broken per P1-1 for live matches). Transfer philosophy, risk appetite, media style — all cosmetic.

**Fix:** Wire `manager.personality.tactical_style` into `ai_training.rs` and `preferred_formation()` into AI team setup.

---

## 4. Medium-Severity Issues — P2 (Correctness)

### P2-1: Sparse sim ignores weather, fixture pressure, tactics

**File:** `src-tauri/crates/engine/src/sparse_sim.rs:57-161`

`simulate_sparse_match` takes `home: &TeamData, away: &TeamData, rng` — no `MatchConfig`. Weather, fixture pressure, and tactics dials are entirely ignored for AI-vs-AI matches.

**Impact:** AI-vs-AI matches in heavy rain or cup finals simulate identically to clear-weather league matches.

### P2-2: Sparse sim appearance tracking is broken

**File:** `src-tauri/crates/ofm_core/src/turn/mod.rs:846-849`

Appearances are only incremented for goal scorers. Players who played but didn't score get no appearance credit. Cards increment without appearances.

**Impact:** `PlayerSeasonStats::appearances` under-counts badly for AI-vs-AI matches (which is most matches in a career).

### P2-3: `populate_minutes_played` gives every player 90 minutes in full-engine path

**File:** `src-tauri/crates/engine/src/report.rs:419-423`

The full engine path never emits `Substitution` events (only the live match path does). So full-engine matches give every player 90 minutes played — including subs who never came on.

**Impact:** Player minute totals are inflated for CPU-simmed user matches. Clean-sheet bonus over-fires.

### P2-4: Penalty shootout formula uses different attributes than in-match penalty

**Files:** `live_match/penalty.rs:28` (shootout: `(finishing + composure) / 2`) vs `penalty.rs:123` (in-match: `(finishing + decisions) / 2`)

Goalkeeper skill is also different: shootout uses `shot_stopping` doubled while in-match uses `(anticipation + decisions) / 2`.

### P2-5: `EventType::PenaltyAwarded` emitted at start of penalty shootout

**File:** `src-tauri/crates/engine/src/live_match/simulation.rs:131-137`

Semantically wrong — inflates the team's penalty count by 1 in stat aggregation.

### P2-6: `compute_player_ratings` doesn't know which side each player is on

**File:** `src-tauri/crates/engine/src/report.rs:478-512`

Clean-sheet check only fires for 0-0 draws. Conceded-goals penalty never applied.

### P2-7: `deterministic_seed` re-derived from system clock on every load

**File:** `src-tauri/crates/db/src/game_persistence.rs:348`

Breaks save reproducibility — the same save loaded twice produces different RNG seeds.

### P2-8: Duplicate `playing_out: 30,` field in test code

**File:** `src-tauri/src/commands/club.rs:88`

Breaks `cargo test` compilation.

### P2-9: `sim-bench` silently ignores non-Balanced play styles

**File:** `src-tauri/crates/sim-bench/src/main.rs:116-120`

Non-exhaustive match — only `Balanced` arm implemented. All other style flags silently produce `PlayStyle::Balanced`.

---

## 5. Frontend Issues

### P1-FE: Continue button invisible on light theme

**Files:** `src/pages/Dashboard.tsx:396-413`, `src/components/dashboard/DashboardHeader.tsx:425-443`

`MODE_META[matchMode].buttonColorClass` is `" "` (single space) for `matchMode === "live"` (the default). The Continue button renders with NO background — only `text-white`. On light theme the button label is invisible.

### P1-FE: Broken Tailwind class fragments in 8 files

**Files:** `MatchLive.tsx:197`, `PressConference.tsx:445`, `HalfTimeBreak.tsx:167`, `PostMatchScreen.tsx:250`, `SubPanel.tsx:193`, `RoundDigestScreen.tsx:244,246`, `ScoutPlayerCard.tsx:49`

Pattern: `dark: dark:via-navy-900 dark:` — repeated `dark:` prefix with no value. Dead class fragments producing no styles.

### P1-FE: `bg-linear-to-r` without color stops

**Files:** `TacticsPitch.tsx:296,338`, `TacticsPlayerFocusPanel.tsx:283`, `PlayingStyleHero.tsx:113`

`bg-linear-to-r` used without `from-*`/`to-*` color stops. Renders transparent.

### P2-FE: `formatSignedAmount` double-signs negative values

**File:** `src/components/finances/FinancesTab.tsx:81-84`

`formatVal(Math.abs(value))` then prepends `-` if negative — but `formatVal` already handles the sign. Negative values get `--€1.5M`.

### P2-FE: `dangerouslySetInnerHTML` in 3 files

**Files:** `SavesList.tsx:55`, `TrainingSettingsPanel.tsx:81,170`

If user-named data contains HTML, it gets injected.

### P2-FE: Hardcoded English strings in dashboard modals

**Files:** `DashboardOverlays.tsx:97-98,122,128`, `DashboardSimulatingModal.tsx:298,304,316`, `GafferCrest.tsx:166`

Non-English users see mixed-language UI.

### P2-FE: Whole-store subscriptions in 5 components

**Files:** `Dashboard.tsx:87`, `App.tsx:32`, `Settings.tsx:42`, `MatchLive.tsx:43`, `MatchSimulation.tsx:44`

Destructures entire `useGameStore()` or `useSettingsStore()`. Every store mutation re-renders all subscribers.

### P2-FE: 92 `console.*` calls in production code

33 files have console.info/warn/error calls that run in production builds. Should be gated behind `import.meta.env.DEV`.

### P3-FE: Dead code (~470 LOC)

- `PackageBuildStep.tsx` (346 LOC) — V99.5 removed the packages flow
- `GafferIcons.tsx` (411 LOC) — 21 custom icons, zero usages
- `GafferTagline` export — never imported
- `fetchMatchMeaning` + `matchSnapshot` in meaningStore — no consumer hook
- `icons/index.tsx` (431 LOC) — duplicates ~20 lucide-react icons

### P3-FE: `window.prompt` for Save As

**File:** `src/pages/Settings.tsx:325`

Jarring native browser dialog in a Tauri desktop app.

### P3-FE: SimLab route is orphaned

No nav link to `/sim-lab` from any menu. Only reachable by typing the URL.

### P3-FE: `useUndoRedo` re-binds keydown every render

**File:** `src/hooks/useUndoRedo.ts:56`

`useEffect` with no dependency array.

---

## 6. V99.4/V99.5 Feature Status

| Feature | Implemented | Persisted | Wired | Works | Notes |
|---|---|---|---|---|---|
| weather_modifiers_for | ✅ | ✅ | ✅ | ⚠️ Partial | Full + live paths apply weather. Sparse sim ignores it (P2-1). |
| fixture_importance | ⚠️ | ✅ | ⚠️ | ❌ | `derive_importance` is dead code (P1-3). Only 3 of 8 tiers used. |
| sparse_sim | ✅ | N/A | ✅ | ⚠️ | Wired for AI-vs-AI. Missing weather/pressure/tactics (P2-1). |
| board_type | ✅ | ❌ | ⚠️ | ❌ | Not persisted (P0-3). Reset to Sensible on every save/load. |
| player fame | ✅ | ❌ | ⚠️ | ❌ | Not persisted (P0-1). Reset to Unknown on every load. |
| release clauses | ✅ | ❌ | ✅ | ❌ | Not persisted (P0-1). Never set anywhere either. |
| player partnerships | ✅ | ❌ | ⚠️ | ⚠️ | Not persisted (P0-1). Asymmetric — live match path ignores bonus (P1-2). |
| career stories/events | ✅ | ❌ | ✅ | ❌ | Not persisted (P0-1). All events lost on save. |
| transfer requests | ✅ | ⚠️ | ✅ | ⚠️ | `transfer_listed` persists but `transfer_request_date` and `low_morale_days` do not (P0-1). |
| tapping up | ✅ | N/A | ✅ | ✅ | Works. |
| club appeal | ✅ | N/A | ✅ | ⚠️ | Hardcoded year 2026 bug (P1-5). |
| deadline day drama | ⚠️ | ✅ | ⚠️ | ⚠️ | Minimal — just bonuses + 1 news article. |
| AI manager personalities | ✅ | ❌ | ⚠️ | ❌ | Not persisted (P0-2). Mostly unconsumed (P1-6). |
| staff retirement | ✅ | ✅ | ✅ | ✅ | Works. |
| memory resurfacing | ✅ | ✅ | ✅ | ✅ | Works. |
| Hall of Fame | ⚠️ | ✅ | ✅ | ⚠️ | Just seasonal awards archive. No career-spanning entity. |

---

## 7. Performance Concerns

### Backend
- **P-BE-1:** `game.clone()` in every mutating command (`commands/util.rs:23`)
- **P-BE-2:** `simulate_other_matches_with_capture` rebuilds engine teams per fixture — O(N) scan per team per fixture. `Game::team_player_index()` exists but isn't used.
- **P-BE-3:** `player_repo::upsert_players` loops without multi-row INSERT batching
- **P-BE-4:** `prune_old_messages_and_news` parses dates per message per day
- **P-BE-5:** `LiveMatchState::snapshot()` clones 40 PlayerData + 200+ events per minute
- **P-BE-6:** No DB index on `players.team_id`, `messages.date`, `news.date`

### Frontend
- **P-FE-1:** Whole-store subscriptions in 5 components (Dashboard, App, Settings, MatchLive, MatchSimulation)
- **P-FE-2:** `deriveSessionState` runs on every `setGameState` — scans messages, news, teams, players, competitions
- **P-FE-3:** `useUndoRedo` re-binds keydown listener every render
- **P-FE-4:** `MatchLive.tsx:60-66` — rebuilds 50k-entry jersey Map on every state update
- **P-FE-5:** `getDashboardSearchResults` filters 50k players on every keystroke (gated at 2 chars but not debounced)
- **P-FE-6:** 92 `console.*` calls in production

---

## 8. Database Schema Issues

| ID | Issue | Fix |
|---|---|---|
| S1 | V99.4 player fields missing from `players` table | v045 migration: `ALTER TABLE players ADD COLUMN release_clause INTEGER, transfer_request_date TEXT, low_morale_days INTEGER DEFAULT 0, career_events_json TEXT, partnerships_json TEXT, fame TEXT DEFAULT 'Unknown'` |
| S2 | `managers.personality` column missing | v045: `ALTER TABLE managers ADD COLUMN personality_json TEXT DEFAULT NULL` |
| S3 | `teams.board_type` column missing | v045: `ALTER TABLE teams ADD COLUMN board_type TEXT NOT NULL DEFAULT 'Sensible'` |
| S4 | v043/v044 migrations are no-op markers | Cosmetic — rename or add proper ALTER statements |
| S5 | `league` table is a legacy stub (3 columns, 20+ fields in struct) | Verify and remove if vestigial |
| S6 | `meta` table stores 4 growing JSON blobs | Add pruning strategy for `memory_store_json` |
| S7 | No index on `messages.date`, `news.date` | Add `CREATE INDEX idx_messages_date ON messages(date)` |
| S8 | No index on `players.team_id` | Add `CREATE INDEX idx_players_team_id ON players(team_id)` |
| S9 | `stats_state` as single JSON blob | Should be proper relational table for long careers |
| S10 | `deterministic_seed` re-derived from system clock | Persist in `game_meta` |

---

## 9. What Works Well (Do Not Touch)

These systems are well-implemented and should not be refactored unless explicitly necessary:

### Backend
- **Crate separation** — domain → engine → ofm_core → db → tauri is clean
- **`#[serde(default)]` pattern** — extensively used for backward compatibility
- **Daily turn loop** — well-organised pipeline in `turn/mod.rs`
- **Player aging & retirement** — deterministic with veteran decline curves
- **Regen system** — 1:1 replacement + 3-5 academy intake per team per season
- **Manager firing & vacancy filling** — warning/final-warning/fire pipeline
- **World Cup** — full quadrennial cycle with confederation berths
- **National team friendlies + Elo ranking**
- **Promotion/relegation + reputation drift**
- **Match narrative engine** — records memories correctly
- **Scouting progressive reveal** — 3-tier system with fuzzed attributes
- **Save manager** — per-save DBs, 7-stage backfill pipeline, optional snapshots
- **44 migrations** — sequential, well-versioned

### Frontend
- **Architecture** — pages → components → hooks → services → lib → store is clean
- **Type safety** — `strict: true`, comprehensive `store/types.ts`
- **Test coverage** — nearly every component/hook/service has tests
- **i18n** — 11 locales, lazy-loaded, with `pkgTranslations` fallback
- **Lazy loading** — all routes + 17 dashboard tabs lazy-imported
- **Error boundary** — wraps entire app, shows recoverable error screen
- **Theme system** — light/dark/system + high-contrast + ui_scale
- **Custom UI primitives** — Select, DatePicker, Checkbox, Toast, ContextMenu are accessible
- **Tailwind v4 design system** — cohesive pitch-green/brass/mahogany palette

---

## 10. Original V99.2 Master Plan — Status Update

| Master Plan Issue | Status | Notes |
|---|---|---|
| **Economy 30× too small** (REALISM-1 C1) | ✅ Fixed | OVR⁴ formula implemented in V99.3 |
| **Transfer market frozen** (REALISM-1 C2/C3) | ✅ Fixed | Star appeal + not-for-sale + per-buyer caps in V99.3 |
| **Long-term world decay** (VITAL-1 C1/C2/C3) | ✅ Fixed | AI contract renewal + free-agent signing + HoF recording in V99.3 |
| **Live-match drops morale/stability** (ARCH-1 C2) | ⚠️ Partially fixed | Modifiers wired into engine path; live_match path still missing `tactics_multiplier` (P1-1) |
| **OVR formula bugs** (ARCH-1 C1) | ✅ Fixed | 5 missing attrs added + doubled-weight bugs fixed in V99.3 |
| **Daily tick wasteful** (PERF-1) | ✅ Fixed | Message pruning + team→players index + scoped selectors + sparse sim wired in V99.4 |
| **AI contract renewal** (VITAL-1 C1) | ✅ Fixed | `ai_renew_expiring_contracts` in V99.3 |
| **AI free-agent signing** (VITAL-1 C2) | ✅ Fixed | `evaluate_free_agent_market` in V99.3 |
| **Hall of Fame recording** (VITAL-1 C3) | ✅ Fixed | `record_historical_awards` wired in V99.3 |
| **Memory resurfacing** (VITAL-1 M1) | ✅ Fixed | `surface_narrative_memories` in V99.3 |
| **Staff retirement** (VITAL-1 M2) | ✅ Fixed | `apply_staff_retirement` in V99.3 |
| **AI manager poaching** (VITAL-1 M3) | ✅ Fixed | `process_ai_manager_poaching` in V99.4 |
| **Sparse sim dead code** (PERF-1 M4) | ✅ Fixed | Wired in V99.4 (but missing weather/pressure — P2-1) |
| **Goal rate/card tuning** (REALISM-1 M1/M2) | ✅ Fixed | Constants tuned in V99.4 |
| **Defender/midfielder goals** (REALISM-1 M3) | ✅ Fixed | Position-weighted shooter selection in V99.4 |
| **Wonderkid appeal** (REALISM-1 M6) | ✅ Fixed | V99.4 |
| **Transfer requests** (REALISM-1 P1) | ✅ Implemented | V99.4 T1.3 (but persistence broken — P0-1) |
| **Tapping up** (REALISM-1 P2) | ✅ Implemented | V99.4 T3.5 |
| **Club appeal** (REALISM-1 M7) | ✅ Implemented | V99.4 Sprint 6 (but hardcoded year — P1-5) |
| **Deadline day drama** (REALISM-1 M8) | ✅ Implemented | V99.4 T3.1 (minimal) |
| **Release clauses** (IDEAS #11) | ✅ Implemented | V99.4 T4.4 (but persistence broken — P0-1) |
| **Player partnerships** (IDEAS #6) | ✅ Implemented | V99.4 T2.2 (but persistence broken + live path missing — P0-1, P1-2) |
| **Career stories** (IDEAS #5) | ✅ Implemented | V99.4 T2.1 (but persistence broken — P0-1) |
| **Board types** (IDEAS #16) | ✅ Implemented | V99.4 Sprint 5 (but persistence broken — P0-3) |
| **AI manager personalities** (IDEAS) | ✅ Implemented | V99.4 T1.7 (but persistence broken + mostly unconsumed — P0-2, P1-6) |
| **Weather conditions** (IDEAS #9) | ✅ Implemented | V99.4 T1.1 |
| **Fixture importance** (IDEAS) | ✅ Implemented | V99.4 T1.5 (but `derive_importance` dead — P1-3) |
| **Match highlights** (IDEAS #1) | ✅ Implemented | V99.3 |
| **Social media feed** (IDEAS #14) | ✅ Implemented | V99.4 Sprint 7 |
| **Touchline reactions** (IDEAS #8) | ✅ Implemented | V99.4 T3.3 |
| **Loan improvements** (IDEAS #13) | ✅ Implemented | V99.4 Sprint 6 |

**Summary:** 28 of 30 master plan issues are implemented. The remaining gaps are persistence wiring (P0-1/2/3), engine path unification (P1-1/2), and dead code wiring (P1-3/4/6).

---

## 11. Prioritised Fix Roadmap

### Wave A — Critical Persistence Fixes (MUST DO FIRST)
1. **P0-1:** Add V99.4 player fields to DB schema + player_repo (v045 migration)
2. **P0-2:** Add `personality_json` to managers table + manager_repo
3. **P0-3:** Add `board_type` to teams table + team_repo
4. **P2-7:** Persist `deterministic_seed` in game_meta

### Wave B — Engine Path Unification
5. **P1-1:** Apply `tactics_multiplier` in live_match/zone_resolution.rs
6. **P1-2:** Set `partnership_bonus` in team_builder.rs::to_engine_player
7. **P1-4:** Fix trait name mismatches in shared.rs::trait_bonus
8. **P1-5:** Pass current_date to club_appeal_score
9. **P2-1:** Pass MatchConfig to simulate_sparse_match (weather + pressure + tactics)
10. **P2-2:** Fix sparse sim appearance tracking
11. **P2-3:** Fix populate_minutes_played for full-engine path
12. **P2-5:** Use distinct event type for shootout start

### Wave C — Missing Wiring
13. **P1-3:** Wire `derive_importance` into fixture creation sites
14. **P1-6:** Wire ManagerPersonality into ai_training + AI team setup
15. **P2-8:** Fix duplicate `playing_out` in club.rs:88
16. **P2-9:** Fix sim-bench StyleArg::to_play_style

### Wave D — Frontend Polish
17. **P1-FE:** Fix invisible Continue button (Dashboard.tsx:396)
18. **P1-FE:** Fix broken `dark: dark:` class fragments (8 files)
19. **P1-FE:** Fix `bg-linear-to-r` without color stops (3 files)
20. **P2-FE:** Fix `formatSignedAmount` double-sign
21. **P2-FE:** Replace `dangerouslySetInnerHTML` (3 files)
22. **P2-FE:** Localise hardcoded English strings
23. **P2-FE:** Switch to scoped zustand selectors (5 components)
24. **P2-FE:** Gate console.* behind `import.meta.env.DEV`
25. **P3-FE:** Delete dead code (PackageBuildStep, GafferIcons, GafferTagline, useMatchMeaning)
26. **P3-FE:** Replace `window.prompt` with custom modal
27. **P3-FE:** Add/remove SimLab nav link

### Wave E — Database Optimisation
28. **S7:** Add indexes on messages.date, news.date
29. **S8:** Add index on players.team_id
30. **S6:** Add pruning strategy for memory_store_json

### Wave F — Performance
31. **P-BE-2:** Use team_player_index in matchday path
32. **P-FE-2:** Memoise deriveSessionState
33. **P-FE-4:** Memoise jersey Map in MatchLive
34. **P-FE-5:** Debounce dashboard search

---

## 12. Conclusion

The Gaffer codebase has a solid architectural foundation. The V99.3–V99.4 sprint work addressed the original master plan's six interlocking issues (economy, transfer market, world vitality, OVR formula, live-match modifiers, performance). The codebase compiles, the game launches, and the core simulation loop works.

**The critical gap is persistence wiring.** The V99.4 feature batch extended domain types and wrote consuming logic, but the DB repositories were never updated. This means every V99.4 feature that depends on player/manager/team state silently degrades to defaults on every save/reload. This is the #1 priority — without fixing P0-1/2/3, no V99.4 feature survives a save cycle.

The #2 priority is engine path unification. The live_match path and full-engine path have diverged on `tactics_multiplier` and `partnership_bonus`, producing asymmetric results. The user's primary play mode (live match) is the one that's broken.

The #3 priority is frontend polish. The invisible Continue button, broken CSS classes, and hardcoded strings are user-visible quality issues that undermine confidence in the product.

After Waves A–D, the codebase will be in a state where V99.4 features work correctly across save cycles, the match engine produces consistent results regardless of play mode, and the frontend is polished and localised. At that point, the remaining IDEAS doc features (Waves 5–8 of the original plan) become attractive additions rather than band-aids.

---

*This document is a forensic analysis only. No code changes have been made. See `GAFFER_IMPLEMENTATION_GUIDELINES.md` for the safe implementation guide.*
