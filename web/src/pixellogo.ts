// The pixelated Earth (Europe, Africa, Arabia) that unrolls into the written Caveat name: shown in the About dialog each time it opens.
// The globe flattens into a band, each pixel goes to a pixel of the letters (paired left to right), then the pixels get finer
// until the real logo. Ported from the first loading screen.
import { EARTH_MASK } from './data/earthmask';

const MW = 180,
  MH = 68,
  DISC_R = 31; // the Earth mask is 180 x 68 bits, the globe is the disc of radius 31
const DURATION = 1800; // ms

type Host = HTMLElement & { __stop?: () => void };
type Pixel = [x: number, y: number, v: number]; // a lit pixel of the coarse grid and its brightness
type Pair = [sx: number, sy: number, sv: number, tx: number, ty: number, tv: number]; // an Earth pixel and the letter pixel it flows to

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (u: number) => Math.min(1, Math.max(0, u));
const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const hash = (x: number, y: number) => {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const grey = (v: number) => `rgb(${Math.round(v)},${Math.round(v)},${Math.round(v * 1.01)})`;

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  return [canvas, ctx];
}

/** The pixels (RGBA) of `src` scaled down to sw x sh. */
function downscale(src: HTMLCanvasElement, sw: number, sh: number): Uint8ClampedArray {
  const [, ctx] = makeCanvas(sw, sh);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, sw, sh);
  return ctx.getImageData(0, 0, sw, sh).data;
}

/** The written logo: the real Caveat text on a w x h canvas. */
function logoCanvas(fs: number): HTMLCanvasElement {
  const probe = makeCanvas(1, 1)[1];
  probe.font = `500 ${fs}px Caveat`;
  const w = Math.ceil(probe.measureText('Adama').width) + Math.round(fs * 0.3),
    h = Math.round(fs * 1.25);
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.font = `500 ${fs}px Caveat`;
  ctx.fillStyle = '#e4e4e7';
  ctx.fillText('Adama', Math.round(fs * 0.15), Math.round(fs * 0.88));
  return canvas;
}

/** The Earth on a w x h canvas: the land mask scaled to the height of the logo and centred. */
function earthCanvas(w: number, h: number): HTMLCanvasElement {
  const [mask, mctx] = makeCanvas(MW, MH);
  const image = mctx.createImageData(MW, MH),
    raw = atob(EARTH_MASK);
  for (let y = 0; y < MH; y++)
    for (let x = 0; x < MW; x++) {
      const n = y * MW + x,
        k = n * 4;
      const land = (raw.charCodeAt(n >> 3) >> (7 - (n & 7))) & 1;
      const disc = (x + 0.5 - MW / 2) ** 2 + (y + 0.5 - MH / 2) ** 2 <= DISC_R * DISC_R;
      image.data[k] = image.data[k + 1] = image.data[k + 2] = land ? 235 : disc ? 70 : 0;
      image.data[k + 3] = 255;
    }
  mctx.putImageData(image, 0, 0);
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  const s = h / MH;
  ctx.drawImage(mask, (w - MW * s) / 2, 0, MW * s, MH * s);
  return canvas;
}

/** Plays the animation in `host` (replacing what it holds); a new call stops the one that is still running. `size` is the font size in px. */
export async function playPixelLogo(host: Host | null, size = 64): Promise<void> {
  try {
    await run(host, size);
  } catch (e) {
    if (host) {
      host.__stop?.();
      host.textContent = 'Adama';
    }
    console.warn('pixel logo unavailable:', e);
  } // no 2D canvas: the plain name
}

