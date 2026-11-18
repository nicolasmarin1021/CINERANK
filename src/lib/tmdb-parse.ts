/**
 * Respuestas de TMDB (https://www.themoviedb.org): catálogo por plataforma y país,
 * y la lista de plataformas de cada país (datos de JustWatch). Sin dependencias de React Native.
 */

export interface TmdbMovie {
  tmdbId: number;
  /** Título en el idioma pedido (español), o el original si no hay traducción. */
  title: string;
  year: string;
  /** Ruta del póster en TMDB ("/abc.jpg"); se completa con tmdbImage(). */
  posterPath: string | null;
  overview: string;
  voteAverage: number | null;
}

export interface TmdbPage {
  results: TmdbMovie[];
  page: number;
  totalPages: number;
  totalResults: number;
}

export interface StreamingProvider {
  id: number;
  name: string;
  /** Ruta del logo en TMDB. */
  logoPath: string | null;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function parseDiscover(json: unknown): TmdbPage {
  const d = (json ?? {}) as { results?: unknown; page?: unknown; total_pages?: unknown; total_results?: unknown };
  const results = (Array.isArray(d.results) ? d.results : [])
    .map((r: Record<string, unknown>): TmdbMovie | null => {
      const id = num(r?.id);
      const title = str(r?.title) || str(r?.original_title);
      if (id == null || !title) return null;
      return {
        tmdbId: id,
        title,
        year: str(r.release_date).slice(0, 4),
        posterPath: str(r.poster_path) || null,
        overview: str(r.overview),
        voteAverage: num(r.vote_average),
      };
    })
    .filter((m): m is TmdbMovie => m != null);
  return {
    results,
    page: num(d.page) ?? 1,
    totalPages: num(d.total_pages) ?? 1,
    totalResults: num(d.total_results) ?? results.length,
  };
}

/** Plataformas de un país, ordenadas por la importancia que les da JustWatch en ese país. */
export function parseProviders(json: unknown, region: string, max = 16): StreamingProvider[] {
  const d = (json ?? {}) as { results?: unknown };
  const list = Array.isArray(d.results) ? (d.results as Record<string, unknown>[]) : [];
  const priority = (p: Record<string, unknown>) => {
    const byRegion = (p.display_priorities as Record<string, unknown> | undefined)?.[region];
    return num(byRegion) ?? num(p.display_priority) ?? 999;
  };
  const seen = new Set<string>();
  return list
    .filter((p) => num(p.provider_id) != null && str(p.provider_name))
    .sort((a, b) => priority(a) - priority(b))
    .filter((p) => {
      // TMDB repite servicios con canales ("Netflix basic with Ads", "Paramount+ Amazon Channel").
      const name = str(p.provider_name);
      const base = name.replace(/\s+(basic\s+)?with\s+ads$/i, '').toLowerCase();
      if (/channel/i.test(name) || seen.has(base)) return false;
      seen.add(base);
      return true;
    })
    .slice(0, max)
    .map((p) => ({ id: num(p.provider_id)!, name: str(p.provider_name), logoPath: str(p.logo_path) || null }));
}

/** `/find/{imdb}?external_source=imdb_id` → ID de TMDB y si es película o serie. */
export function parseFindResult(
  json: unknown,
  type: 'movie' | 'series',
): { id: number; media: 'movie' | 'tv' } | null {
  const d = (json ?? {}) as { movie_results?: unknown; tv_results?: unknown };
  const first = (v: unknown) => (Array.isArray(v) ? num((v[0] as Record<string, unknown> | undefined)?.id) : null);
  const movie = first(d.movie_results);
  const tv = first(d.tv_results);
  const asMovie = movie != null ? { id: movie, media: 'movie' as const } : null;
  const asTv = tv != null ? { id: tv, media: 'tv' as const } : null;
  return type === 'series' ? (asTv ?? asMovie) : (asMovie ?? asTv);
}

export interface TitleProvider {
  id: number;
  name: string;
  logoPath: string | null;
  /** Suscripción, gratis o con anuncios ('stream'); alquiler o compra ('rent'). */
  category: 'stream' | 'rent';
}

export interface TitleProviders {
  providers: TitleProvider[];
  /** Página de TMDB con todas las opciones del país (con enlaces de JustWatch). */
  link: string | null;
}

const TITLE_GROUPS = [
  ['flatrate', 'stream'],
  ['free', 'stream'],
  ['ads', 'stream'],
  ['rent', 'rent'],
  ['buy', 'rent'],
] as const;

/**
 * `/movie/{id}/watch/providers` → plataformas del título en un país (datos de JustWatch),
 * primero las de suscripción y dentro de cada grupo en el orden de JustWatch.
 */
export function parseTitleProviders(json: unknown, region: string): TitleProviders {
  const results = ((json ?? {}) as { results?: unknown }).results as Record<string, unknown> | undefined;
  const country = results?.[region] as Record<string, unknown> | undefined;
  if (!country || typeof country !== 'object') return { providers: [], link: null };
  const seen = new Set<number>();
  const providers: TitleProvider[] = [];
  for (const [field, category] of TITLE_GROUPS) {
    const list = Array.isArray(country[field]) ? (country[field] as Record<string, unknown>[]) : [];
    const sorted = [...list].sort((a, b) => (num(a.display_priority) ?? 999) - (num(b.display_priority) ?? 999));
    for (const p of sorted) {
      const id = num(p.provider_id);
      const name = str(p.provider_name).trim();
      if (id == null || !name || seen.has(id)) continue;
      seen.add(id);
      providers.push({ id, name, logoPath: str(p.logo_path) || null, category });
    }
  }
  return { providers, link: str(country.link) || null };
}

/** URL completa de una imagen de TMDB (pósters: w342; logos: w92). */
export function tmdbImage(path: string | null, size: 'w92' | 'w185' | 'w342' | 'w500' = 'w342'): string | null {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}
