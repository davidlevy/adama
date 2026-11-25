// Types shared by the modules of the page.
export type Lang = 'fr' | 'en' | 'he';
export const LANGS: readonly Lang[] = ['fr', 'en', 'he'];
export type PerLang<T = string> = Record<Lang, T>;
