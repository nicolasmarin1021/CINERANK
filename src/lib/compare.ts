/**
 * Selección de títulos para «¿Cuál es mejor?»: un subconjunto de la lista
 * que el usuario quiere enfrentar a fondo. Funciones puras (probadas en tests/).
 */

/** Añade el ID si no está y lo quita si ya estaba, conservando el orden. */
export function toggleId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/** IDs guardados válidos: sin duplicados y solo de títulos que siguen en la lista. */
export function keepExisting(ids: unknown, candidates: readonly { imdbID: string }[]): string[] {
  if (!Array.isArray(ids)) return [];
  const present = new Set(candidates.map((m) => m.imdbID));
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && present.has(id)))];
}
