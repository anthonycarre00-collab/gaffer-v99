// ===========================================================================
// Gaffer Phase 3 — Narrative Engine & Memory System
//
// Every decision leaves a trace. Memories resurface. Stories escalate.
//
// This module provides:
// - Memory: stored events with emotional weight, archive flags, cooldowns
// - StoryThread: ongoing narratives with momentum, escalation tiers
// - NarrativeCooldownRegistry: 12-week minimum reuse prevention
// - Memory resurfacing logic: past events resurface at critical moments
//
// See: docs/gaffer/BIBLE_CURATED.md §10, §12, §23
// ===========================================================================

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ---------------------------------------------------------------------------
// Memory — a stored event that can resurface later
// ---------------------------------------------------------------------------

/// A memory of a significant event in the game world.
/// Stored per-player, per-team, and per-manager.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Memory {
    pub id: String,
    pub event_type: MemoryEventType,
    pub entity_id: String,      // player_id, team_id, or manager_id
    pub entity_type: EntityType,
    pub date: String,           // ISO date when the event occurred
    pub emotional_weight: f32,  // 0.0 (trivial) to 1.0 (career-defining)
    pub rivalry_flag: bool,     // true if this involved a rivalry
    pub archive_flag: bool,     // true = eligible for resurfacing
    pub media_visibility: MediaVisibility,
    pub cooldown_until: Option<String>,  // ISO date or None
    pub description: String,    // Human-readable summary
    pub related_entity_id: Option<String>, // the "other" party (opponent, teammate, etc.)
    pub times_resurfaced: u32,  // How many times this memory has been referenced
}

/// What kind of event the memory captures.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Hash)]
pub enum MemoryEventType {
    MatchWin,
    MatchLoss,
    MatchDraw,
    DerbyWin,
    DerbyLoss,
    RedCard,
    RedCardDerby,
    HatTrick,
    CleanSheet,
    Injury,
    Comeback,
    LateWinner,
    LateConcession,
    TrophyWon,
    TrophyLoss,
    Transfer,
    ContractSigned,
    ManagerSacked,
    ManagerHired,
    PublicPromise,
    PromiseBroken,
    PromiseKept,
    MediaPraise,
    MediaCriticism,
    FanBacklash,
    FanPraise,
    Captaincy,
    CaptaincyLost,
    StreakStarted,
    StreakEnded,
    Slump,
    Breakout,
    Retirement,
    Record,
    Controversy,
    Relegation,
    Promotion,
    Upset,
    Domination,
}

/// What type of entity owns this memory.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Hash)]
pub enum EntityType {
    Player,
    Team,
    Manager,
}

/// How visible this memory was to the media (affects resurfacing probability).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MediaVisibility {
    /// Only the team knows (internal matter).
    Internal,
    /// Local media covered it.
    Local,
    /// National media covered it.
    National,
    /// International media — this won't be forgotten quickly.
    International,
}

impl Default for MediaVisibility {
    fn default() -> Self {
        MediaVisibility::Local
    }
}

impl Memory {
    /// Create a new memory.
    pub fn new(
        event_type: MemoryEventType,
        entity_id: &str,
        entity_type: EntityType,
        date: &str,
        emotional_weight: f32,
        description: &str,
    ) -> Self {
        let id = format!("mem_{}_{}_{}", entity_id, date.replace('-', ""), event_type_variant_name(&event_type));
        Self {
            id,
            event_type,
            entity_id: entity_id.to_string(),
            entity_type,
            date: date.to_string(),
            emotional_weight: emotional_weight.clamp(0.0, 1.0),
            rivalry_flag: false,
            archive_flag: true,
            media_visibility: MediaVisibility::default(),
            cooldown_until: None,
            description: description.to_string(),
            related_entity_id: None,
            times_resurfaced: 0,
        }
    }

    /// Is this memory eligible to resurface?
    /// Requires: archive_flag = true, cooldown expired (or None), weight above threshold.
    pub fn can_resurface(&self, current_date: &str, min_weight: f32) -> bool {
        if !self.archive_flag {
            return false;
        }
        if self.emotional_weight < min_weight {
            return false;
        }
        if let Some(ref cooldown) = self.cooldown_until {
            if cooldown.as_str() > current_date {
                return false;
            }
        }
        true
    }

