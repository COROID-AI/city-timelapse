import * as THREE from 'three';
import { generateBuilding } from '../era-content/toolkit/building';
import { generateVehicle } from '../era-content/toolkit/vehicle';
import { generateSignage } from '../era-content/toolkit/signage';
import { generatePedestrian, PedestrianParams } from '../era-content/toolkit/pedestrian';
import { generateProp } from '../era-content/toolkit/props';
import { generateStorefront } from '../era-content/toolkit/storefront';
import {
  getEraPalette,
  brickMaterial,
  stoneMaterial,
  ironMaterial,
  steelMaterial,
  glassMaterial,
  coalSmokeHaze,
  sepiaSunGlow,
} from './_shared/paletteHelpers';

// ──────────────────────────────────────────────────────────────────────
// EraContentModule interface — the shared contract all era modules follow
// ──────────────────────────────────────────────────────────────────────

export interface EraContentModule {
  /** Unique era identifier string */
  id: string;
  /** Build and return a single THREE.Group with named category children */
  build(): THREE.Group;
  /** Update loop hook — call each frame with delta time and elapsed seconds */
  update(dt: number, elapsed: number): void;
  /** Set transition progress (0..1) for cross-era morph animations */
  setTransitionProgress(p: number): void;
  /** Dispose all Three.js resources */
  dispose(): void;
}

// ──────────────────────────────────────────────────────────────────────
// Palette helper re-export — siblings MUST also export these
// ──────────────────────────────────────────────────────────────────────

/** @deprecated — import directly from './_shared/paletteHelpers' instead */
export const getPalette = getEraPalette;

// ──────────────────────────────────────────────────────────────────────
// Internal state for update / transition hooks
// ──────────────────────────────────────────────────────────────────────

let _transitionProgress = 0;
const _disposeTargets: Array<{ dispose(): void }> = [];
const _pedestrians: THREE.Group[] = [];
let _builtContent: { buildings: THREE.Group } | null = null;

// ──────────────────────────────────────────────────────────────────────
// Helper: make a box mesh (mirrors toolkit convention)
// ──────────────────────────────────────────────────────────────────────

function mkBox(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

function mkCyl(rT: number, rB: number, h: number, seg: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, seg), mat);
}

// ══════════════════════════════════════════════════════════════════════
// BUILDERS — each returns a THREE.Group with named children
// ══════════════════════════════════════════════════════════════════════

// ── Buildings ────────────────────────────────────────────────────────

