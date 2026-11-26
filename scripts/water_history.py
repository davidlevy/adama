#!/usr/bin/env python3
"""
water_history.py : where there was water, year by year (Dead Sea shore, Aral Sea, reservoirs), from the images satellite_city.py already cached.

    python scripts/water_history.py --city "Qumran"     # run from satellite/, after satellite_city.py (no new download)

Each cached yearly composite (city_<name>/raw/s2_<year>.npz and ls_<year>.npz) gives a water mask: MNDWI = (green - swir) / (green + swir)
above a threshold and a dark near infrared. Sentinel-2 (10 m) wins over Landsat (30 m) for 2017 and later. The masks are brought to the 20 m
grid of the city, smoothed in time (a year counts when 2 of its 3 neighbouring years agree) and reduced to TWO bytes per cell:
the first and the last year the cell holds water (an index in `years`, 255 = never). Water.json {years, w, h, first, last} is what the viewer reads:
a cell is water in year Y when first <= Y <= last. Only the cells whose water changes are drawn year by year; the rest keeps the static water.
Limits: MNDWI also takes wet salt flats and some shadows for water; the sensor change in 2017 moves the shoreline by a few tens of metres.
"""
import argparse
import base64
import json
import os
import sys

import numpy as np
from scipy.ndimage import distance_transform_edt, median_filter, zoom

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import satellite_city as sc  # noqa: E402

MNDWI_MIN = 0.10   # above this the pixel is water
NIR_MAX = 0.20     # and its near infrared is dark (rules out bright wet sand)
MIN_CHANGE = 4     # cells whose water changes, below this the city has no water history worth drawing


def to_grid(a, h, w):
    """Bring a 2D array to (h, w) by block mean (finer data) or nearest (coarser data)."""
    if a.shape == (h, w):
        return a
    if a.shape[0] >= h and a.shape[1] >= w:
        fy, fx = a.shape[0] // h, a.shape[1] // w
        a = a[:h * fy, :w * fx]
        return a.reshape(h, fy, w, fx).mean((1, 3))
    return zoom(a, (h / a.shape[0], w / a.shape[1]), order=0)[:h, :w]


def water_of(z, h, w):
    """(water, known) on the city grid: a pixel with no valid scene (gap of a scan line, cloud) is unknown, never "dry"."""
    g, s, n = (to_grid(z[k].astype("float32"), h, w) for k in ("green", "swir", "nir"))
    known = np.isfinite(g) & np.isfinite(s) & np.isfinite(n) & (to_grid(z["n_valid"].astype("float32"), h, w) >= 0.99)
    g, s, n = (np.nan_to_num(v, nan=0.0) for v in (g, s, n))
    mndwi = (g - s) / np.maximum(g + s, 1e-6)
    return (mndwi > MNDWI_MIN) & (n < NIR_MAX), known