    /// Mark this memory as resurfaced — increment counter and set cooldown.
    pub fn resurface(&mut self, cooldown_until: &str) {
        self.times_resurfaced += 1;
        self.cooldown_until = Some(cooldown_until.to_string());
    }

    /// Decay emotional weight over time (call weekly).
    pub fn decay(&mut self) {
        self.emotional_weight = (self.emotional_weight - 0.02).max(0.0);
    }
}

fn event_type_variant_name(et: &MemoryEventType) -> &'static str {
    match et {
        MemoryEventType::MatchWin => "matchwin",
        MemoryEventType::MatchLoss => "matchloss",
        MemoryEventType::MatchDraw => "matchdraw",
        MemoryEventType::DerbyWin => "derbywin",
        MemoryEventType::DerbyLoss => "derbyloss",
        MemoryEventType::RedCard => "redcard",
        MemoryEventType::RedCardDerby => "redcardderby",
        MemoryEventType::HatTrick => "hattrick",
        MemoryEventType::CleanSheet => "cleansheet",
        MemoryEventType::Injury => "injury",
        MemoryEventType::Comeback => "comeback",
        MemoryEventType::LateWinner => "latewinner",
        MemoryEventType::LateConcession => "lateconcession",
        MemoryEventType::TrophyWon => "trophywon",
        MemoryEventType::TrophyLoss => "trophyloss",
        MemoryEventType::Transfer => "transfer",
        MemoryEventType::ContractSigned => "contractsigned",
        MemoryEventType::ManagerSacked => "managersacked",
        MemoryEventType::ManagerHired => "managerhired",
        MemoryEventType::PublicPromise => "publicpromise",
        MemoryEventType::PromiseBroken => "promisebroken",
        MemoryEventType::PromiseKept => "promisekept",
        MemoryEventType::MediaPraise => "mediapraise",
        MemoryEventType::MediaCriticism => "mediacriticism",
        MemoryEventType::FanBacklash => "fanbacklash",
        MemoryEventType::FanPraise => "fanpraise",
        MemoryEventType::Captaincy => "captaincy",
        MemoryEventType::CaptaincyLost => "captaincylost",
        MemoryEventType::StreakStarted => "streakstarted",
        MemoryEventType::StreakEnded => "streakended",
        MemoryEventType::Slump => "slump",
        MemoryEventType::Breakout => "breakout",
        MemoryEventType::Retirement => "retirement",
        MemoryEventType::Record => "record",
        MemoryEventType::Controversy => "controversy",
        MemoryEventType::Relegation => "relegation",
        MemoryEventType::Promotion => "promotion",
        MemoryEventType::Upset => "upset",
        MemoryEventType::Domination => "domination",
    }
}

// ---------------------------------------------------------------------------
// StoryThread — ongoing narrative arcs
// ---------------------------------------------------------------------------

/// A story thread is an ongoing narrative arc that can escalate or fade.
/// Example: "Player X is on a redemption arc after being sent off in the derby"
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StoryThread {
    pub id: String,
    pub title: String,
    pub entity_id: String,
    pub entity_type: EntityType,
    pub thread_type: ThreadType,
    pub momentum_score: f32,       // 0.0 (dormant) to 100.0 (peak intensity)
    pub escalation_tier: EscalationTier,
    pub media_visibility: MediaVisibility,
    pub player_impact_weight: f32, // 0.0 to 1.0 — how much this affects the player
    pub started_date: String,
    pub last_updated: String,
    pub related_memory_ids: Vec<String>,
    pub tags: Vec<String>,         // e.g. ["RedemptionArc", "DerbyGhost", "SlumpWatch"]
}