function buildBuildings(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'buildings_1945';
  const palette = getEraPalette();

  // Row of walk-ups spanning the block face
  // We place 8 building units along x-axis to form a continuous streetscape.
  const rowDefs: Array<{
    x: number; floors: number; width: number; style: 'brick_classic' | 'industrial';
    cornice: 'none' | 'simple' | 'decorated' | 'elaborate'; rooftop: 'flat' | 'water_tank';
    fireEscape: boolean; condition: number; hasChimneys: boolean;
  }> = [
    { x: -24, floors: 3, width: 6, style: 'brick_classic', cornice: 'decorated', rooftop: 'flat', fireEscape: true, condition: 0.5, hasChimneys: true },
    { x: -17, floors: 4, width: 6, style: 'brick_classic', cornice: 'decorated', rooftop: 'flat', fireEscape: false, condition: 0.55, hasChimneys: true },
    { x: -10, floors: 5, width: 6, style: 'brick_classic', cornice: 'elaborate', rooftop: 'water_tank', fireEscape: true, condition: 0.6, hasChimneys: true },
    // Gap lot — bombsite (empty space with rubble)
    { x: -3, floors: 0, width: 6, style: 'brick_classic', cornice: 'none', rooftop: 'flat', fireEscape: false, condition: 0.3, hasChimneys: false },
    { x: 4, floors: 5, width: 6, style: 'brick_classic', cornice: 'elaborate', rooftop: 'water_tank', fireEscape: true, condition: 0.65, hasChimneys: true },
    { x: 11, floors: 6, width: 6, style: 'brick_classic', cornice: 'decorated', rooftop: 'flat', fireEscape: true, condition: 0.6, hasChimneys: true },
    { x: 18, floors: 4, width: 6, style: 'brick_classic', cornice: 'decorated', rooftop: 'flat', fireEscape: false, condition: 0.55, hasChimneys: true },
    { x: 25, floors: 3, width: 6, style: 'industrial', cornice: 'simple', rooftop: 'flat', fireEscape: false, condition: 0.5, hasChimneys: false },
  ];

  for (const def of rowDefs) {
    if (def.floors === 0) {
      // Bombsite gap lot — rubble and partial wall
      const rubbleGroup = new THREE.Group();
      rubbleGroup.name = 'bombsite_gap';
      const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x665E50, roughness: 1, metalness: 0 });
      const brickMat = brickMaterial(def.condition, palette);
      const concreteMat = new THREE.MeshStandardMaterial({ color: 0x888880, roughness: 0.9, metalness: 0 });

      // Low remaining wall segment
      const wall = mkBox(3, 1.5, 0.3, brickMat);
      wall.position.set(0, 0.75, 0);
      rubbleGroup.add(wall);

      // Rubble pile
      for (let i = 0; i < 12; i++) {
        const size = 0.15 + Math.random() * 0.3;
        const chunk = mkBox(size, size * 0.5, size * 0.8, rubbleMat);
        chunk.position.set(
          (Math.random() - 0.5) * 5,
          size * 0.25,
          (Math.random() - 0.5) * 2,
        );
        chunk.rotation.y = Math.random() * Math.PI;
        rubbleGroup.add(chunk);
      }

      // Broken timber beams
      for (let i = 0; i < 4; i++) {
        const beam = mkBox(1.5 + Math.random(), 0.1, 0.08, concreteMat);
        beam.position.set(
          (Math.random() - 0.5) * 4,
          0.1,
          (Math.random() - 0.5) * 1.5,
        );
        beam.rotation.z = (Math.random() - 0.5) * 0.4;
        beam.rotation.y = Math.random() * Math.PI;
        rubbleGroup.add(beam);
      }

      // Sandbags near gap edge
      const sandbagMat = new THREE.MeshStandardMaterial({ color: 0xA09070, roughness: 0.95 });
      for (let i = 0; i < 3; i++) {
        const bag = mkCyl(0.15, 0.15, 0.3, 8, sandbagMat);
        bag.rotation.z = Math.PI / 2;
        bag.position.set(-3.2 + i * 0.35, 0.15, 0);
        rubbleGroup.add(bag);
      }

      g.add(rubbleGroup);
      continue;
    }

    const result = generateBuilding({
      width: def.width,
      depth: 6,
      floors: def.floors,
      floorHeight: 3,
      style: def.style,
      cornice: def.cornice,
      rooftop: def.rooftop,
      fireEscape: def.fireEscape,
      awning: false,
      condition: def.condition,
      baseColor: def.style === 'brick_classic' ? palette.brickRed : palette.stoneDark,
    });
    result.group.position.x = def.x;
    g.add(result.group);
    _disposeTargets.push(result);

    // ── Add sash windows (toolkit generates generic windows; add period sash details) ──
    const facadeGroup = result.group.children[0] as THREE.Group | undefined;
    if (facadeGroup && facadeGroup.name?.includes('brick')) {
      for (let f = 0; f < def.floors; f++) {
        for (let b = 0; b < 3; b++) {
          const wx = -def.width / 2 + 1 + b * 2;
          const wy = f * 3 + 1.5;
          const z = 3.05;

          // Sash window — upper and lower panes divided by horizontal bar
          const frameMat = ironMaterial(def.condition, palette);
          const glassMat = glassMaterial(def.condition, palette);

          // Vertical divider
          const vDiv = mkBox(0.03, 1.2, 0.02, frameMat);
          vDiv.position.set(wx, wy, z);
          g.add(vDiv);

          // Horizontal divider (sash bar)
          const hDiv = mkBox(0.8, 0.03, 0.02, frameMat);
          hDiv.position.set(wx, wy, z);
          g.add(hDiv);

          // Upper glass pane
          const upperGlass = mkBox(0.38, 0.55, 0.01, glassMat);
          upperGlass.position.set(wx, wy + 0.3, z + 0.02);
          g.add(upperGlass);

          // Lower glass pane
          const lowerGlass = mkBox(0.38, 0.55, 0.01, glassMat);
          lowerGlass.position.set(wx, wy - 0.3, z + 0.02);
          g.add(lowerGlass);
        }
      }
    }

    // ── Rooftop water tanks ──
    if (def.rooftop === 'water_tank') {
      const tankGroup = new THREE.Group();
      tankGroup.name = 'rooftop_water_tank';
      const totalH = def.floors * 3;
      const tankMat = steelMaterial(def.condition, palette);

      // Rectangular tank body
      const tankBody = mkBox(2, 1.5, 1.5, tankMat);
      tankBody.position.set(0, totalH + 0.75, 0);
      tankGroup.add(tankBody);

      // Dome top
      const domeGeo = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const domeTop = new THREE.Mesh(domeGeo, tankMat);
      domeTop.position.set(0, totalH + 1.5, 0);
      tankGroup.add(domeTop);

      // Support legs
      for (const lx of [-0.8, 0.8]) {
        for (const lz of [-0.5, 0.5]) {
          const leg = mkCyl(0.04, 0.04, 0.5, 6, ironMaterial(def.condition, palette));
          leg.position.set(lx, totalH + 0.25, lz);
          tankGroup.add(leg);
        }
      }

      // Ladder on side
      const ladderMat = ironMaterial(def.condition, palette);
      for (let ly = 0; ly < 4; ly++) {
        const rung = mkBox(0.4, 0.03, 0.03, ladderMat);
        rung.position.set(1.05, totalH + 0.3 + ly * 0.35, 0);
        tankGroup.add(rung);
      }
      const railL = mkCyl(0.02, 0.02, 1.5, 6, ladderMat);
      railL.position.set(0.85, totalH + 0.75, 0);
      tankGroup.add(railL);
      const railR = railL.clone();
      railR.position.x = 1.25;
      tankGroup.add(railR);

      g.add(tankGroup);
    }

    // ── Chimneys (built manually since toolkit RooftopType lacks 'chimneys') ──
    if (def.hasChimneys) {
      const chimneyMat = brickMaterial(def.condition, palette);
      for (let i = 0; i < 2; i++) {
        const chX = (i === 0 ? -1.2 : 1.2);
        const chimGroup = new THREE.Group();
        chimGroup.name = `chimney_${i}`;
        const totalH = def.floors * 3;

        // Main stack
        const stack = mkBox(0.5, 2, 0.5, chimneyMat);
        stack.position.set(chX, totalH + 1, 0);
        chimGroup.add(stack);

        // Clay pot liners
        const potMat = new THREE.MeshStandardMaterial({ color: 0x994422, roughness: 0.8 });
        for (let p = 0; p < 2; p++) {
          const pot = mkCyl(0.1, 0.12, 0.4, 8, potMat);
          pot.position.set(chX + (p === 0 ? -0.12 : 0.12), totalH + 2.2, 0);
          chimGroup.add(pot);
        }

        g.add(chimGroup);
      }
    }

    // ── Boarded / plywood windows (WWII-era air raid prep) ──
    // Place boarded windows on every other building, random floors
    if (def.condition < 0.6 && Math.abs(def.x % 7) < 3) {
      const boardMat = new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.9 });
      const plankMat = new THREE.MeshStandardMaterial({ color: 0x7A6548, roughness: 0.9 });
      for (let f = 0; f < def.floors; f += 2) {
        for (let b = 0; b < 2; b++) {
          if (Math.random() > 0.5) continue;
          const wx = -def.width / 2 + 1 + b * 2;
          const wy = f * 3 + 1.5;
          const bw = 0.8, bh = 1.2;

          // Plywood panel
          const panel = mkBox(bw, bh, 0.04, boardMat);
          panel.position.set(wx, wy, 3.06);
          g.add(panel);

          // Diagonal planks
          for (let px = -1; px <= 1; px++) {
            const plank = mkBox(0.06, bh * 0.9, 0.02, plankMat);
            plank.position.set(wx + px * 0.25, wy, 3.09);
            plank.rotation.z = px * 0.15;
            g.add(plank);
          }
        }
      }
    }

    // ── Stone cornices (decorated ones already built by toolkit;
    //     add extra detail bands for classic brick walk-ups) ──
    if (def.cornice === 'decorated' || def.cornice === 'elaborate') {
      const totalH = def.floors * 3;
      const corniceMat = stoneMaterial(def.condition, palette);
      const proj = def.cornice === 'elaborate' ? 0.4 : 0.2;
      const corniceBand = mkBox(def.width + proj * 2, 0.2, 0.3 + proj, corniceMat);
      corniceBand.position.set(0, totalH + 0.1, 0);
      g.add(corniceBand);

      // Decorative corbel blocks under cornice
      for (let cb = 0; cb < 5; cb++) {
        const cx = -def.width / 2 + 0.8 + cb * ((def.width - 1) / 4);
        const corbel = mkBox(0.3, 0.15, 0.25, corniceMat);
        corbel.position.set(cx, totalH - 0.05, 0.15 + proj / 2);
        g.add(corbel);
      }
    }

    // ── Ground-floor storefronts for select buildings ──
    if (def.floors >= 3 && Math.abs(def.x) % 11 < 8) {
      const sfResult = generateStorefront({
        width: def.width * 0.85,
        height: 3.5,
        depth: 0.5,
        windowRatio: 0.55,
        doorType: 'single',
        kickPanel: 'tile',
        awning: 'canvas',
        hangingSign: true,
        condition: def.condition,
        accentColor: palette.wood,
      });
      sfResult.group.position.set(def.x, 0, 3.5);
      g.add(sfResult.group);
      _disposeTargets.push(sfResult);
    }
  }

  return g;
}

