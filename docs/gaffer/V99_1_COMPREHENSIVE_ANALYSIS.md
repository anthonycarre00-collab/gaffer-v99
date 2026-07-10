# V99.1 — Comprehensive Analysis & Action Plan

**Date:** 2026-07-11
**Status:** PLANNING ONLY — no code changes
**Based on:** User screenshots, FIFA data files, V99 overhaul plan, codebase audit

---

## Executive Summary

The V99 overhaul delivered significant improvements but **many deliverables were lost or never properly integrated**. The screenshots reveal systemic issues across 5 areas: (1) raw numbers still showing everywhere, (2) match stats not recording, (3) boring UI with no visual identity, (4) confusing game world/DB loading, and (5) broken auto-save.

The FIFA data files (players_15.csv through players_22.csv) are a **goldmine** — 45,629 unique players with full attributes, height/weight, face URLs, and club logo URLs across 55 leagues. This should replace the current 3,376-player DB entirely.

---

## PART 1: ISSUE AUDIT (from screenshots + user feedback)

### Issue 1: Raw Numbers Still Showing Everywhere
**Screenshots:** dugout overall.JPG, player and show the numbers.JPG, tactics roles numbers.JPG, team talk numbers.JPG, squad sec player profile.JPG, squad pulse.JPG

**What's wrong:**
- Dugout (Home tab): "Avg OVR: 63" shown as raw number — should be Gaffer interpretation
- Squad Pulse: "36", "50", "0" shown as raw numbers — needs interpretation
- Player profile: "Show the numbers" section explicitly reveals raw attributes
- Tactics roles: "Captaining 84", "Team Ethic 50" — raw numbers shown
- Team talk: "+3", "-3" morale deltas shown as raw numbers
- Squad section player profile: category averages shown as numbers

**Root cause:** The OVR interpretation layer (Phase 1) was only wired into ~10 components. Many screens were missed. The "show the numbers" section was never removed. Squad Pulse values were never interpreted. Team talk morale deltas were never interpreted. Tactics role panel was never interpreted.

**Affected files (need OVR interpretation):**
- `src/components/home/HomeSquadOverviewCard.tsx` — Avg OVR number
- `src/components/home/HomeSeasonStatusCard.tsx` — league position number
- `src/components/ui/PlayerMeaningCard.tsx` — "Show the numbers" section + spreadsheet attrs
- `src/components/tactics/TacticsPlayerFocusPanel.tsx` — overall rating number
- `src/components/tactics/TacticsRightPanel.tsx` — role attribute numbers
- `src/components/match/HalfTimeBreak.tsx` — team talk morale deltas
- `src/components/match/PostMatchScreen.tsx` — player rating numbers
- `src/components/squad/SquadRosterView.tsx` — category averages (some fixed, some missed)

### Issue 2: Match Stats Not Recording
**Screenshots:** post match weirdness and stats.JPG, gaffer match stats not updated..JPG

**What's wrong:**
- Post-match "Goal Sources" shows 0 for most categories
- Manager career stats not updating on "The Gaffer" tab
- Player stats (appearances, goals, assists) showing 0

**Root cause:** The engine's `report.rs` `from_events_with_players()` function tracks stats from events, BUT:
1. The V99 new event types (HeaderWon, HeaderLost, Offside, Dribble, DribbleTackled, Cross) fall through to the `_ => {}` catch-all in report.rs — they're NOT tracked in player stats
2. The `simulate_single_match_with_capture` function uses `engine::simulate()` (simple path) which DOES produce player_stats, but the `apply_player_stats` function in post_match.rs may not be wiring them correctly for the user's live matches
3. The manager career stats (matches_managed, wins, draws, losses) are tracked in `ManagerCareerStats` but the "The Gaffer" tab may not be reading them

**Fix needed:**
- Add V99 event types to the stats tracking in `report.rs`
- Verify `apply_player_stats` is called after live matches (not just CPU matches)
- Verify manager career stats are updated after each match

### Issue 3: Boring UI / No Visual Identity
**Screenshots:** match day boring.JPG, team talk dull icons shit.JPG, tactics style play presentation..JPG, dugout overall.JPG

**What's wrong:**
- Pre-match screen has a game controller icon — inappropriate for a football manager game
- Team talk screen has dull icons, no personality
- Tactics screen doesn't "scream tactics" — no pitch texture, no tactical board feel
- Dugout is plain dark with no team color integration
- No club logos/badges visible anywhere
- No team color theming in the UI

