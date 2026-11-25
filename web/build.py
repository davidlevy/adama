"""Build the static site folder: index.html, plus one JSON file per city loaded on demand.

    python3 web/build.py [out_dir] [city.json[:LAT,LON,RADIUS_CELLS] ...]

With no arguments it builds dist/site from the cities listed in web/cities.txt.
Option --base=/adama/ (anywhere on the command line): path links instead of hash links.

Result:
    out_dir/index.html
    out_dir/data/cities.json      (index of available cities)
    out_dir/data/<slug>.json      (one file per city, fetched when selected)

A ":lat,lon,radius" suffix crops a very large or elongated city to a round window
(radius in 20 m cells) around the given point. Serve out_dir over HTTP (fetch does not
work from file://), for example by copying it to public/adama/ in an Astro site.
"""
import json, subprocess, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import prep
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)
# --base=/adama/ : links are paths (/adama/haifa?s=...) instead of hashes (#haifa?s=...). The host must serve index.html for /<base><slug>
# (see web/vercel.json and the Cloudflare route of the personal site). Without it the site works from any static folder (hash links).
base = None
for a_ in list(sys.argv[1:]):
    if a_.startswith('--base='):
        base = a_[len('--base='):]
        sys.argv.remove(a_)
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, 'dist', 'site')
args = sys.argv[2:]
if not args:
    with open(os.path.join(here, 'cities.txt'), encoding='utf-8') as f:
        args = [l.strip() for l in f if l.strip() and not l.startswith('#')]
os.makedirs(os.path.join(out, 'data'), exist_ok=True)
index = []
for arg in args:
    arg = arg if os.path.isabs(arg) else os.path.normpath(os.path.join(root, arg))
    if not os.path.exists(arg.partition(':')[0] if not (len(arg) > 1 and arg[1] == ':') else arg):
        print('skipping (file not found yet):', arg)
        continue
    path, _, crop = arg.partition(':') if not (len(arg) > 1 and arg[1] == ':') else (arg, '', '')
    if crop:
        lat, lon, r = crop.split(',')
        d = prep.load(path, lat=float(lat), lon=float(lon), R=int(r))
    else:
        d = prep.load(path)
    hp = os.path.join(os.path.dirname(path), 'heat.json')
    if os.path.exists(hp):
        d['heat'] = json.load(open(hp))
    ap = os.path.join(os.path.dirname(path), 'air.json')
    if os.path.exists(ap):
        d['air'] = json.load(open(ap, encoding='utf-8'))
    tp = os.path.join(os.path.dirname(path), 'towers.json')
    if os.path.exists(tp):
        d['towers'] = json.load(open(tp, encoding='utf-8'))
    np_ = os.path.join(os.path.dirname(path), 'neighborhoods.json')
    if os.path.exists(np_):
        d['hoods'] = json.load(open(np_, encoding='utf-8'))['hoods']
    with open(os.path.join(out, 'data', d['slug'] + '.json'), 'w', encoding='utf-8') as f:
        json.dump(d, f, separators=(',', ':'), ensure_ascii=False)
    has = [k for k in ('heat', 'air', 'towers', 'hoods') if k in d]   # layers available for this city (icons in the menu)
    bb = d['bbox']   # [lon0, lat0, lon1, lat1]: centre of the city, for the world map
    index.append({'slug': d['slug'], 'name': d['name'].split(',')[0], 'has': has, 'll': [round((bb[1] + bb[3]) / 2, 2), round((bb[0] + bb[2]) / 2, 2)]})
with open(os.path.join(out, 'data', 'cities.json'), 'w', encoding='utf-8') as f:
    json.dump(index, f, ensure_ascii=False)
bundle = os.path.join(root, 'dist', 'bundle.js')
os.makedirs(os.path.dirname(bundle), exist_ok=True)
subprocess.run([os.path.join(root, 'node_modules', '.bin', 'esbuild'), os.path.join(here, 'src', 'app.js'),
                '--bundle', '--minify', '--format=esm', '--target=es2022', '--outfile=' + bundle,
                '--log-level=warning'], check=True)
js = open(bundle, encoding='utf-8').read()
assert '</script>' not in js
head = open(os.path.join(here, 'src', 'template.html'), encoding='utf-8').read()
head = head.replace('__LOGO_STROKES__', open(os.path.join(here, 'src', 'logostrokes.json'), encoding='utf-8').read())   # pen strokes of the loader (scripts/logo_strokes.py)
if base:
    head = head.replace('<head>', '<head><base href="%s"><meta name="adama-routing" content="path">' % base, 1)
with open(os.path.join(out, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(head + '<script type="module">' + js + '</script></body></html>')
print('wrote', out)
