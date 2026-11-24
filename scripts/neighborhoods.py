#!/usr/bin/env python3
"""
neighborhoods.py : neighbourhood and suburb names of a city, from OpenStreetMap.

    python scripts/neighborhoods.py --city "Ra'anana, Israel"

Reads the place=suburb|neighbourhood|quarter points of the city bounding box and writes
city_<name>/neighborhoods.json. The viewer computes the green trend of each one from the
built-up years, and shows it as a pill on the map.
Run satellite_city.py first (the city bounding box is read from its JSON file).
"""
import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import satellite_city as sc  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--city", default="Ra'anana, Israel")
    a = ap.parse_args()
    name = sc.slug(a.city)
    out_dir = os.path.join(sc.data_root(), "city_" + name)
    src = os.path.join(out_dir, "city_%s.json" % name)
    if not os.path.exists(src):
        sys.exit("Run satellite_city.py first: %s not found" % src)
    bb = json.load(open(src, encoding="utf-8"))["bbox"]   # lon_min, lat_min, lon_max, lat_max
    box = "(%f,%f,%f,%f)" % (bb[1], bb[0], bb[3], bb[2])
    sel = '["place"~"^(suburb|neighbourhood|quarter)$"]["name"]' + box
    q = '[out:json][timeout:90];(node%s;way%s;relation%s;);out tags center;' % (sel, sel, sel)
    rep = []
    sc.log("Asking OpenStreetMap for neighbourhoods ...", rep)
    data = sc.overpass(q, rep, tries=1, timeout=120)
    if data is None:
        sys.exit("OpenStreetMap did not answer. Run the same command again in a minute.")
    hoods = []
    for e in data.get("elements", []):
        t = e.get("tags", {})
        c = e if e["type"] == "node" else e.get("center")
        if not c:
            continue
        nm, he = t.get("name", ""), t.get("name:he", "")
        if re.fullmatch(r"[0-9 ]+", nm) and not he:
            continue   # bare numbers such as "2004" say nothing without the Hebrew name
        hoods.append([round(c["lat"], 6), round(c["lon"], 6), nm, t.get("name:en", ""), he, t["place"]])
    json.dump({"fields": ["lat", "lon", "name", "name_en", "name_he", "place"], "hoods": hoods},
              open(os.path.join(out_dir, "neighborhoods.json"), "w", encoding="utf-8"), ensure_ascii=False)
    sc.log("%d neighbourhoods" % len(hoods), rep)
    print("Output file:", os.path.join(out_dir, "neighborhoods.json"))


if __name__ == "__main__":
    main()
