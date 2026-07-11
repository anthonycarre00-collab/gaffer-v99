mod message_builders;
mod responses;

pub use responses::{
    PlayerResponseEffect, ResponseBandWeights, ResponseOutcomeBand, apply_player_response,
    build_response_band_weights, pick_response_band,
};

use crate::contracts::{contract_warning_stage, has_let_expire_intent};
use crate::game::Game;
use domain::message::InboxMessage;
use rand::RngExt;

use message_builders::{
    bench_complaint_message, contract_concern_message, happy_player_message, low_morale_message,
    takeover_contract_review_message,
};

fn should_generate_contract_concern(stage: crate::contracts::ContractWarningStage) -> bool {
    !matches!(stage, crate::contracts::ContractWarningStage::TwelveMonths)
}

pub fn generate_takeover_contract_review_message(game: &mut Game) {
    let today = game.clock.current_date.format("%Y-%m-%d").to_string();
    let user_team_id = match game.manager.team_id.as_deref() {
        Some(id) => id,
        None => return,
    };

    let summary_id = format!("contract_review_takeover_{}", user_team_id);
    if game.messages.iter().any(|message| message.id == summary_id) {
        return;
    }

    let current_date = game.clock.current_date.date_naive();
    let mut total_expiring_this_season = 0;
    let mut urgent_contracts = 0;
    let mut final_weeks_contracts = 0;

    for player in &game.players {
        if player.team_id.as_deref() != Some(user_team_id) {
            continue;
        }

        let Some(stage) = contract_warning_stage(player.contract_end.as_deref(), current_date)
        else {
            continue;
        };

        total_expiring_this_season += 1;

        match stage {
            crate::contracts::ContractWarningStage::FinalWeeks => {
                urgent_contracts += 1;
                final_weeks_contracts += 1;
            }
            crate::contracts::ContractWarningStage::ThreeMonths
            | crate::contracts::ContractWarningStage::SixMonths => {
                urgent_contracts += 1;
            }
            crate::contracts::ContractWarningStage::TwelveMonths => {}
        }
    }

    if total_expiring_this_season == 0 {
        return;
    }

    game.messages.push(takeover_contract_review_message(
        &summary_id,
        total_expiring_this_season,
        urgent_contracts,
        final_weeks_contracts,
        &today,
    ));
}

fn talk_cooldown_active(player: &domain::player::Player, today: &str) -> bool {
    player.morale_core.talk_cooldown_until.as_deref() == Some(today)
}

pub fn generate_contract_concern_messages(game: &mut Game, apply_morale_pressure: bool) {
    let today = game.clock.current_date.format("%Y-%m-%d").to_string();
    let user_team_id = match game.manager.team_id.clone() {
        Some(id) => id,
        None => return,
    };
    let current_date = game.clock.current_date.date_naive();
    let existing_ids: std::collections::HashSet<String> = game
        .messages
        .iter()
        .map(|message| message.id.clone())
        .collect();
    let mut new_messages: Vec<InboxMessage> = Vec::new();

    for player in game.players.iter_mut() {
        if player.team_id.as_deref() != Some(&user_team_id) {
            continue;
        }

        if has_let_expire_intent(player) {
            continue;
        }

        let Some(stage) = contract_warning_stage(player.contract_end.as_deref(), current_date)
        else {
            continue;
        };

        if !should_generate_contract_concern(stage) {
            continue;
        }

        let msg_id = format!("contract_concern_{}_{}", player.id, stage.message_suffix());

        if existing_ids.contains(&msg_id) {
            continue;
        }

        if apply_morale_pressure {
            player.morale = (player.morale as i16 - stage.morale_pressure()).clamp(5, 100) as u8;
        }

        if let Some(end_str) = &player.contract_end
            && let Ok(end_date) = chrono::NaiveDate::parse_from_str(end_str, "%Y-%m-%d")
        {
            let days_remaining = (end_date - current_date).num_days();
            new_messages.push(contract_concern_message(
                &msg_id,
                &player.id,
                &player.match_name,
                days_remaining,
                &today,
            ));
        }
    }

    game.messages.extend(new_messages);
}