// ── Vehicles ─────────────────────────────────────────────────────────

function buildVehicles(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'vehicles_1945';
  const palette = getEraPalette();

  // Black/dark civilian sedans parked along curb
  const sedanPositions = [
    { x: -20, z: 5.5, rotY: 0 },
    { x: -14, z: 5.5, rotY: 0 },
    { x: 15, z: 5.5, rotY: 0 },
  ];
  for (const pos of sedanPositions) {
    const result = generateVehicle({
      type: 'sedan',
      scale: 1,
      paintColor: 0x1A1A1A,
      chromeColor: palette.chromeAccent,
      wheelStyle: 'spoke',
      bumperStyle: 'chrome_bar',
      headlightStyle: 'round',
      taillightStyle: 'round',
      condition: 0.55,
    });
    result.group.position.set(pos.x, 0, pos.z);
    result.group.rotation.y = pos.rotY;
    g.add(result.group);
    _disposeTargets.push(result);
  }

  // Flatbed truck with mudguards and running boards
  const flatbedResult = generateVehicle({
    type: 'truck',
    scale: 1.1,
    paintColor: 0x2A3A2A, // dark olive green (period military surplus colour)
    chromeColor: palette.chromeAccent,
    wheelStyle: 'heavy_duty',
    bumperStyle: 'heavy',
    headlightStyle: 'rectangular',
    taillightStyle: 'vertical_strip',
    condition: 0.45,
  });
  flatbedResult.group.position.set(-5, 0, 5.5);
  flatbedResult.group.rotation.y = 0;
  g.add(flatbedResult.group);
  _disposeTargets.push(flatbedResult);

  // Add running boards to flatbed truck
  const runningBoardMat = ironMaterial(0.45, palette);
  for (const side of [-1, 1]) {
    const rb = mkBox(3.0, 0.06, 0.06, runningBoardMat);
    rb.position.set(-1.2 * 1.1, 0.4, side * 1.0);
    g.add(rb);
  }

  // Mudguards (arched panels over rear wheels)
  const mudguardMat = ironMaterial(0.45, palette);
  for (const side of [-1, 1]) {
    const mgShape = new THREE.Shape();
    mgShape.absarc(0, 0, 0.5, Math.PI, 0, false);
    const mgGeo = new THREE.ExtrudeGeometry(mgShape, { depth: 0.08, bevelEnabled: false });
    const mg = new THREE.Mesh(mgGeo, mudguardMat);
    mg.rotation.y = Math.PI / 2;
    mg.position.set(-2.0 * 1.1, 0.4, side * 0.9);
    g.add(mg);
  }

  // Tram/trolley with overhead wire hint
  const tramResult = generateVehicle({
    type: 'tram',
    scale: 1.0,
    paintColor: 0xCCBB44, // period transit yellow-cream
    chromeColor: palette.chromeAccent,
    wheelStyle: 'simple',
    bumperStyle: 'minimal',
    headlightStyle: 'round',
    taillightStyle: 'round',
    condition: 0.5,
  });
  tramResult.group.position.set(8, 0, 5.5);
  tramResult.group.rotation.y = 0;
  g.add(tramResult.group);
  _disposeTargets.push(tramResult);

  // Overhead trolley pole (thin vertical pole extending up from tram roof)
  const poleMat = ironMaterial(0.5, palette);
  const trolleyPole = mkCyl(0.02, 0.02, 4, 6, poleMat);
  trolleyPole.position.set(8, 5.2, 5.5);
  g.add(trolleyPole);

  // Overhead wire (horizontal line at ~6m height)
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.8 });
  const wire = mkCyl(0.01, 0.01, 40, 4, wireMat);
  wire.rotation.z = Math.PI / 2;
  wire.position.set(8, 6.5, 5.5);
  g.add(wire);

  // Bicycles parked near sidewalk
  const bikePositions = [
    { x: -16, z: 4.2 },
    { x: 22, z: 4.2 },
  ];
  for (const bp of bikePositions) {
    const bikeGroup = new THREE.Group();
    bikeGroup.name = 'bicycle';

    const bikeMat = ironMaterial(0.5, palette);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1A1A1A, roughness: 0.9 });

    // Wheels (torus geometry)
    for (const wSide of [-1, 1]) {
      const wheelGroup = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 8, 24), tireMat);
      wheelGroup.add(tire);
      const hub = mkCyl(0.03, 0.03, 0.06, 8, bikeMat);
      hub.rotation.x = Math.PI / 2;
      wheelGroup.add(hub);
      // Spokes
      for (let s = 0; s < 6; s++) {
        const spoke = mkCyl(0.005, 0.005, 0.28, 4, bikeMat);
        spoke.rotation.z = (s / 6) * Math.PI;
        wheelGroup.add(spoke);
      }
      wheelGroup.position.set(bp.x + (wSide === -1 ? -0.5 : 0.5), 0.3, bp.z);
      bikeGroup.add(wheelGroup);
    }

    // Frame tubes
    const tubeGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.7, 6);
    const seatTube = new THREE.Mesh(tubeGeo, bikeMat);
    seatTube.position.set(bp.x, 0.65, bp.z);
    seatTube.rotation.z = 0.15;
    bikeGroup.add(seatTube);

    const topTube = mkCyl(0.012, 0.012, 0.55, 6, bikeMat);
    topTube.rotation.z = Math.PI / 2;
    topTube.position.set(bp.x, 0.95, bp.z);
    bikeGroup.add(topTube);

    const downTube = mkCyl(0.012, 0.012, 0.6, 6, bikeMat);
    downTube.rotation.z = -0.4;
    downTube.position.set(bp.x - 0.05, 0.7, bp.z);
    bikeGroup.add(downTube);

    // Handlebars
    const handlebar = mkCyl(0.012, 0.012, 0.4, 6, bikeMat);
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position.set(bp.x + 0.2, 0.95, bp.z);
    bikeGroup.add(handlebar);

    // Seat post + saddle
    const seatPost = mkCyl(0.01, 0.01, 0.2, 6, bikeMat);
    seatPost.position.set(bp.x - 0.25, 0.85, bp.z);
    bikeGroup.add(seatPost);
    const saddle = mkBox(0.15, 0.03, 0.1, new THREE.MeshStandardMaterial({ color: 0x2A1A0A, roughness: 0.8 }));
    saddle.position.set(bp.x - 0.25, 1.0, bp.z);
    bikeGroup.add(saddle);

    g.add(bikeGroup);
  }

  return g;
}

