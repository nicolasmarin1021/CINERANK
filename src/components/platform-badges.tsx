import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { AppText } from '@/components/ui';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { REGIONS } from '@/lib/explore';
import { otherPlatforms, platformsFor, type Platform } from '@/lib/platforms';
import { getTitleProviders, peekTitleProviders, type TitleProviders } from '@/lib/tmdb';
import type { Movie } from '@/lib/types';
import { getWatchIds, peekWatchIds } from '@/lib/watch-ids';
import { watchLink, type WatchIds, type WatchLink } from '@/lib/watch-links';
import { useApp } from '@/store/app-store';

type LinkedPlatform = Platform & { link: WatchLink };

/** "a", "a y b", "a, b y c" */
function joinEs(items: string[]) {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

/**
 * Plataformas del título con el enlace de cada una.
 * - Con clave de TMDB: las del país elegido en Explorar (datos de JustWatch). Mientras
 *   llegan no se muestra nada, para no enseñar antes las de otro país.
 * - Sin clave (o si TMDB falla): las de EE. UU. que trae MDBList.
 * Además pide a Wikidata los IDs para que cada enlace abra el título exacto.
 */
function useWatchPlatforms(movie: Movie, limits?: { maxStream?: number; maxRent?: number }) {
  const { state } = useApp();
  const tmdbKey = state.tmdbKey;
  const region = state.explore.region;
  const id = movie.imdbID;
  const type = movie.type === 'series' ? 'series' : 'movie';
  const localKey = `${region}:${id}`;

  // value null: TMDB falló y se usan las de EE. UU.
  const [local, setLocal] = useState<{ key: string; value: TitleProviders | null } | null>(() => {
    const value = tmdbKey ? peekTitleProviders(id, region) : null;
    return value ? { key: localKey, value } : null;
  });
  useEffect(() => {
    if (!tmdbKey) return;
    let cancelled = false;
    const key = `${region}:${id}`;
    getTitleProviders(tmdbKey, id, type, region)
      .then((value) => {
        if (!cancelled) setLocal({ key, value });
      })
      .catch(() => {
        if (!cancelled) setLocal({ key, value: null });
      });
    return () => {
      cancelled = true;
    };
  }, [tmdbKey, id, type, region]);

  const current = tmdbKey && local?.key === localKey ? local : null;
  const loading = !!tmdbKey && current == null;
  const localValue = current?.value ?? null;
  const providers = localValue ? localValue.providers : loading ? [] : movie.providers;
  const { kind, items } = platformsFor(providers, limits);
  const others = localValue
    ? otherPlatforms(localValue.providers.filter((p) => p.category === (kind === 'rent' ? 'rent' : 'stream')))
    : [];

  const hasPlatforms = items.length > 0;
  const [loaded, setLoaded] = useState<{ id: string; ids: WatchIds } | null>(() => {
    const ids = peekWatchIds(id);
    return ids ? { id, ids } : null;
  });
  useEffect(() => {
    if (!hasPlatforms) return;
    let cancelled = false;
    getWatchIds(id).then((ids) => {
      if (!cancelled) setLoaded({ id, ids });
    });
    return () => {
      cancelled = true;
    };
  }, [id, hasPlatforms]);

  const ids = loaded?.id === id ? loaded.ids : null;
  const linked = items
    .map((p) => ({ ...p, link: watchLink(p.key, movie.title, ids, type) }))
    .filter((p): p is LinkedPlatform => p.link != null);
  return {
    kind,
    items: linked,
    others,
    loading,
    /** 'local': las del país elegido; 'us': las de EE. UU. (MDBList). */
    source: localValue ? ('local' as const) : ('us' as const),
    link: localValue?.link ?? null,
    regionName: REGIONS.find((r) => r.code === region)?.name ?? region,
    hasTmdbKey: !!tmdbKey,
  };
}

/** En el teléfono, los enlaces de Netflix, Disney+, etc. abren directamente su app si está instalada. */
function open(url: string) {
  Linking.openURL(url).catch(() => {
    // Sin navegador ni app que lo abra: no hay nada más que hacer.
  });
}

function linkLabel(p: LinkedPlatform, title: string) {
  if (p.link.kind === 'exact') return `Ver «${title}» en ${p.name}`;
  if (p.link.kind === 'search') return `Buscar «${title}» en ${p.name}`;
  return `Abrir ${p.name}`;
}

/** Cuadro con el color y la marca corta de la plataforma. */
function Tile({ platform, size = 28 }: { platform: Platform; size?: number }) {
  const { short } = platform;
  const scale = size / 28;
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: 7 * scale, backgroundColor: platform.bg }]}>
      <Text
        style={{
          color: platform.fg,
          fontWeight: '900',
          fontSize: (short.length > 3 ? 8.5 : short.length === 3 ? 10 : 13) * scale,
          letterSpacing: short.length > 2 ? -0.2 : 0,
        }}>
        {short}
      </Text>
    </View>
  );
}

