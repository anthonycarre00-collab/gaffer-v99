//! V100 Season simulation report.
//!
//! Drives a full Premier League season with the user assigned to one EPL club.
//! Uses the full match engine for the user's own fixtures and sparse sim for
//! the rest (matches the actual gameplay loop).
//!
//! ## Running
//!
//! ```bash
//! cd src-tauri
//! cargo test --test season_sim_report -- --nocapture --ignored
//! ```
//!
//! The test prints a full season report to stdout:
//!   - League winner + top 4 (Champions League spots)
//!   - Bottom 3 (relegated)
//!   - Top 10 players by goals
//!   - Top 10 players by avg match rating (min 10 apps)
//!   - User club summary: final position, W-D-L, goals for/against, finance
//!   - News variety check: # articles, # unique sources
//!   - Transfer activity: # transfers, total spend/income for user club
//!   - Rivalry + partnership activity from the RelationshipGraph
//!
//! Marked `#[ignore]` because it takes ~30-60 seconds to run.

use chrono::{TimeZone, Utc};
use domain::league::FixtureStatus;
use ofm_core::clock::GameClock;
use ofm_core::game::Game;
use ofm_core::generator::{
    WorldGenConfig, clubs::STANDARD_NATIONS, generate_world_data_seeded_with,
    repair_opening_youth_academies,
};
use ofm_core::turn;
use std::collections::HashMap;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn make_epl_game(seed: u64) -> Game {
    // Single-nation England, 20 clubs in the top division (matches real EPL).
    let config = WorldGenConfig {
        clubs_per_division: 20,
        nations: vec![STANDARD_NATIONS[0].clone()],
    };
    let world = generate_world_data_seeded_with(seed, &config, None);

    let start = Utc.with_ymd_and_hms(2026, 7, 1, 0, 0, 0).unwrap();
    let clock = GameClock::new(start);

    // Pick the strongest English club as the user's team.
    let user_team = world
        .teams
        .iter()
        .max_by_key(|t| t.reputation)
        .expect("world must have teams")
        .clone();

    let mut manager = domain::manager::Manager::new(
        "season-sim-mgr".to_string(),
        "Season".to_string(),
        "Sim".to_string(),
        "1980-01-01".to_string(),
        "England".to_string(),
    );
    manager.hire(user_team.id.clone());

    let team_ids: Vec<String> = world.teams.iter().map(|t| t.id.clone()).collect();

    let mut game = Game::new(
        clock,
        manager,
        world.teams,
        world.players,
        world.staff,
        vec![],
    );

    game.available_staff_market_last_activity_date = Some(start.format("%Y-%m-%d").to_string());
    repair_opening_youth_academies(&mut game);

    game.league = Some(ofm_core::schedule::generate_league(
        "Premier League",
        2026,
        &team_ids,
        start,
    ));

    ofm_core::season_context::refresh_game_context(&mut game);

    game
}

/// Advance the game one day at a time until the league season is complete
/// or we hit the day cap.
fn play_full_season(game: &mut Game, max_days: usize) {
    for day in 0..max_days {
        if let Some(league) = &game.league {
            let all_done = league
                .fixtures
                .iter()
                .all(|f| f.status == FixtureStatus::Completed);
            if all_done {
                eprintln!("  [day {day}] all fixtures complete");
                return;
            }
        }
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            turn::process_day(game);
        }));
        if day > 0 && day % 50 == 0 {
            let played: u32 = game
                .league
                .as_ref()
                .map(|l| l.standings.iter().map(|r| r.played).sum())
                .unwrap_or(0);
            eprintln!("  [day {day}] fixtures played so far: {played}");
        }
    }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

