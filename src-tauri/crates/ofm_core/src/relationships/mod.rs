// ===========================================================================
// Gaffer Phase 2 — Relationship Graph
//
// The core data structure for player↔player relationships.
// Every player-pair has an edge with strength (-100 to +100), volatility,
// narrative tag history, and escalation tracking.
//
// See: docs/gaffer/BIBLE_CURATED.md §10 (Relationship & Memory Engine)
// See: docs/gaffer/PLAYER_ATTRIBUTES_PROPOSAL.md §5 (Personality interactions)
// ===========================================================================

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ---------------------------------------------------------------------------
// RelationshipEdge — the connection between two players
// ---------------------------------------------------------------------------

/// A directed relationship edge between two players.
/// Stored as (from_player_id, to_player_id) → RelationshipEdge.
/// Relationships are NOT symmetric — player A might like B, but B might not
/// like A back. The graph stores both directions separately.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RelationshipEdge {
    /// Strength: -100 (hatred) to +100 (brotherhood). 0 = neutral.
    pub strength: i8,

    /// Volatility: 0.0 (rock solid) to 1.0 (one bad match away from collapse).
    /// High volatility means the relationship swings easily.
    #[serde(default = "default_volatility")]
    pub volatility: f32,

    /// History of narrative tags applied to this relationship.
    /// e.g. ["Derby Ghost", "Mentorship", "Redemption Arc"]
    #[serde(default)]
    pub narrative_tags: Vec<String>,

    /// Last time this relationship escalated (positive or negative).
    /// Stored as ISO date string for serialization.
    #[serde(default)]
    pub last_escalation: Option<String>,

    /// Whether this edge has been flagged as a rivalry (Phase 3 NemesisTracker).
    #[serde(default)]
    pub rivalry_flag: bool,

    /// Clique IDs this pair belongs to together (if any).
    #[serde(default)]
    pub shared_cliques: Vec<String>,
}

fn default_volatility() -> f32 {
    0.3
}

impl Default for RelationshipEdge {
    fn default() -> Self {
        Self {
            strength: 0,
            volatility: 0.3,
            narrative_tags: Vec::new(),
            last_escalation: None,
            rivalry_flag: false,
            shared_cliques: Vec::new(),
        }
    }
}

impl RelationshipEdge {
    /// Create a new neutral relationship.
    pub fn neutral() -> Self {
        Self::default()
    }

    /// Create a new positive relationship with given strength.
    pub fn positive(strength: i8) -> Self {
        Self {
            strength: strength.clamp(-100, 100),
            ..Default::default()
        }
    }

    /// Create a new negative relationship with given strength.
    pub fn negative(strength: i8) -> Self {
        Self {
            strength: strength.clamp(-100, 100),
            volatility: 0.5,
            ..Default::default()
        }
    }

    /// Modify the strength by a delta, clamped to [-100, 100].
    pub fn modify_strength(&mut self, delta: i8) {
        self.strength = (self.strength as i16 + delta as i16)
            .clamp(-100, 100) as i8;
    }

    /// Escalate the relationship — record the date and adjust volatility.
    pub fn escalate(&mut self, date: &str, intensity: i8) {
        self.modify_strength(intensity);
        self.last_escalation = Some(date.to_string());

        // Negative escalations increase volatility; positive ones decrease it.
        if intensity < 0 {
            self.volatility = (self.volatility + 0.05).min(1.0);
        } else {
            self.volatility = (self.volatility - 0.03).max(0.0);
        }
    }

    /// Decay volatility over time (weekly call).
    pub fn decay_volatility(&mut self) {
        self.volatility = (self.volatility - 0.01).max(0.1);
    }

    /// Is this a strong positive relationship (ally)?
    pub fn is_strong_positive(&self) -> bool {
        self.strength >= 50
    }

    /// Is this a strong negative relationship (tension)?
    pub fn is_strong_negative(&self) -> bool {
        self.strength <= -40
    }

    /// Add a narrative tag if not already present.
    pub fn add_tag(&mut self, tag: &str) {
        if !self.narrative_tags.contains(&tag.to_string()) {
            self.narrative_tags.push(tag.to_string());
        }
    }
}

// ---------------------------------------------------------------------------
// RelationshipGraph — the full graph of all player relationships
// ---------------------------------------------------------------------------