**Root cause:** The UI softening (Phase 3) only changed border radius + shadows. No visual identity work was done. No team colors integrated. No club logos fetched. No textures applied to key screens.

### Issue 4: Confusing Game World / DB Loading
**User feedback:** "options are confusing"

**What's wrong:**
- Main menu shows "New Career" / "Pick Up Where You Left Off" but doesn't explain what world DB will be used
- World Select screen is technical and confusing
- No clear option to "Start with real players" vs "Start with random world"
- The bundled DB has 3,376 players but FIFA data has 19,239 (FIFA 22 alone)
- No club logos or league logos in the DB

**Root cause:** The game loads from `gaffer_world.json` which has 3,376 players from FBref. The FIFA CSVs (players_15-22.csv) with 45,629 players were uploaded but never integrated. The world select UI is designed for technical users, not casual players.

### Issue 5: Auto-Save Too Frequent / Annoying
**Screenshot:** auto save too often.JPG

**What's wrong:**
- Game saves too frequently, causing performance issues
- No clear save indicator beyond the flash
- Save happens on every advance, which is too often

**Root cause:** The `isDirty` flag is set to `true` on every `setGameState` call. The game then prompts to save on window close if dirty. There's no auto-save interval — it's all manual. But the "dirty" state accumulates fast because every advance sets it. The user perceives this as "auto-save" because they keep getting prompted.

**Fix needed:** Implement a proper auto-save interval (every N days, configurable in settings) instead of prompting on every change. Save silently in the background.

### Issue 6: Continue Screen Still Annoying
**Screenshot:** continue screen.JPG

**What's wrong:**
- "SORTED" + "Nothing to show" box still appears after Continue
- Not showing useful content (fixtures, results, news) during processing

**Root cause:** The Phase 6 recap rework changed the recap modal to a toast panel, but the `DashboardSimulatingModal` (the "processing" screen) still shows "Nothing to show" when there are no digest entries. It should show upcoming fixtures / recent results / news instead.

### Issue 7: Opposition Auto-Pick Bug
**Screenshot:** amend opposition tactics.JPG

**What's wrong:**
- User can "auto pick starting 11" for the opposition team — this is a bug
- The pre-match setup should only allow the user to manage their own team

**Root cause:** The PreMatchSetup component likely doesn't check which side is the user's team before showing the auto-select button.

### Issue 8: Player Images Still Poor
**Screenshot:** player prfile img and age and ovr.JPG

**What's wrong:**
- 17-year-old player shown as bald and looking 40
- Procedural portrait generator not producing age-appropriate images

**Root cause:** The age-aware portrait system (Phase 4) was implemented but the GENERATOR_VERSION bump means all cached portraits need regeneration. The user may be seeing old cached portraits. Also, the age detection relies on `date_of_birth` which may not be populated for all players.

### Issue 9: "How's this calculated" Links
**Screenshot:** squad pulse.JPG, dugout overall.JPG

**What's wrong:**
- "How's this calculated?" links are shown — should be "What is this?" in Gaffer voice
- Should never show calculations, only interpreted descriptions

**Root cause:** The i18n strings were changed in earlier sweeps but the actual UI components still use the old "how is this calculated" text.

---

## PART 2: FIFA DATA INTEGRATION PLAN

### What the FIFA data provides

| Metric | Current DB | FIFA 22 CSV | Improvement |
|---|---|---|---|
| Players | 3,376 | 19,239 | 5.7x more |
| Leagues | 6 | 55 | 9x more |
| Clubs | 114 | 701 | 6.1x more |
| Height/Weight | 0% | 100% | Complete |
| Face URLs | 2,151 (Wiki) | 19,239 (SoFifa CDN) | Complete |
| Club logos | 0 | 701 | Complete |
| Attributes | Derived from FBref | Full FIFA attrs | Better source |
| Mental attrs | Derived (poorly) | Direct from FIFA | Much better |

### FIFA → Gaffer Attribute Mapping

