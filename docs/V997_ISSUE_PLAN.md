# Gaffer V99.7 — Issue Fix Plan

**Date:** 2026-07-14
**Commit:** `35bd82d` (origin/main)
**Mode:** PLANNING ONLY — no code changes yet.

---

## 0. Priority Order

Issues are ordered by impact on playability:

1. **Contract expiry flood** (blocks gameplay — 500+ messages)
2. **Flat team finances** (breaks transfer market + economy)
3. **Transfer market broken** (can't sign players)
4. **Player card raw numbers** (violates Gaffer voice principle)
5. **Hex cluster raw key labels** (visible UI bug)
6. **Team selection OVR display** (needs verification)
7. **Tactics UI improvements** (large effort, medium priority)
8. **Interpretation engine variety** (medium effort)
9. **News story variety** (low effort per story, ongoing)
10. **UI makeover** (large effort, can be incremental)
11. **Match engine discussion** (defer until 1-6 are fixed)

---

## 1. Contract Expiry Flood (CRITICAL)

### Problem
DB has contracts from 2022-2023. Game starts in 2026. ~3,318 players (62%) have contracts that expired before the game start date. The daily `process_contract_expiries` function fires for every expired contract, generating inbox messages for each.

### Fix: Extend contracts on world load
In `build_game_from_world_data` (game.rs), after loading players, extend all contracts to at least 2 years from the game start date:

```rust
let game_start_year = game.clock.start_date.year();
let min_contract_end = format!("{}-06-30", game_start_year + 2);
for player in game.players.iter_mut() {
    if let Some(ref ce) = player.contract_end {
        if ce < &min_contract_end {
            player.contract_end = min_contract_end.clone();
        }
    } else {
        player.contract_end = Some(min_contract_end.clone());
    }
}
```

**Why this approach:** Starting the game in 2023 would lose 3 years of real-world context (Mbappe at PSG, Messi at Inter Miami, etc.). Extending contracts preserves the roster while preventing mass expiry. Players whose real contracts expired will still leave on their next expiry.

### Systems affected
- `src-tauri/src/commands/game.rs` — `build_game_from_world_data`
- `src-tauri/crates/ofm_core/src/contracts.rs` — `process_contract_expiries`

---

## 2. Flat Team Finances (CRITICAL)

### Problem
ALL 184 teams have:
- `finance = £50,000,000` (same for all)
- `wage_budget = £500,000/week` (already fixed by NE-2 to 115% of squad wages)
- `transfer_budget = £5,000,000` (already fixed by NE-4 to reputation-scaled)

The `finance` (cash reserves) is still flat at £50M for all teams. This means a lower-tier Belgian club has the same cash as Man City.

### Fix: Scale finance by reputation
In `build_game_from_world_data`, after the NE-2/NE-4 budget fixes:

```rust
// Scale finance by reputation (300-900 range)
// rep 880 (elite): £200M
// rep 650 (lower): £25M
// Formula: (rep - 300) * 312,500
team.finance = ((team.reputation as i64 - 300) * 312_500).max(5_000_000);
```

### Systems affected
- `src-tauri/src/commands/game.rs` — `build_game_from_world_data`

---

## 3. Transfer Market Broken (HIGH)

### Problem
User couldn't sign any players as Manchester United. Possible causes:
- Transfer budget too low after NE-4 fix (Man Utd rep 880 → £145M, should be enough)
- AI clubs refusing to sell (not-for-sale logic too aggressive)
- Player club appeal too low (hardcoded year was fixed, but appeal threshold may be too high)
- Wage demands exceeding budget after NE-2 fix (squad wages are high, budget is 115%)

### Fix: Investigate transfer flow
1. Check if `incoming_interest_score` threshold (35) is too high for star players
2. Check if `minimum_acceptable_fee` produces fees exceeding transfer budget
3. Check if `club_appeal_score` returns < 30 for Man Utd (shouldn't — rep 880)
4. Check if wage demands are reasonable (player.wage vs team.wage_budget)

This needs runtime testing with debug logging to identify the exact failure point.

### Systems affected
- `src-tauri/crates/ofm_core/src/transfers.rs` — transfer bid logic
- `src-tauri/crates/ofm_core/src/contracts.rs` — `club_appeal_score`

---

## 4. Player Card Raw Numbers (HIGH — Gaffer Voice Violation)

### Problem
The "player swap" card in tactics shows raw attribute numbers (e.g. "Pace: 82, Finishing: 90") instead of Gaffer-voice interpretations ("Lightning quick", "Clinical finisher").

### Fix: Use interpretation layer
The `gafferEngine.ts` (src/lib/gafferEngine.ts, 896 lines) already has `interpretAttribute()` and `interpretAttributeForPosition()` functions. The SubPanel/pre-match swap card needs to use these instead of displaying raw numbers.

### Systems affected
- `src/components/match/SubPanel.tsx` — player swap card
- `src/components/match/PreMatchLineup.tsx` — lineup display
- `src/lib/gafferEngine.ts` — interpretation functions (already exist)

---

## 5. Hex Cluster Raw Key Labels (HIGH — Visible Bug)

### Problem
`HexAttributeCluster.tsx` uses `t("playerProfile.attrGroups.body")` but the i18n file only has keys `physical`, `technical`, `mental`, `goalkeeper` — not `body`, `ball`, `head`, `gloves`. When a key is missing, i18next returns the key path as the string (e.g. "playerProfile.attrGroups.body").

### Fix: Add missing i18n keys
Add `body`, `ball`, `head`, `gloves` keys to the `attrGroups` section of en.json:

```json
"attrGroups": {
    "physical": "The Body",
    "technical": "The Ball",
    "mental": "The Head",
    "goalkeeper": "The Gloves",
    "body": "The Body",
    "ball": "The Ball",
    "head": "The Head",
    "gloves": "The Gloves"
}
```

Or better: change the component to use the existing keys (`physical` instead of `body`, etc.).

### Systems affected
- `src/i18n/locales/en.json` — missing keys
- `src/components/playerProfile/HexAttributeCluster.tsx` — key names

---

## 6. Team Selection OVR Display (MEDIUM)

### Problem
User reports "OVR" team values on team selection screen. After code analysis, the screen already uses `getReputationLabel()` which returns interpreted labels ("World Class", "Strong", "Average", "Developing"). However, the reputation NUMBER may still be displayed somewhere (e.g. as a tooltip or secondary stat).

### Fix: Audit team selection for any raw number display
- Check if reputation number is shown alongside the label
- Check if squad OVR is displayed as a number
- Replace any raw numbers with Gaffer-voice interpretations

### Systems affected
- `src/pages/TeamSelection.tsx`

---

## 7. Tactics UI Improvements (MEDIUM — Large Effort)

### Problem
- Set piece sections repeated across sub-tabs
- Pitch section too small, needs semi-3D perspective
- Phase blueprint needs to be more prominent
- Needs drag-and-drop functionality (XI ↔ bench)
- Player swap card shows raw numbers

### Fix: Redesign tactics tab
This is a significant UI overhaul:
1. Consolidate set piece selectors into a single section (not repeated)
2. Enlarge the formation pitch with perspective CSS
3. Make Phase Blueprint panel more prominent (larger, clearer labels)
4. Add drag-and-drop using HTML5 drag API or react-dnd
5. Replace raw numbers with Gaffer-voice interpretations

### Systems affected
- `src/components/tactics/` — entire directory (15 files)
- `src/components/match/SubPanel.tsx` — swap card
- `src/lib/gafferEngine.ts` — interpretation layer

---

## 8. Interpretation Engine Variety (MEDIUM)

### Problem
The Gaffer interpretation engine lacks variety, particularly for position-relevant attributes. A striker with Finishing 85 and a striker with Finishing 95 might get similar descriptions.

### Fix: Expand interpretation variety
- Add more tier breakpoints (currently 5 tiers, expand to 8)
- Add position-specific descriptors (e.g. "Clinical in the box" for strippers, "Last-ditch tackler" for defenders)
- Add comparison-to-league-average context ("Above average for this division")

### Systems affected
- `src/lib/gafferEngine.ts` — interpretation functions
- `src/lib/attributeInterpretation.ts` — attribute descriptions
- `src/lib/ovrInterpretation.ts` — OVR descriptions

---

## 9. News Story Variety (LOW — Ongoing)

### Problem
News stories lack diversity. The same headlines appear repeatedly.

### Fix: Expand news templates
- Add more headline variants per category
- Add context-aware modifiers (weather, rivalry, recent form)
- Add player-quote templates for match reports
- Add manager reaction templates

### Systems affected
- `src-tauri/crates/ofm_core/src/turn/news.rs` — news generation
- `src-tauri/crates/ofm_core/src/news.rs` — news article builders
- `src/i18n/locales/en.json` — news headline variants

---

## 10. UI Makeover (MEDIUM — Incremental)

### Problem
Every screen is "basic and ugly". Needs textures, background images, different shapes, cleaner palette.

### Fix: Incremental UI improvements
The repo already has textures in `src/assets/`:
- `stadium-night-bg.png` — stadium background
- `texture-leather-dark.png` — leather texture
- `texture-pitch-grass.png` — grass texture
- `texture-tactics-board.png` — tactics board
- SVG textures in `src/assets/gaffer-ui/` (9 files)

Approach:
1. Apply existing textures to more screens (dashboard, player profile, finances)
2. Add card shadows, rounded corners, and depth to flat panels
3. Update colour palette for sharper contrast
4. Use GafferIcons more extensively
5. Generate new textures/images as needed

### Systems affected
- `src/App.css` — design system
- All component files — visual updates

---

## 11. Match Engine Discussion (DEFERRED)

Deferred until issues 1-6 are fixed and tested. Topics to discuss:
- Player positions and their effect on match simulation
- Commentary variety and quality
- Match event visualisation
- Player rating calculation

---

## Implementation Order

### Phase 1: Critical Fixes (must do first)
1. Contract expiry extension (1-line change in build_game_from_world_data)
2. Finance scaling (1-line change in build_game_from_world_data)
3. Hex cluster i18n keys (1-line fix in en.json + component update)
4. Transfer market investigation (add debug logging, test)

### Phase 2: Gaffer Voice Fixes
5. Player swap card raw numbers → interpretation layer
6. Team selection audit for raw numbers
7. Player card improvements (form/stability/confidence)

### Phase 3: UI Improvements
8. Tactics tab redesign (large effort)
9. Apply textures to more screens
10. Colour palette update

### Phase 4: Content Variety
11. Interpretation engine variety expansion
12. News story variety expansion
13. Match engine discussion

---

*This plan is a planning document only. No code changes have been made.*
