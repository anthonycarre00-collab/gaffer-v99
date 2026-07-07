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
# Real-data pipeline — converts scraper.html output to WorldData format
# ===========================================================================

# Hand-curated team metadata for top Big 5 leagues teams.
# Procedural generation fills in any team not listed here.
TEAM_METADATA = {
    # Premier League
    "Arsenal": {"id": "arsenal", "short_name": "ARS", "league": "Premier League", "country": "England", "reputation": 85, "city": "London", "stadium": "Emirates Stadium", "capacity": 60704, "formation": "4-3-3"},
    "Manchester City": {"id": "man_city", "short_name": "MCI", "league": "Premier League", "country": "England", "reputation": 90, "city": "Manchester", "stadium": "Etihad Stadium", "capacity": 53400, "formation": "4-3-3"},
    "Liverpool": {"id": "liverpool", "short_name": "LIV", "league": "Premier League", "country": "England", "reputation": 88, "city": "Liverpool", "stadium": "Anfield", "capacity": 61276, "formation": "4-3-3"},
    "Manchester United": {"id": "man_united", "short_name": "MUN", "league": "Premier League", "country": "England", "reputation": 85, "city": "Manchester", "stadium": "Old Trafford", "capacity": 74310, "formation": "4-2-3-1"},
    "Chelsea": {"id": "chelsea", "short_name": "CHE", "league": "Premier League", "country": "England", "reputation": 82, "city": "London", "stadium": "Stamford Bridge", "capacity": 40341, "formation": "4-2-3-1"},
    "Tottenham": {"id": "tottenham", "short_name": "TOT", "league": "Premier League", "country": "England", "reputation": 80, "city": "London", "stadium": "Tottenham Hotspur Stadium", "capacity": 62850, "formation": "4-2-3-1"},
    # La Liga
    "Real Madrid": {"id": "real_madrid", "short_name": "RMA", "league": "La Liga", "country": "Spain", "reputation": 92, "city": "Madrid", "stadium": "Santiago Bernabéu", "capacity": 81044, "formation": "4-3-3"},
    "Barcelona": {"id": "barcelona", "short_name": "BAR", "league": "La Liga", "country": "Spain", "reputation": 90, "city": "Barcelona", "stadium": "Camp Nou", "capacity": 99354, "formation": "4-3-3"},
    "Atlético Madrid": {"id": "atletico_madrid", "short_name": "ATM", "league": "La Liga", "country": "Spain", "reputation": 84, "city": "Madrid", "stadium": "Metropolitano", "capacity": 67700, "formation": "3-5-2"},
    # Serie A
    "Inter": {"id": "inter", "short_name": "INT", "league": "Serie A", "country": "Italy", "reputation": 84, "city": "Milan", "stadium": "San Siro", "capacity": 75923, "formation": "3-5-2"},
    "Milan": {"id": "milan", "short_name": "MIL", "league": "Serie A", "country": "Italy", "reputation": 82, "city": "Milan", "stadium": "San Siro", "capacity": 75923, "formation": "4-2-3-1"},
    "Juventus": {"id": "juventus", "short_name": "JUV", "league": "Serie A", "country": "Italy", "reputation": 83, "city": "Turin", "stadium": "Allianz Stadium", "capacity": 41507, "formation": "4-3-3"},
    "Napoli": {"id": "napoli", "short_name": "NAP", "league": "Serie A", "country": "Italy", "reputation": 80, "city": "Naples", "stadium": "Diego Maradona", "capacity": 54726, "formation": "4-3-3"},
    # Bundesliga
    "Bayern Munich": {"id": "bayern_munich", "short_name": "BAY", "league": "Bundesliga", "country": "Germany", "reputation": 90, "city": "Munich", "stadium": "Allianz Arena", "capacity": 75000, "formation": "4-2-3-1"},
    "Borussia Dortmund": {"id": "dortmund", "short_name": "DOR", "league": "Bundesliga", "country": "Germany", "reputation": 82, "city": "Dortmund", "stadium": "Signal Iduna Park", "capacity": 81365, "formation": "4-2-3-1"},
    "Bayer Leverkusen": {"id": "leverkusen", "short_name": "LEV", "league": "Bundesliga", "country": "Germany", "reputation": 78, "city": "Leverkusen", "stadium": "BayArena", "capacity": 30210, "formation": "3-4-3"},
    # Ligue 1
    "Paris SG": {"id": "psg", "short_name": "PSG", "league": "Ligue 1", "country": "France", "reputation": 88, "city": "Paris", "stadium": "Parc des Princes", "capacity": 47929, "formation": "4-3-3"},
    "Marseille": {"id": "marseille", "short_name": "MAR", "league": "Ligue 1", "country": "France", "reputation": 76, "city": "Marseille", "stadium": "Vélodrome", "capacity": 67394, "formation": "4-2-3-1"},
}

