use crate::game::Game;
use crate::messages;
use chrono::Datelike;
use domain::league::{
    CompactMatchEvent, CompactMatchReport, CompactTeamMatchStats, FixtureStatus, GoalEvent,
    MatchResult,
};
use domain::player::{
    PlayerIssue, PlayerIssueCategory, PlayerPromiseKind, Position as DomainPosition,
};
use domain::stats::{PlayerMatchStatsRecord, StatsState, TeamMatchStatsRecord};

fn compact_team_stats(stats: &engine::TeamStats, possession_pct: u8) -> CompactTeamMatchStats {
    CompactTeamMatchStats {
        possession_pct,
        shots: stats.shots,
        shots_on_target: stats.shots_on_target,
        fouls: stats.fouls,
        corners: stats.corners,
        yellow_cards: stats.yellow_cards,
        red_cards: stats.red_cards,
    }
}

fn compact_match_report(report: &engine::MatchReport) -> CompactMatchReport {
    let home_possession_pct = report.home_possession.round().clamp(0.0, 100.0) as u8;
    let away_possession_pct = (100.0 - report.home_possession).round().clamp(0.0, 100.0) as u8;

    let events = report
        .events
        .iter()
        .filter(|event| {
            matches!(
                event.event_type,
                engine::EventType::Goal
                    | engine::EventType::PenaltyGoal
                    | engine::EventType::PenaltyMiss
                    | engine::EventType::YellowCard
                    | engine::EventType::RedCard
                    | engine::EventType::SecondYellow
                    | engine::EventType::Injury
                    | engine::EventType::Substitution
            )
        })
        .map(|event| CompactMatchEvent {
            minute: event.minute,
            event_type: format!("{:?}", event.event_type),
            side: format!("{:?}", event.side),
            player_id: event.player_id.clone(),
            secondary_player_id: event.secondary_player_id.clone(),
        })
        .collect();

    CompactMatchReport {
        total_minutes: report.total_minutes,
        home_stats: compact_team_stats(&report.home_stats, home_possession_pct),
        away_stats: compact_team_stats(&report.away_stats, away_possession_pct),
        events,
    }
}

/// Apply a completed match report to the game state: update fixture, standings,
/// player stats, stamina, and generate messages. Public so Tauri can call it
/// after a live match finishes.
pub fn apply_match_report(
    game: &mut Game,
    fixture_index: usize,
    home_team_id: &str,
    away_team_id: &str,
    report: &engine::MatchReport,
) {
    apply_match_report_with_capture(
        game,
        fixture_index,
        home_team_id,
        away_team_id,
        report,
        &mut |_| {},
    );
}

