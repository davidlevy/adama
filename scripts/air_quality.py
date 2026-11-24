#!/usr/bin/env python3
"""
air_quality.py : air quality history and live value of a city, from several interchangeable sources.

    python scripts/air_quality.py --city "Ra'anana, Israel"

Writes city_<name>/air.json, which the viewer draws as a yearly curve under the timeline.
Run satellite_city.py first (the city location is read from its JSON file).

Sources ("providers"), best first. For each pollutant the first provider that has data wins:
  station  city_<name>/air_station.csv   measurements of a real station (columns: date,pm25,no2,o3;
                                          date as YYYY-MM-DD, daily or hourly). Most precise: put the
                                          ministry or WAQI download of the nearest station here.
  openmeteo  CAMS reanalysis, ~11 km grid, 2013 to now, no key. Regional, not street level.
live     WAQI nearest station, now only, with --waqi (token in WAQI_TOKEN or in .env). Off by default: a snapshot of
         today must not be mixed with yearly history, and it must not be spread across the city by interpolation.

To add a source, write a function (lat, lon, folder) -> {pollutant: series} and add it to PROVIDERS.
A series is {"label", "unit", "source", "res_km", "years": [..], "values": [..], "break_before": year|None}.
break_before marks the first year from which the series is homogeneous (the model changed before).
"""
import argparse
import csv
import json
import math
import os
import statistics
import sys
from collections import defaultdict

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import satellite_city as sc  # noqa: E402

LABELS = {"pm25": ("PM2.5", "µg/m³"), "no2": ("NO₂", "µg/m³"), "o3": ("O₃", "µg/m³")}
MIN_HOURS = 0.7 * 8760   # a year needs 70 % of the hours (or days) to count
MIN_YEARS = 3            # fewer years than this is not worth a card (Eilat and Dubai only have 2023 onwards: the viewer says "no data before 2023")
MAX_STATION_KM = 25      # a live station farther than this does not describe the city
YEARS = (2013, 2025)


def annual(values_by_year, per_year, label, source, res_km, break_before=None):
    years = sorted(y for y, v in values_by_year.items() if len(v) >= per_year)
    return {"label": label[0], "unit": label[1], "source": source, "res_km": res_km, "years": years,
            "values": [round(statistics.mean(values_by_year[y]), 1) for y in years], "break_before": break_before}


def provider_station(lat, lon, folder):
    """Measurements of a real station, from air_station.csv (daily or hourly)."""
    path = os.path.join(folder, "air_station.csv")
    if not os.path.exists(path):
        return {}
    by = {k: defaultdict(list) for k in LABELS}
    days = defaultdict(set)
    for row in csv.DictReader(open(path, encoding="utf-8")):
        y = int(row["date"][:4])
        for k in LABELS:
            try:
                by[k][y].append(float(row[k]))
                days[(k, y)].add(row["date"][:10])
            except (KeyError, ValueError, TypeError):
                pass
    out = {}
    for k, label in LABELS.items():
        ok = {y: v for y, v in by[k].items() if len(days[(k, y)]) >= 0.7 * 365}
        if ok:
            out[k] = annual(ok, 1, label, "Measuring station (air_station.csv)", 0)
    return out


def provider_openmeteo(lat, lon, folder):
    """CAMS global reanalysis through Open-Meteo. PM2.5 and ozone only: its NO2 has a break in 2018."""
    r = requests.get("https://air-quality-api.open-meteo.com/v1/air-quality", timeout=180, params=dict(
        latitude=lat, longitude=lon, hourly="pm2_5,ozone", start_date="%d-01-01" % YEARS[0],
        end_date="%d-12-31" % YEARS[1], timezone="UTC"))
    r.raise_for_status()
    h = r.json()["hourly"]
    out = {}
    for key, k in (("pm2_5", "pm25"), ("ozone", "o3")):
        by = defaultdict(list)
        for t, v in zip(h["time"], h[key]):
            if v is not None:
                by[int(t[:4])].append(v)
        # the CAMS system changed in 2018-2019: earlier years are drawn apart (break_before)
        out[k] = annual(by, MIN_HOURS, LABELS[k], "CAMS via Open-Meteo", 11, break_before=2018)
    return out


PROVIDERS = [provider_station, provider_openmeteo]


def token():
    t = os.environ.get("WAQI_TOKEN")
    if t:
        return t
    for d in (os.getcwd(), sc.data_root()):
        p = os.path.join(d, ".env")
        if os.path.exists(p):
            for line in open(p):
                if line.startswith("WAQI_TOKEN="):
                    return line.split("=", 1)[1].strip()
    return None


def km(a, b, c, d):
    p = math.pi / 180
    x = math.sin((c - a) * p / 2) ** 2 + math.cos(a * p) * math.cos(c * p) * math.sin((d - b) * p / 2) ** 2
    return 12742 * math.asin(math.sqrt(x))


def live(lat, lon):
    t = token()
    if not t:
        return None
    j = requests.get("https://api.waqi.info/feed/geo:%f;%f/" % (lat, lon), params={"token": t}, timeout=30).json()
    if j.get("status") != "ok":
        return None
    d = j["data"]
    la, lo = d["city"]["geo"]
    dist = km(lat, lon, la, lo)
    if dist > MAX_STATION_KM:
        return None
    return {"aqi": d["aqi"], "station": d["city"]["name"].split(",")[0], "distance_km": round(dist, 1),
            "time": d["time"]["s"], "pm25": d["iaqi"].get("pm25", {}).get("v"), "no2": d["iaqi"].get("no2", {}).get("v"),
            "source": "WAQI"}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--city", required=True)
    ap.add_argument("--waqi", action="store_true", help="also read today's value of the nearest WAQI station (needs WAQI_TOKEN); off by default")
    a = ap.parse_args()
    name = sc.slug(a.city)
    folder = os.path.join(sc.data_root(), "city_" + name)
    src = os.path.join(folder, "city_%s.json" % name)
    if not os.path.exists(src):
        sys.exit("Run satellite_city.py first: %s not found" % src)
    cj = json.load(open(src, encoding="utf-8"))
    w, s, e, n = cj["bbox"]
    lat, lon = (s + n) / 2, (w + e) / 2
    series = {}
    for prov in PROVIDERS:
        try:
            got = prov(lat, lon, folder)
        except Exception as ex:  # a source that is down must not stop the others
            print("  %s: %s" % (prov.__name__, type(ex).__name__))
            continue
        for k, v in got.items():
            if k not in series and len(v["years"]) >= MIN_YEARS:
                series[k] = v
                print("  %s from %s: %d-%d" % (k, prov.__name__, v["years"][0], v["years"][-1]))
    now = None
    try:
        now = live(lat, lon) if a.waqi else None
    except Exception as ex:
        print("  live: %s" % type(ex).__name__)
    if not series and not now:
        sys.exit("No air data found.")
    json.dump({"location": [round(lat, 4), round(lon, 4)], "series": series, "live": now,
               "who_pm25": 5},  # WHO 2021 annual guideline, µg/m³
              open(os.path.join(folder, "air.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print("wrote", os.path.join(folder, "air.json"))


if __name__ == "__main__":
    main()
