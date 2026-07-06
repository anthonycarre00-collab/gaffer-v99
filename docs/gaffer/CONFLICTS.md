# Gaffer Internal Conflicts & Resolutions

## Status Summary

| # | Conflict | Status |
|---|----------|--------|
| 1 | Real-World Player Data | ✅ RESOLVED — use real data, future randomisation option |
| 2 | Strict Architecture | ⏳ Pending (phased migration — Phase 1 laid foundation) |
| 3 | Spreadsheet Mode | ✅ RESOLVED — coexist via toggle |
| 4 | Rare Swearing | ✅ RESOLVED — Mild default, Raw occasional |
| 5 | Stability Modifier | ✅ RESOLVED — 5-tier labels, number hidden |
| 6 | Performance Budget | ⏳ Pending (validate post-Phase 3) |
| 7 | No Meta Tactic | ⏳ Pending (validate in Phase 4) |
| 8 | Voice Acting | ✅ RESOLVED — no voice acting, text-only permanent |
| 9 | Rivalries | ✅ RESOLVED — both seeded and emergent |
| 10 | Three Fantasies | ✅ RESOLVED — context-rotating emphasis |
| 11 | Silence vs Fatigue | ⏳ Pending (design in Phase 5) |
| 12 | AI References Bible | ✅ RESOLVED — docs/gaffer/ is the persistence layer |
| 13 | Personality Data | ✅ RESOLVED — Big Five with inference + confidence scores |
| 14 | Attribute Differentiation | ✅ RESOLVED — 19 attrs, no FM copying |

## Conflict 1 — Real-World Player Data
**✅ RESOLVED:** Use real player names + real data aggregated from online sources.
Implementation: scrape from FBref, Transfermarkt, Understat, Sofascore. Average and normalise to 0-99.
Future-proofing: "Randomise names" toggle + "Real Players DLC" pack as legal safety valves.

## Conflict 4 — Rare Swearing
**✅ RESOLVED:** Default to Mild, occasionally Raw when it does appear.
Setting: `Settings.co_commentator_language: Strict | Mild | Raw` (default Mild). Still <1% frequency.

## Conflict 5 — Stability Modifier
**✅ RESOLVED:** Hidden number, 5-tier Gaffer-voice label:
- 0-20: Roll of the Dice
- 21-40: Runs Hot and Cold
- 41-60: Steady Hand
- 61-80: Trusted Lieutenant
- 81-100: Mr. Reliable

## Conflict 8 — Voice Acting
**✅ RESOLVED:** No voice acting whatsoever, permanently. Text-only commentary with typographic differentiation.

## Conflict 9 — Rivalries
**✅ RESOLVED:** Both — seed real-world rivalries at world creation AND allow emergent rivalries during play.

## Conflict 13 — Personality Data Availability
**✅ RESOLVED:** Big Five with inference heuristics + confidence scores (0-100).
- Openness: dribble attempts, through-balls, position
- Conscientiousness: card rate, career longevity, injury record
- Extraversion: captaincy, interview frequency, social media
- Agreeableness: assist-to-shot ratio, contract loyalty
- Neuroticism: red cards, public outbursts, form swings
Confidence score controls behaviour weight. Personality evolves based on in-game events (±15/season/axis).

## Conflict 14 — Attribute Differentiation from FM
**✅ RESOLVED:** 19 attrs in Body/Ball/Head/Gloves groupings. No hidden attributes. No copying FM.
