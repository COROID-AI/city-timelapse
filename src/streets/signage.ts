import * as THREE from 'three';
import type { EraId } from '../eras.js';

// ── Sign data per era — invented generic brands only ─────────────────

interface SignEntry {
  /** Display text on the sign */
  text: string;
  /** Sub-text / tagline */
  sub?: string;
}

/** Storefront signs for each era, keyed by building id */
const ERA_SIGNS: Record<EraId, Record<string, SignEntry>> = {
  '1945': {
    corner_shop: { text: 'HARTLEY\'S GENERAL', sub: 'Est. 1892' },
    warehouse_e: { text: 'MILLER & SONS', sub: 'Hardware' },
    apartment_n: { text: '', sub: '' },
    shop_s: { text: 'OAKLEY TAILOR', sub: 'Fine Dressmaking' },
    building_sw: { text: 'DR. PEARSON', sub: 'Chemist & Apothecary' },
    empty_ne: { text: '', sub: '' },
  },
  '1965': {
    corner_shop: { text: 'DAIRY SPOT', sub: 'Ice Cream & Sodas' },
    warehouse_e: { text: 'BLUE NOTE', sub: 'Record Shop' },
    apartment_n: { text: '', sub: '' },
    shop_s: { text: 'JUICE BAR', sub: 'Fresh Fruit Shakes' },
    building_sw: { text: 'COLOR TV REPAIR', sub: 'Authorized Dealer' },
    empty_ne: { text: '', sub: '' },
  },
  '1985': {
    corner_shop: { text: 'PIXEL ARCADE', sub: 'Insert Coin' },
    warehouse_e: { text: 'VHS VAULT', sub: 'Rent Today' },
    apartment_n: { text: '', sub: '' },
    shop_s: { text: 'NEON PAWN', sub: 'Cash for Jewelry' },
    building_sw: { text: 'CASSETTE CORNER', sub: 'Cuts • Cassettes' },
    empty_ne: { text: '', sub: '' },
  },
  '2005': {
    corner_shop: { text: 'NET HUB', sub: 'Broadband Access' },
    warehouse_e: { text: 'MOBILE WORLD', sub: 'Unlocked Phones' },
    apartment_n: { text: '', sub: '' },
    shop_s: { text: 'DOLLAR DEPOT', sub: 'Everything $1' },
    building_sw: { text: 'TINY CUTS', sub: 'Quick Haircuts' },
    empty_ne: { text: '', sub: '' },
  },
  '2025': {
    corner_shop: { text: 'EMBER COFFEE', sub: 'Single Origin' },
    warehouse_e: { text: 'BLADE & EDGE', sub: 'Barbershop' },
    apartment_n: { text: '', sub: '' },
    shop_s: { text: 'IRON FORGE', sub: 'Fitness Studio' },
    building_sw: { text: 'PURE JUICE', sub: 'Cold-Pressed' },
    empty_ne: { text: '', sub: '' },
  },
};

// ── Canvas-based sign texture helpers ────────────────────────────────

interface SignConfig {
  bg: string;
  fg: string;
  font: string;
  glow?: boolean;
  borderStyle?: 'none' | 'double' | 'shadow' | 'outline';
}

const SIGN_CONFIGS: Record<EraId, SignConfig> = {
  '1945': {
    bg: '#2a1f14',
    fg: '#f0e6c8',
    font: 'Georgia, "Times New Roman", serif',
    borderStyle: 'shadow',
  },
  '1965': {
    bg: '#ff6b35',
    fg: '#ffffff',
    font: '"Arial Black", Impact, sans-serif',
    glow: true,
    borderStyle: 'outline',
  },
  '1985': {
    bg: '#1a0a2e',
    fg: '#ff00ff',
    font: '"Courier New", monospace',
    glow: true,
    borderStyle: 'outline',
  },
  '2005': {
    bg: '#0066cc',
    fg: '#ffffff',
    font: 'Verdana, Arial, sans-serif',
    borderStyle: 'none',
  },
  '2025': {
    bg: '#0a0a0a',
    fg: '#00ff88',
    font: '"Helvetica Neue", Arial, sans-serif',
    glow: true,
    borderStyle: 'outline',
  },
};

/** Draw a decorative era-appropriate border on canvas */
function drawBorder(ctx: CanvasRenderingContext2D, w: number, h: number, style: string | undefined): void {
  if (!style || style === 'none') return;

  switch (style) {
    case 'double': {
      ctx.lineWidth = 2;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.strokeRect(10, 10, w - 20, h - 20);
      break;
    }
    case 'shadow': {
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.shadowBlur = 0;
      break;
    }
    case 'outline': {
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      break;
    }
  }
}

/**
 * Generate a canvas texture for an era-specific storefront / billboard sign.
 * Uses period-appropriate typefaces, colors, and palettes.
 */
