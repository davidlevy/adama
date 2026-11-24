# Known issues: cities not on the site

Cities that were generated but are held back because the built-up curve is not reliable.
Check `city_<slug>/report.txt` and `coverage.csv` before adding any city to `web/cities.txt`.

| City | Problem | Symptom | Ideas to fix |
|---|---|---|---|
| Las Vegas | Desert classified as built (Landsat 30 m) | 55-60 % built already in 1985 | Add a bare-soil / desert class to the training labels; require built to be confirmed by Sentinel-2 (10 m) or by OSM buildings/roads; use a lower built threshold in arid areas |
| Ofakim | Same desert confusion | Built goes 13 % to 53 % of the window for a town of about 30,000 people | Same as Las Vegas; also crop the window tighter around the town |
| Hadera | Unstable model | Raw built is about 22 % in 2020/2021 (the training years) and about 40 % in other years; large farm fields labelled built, curve jumps from 26 % (2021) to 43 % (2024) | Train on several years instead of two; add a cropland class; mask fields with a vegetation-seasonality feature |
| Venice | Lagoon and bad 2017 image | About 50 % green, water/land mix-ups | Mask water with a fixed water mask (JRC Global Surface Water); re-run 2018-2026 only |
| Singapore | Clouds / dense vegetation | Not validated, quality doubtful | More scenes (`--scenes 4`), check coverage per year |
| Paris, Venice and other very dense cities | Landsat 30 m mixes parks and buildings | Landsat years show 95-100 % built | Use `--no-landsat` (Paris is Sentinel-2 only, 2017-2026), or a fraction-based model instead of a binary one |

## General causes

- **Desert vs built:** bare soil and rooftops have a similar spectrum, especially at 30 m.
- **Low coverage years:** a year with partial scene coverage inflates built (Holon 2026 went to 85 % at 45 % coverage). Delete the `raw/*.npz` of years with coverage under 0.9 and re-run with `--scenes 2`.
- **Sensor switch in 2017:** Landsat (30 m) to Sentinel-2 (10 m) can create a jump that is not real.
- **Training years:** the random forest is trained on ESA WorldCover (2020/2021); those years can look different from the others.

## Before adding a city

1. Per-year built % is smooth and monotone, with no jump at 2017 larger than a few points.
2. Every year has coverage of at least 0.9 in `coverage.csv`.
3. Built share is plausible for the town size.
4. Look at the first and last year on the map.
