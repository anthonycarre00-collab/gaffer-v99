mod dormant;
mod news;
mod post_match;
mod round_summary;

use crate::board_objectives;
use crate::game::Game;
// V99.10 C10: domain_to_engine_role/domain_to_engine_tactics imports
// removed — were only used by the old build_engine_team which now
// delegates to build_team_with_bench (which has its own copies).
use crate::player_events;
use crate::random_events;
use crate::scouting;
use crate::training;
use crate::transfers;
use chrono::Datelike;
use domain::league::FixtureStatus;
// V99.10 C10: DomainPosition import removed — was only used by the old
// build_engine_team which has been replaced with a delegation to
// build_team_with_bench.
use domain::stats::StatsState;
use log::{debug, info};

// Re-export public items
pub use news::generate_matchday_news;
pub use post_match::{apply_match_report, apply_match_report_with_capture};
pub use round_summary::{
    NotableUpset, RoundResultSummary, RoundSummary, StandingDelta, TopScorerDelta,
    build_round_summary,
};

/// Progress injury recovery by one day for all currently injured players.
/// Players with 1 day remaining are cleared (fully recovered).
fn progress_injury_recovery(game: &mut Game) {
    for player in game.players.iter_mut() {
        if let Some(mut injury) = player.injury.take()
            && injury.days_remaining > 1
        {
            injury.days_remaining -= 1;
            player.injury = Some(injury);
        } else if let Some(injury) = player.injury.take() {
            // V99.11 A4: Injury has healed (days_remaining == 1, now 0).
            // Check if this was a career-threatening injury and apply
            // permanent attribute penalty if so.
            if let Some(idx) = crate::player_wear::career_threatening_injury_index(&injury) {
                crate::player_wear::apply_career_threatening_penalty(player, idx);
                log::info!(
                    "[injury] Player {} recovered from career-threatening injury (idx={}), permanent penalty applied",
                    player.full_name,
                    idx
                );
            }
            // Clear the injury (player is now fit)
            player.injury = None;
        }
    }
}

fn competition_is_active(game: &Game, competition: &domain::league::League) -> bool {
    game.competition_in_active_scope(competition)
}

fn competition_indices_due_today(game: &Game, today: &str) -> Vec<usize> {
    if !game.competitions.is_empty() {
        return game
            .competitions
            .iter()
            .enumerate()
            // National-team tournaments are simulated by the national-team
            // engine, never the club match engine.
            .filter(|(_, competition)| {
                competition.kind != domain::league::CompetitionType::InternationalNation
            })
            .filter(|(_, competition)| competition_is_active(game, competition))
            .filter(|(_, competition)| {
                competition.fixtures.iter().any(|fixture| {
                    fixture.date == today && fixture.status == FixtureStatus::Scheduled
                })
            })
            .map(|(index, _)| index)
            .collect();
    }

    if game.league.as_ref().is_some_and(|league| {
        league
            .fixtures
            .iter()
            .any(|fixture| fixture.date == today && fixture.status == FixtureStatus::Scheduled)
    }) {
        vec![0]
    } else {
        Vec::new()
    }
}

/// Competitions OUTSIDE the active scope that have fixtures due today. These are
/// resolved cheaply (scoreline only) so the dormant world keeps moving. Returns
/// empty when no scope is configured (everything is active → nothing dormant).
fn dormant_competition_indices_due_today(game: &Game, today: &str) -> Vec<usize> {
    if game.competitions.is_empty() {
        return Vec::new();
    }
    game.competitions
        .iter()
        .enumerate()
        .filter(|(_, competition)| {
            competition.kind != domain::league::CompetitionType::InternationalNation
        })
        .filter(|(_, competition)| !competition_is_active(game, competition))
        .filter(|(_, competition)| {
            competition
                .fixtures
                .iter()
                .any(|fixture| fixture.date == today && fixture.status == FixtureStatus::Scheduled)
        })
        .map(|(index, _)| index)
        .collect()
}

fn simulate_competition_day_with_capture<F>(
    game: &mut Game,
    competition_index: usize,
    today: &str,
    on_capture: &mut F,
) where
    F: FnMut(StatsState),
{
    if competition_index >= game.competitions.len() {
        simulate_matchday_with_capture(game, today, on_capture);
        return;
    }

    let competition = game.competitions[competition_index].clone();
    game.league = Some(competition);
    simulate_matchday_with_capture(game, today, on_capture);
    if let Some(updated_competition) = game.league.take() {
        game.competitions[competition_index] = updated_competition;
    }
    game.sync_legacy_league();
}

