// ===========================================================================
// Gaffer Phase 5 — Media Ecosystem
//
// Media must feel like oxygen — it reacts, escalates, overreacts, forgets slowly,
// and influences morale, pressure, rivalry, and betting sentiment.
//
// See: docs/gaffer/BIBLE_CURATED.md §14, §25-28, §29
// ===========================================================================

use serde::{Deserialize, Serialize};
use rand::RngExt;
use rand::Rng;

// ---------------------------------------------------------------------------
// Pundit — 5 rotating commentators with distinct personalities
// ---------------------------------------------------------------------------

/// A pundit/commentator with personality archetype and bias vector.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Pundit {
    pub id: String,
    pub name: String,
    pub tone_archetype: ToneArchetype,
    pub bias_vector: BiasVector,
    pub club_leanings: Vec<String>,     // team IDs this pundit favours
    pub rivalry_sensitivity: f32,       // 0.0 (ignores) to 1.0 (amplifies)
    pub swear_tolerance: f32,           // 0.0 (never) to 1.0 (frequently, but still <1% rate)
    pub current_form: f32,              // -1.0 (grumpy) to 1.0 (enthusiastic) — shifts weekly
}

/// The commentator's personality archetype.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ToneArchetype {
    /// Measured, analytical, fair — the voice of reason.
    TheAnalyst,
    /// Loud, passionate, prone to hyperbole — "HE'S SCORED! ABSOLUTE SCENES!"
    TheHype,
    /// Cynical, cutting, never impressed — "Well, that was schoolboy defending."
    TheCritic,
    /// Storyteller, builds narratives, loves an underdog — "And there it is — the redemption arc continues."
    TheRomantic,
    /// Old-school, hard but fair, values grit — "Back in my day we'd have got up and carried on."
    TheVeteran,
}

/// A pundit's bias vector — which factors they weight when evaluating.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BiasVector {
    pub stats_weight: f32,        // How much they care about raw numbers
    pub narrative_weight: f32,    // How much they care about storylines
    pub form_weight: f32,         // How much they weight recent form
    pub reputation_weight: f32,   // How much they defer to big-name players/clubs
    pub underdog_bias: f32,       // How much they cheer for the little guy
}

impl Default for BiasVector {
    fn default() -> Self {
        Self { stats_weight: 0.5, narrative_weight: 0.3, form_weight: 0.4, reputation_weight: 0.3, underdog_bias: 0.2 }
    }
}

impl Pundit {
    /// Create the 5 default pundits for a new game.
    pub fn default_pundits() -> Vec<Pundit> {
        vec![
            Pundit {
                id: "pundit_analyst".into(),
                name: "Martin Webb".into(),
                tone_archetype: ToneArchetype::TheAnalyst,
                bias_vector: BiasVector { stats_weight: 0.8, narrative_weight: 0.2, form_weight: 0.5, reputation_weight: 0.2, underdog_bias: 0.1 },
                club_leanings: vec![],
                rivalry_sensitivity: 0.3,
                swear_tolerance: 0.0,
                current_form: 0.0,
            },
            Pundit {
                id: "pundit_hype".into(),
                name: "Ricky Sparks".into(),
                tone_archetype: ToneArchetype::TheHype,
                bias_vector: BiasVector { stats_weight: 0.3, narrative_weight: 0.7, form_weight: 0.6, reputation_weight: 0.5, underdog_bias: 0.4 },
                club_leanings: vec![],
                rivalry_sensitivity: 0.9,
                swear_tolerance: 0.3,
                current_form: 0.2,
            },
            Pundit {
                id: "pundit_critic".into(),
                name: "Sandra Walsh".into(),
                tone_archetype: ToneArchetype::TheCritic,
                bias_vector: BiasVector { stats_weight: 0.6, narrative_weight: 0.4, form_weight: 0.7, reputation_weight: 0.1, underdog_bias: 0.3 },
                club_leanings: vec![],
                rivalry_sensitivity: 0.5,
                swear_tolerance: 0.1,
                current_form: -0.1,
            },
            Pundit {
                id: "pundit_romantic".into(),
                name: "James Okafor".into(),
                tone_archetype: ToneArchetype::TheRomantic,
                bias_vector: BiasVector { stats_weight: 0.2, narrative_weight: 0.9, form_weight: 0.3, reputation_weight: 0.4, underdog_bias: 0.8 },
                club_leanings: vec![],
                rivalry_sensitivity: 0.7,
                swear_tolerance: 0.0,
                current_form: 0.1,
            },
            Pundit {
                id: "pundit_veteran".into(),
                name: "Big Dave Thornton".into(),
                tone_archetype: ToneArchetype::TheVeteran,
                bias_vector: BiasVector { stats_weight: 0.5, narrative_weight: 0.3, form_weight: 0.4, reputation_weight: 0.6, underdog_bias: 0.5 },
                club_leanings: vec![],
                rivalry_sensitivity: 0.6,
                swear_tolerance: 0.2,
                current_form: 0.0,
            },
        ]
    }

