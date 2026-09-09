/**
 * Signage system: storefronts, signs, posters, awnings, and advertisements
 * anchored to the city-block layout's frontage planes.
 *
 * Implements the `EraSystem` lifecycle contract from `src/era/types.ts`:
 *
 * - `attach(context)` — registers the era sign groups with a THREE scene and
 *   shows the default era (1945).
 * - `update(channel, deltaSeconds)` — crossfades sign sets as the timeline
 *   moves between eras (visibility + opacity following eased `t`);
 *   illuminated boards (neon/backlit/LED/media) pulse emissive intensity by
 *   the era's flicker rate while both sets are live.
 * - `dispose()` — removes the group from the scene and releases all owned
 *   geometries, materials, and textures idempotently.
 *
 * Signage anchors ONLY to the layout's frontage planes (position + facing +
 * height band). It never imports or reads the buildings system, keeping this
 * task parallel-safe with buildings.
 */

import { Group, type Scene } from 'three';
import type { BlockLayout } from '../../layout/types';
import type { EraId } from '../../../era/years';
import type { EraSystem, TimelineChannel } from '../../../era/types';
import { easeInOut } from '../../../era/transition';
import {
  SIGNAGE_ERAS,
  signageEraData,
  type SignageEraSpecData,
  type SignageItemSpec,
} from './signageEraData';
import { BLOOM_FLAG, createSign, disposeSignResources, type SignResources } from './signFactory';

/** Context object passed to `attach`. */
export interface SignageContext {
  readonly scene: Scene;
}

/** Placement for one sign band on a frontage plane (world units). */
interface BandPlacement {
  width: number;
  height: number;
  baseY: number;
  depth: number;
  offsetAlong: number;
  yawOffset: number;
}

/** Sign set for one era (all signs share the era's group). */
export interface SignageEraSet {
  readonly era: EraId;
  readonly spec: SignageEraSpecData;
  readonly group: Group;
  readonly signs: ReadonlyArray<{ name: string; group: Group; band: SignageItemSpec['band'] }>;
  readonly resources: SignResources[];
}

/** The public system surface (implements EraSystem + tooling). */
export interface SignageSystem extends EraSystem<SignageContext> {
  readonly group: Group;
  readonly layout: BlockLayout;
  readonly eraSets: ReadonlyArray<SignageEraSet>;
  readonly eraData: Readonly<Record<EraId, SignageEraSpecData>>;
  isAttached(): boolean;
  activeEra(): EraId;
}

const DEFAULT_ERA: EraId = '1945';

/** Base visibility opacity per era (painted boards opaque, lit slightly lower). */
const BASE_OPACITY: Readonly<Record<EraId, number>> = {
  '1945': 1,
  '1965': 0.95,
  '1985': 0.9,
  '2005': 0.82,
  '2025': 0.82,
};

/** Per-band placement templates (world units against the frontage plane). */
export function bandPlacement(
  band: SignageItemSpec['band'],
  planeWidth: number,
  planeHeight: number,
): BandPlacement {
  switch (band) {
    case 'billboard':
      return { width: planeWidth * 0.9, height: 2.6, baseY: 3.2, depth: 0.35, offsetAlong: 0, yawOffset: 0 };
    case 'blade':
      return {
        width: 1.2,
        height: 1.9,
        baseY: 2.1,
        depth: 0.7,
        offsetAlong: -planeWidth * 0.22,
        yawOffset: Math.PI / 2,
      };
    case 'rooftop':
      return {
        width: planeWidth * 0.86,
        height: 1.5,
        baseY: Math.max(4, planeHeight - 1.9),
        depth: 0.3,
        offsetAlong: 0,
        yawOffset: 0,
      };
    case 'media-facade':
      return {
        width: planeWidth * 0.96,
        height: Math.min(4.4, planeHeight * 0.42),
        baseY: planeHeight * 0.3,
        depth: 0.6,
        offsetAlong: 0,
        yawOffset: 0,
      };
    case 'window':
      return { width: planeWidth * 0.55, height: 0.85, baseY: 1.3, depth: 0.12, offsetAlong: 0, yawOffset: 0 };
    case 'storefront':
      return { width: planeWidth * 0.8, height: 1.15, baseY: 1.85, depth: 0.18, offsetAlong: 0, yawOffset: 0 };
    default:
      return { width: planeWidth * 0.7, height: 1.0, baseY: 1.8, depth: 0.16, offsetAlong: 0, yawOffset: 0 };
  }
}

/** Deterministically map a sign index onto the block's plot count. */
function plotIndex(i: number, plotCount: number): number {
  return ((i % plotCount) + plotCount) % plotCount;
}

/** Set `opacity` on every material-bearing object under `target`. */
function setGroupOpacity(target: Group, opacity: number): void {
  target.traverse((obj) => {
    const mesh = obj as { material?: unknown };
    const raw = mesh.material;
    if (!raw) return;
    const materials = Array.isArray(raw) ? raw : [raw];
    for (const mat of materials) {
      const candidate = mat as { opacity?: number; transparent?: boolean };
      if (candidate && typeof candidate.opacity === 'number') {
        candidate.transparent = true;
        candidate.opacity = opacity;
      }
    }
  });
}

