use domain::player::{Footedness, Player, PlayerTrait, Position};
use rand::RngExt;
use rand::Rng;

const WONDERKID_MAX_AGE: u32 = 20;
const WONDERKID_MIN_POTENTIAL: u8 = 90;
const WONDERKID_MIN_GROWTH_ROOM: u8 = 14;
// Wonderkid rebalance for v0.2.1: tightened from age <= 21, potential >= 85,
// and growth room >= 10 to reduce how often the tag appears in playtesting.

pub fn formation_slots(formation: &str) -> Vec<Position> {
    formation_slot_rows(formation)
        .into_iter()
        .flatten()
        .collect()
}

/// The granular field position a player is deployed in for `team`, derived from
/// the team's formation and starting XI order.
///
/// Returns `None` when the player is not in the starting XI (e.g. on the bench);
/// such players have no deployed slot and callers should fall back to the
/// player's natural position. This is the single source of truth for "where the
/// player is currently playing", since `player.position` is no longer mutated to
/// encode the deployed slot.
pub fn deployed_position(team: &domain::team::Team, player_id: &str) -> Option<Position> {
    let slot_index = team
        .starting_xi_ids
        .iter()
        .position(|id| id == player_id)?;
    formation_slots(&team.formation).get(slot_index).cloned()
}

/// Refresh a player's derived fields: `ovr`, `potential`, and `traits`.
///
/// - `ovr` is recomputed from the player's natural position using position-weighted attributes.
/// - `potential` is set only if it is currently 0 (unset), using a random bonus based on age.
///   Once set it is preserved so training gains can grow OVR toward the ceiling naturally.
/// - `traits` are recomputed from current attributes, and the `Wonderkid` trait is applied only
///   after the v0.2.1 rebalance for age <= 20, potential >= 90, and growth room >= 14.
///
/// Pass `current_year` for accurate age calculation (use the game clock year).
pub fn refresh_player_derived(player: &mut Player, current_year: u32) {
    // 1. Compute position-weighted OVR
    let ovr_f = natural_ovr(player);
    let ovr = ovr_f.round() as u8;

    // 2. Compute potential if not yet set (initial generation or legacy saves)
    let age = player_age(&player.date_of_birth, current_year);
    let potential = if player.potential == 0 {
        generate_potential(ovr, age)
    } else {
        // Keep existing potential; clamp so it is always >= ovr
        player.potential.max(ovr)
    };

    // 3. Recompute attribute-based traits
    let mut traits = domain::player::compute_traits(&player.attributes, &player.natural_position);

    // 4. Award Wonderkid trait: young player whose ceiling far exceeds current ability
    if qualifies_for_wonderkid(age, potential, ovr) && !traits.contains(&PlayerTrait::Wonderkid) {
        traits.push(PlayerTrait::Wonderkid);
    }

    player.ovr = ovr;
    player.potential = potential;
    player.traits = traits;

    // V99.4 T4.1: Derive player fame from OVR + age + career trophies.
    let trophies = player.career.iter().map(|c| c.goals).filter(|&g| g > 0).count() as u32;
    player.fame = domain::player::PlayerFame::derive(ovr, age as i32, trophies);
}

/// Returns `true` when a player qualifies as a wonderkid: they are at or below
/// `WONDERKID_MAX_AGE`, have at least `WONDERKID_MIN_POTENTIAL`, and their
/// remaining growth (`potential - ovr`) meets `WONDERKID_MIN_GROWTH_ROOM`,
/// reducing the number of qualifying players after playtesting.
pub fn qualifies_for_wonderkid(age: u32, potential: u8, ovr: u8) -> bool {
    age <= WONDERKID_MAX_AGE
        && potential >= WONDERKID_MIN_POTENTIAL
        && potential.saturating_sub(ovr) >= WONDERKID_MIN_GROWTH_ROOM
}

