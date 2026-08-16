import * as THREE from 'three';
import { generateBuilding } from '../era-content/toolkit/building';
import { generateVehicle } from '../era-content/toolkit/vehicle';
import { generateSignage } from '../era-content/toolkit/signage';
import { generatePedestrian, PedestrianParams } from '../era-content/toolkit/pedestrian';
import { generateProp } from '../era-content/toolkit/props';
import { generateStorefront } from '../era-content/toolkit/storefront';
import { getEraPalette } from './_shared/paletteHelpers';

// ──────────────────────────────────────────────────────────────────────
// EraContentModule interface — the shared contract all era modules follow
// ──────────────────────────────────────────────────────────────────────

export interface EraContentModule {
  id: string;
  build(): THREE.Group;
  update(dt: number, elapsed: number): void;
  setTransitionProgress(p: number): void;
  dispose(): void;
}

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
// PALETTE — early-2000s gentrification tones
// ══════════════════════════════════════════════════════════════════════

function get2005Palette(): Record<string, number> {
  const base = getEraPalette();
  return {
    ...base,
    // Sandblasted gentrified brick — cleaned stock red
    brickRed: 0xC47A5A,
    brickBrown: 0xA06848,
    // Glass-and-steel palette
    blueTintGlass: 0x4488BB,
    clearGlass: 0xCCDDEE,
    steelFrame: 0x8899AA,
    aluminum: 0xBBCCDD,
    // Rooftop AC / mechanical
    acWhite: 0xEEEEEE,
    acGrey: 0x777777,
    // Advertising vinyl colors (early-2000s gradient-heavy)
    adBlue: 0x2255CC,
    adPurple: 0x6633AA,
    adPink: 0xFF4488,
    adOrange: 0xFF8833,
    adYellow: 0xFFCC22,
    // Security shutters
    shutterSilver: 0xAAAAAA,
    // Awning / canopy colors
    awningGreen: 0x228833,
    // Vehicle body-color bumpers
    bodyColor: 0xCCCCCC,
    // Street props
    trafficLightBlack: 0x222222,
    cctvGrey: 0x555555,
    planterBrown: 0x6B4226,
  };
}

// ══════════════════════════════════════════════════════════════════════
// BUILDINGS — sandblasted gentrified brick + glass-and-steel insertions
// ══════════════════════════════════════════════════════════════════════

