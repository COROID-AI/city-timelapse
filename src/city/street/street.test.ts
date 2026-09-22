/**
 * Street module tests: alignment slot constants, era-variant tables, planted
 * prop invariants (no floating/sunken props, no z-fighting), instancing, the
 * documented sound-hook contract, and a composition test that drives the real
 * street system through the real `EraTransformable` registry with the real
 * procedural gfx material library.
 */

import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEraMorphSystem } from '../../era/contracts';
import { ProceduralGfxLibrary } from '../../gfx/materials';
import type { PickableDescriptor } from '../../controls/navigation';
import {
  createStreetPropsModule,
  STREET_HOOK_EVENTS,
  STREET_ERA_HOOKS,
  ROAD_SURFACE_Y,
  STREET_WIDTH,
  CURB_HEIGHT,
  SIDEWALK_WIDTH,
  SIDEWALK_TOP_Y,
  DRIVE_LANE_CENTERS,
  CURB_PARKING_LANE_WIDTH,
  SIDEWALK_WALK_LANE_CENTER,
  STOREFRONT_BAY_SPACING,
  STOREFRONT_BAY_CLEAR_WIDTH,
  STOREFRONT_BAY_BASE_Y,
  STREET_ALIGNMENT,
  roadSurfaceY,
  sidewalkSurfaceY,
  eraIndex,
  eraPropScale,
  STREET_ERAS,
  STREET_PROP_KINDS,
  STREET_PROP_VARIANTS,
  ROAD_SURFACE_VARIANTS,
  STREET_LAYOUT,
  PROP_SURFACE,
  propVariant,
  roadSurfaceVariant,
  erasPresent,
  slotsFor,
} from './index';
import type { StreetHookEvent, StreetPropsModule } from './index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Whether an object and every ancestor up to `stop` is visible. */
function effectivelyVisible(object: THREE.Object3D, stop: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (!current.visible) return false;
    if (current === stop) return true;
    current = current.parent;
  }
  return false;
}

/** Count meshes that actually render inside `root`. */
function visibleMeshCount(root: THREE.Object3D): number {
  let count = 0;
  root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh && effectivelyVisible(object, root)) count += 1;
  });
  return count;
}

/** First mesh material under a named group. */
function materialUnder(root: THREE.Object3D, name: string): THREE.MeshStandardMaterial {
  const group = root.getObjectByName(name);
  expect(group, `missing group ${name}`).toBeTruthy();
  let material: THREE.MeshStandardMaterial | undefined;
  group!.traverse((object) => {
    if (material) return;
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) material = mesh.material as THREE.MeshStandardMaterial;
  });
  expect(material, `no material under ${name}`).toBeTruthy();
  return material!;
}