/// Generate a potential rating for a newly-created player based on current OVR and age.
/// Returns a value in [1, 99] that is always >= `ovr`.
/// The lower bound of 1 (via `ovr.max(1)`) ensures potential is never 0 even when `ovr` is 0.
pub fn generate_potential(ovr: u8, age: u32) -> u8 {
    let mut rng = rand::rng();
    let bonus: u8 = match age {
        ..=18 => rng.random_range(15u8..=30),
        19..=20 => rng.random_range(8u8..=22),
        21..=22 => rng.random_range(4u8..=14),
        23..=25 => rng.random_range(0u8..=7),
        _ => 0,
    };
    (ovr.saturating_add(bonus)).min(99).max(ovr.max(1))
}

/// Parse birth year from a "YYYY-MM-DD" date string and return approximate age.
fn player_age(date_of_birth: &str, current_year: u32) -> u32 {
    let birth_year: u32 = date_of_birth
        .split('-')
        .next()
        .and_then(|y| y.parse().ok())
        .unwrap_or(2000);
    current_year.saturating_sub(birth_year)
}

fn formation_slot_rows(formation: &str) -> Vec<Vec<Position>> {
    let parts: Vec<usize> = formation
        .split('-')
        .filter_map(|part| part.parse::<usize>().ok())
        .collect();

    match parts.as_slice() {
        [defenders, midfielders, forwards] => vec![
            vec![Position::Goalkeeper],
            defender_line(*defenders),
            midfield_line(*midfielders),
            forward_line(*forwards),
        ],
        [defenders, deep_midfielders, attacking_midfielders, forwards] => vec![
            vec![Position::Goalkeeper],
            defender_line(*defenders),
            deep_midfield_line(*deep_midfielders),
            attacking_midfield_line(*attacking_midfielders),
            forward_line(*forwards),
        ],
        _ => formation_slot_rows("4-4-2"),
    }
}

pub fn natural_ovr(player: &Player) -> f64 {
    let natural_position = primary_position(player);
    ovr_for_position(player, &natural_position)
}

pub fn ovr_for_position(player: &Player, position: &Position) -> f64 {
    let canonical = canonical_position(position);
    let base = weighted_score(player, &canonical);
    let penalty = critical_penalty(player, &canonical);
    (base - penalty).clamp(1.0, 99.0)
}

/// Condition-free positional fit for a formation slot: ovr-for-position minus
/// compatibility and footedness penalties, floored at 1.0. This is the
/// `effective_rating_for_assignment` value BEFORE the condition multiplier —
/// used by AI load-management so a tired starter and a fresh alternative are
/// compared on quality alone (condition is weighed separately by the caller).
pub fn positional_fit_for_assignment(player: &Player, slot_position: &Position) -> f64 {
    let canonical_slot = canonical_position(slot_position);
    let base = ovr_for_position(player, &canonical_slot);
    let compatibility_penalty = compatibility_penalty(player, &canonical_slot);
    let foot_penalty = footedness_penalty(player, &canonical_slot);
    (base - compatibility_penalty - foot_penalty).max(1.0)
}

pub fn effective_rating_for_assignment(player: &Player, slot_position: &Position) -> f64 {
    positional_fit_for_assignment(player, slot_position) * (player.condition as f64 / 100.0)
}

fn defender_line(count: usize) -> Vec<Position> {
    match count {
        3 => vec![
            Position::CenterBack,
            Position::CenterBack,
            Position::CenterBack,
        ],
        4 => vec![
            Position::LeftBack,
            Position::CenterBack,
            Position::CenterBack,
            Position::RightBack,
        ],
        5 => vec![
            Position::LeftWingBack,
            Position::CenterBack,
            Position::CenterBack,
            Position::CenterBack,
            Position::RightWingBack,
        ],
        _ => vec![Position::CenterBack; count],
    }
}

fn midfield_line(count: usize) -> Vec<Position> {
    match count {
        2 => vec![Position::CentralMidfielder, Position::CentralMidfielder],
        3 => vec![
            Position::DefensiveMidfielder,
            Position::CentralMidfielder,
            Position::AttackingMidfielder,
        ],
        4 => vec![
            Position::LeftMidfielder,
            Position::CentralMidfielder,
            Position::CentralMidfielder,
            Position::RightMidfielder,
        ],
        5 => vec![
            Position::LeftMidfielder,
            Position::DefensiveMidfielder,
            Position::CentralMidfielder,
            Position::AttackingMidfielder,
            Position::RightMidfielder,
        ],
        _ => vec![Position::CentralMidfielder; count],
    }
}