/// Process a single day advance.
pub fn process_day(game: &mut Game) {
    process_day_with_capture(game, &mut |_| {});
}

pub fn process_day_with_capture<F>(game: &mut Game, on_capture: &mut F)
where
    F: FnMut(StatsState),
{
    let today = game.clock.current_date.format("%Y-%m-%d").to_string();
    transfers::process_loan_development_reports(game);
    transfers::process_loan_returns(game);

    let due_competitions = competition_indices_due_today(game, &today);
    let has_match_today = !due_competitions.is_empty();

    if has_match_today {
        info!("[turn] process_day {}: matchday", today);
        for competition_index in due_competitions {
            simulate_competition_day_with_capture(game, competition_index, &today, on_capture);
        }
    } else {
        let weekday_num = game.clock.current_date.weekday().num_days_from_monday();
        crate::ai_training::apply_ai_training_policies(game, weekday_num);
        training::process_training(game, weekday_num);
        training::check_squad_fitness_warnings(game);
    }

    // Tiered simulation: competitions outside the active scope are resolved by
    // scoreline only, keeping the dormant world moving without the full engine.
    let dormant_competitions = dormant_competition_indices_due_today(game, &today);
    if !dormant_competitions.is_empty() {
        let mut rng = rand::rng();
        for competition_index in dormant_competitions {
            dormant::simulate_dormant_competition_day(game, competition_index, &today, &mut rng);
        }
    }

    // National-team football: window friendlies and any running World Cup.
    // Both self-filter by date, so they are no-ops on other days.
    crate::national_team::process_national_team_fixtures_due(game, &today, &mut rand::rng());
    crate::world_cup::process_world_cup_fixtures_due(game, &today, &mut rand::rng());

    crate::contracts::process_contract_expiries(game);

    // Weekly financial processing (wages, matchday income, warnings)
    crate::finances::process_weekly_finances(game);

    // Gaffer weekly maintenance — runs on Mondays (weekday 0) alongside finances
    let _weekday_for_gaffer = game.clock.current_date.weekday().num_days_from_monday();
    if _weekday_for_gaffer == 0 {
        // Narrative: decay old memories, check for resurfacing
        game.memory_store.weekly_decay(&today);

        // V99.3 VITAL-1 M1: Memory resurfacing. The narrative engine records
        // memories but never resurfaces them — check_resurfacing was only
        // called from tests. Now we check the user's team + squad weekly
        // and generate news articles when memories resurface, so stories
        // actually get told instead of sitting in the memory store forever.
        surface_narrative_memories(game, &today);

        // Media: shift pundit forms
        let mut rng = rand::rng();
        game.media_engine.weekly_update(&mut rng);

        // Relationships: decay volatilities
        game.relationship_graph.decay_all_volatilities();
    }

    // Board objectives (generate if missing, update progress)
    board_objectives::generate_objectives(game);
    board_objectives::update_objective_progress(game);

    // Player conversations, random events, and scouting
    player_events::check_player_events(game);
    progress_injury_recovery(game);
    random_events::check_random_events(game);
    scouting::process_scouting(game);
    transfers::process_pending_transfer_registrations(game);
    transfers::process_pending_loan_registrations(game);
    transfers::generate_incoming_transfer_offers(game);
    crate::generator::process_available_staff_market(game);
    crate::ai_hiring::update_ai_manager_satisfaction(game);

    news::generate_weekly_digest_news(game, &today);
    news::generate_pre_match_messages(game, &today);

    crate::firing::check_manager_firing(game);
    crate::ai_hiring::process_vacant_ai_clubs(game);
    crate::job_offers::check_job_offers(game);

    // V99.4 T3.1: Deadline Day news branding.
    if matches!(
        game.season_context.transfer_window.status,
        domain::season::TransferWindowStatus::DeadlineDay
    ) {
        let dd_id = format!("deadline_day_{}", today);
        if !game.news.iter().any(|a| a.id == dd_id) {
            game.news.push(domain::news::NewsArticle {
                id: dd_id,
                headline: "DEADLINE DAY".to_string(),
                body: "It's deadline day — the clock is ticking. Expect last-minute \
                       moves, panic buys, and surprise bids as clubs scramble to get \
                       their business done before the window slams shut.".to_string(),
                source: "Transfer Wire".to_string(),
                date: today.clone(),
                category: domain::news::NewsCategory::TransferRoundup,
                team_ids: vec![],
                player_ids: vec![],
                match_score: None,
                read: false,
                headline_key: None,
                body_key: None,
                source_key: None,
                i18n_params: std::collections::HashMap::new(),
            });
        }
    }

    debug!("[turn] process_day {}: complete, advancing clock", today);

    // V99.3 PERF-1 C2: Prune old messages + news to prevent unbounded growth.
    // After 5 seasons at ~365 days × (5 articles + 3 messages + match reports)
    // → tens of thousands of items, every one serialized on every game.clone()
    // and every setGameState. Daily pruning keeps the collections bounded.
    prune_old_messages_and_news(game);

    game.clock.advance_days(1);
    crate::season_context::refresh_game_context(game);
}