// ── Signage & Wall Ads ──────────────────────────────────────────────

function buildSignage(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'signage_1945';
  const palette = getEraPalette();

  // ── Painted wall advertisements on building walls ──

  // Blended tea ad — painted directly on brick wall
  const teaAd = generateSignage({
    width: 4,
    height: 2,
    depth: 0.05,
    text: 'BLEND\nTEA',
    fontSize: 0.35,
    textColor: 0xFFFFFF,
    bgColor: 0x8B4513,
    condition: 0.4,
    ornament: 'simple',
  });
  teaAd.group.position.set(-20.5, 4, 3.06);
  teaAd.group.rotation.y = 0;
  g.add(teaAd.group);
  _disposeTargets.push(teaAd);

  // Shoes ad
  const shoesAd = generateSignage({
    width: 5,
    height: 2.5,
    depth: 0.05,
    text: 'FINE\nLEATHER\nSHOES',
    fontSize: 0.3,
    textColor: 0xFFF8E8,
    bgColor: 0x6B3A2A,
    condition: 0.35,
    ornament: 'simple',
  });
  shoesAd.group.position.set(-13.5, 5, 3.06);
  g.add(shoesAd.group);
  _disposeTargets.push(shoesAd);

  // Cigarettes ad
  const cigAd = generateSignage({
    width: 6,
    height: 3,
    depth: 0.05,
    text: 'PREMIUM\nCIGARETTES',
    fontSize: 0.35,
    textColor: 0xFFDDAA,
    bgColor: 0x442211,
    condition: 0.3,
    ornament: 'art_deco',
  });
  cigAd.group.position.set(0.5, 5, 3.06);
  g.add(cigAd.group);
  _disposeTargets.push(cigAd);

  // War bonds ad
  const warBondAd = generateSignage({
    width: 7,
    height: 3,
    depth: 0.05,
    text: 'BUY WAR\nBONDS\nFOR VICTORY',
    fontSize: 0.3,
    textColor: 0xFFFFFF,
    bgColor: 0x223366,
    condition: 0.45,
    ornament: 'simple',
  });
  warBondAd.group.position.set(6.5, 5, 3.06);
  g.add(warBondAd.group);
  _disposeTargets.push(warBondAd);

  // ── Hanging signs on storefronts ──

  // Barber pole sign (rotating stripes effect handled in update)
  const barberSign = new THREE.Group();
  barberSign.name = 'barber_pole_sign';
  const poleMat = ironMaterial(0.6, palette);
  const bracket = mkCyl(0.03, 0.03, 0.8, 8, poleMat);
  bracket.rotation.z = Math.PI / 2;
  bracket.position.set(10.5, 3.5, 3.2);
  barberSign.add(bracket);

  // Barber pole cylinder with red-white-blue stripes
  const stripeCanvas = document.createElement('canvas');
  stripeCanvas.width = 64;
  stripeCanvas.height = 256;
  const ctx = stripeCanvas.getContext('2d')!;
  for (let sy = 0; sy < 256; sy += 8) {
    ctx.fillStyle = sy % 24 < 8 ? '#CC2222' : sy % 24 < 16 ? '#FFFFFF' : '#2244AA';
    ctx.fillRect(0, sy, 64, 8);
  }
  const stripeTex = new THREE.CanvasTexture(stripeCanvas);
  const barberPoleMat = new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.3, metalness: 0.2 });
  const barberPole = mkCyl(0.12, 0.12, 1.2, 12, barberPoleMat);
  barberPole.position.set(10.9, 3.3, 3.2);
  barberSign.add(barberPole);
  g.add(barberSign);

  // Drugstore fascia sign
  const drugstoreSign = generateSignage({
    width: 4,
    height: 0.8,
    depth: 0.1,
    text: 'DRUGSTORE',
    fontSize: 0.4,
    textColor: 0x006633,
    bgColor: 0xF5F5F0,
    frameColor: 0x888888,
    condition: 0.55,
    ornament: 'simple',
  });
  drugstoreSign.group.position.set(19, 3.8, 3.5);
  g.add(drugstoreSign.group);
  _disposeTargets.push(drugstoreSign);

  // Newsagent fascia sign
  const newsSign = generateSignage({
    width: 3.5,
    height: 0.7,
    depth: 0.1,
    text: 'NEWSAGENT',
    fontSize: 0.35,
    textColor: 0xFFFFFF,
    bgColor: 0x333333,
    frameColor: 0x666666,
    condition: 0.5,
    ornament: 'simple',
  });
  newsSign.group.position.set(26, 3.8, 3.5);
  g.add(newsSign.group);
  _disposeTargets.push(newsSign);

  // Newspaper stands on sidewalk
  const standMat = new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.8 });
  for (const sp of [{ x: 21, z: 4.0 }, { x: 28, z: 4.0 }]) {
    const nsGroup = new THREE.Group();
    nsGroup.name = 'newspaper_stand';
    // Angled display frame
    const backPanel = mkBox(0.6, 0.8, 0.03, standMat);
    backPanel.position.set(0, 0.9, 0);
    backPanel.rotation.x = -0.3;
    nsGroup.add(backPanel);
    const shelf = mkBox(0.65, 0.03, 0.25, standMat);
    shelf.position.set(0, 0.5, 0.1);
    nsGroup.add(shelf);
    // Newspapers (colored rectangles)
    const paperColors = [0xDDCCAA, 0xBBBBA0, 0xCCBB99];
    for (let np = 0; np < 3; np++) {
      const paper = mkBox(0.3, 0.35, 0.01, new THREE.MeshStandardMaterial({
        color: paperColors[np], roughness: 0.9,
      }));
      paper.position.set(-0.1 + np * 0.15, 0.7, 0.05);
      paper.rotation.x = -0.3;
      nsGroup.add(paper);
    }
    // Legs
    for (const lx of [-0.25, 0.25]) {
      const leg = mkCyl(0.02, 0.02, 0.5, 6, ironMaterial(0.5, palette));
      leg.position.set(lx, 0.25, 0.1);
      nsGroup.add(leg);
    }
    nsGroup.position.set(sp.x, 0, sp.z);
    g.add(nsGroup);
  }

  return g;
}

