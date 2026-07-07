// Gaffer Phase 7 — Scouting Progressive Reveal
//
// Three-tier reveal system that deepens knowledge of a player over multiple
// scouting assignments. Tier progression:
//
//   Surface   (1 assignment)  — name, position, club, age, nationality, rough OVR band
//   Detailed  (2 assignments) — + 5 key position attrs (fuzzed), condition, morale, injury
//   Complete  (3+ assignments)— + all 19 attrs (fuzzed), exact OVR, exact potential,
//                                Big Five personality, narrative_traits, stability label
//
// Scout ability affects FUZZ (accuracy), not reveal depth. Re-scouting a player
// refreshes the fuzzed values with the current scout's accuracy.

use crate::game::{RevealTier, ScoutingKnowledge};
use domain::player::{PersonalityProfile, Player, PlayerAttributes, Position};
use rand::Rng;

/// All 19 Gaffer attribute names, in canonical order.
pub const ALL_ATTRIBUTE_NAMES: [&str; 19] = [
    "pace", "burst", "engine", "power", "agility",
    "passing", "distribution", "touch", "finishing", "defending", "aerial",
    "anticipation", "vision", "decisions", "composure", "leadership",
    "shot_stopping", "commanding", "playing_out",
];

/// Return the 5 key attributes to reveal at Detailed tier for a given position.
pub fn key_attributes_for_position(position: &Position) -> [&'static str; 5] {
    let group = position.to_group_position();
    match group {
        Position::Goalkeeper => [
            "shot_stopping", "commanding", "playing_out", "agility", "composure",
        ],
        Position::Defender => [
            "defending", "aerial", "power", "anticipation", "pace",
        ],
        Position::Midfielder => [
            "passing", "distribution", "vision", "engine", "decisions",
        ],
        Position::Forward => [
            "finishing", "touch", "pace", "composure", "aerial",
        ],
        _ => [
            "passing", "defending", "finishing", "pace", "composure",
        ],
    }
}

/// Compute the noise range (±) applied to revealed attribute values based on
/// the scout's `judging_ability`.
///
///   80+: ±2
///   60-79: ±5
///   40-59: ±8
///   <40: ±12
pub fn fuzz_noise_range(judging_ability: u8) -> i16 {
    if judging_ability >= 80 {
        2
    } else if judging_ability >= 60 {
        5
    } else if judging_ability >= 40 {
        8
    } else {
        12
    }
}

/// Apply fuzz noise to a single attribute value, clamping to 1-99.
pub fn fuzz_attribute(value: u8, judging_ability: u8, rng: &mut impl Rng) -> u8 {
    use rand::RngExt;
    let noise = fuzz_noise_range(judging_ability);
    let delta: i16 = rng.random_range(-noise..=noise);
    ((value as i16) + delta).clamp(1, 99) as u8
}

/// Get an attribute value by name from PlayerAttributes.
pub fn get_attribute(attrs: &PlayerAttributes, name: &str) -> u8 {
    match name {
        "pace" => attrs.pace,
        "burst" => attrs.burst,
        "engine" => attrs.engine,
        "power" => attrs.power,
        "agility" => attrs.agility,
        "passing" => attrs.passing,
        "distribution" => attrs.distribution,
        "touch" => attrs.touch,
        "finishing" => attrs.finishing,
        "defending" => attrs.defending,
        "aerial" => attrs.aerial,
        "anticipation" => attrs.anticipation,
        "vision" => attrs.vision,
        "decisions" => attrs.decisions,
        "composure" => attrs.composure,
        "leadership" => attrs.leadership,
        "shot_stopping" => attrs.shot_stopping,
        "commanding" => attrs.commanding,
        "playing_out" => attrs.playing_out,
        _ => 50,
    }
}

/// OVR band label for Surface tier reveal.
/// Returns one of: "Excellent", "Very Good", "Good", "Average", "Below Average"
pub fn ovr_band_label(ovr: u8) -> &'static str {
    if ovr >= 80 {
        "Excellent"
    } else if ovr >= 70 {
        "Very Good"
    } else if ovr >= 60 {
        "Good"
    } else if ovr >= 50 {
        "Average"
    } else {
        "Below Average"
    }
}

