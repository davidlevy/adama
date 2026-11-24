#!/usr/bin/env python3
"""
mask_water.py : remove water from the built-up area of an existing city file (no new satellite run).

    python scripts/mask_water.py --city "Venice, Italy"

The model sometimes takes dark water (canals, lagoon, sea) for built-up land. satellite_city.py now
masks water (ESA WorldCover class 80) when it runs; this applies the same step to a city computed
before, and recomputes the built area per year in the file.
"""
import argparse
import base64
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import satellite_city as sc  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--city", required=True)
    a = ap.parse_args()
    name = sc.slug(a.city)
    path = os.path.join(sc.data_root(), "city_" + name, "city_%s.json" % name)
    d = json.load(open(path, encoding="utf-8"))
    H, W = d["h"], d["w"]
    dec = lambda k: np.frombuffer(base64.b64decode(d[k]), dtype="uint8").reshape(H, W)
    first, land, inside = dec("first"), dec("land"), dec("inside")
    new = sc.mask_water(first, land)
    print("water cells removed from the built area: %d (%.0f ha)" % ((new != first).sum(), (new != first).sum() * 0.04))
    for i, s in enumerate(d["stats"]):
        s["built_ha"] = round(float(((new <= i) & (inside == 1)).sum() * 0.04), 1)
    d["first"] = base64.b64encode(new.tobytes()).decode()
    json.dump(d, open(path, "w"))
    print("%d: %.0f ha -> %d: %.0f ha, out of %.0f ha" % (d["stats"][0]["year"], d["stats"][0]["built_ha"],
          d["stats"][-1]["year"], d["stats"][-1]["built_ha"], (inside == 1).sum() * 0.04))


if __name__ == "__main__":
    main()
