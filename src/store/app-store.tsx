/**
 * Estado global de CineRank: clave OMDb, ajustes del ranking y la lista de
 * títulos candidatos. Se guarda en el dispositivo con AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useEffect, useReducer, type ReactNode } from 'react';

import { keepExisting, toggleId } from '@/lib/compare';
import { DEFAULT_EXPLORE, regionFromLocale, sanitizeExplore, type ExploreFilters } from '@/lib/explore';
import { activePlan, sanitizePlan, todayKey, type Company, type Mood, type Plan, type StoredPlan } from '@/lib/plan';
import { AWARDS_BONUS_LEVELS, DEFAULT_SETTINGS } from '@/lib/ranking';
import { upgradeMovie } from '@/lib/omdb-parse';
import type { ApiKeys, MediaType, Movie, RankingSettings, SortKey, Weights } from '@/lib/types';

const STORAGE_KEY = 'cinerank:state:v1';

/** Máximo de títulos a comparar a la vez (mantiene la tabla legible y la cuota baja). */
export const MAX_CANDIDATES = 12;

/** Claves por defecto opcionales, inyectadas en compilación (ver .env.example). */
const ENV_API_KEY = process.env.EXPO_PUBLIC_OMDB_API_KEY ?? '';
const ENV_MDBLIST_KEY = process.env.EXPO_PUBLIC_MDBLIST_API_KEY ?? '';
const ENV_TRAKT_KEY = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID ?? '';
const ENV_TMDB_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY ?? '';

