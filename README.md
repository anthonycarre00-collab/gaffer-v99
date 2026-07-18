<div align="center">

![Gaffer Logo](src/assets/gaffer-logo-v100.webp)

[![License: GPL v3](https://img.shields.io/github/license/anthonycarre00-collab/gaffer-v99
)](https://www.gnu.org/licenses/gpl-3.0)
[![Rust](https://shields.io/badge/-Rust-FF4500?style=flat&logo=rust)](https://www.rust-lang.org/)
[![Tauri](https://shields.io/badge/-Tauri-2E8B57?style=flat&logo=tauri)](https://tauri.app/)
[![React](https://shields.io/badge/-React-1434A4?style=flat&logo=react)](https://react.dev/)

**Every Result Tells a Story**

A free, desktop football management simulation built for the purist.

[Features](#features) • [Installation](#installation--development) • [Contributing](#contributing) • [License](#license)

Join the community on Discord: https://discord.gg/2CXaesaukT

</div>

---

## Welcome to the Dugout

Right then. Pull up a chair, gaffer. You've just been handed the keys to a football club and nobody's going to hold your hand.

**Gaffer** is a free, open-source football manager game — the kind where you'll spend hours tinkering with your back four, arguing with the board over the transfer kitty, and telling the lads to "just get round the back" in the 89th minute. It's got 5,324 real players, 184 clubs, 21 competitions, and a match engine that actually knows what a counter-attack looks like.

We don't do raw numbers here. Every player rating, every morale level, every attribute tier is spoken in **Gaffer voice** — the language of the terrace, the dressing room, and the post-match pint. Your striker isn't "OVR 88." He's **"Top-drawer — a proper handful on his day."** Your midfielder isn't "stamina 75." He's a **"workhorse who'll run all day."** The board don't say "satisfaction -15." They say **"the fans are baying for blood."**

This is V100 — the big one. Every system wired in, every bug squashed, every screen polished. Read on.

## Features

### The Match Day
- **19-attribute player system** with four groups — The Body, The Ball, The Head, The Gloves
- **Match engine** with weather, fixture importance, pressure situations, and a shot cooldown that stops 4-3 thrillers from becoming 7-6 basketball games
- **Live match mode** — make subs, change formation, shout from the touchline
- **Sparse simulator** for AI-vs-AI matches — fast enough to sim a full matchday in seconds
- **4 atmosphere events** — MomentumShift, QuietMinute, SustainedPressure, CounterAttack. A 0-0 grind now feels different from a 4-3 thriller
- **Position-aware ratings** — GKs get save bonuses + clean sheet credit, DEFs get tackle bonuses, FWDs get clinical finisher bonuses. No more 6.0 for everyone

### The Transfer Market
- **Real player database** — 5,324 real players across 184 clubs and 21 competitions
- **Per-club reputation** — Burnley don't have the same buying power as Man City anymore. Squad-avg OVR drives 6 reputation tiers
- **Wage sanity** — FIFA's £260k/week wages clamped to Gaffer's economy. No more OVR-67 Lukaku bankrupting you
- **Per-window dedup** — a player bought on Day 1 can't be sold on Day 5. Ownership checks prevent stale bids
- **Not-for-sale toggle** — mark a player untouchable, AI clubs won't bid. Reject all bids in one click
- **Release clauses, loan system, tapping up** — the full toolbox of modern football's dark arts

### The World
- **AI manager personalities** — Guardiola-type possession men vs Allardyce-type direct merchants, each training their squads differently
- **Manager head-to-head records** — the game tracks W/D/L between every pair of gaffers. Settle old scores
- **6-pundit commentary cast** — Roy Keane-type (fiery), Carragher-type (tactical), Micah Richards-type (enthusiastic), Neville-type (analytical), Lineker-type (witty), Souness-type (critical). Same fixture always gets the same pundit
- **Multi-season vitality** — players age, retire, get replaced by academy graduates; staff retire; rivalries build; the Hall of Fame grows
- **Player career stories** — debut, first goal, milestone appearances, loan spells, breakthroughs
- **Narrative memory** — the game remembers breakout performances and resurfaces them months later
- **Board types** — Sugar Daddy, Sensible, Penny-Pinching, Ambitious — each with different budgets and patience
- **Talk to Board** — request more time, more transfer funds, or stadium expansion. Most get knocked back — that's football

### The Dugout
- **Tactics board** with Phase Blueprint (now on the Style tab) — 9 tactical dials (build-up style, width, tempo, pressing, defensive shape, marking, counter-press, break speed, defensive line)
- **27 player roles** with Gaffer-voice descriptions — "Poacher: Fox in the box. Lethal when the ball drops in the six-yard box"
- **Perspective pitch** — subtle 3D CSS transform gives the tactics board depth
- **Position retraining** — train a winger to play full-back. 80% success rate, never 100%. Persists across saves
- **Training ground** with weekly cycles, Youth-specialist bonus for under-21s (+25% development)
- **Scouting network** with progressive 3-tier reveal (Surface → Detailed → Complete) and scout bias — each scout sees the game differently
- **Backroom staff** with caps (1 AssistantManager, 5 Coaches, 5 Scouts, 2 Physios) and career progression — attributes improve over time
- **Reserve squad** — move players to the reserves for fitness, punishment, or youngster experience. Lightweight, no separate team entity
- **Press conferences** and **manager mind games** before rivalries

### The Voice
- **No raw numbers in the UI** — everything speaks football: "Electric pace," "Clinical finisher," "Match fit," "Running on empty"
- **Gaffer interpretation engine** — position-aware attribute descriptions (a CB's "pace" is "Recovery Pace," a winger's is "In Behind")
- **11-language support** — English, Spanish, Portuguese, French, German, Italian, Russian, Chinese, Czech, Turkish, Brazilian Portuguese
- **Oswald + Inter + JetBrains Mono** — proper typography per the UI spec. No more Barlow Condensed fallback

### The Polish
- **Carbon-first dark mode** — no light mode flickering, no white gradients washing out textures
- **Brass accent system** — the Gaffer gold runs through every screen
- **Player height/weight** — generated from position + power, displayed on every profile
- **Fixture clash resolution** — CL and PL on the same day? The collision pass shifts the lower-priority fixture
- **Cup write-back** — round summary now scans all competitions, not just the league mirror
- **Hall of Fame** — sorts your league's champions first, then the rest of the world

## Architecture

Built on a foundation of proper engineering — no Electron bloat, no web-app-wrapped-as-desktop nonsense:

- **Rust** — Match engine, game state, AI, and all simulation logic. Six crates: `domain`, `engine`, `ofm_core`, `db`, `sim-bench`, `ofm-cli`.
- **Tauri 2** — Lightweight desktop shell. Native performance, tiny binary.
- **React 19 + TypeScript + Tailwind v4** — Fast, responsive frontend with a football-styled design system.
- **SQLite** — Per-save databases with 47 migrations. Your saves are local, portable, and yours.

*Built on the OpenFootManager project.*

## Installation & Development

Right, you'll need the tools. No shortcuts here — this is a proper Rust + Tauri + React stack:

1. Install **Rust** (via `rustup`)
2. Install **Node.js** (v18+)
3. Install Tauri dependencies for your OS (see the [Tauri Prerequisites Guide](https://v2.tauri.app/start/prerequisites/))

Clone and install:

```bash
git clone https://github.com/anthonycarre00-collab/gaffer-v99.git
cd gaffer-v99
npm install
```

Run the development build:

```bash
npm run tauri dev
```

Or use the build script (Windows):

```bash
run-and-build.bat
```

First build takes 5-15 minutes (Rust compiles everything). Subsequent builds are 1-3 minutes. The game window opens automatically when ready.

## Contributing

Contributions welcome. Read [CONTRIBUTING](CONTRIBUTING.md) for full guidelines.

Join the Discord for discussion: https://discord.gg/2CXaesaukT

Quick checklist:

1. Open an Issue first for bugs, enhancements, or larger features.
2. Work from a feature branch and open Pull Requests targeting `main`.
3. Run tests before submitting:

```bash
npm test
cd src-tauri
cargo test --workspace
```

## License

    Gaffer - A free and open source football management game
    Copyright (C) 2020-2026  Pedrenrique G. Guimarães

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

Check [LICENSE](LICENSE.md) for more information.

---

<div align="center">

**Every Result Tells a Story.**

Now get out there and win some football matches.

</div>
