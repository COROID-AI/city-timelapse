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
  ironMaterial,
} from './_shared/paletteHelpers';

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
// Internal state
// ──────────────────────────────────────────────────────────────────────

let _transitionProgress = 0;
const _disposeTargets: Array<{ dispose(): void }> = [];
const _pedestrians: THREE.Group[] = [];
let _builtContent: {
  buildings: THREE.Group;
  vehicles: THREE.Group;
  signage: THREE.Group;
  pedestrians: THREE.Group;
  props: THREE.Group;
} | null = null;

// ──────────────────────────────────────────────────────────────────────
// Helper geometry constructors
// ──────────────────────────────────────────────────────────────────────

function mkBox(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

function mkCyl(rT: number, rB: number, h: number, seg: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, seg), mat);
}

// ══════════════════════════════════════════════════════════════════════
// CANVAS TEXTURE GENERATORS — graffiti tags & band posters
// ══════════════════════════════════════════════════════════════════════

/** Generate a canvas texture with graffiti-style spray-paint tag */
function makeGraffitiTagTexture(color: number = 0xFF3366, style: 'tag' | 'throw_up' | 'piece' = 'tag'): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  // Background patch (spray splatter)
  ctx.fillStyle = '#1A1A1A';
  ctx.fillRect(0, 0, 256, 128);
  const col = '#' + new THREE.Color(color).getHexString();
  // Spray-paint drips
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 128;
    const r = Math.random() * 8 + 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
  }
  // Tag lettering (stylized graffiti text)
  ctx.globalAlpha = 0.9;
  ctx.font = style === 'piece' ? 'bold 36px Arial' : style === 'throw_up' ? 'bold 28px Arial' : 'italic bold 22px Arial';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  const tags = ['VEX', 'SKZ', 'NXR', 'TKO', 'ACE', 'PHX', 'DZN', 'RYZ'];
  ctx.strokeText(tags[Math.abs(Math.floor(Math.random() * tags.length))], 30, 80);
  ctx.fillStyle = col;
  ctx.fillText(tags[Math.abs(Math.floor(Math.random() * tags.length))], 30, 80);
  // Drip lines
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.6;
  for (let d = 0; d < 5; d++) {
    const dx = 40 + Math.random() * 180;
    ctx.beginPath();
    ctx.moveTo(dx, 70);
    ctx.lineTo(dx + (Math.random() - 0.5) * 4, 110 + Math.random() * 20);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return c;
}

