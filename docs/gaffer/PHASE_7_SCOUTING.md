# Phase 7 — Scouting Progressive Reveal

## Goal

Replace the existing one-shot scouting reveal (where each completed assignment reveals a fixed set of attributes based on scout ability) with a **three-tier progressive reveal system** where repeated scouting of the same player deepens the manager's knowledge over time.

## Why

The current system has two problems:

1. **No accumulation.** Scouting the same player twice gives the same result — the second assignment adds nothing. Players have no reason to send multiple scouts to the same target.
2. **Binary reveal.** A scout either reveals 2, 3, 5, or 6 attributes based on ability — no notion of "deepening" knowledge. A great scout reveals everything in one trip; a bad scout never reveals more.

The progressive reveal system fixes both: each completed assignment advances the player's reveal tier (Surface → Detailed → Complete), and scout ability now affects accuracy (fuzz) rather than reveal depth.

## Scope (in scope)

- New `ScoutingKnowledge` struct stored on `Game` (keyed by player_id) tracking each player's reveal state for the user's manager
- New `RevealTier` enum: `Surface`, `Detailed`, `Complete`
- New module `crates/ofm_core/src/scouting/progressive_reveal.rs` with:
  - `advance_reveal_tier(knowledge)` — promotes tier after each completed assignment
  - `fuzz_attribute(value, judging_ability, rng)` — single source of truth for scout accuracy noise
  - `reveal_attributes_for_tier(player, knowledge, scout_judging_ability, rng)` — returns the set of revealed (fuzzed) attributes appropriate to the current tier
  - `reveal_potential_for_tier(player, knowledge, scout_judging_potential, rng)` — returns Option<fuzzed potential> or None if not yet revealed
  - `reveal_personality_for_tier(knowledge, player)` — returns Option<PersonalityProfile> or None
  - `should_show_narrative_traits(knowledge)` — bool
- Modifications to `process_scouting` in `scouting.rs`:
  - On each completed assignment, look up (or create) the player's `ScoutingKnowledge`
  - Call `advance_reveal_tier` to bump the tier
  - Build the report using the new reveal functions instead of the old single-shot reveal
- New Tauri commands:
  - `get_scouting_knowledge(player_id)` → returns the user's `ScoutingKnowledge` for that player (or `None`)
  - `get_scouting_summary()` → returns a list of all scouted players with their tier + last-scouted date
