# Gaffer — 10-Season Simulation Report (Forensic Code-Level Analysis)

**Project:** gaffer-v99 (commit `b08478a`, V99.8)
**Manager scenario:** EPL club, 10 seasons, full match engine for user fixtures
**Methodology:** Deep code-level forensic analysis of every simulation subsystem (match engine, transfer AI, manager AI, regen/youth, news, persistence). Findings projected to a 10-season horizon. An actual interactive sim was not runnable (Tauri desktop app, no headless runner, ~hours of CPU time), but every constant, formula, and code path below is cited to a real file:line in the repo.

---

## TL;DR — Executive Summary

The codebase has a **solid tactical/match-engine foundation** with believable zone-resolution logic, sensible attribute weighting, and a well-tuned aging curve. The news system has reasonable variety (98 string keys, 30 commentary categories), and the persistence layer (44 migrations, per-save SQLite DBs) is mature.

**However**, the 10-season horizon is **not currently playable to a satisfying conclusion** due to **four critical bugs** and **three structural gaps** that compound over time:

| # | Issue | Severity | Impact on 10-season save |
|---|---|---|---|
| **C1** | Player match rating is **always 0.0** — `calculate_match_rating` exists in `media/mod.rs:304` but is never called | 🔴 Critical | Breaks every rating-dependent UI/AI: season awards, "player of the year", scouting reports, career stats, hall of fame. All read 0.0. |
| **C2** | Regen `contract_end` is hardcoded to `"2027-06-30"` (`regen/mod.rs:134, 192`) — uses literal `2024 + 3` instead of the season year | 🔴 Critical | Every regen generated from season 4 onward is **released as a free agent the next day**. AI squads lose ~5 players/year. |
| **C3** | **No AI contract renewals exist anywhere** in the codebase (only user `delegate_renewals`) | 🔴 Critical | Every AI player eventually walks on a Bosman. AI squads degrade continuously. |
| **C4** | **AI clubs never sign free agents** — `evaluate_transfer_market` skips `team_id = None` players (`transfers.rs:925`) | 🔴 Critical | Free agents pile up in `game.players` forever — hundreds by season 10. |
| **C5** | **Club matches don't apply injuries** — `deplete_match_stamina` calls `apply_match_wear` but not `roll_match_injury` (`turn/post_match.rs:825-838`) | 🟠 High | Injuries only happen via international duty or training. Squad depth becomes irrelevant. |
| **C6** | **Red cards don't reduce team ratings** — `position_attr_avg` / `effective_midfield` don't filter `sent_off` (`engine/src/types.rs:300-306`) | 🟠 High | A 10-man team keeps the same midfield/defense rating for possession. Numerical disadvantage is cosmetic. |
| **C7** | `market_value` is **never recomputed** after worldgen (`player_rating.rs:42-67` refreshes ovr/potential/traits but not MV) | 🟠 High | After 5 seasons, listed values diverge wildly from ability. Developed wonderkids stay cheap; declining veterans stay expensive. |
| **C8** | `regen::reputation_bias()` uses **0-100 thresholds** but team reputation is on a **0-1000 scale** (`regen/mod.rs:37-47` vs `reputation.rs:9`) | 🟠 High | Every club gets +5 max-potential bias. Big clubs don't produce better newgens than small clubs. |
| **C9** | Retired players are **never pruned** from `game.players` (no `retain(|p| !p.retired)` anywhere) | 🟡 Medium | Player array grows from ~3,400 to ~8,500 over 10 seasons. Save bloat + CPU slowdown. |
| **C10** | `build_engine_team` passes the **entire squad** into `team.players` for AI-vs-AI matches (`turn/mod.rs:392-444`) | 🟡 Medium | Deep squads get an unfair boost — `snap_player` can pick fresh bench players. Inconsistent with live engine (which uses starting XI only). |
| **C11** | AI-vs-AI matches use a **different team construction** than user matches (squad vs XI) — no consistency test exists | 🟡 Medium | The same fixture played live vs simmed instantly produces different scoreline distributions. |
| **C12** | Manager personality is **mostly cosmetic** — `Manager` struct has no personality field; only a derived `AiPersonality` (Visionary/Reactive/Pragmatist) from career stats (`live_match_manager.rs:331-345`) | 🟡 Medium | Manager "personality" affects sub-timing + tactical changes in live matches only. No effect on transfers, training, or contract AI. |
| **C13** | No staff retirement — Staff are immortal. Pool grows ~2x over 10 seasons | 🟡 Medium | Cosmetic + minor perf |
| **C14** | `sparse_sim.rs` is **dead code** — `simulate_sparse_match` is defined but never called | 🟢 Low | Misleading file header. Safe to delete. |
| **C15** | Shootout GK skill doubles `shot_stopping` (`gk.shot_stopping + gk.shot_stopping`) instead of using `commanding` (`live_match/penalty.rs:29`) | 🟢 Low | Knockout shootouts ignore 2 of 3 GK attrs. |

### What works well ✅

- **Match engine core**: per-zone action resolution with `att_eff / (att_eff + def_eff)` contests. Sound, defensible design.
- **Attribute weighting**: defending is properly weighted (25% in 3 of 4 defender formulas — not the classic "defending barely matters" bug). GK attrs (shot_stopping + commanding + anticipation) properly feed shot resolution.
- **Play-style multipliers cancel properly** in 1v1 contests (Attacking ×1.12 attack vs Defensive ×1.12 defense → ratio unchanged).
- **TacticsConfig dials**: 9 independent multipliers (pressing, marking, width, defensive_line, build_up, tempo, defensive_shape, counter_press, break_speed) with modest 5-20% magnitudes — well-tuned.
- **Home advantage**: 1.08 multiplier, reasonable.
- **Morale/condition bounds**: 0.90-1.05 morale, condition clamped [5, 100], team_condition floored 0.70.
- **Aging curve**: peak ~28-30, decline 1-2 OVR/yr after 30, forced retirement at 38+ with sensible modifiers (low appearances, low rating, no contract → faster retirement; OVR ≥ 80 → slower).
- **Training progression**: probabilistic per-session gain, capped by potential, age_factor 0.3-1.5, personality_growth_mod 0.675-1.375. Realistic for teenagers; tapers after 25.
- **News variety**: 98 string keys across 18 categories. Match reports have 9 headline variants (3 home win, 3 away win, 3 draw) × 3 body variants. Commentary has 163 templates across 30 event types.
- **Save/load**: 44 migrations, per-save SQLite DBs, world_history archive stores season awards + World Cup champions + national rankings.
- **Career history**: `PlayerMovementEntry` (transfers, loans, releases) + `CareerEntry` (per-season stats) are appended at end-of-season and persisted to DB.
- **Manager firing**: 5-game losing streak → sack. ~3-6 sackings/EPL-season — in the right ballpark.
- **Loan-to-buy**: AI exercises if `fee ≤ 1.1 × MV` or (`fee ≤ 1.25 × MV` AND meaningful loan minutes).
- **Transfer windows**: 60-day pre/early-season window enforced (no January window — see C12 below).
- **Save scum protection**: retirement rolls are seeded by `player_id + season + "retirement-roll"` for deterministic reproduction.

### What doesn't work ❌

See the C1-C15 table above. The full code-level evidence for each is in the body of the report below.

---

## 1. Match Engine — Balance & Diablo-Tactic Risk

### 1.1 Scoreline model

There is **no Poisson model** in the live/AI-vs-AI engine. Both paths (live `LiveMatchState` for user matches, `engine::simulate` for AI-vs-AI) use **per-minute, per-zone action resolution** with two probability gates:

```rust
// Shot accuracy gate (engine/src/engine/resolution.rs:403-404, live_match/zone_resolution.rs:378-379)
let accuracy = (ctx.config.shot_accuracy_base + (shoot_rating - 50.0) / 200.0).clamp(0.15, 0.85);
// shot_accuracy_base = 0.35 (types.rs:382)

// Goal conversion gate (engine/src/engine/resolution.rs:428-430, live_match/zone_resolution.rs:409-410)
let conversion = (ctx.config.goal_conversion_base * def_line_mod + (shoot_rating - gk_rating) / 150.0)
    .clamp(0.10, 0.70);
// goal_conversion_base = 0.36 (types.rs:383)
```

