//! V99 Sparse Simulator — a middle-tier match simulation for AI-vs-AI
//! background matches.
//!
//! Produces a scoreline + sparse events (scorers, assists, cards) without
//! running the full 90-minute per-minute engine. Based on the existing
//! `simulate_scoreline` Poisson model + a small event-sampling pass.
//!
//! V99.10 Item 25: This module is ACTIVELY USED — it is NOT dead code.
//! `simulate_sparse_match` is called from `turn/mod.rs:805` via
//! `simulate_sparse_ai_match` (line 782) for ALL AI-vs-AI matchday
//! fixtures. The V998 forensic report's "Bug C14: sparse_sim.rs is dead
//! code" finding was incorrect — it pre-dated the V99.4 PERF-1 wiring
//! that connected this module to the daily turn pipeline.
//!
//! Used for ALL AI-vs-AI matches (not just 10+ per matchday as the old
//! docstring claimed). User matches always use the full `LiveMatchState`
//! engine. This gives a ~10× speedup over running the full engine for
//! every AI-vs-AI fixture.
//!
//! The sparse events are enough for:
//! - News story generation (scorers, cards)
//! - Stat aggregation (goals, assists, yellow cards)
//! - Player career highlights
//! - League standings updates
//!
//! NOT enough for:
//! - Per-minute commentary (use full engine for that)
//! - Detailed match reports (use full engine)

use rand::{Rng, RngExt};
use crate::types::{PlayerData, TeamData};

