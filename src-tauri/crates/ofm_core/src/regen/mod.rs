// Gaffer Phase 8 — Regen Generation System
//
// Keeps the world alive forever. When players retire, replacement regens
// (procedurally generated youth prospects) are generated to fill the void.
// Annual academy intake also adds 3-5 youth prospects per team per season.
//
// Design decisions (see IMPLEMENTATION_PLAN.md):
//   - 1:1 regen replacement for retired players (preserves squad size)
//   - Position-band random potential (NOT matching the retiring player)
//   - Always youth academy (SquadRole::Youth) — manager promotes when ready
//   - Initial +20 relationships to all teammates (new kid, neutral-positive)
//   - 17 nationalities from bundled name pool (covers Big 5 leagues)

use crate::game::Game;
use crate::generator::generate_youth_academy_recruit_with_nationality;
use chrono::Datelike;
use domain::player::{Player, Position, SquadRole};
use rand::Rng;

/// Position-appropriate potential bands for regens.
/// Returns (min, max) potential for a given position group.
///
/// Forwards have the widest ceiling (wonderkids are most exciting at FWD),
/// goalkeepers have the narrowest (less variance, fewer prospects needed).
fn potential_band_for_position(position: &Position) -> (u8, u8) {
    let group = position.to_group_position();
    match group {
        Position::Goalkeeper => (50, 85),
        Position::Defender => (45, 88),
        Position::Midfielder => (45, 90),
        Position::Forward => (45, 92),
        _ => (45, 88),
    }
}

/// Bias the potential band upward for high-reputation teams.
/// Big clubs produce better academy prospects (better facilities, coaching, scouting).
fn reputation_bias(team_reputation: u32) -> i8 {
    if team_reputation >= 80 {
        5
    } else if team_reputation >= 65 {
        3
    } else if team_reputation >= 50 {
        1
    } else {
        0
    }
}

/// Roll a random potential within the position band, biased by team reputation.
/// ~10% chance of "wonderkid" (potential >= 85) for excitement.
fn roll_potential(position: &Position, team_reputation: u32, rng: &mut impl Rng) -> u8 {
    use rand::RngExt;
    let (min, max) = potential_band_for_position(position);
    let bias = reputation_bias(team_reputation) as i16;
    let adjusted_min = ((min as i16) + bias).max(40) as u8;
    let adjusted_max = ((max as i16) + bias).min(95) as u8;

    // 10% wonderkid chance (if the band allows it)
    let wonderkid_roll: f64 = rng.random_range(0.0..1.0);
    if wonderkid_roll < 0.10 && adjusted_max >= 85 {
        return rng.random_range(85..=adjusted_max);
    }

    rng.random_range(adjusted_min..=adjusted_max)
}

/// Generate a replacement regen for a retiring player.
///
/// The regen:
///   - Matches the retiring player's position group
///   - Is 16-19 years old (weighted toward 17-18)
///   - Has random potential within the position band (biased by team reputation)
///   - Has random Big Five personality (confidence = 100 — young players are confident)
///   - Has 0-3 narrative traits (probabilistic)
///   - Starts with SquadRole::Youth
///   - Gets +20 relationships to all current teammates
pub fn generate_replacement_regen(
    retiring_player: &Player,
    team_id: &str,
    team_reputation: u32,
    team_country: &str,
    _season: u32,
    rng: &mut impl Rng,
) -> Player {
    // Use the existing youth academy generator, then customize for Phase 8.
    // We pass the retiring player's position so the regen fills the same role.
    let position_group = retiring_player.position.to_group_position();
    let mut regen = generate_youth_academy_recruit_with_nationality(
        &dummy_team_for_regen(team_id, team_country),
        Some(&position_group),
        Some(&retiring_player.nationality),
    );

    // Override age to 16-19 (weighted toward 17-18)
    use rand::RngExt;
    let age_roll: u32 = rng.random_range(0..100);
    let age = if age_roll < 20 {
        16
        } else if age_roll < 70 {
        17
    } else if age_roll < 90 {
        18
    } else {
        19
    };
    let birth_year = 2024 - age;
    regen.date_of_birth = format!("{}-{:02}-{:02}", birth_year, rng.random_range(1..=12), rng.random_range(1..=28));

    // Override potential with position-band roll
    let potential = roll_potential(&retiring_player.position, team_reputation, rng);
    regen.potential = potential;

    // Set attributes relative to potential (young player starts well below ceiling)
    // Each attribute is potential - random(8-15), clamped to position-appropriate floors
    let attr_spread: u8 = rng.random_range(8..=15);
    set_attributes_for_youth(&mut regen, potential, attr_spread, &retiring_player.position);

    // Random Big Five personality (confidence = 100)
    regen.personality = random_personality(rng);

    // 0-3 narrative traits (probabilistic)
    regen.narrative_traits = random_narrative_traits(&regen, rng);

    // Stability: 30-70 (young, unproven)
    regen.stability_modifier = rng.random_range(30..=70);

    // Squad role: Youth (manager promotes when ready)
    regen.squad_role = SquadRole::Youth;

    // Assign to the team
    regen.team_id = Some(team_id.to_string());

    // Contract: 3-year youth contract
    regen.contract_end = Some(format!("{}-06-30", 2024 + 3));
    regen.wage = 1000; // youth wage

    // Refresh derived ratings
    crate::player_rating::refresh_player_derived(&mut regen, 2024);

    regen,
    ..Default::default()
}