/** País del catálogo por defecto según el idioma del teléfono ("es-CO" → Colombia). */
function deviceRegion() {
  try {
    return regionFromLocale(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return 'MX';
  }
}

export type RuntimeFilter = 0 | 90 | 120 | 150;

export interface AppState {
  hydrated: boolean;
  apiKey: string;
  /** Clave de MDBList (opcional): aporta el puntaje del público de Rotten Tomatoes. */
  mdblistKey: string;
  /** Client ID de Trakt (opcional): aporta la nota de quienes comentan. */
  traktKey: string;
  /** Clave de TMDB (opcional): catálogo por plataforma para «Explorar». */
  tmdbKey: string;
  /** Filtros de «Explorar». */
  explore: ExploreFilters;
  settings: RankingSettings;
  candidates: Movie[];
  /** Títulos de la lista elegidos para enfrentarlos en «¿Cuál es mejor?». */
  compareIds: string[];
  /** Tu plan de hoy (ánimo y compañía). Caduca a medianoche. */
  plan: StoredPlan | null;
  sortBy: SortKey;
  maxRuntime: RuntimeFilter;
  searchType: MediaType;
}

type PersistedState = Omit<AppState, 'hydrated'>;

type Action =
  | { type: 'hydrate'; state: Partial<PersistedState> }
  | { type: 'setApiKey'; apiKey: string }
  | { type: 'setMdblistKey'; mdblistKey: string }
  | { type: 'setTraktKey'; traktKey: string }
  | { type: 'setTmdbKey'; tmdbKey: string }
  | { type: 'setExplore'; explore: Partial<ExploreFilters> }
  | { type: 'setComments'; imdbID: string; comments: number | null; count: number }
  | { type: 'setWeights'; weights: Weights }
  | { type: 'setVoteConfidence'; enabled: boolean }
  | { type: 'setMinVotes'; minVotes: number }
  | { type: 'setAwardsBonus'; awardsBonus: number }
  | { type: 'resetSettings' }
  | { type: 'addCandidate'; movie: Movie }
  | { type: 'removeCandidate'; imdbID: string }
  | { type: 'replaceCandidates'; movies: Movie[] }
  | { type: 'clearCandidates' }
  | { type: 'toggleCompare'; imdbID: string }
  | { type: 'setPlan'; mood: Mood | null; company: Company | null; day: string }
  | { type: 'clearPlan' }
  | { type: 'setSortBy'; sortBy: SortKey }
  | { type: 'setMaxRuntime'; maxRuntime: RuntimeFilter }
  | { type: 'setSearchType'; searchType: MediaType };

const initialState: AppState = {
  hydrated: false,
  apiKey: ENV_API_KEY,
  mdblistKey: ENV_MDBLIST_KEY,
  traktKey: ENV_TRAKT_KEY,
  tmdbKey: ENV_TMDB_KEY,
  explore: { ...DEFAULT_EXPLORE, region: deviceRegion() },
  settings: DEFAULT_SETTINGS,
  candidates: [],
  compareIds: [],
  plan: null,
  sortBy: 'score',
  maxRuntime: 0,
  searchType: 'movie',
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate': {
      const saved = action.state;
      const savedWeights: Partial<Weights> = saved.settings?.weights ?? {};
      const defaults = DEFAULT_SETTINGS.weights;
      const candidates = Array.isArray(saved.candidates) ? saved.candidates.map(upgradeMovie) : [];
      return {
        ...state,
        ...saved,
        apiKey: saved.apiKey || ENV_API_KEY,
        mdblistKey: saved.mdblistKey || ENV_MDBLIST_KEY,
        traktKey: saved.traktKey || ENV_TRAKT_KEY,
        tmdbKey: saved.tmdbKey || ENV_TMDB_KEY,
        explore: sanitizeExplore(saved.explore, deviceRegion()),
        settings: {
          ...DEFAULT_SETTINGS,
          ...saved.settings,
          // Solo las fuentes actuales: versiones anteriores guardaban también Metacritic.
          weights: {
            imdb: savedWeights.imdb ?? defaults.imdb,
            rt: savedWeights.rt ?? defaults.rt,
            popcorn: savedWeights.popcorn ?? defaults.popcorn,
            comments: savedWeights.comments ?? defaults.comments,
          },
          // Versiones anteriores no tenían bonus por premios: se usa el valor por defecto.
          awardsBonus: (AWARDS_BONUS_LEVELS as readonly number[]).includes(saved.settings?.awardsBonus as number)
            ? (saved.settings?.awardsBonus as number)
            : DEFAULT_SETTINGS.awardsBonus,
        },
        candidates,
        compareIds: keepExisting(saved.compareIds, candidates),
        plan: sanitizePlan(saved.plan),
        sortBy: isSortKey(saved.sortBy) ? saved.sortBy : 'score',
        hydrated: true,
      };
    }
    case 'setApiKey':
      return { ...state, apiKey: action.apiKey.trim() };
    case 'setMdblistKey':
      return { ...state, mdblistKey: action.mdblistKey.trim() };
    case 'setTraktKey':
      return { ...state, traktKey: action.traktKey.trim() };
    case 'setTmdbKey':
      return { ...state, tmdbKey: action.tmdbKey.trim() };
    case 'setExplore':
      return { ...state, explore: { ...state.explore, ...action.explore } };
    case 'setComments':
      return {
        ...state,
        candidates: state.candidates.map((m) =>
          m.imdbID === action.imdbID
            ? {
                ...m,
                ratings: { ...m.ratings, comments: action.comments, commentsCount: action.count },
                commentsChecked: true,
              }
            : m,
        ),
      };
    case 'setWeights':
      return { ...state, settings: { ...state.settings, weights: action.weights } };
    case 'setVoteConfidence':
      return { ...state, settings: { ...state.settings, voteConfidence: action.enabled } };
    case 'setMinVotes':
      return { ...state, settings: { ...state.settings, minVotes: action.minVotes } };
    case 'setAwardsBonus':
      return { ...state, settings: { ...state.settings, awardsBonus: action.awardsBonus } };
    case 'resetSettings':
      return { ...state, settings: DEFAULT_SETTINGS };
    case 'addCandidate': {
      const exists = state.candidates.some((m) => m.imdbID === action.movie.imdbID);
      if (exists) {
        return {
          ...state,
          candidates: state.candidates.map((m) => (m.imdbID === action.movie.imdbID ? keepComments(action.movie, m) : m)),
        };
      }
      if (state.candidates.length >= MAX_CANDIDATES) return state;
      return { ...state, candidates: [...state.candidates, action.movie] };
    }
    case 'removeCandidate':
      return {
        ...state,
        candidates: state.candidates.filter((m) => m.imdbID !== action.imdbID),
        compareIds: state.compareIds.filter((id) => id !== action.imdbID),
      };
    case 'replaceCandidates': {
      const fresh = new Map(action.movies.map((m) => [m.imdbID, m]));
      return {
        ...state,
        candidates: state.candidates.map((m) => {
          const next = fresh.get(m.imdbID);
          return next ? keepComments(next, m) : m;
        }),
      };
    }
    case 'clearCandidates':
      return { ...state, candidates: [], compareIds: [] };
    case 'setPlan': {
      const plan = action.mood || action.company ? { mood: action.mood, company: action.company, day: action.day } : null;
      // Al elegir un plan, el ranking pasa a ordenarse «Para hoy»; al quitarlo, vuelve al CineScore.
      const sortBy = plan && state.sortBy === 'score' ? 'today' : !plan && state.sortBy === 'today' ? 'score' : state.sortBy;
      return { ...state, plan, sortBy };
    }
    case 'clearPlan':
      return { ...state, plan: null, sortBy: state.sortBy === 'today' ? 'score' : state.sortBy };
    case 'toggleCompare':
      if (!state.candidates.some((m) => m.imdbID === action.imdbID)) return state;
      return { ...state, compareIds: toggleId(state.compareIds, action.imdbID) };
    case 'setSortBy':
      return { ...state, sortBy: action.sortBy };
    case 'setMaxRuntime':
      return { ...state, maxRuntime: action.maxRuntime };
    case 'setSearchType':
      return { ...state, searchType: action.searchType };
  }
}

