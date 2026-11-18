import { Image } from 'expo-image';
import { useWindowDimensions } from 'react-native';

// Las imágenes del proyecto se cargan con require (Metro las empaqueta para cada plataforma).
const logoSource = require('@/assets/images/cinerank-logo.png');

/** Proporción del archivo (587 × 478): carrete con estrella, «CINERANK» y el lema. */
const RATIO = 587 / 478;

/**
 * Logo de la marca: carrete dorado con estrella, el nombre y «Descubre · Elige · Disfruta».
 * Mide como mucho 160 de alto (unos 197 de ancho: la resolución del archivo en un iPhone,
 * que tiene 3 píxeles por punto) y el 20 % del alto de la pantalla; `compact` lo reduce cuando
 * debajo hay un aviso (p. ej. falta la clave), para que todo quepa sobre la carátula de estrenos.
 */
export function Logo({ compact }: { compact?: boolean }) {
  const { height: windowHeight } = useWindowDimensions();
  const height = Math.round(compact ? Math.min(120, windowHeight * 0.14) : Math.min(160, windowHeight * 0.2));
  return (
    <Image
      source={logoSource}
      style={{ width: Math.round(height * RATIO), height, alignSelf: 'center' }}
      contentFit="contain"
      accessible
      accessibilityRole="header"
      accessibilityLabel="CineRank. Descubre, elige, disfruta"
    />
  );
}
