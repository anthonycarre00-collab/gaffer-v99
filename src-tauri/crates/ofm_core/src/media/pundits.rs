use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::OnceLock;

/// V100 P1 (Issue #12): A pundit with a personality archetype, bias profile,
/// and catchphrases. Loaded from `src-tauri/data/pundits.json` at startup.
/// The commentary engine picks a pundit per match (rotating) and uses their
/// personality to color the commentary.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pundit {
    pub id: String,
    pub name: String,
    pub archetype: PunditArchetype,
    pub bias: PunditBias,
    pub catchphrases: HashMap<String, Vec<String>>,
}

/// V100 P1 (Issue #12): Personality archetype. Drives the tone of commentary.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum PunditArchetype {
    /// Roy Keane type — fiery, critical, demands effort.
    Fiery,
    /// Carragher type — tactical, focuses on shape and structure.
    Tactical,
    /// Micah Richards type — enthusiastic, positive, loves flair.
    Enthusiastic,
    /// Gary Neville type — analytical, measured, focuses on basics.
    Analytical,
    /// Lineker type — witty, light-hearted, balanced.
    Witty,
    /// Souness type — highly critical, demands standards.
    Critical,
}

/// V100 P1 (Issue #12): Bias profile. Multipliers (1.0 = neutral) that
/// adjust how often the pundit praises or criticizes specific things.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PunditBias {
    /// How likely this pundit is to praise work rate (1.0 = normal).
    pub praises_work_rate: f32,
    /// How likely to praise defending.
    pub praises_defending: f32,
    /// How likely to criticize lazy play.
    pub criticizes_lazy: f32,
    /// How likely to criticize poor defending.
    pub criticizes_poor_defending: f32,
    /// How likely to praise flair/skill.
    pub praises_flair: f32,
    /// How likely to praise youth players.
    pub praises_youth: f32,
}

/// V100 P1 (Issue #12): The pundit database. Loaded once at startup from
/// `pundits.json`. Provides a rotating pundit per match.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PunditDatabase {
    pub pundits: Vec<Pundit>,
}

impl PunditDatabase {
    /// Load the pundit database from the embedded JSON file.
    /// Uses `include_str!` so the data is baked into the binary at compile
    /// time — no runtime file I/O needed.
    pub fn load() -> Self {
        let json = include_str!("../../../../data/pundits.json");
        serde_json::from_str(json).unwrap_or_else(|e| {
            log::error!("[pundits] Failed to load pundits.json: {}. Using empty database.", e);
            PunditDatabase { pundits: vec![] }
        })
    }

    /// Get the pundit database (singleton, loaded once on first access).
    pub fn instance() -> &'static PunditDatabase {
        static INSTANCE: OnceLock<PunditDatabase> = OnceLock::new();
        INSTANCE.get_or_init(PunditDatabase::load)
    }

    /// Pick a pundit for the current match. Rotates based on a seed (e.g.
    /// the fixture id hash) so the same fixture always gets the same pundit.
    /// Returns None if the database is empty (defensive).
    pub fn pick_pundit(&self, seed: u64) -> Option<&Pundit> {
        if self.pundits.is_empty() {
            return None;
        }
        let idx = (seed as usize) % self.pundits.len();
        self.pundits.get(idx)
    }

    /// Get a catchphrase for a specific event type from a pundit.
    /// Returns None if the pundit has no catchphrases for that event.
    pub fn get_catchphrase(pundit: &Pundit, event_key: &str, rng_seed: u64) -> Option<String> {
        let phrases = pundit.catchphrases.get(event_key)?;
        if phrases.is_empty() {
            return None;
        }
        let idx = (rng_seed as usize) % phrases.len();
        Some(phrases[idx].clone())
    }
}

/// V100 P1 (Issue #12): Pick a pundit for a match between two teams.
/// Uses the fixture id (or a hash of team ids + date) as the seed so the
/// same fixture always gets the same pundit — consistent commentary.
pub fn pick_pundit_for_match(fixture_id: &str) -> Option<&'static Pundit> {
    let db = PunditDatabase::instance();
    let seed = fixture_id
        .bytes()
        .map(|b| b as u64)
        .fold(0u64, |acc, b| acc.wrapping_mul(31).wrapping_add(b));
    db.pick_pundit(seed)
}