/// The relationship graph stores all player↔player edges.
/// Uses a HashMap with "player_a_id:player_b_id" as the key.
/// The key is always sorted alphabetically by player ID so lookups are
/// bidirectional — we store the DIRECTION in the edge itself via two entries
/// (one for each direction) when the relationship is asymmetric.
///
/// For simplicity in Phase 2, we store relationships as bidirectional
/// (symmetric) — both players feel the same way. Phase 3 can add asymmetry
/// if needed for narrative purposes.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RelationshipGraph {
    /// Map of "player_a_id:player_b_id" (sorted) → RelationshipEdge.
    #[serde(default)]
    edges: HashMap<String, RelationshipEdge>,

    /// Clique memberships: player_id → Vec<clique_id>.
    #[serde(default)]
    clique_memberships: HashMap<String, Vec<String>>,

    /// All detected cliques.
    #[serde(default)]
    cliques: Vec<Clique>,
}

/// A clique is a group of 3+ players with strong mutual positive edges
/// who share nationality, age band, or academy origin.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Clique {
    pub id: String,
    pub member_ids: Vec<String>,
    pub clique_type: CliqueType,
    pub cohesion: u8, // 0-100, how tight the clique is
    pub leader_id: Option<String>,
}

/// What binds a clique together.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub enum CliqueType {
    #[default]
    General,
    SharedNationality,
    AgeBand,
    AcademyOrigin,
    VeteranCore,
    YouthCrew,
}

impl RelationshipGraph {
    pub fn new() -> Self {
        Self::default()
    }

    /// Generate a bidirectional key from two player IDs.
    /// Always sorts alphabetically so the key is the same regardless of order.
    fn edge_key(a: &str, b: &str) -> String {
        if a <= b {
            format!("{}:{}", a, b)
        } else {
            format!("{}:{}", b, a)
        }
    }

    /// Get the relationship between two players, or None if no edge exists.
    pub fn get(&self, a: &str, b: &str) -> Option<&RelationshipEdge> {
        self.edges.get(&Self::edge_key(a, b))
    }

    /// Get a mutable reference to the relationship between two players.
    pub fn get_mut(&mut self, a: &str, b: &str) -> Option<&mut RelationshipEdge> {
        self.edges.get_mut(&Self::edge_key(a, b))
    }

    /// Add or replace a relationship edge between two players.
    pub fn set(&mut self, a: &str, b: &str, edge: RelationshipEdge) {
        self.edges.insert(Self::edge_key(a, b), edge);
    }

    /// Add a new relationship between two players (defaults to neutral).
    /// Does nothing if the edge already exists.
    pub fn add_edge(&mut self, a: &str, b: &str) {
        let key = Self::edge_key(a, b);
        self.edges.entry(key).or_insert_with(RelationshipEdge::neutral);
    }

    /// Modify the strength of a relationship by a delta.
    /// Creates the edge if it doesn't exist.
    pub fn modify_strength(&mut self, a: &str, b: &str, delta: i8) {
        let key = Self::edge_key(a, b);
        self.edges
            .entry(key)
            .or_insert_with(RelationshipEdge::neutral)
            .modify_strength(delta);
    }

    /// Set a relationship edge with an absolute strength and volatility.
    /// Creates the edge if it doesn't exist. Used by the regen system to
    /// initialize teammate relationships for new youth prospects.
    pub fn set_edge(&mut self, a: &str, b: &str, strength: i8, volatility: f32) {
        let key = Self::edge_key(a, b);
        let edge = self.edges.entry(key).or_insert_with(RelationshipEdge::neutral);
        edge.strength = strength.clamp(-100, 100);
        edge.volatility = volatility;
    }

    /// V99.3 VITAL-1 M4: Set a rivalry edge between two teams. Mirrors
    /// the world_history rivalries into the relationship_graph so the
    /// match engine's narrative system can detect rivalries via
    /// `rivalry_flag` (used by `is_rivalry` in post_match.rs).
    pub fn set_rivalry(&mut self, a: &str, b: &str, intensity: u8) {
        let key = Self::edge_key(a, b);
        let edge = self.edges.entry(key).or_insert_with(RelationshipEdge::neutral);
        edge.rivalry_flag = true;
        edge.strength = edge.strength.max(intensity as i8);
    }

    /// Escalate a relationship (records date, adjusts volatility).
    pub fn escalate(&mut self, a: &str, b: &str, date: &str, intensity: i8) {
        let key = Self::edge_key(a, b);
        self.edges
            .entry(key)
            .or_insert_with(RelationshipEdge::neutral)
            .escalate(date, intensity);
    }

    /// Remove a relationship edge.
    pub fn remove(&mut self, a: &str, b: &str) {
        self.edges.remove(&Self::edge_key(a, b));
    }

