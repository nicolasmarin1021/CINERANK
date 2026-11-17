/**
 * Estado global de CineRank: clave OMDb, ajustes del ranking y la lista de
 * títulos candidatos. Se guarda en el dispositivo con AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useEffect, useReducer, type ReactNode } from 'react';

import { keepExisting, toggleId } from '@/lib/compare';
import { AWARDS_BONUS_LEVELS, DEFAULT_SETTINGS } from '@/lib/ranking';
import { upgradeMovie } from '@/lib/omdb-parse';
import type { ApiKeys, MediaType, Movie, RankingSettings, SortKey, Weights } from '@/lib/types';

const STORAGE_KEY = 'cinerank:state:v1';

/** Máximo de títulos a comparar a la vez (mantiene la tabla legible y la cuota baja). */
export const MAX_CANDIDATES = 12;

/** Claves por defecto opcionales, inyectadas en compilación (ver .env.example). */
const ENV_API_KEY = process.env.EXPO_PUBLIC_OMDB_API_KEY ?? '';
const ENV_MDBLIST_KEY = process.env.EXPO_PUBLIC_MDBLIST_API_KEY ?? '';

export type RuntimeFilter = 0 | 90 | 120 | 150;

export interface AppState {
  hydrated: boolean;
  apiKey: string;
  /** Clave de MDBList (opcional): aporta el puntaje del público de Rotten Tomatoes. */
  mdblistKey: string;
  settings: RankingSettings;
  candidates: Movie[];
  /** Títulos de la lista elegidos para enfrentarlos en «¿Cuál es mejor?». */
  compareIds: string[];
  sortBy: SortKey;
  maxRuntime: RuntimeFilter;
  searchType: MediaType;
}

type PersistedState = Omit<AppState, 'hydrated'>;

type Action =
  | { type: 'hydrate'; state: Partial<PersistedState> }
  | { type: 'setApiKey'; apiKey: string }
  | { type: 'setMdblistKey'; mdblistKey: string }
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
  | { type: 'setSortBy'; sortBy: SortKey }
  | { type: 'setMaxRuntime'; maxRuntime: RuntimeFilter }
  | { type: 'setSearchType'; searchType: MediaType };

const initialState: AppState = {
  hydrated: false,
  apiKey: ENV_API_KEY,
  mdblistKey: ENV_MDBLIST_KEY,
  settings: DEFAULT_SETTINGS,
  candidates: [],
  compareIds: [],
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
        settings: {
          ...DEFAULT_SETTINGS,
          ...saved.settings,
          // Solo las fuentes actuales: versiones anteriores guardaban también Metacritic.
          weights: {
            imdb: savedWeights.imdb ?? defaults.imdb,
            rt: savedWeights.rt ?? defaults.rt,
            popcorn: savedWeights.popcorn ?? defaults.popcorn,
          },
          // Versiones anteriores no tenían bonus por premios: se usa el valor por defecto.
          awardsBonus: (AWARDS_BONUS_LEVELS as readonly number[]).includes(saved.settings?.awardsBonus as number)
            ? (saved.settings?.awardsBonus as number)
            : DEFAULT_SETTINGS.awardsBonus,
        },
        candidates,
        compareIds: keepExisting(saved.compareIds, candidates),
        sortBy: isSortKey(saved.sortBy) ? saved.sortBy : 'score',
        hydrated: true,
      };
    }
    case 'setApiKey':
      return { ...state, apiKey: action.apiKey.trim() };
    case 'setMdblistKey':
      return { ...state, mdblistKey: action.mdblistKey.trim() };
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
          candidates: state.candidates.map((m) => (m.imdbID === action.movie.imdbID ? action.movie : m)),
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
      return { ...state, candidates: state.candidates.map((m) => fresh.get(m.imdbID) ?? m) };
    }
    case 'clearCandidates':
      return { ...state, candidates: [], compareIds: [] };
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

function isSortKey(value: unknown): value is SortKey {
  return value === 'score' || value === 'imdb' || value === 'rt' || value === 'popcorn';
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

export function useIsCandidate(imdbID: string) {
  const { state } = useApp();
  return state.candidates.some((m) => m.imdbID === imdbID);
}
