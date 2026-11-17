/**
 * Comentarios de Trakt (https://trakt.tv) convertidos en un número, sin IA:
 * la nota (1–10) que cada persona que comenta le dio al título, ponderada por
 * los «me gusta» de su comentario. Sin dependencias de React Native.
 *
 * La forma exacta de cada comentario no se pudo confirmar en la documentación
 * pública, así que se lee con tolerancia (`user_stats.rating` o `user_rating`).
 */

export interface TraktComment {
  comment?: unknown;
  spoiler?: unknown;
  review?: unknown;
  likes?: unknown;
  replies?: unknown;
  parent_id?: unknown;
  user_stats?: { rating?: unknown } | null;
  user_rating?: unknown;
}

export interface CommentsScore {
  /** Nota media de quienes comentan, 0–100; null si hay pocos comentarios con nota. */
  score: number | null;
  /** Comentarios que traían la nota de su autor. */
  rated: number;
  /** Comentarios recibidos (respuestas excluidas). */
  total: number;
  /** Campos del primer comentario, para diagnosticar si la forma cambia. */
  fields: string[];
}

/** Por debajo de esta cantidad de comentarios con nota, no se da número. */
export const MIN_RATED_COMMENTS = 3;

const toNumber = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN);

function ratingOf(c: TraktComment): number | null {
  const raw = toNumber(c.user_stats?.rating ?? c.user_rating);
  return Number.isFinite(raw) && raw >= 1 && raw <= 10 ? raw : null;
}

export function parseCommentsScore(items: unknown, minRated: number = MIN_RATED_COMMENTS): CommentsScore {
  const list = (Array.isArray(items) ? items : []).filter(
    (c): c is TraktComment => !!c && typeof c === 'object',
  );
  // Solo comentarios principales: las respuestas suelen discutir otro comentario, no la película.
  const top = list.filter((c) => c.parent_id == null || toNumber(c.parent_id) === 0);
  let weighted = 0;
  let weights = 0;
  let rated = 0;
  for (const c of top) {
    const rating = ratingOf(c);
    if (rating == null) continue;
    const likes = Math.max(0, toNumber(c.likes) || 0);
    // Un comentario con muchos «me gusta» representa a más gente, pero sin aplastar al resto.
    const w = 1 + Math.log2(1 + likes);
    weighted += rating * w;
    weights += w;
    rated++;
  }
  return {
    score: rated >= minRated && weights > 0 ? Math.round((weighted / weights) * 10) : null,
    rated,
    total: top.length,
    fields: list[0] ? Object.keys(list[0]) : [],
  };
}

export type TraktErrorKind = 'no-key' | 'auth' | 'limit' | 'not-found' | 'network' | 'other';

export function traktErrorKind(status: number): TraktErrorKind {
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'not-found';
  if (status === 429) return 'limit';
  return 'other';
}

export function translateTraktError(kind: TraktErrorKind, status?: number): string {
  switch (kind) {
    case 'no-key':
      return 'Falta tu Client ID de Trakt.';
    case 'auth':
      return 'Trakt no acepta ese Client ID. Cópialo de nuevo desde app.trakt.tv/apps (es el «Client ID», no el «Client Secret»).';
    case 'limit':
      return 'Se alcanzó el límite de consultas de Trakt (500 cada 5 minutos). Espera unos minutos.';
    case 'not-found':
      return 'Trakt no tiene ese título.';
    case 'network':
      return 'No se pudo conectar con Trakt. Revisa tu conexión.';
    default:
      return `Trakt respondió con un error${status ? ` (${status})` : ''}. Inténtalo más tarde.`;
  }
}
