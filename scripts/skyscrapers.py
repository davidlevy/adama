#!/usr/bin/env python3
"""
skyscrapers.py : real tall buildings of a city, from OpenStreetMap (footprint, height, start year when known).

    python scripts/skyscrapers.py --city "Tel Aviv, Israel"

Satellite images cannot give building heights, so this reads the height tags that mappers added to
OpenStreetMap (height in metres, or building:levels). Buildings of at least --min-height metres
(default 50) are kept. Writes city_<name>/towers.json, which the viewer draws as tall black towers.
Run satellite_city.py first (the city bounding box is read from its JSON file).
"""
import argparse
import json
import math
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import satellite_city as sc  # noqa: E402

H_RE = r"^([5-9][0-9]|[0-9]{3,})([.][0-9]+)?( ?m)?$"        # height tag of 50 m or more
L_RE = r"^(1[5-9]|[2-9][0-9]|[0-9]{3,})$"                  # 15 floors or more


def parse_height(tags):
    m = re.match(r"^\s*([0-9]+(?:[.,][0-9]+)?)", tags.get("height", ""))
    if m:
        return float(m.group(1).replace(",", "."))
    m = re.match(r"^\s*([0-9]+)", tags.get("building:levels", ""))
    return int(m.group(1)) * 3.3 if m else 0.0


def tower(el, min_h):
    tags, geom = el.get("tags", {}), el.get("geometry")
    h = parse_height(tags)
    if not geom or h < min_h:
        return None
    lats, lons = [p["lat"] for p in geom], [p["lon"] for p in geom]
    lat, lon = (min(lats) + max(lats)) / 2, (min(lons) + max(lons)) / 2
    w = (max(lons) - min(lons)) * 111320.0 * math.cos(math.radians(lat))
    d = (max(lats) - min(lats)) * 110574.0
    m = re.match(r"^\s*(\d{4})", tags.get("start_date", ""))
    name = tags.get("name:en") or tags.get("name") or ""
    return [round(lat, 6), round(lon, 6), round(h), round(max(w, 8)), round(max(d, 8)), int(m.group(1)) if m else 0, name]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--city", default="Ra'anana, Israel")
    ap.add_argument("--min-height", type=float, default=50)
    a = ap.parse_args()
    name = sc.slug(a.city)
    out_dir = os.path.join(sc.data_root(), "city_" + name)
    src = os.path.join(out_dir, "city_%s.json" % name)
    if not os.path.exists(src):
        sys.exit("Run satellite_city.py first: %s not found" % src)
    bb = json.load(open(src, encoding="utf-8"))["bbox"]   # lon_min, lat_min, lon_max, lat_max
    box = "(%f,%f,%f,%f)" % (bb[1], bb[0], bb[3], bb[2])
    q = ('[out:json][timeout:170];(way["building"]["height"~"%s"]%s;way["building"]["building:levels"~"%s"]%s;);out tags geom;'
         % (H_RE, box, L_RE, box))
    rep = []
    sc.log("Asking OpenStreetMap for tall buildings ...", rep)
    data = sc.overpass(q, rep, tries=1, timeout=180)   # a big city scans millions of buildings: wait for the answer instead of restarting
    if data is None:
        sys.exit("OpenStreetMap did not answer. Run the same command again in a minute.")
    towers = [t for t in (tower(e, a.min_height) for e in data.get("elements", [])) if t]
    towers.sort(key=lambda t: -t[2])
    json.dump({"fields": ["lat", "lon", "height_m", "width_m", "depth_m", "start_year", "name"], "towers": towers},
              open(os.path.join(out_dir, "towers.json"), "w", encoding="utf-8"), ensure_ascii=False)
    sc.log("%d buildings of %d m or more (tallest: %s)" % (len(towers), a.min_height,
           ", ".join("%s %d m" % (t[6] or "?", t[2]) for t in towers[:3])), rep)
    print("Output file:", os.path.join(out_dir, "towers.json"))


if __name__ == "__main__":
    main()