Per-shot goal probability ≈ `0.35 × 0.36` ≈ **12.6%** before adjustments.

**Home advantage**: `1.08` multiplier (`types.rs:380`) applied to the home side's effective rating in every zone contest.

**The Poisson model exists** (`national_team.rs:227-236` `simulate_scoreline`) but is used ONLY for:
- catch-up fixtures (`catchup.rs:114`)
- dormant (out-of-scope) competitions (`turn/dormant.rs:41`)
- national-team matches (`national_team.rs:300`)

A separate `sparse_sim.rs` file defines `simulate_sparse_match` but it is **dead code** (never called — Bug C14).

### 1.2 Attribute weighting

Each zone-resolution function picks a position-appropriate player and computes a raw skill as a **simple arithmetic mean** of 3-4 attributes (no per-attribute weights inside the mean):

| Zone / action | Formula | File:line |
|---|---|---|
| Buildup (own third) | `(passing + vision + composure + teamwork) / 4` | `zone_resolution.rs:47-51` |
| Midfield (attacker) | `(touch + passing + vision + teamwork) / 4` | `zone_resolution.rs:102-106` |
| Midfield (defender) | `(defending + anticipation + decisions + teamwork) / 4` | `zone_resolution.rs:107-111` |
| Attacking third (attacker) | `(touch + pace + agility + composure) / 4` | `zone_resolution.rs:195-199` |
| Attacking third (defender) | `(defending + power + anticipation + aerial) / 4` | `zone_resolution.rs:200-204` |
| Shot (shooter) | `(finishing + composure + decisions) / 3` | `zone_resolution.rs:367-368` |
| Shot (GK) | `(shot_stopping + commanding + anticipation) / 3` | `zone_resolution.rs:371-374` |
| Aerial duel | `aerial_att / (aerial_att + aerial_def)` | `zone_resolution.rs:250-252` |

**Defending stat**: properly weighted — appears in 3 of 4 defender formulas at 25% each. Not the classic "defending barely matters" bug.

**GK weighting**: `shot_stopping`, `commanding`, `anticipation` all feed the shot-resolution GK rating (3 attrs / 3). `distribution` is **defined but never read** by any engine code (Bug — dead attribute). `playing_out` is wired but at ±5% magnitude only.

**Condition adjustment** (live engine only): `condition_adjusted_skill` scales skill by `0.6 + 0.4 × (condition/100)` (`helpers.rs:46-55`). At condition 70 → ×0.88; at 50 → ×0.80.

### 1.3 Formation / Style / Tactics Multipliers

**Formation**: has **no direct rating bonus**. `apply_formation` (`substitution.rs:172-213`) only reassigns `Position` labels to players based on the new shape. The engine never reads `team.formation` during action resolution.

**Play-style phase multipliers** (`shared.rs:197-209`):

| Style | Midfield (own) | Attack (own) | Defense (own) | Press (own) |
|---|---|---|---|---|
| Balanced | 1.00 | 1.00 | 1.00 | 1.00 |
| Attacking | 1.00 | **1.12** | 0.93 | 1.00 |
| Defensive | 1.00 | 0.93 | **1.12** | 1.00 |
| Possession | **1.15** | 0.97 | 1.00 | 1.00 |
| Counter | 0.92 | **1.18** | 1.00 | 1.00 |
| HighPress | 1.00 | 1.00 | 0.95 | **1.20** |

The opponent's style returns 1.0 for non-own phases (`shared.rs:194-196`). So Attacking vs Defensive with equal base ratings produces ~50/50 outcomes — the modifiers cancel in the `att_eff / (att_eff + def_eff)` ratio.

**TacticsConfig dials** (`shared.rs:274-403`) — 9 independent multipliers, all 5-20% magnitude:

| Dial | Options | Effect |
|---|---|---|
| `pressing_intensity` | Passive/Medium/Aggressive | foul ×0.80/1.00/1.25; contest ×0.97/1.00/1.05; press ×0.96/1.00/1.06; fatigue ×0.96/1.00/1.08 |
| `marking_style` | Zonal/Mixed/ManToMan | foul ×1.00/1.05/1.15 |
| `width` | Narrow/Normal/Wide | cross 0.45/0.60/0.72 |
| `defensive_line` | VeryLow/Low/Medium/High | conv ×0.85/0.92/1.00/1.12 |
| `build_up_style` | Short/Mixed/Long | buildup ×1.08/1.00/0.88 |
| `tempo` | Patient/Direct | progression ×0.92/1.00; retention ×1.03/1.00 |
| `defensive_shape` | Stretched/Normal/Compact | def ×0.93/1.00/1.07 |
| `counter_press_duration` | None/Short/Long | rewin 0.00/0.06/0.12 |
| `break_speed` | Slow/Medium/Fast | breakaway 0.00/0.00/0.10 |

### 1.4 Diablo-tactic risk assessment

**Verdict: No game-breaking diablo tactic found, but one borderline combo exists.**

| Combo | Why it works | Risk |
|---|---|---|
| **Defensive + VeryLow line + Compact shape** | One-sided stacking: def ×1.12 (style) × ×1.07 (shape) = ×1.20 effective def rating in the attacking third, AND opponent shot conversion ×0.85. No corresponding offensive penalty on the opponent. | **Closest to a diablo tactic**. Could produce too many 0-0 / 1-0 results for defensively-organized minnows. |
| Counter + Fast break_speed + Aggressive pressing | Three independent bonuses stacking (×1.18 attack, 10% breakaway skip, ×1.05 possession contest). | High-variance, not strictly dominant. |
| Attacking + Wide width + Short buildup | All three boost chance of reaching the box (×1.12 attack, 0.72 cross prob, ×1.08 buildup). | Susceptible to counter-attacks. |
| HighPress + Aggressive pressing + ManToMan marking | Strong ball-winning but ×1.15 foul rate. | High-variance — high card risk. |

**4-2-3-1 / 4-3-3 / 3-5-2 formation bonus**: NONE. Formation has zero direct effect on ratings.

**Does Attacking always beat Defensive?**: No. The phase modifiers cancel in 1v1 contests.

### 1.5 Upset frequency

The `att_eff / (att_eff + def_eff)` ratio **saturates around 75-85% for extreme mismatches** (90-OVR vs 30-OVR), not 99%. So elite teams win ~75% of matches, not ~95%.

A League Two side beating Man City in a cup tie would happen **~10-20% of the time**, vs ~1-3% in reality. **Upsets are too frequent for extreme mismatches.**

Test evidence: `strong_team_wins_more_often` (`simulation_tests.rs:407-427`) uses 90-OVR vs 30-OVR over 100 trials and only asserts `strong_wins > weak_wins * 2` — allowing the weak team to win up to ~33% of matches.

### 1.6 Player rating model — **CRITICAL BUG (C1)**

```rust
// engine/src/report.rs:45-61
pub struct PlayerMatchStats {
    pub rating: f32,  // Default for f32 is 0.0
    ...
}
```

**`PlayerMatchStats.rating` is NEVER assigned anywhere in the engine or ofm_core code.** Grep for `\.rating\s*=` and `ps\.rating` finds only reads, no writes (except in tests).

The `calculate_match_rating` function exists in `ofm_core/src/media/mod.rs:304-315`:
```rust
pub fn calculate_match_rating(
    performance_score: f32, narrative_weight: f32,
    clutch_factor: f32, context_difficulty: f32,
) -> f32 {
    let rating = (performance_score * 0.60) + (narrative_weight * 0.20)
        + (clutch_factor * 0.10) + (context_difficulty * 0.10);
    rating.clamp(1.0_f32, 10.0_f32)
}
```
…but grep confirms **`calculate_match_rating` is only called in its own unit test** (`media/mod.rs:654,656`). It is **never wired into the post-match pipeline**.