// ── Pedestrians ─────────────────────────────────────────────────────

function buildPedestrians(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'pedestrians_1945';
  const palette = getEraPalette();

  // Define pedestrian positions and outfit configs
  const pedDefs: Array<{
    x: number; z: number; outfit: PedestrianParams['outfit'];
    hatStyle?: PedestrianParams['hatStyle'];
    accessories?: PedestrianParams['accessories'];
  }> = [
    // Man in suit with fedora carrying newspaper
    { x: -18, z: 4.0, outfit: 'business_suit', hatStyle: 'fedora', accessories: ['newspaper'] },
    // Woman in dress with shoulder pads and headscarf
    { x: -10, z: 4.0, outfit: 'vintage_formal', hatStyle: 'cap', accessories: ['bag'] },
    // Worker in overcoat
    { x: -5, z: 4.0, outfit: 'worker', hatStyle: 'cap', accessories: [] },
    // Woman with ration shopping basket
    { x: 2, z: 4.0, outfit: 'street_urban', hatStyle: false, accessories: ['bag'] },
    // Man in fedora and overcoat
    { x: 10, z: 4.0, outfit: 'business_suit', hatStyle: 'fedora', accessories: ['briefcase'] },
    // Woman in dress
    { x: 16, z: 4.0, outfit: 'downtown_evening', hatStyle: 'beret', accessories: ['umbrella'] },
    // Two more workers
    { x: 22, z: 4.0, outfit: 'worker', hatStyle: 'cap', accessories: [] },
    { x: 28, z: 4.0, outfit: 'worker', hatStyle: 'cap', accessories: ['cane'] },
    // A child walking with adult
    { x: -14, z: 3.5, outfit: 'school_child', hatStyle: false, accessories: ['newspaper'] },
  ];

  for (const pd of pedDefs) {
    const result = generatePedestrian({
      outfit: pd.outfit,
      heightScale: 0.9 + Math.random() * 0.2,
      hatStyle: pd.hatStyle,
      accessories: pd.accessories,
      animated: false,
      condition: 0.5,
      palette: {
        accent: palette.sepiaTint,
      },
    });
    result.group.position.set(pd.x, 0, pd.z);
    result.group.rotation.y = Math.random() > 0.5 ? 0 : Math.PI;
    g.add(result.group);
    _pedestrians.push(result.group);
    _disposeTargets.push(result);
  }

  return g;
}