/// The type of story arc.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Hash)]
pub enum ThreadType {
    RedemptionArc,
    SlumpWatch,
    BreakoutStory,
    DeclineQuestioned,
    UnderFire,
    FanFavourite,
    PunditDivided,
    TransferRumoured,
    NemesisBrewing,
    DerbyGhost,
    RevengeFixture,
    ProvingThemWrong,
    FeelingTheHeat,
    IceInTheVeins,
    Streak,
    Comeback,
    Controversy,
    PromiseArc,
}

/// Story escalation tiers.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum EscalationTier {
    /// Weekly noise — minor events that barely register.
    Minor,
    /// Multi-week arc — fans and media are talking.
    Arc,
    /// Season defining — this will be remembered for years.
    Legendary,
}

impl Default for EscalationTier {
    fn default() -> Self {
        EscalationTier::Minor
    }
}

impl StoryThread {
    pub fn new(
        title: &str,
        entity_id: &str,
        entity_type: EntityType,
        thread_type: ThreadType,
        date: &str,
    ) -> Self {
        let id = format!("thread_{}_{}_{}", entity_id, date.replace('-', ""), thread_type_name(&thread_type));
        Self {
            id,
            title: title.to_string(),
            entity_id: entity_id.to_string(),
            entity_type,
            thread_type,
            momentum_score: 10.0, // Start with some momentum
            escalation_tier: EscalationTier::Minor,
            media_visibility: MediaVisibility::Local,
            player_impact_weight: 0.3,
            started_date: date.to_string(),
            last_updated: date.to_string(),
            related_memory_ids: Vec::new(),
            tags: Vec::new(),
        }
    }

    /// Add momentum to this thread.
    pub fn add_momentum(&mut self, amount: f32, media_bias: f32, rivalry_amplifier: f32, pundit_disagreement: f32) {
        // See BIBLE_CURATED.md §24
        self.momentum_score += (amount * media_bias) + rivalry_amplifier + pundit_disagreement;
        self.momentum_score = self.momentum_score.min(100.0);

        // Check for escalation
        if self.momentum_score >= 70.0 {
            self.escalation_tier = EscalationTier::Legendary;
        } else if self.momentum_score >= 40.0 {
            self.escalation_tier = EscalationTier::Arc;
        }

        // Increase media visibility with momentum
        if self.momentum_score > 60.0 {
            self.media_visibility = MediaVisibility::International;
        } else if self.momentum_score > 40.0 {
            self.media_visibility = MediaVisibility::National;
        }
    }

    /// Decay momentum (call weekly — 15% decay per BIBLE_CURATED.md §24).
    pub fn decay(&mut self) {
        self.momentum_score = (self.momentum_score * 0.85).max(0.0);

        // De-escalate if momentum drops
        if self.momentum_score < 20.0 {
            self.escalation_tier = EscalationTier::Minor;
        } else if self.momentum_score < 50.0 {
            self.escalation_tier = EscalationTier::Arc;
        }
    }

    /// Is this thread active (has momentum)?
    pub fn is_active(&self) -> bool {
        self.momentum_score > 5.0
    }

    /// Is this thread at legendary tier?
    pub fn is_legendary(&self) -> bool {
        self.escalation_tier == EscalationTier::Legendary
    }

    /// Link a memory to this thread.
    pub fn link_memory(&mut self, memory_id: &str) {
        if !self.related_memory_ids.contains(&memory_id.to_string()) {
            self.related_memory_ids.push(memory_id.to_string());
        }
    }
}

fn thread_type_name(tt: &ThreadType) -> &'static str {
    match tt {
        ThreadType::RedemptionArc => "redemption",
        ThreadType::SlumpWatch => "slump",
        ThreadType::BreakoutStory => "breakout",
        ThreadType::DeclineQuestioned => "decline",
        ThreadType::UnderFire => "underfire",
        ThreadType::FanFavourite => "fanfav",
        ThreadType::PunditDivided => "punditdivided",
        ThreadType::TransferRumoured => "transfer",
        ThreadType::NemesisBrewing => "nemesis",
        ThreadType::DerbyGhost => "derbyghost",
        ThreadType::RevengeFixture => "revenge",
        ThreadType::ProvingThemWrong => "proving",
        ThreadType::FeelingTheHeat => "heat",
        ThreadType::IceInTheVeins => "ice",
        ThreadType::Streak => "streak",
        ThreadType::Comeback => "comeback",
        ThreadType::Controversy => "controversy",
        ThreadType::PromiseArc => "promise",
    }
}

