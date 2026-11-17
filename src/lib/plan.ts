/**
 * «Tu plan de hoy»: qué te apetece y con quién la ves. No cambia el CineScore
 * (la calidad); calcula cuánto encaja cada título con el plan y le resta
 * hasta PLAN_MAX_PENALTY puntos en la puntuación «Para hoy» si no encaja.
 *
 * Usa datos que ya trae OMDb: géneros (en inglés), clasificación por edad
 * (de EE. UU.) y duración. Archivo puro (sin React Native) para probarlo con `node --test`.
 */
import type { Movie } from './types';

export type Mood = 'laugh' | 'thrill' | 'feel' | 'think' | 'scare' | 'light';
export type Company = 'solo' | 'couple' | 'friends' | 'family';

export interface Plan {
  mood: Mood | null;
  company: Company | null;
}

/** Plan guardado con el día en que se eligió: caduca a medianoche. */
export interface StoredPlan extends Plan {
  day: string;
}

export type FitLabel = 'Encaja' | 'A medias' | 'No encaja';

export interface PlanFit {
  /** 0 (choca con el plan) a 1 (encaja del todo). */
  fit: number;
  /** Puntos que se restan en «Para hoy» (0 a PLAN_MAX_PENALTY). */
  penalty: number;
  label: FitLabel;
  /** Motivos cortos, en español. */
  reasons: string[];
  /** En familia: clasificación para adultos. */
  notForKids: boolean;
}

/** Lo máximo que puede bajar un título por no encajar con el plan. */
export const PLAN_MAX_PENALTY = 15;

export const MOODS: { value: Mood; label: string; emoji: string }[] = [
  { value: 'laugh', label: 'Reír', emoji: '😂' },
  { value: 'thrill', label: 'Adrenalina', emoji: '⚡' },
  { value: 'feel', label: 'Emocionarme', emoji: '🥹' },
  { value: 'think', label: 'Pensar', emoji: '🧠' },
  { value: 'scare', label: 'Pasar miedo', emoji: '👻' },
  { value: 'light', label: 'Algo ligero', emoji: '🛋️' },
];

export const COMPANIES: { value: Company; label: string; short: string }[] = [
  { value: 'solo', label: 'Solo', short: 'Solo' },
  { value: 'couple', label: 'En pareja', short: 'En pareja' },
  { value: 'friends', label: 'Con amigos', short: 'Con amigos' },
  { value: 'family', label: 'En familia, con niños', short: 'En familia' },
];

/** Para frases: "ideal para reír", "no pega para pasar miedo". */
const MOOD_GOAL: Record<Mood, string> = {
  laugh: 'reír',
  thrill: 'buscar adrenalina',
  feel: 'emocionarte',
  think: 'pensar',
  scare: 'pasar miedo',
  light: 'algo ligero',
};

const MOOD_PHRASE: Record<Mood, string> = {
  laugh: 'para reír',
  thrill: 'con adrenalina',
  feel: 'para emocionarte',
  think: 'para pensar',
  scare: 'para pasar miedo',
  light: 'para algo ligero',
};

const COMPANY_PHRASE: Record<Company, string> = {
  solo: 'a solas',
  couple: 'en pareja',
  friends: 'con amigos',
  family: 'en familia',
};

const MOOD_MISSING: Record<Mood, string> = {
  laugh: 'No es una comedia',
  thrill: 'No es de acción ni de suspense',
  feel: 'No es un drama ni un romance',
  think: 'No es de misterio ni de ideas',
  scare: 'No es de terror',
  light: 'No es una película ligera',
};

/**
 * Afinidad de cada género (nombres de OMDb en minúsculas) con cada ánimo:
 * 1 = ideal, 0.5 = funciona, negativo = choca. Ajustable sin tocar el resto.
 */
