/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseCommentsScore, traktErrorKind, translateTraktError } from '../src/lib/trakt-parse.ts';

const comment = (rating: number | null, likes = 0, extra: Record<string, unknown> = {}) => ({
  id: Math.random(),
  parent_id: 0,
  comment: 'texto',
  spoiler: false,
  review: false,
  likes,
  replies: 0,
  user_stats: { rating, play_count: 1, completed_count: 1 },
  ...extra,
});

describe('Comentarios de Trakt (nivel gratis)', () => {
  it('promedia la nota de quienes comentan, ponderada por «me gusta»', () => {
    // Sin «me gusta», media simple: (10 + 8 + 6) / 3 = 8 → 80.
    assert.equal(parseCommentsScore([comment(10), comment(8), comment(6)]).score, 80);
    // El comentario con muchos «me gusta» pesa más, sin aplastar al resto.
    const r = parseCommentsScore([comment(10, 255), comment(6), comment(6)]);
    assert.ok(r.score! > 80 && r.score! < 100);
    assert.equal(r.rated, 3);
  });

  it('ignora respuestas, notas inválidas y comentarios sin nota', () => {
    const r = parseCommentsScore([
      comment(9),
      comment(9),
      comment(9),
      comment(1, 0, { parent_id: 123 }),
      comment(null),
      comment(42),
    ]);
    assert.equal(r.score, 90);
    assert.equal(r.rated, 3);
    assert.equal(r.total, 5);
  });

  it('acepta la nota en user_rating si user_stats no viene', () => {
    const items = [7, 8, 9].map((n) => ({ comment: 'x', likes: 0, user_rating: n }));
    assert.equal(parseCommentsScore(items).score, 80);
  });

  it('con menos de 3 comentarios con nota no da número', () => {
    const r = parseCommentsScore([comment(10), comment(9), comment(null)]);
    assert.equal(r.score, null);
    assert.equal(r.rated, 2);
    assert.deepEqual(parseCommentsScore(null), { score: null, rated: 0, total: 0, fields: [] });
  });

  it('guarda los campos recibidos para diagnosticar', () => {
    assert.ok(parseCommentsScore([comment(8)]).fields.includes('user_stats'));
  });

  it('clasifica y traduce errores', () => {
    assert.equal(traktErrorKind(403), 'auth');
    assert.equal(traktErrorKind(429), 'limit');
    assert.equal(traktErrorKind(404), 'not-found');
    assert.match(translateTraktError('auth'), /Client ID/);
  });
});
