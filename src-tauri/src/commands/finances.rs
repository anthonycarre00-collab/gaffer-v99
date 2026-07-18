use std::sync::Arc;
use log::info;
use serde::{Deserialize, Serialize};
use tauri::State;

use ofm_core::finances::{
    BoardSupportResult, FinanceActionPreviews, MarketingCampaignResult, SponsorPitchResult,
    TeamFinanceSnapshot,
};
use ofm_core::game::Game;
use ofm_core::state::StateManager;

/// V100 P2 (Issue #36): Talk to Board request type.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TalkToBoardRequest {
    /// Request more time before the board fires you (small chance of success).
    RequestMoreTime,
    /// Request additional transfer funds (very small chance, bigger if sugar daddy owner).
    RequestTransferFunds,
    /// Request stadium expansion (only if club can afford it + it's relevant to club size).
    RequestStadiumExpansion,
}

/// V100 P2 (Issue #36): Talk to Board response.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TalkToBoardResponse {
    pub game: Game,
    /// Whether the board agreed to the request.
    pub approved: bool,
    /// Gaffer-voice response from the board.
    pub board_reply: String,
    /// Amount granted (for fund requests), 0 if denied.
    pub amount_granted: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct FinanceSnapshotCommandResponse {
    pub snapshot: TeamFinanceSnapshot,
    pub previews: FinanceActionPreviews,
}

#[derive(Debug, Clone, Serialize)]
pub struct BoardSupportCommandResponse {
    pub game: Game,
    pub result: BoardSupportResult,
}

#[derive(Debug, Clone, Serialize)]
pub struct SponsorPitchCommandResponse {
    pub game: Game,
    pub result: SponsorPitchResult,
}

#[derive(Debug, Clone, Serialize)]
pub struct MarketingCampaignCommandResponse {
    pub game: Game,
    pub result: MarketingCampaignResult,
}

#[tauri::command]
pub async fn get_finance_snapshot(
    state: State<'_, Arc<StateManager>>,
    team_id: Option<String>,
) -> Result<FinanceSnapshotCommandResponse, String> {
    get_finance_snapshot_internal(&state, team_id.as_deref())
}

pub fn get_finance_snapshot_internal(
    state: &StateManager,
    team_id: Option<&str>,
) -> Result<FinanceSnapshotCommandResponse, String> {
    info!("[cmd] get_finance_snapshot: team_id={:?}", team_id);

    let game = state
        .get_game(|g: &Game| g.clone())
        .ok_or("be.error.noActiveGameSession".to_string())?;

    let resolved_team_id = match team_id {
        Some(team_id) => team_id.to_string(),
        None => game
            .manager
            .team_id
            .clone()
            .ok_or("be.error.noTeamAssigned".to_string())?,
    };

    let snapshot = ofm_core::finances::team_finance_snapshot(&game, &resolved_team_id)
        .ok_or("be.error.managedTeamNotFound".to_string())?;
    let previews =
        ofm_core::finances::finance_action_previews(&game, &resolved_team_id).unwrap_or_default();

    Ok(FinanceSnapshotCommandResponse { snapshot, previews })
}

#[tauri::command]
pub async fn request_board_support(
    state: State<'_, Arc<StateManager>>,
) -> Result<BoardSupportCommandResponse, String> {
    request_board_support_internal(&state)
}

#[tauri::command]
pub async fn request_sponsor_pitch(
    state: State<'_, Arc<StateManager>>,
) -> Result<SponsorPitchCommandResponse, String> {
    request_sponsor_pitch_internal(&state)
}

#[tauri::command]
pub async fn request_marketing_campaign(
    state: State<'_, Arc<StateManager>>,
) -> Result<MarketingCampaignCommandResponse, String> {
    request_marketing_campaign_internal(&state)
}

