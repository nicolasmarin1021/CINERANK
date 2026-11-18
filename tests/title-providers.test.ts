/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { otherPlatforms, platformsFor } from '../src/lib/platforms.ts';
import { parseFindResult, parseTitleProviders } from '../src/lib/tmdb-parse.ts';

// Forma de /movie/{id}/watch/providers de TMDB (datos de JustWatch).
const RESPONSE = {
  id: 593643,
  results: {
    CO: {
      link: 'https://www.themoviedb.org/movie/593643-the-menu/watch?locale=CO',
      flatrate: [
        { provider_id: 167, provider_name: 'Claro video', logo_path: '/claro.jpg', display_priority: 9 },
        { provider_id: 337, provider_name: 'Disney Plus', logo_path: '/disney.jpg', display_priority: 1 },
        { provider_id: 1853, provider_name: 'Paramount Plus Apple TV Channel ', display_priority: 20 },
      ],
      rent: [{ provider_id: 2, provider_name: 'Apple TV', logo_path: '/apple.jpg', display_priority: 4 }],
      buy: [
        { provider_id: 2, provider_name: 'Apple TV', logo_path: '/apple.jpg', display_priority: 4 },
        { provider_id: 3, provider_name: 'Google Play Movies', logo_path: '/gp.jpg', display_priority: 5 },
      ],
    },
    US: { link: 'https://example.org', flatrate: [{ provider_id: 8, provider_name: 'Netflix' }] },
  },
};

describe('Plataformas del país (TMDB)', () => {
  it('encuentra el ID de TMDB a partir del de IMDb, según sea película o serie', () => {
    const found = { movie_results: [{ id: 593643 }], tv_results: [{ id: 1396 }] };
    assert.deepEqual(parseFindResult(found, 'movie'), { id: 593643, media: 'movie' });
    assert.deepEqual(parseFindResult(found, 'series'), { id: 1396, media: 'tv' });
    assert.deepEqual(parseFindResult({ movie_results: [], tv_results: [{ id: 1396 }] }, 'movie'), { id: 1396, media: 'tv' });
    assert.equal(parseFindResult({ movie_results: [] }, 'movie'), null);
  });

  it('lee las del país pedido: suscripción primero, en el orden de JustWatch y sin repetir', () => {
    const { providers, link } = parseTitleProviders(RESPONSE, 'CO');
    assert.equal(link, 'https://www.themoviedb.org/movie/593643-the-menu/watch?locale=CO');
    assert.deepEqual(
      providers.map((p) => `${p.name}:${p.category}`),
      ['Disney Plus:stream', 'Claro video:stream', 'Paramount Plus Apple TV Channel:stream', 'Apple TV:rent', 'Google Play Movies:rent'],
    );
  });

  it('un país sin datos no tiene plataformas', () => {
    assert.deepEqual(parseTitleProviders(RESPONSE, 'AR'), { providers: [], link: null });
    assert.deepEqual(parseTitleProviders(null, 'CO'), { providers: [], link: null });
  });

  it('las conocidas llevan insignia; las demás se nombran aparte (sin canales)', () => {
    const { providers } = parseTitleProviders(RESPONSE, 'CO');
    const stream = providers.filter((p) => p.category === 'stream');
    assert.deepEqual(
      platformsFor(stream).items.map((p) => p.key),
      ['disney'],
    );
    assert.deepEqual(otherPlatforms(stream), ['Claro video']);
    assert.deepEqual(otherPlatforms([{ id: 1796, name: 'Netflix Standard with Ads' }, { id: 9999, name: 'Mercado Play' }]), [
      'Mercado Play',
    ]);
  });
});
