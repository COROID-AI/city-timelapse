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
  g.name = 'buildings_1965';
  const palette = getEraPalette();

  // ── Renovated 1945 brick stock (cleaned/repointed, higher condition) ──
  // Same basic row structure but with renovated conditions and modernist inserts
  const rowDefs: Array<{
    x: number; floors: number; width: number; style: 'brick_classic' | 'modernist' | 'post_war';
    cornice: 'none' | 'simple' | 'decorated' | 'elaborate'; rooftop: 'flat' | 'parapet' | 'penthouse';
    fireEscape: boolean; condition: number; hasChimneys: boolean;
    groundFloorShop: boolean; shopType?: string;
  }> = [
    // Left side — renovated brick walk-ups
    { x: -24, floors: 3, width: 6, style: 'brick_classic', cornice: 'decorated', rooftop: 'flat', fireEscape: true, condition: 0.75, hasChimneys: true, groundFloorShop: true, shopType: 'diner' },
    { x: -17, floors: 4, width: 6, style: 'brick_classic', cornice: 'decorated', rooftop: 'flat', fireEscape: false, condition: 0.8, hasChimneys: true, groundFloorShop: true, shopType: 'laundromat' },
    { x: -10, floors: 5, width: 6, style: 'brick_classic', cornice: 'elaborate', rooftop: 'flat', fireEscape: true, condition: 0.8, hasChimneys: true, groundFloorShop: true, shopType: 'repair' },
    // Mid-block gap — now an open lot with drive-in movie poster
    { x: -3, floors: 0, width: 6, style: 'brick_classic', cornice: 'none', rooftop: 'flat', fireEscape: false, condition: 0.4, hasChimneys: false, groundFloorShop: false },
    // Center-right — renovated buildings
    { x: 4, floors: 5, width: 6, style: 'brick_classic', cornice: 'elaborate', rooftop: 'parapet', fireEscape: true, condition: 0.85, hasChimneys: false, groundFloorShop: true, shopType: 'general' },
    { x: 11, floors: 4, width: 6, style: 'post_war', cornice: 'simple', rooftop: 'parapet', fireEscape: false, condition: 0.8, hasChimneys: false, groundFloorShop: true, shopType: 'bowling' },
    { x: 18, floors: 4, width: 6, style: 'brick_classic', cornice: 'decorated', rooftop: 'flat', fireEscape: false, condition: 0.75, hasChimneys: true, groundFloorShop: true, shopType: 'gas' },
    // Right side — more modernist insert
    { x: 25, floors: 3, width: 6, style: 'modernist', cornice: 'none', rooftop: 'flat', fireEscape: false, condition: 0.9, hasChimneys: false, groundFloorShop: true, shopType: 'modern' },
  ];

  for (const def of rowDefs) {
    if (def.floors === 0) {
      // Drive-in movie lot — flat lot with large billboard/poster backdrop
      const lotGroup = new THREE.Group();
      lotGroup.name = 'drivein_lot';

      // Gravel/dirt ground
      const gravelMat = new THREE.MeshStandardMaterial({ color: 0x888878, roughness: 1 });
      const lotGround = mkBox(5, 0.05, 8, gravelMat);
      lotGround.position.set(0, 0.025, 1);
      lotGroup.add(lotGround);

      // Large drive-in movie poster screen on back wall
      const screenFrameMat = ironMaterial(0.7, palette);
      const screenFrame = mkBox(6, 4, 0.1, screenFrameMat);
      screenFrame.position.set(0, 3, -1);
      lotGroup.add(screenFrame);

      // Movie poster canvas (fictional brand)
      const posterCanvas = document.createElement('canvas');
      posterCanvas.width = 512;
      posterCanvas.height = 384;
      const pCtx = posterCanvas.getContext('2d')!;
      // Gradient sky background
      const grad = pCtx.createLinearGradient(0, 0, 0, 384);
      grad.addColorStop(0, '#1a0533');
      grad.addColorStop(0.5, '#440066');
      grad.addColorStop(1, '#ff6633');
      pCtx.fillStyle = grad;
      pCtx.fillRect(0, 0, 512, 384);
      // Stylized rocket ship
      pCtx.fillStyle = '#FFFFFF';
      pCtx.beginPath();
      pCtx.moveTo(256, 40);
      pCtx.lineTo(230, 160);
      pCtx.lineTo(282, 160);
      pCtx.closePath();
      pCtx.fill();
      // Rocket flames
      pCtx.fillStyle = '#FF4400';
      pCtx.beginPath();
      pCtx.moveTo(240, 160);
      pCtx.lineTo(256, 220);
      pCtx.lineTo(272, 160);
      pCtx.closePath();
      pCtx.fill();
      // Title text
      pCtx.fillStyle = '#FFDD44';
      pCtx.font = 'bold 42px Arial';
      pCtx.textAlign = 'center';
      pCtx.fillText('ROCKET TO THE MOON', 256, 300);
      pCtx.font = '24px Arial';
      pCtx.fillStyle = '#FFFFFF';
      pCtx.fillText('STARRING LUNA STARS', 256, 340);

      const posterTex = new THREE.CanvasTexture(posterCanvas);
      const posterMat = new THREE.MeshStandardMaterial({ map: posterTex, roughness: 0.7 });
      const posterPlane = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3.6), posterMat);
      posterPlane.position.set(0, 3, -0.94);
      lotGroup.add(posterPlane);

      // Support poles for screen
      for (const px of [-2.8, 2.8]) {
        const pole = mkCyl(0.04, 0.04, 4, 6, screenFrameMat);
        pole.position.set(px, 2, -1.1);
        lotGroup.add(pole);
      }

      g.add(lotGroup);
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
      baseColor: def.style === 'brick_classic' ? palette.brickRed : palette.stoneLight,
    });
    result.group.position.x = def.x;
    g.add(result.group);
    _disposeTargets.push(result);

    // ── Cleaned/repointed brick detail for renovated buildings ──
    // Add lighter mortar lines to show renovation
    if (def.style === 'brick_classic' && def.condition > 0.7) {
      const facadeGroup = result.group.children[0] as THREE.Group | undefined;
      if (facadeGroup && facadeGroup.name?.includes('brick')) {
        for (let f = 0; f < def.floors; f++) {
          for (let b = 0; b < 3; b++) {
            const wx = -def.width / 2 + 1 + b * 2;
            const wy = f * 3 + 1.5;
            const z = 3.05;

            // Modern sash window — cleaner look, larger glass
            const frameMat = ironMaterial(def.condition, palette);
            const glassMat = glassMaterial(def.condition, palette);

            // Vertical divider (thinner, more modern)
            const vDiv = mkBox(0.02, 1.4, 0.02, frameMat);
            vDiv.position.set(wx, wy, z);
            g.add(vDiv);

            // Upper glass pane
            const upperGlass = mkBox(0.38, 0.65, 0.01, glassMat);
            upperGlass.position.set(wx, wy + 0.35, z + 0.02);
            g.add(upperGlass);

            // Lower glass pane
            const lowerGlass = mkBox(0.38, 0.65, 0.01, glassMat);
            lowerGlass.position.set(wx, wy - 0.35, z + 0.02);
            g.add(lowerGlass);
          }
        }
      }
    }

    // ── Rooftop penthouses on renovated buildings ──
    if (def.rooftop === 'penthouse') {
      const totalH = def.floors * 3;
      const phw = def.width * 0.3, phd = 2.5, phh = 2;
      const phMat = stoneMaterial(def.condition, palette);
      const ph = mkBox(phw, phh, phd, phMat);
      ph.position.set(0, totalH + phh / 2, 0);
      g.add(ph);

      // Small rooftop antenna
      const antMat = ironMaterial(def.condition, palette);
      const antPole = mkCyl(0.02, 0.02, 1.5, 6, antMat);
      antPole.position.set(0.3, totalH + phh + 0.75, 0);
      g.add(antPole);
      // Dish
      const dishGeo = new THREE.SphereGeometry(0.2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      const dish = new THREE.Mesh(dishGeo, antMat);
      dish.rotation.x = -0.5;
      dish.position.set(0.3, totalH + phh + 1.2, 0);
      g.add(dish);
    }

    // ── Ground-floor modernist shopfronts ──
    if (def.groundFloorShop) {
      const sfResult = generateStorefront({
        width: def.width * 0.85,
        height: 3.5,
        depth: 0.5,
        windowRatio: 0.65,
        doorType: 'double',
        kickPanel: 'metal',
        awning: 'stripes',
        hangingSign: true,
        condition: def.condition,
        accentColor: palette.chromeAccent,
      });
      sfResult.group.position.set(def.x, 0, 3.5);
      g.add(sfResult.group);
      _disposeTargets.push(sfResult);
    }

    // ── Chimneys on older renovated buildings ──
    if (def.hasChimneys) {
      const chimneyMat = brickMaterial(def.condition, palette);
      for (let i = 0; i < 2; i++) {
        const chX = (i === 0 ? -1.2 : 1.2);
        const chimGroup = new THREE.Group();
        chimGroup.name = `chimney_${i}`;
        const totalH = def.floors * 3;

        const stack = mkBox(0.5, 2, 0.5, chimneyMat);
        stack.position.set(chX, totalH + 1, 0);
        chimGroup.add(stack);

        const potMat = new THREE.MeshStandardMaterial({ color: 0x994422, roughness: 0.8 });
        for (let p = 0; p < 2; p++) {
          const pot = mkCyl(0.1, 0.12, 0.4, 8, potMat);
          pot.position.set(chX + (p === 0 ? -0.12 : 0.12), totalH + 2.2, 0);
          chimGroup.add(pot);
        }

        g.add(chimGroup);
      }
    }
  }

  // ── Chrome-trimmed diner building (mid-century insert) ──
  const dinerGroup = new THREE.Group();
  dinerGroup.name = 'chrome_diner';
  const dinerW = 5, dinerH = 3.5, dinerD = 4;
  const dinerMat = new THREE.MeshStandardMaterial({ color: 0xEEEEEE, roughness: 0.15, metalness: 0.8 });
  const chromeTrimMat = new THREE.MeshStandardMaterial({ color: 0xDDDDDD, roughness: 0.1, metalness: 0.9 });
  const dinerGlassMat = new THREE.MeshStandardMaterial({ color: 0xAADDFF, transparent: true, opacity: 0.3, roughness: 0.05 });

  // Diner main body — rounded corners feel via flat panels
  const dinerBody = mkBox(dinerW, dinerH, dinerD, dinerMat);
  dinerBody.position.set(-7, dinerH / 2, 4);
  dinerGroup.add(dinerBody);

  // Chrome trim bands
  const trimBand = mkBox(dinerW + 0.1, 0.08, dinerD + 0.1, chromeTrimMat);
  trimBand.position.set(-7, dinerH, 4);
  dinerGroup.add(trimBand);
  const trimBand2 = mkBox(dinerW + 0.1, 0.06, dinerD + 0.1, chromeTrimMat);
  trimBand2.position.set(-7, 0.1, 4);
  dinerGroup.add(trimBand2);

  // Corner chrome trim strips
  for (const cx of [-7 - dinerW / 2, -7 + dinerW / 2]) {
    const cornerStrip = mkCyl(0.04, 0.04, dinerH, 8, chromeTrimMat);
    cornerStrip.position.set(cx, dinerH / 2, 4);
    dinerGroup.add(cornerStrip);
  }

  // Curved front windows (large panoramic)
  const frontWindow = mkBox(dinerW * 0.7, dinerH * 0.6, 0.03, dinerGlassMat);
  frontWindow.position.set(-7, dinerH * 0.55, 4 + dinerD / 2 + 0.02);
  dinerGroup.add(frontWindow);

  // Side windows
  for (const side of [-1, 1]) {
    const sideWin = mkBox(0.03, dinerH * 0.4, dinerD * 0.5, dinerGlassMat);
    sideWin.position.set(-7 + side * dinerW / 2, dinerH * 0.55, 4);
    dinerGroup.add(sideWin);
  }

  // Neon sign on diner — "NEBULA" in red neon tubing effect
  const neonCanvas = document.createElement('canvas');
  neonCanvas.width = 256;
  neonCanvas.height = 64;
  const nCtx = neonCanvas.getContext('2d')!;
  nCtx.fillStyle = '#000000';
  nCtx.fillRect(0, 0, 256, 64);
  // Red neon glow effect
  nCtx.shadowColor = '#FF2200';
  nCtx.shadowBlur = 12;
  nCtx.strokeStyle = '#FF4422';
  nCtx.lineWidth = 3;
  nCtx.font = 'bold 40px Arial';
  nCtx.textAlign = 'center';
  nCtx.strokeText('NEBULA', 128, 45);
  nCtx.shadowBlur = 6;
  nCtx.fillStyle = '#FFAA88';
  nCtx.fillText('NEBULA', 128, 45);
  // Star decorations
  nCtx.shadowBlur = 8;
  nCtx.fillStyle = '#FFDD44';
  nCtx.shadowColor = '#FFDD44';
  for (let sx of [30, 220]) {
    nCtx.beginPath();
    nCtx.arc(sx, 35, 4, 0, Math.PI * 2);
    nCtx.fill();
  }

  const neonTex = new THREE.CanvasTexture(neonCanvas);
  const neonMat = new THREE.MeshStandardMaterial({
    map: neonTex,
    emissive: 0xFF4422,
    emissiveIntensity: 0.6,
    emissiveMap: neonTex,
    transparent: true,
    depthWrite: false,
  });
  const neonSign = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.75), neonMat);
  neonSign.position.set(-7, dinerH + 0.5, 4 + dinerD / 2 + 0.05);
  dinerGroup.add(neonSign);

  // Jukebox silhouette visible through doorway
  const jukeboxMat = new THREE.MeshStandardMaterial({ color: 0x882222, roughness: 0.3, metalness: 0.4 });
  const jukeboxBody = mkBox(0.5, 1.5, 0.4, jukeboxMat);
  jukeboxBody.position.set(-7 + dinerW * 0.2, 0.75, 4 + dinerD / 2 - 0.5);
  dinerGroup.add(jukeboxBody);
  // Jukebox top dome
  const jbTopGeo = new THREE.SphereGeometry(0.25, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const jbTop = new THREE.Mesh(jbTopGeo, jukeboxMat);
  jbTop.position.set(-7 + dinerW * 0.2, 1.5, 4 + dinerD / 2 - 0.5);
  dinerGroup.add(jbTop);
  // Jukebox internal light glow
  const jbGlowMat = new THREE.MeshBasicMaterial({ color: 0xFFDD44, transparent: true, opacity: 0.4 });
  const jbGlow = mkBox(0.3, 0.3, 0.01, jbGlowMat);
  jbGlow.position.set(-7 + dinerW * 0.2, 1.0, 4 + dinerD / 2 - 0.28);
  dinerGroup.add(jbGlow);

  g.add(dinerGroup);

  // ── Laundromat building ──
  const laundryGroup = new THREE.Group();
  laundryGroup.name = 'laundromat';
  const laundryW = 5, laundryH = 3, laundryD = 4;
  const laundryMat = new THREE.MeshStandardMaterial({ color: 0xF0F0F0, roughness: 0.5 });
  const laundryBody = mkBox(laundryW, laundryH, laundryD, laundryMat);
  laundryBody.position.set(0, laundryH / 2, 4);
  laundryGroup.add(laundryBody);

  // Large display windows showing washing machines
  const washWindowMat = new THREE.MeshStandardMaterial({ color: 0xCCDDEE, transparent: true, opacity: 0.35, roughness: 0.1 });
  const washWindow = mkBox(laundryW * 0.8, 1.5, 0.03, washWindowMat);
  washWindow.position.set(0, 2, 4 + laundryD / 2 + 0.02);
  laundryGroup.add(washWindow);

  // Washing machine silhouettes inside window
  const wmMat = new THREE.MeshStandardMaterial({ color: 0xDDDDDD, roughness: 0.3 });
  for (let wi = 0; wi < 3; wi++) {
    const wm = mkBox(0.5, 0.8, 0.3, wmMat);
    wm.position.set(-1 + wi * 1, 1.2, 4 + laundryD / 2 - 0.1);
    laundryGroup.add(wm);
    // Circular door
    const wdGeo = new THREE.TorusGeometry(0.15, 0.03, 8, 12);
    const wd = new THREE.Mesh(wdGeo, new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.2 }));
    wd.position.set(-1 + wi * 1, 1.3, 4 + laundryD / 2 + 0.06);
    laundryGroup.add(wd);
  }

  g.add(laundryGroup);

  // ── TV & Radio Repair Shop ──
  const tvRepairGroup = new THREE.Group();
  tvRepairGroup.name = 'tv_repair_shop';
  const tvW = 5, tvH = 3, tvD = 4;
  const tvMat = new THREE.MeshStandardMaterial({ color: 0xE8DCC8, roughness: 0.6 });
  const tvBody = mkBox(tvW, tvH, tvD, tvMat);
  tvBody.position.set(8, tvH / 2, 4);
  tvRepairGroup.add(tvBody);

  // Antenna array on roof
  const antMat = ironMaterial(0.8, palette);
  for (let ai = 0; ai < 3; ai++) {
    const antH = 1 + ai * 0.5;
    const ant = mkCyl(0.015, 0.02, antH, 4, antMat);
    ant.position.set(8 + (ai - 1) * 0.5, tvH + antH / 2, 4);
    tvRepairGroup.add(ant);
    // Cross element
    const cross = mkCyl(0.01, 0.01, 0.4, 4, antMat);
    cross.position.set(8 + (ai - 1) * 0.5, tvH + antH * 0.7, 4);
    cross.rotation.z = Math.PI / 2;
    tvRepairGroup.add(cross);
  }

  // Window with TV/radio silhouettes
  const tvShopWindow = mkBox(tvW * 0.7, 1.2, 0.03, washWindowMat.clone());
  tvShopWindow.position.set(8, 2, 4 + tvD / 2 + 0.02);
  tvRepairGroup.add(tvShopWindow);

  // Old TV set silhouettes in window
  const oldTvMat = new THREE.MeshStandardMaterial({ color: 0x5A4A3A, roughness: 0.7 });
  const oldTv = mkBox(0.6, 0.5, 0.4, oldTvMat);
  oldTv.position.set(7.5, 1.5, 4 + tvD / 2 - 0.1);
  tvRepairGroup.add(oldTv);
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.2, metalness: 0.3 });
  const tvScreen = mkBox(0.4, 0.3, 0.01, screenMat);
  tvScreen.position.set(7.5, 1.5, 4 + tvD / 2 + 0.1);
  tvRepairGroup.add(tvScreen);

  g.add(tvRepairGroup);

  // ── Bowling Pin Sign (freestanding roadside sign) ──
  const bowlingGroup = new THREE.Group();
  bowlingGroup.name = 'bowling_pin_sign';
  const pinMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.4 });
  const pinStripeMat = new THREE.MeshStandardMaterial({ color: 0xFF2200, roughness: 0.4 });

  // Main bowling pin shape
  const pinBase = mkCyl(0.25, 0.3, 2.5, 8, pinMat);
  pinBase.position.set(25, 1.25, 5);
  bowlingGroup.add(pinBase);
  // Pin neck
  const pinNeck = mkCyl(0.1, 0.15, 0.5, 8, pinMat);
  pinNeck.position.set(25, 2.75, 5);
  bowlingGroup.add(pinNeck);
  // Pin head
  const pinHead = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), pinMat);
  pinHead.position.set(25, 3.1, 5);
  bowlingGroup.add(pinHead);
  // Red stripe bands
  const stripe1 = mkCyl(0.26, 0.26, 0.08, 8, pinStripeMat);
  stripe1.position.set(25, 1.8, 5);
  bowlingGroup.add(stripe1);
  const stripe2 = mkCyl(0.24, 0.24, 0.08, 8, pinStripeMat);
  stripe2.position.set(25, 2.2, 5);
  bowlingGroup.add(stripe2);

  // Supporting pole
  const supportMat = ironMaterial(0.8, palette);
  const supportPole = mkCyl(0.03, 0.03, 3.5, 6, supportMat);
  supportPole.position.set(25, 1.75, 4.5);
  bowlingGroup.add(supportPole);

  g.add(bowlingGroup);

  return g;
}

