/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_EXPLORE,
  discoverParams,
  matchesFilters,
  oscarWins,
  parseExploreRatings,
  regionFromLocale,
  sanitizeExplore,
} from '../src/lib/explore.ts';
import { parseDiscover, parseProviders, tmdbImage } from '../src/lib/tmdb-parse.ts';

// Respuesta real de MDBList para Oppenheimer (búsqueda por ID de TMDB).
const oppenheimer = {
  title: 'Oppenheimer',
  ids: { imdb: 'tt15398776', tmdb: 872585 },
  awards:
    'Won: Best Motion Picture of the Year (Oscars, 2024). Plus 3 more Oscars, 5 Oscar nominations, 6 wins & 7 nominations.',
  ratings: [
    { source: 'imdb', value: 8.2 },
    { source: 'tomatoes', value: 93 },
    { source: 'popcorn', value: 91 },
  ],
};

describe('Explorar: Óscar y notas', () => {
  it('cuenta los Óscar ganados del texto de MDBList', () => {
    assert.equal(oscarWins(oppenheimer.awards), 4);
    assert.equal(oscarWins('Won: Best Animated Feature Film of the Year (Oscars, 2016). Plus 1 Oscar nomination.'), 1);
    assert.equal(oscarWins('Won: Best Film (BAFTA, 2020). Plus 2 Oscar nominations, 5 wins.'), 0);
    assert.equal(oscarWins(null), 0);
  });

  it('lee notas e ID de IMDb y aplica los filtros de calidad', () => {
    const r = parseExploreRatings(oppenheimer);
    assert.deepEqual(r, { imdbID: 'tt15398776', imdb: 8.2, rt: 93, popcorn: 91, oscars: 4 });
    const all = { ...DEFAULT_EXPLORE, imdb8: true, rt80: true, oscar: true };
    assert.equal(matchesFilters(r, all), true);
    assert.equal(matchesFilters({ ...r, imdb: 7.9 }, all), false);
    assert.equal(matchesFilters({ ...r, rt: null }, { ...DEFAULT_EXPLORE, rt80: true }), false);
    assert.equal(matchesFilters({ ...r, oscars: 0 }, { ...DEFAULT_EXPLORE, oscar: true }), false);
    assert.equal(matchesFilters({ ...r, imdbID: null }, DEFAULT_EXPLORE), false);
  });
});

describe('Explorar: consulta a TMDB', () => {
  it('filtra por plataforma y país, y ordena por nota si hay filtros de calidad', () => {
    const p = discoverParams({ ...DEFAULT_EXPLORE, region: 'CO', provider: 8, imdb8: true, decade: '2010' }, 2);
    assert.equal(p.watch_region, 'CO');
    assert.equal(p.with_watch_providers, '8');
    assert.equal(p.with_watch_monetization_types, 'flatrate');
    assert.equal(p.sort_by, 'vote_average.desc');
    assert.equal(p['vote_average.gte'], '7');
    assert.equal(p['primary_release_date.gte'], '2010-01-01');
    assert.equal(p['primary_release_date.lte'], '2019-12-31');
    assert.equal(p.page, '2');
    assert.equal(p.language, 'es-MX');
  });

  it('sin filtros de calidad ordena por popularidad; el año exacto manda sobre la década', () => {
    const p = discoverParams({ ...DEFAULT_EXPLORE, decade: '2000', year: 2004 }, 1);
    assert.equal(p.sort_by, 'popularity.desc');
    assert.equal(p.with_watch_providers, undefined);
    assert.equal(p.primary_release_year, '2004');
    assert.equal(p['primary_release_date.gte'], undefined);
    assert.equal(discoverParams({ ...DEFAULT_EXPLORE, decade: '1980' }, 1)['primary_release_date.lte'], '1989-12-31');
    assert.equal(discoverParams({ ...DEFAULT_EXPLORE, region: 'ES' }, 1).language, 'es-ES');
  });

  it('valida los filtros guardados', () => {
    assert.deepEqual(sanitizeExplore(undefined, 'CO'), { ...DEFAULT_EXPLORE, region: 'CO' });
    const s = sanitizeExplore({ region: 'XX', provider: 8, imdb8: true, decade: '1970', year: 3000 }, 'MX');
    assert.deepEqual(s, { ...DEFAULT_EXPLORE, region: 'MX', provider: 8, imdb8: true });
  });

  it('deduce el país del idioma del teléfono', () => {
    assert.equal(regionFromLocale('es-CO'), 'CO');
    assert.equal(regionFromLocale('es_AR'), 'AR');
    assert.equal(regionFromLocale('fr-FR'), 'MX');
    assert.equal(regionFromLocale(undefined), 'MX');
  });

  it('lee el catálogo y las plataformas de TMDB', () => {
    const page = parseDiscover({
      page: 1,
      total_pages: 12,
      total_results: 230,
      results: [
        { id: 872585, title: 'Oppenheimer', release_date: '2023-07-19', poster_path: '/p.jpg', overview: 'x', vote_average: 8.1 },
        { id: 1, title: '' },
      ],
    });
    assert.equal(page.results.length, 1);
    assert.deepEqual(page.results[0], {
      tmdbId: 872585,
      title: 'Oppenheimer',
      year: '2023',
      posterPath: '/p.jpg',
      overview: 'x',
      voteAverage: 8.1,
    });
    assert.equal(page.totalPages, 12);

    const providers = parseProviders(
      {
        results: [
          { provider_id: 337, provider_name: 'Disney Plus', logo_path: '/d.jpg', display_priorities: { MX: 3 } },
          { provider_id: 8, provider_name: 'Netflix', logo_path: '/n.jpg', display_priorities: { MX: 1 } },
          { provider_id: 1796, provider_name: 'Netflix basic with Ads', logo_path: '/n2.jpg', display_priorities: { MX: 2 } },
          { provider_id: 582, provider_name: 'Paramount+ Amazon Channel', display_priorities: { MX: 4 } },
        ],
      },
      'MX',
    );
    assert.deepEqual(
      providers.map((p) => p.name),
      ['Netflix', 'Disney Plus'],
    );
    assert.equal(tmdbImage('/n.jpg', 'w92'), 'https://image.tmdb.org/t/p/w92/n.jpg');
    assert.equal(tmdbImage(null), null);
  });
});