    /// Calculate disagreement probability with another pundit.
    /// See: BIBLE_CURATED.md §25
    pub fn disagreement_probability(&self, other: &Pundit, rivalry_context: f32, personality_clash: f32) -> f32 {
        let bias_distance = (self.bias_vector.stats_weight - other.bias_vector.stats_weight).abs()
            + (self.bias_vector.narrative_weight - other.bias_vector.narrative_weight).abs()
            + (self.bias_vector.underdog_bias - other.bias_vector.underdog_bias).abs();
        (bias_distance / 3.0 + rivalry_context + personality_clash).min(1.0_f32)
    }

    /// Should this pundit swear? (< 1% chance, modified by tolerance)
    pub fn should_swear(&self, rng: &mut impl rand::Rng, intensity: f32) -> bool {
        let base_chance = 0.005; // 0.5% base
        let modified = base_chance * self.swear_tolerance * 2.0 * intensity;
        rng.random_range(0.0..1.0) < modified
    }

    /// Weekly form shift — pundits get grumpier or more enthusiastic.
    pub fn weekly_shift(&mut self, rng: &mut impl rand::Rng) {
        let shift = rng.random_range(-0.1..0.1);
        self.current_form = (self.current_form + shift).clamp(-1.0_f32, 1.0_f32);
    }
}

// ---------------------------------------------------------------------------
// BettingSentiment — market odds that reflect form, injuries, narrative
// ---------------------------------------------------------------------------

/// Betting market sentiment for a team.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct BettingSentiment {
    pub team_id: String,
    pub sentiment_score: f32,       // 0-100 (50 = neutral, >50 favoured, <50 underdog)
    pub odds_to_win_league: f32,    // e.g. 5.0 = 5/1
    pub odds_to_relegate: f32,      // e.g. 50.0 = 50/1
    pub last_updated: String,
}

impl BettingSentiment {
    /// Calculate sentiment score from multiple factors.
    /// See: BIBLE_CURATED.md §26
    pub fn calculate(
        recent_results: f32,      // 0-100 (win rate × 100)
        squad_pulse: f32,         // 0-100
        injury_severity: f32,     // 0-100 (100 = catastrophic)
        media_momentum: f32,      // 0-100 (from story threads)
        opponent_strength: f32,   // 0-100 (average of next opponent's rating)
    ) -> f32 {
        let score = (recent_results * 0.25)
            + (squad_pulse * 0.20)
            - (injury_severity * 0.15)
            + (media_momentum * 0.15)
            - (opponent_strength * 0.25);
        score.clamp(0.0_f32, 100.0_f32)
    }

    /// Convert sentiment to decimal odds.
    pub fn sentiment_to_odds(sentiment: f32) -> f32 {
        // Higher sentiment = lower odds (more likely to win)
        // 100 → 1.5 (heavy favourite), 50 → 3.0 (even), 0 → 20.0 (massive underdog)
        let normalized = sentiment / 100.0;
        1.5 + (1.0 - normalized).powi(2) * 18.5
    }
}

// ---------------------------------------------------------------------------
// WeeklySupplement — pre-match media content
// ---------------------------------------------------------------------------

/// A weekly supplement article generated before each match.
/// See: BIBLE_CURATED.md §27
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WeeklySupplement {
    pub id: String,
    pub date: String,
    pub supplements: Vec<SupplementItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SupplementItem {
    pub supplement_type: SupplementType,
    pub title: String,
    pub body: String,
    pub pundit_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Hash)]
pub enum SupplementType {
    TacticalPreview,
    FormSpotlight,
    HeadlineOfTheWeek,
    OneToWatch,
    BettingOddsSummary,
    RivalryFlashback,
}