function buildBuildings(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'buildings_2005';
  const palette = get2005Palette();

  // ── Gentrified original stock buildings (sandblasted brick) ──
  // These are the surviving 1945-era walk-ups with sandblasted brick
  // facades, restored masonry, and modernized ground floors

  const gentrifiedDefs = [
    { x: -22, width: 5, floors: 4, style: 'brick_classic', cornice: 'simple' },
    { x: -14, width: 4.5, floors: 3, style: 'brick_classic', cornice: 'simple' },
    { x: -5, width: 5, floors: 4, style: 'brick_classic', cornice: 'decorated' },
    { x: 6, width: 4, floors: 3, style: 'brick_classic', cornice: 'simple' },
    { x: 15, width: 5, floors: 4, style: 'brick_classic', cornice: 'simple' },
    { x: 24, width: 4.5, floors: 3, style: 'brick_classic', cornice: 'elaborate' },
  ];

  for (const def of gentrifiedDefs) {
    const result = generateBuilding({
      width: def.width,
      depth: 6,
      floors: def.floors,
      floorHeight: 3,
      style: 'brick_classic' as const,
      cornice: def.cornice as 'none' | 'simple' | 'decorated' | 'elaborate',
      rooftop: undefined as 'flat' | 'parapet' | 'dome' | 'water_tank' | 'penthouse' | 'green_roof' | undefined,
      fireEscape: Math.random() > 0.5,
      awning: false,
      condition: 0.75, // gentrified = good condition
      baseColor: palette.brickRed,
    });
    result.group.position.x = def.x;
    g.add(result.group);
    _disposeTargets.push(result);

    // ── Sandblasted brick effect ──
    // Apply a lighter, cleaner brick material over the facade
    const facadeGroup = result.group.children[0] as THREE.Group | undefined;
    if (facadeGroup && facadeGroup.name?.includes('brick')) {
      facadeGroup.traverse((child: unknown) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        const matOrArr = mesh.material;
        const mats: THREE.Material[] = Array.isArray(matOrArr) ? matOrArr : [matOrArr];
        for (const m of mats) {
          if (m instanceof THREE.MeshStandardMaterial) {
            // Sandblasted brick: lighter, less saturated, slightly rougher
            const c = new THREE.Color(palette.brickRed);
            c.multiplyScalar(1.1); // brighter
            m.color.copy(c);
            m.roughness = 0.8;
          }
        }
      });
    }

    // ── Rooftop AC units on gentrified buildings ──
    if (Math.random() > 0.3) {
      const acGroup = new THREE.Group();
      acGroup.name = 'rooftop_ac_unit';
      const totalH = def.floors * 3;
      const acMat = new THREE.MeshStandardMaterial({ color: palette.acWhite, roughness: 0.6, metalness: 0.3 });
      const ventMat = new THREE.MeshStandardMaterial({ color: palette.acGrey, roughness: 0.5, metalness: 0.5 });

      // Main AC housing box
      const acHousing = mkBox(1.2, 1.0, 0.8, acMat);
      acHousing.position.set(def.width * 0.2, totalH + 0.5, -1.5);
      acGroup.add(acHousing);

      // Fan grille (horizontal slats on front face)
      for (let s = 0; s < 5; s++) {
        const slat = mkBox(0.8, 0.03, 0.02, ventMat);
        slat.position.set(def.width * 0.2, totalH + 0.25 + s * 0.15, -1.08);
        acGroup.add(slat);
      }

      // Ventilation pipe
      const pipe = mkCyl(0.06, 0.06, 0.6, 8, ventMat);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(def.width * 0.2, totalH + 0.8, -1.8);
      acGroup.add(pipe);

      // Second smaller unit on some buildings
      if (Math.random() > 0.5) {
        const ac2 = mkBox(0.8, 0.7, 0.6, acMat);
        ac2.position.set(-def.width * 0.15, totalH + 0.35, -1.3);
        acGroup.add(ac2);
      }

      g.add(acGroup);
    }
  }

  // ── New glass-and-steel low-rise office/retail building ──
  // This is a new insertion between existing structures
  const gsX = -9; // positioned between -14 and -5
  const gsResult = generateBuilding({
    width: 7,
    depth: 8,
    floors: 3,
    floorHeight: 3.2,
    style: 'modernist', // glass-and-steel via toolkit
    cornice: 'none' as const,
    rooftop: 'flat' as const,
    fireEscape: false,
    awning: false,
    condition: 0.95,
    wallMaterial: 'glass',
    baseColor: palette.blueTintGlass,
  });
  gsResult.group.position.x = gsX;
  g.add(gsResult.group);
  _disposeTargets.push(gsResult);

  // Enhance with additional blue-tinted glazing strips
  const totalGH = 3 * 3.2;
  const frameMat = new THREE.MeshStandardMaterial({ color: palette.steelFrame, roughness: 0.4, metalness: 0.6 });

  // Horizontal steel mullions
  for (let f = 0; f <= 3; f++) {
    const beam = mkBox(7.2, 0.08, 0.08, frameMat);
    beam.position.set(gsX, f * 3.2, 4.05);
    g.add(beam);
  }
  // Vertical mullions
  for (let v = 0; v <= 6; v++) {
    const mullion = mkCyl(0.03, 0.03, totalGH, 8, frameMat);
    mullion.position.set(gsX - 3.4 + v * 1.36, totalGH / 2, 4.05);
    g.add(mullion);
  }

  // Additional rooftop parapet + mechanical screening
  const parapet = mkBox(7.4, 0.6, 8.4, new THREE.MeshStandardMaterial({ color: palette.aluminum, roughness: 0.5, metalness: 0.4 }));
  parapet.position.set(gsX, totalGH + 0.3, 0);
  g.add(parapet);

  // Rooftop AC units on glass building
  for (let i = 0; i < 3; i++) {
    const acUnit = mkBox(1.0, 0.9, 0.7, new THREE.MeshStandardMaterial({ color: palette.acWhite, roughness: 0.6, metalness: 0.3 }));
    acUnit.position.set(gsX - 2 + i * 2, totalGH + 0.75, -2);
    g.add(acUnit);
  }

  // ── Ground-floor storefronts on gentrified buildings ──
  // Aluminum-frame glass shopfronts with backlit signage
  const storefrontDefs = [
    { x: -22, width: 4, type: 'internet_cafe' },
    { x: -5, width: 4.5, type: 'phone_shop' },
    { x: 6, width: 3.5, type: 'dvd_rental' },
    { x: 15, width: 4, type: 'coffee_shop' },
    { x: 24, width: 3.5, type: 'general' },
  ];

  for (const sfDef of storefrontDefs) {
    const storefront = generateStorefront({
      width: sfDef.width,
      height: 3.2,
      depth: 0.4,
      windowRatio: 0.85,
      doorType: 'single',
      kickPanel: 'metal',
      awning: sfDef.type === 'coffee_shop' ? 'canvas' : false,
      hangingSign: true,
      signText: sfDef.type === 'coffee_shop' ? 'CAFÉ' : '',
      displayCaseMaterial: 'glass',
      interiorLight: 0xFFFFEE,
      condition: 0.85,
      accentColor: palette.aluminum,
    });

    storefront.group.position.set(sfDef.x, 0, 3.2);
    g.add(storefront.group);
    _disposeTargets.push(storefront);

    // ── Aluminum frame overlay (enhancement for 2000s look) ──
    const alumFrame = new THREE.MeshStandardMaterial({ color: palette.aluminum, roughness: 0.3, metalness: 0.7 });

    // Vertical aluminum dividers in display windows
    for (let d = 0; d < 2; d++) {
      const divider = mkBox(0.04, 2.2, 0.04, alumFrame);
      divider.position.set(sfDef.x - 0.8 + d * 1.6, 1.3, 3.65);
      g.add(divider);
    }

    // Backlit fascia sign panel above storefront
    const signBack = mkBox(sfDef.width + 0.3, 0.6, 0.06, new THREE.MeshStandardMaterial({
      color: 0x222222, roughness: 0.3, emissive: 0x333333, emissiveIntensity: 0.3,
    }));
    signBack.position.set(sfDef.x, 3.5, 3.6);
    g.add(signBack);

    // Sign text canvas
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 256;
    signCanvas.height = 64;
    const sCtx = signCanvas.getContext('2d')!;
    sCtx.fillStyle = '#111111';
    sCtx.fillRect(0, 0, 256, 64);
    sCtx.font = 'bold 28px Arial, sans-serif';
    sCtx.textAlign = 'center';
    sCtx.textBaseline = 'middle';
    const labelMap: Record<string, string> = {
      internet_cafe: 'NET CAFE',
      phone_shop: 'MOBILE WORLD',
      dvd_rental: 'DVD & GAME RENTAL',
      coffee_shop: 'COFFEE HOUSE',
      general: 'SHOP',
    };
    sCtx.fillStyle = '#FFFFFF';
    sCtx.fillText(labelMap[sfDef.type], 128, 32);
    const signTex = new THREE.CanvasTexture(signCanvas);
    const signPlane = mkBox(sfDef.width + 0.1, 0.45, 0.01, new THREE.MeshBasicMaterial({ map: signTex }));
    signPlane.position.set(sfDef.x, 3.5, 3.65);
    g.add(signPlane);
  }

  // ── Roll-down security shutters (some closed) ──
  const shutterPositions = [
    { x: -17, z: 3.3, w: 2.5, open: false },   // closed shutter
    { x: 10, z: 3.3, w: 2.0, open: false },     // closed shutter
    { x: 20, z: 3.3, w: 3.0, open: true },      // open shutter
  ];
  for (const sp of shutterPositions) {
    const shutterGroup = new THREE.Group();
    shutterGroup.name = `security_shutter_${sp.open ? 'open' : 'closed'}`;
    const shutterMat = new THREE.MeshStandardMaterial({ color: palette.shutterSilver, roughness: 0.4, metalness: 0.7 });

    if (!sp.open) {
      // Closed shutter — full-height rolled-down panel
      const panel = mkBox(sp.w, 2.8, 0.06, shutterMat);
      panel.position.set(sp.x, 1.4, sp.z);
      shutterGroup.add(panel);

      // Horizontal rib lines on shutter
      for (let r = 0; r < 8; r++) {
        const rib = mkBox(sp.w + 0.02, 0.02, 0.08, shutterMat);
        rib.position.set(sp.x, 0.3 + r * 0.35, sp.z);
        shutterGroup.add(rib);
      }
    } else {
      // Open shutter — rolled up at top
      const rolledUp = mkBox(sp.w + 0.2, 0.2, 0.1, shutterMat);
      rolledUp.position.set(sp.x, 2.9, sp.z);
      shutterGroup.add(rolledUp);

      // Guide rails on sides
      for (const side of [-1, 1]) {
        const rail = mkCyl(0.015, 0.015, 2.8, 6, shutterMat);
        rail.position.set(sp.x + side * sp.w / 2, 1.4, sp.z);
        shutterGroup.add(rail);
      }
    }

    g.add(shutterGroup);
  }

  // ── ATMs mounted on building walls ──
  const atmPositions = [
    { x: -11.5, z: 3.1, rotY: 0 },
    { x: 3, z: 3.1, rotY: 0 },
  ];
  for (const ap of atmPositions) {
    const atmGroup = new THREE.Group();
    atmGroup.name = 'atm_wall_mounted';
    const atmMat = new THREE.MeshStandardMaterial({ color: 0xCCCCBB, roughness: 0.5, metalness: 0.3 });

    // ATM enclosure box
    const enclosure = mkBox(0.8, 1.4, 0.3, atmMat);
    enclosure.position.set(ap.x, 1.2, ap.z);
    atmGroup.add(enclosure);

    // Screen
    const screenMat = new THREE.MeshStandardMaterial({ color: 0x334455, emissive: 0x446688, emissiveIntensity: 0.5 });
    const screen = mkBox(0.5, 0.35, 0.02, screenMat);
    screen.position.set(ap.x, 1.5, ap.z + 0.17);
    atmGroup.add(screen);

    // Card slot
    const cardSlot = mkBox(0.15, 0.03, 0.03, new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3 }));
    cardSlot.position.set(ap.x, 1.0, ap.z + 0.17);
    atmGroup.add(cardSlot);

    // "ATM" illuminated label
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 128;
    labelCanvas.height = 32;
    const lCtx = labelCanvas.getContext('2d')!;
    lCtx.fillStyle = '#0044AA';
    lCtx.fillRect(0, 0, 128, 32);
    lCtx.font = 'bold 20px Arial';
    lCtx.fillStyle = '#FFFFFF';
    lCtx.textAlign = 'center';
    lCtx.textBaseline = 'middle';
    lCtx.fillText('ATM', 64, 16);
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelPlane = mkBox(0.6, 0.15, 0.01, new THREE.MeshBasicMaterial({ map: labelTex }));
    labelPlane.position.set(ap.x, 2.0, ap.z + 0.17);
    atmGroup.add(labelPlane);

    g.add(atmGroup);
  }

  // ── Internet café interior hint (CRT monitors visible through window) ──
  const cafeGroup = new THREE.Group();
  cafeGroup.name = 'internet_cafe_interior';
  const crtMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
  const crtScreenMat = new THREE.MeshStandardMaterial({ color: 0x33AA44, emissive: 0x22AA33, emissiveIntensity: 0.8 });
  for (let i = 0; i < 4; i++) {
    // CRT monitor body
    const monitor = mkBox(0.35, 0.3, 0.3, crtMat);
    monitor.position.set(-21 + i * 0.5, 1.5, 3.3);
    cafeGroup.add(monitor);
    // Glowing CRT screen
    const scr = mkBox(0.28, 0.22, 0.01, crtScreenMat);
    scr.position.set(-21 + i * 0.5, 1.5, 3.48);
    cafeGroup.add(scr);
    // Desk surface
    const desk = mkBox(0.5, 0.04, 0.35, new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.8 }));
    desk.position.set(-21 + i * 0.5, 1.1, 3.3);
    cafeGroup.add(desk);
  }
  g.add(cafeGroup);

  // ── Mobile phone shop — flip phones in window display ──
  const phoneGroup = new THREE.Group();
  phoneGroup.name = 'mobile_phone_display';
  const phoneDisplayMat = new THREE.MeshStandardMaterial({ color: 0xDDDDDD, roughness: 0.3, emissive: 0x333333, emissiveIntensity: 0.2 });
  // Display shelf
  const shelf = mkBox(1.5, 0.04, 0.3, phoneDisplayMat);
  shelf.position.set(-4.5, 1.3, 3.3);
  phoneGroup.add(shelf);
  // Flip phones (small rectangular boxes)
  const flipPhoneColors = [0x111111, 0x333333, 0x888888, 0xCCCCCC];
  for (let i = 0; i < 4; i++) {
    const fp = mkBox(0.12, 0.2, 0.04, new THREE.MeshStandardMaterial({ color: flipPhoneColors[i], roughness: 0.4, metalness: 0.2 }));
    fp.position.set(-5.0 + i * 0.33, 1.43, 3.3);
    phoneGroup.add(fp);
    // Small price tag/placard
    const tag = mkBox(0.1, 0.06, 0.01, new THREE.MeshStandardMaterial({ color: 0xFFEECC, roughness: 0.8 }));
    tag.position.set(-5.0 + i * 0.33, 1.28, 3.45);
    phoneGroup.add(tag);
  }
  g.add(phoneGroup);

  // ── DVD/Game rental store interior hint ──
  const dvdGroup = new THREE.Group();
  dvdGroup.name = 'dvd_rental_shelves';
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.3 });
  for (let row = 0; row < 2; row++) {
    const longShelf = mkBox(2.5, 0.03, 0.3, shelfMat);
    longShelf.position.set(7.5, 0.8 + row * 0.6, 3.3);
    dvdGroup.add(longShelf);
    // DVD cases (colorful thin boxes)
    const dvdColors = [0xCC2222, 0x2244AA, 0x22AA44, 0xAA8822, 0x8822AA, 0xAA4422];
    for (let d = 0; d < 8; d++) {
      const case_ = mkBox(0.12, 0.25, 0.02, new THREE.MeshStandardMaterial({ color: dvdColors[d % dvdColors.length], roughness: 0.5 }));
      case_.position.set(6.3 + d * 0.3, 0.95 + row * 0.6, 3.3);
      dvdGroup.add(case_);
    }
  }
  g.add(dvdGroup);

  return g;
}

