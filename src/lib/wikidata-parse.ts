/**
 * Funciones puras para interpretar respuestas de la API de Wikidata.
 * Sin dependencias de React Native para poder probarse con Node.
 */

export interface WikidataSearchHit {
  id: string;
  label?: string;
  description?: string;
}

export interface WikidataSearchResponse {
  search?: WikidataSearchHit[];
  error?: { code?: string; info?: string };
}

export interface WikidataClaimsResponse {
  claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]>;
  error?: { code?: string; info?: string };
}

/** Descripciones de Wikidata (en español o inglés) que indican una película o serie. */
const FILM_DESCRIPTION =
  /pel[ií]cula|film|largometraje|cortometraje|documental|telefilme|serie|miniserie|anime|television series|tv series/i;

/** Se queda con los resultados que parecen películas o series, en el orden de Wikidata. */
export function pickFilmHits(response: WikidataSearchResponse, max: number): WikidataSearchHit[] {
  return (response.search ?? []).filter((hit) => FILM_DESCRIPTION.test(hit.description ?? '')).slice(0, max);
}

/** Extrae el identificador de título de IMDb (propiedad P345, formato tt1234567). */
export function pickImdbId(response: WikidataClaimsResponse): string | null {
  for (const claim of response.claims?.P345 ?? []) {
    const value = claim.mainsnak?.datavalue?.value;
    if (typeof value === 'string' && /^tt\d+$/.test(value)) return value;
  }
  return null;
}
