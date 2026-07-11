use rand::{Rng, RngExt};

use crate::event::{EventDetail, EventType, MatchEvent};
use crate::shared::{
    PlayStylePhase, PlayerSnap, TraitContext, burst_modifier, leadership_modifier,
    morale_modifier, play_style_modifier, role_attribute_modifier,
    stability_pressure_modifier, tactics_buildup_mod, tactics_cross_probability,
    tactics_defensive_conversion_mod, tactics_foul_modifier, tactics_shape_modifier,
    tactics_tempo_progression, trait_bonus,
};
use crate::types::{Position, Side, Zone};

use super::LiveMatchState;
use super::helpers::{danger_band, foul_severity, save_quality};

// ---------------------------------------------------------------------------
// Action resolution
// ---------------------------------------------------------------------------

impl LiveMatchState {
    pub(super) fn resolve_action<R: Rng>(&mut self, minute: u8, rng: &mut R) -> Vec<MatchEvent> {
        let att_side = self.possession;
        let def_side = att_side.opposite();
        let zone = self.ball_zone;

        if zone.is_box_for(att_side) {
            self.resolve_shot(minute, att_side, rng, false)
        } else if zone == Zone::attacking_third(att_side) {
            self.resolve_attacking_third(minute, att_side, def_side, rng)
        } else if zone == Zone::Midfield {
            self.resolve_midfield(minute, att_side, def_side, rng)
        } else {
            self.resolve_buildup(minute, att_side, def_side, rng)
        }
    }

    fn resolve_buildup<R: Rng>(
        &mut self,
        minute: u8,
        att_side: Side,
        def_side: Side,
        rng: &mut R,
    ) -> Vec<MatchEvent> {
        let mut events = Vec::new();
        let passer = self.snap_player(att_side, Position::Defender, rng);
        // V99.3 ARCH-1 C2: Apply morale modifier (buildup doesn't normally
        // have pressure situations, so no stability mod here — matches the
        // engine path).
        let passer_morale_mod = crate::shared::morale_modifier(passer.morale);
        let pass_skill = self.condition_adjusted_skill(
            &passer.id,
            (passer.passing as f64
                + passer.vision as f64
                + passer.composure as f64
                + passer.teamwork as f64)
                / 4.0,
        ) * trait_bonus(&passer, TraitContext::Passing)
            * passer_morale_mod;
        let press = self.effective_press(def_side);
        let ball_zone = self.ball_zone;

        let buildup_mod = tactics_buildup_mod(&self.team_ref(att_side).tactics);

        // V99: Wire `playing_out` — when the ball is in the defensive third
        // (typically after a goal kick or GK save), the keeper's distribution
        // skill affects how cleanly the team plays out from the back.
        let playing_out_mod = if ball_zone == Zone::defensive_third(att_side) {
            let gk = self.snap_player(att_side, Position::Goalkeeper, rng);
            1.0 + (gk.playing_out as f64 - 50.0) / 1000.0
        } else {
            1.0
        };

        let success_chance = (pass_skill * 1.3 * buildup_mod * playing_out_mod)
            / (pass_skill * 1.3 * buildup_mod * playing_out_mod + press)
            * self.config.weather.pass_success;
        if rng.random_range(0.0..1.0f64) < success_chance {
            let evt = MatchEvent::new(minute, EventType::PassCompleted, att_side, ball_zone)
                .with_player(&passer.id);
            self.events.push(evt.clone());
            events.push(evt);
            self.ball_zone = Zone::Midfield;
        } else {
            let interceptor = self.snap_player(def_side, Position::Midfielder, rng);
            let evt1 = MatchEvent::new(minute, EventType::PassIntercepted, att_side, ball_zone)
                .with_player(&passer.id);
            let evt2 = MatchEvent::new(minute, EventType::Interception, def_side, ball_zone)
                .with_player(&interceptor.id);
            self.events.push(evt1.clone());
            self.events.push(evt2.clone());
            events.push(evt1);
            events.push(evt2);
            self.possession = def_side;
        }
        events
    }

