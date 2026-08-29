import { describe, expect, it } from 'vitest';
import { ERA_IDS, ERA_REGISTRY, getEraSpec } from '../../src/engine/eras';
import { registerEraModule, clearEraModules, getEraModule, listEraModules } from '../../src/engine/SceneRegistry';
import type { SceneModule } from '../../src/engine/SceneRegistry';
import { Group } from 'three';

describe('shared era contract', () => {
  it('exposes the five eras in chronological order', () => {
    expect(ERA_IDS).toEqual(['1945', '1965', '1985', '2005', '2025']);
    expect(ERA_REGISTRY.map((e) => e.year)).toEqual([1945, 1965, 1985, 2005, 2025]);
  });

  it('every registry entry has a unique id, year, label, and description', () => {
    const ids = new Set<string>();
    for (const era of ERA_REGISTRY) {
      expect(typeof era.label).toBe('string');
      expect(era.label.length).toBeGreaterThan(0);
      expect(typeof era.description).toBe('string');
      expect(era.description.length).toBeGreaterThan(0);
      expect(ids.has(era.id)).toBe(false);
      ids.add(era.id);
    }
  });

  it('getEraSpec returns the matching spec and throws for unknown ids', () => {
    expect(getEraSpec('1965').year).toBe(1965);
    expect(() => getEraSpec('9999' as never)).toThrow();
  });
});

describe('SceneRegistry pattern', () => {
  const makeModule = (): SceneModule => ({
    group: new Group(),
    update: () => undefined,
    setEra: () => undefined,
    dispose: () => undefined,
  });

  it('registers, retrieves, and lists modules by era', () => {
    clearEraModules();
    const mod = makeModule();
    registerEraModule(mod, '1985');
    expect(getEraModule('1985')).toBe(mod);
    expect(listEraModules()).toContain(mod);
    clearEraModules();
  });

  it('rejects duplicate registrations for the same era', () => {
    clearEraModules();
    registerEraModule(makeModule(), '2005');
    expect(() => registerEraModule(makeModule(), '2005')).toThrow();
    clearEraModules();
  });
});