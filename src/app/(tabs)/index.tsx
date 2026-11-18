import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { SettingsButton } from '@/components/explore-parts';
import { LIST_BAR_SPACE, ListBar } from '@/components/list-bar';
import { Logo } from '@/components/logo';
import { ReleaseWall } from '@/components/release-wall';
import { Screen } from '@/components/screen';
import { SearchRow } from '@/components/search-row';
import { AppText, Button, EmptyState, Notice, Segmented } from '@/components/ui';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { OmdbError } from '@/lib/omdb';
import { searchCatalog } from '@/lib/search';
import type { MediaType, Movie, SearchHit } from '@/lib/types';
import { MAX_CANDIDATES, useApiKeys, useApp } from '@/store/app-store';

const TYPES: { value: MediaType; label: string }[] = [
  { value: 'movie', label: 'Películas' },
  { value: 'series', label: 'Series' },
];

type Status = 'idle' | 'loading' | 'more' | 'done' | 'error';

/**
 * Buscador. Sin búsqueda activa solo muestra el campo centrado; al buscar,
 * el campo sube y aparecen los filtros y los resultados.
 */
export default function SearchScreen() {
  const { state, dispatch } = useApp();
  const apiKeys = useApiKeys();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [year, setYear] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState('');
  const requestId = useRef(0);

  const hasKey = state.apiKey.length > 0;
  const candidateIds = new Set(state.candidates.map((m) => m.imdbID));
  const full = state.candidates.length >= MAX_CANDIDATES;
  const idle = status === 'idle';
  const showBar = !idle && state.candidates.length > 0;

  async function run(text: string, nextPage: number, type = state.searchType) {
    const q = text.trim();
    if (q.length < 2) return;
    const id = ++requestId.current;
    setStatus(nextPage === 1 ? 'loading' : 'more');
    setError(null);
    if (nextPage === 1) setSubmitted(q);
    try {
      const res = await searchCatalog(apiKeys, q, {
        type,
        year: /^\d{4}$/.test(year) ? year : undefined,
        page: nextPage,
      });
      if (id !== requestId.current) return;
      setResults((prev) => {
        if (nextPage === 1) return res.results;
        const seen = new Set(prev.map((r) => r.imdbID));
        return [...prev, ...res.results.filter((r) => !seen.has(r.imdbID))];
      });
      setTotal(res.total);
      setPage(nextPage);
      setStatus('done');
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof OmdbError ? err.message : 'Algo salió mal al buscar. Inténtalo de nuevo.');
      setStatus('error');
    }
  }

  /** Borra la búsqueda y vuelve al buscador centrado. */
  function reset() {
    requestId.current++;
    setQuery('');
    setResults([]);
    setTotal(0);
    setSubmitted('');
    setError(null);
    setStatus('idle');
  }

  function toggle(movie: Movie) {
    if (candidateIds.has(movie.imdbID)) dispatch({ type: 'removeCandidate', imdbID: movie.imdbID });
    else dispatch({ type: 'addCandidate', movie });
  }

  function setType(type: MediaType) {
    dispatch({ type: 'setSearchType', searchType: type });
    if (submitted) run(submitted, 1, type);
  }

  const searchBox = (
    <View style={styles.searchBox}>
      <Icon name="search" size={18} color={Palette.textMuted} />
      <TextInput
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => run(query, 1)}
        placeholder="Título en español o en inglés"
        placeholderTextColor={Palette.textMuted}
        returnKeyType="search"
        autoCorrect={false}
        editable={hasKey}
        style={styles.input}
        accessibilityLabel="Buscar película o serie"
      />
      {status === 'loading' ? (
        <ActivityIndicator size="small" color={Palette.textMuted} />
      ) : query || !idle ? (
        <Pressable onPress={reset} hitSlop={12} accessibilityRole="button" accessibilityLabel="Borrar búsqueda">
          <Icon name="closeCircle" size={18} color={Palette.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );

  const missingKey =
    state.hydrated && !hasKey ? (
      <Notice
        icon="key"
        title="Falta tu clave de OMDb"
        action={
          <Button
            label="Configurar clave"
            kind="secondary"
            compact
            style={{ alignSelf: 'flex-start', marginTop: Spacing.two }}
            onPress={() => router.navigate('/settings')}
          />
        }>
        Es gratuita y solo tarda un minuto. Sin ella no se pueden buscar títulos.
      </Notice>
    ) : null;

  if (idle) {
    // Logo arriba, buscador al centro y la carátula de estrenos abajo, fundiéndose con el fondo.
    const wallHeight = Math.round(windowHeight * 0.42);
    return (
      <View style={styles.root}>
        <ReleaseWall
          height={wallHeight}
          onPick={(title) => {
            if (!hasKey) return;
            setQuery(title);
            run(title, 1);
          }}
        />
        <View
          pointerEvents="box-none"
          // El buscador se centra en el hueco entre el logo y el borde superior de la carátula.
          style={[styles.idleContent, { paddingTop: insets.top + Spacing.five, paddingBottom: wallHeight }]}>
          <Logo />
          <View pointerEvents="box-none" style={styles.idle}>
            <AppText variant="title" style={{ textAlign: 'center' }}>
              ¿Qué vas a ver hoy?
            </AppText>
            {searchBox}
            <AppText variant="caption" tone="muted" style={{ textAlign: 'center' }}>
              Añade varias opciones y CineRank te dice cuál ver.
            </AppText>
            {missingKey}
          </View>
        </View>
        {/* Ajustes ya no es una pestaña: se abre desde aquí y desde Explorar. */}
        <View style={[styles.settings, { top: insets.top + Spacing.three }]}>
          <SettingsButton />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Screen extraBottom={showBar ? LIST_BAR_SPACE : 0}>
        <View style={{ gap: Spacing.three }}>
          {searchBox}
          <View style={styles.filters}>
            <Segmented options={TYPES} value={state.searchType} onChange={setType} style={{ flex: 1, maxWidth: 260 }} />
            <TextInput
              value={year}
              onChangeText={(t) => setYear(t.replace(/\D/g, '').slice(0, 4))}
              onSubmitEditing={() => run(query || submitted, 1)}
              placeholder="Año"
              placeholderTextColor={Palette.textMuted}
              keyboardType="number-pad"
              returnKeyType="search"
              maxLength={4}
              style={styles.yearInput}
              accessibilityLabel="Filtrar por año"
            />
          </View>
        </View>

        {missingKey}

        {status === 'error' && error ? (
          <Notice icon="warning" tone="danger" title="No se pudo buscar">
            {error}
          </Notice>
        ) : null}

        {status === 'loading' && results.length === 0 ? (
          <View accessibilityLabel="Buscando">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonRow key={i} />
            ))}
          </View>
        ) : results.length > 0 ? (
          <View style={{ gap: Spacing.one, opacity: status === 'loading' ? 0.5 : 1 }}>
            <AppText variant="caption" tone="muted">
              {total} {total === 1 ? 'resultado' : 'resultados'} para “{submitted}”
              {full ? ` · Lista llena (máx. ${MAX_CANDIDATES})` : ''}
            </AppText>
            <View>
              {results.map((hit) => (
                <SearchRow
                  key={hit.imdbID}
                  hit={hit}
                  apiKeys={apiKeys}
                  added={candidateIds.has(hit.imdbID)}
                  full={full}
                  onToggle={toggle}
                />
              ))}
            </View>
            {results.length < total ? (
              <Button
                label="Cargar más resultados"
                kind="secondary"
                loading={status === 'more'}
                style={{ marginTop: Spacing.three }}
                onPress={() => run(submitted, page + 1)}
              />
            ) : null}
          </View>
        ) : status === 'done' ? (
          <EmptyState
            icon="search"
            title="Sin resultados"
            message="No lo encontramos ni por su título en español ni por el original. Revisa la ortografía, prueba con el título original o quita el filtro de año."
          />
        ) : null}
      </Screen>
      {showBar ? <ListBar count={state.candidates.length} /> : null}
    </View>
  );
}

/** Fila de carga con la forma de un resultado (en lugar de una rueda). */
function SkeletonRow() {
  return (
    <View style={styles.skeletonRow}>
      <View style={[styles.skeleton, { width: 46, height: 68, borderRadius: 6 }]} />
      <View style={{ flex: 1, gap: Spacing.two }}>
        <View style={[styles.skeleton, { width: '70%', height: 13 }]} />
        <View style={[styles.skeleton, { width: '45%', height: 10 }]} />
        <View style={[styles.skeleton, { width: '55%', height: 10 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.background },
  settings: { position: 'absolute', right: Spacing.four },
  idleContent: { flex: 1, paddingHorizontal: Spacing.four },
  idle: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', justifyContent: 'center', gap: Spacing.four },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 52,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
  },
  input: { flex: 1, color: Palette.text, fontSize: 17, paddingVertical: 14 },
  filters: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  yearInput: {
    width: 76,
    minHeight: 38,
    color: Palette.text,
    fontSize: 14,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
    backgroundColor: Palette.surface,
    textAlign: 'center',
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  skeleton: { backgroundColor: Palette.surface, borderRadius: Radius.pill },
});
