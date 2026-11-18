import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { AppText, Button, Card, Chip, Notice, SectionHeader } from '@/components/ui';
import { SourceDot } from '@/components/scores';
import { Palette, Radius, Spacing, TierColor } from '@/constants/theme';
import { MDBLIST_SIGNUP_URL, testMdblistKey } from '@/lib/mdblist';
import { OMDB_SIGNUP_URL, testApiKey } from '@/lib/omdb';
import { TMDB_SIGNUP_URL, testTmdbKey } from '@/lib/tmdb';
import { TRAKT_APPS_URL, testTraktKey } from '@/lib/trakt';
import { AWARDS_BONUS_LEVELS, weightShares, type TierKey } from '@/lib/ranking';
import { SOURCE_AUDIENCE, SOURCE_LABEL, type SourceKey, type Weights } from '@/lib/types';
import { useApp } from '@/store/app-store';

// Los pesos se normalizan: { 50, 50, 50 } equivale a un tercio cada fuente.
const PRESETS: { label: string; weights: Weights }[] = [
  { label: 'Equilibrado', weights: { imdb: 50, rt: 50, popcorn: 50, comments: 25 } },
  { label: 'Manda la crítica', weights: { imdb: 25, rt: 50, popcorn: 25, comments: 10 } },
  { label: 'Manda el público', weights: { imdb: 40, rt: 20, popcorn: 40, comments: 40 } },
  { label: 'Solo Rotten Tomatoes', weights: { imdb: 0, rt: 50, popcorn: 50, comments: 0 } },
];

const RIGOR = [
  { label: 'Suave', votes: 2_500 },
  { label: 'Normal', votes: 10_000 },
  { label: 'Estricto', votes: 25_000 },
];

const TIERS: { key: TierKey; label: string; range: string }[] = [
  { key: 'essential', label: 'Imprescindible', range: '85 – 100' },
  { key: 'great', label: 'Muy recomendable', range: '75 – 84' },
  { key: 'good', label: 'Buena opción', range: '65 – 74' },
  { key: 'mixed', label: 'Irregular', range: '50 – 64' },
  { key: 'avoid', label: 'Mejor evítala', range: '0 – 49' },
];

const SOURCES: SourceKey[] = ['imdb', 'rt', 'popcorn', 'comments'];

const AWARDS_LABEL: Record<(typeof AWARDS_BONUS_LEVELS)[number], string> = {
  0: 'Sin bonus',
  3: 'Suave · +3',
  6: 'Medio · +6',
  10: 'Fuerte · +10',
};

type KeyStatus =
  { kind: 'idle' } | { kind: 'testing' } | { kind: 'ok'; detail?: KeyTestDetail } | { kind: 'error'; message: string };

/** Resultado opcional de probar una clave, para mostrar qué devolvió el servicio. */
type KeyTestDetail = { message: string; warn?: boolean };

async function testMdblist(key: string): Promise<KeyTestDetail> {
  const scores = await testMdblistKey(key);
  if (scores.popcorn != null) {
    return {
      message: `Prueba con The Shawshank Redemption: crítica ${scores.tomatoes ?? '—'}% · público ${scores.popcorn}%`,
    };
  }
  return {
    warn: true,
    message: `La clave funciona, pero MDBList no devolvió el público de RT. Recibido: ${
      scores.sources.join(', ').slice(0, 300) || 'ninguna calificación'
    }`,
  };
}

async function testTmdb(key: string): Promise<KeyTestDetail> {
  const n = await testTmdbKey(key);
  return { message: `Clave válida: TMDB conoce ${n} plataformas en México. Ya puedes usar Explorar.` };
}

async function testTrakt(key: string): Promise<KeyTestDetail> {
  const r = await testTraktKey(key);
  if (r.score != null) {
    return {
      message: `Prueba con The Shawshank Redemption: ${r.rated} comentarios con nota · ${r.score}% de media.`,
    };
  }
  return {
    warn: true,
    message: `La clave funciona, pero de ${r.total} comentarios solo ${r.rated} traían nota. Campos recibidos: ${
      r.fields.join(', ') || 'ninguno'
    }`,
  };
}

