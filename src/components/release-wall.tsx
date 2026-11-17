import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { Palette } from '@/constants/theme';
import { loadReleases, peekReleases, type Release } from '@/lib/releases';

const TILE_W = 92;
const TILE_H = 138;
const GAP = 10;

/**
 * Carátula de estrenos: un muro inclinado de pósters, oscurecido y que nace
 * con un desvanecido suave desde el fondo. Tocar un póster lo busca.
 */
export function ReleaseWall({ height, onPick }: { height: number; onPick: (title: string) => void }) {
  const [items, setItems] = useState<Release[]>(peekReleases);
  const { width } = useWindowDimensions();

  useEffect(() => {
    let cancelled = false;
    loadReleases().then((r) => !cancelled && setItems(r));
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) return null;

  // El muro se dibuja más grande que su caja y se gira, para que cubra las esquinas.
  const cols = Math.ceil((width * 1.6) / (TILE_W + GAP)) + 1;
  const rows = Math.ceil((height * 1.5) / (TILE_H + GAP)) + 1;
  const gridWidth = cols * (TILE_W + GAP);

  return (
    <Animated.View entering={FadeIn.duration(900)} style={[styles.wall, { height }]}>
      <View
        style={[
          styles.grid,
          {
            width: gridWidth,
            left: (width - gridWidth) / 2,
            top: -TILE_H * 0.6,
            transform: [{ rotate: '-12deg' }],
          },
        ]}>
        {Array.from({ length: rows }, (_, r) => (
          <View key={r} style={[styles.row, { marginLeft: r % 2 ? TILE_W / 2 : 0 }]}>
            {Array.from({ length: cols }, (_, c) => {
              const index = r * cols + c;
              const item = items[(index + r * 3) % items.length];
              // Cada estreno se anuncia una sola vez al lector de pantalla; las repeticiones son decorativas.
              const first = index < items.length;
              return (
                <Pressable
                  key={c}
                  onPress={() => onPick(item.title)}
                  accessible={first}
                  accessibilityRole="button"
                  accessibilityLabel={`Buscar ${item.title}`}
                  importantForAccessibility={first ? 'auto' : 'no-hide-descendants'}
                  accessibilityElementsHidden={!first}
                  style={({ pressed }) => pressed && { opacity: 0.7 }}>
                  <Image
                    source={{ uri: item.poster }}
                    style={styles.tile}
                    contentFit="cover"
                    transition={300}
                    recyclingKey={item.id}
                  />
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      {/* Oscurece el muro y lo funde con el escenario en la parte de arriba. */}
      <View style={[StyleSheet.absoluteFill, styles.dim]} pointerEvents="none" />
      <LinearGradient
        colors={[Palette.background, 'rgba(10, 9, 8, 0.7)', 'rgba(10, 9, 8, 0)']}
        locations={[0, 0.28, 0.62]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <AppText variant="caption" tone="muted" style={styles.caption} pointerEvents="none">
        Estrenos · toca uno para buscarlo
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wall: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  grid: { position: 'absolute', gap: GAP },
  row: { flexDirection: 'row', gap: GAP },
  tile: { width: TILE_W, height: TILE_H, borderRadius: 8, backgroundColor: Palette.surface },
  dim: { backgroundColor: 'rgba(10, 9, 8, 0.38)' },
  caption: { position: 'absolute', top: 6, left: 0, right: 0, textAlign: 'center' },
});