# Seeded rivalry pairs (hand-curated)
SEEDED_RIVALRIES = [
    {"team_a": "arsenal", "team_b": "tottenham", "name": "North London Derby", "intensity": 95},
    {"team_a": "man_united", "team_b": "man_city", "name": "Manchester Derby", "intensity": 90},
    {"team_a": "man_united", "team_b": "liverpool", "name": "North West Derby", "intensity": 95},
    {"team_a": "arsenal", "team_b": "chelsea", "name": "London Derby", "intensity": 75},
    {"team_a": "real_madrid", "team_b": "barcelona", "name": "El Clásico", "intensity": 100},
    {"team_a": "real_madrid", "team_b": "atletico_madrid", "name": "Madrid Derby", "intensity": 85},
    {"team_a": "inter", "team_b": "juventus", "name": "Derby d'Italia", "intensity": 85},
    {"team_a": "inter", "team_b": "milan", "name": "Derby della Madonnina", "intensity": 90},
    {"team_a": "bayern_munich", "team_b": "dortmund", "name": "Der Klassiker", "intensity": 85},
    {"team_a": "psg", "team_b": "marseille", "name": "Le Classique", "intensity": 85},
]

# Map scraper position codes to Gaffer Position enum strings
POSITION_MAP = {
    "GK": "Goalkeeper",
    "DEF": "Defender",
    "MID": "Midfielder",
    "FWD": "Forward",
}


def slugify(name):
    """Convert a team name to a slug ID (e.g., 'Manchester City' → 'manchester_city')."""
    return name.lower().replace(" ", "_").replace(".", "").replace("-", "_")


def get_team_metadata(team_name):
    """Look up hand-curated metadata, or generate procedurally if not found."""
    if team_name in TEAM_METADATA:
        meta = TEAM_METADATA[team_name]
        return {
            "id": meta["id"],
            "name": team_name,
            "short_name": meta.get("short_name") or "".join(w[0] for w in team_name.split()[:3]).upper()[:3],
            "country": meta["country"],
            "football_nation": meta["country"],
            "city": meta["city"],
            "stadium_name": meta["stadium"],
            "stadium_capacity": meta["capacity"],
            "league_id": slugify(meta["league"]),
            "league_name": meta["league"],
            "reputation": meta["reputation"] * 10,  # scale to 0-1000
            "formation": meta["formation"],
            "finance": 50_000_000,
            "wage_budget": 5_000_000,
            "transfer_budget": 50_000_000,
            "play_style": "Balanced",
        }
    # Procedural fallback — derive short_name from first 3 chars of team name
    short_name = team_name[:3].upper()
    return {
        "id": slugify(team_name),
        "name": team_name,
        "short_name": short_name,
        "country": "Unknown",
        "football_nation": "Unknown",
        "city": "Unknown",
        "stadium_name": f"{team_name} Stadium",
        "stadium_capacity": 30000,
        "league_id": "unknown_league",
        "league_name": "Unknown League",
        "reputation": 500,
        "formation": "4-4-2",
        "finance": 10_000_000,
        "wage_budget": 1_000_000,
        "transfer_budget": 5_000_000,
        "play_style": "Balanced",
    }


