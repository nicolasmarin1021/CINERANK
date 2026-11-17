/**
 * Tráileres de YouTube (el enlace lo aporta MDBList). Archivo puro para probarlo con `node --test`.
 */

/** ID del vídeo en enlaces watch?v=, youtu.be/, embed/ o shorts/. null si no es de YouTube. */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return match ? match[1] : null;
}

/** Miniatura 16:9 del vídeo (la versión "hq" existe siempre). */
export function youtubeThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/** Búsqueda en YouTube para títulos sin tráiler conocido. */
export function trailerSearchUrl(title: string, year?: string | null): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    [title, year, 'tráiler'].filter(Boolean).join(' '),
  )}`;
}