// ---------------------------------------------------------------------------
// NarrativeCooldownRegistry — 12-week minimum reuse prevention
// ---------------------------------------------------------------------------

/// Tracks which narrative tags/patterns have been used recently.
/// Prevents the same story beat from repeating within 12 weeks.
/// See: BIBLE_CURATED.md §10
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NarrativeCooldownRegistry {
    /// Map of tag → ISO date when the tag can be used again.
    #[serde(default)]
    cooldowns: HashMap<String, String>,

    /// Context gate: requires 2+ triggers before escalation.
    /// Map of tag → trigger count.
    #[serde(default)]
    trigger_counts: HashMap<String, u8>,
}

/// 12 weeks in days.
const COOLDOWN_DAYS: i64 = 84;

impl NarrativeCooldownRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Check if a tag is on cooldown.
    pub fn is_on_cooldown(&self, tag: &str, current_date: &str) -> bool {
        if let Some(until) = self.cooldowns.get(tag) {
            return until.as_str() > current_date;
        }
        false
    }

    /// Set a cooldown for a tag (12 weeks from current_date).
    pub fn set_cooldown(&mut self, tag: &str, current_date: &str) {
        // Parse current date and add 84 days
        if let Ok(date) = chrono::NaiveDate::parse_from_str(current_date, "%Y-%m-%d") {
            let until = date + chrono::Duration::days(COOLDOWN_DAYS);
            self.cooldowns.insert(tag.to_string(), until.format("%Y-%m-%d").to_string());
        }
    }

    /// Register a trigger for a tag (context gate: need 2+ before escalation).
    /// Returns true if the tag has enough triggers to escalate.
    pub fn register_trigger(&mut self, tag: &str) -> bool {
        let count = self.trigger_counts.entry(tag.to_string()).or_insert(0);
        *count += 1;
        *count >= 2
    }

    /// Reset trigger count for a tag (after escalation fires).
    pub fn reset_triggers(&mut self, tag: &str) {
        self.trigger_counts.remove(tag);
    }

    /// Get all tags currently on cooldown.
    pub fn cooled_tags(&self) -> Vec<&String> {
        self.cooldowns.keys().collect()
    }

    /// Clear expired cooldowns (call weekly).
    pub fn clear_expired(&mut self, current_date: &str) {
        self.cooldowns.retain(|_, until| until.as_str() > current_date);
    }
}

// ---------------------------------------------------------------------------
// MemoryStore — stores all memories per entity
// ---------------------------------------------------------------------------

/// Stores memories for all entities (players, teams, managers).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MemoryStore {
    /// Memories keyed by entity_id.
    #[serde(default)]
    memories: HashMap<String, Vec<Memory>>,

    /// Active story threads.
    #[serde(default)]
    story_threads: Vec<StoryThread>,

    /// Cooldown registry.
    #[serde(default)]
    cooldown_registry: NarrativeCooldownRegistry,
}

impl MemoryStore {
    pub fn new() -> Self {
        Self::default()
    }

    /// Store a new memory.
    pub fn add_memory(&mut self, memory: Memory) {
        self.memories
            .entry(memory.entity_id.clone())
            .or_insert_with(Vec::new)
            .push(memory);
    }

    /// Get all memories for an entity.
    pub fn memories_for(&self, entity_id: &str) -> &[Memory] {
        self.memories
            .get(entity_id)
            .map(|v| v.as_slice())
            .unwrap_or(&[])
    }

