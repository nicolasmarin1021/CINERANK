/**
 * Cliente de Trakt: comentarios de espectadores de un título (los más votados).
 * Solo necesita el Client ID de una app de Trakt (gratis, app.trakt.tv/apps).
 * Límite: 500 consultas cada 5 minutos; por eso se guarda en caché 7 días.
 * CineRank usa Trakt, pero Trakt no la respalda ni certifica.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import {
  parseCommentsScore,
  traktErrorKind,
  translateTraktError,
  type CommentsScore,
  type TraktErrorKind,
} from './trakt-parse';

export type { CommentsScore } from './trakt-parse';

const BASE_URL = 'https://api.trakt.tv';
const TIMEOUT_MS = 10_000;
const CACHE_PREFIX = 'cinerank:comments:v1:';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Los más votados representan mejor la opinión general. */
const COMMENTS_LIMIT = 50;

export const TRAKT_APPS_URL = 'https://app.trakt.tv/apps';

export class TraktError extends Error {
  constructor(
    message: string,
    readonly kind: TraktErrorKind,
  ) {
    super(message);
    this.name = 'TraktError';
  }
}

const memory = new Map<string, { at: number; value: CommentsScore }>();
const inFlight = new Map<string, Promise<CommentsScore>>();

async function request(clientId: string, path: string): Promise<unknown> {
  if (!clientId.trim()) throw new TraktError(translateTraktError('no-key'), 'no-key');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': clientId.trim(),
        // El navegador no deja cambiar el User-Agent; en el teléfono sí.
        ...(Platform.OS === 'web' ? {} : { 'User-Agent': 'CineRank/1.0' }),
      },
    });
  } catch {
    throw new TraktError(translateTraktError('network'), 'network');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const kind = traktErrorKind(res.status);
    throw new TraktError(translateTraktError(kind, res.status), kind);
  }
  return res.json();
}

/** "movies" o "shows" según el tipo de OMDb. */
const traktType = (omdbType: string) => (omdbType === 'series' ? 'shows' : 'movies');

/**
 * Nota de quienes comentan en Trakt para un ID de IMDb (con caché de 7 días).
 * Si Trakt no conoce el título devuelve "sin datos"; otros errores se lanzan.
 */
export async function getCommentsScore(clientId: string, imdbID: string, omdbType = 'movie'): Promise<CommentsScore> {
  const cached = memory.get(imdbID);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const pending = inFlight.get(imdbID);
  if (pending) return pending;

  const load = async (): Promise<CommentsScore> => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_PREFIX + imdbID);
      const stored = raw ? (JSON.parse(raw) as { at: number; value: CommentsScore }) : null;
      if (stored && Date.now() - stored.at < TTL_MS) {
        memory.set(imdbID, stored);
        return stored.value;
      }
    } catch {
      // Sin caché: se consulta a Trakt.
    }

    let value: CommentsScore;
    try {
      const items = await request(
        clientId,
        `/${traktType(omdbType)}/${encodeURIComponent(imdbID)}/comments/likes?limit=${COMMENTS_LIMIT}`,
      );
      value = parseCommentsScore(items);
    } catch (err) {
      if (!(err instanceof TraktError) || err.kind !== 'not-found') throw err;
      value = { score: null, rated: 0, total: 0, fields: [] };
    }
    const entry = { at: Date.now(), value };
    memory.set(imdbID, entry);
    AsyncStorage.setItem(CACHE_PREFIX + imdbID, JSON.stringify(entry)).catch(() => {});
    return value;
  };

  const promise = load().finally(() => inFlight.delete(imdbID));
  inFlight.set(imdbID, promise);
  return promise;
}

/** Prueba un Client ID con The Shawshank Redemption (sin usar la caché). */
export async function testTraktKey(clientId: string): Promise<CommentsScore> {
  const items = await request(clientId, `/movies/tt0111161/comments/likes?limit=${COMMENTS_LIMIT}`);
  return parseCommentsScore(items);
}