/** Generate a canvas texture with punk/new-wave band poster */
function makeBandPosterTexture(bandName: string, year: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 384;
  const ctx = c.getContext('2d')!;
  // Background — high contrast halftone or solid bold color
  const bgColors = ['#CC0000', '#111111', '#FF6600', '#003366', '#220022'];
  ctx.fillStyle = bgColors[Math.floor(Math.random() * bgColors.length)];
  ctx.fillRect(0, 0, 256, 384);
  // Halftone dots overlay
  ctx.globalAlpha = 0.15;
  for (let y = 0; y < 384; y += 4) {
    for (let x = 0; x < 256; x += 4) {
      if ((x + y) % 8 === 0) {
        ctx.fillStyle = '#FFF';
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }
  ctx.globalAlpha = 1;
  // Band name in bold distressed font
  ctx.font = 'bold 42px Arial Black, Arial';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 4;
  ctx.strokeText(bandName.toUpperCase(), 10, 100);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(bandName.toUpperCase(), 10, 100);
  // Subtitle
  ctx.font = 'bold 18px Arial';
  ctx.fillStyle = '#FFFF00';
  ctx.fillText('LIVE AT THE ROXY', 20, 140);
  // Date
  ctx.font = '14px Courier New';
  ctx.fillStyle = '#CCCCCC';
  ctx.fillText(`${year}`, 20, 170);
  // Decorative elements — geometric shapes (punk aesthetic)
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = '#FFF';
  ctx.lineWidth = 2;
  for (let s = 0; s < 3; s++) {
    ctx.strokeRect(20 + s * 80, 200 + s * 30, 60, 60);
  }
  ctx.globalAlpha = 1;
  // "TICKETS" bar at bottom
  ctx.fillStyle = '#FFFF00';
  ctx.fillRect(0, 330, 256, 54);
  ctx.fillStyle = '#000';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center' as CanvasTextAlign;
  ctx.fillText('TICKETS FROM $8', 128, 365);
  ctx.textAlign = 'start' as CanvasTextAlign;
  return c;
}

/** Generate a graffiti texture specifically for dumpsters */
function makeDumpsterGraffitiTexture(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  // Dark green dumpster base
  ctx.fillStyle = '#1A3A1A';
  ctx.fillRect(0, 0, 256, 128);
  // Multiple overlapping tags
  const tagColors = ['#FF0044', '#00FF88', '#FFAA00', '#4488FF', '#FF00FF'];
  for (let t = 0; t < 4; t++) {
    const col = tagColors[t % tagColors.length];
    ctx.globalAlpha = 0.6 + Math.random() * 0.3;
    ctx.font = `bold ${14 + Math.floor(Math.random() * 14)}px Arial`;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    const names = ['VK', 'MX', 'DRP', 'NOFX'];
    const nx = 10 + t * 55 + Math.random() * 10;
    const ny = 25 + t * 22 + Math.random() * 10;
    ctx.strokeText(names[t % names.length], nx, ny);
    ctx.fillStyle = col;
    ctx.fillText(names[t % names.length], nx, ny);
  }
  // Rust stains
  ctx.globalAlpha = 0.2;
  for (let r = 0; r < 8; r++) {
    const rx = Math.random() * 256;
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.ellipse(rx, Math.random() * 128, Math.random() * 15 + 3, Math.random() * 30 + 10, Math.random(), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return c;
}

/** Generate a halftone billboard ad texture with fictional brand */
function makeHalftoneBillboard(adBrand: string, tagline: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  // Bold background
  const bgs = [
    ['#003366', '#0066CC'],
    ['#CC2200', '#FF4400'],
    ['#225500', '#44AA22'],
    ['#660066', '#AA44AA'],
  ];
  const pair = bgs[Math.floor(Math.random() * bgs.length)];
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, pair[0]);
  grad.addColorStop(1, pair[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);
  // Halftone dot pattern
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#FFF';
  const dotSpacing = 12;
  for (let y = 0; y < 512; y += dotSpacing) {
    for (let x = 0; x < 1024; x += dotSpacing) {
      const dist = Math.sqrt((x - 512) ** 2 + (y - 256) ** 2);
      const radius = 1 + (dist / 300);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // Brand name large
  ctx.font = 'bold 80px Arial Black, Arial';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 6;
  ctx.strokeText(adBrand.toUpperCase(), 80, 220);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(adBrand.toUpperCase(), 80, 220);
  // Tagline
  ctx.font = 'bold 32px Arial';
  ctx.fillStyle = '#FFFF88';
  ctx.fillText(tagline, 120, 280);
  // Decorative stripe
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 340, 1024, 8);
  // Small print
  ctx.font = '18px Arial';
  ctx.fillStyle = '#CCCCCC';
  ctx.fillText('© ' + (1980 + Math.floor(Math.random() * 10)), 80, 420);
  return c;
}

/** Generate a neon glow sign texture for storefronts */
function makeNeonSignTexture(text: string, color: number, bgColor: number = 0x111111): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#' + new THREE.Color(bgColor).getHexString();
  ctx.fillRect(0, 0, 512, 128);
  const colStr = '#' + new THREE.Color(color).getHexString();
  // Glow layers
  ctx.shadowColor = colStr;
  ctx.shadowBlur = 20;
  ctx.font = 'bold 64px Arial';
  ctx.fillStyle = colStr;
  ctx.textAlign = 'center' as CanvasTextAlign;
  ctx.fillText(text, 256, 80);
  ctx.shadowBlur = 40;
  ctx.fillText(text, 256, 80);
  ctx.shadowBlur = 0;
  ctx.textAlign = 'start' as CanvasTextAlign;
  return c;
}

// ══════════════════════════════════════════════════════════════════════
// BUILDERS
// ══════════════════════════════════════════════════════════════════════

// ── Buildings ────────────────────────────────────────────────────────

function buildBuildings(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'buildings_1985';
  const palette = getEraPalette();

  // Mix of weathered 1945 stock buildings and new 1980s insertions
  // The streetscape: left side has aged 1945-era stock, right side has modern 1980s office/commercial

  // ── Section A: Weathered 1945-era stock buildings (left side) ──

  // Building 1: 3-story brick walk-up, heavily weathered
  const w1 = generateBuilding({
    width: 7, depth: 6, floors: 3, floorHeight: 3,
    style: 'brick_classic', cornice: 'decorated', rooftop: 'flat',
    fireEscape: true, condition: 0.3,
    baseColor: 0x6B3A2A,
  });
  w1.group.position.set(-22, 0, 0);
  g.add(w1.group);
  _disposeTargets.push(w1);

  // Building 2: 4-story brick, worn
  const w2 = generateBuilding({
    width: 7, depth: 6, floors: 4, floorHeight: 3,
    style: 'brick_classic', cornice: 'simple', rooftop: 'flat',
    fireEscape: false, condition: 0.35,
    baseColor: 0x7A3A2A,
  });
  w2.group.position.set(-14, 0, 0);
  g.add(w2.group);
  _disposeTargets.push(w2);

  // Building 3: 5-story brick, some boarded windows
  const w3 = generateBuilding({
    width: 7, depth: 7, floors: 5, floorHeight: 3,
    style: 'brick_classic', cornice: 'elaborate', rooftop: 'water_tank',
    fireEscape: true, condition: 0.4,
    baseColor: 0x5A2A18,
  });
  w3.group.position.set(-6, 0, 0);
  g.add(w3.group);
  _disposeTargets.push(w3);

  // ── Demolished lot (surface parking lot area) ──
  const demoGroup = new THREE.Group();
  demoGroup.name = 'demolished_lot_surface_parking';
  const dirtMat = new THREE.MeshStandardMaterial({ color: 0x5A4A3A, roughness: 1.0 });
  const gravelMat = new THREE.MeshStandardMaterial({ color: 0x666660, roughness: 1.0 });
  // Gravel surface
  const gravel = mkBox(10, 0.05, 12, gravelMat);
  gravel.position.set(2, 0.025, 0);
  demoGroup.add(gravel);
  // Potholes with dirt fill
  for (let p = 0; p < 3; p++) {
    const hole = mkBox(0.8 + Math.random() * 0.5, 0.08, 0.6 + Math.random() * 0.4, dirtMat);
    hole.position.set(0 + Math.random() * 6, 0.04, -2 + Math.random() * 4);
    demoGroup.add(hole);
  }
  // Rubble from demolished building
  const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x776655, roughness: 1.0 });
  for (let r = 0; r < 15; r++) {
    const sz = 0.1 + Math.random() * 0.3;
    const chunk = mkBox(sz, sz * 0.4, sz * 0.6, rubbleMat);
    chunk.position.set(-1 + Math.random() * 4, sz * 0.2, -3 + Math.random() * 2);
    chunk.rotation.y = Math.random() * Math.PI;
    demoGroup.add(chunk);
  }
  // Partial remaining wall from demolished building
  const remainWall = mkBox(3, 2.5, 0.3, brickMaterial(0.3, palette));
  remainWall.position.set(0, 1.25, -3);
  demoGroup.add(remainWall);
  // Exposed rebar on remaining wall
  const rebarMat = ironMaterial(0.2, palette);
  for (let rb = 0; rb < 5; rb++) {
    const reb = mkCyl(0.015, 0.015, 0.4 + Math.random() * 0.3, 6, rebarMat);
    reb.position.set(-0.8 + rb * 0.4, 2.7 + Math.random() * 0.2, -3);
    reb.rotation.z = (Math.random() - 0.5) * 0.3;
    demoGroup.add(reb);
  }
  g.add(demoGroup);

  // ── Section B: New insertions (mid-block commercial) ──

  // Mirrored-glass office block (brown-brick base, smoked glass upper)
  const mirrorOffice = new THREE.Group();
  mirrorOffice.name = 'mirrored_glass_office_block';
  const brownBrickMat = new THREE.MeshStandardMaterial({ color: 0x5A3A2A, roughness: 0.85, metalness: 0.0 });
  const mirrorGlassMat = new THREE.MeshStandardMaterial({
    color: 0x334455, roughness: 0.05, metalness: 0.9,
    transparent: true, opacity: 0.7,
  });
  // Brown-brick podium (ground + first floor)
  const podium = mkBox(10, 6, 8, brownBrickMat);
  podium.position.set(8, 3, 0);
  mirrorOffice.add(podium);
  // Mirrored glass tower above
  const towerW = 8, towerH = 12, towerD = 6;
  const tower = mkBox(towerW, towerH, towerD, mirrorGlassMat);
  tower.position.set(8, 6 + towerH / 2, 0);
  mirrorOffice.add(tower);
  // Vertical mullions on glass facade
  const mullionMat = ironMaterial(0.7, palette);
  for (let m = 0; m < 5; m++) {
    const mx = 8 - 3.5 + m * 1.75;
    const mullion = mkBox(0.06, towerH, 0.06, mullionMat);
    mullion.position.set(mx, 6 + towerH / 2, towerD / 2 + 0.01);
    mirrorOffice.add(mullion);
  }
  // Horizontal spandrel bands between floors
  const spandrelMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, metalness: 0.3 });
  for (let f = 0; f < 4; f++) {
    const band = mkBox(towerW + 0.1, 0.15, towerD + 0.1, spandrelMat);
    band.position.set(8, 6 + 3 + f * 3, 0);
    mirrorOffice.add(band);
  }
  // Smoked windows — dark horizontal strips on glass
  const smokedWindowMat = new THREE.MeshStandardMaterial({
    color: 0x1A2A3A, roughness: 0.1, metalness: 0.7,
    transparent: true, opacity: 0.85,
  });
  for (let wf = 0; wf < 4; wf++) {
    const strip = mkBox(towerW - 0.2, 1.8, 0.02, smokedWindowMat);
    strip.position.set(8, 7.5 + wf * 3, towerD / 2 + 0.03);
    mirrorOffice.add(strip);
  }
  // Roof parapet
  const parapet = mkBox(towerW + 0.4, 0.8, towerD + 0.4, brownBrickMat);
  parapet.position.set(8, 6 + towerH + 0.4, 0);
  mirrorOffice.add(parapet);
  g.add(mirrorOffice);

  // ── Section C: 1980s commercial storefronts ──

  // Video rental store
  const videoStore = new THREE.Group();
  videoStore.name = 'video_rental_store';
  const videoFacade = generateBuilding({
    width: 8, depth: 5, floors: 2, floorHeight: 3.5,
    style: 'post_war', cornice: 'none', rooftop: 'flat',
    fireEscape: false, condition: 0.7,
    baseColor: 0xCCBBAA,
  });
  videoFacade.group.position.set(16, 0, 0);
  videoStore.add(videoFacade.group);
  _disposeTargets.push(videoFacade);
  // Storefront awning
  const vAwning = generateStorefront({
    width: 7, height: 3.5, depth: 0.5, windowRatio: 0.6,
    doorType: 'single', kickPanel: 'tile', awning: 'marquee',
    hangingSign: true, condition: 0.7, accentColor: 0xFF4400,
  });
  vAwning.group.position.set(16, 0, 3.5);
  videoStore.add(vAwning.group);
  _disposeTargets.push(vAwning);
  // Neon VHS sign — canvas-generated
  const vhsCanvas = makeNeonSignTexture('VHS RENTALS', 0xFF4400);
  const vhsTex = new THREE.CanvasTexture(vhsCanvas);
  const vhsSignMat = new THREE.MeshBasicMaterial({ map: vhsTex, transparent: true });
  const vhsSign = mkBox(3, 0.8, 0.05, vhsSignMat);
  vhsSign.position.set(16, 5.5, 4.5);
  videoStore.add(vhsSign);
  // VHS-shaped neon outline decoration
  const vhsOutlineMat = new THREE.MeshStandardMaterial({
    color: 0xFF6600, emissive: 0xFF4400, emissiveIntensity: 0.8,
    roughness: 0.3,
  });
  // VHS tape shape: rectangle with two circles
  const vhsBody = mkBox(0.6, 0.4, 0.03, vhsOutlineMat);
  vhsBody.position.set(14.5, 5.5, 4.5);
  videoStore.add(vhsBody);
  for (const cx of [-0.15, 0.15]) {
    const reel = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.1, 12), vhsOutlineMat);
    reel.position.set(14.5 + cx, 5.5, 4.52);
    videoStore.add(reel);
  }
  // Movie poster display cases in windows
  const posterColors = [0xFF4400, 0x0044FF, 0x00AA44, 0xFFAA00];
  for (let mp = 0; mp < 4; mp++) {
    const pc = posterColors[mp];
    const posterTex = makeNeonSignTexture(['ACTION', 'THRILLER', 'COMEDY', 'SCIFI'][mp], pc);
    const posterMesh = mkBox(0.8, 1.2, 0.02, new THREE.MeshStandardMaterial({
      map: new THREE.CanvasTexture(posterTex), emissive: pc, emissiveIntensity: 0.15,
    }));
    posterMesh.position.set(14 + mp * 1.2, 1.5, 3.7);
    videoStore.add(posterMesh);
  }
  g.add(videoStore);

  // Arcade with glowing marquee
  const arcade = new THREE.Group();
  arcade.name = 'arcade';
  const arcadeFacade = generateBuilding({
    width: 8, depth: 5, floors: 2, floorHeight: 3.5,
    style: 'post_war', cornice: 'none', rooftop: 'flat',
    fireEscape: false, condition: 0.65,
    baseColor: 0x888888,
  });
  arcadeFacade.group.position.set(24, 0, 0);
  arcade.add(arcadeFacade.group);
  _disposeTargets.push(arcadeFacade);
  // Glowing marquee sign — bright colorful neon
  const marqueeCanvas = makeNeonSignTexture('★ ARCADE ★', 0xFFFF00);
  const marqueeTex = new THREE.CanvasTexture(marqueeCanvas);
  const marqueeMat = new THREE.MeshStandardMaterial({
    map: marqueeTex, emissive: 0xFFFF00, emissiveIntensity: 1.0,
    transparent: true,
  });
  const marquee = mkBox(5, 1.2, 0.15, marqueeMat);
  marquee.position.set(24, 5.5, 4.5);
  arcade.add(marquee);
  // Marquee light bulbs around border
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xFF6600, emissive: 0xFF4400, emissiveIntensity: 1.5,
  });
  const bulbGeo = new THREE.SphereGeometry(0.06, 6, 6);
  for (let bi = 0; bi < 10; bi++) {
    const bx = 21.5 + bi * 0.5;
    const topBulb = new THREE.Mesh(bulbGeo, bulbMat);
    topBulb.position.set(bx, 6.15, 4.58);
    arcade.add(topBulb);
    const botBulb = new THREE.Mesh(bulbGeo, bulbMat);
    botBulb.position.set(bx, 4.85, 4.58);
    arcade.add(botBulb);
  }
  // Attract-mode screen glow inside window
  const screenGlowMat = new THREE.MeshBasicMaterial({
    color: 0x00FF44, transparent: true, opacity: 0.3,
  });
  const screenGlow = mkBox(3, 2, 0.02, screenGlowMat);
  screenGlow.position.set(24, 1.8, 3.7);
  arcade.add(screenGlow);
  // Pixel-art style attract mode graphic on screen
  const attractCanvas = document.createElement('canvas');
  attractCanvas.width = 128;
  attractCanvas.height = 64;
  const actx = attractCanvas.getContext('2d')!;
  actx.fillStyle = '#001100';
  actx.fillRect(0, 0, 128, 64);
  // Simple pixel art character
  actx.fillStyle = '#00FF44';
  for (let px = 0; px < 8; px++) {
    actx.fillRect(50 + px * 3, 20 + Math.sin(px) * 10, 3, 3);
  }
  actx.fillStyle = '#FF0000';
  actx.fillRect(80, 15, 8, 8);
  // "INSERT COIN" text
  actx.fillStyle = '#FFFF00';
  actx.font = 'bold 10px monospace';
  actx.fillText('INSERT COIN', 30, 50);
  const attractTex = new THREE.CanvasTexture(attractCanvas);
  const attractScreen = mkBox(2.8, 1.5, 0.03, new THREE.MeshStandardMaterial({
    map: attractTex, emissive: 0x00FF44, emissiveIntensity: 0.5,
  }));
  attractScreen.position.set(24, 1.8, 3.72);
  arcade.add(attractScreen);
  g.add(arcade);

  // Punk/New-Wave record shop
  const recordShop = new THREE.Group();
  recordShop.name = 'record_shop';
  const recordFacade = generateBuilding({
    width: 8, depth: 5, floors: 2, floorHeight: 3.5,
    style: 'post_war', cornice: 'none', rooftop: 'flat',
    fireEscape: false, condition: 0.55,
    baseColor: 0x665544,
  });
  recordFacade.group.position.set(32, 0, 0);
  recordShop.add(recordFacade.group);
  _disposeTargets.push(recordFacade);
  // Storefront with display window full of records
  const recStorefront = generateStorefront({
    width: 7, height: 3.5, depth: 0.5, windowRatio: 0.7,
    doorType: 'single', kickPanel: 'metal', awning: false,
    hangingSign: true, signText: 'RECORDS', condition: 0.6, accentColor: 0x6644AA,
  });
  recStorefront.group.position.set(32, 0, 3.5);
  recordShop.add(recStorefront.group);
  _disposeTargets.push(recStorefront);
  // Neon glow sign
  const recNeonCanvas = makeNeonSignTexture('RECORDS', 0xAA44FF);
  const recNeonTex = new THREE.CanvasTexture(recNeonCanvas);
  const recNeonMat = new THREE.MeshStandardMaterial({
    map: recNeonTex, emissive: 0xAA44FF, emissiveIntensity: 0.8,
    transparent: true,
  });
  const recNeonSign = mkBox(3, 0.6, 0.05, recNeonMat);
  recNeonSign.position.set(32, 5.2, 4.5);
  recordShop.add(recNeonSign);
  // Band posters on exterior wall (canvas-generated textures)
  const bandNames = ['DEAD ZONE', 'NEON FURY', 'VOID CHILDREN', 'CHROME HEART'];
  const bandYears = [1982, 1984, 1985, 1983];
  for (let bp = 0; bp < 4; bp++) {
    const posterCanvas = makeBandPosterTexture(bandNames[bp], bandYears[bp]);
    const posterTex = new THREE.CanvasTexture(posterCanvas);
    const posterMat = new THREE.MeshStandardMaterial({ map: posterTex });
    const posterMesh = mkBox(1.2, 1.8, 0.02, posterMat);
    posterMesh.position.set(35.5 + bp * 1.5, 2.5, 3.7);
    recordShop.add(posterMesh);
  }
  // Wheatpaste posters on adjacent wall (slightly torn edges)
  const wheatpasteCanvas = document.createElement('canvas');
  wheatpasteCanvas.width = 128;
  wheatpasteCanvas.height = 192;
  const wctx = wheatpasteCanvas.getContext('2d')!;
  wctx.fillStyle = '#DDCCAA';
  wctx.fillRect(0, 0, 128, 192);
  // Torn edge effect
  wctx.fillStyle = '#AA8866';
  for (let te = 0; te < 20; te++) {
    wctx.fillRect(Math.random() * 128, Math.random() * 192, Math.random() * 8 + 1, Math.random() * 4 + 1);
  }
  wctx.fillStyle = '#222';
  wctx.font = 'bold 20px Arial';
  wctx.fillText('ANARCHY', 15, 60);
  wctx.fillText('NOW', 25, 90);
  const wpTex = new THREE.CanvasTexture(wheatpasteCanvas);
  const wpMat = new THREE.MeshStandardMaterial({ map: wpTex, roughness: 0.9 });
  const wheatpaste = mkBox(1.0, 1.5, 0.01, wpMat);
  wheatpaste.position.set(39.5, 2.5, 3.7);
  wheatpaste.rotation.y = -0.1;
  recordShop.add(wheatpaste);
  g.add(recordShop);

  // ── Section D: Additional 1945 stock buildings (right end, further decayed) ──
  const w4 = generateBuilding({
    width: 7, depth: 6, floors: 3, floorHeight: 3,
    style: 'brick_classic', cornice: 'simple', rooftop: 'flat',
    fireEscape: true, condition: 0.25,
    baseColor: 0x4A2A18,
  });
  w4.group.position.set(39, 0, 0);
  g.add(w4.group);
  _disposeTargets.push(w4);

  // ── Apply graffiti and grime overlays on 1945 stock buildings ──

  // Graffiti on weathered brick walls
  const graffitiColors = [0xFF3366, 0x33FF66, 0x3366FF, 0xFFAA33, 0xFF33FF];
  const graffitiPositions = [
    { x: -22, z: 3.06, y: 2 },
    { x: -14, z: 3.06, y: 3 },
    { x: -6, z: 3.06, y: 4 },
    { x: -22, z: -3.06, y: 1.5 },
    { x: 39, z: 3.06, y: 2 },
  ];
  for (const gp of graffitiPositions) {
    const gc = graffitiColors[Math.floor(Math.random() * graffitiColors.length)];
    const tagCanvas = makeGraffitiTagTexture(gc, Math.random() > 0.5 ? 'throw_up' : 'tag');
    const tagTex = new THREE.CanvasTexture(tagCanvas);
    const tagMat = new THREE.MeshStandardMaterial({ map: tagTex, transparent: true, roughness: 0.9 });
    const tagPlane = mkBox(2, 1, 0.02, tagMat);
    tagPlane.position.set(gp.x, gp.y, gp.z);
    g.add(tagPlane);
  }

  // Soot/grime staining on lower portions of old buildings
  const grimeMat = new THREE.MeshBasicMaterial({
    color: 0x2D2520, transparent: true, opacity: 0.35, depthWrite: false,
  });
  for (const gx of [-22, -14, -6, 39]) {
    const grimeStrip = mkBox(7, 1.5, 0.03, grimeMat);
    grimeStrip.position.set(gx, 0.75, 3.06);
    g.add(grimeStrip);
  }

  return g;
}

