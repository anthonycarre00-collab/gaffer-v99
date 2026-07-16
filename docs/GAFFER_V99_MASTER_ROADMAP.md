# Gaffer V99.9+ Master Roadmap — Comprehensive Plan

**Generated:** 2026-07-16
**Base commit:** `80a0858` (V99.9)
**Source:** Forensic code-level analysis of all 30 items from `GAFFER_V998_10_SEASON_SIMULATION_REPORT.md` + parallel deep-dive traces of every subsystem + comprehensive UI audit.

---

## CRITICAL DISCOVERIES (changes the plan significantly)

The four parallel deep-dive agents discovered that **several of the original 30 items have stale or incorrect premises**. The actual state of the code is different from what the simulation report assumed. This affects priority, effort, and approach.

### Discovery 1: C14 ("sparse_sim.rs is dead code") — PREMISE IS FALSE
`sparse_sim.rs::simulate_sparse_match` IS actively called at `turn/mod.rs:805` via `simulate_sparse_ai_match` (line 782), which runs **every AI-vs-AI matchday fixture**. This was wired in V99.4 PERF-1 M4 as a deliberate ~10× speedup. The V998 forensic report's "Bug C14" finding pre-dates that wiring.

**Action:** Do NOT delete `sparse_sim.rs`. Update its docstring. Close C14 as "not reproducible".

### Discovery 2: C3 ("No AI contract renewals exist") — PARTIALLY IMPLEMENTED
`ai_renew_expiring_contracts` exists at `contracts.rs:1030-1132` and is called daily via `process_contract_expiries` (`turn/mod.rs:167`). But it's crude: hardcoded multipliers (1.05/1.00/0.90) instead of `expected_wage`, hardcoded years (4/3/2/1) instead of `expected_contract_years`, bypasses `renewal_wage_policy_allows`, only renews within 30 days of expiry.

**Action:** Rewrite, don't build from scratch. Effort drops from L to M.

### Discovery 3: C4 ("AI clubs never sign free agents") — PARTIALLY IMPLEMENTED
`ai_sign_free_agents` exists at `transfers.rs:1220-1362` and runs after `evaluate_transfer_market`. But it bypasses the rich `offer_free_agent_contract` flow, uses `market_value / 50` for wage (no appeal premium), hardcoded threshold of 6 (disagrees with `POSITION_GROUP_SURPLUS_THRESHOLD = 8`).

**Action:** Rewrite to use shared core with `offer_free_agent_contract`. Effort M-L.

### Discovery 4: C12 ("Manager personality mostly cosmetic") — PARTIALLY FIXED
The `Manager` struct **DOES** have a `personality: ManagerPersonality` field (`manager.rs:155-157`, added V99.4 T1.7) with 6 fields: `tactical_style`, `tactical_acumen`, `transfer_philosophy`, `man_management`, `risk_appetite`, `media_style`. But only 2 of 6 are consumed (`tactical_style` → training, `tactical_acumen` → tactics multiplier). The other 4 are dead.

**Action:** Plumb the 4 unused fields into transfers/morale/match-engine/news. Effort L.

### Discovery 5: Item 12 ("AI manager lateral moves") — PARTIALLY IMPLEMENTED
`process_ai_manager_poaching` exists at `ai_hiring.rs:369-469`, called from `end_of_season.rs:1103`. But it only fills vacant elite slots, doesn't displace in-post managers, picks first candidate (not best), and sacked managers are NEVER rehired (sit in `game.managers` forever).

**Action:** Rewrite poaching + add `ai_headhunt` for sacked-manager rehire. Effort L.

### Discovery 6: C13/Item 30 ("No staff retirement") — PARTIALLY IMPLEMENTED
`apply_staff_retirement` exists at `aging.rs:193-286`, called from `apply_seasonal_aging`. But uses uniform age ladder (70+/75+/80+) with no role differentiation, and doesn't backfill AssistantManager/Coach/Physio slots (only Managers/Scouts).

**Action:** Add role-aware cutoffs + backfill all staff roles. Effort S-M.

