# Gaffer V99 — Major Overhaul Plan

**Status:** PLANNING — awaiting user decision on fork/clone strategy
**Date:** 2026-07-10
**Based on:** User feedback document "Gaffer V99 major overhaul" (28 items) + two comprehensive codebase audits

---

## Executive Summary

The 28 items in the user feedback doc cluster into **6 phases** of work. Two parallel audits (match engine + scouting/OVR/data) uncovered **12 critical bugs** that explain most of the user's reported pain points. The scope is too large for one session and touches every major system in the game — a fork is strongly recommended.

**Recommendation:** Fork `main` → `v99-overhaul` branch. Keep `main` as the stable v98 release line. Cherry-pick bug fixes back to `main` as they're ready.

---

## Critical Bugs Discovered in Audit (not in user's list, but explain their symptoms)

| # | Bug | File | User symptom |
|---|---|---|---|
| 1 | Commentary silences 12 of 27 event types | `src/components/match/commentary.ts:14-32` | "no match events registered beside goals so commentary is never triggered" |
| 2 | Scout report inbox message leaks true attributes | `src-tauri/crates/ofm_core/src/scouting.rs:340-358` | "unclear if scouting is correctly wired" |
| 3 | `ScoutingKnowledge` not persisted to DB | `src-tauri/crates/db/src/repositories/scouting_repo.rs` | Scouting progress could vanish on save format change |
| 4 | Scoutable player search sorts by raw OVR | `src/components/scouting/ScoutingTab.model.ts:47` | Leaks relative ability of unscouted players |
| 5 | OVR shown as raw number in 17 component files | (see audit) | "still show an overall or ovr score" |
| 6 | No `interpretOvr()` function exists | n/a | Gaffer constitution not implemented for OVR |
| 7 | Competition participants broken (La Liga=3 teams, PL=4) | `gaffer_world.json` | League scheduling broken |
| 8 | 0 staff in bundled DB | `gaffer_world.json` | Game generates fictional staff on new game |
| 9 | 0 cups, 0 national teams, 0 lower divisions | `gaffer_world.json` | "initial db must have thousands of real world players, staff, clubs, leagues, cups" |
| 10 | Wikidata enrichment never ran on production DB | `gaffer_world.json` | All 3,376 players have `height_cm: null, weight_kg: null` |
| 11 | OVR distribution wildly off (mean 54.3, should be ~70+) | `build_world.py:47-62` | Players look worse than they should |
| 12 | `shot_stopping` + `defending` double-counted in engine | `resolution.rs:330,195-198` | GK and defender ratings skewed |

Plus 4 dead-weight attributes plumbed but never read by the engine: `leadership`, `burst`, `commanding`, `playing_out`.

---

## Phase Plan

### PHASE 1 — Critical Bug Fixes + Interpretation Layer (1 session)

**Goal:** Fix the bugs that are causing the user's reported pain. Ship a working v99-alpha.

**Work items:**

