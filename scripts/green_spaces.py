#!/usr/bin/env python3
"""
green_spaces.py : small parks that the satellite model misses, from OpenStreetMap.

    python scripts/green_spaces.py --city "Ra'anana, Israel"

A 20 m cell is a mix of roofs, streets and trees, so a small park between buildings is often
classified as built. This reads the park, garden, grass and wood polygons of OpenStreetMap and marks
the 20 m cells that are almost entirely inside one. To avoid false positives a cell is kept only if
  - at least 90 % of it is inside the polygon (a 5 m raster is used for this), and
  - no more than 10 % of it is covered by an OpenStreetMap building.
Writes city_<name>/greens.json; web/prep.py then sets those cells to "never built" (green).
Run satellite_city.py first (the city grid is read from its JSON file).
"""
import argparse
import base64
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "web"))
import satellite_city as sc  # noqa: E402
import prep  # noqa: E402

S = 4          # sub-pixels per 20 m cell side (5 m raster)
MIN_IN = 0.90  # share of the cell inside a green polygon
MAX_BLD = 0.10  # share of the cell covered by buildings

GREEN = ('["leisure"~"^(park|garden|nature_reserve)$"]'
         '["access"!~"^(private|no)$"]')
GREEN2 = '["landuse"~"^(grass|forest|village_green)$"]'
GREEN3 = '["natural"~"^(wood|grassland)$"]'


def rings(el, zone):
    """Closed rings (outer, inner) of a way or relation, as UTM points."""
    def conv(g):
        return [prep.utm(p["lat"], p["lon"], zone) for p in g]
    if el["type"] == "way":
        return [conv(el["geometry"])] if el.get("geometry") else [], []
    out, inn = [], []
    for m in el.get("members", []):
        if m.get("type") == "way" and m.get("geometry") and m["geometry"][0] == m["geometry"][-1]:
            (inn if m.get("role") == "inner" else out).append(conv(m["geometry"]))
    return out, inn


def raster(polys, L, T, W, H, outer_only=False):
    """polys: list of (outer rings, inner rings). Returns a boolean raster at 5 m."""
    img = Image.new("L", (W * S, H * S), 0)
    dr = ImageDraw.Draw(img)
    to_px = lambda r: [((e - L) / 20 * S, (T - n) / 20 * S) for e, n in r]
    for out, inn in polys:
        for r in out:
            if len(r) >= 3:
                dr.polygon(to_px(r), fill=1)
        if not outer_only:
            for r in inn:
                if len(r) >= 3:
                    dr.polygon(to_px(r), fill=0)
    return np.asarray(img, dtype=np.uint8)


def share(a, W, H):
    return a.reshape(H, S, W, S).mean((1, 3))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", required=True)
    a = ap.parse_args()
    name = sc.slug(a.city)
    folder = os.path.join(sc.data_root(), "city_" + name)
    path = os.path.join(folder, "city_%s.json" % name)
    if not os.path.exists(path):
        sys.exit("Run satellite_city.py first: %s not found" % path)
    d = json.load(open(path, encoding="utf-8"))
    W, H = d["w"], d["h"]
    L, _, _, T = d["bounds"]
    zone = int(d["crs"][-2:])
    w, s, e, n = d["bbox"]
    bb = "(%f,%f,%f,%f)" % (s, w, n, e)
    rep = []
    q = "[out:json][timeout:170];(" + "".join(
        '%s%s%s;' % (t, f, bb) for t in ("way", "rel") for f in (GREEN, GREEN2, GREEN3)) + ");out geom;"
    js = sc.overpass(q, rep, tries=1, timeout=180)
    if js is None:
        sys.exit("OpenStreetMap unavailable, run again later.")
    greens = [rings(el, zone) for el in js["elements"]]
    print("green polygons: %d" % len(greens))
    qb = '[out:json][timeout:170];way["building"]%s;out geom;' % bb
    jb = sc.overpass(qb, rep, tries=1, timeout=180)
    if jb is None:
        sys.exit("OpenStreetMap buildings unavailable, run again later (no file written to stay safe).")
    blds = [rings(el, zone) for el in jb["elements"]]
    print("buildings: %d" % len(blds))
    g = share(raster(greens, L, T, W, H), W, H)
    b = share(raster(blds, L, T, W, H, outer_only=True), W, H)
    mask = ((g >= MIN_IN) & (b <= MAX_BLD)).astype("uint8")
    first = np.frombuffer(base64.b64decode(d["first"]), dtype="uint8").reshape(H, W)
    changed = int(((mask == 1) & (first != 255)).sum())
    print("cells in parks: %d, of which wrongly built in the model: %d (%.1f ha)" % (int(mask.sum()), changed, changed * 0.04))
    json.dump({"w": W, "h": H, "mask": base64.b64encode(mask.tobytes()).decode(),
               "note": "1 = 20 m cell almost entirely in an OpenStreetMap green polygon and without buildings"},
              open(os.path.join(folder, "greens.json"), "w"))


if __name__ == "__main__":
    main()
