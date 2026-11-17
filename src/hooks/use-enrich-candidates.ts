import { useEffect, useRef } from 'react';

import { getMovie } from '@/lib/omdb';
import { getCommentsScore } from '@/lib/trakt';
import { useApiKeys, useApp } from '@/store/app-store';

/**
 * Con clave de MDBList, completa en segundo plano los títulos de la lista a los
 * que les falta el público de RT o las plataformas (p. ej. los añadidos antes de
 * configurar la clave o con una versión anterior de la app).
 * Cada título se intenta una vez por clave: si cambias la clave, se vuelve a intentar.
 */
export function useEnrichCandidates() {
  const { state, dispatch } = useApp();
  const { omdb, mdblist } = useApiKeys();
  const { candidates, traktKey } = state;
  const attempted = useRef({ key: '', ids: new Set<string>() });
  const commentsAttempted = useRef({ key: '', ids: new Set<string>() });

  useEffect(() => {
    if (!mdblist || !omdb) return;
    if (attempted.current.key !== mdblist) attempted.current = { key: mdblist, ids: new Set() };
    const tried = attempted.current.ids;
    const pending = candidates.filter((m) => !m.audienceChecked && !tried.has(m.imdbID));
    if (pending.length === 0) return;
    pending.forEach((m) => tried.add(m.imdbID));
    Promise.allSettled(pending.map((m) => getMovie({ omdb, mdblist }, m.imdbID))).then((results) => {
      const fresh = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
      if (fresh.length > 0) dispatch({ type: 'replaceCandidates', movies: fresh });
    });
  }, [candidates, omdb, mdblist, dispatch]);

  // Con Client ID de Trakt, trae la nota de quienes comentan (solo para los títulos de tu lista).
  useEffect(() => {
    if (!traktKey) return;
    if (commentsAttempted.current.key !== traktKey) commentsAttempted.current = { key: traktKey, ids: new Set() };
    const tried = commentsAttempted.current.ids;
    const pending = candidates.filter((m) => !m.commentsChecked && !tried.has(m.imdbID));
    for (const m of pending) {
      tried.add(m.imdbID);
      getCommentsScore(traktKey, m.imdbID, m.type)
        .then((r) => dispatch({ type: 'setComments', imdbID: m.imdbID, comments: r.score, count: r.rated }))
        .catch(() => {
          // Sin conexión o clave inválida: se reintenta al cambiar la clave o al volver a abrir la app.
        });
    }
  }, [candidates, traktKey, dispatch]);
}
