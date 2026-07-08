// Gaffer Phase 6 — Training Overhaul: Development Mechanics
//
// Four new helpers that modify the base training growth probability:
//   1. stability_pressure_factor  — low-stability players REGRESS under pressure
//   2. plateau_growth_factor      — players near potential ceiling have reduced growth
//   3. personality_growth_mod     — Big Five (Conscientiousness, Openness) modulates growth
//   4. position_focus_bonus       — training focus matching position = bonus growth
//
// All factors are pure functions of player state (no Game access needed except
// for stability_pressure which needs squad morale/SquadPulse context).

use domain::player::{Player, Position};
use domain::team::TrainingFocus;
use rand::Rng;

// ============================================================================
// 1. STABILITY PRESSURE — regression under pressure
// ============================================================================

/// Whether a player is currently "under pressure" — proxied via low personal morale.
/// V1 keeps this simple: morale < 40 = under pressure.
/// Future versions can incorporate SquadPulse, recent losing streaks, media criticism.
pub fn is_under_pressure(player: &Player) -> bool {
    player.morale < 40
}

/// Compute the probability (0.0–1.0) that a low-stability player regresses this session.
///
/// Formula:
///   base_prob = 0.05  (5% per session under pressure)
///   stability_factor = (50 - stability_modifier).max(0) / 50  → 0.0 (stable) to 1.0 (brittle)
///   neuroticism_mult = 1.5 if N >= 70, 0.5 if N < 30, else 1.0
///   regression_prob = base_prob * (1.0 + stability_factor) * neuroticism_mult
///
/// High-stability players (>= 70) are IMMUNE — always returns 0.0.
/// Players not under pressure — always returns 0.0.
pub fn regression_probability(player: &Player) -> f64 {
    if !is_under_pressure(player) {
        return 0.0;
    }
    if player.stability_modifier >= 70 {
        return 0.0; // High-stability players are immune to regression
    }
    let stability_factor = (50i16 - player.stability_modifier as i16).max(0) as f64 / 50.0;
    let neuroticism_mult = if player.personality.neuroticism >= 70 {
        1.5
    } else if player.personality.neuroticism < 30 {
        0.5
    } else {
        1.0
    };
    0.05 * (1.0 + stability_factor) * neuroticism_mult
}

/// If the regression roll hits, decrement ONE random "main" attribute for the player's
/// position by 1. Cannot drop below 5 (preserve a baseline).
pub fn apply_regression(player: &mut Player, rng: &mut impl Rng) {
    use rand::RngExt;
    let group = player.position.to_group_position();
    // Pick one of the position's "main" attributes at random
    let attr_idx: u8 = rng.random_range(0..4);
    let target_attr: &mut u8 = match group {
        Position::Goalkeeper => match attr_idx {
            0 => &mut player.attributes.shot_stopping,
            1 => &mut player.attributes.commanding,
            2 => &mut player.attributes.playing_out,
            _ => &mut player.attributes.agility,
        },
        Position::Defender => match attr_idx {
            0 => &mut player.attributes.defending,
            1 => &mut player.attributes.aerial,
            2 => &mut player.attributes.power,
            _ => &mut player.attributes.anticipation,
        },
        Position::Midfielder => match attr_idx {
            0 => &mut player.attributes.passing,
            1 => &mut player.attributes.distribution,
            2 => &mut player.attributes.vision,
            _ => &mut player.attributes.engine,
        },
        Position::Forward => match attr_idx {
            0 => &mut player.attributes.finishing,
            1 => &mut player.attributes.touch,
            2 => &mut player.attributes.pace,
            _ => &mut player.attributes.composure,
        },
        _ => &mut player.attributes.composure,
    };
    if *target_attr > 5 {
        *target_attr -= 1;
    }
}

// ============================================================================
// 2. PLATEAU GROWTH FACTOR — slow growth near ceiling
// ============================================================================

/// Players near their potential ceiling get reduced growth probability.
///
/// Formula:
///   gap = potential - ovr
///   if gap <= 1 AND age >= 28: 0.4   (veteran near ceiling)
///   elif gap <= 2 AND age >= 26: 0.6 (entering prime, near ceiling)
///   elif gap <= 3: 0.8              (approaching ceiling)
///   else: 1.0                        (normal growth)
pub fn plateau_growth_factor(player: &Player, age: u32) -> f64 {
    let gap = player.potential.saturating_sub(player.ovr);
    if gap <= 1 && age >= 28 {
        0.4
    } else if gap <= 2 && age >= 26 {
        0.6
    } else if gap <= 3 {
        0.8
    } else {
        1.0
    }
}