    /// Get all relationship edges in the graph. V100 Issue #30 (rework):
    /// used by the season-sim report to count rivalries + partnerships.
    /// Returns (key, edge) pairs where key is "player_a:player_b".
    pub fn all_edges(&self) -> impl Iterator<Item = (&String, &RelationshipEdge)> {
        self.edges.iter()
    }

    /// Get all relationships for a specific player.
    /// Returns Vec<(other_player_id, &RelationshipEdge)>.
    pub fn relationships_for(&self, player_id: &str) -> Vec<(&str, &RelationshipEdge)> {
        self.edges
            .iter()
            .filter_map(|(key, edge)| {
                let parts: Vec<&str> = key.splitn(2, ':').collect();
                if parts.len() != 2 {
                    return None;
                }
                if parts[0] == player_id {
                    Some((parts[1], edge))
                } else if parts[1] == player_id {
                    Some((parts[0], edge))
                } else {
                    None
                }
            })
            .collect()
    }

    /// Get the strongest positive relationship for a player.
    pub fn strongest_positive(&self, player_id: &str) -> Option<(&str, &RelationshipEdge)> {
        self.relationships_for(player_id)
            .into_iter()
            .filter(|(_, e)| e.strength > 0)
            .max_by_key(|(_, e)| e.strength)
    }

    /// Get the strongest negative relationship for a player.
    pub fn strongest_negative(&self, player_id: &str) -> Option<(&str, &RelationshipEdge)> {
        self.relationships_for(player_id)
            .into_iter()
            .filter(|(_, e)| e.strength < 0)
            .min_by_key(|(_, e)| e.strength)
    }

    /// Calculate the positive relationship density for a squad.
    /// Returns 0-100: percentage of squad pairs with strength >= 30.
    pub fn positive_density(&self, squad_ids: &[String]) -> u8 {
        if squad_ids.len() < 2 {
            return 0;
        }
        let mut positive_count = 0u32;
        let mut total = 0u32;
        for i in 0..squad_ids.len() {
            for j in (i + 1)..squad_ids.len() {
                total += 1;
                if let Some(edge) = self.get(&squad_ids[i], &squad_ids[j]) {
                    if edge.strength >= 30 {
                        positive_count += 1;
                    }
                }
            }
        }
        if total == 0 {
            return 0;
        }
        ((positive_count as f32 / total as f32) * 100.0) as u8
    }

    /// Calculate the conflict severity for a squad.
    /// Returns 0-100: percentage of squad pairs with strength <= -30.
    pub fn conflict_severity(&self, squad_ids: &[String]) -> u8 {
        if squad_ids.len() < 2 {
            return 0;
        }
        let mut conflict_count = 0u32;
        let mut total = 0u32;
        for i in 0..squad_ids.len() {
            for j in (i + 1)..squad_ids.len() {
                total += 1;
                if let Some(edge) = self.get(&squad_ids[i], &squad_ids[j]) {
                    if edge.strength <= -30 {
                        conflict_count += 1;
                    }
                }
            }
        }
        if total == 0 {
            return 0;
        }
        ((conflict_count as f32 / total as f32) * 100.0) as u8
    }

    /// Decay all volatilities (call weekly).
    pub fn decay_all_volatilities(&mut self) {
        for edge in self.edges.values_mut() {
            edge.decay_volatility();
        }
    }

    /// Get all cliques.
    pub fn cliques(&self) -> &[Clique] {
        &self.cliques
    }

    /// Get cliques a player belongs to.
    pub fn cliques_for(&self, player_id: &str) -> &[Clique] {
        if self.clique_memberships.get(player_id).map(|v| !v.is_empty()).unwrap_or(false) {
            &self.cliques
        } else {
            &[]
        }
    }

    /// Add a clique and update memberships.
    pub fn add_clique(&mut self, clique: Clique) {
        for member_id in &clique.member_ids {
            self.clique_memberships
                .entry(member_id.clone())
                .or_insert_with(Vec::new)
                .push(clique.id.clone());
        }
        self.cliques.push(clique);
    }

    /// Total number of edges in the graph.
    pub fn edge_count(&self) -> usize {
        self.edges.len()
    }

    /// Check if the graph has any dressing room tension (any edge <= -40).
    pub fn has_tension(&self, squad_ids: &[String]) -> bool {
        for i in 0..squad_ids.len() {
            for j in (i + 1)..squad_ids.len() {
                if let Some(edge) = self.get(&squad_ids[i], &squad_ids[j]) {
                    if edge.is_strong_negative() {
                        return true;
                    }
                }
            }
        }
        false
    }
}

// ---------------------------------------------------------------------------
// Narrative Traits — 14 traits assigned at world-gen (not auto-derived)
// ---------------------------------------------------------------------------

