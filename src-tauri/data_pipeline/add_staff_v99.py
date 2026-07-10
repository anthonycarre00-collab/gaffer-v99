#!/usr/bin/env python3
"""
V99 Phase 4.4: Add staff to the bundled database.

Currently 0 staff in the DB — the game generates procedural staff on new
game, which defeats the "real world" promise. This script adds real
managers + generic staff for all 114 clubs.

Managers are hand-curated for the Big 6 leagues + Eredivisie.
The rest get generated staff with realistic names + attributes.
"""

import json
import os
import hashlib
from pathlib import Path

DB_PATH = Path(__file__).parent.parent.parent / "src-tauri" / "databases" / "gaffer_world.json"

# =============================================================================
# REAL MANAGERS — 2023-24 season
# =============================================================================
# Format: "Team Name": ("First", "Last", Nationality, Age, Reputation, Formation)
REAL_MANAGERS = {
    # Premier League
    "Manchester City": ("Pep", "Guardiola", "Spain", 53, 95, "4-3-3"),
    "Arsenal": ("Mikel", "Arteta", "Spain", 42, 85, "4-3-3"),
    "Liverpool": ("Jürgen", "Klopp", "Germany", 57, 92, "4-3-3"),
    "Aston Villa": ("Unai", "Emery", "Spain", 52, 82, "4-2-3-1"),
    "Tottenham": ("Ange", "Postecoglou", "Australia", 58, 78, "4-3-3"),
    "Manchester United": ("Erik ten", "Hag", "Netherlands", 54, 75, "4-2-3-1"),
    "West Ham United": ("David", "Moyes", "Scotland", 61, 74, "4-2-3-1"),
    "Brighton": ("Roberto", "De Zerbi", "Italy", 44, 80, "4-2-3-1"),
    "Newcastle United": ("Eddie", "Howe", "England", 46, 76, "4-3-3"),
    "Chelsea": ("Mauricio", "Pochettino", "Argentina", 52, 82, "4-2-3-1"),
    "Wolves": ("Gary", "O'Neil", "England", 41, 68, "3-4-3"),
    "Fulham": ("Marco", "Silva", "Portugal", 47, 74, "4-2-3-1"),
    "Bournemouth": ("Andoni", "Iraola", "Spain", 42, 70, "4-3-3"),
    "Crystal Palace": ("Roy", "Hodgson", "England", 77, 72, "4-2-3-1"),
    "Brentford": ("Thomas", "Frank", "Denmark", 50, 73, "3-5-2"),
    "Everton": ("Sean", "Dyche", "England", 52, 70, "4-4-2"),
    "Nottingham Forest": ("Nuno", "Espírito Santo", "Portugal", 50, 72, "4-2-3-1"),
    "Luton Town": ("Rob", "Edwards", "England", 41, 60, "3-5-2"),
    "Burnley": ("Vincent", "Kompany", "Belgium", 37, 72, "4-3-3"),
    "Sheffield United": ("Chris", "Wilder", "England", 56, 66, "3-5-2"),

    # La Liga
    "Real Madrid": ("Carlo", "Ancelotti", "Italy", 65, 93, "4-3-3"),
    "Barcelona": ("Xavi", "Hernández", "Spain", 44, 85, "4-3-3"),
    "Atlético Madrid": ("Diego", "Simeone", "Argentina", 53, 88, "3-5-2"),
    "Athletic Club": ("Ernesto", "Valverde", "Spain", 59, 78, "4-2-3-1"),
    "Real Sociedad": ("Imanol", "Alguacil", "Spain", 52, 76, "4-3-3"),
    "Real Betis": ("Manuel", "Pellegrini", "Chile", 70, 78, "4-2-3-1"),
    "Villarreal": ("Marcelino", "García Toral", "Spain", 58, 74, "4-4-2"),
    "Valencia": ("Rubén", "Baraja", "Spain", 49, 68, "4-4-2"),
    "Sevilla": ("Quique", "Sánchez Flores", "Spain", 59, 70, "4-2-3-1"),
    "Girona": ("Michel", "Sánchez", "Spain", 47, 75, "4-3-3"),

    # Serie A
    "Inter": ("Simone", "Inzaghi", "Italy", 48, 82, "3-5-2"),
    "Juventus": ("Massimiliano", "Allegri", "Italy", 57, 80, "3-5-2"),
    "Milan": ("Stefano", "Pioli", "Italy", 58, 76, "4-2-3-1"),
    "Atalanta": ("Gian Piero", "Gasperini", "Italy", 66, 80, "3-4-3"),
    "Bologna": ("Thiago", "Motta", "Italy", 41, 74, "4-2-3-1"),
    "Roma": ("José", "Mourinho", "Portugal", 61, 88, "3-5-2"),
    "Lazio": ("Maurizio", "Sarri", "Italy", 65, 78, "4-3-3"),
    "Napoli": ("Walter", "Mazzarri", "Italy", 62, 72, "4-3-3"),
    "Fiorentina": ("Vincenzo", "Italiano", "Italy", 45, 73, "4-2-3-1"),

    # Bundesliga
    "Bayern Munich": ("Thomas", "Tuchel", "Germany", 50, 85, "4-2-3-1"),
    "Borussia Dortmund": ("Edin", "Terzić", "Germany", 41, 76, "4-2-3-1"),
    "Bayer Leverkusen": ("Xabi", "Alonso", "Spain", 42, 82, "3-4-3"),
    "RB Leipzig": ("Marco", "Rose", "Germany", 47, 76, "4-2-2-2"),
    "Stuttgart": ("Sebastian", "Hoeneß", "Germany", 41, 72, "4-2-3-1"),
    "Eintracht Frankfurt": ("Dino", "Toppmöller", "Germany", 43, 68, "3-4-3"),

    # Ligue 1
    "Paris SG": ("Luis", "Enrique", "Spain", 53, 85, "4-3-3"),
    "Monaco": ("Adi", "Hütter", "Austria", 54, 72, "4-3-3"),
    "Marseille": ("Gennaro", "Gattuso", "Italy", 46, 70, "4-3-3"),
    "Lille": ("Paulo", "Fonseca", "Portugal", 51, 73, "4-2-3-1"),
    "Nice": ("Francesco", "Farioli", "Italy", 34, 65, "4-3-3"),
    "Lyon": ("Pierre", "Sage", "France", 39, 60, "4-2-3-1"),

    # Eredivisie
    "Ajax": ("John", "van 't Schip", "Netherlands", 60, 68, "4-3-3"),
    "PSV": ("Peter", "Bosz", "Netherlands", 60, 72, "4-3-3"),
    "Feyenoord": ("Arne", "Slot", "Netherlands", 45, 76, "4-2-3-1"),
    "AZ Alkmaar": ("Maarten", "Martens", "Belgium", 39, 65, "4-3-3"),
    "Twente": ("Joseph", "Oosting", "Netherlands", 42, 62, "4-3-3"),
}

