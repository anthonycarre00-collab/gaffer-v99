use chrono::{DateTime, Duration, Utc};
use domain::league::{
    CompetitionFormat, CompetitionRules, CompetitionScope, CompetitionType, Fixture,
    FixtureCompetition, FixtureImportance, FixtureStatus, KnockoutRoundState, League,
    StandingEntry,
};
use uuid::Uuid;

/// V99.4 T1.5: Derive fixture importance from competition type + team reputations.
/// Called at fixture creation time to set the importance level.
/// P1-3: Now public and called via apply_fixture_importance() post-generation.
pub fn derive_importance(competition: &FixtureCompetition, home_rep: u32, away_rep: u32) -> FixtureImportance {
    // Cup finals are the biggest domestic games.
    // Continental finals are the biggest overall.
    // League matches between top teams are "Big League".
    // Derbies (same country, high rep) are also "Big League".
    let avg_rep = (home_rep + away_rep) / 2;
    let rep_gap = if home_rep > away_rep { home_rep - away_rep } else { away_rep - home_rep };

    match competition {
        FixtureCompetition::Friendly
        | FixtureCompetition::FriendlyCup
        | FixtureCompetition::PreseasonTournament => {
            FixtureImportance::Friendly
        }
        FixtureCompetition::League => {
            // Top-6 clash: both teams have reputation >= 700
            if home_rep >= 700 && away_rep >= 700 {
                FixtureImportance::BigLeague
            }
            // Title race: both teams >= 650 and close in reputation
            else if home_rep >= 650 && away_rep >= 650 && rep_gap <= 100 {
                FixtureImportance::BigLeague
            }
            // Relegation 6-pointer: both teams <= 350 (bottom half)
            else if home_rep <= 350 && away_rep <= 350 {
                FixtureImportance::BigLeague
            }
            else {
                FixtureImportance::League
            }
        }
        FixtureCompetition::Cup => {
            // Cup final would need stage info — for now, cup ties are "Cup"
            // unless both teams are elite (which makes it a bigger tie).
            if avg_rep >= 700 {
                FixtureImportance::BigLeague
            } else {
                FixtureImportance::Cup
            }
        }
        FixtureCompetition::ContinentalClub => {
            if avg_rep >= 800 {
                FixtureImportance::Continental
            } else {
                FixtureImportance::Cup
            }
        }
        FixtureCompetition::InternationalClub | FixtureCompetition::InternationalNation => {
            FixtureImportance::Continental
        }
    }
}

/// P1-3: Apply smart fixture importance to all scheduled fixtures in a competition.
///
/// Called after fixtures are generated (which hardcodes League/Cup/Friendly).
/// This overrides those with reputation-aware importance levels:
/// - Top-6 league clashes → BigLeague (pressure multiplier 1.5)
/// - Elite cup ties → BigLeague
/// - Continental matches with elite teams → Continental (1.8)
/// - International matches → Continental (1.8)
///
/// `team_reputations` maps team_id → reputation (300-900 scale).
pub fn apply_fixture_importance(
    competition: &mut League,
    team_reputations: &std::collections::HashMap<String, u32>,
) {
    for fixture in competition.fixtures.iter_mut() {
        if fixture.status != FixtureStatus::Scheduled {
            continue;
        }
        let home_rep = team_reputations.get(&fixture.home_team_id).copied().unwrap_or(500);
        let away_rep = team_reputations.get(&fixture.away_team_id).copied().unwrap_or(500);
        fixture.importance = derive_importance(&fixture.competition, home_rep, away_rep);
    }
    // Also apply to knockout round fixtures
    for round in competition.knockout_rounds.iter_mut() {
        // Knockout round fixtures are stored in the main fixtures vec, so they're
        // already covered above. No additional work needed.
        let _ = round; // suppress unused warning
    }
}

/// V99.4 T1.1: Generate a weather condition for a fixture based on its date.
/// Uses a deterministic seed from the date string so the same fixture always
/// gets the same weather. Matches the frontend weather.ts logic:
/// - Winter (Dec-Feb): favours snow, fog, cold, heavy_rain
/// - Summer (Jun-Aug): favours hot, clear
/// - Spring/Autumn: favours rain, wind, cloudy
fn generate_weather_for_date(date_str: &str) -> String {
    // Parse the month from the ISO date string.
    let month = date_str.get(5..7).and_then(|m| m.parse::<u32>().ok()).unwrap_or(6);

    // Deterministic seed from the date string.
    let seed: u64 = date_str.bytes().fold(0u64, |acc, b| acc.wrapping_mul(31).wrapping_add(b as u64));
    let r = (seed % 100) as f64 / 100.0;

    // Winter: Dec(12), Jan(1), Feb(2)
    if month == 12 || month <= 2 {
        if r < 0.15 { "snow".to_string() }
        else if r < 0.30 { "fog".to_string() }
        else if r < 0.45 { "cold".to_string() }
        else if r < 0.60 { "heavy_rain".to_string() }
        else if r < 0.75 { "rain".to_string() }
        else if r < 0.90 { "cloudy".to_string() }
        else { "clear".to_string() }
    }
    // Summer: Jun(6), Jul(7), Aug(8)
    else if month >= 6 && month <= 8 {
        if r < 0.20 { "hot".to_string() }
        else if r < 0.50 { "clear".to_string() }
        else if r < 0.70 { "cloudy".to_string() }
        else if r < 0.85 { "rain".to_string() }
        else if r < 0.95 { "windy".to_string() }
        else { "heavy_rain".to_string() }
    }
    // Spring/Autumn: Mar-May, Sep-Nov
    else {
        if r < 0.25 { "rain".to_string() }
        else if r < 0.35 { "cloudy".to_string() }
        else if r < 0.50 { "clear".to_string() }
        else if r < 0.60 { "windy".to_string() }
        else if r < 0.70 { "fog".to_string() }
        else if r < 0.80 { "cold".to_string() }
        else if r < 0.90 { "heavy_rain".to_string() }
        else { "cloudy".to_string() }
    }
}

