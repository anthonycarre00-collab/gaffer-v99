// Gaffer Phase 1 — Tauri commands for the Interpretation Surface.
use std::sync::Arc;
use log::info;
use ofm_core::interpretation::{InterpretationSurfaceService, MatchMeaningSnapshot, MediaMeaningSnapshot, PlayerMeaningSnapshot, SquadMeaningSnapshot};
use ofm_core::state::StateManager;
use tauri::State;

#[tauri::command]
pub async fn get_player_meaning(state: State<'_, Arc<StateManager>>, player_id: String) -> Result<PlayerMeaningSnapshot, String> {
    info!("[cmd] get_player_meaning: {}", player_id);
    state.get_game(|game| { let svc = InterpretationSurfaceService::new(game); svc.player_meaning(&player_id) })
        .ok_or_else(|| "No active game".to_string())?
        .ok_or_else(|| format!("Player not found: {}", player_id))
}
#[tauri::command]
pub async fn get_squad_meaning(state: State<'_, Arc<StateManager>>) -> Result<SquadMeaningSnapshot, String> {
    state.get_game(|game| { let svc = InterpretationSurfaceService::new(game); svc.squad_meaning() }).ok_or_else(|| "No active game".to_string())
}
#[tauri::command]
pub async fn get_match_meaning(state: State<'_, Arc<StateManager>>) -> Result<MatchMeaningSnapshot, String> {
    state.get_game(|game| { let svc = InterpretationSurfaceService::new(game); svc.match_meaning() }).ok_or_else(|| "No active game".to_string())
}
#[tauri::command]
pub async fn get_media_meaning(state: State<'_, Arc<StateManager>>) -> Result<MediaMeaningSnapshot, String> {
    state.get_game(|game| { let svc = InterpretationSurfaceService::new(game); svc.media_meaning() }).ok_or_else(|| "No active game".to_string())
}
