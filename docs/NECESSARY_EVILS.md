# Gaffer — Necessary Evils

**Date:** 2026-07-13
**Commit:** `13b419e` (origin/main)
**Purpose:** Document required fixes to make the bundled world DB load correctly and produce a playable, living game world. These are prerequisites before the Wave A–F fixes from `GAFFER_V995_FORENSIC_ANALYSIS.md` can begin.

---

## Why These Exist

The bundled `gaffer_world.json` (8.5MB, 5,324 players, 184 teams) was built from FIFA 22 data and has several mismatches with the current Gaffer schema. The serde alias approach used in commit `13b419e` was a band-aid — it makes the DB load, but it preserves semantically incorrect data that will cause gameplay issues.

These fixes address the root cause: the DB data doesn't match what the game engine expects, and the conversion/load pipeline doesn't normalise it.

---

## NE-1: Replace FIFA traits with compute_traits() (HIGH PRIORITY)

### Problem
The DB contains 17 FIFA-style trait names (`Dribbler`, `Playmaker`, `Poacher`, `Engine`, `Strength`, `Tackling`, `Clinical Finisher`, `Aerial Threat`, `Crosser`, `Distance Shooter`, `FK Specialist`, `Complete Defender`, `Complete Midfielder`, `Complete Forward`, `Acrobat`, `Tactician`, `Speedster`). Only `Speedster` matches the Gaffer enum exactly.

Commit `13b419e` added `#[serde(alias = "...")]` to map these to the closest Gaffer variant. But the mappings are semantically wrong:
- `Poacher` → `Wonderkid` (a goal-hanger ≠ a young talent)
- `Complete Midfielder` → `CompleteForward` (midfielder ≠ forward)
- `Aerial Threat` → `Rock` (heading ability ≠ defensive solidity)
- `Crosser` → `SetPieceSpecialist` (crossing ≠ set pieces)

Additionally, only 634 of 5,324 players (12%) have DB traits. The `compute_traits()` function in `player.rs:839-862` can derive Gaffer-native traits from the 19 attributes, which are complete for all 5,324 players. This produces 1,562 players with traits — 2.5× more than the DB provides.

### Fix
1. **Remove the serde aliases** from `PlayerTrait` enum (revert the band-aid from `13b419e`)
2. **Add `#[serde(other)]` variant** to `PlayerTrait` that catches unknown FIFA trait names and silently drops them — this prevents parse failures without preserving bad data
3. **Call `compute_traits()` during world load** to re-derive all traits from attributes — this replaces FIFA traits with correct Gaffer-native traits
4. This happens in the world load pipeline (`world_io.rs` or the post-load normalisation in `game.rs`)

### Systems Affected
- `domain/src/player.rs` — `PlayerTrait` enum, `compute_traits()` function
- `engine/src/shared.rs:98-180` — `trait_bonus()` reads trait names (already uses Gaffer names)
- `ofm_core/src/player_rating.rs` — `refresh_player_derived()` calls `compute_traits()`
- `ofm_core/src/generator/world_io.rs` — world load pipeline
- Frontend `src/lib/attributeInterpretation.ts` — trait display (already uses Gaffer names)

### Verification
- World DB loads without parse errors
- All 5,324 players have traits derived from their attributes
- `trait_bonus()` in the engine produces correct modifiers for Speedster, Powerhouse, etc.
- No FIFA trait names appear in any save file after load

---

## NE-2: Fix team wage_budget (HIGH PRIORITY)

### Problem
Every team in the DB has `wage_budget = £500,000/week`. But actual squad wages are:
- PSG: £3M/week (6x over budget)
- Man City: £3.6M/week (7.2x over budget)
- Man United: £3.4M/week (6.8x over budget)
- Atlético Madrid: £1.78M/week (3.6x over budget)

This means every club starts the game massively over their wage budget. The board will immediately complain, finances will be in crisis, and the user will be forced to sell players on day one.

### Fix
During world load (or in the post-load normalisation), set `wage_budget` to:
```rust
wage_budget = (total_squad_wages * 1.15) as i64  // 15% headroom
```

This gives each club a realistic wage budget based on their actual squad costs, with a small buffer for new signings.

### Systems Affected
- `ofm_core/src/generator/world_io.rs` — world load pipeline
- `ofm_core/src/finances.rs` — weekly finance processing reads `wage_budget`
- `ofm_core/src/contracts.rs` — contract renewal checks `wage_budget`
- Frontend `src/components/finances/FinancesTab.tsx` — displays wage budget vs actual

### Verification
- No team starts over their wage budget
- Wage budget is proportional to squad quality (elite clubs have higher budgets)
- Board finance warnings don't fire on day one

---

## NE-3: Generate manager personalities during staff→manager conversion (HIGH PRIORITY)

