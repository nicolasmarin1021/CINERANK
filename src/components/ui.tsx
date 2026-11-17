import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Palette, Radius, Spacing } from '@/constants/theme';

type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption' | 'number';
type TextTone = 'default' | 'secondary' | 'muted' | 'accent' | 'danger' | 'warning';

const toneColor: Record<TextTone, string> = {
  default: Palette.text,
  secondary: Palette.textSecondary,
  muted: Palette.textMuted,
  accent: Palette.accent,
  danger: Palette.danger,
  warning: Palette.warning,
};

export function AppText({
  variant = 'body',
  tone = 'default',
  style,
  ...rest
}: TextProps & { variant?: TextVariant; tone?: TextTone }) {
  return <Text {...rest} style={[textStyles[variant], { color: toneColor[tone] }, style]} />;
}

/** Escala tipográfica al estilo de iOS: títulos grandes y en negrita, texto base de 16. */
const textStyles = StyleSheet.create({
  display: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: -0.4 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  number: { fontSize: 16, lineHeight: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
});

/** Panel sin borde: se distingue del fondo solo por el tono. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Línea fina para separar filas. */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  const fg = selected ? Palette.onLight : Palette.text;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
      {icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <AppText variant="caption" style={{ color: fg, fontWeight: '600' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Selector segmentado (como el de iOS) para dos o tres opciones excluyentes. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.segmented, style]} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            hitSlop={{ top: 6, bottom: 6 }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && styles.segmentSelected]}>
            <AppText
              variant="caption"
              style={{ fontWeight: '600', color: selected ? Palette.text : Palette.textSecondary }}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
 * primary: píldora marfil con texto negro (la acción principal de la pantalla).
 * secondary: píldora oscura. ghost y danger: solo texto.
 */
export function Button({
  label,
  icon,
  kind = 'primary',
  loading,
  disabled,
  style,
  compact,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  icon?: IconName;
  kind?: ButtonKind;
  loading?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const fg =
    kind === 'primary'
      ? Palette.onLight
      : kind === 'danger'
        ? Palette.danger
        : kind === 'ghost'
          ? Palette.textSecondary
          : Palette.text;
  return (
    <Pressable
      {...rest}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        buttonKind[kind],
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : icon ? (
        <Icon name={icon} size={compact ? 15 : 17} color={fg} />
      ) : null}
      <AppText variant="label" style={{ color: fg, fontSize: compact ? 14 : 16 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const buttonKind = StyleSheet.create({
  primary: { backgroundColor: Palette.text },
  secondary: { backgroundColor: Palette.surfaceRaised },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: 'transparent' },
});

/** Botón de solo icono. El área táctil llega a 44 pt aunque el icono sea pequeño. */
export function IconButton({
  icon,
  onPress,
  label,
  color = Palette.text,
  size = 18,
  filled,
}: {
  icon: IconName;
  onPress: (event: GestureResponderEvent) => void;
  label: string;
  color?: string;
  size?: number;
  /** Círculo oscuro detrás del icono. */
  filled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconButton, filled && styles.iconButtonFilled, pressed && styles.pressed]}>
      <Icon name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function SectionHeader({ title, caption, right }: { title: string; caption?: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="heading">{title}</AppText>
        {caption ? (
          <AppText variant="caption" tone="muted">
            {caption}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/** Aviso discreto: panel neutro, el color solo en el icono y el título. */
export function Notice({
  icon = 'info',
  tone = 'accent',
  title,
  children,
  action,
}: {
  icon?: IconName;
  tone?: 'accent' | 'warning' | 'danger';
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const color = tone === 'warning' ? Palette.warning : tone === 'danger' ? Palette.danger : Palette.accent;
  return (
    <View style={styles.notice}>
      <Icon name={icon} size={18} color={color} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: Spacing.one }}>
        {title ? <AppText variant="label">{title}</AppText> : null}
        {typeof children === 'string' ? (
          <AppText variant="caption" tone="secondary">
            {children}
          </AppText>
        ) : (
          children
        )}
        {action}
      </View>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: IconName;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={28} color={Palette.accent} />
      </View>
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      <AppText tone="secondary" style={{ textAlign: 'center', maxWidth: 320 }}>
        {message}
      </AppText>
      {action}
    </View>
  );
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.four,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Palette.border },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 36,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
  },
  chipSelected: { backgroundColor: Palette.text },
  segmented: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: 10,
    backgroundColor: Palette.surface,
  },
  segment: {
    flex: 1,
    minHeight: 34,
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: { backgroundColor: Palette.surfacePressed },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 48,
    paddingHorizontal: Spacing.five,
    borderRadius: Radius.pill,
  },
  buttonCompact: {
    minHeight: 40,
    paddingHorizontal: Spacing.four,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonFilled: { width: 44, height: 44, backgroundColor: Palette.surfaceRaised },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.three,
  },
  notice: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.seven,
    paddingHorizontal: Spacing.five,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.surface,
    marginBottom: Spacing.one,
  },
});
