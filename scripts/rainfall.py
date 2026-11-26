#!/usr/bin/env python3
"""
rainfall.py : yearly rainfall of a city since 1981, from CHIRPS (Climate Hazards Center, UC Santa Barbara).

    python scripts/rainfall.py --city "Ra'anana, Israel"

Writes city_<name>/rain.json, which the viewer draws as a small curve (yearly total + moving average), like the air quality card
but without a layer on the map. Run satellite_city.py first (the city box is read from its JSON file).

CHIRPS v3.0 blends satellite infrared with rain gauges, 0.05 degree (about 5 km) grid, 1981 to now, 60 N to 60 S only
(Yakutsk, further north, has no data). The yearly total is the mean over the pixels of the city box, in mm. It is a regional
estimate, not a gauge in the city: close cities share the same pixels. Only complete years are kept (the current year is not).
The files are read through HTTP range requests (only the few pixels of the city are downloaded, not the 40 MB world file).
"""
import argparse
import datetime
import json
import os
import sys
import time

import numpy as np

os.environ.setdefault("GDAL_HTTP_USER_AGENT", "Mozilla/5.0 (adama rainfall)")   # the CHC server refuses the default GDAL agent
os.environ.setdefault("GDAL_HTTP_MAX_RETRY", "3")
os.environ.setdefault("GDAL_HTTP_RETRY_DELAY", "2")
import rasterio  # noqa: E402
from rasterio.windows import from_bounds  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import satellite_city as sc  # noqa: E402

URL = "/vsicurl/https://data.chc.ucsb.edu/products/CHIRPS/v3.0/annual/global/tifs/chirps-v3.0.%d.tif"
FIRST = 1981
MAX_LAT = 59.9        # CHIRPS stops at 60 degrees
MIN_HALF = 0.05       # the window is at least 0.1 degree wide (two pixels), a small city still lands on real pixels


def year_total(y, box, tries=6):
    """Mean of the yearly total (mm) over the pixels of the box, or None when the server keeps failing."""
    for k in range(tries):
        try:
            with rasterio.open(URL % y) as s:
                a = s.read(1, window=from_bounds(*box, s.transform), boundless=True, fill_value=-9999).astype("float64")
            a = a[a >= 0]
            return float(a.mean()) if a.size else None
        except Exception:
            time.sleep(2 + 3 * k)   # the server answers with errors now and then: wait and ask again
    return None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--city", default="Ra'anana, Israel")
    ap.add_argument("--slug", help="city folder name (city_<slug>), instead of deriving it from --city: for cities whose name is not in latin letters")
    a = ap.parse_args()
    name = a.slug or sc.slug(a.city)
    out_dir = os.path.join(sc.data_root(), "city_" + name)
    src = os.path.join(out_dir, "city_%s.json" % name)
    if not os.path.exists(src):
        sys.exit("Run satellite_city.py first: %s not found" % src)
    bb = json.load(open(src, encoding="utf-8"))["bbox"]   # lon_min, lat_min, lon_max, lat_max
    lat, lon = (bb[1] + bb[3]) / 2, (bb[0] + bb[2]) / 2
    if abs(lat) > MAX_LAT:
        sys.exit("%s is at %.1f degrees: CHIRPS only covers 60 N to 60 S, no rainfall card." % (a.slug or a.city, lat))
    hx, hy = max((bb[2] - bb[0]) / 2, MIN_HALF), max((bb[3] - bb[1]) / 2, MIN_HALF)
    box = (lon - hx, lat - hy, lon + hx, lat + hy)
    years, values, missing = [], [], []
    for y in range(FIRST, datetime.date.today().year):
        v = year_total(y, box)
        if v is None:
            missing.append(y)
            continue
        years.append(y)
        values.append(round(v))
        print(y, round(v), "mm", flush=True)
    if len(years) < 10:
        sys.exit("Only %d years read: the CHIRPS server did not answer, run it again later." % len(years))
    if missing:
        print("Years not read (the curve skips them): %s" % missing)
    out = {"source": "CHIRPS v3.0, Climate Hazards Center (UCSB)", "res_km": 5, "unit": "mm", "years": years, "values": values}
    path = os.path.join(out_dir, "rain.json")
    json.dump(out, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("%s: mean %d mm/year over %d years, driest %d (%d mm), wettest %d (%d mm)" % (
        a.slug or a.city, np.mean(values), len(years), years[int(np.argmin(values))], min(values), years[int(np.argmax(values))], max(values)))
    print("Output file:", path)


if __name__ == "__main__":
    main()