pub fn apply_match_report_with_capture<F>(
    game: &mut Game,
    fixture_index: usize,
    home_team_id: &str,
    away_team_id: &str,
    report: &engine::MatchReport,
    on_capture: &mut F,
) where
    F: FnMut(StatsState),
{
    // Convert engine GoalDetails → domain GoalEvents
    let home_scorers: Vec<GoalEvent> = report
        .goals
        .iter()
        .filter(|g| g.side == engine::Side::Home)
        .map(|g| GoalEvent {
            player_id: g.scorer_id.clone(),
            minute: g.minute,
        })
        .collect();
    let away_scorers: Vec<GoalEvent> = report
        .goals
        .iter()
        .filter(|g| g.side == engine::Side::Away)
        .map(|g| GoalEvent {
            player_id: g.scorer_id.clone(),
            minute: g.minute,
        })
        .collect();

    let result = MatchResult {
        home_goals: report.home_goals,
        away_goals: report.away_goals,
        home_scorers,
        away_scorers,
        report: Some(compact_match_report(report)),
        home_penalties: report.home_penalties,
        away_penalties: report.away_penalties,
    };

    // V100 P1 (Issue #24/#33): Update manager head-to-head records.
    // Find the managers of both teams and update their H2H maps.
    // Skip if either team has no manager (e.g. international sides).
    let home_manager_id: Option<String> = game
        .teams
        .iter()
        .find(|t| t.id == home_team_id)
        .and_then(|t| t.manager_id.clone());
    let away_manager_id: Option<String> = game
        .teams
        .iter()
        .find(|t| t.id == away_team_id)
        .and_then(|t| t.manager_id.clone());

    if let (Some(home_mgr), Some(away_mgr)) = (&home_manager_id, &away_manager_id) {
        if home_mgr != away_mgr {
            // Don't record H2H for a manager vs themselves (e.g. friendly
            // between two of their teams — shouldn't happen but defensive).
            let today = game.clock.current_date.format("%Y-%m-%d").to_string();
            let home_won = report.home_goals > report.away_goals;
            let away_won = report.away_goals > report.home_goals;
            let draw = report.home_goals == report.away_goals;

            // Update home manager's H2H vs away manager.
            if let Some(home_manager) = game.managers.iter_mut().find(|m| &m.id == home_mgr) {
                let h2h = home_manager.head_to_head.entry(away_mgr.clone()).or_default();
                if home_won { h2h.wins += 1; }
                else if draw { h2h.draws += 1; }
                else { h2h.losses += 1; }
                h2h.goals_for += report.home_goals as u32;
                h2h.goals_against += report.away_goals as u32;
                h2h.last_meeting_date = Some(today.clone());
            }
            // Update away manager's H2H vs home manager (mirror image).
            if let Some(away_manager) = game.managers.iter_mut().find(|m| &m.id == away_mgr) {
                let h2h = away_manager.head_to_head.entry(home_mgr.clone()).or_default();
                if away_won { h2h.wins += 1; }
                else if draw { h2h.draws += 1; }
                else { h2h.losses += 1; }
                h2h.goals_for += report.away_goals as u32;
                h2h.goals_against += report.home_goals as u32;
                h2h.last_meeting_date = Some(today);
            }
        }
    }

    let mut counts_for_standings = false;
    let mut generates_match_news = false;

    // Update fixture status, standings
    if let Some(league) = game.league.as_mut() {
        let fixture = &mut league.fixtures[fixture_index];
        fixture.status = FixtureStatus::Completed;
        counts_for_standings = fixture.counts_for_league_standings();
        generates_match_news = fixture.generates_match_report_news();

        if counts_for_standings {
            if let Some(entry) = league
                .standings
                .iter_mut()
                .find(|e| e.team_id == home_team_id)
            {
                entry.record_result(result.home_goals, result.away_goals);
            }
            if let Some(entry) = league
                .standings
                .iter_mut()
                .find(|e| e.team_id == away_team_id)
            {
                entry.record_result(result.away_goals, result.home_goals);
            }
        }

        fixture.result = Some(result.clone());
        crate::group_stage::process_completed_fixture(league, fixture_index);
        crate::schedule::advance_knockout_competition_round(league);

        // V100 FIX (Issue #11): Re-sort standings after match result to ensure
        // league table positions are correct. Previously only the sparse AI sim
        // path sorted standings; the user match path (apply_match_report) did
        // not, which could leave standings in stale order.
        if counts_for_standings {
            league.standings.sort_by(|a, b| {
                b.points.cmp(&a.points)
                    .then_with(|| {
                        let a_gd = a.goals_for.saturating_sub(a.goals_against);
                        let b_gd = b.goals_for.saturating_sub(b.goals_against);
                        b_gd.cmp(&a_gd)
                    })
                    .then_with(|| b.goals_for.cmp(&a.goals_for))
            });
            log::debug!(
                "[post_match] Standings re-sorted after match: {} vs {} ({}-{}), competition={}",
                home_team_id, away_team_id,
                result.home_goals, result.away_goals,
                league.id
            );
        }
    }

    on_capture(build_stats_state_capture(
        game,
        fixture_index,
        home_team_id,
        away_team_id,
        report,
    ));

    // Update player season stats from the engine report
    apply_player_stats(game, report, home_team_id, away_team_id);
    resolve_post_match_promises(game, report, home_team_id, away_team_id);

    // Deplete stamina for players who played, scaled by minutes on pitch
    deplete_match_stamina(game, home_team_id, report);
    deplete_match_stamina(game, away_team_id, report);

    // Update morale based on result and individual performance
    update_post_match_morale(game, report, home_team_id, away_team_id);

    // Update team form (last 5 results)
    if counts_for_standings {
        update_team_form(game, report, home_team_id, away_team_id);
    }

    // Update board satisfaction based on match result
    if counts_for_standings
        && let Some(user_team_id) = &game.manager.team_id
        && (*user_team_id == home_team_id || *user_team_id == away_team_id)
    {
        let user_goals = if *user_team_id == home_team_id {
            report.home_goals
        } else {
            report.away_goals
        };
        let opp_goals = if *user_team_id == home_team_id {
            report.away_goals
        } else {
            report.home_goals
        };
        let sat_delta: i8 = if user_goals > opp_goals {
            2
        }
        // win: +2
        else if user_goals == opp_goals {
            -1
        }
        // draw: -1
        else {
            -3
        }; // loss: -3
        let new_sat = (game.manager.satisfaction as i16 + sat_delta as i16).clamp(0, 100) as u8;
        // V99.10 Item 23: New-manager grace period. For the first 30 days
        // after appointment, satisfaction can't drop below 30 — the board
        // gives a new manager breathing room rather than sacking them on
        // the first bad run. Matches real football convention ("you can't
        // be sacked in your first month"). Without this, a new manager
        // losing their first 5 matches (5×-3 = -15, base 50) drops to 25
        // → immediate warning, and one more loss → sack. The grace floor
        // of 30 is above the WARN_THRESHOLD (25) and below FINAL_WARN (18),
        // so warnings/firings are suppressed during the grace window.
        let grace_floor = if crate::firing::manager_in_grace_period(&game.manager, game.clock.current_date) {
            crate::firing::MANAGER_GRACE_FLOOR
        } else {
            0
        };
        let new_sat = new_sat.max(grace_floor);
        game.manager.satisfaction = new_sat;

        // Fan approval — fans react more emotionally
        let fan_delta: i8 = if user_goals > opp_goals {
            5
        }
        // win: +5
        else if user_goals == opp_goals {
            -2
        }
        // draw: -2
        else {
            -8
        }; // loss: -8
        // Extra bonus for big wins, extra penalty for heavy losses
        let goal_diff = (user_goals as i8) - (opp_goals as i8);
        let fan_bonus: i8 = if goal_diff >= 3 {
            3
        } else if goal_diff <= -3 {
            -3
        } else {
            0
        };
        let new_fan = (game.manager.fan_approval as i16 + fan_delta as i16 + fan_bonus as i16)
            .clamp(0, 100) as u8;
        game.manager.fan_approval = new_fan;
    }

    // Generate match result message for user's team
    if counts_for_standings
        && let Some(user_team_id) = &game.manager.team_id
        && (*user_team_id == home_team_id || *user_team_id == away_team_id)
    {
        let fixture = &game.league.as_ref().unwrap().fixtures[fixture_index];
        let res = fixture.result.as_ref().unwrap();
        let home_name = game
            .teams
            .iter()
            .find(|t| t.id == home_team_id)
            .map(|t| t.name.as_str())
            .unwrap_or("Home");
        let away_name = game
            .teams
            .iter()
            .find(|t| t.id == away_team_id)
            .map(|t| t.name.as_str())
            .unwrap_or("Away");

        let msg = messages::match_result_message(
            &fixture.id,
            home_name,
            away_name,
            res.home_goals,
            res.away_goals,
            home_team_id,
            away_team_id,
            user_team_id,
            fixture.matchday,
            &game.clock.current_date.to_rfc3339(),
        );
        game.messages.push(msg);
    }

    // Generate match report news article
    if generates_match_news {
        super::news::generate_match_news(game, fixture_index, home_team_id, away_team_id, report);
    }
}

