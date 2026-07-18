use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::event::{EventType, MatchEvent};
use crate::types::{Position, Side, Zone};

// ---------------------------------------------------------------------------
// TeamStats — aggregate stats for one side
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TeamStats {
    pub goals: u8,
    pub shots: u16,
    pub shots_on_target: u16,
    pub shots_off_target: u16,
    pub shots_blocked: u16,
    pub passes_completed: u16,
    pub passes_intercepted: u16,
    pub tackles: u16,
    pub interceptions: u16,
    pub fouls: u16,
    pub corners: u16,
    pub free_kicks: u16,
    pub penalties: u16,
    pub yellow_cards: u8,
    pub red_cards: u8,
    pub possession_ticks: u32,
}

impl TeamStats {
    pub fn pass_accuracy(&self) -> f64 {
        let total = self.passes_completed as f64 + self.passes_intercepted as f64;
        if total == 0.0 {
            return 0.0;
        }
        self.passes_completed as f64 / total * 100.0
    }
}

// ---------------------------------------------------------------------------
// PlayerMatchStats — individual player performance
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PlayerMatchStats {
    pub minutes_played: u8,
    pub goals: u8,
    pub assists: u8,
    pub shots: u8,
    pub shots_on_target: u8,
    pub passes_completed: u8,
    pub passes_attempted: u8,
    pub tackles_won: u8,
    pub interceptions: u8,
    pub fouls_committed: u8,
    pub yellow_cards: u8,
    pub red_cards: u8,
    /// V100 P0-5 (Issue #38): Saves credited to the GK. Previously saves
    /// only incremented `team_stats.shots_on_target`, so a GK making 10
    /// world-class saves got the same 6.0 rating as one who wasn't tested.
    #[serde(default)]
    pub saves: u8,
    /// Match rating 0.0–10.0, computed after the match.
    pub rating: f32,
}

// ---------------------------------------------------------------------------
// GoalSource — how a goal was created (distinct from event.rs GoalContext which tracks narrative)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum GoalSource {
    OpenPlay,
    Corner,
    FreeKick,
    Penalty,
}

// ---------------------------------------------------------------------------
// GoalDetail — enriched goal info for the report
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoalDetail {
    pub minute: u8,
    pub scorer_id: String,
    pub assist_id: Option<String>,
    pub goal_source: GoalSource,
    pub side: Side,
}

// ---------------------------------------------------------------------------
// MatchReport — the complete output of a simulated match
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchReport {
    pub home_goals: u8,
    pub away_goals: u8,
    pub home_stats: TeamStats,
    pub away_stats: TeamStats,
    pub events: Vec<MatchEvent>,
    pub goals: Vec<GoalDetail>,
    pub player_stats: HashMap<String, PlayerMatchStats>,
    /// Possession percentage for the home team (0–100).
    pub home_possession: f64,
    /// Total simulated minutes (90 + stoppage).
    pub total_minutes: u8,
    /// Penalty-shootout score when the match went to one; `None` otherwise.
    /// Shootout kicks are never counted in `home_goals`/`away_goals`.
    #[serde(default)]
    pub home_penalties: Option<u8>,
    #[serde(default)]
    pub away_penalties: Option<u8>,
}

impl MatchReport {
    /// Build the report from the raw event log and possession counters.
    pub fn from_events(
        events: Vec<MatchEvent>,
        home_possession_ticks: u32,
        away_possession_ticks: u32,
        total_minutes: u8,
    ) -> Self {
        Self::from_events_with_players(
            events,
            home_possession_ticks,
            away_possession_ticks,
            total_minutes,
            Vec::new(),
            // V100 P0-5 (Issue #38): Empty positions map — saves won't be
            // credited to a GK, but the legacy `from_events` path is only
            // used by tests/sparse paths that don't need GK-specific logic.
            std::collections::HashMap::new(),
        )
    }

