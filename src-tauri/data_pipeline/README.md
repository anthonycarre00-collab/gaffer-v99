# Gaffer Phase 0.5 — Bundled World Database Pipeline

This directory contains the scripts that build the **pre-populated world database**
that ships with the Gaffer desktop app.

## What it produces

A JSON world database file (`gaffer_world.json`) containing:
- All real players with 19 Gaffer attributes
- All real teams with finances, formations, reputation
- All real leagues/competitions
- All real staff (managers, coaches, scouts)
- Pre-computed Big Five personality profiles
- Pre-computed relationship edges
- Pre-assigned narrative traits
- Seeded rivalry pairs

## How to run

```bash
cd src-tauri/data_pipeline
python3 build_world.py
```

Output: `../databases/gaffer_world.json` (bundled with the Tauri app)

## Data sources

- **FBref** — player stats (pace, passing, shooting, defending metrics)
- **Transfermarkt** — player info (DOB, nationality, position, contract, market value, injuries)
- **Understat** — xG/xA data (for finishing, creativity)
- **Sofascore** — match ratings (for form, consistency)

## Attribute mapping (stats → Gaffer 19 attrs)

| Gaffer Attr | Data Source | Mapping |
|-------------|------------|---------|
| Pace | FBref sprint distances | Normalized 0-99 |
| Burst | FBref acceleration events | Normalized 0-99 |
| Engine | FBref minutes played / distance | Normalized 0-99 |
| Power | Transfermarkt height/weight | Normalized 0-99 |
| Agility | FBref dribble success rate | Normalized 0-99 |
| Passing | FBref pass completion % | Normalized 0-99 |
| Distribution | FBref long pass completion % | Normalized 0-99 |
| Touch | FBref dribbles + ball control | Normalized 0-99 |
| Finishing | Understat xG conversion | Normalized 0-99 |
| Defending | FBref tackles + interceptions | Normalized 0-99 |
| Aerial | FBref aerial duel win % | Normalized 0-99 |
| Anticipation | FBref interceptions | Normalized 0-99 |
| Vision | FBref key passes + through balls | Normalized 0-99 |
| Decisions | FBref pass accuracy under pressure | Normalized 0-99 |
| Composure | Understat big chance conversion | Normalized 0-99 |
| Leadership | Transfermarkt captaincy history | Normalized 0-99 |
| Shot Stopping | FBref save % (GK only) | Normalized 0-99 |
| Commanding | FBref cross claim % (GK only) | Normalized 0-99 |
| Playing Out | FBref GK pass accuracy (GK only) | Normalized 0-99 |