def convert_scraper_player(player_data, team_id, jersey_number):
    """Convert a scraper-format player to WorldData player format."""
    pos_str = player_data.get("position", "MID")
    position = POSITION_MAP.get(pos_str, "Midfielder")

    attrs = player_data.get("attributes", {})
    personality = player_data.get("personality", {})
    narrative_traits = player_data.get("narrative_traits", [])

    return {
        "id": player_data.get("id", slugify(player_data.get("match_name", "unknown"))),
        "match_name": player_data.get("match_name", "Unknown"),
        "full_name": player_data.get("full_name", player_data.get("match_name", "Unknown")),
        "date_of_birth": player_data.get("date_of_birth", "2000-01-01"),
        "nationality": player_data.get("nationality", "ENG"),
        "football_nation": player_data.get("nationality", "ENG"),
        "birth_country": player_data.get("nationality", "ENG"),
        "media": {"face": None},
        "position": position,
        "natural_position": position,
        "alternate_positions": [],
        "footedness": "Right",
        "weak_foot": 3,
        "attributes": {
            "pace": attrs.get("pace", 50),
            "burst": attrs.get("burst", 50),
            "engine": attrs.get("engine", 50),
            "power": attrs.get("power", 50),
            "agility": attrs.get("agility", 50),
            "passing": attrs.get("passing", 50),
            "distribution": attrs.get("distribution", 50),
            "touch": attrs.get("touch", 50),
            "finishing": attrs.get("finishing", 50),
            "defending": attrs.get("defending", 50),
            "aerial": attrs.get("aerial", 50),
            "anticipation": attrs.get("anticipation", 50),
            "vision": attrs.get("vision", 50),
            "decisions": attrs.get("decisions", 50),
            "composure": attrs.get("composure", 50),
            "leadership": attrs.get("leadership", 50),
            "shot_stopping": attrs.get("shot_stopping", 50),
            "commanding": attrs.get("commanding", 50),
            "playing_out": attrs.get("playing_out", 50),
        },
        "condition": 100,
        "morale": 75,
        "fitness": 75,
        "injury": None,
        "team_id": team_id,
        "retired": False,
        "former_team_id": None,
        "retired_season": None,
        "squad_role": "Senior",
        "traits": [],
        "personality": {
            "openness": personality.get("openness", 50),
            "conscientiousness": personality.get("conscientiousness", 50),
            "extraversion": personality.get("extraversion", 50),
            "agreeableness": personality.get("agreeableness", 50),
            "neuroticism": personality.get("neuroticism", 50),
            "confidence": personality.get("confidence", 100),
        },
        "stability_modifier": player_data.get("stability_modifier", 50),
        "narrative_traits": narrative_traits,
        "ovr": player_data.get("ovr", 50),
        "potential": player_data.get("potential", player_data.get("ovr", 50)),
        "contract_end": player_data.get("contract_end", "2028-06-30"),
        "wage": player_data.get("wage", 10000),
        "market_value": player_data.get("market_value", 1_000_000),
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
        "jersey_number": jersey_number,
    }