/// V99.3 PERF-1 C2: Prune old read messages and news articles.
///
/// - Messages: keep unread indefinitely, prune read messages older than 365 days.
/// - News: keep unread indefinitely, prune read news older than 730 days (2 seasons).
///
/// This prevents the save file from growing without bound and keeps the
/// daily dedup-HashSet construction fast (O(remaining) instead of O(all-time)).
fn prune_old_messages_and_news(game: &mut Game) {
    let today = game.clock.current_date.date_naive();
    let message_cutoff = today - chrono::Duration::days(365);
    let news_cutoff = today - chrono::Duration::days(730);

    let before_msgs = game.messages.len();
    let before_news = game.news.len();

    // Prune read messages older than 365 days. Unread messages are always kept.
    game.messages.retain(|msg| {
        if !msg.read {
            return true;
        }
        // Parse the message date; if it can't be parsed, keep it (defensive).
        match chrono::NaiveDate::parse_from_str(&msg.date, "%Y-%m-%d") {
            Ok(date) => date >= message_cutoff,
            Err(_) => true,
        }
    });

    // Prune read news older than 730 days. Unread news is always kept.
    game.news.retain(|article| {
        if !article.read {
            return true;
        }
        match chrono::NaiveDate::parse_from_str(&article.date, "%Y-%m-%d") {
            Ok(date) => date >= news_cutoff,
            Err(_) => true,
        }
    });

    let pruned_msgs = before_msgs - game.messages.len();
    let pruned_news = before_news - game.news.len();
    if pruned_msgs > 0 || pruned_news > 0 {
        debug!(
            "[turn] Pruned {} old messages ({} → {}) and {} old news ({} → {})",
            pruned_msgs,
            before_msgs,
            game.messages.len(),
            pruned_news,
            before_news,
            game.news.len(),
        );
    }

    // V100 P0-8 (Issue #5): Prune rejected/withdrawn transfer offers older
    // than 30 days. Prevents the player.transfer_offers Vec from growing
    // unboundedly across multiple seasons of stale bids.
    crate::transfers::prune_old_transfer_offers(game);
}

