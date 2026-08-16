import * as THREE from 'three';
import type { EraId } from '../eras.js';
import { TextureFactory } from '../util/textures.js';
import { buildSignMesh, createLEDStripTexture, buildNeonSignMesh, getSignForBuilding } from './signage.js';
import type { BuildingSpec } from '../buildings/specs.js';

// Re-export for layer.ts
export { getSignForBuilding } from './signage.js';

/** Draw a simple illustrated item on canvas for window displays */
function drawWindowItem(_eraId: EraId, label: string, color: string, detailFn?: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, 128, 128);

  // Colored box / item body
  ctx.fillStyle = color;
  ctx.fillRect(24, 24, 80, 80);

  // Label text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 64, 64);

  // Detail overlay
  if (detailFn) detailFn(ctx);

  // Border glow
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, 84, 84);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// ── Era-specific window display generators ───────────────────────────

function build1945WindowDisplay(_building: BuildingSpec, _textures: TextureFactory): THREE.Group {
  const group = new THREE.Group();

  const items: { label: string; color: string }[] = [];
  switch (_building.id) {
    case 'corner_shop':
      items.push({ label: 'CANNED GOODS', color: '#8B4513' });
      items.push({ label: 'MILK JARS', color: '#f5f5dc' });
      items.push({ label: 'RACTION BOOKS', color: '#cc3333' });
      break;
    case 'warehouse_e':
      items.push({ label: 'TOOLS', color: '#666666' });
      items.push({ label: 'NAILS & BOLTS', color: '#4a4a2a' });
      break;
    case 'shop_s':
      items.push({ label: 'TAILORING', color: '#5c3a1e' });
      items.push({ label: 'SEWING KIT', color: '#8B0000' });
      break;
    case 'building_sw':
      items.push({ label: 'REMEDIIES', color: '#2a5c2a' });
      items.push({ label: 'FIRST AID', color: '#cc0000' });
      break;
    default:
      items.push({ label: 'WAR EFFORT', color: '#3a5c3a' });
  }

  items.forEach((item, i) => {
    const tex = drawWindowItem('1945', item.label, item.color, (ctx) => {
      // Cross-hatch pattern for vintage feel
      ctx.globalAlpha = 0.15;
      for (let x = 0; x < 128; x += 6) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 30, 128);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });

    const geo = new THREE.PlaneGeometry(0.6, 0.6);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(0x332200),
      emissiveIntensity: 0.15,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(-0.7 + i * 0.7, 0, 0);
    group.add(mesh);
  });

  return group;
}

