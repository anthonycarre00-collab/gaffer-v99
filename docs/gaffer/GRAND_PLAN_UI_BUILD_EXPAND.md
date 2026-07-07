# Gaffer — Grand Plan: UI Overhaul + Desktop Build + Expand

**Status:** Active execution plan
**Order:** Phase A (Desktop Build Verification) → Phase B (Full UI Overhaul) → Phase C (Expand Functionality)

---

## Execution Order

```
Phase A (1-2 days)  — Build + verify the desktop executable
  ↓ (user runs the app, we fix what breaks)
Phase B (10-14 days) — Full UI overhaul: logos, colors, screens, icons, everything
  ↓ (the game looks and feels like Gaffer, not OpenFoot Manager)
Phase C (ongoing)    — Expand functionality: transfers, youth academy UI, match day, etc.
  ↓ (add new features now that the foundation is solid)
```

---

## Phase A: Desktop Executable Build + Verification (1-2 days)

### Why first
We've written ~15,000 lines of code across 9 phases and never once run the actual app. There WILL be runtime issues. We need to verify the whole thing works before investing 2 weeks in UI polish.

### What I do
1. Add a "build verification" checklist to the repo
2. Fix any obvious issues I can spot by reading the code
3. Prepare the Tauri config for first-run (window title, icon, bundle settings)

### What YOU do (non-technical steps)

**Step 1: Install prerequisites (one-time, 10 minutes)**

On Windows:
- Download Node.js from https://nodejs.org (click "LTS", run the installer, click Next through everything)
- Download Rust from https://rustup.rs (click the download, run it, press Enter for default options)
- Download Microsoft Visual Studio C++ Build Tools: go to https://visualstudio.microsoft.com/visual-cpp-build-tools/, download, run installer, check "Desktop development with C++", click Install

On Mac:
- Open Terminal, run: `xcode-select --install` (click Install when the popup appears)
- Download Node.js from https://nodejs.org (click "LTS", run the installer)
- Download Rust from https://rustup.rs (run the script in Terminal)

On Linux (Ubuntu/Debian):
- Open Terminal, run:
  ```
  sudo apt update && sudo apt install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
  ```
- Download Node.js from https://nodejs.org (LTS version)
- Download Rust from https://rustup.rs

**Step 2: Download the code (2 minutes)**
- Open Terminal / Command Prompt
- Run: `git clone https://github.com/anthonycarre00-collab/gaffer.git`
- Run: `cd gaffer`

**Step 3: Run the app (5 minutes)**
- Run: `npm install` (wait ~2 minutes for it to download dependencies)
- Run: `npm run tauri dev` (wait ~3 minutes for first build)

A window should open showing the game. If it works, you'll see the main menu.

**Step 4: Report what happens**
- If the window opens and you see the main menu → tell me "it works" and move to Phase B
- If you see an error → copy the error message and send it to me
- If the window opens but something looks broken → take a screenshot and send it

### What could go wrong
- Missing system library → I'll tell you exactly what to install
- Rust compilation error → I'll fix the code
- Blank window → I'll debug the frontend
- World database doesn't load → I'll fix the data path

---

## Phase B: Full UI Overhaul (10-14 days)

### Scope — COMPREHENSIVE, not minor alterations

This is a from-the-ground-up visual rebuild. Every screen, every color, every button, every icon, every logo. The goal: when someone sees Gaffer, they should immediately think "this is its own thing" — not "this looks like Football Manager" or "this looks like a generic SaaS dashboard."

### B.1: Design Foundation (2 days)

**Color palette** — replace every Tailwind default swatch:
- Primary: Pitch Green `#2D5A3D` (replaces blue)
- Accent: Brass `#B8924A` (replaces gold/yellow)
- Danger/Injury: Mahogany `#7A2E1F` (replaces red)
- Dark BG: Pitch Black `#0E1410` (replaces slate-900)
- Editorial Highlight: Floodlight Cream `#F4E9C9`
- Neutrals: Chalk `#E8E4DC`, Concrete `#6B6660`, Ink `#1A1A1A`

**Typography** — 3 font families:
- Body: Inter (already installed, keep)
- Headings: Barlow Condensed (already installed, keep)
- **NEW: Editorial** — Source Serif 4 (scouting notes, match commentary, news headlines)
- **NEW: Numerals** — IBM Plex Mono (every single number in the game: attributes, scores, wages, dates)

**Layout philosophy:**
- Broadsheet hierarchy: Masthead (80px) → UtilityBar (40px) → Lead card → Column grid
- Target density: Bloomberg Terminal × The Athletic
- 4px corners (not 12px — sharper, more serious)
- 1px hairline borders always
- Matte surfaces — kill every button gradient
- Shadows only on modals

**Files to create/touch:**
- `src/App.css` — complete rewrite of the `@theme` block
- `src/styles/tokens.css` — NEW: design tokens file (single source of truth)
- `src/styles/fonts.css` — NEW: font imports
- Install `@fontsource/source-serif-4` + `@fontsource/ibm-plex-mono`

### B.2: Logo + Brand Identity (1 day)

