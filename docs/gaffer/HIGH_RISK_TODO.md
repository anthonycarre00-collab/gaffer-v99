# Gaffer — High-Risk / Ambitious TODO

**Created:** 2026-07-12
**Status:** These items remain from the GAFFER_V992_MASTER_PLAN after Sprints 1-7.
**Risk level:** HIGH — each requires focused standalone sprints with careful testing.

---

## A3: Remove Game.league (HIGH RISK — 1-2 days)

**Problem:**
`Game.league` duplicates one entry from `Game.competitions`. Already documented as DEPRECATED in source, but `sync_legacy_league` still runs on every state mutation. This is technical debt that causes confusion + unnecessary work.

**What to do:**
1. Audit every callsite that reads `game.league` (there are many — turn/mod.rs, news.rs, dashboard, etc.)
2. Replace each with `game.competitions[user_competition_index]` or equivalent
3. Delete the `league` field from `Game`
4. Delete `sync_legacy_league()` and `promote_legacy_league()`
5. Update save migration to handle old saves that still have `league`

**Risk:** HIGH — touches dozens of callsites across the codebase. One missed callsite = crash.
**Dependencies:** None (but should be done when no other feature work is in progress)
**Testing:** Full build + 5-season sim to verify nothing breaks

---

## A4: Persist ScoutingKnowledge to SQLite (MEDIUM RISK — 1-2 days)

**Problem:**
`ScoutingKnowledge` currently uses a JSON-blob save path. Adding a proper SQLite table would future-proof against save format migrations and improve query performance.

**What to do:**
1. Design SQLite schema for scouting knowledge (player_id, team_id, knowledge_level, last_updated)
2. Add migration to convert existing JSON blob to SQLite table
3. Update save/load paths to use the new table
4. Update the `get_scouting_knowledge` command to query SQLite directly

**Risk:** MEDIUM — save format migration always carries risk of data loss
**Dependencies:** None
**Testing:** Load old save → verify scouting knowledge intact → save → reload → verify

---

## T4.3: Match Engine 2D View (HIGH RISK — 5-7 days)

**Problem:**
The match is currently text-only. A simple 2D top-down pitch view showing player positions + ball movement would massively improve match engagement.

**What to do:**
1. Build a canvas/SVG renderer component
2. Render a green pitch with markings (center circle, penalty boxes, etc.)
3. Show dots for players (colored by team, numbered by jersey)
4. Animate ball movement between zones
5. Sync with the live match engine's `ball_zone` + `possession` state
6. Show goals (ball in net animation)
7. Optional: player name tooltips on hover

**Risk:** HIGH — new rendering system, performance concerns with 22 animated dots
**Dependencies:** None (engine data already exists — `ball_zone`, `possession`, player positions)
**Testing:** Visual QA — verify smooth animation, no flickering, correct positioning

**Design notes:**
- Don't need FM-quality — just enough to give visual context
- Could use a simple CSS grid approach instead of canvas for simpler implementation
- Ball position should update every minute (not every second — matches the engine's tick rate)

---

## T4.6: International Management (HIGH RISK — 4-5 days)

**Problem:**
After establishing yourself at club level, you should be able to get offered international jobs — World Cup cycles, qualifying campaigns, tournament squads.

**What to do:**
1. Add international job offer system (based on club reputation + manager nationality)
2. International duty flow: pick squad from eligible players, play qualifiers + tournaments
3. World Cup cycle every 4 years (code already exists in `world_cup.rs`)
4. International matches use simplified engine (less time pressure)
5. Manage both club + international team simultaneously
6. International performance affects club reputation

**Risk:** HIGH — entirely new management layer, complex scheduling (international windows interrupt club season)
**Dependencies:** None (national team code exists, just needs the management layer)
**Testing:** Full World Cup cycle (4 seasons) — verify qualifiers, tournament, squad selection

**Design notes:**
- International matches should be optional (user can delegate to AI)
- Squad selection: filter by nationality, pick best 23
- International windows already exist in the calendar (friendlies + qualifiers)

---

## Testing Checklist (for each item)

Before marking any item as complete:
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] All frontend tests pass (`npx vitest run`)
- [ ] Rust compiles (user will verify via `run-and-build.bat`)
- [ ] 10-season sim doesn't break
- [ ] No raw numbers leak to UI
- [ ] Save file still loads (if domain types changed)
- [ ] Commit + push to `gaffer-v99/main`

---

*This document tracks the remaining high-risk items after V99.4 Sprints 1-7. All other items from the GAFFER_V992_MASTER_PLAN are complete.*