// ══════════════════════════════════════════════════════════════════════
// VEHICLES — rounded aerodynamic sedans, SUVs, minivan, hybrid, taxi
// ══════════════════════════════════════════════════════════════════════

function buildVehicles(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'vehicles_2005';
  const palette = get2005Palette();

  // ── Parked vehicles along curb ──
  // Rounded aerodynamic sedan (silver)
  const sedan1 = generateVehicle({
    type: 'sedan',
    scale: 1.0,
    paintColor: 0xCCCCCC,
    chromeColor: palette.chromeAccent,
    wheelStyle: 'spoke',
    bumperStyle: 'minimal',
    headlightStyle: 'rectangular',
    taillightStyle: 'vertical_strip',
    condition: 0.8,
  });
  sedan1.group.position.set(-20, 0, 5.5);
  g.add(sedan1.group);
  _disposeTargets.push(sedan1);

  // Rounded aerodynamic sedan (dark blue)
  const sedan2 = generateVehicle({
    type: 'sedan',
    scale: 1.0,
    paintColor: 0x223366,
    chromeColor: palette.chromeAccent,
    wheelStyle: 'spoke',
    bumperStyle: 'minimal',
    headlightStyle: 'rectangular',
    taillightStyle: 'vertical_strip',
    condition: 0.75,
  });
  sedan2.group.position.set(-12, 0, 5.5);
  g.add(sedan2.group);
  _disposeTargets.push(sedan2);

  // SUV (large, boxy but rounded — silver)
  const suv = generateVehicle({
    type: 'sedan', // toolkit uses 'sedan' for large cars; we'll add SUV proportions
    scale: 1.15,
    paintColor: 0xDDDDDD,
    chromeColor: palette.chromeAccent,
    wheelStyle: 'heavy_duty',
    bumperStyle: 'minimal',
    headlightStyle: 'rectangular',
    taillightStyle: 'vertical_strip',
    condition: 0.85,
  });
  suv.group.position.set(-3, 0, 5.5);
  g.add(suv.group);
  _disposeTargets.push(suv);

  // Minivan (beige/tan)
  const minivan = generateVehicle({
    type: 'van',
    scale: 1.0,
    paintColor: 0xD4C4A0,
    chromeColor: palette.chromeAccent,
    wheelStyle: 'spoke',
    bumperStyle: 'minimal',
    headlightStyle: 'rectangular',
    taillightStyle: 'vertical_strip',
    condition: 0.7,
  });
  minivan.group.position.set(5, 0, 5.5);
  g.add(minivan.group);
  _disposeTargets.push(minivan);

  // Hatchback (red, body-color bumpers)
  const hatchback = generateVehicle({
    type: 'sedan',
    scale: 0.9,
    paintColor: 0xCC3333,
    chromeColor: palette.bodyColor,
    wheelStyle: 'spoke',
    bumperStyle: 'minimal',
    headlightStyle: 'rectangular',
    taillightStyle: 'vertical_strip',
    condition: 0.8,
  });
  hatchback.group.position.set(12, 0, 5.5);
  g.add(hatchback.group);
  _disposeTargets.push(hatchback);

  // Hybrid (green-silver two-tone, subtle badging)
  const hybrid = generateVehicle({
    type: 'sedan',
    scale: 1.0,
    paintColor: 0x88AA88,
    chromeColor: palette.chromeAccent,
    wheelStyle: 'spoke',
    bumperStyle: 'minimal',
    headlightStyle: 'rectangular',
    taillightStyle: 'vertical_strip',
    condition: 0.9,
  });
  hybrid.group.position.set(18, 0, 5.5);
  g.add(hybrid.group);
  _disposeTargets.push(hybrid);

  // Add subtle "HYBRID" badge to hybrid vehicle
  const badgeCanvas = document.createElement('canvas');
  badgeCanvas.width = 64;
  badgeCanvas.height = 16;
  const bCtx = badgeCanvas.getContext('2d')!;
  bCtx.fillStyle = '#88AA88';
  bCtx.fillRect(0, 0, 64, 16);
  bCtx.font = 'bold 10px Arial';
  bCtx.fillStyle = '#FFFFFF';
  bCtx.textAlign = 'center';
  bCtx.textBaseline = 'middle';
  bCtx.fillText('HYBRID', 32, 8);
  const badgeTex = new THREE.CanvasTexture(badgeCanvas);
  const badge = mkBox(0.2, 0.05, 0.01, new THREE.MeshBasicMaterial({ map: badgeTex }));
  badge.position.set(18.6, 0.5, 5.5);
  g.add(badge);

  // Modernized taxi (yellow)
  const taxi = generateVehicle({
    type: 'taxi',
    scale: 1.0,
    paintColor: 0xFFCC00,
    chromeColor: palette.chromeAccent,
    wheelStyle: 'heavy_duty',
    bumperStyle: 'chrome_bar',
    headlightStyle: 'rectangular',
    taillightStyle: 'vertical_strip',
    condition: 0.6,
  });
  taxi.group.position.set(24, 0, 5.5);
  g.add(taxi.group);
  _disposeTargets.push(taxi);

  // Add roof light for taxi
  const taxiLight = mkBox(0.5, 0.15, 0.3, new THREE.MeshStandardMaterial({
    color: 0xFFFFFF, emissive: 0xFFDD44, emissiveIntensity: 0.6,
  }));
  taxiLight.position.set(24, 1.3, 5.5);
  g.add(taxiLight);

  return g;
}

