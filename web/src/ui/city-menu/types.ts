/** A city of the index (data/cities.json). `ll` is its centre [lat, lon]. */
export interface CityEntry {
  slug: string;
  name: string;
  has?: string[]; // layers the city has: heat, air, rain, mobile, towers, hoods
  ll?: [number, number];
}

/** What the page gives the menu. The menu never touches the scene. */
export interface MenuApi {
  cities: CityEntry[];
  current: CityEntry; // the city on screen
  go(slug: string): void; // opens a city
}