/// V99.3 VITAL-1 M1: Surface narrative memories for the user's team + squad.
///
/// The narrative engine records memories (breakout performances, rivalries,
/// comebacks, slumps) but `check_resurfacing` was only called from tests —
/// memories were never resurfaced in production. This weekly pass checks
/// the user's team + each squad member for resurfacing candidates and
/// generates a news article when a memory resurfaces, so stories actually
/// get told instead of sitting in the memory store forever.
///
/// Uses the existing 12-week cooldown (COOLDOWN_DAYS) to prevent the same
/// memory from resurfacing too frequently.
fn surface_narrative_memories(game: &mut Game, today: &str) {
    use domain::news::{NewsArticle, NewsCategory};

    // Collect entity IDs to check: user's team + user's squad players.
    let user_team_id = match &game.manager.team_id {
        Some(id) => id.clone(),
        None => return,
    };

    let mut entity_ids = vec![user_team_id.clone()];
    for player in &game.players {
        if player.team_id.as_deref() == Some(&user_team_id) {
            entity_ids.push(player.id.clone());
        }
    }

    // V99.3: First pass — collect (entity_id, memory_id, description) tuples
    // from resurfacing candidates. This is an immutable borrow of memory_store.
    let mut resurfaced: Vec<(String, String, String)> = Vec::new();
    for entity_id in &entity_ids {
        let candidates = game
            .memory_store
            .resurfacing_candidates(entity_id, today, 0.3);
        for memory in candidates.iter().take(1) {
            // Only surface 1 per entity per week to avoid spam.
            resurfaced.push((
                entity_id.clone(),
                memory.id.clone(),
                memory.description.clone(),
            ));
        }
    }

    if resurfaced.is_empty() {
        return;
    }

    // Pre-compute entity names (immutable borrow of teams + players).
    let team_names: std::collections::HashMap<String, String> = game
        .teams
        .iter()
        .map(|t| (t.id.clone(), t.name.clone()))
        .collect();
    let player_names: std::collections::HashMap<String, String> = game
        .players
        .iter()
        .map(|p| (p.id.clone(), p.full_name.clone()))
        .collect();

    // Second pass — mark memories as resurfaced + generate news articles.
    // This is a mutable borrow of memory_store + news.
    for (entity_id, memory_id, description) in &resurfaced {
        // Mark the memory as resurfaced (sets 12-week cooldown).
        if let Some(memory) = game.memory_store.get_memory_mut(memory_id) {
            if let Ok(date) = chrono::NaiveDate::parse_from_str(today, "%Y-%m-%d") {
                let until = date + chrono::Duration::days(84); // 12 weeks
                memory.resurface(&until.format("%Y-%m-%d").to_string());
            }
        }

        // Resolve entity name.
        let entity_name = if entity_id == &user_team_id {
            team_names.get(entity_id).cloned().unwrap_or_else(|| "The club".to_string())
        } else {
            player_names.get(entity_id).cloned().unwrap_or_else(|| "A player".to_string())
        };

        let headline = format!("Throwback: {}", description);
        let body = format!(
            "Looking back — {} and the moment that still gets talked about: \"{}\". \
             The fans haven't forgotten.",
            entity_name, description
        );

        game.news.push(NewsArticle {
            id: format!("narrative_resurface_{}_{}", today, entity_id),
            headline,
            body,
            source: "The Football Herald".to_string(),
            date: today.to_string(),
            category: NewsCategory::Editorial,
            team_ids: if entity_id == &user_team_id {
                vec![user_team_id.clone()]
            } else {
                vec![]
            },
            player_ids: if entity_id != &user_team_id {
                vec![entity_id.clone()]
            } else {
                vec![]
            },
            match_score: None,
            read: false,
            headline_key: None,
            body_key: None,
            source_key: None,
            i18n_params: std::collections::HashMap::new(),
        });
    }

    debug!(
        "[turn] Surfaced {} narrative memories on {}",
        resurfaced.len(),
        today
    );
}

/// Called after a live match finishes to complete the day:
/// generates matchday news, pre-match messages, and advances the clock by one day.
pub fn finish_live_match_day(game: &mut Game) {
    let today = game.clock.current_date.format("%Y-%m-%d").to_string();
    info!("[turn] finish_live_match_day: {}", today);
    transfers::process_loan_development_reports(game);
    transfers::process_loan_returns(game);
    generate_matchday_news(game, &today);

    crate::contracts::process_contract_expiries(game);
    crate::finances::process_weekly_finances(game);

    board_objectives::generate_objectives(game);
    board_objectives::update_objective_progress(game);

    player_events::check_player_events(game);
    progress_injury_recovery(game);
    random_events::check_random_events(game);
    scouting::process_scouting(game);
    transfers::process_pending_transfer_registrations(game);
    transfers::process_pending_loan_registrations(game);
    transfers::generate_incoming_transfer_offers(game);
    crate::generator::process_available_staff_market(game);
    crate::ai_hiring::update_ai_manager_satisfaction(game);
    news::generate_weekly_digest_news(game, &today);
    news::generate_pre_match_messages(game, &today);

    crate::firing::check_manager_firing(game);
    crate::ai_hiring::process_vacant_ai_clubs(game);
    crate::job_offers::check_job_offers(game);

    game.clock.advance_days(1);
    game.sync_legacy_league();
    crate::season_context::refresh_game_context(game);
}

#[cfg(test)]
#[allow(clippy::items_after_test_module)]
mod tests {
    use super::finish_live_match_day;
    use crate::clock::GameClock;
    use crate::game::Game;
    use chrono::{TimeZone, Utc};
    use domain::manager::Manager;
    use domain::player::{Player, PlayerAttributes, Position};
    use domain::staff::{Staff, StaffAttributes, StaffRole};
    use domain::team::Team;

    fn make_team() -> Team {
        let mut team = Team::new(
            "team1".to_string(),
            "Test FC".to_string(),
            "TST".to_string(),
            "England".to_string(),
            "London".to_string(),
            "Stadium".to_string(),
            40_000,
        );
        team.finance = 5_000_000;
        team.wage_budget = 2_000_000;
        team
        }

