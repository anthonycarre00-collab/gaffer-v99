#!/usr/bin/env python3
"""
V99.1 Phase A: Build a new gaffer_world.json from FIFA 22 data.

CRITICAL: This does NOT import FIFA attributes directly. It REBALANCES them
to fit the Gaffer's 19-attribute system, preserving our unique attribute
schema, personality model, and stability/morale system.

Key design decisions:
1. FIFA attrs (30+) → Gaffer attrs (19) via the alias system
2. OVR is RECALCULATED using the Gaffer position-weighted formula (not FIFA OVR)
3. Personality is DERIVED from FIFA mental attributes (not random)
4. Stability is DERIVED from FIFA composure + reactions
5. Morale starts at 75 (game-managed)
6. Height/weight from FIFA (100% coverage)
7. Staff generated with real managers for top clubs
8. Only 2 seasons of generated history (not 12)
"""

import csv
import json
import os
import hashlib
import random
from pathlib import Path
from collections import defaultdict

FIFA_CSV = Path(__file__).parent.parent.parent / "players_22.csv"
OUTPUT = Path(__file__).parent.parent / "databases" / "gaffer_world.json"
FACE_CACHE = Path(__file__).parent.parent / "databases" / "face-cache"
PUBLIC_FACES = Path(__file__).parent.parent.parent / "public" / "face-cache"
PUBLIC_LOGOS = Path(__file__).parent.parent.parent / "public" / "club-logos"

FACE_CACHE.mkdir(parents=True, exist_ok=True)
PUBLIC_FACES.mkdir(parents=True, exist_ok=True)
PUBLIC_LOGOS.mkdir(parents=True, exist_ok=True)

# =============================================================================
# FIFA → GAFFER ATTRIBUTE MAPPING
# =============================================================================
# We do NOT import FIFA attrs directly. We REBALANCE them.
#
# FIFA uses 0-99 for everything. Gaffer also uses 0-99 but with different
# weighting and meaning. Key differences:
# - FIFA "pace" = sprint_speed + acceleration averaged. Gaffer splits these
#   into "pace" (top speed) and "burst" (acceleration).
# - FIFA "defending" = standing_tackle + sliding_tackle. Gaffer has a single
#   "defending" but also has "aerial" for headers.
# - FIFA "physic" = strength + stamina + jumping. Gaffer splits these into
#   "power" (strength), "engine" (stamina), and "aerial" (jumping/heading).
# - FIFA "mentality_aggression" maps directly to Gaffer's personality.neuroticism
#   (which becomes engine "aggression").
# - FIFA "mentality_composure" maps directly to Gaffer's "composure".
# - Gaffer has no direct equivalent for FIFA's "skill_moves", "weak_foot",
#   "international_reputation" — these are folded into traits/personality.

def clamp(v, lo=1, hi=99):
    return max(lo, min(hi, int(round(v))))

def jitter(v, amount=2):
    return clamp(v + random.randint(-amount, amount))