fn deep_midfield_line(count: usize) -> Vec<Position> {
    match count {
        1 => vec![Position::DefensiveMidfielder],
        2 => vec![Position::DefensiveMidfielder, Position::CentralMidfielder],
        _ => vec![Position::DefensiveMidfielder; count],
    }
}

fn attacking_midfield_line(count: usize) -> Vec<Position> {
    match count {
        1 => vec![Position::AttackingMidfielder],
        2 => vec![Position::AttackingMidfielder, Position::AttackingMidfielder],
        3 => vec![
            Position::LeftMidfielder,
            Position::AttackingMidfielder,
            Position::RightMidfielder,
        ],
        _ => vec![Position::AttackingMidfielder; count],
    }
}

fn forward_line(count: usize) -> Vec<Position> {
    match count {
        1 => vec![Position::Striker],
        2 => vec![Position::Striker, Position::Striker],
        3 => vec![
            Position::LeftWinger,
            Position::Striker,
            Position::RightWinger,
        ],
        _ => vec![Position::Striker; count],
    }
}

fn primary_position(player: &Player) -> Position {
    let preferred = if player.natural_position.is_legacy_bucket() {
        player.position.clone()
    } else {
        player.natural_position.clone()
    };

    canonical_position(&preferred)
}

fn canonical_position(position: &Position) -> Position {
    match position {
        Position::Goalkeeper => Position::Goalkeeper,
        Position::Defender => Position::CenterBack,
        Position::Midfielder => Position::CentralMidfielder,
        Position::Forward => Position::Striker,
        granular => granular.clone(),
    }
}

fn compatibility_penalty(player: &Player, slot_position: &Position) -> f64 {
    let primary = primary_position(player);
    if &primary == slot_position {
        return 0.0;
    }

    let alternates = player
        .alternate_positions
        .iter()
        .map(canonical_position)
        .collect::<Vec<_>>();

    if alternates.iter().any(|position| position == slot_position) {
        4.0
    } else if primary.to_group_position() == slot_position.to_group_position() {
        8.0
    } else {
        14.0
    }
}

fn footedness_penalty(player: &Player, slot_position: &Position) -> f64 {
    let Some(required_side) = slot_side(slot_position) else {
        return 0.0;
    };

    match (player.footedness, required_side) {
        (Footedness::Both, _) => 0.0,
        (Footedness::Left, Side::Left) | (Footedness::Right, Side::Right) => 0.0,
        _ => (10_i32 - (player.weak_foot.clamp(1, 5) as i32 * 2)).max(0) as f64,
    }
}

