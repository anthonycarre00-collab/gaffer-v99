// Gaffer Phase 1 — Interpretation Surface
use crate::game::ScoutingKnowledge;
use crate::game::Game;
use crate::training::development_trajectory;
use domain::player::{MediaSensitivity, Player, PlayerTrait, Position, PressureResponse};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ExplanationEntry { pub reason: String, pub source: Option<String> }
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct ExplanationChain { pub entries: Vec<ExplanationEntry> }
impl ExplanationChain {
    pub fn new() -> Self { Self { entries: Vec::new() } }
    pub fn push(&mut self, reason: impl Into<String>, source: Option<String>) { self.entries.push(ExplanationEntry { reason: reason.into(), source }); }
    pub fn is_empty(&self) -> bool { self.entries.is_empty() }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SpreadsheetAttributes {
    pub pace:u8,pub burst:u8,pub engine:u8,pub power:u8,pub agility:u8,
    pub passing:u8,pub distribution:u8,pub touch:u8,pub finishing:u8,pub defending:u8,pub aerial:u8,
    pub anticipation:u8,pub vision:u8,pub decisions:u8,pub composure:u8,pub leadership:u8,
    pub shot_stopping:u8,pub commanding:u8,pub playing_out:u8,
    pub body_avg:u8,pub ball_avg:u8,pub head_avg:u8,pub gloves_avg:u8,pub overall:u8,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PlayerMeaningSnapshot {
    pub display_name:String,pub club:String,pub role_identity_label:String,pub archetype_label:String,
    pub locker_room_role:String,pub narrative_status_tag:String,
    pub current_form_label:String,pub confidence_label:String,pub fatigue_label:String,
    pub trajectory_label:String,pub stability_label:String,pub stability_description:String,
    pub pressure_response_type:PressureResponse,pub media_sensitivity:MediaSensitivity,
    pub rivalry_trigger_flag:bool,pub morale_state:String,
    pub strongest_positive_link:Option<String>,pub strongest_negative_link:Option<String>,
    pub chemistry_score:i8,pub clique_membership:Vec<String>,
    pub growth_vector:String,pub training_alignment_label:String,pub mentor_bonus_flag:bool,
    pub spreadsheet_attributes:SpreadsheetAttributes,
    pub role_identity_explanation:ExplanationChain,pub stability_explanation:ExplanationChain,
    pub morale_state_explanation:ExplanationChain,pub pressure_response_explanation:ExplanationChain,
    /// Gaffer Phase 7 — Scouting knowledge for this player (None if never scouted by user).
    /// When present, the UI should hide attributes/personality/etc that are not yet revealed
    /// at the current tier.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scouting_knowledge: Option<ScoutingKnowledge>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SquadMeaningSnapshot {
    pub squad_harmony_score:u8,pub tactical_coherence_score:u8,pub pressure_level:String,
    pub media_heat:u8,pub dressing_room_tension_flag:bool,pub emerging_story_threads:Vec<String>,
    pub chemistry_hotspots:Vec<String>,pub fatigue_risk_band:String,pub identity_alignment_label:String,
    pub harmony_explanation:ExplanationChain,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MatchMeaningSnapshot {
    pub momentum_state:String,pub rivalry_intensity:u8,pub turning_point_event_id:Option<String>,
    pub narrative_shift_label:String,pub pundit_tone_weight:f32,
    pub resurfaced_memory_flag:Option<String>,pub archived_memory_used_flag:Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MediaMeaningSnapshot {
    pub active_story_count:u32,pub top_headline:Option<String>,
    pub pundit_disagreement_active:bool,pub betting_sentiment_trend:String,
}

pub struct InterpretationSurfaceService<'a> { game: &'a Game }
impl<'a> InterpretationSurfaceService<'a> {
    pub fn new(game: &'a Game) -> Self { Self { game } }

    pub fn player_meaning(&self, player_id: &str) -> Option<PlayerMeaningSnapshot> {
        let player = self.game.players.iter().find(|p| p.id == player_id)?;
        Some(self.build_player_snapshot(player))
    }

    pub fn squad_meaning(&self) -> SquadMeaningSnapshot {
        let uid = self.game.manager.team_id.as_deref();
        let squad: Vec<&Player> = self.game.players.iter().filter(|p| p.team_id.as_deref() == uid).collect();
        if squad.is_empty() {
            return SquadMeaningSnapshot { squad_harmony_score:50,tactical_coherence_score:50,pressure_level:"Low".into(),media_heat:0,dressing_room_tension_flag:false,emerging_story_threads:vec![],chemistry_hotspots:vec![],fatigue_risk_band:"Low".into(),identity_alignment_label:"Balanced".into(),harmony_explanation:ExplanationChain::new() };
        }

        let squad_ids: Vec<String> = squad.iter().map(|p| p.id.clone()).collect();

        // Gaffer Phase 4 — Full SquadPulse formula (7 factors)
        // See: docs/gaffer/BIBLE_CURATED.md §16
        let avg_morale: f64 = squad.iter().map(|p| p.morale as f64).sum::<f64>() / squad.len() as f64;
        let positive_density = self.game.relationship_graph.positive_density(&squad_ids) as f64;
        let conflict_severity = self.game.relationship_graph.conflict_severity(&squad_ids) as f64;

        // Leadership stability: average leadership of top leaders
        let mut leadership_vals: Vec<u8> = squad.iter().map(|p| p.attributes.leadership).collect();
        leadership_vals.sort_by(|a, b| b.cmp(a));
        let leader_count = leadership_vals.len().min(3).max(1);
        let leadership_stability: f64 = leadership_vals.iter().take(leader_count)
            .map(|&v| v as f64).sum::<f64>() / leader_count as f64;

        // Recent result momentum: from team form (W=+1, D=0, L=-1)
        let team = self.game.teams.iter().find(|t| Some(&t.id) == self.game.manager.team_id.as_ref());
        let result_momentum: f64 = team
            .map(|t| {
                let count = t.form.len().min(5);
                if count == 0 {
                    return 50.0;
                }
                let sum: f64 = t.form.iter().rev().take(5)
                    .map(|r| match r.as_str() { "W" => 1.0, "D" => 0.0, "L" => -1.0, _ => 0.0 })
                    .sum();
                ((sum + count as f64) / (count as f64 * 2.0)) * 100.0
            })
            .unwrap_or(50.0);

        // Media pressure: count active story threads (Phase 3)
        let media_pressure: f64 = self.game.memory_store.active_thread_count() as f64 * 5.0;

        // V100 Audit (M5): Compute chemistry_hotspots from real RelationshipGraph
        // edges — the 3 strongest intra-squad positive pairs.
        let chemistry_hotspots: Vec<String> = {
            let mut pairs: Vec<(String, String, i8)> = Vec::new();
            for i in 0..squad.len() {
                for j in (i + 1)..squad.len() {
                    let a = &squad[i].id;
                    let b = &squad[j].id;
                    if let Some(edge) = self.game.relationship_graph.get(a, b) {
                        if edge.strength > 0 {
                            pairs.push((squad[i].match_name.clone(), squad[j].match_name.clone(), edge.strength));
                        }
                    }
                }
            }
            pairs.sort_by(|x, y| y.2.cmp(&x.2));
            pairs.into_iter().take(3)
                .map(|(a, b, s)| format!("{} ↔ {} (+{})", a, b, s))
                .collect()
        };

        // V100 Audit (M3/M4): Compute identity_alignment_label + tactical_alignment
        // from manager tactical_style vs team play_style. Both used to be hardcoded.
        // Uses manager.personality.preferred_play_style() so the comparison is
        // apples-to-apples (TacticalStyle enum → play_style string).
        let (identity_alignment_label, tactical_alignment) = {
            let team_play_style = team.map(|t| format!("{:?}", t.play_style)).unwrap_or_else(|| "Balanced".into());
            let manager_style = self.game.manager.personality.preferred_play_style().to_string();
            // Simple match: if manager's preferred style == team's style → Aligned (100)
            // If adjacent style family (Attacking ↔ Pressing, Defensive ↔ Counter) → Compatible (70)
            // Else → Misaligned (35).
            let (label, score) = if manager_style == team_play_style {
                ("Aligned".to_string(), 100.0)
            } else if is_adjacent_style(&manager_style, &team_play_style) {
                ("Compatible".to_string(), 70.0)
            } else {
                ("Misaligned".to_string(), 35.0)
            };
            (label, score)
        };

        // SquadPulse = weighted composite (see BIBLE_CURATED.md §16)
        let squad_pulse: f64 =
            (avg_morale * 0.25)
          + (positive_density * 0.20)
          + (tactical_alignment * 0.15)
          + (result_momentum * 0.15)
          + (leadership_stability * 0.10)
          - (conflict_severity * 0.10)
          - (media_pressure * 0.05);

        let squad_pulse = squad_pulse.clamp(0.0, 100.0);

        // Fatigue
        let ac: f64 = squad.iter().map(|p| p.condition as f64).sum::<f64>() / squad.len() as f64;
        let af: f64 = squad.iter().map(|p| p.fitness as f64).sum::<f64>() / squad.len() as f64;
        let fb = if ac<40.0||af<40.0 {"High"} else if ac<70.0||af<60.0 {"Moderate"} else {"Low"};

        // Pressure level
        let pl = if squad_pulse<35.0 {"Crushing"} else if squad_pulse<55.0 {"High"} else if squad_pulse<75.0 {"Moderate"} else {"Low"};

        // Tension + density
        let tension = self.game.relationship_graph.has_tension(&squad_ids);
        let _density = positive_density as u8;
        let _conflict = conflict_severity as u8;

        // Active story threads
        let threads: Vec<String> = self.game.memory_store.active_threads()
            .iter()
            .map(|t| format!("{:?} ({:.0})", t.thread_type, t.momentum_score))
            .collect();

        let mut he = ExplanationChain::new();
        he.push(format!("SquadPulse (Phase 4 full formula) = {:.1}", squad_pulse), Some("squad_pulse_phase4".into()));
        he.push(format!("  Morale × 0.25 = {:.1} × 0.25 = {:.1}", avg_morale, avg_morale * 0.25), None);
        he.push(format!("  Positive density × 0.20 = {:.0} × 0.20 = {:.1}", positive_density, positive_density * 0.20), None);
        he.push(format!("  Result momentum × 0.15 = {:.0} × 0.15 = {:.1}", result_momentum, result_momentum * 0.15), None);
        he.push(format!("  Leadership × 0.10 = {:.0} × 0.10 = {:.1}", leadership_stability, leadership_stability * 0.10), None);
        he.push(format!("  Conflict severity × -0.10 = {:.0} × -0.10 = {:.1}", conflict_severity, -(conflict_severity * 0.10)), None);
        he.push(format!("  Media pressure × -0.05 = {:.0} × -0.05 = {:.1}", media_pressure, -(media_pressure * 0.05)), None);

        SquadMeaningSnapshot {
            squad_harmony_score: squad_pulse.round() as u8,
            tactical_coherence_score: tactical_alignment.round() as u8,
            pressure_level: pl.into(),
            media_heat: media_pressure as u8,
            dressing_room_tension_flag: tension,
            emerging_story_threads: threads,
            chemistry_hotspots,
            fatigue_risk_band: fb.into(),
            identity_alignment_label,
            harmony_explanation: he,
        }
    }

    /// V100 FIX (match significance): Wire match_meaning() to read real data
    /// from memory_store + relationship_graph + fixture importance. Previously
    /// 100% hardcoded — returned "Neutral" momentum, 0 rivalry intensity, no
    /// narrative shift, regardless of game state.
    ///
    /// Now reads:
    /// - `momentum_state`: from active story threads (Building/Peaking/Neutral)
    /// - `rivalry_intensity`: count of rivalry_flagged edges for user's team
    /// - `narrative_shift_label`: from highest-momentum active thread title
    /// - `pundit_tone_weight`: from media_engine (0.5 default, varies with
    ///   active disagreement)
    /// - `resurfaced_memory_flag`: "true" if any memory has times_resurfaced > 0
    /// - `turning_point_event_id` / `archived_memory_used_flag`: still None
    ///   (requires live match context — deferred)
    pub fn match_meaning(&self) -> MatchMeaningSnapshot {
        let active_threads = self.game.memory_store.active_threads();

        // Momentum state: derive from highest-momentum active thread.
        let max_momentum = active_threads.iter()
            .map(|t| t.momentum_score)
            .fold(0.0f32, f32::max);
        let momentum_state = if max_momentum >= 50.0 {
            "Peaking"
        } else if max_momentum >= 20.0 {
            "Building"
        } else if max_momentum > 0.0 {
            "Simmering"
        } else {
            "Neutral"
        };

        // Rivalry intensity: count rivalry_flagged edges involving user's team.
        let rivalry_intensity: u8 = {
            let user_team_id = self.game.manager.team_id.as_deref();
            if let Some(team_id) = user_team_id {
                let count = self.game.relationship_graph.all_edges()
                    .filter(|(_, edge)| edge.rivalry_flag)
                    .filter(|(key, _)| {
                        // Edge key is "team_a:team_b" — check if either side
                        // is the user's team.
                        key.split(':').any(|id| id == team_id)
                    })
                    .count();
                count.min(255) as u8
            } else {
                0
            }
        };

        // Narrative shift label: title of highest-momentum thread.
        let narrative_shift_label = active_threads.iter()
            .max_by(|a, b| a.momentum_score.partial_cmp(&b.momentum_score)
                .unwrap_or(std::cmp::Ordering::Equal))
            .map(|t| t.title.clone())
            .unwrap_or_else(|| "No active narrative shift".into());

        // Pundit tone weight: 0.5 baseline, bumped if active disagreement.
        let pundit_tone_weight = {
            let summary = self.game.media_engine.media_summary();
            if summary.pundit_disagreement_active {
                0.7
            } else {
                0.5
            }
        };

        // Resurfaced memory flag: "true" if any memory has been resurfaced.
        let resurfaced_memory_flag = {
            let has_resurfaced = self.game.memory_store.all_memories_values()
                .any(|memories| memories.iter().any(|m| m.times_resurfaced > 0));
            if has_resurfaced { Some("true".to_string()) } else { None }
        };

        MatchMeaningSnapshot {
            momentum_state: momentum_state.into(),
            rivalry_intensity,
            turning_point_event_id: None, // requires live match context
            narrative_shift_label,
            pundit_tone_weight,
            resurfaced_memory_flag,
            archived_memory_used_flag: None, // requires live match context
        }
    }

    pub fn media_meaning(&self) -> MediaMeaningSnapshot {
        let summary = self.game.media_engine.media_summary();
        MediaMeaningSnapshot {
            active_story_count: self.game.memory_store.active_thread_count() as u32,
            top_headline: summary.top_headline,
            pundit_disagreement_active: summary.pundit_disagreement_active,
            betting_sentiment_trend: summary.betting_sentiment_trend,
        }
    }

    fn build_player_snapshot(&self, player: &Player) -> PlayerMeaningSnapshot {
        let attrs = &player.attributes;
        let overall = if player.ovr > 0 { player.ovr } else { attrs.overall(&player.position) };
        let role_identity_label = self.derive_role_identity(player);
        let mut role_explanation = ExplanationChain::new();
        role_explanation.push(format!("Derived from top attributes (overall = {}).", overall), Some("attribute_overall".into()));
        let archetype_label = player.traits.first().map(trait_label).unwrap_or("Unremarkable").to_string();
        let sl = player.stability_label();
        let mut se = ExplanationChain::new();
        se.push("Stability modifier (hidden) computed from age, overall, form, conscientiousness, injury.".to_string(), Some("stability_formula".into()));
        let ms = morale_state_label(player.morale);
        let mut me = ExplanationChain::new();
        me.push(format!("Morale value: {} / 100.", player.morale), Some("morale_value".into()));
        let pr = player.personality.pressure_response();
        let mut pe = ExplanationChain::new();
        pe.push(format!("PressureResponse from Big Five (E={},C={},N={}).", player.personality.extraversion, player.personality.conscientiousness, player.personality.neuroticism), Some("personality_derivation".into()));
        let msi = player.personality.media_sensitivity();
        let cc = (player.morale as u16 + player.morale_core.manager_trust as u16) / 2;
        let cl = if cc>=80 {"Flying"} else if cc>=65 {"Confident"} else if cc>=45 {"Steady"} else if cc>=25 {"Shaken"} else {"Rock Bottom"};
        let fl = if player.condition>=85&&player.fitness>=70 {"Fresh"} else if player.condition>=65&&player.fitness>=55 {"Match-fit"} else if player.condition>=40||player.fitness>=40 {"Tiring"} else {"Running on Empty"};
        let cfl = if player.stats.avg_rating>=7.5 {"In Form"} else if player.stats.avg_rating>=6.5 {"Steady"} else if player.stats.avg_rating>=5.5 {"Quiet"} else if player.stats.avg_rating>0.0 {"Off the Pace"} else {"No Recent Football"};
        // Phase 6: development trajectory + growth vector from plateau/personality
        let player_age = player.date_of_birth.split('-').next().and_then(|y| y.parse::<u32>().ok()).map(|by| 2024_u32.saturating_sub(by)).unwrap_or(25);
        let traj = development_trajectory(player, player_age);
        let trajectory_label = traj.label().to_string();
        let growth_vector = match traj {
            crate::training::DevelopmentTrajectory::Rising => "On the rise".to_string(),
            crate::training::DevelopmentTrajectory::Peaked => "At his peak".to_string(),
            crate::training::DevelopmentTrajectory::Plateaued => "Stalled at ceiling".to_string(),
            crate::training::DevelopmentTrajectory::Declining => "Losing ground".to_string(),
        };
        let sa = SpreadsheetAttributes {
            pace:attrs.pace,burst:attrs.burst,engine:attrs.engine,power:attrs.power,agility:attrs.agility,
            passing:attrs.passing,distribution:attrs.distribution,touch:attrs.touch,finishing:attrs.finishing,
            defending:attrs.defending,aerial:attrs.aerial,anticipation:attrs.anticipation,vision:attrs.vision,
            decisions:attrs.decisions,composure:attrs.composure,leadership:attrs.leadership,
            shot_stopping:attrs.shot_stopping,commanding:attrs.commanding,playing_out:attrs.playing_out,
            body_avg:attrs.body_avg(),ball_avg:attrs.ball_avg(),head_avg:attrs.head_avg(),gloves_avg:attrs.gloves_avg(),overall,
        };
        let club = self.game.teams.iter().find(|t| Some(&t.id)==player.team_id.as_ref()).map(|t|t.name.clone()).unwrap_or_else(||"No Club".into());
        // Phase 7: Look up scouting knowledge for this player (None if never scouted)
        let scouting_knowledge = self.game.scouting_knowledge.get(&player.id).cloned();

        // V100 Audit (L2): Compute locker_room_role from real role + attributes
        // (was hardcoded "Squad member").
        let locker_room_role = self.compute_locker_room_role(player);

        // V100 Audit (L1): Compute mentor_bonus_flag — true if this player is
        // a young player (≤21) whose team has a captain age ≥30 with leadership ≥70,
        // OR if this player IS such a captain (the mentor). Was hardcoded false.
        let mentor_bonus_flag = self.compute_mentor_bonus_flag(player);

        // V100 Audit (M2): Compute training_alignment_label from training focus
        // (was hardcoded "Aligned"). Light pass — defaults to "Neutral" if no
        // explicit focus set, "Aligned" if focus matches player's natural
        // position group, "Misaligned" if focus is clearly a different group.
        let training_alignment_label = self.compute_training_alignment_label(player);

        PlayerMeaningSnapshot {
            display_name:player.match_name.clone(),club,role_identity_label,archetype_label,
            locker_room_role,
            narrative_status_tag: self.get_narrative_status_tag(player),
            current_form_label:cfl.to_string(),confidence_label:cl.into(),fatigue_label:fl.into(),
            trajectory_label,stability_label:sl.as_str().to_string(),stability_description:sl.description().to_string(),
            pressure_response_type:pr,media_sensitivity:msi,rivalry_trigger_flag:self.has_active_rivalry(player),morale_state:ms.into(),
            strongest_positive_link: self.get_strongest_positive_link(player),
            strongest_negative_link: self.get_strongest_negative_link(player),
            chemistry_score: self.get_chemistry_score(player),
            clique_membership: self.get_clique_membership(player),
            growth_vector,training_alignment_label,mentor_bonus_flag,
            spreadsheet_attributes:sa,role_identity_explanation:role_explanation,stability_explanation:se,
            morale_state_explanation:me,pressure_response_explanation:pe,
            scouting_knowledge,
        }
    }

    /// Get the player's strongest ally name from the relationship graph.
    fn get_strongest_positive_link(&self, player: &Player) -> Option<String> {
        self.game.relationship_graph
            .strongest_positive(&player.id)
            .map(|(other_id, _)| {
                self.game.players.iter()
                    .find(|p| p.id == other_id)
                    .map(|p| p.match_name.clone())
                    .unwrap_or_else(|| other_id.to_string())
            })
    }

    /// Get the player's strongest tension name from the relationship graph.
    fn get_strongest_negative_link(&self, player: &Player) -> Option<String> {
        self.game.relationship_graph
            .strongest_negative(&player.id)
            .map(|(other_id, _)| {
                self.game.players.iter()
                    .find(|p| p.id == other_id)
                    .map(|p| p.match_name.clone())
                    .unwrap_or_else(|| other_id.to_string())
            })
    }

    /// V100 Audit (L2): Compute the player's locker room role label from
    /// captaincy, age, OVR, and leadership. Was hardcoded "Squad member".
    ///
    /// Cascade: Captain → Vice Captain → Veteran (age ≥ 32) → Youngster (≤20)
    /// → Star Player (OVR ≥ 80) → Leader (leadership ≥ 70) → Squad member.
    fn compute_locker_room_role(&self, player: &Player) -> String {
        // Captain / Vice captain from team match_roles.
        if let Some(team) = self.game.teams.iter().find(|t| Some(&t.id) == player.team_id.as_ref()) {
            if team.match_roles.captain.as_deref() == Some(&player.id) {
                return "Captain".into();
            }
            if team.match_roles.vice_captain.as_deref() == Some(&player.id) {
                return "Vice Captain".into();
            }
        }
        // Compute age from date_of_birth (YYYY-MM-DD).
        let age = player.date_of_birth.get(0..4)
            .and_then(|y| y.parse::<u32>().ok())
            .map(|y| 2026u32.saturating_sub(y))
            .unwrap_or(25) as u8;
        if age >= 32 { return "Veteran".into(); }
        if age <= 20 { return "Youngster".into(); }
        if player.ovr >= 80 { return "Star Player".into(); }
        if player.attributes.leadership >= 70 { return "Leader".into(); }
        "Squad member".into()
    }

    /// V100 Audit (L1): Compute mentor_bonus_flag.
    /// Returns true if:
    ///   - This player is young (≤21) AND their team has a captain age ≥30
    ///     with leadership ≥70 (the player is being mentored).
    ///   - OR this player IS that captain (age ≥30, leadership ≥70) AND the
    ///     team has at least one young player.
    /// Was hardcoded false.
    fn compute_mentor_bonus_flag(&self, player: &Player) -> bool {
        let Some(team) = self.game.teams.iter().find(|t| Some(&t.id) == player.team_id.as_ref()) else {
            return false;
        };

        let age = |p: &Player| p.date_of_birth.get(0..4)
            .and_then(|y| y.parse::<u32>().ok())
            .map(|y| 2026u32.saturating_sub(y))
            .unwrap_or(25) as u8;

        let captain_id = team.match_roles.captain.as_deref();
        let captain = captain_id.and_then(|cid| self.game.players.iter().find(|p| p.id == cid));

        // Case 1: this player is a young player being mentored.
        if age(player) <= 21 {
            if let Some(cap) = captain {
                if age(cap) >= 30 && cap.attributes.leadership >= 70 {
                    return true;
                }
            }
        }

        // Case 2: this player IS the captain mentoring young players.
        if captain_id == Some(&player.id) && age(player) >= 30 && player.attributes.leadership >= 70 {
            let has_youth = self.game.players.iter()
                .filter(|p| p.team_id.as_deref() == Some(&team.id))
                .any(|p| age(p) <= 21);
            if has_youth {
                return true;
            }
        }

        false
    }

    /// V100 Audit (M2): Compute training_alignment_label.
    /// Compares the player's `training_position_focus` (if any) against
    /// their natural position. Returns:
    ///   - "Aligned" if focus matches natural position group
    ///   - "Misaligned" if focus is a different position group
    ///   - "Neutral" if no focus set (default — no retraining in progress)
    /// Was hardcoded "Aligned".
    fn compute_training_alignment_label(&self, player: &Player) -> String {
        match &player.training_position_focus {
            None => "Neutral".into(),
            Some(focus) => {
                let focus_group = focus.to_group_position();
                let natural_group = player.natural_position.to_group_position();
                if focus_group == natural_group {
                    "Aligned".into()
                } else if player.alternate_positions.iter().any(|ap| ap.to_group_position() == focus_group) {
                    "Compatible".into()
                } else {
                    "Misaligned".into()
                }
            }
        }
    }

    /// V100 Issue #30 (rework): Detect if this player has an active cross-team
    /// rivalry (engine-set, not manual). Returns true if any edge with
    /// `rivalry_flag == true` connects this player to someone on a different
    /// team. Powers the `rivalry_trigger_flag` field on PlayerMeaningSnapshot,
    /// which the UI surfaces as a "Rivalry Active" badge.
    fn has_active_rivalry(&self, player: &Player) -> bool {
        let player_team = player.team_id.as_ref();
        self.game.relationship_graph
            .relationships_for(&player.id)
            .into_iter()
            .any(|(other_id, edge)| {
                if !edge.rivalry_flag {
                    return false;
                }
                // Only cross-team rivalries count (same-team "rivalry" is just
                // a tense partnership, not a real rivalry).
                let other_team = self.game.players.iter()
                    .find(|p| p.id == other_id)
                    .and_then(|p| p.team_id.as_ref());
                other_team != player_team
            })
    }

    /// Get chemistry score from average relationship strength.
    fn get_chemistry_score(&self, player: &Player) -> i8 {
        let rels = self.game.relationship_graph.relationships_for(&player.id);
        if rels.is_empty() {
            return 0;
        }
        let avg: f32 = rels.iter().map(|(_, e)| e.strength as f32).sum::<f32>() / rels.len() as f32;
        avg as i8
    }

    /// Get clique membership labels for the player.
    fn get_clique_membership(&self, player: &Player) -> Vec<String> {
        let cliques = self.game.relationship_graph.cliques_for(&player.id);
        cliques.iter()
            .filter(|c| c.member_ids.contains(&player.id))
            .map(|c| format!("{:?} ({} members)", c.clique_type, c.member_ids.len()))
            .collect()
    }

    /// Get the player's current narrative status tag from active story threads.
    fn get_narrative_status_tag(&self, player: &Player) -> String {
        let threads = self.game.memory_store.threads_for(&player.id);
        if threads.is_empty() {
            return "None".to_string();
        }
        // Return the highest-momentum thread's tag
        let top = threads.iter()
            .max_by(|a, b| a.momentum_score.partial_cmp(&b.momentum_score).unwrap_or(std::cmp::Ordering::Equal));
        match top {
            Some(t) if t.momentum_score > 50.0 => format!("{:?} ★", t.thread_type),
            Some(t) if t.momentum_score > 20.0 => format!("{:?}", t.thread_type),
            _ => "None".to_string(),
        }
    }

    fn derive_role_identity(&self, player: &Player) -> String {
        let a = &player.attributes;
        let g = player.position.to_group_position();
        let mut c: Vec<(&str, u8)> = match g {
            Position::Goalkeeper => vec![("Shot Stopper",a.shot_stopping),("Sweeper Keeper",a.playing_out),("Commander",a.commanding),("Reflexes",a.agility)],
            Position::Defender => vec![("Ball Winner",a.defending),("Aerial Presence",a.aerial),("Tackler",a.defending),("Ball Player",a.passing),("Recovery Pace",a.pace)],
            Position::Midfielder => vec![("Tempo Setter",a.passing),("Playmaker",a.distribution),("Ball Winner",a.defending),("Engine",a.engine),("Presser",a.burst)],
            Position::Forward => vec![("Finisher",a.finishing),("Dribbler",a.touch),("Pace Threat",a.pace),("Aerial Threat",a.aerial),("Hold-up",a.power)],
            _ => vec![("Unknown",50u8)],
        };
        c.sort_by(|a,b| b.1.cmp(&a.1));
        let t1 = c.first().map(|(l,_)|*l).unwrap_or("Unknown");
        let t2 = c.get(1).map(|(l,_)|*l).unwrap_or(t1);
        if t1==t2 { t1.into() } else { format!("{} / {}",t1,t2) }
    }
}

#[allow(dead_code)]
fn position_name(p:&Position)->&'static str { match p { Position::Goalkeeper=>"Goalkeeper", Position::Defender|Position::RightBack|Position::CenterBack|Position::LeftBack|Position::RightWingBack|Position::LeftWingBack=>"Defender", Position::Midfielder|Position::DefensiveMidfielder|Position::CentralMidfielder|Position::AttackingMidfielder|Position::RightMidfielder|Position::LeftMidfielder=>"Midfielder", Position::Forward|Position::RightWinger|Position::LeftWinger|Position::Striker=>"Forward" } }

/// V100 Audit (M3/M4): Check if two tactical style strings are in adjacent
/// "families" — Attacking ↔ Pressing (both proactive, high-line), Defensive ↔
/// Counter (both reactive, deep block), Possession ↔ Balanced (control-oriented).
/// Returns true if compatible, false otherwise.
fn is_adjacent_style(a: &str, b: &str) -> bool {
    let a = a.trim();
    let b = b.trim();
    if a == b { return true; }
    let pairs: &[(&str, &str)] = &[
        ("Attacking", "Pressing"),
        ("Pressing", "Attacking"),
        ("Defensive", "Counter"),
        ("Counter", "Defensive"),
        ("Possession", "Balanced"),
        ("Balanced", "Possession"),
        ("Direct", "Counter"),
        ("Counter", "Direct"),
    ];
    pairs.iter().any(|(x, y)| (a == *x && b == *y) || (a == *y && b == *x))
}
fn trait_label(t:&PlayerTrait)->&'static str { match t { PlayerTrait::Speedster=>"Speedster",PlayerTrait::Explosive=>"Explosive",PlayerTrait::Workhorse=>"Workhorse",PlayerTrait::Powerhouse=>"Powerhouse",PlayerTrait::Twisty=>"Twisty",PlayerTrait::Orchestrator=>"Orchestrator",PlayerTrait::Predator=>"Predator",PlayerTrait::VelvetTouch=>"Velvet Touch",PlayerTrait::BallWinner=>"Ball Winner",PlayerTrait::Rock=>"Rock",PlayerTrait::SetPieceSpecialist=>"Set Piece Specialist",PlayerTrait::Leader=>"Leader",PlayerTrait::CoolHead=>"Cool Head",PlayerTrait::Visionary=>"Visionary",PlayerTrait::SafeHands=>"Safe Hands",PlayerTrait::CatReflexes=>"Cat Reflexes",PlayerTrait::Commander=>"Commander",PlayerTrait::CompleteForward=>"Complete Forward",PlayerTrait::EngineRoom=>"Engine Room",PlayerTrait::Wonderkid=>"Wonderkid" } }
fn morale_state_label(m:u8)->&'static str { match m.min(100) { 90..=100=>"Soaring",75..=89=>"Content",55..=74=>"Uneasy",35..=54=>"Deflated",_=>"Toxic" } }

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clock::GameClock;
    use crate::game::Game;
    use domain::manager::Manager;
    use domain::player::{Player, PlayerAttributes, Position};
    use domain::team::Team;

    fn make_test_game() -> Game {
        let clock = GameClock::new(chrono::Utc::now());
        let manager = Manager::new("mgr1".into(),"Test".into(),"Gaffer".into(),"1980-01-01".into(),"GB".into());
        let team = Team::new("team1".into(),"Test FC".into(),"TFC".into(),"England".into(),"London".into(),"Test Stadium".into(),50_000);
        let mut player = Player::new("p1".into(),"John Test".into(),"John Test".into(),"1995-06-15".into(),"GB".into(),Position::Midfielder,PlayerAttributes::defaults());
        player.team_id = Some("team1".into());
        player.morale = 80;
        player.condition = 90;
        let mut game = Game::new(clock,manager,vec![team],vec![player],vec![],vec![]);
        game.manager.team_id = Some("team1".into());
        game
    }

    #[test] fn build_player_snapshot_works() {
        let game = make_test_game();
        let svc = InterpretationSurfaceService::new(&game);
        let snap = svc.player_meaning("p1").expect("player should exist");
        assert_eq!(snap.display_name, "John Test");
        assert_eq!(snap.club, "Test FC");
        assert!(!snap.stability_label.is_empty());
    }

    #[test] fn squad_snapshot_uses_full_squad_pulse_formula() {
        let game = make_test_game();
        let svc = InterpretationSurfaceService::new(&game);
        let snap = svc.squad_meaning();
        // V100 audit (M3/M4): tactical_alignment is no longer hardcoded 50.0 —
        // it now derives from manager tactical_style vs team play_style. In
        // the test game both default to Balanced, so they match → 100.0.
        // SquadPulse = (80×0.25) + (0×0.20) + (100×0.15) + (50×0.15) + (50×0.10) - (0×0.10) - (0×0.05) = 47.5 → 48
        assert_eq!(snap.squad_harmony_score, 48);
        assert!(!snap.harmony_explanation.is_empty());
    }

    #[test] fn stability_label_str_matches_expected_gaffer_voice() {
        let mut p = Player::new("x".into(),"x".into(),"x".into(),"2000-01-01".into(),"GB".into(),Position::Forward,PlayerAttributes::defaults());
        p.stability_modifier = 5; assert_eq!(p.stability_label().as_str(), "Roll of the Dice");
        p.stability_modifier = 30; assert_eq!(p.stability_label().as_str(), "Runs Hot and Cold");
        p.stability_modifier = 50; assert_eq!(p.stability_label().as_str(), "Steady Hand");
        p.stability_modifier = 75; assert_eq!(p.stability_label().as_str(), "Trusted Lieutenant");
        p.stability_modifier = 95; assert_eq!(p.stability_label().as_str(), "Mr. Reliable");
    }
}
