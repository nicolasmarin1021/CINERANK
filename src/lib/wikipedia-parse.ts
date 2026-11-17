/**
 * Sinopsis en español desde Wikipedia: IMDb ID → elemento de Wikidata →
 * artículo de la Wikipedia en español → resumen. Funciones puras (sin React Native).
 */

export interface SpanishSynopsis {
  /** Resumen del artículo (texto plano). */
  text: string;
  /** Enlace al artículo, para la atribución que pide la licencia de Wikipedia. */
  url: string;
  /** Título del artículo. */
  title: string;
}

interface SearchResponse {
  query?: { search?: { title?: unknown }[] };
}

interface EntitiesResponse {
  entities?: Record<string, { sitelinks?: { eswiki?: { title?: unknown } } }>;
}

interface SummaryResponse {
  type?: unknown;
  title?: unknown;
  extract?: unknown;
  content_urls?: { mobile?: { page?: unknown }; desktop?: { page?: unknown } };
}

/** Q-id de Wikidata del primer resultado de `haswbstatement:P345=tt…`. */
export function parseEntityId(response: SearchResponse): string | null {
  const title = response.query?.search?.[0]?.title;
  return typeof title === 'string' && /^Q\d+$/.test(title) ? title : null;
}

/** Título del artículo en la Wikipedia en español, o null si no existe. */
export function parseSpanishTitle(response: EntitiesResponse, entityId: string): string | null {
  const title = response.entities?.[entityId]?.sitelinks?.eswiki?.title;
  return typeof title === 'string' && title.trim() ? title : null;
}

/** Resumen del artículo; null si es una página de desambiguación o viene vacío. */
export function parseSummary(response: SummaryResponse): SpanishSynopsis | null {
  if (response.type === 'disambiguation') return null;
  const text = typeof response.extract === 'string' ? response.extract.trim() : '';
  const url = response.content_urls?.mobile?.page ?? response.content_urls?.desktop?.page;
  if (text.length < 40 || typeof url !== 'string') return null;
  return { text, url, title: typeof response.title === 'string' ? response.title : '' };
}

/** Ruta de la API REST de resumen para un título ("Inside Out (película de 2015)"). */
export function summaryPath(title: string): string {
  return `/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}
