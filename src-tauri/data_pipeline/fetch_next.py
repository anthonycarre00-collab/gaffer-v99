#!/usr/bin/env python3
"""Process next N unprocessed players — no start index needed."""
import json, os, time, shutil, urllib.request, urllib.parse, re
from pathlib import Path

DB_PATH = Path("src-tauri/databases/gaffer_world.json")
FACE_CACHE_DIR = Path("src-tauri/databases/face-cache")
PUBLIC_FACE_DIR = Path("public/face-cache")
MANIFEST_PATH = Path("src-tauri/databases/fetch_manifest.json")
UA = "GafferGame/1.0 (https://github.com/anthonycarre00-collab/gaffer-v99)"

NAT_WORDS = {"ESP":"Spanish","ENG":"English","FRA":"French","GER":"German","ITA":"Italian","BRA":"Brazilian","ARG":"Argentine","POR":"Portuguese","NED":"Dutch","BEL":"Belgian","SUI":"Swiss","AUT":"Austrian","CRO":"Croatian","SRB":"Serbian","POL":"Polish","TUR":"Turkish","GRE":"Greek","RUS":"Russian","UKR":"Ukrainian","DEN":"Danish","SWE":"Swedish","NOR":"Norwegian","FIN":"Finnish","CZE":"Czech","SVK":"Slovak","SVN":"Slovenian","BIH":"Bosnian","ALB":"Albanian","MAR":"Moroccan","ALG":"Algerian","TUN":"Tunisian","SEN":"Senegalese","CIV":"Ivorian","CMR":"Cameroonian","NGA":"Nigerian","GHA":"Ghanaian","MEX":"Mexican","COL":"Colombian","URU":"Uruguayan","PAR":"Paraguayan","ECU":"Ecuadorian","VEN":"Venezuelan","CHI":"Chilean","PER":"Peruvian","JPN":"Japanese","KOR":"South Korean","AUS":"Australian","USA":"American","CAN":"Canadian","IRL":"Irish","WAL":"Welsh","SCO":"Scottish","NIR":"Northern Irish","MKD":"Macedonian","MNE":"Montenegrin","ISL":"Icelandic","EST":"Estonian","LAT":"Latvian","LTU":"Lithuanian","HUN":"Hungarian","ROU":"Romanian","BUL":"Bulgarian","GEO":"Georgian","ARM":"Armenian","KAZ":"Kazakh","UZB":"Uzbek","EGY":"Egyptian","RSA":"South African","ZIM":"Zimbabwean","ZAM":"Zambian","ANG":"Angolan","MOZ":"Mozambican","CRC":"Costa Rican","PAN":"Panamanian","HON":"Honduran","JAM":"Jamaican","TRI":"Trinidadian","BAR":"Barbadian","GAM":"Gambian","GUI":"Guinean","MLI":"Malian","COD":"Congolese","GAB":"Gabonese","CPV":"Cape Verdean","NAM":"Namibian"}

def fetch_wiki(name, nat=None):
    result = {"image_url": None, "height_cm": None, "weight_kg": None}
    nat_word = NAT_WORDS.get(nat or "", "")
    search = f"{name} {nat_word} footballer" if nat_word else f"{name} footballer"
    try:
        url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(search)}&format=json&srlimit=1"
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
        results = data.get("query",{}).get("search",[])
        if not results:
            url2 = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(name)}&format=json&srlimit=1"
            req2 = urllib.request.Request(url2, headers={"User-Agent": UA})
            with urllib.request.urlopen(req2, timeout=5) as resp2:
                data2 = json.loads(resp2.read().decode())
            results = data2.get("query",{}).get("search",[])
            if not results: return result
        title = results[0]["title"]
        eurl = f"https://en.wikipedia.org/w/api.php?action=query&titles={urllib.parse.quote(title)}&prop=pageimages|extracts&format=json&pithumbsize=200&exintro=true&explaintext=true"
        req3 = urllib.request.Request(eurl, headers={"User-Agent": UA})
        with urllib.request.urlopen(req3, timeout=5) as resp3:
            pdata = json.loads(resp3.read().decode())
        for _, page in pdata.get("query",{}).get("pages",{}).items():
            thumb = page.get("thumbnail",{}).get("source")
            if thumb: result["image_url"] = thumb
            extract = page.get("extract","")
            if extract:
                h = re.search(r'(\d+\.\d+)\s*m\s*\(', extract)
                if h: result["height_cm"] = int(float(h.group(1)) * 100)
                else:
                    h2 = re.search(r'(\d{3})\s*cm', extract)
                    if h2: result["height_cm"] = int(h2.group(1))
                w = re.search(r'(\d{2,3})\s*kg', extract)
                if w: result["weight_kg"] = int(w.group(1))
    except: pass
    return result

def main():
    import sys
    batch_size = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    
    with open(DB_PATH) as f: db = json.load(f)
    with open(MANIFEST_PATH) as f: manifest = json.load(f)
    
    players = sorted(db["players"], key=lambda p: p.get("ovr",0), reverse=True)
    unprocessed = [p for p in players if p.get("id","") not in manifest["processed"]]
    
    to_process = unprocessed[:batch_size]
    imgs = 0; fails = 0
    
    for p in to_process:
        name = p.get("full_name",""); pid = p.get("id",""); nat = p.get("nationality","")
        if not name or not pid: continue
        
        wiki = fetch_wiki(name, nat)
        if wiki["image_url"]:
            img_path = FACE_CACHE_DIR / f"{pid}.png"
            try:
                req = urllib.request.Request(wiki["image_url"], headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=8) as resp:
                    img_data = resp.read()
                with open(img_path, "wb") as f: f.write(img_data)
                p["media"] = {"face": f"face-cache/{pid}.png"}
                imgs += 1
            except: fails += 1
        else: fails += 1
        
        manifest["processed"][pid] = {"image": bool(wiki["image_url"]), "height": wiki["height_cm"], "weight": wiki["weight_kg"]}
        if wiki["height_cm"]: manifest["heights"][pid] = wiki["height_cm"]
        if wiki["weight_kg"]: manifest["weights"][pid] = wiki["weight_kg"]
        time.sleep(0.2)
    
    # Save manifest
    with open(MANIFEST_PATH, "w") as f: json.dump(manifest, f)
    
    # Save DB (temp + validate + replace)
    tmp = DB_PATH.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f: json.dump(db, f, ensure_ascii=False, separators=(",",":"))
    with open(tmp) as f: json.load(f)  # validate
    os.replace(tmp, DB_PATH)
    
    # Copy images to public
    for img in FACE_CACHE_DIR.glob("*.png"):
        dest = PUBLIC_FACE_DIR / img.name
        if not dest.exists(): shutil.copy2(img, dest)
    
    has_img = sum(1 for p in db["players"] if p.get("media",{}).get("face"))
    remaining = len(unprocessed) - len(to_process)
    print(f"Batch: imgs={imgs} fails={fails} | Total: {has_img}/3376 | Processed: {len(manifest['processed'])} | Remaining: {remaining}")

if __name__ == "__main__":
    main()