// ══════════════════════════════════════════════════════════════════════
// SIGNAGE — billboards, bus-shelter lightboxes, scaffolding banners
// ══════════════════════════════════════════════════════════════════════

function buildSignage(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'signage_2005';

  // ── Large vinyl billboard (painted-wall style on building wall) ──
  // Early-2000s gradient-heavy fictional brand logos
  const billboardGrad = document.createElement('canvas');
  billboardGrad.width = 512;
  billboardGrad.height = 256;
  const bgCtx = billboardGrad.getContext('2d')!;
  // Diagonal gradient (very early 2000s)
  const grad = bgCtx.createLinearGradient(0, 0, 512, 256);
  grad.addColorStop(0, '#2255CC');
  grad.addColorStop(0.5, '#6633AA');
  grad.addColorStop(1, '#FF4488');
  bgCtx.fillStyle = grad;
  bgCtx.fillRect(0, 0, 512, 256);
  // Fictional brand name
  bgCtx.font = 'bold 48px "Arial Black", Impact, sans-serif';
  bgCtx.fillStyle = '#FFFFFF';
  bgCtx.textAlign = 'center';
  bgCtx.textBaseline = 'middle';
  bgCtx.fillText('ZENTRIX', 256, 100);
  bgCtx.font = '24px Arial';
  bgCtx.fillText('The Future Is Now', 256, 150);
  const billboardTex = new THREE.CanvasTexture(billboardGrad);

  const billboardWall = generateSignage({
    width: 7,
    height: 3.5,
    depth: 0.05,
    text: 'ZENTRIX',
    fontSize: 0.3,
    textColor: 0xFFFFFF,
    bgColor: 0x2255CC,
    condition: 0.7,
    ornament: 'simple',
  });
  billboardWall.group.position.set(-17, 5, 3.06);
  g.add(billboardWall.group);
  // Replace background texture with our gradient
  billboardWall.group.traverse((child: unknown) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats: THREE.Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (m instanceof THREE.MeshStandardMaterial && m.map) {
        m.map = billboardTex;
        m.needsUpdate = true;
      }
    }
  });
  _disposeTargets.push(billboardWall);

  // Second vinyl billboard — another fictional brand
  const billboard2Grad = document.createElement('canvas');
  billboard2Grad.width = 512;
  billboard2Grad.height = 256;
  const bg2Ctx = billboard2Grad.getContext('2d')!;
  const grad2 = bg2Ctx.createLinearGradient(0, 256, 512, 0);
  grad2.addColorStop(0, '#FF8833');
  grad2.addColorStop(0.5, '#FFCC22');
  grad2.addColorStop(1, '#FF4488');
  bg2Ctx.fillStyle = grad2;
  bg2Ctx.fillRect(0, 0, 512, 256);
  bg2Ctx.font = 'bold 52px "Arial Black", Impact, sans-serif';
  bg2Ctx.fillStyle = '#FFFFFF';
  bg2Ctx.textAlign = 'center';
  bg2Ctx.textBaseline = 'middle';
  bg2Ctx.fillText('NOVAFLUX', 256, 100);
  bg2Ctx.font = '22px Arial';
  bg2Ctx.fillText('Next Generation Energy', 256, 150);
  const billboard2Tex = new THREE.CanvasTexture(billboard2Grad);

  const billboard2 = generateSignage({
    width: 6,
    height: 3,
    depth: 0.05,
    text: 'NOVAFLUX',
    fontSize: 0.3,
    textColor: 0xFFFFFF,
    bgColor: 0xFF8833,
    condition: 0.65,
    ornament: 'simple',
  });
  billboard2.group.position.set(1, 5, 3.06);
  g.add(billboard2.group);
  billboard2.group.traverse((child: unknown) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats: THREE.Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (m instanceof THREE.MeshStandardMaterial && m.map) {
        m.map = billboard2Tex;
        m.needsUpdate = true;
      }
    }
  });
  _disposeTargets.push(billboard2);

  // ── Scaffolding banners on renovation site ──
  // Positioned between buildings (around x = -7)
  const scaffoldGroup = new THREE.Group();
  scaffoldGroup.name = 'scaffolding_banners';

  // Vertical poles
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5, metalness: 0.5 });
  for (const px of [-7.5, -6.5, -5.5]) {
    const pole = mkCyl(0.03, 0.03, 5, 8, poleMat);
    pole.position.set(px, 2.5, 3.5);
    scaffoldGroup.add(pole);
  }
  // Horizontal cross beams
  for (const py of [1.5, 3.0, 4.5]) {
    const beam = mkBox(2.2, 0.04, 0.04, poleMat);
    beam.position.set(-6.5, py, 3.5);
    scaffoldGroup.add(beam);
  }

  // Banner fabric panels with gradient
  const bannerGrad = document.createElement('canvas');
  bannerGrad.width = 256;
  bannerGrad.height = 128;
  const bCtx = bannerGrad.getContext('2d')!;
  const bannerGr = bCtx.createLinearGradient(0, 0, 256, 128);
  bannerGr.addColorStop(0, '#2255CC');
  bannerGr.addColorStop(0.3, '#4488DD');
  bannerGr.addColorStop(0.7, '#6633AA');
  bannerGr.addColorStop(1, '#FF4488');
  bCtx.fillStyle = bannerGr;
  bCtx.fillRect(0, 0, 256, 128);
  bCtx.font = 'bold 22px Arial';
  bCtx.fillStyle = '#FFFFFF';
  bCtx.textAlign = 'center';
  bCtx.textBaseline = 'middle';
  bCtx.fillText('RENOVATION', 128, 50);
  bCtx.font = '16px Arial';
  bCtx.fillText('COMING SOON', 128, 80);
  const bannerTex = new THREE.CanvasTexture(bannerGrad);

  for (let i = 0; i < 2; i++) {
    const bannerPanel = mkBox(1.0, 1.5, 0.02, new THREE.MeshStandardMaterial({
      map: bannerTex, roughness: 0.8, transparent: true,
    }));
    bannerPanel.position.set(-7.0 + i * 1.0, 2.5, 3.55);
    scaffoldGroup.add(bannerPanel);
  }

  // Safety netting (semi-transparent green mesh)
  const safetyNetMat = new THREE.MeshBasicMaterial({
    color: 0x44AA44, transparent: true, opacity: 0.15, side: THREE.DoubleSide,
  });
  const safetyNet = new THREE.Mesh(new THREE.PlaneGeometry(2, 5), safetyNetMat);
  safetyNet.position.set(-6.5, 2.5, 3.55);
  scaffoldGroup.add(safetyNet);

  g.add(scaffoldGroup);

  // ── Bus shelter lightbox ads ──
  const lightboxPositions = [
    { x: -16, z: 4.0 },
    { x: 8, z: 4.0 },
  ];
  for (const lp of lightboxPositions) {
    const lightboxGroup = new THREE.Group();
    lightboxGroup.name = 'bus_shelter_lightbox';

    // Metal support pole
    const pole = mkCyl(0.04, 0.04, 3, 8, poleMat);
    pole.position.set(lp.x, 1.5, lp.z - 0.3);
    lightboxGroup.add(pole);

    // Lightbox housing (rectangular box)
    const housing = mkBox(1.5, 1.0, 0.15, new THREE.MeshStandardMaterial({
      color: 0x333333, roughness: 0.4, metalness: 0.5,
    }));
    housing.position.set(lp.x, 2.5, lp.z);
    lightboxGroup.add(housing);

    // Gradient overlay for early-2000s ad
    const lbGrad = document.createElement('canvas');
    lbGrad.width = 256;
    lbGrad.height = 128;
    const lbCtx = lbGrad.getContext('2d')!;
    const lbGr = lbCtx.createLinearGradient(0, 0, 256, 128);
    lbGr.addColorStop(0, '#003366');
    lbGr.addColorStop(0.4, '#0066CC');
    lbGr.addColorStop(0.7, '#8833CC');
    lbGr.addColorStop(1, '#FF6699');
    lbCtx.fillStyle = lbGr;
    lbCtx.fillRect(0, 0, 256, 128);
    lbCtx.font = 'bold 28px Arial';
    lbCtx.fillStyle = '#FFFFFF';
    lbCtx.textAlign = 'center';
    lbCtx.textBaseline = 'middle';
    lbCtx.fillText('ENERGYDRIVE', 128, 50);
    lbCtx.font = '14px Arial';
    lbCtx.fillText('Fuel Your Life', 128, 80);
    const lbTex = new THREE.CanvasTexture(lbGrad);

    const display = mkBox(1.3, 0.8, 0.01, new THREE.MeshBasicMaterial({ map: lbTex }));
    display.position.set(lp.x, 2.5, lp.z + 0.08);
    lightboxGroup.add(display);

    // Glow plane behind display
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x6699FF, transparent: true, opacity: 0.1, side: THREE.DoubleSide,
    });
    const glow = mkBox(1.6, 1.1, 0.01, glowMat);
    glow.position.set(lp.x, 2.5, lp.z + 0.05);
    lightboxGroup.add(glow);

    g.add(lightboxGroup);
  }

  return g;
}

