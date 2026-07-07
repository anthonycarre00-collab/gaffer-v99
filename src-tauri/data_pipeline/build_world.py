#!/usr/bin/env python3
"""
Gaffer Phase 0.5 — Bundled World Database Builder

This script builds the pre-populated world database that ships with the
Gaffer desktop app. It reads player/team/league data from local CSV/JSON
files (downloaded from FBref, Transfermarkt, Understat, Sofascore),
aggregates them into 19 Gaffer attributes, infers Big Five personality
profiles, pre-computes relationship edges, assigns narrative traits,
and outputs a single JSON file ready to bundle with Tauri.

Usage:
    cd src-tauri/data_pipeline
    python3 build_world.py

Input files (place in data_pipeline/input/):
    - players_fbref.csv      (FBref stats export)
    - players_transfermarkt.csv  (Transfermarkt player info)
    - players_understat.csv  (Understat xG/xA data)
    - teams.json             (Team definitions with leagues)
    - staff.json             (Manager/coach/scout definitions)
    - rivalries.json         (Seeded rivalry pairs)

Output:
    ../databases/gaffer_world.json  (Bundled world database)

If input files are missing, the script generates a small sample world
with fictional players so the game is playable during development.
"""

import json
import os
import sys
import random
import hashlib
from pathlib import Path
from datetime import datetime

INPUT_DIR = Path(__file__).parent / "input"
OUTPUT_DIR = Path(__file__).parent.parent / "databases"
OUTPUT_FILE = OUTPUT_DIR / "gaffer_world.json"

# ===========================================================================
# Attribute normalization helpers
# ===========================================================================

def normalize_to_99(value, min_val, max_val, invert=False):
    """Normalize a value to 0-99 scale."""
    if max_val == min_val:
        return 50
    normalized = (value - min_val) / (max_val - min_val)
    if invert:
        normalized = 1.0 - normalized
    return max(1, min(99, int(normalized * 99)))

def normalize_percentile(percentile):
    """Convert a percentile (0-100) to Gaffer 0-99 scale."""
    return max(1, min(99, int(percentile * 0.99)))

def jitter(value, amount=3):
    """Add small random variation to avoid identical values."""
    return max(1, min(99, value + random.randint(-amount, amount)))

# ===========================================================================
# 19 Gaffer Attribute computation
# ===========================================================================