def build_world_from_scraper_data(scraper_file):
    """
    Build a complete WorldData dict from scraper.html output (gaffer_players.json).

    The scraper produces players with 19 Gaffer attributes, Big Five personality,
    and narrative traits. This function:
    1. Loads the scraper output
    2. Groups players by team → generates team records (hand-curated metadata
       for top teams, procedural for others)
    3. Converts each player to WorldData format
    4. Passes through relationships from the scraper
    5. Loads hand-curated rivalries
    6. Returns a complete WorldData dict ready for gaffer_world.json
    """
    with open(scraper_file, "r", encoding="utf-8") as f:
        scraper_data = json.load(f)

    scraper_players = scraper_data.get("players", [])
    scraper_relationships = scraper_data.get("relationships", [])

    print(f"  Loaded {len(scraper_players)} players from scraper output")
    print(f"  Loaded {len(scraper_relationships)} pre-computed relationships")

    # Group players by team
    players_by_team = {}
    for p in scraper_players:
        team = p.get("team", "Unknown")
        if team not in players_by_team:
            players_by_team[team] = []
        players_by_team[team].append(p)

    print(f"  Found {len(players_by_team)} teams")

    # Generate team records
    teams = []
    team_id_map = {}  # team_name → team_id
    for team_name, team_players in players_by_team.items():
        meta = get_team_metadata(team_name)
        team_id_map[team_name] = meta["id"]
        teams.append({
            "id": meta["id"],
            "name": meta["name"],
            "short_name": meta["short_name"],
            "country": meta["country"],
            "football_nation": meta["football_nation"],
            "city": meta["city"],
            "stadium_name": meta["stadium_name"],
            "stadium_capacity": meta["stadium_capacity"],
            "reputation": meta["reputation"],
            "finance": meta["finance"],
            "wage_budget": meta["wage_budget"],
            "transfer_budget": meta["transfer_budget"],
            "formation": meta["formation"],
            "play_style": meta["play_style"],
            "manager_id": None,
            "training_focus": "Tactical",
            "training_intensity": "Medium",
            "training_schedule": "Balanced",
            "training_groups": [],
            "form": [],
            "facilities": {"training": 1, "medical": 1, "youth": 1},
            "kit_pattern": "Solid",
            "primary_color": "#1a1a1a",
            "secondary_color": "#ffffff",
        })

    # Convert players to WorldData format
    players = []
    for team_name, team_players in players_by_team.items():
        team_id = team_id_map[team_name]
        for idx, scraper_player in enumerate(team_players):
            player = convert_scraper_player(scraper_player, team_id, idx + 1)
            players.append(player)

    print(f"  Converted {len(players)} players to WorldData format")

    # Pass through relationships from scraper (already in the right format)
    relationships = scraper_relationships
    print(f"  Preserved {len(relationships)} relationships")

    # Load seeded rivalries
    rivalries = SEEDED_RIVALRIES
    print(f"  Loaded {len(rivalries)} seeded rivalries")

    # Generate leagues from team metadata
    leagues_by_name = {}
    for team in teams:
        meta = get_team_metadata(team["name"])
        league_name = meta["league_name"]
        if league_name not in leagues_by_name and league_name != "Unknown League":
            leagues_by_name[league_name] = {
                "id": slugify(league_name),
                "name": league_name,
                "country": meta["country"],
                "num_teams": sum(1 for t in teams if get_team_metadata(t["name"])["league_name"] == league_name),
                "reputation": 800,
            }
    leagues = list(leagues_by_name.values())

    # Use the first league as the "primary" league for backward compat
    primary_league = leagues[0] if leagues else None

    # Deterministic seed from player count + first player ID
    seed_str = f"{len(players)}:{scraper_players[0].get('id', 'x')}" if scraper_players else "0"
    deterministic_seed = int(hashlib.md5(seed_str.encode()).hexdigest()[:8], 16)

    return {
        "name": "Gaffer Real World",
        "description": f"Real player data from FBref Big 5 ({len(players)} players, {len(teams)} teams)",
        "version": 3,
        "teams": teams,
        "players": players,
        "staff": [],
        "competitions": leagues,
        "league": primary_league,
        "relationships": relationships,
        "rivalries": rivalries,
        "deterministic_seed": deterministic_seed,
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
        print("\n[1] Reading real player data from data_pipeline/input/...")
        scraper_file = INPUT_DIR / "gaffer_players.json"
        if scraper_file.exists():
            print(f"  Found {scraper_file.name} ({scraper_file.stat().st_size / 1024:.1f} KB)")
            world = build_world_from_scraper_data(scraper_file)
        else:
            print(f"  gaffer_players.json not found in {INPUT_DIR}")
            print("  Run scraper.html first to produce it, then re-run this script.")
            print("  Falling back to sample world...")
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
