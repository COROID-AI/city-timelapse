/**
 * Era-driven street-lamp and street-lighting system.
 *
 * Places lamp posts at layout furniture anchors (`kind === 'lamp'`). Each
 * anchor receives an era-appropriate lamp assembly:
 *
 * - 1945: `cast_iron_gas` — ornate multi-tier cast iron pole, crossbar, lantern housing with warm gas glow.
 * - 1965: `curved_gooseneck` — midcentury arched tubular pole, teardrop luminaire with sodium-orange glow.
 * - 1985: `square_cobra` — angular brushed post, box/shoebox luminaire with high-pressure sodium glow.
 * - 2005: `modern_pole` — clean cylindrical pole, sleek horizontal LED fixture with white LED glow.
 * - 2025: `smart_led_spire` — slim spire with integrated sensor band and cool LED glow PLUS festive string lights draped between adjacent block lamps.
 *
 * Emissive materials stay bloom-friendly: intensity is modulated so values
 * stay in the sweet spot for ACES highlight roll-off without blowing out HDR
 * buffers.
 *
 * `update(channel, deltaSeconds)` smoothly interpolates colors, intensities,
 * cross-fades pole styles, applies era flicker (gas lamp pulse in 1945), and
 * drapes string lights in 2025.
 */

import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import type { EraSystem, TimelineChannel } from '../../../era/types';
import type { BlockLayout, FurnitureAnchor } from '../../layout/types';

import { atmosphereEraData } from './atmosphereEraData';
import { interpolateEraAtmosphere, toThreeColor } from './interpolation';

export interface LampInstance {
  readonly anchor: FurnitureAnchor;
  readonly root: Group;
  readonly poleMeshes: Record<string, Group>;
  readonly bulbMaterials: Record<string, MeshBasicMaterial>;
}

export interface StringLightBulb {
  readonly mesh: Mesh;
  readonly material: MeshBasicMaterial;
}

export interface StringLightSpan {
  readonly anchorA: FurnitureAnchor;
  readonly anchorB: FurnitureAnchor;
  readonly group: Group;
  readonly bulbs: StringLightBulb[];
}

export interface LampEraSystem extends EraSystem<{ scene: Object3D | undefined }> {
  readonly group: Group | null;
  readonly lampCount: number;
  readonly stringLightSpans: number;
  readonly currentLampColor: number;
  readonly currentLampIntensity: number;
}

// ---------------------------------------------------------------------------
// Shared geometries (reused across all lamp instances to stay bounded)
// ---------------------------------------------------------------------------

interface SharedGeometries {
  // 1945 Cast iron gas
  pole1945Base: BufferGeometry;
  pole1945Column: BufferGeometry;
  pole1945Lantern: BufferGeometry;
  bulb1945: BufferGeometry;

  // 1965 Gooseneck
  pole1965Main: BufferGeometry;
  pole1965Arm: BufferGeometry;
  bulb1965: BufferGeometry;

  // 1985 Square cobra
  pole1985Main: BufferGeometry;
  pole1985Head: BufferGeometry;
  bulb1985: BufferGeometry;

  // 2005 Modern pole
  pole2005Main: BufferGeometry;
  pole2005Head: BufferGeometry;
  bulb2005: BufferGeometry;

  // 2025 Smart spire
  pole2025Spire: BufferGeometry;
  pole2025Ring: BufferGeometry;
  bulb2025: BufferGeometry;

  // String lights
  stringBulb: BufferGeometry;
}