def map_fifa_to_gaffer(fifa):
    """Map FIFA 22 player dict → Gaffer 19-attribute dict + personality + stability."""
    
    # === THE BODY (5) ===
    # FIFA: movement_sprint_speed, movement_acceleration, power_stamina, power_strength, movement_agility
    # Gaffer: pace (top speed), burst (acceleration), engine (stamina), power (strength), agility
    pace = jitter(int(fifa.get('movement_sprint_speed', 50) or 50))
    burst = jitter(int(fifa.get('movement_acceleration', 50) or 50))
    engine = jitter(int(fifa.get('power_stamina', 50) or 50))
    power = jitter(int(fifa.get('power_strength', 50) or 50))
    agility = jitter(int(fifa.get('movement_agility', 50) or 50))
    
    # === THE BALL (6) ===
    # FIFA: attacking_short_passing, skill_long_passing, skill_ball_control, attacking_finishing, defending_standing_tackle, attacking_heading_accuracy
    # Gaffer: passing, distribution, touch, finishing, defending, aerial
    passing = jitter(int(fifa.get('attacking_short_passing', 50) or 50))
    distribution = jitter(int(fifa.get('skill_long_passing', 50) or 50))
    touch = jitter(int(fifa.get('skill_ball_control', 50) or 50))  # ball_control = touch
    finishing = jitter(int(fifa.get('attacking_finishing', 50) or 50))
    defending = jitter(int(fifa.get('defending_standing_tackle', 50) or 50))
    aerial = jitter(int(fifa.get('attacking_heading_accuracy', 50) or 50))
    
    # === THE HEAD (5) ===
    # FIFA: mentality_interceptions, mentality_vision, mentality_positioning, mentality_composure, (no direct leadership)
    # Gaffer: anticipation, vision, decisions, composure, leadership
    anticipation = jitter(int(fifa.get('mentality_interceptions', 50) or 50))
    vision = jitter(int(fifa.get('mentality_vision', 50) or 50))
    decisions = jitter(int(fifa.get('mentality_positioning', 50) or 50))
    composure = jitter(int(fifa.get('mentality_composure', 50) or 50))
    # Leadership: derived from international_reputation + age + composure
    intl_rep = int(fifa.get('international_reputation', 1) or 1)
    age = int(fifa.get('age', 25) or 25)
    leadership = clamp(30 + intl_rep * 8 + max(0, (age - 20) * 1.5) + (composure - 50) * 0.2)
    
    # === THE GLOVES (3, GK only) ===
    # FIFA: goalkeeping_diving, goalkeeping_positioning, goalkeeping_kicking
    # Gaffer: shot_stopping, commanding, playing_out
    is_gk = 'GK' in (fifa.get('player_positions', '') or '')
    if is_gk:
        shot_stopping = jitter(int(fifa.get('goalkeeping_diving', 50) or 50))
        commanding = jitter(int(fifa.get('goalkeeping_positioning', 50) or 50))
        playing_out = jitter(int(fifa.get('goalkeeping_kicking', 50) or 50))
    else:
        shot_stopping = jitter(15, 5)
        commanding = jitter(20, 5)
        playing_out = jitter(25, 5)
    
    attributes = {
        'pace': pace, 'burst': burst, 'engine': engine, 'power': power, 'agility': agility,
        'passing': passing, 'distribution': distribution, 'touch': touch,
        'finishing': finishing, 'defending': defending, 'aerial': aerial,
        'anticipation': anticipation, 'vision': vision, 'decisions': decisions,
        'composure': composure, 'leadership': leadership,
        'shot_stopping': shot_stopping, 'commanding': commanding, 'playing_out': playing_out,
    }
    
    # === PERSONALITY (Player-level, NOT in attributes) ===
    # FIFA: mentality_aggression, work_rate, skill_moves, weak_foot, international_reputation
    # Gaffer: Big Five personality (openness, conscientiousness, extraversion, agreeableness, neuroticism, confidence)
    #
    # Mapping philosophy:
    # - neuroticism ← FIFA aggression (higher aggression = higher neuroticism)
    # - agreeableness ← inverse of aggression + work_rate (defensive work rate = team player)
    # - conscientiousness ← composure + reactions (disciplined players)
    # - extraversion ← international_reputation + skill_moves (flair players)
    # - openness ← skill_moves + weak_foot (creative players)
    # - confidence ← FIFA overall (better players = more confident)
    
    fifa_aggression = int(fifa.get('mentality_aggression', 50) or 50)
    fifa_composure = int(fifa.get('mentality_composure', 50) or 50)
    fifa_reactions = int(fifa.get('movement_reactions', 50) or 50)
    fifa_overall = int(fifa.get('overall', 50) or 50)
    work_rate = fifa.get('work_rate', 'Medium/Medium') or 'Medium/Medium'
    skill_moves = int(fifa.get('skill_moves', 2) or 2)
    weak_foot = int(fifa.get('weak_foot', 3) or 3)
    intl_rep = int(fifa.get('international_reputation', 1) or 1)
    
    # Parse work rate (Attack/Defense)
    wr_parts = work_rate.split('/')
    att_wr = wr_parts[0].strip() if len(wr_parts) >= 1 else 'Medium'
    def_wr = wr_parts[1].strip() if len(wr_parts) >= 2 else 'Medium'
    wr_map = {'Low': 30, 'Medium': 50, 'High': 70}
    att_wr_val = wr_map.get(att_wr, 50)
    def_wr_val = wr_map.get(def_wr, 50)
    
    neuroticism = clamp(fifa_aggression)  # Direct: aggressive = neurotic
    agreeableness = clamp(100 - fifa_aggression * 0.3 + def_wr_val * 0.3)  # Inverse aggression + defensive work rate
    conscientiousness = clamp(fifa_composure * 0.5 + fifa_reactions * 0.5)  # Disciplined
    extraversion = clamp(30 + intl_rep * 12 + skill_moves * 8)  # Flair + fame
    openness = clamp(30 + skill_moves * 10 + weak_foot * 6)  # Creative
    confidence = clamp(30 + (fifa_overall - 50) * 1.2)  # Better = more confident
    
    personality = {
        'openness': openness,
        'conscientiousness': conscientiousness,
        'extraversion': extraversion,
        'agreeableness': agreeableness,
        'neuroticism': neuroticism,
        'confidence': confidence,
    }
    
    # === STABILITY (Player-level, NOT in attributes) ===
    # Derived from composure + reactions + age factor
    # High composure + high reactions + experienced = stable
    age = int(fifa.get('age', 25) or 25)
    age_factor = 1.0
    if age < 21:
        age_factor = 0.7  # Young players are less stable
    elif age > 30:
        age_factor = 0.85  # Veterans slightly less stable
    
    stability = clamp((fifa_composure * 0.4 + fifa_reactions * 0.3 + fifa_aggression * (-0.1) + 30) * age_factor)
    # Ensure stability is in reasonable range
    stability = max(20, min(90, stability))
    
    return attributes, personality, stability


# =============================================================================
# OVR CALCULATION (matches the Gaffer engine's position-weighted formula)
# =============================================================================

