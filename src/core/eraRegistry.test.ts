import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ERA_IDS } from '../eras/types';
import type { EraId } from '../eras/types';
import { disposeEraSceneContent } from './EraRegistry';
import { EraRegistry } from './EraRegistry';
import type { EraContentBuilder } from './EraRegistry';

function simpleContent(id: EraId, options: { dispose?: () => void } = {}) {
  const group = new THREE.Group();
  group.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: '#888888' }),
    ),
  );
  return { id, group, dispose: options.dispose };
}

function builderReturning(
  id: EraId,
  options: { dispose?: () => void } = {},
): EraContentBuilder {
  return () => simpleContent(id, options);
}

describe('EraRegistry', () => {
  it('registers and lazily builds content for all five EraId values', () => {
    const registry = new EraRegistry();
    for (const id of [...ERA_IDS]) {
      registry.register(id, builderReturning(id));
    }
    expect(registry.registeredIds()).toEqual([...ERA_IDS]);

    const first = registry.build('1945');
    expect(first.id).toBe('1945');
    expect(first.group).toBeInstanceOf(THREE.Group);

    // Cached: peek and a second build return the identical instance.
    expect(registry.peek('1945')).toBe(first);
    expect(registry.build('1945')).toBe(first);
  });

  it('supports runtime swap: replacing a builder disposes the live instance and notifies listeners', () => {
    const registry = new EraRegistry();
    const disposeSpy = vi.fn();
    registry.register('1985', builderReturning('1985', { dispose: disposeSpy }));

    const first = registry.build('1985');
    expect(registry.peek('1985')).toBe(first);

    const invalidations: EraId[] = [];
    registry.onInvalidate((eraId) => invalidations.push(eraId));

    registry.register('1985', builderReturning('1985'));

    expect(disposeSpy).toHaveBeenCalledTimes(1);
    expect(invalidations).toEqual(['1985']);
    expect(registry.peek('1985')).toBeUndefined();

    const second = registry.build('1985');
    expect(second).not.toBe(first);
    expect(second.id).toBe('1985');
  });

  it('rejects unknown era ids and non-function builders', () => {
    const registry = new EraRegistry();
    expect(() => registry.register('1995' as EraId, builderReturning('1945'))).toThrow(TypeError);
    expect(() => registry.register('1945', undefined as unknown as EraContentBuilder)).toThrow(
      TypeError,
    );
    expect(() => registry.build('1945')).toThrow(/no builder registered/);
  });

  it('validates built content shape', () => {
    const registry = new EraRegistry();

    registry.register('1945', () => ({ id: '1965', group: new THREE.Group() }));
    expect(() => registry.build('1945')).toThrow(/mismatched id/);

    registry.register('1965', () => ({ id: '1965', group: null as unknown as THREE.Group }));
    expect(() => registry.build('1965')).toThrow(/THREE.Group/);

    registry.register('1985', () => {
      throw new Error('boom');
    });
    expect(() => registry.build('1985')).toThrow(/builder for era "1985" threw.*boom/s);
    expect(registry.isBuilt('1985')).toBe(false);
  });

  it('unregister removes the builder and disposes built content', () => {
    const registry = new EraRegistry();
    const disposeSpy = vi.fn();
    registry.register('2005', builderReturning('2005', { dispose: disposeSpy }));

    registry.build('2005');
    registry.unregister('2005');

    expect(disposeSpy).toHaveBeenCalledTimes(1);
    expect(registry.has('2005')).toBe(false);
    expect(registry.peek('2005')).toBeUndefined();
    expect(registry.registeredIds()).toEqual([]);
  });

  it('disposeEraSceneContent deep-disposes geometries/materials/textures exactly once', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const geometrySpy = vi.spyOn(geometry, 'dispose');
    const texture = new THREE.Texture();
    const textureSpy = vi.spyOn(texture, 'dispose');
    const material = new THREE.MeshStandardMaterial({ map: texture });
    const materialSpy = vi.spyOn(material, 'dispose');
    const customDispose = vi.fn();

    const group = new THREE.Group();
    group.add(new THREE.Mesh(geometry, material));
    const content = { id: '2025' as EraId, group, dispose: customDispose };

    disposeEraSceneContent(content);
    disposeEraSceneContent(content); // idempotent

    expect(geometrySpy).toHaveBeenCalledTimes(1);
    expect(materialSpy).toHaveBeenCalledTimes(1);
    expect(textureSpy).toHaveBeenCalledTimes(1);
    expect(customDispose).toHaveBeenCalledTimes(1);
  });

  it('dispose clears every builder and instance', () => {
    const registry = new EraRegistry();
    const disposeSpy = vi.fn();
    for (const id of [...ERA_IDS]) {
      registry.register(id, builderReturning(id, { dispose: disposeSpy }));
    }
    registry.build('1945');
    registry.dispose();

    expect(disposeSpy).toHaveBeenCalledTimes(1);
    expect(registry.registeredIds()).toEqual([]);
    expect(registry.peek('1945')).toBeUndefined();
  });
});