/// Generate a full double round-robin schedule (home & away) for the given teams.
/// Matchdays are spaced 7 days apart starting from `start_date`.
/// Uses a rotation-based algorithm for balanced scheduling.
pub fn generate_league(
    name: &str,
    season: u32,
    team_ids: &[String],
    start_date: DateTime<Utc>,
) -> League {
    let n = team_ids.len();
    assert!(n >= 2);

    let league_id = Uuid::new_v4().to_string();
    let mut league = League::new(league_id, name.to_string(), season, team_ids);
    append_round_robin_fixtures(&mut league, team_ids, start_date);
    league
}

/// Append a full double round-robin (home & away) for `team_ids` to `league`,
/// spacing matchdays 7 days apart from `start_date`.
fn append_round_robin_fixtures(
    league: &mut League,
    team_ids: &[String],
    start_date: DateTime<Utc>,
) {
    let fixtures =
        build_round_robin_fixtures(&league.id, team_ids, start_date, FixtureCompetition::League);
    league.fixtures.extend(fixtures);
}

/// Build a full double round-robin (home & away) fixture list spacing matchdays
/// 7 days apart from `start_date`.
pub fn build_round_robin_fixtures(
    competition_id: &str,
    team_ids: &[String],
    start_date: DateTime<Utc>,
    fixture_competition: FixtureCompetition,
) -> Vec<Fixture> {
    build_round_robin_fixtures_with(
        competition_id,
        team_ids,
        start_date,
        fixture_competition,
        2,
        7,
    )
}

/// Matchdays a round robin of `n` teams takes over `legs` legs — the round
/// count [`build_round_robin_fixtures_with`] emits (the circle method gives an
/// odd field a phantom slot, so its rounds match the next even size).
pub fn round_robin_matchdays(n: usize, legs: usize) -> usize {
    if n < 2 {
        return 0;
    }
    let slots = if n.is_multiple_of(2) { n } else { n + 1 };
    (slots - 1) * legs
}

/// Build a round-robin fixture list with a configurable number of legs (even
/// legs reverse home and away) and days between matchdays. Uses the circle
/// method; an odd club count plays against a phantom slot, giving each club
/// one bye per leg.
pub fn build_round_robin_fixtures_with(
    competition_id: &str,
    team_ids: &[String],
    start_date: DateTime<Utc>,
    fixture_competition: FixtureCompetition,
    legs: u8,
    matchday_gap_days: i64,
) -> Vec<Fixture> {
    let n = team_ids.len();
    if n < 2 || legs == 0 {
        return Vec::new();
    }
    let slots = if n.is_multiple_of(2) { n } else { n + 1 };
    let rounds = round_robin_matchdays(n, 1);
    let half = slots / 2;
    let mut fixtures = Vec::new();
    let mut matchday: u32 = 1;

    // Even-numbered legs reverse home and away.
    for leg in 0..legs {
        let mut indices: Vec<usize> = (0..slots).collect();
        for _round in 0..rounds {
            let date_str = (start_date + Duration::days((matchday as i64 - 1) * matchday_gap_days))
                .format("%Y-%m-%d")
                .to_string();
            for i in 0..half {
                let (mut home, mut away) = (indices[i], indices[slots - 1 - i]);
                if leg % 2 == 1 {
                    std::mem::swap(&mut home, &mut away);
                }
                if home >= n || away >= n {
                    continue; // Paired with the phantom slot: a bye.
                }
                fixtures.push(Fixture {
                    id: Uuid::new_v4().to_string(),
                    competition_id: competition_id.to_string(),
                    matchday,
                    date: date_str.clone(),
                    home_team_id: team_ids[home].clone(),
                    away_team_id: team_ids[away].clone(),
                    competition: fixture_competition.clone(),
                    status: FixtureStatus::Scheduled,
                    result: None,
                    weather: generate_weather_for_date(&date_str),
                    importance: FixtureImportance::League,
                });
            }
            matchday += 1;
            let last = indices.pop().unwrap();
            indices.insert(1, last);
        }
    }
    fixtures
}

/// Redistribute fixture dates so that at most `max_per_day` fixtures fall on any
/// single calendar day, spreading each matchday's fixtures across consecutive
/// days. Matchdays are kept in order and separated by a one-day buffer so that
/// the last fixture of matchday N and the first fixture of matchday N+1 are
/// never on the same day.
///
/// Fixtures are sorted by `(matchday, id)` before reassignment so the result is
/// deterministic regardless of insertion order.
pub fn spread_fixture_dates(
    fixtures: &mut Vec<Fixture>,
    start_date: DateTime<Utc>,
    max_per_day: usize,
) {
    if fixtures.is_empty() || max_per_day == 0 {
        return;
    }

    fixtures.sort_by(|a, b| a.matchday.cmp(&b.matchday).then(a.id.cmp(&b.id)));

    let mut cursor_day: i64 = 0;
    let mut i = 0;
    while i < fixtures.len() {
        let current_matchday = fixtures[i].matchday;
        let mut j = i;
        while j < fixtures.len() && fixtures[j].matchday == current_matchday {
            j += 1;
        }
        let count = j - i;
        for (slot, fixture) in fixtures[i..j].iter_mut().enumerate() {
            fixture.date = (start_date + Duration::days(cursor_day + (slot / max_per_day) as i64))
                .format("%Y-%m-%d")
                .to_string();
        }
        let days_used = ((count + max_per_day - 1) / max_per_day) as i64;
        cursor_day += days_used + 1;
        i = j;
    }
}

/// Reset a league for a new season in place, preserving its identity, name, and
/// participants but clearing results and regenerating standings and fixtures.
/// Participants are taken from `participant_ids`, falling back to the previous
/// standings for legacy leagues that never recorded a participant list.
pub fn regenerate_league_for_season(league: &mut League, season: u32, start_date: DateTime<Utc>) {
    let team_ids: Vec<String> = if !league.participant_ids.is_empty() {
        league.participant_ids.clone()
    } else {
        league.standings.iter().map(|s| s.team_id.clone()).collect()
    };

    league.participant_ids = team_ids.clone();
    league.season = season;
    league.fixtures.clear();
    league.standings = team_ids
        .iter()
        .map(|id| StandingEntry::new(id.clone()))
        .collect();

    if team_ids.len() >= 2 {
        append_round_robin_fixtures(league, &team_ids, start_date);
    }
}

