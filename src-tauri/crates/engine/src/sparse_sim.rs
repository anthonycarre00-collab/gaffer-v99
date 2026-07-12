//! V99 Sparse Simulator — a middle-tier match simulation for AI-vs-AI
//! background matches.
//!
//! Produces a scoreline + sparse events (scorers, assists, cards) without
//! running the full 90-minute per-minute engine. Based on the existing
//! `simulate_scoreline` Poisson model + a small event-sampling pass.
//!
//! Used for in-scope AI-vs-AI matches when there are many fixtures on a
//! matchday (10+). User matches always use the full `LiveMatchState` engine.
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
use rand::Rng;

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
pub fn simulate_sparse_match<R: Rng>(
    home: &TeamData,
    away: &TeamData,
    rng: &mut R,
) -> SparseMatchResult {
    let home_strength = club_strength(home);
    let away_strength = club_strength(away);

    // Poisson xG from strength differential.
    let edge = (home_strength - away_strength) / 10.0;
    let home_xg = (1.3 + 0.25 * edge).clamp(0.2, 4.0);
    let away_xg = (1.1 - 0.25 * edge).clamp(0.2, 4.0);

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