// ── Vehicles ────────────────────────────────────────────────────────

function buildVehicles(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'vehicles_1985';
  const palette = getEraPalette();

  // ── Boxy angular sedans (typical 1980s American/Japanese) ──
  const sedanPositions = [
    { x: -18, z: 5.5, rotY: 0 },
    { x: -10, z: 5.5, rotY: 0 },
    { x: 12, z: 5.5, rotY: 0 },
    { x: 20, z: 5.5, rotY: 0 },
  ];
  for (const pos of sedanPositions) {
    const result = generateVehicle({
      type: 'sedan',
      scale: 1,
      paintColor: [0x222222, 0x884444, 0x334466, 0xAAAAAA][sedanPositions.indexOf(pos)],
      chromeColor: palette.chromeAccent,
      wheelStyle: 'spoke',
      bumperStyle: 'chrome_bar',
      headlightStyle: 'rectangular',
      taillightStyle: 'rectangular',
      condition: 0.5 + Math.random() * 0.3,
    });
    result.group.position.set(pos.x, 0, pos.z);
    result.group.rotation.y = pos.rotY;
    g.add(result.group);
    _disposeTargets.push(result);
  }

  // ── Wagons (boxy 1980s station wagons) ──
  const wagonResult = generateVehicle({
    type: 'van',
    scale: 1.05,
    paintColor: 0x445544,
    chromeColor: palette.chromeAccent,
    wheelStyle: 'spoke',
    bumperStyle: 'heavy',
    headlightStyle: 'rectangular',
    taillightStyle: 'vertical_strip',
    condition: 0.6,
  });
  wagonResult.group.position.set(-4, 0, 5.5);
  wagonResult.group.rotation.y = 0;
  g.add(wagonResult.group);
  _disposeTargets.push(wagonResult);

  // ── Hatchback (subcompact, very 1980s) ──
  const hatchResult = generateVehicle({
    type: 'car',
    scale: 0.85,
    paintColor: 0xDD6644,
    chromeColor: palette.chromeAccent,
    wheelStyle: 'simple',
    bumperStyle: 'minimal',
    headlightStyle: 'rectangular',
    taillightStyle: 'round',
    condition: 0.7,
  });
  hatchResult.group.position.set(28, 0, 5.5);
  hatchResult.group.rotation.y = 0;
  g.add(hatchResult.group);
  _disposeTargets.push(hatchResult);

  // ── Delivery van ──
  const deliveryResult = generateVehicle({
    type: 'van',
    scale: 1.1,
    paintColor: 0xF5F5DC,
    chromeColor: palette.chromeAccent,
    wheelStyle: 'heavy_duty',
    bumperStyle: 'heavy',
    headlightStyle: 'rectangular',
    taillightStyle: 'vertical_strip',
    condition: 0.55,
  });
  deliveryResult.group.position.set(35, 0, 5.5);
  deliveryResult.group.rotation.y = 0;
  g.add(deliveryResult.group);
  _disposeTargets.push(deliveryResult);
  // Fictional delivery company logo on van side (canvas)
  const delCanvas = document.createElement('canvas');
  delCanvas.width = 256;
  delCanvas.height = 64;
  const dctx = delCanvas.getContext('2d')!;
  dctx.fillStyle = '#F5F5DC';
  dctx.fillRect(0, 0, 256, 64);
  dctx.fillStyle = '#CC3300';
  dctx.fillRect(0, 0, 256, 8);
  dctx.fillRect(0, 56, 256, 8);
  dctx.fillStyle = '#333';
  dctx.font = 'bold 22px Arial';
  dctx.fillText('QUICK DELIVERY', 20, 42);
  const delTex = new THREE.CanvasTexture(delCanvas);
  const delMat = new THREE.MeshStandardMaterial({ map: delTex });
  const delLogo = mkBox(2.5, 0.6, 0.02, delMat);
  delLogo.position.set(35, 1.2, 6.35);
  g.add(delLogo);
  const delLogoR = delLogo.clone();
  delLogoR.position.z = 4.65;
  g.add(delLogoR);

  // ── Graffiti-tagged panel truck ──
  const panelResult = generateVehicle({
    type: 'truck',
    scale: 1.0,
    paintColor: 0x555555,
    chromeColor: palette.chromeAccent,
    wheelStyle: 'heavy_duty',
    bumperStyle: 'heavy',
    headlightStyle: 'rectangular',
    taillightStyle: 'vertical_strip',
    condition: 0.4,
  });
  panelResult.group.position.set(30, 0, -2);
  panelResult.group.rotation.y = Math.PI / 2;
  g.add(panelResult.group);
  _disposeTargets.push(panelResult);
  // Graffiti tags on panel truck sides (canvas-generated)
  const panelGraffitiCanvas = makeGraffitiTagTexture(0xFF0044, 'piece');
  const panelGraffTex = new THREE.CanvasTexture(panelGraffitiCanvas);
  const panelGraffMat = new THREE.MeshStandardMaterial({ map: panelGraffTex, transparent: true });
  const panelGraff = mkBox(2.5, 1.5, 0.02, panelGraffMat);
  panelGraff.position.set(30, 1.5, -1.0);
  g.add(panelGraff);
  const panelGraffR = panelGraff.clone();
  panelGraffR.position.z = -3.0;
  panelGraffR.rotation.y = Math.PI;
  g.add(panelGraffR);

  // ── Checker-style taxi with checker stripe pattern ──
  const taxiResult = generateVehicle({
    type: 'taxi',
    scale: 1,
    paintColor: 0xCCCC00, // classic yellow
    chromeColor: palette.chromeAccent,
    wheelStyle: 'spoke',
    bumperStyle: 'chrome_bar',
    headlightStyle: 'round',
    taillightStyle: 'round',
    condition: 0.5,
  });
  taxiResult.group.position.set(6, 0, 5.5);
  taxiResult.group.rotation.y = 0;
  g.add(taxiResult.group);
  _disposeTargets.push(taxiResult);
  // Checker stripe pattern along side (canvas-generated)
  const checkerCanvas = document.createElement('canvas');
  checkerCanvas.width = 256;
  checkerCanvas.height = 16;
  const cctx = checkerCanvas.getContext('2d')!;
  const sqSize = 8;
  for (let cy = 0; cy < 2; cy++) {
    for (let cx = 0; cx < 256 / sqSize; cx++) {
      cctx.fillStyle = (cx + cy) % 2 === 0 ? '#000000' : '#FFFFFF';
      cctx.fillRect(cx * sqSize, cy * sqSize, sqSize, sqSize);
    }
  }
  const checkerTex = new THREE.CanvasTexture(checkerCanvas);
  const checkerMat = new THREE.MeshStandardMaterial({ map: checkerTex });
  const checkerStripe = mkBox(3.2, 0.12, 0.02, checkerMat);
  checkerStripe.position.set(6, 0.75, 1.01);
  g.add(checkerStripe);
  const checkerStripeR = checkerStripe.clone();
  checkerStripeR.position.z = -1.01;
  g.add(checkerStripeR);
  // Taxi roof light
  const taxiLightMat = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF, emissive: 0xFFFF00, emissiveIntensity: 0.6,
    transparent: true, opacity: 0.8,
  });
  const taxiLight = mkBox(0.6, 0.15, 0.3, taxiLightMat);
  taxiLight.position.set(6, 1.5, 0);
  g.add(taxiLight);

  // ── Cars parked in surface parking lot ──
  const lotCarPositions = [
    { x: 0, z: -2, rotY: Math.PI / 2 },
    { x: 4, z: -2, rotY: Math.PI / 2 },
    { x: 8, z: -2, rotY: Math.PI / 2 },
  ];
  for (const lc of lotCarPositions) {
    const lotResult = generateVehicle({
      type: 'sedan',
      scale: 0.95,
      paintColor: [0x445566, 0x886644, 0x554466][lotCarPositions.indexOf(lc)],
      chromeColor: palette.chromeAccent,
      wheelStyle: 'spoke',
      bumperStyle: 'chrome_bar',
      headlightStyle: 'rectangular',
      taillightStyle: 'rectangular',
      condition: 0.4 + Math.random() * 0.2,
    });
    lotResult.group.position.set(lc.x, 0, lc.z);
    lotResult.group.rotation.y = lc.rotY;
    g.add(lotResult.group);
    _disposeTargets.push(lotResult);
  }

  return g;
}

