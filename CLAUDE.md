# Adama

Cities seen from space since 1984, built from free satellite data. Public repo: github.com/davidlevy/adama (MIT).
Adama (אדמה) = earth. Site is a static Three.js scroll page; see README.md for how the pipeline works.

## Layout

- Run everything from the parent folder `satellite/` (city folders `city_<slug>/` sit next to this repo, not inside it).
- `scripts/satellite_city.py` generates `city_<slug>/city_<slug>.json`. `skyscrapers.py` adds `towers.json`, `surface_temperature.py` adds `heat.json`.
- `web/cities.txt` lists the cities in the site (`path:LAT,LON,RADIUS_CELLS` crops to a round window). `web/build.py` builds `dist/site`.
- Front end (`web/src/`), in TypeScript (`npm run typecheck` runs `tsc` in strict mode; esbuild strips the types at build): `app.ts` is the scene and the page logic and is still `// @ts-nocheck` (to be split into typed modules), with `music.ts` (Web Audio pieces), `pixellogo.ts`, `loader.ts`, `i18n.ts`, `types.ts` and `data/*.ts` (texts, names, icons, countries, earth mask) next to it. The controls are Preact components in `ui/` (`Position.tsx`, `city-menu/CityMenu.tsx` with `CityList.tsx` and `WorldMap.tsx`; the drawing of the map is plain TypeScript in `mapDrawing.ts`); `ui/langBus.ts` tells them when the language changes. A component gets a small typed api from `app.ts` and never touches the Three.js scene: the 3D frame rate must not change (measured: 30 fps before and after). `index.html` is a shell with one `<!--include:name-->` per fragment of `html/*.html` (DOM order), `css/*.css` are one file per component listed in `css/index.css` in cascade order (later files win ties), `ui/*.module.css` are CSS modules. `css/fonts.css` holds the base64 fonts (213 KB on a few lines): never `cat` it. `web/build.py` bundles the CSS and the JS with esbuild and inlines them in the page.
- Add Zustand (shared UI state) or Zod (validating data read from a file or localStorage) only when a real need appears; neither is used yet.
- Refactoring the CSS or the markup: compare the computed style of every element before and after (load both builds from the same origin, same language, in the story, explore, menu, about and typing states). A split into 18 files was checked this way: 0 differences.
- Local dev: `npm run dev` (http://localhost:8000). `adama_site/` (outside the repo) is the copy that goes online.

## Adding a city

1. `python adama/scripts/satellite_city.py --city "X" --center LAT,LON --radius KM [--scenes 4 for cloudy places]`
2. Optional: `surface_temperature.py` (HEAT button), `skyscrapers.py` (towers), same `--city` string.
3. Optional: `air_quality.py --city X` (AIR button: yearly regional PM2.5 as a 3D haze layer; `--waqi` adds today's value of the nearest station, needs `WAQI_TOKEN` in `satellite/.env`, never commit it; never interpolate today's stations across the city or years). For a precise history, drop a station CSV (date,pm25,no2,o3) as `city_<slug>/air_station.csv`; it wins over the regional model. To add another source, add a provider function in `air_quality.py`.
4. Optional: `tower_dates.py --city X` after `skyscrapers.py`: fills tower construction years from Wikidata (OSM rarely has them). Towers still undated are drawn from 1990 at the earliest (`UNDATED_FROM` in `app.js`).
5. Add it to `web/cities.txt`, and to `NAMES` (fr/en/he) and `CODE`/`CTRY` (country) in `web/src/app.js`.
6. `python3 web/build.py`, then copy `dist/site/index.html` and `dist/site/data/` into `adama_site/`.

Always pass `--center` and `--radius` for a big or ambiguous city: the geocoder can pick the wrong object (Las Vegas resolved to a casino of 0.5 km).

## Gotchas

- Desert cities are mislabeled as built by the Landsat model (Las Vegas shows 55-60 % built in 1985). Las Vegas is therefore NOT on the site until the model is fixed. Check the per-year built % in `city_<slug>/report.txt` before adding a city.
- Overpass is slow for big cities: `overpass()` takes a `timeout` argument; `skyscrapers.py` uses 180 s, one try. The default 60 s with retries fails on large areas.
- 2017 is the Landsat to Sentinel-2 switch (30 m to 10 m); a jump that year may come from the sensor, not the city.
- Generation takes 10-20 min per city (Sentinel-2 years dominate); running several at once shares bandwidth.
- Every user-visible string exists in 3 languages (fr, en, he) in the `I18` object in `app.js`. Add all three.

## Conventions

- Style: Geist for text, Caveat for the logo and city names, black and white UI. Playgrounds are violet (#a56bff).
- Never-built meadows, fields and bare ground are drawn as merged static blocks (8x8, then 4x4, then 2x2 cells) with a colour mosaic computed in the shader (`gs` large drifting patches, `cs` per 3x3-cell patch, in the material patch of `app.js`); the cells that will be built later get the same flat height and base colour, with no seam on the ground. Water keeps its finer 4x4 blocks (8x8 water looks like big squares) and its own shader. This is a deliberate look: do not break it. Do not give green blocks or cells random heights or random colours, do not shrink the patches back to single cells, and do not add seams. Any change to it needs an explicit request from the user.
- Stats that have no value (first year) are hidden, not shown as a dash.
- Credits (Landsat, Sentinel-2, WorldCover, Planetary Computer, OpenStreetMap) must stay visible on the page: OSM requires attribution.

## State in the URL

- Any new filter, layer, toggle or other UI parameter that changes what the user sees must be kept in the address, so that a shared link restores the session. Add it to the `FLAGS` table above `enc()` in `web/src/app.js` (one bit per boolean, appended at the end; the flag bytes have a continuation bit, so links already shared keep working). Values that are not booleans (a position, a zoom, an angle, a number) go in the saved-view part of the token, appended after the existing fields, with a decoder that accepts the shorter older tokens.
- Do not put the language in the link. Never change the meaning of an existing bit or the order of the existing fields.
- When you add a parameter, test it end to end: change it, read the address, open that address in a fresh page, check the parameter is restored (see the "Share links" section of the README).

## Git and deploy

- Work on a branch and open a PR; never push to `main` directly and never merge a PR. Ask before any push (public repo).
- Commit as the GitHub noreply address (set in the repo config); do not put a personal email in commits or files.
- Deploying is `adama_site/publish.sh --deploy` (personal site, served under `/adama/`) or `adama_site/publish.sh --vercel` (Vercel, domain root). Both rebuild from the repo first. Only run them when explicitly asked.
- Vercel cannot build the site itself (the city data is not in git), so it receives the built folder `adama_site/` with `web/vercel.json` (data files revalidate on every load, so a new city never stays stale). First time: `cd adama_site && npx vercel login && npx vercel link`.
- Generated data (`city_*`, `*.json`, `raw/`, `dist/`) is gitignored. Do not commit it.
