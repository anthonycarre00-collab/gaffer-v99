use crate::game::Game;
use chrono::NaiveDate;
use domain::manager::{Manager, ManagerCareerEntry};
use domain::staff::{Staff, StaffRole};

const BASE_AI_MANAGER_SATISFACTION: i32 = 50;
const AI_MANAGER_REPLACEMENT_DELAY_DAYS: u32 = 7;
const USER_RIVALRY_SATISFACTION_PENALTY: i32 = 10;
const USER_RIVALRY_LOOKBACK_DAYS: i64 = 14;

fn manager_seed_staff<'a>(staff: &'a [Staff], team_id: &str) -> Option<&'a Staff> {
    staff
        .iter()
        .filter(|member| member.team_id.as_deref() == Some(team_id))
        .find(|member| member.role == StaffRole::AssistantManager)
        .or_else(|| {
            staff
                .iter()
                .filter(|member| member.team_id.as_deref() == Some(team_id))
                .min_by(|left, right| left.id.cmp(&right.id))
        })
}

fn next_seeded_manager_id(game: &Game, team_id: &str, source_staff: &Staff) -> String {
    let base_id = format!("mgr_{}_{}", team_id, source_staff.id);
    if !game.managers.iter().any(|manager| manager.id == base_id) {
        return base_id;
    }

    let mut sequence = 2;
    loop {
        let candidate = format!("{}_{}", base_id, sequence);
        if !game.managers.iter().any(|manager| manager.id == candidate) {
            return candidate;
        }
        sequence += 1;
    }
}

fn create_seeded_manager(
    game: &Game,
    team_id: &str,
    source_staff: &Staff,
    manager_id: String,
) -> Option<Manager> {
    let team = game.teams.iter().find(|team| team.id == team_id)?;
    let nationality = if source_staff.nationality.is_empty() {
        team.country.clone()
    } else {
        source_staff.nationality.clone()
    };

    let mut manager = Manager::new(
        manager_id,
        source_staff.first_name.clone(),
        source_staff.last_name.clone(),
        source_staff.date_of_birth.clone(),
        nationality,
    );
    manager.reputation = team.reputation;
    manager.satisfaction = BASE_AI_MANAGER_SATISFACTION as u8;
    manager.fan_approval = 50;
    // V99.4 T1.7: Generate a random personality for this AI manager.
    manager.personality = generate_random_personality(team.reputation);
    manager.hire(team.id.clone());
    manager.career_history.push(ManagerCareerEntry::open(
        team.id.clone(),
        team.name.clone(),
        game.clock.current_date.format("%Y-%m-%d").to_string(),
    ));
    Some(manager)
}