function build1965WindowDisplay(_building: BuildingSpec): THREE.Group {
  const group = new THREE.Group();

  const items: { label: string; color: string }[] = [];
  switch (_building.id) {
    case 'corner_shop':
      items.push({ label: 'SHAKES', color: '#ff6b9d' });
      items.push({ label: 'SODAS', color: '#33cc33' });
      break;
    case 'warehouse_e':
      items.push({ label: '45 RPM', color: '#ffcc00' });
      items.push({ label: 'LP RECORDS', color: '#cc3333' });
      items.push({ label: 'STEREO', color: '#666666' });
      break;
    case 'shop_s':
      items.push({ label: 'BURGERS', color: '#ff6b35' });
      items.push({ label: 'FRIES', color: '#ffcc00' });
      break;
    case 'building_sw':
      items.push({ label: 'COLOR TV', color: '#2244aa' });
      items.push({ label: 'REPAIR', color: '#ff6600' });
      break;
    default:
      items.push({ label: 'SNACKS', color: '#ffcc66' });
  }

  items.forEach((item, i) => {
    const tex = drawWindowItem('1965', item.label, item.color, (ctx) => {
      // Mid-century dot pattern
      ctx.globalAlpha = 0.12;
      for (let x = 8; x < 128; x += 10) {
        for (let y = 8; y < 128; y += 10) {
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    });

    const geo = new THREE.PlaneGeometry(0.6, 0.6);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(0x442200),
      emissiveIntensity: 0.2,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(-0.7 + i * 0.7, 0, 0);
    group.add(mesh);
  });

  return group;
}

function build1985WindowDisplay(_building: BuildingSpec): THREE.Group {
  const group = new THREE.Group();

  const items: { label: string; color: string }[] = [];
  switch (_building.id) {
    case 'corner_shop':
      items.push({ label: 'PAC-MAN', color: '#ffff00' });
      items.push({ label: 'SPACE INVADERS', color: '#00ff00' });
      items.push({ label: 'TETRIS', color: '#ff0000' });
      break;
    case 'warehouse_e':
      items.push({ label: 'VHS', color: '#1a1a1a' });
      items.push({ label: 'BLU-RAY', color: '#00aaff' });
      break;
    case 'shop_s':
      items.push({ label: 'PAWN', color: '#cc9900' });
      items.push({ label: 'GOLD', color: '#ffcc00' });
      items.push({ label: 'WATCHES', color: '#aabbcc' });
      break;
    case 'building_sw':
      items.push({ label: 'CASSETTES', color: '#000000' });
      items.push({ label: 'CDs', color: '#cccccc' });
      break;
    default:
      items.push({ label: 'GAME CARDS', color: '#ff33ff' });
  }

  items.forEach((item, i) => {
    const tex = drawWindowItem('1985', item.label, item.color, (ctx) => {
      // Scanline effect
      ctx.globalAlpha = 0.08;
      for (let y = 0; y < 128; y += 3) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, y, 128, 1);
      }
      ctx.globalAlpha = 1;
    });

    const geo = new THREE.PlaneGeometry(0.6, 0.6);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(0x220033),
      emissiveIntensity: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(-0.7 + i * 0.7, 0, 0);
    group.add(mesh);
  });

  return group;
}

function build2005WindowDisplay(_building: BuildingSpec): THREE.Group {
  const group = new THREE.Group();

  const items: { label: string; color: string }[] = [];
  switch (_building.id) {
    case 'corner_shop':
      items.push({ label: 'INTERNET', color: '#0066cc' });
      items.push({ label: 'PRINTING', color: '#0099ff' });
      items.push({ label: 'FAX', color: '#666666' });
      break;
    case 'warehouse_e':
      items.push({ label: 'MOBILE PHONES', color: '#00cc66' });
      items.push({ label: 'CASES', color: '#cc33cc' });
      items.push({ label: 'CHARGERS', color: '#ffcc00' });
      break;
    case 'shop_s':
      items.push({ label: '$ DEALS', color: '#00aa00' });
      items.push({ label: 'EVERYTHING $1', color: '#ff3300' });
      break;
    case 'building_sw':
      items.push({ label: 'HAIRCUTS', color: '#3366cc' });
      items.push({ label: '$5 CUTS', color: '#ff6600' });
      break;
    default:
      items.push({ label: 'DEALS', color: '#0099cc' });
  }

  items.forEach((item, i) => {
    const tex = drawWindowItem('2005', item.label, item.color);

    const geo = new THREE.PlaneGeometry(0.6, 0.6);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(0x002244),
      emissiveIntensity: 0.25,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(-0.7 + i * 0.7, 0, 0);
    group.add(mesh);
  });

  return group;
}

