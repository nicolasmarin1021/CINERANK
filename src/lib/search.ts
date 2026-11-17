/**
 * Búsqueda combinada: resultados de OMDb (título original) + títulos en
 * español resueltos con Wikidata. Los aciertos por título en español van
 * primero, porque son la película que el usuario tenía en mente.
 */
import { getMovie, searchTitles, type SearchPage } from './omdb';
import type { ApiKeys, MediaType, Movie, SearchHit } from './types';
import { findImdbIdsByTitle } from './wikidata';

function toHit(movie: Movie): SearchHit {
  return { imdbID: movie.imdbID, title: movie.title, year: movie.year, type: movie.type, poster: movie.poster };
}

function matchesFilters(movie: Movie, type?: MediaType, year?: string) {
  if (type && movie.type !== type) return false;
  if (year && !movie.year.startsWith(year)) return false;
  return true;
}

/** Une dos listas sin duplicados, manteniendo el orden: primero `first`. */
export function mergeHits(first: SearchHit[], second: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  return [...first, ...second].filter((hit) => (seen.has(hit.imdbID) ? false : (seen.add(hit.imdbID), true)));
}

export async function searchCatalog(
  keys: ApiKeys,
  query: string,
  options: { type?: MediaType; year?: string; page?: number } = {},
): Promise<SearchPage> {
  const page = options.page ?? 1;
  if (page > 1) return searchTitles(keys.omdb, query, options);

  // Las dos búsquedas en paralelo. Si OMDb falla (clave, límite, red) el error se muestra;
  // si falla Wikidata, simplemente no hay traducciones.
  const [omdb, translatedIds] = await Promise.all([searchTitles(keys.omdb, query, options), findImdbIdsByTitle(query)]);

  const details = await Promise.allSettled(translatedIds.map((id) => getMovie(keys, id)));
  const translated = details
    .flatMap((d) => (d.status === 'fulfilled' ? [d.value] : []))
    .filter((movie) => matchesFilters(movie, options.type, options.year))
    .map(toHit);

  const results = mergeHits(translated, omdb.results);
  const added = results.length - omdb.results.length;
  return { results, total: omdb.total + added };
}
