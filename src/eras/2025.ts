import * as THREE from 'three';
import { generateVehicle, VehicleBodyType } from '../era-content/toolkit/vehicle';
import { generatePedestrian, PedestrianParams } from '../era-content/toolkit/pedestrian';
import { generateProp, PropType } from '../era-content/toolkit/props';
import { getEraPalette as _sharedGetEraPalette } from './_shared/paletteHelpers';

// ──────────────────────────────────────────────────────────────────────
// Era Palette & Material Convention Helpers — 2025
// ──────────────────────────────────────────────────────────────────────

/**
 * Return the 2025-era colour palette.
 * Contemporary, tech-saturated, with heritage restoration accents.
 */
export function getEraPalette(): Record<string, number> {
  return {
    // Heritage facade tones (restored)
    heritageStone: 0xD4C8B0,
    heritageBrick: 0x9B6B4A,
    heritagePlaster: 0xE8DDD0,
    heritageTrim: 0xF5F0E8,
    // Glass tower tones
    glassTower: 0x88AACC,
    darkGlass: 0x334455,
    reflectiveGlass: 0x6688AA,
    curtainWallFrame: 0x2A2A2A,
    // Contemporary paints
    whitePaint: 0xFAFAFA,
    lightGrey: 0xC0C0C0,
    charcoal: 0x333333,
    sageGreen: 0x7A9A70,
    tealAccent: 0x008888,
    warmWhite: 0xFFF8E0,
    // Street / infrastructure
    asphalt: 0x555550,
    concrete: 0xAAAAAA,
    steel: 0x888888,
    solarBlue: 0x1A237E,
    evGreen: 0x00CC66,
    // Accent
    neonPink: 0xFF3388,
    neonBlue: 0x3388FF,
    LEDWhite: 0xFFFFFF,
    LEDAmber: 0xFFAA33,
    LEDGreen: 0x00FF66,
    LEDRed: 0xFF3333,
    // Nature
    foliageDark: 0x2D5A27,
    foliageLight: 0x4A8A40,
    planterWood: 0x8B6914,
    rainGardenSoil: 0x5A4A30,
    // Ground / pavement
    sidewalkConcrete: 0xB8B0A0,
    crosswalkWhite: 0xEEEEEE,
  };
}

// ── Material construction helpers ──────────────────────────────────

function brickMat(cond: number): THREE.MeshStandardMaterial {
  const p = getEraPalette();
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(p.heritageBrick),
    roughness: 0.75 - cond * 0.15,
    metalness: 0.0,
  });
}

function stoneMat(cond: number): THREE.MeshStandardMaterial {
  const p = getEraPalette();
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(p.heritageStone),
    roughness: 0.8 - cond * 0.1,
    metalness: 0.0,
  });
}

function heritagePlasterMat(cond: number): THREE.MeshStandardMaterial {
  const p = getEraPalette();
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(p.heritagePlaster),
    roughness: 0.7 - cond * 0.1,
    metalness: 0.0,
  });
}

function modernGlassMat(cond: number): THREE.MeshPhysicalMaterial {
  const clarity = 0.3 + cond * 0.6;
  return new THREE.MeshPhysicalMaterial({
    color: 0x88AACC,
    transparent: true,
    opacity: clarity,
    roughness: 0.02,
    metalness: 0.9,
    reflectivity: 1.0,
    transmission: 0.5,
    thickness: 0.05,
  });
}

function darkTintedGlass(cond: number): THREE.MeshPhysicalMaterial {
  const clarity = 0.15 + cond * 0.35;
  return new THREE.MeshPhysicalMaterial({
    color: 0x334455,
    transparent: true,
    opacity: clarity,
    roughness: 0.05,
    metalness: 0.95,
    reflectivity: 0.8,
  });
}

function curtainWallFrameMat(cond: number): THREE.MeshStandardMaterial {
  const shade = 0.12 + (1 - cond) * 0.1;
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color().setRGB(shade, shade, shade),
    roughness: 0.3,
    metalness: 0.8,
  });
}

function contemporaryPaint(hex: number, cond: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness: 0.5 - cond * 0.1,
    metalness: 0.05,
  });
}

function greenRoofMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x2D5A27,
    roughness: 1.0,
    metalness: 0.0,
  });
}

function solarPanelMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x1A237E,
    roughness: 0.3,
    metalness: 0.5,
  });
}

function steelMat(_cond: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x888888,
    roughness: 0.4,
    metalness: 0.7,
  });
}

function chromeMat(_cond: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xDDDDDD,
    roughness: 0.1,
    metalness: 0.95,
  });
}

function concreteMat(cond: number): THREE.MeshStandardMaterial {
  const s = 0.4 + cond * 0.3;
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(s, s * 1.02, s * 1.05),
    roughness: 0.9,
    metalness: 0.0,
  });
}

function woodMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x8B6914,
    roughness: 0.8,
    metalness: 0.0,
  });
}

function foliageMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x2D5A27,
    roughness: 0.9,
    metalness: 0.0,
  });
}

function trunkMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x5A3A1A,
    roughness: 0.95,
    metalness: 0.0,
  });
}

function EVChargeMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x00CC66,
    roughness: 0.3,
    metalness: 0.2,
  });
}

// ──────────────────────────────────────────────────────────────────────
// Helper: make a box mesh
// ──────────────────────────────────────────────────────────────────────

function mkBox(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  return new THREE.Mesh(geo, mat);
}

// ──────────────────────────────────────────────────────────────────────
// Animated Digital Billboard System
// ──────────────────────────────────────────────────────────────────────

interface AnimatedBillboardState {
  group: THREE.Group;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  screenMesh: THREE.Mesh;
  frameGroup: THREE.Group;
  /** Current animation phase for loop cycling */
  animPhase: number;
  /** Screen material reference for update */
  screenMat: THREE.MeshBasicMaterial;
}

/**
 * Build an animated digital LED billboard.
 * Renders changing content on a canvas texture each frame via update().
 */
function buildAnimatedLEDBillboard(
  width: number = 10,
  height: number = 4,
  y: number = 5,
): AnimatedBillboardState {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  const screenMat = new THREE.MeshBasicMaterial({ map: texture });
  const screenMesh = mkBox(width, height, 0.05, screenMat);
  screenMesh.position.y = y;

  // Frame
  const frameGroup = new THREE.Group();
  const frameMat = steelMat(0.8);
  const ft = 0.08;
  frameGroup.add(mkBox(width + ft * 2, ft, 0.1, frameMat).translateY(y + height / 2 + ft / 2));
  frameGroup.add(mkBox(width + ft * 2, ft, 0.1, frameMat).translateY(y - height / 2 - ft / 2));
  frameGroup.add(mkBox(ft, height, 0.1, frameMat).translateX(-width / 2 - ft / 2).translateY(y));
  frameGroup.add(mkBox(ft, height, 0.1, frameMat).translateX(width / 2 + ft / 2).translateY(y));

  // Support poles
  const poleMat = frameMat;
  const leftPole = mkBox(0.15, y + height / 2, 0.15, poleMat);
  leftPole.position.set(-width / 2 + 1, -(y + height / 2) / 2, 0);
  frameGroup.add(leftPole);
  const rightPole = mkBox(0.15, y + height / 2, 0.15, poleMat);
  rightPole.position.set(width / 2 - 1, -(y + height / 2) / 2, 0);
  frameGroup.add(rightPole);

  const group = new THREE.Group();
  group.name = 'animated_led_billboard';
  group.add(frameGroup);
  group.add(screenMesh);

  // Initial render
  drawBillboardFrame(ctx, 512, 256, 0);
  texture.needsUpdate = true;

  return { group, canvas, ctx, texture, screenMesh, frameGroup, animPhase: 0, screenMat };
}

/**
 * Draw one frame of the animated billboard content.
 * Cycles through different ad layouts every ~3 seconds.
 */