export default function SettingsScreen() {
  const { state, dispatch } = useApp();
  const { settings } = state;
  const shares = weightShares(settings.weights);
  const activeSources = SOURCES.filter((s) => shares[s] > 0);

  function changeWeight(source: SourceKey, delta: number) {
    const next = { ...settings.weights, [source]: Math.max(0, Math.min(100, settings.weights[source] + delta)) };
    dispatch({ type: 'setWeights', weights: next });
  }

  const presetActive = (w: Weights) => SOURCES.every((s) => w[s] === settings.weights[s]);

  return (
    // Pantalla fuera de las pestañas: se abre con el botón ⚙️ de Buscar y Explorar (título en la cabecera).
    <Screen withTabBar={false}>

      <ApiKeyCard
        title="Clave de OMDb"
        caption="Obligatoria · IMDb, crítica de RT y fichas"
        description="Pide tu clave gratuita (1.000 consultas al día) en omdbapi.com, confírmala desde el correo que te envían y pégala aquí. Se guarda solo en este dispositivo."
        savedKey={state.apiKey}
        signupUrl={OMDB_SIGNUP_URL}
        accessibilityLabel="Clave de OMDb"
        test={testApiKey}
        onSave={(apiKey) => dispatch({ type: 'setApiKey', apiKey })}
      />

      <ApiKeyCard
        title="Clave de MDBList"
        caption="Opcional · público de Rotten Tomatoes"
        description="OMDb no trae el puntaje del público de RT. MDBList sí: entra en mdblist.com, inicia sesión y crea tu clave gratuita en Preferences → API (1.000 consultas al día)."
        savedKey={state.mdblistKey}
        signupUrl={MDBLIST_SIGNUP_URL}
        accessibilityLabel="Clave de MDBList"
        test={testMdblist}
        onSave={(mdblistKey) => dispatch({ type: 'setMdblistKey', mdblistKey })}
        optional
      />

      <ApiKeyCard
        title="Clave de Trakt"
        caption="Opcional · nota de quienes comentan"
        description="Trakt es una red de espectadores que comentan y puntúan lo que ven. En app.trakt.tv/apps («My Apps») conecta tu GitHub, crea una app gratis y ábrela: ahí verás su Client ID. Pégalo aquí (no el Client Secret)."
        savedKey={state.traktKey}
        signupUrl={TRAKT_APPS_URL}
        accessibilityLabel="Client ID de Trakt"
        test={testTrakt}
        onSave={(traktKey) => dispatch({ type: 'setTraktKey', traktKey })}
        optional
      />

      <ApiKeyCard
        title="Clave de TMDB"
        caption="Opcional · catálogo de Explorar"
        description="TMDB tiene el catálogo de cada plataforma por país. Crea una cuenta gratis en themoviedb.org, entra en tu perfil → Ajustes → API, solicita una clave para uso personal y pega aquí la «Clave de la API» (o el «Token de acceso de lectura»)."
        savedKey={state.tmdbKey}
        signupUrl={TMDB_SIGNUP_URL}
        accessibilityLabel="Clave de TMDB"
        test={testTmdb}
        onSave={(tmdbKey) => dispatch({ type: 'setTmdbKey', tmdbKey })}
        optional
      />

      {/* Pesos */}
      <Card style={{ gap: Spacing.four }}>
        <SectionHeader title="Peso de cada fuente" caption="Cuánto cuenta cada calificación en el CineScore" />
        <View style={styles.chips}>
          {PRESETS.map((p) => (
            <Chip
              key={p.label}
              label={p.label}
              selected={presetActive(p.weights)}
              onPress={() => dispatch({ type: 'setWeights', weights: p.weights })}
            />
          ))}
        </View>

        <View style={{ gap: Spacing.three }}>
          {SOURCES.map((s) => (
            <View key={s} style={styles.weightRow}>
              <SourceDot source={s} size={10} />
              <View style={{ flex: 1 }}>
                <AppText variant="label">{SOURCE_LABEL[s]}</AppText>
                <AppText variant="caption" tone="muted">
                  {SOURCE_AUDIENCE[s]} ·{' '}
                  {(s === 'popcorn' && !state.mdblistKey) || (s === 'comments' && !state.traktKey)
                    ? 'sin su clave, este peso se reparte entre las demás'
                    : `${Math.round(shares[s] * 100)}% del total`}
                </AppText>
              </View>
              <Stepper
                value={settings.weights[s]}
                onMinus={() => changeWeight(s, -5)}
                onPlus={() => changeWeight(s, 5)}
                label={SOURCE_LABEL[s]}
              />
            </View>
          ))}
        </View>

        <View style={styles.formula}>
          <AppText variant="caption" tone="secondary">
            {activeSources.length === 0
              ? 'Activa al menos una fuente para poder calcular el ranking.'
              : `CineScore = ${activeSources.map((s) => `${Math.round(shares[s] * 100)}% ${SOURCE_LABEL[s]}`).join(' + ')}${
                  settings.awardsBonus > 0 ? ` + premios (hasta +${settings.awardsBonus})` : ''
                }`}
          </AppText>
        </View>
      </Card>

      {/* Bonus por premios */}
      <Card style={{ gap: Spacing.three }}>
        <SectionHeader title="Bonus por premios" caption="Óscar, Emmy, BAFTA, Globos de Oro y festivales" />
        <View style={styles.chips}>
          {AWARDS_BONUS_LEVELS.map((level) => (
            <Chip
              key={level}
              label={AWARDS_LABEL[level]}
              selected={settings.awardsBonus === level}
              onPress={() => dispatch({ type: 'setAwardsBonus', awardsBonus: level })}
            />
          ))}
        </View>
        <AppText variant="caption" tone="secondary">
          {settings.awardsBonus === 0
            ? 'Los premios no cuentan en el CineScore; solo se muestran como dato.'
            : `Suma hasta ${settings.awardsBonus} puntos y nunca resta: un título sin premios no se penaliza. Un Óscar ganado cuenta más que una nominación, y el resto de premios suma cada vez menos. Ojo: los estrenos aún no han pasado por la temporada de premios.`}
        </AppText>
      </Card>

      {/* Confianza por votos */}
      <Card style={{ gap: Spacing.three }}>
        <View style={styles.weightRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="heading">Corregir por número de votos</AppText>
            <AppText variant="caption" tone="muted">
              Evita que una película con pocos votos y nota alta en IMDb supere a un clásico con millones de votos.
            </AppText>
          </View>
          <Switch
            value={settings.voteConfidence}
            onValueChange={(enabled) => dispatch({ type: 'setVoteConfidence', enabled })}
            trackColor={{ true: Palette.accent, false: Palette.surfaceRaised }}
            thumbColor={Palette.text}
            accessibilityLabel="Corregir por número de votos"
          />
        </View>
        {settings.voteConfidence ? (
          <>
            <View style={styles.chips}>
              {RIGOR.map((r) => (
                <Chip
                  key={r.votes}
                  label={`${r.label} · ${r.votes.toLocaleString('es')}`}
                  selected={settings.minVotes === r.votes}
                  onPress={() => dispatch({ type: 'setMinVotes', minVotes: r.votes })}
                />
              ))}
            </View>
            <AppText variant="caption" tone="secondary" style={{ lineHeight: 18 }}>
              {`Promedio bayesiano: la nota IMDb se acerca a 6,5 cuando hay menos de ${settings.minVotes.toLocaleString(
                'es',
              )} votos aprox. Con cientos de miles de votos apenas cambia.`}
            </AppText>
          </>
        ) : null}
      </Card>

      {/* Explicación */}
      <Card style={{ gap: Spacing.three }}>
        <SectionHeader title="¿Cómo se calcula?" />
        <AppText variant="caption" tone="secondary" style={{ lineHeight: 19 }}>
          {
            '1. Cada nota se lleva a una escala de 0 a 100: IMDb × 10; la crítica de RT (% de reseñas positivas) y el público de RT (% de espectadores que la valoran bien) tal cual.\n2. Se combinan con los pesos de arriba. Si activas el bonus por premios, se suman además puntos por Óscar, Emmy y otros premios (según OMDb), sin pasar de 100.\n3. Si a un título le falta una fuente, su peso se reparte entre las demás y verás el aviso “Sin dato de…”.\n4. Ante un empate se prioriza el título con más fuentes y luego el que tiene más votos.\n5. “Crítica y público coinciden” compara la crítica de RT con su público (o con IMDb si falta el público).'
          }
        </AppText>
        <View style={{ gap: Spacing.two }}>
          {TIERS.map((t) => (
            <View key={t.key} style={styles.tierRow}>
              <View style={[styles.tierSwatch, { backgroundColor: TierColor[t.key] }]} />
              <AppText variant="label" style={{ flex: 1 }}>
                {t.label}
              </AppText>
              <AppText variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
                {t.range}
              </AppText>
            </View>
          ))}
        </View>
      </Card>

      <Button
        label="Restablecer ajustes del ranking"
        kind="ghost"
        icon="refresh"
        onPress={() => dispatch({ type: 'resetSettings' })}
      />

      <Notice icon="info">
        {
          'Datos de OMDb API, MDBList y Trakt; los títulos en español se resuelven con Wikidata. CineRank usa Trakt, pero Trakt no la respalda ni certifica. Catálogo de Explorar: TMDB, con plataformas de JustWatch; CineRank usa la API de TMDB, pero TMDB no la respalda ni certifica. IMDb y Rotten Tomatoes son marcas de sus respectivos dueños; CineRank no está afiliada a ellas. Las notas se guardan en caché 3 días para ahorrar consultas.'
        }
      </Notice>
    </Screen>
  );
}

function ApiKeyCard({
  title,
  caption,
  description,
  savedKey,
  signupUrl,
  accessibilityLabel,
  test,
  onSave,
  optional,
}: {
  title: string;
  caption: string;
  description: string;
  savedKey: string;
  signupUrl: string;
  accessibilityLabel: string;
  test: (key: string) => Promise<KeyTestDetail | void>;
  onSave: (key: string) => void;
  optional?: boolean;
}) {
  const [draftKey, setDraftKey] = useState(savedKey);
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<KeyStatus>({ kind: 'idle' });

  // Cuando cambia la clave guardada (p. ej. al cargar los datos), reflejarla en el campo.
  const [syncedKey, setSyncedKey] = useState(savedKey);
  if (syncedKey !== savedKey) {
    setSyncedKey(savedKey);
    setDraftKey(savedKey);
  }

  async function save() {
    const key = draftKey.trim();
    setStatus({ kind: 'testing' });
    try {
      const detail = await test(key);
      onSave(key);
      setStatus({ kind: 'ok', detail: detail ?? undefined });
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'No se pudo comprobar la clave.' });
    }
  }

  return (
    <Card style={{ gap: Spacing.three }}>
      <SectionHeader title={title} caption={caption} />
      <AppText variant="caption" tone="secondary" style={{ lineHeight: 18 }}>
        {description}
      </AppText>
      <View style={styles.keyBox}>
        <Icon name="key" size={16} color={Palette.textMuted} />
        <TextInput
          value={draftKey}
          onChangeText={(t) => {
            setDraftKey(t);
            setStatus({ kind: 'idle' });
          }}
          placeholder="Pega aquí tu clave"
          placeholderTextColor={Palette.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={!showKey}
          style={styles.keyInput}
          accessibilityLabel={accessibilityLabel}
        />
        <Pressable onPress={() => setShowKey((v) => !v)} hitSlop={8}>
          <AppText variant="caption" tone="accent">
            {showKey ? 'Ocultar' : 'Mostrar'}
          </AppText>
        </Pressable>
      </View>
      <View style={styles.row}>
        <Button
          label="Guardar y probar"
          compact
          loading={status.kind === 'testing'}
          disabled={draftKey.trim().length < 4}
          onPress={save}
        />
        <Button
          label="Obtener clave gratis"
          icon="external"
          kind="secondary"
          compact
          onPress={() => WebBrowser.openBrowserAsync(signupUrl)}
        />
        {optional && savedKey ? (
          <Button
            label="Quitar"
            icon="trash"
            kind="ghost"
            compact
            onPress={() => {
              onSave('');
              setStatus({ kind: 'idle' });
            }}
          />
        ) : null}
      </View>
      {status.kind === 'ok' ? (
        <View style={{ gap: Spacing.one }}>
          <View style={styles.row}>
            <Icon name="checkCircle" size={16} color={Palette.accent} />
            <AppText variant="caption" tone="accent">
              Clave válida y guardada.
            </AppText>
          </View>
          {status.detail ? (
            <AppText variant="caption" tone={status.detail.warn ? 'warning' : 'secondary'} style={{ lineHeight: 18 }}>
              {status.detail.message}
            </AppText>
          ) : null}
        </View>
      ) : status.kind === 'error' ? (
        <AppText variant="caption" tone="danger">
          {status.message}
        </AppText>
      ) : savedKey ? (
        <AppText variant="caption" tone="muted">
          Hay una clave guardada.
        </AppText>
      ) : null}
    </Card>
  );
}