    fn resolve_midfield<R: Rng>(
        &mut self,
        minute: u8,
        att_side: Side,
        def_side: Side,
        rng: &mut R,
    ) -> Vec<MatchEvent> {
        let mut events = Vec::new();
        let attacker = self.snap_player(att_side, Position::Midfielder, rng);
        let defender = self.snap_player(def_side, Position::Midfielder, rng);

        let att_raw = (attacker.touch as f64
            + attacker.passing as f64
            + attacker.vision as f64
            + attacker.teamwork as f64)
            / 4.0;
        let def_raw = (defender.defending as f64
            + defender.anticipation as f64
            + defender.decisions as f64
            + defender.teamwork as f64)
            / 4.0;
        let att_rating = self.condition_adjusted_skill(&attacker.id, att_raw)
            * trait_bonus(&attacker, TraitContext::Midfield)
            * crate::shared::morale_modifier(attacker.morale);
        let def_rating = self.condition_adjusted_skill(&defender.id, def_raw)
            * trait_bonus(&defender, TraitContext::Tackling)
            * crate::shared::morale_modifier(defender.morale);

        let att_mod = play_style_modifier(
            self.team_ref(att_side).play_style,
            PlayStylePhase::Midfield,
            true,
        ) * role_attribute_modifier(attacker.role, PlayStylePhase::Midfield);
        let def_mod = play_style_modifier(
            self.team_ref(def_side).play_style,
            PlayStylePhase::Midfield,
            false,
        ) * role_attribute_modifier(defender.role, PlayStylePhase::Defense);
        let att_eff = att_rating
            * att_mod
            * crate::shared::home_mod(att_side, &self.config)
            * tactics_tempo_progression(&self.team_ref(att_side).tactics);
        let def_eff = def_rating * def_mod * crate::shared::home_mod(def_side, &self.config);
        let success = att_eff / (att_eff + def_eff);

        if rng.random_range(0.0..1.0f64) < success {
            let evt = MatchEvent::new(minute, EventType::PassCompleted, att_side, Zone::Midfield)
                .with_player(&attacker.id);
            self.events.push(evt.clone());
            events.push(evt);
            // V99: Offside check — driven by attacker decisions + defender anticipation.
            let offside_chance = 0.04
                * (1.0 - (attacker.decisions as f64 - 50.0) / 200.0)
                * (1.0 + (defender.anticipation as f64 - 50.0) / 200.0);
            if rng.random_range(0.0..1.0f64) < offside_chance.clamp(0.01, 0.12) {
                let off_evt = MatchEvent::new(minute, EventType::Offside, att_side, Zone::Midfield)
                    .with_player(&attacker.id);
                self.events.push(off_evt.clone());
                events.push(off_evt);
                self.possession = def_side;
                self.ball_zone = Zone::defensive_third(att_side);
            } else {
                self.ball_zone = Zone::attacking_third(att_side);
            }
        } else {
            if rng.random_range(0.0..1.0f64) < 0.6 {
                let evt = MatchEvent::new(minute, EventType::Tackle, def_side, Zone::Midfield)
                    .with_player(&defender.id);
                self.events.push(evt.clone());
                events.push(evt);
                let foul_mod = tactics_foul_modifier(&self.team_ref(def_side).tactics);
                let foul_events =
                    self.maybe_foul(minute, def_side, &attacker, &defender, Zone::Midfield, rng, foul_mod);
                let fouled = foul_events.iter().any(|e| e.event_type == EventType::Foul);
                events.extend(foul_events);
                if fouled {
                    // Fouled team (att_side) retains possession for the free kick
                    self.possession = att_side;
                    self.ball_zone = Zone::Midfield;
                    return events;
                }
            } else {
                let evt =
                    MatchEvent::new(minute, EventType::Interception, def_side, Zone::Midfield)
                        .with_player(&defender.id);
                self.events.push(evt.clone());
                events.push(evt);
            }
            self.possession = def_side;
            self.ball_zone = Zone::Midfield;
        }
        events
    }