# Staff role types
STAFF_ROLES = [
    ("AssistantManager", "Assistant Gaffer"),
    ("Coach", "Coach"),
    ("Coach", "Coach"),
    ("Physio", "Physio"),
    ("Scout", "Scout"),
    ("Scout", "Scout"),
]

# Nationality pools for generating generic staff names
NAMES_BY_COUNTRY = {
    "England": [("James", "Wilson"), ("Michael", "Smith"), ("David", "Jones"), ("Paul", "Taylor"), ("Mark", "Brown")],
    "Spain": [("Carlos", "Ruiz"), ("Javier", "García"), ("Miguel", "López"), ("Antonio", "Sánchez"), ("Francisco", "Martín")],
    "Italy": [("Marco", "Rossi"), ("Luca", "Ferrari"), ("Andrea", "Esposito"), ("Matteo", "Bianchi"), ("Francesco", "Romano")],
    "Germany": [("Thomas", "Müller"), ("Andreas", "Schmidt"), ("Michael", "Schneider"), ("Stefan", "Fischer"), ("Klaus", "Weber")],
    "France": [("Pierre", "Martin"), ("Jean", "Bernard"), ("Nicolas", "Dubois"), ("Olivier", "Thomas"), ("Philippe", "Robert")],
    "Netherlands": [("Jan", "Jansen"), ("Pieter", "de Vries"), ("Dirk", "Bakker"), ("Hans", "Visser"), ("Bram", "Smit")],
}


def generate_staff_id(first, last, team_id, role):
    """Generate a stable staff ID."""
    raw = f"{first}_{last}_{team_id}_{role}"
    h = hashlib.md5(raw.encode()).hexdigest()[:8]
    return f"staff_{h}"