/// Reset a knockout competition for a new season in place, preserving identity
/// and participants but clearing previous fixtures, standings, and rounds.
pub fn regenerate_knockout_for_season(cup: &mut League, season: u32, start_date: DateTime<Utc>) {
    cup.season = season;
    cup.fixtures.clear();
    cup.standings.clear();
    cup.knockout_rounds.clear();

    let team_ids = cup.participant_ids.clone();
    if team_ids.len() < 2 {
        return;
    }
    let fixture_competition = match cup.kind {
        CompetitionType::ContinentalClub => FixtureCompetition::ContinentalClub,
        CompetitionType::InternationalClub => FixtureCompetition::InternationalClub,
        CompetitionType::InternationalNation => FixtureCompetition::InternationalNation,
        CompetitionType::FriendlyCup => FixtureCompetition::FriendlyCup,
        _ => FixtureCompetition::Cup,
    };
    seed_knockout_round(cup, &team_ids, start_date, fixture_competition);
}

pub fn generate_knockout_cup(
    name: &str,
    season: u32,
    team_ids: &[String],
    start_date: DateTime<Utc>,
    kind: CompetitionType,
    scope: CompetitionScope,
) -> League {
    let competition_id = Uuid::new_v4().to_string();
    let mut cup = League::new(competition_id.clone(), name.to_string(), season, team_ids);
    cup.kind = kind.clone();
    cup.scope = scope;
    cup.rules = CompetitionRules {
        format: CompetitionFormat::Knockout,
        counts_in_season_flow: true,
        ..Default::default()
    };
    cup.standings.clear();
    seed_knockout_round(
        &mut cup,
        team_ids,
        start_date,
        match kind {
            CompetitionType::ContinentalClub => FixtureCompetition::ContinentalClub,
            CompetitionType::InternationalClub => FixtureCompetition::InternationalClub,
            CompetitionType::InternationalNation => FixtureCompetition::InternationalNation,
            CompetitionType::FriendlyCup => FixtureCompetition::FriendlyCup,
            _ => FixtureCompetition::Cup,
        },
    );
    cup
}

/// Seed the next knockout round of `cup` from `team_ids` (strongest first —
/// any byes for a non-power-of-two field go to the leading seeds).
pub fn seed_knockout_round(
    cup: &mut League,
    team_ids: &[String],
    start_date: DateTime<Utc>,
    fixture_competition: FixtureCompetition,
) {
    let round_index = cup.knockout_rounds.len() as u32 + 1;
    let round_name = match team_ids.len() {
        2 => "Final".to_string(),
        4 => "Semifinal".to_string(),
        8 => "Quarterfinal".to_string(),
        size => format!("Round of {size}"),
    };

    // When the entrant count is not a power of two, the strongest seeds (which
    // the caller passes first) receive a bye into the next round so the bracket
    // converges to a power of two.
    let byes = team_ids.len().next_power_of_two() - team_ids.len();
    let (bye_teams, playing_teams) = team_ids.split_at(byes);

    let mpd = cup.rules.knockout_matches_per_day.max(1) as usize;
    let mut round_fixture_ids = Vec::new();
    for (pair_index, pair) in playing_teams.chunks(2).enumerate() {
        if pair.len() < 2 {
            continue;
        }
        let fixture_id = Uuid::new_v4().to_string();
        round_fixture_ids.push(fixture_id.clone());
        cup.fixtures.push(Fixture {
            id: fixture_id,
            competition_id: cup.id.clone(),
            matchday: round_index,
            date: (start_date + Duration::days((pair_index / mpd) as i64))
                .format("%Y-%m-%d")
                .to_string(),
            home_team_id: pair[0].clone(),
            away_team_id: pair[1].clone(),
            competition: fixture_competition.clone(),
            status: FixtureStatus::Scheduled,
            result: None,
            weather: generate_weather_for_date(
                &(start_date + Duration::days((pair_index / mpd) as i64))
                    .format("%Y-%m-%d")
                    .to_string(),
            ),
            importance: FixtureImportance::Cup,
        });
    }
    cup.knockout_rounds.push(KnockoutRoundState {
        id: format!("{}-round-{}", cup.id, round_index),
        name: round_name,
        fixture_ids: round_fixture_ids,
        bye_team_ids: bye_teams.to_vec(),
        completed: false,
    });
}

pub fn advance_knockout_competition_round(cup: &mut League) {
    // Winners and byes advance together, in that order, until a champion.
    advance_knockout_round_with(cup, |winners, byes| {
        let mut advancing = winners.to_vec();
        advancing.extend(byes.iter().cloned());
        (advancing.len() >= 2).then_some(advancing)
    });
}

/// Shared knockout-round completion core: once the first incomplete round is
/// fully played, mark it complete and seed the next round with the seeding
/// order `next_round_order` chooses from the round's winners and byes —
/// or end the bracket when it returns `None`.
pub fn advance_knockout_round_with(
    cup: &mut League,
    next_round_order: impl FnOnce(&[String], &[String]) -> Option<Vec<String>>,
) {
    if !matches!(
        cup.rules.format,
        CompetitionFormat::Knockout | CompetitionFormat::GroupAndKnockout
    ) {
        return;
    }

    let Some(next_round) = cup
        .knockout_rounds
        .iter_mut()
        .find(|round| !round.completed)
    else {
        return;
    };
    let round_fixtures: Vec<_> = next_round
        .fixture_ids
        .iter()
        .filter_map(|fixture_id| {
            cup.fixtures
                .iter()
                .find(|fixture| &fixture.id == fixture_id)
        })
        .collect();
    if round_fixtures.is_empty()
        || round_fixtures
            .iter()
            .any(|fixture| fixture.result.is_none())
    {
        return;
    }

    next_round.completed = true;
    let round_fixture_ids = next_round.fixture_ids.clone();
    let winners: Vec<String> = round_fixtures
        .iter()
        .filter_map(|fixture| fixture.advancing_team_id().map(str::to_string))
        .collect();
    let byes = next_round.bye_team_ids.clone();

    if let Some(advancing) = next_round_order(&winners, &byes) {
        let last_round_date = round_fixtures
            .iter()
            .map(|fixture| fixture.date.as_str())
            .max()
            .unwrap_or("2026-01-01");
        let round_start = date_str_to_utc(last_round_date).unwrap_or_else(Utc::now)
            + Duration::days(cup.rules.knockout_round_gap_days as i64);
        let fixture_competition = cup
            .fixtures
            .iter()
            .find(|fixture| round_fixture_ids.contains(&fixture.id))
            .map(|fixture| fixture.competition.clone())
            .unwrap_or(FixtureCompetition::Cup);
        seed_knockout_round(cup, &advancing, round_start, fixture_competition);
    }
}