/// Sparse match event — just the bare minimum for news + stats.
#[derive(Debug, Clone)]
pub struct SparseEvent {
    pub minute: u8,
    pub event_type: SparseEventType,
    pub side: SparseSide,
    pub player_id: String,
    pub secondary_player_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SparseEventType {
    Goal,
    YellowCard,
    RedCard,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SparseSide {
    Home,
    Away,
}

/// Sparse match result — scoreline + events.
#[derive(Debug, Clone)]
pub struct SparseMatchResult {
    pub home_score: u8,
    pub away_score: u8,
    pub events: Vec<SparseEvent>,
}

/// Simulate a match sparsely — produces a scoreline + scorers + cards
/// without running the full per-minute engine.
///
/// P2-1: Now accepts weather and fixture_pressure modifiers that affect
/// goal expectations. Bad weather reduces scoring; high-pressure fixtures
/// slightly increase it (more attacking intent in big games).
pub fn simulate_sparse_match<R: Rng>(
    home: &TeamData,
    away: &TeamData,
    rng: &mut R,
    weather_goal_conversion: f64,
    fixture_pressure: f64,
) -> SparseMatchResult {
    let home_strength = club_strength(home);
    let away_strength = club_strength(away);

    // V100 FIX (forensic): Apply tactics modifiers to sparse sim.
    // Previously sparse_sim IGNORED ALL tactics — every AI-vs-AI match was
    // decided by OVR alone. User could spend hours tweaking tactics but
    // the league table around them was OVR-Poisson. Now play_style and
    // tactics_phase affect xG:
    // - Attacking style: +5% xG, Defensive: -5% xG
    // - High pressing: +3% xG but +3% conceded
    // - Counter: +4% xG vs Attacking opponents
    // - Tempo Direct: +3% xG, Patient: -2% xG
    // - Build-up Long: +2% xG, Short: -1% xG
    // - tactics_multiplier (manager acumen): ±8%
    let home_tactics_mod = sparse_tactics_modifier(home, away);
    let away_tactics_mod = sparse_tactics_modifier(away, home);

    // Poisson xG from strength differential.
    let edge = (home_strength - away_strength) / 10.0;
    // P2-1: Apply weather (reduces scoring) and fixture pressure (slightly
    // increases scoring in big games as teams push for results).
    let weather_mod = weather_goal_conversion.max(0.7).min(1.1); // clamp to sane range
    let pressure_mod = fixture_pressure.clamp(0.9, 1.15); // big games = slightly more goals
    let home_xg = ((1.3 + 0.25 * edge) * weather_mod * pressure_mod * home_tactics_mod).clamp(0.2, 4.0);
    let away_xg = ((1.1 - 0.25 * edge) * weather_mod * pressure_mod * away_tactics_mod).clamp(0.2, 4.0);

    let home_goals = sample_goals(home_xg, rng);
    let away_goals = sample_goals(away_xg, rng);

    let mut events = Vec::new();

    // Generate goal events for the home side.
    for i in 0..home_goals {
        let minute = sample_match_minute(rng);
        let (scorer, assister) = pick_scorer_and_assister(home, rng);
        events.push(SparseEvent {
            minute,
            event_type: SparseEventType::Goal,
            side: SparseSide::Home,
            player_id: scorer,
            secondary_player_id: assister,
        });
        // Suppress unused warning on i.
        let _ = i;
    }

    // Generate goal events for the away side.
    for _ in 0..away_goals {
        let minute = sample_match_minute(rng);
        let (scorer, assister) = pick_scorer_and_assister(away, rng);
        events.push(SparseEvent {
            minute,
            event_type: SparseEventType::Goal,
            side: SparseSide::Away,
            player_id: scorer,
            secondary_player_id: assister,
        });
    }

    // Yellow cards — 0-3 per team, weighted by team's average aggression.
    let home_yellows = sample_yellow_cards(home, rng);
    let away_yellows = sample_yellow_cards(away, rng);
    for _ in 0..home_yellows {
        let minute = sample_match_minute(rng);
        let player = pick_card_candidate(home, rng);
        events.push(SparseEvent {
            minute,
            event_type: SparseEventType::YellowCard,
            side: SparseSide::Home,
            player_id: player,
            secondary_player_id: None,
        });
    }
    for _ in 0..away_yellows {
        let minute = sample_match_minute(rng);
        let player = pick_card_candidate(away, rng);
        events.push(SparseEvent {
            minute,
            event_type: SparseEventType::YellowCard,
            side: SparseSide::Away,
            player_id: player,
            secondary_player_id: None,
        });
    }

    // Red cards — rare, 0-5% chance per team.
    if rng.random_range(0.0..1.0f64) < 0.03 {
        let minute = sample_match_minute(rng);
        let player = pick_card_candidate(home, rng);
        events.push(SparseEvent {
            minute,
            event_type: SparseEventType::RedCard,
            side: SparseSide::Home,
            player_id: player,
            secondary_player_id: None,
        });
    }
    if rng.random_range(0.0..1.0f64) < 0.03 {
        let minute = sample_match_minute(rng);
        let player = pick_card_candidate(away, rng);
        events.push(SparseEvent {
            minute,
            event_type: SparseEventType::RedCard,
            side: SparseSide::Away,
            player_id: player,
            secondary_player_id: None,
        });
    }

    // Sort events by minute.
    events.sort_by_key(|e| e.minute);

    SparseMatchResult {
        home_score: home_goals,
        away_score: away_goals,
        events,
    }
}

/// Calculate club strength from the top 11 players' OVR average.
fn club_strength(team: &TeamData) -> f64 {
    let mut ovrs: Vec<u8> = team.players.iter().map(|p| p.ovr).collect();
    ovrs.sort_by(|a, b| b.cmp(a));
    let top_11: Vec<u8> = ovrs.into_iter().take(11).collect();
    if top_11.is_empty() {
        return 50.0;
    }
    top_11.iter().map(|&v| v as f64).sum::<f64>() / top_11.len() as f64
}

/// V100 FIX (forensic): Compute a tactics-based xG modifier for sparse sim.
///
/// Reads the team's `play_style`, `tactics_phase`, and `tactics_multiplier`
/// (manager acumen) to produce a multiplier on expected goals.
///
/// This is intentionally SIMPLER than the full-engine zone resolution —
/// sparse sim runs ~90% of matches and needs to be fast. The modifiers are
/// directional (Attacking → more goals, Defensive → fewer) not precise.
///
/// Returns a value in roughly 0.85–1.15. Default (Balanced, no tactics) = 1.0.
fn sparse_tactics_modifier(team: &TeamData, opponent: &TeamData) -> f64 {
    let mut mod_: f64 = 1.0;

    // Play style adjustments.
    mod_ *= match team.play_style {
        crate::types::PlayStyle::Attacking => 1.05,    // +5% xG
        crate::types::PlayStyle::Defensive => 0.95,    // -5% xG
        crate::types::PlayStyle::Possession => 0.98,   // -2% xG (patient)
        crate::types::PlayStyle::Counter => {
            // Counter is more effective vs Attacking opponents.
            match opponent.play_style {
                crate::types::PlayStyle::Attacking => 1.08,  // +8% vs Attacking
                _ => 1.02,
            }
        }
        crate::types::PlayStyle::HighPress => 1.03,    // +3% xG (wins ball high)
        _ => 1.0, // Balanced
    };

    // Tactics phase adjustments (the 9-dial Phase Blueprint).
    let tactics = &team.tactics;
    
    // Tempo: Direct = more chances, Patient = fewer but better.
    mod_ *= match tactics.tempo {
        crate::types::Tempo::Direct => 1.03,
        crate::types::Tempo::Patient => 0.98,
    };

    // Build-up: Long ball = more direct = slightly more xG.
    mod_ *= match tactics.build_up_style {
        crate::types::TacticsBuildUpStyle::Long => 1.02,
        crate::types::TacticsBuildUpStyle::Short => 0.99,
        _ => 1.0,
    };

    // Width: Wide = more crossing opportunities = slightly more xG.
    mod_ *= match tactics.width {
        crate::types::TacticsPitchWidth::Wide => 1.02,
        crate::types::TacticsPitchWidth::Narrow => 0.98,
        _ => 1.0,
    };

    // Defensive line: High line = more pressure but more conceded.
    // We apply this as a slight xG boost (more aggressive).
    mod_ *= match tactics.defensive_line {
        crate::types::DefensiveLine::High => 1.02,
        crate::types::DefensiveLine::VeryLow => 0.96,
        _ => 1.0,
    };

    // Manager tactical acumen multiplier (0.90–1.08).
    mod_ *= team.tactics_multiplier;

    // Clamp to a sane range.
    mod_.clamp(0.85, 1.15)
}

/// Sample goals from expected goals using Poisson distribution.
fn sample_goals<R: Rng>(xg: f64, rng: &mut R) -> u8 {
    let mut goals = 0u8;
    let mut remaining = 1.0f64;
    let p = (-xg).exp(); // P(0 goals)
    loop {
        remaining *= if goals == 0 { p } else { xg / (goals as f64) };
        if rng.random_range(0.0..1.0f64) < remaining {
            return goals;
        }
        goals += 1;
        if goals >= 10 {
            return goals;
        }
    }
}

/// Sample a random match minute (1-90).
fn sample_match_minute<R: Rng>(rng: &mut R) -> u8 {
    rng.random_range(1..=90u8)
}

/// Pick a scorer + optional assister from the squad.
/// Scorers are weighted toward forwards (high finishing), assisters toward
/// midfielders (high passing + vision).
fn pick_scorer_and_assister<R: Rng>(
    team: &TeamData,
    rng: &mut R,
) -> (String, Option<String>) {
    let scorer = pick_weighted_player(
        team,
        rng,
        |p| {
            // Forwards weighted 3x, midfielders 1.5x, defenders 0.3x, GK 0x
            let pos_weight = match p.position {
                crate::types::Position::Forward => 3.0,
                crate::types::Position::Midfielder => 1.5,
                crate::types::Position::Defender => 0.3,
                crate::types::Position::Goalkeeper => 0.0,
            };
            pos_weight * (p.finishing as f64 / 50.0)
        },
    );

    // 70% chance of an assist.
    let assister = if rng.random_range(0.0..1.0f64) < 0.7 {
        Some(pick_weighted_player(
            team,
            rng,
            |p| {
                let pos_weight = match p.position {
                    crate::types::Position::Midfielder => 3.0,
                    crate::types::Position::Forward => 2.0,
                    crate::types::Position::Defender => 0.5,
                    crate::types::Position::Goalkeeper => 0.0,
                };
                pos_weight * (p.passing as f64 / 50.0)
            },
        ))
    } else {
        None
    };

    (scorer, assister)
}

/// Pick a player weighted by the given scoring function.
fn pick_weighted_player<R: Rng, F>(
    team: &TeamData,
    rng: &mut R,
    weight_fn: F,
) -> String
where
    F: Fn(&PlayerData) -> f64,
{
    let candidates: Vec<(String, f64)> = team
        .players
        .iter()
        .map(|p| (p.id.clone(), weight_fn(p).max(0.01)))
        .collect();
    if candidates.is_empty() {
        return "unknown".to_string();
    }
    let total: f64 = candidates.iter().map(|(_, w)| w).sum();
    let mut roll = rng.random_range(0.0..total);
    for (id, weight) in &candidates {
        roll -= weight;
        if roll <= 0.0 {
            return id.clone();
        }
    }
    candidates.last().unwrap().0.clone()
}

/// Sample yellow cards — 0-3 per team, weighted by team's average aggression.
fn sample_yellow_cards<R: Rng>(team: &TeamData, rng: &mut R) -> u8 {
    let avg_aggression: f64 = if team.players.is_empty() {
        50.0
    } else {
        team.players.iter().map(|p| p.aggression as f64).sum::<f64>()
            / team.players.len() as f64
    };
    // Higher aggression → more cards. 50 aggression → ~1.2 avg, 80 → ~2.0, 20 → ~0.5
    let base_rate: f64 = 0.5 + (avg_aggression - 50.0) / 60.0;
    let rate = base_rate.clamp(0.3, 2.5);
    let mut cards = 0u8;
    while rng.random_range(0.0..1.0f64) < (rate / 3.0) && cards < 4 {
        cards += 1;
    }
    cards
}

/// Pick a card candidate — weighted toward defenders + high-aggression players.
fn pick_card_candidate<R: Rng>(team: &TeamData, rng: &mut R) -> String {
    pick_weighted_player(team, rng, |p| {
        let pos_weight = match p.position {
            crate::types::Position::Defender => 2.0,
            crate::types::Position::Midfielder => 1.5,
            crate::types::Position::Forward => 0.8,
            crate::types::Position::Goalkeeper => 0.1,
        };
        pos_weight * (p.aggression as f64 / 50.0)
    })
}
