import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, WebTabBar } from '@/constants/theme';

/**
 * Dónde queda la barra de pestañas y cuánto hay que dejar libre debajo del contenido
 * (`clearance`, medido desde el borde inferior) para que nada quede tapado.
 *
 * En web la barra flota como la de iOS 26:
 * - App de inicio del iPhone (hay zona segura abajo): baja hasta el indicador de inicio.
 * - Navegador del celular: Safari ya reserva abajo el espacio de sus controles, así que
 *   la barra solo deja un margen mínimo.
 * - Escritorio: un margen algo mayor para que se vea flotar.
 */
export function useTabBarLayout() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web') return { bottom: 0, clearance: insets.bottom + BottomTabInset };
  const bottom = insets.bottom > 0 ? Math.max(insets.bottom - 20, 12) : width < 600 ? 8 : 16;
  return { bottom, clearance: bottom + WebTabBar.height };
}