// ── Signage & Wall Ads ──────────────────────────────────────────────

function buildSignage(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'signage_1985';

  // ── Halftone billboard ads (fictional brands) ──
  const billboards = [
    { brand: 'ZAP COLA', tagline: 'ENERGY FOR THE EIGHTIES!', x: -18, y: 8 },
    { brand: 'PIXEL PIZZA', tagline: 'NEW YORK STYLE • OPEN LATE', x: -10, y: 7 },
    { brand: 'STARLINE MOTORS', tagline: 'AMERICA DRIVES STARLINE', x: 35, y: 9 },
  ];
  for (const bb of billboards) {
    const billboardGroup = new THREE.Group();
    billboardGroup.name = `billboard_${bb.brand.replace(/\s/g, '_')}`;
    // Support structure
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7, metalness: 0.5 });
    for (const side of [-1, 1]) {
      const pole = mkBox(0.2, 7, 0.2, poleMat);
      pole.position.set(side * 5, 3.5, 0);
      billboardGroup.add(pole);
    }
    const beam = mkBox(10.5, 0.2, 0.2, poleMat);
    beam.position.y = 7;
    billboardGroup.add(beam);
    // Cross braces
    for (const side of [-1, 1]) {
      const brace = mkCyl(0.04, 0.04, 7, 6, poleMat);
      brace.rotation.z = side * 0.3;
      brace.position.set(side * 2.5, 3.5, 0);
      billboardGroup.add(brace);
    }
    // Billboard board with halftone texture
    const bbCanvas = makeHalftoneBillboard(bb.brand, bb.tagline);
    const bbTex = new THREE.CanvasTexture(bbCanvas);
    const bbBoardMat = new THREE.MeshStandardMaterial({ map: bbTex });
    const bbBoard = mkBox(10, 4, 0.3, bbBoardMat);
    bbBoard.position.y = 4;
    billboardGroup.add(bbBoard);
    billboardGroup.position.set(bb.x, 0, 3.5);
    g.add(billboardGroup);
  }

  // ── Neon glow signs on storefronts ──

  // Video store neon open sign
  const openCanvas = makeNeonSignTexture('OPEN', 0x00FF44);
  const openTex = new THREE.CanvasTexture(openCanvas);
  const openMat = new THREE.MeshStandardMaterial({
    map: openTex, emissive: 0x00FF44, emissiveIntensity: 1.0,
    transparent: true,
  });
  const openSign = mkBox(1.5, 0.5, 0.04, openMat);
  openSign.position.set(14.5, 4.5, 4.5);
  g.add(openSign);

  // Arcade "NOW PLAYING" sign
  const npCanvas = makeNeonSignTexture('NOW PLAYING', 0xFF44FF);
  const npTex = new THREE.CanvasTexture(npCanvas);
  const npMat = new THREE.MeshStandardMaterial({
    map: npTex, emissive: 0xFF44FF, emissiveIntensity: 0.8,
    transparent: true,
  });
  const npSign = mkBox(2, 0.5, 0.04, npMat);
  npSign.position.set(25.5, 4.2, 4.5);
  g.add(npSign);

  // Record shop neon sign
  const rsCanvas = makeNeonSignTexture('NEW ARRIVALS', 0xFFAA00);
  const rsTex = new THREE.CanvasTexture(rsCanvas);
  const rsMat = new THREE.MeshStandardMaterial({
    map: rsTex, emissive: 0xFFAA00, emissiveIntensity: 0.7,
    transparent: true,
  });
  const rsSign = mkBox(2, 0.5, 0.04, rsMat);
  rsSign.position.set(33.5, 4.2, 4.5);
  g.add(rsSign);

  // ── Hanging signs ──

  // Video store hanging sign
  const vhSign = generateSignage({
    width: 1.5, height: 1.5, depth: 0.15,
    text: 'VIDEO', fontSize: 0.35,
    textColor: 0xFFFFFF, bgColor: 0x111111,
    ornament: 'simple',
  });
  vhSign.group.position.set(16, 4.5, 4.0);
  g.add(vhSign.group);
  _disposeTargets.push(vhSign);

  // Arcade hanging sign
  const arSign = generateSignage({
    width: 1.5, height: 1.5, depth: 0.15,
    text: 'GAME', fontSize: 0.35,
    textColor: 0xFFFF00, bgColor: 0x111111,
    ornament: 'art_deco',
  });
  arSign.group.position.set(24, 4.5, 4.0);
  g.add(arSign.group);
  _disposeTargets.push(arSign);

  // ── Painted-wall ads on older buildings ──

  // Faded 1940s advertisement still visible under 80s grime
  const fadedAd = generateSignage({
    width: 5, height: 2, depth: 0.05,
    text: 'VICTORY\\nBREAD', fontSize: 0.3,
    textColor: 0xDDCCBB, bgColor: 0x553322,
    condition: 0.2, ornament: 'simple',
  });
  fadedAd.group.position.set(-22, 5, 3.06);
  g.add(fadedAd.group);
  _disposeTargets.push(fadedAd);

  // 1980s-style painted wall ad on back wall
  const eightiesAd = generateSignage({
    width: 6, height: 3, depth: 0.05,
    text: 'DISCO\\nFEVER', fontSize: 0.35,
    textColor: 0xFF66FF, bgColor: 0x220033,
    condition: 0.4, ornament: 'art_deco',
  });
  eightiesAd.group.position.set(-6, 6, 3.06);
  g.add(eightiesAd.group);
  _disposeTargets.push(eightiesAd);

  return g;
}