def add_staff():
    print(f"Loading database from {DB_PATH}...")
    with open(DB_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    teams = data.get("teams", [])
    existing_staff = data.get("staff", [])

    print(f"  Loaded: {len(teams)} teams, {len(existing_staff)} existing staff")

    staff = list(existing_staff)
    managers_added = 0
    other_staff_added = 0

    for team in teams:
        team_name = team.get("name", "")
        team_id = team.get("id", team_name.lower().replace(" ", "_"))
        team_country = team.get("country", "England")
        team_league = team.get("league_name", "Premier League")
        team_rep = team.get("reputation", 50)

        # --- Manager ---
        if team_name in REAL_MANAGERS:
            first, last, nationality, age, rep, formation = REAL_MANAGERS[team_name]
            manager = {
                "id": generate_staff_id(first, last, team_id, "Manager"),
                "first_name": first,
                "last_name": last,
                "full_name": f"{first} {last}",
                "match_name": last,
                "nationality": nationality[:2].upper() if len(nationality) >= 2 else "EN",
                "date_of_birth": f"{2024 - age}-01-01",
                "role": "Manager",
                "team_id": team_id,
                "attributes": {
                    "coaching": min(99, max(30, rep - 10)),
                    "judging_ability": min(99, max(30, rep - 15)),
                    "judging_potential": min(99, max(30, rep - 20)),
                    "physiotherapy": 30,
                },
                "wage": 50000 + rep * 1000,
                "reputation": rep,
            }
            staff.append(manager)
            managers_added += 1

            # Also update the team's formation to match the manager's preferred formation
            if formation:
                team["formation"] = formation

            # Add assistant manager (same nationality as manager)
            names_pool = NAMES_BY_COUNTRY.get(nationality, NAMES_BY_COUNTRY["England"])
            asst_first, asst_last = names_pool[0]
            assistant = {
                "id": generate_staff_id(asst_first, asst_last, team_id, "AssistantManager"),
                "first_name": asst_first,
                "last_name": asst_last,
                "full_name": f"{asst_first} {asst_last}",
                "match_name": asst_last,
                "nationality": nationality[:2].upper() if len(nationality) >= 2 else "EN",
                "date_of_birth": f"{2024 - (age + 5)}-06-01",
                "role": "AssistantManager",
                "team_id": team_id,
                "attributes": {
                    "coaching": min(95, max(30, rep - 20)),
                    "judging_ability": min(95, max(30, rep - 25)),
                    "judging_potential": min(95, max(30, rep - 30)),
                    "physiotherapy": 30,
                },
                "wage": 20000 + rep * 500,
                "reputation": max(30, rep - 20),
            }
            staff.append(assistant)
            other_staff_added += 1
        else:
            # Generate a generic manager for teams without a known manager
            names_pool = NAMES_BY_COUNTRY.get(team_country, NAMES_BY_COUNTRY["England"])
            mgr_first, mgr_last = names_pool[hash(team_name) % len(names_pool)]
            mgr_rep = max(40, min(75, team_rep // 12))
            manager = {
                "id": generate_staff_id(mgr_first, mgr_last, team_id, "Manager"),
                "first_name": mgr_first,
                "last_name": mgr_last,
                "full_name": f"{mgr_first} {mgr_last}",
                "match_name": mgr_last,
                "nationality": team_country[:2].upper() if len(team_country) >= 2 else "EN",
                "date_of_birth": f"{2024 - 50}-03-01",
                "role": "Manager",
                "team_id": team_id,
                "attributes": {
                    "coaching": mgr_rep,
                    "judging_ability": max(30, mgr_rep - 5),
                    "judging_potential": max(30, mgr_rep - 10),
                    "physiotherapy": 30,
                },
                "wage": 20000 + mgr_rep * 500,
                "reputation": mgr_rep,
            }
            staff.append(manager)
            managers_added += 1

        # --- Other staff (2 coaches, 1 physio, 2 scouts) ---
        for role_idx, (role_key, role_label) in enumerate(STAFF_ROLES[1:]):  # skip AssistantManager
            staff_idx = (hash(team_name) + role_idx * 7) % len(names_pool)
            s_first, s_last = names_pool[staff_idx]
            s_rep = max(30, min(80, team_rep // 15 + 20))

            if role_key == "Physio":
                attrs = {
                    "coaching": 30,
                    "judging_ability": 30,
                    "judging_potential": 30,
                    "physiotherapy": s_rep,
                }
            elif role_key == "Scout":
                attrs = {
                    "coaching": 30,
                    "judging_ability": s_rep,
                    "judging_potential": max(30, s_rep - 5),
                    "physiotherapy": 30,
                }
            else:  # Coach
                attrs = {
                    "coaching": s_rep,
                    "judging_ability": max(30, s_rep - 10),
                    "judging_potential": max(30, s_rep - 15),
                    "physiotherapy": 30,
                }

            member = {
                "id": generate_staff_id(s_first, s_last, team_id, role_key + str(role_idx)),
                "first_name": s_first,
                "last_name": s_last,
                "full_name": f"{s_first} {s_last}",
                "match_name": s_last,
                "nationality": team_country[:2].upper() if len(team_country) >= 2 else "EN",
                "date_of_birth": f"{2024 - 45}-0{(role_idx % 9) + 1}-15",
                "role": role_key,
                "team_id": team_id,
                "attributes": attrs,
                "wage": 10000 + s_rep * 300,
                "reputation": s_rep,
            }
            staff.append(member)
            other_staff_added += 1

    data["staff"] = staff

    # Save
    print(f"\nSaving database with {len(staff)} staff...")
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  Done! Size: {os.path.getsize(DB_PATH) / 1024 / 1024:.1f} MB")

    print(f"\n=== SUMMARY ===")
    print(f"  Managers added: {managers_added}")
    print(f"  Other staff added: {other_staff_added}")
    print(f"  Total staff: {len(staff)}")
    print(f"  Real managers: {sum(1 for s in staff if s.get('role') == 'Manager' and s.get('last_name') in [v[1] for v in REAL_MANAGERS.values()])}")


if __name__ == "__main__":
    add_staff()
