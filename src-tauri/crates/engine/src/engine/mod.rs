mod fouls;
mod resolution;

use rand::{Rng, RngExt};

use crate::event::{EventType, MatchEvent};
use crate::report::MatchReport;
use crate::shared::{self, PlayerSnap};
use crate::types::{MatchConfig, PlayerData, Position, Side, TeamData, Zone};

// ---------------------------------------------------------------------------
// MatchEngine — the core minute-by-minute simulator
// ---------------------------------------------------------------------------

/// Simulate a full match between two teams and return a detailed report.
pub fn simulate(home: &TeamData, away: &TeamData, config: &MatchConfig) -> MatchReport {
    let mut rng = rand::rng();
    simulate_with_rng(home, away, config, &mut rng)
}

/// Simulate with an explicit RNG (useful for deterministic tests).
pub fn simulate_with_rng<R: Rng>(
    home: &TeamData,
    away: &TeamData,
    config: &MatchConfig,
    rng: &mut R,
) -> MatchReport {
    let mut ctx = MatchContext::new(home, away, config);

    // Kick-off
    ctx.emit(MatchEvent::new(
        0,
        EventType::KickOff,
        Side::Home,
        Zone::Midfield,
    ));
    ctx.ball_zone = Zone::Midfield;
    ctx.possession = Side::Home;

    // --- First half (minutes 1–45 + stoppage) ---
    let first_half_stoppage = rng.random_range(0..=config.stoppage_time_max);
    let first_half_end = 45 + first_half_stoppage;
    for minute in 1..=first_half_end {
        simulate_minute(&mut ctx, minute, rng);
    }
    ctx.emit(MatchEvent::new(
        first_half_end,
        EventType::HalfTime,
        Side::Home,
        Zone::Midfield,
    ));

    // Reset ball position for second half
    let second_half_start = first_half_end + 1;
    ctx.ball_zone = Zone::Midfield;
    ctx.possession = Side::Away;
    ctx.emit(MatchEvent::new(
        second_half_start,
        EventType::SecondHalfStart,
        Side::Away,
        Zone::Midfield,
    ));

    // --- Second half (minutes 46–90 + stoppage) ---
    let second_half_stoppage = rng.random_range(0..=config.stoppage_time_max);
    let match_end = 90 + first_half_stoppage + second_half_stoppage;
    for minute in second_half_start..=match_end {
        simulate_minute(&mut ctx, minute, rng);
    }
    let total_minutes = match_end;
    ctx.emit(MatchEvent::new(
        match_end,
        EventType::FullTime,
        Side::Home,
        Zone::Midfield,
    ));

    let tracked_player_ids = home
        .players
        .iter()
        .chain(away.players.iter())
        .map(|player| player.id.clone())
        .collect();

    // V100 P0-5 (Issue #38): Build a player_id -> (Side, Position) map so
    // the report can credit saves to GKs and apply position-aware ratings.
    let mut player_positions: std::collections::HashMap<String, (Side, Position)> =
        std::collections::HashMap::new();
    for player in &home.players {
        player_positions.insert(player.id.clone(), (Side::Home, player.position));
    }
    for player in &away.players {
        player_positions.insert(player.id.clone(), (Side::Away, player.position));
    }

    MatchReport::from_events_with_players(
        ctx.events,
        ctx.home_possession_ticks,
        ctx.away_possession_ticks,
        total_minutes,
        tracked_player_ids,
        player_positions,
    )
}

// ---------------------------------------------------------------------------
// Internal context carried through the simulation
// ---------------------------------------------------------------------------

pub(crate) struct MatchContext<'a> {
    pub(crate) home: &'a TeamData,
    pub(crate) away: &'a TeamData,
    pub(crate) config: &'a MatchConfig,
    pub(crate) home_score: u8,
    pub(crate) away_score: u8,
    pub(crate) ball_zone: Zone,
    pub(crate) possession: Side,
    pub(crate) events: Vec<MatchEvent>,
    pub(crate) home_possession_ticks: u32,
    pub(crate) away_possession_ticks: u32,
    pub(crate) yellows: std::collections::HashMap<String, u8>,
    pub(crate) sent_off: std::collections::HashSet<String>,
    /// Team-level condition scalar (0.0–1.0). Starts from mean player condition, depletes per minute.
    pub(crate) home_condition: f64,
    pub(crate) away_condition: f64,
    /// V100 P0-18 (Issue #12): Last minute a shot was attempted (any type).
    /// Used to detect QuietMinute (5+ minutes without a shot).
    pub(crate) last_shot_minute: u8,
    /// V100 P0-18 (Issue #12): Counter for consecutive minutes the current
    /// possession side has held the ball in their attacking third. Resets
    /// when possession flips or ball leaves the attacking third. Used to
    /// detect SustainedPressure (3+ consecutive minutes).
    pub(crate) attacking_pressure_streak: u8,
    /// V100 P0-18 (Issue #12): Last side to have possession. Used to detect
    /// MomentumShift (possession flips 3+ times in 5 minutes).
    pub(crate) last_possession: Side,
    /// V100 P0-18 (Issue #12): Count of possession flips in the last 5 minutes.
    pub(crate) recent_possession_flips: u8,
    /// V100 (Issue #12): Consecutive pass streak for the current possession
    /// side. Resets on turnover, shot, or possession flip. Used to emit
    /// "nice build-up" commentary when 3+ passes chain together.
    pub(crate) pass_streak: u8,
}

