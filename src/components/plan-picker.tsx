import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { OptionRow, OptionsSheet, SheetSection } from '@/components/options-sheet';
import { AppText, Button } from '@/components/ui';
import { Palette, Radius, Spacing, TierColor } from '@/constants/theme';
import { COMPANIES, MOODS, planSummary, todayKey, type PlanFit } from '@/lib/plan';
import { useActivePlan, useApp } from '@/store/app-store';

/**
 * Botón «Tu plan de hoy» y su panel: qué te apetece y con quién la ves.
 * Al elegir algo, el ranking se reordena «Para hoy».
 */
export function PlanPicker() {
  const { dispatch } = useApp();
  const plan = useActivePlan();
  const [open, setOpen] = useState(false);
  const mood = plan?.mood ?? null;
  const company = plan?.company ?? null;

  const set = (next: { mood?: typeof mood; company?: typeof company }) =>
    dispatch({
      type: 'setPlan',
      mood: next.mood !== undefined ? next.mood : mood,
      company: next.company !== undefined ? next.company : company,
      day: todayKey(),
    });

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={plan ? `Tu plan de hoy: ${planSummary(plan)}. Cambiar` : 'Elegir tu plan de hoy'}
        style={({ pressed }) => [styles.button, plan && styles.buttonActive, pressed && { opacity: 0.8 }]}>
        <Icon name="masks" size={17} color={plan ? Palette.onLight : Palette.accent} />
        <View style={{ flex: 1 }}>
          <AppText variant="label" numberOfLines={1} style={{ color: plan ? Palette.onLight : Palette.text }}>
            {plan ? planSummary(plan) : 'Tu plan de hoy'}
          </AppText>
          <AppText variant="caption" numberOfLines={1} style={{ color: plan ? Palette.onLight : Palette.textMuted }}>
            {plan ? 'Ordenado «Para hoy» · toca para cambiar' : '¿Qué te apetece y con quién la ves?'}
          </AppText>
        </View>
        <Icon name="chevronDown" size={15} color={plan ? Palette.onLight : Palette.textSecondary} />
      </Pressable>

      <OptionsSheet visible={open} onClose={() => setOpen(false)} title="Tu plan de hoy">
        <SheetSection title="¿Qué te apetece?" />
        {MOODS.map((m) => (
          <OptionRow
            key={m.value}
            label={`${m.emoji}  ${m.label}`}
            selected={mood === m.value}
            onPress={() => set({ mood: m.value })}
          />
        ))}
        <OptionRow label="Me da igual" selected={mood == null} onPress={() => set({ mood: null })} />

        <SheetSection title="¿Con quién la ves?" />
        {COMPANIES.map((c) => (
          <OptionRow
            key={c.value}
            label={c.label}
            selected={company === c.value}
            onPress={() => set({ company: c.value })}
          />
        ))}
        <OptionRow label="Me da igual" selected={company == null} onPress={() => set({ company: null })} />

        <AppText variant="caption" tone="muted" style={{ marginTop: Spacing.three }}>
          No cambia el CineScore: crea una puntuación «Para hoy» que resta hasta 15 puntos a lo que no encaja con tu
          plan. Vale hasta medianoche.
        </AppText>
        {plan ? (
          <Button
            label="Quitar plan"
            icon="close"
            kind="ghost"
            compact
            style={{ alignSelf: 'center' }}
            onPress={() => {
              dispatch({ type: 'clearPlan' });
              setOpen(false);
            }}
          />
        ) : null}
      </OptionsSheet>
    </>
  );
}

const FIT_COLOR: Record<PlanFit['label'], string> = {
  Encaja: TierColor.essential,
  'A medias': TierColor.good,
  'No encaja': TierColor.avoid,
};

/** "Encaja", "A medias", "No encaja" o "No apta para niños", en su color. */
export function FitTag({ fit }: { fit: PlanFit }) {
  return (
    <AppText variant="caption" style={{ fontWeight: '700', color: FIT_COLOR[fit.label] }}>
      {fit.notForKids ? 'No apta para niños' : fit.label}
    </AppText>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 52,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
  },
  buttonActive: { backgroundColor: Palette.accent },
});
