use super::params;
use domain::league::FixtureCompetition;
use domain::news::*;
use rand::RngExt;
use serde::Serialize;

#[derive(Serialize)]
struct MatchReportScorerParam<'a> {
    player: &'a str,
    minute: u32,
    team: &'a str,
}

fn scorer_parts(
    home_name: &str,
    away_name: &str,
    home_scorers: &[(String, u32)],
    away_scorers: &[(String, u32)],
) -> Vec<String> {
    let mut parts = Vec::new();
    for (name, minute) in home_scorers {
        parts.push(format!("{} ({}', {})", name, minute, home_name));
    }
    for (name, minute) in away_scorers {
        parts.push(format!("{} ({}', {})", name, minute, away_name));
    }
    parts
}

fn scorer_player_ids(
    home_scorers: &[(String, u32)],
    away_scorers: &[(String, u32)],
) -> Vec<String> {
    home_scorers
        .iter()
        .chain(away_scorers.iter())
        .map(|(name, _)| name.clone())
        .collect()
}

fn scorer_params_json(
    home_name: &str,
    away_name: &str,
    home_scorers: &[(String, u32)],
    away_scorers: &[(String, u32)],
) -> String {
    let scorers: Vec<MatchReportScorerParam<'_>> = home_scorers
        .iter()
        .map(|(player, minute)| MatchReportScorerParam {
            player,
            minute: *minute,
            team: home_name,
        })
        .chain(
            away_scorers
                .iter()
                .map(|(player, minute)| MatchReportScorerParam {
                    player,
                    minute: *minute,
                    team: away_name,
                }),
        )
        .collect();

    serde_json::to_string(&scorers).unwrap_or_else(|_| "[]".to_string())
}

fn outcome_key(home_goals: u8, away_goals: u8) -> &'static str {
    if home_goals > away_goals {
        "homeWin"
    } else if away_goals > home_goals {
        "awayWin"
    } else {
        "draw"
    }
}

/// V99.11 A3: Detect if the match featured a comeback (the eventual winner
/// was ≥2 goals behind at some point). Uses scorer minutes to reconstruct
/// the running scoreline chronologically.
///
/// Returns `Some(true)` if a comeback occurred, `None` otherwise.
fn detect_comeback(
    home_goals: u8,
    away_goals: u8,
    home_scorers: &[(String, u32)],
    away_scorers: &[(String, u32)],
) -> bool {
    // Only check if there's a winner (not a draw)
    if home_goals == away_goals {
        return false;
    }

    // Build a chronological list of (minute, is_home_goal)
    let mut events: Vec<(u32, bool)> = Vec::new();
    for (_, minute) in home_scorers {
        events.push((*minute, true));
    }
    for (_, minute) in away_scorers {
        events.push((*minute, false));
    }
    events.sort_by_key(|(minute, _)| *minute);

    // Track running score and check if the eventual winner was ever ≥2 behind
    let mut home_score: i32 = 0;
    let mut away_score: i32 = 0;
    let home_won = home_goals > away_goals;

    for (_, is_home) in &events {
        if *is_home {
            home_score += 1;
        } else {
            away_score += 1;
        }
        let diff = if home_won {
            home_score - away_score
        } else {
            away_score - home_score
        };
        // If the eventual winner was ever 2+ goals behind, it's a comeback
        if diff <= -2 {
            return true;
        }
    }
    false
}

/// V99.11 A3: Detect if the match was a high-scoring thriller (6+ total goals).
fn is_thriller(home_goals: u8, away_goals: u8) -> bool {
    (home_goals as u32 + away_goals as u32) >= 6
}

