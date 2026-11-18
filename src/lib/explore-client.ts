/**
 * Motor de «Explorar»: recorre el catálogo de TMDB página a página, consulta en
 * MDBList las notas y los Óscar de cada título y se queda con los que cumplen
 * los filtros, hasta reunir suficientes para mostrar.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { hasQualityFilters, matchesFilters, parseExploreRatings, type ExploreFilters, type ExploreRatings } from './explore';
import { discoverMovies, type TmdbMovie } from './tmdb';

const MDBLIST = 'https://api.mdblist.com';
const TIMEOUT_MS = 12_000;
const CACHE_PREFIX = 'cinerank:explore:v1:';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface ExploreItem extends TmdbMovie {
  /** null si no hay clave de MDBList (solo se ve la nota de TMDB). */
  ratings: ExploreRatings | null;
}

export interface ExploreBatch {
  items: ExploreItem[];
  /** Siguiente página de TMDB por la que seguir, o null si no hay más. */
  nextPage: number | null;
  /** Títulos revisados en esta tanda. */
  scanned: number;
}

const memory = new Map<number, ExploreRatings>();
const NOT_FOUND: ExploreRatings = { imdbID: null, imdb: null, rt: null, popcorn: null, oscars: 0 };

async function getJson(url: string, init?: RequestInit): Promise<{ status: number; json: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      // Sin cuerpo JSON: basta el código.
    }
    return { status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

async function readCache(ids: number[]) {
  const missing: number[] = [];
  for (const id of ids) {
    if (memory.has(id)) continue;
    try {
      const raw = await AsyncStorage.getItem(CACHE_PREFIX + id);
      const stored = raw ? (JSON.parse(raw) as { at: number; value: ExploreRatings }) : null;
      if (stored && Date.now() - stored.at < TTL_MS) {
        memory.set(id, stored.value);
        continue;
      }
    } catch {
      // Sin caché.
    }
    missing.push(id);
  }
  return missing;
}

function remember(id: number, value: ExploreRatings) {
  memory.set(id, value);
  AsyncStorage.setItem(CACHE_PREFIX + id, JSON.stringify({ at: Date.now(), value })).catch(() => {});
}

/** Una consulta por lotes (solo en el teléfono: el navegador la bloquea por CORS). */
async function lookupBatch(key: string, ids: number[]): Promise<boolean> {
  const { status, json } = await getJson(`${MDBLIST}/tmdb/movie/?apikey=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (status !== 200) return false;
  const d = json as Record<string, unknown> | unknown[] | null;
  const list = Array.isArray(d)
    ? d
    : ((d?.movies ?? d?.items ?? d?.results ?? []) as unknown[]);
  if (!Array.isArray(list) || list.length === 0) return false;
  const found = new Set<number>();
  for (const item of list) {
    const tmdb = Number((item as { ids?: { tmdb?: unknown } })?.ids?.tmdb);
    if (!Number.isFinite(tmdb)) continue;
    found.add(tmdb);
    remember(tmdb, parseExploreRatings(item));
  }
  for (const id of ids) if (!found.has(id)) remember(id, NOT_FOUND);
  return true;
}

async function lookupOne(key: string, id: number) {
  const { status, json } = await getJson(`${MDBLIST}/tmdb/movie/${id}?apikey=${encodeURIComponent(key)}`);
  if (status === 200) remember(id, parseExploreRatings(json));
  else if (status === 404) remember(id, NOT_FOUND);
  else if (status === 401 || status === 403) throw new Error('MDBList no acepta tu clave.');
  else if (status === 429) throw new Error('Se alcanzó el límite diario de MDBList.');
}

/** Notas y Óscar de varios títulos por su ID de TMDB (con caché de 7 días). */
async function lookupRatings(key: string, ids: number[]): Promise<void> {
  const missing = await readCache(ids);
  if (missing.length === 0) return;
  if (Platform.OS !== 'web') {
    try {
      if (await lookupBatch(key, missing)) return;
    } catch {
      // Si el lote falla, se consulta uno a uno.
    }
  }
  // De seis en seis para no saturar el servicio.
  for (let i = 0; i < missing.length; i += 6) {
    await Promise.all(missing.slice(i, i + 6).map((id) => lookupOne(key, id).catch((e) => Promise.reject(e))));
  }
}

/**
 * Siguiente tanda de resultados: recorre páginas de TMDB desde `fromPage` hasta
 * reunir `target` títulos que cumplan los filtros o revisar `maxPages` páginas.
 */
export async function exploreMore(
  keys: { tmdb: string; mdblist: string },
  filters: ExploreFilters,
  fromPage: number,
  { target = 18, maxPages = 5 } = {},
): Promise<ExploreBatch> {
  const items: ExploreItem[] = [];
  const useRatings = keys.mdblist.trim() !== '';
  const filtering = useRatings && hasQualityFilters(filters);
  let page = fromPage;
  let scanned = 0;
  let nextPage: number | null = page;

  for (let i = 0; i < maxPages && items.length < target && nextPage != null; i++) {
    const result = await discoverMovies(keys.tmdb, filters, page);
    scanned += result.results.length;
    if (useRatings) await lookupRatings(keys.mdblist, result.results.map((m) => m.tmdbId));
    for (const movie of result.results) {
      const ratings = useRatings ? (memory.get(movie.tmdbId) ?? null) : null;
      if (filtering && (!ratings || !matchesFilters(ratings, filters))) continue;
      if (useRatings && !ratings?.imdbID) continue;
      items.push({ ...movie, ratings });
    }
    nextPage = result.results.length > 0 && page < result.totalPages && page < 500 ? page + 1 : null;
    if (nextPage != null) page = nextPage;
  }
  return { items, nextPage, scanned };
}
