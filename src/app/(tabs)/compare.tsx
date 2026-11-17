import { router } from 'expo-router';
import { View } from 'react-native';

import { DuelCard } from '@/components/duel-card';
import { formatScore } from '@/components/scores';
import { Screen } from '@/components/screen';
import { AppText, Button, EmptyState, Notice } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useEnrichCandidates } from '@/hooks/use-enrich-candidates';
import { isTechnicalTie, rankMovies } from '@/lib/ranking';
import { useApp } from '@/store/app-store';

/**
 * «¿Cuál es mejor?»: solo los títulos que marcaste en Ranking, cara a cara,
 * con su CineScore, nivel y las barras de cada fuente.
 */
export default function CompareScreen() {
  const { state, dispatch } = useApp();
  const { settings, candidates, compareIds } = state;
  useEnrichCandidates();
  const audienceEnabled = state.mdblistKey.length > 0;
  const selected = candidates.filter((m) => compareIds.includes(m.imdbID));
  const ranked = rankMovies(selected, settings, 'score');
  const tie = isTechnicalTie(ranked, 'score');
  const [first, second] = ranked;

  const header = (
    <View style={{ gap: 2 }}>
      <AppText variant="display">¿Cuál es mejor?</AppText>
      {selected.length > 0 ? (
        <AppText variant="caption" tone="muted">
          {selected.length} {selected.length === 1 ? 'título' : 'títulos'} frente a frente · por CineScore
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

      {selected.length === 1 ? (
        <Notice icon="info" title="Marca al menos otro título">
          En Ranking, toca la balanza de otra opción para enfrentarlas aquí.
        </Notice>
      ) : first && second && first.score != null && second.score != null ? (
        tie ? (
          <Notice icon="scale" tone="warning" title="Empate técnico">
            {`${first.movie.title} y ${second.movie.title} están a menos de 2 puntos en CineScore. Cualquiera es buena elección: decide por género o duración.`}
          </Notice>
        ) : (
          <Notice icon="trophy" title={`Gana ${first.movie.title}`}>
            {`${formatScore(first.score)}/100 en CineScore, ${formatScore(first.score - second.score)} puntos por delante de ${second.movie.title}.`}
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
          />
        ))}
      </View>

      {audienceEnabled ? (
        <AppText variant="caption" tone="muted" style={{ textAlign: 'center' }}>
          Las plataformas vienen de MDBList y reflejan la disponibilidad en EE. UU.; en tu país pueden ser otras.
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
