# V100 HONEST STATUS AUDIT
**Created:** 2026-07-19
**Purpose:** Honest tracking of what EXISTS, what's WIRED, and what's MISSING.

For each feature: ✅ = fully working (backend + UI + displays) | ⚠️ = backend exists, NO UI | ❌ = missing entirely

---

## ISSUE #1: Player Profile screens
- [✅] Height/weight fields added to Player struct
- [❌] Height/weight NOT in bundled DB JSON (build_fifa_world.py reads from FIFA but never writes to output dict)
- [⚠️] Height/weight generated from position+power in refresh_player_derived (GUESSED, not real data)
- [✅] Height/weight displayed on PlayerProfileHeroCard
- [✅] Role descriptions (27) added to en.json
- [✅] Role descriptions displayed on PlayerProfile below role selector
- [❌] Attribute category icons (Body/Ball/Head/Gloves) — NOT generated
- [❌] Single source of truth for attribute labels — NOT consolidated

## ISSUE #2: UI (textures, fonts, icons)
- [✅] Oswald + JetBrains Mono fonts installed via @fontsource
- [✅] Barlow Condensed removed from font-heading fallback
- [⚠️] Pitch-mow background texture — CSS exists in App.css but may not be visible
- [⚠️] Brass marker bar — CSS class exists but NOT applied to every card title
- [⚠️] Corner brackets — CSS class exists but NOT applied to hero panels
- [❌] Dossier paper grain — NOT applied to scouting/player profile screens
- [❌] Generic sidebar icons — STILL using lucide-react, only 2 GafferIcons exist
- [⚠️] 434 redundant `dark:` prefixes remain (forced dark mode makes them no-ops)
- [❌] No comprehensive icon/button cache generated

## ISSUE #3: Tactics screens
- [⚠️] Perspective pitch — only rotateX(8deg), NOT the full turf-styled pitch per spec §9
- [❌] No mow-stripe turf, no brass-rimmed player tokens, no corner brackets
- [❌] No squad rail (220px left) or instructions rail (260px right) per spec §9
- [✅] Phase Blueprint moved to Style tab
- [✅] Role descriptions added (27 Gaffer-voice descriptions)
- [❌] Position retraining — backend command exists, NO UI dropdown on PlayerProfile
- [❌] Out-of-position penalty in match engine — NOT applied
- [❌] Drag-and-drop improvements — NOT done

## ISSUE #4: News
- [❌] News variety — NOT improved, still too sensational
- [❌] Multiple news sources (tabloid/broadsheet/social) — NOT implemented
- [❌] News category icons — NOT added
- [❌] Event/memory resurfacing in news — NOT verified working
- [❌] News spinner — exists but single-source, not varied

## ISSUE #5: Player influence
- [✅] not_for_sale field + toggle command + UI menu item on PlayerProfile
- [✅] reject_all_pending_offers command + UI menu item on PlayerProfile
- [✅] Prune rejected offers (daily, >30 days)
- [❌] Talk to squad feature (pre-match/post-match team talks) — team_talk EXISTS for live match but NO pre-match squad talk
- [❌] Bid influence on morale — NOT implemented

## ISSUE #6: Transfer market
- [✅] Per-window moved_player_ids on Game struct
- [✅] Ownership check in execute_transfer
- [✅] moved_player_ids cleared on window status transition
- [✅] Per-window dedup in evaluate_transfer_market

## ISSUE #7: Club reputation variety
- [✅] Per-club reputation recomputation from squad-avg OVR at game start
- [✅] 6 tiers (Elite 900 → Lower-league 450)
- [✅] V99.7-2/3 finance scaling now produces varied budgets

## ISSUE #8: Competition rules
- [✅] CompetitionRules extended with bench_size, extra_time, penalties, prestige
- [✅] bench_size wired into LiveMatchState via with_max_subs()
- [⚠️] extra_time field — set but NOT read by live match engine (uses allows_extra_time bool instead)
- [⚠️] penalties field — set but NOT read
- [⚠️] prestige field — set but NOT read by news/board/prize logic

## ISSUE #9: DB load time
- [⚠️] Skip logic exists BUT doesn't work — checks height_cm==0, ALL players have height_cm==0 (not in DB), so ALL 5,324 players run refresh_player_derived anyway
- [❌] Height/weight NOT written to DB JSON by build_fifa_world.py
- [✅] Loading progress logs added (every 500 players)

## ISSUE #10: Tagline + pre-game screens
- [✅] Tagline changed to "Every Result Tells a Story"
- [✅] New logo (gaffer-logo-v100.webp) added
- [✅] Logo used on DashboardSidebar
- [✅] Logo used on MainMenu
- [⚠️] MainMenu restyled with carbon gradient but NOT fully per UI spec

