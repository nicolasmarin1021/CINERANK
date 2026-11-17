/**
 * Fuentes de calificación que CineRank sabe combinar:
 * - imdb: nota de los usuarios de IMDb (0–10).
 * - rt: Tomatómetro de Rotten Tomatoes, la crítica (los "tomates").
 * - popcorn: Popcornmeter de Rotten Tomatoes, el público (las "palomitas").
 */
export type SourceKey = 'imdb' | 'rt' | 'popcorn';

export const SOURCE_KEYS: readonly SourceKey[] = ['imdb', 'rt', 'popcorn'];

export const SOURCE_LABEL: Record<SourceKey, string> = {
  imdb: 'IMDb',
  rt: 'RT crítica',
  popcorn: 'RT público',
};

export const SOURCE_SHORT: Record<SourceKey, string> = {
  imdb: 'IMDb',
  rt: 'RT crítica',
  popcorn: 'RT público',
};

/** Qué representa cada fuente, para explicarlo en la interfaz. */
export const SOURCE_AUDIENCE: Record<SourceKey, string> = {
  imdb: 'Usuarios de IMDb',
  rt: 'Crítica de Rotten Tomatoes',
  popcorn: 'Público de Rotten Tomatoes',
};

export type MediaType = 'movie' | 'series';

/** Claves de las APIs. La de MDBList es opcional (solo aporta RT público). */
export interface ApiKeys {
  omdb: string;
  mdblist: string;
}

/** Resultado de búsqueda (OMDb `s=`): no trae calificaciones. */
export interface SearchHit {
  imdbID: string;
  title: string;
  year: string;
  type: string;
  poster: string | null;
}

export interface MovieRatings {
  /** Nota IMDb de 0 a 10. */
  imdb: number | null;
  /** Número de votos en IMDb. */
  imdbVotes: number | null;
  /** Tomatómetro de Rotten Tomatoes, 0 a 100 (% de reseñas positivas de la crítica). */
  rt: number | null;
  /** Popcornmeter de Rotten Tomatoes, 0 a 100 (% del público que la valora bien). */
  popcorn: number | null;
}

/** Plataforma donde se puede ver o alquilar (IDs de TMDB/JustWatch, vía MDBList). */
export interface WatchProvider {
  id: number;
  name: string;
}

/** Ficha completa normalizada (OMDb `i=` + MDBList). */
export interface Movie {
  imdbID: string;
  title: string;
  year: string;
  type: string;
  poster: string | null;
  rated: string | null;
  released: string | null;
  runtimeMin: number | null;
  genres: string[];
  director: string | null;
  actors: string | null;
  plot: string | null;
  country: string | null;
  language: string | null;
  awards: string | null;
  ratings: MovieRatings;
  /** True si ya se consultó MDBList para el puntaje del público de RT. */
  audienceChecked: boolean;
  /** Plataformas según MDBList (disponibilidad en EE. UU.). null: aún sin consultar. */
  providers: WatchProvider[] | null;
  /** Momento (ms) en que se descargaron los datos. */
  fetchedAt: number;
}

/** Pesos 0–100 de cada fuente. Un peso 0 excluye la fuente del CineScore. */
export type Weights = Record<SourceKey, number>;

export interface RankingSettings {
  weights: Weights;
  /** Corrige la nota IMDb de títulos con pocos votos (promedio bayesiano). */
  voteConfidence: boolean;
  /** Votos necesarios para confiar plenamente en la nota IMDb. */
  minVotes: number;
}

export type SortKey = 'score' | SourceKey;
