use rand::{Rng, RngExt};

use crate::event::{EventType, MatchEvent};
use crate::shared::{
    PlayStylePhase, TraitContext, burst_modifier, home_mod, leadership_modifier, morale_modifier,
    play_style_modifier, role_attribute_modifier, stability_pressure_modifier, tactics_buildup_mod,
    tactics_cross_probability, tactics_defensive_conversion_mod, tactics_foul_modifier,
    tactics_pressing_press, tactics_shape_modifier, tactics_tempo_progression, trait_bonus,
};
use crate::types::{Position, Side, Zone};

use super::MatchContext;
use super::fouls::{self, maybe_foul};
use super::snap_player;

/// V99.4 T1.2: Pick a shooter position based on weighted probabilities.
/// Open play: 80% Forward, 20% Midfielder.
/// Set piece (corner/free kick): 40% Forward, 30% Midfielder, 30% Defender.
/// Real football: defenders score ~10-15% (mostly from set pieces),
/// midfielders ~25-30%, forwards ~55-60%.
fn pick_shooter_position<R: Rng>(rng: &mut R, is_set_piece: bool) -> Position {
    let roll = rng.random_range(0.0..1.0f64);
    if is_set_piece {
        // Set piece: 30% Defender, 30% Midfielder, 40% Forward
        if roll < 0.30 {
            Position::Defender
        } else if roll < 0.60 {
            Position::Midfielder
        } else {
            Position::Forward
        }
    } else {
        // Open play: 20% Midfielder, 80% Forward
        if roll < 0.20 {
            Position::Midfielder
        } else {
            Position::Forward
        }
    }
}

/// V99: Get the leadership rating of the team's captain (first player in the
/// starting XI with the highest leadership). Returns 50 (neutral) if no
/// captain can be identified.
/// V99.3 ARCH-1 C3: Exclude sent-off players — a red-carded captain
/// shouldn't still contribute leadership from the dressing room.
/// V99.4 T3.4: Respect the user-designated captain if set and on pitch.
fn team_captain_leadership(ctx: &MatchContext, side: Side) -> u8 {
    let team = ctx.team(side);
    // V99.4 T3.4: If a captain is designated, use their leadership (if on pitch + not sent off).
    if let Some(captain_id) = &team.captain_id {
        if let Some(captain) = team.players.iter().find(|p| &p.id == captain_id) {
            if !ctx.sent_off.contains(captain_id) {
                return captain.leadership;
            }
        }
    }
    // Fallback: max leadership among non-sent-off players.
    team.players
        .iter()
        .filter(|p| !ctx.sent_off.contains(&p.id))
        .map(|p| p.leadership)
        .max()
        .unwrap_or(50)
}

// ---------------------------------------------------------------------------
// Pressure detection — late game with close score = pressure situation
// ---------------------------------------------------------------------------

fn is_pressure_situation(ctx: &MatchContext, minute: u8) -> bool {
    // Pressure kicks in after 70 minutes when the score is within 1 goal
    if minute < 70 {
        return false;
    }
    let goal_diff = (ctx.home_score as i16 - ctx.away_score as i16).abs();
    goal_diff <= 1
}

// ---------------------------------------------------------------------------
// Action resolution per zone
// ---------------------------------------------------------------------------

pub(super) fn resolve_action<R: Rng>(ctx: &mut MatchContext, minute: u8, rng: &mut R) {
    let att_side = ctx.possession;
    let def_side = att_side.opposite();
    let zone = ctx.ball_zone;

    if zone.is_box_for(att_side) {
        resolve_shot(ctx, minute, att_side, rng, false);
        // resolve_shot manages ball_zone and possession for all outcomes
    } else if zone == Zone::attacking_third(att_side) {
        resolve_attacking_third(ctx, minute, att_side, def_side, rng);
    } else if zone == Zone::Midfield {
        resolve_midfield(ctx, minute, att_side, def_side, rng);
    } else {
        resolve_buildup(ctx, minute, att_side, def_side, rng);
    }
}

