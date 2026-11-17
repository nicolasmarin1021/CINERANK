import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { CompareTable } from '@/components/compare-table';
import { Icon } from '@/components/icon';
import { useEnrichCandidates } from '@/hooks/use-enrich-candidates';
import { OptionRow, OptionsSheet, SheetSection } from '@/components/options-sheet';
import { PlanPicker } from '@/components/plan-picker';
import { RankRow, WinnerHero } from '@/components/ranked-card';
import { formatScore } from '@/components/scores';
import { Screen } from '@/components/screen';
import { AppText, Button, EmptyState, Notice, Segmented } from '@/components/ui';
import { Palette, Spacing, TierColor } from '@/constants/theme';
import { getMovie } from '@/lib/omdb';
import { planPhrase } from '@/lib/plan';
import { isTechnicalTie, rankMovies, sortValue, tierFor, weightShares, type RankedMovie } from '@/lib/ranking';
import { SOURCE_SHORT, type SortKey, type SourceKey } from '@/lib/types';
import { useActivePlan, useApiKeys, useApp, type RuntimeFilter } from '@/store/app-store';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'today', label: 'Para hoy' },
  { key: 'score', label: 'CineScore' },
  { key: 'imdb', label: 'IMDb' },
  { key: 'rt', label: 'Crítica de RT' },
  { key: 'popcorn', label: 'Público de RT' },
  { key: 'comments', label: 'Comentarios' },
];

const RUNTIMES: { value: RuntimeFilter; label: string }[] = [
  { value: 0, label: 'Cualquier duración' },
  { value: 90, label: 'Hasta 1 h 30' },
  { value: 120, label: 'Hasta 2 h' },
  { value: 150, label: 'Hasta 2 h 30' },
];

type RankingView = 'list' | 'table';
const VIEWS: { value: RankingView; label: string }[] = [
  { value: 'list', label: 'Lista' },
  { value: 'table', label: 'Tabla' },
];