/// Potential band label (only revealed at Surface if judging_potential >= 80,
/// or at Detailed if judging_potential >= 70, or always at Complete).
/// Returns one of: "World Class", "Strong", "Promising", "Limited", or None
pub fn potential_band_label(potential: u8) -> &'static str {
    if potential >= 85 {
        "World Class"
    } else if potential >= 70 {
        "Strong"
    } else if potential >= 55 {
        "Promising"
    } else {
        "Limited"
    }
}

/// Whether the potential should be revealed at this tier/scout combination.
pub fn should_reveal_potential(tier: RevealTier, judging_potential: u8) -> bool {
    match tier {
        RevealTier::Surface => judging_potential >= 80,
        RevealTier::Detailed => judging_potential >= 70,
        RevealTier::Complete => true,
    }
}

/// Whether the personality (Big Five) should be revealed at this tier.
pub fn should_reveal_personality(tier: RevealTier) -> bool {
    matches!(tier, RevealTier::Complete)
}

/// Whether narrative_traits should be revealed at this tier.
pub fn should_reveal_narrative_traits(tier: RevealTier) -> bool {
    matches!(tier, RevealTier::Complete)
}

/// Whether the stability label should be revealed at this tier.
pub fn should_reveal_stability(tier: RevealTier) -> bool {
    matches!(tier, RevealTier::Complete)
}

/// Whether condition should be revealed.
pub fn should_reveal_condition(tier: RevealTier) -> bool {
    matches!(tier, RevealTier::Detailed | RevealTier::Complete)
}

/// Whether morale should be revealed.
pub fn should_reveal_morale(tier: RevealTier) -> bool {
    matches!(tier, RevealTier::Detailed | RevealTier::Complete)
}

/// Whether injury status should be revealed.
pub fn should_reveal_injury(tier: RevealTier) -> bool {
    matches!(tier, RevealTier::Detailed | RevealTier::Complete)
}

/// Update the ScoutingKnowledge after a completed assignment:
/// 1. Advance the reveal tier (Surface→Detailed→Complete, caps at Complete)
/// 2. Increment times_scouted
/// 3. Refresh fuzzed attribute cache using the current scout's accuracy
/// 4. Refresh condition/morale/injury/personality/narrative_traits/stability as appropriate
///
/// Returns the updated `ScoutingKnowledge` (also mutates in place).
pub fn update_knowledge_after_assignment(
    knowledge: &mut ScoutingKnowledge,
    player: &Player,
    scout_id: &str,
    judging_ability: u8,
    judging_potential: u8,
    date: &str,
    rng: &mut impl Rng,
) {
    // 1. Advance tier (AFTER the assignment — first assignment reveals Surface)
    //    The first time we scout, knowledge is created with tier=Surface (default).
    //    After 2nd assignment, advance to Detailed. After 3rd, advance to Complete.
    if knowledge.times_scouted >= 1 {
        // We've recorded at least 1 prior scout, so this new completion advances the tier
        knowledge.reveal_tier = knowledge.reveal_tier.advance();
    }
    knowledge.times_scouted = knowledge.times_scouted.saturating_add(1);
    knowledge.last_scouted_date = date.to_string();
    knowledge.last_scout_id = scout_id.to_string();
    knowledge.last_judging_ability = judging_ability;
    knowledge.last_judging_potential = judging_potential;

    let tier = knowledge.reveal_tier;
    let attrs = &player.attributes;

    // 2. Refresh fuzzed attributes based on tier
    knowledge.fuzzed_attributes.clear();
    match tier {
        RevealTier::Surface => {
            // No attributes revealed at Surface — just OVR band
        }
        RevealTier::Detailed => {
            // Reveal 5 key position attrs
            for attr_name in key_attributes_for_position(&player.position) {
                let actual = get_attribute(attrs, attr_name);
                let fuzzed = fuzz_attribute(actual, judging_ability, rng);
                knowledge.fuzzed_attributes.insert(attr_name.to_string(), fuzzed);
            }
        }
        RevealTier::Complete => {
            // Reveal all 19 attrs
            for attr_name in ALL_ATTRIBUTE_NAMES.iter() {
                let actual = get_attribute(attrs, attr_name);
                let fuzzed = fuzz_attribute(actual, judging_ability, rng);
                knowledge.fuzzed_attributes.insert(attr_name.to_string(), fuzzed);
            }
        }
    }

    // 3. OVR — always fuzzed (even at Surface we show the band, derived from fuzzed OVR)
    let ovr_noise = fuzz_noise_range(judging_ability);
    use rand::RngExt;
    let ovr_delta: i16 = rng.random_range(-ovr_noise..=ovr_noise);
    knowledge.fuzzed_ovr = Some(((player.ovr as i16) + ovr_delta).clamp(1, 99) as u8);

    // 4. Potential — only revealed under certain conditions
    if should_reveal_potential(tier, judging_potential) {
        let pot_noise = fuzz_noise_range(judging_potential);
        let pot_delta: i16 = rng.random_range(-pot_noise..=pot_noise);
        knowledge.fuzzed_potential = Some(((player.potential as i16) + pot_delta).clamp(1, 99) as u8);
    } else {
        knowledge.fuzzed_potential = None;
    }

    // 5. Condition / morale / injury
    if should_reveal_condition(tier) {
        knowledge.known_condition = Some(player.condition);
    } else {
        knowledge.known_condition = None;
    }
    if should_reveal_morale(tier) {
        knowledge.known_morale = Some(player.morale);
    } else {
        knowledge.known_morale = None;
    }
    if should_reveal_injury(tier) {
        knowledge.known_injury = player.injury.as_ref().map(|i| i.name.clone());
    } else {
        knowledge.known_injury = None;
    }

    // 6. Personality (Complete only)
    if should_reveal_personality(tier) {
        knowledge.revealed_personality = Some(player.personality.clone());
    } else {
        knowledge.revealed_personality = None;
    }

    // 7. Narrative traits (Complete only)
    if should_reveal_narrative_traits(tier) {
        knowledge.revealed_narrative_traits = player.narrative_traits.clone();
    } else {
        knowledge.revealed_narrative_traits.clear();
    }

    // 8. Stability label (Complete only)
    if should_reveal_stability(tier) {
        knowledge.revealed_stability_label = Some(player.stability_label().as_str().to_string());
    } else {
        knowledge.revealed_stability_label = None;
    }
}