/// Parse a stored `%Y-%m-%d` fixture date into a UTC midnight timestamp.
pub fn date_str_to_utc(date: &str) -> Option<DateTime<Utc>> {
    chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .ok()
        .and_then(|date| date.and_hms_opt(0, 0, 0))
        .map(|naive| DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc))
}

pub fn generate_preseason_friendlies(
    team_ids: &[String],
    season_start: DateTime<Utc>,
    max_friendlies: usize,
) -> Vec<Fixture> {
    if team_ids.len() < 2 || max_friendlies == 0 {
        return Vec::new();
    }

    let mut rotation: Vec<Option<usize>> = (0..team_ids.len()).map(Some).collect();
    if !rotation.len().is_multiple_of(2) {
        rotation.push(None);
    }

    let rounds_available = rotation.len().saturating_sub(1);
    let rounds_to_schedule = max_friendlies.min(rounds_available);
    if rounds_to_schedule == 0 {
        return Vec::new();
    }

    let half = rotation.len() / 2;
    let mut fixtures = Vec::with_capacity(rounds_to_schedule * half);

    for round in 0..rounds_to_schedule {
        let weeks_before_start = (rounds_to_schedule.saturating_sub(round)) as i64;
        let date = (season_start - Duration::days(weeks_before_start * 7))
            .format("%Y-%m-%d")
            .to_string();

        for i in 0..half {
            let Some(left_idx) = rotation[i] else {
                continue;
            };
            let Some(right_idx) = rotation[rotation.len() - 1 - i] else {
                continue;
            };

            let (home_idx, away_idx) = if (round + i) % 2 == 0 {
                (left_idx, right_idx)
            } else {
                (right_idx, left_idx)
            };

            fixtures.push(Fixture {
                id: Uuid::new_v4().to_string(),
                competition_id: String::new(),
                matchday: 0,
                date: date.clone(),
                home_team_id: team_ids[home_idx].clone(),
                away_team_id: team_ids[away_idx].clone(),
                competition: FixtureCompetition::Friendly,
                status: FixtureStatus::Scheduled,
                result: None,
                weather: generate_weather_for_date(&date),
                importance: FixtureImportance::Friendly,
            });
        }

        let last = rotation.pop().unwrap();
        rotation.insert(1, last);
    }

    fixtures
}

/// Add three weekly friendlies to every South American domestic division.
/// Shared regional-cup clubs are never booked twice on the same date.
pub fn append_south_american_preseason_friendlies(
    competitions: &mut [League],
    international_dates: &[String],
) {
    append_regional_preseason_friendlies(competitions, international_dates, true);
}

/// Preserve the established four-match preseason for all other domestic
/// divisions, applying it to every division rather than a single global one.
pub fn append_other_preseason_friendlies(
    competitions: &mut [League],
    international_dates: &[String],
) {
    append_regional_preseason_friendlies(competitions, international_dates, false);
}

fn append_regional_preseason_friendlies(
    competitions: &mut [League],
    international_dates: &[String],
    south_american: bool,
) {
    use std::collections::HashSet;
    let reserved: HashSet<String> = international_dates.iter().cloned().collect();
    let mut occupied: HashSet<(String, String)> = competitions
        .iter()
        .flat_map(|competition| {
            competition
                .fixtures
                .iter()
                .filter(|fixture| fixture.competition != FixtureCompetition::Friendly)
                .flat_map(|fixture| {
                    [
                        (fixture.home_team_id.clone(), fixture.date.clone()),
                        (fixture.away_team_id.clone(), fixture.date.clone()),
                    ]
                })
        })
        .collect();
    let competitive_dates: Vec<(String, chrono::NaiveDate)> = competitions
        .iter()
        .flat_map(|competition| competition.fixtures.iter())
        .filter(|fixture| fixture.competition != FixtureCompetition::Friendly)
        .filter_map(|fixture| {
            chrono::NaiveDate::parse_from_str(&fixture.date, "%Y-%m-%d")
                .ok()
                .map(|date| {
                    [
                        (fixture.home_team_id.clone(), date),
                        (fixture.away_team_id.clone(), date),
                    ]
                })
        })
        .flatten()
        .collect();

    for competition in competitions.iter_mut().filter(|competition| {
        competition.kind == CompetitionType::League
            && competition.scope == CompetitionScope::Domestic
            && (competition.region_id.as_deref() == Some("south-america")) == south_american
    }) {
        if competition
            .fixtures
            .iter()
            .any(|fixture| fixture.competition == FixtureCompetition::Friendly)
        {
            continue;
        }
        let Some(first_date) = competitive_dates
            .iter()
            .filter(|(team_id, _)| competition.participant_ids.contains(team_id))
            .map(|(_, date)| *date)
            .min()
            .and_then(|date| date.and_hms_opt(0, 0, 0))
            .map(|date| DateTime::<Utc>::from_naive_utc_and_offset(date, Utc))
        else {
            continue;
        };
        let friendly_count = if south_american { 3 } else { 4 };
        let friendlies =
            generate_preseason_friendlies(&competition.participant_ids, first_date, friendly_count)
                .into_iter()
                .filter(|fixture| {
                    !reserved.contains(&fixture.date)
                        && !occupied.contains(&(fixture.home_team_id.clone(), fixture.date.clone()))
                        && !occupied.contains(&(fixture.away_team_id.clone(), fixture.date.clone()))
                })
                .collect::<Vec<_>>();
        for fixture in &friendlies {
            occupied.insert((fixture.home_team_id.clone(), fixture.date.clone()));
            occupied.insert((fixture.away_team_id.clone(), fixture.date.clone()));
        }
        append_fixtures(competition, friendlies);
    }
}