/// V99.4 T1.7: Generate a random manager personality.
///
/// Higher-reputation clubs tend to attract more tactically astute managers
/// (Guardiola, Klopp). Lower-reputation clubs tend to get more pragmatic,
/// defensive managers (Allardyce, Pulis).
fn generate_random_personality(team_reputation: u32) -> domain::manager::ManagerPersonality {
    use domain::manager::{MediaStyle, TacticalStyle, TransferPhilosophy};
    use rand::Rng;
    let mut rng = rand::rng();

    // Tactical style: weighted by club reputation.
    // Elite clubs: more Possession/Pressing. Lower clubs: more Direct/Defensive.
    let tactical_style = if team_reputation >= 700 {
        // Elite: 30% Possession, 25% Pressing, 20% Counter, 15% Balanced, 10% Defensive
        match rng.random_range(0..100) {
            0..=29 => TacticalStyle::Possession,
            30..=54 => TacticalStyle::Pressing,
            55..=74 => TacticalStyle::Counter,
            75..=89 => TacticalStyle::Balanced,
            _ => TacticalStyle::Defensive,
        }
    } else if team_reputation >= 400 {
        // Mid-tier: 20% Counter, 20% Balanced, 20% Direct, 20% Defensive, 20% Possession
        match rng.random_range(0..100) {
            0..=19 => TacticalStyle::Counter,
            20..=39 => TacticalStyle::Balanced,
            40..=59 => TacticalStyle::Direct,
            60..=79 => TacticalStyle::Defensive,
            _ => TacticalStyle::Possession,
        }
    } else {
        // Lower: 35% Direct, 30% Defensive, 20% Counter, 15% Balanced
        match rng.random_range(0..100) {
            0..=34 => TacticalStyle::Direct,
            35..=64 => TacticalStyle::Defensive,
            65..=84 => TacticalStyle::Counter,
            _ => TacticalStyle::Balanced,
        }
    };

    // Tactical acumen: higher for elite clubs (40-90 range vs 20-60 for lower).
    let acumen_base = if team_reputation >= 700 { 40 } else if team_reputation >= 400 { 30 } else { 20 };
    let acumen_range = if team_reputation >= 700 { 50 } else if team_reputation >= 400 { 40 } else { 40 };
    let tactical_acumen = (acumen_base + rng.random_range(0..acumen_range)).min(95) as u8;

    // Transfer philosophy: correlated with tactical style.
    let transfer_philosophy = match tactical_style {
        TacticalStyle::Possession | TacticalStyle::Pressing => {
            // Attacking managers prefer stars or youth.
            if rng.random_range(0..2) == 0 {
                TransferPhilosophy::StarSigning
            } else {
                TransferPhilosophy::YouthFocused
            }
        }
        TacticalStyle::Direct | TacticalStyle::Defensive => {
            // Pragmatic managers look for bargains or build squads.
            if rng.random_range(0..2) == 0 {
                TransferPhilosophy::BargainHunter
            } else {
                TransferPhilosophy::SquadBuilder
            }
        }
        _ => TransferPhilosophy::SquadBuilder,
    };

    // Man-management: random 30-80, slightly higher for elite.
    let mm_base = if team_reputation >= 700 { 40 } else { 30 };
    let man_management = (mm_base + rng.random_range(0..40)).min(90) as u8;

    // Risk appetite: correlated with tactical style.
    let risk_appetite = match tactical_style {
        TacticalStyle::Possession | TacticalStyle::Pressing => 60 + rng.random_range(0..30),
        TacticalStyle::Direct => 50 + rng.random_range(0..30),
        TacticalStyle::Counter => 40 + rng.random_range(0..30),
        TacticalStyle::Defensive => 25 + rng.random_range(0..30),
        _ => 45 + rng.random_range(0..30),
    };

    // Media personality: random.
    let media_style = match rng.random_range(0..4) {
        0 => MediaStyle::Reserved,
        1 => MediaStyle::Outspoken,
        2 => MediaStyle::Charismatic,
        _ => MediaStyle::Pragmatic,
    };

    domain::manager::ManagerPersonality {
        tactical_style,
        tactical_acumen,
        transfer_philosophy,
        man_management,
        risk_appetite: risk_appetite.min(95) as u8,
        media_style,
    }
}

fn ai_manager_satisfaction(form: &[String]) -> u8 {
    let mut satisfaction = BASE_AI_MANAGER_SATISFACTION;

    for result in form {
        match result.as_str() {
            "W" => satisfaction += 8,
            "D" => satisfaction += 1,
            "L" => satisfaction -= 12,
            _ => {}
        }
    }

    if form.iter().rev().take(4).count() == 4
        && form.iter().rev().take(4).all(|result| result == "L")
    {
        satisfaction -= 12;
    }

    satisfaction.clamp(0, 100) as u8
}

