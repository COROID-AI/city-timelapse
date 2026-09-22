/**
 * Era-evolving rooftop worlds: wooden water tanks and brick chimneys give way
 * to HVAC plants, satellite dishes, cell gear and antennas, then to
 * photovoltaic arrays and green terraces. Billboards ride the 1985/2005 roofs.
 *
 * Each era owns one roof layer group under an anchor that rides the current
 * massing height, so rooftop clutter follows the morphing roofline every
 * frame. Layer materials crossfade by era weight (never below the visibility
 * epsilon), props settle with the stage-local detail weight, and every
 * material carries the era polygon offset so overlapping rooflines never
 * z-fight. Solar arrays are instanced for cheap repetition.
 */

import * as THREE from 'three';
import {
  BUILDING_ERAS,
  ERA_TREATMENTS,
  applyLayerWeight,
  eraIndexOf,
  frontGeometryFor,
  lotDepth,
  lotWidth,
  type BuildingBuildContext,
  type BuildingEraYear,
  type BuildingLot,
  type BuildingMaterialCategory,
  type BuildingMaterialOptions,
  type EraLayerView,
  type FrontGeometry,
} from './variants';
import type { FacadeFrame } from './facades';

export interface RooftopRig {
  /** Anchor whose y follows the continuous massing top. */
  readonly anchor: THREE.Group;
  readonly layers: readonly EraLayerView[];
  /** Apply one transition frame: follow the roofline, crossfade, settle. */
  apply(frame: FacadeFrame): void;
}

function renderOrderFor(era: BuildingEraYear, channel: 0 | 2): number {
  return eraIndexOf(era) * 10 + channel;
}

/** Free scatter spots (normalized -1..1 of the half footprint). */
const SCATTER_SPOTS: ReadonlyArray<readonly [number, number]> = [
  [-0.72, -0.6],
  [0.68, 0.52],
  [-0.6, 0.55],
  [0.62, -0.58],
  [0.05, -0.05],
  [-0.25, 0.2],
  [0.3, 0.3],
  [-0.05, 0.7],
];

/** Side-margin spots used when solar arrays + green decks claim the middle. */
const MARGIN_SPOTS: ReadonlyArray<readonly [number, number]> = [
  [0.95, 0],
  [-0.95, 0],
  [0.95, -0.4],
  [-0.95, -0.4],
];

/**
 * Build the rooftop rig for one lot: per-era layer groups full of water
 * tanks, chimneys, vents, HVAC units, dishes, cell gear, antennas, billboards,
 * skylights, instanced solar arrays, and green terraces.
 */
