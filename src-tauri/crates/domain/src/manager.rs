use serde::{Deserialize, Serialize};

fn default_fan_approval() -> u8 {
    50
}

fn default_personality() -> ManagerPersonality {
    ManagerPersonality::default()
}

/// V99.4 T1.7: AI manager personality — drives tactical style, transfer
/// philosophy, and media behaviour. A Guardiola type plays possession
/// football; an Allardyce type is direct and defensive.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManagerPersonality {
    /// Tactical style preference — drives formation + play style choices.
    pub tactical_style: TacticalStyle,
    /// How well the manager sets up the team (0-100). Higher = tactics
    /// modifiers are more effective. A tactically astute manager gets
    /// more out of the same players.
    #[serde(default = "default_acumen")]
    pub tactical_acumen: u8,
    /// Transfer philosophy — what kind of players the manager targets.
    pub transfer_philosophy: TransferPhilosophy,
    /// Man-management skill (0-100). Higher = faster morale recovery
    /// + better at keeping unhappy players content.
    #[serde(default = "default_acumen")]
    pub man_management: u8,
    /// Risk appetite (0-100). Higher = more attacking, lower = more
    /// conservative. Affects formation choice + in-game decisions.
    #[serde(default = "default_acumen")]
    pub risk_appetite: u8,
    /// Media personality — affects press conference tone + news quotes.
    pub media_style: MediaStyle,
}

impl Default for ManagerPersonality {
    fn default() -> Self {
        Self {
            tactical_style: TacticalStyle::Balanced,
            tactical_acumen: 50,
            transfer_philosophy: TransferPhilosophy::SquadBuilder,
            man_management: 50,
            risk_appetite: 50,
            media_style: MediaStyle::Reserved,
        }
    }
}

fn default_acumen() -> u8 {
    50
}

/// V99.4 T1.7: Tactical style preference.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum TacticalStyle {
    Possession,    // Guardiola — high-tempo, short passing
    Direct,        // Allardyce — long ball, physical
    Counter,       // Mourinho — soak and spring
    Pressing,      // Klopp — high press, intense
    Defensive,     // Simeone — low block, compact
    #[default]
    Balanced,      // Default — no strong preference
}

/// V99.4 T1.7: Transfer philosophy.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum TransferPhilosophy {
    YouthFocused,  // Prioritises young players with potential
    StarSigning,   // Chases established stars
    #[default]
    SquadBuilder,  // Balanced — fills gaps with best available
    BargainHunter, // Looks for undervalued players
}

/// V99.4 T1.7: Media personality.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum MediaStyle {
    #[default]
    Reserved,     // Says little, keeps cards close
    Outspoken,    // Controversial, winds up rivals
    Charismatic,  // Engaging, fan favourite
    Pragmatic,    // Factual, no-nonsense
}

impl ManagerPersonality {
    /// Returns a play style string compatible with the engine's PlayStyle enum.
    /// Used by AI training to set the team's play_style based on the manager's
    /// tactical preference.
    pub fn preferred_play_style(&self) -> &str {
        match self.tactical_style {
            TacticalStyle::Possession => "Possession",
            TacticalStyle::Direct => "Attacking", // Direct ≈ attacking with long balls
            TacticalStyle::Counter => "Counter",
            TacticalStyle::Pressing => "HighPress",
            TacticalStyle::Defensive => "Defensive",
            TacticalStyle::Balanced => "Balanced",
        }
    }

    /// Returns a preferred formation string based on tactical style.
    pub fn preferred_formation(&self) -> &str {
        match self.tactical_style {
            TacticalStyle::Possession => "4-3-3",    // Guardiola
            TacticalStyle::Direct => "4-4-2",         // Allardyce
            TacticalStyle::Counter => "4-2-3-1",      // Mourinho
            TacticalStyle::Pressing => "4-3-3",       // Klopp
            TacticalStyle::Defensive => "5-4-1",      // Simeone
            TacticalStyle::Balanced => "4-4-2",
        }
    }

    /// Returns the tactical acumen as a multiplier (0.90–1.08).
    /// A tactically astute manager (100) gets +8% effectiveness from their
    /// tactics; a poor tactician (0) gets -10%.
    pub fn tactics_effectiveness_multiplier(&self) -> f64 {
        0.90 + (self.tactical_acumen as f64 / 100.0) * 0.18
    }