1. **Commentary expansion** (fixes bug #1, user item #10)
   - Add 12 missing event types to `COMMENTARY_EVENTS` set in `commentary.ts`
   - Add i18n lines for: Tackle, Interception, PassCompleted, PassIntercepted, Dribble, DribbleTackled, Cross, Clearance, Corner, FreeKick, GoalKick, ShootoutGoal/Miss
   - Add punditry cases for the same in `punditry.ts`
   - Each event gets 5-8 commentary variations + 2-3 pundit reactions

2. **OVR interpretation layer** (fixes bugs #5, #6, user item #9)
   - Create `src/lib/ovrInterpretation.ts` — analogous to `attributeInterpretation.ts`
   - 7-tier ladder in Gaffer voice: "Different Class" / "Proper Player" / "Solid Pro" / "Squad Player" / "Limited" / "Off the Pace" / "Out of His Depth"
   - Add `interpretOvr(ovr, position)` — position-dependent (a 70 GK is described differently than a 70 ST)
   - Replace `{ovr}` in all 17 component files with `interpretOvr()` short label
   - Add visibility gate: rival players show "?" unless scouted to Surface tier

3. **Scouting leak fixes** (fixes bugs #2, #3, #4, user items #4, #27)
   - Fix `build_scout_report` to use fuzzed values from `ScoutingKnowledge` instead of true attributes
   - Add `scouting_knowledge` SQLite table + repo functions for proper persistence
   - Stop sorting scoutable players by raw OVR — sort by name or reputation band
   - Wire `scouting_knowledge.reveal_tier` into `PlayerProfileAttributesCard`:
     - Own club → full attributes + descriptions
     - Surface tier → "??" for most attrs, OVR band only
     - Detailed tier → fuzzed values (±5) for key attrs, "??" for rest
     - Complete tier → fuzzed values (±2) for all attrs
   - Implement auto-reveal rules:
     - High-reputation players (rep ≥ 800) → Surface tier automatically
     - Same-league players → Detailed tier automatically
     - Everyone else → must be scouted

4. **Engine double-count fixes** (fixes bug #12)
   - Fix `shot_stopping` double-count in `resolution.rs:330` and `zone_resolution.rs:324`
   - Fix `defending` double-count in `resolution.rs:195-198` and `zone_resolution.rs:173-176`

5. **Position-dependent attribute descriptions** (user item #3)
   - Refactor `attributeInterpretation.ts` to accept a `position` parameter
   - GKs never described as "poor finishers" — instead "not their job" or omitted
   - Fix Pace vs Burst contradiction — make Pace = top speed, Burst = acceleration, with clear distinct descriptions
   - Add 3-4 more variations per tier per attribute (target: 10 variations per tier)

**Estimated effort:** 1 full session, ~2,000 lines of changes
**Risk:** Low — mostly additive, no architecture changes
**Tests:** Add tests for OVR interpretation, scouting visibility gates, commentary on all event types

---

### PHASE 2 — Match Engine Expansion (1 session)

**Goal:** Wire dead-weight attributes into the engine, add missing event types, unify the two parallel simulators.

**Work items:**

1. **Wire dead-weight attributes** (user items #5, #18)
   - `leadership` → affects team composure under pressure (captain bonus when on pitch)
   - `burst` → affects first-step acceleration in 1v1 situations (separate from `pace` top speed)
   - `commanding` → affects GK claim rate on crosses + defender aerial organization
   - `playing_out` → affects GK distribution success + sweeper-keeper actions

2. **Add missing event types** (user item #10, #18)
   - `Header` event — emitted on aerial duels (currently inline)
   - `Offside` event — simulate offsides on through-balls
   - `ThrowIn` event — ball recycling after going out
   - `GkDistribution` event — keeper throws/rolls to start attacks

3. **Unify resolution modules** (architecture cleanup)
   - `engine/src/engine/resolution.rs` (simple path) and `engine/src/live_match/zone_resolution.rs` (live path) duplicate logic with subtle drift
   - Extract shared resolution into a single module both paths call
   - Eliminate drift (e.g., live path attaches EventDetail to fouls/shots; simple path does not)

4. **Middle-tier simulator** (user item #18 — "background matches use simplified but realistic")
   - New `engine::simulate_sparse()` function — produces scoreline + sparse events (scorers, assists, cards) without 90 minute iterations
   - Based on existing `simulate_scoreline` + `club_strength` + small event-sampling pass
   - Use for in-scope AI vs AI matches when there are 10+ fixtures on a matchday
   - User matches always use full `LiveMatchState`

5. **Backport fatigue model**
   - `tactics_pressing_fatigue` currently only in live path
   - Backport to `engine::simulate` so CPU-only matches feel same fatigue as user matches
   - Fix user item #8 ("Fatigue doesn't appear to be balanced very well")

6. **Verify tactical instruction wiring** (user item #5 — "unclear if all tactical selections have an affect")
   - All 9 tactical dials ARE wired (audit confirmed) — but add UI indicators showing which dials affect what
   - Add a "Tactical Impact" panel showing expected effects of current settings

**Estimated effort:** 1 full session, ~3,000 lines of Rust changes
**Risk:** Medium — engine changes need careful testing to avoid breaking existing match outcomes
**Tests:** Add engine tests for new attributes, new events, sparse simulator

---

### PHASE 3 — UI Softening + Tactics Reimagining (1 session)

**Goal:** Address "too many straight lines and edges", reimagine tactics screen with sub-tabs and drag-drop.

**Work items:**

1. **UI softening** (user item #2)
   - Audit `tailwind.config` for border-radius values
   - Replace `rounded` (4px) with `rounded-lg` (8px) on cards, modals, panels
   - Add subtle shadows (`shadow-sm` → `shadow-md`) on interactive elements
   - Add gradient overlays on cards (top accent bar already exists, extend to full card)
   - Soften button corners, add hover lift effect
   - Add subtle transitions (`transition-all duration-200`) on interactive elements

2. **Tactics reimagining** (user item #5)
   - Split tactics into sub-tabs:
     - **Formation** — pitch view with drag-drop player positioning
     - **Selection** — sortable player list with filters
     - **Style** — tactical dials (width, tempo, pressing, etc.)
     - **Set Pieces** — corner/free-kick/penalty taker assignment
     - **Saved Views** — dropdown of pre-saved tactical setups
   - Implement drag-and-drop for player positioning (HTML5 drag API, already used in squad)
   - Add "Quick Views" dropdown — switch between stats displays (goals, assists, form, fatigue, etc.)
   - Add "Tactical Impact" preview panel — shows expected effects before applying

3. **Button feedback** (user item #6)
   - Add toast notifications for button actions (save, transfer bid, contract offer, etc.)
   - Add loading spinners on async buttons
   - Add success/failure flash on action completion
   - Standardize button disabled states

4. **Tooltips** (user item #20)
   - Add Gaffer-voice tooltips to all interactive elements
   - Use existing `title` attribute + custom tooltip component
   - Cover: tactical dials, attribute descriptions, action buttons, table headers

**Estimated effort:** 1 full session, ~4,000 lines of TSX/CSS changes
**Risk:** Low — UI changes are isolated, easy to revert
**Tests:** Visual regression only — existing tests should still pass

---

### PHASE 4 — Real World Data Expansion (1-2 sessions, needs subagents with internet)

**Goal:** Populate the DB with thousands of real players, staff, clubs, leagues, cups. **Non-negotiable per user.**

**Work items:**

1. **Fix competition participants** (fixes bug #7)
   - La Liga should have 20 teams, PL 20, Serie A 20, Bundesliga 18, Ligue 1 18
   - Fix `build_world.py` to properly populate `participants` array
   - This is a blocker for league scheduling

2. **Run Wikidata + Transfermarkt enrichment** (fixes bug #10)
   - Execute `scraper.py --enrich wikidata transfermarkt` on the bundled DB
   - Populate `height_cm`, `weight_kg` for all 3,376 players
   - Populate real market values from Transfermarkt
   - Populate real contract end dates and wages

3. **Add staff to DB** (fixes bug #8)
   - Scrape real managers (Pep, Klopp, Ange, etc.) for all 114 clubs
   - Scrape assistant managers, coaches, scouts, physios
   - Add to `gaffer_world.json` with proper attributes

4. **Expand leagues** (user item #11)
   - Add: Eredivisie, Primeira Liga, Scottish Premiership, Championship, Süper Lig, Pro League (Belgium), Super League (Greece), MLS, Série A (Brazil), Primera División (Argentina), Liga MX, Saudi Pro League, J1 League
   - Target: 30+ leagues, 500+ clubs, 15,000+ players

5. **Add lower divisions** (user item #11)
   - Championship, Serie B, Segunda División, 2. Bundesliga, Ligue 2
   - Wire promotion/relegation between tiers

6. **Add cup competitions** (user item #11)
   - Domestic cups: FA Cup, Copa del Rey, Coppa Italia, DFB-Pokal, Coupe de France
   - Continental cups: UCL, UEL, UECL, Copa Libertadores
   - Wire knockout bracket logic (already exists in code)

7. **Add national teams** (user item #11)
   - Populate rosters for top 32 national teams
   - Wire World Cup cycle (code exists in `world_cup.rs`)

8. **Re-tune OVR distribution** (fixes bug #11)
   - Fix `normalize_to_99` / `normalize_percentile` in `build_world.py`
   - Elite players should be 80+, not capped at 54 mean
   - Use real FIFA ratings or FBref percentile-based mapping

9. **Player images** (user item #14)
   - Investigate bundling real player photos (licensing concern — see `PLAYER_IMAGES_STRATEGY.md`)
   - If licensing blocks real photos: improve procedural portraits
   - Tune portrait generator for age (young players look young, veterans look older)
   - Tune for position-relevant heights (CBs tall, wingers shorter)

10. **Investigate "Nabil Aberdin" phantom** (data quality)
    - Audit `build_world.py` for fallback paths that generate fake names
    - Either fix scraping or remove synthetic test data

**Estimated effort:** 2 full sessions, ~1,000 lines of Python pipeline changes + large data files
**Risk:** High — data quality issues, licensing concerns, large file sizes
**Dependencies:** Subagents with internet access for scraping; large file storage for DB
**Tests:** Data validation scripts — assert league team counts, player count > 10k, no null fields

---

### PHASE 5 — Content Depth (1 session)

**Goal:** Add career stories, player partnerships, traits, roles — all in Gaffer voice.

**Work items:**

1. **Player career highlights** (user item #13)
   - Save career events: international caps, long service milestones, important goals, clean sheets
   - Build career story generator — procedurally varied narratives
   - View on player profile "Career" tab
   - Position-dependent highlights (GKs get clean sheet milestones, strikers get goal milestones)

2. **Player partnerships** (user item #17)
   - Track player combinations over time (passing pairs, goal partnerships)
   - When partnership strength exceeds threshold, apply slight match engine boost
   - Generate news story when partnership forms ("The new Neville-Beckham")
   - View on player profile "Partnerships" section

3. **Player traits + nicknames** (user item #28)
   - Expand trait system — more variety, more personality
   - Add nickname generation based on attributes + personality + career events
   - Wire traits into commentary ("the ice-cold finisher", "the fiery tackler")
   - Wire nicknames into news stories

4. **Roles in Gaffer language** (user item #16)
   - Replace FM-style role names (Poacher, BallPlayingCB, etc.) with Gaffer voice
   - "Poacher" → "Fox in the Box"
   - "BallPlayingCB" → "Silky Defender"
   - "SweeperKeeper" → "Last Man Back"
   - Add role descriptions in Gaffer voice

5. **News story diversity** (user item #15)
   - Stop clipping press conference answers as news stories
   - Build procedural news story generator — varied templates + spin
   - Add story types: transfer rumours, form analysis, milestone features, rivalry pieces
   - Apply sensationalist spinner (already built) more aggressively

6. **Press conference rework** (user item #7)
   - Add "permanent delegate" toggle — assistant always handles press
   - Add "send player" option — captain or star player attends instead
   - News story depends on who attended
   - Absence noted if manager never goes ("Gaffer snubs press again")
   - Remove the "pressconferences" table/filename display in game screens

**Estimated effort:** 1 full session, ~3,000 lines of Rust + TSX changes
**Risk:** Medium — content generation needs careful tuning to avoid repetition
**Tests:** Content generation tests — assert variety, no repetition within a season

---

### PHASE 6 — QoL + Polish (1 session)

**Goal:** Address remaining QoL items, polish, accessibility.

**Work items:**

1. **Post-continue popups rework** (user item #19)
   - Replace the two popups with a landing page that shows during processing
   - Show results + news inline as they arrive
   - No manual dismissal required — auto-advances when processing completes

2. **Inbox message frequency** (user item #21)
   - Add settings for message frequency (all / important only / critical only)
   - Add "Dressing Room Report" frequency setting
   - Improve inbox message buttons — add confirmation, show what "I understand" does
   - Gaffer voice pass on all inbox message templates

3. **Staff functionality** (user item #22)
   - Clarify what each staff member does (Coach → training, Physio → recovery, Scout → scouting)
   - Add staff character/personality (traits, background, voice)
   - Apply interpretation layer to staff attributes (no raw numbers)
   - Limit staff count per team (realistic — 1 manager, 1 assistant, 2-3 coaches, 1 physio, 2-3 scouts)

4. **Academy clarity** (user item #23)
   - Explain why you'd drop a first-teamer into academy (recovery from injury, loss of form, discipline)
   - Add "why?" tooltip on delegate-to-academy action

5. **Squad Pulse interpretations** (user item #24)
   - Replace "how is this calculated" with "what is this"
   - Never show raw calculations — always interpreted Gaffer voice
   - Add variety to interpretations

6. **Other Gaffers section** (user item #25)
   - Add character/personality to AI managers
   - Replace raw "Rep" numbers with interpretation layer
   - Add rivalry stories between managers

7. **Stats/analytics tabs** (user item #26)
   - New "Analysis" tab with deep stats — but never raw attributes
   - Opposition tactics analysis
   - Form guides, heatmaps (if data available)
   - Player comparison tools

8. **Player search by interpreted ranges** (user item #27)
   - Search by attribute clusters ("pacey winger", "ball-playing CB", "clinical finisher")
   - Search by mental traits ("leader", "edge", "team ethic")
   - Scouting always sits above player search — unscouted players don't show attributes

9. **Generated player balancing** (user item #14)
   - Fix young players being too good — tune youth generation
   - Position-relevant heights (CBs tall, wingers shorter)
   - Better attribute balancing across the game world
   - Worldbeaters should be rare — tune superstar generation rate

**Estimated effort:** 1 full session, ~2,500 lines of changes
**Risk:** Low — mostly UI + content changes
**Tests:** Standard unit tests for new features

---

## Fork Strategy Recommendation

### Option A: Fork to `v99-overhaul` branch (RECOMMENDED)

```bash
git checkout main
git checkout -b v99-overhaul
git push origin v99-overhaul
```

**Pros:**
- `main` stays as stable v98 — users can always download it
- Cherry-pick bug fixes back to `main` as they're ready
- v99 work can break things without pressure
- Clear separation between "stable release" and "development"

**Cons:**
- Two branches to maintain
- Merge conflicts when cherry-picking

### Option B: Clone to new repo `gaffer-v99`

**Pros:**
- Complete isolation
- No branch confusion

**Cons:**
- Lose git history connection
- Harder to cherry-pick fixes back
- Two repos to manage

### Option C: Continue on `main` (NOT RECOMMENDED)

**Pros:**
- Simplest

**Cons:**
- v98 stable build is lost as soon as v99 work starts
- No rollback path if v99 work goes wrong
- User explicitly asked about clone/fork — indicates they want isolation

**My recommendation:** Option A. Fork to `v99-overhaul` branch on the same repo. Keep `main` as the stable release line. Tag the current `main` as `v98-stable` before forking.

---

## Session Plan

| Session | Phase | Deliverable |
|---|---|---|
| 1 | Phase 1 | Bug fixes + OVR interpretation + scouting leaks fixed |
| 2 | Phase 2 | Match engine expansion + dead attrs wired + sparse simulator |
| 3 | Phase 3 | UI softening + tactics reimagining + button feedback |
| 4-5 | Phase 4 | Real world data expansion (needs subagents with internet) |
| 6 | Phase 5 | Content depth (careers, partnerships, traits, roles) |
| 7 | Phase 6 | QoL + polish + final audit |

**Total: 7 sessions** for the full v99 overhaul. Each session is independently shippable — if we stop after Phase 3, the game is meaningfully better than v98.

---

## Open Questions for User

1. **Fork strategy:** Confirm Option A (branch on same repo) vs Option B (new repo) vs Option C (continue on main)?

2. **Real world data scope:** Phase 4 is the biggest effort. Confirm priority:
   - All 30+ leagues + 15k players + cups + national teams? (2 full sessions)
   - Or just fix the Big 5 + add cups? (1 session)
   - Or defer real world data to a later v99.1?

3. **Player images:** Licensing blocks real photos. Confirm:
   - Improve procedural portraits only? (safe)
   - Bundle real photos and accept licensing risk? (risky)
   - Add face-pack modding hook for community? (medium effort)

4. **Subagent access:** Phase 4 needs subagents with internet access for scraping. Confirm this is available?

5. **Priority order:** If we can only do 3 phases, which 3? My recommendation: Phase 1 (bugs) + Phase 2 (engine) + Phase 3 (UI). Defer Phase 4-6 to v99.1.

---

## Appendix: Audit References

- Match engine audit: full report in conversation history
- Scouting/OVR/data audit: full report in conversation history
- User feedback document: `/home/z/my-project/upload/Gaffer V99 major overhaul..txt`
- Current stable build: `main` branch, commit `abc9a3a` (2026-07-10)
