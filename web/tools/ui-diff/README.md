# UI diff: check that a refactor does not change the page

Compares the computed style of every element before and after a change, in 8 states (story, explore, city menu list and map, about, address typing, hand tool, heat).

1. `mkdir -p /tmp/ui-diff && python3 web/tools/ui-diff/receiver.py /tmp/ui-diff &` (listens on 127.0.0.1:8766 and stores what the page posts).
2. Serve the BEFORE build and the AFTER build from the same address and port (same origin: the saved language and the menu view must be the same, set `localStorage.city_lang` to `en`), one after the other.
3. In the page (a city with the heat layer, for example `#tel-aviv`), paste `driver.js`, then run `await __run('before_')` (and `await __run('after_')` on the other build).
4. `python3 web/tools/ui-diff/compare.py before_ after_` prints the number of differing elements per state. 0 everywhere means the refactor kept the rendering.

Two runs of the same build give 0 differences, so any difference is real.
