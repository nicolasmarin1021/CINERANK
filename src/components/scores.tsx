import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';

import { AppText } from '@/components/ui';
import { Palette, Radius, SourceColor, Spacing, TierColor } from '@/constants/theme';
import type { Tier } from '@/lib/ranking';
import type { Movie, SourceKey } from '@/lib/types';

/** Marca de cada fuente: IMDb por su nombre, Rotten Tomatoes por sus tomates y palomitas. */
const MARK: Record<SourceKey, string> = { imdb: 'IMDb', rt: '🍅', popcorn: '🍿', comments: '🗣' };
const MARK_LONG: Record<SourceKey, string> = {
  imdb: 'IMDb',
  rt: '🍅 Crítica',
  popcorn: '🍿 Público',
  comments: '🗣 Comentarios',
};
const SPOKEN_NAME: Record<SourceKey, string> = {
  imdb: 'IMDb',
  rt: 'crítica de RT',
  popcorn: 'público de RT',
  comments: 'comentarios de Trakt',
};

/** Texto de la calificación en el formato original de cada fuente. */
export function formatSource(movie: Movie, source: SourceKey): string {
  const r = movie.ratings;
  if (source === 'imdb') return r.imdb == null ? '—' : r.imdb.toFixed(1);
  const value = source === 'rt' ? r.rt : source === 'popcorn' ? r.popcorn : (r.comments ?? null);
  return value == null ? '—' : `${value}%`;
}

export function formatVotes(votes: number | null): string {
  if (votes == null) return '—';
  if (votes >= 1_000_000) return `${(votes / 1_000_000).toFixed(1).replace('.0', '')} M`;
  if (votes >= 1_000) return `${Math.round(votes / 1_000)} mil`;
  return String(votes);
}

