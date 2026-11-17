/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { keepExisting, toggleId } from '../src/lib/compare.ts';

describe('Selección para «¿Cuál es mejor?»', () => {
  it('añade y quita un título conservando el orden', () => {
    assert.deepEqual(toggleId(['a', 'b'], 'c'), ['a', 'b', 'c']);
    assert.deepEqual(toggleId(['a', 'b', 'c'], 'b'), ['a', 'c']);
  });

  it('al cargar, descarta IDs repetidos, inválidos o de títulos que ya no están en la lista', () => {
    const candidates = [{ imdbID: 'tt1' }, { imdbID: 'tt2' }];
    assert.deepEqual(keepExisting(['tt2', 'tt9', 'tt2', 42, 'tt1'], candidates), ['tt2', 'tt1']);
    assert.deepEqual(keepExisting(undefined, candidates), []);
    assert.deepEqual(keepExisting('tt1', candidates), []);
  });
});
