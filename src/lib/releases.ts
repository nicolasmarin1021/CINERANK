/**
 * Estrenos recientes (tienda de Apple, México: títulos en español).
 * Público y sin clave. Se guardan 12 horas para que la carátula aparezca al instante.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseTopMovies, type Release } from './releases-parse';

export type { Release } from './releases-parse';

const FEED_URL = 'https://itunes.apple.com/mx/rss/topmovies/limit=50/json';
const CACHE_KEY = 'cinerank:releases:v1';
const TTL_MS = 12 * 60 * 60 * 1000;
const TIMEOUT_MS = 8_000;

let memory: { fetchedAt: number; items: Release[] } | null = null;

/** Lo que ya está en memoria (para pintar sin esperar). */
export function peekReleases(): Release[] {
  return memory?.items ?? [];
}

async function readStored() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as { fetchedAt: number; items: Release[] }) : null;
  } catch {
    return null;
  }
}

/** Devuelve los estrenos; si no hay conexión, los últimos guardados (o una lista vacía). */
export async function loadReleases(): Promise<Release[]> {
  if (memory && Date.now() - memory.fetchedAt < TTL_MS) return memory.items;
  const stored = memory ?? (await readStored());
  if (stored && Date.now() - stored.fetchedAt < TTL_MS && stored.items.length > 0) {
    memory = stored;
    return stored.items;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(FEED_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = parseTopMovies(await res.json());
    if (items.length === 0) throw new Error('Sin estrenos');
    memory = { fetchedAt: Date.now(), items };
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(memory)).catch(() => {});
    return items;
  } catch {
    return stored?.items ?? [];
  } finally {
    clearTimeout(timer);
  }
}
