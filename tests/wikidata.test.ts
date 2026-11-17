/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pickFilmHits, pickImdbId } from '../src/lib/wikidata-parse.ts';

describe('traducción de títulos con Wikidata', () => {
  it('se queda solo con películas y series', () => {
    const hits = pickFilmHits(
      {
        search: [
          { id: 'Q1', label: 'Del revés', description: 'película de animación de 2015' },
          { id: 'Q2', label: 'Intensamente', description: 'álbum musical' },
          { id: 'Q3', label: 'Otra', description: 'serie de televisión de 2020' },
          { id: 'Q4', label: 'Sin descripción' },
          { id: 'Q5', label: 'Docu', description: 'documental de 2019' },
        ],
      },
      2,
    );
    assert.deepEqual(
      hits.map((h) => h.id),
      ['Q1', 'Q3'],
    );
  });

  it('tolera respuestas vacías o con error', () => {
    assert.deepEqual(pickFilmHits({}, 4), []);
    assert.deepEqual(pickFilmHits({ error: { code: 'x' } }, 4), []);
    assert.equal(pickImdbId({}), null);
  });

  it('extrae el ID de título de IMDb e ignora IDs de personas', () => {
    assert.equal(
      pickImdbId({
        claims: {
          P345: [
            { mainsnak: { datavalue: { value: 'nm0000001' } } },
            { mainsnak: { datavalue: { value: 'tt2096673' } } },
          ],
        },
      }),
      'tt2096673',
    );
    assert.equal(pickImdbId({ claims: { P345: [{ mainsnak: {} }] } }), null);
  });
});