fn recent_loss_to_user_penalty(game: &Game, team_id: &str) -> i32 {
    let Some(user_team_id) = game.manager.team_id.as_deref() else {
        return 0;
    };
    let Some(league) = &game.league else {
        return 0;
    };

    let current_date = game.clock.current_date.date_naive();

    let recent_loss = league.fixtures.iter().any(|fixture| {
        if !fixture.counts_for_league_standings()
            || fixture.status != domain::league::FixtureStatus::Completed
        {
            return false;
        }

        let involves_user_and_team = (fixture.home_team_id == team_id
            && fixture.away_team_id == user_team_id)
            || (fixture.home_team_id == user_team_id && fixture.away_team_id == team_id);
        if !involves_user_and_team {
            return false;
        }

        let Some(result) = fixture.result.as_ref() else {
            return false;
        };

        let fixture_date = NaiveDate::parse_from_str(&fixture.date, "%Y-%m-%d").ok();
        let within_lookback = fixture_date
            .map(|date| {
                let days_ago = (current_date - date).num_days();
                (0..=USER_RIVALRY_LOOKBACK_DAYS).contains(&days_ago)
            })
            .unwrap_or(false);
        if !within_lookback {
            return false;
        }

        if fixture.home_team_id == team_id {
            result.home_goals < result.away_goals
        } else {
            result.away_goals < result.home_goals
        }
    });

    if recent_loss {
        USER_RIVALRY_SATISFACTION_PENALTY
    } else {
        0
    }
}

fn team_has_manager_history(game: &Game, team_id: &str) -> bool {
    game.managers.iter().any(|manager| {
        manager.team_id.as_deref() == Some(team_id)
            || manager
                .career_history
                .iter()
                .any(|entry| entry.team_id == team_id)
    })
}

pub fn seed_ai_managers(game: &mut Game) {
    if game.manager_id.is_empty() {
        game.manager_id = game.manager.id.clone();
    }
    game.sync_user_manager_record();

    let user_team_id = game.manager.team_id.clone();

    let team_ids_to_seed: Vec<String> = game
        .teams
        .iter()
        .filter(|team| Some(team.id.clone()) != user_team_id)
        .filter(|team| {
            team.manager_id
                .as_ref()
                .and_then(|manager_id| {
                    game.managers
                        .iter()
                        .find(|manager| &manager.id == manager_id)
                })
                .is_none()
        })
        .filter(|team| !team_has_manager_history(game, &team.id))
        .map(|team| team.id.clone())
        .collect();

    for team_id in team_ids_to_seed {
        let Some(source_staff) = manager_seed_staff(&game.staff, &team_id) else {
            continue;
        };
        let manager_id = next_seeded_manager_id(game, &team_id, source_staff);
        let Some(manager) = create_seeded_manager(game, &team_id, source_staff, manager_id) else {
            continue;
        };
        if let Some(team) = game.teams.iter_mut().find(|team| team.id == team_id) {
            team.manager_id = Some(manager.id.clone());
        }
        crate::job_offers::expire_outstanding_job_offers_for_team(game, &team_id);
        game.managers.push(manager);
    }

    game.sync_user_manager_record();
}

pub fn process_vacant_ai_clubs(game: &mut Game) {
    let user_team_id = game.manager.team_id.clone();

    let occupied_team_ids: Vec<String> = game
        .teams
        .iter()
        .filter(|team| team.manager_id.is_some())
        .map(|team| team.id.clone())
        .collect();
    for team_id in occupied_team_ids {
        game.vacant_team_days.remove(&team_id);
    }

    let vacant_team_ids: Vec<String> = game
        .teams
        .iter()
        .filter(|team| Some(team.id.clone()) != user_team_id)
        .filter(|team| team.manager_id.is_none())
        .map(|team| team.id.clone())
        .collect();

    for team_id in vacant_team_ids {
        let days_vacant = game.vacant_team_days.get(&team_id).copied().unwrap_or(0) + 1;
        game.vacant_team_days.insert(team_id.clone(), days_vacant);

        if days_vacant < AI_MANAGER_REPLACEMENT_DELAY_DAYS {
            continue;
        }

        let Some(source_staff) = manager_seed_staff(&game.staff, &team_id) else {
            continue;
        };
        let manager_id = next_seeded_manager_id(game, &team_id, source_staff);
        let Some(manager) = create_seeded_manager(game, &team_id, source_staff, manager_id) else {
            continue;
        };
        let team_name = game
            .teams
            .iter()
            .find(|team| team.id == team_id)
            .map(|team| team.name.clone())
            .unwrap_or_else(|| team_id.clone());
        let today = game.clock.current_date.format("%Y-%m-%d").to_string();

        if let Some(team) = game.teams.iter_mut().find(|team| team.id == team_id) {
            team.manager_id = Some(manager.id.clone());
        }
        crate::job_offers::expire_outstanding_job_offers_for_team(game, &team_id);
        game.news.push(crate::news::managerial_appointment_article(
            &manager.id,
            &manager.full_name(),
            &team_id,
            &team_name,
            &today,
        ));
        game.managers.push(manager);
        game.vacant_team_days.remove(&team_id);
    }

    game.sync_user_manager_record();
}

