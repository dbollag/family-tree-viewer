#!/usr/bin/env python3
"""Writes the fictional sample family into app/public/data/*.json and a few SVG "scans" into app/public/scans/.

Everything here is invented. The Hartwell / Lindqvist / Moreau families do not exist; places are real towns only so the map has something to show.
Run from the repo root:  python3 scripts/make_sample_data.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "app" / "public"
DATA, SCANS = ROOT / "data", ROOT / "scans"
DATA.mkdir(parents=True, exist_ok=True)
SCANS.mkdir(parents=True, exist_ok=True)

# ---- places: id -> (name, country, lat, lon, note)
PLACES = {
    "L01": ("Gothenburg", "Sweden", 57.7089, 11.9746, ""),
    "L02": ("Malmö", "Sweden", 55.6050, 13.0038, ""),
    "L03": ("Uppsala", "Sweden", 59.8586, 17.6389, ""),
    "L04": ("Minneapolis", "United States", 44.9778, -93.2650, ""),
    "L05": ("Boston", "United States", 42.3601, -71.0589, ""),
    "L06": ("Lyon", "France", 45.7640, 4.8357, ""),
    "L07": ("Dijon", "France", 47.3220, 5.0415, ""),
    "L08": ("Stockholm", "Sweden", 59.3293, 18.0686, ""),
    "L09": ("Chicago", "United States", 41.8781, -87.6298, ""),
    "L10": ("Paris", "France", 48.8566, 2.3522, ""),
}

# ---- people: id, name, short, sex, born (year, place), died (year, place) or None, line, status, summary
# status is the basis of the main record; level is the simple label shown in the interface.
P = [
    ("P01", "Anna Hartwell", "Anna", "f", (1990, "L05"), None, "Hartwell", "CONFIRMED BY OWNER", "Confirmed", "Product designer in Boston. The centre of this sample tree.", "Yes"),
    ("P02", "Daniel Okoye", "Daniel", "m", (1989, "L09"), None, "Okoye", "CONFIRMED BY OWNER", "Confirmed", "Anna's husband. Grew up in Chicago.", "Yes"),
    ("P03", "Maya Okoye", "Maya", "f", (2018, "L05"), None, "Hartwell", "CONFIRMED BY OWNER", "Confirmed", "Daughter of Anna and Daniel.", "Yes"),
    ("P04", "Theo Okoye", "Theo", "m", (2021, "L05"), None, "Hartwell", "CONFIRMED BY OWNER", "Confirmed", "Son of Anna and Daniel.", "Yes"),
    ("P05", "Henrik Hartwell", "Henrik", "m", (1960, "L04"), None, "Hartwell", "RECORD", "Confirmed", "Retired engineer in Minneapolis. Son of Erik and Ingrid.", "Yes"),
    ("P06", "Claire Moreau", "Claire", "f", (1962, "L06"), None, "Moreau", "RECORD", "Confirmed", "Born in Lyon; moved to Minneapolis in 1985. Taught French.", "Yes"),
    ("P07", "Lucas Hartwell", "Lucas", "m", (1993, "L04"), None, "Hartwell", "CONFIRMED BY OWNER", "Confirmed", "Anna's younger brother.", "Yes"),
    ("P08", "Priya Nair", "Priya", "f", (1992, "L09"), None, "Nair", "CONFIRMED BY OWNER", "Confirmed", "Lucas's wife.", "Yes"),
    ("P09", "Ravi Hartwell", "Ravi", "m", (2022, "L04"), None, "Hartwell", "CONFIRMED BY OWNER", "Confirmed", "Son of Lucas and Priya.", "Yes"),
    ("P10", "Erik Hartwell", "Erik", "m", (1932, "L01"), (2009, "L04"), "Hartwell", "RECORD", "Confirmed", "Emigrated from Gothenburg to Minneapolis in 1955 and worked as a machinist.", None),
    ("P11", "Ingrid Lindqvist", "Ingrid", "f", (1935, "L02"), (2015, "L04"), "Lindqvist", "RECORD", "Confirmed", "Born in Malmö. Married Erik in 1957.", None),
    ("P12", "Karin Hartwell", "Karin", "f", (1958, "L04"), None, "Hartwell", "FAMILY ACCOUNT", "Probable", "Henrik's older sister; lives in Chicago.", "Yes"),
    ("P13", "Jean Moreau", "Jean", "m", (1934, "L06"), (2001, "L06"), "Moreau", "DATABASE ENTRY", "Probable", "Silk-trade clerk in Lyon.", None),
    ("P14", "Marguerite Dubois", "Marguerite", "f", (1937, "L07"), (2019, "L06"), "Dubois", "DATABASE ENTRY", "Probable", "Born in Dijon; married Jean in 1959.", None),
    ("P15", "Nils Hartwell", "Nils", "m", (1901, "L01"), (1975, "L01"), "Hartwell", "RECORD", "Confirmed", "Shipyard foreman in Gothenburg.", None),
    ("P16", "Astrid Berg", "Astrid", "f", (1905, "L03"), (1988, "L01"), "Berg", "RECORD", "Confirmed", "Born in Uppsala. Married Nils in 1929.", None),
    ("P17", "Lars Lindqvist", "Lars", "m", (1900, "L02"), (1969, "L02"), "Lindqvist", "FAMILY ACCOUNT", "Probable", "Baker in Malmö.", None),
    ("P18", "Olga Persson", "Olga", "f", (1904, None), (1980, "L02"), "Persson", "FAMILY ACCOUNT", "Probable", "Lars's wife; birthplace not recorded.", None),
    ("P19", "Pierre Moreau", "Pierre", "m", (1905, "L06"), (1968, "L06"), "Moreau", "DATABASE ENTRY", "Probable", "Father of Jean.", None),
    ("P20", "Louise Garnier", "Louise", "f", (1908, "L10"), (1990, "L06"), "Garnier", "DATABASE ENTRY", "Probable", "Mother of Jean.", None),
    ("P21", "Gustav Hartwell", "Gustav", "m", (1930, "L01"), (1999, "L08"), "Hartwell", "RECORD", "Confirmed", "Erik's older brother; stayed in Sweden.", None),
    ("P22", "Johan Hartwell", "Johan", "m", (1870, None), None, "Hartwell", "INFERENCE", "Possible", "Possibly Nils's father; named only in a later family note.", None),
]

# parent -> child links: (parent, child, status, level, note)
PARENT = [
    ("P01", "P03"), ("P02", "P03"), ("P01", "P04"), ("P02", "P04"),
    ("P05", "P01"), ("P06", "P01"), ("P05", "P07"), ("P06", "P07"), ("P05", "P12"), ("P06", "P12"),
    ("P07", "P09"), ("P08", "P09"),
    ("P10", "P05"), ("P11", "P05"), ("P10", "P12"), ("P11", "P12"),
    ("P13", "P06"), ("P14", "P06"),
    ("P15", "P10"), ("P16", "P10"), ("P15", "P21"), ("P16", "P21"),
    ("P17", "P11"), ("P18", "P11"),
    ("P19", "P13"), ("P20", "P13"),
    ("P22", "P15"),
]
PARENT_STATUS = {
    ("P22", "P15"): ("INFERENCE", "Possible", "Suggested by a later family note; no record names him as Nils's father."),
    ("P05", "P12"): ("FAMILY ACCOUNT", "Probable", "Stated by Henrik; no birth record seen."),
    ("P06", "P12"): ("FAMILY ACCOUNT", "Probable", "Stated by Henrik; no birth record seen."),
}
CONFIRMED_BY_OWNER = {"P01", "P02", "P03", "P04", "P07", "P08", "P09"}
PARTNER = [("P01", "P02", 2016, "L05"), ("P05", "P06", 1987, "L04"), ("P07", "P08", 2019, "L09"), ("P10", "P11", 1957, "L04"),
           ("P13", "P14", 1959, "L06"), ("P15", "P16", 1929, "L01"), ("P17", "P18", 1926, "L02"), ("P19", "P20", 1930, "L06")]

SOURCES = [  # id, label, publisher, type, status, note, scan
    ("S01", "Birth certificate, Erik Hartwell", "Gothenburg parish register (sample)", "Scan", "RECORD", "A fictional birth entry.", 1),
    ("S02", "Marriage record, Erik and Ingrid", "Hennepin County (sample)", "Scan", "RECORD", "A fictional marriage record.", 2),
    ("S03", "Passenger list, 1955 arrival", "Port of New York (sample)", "Scan", "RECORD", "A fictional passenger list.", 3),
    ("S04", "Family photograph, Hartwell reunion", "Family collection (sample)", "Family photograph", "FAMILY ACCOUNT", "Drawn placeholder, not a real photograph.", 4),
    ("S05", "Lyon civil register extract", "Archives of Lyon (sample)", "Database record", "DATABASE ENTRY", "Fictional database extract for the Moreau line.", None),
    ("S06", "Family notes by Karin Hartwell", "Karin Hartwell", "Family statement", "FAMILY ACCOUNT", "Notes written from memory.", None),
    ("S07", "Owner's own knowledge", "Owner", "Family statement", "CONFIRMED BY OWNER", "First-hand knowledge of living relatives.", None),
]
SRC_FOR = {  # person -> source id used for the main facts
    "P10": "S01", "P11": "S02", "P05": "S03", "P06": "S03", "P15": "S01", "P16": "S01", "P13": "S05", "P14": "S05", "P19": "S05", "P20": "S05",
    "P17": "S06", "P18": "S06", "P12": "S06", "P21": "S01", "P22": "S06",
}

people, facts, place_people, place_facts = [], [], {k: [] for k in PLACES}, {k: [] for k in PLACES}
fid = 0


def next_fid():
    global fid
    fid += 1
    return f"F{fid:03d}"


def add_fact(person, kind, text, status, sources, place=None, year=None, group=None, conflict=None):
    f = {"id": next_fid(), "person": person, "kind": kind, "date": "", "text": text, "status": status, "sources": sources}
    if place: f["place"] = place
    if year: f["year"] = str(year)
    if conflict: f["conflict"] = conflict
    facts.append(f)
    if place and group: place_facts[place].append({"id": f["id"], "person": person, "group": group})
    return f


for pid, name, short, sex, born, died, line, status, level, summary, living in P:
    src = ["S07"] if pid in CONFIRMED_BY_OWNER else [SRC_FOR[pid]]
    by, bp = born
    bplace = PLACES[bp][0] + ", " + PLACES[bp][1] if bp else "place not recorded"
    birth_txt = f"{by} · {bplace}"
    death_txt = ""
    if died:
        dy, dp = died
        death_txt = f"{dy} · {PLACES[dp][0]}, {PLACES[dp][1]}" if dp else str(dy)
    years = f"{by}–{died[0] if died else ''}"
    p = {"id": pid, "name": name, "short": short, "summary": summary, "sex": sex, "years": years, "status": status, "line": line,
         "variants": [], "spelling": [], "howSure": ("Known first-hand by the owner." if pid in CONFIRMED_BY_OWNER else
                                                   "A record names this person." if status == "RECORD" else
                                                   "Rests on a database extract or a family account."),
         "birth": birth_txt, "death": death_txt, "level": level}
    if living: p["living"] = living
    if pid == "P16": p["maidenName"] = "Berg"
    if pid == "P11": p["maidenName"] = "Lindqvist"
    people.append(p)
    bf = add_fact(pid, "BIRTH", f"Born in {bplace}." if bp else "Born; place not recorded.", status, src, place=bp, year=by)
    if bp:
        place_people[bp].append({"person": pid, "kind": "birth", "either": False, "fact": bf["id"]})
    if died:
        dp = died[1]
        df = add_fact(pid, "DEATH", f"Died in {PLACES[dp][0]}." if dp else "Died.", status, src, place=dp, year=died[0])
        if dp:
            place_people[dp].append({"person": pid, "kind": "death", "either": False, "fact": df["id"]})

# a few extra facts (residence, occupation, marriage, a conflict)
ids = {p["id"] for p in people}
add_fact("P10", "RESIDENCE", "Lived in Minneapolis from 1955.", "RECORD", ["S03"], place="L04", year=1955, group="Lived")
add_fact("P10", "OCCUPATION", "Machinist.", "RECORD", ["S03"], year=1955)
add_fact("P05", "RESIDENCE", "Lived in Minneapolis all his life.", "RECORD", ["S03"], place="L04", group="Lived")
add_fact("P06", "RESIDENCE", "Moved from Lyon to Minneapolis in 1985.", "RECORD", ["S03"], place="L04", year=1985, group="Lived")
add_fact("P01", "RESIDENCE", "Lives in Boston.", "CONFIRMED BY OWNER", ["S07"], place="L05", group="Lived")
add_fact("P02", "RESIDENCE", "Lives in Boston.", "CONFIRMED BY OWNER", ["S07"], place="L05", group="Lived")
add_fact("P21", "RESIDENCE", "Lived in Stockholm.", "RECORD", ["S01"], place="L08", group="Lived")
add_fact("P16", "BIRTH", "Birth year given as 1906 in a later record.", "FAMILY ACCOUNT", ["S06"], year=1906, conflict="K01")
for a, b, year, place in PARTNER:
    f = add_fact(a, "MARRIAGE", f"Married {next(p['name'] for p in people if p['id'] == b)} in {PLACES[place][0]}, {year}.",
                 "CONFIRMED BY OWNER" if a in CONFIRMED_BY_OWNER else "RECORD", ["S07"] if a in CONFIRMED_BY_OWNER else ["S02"], place=place, year=year, group="Married")

rels, rid = [], 0
for a, b in PARENT:
    rid += 1
    st, lv, note = PARENT_STATUS.get((a, b), (None, None, ""))
    if st is None:
        both = a in CONFIRMED_BY_OWNER and b in CONFIRMED_BY_OWNER
        st, lv = ("CONFIRMED BY OWNER", "Confirmed") if both else ("RECORD", "Confirmed") if a in {"P10", "P11", "P15", "P16", "P05", "P06"} else ("DATABASE ENTRY", "Probable")
    rels.append({"id": f"R{rid:02d}", "type": "parent", "a": a, "b": b, "status": st, "sources": [], "note": note, "level": lv})
for a, b, year, place in PARTNER:
    rid += 1
    st, lv = ("CONFIRMED BY OWNER", "Confirmed") if a in CONFIRMED_BY_OWNER else ("RECORD", "Confirmed") if a in {"P10", "P05", "P15"} else ("DATABASE ENTRY", "Probable")
    rels.append({"id": f"R{rid:02d}", "type": "partner", "a": a, "b": b, "status": st, "sources": [], "note": "", "level": lv, "label": "Spouse"})

sources = [{"id": s[0], "label": s[1], "publisher": s[2], "url": None, "scans": [s[6]] if s[6] else [], "type": s[3], "status": s[4], "note": s[5]} for s in SOURCES]

DOCS = [
    ("scan-01", 1, "Birth certificate, Erik Hartwell", "RECORD", ["P10"], False, "A fictional birth entry drawn for this sample."),
    ("scan-02", 2, "Marriage record, Erik and Ingrid", "RECORD", ["P10", "P11"], False, "A fictional marriage record drawn for this sample."),
    ("scan-03", 3, "Passenger list, 1955 arrival", "RECORD", ["P10"], False, "A fictional passenger list drawn for this sample."),
    ("scan-04", 4, "Family photograph, Hartwell reunion", "FAMILY ACCOUNT", ["P05", "P06", "P12", "P10", "P11"], True, "A drawn placeholder standing in for a family photograph."),
]
docs = []
for did, n, title, st, persons, photo, cap in DOCS:
    d = {"id": did, "scan": n, "title": title, "image": f"scans/sample-{n:02d}.svg", "caption": cap, "notes": [], "status": st, "persons": persons, "archiveUrl": None, "driveViewUrl": None}
    if photo: d["isPhoto"] = True
    docs.append(d)


def svg(title, lines, photo=False):
    body = "".join(f'<text x="60" y="{150 + i * 46}" font-size="26" fill="#3b3b3b" font-family="Georgia, serif">{l}</text>' for i, l in enumerate(lines))
    shapes = ('<rect x="60" y="150" width="680" height="300" fill="#d9d4c7"/><circle cx="260" cy="300" r="60" fill="#b9b2a0"/><circle cx="400" cy="290" r="70" fill="#b9b2a0"/><circle cx="560" cy="300" r="60" fill="#b9b2a0"/>'
              if photo else "")
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000"><rect width="800" height="1000" fill="#f3efe2"/>'
            f'<rect x="20" y="20" width="760" height="960" fill="none" stroke="#8a8372" stroke-width="3"/>'
            f'<text x="60" y="90" font-size="34" font-weight="bold" fill="#2a2a2a" font-family="Georgia, serif">{title}</text>{shapes}{body}'
            f'<text x="60" y="940" font-size="20" fill="#8a8372" font-family="Georgia, serif">Fictional sample document: not a real record.</text></svg>')


(SCANS / "sample-01.svg").write_text(svg("Certificate of Birth", ["Name: Erik Hartwell", "Born: 1932, Gothenburg", "Father: Nils Hartwell", "Mother: Astrid Berg"]))
(SCANS / "sample-02.svg").write_text(svg("Marriage Record", ["Groom: Erik Hartwell", "Bride: Ingrid Lindqvist", "Place: Minneapolis", "Year: 1957"]))
(SCANS / "sample-03.svg").write_text(svg("Passenger List", ["Hartwell, Erik, 23", "Machinist", "Port of departure: Gothenburg", "Arrival: 1955"]))
(SCANS / "sample-04.svg").write_text(svg("Hartwell reunion", [], photo=True))

conflicts = [{"id": "K01", "persons": ["P16"], "topic": "Astrid Berg's birth year", "status": "Open", "sources": ["S01", "S06"],
              "versions": [{"value": "1905", "status": "RECORD", "sources": ["S01"]}, {"value": "1906", "status": "FAMILY ACCOUNT", "sources": ["S06"]}],
              "note": "The birth entry says 1905; Karin's notes say 1906. Both are shown until a second record turns up."}]
questions = [{"id": "Q01", "persons": ["P22"], "text": "Was Johan Hartwell really Nils's father?", "status": "Open", "next": "Look for a baptism entry in Gothenburg."}]
spelling = [{"id": "SP01", "group": "Lindqvist", "variants": ["Lindquist", "Lindkvist"], "note": "Spellings seen across records; a difference alone neither merges nor splits people."}]
people[10]["spelling"] = ["SP01"]
people[10]["variants"] = ["Ingrid Lindquist"]
notes = {"title": "Hartwell · Lindqvist · Moreau (sample)", "defaultCentre": "P01",
         "howToRead": ["This is a fictional sample family. Nothing here is real data.",
                       "Click a box to open the side panel. Use the small tabs on a box to show parents, siblings or children.",
                       "Solid lines are confirmed; dashed lines are less certain."],
         "excluded": []}

places = []
for k, (name, country, lat, lon, note) in PLACES.items():
    places.append({"id": k, "name": name, "also": [], "country": country, "lat": lat, "lon": lon, "quality": "Town", "note": note,
                   "people": place_people[k], "facts": place_facts[k]})
for f in facts:  # make sure every place a fact points at has the fact listed (birth/death are covered by "people")
    pass

out = {"people": people, "relationships": rels, "facts": facts, "sources": sources, "conflicts": conflicts, "questions": questions,
       "documents": docs, "spelling": spelling, "notes": notes, "places": places}
for name, value in out.items():
    (DATA / f"{name}.json").write_text(json.dumps(value, indent=1, ensure_ascii=False) + "\n")
print({k: len(v) if isinstance(v, list) else 1 for k, v in out.items()})