def compute_gaffer_attributes(player_data):
    """
    Compute 19 Gaffer attributes from raw player data.
    
    player_data should contain:
    - position: GK/DEF/MID/FWD
    - fbref stats: passes, long_passes, dribbles, tackles, interceptions, etc.
    - transfermarkt: height, weight, captain history
    - understat: xG, xA, shots, goals
    """
    pos = player_data.get("position", "MID")
    is_gk = pos == "GK"
    is_def = pos == "DEF"
    is_fwd = pos == "FWD"
    
    # Get raw stats with fallbacks
    fbref = player_data.get("fbref", {})
    tm = player_data.get("transfermarkt", {})
    understat = player_data.get("understat", {})
    
    # --- The Body (5) ---
    pace = normalize_percentile(fbref.get("pace_percentile", 50))
    burst = normalize_percentile(fbref.get("accel_percentile", 50))
    engine = normalize_percentile(fbref.get("stamina_percentile", 50))
    
    # Power from height/weight
    height = tm.get("height_cm", 180)
    weight = tm.get("weight_kg", 75)
    bmi = weight / ((height / 100) ** 2)
    power = normalize_to_99(bmi, 18, 28)
    if is_def or is_gk:
        power = min(99, power + 10)  # Defenders/GKs tend to be stronger
    
    agility = normalize_percentile(fbref.get("agility_percentile", 50))
    
    # --- The Ball (6) ---
    passing = normalize_percentile(fbref.get("pass_completion_percentile", 50))
    distribution = normalize_percentile(fbref.get("long_pass_percentile", 50))
    
    touch = normalize_percentile(fbref.get("dribble_success_percentile", 50))
    if is_gk:
        touch = jitter(30, 5)
    
    # Finishing from xG conversion
    xg = understat.get("xg", 0)
    goals = understat.get("goals", 0)
    if xg > 0:
        finishing = normalize_to_99(goals / xg, 0.5, 1.5)
    else:
        finishing = normalize_percentile(fbref.get("shot_percentile", 50))
    if is_gk:
        finishing = jitter(20, 5)
    
    defending = normalize_percentile(fbref.get("tackles_interceptions_percentile", 50))
    if is_fwd:
        defending = max(10, defending - 15)
    
    aerial = normalize_percentile(fbref.get("aerial_duel_percentile", 50))
    
    # --- The Head (5) ---
    anticipation = normalize_percentile(fbref.get("interceptions_percentile", 50))
    vision = normalize_percentile(fbref.get("key_passes_percentile", 50))
    decisions = normalize_percentile(fbref.get("pass_accuracy_under_pressure_percentile", 50))
    composure = normalize_percentile(understat.get("big_chance_conversion_percentile", 50))
    
    # Leadership from captaincy
    captain_history = tm.get("captain_matches", 0)
    leadership = normalize_to_99(captain_history, 0, 100)
    leadership = max(20, min(99, leadership + 30))  # Floor at 20
    
    # --- The Gloves (3, GK only) ---
    if is_gk:
        shot_stopping = normalize_percentile(fbref.get("save_percentile", 50))
        commanding = normalize_percentile(fbref.get("cross_claim_percentile", 50))
        playing_out = normalize_percentile(fbref.get("gk_pass_accuracy_percentile", 50))
    else:
        shot_stopping = jitter(15, 5)
        commanding = jitter(20, 5)
        playing_out = jitter(30, 5)
    
    return {
        "pace": jitter(pace), "burst": jitter(burst), "engine": jitter(engine),
        "power": jitter(power), "agility": jitter(agility),
        "passing": jitter(passing), "distribution": jitter(distribution),
        "touch": jitter(touch), "finishing": jitter(finishing),
        "defending": jitter(defending), "aerial": jitter(aerial),
        "anticipation": jitter(anticipation), "vision": jitter(vision),
        "decisions": jitter(decisions), "composure": jitter(composure),
        "leadership": jitter(leadership),
        "shot_stopping": jitter(shot_stopping), "commanding": jitter(commanding),
        "playing_out": jitter(playing_out),
    }

# ===========================================================================
# Big Five Personality Inference
# ===========================================================================

