# Adama

Cities seen from above, from 1985 to today, built only from free satellite data.
One composite per year (Landsat at 30 m, then Sentinel-2 at 10 m), a built-up model trained
automatically, and a 3D scroll page that replays the growth of a city year by year.

Adama (אדמה) means earth, ground.

## How it works

1. `scripts/satellite_city.py` does everything in one command: finds the city outline with
   OpenStreetMap, downloads satellite imagery from the Planetary Computer, trains a random
   forest on ESA WorldCover labels, computes the year each 20 m cell became built, and fetches
   main roads and playgrounds. It writes `city_<name>/city_<name>.json`.
2. `web/build.py` bundles one or more of those JSON files with the Three.js viewer into a single
   self-contained HTML page with a city dropdown.

## Usage

```bash
python scripts/satellite_city.py --city "Ra'anana, Israel" --years-ls 1985-2018
python scripts/satellite_city.py --city "Eilat, Israel" --years-ls 1985-2018

npm install
python web/build.py adama.html city_ra-anana/city_ra-anana.json \
    city_eilat/city_eilat.json:29.5577,34.9519,170
```

Open the page with `#ra-anana` or `#eilat` in the URL to pick a city, or use the dropdown.
For cloudier countries, raise `--scenes` (for example `--scenes 4`).

## Notes

- Generated pages, per-city data and the raw satellite cache are not committed.
- Stats are shown as percentages and trends, not hectares.
- Water cells (ESA WorldCover) are never counted as built.
- Fonts embedded in the page: Geist, Fraunces, Caveat (SIL Open Font License).
