#!/usr/bin/env python3
"""
surface_temperature.py : summer land surface temperature history (Landsat thermal band) for a city
that was already processed by satellite_city.py.

    python scripts/surface_temperature.py --city "Ra'anana, Israel"

Run it from inside adama/ (or from the folder that contains adama/ and the city_<name> folders).

What it does:
  1. reads city_<name>/city_<name>.json (grid, outline) written by satellite_city.py
  2. for every year, downloads the least cloudy Landsat summer scenes (June to September, ~10:00 local
     time, so every year is comparable) and keeps the thermal band (Collection 2 Level 2 surface temperature)
  3. composites them (median), fills small gaps, and stores for each 100 m block the difference
     to the city-wide median of that year (so weather differences between years cancel out)
  4. writes city_<name>/heat.json, and caches the yearly rasters in city_<name>/raw/lst_<year>.npy

Native thermal resolution is 100 m (Landsat 5/7: 120 m), so the map is smooth by nature.
Everything resumes where it stopped if you run the same command again.
"""
import argparse
import base64
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import satellite_city as sc  # noqa: E402  (also installs missing libraries)

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
from scipy.ndimage import distance_transform_edt  # noqa: E402

K_SCALE, K_OFFSET = 0.00341802, 149.0   # Landsat Collection 2 Level 2 surface temperature
STEP = 6                                # stored precision: 1/6 degree
BASE = 128                              # stored value for "same as the city median"


def read_lst(item, grid):
    """One scene, in kelvin, NaN where cloudy or invalid."""
    from rasterio.enums import Resampling
    key = "lwir11" if "lwir11" in item.assets else ("lwir" if "lwir" in item.assets else None)
    if key is None:
        raise RuntimeError("no thermal band")
    qa = sc.read_band(item.assets["qa_pixel"].href, grid, Resampling.nearest)
    dn = sc.read_band(item.assets[key].href, grid, Resampling.bilinear).astype("float32")
    kel = dn * K_SCALE + K_OFFSET
    ok = ((qa.astype("uint16") & 0b11111) == 0) & (dn > 0) & (kel > 250) & (kel < 360)
    return np.where(ok, kel, np.nan).astype("float32")


def fill_gaps(a):
    """Replace NaN by the nearest valid value (small holes: clouds, Landsat 7 stripes)."""
    bad = ~np.isfinite(a)
    if not bad.any():
        return a
    idx = distance_transform_edt(bad, return_distances=False, return_indices=True)
    return a[tuple(idx)]