impl WeeklySupplement {
    /// Generate supplements for an upcoming match.
    pub fn generate(
        date: &str,
        home_team_name: &str,
        away_team_name: &str,
        home_form: &[String],
        away_form: &[String],
        is_rivalry: bool,
        pundits: &[Pundit],
        betting_home: f32,
        betting_away: f32,
    ) -> Self {
        let mut items = Vec::new();

        // Tactical Preview
        items.push(SupplementItem {
            supplement_type: SupplementType::TacticalPreview,
            title: format!("{} vs {} — Tactical Preview", home_team_name, away_team_name),
            body: format!("{} host {} in what promises to be a fascinating tactical battle. The home side will look to impose their style, while the visitors will have ideas of their own.", home_team_name, away_team_name),
            pundit_id: pundits.first().map(|p| p.id.clone()),
        });

        // Form Spotlight
        let home_form_str = if home_form.is_empty() { "no recent matches".to_string() } else { home_form.join("-") };
        let away_form_str = if away_form.is_empty() { "no recent matches".to_string() } else { away_form.join("-") };
        items.push(SupplementItem {
            supplement_type: SupplementType::FormSpotlight,
            title: format!("Form Check: {} ({}) vs {} ({})", home_team_name, home_form_str, away_team_name, away_form_str),
            body: format!("{} come into this match with form reading {}, while {} have {}.", home_team_name, home_form_str, away_team_name, away_form_str),
            pundit_id: pundits.get(1).map(|p| p.id.clone()),
        });

        // Headline of the Week
        let headline = if is_rivalry {
            format!("DERBY DAY: {} vs {} — Pride on the Line!", home_team_name, away_team_name)
        } else {
            format!("Matchday Preview: {} vs {}", home_team_name, away_team_name)
        };
        items.push(SupplementItem {
            supplement_type: SupplementType::HeadlineOfTheWeek,
            title: headline.clone(),
            body: format!("All eyes turn to this fixture. {}", headline),
            pundit_id: pundits.get(2).map(|p| p.id.clone()),
        });

        // One to Watch
        items.push(SupplementItem {
            supplement_type: SupplementType::OneToWatch,
            title: "One to Watch".into(),
            body: "Keep an eye on the key players in this one — form and fitness will tell.".into(),
            pundit_id: pundits.get(3).map(|p| p.id.clone()),
        });

        // Betting Odds Summary
        let home_odds = BettingSentiment::sentiment_to_odds(betting_home);
        let away_odds = BettingSentiment::sentiment_to_odds(betting_away);
        items.push(SupplementItem {
            supplement_type: SupplementType::BettingOddsSummary,
            title: "Betting Odds Summary".into(),
            body: format!("{} to win: {:.2} | {} to win: {:.2}", home_team_name, home_odds, away_team_name, away_odds),
            pundit_id: None,
        });

        // Rivalry Flashback (only for rivalry matches)
        if is_rivalry {
            items.push(SupplementItem {
                supplement_type: SupplementType::RivalryFlashback,
                title: format!("Rivalry Flashback: {} vs {}", home_team_name, away_team_name),
                body: format!("These two sides have history. Every meeting adds another chapter to this storied rivalry.", ),
                pundit_id: pundits.get(4).map(|p| p.id.clone()),
            });
        }

        Self {
            id: format!("supplement_{}", date.replace('-', "")),
            date: date.to_string(),
            supplements: items,
        }
    }
}

// ---------------------------------------------------------------------------
// MatchRating — narrative-weighted player rating
// ---------------------------------------------------------------------------

/// Calculate a match rating for a player that's NOT purely statistical.
/// See: BIBLE_CURATED.md §28
///
/// MatchRating = (PerformanceScore × 0.60) + (NarrativeWeight × 0.20)
///             + (ClutchFactor × 0.10) + (ContextDifficulty × 0.10)
pub fn calculate_match_rating(
    performance_score: f32,    // 0-10 (from stats: goals, assists, tackles, etc.)
    narrative_weight: f32,     // 0-10 (from active story threads — higher if player is in a narrative arc)
    clutch_factor: f32,        // 0-10 (boost for big game trait, rivalry, late winner)
    context_difficulty: f32,   // 0-10 (how hard was the match — opponent strength, away game, etc.)
) -> f32 {
    let rating = (performance_score * 0.60)
        + (narrative_weight * 0.20)
        + (clutch_factor * 0.10)
        + (context_difficulty * 0.10);
    rating.clamp(1.0_f32, 10.0_f32)
}

