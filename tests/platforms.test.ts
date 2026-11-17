/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { platformsFor } from '../src/lib/platforms.ts';

describe('Plataformas para «¿Cuál es mejor?»', () => {
  it('muestra las de suscripción y omite canales, tiendas y servicios desconocidos', () => {
    // Respuesta real de MDBList para Dune: Part Two.
    const result = platformsFor([
      { id: 2, name: 'Apple TV Store' },
      { id: 3, name: 'Google Play Movies' },
      { id: 7, name: 'Fandango At Home' },
      { id: 10, name: 'Amazon Video' },
      { id: 192, name: 'YouTube' },
      { id: 538, name: 'Plex' },
      { id: 1825, name: 'HBO Max Amazon Channel' },
      { id: 1899, name: 'HBO Max' },
    ]);
    assert.equal(result.kind, 'stream');
    assert.deepEqual(
      result.items.map((p) => p.name),
      ['HBO Max'],
    );
  });

  it('ordena por preferencia y reconoce servicios por nombre si el ID cambia', () => {
    const result = platformsFor([
      { id: 99999, name: 'Disney Plus' },
      { id: 8, name: 'Netflix' },
      { id: 88888, name: 'Amazon Prime Video with Ads' },
    ]);
    assert.deepEqual(
      result.items.map((p) => p.key),
      ['netflix', 'prime', 'disney'],
    );
  });

  it('sin suscripción, muestra dónde alquilarla; sin datos, nada', () => {
    const rent = platformsFor([
      { id: 192, name: 'YouTube' },
      { id: 2, name: 'Apple TV Store' },
    ]);
    assert.equal(rent.kind, 'rent');
    assert.deepEqual(
      rent.items.map((p) => p.key),
      ['apple-store', 'youtube'],
    );
    assert.deepEqual(platformsFor(null), { kind: 'none', items: [] });
    assert.deepEqual(platformsFor([{ id: 538, name: 'Plex' }]), { kind: 'none', items: [] });
  });
});
