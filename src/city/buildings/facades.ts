/**
 * Era-evolving facades: massing skins, instanced window grids with era
 * glazing, ornate cornices, lintels, stone sills, iron fire escapes, window
 * air-conditioners, entrances with awning frames, ghost-sign remnants, and the
 * ground-floor storefront bay frames the storefront module mates with.
 *
 * Every visual element belongs to exactly one era layer. During a transition
 * only the two adjacent layers are visible and their materials crossfade by
 * era weight; era-indexed polygon offsets keep coincident skins from
 * z-fighting, and layers below the visibility epsilon are hidden outright so
 * nothing pops. The upper massing volume scales continuously with the blend so
 * heights morph smoothly instead of snapping.
 *
 * Windows, lintels, air-conditioners, and fire-escape parts are InstancedMesh
 * repetitions (one draw call per part per era per building) to keep the block
 * near 60fps.
 */

import * as THREE from 'three';
import {
  BLOCK_ALIGNMENT,
  BUILDING_ERAS,
  ERA_TREATMENTS,
  FIRST_WINDOW_Y,
  PARAPET_HEIGHT,
  STORY_HEIGHT,
  STOREFRONT_OPENING_HEIGHT,
  WALL_TEXTURE_REPEAT,
  applyLayerWeight,
  baseHeightFor,
  eraIndexOf,
  frontGeometryFor,
  lotWidth,
  lotDepth,
  pastelTintFor,
  slotCenterLocal,
  windowRowsFor,
  type BuildingBuildContext,
  type BuildingEraYear,
  type BuildingLot,
  type BuildingMaterialCategory,
  type BuildingMaterialOptions,
  type EraLayerView,
  type FrontGeometry,
} from './variants';

/** One animation frame handed to the facade and rooftop rigs. */
export interface FacadeFrame {
  readonly weights: ReadonlyMap<BuildingEraYear, number>;
  readonly detail: ReadonlyMap<BuildingEraYear, number>;
  /** Continuous top-section height above the common base volume. */
  readonly topSection: number;
  /** Continuous total massing height above road level (base + top section). */
  readonly topTotal: number;
}

interface FacadeEraLayer extends EraLayerView {
  update(frame: FacadeFrame): void;
}

export interface FacadeRig {
  /** Container group holding one child group per era layer. */
  readonly group: THREE.Group;
  readonly layers: readonly FacadeEraLayer[];
  /** Apply one transition frame to every era layer. */
  apply(frame: FacadeFrame): void;
}

const AWNING_CATEGORY: Record<'iron-hood' | 'fabric-slope' | 'glass-canopy', BuildingMaterialCategory> = {
  'iron-hood': 'metal',
  'fabric-slope': 'fabric',
  'glass-canopy': 'glass',
};

/** Stable draw order inside one era (opaque parts, then frames, then glass). */
function renderOrderFor(era: BuildingEraYear, channel: 0 | 1 | 2): number {
  return eraIndexOf(era) * 10 + channel;
}

/**
 * Build the full facade rig for one lot: base + upper massing skins, roofline
 * parapet and cornices per frontage, instanced era window grids with distinct
 * glazing per era, decorative lintels, window ACs, fire escapes, storefront
 * bay frames, the entrance door and awning, and the 1945 ghost sign.
 */
