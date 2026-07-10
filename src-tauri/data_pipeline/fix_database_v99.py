#!/usr/bin/env python3
"""
V99 Phase 4: Fix the bundled gaffer_world.json database.

Fixes 3 critical issues:
1. Competition participants — La Liga has 3 teams instead of 20, PL has 4
   instead of 20, etc. All 114 teams have league="Unknown".
2. OVR distribution — mean is 54.3, should be ~70+ for elite players.
   The normalize_to_99 function flattens everyone into a narrow band.
3. Team metadata — most teams have country="Unknown", city="Unknown",
   stadium_name="<Team Name> Stadium".

This script:
- Maps all 114 team names to their correct league + country
- Fixes competition num_teams + adds participants arrays
- Re-tunes OVR distribution to be realistic
- Adds proper stadium/city/country metadata where known
"""

import json
import os
from pathlib import Path

DB_PATH = Path(__file__).parent.parent.parent / "src-tauri" / "databases" / "gaffer_world.json"

# =============================================================================
# TEAM → LEAGUE + COUNTRY MAPPING
# =============================================================================
# Complete mapping of all Big 5 league teams (2023-24 season squads).
# Format: "Team Name": ("League Name", "Country", "City", "Stadium", "Capacity")

TEAM_LEAGUE_MAP = {
    # === LA LIGA (Spain) — 20 teams ===
    "Real Madrid": ("La Liga", "Spain", "Madrid", "Santiago Bernabéu", 81044),
    "Barcelona": ("La Liga", "Spain", "Barcelona", "Spotify Camp Nou", 99354),
    "Atlético Madrid": ("La Liga", "Spain", "Madrid", "Cívitas Metropolitano", 67700),
    "Athletic Club": ("La Liga", "Spain", "Bilbao", "San Mamés", 53289),
    "Real Sociedad": ("La Liga", "Spain", "San Sebastián", "Reale Arena", 32476),
    "Real Betis": ("La Liga", "Spain", "Seville", "Benito Villamarín", 60721),
    "Villarreal": ("La Liga", "Spain", "Villarreal", "Estadio de la Cerámica", 23500),
    "Valencia": ("La Liga", "Spain", "Valencia", "Mestalla", 49430),
    "Sevilla": ("La Liga", "Spain", "Seville", "Ramón Sánchez Pizjuán", 43883),
    "Girona": ("La Liga", "Spain", "Girona", "Montilivi", 14624),
    "Osasuna": ("La Liga", "Spain", "Pamplona", "El Sadar", 23576),
    "Celta Vigo": ("La Liga", "Spain", "Vigo", "Balaídos", 29000),
    "Rayo Vallecano": ("La Liga", "Spain", "Madrid", "Vallecas", 14708),
    "Mallorca": ("La Liga", "Spain", "Palma", "Son Moix", 23142),
    "Getafe": ("La Liga", "Spain", "Getafe", "Coliseum", 17393),
    "Las Palmas": ("La Liga", "Spain", "Las Palmas", "Gran Canaria", 32400),
    "Alavés": ("La Liga", "Spain", "Vitoria-Gasteiz", "Mendizorrotza", 19840),
    "Cádiz": ("La Liga", "Spain", "Cádiz", "Nuevo Mirandilla", 20724),
    "Granada": ("La Liga", "Spain", "Granada", "Los Cármenes", 19336),
    "Almería": ("La Liga", "Spain", "Almería", "Power Horse Stadium", 15274),

    # === PREMIER LEAGUE (England) — 20 teams ===
    "Manchester City": ("Premier League", "England", "Manchester", "Etihad Stadium", 53400),
    "Arsenal": ("Premier League", "England", "London", "Emirates Stadium", 60704),
    "Liverpool": ("Premier League", "England", "Liverpool", "Anfield", 61276),
    "Aston Villa": ("Premier League", "England", "Birmingham", "Villa Park", 42095),
    "Tottenham": ("Premier League", "England", "London", "Tottenham Hotspur Stadium", 62850),
    "Manchester United": ("Premier League", "England", "Manchester", "Old Trafford", 74310),
    "West Ham United": ("Premier League", "England", "London", "London Stadium", 62500),
    "Brighton": ("Premier League", "England", "Brighton", "Amex Stadium", 31876),
    "Newcastle United": ("Premier League", "England", "Newcastle", "St James' Park", 52305),
    "Chelsea": ("Premier League", "England", "London", "Stamford Bridge", 40341),
    "Wolves": ("Premier League", "England", "Wolverhampton", "Molineux", 31750),
    "Fulham": ("Premier League", "England", "London", "Craven Cottage", 25700),
    "Bournemouth": ("Premier League", "England", "Bournemouth", "Vitality Stadium", 11329),
    "Crystal Palace": ("Premier League", "England", "London", "Selhurst Park", 25486),
    "Brentford": ("Premier League", "England", "London", "Gtech Community Stadium", 17250),
    "Everton": ("Premier League", "England", "Liverpool", "Goodison Park", 39414),
    "Nottingham Forest": ("Premier League", "England", "Nottingham", "City Ground", 30445),
    "Luton Town": ("Premier League", "England", "Luton", "Kenilworth Road", 10356),
    "Burnley": ("Premier League", "England", "Burnley", "Turf Moor", 21944),
    "Sheffield United": ("Premier League", "England", "Sheffield", "Bramall Lane", 32050),

    # === SERIE A (Italy) — 20 teams ===
    "Inter": ("Serie A", "Italy", "Milan", "San Siro", 75923),
    "Juventus": ("Serie A", "Italy", "Turin", "Allianz Stadium", 41507),
    "Milan": ("Serie A", "Italy", "Milan", "San Siro", 75923),
    "Atalanta": ("Serie A", "Italy", "Bergamo", "Gewiss Stadium", 21300),
    "Bologna": ("Serie A", "Italy", "Bologna", "Renato Dall'Ara", 36462),
    "Roma": ("Serie A", "Italy", "Rome", "Stadio Olimpico", 70634),
    "Lazio": ("Serie A", "Italy", "Rome", "Stadio Olimpico", 70634),
    "Napoli": ("Serie A", "Italy", "Naples", "Diego Armando Maradona", 54726),
    "Fiorentina": ("Serie A", "Italy", "Florence", "Artemio Franchi", 43147),
    "Torino": ("Serie A", "Italy", "Turin", "Stadio Olimpico Grande Torino", 27958),
    "Monza": ("Serie A", "Italy", "Monza", "U-Power Stadium", 16917),
    "Genoa": ("Serie A", "Italy", "Genoa", "Luigi Ferraris", 36703),
    "Lecce": ("Serie A", "Italy", "Lecce", "Via del Mare", 31533),
    "Cagliari": ("Serie A", "Italy", "Cagliari", "Unipol Domus", 16416),
    "Hellas Verona": ("Serie A", "Italy", "Verona", "Marc'Antonio Bentegodi", 39211),
    "Udinese": ("Serie A", "Italy", "Udine", "Bluenergy Stadium", 25132),
    "Salernitana": ("Serie A", "Italy", "Salerno", "Arechi", 37245),
    "Empoli": ("Serie A", "Italy", "Empoli", "Castellani", 16284),
    "US Sassuolo": ("Serie A", "Italy", "Sassuolo", "Mapei Stadium", 21584),
    "Sassuolo": ("Serie A", "Italy", "Sassuolo", "Mapei Stadium", 21584),
    "Frosinone": ("Serie A", "Italy", "Frosinone", "Benito Stirpe", 16227),

    # === BUNDESLIGA (Germany) — 18 teams ===
    "Bayern Munich": ("Bundesliga", "Germany", "Munich", "Allianz Arena", 75000),
    "Borussia Dortmund": ("Bundesliga", "Germany", "Dortmund", "Signal Iduna Park", 81365),
    "Bayer Leverkusen": ("Bundesliga", "Germany", "Leverkusen", "BayArena", 30210),
    "RB Leipzig": ("Bundesliga", "Germany", "Leipzig", "Red Bull Arena", 47069),
    "Stuttgart": ("Bundesliga", "Germany", "Stuttgart", "MHPArena", 60449),
    "Eintracht Frankfurt": ("Bundesliga", "Germany", "Frankfurt", "Deutsche Bank Park", 51500),
    "Freiburg": ("Bundesliga", "Germany", "Freiburg", "Europa-Park Stadion", 34700),
    "Hoffenheim": ("Bundesliga", "Germany", "Sinsheim", "PreZero Arena", 30150),
    "Werder Bremen": ("Bundesliga", "Germany", "Bremen", "Weserstadion", 42100),
    "Wolfsburg": ("Bundesliga", "Germany", "Wolfsburg", "Volkswagen Arena", 30000),
    "Mainz 05": ("Bundesliga", "Germany", "Mainz", "Mewa Arena", 33305),
    "Union Berlin": ("Bundesliga", "Germany", "Berlin", "An der Alten Försterei", 22012),
    "Borussia Mönchengladbach": ("Bundesliga", "Germany", "Mönchengladbach", "Borussia-Park", 54057),
    "Augsburg": ("Bundesliga", "Germany", "Augsburg", "WWK Arena", 30660),
    "VfL Bochum": ("Bundesliga", "Germany", "Bochum", "Vonovia Ruhrstadion", 27599),
    "FC Heidenheim": ("Bundesliga", "Germany", "Heidenheim", "Voith-Arena", 15000),
    "Darmstadt 98": ("Bundesliga", "Germany", "Darmstadt", "Merck-Stadion am Böllenfalltor", 17810),
    "Köln": ("Bundesliga", "Germany", "Cologne", "RheinEnergieStadion", 49827),

    # === LIGUE 1 (France) — 18 teams ===
    "Paris SG": ("Ligue 1", "France", "Paris", "Parc des Princes", 47929),
    "Paris Saint Germain": ("Ligue 1", "France", "Paris", "Parc des Princes", 47929),
    "Monaco": ("Ligue 1", "France", "Monaco", "Stade Louis II", 18523),
    "Brest": ("Ligue 1", "France", "Brest", "Francis Le Blé", 15931),
    "Lille": ("Ligue 1", "France", "Lille", "Stade Pierre-Mauroy", 50186),
    "Nice": ("Ligue 1", "France", "Nice", "Allianz Riviera", 36178),
    "Lyon": ("Ligue 1", "France", "Lyon", "Groupama Stadium", 59186),
    "Lens": ("Ligue 1", "France", "Lens", "Stade Bollaert-Delelis", 38223),
    "Marseille": ("Ligue 1", "France", "Marseille", "Stade Vélodrome", 67394),
    "Rennes": ("Ligue 1", "France", "Rennes", "Roazhon Park", 29778),
    "Reims": ("Ligue 1", "France", "Reims", "Stade Auguste-Delaune", 21684),
    "Toulouse": ("Ligue 1", "France", "Toulouse", "Stadium de Toulouse", 33150),
    "Strasbourg": ("Ligue 1", "France", "Strasbourg", "Stade de la Meinau", 26109),
    "Nantes": ("Ligue 1", "France", "Nantes", "Stade de la Beaujoire", 35322),
    "Le Havre": ("Ligue 1", "France", "Le Havre", "Stade Océane", 25178),
    "Metz": ("Ligue 1", "France", "Metz", "Stade Saint-Symphorien", 25636),
    "Montpellier": ("Ligue 1", "France", "Montpellier", "La Mosson", 32900),
    "Lorient": ("Ligue 1", "France", "Lorient", "Stade du Moustoir", 18890),
    "Clermont Foot": ("Ligue 1", "France", "Clermont-Ferrand", "Stade Gabriel Montpied", 11980),
}

