/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { largeArtwork, parseTopMovies } from '../src/lib/releases-parse.ts';

const NOW = Date.parse('2026-11-17T00:00:00Z');

function entry(id: string, name: string, released: string) {
  return {
    id: { label: `https://itunes.apple.com/movie/${id}`, attributes: { 'im:id': id } },
    'im:name': { label: name },
    'im:image': [{ label: 'https://x.mzstatic.com/a/60x60bb.png' }, { label: 'https://x.mzstatic.com/a/115x170bb.png' }],
    'im:releaseDate': { label: released },
  };
}

describe('Estrenos (feed de la tienda de Apple)', () => {
  it('pide la carátula grande', () => {
    assert.equal(largeArtwork('https://x.mzstatic.com/a/115x170bb.png'), 'https://x.mzstatic.com/a/400x600bb.jpg');
    assert.equal(largeArtwork('https://x/otra.jpg'), 'https://x/otra.jpg');
  });

  it('deja solo estrenos recientes, sin repetidos y sin el año en el título', () => {
    const feed = {
      feed: {
        entry: [
          entry('1', 'The Odyssey (2026)', '2026-07-17T00:00:00-07:00'),
          entry('2', 'Los juegos del hambre: En llamas', '2013-11-22T00:00:00-07:00'),
          entry('1', 'The Odyssey (2026)', '2026-07-17T00:00:00-07:00'),
          entry('3', 'Preventa lejana', '2027-12-01T00:00:00-07:00'),
          entry('4', 'Coyote vs. Acme', '2026-10-29T00:00:00-07:00'),
        ],
      },
    };
    const releases = parseTopMovies(feed, NOW);
    assert.deepEqual(
      releases.map((r) => r.title),
      ['The Odyssey', 'Coyote vs. Acme'],
    );
    assert.equal(releases[0].poster, 'https://x.mzstatic.com/a/400x600bb.jpg');
  });

  it('tolera respuestas vacías o con una sola entrada', () => {
    assert.deepEqual(parseTopMovies(null, NOW), []);
    assert.deepEqual(parseTopMovies({ feed: {} }, NOW), []);
    assert.equal(parseTopMovies({ feed: { entry: entry('9', 'Sola', '2026-11-01T00:00:00Z') } }, NOW).length, 1);
  });
});