fn team_avg_condition(team: &TeamData) -> f64 {
    if team.players.is_empty() {
        return 1.0;
    }
    let sum: f64 = team.players.iter().map(|p| p.condition as f64).sum();
    (sum / team.players.len() as f64 / 100.0).clamp(0.5, 1.0)
}

impl<'a> MatchContext<'a> {
    fn new(home: &'a TeamData, away: &'a TeamData, config: &'a MatchConfig) -> Self {
        Self {
            home,
            away,
            config,
            home_score: 0,
            away_score: 0,
            ball_zone: Zone::Midfield,
            possession: Side::Home,
            events: Vec::with_capacity(200),
            home_possession_ticks: 0,
            away_possession_ticks: 0,
            yellows: std::collections::HashMap::new(),
            sent_off: std::collections::HashSet::new(),
            home_condition: team_avg_condition(home),
            away_condition: team_avg_condition(away),
            // V100 P0-18 (Issue #12): Narrative atmosphere tracking init.
            last_shot_minute: 0,
            attacking_pressure_streak: 0,
            last_possession: Side::Home,
            recent_possession_flips: 0,
            pass_streak: 0,
        }
    }

    pub(crate) fn emit(&mut self, event: MatchEvent) {
        self.events.push(event);
    }

    pub(crate) fn team(&self, side: Side) -> &'a TeamData {
        match side {
            Side::Home => self.home,
            Side::Away => self.away,
        }
    }

    pub(crate) fn add_goal(&mut self, side: Side) {
        match side {
            Side::Home => self.home_score += 1,
            Side::Away => self.away_score += 1,
        }
    }
}

/// Pick a random player from a side, preferring a given position, and return
/// a snapshot so we don't hold a borrow on the context.
fn snap_player<R: Rng>(
    ctx: &MatchContext,
    side: Side,
    preferred: Position,
    rng: &mut R,
) -> PlayerSnap {
    let team = ctx.team(side);
    let available: Vec<&PlayerData> = team
        .players
        .iter()
        .filter(|p| !ctx.sent_off.contains(&p.id))
        .collect();

    let candidates: Vec<&PlayerData> = available
        .iter()
        .filter(|p| p.position == preferred)
        .copied()
        .collect();

    let pool = if candidates.is_empty() {
        &available
    } else {
        &candidates
    };

    if pool.is_empty() {
        return PlayerSnap::from(&team.players[0]);
    }
    PlayerSnap::from(pool[rng.random_range(0..pool.len())])
}

// ---------------------------------------------------------------------------
// Minute simulation
// ---------------------------------------------------------------------------