- Add scouting knowledge to `PlayerMeaningSnapshot` (so the UI can show what's revealed vs hidden)
- Tests: at least 15 new unit tests

## Scope (out of scope, deferred)

- Cross-manager scouting knowledge sharing (only user team for V1)
- Scout network / regional coverage (existing youth scouting already does this)
- Decaying knowledge over time (knowledge persists indefinitely in V1)
- "Stale" data flag (data is re-fuzzed each scouting trip, so always current at the player's last-scouted date)
- Comparison reports (e.g., "Player X is similar to Player Y")
- Recommendation engine (scout suggests players to target)

## Mechanic Details

### Reveal Tier Progression

| Completed assignments | Tier | Reveals |
|---|---|---|
| 0 | (none) | Name, position, club, age, nationality only (always visible) |
| 1 | Surface | + rough OVR band (Excellent/Very Good/Good/Average/Below Average) |
| 2 | Detailed | + 5 key position-relevant attributes (fuzzed), condition, morale, injury status |
| 3+ | Complete | + all 19 attributes (fuzzed), exact OVR, exact potential, Big Five personality, narrative_traits, stability tier label |

**Rules:**
- Tier never regresses — once you've seen Detailed, you keep Detailed even if you stop scouting
- Each completed assignment refreshes the data (re-fuzzes with the current scout's accuracy)
- The tier upgrades AFTER the assignment completes (so the 1st assignment reveals Surface, the 2nd reveals Detailed, etc.)

### Scout Ability Effects

`judging_ability` (current scouting skill):
- Affects FUZZ range on revealed attribute values
- 80+: ±2 noise
- 60-79: ±5 noise
- 40-59: ±8 noise
- <40: ±12 noise

`judging_potential` (potential-reading skill):
- >= 80: At Surface tier, also reveals potential BAND (World Class / Strong / Promising / Limited)
- >= 70: At Detailed tier, reveals exact potential
- <70: Potential only revealed at Complete tier

### Key Attributes by Position (Detailed tier reveals these 5)

| Position | Attributes revealed at Detailed |
|---|---|
| Goalkeeper | shot_stopping, commanding, playing_out, agility, composure |
| Defender | defending, aerial, power, anticipation, pace |
| Midfielder | passing, distribution, vision, engine, decisions |
| Forward | finishing, touch, pace, composure, aerial |

### Fuzz Persistence

Each attribute reveal stores the FUZZED value at the time of scouting. The fuzzed value is what the UI displays. Re-scouting the player (at any tier) re-fuzzes ALL revealed attributes, replacing stale values with fresh assessments.

This means: a scout with judging_ability=85 will give you more accurate readings than one with judging_ability=40, even at the same tier.

## Data Model

```rust
// In game.rs
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum RevealTier {
    #[default]
    Surface,
    Detailed,
    Complete,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ScoutingKnowledge {
    pub player_id: String,
    pub reveal_tier: RevealTier,
    pub times_scouted: u32,
    pub last_scouted_date: String,
    pub last_scout_id: String,
    pub last_judging_ability: u8,    // for re-fuzz reference
    pub last_judging_potential: u8,
    // Fuzzed attribute cache (last scout's reading)
    pub fuzzed_attributes: HashMap<String, u8>,
    pub fuzzed_ovr: Option<u8>,
    pub fuzzed_potential: Option<u8>,
    pub revealed_personality: Option<PersonalityProfile>,
    pub revealed_narrative_traits: Vec<String>,
    pub revealed_stability_label: Option<String>,
    pub known_condition: Option<u8>,
    pub known_morale: Option<u8>,
    pub known_injury: Option<String>,
}

// On Game struct:
#[serde(default)]
pub scouting_knowledge: HashMap<String, ScoutingKnowledge>,  // keyed by player_id
```

**Backward compatibility:** The `#[serde(default)]` ensures old saves load without the field; players scouted before Phase 7 will simply have no ScoutingKnowledge entry (effectively Surface tier with no completed assignments — first scout reveals Surface).

## Test Plan

15+ new unit tests:
1. `reveal_tier_starts_at_surface` — new player has no knowledge → Surface
2. `reveal_tier_advances_after_first_assignment` — 1 assignment → Surface, with times_scouted=1
3. `reveal_tier_advances_to_detailed_after_second` — 2 assignments → Detailed
4. `reveal_tier_advances_to_complete_after_third` — 3 assignments → Complete
5. `reveal_tier_caps_at_complete` — 5 assignments → still Complete
6. `fuzz_high_ability_low_noise` — judging_ability=85 → ±2 noise range
7. `fuzz_low_ability_high_noise` — judging_ability=20 → ±12 noise range
8. `fuzz_never_out_of_range` — fuzzed value always clamped to 1-99
9. `surface_tier_reveals_ovr_band_only` — no attributes, just OVR band string
10. `detailed_tier_reveals_5_position_attrs` — DEF reveals defending/aerial/power/anticipation/pace
11. `detailed_tier_reveals_condition_and_morale` — known_condition + known_morale populated
12. `complete_tier_reveals_all_19_attrs` — fuzzed_attributes has 19 entries
13. `complete_tier_reveals_personality` — revealed_personality populated
14. `complete_tier_reveals_narrative_traits` — revealed_narrative_traits populated
15. `potential_revealed_early_with_great_scout` — judging_potential=85 → potential band at Surface
16. `potential_hidden_with_poor_scout_at_surface` — judging_potential=50 → no potential at Surface
17. `re_scouting_refreshes_fuzzed_values` — second scout with different ability gives different fuzz
18. `scouting_knowledge_persists_across_assignments` — knowledge entry survives between assignments

## Files to Touch

| File | Change |
|---|---|
| `crates/ofm_core/src/game.rs` | Add `RevealTier`, `ScoutingKnowledge`, `scouting_knowledge` field on Game |
| `crates/ofm_core/src/scouting.rs` | Move to `scouting/mod.rs`, modify `process_scouting` |
| `crates/ofm_core/src/scouting/progressive_reveal.rs` | NEW — reveal logic + fuzz |
| `crates/ofm_core/src/interpretation/mod.rs` | Add `scouting_knowledge` field to `PlayerMeaningSnapshot` |
| `src-tauri/src/commands/transfers.rs` | Add `get_scouting_knowledge`, `get_scouting_summary` commands |
| `src-tauri/src/lib.rs` | Register new commands |
| `crates/ofm_core/tests/scouting_tests.rs` | Add 15+ new tests |

## Backward Compatibility

- No SQL migration (Game state is serialized as JSON via serde; new fields with `#[serde(default)]` work)
- Old saves load fine (no `scouting_knowledge` field → defaults to empty HashMap)
- Existing scouting commands (`send_scout`, `start_youth_scouting`, etc.) continue to work — the new logic is layered on top
- Existing scout report messages still generated — just with progressively more content
- Youth scouting is unchanged (separate system, doesn't track per-player reveal tiers)
