/**
 * Enlaces para abrir un título dentro de cada plataforma. Sin dependencias de React Native.
 *
 * MDBList dice en qué plataformas está, pero no da enlaces. Wikidata guarda el
 * identificador del título en Netflix, Disney+, HBO Max, Apple TV, Prime Video…: con él
 * se arma el enlace exacto (en el teléfono abre la app de la plataforma). Si Wikidata no
 * lo tiene, el enlace busca el título dentro de la plataforma.
 */

/** Identificadores de plataforma guardados en Wikidata, por propiedad (p. ej. P1874 → "81458416"). */
export type WatchIds = Record<string, string>;

export type WatchLinkKind = 'exact' | 'search' | 'home';

export interface WatchLink {
  url: string;
  kind: WatchLinkKind;
}

interface Exact {
  prop: string;
  url: (id: string) => string;
  /** Solo para películas o solo para series (por defecto, ambas). */
  only?: 'movie' | 'series';
}

interface LinkRule {
  exact: Exact[];
  /** Búsqueda dentro de la plataforma; sin ella se abre su portada. */
  search?: (query: string) => string;
  home: string;
}

const q = encodeURIComponent;
const appleTv: LinkRule = {
  exact: [
    { prop: 'P9586', url: (id) => `https://tv.apple.com/movie/${id}`, only: 'movie' },
    { prop: 'P9751', url: (id) => `https://tv.apple.com/show/${id}`, only: 'series' },
  ],
  search: (s) => `https://tv.apple.com/search?term=${q(s)}`,
  home: 'https://tv.apple.com/',
};
const amazon = {
  gti: { prop: 'P14440', url: (id: string) => `https://www.primevideo.com/detail/${id}` },
  asin: { prop: 'P8055', url: (id: string) => `https://www.amazon.com/gp/video/detail/${id}` },
};

/** Por clave de plataforma (la de platforms.ts). Formatos de enlace tomados de Wikidata (P1630). */
const RULES: Record<string, LinkRule> = {
  netflix: {
    exact: [{ prop: 'P1874', url: (id) => `https://www.netflix.com/title/${id}` }],
    search: (s) => `https://www.netflix.com/search?q=${q(s)}`,
    home: 'https://www.netflix.com/',
  },
  prime: {
    exact: [amazon.gti, amazon.asin],
    search: (s) => `https://www.primevideo.com/search/?phrase=${q(s)}`,
    home: 'https://www.primevideo.com/',
  },
  // Disney+ no tiene una dirección de búsqueda pública: sin ID se abre su portada.
  disney: {
    exact: [
      { prop: 'P7595', url: (id) => `https://www.disneyplus.com/movies/wd/${id}`, only: 'movie' },
      { prop: 'P7596', url: (id) => `https://www.disneyplus.com/series/wp/${id}`, only: 'series' },
    ],
    home: 'https://www.disneyplus.com/',
  },
  max: {
    exact: [{ prop: 'P8298', url: (id) => `https://play.hbomax.com/${id}` }],
    search: (s) => `https://play.hbomax.com/search?q=${q(s)}`,
    home: 'https://play.hbomax.com/',
  },
  appletv: appleTv,
  'apple-store': appleTv,
  paramount: {
    exact: [],
    search: (s) => `https://www.paramountplus.com/search/?q=${q(s)}`,
    home: 'https://www.paramountplus.com/',
  },
  hulu: {
    exact: [
      { prop: 'P6466', url: (id) => `https://www.hulu.com/movie/${id}`, only: 'movie' },
      { prop: 'P6467', url: (id) => `https://www.hulu.com/series/${id}`, only: 'series' },
    ],
    search: (s) => `https://www.hulu.com/search?q=${q(s)}`,
    home: 'https://www.hulu.com/',
  },
  peacock: {
    exact: [{ prop: 'P11815', url: (id) => `https://www.peacocktv.com/stream-${id}` }],
    search: (s) => `https://www.peacocktv.com/search?q=${q(s)}`,
    home: 'https://www.peacocktv.com/',
  },
  crunchyroll: {
    exact: [],
    search: (s) => `https://www.crunchyroll.com/search?q=${q(s)}`,
    home: 'https://www.crunchyroll.com/',
  },
  mubi: {
    exact: [{ prop: 'P7299', url: (id) => `https://mubi.com/films/${id}`, only: 'movie' }],
    search: (s) => `https://mubi.com/search/films?query=${q(s)}`,
    home: 'https://mubi.com/',
  },
  vix: {
    exact: [],
    search: (s) => `https://vix.com/search?q=${q(s)}`,
    home: 'https://vix.com/',
  },
  'google-play': {
    exact: [{ prop: 'P6562', url: (id) => `https://play.google.com/store/movies/details?id=${id}`, only: 'movie' }],
    search: (s) => `https://play.google.com/store/search?q=${q(s)}&c=movies`,
    home: 'https://play.google.com/store/movies',
  },
  'amazon-video': {
    exact: [amazon.asin, amazon.gti],
    search: (s) => `https://www.amazon.com/s?k=${q(s)}&i=instant-video`,
    home: 'https://www.amazon.com/gp/video/storefront',
  },
  // En YouTube el ID de Wikidata suele ser el tráiler, no la película: se busca.
  youtube: {
    exact: [],
    search: (s) => `https://www.youtube.com/results?search_query=${q(s)}`,
    home: 'https://www.youtube.com/',
  },
};