/// Generate the annual academy intake — 3-5 youth prospects per team.
/// Position distribution: roughly 1 GK, 1-2 DEF, 1-2 MID, 0-1 FWD.
pub fn generate_academy_intake_regens(
    team_id: &str,
    team_reputation: u32,
    team_country: &str,
    _season: u32,
    rng: &mut impl Rng,
) -> Vec<Player> {
    use rand::RngExt;
    let count: usize = rng.random_range(3..=5);
    let mut regens = Vec::with_capacity(count);

    // Position distribution
    let positions = if count <= 3 {
        vec![Position::Goalkeeper, Position::Defender, Position::Midfielder]
    } else if count == 4 {
        vec![Position::Goalkeeper, Position::Defender, Position::Midfielder, Position::Forward]
    } else {
        vec![Position::Goalkeeper, Position::Defender, Position::Defender, Position::Midfielder, Position::Forward]
    };

    for pos in positions {
        let mut regen = generate_youth_academy_recruit_with_nationality(
            &dummy_team_for_regen(team_id, team_country),
            Some(&pos),
            None, // random nationality
        );

        // Age 16-19
        let age_roll: u32 = rng.random_range(0..100);
        let age = if age_roll < 25 { 16 } else if age_roll < 75 { 17 } else { 18 };
        let birth_year = 2024 - age;
        regen.date_of_birth = format!("{}-{:02}-{:02}", birth_year, rng.random_range(1..=12), rng.random_range(1..=28));

        // Potential
        let potential = roll_potential(&pos, team_reputation, rng);
        regen.potential = potential;

        // Attributes
        let attr_spread: u8 = rng.random_range(10..=18);
        set_attributes_for_youth(&mut regen, potential, attr_spread, &pos);

        // Personality + traits + stability
        regen.personality = random_personality(rng);
        regen.narrative_traits = random_narrative_traits(&regen, rng);
        regen.stability_modifier = rng.random_range(30..=70);
        regen.squad_role = SquadRole::Youth;
        regen.team_id = Some(team_id.to_string());
        regen.contract_end = Some(format!("{}-06-30", 2024 + 3));
        regen.wage = 1000;

        crate::player_rating::refresh_player_derived(&mut regen, 2024);
        regens.push(regen);
    }

    regens
}