fn build_stats_state_capture(
    game: &Game,
    fixture_index: usize,
    home_team_id: &str,
    away_team_id: &str,
    report: &engine::MatchReport,
) -> StatsState {
    let Some(league) = game.league.as_ref() else {
        return StatsState::default();
    };
    let Some(fixture) = league.fixtures.get(fixture_index) else {
        return StatsState::default();
    };

    let home_possession_pct = report.home_possession.round().clamp(0.0, 100.0) as u8;
    let away_possession_pct = (100.0 - report.home_possession).round().clamp(0.0, 100.0) as u8;
    let team_by_player_id: std::collections::HashMap<&str, &str> = game
        .players
        .iter()
        .filter_map(|player| {
            player
                .team_id
                .as_deref()
                .map(|team_id| (player.id.as_str(), team_id))
        })
        .collect();

    let player_matches = report
        .player_stats
        .iter()
        .filter_map(|(player_id, stats)| {
            let team_id = *team_by_player_id.get(player_id.as_str())?;
            if team_id != home_team_id && team_id != away_team_id {
                return None;
            }

            let opponent_team_id = if team_id == home_team_id {
                away_team_id
            } else {
                home_team_id
            };

            Some(PlayerMatchStatsRecord {
                fixture_id: fixture.id.clone(),
                season: league.season,
                matchday: fixture.matchday,
                date: fixture.date.clone(),
                competition: fixture.competition.clone(),
                player_id: player_id.clone(),
                team_id: team_id.to_string(),
                opponent_team_id: opponent_team_id.to_string(),
                home_team_id: home_team_id.to_string(),
                away_team_id: away_team_id.to_string(),
                home_goals: report.home_goals,
                away_goals: report.away_goals,
                minutes_played: stats.minutes_played,
                goals: stats.goals,
                assists: stats.assists,
                shots: stats.shots,
                shots_on_target: stats.shots_on_target,
                passes_completed: stats.passes_completed,
                passes_attempted: stats.passes_attempted,
                tackles_won: stats.tackles_won,
                interceptions: stats.interceptions,
                fouls_committed: stats.fouls_committed,
                yellow_cards: stats.yellow_cards,
                red_cards: stats.red_cards,
                // V100 P0-5 (Issue #38): Persist saves (mostly relevant for GKs).
                saves: stats.saves,
                rating: stats.rating,
            })
        })
        .collect();

    let team_matches = vec![
        TeamMatchStatsRecord {
            fixture_id: fixture.id.clone(),
            season: league.season,
            matchday: fixture.matchday,
            date: fixture.date.clone(),
            competition: fixture.competition.clone(),
            team_id: home_team_id.to_string(),
            opponent_team_id: away_team_id.to_string(),
            home_team_id: home_team_id.to_string(),
            away_team_id: away_team_id.to_string(),
            goals_for: report.home_goals,
            goals_against: report.away_goals,
            possession_pct: home_possession_pct,
            shots: report.home_stats.shots,
            shots_on_target: report.home_stats.shots_on_target,
            passes_completed: report.home_stats.passes_completed,
            passes_attempted: report.home_stats.passes_completed
                + report.home_stats.passes_intercepted,
            tackles_won: report.home_stats.tackles,
            interceptions: report.home_stats.interceptions,
            fouls_committed: report.home_stats.fouls,
            yellow_cards: report.home_stats.yellow_cards,
            red_cards: report.home_stats.red_cards,
        },
        TeamMatchStatsRecord {
            fixture_id: fixture.id.clone(),
            season: league.season,
            matchday: fixture.matchday,
            date: fixture.date.clone(),
            competition: fixture.competition.clone(),
            team_id: away_team_id.to_string(),
            opponent_team_id: home_team_id.to_string(),
            home_team_id: home_team_id.to_string(),
            away_team_id: away_team_id.to_string(),
            goals_for: report.away_goals,
            goals_against: report.home_goals,
            possession_pct: away_possession_pct,
            shots: report.away_stats.shots,
            shots_on_target: report.away_stats.shots_on_target,
            passes_completed: report.away_stats.passes_completed,
            passes_attempted: report.away_stats.passes_completed
                + report.away_stats.passes_intercepted,
            tackles_won: report.away_stats.tackles,
            interceptions: report.away_stats.interceptions,
            fouls_committed: report.away_stats.fouls,
            yellow_cards: report.away_stats.yellow_cards,
            red_cards: report.away_stats.red_cards,
        },
    ];

    StatsState {
        player_matches,
        team_matches,
    }
}

// ---------------------------------------------------------------------------
// Post-match: feed engine report stats back into domain Player models
// ---------------------------------------------------------------------------