// ============================================================================
// 3. PERSONALITY GROWTH MOD — Big Five modulates growth
// ============================================================================

/// Big Five personality axes that affect training growth:
///   Conscientiousness (work ethic):
///     >= 70: × 1.25  (25% bonus — disciplined trainer)
///     < 30:  × 0.75  (25% penalty — lazy)
///     else:  × 1.0
///   Openness (creativity, adaptability):
///     >= 70: × 1.10  (10% bonus — cross-trains, picks up new things)
///     < 30:  × 0.90  (10% penalty — rigid, narrow development)
///     else:  × 1.0
///
/// Combined mod range: ~0.675 (lazy + rigid) to ~1.375 (disciplined + creative)
pub fn personality_growth_mod(player: &Player) -> f64 {
    let c_mod = if player.personality.conscientiousness >= 70 {
        1.25
    } else if player.personality.conscientiousness < 30 {
        0.75
    } else {
        1.0
    };
    let o_mod = if player.personality.openness >= 70 {
        1.10
    } else if player.personality.openness < 30 {
        0.90
    } else {
        1.0
    };
    c_mod * o_mod
}

// ============================================================================
// 4. POSITION FOCUS BONUS — matching focus to position = bonus growth
// ============================================================================

/// Returns 1.30 for best-position focus match, 0.80 for worst-match, 1.0 otherwise.
///
/// Mapping:
///   Goalkeeper: any focus except Attacking is neutral (1.0); Attacking is worst (0.80)
///               (GKs benefit broadly from Physical/Tactical/Recovery)
///   Defender:   Defending = best (1.30); Attacking = worst (0.80); else 1.0
///   Midfielder: Technical/Tactical = best (1.30); no worst for MID; else 1.0
///   Forward:    Attacking = best (1.30); Defending = worst (0.80); else 1.0
pub fn position_focus_bonus(player: &Player, focus: &TrainingFocus) -> f64 {
    let group = player.position.to_group_position();
    match group {
        Position::Goalkeeper => match focus {
            TrainingFocus::Attacking => 0.80,
            _ => 1.0,
        },
        Position::Defender => match focus {
            TrainingFocus::Defending => 1.30,
            TrainingFocus::Attacking => 0.80,
            _ => 1.0,
        },
        Position::Midfielder => match focus {
            TrainingFocus::Technical | TrainingFocus::Tactical => 1.30,
            _ => 1.0,
        },
        Position::Forward => match focus {
            TrainingFocus::Attacking => 1.30,
            TrainingFocus::Defending => 0.80,
            _ => 1.0,
        },
        _ => 1.0,
    }
}

// ============================================================================
// DEVELOPMENT TRAJECTORY — surfaced in PlayerMeaningSnapshot
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum DevelopmentTrajectory {
    Rising,    // young, growing, far from ceiling
    Peaked,    // at or very near potential, age 26+
    Plateaued, // at ceiling, age 28+
    Declining, // under pressure with low stability (regression risk)
}

impl DevelopmentTrajectory {
    pub fn label(&self) -> &'static str {
        match self {
            DevelopmentTrajectory::Rising => "Rising",
            DevelopmentTrajectory::Peaked => "Peaked",
            DevelopmentTrajectory::Plateaued => "Plateaued",
            DevelopmentTrajectory::Declining => "Declining",
        }
    }
}

/// Compute a player's current development trajectory label.
/// Surfaced in the UI as the "growth_vector" / "trajectory_label" field.
pub fn development_trajectory(player: &Player, age: u32) -> DevelopmentTrajectory {
    let gap = player.potential.saturating_sub(player.ovr);
    // Declining takes priority — even a young player can be in decline under pressure
    if player.stability_modifier < 40 && is_under_pressure(player) {
        return DevelopmentTrajectory::Declining;
    }
    if gap == 0 && age >= 28 {
        return DevelopmentTrajectory::Plateaued;
    }
    if gap <= 2 && age >= 26 {
        return DevelopmentTrajectory::Peaked;
    }
    if age <= 24 && gap >= 5 {
        return DevelopmentTrajectory::Rising;
    }
    // Default: still rising if young, otherwise peaked-ish
    if age <= 25 {
        DevelopmentTrajectory::Rising
    } else {
        DevelopmentTrajectory::Peaked
    }
}

