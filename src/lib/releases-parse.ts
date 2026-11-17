/**
 * Estrenos para la carátula del buscador, a partir del ranking público de
 * películas de la tienda de Apple (itunes.apple.com/…/rss/topmovies/json).
 * Sin dependencias de React Native para poder probarse con Node.
 */

export interface Release {
  id: string;
  /** Título tal como lo da la tienda, sin el año entre paréntesis (sirve para buscarlo). */
  title: string;
  poster: string;
  /** Fecha de estreno en formato ISO. */
  released: string;
}

interface Label {
  label?: string;
}

interface ItunesEntry {
  'im:name'?: Label;
  'im:image'?: Label[];
  'im:releaseDate'?: Label;
  id?: Label & { attributes?: { 'im:id'?: string } };
}

const DAY = 86_400_000;

/** Pide la carátula en 400×600 en lugar de la miniatura de 115×170. */
export function largeArtwork(url: string) {
  return url.replace(/\/\d+x\d+bb\.(png|jpe?g|webp)$/i, '/400x600bb.jpg');
}

/**
 * Lee el feed y deja solo los estrenos: de los últimos `pastDays` días
 * (y preventas de los próximos `futureDays`), sin repetidos y en el orden del ranking.
 */
export function parseTopMovies(
  json: unknown,
  now: number = Date.now(),
  { pastDays = 450, futureDays = 120, max = 30 } = {},
): Release[] {
  const feed = (json as { feed?: { entry?: ItunesEntry[] | ItunesEntry } } | null)?.feed;
  const entries = Array.isArray(feed?.entry) ? feed.entry : feed?.entry ? [feed.entry] : [];
  const seen = new Set<string>();
  const out: Release[] = [];
  for (const e of entries) {
    const id = e.id?.attributes?.['im:id'] ?? e.id?.label;
    const title = e['im:name']?.label?.replace(/\s*\(\d{4}\)\s*$/, '').trim();
    const images = Array.isArray(e['im:image']) ? e['im:image'] : [];
    const image = images[images.length - 1]?.label;
    const released = e['im:releaseDate']?.label;
    if (!id || !title || !image || !released || seen.has(id)) continue;
    const time = Date.parse(released);
    if (!Number.isFinite(time) || time < now - pastDays * DAY || time > now + futureDays * DAY) continue;
    seen.add(id);
    out.push({ id, title, poster: largeArtwork(image), released });
    if (out.length >= max) break;
  }
  return out;
}