/// Get or create the ScoutingKnowledge entry for a player.
pub fn get_or_create_knowledge<'a>(
    scouting_knowledge: &'a mut std::collections::HashMap<String, ScoutingKnowledge>,
    player_id: &str,
) -> &'a mut ScoutingKnowledge {
    scouting_knowledge.entry(player_id.to_string())
        .or_insert_with(|| ScoutingKnowledge::new(player_id))
}

// ============================================================================
// TESTS
// ============================================================================
#[cfg(test)]
mod tests {
    use super::*;
    use crate::game::{RevealTier, ScoutingKnowledge};
    use domain::player::{PersonalityProfile, Player, PlayerAttributes, Position};

    fn make_test_player(ovr: u8, potential: u8, position: Position) -> Player {
        let attrs = PlayerAttributes {
            pace: 60, burst: 60, engine: 60, power: 60, agility: 60,
            passing: 60, distribution: 60, touch: 60, finishing: 60,
            defending: 60, aerial: 60, anticipation: 60, vision: 60,
            decisions: 60, composure: 60, leadership: 60,
            shot_stopping: 60, commanding: 60, playing_out: 60,
        };
        let mut p = Player::new(
            "p1".to_string(),
            "Test Player".to_string(),
            "Test Player".to_string(),
            "2000-01-01".to_string(),
            "ENG".to_string(),
            position.clone(),
            attrs,
        );
        p.ovr = ovr;
        p.potential = potential;
        p.personality = PersonalityProfile::default();
        p
    }

    // ---- Reveal tier progression tests ----

    #[test]
    fn reveal_tier_advances_surface_to_detailed() {
        assert_eq!(RevealTier::Surface.advance(), RevealTier::Detailed);
    }

    #[test]
    fn reveal_tier_advances_detailed_to_complete() {
        assert_eq!(RevealTier::Detailed.advance(), RevealTier::Complete);
    }

    #[test]
    fn reveal_tier_caps_at_complete() {
        assert_eq!(RevealTier::Complete.advance(), RevealTier::Complete);
    }