    fn resolve_attacking_third<R: Rng>(
        &mut self,
        minute: u8,
        att_side: Side,
        def_side: Side,
        rng: &mut R,
    ) -> Vec<MatchEvent> {
        let mut events = Vec::new();
        let attacker = self.snap_player(att_side, Position::Forward, rng);
        let defender = self.snap_player(def_side, Position::Defender, rng);
        let pressure = self.is_pressure_situation(minute);

        let att_raw = (attacker.touch as f64
            + attacker.pace as f64
            + attacker.agility as f64
            + attacker.composure as f64)
            / 4.0;
        let def_raw = (defender.defending as f64
            + defender.power as f64
            + defender.anticipation as f64
            + defender.aerial as f64)
            / 4.0;
        // V99: Apply burst_modifier to dribbling + leadership_modifier to
        // defending under pressure. Also apply stability + morale modifiers
        // for consistency with the simple engine path.
        // V99.3 ARCH-1 C2: Added morale_modifier (was missing in live path).
        let captain_leadership = self.team_captain_leadership(def_side);
        let att_rating = self.condition_adjusted_skill(&attacker.id, att_raw)
            * trait_bonus(&attacker, TraitContext::Dribbling)
            * burst_modifier(attacker.burst)
            * stability_pressure_modifier(attacker.stability, pressure)
            * morale_modifier(attacker.morale);
        let def_rating = self.condition_adjusted_skill(&defender.id, def_raw)
            * trait_bonus(&defender, TraitContext::Tackling)
            * leadership_modifier(captain_leadership, pressure)
            * stability_pressure_modifier(defender.stability, pressure)
            * morale_modifier(defender.morale);

        let att_mod = play_style_modifier(
            self.team_ref(att_side).play_style,
            PlayStylePhase::Attack,
            true,
        ) * role_attribute_modifier(attacker.role, PlayStylePhase::Attack);
        let def_mod = play_style_modifier(
            self.team_ref(def_side).play_style,
            PlayStylePhase::Defense,
            false,
        ) * role_attribute_modifier(defender.role, PlayStylePhase::Defense);
        let att_eff = att_rating * att_mod * crate::shared::home_mod(att_side, &self.config);
        let def_eff = def_rating
            * def_mod
            * crate::shared::home_mod(def_side, &self.config)
            * tactics_shape_modifier(&self.team_ref(def_side).tactics);
        let success = att_eff / (att_eff + def_eff);
        let zone = Zone::attacking_third(att_side);
        let cross_prob = tactics_cross_probability(&self.team_ref(att_side).tactics);

        if rng.random_range(0.0..1.0f64) < success {
            let evt = MatchEvent::new(minute, EventType::Dribble, att_side, zone)
                .with_player(&attacker.id);
            self.events.push(evt.clone());
            events.push(evt);
            if rng.random_range(0.0..1.0f64) < cross_prob {
                let winger_id = attacker.id.clone();
                let cross_evt = MatchEvent::new(minute, EventType::Cross, att_side, zone)
                    .with_player(&winger_id);
                self.events.push(cross_evt.clone());
                events.push(cross_evt);
                // V99.4 T1.2: Crosses can be met by defenders and midfielders too.
                let header_pos = {
                    let roll = rng.random_range(0.0..1.0f64);
                    if roll < 0.20 { Position::Defender }
                    else if roll < 0.50 { Position::Midfielder }
                    else { Position::Forward }
                };
                let header = self.snap_player(att_side, header_pos, rng);
                let def_header = self.snap_player(def_side, Position::Defender, rng);
                let aerial_att = header.aerial as f64;
                let aerial_def = def_header.aerial as f64;
                let aerial_win = aerial_att / (aerial_att + aerial_def);
                if rng.random_range(0.0..1.0f64) < aerial_win {
                    // V99: Emit HeaderWon event.
                    let hdr_evt = MatchEvent::new(minute, EventType::HeaderWon, att_side, zone)
                        .with_player(&header.id)
                        .with_secondary(&def_header.id);
                    self.events.push(hdr_evt.clone());
                    events.push(hdr_evt);
                    self.ball_zone = Zone::attacking_box(att_side);
                    let shot_events = self.resolve_shot(minute, att_side, rng, true);
                    events.extend(shot_events);
                } else {
                    // V99: Emit HeaderLost event.
                    let hdr_evt = MatchEvent::new(minute, EventType::HeaderLost, att_side, zone)
                        .with_player(&header.id)
                        .with_secondary(&def_header.id);
                    self.events.push(hdr_evt.clone());
                    events.push(hdr_evt);
                    let clear_evt =
                        MatchEvent::new(minute, EventType::Clearance, def_side, zone)
                            .with_player(&def_header.id);
                    self.events.push(clear_evt.clone());
                    events.push(clear_evt);
                    self.possession = def_side;
                    self.ball_zone = Zone::defensive_third(att_side);
                }
            } else {
                self.ball_zone = Zone::attacking_box(att_side);
            }
        } else {
            let is_tackle = rng.random_range(0.0..1.0f64) < 0.5;
            let fouled = if is_tackle {
                let evt1 = MatchEvent::new(minute, EventType::DribbleTackled, att_side, zone)
                    .with_player(&attacker.id)
                    .with_secondary(&defender.id);
                let evt2 = MatchEvent::new(minute, EventType::Tackle, def_side, zone)
                    .with_player(&defender.id);
                self.events.push(evt1.clone());
                self.events.push(evt2.clone());
                events.push(evt1);
                events.push(evt2);
                let foul_mod = tactics_foul_modifier(&self.team_ref(def_side).tactics);
                let foul_events =
                    self.maybe_foul(minute, def_side, &attacker, &defender, zone, rng, foul_mod);
                let was_fouled = foul_events.iter().any(|e| e.event_type == EventType::Foul);
                events.extend(foul_events);
                was_fouled
            } else {
                let evt = MatchEvent::new(minute, EventType::Clearance, def_side, zone)
                    .with_player(&defender.id);
                self.events.push(evt.clone());
                events.push(evt);
                false
            };
            if fouled {
                // Fouled team (att_side) retains possession for the free kick in the attacking third
                self.possession = att_side;
                self.ball_zone = zone;
                return events;
            }
            if rng.random_range(0.0..1.0f64) < 0.25 {
                let evt = MatchEvent::new(minute, EventType::Corner, att_side, zone);
                self.events.push(evt.clone());
                events.push(evt);
                if rng.random_range(0.0..1.0f64) < 0.30 {
                    self.ball_zone = Zone::attacking_box(att_side);
                    return events;
                }
            }
            self.possession = def_side;
            self.ball_zone = Zone::defensive_third(att_side);
        }
        events
    }