/// Generate a match report news article for a completed fixture.
#[allow(clippy::too_many_arguments)]
pub fn match_report_article(
    fixture_id: &str,
    home_name: &str,
    away_name: &str,
    home_goals: u8,
    away_goals: u8,
    home_team_id: &str,
    away_team_id: &str,
    competition: FixtureCompetition,
    matchday: u32,
    home_scorers: &[(String, u32)], // (player_name, minute)
    away_scorers: &[(String, u32)],
    date: &str,
) -> NewsArticle {
    let mut rng = rand::rng();
    let is_league_fixture = matches!(competition, FixtureCompetition::League);

    let scorer_parts = scorer_parts(home_name, away_name, home_scorers, away_scorers);
    let scorers_data = scorer_params_json(home_name, away_name, home_scorers, away_scorers);

    let source_keys = [
        "be.source.sportsGazette",
        "be.source.footballHerald",
        "be.source.matchDayPress",
        "be.source.leagueChronicle",
    ];
    let src_idx = rng.random_range(0..source_keys.len());
    let source_key = source_keys[src_idx];

    let player_ids = scorer_player_ids(home_scorers, away_scorers);

    if !is_league_fixture {
        let (title_key, body_key) = match competition {
            FixtureCompetition::Friendly => (
                "be.news.matchReport.reportFriendly.title",
                "be.news.matchReport.reportFriendly.body",
            ),
            FixtureCompetition::PreseasonTournament => (
                "be.news.matchReport.reportPreseason.title",
                "be.news.matchReport.reportPreseason.body",
            ),
            FixtureCompetition::Cup
            | FixtureCompetition::ContinentalClub
            | FixtureCompetition::InternationalClub
            | FixtureCompetition::InternationalNation
            | FixtureCompetition::FriendlyCup => (
                "be.news.matchReport.reportFriendly.title",
                "be.news.matchReport.reportFriendly.body",
            ),
            FixtureCompetition::League => unreachable!(),
        };

        return NewsArticle::new(
            format!("report_{}", fixture_id),
            String::new(),
            String::new(),
            String::new(),
            date.to_string(),
            NewsCategory::MatchReport,
        )
        .with_teams(vec![home_team_id.to_string(), away_team_id.to_string()])
        .with_players(player_ids)
        .with_i18n(
            title_key,
            body_key,
            source_key,
            params(&[
                ("home", home_name),
                ("away", away_name),
                ("homeGoals", &home_goals.to_string()),
                ("awayGoals", &away_goals.to_string()),
                ("scorers", ""),
                ("scorersSection", ""),
                ("scorersData", &scorers_data),
            ]),
        )
        .with_score(NewsMatchScore {
            home_team_id: home_team_id.to_string(),
            away_team_id: away_team_id.to_string(),
            home_goals,
            away_goals,
        });
    }

    let idx = rng.random_range(0..3);

    // Determine outcome for i18n key
    let outcome = outcome_key(home_goals, away_goals);

    // V99.11 A3: Detect comeback/thriller narratives and use dedicated
    // headline variants when they occur. These override the standard
    // outcome-based headlines to add variety to the news feed.
    let is_comeback = detect_comeback(home_goals, away_goals, home_scorers, away_scorers);
    let is_thriller_match = is_thriller(home_goals, away_goals);

    let headline_key = if is_comeback {
        // Comeback: use a dedicated comeback headline variant
        let comeback_variant = rng.random_range(0..3u8);
        format!("be.news.matchReport.headline.comeback.{}", comeback_variant)
    } else if is_thriller_match {
        // Thriller: 6+ goals, use a thriller headline variant
        let thriller_variant = rng.random_range(0..3u8);
        format!("be.news.matchReport.headline.thriller.{}", thriller_variant)
    } else {
        // Standard: outcome-based headline
        let headline_variant = rng.random_range(0..3u8);
        format!("be.news.matchReport.headline.{}.{}", outcome, headline_variant)
    };

    let body_key = if scorer_parts.is_empty() {
        format!("be.news.matchReport.body{}.noScorers", idx)
    } else {
        format!("be.news.matchReport.body{}", idx)
    };

    NewsArticle::new(
        format!("report_{}", fixture_id),
        String::new(),
        String::new(),
        String::new(),
        date.to_string(),
        NewsCategory::MatchReport,
    )
    .with_teams(vec![home_team_id.to_string(), away_team_id.to_string()])
    .with_players(player_ids)
    .with_score(NewsMatchScore {
        home_team_id: home_team_id.to_string(),
        away_team_id: away_team_id.to_string(),
        home_goals,
        away_goals,
    })
    .with_i18n(
        // V99.11 A3: Use pre-computed headline_key (may be comeback/thriller variant)
        &headline_key,
        &body_key,
        source_key,
        {
            let mut p = params(&[
                ("home", home_name),
                ("away", away_name),
                ("homeGoals", &home_goals.to_string()),
                ("awayGoals", &away_goals.to_string()),
                ("matchday", &matchday.to_string()),
                ("scorers", ""),
                ("scorersData", &scorers_data),
            ]);
            // For winner-specific headlines
            if home_goals > away_goals {
                p.insert("winner".to_string(), home_name.to_string());
                p.insert("loser".to_string(), away_name.to_string());
            } else if away_goals > home_goals {
                p.insert("winner".to_string(), away_name.to_string());
                p.insert("loser".to_string(), home_name.to_string());
            }
            p
        },
    )
}

#[cfg(test)]
mod tests {
    use super::match_report_article;
    use domain::league::FixtureCompetition;
    use domain::news::NewsCategory;