fn apply_player_stats(
    game: &mut Game,
    report: &engine::MatchReport,
    home_team_id: &str,
    away_team_id: &str,
) {
    let today = game.clock.current_date.format("%Y-%m-%d").to_string();
    let season = game.clock.current_date.year() as u32;

    // V99.11 A2: Collect milestone news articles to push after the loop
    // (can't push to game.news inside the iter_mut loop due to borrow rules).
    let mut milestone_articles: Vec<domain::news::NewsArticle> = Vec::new();

    for player in game.players.iter_mut() {
        if let Some(ps) = report.player_stats.get(&player.id) {
            // V99.4 T2.1: Track career events before stats are incremented.
            let prev_appearances = player.stats.appearances;
            let prev_goals = player.stats.goals;

            player.stats.appearances += 1;
            player.stats.goals += ps.goals as u32;
            player.stats.assists += ps.assists as u32;
            player.stats.yellow_cards += ps.yellow_cards as u32;
            player.stats.red_cards += ps.red_cards as u32;
            player.stats.minutes_played += ps.minutes_played as u32;
            player.stats.shots += ps.shots as u32;
            player.stats.shots_on_target += ps.shots_on_target as u32;
            player.stats.passes_completed += ps.passes_completed as u32;
            player.stats.passes_attempted += ps.passes_attempted as u32;
            player.stats.tackles_won += ps.tackles_won as u32;
            player.stats.interceptions += ps.interceptions as u32;
            player.stats.fouls_committed += ps.fouls_committed as u32;

            // Update average rating (running average)
            // V99.10 C1: Wire calculate_match_rating for narrative-aware scoring.
            //
            // Previously the engine's `compute_player_ratings` rating was used
            // directly. Now we pass it through `calculate_match_rating` which
            // weights it at 60% performance + 20% narrative + 10% clutch +
            // 10% context. For now, narrative/clutch/context use neutral
            // defaults (5.0) — these can be enhanced later by threading
            // game.memory_store, rivalry data, and late-winner detection.
            // Even with neutral narrative inputs, this produces a more
            // realistic distribution because:
            //   1. The 60% performance weighting smooths extreme ratings
            //   2. The clamp to [1.0, 10.0] is wider than the engine's [3.0, 10.0]
            //   3. The formula matches the design spec (BIBLE_CURATED.md §28)
            let performance_score = ps.rating;
            let narrative_weight = 5.0; // neutral — no story thread lookup yet
            let clutch_factor = 5.0; // neutral — no late-winner detection yet
            let context_difficulty = 5.0; // neutral — no opponent-strength lookup yet
            let narrative_rating = crate::media::calculate_match_rating(
                performance_score,
                narrative_weight,
                clutch_factor,
                context_difficulty,
            );
            if player.stats.appearances == 1 {
                player.stats.avg_rating = narrative_rating;
            } else {
                let n = player.stats.appearances as f32;
                player.stats.avg_rating = (player.stats.avg_rating * (n - 1.0) + narrative_rating) / n;
            }

            // V100 FIX (forensic): Track last 3 match ratings for the Squad
            // "Form" column. Cap at 3 entries — drop oldest.
            player.stats.recent_ratings.push(narrative_rating);
            if player.stats.recent_ratings.len() > 3 {
                player.stats.recent_ratings.remove(0);
            }

            // Clean sheet for goalkeepers
            if matches!(player.position, DomainPosition::Goalkeeper) {
                let tid = player.team_id.as_deref().unwrap_or("");
                let conceded_zero = if tid == home_team_id {
                    report.away_goals == 0
                } else if tid == away_team_id {
                    report.home_goals == 0
                } else {
                    false
                };
                if conceded_zero {
                    player.stats.clean_sheets += 1;
                }
            }

            // V99.4 T2.1: Record career events.
            let team_name = player.team_id.as_deref().and_then(|tid| {
                game.teams.iter().find(|t| t.id == tid).map(|t| t.name.clone())
            });

            // Debut
            if prev_appearances == 0 {
                player.career_events.push(domain::player::CareerEvent {
                    event_type: domain::player::CareerEventType::Debut,
                    season,
                    date: today.clone(),
                    team_id: player.team_id.clone(),
                    team_name: team_name.clone(),
                    description: format!("Made his debut for {}.", team_name.as_deref().unwrap_or("his club")),
                });
            }

            // First goal
            if prev_goals == 0 && player.stats.goals > 0 {
                player.career_events.push(domain::player::CareerEvent {
                    event_type: domain::player::CareerEventType::FirstGoal,
                    season,
                    date: today.clone(),
                    team_id: player.team_id.clone(),
                    team_name: team_name.clone(),
                    description: format!("Scored his first goal for {}.", team_name.as_deref().unwrap_or("his club")),
                });
            }

            // Milestone appearances (50, 100, 250, 500)
            for milestone in [50, 100, 250, 500] {
                if prev_appearances < milestone && player.stats.appearances >= milestone as u32 {
                    player.career_events.push(domain::player::CareerEvent {
                        event_type: domain::player::CareerEventType::MilestoneAppearance,
                        season,
                        date: today.clone(),
                        team_id: player.team_id.clone(),
                        team_name: team_name.clone(),
                        description: format!("Reached {} appearances for {}.", milestone, team_name.as_deref().unwrap_or("his club")),
                    });
                }
            }

            // Milestone goals (25, 50, 100)
            for milestone in [25, 50, 100] {
                if prev_goals < milestone && player.stats.goals >= milestone as u32 {
                    player.career_events.push(domain::player::CareerEvent {
                        event_type: domain::player::CareerEventType::MilestoneGoal,
                        season,
                        date: today.clone(),
                        team_id: player.team_id.clone(),
                        team_name: team_name.clone(),
                        description: format!("Reached {} goals for {}.", milestone, team_name.as_deref().unwrap_or("his club")),
                    });
                    // V99.11 A2: Generate milestone news article.
                    if let (Some(tid), Some(tname)) = (&player.team_id, &team_name) {
                        milestone_articles.push(crate::news::player_milestone_article(
                            &player.id,
                            &player.full_name,
                            tid,
                            tname,
                            "goals",
                            milestone as u32,
                            &today,
                        ));
                    }
                }
            }

            // V99.11 A2: Also generate news for milestone appearances (50, 100, 250).
            for milestone in [50u32, 100, 250] {
                if prev_appearances < milestone && player.stats.appearances >= milestone {
                    if let (Some(tid), Some(tname)) = (&player.team_id, &team_name) {
                        milestone_articles.push(crate::news::player_milestone_article(
                            &player.id,
                            &player.full_name,
                            tid,
                            tname,
                            "appearances",
                            milestone,
                            &today,
                        ));
                    }
                }
            }

            // V99.11 A2: Debut goal — first-ever goal for the club.
            if prev_goals == 0 && player.stats.goals > 0 && prev_appearances == 0 {
                if let (Some(tid), Some(tname)) = (&player.team_id, &team_name) {
                    milestone_articles.push(crate::news::player_milestone_article(
                        &player.id,
                        &player.full_name,
                        tid,
                        tname,
                        "debut_goal",
                        1,
                        &today,
                    ));
                }
            }
        }
    }

    // V99.11 A2: Push milestone news articles (collected during the loop
    // to avoid borrow conflicts with game.players.iter_mut).
    // Dedup: only push if an article with the same ID doesn't already exist.
    for article in milestone_articles {
        if !game.news.iter().any(|n| n.id == article.id) {
            game.news.push(article);
        }
    }

    // V99.4 T2.2: Track goal+assist partnerships.
    // For each goal in the report, if there's a scorer + assister,
    // increment their partnership count.
    let goal_details: Vec<(String, Option<String>)> = report
        .goals
        .iter()
        .map(|g| (g.scorer_id.clone(), g.assist_id.clone()))
        .collect();
    for (scorer_id, assister_id) in &goal_details {
        if let Some(assister_id) = assister_id {
            if scorer_id != assister_id {
                // Increment scorer's partnership with assister.
                if let Some(scorer) = game.players.iter_mut().find(|p| &p.id == scorer_id) {
                    *scorer.partnerships.entry(assister_id.clone()).or_insert(0) += 1;
                }
                // Increment assister's partnership with scorer.
                if let Some(assister) = game.players.iter_mut().find(|p| &p.id == assister_id) {
                    *assister.partnerships.entry(scorer_id.clone()).or_insert(0) += 1;
                }
            }
        }
    }
}

fn resolve_post_match_promises(
    game: &mut Game,
    report: &engine::MatchReport,
    home_team_id: &str,
    away_team_id: &str,
) {
    for player in game.players.iter_mut() {
        let Some(team_id) = player.team_id.as_deref() else {
            continue;
        };
        if team_id != home_team_id && team_id != away_team_id {
            continue;
        }

        let Some(promise) = player.morale_core.pending_promise.clone() else {
            continue;
        };

        let played = report.player_stats.contains_key(&player.id);

        match promise.kind {
            PlayerPromiseKind::PlayingTime => {
                if played {
                    player.morale_core.pending_promise = None;
                    player.morale_core.manager_trust =
                        (i16::from(player.morale_core.manager_trust) + 3).clamp(0, 100) as u8;

                    if player
                        .morale_core
                        .unresolved_issue
                        .as_ref()
                        .is_some_and(|issue| issue.category == PlayerIssueCategory::PlayingTime)
                    {
                        player.morale_core.unresolved_issue = None;
                    }
                } else if promise.matches_remaining <= 1 {
                    player.morale_core.pending_promise = None;
                    player.morale_core.manager_trust =
                        (i16::from(player.morale_core.manager_trust) - 12).clamp(0, 100) as u8;
                    player.morale_core.unresolved_issue = Some(PlayerIssue {
                        category: PlayerIssueCategory::PlayingTime,
                        severity: 75,
                    });
                } else {
                    player.morale_core.pending_promise = Some(domain::player::PlayerPromise {
                        kind: PlayerPromiseKind::PlayingTime,
                        matches_remaining: promise.matches_remaining - 1,
                    });
                }
            }
        }
    }
}

fn capped_positive_recovery(delta: i16, player: &domain::player::Player) -> i16 {
    let Some(issue) = player.morale_core.unresolved_issue.as_ref() else {
        return delta;
    };

    if delta <= 0 {
        return delta;
    }

    if issue.severity >= 75 {
        return 0;
    }

    if issue.severity >= 50 {
        return ((delta + 1) / 2).max(1);
    }

    delta
}