function drawBillboardFrame(ctx: CanvasRenderingContext2D, w: number, h: number, phase: number): void {
  const t = phase % 6;

  // Background
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, w, h);

  switch (t) {
    case 0: {
      // Fashion brand ad
      ctx.fillStyle = '#FF3388';
      ctx.fillRect(0, 0, w, h * 0.6);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 72px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LUMIÈRE', w / 2, h * 0.45);
      ctx.font = '28px Arial, sans-serif';
      ctx.fillText('NEW COLLECTION 2025', w / 2, h * 0.7);
      ctx.font = '20px Arial, sans-serif';
      ctx.fillStyle = '#FFCCDD';
      ctx.fillText('Shop Online Now →', w / 2, h * 0.85);
      break;
    }
    case 1: {
      // Tech product ad
      ctx.fillStyle = '#112244';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#3388FF';
      ctx.beginPath();
      ctx.arc(w * 0.35, h * 0.5, h * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 56px Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('NEXUS', w * 0.55, h * 0.35);
      ctx.font = '24px Arial, sans-serif';
      ctx.fillText('The future is here.', w * 0.55, h * 0.5);
      ctx.fillStyle = '#3388FF';
      ctx.fillRect(w * 0.55, h * 0.65, 160, 36);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 18px Arial';
      ctx.fillText('LEARN MORE', w * 0.55 + 80, h * 0.65 + 24);
      break;
    }
    case 2: {
      // Beverage / lifestyle
      ctx.fillStyle = '#00AA55';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 64px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PUREFLOW', w / 2, h * 0.4);
      ctx.font = 'italic 28px Arial';
      ctx.fillText('Sustainable hydration', w / 2, h * 0.6);
      ctx.font = '18px Arial';
      ctx.fillStyle = '#CCFFE0';
      ctx.fillText('Available everywhere', w / 2, h * 0.8);
      break;
    }
    case 3: {
      // Travel ad
      ctx.fillStyle = '#FF6633';
      ctx.fillRect(0, 0, w, h * 0.7);
      ctx.fillStyle = '#003366';
      ctx.fillRect(0, h * 0.7, w, h * 0.3);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 52px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('WANDERLUST', w / 2, h * 0.45);
      ctx.font = '22px Arial';
      ctx.fillStyle = '#FFDDCC';
      ctx.fillText('Explore the world your way', w / 2, h * 0.82);
      break;
    }
    case 4: {
      // Music / streaming service
      ctx.fillStyle = '#1a0033';
      ctx.fillRect(0, 0, w, h);
      // Animated equalizer bars
      for (let i = 0; i < 12; i++) {
        const barH = 30 + Math.sin(i * 0.8 + phase * 0.5) * 60;
        ctx.fillStyle = `hsl(${i * 30}, 80%, 60%)`;
        ctx.fillRect(w * 0.1 + i * (w * 0.8 / 12), h - barH, w * 0.8 / 12 - 4, barH);
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('SONICSTREAM', w / 2, h * 0.35);
      ctx.font = '20px Arial';
      ctx.fillStyle = '#CC88FF';
      ctx.fillText('Millions of songs. Free forever.', w / 2, h * 0.55);
      break;
    }
    case 5: {
      // Eco / sustainability campaign
      ctx.fillStyle = '#004422';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#44DD88';
      ctx.beginPath();
      ctx.arc(w * 0.3, h * 0.5, 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 56px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('GREENPLANET', w / 2, h * 0.4);
      ctx.font = '24px Arial';
      ctx.fillText('Join the movement for a', w / 2, h * 0.6);
      ctx.fillText('sustainable tomorrow', w / 2, h * 0.72);
      ctx.fillStyle = '#88FFBB';
      ctx.fillRect(w * 0.3, h * 0.8, w * 0.4, 30);
      ctx.fillStyle = '#004422';
      ctx.font = 'bold 16px Arial';
      ctx.fillText('SIGN THE PETITION', w / 2, h * 0.8 + 20);
      break;
    }
  }
}

/**
 * Update the animated billboard textures given elapsed time.
 */
function updateAnimatedBillboards(billboards: AnimatedBillboardState[], dt: number, elapsed: number): void {
  for (const bb of billboards) {
    bb.animPhase += dt;
    const cycleTime = 3.0; // seconds per ad
    const idx = Math.floor((elapsed % (cycleTime * 6)) / cycleTime);
    drawBillboardFrame(bb.ctx, bb.canvas.width, bb.canvas.height, idx);
    bb.texture.needsUpdate = true;
  }
}

// ──────────────────────────────────────────────────────────────────────
// Animated Bus Shelter Screens
// ──────────────────────────────────────────────────────────────────────

interface AnimatedBusShelterState {
  group: THREE.Group;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  screenMat: THREE.MeshBasicMaterial;
  animPhase: number;
}

function buildAnimatedBusShelterScreen(x: number, y: number = 1.5): AnimatedBusShelterState {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  const screenMat = new THREE.MeshBasicMaterial({ map: texture });
  const screenMesh = mkBox(1.6, 0.8, 0.03, screenMat);
  screenMesh.position.set(x, y, 0);

  const group = new THREE.Group();
  group.name = 'bus_shelter_screen';
  group.add(screenMesh);

  drawBusShelterFrame(ctx, 256, 128, 0);
  texture.needsUpdate = true;

  return { group, canvas, ctx, texture, screenMat, animPhase: 0 };
}

function drawBusShelterFrame(ctx: CanvasRenderingContext2D, w: number, h: number, phase: number): void {
  const t = phase % 3;
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, w, h);

  switch (t) {
    case 0: {
      // Transit info
      ctx.fillStyle = '#0044AA';
      ctx.fillRect(0, 0, w, 24);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('NEXT BUS: 3 MIN', 10, 17);
      ctx.font = '12px monospace';
      ctx.fillStyle = '#AADDFF';
      ctx.fillText('Route 42 → Downtown', 10, 44);
      ctx.fillText('Route 17 → University', 10, 62);
      ctx.fillText('Route 8  → Airport', 10, 80);
      ctx.fillStyle = '#888888';
      ctx.font = '10px monospace';
      ctx.fillText('Updated just now', 10, 110);
      break;
    }
    case 1: {
      // Local ad
      ctx.fillStyle = '#CC3300';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('MIDTOWN MALL', w / 2, 40);
      ctx.font = '14px Arial';
      ctx.fillText('Summer Sale: Up to 60% Off', w / 2, 68);
      ctx.fillStyle = '#FFDDCC';
      ctx.font = '11px Arial';
      ctx.fillText('123 Commerce St • Open 10-9', w / 2, 95);
      break;
    }
    case 2: {
      // Public service announcement
      ctx.fillStyle = '#003322';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#00FF66';
      ctx.font = 'bold 22px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('CLEAN AIR ZONE', w / 2, 35);
      ctx.fillStyle = '#AADDCC';
      ctx.font = '13px Arial';
      ctx.fillText('Low-emission vehicles only in', w / 2, 58);
      ctx.fillText('this zone during peak hours.', w / 2, 76);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '11px Arial';
      ctx.fillText('Learn more at city.gov/air', w / 2, 105);
      break;
    }
  }
}

function updateBusShelters(shelters: AnimatedBusShelterState[], dt: number, elapsed: number): void {
  for (const s of shelters) {
    s.animPhase += dt;
    const cycleTime = 5.0;
    const idx = Math.floor((elapsed % (cycleTime * 3)) / cycleTime);
    drawBusShelterFrame(s.ctx, s.canvas.width, s.canvas.height, idx);
    s.texture.needsUpdate = true;
  }
}

// ──────────────────────────────────────────────────────────────────────
// QR Code Poster Texture Generator
// ──────────────────────────────────────────────────────────────────────

function qrCodePosterTexture(text: string, bgColor: number = 0xFFFFFF, fgColor: number = 0x000000): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#' + new THREE.Color(bgColor).getHexString();
  ctx.fillRect(0, 0, 128, 160);

  // QR code pattern (stylized placeholder)
  const qrSize = 80;
  const qrX = (128 - qrSize) / 2;
  const qrY = 10;
  ctx.fillStyle = '#' + new THREE.Color(fgColor).getHexString();
  // Corner squares
  for (const corner of [[0, 0], [qrSize - 20, 0], [0, qrSize - 20]]) {
    ctx.fillRect(qrX + corner[0], qrY + corner[1], 20, 20);
    ctx.fillStyle = '#' + new THREE.Color(bgColor).getHexString();
    ctx.fillRect(qrX + corner[0] + 4, qrY + corner[1] + 4, 12, 12);
    ctx.fillStyle = '#' + new THREE.Color(fgColor).getHexString();
    ctx.fillRect(qrX + corner[0] + 6, qrY + corner[1] + 6, 8, 8);
  }
  ctx.fillStyle = '#' + new THREE.Color(fgColor).getHexString();
  // Random data bits
  for (let r = 0; r < qrSize; r += 4) {
    for (let c = 0; c < qrSize; c += 4) {
      if (Math.random() > 0.5) {
        ctx.fillRect(qrX + c, qrY + r, 4, 4);
      }
    }
  }

  // Text below QR
  ctx.fillStyle = '#' + new THREE.Color(fgColor).getHexString();
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('SCAN TO ORDER', 64, qrSize + 20);
  ctx.font = '9px Arial';
  ctx.fillText(text || '', 64, qrSize + 34);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

// ──────────────────────────────────────────────────────────────────────
// Projection-Mapped Wall Ad
// ──────────────────────────────────────────────────────────────────────

function buildProjectionMappedAd(width: number = 8, height: number = 4, x: number = 0, y: number = 3): THREE.Group {
  const g = new THREE.Group();
  g.name = 'projection_mapped_ad';

  // Base wall surface
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 });
  const wall = mkBox(width, height, 0.05, wallMat);
  wall.position.set(x, y, 0);
  g.add(wall);

  // Projected content plane (emissive)
  const projMat = new THREE.MeshBasicMaterial({
    color: 0x4488FF,
    transparent: true,
    opacity: 0.7,
  });
  const projPlane = mkBox(width - 0.2, height - 0.2, 0.01, projMat);
  projPlane.position.set(x, y, 0.03);
  g.add(projPlane);

  // Projector device
  const projDevice = mkBox(0.3, 0.2, 0.3, steelMat(0.8));
  projDevice.position.set(x, y + height / 2 + 0.2, 0.5);
  g.add(projDevice);

  // Light cone hint
  const coneGeo = new THREE.ConeGeometry(2, 3, 4, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0x4488FF,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.set(x, y + 0.5, 0.5);
  cone.rotation.x = Math.PI;
  g.add(cone);

  return g;
}

// ──────────────────────────────────────────────────────────────────────
// Sticker-Bombed Utility Box
// ──────────────────────────────────────────────────────────────────────

function buildStickerBombUtilityBox(x: number, z: number, scale: number = 1): THREE.Group {
  const g = new THREE.Group();
  g.name = 'sticker_bomb_box';
  const s = scale;
  const bodyW = 1.0 * s, bodyH = 1.2 * s, bodyD = 0.6 * s;

  // Base box
  const baseMat = contemporaryPaint(0x667766, 0.7);
  g.add(mkBox(bodyW, bodyH, bodyD, baseMat).translateX(x).translateY(bodyH / 2).translateZ(z));

  // Stickers (colored rectangles scattered on surfaces)
  const stickerColors = [0xFF3366, 0x3366FF, 0xFFCC00, 0x00CC66, 0xFF6600, 0xCC33FF, 0x00CCCC, 0xFFFF00];
  for (let i = 0; i < 15; i++) {
    const sw = 0.08 * s + Math.random() * 0.15 * s;
    const sh = 0.06 * s + Math.random() * 0.12 * s;
    const sc = stickerColors[i % stickerColors.length];
    const stickerMat = contemporaryPaint(sc, 0.9);
    const sticker = mkBox(sw, sh, 0.005, stickerMat);
    const face = Math.floor(Math.random() * 3);
    if (face === 0) {
      // Front face
      sticker.position.set(
        x + (Math.random() - 0.5) * (bodyW - sw - 0.05),
        bodyH * 0.15 + Math.random() * bodyH * 0.7,
        z + bodyD / 2 + 0.003,
      );
    } else if (face === 1) {
      // Top face
      sticker.position.set(
        x + (Math.random() - 0.5) * (bodyW - sw - 0.05),
        bodyH + 0.003,
        z + (Math.random() - 0.5) * (bodyD - sh - 0.05),
      );
      sticker.rotation.x = -Math.PI / 2;
    } else {
      // Side face
      sticker.position.set(
        x + bodyW / 2 * (Math.random() > 0.5 ? 1 : -1) + 0.003,
        bodyH * 0.2 + Math.random() * bodyH * 0.6,
        z + (Math.random() - 0.5) * (bodyD - sh - 0.05),
      );
      sticker.rotation.y = Math.PI / 2;
    }
    sticker.rotation.z = (Math.random() - 0.5) * 0.3;
    g.add(sticker);
  }

  return g;
}

// ──────────────────────────────────────────────────────────────────────
// Delivery Robot
// ──────────────────────────────────────────────────────────────────────