/**
 * Las fichas de OMDb/MDBList no traen los comentarios de Trakt (se piden aparte):
 * al reemplazar una ficha se conservan los que ya tenía.
 */
function keepComments(next: Movie, previous: Movie): Movie {
  if (next.commentsChecked || !previous.commentsChecked) return next;
  return {
    ...next,
    ratings: {
      ...next.ratings,
      comments: previous.ratings.comments ?? null,
      commentsCount: previous.ratings.commentsCount ?? null,
    },
    commentsChecked: true,
  };
}

function isSortKey(value: unknown): value is SortKey {
  return ['score', 'today', 'imdb', 'rt', 'popcorn', 'comments'].includes(value as string);
}

interface AppContextValue {
  state: AppState;
  dispatch: (action: Action) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => (raw ? (JSON.parse(raw) as Partial<PersistedState>) : {}))
      .catch(() => ({}))
      .then((saved) => {
        if (!cancelled) dispatch({ type: 'hydrate', state: saved });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    const { hydrated: _hydrated, ...persisted } = state;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persisted)).catch(() => {
      // Si no se puede guardar, la app sigue funcionando en memoria.
    });
  }, [state]);

  return <AppContext value={{ state, dispatch }}>{children}</AppContext>;
}

export function useApp() {
  const ctx = use(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>');
  return ctx;
}

/** Las dos claves de API juntas, como las piden getMovie y searchCatalog. */
export function useApiKeys(): ApiKeys {
  const { state } = useApp();
  return { omdb: state.apiKey, mdblist: state.mdblistKey };
}

/** Tu plan de hoy, o null si no hay o si es de otro día. */
export function useActivePlan(): Plan | null {
  const { state } = useApp();
  return activePlan(state.plan, todayKey());
}

export function useIsCandidate(imdbID: string) {
  const { state } = useApp();
  return state.candidates.some((m) => m.imdbID === imdbID);
}