/// Update player morale based on match result and individual performance.
fn update_post_match_morale(
    game: &mut Game,
    report: &engine::MatchReport,
    home_team_id: &str,
    away_team_id: &str,
) {
    use rand::RngExt;
    let mut rng = rand::rng();

    let home_won = report.home_goals > report.away_goals;
    let away_won = report.away_goals > report.home_goals;
    let is_draw = report.home_goals == report.away_goals;

    for player in game.players.iter_mut() {
        let tid = match player.team_id.as_deref() {
            Some(t) if t == home_team_id || t == away_team_id => t.to_string(),
            _ => continue,
        };

        let is_home = tid == home_team_id;
        let base_morale = player.morale as i16;

        // Team result effect — scale loss impact by goal difference
        let goal_diff = (report.home_goals as i16 - report.away_goals as i16).abs();
        let result_delta: i16 = if (is_home && home_won) || (!is_home && away_won) {
            rng.random_range(3..=8) // Win boost
        } else if is_draw {
            rng.random_range(-2..=3) // Draw: mild
        } else {
            // Base loss: -5 to -2, plus extra -3 per goal margin beyond 1
            let base_loss = rng.random_range(-5..=-2);
            let margin_penalty = (goal_diff - 1).max(0) * -3;
            base_loss + margin_penalty // e.g. 3-0 loss → -5..-2 + -6 = -11..-8
        };

        // Individual performance effect
        let mut individual_delta: i16 = 0;
        if let Some(ps) = report.player_stats.get(&player.id) {
            // Goals scored boost morale
            individual_delta += ps.goals as i16 * 3;
            // Assists boost morale
            individual_delta += ps.assists as i16 * 2;
            // Red card tanks morale
            if ps.red_cards > 0 {
                individual_delta -= 8;
                // Gaffer Phase 2 — Personality evolution: sent off triggers neuroticism increase
                // Check if this was a derby/rivalry match for the SentOffInDerby event
                let is_rivalry = game.relationship_graph.get(home_team_id, away_team_id)
                    .map(|e| e.rivalry_flag)
                    .unwrap_or(false);
                let event_type = if is_rivalry {
                    crate::relationships::PersonalityEventType::SentOffInDerby
                } else {
                    // Generic sent-off still increases neuroticism slightly
                    crate::relationships::PersonalityEventType::PublicHumiliation
                };
                let event = crate::relationships::PersonalityEvent {
                    event_type,
                    date: game.clock.current_date.format("%Y-%m-%d").to_string(),
                };
                // Apply personality shift (need to find the player's season_shifts or create one)
                // For now, apply directly — Phase 3 will add proper season tracking
                let (_o, c, _e, _a, n) = event.event_type.deltas();
                player.personality.neuroticism = (player.personality.neuroticism as i16 + n as i16).clamp(0, 100) as u8;
                player.personality.conscientiousness = (player.personality.conscientiousness as i16 + c as i16).clamp(0, 100) as u8;
            }
            // Poor rating lowers morale
            if ps.rating < 5.5 {
                individual_delta -= 3;
            } else if ps.rating > 7.5 {
                individual_delta += 2;
            }

            // Gaffer Phase 2 — Relationship updates: teammates who play together
            // get a small positive boost. This runs at match level (not per-player).
            // Actual relationship updates happen in update_relationships_post_match().
        }

        let total_delta = capped_positive_recovery(result_delta + individual_delta, player);
        let new_morale = (base_morale + total_delta).clamp(10, 100) as u8;
        player.morale = new_morale;
    }

    // Gaffer Phase 2 — Update relationships after match
    update_relationships_post_match(game, report, home_team_id, away_team_id);

    // Gaffer Phase 3 — Process narrative memories
    let player_stats: Vec<(String, u8, u8, u8, f32)> = game
        .players
        .iter()
        .filter_map(|p| {
            if p.team_id.as_deref() == Some(home_team_id) || p.team_id.as_deref() == Some(away_team_id) {
                report.player_stats.get(&p.id).map(|ps| {
                    (p.id.clone(), ps.goals as u8, ps.assists as u8, ps.red_cards as u8, ps.rating)
                })
            } else {
                None
            }
        })
        .collect();

    let is_rivalry = game.relationship_graph.get(home_team_id, away_team_id)
        .map(|e| e.rivalry_flag)
        .unwrap_or(false);

    let date = game.clock.current_date.format("%Y-%m-%d").to_string();
    let mut engine = crate::narrative::NarrativeEngine::new(&mut game.memory_store, &date);
    engine.process_match_result(
        home_team_id,
        away_team_id,
        report.home_goals,
        report.away_goals,
        is_rivalry,
        &player_stats,
    );

    // Gaffer Phase 5 — Process media reactions
    let home_team_name = game.teams.iter().find(|t| t.id == home_team_id).map(|t| t.name.clone()).unwrap_or_default();
    let away_team_name = game.teams.iter().find(|t| t.id == away_team_id).map(|t| t.name.clone()).unwrap_or_default();
    let home_form = game.teams.iter().find(|t| t.id == home_team_id).map(|t| t.form.clone()).unwrap_or_default();
    let away_form = game.teams.iter().find(|t| t.id == away_team_id).map(|t| t.form.clone()).unwrap_or_default();
    let mut rng = rand::rng();
    // Gaffer Phase 5 — Process media reactions (pundits react, disagreement
    // probability rolls, match rating generated). Result stored in media_engine
    // state — read by MediaPulseCard on the Home dashboard.
    let _media_reactions = game.media_engine.process_match(
        &date,
        &home_team_name,
        &away_team_name,
        report.home_goals,
        report.away_goals,
        is_rivalry,
        &mut rng,
    );

    // Gaffer Phase 5 — Generate weekly supplement (headline of the week, etc.)
    // This feeds the MediaPulseCard's "Top Headline" field.
    let home_sentiment = 0.5_f32; // Default neutral sentiment
    let away_sentiment = 0.5_f32;
    game.media_engine.generate_supplements(
        &date,
        &home_team_name,
        &away_team_name,
        &home_form,
        &away_form,
        is_rivalry,
        home_sentiment,
        away_sentiment,
    );

    // Gaffer Phase 5 — Update betting sentiment for both teams
    // Winning team gets +sentiment boost, losing team gets -penalty
    let (home_sent, away_sent) = if report.home_goals > report.away_goals {
        (0.65_f32, 0.35_f32) // Home win
    } else if report.away_goals > report.home_goals {
        (0.35_f32, 0.65_f32) // Away win
    } else {
        (0.50_f32, 0.50_f32) // Draw
    };
    game.media_engine.update_betting_sentiment(home_team_id, home_sent, &date);
    game.media_engine.update_betting_sentiment(away_team_id, away_sent, &date);
}

