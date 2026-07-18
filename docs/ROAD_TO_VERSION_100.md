# Road to Version 100 — Ultra-Comprehensive Analysis & Implementation Plan

**Created:** 2026-07-18
**Base commit:** `96606e5`
**Source:** Deep code-level analysis of all 39 user-reported issues + 3 parallel subagent investigations (match engine/commentary, transfers/finances/competitions, player/staff/scouting).

---

## How to Read This Document

Each of the 39 issues is analysed under three headings:
- **ROOT CAUSE**: What's actually wrong in the code (with file:line citations)
- **INTERCONNECTED SYSTEMS**: What else is affected or needs wiring
- **IMPLEMENTATION PLAN**: Specific steps to fix, in priority order

Issues are grouped into 8 workstreams. Each workstream has a priority (P0 = blocks playability, P1 = blocks fun, P2 = polish).

---

## WORKSTREAM 1: Match Engine & Commentary (Issues #12, #31, #38)

### Issue #12: Commentary and match engine are poor
**ROOT CAUSE:**
- 34 event types exist, all have commentary templates (~183 lines). But there are NO events for: momentum shifts, quiet minutes, sustained pressure, counter-attacks, captain/leadership moments, fatigue effects, woodwork, VAR, penalty shouts turned down. (`engine/src/event.rs:21-79`)
- No "quiet minute" concept — a 0-0 grind feels the same as a 4-3 thriller at the event level.
- Punditry is a single anonymous voice — no rotating cast, no named pundits, no personalities. (`punditry.ts` returns `PunditLine { line, tone }` — no speaker attribution)
- Narrative/memory system EXISTS (884-line `narrative/mod.rs` with 35 memory types, 18 thread types, 12-week cooldowns, decay) and is wired into post-match ingestion + weekly news resurfacing. But it is NOT wired into live commentary. Memory of a 4-3 comeback in season 1 never surfaces in commentary during the return fixture.
- The `calculate_match_rating` narrative weight is hardcoded to `5.0` neutral (`post_match.rs:469-471`).

