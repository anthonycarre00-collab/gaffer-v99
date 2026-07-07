# Gaffer Implementation Roadmap (Revised)

## Critical Path Understanding

The game ships as a **desktop app with a fully populated world database**:
- All real players, teams, leagues, staff, competitions, rivalries pre-built
- Player starts new game → loads bundled DB → plays immediately
- Each season: regens replace retiring players (world continues forever)
- Save files persist the user's career indefinitely

## Current Status

| Phase | Status | Description |
|-------|--------|-------------|
| 0 | ✅ Done | Repo setup, docs, conflict resolution |
| 1 | ✅ Done | 19 attrs + personality + stability + interpretation surface |
| 2.1-2.2 | ✅ Done | RelationshipGraph + narrative traits + wiring |
| **0.5** | **🔄 CRITICAL PATH** | **Build the bundled world database (real players + relationships + personalities)** |
| 2.3+ | ⏳ After 0.5 | Seed relationships/personalities from DB, personality evolution, frontend display |
| 3 | ⏳ | Narrative engine & memory system |
| 4 | ⏳ | Match engine integration |
| 5 | ⏳ | Media ecosystem |
| 6 | ⏳ | Training overhaul |
| 7 | ⏳ | Scouting progressive reveal |
| 8 | ⏳ | Season loop + regen system |
| 9 | ⏳ | Balance & polish + CI/CD |

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