fn weighted_score(player: &Player, position: &Position) -> f64 {
    let attrs = &player.attributes;
    // V99.3: Fixed doubled-weight bugs (shot_stopping×2 in GK, defending×2
    // in CB/RB/LB/RWB/LWB/DM) and added the 5 previously-missing attributes:
    // burst, distribution, agility, commanding, playing_out.
    match position {
        // Goalkeeper: was shot_stopping×2 (56 total). Now shot_stopping +
        // commanding + playing_out cover all three Gloves attributes.
        Position::Goalkeeper => weighted_average(&[
            (attrs.shot_stopping, 28),
            (attrs.commanding, 18),
            (attrs.aerial, 12),
            (attrs.anticipation, 10),
            (attrs.decisions, 10),
            (attrs.composure, 8),
            (attrs.playing_out, 7),
            (attrs.power, 7),
        ]),
        // RightBack/LeftBack: was defending×2 (33 total). Replaced second
        // defending with burst (acceleration for overlapping runs).
        Position::RightBack | Position::LeftBack => weighted_average(&[
            (attrs.pace, 18),
            (attrs.engine, 16),
            (attrs.defending, 17),
            (attrs.burst, 14),
            (attrs.anticipation, 12),
            (attrs.passing, 10),
            (attrs.touch, 6),
            (attrs.decisions, 7),
        ]),
        // CenterBack: was defending×2 (42 total). Replaced second defending
        // with agility (change of direction for recovery runs).
        Position::CenterBack => weighted_average(&[
            (attrs.defending, 24),
            (attrs.agility, 18),
            (attrs.anticipation, 18),
            (attrs.power, 14),
            (attrs.aerial, 12),
            (attrs.decisions, 8),
            (attrs.composure, 6),
        ]),
        // RightWingBack/LeftWingBack: was defending×2 (26 total). Replaced
        // second defending with burst (overlapping acceleration).
        Position::RightWingBack | Position::LeftWingBack => weighted_average(&[
            (attrs.pace, 18),
            (attrs.engine, 18),
            (attrs.defending, 14),
            (attrs.burst, 12),
            (attrs.passing, 13),
            (attrs.touch, 11),
            (attrs.vision, 7),
            (attrs.decisions, 7),
        ]),
        // DefensiveMidfielder: was defending×2 (30 total). Replaced second
        // defending with distribution (ball-playing DM — pirlo-style).
        Position::DefensiveMidfielder => weighted_average(&[
            (attrs.defending, 18),
            (attrs.anticipation, 18),
            (attrs.decisions, 16),
            (attrs.passing, 14),
            (attrs.distribution, 12),
            (attrs.engine, 10),
            (attrs.vision, 7),
            (attrs.power, 5),
        ]),
        Position::CentralMidfielder => weighted_average(&[
            (attrs.passing, 20),
            (attrs.vision, 16),
            (attrs.decisions, 16),
            (attrs.engine, 12),
            (attrs.touch, 10),
            (attrs.anticipation, 9),
            (attrs.leadership, 9),
            (attrs.defending, 8),
        ]),
        Position::AttackingMidfielder => weighted_average(&[
            (attrs.vision, 20),
            (attrs.passing, 18),
            (attrs.touch, 16),
            (attrs.decisions, 14),
            (attrs.finishing, 10),
            (attrs.anticipation, 8),
            (attrs.composure, 8),
            (attrs.pace, 6),
        ]),
        Position::RightMidfielder | Position::LeftMidfielder => weighted_average(&[
            (attrs.pace, 17),
            (attrs.engine, 16),
            (attrs.passing, 15),
            (attrs.touch, 14),
            (attrs.vision, 10),
            (attrs.decisions, 10),
            (attrs.anticipation, 10),
            (attrs.defending, 8),
        ]),
        // RightWinger/LeftWinger: added burst (acceleration past defender
        // in 1v1 situations) by reducing pace slightly — pace covers
        // top speed, burst covers first 5 yards.
        Position::RightWinger | Position::LeftWinger => weighted_average(&[
            (attrs.pace, 18),
            (attrs.burst, 12),
            (attrs.touch, 22),
            (attrs.passing, 14),
            (attrs.finishing, 12),
            (attrs.vision, 10),
            (attrs.decisions, 8),
            (attrs.anticipation, 4),
        ]),
        // Striker: added burst (first-step acceleration to get behind
        // defenders) and agility (sharp turns in the box).
        Position::Striker => weighted_average(&[
            (attrs.finishing, 26),
            (attrs.anticipation, 16),
            (attrs.decisions, 12),
            (attrs.burst, 10),
            (attrs.pace, 10),
            (attrs.touch, 10),
            (attrs.power, 8),
            (attrs.composure, 8),
        ]),
        Position::Defender | Position::Midfielder | Position::Forward => unreachable!(),
    }
}

