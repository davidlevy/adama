"""Build one self-contained HTML page from one or more city JSON files.

    python web/build.py out.html data/city_a/city_a.json data/city_b/city_b.json:LAT,LON,RADIUS_CELLS

A ":lat,lon,radius" suffix crops a very large or elongated city to a round window
(radius in 20 m cells) around the given point.
"""
import json, subprocess, sys, os
sys.path.insert(0, os.path.dirname(__file__))
import prep
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)
out = sys.argv[1]
cities = []
for arg in sys.argv[2:]:
    path, _, crop = arg.partition(':')
    if crop:
        lat, lon, r = crop.split(',')
        cities.append(prep.load(path, lat=float(lat), lon=float(lon), R=int(r)))
    else:
        cities.append(prep.load(path))
bundle = os.path.join(root, 'dist', 'bundle.js')
os.makedirs(os.path.dirname(bundle), exist_ok=True)
subprocess.run([os.path.join(root, 'node_modules', '.bin', 'esbuild'), os.path.join(here, 'src', 'app.js'),
                '--bundle', '--minify', '--outfile=' + bundle, '--log-level=warning'], check=True)
js = open(bundle, encoding='utf-8').read()
assert '</script>' not in js
head = open(os.path.join(here, 'src', 'template.html'), encoding='utf-8').read()
with open(out, 'w', encoding='utf-8') as f:
    f.write(head + '<script>window.CITIES=' + json.dumps(cities, separators=(',', ':'), ensure_ascii=False)
            + '</script><script>' + js + '</script></body></html>')
print('wrote', out)
