# Gaffer — Player Images Strategy

**Status:** Proposal / decision brief
**Owner:** Gaffer design + engineering
**Last updated:** this turn
**Scope:** player portraits, regen faces, manager avatar, team crests, kits, stadiums

---

## TL;DR (read this first)

1. **Gaffer already ships with a working procedural portrait pipeline** —
   `src-tauri/src/commands/portraits.rs` renders 384×384 transparent WebP images
   by sampling one of 11 bundled chroma "source" heads and applying a deterministic
   per-player recipe (shirt colour, hair colour, skin warmth, head geometry,
   beard). Output is cached atomically under `app_data_dir/generated-player-portraits/`
   and prewarmed in batches via `prewarm_player_portraits`. The frontend
   (`PlayerAvatar.tsx`) already has the fallback chain
   `media.face → runtime portrait → initials avatar`.

2. **The current pipeline is the right primary approach** but it has three
   known weaknesses: (a) only **male-presenting** source heads are wired up
   (the test `loads_only_male_eligible_sources` explicitly excludes
   `chroma-03-northern-european` and there are no female/staff sources),
   (b) **variety is bounded by 11 sources × ~8 shirts × ~6 hair colours × continuous
   geometry parameters** — fine for "I don't see the same face twice in a
   squad", weak for "I never see the same face across 10 seasons", and
   (c) the chroma sources are **static assets** so adding diversity means
   shipping more bytes.

3. **Recommended primary path**: keep and extend the in-house Rust pipeline.
   Add 6–10 more source heads (covering women staff, more age/skin/hair
   variety), expand the recipe alphabet (glasses, headband, kit collar
   variants), and add a **second-layer "regen surprise" recipe slot** that
   can flip a rare trait (vitiligo patch, distinctive hair colour, scar) so
   that long-term regen faces stay memorable without bloating the source set.

4. **Recommended fallback path (for users who want photorealism)**: ship a
   **modding hook only** — a `media.face` path override driven by community
   face packs installed under `app_data_dir/face-packs/`, exactly the way
   Football Manager's *SortItOutSI Cut-Out Megapack* works. Gaffer itself
   ships zero real photos. This sidesteps FIFPro / league / player image-rights
   licensing entirely (legal risk = 1/5) while leaving room for the community
   to do what every football manager community already does.

5. **Explicitly reject**: (a) bundling real player photos, (b) running
   Stable Diffusion at runtime inside Tauri (bundle size + perf), and
   (c) paying generated.photos for a 10k-image bulk download as the *primary*
   strategy (acceptable as a one-time source-head authoring tool, never as a
   ship-time dependency).

---

## 1. Context — what is already built

Before evaluating alternatives it is important to know what is in the tree
today, because the recommendation is *evolve the existing pipeline* rather
than *build greenfield*.

### 1.1 Backend: `src-tauri/src/commands/portraits.rs`

- **Bundled source assets**: `src-tauri/assets/portrait-sources/chroma-*.webp`
  (11 files committed, all GPLv3, 384×384, head-and-shoulders chroma-keyed
  silhouettes representing mediterranean / west-african / west-european-bald /
  east-asian / south-asian / latin-american / middle-eastern / caribbean /
  southeast-asian / indigenous-andean / polynesian). A 12th file
  (`chroma-03-northern-european`) exists in the path naming convention but is
  deliberately excluded — see test
  `loads_only_male_eligible_sources`.
- **Per-player recipe** (`build_recipe`): selects one source deterministically
  from a 64-bit FNV-style hash of `player_id|full_name|match_name|nationality|
  date_of_birth|GENERATOR_VERSION`, then draws from finite alphabets:
  - shirt_rgb: 8 options
  - hair_rgb: 6 options
  - skin_warmth, exposure, contrast: continuous floats in tight ranges
  - head_width, jaw_width, head_height, shift_x: continuous geometry tweaks
  - shirt_strength, hair_strength: continuous blend weights
  - beard_strength: 34% chance of a beard with random opacity, else 0
- **Renderer** (`render_recipe`): pure-Rust pixel loop with bilinear sampling,
  ellipse masks for face/head/beard/moustache regions, per-region colour
  grading. No GPU, no external crates beyond `image` and `webp`.
- **Output**: 384×384 RGBA WebP at quality 88, written atomically
  (temp file + rename) to
  `app_data_dir/generated-player-portraits/runtime-component-recipe-rust-v1/<cache_key>.webp`.
