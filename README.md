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

# 3. Optional: neighbourhood names (DISTRICTS pills), tall towers, air quality (AIR button)
python adama/scripts/neighborhoods.py --city "Ra'anana, Israel"
python adama/scripts/skyscrapers.py   --city "Ra'anana, Israel"
python adama/scripts/tower_dates.py   --city "Ra'anana, Israel"   # construction years of the towers
python adama/scripts/air_quality.py   --city "Ra'anana, Israel"

# 4. List the cities in adama/web/cities.txt, then build and run the site
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

### Tower construction years

OpenStreetMap rarely tells when a tower was built. Without a year, the viewer would draw a tower as soon as its
20 m cell is "built" in the satellite model, often decades too early. So, after `skyscrapers.py`:

    python scripts/tower_dates.py --city "Tel Aviv, Israel"

It asks Wikidata for the buildings around the city that have a height and an inception or opening year, matches them
to the towers (within 70 m, height within 35 %) and writes the year into `towers.json`. Only towers with no year yet
are changed, so it can be run again. For Tel Aviv, 78 of 473 towers get a real year (the tallest ones); for Dubai,
1 of 529.

Towers that stay undated are drawn from 1990 at the earliest (`UNDATED_FROM` in `web/src/app.js`). This floor is an
estimate: some towers of 50 to 100 m may be older.

## Air quality (optional, AIR button)

    python scripts/air_quality.py --city "Ra'anana, Israel"

Writes `city_<slug>/air.json`: the yearly mean of fine particles (PM2.5) and ozone from the CAMS reanalysis through
Open-Meteo (2013 to now, about 11 km grid, so it is regional, not street level). The viewer shows it as a card with a
graph and a 3D haze above the city: the worse the air, the denser, coarser and more grainy the haze, and the more
the colours are dulled. Cities with fewer than 3 years of data get no AIR button (Eilat and Dubai start in 2023).

The sources are interchangeable: a station CSV (`city_<slug>/air_station.csv`, columns `date,pm25,no2,o3`) wins over the
regional model, and a new source is one function added to `PROVIDERS` in `air_quality.py`. CAMS data before 2018 comes
from another model version: that part of the curve is dashed in the viewer.

Today's value of the nearest WAQI station is opt-in (`--waqi`, token in `WAQI_TOKEN` or in a `.env` file kept out of
git). It is never spread across the city or across years: a snapshot of today would be false data for the past.

## Neighbourhoods (optional, DISTRICTS button)

    python scripts/neighborhoods.py --city "Ra'anana, Israel"

Writes `city_<slug>/neighborhoods.json` (district names from OpenStreetMap); the viewer shows the yearly change of green
for each district as a pill when you zoom in.

## Small parks (optional)

At 20 m a small park between buildings is often classified as built. `python scripts/green_spaces.py --city "Ra'anana, Israel"` reads the park, garden, grass and wood polygons of OpenStreetMap and writes `city_<name>/greens.json`. `web/prep.py` then treats a cell as never built only if at least 90 % of it is inside such a polygon and at most 10 % of it is covered by an OpenStreetMap building (a 5 m raster is used), so streets and courtyards are not turned green. Run it after `satellite_city.py`; it needs the Overpass API, which is sometimes slow (run again later if it times out).

## Adding a city outside Israel

    python scripts/satellite_city.py --city "Grenoble, France"
    python scripts/surface_temperature.py --city "Grenoble, France"
    python scripts/skyscrapers.py --city "Grenoble, France"
    python scripts/tower_dates.py --city "Grenoble, France"
    python scripts/air_quality.py --city "Grenoble, France"

Then add it to `web/cities.txt` and its name and country in `NAMES` and `CODE` in `web/src/app.js`. `npm run dev` rebuilds the site.

For a big city or a region, give the centre and a radius in km: `--center 25.2,55.27 --radius 7`.

## Share links

The address follows the session and always holds a link that restores it: `https://host/adama/raanana?s=LgoAunJVAUfbRQmZeg`. The token `s` is base64url and short; it holds the year, the active layers (heat, air, districts, the "before" lens) and, in explore mode, the position, the zoom and the angle of the camera. The format is documented above `enc()` in `web/src/app.js`; flag bytes are extensible (a continuation bit), so new layers can be added at the end without breaking links already shared. City names are read with or without hyphens (`telaviv`, `tel-aviv`). The Share button copies the link.

Two kinds of addresses, chosen at build time:
- **path links** (`/adama/raanana?s=...`) when the page is built with `--base=/adama/` (or `--base=/`): the host must return `index.html` for `/<base><slug>`. `adama_site/publish.sh` does this for the copies it publishes: `web/vercel.json` has the rewrite for Vercel (cities live under `/place/<slug>` there), and the personal site has the route `src/pages/adama/[slug].ts` for Cloudflare.
- **hash links** (`#raanana?s=...`) for a plain static folder (`python3 -m http.server -d dist/site`).

Old links (`#slug`, `#slug?y=2010&l=heat,air`, `#slug~token`) still open: on a path build they redirect to the path version.

## Publishing

`adama_site/publish.sh` rebuilds the site from the current code and data. `--deploy` publishes it on the Cloudflare worker of the personal site (`/adama/`). `--vercel` deploys only the page to Vercel (`web/vercel.json` rewrites `/data/*` to the Cloudflare copy, and `data/` is not uploaded), so the 100 MB upload limit of the free plan does not matter. It checks first that Cloudflare holds the same cities and stops otherwise: run `--deploy` first. First time: `npx vercel login` then `npx vercel link` in `adama_site/`.

## Data sources and licences

The code is MIT (see `LICENSE`). The data it fetches has its own terms:

- Landsat (USGS/NASA): public domain.
- Sentinel-2 (Copernicus/ESA): free and open, credit the Copernicus Sentinel data.
- ESA WorldCover: CC BY 4.0.
- Imagery access through Microsoft Planetary Computer.
- Air quality: Copernicus Atmosphere Monitoring Service (CAMS) data through Open-Meteo.com (CC BY 4.0, credit both). WAQI, if used, requires crediting the World Air Quality Index Project.
- Tower years: Wikidata (CC0).
- Roads, playgrounds and tall buildings: © OpenStreetMap contributors, ODbL (https://www.openstreetmap.org/copyright). Keep the attribution if you publish a site built from it.
- Fonts embedded in the page (Geist, Fraunces, Caveat): SIL Open Font License.