    fn make_player() -> Player {
        let attrs = PlayerAttributes {
            pace: 65,
            engine: 65,
            power: 65,
            agility: 65,
            passing: 65,
            finishing: 65,
            defending: 65,
            touch: 65,
            anticipation: 65,
            vision: 65,
            decisions: 65,
            composure: 65,
            leadership: 50,
            shot_stopping: 20,
            aerial: 60,
            burst: 50,
            distribution: 50,
            commanding: 50,
            playing_out: 50,
            ..Default::default()
        };
        let mut player = Player::new(
            "player1".to_string(),
            "Player".to_string(),
            "Test Player".to_string(),
            "1995-01-01".to_string(),
            "GB".to_string(),
            Position::Midfielder,
            attrs,
        );
        player.team_id = Some("team1".to_string());
        player.wage = 52_000;
        player
    }

    fn make_staff() -> Staff {
        let mut staff = Staff::new(
            "staff1".to_string(),
            "Staff".to_string(),
            "Coach".to_string(),
            "1980-01-01".to_string(),
            StaffRole::Coach,
            StaffAttributes {
                coaching: 70,
                judging_ability: 50,
                judging_potential: 50,
                physiotherapy: 30,
            },
        );
        staff.team_id = Some("team1".to_string());
        staff.nationality = "GB".to_string();
        staff.wage = 10_400;
        staff
    }

    #[test]
    fn finish_live_match_day_runs_weekly_finances_on_monday() {
        let clock = GameClock::new(Utc.with_ymd_and_hms(2025, 6, 16, 12, 0, 0).unwrap());
        let mut manager = Manager::new(
            "mgr1".to_string(),
            "Test".to_string(),
            "Manager".to_string(),
            "1980-01-01".to_string(),
            "England".to_string(),
        );
        manager.hire("team1".to_string());

        let mut game = Game::new(
            clock,
            manager,
            vec![make_team()],
            vec![make_player()],
            vec![make_staff()],
            vec![],
        );
        let initial_finance = game.teams[0].finance;

        finish_live_match_day(&mut game);

        assert_eq!(
            game.teams[0].finance,
            initial_finance - ((52_000 + 10_400) / 52)
        );
    }

    // V99.10 C11: Verify build_engine_team produces the same XI as
    // build_team_with_bench. Both paths should now use identical team
    // construction (starting XI, not full squad) so AI-vs-AI matches
    // and live matches produce consistent scorelines.
    #[test]
    fn build_engine_team_matches_build_team_with_bench() {
        let mut game = make_game();
        // Add a few players to team1 so there's a squad to select from.
        for i in 0..18 {
            let mut player = Player::new(
                format!("p{}", i),
                format!("Player {}", i),
                format!("P{}", i),
                "2000-01-01".to_string(),
                "England".to_string(),
            );
            player.team_id = Some("team1".to_string());
            player.position = match i % 4 {
                0 => Position::Goalkeeper,
                1 => Position::Defender,
                2 => Position::Midfielder,
                _ => Position::Forward,
            };
            player.ovr = 60 + (i as u8) % 20;
            player.condition = 80;
            game.players.push(player);
        }

        // Build via build_engine_team (the AI-vs-AI path).
        let engine_team = build_engine_team(&game, "team1");
        // Build via build_team_with_bench (the live match path).
        let (live_team, _bench) =
            crate::live_match_manager::build_team_with_bench(&game, "team1");

        // Both should have the same number of players (starting XI, not squad).
        assert_eq!(
            engine_team.players.len(),
            live_team.players.len(),
            "build_engine_team and build_team_with_bench should produce the same XI size"
        );

        // Both should have the same player IDs (order may differ, so compare as sets).
        let engine_ids: std::collections::HashSet<_> = engine_team.players.iter().map(|p| p.id.clone()).collect();
        let live_ids: std::collections::HashSet<_> = live_team.players.iter().map(|p| p.id.clone()).collect();
        assert_eq!(
            engine_ids, live_ids,
            "build_engine_team and build_team_with_bench should select the same players"
        );
    }

