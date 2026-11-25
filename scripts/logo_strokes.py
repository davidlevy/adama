"""Pen strokes of the loader name (web/src/logostrokes.json, inlined in the page by web/build.py): thin the glyphs of "Adama" (Caveat 500, 120 px) to a skeleton, trace it
into strokes in a handwriting order, keep the stroke radius at each point.

    python3 scripts/logo_strokes.py bitmap.txt [debug.png]

bitmap.txt is the alpha > 127 mask of the word drawn on a canvas in the browser: first line "W H", then H lines of W chars 0/1
(the word at x=18, baseline y=108, font 500 120px Caveat, canvas W x H = 319 x 156). The loader redraws the real text with the
same layout and uses the strokes only to reveal it, in the order a pen would write it.
"""
import math, sys, os, json
import numpy as np
from scipy import ndimage

lines = open(sys.argv[1]).read().split('\n')
W, H = map(int, lines[0].split())
B = np.array([[c == '1' for c in lines[1 + y]] for y in range(H)], bool)

def thin(img):   # Zhang-Suen
    img = img.copy()
    while True:
        ch = False
        for step in (0, 1):
            p = np.pad(img, 1)
            P2, P3, P4, P5, P6, P7, P8, P9 = (p[:-2, 1:-1], p[:-2, 2:], p[1:-1, 2:], p[2:, 2:], p[2:, 1:-1], p[2:, :-2], p[1:-1, :-2], p[:-2, :-2])
            nb = [P2, P3, P4, P5, P6, P7, P8, P9]
            Bn = sum(x.astype(int) for x in nb)
            A = sum(((nb[i] == 0) & (nb[(i + 1) % 8] == 1)).astype(int) for i in range(8))
            if step == 0: c1 = ~(P2 & P4 & P6); c2 = ~(P4 & P6 & P8)
            else: c1 = ~(P2 & P4 & P8); c2 = ~(P2 & P6 & P8)
            m = img & (Bn >= 2) & (Bn <= 6) & (A == 1) & c1 & c2
            if m.any(): img[m] = False; ch = True
        if not ch: return img

S = thin(B)
R = ndimage.distance_transform_edt(B)
N8 = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
def nbrs(pt, S=S):
    x, y = pt
    return [(x + dx, y + dy) for dx, dy in N8 if 0 <= x + dx < W and 0 <= y + dy < H and S[y + dy, x + dx]]

def prune(S, minlen):   # remove short spurs ending in a junction
    while True:
        pts = [(x, y) for y, x in zip(*np.nonzero(S))]
        removed = False
        for e in [p for p in pts if len(nbrs(p, S)) == 1]:
            chain = [e]; prev = None; cur = e
            while True:
                nx = [q for q in nbrs(cur, S) if q != prev and q not in chain]
                if len(nx) != 1: break
                prev, cur = cur, nx[0]; chain.append(cur)
                if len(chain) > minlen: break
            if len(chain) <= minlen and len(nbrs(chain[-1], S)) >= 3:
                for q in chain[:-1]: S[q[1], q[0]] = False
                removed = True
        if not removed: return S
def corners(S):   # drop staircase corner pixels (they read as fake junctions): p goes when its neighbours stay connected without it
    adj = lambda a, b: a != b and max(abs(a[0] - b[0]), abs(a[1] - b[1])) == 1
    while True:
        ch = False
        for y, x in list(zip(*np.nonzero(S))):
            p = (int(x), int(y)); n = nbrs(p, S)
            if len(n) < 2: continue
            for a in n:
                for b in n:
                    if a < b and adj(a, b) and all(c in (a, b) or adj(c, a) or adj(c, b) for c in n):
                        S[y, x] = False; ch = True; break
                if ch and not S[y, x]: break
        if not ch: return S
S = corners(S)
S = prune(S, 7)