// ============================================================================
// TESTS
// ============================================================================
#[cfg(test)]
mod tests {
    use super::*;
    use domain::player::{PersonalityProfile, Player, PlayerAttributes, Position};

    fn make_test_player(
        stability: u8,
        morale: u8,
        neuroticism: u8,
        conscientiousness: u8,
        openness: u8,
        ovr: u8,
        potential: u8,
        position: Position,
        age: u32,
    ) -> Player {
        let attrs = PlayerAttributes {
            pace: 50, burst: 50, engine: 50, power: 50, agility: 50,
            passing: 50, distribution: 50, touch: 50, finishing: 50,
            defending: 50, aerial: 50, anticipation: 50, vision: 50,
            decisions: 50, composure: 50, leadership: 50,
            shot_stopping: 50, commanding: 50, playing_out: 50,
        };
        let mut p = Player::new(
            "p1".to_string(),
            "Test Player".to_string(),
            "Test Player".to_string(),
            format!("{}-01-01", 2024 - age),
            "ENG".to_string(),
            position.clone(),
            attrs,
        );
        p.stability_modifier = stability;
        p.morale = morale;
        p.personality = PersonalityProfile {
            openness,
            conscientiousness,
            extraversion: 50,
            agreeableness: 50,
            neuroticism,
            confidence: 100,
        };
        p.ovr = ovr;
        p.potential = potential;
        p.position = position;
        p.natural_position = p.position.clone();
        p
    }

    // ---- Stability guard tests ----

    #[test]
    fn stability_guard_no_regression_when_immune() {
        // stability=100 → immune even under pressure
        let p = make_test_player(100, 20, 50, 50, 50, 60, 80, Position::Midfielder, 25);
        assert_eq!(regression_probability(&p), 0.0);
    }

    #[test]
    fn stability_guard_no_regression_when_not_under_pressure() {
        // stability=10 but morale=80 → no pressure → no regression
        let p = make_test_player(10, 80, 50, 50, 50, 60, 80, Position::Midfielder, 25);
        assert_eq!(regression_probability(&p), 0.0);
    }

    #[test]
    fn stability_guard_regresses_when_low_stability_and_pressure() {
        // stability=10, morale=20 → high regression chance
        let p = make_test_player(10, 20, 50, 50, 50, 60, 80, Position::Midfielder, 25);
        let prob = regression_probability(&p);
        // stability_factor = (50-10)/50 = 0.8 → prob = 0.05 * 1.8 * 1.0 = 0.09
        assert!((prob - 0.09).abs() < 0.001, "expected 0.09, got {}", prob);
    }

    #[test]
    fn stability_guard_neuroticism_amplifies_regression() {
        let p = make_test_player(10, 20, 90, 50, 50, 60, 80, Position::Midfielder, 25);
        let prob = regression_probability(&p);
        // 0.05 * 1.8 * 1.5 = 0.135
        assert!((prob - 0.135).abs() < 0.001, "expected 0.135, got {}", prob);
    }

    #[test]
    fn stability_guard_neuroticism_softens_regression() {
        let p = make_test_player(10, 20, 20, 50, 50, 60, 80, Position::Midfielder, 25);
        let prob = regression_probability(&p);
        // 0.05 * 1.8 * 0.5 = 0.045
        assert!((prob - 0.045).abs() < 0.001, "expected 0.045, got {}", prob);
    }

    #[test]
    fn stability_guard_mid_stability_baseline() {
        // stability=50, morale=20 → factor=0, prob = 0.05 * 1.0 * 1.0 = 0.05
        let p = make_test_player(50, 20, 50, 50, 50, 60, 80, Position::Midfielder, 25);
        let prob = regression_probability(&p);
        assert!((prob - 0.05).abs() < 0.001, "expected 0.05, got {}", prob);
    }

