// The state shared between the page and the Preact components, in a Zustand store (zustand/vanilla: no React needed).
// The page (app.ts) reads and writes it with ui.getState() / ui.subscribe(); the components use the hooks below.
// Add here what several components, or a component and the page, must share. What only one component needs stays in that component.
import { createStore } from 'zustand/vanilla';
import { useEffect, useRef, useState } from 'preact/hooks';
import { I18 } from '../i18n';
import { LANGS, type Lang } from '../types';

const LANG_KEY = 'city_lang';

/** The language to start with: the one chosen before (localStorage), else the one of the browser, else English. */
export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (LANGS.includes(saved as Lang)) return saved as Lang;
  } catch {
    /* private mode */
  }
  const browser = (navigator.language || 'en').slice(0, 2) as Lang;
  return LANGS.includes(browser) ? browser : 'en';
}

export interface UiState {
  lang: Lang;
  setLang(lang: Lang): void;
}

export const ui = createStore<UiState>((set) => ({
  lang: detectLang(),
  setLang: (lang) => set({ lang }),
}));

/** Preact hook: the part of the state chosen by `select`; the component renders again only when that part changes. */
export function useUi<T>(select: (state: UiState) => T): T {
  const selector = useRef(select);
  selector.current = select;
  const [value, setValue] = useState(() => select(ui.getState()));
  useEffect(() => {
    setValue(selector.current(ui.getState())); // a change between the first render and the subscription
    return ui.subscribe((state) => setValue(selector.current(state)));
  }, []);
  return value;
}

export const useLang = (): Lang => useUi((s) => s.lang);

/** Preact hook: the translation function of the current language. */
export function useT(): (key: string) => string {
  const lang = useLang();
  return (key) => I18[lang][key];
}
