// Gaffer Phase 1-2 — Tauri commands for the Interpretation Surface + Relationships.
// Gaffer Phase 7 — Scouting knowledge commands.
use std::sync::Arc;
use log::info;
use ofm_core::game::ScoutingKnowledge;
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

/// V100 Issue #30 (rework): Read-only rivalry info surfaced to the UI.
/// Only edges where `rivalry_flag == true` AND the other player is on a
/// DIFFERENT team are returned. Rivalries are auto-created by the engine
/// in `trigger_cross_team_rivalries` (post_match.rs) — the manager never
/// adds or removes them.
#[derive(serde::Serialize)]
pub struct PlayerRivalryInfo {
    pub rival_id: String,
    pub rival_name: String,
    pub rival_position: String,
    pub rival_team_name: String,
    /// Strength of the rivalry edge (-100 = seething hatred, 0 = cool).
    pub intensity: i8,
    pub narrative_tags: Vec<String>,
    pub started_date: Option<String>,
}

#[tauri::command]
pub async fn get_player_rivalries(
    state: State<'_, Arc<StateManager>>,
    player_id: String,
) -> Result<Vec<PlayerRivalryInfo>, String> {
    info!("[cmd] get_player_rivalries: {}", player_id);
    state.get_game(|game| {
        let player_team_id = game
            .players
            .iter()
            .find(|p| p.id == player_id)
            .and_then(|p| p.team_id.clone());

        let rels = game.relationship_graph.relationships_for(&player_id);
        rels.into_iter()
            .filter_map(|(other_id, edge)| {
                // Only flagged rivalries (set by the engine, never the manager).
                if !edge.rivalry_flag {
                    return None;
                }
                let other = game.players.iter().find(|p| p.id == other_id)?;
                // Only cross-team rivalries — same-team "rivalry" doesn't
                // make sense (those are just tense partnerships).
                if other.team_id == player_team_id {
                    return None;
                }
                let rival_team_name = other
                    .team_id
                    .as_ref()
                    .and_then(|tid| game.teams.iter().find(|t| &t.id == tid))
                    .map(|t| t.name.clone())
                    .unwrap_or_else(|| "No Club".into());
                Some(PlayerRivalryInfo {
                    rival_id: other_id.to_string(),
                    rival_name: other.match_name.clone(),
                    rival_position: format!("{:?}", other.position),
                    rival_team_name,
                    intensity: edge.strength,
                    narrative_tags: edge.narrative_tags.clone(),
                    started_date: edge.last_escalation.clone(),
                })
            })
            .collect::<Vec<_>>()
    })
    .ok_or_else(|| "No active game".to_string())
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

// ============================================================================
// GAFFER PHASE 7 — Scouting Progressive Reveal commands
// ============================================================================

/// Get the user's scouting knowledge for a single player.
/// Returns None if the player has never been scouted.
#[tauri::command]
pub async fn get_scouting_knowledge(
    state: State<'_, Arc<StateManager>>,
    player_id: String,
) -> Result<Option<ScoutingKnowledge>, String> {
    info!("[cmd] get_scouting_knowledge: {}", player_id);
    state.get_game(|game| game.scouting_knowledge.get(&player_id).cloned())
        .ok_or_else(|| "No active game".to_string())
}

/// Summary item for the scouting overview list.
#[derive(serde::Serialize)]
pub struct ScoutingSummaryItem {
    pub player_id: String,
    pub player_name: String,
    pub position: String,
    pub team_name: String,
    pub reveal_tier: String, // "Surface" | "Detailed" | "Complete"
    pub times_scouted: u32,
    pub last_scouted_date: String,
    pub last_scout_id: String,
    pub fuzzed_ovr: Option<u8>,
}

/// Get a summary of all scouted players (any player with a ScoutingKnowledge entry).
#[tauri::command]
pub async fn get_scouting_summary(
    state: State<'_, Arc<StateManager>>,
) -> Result<Vec<ScoutingSummaryItem>, String> {
    info!("[cmd] get_scouting_summary");
    state.get_game(|game| {
        let mut items: Vec<ScoutingSummaryItem> = game.scouting_knowledge
            .values()
            .map(|k| {
                let player = game.players.iter().find(|p| p.id == k.player_id);
                let team_name = player
                    .and_then(|p| p.team_id.as_ref())
                    .and_then(|tid| game.teams.iter().find(|t| &t.id == tid))
                    .map(|t| t.name.clone())
                    .unwrap_or_else(|| "No Club".into());
                ScoutingSummaryItem {
                    player_id: k.player_id.clone(),
                    player_name: player.map(|p| p.match_name.clone()).unwrap_or_else(|| k.player_id.clone()),
                    position: player.map(|p| format!("{:?}", p.position)).unwrap_or_default(),
                    team_name,
                    reveal_tier: k.reveal_tier.label().to_string(),
                    times_scouted: k.times_scouted,
                    last_scouted_date: k.last_scouted_date.clone(),
                    last_scout_id: k.last_scout_id.clone(),
                    fuzzed_ovr: k.fuzzed_ovr,
                }
            })
            .collect();
        // Sort by most recently scouted first
        items.sort_by(|a, b| b.last_scouted_date.cmp(&a.last_scouted_date));
        items
    })
    .ok_or_else(|| "No active game".to_string())
}
