/**
 * Cliente de OMDb (https://www.omdbapi.com): ficha del título, nota de IMDb
 * y Tomatómetro de Rotten Tomatoes. El puntaje del público de RT lo añade
 * MDBList (ver mdblist.ts) cuando hay clave.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getRottenScores, MdblistError, mdblistTypeFor } from './mdblist';

import {
  parseMovie,
  parseSearchItem,
  translateOmdbError,
  type OmdbMovieResponse,
  type OmdbSearchResponse,
} from './omdb-parse';
import type { ApiKeys, MediaType, Movie, SearchHit } from './types';

const BASE_URL = 'https://www.omdbapi.com/';
// v3: descarta fichas guardadas sin el puntaje del público de RT (versiones anteriores).
const CACHE_PREFIX = 'cinerank:movie:v5:';
/** Las calificaciones cambian poco: 3 días de caché ahorran cuota diaria. */
const CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 12_000;

export class OmdbError extends Error {
  constructor(
    message: string,
    readonly kind: 'no-key' | 'auth' | 'limit' | 'not-found' | 'network' | 'other',
  ) {
    super(message);
    this.name = 'OmdbError';
  }
}

function kindFor(error: string | undefined): OmdbError['kind'] {
  const e = (error ?? '').toLowerCase();
  if (e.includes('api key')) return 'auth';
  if (e.includes('limit')) return 'limit';
  if (e.includes('not found') || e.includes('incorrect imdb id')) return 'not-found';
  return 'other';
}

async function request<T extends { Response: 'True' | 'False'; Error?: string }>(
  apiKey: string,
  params: Record<string, string>,
): Promise<T> {
  if (!apiKey.trim()) {
    throw new OmdbError('Configura tu clave gratuita de OMDb en Ajustes para buscar títulos.', 'no-key');
  }
  const query = new URLSearchParams({ apikey: apiKey.trim(), ...params }).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}?${query}`, { signal: controller.signal });
  } catch {
    throw new OmdbError('No hay conexión con OMDb. Revisa tu internet e inténtalo de nuevo.', 'network');
  } finally {
    clearTimeout(timer);
  }

  let data: T;
  try {
    data = (await res.json()) as T;
  } catch {
    throw new OmdbError(`OMDb devolvió una respuesta inválida (HTTP ${res.status}).`, 'other');
  }

  if (data.Response === 'False') {
    throw new OmdbError(translateOmdbError(data.Error), kindFor(data.Error));
  }
  return data;
}

export interface SearchPage {
  results: SearchHit[];
  total: number;
}

export async function searchTitles(
  apiKey: string,
  query: string,
  options: { type?: MediaType; year?: string; page?: number } = {},
): Promise<SearchPage> {
  const params: Record<string, string> = { s: query.trim(), page: String(options.page ?? 1) };
  if (options.type) params.type = options.type;
  if (options.year) params.y = options.year;

  try {
    const data = await request<OmdbSearchResponse>(apiKey, params);
    const seen = new Set<string>();
    const results = (data.Search ?? [])
      .map(parseSearchItem)
      .filter((hit) => (seen.has(hit.imdbID) ? false : (seen.add(hit.imdbID), true)));
    return { results, total: Number(data.totalResults ?? results.length) || results.length };
  } catch (err) {
    if (err instanceof OmdbError && err.kind === 'not-found') return { results: [], total: 0 };
    throw err;
  }
}

const memoryCache = new Map<string, Movie>();
const inFlight = new Map<string, Promise<Movie>>();

function isFresh(movie: Movie) {
  return Date.now() - movie.fetchedAt < CACHE_TTL_MS;
}

async function readCache(imdbID: string): Promise<Movie | null> {
  const mem = memoryCache.get(imdbID);
  if (mem && isFresh(mem)) return mem;
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + imdbID);
    if (!raw) return null;
    const movie = JSON.parse(raw) as Movie;
    if (!isFresh(movie)) return null;
    memoryCache.set(imdbID, movie);
    return movie;
  } catch {
    return null;
  }
}

async function writeCache(movie: Movie) {
  memoryCache.set(movie.imdbID, movie);
  try {
    await AsyncStorage.setItem(CACHE_PREFIX + movie.imdbID, JSON.stringify(movie));
  } catch {
    // La caché es opcional: si falla, seguimos sin ella.
  }
}

function needsAudience(movie: Movie, keys: ApiKeys) {
  return keys.mdblist.trim() !== '' && !movie.audienceChecked;
}

/**
 * Añade el puntaje del público de RT (y la crítica si OMDb no la tenía).
 * Si MDBList falla, la ficha sigue sirviendo con las demás fuentes.
 */
async function addAudience(movie: Movie, keys: ApiKeys): Promise<Movie> {
  if (!keys.mdblist.trim()) return movie;
  try {
    const scores = await getRottenScores(keys.mdblist, movie.imdbID, mdblistTypeFor(movie.type));
    return {
      ...movie,
      ratings: { ...movie.ratings, popcorn: scores.popcorn, rt: movie.ratings.rt ?? scores.tomatoes },
      providers: scores.providers,
      trailer: scores.trailer,
      audienceChecked: true,
    };
  } catch (err) {
    // Si MDBList no conoce el título no hay nada más que buscar; otros errores se reintentan luego.
    if (err instanceof MdblistError && err.kind === 'not-found') return { ...movie, providers: [], trailer: null, audienceChecked: true };
    return movie;
  }
}

/** Devuelve la ficha con calificaciones; usa la caché salvo que `force` sea true. */
export async function getMovie(keys: ApiKeys, imdbID: string, force = false): Promise<Movie> {
  const key = `${imdbID}:${force ? 'f' : 'c'}`;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const load = async (): Promise<Movie> => {
    const cached = force ? null : await readCache(imdbID);
    const base = cached ?? parseMovie(await request<OmdbMovieResponse>(keys.omdb, { i: imdbID, plot: 'full' }));
    if (cached && !needsAudience(cached, keys)) return cached;
    const movie = await addAudience(base, keys);
    await writeCache(movie);
    return movie;
  };

  const promise = load().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

/** Valor en memoria, sin red, para pintar al instante lo que ya conocemos. */
export function peekMovie(imdbID: string): Movie | null {
  return memoryCache.get(imdbID) ?? null;
}

/** Comprueba una clave con una consulta mínima (The Shawshank Redemption). */
export async function testApiKey(apiKey: string): Promise<void> {
  await request<OmdbMovieResponse>(apiKey, { i: 'tt0111161' });
}

export const OMDB_SIGNUP_URL = 'https://www.omdbapi.com/apikey.aspx';

export function imdbUrl(imdbID: string) {
  return `https://www.imdb.com/title/${imdbID}/`;
}

export function rottenTomatoesSearchUrl(title: string) {
  return `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`;
}
