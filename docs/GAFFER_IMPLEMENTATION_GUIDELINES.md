# Gaffer — Safe Implementation Guidelines

**Purpose:** This document provides instructions and guidelines for making code changes to the Gaffer codebase **without breaking things**. It is written for the AI assistant (and any human developer) who will implement the fixes identified in `GAFFER_V995_FORENSIC_ANALYSIS.md`.

**Date:** 2026-07-13
**Commit:** `6bea494` (origin/main)

---

## 0. Why This Document Exists

The V99.3–V99.5 development cycle suffered repeated build breakages caused by:
1. **Automated scripts** that made careless find-and-replace changes across the codebase
2. **Cache corruption** from interrupted builds (both Rust `target/` and Vite `node_modules/.vite/`)
3. **Missing error boundaries** that turned runtime errors into blank white screens
4. **Insufficient testing** between changes — no verification that a fix worked before pushing

This document establishes a disciplined workflow to prevent these issues from recurring.

---

## 1. Golden Rules

### Rule 1: NO SCRIPTS for code changes
**Never use Python/bash scripts to modify `.rs`, `.ts`, or `.tsx` files.** The V99.4–V99.5 cycle proved that automated find-and-replace scripts cause more damage than they fix. Every code change must be made manually with the `Edit` or `MultiEdit` tool, reading the context before and after.

**Exception:** Simple, single-purpose scripts for deletion-only operations (e.g., removing a specific unused import line) are acceptable, but only after manual verification of every match.

### Rule 2: Read before you edit
Before editing any file:
1. **Read the full file** (or at least 50 lines of context around the edit site)
2. **Understand what the code does** — don't just pattern-match
3. **Check for other references** — grep for the function/type/field you're changing
4. **Verify the fix is correct** — read the edited result after applying

### Rule 3: One change per commit
Each commit should address ONE issue or ONE wave of related issues. Do not bundle unrelated changes. This makes it possible to revert a specific fix if it causes problems.

### Rule 4: Test after every change
After making a change:
1. **Run `npx tsc --noEmit`** — must exit 0
2. **Run `npx vite build`** — must succeed
3. **Run `cargo check --manifest-path src-tauri/Cargo.toml`** — must compile (if Rust changed)
4. If any check fails, **fix it before pushing**

### Rule 5: Clear caches when needed
If the build fails with cryptic errors (especially "crate not found in rlib format" or blank white screens):
1. **Clear Rust cache:** `rm -rf src-tauri/target/`
2. **Clear Vite cache:** `rm -rf node_modules/.vite/`
3. **Rebuild from scratch**
4. The `run-and-build.bat` option 5 now clears both caches.