// ── Vehicles ─────────────────────────────────────────────────────────

function buildVehicles(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'vehicles_1965';
  const palette = getEraPalette();

  // ── Chrome-and-finned sedan (parked at curb) ──
  const finnedSedan = generateVehicle({
    type: 'sedan',
    scale: 1,
    paintColor: 0x2244AA, // classic blue
    chromeColor: palette.chromeAccent,
    wheelStyle: 'spoke',
    bumperStyle: 'heavy',
    headlightStyle: 'round',
    taillightStyle: 'round',
    condition: 0.8,
  });
  finnedSedan.group.position.set(-18, 0, 5.5);
  g.add(finnedSedan.group);
  _disposeTargets.push(finnedSedan);

  // Add tailfins to sedan (manual addition — toolkit doesn't model fins)
  const finMat = new THREE.MeshStandardMaterial({ color: 0x2244AA, roughness: 0.3, metalness: 0.5 });
  const chromeFinTipMat = new THREE.MeshStandardMaterial({ color: 0xDDDDDD, roughness: 0.1, metalness: 0.9 });
  for (const side of [-1, 1]) {
    // Tailfin triangle
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(0.15, 0.6);
    finShape.lineTo(-0.15, 0.6);
    finShape.closePath();
    const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.05, bevelEnabled: false });
    const fin = new THREE.Mesh(finGeo, finMat);
    fin.position.set(-2.5, 0.5, side * 0.7);
    fin.rotation.y = side * 0.2;
    g.add(fin);

    // Chrome tip on fin
    const finTip = mkBox(0.06, 0.06, 0.06, chromeFinTipMat);
    finTip.position.set(-2.5, 1.1, side * 0.7);
    g.add(finTip);
  }

  // ── Second finned sedan (different color, parked behind) ──
  const finnedSedan2 = generateVehicle({
    type: 'sedan',
    scale: 1,
    paintColor: 0xAA2222, // red
    chromeColor: palette.chromeAccent,
    wheelStyle: 'spoke',
    bumperStyle: 'heavy',
    headlightStyle: 'round',
    taillightStyle: 'round',
    condition: 0.75,
  });
  finnedSedan2.group.position.set(-13, 0, 5.5);
  g.add(finnedSedan2.group);
  _disposeTargets.push(finnedSedan2);

  // ── Pickup truck with chrome bed rails ──
  const pickupResult = generateVehicle({
    type: 'pickup',
    scale: 1.1,
    paintColor: 0x336633, // green
    chromeColor: palette.chromeAccent,
    wheelStyle: 'spoke',
    bumperStyle: 'chrome_bar',
    headlightStyle: 'round',
    taillightStyle: 'vertical_strip',
    condition: 0.7,
  });
  pickupResult.group.position.set(-7, 0, 5.5);
  g.add(pickupResult.group);
  _disposeTargets.push(pickupResult);

  // Chrome bed rails on pickup
  const bedRailMat = chromeMat(palette.chromeAccent, 0.7);
  for (const side of [-1, 1]) {
    const rail = mkBox(2.5, 0.04, 0.04, bedRailMat);
    rail.position.set(-1.2, 0.9, side * 0.82);
    g.add(rail);
  }

  // ── VW-style microbus (rounded, split windshield) ──
  const microbusResult = generateVehicle({
    type: 'van',
    scale: 1.1,
    paintColor: 0xF5F5DC, // cream/biscuit
    chromeColor: palette.chromeAccent,
    wheelStyle: 'simple',
    bumperStyle: 'chrome_bar',
    headlightStyle: 'round',
    taillightStyle: 'rectangular',
    condition: 0.75,
  });
  microbusResult.group.position.set(3, 0, 5.5);
  g.add(microbusResult.group);
  _disposeTargets.push(microbusResult);

  // Split windshield hint on microbus
  const splitBar = mkBox(0.03, 0.5, 0.03, ironMaterial(0.7, palette));
  splitBar.position.set(2.25 * 1.1, 1.7 * 1.1, 0);
  g.add(splitBar);

  // ── Rounded-fender city bus ──
  const busResult = generateVehicle({
    type: 'bus',
    scale: 1,
    paintColor: 0x006644, // transit green
    chromeColor: palette.chromeAccent,
    wheelStyle: 'heavy_duty',
    bumperStyle: 'heavy',
    headlightStyle: 'rectangular',
    taillightStyle: 'vertical_strip',
    condition: 0.65,
  });
  busResult.group.position.set(12, 0, 5.5);
  g.add(busResult.group);
  _disposeTargets.push(busResult);

  // Rounded fenders on bus
  const fenderMat = new THREE.MeshStandardMaterial({ color: 0x006644, roughness: 0.4, metalness: 0.3 });
  for (const fz of [-1.3, 1.3]) {
    const fenderGeo = new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI, 0, Math.PI / 2);
    const fender = new THREE.Mesh(fenderGeo, fenderMat);
    fender.position.set(2.8, 0.5, fz);
    fender.rotation.z = Math.PI / 2;
    g.add(fender);
  }
  for (const fz of [-1.3, 1.3]) {
    const fenderGeo = new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI, 0, Math.PI / 2);
    const fender = new THREE.Mesh(fenderGeo, fenderMat);
    fender.position.set(-2.5, 0.5, fz);
    fender.rotation.z = Math.PI / 2;
    g.add(fender);
  }

  // ── Taxi with roof light ──
  const taxiResult = generateVehicle({
    type: 'taxi',
    scale: 1,
    paintColor: 0xFFCC00, // yellow
    chromeColor: palette.chromeAccent,
    wheelStyle: 'spoke',
    bumperStyle: 'chrome_bar',
    headlightStyle: 'round',
    taillightStyle: 'round',
    condition: 0.7,
  });
  taxiResult.group.position.set(20, 0, 5.5);
  g.add(taxiResult.group);
  _disposeTargets.push(taxiResult);

  return g;
}

