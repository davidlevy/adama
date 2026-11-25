// The map view of the city menu: a canvas with the land and the markers, and a popover (the name of a city, or the list of a group).
import {useEffect, useRef, useState} from 'preact/hooks';
import {CTRY, CODE} from '../../data/countries';
import {NAMES} from '../../data/names';
import {cellSize, clusterCities, drawFrame, drawLand, mapHeight, nearestCluster, type Cluster} from './mapDrawing';
import {useLang, useT} from '../store';
import type {CityEntry, MenuApi} from './types';

interface Props {
  api: MenuApi;
  active: boolean;          // the map is on screen: only then is it drawn
}

interface Popover {
  cluster: Cluster;
  list: boolean;            // a group (click) or a single city (hover)
}

export function WorldMap({api, active}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const hovered = useRef<Cluster | null>(null);
  const [popover, setPopover] = useState<Popover | null>(null);
  const [width, setWidth] = useState(0);
  const clusters = useRef<Cluster[]>([]);
  if (!clusters.current.length) clusters.current = clusterCities(api.cities);
  const lang = useLang(), T = useT();
  const nameOf = (c: CityEntry) => NAMES[c.slug]?.[lang] || c.name.split(',')[0];
  const countryOf = (k: Cluster) => CTRY[lang][CODE[k.members[0].slug] || 'IL'];

  // the width of the map follows its box (it is 0 while the list view hides it)
  useEffect(() => {
    if (!active || !box.current) return;
    setWidth(box.current.clientWidth);
    setPopover(null);
  }, [active]);

  // draw while the map is on screen
  useEffect(() => {
    const cv = canvas.current;
    if (!active || !cv || !width) return;
    const dpr = Math.min(2, devicePixelRatio || 1), ctx = cv.getContext('2d'), reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
    if (!ctx) return;
    cv.width = Math.round(width * dpr); cv.height = Math.round(mapHeight(width) * dpr);
    cv.style.width = `${width}px`; cv.style.height = `${mapHeight(width)}px`;
    const land = drawLand(width, dpr);
    let raf = 0;
    const loop = (ms: number) => {
      drawFrame(ctx, land, width, dpr, clusters.current, api.current.slug, hovered.current, ms / 1000, reduce);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, width]);

  const pick = (e: PointerEvent | MouseEvent) => {
    const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    return nearestCluster(clusters.current, width, e.clientX - r.left, e.clientY - r.top);
  };
  const onMove = (e: PointerEvent) => {
    const k = pick(e);
    hovered.current = k;
    (e.currentTarget as HTMLElement).style.cursor = k ? 'pointer' : '';
    if (popover?.list) return;                       // an open group stays until a click elsewhere
    setPopover(k ? {cluster: k, list: false} : null);
  };
  const onLeave = () => { hovered.current = null; if (!popover?.list) setPopover(null); };
  const onClick = (e: MouseEvent) => {
    const k = pick(e);
    if (!k) { setPopover(null); return; }
    if (k.members.length === 1) api.go(k.members[0].slug);
    else { hovered.current = k; setPopover({cluster: k, list: true}); }
  };

  // where the popover sits: over its marker, kept inside the map
  const place = (p: Popover) => {
    const cell = cellSize(width), m = p.list ? Math.min(210, width / 2) : 80;
    return {left: `${Math.min(width - m, Math.max(m, p.cluster.x * cell))}px`, top: `${p.cluster.y * cell}px`};
  };

  return (
    <div class="cmm" ref={box}>
      <canvas ref={canvas} role="img" aria-label={T('vmap')} onPointerMove={onMove} onPointerLeave={onLeave} onClick={onClick} />
      <aside hidden={!popover} class={popover?.list ? 'lst' : ''} style={popover ? place(popover) : undefined}>
        {popover && (popover.list
          ? <>
              <span>{countryOf(popover.cluster)}</span>
              {popover.cluster.members.slice().sort((a, b) => nameOf(a).localeCompare(nameOf(b), lang)).map(c =>
                <button key={c.slug} class={c.slug === api.current.slug ? 'on' : ''} onClick={() => api.go(c.slug)}>{nameOf(c)}</button>)}
            </>
          : <span>{nameOf(popover.cluster.members[0])} · {countryOf(popover.cluster)}</span>)}
      </aside>
    </div>
  );
}