    #[test]
    fn reveal_tier_label_works() {
        assert_eq!(RevealTier::Surface.label(), "Surface");
        assert_eq!(RevealTier::Detailed.label(), "Detailed");
        assert_eq!(RevealTier::Complete.label(), "Complete");
    }

    // ---- Fuzz tests ----

    #[test]
    fn fuzz_high_ability_low_noise() {
        assert_eq!(fuzz_noise_range(85), 2);
        assert_eq!(fuzz_noise_range(80), 2);
    }

    #[test]
    fn fuzz_medium_ability_medium_noise() {
        assert_eq!(fuzz_noise_range(60), 5);
        assert_eq!(fuzz_noise_range(79), 5);
    }

    #[test]
    fn fuzz_low_ability_high_noise() {
        assert_eq!(fuzz_noise_range(40), 8);
        assert_eq!(fuzz_noise_range(20), 12);
    }

    #[test]
    fn fuzz_never_out_of_range() {
        let mut rng = rand::rng();
        for _ in 0..1000 {
            let v = fuzz_attribute(50, 20, &mut rng); // worst scout, max noise
            assert!((1..=99).contains(&v), "fuzzed value {} out of range", v);
        }
        // Edge cases at the boundaries
        for _ in 0..1000 {
            let v = fuzz_attribute(1, 20, &mut rng);
            assert!((1..=99).contains(&v));
            let v = fuzz_attribute(99, 20, &mut rng);
            assert!((1..=99).contains(&v));
        }
    }

    // ---- OVR/potential band tests ----

    #[test]
    fn ovr_band_thresholds() {
        assert_eq!(ovr_band_label(85), "Excellent");
        assert_eq!(ovr_band_label(80), "Excellent");
        assert_eq!(ovr_band_label(79), "Very Good");
        assert_eq!(ovr_band_label(70), "Very Good");
        assert_eq!(ovr_band_label(69), "Good");
        assert_eq!(ovr_band_label(60), "Good");
        assert_eq!(ovr_band_label(59), "Average");
        assert_eq!(ovr_band_label(50), "Average");
        assert_eq!(ovr_band_label(49), "Below Average");
    }

    #[test]
    fn potential_band_thresholds() {
        assert_eq!(potential_band_label(90), "World Class");
        assert_eq!(potential_band_label(85), "World Class");
        assert_eq!(potential_band_label(84), "Strong");
        assert_eq!(potential_band_label(70), "Strong");
        assert_eq!(potential_band_label(69), "Promising");
        assert_eq!(potential_band_label(55), "Promising");
        assert_eq!(potential_band_label(54), "Limited");
    }

    // ---- Reveal policy tests ----

    #[test]
    fn potential_revealed_at_surface_only_with_great_scout() {
        assert!(should_reveal_potential(RevealTier::Surface, 85));
        assert!(!should_reveal_potential(RevealTier::Surface, 50));
    }

    #[test]
    fn potential_revealed_at_detailed_with_good_scout() {
        assert!(should_reveal_potential(RevealTier::Detailed, 75));
        assert!(!should_reveal_potential(RevealTier::Detailed, 50));
    }

    #[test]
    fn potential_always_revealed_at_complete() {
        assert!(should_reveal_potential(RevealTier::Complete, 0));
        assert!(should_reveal_potential(RevealTier::Complete, 100));
    }

    #[test]
    fn personality_only_revealed_at_complete() {
        assert!(!should_reveal_personality(RevealTier::Surface));
        assert!(!should_reveal_personality(RevealTier::Detailed));
        assert!(should_reveal_personality(RevealTier::Complete));
    }

    #[test]
    fn narrative_traits_only_revealed_at_complete() {
        assert!(!should_reveal_narrative_traits(RevealTier::Surface));
        assert!(!should_reveal_narrative_traits(RevealTier::Detailed));
        assert!(should_reveal_narrative_traits(RevealTier::Complete));
    }

    #[test]
    fn condition_morale_injury_revealed_at_detailed_and_complete() {
        assert!(!should_reveal_condition(RevealTier::Surface));
        assert!(should_reveal_condition(RevealTier::Detailed));
        assert!(should_reveal_condition(RevealTier::Complete));

        assert!(!should_reveal_morale(RevealTier::Surface));
        assert!(should_reveal_morale(RevealTier::Detailed));

        assert!(!should_reveal_injury(RevealTier::Surface));
        assert!(should_reveal_injury(RevealTier::Detailed));
    }

