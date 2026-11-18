/**
 * «Explorar»: el catálogo de una plataforma (TMDB) filtrado por la nota de IMDb,
 * la crítica de Rotten Tomatoes, los Óscar ganados y el año (datos de MDBList).
 * Funciones puras (sin React Native) para probarlas con `node --test`.
 */

export interface ExploreFilters {
  /** País del catálogo (ISO 3166-1, p. ej. "MX"). */
  region: string;
  /** ID de la plataforma en TMDB; null = todas. */
  provider: number | null;
  /** Solo IMDb ≥ 8. */
  imdb8: boolean;
  /** Solo crítica de RT ≥ 80 %. */
  rt80: boolean;
  /** Solo películas que ganaron al menos un Óscar. */
  oscar: boolean;
  /** Década ("2020" = 2020–2029, "1980" = antes de 1990) o null. */
  decade: string | null;
  /** Año exacto; tiene prioridad sobre la década. */
  year: number | null;
}

export const DEFAULT_EXPLORE: ExploreFilters = {
  region: 'MX',
  provider: null,
  imdb8: false,
  rt80: false,
  oscar: false,
  decade: null,
  year: null,
};

export const REGIONS: { code: string; name: string }[] = [
  { code: 'MX', name: 'México' },
  { code: 'CO', name: 'Colombia' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'PE', name: 'Perú' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'ES', name: 'España' },
  { code: 'US', name: 'Estados Unidos' },
];

export const DECADES: { value: string; label: string }[] = [
  { value: '2020', label: '2020s' },
  { value: '2010', label: '2010s' },
  { value: '2000', label: '2000s' },
  { value: '1990', label: '90s' },
  { value: '1980', label: 'Antes de 1990' },
];

/** País del catálogo a partir del idioma del teléfono ("es-CO" → "CO"); México si no se reconoce. */
export function regionFromLocale(locale: string | null | undefined): string {
  const code = locale?.match(/[-_]([A-Za-z]{2})\b/)?.[1]?.toUpperCase();
  return code && REGIONS.some((r) => r.code === code) ? code : 'MX';
}

/** Filtros guardados validados (versiones anteriores no los tenían). */
export function sanitizeExplore(raw: unknown, fallbackRegion: string): ExploreFilters {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<ExploreFilters>;
  const year = typeof r.year === 'number' && r.year >= 1900 && r.year <= 2100 ? Math.round(r.year) : null;
  return {
    region: REGIONS.some((x) => x.code === r.region) ? (r.region as string) : fallbackRegion,
    provider: typeof r.provider === 'number' && Number.isFinite(r.provider) ? r.provider : null,
    imdb8: r.imdb8 === true,
    rt80: r.rt80 === true,
    oscar: r.oscar === true,
    decade: DECADES.some((d) => d.value === r.decade) ? (r.decade as string) : null,
    year,
  };
}

/** ¿Hay algún filtro de calidad (los que se comprueban con los datos de MDBList)? */
export const hasQualityFilters = (f: ExploreFilters) => f.imdb8 || f.rt80 || f.oscar;

/**
 * Parámetros de /discover/movie de TMDB. Con filtros de calidad se ordena por
 * nota (con un mínimo de votos), para que los títulos que cumplen salgan primero.
 */
export function discoverParams(f: ExploreFilters, page: number): Record<string, string> {
  const p: Record<string, string> = {
    language: f.region === 'ES' ? 'es-ES' : 'es-MX',
    watch_region: f.region,
    include_adult: 'false',
    page: String(page),
  };
  if (f.provider != null) {
    p.with_watch_providers = String(f.provider);
    p.with_watch_monetization_types = 'flatrate';
  }
  if (hasQualityFilters(f)) {
    p.sort_by = 'vote_average.desc';
    p['vote_count.gte'] = '300';
    if (f.imdb8) p['vote_average.gte'] = '7';
    else if (f.rt80) p['vote_average.gte'] = '6.5';
  } else {
    p.sort_by = 'popularity.desc';
    p['vote_count.gte'] = '50';
  }
  if (f.year != null) {
    p.primary_release_year = String(f.year);
  } else if (f.decade) {
    const start = Number(f.decade);
    if (start <= 1980) {
      p['primary_release_date.lte'] = '1989-12-31';
    } else {
      p['primary_release_date.gte'] = `${start}-01-01`;
      p['primary_release_date.lte'] = `${start + 9}-12-31`;
    }
  }
  return p;
}

/**
 * Óscar ganados según el texto de premios de MDBList, p. ej.
 * "Won: Best Motion Picture of the Year (Oscars, 2024). Plus 3 more Oscars, 5 Oscar nominations…" → 4.
 */
export function oscarWins(awards: string | null | undefined): number {
  if (!awards) return 0;
  const first = /^\s*Won:[^.]*\(Oscars?,\s*\d{4}\)/i.test(awards) ? 1 : 0;
  const more = Number(awards.match(/Plus\s+(\d+)\s+more\s+Oscars?\b/i)?.[1] ?? 0);
  return first + (first ? more : 0);
}

/** Lo que necesitamos de cada título para filtrar (de la ficha de MDBList). */
export interface ExploreRatings {
  imdbID: string | null;
  /** IMDb 0–10. */
  imdb: number | null;
  /** Crítica de RT 0–100. */
  rt: number | null;
  /** Público de RT 0–100. */
  popcorn: number | null;
  oscars: number;
}

/** Lee una ficha de MDBList (búsqueda por ID de TMDB, individual o por lotes). */
export function parseExploreRatings(item: unknown): ExploreRatings {
  const m = (item ?? {}) as {
    ids?: { imdb?: unknown };
    imdbid?: unknown;
    ratings?: { source?: unknown; value?: unknown }[];
    awards?: unknown;
  };
  const ratings = Array.isArray(m.ratings) ? m.ratings : [];
  const value = (source: string) => {
    const r = ratings.find((x) => x?.source === source)?.value;
    return typeof r === 'number' && Number.isFinite(r) ? r : null;
  };
  const imdbID = typeof m.ids?.imdb === 'string' ? m.ids.imdb : typeof m.imdbid === 'string' ? m.imdbid : null;
  return {
    imdbID: imdbID && /^tt\d+$/.test(imdbID) ? imdbID : null,
    imdb: value('imdb'),
    rt: value('tomatoes'),
    popcorn: value('popcorn'),
    oscars: oscarWins(typeof m.awards === 'string' ? m.awards : null),
  };
}

/** ¿Cumple los filtros de calidad? (Plataforma y año ya los filtra TMDB.) */
export function matchesFilters(r: ExploreRatings, f: ExploreFilters): boolean {
  if (!r.imdbID) return false;
  if (f.imdb8 && (r.imdb == null || r.imdb < 8)) return false;
  if (f.rt80 && (r.rt == null || r.rt < 80)) return false;
  if (f.oscar && r.oscars < 1) return false;
  return true;
}