/// V100 P2 (Issue #36): Talk to Board — Gaffer-voice interaction where the
/// user can request more time, more transfer funds, or stadium expansion.
/// The board's response depends on the club's reputation, finance, and the
/// user's recent performance. Most requests are denied with a "You
/// concentrate on winning matches" sideways dig.
#[tauri::command]
pub async fn talk_to_board(
    state: State<'_, Arc<StateManager>>,
    request: TalkToBoardRequest,
) -> Result<TalkToBoardResponse, String> {
    info!("[cmd] talk_to_board: request={:?}", request);
    state
        .update_game(|game| {
            let team_id = game
                .manager
                .team_id
                .clone()
                .ok_or("be.error.noTeamAssigned".to_string())?;

            let team = game
                .teams
                .iter()
                .find(|t| t.id == team_id)
                .ok_or("be.error.teamNotFound".to_string())?;

            let reputation = team.reputation;
            let finance = team.finance;
            let transfer_budget = team.transfer_budget;
            let stadium_capacity = team.stadium_capacity;

            // Determine approval based on request type + club context.
            let (approved, board_reply, amount_granted) = match request {
                TalkToBoardRequest::RequestMoreTime => {
                    // 20% chance of approval, higher if reputation is high.
                    let chance = if reputation >= 800 { 0.35 } else { 0.20 };
                    let roll = rand::RngExt::random_range(&mut rand::rng(), 0.0..1.0f64);
                    if roll < chance {
                        (true, "The board have agreed to give you more time. Results must improve.".to_string(), 0u64)
                    } else {
                        (false, "You concentrate on winning matches. We'll review the situation at the end of the season.".to_string(), 0u64)
                    }
                }
                TalkToBoardRequest::RequestTransferFunds => {
                    // 10% chance, higher if club has a sugar daddy (high finance + high reputation).
                    let sugar_daddy = finance > 100_000_000 && reputation >= 800;
                    let chance = if sugar_daddy { 0.30 } else { 0.10 };
                    let roll = rand::RngExt::random_range(&mut rand::rng(), 0.0..1.0f64);
                    if roll < chance {
                        // Grant 10-20% of current transfer budget (min £1M, max £20M).
                        let base = (transfer_budget as u64 / 10).max(1_000_000).min(20_000_000);
                        let grant = if sugar_daddy { base * 2 } else { base };
                        // Apply the grant.
                        if let Some(t) = game.teams.iter_mut().find(|t| t.id == team_id) {
                            t.transfer_budget += grant as i64;
                            t.finance += grant as i64;
                        }
                        (true, format!("The board have released an additional £{:,.0} for transfers. Spend it wisely.", grant), grant)
                    } else {
                        (false, "The money's not there. You'll have to work with what you've got.".to_string(), 0u64)
                    }
                }
                TalkToBoardRequest::RequestStadiumExpansion => {
                    // Only approve if club can afford it (finance > £50M) and
                    // stadium is small enough to warrant expansion (< 60,000).
                    let can_afford = finance > 50_000_000;
                    let needs_expansion = stadium_capacity < 60_000;
                    if can_afford && needs_expansion {
                        // Cost: £20M for +5,000 seats.
                        let cost = 20_000_000i64;
                        let added_seats = 5_000u32;
                        if let Some(t) = game.teams.iter_mut().find(|t| t.id == team_id) {
                            t.finance -= cost;
                            t.stadium_capacity += added_seats;
                        }
                        (true, format!("The board have approved a £{:,.0} expansion. {} seats will be added.", cost, added_seats), 0u64)
                    } else if !can_afford {
                        (false, "We can't justify that kind of spending right now. Get the club on a sound financial footing first.".to_string(), 0u64)
                    } else {
                        (false, "The ground's big enough as it is. Fill it regularly and we'll talk.".to_string(), 0u64)
                    }
                }
            };

            Ok(TalkToBoardResponse {
                game: game.clone(),
                approved,
                board_reply,
                amount_granted,
            })
        })
        .ok_or("be.error.noActiveGameSession".to_string())?
}

pub fn request_board_support_internal(
    state: &StateManager,
) -> Result<BoardSupportCommandResponse, String> {
    info!("[cmd] request_board_support");

    state.update_game(|game| {
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or("be.error.noTeamAssigned".to_string())?;

        let result = ofm_core::finances::request_board_support(game, &team_id)?;
        Ok(BoardSupportCommandResponse { game: game.clone(), result })
    })
    .ok_or("be.error.noActiveGameSession".to_string())?
}

pub fn request_sponsor_pitch_internal(
    state: &StateManager,
) -> Result<SponsorPitchCommandResponse, String> {
    info!("[cmd] request_sponsor_pitch");

    state.update_game(|game| {
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or("be.error.noTeamAssigned".to_string())?;

        let result = ofm_core::finances::request_sponsor_pitch(game, &team_id)?;
        Ok(SponsorPitchCommandResponse { game: game.clone(), result })
    })
    .ok_or("be.error.noActiveGameSession".to_string())?
}

pub fn request_marketing_campaign_internal(
    state: &StateManager,
) -> Result<MarketingCampaignCommandResponse, String> {
    info!("[cmd] request_marketing_campaign");

    state.update_game(|game| {
        let team_id = game
            .manager
            .team_id
            .clone()
            .ok_or("be.error.noTeamAssigned".to_string())?;

        let result = ofm_core::finances::request_marketing_campaign(game, &team_id)?;
        Ok(MarketingCampaignCommandResponse { game: game.clone(), result })
    })
    .ok_or("be.error.noActiveGameSession".to_string())?
}

