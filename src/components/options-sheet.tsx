import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { AppText, Button } from '@/components/ui';
import { Palette, Radius, Spacing } from '@/constants/theme';

/** Panel que sube desde abajo con opciones (orden, filtros). Se cierra tocando fuera o con "Listo". */
export function OptionsSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.four }]} accessibilityViewIsModal>
          <View style={styles.grabber} />
          <AppText variant="heading" style={{ marginBottom: Spacing.two }}>
            {title}
          </AppText>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: Spacing.one }}>
            {children}
          </ScrollView>
          <Button label="Listo" onPress={onClose} style={{ marginTop: Spacing.four }} />
        </View>
      </View>
    </Modal>
  );
}

export function SheetSection({ title }: { title: string }) {
  return (
    <AppText variant="caption" tone="muted" style={styles.section}>
      {title}
    </AppText>
  );
}

export function OptionRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [styles.option, pressed && { backgroundColor: Palette.surfacePressed }]}>
      <AppText style={{ flex: 1, fontWeight: selected ? '600' : '400' }}>{label}</AppText>
      {selected ? <Icon name="check" size={18} color={Palette.accent} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: Palette.scrim },
  sheet: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '85%',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    backgroundColor: Palette.surface,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: Palette.borderStrong,
    marginBottom: Spacing.three,
  },
  section: { marginTop: Spacing.three, marginBottom: Spacing.one, marginLeft: Spacing.one },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceRaised,
  },
});