| Gaffer Attribute | FIFA Source | Notes |
|---|---|---|
| pace | movement_sprint_speed | Direct map |
| burst | movement_acceleration | Direct map |
| engine | power_stamina | Direct map |
| power | power_strength | Direct map |
| agility | movement_agility | Direct map |
| passing | attacking_short_passing | Direct map |
| distribution | skill_long_passing | Direct map |
| touch | skill_ball_control | Direct map (was dribbling_success) |
| finishing | attacking_finishing | Direct map |
| defending | defending_standing_tackle | Direct map |
| aerial | attacking_heading_accuracy | Direct map |
| anticipation | mentality_interceptions | Close proxy |
| vision | mentality_vision | Direct map |
| decisions | mentality_positioning | Close proxy |
| composure | mentality_composure | Direct map |
| leadership | international_reputation * 20 | Derived |
| aggression | mentality_aggression | Direct map |
| teamwork | (work_rate + defending_marking) / 2 | Derived |
| stability | (composure + reactions) / 2 | Derived |
| morale | 75 (default, game-managed) | Set at game start |
| shot_stopping | goalkeeping_diving | GK only |
| commanding | goalkeeping_positioning | GK only |
| playing_out | goalkeeping_kicking | GK only |

### Image Sources

1. **SoFifa CDN** — `player_face_url` in FIFA CSVs (e.g. `https://cdn.sofifa.net/players/158/023/22_120.png`)
   - 19,239 face URLs available
   - 2,220 marked as `real_face=Yes` (actual photos)
   - Rest are FIFA-generated faces (still better than procedural)
   
2. **Club logos** — `club_logo_url` in FIFA CSVs (e.g. `https://cdn.sofifa.net/teams/73/60.png`)
   - 701 club logo URLs available
   
3. **National flag URLs** — `nation_flag_url` in FIFA CSVs
   - All national teams covered

4. **sortitoutsi.net megapack** — community face packs (huge, need clever downloading)
   - URL: https://sortitoutsi.net/graphics/megapack/1360
   - Would need to download in chunks

### Recommended approach

1. Build a new `gaffer_world.json` from FIFA 22 data (most recent complete set)
2. Map FIFA attributes → Gaffer attributes using the table above
3. Download all 19,239 face images from SoFifa CDN (chunked, resumable)
4. Download all 701 club logos from SoFifa CDN
5. Include only 2-3 seasons of generated history (not 12)
6. Offer "small/medium/large" world size options (top 5 leagues / top 15 / all 55)

---

## PART 3: COMPREHENSIVE ACTION PLAN

### Phase A: Database Rebuild from FIFA Data (1-2 sessions)

**A1. Build new world DB from FIFA 22 CSV**
- Parse `players_22.csv` (19,239 players)
- Map FIFA attributes → Gaffer attributes (using table above)
- Build teams from `club_name` + `league_name` fields
- Build competitions from unique `league_name` values
- Include height_cm, weight_kg, DOB, nationality, wage, value, contract end
- Generate staff (managers from real world, coaches/scouts/physios generated)
- Include 2-3 seasons of generated history (not 12)
- Include rivalries (seeded from real world derbies)
- Include relationships (generated, minimal)

**A2. Download all face images from SoFifa CDN**
- 19,239 player face URLs in FIFA 22 CSV
- Download in chunks of 100 (resumable via manifest)
- Save to `public/face-cache/` (served by Vite/Tauri)
- Set `media.face` in DB for each player

**A3. Download all club logos from SoFifa CDN**
- 701 club logo URLs in FIFA 22 CSV
- Download all (small files, ~60px)
- Save to `public/club-logos/`
- Set `media.logo` on each team in DB

**A4. Download national flag images**
- From `nation_flag_url` in FIFA CSV
- Save to `public/flags/`

**A5. Simplify game world loading**
- Main menu: "New Career" → loads default real-world DB (no confusing options)
- Settings: "World Size" option (Small=5 leagues / Medium=15 / Large=55)
- World Editor: accessible but not prominent (for modders)
- Remove confusing "Random World" option from main flow

### Phase B: Interpretation Layer Completion (1 session)

**B1. Remove ALL raw numbers from ALL screens**
- Audit every component that displays `player.ovr` or attribute values
- Replace with `shortOvrLabel()` or `interpretAttribute()`
- Remove the "Show the numbers" section entirely from PlayerMeaningCard
- Replace "How's this calculated?" with "What is this?" in Gaffer voice
- Add Gaffer interpretation to Squad Pulse values (36 → "The lads are buzzing" / "Flat" / etc.)
- Add Gaffer interpretation to team talk morale deltas (+3 → "Lifted" / -3 → "Deflated")
- Add Gaffer interpretation to tactics role panel attributes
- Add Gaffer interpretation to condition/morale on player profile (not numbers)

**B2. Fix PlayerMeaningCard**
- Remove `spreadsheet_attributes` display entirely
- Replace with interpreted descriptions only
- Remove "Show the numbers" toggle

