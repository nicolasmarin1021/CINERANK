import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/components/icon';
import { Palette, Radius } from '@/constants/theme';

/**
 * Los pósters de OMDb vienen a 300 px de ancho ("…_SX300.jpg"). El mismo servidor
 * entrega versiones más grandes cambiando ese número, útil para las portadas a pantalla completa.
 */
export function posterUrl(uri: string, width: number) {
  return uri.replace(/_SX\d+(?=[._])/, `_SX${width}`);
}

export function Poster({ uri, width, title }: { uri: string | null; width: number; title?: string }) {
  const height = Math.round(width * 1.48);
  const radius = width > 100 ? Radius.md : 6;
  if (!uri) {
    return (
      <View
        accessibilityLabel={title ? `Sin póster de ${title}` : 'Sin póster'}
        style={[styles.placeholder, { width, height, borderRadius: radius }]}>
        <Icon name="film" size={Math.max(16, width / 3)} color={Palette.textMuted} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri: width > 120 ? posterUrl(uri, 600) : uri }}
      accessibilityLabel={title ? `Póster de ${title}` : 'Póster'}
      style={{ width, height, borderRadius: radius, backgroundColor: Palette.surface }}
      contentFit="cover"
      transition={200}
      recyclingKey={uri}
    />
  );
}

/**
 * Portada a todo lo ancho: el póster recortado por arriba que se funde con el
 * escenario negro. El contenido (título, etc.) va encima, abajo.
 */
export function Backdrop({
  uri,
  height,
  children,
  rounded,
  style,
}: {
  uri: string | null;
  height: number;
  children?: ReactNode;
  rounded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { height, width: '100%', backgroundColor: Palette.surface, overflow: 'hidden' },
        rounded && { borderRadius: Radius.lg },
        style,
      ]}>
      {uri ? (
        <Image
          source={{ uri: posterUrl(uri, 1000) }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="top"
          transition={250}
          recyclingKey={uri}
          accessible={false}
        />
      ) : null}
      <LinearGradient
        colors={['rgba(10, 9, 8, 0.55)', 'rgba(10, 9, 8, 0)']}
        style={[StyleSheet.absoluteFill, { height: 110 }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(10, 9, 8, 0)', 'rgba(10, 9, 8, 0.72)', Palette.background]}
        locations={[0.3, 0.72, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children ? <View style={styles.backdropContent}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdropContent: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, gap: 4 },
});