    /// V99.4 T1.2: is_set_piece affects shooter position selection.
    fn resolve_shot<R: Rng>(&mut self, minute: u8, att_side: Side, rng: &mut R, is_set_piece: bool) -> Vec<MatchEvent> {
        let mut events = Vec::new();
        let def_side = att_side.opposite();
        let zone = Zone::attacking_box(att_side);

        // Box foul rate fixed at 3.6% per shot — independent of foul_probability (which tunes outfield fouls)
        if rng.random_range(0.0..1.0f64) < 0.036 {
            let fouler = self.snap_player(def_side, Position::Defender, rng);
            let fouled = self.snap_player(att_side, Position::Forward, rng);
            let foul_evt = MatchEvent::new(minute, EventType::Foul, def_side, zone)
                .with_player(&fouler.id)
                .with_secondary(&fouled.id)
                .with_detail(EventDetail::Foul {
                    severity: foul_severity(fouler.aggression),
                });
            self.events.push(foul_evt.clone());
            events.push(foul_evt);

            if rng.random_range(0.0..1.0f64) < self.config.penalty_probability {
                let pen_evt =
                    MatchEvent::new(minute, EventType::PenaltyAwarded, att_side, zone);
                self.events.push(pen_evt.clone());
                events.push(pen_evt);
                let pen_events = self.resolve_in_match_penalty(minute, att_side, rng);
                events.extend(pen_events);
                let card_events = self.maybe_card(minute, def_side, &fouler.id.clone(), zone, rng);
                events.extend(card_events);
                self.ball_zone = Zone::Midfield;
                self.possession = def_side;
                return events;
            }
            let card_events = self.maybe_card(minute, def_side, &fouler.id.clone(), zone, rng);
            events.extend(card_events);
            // Foul but no penalty: advantage played, shot continues
        }

        // V99.4 T1.2: Pick shooter position based on weighted probabilities.
        let shooter_pos = {
            let roll = rng.random_range(0.0..1.0f64);
            if is_set_piece {
                if roll < 0.30 { Position::Defender }
                else if roll < 0.60 { Position::Midfielder }
                else { Position::Forward }
            } else {
                if roll < 0.20 { Position::Midfielder }
                else { Position::Forward }
            }
        };
        let shooter = self.snap_player(att_side, shooter_pos, rng);
        let assister = self.snap_player(att_side, Position::Midfielder, rng);
        let goalkeeper = self.snap_player(def_side, Position::Goalkeeper, rng);

        // V99.3 ARCH-1 C2: Apply stability + morale modifiers to the live
        // match path. Previously these were ONLY applied in the engine path
        // (CPU-vs-CPU matches) — the OPPOSITE of intended design. User-played
        // matches (live) should be where morale and clutch performance matter
        // most, but they were being ignored. A striker on 100 morale vs 0
        // morale scored at the same rate; a legendary clutch keeper (stability
        // 100) performed identically to a flake (stability 0) under 89th-
        // minute pressure.
        let pressure = self.is_pressure_situation(minute);
        let shoot_stability_mod =
            crate::shared::stability_pressure_modifier(shooter.stability, pressure);
        let shoot_morale_mod = crate::shared::morale_modifier(shooter.morale);
        let gk_stability_mod =
            crate::shared::stability_pressure_modifier(goalkeeper.stability, pressure);
        let gk_morale_mod = crate::shared::morale_modifier(goalkeeper.morale);

        let shoot_raw =
            (shooter.finishing as f64 + shooter.composure as f64 + shooter.decisions as f64) / 3.0;
        let shoot_rating = self.condition_adjusted_skill(&shooter.id, shoot_raw)
            * trait_bonus(&shooter, TraitContext::Shooting)
            * shoot_stability_mod
            * shoot_morale_mod;
        let gk_raw = (goalkeeper.shot_stopping as f64
            + goalkeeper.commanding as f64
            + goalkeeper.anticipation as f64)
            / 3.0;
        let gk_rating = self.condition_adjusted_skill(&goalkeeper.id, gk_raw)
            * trait_bonus(&goalkeeper, TraitContext::Goalkeeping)
            * gk_stability_mod
            * gk_morale_mod;

        let accuracy =
            (self.config.shot_accuracy_base + (shoot_rating - 50.0) / 200.0).clamp(0.15, 0.85);

        if rng.random_range(0.0..1.0f64) > accuracy {
            let detail = EventDetail::Shot {
                danger: danger_band(shoot_rating),
            };
            if rng.random_range(0.0..1.0f64) < 0.4 {
                let evt = MatchEvent::new(minute, EventType::ShotBlocked, att_side, zone)
                    .with_player(&shooter.id)
                    .with_detail(detail);
                self.events.push(evt.clone());
                events.push(evt);
                self.ball_zone = Zone::Midfield;
                self.possession = def_side;
            } else {
                let evt = MatchEvent::new(minute, EventType::ShotOffTarget, att_side, zone)
                    .with_player(&shooter.id)
                    .with_detail(detail);
                self.events.push(evt.clone());
                events.push(evt);
                let gk_evt = MatchEvent::new(minute, EventType::GoalKick, def_side, zone);
                self.events.push(gk_evt.clone());
                events.push(gk_evt);
                self.ball_zone = Zone::defensive_third(def_side);
                self.possession = def_side;
            }
            return events;
        }

        let def_line_mod = tactics_defensive_conversion_mod(&self.team_ref(def_side).tactics);
        let conversion = (self.config.goal_conversion_base * def_line_mod + (shoot_rating - gk_rating) / 150.0)
            .clamp(0.10, 0.70)
            * self.config.weather.goal_conversion;

        if rng.random_range(0.0..1.0f64) < conversion {
            let context = self.goal_context(att_side);
            let evt = MatchEvent::new(minute, EventType::Goal, att_side, zone)
                .with_player(&shooter.id)
                .with_secondary(&assister.id)
                .with_detail(EventDetail::Goal { context });
            self.events.push(evt.clone());
            events.push(evt);
            self.add_goal(att_side);
            self.ball_zone = Zone::Midfield;
            self.possession = def_side;
        } else {
            let evt = MatchEvent::new(minute, EventType::ShotSaved, att_side, zone)
                .with_player(&shooter.id)
                .with_detail(EventDetail::Save {
                    quality: save_quality(gk_rating),
                });
            self.events.push(evt.clone());
            events.push(evt);
            // 40% of saves → corner (keeper parries wide), 60% → goal kick (keeper catches)
            if rng.random_range(0.0..1.0f64) < 0.40 {
                let corner_evt = MatchEvent::new(minute, EventType::Corner, att_side, zone);
                self.events.push(corner_evt.clone());
                events.push(corner_evt);
                self.possession = att_side;
                self.ball_zone = Zone::attacking_box(att_side);
            } else {
                let gk_evt = MatchEvent::new(minute, EventType::GoalKick, def_side, zone);
                self.events.push(gk_evt.clone());
                events.push(gk_evt);
                self.ball_zone = Zone::defensive_third(def_side);
                self.possession = def_side;
            }
        }

        events
    }