    /// Get memories eligible for resurfacing.
    pub fn resurfacing_candidates(&self, entity_id: &str, current_date: &str, min_weight: f32) -> Vec<&Memory> {
        self.memories
            .get(entity_id)
            .map(|v| {
                v.iter()
                    .filter(|m| m.can_resurface(current_date, min_weight))
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Get a mutable reference to a memory (for resurfacing updates).
    pub fn get_memory_mut(&mut self, memory_id: &str) -> Option<&mut Memory> {
        for memories in self.memories.values_mut() {
            if let Some(idx) = memories.iter().position(|m| m.id == memory_id) {
                return Some(&mut memories[idx]);
            }
        }
        None
    }

    /// Add a story thread.
    pub fn add_thread(&mut self, thread: StoryThread) {
        self.story_threads.push(thread);
    }

    /// Get active story threads.
    pub fn active_threads(&self) -> Vec<&StoryThread> {
        self.story_threads.iter().filter(|t| t.is_active()).collect()
    }

    /// Get story threads for a specific entity.
    pub fn threads_for(&self, entity_id: &str) -> Vec<&StoryThread> {
        self.story_threads
            .iter()
            .filter(|t| t.entity_id == entity_id && t.is_active())
            .collect()
    }

    /// Get a mutable story thread by ID.
    pub fn get_thread_mut(&mut self, thread_id: &str) -> Option<&mut StoryThread> {
        self.story_threads.iter_mut().find(|t| t.id == thread_id)
    }

    /// Decay all memories and threads (call weekly).
    pub fn weekly_decay(&mut self, current_date: &str) {
        for memories in self.memories.values_mut() {
            for m in memories.iter_mut() {
                m.decay();
            }
        }
        for thread in &mut self.story_threads {
            thread.decay();
        }
        // Remove dead threads (momentum < 1.0)
        self.story_threads.retain(|t| t.momentum_score > 1.0);
        // Clear expired cooldowns
        self.cooldown_registry.clear_expired(current_date);
    }

    /// Total memory count.
    pub fn memory_count(&self) -> usize {
        self.memories.values().map(|v| v.len()).sum()
    }

    /// Active thread count.
    pub fn active_thread_count(&self) -> usize {
        self.story_threads.iter().filter(|t| t.is_active()).count()
    }

    /// Access cooldown registry.
    pub fn cooldown_registry(&self) -> &NarrativeCooldownRegistry {
        &self.cooldown_registry
    }

    /// Mutable access to cooldown registry.
    pub fn cooldown_registry_mut(&mut self) -> &mut NarrativeCooldownRegistry {
        &mut self.cooldown_registry
    }
}

// ---------------------------------------------------------------------------
// NarrativeEngine — the main engine that processes events and creates memories
// ---------------------------------------------------------------------------

/// The narrative engine processes match events and game events to create
/// memories, update story threads, and manage cooldowns.
pub struct NarrativeEngine<'a> {
    memory_store: &'a mut MemoryStore,
    current_date: &'a str,
}

impl<'a> NarrativeEngine<'a> {
    pub fn new(memory_store: &'a mut MemoryStore, current_date: &'a str) -> Self {
        Self { memory_store, current_date }
    }

    /// Process a match result and generate memories + story threads.
    pub fn process_match_result(
        &mut self,
        home_team_id: &str,
        away_team_id: &str,
        home_goals: u8,
        away_goals: u8,
        is_rivalry: bool,
        player_stats: &[(String, u8, u8, u8, f32)], // (player_id, goals, assists, red_cards, rating)
    ) {
        let home_won = home_goals > away_goals;
        let away_won = away_goals > home_goals;
        let _is_draw = home_goals == away_goals;
        let goal_diff = (home_goals as i16 - away_goals as i16).unsigned_abs();

        // Team-level memories
        if is_rivalry {
            if home_won {
                self.create_memory(home_team_id, EntityType::Team, MemoryEventType::DerbyWin, 0.8,
                    &format!("Won the derby {}-{}", home_goals, away_goals), Some(away_team_id));
                self.create_memory(away_team_id, EntityType::Team, MemoryEventType::DerbyLoss, 0.7,
                    &format!("Lost the derby {}-{}", away_goals, home_goals), Some(home_team_id));
            } else if away_won {
                self.create_memory(away_team_id, EntityType::Team, MemoryEventType::DerbyWin, 0.8,
                    &format!("Won the derby {}-{}", away_goals, home_goals), Some(home_team_id));
                self.create_memory(home_team_id, EntityType::Team, MemoryEventType::DerbyLoss, 0.7,
                    &format!("Lost the derby {}-{}", home_goals, away_goals), Some(away_team_id));
            }
        }

        // Domination memory (3+ goal difference)
        if goal_diff >= 3 {
            let (winner, loser, wg, lg) = if home_won { (home_team_id, away_team_id, home_goals, away_goals) } else { (away_team_id, home_team_id, away_goals, home_goals) };
            self.create_memory(winner, EntityType::Team, MemoryEventType::Domination, 0.6,
                &format!("Dominant {}-{} win", wg, lg), Some(loser));
        }

        // Upset (lower-reputation team beats higher — simplified: just check if away team won by 2+)
        if away_won && goal_diff >= 2 {
            self.create_memory(away_team_id, EntityType::Team, MemoryEventType::Upset, 0.7,
                &format!("Upset away win {}-{}", away_goals, home_goals), Some(home_team_id));
        }

        // Player-level memories
        for (player_id, goals, assists, red_cards, rating) in player_stats {
            // Hat trick
            if *goals >= 3 {
                self.create_memory(player_id, EntityType::Player, MemoryEventType::HatTrick, 0.9,
                    &format!("Scored a hat-trick ({} goals)", goals), None);
                self.create_or_boost_thread(player_id, EntityType::Player, ThreadType::BreakoutStory, 15.0, "Hat-trick performance");
            }

            // Red card
            if *red_cards > 0 {
                let event_type = if is_rivalry { MemoryEventType::RedCardDerby } else { MemoryEventType::RedCard };
                let weight = if is_rivalry { 0.8 } else { 0.5 };
                self.create_memory(player_id, EntityType::Player, event_type, weight,
                    &format!("Sent off{}", if is_rivalry { " in the derby" } else { "" }), None);
            }

            // Outstanding rating
            if *rating >= 8.5 {
                self.create_memory(player_id, EntityType::Player, MemoryEventType::MatchWin, 0.5,
                    &format!("Man of the match performance (rating {:.1})", rating), None);
            }

            // Poor rating
            if *rating > 0.0 && *rating < 5.0 {
                self.create_memory(player_id, EntityType::Player, MemoryEventType::Slump, 0.4,
                    &format!("Poor performance (rating {:.1})", rating), None);
                self.create_or_boost_thread(player_id, EntityType::Player, ThreadType::SlumpWatch, 5.0, "Concerning performance");
            }
        }

        // Check for late winner (simplified — just check if someone won)
        // Full implementation would check match events for goals in 85+ minute
    }

    /// Create a memory and store it.
    fn create_memory(
        &mut self,
        entity_id: &str,
        entity_type: EntityType,
        event_type: MemoryEventType,
        emotional_weight: f32,
        description: &str,
        related_entity_id: Option<&str>,
    ) {
        let mut memory = Memory::new(event_type, entity_id, entity_type, self.current_date, emotional_weight, description);
        memory.related_entity_id = related_entity_id.map(|s| s.to_string());
        self.memory_store.add_memory(memory);
    }

    /// Create a new story thread or boost an existing one.
    fn create_or_boost_thread(
        &mut self,
        entity_id: &str,
        entity_type: EntityType,
        thread_type: ThreadType,
        momentum: f32,
        description: &str,
    ) {
        // Check if a thread of this type already exists for this entity
        let existing = self.memory_store.story_threads
            .iter_mut()
            .find(|t| t.entity_id == entity_id && t.thread_type == thread_type);

        if let Some(thread) = existing {
            thread.add_momentum(momentum, 1.0, 0.0, 0.0);
            thread.last_updated = self.current_date.to_string();
        } else {
            let mut thread = StoryThread::new(description, entity_id, entity_type, thread_type, self.current_date);
            thread.add_momentum(momentum, 1.0, 0.0, 0.0);
            self.memory_store.add_thread(thread);
        }
    }

    /// Check for memories that should resurface in the current context.
    /// Returns Vec of (memory, resurfacing_reason).
    pub fn check_resurfacing(
        &self,
        entity_id: &str,
        min_weight: f32,
    ) -> Vec<(&Memory, String)> {
        let candidates = self.memory_store.resurfacing_candidates(entity_id, self.current_date, min_weight);
        candidates
            .into_iter()
            .map(|m| {
                let reason = format!("{:?} resurfaces: '{}'", m.entity_type, m.description);
                (m, reason)
            })
            .collect()
    }

    /// Mark a memory as resurfaced (sets cooldown).
    pub fn resurface_memory(&mut self, memory_id: &str) {
        if let Some(memory) = self.memory_store.get_memory_mut(memory_id) {
            // Set 12-week cooldown
            if let Ok(date) = chrono::NaiveDate::parse_from_str(self.current_date, "%Y-%m-%d") {
                let until = date + chrono::Duration::days(COOLDOWN_DAYS);
                memory.resurface(&until.format("%Y-%m-%d").to_string());
            }
        }
    }

    /// Get active story threads for an entity.
    pub fn active_threads_for(&self, entity_id: &str) -> Vec<&StoryThread> {
        self.memory_store.threads_for(entity_id)
    }

    /// Get the most prominent story thread for an entity (highest momentum).
    pub fn top_thread_for(&self, entity_id: &str) -> Option<&StoryThread> {
        self.memory_store.threads_for(entity_id)
            .into_iter()
            .max_by(|a, b| a.momentum_score.partial_cmp(&b.momentum_score).unwrap_or(std::cmp::Ordering::Equal))
    }
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn memory_creation_and_resurfacing() {
        let mut mem = Memory::new(MemoryEventType::DerbyWin, "team_1", EntityType::Team, "2026-07-15", 0.8, "Won the derby 3-0");
        assert!(mem.can_resurface("2026-07-20", 0.5));
        assert!(!mem.can_resurface("2026-07-20", 0.9)); // Weight too high threshold

        mem.resurface("2026-10-15"); // 12 weeks later
        assert!(!mem.can_resurface("2026-09-01", 0.5)); // On cooldown
        assert!(mem.can_resurface("2026-10-16", 0.5)); // Cooldown expired
        assert_eq!(mem.times_resurfaced, 1);
    }

    #[test]
    fn memory_decay() {
        let mut mem = Memory::new(MemoryEventType::HatTrick, "p1", EntityType::Player, "2026-07-15", 0.9, "Hat-trick");
        for _ in 0..10 {
            mem.decay();
        }
        assert!(mem.emotional_weight < 0.9);
        assert!(mem.emotional_weight > 0.5); // 10 weeks of -0.02 = -0.20
    }

    #[test]
    fn story_thread_momentum_and_escalation() {
        let mut thread = StoryThread::new("Redemption Arc", "p1", EntityType::Player, ThreadType::RedemptionArc, "2026-07-15");
        assert_eq!(thread.escalation_tier, EscalationTier::Minor);

        thread.add_momentum(30.0, 1.0, 5.0, 5.0); // 30 + 5 + 5 = 40 → Arc tier
        assert_eq!(thread.escalation_tier, EscalationTier::Arc);

        thread.add_momentum(30.0, 1.0, 5.0, 5.0); // 40 + 40 = 80 → Legendary
        assert_eq!(thread.escalation_tier, EscalationTier::Legendary);
        assert!(thread.is_legendary());
    }

    #[test]
    fn story_thread_decay() {
        let mut thread = StoryThread::new("Slump", "p1", EntityType::Player, ThreadType::SlumpWatch, "2026-07-15");
        thread.add_momentum(50.0, 1.0, 0.0, 0.0);
        assert!(thread.is_active());

        for _ in 0..20 {
            thread.decay();
        }
        assert!(!thread.is_active()); // Should be dormant after 20 weeks
    }

    #[test]
    fn cooldown_registry() {
        let mut reg = NarrativeCooldownRegistry::new();
        assert!(!reg.is_on_cooldown("RedemptionArc", "2026-07-15"));

        reg.set_cooldown("RedemptionArc", "2026-07-15");
        assert!(reg.is_on_cooldown("RedemptionArc", "2026-09-01")); // Still on cooldown
        assert!(!reg.is_on_cooldown("RedemptionArc", "2026-10-16")); // 12+ weeks passed
    }

    #[test]
    fn context_gate_requires_two_triggers() {
        let mut reg = NarrativeCooldownRegistry::new();
        assert!(!reg.register_trigger("SlumpWatch")); // First trigger — not enough
        assert!(reg.register_trigger("SlumpWatch")); // Second trigger — can escalate
        reg.reset_triggers("SlumpWatch");
        assert!(!reg.register_trigger("SlumpWatch")); // Reset — back to 0
    }

    #[test]
    fn memory_store_add_and_retrieve() {
        let mut store = MemoryStore::new();
        store.add_memory(Memory::new(MemoryEventType::HatTrick, "p1", EntityType::Player, "2026-07-15", 0.9, "Hat-trick vs rivals"));
        store.add_memory(Memory::new(MemoryEventType::RedCard, "p1", EntityType::Player, "2026-08-01", 0.5, "Sent off"));

        assert_eq!(store.memory_count(), 2);
        assert_eq!(store.memories_for("p1").len(), 2);
        assert_eq!(store.memories_for("p2").len(), 0);
    }

    #[test]
    fn narrative_engine_creates_memories_from_match() {
        let mut store = MemoryStore::new();
        let mut engine = NarrativeEngine::new(&mut store, "2026-07-15");

        let player_stats = vec![
            ("p1".to_string(), 3u8, 0u8, 0u8, 9.0f32), // Hat-trick
            ("p2".to_string(), 0u8, 0u8, 1u8, 4.5f32), // Red card + poor rating
        ];

        engine.process_match_result("team_1", "team_2", 3, 0, true, &player_stats);

        assert!(store.memory_count() > 0);
        // Should have derby win memory for team_1
        assert!(store.memories_for("team_1").iter().any(|m| m.event_type == MemoryEventType::DerbyWin));
        // Should have hat-trick memory for p1
        assert!(store.memories_for("p1").iter().any(|m| m.event_type == MemoryEventType::HatTrick));
        // Should have red card memory for p2
        assert!(store.memories_for("p2").iter().any(|m| m.event_type == MemoryEventType::RedCardDerby));
    }

    #[test]
    fn narrative_engine_creates_story_threads() {
        let mut store = MemoryStore::new();
        let mut engine = NarrativeEngine::new(&mut store, "2026-07-15");

        let player_stats = vec![
            ("p1".to_string(), 3u8, 0u8, 0u8, 9.0f32), // Hat-trick → breakout thread
        ];

        engine.process_match_result("team_1", "team_2", 3, 0, false, &player_stats);

        assert!(store.active_thread_count() > 0);
        assert!(store.threads_for("p1").iter().any(|t| t.thread_type == ThreadType::BreakoutStory));
    }

    #[test]
    fn narrative_engine_resurfacing() {
        let mut store = MemoryStore::new();
        // Add a memory from 6 months ago
        store.add_memory(Memory::new(MemoryEventType::DerbyLoss, "team_1", EntityType::Team, "2026-01-15", 0.8, "Lost derby 0-3"));

        let engine = NarrativeEngine::new(&mut store, "2026-07-15");
        let candidates = engine.check_resurfacing("team_1", 0.5);
        assert!(!candidates.is_empty());
        assert!(candidates[0].0.event_type == MemoryEventType::DerbyLoss);
    }

    #[test]
    fn weekly_decay_removes_dead_threads() {
        let mut store = MemoryStore::new();
        let mut thread = StoryThread::new("Old Story", "p1", EntityType::Player, ThreadType::SlumpWatch, "2026-01-01");
        thread.momentum_score = 0.5; // Nearly dead
        store.add_thread(thread);

        store.weekly_decay("2026-07-15");
        assert_eq!(store.active_thread_count(), 0); // Thread removed
    }
}