### Problem
The DB has 0 `Game.managers` entries. The game converts Manager-role staff (184 entries) into `Manager` entities at load time. But the staff records have:
- `reputation` on a 0-100 scale (game expects 300-900)
- No `personality` field (V99.4 T1.7: tactical style, transfer philosophy, etc.)
- No `career_stats` or `career_history`

This means all AI managers will:
- Have default personality (Balanced/SquadBuilder/Reserved, all 50s)
- Feel identical to each other
- Not use the V99.4 T1.7 personality system

### Fix
During the staff→manager conversion (in the world load pipeline):
1. **Scale reputation** from 0-100 to 300-900: `manager_reputation = 300 + (staff_reputation * 6)`
2. **Call `generate_random_personality()`** from `ai_hiring.rs` to assign a personality based on the manager's reputation
3. **Initialise empty `career_stats` and `career_history`** (the game populates these during play)

### Systems Affected
- `ofm_core/src/generator/world_io.rs` or `ofm_core/src/game.rs` — wherever staff→manager conversion happens
- `ofm_core/src/ai_hiring.rs:79` — `generate_random_personality()` function
- `domain/src/manager.rs` — `Manager` struct, `ManagerPersonality`
- `ofm_core/src/ai_training.rs` — reads manager personality (once NE-1/6 from forensic analysis is wired)
- `ofm_core/src/contracts.rs` — `tactics_effectiveness_multiplier()` reads personality

### Verification
- Each AI manager has a unique personality
- Reputation values are in the 300-900 range
- `tactics_effectiveness_multiplier()` returns varied values per manager
- Manager personalities survive save/reload (once P0-2 persistence fix is applied)

---

## NE-4: Fix team transfer_budget (MEDIUM PRIORITY)

### Problem
Every team has `transfer_budget = £5,000,000` regardless of club size. Real-world transfer budgets range from £5M (lower-tier) to £200M+ (elite).

### Fix
During world load, scale transfer_budget by reputation:
```rust
transfer_budget = (reputation as i64 - 300) * 250_000  // 300 rep = £0, 900 rep = £150M
```
Or simpler: `transfer_budget = finance / 5` (20% of current cash reserves available for transfers).

### Systems Affected
- Same as NE-2

---

## NE-5: Fix manager reputation scale (MEDIUM PRIORITY)

### Problem
Staff records use `reputation` on a 0-100 scale. The game's `Manager` struct expects 300-900 (see `manager.rs:rating()` which clamps to this range). A manager with staff reputation 85 becomes game reputation 85 — below the minimum 300, making them rated as terrible.

### Fix
Scale during conversion: `manager_reputation = 300 + (staff_reputation * 6)`
- Staff rep 50 → Game rep 600 (mid-table)
- Staff rep 85 → Game rep 810 (elite)
- Staff rep 100 → Game rep 900 (world-class)

This is part of NE-3 but documented separately for clarity.

---

## NE-6: Verify world DB loads cleanly (GATE)

### Problem
After all NE fixes, the world DB must load without any parse errors. Any remaining unknown variants, missing fields, or type mismatches will surface as runtime errors.

### Fix
After implementing NE-1 through NE-5, test by:
1. Running the game
2. Starting a new game
3. Verifying the world loads (check console logs for `[world]` messages)
4. Verifying the team selection screen shows 184 teams
5. Verifying a career can be started

### Verification
- No `[world] JSON parse failed` errors in console
- No `CRITICAL: Bundled world DB exists but failed to load` errors
- Team selection screen renders with teams
- Starting a career navigates to the dashboard

---

## Implementation Order

1. **NE-1** (traits) — must be first, it unblocks world load
2. **NE-2** (wage budget) — quick fix, high impact on playability
3. **NE-3** (manager personalities) — depends on understanding the staff→manager conversion code
4. **NE-4** (transfer budget) — quick fix, pairs with NE-2
5. **NE-5** (reputation scale) — part of NE-3 but separate concern
6. **NE-6** (verification gate) — must pass before any other work

After all NE fixes pass verification, proceed to Wave A (P0 persistence fixes) from `GAFFER_V995_FORENSIC_ANALYSIS.md`.

---

## What NOT to Do

- **Do NOT regenerate the DB** — the 8.5MB `gaffer_world.json` is the authoritative source of real player/team data. Regenerating it would require re-running the FIFA data pipeline, which is out of scope.
- **Do NOT modify the DB file directly** — fixes should be in the load/conversion code, not in the JSON file. This keeps the DB as the source of truth and the code as the adapter.
- **Do NOT add more serde aliases** — the alias approach preserves bad data. Use `#[serde(other)]` to drop unknown variants, then re-derive correct data from the attribute system.
- **Do NOT skip verification** — each fix must be tested by loading the world and checking the console logs.

---

*This document is the prerequisite checklist before Wave A–F implementation begins.*
