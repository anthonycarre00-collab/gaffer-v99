# Phase 6 — Training Overhaul

## Goal

Layer three new development mechanics on top of the existing daily training loop:

1. **Stability Guard** — low-stability players regress under pressure; high-stability players are immune.
2. **Plateau System** — players near their potential ceiling get reduced growth probability.
3. **Personality Effects** — Big Five personality axes modulate growth and regression rates.
4. **Per-Position Focus Bonus** — training focus matching a player's position needs gives bonus growth.

This is an **overhaul of the existing `crates/ofm_core/src/training.rs`**, not a greenfield build. The existing daily loop (`process_training` → `train_player` → `apply_focus_gains` → `try_gain` → `refresh_player_derived`) is preserved; the new mechanics slot in as multipliers to the existing `gain` probability and as additional regression rolls.

## Scope (in scope)

- New module `crates/ofm_core/src/training/development.rs` containing:
  - `stability_pressure_factor(player, game)` → `f64` (0.0–1.5 multiplier on regression chance)
  - `plateau_growth_factor(player)` → `f64` (0.5–1.0 multiplier on growth probability)
  - `personality_growth_mod(player)` → `f64` (0.7–1.3 multiplier on growth)
  - `position_focus_bonus(player, focus)` → `f64` (0.8–1.3 multiplier on growth)
- Modifications to `train_player` in `training.rs`:
  - Apply the three growth modifiers (plateau, personality, position) to the `gain` value
  - Apply stability pressure regression roll: if player is under pressure AND low-stability AND RNG hits, decrement a random attribute by 1
- Surface four new fields in `PlayerMeaningSnapshot` (interpretation/mod.rs):
  - `development_trajectory`: `Rising | Peaked | Plateaued | Declining`
  - `growth_modifier_personality`: `f64` (visible to player)
  - `growth_modifier_position_match`: `f64` (visible to player)
  - `regression_risk_stability`: `f64` (visible to player)
- Tests: at least 12 new unit tests covering each mechanic in isolation
- No DB migration (no new persistent fields — plateau is computed from `potential - ovr`)

## Scope (out of scope, deferred to later phases)

- Individual training plans (per-player target attributes)
- Mentor/tutor system (veterans boosting youth growth)
- Position retraining (changing natural_position via training)
- Training-ground injuries (separate from match injuries)
- Attribute history / development log persistence (would need DB migration)
- Per-group intensity (only per-team today)
- Youth academy integration (Phase 8)

## Mechanic Details

### 1. Stability Guard

**Concept:** A player's hidden `stability_modifier` (0–100) determines how they respond to pressure situations. Low-stability players regress; high-stability players hold form.

**Pressure triggers (any one):**
- `player.morale < 40` (personal morale crisis)
- Squad harmony (SquadPulse) < 50 (team in turmoil)
- Recent losing streak (last 3 matches all losses) — proxied via `morale < 40` for simplicity in V1

**Regression formula:**
```
base_regression_prob = 0.05  (5% per training session under pressure)
stability_factor = (50 - stability_modifier) / 50  // -1.0 to +1.0
  → if stability_modifier = 100, factor = -1.0 → no regression (immune)
  → if stability_modifier = 50,  factor = 0.0   → base 5% only
  → if stability_modifier = 0,   factor = +1.0  → 10% regression chance
final_regression_prob = base_regression_prob * (1.0 + stability_factor.clamp(0.0, 2.0))
```

**Neuroticism modulates stability penalty:**
- `neuroticism >= 70`: regression chance × 1.5 (already brittle, pressure hits harder)
- `neuroticism < 30`: regression chance × 0.5 (resilient personality softens low stability)

**Regression effect:** When triggered, pick ONE random attribute from the player's "main" attrs (per position) and decrement by 1. Cannot drop below 5.

### 2. Plateau System

**Concept:** Players close to their potential ceiling should plateau — growth slows as they approach their max.

**Plateau state (computed, not stored):**
```
gap = potential - ovr
if gap <= 1 AND age >= 28: plateau_factor = 0.4   // near ceiling, veteran
elif gap <= 2 AND age >= 26: plateau_factor = 0.6  // near ceiling, entering prime
elif gap <= 3: plateau_factor = 0.8                 // approaching ceiling
else: plateau_factor = 1.0                          // normal growth
```

Players exactly at their potential (`ovr == potential`) already get zero growth from the existing gate at training.rs:292; the plateau system SLOWS growth before that hard stop.

### 3. Personality Effects on Growth

