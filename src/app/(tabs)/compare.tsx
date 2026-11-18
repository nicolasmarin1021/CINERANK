import { router } from 'expo-router';
import { View } from 'react-native';

import { DuelCard } from '@/components/duel-card';
import { PlanPicker } from '@/components/plan-picker';
import { formatScore } from '@/components/scores';
import { Screen } from '@/components/screen';
import { AppText, Button, EmptyState, Notice } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useEnrichCandidates } from '@/hooks/use-enrich-candidates';
import { REGIONS } from '@/lib/explore';
import { isTechnicalTie, rankMovies } from '@/lib/ranking';
import { useActivePlan, useApp } from '@/store/app-store';

/**
 * «¿Cuál es mejor?»: solo los títulos que marcaste en Ranking, cara a cara,
 * con su CineScore, nivel y las barras de cada fuente.
 */
export default function CompareScreen() {
  const { state, dispatch } = useApp();
  const { settings, candidates, compareIds } = state;
  useEnrichCandidates();
  const audienceEnabled = state.mdblistKey.length > 0;
  // Las plataformas son las del país elegido en Explorar.
  const regionName = REGIONS.find((r) => r.code === state.explore.region)?.name ?? state.explore.region;
  const selected = candidates.filter((m) => compareIds.includes(m.imdbID));
  // Con un plan de hoy se ordena «Para hoy»; sin plan, por CineScore.
  const plan = useActivePlan();
  const sortKey = plan ? 'today' : 'score';
  const ranked = rankMovies(selected, settings, sortKey, plan);
  const tie = isTechnicalTie(ranked, sortKey);
  const [first, second] = ranked;
  const valueOf = (item: (typeof ranked)[number]) => (plan ? item.todayScore : item.score);
  const firstValue = first ? valueOf(first) : null;
  const secondValue = second ? valueOf(second) : null;

  const header = (
    <View style={{ gap: 2 }}>
      <AppText variant="display">¿Cuál es mejor?</AppText>
      {selected.length > 0 ? (
        <AppText variant="caption" tone="muted">
          {selected.length} {selected.length === 1 ? 'título' : 'títulos'} frente a frente · por{' '}
          {plan ? 'Para hoy' : 'CineScore'}
        </AppText>
      ) : null}
    </View>
  );

  if (selected.length === 0) {
    const hasList = candidates.length > 0;
    return (
      <Screen>
        {header}
        <EmptyState
          icon="scale"
          title="Elige qué enfrentar"
          message={
            hasList
              ? 'En Ranking, toca la balanza de los títulos que quieres comparar a fondo. Aparecerán aquí, cara a cara.'
              : 'Primero busca y añade a tu lista las películas que dudas en ver. Luego marca en Ranking las que quieres enfrentar.'
          }
          action={
            <Button
              label={hasList ? 'Ir a Ranking' : 'Buscar películas'}
              icon={hasList ? 'trophy' : 'search'}
              onPress={() => router.navigate(hasList ? '/ranking' : '/')}
              style={{ marginTop: Spacing.two }}
            />
          }
        />
      </Screen>
    );
  }

  return (
    <Screen>
      {header}

      <PlanPicker />

      {selected.length === 1 ? (
        <Notice icon="info" title="Marca al menos otro título">
          En Ranking, toca la balanza de otra opción para enfrentarlas aquí.
        </Notice>
      ) : first && second && firstValue != null && secondValue != null ? (
        tie ? (
          <Notice icon="scale" tone="warning" title="Empate técnico">
            {`${first.movie.title} y ${second.movie.title} están a menos de 2 puntos ${plan ? 'para tu plan de hoy' : 'en CineScore'}. Cualquiera es buena elección: decide por género o duración.`}
          </Notice>
        ) : (
          <Notice icon="trophy" title={`Gana ${first.movie.title}`}>
            {`${formatScore(firstValue)}/100 ${plan ? 'para tu plan de hoy' : 'en CineScore'}, ${formatScore(firstValue - secondValue)} puntos por delante de ${second.movie.title}.`}
          </Notice>
        )
      ) : null}

      <View style={{ gap: Spacing.three }}>
        {ranked.map((item, index) => (
          <DuelCard
            key={item.movie.imdbID}
            item={item}
            settings={settings}
            audienceEnabled={audienceEnabled}
            highlight={index === 0 && item.rank === 1 && ranked.length > 1}
            onRemove={() => dispatch({ type: 'toggleCompare', imdbID: item.movie.imdbID })}
            today={plan != null}
            commentsEnabled={state.traktKey.length > 0}
          />
        ))}
      </View>

      {state.tmdbKey ? (
        <AppText variant="caption" tone="muted" style={{ textAlign: 'center' }}>
          Plataformas de {regionName} según JustWatch. Toca un icono para abrir el título en ella.
        </AppText>
      ) : audienceEnabled ? (
        <AppText variant="caption" tone="muted" style={{ textAlign: 'center' }}>
          Plataformas de EE. UU. según MDBList (toca un icono para abrir el título). Con tu clave de TMDB
          verías las de {regionName}.
        </AppText>
      ) : null}

      <Button
        label="Elegir otros en Ranking"
        icon="trophy"
        kind="ghost"
        compact
        style={{ alignSelf: 'center' }}
        onPress={() => router.navigate('/ranking')}
      />
    </Screen>
  );
}