pts = set((x, y) for y, x in zip(*np.nonzero(S)))
deg = {p: len(nbrs(p)) for p in pts}
nodes = {p for p in pts if deg[p] != 2}
if not nodes: nodes = {min(pts)}
edges = []; seen = set()
for n in sorted(nodes):
    for q in nbrs(n):
        if (n, q) in seen: continue
        chain = [n, q]; prev, cur = n, q
        while cur not in nodes:
            nx = [r for r in nbrs(cur) if r != prev]
            if not nx: break
            prev, cur = cur, nx[0]; chain.append(cur)
            if cur == n: break
        seen.add((n, q)); seen.add((chain[-1], chain[-2]))
        edges.append(chain)
uniq, keys = [], set()   # each edge was found from both ends
for e in edges:
    k = frozenset(e)
    if k not in keys: keys.add(k); uniq.append(e)
edges = uniq
# loops without any node (closed rings)
covered = {p for e in edges for p in e}
rest = pts - covered
while rest:
    s = min(rest); chain = [s]; prev = None; cur = s
    while True:
        nx = [r for r in nbrs(cur) if r != prev and r not in chain]
        if not nx: break
        prev, cur = cur, nx[0]; chain.append(cur)
    edges.append(chain); rest -= set(chain); nodes.add(s)

def ang(a, b): return math.atan2(b[1] - a[1], b[0] - a[0])
def turn(d0, d1): return abs((d1 - d0 + math.pi) % (2 * math.pi) - math.pi)
def dirat(chain, end, k=6):   # direction leaving `end` along chain
    c = chain if chain[0] == end else chain[::-1]
    return ang(c[0], c[min(k, len(c) - 1)])

used = [False] * len(edges); strokes = []
ends = lambda i: (edges[i][0], edges[i][-1])
while not all(used):
    free = [i for i in range(len(edges)) if not used[i]]
    cand = [(e, i) for i in free for e in set(ends(i))]
    deg1 = [c for c in cand if deg.get(c[0], 0) == 1] or cand
    start, i = min(deg1, key=lambda c: (c[0][0], c[0][1]))
    cur_pt, path, last_dir = start, [], None
    while True:
        opts = [j for j in range(len(edges)) if not used[j] and cur_pt in ends(j)]
        if not opts: break
        if last_dir is None: j = i if i in opts else opts[0]
        else: j = min(opts, key=lambda j: turn(last_dir, dirat(edges[j], cur_pt)))
        c = edges[j] if edges[j][0] == cur_pt else edges[j][::-1]
        used[j] = True; path += c if not path else c[1:]
        last_dir = ang(c[max(0, len(c) - 7)], c[-1]); cur_pt = c[-1]
    strokes.append(path)

def dp(pl, eps):   # Douglas-Peucker
    if len(pl) < 3: return pl
    a, b = pl[0], pl[-1]; dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy) or 1
    d = [abs(dy * (p[0] - a[0]) - dx * (p[1] - a[1])) / L for p in pl[1:-1]]
    k = int(np.argmax(d)) + 1
    return dp(pl[:k + 1], eps)[:-1] + dp(pl[k:], eps) if d[k - 1] > eps else [a, b]
out = []
for s in strokes:
    sp = dp(s, 1.1)
    out.append([[int(x), int(y), round(float(R[y, x]), 1)] for x, y in sp])
th = float(np.median([R[y, x] for y, x in zip(*np.nonzero(S))]))
dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web', 'src', 'logostrokes.json')
open(dest, 'w').write(json.dumps({'w': W, 'h': H, 'fs': 120, 'pad': 18, 'base': 108, 'strokes': out}, separators=(',', ':')))
print('strokes', len(out), 'points', sum(map(len, out)), 'median radius %.1f' % th)
if len(sys.argv) > 2:
    from PIL import Image, ImageDraw
    im = Image.new('RGB', (W * 3, H * 3), (0, 0, 0)); d = ImageDraw.Draw(im)
    for y, x in zip(*np.nonzero(B)): d.rectangle([x * 3, y * 3, x * 3 + 2, y * 3 + 2], fill=(50, 50, 55))
    tot = sum(len(s) for s in strokes); k = 0
    for s in strokes:
        for x, y in s:
            t = k / tot; k += 1
            d.rectangle([x * 3, y * 3, x * 3 + 2, y * 3 + 2], fill=(int(255 * t), int(220 * (1 - abs(t - .5) * 2)) + 30, int(255 * (1 - t))))
    im.save(sys.argv[2])
