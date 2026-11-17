/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  parseImdbRating,
  parseMovie,
  parsePercent,
  parseRuntime,
  parseVotes,
  translateOmdbError,
  upgradeMovie,
  type OmdbMovieResponse,
} from '../src/lib/omdb-parse.ts';
import {
  bayesianAverage,
  bestIndexes,
  consensusFor,
  DEFAULT_SETTINGS,
  isTechnicalTie,
  rankMovies,
  scoreMovie,
  tierFor,
  weightShares,
} from '../src/lib/ranking.ts';
import type { Movie, RankingSettings } from '../src/lib/types.ts';

// Datos de prueba ficticios: no corresponden a títulos reales.
function movie(
  id: string,
  imdb: number | null,
  rt: number | null,
  popcorn: number | null,
  votes: number | null = 500_000,
): Movie {
  return {
    imdbID: id,
    title: `Película ${id}`,
    year: '2020',
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
    awards: null,
    ratings: { imdb, imdbVotes: votes, rt, popcorn },
    audienceChecked: true,
    providers: [],
    fetchedAt: 0,
  };
}

const noAdjust: RankingSettings = {
  weights: { imdb: 50, rt: 50, popcorn: 0 },
  voteConfidence: false,
  awardsBonus: 0,
  minVotes: 10_000,
};
const thirds: RankingSettings = { ...noAdjust, weights: { imdb: 50, rt: 50, popcorn: 50 } };

describe('parseo de OMDb', () => {
  it('convierte los formatos de cada fuente', () => {
    assert.equal(parseImdbRating('7.8'), 7.8);
    assert.equal(parseImdbRating('7.8/10'), 7.8);
    assert.equal(parseImdbRating('N/A'), null);
    assert.equal(parseVotes('1,234,567'), 1_234_567);
    assert.equal(parsePercent('93%'), 93);
    assert.equal(parsePercent('N/A'), null);
    assert.equal(parseRuntime('142 min'), 142);
    assert.equal(parseRuntime('N/A'), null);
  });

  it('extrae IMDb y la crítica de RT de una ficha (el público lo pone MDBList)', () => {
    const raw: OmdbMovieResponse = {
      Response: 'True',
      Title: 'Ejemplo',
      Year: '2001',
      Runtime: '98 min',
      Genre: 'Drama, Comedy',
      Poster: 'N/A',
      imdbRating: '8.1',
      imdbVotes: '45,210',
      imdbID: 'tt0000001',
      Type: 'movie',
      Ratings: [
        { Source: 'Internet Movie Database', Value: '8.1/10' },
        { Source: 'Rotten Tomatoes', Value: '88%' },
        { Source: 'Metacritic', Value: '71/100' },
      ],
    };
    const m = parseMovie(raw, 123);
    assert.deepEqual(m.ratings, { imdb: 8.1, imdbVotes: 45_210, rt: 88, popcorn: null });
    assert.equal(m.audienceChecked, false);
    assert.equal(m.poster, null);
    assert.deepEqual(m.genres, ['Drama', 'Comedy']);
    assert.equal(m.runtimeMin, 98);
    assert.equal(m.fetchedAt, 123);
  });

  it('traduce los errores conocidos', () => {
    assert.match(translateOmdbError('Invalid API key!'), /clave/);
    assert.match(translateOmdbError('Request limit reached!'), /límite/);
  });

  it('adapta fichas guardadas por la versión con Metacritic', () => {
    const old = {
      ...movie('x', 7.0, 80, null),
      ratings: { imdb: 7.0, imdbVotes: 10, rt: 80, meta: 70 },
    } as unknown as Movie;
    delete (old as Partial<Movie>).audienceChecked;
    const m = upgradeMovie(old);
    assert.deepEqual(m.ratings, { imdb: 7.0, imdbVotes: 10, rt: 80, popcorn: null });
    assert.equal(m.audienceChecked, false);
  });

  it('vuelve a buscar el público de RT si una ficha guardada no lo tiene', () => {
    assert.equal(upgradeMovie({ ...movie('y', 7.0, 80, null), audienceChecked: true }).audienceChecked, false);
    assert.equal(upgradeMovie({ ...movie('z', 7.0, 80, 85), audienceChecked: true }).audienceChecked, true);
    // Fichas guardadas antes de traer las plataformas: se vuelve a consultar MDBList.
    const sinPlataformas = { ...movie('w', 7.0, 80, 85), audienceChecked: true } as Partial<Movie>;
    delete sinPlataformas.providers;
    const actualizada = upgradeMovie(sinPlataformas as Movie);
    assert.equal(actualizada.audienceChecked, false);
    assert.equal(actualizada.providers, null);
  });
});