/// Set a youth player's attributes relative to their potential.
/// Each attribute is potential - spread (with position-appropriate floors).
fn set_attributes_for_youth(player: &mut Player, potential: u8, spread: u8, position: &Position) {
    use rand::RngExt;
    let mut rng = rand::rng();
    let group = position.to_group_position();

    // Position-appropriate floors (young players are weak where the position doesn't train)
    let (gk_floor, def_floor, mid_floor, fwd_floor) = match group {
        Position::Goalkeeper => (40, 15, 20, 15),
        Position::Defender => (15, 40, 25, 20),
        Position::Midfielder => (15, 25, 40, 25),
        Position::Forward => (15, 20, 25, 40),
        _ => (25, 25, 25, 25),
    };

    let mut set_attr = |attr: &mut u8, floor: u8| {
        let variance: u8 = rng.random_range(0..=4);
        let base = potential.saturating_sub(spread + variance);
        *attr = base.max(floor).min(99);
    };

    // Body
    set_attr(&mut player.attributes.pace, match group { Position::Forward | Position::Defender => 35, _ => 25 });
    set_attr(&mut player.attributes.burst, 20);
    set_attr(&mut player.attributes.engine, 25);
    set_attr(&mut player.attributes.power, match group { Position::Defender | Position::Goalkeeper => 35, _ => 25 });
    set_attr(&mut player.attributes.agility, 25);

    // Ball
    set_attr(&mut player.attributes.passing, mid_floor);
    set_attr(&mut player.attributes.distribution, mid_floor);
    set_attr(&mut player.attributes.touch, match group { Position::Forward | Position::Midfielder => 35, _ => 25 });
    set_attr(&mut player.attributes.finishing, fwd_floor);
    set_attr(&mut player.attributes.defending, def_floor);
    set_attr(&mut player.attributes.aerial, match group { Position::Defender | Position::Forward | Position::Goalkeeper => 35, _ => 25 });

    // Head
    set_attr(&mut player.attributes.anticipation, 30);
    set_attr(&mut player.attributes.vision, mid_floor);
    set_attr(&mut player.attributes.decisions, 30);
    set_attr(&mut player.attributes.composure, 30);
    set_attr(&mut player.attributes.leadership, 20);

    // Gloves (only meaningful for GKs)
    set_attr(&mut player.attributes.shot_stopping, gk_floor);
    set_attr(&mut player.attributes.commanding, gk_floor);
    set_attr(&mut player.attributes.playing_out, gk_floor);
}

/// Generate a random Big Five personality profile.
/// Young players start with confidence = 100 (they haven't been tested yet).
fn random_personality(rng: &mut impl Rng) -> domain::player::PersonalityProfile {
    use rand::RngExt;
    use domain::player::PersonalityProfile;
    PersonalityProfile {
        openness: rng.random_range(20..=90),
        conscientiousness: rng.random_range(20..=90),
        extraversion: rng.random_range(20..=90),
        agreeableness: rng.random_range(20..=90),
        neuroticism: rng.random_range(10..=80),
        confidence: 100, // young players are confident
    }
}

/// Probabilistically assign 0-3 narrative traits based on the player's
/// attributes and personality. Reuses the same trait vocabulary as Phase 2.
fn random_narrative_traits(player: &Player, rng: &mut impl Rng) -> Vec<String> {
    use rand::RngExt;
    let mut traits = Vec::new();
    let a = &player.attributes;
    let pe = &player.personality;

    // Technical identity traits (attribute-threshold-based, 30% chance each if eligible)
    let tech_candidates: Vec<(&str, bool)> = vec![
        ("PressingAnchor", a.defending >= 70 && a.engine >= 70),
        ("TempoConductor", a.passing >= 75 && a.distribution >= 70),
        ("ChaosWinger", a.touch >= 75 && a.pace >= 70),
        ("DefensiveWall", a.defending >= 75 && a.aerial >= 65),
        ("CounterKiller", a.pace >= 75 && a.finishing >= 65),
    ];
    for (name, eligible) in tech_candidates {
        if eligible && rng.random_range(0.0..1.0) < 0.30 && traits.len() < 3 {
            traits.push(name.to_string());
        }
    }

    // Psychological traits (1-2, random selection from eligible)
    let psych_candidates: Vec<(&str, bool)> = vec![
        ("BigGameResponder", pe.extraversion >= 65 && pe.neuroticism < 50),
        ("MediaSensitive", pe.neuroticism >= 65),
        ("ProveThemWrong", pe.neuroticism >= 55 && pe.conscientiousness >= 55),
        ("IceCold", pe.neuroticism <= 35 && a.composure >= 70),
        ("EmotionalReactor", pe.neuroticism >= 65 && pe.extraversion >= 55),
    ];
    let eligible_psych: Vec<&str> = psych_candidates.into_iter().filter(|(_, e)| *e).map(|(n, _)| n).collect();
    if !eligible_psych.is_empty() && traits.len() < 3 {
        let pick = rng.random_range(0..eligible_psych.len());
        traits.push(eligible_psych[pick].to_string());
    }

    // Social traits (0-1, random selection from eligible)
    let social_candidates: Vec<(&str, bool)> = vec![
        ("DressingRoomAlpha", pe.extraversion >= 70 && a.leadership >= 65),
        ("QuietStabilizer", pe.agreeableness >= 65 && pe.neuroticism <= 45),
        ("CliqueBuilder", pe.extraversion >= 60 && pe.agreeableness >= 55),
        ("IsolationRisk", pe.agreeableness <= 40 && pe.neuroticism >= 50),
    ];
    let eligible_social: Vec<&str> = social_candidates.into_iter().filter(|(_, e)| *e).map(|(n, _)| n).collect();
    if !eligible_social.is_empty() && traits.len() < 3 && rng.random_range(0.0..1.0) < 0.50 {
        let pick = rng.random_range(0..eligible_social.len());
        traits.push(eligible_social[pick].to_string());
    }

    traits
}

