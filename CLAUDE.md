# Adama

Cities seen from space since 1984, built from free satellite data. Public repo: github.com/davidlevy/adama (MIT).
Adama (אדמה) = earth. Site is a static Three.js scroll page; see README.md for how the pipeline works.

## Layout

- Run everything from the parent folder `satellite/` (city folders `city_<slug>/` sit next to this repo, not inside it).
- `scripts/satellite_city.py` generates `city_<slug>/city_<slug>.json`. `skyscrapers.py` adds `towers.json`, `surface_temperature.py` adds `heat.json`.
- `web/cities.txt` lists the cities in the site (`path:LAT,LON,RADIUS_CELLS` crops to a round window). `web/build.py` builds `dist/site`.
- `web/src/app.js` and `web/src/template.html` are the whole front end. `template.html` has huge base64 font lines: never `cat` it, use `grep -o` or Python to edit.
- Local dev: `npm run dev` (http://localhost:8000). `adama_site/` (outside the repo) is the copy that goes online.

## Adding a city

1. `python adama/scripts/satellite_city.py --city "X" --center LAT,LON --radius KM [--scenes 4 for cloudy places]`
2. Optional: `surface_temperature.py` (HEAT button), `skyscrapers.py` (towers), same `--city` string.
3. Optional: `air_quality.py --city X` (AIR button: yearly regional PM2.5 as a 3D haze layer; `--waqi` adds today's value of the nearest station, needs `WAQI_TOKEN` in `satellite/.env`, never commit it; never interpolate today's stations across the city or years). For a precise history, drop a station CSV (date,pm25,no2,o3) as `city_<slug>/air_station.csv`; it wins over the regional model. To add another source, add a provider function in `air_quality.py`.
4. Add it to `web/cities.txt`, and to `NAMES` (fr/en/he) and `CODE`/`CTRY` (country) in `web/src/app.js`.
5. `python3 web/build.py`, then copy `dist/site/index.html` and `dist/site/data/` into `adama_site/`.

Always pass `--center` and `--radius` for a big or ambiguous city: the geocoder can pick the wrong object (Las Vegas resolved to a casino of 0.5 km).

## Gotchas

- Desert cities are mislabeled as built by the Landsat model (Las Vegas shows 55-60 % built in 1985). Las Vegas is therefore NOT on the site until the model is fixed. Check the per-year built % in `city_<slug>/report.txt` before adding a city.
- Overpass is slow for big cities: `overpass()` takes a `timeout` argument; `skyscrapers.py` uses 180 s, one try. The default 60 s with retries fails on large areas.
- 2017 is the Landsat to Sentinel-2 switch (30 m to 10 m); a jump that year may come from the sensor, not the city.
- Generation takes 10-20 min per city (Sentinel-2 years dominate); running several at once shares bandwidth.
- Every user-visible string exists in 3 languages (fr, en, he) in the `I18` object in `app.js`. Add all three.

## Conventions

- Style: Geist for text, Caveat for the logo and city names, black and white UI. Playgrounds are violet (#a56bff).
- Stats that have no value (first year) are hidden, not shown as a dash.
- Credits (Landsat, Sentinel-2, WorldCover, Planetary Computer, OpenStreetMap) must stay visible on the page: OSM requires attribution.

## Git and deploy

- Work on a branch and open a PR; never push to `main` directly and never merge a PR. Ask before any push (public repo).
- Commit as the GitHub noreply address (set in the repo config); do not put a personal email in commits or files.
- Deploying is `adama_site/publish.sh --deploy` (publishes to the personal site). Only run it when explicitly asked.
- Generated data (`city_*`, `*.json`, `raw/`, `dist/`) is gitignored. Do not commit it.