describe('CineScore', () => {
  it('promedia IMDb y Rotten Tomatoes a partes iguales', () => {
    const s = scoreMovie(movie('a', 8.0, 90, null), noAdjust);
    assert.equal(s.score, 85);
    assert.equal(s.coverage, 1);
    assert.deepEqual(s.missing, []);
    assert.equal(s.tier?.key, 'essential');
  });

  it('respeta los pesos personalizados', () => {
    const settings: RankingSettings = { ...noAdjust, weights: { imdb: 25, rt: 75, popcorn: 0 } };
    assert.equal(scoreMovie(movie('a', 6.0, 100, null), settings).score, 90);
  });

  it('combina IMDb, crítica y público de RT a partes iguales', () => {
    const s = scoreMovie(movie('a', 8.0, 90, 70), thirds);
    assert.equal(s.score, 80);
    assert.deepEqual(
      s.contributions.map((c) => c.source),
      ['imdb', 'rt', 'popcorn'],
    );
  });

  it('sin el público de RT reparte su peso entre IMDb y la crítica', () => {
    const s = scoreMovie(movie('a', 8.0, 90, null), thirds);
    assert.equal(s.score, 85);
    assert.deepEqual(s.missing, ['popcorn']);
  });

  it('reparte el peso cuando falta una fuente y lo marca', () => {
    const s = scoreMovie(movie('a', 7.0, null, null), noAdjust);
    assert.equal(s.score, 70);
    assert.deepEqual(s.missing, ['rt']);
    assert.equal(s.coverage, 0.5);
  });

  it('devuelve null si no hay ningún dato con peso', () => {
    const s = scoreMovie(movie('a', null, null, 80), noAdjust); // el público tiene peso 0
    assert.equal(s.score, null);
    assert.equal(s.tier, null);
  });

  it('corrige la nota IMDb de títulos con pocos votos', () => {
    assert.equal(bayesianAverage(90, 0, 10_000), 65);
    assert.ok(Math.abs(bayesianAverage(90, 1_000_000, 10_000) - 90) < 0.3);
    const settings: RankingSettings = { ...noAdjust, voteConfidence: true };
    const few = scoreMovie(movie('a', 9.0, 90, null, 2_000), settings);
    const many = scoreMovie(movie('b', 9.0, 90, null, 2_000_000), settings);
    assert.ok(few.score! < many.score!);
    assert.ok(few.imdbAdjustment < 0);
    assert.equal(few.imdbRaw, 90);
  });

  it('clasifica por niveles', () => {
    assert.equal(tierFor(90).key, 'essential');
    assert.equal(tierFor(80).key, 'great');
    assert.equal(tierFor(70).key, 'good');
    assert.equal(tierFor(55).key, 'mixed');
    assert.equal(tierFor(30).key, 'avoid');
  });

  it('detecta si crítica y público coinciden', () => {
    assert.equal(consensusFor(95, 70)?.key, 'critics');
    assert.equal(consensusFor(40, 75)?.key, 'audience');
    assert.equal(consensusFor(80, 78)?.key, 'aligned');
    assert.equal(consensusFor(null, 78), null);
  });

  it('compara crítica con palomitas, o con IMDb si faltan', () => {
    assert.equal(scoreMovie(movie('a', 8.0, 95, 60), thirds).consensus?.key, 'critics');
    assert.equal(scoreMovie(movie('b', 6.0, 95, null), thirds).consensus?.gap, 35);
  });

  it('normaliza los pesos a porcentajes', () => {
    assert.deepEqual(weightShares({ imdb: 40, rt: 40, popcorn: 20 }), { imdb: 0.4, rt: 0.4, popcorn: 0.2 });
    assert.deepEqual(weightShares({ imdb: 0, rt: 0, popcorn: 0 }), { imdb: 0, rt: 0, popcorn: 0 });
  });
});

describe('ranking', () => {
  const list = [
    movie('baja', 6.0, 50, 60),
    movie('alta', 8.5, 95, 80),
    movie('media', 7.5, 80, 70),
    movie('vacia', null, null, null),
  ];

  it('ordena por CineScore y deja sin datos al final', () => {
    const ranked = rankMovies(list, noAdjust);
    assert.deepEqual(
      ranked.map((r) => r.movie.imdbID),
      ['alta', 'media', 'baja', 'vacia'],
    );
    assert.deepEqual(
      ranked.map((r) => r.rank),
      [1, 2, 3, null],
    );
  });

  it('ordena por una sola fuente', () => {
    const ranked = rankMovies(list, noAdjust, 'popcorn');
    assert.equal(ranked[0].movie.imdbID, 'alta');
    assert.equal(ranked[2].movie.imdbID, 'baja');
  });

  it('desempata por cobertura y luego por votos', () => {
    const a = movie('a', 8.0, null, null, 100);
    const b = movie('b', 7.0, 90, null, 100); // también 80, pero con dos fuentes
    const c = movie('c', 7.0, 90, null, 900);
    const ranked = rankMovies([a, b, c], noAdjust);
    assert.deepEqual(
      ranked.map((r) => r.movie.imdbID),
      ['c', 'b', 'a'],
    );
  });

  it('avisa de empate técnico', () => {
    assert.equal(isTechnicalTie(rankMovies([movie('a', 8.0, 90, null), movie('b', 8.1, 88, null)], noAdjust)), true);
    assert.equal(isTechnicalTie(rankMovies([movie('a', 8.0, 90, null), movie('b', 6.0, 60, null)], noAdjust)), false);
  });

  it('marca los mejores valores de una fila', () => {
    assert.deepEqual([...bestIndexes([70, 90, null, 90])], [1, 3]);
    assert.deepEqual([...bestIndexes([70, null])], []);
  });

  it('usa ajustes por defecto razonables', () => {
    assert.equal(DEFAULT_SETTINGS.weights.imdb + DEFAULT_SETTINGS.weights.rt, 100);
  });
});