function buildDeliveryRobot(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'delivery_robot';

  const bodyMat = contemporaryPaint(0xF0F0F0, 0.9);
  const wheelMat = concreteMat(0.8);

  // Main body — rounded rectangular prism
  const body = mkBox(0.6, 0.5, 0.5, bodyMat);
  body.position.y = 0.55;
  g.add(body);

  // Top dome
  const domeGeo = new THREE.SphereGeometry(0.25, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = new THREE.Mesh(domeGeo, bodyMat);
  dome.position.y = 0.8;
  g.add(dome);

  // Sensor array on top
  const sensorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.8 });
  const sensor = mkBox(0.15, 0.08, 0.15, sensorMat);
  sensor.position.y = 1.05;
  g.add(sensor);
  // Lidar ring
  const lidarGeo = new THREE.TorusGeometry(0.1, 0.015, 8, 16);
  const lidar = new THREE.Mesh(lidarGeo, sensorMat);
  lidar.position.y = 1.05;
  lidar.rotation.x = Math.PI / 2;
  g.add(lidar);

  // Status LED strip
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x00FF66, transparent: true, opacity: 0.8 });
  const ledStrip = mkBox(0.5, 0.03, 0.01, ledMat);
  ledStrip.position.set(0, 0.65, 0.26);
  g.add(ledStrip);

  // Logo panel
  const logoMat = contemporaryPaint(0x00AA66, 0.9);
  const logoPanel = mkBox(0.25, 0.15, 0.01, logoMat);
  logoPanel.position.set(0, 0.55, 0.26);
  g.add(logoPanel);

  // Wheels (omnidirectional Mecanum-style)
  const wheelGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12);
  for (const wp of [{ x: -0.25, z: 0.2 }, { x: 0.25, z: 0.2 }, { x: -0.25, z: -0.2 }, { x: 0.25, z: -0.2 }]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(wp.x, 0.08, wp.z);
    wheel.rotation.z = Math.PI / 2;
    g.add(wheel);
  }

  // Compartment doors
  const doorMat = contemporaryPaint(0xE0E0E0, 0.8);
  for (const side of [-1, 1]) {
    const door = mkBox(0.25, 0.3, 0.01, doorMat);
    door.position.set(side * 0.15, 0.5, 0.26);
    g.add(door);
  }

  g.position.set(x, 0, z);
  return g;
}

// ──────────────────────────────────────────────────────────────────────
// Autonomous Delivery Pod
// ──────────────────────────────────────────────────────────────────────

function buildAutonomousPod(x: number, z: number, rotZ: number = 0): THREE.Group {
  const g = new THREE.Group();
  g.name = 'autonomous_pod';

  const bodyMat = contemporaryPaint(0xF5F5F5, 0.9);
  const glassMat = darkTintedGlass(0.8);
  const wheelMat = concreteMat(0.8);

  // Main pod body — elongated rounded shape
  const podBody = mkBox(2.4, 0.8, 1.4, bodyMat);
  podBody.position.y = 0.7;
  g.add(podBody);

  // Nose cone (front)
  const noseGeo = new THREE.SphereGeometry(0.4, 8, 6, 0, Math.PI / 2, 0, Math.PI * 2);
  const nose = new THREE.Mesh(noseGeo, bodyMat);
  nose.rotation.z = -Math.PI / 2;
  nose.position.set(1.2, 0.7, 0);
  g.add(nose);

  // Rear cap
  const rearGeo = new THREE.SphereGeometry(0.35, 8, 6, Math.PI / 2, Math.PI / 2, 0, Math.PI * 2);
  const rear = new THREE.Mesh(rearGeo, bodyMat);
  rear.rotation.z = Math.PI / 2;
  rear.position.set(-1.2, 0.7, 0);
  g.add(rear);

  // Windshield / front glass
  const windshield = mkBox(0.05, 0.5, 1.2, glassMat);
  windshield.position.set(1.18, 0.85, 0);
  g.add(windshield);

  // Side windows
  for (const side of [-1, 1]) {
    const sideWin = mkBox(1.2, 0.35, 0.04, glassMat);
    sideWin.position.set(0, 0.9, side * 0.72);
    g.add(sideWin);
  }

  // LED light bar (front)
  const lightBarMat = new THREE.MeshBasicMaterial({ color: 0x00FF66, transparent: true, opacity: 0.9 });
  const lightBar = mkBox(0.05, 0.06, 1.0, lightBarMat);
  lightBar.position.set(1.23, 0.55, 0);
  g.add(lightBar);

  // LED tail lights
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xFF3333, transparent: true, opacity: 0.8 });
  for (const side of [-1, 1]) {
    const tail = mkBox(0.05, 0.06, 0.3, tailMat);
    tail.position.set(-1.23, 0.55, side * 0.45);
    g.add(tail);
  }

  // Autonomous driving badge
  const badgeMat = contemporaryPaint(0x3388FF, 0.9);
  const badge = mkBox(0.15, 0.08, 0.01, badgeMat);
  badge.position.set(0.6, 0.7, 0.71);
  g.add(badge);

  // Wheels (4 small wheels)
  const wGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.06, 12);
  for (const wp of [
    { x: 0.7, z: 0.75 },
    { x: 0.7, z: -0.75 },
    { x: -0.7, z: 0.75 },
    { x: -0.7, z: -0.75 },
  ]) {
    const wheel = new THREE.Mesh(wGeo, wheelMat);
    wheel.position.set(wp.x, 0.12, wp.z);
    wheel.rotation.z = Math.PI / 2;
    g.add(wheel);
  }

  // Sensor bump on roof
  const sensorMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.2, metalness: 0.8 });
  const sensorBase = mkBox(0.3, 0.05, 0.3, sensorMat);
  sensorBase.position.set(0.3, 1.13, 0);
  g.add(sensorBase);
  const sensorDome = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), sensorMat);
  sensorDome.position.set(0.3, 1.18, 0);
  g.add(sensorDome);

  g.position.set(x, 0, z);
  g.rotation.y = rotZ;
  return g;
}

// ──────────────────────────────────────────────────────────────────────
// E-Scooter
// ──────────────────────────────────────────────────────────────────────

function buildEScooter(x: number, z: number, facingForward: boolean = true): THREE.Group {
  const g = new THREE.Group();
  g.name = 'e_scooter';
  const s = 0.85;

  const deckMat = contemporaryPaint(0x333333, 0.8);
  const stemMat = steelMat(0.9);
  const tireMat = concreteMat(0.6);
  const accentMat = contemporaryPaint(0x00AA66, 0.9);

  // Deck
  const deck = mkBox(0.12 * s, 0.04 * s, 0.6 * s, deckMat);
  deck.position.y = 0.22 * s;
  g.add(deck);

  // Stem
  const stem = mkBox(0.03 * s, 0.6 * s, 0.03 * s, stemMat);
  stem.position.set(0, 0.52 * s, -0.22 * s);
  stem.rotation.x = -0.15;
  g.add(stem);

  // Handlebar
  const handlebar = mkBox(0.35 * s, 0.025 * s, 0.025 * s, stemMat);
  handlebar.position.set(0, 0.82 * s, -0.24 * s);
  g.add(handlebar);

  // Grips
  for (const side of [-1, 1]) {
    const grip = mkBox(0.04 * s, 0.03 * s, 0.06 * s, contemporaryPaint(0x111111, 0.7));
    grip.position.set(side * 0.17 * s, 0.82 * s, -0.24 * s);
    g.add(grip);
  }

  // Fender
  const fender = mkBox(0.08 * s, 0.01 * s, 0.3 * s, accentMat);
  fender.position.set(0, 0.28 * s, 0.05 * s);
  g.add(fender);

  // Wheels
  const wheelGeo = new THREE.TorusGeometry(0.12 * s, 0.03 * s, 8, 16);
  for (const wz of [-0.2 * s, 0.2 * s]) {
    const wheel = new THREE.Mesh(wheelGeo, tireMat);
    wheel.position.set(0, 0.12 * s, wz);
    g.add(wheel);
  }

  // Battery pack indicator
  const battLed = mkBox(0.03 * s, 0.02 * s, 0.01 * s, new THREE.MeshBasicMaterial({ color: 0x00FF66, transparent: true, opacity: 0.7 }));
  battLed.position.set(0, 0.26 * s, -0.25 * s);
  g.add(battLed);

  g.position.set(x, 0, z);
  if (!facingForward) g.rotation.y = Math.PI;
  return g;
}

// ──────────────────────────────────────────────────────────────────────
// E-Bike
// ──────────────────────────────────────────────────────────────────────

function buildEBike(x: number, z: number, facingForward: boolean = true): THREE.Group {
  const g = new THREE.Group();
  g.name = 'e_bike';
  const s = 0.9;

  const frameMat = contemporaryPaint(0x222222, 0.8);
  const tireMat = concreteMat(0.5);
  const seatMat = contemporaryPaint(0x1A1A1A, 0.7);

  // Wheels
  const wheelGeo = new THREE.TorusGeometry(0.3 * s, 0.03 * s, 8, 16);
  const rimMat = steelMat(0.9);
  for (const wz of [-0.5 * s, 0.5 * s]) {
    const wheelOuter = new THREE.Mesh(wheelGeo, tireMat);
    wheelOuter.position.set(0, 0.3 * s, wz);
    g.add(wheelOuter);
    const rimInner = new THREE.Mesh(new THREE.TorusGeometry(0.25 * s, 0.01 * s, 6, 16), rimMat);
    rimInner.position.copy(wheelOuter.position);
    g.add(rimInner);
  }

  // Frame tubes
  const tubeR = 0.015 * s;
  // Down tube
  const downTube = new THREE.Mesh(new THREE.CylinderGeometry(tubeR, tubeR, 0.7 * s, 8), frameMat);
  downTube.position.set(0, 0.5 * s, -0.05 * s);
  downTube.rotation.z = 0.4;
  g.add(downTube);
  // Top tube
  const topTube = new THREE.Mesh(new THREE.CylinderGeometry(tubeR, tubeR, 0.5 * s, 8), frameMat);
  topTube.position.set(0, 0.65 * s, 0);
  topTube.rotation.z = Math.PI / 2;
  g.add(topTube);
  // Seat tube
  const seatTube = new THREE.Mesh(new THREE.CylinderGeometry(tubeR, tubeR, 0.4 * s, 8), frameMat);
  seatTube.position.set(0, 0.5 * s, 0.15 * s);
  g.add(seatTube);
  // Fork
  const fork = new THREE.Mesh(new THREE.CylinderGeometry(tubeR, tubeR, 0.45 * s, 8), frameMat);
  fork.position.set(0, 0.45 * s, -0.35 * s);
  fork.rotation.z = -0.15;
  g.add(fork);
  // Rear stay
  const stay = new THREE.Mesh(new THREE.CylinderGeometry(tubeR * 0.7, tubeR * 0.7, 0.6 * s, 8), frameMat);
  stay.position.set(0, 0.4 * s, 0.15 * s);
  stay.rotation.z = -0.6;
  g.add(stay);

  // Seat
  const seat = mkBox(0.08 * s, 0.03 * s, 0.2 * s, seatMat);
  seat.position.set(0, 0.75 * s, 0.15 * s);
  g.add(seat);

  // Handlebars
  const hb = mkBox(0.35 * s, 0.02 * s, 0.02 * s, frameMat);
  hb.position.set(0, 0.72 * s, -0.38 * s);
  g.add(hb);

  // Battery pack on downtube
  const battMat = contemporaryPaint(0x00AA66, 0.9);
  const battPack = mkBox(0.04 * s, 0.04 * s, 0.3 * s, battMat);
  battPack.position.set(0, 0.55 * s, -0.1 * s);
  g.add(battPack);

  // Motor hub on rear wheel
  const motorHub = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.06 * s, 0.04 * s, 12), steelMat(0.9));
  motorHub.position.set(0, 0.3 * s, -0.5 * s);
  motorHub.rotation.x = Math.PI / 2;
  g.add(motorHub);

  g.position.set(x, 0, z);
  if (!facingForward) g.rotation.y = Math.PI;
  return g;
}