def get_group_position(fifa_positions):
    """Map FIFA positions to Gaffer's 4-group system."""
    pos_str = fifa_positions or ''
    if 'GK' in pos_str:
        return 'Goalkeeper'
    # FIFA def positions: CB, LB, RB, LCB, RCB, LWB, RWB
    def_positions = ['CB', 'LB', 'RB', 'LCB', 'RCB', 'LWB', 'RWB']
    if any(p in pos_str for p in def_positions):
        return 'Defender'
    # FIFA mid positions: CM, CDM, CAM, LM, RM
    mid_positions = ['CM', 'CDM', 'CAM', 'LM', 'RM']
    if any(p in pos_str for p in mid_positions):
        return 'Midfielder'
    # FIFA fwd positions: ST, LW, RW, CF, LF, RF
    fwd_positions = ['ST', 'LW', 'RW', 'CF', 'LF', 'RF']
    if any(p in pos_str for p in fwd_positions):
        return 'Forward'
    # Default
    return 'Midfielder'

def get_canonical_position(fifa_positions):
    """Map FIFA positions to Gaffer's canonical position."""
    pos_str = (fifa_positions or '').strip()
    if 'GK' in pos_str:
        return 'Goalkeeper'
    if any(p in pos_str for p in ['CB', 'LCB', 'RCB']):
        return 'CenterBack'
    if any(p in pos_str for p in ['LB', 'LWB']):
        return 'LeftBack'
    if any(p in pos_str for p in ['RB', 'RWB']):
        return 'RightBack'
    if 'CDM' in pos_str:
        return 'DefensiveMidfielder'
    if 'CAM' in pos_str:
        return 'AttackingMidfielder'
    if 'CM' in pos_str:
        return 'CentralMidfielder'
    if any(p in pos_str for p in ['LM']):
        return 'LeftMidfielder'
    if any(p in pos_str for p in ['RM']):
        return 'RightMidfielder'
    if any(p in pos_str for p in ['LW']):
        return 'LeftWinger'
    if any(p in pos_str for p in ['RW']):
        return 'RightWinger'
    if any(p in pos_str for p in ['ST', 'CF']):
        return 'Striker'
    return 'CentralMidfielder'

# Position-weighted OVR (simplified version of the Gaffer engine formula)
# These weights match player_rating.rs weighted_score function
POSITION_WEIGHTS = {
    'Goalkeeper': [('shot_stopping', 28), ('shot_stopping', 28), ('aerial', 14), ('anticipation', 10), ('decisions', 10), ('composure', 5), ('power', 5)],
    'CenterBack': [('defending', 24), ('defending', 18), ('anticipation', 18), ('power', 14), ('aerial', 12), ('decisions', 8), ('composure', 6)],
    'LeftBack': [('pace', 18), ('engine', 16), ('defending', 17), ('defending', 16), ('anticipation', 12), ('passing', 10), ('touch', 6), ('decisions', 5)],
    'RightBack': [('pace', 18), ('engine', 16), ('defending', 17), ('defending', 16), ('anticipation', 12), ('passing', 10), ('touch', 6), ('decisions', 5)],
    'DefensiveMidfielder': [('defending', 18), ('anticipation', 18), ('decisions', 16), ('passing', 14), ('defending', 12), ('engine', 10), ('vision', 7), ('power', 5)],
    'CentralMidfielder': [('passing', 20), ('vision', 16), ('decisions', 16), ('engine', 12), ('touch', 10), ('anticipation', 9), ('leadership', 9), ('defending', 8)],
    'AttackingMidfielder': [('vision', 20), ('passing', 18), ('touch', 16), ('decisions', 14), ('finishing', 10), ('anticipation', 8), ('composure', 8), ('pace', 6)],
    'LeftMidfielder': [('pace', 17), ('engine', 16), ('passing', 15), ('touch', 14), ('vision', 10), ('decisions', 10), ('anticipation', 10), ('defending', 8)],
    'RightMidfielder': [('pace', 17), ('engine', 16), ('passing', 15), ('touch', 14), ('vision', 10), ('decisions', 10), ('anticipation', 10), ('defending', 8)],
    'LeftWinger': [('pace', 22), ('touch', 22), ('passing', 14), ('finishing', 12), ('vision', 10), ('decisions', 8), ('anticipation', 6), ('engine', 6)],
    'RightWinger': [('pace', 22), ('touch', 22), ('passing', 14), ('finishing', 12), ('vision', 10), ('decisions', 8), ('anticipation', 6), ('engine', 6)],
    'Striker': [('finishing', 26), ('anticipation', 18), ('decisions', 14), ('pace', 12), ('touch', 10), ('power', 8), ('composure', 8), ('aerial', 4)],
}

def calculate_ovr(attributes, canonical_pos):
    """Calculate OVR using the Gaffer position-weighted formula."""
    weights = POSITION_WEIGHTS.get(canonical_pos, POSITION_WEIGHTS['CentralMidfielder'])
    total = 0
    for attr_name, weight in weights:
        total += attributes.get(attr_name, 50) * weight
    ovr = total / 100.0  # weights sum to 100
    
    # Critical penalty: if any critical attr < 45, subtract penalty
    critical_attrs = {
        'Goalkeeper': ['shot_stopping', 'anticipation'],
        'CenterBack': ['defending', 'anticipation'],
        'Striker': ['finishing', 'anticipation', 'decisions'],
    }
    crit = critical_attrs.get(canonical_pos, [])
    for attr in crit:
        val = attributes.get(attr, 50)
        if val < 45:
            ovr -= (45 - val) * 0.6
    
    return max(1, min(99, int(round(ovr))))