// ---------------------------------------------------------------------------
// Zone-specific resolution
// ---------------------------------------------------------------------------

fn resolve_buildup<R: Rng>(
    ctx: &mut MatchContext,
    minute: u8,
    att_side: Side,
    def_side: Side,
    rng: &mut R,
) {
    let passer = snap_player(ctx, att_side, Position::Defender, rng);
    let pass_skill = (passer.passing as f64
        + passer.vision as f64
        + passer.composure as f64
        + passer.teamwork as f64)
        / 4.0
        * trait_bonus(&passer, TraitContext::Passing)
        * morale_modifier(passer.morale);
    let press = effective_press(ctx, def_side);
    let ball_zone = ctx.ball_zone;

    let buildup_mod = tactics_buildup_mod(&ctx.team(att_side).tactics) * ctx.team(att_side).tactics_multiplier;

    // V99: Wire `playing_out` — when the ball is in the defensive third
    // (typically after a goal kick or GK save), the keeper's distribution
    // skill affects how cleanly the team plays out from the back. A
    // sweeper-keeper with high playing_out makes the first pass safer;
    // a poor distributor puts the defender under pressure.
    let playing_out_mod = if ball_zone == Zone::defensive_third(att_side) {
        let gk = snap_player(ctx, att_side, Position::Goalkeeper, rng);
        // 0.95 (poor distributor) .. 1.05 (sweeper-keeper)
        1.0 + (gk.playing_out as f64 - 50.0) / 1000.0
    } else {
        1.0
    };

    let success_chance = (pass_skill * 1.3 * buildup_mod * playing_out_mod)
        / (pass_skill * 1.3 * buildup_mod * playing_out_mod + press)
        * ctx.config.weather.pass_success;
    if rng.random_range(0.0..1.0f64) < success_chance {
        ctx.emit(
            MatchEvent::new(minute, EventType::PassCompleted, att_side, ball_zone)
                .with_player(&passer.id),
        );
        ctx.ball_zone = Zone::Midfield;
    } else {
        let interceptor = snap_player(ctx, def_side, Position::Midfielder, rng);
        ctx.emit(
            MatchEvent::new(minute, EventType::PassIntercepted, att_side, ball_zone)
                .with_player(&passer.id),
        );
        ctx.emit(
            MatchEvent::new(minute, EventType::Interception, def_side, ball_zone)
                .with_player(&interceptor.id),
        );
        ctx.possession = def_side;
    }
}