// ──────────────────────────────────────────────────────────────────────
// Smart Traffic Light
// ──────────────────────────────────────────────────────────────────────

function buildSmartTrafficLight(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'smart_traffic_light';

  const poleMat = steelMat(0.9);
  const housingMat = contemporaryPaint(0x222222, 0.8);
  const redMat = new THREE.MeshBasicMaterial({ color: 0xFF3333, transparent: true, opacity: 0.9 });
  const amberMat = new THREE.MeshBasicMaterial({ color: 0xFFAA33, transparent: true, opacity: 0.3 });
  const greenMat = new THREE.MeshBasicMaterial({ color: 0x00FF66, transparent: true, opacity: 0.9 });

  // Pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 4.5, 8), poleMat);
  pole.position.y = 2.25;
  g.add(pole);

  // Arm
  const arm = mkBox(1.2, 0.06, 0.06, poleMat);
  arm.position.set(0.6, 4.3, 0);
  g.add(arm);

  // Signal housing
  const housing = mkBox(0.25, 0.7, 0.15, housingMat);
  housing.position.set(1.2, 4.15, 0);
  g.add(housing);

  // Lights
  const lightGeo = new THREE.CircleGeometry(0.08, 12);
  for (const [mat, yOff] of ([[redMat, 4.4], [amberMat, 4.15], [greenMat, 3.9]] as const)) {
    const light = new THREE.Mesh(lightGeo, mat);
    light.position.set(1.2, yOff, 0.08);
    g.add(light);
  }

  // Camera/sensor unit (smart feature)
  const camMat = contemporaryPaint(0x333333, 0.8);
  const camUnit = mkBox(0.15, 0.1, 0.1, camMat);
  camUnit.position.set(1.2, 4.6, 0);
  g.add(camUnit);
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.8 });
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.03, 8), lensMat);
  lens.position.set(1.2, 4.6, 0.055);
  g.add(lens);

  // Pedestrian signal
  const pedHousing = mkBox(0.15, 0.3, 0.08, housingMat);
  pedHousing.position.set(1.2, 2.8, 0);
  g.add(pedHousing);
  const pedRed = new THREE.Mesh(new THREE.CircleGeometry(0.04, 8), redMat.clone());
  pedRed.position.set(1.2, 2.9, 0.045);
  g.add(pedRed);
  const pedGreen = new THREE.Mesh(new THREE.CircleGeometry(0.04, 8), greenMat.clone());
  pedGreen.position.set(1.2, 2.7, 0.045);
  g.add(pedGreen);

  g.position.set(x, 0, z);
  return g;
}

// ──────────────────────────────────────────────────────────────────────
// Sensor-Equipped Lamp Post
// ──────────────────────────────────────────────────────────────────────

function buildSensorLampPost(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'sensor_lamp_post';

  const poleMat = steelMat(0.9);
  const armMat = steelMat(0.85);

  // Main pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 5.0, 8), poleMat);
  pole.position.y = 2.5;
  g.add(pole);

  // Curved arm
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 8), armMat);
  arm.position.set(0.75, 5.0, 0);
  arm.rotation.z = Math.PI / 2;
  g.add(arm);

  // Lamp head
  const lampHead = mkBox(0.4, 0.08, 0.25, contemporaryPaint(0x222222, 0.8));
  lampHead.position.set(1.5, 4.96, 0);
  g.add(lampHead);

  // LED panel (light source)
  const ledPanelMat = new THREE.MeshBasicMaterial({ color: 0xFFF8E0, transparent: true, opacity: 0.6 });
  const ledPanel = mkBox(0.35, 0.02, 0.2, ledPanelMat);
  ledPanel.position.set(1.5, 4.91, 0);
  g.add(ledPanel);

  // Sensor cluster
  const sensorCluster = mkBox(0.1, 0.06, 0.08, contemporaryPaint(0x333333, 0.8));
  sensorCluster.position.set(1.5, 5.05, 0);
  g.add(sensorCluster);

  // Camera module
  const camModule = mkBox(0.08, 0.08, 0.1, contemporaryPaint(0x2A2A2A, 0.8));
  camModule.position.set(1.35, 5.05, 0);
  g.add(camModule);
  const camLens = new THREE.Mesh(new THREE.CircleGeometry(0.02, 8), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.8 }));
  camLens.position.set(1.3, 5.05, 0.055);
  g.add(camLens);

  // Wireless antenna
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.008, 0.2, 6), poleMat);
  antenna.position.set(1.5, 5.18, 0);
  g.add(antenna);

  // Base plate
  const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.06, 12), poleMat);
  basePlate.position.y = 0.03;
  g.add(basePlate);

  g.position.set(x, 0, z);
  return g;
}

// ──────────────────────────────────────────────────────────────────────
// Rain Garden
// ──────────────────────────────────────────────────────────────────────

function buildRainGarden(x: number, z: number, radius: number = 1.2): THREE.Group {
  const g = new THREE.Group();
  g.name = 'rain_garden';

  const soilMat = new THREE.MeshStandardMaterial({ color: 0x5A4A30, roughness: 1.0 });
  const grassMat = foliageMat();
  const plantMat1 = new THREE.MeshStandardMaterial({ color: 0x3A7A32, roughness: 0.9 });
  const plantMat2 = new THREE.MeshStandardMaterial({ color: 0x5A9A50, roughness: 0.85 });
  const mulchMat = new THREE.MeshStandardMaterial({ color: 0x5A3A1A, roughness: 1.0 });

  // Depressed basin
  const basinGeo = new THREE.CylinderGeometry(radius, radius * 0.9, 0.15, 16);
  const basin = new THREE.Mesh(basinGeo, soilMat);
  basin.position.y = 0.075;
  g.add(basin);

  // Soil layer
  const soilGeo = new THREE.CylinderGeometry(radius * 0.9, radius * 0.85, 0.08, 16);
  const soil = new THREE.Mesh(soilGeo, soilMat);
  soil.position.y = 0.11;
  g.add(soil);

  // Mulch ring
  const mulchGeo = new THREE.RingGeometry(radius * 0.7, radius, 16);
  const mulch = new THREE.Mesh(mulchGeo, mulchMat);
  mulch.rotation.x = -Math.PI / 2;
  mulch.position.y = 0.155;
  g.add(mulch);

  // Plants and grasses
  const plantPositions = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
    const r = 0.2 + Math.random() * (radius * 0.6);
    plantPositions.push({
      x: Math.cos(angle) * r,
      z: Math.sin(angle) * r,
      h: 0.15 + Math.random() * 0.35,
      type: i % 3,
    });
  }
  for (const pp of plantPositions) {
    if (pp.type === 0) {
      // Grass tuft
      const tuftGeo = new THREE.SphereGeometry(pp.h * 0.4, 6, 4);
      const tuft = new THREE.Mesh(tuftGeo, grassMat);
      tuft.position.set(pp.x, pp.h / 2 + 0.15, pp.z);
      tuft.scale.y = 1.3;
      g.add(tuft);
    } else if (pp.type === 1) {
      // Flowering plant
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, pp.h, 4), plantMat1);
      stem.position.set(pp.x, pp.h / 2 + 0.15, pp.z);
      g.add(stem);
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), plantMat2);
      flower.position.set(pp.x, pp.h + 0.15, pp.z);
      g.add(flower);
    } else {
      // Succulent / low plant
      const succ = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), plantMat2);
      succ.position.set(pp.x, 0.18, pp.z);
      succ.scale.y = 0.5;
      g.add(succ);
    }
  }

  // Overflow drain
  const drainMat = steelMat(0.8);
  const drainPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8), drainMat);
  drainPipe.position.set(radius * 0.85, 0.1, 0);
  g.add(drainPipe);

  g.position.set(x, 0, z);
  return g;
}

// ──────────────────────────────────────────────────────────────────────
// Parklet
// ──────────────────────────────────────────────────────────────────────

function buildParklet(x: number, z: number, rotZ: number = 0): THREE.Group {
  const g = new THREE.Group();
  g.name = 'parklet';

  const deckMat = woodMat();
  const frameMat = steelMat(0.8);
  const plantMat = foliageMat();

  // Raised deck platform
  const deck = mkBox(3.0, 0.15, 1.5, deckMat);
  deck.position.y = 0.55;
  g.add(deck);

  // Support structure
  for (const sx of [-1.3, 1.3]) {
    for (const sz of [-0.55, 0.55]) {
      const leg = mkBox(0.08, 0.55, 0.08, frameMat);
      leg.position.set(sx, 0.275, sz);
      g.add(leg);
    }
  }

  // Bench seating along sides
  for (const side of [-1, 1]) {
    const benchSeat = mkBox(2.4, 0.06, 0.35, deckMat);
    benchSeat.position.set(0, 0.68, side * 0.55);
    g.add(benchSeat);
    const benchLeg = mkBox(2.2, 0.45, 0.04, frameMat);
    benchLeg.position.set(0, 0.42, side * 0.72);
    g.add(benchLeg);
  }

  // Planter boxes
  for (const px of [-1.2, 1.2]) {
    const planterBox = mkBox(0.5, 0.4, 1.2, deckMat);
    planterBox.position.set(px, 0.85, 0);
    g.add(planterBox);
    // Plants
    for (let i = 0; i < 3; i++) {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), plantMat);
      bush.position.set(px, 1.1, -0.3 + i * 0.3);
      g.add(bush);
    }
  }

  // Small table
  const tableTop = mkBox(0.6, 0.04, 0.6, deckMat);
  tableTop.position.set(0, 0.8, 0);
  g.add(tableTop);
  const tableLeg = mkBox(0.04, 0.22, 0.04, frameMat);
  tableLeg.position.set(0, 0.68, 0);
  g.add(tableLeg);

  g.position.set(x, 0, z);
  g.rotation.y = rotZ;
  return g;
}

// ──────────────────────────────────────────────────────────────────────
// Parcel Locker
// ──────────────────────────────────────────────────────────────────────

function buildParcelLocker(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'parcel_locker';

  const bodyMat = contemporaryPaint(0x4488AA, 0.8);
  const doorMat = contemporaryPaint(0x336688, 0.7);
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x00AAFF, transparent: true, opacity: 0.6 });

  // Main cabinet
  const cabinet = mkBox(1.2, 2.0, 0.6, bodyMat);
  cabinet.position.y = 1.0;
  g.add(cabinet);

  // Grid of locker doors
  const cols = 3, rows = 4;
  const doorW = 0.32, doorH = 0.38;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const door = mkBox(doorW, doorH, 0.02, doorMat);
      const dx = -0.4 + c * 0.4;
      const dy = 0.4 + r * 0.45;
      door.position.set(dx, dy, 0.31);
      g.add(door);
      // Door handle
      const handle = mkBox(0.04, 0.08, 0.01, chromeMat(0.9));
      handle.position.set(dx + 0.1, dy, 0.33);
      g.add(handle);
    }
  }

  // Screen / kiosk
  const screen = mkBox(0.5, 0.35, 0.02, screenMat);
  screen.position.set(0, 1.85, 0.31);
  g.add(screen);
  const screenBezel = mkBox(0.54, 0.39, 0.01, contemporaryPaint(0x222222, 0.8));
  screenBezel.position.set(0, 1.85, 0.30);
  g.add(screenBezel);

  // Card reader
  const cardReader = mkBox(0.08, 0.1, 0.02, contemporaryPaint(0x333333, 0.8));
  cardReader.position.set(0.35, 1.5, 0.31);
  g.add(cardReader);

  g.position.set(x, 0, z);
  return g;
}