export default function RankingScreen() {
  const { state, dispatch } = useApp();
  const apiKeys = useApiKeys();
  const { settings, candidates, sortBy: savedSort, maxRuntime, compareIds } = state;
  // Tu plan de hoy: si caducó (otro día), el orden «Para hoy» vuelve a CineScore.
  const plan = useActivePlan();
  const sortBy: SortKey = savedSort === 'today' && !plan ? 'score' : savedSort;
  const byScore = sortBy === 'score' || sortBy === 'today';
  const audienceEnabled = state.mdblistKey.length > 0;
  const [view, setView] = useState<RankingView>('list');
  const [editing, setEditing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Si la lista se queda vacía, sale del modo edición.
  if (candidates.length === 0 && editing) setEditing(false);

  const visible = candidates.filter((m) => maxRuntime === 0 || m.runtimeMin == null || m.runtimeMin <= maxRuntime);
  const hidden = candidates.length - visible.length;
  const ranked = rankMovies(visible, settings, sortBy, plan);
  const tie = isTechnicalTie(ranked, sortBy);
  const shares = weightShares(settings.weights);
  const weightText = (Object.keys(shares) as SourceKey[])
    .filter((k) => shares[k] > 0)
    .map((k) => `${SOURCE_SHORT[k]} ${Math.round(shares[k] * 100)}%`)
    .join(' · ');

  useEnrichCandidates();

  async function refresh() {
    if (!state.apiKey || candidates.length === 0) return;
    setRefreshing(true);
    setRefreshNote(null);
    const results = await Promise.allSettled(candidates.map((m) => getMovie(apiKeys, m.imdbID, true)));
    const fresh = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    dispatch({ type: 'replaceCandidates', movies: fresh });
    const failed = results.length - fresh.length;
    setRefreshNote(
      failed > 0
        ? `No se pudieron actualizar ${failed} de ${results.length} títulos. Revisa tu conexión o el límite diario de las APIs.`
        : 'Calificaciones actualizadas.',
    );
    setRefreshing(false);
  }

  if (candidates.length === 0) {
    return (
      <Screen>
        <AppText variant="display">Ranking</AppText>
        <EmptyState
          icon="trophy"
          title="Tu lista está vacía"
          message="Busca las películas que estás dudando en ver y pulsa +. Aquí verás cuál gana según IMDb y Rotten Tomatoes."
          action={
            <Button
              label="Buscar películas"
              icon="search"
              onPress={() => router.navigate('/')}
              style={{ marginTop: Spacing.two }}
            />
          }
        />
      </Screen>
    );
  }

  const [first, second] = ranked;
  const sortLabel = SORTS.find((s) => s.key === sortBy)?.label ?? 'CineScore';
  const runtimeLabel = RUNTIMES.find((r) => r.value === maxRuntime)?.label;
  const firstValue = first ? sortValue(first, sortBy) : null;
  const secondValue = second ? sortValue(second, sortBy) : null;
  const showHero =
    view === 'list' && !editing && first != null && second != null && first.rank === 1 && firstValue != null && secondValue != null;
  const rows = showHero ? ranked.slice(1) : ranked;

  function verdict() {
    if (!first || !second || firstValue == null || secondValue == null) return '';
    if (tie) return `Menos de 2 puntos sobre ${second.movie.title} en ${sortLabel}. Decide por género o duración.`;
    const lead = `${formatSortDiff(sortBy, firstValue - secondValue)} por delante de ${second.movie.title}`;
    return byScore ? `${lead}.` : `${formatSortValue(sortBy, firstValue)} en ${sortLabel}, ${lead}.`;
  }

  function rowValue(item: RankedMovie) {
    if (byScore) {
      const value = sortBy === 'today' ? item.todayScore : item.score;
      return { text: formatScore(value), color: value == null ? Palette.textMuted : TierColor[tierFor(value).key] };
    }
    const value = sortValue(item, sortBy);
    return value == null
      ? { text: '—', color: Palette.textMuted }
      : { text: formatSortValue(sortBy, value, true), color: Palette.text };
  }

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Palette.accent} />}>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="display">Ranking</AppText>
          <AppText
            variant="caption"
            tone="muted"
            accessibilityLabel={`${candidates.length} opciones, ordenadas por ${sortLabel}. Pesos: ${weightText || 'sin fuentes activas'}`}>
            {candidates.length} {candidates.length === 1 ? 'opción' : 'opciones'} · por {sortLabel}
            {weightText ? '' : ' · sin fuentes activas'}
          </AppText>
        </View>
        <Pressable
          onPress={() => {
            setEditing((e) => !e);
            setConfirmClear(false);
          }}
          hitSlop={12}
          accessibilityRole="button"
          style={styles.editButton}>
          <AppText variant="label" tone="accent">
            {editing ? 'Listo' : 'Editar'}
          </AppText>
        </Pressable>
      </View>

      {/* Con un solo título no hay nada que reordenar, pero un plan activo debe poder cambiarse o quitarse. */}
      {candidates.length > 1 || plan ? <PlanPicker /> : null}

      {!audienceEnabled && settings.weights.popcorn > 0 ? (
        <Notice
          icon="people"
          title="Falta el público de Rotten Tomatoes"
          action={
            <Button
              label="Añadir clave de MDBList"
              kind="secondary"
              compact
              style={{ alignSelf: 'flex-start', marginTop: Spacing.two }}
              onPress={() => router.navigate('/settings')}
            />
          }>
          Para incluirlo, añade en Ajustes tu clave gratuita de MDBList. Mientras tanto, el ranking usa IMDb y la
          crítica de RT.
        </Notice>
      ) : null}

      {candidates.length === 1 ? (
        <Notice icon="info" title="Añade al menos otra opción">
          Con dos o más títulos podrás ver cuál conviene más y compararlos lado a lado.
        </Notice>
      ) : null}

      {showHero ? (
        <WinnerHero
          item={first}
          overline={
            tie ? 'Empate técnico' : plan && sortBy === 'today' ? `Tu mejor opción ${planPhrase(plan)}` : 'Tu mejor opción'
          }
          today={sortBy === 'today'}
          verdict={verdict()}
          compared={compareIds.includes(first.movie.imdbID)}
          onToggleCompare={() => dispatch({ type: 'toggleCompare', imdbID: first.movie.imdbID })}
        />
      ) : null}

      <View style={{ gap: Spacing.two }}>
        <View style={styles.controls}>
          <Segmented options={VIEWS} value={view} onChange={setView} style={{ width: 168 }} />
          <Pressable
            onPress={() => setSheetOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Ordenar y filtrar. Ahora: ${sortLabel}${maxRuntime ? `, ${runtimeLabel}` : ''}`}
            style={({ pressed }) => [styles.sortButton, pressed && { opacity: 0.7 }]}>
            <AppText variant="caption" tone="secondary" style={{ fontWeight: '600' }} numberOfLines={1}>
              {sortLabel}
              {maxRuntime ? ` · ${runtimeLabel}` : ''}
            </AppText>
            <Icon name="chevronDown" size={14} color={Palette.textSecondary} />
          </Pressable>
        </View>

        {view === 'list' && !editing && candidates.length > 1 ? (
          <Pressable
            onPress={() => router.navigate('/compare')}
            disabled={compareIds.length === 0}
            accessibilityRole={compareIds.length > 0 ? 'button' : 'text'}
            style={styles.compareHint}>
            <Icon name="scale" size={14} color={compareIds.length > 0 ? Palette.accent : Palette.textMuted} />
            <AppText variant="caption" tone={compareIds.length > 0 ? 'accent' : 'muted'} style={{ flex: 1 }}>
              {compareIds.length === 0
                ? 'Marca con la balanza los títulos que quieres enfrentar en «¿Cuál es mejor?».'
                : `${compareIds.length} ${compareIds.length === 1 ? 'título marcado' : 'títulos marcados'} para «¿Cuál es mejor?» · Ver`}
            </AppText>
          </Pressable>
        ) : null}

        {hidden > 0 ? (
          <AppText variant="caption" tone="muted">
            {hidden} {hidden === 1 ? 'título oculto' : 'títulos ocultos'} por superar la duración elegida.
          </AppText>
        ) : null}

        {ranked.length === 0 ? (
          <EmptyState
            icon="clock"
            title="Nada cabe en ese tiempo"
            message="Ningún título de tu lista dura tan poco. Prueba con otra duración."
          />
        ) : view === 'list' || editing ? (
          <View>
            {rows.map((item) => {
              const value = rowValue(item);
              return (
                <RankRow
                  key={item.movie.imdbID}
                  item={item}
                  value={value.text}
                  valueColor={value.color}
                  editing={editing}
                  onRemove={() => dispatch({ type: 'removeCandidate', imdbID: item.movie.imdbID })}
                  showFit={plan != null}
                  compared={compareIds.includes(item.movie.imdbID)}
                  onToggleCompare={() => dispatch({ type: 'toggleCompare', imdbID: item.movie.imdbID })}
                />
              );
            })}
          </View>
        ) : (
          <CompareTable items={ranked} showAudience={audienceEnabled} />
        )}
      </View>

      {editing ? (
        <Button
          label={confirmClear ? 'Toca otra vez para vaciar' : 'Vaciar lista'}
          icon="trash"
          kind="danger"
          style={{ alignSelf: 'center', minWidth: 260 }}
          onPress={() => {
            if (confirmClear) {
              dispatch({ type: 'clearCandidates' });
              setConfirmClear(false);
            } else {
              setConfirmClear(true);
            }
          }}
        />
      ) : (
        <View style={{ alignItems: 'center', gap: Spacing.one }}>
          <Button
            label="Actualizar notas"
            icon="refresh"
            kind="ghost"
            compact
            loading={refreshing}
            disabled={!state.apiKey}
            onPress={refresh}
          />
          {refreshNote ? (
            <AppText variant="caption" tone="muted" style={{ textAlign: 'center' }}>
              {refreshNote}
            </AppText>
          ) : null}
        </View>
      )}

      <OptionsSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Ordenar y filtrar">
        <SheetSection title="Ordenar por" />
        {SORTS.filter((s) => (s.key !== 'popcorn' || audienceEnabled) && (s.key !== 'today' || plan) && (s.key !== 'comments' || state.traktKey)).map((s) => (
          <OptionRow
            key={s.key}
            label={s.label}
            selected={sortBy === s.key}
            onPress={() => dispatch({ type: 'setSortBy', sortBy: s.key })}
          />
        ))}
        <SheetSection title="Duración" />
        {RUNTIMES.map((r) => (
          <OptionRow
            key={r.value}
            label={r.label}
            selected={maxRuntime === r.value}
            onPress={() => dispatch({ type: 'setMaxRuntime', maxRuntime: r.value })}
          />
        ))}
      </OptionsSheet>
    </Screen>
  );
}

/** Muestra el valor en la escala original de cada fuente. */
function formatSortValue(key: SortKey, value: number, short = false) {
  if (key === 'imdb') return short ? (value / 10).toFixed(1) : `${(value / 10).toFixed(1)}/10`;
  if (key === 'rt' || key === 'popcorn' || key === 'comments') return `${Math.round(value)}%`;
  return short ? formatScore(value) : `${formatScore(value)}/100`;
}

function formatSortDiff(key: SortKey, diff: number) {
  if (key === 'imdb') return `${(diff / 10).toFixed(1)} puntos`;
  if (key === 'score' || key === 'today') return `${formatScore(diff)} puntos`;
  return `${Math.round(diff)} puntos`;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  editButton: { minHeight: 44, justifyContent: 'center', paddingTop: 4 },
  compareHint: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 32 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  sortButton: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 38,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
    backgroundColor: Palette.surface,
  },
});
