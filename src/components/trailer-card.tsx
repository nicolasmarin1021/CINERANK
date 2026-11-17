import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { AppText, Button } from '@/components/ui';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { trailerSearchUrl, youtubeId, youtubeThumbnail, youtubeWatchUrl } from '@/lib/trailer';
import type { Movie } from '@/lib/types';

/** Abre el vídeo dentro de la app (Safari integrado en iPhone); al cerrarlo se vuelve a la ficha. */
function openVideo(url: string) {
  return WebBrowser.openBrowserAsync(url, {
    controlsColor: Palette.accent,
    toolbarColor: Palette.background,
    dismissButtonStyle: 'close',
  });
}

/**
 * Tráiler de la ficha: miniatura 16:9 con botón de reproducir. Si no hay
 * tráiler oficial (o falta la clave de MDBList), ofrece buscarlo en YouTube.
 */
export function TrailerCard({ movie, hasMdblistKey }: { movie: Movie; hasMdblistKey: boolean }) {
  const id = youtubeId(movie.trailer);

  if (!id) {
    const note = !hasMdblistKey
      ? 'Con tu clave de MDBList (en Ajustes) aparece aquí el tráiler oficial.'
      : !movie.audienceChecked
        ? 'Buscando el tráiler oficial…'
        : 'No encontramos el tráiler oficial de este título.';
    return (
      <View style={{ gap: Spacing.two }}>
        <AppText variant="heading">Tráiler</AppText>
        <Button
          label="Buscar el tráiler en YouTube"
          icon="play"
          kind="secondary"
          compact
          style={{ alignSelf: 'flex-start' }}
          onPress={() => openVideo(trailerSearchUrl(movie.title, movie.year))}
        />
        <AppText variant="caption" tone="muted">
          {note}
        </AppText>
      </View>
    );
  }

  return (
    <View style={{ gap: Spacing.two }}>
      <AppText variant="heading">Tráiler</AppText>
      <Pressable
        onPress={() => openVideo(youtubeWatchUrl(id))}
        accessibilityRole="button"
        accessibilityLabel={`Ver el tráiler de ${movie.title}`}
        style={({ pressed }) => [styles.frame, pressed && { opacity: 0.85 }]}>
        <Image
          source={{ uri: youtubeThumbnail(id) }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          recyclingKey={id}
          accessible={false}
        />
        <View style={[StyleSheet.absoluteFill, styles.dim]} />
        <View style={styles.play}>
          <Icon name="play" size={28} color={Palette.onLight} />
        </View>
        <View style={styles.source}>
          <AppText variant="caption" style={{ color: Palette.text, fontWeight: '700' }}>
            YouTube
          </AppText>
        </View>
      </Pressable>
      <AppText variant="caption" tone="muted">
        Se abre dentro de la app; al cerrarlo vuelves a la ficha.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { backgroundColor: 'rgba(10, 9, 8, 0.35)' },
  play: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Palette.text,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  source: {
    position: 'absolute',
    left: Spacing.three,
    bottom: Spacing.three,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(10, 9, 8, 0.6)',
  },
});