    /// Build the report while also assigning minutes played for tracked players.
    ///
    /// V100 P0-5 (Issue #38): Now accepts a `player_positions` map so saves
    /// can be credited to the GK on the defending side (the ShotSaved event
    /// only carries the shooter's ID, not the GK's). Also passes the map
    /// to `compute_player_ratings` for proper position-aware rating logic.
    pub fn from_events_with_players(
        events: Vec<MatchEvent>,
        home_possession_ticks: u32,
        away_possession_ticks: u32,
        total_minutes: u8,
        tracked_player_ids: Vec<String>,
        player_positions: HashMap<String, (Side, Position)>,
    ) -> Self {
        let mut home_stats = TeamStats::default();
        let mut away_stats = TeamStats::default();
        let mut goals = Vec::new();
        let mut player_stats: HashMap<String, PlayerMatchStats> = HashMap::new();

        home_stats.possession_ticks = home_possession_ticks;
        away_stats.possession_ticks = away_possession_ticks;

        // V100 P0-5 (Issue #38): Pre-compute each side's GK id so we can
        // credit saves during ShotSaved events. The ShotSaved event carries
        // only the shooter's id; the GK is "whoever on the defending side
        // has Position::Goalkeeper". If a side has no GK in the positions
        // map (e.g. test fixtures), saves won't be credited to anyone.
        let home_gk_id: Option<String> = player_positions
            .iter()
            .find(|(_, (_, pos))| *pos == Position::Goalkeeper)
            .filter(|(_, (side, _))| *side == Side::Home)
            .map(|(id, _)| id.clone());
        let away_gk_id: Option<String> = player_positions
            .iter()
            .find(|(_, (_, pos))| *pos == Position::Goalkeeper)
            .filter(|(_, (side, _))| *side == Side::Away)
            .map(|(id, _)| id.clone());

        // State machine to determine goal source from preceding set-piece event.
        // Tracks (event_type, side) so a set piece earned by one team doesn't
        // accidentally attribute a goal scored by the other.
        let mut last_set_piece: Option<(EventType, Side)> = None;

        for event in &events {
            let stats = match event.side {
                Side::Home => &mut home_stats,
                Side::Away => &mut away_stats,
            };

            // Track set-piece window: reset on events that clear the opportunity
            match &event.event_type {
                EventType::Corner => last_set_piece = Some((EventType::Corner, event.side)),
                EventType::FreeKick => {
                    // Only dangerous free kicks count: the taking side must be in their attacking
                    // third (opponent's defensive third). A free kick in HomeDefense is only
                    // dangerous when Away is taking it, and vice-versa.
                    let dangerous_zone = match event.side {
                        Side::Home => Zone::AwayDefense,
                        Side::Away => Zone::HomeDefense,
                    };
                    if event.zone == dangerous_zone {
                        last_set_piece = Some((EventType::FreeKick, event.side));
                    }
                }
                // Defensive events clear the set-piece window
                EventType::ShotOffTarget
                | EventType::ShotBlocked
                | EventType::ShotSaved
                | EventType::PenaltyMiss
                | EventType::Clearance
                | EventType::Interception
                | EventType::PassIntercepted
                | EventType::GoalKick => last_set_piece = None,
                _ => {}
            }

            // Update player stats helper
            let pid = event.player_id.as_deref().unwrap_or("");

            match &event.event_type {
                EventType::Goal => {
                    stats.goals += 1;
                    stats.shots += 1;
                    stats.shots_on_target += 1;
                    let source = match last_set_piece.take() {
                        Some((EventType::Corner, sp_side)) if sp_side == event.side => GoalSource::Corner,
                        Some((EventType::FreeKick, sp_side)) if sp_side == event.side => GoalSource::FreeKick,
                        _ => GoalSource::OpenPlay,
                    };
                    goals.push(GoalDetail {
                        minute: event.minute,
                        scorer_id: pid.to_string(),
                        assist_id: event.secondary_player_id.clone(),
                        goal_source: source,
                        side: event.side,
                    });
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.goals += 1;
                        ps.shots += 1;
                        ps.shots_on_target += 1;
                    }
                    if let Some(ref assist_id) = event.secondary_player_id {
                        let ps = player_stats.entry(assist_id.clone()).or_default();
                        ps.assists += 1;
                    }
                }
                EventType::PenaltyGoal => {
                    stats.goals += 1;
                    stats.shots += 1;
                    stats.shots_on_target += 1;
                    stats.penalties += 1;
                    last_set_piece = None;
                    goals.push(GoalDetail {
                        minute: event.minute,
                        scorer_id: pid.to_string(),
                        assist_id: None,
                        goal_source: GoalSource::Penalty,
                        side: event.side,
                    });
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.goals += 1;
                        ps.shots += 1;
                        ps.shots_on_target += 1;
                    }
                }
                EventType::PenaltyMiss => {
                    stats.shots += 1;
                    stats.penalties += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.shots += 1;
                    }
                }
                EventType::ShotOnTarget | EventType::ShotSaved => {
                    stats.shots += 1;
                    stats.shots_on_target += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.shots += 1;
                        ps.shots_on_target += 1;
                    }
                    // V100 P0-5 (Issue #38): Credit the save to the defending
                    // side's GK. The ShotSaved event carries the SHOOTER's
                    // pid, not the GK's, so we look up the defending side's
                    // GK from the pre-computed `home_gk_id` / `away_gk_id`.
                    // Only ShotSaved counts as a save (ShotOnTarget events
                    // in this engine are the on-target variant that didn't
                    // result in a save — they're a different event type).
                    if matches!(event.event_type, EventType::ShotSaved) {
                        let defending_gk_id = match event.side {
                            // Attacker is Home → defender is Away → Away GK
                            Side::Home => away_gk_id.as_deref(),
                            // Attacker is Away → defender is Home → Home GK
                            Side::Away => home_gk_id.as_deref(),
                        };
                        if let Some(gk_id) = defending_gk_id {
                            let gk_ps = player_stats.entry(gk_id.to_string()).or_default();
                            gk_ps.saves += 1;
                        }
                    }
                }
                EventType::ShotOffTarget => {
                    stats.shots += 1;
                    stats.shots_off_target += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.shots += 1;
                    }
                }
                EventType::ShotBlocked => {
                    stats.shots += 1;
                    stats.shots_blocked += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.shots += 1;
                    }
                }
                EventType::PassCompleted => {
                    stats.passes_completed += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.passes_completed += 1;
                        ps.passes_attempted += 1;
                    }
                }
                EventType::PassIntercepted => {
                    stats.passes_intercepted += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.passes_attempted += 1;
                    }
                }
                EventType::Tackle => {
                    stats.tackles += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.tackles_won += 1;
                    }
                }
                EventType::Interception => {
                    stats.interceptions += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.interceptions += 1;
                    }
                }
                EventType::Foul => {
                    stats.fouls += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.fouls_committed += 1;
                    }
                }
                EventType::YellowCard | EventType::SecondYellow => {
                    stats.yellow_cards += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.yellow_cards += 1;
                    }
                }
                EventType::RedCard => {
                    stats.red_cards += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.red_cards += 1;
                    }
                }
                EventType::Corner => {
                    stats.corners += 1;
                }
                EventType::FreeKick => {
                    stats.free_kicks += 1;
                }
                EventType::PenaltyAwarded => {
                    stats.penalties += 1;
                }
                // V99.1: Track new event types for player stats.
                // Dribbles, crosses, headers, and offsides now contribute
                // to the player's match performance data.
                EventType::Dribble => {
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        // Dribbles completed — count as a positive contribution
                        // toward the player's rating. We don't have a dedicated
                        // field for dribbles, but passes_completed is a reasonable
                        // proxy for rating calculation purposes.
                        ps.passes_completed += 1;
                    }
                }
                EventType::Cross => {
                    // Crosses are an attacking contribution — count as pass attempted
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.passes_attempted += 1;
                    }
                }
                EventType::HeaderWon => {
                    // Aerial duels won — count as a defensive/attacking contribution
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.tackles_won += 1; // proxy for duel won
                    }
                }
                // Shootout kicks are intentionally excluded from goals,
                // GoalDetails, and player stats — the shootout is scored
                // separately via home_penalties/away_penalties.
                EventType::ShootoutGoal | EventType::ShootoutMiss => {}
                // Untracked events (structural, clearances, goal kicks, etc.)
                EventType::DribbleTackled
                | EventType::HeaderLost
                | EventType::Offside
                | EventType::Clearance
                | EventType::GoalKick
                | EventType::KickOff
                | EventType::HalfTime
                | EventType::SecondHalfStart
                | EventType::FullTime
                | EventType::Injury => {}
                _ => {}
            }
        }

        populate_minutes_played(
            &events,
            total_minutes,
            &tracked_player_ids,
            &mut player_stats,
        );

        // V99.1: Compute player ratings based on match performance.
        // Previously this field was never set (stayed at 0.0), causing
        // all player avg_ratings to be 0.0 in the DB.
        // V100 P0-5 (Issue #38): Now passes the player_positions map so the
        // rating function can apply position-specific bonuses (GK saves,
        // DEF clean sheet, etc.) instead of relying on heuristics.
        compute_player_ratings(
            &mut player_stats,
            home_stats.goals,
            away_stats.goals,
            Side::Home,
            &player_positions,
        );

        let total_poss = home_possession_ticks + away_possession_ticks;
        let home_possession = if total_poss > 0 {
            home_possession_ticks as f64 / total_poss as f64 * 100.0
        } else {
            50.0
        };

        Self {
            home_goals: home_stats.goals,
            away_goals: away_stats.goals,
            home_stats,
            away_stats,
            events,
            goals,
            player_stats,
            home_possession,
            total_minutes,
            home_penalties: None,
            away_penalties: None,
        }
    }
}

