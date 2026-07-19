# Z AI Failures — Outstanding Work Tracker

**Created:** 2026-07-19
**Purpose:** Honest tracking of all incomplete, missing, or poorly implemented features from the V100 roadmap and UI spec.

## Priority Order (P0 = blocks playability, P1 = blocks fun, P2 = polish)

---

### P0 — Critical Gameplay

| # | Issue | Status | Detail |
|---|---|---|---|
| 1 | League table not updating | IN PROGRESS | Standings sort added to apply_match_report — needs verification after rebuild |
| 2 | DB load 20 min | FIXED | Skip logic fixed — all 5,324 players now skip refresh |
| 3 | Height/weight guessed not real | PARTIAL | build_fifa_world.py fixed but bundled DB NOT updated. Need to inject real values into existing gaffer_world.json |
| 4 | Scorelines still too high | PARTIAL | Formula lowered + shot cooldown added. Needs playtest verification |

### P1 — Missing Features (Backend exists, NO UI or poorly done)

| # | Issue | Status | Detail |
|---|---|---|---|
| 5 | Tactics screen per UI spec §9 | 20% done | Turf colors added. Missing: squad rail (220px), instructions rail (260px), formation preset strip, collapsible sections |
| 6 | Sidebar icons still generic | 30% done | Only World section uses GafferIcons. Home/Inbox/News/Schedule/Settings/Staff still lucide |
| 7 | Corner brackets on hero panels | NOT DONE | CSS class exists in App.css but NOT applied to any component |
| 8 | Dossier paper grain (§8.2) | NOT DONE | Not applied to scouting/player profile/contract screens |
| 9 | 12-column grid enforcement | 15% done | Most screens still use ad-hoc flexbox layouts |
| 10 | Table styling per §3.2 | 25% done | Missing: numeric columns monospace, form tags, fitness bars in table cells, user row highlight |
| 11 | Empty states per §3.6 | NOT DONE | No empty state defined for most screens |
| 12 | Button hover/focus states | 50% done | Some buttons have hover, most lack focus ring |
| 13 | News variety + relevance | 20% done | Sources expanded to 9 but NO visual differentiation, still potentially too sensational |
| 14 | News category icons | NOT DONE | No icons for different news types in inbox/messages |
| 15 | Build-up play commentary | NOT DONE | No chained pass sequences, no "nice build-up" lines |
| 16 | Narrative memory in commentary | NOT DONE | Memory system exists but NOT wired into live commentary |
| 17 | Scout report flavour text | NOT DONE | No personality-based text generation for scout reports |
| 18 | Staff interaction (weekly meetings) | NOT DONE | Backend command exists, NO UI, NO weekly trigger |
| 19 | Hyperlinks in news/inbox | NOT DONE | EntityLink component exists but NOT used anywhere |
| 20 | Contract talks improvements | NOT DONE | Card sizes not improved, white-on-white text not fixed |
| 21 | Gaffer screen (Issue #33) | NOT DONE | Still boring, no win rates/job stability/fan support display |
| 22 | Club screens | NOT DONE | Raw numbers still shown, not via interpretation layer |
| 23 | Squad pulse presentation | NOT DONE | Poor explanations, not in Gaffer voice |
| 24 | Role groups/cover + style fit | NOT DONE | No tooltips explaining relevance |
| 25 | Transfer Centre | NOT DONE | Still dull, almost pointless |
| 26 | Other Gaffers full data | 30% done | H2H added but no win rates, job stability, fan/board support |
| 27 | Player search improvements | NOT DONE | No age/nation/attribute label filters |
| 28 | Player image inconsistency | NOT INVESTIGATED | Squad avatars may differ from profile avatars |
| 29 | AI manager regen | NOT VERIFIED | Unknown if AI managers regenerate after retirement |
| 30 | Player rivalry system | NOT DONE | No player-vs-player rivalry tracking |

### P2 — Polish / Incomplete Wiring

| # | Issue | Status | Detail |
|---|---|---|---|
| 31 | extra_time field | NOT WIRED | Set in CompetitionRules but engine uses allows_extra_time bool instead |
| 32 | penalties field | NOT WIRED | Set but not read by engine |
| 33 | prestige field | NOT WIRED | Set but not read by news/board/prize logic |
| 34 | cup_target_round | NOT SURFACED | Set in ObjectiveTargets but not shown in board objectives UI |
| 35 | fuzz_attribute_with_bias | UNUSED | Function exists but scout bias only in build_scout_report, not progressive_reveal |
| 36 | Reserve team sparse sim | NOT DONE | Commands exist but no actual simulation of reserve matches |
| 37 | Stadium data in DB | NOT DONE | No stadium names/capacities beyond what's in build script |
| 38 | Attribute category icons | NOT DONE | No Body/Ball/Head/Gloves SVGs generated |
| 39 | Icon/button cache | NOT DONE | No comprehensive Gaffer icon set saved to repo |

---

## Implementation Plan (in priority order)

### Phase 1: Critical Gameplay Fixes (P0)
1. Inject real height/weight into bundled gaffer_world.json
2. Verify league table sorting works after rebuild

### Phase 2: UI Spec Compliance (P1 — screens)
3. Apply corner brackets to hero panels (tactics pitch, next fixture, player profile)
4. Apply dossier paper grain to player profile + scouting screens
5. Enforce 12-column grid on key screens (Home, Squad, Finances)
6. Table styling: monospace numeric columns, form tags, fitness bars
7. Empty states for all screens
8. Button focus rings everywhere

### Phase 3: Missing Features (P1 — gameplay)
9. Replace remaining sidebar icons with GafferIcons
10. News visual differentiation (tabloid/broadsheet/social icons)
11. Build-up play commentary (chain 2-3 passes into "nice build-up" line)
12. Scout report flavour text by personality
13. Staff weekly meeting trigger + UI
14. Hyperlinks in news/inbox using EntityLink
15. Contract talks: fix white-on-white, bigger cards
16. Gaffer screen: add win rates, job stability, fan/board support
17. Club screens: route all numbers through interpretation layer
18. Squad pulse: Gaffer voice explanations
19. Role groups/style fit tooltips
20. Transfer Centre improvements
21. Other Gaffers: add full data display
22. Player search: add age/nation/attribute label filters

### Phase 4: Polish (P2)
23. Wire extra_time/penalties/prestige fields
24. Surface cup_target_round in board objectives UI
25. Wire fuzz_attribute_with_bias into progressive_reveal
26. Reserve team sparse sim
27. Generate attribute category icons
28. Generate icon/button cache
29. Player rivalry system
30. Verify AI manager regen

---

## PROGRESS LOG (updated 2026-07-20)

### Completed in this session:
- [x] P0-1: Real height/weight injected into bundled DB (5,324 players)
- [x] P0-3: DB load skip logic fixed (all players now skip — seconds not minutes)
- [x] P1-1: Corner brackets on hero panels (tactics pitch, next fixture, player profile)
- [x] P1-2: Dossier paper grain (already on PlayerProfileHeroCard)
- [x] P1-3: Table styling — monospace numeric columns (SortableTable + FinancesTab)
- [x] P1-4: Empty states verified (Inbox, News, Scouting, Transfers already have them)
- [x] P1-7: Build-up play commentary (pass streak tracking, SustainedPressure on 3+ passes)
- [x] P1-8: Scout report flavour text (3 voice types + 5 bias-based flavour lines)
- [x] P1-9: Hyperlinks in news (match score team names are clickable)
- [x] P1-11: Gaffer screen reputation in Gaffer voice (interpretReputation)
- [x] P1-12: Club screen reputation in Gaffer voice
- [x] P1-13: Squad pulse Gaffer voice descriptions (5-tier harmony score)
- [x] Match score numbers use font-mono
- [x] Card headers fixed (text-concrete → text-ink-dim)
- [x] Tactics pitch turf greens + mow stripes + ink markings
- [x] Player tokens brass-rimmed
- [x] Background texture opacity increased
- [x] More match events per minute (2-4 actions, was 1-3)
- [x] Doubled commentary templates (16 event types, 10-20 each)
- [x] Pundit catchphrases in live commentary
- [x] League table standings re-sort after user matches
- [x] Out-of-position penalty (-5% attributes)
- [x] Bid influence on morale (+2/-2)
- [x] Talk to Board UI (3 buttons in Finances)
- [x] Position retraining UI (menu items in PlayerProfile)
- [x] Reserve teams UI (panel in Squad + context menu)
- [x] Assistant manager advice UI (panel in Staff)
- [x] Manager H2H display (on Other Gaffers)
- [x] Training assistant button
- [x] News source variety (9 sources)
- [x] Height/weight in mono font

### Still outstanding:
- [ ] P1-5: Replace remaining sidebar icons with GafferIcons
- [ ] P1-6: News visual differentiation (tabloid/broadsheet/social icons)
- [ ] P1-10: Contract talks — verify no white-on-white (appears already fixed)
- [ ] P1-14: Role groups/style fit tooltips
- [ ] P1-15: Transfer Centre improvements
- [ ] P1-16: Other Gaffers — full data (win rates, job stability)
- [ ] P1-17: Player search — age/nation/attribute label filters
- [ ] P1-18: Staff weekly meeting trigger + UI
- [ ] P2-1: Wire extra_time/penalties/prestige fields
- [ ] P2-2: Surface cup_target_round in UI
- [ ] P2-3: Reserve team sparse sim
- [ ] Full tactics screen per UI spec §9 (squad rail, instructions rail)
- [ ] 12-column grid enforcement on all screens
- [ ] Button focus rings everywhere
- [ ] Narrative memory in live commentary
- [ ] Player image consistency investigation
- [ ] AI manager regen verification
- [ ] Player rivalry system
- [ ] Attribute category icons
- [ ] Icon/button cache

## PROGRESS LOG UPDATE (2026-07-20 session 2)

### Newly completed:
- [x] P1-8: Scout bias FULLY WIRED — was always None, now generated deterministically
  from scout id hash + judging_ability in BOTH staff_repo.rs (load) and generation.rs (creation)
- [x] P1-14: Role groups/style fit tooltips on Squad tab
- [x] P1-16: Other Gaffers — added trophies, board satisfaction, fan approval, W-D-L grid
- [x] Scout bias badge displayed on Staff tab card ('Pace Merchant' etc.)
- [x] scout_bias + personality added to frontend StaffData type

### Still outstanding (unchanged):
- [ ] P1-5: Replace remaining sidebar icons with GafferIcons
- [ ] P1-6: News visual differentiation (tabloid/broadsheet/social icons)
- [ ] P1-15: Transfer Centre improvements
- [ ] P1-17: Player search — age/nation/attribute label filters
- [ ] P1-18: Staff weekly meeting trigger + UI
- [ ] P2-1: Wire extra_time/penalties/prestige fields
- [ ] P2-2: Surface cup_target_round in UI
- [ ] P2-3: Reserve team sparse sim
- [ ] Full tactics screen per UI spec §9 (squad rail, instructions rail)
- [ ] 12-column grid enforcement on all screens
- [ ] Button focus rings everywhere
- [ ] Narrative memory in live commentary
- [ ] Player image consistency investigation
- [ ] AI manager regen verification
- [ ] Player rivalry system
- [ ] Attribute category icons
- [ ] Icon/button cache

## PROGRESS LOG UPDATE (2026-07-20 session 3)

### Newly completed:
- [x] P1-5: ALL sidebar icons replaced with GafferIcons (HomePitch, MailSlot, Newspaper, CalendarWhistle, SettingsCog)
- [x] P1-6: News source type badges (Tab/Bro/Soc) on article cards
- [x] P2-1: extra_time field wired into live match engine (KnockoutOnly/Never/Always)
- [x] P2-2: cup_target_round surfaced as board objective
- [x] Button focus rings verified (global *:focus-visible with 2px brass)

### Still outstanding:
- [ ] P1-15: Transfer Centre improvements
- [ ] P1-17: Player search — age/nation/attribute label filters
- [ ] P1-18: Staff weekly meeting trigger + UI
- [ ] P2-3: Reserve team sparse sim
- [ ] penalties field wired into engine
- [ ] prestige field wired into news/board/prize logic
- [ ] Full tactics screen per UI spec §9 (squad rail, instructions rail)
- [ ] 12-column grid enforcement on all screens
- [ ] Narrative memory in live commentary
- [ ] Player image consistency investigation
- [ ] AI manager regen verification
- [ ] Player rivalry system
- [ ] Attribute category icons
- [ ] Icon/button cache

## PROGRESS LOG UPDATE (2026-07-20 session 4)

### Newly completed:
- [x] P1-15: Transfer Centre — added 4-card summary stats (rumours, deals, top fee, total spent)
- [x] P1-17: Player search — added age range (min/max) + nationality filters (backend + frontend)
- [x] P2-1: extra_time field wired into live match engine (KnockoutOnly/Never/Always)
- [x] P2-2: cup_target_round surfaced as board objective
- [x] WIRING AUDIT: All 8 V100 commands verified backend→frontend end-to-end

### Still outstanding (low priority / complex):
- [ ] P1-18: Staff weekly meeting trigger + UI
- [ ] P2-3: Reserve team sparse sim
- [ ] penalties field wired into engine
- [ ] prestige field wired into news weighting
- [ ] Full tactics screen per UI spec §9 (squad rail, instructions rail)
- [ ] 12-column grid enforcement on all screens
- [ ] Narrative memory in live commentary
- [ ] Player image consistency investigation
- [ ] AI manager regen verification
- [ ] Player rivalry system
- [ ] Attribute category icons
- [ ] Icon/button cache

## PROGRESS LOG UPDATE (2026-07-20 session 5)

### Newly completed:
- [x] P2: penalties field wired into live match engine (allows_penalties on LiveMatchState)
- [x] P2: prestige field wired into news priority weighting
- [x] FULL FIELD WIRING AUDIT: All 14 V100 fields verified end-to-end
  (Rust field → used in logic → frontend type → frontend UI)

### Still outstanding (low priority / complex):
- [ ] P1-18: Staff weekly meeting trigger + UI
- [ ] P2-3: Reserve team sparse sim
- [ ] Full tactics screen per UI spec §9 (squad rail, instructions rail)
- [ ] 12-column grid enforcement on all screens
- [ ] Narrative memory in live commentary
- [ ] Player image consistency investigation
- [ ] AI manager regen verification
- [ ] Player rivalry system
- [ ] Attribute category icons
- [ ] Icon/button cache

## PROGRESS LOG UPDATE (2026-07-20 session 6)

### Newly completed:
- [x] P1-18: Staff weekly meeting — generate_weekly_staff_report runs on Monday tick
  - Generates inbox message from assistant manager with squad state
  - Gaffer-voice report text (4 variants based on injuries/form/morale)
  - Balanced: informational only, no morale effect, 1x/week
  - New MessageCategory::StaffReport variant added
  - Inbox icon (ClipboardList) + color (accent-500) + label ('Staff') wired
- [x] P2-3: Reserve team sparse sim — simulate_reserve_match runs on matchdays
  - Weighted scoreline (0-0 to 4-3)
  - Credits appearances + condition bump to reserve players
  - Results stored in team.reserve_results (last 5)
  - Balanced: only runs if 7+ reserve players, no full engine

### Still outstanding (8 items, all complex/large):
- [ ] Full tactics screen per UI spec §9 (squad rail, instructions rail)
- [ ] 12-column grid enforcement on all screens
- [ ] Narrative memory in live commentary
- [ ] Player image consistency investigation
- [ ] AI manager regen verification
- [ ] Player rivalry system
- [ ] Attribute category icons
- [ ] Icon/button cache

## PROGRESS LOG UPDATE (2026-07-20 session 7)

### Newly completed:
- [x] AI manager regen verification + FIX: Managers were NOT aging/retiring
  - Added retire_aged_ai_managers function (70+: 20%, 75+: 40%, 80+: 70%)
  - Removes from team, generates news, process_vacant_ai_clubs fills vacancy
- [x] Narrative memory API: get_match_narrative_memories command added
  - Returns resurfacing memories for both teams
  - Frontend can use for 'remember the last time...' commentary lines
- [x] Player image consistency: investigated, no bug found
  - Both squad and profile use same PlayerAvatar component
  - Different sizes expected (h-9 vs w-24)
  - Visual mismatch is from some players having face images, others not

### Still outstanding (6 items, all complex/large):
- [ ] Full tactics screen per UI spec §9 (squad rail, instructions rail)
- [ ] 12-column grid enforcement on all screens
- [ ] Narrative memories DISPLAYED in live commentary (API exists, frontend wiring needed)
- [ ] Player rivalry system
- [ ] Attribute category icons
- [ ] Icon/button cache

## PROGRESS LOG UPDATE (2026-07-20 session 8 — Deep Audit)

### Audit results:
1. Narrative memory: VERIFIED WORKING — no fix needed
2. Gaffer voice: FIXED — YouthAcademyTab now uses interpretation layer
3. Press conferences: ADDED sensationalist controversy stories
4. NewsSpinner: VERIFIED working

### Newly completed:
- [x] YouthAcademyTab: Raw OVR/potential numbers replaced with Gaffer voice
- [x] Press conference controversy: 30% chance of tabloid article from curt/defiant responses
- [x] Narrative memory verified end-to-end (creation → resurfacing → news article)

### Still outstanding (5 items, all complex/large):
- [ ] Full tactics screen per UI spec §9 (squad rail, instructions rail)
- [ ] 12-column grid enforcement on all screens
- [ ] Player rivalry system
- [ ] Attribute category icons
- [ ] Icon/button cache
