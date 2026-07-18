use std::sync::Arc;
use log::info;
use tauri::State;

use ofm_core::game::Game;
use ofm_core::state::StateManager;

use crate::commands::util::mutate_active_game;

#[tauri::command]
pub fn hire_staff(state: State<'_, Arc<StateManager>>, staff_id: String) -> Result<Game, String> {
    hire_staff_internal(&state, &staff_id)
}

pub fn hire_staff_internal(state: &StateManager, staff_id: &str) -> Result<Game, String> {
    info!("[cmd] hire_staff: staff_id={}", staff_id);
    mutate_active_game(state, |game| {
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or("be.error.noTeamAssigned".to_string())?;

        // V100 P0-14 (Issue #17): Staff count cap per role. Prevents the
        // user from hoarding unlimited coaches/scouts/physios. Caps:
        //   - Manager: 1 (the user's own role — can't hire another)
        //   - AssistantManager: 1
        //   - Coach: 5 (configurable by facilities — see future P1)
        //   - Scout: 5
        //   - Physio: 2
        // Caps apply to the user's club only. AI clubs aren't restricted
        // (their hiring is automated by process_available_staff_market).
        let staff_wage = {
            let staff = game
                .staff
                .iter_mut()
                .find(|s| s.id == staff_id)
                .ok_or("be.error.staffMemberNotFound".to_string())?;

            if staff.team_id.is_some() {
                return Err("be.error.staffMemberAlreadyEmployed".to_string());
            }

            // Count current staff of the same role at this club.
            let current_count = game
                .staff
                .iter()
                .filter(|s| s.team_id.as_deref() == Some(team_id.as_str()))
                .filter(|s| s.role == staff.role)
                .count();
            let cap = match staff.role {
                domain::staff::StaffRole::Manager => 1,
                domain::staff::StaffRole::AssistantManager => 1,
                domain::staff::StaffRole::Coach => 5,
                domain::staff::StaffRole::Scout => 5,
                domain::staff::StaffRole::Physio => 2,
            };
            if current_count >= cap {
                return Err(format!(
                    "be.error.staffRoleCapReached: {} {} already employed (cap {})",
                    current_count,
                    format!("{:?}", staff.role),
                    cap
                ));
            }

            staff.team_id = Some(team_id.clone());
            staff.wage
        };

        // Deduct wage from team budget
        if let Some(team) = game.teams.iter_mut().find(|t| t.id == team_id) {
            team.season_expenses += staff_wage as i64;
        }

        game.available_staff_market_last_activity_date =
            Some(game.clock.current_date.format("%Y-%m-%d").to_string());
        ofm_core::generator::process_available_staff_market(game);

        Ok(())
    })
}

#[cfg(test)]
mod tests {
    use super::{hire_staff_internal, release_staff_internal};
    use chrono::{TimeZone, Utc};
    use domain::manager::Manager;
    use domain::staff::{Staff, StaffAttributes, StaffRole};
    use domain::team::Team;
    use ofm_core::clock::GameClock;
    use ofm_core::game::Game;
    use ofm_core::state::StateManager;

    fn make_team() -> Team {
        let mut team = Team::new(
            "team-1".to_string(),
            "User FC".to_string(),
            "USR".to_string(),
            "England".to_string(),
            "London".to_string(),
            "User Ground".to_string(),
            25_000,
        );
        team.manager_id = Some("manager-1".to_string());
        team
    }

    fn make_staff() -> Staff {
        let mut staff = Staff::new(
            "staff-1".to_string(),
            "Alex".to_string(),
            "Coach".to_string(),
            "1985-01-01".to_string(),
            StaffRole::Coach,
            StaffAttributes {
                coaching: 70,
                judging_ability: 50,
                judging_potential: 50,
                physiotherapy: 30,
            },
        );
        staff.wage = 12_000;
        staff
    }

    fn make_employed_staff() -> Staff {
        let mut staff = make_staff();
        staff.team_id = Some("team-1".to_string());
        staff
    }