function createSharedGeometries(): SharedGeometries {
  return {
    pole1945Base: new CylinderGeometry(0.22, 0.28, 0.6, 8),
    pole1945Column: new CylinderGeometry(0.08, 0.12, 3.2, 8),
    pole1945Lantern: new BoxGeometry(0.3, 0.45, 0.3),
    bulb1945: new SphereGeometry(0.1, 8, 6),

    pole1965Main: new CylinderGeometry(0.07, 0.1, 3.8, 8),
    pole1965Arm: new CylinderGeometry(0.04, 0.05, 0.9, 8),
    bulb1965: new SphereGeometry(0.12, 8, 6),

    pole1985Main: new BoxGeometry(0.12, 4.0, 0.12),
    pole1985Head: new BoxGeometry(0.3, 0.12, 0.55),
    bulb1985: new BoxGeometry(0.2, 0.04, 0.35),

    pole2005Main: new CylinderGeometry(0.06, 0.08, 4.2, 10),
    pole2005Head: new BoxGeometry(0.18, 0.06, 0.5),
    bulb2005: new BoxGeometry(0.14, 0.02, 0.35),

    pole2025Spire: new CylinderGeometry(0.04, 0.07, 4.5, 12),
    pole2025Ring: new CylinderGeometry(0.09, 0.09, 0.08, 12),
    bulb2025: new CylinderGeometry(0.045, 0.045, 1.2, 8),

    stringBulb: new SphereGeometry(0.04, 6, 4),
  };
}

function disposeSharedGeometries(geos: SharedGeometries): void {
  for (const key of Object.keys(geos) as (keyof SharedGeometries)[]) {
    geos[key].dispose();
  }
}

// ---------------------------------------------------------------------------
// Per-era pole style builders
// ---------------------------------------------------------------------------

const METAL_COLOR_1945 = 0x27272a; // dark cast iron
const METAL_COLOR_1965 = 0x52525b; // painted steel
const METAL_COLOR_1985 = 0x71717a; // anodized aluminum
const METAL_COLOR_2005 = 0xa1a1aa; // brushed steel
const METAL_COLOR_2025 = 0x1e293b; // matte dark composite

interface BuiltPoleStyle {
  group: Group;
  bulbMaterial: MeshBasicMaterial;
  poleMaterials: Material[];
}

function buildStyle1945(geos: SharedGeometries): BuiltPoleStyle {
  const group = new Group();
  group.name = 'style-1945-gas';
  const poleMaterials: Material[] = [];

  const metalMat = new MeshBasicMaterial({ color: METAL_COLOR_1945 });
  poleMaterials.push(metalMat);

  const baseMesh = new Mesh(geos.pole1945Base, metalMat);
  baseMesh.position.y = 0.3;
  group.add(baseMesh);

  const colMesh = new Mesh(geos.pole1945Column, metalMat);
  colMesh.position.y = 2.0;
  group.add(colMesh);

  const lanternMesh = new Mesh(geos.pole1945Lantern, metalMat);
  lanternMesh.position.y = 3.65;
  group.add(lanternMesh);

  const bulbMat = new MeshBasicMaterial({ color: 0xfef3c7 });
  const bulbMesh = new Mesh(geos.bulb1945, bulbMat);
  bulbMesh.position.y = 3.65;
  group.add(bulbMesh);

  return { group, bulbMaterial: bulbMat, poleMaterials };
}

function buildStyle1965(geos: SharedGeometries): BuiltPoleStyle {
  const group = new Group();
  group.name = 'style-1965-gooseneck';
  const poleMaterials: Material[] = [];

  const metalMat = new MeshBasicMaterial({ color: METAL_COLOR_1965 });
  poleMaterials.push(metalMat);

  const colMesh = new Mesh(geos.pole1965Main, metalMat);
  colMesh.position.y = 1.9;
  group.add(colMesh);

  const armMesh = new Mesh(geos.pole1965Arm, metalMat);
  armMesh.position.set(0, 3.8, -0.35);
  armMesh.rotation.x = Math.PI / 4;
  group.add(armMesh);

  const bulbMat = new MeshBasicMaterial({ color: 0xfed7aa });
  const bulbMesh = new Mesh(geos.bulb1965, bulbMat);
  bulbMesh.position.set(0, 3.7, -0.65);
  group.add(bulbMesh);

  return { group, bulbMaterial: bulbMat, poleMaterials };
}