/** Propiedades de Wikidata que hay que pedir para armar los enlaces exactos. */
export const WATCH_ID_PROPS: string[] = [
  ...new Set(Object.values(RULES).flatMap((r) => r.exact.map((e) => e.prop))),
];

/**
 * Enlace para ver `title` en la plataforma `platformKey`: exacto si Wikidata tiene su ID,
 * si no, una búsqueda dentro de la plataforma (o su portada). `null` si la plataforma no se conoce.
 */
export function watchLink(
  platformKey: string,
  title: string,
  ids: WatchIds | null | undefined,
  type: 'movie' | 'series' = 'movie',
): WatchLink | null {
  const rule = RULES[platformKey];
  if (!rule) return null;
  for (const e of rule.exact) {
    const id = ids?.[e.prop];
    if (id && (!e.only || e.only === type)) return { url: e.url(id), kind: 'exact' };
  }
  const query = title.trim();
  if (rule.search && query) return { url: rule.search(query), kind: 'search' };
  return { url: rule.home, kind: 'home' };
}

/**
 * Consulta SPARQL que trae, en una sola petición pequeña, los IDs de plataforma del título
 * con ese ID de IMDb. `wdt:` devuelve el valor vigente (el preferente si lo hay, nunca los obsoletos).
 */
export function watchIdsQuery(imdbID: string): string | null {
  if (!/^tt\d+$/.test(imdbID)) return null;
  const props = WATCH_ID_PROPS.map((p) => `wdt:${p}`).join(' ');
  return `SELECT ?p ?v WHERE { ?item wdt:P345 "${imdbID}" . VALUES ?p { ${props} } ?item ?p ?v . } LIMIT 60`;
}

/** Respuesta JSON del servicio SPARQL de Wikidata (solo lo que se usa). */
export interface SparqlResponse {
  results?: { bindings?: { p?: { value?: string }; v?: { value?: string } }[] };
}

/** Convierte la respuesta SPARQL en { P1874: "81458416", ... } (el primer valor de cada propiedad). */
export function parseWatchIds(response: SparqlResponse): WatchIds {
  const ids: WatchIds = {};
  for (const row of response.results?.bindings ?? []) {
    const prop = row.p?.value?.split('/').pop();
    const value = row.v?.value?.trim();
    if (prop && /^P\d+$/.test(prop) && value && !(prop in ids)) ids[prop] = value;
  }
  return ids;
}