function Stepper({
  value,
  onMinus,
  onPlus,
  label,
}: {
  value: number;
  onMinus: () => void;
  onPlus: () => void;
  label: string;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={onMinus}
        disabled={value <= 0}
        accessibilityRole="button"
        accessibilityLabel={`Bajar peso de ${label}`}
        style={({ pressed }) => [styles.stepBtn, value <= 0 && { opacity: 0.35 }, pressed && { opacity: 0.6 }]}>
        <Icon name="remove" size={16} color={Palette.text} />
      </Pressable>
      <AppText variant="number" style={styles.stepValue}>
        {value}
      </AppText>
      <Pressable
        onPress={onPlus}
        disabled={value >= 100}
        accessibilityRole="button"
        accessibilityLabel={`Subir peso de ${label}`}
        style={({ pressed }) => [styles.stepBtn, value >= 100 && { opacity: 0.35 }, pressed && { opacity: 0.6 }]}>
        <Icon name="add" size={16} color={Palette.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  keyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: Palette.background,
  },
  keyInput: { flex: 1, color: Palette.text, fontSize: 15, paddingVertical: 11 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  formula: {
    padding: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: Palette.background,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceRaised,
  },
  stepBtn: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepValue: { width: 36, textAlign: 'center' },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  tierSwatch: { width: 14, height: 14, borderRadius: 4 },
});
