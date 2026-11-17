/**
 * Traductor de títulos: OMDb solo encuentra títulos por su nombre original
 * (normalmente en inglés). Wikidata conoce los títulos en español de cada
 * país ("Intensamente", "Volver al futuro"...) y su identificador de IMDb,
 * así que lo usamos para encontrar la película correcta. Es gratis y no
 * necesita clave.
 */
import { Platform } from 'react-native';

import { pickFilmHits, pickImdbId, type WikidataClaimsResponse, type WikidataSearchResponse } from './wikidata-parse';

const API = 'https://www.wikidata.org/w/api.php';
const TIMEOUT_MS = 6_000;
/** Cuántos títulos traducidos como máximo por búsqueda (cada uno es una consulta extra). */
const MAX_MATCHES = 4;

// En el navegador no se envían cabeceras propias (evita la comprobación CORS previa);
// en el móvil nos identificamos con un nombre genérico, como pide Wikimedia.
const HEADERS: Record<string, string> =
  Platform.OS === 'web' ? {} : { 'User-Agent': 'CineRank/1.0 (React Native app)' };

const cache = new Map<string, string[]>();

async function call<T>(params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams({ ...params, format: 'json', origin: '*' }).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API}?${query}`, { headers: HEADERS, signal: controller.signal });
    if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Devuelve los IDs de IMDb de las películas o series cuyo título (en español
 * u otro idioma) coincide con la búsqueda. Si Wikidata falla, devuelve [].
 */
export async function findImdbIdsByTitle(title: string): Promise<string[]> {
  const key = title.trim().toLowerCase();
  if (key.length < 2) return [];
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const search = await call<WikidataSearchResponse>({
      action: 'wbsearchentities',
      search: title.trim(),
      language: 'es',
      uselang: 'es',
      type: 'item',
      limit: '12',
    });
    const hits = pickFilmHits(search, MAX_MATCHES);

    // Una consulta a la vez: Wikimedia limita las ráfagas de peticiones en paralelo.
    const ids: string[] = [];
    for (const hit of hits) {
      const claims = await call<WikidataClaimsResponse>({ action: 'wbgetclaims', entity: hit.id, property: 'P345' });
      const imdbId = pickImdbId(claims);
      if (imdbId && !ids.includes(imdbId)) ids.push(imdbId);
    }
    cache.set(key, ids);
    return ids;
  } catch {
    // La traducción es un complemento: si falla, seguimos solo con OMDb.
    return [];
  }
}