// ── Pedestrians ─────────────────────────────────────────────────────

function buildPedestrians(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'pedestrians_1985';
  const palette = getEraPalette();

  // Define 1980s pedestrian positions and outfit configs
  // Using available outfit types but customizing via accessories and palette overrides
  const pedDefs: Array<{
    x: number; z: number; outfit: PedestrianParams['outfit'];
    hatStyle?: PedestrianParams['hatStyle'];
    accessories?: PedestrianParams['accessories'];
    skinTone?: number;
    paletteOverride?: Record<string, number>;
  }> = [
    // Teenager in acid-wash jeans and Members-Only-style jacket (casual_jeans with pink/red top)
    { x: -20, z: 4.0, outfit: 'casual_jeans', hatStyle: false, accessories: [],
      paletteOverride: { top: 0xDD8844, bottom: 0x8899BB } },
    // Person in full tracksuit (worker outfit with bright colors)
    { x: -14, z: 4.0, outfit: 'worker', hatStyle: false, accessories: [],
      paletteOverride: { top: 0x4444AA, bottom: 0x4444AA, accent: 0xFFFF00 } },
    // Business person in blazer with rolled sleeves (business_suit with casual feel)
    { x: -8, z: 4.0, outfit: 'business_suit', hatStyle: false, accessories: ['briefcase'],
      paletteOverride: { top: 0x333344, bottom: 0x222233 } },
    // Punk with spiked hair aesthetic (street_urban with aggressive colors)
    { x: -2, z: 4.0, outfit: 'street_urban', hatStyle: false, accessories: [],
      paletteOverride: { top: 0x111111, bottom: 0x111111, accent: 0xFF0000 } },
    // Pop music fan with boombox (can use casual_jeans)
    { x: 4, z: 4.0, outfit: 'casual_jeans', hatStyle: false, accessories: ['bag'],
      paletteOverride: { top: 0xFF4444, bottom: 0x99AACC } },
    // Person with Walkman headphones (vintage_formal adapted)
    { x: 10, z: 4.0, outfit: 'vintage_formal', hatStyle: false, accessories: ['camera'],
      paletteOverride: { top: 0x664422, bottom: 0x443322, accent: 0x00CCFF } },
    // Skater kid
    { x: 16, z: 4.0, outfit: 'school_child', hatStyle: false, accessories: [],
      paletteOverride: { top: 0x22AA44, bottom: 0x445566, accent: 0xFF6600 } },
    // New wave musician (downtown_evening with neon accents)
    { x: 22, z: 4.0, outfit: 'downtown_evening', hatStyle: false, accessories: [],
      paletteOverride: { top: 0x220022, bottom: 0x111111, accent: 0x00FFFF } },
    // Tourist in bright 80s colors
    { x: 28, z: 4.0, outfit: 'casual_jeans', hatStyle: 'cap', accessories: ['bag'],
      paletteOverride: { top: 0x00AA88, bottom: 0x556677 } },
    // Two more pedestrians
    { x: 34, z: 4.0, outfit: 'street_urban', hatStyle: false, accessories: ['phone'],
      paletteOverride: { top: 0x884488, bottom: 0x333333 } },
    { x: 38, z: 4.0, outfit: 'worker', hatStyle: 'cap', accessories: [],
      paletteOverride: { top: 0x556655, bottom: 0x444444 } },
  ];

  for (const pd of pedDefs) {
    const result = generatePedestrian({
      outfit: pd.outfit,
      heightScale: 0.85 + Math.random() * 0.2,
      hatStyle: pd.hatStyle,
      accessories: pd.accessories,
      animated: false,
      condition: 0.6 + Math.random() * 0.3,
      skinTone: pd.skinTone,
      palette: pd.paletteOverride,
    });
    result.group.position.set(pd.x, 0, pd.z);
    result.group.rotation.y = Math.random() > 0.5 ? 0 : Math.PI;
    g.add(result.group);
    _pedestrians.push(result.group);
    _disposeTargets.push(result);
  }

  // ── Add boombox accessory (canvas-generated detail) ──
  // Boombox on shoulder of pedestrian at x=4
  const boomboxGroup = new THREE.Group();
  boomboxGroup.name = 'boombox_accessory';
  const boomboxMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.3 });
  // Main body
  const bbBody = mkBox(0.4, 0.25, 0.15, boomboxMat);
  bbBody.position.set(0, 0, 0);
  boomboxGroup.add(bbBody);
  // Speakers (two circles)
  const speakerMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
  for (const sx of [-0.12, 0.12]) {
    const speaker = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 12), speakerMat);
    speaker.rotation.x = Math.PI / 2;
    speaker.position.set(sx, 0, 0.08);
    boomboxGroup.add(speaker);
  }
  // Handle on top
  const handleMat = ironMaterial(0.7, palette);
  const handle = mkCyl(0.015, 0.015, 0.3, 6, handleMat);
  handle.position.set(0, 0.15, 0);
  boomboxGroup.add(handle);
  // Tape deck slot
  const tapeSlot = mkBox(0.2, 0.03, 0.01, new THREE.MeshStandardMaterial({ color: 0x444444 }));
  tapeSlot.position.set(0, 0.05, 0.08);
  boomboxGroup.add(tapeSlot);
  // Position near pedestrian
  boomboxGroup.position.set(4, 1.3, 4.0);
  g.add(boomboxGroup);

  // ── Add skateboard on ground near skater ──
  const skateboardGroup = new THREE.Group();
  skateboardGroup.name = 'skateboard';
  const deckMat = new THREE.MeshStandardMaterial({ color: 0xCC8844, roughness: 0.8 });
  // Board deck
  const deck = mkBox(0.2, 0.04, 0.6, deckMat);
  skateboardGroup.add(deck);
  // Grip tape (dark top)
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1.0 });
  const grip = mkBox(0.18, 0.01, 0.55, gripMat);
  grip.position.y = 0.025;
  skateboardGroup.add(grip);
  // Wheels
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0xEEEEEE, roughness: 0.4 });
  const wheelGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.02, 8);
  for (const wx of [-0.07, 0.07]) {
    for (const wz of [-0.22, 0.22]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, -0.03, wz);
      skateboardGroup.add(wheel);
    }
  }
  skateboardGroup.position.set(16, 0.02, 3.5);
  skateboardGroup.rotation.y = Math.PI / 4;
  g.add(skateboardGroup);

  // ── Add Walkman headphone wire detail ──
  // Thin wire from ear to device for pedestrian at x=10
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
  const wire = mkCyl(0.005, 0.005, 0.3, 4, wireMat);
  wire.position.set(10, 1.1, 4.05);
  wire.rotation.z = 0.2;
  g.add(wire);

  return g;
}

