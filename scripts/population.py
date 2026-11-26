#!/usr/bin/env python3
"""
population.py : inhabitants of a city by 100 m block, 1985 to 2020 (8 epochs), from GHSL GHS-POP R2023A (JRC, European Commission).

    python adama/scripts/population.py --city "Ra'anana, Israel"        # run from satellite/, after satellite_city.py

Writes city_<name>/pop.json, read by the viewer: the hover tooltip shows the inhabitants within 400 m and their change since 1985,
and the district pills show the trend. GHSL is a model (census spread over the built-up area seen by Landsat), not a count:
the figures are rounded and called "about" in the viewer.
Each tile is a 72 MB zip (the zip cannot be read by pieces): it is downloaded once, the tif is kept in raw_ghsl/ next to the
city folders and reused by the cities of the same tile (10 x 10 degrees). The population is spread as a density, so the total is kept.
"""
import argparse
import base64
import json
import math
import os
import sys
import zipfile

import numpy as np
import requests
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.warp import reproject, transform_bounds
from rasterio.windows import from_bounds

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import satellite_city as sc  # noqa: E402

EPOCHS = [1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020]
BLOCK = 100   # metres
URL = ("https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/GHS_POP_GLOBE_R2023A/GHS_POP_E%(y)d_GLOBE_R2023A_4326_3ss/V1-0/tiles/"
       "GHS_POP_E%(y)d_GLOBE_R2023A_4326_3ss_V1_0_R%(r)d_C%(c)d.zip")


def tile_of(lat, lon):
    """Row and column (1-based) of the 10 degree tile that holds the point: rows count down from 90 N, columns up from 180 W."""
    return int((90 - lat) // 10) + 1, int((lon + 180) // 10) + 1


def fetch(y, r, c, folder):
    """Path of the tif of this epoch and tile, downloaded when missing."""
    name = "GHS_POP_E%d_R%d_C%d.tif" % (y, r, c)
    path = os.path.join(folder, name)
    if os.path.exists(path):
        return path
    os.makedirs(folder, exist_ok=True)
    zp = path + ".zip"
    print("download", y, "tile R%d_C%d" % (r, c), flush=True)
    with requests.get(URL % dict(y=y, r=r, c=c), headers=sc.UA, stream=True, timeout=120) as resp:
        resp.raise_for_status()
        with open(zp, "wb") as f:
            for chunk in resp.iter_content(1 << 20):
                f.write(chunk)
    with zipfile.ZipFile(zp) as z:
        inner = [n for n in z.namelist() if n.endswith(".tif")][0]
        with z.open(inner) as src, open(path, "wb") as dst:
            while True:
                b = src.read(1 << 20)
                if not b:
                    break
                dst.write(b)
    os.remove(zp)
    return path


def blocks(y, tiles, folder, crs, dst_tf, shape, bbox):
    """People per 100 m block for one epoch: the density (people per m2) of each tile is averaged into the block grid."""
    out = np.zeros(shape, "float64")
    for r, c in tiles:
        with rasterio.open(fetch(y, r, c, folder)) as s:
            pad = 0.02
            win = from_bounds(bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad, s.transform).round_offsets().round_lengths()
            a = s.read(1, window=win, boundless=True, fill_value=0).astype("float64")
            a[(a < 0) | ~np.isfinite(a)] = 0   # -200 marks "no data"
            tf = s.window_transform(win)
            lat = tf.f + tf.e * (np.arange(a.shape[0]) + .5)
            area = (abs(tf.a) * 111320 * np.cos(np.radians(lat)))[:, None] * (abs(tf.e) * 110574)   # m2 of each pixel row
            dens = a / area
            acc = np.zeros(shape, "float64")
            reproject(dens, acc, src_transform=tf, src_crs="EPSG:4326", dst_transform=dst_tf, dst_crs=crs, resampling=Resampling.average)
            # pixels of the window that fall in another tile are 0 here (boundless fill): add, never overwrite
            out += acc
    return out * BLOCK * BLOCK


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--city", default="Ra'anana, Israel")
    ap.add_argument("--slug", help="city folder name (city_<slug>) when the name is not in latin letters")
    a = ap.parse_args()
    name = a.slug or sc.slug(a.city)
    out_dir = os.path.join(sc.data_root(), "city_" + name)
    src = os.path.join(out_dir, "city_%s.json" % name)
    if not os.path.exists(src):
        sys.exit("Run satellite_city.py first: %s not found" % src)
    d = json.load(open(src, encoding="utf-8"))
    E0, N0, E1, N1 = d["bounds"]
    cell = d["cell_m"]
    if BLOCK % cell:
        sys.exit("cell_m %d does not divide %d" % (cell, BLOCK))
    bs = BLOCK // cell
    bw, bh = math.ceil(d["w"] / bs), math.ceil(d["h"] / bs)
    dst_tf = from_origin(E0, N1, BLOCK, BLOCK)
    bbox = d["bbox"]
    tiles = sorted({tile_of(la, lo) for la in (bbox[1], bbox[3]) for lo in (bbox[0], bbox[2])})
    folder = os.path.join(sc.data_root(), "raw_ghsl")
    data, tot = [], []
    for y in EPOCHS:
        m = blocks(y, tiles, folder, d["crs"], dst_tf, (bh, bw), bbox)
        tot.append(int(m.sum()))
        data.append(base64.b64encode(np.clip(np.rint(m), 0, 65535).astype("<u2").tobytes()).decode())
        print(y, "inhabitants in the box:", tot[-1], flush=True)
    out = {"source": "GHSL GHS-POP R2023A, JRC", "years": EPOCHS, "bs": bs, "w": bw, "h": bh, "d": data}
    path = os.path.join(out_dir, "pop.json")
    json.dump(out, open(path, "w"), separators=(",", ":"))
    print("%s: %d -> %d inhabitants (%+d %%)" % (name, tot[0], tot[-1], round((tot[-1] / max(1, tot[0]) - 1) * 100)))
    print("Output file:", path)


if __name__ == "__main__":
    main()
