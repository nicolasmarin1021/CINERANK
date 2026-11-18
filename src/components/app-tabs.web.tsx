import { usePathname } from 'expo-router';
import { TabList, TabSlot, Tabs, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { useEffect } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { AppText } from '@/components/ui';
import { Palette, Radius, WebTabBar } from '@/constants/theme';
import { useTabBarLayout } from '@/hooks/use-tab-bar-layout';
import { useApp } from '@/store/app-store';

/** Rutas de las pestañas, en el orden en que aparecen en la barra. */
const ROUTES = ['/', '/ranking', '/compare', '/explore'] as const;

/**
 * Vidrio líquido en CSS: el navegador no tiene el material nativo de iOS 26, así que
 * se imita con desenfoque del fondo, brillo en el borde y una cápsula que se desliza
 * y se estira como un líquido al cambiar de pestaña.
 */
const GLASS_CSS = `
.cr-glass {
  position: absolute; inset: 0; border-radius: 999px; overflow: hidden;
  background: linear-gradient(180deg, rgba(64, 58, 54, 0.50), rgba(22, 19, 17, 0.58));
  -webkit-backdrop-filter: blur(22px) saturate(180%);
  backdrop-filter: blur(22px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    inset 0 -1px 0 rgba(0, 0, 0, 0.30),
    0 14px 34px rgba(0, 0, 0, 0.55);
  pointer-events: none;
}
.cr-glass::before {
  content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0) 48%);
}
.cr-pill {
  position: absolute; top: 5px; bottom: 5px; left: 5px; width: calc((100% - 10px) / ${ROUTES.length});
  transition: transform 560ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.cr-pill-blob {
  width: 100%; height: 100%; border-radius: 999px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.06));
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 4px 14px rgba(0, 0, 0, 0.25);
  animation: cr-liquid 560ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes cr-liquid {
  0% { transform: scale(1.22, 0.8); }
  45% { transform: scale(0.94, 1.06); }
  100% { transform: scale(1, 1); }
}
.cr-top-fade {
  position: absolute; top: 0; left: 0; right: 0; pointer-events: none;
  background: linear-gradient(180deg, rgba(10, 9, 8, 0.94) 0%, rgba(10, 9, 8, 0.78) 62%, rgba(10, 9, 8, 0) 100%);
}
@media (prefers-reduced-motion: reduce) {
  .cr-pill { transition: none; }
  .cr-pill-blob { animation: none; }
}
`;

/** Barra de pestañas para la versión web: cápsula flotante de vidrio líquido, como en iOS. */
export default function AppTabs() {
  const { state } = useApp();
  const count = state.candidates.length;
  const { width } = useWindowDimensions();
  const { top } = useSafeAreaInsets();
  const { bottom } = useTabBarLayout();
  const pathname = usePathname();
  const active = Math.max(
    0,
    ROUTES.findIndex((r) => (r === '/' ? pathname === '/' : pathname.startsWith(r))),
  );
  const barWidth = Math.min(width - WebTabBar.sideMargin * 2, WebTabBar.maxWidth);
  useKeepPageInPlace();

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <style>{GLASS_CSS}</style>
      {/* Bajo el reloj del iPhone el contenido se desvanece al subir, como en iOS 26. */}
      {top > 0 ? <div className="cr-top-fade" style={{ height: top + 8 }} /> : null}
      {/*
        Expo Router solo registra las pestañas si TabList es hijo directo de Tabs y los
        TabTrigger son hijos directos de su View. Por eso la propia fila es la cápsula y
        el vidrio va dentro como primer hijo (el router ignora lo que no es TabTrigger).
      */}
      <TabList asChild>
        <View
          style={StyleSheet.flatten([
            styles.capsule,
            { width: barWidth, left: (width - barWidth) / 2, bottom },
          ])}>
          <div className="cr-glass">
            <div className="cr-pill" style={{ transform: `translateX(${active * 100}%)` }}>
              {/* La clave reinicia el "estirón" líquido en cada cambio de pestaña. */}
              <div key={active} className="cr-pill-blob" />
            </div>
          </div>
          <TabTrigger name="index" href="/" asChild>
            <TabButton icon="search" label="Buscar" />
          </TabTrigger>
          <TabTrigger name="ranking" href="/ranking" asChild>
            <TabButton icon="trophy" label="Ranking" badge={count > 0 ? String(count) : undefined} />
          </TabTrigger>
          <TabTrigger name="compare" href="/compare" asChild>
            <TabButton icon="scale" label="¿Cuál es mejor?" />
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton icon="explore" label="Explorar" />
          </TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}

/**
 * Arreglos del iPhone para cuando se cierra el teclado:
 * - iOS desplaza la página para mostrar el campo y a veces no la devuelve (lo de arriba
 *   queda bajo el reloj). La ventana nunca debe moverse, así que vuelve a su sitio.
 * - En la app de la pantalla de inicio, la primera vez que se abre el teclado iOS encoge la
 *   pantalla y no la recupera hasta cerrar la app: abajo queda una franja negra. Ocultar y
 *   volver a mostrar la raíz en el mismo instante obliga a WebKit a recalcular el alto
 *   (https://dev.to/cederhook/fixing-the-ios-standalone-pwa-keyboard-bug-that-shrinks-your-viewport-for-good-63d).
 */
function useKeepPageInPlace() {
  useEffect(() => {
    // Alto más grande visto con este ancho (girar el teléfono cambia el alto legítimamente).
    let tallest = { width: window.innerWidth, height: window.innerHeight };
    const editing = () => {
      const el = document.activeElement;
      return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
    };
    const standalone = () =>
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;

    const heal = () => {
      if (editing()) return;
      window.scrollTo(0, 0);
      const root = document.getElementById('root');
      const shrunk = tallest.width === window.innerWidth && tallest.height - window.innerHeight > 4;
      if (!root || !shrunk || !standalone()) return;
      // Ocultar la raíz reinicia el scroll de cada lista: se guarda y se restaura.
      const scrolled = Array.from(root.querySelectorAll<HTMLElement>('*'))
        .filter((el) => el.scrollTop > 0)
        .map((el) => [el, el.scrollTop] as const);
      root.style.display = 'none';
      void root.offsetHeight;
      root.style.display = '';
      for (const [el, top] of scrolled) el.scrollTop = top;
    };
    // Se espera un poco: el teclado tarda en cerrarse y el foco en pasar al siguiente campo.
    const healSoon = () => setTimeout(heal, 140);
    const onResize = () => {
      if (window.innerWidth !== tallest.width) {
        tallest = { width: window.innerWidth, height: window.innerHeight };
      } else if (!editing()) {
        tallest.height = Math.max(tallest.height, window.innerHeight);
      }
    };
    const onScroll = () => {
      if (window.scrollY !== 0 && !editing()) window.scrollTo(0, 0);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') healSoon();
    };

    const viewport = window.visualViewport;
    document.addEventListener('focusout', healSoon);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll);
    viewport?.addEventListener('resize', healSoon);
    return () => {
      document.removeEventListener('focusout', healSoon);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      viewport?.removeEventListener('resize', healSoon);
    };
  }, []);
}