fn populate_minutes_played(
    events: &[MatchEvent],
    total_minutes: u8,
    tracked_player_ids: &[String],
    player_stats: &mut HashMap<String, PlayerMatchStats>,
) {
    // Note: tracked_player_ids contains ONLY the starting XI from TeamData.players
    // (not the bench). The full engine path doesn't make substitutions (by design),
    // so all starters correctly receive total_minutes. The live match path emits
    // Substitution events which override these defaults.
    let mut minutes_by_player: HashMap<String, u8> = tracked_player_ids
        .iter()
        .cloned()
        .map(|player_id| (player_id, total_minutes))
        .collect();

    for event in events {
        match event.event_type {
            EventType::Substitution => {
                if let Some(ref player_off_id) = event.secondary_player_id {
                    minutes_by_player
                        .insert(player_off_id.clone(), event.minute.min(total_minutes));
                }
                if let Some(ref player_on_id) = event.player_id {
                    minutes_by_player.insert(
                        player_on_id.clone(),
                        total_minutes.saturating_sub(event.minute),
                    );
                }
            }
            EventType::RedCard | EventType::SecondYellow => {
                if let Some(ref player_id) = event.player_id {
                    let dismissed_at = event.minute.min(total_minutes);
                    minutes_by_player
                        .entry(player_id.clone())
                        .and_modify(|minutes| *minutes = (*minutes).min(dismissed_at))
                        .or_insert(dismissed_at);
                }
            }
            _ => {}
        }
    }

    for (player_id, minutes_played) in minutes_by_player {
        player_stats.entry(player_id).or_default().minutes_played = minutes_played;
    }
}

