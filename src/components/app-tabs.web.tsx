import { TabList, TabSlot, Tabs, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { AppText } from '@/components/ui';
import { MaxContentWidth, Palette, Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/store/app-store';

/** Barra de pestañas para la versión web (vista previa en navegador). */
export default function AppTabs() {
  const { state } = useApp();
  const count = state.candidates.length;
  const { width } = useWindowDimensions();
  // Los TabTrigger deben ser hijos directos de la barra para que Expo Router
  // los registre como pantallas; el centrado se hace con padding.
  const sidePadding = Math.max(0, (width - MaxContentWidth) / 2);
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <View style={StyleSheet.flatten([styles.bar, { paddingHorizontal: sidePadding }])}>
          <TabTrigger name="index" href="/" asChild>
            <TabButton icon="search" label="Buscar" />
          </TabTrigger>
          <TabTrigger name="ranking" href="/ranking" asChild>
            <TabButton icon="trophy" label="Ranking" badge={count > 0 ? String(count) : undefined} />
          </TabTrigger>
          <TabTrigger name="compare" href="/compare" asChild>
            <TabButton icon="scale" label="¿Cuál es mejor?" />
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton icon="settings" label="Ajustes" />
          </TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}

function TabButton({
  icon,
  label,
  badge,
  isFocused,
  ref: _ref,
  ...props
}: TabTriggerSlotProps & { icon: IconName; label: string; badge?: string }) {
  const color = isFocused ? Palette.accent : Palette.textMuted;
  return (
    <Pressable {...props} style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}>
      <View>
        <Icon name={icon} size={22} color={color} />
        {badge ? (
          <View style={styles.badge}>
            <AppText style={styles.badgeText}>{badge}</AppText>
          </View>
        ) : null}
      </View>
      <AppText style={[styles.label, { color }]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
    backgroundColor: 'rgba(10, 9, 8, 0.94)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
  },
  button: { flex: 1, maxWidth: 140, alignItems: 'center', gap: 2, paddingHorizontal: Spacing.one, paddingVertical: Spacing.one },
  label: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
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