    // ---- Key attribute tests ----

    #[test]
    fn key_attrs_for_defender() {
        let attrs = key_attributes_for_position(&Position::Defender);
        assert_eq!(attrs, ["defending", "aerial", "power", "anticipation", "pace"]);
    }

    #[test]
    fn key_attrs_for_forward() {
        let attrs = key_attributes_for_position(&Position::Forward);
        assert_eq!(attrs, ["finishing", "touch", "pace", "composure", "aerial"]);
    }

    #[test]
    fn key_attrs_for_goalkeeper() {
        let attrs = key_attributes_for_position(&Position::Goalkeeper);
        assert_eq!(attrs, ["shot_stopping", "commanding", "playing_out", "agility", "composure"]);
    }

    #[test]
    fn key_attrs_for_midfielder() {
        let attrs = key_attributes_for_position(&Position::Midfielder);
        assert_eq!(attrs, ["passing", "distribution", "vision", "engine", "decisions"]);
    }

    // ---- update_knowledge_after_assignment tests ----

    #[test]
    fn first_assignment_yields_surface_tier() {
        let player = make_test_player(70, 85, Position::Midfielder);
        let mut knowledge = ScoutingKnowledge::new("p1");
        let mut rng = rand::rng();
        update_knowledge_after_assignment(&mut knowledge, &player, "scout1", 70, 70, "2024-01-01", &mut rng);
        assert_eq!(knowledge.reveal_tier, RevealTier::Surface);
        assert_eq!(knowledge.times_scouted, 1);
        assert!(knowledge.fuzzed_attributes.is_empty()); // Surface reveals no attrs
        assert!(knowledge.fuzzed_ovr.is_some()); // OVR is always fuzzed
        assert!(!should_reveal_potential(knowledge.reveal_tier, 70)); // judging_potential=70 not enough at Surface
        assert!(knowledge.known_condition.is_none());
    }

    #[test]
    fn second_assignment_advances_to_detailed() {
        let player = make_test_player(70, 85, Position::Defender);
        let mut knowledge = ScoutingKnowledge::new("p1");
        let mut rng = rand::rng();
        // First scout
        update_knowledge_after_assignment(&mut knowledge, &player, "scout1", 70, 70, "2024-01-01", &mut rng);
        // Second scout
        update_knowledge_after_assignment(&mut knowledge, &player, "scout1", 70, 70, "2024-01-08", &mut rng);
        assert_eq!(knowledge.reveal_tier, RevealTier::Detailed);
        assert_eq!(knowledge.times_scouted, 2);
        assert_eq!(knowledge.fuzzed_attributes.len(), 5); // DEF has 5 key attrs
        // Check the DEF key attrs are present
        for attr in key_attributes_for_position(&Position::Defender) {
            assert!(knowledge.fuzzed_attributes.contains_key(attr), "missing {} in Detailed tier", attr);
        }
        assert!(knowledge.known_condition.is_some());
        assert!(knowledge.known_morale.is_some());
    }

    #[test]
    fn third_assignment_advances_to_complete() {
        let player = make_test_player(70, 85, Position::Forward);
        let mut knowledge = ScoutingKnowledge::new("p1");
        let mut rng = rand::rng();
        for i in 0..3 {
            update_knowledge_after_assignment(&mut knowledge, &player, "scout1", 70, 70, &format!("2024-01-{:02}", i + 1), &mut rng);
        }
        assert_eq!(knowledge.reveal_tier, RevealTier::Complete);
        assert_eq!(knowledge.times_scouted, 3);
        assert_eq!(knowledge.fuzzed_attributes.len(), 19); // all 19 attrs
        assert!(knowledge.revealed_personality.is_some());
        assert!(knowledge.revealed_stability_label.is_some());
    }

    #[test]
    fn fourth_assignment_keeps_complete() {
        let player = make_test_player(70, 85, Position::Midfielder);
        let mut knowledge = ScoutingKnowledge::new("p1");
        let mut rng = rand::rng();
        for i in 0..4 {
            update_knowledge_after_assignment(&mut knowledge, &player, "scout1", 70, 70, &format!("2024-01-{:02}", i + 1), &mut rng);
        }
        assert_eq!(knowledge.reveal_tier, RevealTier::Complete);
        assert_eq!(knowledge.times_scouted, 4);
    }

