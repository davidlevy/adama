// The list view of the city menu: the cities grouped by country (the groups flow in columns), filtered by what is typed in the search field.
import {CTRY, CODE, CO} from '../../data/countries';
import {IC, LT} from '../../data/icons';
import {NAMES} from '../../data/names';
import {LANGS} from '../../types';
import type {CityEntry, MenuApi} from './types';

/** Lower case and without accents, to compare what is typed with the names. */
export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** A city matches when one of its names (or its country) has a word that starts with what was typed:
 *  "t" finds Tel Aviv and Tiberias, "ra" finds Ra'anana and Rafah... `query` is already normalized. */
export function matches(c: CityEntry, query: string, lang: 'fr' | 'en' | 'he'): boolean {
  if (!query) return true;
  const names = [...LANGS.map(l => NAMES[c.slug]?.[l]), c.name.split(',')[0], CO(c.slug)[lang]];
  return names.some(n => n && normalize(n).split(/[\s\-’'.]+/).some(w => w.startsWith(query)));
}

interface Props {
  api: MenuApi;
  query: string;
  onPick(): void;           // a city was chosen (the menu may close)
}

export function CityList({api, query, onPick}: Props) {
  const lang = api.getLang(), T = api.T, q = normalize(query.trim());
  const nameOf = (c: CityEntry) => NAMES[c.slug]?.[lang] || c.name.split(',')[0];

  const byCountry = new Map<string, CityEntry[]>();
  for (const c of api.cities) {
    if (!matches(c, q, lang)) continue;
    const code = CODE[c.slug] || 'IL';
    byCountry.set(code, [...(byCountry.get(code) ?? []), c]);
  }
  const codes = [...byCountry.keys()].sort((a, b) => CTRY[lang][a].localeCompare(CTRY[lang][b], lang));
  if (!codes.length) return <div class="cmg"><p class="cmn0">{T('nocity')}</p></div>;

  return (
    <div class="cmg">
      {codes.map(code => {
        const cities = (byCountry.get(code) as CityEntry[]).slice().sort((a, b) => nameOf(a).localeCompare(nameOf(b), lang));
        return (
          <section key={code}>
            <h4>{CTRY[lang][code]} · {cities.length}</h4>
            <ul>
              {cities.map(c => (
                <li key={c.slug} data-slug={c.slug} role="option" class={c.slug === api.current.slug ? 'on' : ''}
                    onClick={() => { api.go(c.slug); onPick(); }}>
                  <span class="cn2">{nameOf(c)}</span>
                  <i class="ly">{(c.has ?? []).map(x => <b key={x} title={T(LT[x])} dangerouslySetInnerHTML={{__html: IC[x]}} />)}</i>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
