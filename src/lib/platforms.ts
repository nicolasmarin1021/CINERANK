/**
 * Convierte las plataformas de MDBList (IDs de TMDB/JustWatch) en insignias
 * cortas con el color de cada servicio. Sin dependencias de React Native.
 */
import type { WatchProvider } from './types';

export type PlatformKind = 'stream' | 'rent';

export interface Platform {
  key: string;
  /** Nombre para leer en voz alta y en accesibilidad. */
  name: string;
  /** Texto de la insignia. */
  short: string;
  bg: string;
  fg: string;
  kind: PlatformKind;
}

interface Rule extends Platform {
  ids: number[];
  match: RegExp;
}

// En orden de preferencia: primero suscripción, después alquiler o compra.
const RULES: Rule[] = [
  { key: 'netflix', name: 'Netflix', short: 'N', bg: '#E50914', fg: '#FFFFFF', kind: 'stream', ids: [8, 1796], match: /^netflix\b/i },
  { key: 'prime', name: 'Prime Video', short: 'prime', bg: '#1A98FF', fg: '#FFFFFF', kind: 'stream', ids: [9, 119, 2100], match: /^(amazon )?prime video\b/i },
  { key: 'disney', name: 'Disney+', short: 'D+', bg: '#113CCF', fg: '#FFFFFF', kind: 'stream', ids: [337], match: /^disney\s?(\+|plus)/i },
  { key: 'max', name: 'HBO Max', short: 'max', bg: '#3B1FB5', fg: '#FFFFFF', kind: 'stream', ids: [384, 1899], match: /^(hbo )?max$/i },
  { key: 'appletv', name: 'Apple TV+', short: 'tv+', bg: '#000000', fg: '#FFFFFF', kind: 'stream', ids: [350], match: /^apple tv(\+| plus)$/i },
  { key: 'paramount', name: 'Paramount+', short: 'P+', bg: '#0064FF', fg: '#FFFFFF', kind: 'stream', ids: [531], match: /^paramount\s?(\+|plus)/i },
  { key: 'hulu', name: 'Hulu', short: 'hulu', bg: '#1CE783', fg: '#0B0C0F', kind: 'stream', ids: [15], match: /^hulu$/i },
  { key: 'peacock', name: 'Peacock', short: 'P', bg: '#000000', fg: '#FFFFFF', kind: 'stream', ids: [386, 387], match: /^peacock/i },
  { key: 'crunchyroll', name: 'Crunchyroll', short: 'CR', bg: '#F47521', fg: '#FFFFFF', kind: 'stream', ids: [283], match: /^crunchyroll/i },
  { key: 'mubi', name: 'MUBI', short: 'M', bg: '#001489', fg: '#FFFFFF', kind: 'stream', ids: [11], match: /^mubi/i },
  { key: 'vix', name: 'ViX', short: 'ViX', bg: '#FF5A00', fg: '#FFFFFF', kind: 'stream', ids: [457], match: /^vix/i },
  { key: 'apple-store', name: 'Apple TV', short: 'tv', bg: '#1C1C1E', fg: '#FFFFFF', kind: 'rent', ids: [2], match: /^(apple tv store|apple itunes|itunes)$/i },
  { key: 'google-play', name: 'Google Play', short: 'GP', bg: '#01875F', fg: '#FFFFFF', kind: 'rent', ids: [3], match: /^google play/i },
  { key: 'amazon-video', name: 'Amazon', short: 'a', bg: '#232F3E', fg: '#FFFFFF', kind: 'rent', ids: [10], match: /^amazon video$/i },
  { key: 'youtube', name: 'YouTube', short: '▶', bg: '#FF0000', fg: '#FFFFFF', kind: 'rent', ids: [192], match: /^youtube$/i },
];

/** Los "canales" (p. ej. "HBO Max Amazon Channel") repiten un servicio que ya aparece por sí solo. */
const isChannel = (p: WatchProvider) => /channel/i.test(p.name);

function ruleFor(p: WatchProvider): Rule | undefined {
  if (isChannel(p)) return undefined;
  return RULES.find((r) => r.ids.includes(p.id)) ?? RULES.find((r) => r.match.test(p.name));
}

/**
 * Plataformas que no tienen insignia propia (p. ej. Claro video), sin canales ni repetidas,
 * para nombrarlas aparte.
 */
export function otherPlatforms(providers: readonly WatchProvider[]): string[] {
  const names: string[] = [];
  for (const p of providers) {
    const name = p.name.replace(/\s+(standard|basic)?\s*with\s+ads$/i, '').trim();
    if (!isChannel(p) && !ruleFor(p) && !names.includes(name)) names.push(name);
  }
  return names;
}

/**
 * Plataformas a mostrar: las de suscripción (hasta `maxStream`); si no hay
 * ninguna, las de alquiler o compra (hasta `maxRent`). Servicios desconocidos se omiten.
 */
export function platformsFor(
  providers: readonly WatchProvider[] | null | undefined,
  { maxStream = 4, maxRent = 3 } = {},
): { kind: PlatformKind | 'none'; items: Platform[] } {
  const found = new Map<string, Rule>();
  for (const p of providers ?? []) {
    const rule = ruleFor(p);
    if (rule) found.set(rule.key, rule);
  }
  const ordered = RULES.filter((r) => found.has(r.key)).map(
    ({ ids: _ids, match: _match, ...platform }): Platform => platform,
  );
  const stream = ordered.filter((p) => p.kind === 'stream');
  if (stream.length > 0) return { kind: 'stream', items: stream.slice(0, maxStream) };
  const rent = ordered.filter((p) => p.kind === 'rent');
  if (rent.length > 0) return { kind: 'rent', items: rent.slice(0, maxRent) };
  return { kind: 'none', items: [] };
}