#[cfg(test)]
mod tests {
    use super::{
        get_finance_snapshot_internal, request_board_support_internal,
        request_marketing_campaign_internal, request_sponsor_pitch_internal,
    };
    use chrono::{TimeZone, Utc};
    use domain::manager::Manager;
    use domain::player::{Player, PlayerAttributes, Position};
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
        team.finance = 500_000;
        team.wage_budget = 120_000;
        team.transfer_budget = 300_000;
        team.manager_id = Some("manager-1".to_string());
        team
    }

    fn make_player() -> Player {
        let attrs = PlayerAttributes {
            pace: 65,
            burst: 65,
            engine: 65,
            power: 65,
            agility: 65,
            passing: 65,
            distribution: 65,
            finishing: 65,
            defending: 65,
            touch: 65,
            anticipation: 65,
            vision: 65,
            decisions: 65,
            composure: 65,
            leadership: 50,
            shot_stopping: 20,
            commanding: 20,
           playing_out: 20, playing_out: 20,aerial: 60,
        };
        let mut player = Player::new(
            "player-1".to_string(),
            "Player".to_string(),
            "Test Player".to_string(),
            "1998-01-01".to_string(),
            "GB".to_string(),
            Position::Midfielder,
            attrs,
        );
        player.team_id = Some("team-1".to_string());
        player.wage = 52_000;
        player
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
            vec![make_player()],
            vec![],
            vec![],
        )
    }

    #[test]
    fn get_finance_snapshot_internal_returns_managed_team_snapshot() {
        let state = StateManager::new();
        state.set_game(make_game());

        let response = get_finance_snapshot_internal(&state, None).expect("response");

        assert_eq!(response.snapshot.annual_wage_bill, 52_000);
        assert_eq!(response.snapshot.weekly_wage_spend, 1_000);
        assert_eq!(response.snapshot.weekly_wage_budget, 120_000 / 52);
        assert!(response.previews.board_support.is_none());
        assert!(response.previews.sponsor_pitch.is_none());
        assert!(response.previews.marketing_campaign.is_none());
    }

    #[test]
    fn get_finance_snapshot_internal_includes_recovery_previews_for_pressured_club() {
        let state = StateManager::new();
        let mut game = make_game();
        game.teams[0].finance = -25_000;
        game.teams[0].wage_budget = 40_000;
        state.set_game(game);

        let response = get_finance_snapshot_internal(&state, None).expect("response");

        assert!(response.previews.board_support.is_some());
        assert!(response.previews.sponsor_pitch.is_some());
        assert!(response.previews.marketing_campaign.is_some());
    }

    #[test]
    fn request_board_support_internal_updates_managed_team_state() {
        let state = StateManager::new();
        let mut game = make_game();
        game.teams[0].finance = -25_000;
        game.manager.satisfaction = 70;
        state.set_game(game);

        let response = request_board_support_internal(&state).expect("response");

        assert!(response.result.support_amount >= 150_000);
        assert!(response.game.teams[0].finance > 0);
        assert_eq!(response.game.manager.satisfaction, 58);

        let stored_game = state
            .get_game(|current| current.clone())
            .expect("stored game");
        assert!(stored_game.teams[0].finance > 0);
        assert_eq!(stored_game.manager.satisfaction, 58);
    }

    #[test]
    fn request_sponsor_pitch_internal_creates_pending_offer() {
        let state = StateManager::new();
        let mut game = make_game();
        game.teams[0].wage_budget = 50_000;
        state.set_game(game);

        let response = request_sponsor_pitch_internal(&state).expect("response");

        assert!(response.result.weekly_amount >= 40_000);
        assert!(response
            .game
            .messages
            .iter()
            .any(|message| message.id == response.result.message_id));

        let stored_game = state
            .get_game(|current| current.clone())
            .expect("stored game");
        assert!(stored_game
            .messages
            .iter()
            .any(|message| message.id == response.result.message_id));
    }

    #[test]
    fn request_marketing_campaign_internal_updates_managed_team_state() {
        let state = StateManager::new();
        let mut game = make_game();
        game.teams[0].wage_budget = 50_000;
        game.teams[0].finance = -40_000;
        state.set_game(game);

        let response = request_marketing_campaign_internal(&state).expect("response");

        assert!(response.result.net_income > 0);
        assert_eq!(
            response.result.net_income,
            response.result.gross_revenue - response.result.campaign_cost
        );
        assert!(response
            .game
            .messages
            .iter()
            .any(|message| message.id == response.result.message_id));
        assert_eq!(
            response.game.teams[0]
                .financial_ledger
                .iter()
                .filter(|entry| entry.kind
                    == domain::team::FinancialTransactionKind::CommercialCampaign)
                .count(),
            2
        );

        let stored_game = state
            .get_game(|current| current.clone())
            .expect("stored game");
        assert!(stored_game.teams[0].finance > -40_000);
        assert!(stored_game
            .messages
            .iter()
            .any(|message| message.id == response.result.message_id));
    }
}