function buildStyle1985(geos: SharedGeometries): BuiltPoleStyle {
  const group = new Group();
  group.name = 'style-1985-cobra';
  const poleMaterials: Material[] = [];

  const metalMat = new MeshBasicMaterial({ color: METAL_COLOR_1985 });
  poleMaterials.push(metalMat);

  const colMesh = new Mesh(geos.pole1985Main, metalMat);
  colMesh.position.y = 2.0;
  group.add(colMesh);

  const headMesh = new Mesh(geos.pole1985Head, metalMat);
  headMesh.position.set(0, 4.0, -0.2);
  group.add(headMesh);

  const bulbMat = new MeshBasicMaterial({ color: 0xfed7aa });
  const bulbMesh = new Mesh(geos.bulb1985, bulbMat);
  bulbMesh.position.set(0, 3.93, -0.25);
  group.add(bulbMesh);

  return { group, bulbMaterial: bulbMat, poleMaterials };
}

function buildStyle2005(geos: SharedGeometries): BuiltPoleStyle {
  const group = new Group();
  group.name = 'style-2005-modern';
  const poleMaterials: Material[] = [];

  const metalMat = new MeshBasicMaterial({ color: METAL_COLOR_2005 });
  poleMaterials.push(metalMat);

  const colMesh = new Mesh(geos.pole2005Main, metalMat);
  colMesh.position.y = 2.1;
  group.add(colMesh);

  const headMesh = new Mesh(geos.pole2005Head, metalMat);
  headMesh.position.set(0, 4.2, -0.22);
  group.add(headMesh);

  const bulbMat = new MeshBasicMaterial({ color: 0xf8fafc });
  const bulbMesh = new Mesh(geos.bulb2005, bulbMat);
  bulbMesh.position.set(0, 4.16, -0.25);
  group.add(bulbMesh);

  return { group, bulbMaterial: bulbMat, poleMaterials };
}

function buildStyle2025(geos: SharedGeometries): BuiltPoleStyle {
  const group = new Group();
  group.name = 'style-2025-smart-spire';
  const poleMaterials: Material[] = [];

  const metalMat = new MeshBasicMaterial({ color: METAL_COLOR_2025 });
  poleMaterials.push(metalMat);

  const spireMesh = new Mesh(geos.pole2025Spire, metalMat);
  spireMesh.position.y = 2.25;
  group.add(spireMesh);

  const ringMesh = new Mesh(geos.pole2025Ring, metalMat);
  ringMesh.position.y = 3.5;
  group.add(ringMesh);

  const bulbMat = new MeshBasicMaterial({ color: 0xe0f2fe });
  const bulbMesh = new Mesh(geos.bulb2025, bulbMat);
  bulbMesh.position.y = 3.8;
  group.add(bulbMesh);

  return { group, bulbMaterial: bulbMat, poleMaterials };
}

// ---------------------------------------------------------------------------
// Single lamp instance assembly (contains all 5 era pole styles)
// ---------------------------------------------------------------------------

function createLampInstance(
  anchor: FurnitureAnchor,
  geos: SharedGeometries,
  ownedMaterials: Material[],
): LampInstance {
  const root = new Group();
  root.name = `lamp-${anchor.id}`;
  root.position.set(anchor.position.x, 0, anchor.position.z);

  // Rotate lamp post to face the street (anchor.facing).
  const angle = Math.atan2(anchor.facing.x, anchor.facing.z);
  root.rotation.y = angle;

  const style1945 = buildStyle1945(geos);
  const style1965 = buildStyle1965(geos);
  const style1985 = buildStyle1985(geos);
  const style2005 = buildStyle2005(geos);
  const style2025 = buildStyle2025(geos);

  const styles = {
    '1945': style1945,
    '1965': style1965,
    '1985': style1985,
    '2005': style2005,
    '2025': style2025,
  };

  const poleMeshes: Record<string, Group> = {};
  const bulbMaterials: Record<string, MeshBasicMaterial> = {};

  for (const [eraId, built] of Object.entries(styles)) {
    root.add(built.group);
    poleMeshes[eraId] = built.group;
    bulbMaterials[eraId] = built.bulbMaterial;
    ownedMaterials.push(...built.poleMaterials, built.bulbMaterial);
  }

  return {
    anchor,
    root,
    poleMeshes,
    bulbMaterials,
  };
}