fn resolve_midfield<R: Rng>(
    ctx: &mut MatchContext,
    minute: u8,
    att_side: Side,
    def_side: Side,
    rng: &mut R,
) {
    let attacker = snap_player(ctx, att_side, Position::Midfielder, rng);
    let defender = snap_player(ctx, def_side, Position::Midfielder, rng);

    let att_rating = (attacker.touch as f64
        + attacker.passing as f64
        + attacker.vision as f64
        + attacker.teamwork as f64)
        / 4.0
        * trait_bonus(&attacker, TraitContext::Midfield)
        * morale_modifier(attacker.morale);
    let def_rating = (defender.defending as f64
        + defender.anticipation as f64
        + defender.decisions as f64
        + defender.teamwork as f64)
        / 4.0
        * trait_bonus(&defender, TraitContext::Tackling)
        * morale_modifier(defender.morale);

    let att_mod = play_style_modifier(
        ctx.team(att_side).play_style,
        PlayStylePhase::Midfield,
        true,
    ) * role_attribute_modifier(attacker.role, PlayStylePhase::Midfield)
        * ctx.team(att_side).tactics_multiplier;
    let def_mod = play_style_modifier(
        ctx.team(def_side).play_style,
        PlayStylePhase::Midfield,
        false,
    ) * role_attribute_modifier(defender.role, PlayStylePhase::Defense)
        * ctx.team(def_side).tactics_multiplier;
    let att_eff = att_rating
        * att_mod
        * home_mod(att_side, ctx.config)
        * tactics_tempo_progression(&ctx.team(att_side).tactics);
    let def_eff = def_rating * def_mod * home_mod(def_side, ctx.config);
    let success = att_eff / (att_eff + def_eff);

    if rng.random_range(0.0..1.0f64) < success {
        ctx.emit(
            MatchEvent::new(minute, EventType::PassCompleted, att_side, Zone::Midfield)
                .with_player(&attacker.id),
        );
        // V99: Offside check — when the ball is played into the attacking
        // third, there's a small chance the linesman flags. Driven by the
        // attacker's decisions (lower = more likely to mistime the run)
        // and the defender's anticipation (higher = better at holding the line).
        let offside_chance = 0.04 // base 4% chance
            * (1.0 - (attacker.decisions as f64 - 50.0) / 200.0) // -25% at 100 decisions
            * (1.0 + (defender.anticipation as f64 - 50.0) / 200.0); // +25% at 100 anticipation
        if rng.random_range(0.0..1.0f64) < offside_chance.clamp(0.01, 0.12) {
            ctx.emit(
                MatchEvent::new(minute, EventType::Offside, att_side, Zone::Midfield)
                    .with_player(&attacker.id),
            );
            // Offside = turnover to the defending side, goal kick.
            ctx.possession = def_side;
            ctx.ball_zone = Zone::defensive_third(att_side);
        } else {
            ctx.ball_zone = Zone::attacking_third(att_side);
        }
    } else {
        if rng.random_range(0.0..1.0f64) < 0.6 {
            ctx.emit(
                MatchEvent::new(minute, EventType::Tackle, def_side, Zone::Midfield)
                    .with_player(&defender.id),
            );
            let foul_mod = tactics_foul_modifier(&ctx.team(def_side).tactics);
            let fouled = maybe_foul(
                ctx,
                minute,
                def_side,
                &attacker,
                &defender,
                Zone::Midfield,
                rng,
                foul_mod,
            );
            if fouled {
                // Fouled team (att_side) retains possession for the free kick
                ctx.possession = att_side;
                ctx.ball_zone = Zone::Midfield;
                return;
            }
        } else {
            ctx.emit(
                MatchEvent::new(minute, EventType::Interception, def_side, Zone::Midfield)
                    .with_player(&defender.id),
            );
        }
        ctx.possession = def_side;
        ctx.ball_zone = Zone::Midfield;
    }
}