def to_blocks(kel30, w, h, inside, block):
    """30 m kelvin raster -> (anomaly vs city median in blocks of `block` 20 m cells, uint8 grid, city median in C)."""
    img = Image.fromarray(kel30.astype("float32"), "F").resize((w, h), Image.BILINEAR)
    t = np.asarray(img, dtype="float32") - 273.15
    sel = inside == 1
    med = float(np.median(t[sel])) if sel.any() else float(np.median(t))
    an = t - med
    hb, wb = -(-h // block), -(-w // block)
    pad = np.pad(an, ((0, hb * block - h), (0, wb * block - w)), mode="edge")
    bl = pad.reshape(hb, block, wb, block).mean((1, 3))
    q = np.clip(np.round(bl * STEP) + BASE, 1, 255).astype("uint8")
    return q, med


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--city", default="Ra'anana, Israel")
    ap.add_argument("--years", default="1985-2026")
    ap.add_argument("--season", default="06-01:09-30")
    ap.add_argument("--scenes", type=int, default=3, help="max scenes per tile and per year")
    ap.add_argument("--cloud", type=float, default=30)
    ap.add_argument("--block", type=int, default=5, help="output block in 20 m cells (5 = 100 m)")
    a = ap.parse_args()

    name = sc.slug(a.city)
    out_dir = os.path.join(sc.data_root(), "city_" + name)
    src = os.path.join(out_dir, "city_%s.json" % name)
    if not os.path.exists(src):
        sys.exit("Run satellite_city.py first: %s not found (city folders are looked for in %s)" % (src, sc.data_root()))
    d = json.load(open(src, encoding="utf-8"))
    w, h, bbox = d["w"], d["h"], d["bbox"]
    inside = np.frombuffer(base64.b64decode(d["inside"]), "uint8").reshape(h, w)
    g30 = sc.make_grid(bbox, (bbox[0] + bbox[2]) / 2, 30.0)
    raw = os.path.join(out_dir, "raw")
    os.makedirs(raw, exist_ok=True)

    from pystac_client import Client
    import planetary_computer
    cat = Client.open(sc.PC_URL, modifier=planetary_computer.sign_inplace)
    s0, s1 = a.season.split(":")
    t0, rep = time.time(), []
    years, meds, grids = [], [], []
    for y in sc.parse_years(a.years):
        fp = os.path.join(raw, "lst_%d.npy" % y)
        kel = None
        if os.path.exists(fp):
            kel = np.load(fp)
            n = -1
        else:
            try:
                items = sc.pick(list(cat.search(collections=["landsat-c2-l2"], bbox=bbox,
                                                datetime="%d-%s/%d-%s" % (y, s0, y, s1),
                                                query={"eo:cloud_cover": {"lt": a.cloud},
                                                       "landsat:collection_category": {"eq": "T1"}}).items()), a.scenes)
            except Exception as e:
                sc.log("  %d: search failed (%s)" % (y, e), rep)
                items = []
            res = []
            for it in items:
                try:
                    res.append(read_lst(it, g30))
                except Exception as e:
                    sc.log("  %d: scene skipped (%s)" % (y, e), rep)
            n = len(res)
            if res:
                import warnings
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore", category=RuntimeWarning)
                    comp = np.nanmedian(np.stack(res, 0), axis=0)
                if np.isfinite(comp).mean() >= 0.5:
                    kel = fill_gaps(comp).astype("float32")
                    np.save(fp, kel)
        if kel is None:
            sc.log("  %d: no usable thermal image (skipped)" % y, rep)
            years.append(y), meds.append(None), grids.append(None)
            continue
        q, med = to_blocks(kel, w, h, inside, a.block)
        years.append(y), meds.append(round(med, 1)), grids.append(q)
        sc.log("  %d: %s scenes, city median %.1f C  (%.0f min elapsed)" %
               (y, "cached" if n < 0 else n, med, (time.time() - t0) / 60), rep)

    ok = [g for g in grids if g is not None]
    if not ok:
        sys.exit("No thermal image downloaded. Check the connection and run again.")
    hb, wb = ok[0].shape
    out = {"years": years, "block": a.block, "w": wb, "h": hb, "step": STEP, "base": BASE, "med": meds,
           "data": [None if g is None else base64.b64encode(g.tobytes()).decode() for g in grids],
           "note": "value = round(anomaly_C * step) + base, anomaly = block mean minus city median of that year"}
    fn = os.path.join(out_dir, "heat.json")
    json.dump(out, open(fn, "w"))
    open(os.path.join(out_dir, "report_heat.txt"), "w", encoding="utf-8").write("\n".join(rep))
    print("\nDONE in %.0f minutes." % ((time.time() - t0) / 60))
    print("Output file:", fn)


def selftest():
    """Synthetic check of the processing, no network."""
    w, h = 100, 80
    kel = np.full((int(h * 2 / 3), int(w * 2 / 3)), 310.0, "float32")
    kel[:20, :20] = 320.0
    kel[30:, 40:] = np.nan
    kel = fill_gaps(kel)
    inside = np.ones((h, w), "uint8")
    q, med = to_blocks(kel, w, h, inside, 5)
    assert q.shape == (16, 20), q.shape
    assert q[0, 0] > q[-1, -1] and 120 < q[-1, -1] < 136, (q[0, 0], q[-1, -1])
    print("selftest ok, city median %.1f C" % med)


if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "--selftest":
    selftest()
elif __name__ == "__main__":
    main()
