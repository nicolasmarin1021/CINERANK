/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseTrailer } from '../src/lib/mdblist-parse.ts';
import { trailerSearchUrl, youtubeId, youtubeThumbnail, youtubeWatchUrl } from '../src/lib/trailer.ts';

describe('Tráileres', () => {
  it('saca el ID de los distintos enlaces de YouTube', () => {
    assert.equal(youtubeId('https://www.youtube.com/watch?v=U2Qp5pL3ovA'), 'U2Qp5pL3ovA');
    assert.equal(youtubeId('https://www.youtube.com/watch?feature=share&v=1HFv47QHWJU'), '1HFv47QHWJU');
    assert.equal(youtubeId('https://youtu.be/1HFv47QHWJU?t=10'), '1HFv47QHWJU');
    assert.equal(youtubeId('https://www.youtube.com/embed/U2Qp5pL3ovA'), 'U2Qp5pL3ovA');
    assert.equal(youtubeId('https://vimeo.com/123'), null);
    assert.equal(youtubeId(null), null);
  });

  it('arma la miniatura, el enlace y la búsqueda', () => {
    assert.equal(youtubeThumbnail('U2Qp5pL3ovA'), 'https://i.ytimg.com/vi/U2Qp5pL3ovA/hqdefault.jpg');
    assert.equal(youtubeWatchUrl('U2Qp5pL3ovA'), 'https://www.youtube.com/watch?v=U2Qp5pL3ovA');
    assert.equal(
      trailerSearchUrl('Dune: Part Two', '2024'),
      'https://www.youtube.com/results?search_query=Dune%3A%20Part%20Two%202024%20tr%C3%A1iler',
    );
  });

  it('lee el tráiler de la respuesta de MDBList', () => {
    assert.equal(parseTrailer({ trailer: 'https://www.youtube.com/watch?v=U2Qp5pL3ovA' }), 'https://www.youtube.com/watch?v=U2Qp5pL3ovA');
    assert.equal(parseTrailer({ trailer: null }), null);
    assert.equal(parseTrailer({ trailer: 'no es un enlace' }), null);
    assert.equal(parseTrailer({}), null);
  });
});