### Discovery 7: Item 15 ("Refresh wage_budget") — PARTIALLY IMPLEMENTED
`end_of_season.rs:1052-1053` already refreshes both `transfer_budget` and `wage_budget` as flat 20%/25% of finance. But missing: `board_type.wage_budget_multiplier()` (applied at worldgen but not at refresh), squad-wages floor, and the test at `end_of_season_tests.rs:2552` is stale (asserts 15%, production is 20%).

**Action:** Add board_type multiplier + squad-wages floor. Fix stale test. Effort S.

### Discovery 8: C1 ("Player rating always 0.0") — PARTIALLY FIXED
The engine's `compute_player_ratings` at `report.rs:482-516` IS wired and produces ratings in [3.0, 10.0] via goal/assist/card adjustments. The bug is that the more sophisticated `calculate_match_rating` (narrative-aware, with clutch/context factors) at `media/mod.rs:304` is dead code, and `compute_player_ratings` is position-blind (GK gets same goal bonus as forward).

**Action:** Wire `calculate_match_rating` + add position-aware scoring + add `side` field to `PlayerMatchStats`. Effort L.

### Discovery 9: Item 26 ("youth facility missing") — SILENT DATA LOSS
The bundled DB (`build_world.py:790`) ships `{"training":1, "medical":1, "youth":1}` but the Rust `Facilities` struct has no `youth` field, so serde silently drops it. Also missing `scouting:1` (defaults to 1 via serde, unintentional).

**Action:** Add `youth` field + `FacilityType::Youth` variant + wire into `reputation_bias`. Effort M.

### Discovery 10: C8 ("reputation scale mismatch") — SECOND BUG FOUND
Besides `regen/mod.rs:37-47`, there's a second 0-100-scale bug at `contracts.rs:1336` (`if team.reputation < 40`) that never fires. Both must be fixed.

### Discovery 11: C2 ("regen contract_end") — ADJACENT BUG
Besides the `2024 + 3` literal, `refresh_player_derived` is called with hardcoded `2024` at `regen/mod.rs:139, 196` instead of `season`, affecting wonderkid-trait assignment for regens in seasons > 2024.

---

## MASTER PRIORITY LIST (45 items: 30 original + 15 UI)

Items are grouped by phase. Within each phase, ordered by dependency + effort.

### PHASE 1 — Critical Fixes (blocks 10-season playability)
*These must ship first. Without them, the career degrades by season 5-7.*

| # | Item | Effort | Risk | Key Files | Dependencies |
|---|---|---|---|---|---|
| 1 | **C2**: Regen contract_end uses `season + 3` not `2024 + 3`; also fix `refresh_player_derived` year | S | Low | `regen/mod.rs:134,139,192,196` | None — ship first |
| 2 | **C8**: Fix reputation_bias thresholds (0-1000 scale) + contracts.rs:1336 second bug | S | Low-Med | `regen/mod.rs:37-47`, `contracts.rs:1336` | None — ship parallel with C2 |
| 3 | **C5**: Call `roll_match_injury` in `deplete_match_stamina` for club matches | S | Low | `turn/post_match.rs:913-926` | None |
| 4 | **C15**: Fix shootout GK skill — `gk.shot_stopping + gk.commanding` (one-line) | S | Trivial | `live_match/penalty.rs:29` | None |
| 5 | **C7**: Recompute `market_value` in `refresh_player_derived` (weekly cadence) | S-M | High | `player_rating.rs:42-71` | Snapshot MV in `TransferOffer.last_manager_fee` to avoid mid-negotiation drift |
| 6 | **C3**: Rewrite `ai_renew_expiring_contracts` to use `expected_wage` + `renewal_wage_policy_allows` | M | Med | `contracts.rs:1030-1132` | Depends on C7 (correct MV → correct expected_wage) |
| 7 | **C4**: Rewrite `ai_sign_free_agents` to use shared core with `offer_free_agent_contract` | M-L | High | `transfers.rs:1220-1362`, `contracts.rs:558-766` | Depends on C7 + Item 14 (per-position thresholds) |
| 8 | **C6**: Filter `sent_off` in `position_attr_avg` / `effective_midfield` / `effective_press` (BOTH live + simple copies) | M | Med | `engine/src/types.rs:300-306`, `live_match/helpers.rs:182-201`, `engine/resolution.rs:529-544` | None — but must fix BOTH copies |
| 9 | **C1**: Wire `calculate_match_rating` + position-aware scoring + `side` field on `PlayerMatchStats` | L | Med | `engine/src/report.rs:482-516`, `turn/post_match.rs:405-451`, `media/mod.rs:304-315` | Depends on C6 (red cards properly weaken team → correct context_difficulty) |