fn critical_penalty(player: &Player, position: &Position) -> f64 {
    let attrs = &player.attributes;
    // V99.3: Fixed doubled-attr bugs (shot_stopping×2 in GK, defending×2 in
    // CB/RB/LB). Replaced with the previously-missing attributes so the
    // penalty actually tests three DISTINCT critical attributes.
    let critical_min = match position {
        Position::Goalkeeper => attrs.shot_stopping.min(attrs.commanding).min(attrs.anticipation),
        Position::RightBack | Position::LeftBack => {
            attrs.defending.min(attrs.pace).min(attrs.anticipation)
        }
        Position::CenterBack => attrs.defending.min(attrs.anticipation).min(attrs.aerial),
        Position::RightWingBack | Position::LeftWingBack => {
            attrs.pace.min(attrs.engine).min(attrs.defending)
        }
        Position::DefensiveMidfielder => attrs.defending.min(attrs.anticipation).min(attrs.passing),
        Position::CentralMidfielder => attrs.passing.min(attrs.vision).min(attrs.decisions),
        Position::AttackingMidfielder => attrs.vision.min(attrs.passing).min(attrs.touch),
        Position::RightMidfielder | Position::LeftMidfielder => {
            attrs.pace.min(attrs.passing).min(attrs.engine)
        }
        Position::RightWinger | Position::LeftWinger => {
            attrs.pace.min(attrs.touch).min(attrs.passing)
        }
        Position::Striker => attrs.finishing.min(attrs.anticipation).min(attrs.decisions),
        Position::Defender | Position::Midfielder | Position::Forward => 50,
    };

    if critical_min >= 45 {
        0.0
    } else {
        (45 - critical_min) as f64 * 0.6
    }
}