- **Tauri commands**:
  - `generate_player_portrait(request)` → single portrait
  - `prewarm_player_portraits(requests)` → batched prewarm, returns metadata
    only (no image bytes — frontend reads via `convertFileSrc`)
- **Cache key**: FNV hash of `GENERATOR_VERSION:seed:source_id`. Bumping
  `GENERATOR_VERSION` invalidates every cache entry, which is how recipe
  tweaks get shipped.

### 1.2 Frontend

- `src/services/portraitService.ts` — wraps the two Tauri commands, manages
  in-flight request dedupe, exposes `selectManagerSquadPortraitPlayers` and
  `selectBackgroundPortraitPlayers` (next-opponent prioritised, capped at 48
  by default), and a `queueBackgroundPortraitPrewarm` helper that batches 4
  at a time with 150 ms delay.
- `src/components/ui/PlayerAvatar.tsx` — fallback chain
  `media.face → RuntimePortraitFallback → GeneratedAvatar`.
- `src/components/ui/GeneratedAvatar.tsx` — initials-on-coloured-disc SVG
  fallback when runtime portraits are disabled or fail.
- `src/components/ui/GeneratedCrest.tsx` — same idea for **team crests**: 4
  geometric variants derived from a hash of the club name, coloured with the
  club's primary/secondary palette.

### 1.3 Schema

- `players.media_json TEXT DEFAULT '{}'` (migration `v028_entity_media.sql`)
- `teams.media_json TEXT DEFAULT '{}'` (same migration)
- `teams.kit_pattern TEXT DEFAULT 'Solid' CHECK IN
  ('Solid','Stripes','Hoops','HalfAndHalf','Diagonal')` (migration
  `v035_team_kit_pattern.sql`)

So the data model already supports per-entity media paths, and there is a
kit-pattern enum that is not yet visualised anywhere.

### 1.4 What this means for the strategy

The cost of "switch approaches" is high — we'd be throwing away a working
Rust pipeline, a cache, a prewarm scheduler, a frontend fallback chain, and
a modding-friendly schema. The cost of "extend what we have" is low —
adding source heads and recipe parameters is incremental. **This biases the
recommendation strongly toward Approach 3 + Approach 6** (procedural +
hybrid), and that is the right bias.

---

## 2. The problem, restated