    // -----------------------------------------------------------------------
    // Foul / card / penalty
    // -----------------------------------------------------------------------

    pub(super) fn maybe_foul<R: Rng>(
        &mut self,
        minute: u8,
        fouling_side: Side,
        fouled: &PlayerSnap,
        fouler: &PlayerSnap,
        zone: Zone,
        rng: &mut R,
        tactics_mod: f64,
    ) -> Vec<MatchEvent> {
        let mut events = Vec::new();

        let aggression_mod = fouler.aggression as f64 / 100.0;
        let foul_chance = self.config.foul_probability
            * (0.6 + aggression_mod * 0.8)
            * trait_bonus(fouler, TraitContext::Foul)
            * tactics_mod;
        if rng.random_range(0.0..1.0f64) >= foul_chance {
            return events;
        }

        let evt = MatchEvent::new(minute, EventType::Foul, fouling_side, zone)
            .with_player(&fouler.id)
            .with_secondary(&fouled.id)
            .with_detail(EventDetail::Foul {
                severity: foul_severity(fouler.aggression),
            });
        self.events.push(evt.clone());
        events.push(evt);

        let att_side = fouling_side.opposite();

        if zone.is_box_for(att_side)
            && rng.random_range(0.0..1.0f64) < self.config.penalty_probability
        {
            let evt = MatchEvent::new(minute, EventType::PenaltyAwarded, att_side, zone);
            self.events.push(evt.clone());
            events.push(evt);
            let pen_events = self.resolve_in_match_penalty(minute, att_side, rng);
            events.extend(pen_events);
        } else {
            let evt = MatchEvent::new(minute, EventType::FreeKick, att_side, zone);
            self.events.push(evt.clone());
            events.push(evt);
        }

        let card_events = self.maybe_card(minute, fouling_side, &fouler.id, zone, rng);
        events.extend(card_events);

        if rng.random_range(0.0..1.0f64) < self.config.injury_probability {
            let evt =
                MatchEvent::new(minute, EventType::Injury, att_side, zone).with_player(&fouled.id);
            self.events.push(evt.clone());
            events.push(evt);
        }

        events
    }