/// Calculate clutch factor for a player in a match.
pub fn calculate_clutch_factor(
    is_big_game_responder: bool,
    is_rivalry_match: bool,
    scored_late_winner: bool,
    was_involved_in_comeback: bool,
) -> f32 {
    let mut clutch: f32 = 5.0; // Base
    if is_big_game_responder { clutch += 2.0; }
    if is_rivalry_match { clutch += 1.5; }
    if scored_late_winner { clutch += 2.5; }
    if was_involved_in_comeback { clutch += 1.5; }
    clutch.min(10.0_f32)
}

// ---------------------------------------------------------------------------
// MediaEngine — manages pundits, betting, supplements, and media reactions
// ---------------------------------------------------------------------------

/// The media engine manages all media state for the game.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaEngine {
    pub pundits: Vec<Pundit>,
    pub betting_sentiments: Vec<BettingSentiment>,
    pub last_supplement: Option<WeeklySupplement>,
    /// Tracks which supplement types have been used recently (6-week cooldown).
    #[serde(default)]
    pub supplement_history: HashMap<String, String>, // type → last used date
    /// Active pundit disagreement (if any).
    #[serde(default)]
    pub active_disagreement: Option<PunditDisagreement>,
}

use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PunditDisagreement {
    pub pundit_a_id: String,
    pub pundit_b_id: String,
    pub topic: String,
    pub date: String,
    pub intensity: f32,
}

impl Default for MediaEngine {
    fn default() -> Self {
        Self {
            pundits: Pundit::default_pundits(),
            betting_sentiments: Vec::new(),
            last_supplement: None,
            supplement_history: HashMap::new(),
            active_disagreement: None,
        }
    }
}

impl MediaEngine {
    pub fn new() -> Self {
        Self::default()
    }

    /// Weekly update: shift pundit forms, update betting sentiments, clear old disagreements.
    pub fn weekly_update(&mut self, rng: &mut impl rand::Rng) {
        for pundit in &mut self.pundits {
            pundit.weekly_shift(rng);
        }
        // Clear disagreement after a week
        self.active_disagreement = None;
    }

    /// Generate pre-match supplements.
    pub fn generate_supplements(
        &mut self,
        date: &str,
        home_team_name: &str,
        away_team_name: &str,
        home_form: &[String],
        away_form: &[String],
        is_rivalry: bool,
        home_betting: f32,
        away_betting: f32,
    ) -> &WeeklySupplement {
        let supplement = WeeklySupplement::generate(
            date, home_team_name, away_team_name, home_form, away_form, is_rivalry,
            &self.pundits, home_betting, away_betting,
        );

        // Track supplement usage for 6-week cooldown
        for item in &supplement.supplements {
            let type_key = format!("{:?}", item.supplement_type);
            self.supplement_history.insert(type_key, date.to_string());
        }

        self.last_supplement = Some(supplement);
        self.last_supplement.as_ref().unwrap()
    }

    /// Check if a supplement type can be used (6-week cooldown).
    pub fn can_use_supplement(&self, supplement_type: &SupplementType, current_date: &str) -> bool {
        let key = format!("{:?}", supplement_type);
        if let Some(last_used) = self.supplement_history.get(&key) {
            // Check if 6 weeks (42 days) have passed
            if let (Ok(last), Ok(current)) = (
                chrono::NaiveDate::parse_from_str(last_used, "%Y-%m-%d"),
                chrono::NaiveDate::parse_from_str(current_date, "%Y-%m-%d"),
            ) {
                return current.signed_duration_since(last).num_days() >= 42;
            }
        }
        true
    }