// ── Props ───────────────────────────────────────────────────────────

function buildProps(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'props_1985';
  const palette = getEraPalette();

  // ── Payphone bank (iconic 1980s street furniture) ──
  const payphoneBank = new THREE.Group();
  payphoneBank.name = 'payphone_bank';
  const phoneMetalMat = new THREE.MeshStandardMaterial({ color: 0x667788, roughness: 0.4, metalness: 0.6 });
  // Back panel
  const backPanel = mkBox(3, 2.5, 0.15, phoneMetalMat);
  backPanel.position.set(-16, 1.25, 3.8);
  payphoneBank.add(backPanel);
  // Three individual phone booths
  for (let p = 0; p < 3; p++) {
    const px = -17 + p * 1;
    // Phone housing
    const housing = mkBox(0.6, 0.8, 0.3, phoneMetalMat);
    housing.position.set(px, 1.8, 3.8);
    payphoneBank.add(housing);
    // Receiver cradle
    const cradle = mkBox(0.3, 0.08, 0.15, ironMaterial(0.6, palette));
    cradle.position.set(px, 1.5, 3.8);
    payphoneBank.add(cradle);
    // Coin slot
    const coinSlot = mkBox(0.15, 0.06, 0.02, ironMaterial(0.6, palette));
    coinSlot.position.set(px, 1.7, 3.96);
    payphoneBank.add(coinSlot);
    // Telephone handset (receiver)
    const receiver = mkBox(0.12, 0.3, 0.08, new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }));
    receiver.position.set(px, 1.65, 3.95);
    payphoneBank.add(receiver);
    // Instruction sticker
    const instrCanvas = document.createElement('canvas');
    instrCanvas.width = 64;
    instrCanvas.height = 32;
    const ictx = instrCanvas.getContext('2d')!;
    ictx.fillStyle = '#FFFFFF';
    ictx.fillRect(0, 0, 64, 32);
    ictx.fillStyle = '#000000';
    ictx.font = 'bold 8px Arial';
    ictx.fillText('INSERT COINS', 4, 12);
    ictx.fillText('MAX $1.00', 4, 24);
    const instrTex = new THREE.CanvasTexture(instrCanvas);
    const instrMat = new THREE.MeshStandardMaterial({ map: instrTex });
    const instrSticker = mkBox(0.4, 0.2, 0.01, instrMat);
    instrSticker.position.set(px, 1.95, 3.96);
    payphoneBank.add(instrSticker);
  }
  g.add(payphoneBank);

  // ── Graffiti-tagged dumpsters ──
  const dumpsterPositions = [
    { x: -12, z: 3.0 },
    { x: 36, z: 3.0 },
  ];
  for (const dp of dumpsterPositions) {
    const dumpsterGroup = new THREE.Group();
    dumpsterGroup.name = `dumpster_${dp.x}`;
    const dumpsterMat = new THREE.MeshStandardMaterial({ color: 0x2A4A2A, roughness: 0.85, metalness: 0.1 });
    // Main body
    const dumpsterBody = mkBox(1.5, 1.2, 1.0, dumpsterMat);
    dumpsterBody.position.set(dp.x, 0.6, dp.z);
    dumpsterGroup.add(dumpsterBody);
    // Lid (slightly ajar)
    const lidMat = new THREE.MeshStandardMaterial({ color: 0x3A5A3A, roughness: 0.8, metalness: 0.1 });
    const lid = mkBox(1.5, 0.05, 1.0, lidMat);
    lid.position.set(dp.x, 1.22, dp.z);
    lid.rotation.x = 0.15; // slightly ajar
    dumpsterGroup.add(lid);
    // Graffiti tags (canvas-generated)
    const dumpsterGraffCanvas = makeDumpsterGraffitiTexture();
    const dumpsterGraffTex = new THREE.CanvasTexture(dumpsterGraffCanvas);
    const dumpsterGraffMat = new THREE.MeshStandardMaterial({ map: dumpsterGraffTex });
    const frontGraff = mkBox(1.4, 0.8, 0.02, dumpsterGraffMat);
    frontGraff.position.set(dp.x, 0.6, dp.z + 0.51);
    dumpsterGroup.add(frontGraff);
    // Side graffiti
    const sideGraff = mkBox(0.02, 0.8, 0.9, dumpsterGraffMat);
    sideGraff.position.set(dp.x + 0.76, 0.6, dp.z);
    dumpsterGroup.add(sideGraff);
    // Rust patches
    const rustMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 });
    for (let r = 0; r < 3; r++) {
      const rustPatch = mkBox(0.15 + Math.random() * 0.2, 0.1 + Math.random() * 0.15, 0.01, rustMat);
      rustPatch.position.set(
        dp.x + (Math.random() - 0.5) * 1.2,
        0.3 + Math.random() * 0.5,
        dp.z + 0.51,
      );
      dumpsterGroup.add(rustPatch);
    }
    g.add(dumpsterGroup);
  }

  // ── Chain-link fencing ──
  const fenceGroup = new THREE.Group();
  fenceGroup.name = 'chain_link_fencing';
  const chainLinkMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.7 });
  // Fence section along edge of demolished lot
  const fencePosts = [
    { x: -1, z: -3.5 },
    { x: 3, z: -3.5 },
    { x: 7, z: -3.5 },
    { x: -1, z: 1 },
    { x: 7, z: 1 },
  ];
  for (const fp of fencePosts) {
    // Post
    const post = mkCyl(0.04, 0.04, 2.5, 8, chainLinkMat);
    post.position.set(fp.x, 1.25, fp.z);
    fenceGroup.add(post);
  }
  // Top rail
  const topRail = mkCyl(0.025, 0.025, 10, 6, chainLinkMat);
  topRail.rotation.z = Math.PI / 2;
  topRail.position.set(3, 2.5, -3.5);
  fenceGroup.add(topRail);
  // Chain-link mesh panels (simplified as crossed diagonal lines)
  const meshMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.7, metalness: 0.6 });
  for (let panel = 0; panel < 2; panel++) {
    const panelStartX = -1 + panel * 4;
    // Diagonal wires (simulating diamond pattern)
    for (let d = 0; d < 8; d++) {
      const dx = panelStartX + d * 0.5;
      // Down-right diagonal
      const drGeo = new THREE.CylinderGeometry(0.008, 0.008, 1.2, 4);
      const dr = new THREE.Mesh(drGeo, meshMat);
      dr.position.set(dx + 0.25, 1.25, -3.5);
      dr.rotation.z = -0.6;
      fenceGroup.add(dr);
      // Up-right diagonal
      const ur = dr.clone();
      ur.rotation.z = 0.6;
      fenceGroup.add(ur);
    }
  }
  // Warning ribbon/tape
  const warningCanvas = document.createElement('canvas');
  warningCanvas.width = 128;
  warningCanvas.height = 16;
  const wac = warningCanvas.getContext('2d')!;
  wac.fillStyle = '#FFCC00';
  wac.fillRect(0, 0, 128, 16);
  wac.fillStyle = '#000';
  wac.font = 'bold 10px Arial';
  wac.fillText('CAUTION CONSTRUCTION ZONE', 10, 12);
  const warnTex = new THREE.CanvasTexture(warningCanvas);
  const warnMat = new THREE.MeshStandardMaterial({ map: warnTex, side: THREE.DoubleSide, transparent: true });
  const warnTape = new THREE.Mesh(new THREE.PlaneGeometry(8, 0.15), warnMat);
  warnTape.position.set(3, 2.0, -3.5);
  fenceGroup.add(warnTape);
  g.add(fenceGroup);

  // ── Lamp posts with sodium-vapor warm glow ──
  const lampPositions = [
    { x: -22, z: 4.0 },
    { x: -11, z: 4.0 },
    { x: 0, z: 4.0 },
    { x: 11, z: 4.0 },
    { x: 22, z: 4.0 },
    { x: 33, z: 4.0 },
  ];
  for (const lp of lampPositions) {
    const lampGroup = new THREE.Group();
    lampGroup.name = `lamp_post_1985_${lp.x}`;
    // Steel pole
    const poleMat = ironMaterial(0.6, palette);
    const pole = mkCyl(0.06, 0.08, 5, 8, poleMat);
    pole.position.set(lp.x, 2.5, lp.z);
    lampGroup.add(pole);
    // Arm extending over street
    const arm = mkCyl(0.04, 0.04, 1.5, 6, poleMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(lp.x + 0.75, 5, lp.z);
    lampGroup.add(arm);
    // Sodium-vapor fixture (warm orange glow)
    const fixtureMat = new THREE.MeshStandardMaterial({
      color: 0xFFAA44, emissive: 0xFF8822, emissiveIntensity: 0.8,
      roughness: 0.3,
    });
    const fixture = mkBox(0.5, 0.15, 0.3, fixtureMat);
    fixture.position.set(lp.x + 1.5, 4.9, lp.z);
    lampGroup.add(fixture);
    // Point light for warm sodium-vapor glow
    const navLight = new THREE.PointLight(0xFFAA44, 0.6, 12);
    navLight.position.set(lp.x + 1.5, 4.8, lp.z);
    lampGroup.add(navLight);
    g.add(lampGroup);
  }

  // ── Trash cans ──
  const trashPositions = [
    { x: -16, z: 4.0 },
    { x: 18, z: 4.0 },
    { x: 30, z: 4.0 },
  ];
  for (const tp of trashPositions) {
    const trashResult = generateProp({
      type: 'trash_can',
      scale: 1,
      condition: 0.4 + Math.random() * 0.2,
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
    condition: 0.5,
  });
  benchResult.group.position.set(14, 0, 4.0);
  g.add(benchResult.group);
  _disposeTargets.push(benchResult);

  // ── Bollards ──
  const bollardPositions = [
    { x: -25, z: 4.8 },
    { x: 35, z: 4.8 },
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

// ── Atmosphere (smoggy haze + sodium-vapor dusk lighting) ────────────

function buildAtmosphere(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'atmosphere_1985';

  // Smoggy haze volume — muted grey-brown atmospheric sphere
  const smogMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0x665544),
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const smogSphere = new THREE.Mesh(
    new THREE.SphereGeometry(60, 16, 12),
    smogMat,
  );
  smogSphere.position.set(0, 20, -20);
  smogSphere.renderOrder = -1;
  g.add(smogSphere);

  // Ground-level smog fog plane
  const fogMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0x665544).multiplyScalar(0.6),
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const fogPlane = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), fogMat);
  fogPlane.position.set(0, 0.5, 0);
  fogPlane.rotation.x = -Math.PI / 2;
  fogPlane.renderOrder = -1;
  g.add(fogPlane);

  // Dusk sky — dimming blue-grey
  const duskSky = new THREE.HemisphereLight(0x445566, 0x332211, 0.4);
  g.add(duskSky);

  // Warm directional light simulating low sun / dusk
  const duskSun = new THREE.DirectionalLight(0xFFAA66, 0.5);
  duskSun.position.set(-20, 15, -10);
  g.add(duskSun);

  // Sodium-vapor ambient warmth
  const navAmbient = new THREE.AmbientLight(0xFFAA44, 0.15);
  g.add(navAmbient);

  // Cool fill light from opposite side (moonlight bleed)
  const coolFill = new THREE.DirectionalLight(0x4466AA, 0.15);
  coolFill.position.set(20, 10, 10);
  g.add(coolFill);

  return g;
}