// Chrome material helper (local copy matching toolkit pattern)
function chromeMat(color: number, condition: number): THREE.MeshStandardMaterial {
  const c = new THREE.Color(color);
  return new THREE.MeshStandardMaterial({
    color: c,
    roughness: 0.15 - condition * 0.05,
    metalness: 0.85 + condition * 0.1,
  });
}

// ── Signage & Wall Ads ──────────────────────────────────────────────

function buildSignage(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'signage_1965';
  const palette = getEraPalette();

  // ── Enamel/plastic fascia signs on storefronts ──

  // Diner fascia sign
  const dinerSign = generateSignage({
    width: 3.5,
    height: 0.8,
    depth: 0.15,
    text: 'NEBULA\nDINER',
    fontSize: 0.35,
    textColor: 0xFFFFFF,
    bgColor: 0x220044,
    frameColor: 0xCCCCCC,
    condition: 0.85,
    ornament: 'simple',
  });
  dinerSign.group.position.set(-7, 4, 6.5);
  g.add(dinerSign.group);
  _disposeTargets.push(dinerSign);

  // Laundromat fascia sign
  const laundrySign = generateSignage({
    width: 3.5,
    height: 0.8,
    depth: 0.15,
    text: 'SWISH\nLAUNDRY',
    fontSize: 0.35,
    textColor: 0x0044AA,
    bgColor: 0xF0F0F0,
    frameColor: 0xAAAAAA,
    condition: 0.8,
    ornament: 'simple',
  });
  laundrySign.group.position.set(0, 3.8, 4.5);
  g.add(laundrySign.group);
  _disposeTargets.push(laundrySign);

  // TV & Radio Repair fascia
  const tvSign = generateSignage({
    width: 3.5,
    height: 0.9,
    depth: 0.15,
    text: 'STAR SIGNAL\nRADIO & TV',
    fontSize: 0.28,
    textColor: 0x003366,
    bgColor: 0xF5EEDD,
    frameColor: 0x888888,
    condition: 0.75,
    ornament: 'simple',
  });
  tvSign.group.position.set(8, 3.8, 4.5);
  g.add(tvSign.group);
  _disposeTargets.push(tvSign);

  // General store fascia
  const generalSign = generateSignage({
    width: 3.5,
    height: 0.7,
    depth: 0.15,
    text: 'MAIN STREET\nMARKET',
    fontSize: 0.3,
    textColor: 0xFFFFFF,
    bgColor: 0x225522,
    frameColor: 0xCCCCCC,
    condition: 0.8,
    ornament: 'simple',
  });
  generalSign.group.position.set(4, 3.8, 4.5);
  g.add(generalSign.group);
  _disposeTargets.push(generalSign);

  // Gas station fascia
  const gasSign = generateSignage({
    width: 4,
    height: 0.7,
    depth: 0.15,
    text: 'ATLANTIC\nPETROLEUM',
    fontSize: 0.3,
    textColor: 0xFFFFFF,
    bgColor: 0x003366,
    frameColor: 0xCCCCCC,
    condition: 0.8,
    ornament: 'simple',
  });
  gasSign.group.position.set(18, 3.8, 4.5);
  g.add(gasSign.group);
  _disposeTargets.push(gasSign);

  // ── Painted wall advertisements on building walls ──

  // Cosmic Cola ad — painted on brick wall
  const colaAd = generateSignage({
    width: 4,
    height: 2,
    depth: 0.05,
    text: 'OASIS\nCOLA',
    fontSize: 0.35,
    textColor: 0xFFFFFF,
    bgColor: 0xCC2200,
    condition: 0.5,
    ornament: 'simple',
  });
  colaAd.group.position.set(-24.5, 5, 3.06);
  g.add(colaAd.group);
  _disposeTargets.push(colaAd);

  // Leather goods ad
  const leatherAd = generateSignage({
    width: 4,
    height: 2,
    depth: 0.05,
    text: 'FINEST\nLEATHER\nGOODS',
    fontSize: 0.28,
    textColor: 0xFFF8E8,
    bgColor: 0x6B3A2A,
    condition: 0.45,
    ornament: 'simple',
  });
  leatherAd.group.position.set(-17.5, 6, 3.06);
  g.add(leatherAd.group);
  _disposeTargets.push(leatherAd);

  // Golden Harvest Cigarettes ad
  const cigAd = generateSignage({
    width: 5,
    height: 2.5,
    depth: 0.05,
    text: 'GOLDEN\nHARVEST\nCIGARETTES',
    fontSize: 0.3,
    textColor: 0xFFDDAA,
    bgColor: 0x442211,
    condition: 0.4,
    ornament: 'art_deco',
  });
  cigAd.group.position.set(-10.5, 7, 3.06);
  g.add(cigAd.group);
  _disposeTargets.push(cigAd);

  // Victory Bills ad (retained theme from 1945 but updated)
  const victoryAd = generateSignage({
    width: 6,
    height: 3,
    depth: 0.05,
    text: 'BUY U.S.\nSAVINGS\nBONDS',
    fontSize: 0.28,
    textColor: 0xFFFFFF,
    bgColor: 0x223366,
    condition: 0.45,
    ornament: 'simple',
  });
  victoryAd.group.position.set(4.5, 7, 3.06);
  g.add(victoryAd.group);
  _disposeTargets.push(victoryAd);

  // ── Rooftop billboard frame ──
  const billboardGroup = new THREE.Group();
  billboardGroup.name = 'rooftop_billboard';
  const bbTotalH = 5 * 3; // height of building at x=11
  const bbMat = ironMaterial(0.7, palette);
  const bbFrameMat = steelMaterial(0.7, palette);

  // Billboard support legs
  for (const lx of [-2.5, 2.5]) {
    const leg = mkCyl(0.04, 0.04, 2, 6, bbMat);
    leg.position.set(11 + lx, bbTotalH + 1, 0);
    billboardGroup.add(leg);
  }

  // Billboard frame
  const bbFrame = mkBox(6, 3, 0.15, bbFrameMat);
  bbFrame.position.set(11, bbTotalH + 2.5, 0);
  billboardGroup.add(bbFrame);

  // Billboard canvas — fictional brand ad
  const billboardCanvas = document.createElement('canvas');
  billboardCanvas.width = 512;
  billboardCanvas.height = 256;
  const bbCtx = billboardCanvas.getContext('2d')!;
  // Bright orange/yellow gradient
  const bbGrad = bbCtx.createLinearGradient(0, 0, 512, 256);
  bbGrad.addColorStop(0, '#FF6600');
  bbGrad.addColorStop(1, '#FFCC00');
  bbCtx.fillStyle = bbGrad;
  bbCtx.fillRect(0, 0, 512, 256);
  // Brand text
  bbCtx.fillStyle = '#FFFFFF';
  bbCtx.font = 'bold 56px Arial';
  bbCtx.textAlign = 'center';
  bbCtx.fillText('ROCKET SHOE CO.', 256, 100);
  bbCtx.font = 'bold 36px Arial';
  bbCtx.fillText('WALK ON AIR!', 256, 160);
  // Decorative star
  bbCtx.fillStyle = '#FFFF00';
  bbCtx.font = 'bold 80px Arial';
  bbCtx.fillText('★', 256, 220);

  const bbTex = new THREE.CanvasTexture(billboardCanvas);
  const bbFaceMat = new THREE.MeshStandardMaterial({ map: bbTex, roughness: 0.6 });
  const bbFace = new THREE.Mesh(new THREE.PlaneGeometry(5.7, 2.7), bbFaceMat);
  bbFace.position.set(11, bbTotalH + 2.5, 0.08);
  billboardGroup.add(bbFace);

  g.add(billboardGroup);

  // ── Neon sign — "OPEN" on diner ──
  const openCanvas = document.createElement('canvas');
  openCanvas.width = 128;
  openCanvas.height = 32;
  const oCtx = openCanvas.getContext('2d')!;
  oCtx.fillStyle = '#000000';
  oCtx.fillRect(0, 0, 128, 32);
  oCtx.shadowColor = '#00FF00';
  oCtx.shadowBlur = 8;
  oCtx.strokeStyle = '#00FF44';
  oCtx.lineWidth = 2;
  oCtx.font = 'bold 24px Arial';
  oCtx.textAlign = 'center';
  oCtx.strokeText('OPEN', 64, 24);
  oCtx.fillStyle = '#88FF88';
  oCtx.fillText('OPEN', 64, 24);

  const openTex = new THREE.CanvasTexture(openCanvas);
  const openMat = new THREE.MeshStandardMaterial({
    map: openTex,
    emissive: 0x00FF44,
    emissiveIntensity: 0.5,
    emissiveMap: openTex,
    transparent: true,
    depthWrite: false,
  });
  const openSign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.2), openMat);
  openSign.position.set(-5.5, 3.5, 6.5);
  g.add(openSign);

  // ── Hanging sign — Laundromat ──
  const laundryHanging = generateSignage({
    width: 1.2,
    height: 1.5,
    depth: 0.08,
    text: 'SWISH',
    fontSize: 0.3,
    textColor: 0x0044AA,
    bgColor: 0xF0F0F0,
    condition: 0.8,
    ornament: 'simple',
  });
  laundryHanging.group.position.set(2.5, 3, 4.5);
  g.add(laundryHanging.group);
  _disposeTargets.push(laundryHanging);

  // ── Drive-in movie poster (already built in buildings, add small info board) ──
  const driveinInfo = generateSignage({
    width: 2,
    height: 1,
    depth: 0.05,
    text: 'SHOWING\nTONIGHT',
    fontSize: 0.25,
    textColor: 0xFFFF88,
    bgColor: 0x111111,
    condition: 0.6,
    ornament: 'simple',
  });
  driveinInfo.group.position.set(-3, 1.5, 6);
  g.add(driveinInfo.group);
  _disposeTargets.push(driveinInfo);

  return g;
}

