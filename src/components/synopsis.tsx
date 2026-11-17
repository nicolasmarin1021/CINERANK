import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { getSpanishSynopsis, peekSpanishSynopsis, type SpanishSynopsis } from '@/lib/wikipedia';

/**
 * Sinopsis en español (resumen de la Wikipedia en español). Si no hay artículo
 * en español, muestra la sinopsis original de OMDb en inglés.
 */
export function Synopsis({ imdbID, englishPlot }: { imdbID: string; englishPlot: string | null }) {
  // undefined = cargando; null = no hay artículo en español.
  const [spanish, setSpanish] = useState<SpanishSynopsis | null | undefined>(() => peekSpanishSynopsis(imdbID));
  const [failed, setFailed] = useState(false);
  const [showEnglish, setShowEnglish] = useState(false);

  useEffect(() => {
    if (spanish !== undefined) return;
    let cancelled = false;
    getSpanishSynopsis(imdbID)
      .then((s) => !cancelled && setSpanish(s))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [imdbID, spanish]);

  const loading = spanish === undefined && !failed;
  if (!loading && !spanish && !englishPlot) return null;

  return (
    <View style={{ gap: Spacing.two }}>
      <AppText variant="heading">Sinopsis</AppText>

      {loading ? (
        <View style={{ gap: Spacing.two }} accessibilityLabel="Cargando la sinopsis">
          {['100%', '94%', '70%'].map((w) => (
            <View key={w} style={[styles.skeleton, { width: w as `${number}%` }]} />
          ))}
        </View>
      ) : spanish ? (
        <>
          <AppText tone="secondary">{spanish.text}</AppText>
          <View style={styles.links}>
            <Pressable
              onPress={() => WebBrowser.openBrowserAsync(spanish.url, { controlsColor: Palette.accent })}
              accessibilityRole="link"
              hitSlop={8}>
              <AppText variant="caption" tone="accent">
                Resumen de Wikipedia en español
              </AppText>
            </Pressable>
            {englishPlot ? (
              <Pressable onPress={() => setShowEnglish((v) => !v)} accessibilityRole="button" hitSlop={8}>
                <AppText variant="caption" tone="muted">
                  {showEnglish ? 'Ocultar original en inglés' : 'Ver original en inglés'}
                </AppText>
              </Pressable>
            ) : null}
          </View>
          {showEnglish && englishPlot ? (
            <AppText variant="caption" tone="muted" style={{ fontStyle: 'italic' }}>
              {englishPlot}
            </AppText>
          ) : null}
        </>
      ) : (
        <>
          <AppText tone="secondary">{englishPlot}</AppText>
          <AppText variant="caption" tone="muted">
            {failed
              ? 'No se pudo cargar el resumen en español; esta es la sinopsis original en inglés.'
              : 'No hay resumen en español de este título; esta es la sinopsis original en inglés.'}
          </AppText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: { height: 12, borderRadius: Radius.pill, backgroundColor: Palette.surface },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.four, rowGap: Spacing.one },
});