    pub(super) fn maybe_card<R: Rng>(
        &mut self,
        minute: u8,
        side: Side,
        fouler_id: &str,
        zone: Zone,
        rng: &mut R,
    ) -> Vec<MatchEvent> {
        let mut events = Vec::new();

        let aggression_factor = self
            .team_ref(side)
            .players
            .iter()
            .find(|p| p.id == fouler_id)
            .map(|p| p.aggression as f64 / 100.0)
            .unwrap_or(0.5);
        let card_chance = self.config.yellow_card_probability * (0.5 + aggression_factor);
        if rng.random_range(0.0..1.0f64) >= card_chance {
            return events;
        }

        if rng.random_range(0.0..1.0f64) < self.config.red_card_probability {
            let evt =
                MatchEvent::new(minute, EventType::RedCard, side, zone).with_player(fouler_id);
            self.events.push(evt.clone());
            events.push(evt);
            self.sent_off.insert(fouler_id.to_string());
            return events;
        }

        let current_yellows = self.yellows.entry(fouler_id.to_string()).or_insert(0);
        *current_yellows += 1;

        if *current_yellows >= 2 {
            let evt =
                MatchEvent::new(minute, EventType::SecondYellow, side, zone).with_player(fouler_id);
            self.events.push(evt.clone());
            events.push(evt);
            self.sent_off.insert(fouler_id.to_string());
        } else {
            let evt =
                MatchEvent::new(minute, EventType::YellowCard, side, zone).with_player(fouler_id);
            self.events.push(evt.clone());
            events.push(evt);
        }

        events
    }
}