// ── Pedestrians ─────────────────────────────────────────────────────

function buildPedestrians(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'pedestrians_1965';
  const palette = getEraPalette();

  // Define pedestrian positions and outfit configs for 1960s fashion
  const pedDefs: Array<{
    x: number; z: number; outfit: PedestrianParams['outfit'];
    hatStyle?: PedestrianParams['hatStyle'];
    accessories?: PedestrianParams['accessories'];
  }> = [
    // Man in narrow-lapel suit
    { x: -20, z: 4.0, outfit: 'business_suit', hatStyle: 'cap', accessories: ['briefcase'] },
    // Woman in swing dress with pillbox hat
    { x: -14, z: 4.0, outfit: 'vintage_formal', hatStyle: 'sun_hat', accessories: ['bag'] },
    // Man in leather jacket (cool guy vibe)
    { x: -8, z: 4.0, outfit: 'worker', hatStyle: false, accessories: [] },
    // Woman in capri pants with beehive (no hat, styled hair implied by outfit)
    { x: -2, z: 4.0, outfit: 'street_urban', hatStyle: false, accessories: ['camera'] },
    // Teenager kid with scooter
    { x: 4, z: 3.8, outfit: 'school_child', hatStyle: 'beanie', accessories: [] },
    // Milk-crate delivery man
    { x: 10, z: 4.0, outfit: 'worker', hatStyle: 'cap', accessories: ['bag'] },
    // Couple walking together
    { x: 16, z: 4.0, outfit: 'downtown_evening', hatStyle: 'beret', accessories: ['umbrella'] },
    { x: 16, z: 3.5, outfit: 'street_urban', hatStyle: 'sun_hat', accessories: ['bag'] },
    // Two more people — one in narrow-lapel suit
    { x: 22, z: 4.0, outfit: 'business_suit', hatStyle: 'cap', accessories: ['newspaper'] },
    // Another woman in capris/beehive style
    { x: 28, z: 4.0, outfit: 'vintage_formal', hatStyle: 'sun_hat', accessories: ['camera'] },
  ];

  for (const pd of pedDefs) {
    const result = generatePedestrian({
      outfit: pd.outfit,
      heightScale: 0.85 + Math.random() * 0.25,
      hatStyle: pd.hatStyle,
      accessories: pd.accessories,
      animated: false,
      condition: 0.75,
      palette: {
        accent: palette.warmSun,
      },
    });
    result.group.position.set(pd.x, 0, pd.z);
    result.group.rotation.y = Math.random() > 0.5 ? 0 : Math.PI;
    g.add(result.group);
    _pedestrians.push(result.group);
    _disposeTargets.push(result);
  }

  // ── Scooter (for the kid pedestrian) ──
  const scooterGroup = new THREE.Group();
  scooterGroup.name = 'kick_scooter';
  const scooterMat = new THREE.MeshStandardMaterial({ color: 0x4488CC, roughness: 0.4, metalness: 0.3 });
  const scooterChromeMat = chromeMat(palette.chromeAccent, 0.8);

  // Deck
  const deck = mkBox(0.3, 0.03, 0.12, scooterMat);
  deck.position.set(-2, 0.35, 3.8);
  scooterGroup.add(deck);

  // Steering column
  const stem = mkCyl(0.015, 0.015, 0.7, 6, scooterChromeMat);
  stem.position.set(-2, 0.7, 3.8);
  scooterGroup.add(stem);

  // Handlebar
  const handlebar = mkCyl(0.012, 0.012, 0.2, 6, scooterChromeMat);
  handlebar.rotation.z = Math.PI / 2;
  handlebar.position.set(-2, 1.05, 3.8);
  scooterGroup.add(handlebar);

  // Wheels
  for (const wz of [-0.05, 0.05]) {
    const wheelGeo = new THREE.TorusGeometry(0.08, 0.02, 8, 16);
    const wheel = new THREE.Mesh(wheelGeo, new THREE.MeshStandardMaterial({ color: 0x1A1A1A, roughness: 0.9 }));
    wheel.position.set(-2, 0.08, 3.8 + wz);
    wheel.rotation.y = Math.PI / 2;
    scooterGroup.add(wheel);
  }

  g.add(scooterGroup);

  return g;
}

