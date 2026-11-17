import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { AppText } from '@/components/ui';
import { Fonts, Palette, Radius, Spacing } from '@/constants/theme';

const BULBS = 13;

/** Fila de bombillas de marquesina (alternan marfil y oro). */
function Bulbs() {
  return (
    <View style={styles.bulbs}>
      {Array.from({ length: BULBS }, (_, i) => (
        <View key={i} style={[styles.bulb, { backgroundColor: i % 2 ? Palette.accent : Palette.text }]} />
      ))}
    </View>
  );
}

/**
 * Logo de CineRank: máscaras de teatro y el nombre en letras art déco
 * dentro de una marquesina con bombillas, como la de un teatro de Broadway.
 */
export function Logo() {
  return (
    <View style={styles.wrap} accessible accessibilityRole="header" accessibilityLabel="CineRank">
      <View style={styles.mark}>
        <Icon name="masks" size={20} color={Palette.onLight} />
      </View>
      <View style={styles.marquee}>
        <Bulbs />
        <AppText style={styles.word}>CINERANK</AppText>
        <Bulbs />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing.three },
  mark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marquee: {
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.two,
    gap: 6,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Palette.accent,
    backgroundColor: 'rgba(178, 30, 53, 0.18)',
  },
  bulbs: { flexDirection: 'row', justifyContent: 'space-between' },
  bulb: { width: 4, height: 4, borderRadius: 2, opacity: 0.9 },
  word: {
    fontFamily: Fonts.marquee,
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: 3,
    color: Palette.accent,
    textAlign: 'center',
  },
});