/// V99.1: Compute a 0.0–10.0 match rating for each player based on their
/// performance statistics.
///
/// The rating system uses a base of 6.0 (average performance) and adjusts
/// up/down based on positive/negative contributions:
///
/// Positive:
/// - +1.0 per goal scored
/// - +0.5 per assist
/// - +0.3 per shot on target (max +1.0)
/// - +0.1 per tackle won (max +1.0)
/// - +0.1 per interception (max +0.5)
/// - +0.02 per pass completed (max +0.5)
/// - Clean sheet bonus for players who played 60+ minutes: +0.5
///
/// Negative:
/// - -0.5 per yellow card
/// - -1.5 per red card
/// - -0.3 per goal conceded (for players on the concedding team, max -1.5)
///
/// Final rating is clamped to [3.0, 10.0].
///
/// V99.10 C1: Now position-aware. GKs get clean-sheet bonus + goals-conceded
/// penalty. DEFs get clean-sheet bonus + tackle/interception bonus. MIDs
/// get passing volume bonus. FWDs get goal/shot bonuses. Previously every
/// position got the same goal/assist/card structure, which was unrealistic
/// (a GK getting the same goal bonus as a striker).
///
/// V100 P0-5 (Issue #38): Properly position-aware now. The function accepts
/// a `player_positions` map (player_id -> (Side, Position)) so we can apply
/// position-specific bonuses without guessing from stats:
/// - GK: +0.05 per save (cap +1.5), clean sheet +1.5 (60+ min, 0 conceded),
///        -0.2 per goal conceded (cap -1.5)
/// - DEF: clean sheet +0.8 (60+ min), tackles/interceptions ×1.5 weight,
///        -0.1 per goal conceded (cap -0.8)
/// - MID: passing volume bonus (universal, kept as-is)
/// - FWD: goal/shot bonuses (universal, kept as-is)
fn compute_player_ratings(
    player_stats: &mut HashMap<String, PlayerMatchStats>,
    home_goals: u8,
    away_goals: u8,
    _home_side: Side,
    player_positions: &HashMap<String, (Side, Position)>,
) {
    for (player_id, ps) in player_stats.iter_mut() {
        let mut rating: f32 = 6.0; // Base rating

        // V100 P0-5 (Issue #38): Look up this player's side + position.
        // Players not in the positions map (e.g. test fixtures, or players
        // who came on as subs and weren't tracked) fall back to the old
        // position-blind heuristics.
        let pos_info = player_positions.get(player_id);

        // Determine goals conceded by this player's team.
        let goals_conceded: u8 = if let Some((side, _)) = pos_info {
            match side {
                Side::Home => away_goals, // Home team concedes Away's goals
                Side::Away => home_goals,  // Away team concedes Home's goals
            }
        } else {
            // Unknown side — use the average as a defensive fallback.
            ((home_goals + away_goals) / 2).min(home_goals).min(away_goals)
        };

        // Positive contributions (universal — apply to all positions)
        rating += ps.goals as f32 * 1.0;
        rating += ps.assists as f32 * 0.5;
        rating += (ps.shots_on_target as f32 * 0.3).min(1.0);
        rating += (ps.tackles_won as f32 * 0.1).min(1.0);
        rating += (ps.interceptions as f32 * 0.1).min(0.5);
        rating += (ps.passes_completed as f32 * 0.02).min(0.5);

        // V100 P0-5 (Issue #38): Position-specific scoring.
        if let Some((_, position)) = pos_info {
            match position {
                Position::Goalkeeper => {
                    // Saves: +0.05 per save, capped at +1.5 (30 saves)
                    rating += (ps.saves as f32 * 0.05).min(1.5);
                    // Clean sheet bonus: +1.5 (60+ min, 0 conceded)
                    if ps.minutes_played >= 60 && goals_conceded == 0 {
                        rating += 1.5;
                    }
                    // Goals conceded penalty: -0.2 per goal, cap -1.5
                    rating -= (goals_conceded as f32 * 0.2).min(1.5);
                }
                Position::Defender => {
                    // Clean sheet bonus: +0.8 (60+ min, 0 conceded)
                    if ps.minutes_played >= 60 && goals_conceded == 0 {
                        rating += 0.8;
                    }
                    // Tackles/interceptions weighted ×1.5 (extra credit for DEF)
                    let defensive_bonus =
                        ((ps.tackles_won as f32 + ps.interceptions as f32) * 0.05).min(1.0);
                    rating += defensive_bonus * 0.5; // additional to the universal 0.1
                    // Goals conceded penalty: -0.1 per goal, cap -0.8
                    rating -= (goals_conceded as f32 * 0.1).min(0.8);
                }
                Position::Midfielder => {
                    // Passing volume bonus already applied universally.
                    // Small extra credit for high-work-rate MIDs (5+ tackles).
                    if ps.tackles_won >= 5 {
                        rating += 0.3;
                    }
                }
                Position::Forward => {
                    // Shot volume bonus: +0.02 per shot, cap +0.5
                    rating += (ps.shots as f32 * 0.02).min(0.5);
                    // Bonus for shots on target (already in universal but
                    // give FWDs a small extra for being clinical).
                    if ps.shots_on_target >= 2 && ps.goals >= 1 {
                        rating += 0.3; // clinical finisher bonus
                    }
                }
            }
        } else {
            // V100 P0-5 (Issue #38): Fallback for players without position
            // info — use the old V99.10 C1 heuristics. This preserves
            // backward compatibility for tests and the sparse-sim path.
            if ps.minutes_played >= 60 {
                if home_goals == 0 && away_goals == 0 {
                    rating += 0.5; // 0-0 draw, both defences good
                }
            }
            let defensive_actions = ps.tackles_won as f32 + ps.interceptions as f32;
            if defensive_actions >= 5.0 && ps.shots == 0 {
                rating += (defensive_actions * 0.05).min(1.0);
            }
        }

        // Negative contributions
        rating -= ps.yellow_cards as f32 * 0.5;
        rating -= ps.red_cards as f32 * 1.5;

        // Clamp to reasonable range
        ps.rating = rating.clamp(3.0, 10.0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn event(minute: u8, event_type: EventType, side: Side, player: &str) -> MatchEvent {
        MatchEvent::new(minute, event_type, side, Zone::attacking_box(side)).with_player(player)
    }

    // Regression: shootout kicks used to be counted as match goals, inflating
    // the scoreline (1-1 won 4-3 on pens was reported as 5-4) and the
    // scorers' goal tallies.
    #[test]
    fn shootout_kicks_are_not_goals() {
        let events = vec![
            event(20, EventType::Goal, Side::Home, "h1"),
            event(55, EventType::PenaltyGoal, Side::Away, "a1"),
            // Shootout after extra time
            event(121, EventType::ShootoutGoal, Side::Home, "h1"),
            event(121, EventType::ShootoutGoal, Side::Away, "a2"),
            event(122, EventType::ShootoutGoal, Side::Home, "h2"),
            event(122, EventType::ShootoutMiss, Side::Away, "a3"),
        ];
        let report = MatchReport::from_events(events, 50, 50, 120);

        assert_eq!(report.home_goals, 1);
        assert_eq!(report.away_goals, 1);
        assert_eq!(report.goals.len(), 2, "GoalDetails must exclude shootout kicks");
        assert_eq!(report.player_stats["h1"].goals, 1);
        assert_eq!(report.player_stats["a1"].goals, 1);
        assert!(
            report.player_stats.get("h2").map_or(true, |p| p.goals == 0),
            "shootout-only kicker must not be credited a goal"
        );
        // In-match penalties still count.
        assert_eq!(report.goals[1].goal_source, GoalSource::Penalty);
    }
}