**B3. Add Squad Pulse interpretations**
- Squad Pulse value → Gaffer voice description ("Buzzing", "Steady", "Flat", "Toxic")
- Tactical Coherence → ("In Sync", "Gelling", "All Over the Shop")
- Media Heat → ("Front Page News", "Quiet", "Under the Radar")
- Replace "How's this calculated?" with "What is this?" + brief Gaffer explanation

### Phase C: Match Stats Fix (1 session)

**C1. Add V99 events to report.rs stats tracking**
- HeaderWon → track headers_won in player stats
- HeaderLost → track headers_lost
- Offside → track offsides
- Dribble → track dribbles_completed
- DribbleTackled → track dribbles_tackled
- Cross → track crosses

**C2. Verify stats flow from live matches**
- Check that `apply_player_stats` is called after user's live match
- Check that manager career stats update after each match
- Verify the "The Gaffer" tab reads from the correct stats source

**C3. Fix "The Gaffer" tab**
- Show manager career stats (matches, wins, draws, losses, trophies)
- Add manager story narrative (career history, milestones)
- Make it visually interesting (not boring text)

### Phase D: UI Visual Identity (1-2 sessions)

**D1. Professional logo + tagline**
- Generate a proper SVG crest for "The Gaffer"
- Better tagline (not "Tactics. Touchlines. Tears.")
- Integrate into main menu, sidebar, loading screen

**D2. Team color theming**
- When user selects a club, extract team colors from DB
- Apply team primary color as accent throughout the UI (sidebar, headers, buttons)
- Subtle integration — not overwhelming, just themed

**D3. Club logos everywhere**
- Show club logo next to team name in all contexts
- Pre-match screen, tactics screen, standings, fixtures, news
- Use the downloaded SoFifa logos

**D4. Screen-specific visual improvements**
- Pre-match: remove game controller icon, add stadium/pitch background, show both team logos + colors
- Team talk: replace dull icons with expressive ones, add player reaction visuals
- Tactics: add tactics board texture, formation visualization with real player photos
- Dugout: integrate team colors, add visual hierarchy
- Match screen: TV-style overlay with team logos, score, clock

**D5. Remove "auto pick starting 11" for opposition**
- Pre-match setup should only show controls for the user's team
- Opposition lineup should be auto-set by AI, not user-editable

### Phase E: Auto-Save + Continue Screen Fix (0.5 session)

**E1. Fix auto-save**
- Implement configurable auto-save interval (every 7 days default)
- Save silently in the background (no prompt)
- Only prompt on window close if unsaved changes AND auto-save is off
- Add "Last saved: [time]" indicator in the header

**E2. Fix continue/processing screen**
- Replace "Nothing to show" with useful content:
  - Upcoming fixtures (next 3 matches)
  - Recent results (last 3 matches)
  - Latest news headlines
- Show this content WHILE processing, not after
- Remove the "SORTED" label — replace with "Crunching the numbers..."

### Phase F: Portrait Generator Fix (0.5 session)

**F1. Fix age-aware portraits**
- Clear all cached portraits (bump GENERATOR_VERSION again)
- Verify date_of_birth is populated for all players (from FIFA data)
- Test that 17-year-olds don't get gray hair or beards
- Test that 35+ players do get gray hair
- Tune the procedural generator for better age representation

**F2. Use FIFA face URLs as primary source**
- With the new FIFA-based DB, all 19,239 players will have face URLs
- The procedural generator is only for:
  - Youth academy recruits (generated at runtime)
  - Regens (generated at runtime)
  - Players without a FIFA face URL (rare)

### Phase G: Additional Polish (1 session)

**G1. Tooltips on all key UI elements**
- Add Gaffer-voice tooltips to squad screen labels
- Add tooltips to tactics dials
- Add tooltips to training settings
- Add tooltips to stats columns

**G2. Squad screen pre-built views**
- Add dropdown for pre-built views (Goals, Assists, Form, Fatigue, Condition)
- All views use Gaffer interpretation (no raw numbers)

**G3. Inbox message improvements**
- Fix unresponsive buttons in inbox messages
- Clarify what "I understand" does
- Add Gaffer voice to all message templates
- Wire inbox frequency setting into message generation

**G4. Training fatigue balance**
- Reduce fatigue accumulation rate
- Fewer "knackered" popups
- Player mental attributes affect growth rate of others
- Worldbeaters should be rare — tune development curves

---

## PART 4: PRIORITY RANKING

