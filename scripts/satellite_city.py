#!/usr/bin/env python3
"""
satellite_city.py : everything in one command.

    python satellite_city.py                        # all of Ra'anana
    python satellite_city.py --city "Herzliya, Israel"
    python satellite_city.py --selftest             # synthetic data test, no network needed

What the script does on its own:
  1. installs missing libraries
  2. finds the city (outline and extent) through OpenStreetMap
  3. downloads Landsat (1984-2018 plus 2020-2021 for training, 30 m) and Sentinel-2 (2017-2026, 10 m), one composite per year
     (2017-2021 have both sensors and are averaged, years before 2017 use Landsat alone),
     using only the best 2 scenes per tile and per year (--scenes to change)
  4. downloads the ESA WorldCover map (2020, 2021) to train the built-up model automatically
  5. computes, for every 20 m cell, the year it became built-up
  6. fetches main roads and playgrounds from OpenStreetMap
  7. writes city_<name>/city_<name>.json (the only file needed by the viewer) and report.txt

Everything resumes where it stopped if you run the same command again.
Note: yearly results are cached in city_<name>/raw. Delete that folder to recompute with other settings.
"""
import argparse
import base64
import csv
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
import warnings
from concurrent.futures import ThreadPoolExecutor

REQS = [("numpy", "numpy"), ("scipy", "scipy"), ("sklearn", "scikit-learn"), ("PIL", "pillow"),
        ("requests", "requests"), ("rasterio", "rasterio"), ("pystac_client", "pystac-client"),
        ("planetary_computer", "planetary-computer")]


def ensure_libs():
    import importlib
    for mod, pipname in REQS:
        try:
            importlib.import_module(mod)
        except ImportError:
            print("Installing %s ..." % pipname, flush=True)
            cmd = [sys.executable, "-m", "pip", "install", "-q", pipname]
            if subprocess.call(cmd) != 0:
                subprocess.call(cmd + ["--break-system-packages"])


ensure_libs()

import numpy as np  # noqa: E402
import requests  # noqa: E402
from PIL import Image  # noqa: E402
from scipy.ndimage import binary_erosion, gaussian_filter, median_filter, uniform_filter  # noqa: E402
from sklearn.ensemble import RandomForestClassifier  # noqa: E402

UA = {"User-Agent": "satellite-city/1.0 (personal project)"}
PC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
S2_ASSETS = {"blue": "B02", "green": "B03", "red": "B04", "nir": "B08", "swir": "B11"}
LS_ASSETS = {"blue": "blue", "green": "green", "red": "red", "nir": "nir08", "swir": "swir16"}
NAMES = ("blue", "green", "red", "nir", "swir")
OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter",
            "https://overpass.private.coffee/api/interpreter"]


# ---------------------------------------------------------------- utilities
def parse_years(s):
    if "-" in s and "," not in s:
        a, b = s.split("-")
        return list(range(int(a), int(b) + 1))
    return [int(x) for x in s.split(",")]


def data_root():
    """Folder where city_<name> folders live: the folder you run from, or the parent of this repo
    when you run from inside the repo."""
    cwd = os.path.realpath(os.getcwd())
    repo = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
    return os.path.dirname(repo) if cwd == repo or cwd.startswith(repo + os.sep) else cwd