// ══════════════════════════════════════════════════════════════════════
// PEDESTRIANS — 2000s fashion: bootcut, cargo, puffer, chunky sneakers
// ══════════════════════════════════════════════════════════════════════

function buildPedestrians(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'pedestrians_2005';
  const palette = get2005Palette();

  const pedDefs: Array<{
    x: number; z: number; outfit: PedestrianParams['outfit'];
    hatStyle?: PedestrianParams['hatStyle'];
    accessories?: PedestrianParams['accessories'];
  }> = [
    // Cargo pants + puffer jacket + chunky sneakers + shopping bag
    { x: -19, z: 4.0, outfit: 'street_urban', hatStyle: false, accessories: ['bag'] },
    // Layered tee + bootcut jeans + wired earbuds + flip phone
    { x: -13, z: 4.0, outfit: 'street_urban', hatStyle: 'beanie', accessories: ['phone'] },
    // Trucker hat + graphic tee + low-rise jeans
    { x: -8, z: 4.0, outfit: 'casual_jeans', hatStyle: 'cap', accessories: [] },
    // Emo/scene fringe + dark layered tee + skinny jeans
    { x: -2, z: 4.0, outfit: 'street_urban', hatStyle: false, accessories: ['bag'] },
    // Puffer jacket + beanie + chunky sneakers
    { x: 4, z: 4.0, outfit: 'casual_jeans', hatStyle: 'beanie', accessories: ['phone'] },
    // Bootcut jeans + layered tee + flip phone
    { x: 10, z: 4.0, outfit: 'casual_jeans', hatStyle: false, accessories: ['phone'] },
    // Cargo pants + oversized hoodie + trucker hat
    { x: 16, z: 4.0, outfit: 'street_urban', hatStyle: 'cap', accessories: ['bag'] },
    // Shopping bags + bootcut jeans + layered top
    { x: 22, z: 4.0, outfit: 'casual_jeans', hatStyle: false, accessories: ['bag', 'phone'] },
    // Wired earbuds + puffer vest + cargo pants
    { x: -25, z: 4.0, outfit: 'street_urban', hatStyle: 'beanie', accessories: ['phone'] },
    // Scene/emo with striped shirt + dark jeans
    { x: 28, z: 4.0, outfit: 'street_urban', hatStyle: false, accessories: ['bag'] },
  ];

  for (const pd of pedDefs) {
    const result = generatePedestrian({
      outfit: pd.outfit,
      heightScale: 0.9 + Math.random() * 0.2,
      hatStyle: pd.hatStyle,
      accessories: pd.accessories,
      animated: false,
      condition: 0.8,
      palette: {
        accent: palette.brickRed,
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

// ══════════════════════════════════════════════════════════════════════
// PROPS — bike racks, sandwich boards, free-weekly boxes, planters
//              CCTV poles, modern traffic lights
// ══════════════════════════════════════════════════════════════════════

function buildProps(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'props_2005';

  // ── Bike racks ──
  const rackPositions = [
    { x: -23, z: 4.0 },
    { x: 11, z: 4.0 },
    { x: 27, z: 4.0 },
  ];
  for (const rp of rackPositions) {
    const rackGroup = new THREE.Group();
    rackGroup.name = 'bike_rack';
    const rackMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.5, metalness: 0.6 });

    // Base rail
    const baseRail = mkCyl(0.02, 0.02, 2.0, 8, rackMat);
    baseRail.rotation.z = Math.PI / 2;
    baseRail.position.set(rp.x, 0.02, rp.z);
    rackGroup.add(baseRail);

    // Inverted U-shaped tubes (parking loops)
    for (let i = 0; i < 3; i++) {
      const loopX = rp.x - 0.6 + i * 0.6;
      // Vertical posts
      const postL = mkCyl(0.015, 0.015, 0.6, 8, rackMat);
      postL.position.set(loopX - 0.2, 0.32, rp.z);
      rackGroup.add(postL);
      const postR = postL.clone();
      postR.position.x = loopX + 0.2;
      rackGroup.add(postR);
      // Top curve (approximated with short horizontal bar)
      const topBar = mkCyl(0.015, 0.015, 0.4, 8, rackMat);
      topBar.rotation.z = Math.PI / 2;
      topBar.position.set(loopX, 0.62, rp.z);
      rackGroup.add(topBar);
    }

    g.add(rackGroup);
  }

  // ── Sandwich board signs (A-frame sidewalk signs) ──
  const sandwichPositions = [
    { x: -6, z: 4.0 },
    { x: 14, z: 4.0 },
  ];
  for (const sp of sandwichPositions) {
    const sbGroup = new THREE.Group();
    sbGroup.name = 'sandwich_board';
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7 });

    // Front panel (angled toward viewer)
    const frontPanel = mkBox(0.6, 0.8, 0.02, boardMat);
    frontPanel.position.set(sp.x, 0.5, sp.z + 0.15);
    frontPanel.rotation.x = -0.2;
    sbGroup.add(frontPanel);

    // Back panel
    const backPanel = mkBox(0.6, 0.8, 0.02, boardMat);
    backPanel.position.set(sp.x, 0.5, sp.z - 0.15);
    backPanel.rotation.x = 0.2;
    sbGroup.add(backPanel);

    // Menu/text on front (canvas texture)
    const menuCanvas = document.createElement('canvas');
    menuCanvas.width = 128;
    menuCanvas.height = 192;
    const mCtx = menuCanvas.getContext('2d')!;
    mCtx.fillStyle = '#FFFFF0';
    mCtx.fillRect(0, 0, 128, 192);
    mCtx.font = 'bold 14px Arial';
    mCtx.fillStyle = '#333333';
    mCtx.textAlign = 'center';
    mCtx.fillText('SPECIALS', 64, 30);
    mCtx.font = '11px Arial';
    mCtx.fillText('Latte $2.50', 64, 60);
    mCtx.fillText('Mocha $3.00', 64, 80);
    mCtx.fillText('Croissant $2.00', 64, 100);
    mCtx.fillText('Espresso $1.50', 64, 120);
    const menuTex = new THREE.CanvasTexture(menuCanvas);
    const textPanel = mkBox(0.55, 0.7, 0.01, new THREE.MeshBasicMaterial({ map: menuTex }));
    textPanel.position.set(sp.x, 0.5, sp.z + 0.17);
    textPanel.rotation.x = -0.2;
    sbGroup.add(textPanel);

    g.add(sbGroup);
  }

  // ── Free weekly newspaper boxes ──
  const freeWeeklyPositions = [
    { x: -10, z: 4.0 },
    { x: 19, z: 4.0 },
  ];
  for (const fw of freeWeeklyPositions) {
    const fwGroup = new THREE.Group();
    fwGroup.name = 'free_weekly_box';

    const boxMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.6, metalness: 0.3 });

    // Angled display box
    const backWall = mkBox(0.5, 0.6, 0.03, boxMat);
    backWall.position.set(fw.x, 0.7, fw.z - 0.1);
    backWall.rotation.x = -0.2;
    fwGroup.add(backWall);

    const shelf = mkBox(0.55, 0.03, 0.25, boxMat);
    shelf.position.set(fw.x, 0.4, fw.z + 0.05);
    fwGroup.add(shelf);

    // Branded front panel
    const brandCanvas = document.createElement('canvas');
    brandCanvas.width = 128;
    brandCanvas.height = 64;
    const brCtx = brandCanvas.getContext('2d')!;
    brCtx.fillStyle = '#0044AA';
    brCtx.fillRect(0, 0, 128, 64);
    brCtx.font = 'bold 18px Arial';
    brCtx.fillStyle = '#FFFFFF';
    brCtx.textAlign = 'center';
    brCtx.textBaseline = 'middle';
    brCtx.fillText('THE WEEKLY', 64, 25);
    brCtx.font = '10px Arial';
    brCtx.fillText('FREE', 64, 45);
    const brandTex = new THREE.CanvasTexture(brandCanvas);
    const frontPanel = mkBox(0.5, 0.3, 0.01, new THREE.MeshBasicMaterial({ map: brandTex }));
    frontPanel.position.set(fw.x, 0.7, fw.z + 0.1);
    frontPanel.rotation.x = -0.2;
    fwGroup.add(frontPanel);

    // Stacked papers inside
    const paperColors = [0xF5F0E0, 0xE8E0D0, 0xF0E8D8];
    for (let p = 0; p < 3; p++) {
      const paper = mkBox(0.35, 0.4, 0.01, new THREE.MeshStandardMaterial({
        color: paperColors[p], roughness: 0.9,
      }));
      paper.position.set(fw.x, 0.55 + p * 0.02, fw.z + 0.02);
      paper.rotation.x = -0.2;
      fwGroup.add(paper);
    }

    g.add(fwGroup);
  }

  // ── Concrete planters with small trees/shrubs ──
  const planterPositions = [
    { x: -15, z: 4.2 },
    { x: 7, z: 4.2 },
    { x: 23, z: 4.2 },
  ];
  for (const pp of planterPositions) {
    const planterGroup = new THREE.Group();
    planterGroup.name = 'planter';
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0xBBBBAA, roughness: 0.85 });

    // Planter box
    const box = mkBox(0.8, 0.5, 0.5, concreteMat);
    box.position.set(pp.x, 0.25, pp.z);
    planterGroup.add(box);

    // Soil
    const soil = mkBox(0.7, 0.05, 0.4, new THREE.MeshStandardMaterial({ color: 0x553322, roughness: 0.95 }));
    soil.position.set(pp.x, 0.5, pp.z);
    planterGroup.add(soil);

    // Small tree/shrub (trunk + sphere foliage)
    const trunk = mkCyl(0.03, 0.04, 0.5, 6, new THREE.MeshStandardMaterial({ color: 0x6B4226, roughness: 0.9 }));
    trunk.position.set(pp.x, 0.75, pp.z);
    planterGroup.add(trunk);

    const foliage = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x337733, roughness: 0.8 }),
    );
    foliage.position.set(pp.x, 1.15, pp.z);
    planterGroup.add(foliage);

    g.add(planterGroup);
  }

  // ── CCTV surveillance poles ──
  const cctvPositions = [
    { x: -18, z: 4.0 },
    { x: 13, z: 4.0 },
  ];
  for (const cp of cctvPositions) {
    const cctvGroup = new THREE.Group();
    cctvGroup.name = 'cctv_pole';
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.6 });

    // Tall pole
    const pole = mkCyl(0.04, 0.05, 4, 8, poleMat);
    pole.position.set(cp.x, 2, cp.z);
    cctvGroup.add(pole);

    // Curved arm extending outward
    const arm = mkCyl(0.03, 0.03, 0.8, 8, poleMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(cp.x + 0.4, 3.8, cp.z);
    cctvGroup.add(arm);

    // Camera housing (bullet-style)
    const housing = mkBox(0.2, 0.1, 0.12, poleMat);
    housing.position.set(cp.x + 0.8, 3.8, cp.z);
    cctvGroup.add(housing);

    // Lens (dark circle at front)
    const lens = mkCyl(0.03, 0.03, 0.02, 8, new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.8 }));
    lens.rotation.z = Math.PI / 2;
    lens.position.set(cp.x + 0.92, 3.8, cp.z);
    cctvGroup.add(lens);

    g.add(cctvGroup);
  }

  // ── Modern traffic lights ──
  const trafficPositions = [
    { x: -10, z: 4.5 },
    { x: 16, z: 4.5 },
  ];
  for (const tp of trafficPositions) {
    const tlGroup = new THREE.Group();
    tlGroup.name = 'traffic_light';
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.4 });

    // Pole
    const pole = mkCyl(0.06, 0.07, 5, 8, housingMat);
    pole.position.set(tp.x, 2.5, tp.z);
    tlGroup.add(pole);

    // Signal head housing
    const signalHead = mkBox(0.35, 0.9, 0.25, housingMat);
    signalHead.position.set(tp.x, 4.2, tp.z);
    tlGroup.add(signalHead);

    // Three circular lights
    const lightColors = [0xFF0000, 0xFFCC00, 0x00CC00];
    for (let i = 0; i < 3; i++) {
      const light = mkCyl(0.08, 0.08, 0.03, 12, new THREE.MeshStandardMaterial({
        color: lightColors[i],
        emissive: lightColors[i],
        emissiveIntensity: i === 2 ? 0.8 : 0.3, // green lit
        roughness: 0.2,
      }));
      light.rotation.z = Math.PI / 2;
      light.position.set(tp.x, 4.5 - i * 0.28, tp.z + 0.14);
      tlGroup.add(light);
    }

    // Pedestrian crossing button
    const buttonBox = mkBox(0.15, 0.2, 0.08, housingMat);
    buttonBox.position.set(tp.x + 0.3, 1.2, tp.z + 0.2);
    tlGroup.add(buttonBox);

    g.add(tlGroup);
  }

  // ── Lamp posts (modern street lighting) ──
  const lampPositions = [
    { x: -20, z: 4.0 },
    { x: -8, z: 4.0 },
    { x: 4, z: 4.0 },
    { x: 16, z: 4.0 },
    { x: 26, z: 4.0 },
  ];
  for (const lp of lampPositions) {
    const lampResult = generateProp({
      type: 'lamp_post',
      scale: 1,
      style: 'modern',
      lit: true,
      ornate: false,
      condition: 0.85,
    });
    lampResult.group.position.set(lp.x, 0, lp.z);
    g.add(lampResult.group);
    _disposeTargets.push(lampResult);
  }

  // ── Trash cans (modern municipal style) ──
  const trashPositions = [
    { x: -15, z: 4.0 },
    { x: 20, z: 4.0 },
  ];
  for (const tp of trashPositions) {
    const trashResult = generateProp({
      type: 'trash_can',
      scale: 1,
      condition: 0.7,
    });
    trashResult.group.position.set(tp.x, 0, tp.z);
    g.add(trashResult.group);
    _disposeTargets.push(trashResult);
  }

  // ── Bench on sidewalk ──
  const benchResult = generateProp({
    type: 'bench',
    scale: 1,
    style: 'modern',
    condition: 0.75,
  });
  benchResult.group.position.set(9, 0, 4.0);
  g.add(benchResult.group);
  _disposeTargets.push(benchResult);

  return g;
}

