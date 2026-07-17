//! Shared post-match physical wear applied to individual players.
//!
//! Used by both club matches and national-team friendlies so that a call-up
//! carries fatigue, fitness sharpening, and injury risk back to the player's
//! club (the same [`Player`] record is mutated in either context).

use domain::player::{Injury, Player};
use rand::{Rng, RngExt};

/// i18n keys for minor match injuries. These mirror the training-ground injury
/// pool so the UI renders them with existing translations.
pub const MATCH_INJURY_NAMES: [&str; 5] = [
    "common.injuries.minorMuscleStrain",
    "common.injuries.twistedAnkle",
    "common.injuries.kneeBruise",
    "common.injuries.hamstringTightness",
    "common.injuries.calfStrain",
];

/// V99.11 A4: Career-threatening injury names + their attribute penalties.
/// These are rare (0.05% chance per match) but have long durations (150-270
/// days) and apply permanent attribute penalties on recovery.
pub const CAREER_THREATENING_INJURIES: [(&str, u32, u32, &[(&str, u8)]); 4] = [
    // (i18n key, min_days, max_days, [(attribute_key, penalty)])
    (
        "common.injuries.aclTear",
        180, 270,
        &[("pace", 8), ("burst", 6), ("agility", 5)],
    ),
    (
        "common.injuries.brokenLeg",
        150, 210,
        &[("power", 6), ("aerial", 5)],
    ),
    (
        "common.injuries.achillesRupture",
        200, 270,
        &[("pace", 7), ("agility", 7)],
    ),
    (
        "common.injuries.kneeCartilage",
        120, 180,
        &[("agility", 5), ("burst", 4), ("aerial", 3)],
    ),
];

/// Deplete a player's short-term condition based on minutes played and stamina,
/// and gradually sharpen match fitness for players with significant minutes.
///
/// A no-op for players who did not feature (`minutes == 0`).
pub fn apply_match_wear(player: &mut Player, minutes: u8, rng: &mut impl Rng) {
    if minutes == 0 {
        return; // Did not play, no wear.
    }

    let minutes_factor = minutes as f64 / 90.0;
    let stamina_factor = player.attributes.engine as f64 / 100.0;
    let base_depletion = 40.0 * (1.0 - stamina_factor * 0.4);
    let depletion = (base_depletion * minutes_factor) as u8;
    player.condition = player.condition.saturating_sub(depletion);

    // 60+ minutes builds sharpness; probabilistic to keep changes gradual.
    if minutes >= 60 && player.fitness < 100 && rng.random_bool(0.3) {
        player.fitness = player.fitness.saturating_add(1);
    }
}

/// Injury-risk multiplier scaled by match fitness: less fit players are more
/// prone to picking up a knock.
fn injury_multiplier_from_fitness(fitness: u8) -> f64 {
    if fitness < 30 {
        3.0
    } else if fitness < 50 {
        2.0
    } else if fitness < 70 {
        1.5
    } else if fitness >= 90 {
        0.7
    } else {
        1.0
    }
}

/// Roll for a match-day injury. On a hit, sets the player's injury and returns
/// `true`. Already-injured players are skipped (returns `false`).
///
/// V99.11 A4: Added career-threatening injury path (0.05% chance, 1/2000).
/// These are rare but severe — 120-270 day layoff + permanent attribute
/// penalty on recovery (applied in progress_injury_recovery).
pub fn roll_match_injury(player: &mut Player, rng: &mut impl Rng) -> bool {
    if player.injury.is_some() {
        return false;
    }

    // V99.11 A4: First, check for career-threatening injury (1/2000 chance).
    // This is checked BEFORE the minor injury roll so it takes priority.
    let career_prob = 1.0_f64 / 2000.0;
    let career_roll = rng.random_bool(career_prob * injury_multiplier_from_fitness(player.fitness));
    if career_roll {
        let idx = rng.random_range(0..CAREER_THREATENING_INJURIES.len());
        let (name, min_days, max_days, _penalties) = CAREER_THREATENING_INJURIES[idx];
        let days = rng.random_range(min_days..=max_days);
        player.injury = Some(Injury {
            name: name.to_string(),
            days_remaining: days,
        });
        // Mark this as a severe injury via the injury name prefix so
        // progress_injury_recovery can apply the permanent penalty.
        // We store the index in the injury name as a suffix: "aclTear|0"
        player.injury = Some(Injury {
            name: format!("{}|{}", name, idx),
            days_remaining: days,
        });
        return true;
    }

    // Base match-day risk for minor injuries (1/40 chance).
    let base_prob = 1.0_f64 / 40.0;
    let prob = (base_prob * injury_multiplier_from_fitness(player.fitness)).min(1.0);
    if !rng.random_bool(prob) {
        return false;
    }

    let days = rng.random_range(5..=21);
    let name = MATCH_INJURY_NAMES[rng.random_range(0..MATCH_INJURY_NAMES.len())];
    player.injury = Some(Injury {
        name: name.to_string(),
        days_remaining: days,
    });
    true
}