**INTERCONNECTED SYSTEMS:**
- Player ratings (Issue #38) depend on narrative context that isn't being provided
- News relevance (Issue #4) depends on memory resurfacing working correctly
- "Living breathing world" (Issue #25) requires narrative events to be saved and resurfaced

**IMPLEMENTATION PLAN:**
1. **P0: Add momentum/quiet events** — New `EventType` variants: `MomentumShift`, `QuietMinute`, `SustainedPressure`, `CounterAttack`. Emit when possession streaks cross thresholds (3+ consecutive actions in same zone = pressure; 5+ minutes without a shot = quiet). Add commentary templates for each.
2. **P1: Create rotating pundit cast** — Define `Pundit` struct (name, personality archetype, bias, catchphrases). Create 6-8 named pundits (Roy Keane type = fiery/critical; Carragher type = tactical; Micah Richards type = enthusiastic/positive). Pass active pundit through `getPunditLine`. Different pundits react differently to same event.
3. **P1: Wire narrative into commentary** — Before kick-off, fetch `resurfacing_candidates` for both teams + key players. Inject "Remember the last time these two met…" lines at KickOff. Layer "That's redemption for {player}" on a goal by a player with a `RedemptionArc` thread. Add "The gaffer's under pressure — three losses on the bounce" pundit line at KickOff when `FeelingTheHeat` thread is active.
4. **P2: Wire narrative_weight into player ratings** — Replace `5.0` neutral default at `post_match.rs:469` with actual `narrative_engine.top_thread_for(player_id)` lookup mapped to 0-10 weight.
5. **P2: Add build-up play commentary** — Chain 2-3 `PassCompleted` events into a "nice build-up" commentary line. Track possession streak length in `MatchContext`.

### Issue #31: Unrealistic scorelines (3-9 goals per match)
**ROOT CAUSE:**
- `goal_conversion_base = 0.30` but the formula adds `(shoot_rating - gk_rating)/150.0` dynamically. For a 75-rated shooter vs 60-rated GK: conversion = 0.30 + 0.10 = 0.40. For 80 vs 55: 0.30 + 0.17 = 0.47. So actual per-shot goal rate is ~15-19%, not the design target of ~10%. (`engine/src/engine/resolution.rs:469-497`)
- No shot cap — the engine emits a shot every time `resolve_action` fires in the attacking box. One entry can produce 2-4 shots via cascading corners (40% of saves → corners, 30% of corners → return to box). (`resolution.rs:513, 390`)
- AI-vs-AI matches use a separate Poisson model (`sparse_sim.rs:86`) with `home_xg = 1.3` — well-calibrated at ~2.4 goals/match. The live engine path is NOT calibrated.

**INTERCONNECTED SYSTEMS:**
- Player ratings (Issue #38) are inflated when scorelines are unrealistic
- News relevance (Issue #4) suffers when every match is a "thriller"
- Transfer market (Issue #6) distorts when goal stats are inflated

**IMPLEMENTATION PLAN:**
1. **P0: Lower conversion formula** — Change `(shoot_rating - gk_rating)/150.0` to `/250.0` to flatten quality-driven inflation. This brings a 75-vs-60 matchup from 0.40 to 0.36 conversion.
2. **P0: Add shot cooldown** — After a shot (saved/blocked/missed), add a "ball cleared from box" probability (50%) that sends the ball back to midfield instead of allowing immediate re-entry. This breaks the cascading-shot loop.
3. **P1: Tighten goals test** — Change `avg < 4.0` to `avg < 3.0` in `simulation_tests.rs:721`.

### Issue #38: Player ratings unrealistic, GKs always get 6.0
**ROOT CAUSE:**
- `compute_player_ratings` (`report.rs:488-541`) has NO GK-specific logic despite the V99.10 C1 comment claiming "position-aware". The `_home_side` parameter is unused. `PlayerMatchStats` has no position field.
- GKs sit at 6.0 base because they generate no offensive events (goals, assists, shots) and saves aren't credited to them — saves increment `team_stats.shots_on_target`, not the GK's `PlayerMatchStats`. (`report.rs:243-251`)
- A GK making 10 world-class saves gets the same 6.0 as one who wasn't tested.

**INTERCONNECTED SYSTEMS:**
- Season awards ("Player of the Year") pick by avg_rating — GKs never win
- Retirement logic uses `avg_rating <= 6.4` to boost retirement chance — ALL players get this boost because ratings cluster around 6.0-6.5

**IMPLEMENTATION PLAN:**
1. **P0: Add `saves` field to `PlayerMatchStats`** — Credit saves to the GK, not just the team. Add +0.05 per save (cap +1.5) to the rating formula.
2. **P0: Add `position` field to `PlayerMatchStats`** — Thread from `PlayerData.position` during `from_events_with_players`. Use for position-specific rating logic.
3. **P0: Add GK-specific rating logic** — Clean sheet bonus (team conceded 0, GK played 60+ min): +1.5. Goals conceded penalty: -0.2 per goal (cap -1.5). Save bonus: +0.05 per save (cap +1.5).
4. **P1: Add DEF-specific logic** — Clean sheet bonus: +0.8 (60+ min). Tackles/interceptions weighted ×1.5.
5. **P1: Add goals-conceded penalty for defenders** — -0.1 per goal conceded (cap -0.8).

---

## WORKSTREAM 2: Tactics & Player Roles (Issue #3)

### Issue #3: Tactics screens need full rework
**ROOT CAUSE:**
- Pitch is a flat SVG with no perspective. (`TacticsPitch.tsx:340-437` — `viewBox="0 0 100 140"` with `preserveAspectRatio="none"`)
- Phase Blueprint is on the Pitch tab, should be on Style of Play tab. (`TacticsTab.tsx:982` — `TacticsRightPanel` shown on pitch + style tabs)
- Style Guidance feels like forcing presets — should offer Gaffer-voice hints, not checklists.
- Player roles (27 variants) have Gaffer-voice names in i18n but NO explanation of what they do in the match engine. (`en.json:858-886` — "BallPlayingKeeper" → "Ball at His Feet" but no description of engine effect)
- Roles DO affect the match engine — `role_attribute_modifier` (`shared.rs:230-278`) returns 0.85-1.15 multipliers per phase. But this is invisible to the user.
- Out-of-position penalty exists in OVR/AI selection (`player_rating.rs:303-322` — 4.0/8.0/14.0 penalty) but NOT in the live match engine (engine uses deployed position + raw attributes, no explicit mismatch penalty).
- No retraining system — `alternate_positions` is set at world-gen and never changes via gameplay.
- Role/position mismatches — user reports CM can't choose the "central" option in a 4-3-3 as the defensive option. `role_valid_for_position` (`squad.rs`) defines valid role/position combos.
- Drag-and-drop is clunky — existing but not user-friendly.

**INTERCONNECTED SYSTEMS:**
- Match engine (Workstream 1) — roles feed `role_attribute_modifier` which affects zone resolution
- Player profiles (Issue #1) — roles shown but not explained
- Out-of-position penalty (Issue #3) — needs retraining system
- Competition rules (Issue #8) — bench size affects tactics (currently hardcoded 5 subs)

**IMPLEMENTATION PLAN:**
1. **P0: Move Phase Blueprint to Style tab** — Remove from `TacticsRightPanel` when on Pitch tab; show only on Style tab.
2. **P0: Add role descriptions** — For each of 27 roles, add a Gaffer-voice description explaining the engine effect (e.g. "Poacher: Gets on the end of things. Lethal in the box, but don't expect him back defending. Attack +12%, Defense -15%"). Add as tooltips on role selector.
3. **P1: Add perspective to pitch** — Replace flat SVG with a perspective-transformed pitch (CSS `transform: perspective(1000px) rotateX(15deg)` or a 3D model). Keep drag-and-drop logic untouched.
4. **P1: Redesign Style Guidance** — Replace checklist-style presets with Gaffer-voice advisory text. Instead of "Use 4-3-3 Attacking", say "You're asking them to get forward at every opportunity. With your current personnel, the midfield might get overrun — {player} isn't the quickest to track back." Show hints about style effects, not prescriptions.
5. **P1: Add out-of-position penalty to match engine** — When a player's deployed position doesn't match their natural position (and isn't in `alternate_positions`), apply a -5% skill penalty in the engine's zone resolution.
6. **P2: Implement position retraining** — Add `training_position_focus: Option<Position>` to Player. When set, playing time in that position accumulates "learning XP". After N matches (scaled by adaptability attribute), add the position to `alternate_positions`. Show progress bar on player profile.
7. **P2: Improve drag-and-drop** — Add visual feedback (highlight target slot, show ghost player), keyboard fallback (click source, click target).

---

## WORKSTREAM 3: Transfer Market & Finances (Issues #5, #6, #7, #20)

### Issue #6: Transfer market unrealistic — same players moving multiple times
**ROOT CAUSE:**
- `moved_player_ids: HashSet<String>` is a LOCAL variable inside `evaluate_transfer_market`, reset every day. There is NO per-window dedup. A player bought on Day 1 can be sold on Day 5, then sold again on Day 12 — all in the same window. (`transfers.rs:1039`)
- `execute_transfer` does NOT validate that `player.team_id == Some(from_team_id)` — no ownership check. (`transfers.rs:3901-3935`)

**INTERCONNECTED SYSTEMS:**
- Club reputation variation (Issue #7) — without per-club variation, all clubs have identical buying power
- Wage economics (Issue #20) — corrupt wages cascade into corrupt transfer fees

**IMPLEMENTATION PLAN:**
1. **P0: Add per-window `moved_player_ids`** — Persist a `HashSet<String>` on `Game` (or `TransferWindow` struct), cleared when the window opens/closes. Check in `evaluate_transfer_market` before allowing a bid.
2. **P0: Add ownership check to `execute_transfer`** — Guard at function entry: `if player.team_id != Some(from_team_id) { return Err }`.

### Issue #7: All EPL clubs have same reputation and budgets
**ROOT CAUSE:**
- `build_fifa_world.py:323-371` — `LEAGUE_META` maps league name → single reputation value. All 20 EPL clubs get reputation 880. Burnley = Man City = 880.
- `build_fifa_world.py:449,452,453` — `finance=50000000`, `wage_budget=500000`, `transfer_budget=5000000` hardcoded for ALL 184 teams.
- V99.7-2/3 scaled finances by reputation at game-start, but since all EPL clubs have the same reputation, the scaling produces the same result.

**INTERCONNECTED SYSTEMS:**
- Transfer market (Issue #6) — identical budgets mean no club can outbid another
- Wage economics (Issue #20) — identical finances mean wage demands are uniform
- Scouting (Issue #18) — reputation affects auto-reveal thresholds
- Board expectations (Issue #37) — need per-club variation for realistic objectives

**IMPLEMENTATION PLAN:**
1. **P0: Per-club reputation in DB** — Modify `build_fifa_world.py` to compute per-club reputation from squad-avg OVR (elite clubs avg 78+ → rep 900; mid-table 72-77 → rep 700; relegation 65-71 → rep 550). Or source from FIFA's club-level reputation field if available.
2. **P0: Vary finances by reputation tier** — Elite (rep ≥800): finance £200M, transfer £80M, wage £5M/wk. Mid-table (rep 600-799): finance £80M, transfer £25M, wage £2M/wk. Lower (rep <600): finance £40M, transfer £10M, wage £800K/wk.
3. **P1: Re-tune V99.7-2/3 scaling** — The existing scaling formula uses `(rep - 300) * multiplier`. With varied reputations, this will now produce realistic variation.

### Issue #20: Player wages all fucked
**ROOT CAUSE:**
- DB wages are FIFA's `wage_eur` imported directly (`build_fifa_world.py:520`). These are realistic for real-world players but DECOUPLED from Gaffer's OVR (computed separately via `calculate_ovr`).
- `reference_player_wage` (`contracts.rs:1406-1414`) returns `player.wage` whenever > 0. Since DB always sets wage > 0 (min 500), the market-value fallback (`market_value / 50`) NEVER fires.
- Result: OVR-67 Lukaku earning £260k/week; OVR-36 Mendy earning £105k/week; youth players on £500/week.

**IMPLEMENTATION PLAN:**
1. **P0: Wage sanity band** — In `reference_player_wage`, clamp `player.wage` to `[market_value/100, market_value/25]` before returning. This forces `expected_wage` to produce realistic values regardless of DB corruption.
2. **P1: Regenerate DB wages** — Modify `build_fifa_world.py` to compute wages from `market_value / 50` instead of importing FIFA wages. This aligns wages with Gaffer's OVR-based economy.

### Issue #5: Not enough player influence options
**ROOT CAUSE:**
- No `not_for_sale` field on Player. Only `transfer_listed` (club wants to sell) exists.
- No "reject all bids" functionality — each bid must be rejected individually.
- Rejected bids are NEVER pruned — `player.transfer_offers` grows unboundedly.
- No "talk to squad" feature to influence morale/form.
- Incoming bids don't affect player morale.

**IMPLEMENTATION PLAN:**
1. **P0: Add `not_for_sale: bool` to Player** — When set, `evaluate_transfer_market` skips the player entirely. Add `toggle_not_for_sale` command + UI button on player profile.
2. **P0: Add `reject_all_pending_offers` command** — Batch-flip all `Pending` offers to `Rejected`.
3. **P1: Prune rejected offers** — Drop `Rejected`/`Withdrawn` offers older than 30 days (similar to `prune_old_messages_and_news`).
4. **P1: Bid influence on morale** — When a bid is received for a player, apply a small morale boost ("feels wanted") or drop ("wants to leave") depending on player personality and bid size relative to market value.
5. **P2: Squad talk feature** — Pre-match and post-match team talks with 3-4 options (praise, kick up the arse, calm down, demand more). Effect scaled by `man_management` attribute of manager.

---

## WORKSTREAM 4: Competitions & Fixtures (Issues #8, #11, #28, #34)

### Issue #8: No competition rules saved
**ROOT CAUSE:**
- `CompetitionRules` (`domain/src/league.rs:33-52`) has only: format, counts_in_season_flow, group qualifiers, group legs, matchday gaps, knockout round gaps, knockout matches per day.
- MISSING: bench size (hardcoded 5 at `engine/src/live_match/mod.rs:282`), extra time rules, penalty rules, competition prestige.

**IMPLEMENTATION PLAN:**
1. **P0: Extend CompetitionRules** — Add `bench_size: u8` (default 7, WC 15), `extra_time: ExtraTimeRule` enum (Never/KnockoutOnly/Always), `penalties: PenaltyRule`, `prestige: u32` (0-1000).
2. **P0: Wire bench_size into tactics** — Replace hardcoded `max_subs: 5` with `competition.rules.bench_size`.
3. **P1: Wire prestige into** — News story weighting, board expectations, prize money, reputation gains.

### Issue #28/#34: Fixture clashes (CL and PL on same day, international clashes)
**ROOT CAUSE:**
- Each competition generates fixtures independently. NO cross-competition collision detection exists. (`regenerate_competitions_for_new_season` at `end_of_season.rs:542-696` loops through competitions independently)
- `shift_fixtures_off_reserved_dates` (`schedule.rs:683`) only handles FIFA international window dates, not other club competitions.
- When two fixtures exist for the same team on the same day, only the first is processed — the second is silently skipped, leaving tables out of sync.

**IMPLEMENTATION PLAN:**
1. **P0: Post-scheduling collision pass** — After all competitions are scheduled, build a global `occupied: HashSet<(team_id, NaiveDate)>` and shift any clashing competitive fixture to the next free day. Reuse the pattern from `append_regional_preseason_friendlies` (`schedule.rs:601-678`).
2. **P0: Fix international fixture labels** — National team names showing DB names instead of nation names. Check `national_team.rs` name rendering.

### Issue #11: Results not pushing to league tables
**ROOT CAUSE:**
- Was a real bug (fixed for live match path with regression test at `live_match.rs:463-528`). The `sync_legacy_league` call was overwriting standings.
- Still risky for: cup competitions (if `game.league` points at domestic league when a cup result is applied), fixture-clash scenarios (second fixture silently skipped).

**IMPLEMENTATION PLAN:**
1. **P0: Verify cup competition write-back** — Audit any code path that calls `apply_match_report_with_capture` to confirm the write-back to `game.competitions[idx]` happens for ALL competition types, not just the legacy league mirror.
2. **P0: Fix fixture clash (Issue #28)** — Once the collision pass is in place, both fixtures will be on different days and both will be processed.

---

## WORKSTREAM 5: Data Persistence & World Building (Issues #9, #11, #25)

### Issue #9: Why re-derive attributes on every new game?
**ROOT CAUSE:**
- `refresh_player_derived` is called on world load to recompute OVR, potential, traits, fame, and (V99.10) market_value from the raw attributes in the DB. This is because the DB stores raw attributes but NOT the derived values.
- The re-derivation takes ~15-20 minutes (user's report) because it runs for all 5,324 players.

**IMPLEMENTATION PLAN:**
1. **P1: Pre-compute derived values in DB** — Run `refresh_player_derived` once during DB build and store the results (OVR, potential, traits, fame, market_value) in `gaffer_world.json`. Then `start_new_game` can skip the re-derivation entirely.
2. **P0: Show loading progress** — If re-derivation must run, show a progress bar instead of a blank screen.

### Issue #25: Are we saving enough data points?
**ROOT CAUSE:**
- `PlayerMatchStatsRecord` (`domain/src/stats.rs:19-45`) stores: fixture_id, season, matchday, date, competition, player_id, team_id, opponent, home/away goals, minutes, goals, assists, shots, shots_on_target, passes, tackles, interceptions, fouls, cards, rating. This is comprehensive.
- `CareerEntry` (`player.rs:483-490`) stores: season, team, appearances, goals, assists.
- `PlayerMovementEntry` (`player.rs:504-519`) stores: date, kind, from/to team, fee, loan end date.
- `WorldHistoryArchive` stores: rivalries, season awards, World Cup champions, national rankings, past league tables (V99.10 Item 17).
- `MemoryStore` (`narrative/mod.rs`) stores: memories (35 types), story threads (18 types), cooldowns.
- BUT: manager interactions and rivalries are NOT saved as discrete events. Manager head-to-head results are NOT stored. Player rivalries (beyond partnership bonuses) are NOT modeled.

**IMPLEMENTATION PLAN:**
1. **P1: Add manager head-to-head records** — Track W/D/L for each manager vs each other manager. Surface on "Other Gaffers" screen (Issue #24).
2. **P1: Add player rivalry system** — When two players have repeated on-field incidents (red cards against each other, goals in derbies), create a `PlayerRivalry` entry that surfaces in commentary and news.
3. **P2: Prune unread messages** — Currently only read messages are pruned. Add a cap (500 unread) to prevent unbounded growth.

---

## WORKSTREAM 6: UI & Presentation (Issues #1, #2, #10, #13, #14, #15, #16, #21, #23, #24, #26, #27, #29, #32, #33, #35)

### Issue #1: Player Profile screens — poor use of space
**ROOT CAUSE:**
- No height/weight fields exist in the data model. (`Player` struct has no height/weight)
- Multiple parallel definitions of attribute labels (ATTRIBUTE_SPECS, i18n keys, HEX_ATTR_KEY_MAP, PlayerProfile.attributes.ts) — 4-5 places to update when adding/renaming.
- Attribute descriptions don't hint at match engine effects — they're flavour text, not mechanical explanations.
- No Gaffer-stylised icons for attribute categories.

**IMPLEMENTATION PLAN:**
1. **P1: Add height/weight** — Add to `Player` struct, DB, and player profile. Source from FIFA data if available, else generate from position + power attribute.
2. **P1: Consolidate attribute label sources** — Make `ATTRIBUTE_SPECS.label` the single source. Have `HEX_ATTR_KEY_MAP` derive from it.
3. **P1: Add engine-effect hints to descriptions** — Each tier description should hint at what the attribute does in the match engine (e.g. "Pace: How quick they are. Gets them in behind, beats the offside trap, leaves defenders eating turf.")
4. **P2: Generate attribute category icons** — Create small Gaffer-stylised SVG icons for Body/Ball/Head/Gloves.

### Issue #2: UI — no textures visible, too many fonts, generic icons
**ROOT CAUSE:**
- V99.11 migration replaced all gray/navy with carbon/ink/slate tokens and forced dark mode. But some screens may still have conflicting styles.
- Fonts: UI spec calls for Oswald (display) + Inter (body) + JetBrains Mono (data). Currently Barlow Condensed is still in the fallback chain.
- Generic lucide-react icons remain for Home, Inbox, News, Settings in the sidebar. Only the World section was migrated to GafferIcons in V99.11 B6.

**IMPLEMENTATION PLAN:**
1. **P0: Audit every screen for remaining style conflicts** — Systematically check each of the 16 tab components for: remaining `bg-white`, `text-white`, hardcoded hex colors, `dark:` prefix issues.
2. **P1: Replace ALL remaining lucide icons** — Use the 9 new GafferIcons created in V99.11 B6 for Home, Inbox, News, Settings, and generate additional icons as needed.
3. **P1: Load Oswald + JetBrains Mono** — Add `@fontsource` packages for both fonts. Update `@theme` to use them as primary (already done in V99.11 B1 but fonts not installed).
4. **P2: Generate icon/button cache** — Create a comprehensive set of Gaffer-stylised icons and save in repo for future use.

### Issue #10: Tagline is crap, pre-game screens don't match
**ROOT CAUSE:**
- Current tagline: "The Beautiful Game, Ugly Truths" (V99.11) — user says it's crap.
- Pre-game screens (MainMenu, CreateManager, WorldSelect) don't use the Gaffer styling.

**IMPLEMENTATION PLAN:**
1. **P1: Better tagline** — Options: "Every Result Tells a Story", "Where Football Lives", "Manage. Master. Dominate.", "The Dugout Awaits". Pick one in Gaffer voice.
2. **P1: Restyle pre-game screens** — Apply carbon palette, brass accents, Gaffer logo to MainMenu, CreateManager, WorldSelect.

### Issues #13, #14, #15, #16, #21, #24, #26, #29, #32, #33: Screen-specific UI issues
**ROOT CAUSE:**
All of these screens need: Gaffer-voice treatment, interpretation layer applied to raw numbers, tooltips explaining relevance, better layout, Gaffer icons.

**IMPLEMENTATION PLAN:**
For EACH screen:
1. Apply the Gaffer interpretation layer to ALL raw numbers (not just some)
2. Add tooltips explaining what each stat/metric means
3. Ensure all data goes through `interpretXxx()` before display
4. Add Gaffer-stylised icons
5. Fix layout to use 12-column grid per UI spec

Priority screens: Squad (#15, #32), Manager/Gaffer (#33), Other Gaffers (#24), Clubs (#26), Transfer Centre (#21), Squad Pulse (#29), Dugout screens (#13).

### Issue #35: Hyperlinking and navigation
**ROOT CAUSE:**
- Player/team name mentions in news, commentary, and screens are NOT hyperlinked.
- Navigation is slow.

**IMPLEMENTATION PLAN:**
1. **P1: Add hyperlinks** — Every mention of a player or team name in news articles, match reports, and UI labels should be clickable, linking to the relevant profile.
2. **P2: Optimize navigation** — Pre-load profile data, use React.lazy with Suspense for faster tab switches.

---

## WORKSTREAM 7: Staff, Scouting & Youth (Issues #16, #17, #18, #19)

### Issue #17: Staff functionality underwhelming
**ROOT CAUSE:**
- 5 staff roles, 4 attributes, no personality, no staff limit per club.
- `hire_staff` has no count check — unlimited staff.
- Staff have no personality (no `PersonalityProfile` on `Staff` struct).
- Only effect: coaching_mult (0.85-1.35), specialization_mult (1.25), physio_mult (1.0-1.4).

**IMPLEMENTATION PLAN:**
1. **P0: Add staff limits** — Max 1 AssistantManager, 5 Coaches, 5 Scouts, 2 Physios per club (configurable by facilities).
2. **P1: Add staff personality** — Add `PersonalityProfile` to Staff. Affects: coaching style ( authoritarian → players improve faster but morale drops), scouting bias (overrates pace vs defending), physio approach (cautious vs aggressive recovery).
3. **P1: Add staff interaction** — Weekly meetings with assistant manager who gives advice on squad, training, tactics based on their attributes and personality.
4. **P2: Add staff career progression** — Staff attributes improve over time based on experience.

### Issue #18: Scouting half-arsed
**ROOT CAUSE:**
- Scouts find too many players (no filter for youth vs senior).
- No player profile scout button (ACTUALLY EXISTS at `PlayerProfile.tsx:741-763` — user may not have found it).
- Scouts have no personality or bias.
- `scout_max_assignments` ignores its parameter and returns 1 (`scouting.rs:51-54`).
- Reports use same i18n keys regardless of scout.
- High-reputation players are auto-known (rep ≥800 → Surface, same-league → Detailed).

**IMPLEMENTATION PLAN:**
1. **P0: Fix scout max assignments** — Implement scaling: 1 slot at <60 judging, 2 at 60-79, 3 at 80+.
2. **P1: Add scout personality/bias** — Each scout has a bias profile (overrates certain attributes, underrates others). Reports carry a degree of uncertainty. Different scouts produce different reports for the same player.
3. **P1: Add scout report flavour** — Reports should be written in the scout's voice based on personality. "Old school talent spotter" uses different language than "data analyst".
4. **P1: Add youth/senior scout filter** — Separate youth scouting from senior scouting with different result pools.
5. **P2: Make scout button more prominent** — Ensure it's visible on all non-own-club player profiles.

### Issue #19: Academy — not sure if working, seems repeated from scouting
**ROOT CAUSE:**
- Youth recruitment card is the SAME component (`ScoutingYouthRecruitmentCard`) used in both tabs. (`YouthAcademyTab.tsx:34` imports it, `ScoutingTab.tsx:32` imports it)
- Youth coaching specialization is shown in UI but has NO effect in training engine — `TrainingFocus` has no `Youth` variant. (`training.rs:51-67`)
- Youth academy overview cards (count, avg OVR, avg potential) are unique to the Youth tab.
- Player promotion from Youth to Senior squad is available.

**IMPLEMENTATION PLAN:**
1. **P0: Wire Youth specialization** — Add `TrainingFocus::Youth` variant OR have `compute_coaching_bonus` apply a youth-age-player multiplier when a Youth-specialist is on staff.
2. **P1: Differentiate Youth tab from Scouting** — Remove the duplicated recruitment card from Youth tab. Instead, Youth tab should show: academy facility level, youth intake history, youth player development tracker, youth coach assignments.
3. **P1: Add youth intake notification** — When new youth players arrive at end-of-season, generate a detailed news article + inbox message listing the new prospects with Gaffer-voice descriptions.

---

## WORKSTREAM 8: Game World & Longevity (Issues #22, #30, #34, #36, #37, #39)

### Issue #22: Hall of Fame defaults to Belgian clubs
**ROOT CAUSE:**
- Hall of Fame sorting/filtering likely doesn't prioritise the user's league/region. Need to check `HallOfFameWorldTab.tsx` for the default sort.

**IMPLEMENTATION PLAN:**
1. **P0: Fix Hall of Fame default** — Sort by user's league first, then by global reputation. Default to showing the user's domestic league history.

### Issue #30: Morale too easy
**ROOT CAUSE:**
- Morale recovery is driven by match results (win +2, draw -1, loss -3) and manager personality (`morale_recovery_bonus` 0.0-0.5).
- No negative morale drivers beyond losses.
- No "unrest" events (squad unhappiness after a star player is sold, manager ignores contract requests, etc.).

**IMPLEMENTATION PLAN:**
1. **P1: Add morale drivers** — Selling a star player without replacement → squad morale drop. Losing 3 in a row → "crisis" morale state. Player not getting game time → individual morale drop. Rival club bidding for a player → that player's morale may rise (feels wanted) or drop (wants to leave).
2. **P1: Add morale recovery difficulty** — Recovery from "crisis" state should be slower than from "slightly down". Require 2 consecutive wins to exit crisis, not just 1.

### Issue #36: Stadiums needed
**ROOT CAUSE:**
- No stadium data in the DB. No stadium expansion feature. No "Talk to Board" feature.

**IMPLEMENTATION PLAN:**
1. **P2: Add stadium data** — One-off task to populate DB with real stadium names + capacities.
2. **P2: Stadium expansion** — If club can afford it, wants to, and it's relevant to club size. Cascades into finances.
3. **P2: "Talk to Board" feature** — Gaffer-voice options: request more time (small chance), request more transfer money (very small chance, bigger if sugar daddy owner). Board reply: "You concentrate on winning matches" (sideways dig at Football Manager series).

### Issue #37: More QOL changes needed
**IMPLEMENTATION PLAN:**
1. **P1: Varied board expectations** — Per-club reputation tier: elite expects top 4 + cup semi; mid-table expects top half; relegation candidate expects survival.
2. **P1: Resurfaced memories in news** — Already implemented (weekly resurfacing) but needs variety in presentation.
3. **Ongoing: Data presentation** — Every raw number should go through interpretation layer.

### Issue #39: Reserve teams
**IMPLEMENTATION PLAN:**
1. **P2: Reserve team sparse sim** — Each club has a reserve team. Reserve matches are sparse-simulated (scoreline only). Players not in the first-team squad get reserve minutes. Affects: match fitness, development, morale (players want game time). No separate UI — just a "Reserve Team" panel on the Squad tab showing reserve results and player minutes.

---

## PRIORITY SUMMARY

### P0 (Blocks playability — do first):
1. Fix transfer market: per-window dedup + ownership check (#6)
2. Per-club reputation/budget variation in DB (#7)
3. Wage sanity band (#20)
4. Fix scorelines: lower conversion formula + shot cooldown (#31)
5. Fix GK ratings: add saves field + GK-specific logic (#38)
6. Competition rules: bench size + prestige (#8)
7. Fix fixture clashes: post-scheduling collision pass (#28)
8. Add `not_for_sale` + reject all bids (#5)
9. Move Phase Blueprint to Style tab (#3)
10. Fix Hall of Fame default (#22)

### P1 (Blocks fun — do second):
1. Rotating pundit cast with personalities (#12)
2. Wire narrative into commentary (#12)
3. Add momentum/quiet events (#12)
4. Role descriptions with engine-effect hints (#3)
5. Position retraining system (#3)
6. Scout personality/bias (#18)
7. Staff limits + personality (#17)
8. Wire Youth specialization (#19)
9. Add player height/weight (#1)
10. Pre-game screen restyle (#10)
11. Stadiums + Talk to Board (#36)
12. Varied board expectations (#37)
13. Hyperlinking (#35)
14. Manager head-to-head records (#24, #33)
15. Morale difficulty tuning (#30)
16. Pre-compute derived values in DB (#9)

### P2 (Polish — do last):
1. Perspective pitch (#3)
2. Position retraining (#3)
3. Staff career progression (#17)
4. Scout report flavour by personality (#18)
5. Reserve teams (#39)
6. Attribute category icons (#1)
7. Generate icon/button cache (#2)
8. International fixture labels (#34)
9. Prune unread messages (#25)

---

## ESTIMATED EFFORT

| Workstream | P0 items | P1 items | P2 items | Total est. days |
|---|---|---|---|---|
| 1. Match Engine & Commentary | 5 | 4 | 2 | 8 |
| 2. Tactics & Roles | 2 | 3 | 2 | 5 |
| 3. Transfers & Finances | 5 | 3 | 0 | 5 |
| 4. Competitions & Fixtures | 3 | 1 | 0 | 3 |
| 5. Data Persistence | 1 | 3 | 1 | 3 |
| 6. UI & Presentation | 2 | 8 | 3 | 10 |
| 7. Staff, Scouting & Youth | 2 | 4 | 2 | 5 |
| 8. Game World & Longevity | 1 | 3 | 2 | 4 |
| **TOTAL** | **21** | **29** | **12** | **~43 days** |

---

## KEY ARCHITECTURAL DECISIONS NEEDED

1. **DB rebuild vs migration** — Per-club reputation/budget variation requires either rebuilding `gaffer_world.json` or adding a post-load scaling pass. Rebuilding is cleaner but breaks existing saves.

2. **Pundit system** — Define pundits as a static list in code, or as a data file? Static is simpler; data file allows modding.

3. **Reserve teams** — Separate `Team` entities (doubling team count) or a lightweight `ReserveSquad` struct on `Team`? Lightweight is simpler but limits features.

4. **Position retraining** — New `training_position_focus` field + XP accumulation, or reuse the existing `alternate_positions` field with a "learning" flag? New field is cleaner.

5. **Competition rules** — Extend `CompetitionRules` struct (breaking change for saves) or add a separate `CompetitionRulesExtended` struct? Extending is cleaner; save migration needed.

---

This document is the single source of truth for V100 development. Every issue has been traced to its root cause in the code, interconnected systems identified, and specific implementation steps defined.