The test `player_ratings_computed_for_active_players` (`simulation_tests.rs:969-985`) only asserts `ps.rating >= 0.0 && ps.rating <= 10.0` — which passes trivially because `0.0` satisfies both bounds. **This is a false-positive test.**

**Result**: every player's `avg_rating` is `0.0` forever. Breaks:
- Season awards ("Player of the Year" picks player with highest avg_rating — all 0.0, picks alphabetically)
- Scouting reports
- Career history UI
- Hall of Fame
- Any AI logic that uses `avg_rating` (e.g. `retirement_chance` at `aging.rs:106-107` uses `avg_rating <= 6.4` for faster retirement — always false since 0.0 ≤ 6.4, so it triggers +8% retirement chance for EVERY player)

Wait — actually `0.0 <= 6.4` is TRUE, so EVERY player gets the +8% "playing poorly" retirement penalty. This means **players retire faster than intended** because of C1. Compounding bug.

### 1.7 Injuries & cards

**Red cards**: Modeled (`engine/fouls.rs:64-101`). Per foul: ~11% card chance; if card awarded, 4% chance of straight red, otherwise yellow. Second yellow → sent off. Sent-off players added to `sent_off: HashSet<String>` and excluded from `snap_player`.

**BUG C6**: `position_attr_avg` (`types.rs:300-306`) and the derived `midfield_rating()` / `effective_midfield()` / `effective_press()` functions **do not filter `sent_off`**. A team with a sent-off midfielder still has the same `midfield_rating` for the possession contest. Red cards don't swing matches realistically — the only impact is `snap_player` has fewer players to pick from.

**Injuries during matches**: BUG C5. The engine emits `EventType::Injury` events at `injury_probability = 0.03` per foul (`engine/fouls.rs:55-59`), but **no `Player.injury` is ever set on the domain player after a club match**. `deplete_match_stamina` (`turn/post_match.rs:825-838`) calls `apply_match_wear` (condition depletion + fitness sharpening) but NOT `roll_match_injury`.

By contrast, `national_team.rs:403-404` calls BOTH:
```rust
crate::player_wear::apply_match_wear(player, 90, rng);
crate::player_wear::roll_match_injury(player, rng);
```

So international call-ups can injure players, but club matches cannot. `roll_match_injury` uses base risk 1/40 per match (scaled 0.7×–3.0× by fitness) — a reasonable rate, just never invoked for club games.

### 1.8 Sparse vs Live sim consistency — BUG C10/C11

Three simulation paths exist:

| Path | Engine | Used for | Team construction |
|---|---|---|---|
| **Live** | `LiveMatchState` | User matches (Live/Spectator/Instant modes) | `build_team_with_bench` — starting XI in `team.players`, bench separate |
| **Simple** | `engine::simulate` | AI-vs-AI league matches | `build_engine_team` — **entire squad** in `team.players` |
| **Poisson** | `national_team::simulate_scoreline` | Catch-up, dormant leagues, national teams | `club_strength` (top-11 OVR average) |

Key inconsistency: A user-managed team plays with starting XI only; AI-vs-AI matches use the full squad. A deep squad (strong bench) gets an **unfair boost** in AI-vs-AI because `snap_player` can pick fresh bench players mid-match (no substitution logic — just random selection from the whole squad).

No formal consistency test exists between Live and Simple scorelines for the same fixture.

### 1.9 Match engine TODOs

No `TODO` / `FIXME` / `HACK` comments in the engine crate. The match engine is the cleanest part of the codebase.

---

## 2. Transfer AI & Manager AI

### 2.1 Transfer valuation formula

**Market value** — set once at worldgen, **frozen for life** (BUG C7):

```rust
// generator/generation.rs:287-288
let age_factor = if age <= 23 { 1.5 } else if age <= 28 { 1.2 } else if age <= 32 { 0.8 } else { 0.4 };
let base_value = (approx_ovr as f64).powi(2) * 500.0;
let market_value = (base_value * age_factor) as u64;
```

A 75-OVR 22-year-old ≈ £4.2M. A 90-OVR 25-year-old ≈ £4.86M.

`refresh_player_derived` (player_rating.rs:42-67) recomputes `ovr`, `potential`, `traits` — but **never `market_value`**. `apply_seasonal_aging` doesn't touch it. `end_of_season.rs` doesn't touch it. `regen/mod.rs:138` calls `refresh_player_derived` after overriding potential/attributes but leaves `market_value` at the youth-template value.

**Result**: a player's market value is a static snapshot from generation. A wonderkid who develops from OVR 60 → OVR 85 keeps a £1-2M valuation forever. A 33-year-old in steep decline keeps his £8M valuation forever.

**Asking price** (selling club minimum) — `minimum_acceptable_fee` (`transfers.rs:349-388`):

```rust
let mut multiplier: f64 = if player.transfer_listed { 0.8 } else { 1.2 };
if days_remaining <= 60  { multiplier -= 0.25; }
else if days_remaining <= 180 { multiplier -= 0.15; }
else if days_remaining <= 365 { multiplier -= 0.05; }
// importance: Key +0.20, Regular +0.10, Fringe +0.00
// morale <= 40: -0.05
// openness >= 60: -0.20 ; >= 40: -0.10
let multiplier = multiplier.clamp(0.55, 1.6);
```

Range: **0.55 × MV** (desperate) → **1.6 × MV** (reluctant Key player on long deal).