function TabButton({
  icon,
  label,
  badge,
  isFocused,
  ref: _ref,
  ...props
}: TabTriggerSlotProps & { icon: IconName; label: string; badge?: string }) {
  const color = isFocused ? Palette.accent : Palette.text;
  return (
    <Pressable
      {...props}
      role="tab"
      aria-selected={!!isFocused}
      style={({ pressed, hovered }) => [
        styles.button,
        hovered && !isFocused && { opacity: 0.85 },
        pressed && { transform: [{ scale: 0.94 }] },
      ]}>
      <View>
        <Icon name={icon} size={24} color={color} />
        {badge ? (
          <View style={styles.badge}>
            <AppText style={styles.badgeText}>{badge}</AppText>
          </View>
        ) : null}
      </View>
      <AppText numberOfLines={1} style={[styles.label, { color }]}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  capsule: {
    position: 'absolute',
    height: WebTabBar.height,
    paddingHorizontal: 5,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    flex: 1,
    height: WebTabBar.height - 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: Radius.pill,
    // Solo web: transición corta para que el toque se sienta inmediato.
    transitionProperty: 'transform, opacity',
    transitionDuration: '160ms',
    cursor: 'pointer',
  },
  // Como en iOS 26: etiquetas de 10 puntos, así «¿Cuál es mejor?» cabe entero en el iPhone.
  label: { fontSize: 10, lineHeight: 13, fontWeight: '600' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: Radius.pill,
    backgroundColor: Palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, lineHeight: 12, fontWeight: '800', color: Palette.onLight },
});