    // V99.10 C11: Verify injured players are excluded from AI-vs-AI matches.
    #[test]
    fn build_engine_team_excludes_injured_players() {
        let mut game = make_game();
        // Add 14 healthy players + 4 injured players to team1.
        for i in 0..14 {
            let mut player = Player::new(
                format!("healthy{}", i),
                format!("Healthy {}", i),
                format!("H{}", i),
                "2000-01-01".to_string(),
                "England".to_string(),
            );
            player.team_id = Some("team1".to_string());
            player.position = match i % 4 {
                0 => Position::Goalkeeper,
                1 => Position::Defender,
                2 => Position::Midfielder,
                _ => Position::Forward,
            };
            player.ovr = 70;
            player.condition = 80;
            game.players.push(player);
        }
        for i in 0..4 {
            let mut player = Player::new(
                format!("injured{}", i),
                format!("Injured {}", i),
                format!("I{}", i),
                "2000-01-01".to_string(),
                "England".to_string(),
            );
            player.team_id = Some("team1".to_string());
            player.position = match i % 4 {
                0 => Position::Goalkeeper,
                1 => Position::Defender,
                2 => Position::Midfielder,
                _ => Position::Forward,
            };
            player.ovr = 90; // High OVR so they'd be selected if not injured
            player.condition = 80;
            player.injury = Some(domain::player::Injury {
                name: "Hamstring".to_string(),
                days_remaining: 14,
            });
            game.players.push(player);
        }

        let engine_team = build_engine_team(&game, "team1");

        // No injured players should be in the XI.
        for p in &engine_team.players {
            // The engine PlayerData doesn't carry injury info, but we can
            // check that no "injured" IDs appear.
            assert!(
                !p.id.starts_with("injured"),
                "Injured player {} should not be in the XI",
                p.id
            );
        }
    }
}

// ---------------------------------------------------------------------------
// Domain → Engine type conversion
// ---------------------------------------------------------------------------

/// V99.10 C10: Rewritten to delegate to `build_team_with_bench`.
///
/// Previously this function built `engine::TeamData` with the ENTIRE SQUAD
/// in `team.players` (20-30 players), while the live engine used only the
/// starting XI (11 players). This caused:
///   - `position_attr_avg` to be diluted by bench players
///   - `snap_player` to pick from the whole squad (deep squads unfairly boosted)
///   - Injured players to participate in AI-vs-AI matches
///   - Inconsistent scorelines between live and simmed matches
///
/// Now delegates to `build_team_with_bench` (the same function used by the
/// live engine), which:
///   - Filters injured players
///   - Calls `ai_select_starting_xi` to pick the best 11
///   - Returns the XI in `TeamData.players` and the bench separately
///
/// We discard the bench (AI-vs-AI matches don't use substitutions). The
/// `TeamData` returned is identical in structure to what the live engine
/// uses, ensuring consistency between the two paths (C11).
// V99.10 C10/C11: Made pub(crate) so the consistency test in
// tests/turn_tests.rs can verify build_engine_team produces the same
// XI as build_team_with_bench.
pub(crate) fn build_engine_team(game: &Game, team_id: &str) -> engine::TeamData {
    let (team_data, _bench) =
        crate::live_match_manager::build_team_with_bench(game, team_id);
    team_data
}

// V99.10 C10: `compute_partnership_bonus` removed — it was only called by
// the old `build_engine_team` which has been replaced with a delegation to
// `build_team_with_bench`. The live engine's `team_builder.rs` has its own
// inline copy of this logic (team_builder.rs:518-527), so no functionality
// is lost.

// ---------------------------------------------------------------------------
// Matchday simulation using the engine crate
// ---------------------------------------------------------------------------

fn simulate_matchday_with_capture<F>(game: &mut Game, today: &str, on_capture: &mut F)
where
    F: FnMut(StatsState),
{
    info!("[turn] simulate_matchday: {}", today);
    simulate_other_matches_with_capture(game, today, None, on_capture);
    generate_matchday_news(game, today);
}

/// Simulate all scheduled matches for `today`, optionally skipping one fixture
/// (the user's live match). Called by both process_day and advance_time_with_mode.
pub fn simulate_other_matches(game: &mut Game, today: &str, skip_fixture: Option<usize>) {
    simulate_other_matches_with_capture(game, today, skip_fixture, &mut |_| {});
}