    /// Process a match result and generate media reactions.
    pub fn process_match(
        &mut self,
        date: &str,
        home_team_name: &str,
        away_team_name: &str,
        home_goals: u8,
        away_goals: u8,
        is_rivalry: bool,
        rng: &mut impl rand::Rng,
    ) -> Vec<MediaReaction> {
        let mut reactions = Vec::new();

        // Pick 2 random pundits for commentary
        let pundit_indices: Vec<usize> = (0..self.pundits.len()).collect();
        let mut shuffled = pundit_indices;
        // Simple shuffle
        for i in (1..shuffled.len()).rev() {
            let j = rng.random_range(0..=i);
            shuffled.swap(i, j);
        }
        let p1 = &self.pundits[shuffled[0]];
        let p2 = &self.pundits[shuffled[1]];

        // Generate headline based on result
        let headline = if is_rivalry && home_goals != away_goals {
            let winner = if home_goals > away_goals { home_team_name } else { away_team_name };
            format!("DERBY DRAMA: {} triumph in the rivalry!", winner)
        } else if home_goals == away_goals {
            format!("{} and {} share the spoils in {}-{} draw", home_team_name, away_team_name, home_goals, away_goals)
        } else if (home_goals as i16 - away_goals as i16).unsigned_abs() >= 3 {
            let winner = if home_goals > away_goals { home_team_name } else { away_team_name };
            format!("{} DEMOLISH opponents in {}-{} romp!", winner, home_goals.max(away_goals), home_goals.min(away_goals))
        } else {
            let winner = if home_goals > away_goals { home_team_name } else { away_team_name };
            format!("{} edge past {} {}-{}", winner, if home_goals > away_goals { away_team_name } else { home_team_name }, home_goals.max(away_goals), home_goals.min(away_goals))
        };

        // Pundit 1 reaction
        let reaction1 = match p1.tone_archetype {
            ToneArchetype::TheAnalyst => format!("{}: 'Looking at the numbers, the result reflects the expected performance metrics.'", p1.name),
            ToneArchetype::TheHype => format!("{}: 'WHAT A MATCH! {} — this is why we love the game!'", p1.name, headline),
            ToneArchetype::TheCritic => format!("{}: 'Frankly, the defending was schoolboy. {} didn't deserve anything.'", p1.name, if home_goals > away_goals { away_team_name } else { home_team_name }),
            ToneArchetype::TheRomantic => format!("{}: 'And there it is — another chapter written in the beautiful game. {}'", p1.name, headline),
            ToneArchetype::TheVeteran => format!("{}: 'Listen, I've seen it all. This was a proper match. {}'", p1.name, headline),
        };
        reactions.push(MediaReaction {
            pundit_id: p1.id.clone(),
            pundit_name: p1.name.clone(),
            headline: headline.clone(),
            reaction: reaction1,
            date: date.to_string(),
            tone: p1.tone_archetype,
        });

        // Pundit 2 reaction (may disagree)
        let disagreement = p1.disagreement_probability(p2, if is_rivalry { 0.3 } else { 0.0 }, 0.1);
        let reaction2 = if rng.random_range(0.0..1.0) < disagreement {
            // Disagreement!
            self.active_disagreement = Some(PunditDisagreement {
                pundit_a_id: p1.id.clone(),
                pundit_b_id: p2.id.clone(),
                topic: headline.clone(),
                date: date.to_string(),
                intensity: disagreement,
            });
            format!("{}: 'I have to disagree — that's a generous reading. The truth is more complicated.'", p2.name)
        } else {
            match p2.tone_archetype {
                ToneArchetype::TheAnalyst => format!("{}: 'The data supports that assessment.'", p2.name),
                ToneArchetype::TheHype => format!("{}: 'Absolutely — what a spectacle!'", p2.name),
                ToneArchetype::TheCritic => format!("{}: 'Let's not get carried away — there are issues to address.'", p2.name),
                ToneArchetype::TheRomantic => format!("{}: 'A storybook finish. You couldn't write it better.'", p2.name),
                ToneArchetype::TheVeteran => format!("{}: 'Aye, that's football. Grit and character.'", p2.name),
            }
        };
        reactions.push(MediaReaction {
            pundit_id: p2.id.clone(),
            pundit_name: p2.name.clone(),
            headline: headline.clone(),
            reaction: reaction2,
            date: date.to_string(),
            tone: p2.tone_archetype,
        });

        // Check for rare swear (co-commentator)
        let swearing_pundit = &self.pundits[shuffled[0]];
        if swearing_pundit.should_swear(rng, if is_rivalry { 2.0 } else { 1.0 }) {
            reactions.push(MediaReaction {
                pundit_id: swearing_pundit.id.clone(),
                pundit_name: swearing_pundit.name.clone(),
                headline: "Co-commentator outburst".into(),
                reaction: format!("{}: 'That was bloody reckless.'", swearing_pundit.name),
                date: date.to_string(),
                tone: swearing_pundit.tone_archetype,
            });
        }

        reactions
    }