**New logo** — "Gaffer" wordmark:
- Barlow Condensed, bold, tracking-tight
- Color: Brass on Pitch Black, or Pitch Green on Cream
- A simple emblem: a touchline boot or a half-time whiteboard sketch
- Generate via AI image generation or commission

**App icon** (for taskbar/dock):
- 32x32, 128x128, 128x128@2x, .icns, .ico — full set
- Replace the current OpenFoot Manager icon

**Loading screen / splash:**
- Dark background, brass wordmark, subtle loading bar
- Replace the current blank/Tauri default

**Files to create:**
- `src/assets/logo.svg` — main wordmark
- `src/assets/logo-mark.svg` — emblem only
- `src-tauri/icons/` — all icon sizes regenerated
- `src/components/LoadingScreen.tsx` — NEW: branded splash

### B.3: Icon System (1 day)

**Replace all lucide-react icons with a custom Gaffer icon set:**
- Consistent line weight (1.5px)
- Brass color on dark, Ink color on light
- Football-specific: boot, whistle, clipboard, tactics board, dugout, floodlight

**Approach:** Custom SVG components, not a library. ~30 icons needed.
- `src/components/ui/icons/` — NEW directory
- One `.tsx` file per icon, exported from `icons/index.ts`

### B.4: Core Layout Shell (2 days)

**Masthead** (replaces current header):
- 80px tall, Pitch Black background
- Left: Gaffer wordmark + current screen title
- Right: Manager name, club badge, date, "Continue" button
- Sticky, always visible

**Sidebar** (replaces current sidebar):
- 60px collapsed / 240px expanded
- Icons only when collapsed (custom Gaffer icons)
- Labels on hover
- Sections: Squad, Tactics, Training, Scouting, Transfers, Inbox, Finances, Staff

**UtilityBar** (new, below masthead):
- 40px tall
- Left: breadcrumbs (Home > Squad > Player Name)
- Right: search, settings, theme toggle

**Files to touch:**
- `src/components/dashboard/DashboardSidebar.tsx` — rewrite
- `src/components/dashboard/DashboardHeader.tsx` — rewrite
- `src/components/dashboard/UtilityBar.tsx` — NEW
- `src/components/dashboard/DashboardLayout.tsx` — NEW: orchestrates the shell

### B.5: Signature Screen #1 — Home Dashboard (2 days)

**Concept: "The Manager's Desk"**
- Top: SquadPulse strip (EKG-style, the signature visual)
- Middle: 3-column grid (Next Match | League Position | Media Pulse)
- Bottom: Recent Results | Inbox Preview | Onboarding

**SquadPulse strip** (the "wow" visual):
- Horizontal bar, 600px wide, 60px tall
- Animated fill (CSS transition, no JS animation library)
- Color shifts: green > 65, amber 40-65, red < 40
- 7-factor breakdown on hover (tooltip, not modal)
- "Crushing / High / Moderate / Low" label in serif italic

**Files:**
- `src/components/home/HomeTab.tsx` — rewrite
- `src/components/home/SquadPulseCard.tsx` — redesign (already exists, needs visual overhaul)
- `src/components/home/MediaPulseCard.tsx` — redesign

### B.6: Signature Screen #2 — Player Detail (2 days)

**Concept: "Scouting Dossier"**
- Not a card grid — a single-column document, like a scout's written report
- Hero: player portrait (procedural), name in Barlow Condensed, position badge
- Left rail: attributes (hex cluster, not radar — radars are unreadable for 19 attrs)
- Main body: meaning snapshot (stability, form, relationships) in editorial serif
- Bottom: career history as a timeline

**Attribute visualization — Hex Cluster:**
- 4 hexagons (Body / Ball / Head / Gloves), each showing the group average
- Click a hex → expands to show the 5-6 individual attributes as bars
- IBM Plex Mono for all numbers

**Files:**
- `src/components/playerProfile/PlayerProfile.tsx` — rewrite
- `src/components/playerProfile/PlayerProfileHeroCard.tsx` — redesign
- `src/components/playerProfile/HexAttributeCluster.tsx` — NEW
- `src/components/ui/PlayerMeaningCard.tsx` — redesign (already exists)

### B.7: Signature Screen #3 — Match Day (2 days)

**Concept: "The Dugout at 7:45pm"**
- Dark, atmospheric, focused
- Top: score + clock, large, centered
- Middle: pitch view with player tokens (custom SVG pitch, not a generic green rectangle)
- Right rail: live commentary feed (serif italic, scrolling)
- Bottom: permanent stats strip (possession, shots, xG)

**Live commentary:**
- Auto-scrolling feed
- Each event: minute (mono), event type (icon), description (serif italic)
- Color-coded: goals (brass), cards (mahogany), subs (chalk)

**Files:**
- `src/components/match/MatchSimulation.tsx` — rewrite
- `src/components/match/LiveCommentaryFeed.tsx` — NEW
- `src/components/match/PitchView.tsx` — NEW (custom SVG)
- `src/components/match/MatchStatsStrip.tsx` — NEW

### B.8: Secondary Screens (2 days)