/** Build one era's sign group (all signs for this era). */
function buildEraSet(era: EraId, spec: SignageEraSpecData, layout: BlockLayout): SignageEraSet {
  const eraGroup = new Group();
  eraGroup.name = `signage-${era}`;
  const resources: SignResources[] = [];
  const signs: Array<SignageEraSet['signs'][number]> = [];

  const plots = layout.plots;
  const seedBase = `${layout.seed}:${era}`;

  spec.signs.forEach((item, i) => {
    const plot = plots[plotIndex(i, plots.length)];
    const plane = plot.frontagePlane;
    const band = bandPlacement(item.band, plane.width, plane.height);
    const result = createSign({
      plane,
      size: { width: band.width, height: band.height },
      baseY: band.baseY,
      depth: band.depth,
      item,
      seed: `${seedBase}:${i}`,
      namePrefix: `era-${era}`,
      offsetAlong: band.offsetAlong,
      yawOffset: band.yawOffset,
    });
    eraGroup.add(result.group);
    resources.push(result.resources);
    signs.push({ name: result.group.name, group: result.group, band: item.band });
  });

  return { era, spec, group: eraGroup, signs, resources };
}

/**
 * Create the signage system for `layout`.
 *
 * All era sign sets are built eagerly and cached; `attach` controls when they
 * enter the scene. `update(channel)` crossfades between the from/to sets.
 */
export function createSignageSystem(layout: BlockLayout): SignageSystem {
  const group = new Group();
  group.name = 'signage';

  const eraSets: SignageEraSet[] = SIGNAGE_ERAS.map((era) => {
    const set = buildEraSet(era, signageEraData[era], layout);
    group.add(set.group);
    return set;
  });

  let attached = false;
  let disposed = false;
  let lastChannel: TimelineChannel = { fromEra: DEFAULT_ERA, toEra: DEFAULT_ERA, t: 0 };
  let wallClock = 0;

  function eraSetFor(era: EraId): SignageEraSet | undefined {
    for (const set of eraSets) if (set.era === era) return set;
    return undefined;
  }

  /** Show exactly one static era's group, hide the rest. */
  function showEra(era: EraId): void {
    for (const set of eraSets) set.group.visible = set.era === era;
  }

  /**
   * Apply neon flicker / steady glow to emissive boards of one set.
   * `weight` is the crossfade presence (0..1); emissive intensity blends the
   * era's glow with the flicker sine when the era is flickery.
   */
  function applyGlow(set: SignageEraSet, weight: number, dt: number): void {
    const rate = set.spec.flickerRate;
    const wave = rate === 0 ? 1 : 0.78 + 0.22 * Math.sin(wallClock * rate * Math.PI * 2);
    for (const resource of set.resources) {
      const mat = resource.materials[0];
      if (!mat || mat.userData[BLOOM_FLAG] !== true) continue;
      const candidate = mat as { emissiveIntensity: number };
      candidate.emissiveIntensity = Math.max(0.02, weight * wave * (0.6 + 0.4 * dt));
    }
  }

  function attach(context: SignageContext): void {
    if (disposed) return;
    context.scene.add(group);
    attached = true;
    showEra(DEFAULT_ERA);
  }

  function update(channel: TimelineChannel, deltaSeconds: number): void {
    lastChannel = channel;
    if (!attached) return;
    wallClock += deltaSeconds;

    const t = easeInOut(channel.t);
    const fromEra = channel.fromEra;
    const toEra = channel.toEra;

    if (fromEra === toEra || t >= 0.999) {
      showEra(toEra);
      const settled = eraSetFor(toEra);
      if (settled) applyGlow(settled, 1, deltaSeconds);
      return;
    }

    // Crossfade: both sets live, opacity follows the eased t.
    const fromGroup = eraSetFor(fromEra)?.group;
    const toGroup = eraSetFor(toEra)?.group;
    if (fromGroup) {
      fromGroup.visible = true;
      setGroupOpacity(fromGroup, (1 - t) * BASE_OPACITY[fromEra]);
    }
    if (toGroup) {
      toGroup.visible = true;
      setGroupOpacity(toGroup, t * BASE_OPACITY[toEra]);
    }

    const fromSet = eraSetFor(fromEra);
    const toSet = eraSetFor(toEra);
    if (fromSet) applyGlow(fromSet, 1 - t, deltaSeconds);
    if (toSet) applyGlow(toSet, t, deltaSeconds);
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    attached = false;
    if (group.parent) group.parent.remove(group);
    const geometries = new Set<unknown>();
    for (const set of eraSets) {
      set.group.traverse((obj) => {
        const mesh = obj as { geometry?: { dispose?: () => void } };
        if (mesh.geometry && typeof mesh.geometry.dispose === 'function' && !geometries.has(mesh.geometry)) {
          geometries.add(mesh.geometry);
          mesh.geometry.dispose();
        }
      });
      for (const resource of set.resources) disposeSignResources(resource);
    }
  }

  function isAttached(): boolean {
    return attached;
  }

  function activeEra(): EraId {
    return lastChannel.t >= 0.999 ? lastChannel.toEra : lastChannel.fromEra;
  }

  return {
    group,
    layout,
    eraSets,
    eraData: signageEraData,
    isAttached,
    activeEra,
    attach,
    update,
    dispose,
  };
}