// ──────────────────────────────────────────────────────────────────────
// Shared Mobility Dock
// ──────────────────────────────────────────────────────────────────────

function buildSharedMobilityDock(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'shared_mobility_dock';

  const postMat = steelMat(0.9);
  const dockMat = contemporaryPaint(0x00AA66, 0.9);
  const padMat = concreteMat(0.8);

  // Main post
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.2, 8), postMat);
  post.position.y = 0.6;
  g.add(post);

  // Top canopy
  const canopy = mkBox(0.6, 0.04, 0.3, dockMat);
  canopy.position.y = 1.22;
  g.add(canopy);

  // Docking slots
  for (let i = 0; i < 4; i++) {
    const slot = mkBox(0.06, 0.15, 0.06, dockMat);
    slot.position.set(-0.2 + i * 0.13, 0.9, 0.15);
    g.add(slot);
    // Indicator LED
    const led = mkBox(0.02, 0.02, 0.01, new THREE.MeshBasicMaterial({ color: i < 2 ? 0x00FF66 : 0xFF3333, transparent: true, opacity: 0.7 }));
    led.position.set(-0.2 + i * 0.13, 1.0, 0.18);
    g.add(led);
  }

  // Ground pad
  const pad = mkBox(0.8, 0.03, 0.4, padMat);
  pad.position.y = 0.015;
  g.add(pad);

  // Branding stripe
  const stripe = mkBox(0.5, 0.03, 0.01, contemporaryPaint(0xFFFFFF, 0.9));
  stripe.position.set(0, 0.75, 0.15);
  g.add(stripe);

  g.position.set(x, 0, z);
  return g;
}

// ──────────────────────────────────────────────────────────────────────
// Pedestrian Pose Variants for 2025
// ──────────────────────────────────────────────────────────────────────

/** Generate a pedestrian with phone-in-hand pose */
function buildPhoneInHandPedestrian(params: PedestrianParams): ReturnType<typeof generatePedestrian> {
  const result = generatePedestrian({
    ...params,
    accessories: ['phone'],
    outfit: params.outfit ?? 'street_urban',
  });
  return result;
}

/** Generate a pedestrian on an e-scooter (animated rider) */
function buildEScooterRider(params: PedestrianParams): ReturnType<typeof generatePedestrian> {
  const result = generatePedestrian({
    ...params,
    accessories: [],
    outfit: params.outfit ?? 'street_urban',
  });
  // Add scooter underneath
  const scooter = buildEScooter(0, 0, true);
  result.group.add(scooter);
  return result;
}

/** Generate a delivery rider with insulated backpack */
function buildDeliveryRider(params: PedestrianParams): ReturnType<typeof generatePedestrian> {
  const result = generatePedestrian({
    ...params,
    accessories: ['bag'],
    outfit: params.outfit ?? 'street_urban',
  });
  // Insulated delivery backpack (large box on back)
  const bpMat = contemporaryPaint(0x222222, 0.8);
  const backpack = mkBox(0.35, 0.35, 0.2, bpMat);
  backpack.position.set(0, 0.05, -0.2);
  result.group.add(backpack);
  // Reflective stripe
  const stripeMat = contemporaryPaint(0xFFCC00, 0.9);
  const stripe = mkBox(0.3, 0.04, 0.01, stripeMat);
  stripe.position.set(0, 0.05, -0.31);
  result.group.add(stripe);
  // Logo patch
  const logoPatch = mkBox(0.12, 0.08, 0.01, contemporaryPaint(0x00AA66, 0.9));
  logoPatch.position.set(0, 0.12, -0.31);
  result.group.add(logoPatch);
  return result;
}

/** Generate a rollerblader */
function buildRollerblader(params: PedestrianParams): ReturnType<typeof generatePedestrian> {
  const result = generatePedestrian({
    ...params,
    accessories: [],
    outfit: params.outfit ?? 'street_urban',
  });
  // Rollerblade boots
  const bootMat = contemporaryPaint(0x222222, 0.7);
  for (const side of [-1, 1]) {
    const boot = mkBox(0.06, 0.12, 0.2, bootMat);
    boot.position.set(side * 0.07, -0.82, 0.02);
    result.group.add(boot);
    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.02, 8);
    const wheelMat = concreteMat(0.7);
    for (let wi = 0; wi < 4; wi++) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(side * 0.07, -0.88, -0.05 + wi * 0.05);
      wheel.rotation.x = Math.PI / 2;
      result.group.add(wheel);
    }
  }
  return result;
}

/** Generate a pedestrian with wireless earbuds and smartwatch */
function buildTechAccessoryPedestrian(params: PedestrianParams): ReturnType<typeof generatePedestrian> {
  const result = generatePedestrian({
    ...params,
    accessories: ['phone'],
    outfit: params.outfit ?? 'street_urban',
  });
  // Earbuds (small spheres near ears)
  const earbudMat = contemporaryPaint(0xFFFFFF, 0.9);
  for (const side of [-1, 1]) {
    const earbud = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), earbudMat);
    earbud.position.set(side * 0.15, -0.02, 0.12);
    result.group.add(earbud);
  }
  // Smartwatch on wrist
  const watchBand = mkBox(0.05, 0.03, 0.06, contemporaryPaint(0x111111, 0.8));
  watchBand.position.set(0.3, -0.42, 0.08);
  result.group.add(watchBand);
  const watchFace = mkBox(0.04, 0.025, 0.01, new THREE.MeshBasicMaterial({ color: 0x3388FF, transparent: true, opacity: 0.6 }));
  watchFace.position.set(0.3, -0.42, 0.11);
  result.group.add(watchFace);
  return result;
}

// ──────────────────────────────────────────────────────────────────────
// ERA MODULE DEFINITION
// ──────────────────────────────────────────────────────────────────────