    /// Returns the man-management morale recovery bonus (0.0–0.5).
    /// A great man-manager (100) gives +0.5 to daily morale recovery.
    pub fn morale_recovery_bonus(&self) -> f64 {
        (self.man_management as f64 / 100.0) * 0.5
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Manager {
    pub id: String,
    pub first_name: String,
    pub last_name: String,
    pub date_of_birth: String,
    pub nationality: String,
    #[serde(default)]
    pub football_nation: String,
    #[serde(default)]
    pub birth_country: Option<String>,
    pub reputation: u32,
    pub satisfaction: u8, // 0 to 100
    #[serde(default = "default_fan_approval")]
    pub fan_approval: u8, // 0 to 100 — fan sentiment
    pub team_id: Option<String>,

    // Board warning stage at current club: 0 = none, 1 = warning, 2 = final warning.
    // Reset to 0 on hire so warnings don't carry over between clubs.
    #[serde(default)]
    pub warning_stage: u8,

    // Career stats (cumulative)
    pub career_stats: ManagerCareerStats,

    // Employment history
    pub career_history: Vec<ManagerCareerEntry>,

    /// V99.4 T1.7: Manager personality — drives tactical style, transfers, media.
    #[serde(default = "default_personality")]
    pub personality: ManagerPersonality,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ManagerCareerStats {
    pub matches_managed: u32,
    pub wins: u32,
    pub draws: u32,
    pub losses: u32,
    pub trophies: u32,
    pub best_finish: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManagerCareerEntry {
    pub team_id: String,
    pub team_name: String,
    pub start_date: String,
    pub end_date: Option<String>,
    pub matches: u32,
    pub wins: u32,
    pub draws: u32,
    pub losses: u32,
    pub best_league_position: Option<u32>,
}

impl ManagerCareerEntry {
    pub fn open(team_id: String, team_name: String, start_date: String) -> Self {
        Self {
            team_id,
            team_name,
            start_date,
            end_date: None,
            matches: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            best_league_position: None,
        }
    }
}

impl Manager {
    pub fn new(
        id: String,
        first_name: String,
        last_name: String,
        date_of_birth: String,
        nationality: String,
    ) -> Self {
        let football_nation = crate::identity::normalize_football_nation_code(&nationality);
        let birth_country = crate::identity::derive_birth_country_code(&nationality);
        Self {
            id,
            first_name,
            last_name,
            date_of_birth,
            nationality,
            football_nation,
            birth_country,
            reputation: 500,
            satisfaction: 100,
            fan_approval: 50,
            team_id: None,
            warning_stage: 0,
            career_stats: ManagerCareerStats::default(),
            career_history: Vec::new(),
            personality: ManagerPersonality::default(),
        }
    }

    pub fn hire(&mut self, team_id: String) {
        self.team_id = Some(team_id);
        self.warning_stage = 0;
    }

    pub fn fire(&mut self, date: &str) {
        if let Some(entry) = self
            .career_history
            .iter_mut()
            .find(|e| e.end_date.is_none())
        {
            entry.end_date = Some(date.to_string());
        }
        self.team_id = None;
        self.warning_stage = 0;
    }

    pub fn full_name(&self) -> String {
        format!("{} {}", self.first_name, self.last_name)
    }

    pub fn win_rate(&self) -> f32 {
        if self.career_stats.matches_managed == 0 {
            return 0.0;
        }
        self.career_stats.wins as f32 / self.career_stats.matches_managed as f32 * 100.0
    }

    /// A player-OVR-style overall rating (≈30–95) summarising the manager's
    /// standing, track record, and experience. Drives AI squad-management quality
    /// (rotation aggressiveness) and can be surfaced in the UI like a player's OVR.
    ///
    /// Blend: 50% reputation, 30% track record (win rate + trophies), 20%
    /// experience (matches managed). A fresh mid-reputation manager sits near 50;
    /// a decorated, experienced one approaches the high 80s.
    ///
    /// Reputation is normalised against the 300–900 club-reputation domain (the
    /// same scale `management_quality` uses) because AI managers inherit their
    /// club's reputation; a narrower domain would saturate every elite club at
    /// the top and flatten the rotation gradient.
    pub fn rating(&self) -> u8 {
        let reputation = ((f64::from(self.reputation) - 300.0) / 600.0).clamp(0.0, 1.0);
        let experience =
            (f64::from(self.career_stats.matches_managed) / 250.0).clamp(0.0, 1.0);
        let win_rate = (f64::from(self.win_rate()) / 100.0).clamp(0.0, 1.0);
        let trophies = (f64::from(self.career_stats.trophies) / 10.0).clamp(0.0, 1.0);
        let track_record = 0.7 * win_rate + 0.3 * trophies;
        let score = 0.50 * reputation + 0.30 * track_record + 0.20 * experience;
        (30.0 + 65.0 * score).round() as u8
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn manager() -> Manager {
        Manager::new(
            "m1".to_string(),
            "Test".to_string(),
            "Manager".to_string(),
            "1980-01-01".to_string(),
            "GB".to_string(),
        )
    }

    #[test]
    fn rating_for_fresh_mid_reputation_manager_is_mid_range() {
        // Mid of the 300–900 reputation domain, no career → sits around the middle.
        let mut m = manager();
        m.reputation = 600;
        let r = m.rating();
        assert!((45..=55).contains(&r), "expected mid-range rating, got {r}");
    }

    #[test]
    fn rating_rises_with_reputation_experience_and_success() {
        let mut elite = manager();
        elite.reputation = 800;
        elite.career_stats.matches_managed = 250;
        elite.career_stats.wins = 150; // 60% win rate
        elite.career_stats.trophies = 8;

        let mut journeyman = manager();
        journeyman.reputation = 250;
        journeyman.career_stats.matches_managed = 20;
        journeyman.career_stats.wins = 4; // 20% win rate

        let elite_rating = elite.rating();
        let journeyman_rating = journeyman.rating();

        assert!(
            elite_rating > journeyman_rating,
            "elite ({elite_rating}) should outrate journeyman ({journeyman_rating})"
        );
        assert!(elite_rating >= 80, "decorated manager should be high, got {elite_rating}");
        assert!(
            (30..=99).contains(&elite_rating) && (30..=99).contains(&journeyman_rating),
            "ratings stay in the OVR-like band"
        );
    }
}
