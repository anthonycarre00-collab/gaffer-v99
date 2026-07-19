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