## ISSUE #11: Results pushing to league tables
- [✅] Round summary fix (scans game.competitions for user's competition)
- [✅] Cup write-back audit confirmed correct (no BROKEN paths)

## ISSUE #12: Commentary + match engine
- [✅] 4 new event types (MomentumShift, QuietMinute, SustainedPressure, CounterAttack)
- [✅] Commentary templates added (5 per event type)
- [✅] Pundit system (6 pundits with personalities, data file)
- [✅] Pundit names fetched in MatchPanels
- [⚠️] Pundit names may not display correctly (speaker field logic untested)
- [❌] Narrative memory NOT wired into live commentary
- [❌] Build-up play commentary — NOT implemented
- [❌] Pundit catchphrases NOT used in live commentary (only name attribution)

## ISSUE #17: Staff
- [✅] Staff limits per role (Manager=1, AsstMgr=1, Coach=5, Scout=5, Physio=2)
- [✅] Staff personality field added (but NOT read by any logic)
- [✅] Staff career progression (attributes improve at end-of-season)
- [⚠️] Assistant manager advice — backend command exists, NO UI to display it
- [❌] Staff interaction (weekly meetings) — NOT implemented

## ISSUE #18: Scouting
- [✅] scout_max_assignments tiered scaling (1/2/3 by judging_ability)
- [✅] Scout bias field added to Staff
- [✅] Scout bias applied in build_scout_report
- [⚠️] Scout bias NOT applied in progressive_reveal (fuzz_attribute_with_bias unused)
- [❌] Scout report flavour text by personality — NOT implemented
- [❌] Youth/senior scout filter — NOT implemented
- [❌] Scout button prominence — NOT improved

## ISSUE #19: Academy
- [✅] Youth specialization wired into training (+25% for U21 with Youth coach)
- [✅] Youth Development Tracker card added to YouthAcademyTab
- [⚠️] Youth tab still shares ScoutingYouthRecruitmentCard with Scouting tab

## ISSUE #20: Wages
- [✅] Wage sanity band in reference_player_wage (clamps to [mv/100, mv/25])
- [✅] Wage recomputation from market_value/50 at game start

## ISSUE #22: Hall of Fame
- [✅] userTeamId sorting (prioritizes user's league champions/legends first)

## ISSUE #24/#33: Manager H2H + Other Gaffers screen
- [✅] ManagerHeadToHead struct + tracking in post_match
- [❌] H2H NOT displayed on Other Gaffers screen
- [❌] Other Gaffers screen NOT updated with H2H, win rates, or Gaffer voice

## ISSUE #25: Data persistence + pruning
- [✅] Prune rejected/withdrawn transfer offers (>30 days)
- [✅] Cap unread messages at 500

## ISSUE #28/#34: Fixture clashes + international labels
- [✅] cross_competition_collision_pass function
- [✅] Wired into end_of_season
- [✅] International fixture labels fixed (national_teams in name lookup)

## ISSUE #30: Morale
- [✅] Morale difficulty tuning (crisis state at 5+ losses, slower recovery)

## ISSUE #31: Scorelines
- [✅] Conversion formula lowered (/150 → /250)
- [✅] Shot cooldown (50% clear to midfield)
- [✅] Test assertion tightened (<4.0 → <3.0)

## ISSUE #35: Hyperlinking
- [✅] EntityLink/PlayerLink/TeamLink components created
- [❌] NOT used in NewsTab, InboxTab, or match reports (components exist but unused)
- [❌] Navigation NOT optimized

## ISSUE #36: Stadiums + Talk to Board
- [⚠️] Talk to Board — backend command exists, NO UI button/panel in Finances tab
- [❌] Stadium data — NOT populated in DB
- [❌] Stadium expansion — backend logic exists but NO UI

## ISSUE #37: Board expectations
- [✅] Varied board expectations (5 tiers + cup_target_round)
- [⚠️] cup_target_round — set but NOT surfaced in UI

## ISSUE #39: Reserve teams
- [⚠️] move_to_reserve + promote_from_reserve commands exist, NO UI panel on Squad tab
- [❌] Reserve team sparse sim — NOT implemented
- [❌] Reserve results display — NOT implemented

---

## SUMMARY

### Fully working (backend + UI + displays): 18 items
### Backend only (NO UI — user can't see/use): 8 items
1. Talk to Board (no button in Finances)
2. Reserve teams (no panel in Squad tab)
3. Position retraining (no dropdown on PlayerProfile)
4. Assistant manager advice (no display panel)
5. Manager H2H (not shown on Other Gaffers)
6. Stadium expansion (no UI)
7. cup_target_round (not shown in board objectives UI)
8. Scout bias in progressive_reveal (function exists, unused)

### Completely missing: 15+ items
1. Height/weight in DB (Python script doesn't write them)
2. DB load skip (height_cm==0 forces full refresh for ALL players)
3. News variety/sources
4. Attribute category icons
5. Sidebar icon replacement
6. Full tactics screen per UI spec §9
7. Narrative memory in live commentary
8. Pundit catchphrases in live commentary
9. Scout report flavour text
10. Staff interaction (weekly meetings)
11. Bid influence on morale
12. Hyperlinks in news/inbox/match reports
13. Out-of-position penalty in match engine
14. Stadium data in DB
15. Reserve team sparse sim

### CRITICAL BUGS:
1. DB load takes 20 min because skip logic fails (height_cm==0 for all players)
2. Height/weight are GUESSED, not real FIFA data
3. README claims features that don't exist in UI
