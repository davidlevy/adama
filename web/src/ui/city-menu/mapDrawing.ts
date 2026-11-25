// The pixel world of the city menu: the land as a grid of small squares, the cities as markers (the current one in white, the others in violet).
// Cities that are close together (Israel, Europe) form one cluster with its number. Pure drawing and geometry, no DOM state.
import {WORLD} from '../../worldmask';
import type {CityEntry} from './types';

/** Cities closer than this (in grid cells) share one marker. */
const MERGE_DISTANCE = 2.2;
/** A click or a hover finds the cluster within this many CSS pixels. */
export const PICK_RADIUS = 22;

export interface Cluster {
  x: number; y: number;           // centre, in grid cells (fractional)
  members: CityEntry[];
}

const land = atob(WORLD.bits);
const isLand = (x: number, y: number) =>
  x >= 0 && y >= 0 && x < WORLD.w && y < WORLD.h && ((land.charCodeAt((y * WORLD.w + x) >> 3) >> (7 - ((y * WORLD.w + x) & 7))) & 1) === 1;

const gridX = (c: CityEntry) => ((c.ll as [number, number])[1] + 180) / 360 * WORLD.w;
const gridY = (c: CityEntry) => (WORLD.latN - (c.ll as [number, number])[0]) / (WORLD.latN - WORLD.latS) * WORLD.h;

export function clusterCities(cities: CityEntry[]): Cluster[] {
  const clusters: Cluster[] = [];
  for (const c of cities) {
    if (!c.ll) continue;
    const near = clusters.find(k => Math.hypot(k.x - gridX(c), k.y - gridY(c)) < MERGE_DISTANCE);
    if (near) near.members.push(c); else clusters.push({x: gridX(c), y: gridY(c), members: [c]});
  }
  for (const k of clusters) {   // the marker sits at the middle of its cities
    k.x = k.members.reduce((a, c) => a + gridX(c), 0) / k.members.length;
    k.y = k.members.reduce((a, c) => a + gridY(c), 0) / k.members.length;
  }
  return clusters;
}

export const isCurrent = (k: Cluster, slug: string) => k.members.some(c => c.slug === slug);

/** Size of a grid cell in CSS pixels for a map `width` px wide. */
export const cellSize = (width: number) => width / WORLD.w;
export const mapHeight = (width: number) => cellSize(width) * WORLD.h;

/** The land alone, drawn once for a given width: a canvas to copy under the markers on every frame. */
export function drawLand(width: number, dpr: number): HTMLCanvasElement {
  const cell = cellSize(width), canvas = document.createElement('canvas');
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(mapHeight(width) * dpr);
  const g = canvas.getContext('2d');
  if (!g) throw new Error('2D canvas is not available');
  g.scale(dpr, dpr);
  for (let y = 0; y < WORLD.h; y++) for (let x = 0; x < WORLD.w; x++) {
    if (!isLand(x, y)) continue;
    const jitter = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
    const v = Math.round(52 + (y / WORLD.h) * 20 + jitter * 14);
    g.fillStyle = `rgb(${v},${v},${Math.round(v * 1.16)})`;
    const s = cell * .8;
    g.fillRect(x * cell + (cell - s) / 2, y * cell + (cell - s) / 2, s, s);
  }
  return canvas;
}

/** One frame: the land, the violet markers, then the white marker of the current city with its pulse. `t` is in seconds. */
export function drawFrame(ctx: CanvasRenderingContext2D, land: HTMLCanvasElement, width: number, dpr: number,
                          clusters: Cluster[], currentSlug: string, hovered: Cluster | null, t: number, reduceMotion: boolean): void {
  const cell = cellSize(width), height = mapHeight(width);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(land, 0, 0, width, height);
  const square = (x: number, y: number, s: number) => ctx.fillRect(x - s / 2, y - s / 2, s, s);
  const count = (k: Cluster, x: number, y: number, s: number, color: string) => {
    if (k.members.length < 2) return;
    ctx.fillStyle = color; ctx.font = '600 10px Geist,system-ui,sans-serif'; ctx.textBaseline = 'middle';
    ctx.fillText(String(k.members.length), x + s * .9 + 2, y - s * .5);
  };
  for (const k of clusters) {
    if (isCurrent(k, currentSlug)) continue;
    const x = k.x * cell, y = k.y * cell, s = cell * (1.1 + Math.min(1.6, (k.members.length - 1) * .3)), hot = k === hovered;
    ctx.fillStyle = `rgba(165,107,255,${hot ? .34 : .16})`; square(x, y, s * 2.4);
    ctx.fillStyle = `rgba(165,107,255,${hot ? .5 : .28})`; square(x, y, s * 1.6);
    ctx.fillStyle = hot ? '#c9a7ff' : '#a56bff'; square(x, y, s);
    count(k, x, y, s, 'rgba(255,255,255,.85)');
  }
  for (const k of clusters) {
    if (!isCurrent(k, currentSlug)) continue;
    const x = k.x * cell, y = k.y * cell, s = cell * (1.5 + Math.min(1.6, (k.members.length - 1) * .3));
    const phase = reduceMotion ? 0 : (t * .8) % 1, ring = s * (1.6 + Math.floor(phase * 5) * .55);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; square(x, y, s * 3.2);
    ctx.fillStyle = 'rgba(255,255,255,.28)'; square(x, y, s * 1.9);
    if (!reduceMotion) {
      ctx.strokeStyle = `rgba(255,255,255,${.55 * (1 - phase)})`; ctx.lineWidth = Math.max(1, cell * .45);
      ctx.strokeRect(x - ring / 2, y - ring / 2, ring, ring);
    }
    ctx.fillStyle = '#fff'; square(x, y, s);
    count(k, x, y, s, '#fff');
  }
}

/** The cluster under a point (CSS pixels, relative to the canvas), if any is within PICK_RADIUS. */
export function nearestCluster(clusters: Cluster[], width: number, px: number, py: number): Cluster | null {
  const cell = cellSize(width);
  let best: Cluster | null = null, bestDistance = PICK_RADIUS;
  for (const k of clusters) {
    const d = Math.hypot(k.x * cell - px, k.y * cell - py);
    if (d < bestDistance) { bestDistance = d; best = k; }
  }
  return best;
}