// ── Props ───────────────────────────────────────────────────────────

function buildProps(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'props_1965';
  const palette = getEraPalette();

  // ── Angled chrome parking meters ──
  const meterPositions = [
    { x: -22, z: 4.0 },
    { x: -15, z: 4.0 },
    { x: -9, z: 4.0 },
    { x: -1, z: 4.0 },
    { x: 7, z: 4.0 },
    { x: 14, z: 4.0 },
    { x: 21, z: 4.0 },
    { x: 28, z: 4.0 },
  ];
  for (const mp of meterPositions) {
    const meterGroup = new THREE.Group();
    meterGroup.name = 'parking_meter';

    // Angled post (characteristic of 1960s angled meters)
    const postMat = chromeMat(palette.chromeAccent, 0.8);
    const post = mkCyl(0.025, 0.03, 1.2, 8, postMat);
    post.position.set(mp.x, 0.6, mp.z);
    post.rotation.z = 0.15; // slight angle outward
    meterGroup.add(post);

    // Meter head (rounded rectangular)
    const headMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.3, metalness: 0.6 });
    const head = mkBox(0.15, 0.12, 0.1, headMat);
    head.position.set(mp.x + 0.02, 1.25, mp.z);
    meterGroup.add(head);

    // Coin slot area
    const slotMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.2, metalness: 0.7 });
    const slot = mkBox(0.04, 0.06, 0.01, slotMat);
    slot.position.set(mp.x + 0.02, 1.25, mp.z + 0.055);
    meterGroup.add(slot);

    // Base plate
    const basePlate = mkCyl(0.08, 0.1, 0.02, 8, postMat);
    basePlate.position.set(mp.x, 0.01, mp.z);
    meterGroup.add(basePlate);

    g.add(meterGroup);
  }

  // ── Telephone booth ──
  const phoneBoothResult = generateProp({
    type: 'phone_booth',
    scale: 1,
    color: 0x2244AA,
    ornate: false,
    condition: 0.7,
  });
  phoneBoothResult.group.position.set(-12, 0, 4.2);
  g.add(phoneBoothResult.group);
  _disposeTargets.push(phoneBoothResult);

  // ── Mailbox (classic rural/free-standing style) ──
  const mailboxResult = generateProp({
    type: 'mailbox',
    scale: 1,
    color: 0x003366,
    condition: 0.65,
  });
  mailboxResult.group.position.set(15, 0, 4.2);
  g.add(mailboxResult.group);
  _disposeTargets.push(mailboxResult);

  // ── Newspaper vending boxes ──
  const newsboxPositions = [
    { x: 20, z: 4.0 },
    { x: 27, z: 4.0 },
  ];
  for (const nbp of newsboxPositions) {
    const nbResult = generateProp({
      type: 'newspaper_box',
      scale: 1,
      color: 0x444444,
    });
    nbResult.group.position.set(nbp.x, 0, nbp.z);
    g.add(nbResult.group);
    _disposeTargets.push(nbResult);
  }

  // ── Yellow-cased traffic lights ──
  const trafficLightPositions = [
    { x: -5, z: 4.5 },
    { x: 25, z: 4.5 },
  ];
  for (const tlp of trafficLightPositions) {
    const tlGroup = new THREE.Group();
    tlGroup.name = 'traffic_light';

    // Post
    const tlPostMat = ironMaterial(0.7, palette);
    const tlPost = mkCyl(0.03, 0.035, 3.5, 8, tlPostMat);
    tlPost.position.set(tlp.x, 1.75, tlp.z);
    tlGroup.add(tlPost);

    // Yellow housing
    const yellowCaseMat = new THREE.MeshStandardMaterial({ color: 0xCCBB22, roughness: 0.4 });
    const housing = mkBox(0.2, 0.6, 0.15, yellowCaseMat);
    housing.position.set(tlp.x, 3.5, tlp.z);
    tlGroup.add(housing);

    // Three light lenses
    const lensColors = [0xFF0000, 0xFFDD00, 0x00CC00];
    for (let li = 0; li < 3; li++) {
      const lensMat = new THREE.MeshStandardMaterial({
        color: lensColors[li],
        roughness: 0.2,
        emissive: li === 1 ? 0xFFDD00 : 0x000000,
        emissiveIntensity: li === 1 ? 0.3 : 0,
      });
      const lens = mkCyl(0.06, 0.06, 0.03, 8, lensMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(tlp.x, 3.7 - li * 0.18, tlp.z + 0.09);
      tlGroup.add(lens);
    }

    // Visor over each light
    for (let li = 0; li < 3; li++) {
      const visorMat = yellowCaseMat;
      const visor = mkBox(0.22, 0.04, 0.08, visorMat);
      visor.position.set(tlp.x, 3.7 - li * 0.18 + 0.04, tlp.z + 0.12);
      tlGroup.add(visor);
    }

    g.add(tlGroup);
  }

  // ── Striped awnings on storefronts ──
  const awningPositions = [
    { x: -7, z: 4, width: 3.5, color: 0xCC3333 },   // Nebula Diner
    { x: 0, z: 4, width: 3.5, color: 0x3366CC },     // Swish Laundry
    { x: 8, z: 4, width: 3.5, color: 0xCC8833 },     // Star Signal Repair
    { x: 18, z: 4, width: 3.5, color: 0x226633 },    // Atlantic Petroleum
  ];
  for (const aw of awningPositions) {
    const awningMat = new THREE.MeshStandardMaterial({
      color: aw.color,
      roughness: 0.7,
      side: THREE.DoubleSide,
    });
    // Awning canopy — angled plane
    const awningPlane = mkBox(aw.width, 0.05, 1.8, awningMat);
    awningPlane.position.set(aw.x, 2.8, aw.z + 0.8);
    awningPlane.rotation.x = -0.15;
    g.add(awningPlane);

    // Stripes on awning using thin darker planes
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      roughness: 0.7,
      side: THREE.DoubleSide,
    });
    for (let si = 0; si < 4; si++) {
      const stripe = mkBox(0.15, 0.06, 1.8, stripeMat);
      stripe.position.set(aw.x - aw.width / 2 + 0.5 + si * 0.8, 2.8, aw.z + 0.8);
      stripe.rotation.x = -0.15;
      g.add(stripe);
    }

    // Support poles
    const poleMat = ironMaterial(0.75, palette);
    for (const side of [-1, 1]) {
      const pole = mkCyl(0.02, 0.02, 1.5, 6, poleMat);
      pole.position.set(aw.x + side * aw.width / 2, 2.1, aw.z + 1.6);
      g.add(pole);
    }
  }

  // ── Lamp posts (updated style for 1965 — simpler, less ornate) ──
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
      style: 'modern',
      lit: true,
      ornate: false,
      condition: 0.8,
    });
    result.group.position.set(lp.x, 0, lp.z);
    g.add(result.group);
    _disposeTargets.push(result);
  }

  // ── Cast-iron hydrants (still present but fewer) ──
  const hydrantPositions = [
    { x: -16, z: 4.0 },
    { x: 5, z: 4.0 },
    { x: 18, z: 4.0 },
  ];
  for (const hp of hydrantPositions) {
    const result = generateProp({
      type: 'hydrant',
      scale: 1,
      color: 0xCC3333, // brighter red, better maintained
      condition: 0.7,
    });
    result.group.position.set(hp.x, 0, hp.z);
    g.add(result.group);
    _disposeTargets.push(result);
  }

  // ── Bench on sidewalk ──
  const benchResult = generateProp({
    type: 'bench',
    scale: 1,
    style: 'modern',
    condition: 0.8,
  });
  benchResult.group.position.set(14, 0, 4.0);
  g.add(benchResult.group);
  _disposeTargets.push(benchResult);

  // ── Trash can (updated style) ──
  const trashResult = generateProp({
    type: 'trash_can',
    scale: 1,
    condition: 0.7,
  });
  trashResult.group.position.set(30, 0, 4.0);
  g.add(trashResult.group);
  _disposeTargets.push(trashResult);

  // ── Bollards along curb ──
  const bollardPositions = [
    { x: -25, z: 4.8 },
    { x: -8, z: 4.8 },
    { x: 25, z: 4.8 },
  ];
  for (const bp of bollardPositions) {
    const bollardResult = generateProp({
      type: 'bollard',
      scale: 1,
      condition: 0.8,
    });
    bollardResult.group.position.set(bp.x, 0, bp.z);
    g.add(bollardResult.group);
    _disposeTargets.push(bollardResult);
  }

  return g;
}

