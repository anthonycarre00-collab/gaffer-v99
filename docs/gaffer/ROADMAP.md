# Gaffer Implementation Roadmap

## Current Status

| Phase | Status | Description |
|-------|--------|-------------|
| 0 | ✅ Done | Repo setup, docs, conflict resolution |
| 0.5 | ⏳ Pending | Real player data scraping pipeline (can parallel with Phase 2) |
| 1 | ✅ Done | Interpretation surface + 19-attribute restructure + personality + stability |
| 2 | 🔄 Next | Personality & relationship engine |
| 3 | ⏳ Pending | Narrative engine & memory system |
| 4 | ⏳ Pending | Match engine integration (SquadPulse, harmony modifier) |
| 5 | ⏳ Pending | Media ecosystem activation |
| 6 | ⏳ Pending | Training overhaul (probabilistic growth, stability guard) |
| 7 | ⏳ Pending | Scouting progressive reveal |
| 8 | ⏳ Pending | Season loop validation |
| 9 | ⏳ Pending | Balance & polish (includes CI/CD workflow updates) |

## Phase 1 — Completed

- 19 Gaffer attributes (Body/Ball/Head/Gloves) replacing 18 FM-style attrs
- PersonalityProfile (Big Five + confidence) with PressureResponse + MediaSensitivity
- StabilityModifier (hidden 0-100, 5-tier Gaffer-voice labels)
- PlayerTrait enum (17 renamed variants)
- Deterministic seed in Game struct
- InterpretationSurfaceService module (4 snapshot methods + 3 tests)
- 4 Tauri commands wired
- Frontend: types, meaningStore, PlayerMeaningCard, i18n (11 locales)
- All Rust crates compile (397 ofm_core lib tests pass)
- All production TypeScript compiles (0 errors)

## Phase 2 — Personality & Relationship Engine (next)

**Goal:** Give players and staff inner lives. The biggest "major surgery" item.

**Tasks:**
1. Big Five inference pipeline for real players (from observable football data)
2. Personality evolution engine (events shift Big Five, capped ±15/season/axis)
3. RelationshipGraph (player↔player edges with strength, volatility, narrative tags)
4. Clique detection algorithm
5. 14 narrative traits assigned (5 Technical Identity + 5 Psychological + 4 Social)
6. Wire personality into match engine hooks (PressureResponse — full integration in Phase 4)
7. Wire personality into training (Conscientiousness affects growth — full integration in Phase 6)
8. Frontend: relationship graph visualization
9. Frontend: personality display in player card
10. Save schema migration for personality + relationships + narrative traits

**Deliverable:** Every player has a personality (with confidence score), every player-pair has a relationship edge, cliques are detectable.

**Estimated effort:** 3-4 weeks

## Phase 0.5 — Real Player Data Pipeline (can run parallel with Phase 2)

**Goal:** Build the data scraping + aggregation pipeline.

**Tasks:**
1. Identify 3+ data sources (FBref, Transfermarkt, Understat, Sofascore)
2. Build scrapers (Rust reqwest + scraper, or Python requests + beautifulsoup)
3. Aggregation pipeline (average attrs across sources, normalize to 0-99)
4. Personality inference (from card rates, assist ratios, captaincy, etc.)
5. Confidence score calculation
6. Rivalry pairs dataset (El Clásico, North London, etc.)
7. Output: JSON datasets consumable by world generator

**Estimated effort:** 2-3 weeks

## Phase 9 — Balance & Polish (includes CI/CD)

**Additional tasks added:**
- Update build-check.yml: `branches: develop` → `branches: main`, `cargo test --workspace` → `cargo test --workspace --lib`
- Update tauri-action.yml: `branches: release` → `branches: main` when ready for auto-builds
- Update nightly workflows for new repo structure
- Verify Rust version pin (currently 1.95.0)

## Resolved Conflicts (from CONFLICTS.md)

1. Real player data: ✅ Use real names + data (future randomisation option)
2. Strict architecture: ⏳ Phased migration (Phase 1 laid foundation)
3. Spreadsheet mode: ✅ Coexist via toggle
4. Rare swearing: ✅ Mild default, Raw occasional
5. Stability Modifier: ✅ 5-tier Gaffer-voice labels, number hidden
6. Performance budget: ⏳ Validate post-Phase 3
7. No meta tactic: ⏳ Validate in Phase 4
8. Voice acting: ✅ None, text-only permanent
9. Rivalries: ✅ Both seeded real + emergent
10. Three fantasies: ✅ Context-rotating emphasis
11. Silence vs fatigue: ⏳ Design in Phase 5
12. AI references bible: ✅ docs/gaffer/ is persistence layer
13. Personality data: ✅ Big Five with inference + confidence scores
14. Attribute differentiation: ✅ 19 attrs in Body/Ball/Head/Gloves, no FM copying
