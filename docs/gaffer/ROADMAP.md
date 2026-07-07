# Gaffer Implementation Roadmap (Revised)

## Critical Path Understanding

The game ships as a **desktop app with a fully populated world database**:
- All real players, teams, leagues, staff, competitions, rivalries pre-built
- Player starts new game → loads bundled DB → plays immediately
- Each season: regens replace retiring players (world continues forever)
- Save files persist the user's career indefinitely

## Current Status (as of Phase 9)

| Phase | Status | Description |
|-------|--------|-------------|
| 0 | ✅ Done | Repo setup, docs, conflict resolution |
| 1 | ✅ Done | 19 attrs + personality + stability + interpretation surface |
| 2 | ✅ Done | RelationshipGraph + narrative traits + personality evolution + frontend display |
| 3 | ✅ Done | Narrative engine & memory system |
| 4 | ✅ Done | Match engine integration (engine migrated, SquadPulse 7-factor formula) |
| 5 | ✅ Done | Media ecosystem (pundits, betting, supplements, match ratings) |
| 6 | ✅ Done | Training overhaul (stability guard, plateau, personality effects, position focus) |
| 7 | ✅ Done | Scouting progressive reveal (3-tier Surface/Detailed/Complete) |
| 8 | ✅ Done | Season loop + regen system |
| 0.5 | ✅ Done | Real player data: 3,376 players from FBref via Hugging Face, 114 teams, 5 leagues |
| 0.5-FE | ✅ Done | InterpretationSurface frontend: SquadPulseCard, MediaPulseCard, PlayerMeaningCard wired |
| 9 | ✅ Done | CI/CD fixes (develop→main), 0 TS errors, meaning.* i18n in 11 locales, CSP, lint script |

## Test Status

- 515 Rust lib tests pass
- 0 TypeScript errors (was 21 pre-existing upstream)
- 0 `unimplemented!()` / `todo!()` / FIXME markers
- All 4 Rust library crates build successfully

## Architecture Audit Findings (post-Phase 7)

### What's healthy

- **Tauri stack is solid**: v2 config correct, 127 commands registered across 23 modules, 11 locales with near-parity, React 19 / Vite 8 / TS 6 / Zustand 5 stack is modern and well-structured
- **CI is comprehensive**: build-check.yml runs frontend tests + tauri-smoke + cargo test --workspace on every PR; tauri-action.yml + nightly pipeline build cross-platform binaries
- **Existing procedural portrait pipeline** at `src-tauri/src/commands/portraits.rs` already renders 384×384 WebP portraits from 11 bundled chroma-key heads with deterministic per-player recipes — this is the foundation for player images, just needs diversity expansion
- **Bundled world DB loads correctly**: gaffer_world.json (474 KB) deserializes into WorldData, players load with personality + narrative_traits + 19 Gaffer attributes, relationships load into Game.relationship_graph

### What's concerning (priority order)

1. **InterpretationSurface is half-wired** — backend works, frontend dead. PlayerMeaningCard.tsx is exported but never rendered. meaningStore has a React anti-pattern (queueMicrotask in render body). No `meaning.*` i18n keys. This is the highest-priority frontend debt.
2. **Real-data pipeline is stubbed** — build_world.py line 554 has TODO; always falls through to sample world. Scraper v3 (1342 lines) works but its output isn't consumed by anything yet.
3. **gaffer_world.json is sample data** — 8 teams / 144 fictional players. Anyone expecting real rosters at New Game will be disappointed.
4. **Tauri main crate can't be compiled in this dev environment** — needs `libwebkit2gtk-4.1-dev` system libs (CI has them; local doesn't). This is an environment limitation, not a project defect, but it means I can't verify Tauri main builds locally between phases.
5. **CSP is null** in tauri.conf.json — fine for dev, smell for stable release
6. **No `lint` script** — Biome configured but not invoked by npm scripts or CI
7. **Dead file** `src-tauri/test_compile.rs` — 2-line leftover probe, should delete
8. **21 pre-existing upstream TS test errors** in PostMatchScreen/PreMatchSetup/SubPanel test files — defer to Phase 9

## Phase 0.5 — Bundled World Database (CRITICAL PATH)

**Goal:** Build the complete, pre-populated world database that ships with the desktop app.

**The database must contain:**
- All real players (name, DOB, nationality, position, 19 Gaffer attributes, contract, wage, market value)
- All real teams (name, league, reputation, finances, stadium, colors, formation)
- All real leagues/competitions (fixtures, standings, rules)
- All real staff (managers, coaches, scouts, physios)
- Pre-computed Big Five personality profiles (with confidence scores)
- Pre-computed relationship edges (based on shared national team, club history, etc.)
- Pre-assigned narrative traits
- Seeded rivalry pairs (El Clásico, North London Derby, etc.)

**Pipeline steps:**
1. Scrape player data from 3+ sources (FBref, Transfermarkt, Understat, Sofascore)
2. Aggregate + normalize attributes to 0-99 Gaffer scale
3. Infer Big Five personality from observable data (card rates, assist ratios, captaincy)
4. Calculate confidence scores
5. Pre-compute relationship edges (shared nationality, shared club history, known friendships/rivalries)
6. Assign narrative traits based on playing style + career history
7. Tag rivalry pairs
8. Package as SQLite database (bundled with Tauri app)

**Deliverable:** A SQLite `.db` file containing the full football world, ready to bundle with the desktop app.

**Estimated effort:** 3-4 weeks (this is the foundation everything else stands on)

## Phase 8 — Season Loop + Regen System

**Goal:** Keep the world alive forever.

**Tasks:**
1. End-of-season processing: retire old players, generate regens
2. Regen generation: new youth players with:
   - Procedural names (from nationality-appropriate name pools)
   - Random attributes (within position-appropriate ranges)
   - Big Five personality assigned directly (confidence = 100)
   - Narrative traits assigned probabilistically
   - Initial relationship edges to teammates
3. Youth academy integration
4. Age-based attribute decline (stability guard from Phase 1)
5. Save file persistence (the world state carries forward)

**Estimated effort:** 2-3 weeks (after Phase 4-6 are done)