/// V99.11 A4: Check if a player's injury is career-threatening (by checking
/// if the injury name contains a pipe separator storing the injury index).
/// Returns Some(index) if career-threatening, None otherwise.
pub fn career_threatening_injury_index(injury: &Injury) -> Option<usize> {
    if injury.name.contains('|') {
        let parts: Vec<&str> = injury.name.split('|').collect();
        if parts.len() == 2 {
            return parts[1].parse::<usize>().ok();
        }
    }
    None
}

/// V99.11 A4: Apply permanent attribute penalty when a career-threatening
/// injury heals. Called from progress_injury_recovery when days_remaining
/// reaches 0 for a severe injury.
pub fn apply_career_threatening_penalty(player: &mut Player, injury_index: usize) {
    if injury_index >= CAREER_THREATENING_INJURIES.len() {
        return;
    }
    let (_, _, _, penalties) = CAREER_THREATENING_INJURIES[injury_index];
    for (attr_key, penalty) in penalties {
        match *attr_key {
            "pace" => player.attributes.pace = player.attributes.pace.saturating_sub(*penalty),
            "burst" => player.attributes.burst = player.attributes.burst.saturating_sub(*penalty),
            "engine" => player.attributes.engine = player.attributes.engine.saturating_sub(*penalty),
            "power" => player.attributes.power = player.attributes.power.saturating_sub(*penalty),
            "agility" => player.attributes.agility = player.attributes.agility.saturating_sub(*penalty),
            "aerial" => player.attributes.aerial = player.attributes.aerial.saturating_sub(*penalty),
            _ => {}
        }
    }
    // Refresh derived ratings after attribute changes
    crate::player_rating::refresh_player_derived(player, chrono::Utc::now().year() as u32);
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::player::{Player, PlayerAttributes, Position};
    use rand::SeedableRng;
    use rand::rngs::StdRng;

    fn attrs(stamina: u8) -> PlayerAttributes {
        PlayerAttributes {
            pace: 70, burst: 70, engine: stamina, power: 70, agility: 70,
            passing: 70, distribution: 70, touch: 70, finishing: 70,
            defending: 70, aerial: 60, anticipation: 70, vision: 70,
            decisions: 70, composure: 70, leadership: 70,
            shot_stopping: 50, commanding: 50, playing_out: 50,
        }
    }

    fn make_player(stamina: u8) -> Player {
        Player::new(
            "p1".to_string(),
            "J. Doe".to_string(),
            "John Doe".to_string(),
            "2000-01-01".to_string(),
            "ENG".to_string(),
            Position::Midfielder,
            attrs(stamina),
        )
    }

    #[test]
    fn apply_match_wear_depletes_condition_by_minutes_and_stamina() {
        let mut player = make_player(100); // stamina 100 -> base depletion 24 over 90'
        player.condition = 100;
        let mut rng = StdRng::seed_from_u64(1);

        apply_match_wear(&mut player, 90, &mut rng);

        assert_eq!(player.condition, 76);
    }

    #[test]
    fn apply_match_wear_is_noop_for_unused_player() {
        let mut player = make_player(70);
        player.condition = 88;
        player.fitness = 90;
        let mut rng = StdRng::seed_from_u64(2);

        apply_match_wear(&mut player, 0, &mut rng);

        assert_eq!(player.condition, 88);
        assert_eq!(player.fitness, 90);
    }

    #[test]
    fn apply_match_wear_never_lowers_fitness() {
        let mut player = make_player(70);
        player.fitness = 80;
        let mut rng = StdRng::seed_from_u64(3);

        apply_match_wear(&mut player, 90, &mut rng);

        assert!(player.fitness >= 80);
    }

    #[test]
    fn roll_match_injury_skips_already_injured_player() {
        let mut player = make_player(40);
        player.injury = Some(Injury {
            name: "existing".to_string(),
            days_remaining: 10,
        });
        let mut rng = StdRng::seed_from_u64(4);

        assert!(!roll_match_injury(&mut player, &mut rng));
        assert_eq!(player.injury.as_ref().unwrap().name, "existing");
    }

    #[test]
    fn roll_match_injury_eventually_injures_a_low_fitness_player() {
        let mut rng = StdRng::seed_from_u64(5);
        let mut injured = false;
        for _ in 0..500 {
            let mut player = make_player(70);
            player.fitness = 20; // 3x multiplier
            if roll_match_injury(&mut player, &mut rng) {
                assert!(player.injury.is_some());
                let injury = player.injury.unwrap();
                assert!(MATCH_INJURY_NAMES.contains(&injury.name.as_str()));
                assert!((5..=21).contains(&injury.days_remaining));
                injured = true;
                break;
            }
        }
        assert!(injured, "a low-fitness player should be injured within 500 rolls");
    }
}
