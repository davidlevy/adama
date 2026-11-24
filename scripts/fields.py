#!/usr/bin/env python3
"""
fields.py : mark the fields (cropland) of a city, so that they are not counted as green space.

    python scripts/fields.py --city "Ra'anana, Israel"

On the edge of a city most of the land that is not built is farmland, not parks or gardens. This reads the
ESA WorldCover map (2021, class "cropland") for the city and writes it in city_<name>.json (field "land",
value 3, next to 1 water and 2 bare ground). The viewer draws fields in ochre, counts them apart and no
longer calls them green. satellite_city.py does this by itself for new cities; this updates a city computed before.
No satellite scene is downloaded again (only the WorldCover tiles, or the copy in raw/).
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
    ap.add_argument("--city", help="city name, as given to satellite_city.py")
    ap.add_argument("--slug", help="or the folder name without city_ (e.g. tel-aviv)")
    a = ap.parse_args()
    if not (a.city or a.slug):
        sys.exit("give --city or --slug")
    name = a.slug or sc.slug(a.city)
    folder = os.path.join(sc.data_root(), "city_" + name)
    path = os.path.join(folder, "city_%s.json" % name)
    d = json.load(open(path, encoding="utf-8"))
    W, H = d["w"], d["h"]
    bbox = d["bbox"]
    g10 = sc.make_grid(bbox, (bbox[0] + bbox[2]) / 2, 10.0)
    if (g10["width"] // 2, g10["height"] // 2) != (W, H):
        sys.exit("The grid of %s does not match the file (%dx%d against %dx%d)" % (name, g10["width"] // 2, g10["height"] // 2, W, H))
    from pystac_client import Client
    import planetary_computer
    cat = Client.open(sc.PC_URL, modifier=planetary_computer.sign_inplace)
    raw = os.path.join(folder, "raw")
    os.makedirs(raw, exist_ok=True)
    wc = sc.get_wc(cat, 2021, bbox, g10, raw)
    land = sc.land_cells(wc)[:H, :W].astype("uint8")
    old = np.frombuffer(base64.b64decode(d["land"]), dtype="uint8").reshape(H, W) if d.get("land") else None
    d["land"] = base64.b64encode(land.tobytes()).decode()
    json.dump(d, open(path, "w"))
    first = np.frombuffer(base64.b64decode(d["first"]), dtype="uint8").reshape(H, W)
    inside = np.frombuffer(base64.b64decode(d["inside"]), dtype="uint8").reshape(H, W) == 1
    nb = (land == 3) & inside
    print("%s: fields %.0f ha (%.0f %% of the area), of which never built %.0f ha%s" % (
        name, nb.sum() * 0.04, 100 * nb.sum() / max(1, inside.sum()), (nb & (first == 255)).sum() * 0.04,
        "" if old is None else "; water/bare unchanged: %s" % bool(((old == 1) == (land == 1)).all() and ((old == 2) == (land == 2)).all())))


if __name__ == "__main__":
    main()