/// Three categories of narrative traits that drive storytelling.
/// These are SEPARATE from the attribute-derived PlayerTrait enum.
/// See: docs/gaffer/BIBLE_CURATED.md §32
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum NarrativeTrait {
    // ── Technical Identity (5) — tactical role flavour ──
    PressingAnchor,
    TempoConductor,
    ChaosWinger,
    DefensiveWall,
    CounterKiller,

    // ── Psychological (5) — pressure/context response ──
    BigGameResponder,
    MediaSensitive,
    ProveThemWrong,
    IceCold,
    EmotionalReactor,

    // ── Social (4) — locker-room role ──
    DressingRoomAlpha,
    QuietStabilizer,
    CliqueBuilder,
    IsolationRisk,
}

impl NarrativeTrait {
    /// All 14 narrative trait variants.
    pub fn all() -> Vec<NarrativeTrait> {
        vec![
            NarrativeTrait::PressingAnchor,
            NarrativeTrait::TempoConductor,
            NarrativeTrait::ChaosWinger,
            NarrativeTrait::DefensiveWall,
            NarrativeTrait::CounterKiller,
            NarrativeTrait::BigGameResponder,
            NarrativeTrait::MediaSensitive,
            NarrativeTrait::ProveThemWrong,
            NarrativeTrait::IceCold,
            NarrativeTrait::EmotionalReactor,
            NarrativeTrait::DressingRoomAlpha,
            NarrativeTrait::QuietStabilizer,
            NarrativeTrait::CliqueBuilder,
            NarrativeTrait::IsolationRisk,
        ]
    }