| Priority | Phase | Impact | Effort |
|---|---|---|---|
| 1 | A: Database rebuild from FIFA | Massive — fixes DB, images, attributes, logos | 2 sessions |
| 2 | B: Interpretation layer completion | High — fixes core Gaffer constitution violation | 1 session |
| 3 | C: Match stats fix | High — stats not recording is a game-breaking bug | 1 session |
| 4 | D: UI visual identity | High — makes the game look professional | 2 sessions |
| 5 | E: Auto-save + continue fix | Medium — quality of life | 0.5 session |
| 6 | F: Portrait fix | Medium — visual quality | 0.5 session |
| 7 | G: Additional polish | Medium — tooltips, views, inbox | 1 session |

**Total: ~8 sessions for full V99.1 overhaul**

---

## PART 5: LOGO + TAGLINE PROPOSALS

### Logo concept
A shield crest with:
- Brass/gold outline (football association style)
- Pitch-green inner field
- A manager's whistle at the center (the Gaffer's instrument)
- Crossed tactical bars behind the whistle
- Monogram "G" above
- Three stars below (tactics, man-management, transfers)
- Bottom ribbon

### Tagline options
1. "Every Decision. Every Week. All Season."
2. "The Dugout Awaits."
3. "Manage the Game. Master the Mind."
4. "Eleven Men. One Plan. No Excuses."
5. "From the Touchline to the Trophy."
6. "The Beautiful Game. Your Ugly Decisions."
7. "Pick the Team. Take the Flak."
8. "Where Gaffers Are Made."

**Recommended:** "Manage the Game. Master the Mind." — professional, memorable, captures both the tactical and mental aspects.

---

## PART 6: WHAT WAS LOST FROM V99

| V99 Deliverable | Status | Issue |
|---|---|---|
| OVR interpretation in 17 components | Partial | Only ~10 done, many screens still show numbers |
| Commentary expansion (12 new events) | Done | But new events not tracked in report.rs for stats |
| Scouting auto-reveal | Done | Working |
| Engine double-count fixes | Done | Working |
| Position-dependent attributes | Done | Working |
| playing_out wired | Done | Working |
| Header/Offside events | Done | But not tracked in stats |
| Sparse simulator | Done | But not wired into turn loop |
| Toast notifications | Done | Working |
| Tactics sub-tabs | Done | Working |
| Real player images (2,151) | Partial | Many still missing, procedural portraits poor |
| 740 staff | Done | Working |
| 14 competitions | Done | Working |
| Community face-pack hook | Done | Working |
| Gaffer-voice roles | Done | Working |
| Press conference rework | Done | Working |
| Recap popup rework | Done | But simulating modal still shows "Nothing to show" |
| Inbox frequency | Done | Setting added but not wired into generation |
| Generated player balancing | Done | Working |
| Age-aware portraits | Partial | Not working well — 17yo looks 40 |

---

## PART 7: DATA SOURCES REFERENCE

| Source | What it provides | URL/Path |
|---|---|---|
| FIFA 22 CSV (players_22.csv) | 19,239 players, full attrs, height/weight, face URLs, club logos | `/home/z/my-project/gaffer/players_22.csv` |
| FIFA 15-22 CSVs | 45,629 unique players across 8 years | `/home/z/my-project/gaffer/players_*.csv` |
| fifa_players.csv | Alternative FIFA data (17,955 players) | `/home/z/my-project/upload/fifa_players.csv` |
| SoFifa CDN | Player face images | `https://cdn.sofifa.net/players/{id}/{version}_120.png` |
| SoFifa CDN | Club logo images | `https://cdn.sofifa.net/teams/{id}/60.png` |
| SoFifa CDN | National flag images | `https://cdn.sofifa.net/flags/{country}.png` |
| sortitoutsi.net | Community face megapack | `https://sortitoutsi.net/graphics/megapack/1360` |
| Wikipedia API | Player images (backup) | Already implemented in fetch scripts |
| Current gaffer_world.json | 3,376 players (to be replaced) | `src-tauri/databases/gaffer_world.json` |

---

## NEXT STEPS

1. **Confirm this plan** — user reviews and approves/adjusts priorities
2. **Start with Phase A** (Database rebuild from FIFA) — this is the foundation everything else builds on
3. **Then Phase B** (Interpretation completion) — fixes the core Gaffer constitution violation
4. **Then Phase C** (Match stats fix) — fixes the game-breaking stats bug
5. **Then Phase D** (UI visual identity) — makes it look professional
6. **Then E, F, G** in order

Each phase is independently shippable. The user should rebuild and test after each phase.

---

*This document is the comprehensive analysis the user requested. No code changes have been made. No pushes. Just planning.*
