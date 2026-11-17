import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { Icon, type IconName } from '@/components/icon';
import { PlatformBadges } from '@/components/platform-badges';
import { Poster } from '@/components/poster';
import { formatRuntime, formatVotes, ScoreBadge, SourceBar, TierPill } from '@/components/scores';
import { AppText, IconButton } from '@/components/ui';
import { Palette, Radius, Spacing, TierColor } from '@/constants/theme';
import type { RankedMovie } from '@/lib/ranking';
import { SOURCE_LABEL, type RankingSettings, type SourceKey } from '@/lib/types';

const SOURCES: SourceKey[] = ['imdb', 'rt', 'popcorn'];

/** "a", "a y b", "a, b y c" */
function joinEs(items: string[]) {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

/**
 * Tarjeta completa para «¿Cuál es mejor?»: puesto, CineScore en recuadro,
 * nivel, barras de color de cada fuente y notas sobre los datos.
 */
export function DuelCard({
  item,
  settings,
  audienceEnabled,
  highlight,
  onRemove,
}: {
  item: RankedMovie;
  settings: RankingSettings;
  /** Hay clave de MDBList, así que el puntaje del público de RT debería existir. */
  audienceEnabled: boolean;
  highlight?: boolean;
  onRemove: () => void;
}) {
  const { movie } = item;
  const details = [movie.year, movie.runtimeMin ? formatRuntime(movie.runtimeMin) : null, movie.genres.slice(0, 2).join(', ')]
    .filter(Boolean)
    .join(' · ');
  const accent = item.tier ? TierColor[item.tier.key] : Palette.borderStrong;
  const visibleSources = SOURCES.filter(
    (s) => item.scores[s] != null || (settings.weights[s] > 0 && (s !== 'popcorn' || audienceEnabled)),
  );
  // Sin clave de MDBList, la falta del público de RT no se repite en cada tarjeta.
  const missing = item.missing.filter((s) => s !== 'popcorn' || audienceEnabled);

  // El botón de quitar es hermano (no hijo) del área pulsable: en web un
  // <button> no puede contener otro <button>.
  return (
    <Animated.View
      layout={LinearTransition.duration(250)}
      style={[styles.card, highlight && { borderColor: accent, backgroundColor: Palette.surfaceRaised }]}>
      <Pressable
        onPress={() => router.push({ pathname: '/movie/[id]', params: { id: movie.imdbID } })}
        accessibilityRole="button"
        accessibilityLabel={`Puesto ${item.rank ?? 'sin puesto'}: ${movie.title}`}
        style={({ pressed }) => [styles.content, pressed && { opacity: 0.85 }]}>
        {/* Esquina superior: etiqueta del ganador a la izquierda, plataformas a la derecha (antes de la ✕). */}
        <View style={styles.topRow}>
          {highlight ? (
            <View style={styles.winnerTag}>
              <Icon name="trophy" size={13} color={accent} />
              <AppText variant="caption" style={{ color: accent, fontWeight: '700', letterSpacing: 0.4 }}>
                TU MEJOR OPCIÓN
              </AppText>
            </View>
          ) : (
            <View />
          )}
          <PlatformBadges providers={movie.providers} />
        </View>

        <View style={styles.header}>
          <AppText style={[styles.rank, highlight && { color: accent }]}>{item.rank ?? '–'}</AppText>
          <Poster uri={movie.poster} width={highlight ? 64 : 52} title={movie.title} />
          <View style={styles.info}>
            <AppText style={styles.title} numberOfLines={2}>
              {movie.title}
            </AppText>
            {details ? (
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {details}
              </AppText>
            ) : null}
            <TierPill tier={item.tier} />
          </View>
          <View style={styles.right}>
            <ScoreBadge score={item.score} tier={item.tier} size={highlight ? 'md' : 'sm'} />
          </View>
        </View>

        <View style={styles.bars}>
          {visibleSources.map((s) => (
            <SourceBar
              key={s}
              source={s}
              movie={movie}
              value={s === 'imdb' ? item.imdbRaw : item.scores[s]}
              dimmed={settings.weights[s] === 0}
            />
          ))}
        </View>

        <View style={styles.notes}>
          {item.consensus ? (
            <Note
              icon={item.consensus.key === 'aligned' ? 'scale' : item.consensus.key === 'critics' ? 'critic' : 'people'}
              text={item.consensus.label}
            />
          ) : null}
          {missing.length > 0 && item.score != null ? (
            <Note
              icon="warning"
              warning
              text={`Sin dato de ${missing.map((s) => SOURCE_LABEL[s]).join(' ni ')}: calculado con ${joinEs(
                item.contributions.map((c) => SOURCE_LABEL[c.source]),
              )}`}
            />
          ) : null}
          {item.score == null ? (
            <Note icon="warning" warning text="Sin calificaciones de las fuentes activas: no entra en la comparación" />
          ) : null}
          {Math.abs(item.imdbAdjustment) >= 1 ? (
            <Note
              icon="info"
              text={`IMDb corregida ${item.imdbAdjustment > 0 ? '+' : ''}${item.imdbAdjustment.toFixed(1)} pts por tener ${formatVotes(
                movie.ratings.imdbVotes,
              )} votos`}
            />
          ) : null}
        </View>
      </Pressable>
      <View style={styles.close}>
        <IconButton
          icon="close"
          label={`Quitar ${movie.title} de ¿Cuál es mejor?`}
          onPress={onRemove}
          size={16}
          color={Palette.textMuted}
        />
      </View>
    </Animated.View>
  );
}

function Note({ icon, text, warning }: { icon: IconName; text: string; warning?: boolean }) {
  return (
    <View style={styles.note}>
      <Icon name={icon} size={13} color={warning ? Palette.warning : Palette.textMuted} />
      <AppText variant="caption" tone={warning ? 'warning' : 'muted'} style={{ flex: 1 }}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  content: { padding: Spacing.four, gap: Spacing.three },
  close: { position: 'absolute', top: Spacing.two, right: Spacing.two },
  topRow: {
    minHeight: 28,
    marginRight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  winnerTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rank: {
    width: 26,
    fontSize: 22,
    fontWeight: '800',
    color: Palette.textMuted,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  info: { flex: 1, gap: Spacing.one },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: Palette.text },
  right: { alignItems: 'flex-end', gap: Spacing.two },
  bars: { gap: Spacing.two },
  notes: { gap: 6 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
});