/// Create a minimal Team struct for the youth academy generator.
/// The generator only needs id + country, so we build a minimal team.
fn dummy_team_for_regen(team_id: &str, team_country: &str) -> domain::team::Team {
    use domain::team::Team;
    Team::new(
        team_id.to_string(),
        "Regen Team".to_string(),
        "REG".to_string(),
        team_country.to_string(),
        "Unknown".to_string(),
        "Unknown Stadium".to_string(),
        0,
    )
}

// ============================================================================
// SEASON HOOKS — called from end_of_season.rs
// ============================================================================

/// Generate replacement regens for all players who retired this season.
/// Each retired player produces exactly one regen on their former team.
pub fn generate_season_regens(game: &mut Game, season: u32) {
    let mut rng = rand::rng();

    // Collect retirement info first (avoid borrow issues)
    // (player_id, team_id, position, nationality)
    let retirements: Vec<(String, String, Position, String)> = game
        .players
        .iter()
        .filter(|p| p.retired && p.retired_season == Some(season))
        .filter_map(|p| {
            p.former_team_id.as_ref().map(|tid| {
                (
                    p.id.clone(),
                    tid.clone(),
                    p.position.clone(),
                    p.nationality.clone(),
                )
            })
        })
        .collect();

    if retirements.is_empty() {
        return;
    }

    // Look up team reputation + country for each retirement
    let retirements: Vec<(String, String, Position, String, u32, String)> = retirements
        .into_iter()
        .map(|(player_id, team_id, position, nationality)| {
            let team = game.teams.iter().find(|t| t.id == team_id);
            let reputation = team.map(|t| t.reputation).unwrap_or(50);
            let country = team.map(|t| t.country.clone()).unwrap_or_else(|| "England".to_string());
            (player_id, team_id, position, nationality, reputation, country)
        })
        .collect();

    let mut new_regens = Vec::new();
    for (retired_id, team_id, _position, _nationality, reputation, country) in &retirements {
        // Find the retiring player to pass to the generator
        let retiring = game
            .players
            .iter()
            .find(|p| p.id == *retired_id);
        if let Some(retiring) = retiring {
            let regen = generate_replacement_regen(
                retiring,
                team_id,
                *reputation,
                country,
                season,
                &mut rng,
            );
            new_regens.push(regen);
        }
    }

    // Add initial relationships: +20 to all current teammates
    for regen in &mut new_regens {
        if let Some(team_id) = &regen.team_id {
            let teammate_ids: Vec<String> = game
                .players
                .iter()
                .filter(|p| p.team_id.as_deref() == Some(team_id.as_str()) && p.id != regen.id && !p.retired)
                .map(|p| p.id.clone())
                .collect();
            for teammate_id in teammate_ids {
                game.relationship_graph.set_edge(
                    &regen.id,
                    &teammate_id,
                    20,   // neutral-positive (new kid)
                    0.2,  // low volatility (no history yet)
                );
            }
        }
    }

    // Add regens to the game
    for regen in new_regens {
        game.players.push(regen);
    }
}

