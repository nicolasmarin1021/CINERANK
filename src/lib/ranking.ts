/**
 * Motor de ranking de CineRank.
 *
 * 1. Normaliza cada fuente a una escala 0–100
 *    (IMDb ×10; crítica y público de Rotten Tomatoes ya vienen en %).
 * 2. Opcional: corrige la nota IMDb de títulos con pocos votos con un promedio
 *    bayesiano, el mismo principio que IMDb usa en su Top 250.
 * 3. Combina las fuentes con los pesos elegidos. Si a un título le falta una
 *    fuente, los pesos se reparten entre las fuentes disponibles y el título
 *    se marca como "datos parciales".
 *
 * Archivo puro (sin React Native) para poder probarlo con `node --test`.
 */
import type { Movie, RankingSettings, SortKey, SourceKey, Weights } from './types';

const KEYS: readonly SourceKey[] = ['imdb', 'rt', 'popcorn'];

/** Valor previo del promedio bayesiano: la nota media aproximada en IMDb (6.5/10). */
export const IMDB_PRIOR = 65;

/** Diferencia (puntos) entre crítica y público a partir de la cual hablamos de división. */
export const CONSENSUS_GAP = 15;

/** Diferencia de CineScore por debajo de la cual dos títulos están en empate técnico. */
export const TIE_THRESHOLD = 2;

export const DEFAULT_SETTINGS: RankingSettings = {
  weights: { imdb: 50, rt: 50, popcorn: 50 },
  voteConfidence: true,
  minVotes: 10_000,
};

export type TierKey = 'essential' | 'great' | 'good' | 'mixed' | 'avoid';

export interface Tier {
  key: TierKey;
  label: string;
}

export type ConsensusKey = 'aligned' | 'critics' | 'audience';

export interface Consensus {
  key: ConsensusKey;
  /** Crítica − público (0–100). Positivo: la crítica la quiere más. */
  gap: number;
  label: string;
}

export interface Contribution {
  source: SourceKey;
  /** Valor 0–100 usado en el cálculo. */
  value: number;
  /** Fracción del peso efectivo (0–1) tras repartir fuentes faltantes. */
  share: number;
  /** Puntos que aporta al CineScore (value × share). */
  points: number;
}

export interface ScoredMovie {
  movie: Movie;
  /** Valores 0–100 usados en el cálculo (IMDb ya corregida si aplica). */
  scores: Record<SourceKey, number | null>;
  /** Nota IMDb original en escala 0–100. */
  imdbRaw: number | null;
  /** Cuántos puntos movió la corrección por votos (negativo = la bajó). */
  imdbAdjustment: number;
  /** CineScore 0–100 con un decimal, o null si no hay datos con peso. */
  score: number | null;
  contributions: Contribution[];
  /** Fuentes con peso > 0 de las que no hay dato. */
  missing: SourceKey[];
  /** Fracción (0–1) del peso configurado que sí tenía datos. */
  coverage: number;
  tier: Tier | null;
  consensus: Consensus | null;
}

