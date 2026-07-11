# Gaffer V99.4+ — Implementation Roadmap

**Created:** 2026-07-12
**Based on:** GAFFER_V992_MASTER_PLAN.md audit findings + IDEAS.md
**Current state:** V99.3 complete (DB fix, OVR, economy, transfers, AI contracts, HoF, live-match modifiers, Gaffer Engine, staff retirement, match highlights, weather module, age-tiered wages)
**Repository:** `gaffer-v99` (main branch, commit `372d11e`)

---

## How to Use This Document

Each task has:
- **ID** — unique identifier for tracking
- **Priority** — Tier 1 (must do), Tier 2 (should do), Tier 3 (nice to have), Tier 4 (ambitious)
- **Effort** — estimated hours of implementation
- **Dependencies** — tasks that must be done first
- **Files** — key files to touch
- **Risk** — LOW (isolated change), MEDIUM (touches multiple systems), HIGH (architectural)

Work through Tier 1 first, then Tier 2, etc. Within each tier, tasks are ordered by impact-per-effort.

---

## Completed Work (V99.3)

### Wave 1 — Foundation Fixes ✅
- `09df30a` DB Loading Fix (3 schema mismatches + no silent fallback)
- `d289b82` OVR Formula (5 missing attrs + doubled-weight bugs)
- `3a86b3a` Transfer Market (star appeal + not-for-sale + per-buyer cap)
- `c87abec` Economy Re-tune (OVR⁴ market value + wages + prize money + reputation)
- `8c16b4e` AI Contract Renewal + Free-Agent Signing
- `e3798b4` Live Hall of Fame + Rivalries
- `924d6a6` Live-Match Morale/Stability Modifiers

### Wave 2 — Performance + Realism ✅
- `895b33f` Message/News Pruning + Match Config Tuning

### Wave 3 — World Vitality ✅
- `b0a7876` Memory Resurfacing + Academy Intake Messages
- `d50bdde` Staff Retirement System