export function createFacade(
  lot: BuildingLot,
  ctx: BuildingBuildContext,
  lotIndex: number,
): FacadeRig {
  const { library } = ctx;
  const width = lotWidth(lot);
  const depth = lotDepth(lot);
  const baseH = baseHeightFor(lot);
  const fronts: FrontGeometry[] = lot.fronts.map((front) => frontGeometryFor(lot, front));
  const totalCols = lot.fronts.reduce((sum, front) => sum + front.bays, 0);

  const treatmentOf = (era: BuildingEraYear): (typeof ERA_TREATMENTS)[BuildingEraYear] =>
    ERA_TREATMENTS[era];
  const wallTintFor = (era: BuildingEraYear): string | undefined =>
    era === 1965 ? pastelTintFor(lotIndex) : undefined;

  // Maximum rows any era needs so instance buffers never resize.
  const maxRows = BUILDING_ERAS.reduce(
    (max, era) => Math.max(max, windowRowsFor(lot.massing[era], treatmentOf(era).window.height / 2)),
    1,
  );

  const container = new THREE.Group();
  container.name = 'facades';
  container.userData = { part: 'facades' };

  // Shared per-building geometry.
  const baseBox = ctx.geometry(`base-skin:${lot.id}`, () => new THREE.BoxGeometry(width, baseH, depth));
  const topBox = ctx.geometry(`top-skin:${lot.id}`, () => new THREE.BoxGeometry(width, 1, depth));
  const parapetGeo = ctx.geometry(`parapet:${lot.id}`, () => {
    const h = PARAPET_HEIGHT;
    const t = 0.3;
    const wOut = width + 0.16;
    const dOut = depth + 0.16;
    const parts = [
      new THREE.BoxGeometry(wOut, h, t),
      new THREE.BoxGeometry(wOut, h, t),
      new THREE.BoxGeometry(t, h, dOut - t * 2),
      new THREE.BoxGeometry(t, h, dOut - t * 2),
    ];
    parts[0].translate(0, h / 2, -(dOut - t) / 2);
    parts[1].translate(0, h / 2, (dOut - t) / 2);
    parts[2].translate(-(wOut - t) / 2, h / 2, 0);
    parts[3].translate((wOut - t) / 2, h / 2, 0);
    return library.mergeBufferGeometries(parts);
  });

  // Storefront bay frames: one merged geometry per frontage, reused by every
  // era layer with era-specific materials. Slots honor the pinned 6-unit
  // pitch, 5-unit clear width, and 0.15 base.
  const storefrontGeos = fronts.map((front, frontIndex) =>
    ctx.geometry(`storefront-frame:${lot.id}:${frontIndex}`, () => {
      const parts: THREE.BufferGeometry[] = [];
      const base = BLOCK_ALIGNMENT.bayBaseY;
      const openH = STOREFRONT_OPENING_HEIGHT;
      const plane = front.plane;
      const n = front.normal[front.planeIndex];
      for (let i = 0; i < lot.fronts[frontIndex].bays; i++) {
        const along = slotCenterLocal(lot.fronts[frontIndex], i, lot);
        for (const side of [-2.75, 2.75]) {
          const pilaster =
            front.axis === 'x'
              ? new THREE.BoxGeometry(0.5, openH, 0.6)
              : new THREE.BoxGeometry(0.6, openH, 0.5);
          const pos: [number, number, number] =
            front.axis === 'x'
              ? [along + side, base + openH / 2, plane + n * 0.12]
              : [plane + n * 0.12, base + openH / 2, along + side];
          pilaster.translate(pos[0], pos[1], pos[2]);
          parts.push(pilaster);
        }
        const lintel =
          front.axis === 'x'
            ? new THREE.BoxGeometry(BLOCK_ALIGNMENT.baySlotPitch, 0.42, 0.66)
            : new THREE.BoxGeometry(0.66, 0.42, BLOCK_ALIGNMENT.baySlotPitch);
        const lintelPos: [number, number, number] =
          front.axis === 'x'
            ? [along, base + openH + 0.21, plane + n * 0.14]
            : [plane + n * 0.14, base + openH + 0.21, along];
        lintel.translate(lintelPos[0], lintelPos[1], lintelPos[2]);
        parts.push(lintel);

        const sill =
          front.axis === 'x'
            ? new THREE.BoxGeometry(BLOCK_ALIGNMENT.bayClearWidth, 0.15, 0.5)
            : new THREE.BoxGeometry(0.5, 0.15, BLOCK_ALIGNMENT.bayClearWidth);
        const sillPos: [number, number, number] =
          front.axis === 'x'
            ? [along, base + 0.075, plane + n * 0.1]
            : [plane + n * 0.075 + n * 0.1 - n * 0.075, base + 0.075, along];
        if (front.axis === 'z') sillPos[0] = plane + n * 0.1;
        sill.translate(sillPos[0], sillPos[1], sillPos[2]);
        parts.push(sill);
      }
      return library.mergeBufferGeometries(parts);
    }),
  );

  // Entrance frontage helpers.
  const entranceFront = fronts[lot.entrance.front];
  const entranceLotFront = lot.fronts[lot.entrance.front];
  const entranceAlong = slotCenterLocal(entranceLotFront, lot.entrance.slot, lot);

  const layers: FacadeEraLayer[] = [];

  for (const era of BUILDING_ERAS) {
    const treatment = treatmentOf(era);
    const win = treatment.window;
    const winHalf = win.height / 2;
    const rowsCap = windowRowsFor(lot.massing[era], winHalf);
    const eraOrder = renderOrderFor(era, 0);

    const group = new THREE.Group();
    group.name = `facade:${era}`;
    group.userData = { part: 'facade-layer', era };
    const materials = new Set<THREE.MeshStandardMaterial>();
    const use = (
      category: BuildingMaterialCategory,
      options?: BuildingMaterialOptions,
    ): THREE.MeshStandardMaterial => {
      const material = ctx.materials.get(era, category, options);
      materials.add(material);
      return material;
    };

    // --- Massing skins -----------------------------------------------------
    const wallMaterial = use(treatment.wallCategory, {
      tint: wallTintFor(era),
      repeatX: WALL_TEXTURE_REPEAT[0],
      repeatY: WALL_TEXTURE_REPEAT[1],
      seed: era + lotIndex * 7,
    });
    const baseSkin = new THREE.Mesh(baseBox, wallMaterial);
    baseSkin.name = `base-skin:${era}`;
    baseSkin.position.y = baseH / 2;
    baseSkin.castShadow = true;
    baseSkin.receiveShadow = true;
    baseSkin.renderOrder = eraOrder;
    baseSkin.userData = { part: 'base-skin', era };
    group.add(baseSkin);

    const topMaterial = use(treatment.topCategory, {
      tint: treatment.topCategory === 'glass' ? undefined : wallTintFor(era),
      repeatX: treatment.topCategory === 'glass' ? 2 : WALL_TEXTURE_REPEAT[0],
      repeatY: treatment.topCategory === 'glass' ? 2 : WALL_TEXTURE_REPEAT[1],
      seed: era + lotIndex * 7 + 1,
    });
    const topSkin = new THREE.Mesh(topBox, topMaterial);
    topSkin.name = `top-skin:${era}`;
    topSkin.castShadow = true;
    topSkin.receiveShadow = true;
    topSkin.renderOrder = eraOrder;
    topSkin.userData = { part: 'top-skin', era };
    group.add(topSkin);

    // --- Roofline: parapet ring + cornice per frontage ---------------------
    const crownMaterial = use(treatment.parapetCategory, {
      repeatX: 3,
      repeatY: 1,
      seed: era + 3,
    });
    const parapet = new THREE.Mesh(parapetGeo, crownMaterial);
    parapet.name = `parapet:${era}`;
    parapet.castShadow = true;
    parapet.receiveShadow = true;
    parapet.renderOrder = eraOrder;
    parapet.userData = { part: 'parapet', era };
    group.add(parapet);

    const cornices: Array<{ mesh: THREE.Mesh; height: number }> = [];
    fronts.forEach((front, frontIndex) => {
      const span = front.spanEnd - front.spanStart;
      const corniceGeo = ctx.geometry(`cornice:${lot.id}:${frontIndex}:${era}`, () =>
        library.createCorniceGeometry({
          width: span + 0.3,
          height: treatment.cornice.height,
          depth: treatment.cornice.depth,
          tiers: treatment.cornice.tiers,
          dentils: treatment.cornice.dentils,
          dentilCount: Math.max(6, Math.round(span * 1.4)),
        }),
      );
      const mesh = new THREE.Mesh(corniceGeo, crownMaterial);
      mesh.name = `cornice:${era}:${frontIndex}`;
      mesh.rotation.y = front.rotationY;
      mesh.position.set(
        front.axis === 'x' ? 0 : front.plane + front.normal[front.planeIndex] * treatment.cornice.depth * 0.4,
        0,
        front.axis === 'x' ? front.plane + front.normal[front.planeIndex] * treatment.cornice.depth * 0.4 : 0,
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.renderOrder = eraOrder;
      mesh.userData = { part: 'cornice', era };
      group.add(mesh);
      cornices.push({ mesh, height: treatment.cornice.height });
    });

    // --- Instanced era window grid (frames + glazing) ----------------------
    const frameGeo = ctx.geometry(`winframe:${era}`, () =>
      library.createWindowGridGeometry({
        width: win.width,
        height: win.height,
        depth: 0.14,
        rows: win.rows,
        columns: win.columns,
        frameThickness: win.frameThickness,
        mullionThickness: win.mullionThickness,
        includeGlass: false,
      }),
    );
    const glassGeo = ctx.geometry(`winglass:${era}`, () => {
      const innerW = Math.max(0.2, win.width - (win.frameThickness + 0.02) * 2);
      const innerH = Math.max(0.2, win.height - (win.frameThickness + 0.02) * 2);
      return new THREE.PlaneGeometry(innerW, innerH);
    });

    const windowCapacity = Math.max(1, maxRows * totalCols);
    const frameMaterial = use(win.frameCategory, { seed: era + 11 });
    const glassMaterial = use('glass', { seed: era + 13 });

    const windowMesh = library.createInstancedMesh({
      geometry: frameGeo,
      material: frameMaterial,
      count: windowCapacity,
      name: `windows:${era}`,
      dynamic: false,
      castShadow: true,
      receiveShadow: true,
      colors: true,
    });
    windowMesh.frustumCulled = false;
    windowMesh.renderOrder = renderOrderFor(era, 1);
    windowMesh.userData = { part: 'windows', era };
    group.add(windowMesh);

    const glassMesh = library.createInstancedMesh({
      geometry: glassGeo,
      material: glassMaterial,
      count: windowCapacity,
      name: `window-glass:${era}`,
      dynamic: false,
      castShadow: false,
      receiveShadow: false,
      colors: true,
    });
    glassMesh.frustumCulled = false;
    glassMesh.renderOrder = renderOrderFor(era, 2);
    glassMesh.userData = { part: 'window-glass', era };
    group.add(glassMesh);

    // Optional decorative lintels above every window (close-up masonry detail).
    let lintelMesh: THREE.InstancedMesh | null = null;
    if (treatment.windowLintels) {
      const lintelGeo = ctx.geometry(`lintel:${era}`, () =>
        library.createLintelGeometry({
          width: win.width + 0.5,
          height: 0.22,
          depth: 0.2,
          keystone: era === 1945,
          pediment: 'none',
        }),
      );
      lintelMesh = library.createInstancedMesh({
        geometry: lintelGeo,
        material: use(treatment.cornice.category, { seed: era + 17 }),
        count: windowCapacity,
        name: `lintels:${era}`,
        dynamic: false,
        castShadow: true,
        receiveShadow: true,
        colors: true,
      });
      lintelMesh.frustumCulled = false;
      lintelMesh.renderOrder = eraOrder;
      lintelMesh.userData = { part: 'lintels', era };
      group.add(lintelMesh);
    }

    // Fill the full-capacity grid once; per-frame updates only adjust counts.
    const frameOut = win.frameThickness > 0.07 ? 0.05 : 0.04;
    let idx = 0;
    for (let r = 0; r < maxRows; r++) {
      const y = FIRST_WINDOW_Y + r * STORY_HEIGHT;
      for (let f = 0; f < fronts.length; f++) {
        const front = fronts[f];
        const lotFront = lot.fronts[f];
        for (let i = 0; i < lotFront.bays; i++) {
          const along = slotCenterLocal(lotFront, i, lot);
          const base: [number, number, number] =
            front.axis === 'x' ? [along, y, front.plane] : [front.plane, y, along];
          const n = front.normal[front.planeIndex];
          const place = (out: number, yOverride?: number): [number, number, number] => {
            const p: [number, number, number] = [base[0], yOverride ?? base[1], base[2]];
            p[front.planeIndex] = front.plane + n * out;
            return p;
          };
          library.setInstanceTransform(windowMesh, idx, {
            position: place(frameOut),
            rotation: [0, front.rotationY, 0],
          });
          library.setInstanceTransform(glassMesh, idx, {
            position: place(frameOut + 0.012),
            rotation: [0, front.rotationY, 0],
          });
          if (lintelMesh) {
            library.setInstanceTransform(lintelMesh, idx, {
              position: place(0.08, y + winHalf + 0.16),
              rotation: [0, front.rotationY, 0],
            });
          }
          const tint = 0.86 + ctx.random() * 0.14;
          library.setInstanceColor(windowMesh, idx, new THREE.Color(tint, tint, tint));
          const glassTint = 0.82 + ctx.random() * 0.18;
          library.setInstanceColor(glassMesh, idx, new THREE.Color(glassTint, glassTint, glassTint));
          idx += 1;
        }
      }
    }
    windowMesh.count = 0;
    glassMesh.count = 0;
    if (lintelMesh) lintelMesh.count = 0;

    // --- Window air-conditioners (mid-century only) ------------------------
    let acMesh: THREE.InstancedMesh | null = null;
    const acRowEnd = new Map<number, number>();
    if (treatment.windowAc !== 'none') {
      const acGeo = ctx.geometry('window-ac', () => {
        const shell = new THREE.BoxGeometry(0.75, 0.5, 0.42);
        shell.translate(0, 0, 0.21);
        const grille = new THREE.CylinderGeometry(0.17, 0.17, 0.05, 14);
        grille.rotateX(Math.PI / 2);
        grille.translate(0, 0, 0.44);
        const bracket = new THREE.BoxGeometry(0.8, 0.05, 0.1);
        bracket.translate(0, -0.28, 0.18);
        return library.mergeBufferGeometries([shell, grille, bracket]);
      });
      let acCapacity = 1;
      for (let r = 1; r < rowsCap; r++) {
        for (let i = 0; i < totalCols; i++) {
          if (
            treatment.windowAc === 'some'
              ? (i + r) % 2 === 0
              : (i * 2 + r) % 4 === 0
          ) {
            acCapacity += 1;
          }
        }
      }
      acMesh = library.createInstancedMesh({
        geometry: acGeo,
        material: use('metal', { seed: era + 19 }),
        count: acCapacity,
        name: `window-ac:${era}`,
        dynamic: false,
        castShadow: true,
        receiveShadow: true,
        colors: true,
      });
      acMesh.frustumCulled = false;
      acMesh.renderOrder = eraOrder;
      acMesh.userData = { part: 'window-ac', era };
      group.add(acMesh);

      let acIdx = 0;
      for (let r = 1; r < rowsCap; r++) {
        const y = FIRST_WINDOW_Y + r * STORY_HEIGHT - 1.55;
        let placedThisRow = 0;
        let f = 0;
        for (const front of fronts) {
          const lotFront = lot.fronts[f];
          for (let i = 0; i < lotFront.bays; i++) {
            const globalCol = fronts
              .slice(0, f)
              .reduce((sum, _, prev) => sum + lot.fronts[prev].bays, 0) + i;
            const matches =
              treatment.windowAc === 'some'
                ? (globalCol + r) % 2 === 0
                : (globalCol * 2 + r) % 4 === 0;
            if (matches && acIdx < acCapacity) {
              const along = slotCenterLocal(lotFront, i, lot);
              const n = front.normal[front.planeIndex];
              const position: [number, number, number] =
                front.axis === 'x'
                  ? [along, y, front.plane + n * 0.26]
                  : [front.plane + n * 0.26, y, along];
              library.setInstanceTransform(acMesh, acIdx, {
                position,
                rotation: [0, front.rotationY, 0],
              });
              acIdx += 1;
              placedThisRow += 1;
            }
          }
          f += 1;
        }
        if (placedThisRow > 0 || acRowEnd.size > 0) {
          acRowEnd.set(r, acIdx);
        }
      }
      acMesh.count = 0;
    }

    // --- Iron fire escapes (1945 + 1965, phase out after) ------------------
    if (treatment.fireEscape) {
      const stories = Math.max(1, rowsCap - 1);
      const fireGeo = ctx.geometry(`fire-escape:${lot.id}:${era}:${stories}`, () =>
        library.createFireEscapeGeometry({
          width: 2.4,
          depth: 1.0,
          heightPerStory: STORY_HEIGHT,
          stories,
          railingHeight: 0.9,
          slatSpacing: 0.18,
        }),
      );
      const slots: number[] =
        lot.fronts[0].bays >= 3 ? [0, lot.fronts[0].bays - 1] : [0];
      const front = fronts[0];
      const lotFront = lot.fronts[0];
      const fireMesh = library.createInstancedMesh({
        geometry: fireGeo,
        material: use('metal', { seed: era + 23 }),
        count: slots.length,
        name: `fire-escape:${era}`,
        dynamic: false,
        castShadow: true,
        receiveShadow: true,
        colors: true,
      });
      fireMesh.frustumCulled = false;
      fireMesh.renderOrder = eraOrder;
      fireMesh.userData = { part: 'fire-escape', era };
      slots.forEach((slot, index) => {
        const along = slotCenterLocal(lotFront, slot, lot);
        const n = front.normal[front.planeIndex];
        const position: [number, number, number] =
          front.axis === 'x'
            ? [along, FIRST_WINDOW_Y - 1.3, front.plane + n * 0.55]
            : [front.plane + n * 0.55, FIRST_WINDOW_Y - 1.3, along];
        library.setInstanceTransform(fireMesh, index, {
          position,
          rotation: [0, front.rotationY, 0],
        });
      });
      group.add(fireMesh);
    }

    // --- Storefront bay frames (one mesh per front per era) ----------------
    fronts.forEach((_front, frontIndex) => {
      const material = use(treatment.storefrontCategory, {
        repeatX: 2,
        repeatY: 2,
        seed: era + frontIndex,
      });
      const mesh = new THREE.Mesh(storefrontGeos[frontIndex], material);
      mesh.name = `storefront:${era}:${frontIndex}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.renderOrder = eraOrder;
      mesh.userData = { part: 'storefront', era };
      group.add(mesh);
    });

    // --- Entrance door + awning frame --------------------------------------
    const doorGeo = ctx.geometry(`door:${era}`, () =>
      library.createDoorGeometry({
        width: 1.6,
        height: 2.9,
        depth: 0.1,
        panels: treatment.doorPanels,
        transom: treatment.doorTransom,
        transomHeight: 0.4,
        handle: true,
        doubleDoor: treatment.doorDouble,
      }),
    );
    const doorMaterial = use(treatment.doorCategory, { seed: era + 29 });
    const door = new THREE.Mesh(doorGeo, doorMaterial);
    door.name = `door:${era}`;
    {
      const n = entranceFront.normal[entranceFront.planeIndex];
      const position: [number, number, number] =
        entranceFront.axis === 'x'
          ? [entranceAlong, BLOCK_ALIGNMENT.bayBaseY, entranceFront.plane + n * 0.03]
          : [entranceFront.plane + n * 0.03, BLOCK_ALIGNMENT.bayBaseY, entranceAlong];
      door.position.set(position[0], position[1], position[2]);
    }
    door.rotation.y = entranceFront.rotationY;
    door.castShadow = true;
    door.receiveShadow = true;
    door.renderOrder = eraOrder;
    door.userData = { part: 'door', era };
    group.add(door);

    const awningGeo = ctx.geometry(`awning:${era}`, () => buildAwningGeometry(treatment.awning, library));
    const awningMaterial = use(AWNING_CATEGORY[treatment.awning], {
      seed: era + 31,
      baseOpacity: treatment.awning === 'glass-canopy' ? 0.7 : 1,
    });
    const awning = new THREE.Mesh(awningGeo, awningMaterial);
    awning.name = `awning:${era}`;
    {
      const n = entranceFront.normal[entranceFront.planeIndex];
      const position: [number, number, number] =
        entranceFront.axis === 'x'
          ? [entranceAlong, BLOCK_ALIGNMENT.bayBaseY + 3.05, entranceFront.plane + n * 0.06]
          : [entranceFront.plane + n * 0.06, BLOCK_ALIGNMENT.bayBaseY + 3.05, entranceAlong];
      awning.position.set(position[0], position[1], position[2]);
    }
    awning.rotation.y = entranceFront.rotationY;
    awning.castShadow = true;
    awning.renderOrder = eraOrder;
    awning.userData = { part: 'awning', era };
    group.add(awning);

    // --- 1945 ghost-sign remnant ------------------------------------------
    if (era === 1945 && lot.ghostSign) {
      const ghostMaterial = use('masonryConcrete', {
        tint: '#4a382c',
        repeatX: 2,
        repeatY: 1,
        seed: 1945,
        baseOpacity: 0.92,
      });
      const ghost = new THREE.Mesh(
        ctx.geometry('ghost-sign', () => new THREE.BoxGeometry(4.4, 2.0, 0.05)),
        ghostMaterial,
      );
      ghost.name = 'ghost-sign:1945';
      const front = fronts[0];
      const n = front.normal[front.planeIndex];
      const position: [number, number, number] =
        front.axis === 'x' ? [3, 9.5, front.plane + n * 0.015] : [front.plane + n * 0.015, 9.5, 3];
      ghost.position.set(position[0], position[1], position[2]);
      ghost.rotation.y = front.rotationY;
      ghost.renderOrder = eraOrder;
      ghost.userData = { part: 'ghost-sign', era };
      group.add(ghost);
    }

    // --- Per-frame era layer update ---------------------------------------
    let lastRows = -1;
    const update = (frame: FacadeFrame): void => {
      const top = frame.topTotal;
      const topSection = Math.max(0.001, frame.topSection);

      topSkin.visible = frame.topSection >= 0.02;
      topSkin.scale.set(1, topSection, 1);
      topSkin.position.y = baseH + topSection / 2;

      parapet.position.y = top - PARAPET_HEIGHT + 0.12;
      for (const cornice of cornices) {
        cornice.mesh.position.y = top - cornice.height - 0.06;
      }

      // How many window rows fit under the current continuous roofline.
      let activeRows = 0;
      for (let r = 0; r < maxRows; r++) {
        const y = FIRST_WINDOW_Y + r * STORY_HEIGHT;
        if (y + winHalf + 0.9 <= top) activeRows = r + 1;
        else break;
      }
      const rows = Math.min(activeRows, rowsCap);
      if (rows !== lastRows) {
        lastRows = rows;
        windowMesh.count = totalCols * rows;
        glassMesh.count = totalCols * rows;
        if (lintelMesh) lintelMesh.count = totalCols * rows;
        if (acMesh) {
          const lastRow = Math.min(activeRows, rowsCap) - 1;
          let count = 0;
          for (let r = 1; r <= lastRow; r++) {
            const end = acRowEnd.get(r);
            if (end !== undefined) count = end;
          }
          acMesh.count = count;
        }
      }

      const detail = frame.detail.get(era) ?? 0;
      awning.scale.setScalar(0.86 + 0.14 * detail);
    };

    container.add(group);
    layers.push({ era, group, materials: [...materials], update });
  }

  const rig: FacadeRig = {
    group: container,
    layers,
    apply(frame: FacadeFrame): void {
      for (const layer of layers) {
        const weight = frame.weights.get(layer.era) ?? 0;
        applyLayerWeight(layer, weight);
        if (layer.group.visible) layer.update(frame);
      }
    },
  };
  return rig;
}

/** Build one era's entrance awning frame (extends outward along +Z). */
function buildAwningGeometry(
  style: 'iron-hood' | 'fabric-slope' | 'glass-canopy',
  library: BuildingsLibrary,
): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  if (style === 'iron-hood') {
    const hood = new THREE.BoxGeometry(2.0, 0.07, 0.9);
    hood.translate(0, 0, 0.5);
    parts.push(hood);
    for (const side of [-0.8, 0.8]) {
      const rod = new THREE.CylinderGeometry(0.03, 0.03, 1.0, 8);
      rod.rotateX(Math.PI / 2);
      rod.translate(side, 0.06, 0.45);
      parts.push(rod);
      const brace = new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8);
      brace.rotateX(Math.PI / 4);
      brace.translate(side, -0.18, 0.2);
      parts.push(brace);
    }
  } else if (style === 'fabric-slope') {
    const canopy = new THREE.BoxGeometry(2.4, 0.06, 1.2);
    canopy.rotateX(0.3);
    canopy.translate(0, 0.05, 0.6);
    parts.push(canopy);
    const valance = new THREE.BoxGeometry(2.4, 0.22, 0.05);
    valance.translate(0, -0.18, 1.15);
    parts.push(valance);
    for (const side of [-1.1, 1.1]) {
      const rail = new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8);
      rail.rotateX(Math.PI / 2);
      rail.translate(side, 0.12, 0.6);
      parts.push(rail);
    }
  } else {
    const panel = new THREE.BoxGeometry(2.6, 0.05, 1.3);
    panel.translate(0, 0, 0.65);
    parts.push(panel);
    for (const side of [-1.2, 1.2]) {
      const rail = new THREE.CylinderGeometry(0.035, 0.035, 1.3, 8);
      rail.rotateX(Math.PI / 2);
      rail.translate(side, -0.04, 0.65);
      parts.push(rail);
      const bracket = new THREE.BoxGeometry(0.06, 0.34, 0.06);
      bracket.translate(side, 0.14, 0.05);
      parts.push(bracket);
    }
  }
  return library.mergeBufferGeometries(parts);
}

/** Narrow structural alias so the awning builder stays library-composed. */
type BuildingsLibrary = BuildingBuildContext['library'];