/// Gaffer Phase 2 — Update player relationships based on match outcome.
///
/// Teammates who win together get +2 strength.
/// Teammates who lose together get -1 strength (shared misery, but bonding).
/// Teammates who draw get +1 (neutral shared experience).
/// Players with high neuroticism + red card may create tension with teammates.
///
/// V100 Issue #30 (rework): Rivalries are now AUTO-TRIGGERED by the engine,
/// NOT manually added by the manager. After a fixture, we scan events for
/// flashpoints — Hard/Reckless fouls, red cards, dribbles tackled, headers
/// won/lost, goals scored against — and roll a small chance per pair to
/// escalate a negative edge between the two opponents. Triggers are rare
/// (1-5% per qualifying event) so most matches produce no rivalries; a
/// bad-tempered derby might produce one. The manager never creates these
/// directly — they emerge from play.
///
/// V100 Issue #30 (rework): Teammate partnerships also form here. For each
/// pair of teammates who both played 60+ minutes, roll a small chance
/// (5% per pair per match, scaled by personality similarity) to bump the
/// relationship +1 to +3. Cap accumulates slowly — a season of playing
/// together typically yields +15 to +25 strength (enough to cross the
/// "chemistry bonus" threshold at +30).
fn update_relationships_post_match(
    game: &mut Game,
    report: &engine::MatchReport,
    home_team_id: &str,
    away_team_id: &str,
) {
    let home_won = report.home_goals > report.away_goals;
    let away_won = report.away_goals > report.home_goals;
    let date = game.clock.current_date.format("%Y-%m-%d").to_string();

    for (team_id, won) in [(home_team_id, home_won), (away_team_id, away_won)] {
        // Get all players on this team
        let team_player_ids: Vec<String> = game
            .players
            .iter()
            .filter(|p| p.team_id.as_deref() == Some(team_id))
            .map(|p| p.id.clone())
            .collect();

        if team_player_ids.len() < 2 {
            continue;
        }

        // Determine relationship delta based on result
        let delta: i8 = if won {
            2 // Winning together bonds teammates
        } else if report.home_goals == report.away_goals {
            1 // Drawing is neutral-positive
        } else {
            -1 // Losing together is slightly negative but also bonds (shared misery)
        };

        // Update all intra-team relationships
        for i in 0..team_player_ids.len() {
            for j in (i + 1)..team_player_ids.len() {
                game.relationship_graph
                    .modify_strength(&team_player_ids[i], &team_player_ids[j], delta);
            }
        }

        // Check for red cards — player with red card may create tension
        for player_id in &team_player_ids {
            if let Some(ps) = report.player_stats.get(player_id) {
                if ps.red_cards > 0 {
                    // Red card player loses relationship strength with all teammates
                    for other_id in &team_player_ids {
                        if other_id != player_id {
                            game.relationship_graph.modify_strength(
                                player_id,
                                other_id,
                                -3, // Teammates blame the sent-off player
                            );
                        }
                    }
                }
            }
        }

        // V100 Issue #30 (rework): Teammate partnership formation.
        // For each pair of teammates who both played 60+ minutes, roll a
        // small chance (5% base, scaled by personality similarity) to bump
        // the relationship +1 to +3. Partnerships accumulate slowly across
        // a season — this is the "Neville/Beckham, Xavi/Iniesta" path.
        form_teammate_partnerships(game, report, team_id, &team_player_ids, &date);
    }

    // V100 Issue #30 (rework): Auto-trigger cross-team rivalries from
    // match flashpoints. Scans events for fouls (Hard/Reckless only),
    // red cards, dribbles tackled, headers won/lost, and goals scored
    // against. For each qualifying event, rolls a small chance to escalate
    // a negative edge between the two involved players (across teams).
    // Most matches produce 0 rivalries; a bad-tempered derby might produce 1.
    trigger_cross_team_rivalries(game, report, home_team_id, away_team_id, &date);
}

/// V100 Issue #30 (rework): Form (or strengthen) teammate partnerships.
///
/// For each pair of teammates who both played 60+ minutes in this match:
///   1. Compute personality similarity (Big Five distance, 0-1).
///   2. Roll 5% base chance, scaled up by personality similarity (max ~12%).
///   3. On hit, bump the relationship +1 to +3 based on result + similarity.
///   4. Add "Partnership" narrative tag if edge strength crosses +30.
///
/// This is the slow path that produces Neville/Beckham, Xavi/Iniesta,
/// Nesta/Cannavaro style bonds over a season of playing together.
fn form_teammate_partnerships(
    game: &mut Game,
    report: &engine::MatchReport,
    _team_id: &str,
    team_player_ids: &[String],
    _date: &str,
) {
    // Identify starters (60+ minutes played) for this team.
    let starters: Vec<String> = team_player_ids
        .iter()
        .filter(|pid| {
            report
                .player_stats
                .get(*pid)
                .map(|ps| ps.minutes_played >= 60)
                .unwrap_or(false)
        })
        .cloned()
        .collect();

    if starters.len() < 2 {
        return;
    }

    // Pre-fetch personality snapshots for similarity computation.
    // We can't borrow game.players inside the loop while also mutating
    // game.relationship_graph, so collect the data we need up-front.
    let personalities: std::collections::HashMap<String, [f64; 5]> = starters
        .iter()
        .filter_map(|pid| {
            game.players
                .iter()
                .find(|p| &p.id == pid)
                .map(|p| {
                    (
                        pid.clone(),
                        [
                            p.personality.openness as f64,
                            p.personality.conscientiousness as f64,
                            p.personality.extraversion as f64,
                            p.personality.agreeableness as f64,
                            p.personality.neuroticism as f64,
                        ],
                    )
                })
        })
        .collect();

    // Use a deterministic RNG seed from the date + first starter id so
    // the same match always produces the same partnership rolls. This
    // makes the system reproducible (no save-scumming advantage).
    let seed_str = format!("{}-{}-{}", _date, _team_id, starters.first().unwrap_or(&String::new()));
    let mut seed: u64 = 0;
    for byte in seed_str.bytes() {
        seed = seed.wrapping_mul(31).wrapping_add(byte as u64);
    }

    // Simple xorshift RNG — deterministic, no need for the rand crate here.
    let mut next_rand = || {
        seed ^= seed << 13;
        seed ^= seed >> 7;
        seed ^= seed << 17;
        (seed % 1000) as f64 / 1000.0
    };

    for i in 0..starters.len() {
        for j in (i + 1)..starters.len() {
            let a = &starters[i];
            let b = &starters[j];

            // Compute personality similarity (0 = polar opposites, 1 = twins).
            let sim = match (personalities.get(a), personalities.get(b)) {
                (Some(pa), Some(pb)) => {
                    let dist: f64 = (0..5)
                        .map(|k| (pa[k] - pb[k]).abs() / 100.0)
                        .sum::<f64>()
                        / 5.0;
                    1.0 - dist
                }
                _ => 0.5, // unknown personality — neutral
            };

            // V100 FIX (forensic): Tuned down from 5% to 1.5% base chance.
            // User feedback: "chemistry relationships seem too easy to form
            // when we specifically said they should be earned."
            // At 1.5% base + up to 2% from similarity = ~3.5% max per pair
            // per match. With 55 pairs per match, ~1-2 bumps per match.
            // Over a 38-game season: ~40-80 bumps total, spread across all
            // pairs. A specific pair gets ~1 bump per season on average —
            // partnerships take a full season to form, not a month.
            let roll = next_rand();
            let chance = 0.015 + (sim * 0.02);
            if roll > chance {
                continue;
            }

            // V100 FIX (forensic): Cap bumps at +1 per hit (was +1 to +3).
            // Partnerships should accumulate slowly — +1 per match is the
            // max. Over a 38-game season with ~1-2 hits: +1 to +2 per season
            // for a pair that plays together regularly. Takes ~15 seasons
            // to max out at +30 (the chemistry bonus threshold).
            let bump: i8 = 1;

            game.relationship_graph.modify_strength(a, b, bump);

            // Add "Partnership" tag if edge crosses +30 — this is the
            // threshold the match engine reads for the chemistry bonus.
            if let Some(edge) = game.relationship_graph.get(a, b) {
                if edge.strength >= 30 && !edge.narrative_tags.iter().any(|t| t == "Partnership") {
                    if let Some(edge_mut) = game.relationship_graph.get_mut(a, b) {
                        edge_mut.narrative_tags.push("Partnership".to_string());
                    }
                }
            }
        }
    }
}

