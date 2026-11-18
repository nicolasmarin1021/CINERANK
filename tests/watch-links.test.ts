/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseWatchIds, WATCH_ID_PROPS, watchIdsQuery, watchLink } from '../src/lib/watch-links.ts';

describe('Enlaces a las plataformas', () => {
  it('abre el título exacto cuando Wikidata tiene su ID', () => {
    // IDs reales de Wikidata para Glass Onion.
    const ids = { P1874: '81458416', P9586: 'umc.cmc.5bmvm9zfkmzf0ygh56hx09sp9' };
    assert.deepEqual(watchLink('netflix', 'Glass Onion', ids), {
      url: 'https://www.netflix.com/title/81458416',
      kind: 'exact',
    });
    assert.deepEqual(watchLink('appletv', 'Glass Onion', ids), {
      url: 'https://tv.apple.com/movie/umc.cmc.5bmvm9zfkmzf0ygh56hx09sp9',
      kind: 'exact',
    });
  });

  it('sin ID busca el título dentro de la plataforma, con el texto codificado', () => {
    assert.deepEqual(watchLink('netflix', 'The Menu & más', {}), {
      url: 'https://www.netflix.com/search?q=The%20Menu%20%26%20m%C3%A1s',
      kind: 'search',
    });
    assert.equal(watchLink('max', 'Dune: Part Two', null)?.url, 'https://play.hbomax.com/search?q=Dune%3A%20Part%20Two');
  });

  it('Disney+ no tiene búsqueda pública: sin ID abre su portada', () => {
    assert.deepEqual(watchLink('disney', 'The Menu', {}), { url: 'https://www.disneyplus.com/', kind: 'home' });
    assert.equal(
      watchLink('disney', 'The Menu', { P7595: '6qKeWn5NKzDY' })?.url,
      'https://www.disneyplus.com/movies/wd/6qKeWn5NKzDY',
    );
  });

  it('usa el ID de película o el de serie según el tipo', () => {
    const ids = { P9586: 'umc.cmc.movie', P9751: 'umc.cmc.show' };
    assert.equal(watchLink('appletv', 'X', ids, 'movie')?.url, 'https://tv.apple.com/movie/umc.cmc.movie');
    assert.equal(watchLink('appletv', 'X', ids, 'series')?.url, 'https://tv.apple.com/show/umc.cmc.show');
    // Una serie sin ID de serie no usa el de película: busca.
    assert.equal(watchLink('appletv', 'X', { P9586: 'umc.cmc.movie' }, 'series')?.kind, 'search');
  });

  it('en Prime Video prefiere el ID internacional al de amazon.com', () => {
    const ids = { P14440: 'amzn1.dv.gti.abc', P8055: 'B0CB1WKHCX' };
    assert.equal(watchLink('prime', 'Barbie', ids)?.url, 'https://www.primevideo.com/detail/amzn1.dv.gti.abc');
    assert.equal(watchLink('prime', 'Barbie', { P8055: 'B0CB1WKHCX' })?.url, 'https://www.amazon.com/gp/video/detail/B0CB1WKHCX');
  });

  it('una plataforma desconocida no tiene enlace', () => {
    assert.equal(watchLink('fandango', 'X', {}), null);
  });
});

describe('IDs de plataforma desde Wikidata', () => {
  it('arma la consulta solo con IDs de IMDb válidos', () => {
    const query = watchIdsQuery('tt9764362');
    assert.ok(query?.includes('wdt:P345 "tt9764362"'));
    assert.ok(WATCH_ID_PROPS.every((p) => query?.includes(`wdt:${p}`)));
    assert.equal(watchIdsQuery('tt1" } DELETE {'), null);
  });

  it('lee la respuesta SPARQL y se queda con el primer valor de cada propiedad', () => {
    const ids = parseWatchIds({
      results: {
        bindings: [
          { p: { value: 'http://www.wikidata.org/prop/direct/P1874' }, v: { value: '80030684' } },
          { p: { value: 'http://www.wikidata.org/prop/direct/P1874' }, v: { value: '70000000' } },
          { p: { value: 'http://www.wikidata.org/prop/direct/P7595' }, v: { value: ' uzQ2ycVDi2IE ' } },
          { p: { value: 'http://www.wikidata.org/prop/direct/P9586' } },
        ],
      },
    });
    assert.deepEqual(ids, { P1874: '80030684', P7595: 'uzQ2ycVDi2IE' });
    assert.deepEqual(parseWatchIds({}), {});
  });
});