**Conscientiousness** (work ethic, discipline):
- `>= 70`: growth × 1.25 (extra 25% gain probability)
- `< 30`: growth × 0.75 (lazy, 25% slower growth)
- else: × 1.0

**Openness** (creativity, adaptability):
- `>= 70`: enables "cross-training" — 30% of the focus gain leaks to one OUTSIDE-OF-FOCUS attribute per session. Simulated as a flat × 1.10 growth multiplier (simpler than tracking leak).
- `< 30`: × 0.90 (rigid, narrow development)
- else: × 1.0

**Combined personality_growth_mod = conscientiousness_mod × openness_mod** (range ~0.675 to 1.375)

### 4. Per-Position Focus Bonus

**Concept:** Training is more effective when the focus matches what the player's position actually needs.

**Mapping (using existing Position enum):**
| Position group | Best focus | Worst focus |
|---|---|---|
| Goalkeeper | (any — GKs benefit from Physical/Tactical/Recovery) | Attacking |
| Defender | Defending | Attacking |
| Midfielder | Technical / Tactical | (none strongly penalized) |
| Forward | Attacking | Defending |

**Bonus formula:**
- Best focus for position: × 1.30
- Neutral focus: × 1.00
- Worst focus for position: × 0.80

### Combined Growth Formula (V2)

```rust
let gain = 0.15
    * intensity_mult        // existing
    * age_factor            // existing
    * coaching_mult         // existing
    * specialization_mult   // existing
    * plateau_factor        // NEW
    * personality_growth_mod // NEW
    * position_focus_bonus;  // NEW
```

### Combined Regression (new path)

After existing gains, if player is under pressure AND has low stability_modifier, roll for regression:
```rust
if is_under_pressure(player, game) && player.stability_modifier < 70 {
    let neuroticism_mult = if player.personality.neuroticism >= 70 { 1.5 }
                          else if player.personality.neuroticism < 30 { 0.5 }
                          else { 1.0 };
    let stability_factor = (50 - player.stability_modifier as i16).max(0) as f64 / 50.0;
    let regression_prob = 0.05 * (1.0 + stability_factor) * neuroticism_mult;
    if rng.gen::<f64>() < regression_prob {
        decrement_random_main_attribute(player, rng);
    }
}
```

## Test Plan

12+ new unit tests:
1. `stability_guard_no_regression_when_immune` — stability=100, no regression even under pressure
2. `stability_guard_regresses_when_low_stability_and_pressure` — stability=10, morale=20 → regression possible
3. `stability_guard_no_regression_when_not_under_pressure` — stability=10 but morale=80 → no regression
4. `stability_guard_neuroticism_amplifies_regression` — neuroticism=90 doubles regression chance
5. `stability_guard_neuroticism_softens_regression` — neuroticism=20 halves regression chance
6. `plateau_factor_full_when_far_from_potential` — gap=10 → factor=1.0
7. `plateau_factor_reduced_near_ceiling` — gap=2, age=27 → factor=0.6
8. `plateau_factor_minimum_at_ceiling_veteran` — gap=1, age=30 → factor=0.4
9. `personality_growth_conscientious_high_boosts` — C=80 → mod=1.25
10. `personality_growth_conscientious_low_penalizes` — C=20 → mod=0.75
11. `personality_growth_openness_high_boosts` — O=80 → mod=1.10
12. `position_focus_defender_defending_bonus` — DEF + Defending → 1.30
13. `position_focus_forward_defending_penalty` — FWD + Defending → 0.80
14. `position_focus_midfielder_neutral` — MID + any non-worst → 1.00
15. `combined_growth_doesnt_exceed_sane_bounds` — all bonuses stacked, gain stays < 1.0

## Files to Touch

| File | Change |
|---|---|
| `crates/ofm_core/src/training/mod.rs` (rename from training.rs) | Re-export new module |
| `crates/ofm_core/src/training.rs` | Move to `training/mod.rs`, modify `train_player` |
| `crates/ofm_core/src/training/development.rs` | NEW — 4 helper functions |
| `crates/ofm_core/src/interpretation/mod.rs` | Add 4 fields to `PlayerMeaningSnapshot` |
| `crates/ofm_core/src/lib.rs` | Re-export new module |
| `crates/ofm_core/tests/training_tests.rs` | Add 12+ new tests |

## Backward Compatibility

- No DB migration (no new persistent fields)
- No frontend changes required (existing UI continues to work — new snapshot fields are additive)
- Existing tests must still pass (24 in training_tests.rs + 13 in ai_training.rs)
- `potential > ovr` gate preserved
- AI fatigue guard preserved
- `refresh_player_derived` still called after every session