/**
 * Insignias compactas de las tarjetas: cada una abre el título en su plataforma.
 * No deben ir dentro de otro botón (la tarjeta): se colocan encima, como la ✕.
 */
export function PlatformBadges({ movie }: { movie: Movie }) {
  const { kind, items } = useWatchPlatforms(movie);
  if (items.length === 0) return null;
  return (
    <View style={styles.row}>
      {kind === 'rent' ? (
        <AppText variant="caption" tone="muted" style={{ fontSize: 11 }}>
          Alquiler
        </AppText>
      ) : null}
      {items.map((p) => (
        <Pressable
          key={p.key}
          onPress={() => open(p.link.url)}
          accessibilityRole="link"
          accessibilityLabel={linkLabel(p, movie.title)}
          // El cuadro mide 28: el área táctil llega a 44 de alto sin pisar al vecino.
          hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
          style={({ pressed }) => pressed && { opacity: 0.7, transform: [{ scale: 0.94 }] }}>
          <Tile platform={p} />
        </Pressable>
      ))}
    </View>
  );
}

/** Sección «Dónde verla» de la ficha: cada plataforma con su nombre, abre el título en ella. */
export function WhereToWatch({ movie }: { movie: Movie }) {
  const { kind, items, others, loading, source, link, regionName, hasTmdbKey } = useWatchPlatforms(movie, {
    maxStream: 8,
    maxRent: 6,
  });
  const local = source === 'local';
  if (loading || (!local && items.length === 0)) return null;
  const where = local ? ` en ${regionName}` : '';
  const nothing = items.length === 0 && others.length === 0;
  const allExact = items.every((p) => p.link.kind === 'exact');
  const howTo =
    items.length === 0
      ? ''
      : allExact
        ? 'Toca una para abrir el título en su app o su web. '
        : 'La flecha abre el título directamente; con la lupa llegas a la plataforma para buscarlo. ';
  const sourceNote = local
    ? `Disponibilidad en ${regionName} según JustWatch.`
    : `Disponibilidad en EE. UU. según MDBList.${hasTmdbKey ? '' : ` Con tu clave de TMDB (Ajustes) verías la de ${regionName}.`}`;

  return (
    <View style={{ gap: Spacing.three }}>
      <AppText variant="label">{kind === 'rent' ? `Dónde alquilarla o comprarla${where}` : `Dónde verla${where}`}</AppText>
      {items.length > 0 ? (
        <View style={styles.chips}>
          {items.map((p) => (
            <Pressable
              key={p.key}
              onPress={() => open(p.link.url)}
              accessibilityRole="link"
              accessibilityLabel={linkLabel(p, movie.title)}
              style={({ pressed }) => [styles.chip, pressed && { backgroundColor: Palette.surfacePressed }]}>
              <Tile platform={p} size={26} />
              <AppText variant="label" style={{ fontSize: 14 }}>
                {p.name}
              </AppText>
              <Icon name={p.link.kind === 'exact' ? 'external' : 'search'} size={15} color={Palette.textMuted} />
            </Pressable>
          ))}
        </View>
      ) : null}
      {others.length > 0 ? (
        <AppText variant="caption" tone="secondary">
          {items.length > 0 ? 'También en' : 'Está en'} {joinEs(others)}.
        </AppText>
      ) : null}
      {nothing ? (
        <AppText variant="caption" tone="secondary">
          Por ahora no está en ninguna plataforma de {regionName}.
        </AppText>
      ) : null}
      {local && link && !nothing ? (
        <Pressable
          onPress={() => open(link)}
          accessibilityRole="link"
          accessibilityLabel={`Todas las opciones para ver «${movie.title}» en ${regionName}`}
          hitSlop={{ top: 12, bottom: 12 }}
          style={({ pressed }) => [styles.more, pressed && { opacity: 0.7 }]}>
          <AppText variant="caption" tone="accent" style={{ fontWeight: '600' }}>
            Ver todas las opciones
          </AppText>
          <Icon name="external" size={13} color={Palette.accent} />
        </Pressable>
      ) : null}
      <AppText variant="caption" tone="muted">
        {howTo}
        {sourceNote}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    paddingLeft: 9,
    paddingRight: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
  },
  more: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
});