/// Check all player-related events and generate inbox messages.
/// Called once per day from process_day().
pub fn check_player_events(game: &mut Game) {
    let today = game.clock.current_date.format("%Y-%m-%d").to_string();
    let user_team_id = match game.manager.team_id.clone() {
        Some(id) => id,
        None => return,
    };

    // Collect existing message IDs for deduplication
    let existing_ids: std::collections::HashSet<String> =
        game.messages.iter().map(|m| m.id.clone()).collect();

    let mut new_messages: Vec<InboxMessage> = Vec::new();

    let mut rng = rand::rng();

    // Global daily cap: at most 2 player-initiated messages per day
    let today_message_count = game
        .messages
        .iter()
        .filter(|m| {
            m.date == today
                && (m.id.starts_with("morale_talk_")
                    || m.id.starts_with("bench_complaint_")
                    || m.id.starts_with("happy_player_"))
        })
        .count();
    let daily_cap: usize = 2;

    // --- 1. Low morale meeting requests (morale < 30, 20% daily chance) ---
    for player in game.players.iter() {
        if new_messages.len() + today_message_count >= daily_cap {
            break;
        }
        if player.team_id.as_deref() != Some(&user_team_id) {
            continue;
        }
        if player.injury.is_some() {
            continue;
        }
        if talk_cooldown_active(player, &today) {
            continue;
        }

        let msg_id = format!("morale_talk_{}", player.id);
        if existing_ids.contains(&msg_id) {
            continue;
        }

        if player.morale < 30 && rng.random_range(0..5) == 0 {
            new_messages.push(low_morale_message(
                &msg_id,
                &player.id,
                &player.match_name,
                player.morale,
                &today,
            ));
        }
    }

    // --- 2. Benched player complaints ---
    // Players with zero appearances but decent OVR complain occasionally.
    // Uses appearances count (reliable) instead of unreliable scorer-only tracking.
    if let Some(league) = &game.league {
        let user_matches_played = league
            .fixtures
            .iter()
            .filter(|f| {
                f.status == domain::league::FixtureStatus::Completed
                    && (f.home_team_id == user_team_id || f.away_team_id == user_team_id)
            })
            .count();

        // Only start bench complaints after 5 team matches have been played
        if user_matches_played >= 5 {
            for player in game.players.iter() {
                if new_messages.len() + today_message_count >= daily_cap {
                    break;
                }
                if player.team_id.as_deref() != Some(&user_team_id) {
                    continue;
                }
                if player.injury.is_some() {
                    continue;
                }
                if player.position == domain::player::Position::Goalkeeper {
                    continue;
                }
                if talk_cooldown_active(player, &today) {
                    continue;
                }

                let msg_id = format!("bench_complaint_{}", player.id);
                if existing_ids.contains(&msg_id) {
                    continue;
                }

                let attrs = &player.attributes;
                let ovr = (attrs.pace as u16
                    + attrs.engine as u16
                    + attrs.power as u16
                    + attrs.passing as u16
                    + attrs.finishing as u16
                    + attrs.defending as u16
                    + attrs.touch as u16
                    + attrs.defending as u16
                    + attrs.anticipation as u16
                    + attrs.vision as u16
                    + attrs.decisions as u16)
                    / 11;

                // Player must have decent OVR, low morale, and few appearances
                // relative to team matches. 10% daily chance to avoid flooding.
                let app_ratio = if user_matches_played > 0 {
                    player.stats.appearances as f64 / user_matches_played as f64
                } else {
                    1.0
                };
                if ovr >= 55
                    && player.morale < 50
                    && app_ratio < 0.3
                    && rng.random_range(0..10) == 0
                {
                    new_messages.push(bench_complaint_message(
                        &msg_id,
                        &player.id,
                        &player.match_name,
                        &today,
                    ));
                }
            }
        }
    }

    // --- 3. Happy player / high morale praise (1% daily chance) ---
    {
        for player in game.players.iter() {
            if new_messages.len() + today_message_count >= daily_cap {
                break;
            }
            if player.team_id.as_deref() != Some(&user_team_id) {
                continue;
            }
            if talk_cooldown_active(player, &today) {
                continue;
            }

            let msg_id = format!("happy_player_{}", player.id);
            if existing_ids.contains(&msg_id) {
                continue;
            }

            if player.morale >= 90 && rng.random_range(0..100) == 0 {
                new_messages.push(happy_player_message(
                    &msg_id,
                    &player.id,
                    &player.match_name,
                    &today,
                ));
            }
        }
    }

    game.messages.extend(new_messages);
    generate_contract_concern_messages(game, true);

    // V99.4 T1.3: Check for transfer requests from unhappy star players.
    check_transfer_requests(game, &today);
}