async function run(host: Host | null, size: number): Promise<void> {
  if (!host) return;
  host.__stop?.();
  let alive = true;
  host.__stop = () => {
    alive = false;
  };
  host.textContent = '';
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  try {
    await document.fonts.load('500 100px Caveat', 'Adama');
  } catch {
    /* the fallback font is fine */
  }
  if (!alive) return;

  const dpr = Math.min(2, devicePixelRatio || 1);
  const logo = logoCanvas(Math.round(size * dpr)),
    w = logo.width,
    h = logo.height;
  const [view, vctx] = makeCanvas(w, h);
  view.style.cssText = `width:${w / dpr}px;height:${h / dpr}px;display:block`;
  view.setAttribute('role', 'img');
  view.setAttribute('aria-label', 'Adama');
  host.appendChild(view);
  if (reduce) {
    vctx.drawImage(logo, 0, 0);
    return;
  }

  const earth = earthCanvas(w, h);
  const [stage, sctx] = makeCanvas(w, h); // the pixelated logo of the last step, cross-faded into the real one

  // `px` = size of a pixel, `p` = share of the Earth already replaced by the logo
  const render = (px: number, p: number) => {
    vctx.clearRect(0, 0, w, h);
    if (px === 1 && p === 1) {
      vctx.drawImage(logo, 0, 0);
      return;
    }
    const sw = Math.max(1, Math.ceil(w / px)),
      sh = Math.max(1, Math.ceil(h / px));
    const A = downscale(earth, sw, sh),
      B = downscale(logo, sw, sh),
      maxd = Math.hypot(sw / 2, sh / 2);
    for (let y = 0; y < sh; y++)
      for (let x = 0; x < sw; x++) {
        const k = (y * sw + x) * 4;
        const thr =
          (Math.hypot(x + 0.5 - sw / 2, y + 0.5 - sh / 2) / maxd) * 0.72 +
          hash(Math.floor((x * px) / (8 * dpr)), Math.floor((y * px) / (8 * dpr))) * 0.28;
        const v = p > thr ? (B[k + 3] / 255) * 228 : A[k] * 0.9;
        if (v > 2) {
          vctx.fillStyle = grey(v);
          vctx.fillRect(x * px, y * px, px, px);
        }
      }
  };

  // The Earth flattens into a band, then each pixel of it goes to a pixel of the letters.
  const px0 = Math.max(2, Math.round((5 * dpr * size) / 112)),
    gw = Math.ceil(w / px0),
    gh = Math.ceil(h / px0);
  const A0 = downscale(earth, gw, gh),
    B0 = downscale(logo, gw, gh);
  const source: Pixel[] = [],
    target: Pixel[] = [];
  for (let x = 0; x < gw; x++)
    for (let y = 0; y < gh; y++) {
      const k = (y * gw + x) * 4;
      if (A0[k] > 20) source.push([x, y, A0[k] * 0.9]);
      if (B0[k + 3] > 90) target.push([x, y, (B0[k + 3] / 255) * 228]);
    }
  if (!source.length || !target.length) {
    vctx.drawImage(logo, 0, 0);
    return;
  }
  const n = Math.max(source.length, target.length),
    pairs: Pair[] = [];
  for (let i = 0; i < n; i++) {
    const s = source[Math.floor((i * source.length) / n)],
      q = target[Math.floor((i * target.length) / n)];
    pairs.push([s[0], s[1], s[2], q[0], q[1], q[2]]);
  }

  const t0 = performance.now(),
    gcx = gw / 2,
    gcy = gh / 2,
    SX = (gw * 0.88) / ((2 * 0.456 * h) / px0),
    SY = 0.16;
  let last = '';
  const frame = (now: number) => {
    if (!alive) return;
    const u = Math.min(1, (now - t0) / DURATION);
    if (u >= 0.8) {
      // the pixels get finer, then cross-fade into the real logo
      const t = (u - 0.8) / 0.2,
        px = Math.max(1, Math.round(Math.exp(lerp(Math.log(px0), 0, easeInOut(t)))));
      if (`${px}:r` !== last) {
        last = `${px}:r`;
        render(px, 1);
        sctx.clearRect(0, 0, w, h);
        sctx.drawImage(view, 0, 0);
      }
      const a = easeInOut(t);
      vctx.clearRect(0, 0, w, h);
      vctx.globalAlpha = a;
      vctx.drawImage(logo, 0, 0);
      vctx.globalAlpha = 1 - a;
      vctx.drawImage(stage, 0, 0);
      vctx.globalAlpha = 1;
    } else {
      // the globe flattens (f1), then each pixel flies to its letter pixel (f2)
      const f1 = easeInOut(clamp01((u - 0.06) / 0.36)),
        f2 = easeInOut(clamp01((u - 0.38) / 0.4));
      vctx.clearRect(0, 0, w, h);
      for (const q of pairs) {
        const x = lerp(lerp(q[0], gcx + (q[0] - gcx) * SX, f1), q[3], f2),
          y = lerp(lerp(q[1], gcy + (q[1] - gcy) * SY, f1), q[4], f2);
        vctx.fillStyle = grey(Math.round(lerp(q[2], q[5], f2)));
        vctx.fillRect(Math.round(x) * px0, Math.round(y) * px0, px0, px0);
      }
    }
    if (u < 1) requestAnimationFrame(frame);
    else render(1, 1);
  };
  requestAnimationFrame(frame);
}