    #[test]
    fn apply_regression_reduces_attribute() {
        let mut p = make_test_player(10, 20, 50, 50, 50, 60, 80, Position::Midfielder, 25);
        let original_sum: u32 = p.attributes.passing as u32
            + p.attributes.distribution as u32
            + p.attributes.vision as u32
            + p.attributes.engine as u32;
        let mut rng = rand::rng();
        apply_regression(&mut p, &mut rng);
        let new_sum: u32 = p.attributes.passing as u32
            + p.attributes.distribution as u32
            + p.attributes.vision as u32
            + p.attributes.engine as u32;
        assert_eq!(new_sum, original_sum - 1, "one MID main attr should drop by 1");
    }

    #[test]
    fn apply_regression_does_not_drop_below_5() {
        let mut p = make_test_player(10, 20, 50, 50, 50, 60, 80, Position::Midfielder, 25);
        // Force all MID attrs to 5 (the floor)
        p.attributes.passing = 5;
        p.attributes.distribution = 5;
        p.attributes.vision = 5;
        p.attributes.engine = 5;
        let mut rng = rand::rng();
        apply_regression(&mut p, &mut rng);
        assert!(p.attributes.passing >= 5);
        assert!(p.attributes.distribution >= 5);
        assert!(p.attributes.vision >= 5);
        assert!(p.attributes.engine >= 5);
    }

    // ---- Plateau tests ----

    #[test]
    fn plateau_factor_full_when_far_from_potential() {
        let p = make_test_player(60, 70, 50, 50, 50, 50, 80, Position::Midfielder, 22);
        // gap=30, age=22 → 1.0
        assert!((plateau_growth_factor(&p, 22) - 1.0).abs() < 0.001);
    }

    #[test]
    fn plateau_factor_reduced_near_ceiling_young() {
        let p = make_test_player(60, 70, 50, 50, 50, 78, 80, Position::Midfielder, 24);
        // gap=2, age=24 → 0.8 (approaching ceiling, but age < 26)
        assert!((plateau_growth_factor(&p, 24) - 0.8).abs() < 0.001);
    }

    #[test]
    fn plateau_factor_reduced_near_ceiling_prime() {
        let p = make_test_player(60, 70, 50, 50, 50, 78, 80, Position::Midfielder, 27);
        // gap=2, age=27 → 0.6 (entering prime, near ceiling)
        assert!((plateau_growth_factor(&p, 27) - 0.6).abs() < 0.001);
    }

    #[test]
    fn plateau_factor_minimum_at_ceiling_veteran() {
        let p = make_test_player(60, 70, 50, 50, 50, 79, 80, Position::Midfielder, 30);
        // gap=1, age=30 → 0.4
        assert!((plateau_growth_factor(&p, 30) - 0.4).abs() < 0.001);
    }

    // ---- Personality growth mod tests ----

    #[test]
    fn personality_growth_conscientious_high_boosts() {
        let p = make_test_player(60, 70, 50, 80, 50, 60, 80, Position::Midfielder, 25);
        // C=80 → 1.25, O=50 → 1.0 → 1.25
        assert!((personality_growth_mod(&p) - 1.25).abs() < 0.001);
    }

    #[test]
    fn personality_growth_conscientious_low_penalizes() {
        let p = make_test_player(60, 70, 50, 20, 50, 60, 80, Position::Midfielder, 25);
        // C=20 → 0.75, O=50 → 1.0 → 0.75
        assert!((personality_growth_mod(&p) - 0.75).abs() < 0.001);
    }

    #[test]
    fn personality_growth_openness_high_boosts() {
        let p = make_test_player(60, 70, 50, 50, 80, 60, 80, Position::Midfielder, 25);
        // C=50 → 1.0, O=80 → 1.10 → 1.10
        assert!((personality_growth_mod(&p) - 1.10).abs() < 0.001);
    }

    #[test]
    fn personality_growth_combined_max() {
        let p = make_test_player(60, 70, 50, 80, 80, 60, 80, Position::Midfielder, 25);
        // C=80, O=80 → 1.25 * 1.10 = 1.375
        assert!((personality_growth_mod(&p) - 1.375).abs() < 0.001);
    }

    #[test]
    fn personality_growth_combined_min() {
        let p = make_test_player(60, 70, 50, 20, 20, 60, 80, Position::Midfielder, 25);
        // C=20, O=20 → 0.75 * 0.90 = 0.675
        assert!((personality_growth_mod(&p) - 0.675).abs() < 0.001);
    }

