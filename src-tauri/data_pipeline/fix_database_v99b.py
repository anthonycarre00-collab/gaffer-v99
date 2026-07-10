#!/usr/bin/env python3
"""V99 Phase 4.1b: Fix remaining unmapped teams — name variants + Eredivisie."""

import json
import os
from pathlib import Path

DB_PATH = Path(__file__).parent.parent.parent / "src-tauri" / "databases" / "gaffer_world.json"

# Name variants → canonical name
NAME_ALIASES = {
    "Manchester Utd": "Manchester United",
    "Tottenham Hotspur": "Tottenham",
    "Paris Saint-Germain": "Paris SG",
    "Dortmund": "Borussia Dortmund",
    "Leverkusen": "Bayer Leverkusen",
    "Gladbach": "Borussia Mönchengladbach",
    "Bochum": "VfL Bochum",
    "Heidenheim": "FC Heidenheim",
}

# Eredivisie teams (Netherlands) — 18 teams
EREDIVISIE_TEAMS = {
    "Ajax": ("Eredivisie", "Netherlands", "Amsterdam", "Johan Cruijff ArenA", 55865),
    "PSV": ("Eredivisie", "Netherlands", "Eindhoven", "Philips Stadion", 35000),
    "Feyenoord": ("Eredivisie", "Netherlands", "Rotterdam", "De Kuip", 47500),
    "AZ Alkmaar": ("Eredivisie", "Netherlands", "Alkmaar", "AFAS Stadion", 19478),
    "Twente": ("Eredivisie", "Netherlands", "Enschede", "De Grolsch Veste", 30205),
    "Vitesse": ("Eredivisie", "Netherlands", "Arnhem", "GelreDome", 21248),
    "Utrecht": ("Eredivisie", "Netherlands", "Utrecht", "Stadion Galgenwaard", 23750),
    "Heerenveen": ("Eredivisie", "Netherlands", "Heerenveen", "Abe Lenstra Stadion", 27224),
    "Go Ahead Eagles": ("Eredivisie", "Netherlands", "Deventer", "De Adelaarshorst", 9500),
    "RKC Waalwijk": ("Eredivisie", "Netherlands", "Waalwijk", "Mandemakers Stadion", 7508),
    "Excelsior": ("Eredivisie", "Netherlands", "Rotterdam", "Van Donge & De Roo Stadion", 4500),
    "NEC Nijmegen": ("Eredivisie", "Netherlands", "Nijmegen", "Goffertstadion", 12500),
    "Sparta Rotterdam": ("Eredivisie", "Netherlands", "Rotterdam", "Het Kasteel", 11026),
    "Fortuna Sittard": ("Eredivisie", "Netherlands", "Sittard", "Fortuna Sittard Stadion", 12500),
    "Heracles Almelo": ("Eredivisie", "Netherlands", "Almelo", "Erve Asito", 12080),
    "Almere City": ("Eredivisie", "Netherlands", "Almere", "Yanmar Stadion", 4501),
    "Volendam": ("Eredivisie", "Netherlands", "Volendam", "Kras Stadion", 7384),
    "Zwolle": ("Eredivisie", "Netherlands", "Zwolle", "MAC³PARK Stadion", 12500),
}

# Bundesliga missing teams
BUNDESLIGA_EXTRA = {
    "Bochum": ("Bundesliga", "Germany", "Bochum", "Vonovia Ruhrstadion", 27599),
    "Heidenheim": ("Bundesliga", "Germany", "Heidenheim", "Voith-Arena", 15000),
    "Gladbach": ("Bundesliga", "Germany", "Mönchengladbach", "Borussia-Park", 54057),
    "Dortmund": ("Bundesliga", "Germany", "Dortmund", "Signal Iduna Park", 81365),
    "Leverkusen": ("Bundesliga", "Germany", "Leverkusen", "BayArena", 30210),
}

# Competition metadata for Eredivisie
EREDIVISIE_META = {"country": "Netherlands", "reputation": 750, "num_teams": 18}

def fix_remaining():
    print(f"Loading database from {DB_PATH}...")
    with open(DB_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    teams = data.get("teams", [])
    competitions = data.get("competitions", [])

    # Step 1: Fix name aliases
    print("\n=== Fixing name aliases ===")
    for team in teams:
        name = team.get("name", "")
        if name in NAME_ALIASES:
            canonical = NAME_ALIASES[name]
            print(f"  Renaming: {name} → {canonical}")
            team["name"] = canonical

    # Step 2: Map remaining unmapped teams
    print("\n=== Mapping remaining teams ===")
    all_team_map = {}
    all_team_map.update(EREDIVISIE_TEAMS)
    all_team_map.update(BUNDESLIGA_EXTRA)

    fixed = 0
    for team in teams:
        name = team.get("name", "")
        league_val = team.get("league_name", "")
        if (not league_val or league_val == "Unknown") and name in all_team_map:
            league, country, city, stadium, capacity = all_team_map[name]
            team["country"] = country
            team["city"] = city
            team["stadium_name"] = stadium
            team["stadium_capacity"] = capacity
            team["football_nation"] = country
            team["league_name"] = league
            fixed += 1
            print(f"  Mapped: {name} → {league}")

    print(f"  Fixed {fixed} additional teams")

    # Step 3: Check for still-unmapped teams
    still_unmapped = [t.get("name", "?") for t in teams if not t.get("league_name") or t.get("league_name") == "Unknown"]
    if still_unmapped:
        print(f"  Still unmapped: {still_unmapped}")

    # Step 4: Rebuild competitions with correct participants
    print("\n=== Rebuilding competitions ===")
    teams_by_league = {}
    for team in teams:
        league = team.get("league_name", "")
        if league and league != "Unknown":
            if league not in teams_by_league:
                teams_by_league[league] = []
            teams_by_league[league].append(team.get("id", team.get("name", "").lower().replace(" ", "_")))

    # Existing competition metadata
    comp_meta = {
        "La Liga": {"country": "Spain", "reputation": 850},
        "Premier League": {"country": "England", "reputation": 880},
        "Serie A": {"country": "Italy", "reputation": 830},
        "Bundesliga": {"country": "Germany", "reputation": 840},
        "Ligue 1": {"country": "France", "reputation": 800},
        "Eredivisie": {"country": "Netherlands", "reputation": 750},
    }

    new_competitions = []
    for league_name, participant_ids in sorted(teams_by_league.items()):
        meta = comp_meta.get(league_name, {"country": "Unknown", "reputation": 600})
        comp = {
            "id": league_name.lower().replace(" ", "_"),
            "name": league_name,
            "country": meta["country"],
            "num_teams": len(participant_ids),
            "reputation": meta["reputation"],
            "participants": participant_ids,
            "competition_type": "League",
        }
        new_competitions.append(comp)
        print(f"  {league_name}: {len(participant_ids)} teams")

    data["competitions"] = new_competitions
    if new_competitions:
        data["league"] = new_competitions[0]

    # Save
    print(f"\nSaving fixed database...")
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  Done! Size: {os.path.getsize(DB_PATH) / 1024 / 1024:.1f} MB")

    # Summary
    print(f"\n=== FINAL SUMMARY ===")
    print(f"  Teams: {len(teams)} ({len(still_unmapped)} still unmapped)")
    print(f"  Competitions: {len(new_competitions)}")
    for comp in new_competitions:
        print(f"    {comp['name']}: {comp['num_teams']} teams")


if __name__ == "__main__":
    fix_remaining()
