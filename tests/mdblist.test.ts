/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  mdblistErrorKind,
  parseBatchRating,
  parseRottenScores,
  parseWatchProviders,
  translateMdblistError,
} from '../src/lib/mdblist-parse.ts';

describe('MDBList: puntajes de Rotten Tomatoes', () => {
  it('lee crítica (tomatoes) y público (popcorn)', () => {
    const scores = parseRottenScores({
      ratings: [
        { source: 'imdb', value: 8.1, score: 81, votes: 900000 },
        { source: 'tomatoes', value: 98, score: 98 },
        { source: 'popcorn', value: 89, score: 89, votes: 25000 },
        { source: 'metacritic', value: 94, score: 94 },
      ],
    });
    assert.equal(scores.popcorn, 89);
    assert.equal(scores.tomatoes, 98);
    assert.deepEqual(scores.sources, ['imdb=8.1', 'tomatoes=98', 'popcorn=89', 'metacritic=94']);
  });

  it('acepta el nombre "audience" y variantes con mayúsculas o guiones', () => {
    assert.equal(parseRottenScores({ ratings: [{ source: 'audience', value: 77 }] }).popcorn, 77);
    assert.equal(parseRottenScores({ ratings: [{ source: 'RT_Audience', score: 66 }] }).popcorn, 66);
    assert.equal(parseRottenScores({ ratings: [{ source: 'Tomatometer', value: '91%' }] }).tomatoes, 91);
  });

  it('usa score si value falta y salta entradas vacías', () => {
    const scores = parseRottenScores({
      ratings: [
        { source: 'popcorn', value: null, score: null },
        { source: 'audience', value: null, score: 72 },
      ],
    });
    assert.equal(scores.popcorn, 72);
  });

  it('ignora valores fuera de rango o respuestas sin calificaciones', () => {
    assert.deepEqual(parseRottenScores({}), { popcorn: null, tomatoes: null, sources: [] });
    assert.equal(parseRottenScores({ ratings: [{ source: 'popcorn', value: 140 }] }).popcorn, null);
  });

  it('lee el endpoint por lotes de forma tolerante', () => {
    assert.equal(parseBatchRating({ ratings: [{ id: 'tt0111161', rating: 98 }] }, 'tt0111161'), 98);
    assert.equal(parseBatchRating({ ratings: [{ id: 'tt9999999', rating: 50 }] }, 'tt0111161'), null);
    assert.equal(parseBatchRating({ ratings: [{ rating: 88 }] }, 'tt0111161'), 88);
    assert.equal(parseBatchRating({}, 'tt0111161'), null);
  });

  it('lee las plataformas sin duplicados y descarta entradas inválidas', () => {
    const providers = parseWatchProviders({
      watch_providers: [
        { id: 8, name: 'Netflix' },
        { id: 8, name: 'Netflix' },
        { id: '9', name: 'Prime Video' },
        { id: 1899, name: ' HBO Max ' },
        { name: 'Sin id' },
      ],
    });
    assert.deepEqual(providers, [
      { id: 8, name: 'Netflix' },
      { id: 1899, name: 'HBO Max' },
    ]);
    assert.deepEqual(parseWatchProviders({}), []);
  });

  it('clasifica y traduce errores HTTP', () => {
    assert.equal(mdblistErrorKind(401), 'auth');
    assert.equal(mdblistErrorKind(429), 'limit');
    assert.equal(mdblistErrorKind(404), 'not-found');
    assert.match(translateMdblistError('auth'), /clave/);
    assert.match(translateMdblistError('limit'), /límite/);
  });
});