fn simulate_minute<R: Rng>(ctx: &mut MatchContext, minute: u8, rng: &mut R) {
    match ctx.possession {
        Side::Home => ctx.home_possession_ticks += 1,
        Side::Away => ctx.away_possession_ticks += 1,
    }

    // Deplete team condition ~0.18 over 90 minutes (floor at 0.70, but never increase
    // if condition is already below 0.70 at match start).
    // V99: Apply tactics_pressing_fatigue so aggressive pressing tires CPU teams
    // the same way it tires user teams. Previously only the live match path
    // applied this — CPU-only matches ignored it, creating a divergence.
    let base_depletion = ctx.config.fatigue_per_minute / 100.0;
    let home_pressing_mod = shared::tactics_pressing_fatigue(&ctx.home.tactics);
    let away_pressing_mod = shared::tactics_pressing_fatigue(&ctx.away.tactics);
    // V99.4 T1.1: Apply weather fatigue modifier (heat increases fatigue).
    let home_depletion = base_depletion * home_pressing_mod * ctx.config.weather.fatigue;
    let away_depletion = base_depletion * away_pressing_mod * ctx.config.weather.fatigue;
    ctx.home_condition = (ctx.home_condition - home_depletion).max(0.70_f64.min(ctx.home_condition));
    ctx.away_condition = (ctx.away_condition - away_depletion).max(0.70_f64.min(ctx.away_condition));

    // V100 FIX (forensic): Reverted from 2-4 back to 1-3 actions per minute.
    // User feedback: "still too many goals". The V100 bump to 2-4 increased
    // shot volume which offset the per-shot conversion rate drop. At 1-3
    // actions/min × 90 min = 90-270 actions/team, of which ~10-15% reach
    // the box for a shot attempt. That gives ~10-25 shots/team/match which
    // is realistic (real EPL average is ~12-14 shots/team/match).
    let actions = rng.random_range(1..=3u8);
    for _ in 0..actions {
        resolution::resolve_action(ctx, minute, rng);
    }

    // Possession contest via midfield battle. Tempo (retention) and pressing
    // (ball-winning) weight the battle; transition dials act on the flip. Neutral
    // dials are ×1.0 / no-roll, so default sides match the pre-dial engine.
    let poss_side = ctx.possession;
    let def_side = poss_side.opposite();
    let poss_tactics = ctx.team(poss_side).tactics.clone();
    let def_tactics = ctx.team(def_side).tactics.clone();
    let mid_att = resolution::effective_midfield(ctx, poss_side)
        * shared::tactics_tempo_retention(&poss_tactics);
    let mid_def = resolution::effective_midfield(ctx, def_side)
        * shared::tactics_pressing_contest(&def_tactics);
    let retain = mid_att / (mid_att + mid_def);
    if rng.random_range(0.0..1.0f64) > retain {
        let rewin = shared::tactics_counter_press_rewin(&poss_tactics);
        if rewin > 0.0 && rng.random_range(0.0..1.0f64) < rewin {
            // Counter-press wins it straight back; nothing changes.
        } else {
            // V100 P0-18 (Issue #12): Possession flipped — update tracking.
            if ctx.last_possession != def_side {
                ctx.recent_possession_flips = ctx.recent_possession_flips.saturating_add(1);
                ctx.last_possession = def_side;
            }
            ctx.possession = def_side;
            let breakaway = shared::tactics_break_speed_counter(&def_tactics);
            if breakaway > 0.0 && rng.random_range(0.0..1.0f64) < breakaway {
                ctx.ball_zone = Zone::attacking_third(def_side);
                // V100 P0-18 (Issue #12): Counter-attack signal. The defending
                // side won the ball and broke forward at speed.
                if minute > 5 && minute < 88 {
                    ctx.emit(MatchEvent::new(
                        minute,
                        EventType::CounterAttack,
                        def_side,
                        Zone::attacking_third(def_side),
                    ));
                }
            } else {
                ctx.ball_zone = Zone::Midfield;
            }
        }
    }

    // V100 P0-18 (Issue #12): Atmosphere event emission.
    // Update attacking_pressure_streak based on current ball_zone.
    // Zone::attacking_third(side) returns the opposing side's defense zone;
    // Zone::attacking_box(side) returns the opposing side's box zone.
    let is_attacking = match ctx.possession {
        Side::Home => matches!(ctx.ball_zone, Zone::AwayBox | Zone::AwayDefense),
        Side::Away => matches!(ctx.ball_zone, Zone::HomeBox | Zone::HomeDefense),
    };
    if is_attacking {
        ctx.attacking_pressure_streak = ctx.attacking_pressure_streak.saturating_add(1);
    } else {
        ctx.attacking_pressure_streak = 0;
    }

    // QuietMinute: 5+ minutes since the last shot. Skip the first 10 minutes
    // of the match (early quietness is normal) and the last 5 (late drama).
    if minute > 10 && minute < 85 && minute.saturating_sub(ctx.last_shot_minute) >= 5 {
        // Only emit once per quiet period (avoid spamming every minute).
        let already_emitted_quiet = ctx.events.iter().rev().take(10).any(|e| {
            e.event_type == EventType::QuietMinute
                && minute.saturating_sub(e.minute) < 5
        });
        if !already_emitted_quiet {
            ctx.emit(MatchEvent::new(minute, EventType::QuietMinute, ctx.possession, Zone::Midfield));
        }
    }

    // SustainedPressure: ball has been in the attacking third for 3+ minutes
    // for the current possession side.
    if ctx.attacking_pressure_streak >= 3 {
        let already_emitted_pressure = ctx.events.iter().rev().take(10).any(|e| {
            e.event_type == EventType::SustainedPressure
                && minute.saturating_sub(e.minute) < 5
        });
        if !already_emitted_pressure {
            ctx.emit(MatchEvent::new(
                minute,
                EventType::SustainedPressure,
                ctx.possession,
                Zone::attacking_box(ctx.possession),
            ));
        }
    }

    // MomentumShift: 3+ possession flips in the last 5 minutes (game opening up).
    if ctx.recent_possession_flips >= 3 && minute > 10 && minute < 88 {
        let already_emitted_momentum = ctx.events.iter().rev().take(10).any(|e| {
            e.event_type == EventType::MomentumShift
                && minute.saturating_sub(e.minute) < 5
        });
        if !already_emitted_momentum {
            ctx.emit(MatchEvent::new(minute, EventType::MomentumShift, ctx.possession, Zone::Midfield));
        }
        // Decay the flip counter so we don't re-emit every minute.
        ctx.recent_possession_flips = ctx.recent_possession_flips.saturating_sub(1);
    }
}