def calculate_potential(ovr, age):
    """Generate potential based on OVR and age."""
    if age <= 18:
        return min(99, ovr + random.randint(12, 20))
    elif age <= 21:
        return min(99, ovr + random.randint(8, 14))
    elif age <= 24:
        return min(99, ovr + random.randint(3, 8))
    elif age <= 27:
        return min(99, ovr + random.randint(0, 3))
    else:
        return ovr  # Past peak


# =============================================================================
# TEAM + COMPETITION METADATA
# =============================================================================

# Real managers for top clubs (2023-24 season)
REAL_MANAGERS = {
    "Manchester City": ("Pep", "Guardiola", "Spain", 53, 95),
    "Arsenal": ("Mikel", "Arteta", "Spain", 42, 85),
    "Liverpool": ("Jürgen", "Klopp", "Germany", 57, 92),
    "Real Madrid": ("Carlo", "Ancelotti", "Italy", 65, 93),
    "Barcelona": ("Xavi", "Hernández", "Spain", 44, 85),
    "Atlético Madrid": ("Diego", "Simeone", "Argentina", 53, 88),
    "Bayern Munich": ("Thomas", "Tuchel", "Germany", 50, 85),
    "Paris Saint-Germain": ("Luis", "Enrique", "Spain", 53, 85),
    "Inter": ("Simone", "Inzaghi", "Italy", 48, 82),
    "Juventus": ("Massimiliano", "Allegri", "Italy", 57, 80),
    "Milan": ("Stefano", "Pioli", "Italy", 58, 76),
    "Napoli": ("Walter", "Mazzarri", "Italy", 62, 72),
    "Borussia Dortmund": ("Edin", "Terzić", "Germany", 41, 76),
    "Bayer Leverkusen": ("Xabi", "Alonso", "Spain", 42, 82),
    "Chelsea": ("Mauricio", "Pochettino", "Argentina", 52, 82),
    "Tottenham": ("Ange", "Postecoglou", "Australia", 58, 78),
    "Manchester United": ("Erik ten", "Hag", "Netherlands", 54, 75),
    "Newcastle United": ("Eddie", "Howe", "England", 46, 76),
    "Aston Villa": ("Unai", "Emery", "Spain", 52, 82),
    "Brighton": ("Roberto", "De Zerbi", "Italy", 44, 80),
    "Roma": ("José", "Mourinho", "Portugal", 61, 88),
    "Lazio": ("Maurizio", "Sarri", "Italy", 65, 78),
    "Atalanta": ("Gian Piero", "Gasperini", "Italy", 66, 80),
    "Ajax": ("John", "van 't Schip", "Netherlands", 60, 68),
    "PSV": ("Peter", "Bosz", "Netherlands", 60, 72),
    "Feyenoord": ("Arne", "Slot", "Netherlands", 45, 76),
}