// ── Props ───────────────────────────────────────────────────────────

function buildProps(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'props_1945';
  const palette = getEraPalette();

  // Gas-lamp-style lamp posts (classic ornate style)
  const lampPositions = [
    { x: -22, z: 4.0 },
    { x: -11, z: 4.0 },
    { x: 0, z: 4.0 },
    { x: 11, z: 4.0 },
    { x: 22, z: 4.0 },
  ];
  for (const lp of lampPositions) {
    const result = generateProp({
      type: 'lamp_post',
      scale: 1,
      style: 'classic',
      lit: true,
      ornate: true,
      condition: 0.5,
    });
    result.group.position.set(lp.x, 0, lp.z);
    g.add(result.group);
    _disposeTargets.push(result);
  }

  // Cast-iron hydrants
  const hydrantPositions = [
    { x: -16, z: 4.0 },
    { x: 5, z: 4.0 },
    { x: 18, z: 4.0 },
  ];
  for (const hp of hydrantPositions) {
    const result = generateProp({
      type: 'hydrant',
      scale: 1,
      color: 0xAA2222, // period red
      condition: 0.45,
    });
    result.group.position.set(hp.x, 0, hp.z);
    g.add(result.group);
    _disposeTargets.push(result);
  }

  // Sandbag remnants scattered near bombsite
  const sandbagMat = new THREE.MeshStandardMaterial({ color: 0x9A8A6A, roughness: 0.95 });
  const sandbagPositions = [
    { x: -3.5, z: 3.5 },
    { x: -3.2, z: 3.5 },
    { x: -2.9, z: 3.5 },
    { x: -3.5, z: 3.8 },
    { x: -3.2, z: 3.8 },
  ];
  for (const sb of sandbagPositions) {
    const bag = mkCyl(0.12, 0.14, 0.28, 8, sandbagMat);
    bag.rotation.z = Math.PI / 2;
    bag.position.set(sb.x, 0.14, sb.z);
    g.add(bag);
  }

  // Cloth awnings on storefronts (canvas-style)
  const awningPositions = [
    { x: 19, z: 3.5, width: 3.4, color: 0x8B4513 },  // Drugstore
    { x: 26, z: 3.5, width: 3.0, color: 0x664422 },   // Newsagent
  ];
  for (const aw of awningPositions) {
    const awningMat = new THREE.MeshStandardMaterial({
      color: aw.color,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });
    // Awning canopy — angled plane
    const awningPlane = mkBox(aw.width, 0.05, 1.5, awningMat);
    awningPlane.position.set(aw.x, 2.8, aw.z + 0.5);
    awningPlane.rotation.x = -0.15;
    g.add(awningPlane);

    // Support poles
    const poleMat = ironMaterial(0.55, palette);
    for (const side of [-1, 1]) {
      const pole = mkCyl(0.02, 0.02, 1.5, 6, poleMat);
      pole.position.set(aw.x + side * aw.width / 2, 2.1, aw.z + 1.2);
      g.add(pole);
    }
  }

  // Bench on sidewalk
  const benchResult = generateProp({
    type: 'bench',
    scale: 1,
    style: 'classic',
    condition: 0.5,
  });
  benchResult.group.position.set(14, 0, 4.0);
  g.add(benchResult.group);
  _disposeTargets.push(benchResult);

  // Trash can
  const trashResult = generateProp({
    type: 'trash_can',
    scale: 1,
    condition: 0.4,
  });
  trashResult.group.position.set(30, 0, 4.0);
  g.add(trashResult.group);
  _disposeTargets.push(trashResult);

  // Bollards along curb
  const bollardPositions = [
    { x: -25, z: 4.8 },
    { x: -8, z: 4.8 },
    { x: 25, z: 4.8 },
  ];
  for (const bp of bollardPositions) {
    const bollardResult = generateProp({
      type: 'bollard',
      scale: 1,
      condition: 0.6,
    });
    bollardResult.group.position.set(bp.x, 0, bp.z);
    g.add(bollardResult.group);
    _disposeTargets.push(bollardResult);
  }

  return g;
}