/// V99.4 T1.4: AI manager poaching.
///
/// Elite clubs (reputation >= 700) can poach managers from smaller clubs
/// (reputation gap >= 150). The poached manager moves to the bigger club,
/// leaving their old club vacant (filled by existing process_vacant_ai_clubs).
///
/// Called at end-of-season to allow managerial movement between seasons.
pub fn process_ai_manager_poaching(game: &mut Game) {
    let user_manager_id = if game.manager_id.is_empty() {
        game.manager.id.clone()
    } else {
        game.manager_id.clone()
    };

    // Collect elite clubs with vacant manager slots (reputation >= 700).
    let elite_vacant_teams: Vec<(String, String, u32)> = game
        .teams
        .iter()
        .filter(|t| t.manager_id.is_none() && t.reputation >= 700)
        .map(|t| (t.id.clone(), t.name.clone(), t.reputation))
        .collect();

    if elite_vacant_teams.is_empty() {
        return;
    }

    let today = game.clock.current_date.format("%Y-%m-%d").to_string();

    // For each elite vacant club, try to poach a manager from a smaller club.
    for (team_id, team_name, team_rep) in &elite_vacant_teams {
        // Find AI managers at clubs with reputation <= (elite_rep - 150).
        let poach_threshold = team_rep.saturating_sub(150);
        let candidates: Vec<(usize, String, String, String)> = game
            .managers
            .iter()
            .enumerate()
            .filter(|(_, m)| m.id != user_manager_id && m.team_id.is_some())
            .filter_map(|(idx, m)| {
                let mgr_team_id = m.team_id.as_ref()?;
                let mgr_team = game.teams.iter().find(|t| &t.id == mgr_team_id)?;
                if mgr_team.reputation <= poach_threshold {
                    Some((idx, m.id.clone(), m.full_name(), mgr_team_id.clone()))
                } else {
                    None
                }
            })
            .collect();

        if candidates.is_empty() {
            continue;
        }

        // Pick the first candidate.
        let (_mgr_idx, mgr_id, mgr_name, old_team_id) = &candidates[0];

        // Move the manager to the elite club.
        if let Some(mgr) = game.managers.iter_mut().find(|m| &m.id == mgr_id) {
            mgr.team_id = Some(team_id.clone());
        }

        // Set the elite club's manager_id.
        if let Some(team) = game.teams.iter_mut().find(|t| &t.id == team_id) {
            team.manager_id = Some(mgr_id.clone());
        }

        // Clear the old club's manager_id (creates a vacancy).
        if let Some(team) = game.teams.iter_mut().find(|t| &t.id == old_team_id) {
            team.manager_id = None;
        }

        // Generate a news article.
        game.news.push(domain::news::NewsArticle {
            id: format!("manager_poach_{}_{}", today, team_id),
            headline: format!("{} appointed at {}", mgr_name, team_name),
            body: format!(
                "{} has been appointed as the new manager of {}, \
                 leaving his previous post. The club moved quickly to \
                 secure his services.",
                mgr_name, team_name
            ),
            source: "League Wire".to_string(),
            date: today.clone(),
            category: domain::news::NewsCategory::ManagerialChange,
            team_ids: vec![team_id.clone(), old_team_id.clone()],
            player_ids: vec![],
            match_score: None,
            read: false,
            headline_key: None,
            body_key: None,
            source_key: None,
            i18n_params: std::collections::HashMap::new(),
        });

        log::info!(
            "[ai_poach] {} moved from {} to {}",
            mgr_name,
            old_team_id,
            team_name
        );
    }
}