// ══════════════════════════════════════════════════════════════════════
// ATMOSPHERE — early-digital-era sky rig parameters
// ══════════════════════════════════════════════════════════════════════

function buildAtmosphere(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'atmosphere_2005';
  const palette = get2005Palette();

  // Hazy urban atmosphere — slightly muted sky
  const hazeMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(palette.mutedSky).multiplyScalar(0.6),
    transparent: true,
    opacity: 0.15,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const hazeSphere = new THREE.Mesh(new THREE.SphereGeometry(60, 16, 12), hazeMat);
  hazeSphere.position.set(0, 20, -20);
  hazeSphere.renderOrder = -1;
  g.add(hazeSphere);

  // Neutral daylight directional light (early 2000s had flatter, more neutral lighting)
  const sunLight = new THREE.DirectionalLight(0xFFF5E8, 1.0);
  sunLight.position.set(20, 30, -10);
  sunLight.castShadow = false;
  g.add(sunLight);

  // Cool ambient fill (slightly bluish compared to warm 1945 sepia)
  const coolAmbient = new THREE.AmbientLight(0xCCDDEE, 0.4);
  g.add(coolAmbient);

  // Subtle ground-level fog (urban pollution/haze)
  const fogMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(palette.mutedSky).multiplyScalar(0.4),
    transparent: true,
    opacity: 0.06,
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
 * The complete 2005 era content module.
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
 *   - Sandblasted/gentrified brick original stock buildings (cleaned
 *     facades, restored masonry, good condition)
 *   - Glass-and-steel low-rise office/retail with blue-tinted glazing,
 *     steel mullions, rooftop parapet
 *   - Rooftop AC units on gentrified and glass buildings
 *   - Aluminum-frame glass shopfronts with backlit signage
 *   - Roll-down security shutters (some closed, some open)
 *   - Internet café with glowing CRT monitors visible through window
 *   - Mobile phone shop with early flip phones in window display
 *   - DVD/game rental store with colorful DVD cases on shelves
 *   - Coffee shop with green canvas awning
 *   - Wall-mounted ATMs with illuminated displays
 *   - Large vinyl billboards with early-2000s gradient-heavy fictional
 *     brand logos (ZENTRIX, NOVAFLUX)
 *   - Bus-shelter lightbox ads with gradient overlays (ENERGYDRIVE)
 *   - Scaffolding banners on renovation site with safety netting
 *   - Rounded aerodynamic sedans (silver, dark blue), SUV (silver),
 *     minivan (tan), hatchback (red) — all with body-color bumpers
 *   - Hybrid vehicle with subtle eco-badging
 *   - Modernized yellow taxi with roof light
 *   - Pedestrians in 2000s outfits: bootcut jeans, cargo pants,
 *     layered tees, puffer jackets, chunky sneakers, trucker hats,
 *     emo/scene fringe, wired earbuds, flip phones, shopping bags
 *   - Bike racks (inverted U-loop style)
 *   - Sandwich board A-frame signs
 *   - Free weekly newspaper boxes
 *   - Concrete planters with small trees
 *   - CCTV surveillance poles with bullet cameras
 *   - Modern traffic lights with LED housings
 *   - Modern street lamp posts, municipal trash cans, benches
 *   - Neutral/cooler atmospheric lighting vs. warm 1945 sepia
 */
export const era2005: EraContentModule = {
  id: '2005',

  /** Build and return a single THREE.Group with named category children. */
  build(): THREE.Group {
    const root = new THREE.Group();
    root.name = 'era_2005';

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

    const atmosphereGroup = new THREE.Group();
    atmosphereGroup.name = 'atmosphere';
    atmosphereGroup.add(buildAtmosphere());

    root.add(buildingsGroup);
    root.add(vehiclesGroup);
    root.add(signageGroup);
    root.add(pedestriansGroup);
    root.add(propsGroup);
    root.add(atmosphereGroup);

    _builtContent = { buildings: buildingsGroup };

    return root;
  },

  update(_dt: number, _elapsed: number): void {
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
