/**
 * Conversión de respuestas de MDBList (https://api.mdblist.com).
 * Sin dependencias de React Native para poder probarse con Node.
 *
 * MDBList devuelve `ratings: [{ source, value, score, votes }]`, donde
 * `tomatoes` es la crítica de Rotten Tomatoes y `popcorn` (o `audience`) su público.
 */

export interface MdblistRating {
  source?: string;
  value?: unknown;
  score?: unknown;
  votes?: number | null;
}

export interface MdblistMediaResponse {
  /** "movie" o "show". */
  type?: string;
  ratings?: MdblistRating[];
  /** Plataformas donde verla, con IDs de TMDB. MDBList las da siempre para EE. UU. */
  watch_providers?: { id?: unknown; name?: unknown }[];
  error?: string;
}

/** Respuesta de POST /rating/{tipo}/{fuente}: forma no documentada, se lee con tolerancia. */
export interface MdblistBatchResponse {
  ratings?: Record<string, unknown>[];
  error?: string;
}

export interface RottenScores {
  /** Público (palomitas), 0–100. */
  popcorn: number | null;
  /** Crítica (tomates), 0–100. */
  tomatoes: number | null;
  /** Fuentes recibidas ("imdb=8.1", ...), para diagnosticar cuando falta el público. */
  sources: string[];
}

// La documentación de MDBList usa "popcorn" en unos sitios y "audience" en otros:
// aceptamos ambos y variantes comunes. Se comparan sin mayúsculas, espacios ni guiones.
const AUDIENCE_SOURCES = new Set(['popcorn', 'audience', 'popcornmeter', 'rtaudience', 'tomatoesaudience']);
const CRITIC_SOURCES = new Set(['tomatoes', 'tomatometer', 'rtomatoes', 'rottentomatoes']);

const normalize = (source: string | undefined) => (source ?? '').toLowerCase().replace(/[^a-z]/g, '');

function toPercent(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace('%', '').trim());
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n) : null;
}

export function parseRottenScores(response: MdblistMediaResponse): RottenScores {
  const ratings = Array.isArray(response.ratings) ? response.ratings : [];
  const pick = (names: Set<string>) => {
    for (const r of ratings) {
      if (!names.has(normalize(r.source))) continue;
      const value = toPercent(r.value) ?? toPercent(r.score);
      if (value != null) return value;
    }
    return null;
  };
  return {
    popcorn: pick(AUDIENCE_SOURCES),
    tomatoes: pick(CRITIC_SOURCES),
    sources: ratings.map((r) => `${r.source ?? '?'}=${String(r.value ?? r.score ?? 'null')}`),
  };
}

/** Plataformas válidas de la respuesta, sin duplicados. */
export function parseWatchProviders(response: MdblistMediaResponse): { id: number; name: string }[] {
  const seen = new Set<number>();
  const out: { id: number; name: string }[] = [];
  for (const p of Array.isArray(response.watch_providers) ? response.watch_providers : []) {
    if (!p || typeof p.id !== 'number' || typeof p.name !== 'string' || !p.name.trim() || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({ id: p.id, name: p.name.trim() });
  }
  return out;
}

/** Lee la puntuación de un título en la respuesta del endpoint por lotes. */
export function parseBatchRating(response: MdblistBatchResponse, imdbID: string): number | null {
  for (const item of Array.isArray(response.ratings) ? response.ratings : []) {
    if (!item || typeof item !== 'object') continue;
    const ids = Object.values(item).filter((v): v is string => typeof v === 'string' && /^tt\d+$/.test(v));
    if (ids.length > 0 && !ids.includes(imdbID)) continue;
    for (const key of ['rating', 'value', 'score', 'audience', 'popcorn']) {
      const value = toPercent(item[key]);
      if (value != null) return value;
    }
  }
  return null;
}

export type MdblistErrorKind = 'auth' | 'limit' | 'not-found' | 'network' | 'other';

export function mdblistErrorKind(status: number): MdblistErrorKind {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'limit';
  if (status === 404) return 'not-found';
  return 'other';
}

export function translateMdblistError(kind: MdblistErrorKind, detail?: string): string {
  switch (kind) {
    case 'auth':
      return 'La clave de MDBList no es válida. Revísala en Ajustes.';
    case 'limit':
      return 'Se alcanzó el límite de consultas de MDBList (1.000 al día en el plan gratuito). Intenta más tarde.';
    case 'not-found':
      return 'MDBList no tiene este título.';
    case 'network':
      return 'No hay conexión con MDBList. Revisa tu internet.';
    default:
      return detail ? `MDBList respondió: ${detail}` : 'Error desconocido al consultar MDBList.';
  }
}