pub fn update_ai_manager_satisfaction(game: &mut Game) {
    let user_manager_id = if game.manager_id.is_empty() {
        game.manager.id.clone()
    } else {
        game.manager_id.clone()
    };

    for index in 0..game.managers.len() {
        if game.managers[index].id == user_manager_id {
            continue;
        }

        let Some(team_id) = game.managers[index].team_id.clone() else {
            continue;
        };
        let Some(team) = game.teams.iter().find(|team| team.id == team_id) else {
            continue;
        };

        let base_satisfaction = i32::from(ai_manager_satisfaction(&team.form));
        let adjusted_satisfaction =
            (base_satisfaction - recent_loss_to_user_penalty(game, &team_id)).clamp(0, 100) as u8;

        game.managers[index].satisfaction = adjusted_satisfaction;
    }
}

#[cfg(test)]
mod tests {
    use super::{process_vacant_ai_clubs, seed_ai_managers, update_ai_manager_satisfaction};
    use crate::clock::GameClock;
    use crate::game::Game;
    use chrono::{TimeZone, Utc};
    use domain::league::{Fixture, FixtureStatus, League, MatchResult};
    use domain::manager::Manager;
    use domain::message::{ActionType, InboxMessage, MessageAction, MessageContext};
    use domain::staff::{Staff, StaffAttributes, StaffRole};
    use domain::team::Team;

    fn make_team(id: &str, name: &str) -> Team {
        Team::new(
            id.to_string(),
            name.to_string(),
            name[..3].to_string(),
            "England".to_string(),
            "Testville".to_string(),
            "Test Ground".to_string(),
            20_000,
        )
            ..Default::default()
        }

    fn make_staff(
        id: &str,
        team_id: &str,
        role: StaffRole,
        first_name: &str,
        last_name: &str,
    ) -> Staff {
        let mut staff = Staff::new(
            id.to_string(),
            first_name.to_string(),
            last_name.to_string(),
            "1980-01-01".to_string(),
            role,
            StaffAttributes {
                coaching: 60,
                judging_ability: 60,
                judging_potential: 60,
                physiotherapy: 20,
            },
        );
        staff.nationality = "England".to_string();
        staff.team_id = Some(team_id.to_string());
        staff
    }

    fn make_game() -> Game {
        let clock = GameClock::new(Utc.with_ymd_and_hms(2026, 7, 1, 12, 0, 0).unwrap());
        let mut manager = Manager::new(
            "mgr1".to_string(),
            "Alex".to_string(),
            "Boss".to_string(),
            "1980-01-01".to_string(),
            "England".to_string(),
        );
        manager.hire("team1".to_string());

        let mut user_team = make_team("team1", "Test FC");
        user_team.manager_id = Some("mgr1".to_string());
        let rival_team = make_team("team2", "Rival FC");

        Game::new(
            clock,
            manager,
            vec![user_team, rival_team],
            vec![],
            vec![
                make_staff(
                    "staff1",
                    "team1",
                    StaffRole::AssistantManager,
                    "Amy",
                    "Assistant",
                ),
                make_staff(
                    "staff2",
                    "team2",
                    StaffRole::AssistantManager,
                    "Marco",
                    "Rossi",
                ),
            ],
            vec![],
        )
    }

    #[test]
    fn seed_ai_managers_assigns_missing_manager_to_ai_club() {
        let mut game = make_game();

        seed_ai_managers(&mut game);

        let rival_team = game.teams.iter().find(|team| team.id == "team2").unwrap();
        assert!(rival_team.manager_id.is_some());
        assert_eq!(game.managers.len(), 2);
        assert!(game.managers.iter().any(|manager| {
            manager.team_id.as_deref() == Some("team2") && manager.full_name() == "Marco Rossi"
        }));
    }

