#!/usr/bin/env python3
"""Run: python adama/scripts/test_mobile_network.py. Checks that mobile.json never holds the position of a site."""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import mobile_network as m  # noqa: E402

# two sites 30 m apart (one site), one far; a stale site whose neighbours are alive is removed, 2 operators
T = 1_700_000_000
sites = [("1", 100.0, 100.0, T, T, T), ("1", 120.0, 120.0, T, T, T), ("1", 3000.0, 3000.0, T, T, T), ("2", 500.0, 500.0, T, T, T)]
grouped = m.sites_of([(n, x, y, c, u) for n, x, y, c, u, _ in sites])
assert len(grouped) == 3, grouped   # the two close cells of operator 1 are one site

out = m.build(grouped, [(2020, None)] * 3, [0, 0, 4000, 4000], 2020, 2022)
assert out["totals"] == [3, 3, 3]
assert m.no_coordinates(out)
s = json.dumps(out)
for g in grouped:   # no coordinate of any site, whatever the key
    assert str(round(g[1])) + "." not in s and '"x"' not in s
assert not m.no_coordinates({"sites": [[1, 2]]}) and not m.no_coordinates({"a": [{"lat": 32.1}]})
print("ok")