    #[test]
    fn home_win_article_includes_match_metadata_and_scorers() {
        let article = match_report_article(
            "fix1",
            "Alpha FC",
            "Beta FC",
            2,
            1,
            "team1",
            "team2",
            FixtureCompetition::League,
            5,
            &[("Alice".to_string(), 10)],
            &[("Bob".to_string(), 75)],
            "2025-06-15",
        );

        assert_eq!(article.id, "report_fix1");
        assert_eq!(article.category, NewsCategory::MatchReport);
        assert_eq!(
            article.team_ids,
            vec!["team1".to_string(), "team2".to_string()]
        );
        assert_eq!(
            article.player_ids,
            vec!["Alice".to_string(), "Bob".to_string()]
        );
        let score = article.match_score.as_ref().unwrap();
        assert_eq!(score.home_team_id, "team1");
        assert_eq!(score.away_team_id, "team2");
        assert_eq!(score.home_goals, 2);
        assert_eq!(score.away_goals, 1);
        assert_eq!(article.headline, "");
        assert_eq!(article.body, "");
        assert_eq!(article.source, "");
        assert!(
            article
                .headline_key
                .as_deref()
                .unwrap()
                .starts_with("be.news.matchReport.headline.homeWin.")
        );
        assert!(
            [
                "be.news.matchReport.body0",
                "be.news.matchReport.body1",
                "be.news.matchReport.body2"
            ]
            .contains(&article.body_key.as_deref().unwrap())
        );
        assert!(
            [
                "be.source.sportsGazette",
                "be.source.footballHerald",
                "be.source.matchDayPress",
                "be.source.leagueChronicle"
            ]
            .contains(&article.source_key.as_deref().unwrap())
        );
        assert_eq!(
            article.i18n_params.get("home"),
            Some(&"Alpha FC".to_string())
        );
        assert_eq!(
            article.i18n_params.get("away"),
            Some(&"Beta FC".to_string())
        );
        assert_eq!(article.i18n_params.get("homeGoals"), Some(&"2".to_string()));
        assert_eq!(article.i18n_params.get("awayGoals"), Some(&"1".to_string()));
        assert_eq!(article.i18n_params.get("matchday"), Some(&"5".to_string()));
        assert_eq!(article.i18n_params.get("scorers"), Some(&String::new()));
        assert_eq!(
            article.i18n_params.get("scorersData"),
            Some(
                &"[{\"player\":\"Alice\",\"minute\":10,\"team\":\"Alpha FC\"},{\"player\":\"Bob\",\"minute\":75,\"team\":\"Beta FC\"}]".to_string()
            )
        );
        assert_eq!(
            article.i18n_params.get("winner"),
            Some(&"Alpha FC".to_string())
        );
        assert_eq!(
            article.i18n_params.get("loser"),
            Some(&"Beta FC".to_string())
        );
    }

    #[test]
    fn away_win_article_sets_away_winner_params() {
        let article = match_report_article(
            "fix2",
            "Alpha FC",
            "Beta FC",
            1,
            3,
            "team1",
            "team2",
            FixtureCompetition::League,
            6,
            &[("Alice".to_string(), 12)],
            &[("Bob".to_string(), 40), ("Ben".to_string(), 88)],
            "2025-06-22",
        );

        assert_eq!(article.body, "");
        assert_eq!(
            article.i18n_params.get("winner"),
            Some(&"Beta FC".to_string())
        );
        assert_eq!(
            article.i18n_params.get("loser"),
            Some(&"Alpha FC".to_string())
        );
        assert!(
            article
                .headline_key
                .as_deref()
                .unwrap()
                .starts_with("be.news.matchReport.headline.awayWin.")
        );
        assert_eq!(
            article.player_ids,
            vec!["Alice".to_string(), "Bob".to_string(), "Ben".to_string()]
        );
    }

    #[test]
    fn draw_article_omits_winner_params_and_goal_section_when_scoreless() {
        let article = match_report_article(
            "fix3",
            "Alpha FC",
            "Beta FC",
            0,
            0,
            "team1",
            "team2",
            FixtureCompetition::League,
            7,
            &[],
            &[],
            "2025-06-29",
        );

        assert_eq!(article.body, "");
        assert!(
            article
                .headline_key
                .as_deref()
                .unwrap()
                .starts_with("be.news.matchReport.headline.draw.")
        );
        assert_eq!(article.i18n_params.get("winner"), None);
        assert_eq!(article.i18n_params.get("loser"), None);
        assert_eq!(article.i18n_params.get("scorers"), Some(&String::new()));
        assert!(article.player_ids.is_empty());
    }

    #[test]
    fn friendly_article_uses_non_league_preseason_copy() {
        let article = match_report_article(
            "fix4",
            "Alpha FC",
            "Beta FC",
            2,
            2,
            "team1",
            "team2",
            FixtureCompetition::Friendly,
            0,
            &[],
            &[],
            "2025-07-20",
        );

        assert_eq!(article.category, NewsCategory::MatchReport);
        assert_eq!(article.headline, "");
        assert_eq!(article.body, "");
        assert_eq!(article.source, "");
        assert_eq!(
            article.headline_key.as_deref(),
            Some("be.news.matchReport.reportFriendly.title")
        );
        assert_eq!(
            article.body_key.as_deref(),
            Some("be.news.matchReport.reportFriendly.body")
        );
        assert!(article.source_key.is_some());
        assert_eq!(article.i18n_params.get("scorers"), Some(&String::new()));
        assert_eq!(
            article.i18n_params.get("scorersSection"),
            Some(&String::new())
        );
        assert_eq!(
            article.i18n_params.get("scorersData"),
            Some(&"[]".to_string())
        );
    }
}