/// V100 Issue #30 (rework): Auto-trigger cross-team rivalries from match flashpoints.
///
/// Scans `report.events` for cross-team flashpoints and rolls a small chance
/// per qualifying event to escalate a negative edge between the two involved
/// players. Triggers:
///   - Hard/Reckless Foul: 5% chance (Hard), 12% (Reckless)
///   - Red Card on fouled player's opponent: 15% (the foul that caused the card)
///   - DribbleTackled: 2% (rare — only repeated humblings form a rivalry)
///   - HeaderWon vs specific loser: 1% (very rare — only aerial duels matter)
///   - Goal scored by A against B's team: 3% (B's team lost to A's goal)
///
/// On a hit, calls `relationship_graph.escalate(a, b, date, -15)` and sets
/// `rivalry_flag = true` on the edge. Adds a narrative tag describing the
/// trigger ("Bad Tackle", "Derby Flashpoint", "Late Winner", etc.).
fn trigger_cross_team_rivalries(
    game: &mut Game,
    report: &engine::MatchReport,
    home_team_id: &str,
    away_team_id: &str,
    date: &str,
) {
    // Build a quick lookup: player_id → team_id (home or away).
    let player_team: std::collections::HashMap<String, String> = game
        .players
        .iter()
        .filter_map(|p| {
            p.team_id.as_ref().filter(|tid| *tid == home_team_id || *tid == away_team_id).map(|tid| (p.id.clone(), tid.clone()))
        })
        .collect();

    // Deterministic RNG seeded from date + team ids.
    let seed_str = format!("{}-{}-{}", date, home_team_id, away_team_id);
    let mut seed: u64 = 0;
    for byte in seed_str.bytes() {
        seed = seed.wrapping_mul(31).wrapping_add(byte as u64);
    }
    let mut next_rand = || {
        seed ^= seed << 13;
        seed ^= seed >> 7;
        seed ^= seed << 17;
        (seed % 10000) as f64 / 10000.0
    };

    for event in &report.events {
        let (Some(pid_a), Some(pid_b)) = (event.player_id.as_ref(), event.secondary_player_id.as_ref()) else {
            continue;
        };

        // Both players must be on opposite teams in this match.
        let (Some(team_a), Some(team_b)) = (player_team.get(pid_a), player_team.get(pid_b)) else {
            continue;
        };
        if team_a == team_b {
            continue;
        }

        // Determine trigger label + intensity based on event type + severity.
        // Roll the RNG once per event (advances the seed deterministically).
        let roll = next_rand();
        let (trigger_label, intensity, chance): (&'static str, i8, f64) = match event.event_type {
            engine::EventType::Foul => {
                // Read severity from event.detail if available.
                // V100 build fix: EventDetail is non-exhaustive across
                // Shot/Save/Foul/Goal — only Foul carries severity. Any
                // other detail (or None) defaults to Soft.
                let sev = match &event.detail {
                    Some(engine::EventDetail::Foul { severity }) => *severity,
                    _ => engine::FoulSeverity::Soft,
                };
                match sev {
                    engine::FoulSeverity::Reckless => ("Reckless Foul", -20, 0.12),
                    engine::FoulSeverity::Hard => ("Hard Foul", -15, 0.05),
                    engine::FoulSeverity::Soft => ("Soft Foul", -8, 0.01),
                }
            }
            engine::EventType::DribbleTackled => ("Tackled Hard", -10, 0.02),
            engine::EventType::HeaderWon => ("Aerial Battle", -5, 0.01),
            engine::EventType::RedCard => ("Red Card Flashpoint", -25, 0.15),
            _ => continue,
        };

        if roll > chance {
            continue;
        }

        // Escalate the edge. This sets strength to min(existing, intensity)
        // and bumps volatility.
        game.relationship_graph
            .escalate(pid_a, pid_b, date, intensity);

        // Mark the edge as a rivalry so the engine + UI can surface it.
        if let Some(edge) = game.relationship_graph.get_mut(pid_a, pid_b) {
            edge.rivalry_flag = true;
            if !edge.narrative_tags.iter().any(|t| t == trigger_label) {
                edge.narrative_tags.push(trigger_label.to_string());
            }
        }
    }

    // V100 Issue #30: Losing a match can also spark a rivalry between the
    // two best opposing players (the "they always seem to score against us"
    // pattern). Roll 4% chance per match, picks the top-rated performer
    // from each team.
    let _ = next_rand(); // advance RNG
    let loss_rivalry_roll = next_rand();
    if loss_rivalry_roll < 0.04 && report.home_goals != report.away_goals {
        let (winner_team, loser_team) = if report.home_goals > report.away_goals {
            (home_team_id, away_team_id)
        } else {
            (away_team_id, home_team_id)
        };

        // Find the top-rated player on each side.
        let top_winner = report
            .player_stats
            .iter()
            .filter(|(pid, _)| player_team.get(*pid).map(|t| t.as_str() == winner_team).unwrap_or(false))
            .max_by(|a, b| a.1.rating.partial_cmp(&b.1.rating).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(pid, _)| pid.clone());
        let top_loser = report
            .player_stats
            .iter()
            .filter(|(pid, _)| player_team.get(*pid).map(|t| t.as_str() == loser_team).unwrap_or(false))
            .max_by(|a, b| a.1.rating.partial_cmp(&b.1.rating).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(pid, _)| pid.clone());

        if let (Some(winner_id), Some(loser_id)) = (top_winner, top_loser) {
            if winner_id != loser_id {
                game.relationship_graph
                    .escalate(&winner_id, &loser_id, date, -12);
                if let Some(edge) = game.relationship_graph.get_mut(&winner_id, &loser_id) {
                    edge.rivalry_flag = true;
                    if !edge.narrative_tags.iter().any(|t| t == "Nemesis") {
                        edge.narrative_tags.push("Nemesis".to_string());
                    }
                }
            }
        }
    }
}