**Squad screen** — clipboard aesthetic:
- Table with alternating row colors (cream/white in light, two shades of navy in dark)
- Left border color-coded by position (GK=brass, DEF=green, MID=blue, FWD=mahogany)
- Sortable headers, sticky first column
- Click row → slide-out panel (not full page navigation)

**Training screen** — whiteboard aesthetic:
- Weekly schedule as a grid (7 days × focus slots)
- Drag-and-drop groups (or simple select + assign)
- Staff advice as a handwritten-style note (serif italic, cream background)

**Scouting screen** — cork board aesthetic:
- Scouted players as "cards" pinned to a board
- Reveal tier shown as a progress bar (Surface → Detailed → Complete)
- Fuzzed attributes shown as "???" until revealed

**Transfers screen** — newspaper transfer column:
- Bid list as a news feed
- Deal workspace as a "contract on the table" visual

**Files:** (all redesigns of existing components)
- `src/components/squad/SquadTab.tsx`
- `src/components/training/TrainingTab.tsx`
- `src/components/scouting/ScoutingCentreTab.tsx`
- `src/components/transfers/TransfersTab.tsx`

### B.9: Component Polish Pass (1 day)

**Buttons:**
- Kill all gradients
- Primary: Pitch Green, white text, 4px corners
- Secondary: transparent, 1px border, Ink text
- Danger: Mahogany
- Hover: darken 10%, no scale transform

**Cards:**
- 1px hairline border (Chalk on light, Concrete on dark)
- No shadow (except modals)
- 4px corners
- Header: Barlow Condensed, uppercase, tracking-wide
- Body: Inter

**Tables:**
- Zebra striping
- Sticky headers
- Sortable column indicators (custom chevron icon)
- All numbers in IBM Plex Mono, right-aligned

**Form inputs:**
- 1px border, 4px corners
- Focus: Brass border
- Labels: uppercase, tracking-wide, Chalk color

**Badges:**
- Position badges: colored backgrounds (GK=brass, DEF=green, MID=blue, FWD=mahogany)
- Form badges: star (in form), arrow up (rising), arrow down (quiet)
- Stability badges: 5-tier with custom labels

### B.10: Dark Mode + Theme System (1 day)

**Two themes:**
- "Floodlit" (dark, default): Pitch Black background, Chalk text
- "Daylight" (light): Cream background, Ink text

**Theme toggle:**
- In UtilityBar
- Sun/moon icon (custom)
- Persists via settingsStore

**Files:**
- `src/App.css` — CSS variables for both themes
- `src/context/ThemeContext.tsx` — already exists, verify works with new palette

---

## Phase C: Expand Functionality (ongoing, 2-5 days per feature)

### Priority order (do these after UI overhaul)

**C.1: Transfer AI (3 days)**
- AI teams make transfer bids between each other
- AI teams respond to user's transfer bids with realistic counter-offers
- Transfer deadline day drama (last-minute bids)

**C.2: Youth Academy UI (2 days)**
- The regen system exists (Phase 8) but has no UI
- Youth intake day as a scheduled event
- Academy prospect list with development progress

**C.3: Match Day Experience (4 days)**
- Live match with tactical changes (substitutions, formation tweaks)
- Half-time team talks
- Post-match press conference
- Match rating system (already in backend, needs UI)

**C.4: Manager Career Progression (3 days)**
- Job offers from other clubs
- Sacking (if you do poorly)
- Reputation system
- Career history page

**C.5: Team Finances UI (2 days)**
- Budget allocation (transfer vs wages)
- Sponsor income
- Facility upgrades (already in backend, needs UI)

**C.6: International Management (5 days, stretch)**
- National team job offers
- International fixtures during season breaks
- World Cup / continental tournaments

---

## What I need from you

### Phase A (Desktop Build)
1. Install prerequisites (steps above)
2. Run `npm run tauri dev`
3. Tell me what happens (works / error message / screenshot)

### Phase B (UI Overhaul)
- Nothing during the build — I do all the coding
- At the end: review screenshots, give feedback, I iterate

### Phase C (Expand)
- Tell me which features to prioritize
- Provide feedback on each as it ships

---

## Definition of Done — Full Project

- [ ] Desktop executable builds and runs on Windows, Mac, Linux
- [ ] New game loads real player data
- [ ] All screens use Gaffer visual identity (Pitch Green, Brass, Mahogany)
- [ ] All numbers in IBM Plex Mono
- [ ] All headings in Barlow Condensed
- [ ] Editorial text in Source Serif 4
- [ ] Custom Gaffer icon set (no lucide-react defaults)
- [ ] Custom Gaffer logo + app icon
- [ ] 3 signature screens rebuilt (Home, Player Detail, Match Day)
- [ ] Dark mode + light mode both work
- [ ] Transfer AI functional
- [ ] Youth academy UI functional
- [ ] Match day experience (live match, team talks, press conferences)
- [ ] Manager career progression
- [ ] 515+ Rust tests still pass
- [ ] 0 TypeScript errors
- [ ] Installers produced (.exe, .dmg, .AppImage)
