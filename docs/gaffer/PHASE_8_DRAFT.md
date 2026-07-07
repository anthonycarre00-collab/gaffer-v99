# Phase 8 — Season Loop + Regen System (DRAFT — paused before acting)

## Goal

Keep the world alive forever. Players retire at end of season; regens (procedurally generated youth prospects) replace them. Age-based attribute decline applies to veterans. Save files persist the world state across seasons.

## Current State (what already exists)

Per the Phase 7 audit, substantial season-loop scaffolding is **already in place**:

- `crates/ofm_core/src/end_of_season.rs` — exists, has `apply_seasonal_aging()`, deterministic retirement rolls, documented hemisphere-stall edge case (TODO at line 638)
- `crates/ofm_core/src/aging.rs` (285 lines) — `apply_seasonal_aging()` already does:
  - Veteran pace loss (age ≥ 30, 1-3 pts, seeded per `(player_id, season, salt)`)
  - Technical growth (age ≤ 32, 0-1 pt to passing/vision/decisions/composure)
  - Deterministic retirement rolls
- `crates/ofm_core/src/turn/mod.rs` — `process_day_with_capture()` is the single day-advance entry point
- `crates/ofm_core/src/generator/` — `generate_youth_academy_recruit_with_nationality()` already exists for youth recruitment
- Phase 6 added stability guard regression + plateau system — these compose naturally with seasonal aging

So Phase 8 is **NOT a greenfield build**. It's an enhancement + integration of existing pieces.

## Scope (proposed — for user approval before acting)

