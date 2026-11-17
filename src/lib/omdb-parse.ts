/**
 * Conversión de las respuestas crudas de OMDb a los tipos de CineRank.
 * Sin dependencias de React Native para poder probarse con Node.
 */
import type { Movie, MovieRatings, SearchHit } from './types';

export interface OmdbRating {
  Source: string;
  Value: string;
}

export interface OmdbSearchItem {
  Title: string;
  Year: string;
  imdbID: string;
  Type: string;
  Poster: string;
}

export interface OmdbSearchResponse {
  Response: 'True' | 'False';
  Search?: OmdbSearchItem[];
  totalResults?: string;
  Error?: string;
}

export interface OmdbMovieResponse {
  Response: 'True' | 'False';
  Error?: string;
  Title?: string;
  Year?: string;
  Rated?: string;
  Released?: string;
  Runtime?: string;
  Genre?: string;
  Director?: string;
  Actors?: string;
  Plot?: string;
  Language?: string;
  Country?: string;
  Awards?: string;
  Poster?: string;
  Ratings?: OmdbRating[];
  imdbRating?: string;
  imdbVotes?: string;
  imdbID?: string;
  Type?: string;
}

/** OMDb usa "N/A" para los campos vacíos. */
export function clean(value: string | undefined | null): string | null {
  if (value == null) return null;
  const v = value.trim();
  return v === '' || v === 'N/A' ? null : v;
}

function toNumber(raw: string | null): number | null {
  if (raw == null) return null;
  const n = Number(raw.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** "7.8" o "7.8/10" → 7.8 */
export function parseImdbRating(raw: string | null | undefined): number | null {
  const v = clean(raw);
  if (v == null) return null;
  const n = toNumber(v.split('/')[0]);
  return n != null && n >= 0 && n <= 10 ? n : null;
}

/** "1,234,567" → 1234567 */
export function parseVotes(raw: string | null | undefined): number | null {
  const n = toNumber(clean(raw));
  return n != null && n >= 0 ? Math.round(n) : null;
}

/** "93%" → 93 */
export function parsePercent(raw: string | null | undefined): number | null {
  const v = clean(raw);
  if (v == null) return null;
  const n = toNumber(v.replace('%', ''));
  return n != null && n >= 0 && n <= 100 ? n : null;
}

/** "142 min" → 142 */
export function parseRuntime(raw: string | null | undefined): number | null {
  const v = clean(raw);
  if (v == null) return null;
  const match = v.match(/(\d+)\s*min/i);
  if (match) return Number(match[1]);
  const hours = v.match(/(\d+)\s*h/i);
  return hours ? Number(hours[1]) * 60 : null;
}

export function parseRatings(data: OmdbMovieResponse): MovieRatings {
  const find = (source: string) =>
    data.Ratings?.find((r) => r.Source.toLowerCase() === source.toLowerCase())?.Value ?? null;

  return {
    imdb: parseImdbRating(data.imdbRating) ?? parseImdbRating(find('Internet Movie Database')),
    imdbVotes: parseVotes(data.imdbVotes),
    rt: parsePercent(find('Rotten Tomatoes')),
    // OMDb no trae el puntaje del público de RT: lo completa MDBList.
    popcorn: null,
  };
}

export function parseMovie(data: OmdbMovieResponse, now: number = Date.now()): Movie {
  return {
    imdbID: data.imdbID ?? '',
    title: clean(data.Title) ?? 'Sin título',
    year: clean(data.Year) ?? '',
    type: clean(data.Type) ?? 'movie',
    poster: clean(data.Poster),
    rated: clean(data.Rated),
    released: clean(data.Released),
    runtimeMin: parseRuntime(data.Runtime),
    genres: (clean(data.Genre) ?? '')
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean),
    director: clean(data.Director),
    actors: clean(data.Actors),
    plot: clean(data.Plot),
    country: clean(data.Country),
    language: clean(data.Language),
    awards: clean(data.Awards),
    ratings: parseRatings(data),
    audienceChecked: false,
    providers: null,
    fetchedAt: now,
  };
}

/**
 * Adapta una ficha guardada por una versión anterior de la app
 * (tenía Metacritic y no tenía el puntaje del público de RT).
 */
export function upgradeMovie(saved: Movie): Movie {
  const ratings = (saved.ratings ?? {}) as Partial<MovieRatings>;
  return {
    ...saved,
    ratings: {
      imdb: ratings.imdb ?? null,
      imdbVotes: ratings.imdbVotes ?? null,
      rt: ratings.rt ?? null,
      popcorn: ratings.popcorn ?? null,
    },
    providers: Array.isArray(saved.providers) ? saved.providers : null,
    // Si falta el público de RT o las plataformas (versiones anteriores), se vuelve a consultar MDBList.
    audienceChecked: (saved.audienceChecked ?? false) && ratings.popcorn != null && Array.isArray(saved.providers),
  };
}

export function parseSearchItem(item: OmdbSearchItem): SearchHit {
  return {
    imdbID: item.imdbID,
    title: clean(item.Title) ?? 'Sin título',
    year: clean(item.Year) ?? '',
    type: clean(item.Type) ?? 'movie',
    poster: clean(item.Poster),
  };
}

/** Traduce los errores conocidos de OMDb a mensajes útiles en español. */
export function translateOmdbError(error: string | undefined): string {
  const e = (error ?? '').toLowerCase();
  if (e.includes('invalid api key') || e.includes('no api key')) {
    return 'La clave de OMDb no es válida. Revísala en Ajustes.';
  }
  if (e.includes('limit')) {
    return 'Se alcanzó el límite diario de consultas de tu clave OMDb. Intenta mañana o usa otra clave.';
  }
  if (e.includes('not found')) return 'No se encontraron títulos con ese nombre.';
  if (e.includes('too many results')) {
    return 'Hay demasiados resultados. Escribe un título más específico.';
  }
  if (e.includes('incorrect imdb id')) return 'El identificador de IMDb no es válido.';
  return error ? `OMDb respondió: ${error}` : 'Error desconocido al consultar OMDb.';
}