// ---------------------------------------------------------------------------
// 2025 festive string lights draped between lamp anchors
// ---------------------------------------------------------------------------

function buildStringLightSpan(
  anchorA: FurnitureAnchor,
  anchorB: FurnitureAnchor,
  geos: SharedGeometries,
  ownedMaterials: Material[],
): StringLightSpan {
  const group = new Group();
  group.name = `stringlights-${anchorA.id}-${anchorB.id}`;

  const bulbs: StringLightBulb[] = [];
  const lampHeight = 4.0;
  const sag = 0.9;
  const bulbCount = 7;

  for (let i = 1; i < bulbCount; i += 1) {
    const t = i / bulbCount;
    const x = anchorA.position.x + (anchorB.position.x - anchorA.position.x) * t;
    const z = anchorA.position.z + (anchorB.position.z - anchorA.position.z) * t;

    // Catenary sag approximation (parabola peaking at 0.5)
    const catenary = 4 * t * (1 - t) * sag;
    const y = lampHeight - catenary;

    const material = new MeshBasicMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.0,
    });
    ownedMaterials.push(material);

    const mesh = new Mesh(geos.stringBulb, material);
    mesh.position.set(x, y, z);
    group.add(mesh);

    bulbs.push({ mesh, material });
  }

  return { anchorA, anchorB, group, bulbs };
}

// ---------------------------------------------------------------------------
// Style cross-fading & scale interpolation
// ---------------------------------------------------------------------------

const ERA_KEYS = ['1945', '1965', '1985', '2005', '2025'] as const;

/**
 * Computes the blend weight [0..1] for each of the five era pole styles
 * given the timeline channel { fromEra, toEra, t }.
 */
function computeStyleWeights(channel: TimelineChannel): Record<string, number> {
  const weights: Record<string, number> = {
    '1945': 0,
    '1965': 0,
    '1985': 0,
    '2005': 0,
    '2025': 0,
  };

  if (channel.fromEra === channel.toEra) {
    weights[channel.fromEra] = 1.0;
    return weights;
  }

  const fromIdx = ERA_KEYS.indexOf(channel.fromEra as (typeof ERA_KEYS)[number]);
  const toIdx = ERA_KEYS.indexOf(channel.toEra as (typeof ERA_KEYS)[number]);

  if (fromIdx < 0 || toIdx < 0) {
    weights['1945'] = 1.0;
    return weights;
  }

  // Smooth cross-fade between the two eras
  weights[channel.fromEra] = 1.0 - channel.t;
  weights[channel.toEra] = channel.t;

  return weights;
}

// ---------------------------------------------------------------------------
// Public LampEraSystem factory
// ---------------------------------------------------------------------------

