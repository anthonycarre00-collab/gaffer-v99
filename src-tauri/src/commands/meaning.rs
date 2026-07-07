// Gaffer Phase 1-2 — Tauri commands for the Interpretation Surface + Relationships.
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

/// Gaffer Phase 2 — Get a player's relationships for frontend visualization.
/// Returns Vec of (other_player_name, other_player_position, strength, is_positive).
#[derive(serde::Serialize)]
pub struct PlayerRelationshipInfo {
    pub player_id: String,
    pub player_name: String,
    pub position: String,
    pub strength: i8,
    pub volatility: f32,
    pub narrative_tags: Vec<String>,
    pub is_clique_member: bool,
}

#[tauri::command]
pub async fn get_player_relationships(
    state: State<'_, Arc<StateManager>>,
    player_id: String,
) -> Result<Vec<PlayerRelationshipInfo>, String> {
    info!("[cmd] get_player_relationships: {}", player_id);
    state.get_game(|game| {
        let rels = game.relationship_graph.relationships_for(&player_id);
        rels.into_iter().map(|(other_id, edge)| {
            let other = game.players.iter().find(|p| p.id == other_id);
            let is_clique = game.relationship_graph.cliques_for(&player_id)
                .iter()
                .any(|c| c.member_ids.contains(&player_id) && c.member_ids.contains(&other_id.to_string()));
            PlayerRelationshipInfo {
                player_id: other_id.to_string(),
                player_name: other.map(|p| p.match_name.clone()).unwrap_or_else(|| other_id.to_string()),
                position: other.map(|p| format!("{:?}", p.position)).unwrap_or_default(),
                strength: edge.strength,
                volatility: edge.volatility,
                narrative_tags: edge.narrative_tags.clone(),
                is_clique_member: is_clique,
            }
        }).collect::<Vec<_>>()
    }).ok_or_else(|| "No active game".to_string())
}