    /// Human-readable label for UI display.
    pub fn label(&self) -> &'static str {
        match self {
            NarrativeTrait::PressingAnchor => "Pressing Anchor",
            NarrativeTrait::TempoConductor => "Tempo Conductor",
            NarrativeTrait::ChaosWinger => "Chaos Winger",
            NarrativeTrait::DefensiveWall => "Defensive Wall",
            NarrativeTrait::CounterKiller => "Counter Killer",
            NarrativeTrait::BigGameResponder => "Big Game Responder",
            NarrativeTrait::MediaSensitive => "Media Sensitive",
            NarrativeTrait::ProveThemWrong => "Prove Them Wrong",
            NarrativeTrait::IceCold => "Ice Cold",
            NarrativeTrait::EmotionalReactor => "Emotional Reactor",
            NarrativeTrait::DressingRoomAlpha => "Dressing Room Alpha",
            NarrativeTrait::QuietStabilizer => "Quiet Stabilizer",
            NarrativeTrait::CliqueBuilder => "Clique Builder",
            NarrativeTrait::IsolationRisk => "Isolation Risk",
        }
    }

    /// Which category this trait belongs to.
    pub fn category(&self) -> NarrativeTraitCategory {
        match self {
            NarrativeTrait::PressingAnchor
            | NarrativeTrait::TempoConductor
            | NarrativeTrait::ChaosWinger
            | NarrativeTrait::DefensiveWall
            | NarrativeTrait::CounterKiller => NarrativeTraitCategory::TechnicalIdentity,
            NarrativeTrait::BigGameResponder
            | NarrativeTrait::MediaSensitive
            | NarrativeTrait::ProveThemWrong
            | NarrativeTrait::IceCold
            | NarrativeTrait::EmotionalReactor => NarrativeTraitCategory::Psychological,
            NarrativeTrait::DressingRoomAlpha
            | NarrativeTrait::QuietStabilizer
            | NarrativeTrait::CliqueBuilder
            | NarrativeTrait::IsolationRisk => NarrativeTraitCategory::Social,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum NarrativeTraitCategory {
    TechnicalIdentity,
    Psychological,
    Social,
}

/// Caps per category to avoid dilution.
/// Max 5 Technical Identity, 2 Psychological, 2 Social per player.
pub const MAX_TECHNICAL_IDENTITY: usize = 5;
pub const MAX_PSYCHOLOGICAL: usize = 2;
pub const MAX_SOCIAL: usize = 2;

// ---------------------------------------------------------------------------
// Personality Evolution — events that shift Big Five over time
// ---------------------------------------------------------------------------

/// Events that trigger personality evolution.
/// See: docs/gaffer/PLAYER_ATTRIBUTES_PROPOSAL.md §5.5
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonalityEvent {
    pub event_type: PersonalityEventType,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PersonalityEventType {
    /// Sent off in a derby match.
    SentOffInDerby,
    /// Captained the team for 10+ matches.
    CaptainStreak,
    /// Public transfer request.
    TransferRequest,
    /// Won a trophy as a key player.
    TrophyWon,
    /// Long-term injury (3+ months).
    LongTermInjury,
    /// Media praised professionalism.
    MediaPraiseProfessionalism,
    /// Documented conflict with manager.
    ManagerConflict,
    /// Mentorship from a veteran player.
    Mentorship,
    /// Suffered a public humiliation (own goal, high-profile error).
    PublicHumiliation,
    /// Fan backlash / booed by own supporters.
    FanBacklash,
}

impl PersonalityEventType {
    /// Apply this event's personality shifts to a PersonalityProfile.
    /// Returns (openness_delta, conscientiousness_delta, extraversion_delta,
    ///          agreeableness_delta, neuroticism_delta).
    pub fn deltas(&self) -> (i8, i8, i8, i8, i8) {
        match self {
            PersonalityEventType::SentOffInDerby => (0, -1, 0, 0, 2),
            PersonalityEventType::CaptainStreak => (0, 0, 3, 1, 0),
            PersonalityEventType::TransferRequest => (0, 0, 0, -3, 2),
            PersonalityEventType::TrophyWon => (1, 1, 1, 1, -1),
            PersonalityEventType::LongTermInjury => (0, 0, -1, 0, 3),
            PersonalityEventType::MediaPraiseProfessionalism => (0, 2, 0, 0, -1),
            PersonalityEventType::ManagerConflict => (0, -1, 1, -4, 2),
            PersonalityEventType::Mentorship => (0, 1, 0, 1, -1),
            PersonalityEventType::PublicHumiliation => (0, 0, -1, 0, 3),
            PersonalityEventType::FanBacklash => (0, 0, -1, -1, 3),
        }
    }
}

/// Apply a personality event to a player's PersonalityProfile.
/// Caps shifts at ±15 per season per axis.
pub fn apply_personality_event(
    profile: &mut domain::player::PersonalityProfile,
    event: &PersonalityEventType,
    season_shifts: &mut SeasonShifts,
) {
    let (o, c, e, a, n) = event.deltas();

    // Apply with season cap checking
    profile.openness = apply_with_cap(profile.openness, o, &mut season_shifts.openness);
    profile.conscientiousness =
        apply_with_cap(profile.conscientiousness, c, &mut season_shifts.conscientiousness);
    profile.extraversion =
        apply_with_cap(profile.extraversion, e, &mut season_shifts.extraversion);
    profile.agreeableness =
        apply_with_cap(profile.agreeableness, a, &mut season_shifts.agreeableness);
    profile.neuroticism =
        apply_with_cap(profile.neuroticism, n, &mut season_shifts.neuroticism);
}

/// Tracks cumulative personality shifts within a season to enforce the ±15 cap.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SeasonShifts {
    pub openness: i8,
    pub conscientiousness: i8,
    pub extraversion: i8,
    pub agreeableness: i8,
    pub neuroticism: i8,
}

fn apply_with_cap(current: u8, delta: i8, cumulative: &mut i8) -> u8 {
    let new_cumulative = (*cumulative as i16 + delta as i16).clamp(-15, 15) as i8;
    *cumulative = new_cumulative;

    // Only apply the delta if we haven't hit the cap
    if delta > 0 && *cumulative >= 15 {
        // Cap reached — apply partial delta
        let remaining = 15 - (*cumulative - delta);
        if remaining <= 0 {
            return current;
        }
        return (current as i16 + remaining as i16).clamp(0, 100) as u8;
    }
    if delta < 0 && *cumulative <= -15 {
        let remaining = -15 - (*cumulative - delta);
        if remaining >= 0 {
            return current;
        }
        return (current as i16 + remaining as i16).clamp(0, 100) as u8;
    }

    (current as i16 + delta as i16).clamp(0, 100) as u8
}

// ---------------------------------------------------------------------------
// Clique Detection
// ---------------------------------------------------------------------------

/// Information needed about a player for clique detection.
#[derive(Debug, Clone)]
pub struct PlayerCliqueInfo {
    pub id: String,
    pub nationality: String,
    pub age: u8,
    pub academy_origin: Option<String>, // team_id where player was generated
}

/// Detect cliques in a squad based on relationship strength + shared attributes.
/// See: docs/gaffer/BIBLE_CURATED.md §30
///
/// Clique if:
/// - 3+ players
/// - Mutual positive edges > 30 between ALL pairs
/// - Shared nationality OR age band (±3 years) OR academy origin
pub fn detect_cliques(
    squad_ids: &[String],
    graph: &RelationshipGraph,
    player_infos: &[PlayerCliqueInfo],
) -> Vec<Clique> {
    let info_map: HashMap<&str, &PlayerCliqueInfo> = player_infos
        .iter()
        .filter(|p| squad_ids.contains(&p.id))
        .map(|p| (p.id.as_str(), p))
        .collect();

    let mut cliques = Vec::new();
    let mut used_in_clique: HashMap<String, bool> = HashMap::new();

    // Try each combination of 3+ players
    for i in 0..squad_ids.len() {
        if used_in_clique.get(&squad_ids[i]).copied().unwrap_or(false) {
            continue;
        }
        for j in (i + 1)..squad_ids.len() {
            if used_in_clique.get(&squad_ids[j]).copied().unwrap_or(false) {
                continue;
            }
            // Check if i and j have a strong enough edge
            let _edge = match graph.get(&squad_ids[i], &squad_ids[j]) {
                Some(e) if e.strength >= 30 => e,
                _ => continue,
            };

            // Find a third player that connects to both
            for k in (j + 1)..squad_ids.len() {
                if used_in_clique.get(&squad_ids[k]).copied().unwrap_or(false) {
                    continue;
                }

                let _edge_ik = match graph.get(&squad_ids[i], &squad_ids[k]) {
                    Some(e) if e.strength >= 30 => e,
                    _ => continue,
                };
                let _edge_jk = match graph.get(&squad_ids[j], &squad_ids[k]) {
                    Some(e) if e.strength >= 30 => e,
                    _ => continue,
                };

                // We have 3 mutually connected players. Check shared attributes.
                let info_i = match info_map.get(squad_ids[i].as_str()) {
                    Some(i) => i,
                    None => continue,
                };
                let info_j = match info_map.get(squad_ids[j].as_str()) {
                    Some(i) => i,
                    None => continue,
                };
                let info_k = match info_map.get(squad_ids[k].as_str()) {
                    Some(i) => i,
                    None => continue,
                };

                let clique_type = determine_clique_type(info_i, info_j, info_k);
                if clique_type == CliqueType::General {
                    continue; // No shared attribute — not a clique
                }

                // Found a clique! Try to expand it with more members.
                let mut member_ids = vec![squad_ids[i].clone(), squad_ids[j].clone(), squad_ids[k].clone()];

                // Look for more members
                for m in 0..squad_ids.len() {
                    if member_ids.contains(&squad_ids[m]) {
                        continue;
                    }
                    if used_in_clique.get(&squad_ids[m]).copied().unwrap_or(false) {
                        continue;
                    }

                    // Check if this player connects to ALL current members
                    let connects_to_all = member_ids.iter().all(|mid| {
                        graph
                            .get(mid, &squad_ids[m])
                            .map(|e| e.strength >= 30)
                            .unwrap_or(false)
                    });

                    if !connects_to_all {
                        continue;
                    }

                    // Check shared attribute with the clique
                    let info_m = match info_map.get(squad_ids[m].as_str()) {
                        Some(i) => i,
                        None => continue,
                    };

                    let compatible = member_ids.iter().all(|mid| {
                        let info = info_map.get(mid.as_str()).unwrap();
                        shares_attribute(info, info_m, &clique_type)
                    });

                    if compatible {
                        member_ids.push(squad_ids[m].clone());
                    }
                }

                // Calculate cohesion (average edge strength within clique)
                let mut total_strength = 0i32;
                let mut pair_count = 0u32;
                for a_idx in 0..member_ids.len() {
                    for b_idx in (a_idx + 1)..member_ids.len() {
                        if let Some(e) = graph.get(&member_ids[a_idx], &member_ids[b_idx]) {
                            total_strength += e.strength as i32;
                            pair_count += 1;
                        }
                    }
                }
                let cohesion = if pair_count > 0 {
                    ((total_strength as f32 / pair_count as f32) as i8).clamp(0, 100) as u8
                } else {
                    50
                };

                // Determine leader (highest leadership stat — needs player data,
                // for now use the first member as placeholder)
                let leader_id = member_ids.first().cloned();

                // Mark members as used
                for mid in &member_ids {
                    used_in_clique.insert(mid.clone(), true);
                }

                let clique_id = format!("clique_{}_{}", cliques.len() + 1, clique_type_label(&clique_type));

                cliques.push(Clique {
                    id: clique_id,
                    member_ids,
                    clique_type,
                    cohesion,
                    leader_id,
                });

                break; // Move to next i
            }
        }
    }

    cliques
}

fn determine_clique_type(
    a: &PlayerCliqueInfo,
    b: &PlayerCliqueInfo,
    c: &PlayerCliqueInfo,
) -> CliqueType {
    // Check shared nationality
    if a.nationality == b.nationality && b.nationality == c.nationality {
        return CliqueType::SharedNationality;
    }

    // Check age band (±3 years)
    let age_range = [a.age, b.age, c.age];
    let min_age = *age_range.iter().min().unwrap();
    let max_age = *age_range.iter().max().unwrap();
    if max_age - min_age <= 3 {
        if max_age <= 23 {
            return CliqueType::YouthCrew;
        } else if min_age >= 30 {
            return CliqueType::VeteranCore;
        }
        return CliqueType::AgeBand;
    }

    // Check academy origin
    if a.academy_origin.is_some()
        && a.academy_origin == b.academy_origin
        && b.academy_origin == c.academy_origin
    {
        return CliqueType::AcademyOrigin;
    }

    CliqueType::General
}

fn shares_attribute(a: &PlayerCliqueInfo, b: &PlayerCliqueInfo, clique_type: &CliqueType) -> bool {
    match clique_type {
        CliqueType::SharedNationality => a.nationality == b.nationality,
        CliqueType::AgeBand | CliqueType::YouthCrew | CliqueType::VeteranCore => {
            (a.age as i16 - b.age as i16).unsigned_abs() <= 3
        }
        CliqueType::AcademyOrigin => a.academy_origin == b.academy_origin,
        _ => true,
    }
}

fn clique_type_label(ct: &CliqueType) -> &str {
    match ct {
        CliqueType::SharedNationality => "nationality",
        CliqueType::AgeBand => "age",
        CliqueType::AcademyOrigin => "academy",
        CliqueType::VeteranCore => "veterans",
        CliqueType::YouthCrew => "youth",
        CliqueType::General => "general",
    }
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn edge_modify_strength_clamps() {
        let mut edge = RelationshipEdge::positive(80);
        edge.modify_strength(50); // Would be 130, should clamp to 100
        assert_eq!(edge.strength, 100);

        let mut edge = RelationshipEdge::negative(-50);
        edge.modify_strength(-60); // Would be -110, should clamp to -100
        assert_eq!(edge.strength, -100);
    }

    #[test]
    fn graph_add_and_get_edge() {
        let mut graph = RelationshipGraph::new();
        graph.set("p1", "p2", RelationshipEdge::positive(60));

        let edge = graph.get("p1", "p2").unwrap();
        assert_eq!(edge.strength, 60);

        // Bidirectional lookup (order doesn't matter)
        let edge = graph.get("p2", "p1").unwrap();
        assert_eq!(edge.strength, 60);
    }

    #[test]
    fn graph_modify_strength_creates_if_missing() {
        let mut graph = RelationshipGraph::new();
        assert!(graph.get("p1", "p2").is_none());

        graph.modify_strength("p1", "p2", 30);
        let edge = graph.get("p1", "p2").unwrap();
        assert_eq!(edge.strength, 30);
    }

    #[test]
    fn graph_strongest_positive_and_negative() {
        let mut graph = RelationshipGraph::new();
        graph.set("p1", "p2", RelationshipEdge::positive(70));
        graph.set("p1", "p3", RelationshipEdge::positive(40));
        graph.set("p1", "p4", RelationshipEdge::negative(-60));

        let pos = graph.strongest_positive("p1").unwrap();
        assert_eq!(pos.0, "p2");
        assert_eq!(pos.1.strength, 70);

        let neg = graph.strongest_negative("p1").unwrap();
        assert_eq!(neg.0, "p4");
        assert_eq!(neg.1.strength, -60);
    }

    #[test]
    fn graph_positive_density() {
        let mut graph = RelationshipGraph::new();
        let squad = vec!["p1".to_string(), "p2".to_string(), "p3".to_string()];

        // 2 of 3 pairs are positive (>= 30)
        graph.set("p1", "p2", RelationshipEdge::positive(50));
        graph.set("p1", "p3", RelationshipEdge::positive(35));
        // p2-p3 has no edge (neutral = 0, which is < 30)

        let density = graph.positive_density(&squad);
        // 2 out of 3 pairs = 66%
        assert_eq!(density, 66);
    }

    #[test]
    fn graph_has_tension() {
        let mut graph = RelationshipGraph::new();
        let squad = vec!["p1".to_string(), "p2".to_string(), "p3".to_string()];

        graph.set("p1", "p2", RelationshipEdge::positive(50));
        assert!(!graph.has_tension(&squad));

        graph.set("p2", "p3", RelationshipEdge::negative(-50));
        assert!(graph.has_tension(&squad));
    }

    #[test]
    fn narrative_trait_all_has_14() {
        assert_eq!(NarrativeTrait::all().len(), 14);
    }

    #[test]
    fn narrative_trait_categories() {
        assert_eq!(
            NarrativeTrait::PressingAnchor.category(),
            NarrativeTraitCategory::TechnicalIdentity
        );
        assert_eq!(
            NarrativeTrait::BigGameResponder.category(),
            NarrativeTraitCategory::Psychological
        );
        assert_eq!(
            NarrativeTrait::DressingRoomAlpha.category(),
            NarrativeTraitCategory::Social
        );
    }

    #[test]
    fn personality_event_deltas() {
        let (o, c, e, a, n) = PersonalityEventType::SentOffInDerby.deltas();
        assert_eq!(n, 2); // Neuroticism increases
        assert_eq!(c, -1); // Conscientiousness decreases

        let (_, _, e, _, _) = PersonalityEventType::CaptainStreak.deltas();
        assert_eq!(e, 3); // Extraversion increases
    }

    #[test]
    fn clique_detection_finds_shared_nationality() {
        let mut graph = RelationshipGraph::new();
        let squad = vec!["p1".to_string(), "p2".to_string(), "p3".to_string()];

        // All three pairs have positive edges
        graph.set("p1", "p2", RelationshipEdge::positive(50));
        graph.set("p1", "p3", RelationshipEdge::positive(40));
        graph.set("p2", "p3", RelationshipEdge::positive(60));

        let infos = vec![
            PlayerCliqueInfo {
                id: "p1".to_string(),
                nationality: "GB".to_string(),
                age: 25,
                academy_origin: None,
            },
            PlayerCliqueInfo {
                id: "p2".to_string(),
                nationality: "GB".to_string(),
                age: 27,
                academy_origin: None,
            },
            PlayerCliqueInfo {
                id: "p3".to_string(),
                nationality: "GB".to_string(),
                age: 24,
                academy_origin: None,
            },
        ];

        let cliques = detect_cliques(&squad, &graph, &infos);
        assert_eq!(cliques.len(), 1);
        assert_eq!(cliques[0].clique_type, CliqueType::SharedNationality);
        assert_eq!(cliques[0].member_ids.len(), 3);
    }

    #[test]
    fn clique_detection_requires_shared_attribute() {
        let mut graph = RelationshipGraph::new();
        let squad = vec!["p1".to_string(), "p2".to_string(), "p3".to_string()];

        graph.set("p1", "p2", RelationshipEdge::positive(50));
        graph.set("p1", "p3", RelationshipEdge::positive(40));
        graph.set("p2", "p3", RelationshipEdge::positive(60));

        // Different nationalities, very different ages, no academy origin
        let infos = vec![
            PlayerCliqueInfo {
                id: "p1".to_string(),
                nationality: "GB".to_string(),
                age: 20,
                academy_origin: None,
            },
            PlayerCliqueInfo {
                id: "p2".to_string(),
                nationality: "BR".to_string(),
                age: 30,
                academy_origin: None,
            },
            PlayerCliqueInfo {
                id: "p3".to_string(),
                nationality: "FR".to_string(),
                age: 35,
                academy_origin: None,
            },
        ];

        let cliques = detect_cliques(&squad, &graph, &infos);
        assert_eq!(cliques.len(), 0); // No shared attribute → no clique
    }

    #[test]
    fn escalate_records_date_and_adjusts_volatility() {
        let mut graph = RelationshipGraph::new();
        graph.escalate("p1", "p2", "2026-07-15", -20);

        let edge = graph.get("p1", "p2").unwrap();
        assert_eq!(edge.strength, -20);
        assert_eq!(edge.last_escalation, Some("2026-07-15".to_string()));
        assert!(edge.volatility > 0.3); // Volatility increased
    }

    #[test]
    fn add_clique_updates_memberships() {
        let mut graph = RelationshipGraph::new();
        let clique = Clique {
            id: "clique_1".to_string(),
            member_ids: vec!["p1".to_string(), "p2".to_string(), "p3".to_string()],
            clique_type: CliqueType::SharedNationality,
            cohesion: 70,
            leader_id: Some("p1".to_string()),
        };
        graph.add_clique(clique);

        // Each player should be in the clique
        assert_eq!(graph.cliques_for("p1").len(), 1);
        assert_eq!(graph.cliques_for("p2").len(), 1);
        assert_eq!(graph.cliques_for("p3").len(), 1);
        assert_eq!(graph.cliques_for("p4").len(), 0);
    }
}