**Incoming offer** (buyer's opening bid) — `suggested_incoming_fee` (`transfers.rs:568-587`):

```rust
let mut multiplier: f64 = if player.transfer_listed { 0.9 } else { 1.0 };
if days_remaining <= 60 { multiplier -= 0.15; }
else if days_remaining <= 180 { multiplier -= 0.10; }
if player.morale <= 45 { multiplier -= 0.05; }
let multiplier = multiplier.clamp(0.7, 1.05);
```

Range: **0.7 × → 1.05 × MV**. Buyer never opens above 1.05 × MV — even for an in-demand star. Real-world premiums for star players routinely hit 3-5 × MV (Grealish, Antony, Mudryk).

### 2.2 AI bidding behavior

Daily entry point: `evaluate_transfer_market` (`transfers.rs:873-1068`). Gated by transfer window check.

**Shortlist construction** (`transfers.rs:923-959`): Every player scored by `incoming_interest_score` (`transfers.rs:449-479`):

| Signal | Points |
|---|---|
| `transfer_listed` | +30 |
| contract ≤ 60 d | +40 |
| contract ≤ 180 d | +25 |
| contract ≤ 365 d | +10 |
| `market_value ≥ 1 M` | +20 |
| `market_value ≥ 500 K` | +10 |
| `morale ≤ 45` | +10 |
| award-leaderboard bonus | +25 |

Players scoring `< 35` dropped. Buyer takes the first eligible target from the score-sorted shortlist.

**For AI-to-AI execution**: requires `candidate.score > 60` AND reputation deficit ≤ 150 AND position-group depth < 8. So AI-to-AI transfers only fire when at least one of these is true:
- the player is transfer-listed
- the contract is inside its last year
- the player made an award leaderboard

**AI clubs essentially never pry a happy star from a rival.** They shop the distressed-asset pile.

**Daily caps**: `MAX_NEW_INCOMING_OFFERS_PER_USER_PLAYER_PER_DAY = 1`, `MAX_NEW_INCOMING_USER_OFFERS_PER_DAY = 3`, `max_ai_transfers_for_reputation` returns 4 (rep ≥ 800), 3 (≥ 600), 2 (≥ 400), 1 (otherwise).

### 2.3 Silly transfer risk

| Scenario | Possible? | Why |
|---|---|---|
| Star GK moves to a club that already has 3 GKs | **Yes** | `POSITION_GROUP_SURPLUS_THRESHOLD = 8` (`transfers.rs:44`) is uniform across groups. GK should be ~3-4. |
| Man City signs a League Two striker for £200M | **User: yes. AI: no.** | AI bid ≤ 1.05 × MV. User has no upper-bound sanity check (`make_transfer_bid` `transfers.rs:1590-1822`). |
| Youth player moves for £50M | **User: yes. AI: no.** | Same reason. |
| Star player holds out for bigger club | **No** | No "I want to wait" mechanic. Star renews if happy, stalls if unhappy. |
| Wage-budget check on AI buys | **Missing** | AI only checks `transfer_budget` and `finance`, not `wage_budget` (`transfers.rs:1026-1027`). |
| "Would this player start" filter | **Missing** | A club will sign a striker even if it has 4 better strikers already, as long as depth check passes. |
| `starting_xi_ids` re-sync after transfers | **Missing** | Set at worldgen, never re-synced. `infer_player_importance` (`transfers.rs:334-347`) mis-classifies regens who became real starters as "Fringe", under-pricing them. |

### 2.4 Manager movement

**Firing triggers** (`firing.rs:6-8`):
```rust
const WARN_THRESHOLD: u8 = 25;
const FINAL_WARN_THRESHOLD: u8 = 18;
const FIRE_THRESHOLD: u8 = 10;
```

Satisfaction recomputed daily from last-5 form (`ai_hiring.rs:72-91`):
```rust
W → +8 ; D → +1 ; L → -12 ; base = 50
4 straight losses → additional -12
recent loss to user (last 14 days) → -10
```

5 straight losses: `50 - 60 - 12 = -22 → clamp(0)` → Warning. Day 2 with same form: clamp(0) → Fire. **A 5-game losing streak = sacked within ~2 days.**

**Estimated churn**: ~3-6 sackings/EPL-season. Real-world EPL averages ~10/season. In the right ballpark but slightly low. Two structural problems:
- **No reputation filter** — relegation-battler losing 4 in a row is as likely to be sacked as a top-4 club.
- **No new-manager grace period** — replacement starts at satisfaction=50, can be sacked immediately by one bad 4-loss streak.

**AI managers never move between clubs** (BUG — significant realism gap). The `job_offers` module is entirely user-facing. There is no `ai_apply_for_job` or `ai_headhunt`. Every AI sacking produces a brand-new internal promotion (AssistantManager → Manager), not a job-swap. In 10 seasons you'll never see an elite club poach another club's in-form manager.

Fired AI managers are marked `manager.team_id = None` and `manager.fire(today)`, sitting in `game.managers` indefinitely with no team, never rehired. The pool grows monotonically.

### 2.5 Manager personality impact — BUG C12

The `Manager` struct (`domain/src/manager.rs:8-35`) contains **no personality fields**. It has: `id`, names, DOB, nationality, `reputation: u32`, `satisfaction: u8`, `fan_approval: u8`, `team_id`, `warning_stage`, `career_stats`, `career_history`. No `ambition`, `pragmatism`, `transfer_aggression`, or Big-Five profile.

**What "personality" exists**:
1. **Match-engine personality** (engine/src/ai.rs:10-42): `AiPersonality` enum (`Pragmatist`, `Visionary`, `Reactive`) derived at match-start from team reputation + manager career stats (`live_match_manager.rs:331-351`):
   ```rust
   if rep >= 700 && total_matches >= 50 { Visionary }
   else if total_matches >= 20 && win_rate >= 0.55 { Reactive }
   else if rep >= 800 { Visionary }
   else { Pragmatist }
   ```
   Effects: `Reactive` → 1.5× base sub chance after score-diff change; `Visionary` → bolder tactical changes in last 30 min when losing/winning.
2. **Player Big-Five personality** (NOT manager) wired into training in commit `8961c17` Phase 6: `personality_growth_mod()` (training/development.rs:43-48).

**Verdict**: Manager personality is *mostly cosmetic* — the only meaningful signal is the live-match derived archetype, computed from reputation + W/L record, not from any stored attribute.

The summary mentioned "P1-6 wired manager personality into training" — that commit references **player** personality (Big Five), not manager. Manager has zero effect on training in the current code.

### 2.6 Contract renewals

User-side `evaluate_renewal_offer` (`contracts.rs:221-335`): rejects insulting offers, accepts if wage ≥ expected_wage AND years ≥ expected_years, otherwise counters. Expected wage formula is reasonable — scales with age, morale, importance, team reputation, contract runway.

**AI-club renewals: NONE EXIST.** Searched for `auto_renew`, `ai_renew`, `ai_offer_renewal` — nothing. AI clubs never renew any contract. Every AI player eventually walks on a free.

### 2.7 Free agents & released players — BUG C4

`process_contract_expiries` runs daily (`turn/mod.rs:167, 222`). Releases players with expired contracts to free agency. Player stays in `game.players` indefinitely.

**AI clubs never sign free agents.** `evaluate_transfer_market` builds its shortlist only from players with `Some(owner_team_id)` (`transfers.rs:925`):
```rust
let Some(owner_team_id) = player.team_id.as_deref() else { continue; };
```

There is no AI equivalent of `offer_free_agent_contract`. Free agents are invisible to the AI market. Only the user can sign them.

### 2.8 Loan market

`seed_opening_ai_loan_market` (`transfers.rs:118-195`) is invoked once at career start. It loan-lists up to 2 non-starter, non-transfer-listed, contract-runway ≥ 90d players per AI club. **This is one-time setup**, not periodic maintenance.

Daily loan offer generation: `create_incoming_user_loan_offer_if_any` targets **user-owned loan-listed players** only. AI-to-AI loans don't exist.

**After the opening seed is exhausted (loans complete, players returned), the AI loan pool is empty forever unless the user creates it.**

### 2.9 Transfer windows — BUG (no January window)

`TRANSFER_WINDOW_PRESEASON_DAYS = 30`, `TRANSFER_WINDOW_POST_START_DAYS = 30` (`season_context.rs:7-8`). A **single 60-day window per season** — no mid-season (January) window.

Transfers are window-restricted for both user and AI. The user can submit a bid during a closed window — it becomes a `PendingRegistration` that fires when the window opens.

Dormant-league transfers: `evaluate_transfer_market` filters buyers to `active_team_ids` (`transfers.rs:896-907`) — only clubs in the user's currently-simulated competition shop the market. Dormant competitions (other leagues) get scoreline-only fixture resolution with **no market activity**.

---

## 3. Regen / Youth / Player Progression

### 3.1 Youth intake model

**Count per club per season**: 3-5 academy prospects (`regen/mod.rs:145-200` `generate_academy_intake_regens`).

**Position distribution** — hard-coded (`regen/mod.rs:157-163`):

| Count | Positions |
|---|---|
| 3 | GK, DEF, MID |
| 4 | GK, DEF, MID, FWD |
| 5 | GK, DEF, DEF, MID, FWD |

**BUG**: Every club gets exactly 1 GK per season. Over 10 seasons that's 10 GKs per club — far too many. GKs have 15-20 year careers; a club only needs ~3 on the books. Permanent GK surplus.

**Starting OVR**: Attributes set `potential − spread`, spread 10-18 for academy intake, 8-15 for replacement regens. So academy intake starts roughly **OVR 30-55**. Wonderkid roll (10% chance, `regen/mod.rs:58-62`) can push potential into 85-92.

**Potential bands** (`regen/mod.rs:24-33`):
- GK: 50-85
- DEF: 45-88
- MID: 45-90
- FWD: 45-92

**Names**: realistic, nationality-aware. 60/40 split (`generator/generation.rs:51-65`) — 60% chance newgen takes team's country, 40% from 17 bundled pools (ENG, SCO, WAL, NIR, IE, GB, ES, DE, FR, IT, NL, PT, BR, AR, BE, HR, SE).

### 3.2 Academy reputation effect — BUG C8

```rust
// regen/mod.rs:37-47
fn reputation_bias(team_reputation: u32) -> i8 {
    if team_reputation >= 80 { 5 }
    else if team_reputation >= 65 { 3 }
    else if team_reputation >= 50 { 1 }
    else { 0 }
}
```

But **team reputation is on a 0-1000 scale** (`reputation.rs:9`). The weakest possible team (reputation 100, `job_offers.rs:1281`) still passes the `>= 80` check and gets the **+5 max bias**. Real Madrid (reputation 900) gets the same +5.

**Big clubs do NOT produce better newgens than small clubs.** A League Two club can roll a 92-potential wonderkid just as easily as Real Madrid.

Same bug affects `contracts.rs:1043` `if team.reputation < 40` (small-club wage premium) — never fires.

### 3.3 Player progression formula

Two systems stack: **daily training** (`training.rs` + `training/development.rs`) and **annual aging** (`aging.rs`).

**Daily training gain** (`training.rs:300-307`):
```rust
let gain = 0.15
    * intensity_mult        // Low=0.5, Medium=1.0, High=1.5
    * age_factor            // ≤21=1.5, ≤25=1.2, ≤29=1.0, ≤33=0.6, else=0.3
    * plan.bonus.coaching_mult       // 0.85-1.35 (staff coaching quality)
    * plan.bonus.specialization_mult // 1.0 or 1.25 (specialist coach matches focus)
    * plateau_factor       // 1.0 / 0.8 / 0.6 / 0.4 near ceiling
    * personality_mod      // 0.675-1.375 (C × O)
    * position_bonus;      // 0.80-1.30
```

`gain` is a **probability per session per attribute**, not a guaranteed increment. Each `try_gain` rolls `rng < gain`.

**Hard ceiling**: `if player.potential > player.ovr { apply_focus_gains(...) }`. Once `ovr == potential`, no attribute gains whatsoever.

**Annual aging curve** (`aging.rs:30-88`):
- Age < 30: no pace loss; small technical growth (0-1 per year on passing/vision/decisions/composure).
- Age ≥ 30: veteran_pace_loss = 1-3 points/year.
- Age ≥ 33: fitness penalty (-1/season at 33-35, -2/season at 36+) + stability shift.
- Technical growth stops at age 32.

**Peak age**: Physical ~29, Technical ~32, Practical OVR ~28-30. Decline rate after 30: ~1-2 OVR/year.

Per-season estimate: 17-y-o wonderkid (potential 90, OVR ~50) can reach ~75-80 by age 24 (+3-4 OVR/year peak), plateau around 26-28, drift down 1-2 OVR/year after 30. Realistic.

### 3.4 Regen vs newgen strategy

**Both**, with different roles:

1. **Replacement regens** (1:1 for retirements) — `generate_season_regens` (`regen/mod.rs:339-420`). Position-band regens (NOT attribute-cloned). Retiring player's *position group* preserved, potential rolled fresh from band.
2. **Academy intake** (always fresh newgens) — `generate_academy_intake` (`regen/mod.rs:423-461`). 3-5 fresh newgens per team per season regardless of retirements.

### 3.5 World sustainability — BUG C9

**Critical**: retired players are never removed from `game.players`. `retire_player` (`aging.rs:144-154`) only sets `retired = true`; the player stays in the array. No `players.retain(|p| !p.retired)` anywhere in the codebase.

Per-season net growth = retirements × 1 (replacement regens) + teams × 3-5 (academy intake) − 0 (no removals).

For shipped `gaffer_world.json` (114 teams, ~3,376 players):
- Academy intake alone: 114 × 4 (avg) = **~456 new players per season**
- Plus replacement regens: ~50-100/season
- **Over 10 seasons: ~5,000-5,500 extra players**, growing world from ~3,376 to ~8,500-9,000.

Save files balloon. Every daily training pass, every match squad build, every transfer scan iterates the full list. Performance degrades.

### 3.6 Staff retirement — BUG C13

**There is no staff retirement.** Staff are immortal. The `Staff` struct has `date_of_birth` and `contract_end` but no aging/retirement/contract-expiry logic exists. The pool grows monotonically.

Retired *players* are converted to unemployed manager + scout candidates (`end_of_season.rs:1297-1403`). Reputation 200-900 based on `OVR × 6 + career_len × 30`. Top players (OVR 85, 15-season career) become 200 + 510 + 450 = 1160 → clamped to 900 reputation managers. Reasonable.

### 3.7 Player retirement

Pure probabilistic, age-based with modifiers (`aging.rs:98-132`):

| Age | Base chance |
|---|---|
| 33 | 12% |
| 34 | 24% |
| 35 | 42% |
| 36 | 60% |
| 37 | 78% |
| 38+ | 100% (forced) |

Modifiers: no contract +18%, free agent +10%, few appearances +8%, low rating +8% (but see Bug C1 — `avg_rating` is always 0.0 ≤ 6.4, so EVERY player gets this +8% penalty), high rating -10%, OVR ≥ 80 -15%.

Roll seeded deterministically by `player_id + season + "retirement-roll"` — reloads reproduce retirements.

**BUG cascade from C1**: `aging.rs:106` checks `if player.stats.avg_rating <= 6.4 { chance += 8; }`. Since `avg_rating` is always 0.0 (Bug C1), this fires for EVERY player, meaning **every player gets +8% retirement penalty**. Players retire faster than the design intended. By season 5-6, you'll see more retirements than the base curve would suggest.

### 3.8 Training effect (and the "V99.7-6" question)

The "V99.7-6 wired manager personality into training" reference in the conversation summary doesn't match the codebase. Searched for `V99.7-6`, `V99.7`, `99.7-6`, `99.7`, `manager.*personality.*training` — **no such reference exists** anywhere in the repository or git history. The `Manager` struct has no personality field at all.

The closest match: **commit `8961c17` Phase 6 Training Overhaul** wired **player** personality (Big Five) into training via `personality_growth_mod()` (`training/development.rs:43-48`). This is documented in `docs/gaffer/PHASE_6_TRAINING.md`.

Phase 6 wiring is real and functional. Manager personality is not in the training loop.

### 3.9 Injury impact on decline

**Injury pool is shallow** (`player_wear.rs:12-18`): just 5 minor soft-tissue injuries (minor muscle strain, twisted ankle, knee bruise, hamstring tightness, calf strain), 3-21 days. No broken leg, no ACL tear, no career-threatening injury, no recurring/chronic injury.

**No long-term attribute impact from injuries.** While injured, player gets half base recovery and loses 1 fitness/day. After recovery, no permanent penalty, no chronic issue flag, no re-injury risk elevation.

A goalkeeper who picks up 5 hamstring injuries in a season has identical long-term decline to one who never gets hurt.

---

## 4. News & Commentary Variety

### 4.1 News template count

**98 string keys** in `src/i18n/locales/en.json` under `be.news.*`, across 18 categories:

| Category | Headline variants | Body variants |
|---|---|---|
| matchReport (homeWin/awayWin/draw) | 9 (3×3) | 6 (3 body × 2 scorer/noScorer) |
| roundup | 3 | 1 + result lines |
| standings | 3 | 1 + entry lines |
| seasonPreview | 3 | 1 |
| managerialChange | 1 | 1 |
| managerialAppointment | 1 | 1 |
| majorTransfer | 1 | 1 |
| loanMove | 1 | 1 |
| transferRoundup | 1 | 1 + deal lines |
| worldCupQualifying | 1 | 1 |
| worldCupPlayoff | 1 | 1 |
| worldCupPlayoffDraw | 1 | 1 |
| worldCupKickoff | 1 | 1 |
| worldCupChampion | 1 | 1 |
| seasonAwards | 1 | 3 (bodyBoth/bodyGoldenBootOnly/bodyPotyOnly) |
| weeklyDigest | 1 | 2 (with/without top scorer) |
| preseasonDigest | 1 | 2 (with/without results) |
| transferRumour | 3 | 1 |
| injuryNews | 2-3 (short vs long) | 1 |

### 4.2 News triggers

`turn/news.rs` has 7 news-generation entry points:
1. `generate_matchday_news` (`turn/news.rs:724`) — fires after matches complete. Generates `league_roundup_article` + `standings_update_article` + `match_report` per fixture.
2. `generate_preseason_digest_news` (`turn/news.rs:600`) — weekly during preseason.
3. `weekly_storyline_articles` (`turn/news.rs:189`) — title race, unbeaten streak.
4. `weekly_rumour_articles` (`turn/news.rs:305`) — transfer rumours based on player distress signals.
5. `weekly_transfer_roundup_article` (`turn/news.rs:527`) — completed transfers in past 7 days.
6. `season_awards_article` (`news.rs:409`) — end-of-season.
7. `managerial_appointment_article` (`news.rs:301`) — on AI hiring.

**Daily cap**: `MAX_DAILY_WORLD_NEWS_ARTICLES = 5` (`turn/news.rs:11`). Non-match news capped at 5/day, prioritized by `world_news_priority`.

### 4.3 Commentary variety

**163 templates** across 30 event types in `match.commentary.*`:

| Event | Templates |
|---|---|
| goal | 15 (3 base × 5 variants: normal/opener/equaliser/hattrick/brace) |
| goalOpener / goalEqualiser / goalHattrick / goalBrace | 5 each |
| goalConceded | 6 |
| save / miss / tackle / card | 5-6 each |
| halfTime / fullTime / substitution / penalty / penaltyMissed / injury | 4-6 each |
| passCompleted / passIntercepted / dribble / dribbleTackled / cross / interception / clearance / corner / freeKick / goalKick / shootoutGoal / shootoutMiss / headerWon / headerLost / offside | 5 each |

Commentary is parameterized with `{{player}}`, `{{team}}`, `{{minute}}`, `{{opponent}}` tokens. Picks variant by `hash % values.length` for deterministic-per-event selection.

### 4.4 V99.7-9 news headline variants

The conversation summary mentioned "V99.7-9 added 6 news headline variants". The codebase has the variants already in place (3 each for roundup/standings/seasonPreview = 9 total), but I couldn't find a specific commit named "V99.7-9" in `git log`. The variants exist in the locale file and are referenced by `rng.random_range(0..3)` in `news.rs`.

### 4.5 Projected variety after 10 seasons

Over 10 EPL seasons: ~3,800 league matches + ~400 cup matches + ~150 preseason + ~520 weekly digests + ~200 transfer-related + ~50 storyline + ~10 awards + ~30 managerial changes ≈ **~5,000-6,000 news articles**.

With 98 template keys and parameterized player/team/score substitution, **repetition will be noticeable but not overwhelming**. The match-report category alone has 27 unique headline+body combinations × infinite parameterization. After ~500 matches, you'll start recognizing patterns but the player/team names keep it fresh.

**Could be improved**: only 1 headline for `majorTransfer`, `loanMove`, `managerialAppointment`, `managerialChange`, `worldCupKickoff`, `worldCupChampion`. These high-impact events deserve 3-5 variants each.

### 4.6 Relevance assessment

News stories **DO reference real events** — `matchday_results` (`turn/news.rs:63`) reads from `league.fixtures` for the day, `top_scorer_summary` (`turn/news.rs:176`) reads from `game.players` stats, `rumour_candidates` (`turn/news.rs:251`) reads from player distress signals (low morale, expiring contract, transfer-listed).

The transfer roundup uses real completed transfers from the past 7 days. The standings update uses real current standings. The season-preview uses real team reputations to pick the favourite.

**Notable gap**: no "milestone" news (100th appearance, 50th goal, debut goal for youth academy graduate). No "comeback" news (winning from 2-0 down). No "shock" news (lower-division side beating top flight in cup). These would add color over a 10-season career.

### 4.7 Press conference / punditry

`src/components/match/punditry.ts` (558 lines) has 2 exported functions. `src/components/match/commentary.ts` (208 lines) has 3 exports. Both are template-based with parameterization.

---

## 5. Stats & Career History Persistence

### 5.1 Per-match stats stored

`PlayerMatchStatsRecord` (`domain/src/stats.rs:19-45`) stores per player per match:

| Field | Type |
|---|---|
| fixture_id, season, matchday, date, competition | metadata |
| player_id, team_id, opponent_team_id, home_team_id, away_team_id | IDs |
| home_goals, away_goals | u8 |
| minutes_played | u8 |
| goals, assists, shots, shots_on_target | u8 |
| passes_completed, passes_attempted | u8 |
| tackles_won, interceptions, fouls_committed | u8 |
| yellow_cards, red_cards | u8 |
| **rating** | f32 (always 0.0 — Bug C1) |

`TeamMatchStatsRecord` stores per team per match: goals_for/against, possession_pct, shots, shots_on_target, passes, tackles, interceptions, fouls, cards.

`PlayerSeasonStats` (`player.rs:464-480`) aggregates per-season: appearances, goals, assists, clean_sheets, cards, avg_rating (always 0.0), minutes_played, shots, shots_on_target, passes, tackles, interceptions, fouls.

### 5.2 Career events timeline

`PlayerMovementEntry` (`player.rs:504-519`) — appended on every transfer, loan, release:
- date, kind (PermanentTransfer / LoanStart / LoanReturn / LoanToBuy / FreeAgentSigning / Released)
- from_team_id, from_team_name, to_team_id, to_team_name
- fee, loan_end_date

`CareerEntry` (`player.rs:483-490`) — appended at end-of-season (`end_of_season.rs:1054`):
- season, team_id, team_name, appearances, goals, assists

Both are persisted to DB (`player_repo.rs:22, 53` writes `movement_history_json`). V99.6 persistence fix verified — `movement_history` roundtrip test exists (`player_repo.rs:639-669`).

**However**: the conversation summary's claim that V99.6 added `career_events`, `partnerships`, `fame`, `release_clause`, `transfer_request_date`, `low_morale_days` fields to the Player struct is **NOT supported by the code**. Searched for all five names in `src-tauri/crates/domain/src/player.rs` and across all of `src-tauri/crates/` — zero matches. These fields do not exist in the codebase. The summary appears to have been inaccurate about which fields were persisted.

### 5.3 World history archive

`WorldHistoryArchive` (`world_history.rs:4-19`) stores:
- `rivalries: Vec<WorldRivalry>` (team_a_id, team_b_id, intensity, started_season)
- `season_awards: Vec<HistoricalSeasonAwardsRecord>` (golden_boot, assist_king, player_of_year, clean_sheet_king, most_appearances, young_player, manager_of_season)
- `world_cup_champions: Vec<WorldCupChampionRecord>`
- `national_team_ranking: Vec<NationRankingRecord>`
- `world_cup_hosts: Vec<WorldCupHostRecord>`

**Notable gap**: NO past final league tables are stored. After 10 seasons, you cannot view "Serie A final table 2031". The archive has awards and World Cup but not domestic league history.

### 5.4 Persistence cadence

Stats are persisted to DB on every save (full state serialization). Per-match stats are appended to `StatsState.player_matches` and `StatsState.team_matches` in memory during `process_day`, then serialized on save.

**No batching at season end** — every match's stats hit the in-memory array immediately, then the DB on save.

### 5.5 Data loss risks

- **Message cap**: P0-4 caps messages to 100 most recent before sending to frontend (`cap_messages_and_news` in `commands/util.rs` and `commands/game.rs`). Backend keeps full array in memory.
- **News cap**: capped to 200 most recent before frontend.
- **Stats arrays**: no cap. Grow with matches played. After 10 seasons × 380 EPL matches × 22 player records per match ≈ ~83,000 `PlayerMatchStatsRecord` entries. Manageable.
- **Player array bloat** (Bug C9): ~8,500 players after 10 seasons (was ~3,400). Each player has ~30 fields. Memory and serialization cost grows ~2.5x.

### 5.6 10-season UI surface check

**Can a 10-year career be shown?** Partially.
- ✅ `PlayerProfileCareerHistoryCard` can show `career: Vec<CareerEntry>` (per-season stats).
- ✅ `PlayerProfileMovementHistoryCard` can show `movement_history: Vec<PlayerMovementEntry>` (transfers, loans).
- ✅ `PlayerProfileSeasonStatsCard` can show current-season `PlayerSeasonStats`.
- ❌ `avg_rating` always shows 0.0 (Bug C1).
- ❌ No past final league tables viewable (only current season).
- ❌ No "milestone tracker" (debut, 100th appearance, etc.) — though `movement_history` would support this if the UI read it.

---

## 6. Save/Load Integrity

### 6.1 Migration count + latest version

**44 migrations** (`db/src/migrations.rs:4`), latest is `v044_gaffer_game_state.sql`. Migrations are SQL files in `src-tauri/crates/db/src/sql/v001_initial_schema.sql` through `v044_gaffer_game_state.sql`.

### 6.2 v043 + v044 (Gaffer Phase 1-8) migration contents

Both are **no-op markers** — the columns they claim to add are already in `v001_initial_schema.sql` for new saves:

```sql
-- v043_gaffer_player_fields.sql
CREATE TABLE IF NOT EXISTS _gaffer_player_fields_marker (id INTEGER PRIMARY KEY);
DROP TABLE IF EXISTS _gaffer_player_fields_marker;

-- v044_gaffer_game_state.sql
CREATE TABLE IF NOT EXISTS _gaffer_game_state_marker (id INTEGER PRIMARY KEY);
DROP TABLE IF EXISTS _gaffer_game_state_marker;
```

For old pre-Gaffer saves, these would need `ALTER TABLE` statements, but SQLite doesn't support conditional `ALTER`. Since `v001` is always applied first for new saves, these are just placeholders. **Pre-Gaffer saves would actually fail to migrate** because the columns aren't added — but this only affects saves from before the Gaffer fork, which is presumably not a concern.

### 6.3 Per-save DB architecture

Each save has its own `.db` file (per-save SQLite). Migrations applied on open. The `SaveManager` tracks save metadata in a separate index.

### 6.4 DB size projection (10 seasons)

After 10 seasons:
- ~83,000 `PlayerMatchStatsRecord` × ~22 fields × ~50 bytes ≈ ~90 MB
- ~7,600 `TeamMatchStatsRecord` × ~20 fields × ~50 bytes ≈ ~8 MB
- ~5,000 news articles × ~500 bytes ≈ ~2.5 MB
- ~8,500 player records × ~30 fields × ~100 bytes ≈ ~25 MB
- Other tables (staff, managers, competitions, fixtures) ≈ ~10 MB

**Estimated total: ~135 MB after 10 seasons.** Manageable for SQLite but starting to get heavy. Most of the bloat is from `PlayerMatchStatsRecord` (the per-match stats table).

### 6.5 Message/news capping

`cap_messages_and_news` (`commands/game.rs:598-610`):
```rust
const MAX_MESSAGES: usize = 100;
const MAX_NEWS: usize = 200;
```

Backend keeps full arrays in `StateManager`. Frontend gets capped arrays. Frontend can paginate via `get_messages_page` and `get_news_feed` commands.

### 6.6 Forward-migration risks

- **Pre-Gaffer saves** (before commit `8961c17`) would fail to migrate because v043/v044 are no-ops and the actual columns are only in v001 for new saves. **Not a concern for V99.8 users starting new games.**
- **Saves from V99.5 or earlier** that have `movement_history` as empty (before the field existed) would deserialize to `vec![]` thanks to `#[serde(default)]`. Safe.
- **Saves from V99.6+** with the new Gaffer fields should migrate cleanly.

---

## 7. Projected 10-Season Arc — Season by Season

Assuming the user manages an EPL club (e.g. Arsenal) starting in 2026:

### Season 1 (2026-27) — Functional, fun, mostly believable
- EPL fixtures now generate correctly post-V99.8 (`backfill_stub_competition_fixtures`).
- Squad is healthy, world feels alive.
- AI clubs make 1-4 transfers each in the window — realistic distressed-asset shopping.
- News feed shows match reports, roundups, standings updates — good variety.
- **Player ratings all show 0.0** (Bug C1) — first sign something's off.
- Arsenal/Liverpool/Man City battle for title — realistic top 3.
- 3-6 AI managers sacked — realistic.
- **Verdict: 7/10. Fun. Bug C1 is visible but not game-breaking.**

### Season 2 (2027-28) — First cracks
- Some star players at AI clubs enter last year of contract. AI doesn't renew (Bug C3). First Bosman departures hit.
- Free agent pool starts growing (Bug C4 — AI doesn't sign them).
- Wonderkids from Season 1 academy intake have developed +3-5 OVR. Their listed market_value is still the original youth-era value (Bug C7) — they're now bargain-able for ~£2M when they should be £30M.
- Player ratings still 0.0.
- **Verdict: 6/10. Still playable, but the transfer market is starting to feel wrong.**

### Season 3 (2028-29) — Regen contract bug bites (Bug C2)
- First regens generated with `contract_end = "2027-06-30"` are immediately released as free agents (we're now in 2028, contract ended last year).
- Every subsequent season's academy intake (3-5 players/team) AND replacement regens (1 per retirement) are also released on creation.
- AI squads start shrinking. A club that started with 25 players is now at ~20.
- Bug C1 retirement cascade: every player has +8% retirement penalty because `avg_rating = 0.0 ≤ 6.4`. More retirements than designed.
- Player array bloat accelerates (Bug C9).
- **Verdict: 5/10. The world is degrading. You notice AI squads are thinner.**

### Season 4 (2029-30) — Market value desync (Bug C7)
- Wonderkids developed at smaller clubs now have OVR 75-85 but listed value still £1-2M.
- Elite AI clubs (Man City, Real Madrid in dormant leagues — but Real Madrid doesn't even shop since dormant leagues have no market activity, Bug C-section 2.9) snap up developed talent at fire-sale prices.
- Aging 33-year-olds in decline retain peak-era £8-10M valuations, clogging AI rosters at inflated prices.
- **Verdict: 4/10. Transfer market feels broken. You can sign world-class players for £5M.**

### Season 5-6 (2030-32) — AI squads degrade badly
- AI clubs have lost ~5 players/year to regen bug + ~3-5/year to non-renewed contracts = ~40-60 players lost over 5 seasons.
- A club that started with 25 players is now at ~10-15. Some clubs can barely field 11.
- Match engine's `ai_select_starting_xi` (`team_builder.rs:280`) falls back to whatever bodies are available. If a club can't field 11, the engine inserts ghost players.
- Bug C10 (full squad in AI-vs-AI matches) partially masks this — deep squads get unfair boost — but only for clubs that still HAVE deep squads.
- Player array now ~5,500 objects. Save load times noticeably slower.
- **Verdict: 3/10. Most AI clubs are uncompetitive. Title race is between user + 1-2 surviving super-clubs.**

### Season 7-8 (2032-34) — Free agent pool explodes
- Free agent pool contains hundreds of unattached former stars. Bug C4 means they're invisible to AI.
- User can sign literally any free agent for free, any time (no window restriction on free agents).
- AI managers never move between clubs (Bug — no AI lateral moves). Same managers at same clubs for 7+ years unless sacked.
- Player array ~6,500. CPU per day noticeably slower.
- **Verdict: 2/10. The world is hollow. You're essentially playing against zombies.**

### Season 9-10 (2034-36) — Unplayable
- AI squads have 5-10 players. Many can't field 11.
- Free agent pool ~500+ players, including world-class talent.
- Player array ~8,500. Save file ~135 MB. Day advancement takes seconds.
- Player ratings still 0.0.
- The only competitive clubs are the user + maybe 1-2 elite clubs that lucked into academy intake before the regen bug kicked in.
- **Verdict: 1/10. The career is functionally over.**

### Projected league winners (assuming user doesn't dominate)

| Season | Winner | Why |
|---|---|---|
| 1 | Man City | Strongest starting squad |
| 2 | Man City | Still strongest |
| 3 | Man City or Arsenal | Man City starts losing players to regen bug |
| 4 | Arsenal or Liverpool | Man City squad degraded enough to be challenged |
| 5 | User (if competent) | AI squads too weak to compete |
| 6+ | User (always) | AI world has collapsed |

**Realism verdict**: Seasons 1-3 produce believable title races. Seasons 4+ are dominated by the user because the AI world degrades. **Not realistic that the user wins 7+ consecutive titles — that's a symptom of the bug cascade, not skill.**

---

## 8. Recommended Fixes (Priority Order)

### Tier 1 — Critical (blocks 10-season playability)

1. **Fix Bug C1**: Wire `calculate_match_rating` into `apply_player_stats` (`turn/post_match.rs:405-451`). Compute a position-aware rating from `PlayerMatchStats` (goals, assists, tackles, saves for GK) and write it to `ps.rating` before the post-match pipeline reads it. This unblocks all rating-dependent UI/AI AND fixes the retirement-cascade bug.

2. **Fix Bug C2**: In `regen/mod.rs:134` and `:192`, change `format!("{}-06-30", 2024 + 3)` to use the current season year. The `_season: u32` parameter is already passed in but unused — wire it up.

3. **Fix Bug C3**: Implement AI contract renewal in `end_of_season.rs`. Mirror `delegate_renewals` for non-user teams. AI clubs should auto-renew players they want to keep (importance ≥ Regular, age < 33) at the expected wage.

4. **Fix Bug C4**: Extend `evaluate_transfer_market` to include free agents. Treat `team_id = None` as a special case with `fee = 0` (or a small signing-on fee). Add AI free-agent signing logic that targets positions of need.

5. **Fix Bug C5**: Call `roll_match_injury` in `deplete_match_stamina` for players with `minutes_played > 0`. One line addition at `turn/post_match.rs:835`.

6. **Fix Bug C6**: Filter `sent_off` in `position_attr_avg` (`types.rs:300-306`) or in `effective_midfield` / `effective_press`. Requires threading `sent_off: &HashSet<String>` into the rating functions.

7. **Fix Bug C7**: Recompute `market_value` in `refresh_player_derived` (`player_rating.rs:42`) using the same `ovr^2 × 500 × age_factor` formula. This ensures values stay in sync with ability.

### Tier 2 — High (improves realism significantly)

8. **Fix Bug C8**: Change `regen/mod.rs:reputation_bias()` thresholds to use the 0-1000 scale (e.g. `>= 800, >= 650, >= 500, >= 350`) — or normalize team reputation to 0-100 at the call site.

9. **Fix Bug C9**: Add `game.players.retain(|p| !p.retired)` at end-of-season in `end_of_season.rs`. Alternatively, prune retired players older than N seasons.

10. **Fix Bug C10**: Refactor `build_engine_team` (`turn/mod.rs:367-444`) to use `build_team_with_bench` (or a shared helper) so AI-vs-AI matches use the starting XI, matching the live engine.

11. **Fix Bug C12**: Add `personality: ManagerPersonality` field to `Manager` struct. Wire it into transfer aggression (how often AI bids), training focus preference, and contract renewal willingness.

12. **Add AI manager lateral moves**: Implement `ai_apply_for_job` and `ai_headhunt` so sacked AI managers can be rehired by other clubs, and elite clubs can poach in-form managers from smaller clubs.

13. **Add January transfer window**: Currently only one 60-day pre/early-season window. Real football has two windows.

14. **Add per-position surplus threshold**: GK=3, DEF=8, MID=8, FWD=6 instead of uniform 8 (`transfers.rs:44`).

15. **Refresh `team.wage_budget` at end_of_season** as a percentage of finance, matching `transfer_budget`.

16. **Re-run `seed_opening_ai_loan_market` annually** (or have AI clubs loan-list surplus non-starters each pre-season) so the loan market doesn't go inert after one season.

### Tier 3 — Medium (polish)

17. **Add past final league tables to `WorldHistoryArchive`** so users can view historical standings.
18. **Add milestone news** (100th appearance, 50th goal, debut goal for academy graduate).
19. **Add comeback/shock news** (winning from 2-0 down, lower-division side beating top flight).
20. **Vary academy GK count** (0-1 GK per intake, weighted by current GK depth).
21. **Add career-threatening injury pool** (ACL, broken leg) with permanent attribute penalty and re-injury risk.
22. **Tighten `average_goals_realistic` test** to assert `1.5 < avg < 4.0` and add a live-vs-simple consistency test.
23. **Add new-manager grace period** (e.g. 30 days where satisfaction can't drop below 30).
24. **Fix shootout GK skill** at `live_match/penalty.rs:29` — change `gk.shot_stopping + gk.shot_stopping` to `gk.shot_stopping + gk.commanding`.
25. **Delete `sparse_sim.rs`** (dead code, Bug C14).
26. **Add `youth` facility to `Facilities`** struct so academy quality is player-investable.

### Tier 4 — Low (cosmetic)

27. **Update `docs/MATCH_SIMULATION.md`** with actual `MatchConfig` defaults (currently stale).
28. **Remove `distribution` attribute** from `PlayerData` since the engine never reads it (or wire it into GK buildup).
29. **Remove dead `defense_rating()`, `attack_rating()`, `goalkeeper_rating()`** from `engine/src/types.rs:309-346`.
30. **Add staff retirement logic** (Bug C13) — age-based with role-appropriate cutoffs.

---

## 9. Final Verdict

### Is the game fun?

**Seasons 1-3: Yes, genuinely fun.** The match engine is solid, the tactical dials feel meaningful, the news feed has variety, the UI (post-V99.8) is starting to look like a real football manager game. There's enough realism in the simulation to make squad-building satisfying.

**Seasons 4+: No, the bugs compound and the world degrades.** By season 5, you're signing world-class players for £2M because their market value is frozen. By season 7, AI squads are too thin to compete. By season 10, the career is functionally over.

### Are systems explained or working well enough?

- ✅ Match engine: well-designed, modestly tuned, no diablo tactics.
- ✅ Tactical dials: 9 multipliers with sensible magnitudes.
- ✅ Aging curve: realistic peak and decline.
- ✅ Training: probabilistic but functional.
- ✅ News: good variety, real events.
- ✅ Save/load: mature migration system.
- ❌ Transfer market: structurally broken over 10 seasons (no AI renewals, no AI free-agent signings, frozen market values).
- ❌ Regen system: contract_end bug dooms every newgen from season 4+.
- ❌ Player ratings: always 0.0 (Bug C1).
- ❌ Manager AI: no lateral moves, mostly cosmetic personality.
- ❌ Injury system: club matches don't apply injuries.

### Game world persistence OK?

**Yes for saves 1-3 seasons old.** The 44-migration system is mature, per-save DBs work, world_history archive stores awards and World Cup champions.

**No for 10-season saves.** Player array bloat (Bug C9) makes saves ~135 MB and slow. Free agent pool explodes (Bug C4). Past league tables aren't stored.

### Bottom line

**The codebase has the bones of a great football manager game.** The match engine is the strongest part — sound design, sensible constants, no game-breaking exploits. The tactical system is well-tuned. The news and commentary variety is solid.

**But the 10-season horizon is not currently playable to a satisfying conclusion** due to the bug cascade (C1 → C2 → C3 → C4 → C7). Fixing the Tier 1 critical bugs (estimated 2-3 days of work) would transform the experience. Without those fixes, the career degrades into a hollow shell by season 5-7.

**Recommended path forward**: Implement Tier 1 fixes (Bugs C1-C7) before any further UI or feature work. These are the structural foundations. Once they're in, the 10-season career becomes believable and the game becomes genuinely recommendable.

---

*Report compiled from forensic code analysis at commit `b08478a` (V99.8). All file:line references are clickable pointers to the actual source. Methodology: 4 parallel subagents analyzed match engine, transfer/manager AI, regen/youth/progression, and news/persistence subsystems; their findings were cross-verified against direct code reads. An actual interactive 10-season sim was not runnable (Tauri desktop app, no headless runner) but every constant, formula, and code path cited above is real and reproducible.*
