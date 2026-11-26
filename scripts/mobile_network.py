#!/usr/bin/env python3
"""
mobile_network.py : the observed mobile network of a city by year, as a coarse density grid (no antenna position is published).

    python scripts/mobile_network.py --city "Ra'anana, Israel"      # run from satellite/, after satellite_city.py

Source: OpenCelliD (https://opencellid.org, CC BY-SA 4.0), the country file of the Israeli MCC (425). Token in satellite/.env as
OPENCELLID_TOKEN (never printed, never committed). The file is downloaded once into city_<name>/raw/opencellid/ and reused.

Method: cells near the city (plus a margin) are kept (samples >= 3, range <= 5 km); cells of one operator within 40 m are one SITE
(a tower carries many sectors and 2G/3G/4G/5G cells); a site appears the year of its oldest cell (not before 2008) and is removed only when
all its cells were last seen more than 3 years before the file AND its neighbours of the same operator are still being seen (a dead
cell, not a quiet area). Per year, the active sites are counted in 400 m blocks and smoothed (Gaussian, sigma 400 m).

Writes city_<name>/mobile.json {block_m, w, h, years, data (one base64 uint8 grid per year), totals, source} and report_mobile.txt.
mobile.json holds NO longitude or latitude of any site. Caution: the growth in OpenCelliD also reflects more contributors, not only
more antennas, so the layer is called "observed network" and never "radiation" or "exposure".
"""
import argparse
import base64
import csv
import datetime
import gzip
import json
import math
import os
import sys

import numpy as np
import requests
from scipy.ndimage import gaussian_filter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import satellite_city as sc  # noqa: E402

MCC = 425
BLOCK = 400            # metres
SIGMA = 1.0            # in blocks (400 m)
MARGIN = 1500          # metres around the city kept, so the mesh does not stop at the edge
SITE_M = 40            # cells of one operator closer than this are one site
MIN_SAMPLES, MAX_RANGE = 3, 5000
FIRST_YEAR = 2008      # before, OpenCelliD barely has contributors
STALE_YEARS = 3
NEIGH_M = 2000
URL = "https://opencellid.org/ocid/downloads?token=%s&type=mcc&file=%d.csv.gz"


def token():
    t = os.environ.get("OPENCELLID_TOKEN")
    path = os.path.join(sc.data_root(), ".env")
    if not t and os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            if line.startswith("OPENCELLID_TOKEN="):
                t = line.split("=", 1)[1].strip()
    return t


def fetch(folder):
    """Path of the country file, downloaded once (the daily quota is small)."""
    d = os.path.join(folder, "raw", "opencellid")
    os.makedirs(d, exist_ok=True)
    path = os.path.join(d, "%d.csv.gz" % MCC)
    if os.path.exists(path):
        return path
    t = token()
    if not t:
        sys.exit("Put OPENCELLID_TOKEN in satellite/.env (free token at opencellid.org).")
    r = requests.get(URL % (t, MCC), headers=sc.UA, timeout=300)
    if r.status_code != 200 or r.content[:2] != b"\x1f\x8b":
        sys.exit("OpenCelliD answered HTTP %d (quota or token): try again later." % r.status_code)
    open(path, "wb").write(r.content)
    return path


def read_cells(path, bbox, to_xy):
    """Cells inside the box (degrees, with margin) as (net, x, y, created, updated); x and y in metres (UTM of the city)."""
    w, s, e, n = bbox
    pad = MARGIN / 90000.0
    out, newest = [], 0
    with gzip.open(path, "rt", encoding="utf-8") as f:
        for r in csv.reader(f):
            try:
                lon, lat = float(r[6]), float(r[7])
                created, updated = int(r[11]), int(r[12])
            except (ValueError, IndexError):
                continue
            newest = max(newest, updated)
            if not (w - pad < lon < e + pad and s - pad < lat < n + pad):
                continue
            if int(r[9]) < MIN_SAMPLES or int(r[8]) > MAX_RANGE:
                continue
            x, y = to_xy(lon, lat)
            out.append((r[2], x, y, created, updated))
    return out, newest


def sites_of(cells):
    """Group the cells of one operator within SITE_M of each other: (net, x, y, first_ts, last_ts, oldest_update) per site."""
    sites = []
    for net in sorted({c[0] for c in cells}):
        grp = []   # [sx, sy, n, created_min, updated_max, updated_min]
        for _, x, y, cr, up in sorted((c for c in cells if c[0] == net), key=lambda c: c[3]):
            for g in grp:
                if math.hypot(g[0] / g[2] - x, g[1] / g[2] - y) <= SITE_M:
                    g[0] += x
                    g[1] += y
                    g[2] += 1
                    g[3] = min(g[3], cr)
                    g[4] = max(g[4], up)
                    g[5] = min(g[5], up)
                    break
            else:
                grp.append([x, y, 1, cr, up, up])
        sites += [(net, g[0] / g[2], g[1] / g[2], g[3], g[4], g[5]) for g in grp]
    return sites