export const era2025 = {
  id: '2025' as const,

  // ── Animated resources tracking ──────────────────────────────────
  _billboards: [] as AnimatedBillboardState[],
  _busShelters: [] as AnimatedBusShelterState[],

  build(): THREE.Group {
    const scene = new THREE.Group();
    scene.name = 'era_2025';

    const palette = getEraPalette();
    const cond = 0.8; // Well-maintained contemporary condition

    // ═══════════════════════════════════════════════════════════════
    // SUBGROUP: buildings — all structures, facades, and ground plane
    // ═══════════════════════════════════════════════════════════════
    const buildingsGroup = new THREE.Group();
    buildingsGroup.name = 'buildings';

    // ── Restored Heritage Facades ──────────────────────────────────
    // A restored 1940s building with clean plaster and fresh trim
    const heritageFacade = new THREE.Group();
    heritageFacade.name = 'heritage_facades';

    const hW = 10, hH = 9, hD = 7;
    const hFloors = 3;
    // Main wall — restored plaster
    const hWall = mkBox(hW, hH, hD, heritagePlasterMat(cond));
    hWall.position.y = hH / 2;
    heritageFacade.add(hWall);

    // Stone foundation
    const foundation = mkBox(hW + 0.2, 0.8, hD + 0.2, stoneMat(cond));
    foundation.position.y = 0.4;
    heritageFacade.add(foundation);

    // Windows with restored frames
    for (let f = 0; f < hFloors; f++) {
      for (let b = 0; b < 5; b++) {
        const wx = -hW / 2 + 1.2 + b * 2.0;
        const wy = 2.0 + f * 3.0;
        // Window frame
        const wf = mkBox(0.9, 1.4, 0.04, contemporaryPaint(0xF5F0E8, cond));
        wf.position.set(wx, wy, hD / 2 + 0.01);
        heritageFacade.add(wf);
        // Glass
        const wg = mkBox(0.7, 1.2, 0.02, modernGlassMat(cond));
        wg.position.set(wx, wy, hD / 2 + 0.04);
        heritageFacade.add(wg);
      }
    }

    // Decorative cornice (restored detail)
    const cornice = mkBox(hW + 0.5, 0.3, hD + 0.5, contemporaryPaint(palette.heritageTrim, cond));
    cornice.position.set(0, hH + 0.15, 0);
    heritageFacade.add(cornice);

    // Plaque marker (heritage designation)
    const plaque = mkBox(0.4, 0.3, 0.02, chromeMat(cond));
    plaque.position.set(hW / 2 - 1.0, 2.0, hD / 2 + 0.02);
    heritageFacade.add(plaque);

    buildingsGroup.add(heritageFacade);

    // Second heritage building adjacent
    const heritage2 = new THREE.Group();
    heritage2.name = 'heritage_facade_2';
    const h2Wall = mkBox(8, 7, 6, brickMat(cond));
    h2Wall.position.y = 3.5;
    heritage2.add(h2Wall);
    const h2Found = mkBox(8.2, 0.6, 6.2, stoneMat(cond));
    h2Found.position.y = 0.3;
    heritage2.add(h2Found);
    for (let f = 0; f < 2; f++) {
      for (let b = 0; b < 4; b++) {
        const wx = -3.5 + b * 2.2;
        const wy = 2.0 + f * 3.0;
        const wf2 = mkBox(0.8, 1.2, 0.04, contemporaryPaint(0xF5F0E8, cond));
        wf2.position.set(wx, wy, 3.01);
        heritage2.add(wf2);
        const wg2 = mkBox(0.6, 1.0, 0.02, modernGlassMat(cond));
        wg2.position.set(wx, wy, 3.04);
        heritage2.add(wg2);
      }
    }
    const cornice2 = mkBox(8.4, 0.25, 6.4, contemporaryPaint(palette.heritageTrim, cond));
    cornice2.position.set(0, 7.125, 0);
    heritage2.add(cornice2);
    buildingsGroup.add(heritage2);

    // ── Modern Glass Residential Towers ────────────────────────────
    const towers = new THREE.Group();
    towers.name = 'glass_towers';

    // Tower 1 — main residential tower
    const t1W = 8, t1H = 24, t1D = 8;
    const t1Floors = 8;
    // Core structure
    const t1Core = mkBox(t1W, t1H, t1D, contemporaryPaint(0xE8E8E8, cond));
    t1Core.position.y = t1H / 2;
    towers.add(t1Core);

    // Curtain wall facade
    const t1Glass = mkBox(t1W - 0.2, t1H, 0.08, modernGlassMat(cond));
    t1Glass.position.set(0, t1H / 2, t1D / 2 + 0.04);
    towers.add(t1Glass);

    // Curtain wall mullions (vertical frames)
    const mullionMat = curtainWallFrameMat(cond);
    for (let b = 0; b <= 6; b++) {
      const mx = -t1W / 2 + b * (t1W / 6);
      const mullion = mkBox(0.06, t1H, 0.06, mullionMat);
      mullion.position.set(mx, t1H / 2, t1D / 2 + 0.08);
      towers.add(mullion);
    }
    // Horizontal spandrels
    for (let f = 0; f <= t1Floors; f++) {
      const sy = f * (t1H / t1Floors);
      const spandrel = mkBox(t1W, 0.12, 0.06, mullionMat);
      spandrel.position.set(0, sy, t1D / 2 + 0.08);
      towers.add(spandrel);
    }

    // Balconies
    const balconyMat = contemporaryPaint(0xC0C0C0, cond);
    for (let f = 1; f < t1Floors; f++) {
      const by = f * (t1H / t1Floors) + 0.5;
      for (let bx = -2; bx <= 2; bx++) {
        if (bx % 2 !== 0) continue; // Every other bay has a balcony
        const balc = mkBox(1.2, 0.08, 0.9, balconyMat);
        balc.position.set(bx * 1.3, by, t1D / 2 + 0.45);
        towers.add(balc);
        // Glass railing
        const rail = mkBox(1.1, 0.8, 0.02, modernGlassMat(cond));
        rail.position.set(bx * 1.3, by + 0.45, t1D / 2 + 0.88);
        towers.add(rail);
      }
    }

    // Green roof
    const greenRoof = mkBox(t1W - 1, 0.3, t1D - 1, greenRoofMat());
    greenRoof.position.set(0, t1H + 0.15, 0);
    towers.add(greenRoof);
    // Rooftop vegetation
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x3A7A32, roughness: 0.9 });
    for (let i = 0; i < 8; i++) {
      const bx = (Math.random() - 0.5) * (t1W - 2);
      const bz = (Math.random() - 0.5) * (t1D - 2);
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.25 + Math.random() * 0.2, 8, 6), bushMat);
      bush.position.set(bx, t1H + 0.5, bz);
      towers.add(bush);
    }

    // Rooftop solar arrays
    const solarAngle = Math.PI / 6;
    for (let i = 0; i < 4; i++) {
      const panel = mkBox(1.8, 1.2, 0.04, solarPanelMat());
      panel.position.set(-2 + i * 1.5, t1H + 0.6, 0);
      panel.rotation.x = -solarAngle;
      towers.add(panel);
      // Panel support
      const support = mkBox(0.04, 0.4, 0.04, steelMat(cond));
      support.position.set(-2 + i * 1.5, t1H + 0.4, -0.3);
      towers.add(support);
    }

    towers.add(t1Core); // Already added above; this is fine for grouping

    // Tower 2 — slightly shorter mixed-use tower
    const t2W = 6, t2H = 18, t2D = 6;
    const t2Core = mkBox(t2W, t2H, t2D, contemporaryPaint(0xD8D8D8, cond));
    t2Core.position.y = t2H / 2;
    towers.add(t2Core);
    const t2Glass = mkBox(t2W - 0.2, t2H, 0.06, darkTintedGlass(cond));
    t2Glass.position.set(0, t2H / 2, t2D / 2 + 0.03);
    towers.add(t2Glass);
    // Vertical mullions
    for (let b = 0; b <= 4; b++) {
      const mx = -t2W / 2 + b * (t2W / 4);
      const mull = mkBox(0.05, t2H, 0.05, mullionMat);
      mull.position.set(mx, t2H / 2, t2D / 2 + 0.07);
      towers.add(mull);
    }
    // Balconies
    for (let f = 1; f < 6; f++) {
      const by = f * (t2H / 6) + 0.5;
      const balc = mkBox(1.0, 0.06, 0.7, balconyMat);
      balc.position.set(0, by, t2D / 2 + 0.35);
      towers.add(balc);
    }
    // Green roof
    const gr2 = mkBox(t2W - 0.8, 0.25, t2D - 0.8, greenRoofMat());
    gr2.position.set(0, t2H + 0.125, 0);
    towers.add(gr2);

    buildingsGroup.add(towers);

    // ── Floor-to-Ceiling Glass Storefronts ─────────────────────────
    const storefronts = new THREE.Group();
    storefronts.name = 'storefronts';

    // Storefront 1: Coffee shop with minimalist signage
    const csWidth = 5, csHeight = 3.5;
    const csBack = mkBox(csWidth, csHeight, 0.3, contemporaryPaint(0xFAFAFA, cond));
    csBack.position.set(-10, csHeight / 2, 0);
    storefronts.add(csBack);

    // Floor-to-ceiling glass
    const csGlass = mkBox(csWidth - 0.1, csHeight - 0.3, 0.03, modernGlassMat(cond));
    csGlass.position.set(-10, 0.15 + (csHeight - 0.3) / 2, 0.16);
    storefronts.add(csGlass);

    // Minimalist typography sign above
    const csSignBg = mkBox(3, 0.5, 0.04, contemporaryPaint(0x1A1A1A, cond));
    csSignBg.position.set(-10, csHeight - 0.4, 0.18);
    storefronts.add(csSignBg);
    const csSignText = mkBox(2.5, 0.3, 0.01, new THREE.MeshBasicMaterial({ color: 0xFFFFFF }));
    csSignText.position.set(-10, csHeight - 0.4, 0.21);
    storefronts.add(csSignText);

    // QR code poster in window
    const qrTex = qrCodePosterTexture('COFFEE CLUB');
    const qrPoster = mkBox(0.5, 0.7, 0.005, new THREE.MeshBasicMaterial({ map: qrTex }));
    qrPoster.position.set(-11.2, 1.8, 0.17);
    storefronts.add(qrPoster);

    // Second QR poster
    const qrTex2 = qrCodePosterTexture('ORDER ONLINE');
    const qrPoster2 = mkBox(0.4, 0.5, 0.005, new THREE.MeshBasicMaterial({ map: qrTex2 }));
    qrPoster2.position.set(-8.5, 2.0, 0.17);
    storefronts.add(qrPoster2);

    // Contactless payment terminal on counter inside
    const terminal = mkBox(0.15, 0.12, 0.08, contemporaryPaint(0x333333, 0.8));
    terminal.position.set(-9.5, 1.0, 0.1);
    storefronts.add(terminal);
    const terminalScreen = mkBox(0.08, 0.06, 0.005, new THREE.MeshBasicMaterial({ color: 0x00AAFF, transparent: true, opacity: 0.6 }));
    terminalScreen.position.set(-9.5, 1.03, 0.145);
    storefronts.add(terminalScreen);

    storefronts.add(csBack); // Re-added for grouping

    // Storefront 2: Ghost Kitchen / Salad Bar
    const gsWidth = 4.5, gsHeight = 3.5;
    const gsBack = mkBox(gsWidth, gsHeight, 0.3, contemporaryPaint(0xF0F5F0, cond));
    gsBack.position.set(-5, gsHeight / 2, 0);
    storefronts.add(gsBack);
    const gsGlass = mkBox(gsWidth - 0.1, gsHeight - 0.3, 0.03, modernGlassMat(cond));
    gsGlass.position.set(-5, 0.15 + (gsHeight - 0.3) / 2, 0.16);
    storefronts.add(gsGlass);

    // Signage
    const gsSign = mkBox(2.5, 0.4, 0.04, contemporaryPaint(0x00AA55, cond));
    gsSign.position.set(-5, gsHeight - 0.35, 0.18);
    storefronts.add(gsSign);

    // QR poster
    const qrTex3 = qrCodePosterTexture('FRESH BOWLS');
    const qrPoster3 = mkBox(0.45, 0.6, 0.005, new THREE.MeshBasicMaterial({ map: qrTex3 }));
    qrPoster3.position.set(-6.0, 2.0, 0.17);
    storefronts.add(qrPoster3);

    storefronts.add(gsBack);

    // Storefront 3: Vacant retail unit with 'FOR LEASE' vinyl lettering
    const vlWidth = 5, vlHeight = 3.5;
    const vlBack = mkBox(vlWidth, vlHeight, 0.3, contemporaryPaint(0xE0DDD5, cond));
    vlBack.position.set(0, vlHeight / 2, 0);
    storefronts.add(vlBack);
    const vlGlass = mkBox(vlWidth - 0.1, vlHeight - 0.3, 0.03, modernGlassMat(0.5));
    vlGlass.position.set(0, 0.15 + (vlHeight - 0.3) / 2, 0.16);
    storefronts.add(vlGlass);

    // 'FOR LEASE' vinyl lettering on glass
    const flBanner = mkBox(2.5, 0.6, 0.005, new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.85 }));
    flBanner.position.set(0, 2.2, 0.18);
    storefronts.add(flBanner);
    const flText = mkBox(2.0, 0.35, 0.003, contemporaryPaint(0x003366, cond));
    flText.position.set(0, 2.2, 0.19);
    storefronts.add(flText);

    // Smaller "AVAILABLE" text
    const availBanner = mkBox(1.5, 0.3, 0.005, new THREE.MeshBasicMaterial({ color: 0x003366, transparent: true, opacity: 0.7 }));
    availBanner.position.set(0, 1.4, 0.18);
    storefronts.add(availBanner);

    storefronts.add(vlBack);

    // Storefront 4: Another active shop
    const asWidth = 4, asHeight = 3.5;
    const asBack = mkBox(asWidth, asHeight, 0.3, contemporaryPaint(0xFAFAFA, cond));
    asBack.position.set(5, asHeight / 2, 0);
    storefronts.add(asBack);
    const asGlass = mkBox(asWidth - 0.1, asHeight - 0.3, 0.03, modernGlassMat(cond));
    asGlass.position.set(5, 0.15 + (asHeight - 0.3) / 2, 0.16);
    storefronts.add(asGlass);
    const asSign = mkBox(2, 0.4, 0.04, contemporaryPaint(0x333333, cond));
    asSign.position.set(5, asHeight - 0.35, 0.18);
    storefronts.add(asSign);
    const qrTex4 = qrCodePosterTexture('PAY VIA APP');
    const qrPoster4 = mkBox(0.4, 0.5, 0.005, new THREE.MeshBasicMaterial({ map: qrTex4 }));
    qrPoster4.position.set(4, 2.0, 0.17);
    storefronts.add(qrPoster4);

    storefronts.add(asBack);

    buildingsGroup.add(storefronts);

    // ── Sidewalk ───────────────────────────────────────────────────
    const sidewalk = mkBox(30, 0.1, 3, concreteMat(cond));
    sidewalk.position.set(0, 0.05, 3);
    buildingsGroup.add(sidewalk);

    // Crosswalk markings
    for (let i = 0; i < 6; i++) {
      const stripe = mkBox(0.4, 0.01, 2.5, contemporaryPaint(palette.crosswalkWhite, cond));
      stripe.position.set(-2 + i * 0.9, 0.11, 3);
      buildingsGroup.add(stripe);
    }

    // Street surface
    const street = mkBox(30, 0.08, 8, contemporaryPaint(0x444440, cond));
    street.position.set(0, 0.04, -1);
    buildingsGroup.add(street);

    // ═══════════════════════════════════════════════════════════════
    // SUBGROUP: upperFloors — rooftop and above-street elements
    // ═══════════════════════════════════════════════════════════════
    const upperFloors = new THREE.Group();
    upperFloors.name = 'upperFloors';

    // Additional rooftop details already included in towers above
    // Additional water tank / mechanical penthouse on older building
    const mechRoom = mkBox(3, 2, 3, contemporaryPaint(0xCCCCCC, cond));
    mechRoom.position.set(-10, 11, 0);
    upperFloors.add(mechRoom);
    // Vent pipes
    for (const vx of [-1, 0, 1]) {
      const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8), steelMat(cond));
      vent.position.set(-10 + vx * 0.8, 12.25, 0);
      upperFloors.add(vent);
    }

    buildingsGroup.add(upperFloors);

    // ═══════════════════════════════════════════════════════════════
    // SUBGROUP: vehicles
    // ═══════════════════════════════════════════════════════════════
    const vehicles = new THREE.Group();
    vehicles.name = 'vehicles';

    // Contemporary EV Sedan with light bar
    const evSedan = generateVehicle({
      paintColor: 0x1A1A2E,
      type: 'sedan' as VehicleBodyType,
      scale: 1.0,
      headlightStyle: 'rectangular',
      taillightStyle: 'vertical_strip',
      windowTint: 0.3,
      condition: 0.9,
    });
    evSedan.group.position.set(-6, 0, -2);
    vehicles.add(evSedan.group);

    // Contemporary EV Crossover
    const evCrossover = generateVehicle({
      paintColor: 0xF0F0F0,
      type: 'car' as VehicleBodyType,
      scale: 1.1,
      headlightStyle: 'rectangular',
      taillightStyle: 'vertical_strip',
      windowTint: 0.2,
      condition: 0.9,
    });
    evCrossover.group.position.set(-3, 0, -2);
    vehicles.add(evCrossover.group);

    // Delivery van
    const deliveryVan = generateVehicle({
      paintColor: 0xFFFFFF,
      type: 'van' as VehicleBodyType,
      scale: 1.0,
      condition: 0.8,
    });
    deliveryVan.group.position.set(2, 0, -2);
    vehicles.add(deliveryVan.group);

    // Rideshare taxi with roof sticker
    const rideshare = generateVehicle({
      paintColor: 0xDDCC44,
      type: 'taxi' as VehicleBodyType,
      scale: 1.0,
      condition: 0.7,
    });
    // Roof sticker (yellow/black checkered band)
    const roofSticker = mkBox(1.2, 0.06, 0.6, contemporaryPaint(0x222222, 0.9));
    roofSticker.position.set(0.5, 1.85, 0);
    rideshare.group.add(roofSticker);
    const yellowStripe = mkBox(1.1, 0.04, 0.5, contemporaryPaint(0xDDCC44, 0.9));
    yellowStripe.position.set(0.5, 1.88, 0);
    rideshare.group.add(yellowStripe);
    rideshare.group.position.set(6, 0, -2);
    vehicles.add(rideshare.group);

    // E-bikes parked
    vehicles.add(buildEBike(-8, 3.5, true));
    vehicles.add(buildEBike(-7.5, 3.5, false));
    vehicles.add(buildEBike(8, 3.5, true));

    // E-scooters parked
    vehicles.add(buildEScooter(-7, 3.5, true));
    vehicles.add(buildEScooter(-6.5, 3.5, false));
    vehicles.add(buildEScooter(7.5, 3.5, true));
    vehicles.add(buildEScooter(8.2, 3.5, false));

    // Autonomous delivery pod
    vehicles.add(buildAutonomousPod(4, -2, 0));

    // Additional parked cars
    const parkedCar1 = generateVehicle({
      paintColor: 0x2244AA,
      type: 'sedan' as VehicleBodyType,
      scale: 0.95,
      condition: 0.7,
    });
    parkedCar1.group.position.set(-10, 0, -2);
    vehicles.add(parkedCar1.group);

    const parkedCar2 = generateVehicle({
      paintColor: 0x888888,
      type: 'car' as VehicleBodyType,
      scale: 0.95,
      condition: 0.7,
    });
    parkedCar2.group.position.set(10, 0, -2);
    vehicles.add(parkedCar2.group);

    buildingsGroup.add(vehicles);

    // ═══════════════════════════════════════════════════════════════
    // SUBGROUP: pedestrians
    // ═══════════════════════════════════════════════════════════════
    const pedestrians = new THREE.Group();
    pedestrians.name = 'pedestrians';

    // Athleisure pedestrian (walking)
    const athleisure = generatePedestrian({
      outfit: 'street_urban' as any,
      palette: { top: 0x444444, bottom: 0x222222, shoes: 0xFFFFFF, accent: 0x00AA66 },
      walkSpeed: 2.5,
      animated: true,
    });
    athleisure.group.position.set(-5, 0, 4);
    pedestrians.add(athleisure.group);

    // Oversized tee / hoodie pedestrian
    const oversized = generatePedestrian({
      outfit: 'street_urban' as any,
      palette: { top: 0x555555, bottom: 0x333333, shoes: 0xFFFFFF, accent: 0xCC3366 },
      walkSpeed: 2.0,
      animated: true,
    });
    oversized.group.position.set(-2, 0, 4.2);
    pedestrians.add(oversized.group);

    // Slim jeans + white sneakers pedestrian
    const slimJeans = generatePedestrian({
      outfit: 'street_urban' as any,
      palette: { top: 0x222222, bottom: 0x334466, shoes: 0xFFFFFF, accent: 0x3388FF },
      walkSpeed: 2.2,
      animated: true,
    });
    slimJeans.group.position.set(1, 0, 4);
    pedestrians.add(slimJeans.group);

    // Puffer jacket pedestrian
    const puffer = generatePedestrian({
      outfit: 'street_urban' as any,
      palette: { top: 0x1A1A1A, bottom: 0x222222, shoes: 0x222222, accent: 0xFF6633 },
      walkSpeed: 1.8,
      animated: true,
    });
    puffer.group.position.set(4, 0, 4.3);
    pedestrians.add(puffer.group);

    // Yoga pants + tote bag pedestrian
    const yogaPants = generatePedestrian({
      outfit: 'street_urban' as any,
      palette: { top: 0x666666, bottom: 0x1A1A1A, shoes: 0xFFFFFF, accent: 0x9966CC },
      walkSpeed: 2.0,
      animated: true,
      accessories: ['bag'],
    });
    yogaPants.group.position.set(7, 0, 4);
    pedestrians.add(yogaPants.group);

    // Phone-in-hand pedestrian (animated)
    const phoneUser = buildPhoneInHandPedestrian({
      outfit: 'street_urban' as any,
      palette: { top: 0x334455, bottom: 0x333333, shoes: 0xFFFFFF, accent: 0x00CCFF },
      walkSpeed: 1.5,
      animated: true,
    });
    phoneUser.group.position.set(-3.5, 0, 4.5);
    pedestrians.add(phoneUser.group);

    // E-scooter rider (animated)
    const scooterRider = buildEScooterRider({
      outfit: 'street_urban' as any,
      palette: { top: 0x2A2A2A, bottom: 0x222222, shoes: 0x333333, accent: 0x00FF88 },
      walkSpeed: 3.0,
      animated: true,
    });
    scooterRider.group.position.set(3, 0, 4.2);
    pedestrians.add(scooterRider.group);

    // Delivery rider with insulated backpack
    const deliveryRider = buildDeliveryRider({
      outfit: 'street_urban' as any,
      palette: { top: 0x222222, bottom: 0x1A1A1A, shoes: 0x222222, accent: 0xFFCC00 },
      walkSpeed: 2.5,
      animated: true,
    });
    deliveryRider.group.position.set(5.5, 0, 4);
    pedestrians.add(deliveryRider.group);

    // Rollerblader
    const rollerblader = buildRollerblader({
      outfit: 'street_urban' as any,
      palette: { top: 0x444444, bottom: 0x222222, shoes: 0xFFFFFF, accent: 0xFF3388 },
      walkSpeed: 4.0,
      animated: true,
    });
    rollerblader.group.position.set(0, 0, 4.5);
    pedestrians.add(rollerblader.group);

    // Tech accessory pedestrian (wireless earbuds + smartwatch)
    const techPed = buildTechAccessoryPedestrian({
      outfit: 'street_urban' as any,
      palette: { top: 0x555555, bottom: 0x333333, shoes: 0xFFFFFF, accent: 0x3388FF },
      walkSpeed: 2.0,
      animated: true,
    });
    techPed.group.position.set(8.5, 0, 4.3);
    pedestrians.add(techPed.group);

    buildingsGroup.add(pedestrians);

    // ═══════════════════════════════════════════════════════════════
    // SUBGROUP: props — street furniture and infrastructure
    // ═══════════════════════════════════════════════════════════════
    const props = new THREE.Group();
    props.name = 'props';

    // ── EV Chargers at curbside ────────────────────────────────────
    const evCharger1 = generateProp({ type: 'ev_charger' as PropType, scale: 1.1, color: 0x00CC66 });
    evCharger1.group.position.set(-4, 0, 5.5);
    props.add(evCharger1.group);

    const evCharger2 = generateProp({ type: 'ev_charger' as PropType, scale: 1.1, color: 0x00CC66 });
    evCharger2.group.position.set(3, 0, 5.5);
    props.add(evCharger2.group);

    // Custom EV charger (larger dual-port)
    const evCharger3 = new THREE.Group();
    evCharger3.name = 'ev_charger_dual';
    const evBody3 = mkBox(0.5, 1.8, 0.3, EVChargeMat());
    evBody3.position.y = 0.9;
    evCharger3.add(evBody3);
    // Dual screens
    const evScreenMat = new THREE.MeshBasicMaterial({ color: 0x00FF88, transparent: true, opacity: 0.4 });
    const evScreen1 = mkBox(0.3, 0.35, 0.01, evScreenMat);
    evScreen1.position.set(0, 1.2, 0.16);
    evCharger3.add(evScreen1);
    const evScreen2 = mkBox(0.3, 0.35, 0.01, evScreenMat);
    evScreen2.position.set(0, 0.7, 0.16);
    evCharger3.add(evScreen2);
    // LED ring indicators
    const evRingMat = new THREE.MeshBasicMaterial({ color: 0x00FF66, transparent: true, opacity: 0.7 });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 8, 16), evRingMat);
    ring1.position.set(-0.12, 1.2, 0.17);
    evCharger3.add(ring1);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 8, 16), evRingMat);
    ring2.position.set(0.12, 0.7, 0.17);
    evCharger3.add(ring2);
    // Cable
    const cableMat = contemporaryPaint(0x222222, 0.8);
    const cable = mkBox(0.02, 0.02, 0.5, cableMat);
    cable.position.set(0.25, 0.5, 0.3);
    cable.rotation.z = -0.3;
    evCharger3.add(cable);
    evCharger3.position.set(-1.5, 0, 5.5);
    props.add(evCharger3);

    // ── Dockless E-scooter parking area ────────────────────────────
    // Additional scooters near shared mobility dock
    props.add(buildEScooter(6, 5.5, true));
    props.add(buildEScooter(6.5, 5.5, true));

    // ── Bike-share dock ────────────────────────────────────────────
    props.add(buildSharedMobilityDock(7, 5.5));

    // ── Delivery Robot ─────────────────────────────────────────────
    props.add(buildDeliveryRobot(1, 5.5));

    // ── Planters ───────────────────────────────────────────────────
    const planter1 = generateProp({ type: 'planter' as PropType, scale: 1.2 });
    planter1.group.position.set(-8, 0, 5);
    props.add(planter1.group);

    const planter2 = generateProp({ type: 'planter' as PropType, scale: 1.0 });
    planter2.group.position.set(0, 0, 5.5);
    props.add(planter2.group);

    const planter3 = generateProp({ type: 'planter' as PropType, scale: 1.1 });
    planter3.group.position.set(5, 0, 5);
    props.add(planter3.group);

    // ── Street Trees (saplings to mature canopies) ─────────────────
    // Sapling tree
    const sapling = new THREE.Group();
    sapling.name = 'tree_sapling';
    const saplingTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.5, 6), trunkMat());
    saplingTrunk.position.y = 0.75;
    sapling.add(saplingTrunk);
    const saplingCanopy = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), foliageMat());
    saplingCanopy.position.y = 1.8;
    sapling.add(saplingCanopy);
    sapling.position.set(-12, 0, 5);
    props.add(sapling);

    // Young tree
    const youngTree = new THREE.Group();
    youngTree.name = 'tree_young';
    const ytTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.5, 8), trunkMat());
    ytTrunk.position.y = 1.25;
    youngTree.add(ytTrunk);
    const ytCanopy = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), foliageMat());
    ytCanopy.position.y = 3.0;
    youngTree.add(ytCanopy);
    const ytCanopy2 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshStandardMaterial({ color: 0x4A8A40, roughness: 0.9 }));
    ytCanopy2.position.set(0.2, 3.3, 0.1);
    youngTree.add(ytCanopy2);
    youngTree.position.set(-4, 0, 5.5);
    props.add(youngTree);

    // Mature tree
    const matureTree = new THREE.Group();
    matureTree.name = 'tree_mature';
    const mtTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.5, 8), trunkMat());
    mtTrunk.position.y = 1.75;
    matureTree.add(mtTrunk);
    // Branches
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 1.2, 6), trunkMat());
      branch.position.set(Math.cos(angle) * 0.5, 3.0, Math.sin(angle) * 0.5);
      branch.rotation.z = Math.cos(angle) * 0.6;
      branch.rotation.x = Math.sin(angle) * 0.6;
      matureTree.add(branch);
    }
    // Large canopy
    const mtCanopy1 = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), foliageMat());
    mtCanopy1.position.set(0, 4.0, 0);
    matureTree.add(mtCanopy1);
    const mtCanopy2 = new THREE.Mesh(new THREE.SphereGeometry(1.0, 8, 6), new THREE.MeshStandardMaterial({ color: 0x4A8A40, roughness: 0.9 }));
    mtCanopy2.position.set(0.5, 4.3, 0.3);
    matureTree.add(mtCanopy2);
    const mtCanopy3 = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), new THREE.MeshStandardMaterial({ color: 0x3A6A27, roughness: 0.9 }));
    mtCanopy3.position.set(-0.4, 3.8, -0.3);
    matureTree.add(mtCanopy3);
    matureTree.position.set(9, 0, 5);
    props.add(matureTree);

    // Second mature tree
    const matureTree2 = new THREE.Group();
    matureTree2.name = 'tree_mature_2';
    const mt2Trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.0, 8), trunkMat());
    mt2Trunk.position.y = 1.5;
    matureTree2.add(mt2Trunk);
    const mt2Canopy = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 8), foliageMat());
    mt2Canopy.position.set(0, 3.5, 0);
    matureTree2.add(mt2Canopy);
    matureTree2.position.set(12, 0, 5);
    props.add(matureTree2);

    // ── Rain Gardens ───────────────────────────────────────────────
    props.add(buildRainGarden(-6, 5.8, 1.0));
    props.add(buildRainGarden(4, 5.8, 0.8));

    // ── Smart Traffic Lights ───────────────────────────────────────
    props.add(buildSmartTrafficLight(-3, 5.5));
    props.add(buildSmartTrafficLight(6, 5.5));

    // ── Sensor-Equipped Lamp Posts ─────────────────────────────────
    const lampPost1 = buildSensorLampPost(-9, 5.5);
    props.add(lampPost1);
    const lampPost2 = buildSensorLampPost(0, 5.5);
    props.add(lampPost2);
    const lampPost3 = buildSensorLampPost(9, 5.5);
    props.add(lampPost3);

    // ── Standard Lamp Posts ────────────────────────────────────────
    const stdLamp1 = generateProp({ type: 'lamp_post' as PropType, ornate: false, scale: 1.2 });
    stdLamp1.group.position.set(-6, 0, 5.5);
    props.add(stdLamp1.group);
    const stdLamp2 = generateProp({ type: 'lamp_post' as PropType, ornate: false, scale: 1.2 });
    stdLamp2.group.position.set(3, 0, 5.5);
    props.add(stdLamp2.group);

    // ── CCTV Cameras ───────────────────────────────────────────────
    const cctv1 = generateProp({ type: 'cctv' as PropType, ornate: true });
    cctv1.group.position.set(-9, 0, 5.5);
    props.add(cctv1.group);
    const cctv2 = generateProp({ type: 'cctv' as PropType, ornate: true });
    cctv2.group.position.set(9, 0, 5.5);
    props.add(cctv2.group);

    // ── Bollards (pedestrian-zone) ─────────────────────────────────
    for (let i = 0; i < 8; i++) {
      const bollard = generateProp({ type: 'bollard' as PropType });
      bollard.group.position.set(-8 + i * 2.2, 0, 5.8);
      props.add(bollard.group);
    }

    // ── Parcels Lockers ────────────────────────────────────────────
    props.add(buildParcelLocker(8, 5.5));

    // ── Parklets ───────────────────────────────────────────────────
    props.add(buildParklet(-1, 5.5, 0));

    // ── Benches ────────────────────────────────────────────────────
    const bench1 = generateProp({ type: 'bench' as PropType });
    bench1.group.position.set(-7, 0, 5.2);
    props.add(bench1.group);

    // ── Trash Can ──────────────────────────────────────────────────
    const trash1 = generateProp({ type: 'trash_can' as PropType });
    trash1.group.position.set(10, 0, 5.2);
    props.add(trash1.group);

    // ── Hydrant ────────────────────────────────────────────────────
    const hydrant = generateProp({ type: 'hydrant' as PropType });
    hydrant.group.position.set(-11, 0, 5.5);
    props.add(hydrant.group);

    buildingsGroup.add(props);

    // ═══════════════════════════════════════════════════════════════
    // SUBGROUP: signage — billboards, screens, digital ads
    // ═══════════════════════════════════════════════════════════════
    const signageGroup = new THREE.Group();
    signageGroup.name = 'signage';

    // Main digital LED billboard
    const bb1 = buildAnimatedLEDBillboard(10, 4, 8);
    bb1.group.position.set(2, 0, -1);
    signageGroup.add(bb1.group);
    this._billboards.push(bb1);

    // Secondary LED billboard (smaller, higher up)
    const bb2 = buildAnimatedLEDBillboard(6, 3, 12);
    bb2.group.position.set(-10, 0, -1);
    signageGroup.add(bb2.group);
    this._billboards.push(bb2);

    // Third LED billboard on tower side
    const bb3 = buildAnimatedLEDBillboard(4, 2.5, 15);
    bb3.group.position.set(6, 0, 1);
    bb3.group.rotation.y = Math.PI / 2;
    signageGroup.add(bb3.group);
    this._billboards.push(bb3);

    // Projection-mapped wall ad
    const projAd = buildProjectionMappedAd(6, 3, -10, 3);
    signageGroup.add(projAd);

    // Sticker-bombed utility boxes
    signageGroup.add(buildStickerBombUtilityBox(-2, 5.5, 1.0));
    signageGroup.add(buildStickerBombUtilityBox(5, 5.5, 0.9));

    // Digital bus shelter screens
    const bs1 = buildAnimatedBusShelterScreen(-8, 1.8);
    signageGroup.add(bs1.group);
    this._busShelters.push(bs1);

    const bs2 = buildAnimatedBusShelterScreen(10, 1.8);
    signageGroup.add(bs2.group);
    this._busShelters.push(bs2);

    // ═══════════════════════════════════════════════════════════════
    // Assemble all subgroups into scene
    // ═══════════════════════════════════════════════════════════════
    scene.add(buildingsGroup);
    scene.add(signageGroup);
    scene.add(vehicles);
    scene.add(pedestrians);
    scene.add(props);

    // Store references for dispose
    (scene as any)._eraResources = [
      evSedan, evCrossover, deliveryVan, parkedCar1, parkedCar2,
      athleisure, oversized, slimJeans, puffer, yogaPants,
      phoneUser, scooterRider, deliveryRider, rollerblader, techPed,
      evCharger1, evCharger2, planter1, planter2, planter3, stdLamp1, stdLamp2,
      cctv1, cctv2,
    ];

    return scene;
  },

  /**
   * Update animated elements each frame.
   * Drives digital billboard animations and pedestrian walk cycles.
   */
  update(dt: number, elapsed: number): void {
    // Animate LED billboards
    updateAnimatedBillboards(this._billboards, dt, elapsed);

    // Animate bus shelter screens
    updateBusShelters(this._busShelters, dt, elapsed);
  },

  /**
   * Set transition progress (0-1) for cross-era blending.
   * Called by the timeline controller during era transitions.
   */
  setTransitionProgress(p: number): void {
    // Fade based on transition progress
    const targetOpacity = p;
    for (const bb of this._billboards) {
      if (bb.screenMat && bb.screenMat.opacity !== undefined) {
        bb.screenMat.opacity = targetOpacity;
      }
    }
    for (const bs of this._busShelters) {
      if (bs.screenMat && bs.screenMat.opacity !== undefined) {
        bs.screenMat.opacity = targetOpacity;
      }
    }
  },

  /**
   * Dispose of all resources associated with this era.
   * Called when transitioning away from this era.
   */
  dispose(): void {
    // Dispose animated billboard canvases and textures
    for (const bb of this._billboards) {
      bb.texture.dispose();
      bb.canvas.remove?.();
    }
    this._billboards.length = 0;

    // Dispose bus shelter canvases and textures
    for (const bs of this._busShelters) {
      bs.texture.dispose();
      bs.canvas.remove?.();
    }
    this._busShelters.length = 0;

    // Dispose toolkit-generated resources
    const resources = (this as any)._eraResources as Array<{ dispose?: () => void }>;
    if (resources) {
      for (const r of resources) {
        if (r.dispose) r.dispose();
      }
      resources.length = 0;
    }
  },
};