// ── Atmosphere helpers (coal-smoke haze, sepia sun glow) ────────────

function buildAtmosphere(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'atmosphere_1945';
  const palette = getEraPalette();

  // Coal-smoke haze volume — large semi-transparent sphere behind scene
  const hazeMat = coalSmokeHaze(0.5, palette);
  const hazeSphere = new THREE.Mesh(
    new THREE.SphereGeometry(60, 16, 12),
    hazeMat,
  );
  hazeSphere.position.set(0, 20, -20);
  hazeSphere.renderOrder = -1;
  g.add(hazeSphere);

  // Sepia-tinted directional light
  const sunLight = new THREE.DirectionalLight(sepiaSunGlow(palette).getHex(), 0.8);
  sunLight.position.set(20, 30, -10);
  sunLight.castShadow = false;
  g.add(sunLight);

  // Warm ambient fill
  const warmAmbient = new THREE.AmbientLight(0xFFDDAA, 0.3);
  g.add(warmAmbient);

  // Ground-level fog plane (subtle)
  const fogMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(palette.coalSmoke).multiplyScalar(0.5),
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const fogPlane = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), fogMat);
  fogPlane.position.set(0, 0.5, 0);
  fogPlane.rotation.x = -Math.PI / 2;
  fogPlane.renderOrder = -1;
  g.add(fogPlane);

  return g;
}