pub fn simulate_other_matches_with_capture<F>(
    game: &mut Game,
    today: &str,
    skip_fixture: Option<usize>,
    on_capture: &mut F,
) where
    F: FnMut(StatsState),
{
    let user_team_id = game.manager.team_id.clone();

    let fixture_indices: Vec<usize> = game.league.as_ref().map_or(vec![], |league| {
        league
            .fixtures
            .iter()
            .enumerate()
            .filter(|(i, f)| {
                f.date == today
                    && f.status == FixtureStatus::Scheduled
                    && (skip_fixture != Some(*i))
            })
            .map(|(i, _)| i)
            .collect()
    });

    for idx in fixture_indices {
        // V99.4 PERF-1 M4: Use sparse_sim for AI-vs-AI matches (neither team
        // is the user's). The full 90-minute engine is only needed for:
        // - User's own matches (full match report + player stats)
        // - Matches the user might want to watch live
        // AI-vs-AI matches only need a scoreline + scorers for news + stats.
        let is_user_match = game.league.as_ref().map_or(false, |league| {
            let f = &league.fixtures[idx];
            Some(&f.home_team_id) == user_team_id.as_ref()
                || Some(&f.away_team_id) == user_team_id.as_ref()
        });

        if is_user_match {
            simulate_single_match_with_capture(game, idx, on_capture);
        } else {
            // Use sparse sim for AI-vs-AI — ~10× faster than full engine.
            simulate_sparse_ai_match(game, idx, on_capture);
        }
    }
}

/// V99.4 PERF-1 M4: Simulate an AI-vs-AI match using the sparse simulator.
///
/// This is ~10× faster than the full 90-minute engine because it:
/// - Uses a Poisson xG model instead of per-minute simulation
/// - Only generates sparse events (goals, assists, cards) — no possession
///   ticks, no buildup/midfield/attacking-third resolution
/// - Skips detailed match report construction
///
/// The sparse events are enough for: news story generation, stat aggregation,
/// player career highlights, and league standings updates.
fn simulate_sparse_ai_match<F>(game: &mut Game, idx: usize, _on_capture: &mut F)
where
    F: FnMut(StatsState),
{
    let (home_team_id, away_team_id, weather_str, importance) = {
        let league = game.league.as_ref().unwrap();
        let f = &league.fixtures[idx];
        (
            f.home_team_id.clone(),
            f.away_team_id.clone(),
            f.weather.clone(),
            f.importance.clone(),
        )
    };

    let home_data = build_engine_team(game, &home_team_id);
    let away_data = build_engine_team(game, &away_team_id);

    // P2-1: Pass weather and fixture pressure to sparse sim.
    let weather_mods = engine::weather_modifiers_for(&weather_str);
    let pressure_mult = importance.pressure_multiplier();

    let mut rng = rand::rng();
    let result = engine::sparse_sim::simulate_sparse_match(
        &home_data,
        &away_data,
        &mut rng,
        weather_mods.goal_conversion,
        pressure_mult,
    );

    // Apply the result to the fixture.
    let today = game.clock.current_date.format("%Y-%m-%d").to_string();
    if let Some(league) = game.league.as_mut() {
        if let Some(fixture) = league.fixtures.get_mut(idx) {
            fixture.status = FixtureStatus::Completed;
            fixture.result = Some(domain::league::MatchResult {
                home_goals: result.home_score,
                away_goals: result.away_score,
                home_scorers: result.events.iter()
                    .filter(|e| e.side == engine::sparse_sim::SparseSide::Home && e.event_type == engine::sparse_sim::SparseEventType::Goal)
                    .map(|e| domain::league::GoalEvent {
                        player_id: e.player_id.clone(),
                        minute: e.minute,
                    })
                    .collect(),
                away_scorers: result.events.iter()
                    .filter(|e| e.side == engine::sparse_sim::SparseSide::Away && e.event_type == engine::sparse_sim::SparseEventType::Goal)
                    .map(|e| domain::league::GoalEvent {
                        player_id: e.player_id.clone(),
                        minute: e.minute,
                    })
                    .collect(),
                report: None, // Sparse sim doesn't produce a full report
                home_penalties: None,
                away_penalties: None,
            });
        }

        // Update standings.
        if let Some(fixture) = league.fixtures.get(idx) {
            if let Some(result) = &fixture.result {
                let home_id = fixture.home_team_id.clone();
                let away_id = fixture.away_team_id.clone();
                let result_clone = result.clone();
                update_standings_from_result(league, &home_id, &away_id, &result_clone);
            }
        }
    }

    // Apply sparse player stats (goals, assists, cards).
    // P2-2: Credit appearances to ALL players on both teams, not just goal scorers.
    let mut played_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
    for pd in home_data.players.iter().chain(away_data.players.iter()) {
        played_ids.insert(pd.id.clone());
    }
    for player in &mut game.players {
        if played_ids.contains(&player.id) {
            player.stats.appearances += 1;
        }
    }

    // Now apply event-specific stats (goals, assists, cards).
    for event in &result.events {
        if let Some(player) = game.players.iter_mut().find(|p| p.id == event.player_id) {
            match event.event_type {
                engine::sparse_sim::SparseEventType::Goal => {
                    player.stats.goals += 1;
                    // Appearances already credited above — don't double-count
                }
                engine::sparse_sim::SparseEventType::YellowCard => {
                    player.stats.yellow_cards += 1;
                }
                engine::sparse_sim::SparseEventType::RedCard => {
                    player.stats.red_cards += 1;
                }
            }
        }
        if let Some(secondary_id) = &event.secondary_player_id {
            if let Some(player) = game.players.iter_mut().find(|p| &p.id == secondary_id) {
                if event.event_type == engine::sparse_sim::SparseEventType::Goal {
                    player.stats.assists += 1;
                }
            }
        }
    }

    // Deplete stamina for both teams (simplified — flat 15% reduction).
    for player in &mut game.players {
        if player.team_id.as_deref() == Some(&home_team_id)
            || player.team_id.as_deref() == Some(&away_team_id)
        {
            player.condition = player.condition.saturating_sub(15);
        }
    }

    log::debug!(
        "[sparse_sim] {} {}-{} {} ({} events)",
        today,
        result.home_score,
        result.away_score,
        importance.label(),
        result.events.len()
    );
}

