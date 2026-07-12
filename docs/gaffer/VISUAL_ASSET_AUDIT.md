# Gaffer Visual Asset Audit & Upgrade Plan

**Created:** 2026-07-12
**Status:** UNPUBLISHED — not yet pushed to git
**Risk level:** MEDIUM (icon swaps) / LOW (new assets only)

---

## Audit Summary

### Current State

The game uses **130+ lucide-react icon imports** across **70+ components**. While a custom Gaffer icon set exists (`src/components/ui/icons/index.tsx` with 40 icons), most components still use generic lucide-react icons.

### Gaffer Visual Identity

**Color Palette:**
- Brass: `#e8c25a` → `#c9972e` → `#8b6214` (gradient)
- Pitch Green: `#1a5d3a` → `#0d3b25` → `#062018` (gradient)
- Accent: `#c9972e` (solid brass for highlights)
- Dark: Navy `#0f172a` / `#1e293b`

**Design Language:**
- 1.5px stroke weight (consistent across all icons)
- 24x24 viewBox, rounded line caps
- Football-specific imagery (cones, whistles, boots, tactics boards)
- Two-tone: `currentColor` for outline + `brassColor` for accents
- Serif typeface for letter marks (Georgia)
- Monospace for numbers (on boards, cards)

---

## New Custom Icons Created

**File:** `src/components/ui/icons/GafferIcons.tsx` (20 new icons)

### Match Day Icons (5)
| Icon | Replaces | Description | Risk |
|------|----------|-------------|------|
| StadiumIcon | generic building | Stadium with floodlight pylons + pitch | LOW |
| StoppageBoardIcon | generic clock | Referee's stoppage board with "90+4" | LOW |
| SubBoardIcon | generic arrows | LED substitution board with numbers | LOW |
| CaptainArmbandIcon | generic star | Captain's armband with "C" | LOW |
| TouchlineIcon | generic field | Pitch with technical area + manager figure | LOW |

### Transfer & Finance Icons (3)
| Icon | Replaces | Description | Risk |
|------|----------|-------------|------|
| TransferDocIcon | generic file | Transfer document with brass "OK" stamp | LOW |
| WageSlipIcon | generic dollar | Wage slip with coin + £ symbol | LOW |
| LoanArrowIcon | generic arrows | Curved loan arrow between two club dots | LOW |

### Training & Development Icons (2)
| Icon | Replaces | Description | Risk |
|------|----------|-------------|------|
| ConesIcon | generic dumbbell | Three training cones with brass tips | LOW |
| TacticsMagnetsIcon | generic grid | Tactics board with player magnets | LOW |

### Scouting & Youth Icons (2)
| Icon | Replaces | Description | Risk |
|------|----------|-------------|------|
| BinocularsIcon | generic eye | Scouting binoculars with lens reflections | LOW |
| AcademyGateIcon | generic graduation cap | Academy gate with star emblem | LOW |

### Status & Feedback Icons (4)
| Icon | Replaces | Description | Risk |
|------|----------|-------------|------|
| RedCardIcon | generic alert | Red card (filled #dc2626) | LOW |
| YellowCardIcon | generic alert | Yellow card (filled #eab308) | LOW |
| MedicalCrossIcon | generic triangle | Medical cross with brass accent | LOW |
| WhistleBlowIcon | generic flag | Referee whistle with sound waves | LOW |

### Media & News Icons (3)
| Icon | Replaces | Description | Risk |
|------|----------|-------------|------|
| NewspaperIcon | generic file | Newspaper with headline + photo box | LOW |
| MicrophoneIcon | generic mic | Press conference mic with grill lines | LOW |
| TrophyRibbonsIcon | generic trophy | Trophy with hanging ribbons | LOW |

### Navigation Icons (2)
| Icon | Replaces | Description | Risk |
|------|----------|-------------|------|
| FormationClipboardIcon | generic clipboard | Clipboard with 4-3-3 formation dots | LOW |
| MegaphoneIcon | generic volume | Fan megaphone with sound waves | LOW |

---

## Migration Plan

### Phase 1: LOW RISK — New components only (no existing changes)
**Risk:** LOW — only affects new code, no risk to existing functionality
- Use GafferIcons in new components: SocialMediaFeedComponent, TouchlineReaction, matchHighlights
- Use in PostMatchScreen highlights card (already partially done)

### Phase 2: MEDIUM RISK — Swap icons in sidebar navigation
**Risk:** MEDIUM — affects navigation, but icons are same size/shape
- Replace lucide icons in DashboardSidebar.tsx with Gaffer equivalents
- Replace lucide icons in DashboardHeader.tsx
- Test: visual inspection only — no logic change

### Phase 3: MEDIUM RISK — Swap icons in match screens
**Risk:** MEDIUM — match flow is critical
- Replace lucide icons in MatchLive, PreMatchSetup, PostMatchScreen
- Replace card icons (RedCard, YellowCard) with GafferIcons versions
- Replace injury/foul icons with GafferIcons versions

### Phase 4: LOW RISK — Swap icons in non-critical screens
**Risk:** LOW — these screens are not critical to game flow
- Replace lucide icons in: inbox, news, finances, transfers, scouting, staff, training, youth academy
- Replace lucide icons in: team profile, player profile, hall of fame, managers world

### Phase 5: HIGH RISK — Remove lucide-react dependency entirely
**Risk:** HIGH — requires replacing ALL 130+ import sites
- After all phases above, remove `lucide-react` from package.json
- Verify no remaining imports
- Reduces bundle size by ~50KB

---

## Existing Textures (no changes needed)

| Asset | Size | Usage | Quality |
|-------|------|-------|---------|
| stadium-night-bg.png | 134KB | Main menu background | Good — unique stadium photo |
| texture-pitch-grass.png | 280KB | Match pitch texture | Good — grass texture |
| texture-tactics-board.png | 147KB | Tactics screen texture | Good — tactical board |
| texture-leather-dark.png | 244KB | Sidebar leather texture | Good — dark leather |
| awards-bg.png | 203KB | End-of-season awards | Good — ceremony background |
| gaffer-logo-pro.png | 103KB | Pro logo (PNG) | Good — branded logo |

---

## Existing Custom Icons (already in use, no changes needed)

**File:** `src/components/ui/icons/index.tsx` (40 icons)
- BootIcon, WhistleIcon, ClipboardIcon, TacticsBoardIcon, DugoutIcon
- FloodlightIcon, ShieldIcon, TrophyIcon, BallIcon, UsersIcon
- MailIcon, DollarIcon, SettingsIcon, SearchIcon, ArrowLeftIcon
- ChevronRightIcon, StarIcon, HomeIcon, CrosshairIcon, UserCogIcon
- ScaleIcon, FeatherIcon, CheckCircleIcon, CircleIcon, LoaderIcon
- FlameIcon, GlobeIcon, LandmarkIcon, TargetIcon, + 11 more

These are all well-designed and football-specific. No changes needed.

---

## Summary

- **20 new custom Gaffer icons** created in `GafferIcons.tsx`
- **0 existing files modified** — all new icons are additive
- **Risk: LOW** for Phase 1 (new components only)
- **Risk: MEDIUM** for Phases 2-4 (icon swaps in existing components)
- **Risk: HIGH** for Phase 5 (removing lucide-react entirely)
- All icons follow Gaffer visual identity: brass + green, 1.5px stroke, football-specific imagery
- No textures or images need replacing — existing ones are good quality

**Recommendation:** Push Phase 1 now (LOW risk), then do Phases 2-4 in a separate sprint after the current build is stable.
