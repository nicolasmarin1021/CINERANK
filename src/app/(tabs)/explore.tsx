import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import { ExploreCard, ExploreSkeleton, ProviderPicker, SettingsButton } from '@/components/explore-parts';
import { Icon } from '@/components/icon';
import { LIST_BAR_SPACE, ListBar } from '@/components/list-bar';
import { OptionRow, OptionsSheet } from '@/components/options-sheet';
import { Screen } from '@/components/screen';
import { AppText, Button, Chip, EmptyState, Notice } from '@/components/ui';
import { MaxContentWidth, Palette, Spacing } from '@/constants/theme';
import { DECADES, REGIONS, type ExploreFilters } from '@/lib/explore';
import { exploreMore, type ExploreItem } from '@/lib/explore-client';
import { getMovie } from '@/lib/omdb';
import { getProviders, type StreamingProvider } from '@/lib/tmdb';
import { MAX_CANDIDATES, useApiKeys, useApp } from '@/store/app-store';

type Status = 'idle' | 'loading' | 'more' | 'done' | 'error';

/**
 * «Explorar»: para cuando no sabes qué ver. El catálogo de una plataforma en tu
 * país, filtrado por IMDb, crítica de Rotten Tomatoes, Óscar y año; desde aquí
 * añades títulos a tu lista.
 */