/// Update team form vectors after a match result. Keeps last 5 results.
/// Also applies streak-based morale bonus/penalty to all players on teams with streaks.
fn update_team_form(
    game: &mut Game,
    report: &engine::MatchReport,
    home_team_id: &str,
    away_team_id: &str,
) {
    use rand::RngExt;
    let mut rng = rand::rng();

    let home_result = if report.home_goals > report.away_goals {
        "W"
    } else if report.home_goals < report.away_goals {
        "L"
    } else {
        "D"
    };
    let away_result = if report.away_goals > report.home_goals {
        "W"
    } else if report.away_goals < report.home_goals {
        "L"
    } else {
        "D"
    };

    // Update form for both teams
    for (team_id_str, result) in [(home_team_id, home_result), (away_team_id, away_result)] {
        if let Some(team) = game.teams.iter_mut().find(|t| t.id == team_id_str) {
            team.form.push(result.to_string());
            if team.form.len() > 5 {
                team.form.remove(0);
            }
        }
    }

    // Apply streak-based morale bonus/penalty
    for team_id_str in [home_team_id, away_team_id] {
        let form = game
            .teams
            .iter()
            .find(|t| t.id == team_id_str)
            .map(|t| t.form.clone())
            .unwrap_or_default();

        if form.len() >= 3 {
            let last3: Vec<&str> = form.iter().rev().take(3).map(|s| s.as_str()).collect();
            // V100 P1 (Issue #30): Morale difficulty tuning.
            // Old: 3W = +2..+5, 3L = -10..-5. Too easy to recover from 3L
            //      with a single win (the +2..+5 from a 3W streak cancelled it).
            // New: 3L = -15..-8 (harder to recover), 3W = +3..+6 (slight boost).
            //      Also add a "crisis" state: if 5+ losses in a row, apply an
            //      additional -5 morale hit AND require 2 consecutive wins to
            //      exit crisis (handled in the win-streak branch by checking
            //      the last 5 results).
            let streak_delta: i16 = if last3.iter().all(|r| *r == "W") {
                // Check if team was in crisis (5+ losses in last 5 before this streak).
                // If so, only 2 consecutive wins (not just 3) starts the recovery.
                let recent5_losses = form
                    .iter()
                    .rev()
                    .take(5)
                    .filter(|r| r.as_str() == "L")
                    .count();
                if recent5_losses >= 4 {
                    // Still in crisis — slower recovery (single win barely helps).
                    rng.random_range(1..=3)
                } else {
                    rng.random_range(3..=6) // 3+ win streak: small global morale boost
                }
            } else if last3.iter().all(|r| *r == "L") {
                let recent5_losses = form
                    .iter()
                    .rev()
                    .take(5)
                    .filter(|r| r.as_str() == "L")
                    .count();
                if recent5_losses >= 5 {
                    // Crisis mode: 5+ losses — bigger morale hit + squad unrest.
                    rng.random_range(-18..=-12)
                } else {
                    rng.random_range(-15..=-8) // 3+ loss streak: significant morale drop
                }
            } else {
                0
            };

            if streak_delta != 0 {
                // V99.10 C12: Look up the team's manager's man_management
                // rating to boost positive morale recovery. A great man-
                // manager (100) gives +0.5 to positive deltas; a poor one
                // (0) gives +0. The bonus only applies to positive deltas
                // (win streaks), not negative ones (loss streaks).
                let mgr_recovery_bonus = game
                    .managers
                    .iter()
                    .find(|m| m.team_id.as_deref() == Some(team_id_str))
                    .map(|m| m.personality.morale_recovery_bonus())
                    .unwrap_or(0.0);

                for player in game.players.iter_mut() {
                    if player.team_id.as_deref() == Some(team_id_str) {
                        let base = player.morale as i16;
                        let mut adjusted_delta = capped_positive_recovery(streak_delta, player);
                        // V99.10 C12: Apply man_management bonus to positive deltas.
                        if adjusted_delta > 0 && mgr_recovery_bonus > 0.0 {
                            let bonus = (adjusted_delta as f64 * mgr_recovery_bonus).round() as i16;
                            adjusted_delta += bonus;
                        }
                        player.morale = (base + adjusted_delta).clamp(10, 100) as u8;
                    }
                }
            }
        }
    }
}

fn deplete_match_stamina(game: &mut Game, team_id: &str, report: &engine::MatchReport) {
    // V99.10 C5: Hoist the RNG outside the loop so we share one across all
    // players on the team (matches the national-team pattern at
    // national_team.rs:403-411). Previously each player got a fresh RNG,
    // which is fine for `apply_match_wear` (deterministic per call) but
    // wasteful.
    let mut rng = rand::rng();
    for player in game.players.iter_mut() {
        if player.team_id.as_deref() == Some(team_id) {
            let minutes = report
                .player_stats
                .get(&player.id)
                .map(|ps| ps.minutes_played)
                .unwrap_or(0);
            // Shared with national-team friendlies so call-ups wear players
            // identically to club fixtures.
            crate::player_wear::apply_match_wear(player, minutes, &mut rng);

            // V99.10 C5: Roll for match injuries on players who actually
            // played. Previously club matches NEVER applied injuries — only
            // national-team call-ups did (national_team.rs:406). This meant
            // squad depth was irrelevant (no injuries to cover) and the only
            // injury paths were training-ground random events and internationals.
            //
            // `roll_match_injury` is idempotent (skips if already injured)
            // and uses base 1/40 probability scaled by fitness (3x for
            // unfit, 0.7x for peak). Gating on `minutes > 0` ensures
            // benchwarmers don't pick up match injuries they didn't earn.
            if minutes > 0 {
                crate::player_wear::roll_match_injury(player, &mut rng);
            }
        }
    }
}