export function formatRuntime(minutes: number | null): string {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${m.toString().padStart(2, '0')} min` : `${m} min`;
}

export function formatScore(score: number | null): string {
  return score == null ? '—' : score.toFixed(1);
}

function visibleSources(movie: Movie, showAudience: boolean): SourceKey[] {
  // Los comentarios de Trakt solo aparecen cuando el título ya los tiene (se piden para tu lista y la ficha).
  return (['imdb', 'rt', 'popcorn', 'comments'] as SourceKey[]).filter((s) =>
    s === 'comments' ? movie.ratings.comments != null : s !== 'popcorn' || showAudience || movie.ratings.popcorn != null,
  );
}

function spokenRatings(movie: Movie, sources: SourceKey[]) {
  return sources
    .map((s) => `${SPOKEN_NAME[s]} ${formatSource(movie, s) === '—' ? 'sin dato' : formatSource(movie, s)}`)
    .join(', ');
}

/** Punto de color de una fuente. */
export function SourceDot({ source, size = 7 }: { source: SourceKey; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: SourceColor[source] }} />;
}

/** Punto de color + "IMDb", 🍅 o 🍿 (con "Crítica"/"Público" en la versión larga). */
export function SourceMark({
  source,
  long,
  singleLine,
  fit,
  style,
}: {
  source: SourceKey;
  long?: boolean;
  /** En una sola línea (las barras tienen una columna de etiqueta de ancho fijo). */
  singleLine?: boolean;
  /** Una línea que, si no cabe, reduce un poco la letra (columnas estrechas). */
  fit?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <View style={styles.mark}>
      <SourceDot source={source} />
      <AppText
        variant="caption"
        tone="secondary"
        numberOfLines={singleLine || fit ? 1 : undefined}
        adjustsFontSizeToFit={fit}
        minimumFontScale={fit ? 0.75 : undefined}
        style={[{ flexShrink: 1 }, style]}>
        {long ? MARK_LONG[source] : MARK[source]}
      </AppText>
    </View>
  );
}

/** Notas en una línea: ● IMDb 8.1  ● 🍅 98%  ● 🍿 89%  935 mil votos. */
export function InlineRatings({
  movie,
  showAudience,
  showVotes,
}: {
  movie: Movie;
  showAudience: boolean;
  showVotes?: boolean;
}) {
  const sources = visibleSources(movie, showAudience);
  const votes = movie.ratings.imdbVotes;
  return (
    <View
      style={styles.inline}
      accessible
      accessibilityLabel={`${spokenRatings(movie, sources)}${showVotes && votes != null ? `, ${formatVotes(votes)} votos` : ''}`}>
      {sources.map((s) => {
        const value = formatSource(movie, s);
        return (
          <View key={s} style={styles.mark}>
            <SourceMark source={s} />
            <AppText
              variant="caption"
              style={{ fontWeight: '700', color: value === '—' ? Palette.textMuted : Palette.text }}>
              {value}
            </AppText>
          </View>
        );
      })}
      {showVotes && votes != null ? (
        <AppText variant="caption" tone="muted">
          {formatVotes(votes)} votos
        </AppText>
      ) : null}
    </View>
  );
}

/** Fila de calificaciones en columnas, como en la ficha de una app de cine. */
export function RatingsRow({
  movie,
  showAudience,
  dimmed = [],
}: {
  movie: Movie;
  showAudience: boolean;
  /** Fuentes con peso 0: se muestran atenuadas. */
  dimmed?: SourceKey[];
}) {
  const sources = visibleSources(movie, showAudience);
  return (
    <View style={styles.ratings}>
      {sources.map((s, i) => {
        const value = formatSource(movie, s);
        return (
          <View
            key={s}
            accessible
            accessibilityLabel={`${SPOKEN_NAME[s]}: ${value === '—' ? 'sin dato' : value}`}
            style={[styles.ratingCol, i > 0 && styles.ratingDivider, dimmed.includes(s) && { opacity: 0.45 }]}>
            <AppText style={[styles.ratingValue, value === '—' && { color: Palette.textMuted }]}>{value}</AppText>
            <SourceMark source={s} long fit />
          </View>
        );
      })}
    </View>
  );
}

/** Barra horizontal 0–100 de una fuente, con su color. */
export function SourceBar({
  source,
  movie,
  value,
  dimmed,
}: {
  source: SourceKey;
  movie: Movie;
  /** Valor 0–100 a dibujar (normalizado). */
  value: number | null;
  dimmed?: boolean;
}) {
  return (
    <View style={[styles.barRow, dimmed && { opacity: 0.45 }]}>
      <View style={styles.barLabel}>
        <SourceMark source={source} long singleLine />
      </View>
      <View style={styles.track}>
        {value != null ? (
          <View
            style={[
              styles.fill,
              { width: `${Math.max(2, Math.min(100, value))}%`, backgroundColor: SourceColor[source] },
            ]}
          />
        ) : null}
      </View>
      <AppText variant="number" style={[styles.barValue, value == null && { color: Palette.textMuted }]}>
        {formatSource(movie, source)}
      </AppText>
    </View>
  );
}

const NUMBER_SIZE = { sm: 20, md: 30, lg: 52 } as const;

/** CineScore como cifra grande en el color de su nivel, sin recuadro. */
export function ScoreNumber({
  score,
  tier,
  size = 'md',
  style,
}: {
  score: number | null;
  tier: Tier | null;
  size?: keyof typeof NUMBER_SIZE;
  style?: StyleProp<TextStyle>;
}) {
  const fontSize = NUMBER_SIZE[size];
  return (
    <AppText
      accessibilityLabel={score == null ? 'Sin CineScore' : `CineScore ${formatScore(score)} de 100`}
      style={[
        {
          fontSize,
          lineHeight: Math.round(fontSize * 1.1),
          fontWeight: '700',
          letterSpacing: size === 'lg' ? -1.2 : -0.4,
          fontVariant: ['tabular-nums'],
          color: tier ? TierColor[tier.key] : Palette.textMuted,
        },
        style,
      ]}>
      {formatScore(score)}
    </AppText>
  );
}

/** CineScore en un recuadro con el color de su nivel. */
export function ScoreBadge({
  score,
  tier,
  size = 'md',
  caption = 'CINESCORE',
}: {
  score: number | null;
  tier: Tier | null;
  size?: 'sm' | 'md';
  /** Texto bajo la cifra ("CINESCORE" o "PARA HOY"). */
  caption?: string;
}) {
  const color = tier ? TierColor[tier.key] : Palette.textMuted;
  const dims = size === 'md' ? 70 : 54;
  const font = size === 'md' ? 22 : 17;
  return (
    <View
      accessibilityLabel={
        score == null ? 'Sin puntuación' : `${caption === 'CINESCORE' ? 'CineScore' : 'Para hoy'} ${formatScore(score)} de 100`
      }
      style={[styles.badge, { width: dims, height: dims, borderColor: color, backgroundColor: `${color}1F` }]}>
      <AppText style={{ fontSize: font, lineHeight: font * 1.15, fontWeight: '800', color, fontVariant: ['tabular-nums'] }}>
        {formatScore(score)}
      </AppText>
      {size === 'md' ? (
        <AppText style={{ fontSize: 9, lineHeight: 12, letterSpacing: 0.8, fontWeight: '700', color }}>{caption}</AppText>
      ) : null}
    </View>
  );
}

/** Nombre del nivel en su color (el texto evita depender solo del color). */
export function TierLabel({ tier, style }: { tier: Tier | null; style?: StyleProp<TextStyle> }) {
  return (
    <AppText
      variant="caption"
      style={[{ fontWeight: '600', color: tier ? TierColor[tier.key] : Palette.textMuted }, style]}>
      {tier ? tier.label : 'Sin datos'}
    </AppText>
  );
}

/** Etiqueta del nivel sobre una píldora tintada con su color. */
export function TierPill({ tier }: { tier: Tier | null }) {
  const color = tier ? TierColor[tier.key] : Palette.textMuted;
  return (
    <View style={[styles.pill, { backgroundColor: tier ? `${color}24` : Palette.surfaceRaised }]}>
      <AppText variant="caption" style={{ color, fontWeight: '700' }}>
        {tier ? tier.label : 'Sin datos'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: Spacing.three, rowGap: 2 },
  mark: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ratings: {
    flexDirection: 'row',
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
  },
  ratingCol: { flex: 1, alignItems: 'center', gap: 2 },
  ratingDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: Palette.border },
  ratingValue: { fontSize: 22, lineHeight: 28, fontWeight: '700', fontVariant: ['tabular-nums'], color: Palette.text },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  // Ancho para la etiqueta más larga ("🗣 Comentarios") en una sola línea.
  barLabel: { width: 122 },
  track: {
    flex: 1,
    height: 7,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceRaised,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: Radius.pill },
  barValue: { width: 46, textAlign: 'right', fontSize: 14 },
  badge: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
});