| # | Need | Why it matters |
|---|------|----------------|
| 1 | Real-player engagement images | Text-only squads are boring. The user explicitly flagged this. |
| 2 | No real-photo licensing exposure | FIFPro + leagues + individual players all hold image rights. EA pays eight-figure sums for this; Zlatan publicly complained about not being individually paid. We cannot afford that fight. |
| 3 | Regen (procedurally generated youth) faces | Have no real-world photo by definition. |
| 4 | No "repetitive fast" failure mode | A small static placeholder pool breaks immersion once a user spots a duplicate. Need 10k+ distinct images *or* a generator whose space is large enough that collisions are statistically invisible. |
| 5 | Ship-time bundled DB grows over seasons via regens | Runtime generation must be fast enough that generating a youth intake (say 30–60 faces) does not block the UI. |
| 6 | Aesthetic fit | Gaffer wants to feel grounded and serious, not cartoonish. FIFA-style photorealism is out of reach; FIFA-style silhouette-only (FM's default) is too austere. We need a middle ground. |

---

## 3. Approaches evaluated

Each approach is scored on six criteria, 1–5 (1 = worst, 5 = best) unless
noted. "Legal risk" is inverted: 1 = no risk, 5 = high risk.

### 3.1 AI-generated faces (online services)

**Examples**: ThisPersonDoesNotExist (free, single image, no commercial
guarantee), generated.photos (subscription + bulk download), Rose AI,
Synthesia-style vendor APIs.

**Pricing snapshot (verified this turn via web search)**:
- generated.photos: $19.99/mo for 15 downloads, $199/yr; **API plan = 10,000
  photos for $300/month commercial**; bulk-download of the 100k-face library
  is a separate paid tier.
- All vendors explicitly disclaim that "AI-generated faces" carry no
  real-person likeness rights — but they are still photos of *plausible*
  humans, which has its own uncanny-valley problem for a "serious" football
  sim.

**Variety**: effectively unbounded (100k+ in the generated.photos library).

| Criterion | Score | Notes |
|---|---|---|
| Legal risk | 1/5 | Synthetic, model-released, commercial-use licence. The cleanest licensing story of any approach. |
| Variety (10k+) | 5/5 | Library already >100k faces. |
| File size | 3/5 | PNG/JPEG ~30–80 KB each. 10k faces ≈ 400–800 MB bundled. Significant. |
| Runtime cost | 1/5 | Online API call per regen = network dependency, rate limits, latency. Unacceptable for mid-game regen intake. |
| Aesthetic fit | 4/5 | Photorealistic but "stock-photo-y". Risk of looking like a LinkedIn headshot game. |
| Implementation complexity | 2/5 | Need to download, deduplicate, store, and route per-player. Easy in principle, fiddly in practice. |

**Verdict**: Reject as primary. **Consider as a one-time authoring tool for
expanding the chroma source set** (i.e. buy a bulk pack once, hand-curate
6–10 new source heads, ship those curated heads as GPLv3 assets). Never as
a runtime dependency.

---

### 3.2 AI-generated faces (offline, in-process)

**Examples**: Stable Diffusion SDXL Turbo / SD-Turbo / LCM, run via:
- Python sidecar (PyTorch or OpenVINO backend) bundled as a Tauri
  `externalBin` sidecar
- ONNX Runtime + `tract` (Rust) for pure-Rust inference
- Candle (Hugging Face Rust ML framework)

**Speed reality check (verified this turn)**:
- SDXL Turbo on an **A100 GPU**: ~207 ms per 512×512 image, single-step.
  That's 5 images/sec — *fine* for a regen intake, *unusable* for "open the
  squad page and see 25 faces instantly".
- SDXL Turbo / SD-Turbo on **CPU via OpenVINO** (`fastsdcpu` project):
  roughly 2–8 seconds per image depending on CPU. A 30-player youth intake
  would take 1–4 minutes. Not interactive.
- The model file alone for SDXL Turbo is **~2.5 GB** (fp16) or ~6 GB (fp32).
  That would roughly **double the Gaffer installer size**.

| Criterion | Score | Notes |
|---|---|---|
| Legal risk | 2/5 | SDXL Turbo has a custom Stability AI community licence; commercial use OK under thresholds, but redistribution rules and the model's training-data lineage are a soft risk. Cleaner to use it offline than ship its outputs. |
| Variety (10k+) | 5/5 | Effectively infinite. |
| File size | 1/5 | Model alone = 2.5–6 GB. Bundled. |
| Runtime cost | 2/5 GPU / 1/5 CPU | Even on GPU, 200 ms × 25 = 5 s for a squad page. CPU-only is unusable. |
| Aesthetic fit | 4/5 | Photorealistic, but very easy to drift into "AI-face" artifacts (asymmetric earrings, wrong-number-of-fingers-issue applied to ears, blurry backgrounds). |
| Implementation complexity | 1/5 | Hardest option. Python sidecar adds install complexity per-platform (Windows code-signing of a Python blob is painful), or Candle/tract in Rust is still rough for diffusion models. |

**Verdict**: Reject. Bundle size, runtime cost, and cross-platform ML
toolchain pain are all deal-breakers for a desktop app meant to feel small
and fast. **The only acceptable use of offline diffusion is at authoring
time** — generate source heads in-house, curate, ship the curated outputs.

---

### 3.3 Procedural / algorithmic avatars (current approach, broadly)

**Examples**:
- DiceBear (35+ styles, MIT code, per-style artist licences, JS/HTTP API)
- Boring Avatars (React, MIT, geometric gradient blobs)
- Multiavatar (16.7M+ combinations, MIT, SVG)
- Jdenticon (identicon-style, MIT, SVG)
- RoboHash (free, more cartoonish)
- **Gaffer's own** `portraits.rs` pipeline (procedural pixel-level
  re-colouring over real source heads)

**Variety calculation** for Gaffer's current pipeline:
- 11 sources × 8 shirts × 6 hair colours × continuous skin/exposure/contrast
  × continuous geometry × 34% beard ≈ **>10⁶ distinct rendered images**,
  but the *perceptual* variety is much smaller — a user will spot "same
  source, different shirt" within a few hundred faces.

**Variety calculation** for DiceBear "avataaars" style: ~13 traits × 4–8
options each ≈ millions of combinations, but the style is unmistakably
cartoonish.