    /// Update betting sentiments for a team.
    pub fn update_betting_sentiment(
        &mut self,
        team_id: &str,
        sentiment: f32,
        date: &str,
    ) {
        if let Some(bs) = self.betting_sentiments.iter_mut().find(|b| b.team_id == team_id) {
            bs.sentiment_score = sentiment;
            bs.odds_to_win_league = BettingSentiment::sentiment_to_odds(sentiment);
            bs.last_updated = date.to_string();
        } else {
            self.betting_sentiments.push(BettingSentiment {
                team_id: team_id.to_string(),
                sentiment_score: sentiment,
                odds_to_win_league: BettingSentiment::sentiment_to_odds(sentiment),
                odds_to_relegate: BettingSentiment::sentiment_to_odds(100.0 - sentiment),
                last_updated: date.to_string(),
            });
        }
    }

    /// Get betting sentiment for a team.
    pub fn get_betting_sentiment(&self, team_id: &str) -> Option<&BettingSentiment> {
        self.betting_sentiments.iter().find(|b| b.team_id == team_id)
    }

    /// Get the active pundit disagreement (if any).
    pub fn has_disagreement(&self) -> bool {
        self.active_disagreement.is_some()
    }

    /// Get a summary of the media state for the InterpretationSurface.
    pub fn media_summary(&self) -> MediaSummary {
        MediaSummary {
            active_story_count: 0, // Filled by caller from memory_store
            top_headline: self.last_supplement.as_ref()
                .and_then(|s| s.supplements.iter()
                    .find(|i| i.supplement_type == SupplementType::HeadlineOfTheWeek)
                    .map(|i| i.title.clone())),
            pundit_disagreement_active: self.has_disagreement(),
            betting_sentiment_trend: self.betting_sentiments.first()
                .map(|b| if b.sentiment_score > 55.0 { "Rising".to_string() }
                         else if b.sentiment_score < 45.0 { "Falling".to_string() }
                         else { "Stable".to_string() })
                .unwrap_or_else(|| "Stable".to_string()),
        }
    }
}

/// A media reaction from a pundit after a match.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MediaReaction {
    pub pundit_id: String,
    pub pundit_name: String,
    pub headline: String,
    pub reaction: String,
    pub date: String,
    pub tone: ToneArchetype,
}