/// Generate annual academy intake: 3-5 youth prospects per team.
pub fn generate_academy_intake(game: &mut Game, _season: u32) {
    let mut rng = rand::rng();

    let team_info: Vec<(String, u32, String)> = game
        .teams
        .iter()
        .map(|t| (t.id.clone(), t.reputation, t.country.clone()))
        .collect();

    let mut all_new_regens = Vec::new();
    for (team_id, reputation, country) in &team_info {
        let regens = generate_academy_intake_regens(team_id, *reputation, &country, _season, &mut rng);
        all_new_regens.extend(regens);
    }

    // V99.3 VITAL-1 M5: Generate inbox messages for the user's team's
    // academy intake. Previously regens were pushed silently — the user's
    // squad grew 3-5 youth/year with no notification.
    if let Some(user_team_id) = &game.manager.team_id {
        let user_intake: Vec<&domain::player::Player> = all_new_regens
            .iter()
            .filter(|r| r.team_id.as_deref() == Some(user_team_id.as_str()))
            .collect();
        if !user_intake.is_empty() {
            let team_name = game
                .teams
                .iter()
                .find(|t| &t.id == user_team_id)
                .map(|t| t.name.clone())
                .unwrap_or_default();
            let today = game.clock.current_date.format("%Y-%m-%d").to_string();
            let body = if user_intake.len() == 1 {
                format!(
                    "The academy has produced a new prospect: {}, a {}-year-old {}. \
                     Have a look at him in the squad screen.",
                    user_intake[0].full_name,
                    player_age(&user_intake[0].date_of_birth, _season),
                    format!("{:?}", user_intake[0].position).to_lowercase(),
                )
            } else {
                let names: Vec<&str> = user_intake.iter().map(|p| p.match_name.as_str()).collect();
                format!(
                    "The academy has produced {} new prospects this year: {}. \
                     Have a look at them in the squad screen.",
                    user_intake.len(),
                    names.join(", "),
                )
            };
            game.messages.push(domain::message::InboxMessage {
                id: format!("academy_intake_{}_{}", today, user_team_id),
                subject: format!("Academy Intake — {}", team_name),
                body,
                sender: "Academy Director".to_string(),
                sender_role: "Staff".to_string(),
                date: today,
                category: domain::message::MessageCategory::Training,
                priority: domain::message::MessagePriority::Normal,
                context: domain::message::MessageContext {
                    team_id: Some(user_team_id.clone()),
                    team_name: Some(team_name),
                    player_id: user_intake.first().map(|p| p.id.clone()),
                    fixture_id: None,
                    match_result: None,
                },
                actions: vec![],
                read: false,
                subject_key: None,
                body_key: None,
                sender_key: None,
                sender_role_key: None,
                i18n_params: std::collections::HashMap::new(),
            });
        }
    }

    // Add initial relationships for academy intake too
    for regen in &mut all_new_regens {
        if let Some(team_id) = &regen.team_id {
            let teammate_ids: Vec<String> = game
                .players
                .iter()
                .filter(|p| p.team_id.as_deref() == Some(team_id.as_str()) && p.id != regen.id && !p.retired)
                .map(|p| p.id.clone())
                .collect();
            for teammate_id in teammate_ids {
                game.relationship_graph.set_edge(
                    &regen.id,
                    &teammate_id,
                    15,   // slightly lower than replacement regens (these are pure academy intake)
                    0.2,
                );
            }
        }
    }

    for regen in all_new_regens {
        game.players.push(regen);
    }
}

/// V99.3: Simple age calculation for message formatting.
fn player_age(date_of_birth: &str, season: u32) -> u32 {
    if let Ok(dob) = chrono::NaiveDate::parse_from_str(date_of_birth, "%Y-%m-%d") {
        return season.saturating_sub(dob.year() as u32);
    }
    17
}

/// Clear ScoutingKnowledge entries for retired players.
/// They're gone — no point keeping stale scouting data.
pub fn cleanup_retired_player_scouting(game: &mut Game) {
    let retired_ids: Vec<String> = game
        .players
        .iter()
        .filter(|p| p.retired)
        .map(|p| p.id.clone())
        .collect();
    for id in retired_ids {
        game.scouting_knowledge.remove(&id);
    }
}

// ============================================================================
// TESTS
// ============================================================================
#[cfg(test)]
mod tests {
    use super::*;
    use domain::player::{PersonalityProfile, Player, PlayerAttributes, Position};