def slug(s):
    """URL-safe name: accents dropped, apostrophes removed (Ra'anana -> raanana), other separators become one hyphen."""
    s = unicodedata.normalize("NFKD", s.split(",")[0]).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[\'\u2019`]", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "city"


def log(msg, rep):
    print(msg, flush=True)
    rep.append(msg)


# ---------------------------------------------------------------- city
def nominatim(q):
    r = requests.get("https://nominatim.openstreetmap.org/search",
                     params={"q": q, "format": "json", "limit": 1, "polygon_geojson": 1},
                     headers=UA, timeout=30)
    r.raise_for_status()
    js = r.json()
    return js[0] if js else None


def resolve_city(a, rep):
    name, geom, bbox = a.city, None, None
    try:
        res = nominatim(a.city)
    except Exception as e:
        res = None
        log("Geocoding failed (%s). Using the default area around Ra'anana." % e, rep)
    if res:
        s, n, w, e = [float(x) for x in res["boundingbox"]]
        bbox = [w, s, e, n]
        name = res.get("display_name", a.city)
        g = res.get("geojson")
        if g and g.get("type") in ("Polygon", "MultiPolygon"):
            geom = g
    if bbox is None:
        lat, lon = 32.185, 34.870
        dlat, dlon = 3.0 / 111.32, 2.5 / (111.32 * np.cos(np.radians(lat)))
        bbox = [lon - dlon, lat - dlat, lon + dlon, lat + dlat]
    if a.center:
        lat, lon = [float(x) for x in a.center.split(",")]
        dlat, dlon = a.radius / 111.32, a.radius / (111.32 * np.cos(np.radians(lat)))
        bbox = [lon - dlon, lat - dlat, lon + dlon, lat + dlat]
        geom = None
    pad_lat, pad_lon = 0.2 / 111.32, 0.2 / (111.32 * np.cos(np.radians((bbox[1] + bbox[3]) / 2)))
    bbox = [bbox[0] - pad_lon, bbox[1] - pad_lat, bbox[2] + pad_lon, bbox[3] + pad_lat]
    wkm = (bbox[2] - bbox[0]) * 111.32 * np.cos(np.radians((bbox[1] + bbox[3]) / 2))
    hkm = (bbox[3] - bbox[1]) * 111.32
    if max(wkm, hkm) > 45:
        sys.exit("Area too large (%.0f x %.0f km). Pick a smaller city." % (wkm, hkm))
    log("City: %s" % name, rep)
    log("Area: %.1f x %.1f km, city outline: %s" % (wkm, hkm, "yes" if geom else "no (rectangular area)"), rep)
    return name, bbox, geom


def make_grid(bbox, lon, res, align=30.0):
    from rasterio.transform import from_origin
    from rasterio.warp import transform_bounds
    zone = int((lon + 180) // 6) + 1
    crs = "EPSG:%d" % (32600 + zone)
    l, b, r, t = transform_bounds("EPSG:4326", crs, *bbox)
    l, b = np.floor(l / align) * align, np.floor(b / align) * align
    r, t = np.ceil(r / align) * align, np.ceil(t / align) * align
    return {"crs": crs, "transform": from_origin(l, t, res, res), "res": res,
            "width": int(round((r - l) / res)), "height": int(round((t - b) / res)),
            "bounds": [float(l), float(b), float(r), float(t)]}


# ---------------------------------------------------------------- download
def read_band(href, grid, resampling):
    import rasterio
    from rasterio.vrt import WarpedVRT
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", VSI_CACHE="TRUE",
                      CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif,.TIF"):
        with rasterio.open(href) as src:
            with WarpedVRT(src, crs=grid["crs"], transform=grid["transform"], width=grid["width"],
                           height=grid["height"], resampling=resampling) as vrt:
                return vrt.read(1)


def s2_scale(item, key):
    rb = item.assets[key].extra_fields.get("raster:bands")
    if rb and "scale" in rb[0]:
        return float(rb[0]["scale"]), float(rb[0].get("offset", 0.0))
    try:
        off = -0.1 if float(item.properties.get("s2:processing_baseline")) >= 4.0 else 0.0
    except (TypeError, ValueError):
        off = 0.0
    return 0.0001, off


def item_s2(item, grid):
    from rasterio.enums import Resampling
    scl = read_band(item.assets["SCL"].href, grid, Resampling.nearest)
    valid = np.isin(scl, [4, 5, 6, 7])
    out = {}
    for n in NAMES:
        key = S2_ASSETS[n]
        dn = read_band(item.assets[key].href, grid,
                       Resampling.bilinear if n == "swir" else Resampling.nearest).astype("float32")
        sc, off = s2_scale(item, key)
        refl = dn * sc + off
        refl[dn == 0] = np.nan
        out[n] = refl
    return mask_out(out, valid)


def item_ls(item, grid):
    from rasterio.enums import Resampling
    qa = read_band(item.assets["qa_pixel"].href, grid, Resampling.nearest)
    valid = (qa.astype("uint16") & 0b11111) == 0
    out = {}
    for n in NAMES:
        dn = read_band(item.assets[LS_ASSETS[n]].href, grid, Resampling.bilinear)
        refl = dn.astype("float32") * 0.0000275 - 0.2
        refl[dn == 0] = np.nan
        out[n] = refl
    return mask_out(out, valid)


def mask_out(out, valid):
    ok = valid & np.all([np.isfinite(out[n]) for n in NAMES], axis=0)
    return {n: np.where(ok, out[n], np.nan) for n in NAMES}


def pick(items, per_group):
    """Best scenes (least cloud) for each tile, so the whole city is covered."""
    groups = {}
    for it in sorted(items, key=lambda i: i.properties.get("eo:cloud_cover", 100)):
        p = it.properties
        g = p.get("s2:mgrs_tile") or "%s-%s" % (p.get("landsat:wrs_path"), p.get("landsat:wrs_row"))
        groups.setdefault(g, []).append(it)
    out = []
    for lst in groups.values():
        out += lst[:per_group]
    return out


def composite(stack):
    arr = np.stack(stack, 0)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", category=RuntimeWarning)
        med = np.nanmedian(arr, axis=0)
    return med.astype("float32"), np.isfinite(arr).sum(0).astype("uint8")


def get_year(cat, kind, year, bbox, grid, season, per_group, cloud, raw_dir, rep):
    fp = os.path.join(raw_dir, "%s_%d.npz" % (kind, year))
    if os.path.exists(fp):
        z = np.load(fp)
        return {k: z[k] for k in NAMES}, float((z["n_valid"] > 0).mean()), int(z["scenes"])
    a, b = season.split(":")
    coll = "sentinel-2-l2a" if kind == "s2" else "landsat-c2-l2"
    q = {"eo:cloud_cover": {"lt": cloud}}
    if kind == "ls":
        q["landsat:collection_category"] = {"eq": "T1"}
    try:
        items = pick(list(cat.search(collections=[coll], bbox=bbox,
                                     datetime="%d-%s/%d-%s" % (year, a, year, b), query=q).items()), per_group)
    except Exception as e:
        log("  %s %d: search failed (%s)" % (kind, year, e), rep)
        return None, 0.0, 0
    if not items:
        log("  %s %d: no image" % (kind, year), rep)
        return None, 0.0, 0
    fn = item_s2 if kind == "s2" else item_ls
    try:
        with ThreadPoolExecutor(max_workers=3) as ex:
            res = list(ex.map(lambda it: fn(it, grid), items))
    except Exception as e:
        log("  %s %d: download failed (%s)" % (kind, year, e), rep)
        return None, 0.0, 0
    comp, n = {}, None
    for k in NAMES:
        comp[k], nn = composite([r[k] for r in res])
        n = nn if k == "red" else n
    np.savez_compressed(fp, n_valid=n, scenes=len(items), **comp)
    return comp, float((n > 0).mean()), len(items)


def fetch_years(cat, kind, years, bbox, grid, season, scenes, cloud, raw, rep, workers, t0):
    """Download the years of one sensor in parallel (the time is spent waiting for the network, not computing).
    Returns [(year, composite or None, coverage, n_scenes)] in the order of `years`."""
    def one(y):
        c, cv, n = get_year(cat, kind, y, bbox, grid, season, scenes, cloud, raw, rep)
        log("  %d: %d scenes, coverage %.0f %%  (%.0f min elapsed)" % (y, n, cv * 100, (time.time() - t0) / 60), rep)
        return y, c, cv, n
    with ThreadPoolExecutor(max_workers=max(1, workers)) as ex:
        return list(ex.map(one, years))


def get_wc(cat, year, bbox, grid, raw_dir):
    from rasterio.enums import Resampling
    fp = os.path.join(raw_dir, "wc_%d.npy" % year)
    if os.path.exists(fp):
        return np.load(fp)
    items = list(cat.search(collections=["esa-worldcover"], bbox=bbox,
                            datetime="%d-01-01/%d-12-31" % (year, year)).items())
    arr = np.zeros((grid["height"], grid["width"]), "uint8")
    for it in items:
        a = read_band(it.assets["map"].href, grid, Resampling.nearest).astype("uint8")
        arr = np.where(arr == 0, a, arr)
    np.save(fp, arr)
    return arr


# ---------------------------------------------------------------- analysis (testable without network)
def feats(c):
    b, g, r, n, s = [np.nan_to_num(c[k], nan=float(np.nanmedian(c[k])) if np.isfinite(c[k]).any() else 0.1)
                     for k in NAMES]
    ndvi = (n - r) / (n + r + 1e-6)
    br = (r + g + b) / 3
    brr = b / (r + 1e-6)
    swn = s / (n + 1e-6)
    m3 = uniform_filter(br, 3)
    sd3 = np.sqrt(np.maximum(uniform_filter(br * br, 3) - m3 * m3, 0))
    m5 = uniform_filter(br, 5)
    sd5 = np.sqrt(np.maximum(uniform_filter(br * br, 5) - m5 * m5, 0))
    return np.stack([ndvi, br, brr, swn, sd3, sd5, uniform_filter(brr, 5), uniform_filter(ndvi, 5),
                     uniform_filter(swn, 5), m5, s], -1)


def wc_labels(wc):
    st = np.ones((3, 3), bool)
    pos = binary_erosion(wc == 50, st)
    neg = binary_erosion(np.isin(wc, [10, 20, 30, 40, 60]), st)
    lab = np.full(wc.shape, -1, "int8")
    lab[neg] = 0
    lab[pos] = 1
    return lab


def down_labels(lab, k=3):
    H, W = lab.shape
    H, W = H // k * k, W // k * k
    pos = (lab[:H, :W] == 1).reshape(H // k, k, W // k, k).mean((1, 3))
    neg = (lab[:H, :W] == 0).reshape(H // k, k, W // k, k).mean((1, 3))
    out = np.full(pos.shape, -1, "int8")
    out[neg >= 0.9] = 0
    out[pos >= 0.67] = 1
    return out


def train_rf(pairs, name, rep):
    X, y = [], []
    for F, lab in pairs:
        m = lab >= 0
        X.append(F[m])
        y.append(lab[m])
    X, y = np.concatenate(X), np.concatenate(y)
    if len(np.unique(y)) < 2:
        raise RuntimeError("not enough built / non-built examples")
    rng = np.random.RandomState(0)
    idx = np.concatenate([rng.permutation(np.where(y == c)[0])[:40000] for c in (0, 1)])
    rng.shuffle(idx)
    cut = int(len(idx) * 0.75)
    tr, te = idx[:cut], idx[cut:]
    rf = RandomForestClassifier(n_estimators=150, min_samples_leaf=10, class_weight="balanced",
                                n_jobs=-1, random_state=0).fit(X[tr], y[tr])
    log("  model %s: accuracy on held-out examples %.1f %% (%d built, %d non-built examples)"
        % (name, 100 * rf.score(X[te], y[te]), (y == 1).sum(), (y == 0).sum()), rep)
    return rf


def predict_p(rf, c):
    F = feats(c)
    H, W = F.shape[:2]
    p = rf.predict_proba(F.reshape(-1, F.shape[-1]))[:, 1].reshape(H, W)
    return median_filter(p, 3).astype("float32")


def up3(p):
    return gaussian_filter(np.repeat(np.repeat(p, 3, 0), 3, 1), 1.2).astype("float32")


def stepfit(P):
    """Change year: single-step model (not built, then built) fitted for every pixel."""
    Y = P.shape[0]
    err = ((1 - P) ** 2).sum(0)
    best = err.copy()
    k = np.zeros(P.shape[1:], "int16")
    for i in range(Y):
        err = err + P[i] ** 2 - (1 - P[i]) ** 2
        up = err < best
        best = np.where(up, err, best)
        k = np.where(up, i + 1, k)
    return median_filter(k, 5)


def land_cells(w, B=2):
    """Static land type per 20 m cell from WorldCover: 0 vegetation/other, 1 water, 2 bare ground or sand, 3 cropland (fields)."""
    H, W = w.shape[0] // B * B, w.shape[1] // B * B
    w = w[:H, :W]
    def share(mask):
        return mask.reshape(H // B, B, W // B, B).sum((1, 3))
    out = np.zeros((H // B, W // B), "uint8")
    out[share(w == 40) >= 3] = 3
    out[share(np.isin(w, (60, 70))) >= 3] = 2
    out[share(w == 80) >= 3] = 1
    return out


def mask_water(first, land):
    """Water is never built: the model takes dark water (canals, lagoons, sea) for built-up land. 255 = never built."""
    return np.where(land[:first.shape[0], :first.shape[1]] == 1, 255, first).astype("uint8")


def mask_forest(first, wc, B=2):
    """Option --mask-forest, for cities beside mountains or forests (Sapporo): the model takes dark forest for built-up land.
    A cell that WorldCover (every available year) shows as tree cover in at least 3 of its 4 pixels is never built. 255 = never built."""
    H, W = first.shape
    tree = np.ones((H, W), bool)
    for w in wc.values():
        h, ww = H * B, W * B
        t = np.zeros((h, ww), bool)
        sub = (w == 10)[:h, :ww]
        t[:sub.shape[0], :sub.shape[1]] = sub
        tree &= t.reshape(H, B, W, B).sum((1, 3)) >= 3
    return np.where(tree, 255, first).astype("uint8")


def to_cells(k, Y, B=2, need=3):
    """k = number of years before construction (Y = never). Returns the index of the first built year."""
    H, W = k.shape
    H, W = H // B * B, W // B * B
    k = k[:H, :W]
    first = np.full((H // B, W // B), 255, "uint8")
    nev = k >= Y
    for i in range(Y - 1, -1, -1):
        cnt = ((k <= i) & ~nev).reshape(H // B, B, W // B, B).sum((1, 3))
        first = np.where(cnt >= need, i, first).astype("uint8")
    return first


def analyze(s2, ls, wc, years_s2, years_ls, rep):
    """s2/ls: {year: composite}. wc: {year: WorldCover map at 10 m}. Returns (years, first, landsat_years)."""
    pairs10 = [(feats(s2[y]), wc_labels(wc[y])) for y in sorted(wc) if y in s2]
    if not pairs10:
        raise RuntimeError("Sentinel-2 2020 or 2021 is missing, cannot train the model.")
    rf10 = train_rf(pairs10, "Sentinel-2", rep)
    P = {y: predict_p(rf10, c) for y, c in s2.items()}
    pairs30 = [(feats(ls[y]), down_labels(wc_labels(wc[y]))) for y in sorted(wc) if y in ls]
    ls_years = []
    if pairs30:
        try:
            rf30 = train_rf(pairs30, "Landsat", rep)
            for y, c in ls.items():
                p30 = up3(predict_p(rf30, c))
                if y in P:
                    P[y] = 0.5 * (P[y] + p30)  # both sensors: average the probabilities
                else:
                    P[y] = p30
                    ls_years.append(y)  # Landsat only (coarser 30 m)
        except RuntimeError as e:
            log("  Landsat skipped: %s" % e, rep)
    else:
        log("  Landsat skipped: Landsat 2020 or 2021 is missing, cannot train the model.", rep)
    years = sorted(P)
    Pst = np.stack([P[y] for y in years])
    for y in years:
        log("  %d  built %.1f %%  (%s)" % (y, 100 * float((P[y] > 0.5).mean()), "Landsat 30 m" if y in ls_years else "Sentinel-2 10 m"), rep)
    k = stepfit(Pst)
    return years, to_cells(k, len(years)), ls_years


# ---------------------------------------------------------------- OpenStreetMap
def overpass(q, rep, tries=3, timeout=60):
    last = ""
    for url in OVERPASS * tries:
        try:
            r = requests.post(url, data={"data": q}, headers=UA, timeout=timeout)
            if r.status_code == 200:
                return r.json()
            last = "%s -> HTTP %d" % (url.split("/")[2], r.status_code)
        except Exception as e:
            last = "%s -> %s" % (url.split("/")[2], type(e).__name__)
        time.sleep(4)
    log("    last error: %s" % last, rep)
    return None


def get_osm(bbox, rep):
    bb = "(%f,%f,%f,%f)" % (bbox[1], bbox[0], bbox[3], bbox[2])
    out = {"arteries": [], "playgrounds": []}
    js = overpass('[out:json][timeout:60];way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"]%s;out geom tags;' % bb, rep)
    if js is None:
        log("  OpenStreetMap (roads): unavailable, run again later.", rep)
    else:
        LN = {"motorway": 3, "trunk": 3, "primary": 2, "secondary": 2, "tertiary": 1.5}
        for e in js["elements"]:
            t = e.get("tags", {})
            pts = [[round(p["lat"], 5), round(p["lon"], 5)] for p in e.get("geometry", [])]
            if len(pts) < 2:
                continue
            try:
                w = float(t.get("width"))
            except (TypeError, ValueError):
                w = (int(t["lanes"]) if str(t.get("lanes", "")).isdigit() else LN.get(t.get("highway"), 2)) * 3.5
            nm = {k: t["name:" + k] for k in ("he", "en", "fr") if t.get("name:" + k)}
            if t.get("name"):
                nm["d"] = t["name"]
            out["arteries"].append({"c": 1 if t.get("highway") in ("motorway", "trunk", "primary") else 0,
                                    "w": round(w), "pts": pts, "nm": nm})
        log("  main road segments: %d" % len(out["arteries"]), rep)
    js = overpass('[out:json][timeout:25];(node["leisure"="playground"]%s;way["leisure"="playground"]%s;rel["leisure"="playground"]%s;);out center tags;' % (bb, bb, bb), rep)
    if js is None:
        log("  OpenStreetMap (playgrounds): unavailable, run again later.", rep)
    else:
        for e in js["elements"]:
            la = e.get("lat", (e.get("center") or {}).get("lat"))
            lo = e.get("lon", (e.get("center") or {}).get("lon"))
            if la is not None and not e.get("tags", {}).get("highway"):
                out["playgrounds"].append([round(la, 5), round(lo, 5)])
        log("  playgrounds found in OpenStreetMap: %d" % len(out["playgrounds"]), rep)
    return out


def inside_mask(geom, grid, CH, CW):
    if not geom:
        return np.ones((CH, CW), "uint8")
    from rasterio.features import rasterize
    from rasterio.transform import from_origin
    from rasterio.warp import transform_geom
    g = transform_geom("EPSG:4326", grid["crs"], geom)
    l, b, r, t = grid["bounds"]
    return rasterize([(g, 1)], out_shape=(CH, CW), transform=from_origin(l, t, 20.0, 20.0),
                     fill=0, all_touched=True, dtype="uint8")


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--city", default="Ra'anana, Israel")
    ap.add_argument("--center", default=None, help="LAT,LON of the city centre; use for big cities or regions (replaces the geocoded area)")
    ap.add_argument("--radius", type=float, default=6.0, help="half-size in km around --center")
    ap.add_argument("--years-s2", default="2017-2026")
    ap.add_argument("--years-ls", default="1984-2018", help="2020 and 2021 are always added to train the Landsat model")
    ap.add_argument("--season-s2", default="02-15:04-15")
    ap.add_argument("--season-ls", default="02-01:05-15")
    ap.add_argument("--scenes", type=int, default=2, help="max scenes per tile and per year (best ones, least cloud)")
    ap.add_argument("--cloud", type=float, default=60)
    ap.add_argument("--no-landsat", action="store_true")
    ap.add_argument("--mask-forest", action="store_true", help="never mark as built the cells that WorldCover shows as tree cover (mountains, forests; the model takes them for built-up land)")
    ap.add_argument("--workers", type=int, default=4, help="years downloaded at the same time (network bound); 1 = one after the other")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        return selftest()

    rep = []
    t0 = time.time()
    name, bbox, geom = resolve_city(a, rep)
    lon0 = (bbox[0] + bbox[2]) / 2
    g10, g30 = make_grid(bbox, lon0, 10.0), make_grid(bbox, lon0, 30.0)
    log("Grid: %d x %d pixels at 10 m (%s)" % (g10["width"], g10["height"], g10["crs"]), rep)
    out_dir = os.path.join(data_root(), "city_" + slug(a.city))
    raw = os.path.join(out_dir, "raw")
    os.makedirs(raw, exist_ok=True)

    from pystac_client import Client
    import planetary_computer
    cat = Client.open(PC_URL, modifier=planetary_computer.sign_inplace)

    s2, ls, cov = {}, {}, []
    log("\n[1/4] Sentinel-2 (10 m)", rep)
    for y, c, cv, n in fetch_years(cat, "s2", parse_years(a.years_s2), bbox, g10, a.season_s2, a.scenes, a.cloud, raw, rep, a.workers, t0):
        if c is not None:
            s2[y] = c
        cov.append(("Sentinel-2", y, n, cv))
    if not s2:
        sys.exit("No Sentinel-2 image downloaded. Check the connection and run again.")
    if not a.no_landsat:
        log("\n[2/4] Landsat (30 m)", rep)
        for y, c, cv, n in fetch_years(cat, "ls", sorted(set(parse_years(a.years_ls)) | {2020, 2021}), bbox, g30, a.season_ls, a.scenes, a.cloud, raw, rep, a.workers, t0):
            if c is not None:
                ls[y] = c
            cov.append(("Landsat", y, n, cv))

    log("\n[3/4] Land cover and analysis", rep)
    wc = {}
    for y in (2020, 2021):
        try:
            wc[y] = get_wc(cat, y, bbox, g10, raw)
        except Exception as e:
            log("  WorldCover %d unavailable (%s)" % (y, e), rep)
    years, first, ls_years = analyze(s2, ls, wc, sorted(s2), sorted(ls), rep)

    CH, CW = first.shape
    land = (land_cells(wc[max(wc)]) if wc else np.zeros(first.shape, "uint8"))[:CH, :CW].astype("uint8")
    first = mask_water(first, land)
    if a.mask_forest and wc:
        first = mask_forest(first, wc)
    inside = inside_mask(geom, g10, CH, CW)
    stats = []
    for i, y in enumerate(years):
        built = ((first <= i) & (inside == 1)).sum() * 0.04
        stats.append({"year": y, "built_ha": round(float(built), 1), "sensor": "Landsat" if y in ls_years else "Sentinel-2"})
    total = float(((inside == 1).sum()) * 0.04)
    log("\nSummary: built %.0f ha in %d, %.0f ha in %d, out of %.0f ha of city" %
        (stats[0]["built_ha"], years[0], stats[-1]["built_ha"], years[-1], total), rep)

    log("\n[4/4] OpenStreetMap", rep)
    osm = get_osm(bbox, rep)

    fn = os.path.join(out_dir, "city_%s.json" % slug(a.city))
    json.dump({"name": name, "slug": slug(a.city), "crs": g10["crs"], "bounds": g10["bounds"], "bbox": bbox,
               "cell_m": 20, "w": CW, "h": CH, "years": years, "ls_years": ls_years, "stats": stats,
               "first": base64.b64encode(first.tobytes()).decode(),
               "land": base64.b64encode(land.tobytes()).decode(),
               "inside": base64.b64encode(inside.tobytes()).decode(), "osm": osm,
               "note": "first: 255 = never built, i = index in years of the first built year; row by row, north at the top"},
              open(fn, "w"))
    with open(os.path.join(out_dir, "report.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(rep))
    with open(os.path.join(out_dir, "coverage.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["sensor", "year", "scenes", "coverage"])
        w.writerows([(s, y, n, "%.2f" % c) for s, y, n, c in cov])
    img = np.where(first == 255, 0, 40 + (first.astype(int) * 215 // max(1, len(years))))
    Image.fromarray(img.astype("uint8")).resize((CW * 2, CH * 2), Image.NEAREST).save(os.path.join(out_dir, "change_years.png"))
    print("\nDONE in %.0f minutes." % ((time.time() - t0) / 60))
    print("Output file:", fn)


# ---------------------------------------------------------------- offline test
def selftest():
    rng = np.random.RandomState(1)
    H = W = 90
    yy, xx = np.mgrid[:H, :W]
    A = (yy < 30)                                   # built since always
    B = (yy >= 30) & (yy < 60) & (xx < 45)          # built in 2005
    C = (yy >= 30) & (yy < 60) & (xx >= 45)         # built in 2020
    D = (yy >= 60)                                  # never built (fields)

    def built_at(y):
        return A | (B & (y >= 2005)) | (C & (y >= 2020))

    def comp(y, k):
        bt = built_at(y)
        n = rng.normal(0, 0.012, (H, W))
        base = {"blue": 0.10, "green": 0.12, "red": 0.14, "nir": 0.22, "swir": 0.20}
        bld = {"blue": 0.18, "green": 0.19, "red": 0.20, "nir": 0.22, "swir": 0.26}
        out = {}
        for b in NAMES:
            v = np.where(bt, bld[b], base[b]) + n
            if b == "nir":
                v = v + np.where(bt, 0, 0.12 * (0.6 + 0.4 * np.sin(y)))
            out[b] = np.nan_to_num(v).astype("float32")
        if k == 3:
            out = {b: v.reshape(H // 3, 3, W // 3, 3).mean((1, 3)) for b, v in out.items()}
        return out

    s2 = {y: comp(y, 1) for y in range(2017, 2027)}
    ls = {y: comp(y, 3) for y in range(1990, 2022)}
    wc = {}
    for y in (2020, 2021):
        w = np.full((H, W), 40, "uint8")
        w[built_at(y)] = 50
        wc[y] = w
    rep = []
    years, first, ls_years = analyze(s2, ls, wc, sorted(s2), sorted(ls), rep)
    Hc, Wc = first.shape
    yrs = np.array(years + [9999])
    fy = yrs[np.where(first == 255, len(years), first)]
    res = {"A": fy[:Hc // 3 - 2, :].ravel(), "B": fy[Hc // 3 + 2:2 * Hc // 3 - 2, 2:Wc // 2 - 3].ravel(),
           "C": fy[Hc // 3 + 2:2 * Hc // 3 - 2, Wc // 2 + 3:-2].ravel(), "D": fy[2 * Hc // 3 + 2:, :].ravel()}
    ok = True
    for k, exp in (("A", years[0]), ("B", 2005), ("C", 2020), ("D", 9999)):
        v = res[k]
        good = float((np.abs(v - exp) <= 1).mean()) if exp != 9999 else float((v == 9999).mean())
        print("zone %s: expected year %s, %.0f %% of cells correct" % (k, exp, 100 * good))
        ok = ok and good > 0.85
    print("SELFTEST", "OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
