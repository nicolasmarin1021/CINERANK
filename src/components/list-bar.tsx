import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui';
import { BottomTabInset, MaxContentWidth, Palette, Radius, Spacing } from '@/constants/theme';

/** Alto que ocupa la barra, para dejar ese espacio libre al final del scroll. */
export const LIST_BAR_SPACE = 76;

/**
 * Barra fija sobre las pestañas con el tamaño de tu lista. Al flotar, añadir
 * títulos ya no desplaza los resultados de búsqueda.
 */
export function ListBar({ count }: { count: number }) {
  const insets = useSafeAreaInsets();
  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(150)}
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + BottomTabInset + Spacing.two }]}>
      <Pressable
        onPress={() => router.navigate('/ranking')}
        accessibilityRole="button"
        accessibilityLabel={`${count} ${count === 1 ? 'título' : 'títulos'} en tu lista. Ver ranking`}
        style={({ pressed }) => [styles.bar, pressed && { opacity: 0.85 }]}>
        <AppText style={styles.count}>{count}</AppText>
        <View style={{ flex: 1 }}>
          <AppText variant="label">en tu lista</AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {count < 2 ? 'Añade otra para comparar' : 'Mira cuál gana'}
          </AppText>
        </View>
        <View style={styles.cta}>
          <AppText variant="caption" style={{ color: Palette.onLight, fontWeight: '700' }}>
            Ver ranking
          </AppText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Spacing.four, right: Spacing.four, alignItems: 'center' },
  bar: {
    width: '100%',
    maxWidth: MaxContentWidth - Spacing.four * 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingLeft: Spacing.four,
    paddingRight: Spacing.three,
    borderRadius: Radius.xl,
    backgroundColor: Palette.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
  },
  count: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
    color: Palette.accent,
    fontVariant: ['tabular-nums'],
  },
  cta: {
    minHeight: 36,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
    backgroundColor: Palette.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