    fn make_test_player(position: Position, nationality: &str) -> Player {
        let attrs = PlayerAttributes {
            pace: 70, burst: 70, engine: 70, power: 70, agility: 70,
            passing: 70, distribution: 70, touch: 70, finishing: 70,
            defending: 70, aerial: 70, anticipation: 70, vision: 70,
            decisions: 70, composure: 70, leadership: 70,
            shot_stopping: 70, commanding: 70, playing_out: 70,
            ..Default::default()
        };
        let mut p = Player::new(
            "retiree_1".to_string(),
            "Test Retiree".to_string(),
            "Test Retiree".to_string(),
            "1990-01-01".to_string(),
            nationality.to_string(),
            position.clone(),
            attrs,
        );
        p.ovr = 75;
        p.potential = 80;
        p
    }

    #[test]
    fn potential_band_for_goalkeeper() {
        let (min, max) = potential_band_for_position(&Position::Goalkeeper);
        assert_eq!(min, 50);
        assert_eq!(max, 85);
    }

    #[test]
    fn potential_band_for_forward_has_widest_ceiling() {
        let (min, max) = potential_band_for_position(&Position::Forward);
        assert_eq!(min, 45);
        assert_eq!(max, 92);
    }

    #[test]
    fn potential_band_for_defender() {
        let (min, max) = potential_band_for_position(&Position::Defender);
        assert_eq!(min, 45);
        assert_eq!(max, 88);
    }

    #[test]
    fn potential_band_for_midfielder() {
        let (min, max) = potential_band_for_position(&Position::Midfielder);
        assert_eq!(min, 45);
        assert_eq!(max, 90);
    }

    #[test]
    fn reputation_bias_high_reputation() {
        assert_eq!(reputation_bias(85), 5);
        assert_eq!(reputation_bias(80), 5);
    }

    #[test]
    fn reputation_bias_medium_reputation() {
        assert_eq!(reputation_bias(70), 3);
        assert_eq!(reputation_bias(65), 3);
    }

    #[test]
    fn reputation_bias_low_reputation() {
        assert_eq!(reputation_bias(55), 1);
        assert_eq!(reputation_bias(40), 0);
    }

    #[test]
    fn roll_potential_within_band() {
        let mut rng = rand::rng();
        for _ in 0..1000 {
            let p = roll_potential(&Position::Midfielder, 60, &mut rng);
            // Midfielder band: 45-90, +1 bias for rep 60
            assert!((45..=91).contains(&p), "potential {} out of range", p);
        }
    }

    #[test]
    fn roll_potential_biased_upward_for_big_clubs() {
        let mut rng = rand::rng();
        // Big club (rep 85): +5 bias → band 50-95
        let mut big_club_potentials = Vec::new();
        for _ in 0..1000 {
            big_club_potentials.push(roll_potential(&Position::Forward, 85, &mut rng));
        }
        let avg_big: f64 = big_club_potentials.iter().map(|&p| p as f64).sum::<f64>() / 1000.0;

        // Small club (rep 40): +0 bias → band 45-92
        let mut small_club_potentials = Vec::new();
        for _ in 0..1000 {
            small_club_potentials.push(roll_potential(&Position::Forward, 40, &mut rng));
        }
        let avg_small: f64 = small_club_potentials.iter().map(|&p| p as f64).sum::<f64>() / 1000.0;

        // Big club average should be higher
        assert!(avg_big > avg_small, "big club avg {} should be > small club avg {}", avg_big, avg_small);
    }

    #[test]
    fn replacement_regen_has_valid_attributes() {
        let retiring = make_test_player(Position::Midfielder, "England");
        let mut rng = rand::rng();
        let regen = generate_replacement_regen(&retiring, "team_1", 70, "England", 2024, &mut rng);

        // All 19 attributes in 1-99 range
        let a = &regen.attributes;
        let all_attrs = [a.pace, a.burst, a.engine, a.power, a.agility, a.passing, a.distribution, a.touch, a.finishing, a.defending, a.aerial, a.anticipation, a.vision, a.decisions, a.composure, a.leadership, a.shot_stopping, a.commanding, a.playing_out];
        for v in all_attrs {
            assert!((1..=99).contains(&v), "attribute {} out of range", v);
        }
    }

    #[test]
    fn replacement_regen_is_youth_role() {
        let retiring = make_test_player(Position::Forward, "Spain");
        let mut rng = rand::rng();
        let regen = generate_replacement_regen(&retiring, "team_1", 60, "Spain", 2024, &mut rng);
        assert_eq!(regen.squad_role, SquadRole::Youth);
    }