function build2025WindowDisplay(_building: BuildingSpec): THREE.Group {
  const group = new THREE.Group();

  const items: { label: string; color: string }[] = [];
  switch (_building.id) {
    case 'corner_shop':
      items.push({ label: 'SINGLE ORIGIN', color: '#00ff88' });
      items.push({ label: 'ESPRESSO', color: '#00ddaa' });
      break;
    case 'warehouse_e':
      items.push({ label: 'CLASSIC CUT', color: '#00bbff' });
      items.push({ label: 'FADE', color: '#00ff66' });
      break;
    case 'shop_s':
      items.push({ label: 'PERSONAL TRAINING', color: '#ff4444' });
      items.push({ label: 'MEMBERSHIP', color: '#ff8800' });
      items.push({ label: 'YOGA', color: '#aa44ff' });
      break;
    case 'building_sw':
      items.push({ label: 'COLD-PRESSED', color: '#00ffaa' });
      items.push({ label: 'ORGANIC', color: '#88cc00' });
      break;
    default:
      items.push({ label: 'WELLNESS', color: '#00ffcc' });
  }

  items.forEach((item, i) => {
    const tex = drawWindowItem('2025', item.label, item.color, (ctx) => {
      // Minimalist LED dot grid
      ctx.globalAlpha = 0.2;
      for (let x = 12; x < 128; x += 14) {
        for (let y = 12; y < 128; y += 14) {
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    });

    const geo = new THREE.PlaneGeometry(0.6, 0.6);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(0x00ff88),
      emissiveIntensity: 0.4,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(-0.7 + i * 0.7, 0, 0);
    group.add(mesh);
  });

  return group;
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Build a complete storefront display for a building in a given era.
 * Returns a THREE.Group containing window displays, sign mesh, and
 * era-appropriate facade decorations mounted at sidewalk level.
 */
export function buildStorefront(
  building: BuildingSpec,
  eraId: EraId,
  _textures: TextureFactory,
  facadeWidth: number,
  facadeHeight: number,
): THREE.Group {
  const group = new THREE.Group();

  // ── Sign above storefront ────────────────────────────────────────
  const signEntry = getSignForBuilding(building.id, eraId);
  if (signEntry?.text) {
    const signMesh = buildSignMesh(signEntry.text, signEntry.sub, eraId, facadeWidth * 0.8, 0.7);
    signMesh.position.set(0, facadeHeight * 0.75, 0.05);
    group.add(signMesh);

    // Neon variant for applicable eras
    if (eraId === '1985' || eraId === '2005') {
      const neonMesh = buildNeonSignMesh(signEntry.text, eraId, facadeWidth * 0.6, 0.5);
      neonMesh.position.set(0, facadeHeight * 0.75, 0.06);
      group.add(neonMesh);
    }
  }

  // ── Window displays ──────────────────────────────────────────────
  const windowGroup = new THREE.Group();
  switch (eraId) {
    case '1945':
      windowGroup.add(build1945WindowDisplay(building, _textures));
      break;
    case '1965':
      windowGroup.add(build1965WindowDisplay(building));
      break;
    case '1985':
      windowGroup.add(build1985WindowDisplay(building));
      break;
    case '2005':
      windowGroup.add(build2005WindowDisplay(building));
      break;
    case '2025':
      windowGroup.add(build2025WindowDisplay(building));
      break;
  }
  windowGroup.position.set(0, -facadeHeight * 0.25, 0.02);
  group.add(windowGroup);

  // ── LED accent strips for 2025 ───────────────────────────────────
  if (eraId === '2025') {
    const ledColor = building.materials.trimColor || '#00ff88';
    const ledTex = createLEDStripTexture(ledColor, 512, 16);

    // Horizontal strip along top of storefront
    const stripGeo = new THREE.PlaneGeometry(facadeWidth * 0.9, 0.06);
    const stripMat = new THREE.MeshStandardMaterial({
      map: ledTex,
      emissiveMap: ledTex,
      emissive: new THREE.Color(ledColor),
      emissiveIntensity: 1.5,
    });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(0, facadeHeight * 0.55, 0.04);
    group.add(strip);

    // Vertical accent strips at edges
    const vStripGeo = new THREE.PlaneGeometry(0.06, facadeHeight * 0.6);
    [-1, 1].forEach((_side) => {
      const vStrip = new THREE.Mesh(vStripGeo, stripMat.clone());
      vStrip.position.set(_side * facadeWidth * 0.45, 0, 0.04);
      group.add(vStrip);
    });
  }

  return group;
}
