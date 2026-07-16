use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Position — mirrors domain::player::Position but kept independent
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
pub enum Position {
    #[default]
    Goalkeeper,
    Defender,
    Midfielder,
    Forward,
}

// ---------------------------------------------------------------------------
// PlayStyle — mirrors domain::team::PlayStyle
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum PlayStyle {
    #[default]
    Balanced,
    Attacking,
    Defensive,
    Possession,
    Counter,
    HighPress,
}

// ---------------------------------------------------------------------------
// PlayerRole — mirrors domain::team::PlayerRole, kept independent
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum PlayerRole {
    // Goalkeeper
    #[default]
    Standard,
    BallPlayingKeeper,
    SweeperKeeper,
    // Center Back
    Stopper,
    CoverCB,
    BallPlayingCB,
    // Full Back / Wing Back
    AttackingFB,
    DefensiveFB,
    InvertedFB,
    WingBack,
    // Defensive Midfielder
    AnchorMan,
    BallWinner,
    DeepLyingPlaymaker,
    // Central Midfielder
    BoxToBox,
    Carrilero,
    Mezzala,
    // Attacking Midfielder
    AdvancedPlaymaker,
    ShadowStriker,
    // Wide
    WideForward,
    InsideForward,
    InvertedWinger,
    // Striker
    Poacher,
    TargetMan,
    DeepLyingForward,
    False9,
    PressingForward,
    CompleteForward,
}

// ---------------------------------------------------------------------------
// PlayerData — a snapshot of a player for engine consumption
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PlayerData {
    pub id: String,
    pub name: String,
    pub position: Position,
    #[serde(default)]
    pub ovr: u8,
    pub condition: u8, // 0-100
    /// Long-term physical shape (0-100). Multiplies engine depletion rate in-match.
    #[serde(default = "default_fitness")]
    pub fitness: u8,

    // The Body (5) — Gaffer Phase 4 migrated attrs
    pub pace: u8,
    #[serde(default = "default_engine_attr")]
    pub burst: u8,
    pub engine: u8,
    pub power: u8,
    #[serde(default = "default_engine_attr")]
    pub agility: u8,

    // The Ball (6)
    pub passing: u8,
    #[serde(default = "default_engine_attr")]
    pub distribution: u8,
    pub touch: u8,
    pub finishing: u8,
    pub defending: u8,
    #[serde(default = "default_engine_attr")]
    pub aerial: u8,

    // The Head (5)
    pub anticipation: u8,
    pub vision: u8,
    pub decisions: u8,
    #[serde(default = "default_engine_attr")]
    pub composure: u8,
    #[serde(default = "default_engine_attr")]
    pub leadership: u8,

    // Personality-derived (kept for engine simulation — populated from Big Five in bridge code)
    #[serde(default = "default_engine_attr")]
    pub aggression: u8,  // Derived from personality.neuroticism
    #[serde(default = "default_engine_attr")]
    pub teamwork: u8,    // Derived from personality.agreeableness
    /// Gaffer Phase 6 — stability modifier (0-100, hidden). Affects clutch/choke
    /// under pressure. High stability = performs better in big matches/rivalries.
    /// Low stability = prone to mistakes under pressure.
    #[serde(default = "default_stability")]
    pub stability: u8,
    /// Gaffer — player morale (0-100). Affects effort and decision-making.
    #[serde(default = "default_engine_attr")]
    pub morale: u8,

    // The Gloves (3, GK)
    #[serde(default = "default_engine_attr")]
    pub shot_stopping: u8,
    #[serde(default = "default_engine_attr")]
    pub commanding: u8,
    #[serde(default = "default_engine_attr")]
    pub playing_out: u8,

    // Traits (string names matching domain::player::PlayerTrait variants)
    #[serde(default)]
    pub traits: Vec<String>,

    #[serde(default)]
    pub role: PlayerRole,

    /// V99.4 T2.2: Partnership bonus multiplier (1.0 = no bonus, up to 1.02).
    /// Computed from the player's goal+assist partnerships with teammates.
    /// When a partnership exceeds 20+ combined goals, apply +2% boost.
    #[serde(default = "default_partnership_bonus")]
    pub partnership_bonus: f64,
}

fn default_partnership_bonus() -> f64 {
    1.0
}

fn default_engine_attr() -> u8 {
    50
}

fn default_stability() -> u8 {
    50
}

fn default_fitness() -> u8 {
    75
}

