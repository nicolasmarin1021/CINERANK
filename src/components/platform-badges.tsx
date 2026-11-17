import { StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/ui';
import { platformsFor } from '@/lib/platforms';
import type { WatchProvider } from '@/lib/types';

/** Insignias de las plataformas donde se puede ver (o alquilar) un título. */
export function PlatformBadges({ providers }: { providers: WatchProvider[] | null }) {
  const { kind, items } = platformsFor(providers);
  if (items.length === 0) return null;
  const names = items.map((p) => p.name).join(', ');
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${kind === 'stream' ? 'Disponible en' : 'En alquiler o compra en'} ${names}, según datos de EE. UU.`}>
      {kind === 'rent' ? (
        <AppText variant="caption" tone="muted" style={{ fontSize: 11 }}>
          Alquiler
        </AppText>
      ) : null}
      {items.map((p) => (
        <View key={p.key} style={[styles.tile, { backgroundColor: p.bg }]}>
          <Text
            style={{
              color: p.fg,
              fontWeight: '900',
              fontSize: p.short.length > 3 ? 8.5 : p.short.length === 3 ? 10 : 13,
              letterSpacing: p.short.length > 2 ? -0.2 : 0,
            }}>
            {p.short}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tile: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
});