    fn make_game() -> Game {
        let clock = GameClock::new(Utc.with_ymd_and_hms(2026, 8, 1, 12, 0, 0).unwrap());
        let mut manager = Manager::new(
            "manager-1".to_string(),
            "Test".to_string(),
            "Manager".to_string(),
            "1980-01-01".to_string(),
            "England".to_string(),
        );
        manager.hire("team-1".to_string());

        Game::new(
            clock,
            manager,
            vec![make_team()],
            vec![],
            vec![make_staff()],
            vec![],
        )
    }

    fn make_game_with_employed_staff() -> Game {
        let clock = GameClock::new(Utc.with_ymd_and_hms(2026, 8, 1, 12, 0, 0).unwrap());
        let mut manager = Manager::new(
            "manager-1".to_string(),
            "Test".to_string(),
            "Manager".to_string(),
            "1980-01-01".to_string(),
            "England".to_string(),
        );
        manager.hire("team-1".to_string());

        Game::new(
            clock,
            manager,
            vec![make_team()],
            vec![],
            vec![make_employed_staff()],
            vec![],
        )
    }

    #[test]
    fn hire_staff_internal_updates_state() {
        let state = StateManager::new();
        state.set_game(make_game());

        let response = hire_staff_internal(&state, "staff-1").expect("response");
        let staff = response
            .staff
            .iter()
            .find(|staff| staff.id == "staff-1")
            .unwrap();
        let team = response
            .teams
            .iter()
            .find(|team| team.id == "team-1")
            .unwrap();
        let available_staff = response
            .staff
            .iter()
            .filter(|staff| staff.team_id.is_none())
            .count();

        assert_eq!(staff.team_id.as_deref(), Some("team-1"));
        assert_eq!(team.season_expenses, 12_000);
        assert_eq!(available_staff, 12);
        assert_eq!(
            response
                .available_staff_market_last_activity_date
                .as_deref(),
            Some("2026-08-01")
        );

        let stored_game = state.get_game(|game| game.clone()).expect("stored game");
        let stored_staff = stored_game
            .staff
            .iter()
            .find(|staff| staff.id == "staff-1")
            .expect("stored staff should exist");
        let stored_team = stored_game
            .teams
            .iter()
            .find(|team| team.id == "team-1")
            .expect("stored team should exist");
        assert_eq!(stored_staff.team_id.as_deref(), Some("team-1"));
        assert_eq!(stored_team.season_expenses, 12_000);
        assert_eq!(
            stored_game
                .available_staff_market_last_activity_date
                .as_deref(),
            Some("2026-08-01")
        );
    }

    #[test]
    fn release_staff_internal_updates_state() {
        let state = StateManager::new();
        state.set_game(make_game_with_employed_staff());

        let response = release_staff_internal(&state, "staff-1").expect("response");
        let staff = response
            .staff
            .iter()
            .find(|staff| staff.id == "staff-1")
            .unwrap();

        assert!(staff.team_id.is_none());

        let stored_game = state.get_game(|game| game.clone()).expect("stored game");
        let stored_staff = stored_game
            .staff
            .iter()
            .find(|staff| staff.id == "staff-1")
            .expect("stored staff should exist");
        assert!(stored_staff.team_id.is_none());
    }
}

#[tauri::command]
pub fn release_staff(state: State<'_, Arc<StateManager>>, staff_id: String) -> Result<Game, String> {
    release_staff_internal(&state, &staff_id)
}

pub fn release_staff_internal(state: &StateManager, staff_id: &str) -> Result<Game, String> {
    info!("[cmd] release_staff: staff_id={}", staff_id);
    mutate_active_game(state, |game| {
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or("be.error.noTeamAssigned".to_string())?;

        let staff = game
            .staff
            .iter_mut()
            .find(|s| s.id == staff_id)
            .ok_or("be.error.staffMemberNotFound".to_string())?;

        if staff.team_id.as_deref() != Some(&team_id) {
            return Err("be.error.staffMemberNotInTeam".to_string());
        }

        if let Some(team) = game.teams.iter_mut().find(|team| team.id == team_id) {
            team.season_expenses = team.season_expenses.saturating_sub(staff.wage as i64);
        }

        staff.team_id = None;

        Ok(())
    })
}

/// V100 P2 (Issue #17): Assistant manager advice response.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssistantAdviceResponse {
    /// Gaffer-voice advice from the assistant manager.
    pub advice: String,
    /// Topic: "squad_depth", "form", "training", "transfers", "youth".
    pub topic: String,
    /// Whether the advice is a warning (red) or positive (green).
    pub tone: String,
}

