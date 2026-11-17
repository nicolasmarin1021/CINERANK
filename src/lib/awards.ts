/**
 * Premios de un título a partir del campo `Awards` de OMDb, por ejemplo:
 *   "Won 2 Oscars. 126 wins & 375 nominations total"
 *   "Nominated for 1 Oscar. 4 wins & 20 nominations"
 *   "Won 3 Primetime Emmys. 50 wins & 90 nominations total"
 *   "3 wins & 5 nominations"
 * OMDb solo nombra el premio principal (Óscar, Emmy, BAFTA o Globo de Oro);
 * el resto (festivales, críticos, sindicatos…) va en el total.
 *
 * Archivo puro (sin React Native) para poder probarlo con `node --test`.
 */

export type AwardKind = 'oscar' | 'emmy' | 'bafta' | 'globe';

export interface AwardsInfo {
  /** Premio principal que destaca OMDb, ganado o solo nominado. */
  headline: { kind: AwardKind; won: number; nominated: number } | null;
  /** Premios ganados en total (incluye los del premio principal). */
  wins: number;
  /** Nominaciones en total. */
  nominations: number;
}

const KINDS: [AwardKind, RegExp][] = [
  ['oscar', /oscars?/i],
  ['emmy', /emmys?/i],
  ['bafta', /bafta/i],
  ['globe', /golden globes?/i],
];

export function parseAwards(text: string | null | undefined): AwardsInfo | null {
  const value = text?.trim();
  if (!value || /^n\/?a$/i.test(value)) return null;

  let headline: AwardsInfo['headline'] = null;
  const h = value.match(/\b(won|nominated for)\s+(\d+)\s+([a-z ]+?)\s*(?:\.|$)/i);
  const kind = h ? KINDS.find(([, re]) => re.test(h[3]))?.[0] : undefined;
  if (h && kind) {
    const n = Number(h[2]);
    const won = /^won/i.test(h[1]);
    headline = { kind, won: won ? n : 0, nominated: won ? 0 : n };
  }
  const wins = Number(value.match(/(\d+)\s+wins?\b/i)?.[1] ?? 0);
  const nominations = Number(value.match(/(\d+)\s+nominations?\b/i)?.[1] ?? 0);

  if (!headline && wins === 0 && nominations === 0) return null;
  return { headline, wins, nominations };
}

// Un Óscar ganado pesa más que cualquier otra cosa; el resto de premios suma
// en escala logarítmica (126 premios de festivales no valen 126 veces uno).
const WIN_POINTS: Record<AwardKind, number> = { oscar: 5, emmy: 3, bafta: 2.5, globe: 2.5 };
const NOMINATION_POINTS: Record<AwardKind, number> = { oscar: 2, emmy: 1, bafta: 0.8, globe: 0.8 };
/** Puntos con los que el bonus llega al 63 % de su máximo. */
const SATURATION = 8;

export function awardsPoints(info: AwardsInfo | null): number {
  if (!info) return 0;
  const h = info.headline;
  const headline = h ? WIN_POINTS[h.kind] * h.won + NOMINATION_POINTS[h.kind] * h.nominated : 0;
  return headline + Math.log2(1 + info.wins) + 0.3 * Math.log2(1 + info.nominations);
}

/** Fuerza de los premios entre 0 (ninguno) y casi 1 (varios Óscar); se multiplica por el bonus máximo. */
export function awardsStrength(info: AwardsInfo | null): number {
  return 1 - Math.exp(-awardsPoints(info) / SATURATION);
}

function awardName(kind: AwardKind, n: number) {
  if (kind === 'oscar') return 'Óscar';
  if (kind === 'emmy') return 'Emmy';
  if (kind === 'bafta') return 'BAFTA';
  return n === 1 ? 'Globo de Oro' : 'Globos de Oro';
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Ganó 2 Óscar · 126 premios y 375 nominaciones" */
export function describeAwards(info: AwardsInfo | null): string | null {
  if (!info) return null;
  const parts: string[] = [];
  const h = info.headline;
  if (h?.won) parts.push(`Ganó ${h.won} ${awardName(h.kind, h.won)}`);
  else if (h?.nominated) parts.push(`Nominada a ${h.nominated} ${awardName(h.kind, h.nominated)}`);
  const totals = [
    info.wins ? plural(info.wins, 'premio', 'premios') : null,
    info.nominations ? plural(info.nominations, 'nominación', 'nominaciones') : null,
  ].filter(Boolean);
  if (totals.length) parts.push(totals.join(' y '));
  return parts.join(' · ');
}

/** Versión corta para tablas: "2 Óscar", "1 nom. Óscar", "12 premios". */
export function awardsShort(info: AwardsInfo | null): string | null {
  if (!info) return null;
  const h = info.headline;
  if (h?.won) return `${h.won} ${awardName(h.kind, h.won)}`;
  if (h?.nominated) return `${h.nominated} nom. ${awardName(h.kind, h.nominated)}`;
  if (info.wins) return plural(info.wins, 'premio', 'premios');
  if (info.nominations) return `${info.nominations} nom.`;
  return null;
}
