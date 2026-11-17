/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  activePlan,
  ageRating,
  PLAN_MAX_PENALTY,
  planFit,
  planPhrase,
  planSummary,
  sanitizePlan,
  todayKey,
} from '../src/lib/plan.ts';
import { rankMovies, scoreMovie } from '../src/lib/ranking.ts';
import type { Movie, RankingSettings } from '../src/lib/types.ts';

function movie(id: string, genres: string[], rated: string | null, runtimeMin = 110, imdb = 8, rt = 90): Movie {
  return {
    imdbID: id,
    title: id,
    year: '2024',
    type: 'movie',
    poster: null,
    rated,
    released: null,
    runtimeMin,
    genres,
    director: null,
    actors: null,
    plot: null,
    country: null,
    language: null,
    awards: null,
    ratings: { imdb, imdbVotes: 500_000, rt, popcorn: null },
    audienceChecked: true,
    providers: [],
    fetchedAt: 0,
  };
}

const insideOut = movie('inside-out', ['Animation', 'Adventure', 'Comedy'], 'PG', 95);
const dune = movie('dune', ['Action', 'Adventure', 'Drama'], 'PG-13', 166);
const oppenheimer = movie('oppenheimer', ['Biography', 'Drama', 'History'], 'R', 180);
const conjuring = movie('conjuring', ['Horror', 'Mystery', 'Thriller'], 'R', 112);

describe('Tu plan de hoy: encaje', () => {
  it('una animación PG encaja del todo para reír en familia', () => {
    const fit = planFit(insideOut, { mood: 'laugh', company: 'family' });
    assert.equal(fit?.label, 'Encaja');
    assert.equal(fit?.penalty, 0);
    assert.ok(fit?.reasons.some((r) => r.includes('Comedia')));
    assert.ok(fit?.reasons.some((r) => r.includes('PG: apta para niños')));
  });

  it('una película de acción PG-13 encaja a medias para reír en familia', () => {
    const fit = planFit(dune, { mood: 'laugh', company: 'family' });
    assert.equal(fit?.label, 'A medias');
    assert.ok(fit!.penalty > 5 && fit!.penalty < 10);
    assert.ok(fit?.reasons.includes('No es una comedia'));
  });

  it('una película para adultos en familia pierde el máximo y lo avisa', () => {
    const fit = planFit(oppenheimer, { mood: null, company: 'family' });
    assert.equal(fit?.notForKids, true);
    assert.equal(fit?.label, 'No encaja');
    assert.equal(fit?.penalty, PLAN_MAX_PENALTY);
  });

  it('el terror encaja para pasar miedo y choca para reír', () => {
    assert.equal(planFit(conjuring, { mood: 'scare', company: null })?.label, 'Encaja');
    const laugh = planFit(conjuring, { mood: 'laugh', company: null });
    assert.equal(laugh?.label, 'No encaja');
    assert.ok(laugh?.reasons.includes('Terror: no pega para reír'));
  });

  it('para algo ligero penaliza las películas muy largas', () => {
    const corta = planFit(movie('a', ['Comedy'], 'PG-13', 95), { mood: 'light', company: null });
    const larga = planFit(movie('b', ['Comedy'], 'PG-13', 170), { mood: 'light', company: null });
    assert.ok(larga!.penalty > corta!.penalty);
    assert.ok(larga?.reasons.some((r) => r.startsWith('Larga (2 h 50 min)')));
  });

  it('sin nada que evaluar no ajusta', () => {
    assert.equal(planFit(insideOut, { mood: null, company: 'solo' }), null);
    assert.equal(planFit(movie('sin-generos', [], 'PG'), { mood: 'laugh', company: null }), null);
  });

  it('clasifica la edad, resume el plan y caduca a medianoche', () => {
    assert.equal(ageRating('TV-MA'), 'adult');
    assert.equal(ageRating('PG-13'), 'teen');
    assert.equal(ageRating('Not Rated'), 'unknown');
    assert.equal(planSummary({ mood: 'laugh', company: 'family' }), 'Reír · En familia');
    assert.equal(planPhrase({ mood: 'laugh', company: 'family' }), 'para reír en familia');
    const day = todayKey(new Date(2026, 10, 17));
    assert.equal(day, '2026-11-17');
    assert.deepEqual(activePlan({ mood: 'laugh', company: null, day }, day), { mood: 'laugh', company: null });
    assert.equal(activePlan({ mood: 'laugh', company: null, day: '2026-11-16' }, day), null);
    assert.equal(sanitizePlan({ mood: 'bailar', company: 'nadie', day }), null);
    assert.deepEqual(sanitizePlan({ mood: 'feel', company: 'x', day }), { mood: 'feel', company: null, day });
  });
});

describe('Puntuación «Para hoy»', () => {
  const settings: RankingSettings = {
    weights: { imdb: 50, rt: 50, popcorn: 0, comments: 0 },
    voteConfidence: false,
    minVotes: 10_000,
    awardsBonus: 0,
  };

  it('no cambia el CineScore y resta el desajuste en «Para hoy»', () => {
    const r = scoreMovie(dune, settings, { mood: 'laugh', company: 'family' });
    assert.equal(r.score, 85);
    assert.equal(r.todayScore, Math.round((85 - r.planFit!.penalty) * 10) / 10);
    assert.equal(scoreMovie(dune, settings).todayScore, 85);
  });

  it('con un plan, el ranking «Para hoy» puede dar otro ganador', () => {
    const mejorNota = movie('mejor-nota', ['Action', 'Thriller'], 'R', 120, 9, 98);
    const plan = { mood: 'laugh' as const, company: 'family' as const };
    assert.equal(rankMovies([insideOut, mejorNota], settings, 'score', plan)[0].movie.imdbID, 'mejor-nota');
    assert.equal(rankMovies([insideOut, mejorNota], settings, 'today', plan)[0].movie.imdbID, 'inside-out');
  });
});