fn resolve_attacking_third<R: Rng>(
    ctx: &mut MatchContext,
    minute: u8,
    att_side: Side,
    def_side: Side,
    rng: &mut R,
) {
    let pressure = is_pressure_situation(ctx, minute);
    let attacker = snap_player(ctx, att_side, Position::Forward, rng);
    let defender = snap_player(ctx, def_side, Position::Defender, rng);

    // V99: Apply burst_modifier to dribbling — burst is the first-5-yards
    // acceleration that beats a defender in 1v1. Separate from pace (top speed).
    let att_rating = (attacker.touch as f64
        + attacker.pace as f64
        + attacker.agility as f64
        + attacker.composure as f64)
        / 4.0
        * trait_bonus(&attacker, TraitContext::Dribbling)
        * morale_modifier(attacker.morale)
        * stability_pressure_modifier(attacker.stability, pressure)
        * burst_modifier(attacker.burst);
    // V99: Apply leadership_modifier to the defender under pressure — the
    // captain's voice organises the back line when the chips are down.
    let captain_leadership = team_captain_leadership(ctx, def_side);
    let def_rating = (defender.defending as f64
        + defender.power as f64
        + defender.anticipation as f64
        + defender.aerial as f64)
        / 4.0
        * trait_bonus(&defender, TraitContext::Tackling)
        * morale_modifier(defender.morale)
        * stability_pressure_modifier(defender.stability, pressure)
        * leadership_modifier(captain_leadership, pressure);

    let att_mod = play_style_modifier(ctx.team(att_side).play_style, PlayStylePhase::Attack, true)
        * role_attribute_modifier(attacker.role, PlayStylePhase::Attack)
        * ctx.team(att_side).tactics_multiplier;
    let def_mod = play_style_modifier(
        ctx.team(def_side).play_style,
        PlayStylePhase::Defense,
        false,
    ) * role_attribute_modifier(defender.role, PlayStylePhase::Defense)
        * ctx.team(def_side).tactics_multiplier;
    let att_eff = att_rating * att_mod * home_mod(att_side, ctx.config);
    let def_eff = def_rating
        * def_mod
        * home_mod(def_side, ctx.config)
        * tactics_shape_modifier(&ctx.team(def_side).tactics);
    let success = att_eff / (att_eff + def_eff);
    let zone = Zone::attacking_third(att_side);
    let cross_prob = tactics_cross_probability(&ctx.team(att_side).tactics);

    if rng.random_range(0.0..1.0f64) < success {
        ctx.emit(
            MatchEvent::new(minute, EventType::Dribble, att_side, zone).with_player(&attacker.id),
        );
        if rng.random_range(0.0..1.0f64) < cross_prob {
            ctx.emit(
                MatchEvent::new(minute, EventType::Cross, att_side, zone).with_player(&attacker.id),
            );
            // V99.4 T1.2: Crosses can be met by defenders and midfielders too.
            // 50% Forward, 30% Midfielder, 20% Defender.
            let header_pos = {
                let roll = rng.random_range(0.0..1.0f64);
                if roll < 0.20 { Position::Defender }
                else if roll < 0.50 { Position::Midfielder }
                else { Position::Forward }
            };
            let header = snap_player(ctx, att_side, header_pos, rng);
            let def_header = snap_player(ctx, def_side, Position::Defender, rng);
            let aerial_att = header.aerial as f64;
            let aerial_def = def_header.aerial as f64;
            let aerial_win = aerial_att / (aerial_att + aerial_def);
            if rng.random_range(0.0..1.0f64) < aerial_win {
                // V99: Emit HeaderWon event for the aerial duel.
                ctx.emit(
                    MatchEvent::new(minute, EventType::HeaderWon, att_side, zone)
                        .with_player(&header.id)
                        .with_secondary(&def_header.id),
                );
                ctx.ball_zone = Zone::attacking_box(att_side);
                resolve_shot(ctx, minute, att_side, rng, true);
            } else {
                // V99: Emit HeaderLost event for the attacker.
                ctx.emit(
                    MatchEvent::new(minute, EventType::HeaderLost, att_side, zone)
                        .with_player(&header.id)
                        .with_secondary(&def_header.id),
                );
                ctx.emit(
                    MatchEvent::new(minute, EventType::Clearance, def_side, zone)
                        .with_player(&def_header.id),
                );
                ctx.possession = def_side;
                ctx.ball_zone = Zone::defensive_third(att_side);
            }
        } else {
            ctx.ball_zone = Zone::attacking_box(att_side);
        }
    } else {
        let is_tackle = rng.random_range(0.0..1.0f64) < 0.5;
        let fouled = if is_tackle {
            ctx.emit(
                MatchEvent::new(minute, EventType::DribbleTackled, att_side, zone)
                    .with_player(&attacker.id)
                    .with_secondary(&defender.id),
            );
            ctx.emit(
                MatchEvent::new(minute, EventType::Tackle, def_side, zone)
                    .with_player(&defender.id),
            );
            maybe_foul(ctx, minute, def_side, &attacker, &defender, zone, rng, tactics_foul_modifier(&ctx.team(def_side).tactics))
        } else {
            ctx.emit(
                MatchEvent::new(minute, EventType::Clearance, def_side, zone)
                    .with_player(&defender.id),
            );
            false
        };
        if fouled {
            // Fouled team (att_side) retains possession for the free kick in the attacking third
            ctx.possession = att_side;
            ctx.ball_zone = zone;
            return;
        }
        if rng.random_range(0.0..1.0f64) < 0.25 {
            ctx.emit(MatchEvent::new(minute, EventType::Corner, att_side, zone));
            if rng.random_range(0.0..1.0f64) < 0.30 {
                ctx.ball_zone = Zone::attacking_box(att_side);
                return;
            }
        }
        ctx.possession = def_side;
        ctx.ball_zone = Zone::defensive_third(att_side);
    }
}

