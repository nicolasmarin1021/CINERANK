import { Platform } from 'react-native';

import type { TierKey } from '@/lib/ranking';
import type { SourceKey } from '@/lib/types';

/**
 * Paleta "Broadway": escenario negro cálido, texto marfil (luz de marquesina),
 * un único acento dorado y el rojo del telón para la marca y las acciones de borrar.
 * Todos los textos superan 4,5:1 de contraste sobre el fondo y los paneles.
 */
export const Palette = {
  /** Escenario */
  background: '#0A0908',
  /** Butaca: paneles y campos */
  surface: '#161311',
  surfaceRaised: '#211C18',
  surfacePressed: '#2A2420',
  /** Líneas finas que separan sin hacer ruido */
  border: 'rgba(246, 241, 231, 0.08)',
  borderStrong: 'rgba(246, 241, 231, 0.22)',
  /** Marfil */
  text: '#F6F1E7',
  /** Humo */
  textSecondary: '#B5ADA0',
  /** Ceniza */
  textMuted: '#948B7E',
  /** Oro marquesina: el único acento */
  accent: '#E3B24F',
  accentSoft: 'rgba(227, 178, 79, 0.14)',
  /** Texto sobre marfil u oro */
  onLight: '#0A0908',
  /** Telón */
  curtain: '#B21E35',
  danger: '#E85D6D',
  dangerSoft: 'rgba(232, 93, 109, 0.14)',
  warning: '#C9824A',
  warningSoft: 'rgba(201, 130, 74, 0.14)',
  scrim: 'rgba(0, 0, 0, 0.6)',
} as const;

/** Color de cada fuente para reconocerla de un vistazo: amarillo IMDb, rojo tomate y azul palomitas. */
export const SourceColor: Record<SourceKey, string> = {
  imdb: '#F5C518',
  rt: '#FA5A3C',
  popcorn: '#5AB8FF',
};

/** Escala cálida de niveles: oro, champán, humo, cobre y telón. */
export const TierColor: Record<TierKey, string> = {
  essential: '#E3B24F',
  great: '#D9C9A3',
  good: '#B5ADA0',
  mixed: '#C9824A',
  avoid: '#E85D6D',
};

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
  seven: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

/** Espacio que ocupa la barra de pestañas nativa sobre el contenido. */
export const BottomTabInset = Platform.select({ ios: 50, android: 80, web: 60 }) ?? 0;
export const MaxContentWidth = 720;

/** Tipografía teatral (art déco de marquesina) para el logo. Se carga en app/_layout.tsx. */
export const Fonts = { marquee: 'Limelight_400Regular' } as const;