def infer_big_five(player_data):
    """
    Infer Big Five personality from observable football data.
    Returns (openness, conscientiousness, extraversion, agreeableness, neuroticism, confidence).
    
    See: docs/gaffer/PLAYER_ATTRIBUTES_PROPOSAL.md §5.3
    """
    fbref = player_data.get("fbref", {})
    tm = player_data.get("transfermarkt", {})
    understat = player_data.get("understat", {})
    
    # --- Openness (creativity / flair) ---
    dribble_attempts = fbref.get("dribbles_per90", 0)
    through_balls = fbref.get("through_balls_per90", 0)
    key_passes = fbref.get("key_passes_per90", 0)
    openness_score = (dribble_attempts * 5 + through_balls * 10 + key_passes * 3)
    openness = normalize_to_99(openness_score, 0, 20)
    
    # --- Conscientiousness (discipline) ---
    yellow_cards = tm.get("yellow_cards", 0)
    red_cards = tm.get("red_cards", 0)
    career_years = tm.get("career_years", 5)
    injury_days = tm.get("injury_days_last_year", 0)
    # Lower cards + longer career + fewer injuries = more conscientious
    card_penalty = min(30, (yellow_cards + red_cards * 3))
    conscientiousness = 80 - card_penalty + min(20, career_years * 2) - min(20, injury_days // 5)
    conscientiousness = max(20, min(99, conscientiousness))
    
    # --- Extraversion (leadership / sociability) ---
    captain_matches = tm.get("captain_matches", 0)
    international_caps = tm.get("international_caps", 0)
    extraversion = normalize_to_99(captain_matches + international_caps * 0.5, 0, 100)
    extraversion = max(30, min(99, extraversion + 20))
    
    # --- Agreeableness (cooperation) ---
    assists = understat.get("assists", 0)
    shots = understat.get("shots", 0)
    if shots > 0:
        assist_ratio = assists / (shots + assists)
    else:
        assist_ratio = 0.3
    agreeableness = normalize_to_99(assist_ratio, 0, 0.6)
    
    # --- Neuroticism (volatility) ---
    red_card_rate = red_cards / max(1, tm.get("appearances", 1))
    form_variance = fbref.get("rating_std_dev", 1.0)
    neuroticism = normalize_to_99(red_card_rate * 100 + form_variance * 20, 0, 30)
    neuroticism = max(10, min(95, neuroticism))
    
    # --- Confidence (data availability) ---
    has_fbref = bool(fbref)
    has_tm = bool(tm)
    has_understat = bool(understat)
    confidence = sum([has_fbref * 30, has_tm * 35, has_understat * 35])
    
    return {
        "openness": openness,
        "conscientiousness": conscientiousness,
        "extraversion": extraversion,
        "agreeableness": agreeableness,
        "neuroticism": neuroticism,
        "confidence": confidence,
    }

# ===========================================================================
# Narrative Trait Assignment
# ===========================================================================

NARRATIVE_TRAITS = {
    "technical_identity": [
        "PressingAnchor", "TempoConductor", "ChaosWinger", "DefensiveWall", "CounterKiller"
    ],
    "psychological": [
        "BigGameResponder", "MediaSensitive", "ProveThemWrong", "IceCold", "EmotionalReactor"
    ],
    "social": [
        "DressingRoomAlpha", "QuietStabilizer", "CliqueBuilder", "IsolationRisk"
    ],
}

def assign_narrative_traits(attrs, personality, player_data):
    """Assign 0-5 narrative traits based on attributes + personality + career history."""
    traits = []
    pos = player_data.get("position", "MID")
    
    # Technical Identity (max 5)
    if attrs["defending"] >= 75 and attrs["engine"] >= 75:
        traits.append("PressingAnchor")
    if attrs["passing"] >= 80 and attrs["distribution"] >= 75:
        traits.append("TempoConductor")
    if attrs["touch"] >= 80 and attrs["pace"] >= 75 and pos == "FWD":
        traits.append("ChaosWinger")
    if attrs["defending"] >= 80 and attrs["aerial"] >= 70:
        traits.append("DefensiveWall")
    if attrs["pace"] >= 80 and attrs["finishing"] >= 70:
        traits.append("CounterKiller")
    
    # Psychological (max 2)
    psych_candidates = []
    if personality["extraversion"] >= 70 and personality["neuroticism"] < 50:
        psych_candidates.append("BigGameResponder")
    if personality["neuroticism"] >= 70:
        psych_candidates.append("MediaSensitive")
    if personality["neuroticism"] >= 60 and personality["conscientiousness"] >= 60:
        psych_candidates.append("ProveThemWrong")
    if personality["neuroticism"] <= 30 and attrs["composure"] >= 75:
        psych_candidates.append("IceCold")
    if personality["neuroticism"] >= 70 and personality["extraversion"] >= 60:
        psych_candidates.append("EmotionalReactor")
    
    # Pick up to 2 psychological traits
    random.shuffle(psych_candidates)
    traits.extend(psych_candidates[:2])
    
    # Social (max 2)
    social_candidates = []
    if personality["extraversion"] >= 75 and attrs["leadership"] >= 70:
        social_candidates.append("DressingRoomAlpha")
    if personality["agreeableness"] >= 70 and personality["neuroticism"] <= 40:
        social_candidates.append("QuietStabilizer")
    if personality["extraversion"] >= 65 and personality["agreeableness"] >= 60:
        social_candidates.append("CliqueBuilder")
    if personality["agreeableness"] <= 35 and personality["neuroticism"] >= 50:
        social_candidates.append("IsolationRisk")
    
    random.shuffle(social_candidates)
    traits.extend(social_candidates[:2])
    
    return traits

# ===========================================================================
# Relationship Pre-computation
# ===========================================================================

def compute_relationships(players):
    """
    Pre-compute relationship edges between players.
    
    Creates edges based on:
    - Shared nationality (positive +20)
    - Same team (positive +40)
    - Shared age band (positive +10)
    - Random variance (±15)
    """
    relationships = []
    
    # Group players by team and nationality
    by_team = {}
    by_nationality = {}
    for p in players:
        team_id = p.get("team_id", "")
        nat = p.get("nationality", "")
        by_team.setdefault(team_id, []).append(p)
        by_nationality.setdefault(nat, []).append(p)
    
    # Create edges for players on the same team
    for team_id, team_players in by_team.items():
        if not team_id:
            continue
        for i in range(len(team_players)):
            for j in range(i + 1, len(team_players)):
                p1 = team_players[i]
                p2 = team_players[j]
                
                strength = 40  # Base for teammates
                
                # Shared nationality bonus
                if p1.get("nationality") == p2.get("nationality"):
                    strength += 20
                
                # Age proximity
                age1 = p1.get("age", 25)
                age2 = p2.get("age", 25)
                if abs(age1 - age2) <= 3:
                    strength += 10
                
                # Random variance
                strength += random.randint(-15, 15)
                strength = max(-30, min(95, strength))
                
                relationships.append({
                    "player_a": p1["id"],
                    "player_b": p2["id"],
                    "strength": strength,
                    "volatility": 0.3,
                })
    
    return relationships

# ===========================================================================
# Sample World Generator (fallback when no input data)
# ===========================================================================

SAMPLE_NAMES = [
    ("James", "Wilson", "ENG"), ("Carlos", "Silva", "BRA"), ("Marco", "Rossi", "ITA"),
    ("Pierre", "Dubois", "FRA"), ("Hans", "Mueller", "GER"), ("Diego", "Fernandez", "ESP"),
    ("Lars", "Andersen", "DEN"), ("Jan", "Kowalski", "POL"), ("Sven", "Eriksson", "SWE"),
    ("Rui", "Costa", "POR"), ("Michael", "O'Brien", "IRL"), ("Andrei", "Volkov", "RUS"),
]

SAMPLE_TEAMS = [
    {"name": "London FC", "short_name": "LFC", "city": "London", "country": "ENG", "reputation": 750},
    {"name": "Manchester Reds", "short_name": "MNR", "city": "Manchester", "country": "ENG", "reputation": 800},
    {"name": "Madrid Athletic", "short_name": "MAT", "city": "Madrid", "country": "ESP", "reputation": 850},
    {"name": "Barcelona United", "short_name": "BCN", "city": "Barcelona", "country": "ESP", "reputation": 820},
    {"name": "Munich FC", "short_name": "MUN", "city": "Munich", "country": "GER", "reputation": 780},
    {"name": "Paris SG", "short_name": "PSG", "city": "Paris", "country": "FRA", "reputation": 830},
    {"name": "Turin FC", "short_name": "TUR", "city": "Turin", "country": "ITA", "reputation": 790},
    {"name": "Lisbon SC", "short_name": "LIS", "city": "Lisbon", "country": "POR", "reputation": 700},
]

def generate_sample_world():
    """Generate a small sample world with fictional players for development."""
    random.seed(42)
    
    players = []
    teams = []
    
    for team_idx, team_def in enumerate(SAMPLE_TEAMS):
        team_id = f"team_{team_idx + 1}"
        team = {
            "id": team_id,
            "name": team_def["name"],
            "short_name": team_def["short_name"],
            "city": team_def["city"],
            "country": team_def["country"],
            "reputation": team_def["reputation"],
            "finance": team_def["reputation"] * 5000,
            "formation": "4-3-3",
            "play_style": "Balanced",
            "stadium_name": f"{team_def['city']} Stadium",
            "stadium_capacity": 50000,
            "colors": {"primary": "#1e40af", "secondary": "#ffffff"},
            "founded_year": 1900,
            "wage_budget": team_def["reputation"] * 1000,
            "transfer_budget": team_def["reputation"] * 5000,
            "season_income": 0,
            "season_expenses": 0,
            "starting_xi_ids": [],
            "form": [],
            "history": [],
        }
        teams.append(team)
        
        # Generate 18 players per team
        positions = ["GK"] + ["DEF"] * 5 + ["MID"] * 6 + ["FWD"] * 6
        for player_idx, pos in enumerate(positions):
            first, last, nat = random.choice(SAMPLE_NAMES)
            player_id = f"p_{team_idx + 1}_{player_idx + 1}"
            
            # Generate attributes based on position
            base = team_def["reputation"] // 10  # ~70-85
            is_gk = pos == "GK"
            
            attrs = {
                "pace": base + random.randint(-10, 10),
                "burst": base + random.randint(-10, 10),
                "engine": base + random.randint(-10, 10),
                "power": base + random.randint(-10, 10),
                "agility": base + random.randint(-10, 10),
                "passing": base + random.randint(-10, 10),
                "distribution": base + random.randint(-15, 5),
                "touch": base + random.randint(-10, 10) if not is_gk else 30 + random.randint(-5, 5),
                "finishing": base + random.randint(-10, 10) if pos == "FWD" else base - 20 + random.randint(-5, 5),
                "defending": base + random.randint(-10, 10) if pos == "DEF" else base - 15 + random.randint(-5, 5),
                "aerial": base + random.randint(-10, 10),
                "anticipation": base + random.randint(-10, 10),
                "vision": base + random.randint(-10, 10),
                "decisions": base + random.randint(-10, 10),
                "composure": base + random.randint(-10, 10),
                "leadership": base - 10 + random.randint(-5, 15),
                "shot_stopping": base + random.randint(-5, 10) if is_gk else 15 + random.randint(-5, 5),
                "commanding": base + random.randint(-5, 10) if is_gk else 20 + random.randint(-5, 5),
                "playing_out": base + random.randint(-10, 5) if is_gk else 30 + random.randint(-5, 5),
            }
            # Clamp all to 1-99
            for k in attrs:
                attrs[k] = max(1, min(99, attrs[k]))
            
            # Generate personality
            personality = {
                "openness": 30 + random.randint(0, 50),
                "conscientiousness": 40 + random.randint(0, 50),
                "extraversion": 30 + random.randint(0, 50),
                "agreeableness": 40 + random.randint(0, 50),
                "neuroticism": 20 + random.randint(0, 60),
                "confidence": 100,  # Generated players = full confidence
            }
            
            # Assign narrative traits
            narrative_traits = assign_narrative_traits(attrs, personality, {"position": pos})
            
            age = random.randint(17, 35)
            player = {
                "id": player_id,
                "match_name": f"{first[0]}. {last}",
                "full_name": f"{first} {last}",
                "date_of_birth": f"{2026 - age}-{'{:02d}'.format(random.randint(1, 12))}-{'{:02d}'.format(random.randint(1, 28))}",
                "nationality": nat,
                "football_nation": nat,
                "position": pos,
                "natural_position": pos,
                "alternate_positions": [],
                "footedness": "Right",
                "weak_foot": 2,
                "attributes": attrs,
                "condition": 100,
                "morale": 75,
                "fitness": 75,
                "injury": None,
                "team_id": team_id,
                "retired": False,
                "squad_role": "Senior",
                "traits": [],
                "personality": personality,
                "stability_modifier": 50,
                "narrative_traits": narrative_traits,
                "ovr": sum(attrs.values()) // len(attrs),
                "potential": max(attrs.values()) + random.randint(0, 10),
                "contract_end": "2028-06-30",
                "wage": team_def["reputation"] * 10,
                "market_value": team_def["reputation"] * 1000,
                "stats": {
                    "appearances": 0, "goals": 0, "assists": 0, "clean_sheets": 0,
                    "yellow_cards": 0, "red_cards": 0, "avg_rating": 0.0, "minutes_played": 0,
                    "shots": 0, "shots_on_target": 0, "passes_completed": 0, "passes_attempted": 0,
                    "tackles_won": 0, "interceptions": 0, "fouls_committed": 0,
                },
                "career": [],
                "movement_history": [],
                "training_focus": None,
                "transfer_listed": False,
                "loan_listed": False,
                "transfer_offers": [],
                "loan_offers": [],
                "active_loan": None,
                "morale_core": {"manager_trust": 50, "unresolved_issue": None, "recent_treatment": None, "pending_promise": None, "talk_cooldown_until": None, "renewal_state": None},
                "jersey_number": player_idx + 1,
            }
            players.append(player)
    
    # Compute relationships
    relationships = compute_relationships(players)
    
    # Seeded rivalries
    rivalries = [
        {"team_a": "team_1", "team_b": "team_2", "name": "Manchester-London Derby", "intensity": 80},
        {"team_a": "team_3", "team_b": "team_4", "name": "El Clásico", "intensity": 95},
        {"team_a": "team_5", "team_b": "team_6", "name": "Der Klassiker", "intensity": 75},
    ]
    
    # League definition
    league = {
        "id": "league_1",
        "name": "Gaffer Premier League",
        "country": "International",
        "num_teams": len(teams),
        "reputation": 800,
    }
    
    return {
        "name": "Gaffer Default World",
        "description": "Sample world with fictional players for development. Replace with real player data.",
        "version": 2,
        "teams": teams,
        "players": players,
        "staff": [],
        "league": league,
        "relationships": relationships,
        "rivalries": rivalries,
        "deterministic_seed": 42,
    }

# ===========================================================================
# Main
# ===========================================================================

def main():
    print("=" * 60)
    print("GAFFER WORLD DATABASE BUILDER")
    print("=" * 60)
    
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Check if input data exists
    has_input = INPUT_DIR.exists() and any(INPUT_DIR.iterdir())
    
    if has_input:
        print("\n[1] Reading input data from data_pipeline/input/...")
        # TODO: Read real player data from CSV/JSON files
        # For now, fall through to sample generation
        print("  (Input data found but parser not yet implemented — using sample world)")
        world = generate_sample_world()
    else:
        print("\n[1] No input data found — generating sample world...")
        world = generate_sample_world()
    
    print(f"\n[2] World generated:")
    print(f"  Teams: {len(world['teams'])}")
    print(f"  Players: {len(world['players'])}")
    print(f"  Relationships: {len(world['relationships'])}")
    print(f"  Rivalries: {len(world['rivalries'])}")
    
    # Count players with narrative traits
    traits_count = sum(len(p.get("narrative_traits", [])) for p in world["players"])
    print(f"  Narrative traits assigned: {traits_count}")
    
    # Count players with personality
    has_personality = sum(1 for p in world["players"] if p.get("personality", {}).get("confidence", 0) > 0)
    print(f"  Players with personality: {has_personality}")
    
    print(f"\n[3] Writing to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(world, f, indent=2, ensure_ascii=False)
    
    file_size = OUTPUT_FILE.stat().st_size
    print(f"\n[4] Done! Output: {OUTPUT_FILE}")
    print(f"  File size: {file_size / 1024:.1f} KB")
    print(f"\n  To use: Copy to src-tauri/databases/ and select when starting a new game.")

if __name__ == "__main__":
    main()