const MOOD_GENRES: Record<Mood, Record<string, number>> = {
  laugh: {
    comedy: 1,
    animation: 0.5,
    family: 0.5,
    romance: 0.3,
    musical: 0.3,
    horror: -1,
    war: -0.8,
    thriller: -0.4,
    documentary: -0.3,
    crime: -0.3,
    drama: -0.2,
  },
  thrill: {
    action: 1,
    thriller: 1,
    adventure: 0.7,
    'sci-fi': 0.5,
    crime: 0.5,
    war: 0.5,
    horror: 0.4,
    sport: 0.3,
    western: 0.3,
    documentary: -0.6,
    musical: -0.6,
    romance: -0.5,
    family: -0.3,
    biography: -0.3,
  },
  feel: {
    drama: 1,
    romance: 0.8,
    biography: 0.6,
    family: 0.5,
    music: 0.4,
    animation: 0.3,
    sport: 0.3,
    horror: -0.6,
    action: -0.2,
  },
  think: {
    mystery: 1,
    documentary: 0.8,
    'sci-fi': 0.7,
    drama: 0.6,
    history: 0.6,
    biography: 0.5,
    crime: 0.4,
    thriller: 0.3,
    family: -0.4,
    animation: -0.3,
    musical: -0.3,
  },
  scare: {
    horror: 1,
    thriller: 0.6,
    mystery: 0.4,
    family: -1,
    animation: -0.8,
    musical: -0.7,
    comedy: -0.5,
    romance: -0.5,
  },
  light: {
    comedy: 1,
    animation: 0.8,
    family: 0.8,
    romance: 0.6,
    musical: 0.5,
    adventure: 0.4,
    war: -1,
    horror: -0.8,
    drama: -0.4,
    history: -0.4,
    biography: -0.3,
  },
};

/** Géneros que restan según la compañía (en pareja y con amigos casi todo vale). */
const COMPANY_GENRES: Record<'couple' | 'friends', Record<string, number>> = {
  couple: { war: -0.3, documentary: -0.2, horror: -0.1 },
  friends: { documentary: -0.4, biography: -0.3, history: -0.3, musical: -0.2 },
};