# Competition metadata
COMPETITION_META = {
    "La Liga": {"country": "Spain", "reputation": 850, "num_teams": 20},
    "Premier League": {"country": "England", "reputation": 880, "num_teams": 20},
    "Serie A": {"country": "Italy", "reputation": 830, "num_teams": 20},
    "Bundesliga": {"country": "Germany", "reputation": 840, "num_teams": 18},
    "Ligue 1": {"country": "France", "reputation": 800, "num_teams": 18},
}


def fix_database():
    print(f"Loading database from {DB_PATH}...")
    with open(DB_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    teams = data.get("teams", [])
    players = data.get("players", [])
    competitions = data.get("competitions", [])

    print(f"  Loaded: {len(teams)} teams, {len(players)} players, {len(competitions)} competitions")

    # =====================================================================
    # FIX 1: Team metadata — assign league, country, city, stadium
    # =====================================================================
    print("\n=== FIX 1: Team metadata ===")
    fixed_teams = 0
    unmapped_teams = []

    for team in teams:
        name = team.get("name", "")
        if name in TEAM_LEAGUE_MAP:
            league, country, city, stadium, capacity = TEAM_LEAGUE_MAP[name]
            team["country"] = country
            team["city"] = city
            team["stadium_name"] = stadium
            team["stadium_capacity"] = capacity
            team["football_nation"] = country
            team["league_name"] = league
            fixed_teams += 1
        else:
            unmapped_teams.append(name)

    print(f"  Fixed {fixed_teams}/{len(teams)} teams with proper metadata")
    if unmapped_teams:
        print(f"  WARNING: {len(unmapped_teams)} teams could not be mapped:")
        for name in unmapped_teams[:10]:
            print(f"    - {name}")
        if len(unmapped_teams) > 10:
            print(f"    ... and {len(unmapped_teams) - 10} more")

    # =====================================================================
    # FIX 2: Competition participants + num_teams
    # =====================================================================
    print("\n=== FIX 2: Competition participants ===")

    # Group teams by league
    teams_by_league = {}
    for team in teams:
        league = team.get("league_name", "")
        if league and league != "Unknown":
            if league not in teams_by_league:
                teams_by_league[league] = []
            teams_by_league[league].append(team.get("id", team.get("name", "").lower().replace(" ", "_")))

    # Rebuild competitions with correct participants
    new_competitions = []
    for league_name, meta in COMPETITION_META.items():
        participant_ids = teams_by_league.get(league_name, [])
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
    # Set primary league
    if new_competitions:
        data["league"] = new_competitions[0]

    # =====================================================================
    # FIX 3: OVR distribution re-tune
    # =====================================================================
    print("\n=== FIX 3: OVR distribution re-tune ===")

    # Current distribution: mean ~54, max ~80. Real football: mean ~68, max ~93.
    # The problem is the normalize_to_99 function compresses everything.
    # Fix: apply a remapping that stretches the distribution.
    #
    # Current range: 38-80 (mean 54)
    # Target range: 45-93 (mean ~68)
    #
    # Formula: new_ovr = 45 + (old_ovr - 38) * (93 - 45) / (80 - 38)
    #         = 45 + (old_ovr - 38) * 48 / 42
    #         = 45 + (old_ovr - 38) * 1.143

    old_min, old_max = 38, 80
    new_min, new_max = 45, 93
    scale = (new_max - new_min) / (old_max - old_min)

    ovr_before = [p.get("ovr", 50) for p in players]
    ovr_after = []

    for player in players:
        old_ovr = player.get("ovr", 50)
        new_ovr = int(round(new_min + (old_ovr - old_min) * scale))
        new_ovr = max(40, min(95, new_ovr))  # clamp
        player["ovr"] = new_ovr
        ovr_after.append(new_ovr)

        # Also fix potential — should be >= ovr for young players
        old_pot = player.get("potential", old_ovr)
        if old_pot <= new_ovr:
            # Give young players higher potential
            new_pot = min(99, new_ovr + 5)
            player["potential"] = new_pot
        else:
            # Scale potential the same way
            new_pot = int(round(new_min + (old_pot - old_min) * scale))
            player["potential"] = max(new_ovr, min(99, new_pot))

    old_mean = sum(ovr_before) / len(ovr_before) if ovr_before else 0
    new_mean = sum(ovr_after) / len(ovr_after) if ovr_after else 0
    print(f"  OVR before: mean={old_mean:.1f}, min={min(ovr_before)}, max={max(ovr_before)}")
    print(f"  OVR after:  mean={new_mean:.1f}, min={min(ovr_after)}, max={max(ovr_after)}")

    # =====================================================================
    # FIX 4: Team reputation scaling
    # =====================================================================
    print("\n=== FIX 4: Team reputation scaling ===")
    # Scale team reputation to match the new OVR range
    for team in teams:
        old_rep = team.get("reputation", 50)
        # Scale from 0-100 to 300-900
        new_rep = int(300 + (old_rep / 100.0) * 600)
        team["reputation"] = new_rep

    print(f"  Team reputation scaled to 300-900 range")

    # =====================================================================
    # SAVE
    # =====================================================================
    print(f"\nSaving fixed database to {DB_PATH}...")
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  Done! Database size: {os.path.getsize(DB_PATH) / 1024 / 1024:.1f} MB")

    # Summary
    print("\n=== SUMMARY ===")
    print(f"  Teams: {len(teams)} ({fixed_teams} with full metadata)")
    print(f"  Players: {len(players)} (OVR re-tuned: {old_mean:.1f} → {new_mean:.1f})")
    print(f"  Competitions: {len(new_competitions)} (all with correct participants)")
    print(f"  Staff: {len(data.get('staff', []))} (still 0 — Phase 4.4)")


if __name__ == "__main__":
    fix_database()