    #[test]
    fn replacement_regen_assigned_to_team() {
        let retiring = make_test_player(Position::Defender, "England");
        let mut rng = rand::rng();
        let regen = generate_replacement_regen(&retiring, "arsenal", 85, "England", 2024, &mut rng);
        assert_eq!(regen.team_id, Some("arsenal".to_string()));
    }

    #[test]
    fn replacement_regen_age_is_16_to_19() {
        let retiring = make_test_player(Position::Midfielder, "England");
        let mut rng = rand::rng();
        for _ in 0..100 {
            let regen = generate_replacement_regen(&retiring, "team_1", 60, "England", 2024, &mut rng);
            let birth_year: u32 = regen.date_of_birth.split('-').next().unwrap().parse().unwrap();
            let age = 2024 - birth_year;
            assert!((16..=19).contains(&age), "regen age {} out of range", age);
        }
    }

    #[test]
    fn replacement_regen_has_confident_personality() {
        let retiring = make_test_player(Position::Midfielder, "England");
        let mut rng = rand::rng();
        let regen = generate_replacement_regen(&retiring, "team_1", 60, "England", 2024, &mut rng);
        assert_eq!(regen.personality.confidence, 100, "young players should be confident");
    }

    #[test]
    fn replacement_regen_stability_in_range() {
        let retiring = make_test_player(Position::Midfielder, "England");
        let mut rng = rand::rng();
        for _ in 0..100 {
            let regen = generate_replacement_regen(&retiring, "team_1", 60, "England", 2024, &mut rng);
            assert!((30..=70).contains(&regen.stability_modifier), "stability {} out of range", regen.stability_modifier);
        }
    }

    #[test]
    fn replacement_regen_has_contract() {
        let retiring = make_test_player(Position::Midfielder, "England");
        let mut rng = rand::rng();
        let regen = generate_replacement_regen(&retiring, "team_1", 60, "England", 2024, &mut rng);
        assert!(regen.contract_end.is_some());
        assert!(regen.wage > 0);
    }

    #[test]
    fn academy_intake_generates_3_to_5_per_team() {
        let mut rng = rand::rng();
        for _ in 0..20 {
            let regens = generate_academy_intake_regens("team_1", 60, "England", 2024, &mut rng);
            assert!((3..=5).contains(&regens.len()), "intake count {} out of range", regens.len());
        }
    }

    #[test]
    fn academy_intake_all_youth_role() {
        let mut rng = rand::rng();
        let regens = generate_academy_intake_regens("team_1", 60, "England", 2024, &mut rng);
        for r in &regens {
            assert_eq!(r.squad_role, SquadRole::Youth);
        }
    }

    #[test]
    fn academy_intake_all_assigned_to_team() {
        let mut rng = rand::rng();
        let regens = generate_academy_intake_regens("arsenal", 85, "England", 2024, &mut rng);
        for r in &regens {
            assert_eq!(r.team_id, Some("arsenal".to_string()));
        }
    }

    #[test]
    fn random_personality_has_confidence_100() {
        let mut rng = rand::rng();
        let p = random_personality(&mut rng);
        assert_eq!(p.confidence, 100);
    }

    #[test]
    fn random_personality_axes_in_range() {
        let mut rng = rand::rng();
        for _ in 0..100 {
            let p = random_personality(&mut rng);
            assert!((20..=90).contains(&p.openness));
            assert!((20..=90).contains(&p.conscientiousness));
            assert!((20..=90).contains(&p.extraversion));
            assert!((20..=90).contains(&p.agreeableness));
            assert!((10..=80).contains(&p.neuroticism));
        }
    }

    #[test]
    fn narrative_traits_max_3() {
        let mut player = make_test_player(Position::Midfielder, "England");
        player.personality = PersonalityProfile {
            openness: 90, conscientiousness: 90, extraversion: 90,
            agreeableness: 90, neuroticism: 10, confidence: 100,
        };
        player.attributes.composure = 90;
        player.attributes.leadership = 90;
        let mut rng = rand::rng();
        for _ in 0..100 {
            let traits = random_narrative_traits(&player, &mut rng);
            assert!(traits.len() <= 3, "too many traits: {}", traits.len());
        }
    }
}
