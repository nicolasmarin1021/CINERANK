import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Poster } from '@/components/poster';
import { InlineRatings } from '@/components/scores';
import { AppText } from '@/components/ui';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { getMovie, peekMovie } from '@/lib/omdb';
import type { ApiKeys, Movie, SearchHit } from '@/lib/types';

/**
 * Fila de resultado de búsqueda. Carga en segundo plano (con caché) las
 * calificaciones del título para poder decidir antes de añadirlo.
 */
export function SearchRow({
  hit,
  apiKeys,
  added,
  full,
  onToggle,
}: {
  hit: SearchHit;
  apiKeys: ApiKeys;
  added: boolean;
  full: boolean;
  onToggle: (movie: Movie) => void;
}) {
  const [movie, setMovie] = useState<Movie | null>(() => peekMovie(hit.imdbID));
  const [failed, setFailed] = useState(false);

  const { omdb, mdblist } = apiKeys;
  // Vuelve a pedirla si se cargó antes de tener clave de MDBList (le falta el público de RT).
  const needsFetch = !movie || (!!mdblist && !movie.audienceChecked);
  useEffect(() => {
    if (!needsFetch) return;
    let cancelled = false;
    getMovie({ omdb, mdblist }, hit.imdbID)
      .then((m) => !cancelled && setMovie(m))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [omdb, mdblist, hit.imdbID, needsFetch]);

  const canAdd = movie != null && (added || !full);
  const meta = [hit.year, hit.type === 'series' ? 'Serie' : null, movie?.genres.slice(0, 2).join(', ')]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => router.push({ pathname: '/movie/[id]', params: { id: hit.imdbID } })}
        accessibilityRole="button"
        accessibilityLabel={`Ver ficha de ${hit.title}`}
        style={({ pressed }) => [styles.main, pressed && { opacity: 0.7 }]}>
        <Poster uri={hit.poster} width={46} title={hit.title} />
        <View style={styles.info}>
          <AppText variant="label" numberOfLines={2}>
            {hit.title}
          </AppText>
          {meta ? (
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {meta}
            </AppText>
          ) : null}
          <View style={styles.scores}>
            {movie ? (
              <InlineRatings movie={movie} showAudience={!!mdblist} showVotes />
            ) : failed ? (
              <AppText variant="caption" tone="muted">
                No se pudieron cargar las notas
              </AppText>
            ) : (
              <View style={styles.skeleton} accessibilityLabel="Cargando notas" />
            )}
          </View>
        </View>
      </Pressable>
      <Pressable
        disabled={!canAdd}
        hitSlop={6}
        onPress={() => {
          if (movie) onToggle(movie);
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: added, disabled: !canAdd }}
        accessibilityLabel={added ? `Quitar ${hit.title} de la comparación` : `Añadir ${hit.title} a la comparación`}
        style={({ pressed }) => [
          styles.toggle,
          added && styles.toggleOn,
          !canAdd && { opacity: 0.35 },
          pressed && { opacity: 0.7 },
        ]}>
        {movie == null && !failed ? (
          <ActivityIndicator size="small" color={Palette.textMuted} />
        ) : (
          <Icon name={added ? 'check' : 'add'} size={18} color={added ? Palette.onLight : Palette.text} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  info: { flex: 1, gap: 3 },
  scores: { minHeight: 18, justifyContent: 'center', marginTop: 1 },
  skeleton: { width: 132, height: 10, borderRadius: Radius.pill, backgroundColor: Palette.surfaceRaised },
  toggle: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.borderStrong,
  },
  toggleOn: { backgroundColor: Palette.accent, borderColor: Palette.accent },
});
