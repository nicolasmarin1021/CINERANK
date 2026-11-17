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
 * 4. Suma un bonus por premios (Óscar, Emmy…), que nunca resta: un título sin
 *    premios no se penaliza.
 *
 * Archivo puro (sin React Native) para poder probarlo con `node --test`.
 */
import { awardsStrength, parseAwards, type AwardsInfo } from './awards.ts';
import { planFit as computePlanFit, type Plan, type PlanFit } from './plan.ts';
import type { Movie, RankingSettings, SortKey, SourceKey, Weights } from './types';

const KEYS: readonly SourceKey[] = ['imdb', 'rt', 'popcorn', 'comments'];

/** Valor previo del promedio bayesiano: la nota media aproximada en IMDb (6.5/10). */
export const IMDB_PRIOR = 65;

/** Diferencia (puntos) entre crítica y público a partir de la cual hablamos de división. */
export const CONSENSUS_GAP = 15;

/** Diferencia de CineScore por debajo de la cual dos títulos están en empate técnico. */
export const TIE_THRESHOLD = 2;

export const DEFAULT_SETTINGS: RankingSettings = {
  weights: { imdb: 50, rt: 50, popcorn: 50, comments: 25 },
  voteConfidence: true,
  minVotes: 10_000,
  awardsBonus: 6,
};

/** Niveles del bonus por premios que se ofrecen en Ajustes (puntos máximos). */
export const AWARDS_BONUS_LEVELS = [0, 3, 6, 10] as const;

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
  /** CineScore 0–100 con un decimal (incluye el bonus por premios), o null si no hay datos con peso. */
  score: number | null;
  /** Media ponderada de las fuentes, antes del bonus por premios. */
  baseScore: number | null;
  /** Premios según OMDb, o null si no tiene. */
  awards: AwardsInfo | null;
  /** Puntos sumados por premios (0 si no tiene o si el bonus está desactivado). */
  awardsBonus: number;
  /** Encaje con tu plan de hoy, o null si no hay plan (o nada que evaluar). */
  planFit: PlanFit | null;
  /** CineScore menos el desajuste con tu plan de hoy (igual al CineScore sin plan). */
  todayScore: number | null;
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
  const total = KEYS.reduce((acc, k) => acc + Math.max(0, weights[k] ?? 0), 0);
  const out = { imdb: 0, rt: 0, popcorn: 0, comments: 0 } as Record<SourceKey, number>;
  if (total <= 0) return out;
  for (const k of KEYS) out[k] = Math.max(0, weights[k] ?? 0) / total;
  return out;
}

export function scoreMovie(movie: Movie, settings: RankingSettings, plan: Plan | null = null): ScoredMovie {
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
    comments: ratings.comments ?? null,
  };

  const active = KEYS.filter((k) => (settings.weights[k] ?? 0) > 0);
  const configuredWeight = active.reduce((acc, k) => acc + settings.weights[k], 0);
  const available = active.filter((k) => scores[k] != null);
  const availableWeight = available.reduce((acc, k) => acc + settings.weights[k], 0);
  const missing = active.filter((k) => scores[k] == null);

  const contributions: Contribution[] = available.map((source) => {
    const value = scores[source] as number;
    const share = settings.weights[source] / availableWeight;
    return { source, value, share, points: value * share };
  });

  const baseScore = availableWeight > 0 ? round1(contributions.reduce((acc, c) => acc + c.points, 0)) : null;
  const awards = parseAwards(movie.awards);
  const awardsBonus =
    baseScore == null ? 0 : round1(Math.max(0, settings.awardsBonus ?? 0) * awardsStrength(awards));
  const score = baseScore == null ? null : Math.min(100, round1(baseScore + awardsBonus));
  const fit = plan ? computePlanFit(movie, plan) : null;
  const todayScore = score == null ? null : fit ? Math.max(0, round1(score - fit.penalty)) : score;

  return {
    movie,
    scores,
    imdbRaw,
    imdbAdjustment: imdb != null && imdbRaw != null ? round1(imdb - imdbRaw) : 0,
    score,
    baseScore,
    awards,
    awardsBonus,
    planFit: fit,
    todayScore,
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
    case 'today':
      return item.todayScore;
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

export function rankMovies(
  movies: Movie[],
  settings: RankingSettings,
  sortBy: SortKey = 'score',
  plan: Plan | null = null,
): RankedMovie[] {
  const sorted = movies.map((m) => scoreMovie(m, settings, plan)).sort((a, b) => compare(a, b, sortBy));
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
