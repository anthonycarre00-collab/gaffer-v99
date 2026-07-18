use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Staff {
    pub id: String,
    pub first_name: String,
    pub last_name: String,
    pub date_of_birth: String,
    pub nationality: String,
    #[serde(default)]
    pub football_nation: String,
    #[serde(default)]
    pub birth_country: Option<String>,
    pub role: StaffRole,

    // Attributes 0-100
    pub attributes: StaffAttributes,
    pub team_id: Option<String>,

    // Coaching specialization — boosts one training focus area
    #[serde(default)]
    pub specialization: Option<CoachingSpecialization>,

    /// V100 P1 (Issue #17): Staff personality. Affects coaching style
    /// (authoritarian → players improve faster but morale drops), scouting
    /// bias (overrates certain attributes), physio approach (cautious vs
    /// aggressive recovery). Reuses the existing PersonalityProfile struct
    /// from the player module so we don't duplicate the Big Five model.
    #[serde(default)]
    pub personality: Option<crate::player::PersonalityProfile>,

    /// V100 P1 (Issue #18): Scout bias profile. Only meaningful for staff
    /// with role == Scout. Each bias is a multiplier (1.0 = neutral) that
    /// fuzzes the scout's attribute readings. E.g. a scout with
    /// pace_bias = 1.2 will overrate pace by ~20% in their reports.
    /// None for non-scout staff.
    #[serde(default)]
    pub scout_bias: Option<ScoutBias>,

    // Contract & finances
    #[serde(default)]
    pub wage: u32,
    #[serde(default)]
    pub contract_end: Option<String>,
}

/// V100 P1 (Issue #18): Scout bias profile. Each field is a multiplier
/// (1.0 = neutral, >1.0 = overrates, <1.0 = underrates) applied to the
/// scout's attribute readings when generating a scouting report.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ScoutBias {
    #[serde(default = "default_bias")]
    pub pace_bias: f32,
    #[serde(default = "default_bias")]
    pub power_bias: f32,
    #[serde(default = "default_bias")]
    pub defending_bias: f32,
    #[serde(default = "default_bias")]
    pub attacking_bias: f32,
    /// How much uncertainty to add to the report (0.0 = precise, 1.0 = wild).
    #[serde(default = "default_noise")]
    pub noise_level: f32,
}

fn default_bias() -> f32 { 1.0 }
fn default_noise() -> f32 { 0.1 }

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum StaffRole {
    Manager,
    AssistantManager,
    Coach,
    Scout,
    Physio,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CoachingSpecialization {
    Fitness,     // Boosts Physical training
    Technique,   // Boosts Technical training
    Tactics,     // Boosts Tactical training
    Defending,   // Boosts Defending training
    Attacking,   // Boosts Attacking training
    GoalKeeping, // Boosts GK-specific development
    Youth,       // Boosts young player development
}

#[derive(Debug, Clone, Serialize, Deserialize)]
// camelCase matches the package convention (see SCHEMA_REFERENCE) and the World
// Editor frontend, so authored staff attributes round-trip both ways. The
// snake_case aliases keep existing saves (serialized before this change) and
// snake_case-authored packages loading.
#[serde(rename_all = "camelCase")]
pub struct StaffAttributes {
    pub coaching: u8,
    #[serde(alias = "judging_ability")]
    pub judging_ability: u8,
    #[serde(alias = "judging_potential")]
    pub judging_potential: u8,
    pub physiotherapy: u8,
}

impl Staff {
    pub fn new(
        id: String,
        first_name: String,
        last_name: String,
        date_of_birth: String,
        role: StaffRole,
        attributes: StaffAttributes,
    ) -> Self {
        Self {
            id,
            first_name,
            last_name,
            date_of_birth,
            nationality: String::new(),
            football_nation: String::new(),
            birth_country: None,
            role,
            attributes,
            team_id: None,
            specialization: None,
            wage: 0,
            contract_end: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::StaffAttributes;

    #[test]
    fn deserializes_camelcase_attributes() {
        let json = r#"{"coaching":70,"judgingAbility":65,"judgingPotential":60,"physiotherapy":40}"#;
        let attrs: StaffAttributes = serde_json::from_str(json).expect("camelCase should parse");
        assert_eq!(attrs.judging_ability, 65);
        assert_eq!(attrs.judging_potential, 60);
    }

    #[test]
    fn still_deserializes_snakecase_attributes_from_existing_saves() {
        let json = r#"{"coaching":70,"judging_ability":65,"judging_potential":60,"physiotherapy":40}"#;
        let attrs: StaffAttributes = serde_json::from_str(json).expect("snake_case alias should parse");
        assert_eq!(attrs.judging_ability, 65);
        assert_eq!(attrs.judging_potential, 60);
    }

    #[test]
    fn serializes_as_camelcase_so_the_editor_can_read_it_back() {
        let attrs = StaffAttributes {
            coaching: 70,
            judging_ability: 65,
            judging_potential: 60,
            physiotherapy: 40,
        };
        let json = serde_json::to_string(&attrs).expect("should serialize");
        assert!(json.contains("\"judgingAbility\":65"), "serialized as: {json}");
        assert!(json.contains("\"judgingPotential\":60"), "serialized as: {json}");
        // Round-trips back to the same struct.
        let back: StaffAttributes = serde_json::from_str(&json).expect("round-trip");
        assert_eq!(back.judging_ability, 65);
    }
}