/// V99.4 T1.3: Check if any players want to request a transfer.
///
/// A player requests a transfer when:
/// - OVR >= 70 (good enough to attract interest elsewhere)
/// - Morale < 25 for 30+ consecutive days
/// - Not already transfer-listed by the user
/// - Not already has an active transfer request
///
/// When triggered:
/// - Player is auto-transfer-listed
/// - Inbox message generated ("X wants to leave")
/// - User can refuse → player stays but loses 5 morale/week
pub fn check_transfer_requests(game: &mut Game, today: &str) {
    let user_team_id = match game.manager.team_id.clone() {
        Some(id) => id,
        None => return,
    };

    let mut new_requests: Vec<(String, String)> = Vec::new(); // (player_id, player_name)

    for player in &mut game.players {
        // Only check players on the user's team.
        if player.team_id.as_deref() != Some(&user_team_id) {
            continue;
        }
        // Skip if already has a transfer request or is already transfer-listed.
        if player.transfer_request_date.is_some() || player.transfer_listed {
            // Still track low_morale_days so the user knows the situation
            // isn't improving.
            if player.morale < 25 {
                player.low_morale_days = player.low_morale_days.saturating_add(1);
            } else {
                player.low_morale_days = 0;
            }
            continue;
        }
        // Only star players (OVR >= 70) request transfers.
        if player.ovr < 70 {
            player.low_morale_days = 0;
            continue;
        }

        // Track consecutive low-morale days.
        if player.morale < 25 {
            player.low_morale_days = player.low_morale_days.saturating_add(1);
        } else {
            player.low_morale_days = 0;
        }

        // After 30 days of low morale, request a transfer.
        if player.low_morale_days >= 30 {
            player.transfer_request_date = Some(today.to_string());
            player.transfer_listed = true;
            new_requests.push((player.id.clone(), player.match_name.clone()));
        }
    }

    // Generate inbox messages for each new transfer request.
    for (player_id, player_name) in new_requests {
        let msg_id = format!("transfer_request_{}_{}", today, player_id);
        // Check for duplicate.
        if game.messages.iter().any(|m| m.id == msg_id) {
            continue;
        }

        game.messages.push(InboxMessage {
            id: msg_id,
            subject: format!("{} wants to leave", player_name),
            body: format!(
                "{} has been unhappy for over a month now, and he's had enough. \
                 He's requested a transfer and has been placed on the transfer \
                 list. You can try to improve his morale, or accept his request \
                 and look for a buyer.",
                player_name
            ),
            sender: "Assistant Manager".to_string(),
            sender_role: "Staff".to_string(),
            date: today.to_string(),
            category: domain::message::MessageCategory::PlayerMorale,
            priority: domain::message::MessagePriority::High,
            context: domain::message::MessageContext {
                team_id: Some(user_team_id.clone()),
                team_name: None,
                player_id: Some(player_id.clone()),
                fixture_id: None,
                match_result: None,
            },
            actions: vec![],
            read: false,
            subject_key: None,
            body_key: None,
            sender_key: None,
            sender_role_key: None,
            i18n_params: std::collections::HashMap::new(),
        });
    }
}