// ══════════════════════════════════════════════════════════════════════
// ERA CONTENT MODULE — implements EraContentModule interface
// ══════════════════════════════════════════════════════════════════════

/**
 * The complete 1985 era content module.
 *
 * Implements the shared EraContentModule interface that all era modules
 * must follow.
 *
 * Visual features:
 *   - Weathered/graffiti'd 1945-era stock buildings with soot grime
 *     and canvas-generated graffiti tags on brick facades
 *   - Demolished lot converted to surface parking lot with gravel,
 *     potholes, rubble pile, exposed rebar on partial wall
 *   - Mirrored-glass and brown-brick office block with smoked windows,
 *     vertical mullions, and horizontal spandrel bands
 *   - Video rental store with neon VHS sign, movie genre displays,
 *     "VHS RENTALS" neon, and VHS-tape-shaped neon decoration
 *   - Arcade with glowing marquee ("ARCADE"), light bulb border,
 *     attract-mode screen with pixel-art graphics
 *   - Punk/new-wave record shop with neon "RECORDS" sign,
 *     canvas-generated band posters (DEAD ZONE, NEON FURY, etc.),
 *     wheatpaste poster on wall
 *   - Payphone bank with three phones, coin slots, instruction stickers
 *   - Graffiti-tagged dumpsters with multiple spray-paint tags,
 *     rust stains, slightly ajar lids
 *   - Chain-link fencing with diamond-pattern mesh, warning ribbon,
 *     concrete posts along demolished lot perimeter
 *   - Vehicles: boxy angular sedans, station wagon, subcompact hatchback,
 *     delivery van with fictional company logo, graffiti-tagged panel truck,
 *     Checker-style yellow taxi with black-and-white checker stripe pattern
 *     and illuminated roof light
 *   - Billboards with halftone dot patterns advertising fictional brands
 *     (ZAP COLA, PIXEL PIZZA, STARLINE MOTORS)
 *   - Neon glow signs on storefronts (OPEN, NOW PLAYING, NEW ARRIVALS)
 *   - Pedestrians in 1980s outfits: acid-wash jeans, bright tracksuits,
 *     members-only-style jackets, rolled-sleeve blazers, neon punk wear,
 *     downtown evening wear with cyan accents
 *   - Accessories: boombox on shoulder, Walkman headphone wire, skateboard
 *   - Sodium-vapor lamp posts with warm orange point lights
 *   - Smoggy haze atmosphere, dusk sky, warm sodium-vapor lighting
 *
 * All graffiti tags, band posters, billboard ads, and signage are
 * canvas-generated textures — no external assets used.
 */
