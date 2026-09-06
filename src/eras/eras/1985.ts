import type { EraContent, EraId } from '../../types';
import { eraRegistry } from '../registry';
import {
  OUTFIT_VARIANTS,
  build1985Scene,
  dispose1985Scene,
  update1985Scene,
  type Era1985Providers,
  type Era1985SceneState,
} from './1985.parts';

/**
 * 1985 era — "Neon Commercial Peak".
 *
 * A fully procedural 80s city block: tall commercial towers with mirrored /
 * glass curtain walls, ground-floor retail with neon fascias and hand-drawn
 * posters (arcade, video rental, music, electronics), saturated rooftop
 * billboards, boxy sedans / hatchbacks / a box van plus a bus and tram, and
 * pedestrians in bright 80s fashion (windbreakers, denim, sneakers, boomboxes).
 *
 * Importing this module registers the era into the shared singleton registry
 * (side-effect) and exposes `era1985` / `era1985Providers` for the main
 * integration and the simulation layer.
 */

/** Stats snapshot holder for providers and tests. */
let liveState: Era1985SceneState | null = null;

/** The registered 1985 era content. */
export const era1985: EraContent = {
  /** Build the full 1985 scene graph into the context scene. */
  build(context) {
    const state = build1985Scene(context);
    liveState = state;
  },
  /** Advance vehicles and pedestrians each frame. */
  update(delta) {
    if (liveState) update1985Scene(liveState, delta);
  },
  /** Release resources and detach the scene graph. */
  dispose() {
    if (liveState) {
      dispose1985Scene(liveState);
      liveState = null;
    }
  },
  /** Interactive hotspots: storefronts, billboards, landmark tower, highway gantry. */
  get interactivePoints() {
    return liveState ? liveState.points : [];
  },
  isFastPath: false,
};

/**
 * Providers handed to the main integration / simulation at era switch: the 80s
 * outfit variants and reusable vehicle meshes, plus live scene stats.
 */
export const era1985Providers: Era1985Providers = {
  era: '1985',
  outfitVariants: OUTFIT_VARIANTS,
  vehicleProviders: [
    { id: 'sedan', kind: 'sedan', color: 0xff0044, build: (g) => import('./1985.parts').then((m) => m.buildVehicleForProvider(g, 'sedan', 0xff0044)) },
    { id: 'hatchback', kind: 'hatchback', color: 0x00aaff, build: (g) => import('./1985.parts').then((m) => m.buildVehicleForProvider(g, 'hatchback', 0x00aaff)) },
    { id: 'van', kind: 'van', color: 0xcfd6dd, build: (g) => import('./1985.parts').then((m) => m.buildVehicleForProvider(g, 'van', 0xcfd6dd)) },
    { id: 'bus', kind: 'bus', color: 0xff6600, build: (g) => import('./1985.parts').then((m) => m.buildVehicleForProvider(g, 'bus', 0xff6600)) },
    { id: 'tram', kind: 'tram', color: 0x00c8c8, build: (g) => import('./1985.parts').then((m) => m.buildVehicleForProvider(g, 'tram', 0x00c8c8)) },
  ],
  getStats: () => {
    if (!liveState) return null;
    return liveState.stats;
  },
};

// Side-effect: register the era on import.
eraRegistry.registerEra('1985' as EraId, era1985);