    #[test]
    fn update_ai_manager_satisfaction_penalizes_heavy_losing_run() {
        let mut game = make_game();
        seed_ai_managers(&mut game);

        game.teams
            .iter_mut()
            .find(|team| team.id == "team2")
            .unwrap()
            .form = vec![
            "L".to_string(),
            "L".to_string(),
            "L".to_string(),
            "L".to_string(),
        ];

        update_ai_manager_satisfaction(&mut game);

        let rival_manager = game
            .managers
            .iter()
            .find(|manager| manager.team_id.as_deref() == Some("team2"))
            .unwrap();
        assert!(
            rival_manager.satisfaction <= 10,
            "Four straight defeats should push an AI manager into the firing zone"
        );
    }

    #[test]
    fn update_ai_manager_satisfaction_penalizes_recent_loss_to_user_more_heavily() {
        let mut baseline_game = make_game();
        seed_ai_managers(&mut baseline_game);
        baseline_game
            .teams
            .iter_mut()
            .find(|team| team.id == "team2")
            .unwrap()
            .form = vec!["W".to_string(), "L".to_string()];

        let mut rivalry_game = baseline_game.clone();
        let league = League {
            id: "league-1".to_string(),
            name: "Test League".to_string(),
            season: 1,
            standings: vec![],
            transfer_log: vec![],
            transfer_rumours: vec![],
            fixtures: vec![Fixture {
                id: "fixture-user-rival".to_string(),
                matchday: 1,
                date: "2026-07-01".to_string(),
                home_team_id: "team2".to_string(),
                away_team_id: "team1".to_string(),
                status: FixtureStatus::Completed,
                result: Some(MatchResult {
                    home_goals: 0,
                    away_goals: 1,
                    home_scorers: vec![],
                    away_scorers: vec![],
                    report: None,
                    home_penalties: None,
                    away_penalties: None,
            ..Default::default()
        
                }),
                ..Fixture::default()
            }],
            ..Default::default()
        };
        rivalry_game.league = Some(league);

        update_ai_manager_satisfaction(&mut baseline_game);
        update_ai_manager_satisfaction(&mut rivalry_game);

        let baseline = baseline_game
            .managers
            .iter()
            .find(|manager| manager.team_id.as_deref() == Some("team2"))
            .unwrap()
            .satisfaction;
        let rivalry = rivalry_game
            .managers
            .iter()
            .find(|manager| manager.team_id.as_deref() == Some("team2"))
            .unwrap()
            .satisfaction;

        assert!(
            rivalry < baseline,
            "A recent defeat to the user should hit AI manager satisfaction harder than the same form alone"
        );
    }

    #[test]
    fn seed_ai_managers_does_not_refill_historic_vacancy() {
        let mut game = make_game();
        seed_ai_managers(&mut game);

        let previous_manager_id = game
            .teams
            .iter()
            .find(|team| team.id == "team2")
            .and_then(|team| team.manager_id.clone())
            .unwrap();

        if let Some(team) = game.teams.iter_mut().find(|team| team.id == "team2") {
            team.manager_id = None;
        }
        if let Some(manager) = game
            .managers
            .iter_mut()
            .find(|manager| manager.id == previous_manager_id)
        {
            manager.fire("2026-07-15");
        }

        seed_ai_managers(&mut game);

        assert!(
            game.teams
                .iter()
                .find(|team| team.id == "team2")
                .and_then(|team| team.manager_id.clone())
                .is_none()
        );
        assert!(
            game.managers
                .iter()
                .all(|manager| manager.id != format!("{}_2", previous_manager_id))
        );
    }

