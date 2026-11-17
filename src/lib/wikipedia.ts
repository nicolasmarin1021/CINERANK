/**
 * Sinopsis en español: OMDb solo da la sinopsis en inglés. Buscamos el artículo
 * de la película en la Wikipedia en español (a través de su ID de IMDb en
 * Wikidata) y mostramos su resumen. Gratis y sin clave; se guarda 30 días.
 * Texto de Wikipedia bajo licencia CC BY-SA: la ficha enlaza al artículo.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import {
  parseEntityId,
  parseSpanishTitle,
  parseSummary,
  summaryPath,
  type SpanishSynopsis,
} from './wikipedia-parse';

export type { SpanishSynopsis } from './wikipedia-parse';

const WIKIDATA = 'https://www.wikidata.org/w/api.php';
const WIKIPEDIA_ES = 'https://es.wikipedia.org';
const TIMEOUT_MS = 8_000;
const CACHE_PREFIX = 'cinerank:synopsis:v1:';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

// En el navegador no se envían cabeceras propias (evita la comprobación CORS previa);
// en el móvil nos identificamos con un nombre genérico, como pide Wikimedia.
const HEADERS: Record<string, string> =
  Platform.OS === 'web' ? {} : { 'User-Agent': 'CineRank/1.0 (React Native app)' };

/** null = consultado y sin artículo en español. */
const memory = new Map<string, SpanishSynopsis | null>();
const inFlight = new Map<string, Promise<SpanishSynopsis | null>>();

async function getJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

const wikidata = (params: Record<string, string>) =>
  `${WIKIDATA}?${new URLSearchParams({ ...params, format: 'json', origin: '*' }).toString()}`;

/** Lo que ya está en memoria: SpanishSynopsis, null (no hay) o undefined (sin consultar). */
export function peekSpanishSynopsis(imdbID: string): SpanishSynopsis | null | undefined {
  return memory.has(imdbID) ? memory.get(imdbID) : undefined;
}

/**
 * Resumen en español del artículo de Wikipedia de un título, o null si no hay.
 * Lanza un error si no hay conexión (así no se guarda un "no hay" por error).
 */
export async function getSpanishSynopsis(imdbID: string): Promise<SpanishSynopsis | null> {
  if (memory.has(imdbID)) return memory.get(imdbID) ?? null;
  const pending = inFlight.get(imdbID);
  if (pending) return pending;

  const load = async (): Promise<SpanishSynopsis | null> => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_PREFIX + imdbID);
      const stored = raw ? (JSON.parse(raw) as { at: number; value: SpanishSynopsis | null }) : null;
      if (stored && Date.now() - stored.at < TTL_MS) {
        memory.set(imdbID, stored.value);
        return stored.value;
      }
    } catch {
      // Sin caché: se consulta a Wikipedia.
    }

    const search = await getJson<Parameters<typeof parseEntityId>[0]>(
      wikidata({ action: 'query', list: 'search', srsearch: `haswbstatement:P345=${imdbID}`, srlimit: '1' }),
    );
    const entityId = parseEntityId(search);
    let value: SpanishSynopsis | null = null;
    if (entityId) {
      const entities = await getJson<Parameters<typeof parseSpanishTitle>[0]>(
        wikidata({ action: 'wbgetentities', ids: entityId, props: 'sitelinks', sitefilter: 'eswiki' }),
      );
      const title = parseSpanishTitle(entities, entityId);
      if (title) value = parseSummary(await getJson(`${WIKIPEDIA_ES}${summaryPath(title)}`));
    }
    memory.set(imdbID, value);
    AsyncStorage.setItem(CACHE_PREFIX + imdbID, JSON.stringify({ at: Date.now(), value })).catch(() => {});
    return value;
  };

  const promise = load().finally(() => inFlight.delete(imdbID));
  inFlight.set(imdbID, promise);
  return promise;
}