| Criterion | Score | Notes |
|---|---|---|
| Legal risk | 1/5 | Own code + GPLv3 source assets = no exposure. DiceBear is fine too if you respect per-style licences. |
| Variety (10k+) | 3/5 current / 4/5 extended | Bounded by source count. Extensible by adding sources or recipe alphabet. |
| File size | 5/5 | 11 WebP source files total only a few hundred KB. Generated portraits cached on demand. |
| Runtime cost | 5/5 | Current Rust pipeline renders a 384² WebP in single-digit ms; batch prewarm of 48 faces is imperceptible. |
| Aesthetic fit | 3/5 current / 4/5 extended | Heads-on-chroma recoloured per-player is the "serious but not photoreal" sweet spot. Cartoonish SVG libraries (DiceBear "avataaars", RoboHash) score 1/5 — wrong register for Gaffer. |
| Implementation complexity | 5/5 | Already implemented. Extending is incremental Rust + asset authoring. |

**Verdict**: **This is the primary approach.** The recommendation in §5 is
essentially "double down on this, fix the known gaps".

---

### 3.4 Silhouette / abstract representations

**Examples**:
- Player silhouette + shirt number (Football Manager's default for
  unlicensed players)
- Position icon (GK glove, DF shield, MF compass, FW arrow)
- Flag + name + position chip
- Crest-style shield per player

| Criterion | Score | Notes |
|---|---|---|
| Legal risk | 1/5 | None. |
| Variety (10k+) | 1/5 | By construction — the point is uniformity, not distinctiveness. |
| File size | 5/5 | A handful of SVGs. |
| Runtime cost | 5/5 | Pure SVG, instant. |
| Aesthetic fit | 3/5 | FM's silhouette default is *acceptable* but feels austere; this is what Gaffer is trying to do better than. |
| Implementation complexity | 5/5 | Trivial. |

**Verdict**: Reject as primary (defeats the engagement goal). **Keep as the
final fallback** when the runtime portrait generator fails or is disabled
— which is already what `GeneratedAvatar.tsx` does with initials. Consider
adding a *position-icon* variant for situations where the user wants
maximum austerity (a "tactics board" view).

---

### 3.5 Photo-with-anonymisation (stylised real photos)

**Examples**: take a licensed photo, apply duotone / posterize / edge
detection / silhouette extraction / heavy oil-paint filter so the player is
"unrecognizable but still human".

**Legal reality check**: This is **the most dangerous option**. Image rights
in most jurisdictions protect *identifiability*, not just literal
reproduction. A Brazilian court ruled in 2020 that a stylised
favela-mural-style depiction of a footballer still required consent. German
and French courts have similar precedent for "recognisable likeness even
after transformation". The transformation has to be *so* heavy that the
image no longer resembles the original player — at which point you might as
well have used a procedural source.

| Criterion | Score | Notes |
|---|---|---|
| Legal risk | 4/5 | Transformation is not a safe harbour in most jurisdictions. **If you can still tell who it is, you need their permission.** |
| Variety (10k+) | 5/5 | One per real player. |
| File size | 3/5 | ~30–60 KB per stylised WebP. 10k ≈ 300–600 MB. |
| Runtime cost | 5/5 | Static files. |
| Aesthetic fit | 3/5 | Duotone can look stylish; silhouette extraction looks austere; oil-paint looks gimmicky. Mixed bag. |
| Implementation complexity | 2/5 | You still need source photos with a licence that allows derivative works, which puts you back in §3.1 territory but with worse legal posture. |

**Verdict**: Reject. The legal risk is real and the aesthetic payoff is
marginal over a well-built procedural pipeline.

---

### 3.6 Commissioned art / illustration packs

**Examples**: hire an illustrator to draw N face illustrations in a
consistent style (e.g. the "DF11" face style for Football Manager, which is
hand-drawn digital paintings of real players).

**Cost estimate**:
- Mid-tier illustrator: $80–$250 per face at commercial-buyout rates.
- For 500 faces (a squad-of-squads "lookbook" set): $40k–$125k.
- For 10,000 faces: $800k–$2.5M. Out of reach.

**Variety at realistic budget**: 200–500 hand-drawn faces is achievable.
That gives every *bundled-DB starter squad* a unique face, but regens will
have to reuse. So this is best paired with procedural variety for regens.

