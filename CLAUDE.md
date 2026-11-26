# Adama

Cities seen from space since 1984, built from free satellite data. Public repo: github.com/davidlevy/adama (MIT).
Adama (אדמה) = earth. Site is a static Three.js scroll page; see README.md for how the pipeline works.

## Layout

- Run everything from the parent folder `satellite/` (city folders `city_<slug>/` sit next to this repo, not inside it).
- `scripts/satellite_city.py` generates `city_<slug>/city_<slug>.json`. `skyscrapers.py` adds `towers.json`, `surface_temperature.py` adds `heat.json`.
- `web/cities.json` lists the cities in the site, one object per city: `slug`, `names` (fr/en/he), `country` (a key of `CTRY` in `web/src/data/countries.ts`), and optionally `crop` `{lat, lon, radius}` (radius in 20 m cells, crops to a round window). The order is the order of the index. Names and country reach the page through the city index and the city file (`names`, `co`). `web/build.py` builds `dist/site`.
- Front end (`web/src/`), in TypeScript (`npm run typecheck` runs `tsc` in strict mode; esbuild strips the types at build): `app.ts` is the scene and the page logic and is still `// @ts-nocheck` (to be split into typed modules), with `music.ts` (Web Audio pieces), `pixellogo.ts`, `loader.ts`, `i18n.ts`, `types.ts` and `data/*.ts` (texts, names, icons, countries, earth mask) next to it. The controls are Preact components in `ui/` (`Position.tsx`, `city-menu/CityMenu.tsx` with `CityList.tsx` and `WorldMap.tsx`; the drawing of the map is plain TypeScript in `mapDrawing.ts`); `ui/store.ts` is the Zustand store (`lang`, `setLang`) with the hooks `useUi`, `useLang`, `useT`: components read the language from it and `app.ts` follows it with `ui.subscribe`. A component gets a small typed api from `app.ts` and never touches the Three.js scene: the 3D frame rate must not change (measured: 30 fps before and after). `index.html` is a shell with one `<!--include:name-->` per fragment of `html/*.html` (DOM order), `css/*.css` are one file per component listed in `css/index.css` in cascade order (later files win ties), `ui/*.module.css` are CSS modules. `css/fonts.css` holds the base64 fonts (213 KB on a few lines): never `cat` it. `web/build.py` bundles the CSS and the JS with esbuild and inlines them in the page.
- Formatting: Prettier (`.prettierrc.json`, `npm run format`, `npm run format:check`) on the CSS, the typed modules and the texts; `app.ts`, the base64 files (`css/fonts.css`, `data/earthmask.ts`, `worldmask.ts`) are in `.prettierignore`. `i18n.ts` has `fr` as the reference: `en` and `he` must have exactly its keys, `tsc` fails otherwise.
- Shared UI state lives in the Zustand store (`ui/store.ts`, vanilla `createStore`, no preact/compat). Add new shared state there. Add Zod only when data read from a file or localStorage needs validating; it is not used yet.
- Refactoring the CSS or the markup: compare the computed style of every element before and after (load both builds from the same origin, same language, in the story, explore, menu, about and typing states). A split into 18 files was checked this way: 0 differences.
- Local dev: `npm run dev` (http://localhost:8000). `adama_site/` (outside the repo) is the copy that goes online.

## Adding a city

1. `python adama/scripts/satellite_city.py --city "X" --center LAT,LON --radius KM [--scenes 4 for cloudy places]`
2. Optional: `surface_temperature.py` (HEAT button), `skyscrapers.py` (towers), same `--city` string.
3. Optional: `air_quality.py --city X` (AIR button: yearly regional PM2.5 as a 3D haze layer; `--waqi` adds today's value of the nearest station, needs `WAQI_TOKEN` in `satellite/.env`, never commit it; never interpolate today's stations across the city or years). For a precise history, drop a station CSV (date,pm25,no2,o3) as `city_<slug>/air_station.csv`; it wins over the regional model. To add another source, add a provider function in `air_quality.py`.
4. Optional: `rainfall.py --city X` (yearly rainfall since 1981 from CHIRPS, 5 km grid, 60 N to 60 S only: no data for Yakutsk): writes `rain.json`, shown as a small card (curve + 5-year average) and as discreet rain over the city in explore mode (click the card to hide it). Needs no key; it reads a few pixels of each yearly file by HTTP range, the server sometimes fails, the script retries.
5. Optional: `mobile_network.py --city X` (OpenCelliD, Israel MCC 425; token `OPENCELLID_TOKEN` in `satellite/.env`, never print or commit): writes `mobile.json` (400 m density grid per year, NO antenna position; `python scripts/test_mobile_network.py` checks that) and `report_mobile.txt`. Shown as the NETWORK button: a white lattice over the city. Growth in OpenCelliD also reflects more contributors: call it "observed network", never radiation or exposure.
5. Optional: `population.py --city X` (inhabitants per 100 m block 1985-2020 from GHSL GHS-POP, 8 epochs): writes `pop.json`, shown in the hover tooltip (400 m) and as a person + trend in the district pills. Each 10-degree tile is a 72 MB zip per epoch, downloaded once into `raw_ghsl/` next to the city folders. It is a model, shown as "about".
5. Optional: `tower_dates.py --city X` after `skyscrapers.py`: fills tower construction years from Wikidata (OSM rarely has them). Towers still undated are drawn from 1990 at the earliest (`UNDATED_FROM` in `app.ts`).
6. Add it to `web/cities.json` (slug, names fr/en/he, country code, optional crop). A new country needs its fr/en/he names in `CTRY` (`web/src/data/countries.ts`).
7. `python3 web/build.py`, then copy `dist/site/index.html` and `dist/site/data/` into `adama_site/`.

Always pass `--center` and `--radius` for a big or ambiguous city: the geocoder can pick the wrong object (Las Vegas resolved to a casino of 0.5 km).

## Gotchas

- Desert cities are mislabeled as built by the Landsat model (Las Vegas shows 55-60 % built in 1985). Las Vegas is therefore NOT on the site until the model is fixed. Check the per-year built % in `city_<slug>/report.txt` before adding a city.
- Overpass is slow for big cities: `overpass()` takes a `timeout` argument; `skyscrapers.py` uses 180 s, one try. The default 60 s with retries fails on large areas.
- Cities beside mountains or forests (Sapporo): the model takes dark forest for built-up land. Re-run with `--mask-forest` (resumes from the cached images): cells that WorldCover shows as tree cover are never built. Off by default because it would lighten leafy built-up districts.
- 2017 is the Landsat to Sentinel-2 switch (30 m to 10 m); a jump that year may come from the sensor, not the city.
- Generation takes 10-20 min per city (Sentinel-2 years dominate); running several at once shares bandwidth.
- Every user-visible string exists in 3 languages (fr, en, he) in the `I18` object in `app.ts`. Add all three.

## Conventions

- Style: Geist for text, Caveat for the logo and city names, black and white UI. Playgrounds are violet (#a56bff).
- Never-built meadows, fields and bare ground are drawn as merged static blocks (8x8, then 4x4, then 2x2 cells) with a colour mosaic computed in the shader (`gs` large drifting patches, `cs` per 3x3-cell patch, in the material patch of `app.ts`); the cells that will be built later get the same flat height and base colour, with no seam on the ground. Water keeps its finer 4x4 blocks (8x8 water looks like big squares) and its own shader. This is a deliberate look: do not break it. Do not give green blocks or cells random heights or random colours, do not shrink the patches back to single cells, and do not add seams. Any change to it needs an explicit request from the user.
- Stats that have no value (first year) are hidden, not shown as a dash.
- Credits (Landsat, Sentinel-2, WorldCover, Planetary Computer, OpenStreetMap) must stay visible on the page: OSM requires attribution.

## State in the URL

- The link is short, like Google Maps: `/place/<slug>/@32.0178,34.751?s=cR4gPBI_E4g` (hash build: `#<slug>/@...?s=...`). `@lat,lon` is the readable centre of explore mode (a hand-written `,15z` is read too: Google scale, converted by `gz2zoom`, capped by `ctl.maxZoom`). `s=` is everything else, opaque: base64url of flag bytes then the payload of each set flag, in the order of `FIELDS` in `web/src/app.ts` (heat, air, "before" lens, districts hidden, year, camera heading/tilt/zoom, placed typed address, rain, network). Bit 7 of a flag byte says another flag byte follows. Both parts are optional and either opens explore mode (`?s=` alone works without `@`).
- Any new filter, layer or toggle that changes what the user sees must be in the link: append one entry at the END of `FIELDS` (never reorder or change an existing entry), with its `enc` (payload bytes or null when off) and `dec`. Keep it as short as possible: one flag bit and no payload for an on/off layer.
- A point that comes from the GPS is never written in the link (only an address the user typed or pasted is): `place(lat, lon, gps)` keeps `meLL` empty for it.
- The Position field also accepts a pasted Google Maps link (pin `!3d..!4d..` first, else `@lat,lon`) or plain coordinates.
- Do not put the language in the link.
- When you add a parameter, test it end to end: change it, read the address, open that address in a fresh page, check the parameter is restored (see the "Share links" section of the README).

## Git and deploy

- Work on a branch and open a PR; never push to `main` directly and never merge a PR. Ask before any push (public repo).
- Branch names say exactly what the branch does, in lower-case words separated by hyphens: `<kind>-<what>-<where>`, where kind is `feature`, `fix`, `refactor`, `migration`, `docs` or `chore`. Good: `migration-preact-city-menu`, `migration-preact-typescript-zustand`, `refactor-split-css-by-component`, `feature-ambient-trap-fourth-music`, `fix-position-buttons-not-clickable`. Bad: `site-update`, `fixes`, `wip`, `new-stuff`, `cleanup`. One topic per branch and per PR: do not mix a refactor with features (split them into separate branches, even if that means cherry-picking). Never commit on `main`, even locally: create the branch first.
- Commit as the GitHub noreply address (set in the repo config); do not put a personal email in commits or files.
- Deploying is `adama_site/publish.sh --deploy` (data on the Cloudflare personal site, `/adama/data/*`, and a redirect of `/adama/<city>` to Vercel) then `adama_site/publish.sh --vercel` (the page, canonical, `/place/<city>`, reading its data from Cloudflare). Both rebuild from the repo first. Only run them when explicitly asked.
- Vercel cannot build the site itself (the city data is not in git; its Git integration is off with an Ignored Build Step), so it receives the built folder `adama_site/` with `web/vercel.json` (path rewrites only). The Vercel copy gets `<meta name="adama-data">` so the browser fetches the data from Cloudflare directly. First time: `cd adama_site && npx vercel login && npx vercel link`.
- Generated data (`city_*`, `*.json`, `raw/`, `dist/`) is gitignored. Do not commit it.