fn weighted_average(values: &[(u8, i32)]) -> f64 {
    values
        .iter()
        .map(|(value, weight)| *value as f64 * *weight as f64)
        .sum::<f64>()
        / 100.0
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Side {
    Left,
    Right,
}

fn slot_side(position: &Position) -> Option<Side> {
    match position {
        Position::LeftBack
        | Position::LeftWingBack
        | Position::LeftMidfielder
        | Position::LeftWinger => Some(Side::Left),
        Position::RightBack
        | Position::RightWingBack
        | Position::RightMidfielder
        | Position::RightWinger => Some(Side::Right),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::player::PlayerAttributes;

    fn make_player(position: Position) -> Player {
        Player::new(
            "p-1".to_string(),
            "Test".to_string(),
            "Test Player".to_string(),
            "2000-01-01".to_string(),
            "GB".to_string(),
            position,
            PlayerAttributes {
                pace: 70,
                engine: 70,
                power: 70,
                agility: 70,
                passing: 70,
                finishing: 70,
                defending: 70,
                touch: 70,
                anticipation: 70,
                vision: 70,
                decisions: 70,
                composure: 70,
                leadership: 70,
                shot_stopping: 20,
                aerial: 70,
                burst: 50,
                distribution: 50,
                commanding: 50,
                playing_out: 50,
            ..Default::default()
        },
        )
    }

    #[test]
    fn formation_slots_return_exact_role_layout() {
        assert_eq!(
            formation_slots("4-4-2"),
            vec![
                Position::Goalkeeper,
                Position::LeftBack,
                Position::CenterBack,
                Position::CenterBack,
                Position::RightBack,
                Position::LeftMidfielder,
                Position::CentralMidfielder,
                Position::CentralMidfielder,
                Position::RightMidfielder,
                Position::Striker,
                Position::Striker,
            ]
        );
    }

    #[test]
    fn deployed_position_maps_starting_xi_index_to_formation_slot() {
        use domain::team::Team;

        let mut team = Team::new(
            "t1".to_string(),
            "Test FC".to_string(),
            "TFC".to_string(),
            "England".to_string(),
            "London".to_string(),
            "Ground".to_string(),
            25_000,
        );
        team.formation = "4-4-2".to_string();
        team.starting_xi_ids = vec![
            "gk".to_string(),
            "lb".to_string(),
            "cb1".to_string(),
            "cb2".to_string(),
            "rb".to_string(),
        ];

        assert_eq!(deployed_position(&team, "gk"), Some(Position::Goalkeeper));
        assert_eq!(deployed_position(&team, "lb"), Some(Position::LeftBack));
        assert_eq!(deployed_position(&team, "rb"), Some(Position::RightBack));
        // Not in the starting XI -> no deployed slot.
        assert_eq!(deployed_position(&team, "bench"), None);
    }

    #[test]
    fn role_specific_rating_favors_matching_profile() {
        let mut player = make_player(Position::CenterBack);
        player.natural_position = Position::CenterBack;
        player.attributes.defending = 88;
        player.attributes.defending = 84;
        player.attributes.anticipation = 82;
        player.attributes.power = 80;
        player.attributes.passing = 55;
        player.attributes.vision = 50;
        player.attributes.finishing = 40;
        player.attributes.touch = 44;

        assert!(
            ovr_for_position(&player, &Position::CenterBack)
                > ovr_for_position(&player, &Position::Striker)
        );
    }

    #[test]
    fn assignment_penalty_drops_wrong_side_fullback_more_with_poor_weak_foot() {
        let mut player = make_player(Position::RightBack);
        player.natural_position = Position::RightBack;
        player.footedness = Footedness::Right;
        player.weak_foot = 1;
        player.attributes.defending = 82;
        player.attributes.defending = 80;
        player.attributes.anticipation = 78;
        player.attributes.pace = 81;
        player.attributes.engine = 79;

        let same_side = effective_rating_for_assignment(&player, &Position::RightBack);
        let wrong_side = effective_rating_for_assignment(&player, &Position::LeftBack);

        assert!(same_side > wrong_side);
    }

    #[test]
    fn alternate_positions_reduce_assignment_penalty() {
        let mut player = make_player(Position::CentralMidfielder);
        player.natural_position = Position::CentralMidfielder;
        player.alternate_positions = vec![Position::AttackingMidfielder];
        player.attributes.passing = 82;
        player.attributes.vision = 84;
        player.attributes.decisions = 78;
        player.attributes.touch = 76;

        let alternate_role =
            effective_rating_for_assignment(&player, &Position::AttackingMidfielder);
        let out_of_group_role = effective_rating_for_assignment(&player, &Position::RightBack);

        assert!(alternate_role > out_of_group_role);
    }

    #[test]
    fn formation_slots_532_yields_11_granular_positions() {
        let slots = formation_slots("5-3-2");
        assert_eq!(slots.len(), 11);
        assert_eq!(slots[0], Position::Goalkeeper);
        // 5 defenders
        assert_eq!(
            &slots[1..6],
            &[
                Position::LeftWingBack,
                Position::CenterBack,
                Position::CenterBack,
                Position::CenterBack,
                Position::RightWingBack,
            ]
        );
        // 3 midfielders
        assert_eq!(
            &slots[6..9],
            &[
                Position::DefensiveMidfielder,
                Position::CentralMidfielder,
                Position::AttackingMidfielder,
            ]
        );
        // 2 forwards
        assert_eq!(&slots[9..11], &[Position::Striker, Position::Striker]);
    }

    #[test]
    fn formation_slots_4141_yields_11_granular_positions() {
        let slots = formation_slots("4-1-4-1");
        assert_eq!(slots.len(), 11);
        assert_eq!(slots[0], Position::Goalkeeper);
        // 4 defenders
        assert_eq!(
            &slots[1..5],
            &[
                Position::LeftBack,
                Position::CenterBack,
                Position::CenterBack,
                Position::RightBack,
            ]
        );
        // 1 deep midfielder
        assert_eq!(slots[5], Position::DefensiveMidfielder);
        // 4 attacking midfielders (attacking_midfield_line wildcard arm: all AM)
        assert_eq!(
            &slots[6..10],
            &[
                Position::AttackingMidfielder,
                Position::AttackingMidfielder,
                Position::AttackingMidfielder,
                Position::AttackingMidfielder,
            ]
        );
        // 1 forward
        assert_eq!(slots[10], Position::Striker);
    }

    #[test]
    fn refresh_does_not_award_wonderkid_below_elite_potential_threshold() {
        let mut player = make_player(Position::Striker);
        player.date_of_birth = "2007-01-01".to_string();
        player.natural_position = Position::Striker;
        player.attributes.finishing = 70;
        player.attributes.anticipation = 70;
        player.attributes.decisions = 70;
        player.attributes.pace = 70;
        player.attributes.touch = 70;
        player.attributes.power = 70;
        player.attributes.composure = 70;
        player.attributes.aerial = 70;
        player.potential = 84;

        refresh_player_derived(&mut player, 2026);

        assert!(player.potential >= player.ovr.saturating_add(10));
        assert!(!player.traits.contains(&PlayerTrait::Wonderkid));
    }
}