### Gaffer Engine + IDEAS Quick Wins ✅
- `0cef80b` Master Interpretation Layer (16 functions, 10 components)
- `4e17df4` Match Highlights wired into PostMatchScreen (IDEAS #1)
- `d50bdde` Weather conditions module (IDEAS #9) — module only, NOT wired to engine yet
- `2885b96` Age-tiered renewal wages (REALISM-1 M11+M12)

---

## TIER 1 — High Impact, Do Next

### T1.1 Weather Engine Integration
**Priority:** Tier 1
**Effort:** 2 hours
**Dependencies:** None (weather module already exists at `src/lib/weather.ts`)
**Risk:** MEDIUM — touches match engine + fixture creation + pre-match UI

**What:**
The weather module (`src/lib/weather.ts`) exists with 9 weather types and modifiers, but is NOT wired into the Rust match engine. Goals:
- Add `WeatherCondition` field to `domain::league::Fixture`
- Generate weather at fixture creation based on month + country
- Apply weather modifiers in `engine/resolution.rs` (pass success, cross accuracy, fatigue, long ball, goal conversion)
- Show weather in pre-match screen + commentary mentions it

**Files:**
- `src-tauri/crates/domain/src/league.rs` — add `weather: Option<String>` to Fixture
- `src-tauri/crates/engine/src/types.rs` — add `weather_modifiers: WeatherModifiers` to MatchConfig
- `src-tauri/crates/engine/src/engine/resolution.rs` — apply modifiers in resolve_buildup, resolve_midfield, resolve_shot
- `src-tauri/crates/engine/src/live_match/zone_resolution.rs` — same for live path
- `src-tauri/crates/ofm_core/src/turn/mod.rs` — generate weather when creating fixtures
- `src/components/match/PreMatchSetup.tsx` — show weather icon + Gaffer-voice description

**Acceptance Criteria:**
- Rain reduces pass success by ~5%
- Heavy rain reduces goal conversion by ~8%
- Fog increases long ball effectiveness by ~15%
- Heat increases fatigue by ~25%
- Weather shown on pre-match screen with Gaffer-voice commentary

---

### T1.2 Defender/Midfielder Goals
**Priority:** Tier 1
**Effort:** 1.5 hours
**Dependencies:** None
**Risk:** LOW — isolated to match engine shot resolution

**What:**
Currently 100% of goals are scored by Forwards (`Position::Forward` in `resolve_shot`). Real football: defenders score ~10-15% (mostly from set pieces), midfielders ~25-30%, own goals ~2%.

**Files:**
- `src-tauri/crates/engine/src/engine/resolution.rs` — `resolve_shot` function (~line 376)
- `src-tauri/crates/engine/src/live_match/zone_resolution.rs` — `resolve_shot` function (~line 363)
- `src-tauri/crates/engine/src/report.rs` — track `last_set_piece` state (may already exist)

**Implementation:**
```
When shot originates from a Corner (trackable via existing last_set_piece state):
  Pick shooter from {Defender, Midfielder, Forward} with weights {0.30, 0.30, 0.40}

For open play shots:
  Pick shooter from {Midfielder, Forward} with weights {0.20, 0.80}

Add 1.5% own-goal probability per shot:
  If own goal, assign to a random defender from the defending team
```

**Acceptance Criteria:**
- Defenders score ~10-15% of goals
- Midfielders score ~25-30% of goals
- Own goals occur at ~2% rate
- Set-piece goals more likely from defenders

---

### T1.3 Transfer Requests
**Priority:** Tier 1
**Effort:** 2.5 hours
**Dependencies:** None
**Risk:** MEDIUM — new event type + UI integration

**What:**
Players never ask to leave even when morale is rock-bottom. Need: if `morale < 25` for 30+ consecutive days AND `ovr >= 70`, trigger a transfer request. The player auto-transfer-lists (user can refuse at -5 morale/week cost).

**Files:**
- `src-tauri/crates/domain/src/player.rs` — add `transfer_request_date: Option<String>` field
- `src-tauri/crates/ofm_core/src/player_events/mod.rs` — new `check_transfer_requests()` function
- `src-tauri/crates/ofm_core/src/turn/mod.rs` — call `check_transfer_requests()` daily
- `src-tauri/crates/ofm_core/src/transfers.rs` — when user refuses request, apply -5 morale/week
- `src/components/inbox/` — new message category for transfer requests
- `src/components/squad/SquadRosterView.tsx` — show transfer request indicator

**Implementation:**
```rust
fn check_transfer_requests(game: &mut Game) {
    for player in &mut game.players {
        if player.ovr < 70 { continue; }
        if player.morale < 25 {
            if player.low_morale_days.is_none() {
                player.low_morale_days = Some(0);
            }
            player.low_morale_days = player.low_morale_days.map(|d| d + 1);
            
            if player.low_morale_days >= Some(30) && player.transfer_request_date.is_none() {
                player.transfer_request_date = Some(today);
                player.transfer_listed = true;
                // Generate inbox message: "X wants to leave"
            }
        } else {
            player.low_morale_days = None;
        }
    }
}
```

**Acceptance Criteria:**
- Players with morale < 25 for 30+ days request transfers
- Only players with OVR >= 70 (good enough to attract interest)
- User can refuse → player stays but loses 5 morale/week
- Transfer request shows in inbox + squad view

---

### T1.4 AI Manager Poaching
**Priority:** Tier 1
**Effort:** 3 hours
**Dependencies:** None
**Risk:** MEDIUM — new AI logic + manager movement

**What:**
AI managers never move between clubs. Successful managers stay forever unless fired. Need `process_ai_manager_poaching()` at end-of-season: high-rep clubs can poach managers from smaller clubs, and the unemployed-manager pool should be hired before the staff-seed fallback.

**Files:**
- `src-tauri/crates/ofm_core/src/ai_hiring.rs` — add `process_ai_manager_poaching()`
- `src-tauri/crates/ofm_core/src/end_of_season.rs` — call poaching check
- `src-tauri/crates/ofm_core/src/job_offers.rs` — wire unemployed-manager pool into vacancy filling

**Implementation:**
```rust
fn process_ai_manager_poaching(game: &mut Game) {
    // For each elite club (reputation >= 700) with a vacant manager slot:
    //   1. Try unemployed-manager pool first
    //   2. If pool empty, look for AI managers at smaller clubs (rep gap >= 150)
    //   3. If found, "poach" — move manager to the bigger club
    //   4. The smaller club now has a vacancy → filled by existing process_vacant_ai_clubs
    
    // Also: if an AI manager has won 2+ trophies at a small club,
    //       bigger clubs come calling. Generate "tapped up" news.
}
```

**Acceptance Criteria:**
- Unemployed managers get hired before staff-seed fallback
- Elite clubs (rep >= 700) can poach managers from clubs with rep <= 550
- Poached manager's old club gets a vacancy (filled by existing logic)
- News articles generated for managerial moves

---

## TIER 2 — Medium Impact, Quick Wins

### T2.1 Player Career Stories (IDEAS #5)
**Priority:** Tier 2
**Effort:** 4 hours
**Dependencies:** None
**Risk:** LOW — new data + UI tab, no existing systems touched

**What:**
Each player builds a unique career story — international caps, milestone goals, long service, big-match performances. View on player profile "Career Story" tab.

**Files:**
- `src-tauri/crates/domain/src/player.rs` — add `career_event_log: Vec<CareerEvent>` field
- `src-tauri/crates/ofm_core/src/turn/post_match.rs` — record career events (debut, first goal, milestone appearances)
- `src-tauri/crates/ofm_core/src/end_of_season.rs` — record trophy wins, award wins
- `src/components/playerProfile/` — new `CareerStoryCard.tsx` component
- `src/components/playerProfile/PlayerProfile.tsx` — add Career Story tab

**Career Event Types:**
```rust
pub enum CareerEventType {
    Debut,
    FirstGoal,
    InternationalCap,
    TrophyWon,
    MilestoneAppearance,  // 100th, 250th, 500th
    MilestoneGoal,         // 50th, 100th
    Transfer,
    Loan,
    CaptainAppointment,
    RecordBreak,
}
```

**Narrative Templates (Gaffer voice):**
- Journeymen: "Played for 12 clubs, never quite settled, but always did a job"
- One-club legends: "Spent his entire career at [club], through thick and thin"
- Wonderkids: "Burst onto the scene at 17, the world was his oyster..."
- Late bloomers: "Didn't break through until 26, but what a 5 years he had"

**Acceptance Criteria:**
- Career events tracked from debut onward
- Narrative summary generated based on career arc
- Viewable on player profile

---

### T2.2 Player Partnerships (IDEAS #6)
**Priority:** Tier 2
**Effort:** 3 hours
**Dependencies:** None
**Risk:** MEDIUM — touches match engine + adds new tracking

**What:**
Certain players develop on-pitch partnerships over time — passing pairs, goal combinations, defensive duos — that give a slight match engine boost when they play together.

**Files:**
- `src-tauri/crates/domain/src/player.rs` — add `partnerships: HashMap<String, PartnershipData>` to Player
- `src-tauri/crates/ofm_core/src/turn/post_match.rs` — track goal + assist combinations
- `src-tauri/crates/engine/src/engine/resolution.rs` — apply +1-2% boost for established partnerships
- `src-tauri/crates/ofm_core/src/news.rs` — generate news when partnerships form
- `src/components/playerProfile/` — show partnership strength

**Implementation:**
```rust
pub struct PartnershipData {
    pub combined_goals: u32,
    pub combined_assists: u32,
    pub games_together: u32,
    pub last_game_together: Option<String>,
}

// In match engine, when resolving a goal:
if let Some(partnership) = scorer.partnerships.get(&assister.id) {
    if partnership.combined_goals >= 20 {
        shoot_rating *= 1.02; // +2% boost for established partnership
    }
}
```

**Acceptance Criteria:**
- Partnerships tracked per player pair
- +1-2% boost for pairs with 20+ combined goals
- News story when partnership forms ("The new [Neville-Beckham]")
- Partnerships decay if players don't play together (loan/sold/injured)
- Shown on player profile

---

### T2.3 Performance: Team→Players Index (PERF-1 C3+C4)
**Priority:** Tier 2
**Effort:** 2.5 hours
**Dependencies:** None
**Risk:** LOW — pure refactor, no behavior change

**What:**
Build a `team_id → Vec<player_index>` HashMap at the start of each tick. Currently 6+ subsystems do full-world player scans per match (post-match morale, build_engine_team, ai_training snapshot, random_events, etc.).

**Files:**
- `src-tauri/crates/ofm_core/src/turn/mod.rs` — build index at start of `process_day_with_capture`
- `src-tauri/crates/ofm_core/src/turn/post_match.rs` — use index instead of full scan
- `src-tauri/crates/ofm_core/src/ai_training.rs` — use index for `snapshot_team`
- `src-tauri/crates/ofm_core/src/player_events/mod.rs` — use index for user-roster filter
- `src-tauri/crates/ofm_core/src/random_events/mod.rs` — same

**Implementation:**
```rust
fn build_team_player_index(game: &Game) -> HashMap<String, Vec<usize>> {
    let mut index: HashMap<String, Vec<usize>> = HashMap::new();
    for (i, player) in game.players.iter().enumerate() {
        if let Some(team_id) = &player.team_id {
            index.entry(team_id.clone()).or_default().push(i);
        }
    }
    index
}
```

**Acceptance Criteria:**
- Index built once per tick, reused by all subsystems
- No behavior change (same players found, just faster)
- ~60% reduction in per-matchday player scans

---

### T2.4 Dead Code Cleanup (ARCH-1 D1-D11)
**Priority:** Tier 2
**Effort:** 1.5 hours
**Dependencies:** None
**Risk:** LOW — deleting unused code

**What:**
Delete unused fields, functions, and types identified in the architecture audit.

**Items to delete:**
- `PersonalityProfile.confidence` — always 100, only read in tests (`domain/src/player.rs:273-274`)
- `PenaltyShootoutState.round` — set to 0, never read (`live_match/mod.rs:174`)
- `RetiredSnapshot.teamwork` — collected, never read (`end_of_season.rs:1311`)
- `LegacySaveRow.{manager_name, created_at, last_played_at}` — extracted, discarded
- `engine::PlayerSnap` `#[allow(dead_code)]` — false positive, remove attribute
- `getTeamShort` — exported, tested, never called (`lib/team.ts:10`)
- `MAX_COMPLETED_AI_TRANSFERS_PER_DAY = 2` — defined, never used (`transfers.rs:19`)
- `matchSnapshot` slice + `fetchMatchMeaning` action — frontend stub never read
- 11 dead Tauri commands with no frontend caller (verify each before deleting)

**Files:** Multiple — see ARCH-1 audit in worklog.md

**Acceptance Criteria:**
- All listed dead code removed
- TypeScript compiles clean
- Rust compiles clean (no new warnings)
- All tests pass

---

### T2.5 Youth Development Focus Override (VITAL-1 M6)
**Priority:** Tier 2
**Effort:** 1 hour
**Dependencies:** None
**Risk:** LOW — isolated to AI training

**What:**
AI training uses one team-wide intensity. Per-player growth is shallow — AI youth prospects all develop similar attribute profiles. Add `youth_development_focus_override` for `age <= 21 && squad_role == Youth` — rotate through all 5 focuses evenly instead of the team's style-biased cycle.

**Files:**
- `src-tauri/crates/ofm_core/src/ai_training.rs` — add youth override logic

**Acceptance Criteria:**
- Youth players (age <= 21, squad_role == Youth) get rotated training focus
- Each youth player cycles through all 5 focuses over 5 weeks
- Senior players keep the team-wide style-biased cycle
- Youth prospects develop more varied attribute profiles

---

## TIER 3 — Quality of Life

### T3.1 Deadline Day Drama (REALISM-1 M8)
**Priority:** Tier 3
**Effort:** 3 hours
**Dependencies:** None
**Risk:** MEDIUM — new game-state tracking + AI behavior changes

**What:**
On deadline day: AI clubs become more aggressive (+20 interest score, +2 daily cap, -0.1 fee multiplier). News feed shows "DEADLINE DAY" branding. Panic-buy trigger for thin squads.

**Files:**
- `src-tauri/crates/ofm_core/src/transfers.rs` — detect deadline day, apply modifiers
- `src-tauri/crates/ofm_core/src/news.rs` — "DEADLINE DAY" branding
- `src-tauri/crates/domain/src/league.rs` — track transfer window deadlines
- `src/components/transfers/TransfersTab.tsx` — deadline day UI

**Acceptance Criteria:**
- Last 24 hours of transfer window: AI more aggressive
- "DEADLINE DAY" banner in news + transfers screen
- Panic-buy trigger: if club has <2 senior players in a position group AND <7 days left, bid up to 1.5× market_value

---

### T3.2 Player Club-Appeal (REALISM-1 M7)
**Priority:** Tier 3
**Effort:** 2.5 hours
**Dependencies:** None
**Risk:** MEDIUM — new scoring system

**What:**
Players never refuse to sign for cold countries/rivals. Add `club_appeal_score()`: reject if < 30, demand 20% wage premium if 30-50.

**Files:**
- `src-tauri/crates/ofm_core/src/contracts.rs` — add `club_appeal_score()` to free-agent + transfer decisions
- `src-tauri/crates/domain/src/team.rs` — add climate/region data (if not present)

**Implementation:**
```rust
fn club_appeal_score(player: &Player, club: &Team) -> i32 {
    let mut score = 50;
    if club.reputation >= 700 { score += 15; }      // Elite club appeal
    if club.reputation < 300 { score -= 15; }        // Small club
    if club.in_relegation_zone { score -= 15; }      // Relegation risk
    if club.climate == "cold" && player.preferred_climate != "cold" { score -= 10; }
    if club.has_continental_football { score += 20; } // European football
    if club.is_rival_of(player.former_team) { score -= 20; } // Rival
    score
}
```

**Acceptance Criteria:**
- Players reject moves to clubs with appeal < 30
- Players demand 20% wage premium for appeal 30-50
- Climate, reputation, rivalry, continental football all factor in

---

### T3.3 Manager Touchline Reactions (IDEAS #8)
**Priority:** Tier 3
**Effort:** 2.5 hours
**Dependencies:** None
**Risk:** MEDIUM — new UI overlay + modifier application

**What:**
During live matches, at big moments (goal conceded, red card, late winner chance), show 2-3 quick options: "Calm them down" / "Get into them" / "Change the shape". Each gives a tiny morale/composure modifier for the next 10 minutes.

**Files:**
- `src/components/match/MatchLive.tsx` — touchline reaction overlay
- `src-tauri/crates/engine/src/live_match/mod.rs` — apply temporary modifiers
- `src-tauri/src/commands/live_match.rs` — new command for touchline reaction

**Options:**
- "Calm them down" → +5 composure for 10 minutes, -2 aggression
- "Get into them" → +5 aggression, -2 composure
- "Change the shape" → +3 morale, formation change prompt

**Acceptance Criteria:**
- Prompt appears at big moments (goal conceded, red card, 80+ min with score level)
- AI manager on other side does the same
- Modifiers last 10 minutes then expire
- Doesn't interrupt match flow

---

### T3.4 Captain Designation Fix (REALISM-1 M9)
**Priority:** Tier 3
**Effort:** 1 hour
**Dependencies:** None
**Risk:** LOW — small engine fix

**What:**
Captain designation is cosmetic. Engine's `team_captain_leadership` picks max leadership regardless of who the user designated as captain. Already partially fixed in V99.3 Chunk F (sent-off filter), but still doesn't respect the actual designation.

**Files:**
- `src-tauri/crates/engine/src/engine/resolution.rs` — `team_captain_leadership`
- `src-tauri/crates/engine/src/live_match/helpers.rs` — `team_captain_leadership`

**Implementation:**
```rust
fn team_captain_leadership(team: &TeamData) -> u8 {
    // If captain is designated and not sent off, use their leadership.
    if let Some(captain_id) = &team.match_roles.captain {
        if let Some(captain) = team.players.iter().find(|p| &p.id == captain_id) {
            if !ctx.sent_off.contains(captain_id) {
                return captain.leadership;
            }
        }
    }
    // Fallback: max leadership among non-sent-off players
    team.players.iter()
        .filter(|p| !ctx.sent_off.contains(&p.id))
        .map(|p| p.leadership)
        .max()
        .unwrap_or(50)
}
```

**Acceptance Criteria:**
- User-designated captain's leadership is used (if on pitch + not sent off)
- Falls back to max leadership if captain is sent off or not designated

---

### T3.5 Tapping Up (REALISM-1 P2)
**Priority:** Tier 3
**Effort:** 2 hours
**Dependencies:** T1.3 (Transfer Requests)

**What:**
Star players don't get tapped up by bigger clubs. When a high-rep AI club bids on a player at a lower-rep club, generate "tapped up" news + small morale drop (-3).

**Files:**
- `src-tauri/crates/ofm_core/src/transfers.rs` — generate tapping-up news on bid
- `src-tauri/crates/ofm_core/src/news.rs` — tapping-up article templates

**Acceptance Criteria:**
- When AI club bids for a player at a lower-rep club, generate "tapped up" news
- Player morale drops by 3 points
- Player becomes more open to a move (increase transfer openness score)

---

## TIER 4 — Ambitious (Later)

### T4.1 Reputation/Fame Levels (IDEAS #4)
**Priority:** Tier 4
**Effort:** 3-4 days
**Dependencies:** None (but benefits from T2.1 Career Stories)
**Risk:** HIGH — new data model + AI logic + contract rework

**What:**
Extend `reputation` to players + leagues + countries. Drives AI behavior, contract demands, media coverage, sponsor deals, fan morale.

**Implementation:**
- Player fame tiers: Unknown → Prospect → Known → Established → Star → World Class → Legend
- League prestige tiers: Sunday League → Semi-Pro → Lower Division → Top Division → Continental → Elite
- Wire into: contract demands (stars want more), transfer interest (AI chases stars), media coverage, sponsor income, fan morale

---

### T4.2 Social Media Feed (IDEAS #14)
**Priority:** Tier 4
**Effort:** 2-3 days
**Dependencies:** None
**Risk:** MEDIUM — new content generation system

**What:**
"Social media" style feed showing fan reactions, pundit opinions, player posts — in addition to the formal news wire.

**Implementation:**
- After matches, generate 5-10 "fan tweets" reacting to the result
- Pundits give opinions on big signings/sackings
- Players occasionally "post" about milestones
- Different voices: die-hard fans, casual fans, pundits, journalists

---

### T4.3 Match Engine 2D View (IDEAS #7)
**Priority:** Tier 4
**Effort:** 5-7 days
**Dependencies:** None
**Risk:** HIGH — new renderer + animation loop

**What:**
Simple 2D top-down pitch view showing player positions + ball movement during live matches.

**Implementation:**
- Canvas/SVG renderer with green pitch + dots for players
- Ball moves between zones with small animation
- Goals show ball in the net
- Doesn't need FM-quality — just enough for visual context

---

### T4.4 Release Clauses (IDEAS #11)
**Priority:** Tier 4
**Effort:** 2 days
**Dependencies:** None
**Risk:** MEDIUM — contract model extension

**What:**
Some players have release clauses — if a bid meets the clause, the club can't refuse.

**Implementation:**
- Add `release_clause: Option<u64>` to Player contract
- When offering a contract, option to include release clause
- Higher clause = lower wage demands
- If bid meets clause, player automatically allowed to talk to bidding club
- AI clubs can have clauses too

---

### T4.5 Loan System Improvements (IDEAS #13)
**Priority:** Tier 4
**Effort:** 2 days
**Dependencies:** None
**Risk:** MEDIUM — loan model extension

**What:**
Better loan mechanics — loan fees, wage contribution negotiation, recall clauses, performance-based extensions.

**Implementation:**
- Negotiate: wage contribution %, loan fee, recall clause, play-time guarantee
- AI clubs send loan offers for your young players
- Loan performance affects development
- Recall clause: can recall in January

---

### T4.6 International Management (IDEAS #17)
**Priority:** Tier 4
**Effort:** 4-5 days
**Dependencies:** None (national team code exists)
**Risk:** HIGH — new management layer

**What:**
After establishing yourself at club level, get offered international jobs — World Cup cycles, qualifying campaigns, tournament squads.

---

### T4.7 Board Types (IDEAS #16)
**Priority:** Tier 4
**Effort:** 3-4 days
**Dependencies:** Economy re-tune (done in V99.3)
**Risk:** HIGH — new data model + AI logic

**What:**
Different clubs have different board types — Sugar Daddy, Sensible, Penny-Pinching, Ambitious — that affect budgets, patience, facility investment.

---

## Architectural Cleanup (Can be done anytime)

### A1. Unify Resolution Modules (ARCH-1 DR1)
**Effort:** 3-4 hours
**Risk:** HIGH — refactor of core match logic
**Dependencies:** None (but V99.3 Chunk F already fixed the modifier drift)

Extract shared `compute_zone_rating(snap, ModifierBundle)` into `engine/src/shared.rs`. Both engine + live paths call it. Delete `engine/fouls.rs`. This prevents future drift between the two paths.

### A2. Single OVR Formula (ARCH-1 DR2)
**Effort:** 1 hour
**Risk:** MEDIUM

Delete `engine::PlayerData::overall()` (11-attr mean) and `domain::PlayerAttributes::overall(position)` (9-attr mean). Single source of truth = `player.ovr` (always populated by `refresh_player_derived`).

### A3. Remove Game.league (ARCH-1 R2)
**Effort:** 1-2 days
**Risk:** HIGH — many callsites

`Game.league` duplicates one entry from `Game.competitions`. Already documented as DEPRECATED but `sync_legacy_league` still runs on every state mutation. Delete the field + the sync function + update all callsites.

### A4. Persist ScoutingKnowledge to SQLite (IDEAS #21)
**Effort:** 1-2 days
**Risk:** MEDIUM

Currently JSON-blob. Adding a proper SQLite table future-proofs against save format migrations.

---

## Recommended Execution Order

### Sprint 1 (Next session — while user tests V99.3 build)
1. **T1.1** Weather Engine Integration (2h)
2. **T1.2** Defender/Midfielder Goals (1.5h)
3. **T1.3** Transfer Requests (2.5h)
4. **T1.4** AI Manager Poaching (3h)
5. **T2.4** Dead Code Cleanup (1.5h) — quick win, can do between larger tasks

**Total: ~10.5 hours**

### Sprint 2
1. **T2.1** Player Career Stories (4h)
2. **T2.2** Player Partnerships (3h)
3. **T2.3** Performance: Team→Players Index (2.5h)
4. **T2.5** Youth Development Focus Override (1h)

**Total: ~10.5 hours**

### Sprint 3
1. **T3.1** Deadline Day Drama (3h)
2. **T3.2** Player Club-Appeal (2.5h)
3. **T3.3** Manager Touchline Reactions (2.5h)
4. **T3.4** Captain Designation Fix (1h)
5. **T3.5** Tapping Up (2h)

**Total: ~11 hours**

### Sprint 4 (Architectural)
1. **A1** Unify Resolution Modules (4h)
2. **A2** Single OVR Formula (1h)
3. **A3** Remove Game.league (careful refactor, 1-2 days)
4. **A4** Persist ScoutingKnowledge to SQLite (1-2 days)

### Sprint 5+ (Ambitious — pick based on player feedback)
- T4.1 Reputation/Fame Levels
- T4.2 Social Media Feed
- T4.3 Match Engine 2D View
- T4.4 Release Clauses
- T4.5 Loan System Improvements
- T4.6 International Management
- T4.7 Board Types

---

## Verification Checklist

For each task completed, verify:
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] All tests pass (`npx vitest run`)
- [ ] Rust compiles (if backend changed — user will verify on build)
- [ ] 10-season sim doesn't break (if simulation logic changed)
- [ ] No raw numbers leak to UI (if interpretation layer touched)
- [ ] Save file still loads (if domain types changed — use `#[serde(default)]`)
- [ ] Commit + push to `gaffer-v99/main`

---

## Notes

- **Save migration:** Any change that touches persisted fields requires `#[serde(default)]` on new fields for backward compatibility. Old saves will use defaults for new fields.
- **Testing:** The user's laptop is slow — builds take ~1 hour. Don't push broken code. Test TypeScript locally before committing.
- **Gaffer Engine:** All new UI values should pass through `src/lib/gafferEngine.ts`. No raw numbers (except genuine counting stats: goals, appearances, age, fee amounts).
- **Branches:** Work on `main` directly or create feature branches. Never push to `stable` (the `gaffer` repo).
- **Token:** GitHub token may expire. If push fails with "could not read Username", update the remote URL with a fresh token.

---

*This is a living document — update as tasks are completed or priorities change.*