### 8.1 — Regen Generation System
- New module `crates/ofm_core/src/regen/mod.rs`:
  - `RegenProfile` struct: position, nationality, age band (16-19), potential band (based on retiring player's reputation), personality (random Big Five, confidence=100), narrative traits (probabilistic)
  - `generate_replacement_regen(retiring_player, team, rng)` — produces a regen that "fills the void" left by the retiring player (same position, similar potential band, same nationality preference)
  - `generate_random_youth_regen(team, rng)` — for academy intake (no retiring player reference)
  - Procedural name generation: nationality-appropriate first/last name pools (load from `databases/name_pools.json`)
  - Initial relationship edges to teammates (Phase 2 RelationshipGraph integration)
  - Deterministic seeding from `(team_id, season, salt)` for reproducibility

### 8.2 — End-of-Season Loop
- Modify `end_of_season.rs`:
  - After `apply_seasonal_aging()`, scan for retired players
  - For each retired player on a team, generate a replacement regen
  - Assign regen to the team with a "Youth" squad_role
  - Generate news article: "Academy prospect [Name] promoted to first-team squad"
  - Remove retired player from active roster (mark as retired, keep in world_history)

### 8.3 — Age-Based Attribute Decline (compose with Phase 6)
- The existing `aging.rs` handles veteran pace loss + technical growth
- Phase 8 adds:
  - Condition recovery decline (age ≥ 33: -10% recovery rate)
  - Injury proneness increase (age ≥ 32: +20% injury roll probability)
  - Stability modifier shift (veterans with high stability get +5; low-stability veterans get -10 — "the cracks show")
- These compose with Phase 6's plateau_growth_factor (already returns 0.4 for gap≤1, age≥28)

### 8.4 — Save File Persistence
- Verify the existing save system handles:
  - Retired players (should they be removed from `game.players` or kept with a `retired: bool` flag?)
  - Regen players (new IDs, new relationships — should serialize fine via existing Game JSON blob)
  - ScoutingKnowledge entries for retired players (should be cleared — they're gone)
- No DB migration expected (Game JSON blob handles it)

### 8.5 — Youth Academy Integration
- The existing `youth_scouting_assignments` system generates youth recruits
- Phase 8 wires regens into the same pipeline: when a regen is generated, it can optionally go into the youth academy instead of the first-team squad
- Academy regens train with Phase 6 mechanics (plateau + personality + position focus)

### 8.6 — Tests
- 20+ new unit tests:
  - Regen generation produces valid players (all 19 attrs 1-99, position set, nationality set)
  - Replacement regen matches retiring player's position group
  - Replacement regen's potential is within ±10 of retiring player's potential at retirement
  - Deterministic seeding produces same regen for same (team, season, salt)
  - Name generation produces nationality-appropriate names
  - Age-based decline: veteran pace loss applies
  - Age-based decline: condition recovery declines for age ≥ 33
  - Age-based decline: injury proneness increases for age ≥ 32
  - End-of-season loop: retired players removed from roster
  - End-of-season loop: replacement regens added to roster
  - End-of-season loop: news article generated for each promotion
  - ScoutingKnowledge cleared for retired players

## Scope (out of scope, deferred)

- Cross-hemisphere league rollover fix (documented TODO at end_of_season.rs:638) — defer to Phase 9
- Regen "wonderkid" emergence events (narrative engine integration) — defer
- Youth intake day as a scheduled event with UI — defer to Phase 9 UI work
- Academy facility level affecting regen quality — defer
- Regens developing narrative traits over time (Phase 2 already has personality evolution; regens start with traits)

## Files to Touch (proposed)

| File | Change |
|---|---|
| `crates/ofm_core/src/regen/mod.rs` | NEW — regen generation |
| `crates/ofm_core/src/regen/name_pools.rs` | NEW — nationality name data |
| `databases/name_pools.json` | NEW — name data (first/last by nationality) |
| `crates/ofm_core/src/aging.rs` | Add condition recovery decline + injury proneness + stability shift |
| `crates/ofm_core/src/end_of_season.rs` | Wire regen generation after retirement |
| `crates/ofm_core/src/lib.rs` | `pub mod regen;` |
| `crates/ofm_core/tests/regen_tests.rs` | NEW — 20+ tests |

## Critical Questions for User (PAUSE HERE)

1. **Retired player handling**: Remove from `game.players` entirely (simpler, but loses history), or keep with `retired: bool` flag (more data, but `game.players` grows forever)?
2. **Replacement regen philosophy**: Should regens always replace retiring players 1:1 (preserves squad size), or should teams sometimes promote from academy / sign free agents instead (more realistic but more complex)?
3. **Regen potential band**: Should it match the retiring player's potential (preserves league quality), or be lower (realistic — youth prospects rarely match veterans), or be random within a position-appropriate band?
4. **Name pool coverage**: How many nationalities? Top 20 football nations? Top 50? All 211 FIFA members?
5. **Academy vs first-team**: Should regens always go to first-team squad (simple), or always to academy (realistic, requires academy UI), or position-dependent?

## Estimated Effort

- 8.1 Regen generation: 2-3 days (name pools are the long pole)
- 8.2 End-of-season loop: 1 day
- 8.3 Age-based decline: 0.5 day
- 8.4 Save persistence verification: 0.5 day
- 8.5 Academy integration: 1 day
- 8.6 Tests: 1 day

**Total: ~6-7 days of focused work**

## Dependencies / Blockers

- Phase 6 (training overhaul) — ✅ done, regens will use the same growth mechanics
- Phase 2 (relationship graph) — ✅ done, regens need initial teammate relationships
- Existing `aging.rs` and `end_of_season.rs` — ✅ exist, need extension
- Name pool data — needs to be sourced (can use a public-domain name list or generate synthetically)

## Recommendation

Before starting Phase 8, the user should also consider whether to address the **higher-priority debt** identified in the Phase 7 audit:

- **0.5-FE (InterpretationSurface frontend)** — the meaning-engine backend works but nothing in the UI displays it. This is the user-visible "wow factor" of Gaffer and it's currently invisible. Strong argument for fixing this BEFORE Phase 8.
- **0.5 (real-data pipeline)** — the scraper works, build_world.py just needs the parser wired. 1-2 days of work would replace the 8-team sample world with real Big 5 rosters.

Phase 8 is technically sound to start now, but the user might get more value from making the existing features visible (frontend) and real (data pipeline) before adding more backend depth.
