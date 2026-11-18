/**
 * Cliente de TMDB: catálogo de películas por plataforma y país, y plataformas
 * de cada país (datos de JustWatch). Necesita una clave gratuita de TMDB.
 * CineRank usa la API de TMDB, pero TMDB no la respalda ni certifica.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { discoverParams, type ExploreFilters } from './explore';
import { parseDiscover, parseProviders, type StreamingProvider, type TmdbPage } from './tmdb-parse';

export type { StreamingProvider, TmdbMovie, TmdbPage } from './tmdb-parse';

const BASE_URL = 'https://api.themoviedb.org/3';
const TIMEOUT_MS = 10_000;
const PROVIDERS_TTL_MS = 24 * 60 * 60 * 1000;

export const TMDB_SIGNUP_URL = 'https://www.themoviedb.org/settings/api';

export type TmdbErrorKind = 'no-key' | 'auth' | 'limit' | 'network' | 'other';

export class TmdbError extends Error {
  constructor(
    message: string,
    readonly kind: TmdbErrorKind,
  ) {
    super(message);
    this.name = 'TmdbError';
  }
}

const MESSAGES: Record<TmdbErrorKind, string> = {
  'no-key': 'Falta tu clave de TMDB. Añádela en Ajustes.',
  auth: 'TMDB no acepta esa clave. Copia la «Clave de la API» o el «Token de acceso de lectura» de themoviedb.org/settings/api.',
  limit: 'TMDB recibió demasiadas consultas seguidas. Espera unos segundos.',
  network: 'No se pudo conectar con TMDB. Revisa tu conexión.',
  other: 'TMDB respondió con un error. Inténtalo más tarde.',
};

async function request(key: string, path: string, params: Record<string, string> = {}): Promise<unknown> {
  const k = key.trim();
  if (!k) throw new TmdbError(MESSAGES['no-key'], 'no-key');
  // TMDB da dos credenciales: la "clave de la API" (corta, va en la URL) y el
  // "token de acceso de lectura" (largo, empieza por "eyJ", va en la cabecera).
  const isToken = k.startsWith('eyJ');
  const query = new URLSearchParams(isToken ? params : { ...params, api_key: k }).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}?${query}`, {
      signal: controller.signal,
      headers: isToken ? { Authorization: `Bearer ${k}`, Accept: 'application/json' } : { Accept: 'application/json' },
    });
  } catch {
    throw new TmdbError(MESSAGES.network, 'network');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const kind: TmdbErrorKind = res.status === 401 ? 'auth' : res.status === 429 ? 'limit' : 'other';
    throw new TmdbError(MESSAGES[kind], kind);
  }
  return res.json();
}

const providersMemory = new Map<string, { at: number; value: StreamingProvider[] }>();

/** Plataformas de streaming de un país (se guardan un día). */
export async function getProviders(key: string, region: string): Promise<StreamingProvider[]> {
  const cacheKey = `cinerank:providers:v1:${region}`;
  const mem = providersMemory.get(region);
  if (mem && Date.now() - mem.at < PROVIDERS_TTL_MS) return mem.value;
  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    const stored = raw ? (JSON.parse(raw) as { at: number; value: StreamingProvider[] }) : null;
    if (stored && Date.now() - stored.at < PROVIDERS_TTL_MS && stored.value.length > 0) {
      providersMemory.set(region, stored);
      return stored.value;
    }
  } catch {
    // Sin caché: se consulta a TMDB.
  }
  const json = await request(key, '/watch/providers/movie', {
    watch_region: region,
    language: region === 'ES' ? 'es-ES' : 'es-MX',
  });
  const value = parseProviders(json, region);
  const entry = { at: Date.now(), value };
  providersMemory.set(region, entry);
  AsyncStorage.setItem(cacheKey, JSON.stringify(entry)).catch(() => {});
  return value;
}

/** Una página (20 títulos) del catálogo filtrado por plataforma, país y año. */
export async function discoverMovies(key: string, filters: ExploreFilters, page: number): Promise<TmdbPage> {
  return parseDiscover(await request(key, '/discover/movie', discoverParams(filters, page)));
}

/** Prueba una clave pidiendo las plataformas de México; devuelve cuántas hay. */
export async function testTmdbKey(key: string): Promise<number> {
  const json = await request(key, '/watch/providers/movie', { watch_region: 'MX', language: 'es-MX' });
  return parseProviders(json, 'MX', 100).length;
}
