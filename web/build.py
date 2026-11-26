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
import json, subprocess, sys, os, re
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
    rp = os.path.join(os.path.dirname(path), 'rain.json')
    if os.path.exists(rp):
        d['rain'] = json.load(open(rp, encoding='utf-8'))
    mp = os.path.join(os.path.dirname(path), 'mobile.json')
    if os.path.exists(mp):
        d['mobile'] = json.load(open(mp, encoding='utf-8'))
    tp = os.path.join(os.path.dirname(path), 'towers.json')
    if os.path.exists(tp):
        d['towers'] = json.load(open(tp, encoding='utf-8'))
    np_ = os.path.join(os.path.dirname(path), 'neighborhoods.json')
    if os.path.exists(np_):
        d['hoods'] = json.load(open(np_, encoding='utf-8'))['hoods']
    with open(os.path.join(out, 'data', d['slug'] + '.json'), 'w', encoding='utf-8') as f:
        json.dump(d, f, separators=(',', ':'), ensure_ascii=False)
    has = [k for k in ('heat', 'air', 'rain', 'mobile', 'towers', 'hoods') if k in d]   # layers available for this city (icons in the menu)
    bb = d['bbox']   # [lon0, lat0, lon1, lat1]: centre of the city, for the world map
    index.append({'slug': d['slug'], 'name': d['name'].split(',')[0], 'has': has, 'll': [round((bb[1] + bb[3]) / 2, 2), round((bb[0] + bb[2]) / 2, 2)]})
with open(os.path.join(out, 'data', 'cities.json'), 'w', encoding='utf-8') as f:
    json.dump(index, f, ensure_ascii=False)
bundle = os.path.join(root, 'dist', 'bundle.js')
os.makedirs(os.path.dirname(bundle), exist_ok=True)
subprocess.run([os.path.join(root, 'node_modules', '.bin', 'esbuild'), os.path.join(here, 'src', 'app.ts'),
                '--bundle', '--minify', '--jsx=automatic', '--jsx-import-source=preact', '--format=esm', '--target=es2022', '--outfile=' + bundle,
                '--log-level=warning'], check=True)
js = open(bundle, encoding='utf-8').read()
assert '</script>' not in js
# the stylesheet: src/css/*.css bundled by esbuild (index.css lists the files in cascade order) and inlined into the page
css_out = os.path.join(root, 'dist', 'global.css')
subprocess.run([os.path.join(root, 'node_modules', '.bin', 'esbuild'), os.path.join(here, 'src', 'css', 'index.css'),
                '--bundle', '--minify', '--outfile=' + css_out, '--log-level=warning'], check=True)
head = open(os.path.join(here, 'src', 'index.html'), encoding='utf-8').read()
# the markup is assembled from src/html/*.html (one fragment per component, in DOM order, see index.html); the loading screen script is src/loader.js
head = re.sub(r'<!--include:([\w-]+)-->', lambda m: open(os.path.join(here, 'src', 'html', m.group(1) + '.html'), encoding='utf-8').read(), head)
loader_out = os.path.join(root, 'dist', 'loader.js')
subprocess.run([os.path.join(root, 'node_modules', '.bin', 'esbuild'), os.path.join(here, 'src', 'loader.ts'),
                '--bundle', '--minify', '--format=iife', '--outfile=' + loader_out, '--log-level=warning'], check=True)
assert head.count('<!--script:loader-->') == 1
head = head.replace('<!--script:loader-->', '<script>' + open(loader_out, encoding='utf-8').read().strip() + '</script>')
assert head.count('/*CSS*/') == 1
css = open(css_out, encoding='utf-8').read()
mod_css = os.path.join(root, 'dist', 'bundle.css')   # extracted by esbuild from the CSS modules imported in the JS (src/ui/*.module.css)
if os.path.exists(mod_css):
    mod = open(mod_css, encoding='utf-8').read()
    # esbuild shortens the local class names (a, b, ...): make sure none of them equals a class of the global CSS
    clash = set(re.findall(r'\.([A-Za-z_][\w-]*)', mod)) & set(re.findall(r'\.([A-Za-z_][\w-]*)', re.sub(r'url\([^)]*\)', '', css)))
    assert not clash, 'CSS module class names collide with global classes: %s' % sorted(clash)
    css += mod
head = head.replace('/*CSS*/', css)
if base:
    head = head.replace('<head>', '<head><base href="%s"><meta name="adama-routing" content="path">' % base, 1)
with open(os.path.join(out, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(head + '<script type="module">' + js + '</script></body></html>')
og = os.path.join(here, 'og.png')   # social share image (1200x630), served at /og.png
if os.path.exists(og):
    import shutil
    shutil.copyfile(og, os.path.join(out, 'og.png'))
print('wrote', out)