export function createRooftop(
  lot: BuildingLot,
  ctx: BuildingBuildContext,
): RooftopRig {
  const { library } = ctx;
  const width = lotWidth(lot);
  const depth = lotDepth(lot);
  const front: FrontGeometry = frontGeometryFor(lot, lot.fronts[0]);

  const anchor = new THREE.Group();
  anchor.name = `roof-anchor:${lot.id}`;
  anchor.userData = { part: 'roof-anchor' };

  const layers: Array<
    EraLayerView & { dynamics: THREE.Mesh[] }
  > = [];

  for (const era of BUILDING_ERAS) {
    const treatment = ERA_TREATMENTS[era];
    const roof = treatment.roof;
    const group = new THREE.Group();
    group.name = `roof:${era}`;
    group.userData = { part: 'roof-layer', era };
    const materials = new Set<THREE.MeshStandardMaterial>();
    const dynamics: THREE.Mesh[] = [];
    const order = renderOrderFor(era, 0);

    const use = (
      category: BuildingMaterialCategory,
      options?: BuildingMaterialOptions,
    ): THREE.MeshStandardMaterial => {
      const material = ctx.materials.get(era, category, options);
      materials.add(material);
      return material;
    };

    const spot = (index: number): [number, number] => {
      const list = roof.solarArrays || roof.greenTerrace ? MARGIN_SPOTS : SCATTER_SPOTS;
      const [u, v] = list[index % list.length];
      return [
        u * (width / 2 - 1.4) + (ctx.random() - 0.5) * 0.4,
        v * (depth / 2 - 1.4) + (ctx.random() - 0.5) * 0.4,
      ];
    };

    const addProp = (
      name: string,
      geometry: THREE.BufferGeometry,
      material: THREE.MeshStandardMaterial,
      x: number,
      z: number,
      rotationY = 0,
      castShadow = true,
    ): THREE.Mesh => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = name;
      mesh.position.set(x, 0, z);
      mesh.rotation.y = rotationY;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      mesh.renderOrder = order;
      mesh.userData = { part: name.split(':')[0], era };
      group.add(mesh);
      dynamics.push(mesh);
      return mesh;
    };

    const accessory = (
      type: 'water-tower' | 'chimney' | 'vent' | 'hvac' | 'skylight',
      scale: number,
      namePrefix: string,
      count: number,
      material: THREE.MeshStandardMaterial,
    ): void => {
      if (count <= 0) return;
      const geometry = ctx.geometry(`roof-acc:${type}:${scale}`, () =>
        library.createRoofAccessoryGeometry({ type, scale }),
      );
      for (let i = 0; i < count; i++) {
        const [x, z] = spot(i);
        addProp(`${namePrefix}:${era}:${i}`, geometry, material, x, z);
      }
    };

    // --- Historic era: water tanks + chimneys ------------------------------
    const masonry = use('masonryConcrete', { repeatX: 2, repeatY: 2, seed: era + 41 });
    const metal = use('metal', { seed: era + 43 });
    const wood = use('wood', { seed: era + 47 });

    accessory('water-tower', 0.85, 'roof-water-tank', roof.waterTanks, wood);
    accessory('chimney', 1, 'roof-chimney', roof.chimneys, masonry);
    accessory('vent', 1, 'roof-vent', roof.vents, metal);
    accessory('hvac', 0.75, 'roof-hvac', roof.hvacUnits, metal);
    const skylightMaterial = use('glass', { seed: era + 53 });
    accessory('skylight', 0.9, 'roof-skylight', roof.skylights, skylightMaterial);

    // --- Satellite dishes --------------------------------------------------
    if (roof.satelliteDishes > 0) {
      const dishGeo = ctx.geometry('roof-dish', () => {
        const dome = new THREE.SphereGeometry(0.55, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.3);
        dome.rotateX(-1.05);
        dome.translate(0, 1.0, 0);
        const mast = new THREE.CylinderGeometry(0.05, 0.07, 0.9, 8);
        mast.translate(0, 0.45, 0);
        const arm = new THREE.CylinderGeometry(0.025, 0.025, 0.55, 6);
        arm.rotateX(Math.PI / 2.6);
        arm.translate(0, 1.05, 0.28);
        const tip = new THREE.SphereGeometry(0.06, 8, 6);
        tip.translate(0, 1.25, 0.5);
        return library.mergeBufferGeometries([dome, mast, arm, tip]);
      });
      for (let i = 0; i < roof.satelliteDishes; i++) {
        const [x, z] = spot(i + 2);
        addProp(`roof-dish:${era}:${i}`, dishGeo, metal, x, z, ctx.random() * Math.PI);
      }
    }

    // --- Cellular base-station gear ----------------------------------------
    if (roof.cellGear > 0) {
      const cellGeo = ctx.geometry('roof-cell-gear', () => {
        const mast = new THREE.CylinderGeometry(0.07, 0.09, 1.8, 8);
        mast.translate(0, 0.9, 0);
        const parts: THREE.BufferGeometry[] = [mast];
        for (let i = 0; i < 3; i++) {
          const panel = new THREE.BoxGeometry(0.5, 0.9, 0.08);
          panel.translate(0, 1.45, 0.32);
          panel.rotateY((i * Math.PI * 2) / 3);
          parts.push(panel);
        }
        const radio = new THREE.BoxGeometry(0.32, 0.22, 0.2);
        radio.translate(0.2, 0.4, 0);
        parts.push(radio);
        return library.mergeBufferGeometries(parts);
      });
      const [x, z] = spot(4);
      addProp(`roof-cell-gear:${era}`, cellGeo, metal, x, z);
    }

    // --- Antenna masts ------------------------------------------------------
    if (roof.antennas > 0) {
      const antennaGeo = ctx.geometry('roof-antenna', () => {
        const mast = new THREE.CylinderGeometry(0.03, 0.05, 2.6, 6);
        mast.translate(0, 1.3, 0);
        const parts: THREE.BufferGeometry[] = [mast];
        for (let i = 0; i < 3; i++) {
          const bar = new THREE.BoxGeometry(0.75 - i * 0.15, 0.03, 0.03);
          bar.rotateY(i * Math.PI / 3);
          bar.translate(0, 1.7 + i * 0.3, 0);
          parts.push(bar);
        }
        const base = new THREE.BoxGeometry(0.3, 0.12, 0.3);
        base.translate(0, 0.06, 0);
        parts.push(base);
        return library.mergeBufferGeometries(parts);
      });
      for (let i = 0; i < roof.antennas; i++) {
        const [x, z] = spot(i + 5);
        addProp(`roof-antenna:${era}:${i}`, antennaGeo, metal, x, z);
      }
    }

    // --- Rooftop billboards (1985 / 2005) ----------------------------------
    if (roof.billboard) {
      const bw = Math.min(8, Math.max(5, (front.axis === 'x' ? width : depth) * 0.5));
      const bh = 2.6;
      const signage = use('paintSignage', { seed: era + 59, repeatX: 1, repeatY: 1 });
      const panelGeo = ctx.geometry(`roof-billboard-panel:${bw}`, () => {
        const panel = new THREE.BoxGeometry(bw, bh, 0.12);
        panel.translate(0, 1.8 + bh / 2, 0);
        const rimTop = new THREE.BoxGeometry(bw + 0.16, 0.12, 0.2);
        rimTop.translate(0, 1.8 + bh + 0.06, 0);
        const rimBottom = rimTop.clone();
        rimBottom.translate(0, -(bh + 0.12), 0);
        return library.mergeBufferGeometries([panel, rimTop, rimBottom]);
      });
      const trussGeo = ctx.geometry(`roof-billboard-truss:${bw}`, () => {
        const parts: THREE.BufferGeometry[] = [];
        for (const side of [-1, 1]) {
          const leg = new THREE.BoxGeometry(0.14, 1.9, 0.14);
          leg.translate(side * (bw / 2 - 0.5), 0.95, 0);
          parts.push(leg);
          const brace = new THREE.BoxGeometry(0.1, 1.4, 0.1);
          brace.rotateZ(side * 0.6);
          brace.translate(side * (bw / 2 - 1.4), 0.8, 0);
          parts.push(brace);
        }
        const beam = new THREE.BoxGeometry(bw, 0.12, 0.12);
        beam.translate(0, 1.82, 0);
        parts.push(beam);
        return library.mergeBufferGeometries(parts);
      });

      const bx = front.axis === 'x' ? 0 : front.plane + (front.axis === 'z' ? -front.normal[0] * 0.8 : 0);
      const bz = front.axis === 'x' ? front.plane - front.normal[2] * 0.8 : 0;
      addProp(`roof-billboard-truss:${era}`, trussGeo, metal, bx, bz, front.rotationY);
      const panelMesh = addProp(`roof-billboard:${era}`, panelGeo, signage, bx, bz, front.rotationY);
      panelMesh.position.y = 0;
    }

    // --- Photovoltaic arrays (2025) — instanced panels ----------------------
    if (roof.solarArrays) {
      const panelGeo = ctx.geometry('roof-solar-panel', () => {
        const plate = new THREE.BoxGeometry(1.9, 0.05, 1.05);
        plate.rotateX(-0.5);
        plate.translate(0, 0.66, 0);
        const rail = new THREE.BoxGeometry(1.95, 0.06, 0.06);
        rail.rotateX(-0.5);
        rail.translate(0, 0.5, 0);
        const cross = new THREE.BoxGeometry(1.7, 0.05, 0.05);
        cross.translate(0, 0.2, 0);
        const parts: THREE.BufferGeometry[] = [plate, rail, cross];
        for (const sx of [-0.78, 0.78]) {
          for (const sz of [-0.36, 0.36]) {
            const leg = new THREE.BoxGeometry(0.05, 0.5, 0.05);
            leg.translate(sx, 0.25, sz + 0.1);
            parts.push(leg);
          }
        }
        return library.mergeBufferGeometries(parts);
      });
      const panelMaterial = use('glass', {
        tint: '#223355',
        seed: era + 61,
        baseOpacity: 1,
      });

      const cols = Math.max(2, Math.floor(((front.axis === 'x' ? width : depth) - 2.5) / 2.2));
      const rows = Math.max(
        1,
        Math.min(3, Math.floor(((front.axis === 'x' ? depth : width) - 2.5) / 1.6)),
      );
      const count = cols * rows;
      const solarMesh = library.createInstancedMesh({
        geometry: panelGeo,
        material: panelMaterial,
        count,
        name: `roof-solar:${era}`,
        dynamic: false,
        castShadow: true,
        receiveShadow: true,
        colors: false,
      });
      solarMesh.frustumCulled = false;
      solarMesh.renderOrder = renderOrderFor(era, 0);
      solarMesh.userData = { part: 'roof-solar', era };

      // Solar band sits on the half of the roof away from the street.
      const back = -1 * (front.axis === 'x' ? front.normal[2] : front.normal[0]);
      const centerX = front.axis === 'x' ? 0 : back * (width / 4);
      const centerZ = front.axis === 'x' ? back * (depth / 4) : 0;
      solarMesh.position.set(centerX, 0, centerZ);
      solarMesh.rotation.y = front.rotationY;

      let index = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const along = (c - (cols - 1) / 2) * 2.2;
          const across = (r - (rows - 1) / 2) * 1.5;
          const position: [number, number, number] =
            front.axis === 'x' ? [along, 0, across] : [across, 0, along];
          library.setInstanceTransform(solarMesh, index, { position });
          index += 1;
        }
      }
      group.add(solarMesh);
      dynamics.push(solarMesh);
    }

    // --- Green terrace (2025): lawn deck, planters, shrubs ------------------
    if (roof.greenTerrace) {
      const lawnW = (front.axis === 'x' ? width : depth) - 2.6;
      const lawnD = Math.max(2.4, (front.axis === 'x' ? depth : width) * 0.3);
      const toward = front.axis === 'x' ? front.normal[2] : front.normal[0];
      const deckCenterX = front.axis === 'x' ? 0 : toward * (width / 4);
      const deckCenterZ = front.axis === 'x' ? toward * (depth / 4) : 0;

      const deckGeo = ctx.geometry(`roof-green-deck:${lot.id}`, () => {
        const deck =
          front.axis === 'x'
            ? new THREE.BoxGeometry(lawnW, 0.12, lawnD)
            : new THREE.BoxGeometry(lawnD, 0.12, lawnW);
        deck.translate(0, 0.06, 0);
        return deck;
      });
      const lawnMaterial = use('grimeSoil', {
        tint: '#8fbf7a',
        seed: era + 67,
        repeatX: 3,
        repeatY: 2,
      });
      const deckMesh = addProp(
        `roof-green-deck:${era}`,
        deckGeo,
        lawnMaterial,
        deckCenterX,
        deckCenterZ,
      );
      deckMesh.position.y = 0;

      const planterGeo = ctx.geometry('roof-planters', () => {
        const parts: THREE.BufferGeometry[] = [];
        for (let i = 0; i < 4; i++) {
          const box = new THREE.BoxGeometry(1.1, 0.5, 0.7);
          box.translate((i - 1.5) * 1.5, 0.25, 0);
          parts.push(box);
        }
        return library.mergeBufferGeometries(parts);
      });
      const planterMaterial = use('masonryConcrete', {
        tint: '#9a968c',
        seed: era + 71,
        repeatX: 1,
        repeatY: 1,
      });
      const planter = addProp(
        `roof-planters:${era}`,
        planterGeo,
        planterMaterial,
        deckCenterX,
        deckCenterZ,
      );
      planter.position.y = 0.12;
      planter.rotation.y = front.axis === 'x' ? 0 : Math.PI / 2;

      const shrubGeo = ctx.geometry('roof-shrubs', () => {
        const parts: THREE.BufferGeometry[] = [];
        for (let i = 0; i < 6; i++) {
          const radius = 0.3 + (i % 3) * 0.08;
          const shrub = new THREE.SphereGeometry(radius, 10, 8);
          shrub.translate((i - 2.5) * 0.9, 0.45 + (i % 2) * 0.12, ((i % 3) - 1) * 0.5);
          parts.push(shrub);
        }
        return library.mergeBufferGeometries(parts);
      });
      const shrubMaterial = use('grimeSoil', {
        tint: '#5f9e4f',
        seed: era + 73,
      });
      const shrubs = addProp(
        `roof-shrubs:${era}`,
        shrubGeo,
        shrubMaterial,
        deckCenterX,
        deckCenterZ,
      );
      shrubs.position.y = 0.12;
    }

    anchor.add(group);
    layers.push({ era, group, materials: [...materials], dynamics });
  }

  const rig: RooftopRig = {
    anchor,
    layers,
    apply(frame: FacadeFrame): void {
      anchor.position.y = frame.topTotal;
      for (const layer of layers) {
        const weight = frame.weights.get(layer.era) ?? 0;
        applyLayerWeight(layer, weight);
        if (!layer.group.visible) continue;
        const detail = frame.detail.get(layer.era) ?? 0;
        const settle = 0.9 + 0.1 * detail;
        for (const mesh of layer.dynamics) {
          mesh.scale.setScalar(settle);
        }
      }
    },
  };
  return rig;
}
