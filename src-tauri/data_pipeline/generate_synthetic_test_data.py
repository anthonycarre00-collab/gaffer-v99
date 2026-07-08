#!/usr/bin/env python3
"""
Generate a synthetic 50-player test dataset in scraper.html v3 output format.

This simulates what the scraper would produce, so we can verify the
build_world.py parser end-to-end without needing to run the scraper
against live FBref data.

Run: python3 generate_synthetic_test_data.py
Output: input/gaffer_players.json (50 players across 5 teams)
"""

import json
import random
import os
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent / "input"
OUTPUT_FILE = OUTPUT_DIR / "gaffer_players.json"

# 5 teams covering each Big 5 league
TEAMS = [
    {"name": "Arsenal", "league": "Premier League", "country": "England"},
    {"name": "Real Madrid", "league": "La Liga", "country": "Spain"},
    {"name": "Bayern Munich", "league": "Bundesliga", "country": "Germany"},
    {"name": "Inter", "league": "Serie A", "country": "Italy"},
    {"name": "Paris SG", "league": "Ligue 1", "country": "France"},
]

# 10 players per team (2 GK, 3 DEF, 3 MID, 2 FWD)
POSITIONS_PER_TEAM = ["GK", "GK", "DEF", "DEF", "DEF", "MID", "MID", "MID", "FWD", "FWD"]

# Realistic-ish names by nationality
NAMES = {
    "England": [("Bukayo", "Saka"), ("Harry", "Kane"), ("Jude", "Bellingham"), ("Phil", "Foden"), ("Declan", "Rice"), ("Marcus", "Rashford"), ("Jordan", "Henderson"), ("Kyle", "Walker"), ("John", "Stones"), ("Jack", "Grealish")],
    "Spain": [("Sergio", "Busquets"), ("Pedri", "González"), ("Gavi", "Páez"), ("Álvaro", "Morata"), ("Marco", "Asensio"), ("Rodri", "Hernández"), ("Aymeric", "Laporte"), ("Unai", "Simón"), ("Mikel", "Oyarzabal"), ("Fabián", "Ruiz")],
    "Germany": [("Joshua", "Kimmich"), ("Leon", "Goretzka"), ("Thomas", "Müller"), ("Kai", "Havertz"), ("Leroy", "Sané"), ("Antonio", "Rüdiger"), ("Manuel", "Neuer"), ("Florian", "Wirtz"), ("Jamal", "Musiala"), ("Niklas", "Süle")],
    "Italy": [("Federico", "Chiesa"), ("Nicolò", "Barella"), ("Marco", "Verratti"), ("Ciro", "Immobile"), ("Gianluigi", "Donnarumma"), ("Leonardo", "Bonucci"), ("Giorgio", "Scalvini"), ("Sandro", "Tonali"), ("Giacomo", "Raspadori"), ("Alessandro", "Bastoni")],
    "France": [("Kylian", "Mbappé"), ("Antoine", "Griezmann"), ("Paul", "Pogba"), ("N'Golo", "Kanté"), ("Raphaël", "Varane"), ("Hugo", "Lloris"), ("Aurélien", "Tchouaméni"), ("Eduardo", "Camavinga"), ("Ousmane", "Dembélé"), ("Marcus", "Thuram")],
}

NATIONALITY_MAP = {"England": "ENG", "Spain": "ESP", "Germany": "GER", "Italy": "ITA", "France": "FRA"}


def random_attributes(position, base_ovr):
    """Generate 19 Gaffer attributes centered around base_ovr for the position."""
    pos = position
    is_gk = pos == "GK"
    is_def = pos == "DEF"
    is_fwd = pos == "FWD"

    def attr(ceiling_boost=0):
        return max(1, min(99, base_ovr + random.randint(-10, 5) + ceiling_boost))

    return {
        "pace": attr(-15 if is_gk else 0),
        "burst": attr(-10 if is_gk else 0),
        "engine": attr(),
        "power": attr(5 if is_def or is_gk else 0),
        "agility": attr(-10 if is_gk else 0),
        "passing": attr(-10 if is_fwd else 0),
        "distribution": attr(-10 if is_fwd else 0),
        "touch": attr(-5 if is_def else 0),
        "finishing": attr(-30 if not is_fwd else 0, ),
        "defending": attr(10 if is_def else -20 if is_fwd else 0),
        "aerial": attr(5 if is_def or is_gk else 0),
        "anticipation": attr(),
        "vision": attr(-5 if is_fwd else 0),
        "decisions": attr(),
        "composure": attr(),
        "leadership": attr(),
        "shot_stopping": attr(20 if is_gk else -40),
        "commanding": attr(20 if is_gk else -40),
        "playing_out": attr(10 if is_gk else -30),
    }