    // ---- Position focus bonus tests ----

    #[test]
    fn position_focus_defender_defending_bonus() {
        let p = make_test_player(60, 70, 50, 50, 50, 60, 80, Position::Defender, 25);
        assert!((position_focus_bonus(&p, &TrainingFocus::Defending) - 1.30).abs() < 0.001);
    }

    #[test]
    fn position_focus_defender_attacking_penalty() {
        let p = make_test_player(60, 70, 50, 50, 50, 60, 80, Position::Defender, 25);
        assert!((position_focus_bonus(&p, &TrainingFocus::Attacking) - 0.80).abs() < 0.001);
    }

    #[test]
    fn position_focus_defender_neutral() {
        let p = make_test_player(60, 70, 50, 50, 50, 60, 80, Position::Defender, 25);
        assert!((position_focus_bonus(&p, &TrainingFocus::Technical) - 1.0).abs() < 0.001);
    }

    #[test]
    fn position_focus_forward_attacking_bonus() {
        let p = make_test_player(60, 70, 50, 50, 50, 60, 80, Position::Forward, 25);
        assert!((position_focus_bonus(&p, &TrainingFocus::Attacking) - 1.30).abs() < 0.001);
    }

    #[test]
    fn position_focus_forward_defending_penalty() {
        let p = make_test_player(60, 70, 50, 50, 50, 60, 80, Position::Forward, 25);
        assert!((position_focus_bonus(&p, &TrainingFocus::Defending) - 0.80).abs() < 0.001);
    }

    #[test]
    fn position_focus_midfielder_technical_bonus() {
        let p = make_test_player(60, 70, 50, 50, 50, 60, 80, Position::Midfielder, 25);
        assert!((position_focus_bonus(&p, &TrainingFocus::Technical) - 1.30).abs() < 0.001);
    }

    #[test]
    fn position_focus_midfielder_tactical_bonus() {
        let p = make_test_player(60, 70, 50, 50, 50, 60, 80, Position::Midfielder, 25);
        assert!((position_focus_bonus(&p, &TrainingFocus::Tactical) - 1.30).abs() < 0.001);
    }

    #[test]
    fn position_focus_gk_attacking_penalty() {
        let p = make_test_player(60, 70, 50, 50, 50, 60, 80, Position::Goalkeeper, 25);
        assert!((position_focus_bonus(&p, &TrainingFocus::Attacking) - 0.80).abs() < 0.001);
    }

    #[test]
    fn position_focus_gk_physical_neutral() {
        let p = make_test_player(60, 70, 50, 50, 50, 60, 80, Position::Goalkeeper, 25);
        assert!((position_focus_bonus(&p, &TrainingFocus::Physical) - 1.0).abs() < 0.001);
    }

    // ---- Development trajectory tests ----

    #[test]
    fn trajectory_rising_young_far_from_potential() {
        let p = make_test_player(60, 70, 50, 50, 50, 50, 80, Position::Midfielder, 20);
        assert_eq!(development_trajectory(&p, 20), DevelopmentTrajectory::Rising);
    }

    #[test]
    fn trajectory_peaked_at_ceiling_prime_age() {
        let p = make_test_player(60, 70, 50, 50, 50, 78, 80, Position::Midfielder, 27);
        assert_eq!(development_trajectory(&p, 27), DevelopmentTrajectory::Peaked);
    }

    #[test]
    fn trajectory_plateaued_at_ceiling_veteran() {
        let p = make_test_player(60, 70, 50, 50, 50, 80, 80, Position::Midfielder, 30);
        assert_eq!(development_trajectory(&p, 30), DevelopmentTrajectory::Plateaued);
    }

    #[test]
    fn trajectory_declining_under_pressure_low_stability() {
        let p = make_test_player(20, 20, 50, 50, 50, 60, 80, Position::Midfielder, 25);
        assert_eq!(development_trajectory(&p, 25), DevelopmentTrajectory::Declining);
    }

    #[test]
    fn trajectory_not_declining_when_high_stability_even_under_pressure() {
        let p = make_test_player(80, 20, 50, 50, 50, 60, 80, Position::Midfielder, 25);
        // Even under pressure (morale=20), high stability means NOT declining
        assert_ne!(development_trajectory(&p, 25), DevelopmentTrajectory::Declining);
    }
}