export interface RankedMovie extends ScoredMovie {
  /** Puesto 1..n según el criterio de orden; null si no tiene valor en ese criterio. */
  rank: number | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Promedio bayesiano: (v·R + m·C) / (v + m). Con muchos votos ≈ R; con pocos ≈ C. */
export function bayesianAverage(rating: number, votes: number, minVotes: number, prior = IMDB_PRIOR) {
  if (minVotes <= 0 || votes < 0) return rating;
  return (votes * rating + minVotes * prior) / (votes + minVotes);
}

export function tierFor(score: number): Tier {
  if (score >= 85) return { key: 'essential', label: 'Imprescindible' };
  if (score >= 75) return { key: 'great', label: 'Muy recomendable' };
  if (score >= 65) return { key: 'good', label: 'Buena opción' };
  if (score >= 50) return { key: 'mixed', label: 'Irregular' };
  return { key: 'avoid', label: 'Mejor evítala' };
}

/**
 * Compara crítica y público. El público es el puntaje de palomitas de RT
 * (misma escala y mismo sitio que la crítica); si falta, se usa la nota IMDb.
 */
export function consensusFor(critics: number | null, audience: number | null): Consensus | null {
  if (critics == null || audience == null) return null;
  const gap = round1(critics - audience);
  if (gap >= CONSENSUS_GAP) return { key: 'critics', gap, label: 'La crítica la valora más que el público' };
  if (gap <= -CONSENSUS_GAP) return { key: 'audience', gap, label: 'El público la valora más que la crítica' };
  return { key: 'aligned', gap, label: 'Crítica y público coinciden' };
}

/** Pesos como porcentajes que suman 100 (solo las fuentes activas). */
export function weightShares(weights: Weights): Record<SourceKey, number> {
  const total = KEYS.reduce((acc, k) => acc + Math.max(0, weights[k]), 0);
  const out = { imdb: 0, rt: 0, popcorn: 0 } as Record<SourceKey, number>;
  if (total <= 0) return out;
  for (const k of KEYS) out[k] = Math.max(0, weights[k]) / total;
  return out;
}

export function scoreMovie(movie: Movie, settings: RankingSettings): ScoredMovie {
  const { ratings } = movie;
  const imdbRaw = ratings.imdb == null ? null : ratings.imdb * 10;

  let imdb = imdbRaw;
  if (imdbRaw != null && settings.voteConfidence && ratings.imdbVotes != null) {
    imdb = bayesianAverage(imdbRaw, ratings.imdbVotes, settings.minVotes);
  }

  const scores: Record<SourceKey, number | null> = {
    imdb: imdb == null ? null : round1(imdb),
    rt: ratings.rt,
    popcorn: ratings.popcorn,
  };

  const active = KEYS.filter((k) => settings.weights[k] > 0);
  const configuredWeight = active.reduce((acc, k) => acc + settings.weights[k], 0);
  const available = active.filter((k) => scores[k] != null);
  const availableWeight = available.reduce((acc, k) => acc + settings.weights[k], 0);
  const missing = active.filter((k) => scores[k] == null);

  const contributions: Contribution[] = available.map((source) => {
    const value = scores[source] as number;
    const share = settings.weights[source] / availableWeight;
    return { source, value, share, points: value * share };
  });

  const score = availableWeight > 0 ? round1(contributions.reduce((acc, c) => acc + c.points, 0)) : null;

  return {
    movie,
    scores,
    imdbRaw,
    imdbAdjustment: imdb != null && imdbRaw != null ? round1(imdb - imdbRaw) : 0,
    score,
    contributions,
    missing,
    coverage: configuredWeight > 0 ? availableWeight / configuredWeight : 0,
    tier: score == null ? null : tierFor(score),
    consensus: consensusFor(ratings.rt, ratings.popcorn ?? imdbRaw),
  };
}

/** Valor por el que se ordena. Al ordenar por IMDb se usa la nota original. */
export function sortValue(item: ScoredMovie, key: SortKey): number | null {
  switch (key) {
    case 'score':
      return item.score;
    case 'imdb':
      return item.imdbRaw;
    default:
      return item.scores[key];
  }
}

function compare(a: ScoredMovie, b: ScoredMovie, key: SortKey) {
  const va = sortValue(a, key);
  const vb = sortValue(b, key);
  if (va == null && vb == null) return a.movie.title.localeCompare(b.movie.title);
  if (va == null) return 1;
  if (vb == null) return -1;
  if (vb !== va) return vb - va;
  // Desempates objetivos: más fuentes con datos, luego más votos en IMDb.
  if (b.coverage !== a.coverage) return b.coverage - a.coverage;
  const votesA = a.movie.ratings.imdbVotes ?? 0;
  const votesB = b.movie.ratings.imdbVotes ?? 0;
  if (votesB !== votesA) return votesB - votesA;
  return a.movie.title.localeCompare(b.movie.title);
}

export function rankMovies(movies: Movie[], settings: RankingSettings, sortBy: SortKey = 'score'): RankedMovie[] {
  const sorted = movies.map((m) => scoreMovie(m, settings)).sort((a, b) => compare(a, b, sortBy));
  let position = 0;
  return sorted.map((item) => ({
    ...item,
    rank: sortValue(item, sortBy) == null ? null : ++position,
  }));
}

/** True si los dos primeros del ranking están a menos de TIE_THRESHOLD puntos. */
export function isTechnicalTie(ranked: RankedMovie[], sortBy: SortKey = 'score'): boolean {
  const [first, second] = ranked;
  if (!first || !second) return false;
  const a = sortValue(first, sortBy);
  const b = sortValue(second, sortBy);
  return a != null && b != null && Math.abs(a - b) < TIE_THRESHOLD;
}

/** Índices de los mejores valores de una fila (mayor es mejor). Vacío si no hay datos. */
export function bestIndexes(values: (number | null)[]): Set<number> {
  const numbers = values.filter((v): v is number => v != null);
  if (numbers.length < 2) return new Set();
  const max = Math.max(...numbers);
  return new Set(values.flatMap((v, i) => (v === max ? [i] : [])));
}
