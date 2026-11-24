#!/usr/bin/env python3
"""
tower_dates.py : construction years of the tall towers of a city, from Wikidata.

    python scripts/tower_dates.py --city "Tel Aviv, Israel"

OpenStreetMap rarely tells when a tower was built, so without this the viewer draws every tower as soon as
its 20 m cell is "built" in the satellite model (often 1985, long before the tower). This reads the buildings
of Wikidata that have a height and an inception/opening year, matches them to the towers of towers.json
(within 70 m and with a similar height) and writes the year in towers.json (field start_year).
Only towers with no year yet are changed. Run skyscrapers.py first.
Towers that stay undated are drawn from 1990 at the earliest by the viewer (see UNDATED_FROM in app.js).
"""
import argparse
import json
import math
import os
import sys

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import satellite_city as sc  # noqa: E402

MAX_DIST_M = 70
MAX_H_DIFF = 0.35   # relative difference of heights allowed between the two sources


def wikidata(lat, lon, radius_km):
    q = ('SELECT ?l ?h ?y ?c WHERE { SERVICE wikibase:around { ?i wdt:P625 ?c . '
         'bd:serviceParam wikibase:center "Point(%f %f)"^^geo:wktLiteral . bd:serviceParam wikibase:radius "%f" . } '
         '?i wdt:P2048 ?h . FILTER(?h >= 45) OPTIONAL { ?i wdt:P571 ?inc } OPTIONAL { ?i wdt:P1619 ?op } '
         'BIND(YEAR(COALESCE(?inc,?op)) AS ?y) FILTER(BOUND(?y)) ?i rdfs:label ?l . FILTER(LANG(?l)="en") }' % (lon, lat, radius_km))
    r = requests.get("https://query.wikidata.org/sparql", params={"query": q, "format": "json"},
                     headers={"User-Agent": "adama-open-source/1.0 (city timelapse)"}, timeout=120)
    r.raise_for_status()
    out = []
    for b in r.json()["results"]["bindings"]:
        x, y = b["c"]["value"].replace("Point(", "").replace(")", "").split()
        out.append((float(y), float(x), float(b["h"]["value"]), int(b["y"]["value"])))
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--city", required=True)
    a = ap.parse_args()
    name = sc.slug(a.city)
    folder = os.path.join(sc.data_root(), "city_" + name)
    tp = os.path.join(folder, "towers.json")
    if not os.path.exists(tp):
        sys.exit("Run skyscrapers.py first: %s not found" % tp)
    w, s, e, n = json.load(open(os.path.join(folder, "city_%s.json" % name), encoding="utf-8"))["bbox"]
    lat, lon = (s + n) / 2, (w + e) / 2
    radius = math.hypot((n - s) * 111, (e - w) * 111 * math.cos(math.radians(lat))) / 2
    items = wikidata(lat, lon, radius)
    data = json.load(open(tp, encoding="utf-8"))
    kx = 111000 * math.cos(math.radians(lat))
    done = 0
    for t in data["towers"]:
        if t[5]:
            continue
        best = min(((math.hypot((t[0] - i[0]) * 111000, (t[1] - i[1]) * kx), i) for i in items), key=lambda z: z[0], default=None)
        if best and best[0] <= MAX_DIST_M and abs(best[1][2] - t[2]) / max(t[2], 1) <= MAX_H_DIFF:
            t[5] = best[1][3]
            done += 1
    json.dump(data, open(tp, "w", encoding="utf-8"), ensure_ascii=False)
    print("%d of %d towers got a year from Wikidata (%d Wikidata buildings with a year)" % (done, len(data["towers"]), len(items)))


if __name__ == "__main__":
    main()
