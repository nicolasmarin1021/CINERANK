import { useEffect, useRef } from 'react';

import { getMovie } from '@/lib/omdb';
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
  const { candidates } = state;
  const attempted = useRef({ key: '', ids: new Set<string>() });

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
}