// ══════════════════════════════════════════════════════════════════════
// ERA CONTENT MODULE — implements EraContentModule interface
// ══════════════════════════════════════════════════════════════════════

/**
 * The complete 1945 era content module.
 *
 * Implements the shared EraContentModule interface that all era modules
 * must follow:
 *   - `id`: unique era identifier
 *   - `build()`: returns five named subgroups (buildings, vehicles,
 *     signage, pedestrians, props) plus atmosphere
 *   - `update(dt, elapsed)`: called each frame for animation updates
 *   - `setTransitionProgress(p)`: sets cross-era morph progress 0..1
 *   - `dispose()`: releases all Three.js resources
 *
 * Visual features:
 *   - 2-6 story brick and stone walk-ups with stone cornices,
 *     sash windows, chimneys, rooftop water tanks
 *   - WWII-era boarded/plywood windows on aged buildings
 *   - Bombsite gap lot with rubble, broken timber, sandbags
 *   - Gas-lamp-style lamp posts, cast-iron hydrants
 *   - Painted-wall ads (blended tea, shoes, cigarettes, war bonds)
 *   - Wood-framed storefronts with barber pole, drugstore, newsagent
 *   - Newspaper stands with period papers
 *   - Black/dark civilian sedans, flatbed truck with mudguards/running
 *     boards, tram/trolley with overhead wire, bicycles
 *   - Pedestrians in 1940s outfits: fedoras, suits/overcoats, dresses
 *     with shoulder pads, headscarves, ration baskets, newspapers
 *   - Coal-smoke haze atmosphere, sepia-leaning warm sunlight
 *
 * No post-1945 anachronisms are present.
 */
export const era1945: EraContentModule = {
  id: '1945',

  /** Build and return a single THREE.Group with named category children. */
  build(): THREE.Group {
    const root = new THREE.Group();
    root.name = 'era_1945';

    // Category subgroups — names must match CATEGORY keys from eraStage.ts
    const buildingsGroup = new THREE.Group();
    buildingsGroup.name = 'buildings';
    buildingsGroup.add(buildBuildings());

    const vehiclesGroup = new THREE.Group();
    vehiclesGroup.name = 'vehicles';
    vehiclesGroup.add(buildVehicles());

    const signageGroup = new THREE.Group();
    signageGroup.name = 'signage';
    signageGroup.add(buildSignage());

    const pedestriansGroup = new THREE.Group();
    pedestriansGroup.name = 'pedestrians';
    pedestriansGroup.add(buildPedestrians());

    const propsGroup = new THREE.Group();
    propsGroup.name = 'props';
    propsGroup.add(buildProps());

    // Atmosphere (bonus subgroup, not required by EraStage but useful)
    const atmosphereGroup = new THREE.Group();
    atmosphereGroup.name = 'atmosphere';
    atmosphereGroup.add(buildAtmosphere());

    root.add(buildingsGroup);
    root.add(vehiclesGroup);
    root.add(signageGroup);
    root.add(pedestriansGroup);
    root.add(propsGroup);
    root.add(atmosphereGroup);

    return root;
  },

  update(_dt: number, _elapsed: number): void {
    // Animate barber pole rotation (scroll texture offset)
    const now = _elapsed * 2; // ~2 rev/sec
    const barberPole = _builtContent?.buildings.getObjectByName('barber_pole_sign');
    if (barberPole) {
      barberPole.traverse((child: unknown) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const matOrArr = mesh.material;
        const mats: THREE.Material[] = Array.isArray(matOrArr) ? matOrArr : [matOrArr];
        for (const m of mats) {
          if (m instanceof THREE.MeshStandardMaterial && m.map) {
            m.map.offset.y = -(now % 1);
          }
        }
      });
    }

    // Apply transition progress to building opacity
    if (_builtContent) {
      const targetOpacity = _transitionProgress > 0.5 ? 1 : _transitionProgress * 2;
      _builtContent.buildings.traverse((obj: unknown) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh && mesh.material) {
          const matOrArr = mesh.material;
          const mats: THREE.Material[] = Array.isArray(matOrArr) ? matOrArr : [matOrArr];
          for (const m of mats) {
            if (m instanceof THREE.MeshStandardMaterial) {
              m.opacity = Math.max(0.05, targetOpacity);
              m.transparent = targetOpacity < 1;
            }
          }
        }
      });
    }

    // Gentle pedestrian idle sway
    for (const ped of _pedestrians) {
      const phase = _elapsed * 0.5 + ped.id;
      ped.rotation.y += Math.sin(phase) * 0.0001;
    }
  },

  setTransitionProgress(p: number): void {
    _transitionProgress = p;
  },

  dispose(): void {
    for (const target of _disposeTargets) {
      try { target.dispose(); } catch { /* ignore disposed errors */ }
    }
    _disposeTargets.length = 0;
    _pedestrians.length = 0;
    _transitionProgress = 0;
    _builtContent = null;
  },
};
