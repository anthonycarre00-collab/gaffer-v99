use serde::{Deserialize, Deserializer, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Player {
    pub id: String,
    pub match_name: String,
    pub full_name: String,
    pub date_of_birth: String,
    pub nationality: String,
    #[serde(default)]
    pub football_nation: String,
    #[serde(default)]
    pub birth_country: Option<String>,
    #[serde(default)]
    pub media: PlayerMedia,

    pub position: Position,

    // The player's natural/preferred position (never changed by formation logic)
    #[serde(default)]
    pub natural_position: Position,

    // Alternate positions this player can also play (with reduced effectiveness)
    #[serde(default)]
    pub alternate_positions: Vec<Position>,

    /// V100 P1 (Issue #3): Position the player is currently retraining to.
    /// When set, training sessions accumulate "learning XP" toward adding
    /// this position to `alternate_positions`. None = no active retraining.
    /// Persisted across saves (serde default = None) so progress isn't lost
    /// on continue game (per user requirement).
    #[serde(default)]
    pub training_position_focus: Option<Position>,

    /// V100 P1 (Issue #3): Accumulated retraining XP (0-100). When XP reaches
    /// 100, the position is added to `alternate_positions` and XP resets.
    /// Success is NEVER 100% guaranteed — even at XP=100 there's a 20%
    /// chance the retraining fails and XP resets to 50 (per user requirement).
    #[serde(default)]
    pub retraining_xp: u8,

    #[serde(default)]
    pub footedness: Footedness,

    #[serde(default = "default_weak_foot")]
    pub weak_foot: u8,

    /// V100 P1 (Issue #1): Player height in centimeters. 0 = unknown (will
    /// be generated from position + power attribute on first load). Range
    /// typically 165-200cm for senior pros; GKs and CBs tend to be taller.
    #[serde(default)]
    pub height_cm: u8,

    /// V100 P1 (Issue #1): Player weight in kilograms. 0 = unknown (will
    /// be generated from height + power attribute). Range typically 65-90kg.
    #[serde(default)]
    pub weight_kg: u8,

    // Core attributes 0-100
    pub attributes: PlayerAttributes,

    // Dynamic match/season values
    pub condition: u8, // 0-100 (short-term energy; depletes during matches, recovers daily)
    pub morale: u8,    // 0-100
    /// Long-term physical shape (0–100). Determines how fast condition depletes and
    /// recovers, and modulates injury risk. Changes slowly over weeks.
    #[serde(default = "default_fitness")]
    pub fitness: u8,

    pub injury: Option<Injury>,
    pub team_id: Option<String>,
    #[serde(default)]
    pub retired: bool,
    /// Gaffer Phase 8 — Team the player was on when they retired.
    /// Used by the regen system to generate a replacement regen for the right team.
    /// None for players who retired as free agents, or who haven't retired yet.
    #[serde(default)]
    pub former_team_id: Option<String>,
    /// Gaffer Phase 8 — Season number when the player retired.
    /// Used to identify "newly retired this season" players for regen generation.
    /// None for active players or pre-Phase-8 saves (loaded as None via serde default).
    #[serde(default)]
    pub retired_season: Option<u32>,
    #[serde(default)]
    pub squad_role: SquadRole,

    #[serde(default)]
    pub traits: Vec<PlayerTrait>,
    #[serde(default)]
    pub personality: PersonalityProfile,
    #[serde(default = "default_stability")]
    pub stability_modifier: u8,

    /// Gaffer Phase 2 — Narrative traits (Technical Identity + Psychological + Social).
    /// Assigned at world-gen, not auto-derived from attributes.
    #[serde(default)]
    pub narrative_traits: Vec<String>,

    // Derived ratings (set by ofm_core, backend is source of truth)
    /// Position-weighted overall rating (1–99). Computed from natural position.
    #[serde(default)]
    pub ovr: u8,
    /// Player's ceiling rating (1–99). Set at generation; higher than ovr for young players.
    #[serde(default)]
    pub potential: u8,
    /// V99.4 T4.1: Player fame tier — drives AI transfer interest, contract demands,
    /// media coverage, and fan morale. Derived from OVR + career achievements.
    #[serde(default)]
    pub fame: PlayerFame,

    // Contract & value
    pub contract_end: Option<String>,
    pub wage: u32, // weekly wage
    pub market_value: u64,
    /// V99.4 T4.4: Release clause — if a bid meets this amount, the club
    /// cannot refuse the player permission to talk. None = no clause.
    /// Higher clause = lower wage demands (player accepts less for security).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub release_clause: Option<u64>,

    // Season stats
    pub stats: PlayerSeasonStats,

    // Career history
    pub career: Vec<CareerEntry>,
    #[serde(default)]
    pub movement_history: Vec<PlayerMovementEntry>,
    /// V99.4 T2.1: Career event log — milestone moments (debut, first goal, etc.)
    #[serde(default)]
    pub career_events: Vec<CareerEvent>,
    /// V99.4 T2.2: Partnership goal counts — keyed by partner player ID.
    /// Tracks combined goals (scorer + assister) for each partnership.
    /// When a partnership exceeds 20+ goals, the match engine applies a +2% boost.
    #[serde(default)]
    pub partnerships: std::collections::HashMap<String, u32>,

    // Individual training focus override (takes priority over group and team default)
    #[serde(default)]
    pub training_focus: Option<crate::team::TrainingFocus>,

    // Transfer status
    #[serde(default)]
    pub transfer_listed: bool,
    #[serde(default)]
    pub loan_listed: bool,
    /// V100 P0-8 (Issue #5): When true, AI clubs will not bid for this player
    /// and `evaluate_transfer_market` skips them entirely. Set by the user
    /// via the `toggle_not_for_sale` command (typically from the player
    /// profile screen). Distinct from `transfer_listed` (which means the
    /// user WANTS to sell) — `not_for_sale` means the user refuses all bids.
    #[serde(default)]
    pub not_for_sale: bool,
    /// V99.4 T1.3: If the player has requested a transfer, this is the date
    /// the request was made. None = no active request.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transfer_request_date: Option<String>,
    /// V99.4 T1.3: Consecutive days morale has been below 25. Used to trigger
    /// transfer requests after 30 days of low morale.
    #[serde(default)]
    pub low_morale_days: u32,
    #[serde(default)]
    pub transfer_offers: Vec<TransferOffer>,
    #[serde(default)]
    pub loan_offers: Vec<LoanOffer>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active_loan: Option<ActiveLoan>,
    /// V99.3: bundled world DBs may have `"morale_core": null` for players
    /// generated before the morale-core system existed. Treat null as
    /// `Default::default()` so those DBs load cleanly instead of failing
    /// the entire world parse with a cryptic serde error.
    #[serde(default, deserialize_with = "deserialize_default_from_null")]
    pub morale_core: PlayerMoraleCore,

    /// Jersey/squad number (1–99). None means unassigned.
    #[serde(default)]
    pub jersey_number: Option<u8>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PlayerMedia {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub face: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Default, Serialize, Deserialize)]
pub enum Position {
    #[default]
    Goalkeeper,
    Defender,
    Midfielder,
    Forward,
    RightBack,
    CenterBack,
    LeftBack,
    RightWingBack,
    LeftWingBack,
    DefensiveMidfielder,
    CentralMidfielder,
    AttackingMidfielder,
    RightMidfielder,
    LeftMidfielder,
    RightWinger,
    LeftWinger,
    Striker,
}

impl Position {
    pub fn is_legacy_bucket(&self) -> bool {
        matches!(
            self,
            Position::Goalkeeper | Position::Defender | Position::Midfielder | Position::Forward
        )
    }

    pub fn to_group_position(&self) -> Position {
        match self {
            Position::Goalkeeper => Position::Goalkeeper,
            Position::Defender
            | Position::RightBack
            | Position::CenterBack
            | Position::LeftBack
            | Position::RightWingBack
            | Position::LeftWingBack => Position::Defender,
            Position::Midfielder
            | Position::DefensiveMidfielder
            | Position::CentralMidfielder
            | Position::AttackingMidfielder
            | Position::RightMidfielder
            | Position::LeftMidfielder => Position::Midfielder,
            Position::Forward
            | Position::RightWinger
            | Position::LeftWinger
            | Position::Striker => Position::Forward,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum Footedness {
    Left,
    #[default]
    Right,
    Both,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum SquadRole {
    #[default]
    Senior,
    Youth,
}

// GAFFER PHASE 1 — 19-attribute Body/Ball/Head/Gloves schema
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PlayerAttributes {
    pub pace: u8,
    #[serde(default = "default_attr", alias = "acceleration")]
    pub burst: u8,
    #[serde(default = "default_attr", alias = "stamina")]
    pub engine: u8,
    #[serde(default = "default_attr", alias = "strength")]
    pub power: u8,
    #[serde(default = "default_attr")]
    pub agility: u8,
    pub passing: u8,
    #[serde(default = "default_attr")]
    pub distribution: u8,
    #[serde(default = "default_attr", alias = "dribbling", alias = "technique")]
    pub touch: u8,
    #[serde(default = "default_attr", alias = "shooting")]
    pub finishing: u8,
    #[serde(default = "default_attr", alias = "tackling")]
    pub defending: u8,
    #[serde(default = "default_attr")]
    pub aerial: u8,
    #[serde(default = "default_attr", alias = "positioning")]
    pub anticipation: u8,
    pub vision: u8,
    pub decisions: u8,
    pub composure: u8,
    pub leadership: u8,
    #[serde(default = "default_attr", alias = "handling", alias = "reflexes")]
    pub shot_stopping: u8,
    #[serde(default = "default_attr")]
    pub commanding: u8,
    #[serde(default = "default_attr", alias = "kicking")]
    pub playing_out: u8,
}

fn default_attr() -> u8 { 50 }

impl PlayerAttributes {
    pub fn defaults() -> Self {
        Self { pace:50,burst:50,engine:50,power:50,agility:50,passing:50,distribution:50,touch:50,finishing:50,defending:50,aerial:50,anticipation:50,vision:50,decisions:50,composure:50,leadership:50,shot_stopping:50,commanding:50,playing_out:50 }
    }
    pub fn overall(&self, position: &Position) -> u8 {
        let group = position.to_group_position();
        let vals: Vec<u8> = match group {
            Position::Goalkeeper => vec![self.shot_stopping,self.commanding,self.playing_out,self.anticipation,self.decisions,self.composure,self.leadership,self.engine,self.power],
            _ => vec![self.pace,self.engine,self.power,self.passing,self.distribution,self.touch,self.finishing,self.defending,self.aerial,self.anticipation,self.decisions],
        };
        let sum: u32 = vals.iter().map(|&v| v as u32).sum();
        (sum / vals.len() as u32) as u8
    }
    pub fn body_avg(&self) -> u8 { ((self.pace as u32+self.burst as u32+self.engine as u32+self.power as u32+self.agility as u32)/5) as u8 }
    pub fn ball_avg(&self) -> u8 { ((self.passing as u32+self.distribution as u32+self.touch as u32+self.finishing as u32+self.defending as u32+self.aerial as u32)/6) as u8 }
    pub fn head_avg(&self) -> u8 { ((self.anticipation as u32+self.vision as u32+self.decisions as u32+self.composure as u32+self.leadership as u32)/5) as u8 }
    pub fn gloves_avg(&self) -> u8 { ((self.shot_stopping as u32+self.commanding as u32+self.playing_out as u32)/3) as u8 }
}

fn default_stability() -> u8 { 50 }

fn default_weak_foot() -> u8 {
    2
}

fn default_fitness() -> u8 {
    75
}


// GAFFER PHASE 1 — Personality + Stability types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonalityProfile {
    #[serde(default = "default_personality_axis")]
    pub openness: u8,
    #[serde(default = "default_personality_axis")]
    pub conscientiousness: u8,
    #[serde(default = "default_personality_axis")]
    pub extraversion: u8,
    #[serde(default = "default_personality_axis")]
    pub agreeableness: u8,
    #[serde(default = "default_personality_axis")]
    pub neuroticism: u8,
    #[serde(default = "default_confidence")]
    pub confidence: u8,
}
fn default_personality_axis() -> u8 { 50 }
fn default_confidence() -> u8 { 100 }
impl Default for PersonalityProfile {
    fn default() -> Self { Self { openness:50,conscientiousness:50,extraversion:50,agreeableness:50,neuroticism:50,confidence:100 } }
}
impl PersonalityProfile {
    pub fn pressure_response(&self) -> PressureResponse {
        let h=|v:u8|v>=70; let l=|v:u8|v<40; let m=|v:u8|(40..70).contains(&v);
        if h(self.extraversion)&&l(self.neuroticism){PressureResponse::Thrives}
        else if h(self.conscientiousness)&&m(self.neuroticism){PressureResponse::Channels}
        else if h(self.neuroticism)&&l(self.conscientiousness){PressureResponse::Folds}
        else if h(self.neuroticism)&&h(self.extraversion){PressureResponse::Escalates}
        else {PressureResponse::Channels}
    }
    pub fn media_sensitivity(&self) -> MediaSensitivity {
        let vh=|v:u8|v>=80; let h=|v:u8|v>=70; let l=|v:u8|v<40;
        if l(self.neuroticism)&&l(self.extraversion){MediaSensitivity::ThickSkinned}
        else if vh(self.neuroticism)&&l(self.conscientiousness){MediaSensitivity::Brittle}
        else if h(self.neuroticism)&&h(self.openness){MediaSensitivity::Sensitive}
        else {MediaSensitivity::Average}
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PressureResponse { Thrives, Channels, Folds, Escalates }
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum MediaSensitivity { ThickSkinned, Average, Sensitive, Brittle }
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum StabilityLabel { RollOfTheDice, RunsHotAndCold, SteadyHand, TrustedLieutenant, MrReliable }
impl StabilityLabel {
    pub fn from_value(v: u8) -> Self { match v { 0..=20=>StabilityLabel::RollOfTheDice, 21..=40=>StabilityLabel::RunsHotAndCold, 41..=60=>StabilityLabel::SteadyHand, 61..=80=>StabilityLabel::TrustedLieutenant, _=>StabilityLabel::MrReliable } }
    pub fn as_str(&self) -> &'static str { match self { StabilityLabel::RollOfTheDice=>"Roll of the Dice", StabilityLabel::RunsHotAndCold=>"Runs Hot and Cold", StabilityLabel::SteadyHand=>"Steady Hand", StabilityLabel::TrustedLieutenant=>"Trusted Lieutenant", StabilityLabel::MrReliable=>"Mr. Reliable" } }
    pub fn description(&self) -> &'static str { match self { StabilityLabel::RollOfTheDice=>"You never know which version turns up", StabilityLabel::RunsHotAndCold=>"Streaky", StabilityLabel::SteadyHand=>"Generally reliable", StabilityLabel::TrustedLieutenant=>"Banker", StabilityLabel::MrReliable=>"Rock solid" } }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Injury {
    pub name: String,
    pub days_remaining: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum PlayerIssueCategory {
    Contract,
    PlayingTime,
    Morale,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PlayerIssue {
    pub category: PlayerIssueCategory,
    pub severity: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(default)]
pub struct RecentTreatmentMemory {
    pub action_key: String,
    pub times_recently_used: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum PlayerPromiseKind {
    #[default]
    PlayingTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum RenewalSessionStatus {
    #[default]
    Idle,
    Open,
    Agreed,
    Blocked,
    Stalled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum RenewalSessionOutcome {
    #[default]
    None,
    AcceptedByManager,
    AcceptedByAssistant,
    RejectedByPlayer,
    BlockedByManager,
    Stalled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ContractExitIntent {
    LetExpire {
        set_on: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        reason: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct ContractRenewalState {
    pub status: RenewalSessionStatus,
    pub manager_blocked_until: Option<String>,
    pub last_attempt_date: Option<String>,
    pub last_assistant_attempt_date: Option<String>,
    pub last_outcome: Option<RenewalSessionOutcome>,
    pub conversation_round: u8,
    pub exit_intent: Option<ContractExitIntent>,
}

impl Default for ContractRenewalState {
    fn default() -> Self {
        Self {
            status: RenewalSessionStatus::Idle,
            manager_blocked_until: None,
            last_attempt_date: None,
            last_assistant_attempt_date: None,
            last_outcome: None,
            conversation_round: 0,
            exit_intent: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct PlayerPromise {
    pub kind: PlayerPromiseKind,
    pub matches_remaining: u8,
}

impl Default for PlayerPromise {
    fn default() -> Self {
        Self {
            kind: PlayerPromiseKind::PlayingTime,
            matches_remaining: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct PlayerMoraleCore {
    pub manager_trust: u8,
    pub unresolved_issue: Option<PlayerIssue>,
    pub recent_treatment: Option<RecentTreatmentMemory>,
    pub pending_promise: Option<PlayerPromise>,
    pub talk_cooldown_until: Option<String>,
    pub renewal_state: Option<ContractRenewalState>,
}

impl Default for PlayerMoraleCore {
    fn default() -> Self {
        Self {
            manager_trust: 50,
            unresolved_issue: None,
            recent_treatment: None,
            pending_promise: None,
            talk_cooldown_until: None,
            renewal_state: None,
        }
    }
}

/// V99.3: Deserialize helper that treats `null` in JSON as `Default::default()`
/// for non-Option fields. Used on `Player::morale_core` so bundled world DBs
/// that have `"morale_core": null` (generated before the morale-core system
/// existed) load cleanly instead of failing the entire world parse.
pub fn deserialize_default_from_null<'de, D, T>(deserializer: D) -> Result<T, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de> + Default,
{
    let opt = Option::<T>::deserialize(deserializer)?;
    Ok(opt.unwrap_or_default())
}

fn default_transfer_offer_status() -> TransferOfferStatus {
    TransferOfferStatus::Pending
}

fn default_transfer_offer_date() -> String {
    String::new()
}

fn default_transfer_offer_round() -> u8 {
    0
}

fn default_loan_offer_round() -> u8 {
    0
}

fn default_loan_offer_status() -> LoanOfferStatus {
    LoanOfferStatus::Pending
}

fn default_loan_offer_date() -> String {
    String::new()
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct PlayerSeasonStats {
    pub appearances: u32,
    pub goals: u32,
    pub assists: u32,
    pub clean_sheets: u32,
    pub yellow_cards: u32,
    pub red_cards: u32,
    pub avg_rating: f32,
    pub minutes_played: u32,
    pub shots: u32,
    pub shots_on_target: u32,
    pub passes_completed: u32,
    pub passes_attempted: u32,
    pub tackles_won: u32,
    pub interceptions: u32,
    pub fouls_committed: u32,
    /// V100 FIX (forensic): Last 3 match ratings (most recent last).
    /// Used by the Squad screen "Form" column to show recent performance.
    /// Capped at 3 entries — older ratings are dropped.
    #[serde(default)]
    pub recent_ratings: Vec<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CareerEntry {
    pub season: u32,
    pub team_id: String,
    pub team_name: String,
    pub appearances: u32,
    pub goals: u32,
    pub assists: u32,
}

/// V99.4 T4.1: Player fame tier — drives AI transfer interest, contract demands,
/// media coverage, and fan morale. Derived from OVR + career achievements.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum PlayerFame {
    #[default]
    Unknown,        // OVR < 55 — nobody knows who this is
    Prospect,       // OVR 55-64 + age <= 21 — hot prospect
    Known,          // OVR 65-69 — established squad player
    Established,    // OVR 70-74 — regular starter, recognised name
    Star,           // OVR 75-79 — star player, fans love him
    WorldClass,     // OVR 80-84 — world-class, known globally
    Legend,         // OVR 85+ OR multiple trophies — legendary status
}

impl PlayerFame {
    /// Derive fame from OVR, age, and career trophies.
    pub fn derive(ovr: u8, age: i32, trophies: u32) -> Self {
        // Legends: OVR 85+ OR 3+ trophies at any age
        if ovr >= 85 || trophies >= 3 {
            return PlayerFame::Legend;
        }
        // World class: OVR 80-84
        if ovr >= 80 {
            return PlayerFame::WorldClass;
        }
        // Star: OVR 75-79
        if ovr >= 75 {
            return PlayerFame::Star;
        }
        // Prospect: young + decent OVR
        if age <= 21 && ovr >= 55 {
            return PlayerFame::Prospect;
        }
        // Established: OVR 70-74
        if ovr >= 70 {
            return PlayerFame::Established;
        }
        // Known: OVR 65-69
        if ovr >= 65 {
            return PlayerFame::Known;
        }
        // Prospect: young even if low OVR
        if age <= 21 {
            return PlayerFame::Prospect;
        }
        PlayerFame::Unknown
    }

    /// Returns a Gaffer-voice label.
    pub fn label(&self) -> &str {
        match self {
            PlayerFame::Unknown => "Unknown",
            PlayerFame::Prospect => "Prospect",
            PlayerFame::Known => "Known",
            PlayerFame::Established => "Established",
            PlayerFame::Star => "Star",
            PlayerFame::WorldClass => "World Class",
            PlayerFame::Legend => "Legend",
        }
    }

    /// Returns a Gaffer-voice description.
    pub fn description(&self) -> &str {
        match self {
            PlayerFame::Unknown => "Nobody knows his name. Yet.",
            PlayerFame::Prospect => "One for the future — the lads at the academy rate him.",
            PlayerFame::Known => "Does a job. The fans know what they're getting.",
            PlayerFame::Established => "Proper player. Earns his corn every week.",
            PlayerFame::Star => "The main man. Bums on seats because of him.",
            PlayerFame::WorldClass => "World-class. Would walk into any side on the planet.",
            PlayerFame::Legend => "Legendary status. They'll talk about him for years.",
        }
    }

    /// Returns a wage demand multiplier — more famous players demand more.
    pub fn wage_multiplier(&self) -> f64 {
        match self {
            PlayerFame::Unknown => 0.80,
            PlayerFame::Prospect => 0.90,
            PlayerFame::Known => 1.00,
            PlayerFame::Established => 1.10,
            PlayerFame::Star => 1.25,
            PlayerFame::WorldClass => 1.50,
            PlayerFame::Legend => 1.75,
        }
    }

    /// Returns an AI transfer interest bonus — more famous players attract more bids.
    pub fn transfer_interest_bonus(&self) -> i32 {
        match self {
            PlayerFame::Unknown => 0,
            PlayerFame::Prospect => 10,
            PlayerFame::Known => 5,
            PlayerFame::Established => 15,
            PlayerFame::Star => 25,
            PlayerFame::WorldClass => 35,
            PlayerFame::Legend => 40,
        }
    }

    /// Returns true if the player is "famous" — attracts media attention.
    pub fn is_famous(&self) -> bool {
        matches!(self, PlayerFame::Star | PlayerFame::WorldClass | PlayerFame::Legend)
    }
}

/// V99.4 T2.1: Career event type — milestone moments in a player's career.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CareerEventType {
    Debut,
    FirstGoal,
    FirstAssist,
    InternationalCap,
    TrophyWon,
    MilestoneAppearance,  // 50th, 100th, 250th, 500th
    MilestoneGoal,         // 25th, 50th, 100th
    Transfer,
    Loan,
    CaptainAppointment,
    RecordBreak,
    GoldenBoot,
    PlayerOfSeason,
    YoungPlayerOfSeason,
}

/// V99.4 T2.1: A single career event — milestone moment in a player's career.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CareerEvent {
    pub event_type: CareerEventType,
    pub season: u32,
    pub date: String,
    pub team_id: Option<String>,
    pub team_name: Option<String>,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PlayerMovementKind {
    PermanentTransfer,
    LoanStart,
    LoanReturn,
    LoanToBuy,
    FreeAgentSigning,
    Released,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PlayerMovementEntry {
    pub date: String,
    pub kind: PlayerMovementKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from_team_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from_team_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to_team_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to_team_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fee: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub loan_end_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferOffer {
    pub id: String,
    pub from_team_id: String,
    pub fee: u64,
    pub wage_offered: u32,
    #[serde(default)]
    pub last_manager_fee: Option<u64>,
    #[serde(default = "default_transfer_offer_round")]
    pub negotiation_round: u8,
    #[serde(default)]
    pub suggested_counter_fee: Option<u64>,
    #[serde(default = "default_transfer_offer_status")]
    pub status: TransferOfferStatus,
    #[serde(default = "default_transfer_offer_date")]
    pub date: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub registration_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TransferOfferStatus {
    Pending,
    PendingRegistration,
    Accepted,
    Rejected,
    Withdrawn,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LoanOffer {
    pub id: String,
    pub from_team_id: String,
    pub parent_team_id: String,
    pub start_date: String,
    pub end_date: String,
    pub wage_contribution_pct: u8,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub buy_option_fee: Option<u64>,
    #[serde(default)]
    pub last_manager_wage_contribution_pct: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_manager_end_date: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_manager_buy_option_fee: Option<u64>,
    #[serde(default = "default_loan_offer_round")]
    pub negotiation_round: u8,
    #[serde(default)]
    pub suggested_wage_contribution_pct: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suggested_end_date: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suggested_buy_option_fee: Option<u64>,
    #[serde(default = "default_loan_offer_status")]
    pub status: LoanOfferStatus,
    #[serde(default = "default_loan_offer_date")]
    pub date: String,
    /// V99.4 T4.5: One-time loan fee paid to the parent club.
    #[serde(default)]
    pub loan_fee: u64,
    /// V99.4 T4.5: If true, the parent club can recall the player in January.
    #[serde(default)]
    pub recall_clause: bool,
    /// V99.4 T4.5: Minimum percentage of games the player must start (0-100).
    /// If the borrowing club fails to meet this, the player can leave early.
    #[serde(default)]
    pub playtime_guarantee_pct: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub enum LoanOfferStatus {
    #[default]
    Pending,
    PendingRegistration,
    Accepted,
    Rejected,
    Withdrawn,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ActiveLoan {
    pub parent_team_id: String,
    pub loan_team_id: String,
    pub start_date: String,
    pub end_date: String,
    pub wage_contribution_pct: u8,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub buy_option_fee: Option<u64>,
    #[serde(default)]
    pub loan_start_minutes: u32,
    #[serde(default)]
    pub loan_start_appearances: u32,
    #[serde(default)]
    pub development_reported_minutes: u32,
    #[serde(default)]
    pub development_reported_appearances: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PlayerTrait {
    Speedster,
    Explosive,
    #[serde(alias = "Engine")]
    Workhorse,
    #[serde(alias = "Strength")]
    Powerhouse,
    #[serde(alias = "Dribbler")]
    Twisty,
    #[serde(alias = "Playmaker")]
    Orchestrator,
    #[serde(alias = "Clinical Finisher", alias = "Distance Shooter")]
    Predator,
    VelvetTouch,
    #[serde(alias = "Tackling")]
    BallWinner,
    #[serde(alias = "Complete Defender", alias = "Aerial Threat")]
    Rock,
    #[serde(alias = "FK Specialist", alias = "Crosser")]
    SetPieceSpecialist,
    Leader,
    CoolHead,
    #[serde(alias = "Tactician")]
    Visionary,
    #[serde(alias = "Acrobat")]
    SafeHands,
    CatReflexes,
    Commander,
    #[serde(alias = "Complete Forward", alias = "Complete Midfielder")]
    CompleteForward,
    EngineRoom,
    #[serde(alias = "Poacher")]
    Wonderkid,
    // Legacy FIFA traits that don't have a direct Gaffer equivalent —
    // mapped to the closest variant so the DB loads without error.
    // These are consumed by serde but won't be re-serialized (the enum
    // serializes to the canonical Gaffer name).
}

/// Derive traits from the Gaffer 19-attribute schema.
pub fn compute_traits(attrs: &PlayerAttributes, _position: &Position) -> Vec<PlayerTrait> {
    let mut traits = Vec::new();
    if attrs.pace >= 85 { traits.push(PlayerTrait::Speedster); }
    if attrs.burst >= 85 { traits.push(PlayerTrait::Explosive); }
    if attrs.engine >= 85 { traits.push(PlayerTrait::Workhorse); }
    if attrs.power >= 85 { traits.push(PlayerTrait::Powerhouse); }
    if attrs.agility >= 85 { traits.push(PlayerTrait::Twisty); }
    if attrs.passing >= 80 && attrs.distribution >= 80 { traits.push(PlayerTrait::Orchestrator); }
    if attrs.finishing >= 85 { traits.push(PlayerTrait::Predator); }
    if attrs.touch >= 85 { traits.push(PlayerTrait::VelvetTouch); }
    if attrs.defending >= 80 { traits.push(PlayerTrait::BallWinner); }
    if attrs.defending >= 85 && attrs.anticipation >= 75 { traits.push(PlayerTrait::Rock); }
    if attrs.passing >= 80 && attrs.distribution >= 75 { traits.push(PlayerTrait::SetPieceSpecialist); }
    if attrs.leadership >= 85 { traits.push(PlayerTrait::Leader); }
    if attrs.composure >= 85 && attrs.decisions >= 80 { traits.push(PlayerTrait::CoolHead); }
    if attrs.vision >= 85 { traits.push(PlayerTrait::Visionary); }
    if attrs.shot_stopping >= 85 { traits.push(PlayerTrait::SafeHands); }
    if attrs.shot_stopping >= 85 && attrs.agility >= 75 { traits.push(PlayerTrait::CatReflexes); }
    if attrs.commanding >= 85 { traits.push(PlayerTrait::Commander); }
    if attrs.finishing >= 75 && attrs.touch >= 75 && attrs.pace >= 70 && attrs.power >= 70 { traits.push(PlayerTrait::CompleteForward); }
    if attrs.engine >= 85 && attrs.pace >= 70 && attrs.leadership >= 70 { traits.push(PlayerTrait::EngineRoom); }
    traits
}

impl Player {
    pub fn new(
        id: String,
        match_name: String,
        full_name: String,
        date_of_birth: String,
        nationality: String,
        position: Position,
        attributes: PlayerAttributes,
    ) -> Self {
        let traits = compute_traits(&attributes, &position);
        let football_nation = crate::identity::normalize_football_nation_code(&nationality);
        let birth_country = crate::identity::derive_birth_country_code(&nationality);
        Self {
            id,
            match_name,
            full_name,
            date_of_birth,
            nationality,
            football_nation,
            birth_country,
            media: PlayerMedia::default(),
            natural_position: position.clone(),
            position,
            alternate_positions: Vec::new(),
            // V100 P1 (Issue #3): Retraining fields default to None/0.
            training_position_focus: None,
            retraining_xp: 0,
            footedness: Footedness::default(),
            weak_foot: default_weak_foot(),
            // V100 P1 (Issue #1): height/weight default to 0 — generated
            // later by refresh_player_derived when first needed.
            height_cm: 0,
            weight_kg: 0,
            attributes,
            condition: 100,
            // V100 FIX (forensic): Lower starting morale from 100 to 60.
            // User feedback: "Morale for all players starts too high."
            // 60 = "Uneasy" — players haven't proven themselves yet.
            morale: 60,
            fitness: 75,
            injury: None,
            team_id: None,
            retired: false,
            former_team_id: None,
            retired_season: None,
            squad_role: SquadRole::Senior,
            traits,
            personality: PersonalityProfile::default(),
            stability_modifier: 50,
            narrative_traits: Vec::new(),
            ovr: 0,
            potential: 0,
            contract_end: None,
            wage: 0,
            market_value: 0,
            stats: PlayerSeasonStats::default(),
            career: Vec::new(),
            movement_history: Vec::new(),
            training_focus: None,
            transfer_listed: false,
            loan_listed: false,
            not_for_sale: false,
            transfer_offers: Vec::new(),
            loan_offers: Vec::new(),
            active_loan: None,
            morale_core: PlayerMoraleCore::default(),
            jersey_number: None,
            career_events: Vec::new(),
            partnerships: std::collections::HashMap::new(),
            release_clause: None,
            transfer_request_date: None,
            low_morale_days: 0,
            fame: PlayerFame::default(),
        }
    }

    pub fn stability_label(&self) -> StabilityLabel { StabilityLabel::from_value(self.stability_modifier) }
    pub fn recompute_stability(&mut self, age: Option<u8>) {
        let af: u8 = match age { Some(a) if (24..=29).contains(&a)=>100, Some(a) if (21..=23).contains(&a)||(30..=32).contains(&a)=>80, Some(a) if (18..=20).contains(&a)||(33..=35).contains(&a)=>50, Some(_)=>30, None=>50 };
        let ovr = if self.ovr > 0 { self.ovr } else { self.attributes.overall(&self.position) };
        let ef: u8 = if ovr < 85 { 0 } else { ((ovr as u32 - 85) * 100 / 14) as u8 };
        let ff: u8 = ((self.condition as u32 + self.fitness as u32) / 2) as u8;
        let cf: u8 = self.personality.conscientiousness;
        let inf: u8 = if self.injury.is_some() { 50 } else { 100 };
        self.stability_modifier = ((af as u32*25 + ef as u32*20 + ff as u32*20 + cf as u32*20 + inf as u32*15) / 100).min(100) as u8;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_attributes() -> PlayerAttributes {
        PlayerAttributes {
            pace:70,burst:68,engine:72,power:65,agility:68,
            passing:74,distribution:70,touch:69,finishing:61,defending:58,aerial:44,
            anticipation:67,vision:73,decisions:71,composure:66,leadership:49,
            shot_stopping:22,commanding:30,playing_out:40,
        }
    }

    #[test]
    fn player_new_defaults_footedness_and_weak_foot() {
        let player = Player::new(
            "p-001".to_string(),
            "J. Smith".to_string(),
            "John Smith".to_string(),
            "2000-01-15".to_string(),
            "GB".to_string(),
            Position::Midfielder,
            sample_attributes(),
        );

        assert_eq!(player.footedness, Footedness::Right);
        assert_eq!(player.weak_foot, 2);
        assert_eq!(player.squad_role, SquadRole::Senior);
        assert_eq!(player.squad_role, SquadRole::Senior);
    }

    #[test]
    fn position_group_conversion_maps_granular_positions_back_to_legacy_groups() {
        assert_eq!(Position::RightBack.to_group_position(), Position::Defender);
        assert_eq!(
            Position::AttackingMidfielder.to_group_position(),
            Position::Midfielder,
        );
        assert_eq!(Position::LeftWinger.to_group_position(), Position::Forward);
    }

    #[test]
    fn player_deserialization_defaults_missing_foot_fields() {
        let player: Player = serde_json::from_value(serde_json::json!({
            "id": "p-legacy",
            "match_name": "J. Legacy",
            "full_name": "John Legacy",
            "date_of_birth": "2000-01-15",
            "nationality": "GB",
            "position": "Midfielder",
            "natural_position": "Midfielder",
            "alternate_positions": [],
            "attributes": sample_attributes(),
            "condition": 100,
            "morale": 100,
            "injury": null,
            "team_id": null,
            "traits": [],
            "contract_end": null,
            "wage": 0,
            "market_value": 0,
            "stats": {},
            "career": [],
            "transfer_listed": false,
            "loan_listed": false,
            "not_for_sale": false,
            "transfer_offers": [],
            "morale_core": {}
        }))
        .expect("legacy player json should deserialize");

        assert_eq!(player.footedness, Footedness::Right);
        assert_eq!(player.weak_foot, 2);
        assert_eq!(player.natural_position, Position::Midfielder);
        assert!(!player.retired);
        assert!(player.movement_history.is_empty());
    }
}