def random_personality():
    return {
        "openness": random.randint(20, 90),
        "conscientiousness": random.randint(20, 90),
        "extraversion": random.randint(20, 90),
        "agreeableness": random.randint(20, 90),
        "neuroticism": random.randint(10, 80),
        "confidence": 100,
    }


def random_narrative_traits(attrs, personality):
    traits = []
    if attrs["defending"] >= 75 and attrs["engine"] >= 75:
        traits.append("PressingAnchor")
    if attrs["passing"] >= 80 and attrs["distribution"] >= 75:
        traits.append("TempoConductor")
    if attrs["touch"] >= 80 and attrs["pace"] >= 75:
        traits.append("ChaosWinger")
    if attrs["defending"] >= 80 and attrs["aerial"] >= 70:
        traits.append("DefensiveWall")
    if attrs["pace"] >= 80 and attrs["finishing"] >= 70:
        traits.append("CounterKiller")
    if personality["extraversion"] >= 70 and personality["neuroticism"] < 50:
        traits.append("BigGameResponder")
    if personality["neuroticism"] >= 70:
        traits.append("MediaSensitive")
    if personality["neuroticism"] <= 30 and attrs["composure"] >= 75:
        traits.append("IceCold")
    # Cap at 3
    return traits[:3] if len(traits) > 3 else traits


def generate_player(team_name, country, position, jersey_num):
    names = NAMES[country]
    first, last = random.choice(names)
    full_name = f"{first} {last}"
    match_name = last  # FBref-style: just surname

    age = random.randint(18, 34)
    birth_year = 2024 - age
    base_ovr = random.randint(60, 88)
    potential = min(99, base_ovr + random.randint(0, 15)) if age <= 23 else base_ovr

    attrs = random_attributes(position, base_ovr)
    personality = random_personality()
    narrative_traits = random_narrative_traits(attrs, personality)

    player_id = f"p_{match_name.lower().replace(' ', '_')}_{jersey_num}"

    return {
        "id": player_id,
        "match_name": full_name,
        "full_name": full_name,
        "date_of_birth": f"{birth_year}-{random.randint(1,12):02d}-{random.randint(1,28):02d}",
        "nationality": NATIONALITY_MAP[country],
        "position": position,
        "natural_position": position,
        "attributes": attrs,
        "personality": personality,
        "narrative_traits": narrative_traits,
        "stability_modifier": random.randint(30, 80),
        "ovr": base_ovr,
        "potential": potential,
        "team": team_name,
        "competition": "",
        "age": age,
        "height_cm": random.randint(170, 195),
        "weight_kg": random.randint(65, 90),
        "market_value": base_ovr * 1_000_000,
        "contract_end": f"{2024 + random.randint(2, 5)}-06-30",
        "wage": base_ovr * 1000,
    }


def generate_relationships(players):
    """Generate intra-team relationships (same-team players know each other)."""
    relationships = []
    by_team = {}
    for p in players:
        team = p["team"]
        if team not in by_team:
            by_team[team] = []
        by_team[team].append(p)

    for team, team_players in by_team.items():
        for i, p1 in enumerate(team_players):
            for j, p2 in enumerate(team_players):
                if i < j:
                    # Base strength 30-60, +/- random
                    strength = random.randint(20, 60) + random.randint(-10, 20)
                    strength = max(-30, min(95, strength))
                    # Same nationality bonus
                    if p1["nationality"] == p2["nationality"]:
                        strength = min(95, strength + 15)
                    relationships.append({
                        "player_a": p1["id"],
                        "player_b": p2["id"],
                        "strength": strength,
                        "volatility": 0.3,
                    })
    return relationships


def main():
    print("=" * 60)
    print("SYNTHETIC TEST DATA GENERATOR")
    print("=" * 60)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    random.seed(42)  # deterministic

    players = []
    for team in TEAMS:
        for idx, pos in enumerate(POSITIONS_PER_TEAM):
            player = generate_player(team["name"], team["country"], pos, idx + 1)
            players.append(player)

    print(f"Generated {len(players)} players across {len(TEAMS)} teams")

    relationships = generate_relationships(players)
    print(f"Generated {len(relationships)} intra-team relationships")

    output = {
        "name": "Gaffer Synthetic Test Database",
        "description": "50 synthetic players for testing the build_world.py parser",
        "version": 3,
        "generated": "2024-01-01T00:00:00Z",
        "source": "synthetic_test_data",
        "players": players,
        "relationships": relationships,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    file_size = OUTPUT_FILE.stat().st_size
    print(f"\nWrote {OUTPUT_FILE}")
    print(f"  Size: {file_size / 1024:.1f} KB")
    print(f"  Players: {len(players)}")
    print(f"  Relationships: {len(relationships)}")
    print(f"\nNow run: python3 build_world.py")


if __name__ == "__main__":
    main()
