#!/usr/bin/env python3
"""
V99 Phase 4.7: Fix missing attributes + ensure all players have proper data.

Issues found:
1. aggression + teamwork missing for ALL 3,376 players (derived from personality
   in the engine, but the DB needs them too for display + scouting)
2. composure has float values (47.0) instead of ints (47)
3. No player images — the procedural portrait system handles this, but we
   should verify the media field structure is correct

Fixes:
- Populate aggression from a position-weighted formula (defenders/forwards
  higher, midfielders moderate, GKs lower)
- Populate teamwork from a position-weighted formula (midfielders/defenders
  higher, forwards moderate, GKs lower)
- Fix all float attribute values to ints
- Ensure every player has a media object (even if face is null — the
  procedural system fills in at runtime)
"""

import json
import os
import hashlib
from pathlib import Path

DB_PATH = Path(__file__).parent.parent.parent / "src-tauri" / "databases" / "gaffer_world.json"

def fix_attributes():
    print(f"Loading database from {DB_PATH}...")
    with open(DB_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    players = data.get("players", [])
    print(f"  Loaded {len(players)} players")

    fixed_aggression = 0
    fixed_teamwork = 0
    fixed_floats = 0
    fixed_media = 0

    for player in players:
        attrs = player.get("attributes", {})
        position = player.get("position", "Midfielder")
        ovr = player.get("ovr", 50)

        # === Fix 1: Populate aggression ===
        # Derived from personality.neuroticism in the engine, but we need
        # a DB value too. Position-weighted:
        # - Defenders: higher (tackling is their job)
        # - Forwards: moderate-high (pressing, physical)
        # - Midfielders: moderate (box-to-box)
        # - Goalkeepers: lower (less physical confrontation)
        if "aggression" not in attrs or attrs.get("aggression") is None:
            base = max(30, min(85, ovr - 5))
            if position == "Defender":
                attrs["aggression"] = min(90, base + 15)
            elif position == "Forward":
                attrs["aggression"] = min(85, base + 10)
            elif position == "Midfielder":
                attrs["aggression"] = min(80, base + 5)
            else:  # Goalkeeper
                attrs["aggression"] = max(30, base - 5)
            fixed_aggression += 1

        # === Fix 2: Populate teamwork ===
        # Derived from personality.agreeableness in the engine.
        # Position-weighted:
        # - Midfielders: higher (orchestration, tracking back)
        # - Defenders: higher (organised, cover for each other)
        # - Forwards: moderate (pressing but also individualistic)
        # - Goalkeepers: moderate (organising the defence)
        if "teamwork" not in attrs or attrs.get("teamwork") is None:
            base = max(30, min(85, ovr - 3))
            if position == "Midfielder":
                attrs["teamwork"] = min(90, base + 12)
            elif position == "Defender":
                attrs["teamwork"] = min(88, base + 10)
            elif position == "Goalkeeper":
                attrs["teamwork"] = min(80, base + 5)
            else:  # Forward
                attrs["teamwork"] = min(82, base + 3)
            fixed_teamwork += 1

        # === Fix 3: Convert all float attributes to ints ===
        for key, val in attrs.items():
            if isinstance(val, float):
                attrs[key] = int(round(val))
                fixed_floats += 1

        player["attributes"] = attrs

        # === Fix 4: Ensure media field exists ===
        if "media" not in player or player["media"] is None:
            player["media"] = {"face": None}
            fixed_media += 1
        elif "face" not in player["media"]:
            player["media"]["face"] = None
            fixed_media += 1

    # Save
    print(f"\nFixes applied:")
    print(f"  aggression populated: {fixed_aggression}")
    print(f"  teamwork populated: {fixed_teamwork}")
    print(f"  float→int conversions: {fixed_floats}")
    print(f"  media field ensured: {fixed_media}")

    print(f"\nSaving database...")
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  Done! Size: {os.path.getsize(DB_PATH) / 1024 / 1024:.1f} MB")

    # Verify
    print(f"\n=== VERIFICATION ===")
    missing_agg = sum(1 for p in data["players"] if "aggression" not in p.get("attributes", {}))
    missing_team = sum(1 for p in data["players"] if "teamwork" not in p.get("attributes", {}))
    has_media = sum(1 for p in data["players"] if "media" in p)
    print(f"  Missing aggression: {missing_agg}")
    print(f"  Missing teamwork: {missing_team}")
    print(f"  Has media field: {has_media}/{len(data['players'])}")

    # Sample
    sample = data["players"][0]
    print(f"\n  Sample: {sample['full_name']} | pos={sample['position']} | ovr={sample['ovr']}")
    print(f"  aggression={sample['attributes']['aggression']} | teamwork={sample['attributes']['teamwork']}")


if __name__ == "__main__":
    fix_attributes()
