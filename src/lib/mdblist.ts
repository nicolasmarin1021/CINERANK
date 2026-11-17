/**
 * Cliente de MDBList: aporta el puntaje del público de Rotten Tomatoes
 * (Popcornmeter, las "palomitas"), que OMDb no ofrece.
 * Plan gratuito: 1.000 consultas al día con una clave personal.
 */
import type { WatchProvider } from './types';
import {
  mdblistErrorKind,
  parseBatchRating,
  parseRottenScores,
  parseTrailer,
  parseWatchProviders,
  translateMdblistError,
  type MdblistBatchResponse,
  type MdblistErrorKind,
  type MdblistMediaResponse,
  type RottenScores,
} from './mdblist-parse';

const BASE_URL = 'https://api.mdblist.com';
const TIMEOUT_MS = 10_000;

export const MDBLIST_SIGNUP_URL = 'https://mdblist.com/preferences/#api';

export class MdblistError extends Error {
  constructor(
    message: string,
    readonly kind: MdblistErrorKind,
  ) {
    super(message);
    this.name = 'MdblistError';
  }
}

async function call<T extends { error?: string }>(path: string, apiKey: string, init?: RequestInit): Promise<T> {
  const separator = path.includes('?') ? '&' : '?';
  const url = `${BASE_URL}${path}${separator}apikey=${encodeURIComponent(apiKey.trim())}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new MdblistError(translateMdblistError('network'), 'network');
  } finally {
    clearTimeout(timer);
  }

  let data = {} as T;
  try {
    data = (await res.json()) as T;
  } catch {
    // Algunos errores no traen JSON: nos basta con el código HTTP.
  }

  if (!res.ok) {
    const kind = mdblistErrorKind(res.status);
    throw new MdblistError(translateMdblistError(kind, data.error), kind);
  }
  return data;
}

/** MDBList solo acepta "movie" o "show" (no "any", aunque su especificación lo liste). */
export type MdblistMediaType = 'movie' | 'show';

/** Traduce el tipo de OMDb ("movie", "series", "episode") al de MDBList. */
export function mdblistTypeFor(omdbType: string): MdblistMediaType {
  return omdbType === 'series' ? 'show' : 'movie';
}

const lookup = (apiKey: string, type: MdblistMediaType, imdbID: string) =>
  call<MdblistMediaResponse>(`/imdb/${type}/${encodeURIComponent(imdbID)}`, apiKey);

/** Puntajes de Rotten Tomatoes y plataformas donde verla, de una sola consulta. */
export type MdblistInfo = RottenScores & { providers: WatchProvider[]; trailer: string | null };

/** Puntajes de crítica y público de Rotten Tomatoes (y plataformas) para un ID de IMDb. */
export async function getRottenScores(
  apiKey: string,
  imdbID: string,
  type: MdblistMediaType = 'movie',
): Promise<MdblistInfo> {
  let usedType = type;
  let media: MdblistMediaResponse;
  try {
    media = await lookup(apiKey, type, imdbID);
  } catch (err) {
    // Si OMDb y MDBList clasifican distinto el título (película vs. serie), prueba el otro tipo.
    if (!(err instanceof MdblistError) || err.kind !== 'not-found') throw err;
    usedType = type === 'movie' ? 'show' : 'movie';
    media = await lookup(apiKey, usedType, imdbID);
  }
  const scores: MdblistInfo = {
    ...parseRottenScores(media),
    providers: parseWatchProviders(media),
    trailer: parseTrailer(media),
  };

  // Plan B: el endpoint por lotes pide explícitamente la fuente "audience" (público de RT).
  if (scores.popcorn == null) {
    try {
      const batch = await call<MdblistBatchResponse>(`/rating/${usedType}/audience`, apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'imdb', ids: [imdbID] }),
      });
      scores.popcorn = parseBatchRating(batch, imdbID);
      if (scores.popcorn == null) scores.sources.push(`rating/audience: ${JSON.stringify(batch).slice(0, 160)}`);
    } catch (err) {
      scores.sources.push(`rating/audience: ${err instanceof Error ? err.message : 'error'}`);
    }
  }

  if (__DEV__ && scores.popcorn == null) {
    // Aparece en la terminal de Expo: ayuda a ver qué devolvió MDBList (nunca incluye la clave).
    console.log(
      `[CineRank] MDBList sin público de RT para ${imdbID}. Recibido: ${scores.sources.join(', ') || 'nada'}`,
    );
  }
  return scores;
}

/** Comprueba una clave con un título conocido (The Shawshank Redemption) y devuelve lo obtenido. */
export async function testMdblistKey(apiKey: string): Promise<MdblistInfo> {
  return getRottenScores(apiKey, 'tt0111161', 'movie');
}
