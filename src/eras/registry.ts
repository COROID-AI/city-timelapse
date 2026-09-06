import type { EraContent, EraId } from '../types';
import { ERA_IDS } from '../types';

/**
 * Era registry — a singleton that every era module registers into at boot and
 * the main loop reads from when switching eras. This is the shared composition
 * point for the nine parallel era/UI modules.
 */

/** Alias for the registration record so consumers can type their modules. */
export type EraRegistration = EraContent;

/** Composition metadata exposed by the registry for each registered era. */
export interface EraCompositionInfo {
  era: EraId;
  build: EraContent['build'];
  update: EraContent['update'];
  dispose: EraContent['dispose'];
  interactivePoints: EraContent['interactivePoints'];
  isFastPath: EraContent['isFastPath'];
}

export class EraRegistry {
  private readonly eras = new Map<EraId, EraContent>();

  /**
   * Register an era implementation. Each era id may be registered at most once;
   * duplicate registration throws.
   */
  registerEra(era: EraId, content: EraContent): void {
    if (this.eras.has(era)) {
      throw new Error(`Era '${era}' is already registered.`);
    }
    this.eras.set(era, content);
  }

  /** All registered era ids, in ERA_IDS (chronological) order. */
  getEras(): EraId[] {
    return ERA_IDS.filter((id) => this.eras.has(id));
  }

  /** The registered content for a single era, or undefined if not registered. */
  getEra(era: EraId): EraContent | undefined {
    return this.eras.get(era);
  }

  /** Composition metadata for all registered eras (order matches getEras). */
  eraCompositionInfo(): EraCompositionInfo[] {
    return this.getEras().map((era) => {
      const content = this.eras.get(era);
      if (!content) {
        // Unreachable: getEras only returns registered ids.
        throw new Error(`Era '${era}' missing from registry.`);
      }
      return {
        era,
        build: content.build,
        update: content.update,
        dispose: content.dispose,
        interactivePoints: content.interactivePoints,
        isFastPath: content.isFastPath,
      };
    });
  }
}

/** Process-wide singleton registry. */
export const eraRegistry = new EraRegistry();