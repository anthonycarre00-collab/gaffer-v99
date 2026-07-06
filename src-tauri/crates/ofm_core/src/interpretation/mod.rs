// Gaffer Phase 1 — Interpretation Surface
use crate::game::Game;
use domain::player::{MediaSensitivity, Player, PlayerTrait, Position, PressureResponse};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ExplanationEntry { pub reason: String, pub source: Option<String> }
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct ExplanationChain { pub entries: Vec<ExplanationEntry> }
impl ExplanationChain {
    pub fn new() -> Self { Self { entries: Vec::new() } }
    pub fn push(&mut self, reason: impl Into<String>, source: Option<String>) { self.entries.push(ExplanationEntry { reason: reason.into(), source }); }
    pub fn is_empty(&self) -> bool { self.entries.is_empty() }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SpreadsheetAttributes {
    pub pace:u8,pub burst:u8,pub engine:u8,pub power:u8,pub agility:u8,
    pub passing:u8,pub distribution:u8,pub touch:u8,pub finishing:u8,pub defending:u8,pub aerial:u8,
    pub anticipation:u8,pub vision:u8,pub decisions:u8,pub composure:u8,pub leadership:u8,
    pub shot_stopping:u8,pub commanding:u8,pub playing_out:u8,
    pub body_avg:u8,pub ball_avg:u8,pub head_avg:u8,pub gloves_avg:u8,pub overall:u8,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PlayerMeaningSnapshot {
    pub display_name:String,pub club:String,pub role_identity_label:String,pub archetype_label:String,
    pub locker_room_role:String,pub narrative_status_tag:String,
    pub current_form_label:String,pub confidence_label:String,pub fatigue_label:String,
    pub trajectory_label:String,pub stability_label:String,pub stability_description:String,
    pub pressure_response_type:PressureResponse,pub media_sensitivity:MediaSensitivity,
    pub rivalry_trigger_flag:bool,pub morale_state:String,
    pub strongest_positive_link:Option<String>,pub strongest_negative_link:Option<String>,
    pub chemistry_score:i8,pub clique_membership:Vec<String>,
    pub growth_vector:String,pub training_alignment_label:String,pub mentor_bonus_flag:bool,
    pub spreadsheet_attributes:SpreadsheetAttributes,
    pub role_identity_explanation:ExplanationChain,pub stability_explanation:ExplanationChain,
    pub morale_state_explanation:ExplanationChain,pub pressure_response_explanation:ExplanationChain,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SquadMeaningSnapshot {
    pub squad_harmony_score:u8,pub tactical_coherence_score:u8,pub pressure_level:String,
    pub media_heat:u8,pub dressing_room_tension_flag:bool,pub emerging_story_threads:Vec<String>,
    pub chemistry_hotspots:Vec<String>,pub fatigue_risk_band:String,pub identity_alignment_label:String,
    pub harmony_explanation:ExplanationChain,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MatchMeaningSnapshot {
    pub momentum_state:String,pub rivalry_intensity:u8,pub turning_point_event_id:Option<String>,
    pub narrative_shift_label:String,pub pundit_tone_weight:f32,
    pub resurfaced_memory_flag:Option<String>,pub archived_memory_used_flag:Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MediaMeaningSnapshot {
    pub active_story_count:u32,pub top_headline:Option<String>,
    pub pundit_disagreement_active:bool,pub betting_sentiment_trend:String,
}

pub struct InterpretationSurfaceService<'a> { game: &'a Game }
impl<'a> InterpretationSurfaceService<'a> {
    pub fn new(game: &'a Game) -> Self { Self { game } }

    pub fn player_meaning(&self, player_id: &str) -> Option<PlayerMeaningSnapshot> {
        let player = self.game.players.iter().find(|p| p.id == player_id)?;
        Some(self.build_player_snapshot(player))
    }

    pub fn squad_meaning(&self) -> SquadMeaningSnapshot {
        let uid = self.game.manager.team_id.as_deref();
        let squad: Vec<&Player> = self.game.players.iter().filter(|p| p.team_id.as_deref() == uid).collect();
        if squad.is_empty() {
            return SquadMeaningSnapshot { squad_harmony_score:50,tactical_coherence_score:50,pressure_level:"Unknown".into(),media_heat:0,dressing_room_tension_flag:false,emerging_story_threads:vec![],chemistry_hotspots:vec![],fatigue_risk_band:"Unknown".into(),identity_alignment_label:"Unknown".into(),harmony_explanation:ExplanationChain::new() };
        }
        let am: f64 = squad.iter().map(|p| p.morale as f64).sum::<f64>() / squad.len() as f64;
        let ac: f64 = squad.iter().map(|p| p.condition as f64).sum::<f64>() / squad.len() as f64;
        let af: f64 = squad.iter().map(|p| p.fitness as f64).sum::<f64>() / squad.len() as f64;
        let fb = if ac<40.0||af<40.0 {"High"} else if ac<70.0||af<60.0 {"Moderate"} else {"Low"};
        let pl = if am<35.0 {"Crushing"} else if am<55.0 {"High"} else if am<75.0 {"Moderate"} else {"Low"};
        let mut he = ExplanationChain::new();
        he.push(format!("SquadPulse (Phase 1 placeholder) = avg morale = {:.0}", am), Some("squad_pulse_phase1".into()));
        SquadMeaningSnapshot { squad_harmony_score:am.round() as u8,tactical_coherence_score:50,pressure_level:pl.into(),media_heat:0,dressing_room_tension_flag:false,emerging_story_threads:vec![],chemistry_hotspots:vec![],fatigue_risk_band:fb.into(),identity_alignment_label:"Unknown".into(),harmony_explanation:he }
    }

    pub fn match_meaning(&self) -> MatchMeaningSnapshot {
        MatchMeaningSnapshot { momentum_state:"Unknown".into(),rivalry_intensity:0,turning_point_event_id:None,narrative_shift_label:"No active narrative shift".into(),pundit_tone_weight:0.5,resurfaced_memory_flag:None,archived_memory_used_flag:None }
    }

    pub fn media_meaning(&self) -> MediaMeaningSnapshot {
        MediaMeaningSnapshot { active_story_count:0,top_headline:None,pundit_disagreement_active:false,betting_sentiment_trend:"Stable".into() }
    }

    fn build_player_snapshot(&self, player: &Player) -> PlayerMeaningSnapshot {
        let attrs = &player.attributes;
        let overall = if player.ovr > 0 { player.ovr } else { attrs.overall(&player.position) };
        let role_identity_label = self.derive_role_identity(player);
        let mut role_explanation = ExplanationChain::new();
        role_explanation.push(format!("Derived from top attributes (overall = {}).", overall), Some("attribute_overall".into()));
        let archetype_label = player.traits.first().map(trait_label).unwrap_or("Unremarkable").to_string();
        let sl = player.stability_label();
        let mut se = ExplanationChain::new();
        se.push("Stability modifier (hidden) computed from age, overall, form, conscientiousness, injury.".to_string(), Some("stability_formula".into()));
        let ms = morale_state_label(player.morale);
        let mut me = ExplanationChain::new();
        me.push(format!("Morale value: {} / 100.", player.morale), Some("morale_value".into()));
        let pr = player.personality.pressure_response();
        let mut pe = ExplanationChain::new();
        pe.push(format!("PressureResponse from Big Five (E={},C={},N={}).", player.personality.extraversion, player.personality.conscientiousness, player.personality.neuroticism), Some("personality_derivation".into()));
        let msi = player.personality.media_sensitivity();
        let cc = (player.morale as u16 + player.morale_core.manager_trust as u16) / 2;
        let cl = if cc>=80 {"Flying"} else if cc>=65 {"Confident"} else if cc>=45 {"Steady"} else if cc>=25 {"Shaken"} else {"Rock Bottom"};
        let fl = if player.condition>=85&&player.fitness>=70 {"Fresh"} else if player.condition>=65&&player.fitness>=55 {"Match-fit"} else if player.condition>=40||player.fitness>=40 {"Tiring"} else {"Running on Empty"};
        let cfl = if player.stats.avg_rating>=7.5 {"In Form"} else if player.stats.avg_rating>=6.5 {"Steady"} else if player.stats.avg_rating>=5.5 {"Quiet"} else if player.stats.avg_rating>0.0 {"Off the Pace"} else {"No Recent Football"};
        let sa = SpreadsheetAttributes {
            pace:attrs.pace,burst:attrs.burst,engine:attrs.engine,power:attrs.power,agility:attrs.agility,
            passing:attrs.passing,distribution:attrs.distribution,touch:attrs.touch,finishing:attrs.finishing,
            defending:attrs.defending,aerial:attrs.aerial,anticipation:attrs.anticipation,vision:attrs.vision,
            decisions:attrs.decisions,composure:attrs.composure,leadership:attrs.leadership,
            shot_stopping:attrs.shot_stopping,commanding:attrs.commanding,playing_out:attrs.playing_out,
            body_avg:attrs.body_avg(),ball_avg:attrs.ball_avg(),head_avg:attrs.head_avg(),gloves_avg:attrs.gloves_avg(),overall,
        };
        let club = self.game.teams.iter().find(|t| Some(&t.id)==player.team_id.as_ref()).map(|t|t.name.clone()).unwrap_or_else(||"No Club".into());
        PlayerMeaningSnapshot {
            display_name:player.match_name.clone(),club,role_identity_label,archetype_label,
            locker_room_role:"Unknown".into(),narrative_status_tag:"None".into(),
            current_form_label:cfl.to_string(),confidence_label:cl.into(),fatigue_label:fl.into(),
            trajectory_label:"Unknown".into(),stability_label:sl.as_str().to_string(),stability_description:sl.description().to_string(),
            pressure_response_type:pr,media_sensitivity:msi,rivalry_trigger_flag:false,morale_state:ms.into(),
            strongest_positive_link:None,strongest_negative_link:None,chemistry_score:0,clique_membership:vec![],
            growth_vector:"Unknown".into(),training_alignment_label:"Unknown".into(),mentor_bonus_flag:false,
            spreadsheet_attributes:sa,role_identity_explanation:role_explanation,stability_explanation:se,
            morale_state_explanation:me,pressure_response_explanation:pe,
        }
    }

    fn derive_role_identity(&self, player: &Player) -> String {
        let a = &player.attributes;
        let g = player.position.to_group_position();
        let mut c: Vec<(&str, u8)> = match g {
            Position::Goalkeeper => vec![("Shot Stopper",a.shot_stopping),("Sweeper Keeper",a.playing_out),("Commander",a.commanding),("Reflexes",a.agility)],
            Position::Defender => vec![("Ball Winner",a.defending),("Aerial Presence",a.aerial),("Tackler",a.defending),("Ball Player",a.passing),("Recovery Pace",a.pace)],
            Position::Midfielder => vec![("Tempo Setter",a.passing),("Playmaker",a.distribution),("Ball Winner",a.defending),("Engine",a.engine),("Presser",a.burst)],
            Position::Forward => vec![("Finisher",a.finishing),("Dribbler",a.touch),("Pace Threat",a.pace),("Aerial Threat",a.aerial),("Hold-up",a.power)],
            _ => vec![("Unknown",50u8)],
        };
        c.sort_by(|a,b| b.1.cmp(&a.1));
        let t1 = c.first().map(|(l,_)|*l).unwrap_or("Unknown");
        let t2 = c.get(1).map(|(l,_)|*l).unwrap_or(t1);
        if t1==t2 { t1.into() } else { format!("{} / {}",t1,t2) }
    }
}

fn position_name(p:&Position)->&'static str { match p { Position::Goalkeeper=>"Goalkeeper", Position::Defender|Position::RightBack|Position::CenterBack|Position::LeftBack|Position::RightWingBack|Position::LeftWingBack=>"Defender", Position::Midfielder|Position::DefensiveMidfielder|Position::CentralMidfielder|Position::AttackingMidfielder|Position::RightMidfielder|Position::LeftMidfielder=>"Midfielder", Position::Forward|Position::RightWinger|Position::LeftWinger|Position::Striker=>"Forward" } }
fn trait_label(t:&PlayerTrait)->&'static str { match t { PlayerTrait::Speedster=>"Speedster",PlayerTrait::Explosive=>"Explosive",PlayerTrait::Workhorse=>"Workhorse",PlayerTrait::Powerhouse=>"Powerhouse",PlayerTrait::Twisty=>"Twisty",PlayerTrait::Orchestrator=>"Orchestrator",PlayerTrait::Predator=>"Predator",PlayerTrait::VelvetTouch=>"Velvet Touch",PlayerTrait::BallWinner=>"Ball Winner",PlayerTrait::Rock=>"Rock",PlayerTrait::SetPieceSpecialist=>"Set Piece Specialist",PlayerTrait::Leader=>"Leader",PlayerTrait::CoolHead=>"Cool Head",PlayerTrait::Visionary=>"Visionary",PlayerTrait::SafeHands=>"Safe Hands",PlayerTrait::CatReflexes=>"Cat Reflexes",PlayerTrait::Commander=>"Commander",PlayerTrait::CompleteForward=>"Complete Forward",PlayerTrait::EngineRoom=>"Engine Room",PlayerTrait::Wonderkid=>"Wonderkid" } }
fn morale_state_label(m:u8)->&'static str { match m.min(100) { 90..=100=>"Soaring",75..=89=>"Content",55..=74=>"Uneasy",35..=54=>"Deflated",_=>"Toxic" } }

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clock::GameClock;
    use crate::game::Game;
    use domain::manager::Manager;
    use domain::player::{Player, PlayerAttributes, Position};
    use domain::team::Team;

    fn make_test_game() -> Game {
        let clock = GameClock::new(chrono::Utc::now());
        let manager = Manager::new("mgr1".into(),"Test".into(),"Gaffer".into(),"1980-01-01".into(),"GB".into());
        let team = Team::new("team1".into(),"Test FC".into(),"TFC".into(),"England".into(),"London".into(),"Test Stadium".into(),50_000);
        let mut player = Player::new("p1".into(),"John Test".into(),"John Test".into(),"1995-06-15".into(),"GB".into(),Position::Midfielder,PlayerAttributes::defaults());
        player.team_id = Some("team1".into());
        player.morale = 80;
        player.condition = 90;
        let mut game = Game::new(clock,manager,vec![team],vec![player],vec![],vec![]);
        game.manager.team_id = Some("team1".into());
        game
    }

    #[test] fn build_player_snapshot_works() {
        let game = make_test_game();
        let svc = InterpretationSurfaceService::new(&game);
        let snap = svc.player_meaning("p1").expect("player should exist");
        assert_eq!(snap.display_name, "John Test");
        assert_eq!(snap.club, "Test FC");
        assert!(!snap.stability_label.is_empty());
    }

    #[test] fn squad_snapshot_uses_morale_average() {
        let game = make_test_game();
        let svc = InterpretationSurfaceService::new(&game);
        let snap = svc.squad_meaning();
        assert_eq!(snap.squad_harmony_score, 80);
    }

    #[test] fn stability_label_str_matches_expected_gaffer_voice() {
        let mut p = Player::new("x".into(),"x".into(),"x".into(),"2000-01-01".into(),"GB".into(),Position::Forward,PlayerAttributes::defaults());
        p.stability_modifier = 5; assert_eq!(p.stability_label().as_str(), "Roll of the Dice");
        p.stability_modifier = 30; assert_eq!(p.stability_label().as_str(), "Runs Hot and Cold");
        p.stability_modifier = 50; assert_eq!(p.stability_label().as_str(), "Steady Hand");
        p.stability_modifier = 75; assert_eq!(p.stability_label().as_str(), "Trusted Lieutenant");
        p.stability_modifier = 95; assert_eq!(p.stability_label().as_str(), "Mr. Reliable");
    }
}
