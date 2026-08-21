import * as THREE from 'three';
import type { EraId } from '../eras/types';
import { ERA_IDS, isEraId } from '../eras/types';
import type { EraAudioDescriptor } from './AudioBus';

/**
 * Built output of one era builder: a root group carrying the era's meshes and
 * materials, optional per-era audio descriptors for the AudioBus, and optional
 * hooks. This is the runtime counterpart of the descriptor-only `EraContent`
 * in `src/eras/types.ts` — era-content tasks turn those descriptors into this
 * scene bundle and hand the bundle's factory to the registry.
 */
export interface EraSceneContent {
  /** Must match the registry key the builder was registered under. */
  readonly id: EraId;
  /** Root group holding every mesh/material belonging to this era. */
  readonly group: THREE.Group;
  /** Per-era ambience/SFX channel registration for the AudioBus. */
  readonly audio?: EraAudioDescriptor;
  /**
   * Optional per-frame blend hook invoked with the era's applied weight
   * (0 = fully hidden, 1 = fully present). Use it for custom morphs the
   * generic crossfade cannot express (vertex morph targets, shader uniforms).
   */
  blend?(weight: number): void;
  /** Optional cleanup invoked when the registry discards this instance. */
  dispose?(): void;
}

/** Factory that produces one era's scene content on demand. */
export type EraContentBuilder = () => EraSceneContent;

export type EraInvalidateListener = (eraId: EraId) => void;

/** Instances already handed out; guards against double-dispose callbacks. */
const disposedContents = new WeakSet<EraSceneContent>();

/**
 * Deep-dispose a built era bundle: geometries, materials and any textures
 * reachable through material slots, then the bundle's own dispose hook.
 */
export function disposeEraSceneContent(content: EraSceneContent): void {
  if (disposedContents.has(content)) {
    return;
  }
  disposedContents.add(content);
  content.group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose();
    const material = mesh.material;
    const materials = Array.isArray(material) ? material : material ? [material] : [];
    for (const entry of materials) {
      for (const value of Object.values(entry)) {
        if (value instanceof THREE.Texture) {
          value.dispose();
        }
      }
      entry.dispose();
    }
  });
  content.dispose?.();
}

/**
 * Registry mapping every timeline era to a lazily-invoked content builder.
 *
 * - Builders run at most once per registration and the result is cached.
 * - `register` supports runtime swaps: replacing a builder discards the cached
 *   instance (deep-disposed) and notifies invalidation listeners so live
 *   systems (TransitionSystem) can rebuild against the new builder seamlessly.
 * - No era-specific content lives here; this module only defines the contract.
 */
export class EraRegistry {
  readonly #builders = new Map<EraId, EraContentBuilder>();
  readonly #instances = new Map<EraId, EraSceneContent>();
  readonly #listeners = new Set<EraInvalidateListener>();

  /**
   * Register (or replace) the builder for one era. Replacing a builder whose
   * content is currently built disposes the old instance and fires
   * invalidation so consumers rebuild immediately.
   */
  register(eraId: EraId, builder: EraContentBuilder): void {
    if (!isEraId(eraId)) {
      throw new TypeError(
        `EraRegistry: unknown era "${String(eraId)}" (expected one of ${ERA_IDS.join(', ')})`,
      );
    }
    if (typeof builder !== 'function') {
      throw new TypeError(`EraRegistry: builder for era "${eraId}" must be a function`);
    }
    this.#builders.set(eraId, builder);
    if (this.#instances.has(eraId)) {
      this.invalidate(eraId);
    }
  }

  /** Remove a builder and any built content for one era. */
  unregister(eraId: EraId): void {
    this.#builders.delete(eraId);
    if (this.#instances.has(eraId)) {
      this.invalidate(eraId);
    }
  }

  has(eraId: EraId): boolean {
    return this.#builders.has(eraId);
  }

  getBuilder(eraId: EraId): EraContentBuilder | undefined {
    return this.#builders.get(eraId);
  }

  /** All eras with a registered builder, in timeline order. */
  registeredIds(): EraId[] {
    return ERA_IDS.filter((id) => this.#builders.has(id));
  }

  /** Cached instance without triggering a build. */
  peek(eraId: EraId): EraSceneContent | undefined {
    return this.#instances.get(eraId);
  }

  /** Build (or return the cached) content for one era. */
  build(eraId: EraId): EraSceneContent {
    const cached = this.#instances.get(eraId);
    if (cached) {
      return cached;
    }
    const builder = this.#builders.get(eraId);
    if (!builder) {
      const missing = ERA_IDS.filter((id) => !this.#builders.has(id));
      throw new Error(
        `EraRegistry: no builder registered for era "${eraId}"` +
          (missing.length > 0 ? ` (still missing: ${missing.join(', ')})` : ''),
      );
    }
    let content: EraSceneContent;
    try {
      content = builder();
    } catch (error) {
      throw new Error(
        `EraRegistry: builder for era "${eraId}" threw: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }
    this.#validate(eraId, content);
    this.#instances.set(eraId, content);
    return content;
  }

  /** True when the era's content has already been built. */
  isBuilt(eraId: EraId): boolean {
    return this.#instances.has(eraId);
  }

  /** Discard (and deep-dispose) the cached instance for one era. */
  invalidate(eraId: EraId): void {
    const instance = this.#instances.get(eraId);
    if (!instance) {
      return;
    }
    this.#instances.delete(eraId);
    disposeEraSceneContent(instance);
    for (const listener of [...this.#listeners]) {
      listener(eraId);
    }
  }

  /** Observe invalidations (runtime swaps) to rebuild live bindings. */
  onInvalidate(listener: EraInvalidateListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /** Discard every builder and built instance; the registry becomes empty. */
  dispose(): void {
    for (const eraId of [...this.#instances.keys()]) {
      const instance = this.#instances.get(eraId);
      if (instance) {
        disposeEraSceneContent(instance);
      }
    }
    this.#instances.clear();
    this.#builders.clear();
    this.#listeners.clear();
  }

  #validate(eraId: EraId, content: EraSceneContent): void {
    if (content === null || typeof content !== 'object') {
      throw new TypeError(`EraRegistry: builder for era "${eraId}" returned ${String(content)}`);
    }
    if (content.id !== eraId) {
      throw new TypeError(
        `EraRegistry: builder for era "${eraId}" returned content with mismatched id "${String(
          (content as { id?: unknown }).id,
        )}"`,
      );
    }
    if (!(content.group instanceof THREE.Group)) {
      throw new TypeError(
        `EraRegistry: content for era "${eraId}" must expose a THREE.Group as "group"`,
      );
    }
  }
}
