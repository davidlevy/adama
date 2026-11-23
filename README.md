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

Run the scripts from the folder that holds the city folders (next to this repo), for example
`satellite/` with `satellite/adama/` inside it.

```bash
# 1. Generate city data (once per city, resumes if interrupted)
python adama/scripts/satellite_city.py --city "Ra'anana, Israel" --years-ls 1985-2018

# 2. Optional: summer surface temperature history (Landsat thermal band), adds a HEAT button
python adama/scripts/surface_temperature.py --city "Ra'anana, Israel"

# 3. List the cities in adama/web/cities.txt, then build and run the site
cd adama && npm install && npm run dev      # http://localhost:8000
```

The site is a static folder (`dist/site`: `index.html` plus one JSON file per city, loaded on
demand). It needs an HTTP server, `file://` does not work. To publish it, copy the folder to
`public/adama/` of an Astro site, or any static host. Pick a city with the breadcrumb menu or
`#slug` in the URL. For cloudier countries, raise `--scenes` (for example `--scenes 4`).

## Notes

- Generated pages, per-city data and the raw satellite cache are not committed.
- Stats are shown as percentages and trends, not hectares.
- Water cells (ESA WorldCover) are never counted as built.
- Heat layer: summer Landsat surface temperature at 100 m, shown as the difference to the city median of each year, so weather differences between years cancel out.
- Fonts embedded in the page: Geist, Fraunces, Caveat (SIL Open Font License).

## Skyscrapers (optional)

Real tall buildings from OpenStreetMap, drawn as very tall black towers:

    python scripts/skyscrapers.py --city "Tel Aviv, Israel"

It writes `city_<slug>/towers.json` next to the city data. `npm run dev` picks it up automatically.

## Adding a city outside Israel

    python scripts/satellite_city.py --city "Grenoble, France"
    python scripts/surface_temperature.py --city "Grenoble, France"
    python scripts/skyscrapers.py --city "Grenoble, France"

Then add it to `web/cities.txt` and its name and country in `NAMES` and `CODE` in `web/src/app.js`. `npm run dev` rebuilds the site.

For a big city or a region, give the centre and a radius in km: `--center 25.2,55.27 --radius 7`.

## Data sources and licences

The code is MIT (see `LICENSE`). The data it fetches has its own terms:

- Landsat (USGS/NASA): public domain.
- Sentinel-2 (Copernicus/ESA): free and open, credit the Copernicus Sentinel data.
- ESA WorldCover: CC BY 4.0.
- Imagery access through Microsoft Planetary Computer.
- Roads, playgrounds and tall buildings: © OpenStreetMap contributors, ODbL (https://www.openstreetmap.org/copyright). Keep the attribution if you publish a site built from it.
- Fonts embedded in the page (Geist, Fraunces, Caveat): SIL Open Font License.