#[test]
#[ignore]
fn full_epl_season_report() {
    eprintln!("\n=== V100 FULL EPL SEASON SIMULATION ===\n");
    eprintln!("Building world (single-nation England, 20 clubs, seed=42)...");
    let mut game = make_epl_game(42);

    let user_team_id = game.manager.team_id.clone().unwrap_or_default();
    let user_team = game
        .teams
        .iter()
        .find(|t| t.id == user_team_id)
        .expect("user team should exist");
    eprintln!(
        "User club: {} (reputation {})",
        user_team.name, user_team.reputation,
    );
    eprintln!("Simulating season (up to 365 days)...\n");

    play_full_season(&mut game, 365);

    // ─── League table ────────────────────────────────────────────────────
    let league = game.league.as_ref().expect("league should exist");
    let mut standings = league.standings.clone();
    standings.sort_by(|a, b| {
        b.points
            .cmp(&a.points)
            .then(b.goal_difference.cmp(&a.goal_difference))
            .then(b.goals_for.cmp(&a.goals_for))
    });

    eprintln!("\n=== LEAGUE TABLE (final) ===");
    eprintln!(
        "{:<4} {:<30} {:>3} {:>3} {:>3} {:>3} {:>4} {:>4} {:>3}",
        "Pos", "Club", "P", "W", "D", "L", "GF", "GA", "Pts"
    );
    for (i, row) in standings.iter().enumerate() {
        let team_name = game
            .teams
            .iter()
            .find(|t| t.id == row.team_id)
            .map(|t| t.name.as_str())
            .unwrap_or("?");
        let marker = if row.team_id == user_team_id { " *" } else { "  " };
        eprintln!(
            "{}{:<2}. {:<30} {:>3} {:>3} {:>3} {:>3} {:>4} {:>4} {:>3}",
            marker,
            i + 1,
            team_name,
            row.played,
            row.won,
            row.drawn,
            row.lost,
            row.goals_for,
            row.goals_against,
            row.points
        );
    }

    let champion = &standings[0];
    let champ_name = game
        .teams
        .iter()
        .find(|t| t.id == champion.team_id)
        .map(|t| t.name.as_str())
        .unwrap_or("?");
    eprintln!(
        "\nCHAMPION: {} ({} pts, {}-{}-{}, GF {} GA {})",
        champ_name,
        champion.points,
        champion.won,
        champion.drawn,
        champion.lost,
        champion.goals_for,
        champion.goals_against
    );

    eprintln!(
        "Top 4 (UCL): {}",
        standings
            .iter()
            .take(4)
            .map(|r| game
                .teams
                .iter()
                .find(|t| t.id == r.team_id)
                .map(|t| t.name.as_str())
                .unwrap_or("?"))
            .collect::<Vec<_>>()
            .join(", ")
    );

    eprintln!(
        "Bottom 3 (relegated): {}",
        standings
            .iter()
            .rev()
            .take(3)
            .map(|r| game
                .teams
                .iter()
                .find(|t| t.id == r.team_id)
                .map(|t| t.name.as_str())
                .unwrap_or("?"))
            .collect::<Vec<_>>()
            .join(", ")
    );

    // ─── User club summary ──────────────────────────────────────────────
    if let Some(idx) = standings.iter().position(|r| r.team_id == user_team_id) {
        let row = &standings[idx];
        let team = game.teams.iter().find(|t| t.id == user_team_id).unwrap();
        eprintln!("\n=== USER CLUB SUMMARY ===");
        eprintln!("Final position: {} of {}", idx + 1, standings.len());
        eprintln!(
            "Record: {}-{}-{} (GF {} GA {} GD {:+})",
            row.won, row.drawn, row.lost, row.goals_for, row.goals_against, row.goal_difference
        );
        eprintln!("Points: {}", row.points);
        eprintln!("Finance: £{:>10} (balance)", team.finance);
        eprintln!("Reputation: {}", team.reputation);
    }

    // ─── Top players by goals ───────────────────────────────────────────
    eprintln!("\n=== TOP PLAYERS BY GOALS ===");
    let mut player_goals: Vec<(&domain::player::Player, u32)> = game
        .players
        .iter()
        .filter_map(|p| {
            if p.stats.goals == 0 {
                return None;
            }
            Some((p, p.stats.goals))
        })
        .collect();
    player_goals.sort_by(|a, b| b.1.cmp(&a.1));
    for (i, (p, goals)) in player_goals.iter().take(10).enumerate() {
        let team_name = p
            .team_id
            .as_ref()
            .and_then(|tid| game.teams.iter().find(|t| &t.id == tid))
            .map(|t| t.name.as_str())
            .unwrap_or("?");
        eprintln!(
            "{:>2}. {:<25} {:<20} {} goals (OVR {}, {} apps)",
            i + 1,
            p.match_name,
            team_name,
            goals,
            p.ovr,
            p.stats.appearances,
        );
    }

    eprintln!("\n=== TOP PLAYERS BY AVG RATING (min 10 apps) ===");
    let mut player_ratings: Vec<(&domain::player::Player, f32, u32)> = game
        .players
        .iter()
        .filter_map(|p| {
            if p.stats.appearances < 10 {
                return None;
            }
            Some((p, p.stats.avg_rating, p.stats.appearances))
        })
        .collect();
    player_ratings.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    for (i, (p, rating, apps)) in player_ratings.iter().take(10).enumerate() {
        let team_name = p
            .team_id
            .as_ref()
            .and_then(|tid| game.teams.iter().find(|t| &t.id == tid))
            .map(|t| t.name.as_str())
            .unwrap_or("?");
        eprintln!(
            "{:>2}. {:<25} {:<20} {:.2} ({} apps, {} goals)",
            i + 1,
            p.match_name,
            team_name,
            rating,
            apps,
            p.stats.goals
        );
    }

    // ─── Finances ───────────────────────────────────────────────────────
    eprintln!("\n=== FINANCES (top 5 richest, bottom 5 poorest) ===");
    let mut teams_by_finance = game.teams.clone();
    teams_by_finance.sort_by(|a, b| b.finance.cmp(&a.finance));
    for (i, t) in teams_by_finance.iter().take(5).enumerate() {
        eprintln!("  {:>2}. {:<30} £{:>12}", i + 1, t.name, t.finance);
    }
    eprintln!("  ...");
    for (i, t) in teams_by_finance.iter().rev().take(5).enumerate() {
        eprintln!(
            "  {:>2}. {:<30} £{:>12}",
            teams_by_finance.len() - i,
            t.name,
            t.finance
        );
    }

    // ─── News variety ───────────────────────────────────────────────────
    eprintln!("\n=== NEWS VARIETY ===");
    let total_articles = game.news.len();
    let mut by_source: HashMap<String, u32> = HashMap::new();
    let mut by_category: HashMap<String, u32> = HashMap::new();
    for article in &game.news {
        *by_source.entry(article.source.clone()).or_insert(0) += 1;
        *by_category
            .entry(format!("{:?}", article.category))
            .or_insert(0) += 1;
    }
    eprintln!("Total articles this season: {}", total_articles);
    eprintln!(
        "Unique sources: {} ({})",
        by_source.len(),
        by_source
            .iter()
            .map(|(s, c)| format!("{s}={c}"))
            .collect::<Vec<_>>()
            .join(", ")
    );
    eprintln!(
        "Categories: {}",
        by_category
            .iter()
            .map(|(c, n)| format!("{c}={n}"))
            .collect::<Vec<_>>()
            .join(", ")
    );

    // ─── Transfers ──────────────────────────────────────────────────────
    eprintln!("\n=== TRANSFERS ===");
    let total_transfers = league.transfer_log.len();
    eprintln!("Total transfers this season: {}", total_transfers);

    let mut user_spend: u64 = 0;
    let mut user_income: u64 = 0;
    let mut user_in: u32 = 0;
    let mut user_out: u32 = 0;
    for transfer in &league.transfer_log {
        if transfer.to_team_id == user_team_id {
            user_spend += transfer.fee;
            user_in += 1;
        } else if transfer.from_team_id == user_team_id {
            user_income += transfer.fee;
            user_out += 1;
        }
    }
    let net = user_income as i64 - user_spend as i64;
    eprintln!(
        "User club: {} in / {} out, spent £{}, received £{}, net {:+}",
        user_in, user_out, user_spend, user_income, net
    );

    // ─── Rivalries & partnerships ───────────────────────────────────────
    eprintln!("\n=== RIVALRIES & PARTNERSHIPS ===");
    let mut rivalry_count = 0;
    let mut partnership_count = 0;
    let mut rivalry_tags: HashMap<String, u32> = HashMap::new();
    for (_key, edge) in game.relationship_graph.all_edges() {
        if edge.rivalry_flag {
            rivalry_count += 1;
            for tag in &edge.narrative_tags {
                *rivalry_tags.entry(tag.clone()).or_insert(0) += 1;
            }
        }
        if edge.narrative_tags.iter().any(|t| t == "Partnership") {
            partnership_count += 1;
        }
    }
    eprintln!("Cross-team rivalries formed: {}", rivalry_count);
    eprintln!(
        "Rivalry trigger breakdown: {}",
        rivalry_tags
            .iter()
            .map(|(t, c)| format!("{t}={c}"))
            .collect::<Vec<_>>()
            .join(", ")
    );
    eprintln!("Teammate partnerships formed: {}", partnership_count);

    // ─── Sanity checks ──────────────────────────────────────────────────
    eprintln!("\n=== SANITY CHECKS ===");
    let total_games: u32 = standings.iter().map(|r| r.played).sum::<u32>() / 2;
    eprintln!("Total matches played: {}", total_games);
    let total_goals: u32 = standings.iter().map(|r| r.goals_for).sum::<u32>();
    eprintln!(
        "Total goals scored: {} (avg {:.2}/match)",
        total_goals,
        total_goals as f64 / total_games.max(1) as f64
    );
    let avg_gd: f64 = standings
        .iter()
        .map(|r| (r.goals_for as f64 - r.goals_against as f64).abs())
        .sum::<f64>()
        / standings.len() as f64;
    eprintln!("Avg |GD| per team: {:.2}", avg_gd);

    eprintln!("\n=== END OF SEASON REPORT ===\n");
}