### PHASE 2 — High-Impact Realism (unblocks believable AI behavior)
*These make the world feel alive over 10 seasons.*

| # | Item | Effort | Risk | Key Files | Dependencies |
|---|---|---|---|---|---|
| 10 | **C9**: Prune retired players from `game.players` at end-of-season (after `convert_retired_players_to_candidates`) | M | Med | `end_of_season.rs:1100`, new `regen/mod.rs::prune_retired_players` | Ship AFTER C2 (so regens aren't pruned by expired contracts) |
| 11 | **Item 14**: Per-position surplus thresholds (GK=3, DEF=8, MID=8, FWD=6) — unify both sites | S | Low | `transfers.rs:48,307,1273` | None |
| 12 | **Item 15**: Refresh `wage_budget` with `board_type` multiplier + squad-wages floor; fix stale test | S | Med | `end_of_season.rs:1052-1053` | None |
| 13 | **Item 16**: Re-run `seed_opening_ai_loan_market` annually at end-of-season | S | Low | `end_of_season.rs:~1196` | Ship AFTER C2 (regens need valid contracts for loan-listing) |
| 14 | **C10**: Make `build_engine_team` delegate to `build_team_with_bench` (XI not squad) | S-M | Med | `turn/mod.rs:581-686`, `team_builder.rs:17` (visibility bump) | None — but changes AI-vs-AI sim results |
| 15 | **C11**: Add live-vs-simple consistency test | S | Low | `engine/tests/` (new test) | Ship AFTER C10 |
| 16 | **C13/Item 30**: Role-aware staff retirement cutoffs + backfill all staff roles | S-M | Low | `aging.rs:193-286`, `generator/mod.rs:279` (refactor to pub) | None |
| 17 | **Item 20**: Vary academy GK count (0-1 per intake, weighted by current GK depth) | S-M | Low | `regen/mod.rs:157-164` | None |
| 18 | **C12**: Plumb 4 unused manager personality fields into transfers/morale/match-engine/news | L | Med | `domain/manager.rs`, `transfers.rs`, `live_match_manager.rs`, `turn/post_match.rs`, `news.rs` | Ship AFTER C3/C4 (so personality affects the new renewal/FA logic) |
| 19 | **Item 12**: Rewrite `process_ai_manager_poaching` (displace in-post, score candidates) + add `ai_headhunt` for sacked-manager rehire | L | Med | `ai_hiring.rs:369-469`, `firing.rs` | Depends on C12 (ambition field) |
| 20 | **Item 13**: Add January transfer window (Jan 1-31) | M | High | `season_context.rs:73-127`, `domain/season.rs` | None — but touches the most-gated function in transfers |

### PHASE 3 — Medium Polish (improves long-term engagement)
*These add depth and variety over a long career.*

| # | Item | Effort | Risk | Key Files | Dependencies |
|---|---|---|---|---|---|
| 21 | **Item 23**: New-manager grace period (30 days, satisfaction floor 30) | S | Low | `turn/post_match.rs:203`, `firing.rs:65-86` | None |
| 22 | **Item 17**: Add past final league tables to `WorldHistoryArchive` | M | Low | `domain/world_history.rs`, `end_of_season.rs`, `history_generation.rs` | None |
| 23 | **Item 18**: Add milestone news (100th appearance, 50th goal, debut goal) | M | Med | `domain/news.rs`, `ofm_core/news.rs`, `turn/post_match.rs` | None |
| 24 | **Item 19**: Add comeback/shock news (2-0 down → win, lower-division beating top flight) | M | Med-High | `news/match_report.rs` | Needs tier-lookup helper (defensive for foreign leagues) |
| 25 | **Item 22**: Tighten `average_goals_realistic` test + add live-vs-simple consistency test | S-M | Low-Med | `engine/tests/` | Ship AFTER C10 (so consistency is real) |
| 26 | **Item 21**: Add career-threatening injury pool (ACL, broken leg) with permanent penalty + `chronic_injury_count` | L | Med-High | `domain/player.rs`, new DB migration, `player_wear.rs`, `turn/mod.rs` | Ship AFTER C9 (don't accumulate injury_history on soon-to-be-pruned players) |
| 27 | **Item 26**: Add `youth` facility to `Facilities` + `FacilityType::Youth` + wire into `reputation_bias` | M | Med | `domain/team.rs`, `club.rs`, `commands/club.rs`, `regen/mod.rs`, `FinancesTab.tsx`, i18n | Coordinate with C8 (both touch reputation_bias) |

### PHASE 4 — Low Priority / Cleanup
*Cosmetic, dead-code removal, documentation.*

| # | Item | Effort | Risk | Key Files | Dependencies |
|---|---|---|---|---|---|
| 28 | **Item 24**: Fix shootout GK skill (DUPLICATE of #4 above — same bug) | S | Trivial | `live_match/penalty.rs:29` | Already in Phase 1 |
| 29 | **Item 25**: Do NOT delete `sparse_sim.rs` — update docstring only (premise was false) | S | None | `sparse_sim.rs:1-19` | None |
| 30 | **Item 27**: Update `docs/MATCH_SIMULATION.md` with actual MatchConfig defaults | S | None | `docs/MATCH_SIMULATION.md` | None |
| 31 | **Item 28**: Remove `distribution` attribute from engine layer (after Item 29) | S | Low-Med | `engine/src/types.rs:103`, `engine/src/shared.rs:21`, 6 test files | Ship AFTER Item 29 |
| 32 | **Item 29**: Remove dead `defense_rating()`, `attack_rating()`, `goalkeeper_rating()` | S | Low | `engine/src/types.rs:328-365`, `simulation_tests.rs:105-117` | None — ship BEFORE Item 28 |

### PHASE 5 — UI Overhaul (15 items, added per user request)
*The UI is "still ugly in both light and dark modes". The design system is correct; the problem is adherence. 1,746 generic Tailwind color usages across 187 files.*

| # | Item | Effort | Risk | Key Files | Severity |
|---|---|---|---|---|---|
| 33 | **UI-1**: Fix broken spectator/delegate continue buttons — `from-indigo-500 to-indigo-600` missing `bg-gradient-to-r` → renders with NO background | S | High visibility | `Dashboard.tsx:404,412` | 🔴 Critical |
| 34 | **UI-2**: Replace `#10b981`/`#6366f1` hardcoded fallbacks in 5 match components + `chartTheme.ts` with Gaffer palette | M | High | `PreMatchSetup.tsx:100-101`, `MatchLive.tsx:57-58`, `PostMatchScreen.tsx:120-121`, `HalfTimeBreak.tsx:73-74`, `RoundDigestScreen.tsx:168-169`, `chartTheme.ts:18-19` | 🔴 Critical |
| 35 | **UI-3**: Fix `hover: dark:hover:` and `hover: hover:` typos in NewsTab + EndOfSeasonScreen | S | Low | `NewsTab.tsx:345,442`, `EndOfSeasonScreen.tsx:191` | 🟠 High |
| 36 | **UI-4**: Replace `text-purple-500`/`text-fuchsia-500` in NewsTab category colors with `text-accent-500`/`text-danger-500` | S | Med | `NewsTab.tsx:41-42,52-53` | 🟠 High |
| 37 | **UI-5**: Fix `font-mono font-mono` duplicate in TournamentsTab:1174 | S | Trivial | `TournamentsTab.tsx:1174` | 🟡 Medium |
| 38 | **UI-6**: Replace last remaining gradient (`bg-linear-to-r from-red-100...`) in PostMatchScreen with matte `bgc-danger-500/15` | S | Low | `PostMatchScreen.tsx:249` | 🟡 Medium |
| 39 | **UI-7**: Increase `gaffer-card-texture` opacity (3% effective → 15%) so cards feel papery not flat plastic | S | Low | `App.css:410-415` (light), `App.css:683-689` (dark) | 🟡 Medium |
| 40 | **UI-8**: Pick ONE source of truth for cards — delete `.gaffer-card` from App.css (unused) OR make `Card.tsx` use it | S | Low | `App.css:164`, `Card.tsx:32-41` | 🟡 Medium |
| 41 | **UI-9**: Replace `.pos-mid { background-color: #3b5998 }` (Facebook blue) with Gaffer palette token | S | Low | `App.css:212` | 🟡 Medium |
| 42 | **UI-10**: Add `.gaffer-surface` utility for recurring `bg-white dark:bg-navy-700 border border-gray-200 dark:border-navy-600` pattern (100+ sites) | S | Low | `App.css` (new utility) | 🟡 Medium |
| 43 | **UI-11**: Color token migration — sweep `text-gray-*`/`bg-gray-*` → `text-concrete`/`text-chalk`/`bg-chalk` across all components | L | Med | ~187 files (codemod) | 🟡 Medium |
| 44 | **UI-12**: Hardcoded hex replacement — find all `#10b981`, `#6366f1`, `#3b5998`, `#8b5cf6` in `.tsx` files → CSS vars | M | Low | Multiple | 🟡 Medium |
| 45 | **UI-13**: Fix dark-mode `.text-gray-500/400` overrides that use cold blue `#8d99ae`/`#a0aec0` → warm `--color-chalk`/`--color-concrete` | S | Low | `App.css:239-245` | 🟡 Medium |

---

## DEPENDENCY GRAPH

```
PHASE 1 (Critical):
  C2 ──┬──► C16 (loan seeding needs valid regen contracts)
       └──► C9 (pruning must not delete valid regens)
  C8 ──┬──► Item 26 (youth facility adds to reputation_bias)
       └──► C2 (coordinate regen changes)
  C7 ──► C3 (correct MV → correct expected_wage for renewals)
       └──► C4 (correct MV → correct FA wages)
  C6 ──► C1 (red cards weaken team → correct context_difficulty for ratings)
  C10 ─► C11 (consistency test needs unified team construction)
  C5, C15 — independent

PHASE 2 (High-Impact):
  C3 + C4 ──► C12 (personality affects the new renewal/FA logic)
  C12 ─────► Item 12 (ambition field drives poaching willingness)
  Item 14 ──► C4 (per-position thresholds unify both surplus checks)
  C9 ──────► Item 21 (don't accumulate injury_history on soon-to-be-pruned players)

PHASE 3 (Polish):
  C10 + C11 ──► Item 22 (consistency test needs unified team construction)
  Item 17, 18, 19, 23 — independent
  Item 26 ──► C8 (coordinate reputation_bias changes)

PHASE 4 (Cleanup):
  Item 29 ──► Item 28 (remove dead rating methods before removing distribution attr)
  Item 25 — DO NOT DELETE (premise was false)

PHASE 5 (UI):
  UI-1, UI-2 — critical, ship first
  UI-3 through UI-10 — mechanical fixes
  UI-11 (color token migration) — largest effort, do last (codemod)
  UI-12, UI-13 — can run in parallel with UI-11
```

---

## RECOMMENDED SHIP ORDER

### Sprint 1 (Week 1): Critical Foundation — ~20 hours
1. **C2** (regen contract_end + refresh_player_derived year) — 30 min
2. **C8** (reputation_bias thresholds + contracts.rs:1336) — 30 min
3. **C15** (shootout GK skill) — 15 min
4. **C5** (club match injuries) — 1 hr
5. **Item 14** (per-position surplus thresholds) — 30 min
6. **Item 15** (wage_budget refresh + fix stale test) — 1 hr
7. **Item 16** (annual loan seeding) — 15 min
8. **Item 23** (new-manager grace period) — 30 min
9. **UI-1** (broken continue buttons) — 15 min
10. **UI-3** (hover: typos) — 15 min
11. **UI-7** (card texture opacity) — 15 min

### Sprint 2 (Week 2): Data Integrity — ~15 hours
1. **C7** (market_value recompute + TransferOffer snapshot) — 3 hr
2. **C3** (rewrite ai_renew_expiring_contracts) — 3 hr
3. **C4** (rewrite ai_sign_free_agents) — 4 hr
4. **C9** (prune retired players) — 2 hr
5. **C13/Item 30** (role-aware staff retirement + backfill) — 2 hr
6. **Item 20** (vary academy GK count) — 1 hr

### Sprint 3 (Week 3): Match Engine Realism — ~12 hours
1. **C6** (filter sent_off in team ratings — BOTH copies) — 3 hr
2. **C10** (build_engine_team delegates to build_team_with_bench) — 2 hr
3. **C11** (live-vs-simple consistency test) — 1 hr
4. **C1** (wire calculate_match_rating + position-aware + side field) — 6 hr

### Sprint 4 (Week 4): AI Personality + Movement — ~15 hours
1. **C12** (plumb 4 unused personality fields) — 6 hr
2. **Item 12** (rewrite poaching + ai_headhunt + rehire sacked) — 6 hr
3. **Item 13** (January transfer window) — 3 hr

### Sprint 5 (Week 5): Long-Term Depth — ~15 hours
1. **Item 17** (past league tables in WorldHistoryArchive) — 3 hr
2. **Item 18** (milestone news) — 4 hr
3. **Item 19** (comeback/shock news) — 4 hr
4. **Item 22** (tighten goals test + consistency test) — 2 hr
5. **Item 26** (youth facility) — 3 hr
6. **Item 21** (career-threatening injuries) — defer to Sprint 6 if time-constrained

### Sprint 6 (Week 6): Cleanup + UI Sweep — ~20 hours
1. **Item 29** (remove dead rating methods) — 15 min
2. **Item 28** (remove distribution attr from engine) — 30 min
3. **Item 27** (update MATCH_SIMULATION.md) — 1 hr
4. **Item 25** (update sparse_sim.rs docstring) — 15 min
5. **UI-2** (hardcoded hex replacement in match components + chartTheme) — 2 hr
6. **UI-4** (NewsTab purple/fuchsia → accent/danger) — 30 min
7. **UI-5, UI-6, UI-8, UI-9, UI-10** (mechanical CSS fixes) — 2 hr
8. **UI-11** (color token migration codemod) — 8 hr
9. **UI-12, UI-13** (hex replacement + dark-mode overrides) — 2 hr

**Total estimated effort: ~97 hours (~12 working days at 8hr/day)**

---

## UI AGENT STRATEGY (per user request)

The user asked for "a specific expert agent to help us" with the UI. Based on the audit:

**The UI problem is NOT creative — it's mechanical.** The design system (App.css) is correct. The problem is that 187 component files don't adhere to it — they use generic Tailwind colors (`text-gray-500`, `#10b981`, `text-purple-500`) instead of Gaffer tokens (`text-concrete`, `var(--color-primary-500)`, `text-accent-500`).

**Recommended approach: a multi-pass codemod agent with strong regex + linting.**

1. **Pass 1 — Color token migration.** Build a mapping table:
   - `text-gray-{400,500,600,700,800}` → `text-concrete` / `text-ink` / `text-chalk` (with `dark:` variants)
   - `bg-gray-{50,100,200}` → `bg-chalk/50`, `bg-chalk`, `bg-chalk/200`
   - `text-blue-*`, `text-indigo-*`, `text-emerald-*`, `text-purple-*`, `text-fuchsia-*`, `text-amber-*`, `text-red-*` → Gaffer equivalents
   - `from-X to-Y` (without `bg-gradient`/`bg-linear`) → `bgc-X`
   Run as scripted find-replace, then `tsc --noEmit` to catch type errors, then manual review of ~50 context-sensitive cases.

2. **Pass 2 — Hardcoded hex replacement.** Find all `#10b981`, `#6366f1`, `#3b5998`, `#8b5cf6` in `.tsx` files → `var(--color-*)` references.

3. **Pass 3 — Broken CSS typo sweep.** Regex for `hover: dark:`, `hover: hover:`, `font-mono font-mono`.

4. **Pass 4 — Texture-opacity tuning.** Single edit to `App.css:410-415` and `App.css:683-689` to bump SVG noise opacity.

5. **Pass 5 — Card consolidation.** Delete `.gaffer-card` from App.css (dead) OR refactor `Card.tsx` to use it. Pick one.

**Avoid** reaching for an image-generation or "creative UI" agent: the design system is correct; the problem is *adherence* to it, not *definition* of it. A general-purpose coding agent with biome/tsc validation loops is the right tool. The `charts` skill could help with the chart-theme fix (UI-2).

---

## KEY CROSS-CUTTING FINDINGS

1. **Two parallel engine code paths** (simple engine in `engine/src/engine/` vs live engine in `engine/src/live_match/`) duplicate `effective_midfield`, `effective_press`, foul/card logic, and penalty logic. Bug fixes MUST be applied to both. This is structural debt — consider unifying in a future refactor.

2. **`build_engine_team` vs `build_team_with_bench`** is the same pattern: two paths producing `TeamData` with different semantics. C10's fix (delegate) eliminates the duplication.

3. **No test currently asserts on**: rating computation output (C1), team-rating reduction after red card (C6), injury production from club matches (C5), shootout GK skill influence (C15), live-vs-simple consistency (C11). All fixes must add tests.

4. **`calculate_match_rating`'s narrative inputs** (story threads, rivalry, late winner, comeback) require lookups into `game.memory_store`, `report.events`, and team rivalry data — none currently passed to `apply_player_stats`. C1 fix must thread this context through or do lookups inside `apply_player_stats` (it has `&mut Game`).

5. **`PlayerMatchStats` lacks a `side: Side` field** — blocks position-aware rating logic (GK clean sheets) in C1. Adding it requires `#[serde(default)]` for save-compat.

6. **Stale test**: `end_of_season_tests.rs:2552` asserts `transfer_budget == finance * 0.15` but production is `0.20`. Fix as part of Item 15.

7. **Two surplus thresholds disagree**: `POSITION_GROUP_SURPLUS_THRESHOLD = 8` (`transfers.rs:48`) vs `let threshold = 6` (`transfers.rs:1273`). Item 14 must unify both.

8. **`market_value` is consumed by 25+ sites** (C7). Recomputing mid-negotiation is the highest-risk change. Mitigation: snapshot MV into `TransferOffer.last_manager_fee` (field already exists) at offer creation.

9. **`manager.personality` is generated but 4 of 6 fields are dead** (C12). The match engine's `derive_personality` (`live_match_manager.rs:335`) ignores `manager.personality` entirely — derives from reputation + career stats.

10. **Sacked managers are never rehired** (Item 12). `process_vacant_ai_clubs` always creates brand-new managers from staff pool, growing `game.managers` by ~5-10 entries/season. Memory leak over long saves.

11. **Bundled DB silent data loss** (Item 26): `build_world.py:790` ships `{"training":1, "medical":1, "youth":1}` but Rust struct drops `youth`. Also missing `scouting:1`.

12. **Dangling-reference risk** in `relationship_graph.edges` (C9): no `remove_node` method, only `remove(a, b)` per edge. Pruning players without cleaning edges leaves orphaned keys.

---

## WHAT TO DO NEXT

1. **Start with Sprint 1** — the 11 quick wins (~5 hours total) that unblock everything else. Most are 15-30 minute fixes. C2, C8, C15, C5, Item 14, Item 15, Item 16, Item 23, UI-1, UI-3, UI-7.

2. **After Sprint 1, re-run the 10-season forensic simulation** to verify the bug cascade (C1→C2→C3→C4→C7) is broken. The world should no longer degrade by season 5-7.

3. **Sprint 2-3** are the data-integrity + match-engine foundations. After these, the career is playable to season 10.

4. **Sprint 4-5** add personality + depth. After these, the career is *believable* to season 10.

5. **Sprint 6** is cleanup + the UI codemod sweep. After this, the game looks like a Gaffer game, not a generic SaaS dashboard.

**Do NOT attempt to do all 45 items in one sprint.** The dependencies are real — C7 must precede C3/C4, C10 must precede C11, C6 must precede C1, C2 must precede C9/Item 16. Skipping ahead will introduce regressions.

---

*This roadmap supersedes the 30-item list in `GAFFER_V998_10_SEASON_SIMULATION_REPORT.md`. The original report's findings were accurate at the time but several items have since been partially implemented (C3, C4, C12, C13, Item 12, Item 15) or were misdiagnosed (C14). This roadmap reflects the actual state of the codebase at commit `80a0858`.*
