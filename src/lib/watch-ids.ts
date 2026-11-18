/**
 * IDs de un título en cada plataforma (Netflix, Disney+, HBO Max, Apple TV…) desde Wikidata,
 * para abrirlo directamente. Gratis y sin clave. Se guardan 30 días: casi nunca cambian.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { parseWatchIds, watchIdsQuery, type SparqlResponse, type WatchIds } from './watch-links';

const ENDPOINT = 'https://query.wikidata.org/sparql';
const TIMEOUT_MS = 8_000;
const CACHE_PREFIX = 'cinerank:watch-ids:v1:';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

// En el navegador no se envían cabeceras propias (evita la comprobación CORS previa);
// en el móvil nos identificamos con un nombre genérico, como pide Wikimedia.
const HEADERS: Record<string, string> =
  Platform.OS === 'web' ? {} : { 'User-Agent': 'CineRank/1.0 (React Native app)' };

const memory = new Map<string, WatchIds>();
const inFlight = new Map<string, Promise<WatchIds>>();
/** Una consulta a la vez: Wikimedia limita las ráfagas de peticiones en paralelo. */
let queue: Promise<unknown> = Promise.resolve();

/** Lo ya cargado en esta sesión, sin esperar (para pintar los enlaces exactos de inmediato). */
export function peekWatchIds(imdbID: string): WatchIds | null {
  return memory.get(imdbID) ?? null;
}

async function query(imdbID: string): Promise<WatchIds> {
  const sparql = watchIdsQuery(imdbID);
  if (!sparql) return {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(sparql)}`;
    const res = await fetch(url, { headers: HEADERS, signal: controller.signal });
    if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
    return parseWatchIds((await res.json()) as SparqlResponse);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * IDs de plataforma del título. Si Wikidata falla devuelve {} sin guardarlo,
 * y los iconos usan la búsqueda dentro de cada plataforma.
 */
export function getWatchIds(imdbID: string): Promise<WatchIds> {
  const known = memory.get(imdbID);
  if (known) return Promise.resolve(known);
  const pending = inFlight.get(imdbID);
  if (pending) return pending;

  const load = async (): Promise<WatchIds> => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_PREFIX + imdbID);
      const stored = raw ? (JSON.parse(raw) as { at: number; ids: WatchIds }) : null;
      if (stored && Date.now() - stored.at < TTL_MS) {
        memory.set(imdbID, stored.ids);
        return stored.ids;
      }
    } catch {
      // Sin caché: se consulta a Wikidata.
    }
    const turn = queue.then(() => query(imdbID));
    queue = turn.catch(() => {});
    try {
      const ids = await turn;
      memory.set(imdbID, ids);
      AsyncStorage.setItem(CACHE_PREFIX + imdbID, JSON.stringify({ at: Date.now(), ids })).catch(() => {});
      return ids;
    } catch {
      return {};
    }
  };

  const promise = load().finally(() => inFlight.delete(imdbID));
  inFlight.set(imdbID, promise);
  return promise;
}