    #[test]
    fn re_scouting_refreshes_fuzzed_values() {
        let player = make_test_player(70, 85, Position::Midfielder);
        let mut knowledge = ScoutingKnowledge::new("p1");
        let mut rng = rand::rng();
        // First scout with poor ability (high noise)
        update_knowledge_after_assignment(&mut knowledge, &player, "scout1", 30, 30, "2024-01-01", &mut rng);
        update_knowledge_after_assignment(&mut knowledge, &player, "scout1", 30, 30, "2024-01-08", &mut rng);
        let detailed_fuzz_1 = knowledge.fuzzed_attributes.get("passing").copied();
        // Re-scout with same scout
        update_knowledge_after_assignment(&mut knowledge, &player, "scout1", 30, 30, "2024-01-15", &mut rng);
        let detailed_fuzz_2 = knowledge.fuzzed_attributes.get("passing").copied();
        // Both should be Some (Detailed tier) — values may or may not differ due to RNG
        assert!(detailed_fuzz_1.is_some());
        assert!(detailed_fuzz_2.is_some());
        // Re-fuzz should produce a value in valid range
        if let (Some(v1), Some(v2)) = (detailed_fuzz_1, detailed_fuzz_2) {
            assert!((1..=99).contains(&v1));
            assert!((1..=99).contains(&v2));
        }
    }

    #[test]
    fn great_scout_reveals_potential_at_surface() {
        let player = make_test_player(70, 85, Position::Midfielder);
        let mut knowledge = ScoutingKnowledge::new("p1");
        let mut rng = rand::rng();
        // judging_potential=85 → reveals potential even at Surface
        update_knowledge_after_assignment(&mut knowledge, &player, "scout1", 80, 85, "2024-01-01", &mut rng);
        assert_eq!(knowledge.reveal_tier, RevealTier::Surface);
        assert!(knowledge.fuzzed_potential.is_some(), "great scout should reveal potential at Surface");
    }

    #[test]
    fn poor_scout_hides_potential_at_surface() {
        let player = make_test_player(70, 85, Position::Midfielder);
        let mut knowledge = ScoutingKnowledge::new("p1");
        let mut rng = rand::rng();
        // judging_potential=50 → no potential reveal at Surface
        update_knowledge_after_assignment(&mut knowledge, &player, "scout1", 80, 50, "2024-01-01", &mut rng);
        assert_eq!(knowledge.reveal_tier, RevealTier::Surface);
        assert!(knowledge.fuzzed_potential.is_none(), "poor scout should not reveal potential at Surface");
    }

    #[test]
    fn complete_tier_reveals_all_19_attributes() {
        let player = make_test_player(70, 85, Position::Midfielder);
        let mut knowledge = ScoutingKnowledge::new("p1");
        let mut rng = rand::rng();
        for i in 0..3 {
            update_knowledge_after_assignment(&mut knowledge, &player, "scout1", 70, 70, &format!("2024-01-{:02}", i + 1), &mut rng);
        }
        for attr in ALL_ATTRIBUTE_NAMES.iter() {
            assert!(knowledge.fuzzed_attributes.contains_key(*attr), "missing {} at Complete tier", attr);
        }
    }

    #[test]
    fn knowledge_persists_across_assignments() {
        let player = make_test_player(70, 85, Position::Midfielder);
        let mut knowledge = ScoutingKnowledge::new("p1");
        let mut rng = rand::rng();
        // First scout — Surface
        update_knowledge_after_assignment(&mut knowledge, &player, "scout1", 70, 70, "2024-01-01", &mut rng);
        assert_eq!(knowledge.last_scouted_date, "2024-01-01");
        assert_eq!(knowledge.last_scout_id, "scout1");
        // Second scout — Detailed, date updated
        update_knowledge_after_assignment(&mut knowledge, &player, "scout2", 75, 75, "2024-01-15", &mut rng);
        assert_eq!(knowledge.last_scouted_date, "2024-01-15");
        assert_eq!(knowledge.last_scout_id, "scout2");
        assert_eq!(knowledge.last_judging_ability, 75);
    }
}