/// Update league standings from a match result.
fn update_standings_from_result(
    league: &mut domain::league::League,
    home_team_id: &str,
    away_team_id: &str,
    result: &domain::league::MatchResult,
) {
    for standing in &mut league.standings {
        if standing.team_id == home_team_id {
            standing.played += 1;
            standing.goals_for += result.home_goals as u32;
            standing.goals_against += result.away_goals as u32;
            if result.home_goals > result.away_goals {
                standing.won += 1;
                standing.points += 3;
            } else if result.home_goals == result.away_goals {
                standing.drawn += 1;
                standing.points += 1;
            } else {
                standing.lost += 1;
            }
        } else if standing.team_id == away_team_id {
            standing.played += 1;
            standing.goals_for += result.away_goals as u32;
            standing.goals_against += result.home_goals as u32;
            if result.away_goals > result.home_goals {
                standing.won += 1;
                standing.points += 3;
            } else if result.away_goals == result.home_goals {
                standing.drawn += 1;
                standing.points += 1;
            } else {
                standing.lost += 1;
            }
        }
    }
    // Re-sort standings.
    league.standings.sort_by(|a, b| {
        b.points.cmp(&a.points)
            .then_with(|| b.goals_for.saturating_sub(b.goals_against).cmp(&a.goals_for.saturating_sub(a.goals_against)))
            .then_with(|| b.goals_for.cmp(&a.goals_for))
    });
}

fn simulate_single_match_with_capture<F>(game: &mut Game, idx: usize, on_capture: &mut F)
where
    F: FnMut(StatsState),
{
    let (home_team_id, away_team_id, is_knockout, weather_str, importance) = {
        let league = game.league.as_ref().unwrap();
        let f = &league.fixtures[idx];
        (
            f.home_team_id.clone(),
            f.away_team_id.clone(),
            league.is_knockout_fixture(&f.id),
            f.weather.clone(),
            f.importance.clone(),
        )
    };

    let home_data = build_engine_team(game, &home_team_id);
    let away_data = build_engine_team(game, &away_team_id);
    // V99.4 T1.1: Apply fixture weather to the match config.
    let mut config = engine::MatchConfig::default();
    config.weather = engine::weather_modifiers_for(&weather_str);
    // V99.4 T1.5: Apply fixture importance pressure multiplier.
    config.fixture_pressure_multiplier = importance.pressure_multiplier();
    let mut report = engine::simulate(&home_data, &away_data, &config);
    // A level knockout tie must produce a winner: resolve it with a simulated
    // shootout so the home side no longer advances by default on a draw.
    if is_knockout && report.home_goals == report.away_goals {
        let home_strength = crate::catchup::club_strength(&game.players, &home_team_id);
        let away_strength = crate::catchup::club_strength(&game.players, &away_team_id);
        let (home_pens, away_pens) = crate::national_team::simulate_shootout(
            home_strength,
            away_strength,
            &mut rand::rng(),
        );
        report.home_penalties = Some(home_pens);
        report.away_penalties = Some(away_pens);
    }
    apply_match_report_with_capture(game, idx, &home_team_id, &away_team_id, &report, on_capture);
}
