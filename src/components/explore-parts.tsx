import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { AppText, IconButton } from '@/components/ui';
import { Palette, Radius, Spacing } from '@/constants/theme';
import type { ExploreItem } from '@/lib/explore-client';
import { tmdbImage, type StreamingProvider } from '@/lib/tmdb-parse';

/** Botón ⚙️ que abre Ajustes (ya no es una pestaña). */
export function SettingsButton() {
  return <IconButton icon="settings" label="Ajustes" filled onPress={() => router.push('/settings')} />;
}

/** Fila desplazable de plataformas con su logo; "Todas" primero. */
export function ProviderPicker({
  providers,
  selected,
  onSelect,
  loading,
}: {
  providers: StreamingProvider[];
  selected: number | null;
  onSelect: (id: number | null) => void;
  loading: boolean;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.providers}>
      <ProviderTile name="Todas" selected={selected == null} onPress={() => onSelect(null)} />
      {loading && providers.length === 0 ? (
        <ActivityIndicator color={Palette.textMuted} style={{ marginLeft: Spacing.three }} />
      ) : (
        providers.map((p) => (
          <ProviderTile
            key={p.id}
            name={p.name}
            logo={tmdbImage(p.logoPath, 'w92')}
            selected={selected === p.id}
            onPress={() => onSelect(selected === p.id ? null : p.id)}
          />
        ))
      )}
    </ScrollView>
  );
}

function ProviderTile({
  name,
  logo,
  selected,
  onPress,
}: {
  name: string;
  logo?: string | null;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={name}
      style={({ pressed }) => [styles.provider, pressed && { opacity: 0.7 }]}>
      <View style={[styles.logo, selected && styles.logoSelected]}>
        {logo ? (
          <Image source={{ uri: logo }} style={styles.logoImage} contentFit="cover" accessible={false} />
        ) : (
          <Icon name="explore" size={22} color={selected ? Palette.accent : Palette.textSecondary} />
        )}
      </View>
      <AppText
        variant="caption"
        numberOfLines={1}
        style={[styles.providerName, { color: selected ? Palette.accent : Palette.textSecondary }]}>
        {name}
      </AppText>
    </Pressable>
  );
}

/** Tarjeta de un título del catálogo: póster, notas, Óscar y botón para añadirlo a tu lista. */
export function ExploreCard({
  item,
  width,
  added,
  adding,
  canAdd,
  onToggle,
}: {
  item: ExploreItem;
  width: number;
  added: boolean;
  adding: boolean;
  canAdd: boolean;
  onToggle: () => void;
}) {
  const r = item.ratings;
  const poster = tmdbImage(item.posterPath, 'w342');
  const imdbID = r?.imdbID ?? null;
  const height = Math.round(width * 1.5);
  const scores = r
    ? [r.imdb != null ? `IMDb ${r.imdb.toFixed(1)}` : null, r.rt != null ? `🍅 ${r.rt}%` : null].filter(Boolean).join(' · ')
    : item.voteAverage != null
      ? `TMDB ${item.voteAverage.toFixed(1)}`
      : '';

  return (
    <View style={{ width, gap: 4 }}>
      <Pressable
        disabled={!imdbID}
        onPress={() => imdbID && router.push({ pathname: '/movie/[id]', params: { id: imdbID } })}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}${item.year ? `, ${item.year}` : ''}${scores ? `. ${scores}` : ''}${
          r?.oscars ? `. ${r.oscars} Óscar` : ''
        }`}
        style={({ pressed }) => pressed && { opacity: 0.8 }}>
        <View style={[styles.poster, { width, height }]}>
          {poster ? (
            <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} recyclingKey={poster} />
          ) : (
            <Icon name="film" size={26} color={Palette.textMuted} />
          )}
          {r?.oscars ? (
            <View style={styles.oscar}>
              <AppText style={styles.oscarText}>🏆 {r.oscars}</AppText>
            </View>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        onPress={onToggle}
        disabled={!imdbID || adding || (!added && !canAdd)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ selected: added }}
        accessibilityLabel={added ? `Quitar ${item.title} de tu lista` : `Añadir ${item.title} a tu lista`}
        style={({ pressed }) => [
          styles.add,
          added && styles.addOn,
          (!imdbID || (!added && !canAdd)) && { opacity: 0.4 },
          pressed && { opacity: 0.7 },
        ]}>
        {adding ? (
          <ActivityIndicator size="small" color={Palette.text} />
        ) : (
          <Icon name={added ? 'check' : 'add'} size={16} color={added ? Palette.onLight : Palette.text} />
        )}
      </Pressable>
      <AppText variant="caption" numberOfLines={2} style={{ fontWeight: '600', color: Palette.text }}>
        {item.title}
      </AppText>
      <AppText variant="caption" tone="muted" numberOfLines={1} style={{ fontSize: 12 }}>
        {[item.year, scores].filter(Boolean).join(' · ')}
      </AppText>
    </View>
  );
}

/** Tarjeta vacía mientras carga. */
export function ExploreSkeleton({ width }: { width: number }) {
  return (
    <View style={{ width, gap: 6 }}>
      <View style={[styles.poster, { width, height: Math.round(width * 1.5) }]} />
      <View style={[styles.line, { width: '85%' }]} />
      <View style={[styles.line, { width: '55%' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  providers: { gap: Spacing.three, paddingRight: Spacing.four },
  provider: { width: 64, alignItems: 'center', gap: 4 },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  logoSelected: { borderColor: Palette.accent },
  logoImage: { width: '100%', height: '100%' },
  providerName: { fontSize: 11, lineHeight: 14, textAlign: 'center' },
  poster: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oscar: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(10, 9, 8, 0.78)',
  },
  oscarText: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: Palette.accent },
  add: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 9, 8, 0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.borderStrong,
  },
  addOn: { backgroundColor: Palette.accent, borderColor: Palette.accent },
  line: { height: 10, borderRadius: Radius.pill, backgroundColor: Palette.surface },
});
