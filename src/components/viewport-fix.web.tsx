import { useEffect, useState, type ReactNode } from 'react';
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

type Fix = { fullHeight: number; statusBar: number };

/**
 * Detecta un fallo de iOS 26 en la app de la pantalla de inicio. iOS dibuja la página a
 * pantalla completa (también bajo el reloj), pero le dice que mide lo que mide la barra de
 * estado menos (62 puntos en un iPhone con isla) y que no hay zonas seguras. Resultado: lo
 * de arriba queda bajo el reloj y abajo sobra una franja vacía.
 */
function measure(): Fix | null {
  if (typeof window === 'undefined') return null;
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const portrait = window.innerHeight > window.innerWidth;
  if (!standalone || !portrait) return null;
  const fullHeight = Math.max(window.screen.width, window.screen.height);
  const statusBar = fullHeight - window.innerHeight;
  // Solo ese caso: falta justo una franja del alto de la barra de estado (20 a 70 puntos).
  return statusBar >= 20 && statusBar <= 70 ? { fullHeight, statusBar } : null;
}

/**
 * Corrige ese fallo: la app pasa a ocupar toda la pantalla y las zonas seguras se
 * recalculan (el reloj arriba y, en iPhone con isla o muesca, el indicador de inicio abajo).
 * Fuera de la app de inicio, o si iOS ya da bien las medidas, no hace nada.
 */
export function ViewportFix({ children }: { children: ReactNode }) {
  const [fix, setFix] = useState(measure);
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();

  useEffect(() => {
    let width = window.innerWidth;
    const onResize = () => {
      // Abrir el teclado cambia el alto pero no el ancho: solo se vuelve a medir al girar.
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      setFix(measure());
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    // html, body y #root miden el 100 % de html: basta con darle el alto real de la pantalla.
    document.documentElement.style.height = fix ? `${fix.fullHeight}px` : '';
  }, [fix]);

  if (!fix) return <>{children}</>;
  const fixedInsets = {
    ...insets,
    top: Math.max(insets.top, fix.statusBar),
    bottom: Math.max(insets.bottom, fix.statusBar >= 44 ? 34 : 0),
  };
  return (
    <SafeAreaFrameContext.Provider value={{ ...frame, height: fix.fullHeight }}>
      <SafeAreaInsetsContext.Provider value={fixedInsets}>{children}</SafeAreaInsetsContext.Provider>
    </SafeAreaFrameContext.Provider>
  );
}