/// V99.4 T1.2: is_set_piece affects shooter position selection.
/// Set pieces (after cross/corner): 30% DEF, 30% MID, 40% FWD.
/// Open play: 20% MID, 80% FWD.
fn resolve_shot<R: Rng>(ctx: &mut MatchContext, minute: u8, att_side: Side, rng: &mut R, is_set_piece: bool) {
    let def_side = att_side.opposite();
    let zone = Zone::attacking_box(att_side);

    // Box foul rate fixed at 3.6% per shot — independent of foul_probability (which tunes outfield fouls)
    if rng.random_range(0.0..1.0f64) < 0.036 {
        let fouler = snap_player(ctx, def_side, Position::Defender, rng);
        let fouled = snap_player(ctx, att_side, Position::Forward, rng);
        ctx.emit(
            MatchEvent::new(minute, EventType::Foul, def_side, zone)
                .with_player(&fouler.id)
                .with_secondary(&fouled.id),
        );
        if rng.random_range(0.0..1.0f64) < ctx.config.penalty_probability {
            ctx.emit(MatchEvent::new(minute, EventType::PenaltyAwarded, att_side, zone));
            fouls::resolve_penalty(ctx, minute, att_side, rng);
            fouls::maybe_card(ctx, minute, def_side, &fouler.id, zone, rng);
            ctx.ball_zone = Zone::Midfield;
            ctx.possession = def_side;
            return;
        }
        fouls::maybe_card(ctx, minute, def_side, &fouler.id, zone, rng);
        // Foul but no penalty: advantage played, shot continues
    }

    let shooter = snap_player(ctx, att_side, pick_shooter_position(rng, is_set_piece), rng);
    let assister = snap_player(ctx, att_side, Position::Midfielder, rng);
    let goalkeeper = snap_player(ctx, def_side, Position::Goalkeeper, rng);

    let att_cond = if att_side == Side::Home { ctx.home_condition } else { ctx.away_condition };
    let def_cond = if def_side == Side::Home { ctx.home_condition } else { ctx.away_condition };

    let pressure = is_pressure_situation(ctx, minute);
    // V99.4 T1.5: Scale stability modifier by fixture importance pressure.
    // In a cup final, a clutch keeper (stability 100) performs even better
    // relative to a flake (stability 0) than in a league match.
    let pressure_mult = ctx.config.fixture_pressure_multiplier;
    let stability_mod = if pressure {
        // Pressure situation: scale the stability modifier by fixture importance.
        1.0 + (stability_pressure_modifier(shooter.stability, true) - 1.0) * pressure_mult
    } else {
        stability_pressure_modifier(shooter.stability, false)
    };
    let morale_mod = morale_modifier(shooter.morale);

    let shoot_rating =
        (shooter.finishing as f64 + shooter.composure as f64 + shooter.decisions as f64) / 3.0
            * trait_bonus(&shooter, TraitContext::Shooting)
            * att_cond
            * stability_mod
            * morale_mod
            * shooter.partnership_bonus; // V99.4 T2.2: +0-2% for established partnerships
    let gk_stability_mod = if pressure {
        1.0 + (stability_pressure_modifier(goalkeeper.stability, true) - 1.0) * pressure_mult
    } else {
        stability_pressure_modifier(goalkeeper.stability, false)
    };
    let gk_morale_mod = morale_modifier(goalkeeper.morale);
    let gk_rating =
        (goalkeeper.shot_stopping as f64 + goalkeeper.commanding as f64 + goalkeeper.anticipation as f64)
            / 3.0
            * trait_bonus(&goalkeeper, TraitContext::Goalkeeping)
            * def_cond
            * gk_stability_mod
            * gk_morale_mod;

    let accuracy =
        (ctx.config.shot_accuracy_base + (shoot_rating - 50.0) / 200.0).clamp(0.15, 0.85);

    if rng.random_range(0.0..1.0f64) > accuracy {
        if rng.random_range(0.0..1.0f64) < 0.4 {
            ctx.emit(
                MatchEvent::new(minute, EventType::ShotBlocked, att_side, zone)
                    .with_player(&shooter.id),
            );
            // Blocked shot: ball stays in area, defender clears to midfield
            ctx.possession = def_side;
            ctx.ball_zone = Zone::Midfield;
        } else {
            ctx.emit(
                MatchEvent::new(minute, EventType::ShotOffTarget, att_side, zone)
                    .with_player(&shooter.id),
            );
            ctx.emit(MatchEvent::new(minute, EventType::GoalKick, def_side, zone));
            ctx.possession = def_side;
            ctx.ball_zone = Zone::defensive_third(def_side);
        }
        return;
    }

    let def_line_mod = tactics_defensive_conversion_mod(&ctx.team(def_side).tactics);
    let conversion =
        (ctx.config.goal_conversion_base * def_line_mod + (shoot_rating - gk_rating) / 150.0)
            .clamp(0.10, 0.70)
            * ctx.config.weather.goal_conversion;

    if rng.random_range(0.0..1.0f64) < conversion {
        ctx.emit(
            MatchEvent::new(minute, EventType::Goal, att_side, zone)
                .with_player(&shooter.id)
                .with_secondary(&assister.id),
        );
        ctx.add_goal(att_side);
        ctx.possession = def_side;
        ctx.ball_zone = Zone::Midfield;
    } else {
        ctx.emit(
            MatchEvent::new(minute, EventType::ShotSaved, att_side, zone).with_player(&shooter.id),
        );
        // 40% of saves → corner (keeper parries wide), 60% → goal kick (keeper catches)
        if rng.random_range(0.0..1.0f64) < 0.40 {
            ctx.emit(MatchEvent::new(minute, EventType::Corner, att_side, zone));
            ctx.possession = att_side;
            ctx.ball_zone = Zone::attacking_box(att_side);
        } else {
            ctx.emit(MatchEvent::new(minute, EventType::GoalKick, def_side, zone));
            ctx.possession = def_side;
            ctx.ball_zone = Zone::defensive_third(def_side);
        }
    }
}

// ---------------------------------------------------------------------------
// Rating helpers
// ---------------------------------------------------------------------------

pub(super) fn effective_midfield(ctx: &MatchContext, side: Side) -> f64 {
    // V99.10 C6: Use midfield_rating_excluding to filter sent-off players.
    // Previously a 10-man team kept the same midfield rating for possession
    // contests, making red cards cosmetic.
    let base = ctx.team(side).midfield_rating_excluding(&ctx.sent_off);
    let modifier = play_style_modifier(ctx.team(side).play_style, PlayStylePhase::Midfield, true);
    base * modifier * home_mod(side, ctx.config)
}

fn effective_press(ctx: &MatchContext, pressing_side: Side) -> f64 {
    let team = ctx.team(pressing_side);
    // V99.10 C6: Use position_attr_avg_excluding to filter sent-off.
    let base = team.position_attr_avg_excluding(Position::Midfielder, |p| {
        ((p.engine as u16 + p.defending as u16 + p.pace as u16) / 3) as u8
    }, &ctx.sent_off);
    let modifier = play_style_modifier(team.play_style, PlayStylePhase::Press, true);
    base * modifier
        * tactics_pressing_press(&team.tactics)
        * home_mod(pressing_side, ctx.config)
}