export function createSignTexture(
  text: string,
  sub: string | undefined,
  eraId: EraId,
  width = 512,
  height = 160,
): THREE.CanvasTexture {
  const cfg = SIGN_CONFIGS[eraId];

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = cfg.bg;
  ctx.fillRect(0, 0, width, height);

  // Subtle aged/worn overlay for 1945
  if (eraId === '1945') {
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      ctx.fillStyle = Math.random() > 0.5 ? '#000' : '#fff';
      ctx.fillRect(x, y, Math.random() * 3 + 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  // Neon glow effect for applicable eras
  if (cfg.glow) {
    ctx.shadowColor = cfg.fg;
    ctx.shadowBlur = 18;
  }

  // Main text
  const fontSize = Math.floor(height * 0.38);
  ctx.font = `bold ${fontSize}px ${cfg.font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = cfg.fg;
  ctx.fillText(text, width / 2, sub ? height * 0.4 : height / 2);

  // Reset shadow before sub-text
  ctx.shadowBlur = 0;

  // Sub-text / tagline
  if (sub) {
    const subFontSize = Math.floor(height * 0.16);
    ctx.font = `${subFontSize}px ${cfg.font}`;
    ctx.globalAlpha = 0.8;
    ctx.fillText(sub, width / 2, height * 0.68);
    ctx.globalAlpha = 1;
  }

  // Decorative border
  drawBorder(ctx, width, height, cfg.borderStyle);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// ── High neon sign textures for 1985-era glow effects ────────────────

export function createNeonSignTexture(
  text: string,
  eraId: EraId,
  width = 512,
  height = 128,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Dark background
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, width, height);

  // Multi-layered neon glow
  const colors: Record<EraId, string[]> = {
    '1985': ['#ff00ff', '#00ffff', '#ff3300'],
    '2005': ['#0099ff', '#00ff66', '#ffcc00'],
    '2025': ['#00ff88', '#00ddff', '#ffffff'],
    '1965': ['#ff6b35', '#ffcc00', '#ffffff'],
    '1945': ['#f0e6c8', '#c8b89a'],
  };

  const neonColors = colors[eraId] || colors['1985'];

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontSize = Math.floor(height * 0.45);

  // Outer glow layers
  for (let layer = 3; layer >= 1; layer--) {
    ctx.shadowColor = neonColors[0];
    ctx.shadowBlur = layer * 12;
    ctx.font = `bold ${fontSize}px "Arial Black", Impact, sans-serif`;
    ctx.fillStyle = neonColors[0];
    ctx.globalAlpha = 0.3 / layer;
    ctx.fillText(text, width / 2, height / 2);
  }

  // Core text
  ctx.shadowBlur = 6;
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${fontSize}px "Arial Black", Impact, sans-serif`;
  ctx.fillText(text, width / 2, height / 2);

  // Second color accent line below
  ctx.shadowColor = neonColors[1];
  ctx.shadowBlur = 8;
  ctx.font = `${Math.floor(fontSize * 0.4)}px Verdana, sans-serif`;
  ctx.fillStyle = neonColors[1];
  ctx.fillText(text.toUpperCase(), width / 2, height * 0.78);

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// ── LED strip texture for modern (2025) buildings ────────────────────

export function createLEDStripTexture(color = '#00ff88', width = 256, height = 16): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, width, height);

  // Segmented LED look
  const segW = 8;
  const gap = 2;
  for (let x = gap; x < width; x += segW + gap) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.6 + Math.random() * 0.4;
    ctx.fillRect(x, 3, segW, height - 6);
  }
  ctx.globalAlpha = 1;

  // Glow
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.fillStyle = color;
  ctx.fillRect(width / 2 - 20, 0, 40, height);
  ctx.shadowBlur = 0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Get the sign text for a given building in a given era.
 * Returns null if no sign is defined for that combination.
 */
export function getSignForBuilding(buildingId: string, eraId: EraId): SignEntry | null {
  const eraSigns = ERA_SIGNS[eraId]?.[buildingId];
  if (!eraSigns || !eraSigns.text) return null;
  return eraSigns;
}

/**
 * Create a mesh with the sign texture mapped onto it.
 * The returned mesh has an emissive map set so it glows at night
 * while remaining readable under daylight.
 */
export function buildSignMesh(
  text: string,
  sub: string | undefined,
  eraId: EraId,
  width = 3,
  height = 0.8,
): THREE.Mesh {
  const texture = createSignTexture(text, sub, eraId, 512, 160);
  texture.colorSpace = THREE.SRGBColorSpace;

  const geo = new THREE.PlaneGeometry(width, height);
  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    emissiveMap: texture,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: eraId === '1945' ? 0.0 : 0.3,
    roughness: 0.6,
    metalness: 0.1,
  });

  return new THREE.Mesh(geo, mat);
}

/**
 * Build a neon-style sign mesh (for 1985+).
 * Strong emissive glow for nighttime visibility.
 */
export function buildNeonSignMesh(text: string, eraId: EraId, width = 3, height = 0.7): THREE.Mesh {
  const texture = createNeonSignTexture(text, eraId, 512, 128);
  texture.colorSpace = THREE.SRGBColorSpace;

  const geo = new THREE.PlaneGeometry(width, height);
  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    emissiveMap: texture,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 1.2,
    transparent: true,
    roughness: 0.3,
    metalness: 0.0,
  });

  return new THREE.Mesh(geo, mat);
}