export const era1985: EraContentModule = {
  id: '1985',

  /** Build and return a single THREE.Group with named category children. */
  build(): THREE.Group {
    const root = new THREE.Group();
    root.name = 'era_1985';

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

    _builtContent = {
      buildings: buildingsGroup,
      vehicles: vehiclesGroup,
      signage: signageGroup,
      pedestrians: pedestriansGroup,
      props: propsGroup,
    };

    return root;
  },

  update(_dt: number, _elapsed: number): void {
    // Animate neon sign flicker (subtle intensity oscillation)
    const flicker = Math.sin(_elapsed * 8) * 0.05 + Math.sin(_elapsed * 13) * 0.03;

    if (_builtContent) {
      // Flicker neon signs in signage group
      _builtContent.signage.traverse((obj: unknown) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        const matOrArr = mesh.material;
        const mats: THREE.Material[] = Array.isArray(matOrArr) ? matOrArr : [matOrArr];
        for (const m of mats) {
          if (m instanceof THREE.MeshStandardMaterial && m.emissiveIntensity !== undefined) {
            m.emissiveIntensity = Math.max(0.3, (m.userData.baseEmissive || m.emissiveIntensity) + flicker);
          }
          if (m instanceof THREE.MeshBasicMaterial && m.map) {
            // Keep basic materials stable
          }
        }
      });

      // Arcade attract-mode screen pulse (use standard material for emissive control)
      const attractScreen = _builtContent.signage.getObjectByName('ARCADE');
      if (attractScreen) {
        attractScreen.traverse((child: unknown) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          if (mesh.material instanceof THREE.MeshStandardMaterial && mesh.material.emissiveIntensity !== undefined) {
            mesh.material.emissiveIntensity = 0.3 + Math.sin(_elapsed * 3) * 0.2;
          }
        });
      }
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