export default function ExploreScreen() {
  const { state, dispatch } = useApp();
  const apiKeys = useApiKeys();
  const { tmdbKey, mdblistKey, explore: filters } = state;
  const { width: windowWidth } = useWindowDimensions();

  const [providers, setProviders] = useState<StreamingProvider[]>([]);
  const [providersFor, setProvidersFor] = useState<string | null>(null);
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(1);
  const [scanned, setScanned] = useState(0);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);
  const [regionOpen, setRegionOpen] = useState(false);
  const [yearText, setYearText] = useState(filters.year ? String(filters.year) : '');
  const [adding, setAdding] = useState<string | null>(null);

  const ready = state.hydrated && tmdbKey !== '';
  const hasRatings = mdblistKey !== '';

  // Cada cambio de filtros o de claves empieza una búsqueda nueva (se decide al pintar, sin efectos encadenados).
  const query = JSON.stringify([filters, tmdbKey, mdblistKey]);
  if (ready && query !== loadedQuery) {
    setLoadedQuery(query);
    setItems([]);
    setNextPage(1);
    setScanned(0);
    setError(null);
    setStatus('loading');
  }
  const providersKey = `${tmdbKey}|${filters.region}`;
  if (ready && providersKey !== providersFor) {
    setProvidersFor(providersKey);
    setProviders([]);
  }

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    getProviders(tmdbKey, filters.region)
      .then((list) => !cancelled && setProviders(list))
      .catch(() => {
        // Sin plataformas, se puede explorar igual con "Todas".
      });
    return () => {
      cancelled = true;
    };
  }, [ready, tmdbKey, filters.region]);

  useEffect(() => {
    if (status !== 'loading' && status !== 'more') return;
    let cancelled = false;
    const firstBatch = status === 'loading';
    exploreMore({ tmdb: tmdbKey, mdblist: mdblistKey }, filters, firstBatch ? 1 : (nextPage ?? 1))
      .then((batch) => {
        if (cancelled) return;
        setItems((prev) => {
          if (firstBatch) return batch.items;
          const seen = new Set(prev.map((i) => i.tmdbId));
          return [...prev, ...batch.items.filter((i) => !seen.has(i.tmdbId))];
        });
        setNextPage(batch.nextPage);
        setScanned((s) => (firstBatch ? batch.scanned : s + batch.scanned));
        setStatus('done');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo.');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [status, tmdbKey, mdblistKey, filters, nextPage]);

  const set = (patch: Partial<ExploreFilters>) => dispatch({ type: 'setExplore', explore: patch });
  const candidateIds = new Set(state.candidates.map((m) => m.imdbID));
  const full = state.candidates.length >= MAX_CANDIDATES;

  async function toggle(item: ExploreItem) {
    const id = item.ratings?.imdbID;
    if (!id) return;
    if (candidateIds.has(id)) {
      dispatch({ type: 'removeCandidate', imdbID: id });
      return;
    }
    if (full) return;
    setAdding(id);
    try {
      dispatch({ type: 'addCandidate', movie: await getMovie(apiKeys, id) });
    } catch {
      setError('No se pudo añadir el título. Revisa tu clave de OMDb o tu conexión.');
    } finally {
      setAdding(null);
    }
  }

  function applyYear() {
    const y = Number(yearText);
    set({ year: /^\d{4}$/.test(yearText) && y >= 1900 && y <= 2100 ? y : null });
  }

  // Rejilla de 3 columnas (4 en pantallas anchas).
  const contentWidth = Math.min(windowWidth, MaxContentWidth) - Spacing.four * 2;
  const cols = contentWidth >= 560 ? 4 : 3;
  const gap = Spacing.three;
  const cardWidth = Math.floor((contentWidth - gap * (cols - 1)) / cols);
  const providerName = providers.find((p) => p.id === filters.provider)?.name;
  const regionName = REGIONS.find((r) => r.code === filters.region)?.name ?? filters.region;
  const showBar = state.candidates.length > 0;

  const header = (
    <View style={styles.header}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="display">Explorar</AppText>
        <AppText variant="caption" tone="muted">
          Cuando no sabes qué ver: el catálogo de tu plataforma, solo con lo mejor.
        </AppText>
      </View>
      <SettingsButton />
    </View>
  );

  if (state.hydrated && !tmdbKey) {
    return (
      <Screen>
        {header}
        <Notice
          icon="key"
          title="Falta tu clave de TMDB"
          action={
            <Button
              label="Añadirla en Ajustes"
              kind="secondary"
              compact
              style={{ alignSelf: 'flex-start', marginTop: Spacing.two }}
              onPress={() => router.push('/settings')}
            />
          }>
          TMDB tiene el catálogo de cada plataforma por país. La clave es gratuita: crea una cuenta en themoviedb.org,
          entra en Ajustes → API y solicítala para uso personal.
        </Notice>
      </Screen>
    );
  }

  return (
    <View style={styles.root}>
      <Screen extraBottom={showBar ? LIST_BAR_SPACE : 0}>
        {header}

        <View style={{ gap: Spacing.three }}>
          <View style={styles.rowBetween}>
            <AppText variant="label">Plataforma</AppText>
            <Pressable
              onPress={() => setRegionOpen(true)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`País del catálogo: ${regionName}. Cambiar`}
              style={styles.region}>
              <Icon name="location" size={14} color={Palette.textSecondary} />
              <AppText variant="caption" tone="secondary" style={{ fontWeight: '600' }}>
                {regionName}
              </AppText>
              <Icon name="chevronDown" size={13} color={Palette.textSecondary} />
            </Pressable>
          </View>
          <ProviderPicker
            providers={providers}
            selected={filters.provider}
            onSelect={(provider) => set({ provider })}
            loading={ready && providers.length === 0}
          />
        </View>

        <View style={{ gap: Spacing.three }}>
          <AppText variant="label">Solo lo mejor</AppText>
          <View style={styles.chips}>
            <Chip label="IMDb 8+" icon="star" selected={filters.imdb8} onPress={() => set({ imdb8: !filters.imdb8 })} />
            <Chip label="🍅 Crítica 80%+" selected={filters.rt80} onPress={() => set({ rt80: !filters.rt80 })} />
            <Chip label="🏆 Ganó un Óscar" selected={filters.oscar} onPress={() => set({ oscar: !filters.oscar })} />
          </View>
          {!hasRatings ? (
            <AppText variant="caption" tone="warning">
              Estos filtros necesitan tu clave de MDBList (en Ajustes); sin ella se ve el catálogo sin filtrar.
            </AppText>
          ) : null}
        </View>

        <View style={{ gap: Spacing.three }}>
          <AppText variant="label">Año</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Chip
              label="Cualquiera"
              selected={filters.decade == null && filters.year == null}
              onPress={() => {
                setYearText('');
                set({ decade: null, year: null });
              }}
            />
            {DECADES.map((d) => (
              <Chip
                key={d.value}
                label={d.label}
                selected={filters.year == null && filters.decade === d.value}
                onPress={() => {
                  setYearText('');
                  set({ decade: filters.decade === d.value ? null : d.value, year: null });
                }}
              />
            ))}
            <TextInput
              value={yearText}
              onChangeText={(t) => setYearText(t.replace(/\D/g, '').slice(0, 4))}
              onSubmitEditing={applyYear}
              onBlur={applyYear}
              placeholder="Año exacto"
              placeholderTextColor={Palette.textMuted}
              keyboardType="number-pad"
              returnKeyType="search"
              maxLength={4}
              style={[styles.yearInput, filters.year != null && styles.yearActive]}
              accessibilityLabel="Año exacto"
            />
          </ScrollView>
        </View>

        <View style={{ gap: Spacing.three }}>
          <AppText variant="caption" tone="muted">
            {status === 'loading'
              ? `Buscando en ${providerName ?? 'todas las plataformas'} (${regionName})…`
              : `${items.length} ${items.length === 1 ? 'título' : 'títulos'} en ${providerName ?? 'todas las plataformas'} · ${regionName}${
                  scanned ? ` · revisados ${scanned} del catálogo` : ''
                }`}
          </AppText>

          {error ? (
            <Notice icon="warning" tone="danger" title="Algo falló">
              {error}
            </Notice>
          ) : null}

          {status === 'loading' ? (
            <View style={[styles.grid, { gap }]}>
              {Array.from({ length: cols * 2 }, (_, i) => (
                <ExploreSkeleton key={i} width={cardWidth} />
              ))}
            </View>
          ) : items.length > 0 ? (
            <View style={[styles.grid, { gap }]}>
              {items.map((item) => (
                <ExploreCard
                  key={item.tmdbId}
                  item={item}
                  width={cardWidth}
                  added={!!item.ratings?.imdbID && candidateIds.has(item.ratings.imdbID)}
                  adding={adding != null && adding === item.ratings?.imdbID}
                  canAdd={!full}
                  onToggle={() => toggle(item)}
                />
              ))}
            </View>
          ) : status === 'done' ? (
            <EmptyState
              icon="explore"
              title="Nada cumple todos los filtros"
              message={
                nextPage != null
                  ? 'En lo revisado no hubo coincidencias. Busca más abajo o quita algún filtro.'
                  : 'Prueba con otra plataforma, otro año o quitando algún filtro.'
              }
            />
          ) : null}

          {status !== 'loading' && nextPage != null && status !== 'error' ? (
            <Button
              label="Buscar más títulos"
              kind="secondary"
              loading={status === 'more'}
              onPress={() => setStatus('more')}
            />
          ) : status === 'done' && items.length > 0 ? (
            <AppText variant="caption" tone="muted" style={{ textAlign: 'center' }}>
              No hay más títulos con estos filtros.
            </AppText>
          ) : null}
        </View>

        <AppText variant="caption" tone="muted" style={{ textAlign: 'center' }}>
          Catálogo de TMDB y plataformas de JustWatch; notas y Óscar de MDBList. CineRank usa la API de TMDB, pero
          TMDB no la respalda ni certifica.
        </AppText>
      </Screen>
      {showBar ? <ListBar count={state.candidates.length} /> : null}

      <OptionsSheet visible={regionOpen} onClose={() => setRegionOpen(false)} title="País del catálogo">
        {REGIONS.map((r) => (
          <OptionRow
            key={r.code}
            label={r.name}
            selected={filters.region === r.code}
            onPress={() => {
              // Las plataformas cambian de un país a otro: se vuelve a "Todas".
              set({ region: r.code, provider: null });
              setRegionOpen(false);
            }}
          />
        ))}
      </OptionsSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.background },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  region: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
    backgroundColor: Palette.surface,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingRight: Spacing.four },
  yearInput: {
    width: 104,
    minHeight: 36,
    color: Palette.text,
    fontSize: 13,
    paddingHorizontal: Spacing.three,
    borderRadius: 18,
    backgroundColor: Palette.surface,
    textAlign: 'center',
  },
  yearActive: { borderWidth: 1.5, borderColor: Palette.accent },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