impl PlayerData {
    /// Overall rating — V99.4 A2: Now simply returns the pre-computed `ovr`
    /// field instead of recalculating from attributes. The domain layer's
    /// `refresh_player_derived` computes the canonical position-weighted OVR
    /// and stores it on `player.ovr`; this is copied to `PlayerData.ovr` at
    /// build time. Using a different formula here caused the AI substitution
    /// logic to disagree with the player profile display.
    pub fn overall(&self) -> f64 {
        self.ovr as f64
    }

    /// Effective rating accounting for current condition (0-100).
    pub fn effective_overall(&self) -> f64 {
        self.overall() * (self.condition as f64 / 100.0)
    }
}

// ---------------------------------------------------------------------------
// TacticsConfig — tactical settings that influence simulation modifiers
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum PressingIntensity {
    Passive,
    #[default]
    Medium,
    Aggressive,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum DefensiveLine {
    VeryLow,
    Low,
    #[default]
    Medium,
    High,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum TacticsPitchWidth {
    Narrow,
    #[default]
    Normal,
    Wide,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum TacticsBuildUpStyle {
    Short,
    #[default]
    Mixed,
    Long,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum MarkingStyle {
    #[default]
    Zonal,
    Mixed,
    ManToMan,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum Tempo {
    Patient,
    #[default]
    Direct,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum DefensiveShape {
    Stretched,
    #[default]
    Normal,
    Compact,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum CounterPressDuration {
    #[default]
    None,
    Short,
    Long,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum BreakSpeed {
    Slow,
    #[default]
    Medium,
    Fast,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TacticsConfig {
    pub pressing_intensity: PressingIntensity,
    pub defensive_line: DefensiveLine,
    pub width: TacticsPitchWidth,
    pub build_up_style: TacticsBuildUpStyle,
    pub marking_style: MarkingStyle,
    // Phase-blueprint dials added on top of the original five. Each defaults to
    // the neutral option so existing `TacticsConfig::default()` callers and
    // serialized saves are unaffected.
    #[serde(default)]
    pub tempo: Tempo,
    #[serde(default)]
    pub defensive_shape: DefensiveShape,
    #[serde(default)]
    pub counter_press_duration: CounterPressDuration,
    #[serde(default)]
    pub break_speed: BreakSpeed,
}

// ---------------------------------------------------------------------------
// TeamData — everything the engine needs to know about one side
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TeamData {
    pub id: String,
    pub name: String,
    pub formation: String,
    pub play_style: PlayStyle,
    pub players: Vec<PlayerData>,
    #[serde(default)]
    pub tactics: TacticsConfig,
    /// V99.4 T1.7: Manager tactical acumen multiplier (0.90–1.08).
    /// Scales all tactics modifiers for this team. Higher = tactics are
    /// more effective. Set from the AI manager's personality.
    #[serde(default = "default_tactics_mult")]
    pub tactics_multiplier: f64,
    /// V99.4 T3.4: User-designated captain's player ID. The engine uses
    /// this player's leadership for the captain modifier (instead of just
    /// picking max leadership). None = fall back to max leadership.
    #[serde(default)]
    pub captain_id: Option<String>,
}

fn default_tactics_mult() -> f64 {
    1.0
}

impl TeamData {
    /// Count players by position.
    pub fn count_position(&self, pos: Position) -> usize {
        self.players.iter().filter(|p| p.position == pos).count()
    }

    /// Average of a specific attribute among players in the given position.
    pub fn position_attr_avg(&self, pos: Position, attr_fn: fn(&PlayerData) -> u8) -> f64 {
        let players: Vec<_> = self.players.iter().filter(|p| p.position == pos).collect();
        if players.is_empty() {
            return 40.0; // fallback
        }
        players.iter().map(|p| attr_fn(p) as f64).sum::<f64>() / players.len() as f64
    }

    /// V99.10 C6: Same as `position_attr_avg` but excludes sent-off players.
    ///
    /// Previously `position_attr_avg` (and the derived `midfield_rating`,
    /// `effective_midfield`, `effective_press`) did NOT filter `sent_off`,
    /// so a 10-man team kept the same midfield/defense rating for possession
    /// contests. Red cards were cosmetic — the numerical disadvantage was
    /// not reflected in the simulation.
    ///
    /// This variant takes a `sent_off: &HashSet<String>` and filters out
    /// any player whose ID is in the set. Callers that have access to the
    /// match's `sent_off` set should prefer this over `position_attr_avg`.
    pub fn position_attr_avg_excluding(
        &self,
        pos: Position,
        attr_fn: fn(&PlayerData) -> u8,
        sent_off: &std::collections::HashSet<String>,
    ) -> f64 {
        let players: Vec<_> = self
            .players
            .iter()
            .filter(|p| p.position == pos && !sent_off.contains(&p.id))
            .collect();
        if players.is_empty() {
            return 40.0; // fallback — same as position_attr_avg
        }
        players.iter().map(|p| attr_fn(p) as f64).sum::<f64>() / players.len() as f64
    }

    /// V99.10 C6: Midfield rating excluding sent-off players.
    pub fn midfield_rating_excluding(
        &self,
        sent_off: &std::collections::HashSet<String>,
    ) -> f64 {
        self.position_attr_avg_excluding(Position::Midfielder, |p| {
            ((p.passing as u16 + p.distribution as u16 + p.vision as u16 + p.engine as u16) / 4) as u8
        }, sent_off)
    }

    /// Composite midfield rating.
    pub fn midfield_rating(&self) -> f64 {
        self.position_attr_avg(Position::Midfielder, |p| {
            ((p.passing as u16 + p.distribution as u16 + p.vision as u16 + p.engine as u16) / 4) as u8
        })
    }

    // V99.10 Item 29: Removed dead `defense_rating()`, `attack_rating()`,
    // and `goalkeeper_rating()` methods. These were never called by any
    // production code — only by tests (simulation_tests.rs:105-117). The
    // tests have been updated to use `midfield_rating` + `position_attr_avg`
    // directly. `midfield_rating` stays because it's called by
    // `effective_midfield` in both live and simple engines.
}

// ---------------------------------------------------------------------------
// MatchConfig — tuneable simulation parameters
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchConfig {
    /// Multiplier applied to the home team's ratings (e.g. 1.08 = 8% boost).
    pub home_advantage: f64,
    /// Base probability that a shot from the box is on target (0.0–1.0).
    pub shot_accuracy_base: f64,
    /// Base probability that an on-target shot beats the keeper (0.0–1.0).
    pub goal_conversion_base: f64,
    /// Per-minute fatigue factor applied to condition.
    pub fatigue_per_minute: f64,
    /// Probability of a foul on any defensive action (0.0–1.0).
    pub foul_probability: f64,
    /// Probability a foul results in a yellow card.
    pub yellow_card_probability: f64,
    /// Probability a yellow-card foul is upgraded to red (second yellow or serious foul).
    pub red_card_probability: f64,
    /// Probability that a foul inside the attacking box is adjudicated as a penalty kick.
    /// Conditional on a box foul occurring — not a per-game rate. ~50% in real football.
    pub penalty_probability: f64,
    /// Minutes of stoppage time per half (0 = none).
    pub stoppage_time_max: u8,
    /// Probability of an injury per foul event.
    pub injury_probability: f64,
    /// V99.4 T1.1: Weather modifiers for this match. All 1.0 = no effect.
    #[serde(default = "default_weather_modifiers")]
    pub weather: WeatherModifiers,
    /// V99.4 T1.5: Fixture importance pressure multiplier (1.0 = standard league).
    /// Scales stability_pressure_modifier + leadership_modifier in the match engine.
    /// Cup finals = 1.8, Continental finals = 2.0, Massive = 2.5.
    #[serde(default = "default_fixture_pressure")]
    pub fixture_pressure_multiplier: f64,
}

/// V99.4 T1.1: Weather modifiers applied to match simulation.
/// Each modifier is a multiplier (1.0 = no effect).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeatherModifiers {
    /// Multiplier for pass success rate. Rain: ~0.95
    pub pass_success: f64,
    /// Multiplier for cross accuracy. Wind: ~0.90
    pub cross_accuracy: f64,
    /// Multiplier for fatigue rate. Heat: ~1.25
    pub fatigue: f64,
    /// Multiplier for long ball effectiveness. Fog: ~1.15
    pub long_ball: f64,
    /// Multiplier for goal conversion. Heavy rain: ~0.92
    pub goal_conversion: f64,
}

impl Default for WeatherModifiers {
    fn default() -> Self {
        Self {
            pass_success: 1.0,
            cross_accuracy: 1.0,
            fatigue: 1.0,
            long_ball: 1.0,
            goal_conversion: 1.0,
        }
    }
}

fn default_weather_modifiers() -> WeatherModifiers {
    WeatherModifiers::default()
}

fn default_fixture_pressure() -> f64 {
    1.0
}

/// V99.4 T1.1: Resolve a weather condition string into WeatherModifiers.
/// Matches the frontend weather.ts module.
pub fn weather_modifiers_for(condition: &str) -> WeatherModifiers {
    match condition {
        "clear" | "cloudy" | "" => WeatherModifiers::default(),
        "rain" => WeatherModifiers {
            pass_success: 0.95,
            cross_accuracy: 0.92,
            fatigue: 1.05,
            long_ball: 1.05,
            goal_conversion: 0.97,
        },
        "heavy_rain" => WeatherModifiers {
            pass_success: 0.88,
            cross_accuracy: 0.85,
            fatigue: 1.10,
            long_ball: 1.10,
            goal_conversion: 0.92,
        },
        "snow" => WeatherModifiers {
            pass_success: 0.90,
            cross_accuracy: 0.88,
            fatigue: 1.15,
            long_ball: 1.08,
            goal_conversion: 0.90,
        },
        "fog" => WeatherModifiers {
            pass_success: 0.93,
            cross_accuracy: 0.90,
            fatigue: 1.0,
            long_ball: 1.15,
            goal_conversion: 1.0,
        },
        "hot" => WeatherModifiers {
            pass_success: 0.98,
            cross_accuracy: 0.98,
            fatigue: 1.25,
            long_ball: 1.0,
            goal_conversion: 1.02,
        },
        "cold" => WeatherModifiers {
            pass_success: 0.97,
            cross_accuracy: 0.97,
            fatigue: 1.08,
            long_ball: 1.03,
            goal_conversion: 0.98,
        },
        "windy" => WeatherModifiers {
            pass_success: 0.96,
            cross_accuracy: 0.88,
            fatigue: 1.03,
            long_ball: 1.08,
            goal_conversion: 0.98,
        },
        _ => WeatherModifiers::default(),
    }
}

impl Default for MatchConfig {
    fn default() -> Self {
        Self {
            // V99.3 REALISM-1 M8: Home advantage 1.08 → 1.12. Real EPL
            // home-win/away-win ratio is ~1.64×; 1.08 was slightly low.
            home_advantage: 1.12,
            shot_accuracy_base: 0.35,
            // V99.3 REALISM-1 M1: Goal conversion 0.36 → 0.30. Was producing
            // ~3.0 goals/match; real-world average is ~2.5. The 0.06 drop
            // should bring it closer to the target.
            goal_conversion_base: 0.30,
            fatigue_per_minute: 0.20,
            foul_probability: 0.40,
            // V99.3 REALISM-1 M2: Card probabilities reduced. Was producing
            // ~4.4 yellows + ~0.18 reds per match; real-world is ~3.5
            // yellows + ~0.13 reds (1 red every 7-8 matches).
            yellow_card_probability: 0.085,
            red_card_probability: 0.025,
            penalty_probability: 0.50,
            stoppage_time_max: 4,
            injury_probability: 0.03,
            weather: WeatherModifiers::default(),
            fixture_pressure_multiplier: 1.0,
        }
    }
}

// ---------------------------------------------------------------------------
// Side — which side of the match
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Side {
    Home,
    Away,
}

impl Side {
    pub fn opposite(self) -> Side {
        match self {
            Side::Home => Side::Away,
            Side::Away => Side::Home,
        }
    }
}

// ---------------------------------------------------------------------------
// Zone — regions of the pitch from the perspective of the match (not a team)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Zone {
    HomeBox,
    HomeDefense,
    Midfield,
    AwayDefense,
    AwayBox,
}

impl Zone {
    /// The attacking zone for a given side (where they score).
    pub fn attacking_box(side: Side) -> Zone {
        match side {
            Side::Home => Zone::AwayBox,
            Side::Away => Zone::HomeBox,
        }
    }

    /// The attacking third for a given side.
    pub fn attacking_third(side: Side) -> Zone {
        match side {
            Side::Home => Zone::AwayDefense,
            Side::Away => Zone::HomeDefense,
        }
    }

    /// The defensive third for a given side.
    pub fn defensive_third(side: Side) -> Zone {
        match side {
            Side::Home => Zone::HomeDefense,
            Side::Away => Zone::AwayDefense,
        }
    }

    /// Advance the ball one zone towards the given side's goal.
    pub fn advance_towards(self, attacking_side: Side) -> Zone {
        match attacking_side {
            Side::Home => match self {
                Zone::HomeBox => Zone::HomeDefense,
                Zone::HomeDefense => Zone::Midfield,
                Zone::Midfield => Zone::AwayDefense,
                Zone::AwayDefense => Zone::AwayBox,
                Zone::AwayBox => Zone::AwayBox,
            },
            Side::Away => match self {
                Zone::AwayBox => Zone::AwayDefense,
                Zone::AwayDefense => Zone::Midfield,
                Zone::Midfield => Zone::HomeDefense,
                Zone::HomeDefense => Zone::HomeBox,
                Zone::HomeBox => Zone::HomeBox,
            },
        }
    }

    /// Is this zone the attacking box for the given side?
    pub fn is_box_for(self, attacking_side: Side) -> bool {
        self == Zone::attacking_box(attacking_side)
    }
}