/// V100 P2 (Issue #17): Get weekly advice from the assistant manager.
/// Returns advice based on the squad's current state — injuries, form,
/// squad depth, contract situations. The advice is Gaffer-voice and
/// varies based on the assistant manager's coaching attribute (higher =
/// more insightful advice).
#[tauri::command]
pub fn get_assistant_manager_advice(
    state: State<'_, Arc<StateManager>>,
) -> Result<AssistantAdviceResponse, String> {
    info!("[cmd] get_assistant_manager_advice");
    let game = state
        .get_game(|g| g.clone())
        .ok_or("be.error.noActiveGameSession".to_string())?;

    let team_id = game
        .manager
        .team_id
        .clone()
        .ok_or("be.error.noTeamAssigned".to_string())?;

    // Find the assistant manager.
    let assistant = game
        .staff
        .iter()
        .find(|s| {
            s.team_id.as_deref() == Some(team_id.as_str())
                && s.role == domain::staff::StaffRole::AssistantManager
        });

    let coaching_level = assistant
        .map(|a| a.attributes.coaching)
        .unwrap_or(50);

    // Gather squad state.
    let squad_players: Vec<&domain::player::Player> = game
        .players
        .iter()
        .filter(|p| p.team_id.as_deref() == Some(team_id.as_str()) && !p.retired)
        .collect();

    let injured_count = squad_players.iter().filter(|p| p.injury.is_some()).count();
    let low_morale_count = squad_players.iter().filter(|p| p.morale < 40).count();
    let low_condition_count = squad_players.iter().filter(|p| p.condition < 50).count();
    let squad_size = squad_players.len();

    // Find the team's recent form.
    let team = game.teams.iter().find(|t| t.id == team_id);
    let recent_form = team
        .map(|t| t.form.clone())
        .unwrap_or_default();
    let recent_losses = recent_form.iter().rev().take(5).filter(|r| r.as_str() == "L").count();
    let recent_wins = recent_form.iter().rev().take(5).filter(|r| r.as_str() == "W").count();

    // Generate advice based on the most pressing issue.
    let (advice, topic, tone) = if injured_count >= 4 {
        (
            format!("We've got {} lads in the treatment room, boss. The physios are run off their feet — might be worth resting a few in the next match and rotating the squad.", injured_count),
            "squad_depth".to_string(),
            "warning".to_string(),
        )
    } else if recent_losses >= 3 {
        (
            "The lads are low on confidence after those results. I'd suggest a calm team talk — don't go ripping into them, they need their belief back.".to_string(),
            "form".to_string(),
            "warning".to_string(),
        )
    } else if low_morale_count >= 3 {
        (
            format!("There's {} players with morale below 40, boss. Might be worth having a word with them individually — find out what's eating them.", low_morale_count),
            "morale".to_string(),
            "warning".to_string(),
        )
    } else if low_condition_count >= 5 {
        (
            format!("Half the squad's running on fumes, boss. {} lads are below 50 condition — we need to ease off training intensity for a few days.", low_condition_count),
            "training".to_string(),
            "warning".to_string(),
        )
    } else if squad_size < 20 {
        (
            "We're thin on the ground, boss. One or two injuries and we'll be scraping the barrel. Might be worth dipping into the market for some cover.".to_string(),
            "transfers".to_string(),
            "warning".to_string(),
        )
    } else if recent_wins >= 3 {
        (
            "The lads are flying, boss. Confidence is high, the dressing room's buzzing. Keep doing what you're doing — don't change a thing.".to_string(),
            "form".to_string(),
            "positive".to_string(),
        )
    } else if coaching_level >= 80 {
        (
            "Looking at the training ground, I think we can push the intensity up a notch. The lads are responding well to the sessions — let's capitalise on it.".to_string(),
            "training".to_string(),
            "positive".to_string(),
        )
    } else {
        (
            "Squad looks in decent shape, boss. No major concerns from where I'm standing. We'll keep an eye on things and let you know if anything crops up.".to_string(),
            "general".to_string(),
            "neutral".to_string(),
        )
    };

    Ok(AssistantAdviceResponse {
        advice,
        topic,
        tone,
    })
}
