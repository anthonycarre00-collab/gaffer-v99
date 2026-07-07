# Gaffer — Comprehensive Implementation Plan: Pre-Phase 8 + Phase 8

**Status:** EXECUTING — user approved "use best approach".
**Scope:** Three workstreams executed sequentially:
1. **0.5-FE** — Wire InterpretationSurface into the frontend (the "wow factor" is currently invisible)
2. **0.5** — Wire scraper v3 output into build_world.py (with synthetic test data for V1)
3. **Phase 8** — Season loop + regen system (keep the world alive forever)

**Estimated total effort:** 9-12 days of focused work.

## User decisions (auto-resolved with best approach)

1. **Phase 8 recommendations:** All 5 approved (retired flag / 1:1 regen / position-band potential / top 50 nations / always academy)
2. **Workstream 2 data:** Generate synthetic 50-player test dataset to verify parser. User runs full scrape later.
3. **i18n:** English-only for V1. Full translation in Phase 9.
4. **Execution order:** Workstream 1 → Workstream 3 → Workstream 2 (sequential, safest)
5. **UI/Images:** Proceed with documented recommendations (Pitch Green palette, extend procedural portraits)

---

# Workstream 1: 0.5-FE — InterpretationSurface Frontend Wiring (2-3 days)

## 1.1 Fix meaningStore.ts React anti-pattern
Replace `queueMicrotask` in render body with `useEffect`.

## 1.2 Wire PlayerMeaningCard into PlayerProfile.tsx
Insert as third column in the top grid (alongside Contract + Attributes).

## 1.3 New SquadPulseCard.tsx on Home dashboard
EKG-style harmony strip showing SquadPulse score, pressure level, tension flag, story threads.

## 1.4 New MediaPulseCard.tsx on Home dashboard
Shows active story count, top headline, pundit disagreement, betting trend.

## 1.5 Add meaning.* i18n keys (English only)
New `meaning` namespace in en.json with keys for all hardcoded strings.

## 1.6 Tests
- Update PlayerProfile.test.tsx
- New SquadPulseCard.test.tsx
- New MediaPulseCard.test.tsx
- New meaningStore.test.ts

---

# Workstream 2: 0.5 — Real-Data Pipeline Wiring (2-3 days)

## 2.1 Implement parser in build_world.py
Replace TODO at line 554. Reads gaffer_players.json, converts to WorldData format.

## 2.2 Generate synthetic test dataset
50 realistic players covering all 4 position groups, all 5 Big 5 leagues. Verify parser end-to-end.

## 2.3 Create rivalries.json
20 hand-curated pairs (El Clásico, North London Derby, Manchester Derby, etc.)

## 2.4 Update README

---

# Workstream 3: Phase 8 — Season Loop + Regen System (4-5 days)

## Phase 8 decisions (approved)
- Q1: Keep retired players with `retired: bool` flag (existing pattern)
- Q2: 1:1 regen replacement (preserves squad size)
- Q3: Position-band random potential (not matching retiring player)
- Q4: Top 50 football nations for name pools
- Q5: Always youth academy for regens

## 8.1 Regen Generation Module
New `crates/ofm_core/src/regen/mod.rs` (~400 lines + 25 tests):
- `generate_replacement_regen(retiring_player, team, season, rng)`
- `generate_academy_intake_regens(team, count, season, rng)`

## 8.2 Name Pool Module
New `crates/ofm_core/src/regen/name_pools.rs` + `databases/name_pools.json` (50 nations)

## 8.3 Extend aging.rs
- Condition recovery decline (age ≥ 33: -10% recovery; age ≥ 36: -20%)
- Injury proneness increase (age ≥ 32: +20%; age ≥ 35: +40%)
- Stability shift for veterans

## 8.4 Extend end_of_season.rs
- `generate_replacement_regens()` — 1 regen per retired player
- `generate_academy_intake()` — 3-5 regens per team per season
- News articles for each regen
- Clear ScoutingKnowledge for retired players

## 8.5 Player struct additions
- `former_team_id: Option<String>`
- `retired_season: Option<u32>`

## 8.6 Tests
25+ new unit tests in regen_tests.rs

---

# Definition of Done

- [ ] meaningStore.ts uses useEffect
- [ ] PlayerMeaningCard rendered in PlayerProfile.tsx
- [ ] SquadPulseCard on Home dashboard
- [ ] MediaPulseCard on Home dashboard
- [ ] meaning.* i18n keys in en.json
- [ ] build_world.py parses gaffer_players.json
- [ ] Synthetic 50-player test dataset generated
- [ ] regen/mod.rs with 25+ tests
- [ ] name_pools.json (50 nations)
- [ ] aging.rs extended
- [ ] end_of_season.rs extended
- [ ] Player struct gains former_team_id + retired_season
- [ ] All existing tests still pass
- [ ] All new tests pass
- [ ] Everything committed and pushed
