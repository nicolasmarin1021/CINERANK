import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { ViewportFix } from '@/components/viewport-fix';
import { Palette } from '@/constants/theme';
import { AppProvider, useApp } from '@/store/app-store';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Palette.accent,
    background: Palette.background,
    card: Palette.background,
    text: Palette.text,
    border: Palette.border,
  },
};

/** Oculta el splash cuando los datos guardados ya están cargados. */
function HideSplashWhenReady() {
  const { state } = useApp();
  useEffect(() => {
    if (state.hydrated) SplashScreen.hideAsync();
  }, [state.hydrated]);
  return null;
}

export default function RootLayout() {
  return (
    <AppProvider>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <HideSplashWhenReady />
        {/* En la app de inicio del iPhone, que ocupe toda la pantalla (ver viewport-fix.web.tsx). */}
        <ViewportFix>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: Palette.background },
              headerTintColor: Palette.text,
              headerShadowVisible: false,
              contentStyle: { backgroundColor: Palette.background },
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="movie/[id]" options={{ title: 'Ficha', headerBackTitle: 'Volver' }} />
            <Stack.Screen name="settings" options={{ title: 'Ajustes', headerBackTitle: 'Volver' }} />
          </Stack>
        </ViewportFix>
      </ThemeProvider>
    </AppProvider>
  );
}