/** A point lies inside any rectangle of the list. */
function withinAny(
  x: number,
  z: number,
  rects: ReadonlyArray<{ x0: number; x1: number; z0: number; z1: number }>,
): boolean {
  return rects.some((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

let scene: StreetPropsModule;

beforeAll(() => {
  scene = createStreetPropsModule({ seed: 7 });
});

afterAll(() => {
  scene.dispose();
});

// ---------------------------------------------------------------------------
// 1. Canonical alignment slot constants
// ---------------------------------------------------------------------------

describe('street alignment slot constants', () => {
  it('exports the pinned constants exactly as the sibling contracts pin them', () => {
    expect(ROAD_SURFACE_Y).toBe(0);
    expect(STREET_WIDTH).toBe(12);
    expect(CURB_HEIGHT).toBe(0.15);
    expect(SIDEWALK_WIDTH).toBe(3);
    expect(SIDEWALK_TOP_Y).toBe(0.15);
    expect([...DRIVE_LANE_CENTERS]).toEqual([3, 9]);
    expect(CURB_PARKING_LANE_WIDTH).toBe(2);
    expect(SIDEWALK_WALK_LANE_CENTER).toBe(1.5);
    expect(STOREFRONT_BAY_SPACING).toBe(6);
    expect(STOREFRONT_BAY_CLEAR_WIDTH).toBe(5);
    expect(STOREFRONT_BAY_BASE_Y).toBe(0.15);
  });

  it('mirrors every constant through the combined STREET_ALIGNMENT view', () => {
    expect(STREET_ALIGNMENT.roadSurfaceY).toBe(0);
    expect(STREET_ALIGNMENT.streetWidth).toBe(12);
    expect(STREET_ALIGNMENT.curbHeight).toBe(0.15);
    expect(STREET_ALIGNMENT.sidewalkWidth).toBe(3);
    expect(STREET_ALIGNMENT.sidewalkTopY).toBe(0.15);
    expect([...STREET_ALIGNMENT.driveLaneCenters]).toEqual([3, 9]);
    expect(STREET_ALIGNMENT.curbParkingLaneWidth).toBe(2);
    expect(STREET_ALIGNMENT.sidewalkWalkLaneCenter).toBe(1.5);
    expect(STREET_ALIGNMENT.storefrontBaySpacing).toBe(6);
    expect(STREET_ALIGNMENT.storefrontBayClearWidth).toBe(5);
    expect(STREET_ALIGNMENT.storefrontBayBaseY).toBe(0.15);
  });

  it('keeps era surface heights strictly layered above the pinned bases', () => {
    expect(sidewalkSurfaceY(1945)).toBeGreaterThan(SIDEWALK_TOP_Y);
    expect(roadSurfaceY(1945)).toBeGreaterThanOrEqual(ROAD_SURFACE_Y);
    for (let i = 1; i < STREET_ERAS.length; i++) {
      expect(sidewalkSurfaceY(STREET_ERAS[i])).toBeGreaterThan(sidewalkSurfaceY(STREET_ERAS[i - 1]));
      expect(roadSurfaceY(STREET_ERAS[i])).toBeGreaterThan(roadSurfaceY(STREET_ERAS[i - 1]));
    }
    expect(sidewalkSurfaceY(2025) - SIDEWALK_TOP_Y).toBeLessThan(0.02);
    expect(roadSurfaceY(2025)).toBeLessThan(0.02);
  });
});

// ---------------------------------------------------------------------------
// 2. Era variant tables
// ---------------------------------------------------------------------------

describe('street era variants', () => {
  it('pins exactly one descriptor per era for every prop kind', () => {
    for (const kind of STREET_PROP_KINDS) {
      const list = STREET_PROP_VARIANTS[kind];
      expect(list.map((entry) => entry.era), kind).toEqual([...STREET_ERAS]);
      for (const variant of list) {
        if (variant.present) {
          expect(variant.style, `${kind} ${variant.era}`).not.toBe('none');
          expect(variant.height, `${kind} ${variant.era}`).toBeGreaterThan(0);
          expect(variant.detail.length).toBeGreaterThan(10);
        } else {
          expect(variant.style, `${kind} ${variant.era}`).toBe('none');
          expect(variant.height).toBe(0);
        }
      }
    }
  });

  it('evolves hero furniture: booths in the middle eras, meters then chargers, vanishing wires', () => {
    expect(erasPresent('phoneBooth')).toEqual([1965, 1985, 2005]);
    expect(erasPresent('parkingMeter')).toEqual([1965, 1985, 2005]);
    expect(erasPresent('payStation')).toEqual([2005, 2025]);
    expect(erasPresent('evCharger')).toEqual([2025]);
    expect(erasPresent('streetKiosk')).toEqual([2005, 2025]);
    expect(erasPresent('wifiPylon')).toEqual([2025]);
    expect(erasPresent('telegraphPole')).toEqual([1945, 1965, 1985]);
    expect(erasPresent('overheadWires')).toEqual([1945, 1965, 1985]);
    expect(erasPresent('lamp')).toEqual([...STREET_ERAS]);
    expect(erasPresent('hydrant')).toEqual([...STREET_ERAS]);
    expect(erasPresent('scaffolding')).toEqual([...STREET_ERAS]);
  });

  it('gives every era a distinct lamp style: gas/electric 1945 -> LED 2025', () => {
    const styles = STREET_PROP_VARIANTS.lamp.map((entry) => entry.style);
    expect(new Set(styles).size).toBe(5);
    expect(propVariant('lamp', 1945).style).toBe('gas-lantern-electric-mix');
    expect(propVariant('lamp', 1965).style).toBe('ornate-electric-globe');
    expect(propVariant('lamp', 1985).style).toBe('utilitarian-cobra-head');
    expect(propVariant('lamp', 2025).style).toBe('led-column');
  });

  it('varies era trash levels and overhead wire counts over time', () => {
    const fill = (era: 1945 | 1965 | 1985 | 2005 | 2025): number =>
      propVariant('litterBin', era).trashFill ?? -1;
    expect(fill(1985)).toBeGreaterThan(fill(2025));
    expect(fill(1945)).toBeGreaterThan(fill(2025));
    expect(propVariant('overheadWires', 1945).wireCount).toBe(6);
    expect(propVariant('overheadWires', 1985).wireCount).toBe(4);
    expect(propVariant('overheadWires', 2005).wireCount).toBe(0);
  });

  it('evolves roadway surfacing: cobble edges + hand-painted 1945, patches later, tactile 2025', () => {
    const r1945 = roadSurfaceVariant(1945);
    expect(r1945.cobblestoneGutter).toBe(true);
    expect(r1945.markingStyle).toBe('hand-painted');
    expect(r1945.markingJitter).toBeGreaterThan(0);
    expect(r1945.sidewalkPaving).toBe('bluestone-flags');

    expect(roadSurfaceVariant(1965).markingStyle).toBe('thermoplastic');
    expect(ROAD_SURFACE_VARIANTS[1965].surfaceStyle).toContain('patched');
    expect(roadSurfaceVariant(1985).patchCount).toBeGreaterThan(roadSurfaceVariant(2025).patchCount);
    expect(roadSurfaceVariant(1985).markingStyle).toContain('thermoplastic');

    const r2025 = roadSurfaceVariant(2025);
    expect(r2025.tactileCurb).toBe(true);
    expect(r2025.sidewalkPaving).toContain('tactile');
    expect(r2025.cobblestoneGutter).toBe(false);
    expect(r2025.wear).toBeLessThan(r1945.wear);
    expect(r2025.sidewalkPaving).not.toBe(r1945.sidewalkPaving);
  });

  it('keeps every prop slot inside its declared sidewalk or roadway band', () => {
    const strips = STREET_LAYOUT.sidewalkStrips;
    const pieces = STREET_LAYOUT.roadPieces;
    for (const kind of STREET_PROP_KINDS) {
      const surface = PROP_SURFACE[kind];
      for (const slot of slotsFor(kind)) {
        const ok =
          surface === 'sidewalk'
            ? withinAny(slot.x, slot.z, strips)
            : surface === 'road'
              ? withinAny(slot.x, slot.z, pieces)
              : true;
        expect(ok, `${kind} slot (${slot.x}, ${slot.z}) is outside its ${surface} band`).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Built scene invariants: planted props, era lifts, z-fighting policy
// ---------------------------------------------------------------------------

describe('built street scene invariants', () => {
  it('anchors every slot at the pinned base height and lifts era groups by era paving', () => {
    let slotCount = 0;
    scene.root.traverse((object) => {
      if (!object.name.startsWith('slot:')) return;
      slotCount += 1;
      const kind = object.parent?.name.replace('prop:', '');
      const surface = PROP_SURFACE[kind as keyof typeof PROP_SURFACE];
      expect(surface).toBeTruthy();
      const expectedBase = surface === 'sidewalk' ? SIDEWALK_TOP_Y : ROAD_SURFACE_Y;
      expect(object.position.y).toBeCloseTo(expectedBase, 9);

      for (const era of STREET_ERAS) {
        const eraGroup = object.getObjectByName(`era:${era}`);
        if (!eraGroup) continue;
        const surfaceY =
          surface === 'sidewalk' ? sidewalkSurfaceY(era) : roadSurfaceY(era);
        expect(eraGroup.position.y, `${kind} ${era} lift`).toBeCloseTo(surfaceY - expectedBase, 9);
        expect(eraGroup.scale.x, `${kind} ${era} frozen scale`).toBeCloseTo(eraPropScale(era), 9);
      }
    });
    expect(slotCount).toBeGreaterThan(50);
  });

  it('separates era roadway layers geometrically: base at 0, markings above slabs', () => {
    const base = scene.root.getObjectByName('roadway:base') as THREE.Mesh;
    expect(base).toBeTruthy();
    expect(base.position.y).toBe(0);

    let previous = -1;
    for (const era of STREET_ERAS) {
      const surface = scene.root.getObjectByName(`roadway:surface:${era}`) as THREE.Mesh;
      const markings = scene.root.getObjectByName(`roadway:markings:${era}`) as THREE.Mesh;
      const gutter = scene.root.getObjectByName(`roadway:gutter:${era}`) as THREE.Mesh;
      expect(surface, `surface ${era}`).toBeTruthy();
      expect(markings, `markings ${era}`).toBeTruthy();
      expect(gutter, `gutter ${era}`).toBeTruthy();
      expect(surface.position.y).toBeGreaterThan(previous);
      previous = surface.position.y;
      expect(gutter.position.y).toBeGreaterThan(surface.position.y);
      expect(markings.position.y).toBeGreaterThan(gutter.position.y);
      expect(surface.position.y).toBeGreaterThan(0);
    }
  });

  it('applies a distinct polygon offset per era so crossfading layers cannot z-fight', () => {
    for (const era of STREET_ERAS) {
      const material = materialUnder(scene.root, `roadway:surface:${era}`);
      expect(material.polygonOffset, `polygonOffset ${era}`).toBe(true);
      expect(material.polygonOffsetFactor).toBe(-(eraIndex(era) + 1));
      expect(material.polygonOffsetUnits).toBe(-(eraIndex(era) + 1));
      expect(material.transparent).toBe(true);
    }
  });

  it('renders repeated props with instancing (bins, meters, chargers, bollards, poles)', () => {
    const checks: Array<[string, number]> = [
      ['litterBin:instances:1985', slotsFor('litterBin').length],
      ['parkingMeter:instances:1965', slotsFor('parkingMeter').length],
      ['evCharger:instances:2025', slotsFor('evCharger').length],
      ['bollard:instances:1945', slotsFor('bollard').length],
      ['telegraphPole:instances:1985', slotsFor('telegraphPole').length],
    ];
    for (const [name, count] of checks) {
      const mesh = scene.root.getObjectByName(name) as THREE.InstancedMesh | undefined;
      expect(mesh, name).toBeTruthy();
      expect(mesh!.isInstancedMesh, name).toBe(true);
      expect(mesh!.count, name).toBe(count);
    }
  });

  it('keeps overhead wires out of the furniture channel slots (global spans only)', () => {
    const wires = scene.root.getObjectByName('prop:overheadWires');
    expect(wires).toBeTruthy();
    expect(slotsFor('overheadWires').length).toBe(0);
    // Built only for eras that carry wires.
    expect(wires!.getObjectByName('era:1945')).toBeTruthy();
    expect(wires!.getObjectByName('era:2025')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Direct era crossfade behavior
// ---------------------------------------------------------------------------

describe('era crossfade (direct applyEraBlend)', () => {
  it('crossfades adjacent era layers with weights summing to one', () => {
    scene.applyEraBlend({ from: 1945, to: 1965, fraction: 0.5 }, 0, 1);

    const weights = scene.weights();
    expect(weights[1945]).toBeCloseTo(0.5, 10);
    expect(weights[1965]).toBeCloseTo(0.5, 10);
    const sum = STREET_ERAS.reduce((acc, era) => acc + weights[era], 0);
    expect(sum).toBeCloseTo(1, 10);

    expect(scene.root.getObjectByName('roadway:era:1945')!.visible).toBe(true);
    expect(scene.root.getObjectByName('roadway:era:1965')!.visible).toBe(true);
    expect(scene.root.getObjectByName('roadway:era:1985')!.visible).toBe(false);

    const mat1945 = materialUnder(scene.root, 'roadway:surface:1945');
    const mat1965 = materialUnder(scene.root, 'roadway:surface:1965');
    expect(mat1945.opacity).toBeCloseTo(0.5, 6);
    expect(mat1965.opacity).toBeCloseTo(0.5, 6);
  });

  it('reveals the phone booth only in its middle eras', () => {
    const booth = scene.root.getObjectByName('prop:phoneBooth')!;
    const charger = scene.root.getObjectByName('prop:evCharger')!;

    scene.applyEraBlend({ from: 1945, to: 1965, fraction: 0 }, 0, 1);
    expect(visibleMeshCount(booth)).toBe(0); // absent in 1945
    expect(visibleMeshCount(charger)).toBe(0); // no chargers before 2025

    scene.applyEraBlend({ from: 1965, to: 1985, fraction: 0 }, 0, 1);
    expect(visibleMeshCount(booth)).toBeGreaterThan(0); // present in 1965
    expect(visibleMeshCount(charger)).toBe(0); // still no chargers

    scene.applyEraBlend({ from: 2005, to: 2025, fraction: 1 }, 0, 1);
    expect(visibleMeshCount(booth)).toBe(0); // removed by 2025
    expect(visibleMeshCount(charger)).toBeGreaterThan(0); // chargers arrived
    expect(charger.getObjectByName('era:2025')!.visible).toBe(true);

    // Restore the starting era for later reads.
    scene.applyEraBlend({ from: 1945, to: 1965, fraction: 0 }, 0, 1);
  });

  it('never floats or sinks props: every prop base sits exactly on its era paving', () => {
    scene.applyEraBlend({ from: 1965, to: 1985, fraction: 0 }, 0, 1);
    const booth = scene.root.getObjectByName('prop:phoneBooth')!;
    const slot = booth.getObjectByName('slot:0')!;
    expect(slot.position.y).toBeCloseTo(SIDEWALK_TOP_Y, 9);
    const era1965 = slot.getObjectByName('era:1965')!;
    expect(slot.position.y + era1965.position.y).toBeCloseTo(sidewalkSurfaceY(1965), 9);
    expect(era1965.visible).toBe(true);
    scene.applyEraBlend({ from: 1945, to: 1965, fraction: 0 }, 0, 1);
  });
});

// ---------------------------------------------------------------------------
// 5. Composition with the real contracts and the real gfx library
// ---------------------------------------------------------------------------

describe('composition with real era contract and gfx library', () => {
  it('uses the real ProceduralGfxLibrary (era materials with procedural textures)', () => {
    const probe = ProceduralGfxLibrary.createEraMaterial('metal', 1965);
    expect(probe).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(probe.map).toBeTruthy();
    expect(ProceduralGfxLibrary.ERA_YEARS).toEqual([...STREET_ERAS]);
    const texture = ProceduralGfxLibrary.createProceduralTexture('asphalt', {
      primaryColor: '#3e4045',
      seed: 9,
    });
    expect(texture).toBeTruthy();
  });

  it('registers staged street targets into the real EraTransformable registry', () => {
    const system = createEraMorphSystem();
    const module = createStreetPropsModule({ registry: system.registry, seed: 11 });

    expect(system.registry.size).toBe(3);
    expect(system.registry.members.map((member) => member.stage)).toEqual([
      'facade',
      'fleet',
      'lights',
    ]);
    for (const target of module.transformables) {
      expect(system.registry.has(target)).toBe(true);
    }
    expect(module.stage).toBe('facade');
    expect(module.weights()[1945]).toBeCloseTo(1, 10);

    module.dispose();
    expect(system.registry.size).toBe(0);
    system.registry.clear();
  });

  it('exposes pickable hero descriptors compatible with navigation', () => {
    const module = createStreetPropsModule({ seed: 13 });
    const ids = module.pickables.map((pickable) => pickable.id);
    expect(ids).toContain('street:phone-booth');
    expect(ids).toContain('street:ev-charger');
    expect(ids).toContain('street:pay-station');
    expect(ids).toContain('street:wifi-pylon');
    expect(ids).toContain('street:street-kiosk');
    expect(ids).toContain('street:bus-stop');

    const booth = module.pickables.find((pickable) => pickable.kind === 'phoneBooth')!;
    expect([...booth.eras]).toEqual([1965, 1985, 2005]);
    expect(booth.label).toContain('booth');
    expect(booth.focusDistance).toBeGreaterThan(0);

    // Compile-time structural compatibility with the navigation registry.
    const navDescriptor: PickableDescriptor = booth;
    expect(navDescriptor.id).toBe(booth.id);
    expect(navDescriptor.object).toBe(booth.object);

    const charger = module.pickables.find((pickable) => pickable.kind === 'evCharger')!;
    expect([...charger.eras]).toEqual([2025]);
    expect(module.root.getObjectByName('prop:evCharger')).toBe(charger.object);

    module.dispose();
  });

  it('drives a full 1945 -> 2025 transition through the real driver and settles on 2025', () => {
    const system = createEraMorphSystem();
    const module = createStreetPropsModule({ registry: system.registry, seed: 17 });

    const events: StreetHookEvent[] = [];
    const unsubscribe = module.onHook((event) => events.push(event));

    // Era-correct starting state.
    expect(visibleMeshCount(module.root.getObjectByName('prop:overheadWires')!)).toBeGreaterThan(0);
    expect(visibleMeshCount(module.root.getObjectByName('prop:evCharger')!)).toBe(0);

    const snapped = system.driver.transitionTo(2025);
    expect(snapped).toBe(2025);

    let guard = 0;
    while (system.driver.isTransitioning && ++guard < 600) {
      system.driver.advance(1 / 60);
    }
    expect(guard).toBeLessThan(600);
    expect(system.driver.isTransitioning).toBe(false);

    // Weights settled on the final era.
    const weights = module.weights();
    expect(weights[2025]).toBeCloseTo(1, 10);
    expect(weights[1945]).toBeCloseTo(0, 10);

    // Phone booth swapped out, EV chargers swapped in (5 instanced slots,
    // rendered as two instanced meshes: body + glowing screens/ring).
    const booth = module.root.getObjectByName('prop:phoneBooth')!;
    expect(visibleMeshCount(booth)).toBe(0);
    const charger = module.root.getObjectByName('prop:evCharger')!;
    expect(visibleMeshCount(charger)).toBe(2);
    const chargerMesh = charger.getObjectByName('evCharger:instances:2025') as THREE.InstancedMesh;
    expect(chargerMesh.isInstancedMesh).toBe(true);
    expect(chargerMesh.count).toBe(5);

    // Telegraph poles and overhead wires vanished.
    expect(visibleMeshCount(module.root.getObjectByName('prop:telegraphPole')!)).toBe(0);
    expect(visibleMeshCount(module.root.getObjectByName('prop:overheadWires')!)).toBe(0);

    // Lamps are the 2025 LED era.
    const lamp = module.root.getObjectByName('prop:lamp')!;
    let lamp2025Visible = false;
    lamp.traverse((object) => {
      if (object.name === 'era:2025' && object.visible) lamp2025Visible = true;
    });
    expect(lamp2025Visible).toBe(true);

    // Documented hook events fired along the way for the audio task.
    const names = events.map((event) => event.name);
    expect(names).toContain('street:charger:connect');
    expect(names).toContain('street:kiosk:chime');
    expect(names).toContain('street:lamp:hum');
    expect(names).toContain('street:booth:ring');
    expect(names).toContain('street:construction:clank');
    for (const event of events) {
      expect(STREET_HOOK_EVENTS).toContain(event.name);
    }
    unsubscribe();

    // Unregister and dispose cleanly.
    system.registry.clear();
    expect(system.registry.size).toBe(0);
    module.dispose();
    expect(module.root.children.length).toBe(0);
    module.dispose(); // idempotent
  });

  it('staggers the real choreography: roadway settles before furniture, lighting last', () => {
    const system = createEraMorphSystem();
    const module = createStreetPropsModule({ registry: system.registry, seed: 19 });

    system.driver.transitionTo(1985);

    // Advance until the overall eased progress is inside the fleet window
    // (2/6..3/6): the facade stage has finished, the lights stage has not
    // opened, and furniture is mid-ease.
    let guard = 0;
    let progress = 0;
    do {
      const frame = system.driver.advance(1 / 60);
      progress = frame.progress;
    } while (progress < 0.42 && system.driver.isTransitioning && ++guard < 600);
    expect(progress).toBeGreaterThanOrEqual(0.42);
    expect(progress).toBeLessThan(0.6);

    // Roadway (facade) already tracks the live blend: 1945 weight < 1.
    const road1945 = materialUnder(module.root, 'roadway:surface:1945');
    expect(road1945.opacity).toBeLessThan(0.99);

    // Furniture (fleet) is mid-ease: partially faded but not finished.
    const bench = module.root.getObjectByName('prop:bench')!;
    const bench1945Slot = bench.getObjectByName('slot:0')!;
    const bench1945 = bench1945Slot.getObjectByName('era:1945')!;
    const benchMaterial = bench1945.children[0] as THREE.Mesh;
    const benchOpacity = (benchMaterial.material as THREE.MeshStandardMaterial).opacity;
    expect(benchOpacity).toBeLessThan(0.99);
    expect(benchOpacity).toBeGreaterThan(0);

    // Lighting (lights) has not started: 1945 lamps still at full weight,
    // and the 1965 lamp variant is still hidden.
    const lamp = module.root.getObjectByName('prop:lamp')!;
    const lampSlot = lamp.getObjectByName('slot:0')!;
    const lamp1945 = lampSlot.getObjectByName('era:1945')!;
    const lampMaterial = lamp1945.children[0] as THREE.Mesh;
    expect((lampMaterial.material as THREE.MeshStandardMaterial).opacity).toBeCloseTo(1, 6);
    expect(lampSlot.getObjectByName('era:1965')!.visible).toBe(false);

    // Finish the transition; everything must land on 1985 exactly.
    guard = 0;
    while (system.driver.isTransitioning && ++guard < 600) system.driver.advance(1 / 60);
    const weights = module.weights();
    expect(weights[1985]).toBeCloseTo(1, 10);
    expect((lampMaterial.material as THREE.MeshStandardMaterial).opacity).toBeLessThan(0.99);

    module.dispose();
    system.registry.clear();
  });
});

// ---------------------------------------------------------------------------
// 6. Documented hook event contract
// ---------------------------------------------------------------------------

describe('street sound-hook contract', () => {
  it('documents namespaced events with per-era channel mappings', () => {
    expect(STREET_HOOK_EVENTS.length).toBeGreaterThan(0);
    for (const name of STREET_HOOK_EVENTS) {
      expect(name.startsWith('street:')).toBe(true);
    }
    expect([...STREET_HOOK_EVENTS]).toEqual([...new Set(STREET_HOOK_EVENTS)]);

    expect(Object.keys(STREET_ERA_HOOKS).map(Number).sort()).toEqual([...STREET_ERAS]);
    for (const era of STREET_ERAS) {
      const mapping = STREET_ERA_HOOKS[era];
      for (const channel of ['lighting', 'furniture'] as const) {
        for (const name of mapping[channel]) {
          expect(STREET_HOOK_EVENTS, `${era} ${channel} ${name}`).toContain(name);
        }
      }
    }

    expect(STREET_ERA_HOOKS[1945].lighting).toContain('street:lamp:ignite');
    expect(STREET_ERA_HOOKS[1945].lighting).toContain('street:wire:creak');
    expect(STREET_ERA_HOOKS[1985].furniture).toContain('street:trash:settle');
    expect(STREET_ERA_HOOKS[2025].furniture).toContain('street:charger:connect');
    expect(STREET_ERA_HOOKS[2025].furniture).toContain('street:kiosk:chime');

    // Lamp events belong to lighting; booth/charger events to furniture.
    const lightingNames = new Set(STREET_ERAS.flatMap((era) => STREET_ERA_HOOKS[era].lighting));
    expect(lightingNames.has('street:booth:ring')).toBe(false);
    expect(lightingNames.has('street:charger:connect')).toBe(false);
  });

  it('re-arms eras when the timeline scrubs away and back', () => {
    const system = createEraMorphSystem();
    const module = createStreetPropsModule({ registry: system.registry, seed: 23 });
    const events: StreetHookEvent[] = [];
    const unsubscribe = module.onHook((event) => events.push(event));

    const driveTo = (year: number): void => {
      system.driver.transitionTo(year);
      let guard = 0;
      while (system.driver.isTransitioning && ++guard < 600) system.driver.advance(1 / 60);
    };

    driveTo(1965);
    const firstPass = events.filter((event) => event.name === 'street:booth:ring').length;
    expect(firstPass).toBeGreaterThan(0);

    driveTo(1945);
    driveTo(1965);
    const secondPass = events.filter((event) => event.name === 'street:booth:ring').length;
    expect(secondPass).toBeGreaterThan(firstPass);
    unsubscribe();

    module.dispose();
    system.registry.clear();
  });
});