    #[test]
    fn process_vacant_ai_clubs_hires_replacement_after_delay() {
        let mut game = make_game();
        seed_ai_managers(&mut game);

        let previous_manager_id = game
            .teams
            .iter()
            .find(|team| team.id == "team2")
            .and_then(|team| team.manager_id.clone())
            .unwrap();

        if let Some(team) = game.teams.iter_mut().find(|team| team.id == "team2") {
            team.manager_id = None;
        }
        if let Some(manager) = game
            .managers
            .iter_mut()
            .find(|manager| manager.id == previous_manager_id)
        {
            manager.fire("2026-07-15");
        }
        game.vacant_team_days.insert("team2".to_string(), 6);

        process_vacant_ai_clubs(&mut game);

        let replacement_manager_id = game
            .teams
            .iter()
            .find(|team| team.id == "team2")
            .and_then(|team| team.manager_id.clone())
            .expect("vacant AI club should get a replacement manager after the delay");

        assert_ne!(replacement_manager_id, previous_manager_id);
        assert!(
            game.managers
                .iter()
                .any(|manager| manager.id == replacement_manager_id
                    && manager.team_id.as_deref() == Some("team2"))
        );
        assert!(!game.vacant_team_days.contains_key("team2"));
    }

    #[test]
    fn process_vacant_ai_clubs_creates_managerial_appointment_news_for_replacement() {
        let mut game = make_game();
        seed_ai_managers(&mut game);

        let previous_manager_id = game
            .teams
            .iter()
            .find(|team| team.id == "team2")
            .and_then(|team| team.manager_id.clone())
            .unwrap();

        if let Some(team) = game.teams.iter_mut().find(|team| team.id == "team2") {
            team.manager_id = None;
        }
        if let Some(manager) = game
            .managers
            .iter_mut()
            .find(|manager| manager.id == previous_manager_id)
        {
            manager.fire("2026-07-15");
        }
        game.vacant_team_days.insert("team2".to_string(), 6);

        process_vacant_ai_clubs(&mut game);

        assert!(game.news.iter().any(|article| {
            article.category == domain::news::NewsCategory::ManagerialChange
                && article.team_ids.contains(&"team2".to_string())
                && article.headline_key.as_deref() == Some("be.news.managerialAppointment.headline")
                && article.body_key.as_deref() == Some("be.news.managerialAppointment.body")
        }));
    }

    #[test]
    fn process_vacant_ai_clubs_expires_outstanding_job_offer_for_filled_team() {
        let mut game = make_game();
        seed_ai_managers(&mut game);

        let previous_manager_id = game
            .teams
            .iter()
            .find(|team| team.id == "team2")
            .and_then(|team| team.manager_id.clone())
            .unwrap();

        if let Some(team) = game.teams.iter_mut().find(|team| team.id == "team2") {
            team.manager_id = None;
        }
        if let Some(manager) = game
            .managers
            .iter_mut()
            .find(|manager| manager.id == previous_manager_id)
        {
            manager.fire("2026-07-15");
        }
        game.vacant_team_days.insert("team2".to_string(), 6);
        game.messages.push(
            InboxMessage::new(
                "job_offer_team2_2026-07-15".to_string(),
                "Offer".to_string(),
                "Join us".to_string(),
                "Board".to_string(),
                "2026-07-15".to_string(),
            )
            .with_context(MessageContext {
                team_id: Some("team2".to_string()),
                ..Default::default()
            })
            .with_action(MessageAction {
                id: "respond_team2".to_string(),
                label: "Respond".to_string(),
                action_type: ActionType::ChooseOption { options: vec![] },
                resolved: false,
                label_key: None,
            }),
        );

        process_vacant_ai_clubs(&mut game);

        let offer = game
            .messages
            .iter()
            .find(|message| message.id == "job_offer_team2_2026-07-15")
            .unwrap();
        assert!(offer.read);
        assert!(offer.actions.iter().all(|action| action.resolved));
        assert_eq!(
            offer.subject_key.as_deref(),
            Some("be.msg.jobOfferExpired.subject")
        );
        assert_eq!(
            offer.body_key.as_deref(),
            Some("be.msg.jobOfferExpired.body")
        );
    }
}