/// Push any fixture that lands on a reserved date (e.g. an international
/// window) forward to the next free day, so club matches never clash with
/// national-team call-ups. Order is preserved.
pub fn shift_fixtures_off_reserved_dates(league: &mut League, reserved_dates: &[String]) {
    if reserved_dates.is_empty() {
        return;
    }
    let reserved: std::collections::HashSet<&str> =
        reserved_dates.iter().map(|date| date.as_str()).collect();

    for fixture in &mut league.fixtures {
        let Some(mut date) = chrono::NaiveDate::parse_from_str(&fixture.date, "%Y-%m-%d").ok()
        else {
            continue;
        };
        while reserved.contains(date.format("%Y-%m-%d").to_string().as_str()) {
            match date.succ_opt() {
                Some(next) => date = next,
                None => break,
            }
        }
        fixture.date = date.format("%Y-%m-%d").to_string();
    }
}

pub fn append_fixtures(league: &mut League, mut additional_fixtures: Vec<Fixture>) {
    league.fixtures.append(&mut additional_fixtures);
    league.fixtures.sort_by(|left, right| {
        left.date
            .cmp(&right.date)
            .then(left.matchday.cmp(&right.matchday))
            .then(left.id.cmp(&right.id))
    });
}

/// V100 P0-7 (Issue #28/#34): Post-scheduling collision pass.
///
/// After all competitions have generated their fixtures independently, scan
/// for cross-competition collisions: any case where the same team has two
/// competitive fixtures on the same day. When found, shift the LOWER-priority
/// fixture forward to the next free day for both involved teams.
///
/// Priority order (highest first):
/// 1. InternationalNation competitions (World Cup, continental national team)
/// 2. ContinentalClub / InternationalClub (UCL, AFC CL, etc.)
/// 3. Domestic Cup (FA Cup, League Cup)
/// 4. Domestic League
/// 5. FriendlyCup (preseason friendlies — lowest priority)
///
/// This must be called AFTER all competitions are scheduled for the new
/// season (see `regenerate_competitions_for_new_season` in end_of_season.rs).
pub fn cross_competition_collision_pass(competitions: &mut [League]) {
    use domain::league::CompetitionType::*;
    use std::collections::HashSet;

    // Helper: priority of a competition type (lower number = higher priority).
    fn priority(kind: &domain::league::CompetitionType) -> u8 {
        match kind {
            InternationalNation => 0,
            ContinentalClub | InternationalClub => 1,
            Cup => 2,
            League => 3,
            FriendlyCup => 4,
        }
    }

    // Build the global occupied set: (team_id, date) -> (comp_index, fixture_index, priority)
    // We process fixtures in priority order; when a clash is found, the
    // lower-priority fixture (higher number) is shifted forward.
    let mut occupied: HashSet<(String, String)> = HashSet::new();
    let mut team_dates: std::collections::HashMap<(String, String), (usize, usize, u8)> =
        std::collections::HashMap::new();

    // First pass: insert all fixtures, detecting clashes as we go.
    // We use a Vec of (comp_idx, fixture_idx, priority) sorted by priority
    // so the highest-priority fixtures claim their dates first.
    let mut all_fixtures: Vec<(usize, usize, u8)> = Vec::new();
    for (comp_idx, comp) in competitions.iter().enumerate() {
        for (fix_idx, fixture) in comp.fixtures.iter().enumerate() {
            // Skip friendlies for collision purposes — they're meant to be
            // flexible and are appended last anyway.
            if fixture.competition == domain::league::FixtureCompetition::Friendly {
                continue;
            }
            let prio = priority(&comp.kind);
            all_fixtures.push((comp_idx, fix_idx, prio));
        }
    }
    // Sort by priority (ascending — highest priority first), then by date
    // (earlier first), so the most important fixtures claim their dates first.
    all_fixtures.sort_by(|a, b| {
        a.2.cmp(&b.2)
            .then_with(|| {
                competitions[a.0].fixtures[a.1]
                    .date
                    .cmp(&competitions[b.0].fixtures[b.1].date)
            })
            .then_with(|| a.0.cmp(&b.0))
    });

    for (comp_idx, fix_idx, _prio) in all_fixtures {
        let fixture = &competitions[comp_idx].fixtures[fix_idx];
        let date = fixture.date.clone();
        let home = fixture.home_team_id.clone();
        let away = fixture.away_team_id.clone();

        // Check if either team already has a fixture on this date.
        let home_clash = team_dates.contains_key(&(home.clone(), date.clone()));
        let away_clash = team_dates.contains_key(&(away.clone(), date.clone()));

        if !home_clash && !away_clash {
            // No clash — claim the date.
            team_dates.insert((home.clone(), date.clone()), (comp_idx, fix_idx, _prio));
            team_dates.insert((away.clone(), date.clone()), (comp_idx, fix_idx, _prio));
            occupied.insert((home, date));
            occupied.insert((away, date));
        } else {
            // Clash — shift this fixture forward to the next free day for both teams.
            let mut new_date = match chrono::NaiveDate::parse_from_str(&date, "%Y-%m-%d") {
                Ok(d) => d,
                Err(_) => continue, // Can't parse date — skip (defensive)
            };
            // Iterate forward until we find a date free for BOTH teams.
            // Cap at 14 days to avoid infinite loops in pathological schedules.
            for _ in 0..14 {
                if let Some(next) = new_date.succ_opt() {
                    new_date = next;
                } else {
                    break;
                }
                let new_date_str = new_date.format("%Y-%m-%d").to_string();
                if !occupied.contains(&(home.clone(), new_date_str.clone()))
                    && !occupied.contains(&(away.clone(), new_date_str.clone()))
                {
                    // Found a free day — claim it.
                    let new_date_str_final = new_date.format("%Y-%m-%d").to_string();
                    competitions[comp_idx].fixtures[fix_idx].date = new_date_str_final.clone();
                    team_dates.insert(
                        (home.clone(), new_date_str_final.clone()),
                        (comp_idx, fix_idx, _prio),
                    );
                    team_dates.insert(
                        (away.clone(), new_date_str_final.clone()),
                        (comp_idx, fix_idx, _prio),
                    );
                    occupied.insert((home, new_date_str_final));
                    occupied.insert((away, new_date_str_final));
                    break;
                }
            }
            // If we didn't find a free day in 14 tries, leave the fixture
            // where it is — better to have a clash than no fixture.
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn shift_fixtures_off_reserved_dates_moves_clashing_matches_forward() {
        let teams: Vec<String> = (0..2).map(|i| format!("team_{i}")).collect();
        let start = Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0).unwrap();
        let mut league = generate_league("Test League", 2026, &teams, start);

        // Force a clash, then reserve that exact day.
        league.fixtures[0].date = "2026-09-09".to_string();
        let reserved = vec!["2026-09-09".to_string()];

        shift_fixtures_off_reserved_dates(&mut league, &reserved);

        assert!(
            league.fixtures.iter().all(|f| f.date != "2026-09-09"),
            "no fixture should remain on a reserved date"
        );
        assert_eq!(
            league.fixtures[0].date, "2026-09-10",
            "clashing fixture should move to the next free day"
        );
    }

    #[test]
    fn shift_fixtures_off_reserved_dates_is_noop_without_reservations() {
        let teams: Vec<String> = (0..2).map(|i| format!("team_{i}")).collect();
        let start = Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0).unwrap();
        let mut league = generate_league("Test League", 2026, &teams, start);
        let before: Vec<String> = league.fixtures.iter().map(|f| f.date.clone()).collect();

        shift_fixtures_off_reserved_dates(&mut league, &[]);

        let after: Vec<String> = league.fixtures.iter().map(|f| f.date.clone()).collect();
        assert_eq!(before, after);
    }

    fn resolve_scheduled_fixtures(cup: &mut League) {
        for fixture in cup.fixtures.iter_mut() {
            if fixture.status == FixtureStatus::Scheduled {
                fixture.status = FixtureStatus::Completed;
                fixture.result = Some(domain::league::MatchResult {
                    home_goals: 1,
                    away_goals: 0,
                    home_scorers: vec![],
                    away_scorers: vec![],
                    report: None,
                    home_penalties: None,
                    away_penalties: None,
                });
            }
        }
    }

    #[test]
    fn knockout_cup_seeds_byes_for_non_power_of_two_entrants() {
        let teams: Vec<String> = (0..6).map(|i| format!("team_{i}")).collect();
        let start = Utc.with_ymd_and_hms(2026, 9, 1, 0, 0, 0).unwrap();
        let cup = generate_knockout_cup(
            "Cup",
            2026,
            &teams,
            start,
            CompetitionType::Cup,
            CompetitionScope::Domestic,
        );

        // 6 entrants -> next power of two is 8 -> 2 byes and 2 first-round ties.
        let round_one = &cup.knockout_rounds[0];
        assert_eq!(round_one.name, "Round of 6");
        assert_eq!(round_one.fixture_ids.len(), 2);
        assert_eq!(
            round_one.bye_team_ids,
            vec!["team_0".to_string(), "team_1".to_string()],
            "the first seeds receive the byes"
        );
    }

    #[test]
    fn knockout_cup_with_byes_progresses_to_a_single_champion() {
        let teams: Vec<String> = (0..6).map(|i| format!("team_{i}")).collect();
        let start = Utc.with_ymd_and_hms(2026, 9, 1, 0, 0, 0).unwrap();
        let mut cup = generate_knockout_cup(
            "Cup",
            2026,
            &teams,
            start,
            CompetitionType::Cup,
            CompetitionScope::Domestic,
        );

        // Resolve each round and advance until the bracket is exhausted.
        for _ in 0..5 {
            resolve_scheduled_fixtures(&mut cup);
            advance_knockout_competition_round(&mut cup);
        }

        let names: Vec<&str> = cup
            .knockout_rounds
            .iter()
            .map(|round| round.name.as_str())
            .collect();
        assert_eq!(names, vec!["Round of 6", "Semifinal", "Final"]);
        assert!(
            cup.knockout_rounds.iter().all(|round| round.completed),
            "every round should be completed"
        );

        let final_round = cup.knockout_rounds.last().unwrap();
        assert_eq!(final_round.fixture_ids.len(), 1);
    }

    #[test]
    fn regenerate_league_for_season_rebuilds_fresh_fixtures_and_standings() {
        let teams: Vec<String> = (0..4).map(|i| format!("team_{i}")).collect();
        let start = Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0).unwrap();
        let mut league = generate_league("Top Flight", 2026, &teams, start);
        league.fixtures[0].status = FixtureStatus::Completed;
        league.standings[0].points = 9;

        let next_start = Utc.with_ymd_and_hms(2027, 8, 1, 0, 0, 0).unwrap();
        regenerate_league_for_season(&mut league, 2027, next_start);

        assert_eq!(league.season, 2027);
        assert_eq!(league.fixtures.len(), 12); // 4 teams, double round robin
        assert!(
            league
                .fixtures
                .iter()
                .all(|f| f.status == FixtureStatus::Scheduled && f.result.is_none())
        );
        assert_eq!(league.standings.len(), 4);
        assert!(
            league
                .standings
                .iter()
                .all(|s| s.points == 0 && s.played == 0)
        );
        assert_eq!(league.participant_ids.len(), 4);
    }

    #[test]
    fn regenerate_league_for_season_falls_back_to_standings_without_participants() {
        let start = Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0).unwrap();
        let mut league = League::new("l1".to_string(), "Legacy".to_string(), 2026, &[]);
        league.participant_ids.clear();
        league.standings = vec![
            StandingEntry::new("a".to_string()),
            StandingEntry::new("b".to_string()),
        ];

        regenerate_league_for_season(&mut league, 2027, start);

        assert_eq!(
            league.participant_ids,
            vec!["a".to_string(), "b".to_string()]
        );
        assert_eq!(league.fixtures.len(), 2);
    }

    #[test]
    fn regenerate_knockout_for_season_reseeds_first_round() {
        let teams: Vec<String> = (0..4).map(|i| format!("team_{i}")).collect();
        let start = Utc.with_ymd_and_hms(2026, 9, 1, 0, 0, 0).unwrap();
        let mut cup = generate_knockout_cup(
            "Cup",
            2026,
            &teams,
            start,
            CompetitionType::Cup,
            CompetitionScope::Domestic,
        );
        cup.fixtures[0].status = FixtureStatus::Completed;

        let next_start = Utc.with_ymd_and_hms(2027, 9, 1, 0, 0, 0).unwrap();
        regenerate_knockout_for_season(&mut cup, 2027, next_start);

        assert_eq!(cup.season, 2027);
        assert_eq!(cup.knockout_rounds.len(), 1);
        assert_eq!(cup.fixtures.len(), 2);
        assert!(
            cup.fixtures
                .iter()
                .all(|f| f.status == FixtureStatus::Scheduled)
        );
    }

    #[test]
    fn generate_league_with_odd_team_count_gives_everyone_a_full_schedule() {
        let teams: Vec<String> = (0..5).map(|i| format!("team_{i}")).collect();
        let start = Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0).unwrap();
        let league = generate_league("Odd League", 2026, &teams, start);

        // 5 teams, double round robin: 5 * 4 = 20 fixtures over 10 rounds
        // (each round one club has a bye).
        assert_eq!(league.fixtures.len(), 20);
        let max_matchday = league.fixtures.iter().map(|f| f.matchday).max().unwrap();
        assert_eq!(max_matchday, 10);

        for team in &teams {
            let appearances = league
                .fixtures
                .iter()
                .filter(|f| &f.home_team_id == team || &f.away_team_id == team)
                .count();
            assert_eq!(appearances, 8, "{team} must play every rival twice");
        }

        // No club plays twice on the same matchday.
        for matchday in 1..=max_matchday {
            let mut seen = std::collections::HashSet::new();
            for fixture in league.fixtures.iter().filter(|f| f.matchday == matchday) {
                assert!(seen.insert(fixture.home_team_id.clone()));
                assert!(seen.insert(fixture.away_team_id.clone()));
            }
        }

        // Every pairing occurs exactly once per leg (home and away).
        for left in &teams {
            for right in &teams {
                if left == right {
                    continue;
                }
                let count = league
                    .fixtures
                    .iter()
                    .filter(|f| &f.home_team_id == left && &f.away_team_id == right)
                    .count();
                assert_eq!(count, 1, "{left} must host {right} exactly once");
            }
        }
    }

    #[test]
    fn test_generate_league_8_teams() {
        let teams: Vec<String> = (0..8).map(|i| format!("team_{}", i)).collect();
        let start = Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0).unwrap();
        let league = generate_league("Test League", 2026, &teams, start);

        // 8 teams: 7 rounds * 4 matches * 2 legs = 56 fixtures
        assert_eq!(league.fixtures.len(), 56);

        // 14 matchdays (7 per leg)
        let max_md = league.fixtures.iter().map(|f| f.matchday).max().unwrap();
        assert_eq!(max_md, 14);

        // Each team plays 14 matches total
        for team in &teams {
            let count = league
                .fixtures
                .iter()
                .filter(|f| f.home_team_id == *team || f.away_team_id == *team)
                .count();
            assert_eq!(count, 14, "Team {} plays {} matches", team, count);
        }

        // 8 standings entries
        assert_eq!(league.standings.len(), 8);
    }

    #[test]
    fn test_generate_league_16_teams() {
        let teams: Vec<String> = (0..16).map(|i| format!("team_{}", i)).collect();
        let start = Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0).unwrap();
        let league = generate_league("Premier Division", 2026, &teams, start);

        // 16 teams: 15 rounds * 8 matches * 2 legs = 240 fixtures
        assert_eq!(league.fixtures.len(), 240);

        // 30 matchdays (15 per leg)
        let max_md = league.fixtures.iter().map(|f| f.matchday).max().unwrap();
        assert_eq!(max_md, 30);

        // Each team plays 30 matches total (15 home + 15 away)
        for team in &teams {
            let count = league
                .fixtures
                .iter()
                .filter(|f| f.home_team_id == *team || f.away_team_id == *team)
                .count();
            assert_eq!(count, 30, "Team {} plays {} matches", team, count);
        }

        // 16 standings entries
        assert_eq!(league.standings.len(), 16);

        // No team plays itself
        for f in &league.fixtures {
            assert_ne!(f.home_team_id, f.away_team_id);
        }
    }

    #[test]
    fn generate_preseason_friendlies_marks_fixtures_as_friendlies() {
        let start = Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0).unwrap();
        let friendlies = generate_preseason_friendlies(
            &[
                "team_1".to_string(),
                "team_2".to_string(),
                "team_3".to_string(),
                "team_4".to_string(),
            ],
            start,
            3,
        );

        assert_eq!(friendlies.len(), 6);
        assert!(
            friendlies
                .iter()
                .all(|fixture| fixture.competition == FixtureCompetition::Friendly)
        );
        assert!(friendlies.iter().all(|fixture| fixture.matchday == 0));
        assert_eq!(friendlies[0].date, "2026-07-11");
        assert_eq!(friendlies[5].date, "2026-07-25");
    }

    #[test]
    fn generate_preseason_friendlies_gives_each_team_a_fixture_each_week() {
        let start = Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0).unwrap();
        let teams: Vec<String> = (1..=8).map(|n| format!("team_{}", n)).collect();
        let friendlies = generate_preseason_friendlies(&teams, start, 4);

        assert_eq!(friendlies.len(), 16);

        for team in &teams {
            let appearances = friendlies
                .iter()
                .filter(|fixture| fixture.home_team_id == *team || fixture.away_team_id == *team)
                .count();
            assert_eq!(
                appearances, 4,
                "{team} should get one fixture per preseason week"
            );
        }
    }

    #[test]
    fn generate_preseason_friendlies_does_not_double_book_teams_on_same_day() {
        let start = Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0).unwrap();
        let teams: Vec<String> = (1..=16).map(|n| format!("team_{}", n)).collect();
        let friendlies = generate_preseason_friendlies(&teams, start, 4);

        let unique_dates: std::collections::HashSet<_> = friendlies
            .iter()
            .map(|fixture| fixture.date.clone())
            .collect();
        assert_eq!(unique_dates.len(), 4);

        for date in unique_dates {
            for team in &teams {
                let appearances = friendlies
                    .iter()
                    .filter(|fixture| {
                        fixture.date == date
                            && (fixture.home_team_id == *team || fixture.away_team_id == *team)
                    })
                    .count();
                assert!(appearances <= 1, "{team} is double-booked on {date}");
            }
        }
    }

    #[test]
    fn regional_preseason_uses_away_team_competitive_opener() {
        let league_start = Utc.with_ymd_and_hms(2026, 1, 28, 0, 0, 0).unwrap();
        let teams: Vec<String> = (1..=4).map(|n| format!("team_{n}")).collect();
        let mut league = generate_league("Brazil League", 2026, &teams, league_start);
        league.region_id = Some("south-america".to_string());
        league.scope = CompetitionScope::Domestic;

        let mut cup = League::default();
        cup.kind = CompetitionType::Cup;
        cup.scope = CompetitionScope::Regional;
        cup.fixtures.push(Fixture {
            id: Uuid::new_v4().to_string(),
            competition_id: "regional-cup".to_string(),
            matchday: 1,
            date: "2026-01-11".to_string(),
            home_team_id: "outsider".to_string(),
            away_team_id: "team_1".to_string(),
            competition: FixtureCompetition::Cup,
            status: FixtureStatus::Scheduled,
            result: None,
            weather: generate_weather_for_date("2026-01-11"),
            importance: FixtureImportance::Cup,
        });

        let mut competitions = vec![league, cup];
        append_south_american_preseason_friendlies(&mut competitions, &[]);

        let friendly_dates: std::collections::HashSet<&str> = competitions[0]
            .fixtures
            .iter()
            .filter(|fixture| fixture.competition == FixtureCompetition::Friendly)
            .map(|fixture| fixture.date.as_str())
            .collect();
        assert_eq!(
            friendly_dates,
            ["2025-12-21", "2025-12-28", "2026-01-04"]
                .into_iter()
                .collect()
        );
    }

    #[test]
    fn spread_fixture_dates_caps_matches_per_day() {
        // 12 groups × 4 teams → 24 fixtures per matchday when using 1 leg.
        // With max_per_day=4 each matchday must spread across 6 days.
        let competition_id = "wc";
        let start = Utc.with_ymd_and_hms(2026, 6, 1, 0, 0, 0).unwrap();
        let max_per_day = 4;

        let mut fixtures: Vec<Fixture> = Vec::new();
        for group in 0..12_usize {
            let team_ids: Vec<String> = (0..4).map(|t| format!("g{group}t{t}")).collect();
            fixtures.extend(build_round_robin_fixtures_with(
                competition_id,
                &team_ids,
                start,
                FixtureCompetition::InternationalNation,
                1,
                2,
            ));
        }

        spread_fixture_dates(&mut fixtures, start, max_per_day);

        // No date should exceed max_per_day fixtures.
        let mut per_day: std::collections::HashMap<&str, usize> = std::collections::HashMap::new();
        for f in &fixtures {
            *per_day.entry(f.date.as_str()).or_default() += 1;
        }
        for (date, count) in &per_day {
            assert!(
                *count <= max_per_day,
                "date {date} has {count} fixtures, expected ≤ {max_per_day}"
            );
        }
    }

    #[test]
    fn spread_fixture_dates_keeps_matchday_order_without_overlap() {
        let start = Utc.with_ymd_and_hms(2026, 6, 1, 0, 0, 0).unwrap();
        let teams: Vec<String> = (0..4).map(|i| format!("t{i}")).collect();
        let mut fixtures = build_round_robin_fixtures_with(
            "c",
            &teams,
            start,
            FixtureCompetition::Cup,
            1,
            2,
        );

        spread_fixture_dates(&mut fixtures, start, 1);

        // All matchday-1 dates must be strictly earlier than all matchday-2 dates.
        let max_md1 = fixtures
            .iter()
            .filter(|f| f.matchday == 1)
            .map(|f| f.date.as_str())
            .max()
            .unwrap();
        let min_md2 = fixtures
            .iter()
            .filter(|f| f.matchday == 2)
            .map(|f| f.date.as_str())
            .min()
            .unwrap();
        assert!(
            max_md1 < min_md2,
            "matchday 1 should end before matchday 2 starts"
        );
    }

    #[test]
    fn seed_knockout_round_groups_matches_per_day() {
        // Round of 32 (16 matches) with mpd=4 should span exactly 4 days.
        let teams: Vec<String> = (0..32).map(|i| format!("t{i}")).collect();
        let start = Utc.with_ymd_and_hms(2026, 7, 1, 0, 0, 0).unwrap();
        let mut cup = generate_knockout_cup(
            "Cup",
            2026,
            &teams,
            start,
            CompetitionType::InternationalNation,
            domain::league::CompetitionScope::International,
        );
        cup.rules.knockout_matches_per_day = 4;
        // seed_knockout_round was already called in generate_knockout_cup with the
        // old default (mpd=1); regenerate with our updated rule.
        cup.fixtures.clear();
        cup.knockout_rounds.clear();
        seed_knockout_round(&mut cup, &teams, start, FixtureCompetition::InternationalNation);

        let unique_dates: std::collections::HashSet<&str> =
            cup.fixtures.iter().map(|f| f.date.as_str()).collect();
        assert_eq!(
            unique_dates.len(),
            4,
            "16 matches at 4/day should use exactly 4 dates"
        );
    }
}
