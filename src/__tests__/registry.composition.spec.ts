import { describe, expect, it } from 'vitest';

import type { EraContent, EraId } from '../types';
import { EraRegistry } from '../eras/registry';

/**
 * Registry composition test — verifies the era registry accepts a stub
 * EraContent, exposes it, and rejects duplicate registration. Each test uses a
 * fresh instance so singleton state cannot leak between assertions.
 */

const makeStub = (): EraContent => ({
  build: () => undefined,
  update: () => undefined,
  dispose: () => undefined,
  interactivePoints: [],
  isFastPath: false,
});

describe('eraRegistry', () => {
  it('registers an era and returns it via getEra/getEras', () => {
    const registry = new EraRegistry();
    const stub = makeStub();
    registry.registerEra('1945', stub);

    expect(registry.getEra('1945')).toBe(stub);
    expect(registry.getEras()).toContain('1945');
  });

  it('exposes build/update/dispose via eraCompositionInfo', () => {
    const registry = new EraRegistry();
    const stub = makeStub();
    registry.registerEra('1965', stub);

    const info = registry.eraCompositionInfo();
    const entry = info.find((e) => e.era === '1965');
    expect(entry).toBeDefined();
    expect(entry?.build).toBe(stub.build);
    expect(entry?.update).toBe(stub.update);
    expect(entry?.dispose).toBe(stub.dispose);
    expect(entry?.interactivePoints).toBe(stub.interactivePoints);
    expect(entry?.isFastPath).toBe(stub.isFastPath);
  });

  it('rejects duplicate registration', () => {
    const registry = new EraRegistry();
    registry.registerEra('1985', makeStub());

    expect(() => registry.registerEra('1985', makeStub())).toThrow(/already registered/);
  });

  it('returns undefined for an unregistered era', () => {
    const registry = new EraRegistry();
    expect(registry.getEra('2025')).toBeUndefined();
  });

  it('keeps eras in canonical chronological order', () => {
    const registry = new EraRegistry();
    const order: EraId[] = ['2005', '2025', '1945'];
    for (const id of order) {
      registry.registerEra(id, makeStub());
    }
    const eras = registry.getEras();
    const indices = eras.map((id) => ['1945', '1965', '1985', '2005', '2025'].indexOf(id));
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
  });
});