### Rule 6: Push only working code
Never push code that doesn't compile. If you can't verify the build (e.g., because the Linux environment can't build Windows Tauri), say so explicitly and ask the user to test before pushing further.

---

## 2. Pre-Change Checklist

Before making ANY code change, run through this checklist:

- [ ] Have I read the file I'm about to edit? (at least 30 lines of context)
- [ ] Have I grepped for all references to the function/type/field I'm changing?
- [ ] Is this change in the correct wave order? (Wave A → B → C → D → E → F)
- [ ] Will this change break any existing tests?
- [ ] Does this change require a DB migration? If so, is the migration written?
- [ ] Does this change touch any `#[serde(default)]` fields? If so, is backward compatibility maintained?
- [ ] Have I checked for frontend/backend type mismatches?

---

## 3. Wave-by-Wave Implementation Guide

### Wave A — Critical Persistence Fixes (P0)

**Goal:** Make V99.4 features survive save/reload cycles.

**Order:**
1. P0-1 (player fields) → P0-2 (manager personality) → P0-3 (team board_type) → P2-7 (deterministic_seed)

**For each persistence fix, the pattern is:**

#### Step 1: Write the migration
Create `src-tauri/crates/db/src/sql/v045_<description>.sql`:
```sql
-- Add V99.4 player fields that were missing from the schema
ALTER TABLE players ADD COLUMN release_clause INTEGER;
ALTER TABLE players ADD COLUMN transfer_request_date TEXT;
ALTER TABLE players ADD COLUMN low_morale_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN career_events_json TEXT;
ALTER TABLE players ADD COLUMN partnerships_json TEXT;
ALTER TABLE players ADD COLUMN fame TEXT NOT NULL DEFAULT 'Unknown';
```

#### Step 2: Register the migration
In `src-tauri/crates/db/src/migrations.rs`:
- Add the new migration to the `MIGRATIONS` array
- Bump `MIGRATION_COUNT` to 45

#### Step 3: Update the repository
In `src-tauri/crates/db/src/repositories/player_repo.rs`:
- Add the new columns to the `INSERT INTO players (...)` statement
- Add the new columns to the `SELECT` in `load_all_players`
- Update `row_to_player` to read the new columns instead of relying on `..Default::default()`

**Critical:** The INSERT must use `serde_json::to_string` for JSON columns (career_events, partnerships) and the SELECT must use `serde_json::from_str` to deserialize them.

**Backward compatibility:** Existing saves (v044) will have NULL for the new columns. The migration adds them with DEFAULT values. On load, `Option<>` fields will be `None` and `Default` fields will use the SQL DEFAULT. This is safe.

#### Step 4: Test
```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

---

### Wave B — Engine Path Unification (P1)

**Goal:** Make live matches use the same modifiers as CPU-simmed matches.

**Order:**
1. P1-1 (tactics_multiplier) → P1-2 (partnership_bonus) → P1-4 (trait names) → P1-5 (hardcoded year) → P2-1 through P2-5

**For P1-1 (tactics_multiplier in live match):**

1. Read `src-tauri/crates/engine/src/live_match/zone_resolution.rs` lines 120-250
2. Read `src-tauri/crates/engine/src/engine/resolution.rs` lines 185-310 (to see how the engine path does it)
3. In `zone_resolution.rs`, find `resolve_midfield` and `resolve_attacking_third`
4. Add `* att_team.tactics_multiplier` to the `att_mod` calculation
5. Add `* def_team.tactics_multiplier` to the `def_mod` calculation
6. Verify the variable names match (check what `att_team` and `def_team` are called in that scope)

**For P1-2 (partnership_bonus in live match):**

1. Read `src-tauri/crates/ofm_core/src/live_match_manager/team_builder.rs` lines 470-520
2. Read `src-tauri/crates/ofm_core/src/turn/mod.rs` lines 650-700 (to see how `build_engine_team` does it)
3. Find the `compute_partnership_bonus` function (grep for it)
4. In `to_engine_player()`, replace `..Default::default()` with an explicit `partnership_bonus: compute_partnership_bonus(player, team_id)` field

**For P1-4 (trait name mismatches):**

1. Read `src-tauri/crates/engine/src/shared.rs` lines 90-185
2. Read `src-tauri/crates/domain/src/player.rs` lines 798-810 (the `PlayerTrait` enum)
3. Map each old trait name to the correct enum variant:
   - `"Sharpshooter"` → `"Predator"`
   - `"Dribbler"` → `"VelvetTouch"`
   - `"Playmaker"` → `"Orchestrator"`
   - `"Tank"` → `"Powerhouse"`
   - `"AerialDominance"` → `"Rock"`
   - `"HotHead"` → (no equivalent — remove or map to something appropriate)
   - `"Engine"` → `"EngineRoom"`
   - `"TeamPlayer"` → `"Workhorse"`
   - `"Tireless"` → `"Workhorse"` (or merge)
   - `"Agile"` → `"Twisty"`
   - `"Speedster"` → `"Speedster"` (already correct)
4. Update each `if traits.contains(&"OldName")` to use the correct name

---

### Wave C — Missing Wiring (P1-3, P1-6)

**For P1-3 (wire derive_importance):**

1. Read `src-tauri/crates/ofm_core/src/schedule.rs` lines 9-65 (the `derive_importance` function)
2. Find all fixture creation sites (grep for `importance: FixtureImportance::`)
3. At each site, replace the hardcoded `FixtureImportance::League`/`Cup`/`Friendly` with a call to `derive_importance(&competition, home_rep, away_rep)`
4. You'll need to pass team reputations — look up how to get them from the context at each site

**For P1-6 (wire ManagerPersonality into ai_training):**

1. Read `src-tauri/crates/ofm_core/src/ai_training.rs` lines 45-60
2. Read `src-tauri/crates/domain/src/manager.rs` lines 85-115 (the `preferred_play_style` and `preferred_formation` methods)
3. Change `style_weekly_cycle(team.play_style)` to `style_weekly_cycle(manager.personality.preferred_play_style().unwrap_or(team.play_style))`
4. You'll need to look up the AI manager for the team — check how other code does this (grep for `game.managers.iter().find`)

---

### Wave D — Frontend Polish

**For P1-FE (invisible Continue button):**

1. Read `src/pages/Dashboard.tsx` lines 390-420
2. Find `MODE_META` definition
3. For `live` mode, change `buttonColorClass: " "` to `buttonColorClass: "bg-primary-500 hover:bg-primary-600"`
4. Verify the button is visible on both light and dark themes

**For broken `dark: dark:` class fragments:**

For each of the 8 files:
1. Read the file at the affected line
2. Find the pattern `dark: dark:via-navy-900 dark:`
3. Replace with the correct Tailwind classes (likely just `dark:via-navy-900` without the duplicated `dark:` prefix)
4. Check if the gradient is even needed — if `bg-linear-to-r` is present with `from-*`/`via-*`/`to-*` stops, the `dark:` variants should be on those color stops, not as a standalone fragment

**For `bg-linear-to-r` without color stops:**

1. Read each affected file
2. Either add appropriate `from-*`/`to-*` color stops, OR remove the `bg-linear-to-r` class entirely if no gradient is needed

**For `formatSignedAmount` double-sign:**

1. Read `src/components/finances/FinancesTab.tsx` lines 75-90
2. Read `src/lib/valueFormatting.ts` lines 30-50 (to see how `formatVal` handles signs)
3. Remove the manual `-` prefix prepend — `formatVal` already handles it

**For deleting dead code:**

1. Delete `src/components/menu/PackageBuildStep.tsx`
2. Delete `src/components/ui/icons/GafferIcons.tsx`
3. Remove the `GafferTagline` export from `src/components/brand/GafferCrest.tsx`
4. Remove `fetchMatchMeaning` and `matchSnapshot` from `src/store/meaningStore.ts`
5. Clean up `src/components/menu/WorldSelect.tsx` lines 11-52 (remove unused type exports)
6. Remove the empty `{/* Package Editor */}` comment from `src/pages/MainMenu.tsx:788`
7. Update `src/pages/MainMenu.test.tsx` to remove the `vi.mock` for `PackageBuildStep`

**After each deletion:**
```bash
npx tsc --noEmit
npx vite build
```

---

## 4. Database Migration Pattern

When adding a new persisted field:

### Step 1: Add the field to the domain struct
```rust
// src-tauri/crates/domain/src/player.rs
#[serde(default)]
pub release_clause: Option<u64>,
```
Always use `#[serde(default)]` for new fields — this maintains backward compatibility with existing saves.

### Step 2: Write the migration
```sql
-- src-tauri/crates/db/src/sql/v046_add_release_clause.sql
ALTER TABLE players ADD COLUMN release_clause INTEGER;
```

### Step 3: Register the migration
```rust
// src-tauri/crates/db/src/migrations.rs
const MIGRATIONS: &[(&str, &str)] = &[
    // ... existing migrations ...
    ("v046_add_release_clause", include_str!("sql/v046_add_release_clause.sql")),
];
const MIGRATION_COUNT: u32 = 46;
```

### Step 4: Update the repository
```rust
// src-tauri/crates/db/src/repositories/player_repo.rs
// In INSERT:
"release_clause" -> player.release_clause.map(|v| v as i64),

// In SELECT:
release_clause: row.get::<_, Option<i64>>(col).map(|v| v as u64),

// In row_to_player — remove from ..Default::default() and set explicitly
```

### Step 5: Test
```bash
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml -p db
```

---

## 5. Rust Code Change Checklist

When modifying Rust code:

- [ ] Does it compile? (`cargo check --manifest-path src-tauri/Cargo.toml`)
- [ ] Are all imports used? (no `unused_imports` warnings)
- [ ] Are there any `..Default::default()` that might be hiding missing fields?
- [ ] If you added a `use` statement, does it conflict with an existing import?
- [ ] If you changed a struct, did you update all construction sites?
- [ ] If you changed a function signature, did you update all callers?
- [ ] If you touched `#[serde(...)]` attributes, is backward compatibility maintained?
- [ ] If you added a DB column, did you write the migration AND update the repo?

### Common Rust pitfalls in this codebase

1. **`use` statements inside multi-line `use` blocks** — never insert a `use` line inside a `use crate::foo::{ ... }` block. Add it as a separate statement outside the block.

2. **`..Default::default()` hiding missing fields** — when you see `..Default::default()` at the end of a struct literal, check whether the struct was recently extended. The repo code may be silently dropping new fields.

3. **Borrow checker in iteration** — when iterating `game.players` and then mutating `game.players`, clone the data you need first (see the `aging.rs:228` pattern).

4. **`random_range` requires `RngExt`** — in rand 0.10, `random_range` is on the `RngExt` trait, not `Rng`. If a file uses `random_range`, it needs `use rand::RngExt;` (or `use rand::{Rng, RngExt};` if `Rng` is also needed for `impl Rng` in signatures).

5. **`MatchResult` vs `SparseMatchResult`** — these have different field names:
   - `MatchResult`: `home_goals`, `away_goals`, `home_scorers`, `away_scorers`
   - `SparseMatchResult`: `home_score`, `away_score`, `events`
   Never blindly sed-replace one with the other.

---

## 6. Frontend Code Change Checklist

When modifying TypeScript/React code:

- [ ] Does TypeScript compile? (`npx tsc --noEmit`)
- [ ] Does Vite build? (`npx vite build`)
- [ ] Are all imports used? (no unused import warnings)
- [ ] If you removed a component, did you remove all imports of it?
- [ ] If you removed a type, did you remove all references?
- [ ] If you changed a prop interface, did you update all callers?
- [ ] Are i18n keys added to `en.json` for any new user-facing strings?
- [ ] Are there any `dangerouslySetInnerHTML` usages that could use plain text instead?

### Common frontend pitfalls

1. **Whole-store subscriptions** — never destructure `useGameStore()` or `useSettingsStore()` without a selector. Use:
   ```ts
   const gameState = useGameStore((s) => s.gameState);
   const settings = useSettingsStore((s) => s.settings);
   ```

2. **Tailwind v4 class names** — `bg-gradient-to-r` was renamed to `bg-linear-to-r` in Tailwind v4. If you see `bg-gradient-to-*`, it's the old name and won't work. But `bg-linear-to-r` WITHOUT `from-*`/`to-*` color stops also doesn't work — it renders transparent.

3. **`dark:` modifier** — in Tailwind v4, `dark:` is applied via a custom variant (`@custom-variant dark (&:where(.dark, .dark *))`). Never write `dark: dark:foo` — the duplicated `dark:` is a syntax error that produces no styles.

4. **Lazy-loaded components** — if you delete a component that was lazy-loaded, remove the `lazy(() => import(...))` line too, otherwise the build will fail.

5. **i18n `defaultValue` fallbacks** — `t("key", { defaultValue: "English" })` masks missing i18n keys. If you use `defaultValue`, also add the key to `en.json`.

---

## 7. Build & Cache Management

### When to clear caches

| Symptom | Clear Rust cache? | Clear Vite cache? |
|---|---|---|
| Rust compile error | No (fix the code) | No |
| "crate not found in rlib format" | Yes | No |
| Blank white screen | No | Yes |
| "Module not found" in browser console | No | Yes |
| Stale module errors after import changes | No | Yes |
| Strange linker errors | Yes | No |
| Build was working, now fails for no reason | Yes | Yes |

### How to clear caches

**From Windows (run-and-build.bat):**
- Option 5 now clears BOTH `src-tauri/target/` and `node_modules/.vite/`

**From Linux (development):**
```bash
rm -rf src-tauri/target/ node_modules/.vite/
```

### After clearing caches

The next build will take 15-30 minutes (full Rust compile from scratch). Plan accordingly. Once it succeeds, incremental builds will be fast (1-3 minutes).

---

## 8. Testing Strategy

### Minimum verification after each change

1. **TypeScript:** `npx tsc --noEmit` (must exit 0)
2. **Vite build:** `npx vite build` (must succeed)
3. **Rust compile:** `cargo check --manifest-path src-tauri/Cargo.toml --workspace` (must compile)

### Full test suite (run before pushing)

```bash
# Frontend tests
npx vitest run

# Rust tests
cargo test --manifest-path src-tauri/Cargo.toml --workspace
```

### Manual verification (ask user to test)

After pushing, ask the user to:
1. `git pull origin main`
2. Run option 5 (Clear build cache) if caches are stale
3. Run option 1 (Run game)
4. Verify the specific fix works
5. Check for any new regressions

---

## 9. Commit Message Format

```
<type>: <short description>

<longer description explaining what changed and why>

<if applicable: list of files changed>
<if applicable: migration notes>
<if applicable: breaking changes>
```

### Types
- `FIX:` — bug fix
- `FEAT:` — new feature
- `REFACTOR:` — code restructure (no behavior change)
- `CHORE:` — cleanup, dependency updates, etc.
- `DOCS:` — documentation only
- `PERF:` — performance improvement

### Example
```
FIX: Add V99.4 player fields to DB schema + player_repo

The player_repo INSERT/SELECT did not include release_clause,
transfer_request_date, low_morale_days, career_events, partnerships,
or fame fields. Every save/reload reset these to defaults.

Added v045 migration with ALTER TABLE for each new column.
Updated player_repo to read/write all V99.4 fields.

Files changed:
- src-tauri/crates/db/src/sql/v045_gaffer_v994_fields.sql (new)
- src-tauri/crates/db/src/migrations.rs (register v045, bump count)
- src-tauri/crates/db/src/repositories/player_repo.rs (INSERT/SELECT)
```

---

## 10. What NOT to Touch

These systems are well-implemented and should not be refactored:

### Backend
- **Crate structure** — domain → engine → ofm_core → db separation is correct
- **`#[serde(default)]` pattern** — this is the backward-compatibility mechanism; do not remove
- **Daily turn loop organisation** — `turn/mod.rs` pipeline is well-ordered
- **Save manager backfill pipeline** — the 7-stage load pipeline handles legacy saves correctly
- **44 migration system** — sequential, well-versioned; only ADD migrations, never modify existing ones
- **Match engine zone-based resolution** — structurally sound; only fix specific modifier wiring
- **Regen system** — 1:1 replacement works correctly
- **World Cup system** — full quadrennial cycle is correct
- **Scouting progressive reveal** — 3-tier system is well-designed

### Frontend
- **Route structure** — 7 routes with lazy loading is correct
- **zustand store pattern** — the store structure is fine; only fix the selector usage
- **i18n lazy loading** — `resourcesToBackend` with `import.meta.glob` is correct
- **Tailwind v4 design system** — the `@theme` block in App.css is cohesive
- **Custom UI primitives** — Select, DatePicker, Checkbox, Toast are well-built
- **Error boundary** — keep it wrapping the entire app
- **Test coverage** — do not delete existing tests

---

## 11. Emergency Procedures

### If the build breaks after a push

1. **Do NOT push more fixes blindly** — diagnose first
2. Read the error message carefully
3. If it's a Rust error, check:
   - Are all imports valid?
   - Are there any `..Default::default()` hiding missing fields?
   - Did you change a struct without updating all construction sites?
4. If it's a frontend error, check:
   - Are all imports valid?
   - Did you delete a component that was still imported?
   - Are there TypeScript type mismatches?
5. If it's a cache issue, tell the user to run option 5 (Clear build cache)

### If the game shows a blank white screen

1. The ErrorBoundary (added in V99.5) should now show the actual error
2. Ask the user to open DevTools (F12 → Console) and screenshot the error
3. If the error is a React rendering crash, fix the specific component
4. If the error is a module loading failure, clear the Vite cache

### If you need to revert a commit

```bash
git revert <commit-hash>
git push origin main
```

Do NOT use `git reset --hard` on pushed commits — this rewrites history and causes confusion.

---

## 12. Summary

The key lessons from V99.4–V99.5:

1. **Manual > automated** — every script that modified code caused more problems than it solved
2. **Read before write** — always understand the context before editing
3. **Test before push** — never push code that doesn't compile
4. **Clear caches when stuck** — cache corruption causes cryptic errors
5. **One change per commit** — makes reverting safe and targeted
6. **Persistence first** — features that don't survive save/reload are useless
7. **Engine path unification** — live match and full engine must use the same modifiers
8. **Frontend polish matters** — invisible buttons and broken CSS undermine confidence

Follow this guide and the build will stay stable.

---

*This document should be read before making ANY code change to the Gaffer codebase.*