def fill_unknown(stack, known):
    """Unknown years take the state of the nearest earlier known year, else the nearest later one."""
    out = stack.copy()
    n = out.shape[0]
    seen = np.zeros(out.shape[1:], bool)
    val = np.zeros(out.shape[1:], bool)
    for i in range(n):   # forward
        val = np.where(known[i], out[i], val)
        seen |= known[i]
        out[i] = np.where(known[i], out[i], val)
    ok = seen.copy()
    val = np.zeros(out.shape[1:], bool)
    got = np.zeros(out.shape[1:], bool)
    for i in range(n - 1, -1, -1):   # backward, for the cells with no earlier year
        val = np.where(known[i], stack[i], val)
        got |= known[i]
        out[i] = np.where(known[i] | ok, out[i], val)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--city", default="Qumran")
    ap.add_argument("--slug")
    a = ap.parse_args()
    name = a.slug or sc.slug(a.city)
    folder = os.path.join(sc.data_root(), "city_" + name)
    d = json.load(open(os.path.join(folder, "city_%s.json" % name), encoding="utf-8"))
    h, w = d["h"], d["w"]
    raw = os.path.join(folder, "raw")
    masks = {}
    for y in d["years"]:
        for pre in ("s2", "ls"):   # Sentinel-2 first
            p = os.path.join(raw, "%s_%d.npz" % (pre, y))
            if os.path.exists(p):
                masks[y] = water_of(np.load(p), h, w)
                break
    years = sorted(masks)
    if len(years) < 10:
        sys.exit("Only %d cached years: run satellite_city.py first." % len(years))
    raw_stack = np.stack([masks[y][0] for y in years])
    known = np.stack([masks[y][1] for y in years])
    stack = fill_unknown(raw_stack, known)
    stack = np.stack([median_filter(m.astype("uint8"), size=3) for m in stack]).astype(bool)   # (years, h, w), small speckle removed
    # time smoothing: a year is water when at least 2 of the 3 years around it are (edges: the year and its only neighbour)
    pad = np.concatenate([stack[:1], stack, stack[-1:]])
    smooth = (pad[:-2].astype(int) + pad[1:-1] + pad[2:]) >= 2
    # first / last year of the water, robust to a few false years: water counts from the first year with water in at least 3 of the next 5 years,
    # up to the last year with water in at least 3 of the previous 5 (a lone false "dry" year on a pixel must not move the shoreline)
    n = len(years)
    csum = np.concatenate([np.zeros((1, h, w), int), np.cumsum(smooth.astype(int), axis=0)])
    first = np.full((h, w), 255, "uint8")
    last = np.full((h, w), 255, "uint8")
    for i in range(n):
        ahead = csum[min(n, i + 5)] - csum[i]
        behind = csum[i + 1] - csum[max(0, i - 4)]
        need = 3
        f_ok = (ahead >= min(need, min(n, i + 5) - i)) & (first == 255)
        first[f_ok] = i
        last[behind >= min(need, i + 1 - max(0, i - 4))] = i
    # WorldCover 2020-2021 is the reference for the recent state: its water is water at the end (the index fails along the edges of some scenes)
    land = np.frombuffer(base64.b64decode(d["land"]), dtype=np.uint8).reshape(h, w)
    wc = land == 1
    miss = wc & (first == 255)   # sea that the index never detects (glint, brine): it takes the history of the nearest pixel where water was detected
    if miss.any() and (first != 255).any():
        idx = distance_transform_edt(first == 255, return_distances=False, return_indices=True)
        first[miss] = first[idx[0][miss], idx[1][miss]]
    first[wc & (first == 255)] = len(years) - 1
    # stripes of pixels whose water is detected later than their neighbours' (Landsat gaps, glint): a spatial median over 7 x 7 cells (140 m) removes them,
    # the shoreline keeps its 140 m precision
    seen = first != 255
    if seen.any():
        filled = np.where(seen, first, len(years)).astype("uint8")
        med = median_filter(filled, size=7)
        first = np.where(seen & (med < len(years)), np.minimum(first, med), first).astype("uint8")
    last[wc] = len(years) - 1
    always = (first == 0) & (last == len(years) - 1)
    changing = (first != 255) & ~always
    print("water cells: %d at the start, %d at the end; %d cells change" % (smooth[0].sum(), smooth[-1].sum(), changing.sum()))
    for i in range(0, len(years), 5):
        print("  %d: %d cells of water" % (years[i], smooth[i].sum()))
    if changing.sum() < MIN_CHANGE:
        sys.exit("No water change worth drawing for this city: no water.json written.")
    out = {"years": years, "w": w, "h": h, "first": base64.b64encode(first.tobytes()).decode(), "last": base64.b64encode(last.tobytes()).decode()}
    path = os.path.join(folder, "water.json")
    json.dump(out, open(path, "w"), separators=(",", ":"))
    print("Output file:", path)


if __name__ == "__main__":
    main()
