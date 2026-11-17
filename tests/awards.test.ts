/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { awardsShort, awardsStrength, describeAwards, parseAwards } from '../src/lib/awards.ts';
import { scoreMovie } from '../src/lib/ranking.ts';
import type { Movie, RankingSettings } from '../src/lib/types.ts';

function movie(awards: string | null, imdb = 8.0, rt: number | null = 80): Movie {
  return {
    imdbID: 'tt1',
    title: 'Prueba',
    year: '2024',
    type: 'movie',
    poster: null,
    rated: null,
    released: null,
    runtimeMin: 120,
    genres: [],
    director: null,
    actors: null,
    plot: null,
    country: null,
    language: null,
    awards,
    ratings: { imdb, imdbVotes: 500_000, rt, popcorn: null },
    audienceChecked: true,
    providers: [],
    fetchedAt: 0,
  };
}

const settings = (awardsBonus: number): RankingSettings => ({
  weights: { imdb: 50, rt: 50, popcorn: 0 },
  voteConfidence: false,
  minVotes: 10_000,
  awardsBonus,
});

describe('Premios (campo Awards de OMDb)', () => {
  it('lee el premio principal y los totales', () => {
    assert.deepEqual(parseAwards('Won 2 Oscars. 126 wins & 375 nominations total'), {
      headline: { kind: 'oscar', won: 2, nominated: 0 },
      wins: 126,
      nominations: 375,
    });
    assert.deepEqual(parseAwards('Nominated for 1 Oscar. 4 wins & 20 nominations'), {
      headline: { kind: 'oscar', won: 0, nominated: 1 },
      wins: 4,
      nominations: 20,
    });
    assert.equal(parseAwards('Won 3 Primetime Emmys. 50 wins & 90 nominations total')?.headline?.kind, 'emmy');
    assert.equal(parseAwards('Nominated for 2 BAFTA Awards. 10 wins & 30 nominations total')?.headline?.kind, 'bafta');
    assert.equal(parseAwards('Won 1 Golden Globe. 5 wins & 9 nominations total')?.headline?.kind, 'globe');
    assert.deepEqual(parseAwards('1 win & 1 nomination'), { headline: null, wins: 1, nominations: 1 });
  });

  it('sin premios devuelve null', () => {
    assert.equal(parseAwards(null), null);
    assert.equal(parseAwards('N/A'), null);
    assert.equal(parseAwards(''), null);
  });

  it('un Óscar pesa más que muchos premios menores y la escala no pasa de 1', () => {
    const oscars = awardsStrength(parseAwards('Won 2 Oscars. 126 wins & 375 nominations total'));
    const nominated = awardsStrength(parseAwards('Nominated for 1 Oscar. 4 wins & 20 nominations'));
    const minor = awardsStrength(parseAwards('3 wins & 5 nominations'));
    assert.ok(oscars > nominated && nominated > minor && minor > 0);
    assert.ok(awardsStrength(parseAwards('Won 11 Oscars. 215 wins & 124 nominations total')) < 1);
    assert.equal(awardsStrength(null), 0);
  });

  it('lo describe en español', () => {
    const info = parseAwards('Won 2 Oscars. 126 wins & 375 nominations total');
    assert.equal(describeAwards(info), 'Ganó 2 Óscar · 126 premios y 375 nominaciones');
    assert.equal(awardsShort(info), '2 Óscar');
    assert.equal(awardsShort(parseAwards('Nominated for 1 Golden Globe. 1 win & 3 nominations')), '1 nom. Globo de Oro');
    assert.equal(describeAwards(parseAwards('1 win & 1 nomination')), '1 premio y 1 nominación');
  });
});

describe('Bonus por premios en el CineScore', () => {
  it('suma puntos a los premiados y nunca resta', () => {
    const premiada = scoreMovie(movie('Won 2 Oscars. 126 wins & 375 nominations total'), settings(6));
    assert.equal(premiada.baseScore, 80);
    assert.ok(premiada.awardsBonus > 4.5 && premiada.awardsBonus <= 6);
    assert.equal(premiada.score, Math.round((80 + premiada.awardsBonus) * 10) / 10);

    const sinPremios = scoreMovie(movie(null), settings(6));
    assert.equal(sinPremios.awardsBonus, 0);
    assert.equal(sinPremios.score, 80);
  });

  it('con el bonus desactivado no cambia nada', () => {
    const r = scoreMovie(movie('Won 4 Oscars. 159 wins & 220 nominations total'), settings(0));
    assert.equal(r.awardsBonus, 0);
    assert.equal(r.score, r.baseScore);
  });

  it('el CineScore no pasa de 100', () => {
    const r = scoreMovie(movie('Won 11 Oscars. 215 wins & 124 nominations total', 10, 100), settings(10));
    assert.equal(r.score, 100);
  });
});