def yearof(ts):
    return datetime.datetime.fromtimestamp(ts, datetime.timezone.utc).year


def active_years(sites, newest):
    """For each site, (first_year, last_year or None while active)."""
    stale = newest - STALE_YEARS * 365.25 * 86400
    out = []
    for i, (net, x, y, cr, up, up_min) in enumerate(sites):
        first = max(FIRST_YEAR, yearof(cr))
        last = None
        if up < stale:   # every cell of the site is old: removed only if the neighbours of the same operator are still seen
            near = [o for j, o in enumerate(sites) if j != i and o[0] == net and math.hypot(o[1] - x, o[2] - y) <= NEIGH_M]
            if near and any(o[4] >= stale for o in near):
                last = yearof(up)
        out.append((first, last))
    return out


def build(sites, years_ok, bounds, first_year, last_year):
    """Density grids per year (uint8, scaled to the maximum of the last year) and the number of sites per year."""
    E0, N0, E1, N1 = bounds
    w, h = math.ceil((E1 - E0) / BLOCK), math.ceil((N1 - N0) / BLOCK)
    years = list(range(first_year, last_year + 1))
    grids, totals = [], []
    for yr in years:
        g = np.zeros((h, w), "float64")
        n = 0
        for (net, x, y, *_), (f, l) in zip(sites, years_ok):
            if f > yr or (l is not None and l < yr):
                continue
            n += 1
            bx, by = int((x - E0) // BLOCK), int((N1 - y) // BLOCK)
            if 0 <= bx < w and 0 <= by < h:
                g[by, bx] += 1
        grids.append(gaussian_filter(g, SIGMA, mode="constant"))
        totals.append(n)
    top = max(grids[-1].max(), 1e-9)
    data = [base64.b64encode(np.clip(np.rint(g / top * 255), 0, 255).astype("uint8").tobytes()).decode() for g in grids]
    return {"block_m": BLOCK, "w": w, "h": h, "years": years, "data": data, "totals": totals,
            "source": "OpenCelliD, CC BY-SA 4.0"}


def no_coordinates(obj):
    """True when the output holds only the coarse grid: no key or value that looks like a position of a site."""
    bad = {"lat", "lon", "lng", "latitude", "longitude", "sites", "cells", "x", "y"}
    if isinstance(obj, dict):
        return not (bad & set(obj)) and all(no_coordinates(v) for v in obj.values())
    if isinstance(obj, list):
        return all(no_coordinates(v) for v in obj)
    return True


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--city", default="Ra'anana, Israel")
    ap.add_argument("--slug", help="city folder name (city_<slug>) when the name is not in latin letters")
    a = ap.parse_args()
    name = a.slug or sc.slug(a.city)
    folder = os.path.join(sc.data_root(), "city_" + name)
    src = os.path.join(folder, "city_%s.json" % name)
    if not os.path.exists(src):
        sys.exit("Run satellite_city.py first: %s not found" % src)
    cj = json.load(open(src, encoding="utf-8"))
    from rasterio.warp import transform
    to_xy = lambda lon, lat: tuple(v[0] for v in transform("EPSG:4326", cj["crs"], [lon], [lat]))   # noqa: E731
    cells, newest = read_cells(fetch(folder), cj["bbox"], to_xy)
    if not cells:
        sys.exit("No OpenCelliD cell near this city.")
    sites = sites_of(cells)
    ok = active_years(sites, newest)
    last_year = yearof(newest)
    first = min(f for f, _ in ok)
    out = build(sites, ok, cj["bounds"], first, last_year)
    assert no_coordinates(out)
    json.dump(out, open(os.path.join(folder, "mobile.json"), "w"), separators=(",", ":"))
    with open(os.path.join(folder, "report_mobile.txt"), "w", encoding="utf-8") as f:
        f.write("Observed mobile network, %s (OpenCelliD, file of %s)\n" % (name, datetime.date.fromtimestamp(newest)))
        f.write("%d cells kept, %d sites (operators: %d); first sample of the city: %d\n" % (
            len(cells), len(sites), len({s[0] for s in sites}), yearof(min(c[3] for c in cells))))
        f.write("Sites per year (more sites also means more contributors, not only more antennas):\n")
        for y, n in zip(out["years"], out["totals"]):
            f.write("  %d  %d\n" % (y, n))
    print(open(os.path.join(folder, "report_mobile.txt"), encoding="utf-8").read())
    print("Output file:", os.path.join(folder, "mobile.json"))


if __name__ == "__main__":
    main()
