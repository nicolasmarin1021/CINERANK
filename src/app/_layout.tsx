import { Limelight_400Regular, useFonts } from '@expo-google-fonts/limelight';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

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

/** Oculta el splash cuando los datos guardados y la tipografía del logo ya están cargados. */
function HideSplashWhenReady({ fontsReady }: { fontsReady: boolean }) {
  const { state } = useApp();
  useEffect(() => {
    if (state.hydrated && fontsReady) SplashScreen.hideAsync();
  }, [state.hydrated, fontsReady]);
  return null;
}

export default function RootLayout() {
  // Si la fuente falla, la app sigue con la tipografía del sistema.
  const [fontsLoaded, fontError] = useFonts({ Limelight_400Regular });
  return (
    <AppProvider>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <HideSplashWhenReady fontsReady={fontsLoaded || fontError != null} />
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
      </ThemeProvider>
    </AppProvider>
  );
}
