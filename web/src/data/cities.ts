// Name of a city in a language: the names of web/cities.json, else the geocoder name of its data file.
import type { Lang, PerLang } from '../types';
export const cityName = (c: { name: string; names?: PerLang }, lang: Lang): string =>
  c.names?.[lang] || c.name.split(',')[0];