export function createLampSystem(layout: BlockLayout): LampEraSystem {
  let group: Group | null = null;
  let sharedGeos: SharedGeometries | null = null;
  const ownedMaterials: Material[] = [];
  const lampInstances: LampInstance[] = [];
  const stringSpans: StringLightSpan[] = [];

  let currentLampColor = 0xfef3c7;
  let currentLampIntensity = 0.9;
  let flickerPhase = 0;
  let disposed = false;

  // Filter anchors for street lamps
  const lampAnchors = layout.furniture.filter((f) => f.kind === 'lamp');

  return {
    get group(): Group | null {
      return group;
    },

    get lampCount(): number {
      return lampInstances.length;
    },

    get stringLightSpans(): number {
      return stringSpans.length;
    },

    get currentLampColor(): number {
      return currentLampColor;
    },

    get currentLampIntensity(): number {
      return currentLampIntensity;
    },

    attach(context: { scene: Object3D | undefined }): void {
      if (disposed || group) return;

      group = new Group();
      group.name = 'atmosphere-lamps';
      sharedGeos = createSharedGeometries();

      // 1. Build lamp post instances at each anchor
      for (const anchor of lampAnchors) {
        const instance = createLampInstance(anchor, sharedGeos, ownedMaterials);
        lampInstances.push(instance);
        group.add(instance.root);
      }

      // 2. Build string light spans between consecutive lamps on the same street
      // Street A lamps (lamp-a-1 -> lamp-a-2 -> lamp-a-3)
      const streetALamps = lampAnchors.filter((a) => a.id.startsWith('lamp-a'));
      for (let i = 0; i < streetALamps.length - 1; i += 1) {
        const span = buildStringLightSpan(streetALamps[i], streetALamps[i + 1], sharedGeos, ownedMaterials);
        stringSpans.push(span);
        group.add(span.group);
      }

      // Street B lamps (lamp-b-1 -> lamp-b-2)
      const streetBLamps = lampAnchors.filter((a) => a.id.startsWith('lamp-b'));
      for (let i = 0; i < streetBLamps.length - 1; i += 1) {
        const span = buildStringLightSpan(streetBLamps[i], streetBLamps[i + 1], sharedGeos, ownedMaterials);
        stringSpans.push(span);
        group.add(span.group);
      }

      if (context.scene) {
        context.scene.add(group);
      }

      // Initial update to 1945 defaults
      this.update({ fromEra: '1945', toEra: '1945', t: 0 }, 0);
    },

    update(channel: TimelineChannel, deltaSeconds: number): void {
      if (disposed || !group) return;

      const from = atmosphereEraData[channel.fromEra] ?? atmosphereEraData['1945'];
      const to = atmosphereEraData[channel.toEra] ?? atmosphereEraData['1945'];
      const spec = interpolateEraAtmosphere(from, to, channel.t);

      // Flicker simulation (vintage gas pulse)
      const flickerHz = from.lampFlickerHz + (to.lampFlickerHz - from.lampFlickerHz) * channel.t;
      if (flickerHz > 0.05) {
        flickerPhase += deltaSeconds * flickerHz * Math.PI * 2;
        const flickerMod = 1.0 + Math.sin(flickerPhase) * 0.08 + Math.sin(flickerPhase * 2.7) * 0.04;
        currentLampIntensity = spec.streetLampIntensity * flickerMod;
      } else {
        currentLampIntensity = spec.streetLampIntensity;
      }

      const lampColorObj = toThreeColor(spec.streetLampColor);
      currentLampColor = lampColorObj.getHex();

      // Style cross-fade weights
      const styleWeights = computeStyleWeights(channel);

      // Apply weights, scales, and colors to all lamp instances
      for (const instance of lampInstances) {
        for (const [eraId, poleGroup] of Object.entries(instance.poleMeshes)) {
          const weight = styleWeights[eraId] ?? 0;
          if (weight < 0.001) {
            poleGroup.visible = false;
          } else {
            poleGroup.visible = true;
            // Scale-based pop/morph transition
            const scaleY = 0.85 + weight * 0.15;
            poleGroup.scale.set(weight, scaleY, weight);
          }

          // Update bulb emissive color & intensity (bloom-friendly)
          const bulbMat = instance.bulbMaterials[eraId];
          if (bulbMat) {
            bulbMat.color.copy(lampColorObj);
          }
        }
      }

      // String lights: active only in 2025 (fade in from 2005)
      const stringWeight = styleWeights['2025'] ?? 0;
      for (const span of stringSpans) {
        if (stringWeight < 0.01) {
          span.group.visible = false;
        } else {
          span.group.visible = true;
          for (const bulb of span.bulbs) {
            bulb.material.opacity = stringWeight * 0.9;
          }
        }
      }
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;

      if (group?.parent) {
        group.parent.remove(group);
      }

      if (sharedGeos) {
        disposeSharedGeometries(sharedGeos);
        sharedGeos = null;
      }

      for (const mat of ownedMaterials) {
        mat.dispose();
      }
      ownedMaterials.length = 0;
      lampInstances.length = 0;
      stringSpans.length = 0;
      group = null;
    },
  };
}