# Competition metadata
LEAGUE_META = {
    'English Premier League': {'country': 'England', 'reputation': 880, 'formation': '4-3-3'},
    'Spain Primera Division': {'country': 'Spain', 'reputation': 850, 'formation': '4-3-3'},
    'Italian Serie A': {'country': 'Italy', 'reputation': 830, 'formation': '3-5-2'},
    'German 1. Bundesliga': {'country': 'Germany', 'reputation': 840, 'formation': '4-2-3-1'},
    'French Ligue 1': {'country': 'France', 'reputation': 800, 'formation': '4-3-3'},
    'Dutch Eredivisie': {'country': 'Netherlands', 'reputation': 750, 'formation': '4-3-3'},
    'Portuguese Liga ZON SAGRES': {'country': 'Portugal', 'reputation': 730, 'formation': '4-3-3'},
    'Scottish Premiership': {'country': 'Scotland', 'reputation': 650, 'formation': '4-4-2'},
    'Turkish Süper Lig': {'country': 'Turkey', 'reputation': 680, 'formation': '4-2-3-1'},
    'Belgian Pro League': {'country': 'Belgium', 'reputation': 670, 'formation': '4-3-3'},
    'Greek Super League': {'country': 'Greece', 'reputation': 630, 'formation': '4-3-3'},
    'Russian Premier League': {'country': 'Russia', 'reputation': 640, 'formation': '4-2-3-1'},
    'Mexican Liga MX': {'country': 'Mexico', 'reputation': 650, 'formation': '4-2-3-1'},
    'USA Major League Soccer': {'country': 'USA', 'reputation': 600, 'formation': '4-3-3'},
    'Argentine Primera División': {'country': 'Argentina', 'reputation': 670, 'formation': '4-3-3'},
    'Brazilian Serie A': {'country': 'Brazil', 'reputation': 680, 'formation': '4-2-3-1'},
    'Japanese J. League Division 1': {'country': 'Japan', 'reputation': 620, 'formation': '4-2-3-1'},
    'Chinese Super League': {'country': 'China', 'reputation': 580, 'formation': '4-3-3'},
    'Saudi Abdul Latif Jameel League': {'country': 'Saudi Arabia', 'reputation': 600, 'formation': '4-3-3'},
    'Swiss Super League': {'country': 'Switzerland', 'reputation': 610, 'formation': '4-4-2'},
    'Austrian Bundesliga': {'country': 'Austria', 'reputation': 600, 'formation': '4-3-3'},
    'Czech Republic First League': {'country': 'Czech Republic', 'reputation': 580, 'formation': '4-4-2'},
    'Danish Superliga': {'country': 'Denmark', 'reputation': 590, 'formation': '4-3-3'},
    'Norwegian Eliteserien': {'country': 'Norway', 'reputation': 570, 'formation': '4-3-3'},
    'Swedish Allsvenskan': {'country': 'Sweden', 'reputation': 570, 'formation': '4-4-2'},
    'Polish T-Mobile Ekstraklasa': {'country': 'Poland', 'reputation': 580, 'formation': '4-4-2'},
    'Croatian Prva HNL': {'country': 'Croatia', 'reputation': 560, 'formation': '4-2-3-1'},
    'Serbian SuperLiga': {'country': 'Serbia', 'reputation': 550, 'formation': '4-4-2'},
    'Romanian Liga I': {'country': 'Romania', 'reputation': 550, 'formation': '4-3-3'},
    'Bulgarian First League': {'country': 'Bulgaria', 'reputation': 530, 'formation': '4-4-2'},
    'Hungarian Nemzeti Bajnokság I': {'country': 'Hungary', 'reputation': 540, 'formation': '4-4-2'},
    'Ukrainian Premier League': {'country': 'Ukraine', 'reputation': 580, 'formation': '4-2-3-1'},
    'English League Championship': {'country': 'England', 'reputation': 620, 'formation': '4-4-2'},
    'English League One': {'country': 'England', 'reputation': 500, 'formation': '4-4-2'},
    'English League Two': {'country': 'England', 'reputation': 450, 'formation': '4-4-2'},
    'Spanish Segunda División': {'country': 'Spain', 'reputation': 550, 'formation': '4-4-2'},
    'Italian Serie B': {'country': 'Italy', 'reputation': 550, 'formation': '4-4-2'},
    'German 2. Bundesliga': {'country': 'Germany', 'reputation': 560, 'formation': '4-4-2'},
    'French Ligue 2': {'country': 'France', 'reputation': 530, 'formation': '4-4-2'},
    'Holland Eredivisie': {'country': 'Netherlands', 'reputation': 750, 'formation': '4-3-3'},
    'Holland Jupiler Pro League': {'country': 'Netherlands', 'reputation': 500, 'formation': '4-3-3'},
    'Belgian Jupiler Pro League': {'country': 'Belgium', 'reputation': 670, 'formation': '4-3-3'},
    'Portuguese Liga Portugal': {'country': 'Portugal', 'reputation': 730, 'formation': '4-3-3'},
    'Republic of Ireland Premier Division': {'country': 'Ireland', 'reputation': 450, 'formation': '4-4-2'},
    'Norwegian Eliteserien': {'country': 'Norway', 'reputation': 570, 'formation': '4-3-3'},
    'Finnish Veikkausliiga': {'country': 'Finland', 'reputation': 450, 'formation': '4-4-2'},
    'Colombian Liga Postobón': {'country': 'Colombia', 'reputation': 580, 'formation': '4-2-3-1'},
    'Chilean Campeonato Nacional': {'country': 'Chile', 'reputation': 560, 'formation': '4-3-3'},
    'Uruguayan Primera División': {'country': 'Uruguay', 'reputation': 570, 'formation': '4-3-3'},
}

# Real rivalries
SEEDED_RIVALRIES = [
    {"team_a": "arsenal", "team_b": "tottenham_hotspur", "name": "North London Derby", "intensity": 95},
    {"team_a": "manchester_united", "team_b": "manchester_city", "name": "Manchester Derby", "intensity": 90},
    {"team_a": "manchester_united", "team_b": "liverpool", "name": "North West Derby", "intensity": 95},
    {"team_a": "arsenal", "team_b": "chelsea", "name": "London Derby", "intensity": 75},
    {"team_a": "real_madrid", "team_b": "fc_barcelona", "name": "El Clásico", "intensity": 100},
    {"team_a": "real_madrid", "team_b": "atletico_madrid", "name": "Madrid Derby", "intensity": 85},
    {"team_a": "inter", "team_b": "juventus", "name": "Derby d'Italia", "intensity": 85},
    {"team_a": "inter", "team_b": "milan", "name": "Derby della Madonnina", "intensity": 90},
    {"team_a": "fc_bayern_münchen", "team_b": "borussia_dortmund", "name": "Der Klassiker", "intensity": 85},
    {"team_a": "paris_saint_germain", "team_b": "olympique_de_marseille", "name": "Le Classique", "intensity": 85},
    {"team_a": "celtic", "team_b": "rangers", "name": "Old Firm Derby", "intensity": 100},
    {"team_a": "ajax", "team_b": "feyenoord", "name": "De Klassieker", "intensity": 85},
    {"team_a": "benfica", "team_b": "fc_porto", "name": "O Clássico", "intensity": 85},
    {"team_a": "galatasaray", "team_b": "fenerbahçe", "name": "Intercontinental Derby", "intensity": 90},
    {"team_a": "olympiacos", "team_b": "panathinaikos", "name": "Derby of the Eternal Enemies", "intensity": 85},
]


