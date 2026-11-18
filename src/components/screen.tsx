import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Palette, Spacing } from '@/constants/theme';
import { useTabBarLayout } from '@/hooks/use-tab-bar-layout';

/**
 * Contenedor de pantalla con scroll que respeta zonas seguras y la barra
 * de pestañas en iOS, Android y web.
 * Con `hero`, la portada ocupa todo el ancho y llega hasta arriba (debajo de la cabecera).
 */
export function Screen({
  children,
  withTabBar = true,
  hero,
  extraBottom = 0,
  centered,
  ...scrollProps
}: ScrollViewProps & {
  children: ReactNode;
  withTabBar?: boolean;
  hero?: ReactNode;
  /** Espacio extra abajo, p. ej. para una barra flotante. */
  extraBottom?: number;
  /** Centra el contenido en vertical (pantallas casi vacías, como el buscador). */
  centered?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { clearance } = useTabBarLayout();
  const immersive = hero != null;
  const bottom = (withTabBar ? clearance : insets.bottom) + Spacing.five + extraBottom;
  const top = immersive ? 0 : (withTabBar ? insets.top : 0) + Spacing.four;

  return (
    <ScrollView
      {...scrollProps}
      style={styles.scroll}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior={withTabBar || immersive ? 'never' : 'automatic'}
      contentContainerStyle={[styles.content, centered && { flexGrow: 1 }, { paddingTop: top, paddingBottom: bottom }]}>
      {hero ? <View style={styles.hero}>{hero}</View> : null}
      <View style={[styles.inner, immersive && { marginTop: Spacing.two }, centered && styles.centered]}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Palette.background },
  content: { alignItems: 'center' },
  hero: { width: '100%', maxWidth: MaxContentWidth },
  inner: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.five, paddingHorizontal: Spacing.four },
  centered: { flex: 1, justifyContent: 'center' },
});
