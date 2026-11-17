import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { Backdrop, Poster } from '@/components/poster';
import { formatRuntime, ScoreNumber, TierLabel } from '@/components/scores';
import { Icon } from '@/components/icon';
import { AppText, Button, IconButton } from '@/components/ui';
import { Palette, Radius, Spacing } from '@/constants/theme';
import type { RankedMovie } from '@/lib/ranking';

function openMovie(imdbID: string) {
  router.push({ pathname: '/movie/[id]', params: { id: imdbID } });
}

function details(item: RankedMovie) {
  const { movie } = item;
  return [movie.year, movie.runtimeMin ? formatRuntime(movie.runtimeMin) : null, movie.genres[0]]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Botón para enviar un título a «¿Cuál es mejor?» (balanza) o sacarlo de ahí (dorado con ✓).
 */
export function CompareToggle({
  title,
  selected,
  onPress,
  size = 38,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={selected ? `Quitar ${title} de ¿Cuál es mejor?` : `Enfrentar ${title} en ¿Cuál es mejor?`}
      style={({ pressed }) => [
        styles.toggle,
        { width: size, height: size },
        selected && styles.toggleOn,
        pressed && { opacity: 0.7 },
      ]}>
      <Icon name={selected ? 'check' : 'scale'} size={17} color={selected ? Palette.onLight : Palette.textSecondary} />
    </Pressable>
  );
}

/** Portada del título ganador: póster a lo ancho, su CineScore y el veredicto. */
export function WinnerHero({
  item,
  overline,
  verdict,
  compared,
  onToggleCompare,
}: {
  item: RankedMovie;
  /** "Tu mejor opción" o "Empate técnico". */
  overline: string;
  /** Por cuánto gana, en una frase. */
  verdict: string;
  compared: boolean;
  onToggleCompare: () => void;
}) {
  const { movie } = item;
  return (
    <View style={{ gap: Spacing.three }}>
      <Pressable
        onPress={() => openMovie(movie.imdbID)}
        accessibilityRole="button"
        accessibilityLabel={`${overline}: ${movie.title}. ${verdict}`}
        style={({ pressed }) => pressed && { opacity: 0.9 }}>
        <Backdrop uri={movie.poster} height={230} rounded>
          <AppText variant="caption" style={{ color: Palette.accent, fontWeight: '700' }}>
            {overline}
          </AppText>
          <AppText variant="title" numberOfLines={2}>
            {movie.title}
          </AppText>
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {details(item)}
          </AppText>
        </Backdrop>
      </Pressable>
      <View style={styles.heroScore}>
        <ScoreNumber score={item.score} tier={item.tier} size="md" />
        <View style={{ flex: 1 }}>
          <TierLabel tier={item.tier} />
          <AppText variant="caption" tone="muted">
            {verdict}
          </AppText>
        </View>
      </View>
      <View style={styles.heroActions}>
        <Button label="Ver ficha" onPress={() => openMovie(movie.imdbID)} style={{ flex: 1 }} />
        <CompareToggle title={movie.title} selected={compared} onPress={onToggleCompare} size={48} />
      </View>
    </View>
  );
}

/** Fila del ranking: puesto, póster, título, nivel y la cifra por la que se ordena. */
export function RankRow({
  item,
  value,
  valueColor,
  editing,
  onRemove,
  compared,
  onToggleCompare,
}: {
  item: RankedMovie;
  /** Cifra que se muestra a la derecha (CineScore u otra fuente según el orden). */
  value: string;
  valueColor: string;
  editing: boolean;
  onRemove: () => void;
  compared: boolean;
  onToggleCompare: () => void;
}) {
  const { movie } = item;
  const meta = details(item);
  return (
    <Animated.View layout={LinearTransition.duration(250)} style={styles.row}>
      {editing ? (
        <IconButton
          icon="minusCircle"
          label={`Quitar ${movie.title} de la comparación`}
          color={Palette.danger}
          size={22}
          onPress={onRemove}
        />
      ) : (
        <AppText style={styles.rank}>{item.rank ?? '–'}</AppText>
      )}
      <Pressable
        onPress={() => openMovie(movie.imdbID)}
        accessibilityRole="button"
        accessibilityLabel={`Puesto ${item.rank ?? 'sin puesto'}: ${movie.title}, ${item.tier?.label ?? 'sin datos'}, ${value}`}
        style={({ pressed }) => [styles.main, pressed && { opacity: 0.7 }]}>
        <Poster uri={movie.poster} width={42} title={movie.title} />
        <View style={styles.info}>
          <AppText variant="label" numberOfLines={2}>
            {movie.title}
          </AppText>
          <AppText variant="caption" numberOfLines={1}>
            <TierLabel tier={item.tier} />
            {meta ? <AppText variant="caption" tone="muted">{` · ${meta}`}</AppText> : null}
          </AppText>
        </View>
        <AppText style={[styles.value, { color: valueColor }]}>{value}</AppText>
      </Pressable>
      {editing ? null : <CompareToggle title={movie.title} selected={compared} onPress={onToggleCompare} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  heroScore: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  toggle: {
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.borderStrong,
  },
  toggleOn: { backgroundColor: Palette.accent, borderColor: Palette.accent },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  rank: {
    width: 32,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: Palette.textMuted,
    fontVariant: ['tabular-nums'],
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  info: { flex: 1, gap: 2 },
  value: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'], minWidth: 48, textAlign: 'right' },
});