#[cfg(test)]
mod event_detail_tests {
    use rand::SeedableRng;
    use rand::rngs::StdRng;

    use crate::event::{EventDetail, EventType, GoalContext};
    use crate::live_match::LiveMatchState;
    use crate::types::{MatchConfig, PlayStyle, PlayerData, Position, TeamData};

    fn make_player(id: &str, pos: Position) -> PlayerData {
        PlayerData {
            id: id.to_string(),
            name: id.to_string(),
            position: pos,
            ovr: 70,
            condition: 90,
            fitness: 75,
            pace: 70,
            engine: 70,
            power: 70,
            agility: 70,
            passing: 70,
            finishing: 70,
            defending: 70,
            touch: 70,
            anticipation: 70,
            vision: 70,
            decisions: 70,
            composure: 70,
            aggression: 70,
            teamwork: 70,
            leadership: 70,
            shot_stopping: 70,
            aerial: 70,
            traits: vec![],
            role: crate::types::PlayerRole::Standard,
            burst: 50,
            distribution: 50,
            commanding: 50,
            playing_out: 50,
            stability: 50,
            morale: 75,
        }
    }

    fn make_team(id: &str) -> TeamData {
        TeamData {
            id: id.to_string(),
            name: id.to_string(),
            formation: "4-4-2".to_string(),
            play_style: PlayStyle::Balanced,
            tactics: crate::types::TacticsConfig::default(),
            players: vec![
                make_player(&format!("{id}_gk"), Position::Goalkeeper),
                make_player(&format!("{id}_d1"), Position::Defender),
                make_player(&format!("{id}_d2"), Position::Defender),
                make_player(&format!("{id}_d3"), Position::Defender),
                make_player(&format!("{id}_d4"), Position::Defender),
                make_player(&format!("{id}_m1"), Position::Midfielder),
                make_player(&format!("{id}_m2"), Position::Midfielder),
                make_player(&format!("{id}_m3"), Position::Midfielder),
                make_player(&format!("{id}_m4"), Position::Midfielder),
                make_player(&format!("{id}_f1"), Position::Forward),
                make_player(&format!("{id}_f2"), Position::Forward),
            ],
        }
    }

    /// The first goal of any match must be classified as `Opener` because both
    /// scores are 0 at that point.
    #[test]
    fn first_goal_detail_is_opener() {
        // Try multiple seeds and validate the invariant whenever a goal appears.
        let mut saw_any_goal = false;
        for seed in 0u64..500 {
            let mut state = LiveMatchState::new(
                make_team("home"),
                make_team("away"),
                MatchConfig::default(),
                vec![],
                vec![],
                false,
            );
            let mut rng = StdRng::seed_from_u64(seed);

            // Step minute-by-minute until finished or the first scoring event
            // appears. A `PenaltyGoal` can score before any open-play `Goal` and
            // updates the score, so the first open-play goal is only guaranteed
            // to be an `Opener` when nothing scored before it.
            let first_scoring = loop {
                let result = state.step_minute(&mut rng);
                let scoring = result
                    .events
                    .iter()
                    .find(|e| matches!(e.event_type, EventType::Goal | EventType::PenaltyGoal))
                    .cloned();
                if let Some(evt) = scoring {
                    break Some(evt);
                }
                if result.is_finished {
                    break None;
                }
            };

            if let Some(first_evt) = first_scoring
                && first_evt.event_type == EventType::Goal
            {
                assert_eq!(
                    first_evt.detail,
                    Some(EventDetail::Goal {
                        context: GoalContext::Opener
                    }),
                    "seed {seed}: first goal detail should be Opener, got {:?}",
                    first_evt.detail
                );
                saw_any_goal = true;
            }
            // No goal scored in this seed — try the next one.
        }
        assert!(
            saw_any_goal,
            "No goal was scored in 500 seeds; increase seed range or check engine config"
        );
    }
}