const GENRE_ES: Record<string, string> = {
  action: 'Acción',
  adventure: 'Aventura',
  animation: 'Animación',
  biography: 'Biografía',
  comedy: 'Comedia',
  crime: 'Crimen',
  documentary: 'Documental',
  drama: 'Drama',
  family: 'Familiar',
  fantasy: 'Fantasía',
  history: 'Historia',
  horror: 'Terror',
  music: 'Música',
  musical: 'Musical',
  mystery: 'Misterio',
  romance: 'Romance',
  'sci-fi': 'Ciencia ficción',
  sport: 'Deporte',
  thriller: 'Thriller',
  war: 'Bélica',
  western: 'Western',
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round1 = (n: number) => Math.round(n * 10) / 10;
const genresOf = (movie: Movie) => movie.genres.map((g) => g.trim().toLowerCase()).filter(Boolean);
const es = (genre: string) => GENRE_ES[genre] ?? genre;

function runtimeText(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}

type Part = { fit: number; reasons: string[]; notForKids?: boolean };

function moodFit(movie: Movie, mood: Mood): Part | null {
  const genres = genresOf(movie);
  if (genres.length === 0) return null;
  const weights = MOOD_GENRES[mood];
  let best = 0;
  let worst = 0;
  let worstGenre = '';
  for (const g of genres) {
    const w = weights[g] ?? 0;
    if (w > best) best = w;
    if (w < worst) {
      worst = w;
      worstGenre = g;
    }
  }
  let fit = 0.5 + 0.5 * best + 0.5 * worst;
  const reasons: string[] = [];
  const good = genres.filter((g) => (weights[g] ?? 0) >= 0.5);
  if (good.length > 0) reasons.push(`${good.slice(0, 2).map(es).join(' y ')}: ideal para ${MOOD_GOAL[mood]}`);
  if (worst <= -0.5) reasons.push(`${es(worstGenre)}: no pega para ${MOOD_GOAL[mood]}`);
  if (good.length === 0 && worst > -0.5) reasons.push(MOOD_MISSING[mood]);

  if (mood === 'light' && movie.runtimeMin != null) {
    if (movie.runtimeMin > 150) {
      fit -= 0.25;
      reasons.push(`Larga (${runtimeText(movie.runtimeMin)}) para algo ligero`);
    } else if (movie.runtimeMin > 130) {
      fit -= 0.1;
    } else if (movie.runtimeMin <= 100) {
      fit += 0.1;
    }
  }
  return { fit: clamp01(fit), reasons };
}

export type AgeRating = 'kids' | 'teen' | 'adult' | 'unknown';

/** Clasificación por edad de EE. UU. (la que da OMDb) en cuatro grupos. */
export function ageRating(rated: string | null): AgeRating {
  const r = (rated ?? '').trim().toUpperCase();
  if (['G', 'PG', 'TV-Y', 'TV-Y7', 'TV-Y7-FV', 'TV-G', 'TV-PG'].includes(r)) return 'kids';
  if (['PG-13', 'TV-14'].includes(r)) return 'teen';
  if (['R', 'NC-17', 'TV-MA', 'X'].includes(r)) return 'adult';
  return 'unknown';
}

function companyFit(movie: Movie, company: Company): Part | null {
  if (company === 'solo') return null;
  const genres = genresOf(movie);

  if (company === 'family') {
    const rating = ageRating(movie.rated);
    let fit = { kids: 1, teen: 0.6, adult: 0, unknown: 0.6 }[rating];
    const reasons = [
      {
        kids: `Clasificación ${movie.rated}: apta para niños`,
        teen: `Clasificación ${movie.rated}: mejor con niños mayores`,
        adult: `Clasificación ${movie.rated}: no apta para niños`,
        unknown: 'Sin clasificación por edad: revísala antes',
      }[rating],
    ];
    if (rating !== 'kids' && (genres.includes('family') || genres.includes('animation'))) fit += 0.15;
    if (genres.includes('horror')) {
      fit -= 0.3;
      reasons.push('Terror: no pega con niños');
    }
    return { fit: clamp01(fit), reasons, notForKids: rating === 'adult' };
  }

  const weights = COMPANY_GENRES[company];
  let worst = 0;
  let worstGenre = '';
  for (const g of genres) {
    const w = weights[g] ?? 0;
    if (w < worst) {
      worst = w;
      worstGenre = g;
    }
  }
  let fit = 1 + worst;
  const reasons: string[] = [];
  if (worst <= -0.3) reasons.push(`${es(worstGenre)}: no pega ${COMPANY_PHRASE[company]}`);
  if (company === 'friends' && movie.runtimeMin != null && movie.runtimeMin > 160) {
    fit -= 0.15;
    reasons.push('Muy larga para ver en grupo');
  }
  return { fit: clamp01(fit), reasons };
}

/**
 * Encaje de un título con el plan. null si el plan no aporta nada que evaluar
 * (p. ej. solo "Solo", o un título sin géneros cuando solo se eligió el ánimo).
 */
export function planFit(movie: Movie, plan: Plan): PlanFit | null {
  const mood = plan.mood ? moodFit(movie, plan.mood) : null;
  const company = plan.company ? companyFit(movie, plan.company) : null;
  if (!mood && !company) return null;

  const fit = mood && company ? 0.6 * mood.fit + 0.4 * company.fit : (mood ?? company)!.fit;
  const notForKids = company?.notForKids ?? false;
  // Una película para adultos en un plan familiar pierde siempre el máximo.
  const penalty = notForKids ? PLAN_MAX_PENALTY : round1(PLAN_MAX_PENALTY * (1 - fit));
  const label: FitLabel = notForKids ? 'No encaja' : fit >= 0.85 ? 'Encaja' : fit >= 0.45 ? 'A medias' : 'No encaja';
  return {
    fit: Math.round(fit * 100) / 100,
    penalty,
    label,
    reasons: [...(mood?.reasons ?? []), ...(company?.reasons ?? [])].slice(0, 3),
    notForKids,
  };
}

/** "Reír · En familia" */
export function planSummary(plan: Plan): string {
  return [
    MOODS.find((m) => m.value === plan.mood)?.label,
    COMPANIES.find((c) => c.value === plan.company)?.short,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** "para reír en familia" */
export function planPhrase(plan: Plan): string {
  return [plan.mood ? MOOD_PHRASE[plan.mood] : null, plan.company ? COMPANY_PHRASE[plan.company] : null]
    .filter(Boolean)
    .join(' ');
}

/** Día local "AAAA-MM-DD": el plan solo vale el día en que se eligió. */
export function todayKey(date: Date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** El plan guardado si es de hoy y tiene algo elegido; si no, null. */
export function activePlan(stored: StoredPlan | null | undefined, day: string): Plan | null {
  if (!stored || stored.day !== day || (!stored.mood && !stored.company)) return null;
  return { mood: stored.mood, company: stored.company };
}

/** Valida un plan leído del almacenamiento (versiones anteriores no lo tenían). */
export function sanitizePlan(raw: unknown): StoredPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<StoredPlan>;
  const mood = MOODS.some((m) => m.value === r.mood) ? (r.mood as Mood) : null;
  const company = COMPANIES.some((c) => c.value === r.company) ? (r.company as Company) : null;
  if (typeof r.day !== 'string' || (!mood && !company)) return null;
  return { mood, company, day: r.day };
}
