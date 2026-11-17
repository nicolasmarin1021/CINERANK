import { NativeTabs } from 'expo-router/native-tabs';

import { Palette } from '@/constants/theme';
import { useApp } from '@/store/app-store';

/** Barra de pestañas nativa (iOS y Android). La versión web está en app-tabs.web.tsx. */
export default function AppTabs() {
  const { state } = useApp();
  const count = state.candidates.length;

  return (
    <NativeTabs
      backgroundColor={Palette.background}
      indicatorColor={Palette.accentSoft}
      tintColor={Palette.accent}
      badgeBackgroundColor={Palette.accent}
      badgeTextColor={Palette.onLight}
      iconColor={{ default: Palette.textMuted, selected: Palette.accent }}
      labelStyle={{ default: { color: Palette.textMuted }, selected: { color: Palette.accent } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Buscar</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="ranking">
        <NativeTabs.Trigger.Label>Ranking</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'trophy', selected: 'trophy.fill' }} md="trophy" />
        {count > 0 ? <NativeTabs.Trigger.Badge>{String(count)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="compare">
        <NativeTabs.Trigger.Label>¿Cuál es mejor?</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'scalemass', selected: 'scalemass.fill' }} md="balance" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Ajustes</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'slider.horizontal.3', selected: 'slider.horizontal.3' }} md="tune" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