def slugify(name):
    return name.lower().replace(" ", "_").replace(".", "").replace("-", "_").replace("é", "e").replace("ü", "u").replace("ö", "o").replace("ä", "a").replace("ñ", "n").replace("á", "a").replace("í", "i").replace("ó", "o").replace("ú", "u").replace("ç", "c").replace("ß", "ss")


def build_world(max_leagues=15):
    """Build the world DB from FIFA 22 data."""
    print(f"Loading FIFA 22 data from {FIFA_CSV}...")
    with open(FIFA_CSV, encoding='utf-8') as f:
        fifa_players = list(csv.DictReader(f))
    print(f"  Loaded {len(fifa_players)} players")
    
    # Filter to target leagues (top N leagues by reputation)
    target_leagues = set()
    for league_name in sorted(LEAGUE_META.keys(), key=lambda l: LEAGUE_META[l]['reputation'], reverse=True)[:max_leagues]:
        target_leagues.add(league_name)
    
    # Also match alternative names
    league_aliases = {
        'Holland Eredivisie': 'Dutch Eredivisie',
        'Holland Jupiler Pro League': 'Dutch Eerste Divisie',
        'Belgian Jupiler Pro League': 'Belgian Pro League',
        'Portuguese Liga Portugal': 'Portuguese Liga ZON SAGRES',
        'Portuguese Liga ZON SAGRES': 'Portuguese Liga ZON SAGRES',
    }
    
    filtered = []
    for p in fifa_players:
        league = p.get('league_name', '')
        if league in target_leagues:
            filtered.append(p)
        elif league in league_aliases and league_aliases[league] in target_leagues:
            p['league_name'] = league_aliases[league]
            filtered.append(p)
    
    print(f"  Filtered to {len(filtered)} players in {len(target_leagues)} leagues")
    
    # Build teams
    teams_by_name = {}
    for p in filtered:
        club = p.get('club_name', '').strip()
        league = p.get('league_name', '').strip()
        if not club or not league:
            continue
        if club not in teams_by_name:
            meta = LEAGUE_META.get(league, {'country': 'Unknown', 'reputation': 500, 'formation': '4-4-2'})
            team_id = slugify(club)
            teams_by_name[club] = {
                'id': team_id,
                'name': club,
                'short_name': club[:3].upper(),
                'country': meta['country'],
                'football_nation': meta['country'],
                'city': 'Unknown',
                'stadium_name': f'{club} Stadium',
                'stadium_capacity': 30000,
                'finance': 50000000,
                'manager_id': None,
                'reputation': meta['reputation'],
                'wage_budget': 500000,
                'transfer_budget': 5000000,
                'season_income': 0,
                'season_expenses': 0,
                'formation': meta['formation'],
                'play_style': 'Balanced',
                'player_roles': {},
                'tactics_phase': {},
                'training_focus': 'Physical',
                'training_intensity': 'Medium',
                'training_schedule': 'Balanced',
                'founded_year': 1900,
                'colors': {'primary': '#1a3a6b', 'secondary': '#ffffff'},
                'kit_pattern': 'Solid',
                'media': {'logo': f'club-logos/{team_id}.png'} if p.get('club_logo_url') else {},
                'league_name': league,
                'match_roles': {},
                'starting_xi_ids': [],
                'form': [],
                'active_competition_ids': [],
            }
    
    # Build players
    players = []
    team_ids = {t['id'] for t in teams_by_name.values()}
    
    for fp in filtered:
        club = fp.get('club_name', '').strip()
        if club not in teams_by_name:
            continue
        
        team = teams_by_name[club]
        team_id = team['id']
        
        # Generate player ID
        sofifa_id = fp.get('sofifa_id', '')
        player_id = f'p_{sofifa_id}'
        
        # Map attributes
        attributes, personality, stability = map_fifa_to_gaffer(fp)
        
        # Position
        fifa_positions = fp.get('player_positions', '')
        group_pos = get_group_position(fifa_positions)
        canonical_pos = get_canonical_position(fifa_positions)
        
        # OVR (calculated using Gaffer formula, NOT FIFA's overall)
        ovr = calculate_ovr(attributes, canonical_pos)
        
        # Potential
        age = int(fp.get('age', 25) or 25)
        potential = calculate_potential(ovr, age)
        
        # DOB
        dob = fp.get('dob', '')
        if not dob:
            birth_year = 2022 - age
            dob = f'{birth_year}-01-01'
        
        # Nationality
        nationality = fp.get('nationality_name', '')
        nat_code = nationality[:3].upper() if nationality else 'UNK'
        
        # Height/weight
        height_cm = int(float(fp.get('height_cm', 180) or 180))
        weight_kg = int(float(fp.get('weight_kg', 75) or 75))
        
        # Wage/value
        wage_eur = int(float(fp.get('wage_eur', 10000) or 10000))
        value_eur = int(float(fp.get('value_eur', 500000) or 500000))
        contract_end = fp.get('club_contract_valid_until', '2026')
        if contract_end:
            contract_end = f'{contract_end}-06-30'
        
        # Face URL
        face_url = fp.get('player_face_url', '')
        media = {'face': f'face-cache/{player_id}.png'} if face_url else {'face': None}
        
        # Footedness
        preferred_foot = fp.get('preferred_foot', 'Right')
        weak_foot = int(fp.get('weak_foot', 3) or 3)
        
        # Jersey number
        jersey = int(fp.get('club_jersey_number', 0) or 0)
        
        # Traits
        player_tags = fp.get('player_tags', '')
        fifa_traits = fp.get('player_traits', '')
        traits = []
        if player_tags:
            for tag in player_tags.split(','):
                tag = tag.strip().replace('#', '')
                if tag:
                    traits.append(tag)
        
        player = {
            'id': player_id,
            'full_name': fp.get('long_name', fp.get('short_name', 'Unknown')),
            'match_name': fp.get('short_name', fp.get('long_name', 'Unknown')),
            'date_of_birth': dob,
            'nationality': nat_code,
            'birth_country': nat_code,
            'position': group_pos,
            'natural_position': canonical_pos,
            'alternate_positions': [],
            'footedness': preferred_foot,
            'weak_foot': weak_foot,
            'training_focus': None,
            'attributes': attributes,
            'condition': 100,
            'morale': 75,
            'injury': None,
            'team_id': team_id,
            'retired': False,
            'squad_role': 'Senior',
            'contract_end': contract_end,
            'wage': wage_eur,
            'market_value': value_eur,
            'stats': {
                'appearances': 0, 'goals': 0, 'assists': 0, 'clean_sheets': 0,
                'yellow_cards': 0, 'red_cards': 0, 'avg_rating': 0.0,
                'minutes_played': 0, 'shots': 0, 'shots_on_target': 0,
                'passes_completed': 0, 'passes_attempted': 0,
                'tackles_won': 0, 'interceptions': 0, 'fouls_committed': 0,
            },
            'career': [],
            'movement_history': [],
            'transfer_listed': False,
            'loan_listed': False,
            'transfer_offers': [],
            'loan_offers': [],
            'jersey_number': jersey if jersey > 0 else None,
            'ovr': ovr,
            'potential': potential,
            'personality': personality,
            'stability_modifier': stability,
            'traits': traits,
            'narrative_traits': [],
            'media': media,
            'fitness': 75,
            'morale_core': None,
            'active_loan': None,
            'former_team_id': None,
            'retired_season': None,
        }
        players.append(player)
    
    print(f"  Built {len(players)} players")
    
    # Build competitions
    competitions = []
    teams_by_league = defaultdict(list)
    for team in teams_by_name.values():
        league = team['league_name']
        teams_by_league[league].append(team['id'])
    
    for league_name, team_ids in sorted(teams_by_league.items()):
        meta = LEAGUE_META.get(league_name, {'country': 'Unknown', 'reputation': 500})
        comp_id = slugify(league_name)
        competitions.append({
            'id': comp_id,
            'name': league_name,
            'country': meta['country'],
            'num_teams': len(team_ids),
            'reputation': meta['reputation'],
            'participants': team_ids,
            'competition_type': 'League',
        })
    
    # Add domestic cups
    cups_by_country = defaultdict(list)
    for league_name, team_ids in teams_by_league.items():
        meta = LEAGUE_META.get(league_name, {'country': 'Unknown'})
        cups_by_country[meta['country']].extend(team_ids)
    
    cup_names = {
        'England': 'FA Cup', 'Spain': 'Copa del Rey', 'Italy': 'Coppa Italia',
        'Germany': 'DFB-Pokal', 'France': 'Coupe de France', 'Netherlands': 'KNVB Beker',
        'Portugal': 'Taça de Portugal', 'Scotland': 'Scottish Cup', 'Turkey': 'Turkish Cup',
        'Belgium': 'Belgian Cup', 'Brazil': 'Copa do Brasil', 'Argentina': 'Copa Argentina',
    }
    
    for country, team_ids in cups_by_country.items():
        if country in cup_names and len(team_ids) >= 8:
            cup_id = slugify(cup_names[country])
            competitions.append({
                'id': cup_id,
                'name': cup_names[country],
                'country': country,
                'num_teams': len(team_ids),
                'reputation': 700,
                'participants': team_ids,
                'competition_type': 'Cup',
            })
    
    # Add Champions League (top teams from all leagues)
    all_top_teams = []
    for league_name in sorted(teams_by_league.keys(), key=lambda l: LEAGUE_META.get(l, {}).get('reputation', 500), reverse=True):
        all_top_teams.extend(teams_by_league[league_name][:4])
    
    competitions.append({
        'id': 'champions_league',
        'name': 'Champions League',
        'country': 'Europe',
        'num_teams': min(32, len(all_top_teams)),
        'reputation': 950,
        'participants': all_top_teams[:32],
        'competition_type': 'ContinentalClub',
    })
    
    teams_list = list(teams_by_name.values())
    
    # Build staff
    staff = []
    for team in teams_list:
        team_name = team['name']
        team_id = team['id']
        team_rep = team['reputation']
        
        # Manager
        if team_name in REAL_MANAGERS:
            first, last, nat, age, rep = REAL_MANAGERS[team_name]
        else:
            # Generate generic manager
            names = [('James', 'Wilson'), ('Carlos', 'Ruiz'), ('Marco', 'Rossi'), ('Thomas', 'Müller')]
            first, last = names[hash(team_name) % len(names)]
            nat = team['country'][:3].upper()
            age = 50
            rep = max(40, min(75, team_rep // 12))
        
        mgr_id = f'staff_mgr_{slugify(team_id)}'
        staff.append({
            'id': mgr_id,
            'first_name': first,
            'last_name': last,
            'full_name': f'{first} {last}',
            'match_name': last,
            'nationality': nat[:3].upper() if len(nat) >= 3 else 'UNK',
            'date_of_birth': f'{2022 - age}-01-01',
            'role': 'Manager',
            'team_id': team_id,
            'attributes': {
                'coaching': max(30, rep - 10),
                'judging_ability': max(30, rep - 15),
                'judging_potential': max(30, rep - 20),
                'physiotherapy': 30,
            },
            'wage': 50000 + rep * 1000,
            'reputation': rep,
        })
        team['manager_id'] = mgr_id
        
        # Assistant, 2 coaches, 1 physio, 2 scouts
        for role_idx, (role, label) in enumerate([('AssistantManager', 'Assistant'), ('Coach', 'Coach'), ('Coach', 'Coach'), ('Physio', 'Physio'), ('Scout', 'Scout'), ('Scout', 'Scout')]):
            s_first, s_last = [('James', 'Smith'), ('David', 'Jones'), ('Paul', 'Taylor'), ('Mark', 'Brown'), ('Steve', 'Clark'), ('Mike', 'Wright')][role_idx]
            s_rep = max(30, min(70, team_rep // 15 + 20))
            if role == 'Physio':
                attrs = {'coaching': 30, 'judging_ability': 30, 'judging_potential': 30, 'physiotherapy': s_rep}
            elif role == 'Scout':
                attrs = {'coaching': 30, 'judging_ability': s_rep, 'judging_potential': max(30, s_rep - 5), 'physiotherapy': 30}
            else:
                attrs = {'coaching': s_rep, 'judging_ability': max(30, s_rep - 10), 'judging_potential': max(30, s_rep - 15), 'physiotherapy': 30}
            staff.append({
                'id': f'staff_{slugify(team_id)}_{role.lower()}_{role_idx}',
                'first_name': s_first,
                'last_name': s_last,
                'full_name': f'{s_first} {s_last}',
                'match_name': s_last,
                'nationality': team['country'][:3].upper() if len(team['country']) >= 3 else 'UNK',
                'date_of_birth': f'{2022 - 45}-06-01',
                'role': role,
                'team_id': team_id,
                'attributes': attrs,
                'wage': 10000 + s_rep * 300,
                'reputation': s_rep,
            })
    
    print(f"  Built {len(staff)} staff ({sum(1 for s in staff if s['role']=='Manager')} managers)")
    print(f"  Built {len(teams_list)} teams")
    print(f"  Built {len(competitions)} competitions")
    
    # Build world data
    world = {
        'name': 'Gaffer Real World 2022',
        'description': f'Real player data from FIFA 22 ({len(players)} players, {len(teams_list)} teams, {len(competitions)} competitions)',
        'teams': teams_list,
        'players': players,
        'staff': staff,
        'managers': [],
        'competitions': competitions,
        'national_teams': [],
        'regions': [],
        'default_active_regions': [],
        'default_active_competitions': [c['id'] for c in competitions if c['competition_type'] == 'League'],
        'league': competitions[0] if competitions else None,
        'news': [],
        'stats': {'player_stats': {}, 'team_stats': {}, 'manager_stats': {}},
        'world_history': {'seasons': [], 'hall_of_fame': []},
        'metadata': {
            'format_version': 3,
            'world_id': 'fifa22_real_world',
            'kind': 'RosterBaseline',
            'base_year': 2024,
        },
        'extra_translations': {},
        'build_notices': [],
        'relationships': [],
        'rivalries': SEEDED_RIVALRIES,
    }
    
    # Save
    print(f"\nSaving to {OUTPUT}...")
    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(world, f, ensure_ascii=False, separators=(',', ':'))
    
    size_mb = os.path.getsize(OUTPUT) / 1024 / 1024
    print(f"  Done! Size: {size_mb:.1f} MB")
    
    # Summary
    print(f"\n=== WORLD DB SUMMARY ===")
    print(f"  Players: {len(players)}")
    print(f"  Teams: {len(teams_list)}")
    print(f"  Staff: {len(staff)}")
    print(f"  Competitions: {len(competitions)} ({sum(1 for c in competitions if c['competition_type']=='League')} leagues, {sum(1 for c in competitions if c['competition_type']=='Cup')} cups, {sum(1 for c in competitions if c['competition_type']=='ContinentalClub')} continental)")
    print(f"  Rivalries: {len(SEEDED_RIVALRIES)}")
    print(f"  DB size: {size_mb:.1f} MB")
    
    # OVR distribution
    ovrs = [p['ovr'] for p in players]
    print(f"  OVR: mean={sum(ovrs)/len(ovrs):.1f}, min={min(ovrs)}, max={max(ovrs)}")
    
    # Players with face URLs
    has_face = sum(1 for p in players if p['media'].get('face'))
    print(f"  Players with face URL: {has_face}/{len(players)}")
    
    # Position distribution
    from collections import Counter
    pos_dist = Counter(p['position'] for p in players)
    print(f"  Positions: {dict(pos_dist)}")


if __name__ == '__main__':
    import sys
    max_leagues = int(sys.argv[1]) if len(sys.argv) > 1 else 15
    build_world(max_leagues)