| Criterion | Score | Notes |
|---|---|---|
| Legal risk | 1/5 | Illustrated faces are original works. If the illustrator is instructed *not* to depict real players, no exposure. |
| Variety (10k+) | 2/5 | Capped by budget. Realistic N = 200–500. |
| File size | 4/5 | 200–500 illustrations at ~30 KB each = 6–15 MB. Tiny. |
| Runtime cost | 5/5 | Static files. |
| Aesthetic fit | 5/5 | The best aesthetic option if budget allows. Consistent style is a huge win for "grounded and serious". |
| Implementation complexity | 4/5 | Authoring and shipping only — no runtime pipeline changes. |

**Verdict**: **Reject as primary** (budget), but **accept as a stretch
goal**. If Gaffer ever does a paid art commission, the right place to spend
it is on a one-time set of 200–300 "marquee player" illustrations for
bundled star players, with the procedural pipeline filling in the long
tail. This also gives the art team a clear, scoped job.

---

### 3.7 Hybrid approaches (the realistic answer)

The right answer is **always a hybrid**, because each approach has a
different sweet spot:

| Asset class | Best approach | Why |
|---|---|---|
| Bundled real players (ship-time DB, ~10k faces) | Procedural from `portraits.rs` | One-time cost = zero. Runtime = free. Legal = clean. |
| Regen players (mid-game) | Procedural from `portraits.rs` | Already instant; cache makes second-view free. |
| Manager avatar (the user's own face) | Procedural + optional user-supplied photo upload | User owns their own likeness; let them drop a JPG in. |
| Team crests | `GeneratedCrest.tsx` (already built) + optional modded PNG | Same legal logic. |
| Kits | Procedural SVG from `kit_pattern` enum + team colours | Already half-built (the enum exists, no renderer yet). |
| Stadiums | Procedural silhouette skyline + team colours | Not built; low priority. |
| "Marquee" star-player faces (optional stretch) | Commissioned illustration pack (200–300) | Budget permitting. |

---

## 4. Cross-cutting concerns

### 4.1 Team logos

**Same problem class, smaller scope.** Real club crests are trademarked by
the clubs (separate from player image rights — and arguably *more*
aggressively enforced, because clubs have in-house legal teams).

**Recommendation**:
- Keep `GeneratedCrest.tsx` as the default. It's good — 4 variants ×
  arbitrary colours × arbitrary short codes is plenty of variety.
- Add 2–3 more variants (chevron, cross, quartered) to bring the variant
  count to 6–7. Cheap.
- Do **not** bundle real club crests. Same licensing exposure as player
  photos, arguably worse.
- **Do** support community crest packs via the same modding hook as faces
  (see §5.4).

### 4.2 Kit visualisations

The schema already has `kit_pattern IN ('Solid','Stripes','Hoops',
'HalfAndHalf','Diagonal')` and teams already carry primary/secondary
colours. There is no renderer yet.

**Recommendation**: build a small SVG kit renderer in TypeScript (frontend
only — kits are UI sugar, not gameplay state). Pattern:
- 1 SVG template per pattern, parametrised on two colours.
- Render at three sizes: thumbnail (32 px, squad list), medium (96 px,
  tactics board), large (256 px, match preview).
- ~50 lines of code total. Pure presentational.

This is **not** the same problem as player faces — there are no rights in
"two blue stripes on a white shirt". No licensing concern.

### 4.3 Stadium images

Lowest priority. Three options, in increasing order of effort:
1. **Skip entirely**. Most football manager games show stadium *stats*
   (capacity, facilities) not stadium *images*. Gaffer can do the same.
2. **Procedural silhouette skyline**: 4–5 templates (modern bowl, classic
   English terrace, South American caja, etc.) tinted with team colours.
   Cheap, distinctive, no licensing.
3. **Commissioned illustration pack**: 20–30 stadiums. ~$5k. Only if art
   budget exists.

**Recommendation**: option 2 if anyone asks, otherwise option 1.

### 4.4 Manager portraits (the user's avatar)

Different problem from the rest: **the user owns their own likeness**, so
the legal constraint flips.

**Recommendation**:
- Default: use the same `portraits.rs` pipeline with a special "manager"
  source set (or a parametric "older, distinguished" recipe variant).
- Allow the user to **upload a photo** in the manager-creation screen.
  Store under `app_data_dir/manager-avatar.jpg`, referenced from
  `manager_profile.media_json.face`.
- Allow the user to **pick from a gallery** of pre-rendered procedural
  manager portraits (like character creation in an RPG).
- Do **not** offer "upload a real football manager's photo" — that would be
  the user incriminating themselves, and we don't want to be in that loop.

### 4.5 Staff (coaches, scouts, physios)

Currently `portraits.rs` is hard-coded to **male-presenting source heads
only** (per the `loads_only_male_eligible_sources` test). This is wrong for
staff, who may be any gender.

**Recommendation**: add at least 4 female-presenting source heads to the
chroma set, and thread a `gender` (or `presentation`) field through
`PlayerPortraitRequest` so staff portraits select from the appropriate
sub-pool. This is the single most important diversity fix in the pipeline.

---

## 5. Recommendation

### 5.1 Primary approach: extend the in-house Rust procedural pipeline

This is the cheapest, lowest-risk, best-fitting path. Concretely:

#### 5.1.1 Expand the source head set

- Add **6–10 new source heads** to `src-tauri/assets/portrait-sources/`,
  covering:
  - 4 female-presenting heads (mediterranean, west-african, east-asian,
    south-asian)
  - 2 older male heads (50s–60s, for staff and veteran players)
  - 2–4 more variety in the existing male set (a curly-haired north
    european, an east-african, a south-east-asian with facial hair
    baseline)
- All sources must be GPLv3-compatible (re-author in-house, or commission
  from an illustrator, or curate from a generated.photos bulk purchase
  with their commercial licence and re-license under GPLv3 — verify the
  generated.photos TOS permits this *before* paying).
- Each source is 384×384 WebP at quality 90, ~30–60 KB. Adding 10 sources
  = ~500 KB to the installer. Negligible.

#### 5.1.2 Expand the recipe alphabet

Add to `Recipe`:
- `glasses_strength: f32` (0 or 0.4–0.9, ~12% chance) — render with a
  simple two-circle mask
- `headband_strength: f32` (0 or 0.5–0.9, ~5% chance) — recolour the
  hairline band
- `kit_collar: enum { None, V, Round }` — small geometric detail in the
  shirt region
- `hair_length: enum { Short, Medium, Long }` — biases the hair-mask
  region downward for medium/long

This multiplies the perceptual variety by ~5–10× without adding any source
assets.

#### 5.1.3 Add a "regen signature trait" slot

To make regens feel distinctive over a long career:
- With ~8% probability, a regen gets one **signature trait** drawn from:
  distinctive hair colour (bleach blond, bright red, jet black with grey
  streak), vitiligo patch, distinctive beard shape, prominent scar, etc.
- Each trait is a small additional render pass on top of the base recipe.
- The trait is stored in the regen's `media_json` so it is stable across
  saves and re-renders.

This is the antidote to "repetitive fast" — even after 10 seasons, a
manager will recognise a regen they sold three years ago by their
signature trait.

#### 5.1.4 Bump `GENERATOR_VERSION`

Any change to the recipe alphabet or source set bumps
`GENERATOR_VERSION` (currently `runtime-component-recipe-rust-v1` →
`runtime-component-recipe-rust-v2`). This invalidates the entire user-side
cache, so the next launch regenerates everything. **This is by design.**

The prewarm scheduler (`queueBackgroundPortraitPrewarm`) already handles
this gracefully — first launch after a version bump will be slower for
~30 seconds, then settle.

### 5.2 Fallback approach: modding hook for community face packs

This is the legal-risk-free way to give users who *want* real photos the
option to add them:

- Define a directory: `app_data_dir/face-packs/<pack_id>/`.
- Each pack contains a `manifest.json` mapping `player_id → relative image
  path` and an optional `license.txt` declaring the pack author's rights
  assertion.
- `resolveLocalMediaPath()` in `src/lib/mediaAssets.ts` already resolves
  `media.face` against the bundled assets directory; extend it to also
  check `face-packs/<active_pack>/<path>` first.
- Gaffer ships with **zero** real photos. The community maintains packs
  exactly as they do for FM (`SortItOutSI Cut-Out Megapack`).
- Add a Settings UI: "Face packs" → list installed packs, enable/disable,
  reorder priority.
- **Legal posture**: Gaffer does not host, distribute, or endorse any
  real-player image. Modding is a user-side activity. This is the same
  posture FM took until very recently (when Sports Interactive started
  quietly clamping down — see search hit
  `community.sports-interactive.com/forums/topic/500808-licensing-clamp-down-on-graphics`).

### 5.3 Explicitly rejected

- **Bundling real player photos.** Licensing cost is six figures minimum
  (EA pays eight figures for FIFPro + league deals; even tier-2 leagues
  charge meaningfully). Legal risk 5/5. Reject.
- **Running Stable Diffusion at runtime inside Tauri.** Bundle size
  (+2.5 GB minimum), runtime cost (seconds per face on CPU, unusable), and
  cross-platform ML toolchain pain all fail. Reject.
- **Paying generated.photos for a 10k-image bulk download as the *primary*
  image source.** Acceptable as a one-time authoring tool for source-head
  curation; unacceptable as a ship-time dependency (we'd be re-distributing
  their library, TOS-dependent). Reject as primary, accept as authoring
  aid.
- **Stylised real photos (duotone / oil-paint / silhouette).** Legal risk
  4/5 in most jurisdictions. Reject.
- **DiceBear / Boring Avatars / RoboHash** as the player-face system. Wrong
  aesthetic register — Gaffer is not a cartoon game. (These are fine for
  *fallback* UI like initials-in-a-disc, which `GeneratedAvatar.tsx` already
  does inline without a dependency.)

---

## 6. Implementation plan

Ordered by ROI. Each item is sized in engineering-days (ED).

### Phase 1 — Diversity + variety (≈4 ED)

1. **Author 6 new chroma source heads** (4 female, 2 older male). Either
   commissioned (~$1.5k) or curated from a generated.photos bulk purchase
   (verify TOS first). Author at 384×384, transparent background,
   head-and-shoulders framing matching the existing 11. (1 ED engineering +
   external art lead time)
2. **Thread `gender` / `presentation` through `PlayerPortraitRequest`**.
   Select source from the appropriate sub-pool. Update
   `loads_only_male_eligible_sources` test to assert the new counts.
   (0.5 ED)
3. **Expand `Recipe`** with `glasses_strength`, `headband_strength`,
   `kit_collar`, `hair_length`. Update `build_recipe` and
   `apply_recipe_color`. Add unit tests asserting trait frequencies across
   10k seeded recipes. (1.5 ED)
4. **Bump `GENERATOR_VERSION`** to `runtime-component-recipe-rust-v2`.
   Verify cache invalidation path works end-to-end. (0.5 ED)
5. **Update `PlayerAvatar` test fixtures**. (0.5 ED)

### Phase 2 — Regen signature traits (≈3 ED)

1. Define `SignatureTrait` enum + JSON schema in
   `crates/domain/src/player.rs` (or `media_json`).
2. Add trait generation to the regen creator in
   `crates/ofm_core/src/generator/`.
3. Add trait rendering pass to `portraits.rs`.
4. Add frontend display of trait in player profile UI (small chip).

### Phase 3 — Modding hook for community face packs (≈3 ED)

1. Extend `resolveLocalMediaPath()` to consult `face-packs/` directory.
2. Add `face_packs_list`, `face_packs_enable`, `face_packs_reorder` Tauri
   commands.
3. Add Settings UI tab.
4. Document the manifest format in `docs/modding/SCHEMA_REFERENCE.md`.

### Phase 4 — Kits (≈2 ED)

1. New `KitSVG` React component consuming `kit_pattern` + team colours.
2. Render at three sizes.
3. Replace any current placeholder in squad list / tactics / match preview.

### Phase 5 — Manager avatar (≈2 ED)

1. Extend manager-creation screen with avatar picker (gallery of
   pre-rendered procedural portraits).
2. Add "upload photo" affordance, storing under `app_data_dir/manager-avatar/`.
3. Wire `manager_profile.media_json.face`.

### Phase 6 — Stadiums (≈1 ED, defer)

1. Procedural silhouette skyline, 4 templates, team-coloured.
2. Only if/when stadium profile screen exists.

**Total: ≈15 ED for the full programme. Phase 1 alone (4 ED) closes 80% of
the user-visible gap.**

---

## 7. Open questions for the design owner

1. **Is commissioned art for ~200 marquee players in budget?** If yes, this
   becomes a Phase 1.5 deliverable and significantly raises the perceived
   production value. If no, the procedural pipeline is fine.
2. **Do we want a "tactics-board" austere mode** where all player avatars
   switch to position-icon silhouettes? Some FM players prefer this. Cheap
   to add.
3. **What's our posture on community face packs in the readme?** FM
   quietly discourages them now under licensing pressure. Gaffer is
   GPLv3 and community-moddable by philosophy; we should be explicit that
   modding is the user's responsibility and Gaffer ships clean.
4. **Should regen signature traits ever appear on real (bundled-DB)
   players?** Probably no — real players should look "normal", regens get
   the distinctive traits. Confirm with design.
5. **Are we OK with the cache-invalidation hit on every `GENERATOR_VERSION`
   bump?** First launch after v2 ships will regenerate ~48 faces over
   ~5–10 seconds in the background. Acceptable, but worth noting in the
   release notes.

---

## 8. Sources (verified this turn)

- generated.photos pricing — https://generated.photos/pricing , https://generated.photos/api
- generated.photos 100k-face library announcement — https://icons8.com/blog/articles/ai-generated-faces
- SDXL Turbo speed (A100, 207 ms/image) — https://stability.ai/news-updates/stability-ai-sdxl-turbo
- SDXL Turbo on CPU via OpenVINO — https://docs.openvino.ai/2024/notebooks/sdxl-turbo-with-output.html , https://github.com/rupeshs/fastsdcpu
- DiceBear licence (MIT code, per-style artist licences) — https://www.dicebear.com/licenses
- Boring Avatars — https://boringavatars.com
- Football Manager community cut-out face megapack — https://sortitoutsi.net/graphics/style/1/cut-out-player-faces
- Sports Interactive community thread on licensing clampdown — https://community.sports-interactive.com/forums/topic/500808-licensing-clamp-down-on-graphics
- FIFPro commercial licensing — https://www.fifpro.org/who-we-are/commercial , https://www.fifpro.org/who-we-are/contact/video-game-developers
- EA Sports / FIFPro image-rights background — https://www.easportslaw.com/news/easports-image-rights-fifa
- Tauri sidecar documentation — https://v2.tauri.app/develop/sidecar

---

## Appendix A — Scorecard summary

| Approach | Legal (1=none) | Variety 10k+ | File size | Runtime | Aesthetic | Impl. complexity | Verdict |
|---|---|---|---|---|---|---|---|
| 3.1 AI online (generated.photos) | 1 | 5 | 3 | 1 | 4 | 2 | Reject as primary; OK as authoring tool |
| 3.2 AI offline (SDXL in Tauri) | 2 | 5 | 1 | 1–2 | 4 | 1 | Reject |
| 3.3 Procedural (current pipeline) | 1 | 3–4 | 5 | 5 | 3–4 | 5 | **Primary** |
| 3.4 Silhouette / abstract | 1 | 1 | 5 | 5 | 3 | 5 | Keep as fallback only |
| 3.5 Stylised real photos | 4 | 5 | 3 | 5 | 3 | 2 | Reject |
| 3.6 Commissioned art | 1 | 2 | 4 | 5 | 5 | 4 | Stretch goal (marquee players) |
| 3.7 Hybrid | 1 | 4 | 5 | 5 | 4 | 4 | **Recommended overall** |

## Appendix B — File / module impact map

| File | Change type | Phase |
|---|---|---|
| `src-tauri/assets/portrait-sources/*.webp` | Add 6–10 new files | 1 |
| `src-tauri/assets/portrait-sources/README.md` | Update provenance list | 1 |
| `src-tauri/src/commands/portraits.rs` | New sources in `SOURCE_BYTES`, expand `Recipe`, new render passes, bump `GENERATOR_VERSION` | 1, 2 |
| `src-tauri/src/commands/portraits.rs` tests | Update source counts, add trait-frequency tests | 1, 2 |
| `crates/domain/src/player.rs` (or media_json schema) | `SignatureTrait` field | 2 |
| `crates/ofm_core/src/generator/` | Trait generation for regens | 2 |
| `src/lib/mediaAssets.ts` | Extend `resolveLocalMediaPath` for face-packs | 3 |
| `src-tauri/src/commands/` (new module) | `face_packs_list`, `face_packs_enable`, `face_packs_reorder` | 3 |
| `src/components/settings/FacePacksTab.tsx` (new) | UI for pack management | 3 |
| `docs/modding/SCHEMA_REFERENCE.md` | Face-pack manifest format | 3 |
| `src/components/ui/KitSVG.tsx` (new) | Procedural kit renderer | 4 |
| `src/components/menu/CreateManagerForm.tsx` | Avatar picker + upload | 5 |
| `src-tauri/src/commands/profiles.rs` | Persist uploaded manager avatar | 5 |
