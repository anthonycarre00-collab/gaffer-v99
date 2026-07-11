<div align="center">

![Gaffer logo](images/openfootlogo.svg)

[![License: GPL v3](https://img.shields.io/github/license/anthonycarre00-collab/gaffer-v99
)](https://www.gnu.org/licenses/gpl-3.0)
[![Rust](https://shields.io/badge/-Rust-FF4500?style=flat&logo=rust)](https://www.rust-lang.org/)
[![Tauri](https://shields.io/badge/-Tauri-2E8B57?style=flat&logo=tauri)](https://tauri.app/)
[![React](https://shields.io/badge/-React-1434A4?style=flat&logo=react)](https://react.dev/)

**Tactics. Touchlines. Trophies.**

A free and open source football management simulation game

[Features](#features) • [Installation](#installation--development) • [Contributing](#contributing) • [License](#license)

Join the community on Discord: https://discord.gg/2CXaesaukT

</div>

---

**Gaffer** is a free and open source football/soccer manager game, licensed under the [GPLv3](LICENSE.md), inspired by the famous franchise Football Manager&trade;.

Built with a unique **Gaffer voice** — no raw numbers, just proper football language. Every rating, every morale level, every form tier is expressed the way a real manager would talk about it.

## FEATURES

- **19-attribute player system** with Gaffer-voice interpretation (Body / Ball / Head / Gloves)
- **Match engine** with weather conditions, fixture importance, and pressure situations
- **Full squad management** with Gaffer-voice roles, depth planning, and player development
- **Transfer and contract workflows** with realistic AI valuation, star-player appeal, and not-for-sale logic
- **Training and staff systems** with role-specific Gaffer-voice coaching descriptions
- **Dynamic inbox and news generation** with match highlights, narrative memories, and world events
- **Scouting support** for discovering talent and evaluating future signings
- **AI manager personalities** — Guardiola-type possession managers vs Allardyce-type direct managers
- **Multi-season world vitality** — player aging, retirement, regens, academy intake, staff retirement
- **Persistent game data** backed by SQLite for local saves and progression
- **Modern desktop app experience** built with Tauri + React for speed and low overhead
- **Multi-language support** with i18n foundations and community translation growth
- **Free and open source** under GPLv3, with community-driven development

## ARCHITECTURE

Gaffer is built using modern web technologies:

- **Rust**: Blazing-fast backend for the Match Simulation Engine and Game State.
- **Tauri**: Lightweight desktop application shell.
- **React + TypeScript + TailwindCSS**: A highly responsive frontend interface.
- **SQLite**: Local persistence for game saves.

## INSTALLATION & DEVELOPMENT

The game is still in early active development. To build and run the debug version, you need to install standard tools for Rust, Node, and Tauri development:

1. Install **Rust** (via `rustup`)
2. Install **Node.js** (v18+)
3. Install Tauri dependencies for your specific OS (see the [Tauri Prerequisites Guide](https://v2.tauri.app/start/prerequisites/))

Clone the repository and install dependencies:

```bash
git clone https://github.com/anthonycarre00-collab/gaffer-v99.git
cd gaffer-v99
npm install
```

Run the development desktop app:

```bash
npm run tauri dev
```

Or use the build script:

```bash
run-and-build.bat
```

## CONTRIBUTING

Contributions are welcome. For full guidelines, read [CONTRIBUTING](CONTRIBUTING.md).

If you want to discuss ideas, share feedback, or follow development more casually, join the Discord server: https://discord.gg/2CXaesaukT

Quick contribution checklist:

1. Open an Issue first for bugs, enhancements, or larger feature ideas.
2. Work from a feature branch and open Pull Requests targeting `main`.
3. Run tests before submitting:

```bash
npm test
cd src-tauri
cargo test --workspace
```

## LICENSE

    Gaffer - A free and open source soccer management game
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
