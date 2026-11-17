import { Stack, router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { Backdrop } from '@/components/poster';
import { formatRuntime, formatVotes, RatingsRow, ScoreNumber, SourceDot, TierLabel } from '@/components/scores';
import { Screen } from '@/components/screen';
import { AppText, Button, Card, Divider, IconButton, Notice } from '@/components/ui';
import { Palette, Spacing } from '@/constants/theme';
import { getMovie, imdbUrl, OmdbError, peekMovie, rottenTomatoesSearchUrl } from '@/lib/omdb';
import { scoreMovie } from '@/lib/ranking';
import { SOURCE_LABEL, type Movie, type SourceKey } from '@/lib/types';
import { MAX_CANDIDATES, useApiKeys, useApp } from '@/store/app-store';

const SOURCES: SourceKey[] = ['imdb', 'rt', 'popcorn'];

/** Cabecera transparente: la portada llega hasta arriba y solo queda la flecha de volver. */
const IMMERSIVE_HEADER = {
  title: '',
  headerTransparent: true,
  headerStyle: { backgroundColor: 'transparent' },
  headerBackButtonDisplayMode: 'minimal',
} as const;

export default function MovieScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useApp();
  const { omdb, mdblist } = useApiKeys();
  const insets = useSafeAreaInsets();
  const candidate = state.candidates.find((m) => m.imdbID === id) ?? null;
  const [fetched, setFetched] = useState<Movie | null>(() => peekMovie(id));
  const [error, setError] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const movie = candidate ?? fetched;
  const isCandidate = candidate != null;
  // También se vuelve a pedir si se cargó antes de tener clave de MDBList (le falta el público de RT).
  const needsFetch = !movie || (!!mdblist && !movie.audienceChecked);

  useEffect(() => {
    if (!needsFetch || !state.hydrated) return;
    let cancelled = false;
    getMovie({ omdb, mdblist }, id)
      .then((m) => {
        if (cancelled) return;
        setFetched(m);
        if (isCandidate) dispatch({ type: 'replaceCandidates', movies: [m] });
      })
      .catch((err) => !cancelled && setError(err instanceof OmdbError ? err.message : 'No se pudo cargar la ficha.'));
    return () => {
      cancelled = true;
    };
  }, [id, needsFetch, isCandidate, omdb, mdblist, state.hydrated, dispatch]);

  if (!movie) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Ficha' }} />
        {error ? (
          <View style={{ padding: Spacing.five, width: '100%', maxWidth: 480 }}>
            <Notice icon="warning" tone="danger" title="No se pudo cargar">
              {error}
            </Notice>
          </View>
        ) : (
          <ActivityIndicator color={Palette.accent} />
        )}
      </View>
    );
  }

  const scored = scoreMovie(movie, state.settings);
  const inList = candidate != null;
  const full = state.candidates.length >= MAX_CANDIDATES;
  const showAudience = !!mdblist || movie.ratings.popcorn != null;
  const facts = [movie.year, movie.rated, movie.runtimeMin ? formatRuntime(movie.runtimeMin) : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen
      withTabBar={false}
      hero={
        <Backdrop uri={movie.poster} height={380 + insets.top}>
          <AppText style={styles.heroTitle} numberOfLines={3}>
            {movie.title}
          </AppText>
          {facts ? (
            <AppText variant="caption" tone="secondary">
              {facts}
            </AppText>
          ) : null}
          {movie.genres.length ? (
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {movie.genres.join(' · ')}
            </AppText>
          ) : null}
        </Backdrop>
      }>
      <Stack.Screen options={IMMERSIVE_HEADER} />

      <View style={styles.actions}>
        <Button
          label={inList ? 'En tu lista' : full ? `Lista llena (${MAX_CANDIDATES})` : 'Añadir a comparar'}
          icon={inList ? 'check' : 'add'}
          kind={inList ? 'secondary' : 'primary'}
          disabled={!inList && full}
          accessibilityHint={inList ? 'Toca para quitarla de la comparación' : undefined}
          style={{ flex: 1 }}
          onPress={() =>
            inList
              ? dispatch({ type: 'removeCandidate', imdbID: movie.imdbID })
              : dispatch({ type: 'addCandidate', movie })
          }
        />
        {inList && state.candidates.length > 1 ? (
          <IconButton icon="trophy" label="Ver ranking" filled onPress={() => router.navigate('/ranking')} />
        ) : null}
      </View>

      <View style={{ gap: Spacing.four }}>
        <View style={styles.scoreRow}>
          <ScoreNumber score={scored.score} tier={scored.tier} size="lg" />
          <View style={{ flex: 1, gap: 2 }}>
            <TierLabel tier={scored.tier} style={{ fontSize: 15 }} />
            <AppText variant="caption" tone="muted">
              {scored.score == null
                ? 'No hay calificaciones de las fuentes activas para calcular el CineScore.'
                : `CineScore con ${scored.contributions
                    .map((c) => `${Math.round(c.share * 100)}% ${SOURCE_LABEL[c.source]}`)
                    .join(' + ')}.`}
            </AppText>
          </View>
        </View>

        <RatingsRow
          movie={movie}
          showAudience={showAudience}
          dimmed={SOURCES.filter((s) => state.settings.weights[s] === 0)}
        />

        <View style={{ gap: Spacing.two }}>
          {scored.consensus ? (
            <Fact
              icon={
                scored.consensus.key === 'aligned' ? 'scale' : scored.consensus.key === 'critics' ? 'critic' : 'people'
              }
              text={`${scored.consensus.label} (${scored.consensus.gap > 0 ? '+' : ''}${Math.round(scored.consensus.gap)} pts de diferencia).`}
            />
          ) : null}
          {movie.ratings.imdbVotes != null ? (
            <Fact
              icon="people"
              text={`${formatVotes(movie.ratings.imdbVotes)} votos en IMDb${
                Math.abs(scored.imdbAdjustment) >= 0.1
                  ? `: por eso su nota cuenta como ${(scored.scores.imdb ?? 0).toFixed(1)} en lugar de ${(scored.imdbRaw ?? 0).toFixed(1)}`
                  : ''
              }.`}
            />
          ) : null}
          {scored.missing.map((s) => (
            <Fact
              key={s}
              icon="warning"
              warning
              text={
                s !== 'popcorn'
                  ? `OMDb no tiene dato de ${SOURCE_LABEL[s]} para este título.`
                  : mdblist
                    ? 'MDBList no tiene el puntaje del público de RT para este título.'
                    : 'Añade tu clave gratuita de MDBList en Ajustes para ver el público de RT.'
              }
            />
          ))}
        </View>

        {scored.contributions.length > 0 ? (
          <View>
            <Pressable
              onPress={() => setShowBreakdown((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showBreakdown }}
              style={styles.disclosure}>
              <AppText variant="label" tone="secondary" style={{ flex: 1 }}>
                Cómo se calculó
              </AppText>
              <Icon
                name="chevronDown"
                size={16}
                color={Palette.textSecondary}
                style={showBreakdown ? { transform: [{ rotate: '180deg' }] } : undefined}
              />
            </Pressable>
            {showBreakdown ? (
              <Card style={{ gap: Spacing.three }}>
                {scored.contributions.map((c) => (
                  <View key={c.source} style={styles.breakdownRow}>
                    <SourceDot source={c.source} />
                    <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
                      {SOURCE_LABEL[c.source]} {c.value.toFixed(1)} × {Math.round(c.share * 100)}%
                      {c.source === 'imdb' && Math.abs(scored.imdbAdjustment) >= 0.1 ? ' (corregida por votos)' : ''}
                    </AppText>
                    <AppText variant="number" style={{ fontSize: 14 }}>
                      {c.points.toFixed(1)}
                    </AppText>
                  </View>
                ))}
                <Divider />
                <View style={styles.breakdownRow}>
                  <AppText variant="label" style={{ flex: 1 }}>
                    CineScore
                  </AppText>
                  <AppText variant="number">{scored.score?.toFixed(1) ?? '—'}</AppText>
                </View>
              </Card>
            ) : null}
          </View>
        ) : null}
      </View>

      {movie.plot ? (
        <View style={{ gap: Spacing.two }}>
          <AppText variant="heading">Sinopsis</AppText>
          <AppText tone="secondary">{movie.plot}</AppText>
          <AppText variant="caption" tone="muted">
            En inglés, tal como la entrega OMDb.
          </AppText>
        </View>
      ) : null}

      <View>
        {[
          ['Dirección', movie.director],
          ['Reparto', movie.actors],
          ['Estreno', movie.released],
          ['País', movie.country],
          ['Idioma', movie.language],
          ['Premios', movie.awards],
        ]
          .filter((row): row is [string, string] => !!row[1])
          .map(([label, value]) => (
            <View key={label} style={styles.detailRow}>
              <AppText variant="caption" tone="muted">
                {label}
              </AppText>
              <AppText variant="body">{value}</AppText>
            </View>
          ))}
      </View>

      <View style={styles.links}>
        <Button
          label="IMDb"
          icon="external"
          kind="secondary"
          compact
          onPress={() => WebBrowser.openBrowserAsync(imdbUrl(movie.imdbID))}
        />
        <Button
          label="Rotten Tomatoes"
          icon="external"
          kind="secondary"
          compact
          onPress={() => WebBrowser.openBrowserAsync(rottenTomatoesSearchUrl(movie.title))}
        />
      </View>

      <AppText variant="caption" tone="muted" style={{ textAlign: 'center' }}>
        Datos de OMDb actualizados el {new Date(movie.fetchedAt).toLocaleDateString('es')}.
      </AppText>
    </Screen>
  );
}

function Fact({ icon, text, warning }: { icon: IconName; text: string; warning?: boolean }) {
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={15} color={warning ? Palette.warning : Palette.textMuted} style={{ marginTop: 1 }} />
      <AppText variant="caption" tone={warning ? 'warning' : 'secondary'} style={{ flex: 1 }}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.background },
  heroTitle: { fontSize: 30, lineHeight: 35, fontWeight: '700', letterSpacing: -0.5, color: Palette.text },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
  disclosure: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  detailRow: {
    gap: 2,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
});
