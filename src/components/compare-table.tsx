import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Poster } from '@/components/poster';
import { formatRuntime, formatScore, formatVotes, SourceDot } from '@/components/scores';
import { AppText } from '@/components/ui';
import { Palette, Radius, Spacing, TierColor } from '@/constants/theme';
import { awardsShort, awardsStrength } from '@/lib/awards';
import { bestIndexes, type RankedMovie } from '@/lib/ranking';
import type { SourceKey } from '@/lib/types';

const LABEL_WIDTH = 104;
const COL_WIDTH = 108;
const HEADER_HEIGHT = 146;
const ROW_HEIGHT = 46;

interface Row {
  key: string;
  label: string;
  icon?: IconName;
  source?: SourceKey;
  values: (number | null)[];
  render: (item: RankedMovie) => string;
  /** Si es true se resalta el mejor valor de la fila. */
  highlight: boolean;
}

/** Tabla lado a lado: cada columna es un título, cada fila un criterio. */
export function CompareTable({ items, showAudience }: { items: RankedMovie[]; showAudience: boolean }) {
  const allRows: Row[] = [
    {
      key: 'score',
      label: 'CineScore',
      icon: 'trophy',
      values: items.map((i) => i.score),
      render: (i) => formatScore(i.score),
      highlight: true,
    },
    {
      key: 'imdb',
      label: 'IMDb',
      source: 'imdb',
      values: items.map((i) => i.movie.ratings.imdb),
      render: (i) => (i.movie.ratings.imdb == null ? '—' : `${i.movie.ratings.imdb.toFixed(1)}/10`),
      highlight: true,
    },
    {
      key: 'votes',
      label: 'Votos IMDb',
      values: items.map((i) => i.movie.ratings.imdbVotes),
      render: (i) => formatVotes(i.movie.ratings.imdbVotes),
      highlight: true,
    },
    {
      key: 'rt',
      label: '🍅 Crítica de RT',
      source: 'rt',
      values: items.map((i) => i.movie.ratings.rt),
      render: (i) => (i.movie.ratings.rt == null ? '—' : `${i.movie.ratings.rt}%`),
      highlight: true,
    },
    {
      key: 'popcorn',
      label: '🍿 Público de RT',
      source: 'popcorn',
      values: items.map((i) => i.movie.ratings.popcorn),
      render: (i) => (i.movie.ratings.popcorn == null ? '—' : `${i.movie.ratings.popcorn}%`),
      highlight: true,
    },
    {
      key: 'awards',
      label: '🏆 Premios',
      values: items.map((i) => (i.awards ? awardsStrength(i.awards) : null)),
      render: (i) => awardsShort(i.awards) ?? '—',
      highlight: true,
    },
    {
      key: 'gap',
      label: 'Crítica − público',
      values: items.map(() => null),
      render: (i) => (i.consensus ? `${i.consensus.gap > 0 ? '+' : ''}${Math.round(i.consensus.gap)} pts` : '—'),
      highlight: false,
    },
    {
      key: 'runtime',
      label: 'Duración',
      values: items.map(() => null),
      render: (i) => formatRuntime(i.movie.runtimeMin),
      highlight: false,
    },
    {
      key: 'year',
      label: 'Año',
      values: items.map(() => null),
      render: (i) => i.movie.year || '—',
      highlight: false,
    },
  ];
  // Sin clave de MDBList la fila del público de RT estaría vacía: solo se muestra si hay datos.
  const rows = allRows.filter((row) => row.key !== 'popcorn' || showAudience || row.values.some((v) => v != null));

  return (
    <View style={{ gap: Spacing.two }}>
      <View style={styles.table}>
        <View style={styles.labelCol}>
          <View style={[styles.cornerCell, { height: HEADER_HEIGHT }]}>
            <AppText variant="caption" tone="muted">
              En dorado, el mejor de cada fila.
            </AppText>
          </View>
          {rows.map((row) => (
            <View key={row.key} style={styles.labelCell}>
              {row.source ? <SourceDot source={row.source} /> : null}
              {row.icon ? <Icon name={row.icon} size={13} color={Palette.textMuted} /> : null}
              <AppText variant="caption" tone="secondary" numberOfLines={2} style={{ flex: 1 }}>
                {row.label}
              </AppText>
            </View>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ paddingRight: Spacing.two }}>
          <View>
            <View style={[styles.row, { height: HEADER_HEIGHT, borderTopWidth: 0 }]}>
              {items.map((item) => (
                <Pressable
                  key={item.movie.imdbID}
                  onPress={() => router.push({ pathname: '/movie/[id]', params: { id: item.movie.imdbID } })}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver ficha de ${item.movie.title}`}
                  style={({ pressed }) => [styles.headCell, pressed && { opacity: 0.7 }]}>
                  <AppText
                    variant="caption"
                    style={[styles.rankTag, { color: item.tier ? TierColor[item.tier.key] : Palette.textMuted }]}>
                    {item.rank ?? '–'}
                  </AppText>
                  <Poster uri={item.movie.poster} width={54} title={item.movie.title} />
                  <AppText variant="caption" numberOfLines={2} style={styles.headTitle}>
                    {item.movie.title}
                  </AppText>
                </Pressable>
              ))}
            </View>
            {rows.map((row) => {
              const best = row.highlight ? bestIndexes(row.values) : new Set<number>();
              return (
                <View key={row.key} style={styles.row}>
                  {items.map((item, i) => {
                    const isBest = best.has(i);
                    const text = row.render(item);
                    return (
                      <View key={item.movie.imdbID} style={styles.cell}>
                        <View style={[styles.valueWrap, isBest && styles.best]}>
                          <AppText
                            variant="number"
                            style={[
                              { fontSize: 14, textAlign: 'center', fontWeight: isBest ? '700' : '500' },
                              isBest && { color: Palette.accent },
                              text === '—' && { color: Palette.textMuted },
                            ]}>
                            {text}
                          </AppText>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
      {items.length > 2 ? (
        <AppText variant="caption" tone="muted" style={{ textAlign: 'center' }}>
          Desliza la tabla hacia la izquierda para ver todos los títulos.
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    flexDirection: 'row',
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  labelCol: {
    width: LABEL_WIDTH,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Palette.border,
  },
  cornerCell: { padding: Spacing.three, justifyContent: 'flex-end' },
  labelCell: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
  },
  row: {
    flexDirection: 'row',
    height: ROW_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
  },
  headCell: {
    width: COL_WIDTH,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.three,
  },
  rankTag: { position: 'absolute', top: Spacing.two, left: Spacing.two, fontWeight: '700' },
  headTitle: { textAlign: 'center', fontWeight: '600', color: Palette.text },
  cell: { width: COL_WIDTH, alignItems: 'center', justifyContent: 'center' },
  valueWrap: { paddingHorizontal: Spacing.two, paddingVertical: 3, borderRadius: Radius.sm, minWidth: 56 },
  best: { backgroundColor: Palette.accentSoft },
});
