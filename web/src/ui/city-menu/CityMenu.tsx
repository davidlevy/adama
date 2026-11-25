// The city menu of the top bar: the name of the city on screen, and a panel with a search field, a list of the cities grouped by country
// and a pixel world map (a list / map switch). All the state lives here: open or closed, the view, what is typed.
import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { CO } from '../../data/countries';
import { NAMES } from '../../data/names';
import { CityList, matches, normalize } from './CityList';
import { WorldMap } from './WorldMap';
import { useLang, useT } from '../store';
import type { MenuApi } from './types';

type View = 'list' | 'map';
const VIEW_KEY = 'adama-cmview'; // the last view is remembered; the map is the default

const readView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'map';
  } catch {
    return 'map';
  }
};
const saveView = (v: View) => {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    /* private mode */
  }
};

function CityMenu({ api }: { api: MenuApi }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>(readView);
  const [query, setQuery] = useState('');
  const [atEnd, setAtEnd] = useState(true);
  const panel = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const lang = useLang(),
    T = useT();
  // choosing the city already on screen only closes the menu
  const menuApi: MenuApi = {
    ...api,
    go: (slug) => {
      if (slug === api.current.slug) setOpen(false);
      else api.go(slug);
    },
  };
  const name = NAMES[api.current.slug]?.[lang] || api.current.name.split(',')[0];

  // a click anywhere else, or Escape, closes the menu
  useEffect(() => {
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    addEventListener('click', close);
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('click', close);
      removeEventListener('keydown', onKey);
    };
  }, []);

  // the page behind must not scroll while the menu is open
  useEffect(() => {
    document.body.classList.toggle('cm-open', open);
    return () => document.body.classList.remove('cm-open');
  }, [open]);

  // opening: empty search, and the keyboard goes to it on devices with a mouse
  useEffect(() => {
    if (!open) return;
    setQuery('');
    if (!matchMedia('(hover:hover)').matches) return;
    const id = setTimeout(() => search.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [open]);

  // a soft fade at the bottom of the panel says there is more to scroll
  const updateFade = () => {
    const p = panel.current;
    if (p) setAtEnd(p.scrollHeight - p.scrollTop - p.clientHeight < 8);
  };
  useEffect(updateFade, [open, view, query, lang]);

  const typing = (value: string) => {
    setQuery(value);
    if (view === 'map') setView('list'); // typing shows the list (not remembered as the choice)
    if (panel.current) panel.current.scrollTop = 0;
  };
  const choose = (v: View) => {
    setView(v);
    saveView(v);
  };
  const onSearchKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    const first = api.cities.find((c) => matches(c, normalize(query.trim()), lang));
    if (first) api.go(first.slug);
  };

  return (
    <div class={open ? 'cm open' : 'cm'} id="cm">
      <button
        id="cmb"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e: MouseEvent) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <span id="cmn">
          <span class="cn">{name}</span> <span class="cc">{CO(api.current.slug)[lang]}</span>
        </span>
        <svg width="10" height="6" viewBox="0 0 10 6">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.3" />
        </svg>
      </button>
      <div
        class="cml"
        id="cml"
        role="listbox"
        data-view={view}
        ref={panel}
        onClick={(e: MouseEvent) => e.stopPropagation()}
        onScroll={updateFade}
      >
        <div class="cmt">
          <input
            class="cms"
            type="search"
            autocomplete="off"
            spellcheck={false}
            ref={search}
            value={query}
            placeholder={T('find')}
            onInput={(e: Event) => typing((e.currentTarget as HTMLInputElement).value)}
            onKeyDown={onSearchKey}
          />
          <div class="cmv">
            <button
              aria-pressed={view === 'list'}
              title={T('vlist')}
              aria-label={T('vlist')}
              onClick={() => choose('list')}
            >
              <svg viewBox="0 0 14 14">
                <path d="M2 3.5h10M2 7h10M2 10.5h10" />
              </svg>
            </button>
            <button
              aria-pressed={view === 'map'}
              title={T('vmap')}
              aria-label={T('vmap')}
              onClick={() => choose('map')}
            >
              <svg viewBox="0 0 14 14">
                <circle cx="7" cy="7" r="5.2" />
                <path d="M1.8 7h10.4M7 1.8c-2.2 2.4-2.2 8 0 10.4M7 1.8c2.2 2.4 2.2 8 0 10.4" />
              </svg>
            </button>
          </div>
        </div>
        <WorldMap api={menuApi} active={open && view === 'map'} />
        <CityList api={menuApi} query={query} onPick={() => setOpen(false)} />
        <div class={atEnd ? 'cmf end' : 'cmf'} aria-hidden="true" />
      </div>
    </div>
  );
}

export const mountCityMenu = (root: HTMLElement, api: MenuApi) => render(<CityMenu api={api} />, root);