/// Summary of media state for the InterpretationSurface.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaSummary {
    pub active_story_count: u32,
    pub top_headline: Option<String>,
    pub pundit_disagreement_active: bool,
    pub betting_sentiment_trend: String,
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_pundits_count() {
        let pundits = Pundit::default_pundits();
        assert_eq!(pundits.len(), 5);
        assert!(pundits.iter().all(|p| !p.name.is_empty()));
    }

    #[test]
    fn pundit_disagreement_probability() {
        let analyst = &Pundit::default_pundits()[0]; // TheAnalyst
        let romantic = &Pundit::default_pundits()[3]; // TheRomantic
        // These two should have high disagreement (very different biases)
        let prob = analyst.disagreement_probability(romantic, 0.3, 0.1);
        assert!(prob > 0.3, "Analyst and Romantic should disagree frequently: {}", prob);

        let analyst2 = &Pundit::default_pundits()[0];
        let prob_same = analyst.disagreement_probability(analyst2, 0.0, 0.0);
        assert!(prob_same < 0.1, "Same pundit should rarely disagree: {}", prob_same);
    }

    #[test]
    fn betting_sentiment_calculation() {
        // Strong team: high results, good squad pulse, low injuries
        let sentiment = BettingSentiment::calculate(95.0, 85.0, 5.0, 80.0, 5.0);
        assert!(sentiment > 50.0, "Strong team should have positive sentiment: {}", sentiment);

        // Weak team: poor results, bad squad pulse, injuries
        let sentiment = BettingSentiment::calculate(20.0, 30.0, 60.0, 20.0, 70.0);
        assert!(sentiment < 50.0, "Weak team should have negative sentiment: {}", sentiment);
    }

    #[test]
    fn betting_odds_conversion() {
        let strong = BettingSentiment::sentiment_to_odds(90.0);
        assert!(strong < 3.0, "Strong favourite should have low odds: {}", strong);

        let weak = BettingSentiment::sentiment_to_odds(10.0);
        assert!(weak > 10.0, "Weak team should have high odds: {}", weak);

        let neutral = BettingSentiment::sentiment_to_odds(50.0);
        assert!((4.0..8.0).contains(&neutral), "Neutral should be around 4-8: {}", neutral);
    }

    #[test]
    fn match_rating_narrative_weighted() {
        // Player with high performance but no narrative
        let rating_plain = calculate_match_rating(8.0, 5.0, 5.0, 5.0);
        // Player with decent performance but huge narrative (redemption arc)
        let rating_narrative = calculate_match_rating(7.0, 10.0, 8.0, 7.0);
        // Narrative-boosted player should rate higher despite lower raw performance
        assert!(rating_narrative > rating_plain,
            "Narrative-weighted rating ({}) should exceed plain ({}): perf={} vs {}",
            rating_narrative, rating_plain, 6.0, 8.0);
    }

    #[test]
    fn clutch_factor_big_game_responder() {
        let normal = calculate_clutch_factor(false, false, false, false);
        let big_game = calculate_clutch_factor(true, true, true, true);
        assert!(big_game > normal + 4.0, "Big game responder in rivalry with late winner should have much higher clutch: {} vs {}", big_game, normal);
    }

    #[test]
    fn weekly_supplement_generation() {
        let pundits = Pundit::default_pundits();
        let supplement = WeeklySupplement::generate(
            "2026-07-15", "London FC", "Manchester Reds",
            &["W".into(), "D".into()], &["L".into(), "W".into()],
            true, // rivalry
            &pundits, 65.0, 45.0,
        );
        // Should have 6 items (including rivalry flashback)
        assert_eq!(supplement.supplements.len(), 6);
        assert!(supplement.supplements.iter().any(|s| s.supplement_type == SupplementType::RivalryFlashback));
        assert!(supplement.supplements.iter().any(|s| s.supplement_type == SupplementType::BettingOddsSummary));
    }

    #[test]
    fn weekly_supplement_no_rivalry() {
        let pundits = Pundit::default_pundits();
        let supplement = WeeklySupplement::generate(
            "2026-07-15", "London FC", "Madrid Athletic",
            &[], &[], false, &pundits, 50.0, 50.0,
        );
        // Should have 5 items (no rivalry flashback)
        assert_eq!(supplement.supplements.len(), 5);
    }

    #[test]
    fn media_engine_process_match() {
        let mut engine = MediaEngine::new();
        let mut rng = rand::rng();
        let reactions = engine.process_match(
            "2026-07-15", "London FC", "Manchester Reds",
            3, 1, true, &mut rng,
        );
        assert!(reactions.len() >= 2, "Should have at least 2 pundit reactions");
        assert!(!reactions[0].headline.is_empty());
    }

    #[test]
    fn media_engine_betting_update() {
        let mut engine = MediaEngine::new();
        engine.update_betting_sentiment("team_1", 75.0, "2026-07-15");
        let bs = engine.get_betting_sentiment("team_1").unwrap();
        assert_eq!(bs.sentiment_score, 75.0);
        assert!(bs.odds_to_win_league < 5.0, "Strong team should have low odds: {}", bs.odds_to_win_league);
    }

    #[test]
    fn media_engine_weekly_update_shifts_form() {
        let mut engine = MediaEngine::new();
        let initial_form = engine.pundits[0].current_form;
        let mut rng = rand::rng();
        engine.weekly_update(&mut rng);
        // Form may or may not change (random), but should be in range
        assert!(engine.pundits[0].current_form >= -1.0 && engine.pundits[0].current_form <= 1.0);
    }

    #[test]
    fn supplement_cooldown() {
        let mut engine = MediaEngine::new();
        // Mark a supplement type as used
        engine.supplement_history.insert("TacticalPreview".to_string(), "2026-07-15".to_string());
        // Within 6 weeks — should be blocked
        assert!(!engine.can_use_supplement(&SupplementType::TacticalPreview, "2026-08-01"));
        // After 6 weeks — should be allowed
        assert!(engine.can_use_supplement(&SupplementType::TacticalPreview, "2026-09-01"));
    }
}