// ══════════════════════════════════════════════════════════════════════
// ATMOSPHERE — 1965-specific lighting and mood
// ══════════════════════════════════════════════════════════════════════

function buildAtmosphere(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'atmosphere_1965';
  const palette = getEraPalette();

  // Cleaner sky than 1945 — less coal smoke, more clarity
  // Subtle haze instead of heavy smog
  const hazeMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(palette.mutedSky).multiplyScalar(0.3),
    transparent: true,
    opacity: 0.06,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const hazeSphere = new THREE.Mesh(
    new THREE.SphereGeometry(60, 16, 12),
    hazeMat,
  );
  hazeSphere.position.set(0, 20, -20);
  hazeSphere.renderOrder = -1;
  g.add(hazeSphere);

  // Brighter, warmer sunlight — post-war prosperity lighting
  const sunLight = new THREE.DirectionalLight(0xFFEECC, 1.0);
  sunLight.position.set(20, 30, -10);
  sunLight.castShadow = false;
  g.add(sunLight);

  // Warm ambient fill — slightly brighter than 1945
  const warmAmbient = new THREE.AmbientLight(0xFFDDCC, 0.4);
  g.add(warmAmbient);

  // Subtle ground-level fog (much lighter than 1945)
  const fogMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(palette.coalSmoke).multiplyScalar(0.2),
    transparent: true,
    opacity: 0.03,
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
 * The complete 1965 era content module.
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
 *   - Renovated 1945 brick stock — cleaned/repointed with higher condition
 *   - Modernist ground-floor shopfronts with enamel/plastic fascia signs
 *   - Chrome-trimmed NEBULA DINER with neon sign and jukebox silhouette
 *   - SWISH LAUNDRY with large display windows showing washing machines
 *   - STAR SIGNAL radio & TV repair shop with rooftop antenna array
 *   - Freestanding bowling-pin roadside sign (red stripes on white)
 *   - Drive-in movie lot with large movie poster screen (fictional "Rocket to the Moon")
 *   - Rooftop billboard for fictional "Rocket Shoe Co." brand
 *   - Painted wall ads: Oasis Cola, Finest Leather Goods, Golden Harvest
 *     Cigarettes, U.S. Savings Bonds
 *   - Vehicles: chrome-and-finned sedans (blue, red), pickup truck,
 *     VW-style cream microbus, rounded-fender transit green city bus,
 *     yellow taxi with roof light
 *   - Pedestrians: men in narrow-lapel suits/caps, women in swing dresses
 *     with sun/pillbox hats, capri-clad urbanite with camera, teenager
 *     with kick scooter, milk-crate delivery man
 *   - Props: angled chrome parking meters, telephone booth, classic
 *     mailbox, newspaper vending boxes, yellow-cased traffic lights,
 *     striped canvas awnings, modern lamp posts
 *   - Cleaner atmosphere than 1945 — brighter sunlight, minimal haze
 *
 * All signage uses fictionalized brand names to avoid trademark issues.
 * Palette conventions are reused from era-1945-content via getEraPalette().
 */
export const era1965: EraContentModule = {
  id: '1965',

  /** Build and return a single THREE.Group with named category children. */
  build(): THREE.Group {
    const root = new THREE.Group();
    root.name = 'era_1965';

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
    // Animate neon signs — pulse the emissive intensity
    const now = _elapsed * 2;
    const neonIntensity = 0.4 + Math.sin(now * 3) * 0.2;

    if (_builtContent) {
      // Find and animate neon elements
      _builtContent.buildings.traverse((obj: unknown) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (!mesh.material) return;
        const mats: THREE.Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (m instanceof THREE.MeshStandardMaterial && m.emissiveMap) {
            // Neon signs pulse gently
            m.emissiveIntensity = neonIntensity;
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
