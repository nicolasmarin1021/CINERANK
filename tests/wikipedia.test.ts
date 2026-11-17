/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseEntityId, parseSpanishTitle, parseSummary, summaryPath } from '../src/lib/wikipedia-parse.ts';

describe('Sinopsis en español (Wikipedia)', () => {
  it('encuentra el elemento de Wikidata y el artículo en español', () => {
    assert.equal(parseEntityId({ query: { search: [{ title: 'Q6144664' }] } }), 'Q6144664');
    assert.equal(parseEntityId({ query: { search: [] } }), null);
    const entities = { entities: { Q6144664: { sitelinks: { eswiki: { title: 'Inside Out (película de 2015)' } } } } };
    assert.equal(parseSpanishTitle(entities, 'Q6144664'), 'Inside Out (película de 2015)');
    assert.equal(parseSpanishTitle({ entities: { Q1: { sitelinks: {} } } }, 'Q1'), null);
  });

  it('arma la ruta del resumen con el título codificado', () => {
    assert.equal(
      summaryPath('Inside Out (película de 2015)'),
      '/api/rest_v1/page/summary/Inside_Out_(pel%C3%ADcula_de_2015)',
    );
  });

  it('lee el resumen y descarta desambiguaciones o textos vacíos', () => {
    const extract = 'Inside Out es una película de animación estadounidense producida por Pixar Animation Studios.';
    const ok = parseSummary({
      type: 'standard',
      title: 'Inside Out (película de 2015)',
      extract,
      content_urls: { mobile: { page: 'https://es.m.wikipedia.org/wiki/Inside_Out' } },
    });
    assert.equal(ok?.text, extract);
    assert.equal(ok?.url, 'https://es.m.wikipedia.org/wiki/Inside_Out');
    assert.equal(parseSummary({ type: 'disambiguation', extract, content_urls: { mobile: { page: 'x' } } }), null);
    assert.equal(parseSummary({ type: 'standard', extract: 'Corto', content_urls: { mobile: { page: 'x' } } }), null);
  });
});
