/**
 * Storefronts & advertisements layer — per-era signage, shops and billboards.
 *
 * All signage is generated as canvas-drawn textures so text and logos are
 * real, readable and era-correct. No binary assets.
 *
 * Per-era content:
 *   1945 — hand-painted storefront signs, butcher/baker/greengrocer/general
 *          store, ration-era posters, Coca-Cola-style painted wall ad, dim
 *          interior glow.
 *   1965 — chrome diner signage, jukebox-era record shop, pharmacy cross,
 *          enamel signs, hand-painted movie poster on the side wall.
 *   1985 — neon shop signs with visible tubes and glow, video-rental store,
 *          arcade, pizzeria, cassette-shop window stickers, big painted
 *          cigarette/soft-drink billboard.
 *   2005 — backlit plastic sign boxes, internet café, mobile-phone shop,
 *          DVD rental, branded chain storefronts, large printed billboard.
 *   2025 — animated digital screens (scrolling / cycling ads), organic café,
 *          e-commerce pickup point, QR-code decals, large animated LED
 *          billboard on the block corner.
 *
 * Signage lights up at appropriate eras (dim 1945 glow → full LED animation
 * in 2025). Exposes applyEra(id) with per-sign swap/fade and emissive
 * intensity control.
 */

import * as THREE from 'three';
import type { EraContent } from '../../content/eraConfig.js';
import type { EraId } from '../../eras.js';

// ─── Public API ──────────────────────────────────────────────────────────────

export interface StorefrontLayerResult {
  group: THREE.Group;
  /** Swap all signage to the target era with a brief fade. */
  applyEra(eraId: EraId): void;
  /** Call this every frame if the era supports animations (2025). */
  animate(time: number): void;
  /** Dispose all Three.js resources held by this layer. */
  dispose(): void;
}

// ─── Internal types ──────────────────────────────────────────────────────────

interface CanvasTextureWithUpdate {
  texture: THREE.CanvasTexture;
  draw(ctx: CanvasRenderingContext2D, time?: number): void;
  needsUpdate?: boolean;
}

interface NamedMesh {
  name: string;
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
  emissiveTarget: number;
  opacityTarget: number;
  currentOpacity: number;
}

interface AnimatedScreen {
  drawFn: (ctx: CanvasRenderingContext2D, time: number) => void;
  mesh: THREE.Object3D;
  material: THREE.MeshBasicMaterial;
  texture: THREE.CanvasTexture;
  frameIndex: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BUILDING_Z = -18;
const SIGN_OFFSET_Y = 4.2;
const WINDOW_OFFSET_Y = 2.0;
const BILLBOARD_X_SPACING = 18;
const BILLBOARD_HEIGHT = 10;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a static canvas texture. */
function makeCanvasTexture(
  width: number,
  height: number,
  drawFn: (ctx: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  drawFn(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/** Create a dynamic canvas texture whose drawFn can be called repeatedly. */
function makeDynamicTexture(
  width: number,
  height: number,
  drawFn: (ctx: CanvasRenderingContext2D, time: number) => void,
): CanvasTextureWithUpdate {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  drawFn(ctx, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return { texture: tex, draw: drawFn };
}

// ─── Era content definitions ─────────────────────────────────────────────────

interface ShopEntry {
  name: string;
  tagline: string;
  colors: { bg: string; fg: string; accent: string };
  signType: 'parchment' | 'chalkboard' | 'enamel' | 'chrome' | 'neon_tube' | 'backlit_box' | 'led_screen';
  windowStyle: 'curtain' | 'display_case' | 'poster' | 'shelf' | 'screen';
  awningColor: string;
  awningPattern: 'solid' | 'stripes' | 'checker';
}

interface AdEntry {
  label: string;
  headline: string;
  body: string;
  colors: { bg: string; fg: string; accent: string };
  adType: 'hand_painted' | 'poster' | 'chrome_billboard' | 'neon_billboard' | 'digital_screen' | 'printed_billboard' | 'led_wall';
}

interface AwningEntry {
  x: number;
  width: number;
  depth: number;
  color: string;
  pattern: 'solid' | 'stripes' | 'checker';
}

interface HangingSignEntry {
  x: number;
  poleLength: number;
  width: number;
  height: number;
  label: string;
  colors: { bg: string; fg: string; accent: string };
  signType: 'wood' | 'metal' | 'neon' | 'plastic' | 'digital';
}

interface EraShopData {
  shops: ShopEntry[];
  ads: AdEntry[];
  awnings: AwningEntry[];
  hangingSigns: HangingSignEntry[];
  lighting: {
    interiorGlow: number;
    emissiveIntensity: number;
    warmTone: boolean;
    neonColors?: number[];
  };
}

const ERA_DATA: Record<EraId, EraShopData> = {
  '1945': {
    shops: [
      {
        name: 'Butcher Block',
        tagline: 'Fresh Meats Daily',
        colors: { bg: '#f5e6c8', fg: '#5c3a1e', accent: '#8b0000' },
        signType: 'parchment',
        windowStyle: 'display_case',
        awningColor: '#8b0000',
        awningPattern: 'solid',
      },
      {
        name: "O'Brien's Bakery",
        tagline: 'Artisan Breads Since 1922',
        colors: { bg: '#faf0e6', fg: '#4a3728', accent: '#d4a017' },
        signType: 'parchment',
        windowStyle: 'display_case',
        awningColor: '#d4a017',
        awningPattern: 'stripes',
      },
      {
        name: 'Green Patch',
        tagline: 'Fruits & Vegetables',
        colors: { bg: '#e8f5e9', fg: '#2e7d32', accent: '#ff6f00' },
        signType: 'chalkboard',
        windowStyle: 'shelf',
        awningColor: '#2e7d32',
        awningPattern: 'solid',
      },
      {
        name: 'Harmony General',
        tagline: 'Groceries • Dry Goods • Feed',
        colors: { bg: '#efebe9', fg: '#3e2723', accent: '#bf360c' },
        signType: 'chalkboard',
        windowStyle: 'shelf',
        awningColor: '#bf360c',
        awningPattern: 'stripes',
      },
    ],
    ads: [
      {
        label: 'Victory Paint Co.',
        headline: 'PAINT THE WAY TO VICTORY!',
        body: 'Every brushstroke counts.\nSupport your community.\nAvailable in 12 patriotic shades.',
        colors: { bg: '#1a3a5c', fg: '#fff8e1', accent: '#c62828' },
        adType: 'hand_painted',
      },
      {
        label: 'Ration Board Notice',
        headline: 'SAVE — DON\'T WASTE',
        body: 'Sugar\nCoffee\nMeat\nFabric\n\nYour contribution\nmakes the difference.',
        colors: { bg: '#f5f5dc', fg: '#212121', accent: '#b71c1c' },
        adType: 'poster',
      },
    ],
    awnings: [
      { x: -9, width: 3.5, depth: 1.2, color: '#8b0000', pattern: 'solid' },
      { x: -3, width: 3.5, depth: 1.2, color: '#d4a017', pattern: 'stripes' },
      { x: 3, width: 3.5, depth: 1.2, color: '#2e7d32', pattern: 'solid' },
      { x: 9, width: 3.5, depth: 1.2, color: '#bf360c', pattern: 'stripes' },
    ],
    hangingSigns: [
      { x: -6, poleLength: 1.5, width: 1.2, height: 0.8, label: 'OPEN', colors: { bg: '#f5e6c8', fg: '#5c3a1e', accent: '' }, signType: 'wood' },
      { x: 6, poleLength: 1.5, width: 1.2, height: 0.8, label: 'GOODS', colors: { bg: '#efebe9', fg: '#3e2723', accent: '' }, signType: 'wood' },
    ],
    lighting: {
      interiorGlow: 0.15,
      emissiveIntensity: 0.2,
      warmTone: true,
    },
  },

  '1965': {
    shops: [
      {
        name: 'Starlight Diner',
        tagline: 'Good Food & Good Times',
        colors: { bg: '#fce4ec', fg: '#ad1457', accent: '#ffd54f' },
        signType: 'chrome',
        windowStyle: 'curtain',
        awningColor: '#ad1457',
        awningPattern: 'solid',
      },
      {
        name: 'Beatnik Records',
        tagline: 'Jazz • Soul • Folk',
        colors: { bg: '#ede7f6', fg: '#4527a0', accent: '#ff6f00' },
        signType: 'enamel',
        windowStyle: 'poster',
        awningColor: '#4527a0',
        awningPattern: 'solid',
      },
      {
        name: 'MediCare Pharmacy',
        tagline: 'Prescriptions • Sundries',
        colors: { bg: '#e8f5e9', fg: '#1b5e20', accent: '#ffffff' },
        signType: 'enamel',
        windowStyle: 'display_case',
        awningColor: '#ffffff',
        awningPattern: 'solid',
      },
      {
        name: 'Penny\'s Hat Shop',
        tagline: 'Fashions for Every Occasion',
        colors: { bg: '#fff3e0', fg: '#e65100', accent: '#c62828' },
        signType: 'chrome',
        windowStyle: 'display_case',
        awningColor: '#c62828',
        awningPattern: 'stripes',
      },
    ],
    ads: [
      {
        label: 'Metro Pictures',
        headline: 'STARRING JAMES HARRISON',
        body: '"THE MIDNIGHT EXPRESS"\n\nNOW SHOWING\nFri – Sun Matinees!\n\nGeneral Admission 75¢',
        colors: { bg: '#1a1a2e', fg: '#ffcc02', accent: '#e91e63' },
        adType: 'poster',
      },
      {
        label: 'Sunbeam Soda',
        headline: 'COOL OFF WITH SUNBEAM!',
        body: 'Cream soda • Orange\nRoot beer • Grape\n\nFive flavors of fizz!\nOnly 10 cents at\nany fountain.',
        colors: { bg: '#00bcd4', fg: '#ffffff', accent: '#ffeb3b' },
        adType: 'chrome_billboard',
      },
    ],
    awnings: [
      { x: -9, width: 3.5, depth: 1.2, color: '#ad1457', pattern: 'solid' },
      { x: -3, width: 3.5, depth: 1.2, color: '#4527a0', pattern: 'solid' },
      { x: 3, width: 3.5, depth: 1.2, color: '#ffffff', pattern: 'solid' },
      { x: 9, width: 3.5, depth: 1.2, color: '#c62828', pattern: 'stripes' },
    ],
    hangingSigns: [
      { x: -6, poleLength: 1.5, width: 1.2, height: 0.8, label: 'VINYL', colors: { bg: '#ede7f6', fg: '#4527a0', accent: '' }, signType: 'metal' },
      { x: 6, poleLength: 1.5, width: 1.2, height: 0.8, label: 'RX', colors: { bg: '#e8f5e9', fg: '#1b5e20', accent: '' }, signType: 'metal' },
    ],
    lighting: {
      interiorGlow: 0.35,
      emissiveIntensity: 0.5,
      warmTone: false,
      neonColors: [0xff6f00, 0xe91e63, 0x00bcd4],
    },
  },

  '1985': {
    shops: [
      {
        name: 'Neon Nights Arcade',
        tagline: 'Insert Coin — Play Hard',
        colors: { bg: '#0d0221', fg: '#00ffcc', accent: '#ff00ff' },
        signType: 'neon_tube',
        windowStyle: 'screen',
        awningColor: '#ff00ff',
        awningPattern: 'solid',
      },
      {
        name: 'Video Vision',
        tagline: 'Rent Last Night\'s Hits',
        colors: { bg: '#1a237e', fg: '#ffeb3b', accent: '#00e5ff' },
        signType: 'neon_tube',
        windowStyle: 'poster',
        awningColor: '#1a237e',
        awningPattern: 'checker',
      },
      {
        name: 'Tony\'s Pizza Palace',
        tagline: 'New York Style — Est. 1978',
        colors: { bg: '#b71c1c', fg: '#fffde7', accent: '#ffab00' },
        signType: 'neon_tube',
        windowStyle: 'display_case',
        awningColor: '#b71c1c',
        awningPattern: 'solid',
      },
      {
        name: 'Cassette Corner',
        tagline: 'Tapes • Walkmans • Accessories',
        colors: { bg: '#263238', fg: '#e0e0e0', accent: '#76ff03' },
        signType: 'neon_tube',
        windowStyle: 'shelf',
        awningColor: '#76ff03',
        awningPattern: 'solid',
      },
    ],
    ads: [
      {
        label: 'Blaze Cigarettes',
        headline: 'BLAZE — LIVE IT UP',
        body: 'Smooth taste.\nBold flavor.\n\nThe smoke signal\nof the eighties.\n\n[Warning: Smoking harms health]',
        colors: { bg: '#1a1a1a', fg: '#ff5722', accent: '#ffeb3b' },
        adType: 'neon_billboard',
      },
      {
        label: 'FizzPop Cola',
        headline: 'FIZZPOP — TASTE THE FUTURE!',
        body: 'New citrus blast\nflavor!\n\nGrab a six-pack\ntoday at your\nnearest mart.',
        colors: { bg: '#00695c', fg: '#ffffff', accent: '#e040fb' },
        adType: 'neon_billboard',
      },
    ],
    awnings: [
      { x: -9, width: 3.5, depth: 1.2, color: '#ff00ff', pattern: 'solid' },
      { x: -3, width: 3.5, depth: 1.2, color: '#1a237e', pattern: 'checker' },
      { x: 3, width: 3.5, depth: 1.2, color: '#b71c1c', pattern: 'solid' },
      { x: 9, width: 3.5, depth: 1.2, color: '#76ff03', pattern: 'solid' },
    ],
    hangingSigns: [
      { x: -6, poleLength: 1.5, width: 1.2, height: 0.8, label: 'GAME', colors: { bg: '#0d0221', fg: '#00ffcc', accent: '' }, signType: 'neon' },
      { x: 6, poleLength: 1.5, width: 1.2, height: 0.8, label: 'TAPE', colors: { bg: '#263238', fg: '#76ff03', accent: '' }, signType: 'neon' },
    ],
    lighting: {
      interiorGlow: 0.6,
      emissiveIntensity: 0.9,
      warmTone: false,
      neonColors: [0x00ffcc, 0xff00ff, 0xffeb3b, 0x00e5ff, 0x76ff03],
    },
  },

  '2005': {
    shops: [
      {
        name: 'NetCafe Express',
        tagline: 'High-Speed Internet • Print • Scan',
        colors: { bg: '#0d47a1', fg: '#ffffff', accent: '#00e676' },
        signType: 'backlit_box',
        windowStyle: 'screen',
        awningColor: '#0d47a1',
        awningPattern: 'solid',
      },
      {
        name: 'CellZone Mobile',
        tagline: 'Plans • Phones • Accessories',
        colors: { bg: '#1a237e', fg: '#e0e0e0', accent: '#00b0ff' },
        signType: 'backlit_box',
        windowStyle: 'display_case',
        awningColor: '#1a237e',
        awningPattern: 'solid',
      },
      {
        name: 'ReelDVD Rentals',
        tagline: 'New Releases • Classics • Blu-ray',
        colors: { bg: '#b71c1c', fg: '#ffffff', accent: '#ffc107' },
        signType: 'backlit_box',
        windowStyle: 'poster',
        awningColor: '#b71c1c',
        awningPattern: 'solid',
      },
      {
        name: 'QuickMart',
        tagline: 'Open 24 Hours • All Day Everyday',
        colors: { bg: '#1b5e20', fg: '#ffffff', accent: '#ff6f00' },
        signType: 'backlit_box',
        windowStyle: 'shelf',
        awningColor: '#1b5e20',
        awningPattern: 'solid',
      },
    ],
    ads: [
      {
        label: 'MegaSoft',
        headline: 'MEGASOFT — POWERING YOUR WORLD',
        body: 'Windows Vista™\nOffice 2007\nXbox 360 Games\n\nDownload today at\nwww.megasoft.com',
        colors: { bg: '#0d47a1', fg: '#ffffff', accent: '#e53935' },
        adType: 'printed_billboard',
      },
      {
        label: 'BuzzEnergy Drink',
        headline: 'BUZZ ENERGY — UNLEASH THE BEAST',
        body: 'Triple caffeine.\nZero sugar.\nAll attitude.\n\nAvailable in\nLime, Berry &\nElectric Blue.',
        colors: { bg: '#004d40', fg: '#76ff03', accent: '#ffea00' },
        adType: 'printed_billboard',
      },
    ],
    awnings: [
      { x: -9, width: 3.5, depth: 1.2, color: '#0d47a1', pattern: 'solid' },
      { x: -3, width: 3.5, depth: 1.2, color: '#1a237e', pattern: 'solid' },
      { x: 3, width: 3.5, depth: 1.2, color: '#b71c1c', pattern: 'solid' },
      { x: 9, width: 3.5, depth: 1.2, color: '#1b5e20', pattern: 'solid' },
    ],
    hangingSigns: [
      { x: -6, poleLength: 1.5, width: 1.2, height: 0.8, label: 'NET', colors: { bg: '#0d47a1', fg: '#ffffff', accent: '' }, signType: 'plastic' },
      { x: 6, poleLength: 1.5, width: 1.2, height: 0.8, label: 'DVD', colors: { bg: '#b71c1c', fg: '#ffffff', accent: '' }, signType: 'plastic' },
    ],
    lighting: {
      interiorGlow: 0.7,
      emissiveIntensity: 0.8,
      warmTone: false,
    },
  },

  '2025': {
    shops: [
      {
        name: 'GreenLeaf Organics',
        tagline: 'Plant-Based Café & Market',
        colors: { bg: '#1b5e20', fg: '#a5d6a7', accent: '#ffab00' },
        signType: 'led_screen',
        windowStyle: 'screen',
        awningColor: '#2e7d32',
        awningPattern: 'solid',
      },
      {
        name: 'ParcelPoint Pickup',
        tagline: 'Click • Collect • Go',
        colors: { bg: '#0d47a1', fg: '#bbdefb', accent: '#00e5ff' },
        signType: 'led_screen',
        windowStyle: 'screen',
        awningColor: '#0d47a1',
        awningPattern: 'solid',
      },
      {
        name: 'TechSync Mobile',
        tagline: 'Repair • Trade-In • 5G Plans',
        colors: { bg: '#212121', fg: '#e0e0e0', accent: '#7c4dff' },
        signType: 'led_screen',
        windowStyle: 'screen',
        awningColor: '#212121',
        awningPattern: 'solid',
      },
      {
        name: 'Aroma Roasters',
        tagline: 'Single-Origin Coffee • Pastries',
        colors: { bg: '#3e2723', fg: '#d7ccc8', accent: '#ff7043' },
        signType: 'led_screen',
        windowStyle: 'display_case',
        awningColor: '#3e2723',
        awningPattern: 'stripes',
      },
    ],
    ads: [
      {
        label: 'NovaPay',
        headline: 'NOVAPAY — PAY WITHOUT LIMITS',
        body: 'Contactless • Crypto • Cloud\n\nScan. Tap. Done.\nThe wallet of tomorrow.\nToday.',
        colors: { bg: '#000000', fg: '#00e5ff', accent: '#76ff03' },
        adType: 'led_wall',
      },
      {
        label: 'SkyDrive EV',
        headline: 'SKYDRIVE ELECTRIC VEHICLES',
        body: 'Range: 600 miles\nCharge: 15 minutes\nZero emissions\n\nBook your test drive\nat skydrive.auto',
        colors: { bg: '#0a0a0a', fg: '#ffffff', accent: '#00bcd4' },
        adType: 'led_wall',
      },
    ],
    awnings: [
      { x: -9, width: 3.5, depth: 1.2, color: '#2e7d32', pattern: 'solid' },
      { x: -3, width: 3.5, depth: 1.2, color: '#0d47a1', pattern: 'solid' },
      { x: 3, width: 3.5, depth: 1.2, color: '#212121', pattern: 'solid' },
      { x: 9, width: 3.5, depth: 1.2, color: '#3e2723', pattern: 'stripes' },
    ],
    hangingSigns: [
      { x: -6, poleLength: 1.5, width: 1.2, height: 0.8, label: 'ORGANIC', colors: { bg: '#1b5e20', fg: '#a5d6a7', accent: '' }, signType: 'digital' },
      { x: 6, poleLength: 1.5, width: 1.2, height: 0.8, label: '5G', colors: { bg: '#212121', fg: '#7c4dff', accent: '' }, signType: 'digital' },
    ],
    lighting: {
      interiorGlow: 1.0,
      emissiveIntensity: 1.0,
      warmTone: false,
    },
  },
};

// ─── Texture generators ──────────────────────────────────────────────────────

/** Draw a hand-painted / vintage sign on canvas. */
function drawVintageSign(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  entry: ShopEntry,
): void {
  const { colors, name, tagline, signType } = entry;

  // Background
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, w, h);

  // Border
  ctx.strokeStyle = colors.accent || colors.fg;
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, w - 12, h - 12);

  // Inner decorative border for parchment style
  if (signType === 'parchment') {
    ctx.strokeStyle = `${colors.accent || colors.fg}44`;
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, w - 24, h - 24);
  }

  // Name (top line, larger)
  ctx.fillStyle = colors.fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontSize = Math.round(h * 0.32);
  ctx.font = `bold ${fontSize}px Georgia, serif`;
  wrapText(ctx, name, w / 2, h * 0.35, w - 20, fontSize * 1.2);

  // Tagline (bottom line, smaller)
  const tagFontSize = Math.round(h * 0.14);
  ctx.font = `italic ${tagFontSize}px Georgia, serif`;
  ctx.fillStyle = colors.accent || colors.fg;
  wrapText(ctx, tagline, w / 2, h * 0.7, w - 20, tagFontSize * 1.2);

  // Decorative flourishes
  ctx.strokeStyle = colors.accent || colors.fg;
  ctx.lineWidth = 2;
  const flourH = h * 0.05;
  ctx.beginPath();
  ctx.moveTo(w * 0.2, h * 0.5);
  ctx.quadraticCurveTo(w * 0.35, h * 0.5 - flourH, w * 0.5, h * 0.5);
  ctx.quadraticCurveTo(w * 0.65, h * 0.5 + flourH, w * 0.8, h * 0.5);
  ctx.stroke();
}

/** Draw a chalkboard-style sign. */
function drawChalkboardSign(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  entry: ShopEntry,
): void {
  // Frame
  ctx.fillStyle = '#5d4037';
  ctx.fillRect(0, 0, w, h);

  // Board
  ctx.fillStyle = '#263238';
  ctx.fillRect(8, 8, w - 16, h - 16);

  // Chalk dust effect
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, Math.random() * 10 + 2, Math.random() * 3 + 1);
  }

  // Name
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontSize = Math.round(h * 0.3);
  ctx.font = `bold ${fontSize}px "Courier New", monospace`;
  wrapText(ctx, entry.name, w / 2, h * 0.35, w - 24, fontSize * 1.2);

  // Tagline
  const tagFontSize = Math.round(h * 0.13);
  ctx.font = `${tagFontSize}px "Courier New", monospace`;
  ctx.fillStyle = '#bdbdbd';
  wrapText(ctx, entry.tagline, w / 2, h * 0.7, w - 24, tagFontSize * 1.3);
}

/** Draw an enamel / metal sign. */
function drawEnamelSign(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  entry: ShopEntry,
): void {
  // Rounded rect background
  const r = 12;
  ctx.fillStyle = entry.colors.bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, r);
  ctx.fill();

  // Border
  ctx.strokeStyle = entry.colors.fg;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(3, 3, w - 6, h - 6, r - 2);
  ctx.stroke();

  // Glossy highlight
  const grad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
  grad.addColorStop(0, 'rgba(255,255,255,0.25)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(6, 6, w - 12, h * 0.4, r - 4);
  ctx.fill();

  // Name
  ctx.fillStyle = entry.colors.fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontSize = Math.round(h * 0.3);
  ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
  wrapText(ctx, entry.name, w / 2, h * 0.35, w - 20, fontSize * 1.2);

  // Tagline
  const tagFontSize = Math.round(h * 0.12);
  ctx.font = `${tagFontSize}px Arial, sans-serif`;
  ctx.fillStyle = entry.colors.accent || entry.colors.fg;
  wrapText(ctx, entry.tagline, w / 2, h * 0.7, w - 20, tagFontSize * 1.3);
}

/** Draw a chrome-style diner sign. */
function drawChromeSign(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  entry: ShopEntry,
): void {
  // Chrome gradient background
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#c0c0c0');
  grad.addColorStop(0.3, '#e8e8e8');
  grad.addColorStop(0.5, '#ffffff');
  grad.addColorStop(0.7, '#d0d0d0');
  grad.addColorStop(1, '#a0a0a0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Colored border
  ctx.strokeStyle = entry.colors.accent || '#ff6f00';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  // Name with outline
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontSize = Math.round(h * 0.3);
  ctx.font = `bold ${fontSize}px "Arial Black", Arial, sans-serif`;

  // Outline
  ctx.strokeStyle = entry.colors.fg;
  ctx.lineWidth = 3;
  ctx.strokeText(entry.name, w / 2, h * 0.38);

  // Fill
  ctx.fillStyle = entry.colors.fg;
  ctx.fillText(entry.name, w / 2, h * 0.38);

  // Tagline
  const tagFontSize = Math.round(h * 0.12);
  ctx.font = `italic ${tagFontSize}px "Arial", sans-serif`;
  ctx.strokeStyle = entry.colors.accent || '#000';
  ctx.lineWidth = 2;
  ctx.strokeText(entry.tagline, w / 2, h * 0.72);
  ctx.fillStyle = entry.colors.accent || entry.colors.fg;
  ctx.fillText(entry.tagline, w / 2, h * 0.72);
}

/** Draw a neon-tube sign. */
function drawNeonSign(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  entry: ShopEntry,
): void {
  // Dark background
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, w, h);

  // Outer glow rectangle
  ctx.shadowColor = entry.colors.accent || '#00ffcc';
  ctx.shadowBlur = 15;
  ctx.strokeStyle = entry.colors.accent || '#00ffcc';
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.shadowBlur = 0;

  // Name in neon tube style
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontSize = Math.round(h * 0.32);
  ctx.font = `bold ${fontSize}px "Arial Black", sans-serif`;

  ctx.shadowColor = entry.colors.fg;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = entry.colors.fg;
  ctx.lineWidth = 2;
  ctx.strokeText(entry.name, w / 2, h * 0.38);
  ctx.fillStyle = entry.colors.fg;
  ctx.globalAlpha = 0.3;
  ctx.fillText(entry.name, w / 2, h * 0.38);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // Tagline
  const tagFontSize = Math.round(h * 0.13);
  ctx.font = `${tagFontSize}px "Arial", sans-serif`;
  ctx.shadowColor = entry.colors.accent;
  ctx.shadowBlur = 8;
  ctx.fillStyle = entry.colors.accent || '#fff';
  ctx.fillText(entry.tagline, w / 2, h * 0.7);
  ctx.shadowBlur = 0;
}

/** Draw a backlit plastic sign box. */
function drawBacklitBox(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  entry: ShopEntry,
): void {
  // Box frame
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, w, h);

  // Backlit panel
  const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.6, entry.colors.bg);
  grad.addColorStop(1, shadeColor(entry.colors.bg, -30));
  ctx.fillStyle = grad;
  ctx.fillRect(6, 6, w - 12, h - 12);

  // Name
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontSize = Math.round(h * 0.32);
  ctx.font = `bold ${fontSize}px "Arial", sans-serif`;
  ctx.fillStyle = entry.colors.fg;
  ctx.shadowColor = entry.colors.accent || entry.colors.fg;
  ctx.shadowBlur = 6;
  ctx.fillText(entry.name, w / 2, h * 0.38);
  ctx.shadowBlur = 0;

  // Tagline
  const tagFontSize = Math.round(h * 0.12);
  ctx.font = `${tagFontSize}px "Arial", sans-serif`;
  ctx.fillStyle = entry.colors.accent || '#aaa';
  ctx.fillText(entry.tagline, w / 2, h * 0.7);
}

/** Draw an LED screen sign. */
function drawLEDSign(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  entry: ShopEntry,
): void {
  // Dark pixelated background
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, w, h);

  // Pixel grid overlay
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  for (let x = 0; x < w; x += 4) {
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // Name with strong glow
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontSize = Math.round(h * 0.3);
  ctx.font = `bold ${fontSize}px "Arial", sans-serif`;

  ctx.shadowColor = entry.colors.fg;
  ctx.shadowBlur = 10;
  ctx.fillStyle = entry.colors.fg;
  ctx.fillText(entry.name, w / 2, h * 0.38);
  ctx.shadowBlur = 0;

  // Tagline
  const tagFontSize = Math.round(h * 0.13);
  ctx.font = `${tagFontSize}px "Arial", sans-serif`;
  ctx.shadowColor = entry.colors.accent;
  ctx.shadowBlur = 6;
  ctx.fillStyle = entry.colors.accent || '#aaa';
  ctx.fillText(entry.tagline, w / 2, h * 0.7);
  ctx.shadowBlur = 0;
}

/** Draw an awning. */
function drawAwningTexture(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
  pattern: 'solid' | 'stripes' | 'checker',
): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);

  if (pattern === 'stripes') {
    const stripeW = w / 8;
    for (let i = 0; i < 8; i += 2) {
      ctx.fillStyle = shadeColor(color, i % 2 === 0 ? 30 : -20);
      ctx.fillRect(i * stripeW, 0, stripeW, h);
    }
  } else if (pattern === 'checker') {
    const sq = w / 8;
    for (let row = 0; row < Math.ceil(h / sq); row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 0) {
          ctx.fillStyle = shadeColor(color, 25);
          ctx.fillRect(col * sq, row * sq, sq, sq);
        }
      }
    }
  }

  // Scalloped bottom edge
  const scallopR = w / 16;
  ctx.fillStyle = shadeColor(color, -15);
  for (let x = scallopR; x < w; x += scallopR * 2) {
    ctx.beginPath();
    ctx.arc(x, h, scallopR, 0, Math.PI);
    ctx.fill();
  }
}

/** Draw a hanging sign. */
function drawHangingSign(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  entry: HangingSignEntry,
): void {
  const { colors, label, signType } = entry;

  // Pole
  ctx.fillStyle = '#888';
  ctx.fillRect(w / 2 - 2, 0, 4, h * 0.15);

  // Sign body
  ctx.fillStyle = colors.bg;
  ctx.fillRect(4, h * 0.15, w - 8, h * 0.85);

  // Border
  ctx.strokeStyle = colors.accent || colors.fg;
  ctx.lineWidth = 2;
  ctx.strokeRect(4, h * 0.15, w - 8, h * 0.85);

  // Label text
  ctx.fillStyle = colors.fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontSize = Math.round(h * 0.4);
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;

  if (signType === 'neon') {
    ctx.shadowColor = colors.fg;
    ctx.shadowBlur = 10;
  }
  ctx.fillText(label, w / 2, h * 0.58);
  ctx.shadowBlur = 0;
}

/** Draw a poster-style ad. */
function drawPosterAd(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  entry: AdEntry,
): void {
  const { colors, headline, body, label } = entry;

  // Background
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, w, h);

  // Border
  ctx.strokeStyle = colors.accent || colors.fg;
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  // Brand label at top
  ctx.fillStyle = colors.accent || colors.fg;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const brandSize = Math.round(h * 0.06);
  ctx.font = `bold ${brandSize}px Arial, sans-serif`;
  ctx.fillText(`— ${label} —`, 20, 16);

  // Headline
  ctx.fillStyle = colors.fg;
  const headSize = Math.round(h * 0.09);
  ctx.font = `bold ${headSize}px "Arial Black", sans-serif`;
  ctx.textAlign = 'center';
  wrapText(ctx, headline, w / 2, h * 0.22, w - 40, headSize * 1.15);

  // Body text
  ctx.fillStyle = colors.fg;
  const bodySize = Math.round(h * 0.045);
  ctx.font = `${bodySize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  wrapText(ctx, body, w / 2, h * 0.52, w - 40, bodySize * 1.4);

  // Bottom decorative bar
  ctx.fillStyle = colors.accent || colors.fg;
  ctx.fillRect(20, h - 30, w - 40, 4);
}

/** Draw a neon billboard. */
function drawNeonBillboard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  entry: AdEntry,
): void {
  const { colors, headline, body, label } = entry;

  // Dark background
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, w, h);

  // Frame
  ctx.strokeStyle = colors.accent || '#ff5722';
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, w - 12, h - 12);

  // Brand
  ctx.fillStyle = colors.accent || '#ff5722';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const brandSize = Math.round(h * 0.05);
  ctx.font = `bold ${brandSize}px Arial, sans-serif`;
  ctx.shadowColor = colors.accent;
  ctx.shadowBlur = 8;
  ctx.fillText(label.toUpperCase(), w / 2, 16);
  ctx.shadowBlur = 0;

  // Headline in neon style
  const headSize = Math.round(h * 0.12);
  ctx.font = `bold ${headSize}px "Arial Black", sans-serif`;
  ctx.shadowColor = colors.fg;
  ctx.shadowBlur = 15;
  ctx.strokeStyle = colors.fg;
  ctx.lineWidth = 2;
  ctx.strokeText(headline, w / 2, h * 0.22);
  ctx.fillStyle = colors.fg;
  ctx.globalAlpha = 0.4;
  ctx.fillText(headline, w / 2, h * 0.22);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // Body
  ctx.fillStyle = '#cccccc';
  const bodySize = Math.round(h * 0.04);
  ctx.font = `${bodySize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  wrapText(ctx, body, w / 2, h * 0.5, w - 40, bodySize * 1.4);
}

/** Draw a chrome billboard. */
function drawChromeBillboard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  entry: AdEntry,
): void {
  const { colors, headline, body, label } = entry;

  // Chrome gradient frame
  const frameGrad = ctx.createLinearGradient(0, 0, w, h);
  frameGrad.addColorStop(0, '#888');
  frameGrad.addColorStop(0.5, '#ddd');
  frameGrad.addColorStop(1, '#888');
  ctx.fillStyle = frameGrad;
  ctx.fillRect(0, 0, w, h);

  // Inner panel
  ctx.fillStyle = colors.bg;
  ctx.fillRect(12, 12, w - 24, h - 24);

  // Brand
  ctx.fillStyle = colors.accent || colors.fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const brandSize = Math.round(h * 0.05);
  ctx.font = `bold ${brandSize}px Arial, sans-serif`;
  ctx.fillText(label.toUpperCase(), w / 2, 20);

  // Headline
  const headSize = Math.round(h * 0.1);
  ctx.fillStyle = colors.fg;
  ctx.font = `bold ${headSize}px "Arial Black", sans-serif`;
  ctx.textAlign = 'center';
  wrapText(ctx, headline, w / 2, h * 0.18, w - 40, headSize * 1.15);

  // Body
  ctx.fillStyle = colors.fg;
  const bodySize = Math.round(h * 0.04);
  ctx.font = `${bodySize}px Arial, sans-serif`;
  wrapText(ctx, body, w / 2, h * 0.48, w - 40, bodySize * 1.4);
}

/** Draw a printed billboard. */
function drawPrintedBillboard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  entry: AdEntry,
): void {
  const { colors, headline, body, label } = entry;

  // Background
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle texture
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.02})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, Math.random() * 20 + 5, Math.random() * 2 + 1);
  }

  // Top brand bar
  ctx.fillStyle = colors.accent || colors.fg;
  ctx.fillRect(0, 0, w, h * 0.08);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const brandSize = Math.round(h * 0.05);
  ctx.font = `bold ${brandSize}px Arial, sans-serif`;
  ctx.fillText(label.toUpperCase(), w / 2, h * 0.04);

  // Headline
  const headSize = Math.round(h * 0.1);
  ctx.fillStyle = colors.fg;
  ctx.font = `bold ${headSize}px "Arial Black", sans-serif`;
  ctx.textAlign = 'center';
  wrapText(ctx, headline, w / 2, h * 0.22, w - 40, headSize * 1.15);

  // Body
  ctx.fillStyle = colors.fg;
  const bodySize = Math.round(h * 0.04);
  ctx.font = `${bodySize}px Arial, sans-serif`;
  wrapText(ctx, body, w / 2, h * 0.5, w - 40, bodySize * 1.4);

  // Bottom bar
  ctx.fillStyle = colors.accent || colors.fg;
  ctx.fillRect(0, h - h * 0.06, w, h * 0.06);
}

/** Draw an LED wall / digital billboard. */
function drawLEDWall(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  entry: AdEntry,
  time?: number,
): void {
  const { colors, headline, body, label } = entry;

  // Deep black background
  ctx.fillStyle = '#030303';
  ctx.fillRect(0, 0, w, h);

  // Pixel grid
  ctx.fillStyle = 'rgba(255,255,255,0.015)';
  for (let x = 0; x < w; x += 6) {
    for (let y = 0; y < h; y += 6) {
      ctx.fillRect(x, y, 3, 3);
    }
  }

  // Scanline effect
  if (time !== undefined) {
    const scanY = ((time * 120) % h);
    const scanGrad = ctx.createLinearGradient(0, scanY - 20, 0, scanY + 20);
    scanGrad.addColorStop(0, 'rgba(255,255,255,0)');
    scanGrad.addColorStop(0.5, 'rgba(255,255,255,0.03)');
    scanGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = scanGrad;
    ctx.fillRect(0, scanY - 20, w, 40);
  }

  // Brand
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const brandSize = Math.round(h * 0.05);
  ctx.font = `bold ${brandSize}px "Consolas", monospace`;
  ctx.shadowColor = colors.accent;
  ctx.shadowBlur = 8;
  ctx.fillStyle = colors.accent || '#00e5ff';
  ctx.fillText(label.toUpperCase(), w / 2, 14);
  ctx.shadowBlur = 0;

  // Headline
  const headSize = Math.round(h * 0.09);
  ctx.font = `bold ${headSize}px "Arial", sans-serif`;
  ctx.shadowColor = colors.fg;
  ctx.shadowBlur = 12;
  ctx.fillStyle = colors.fg;
  ctx.fillText(headline, w / 2, h * 0.16);
  ctx.shadowBlur = 0;

  // Divider line
  ctx.strokeStyle = colors.accent || '#00e5ff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w * 0.2, h * 0.32);
  ctx.lineTo(w * 0.8, h * 0.32);
  ctx.stroke();

  // Body
  ctx.fillStyle = '#cccccc';
  const bodySize = Math.round(h * 0.038);
  ctx.font = `${bodySize}px "Consolas", monospace`;
  ctx.textAlign = 'center';
  wrapText(ctx, body, w / 2, h * 0.42, w - 40, bodySize * 1.5);

  // Blinking cursor effect
  if (time !== undefined && Math.sin(time * 3) > 0) {
    ctx.fillStyle = colors.accent || '#00e5ff';
    ctx.fillRect(w * 0.75, h * 0.82, 3, bodySize * 1.2);
  }
}

/** Dynamic animated LED billboard for 2025. */
function createAnimatedLEDBillboard(
  w: number,
  h: number,
  entries: AdEntry[],
): CanvasTextureWithUpdate {
  let frame = 0;
  const totalFrames = entries.length * 3; // 3 seconds per ad at 60fps

  return makeDynamicTexture(w, h, (ctx, time) => {
    frame = Math.floor(((time || 0) * 0.5) % totalFrames);
    const adIdx = Math.floor(frame / 3);
    const ad = entries[adIdx] || entries[0];
    drawLEDWall(ctx, w, h, ad, time);

    // Transition flash between ads
    const phaseInFrame = frame % 3;
    if (phaseInFrame === 0 && frame > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(0, 0, w, h);
    }
  });
}

/** Dynamic animated digital screen for shop windows. */
function createAnimatedShopScreen(
  w: number,
  h: number,
  entry: ShopEntry,
): CanvasTextureWithUpdate {
  const frames = [
    // Frame 0: Main ad
    (ctx: CanvasRenderingContext2D, time: number) => {
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = entry.colors.fg;
      ctx.font = `bold ${h * 0.25}px Arial, sans-serif`;
      ctx.shadowColor = entry.colors.fg;
      ctx.shadowBlur = 8;
      ctx.fillText(entry.name, w / 2, h * 0.35);
      ctx.shadowBlur = 0;
      ctx.fillStyle = entry.colors.accent || '#aaa';
      ctx.font = `${h * 0.1}px Arial, sans-serif`;
      ctx.fillText(entry.tagline, w / 2, h * 0.6);
      // Scrolling ticker at bottom
      const tickerY = h * 0.85;
      ctx.fillStyle = entry.colors.accent || '#76ff03';
      ctx.font = `${h * 0.08}px Consolas, monospace`;
      const scrollOffset = (time * 80) % (w * 2);
      ctx.fillText(`★ OPEN NOW ★ FREE WI-FI ★ NEW ARRIVALS ★  ★ OPEN NOW ★ FREE WI-FI ★ NEW ARRIVALS ★  `, -scrollOffset, tickerY);
    },
    // Frame 1: Product showcase
    (ctx: CanvasRenderingContext2D, time: number) => {
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, w, h);
      // Grid of colored rectangles (product placeholders)
      const cols = 3, rows = 2;
      const cellW = w / cols;
      const cellH = h * 0.55;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const hue = (r * cols + c + Math.floor(time * 2)) * 60;
          ctx.fillStyle = `hsl(${hue}, 70%, 40%)`;
          ctx.fillRect(c * cellW + 4, r * cellH + 4, cellW - 8, cellH - 8);
        }
      }
      ctx.fillStyle = entry.colors.fg;
      ctx.font = `bold ${h * 0.12}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('FEATURED ITEMS', w / 2, h * 0.75);
    },
    // Frame 2: Special offer
    (ctx: CanvasRenderingContext2D, time: number) => {
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, w, h);
      // Pulsing circle
      const pulse = 0.5 + 0.5 * Math.sin(time * 4);
      ctx.fillStyle = `rgba(${hexToRgb(entry.colors.accent || '#ff7043')},${0.1 + pulse * 0.2})`;
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.4, w * 0.3 * (0.8 + pulse * 0.2), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = entry.colors.fg;
      ctx.font = `bold ${h * 0.2}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SPECIAL', w / 2, h * 0.35);
      ctx.font = `bold ${h * 0.15}px Arial, sans-serif`;
      ctx.fillStyle = entry.colors.accent || '#ff7043';
      ctx.fillText('OFFER', w / 2, h * 0.55);
      ctx.font = `${h * 0.08}px Arial, sans-serif`;
      ctx.fillStyle = '#aaa';
      ctx.fillText('Ask inside for details', w / 2, h * 0.75);
    },
  ];

  return makeDynamicTexture(w, h, (ctx, time) => {
    const t = time || 0;
    const idx = Math.floor((t * 0.67) % frames.length); // ~3 sec per frame
    frames[idx](ctx, t);
  });
}

// ─── Mesh builders ───────────────────────────────────────────────────────────

/** Build a shop front mesh with sign, window, and awning. */
function buildShopFront(
  entry: ShopEntry,
  x: number,
  width: number,
  index: number,
): { meshes: NamedMesh[]; animatedScreens?: AnimatedScreen[] } {
  const meshes: NamedMesh[] = [];
  const result: { meshes: NamedMesh[]; animatedScreens?: AnimatedScreen[] } = { meshes };

  const signW = Math.round(width * 0.9);
  const signH = Math.round(signW * 0.38);

  // ── Sign board ──
  let signTex: THREE.CanvasTexture;
  switch (entry.signType) {
    case 'parchment':
      signTex = makeCanvasTexture(signW, signH, (ctx) => drawVintageSign(ctx, signW, signH, entry));
      break;
    case 'chalkboard':
      signTex = makeCanvasTexture(signW, signH, (ctx) => drawChalkboardSign(ctx, signW, signH, entry));
      break;
    case 'enamel':
      signTex = makeCanvasTexture(signW, signH, (ctx) => drawEnamelSign(ctx, signW, signH, entry));
      break;
    case 'chrome':
      signTex = makeCanvasTexture(signW, signH, (ctx) => drawChromeSign(ctx, signW, signH, entry));
      break;
    case 'neon_tube':
      signTex = makeCanvasTexture(signW, signH, (ctx) => drawNeonSign(ctx, signW, signH, entry));
      break;
    case 'backlit_box':
      signTex = makeCanvasTexture(signW, signH, (ctx) => drawBacklitBox(ctx, signW, signH, entry));
      break;
    case 'led_screen':
      signTex = makeCanvasTexture(signW, signH, (ctx) => drawLEDSign(ctx, signW, signH, entry));
      break;
    default:
      signTex = makeCanvasTexture(signW, signH, (ctx) => drawVintageSign(ctx, signW, signH, entry));
  }

  const signMat = new THREE.MeshStandardMaterial({
    map: signTex,
    emissive: new THREE.Color(entry.colors.accent || entry.colors.fg),
    emissiveMap: signTex,
    emissiveIntensity: 0,
    roughness: 0.5,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });

  const signGeo = new THREE.PlaneGeometry(signW * 0.3, signH * 0.3);
  const signMesh = new THREE.Mesh(signGeo, signMat);
  signMesh.position.set(x, SIGN_OFFSET_Y, BUILDING_Z + 0.15);
  signMesh.name = `sign_${index}`;
  meshes.push({
    name: `sign_${index}`,
    mesh: signMesh,
    material: signMat,
    emissiveTarget: 0.5,
    opacityTarget: 1,
    currentOpacity: 0,
  });

  // ── Door ──
  const doorW = width * 0.2;
  const doorH = 2.2;
  const doorGeo = new THREE.PlaneGeometry(doorW, doorH);
  const doorMat = new THREE.MeshStandardMaterial({
    color: shadeColor(entry.colors.bg, -40),
    roughness: 0.7,
    metalness: 0.1,
  });
  const doorMesh = new THREE.Mesh(doorGeo, doorMat);
  doorMesh.position.set(x, doorH / 2, BUILDING_Z + 0.05);
  doorMesh.name = `door_${index}`;
  meshes.push({
    name: `door_${index}`,
    mesh: doorMesh,
    material: doorMat,
    emissiveTarget: 0,
    opacityTarget: 1,
    currentOpacity: 1,
  });

  // ── Door handle ──
  const handleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.25, 8);
  const handleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 });
  const handleMesh = new THREE.Mesh(handleGeo, handleMat);
  handleMesh.rotation.z = Math.PI / 2;
  handleMesh.position.set(x + doorW * 0.3, 1.1, BUILDING_Z + 0.08);
  handleMesh.name = `handle_${index}`;
  meshes.push({
    name: `handle_${index}`,
    mesh: handleMesh,
    material: handleMat,
    emissiveTarget: 0,
    opacityTarget: 1,
    currentOpacity: 1,
  });

  // ── Window ──
  const winW = width * 0.5;
  const winH = 1.6;
  const winGeo = new THREE.PlaneGeometry(winW, winH);

  let windowMat: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
  if (entry.windowStyle === 'screen') {
    // Animated screen for 2025 shops
    const dynTex = createAnimatedShopScreen(winW * 2, winH * 2, entry);
    windowMat = new THREE.MeshBasicMaterial({ map: dynTex.texture, transparent: true });
    const animScreen: AnimatedScreen = {
      drawFn: dynTex.draw,
      mesh: signMesh, // reference kept for cleanup
      material: windowMat,
      texture: dynTex.texture,
      frameIndex: 0,
    };
    if (!result.animatedScreens) result.animatedScreens = [];
    result.animatedScreens.push(animScreen);

    // Also update the sign to use the same dynamic texture approach
    const dynSignTex = createAnimatedShopScreen(signW * 2, signH * 2, entry);
    (signMat as any).map = dynSignTex.texture;
    (signMat as any).emissiveMap = dynSignTex.texture;
    signMat.emissiveIntensity = 0;
    signMat.needsUpdate = true;

    const animSign: AnimatedScreen = {
      drawFn: dynSignTex.draw,
      mesh: signMesh,
      material: signMat as any,
      texture: dynSignTex.texture,
      frameIndex: 0,
    };
    result.animatedScreens.push(animSign);
  } else {
    const winTex = makeCanvasTexture(winW * 2, winH * 2, (ctx) => {
      // Interior glow behind glass
      ctx.fillStyle = entry.colors.bg;
      ctx.fillRect(0, 0, winW * 2, winH * 2);

      if (entry.windowStyle === 'display_case') {
        // Shelves with items
        for (let s = 0; s < 3; s++) {
          const sy = winH * 0.2 + s * winH * 0.3;
          ctx.fillStyle = '#888';
          ctx.fillRect(10, sy, winW * 2 - 20, 4);
          for (let i = 0; i < 6; i++) {
            ctx.fillStyle = ['#c62828', '#1565c0', '#2e7d32', '#f57f17', '#6a1b9a', '#00838f'][i];
            ctx.fillRect(20 + i * (winW * 2 - 40) / 6, sy - winH * 0.12, (winW * 2 - 40) / 6 - 6, winH * 0.12);
          }
        }
      } else if (entry.windowStyle === 'poster') {
        // Movie / event poster
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(winW * 0.15, winH * 0.1, winW * 0.7, winH * 0.75);
        ctx.fillStyle = entry.colors.accent || '#ff6f00';
        ctx.font = `bold ${winH * 0.15}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(entry.name, winW, winH * 0.45);
        ctx.fillStyle = '#ccc';
        ctx.font = `${winH * 0.08}px Arial, sans-serif`;
        ctx.fillText(entry.tagline, winW, winH * 0.6);
      } else if (entry.windowStyle === 'shelf') {
        // Merchandise shelves
        for (let s = 0; s < 4; s++) {
          const sy = winH * 0.15 + s * winH * 0.22;
          ctx.fillStyle = '#6d4c41';
          ctx.fillRect(10, sy, winW * 2 - 20, 6);
          for (let i = 0; i < 8; i++) {
            const hue = (i * 45 + s * 30) % 360;
            ctx.fillStyle = `hsl(${hue}, 50%, 40%)`;
            ctx.fillRect(15 + i * (winW * 2 - 30) / 8, sy - winH * 0.15, (winW * 2 - 30) / 8 - 4, winH * 0.15);
          }
        }
      } else {
        // Curtain backdrop
        ctx.fillStyle = entry.colors.bg;
        ctx.fillRect(0, 0, winW * 2, winH * 2);
        // Draped curtain lines
        ctx.strokeStyle = shadeColor(entry.colors.bg, -20);
        ctx.lineWidth = 3;
        for (let c = 0; c < 6; c++) {
          const cx = (c / 5) * winW * 2;
          ctx.beginPath();
          ctx.moveTo(cx, 0);
          ctx.quadraticCurveTo(cx + 10, winH, cx - 5, winH * 2);
          ctx.stroke();
        }
      }
    });
    windowMat = new THREE.MeshStandardMaterial({
      map: winTex,
      emissive: new THREE.Color(entry.colors.accent || entry.colors.bg),
      emissiveIntensity: 0,
      roughness: 0.3,
      metalness: 0.0,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
  }

  const windowMesh = new THREE.Mesh(winGeo, windowMat);
  windowMesh.position.set(x, WINDOW_OFFSET_Y, BUILDING_Z + 0.05);
  windowMesh.name = `window_${index}`;
  meshes.push({
    name: `window_${index}`,
    mesh: windowMesh,
    material: windowMat,
    emissiveTarget: 0.4,
    opacityTarget: 0.85,
    currentOpacity: 0.85,
  });

  // ── Awning ──
  const awningTex = makeCanvasTexture(Math.round(width * 3), Math.round(width * 0.5), (ctx) =>
    drawAwningTexture(ctx, Math.round(width * 3), Math.round(width * 0.5), entry.awningColor, entry.awningPattern),
  );
  const awningMat = new THREE.MeshStandardMaterial({
    map: awningTex,
    roughness: 0.8,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const awningGeo = new THREE.PlaneGeometry(width * 1.1, width * 0.35);
  const awningMesh = new THREE.Mesh(awningGeo, awningMat);
  awningMesh.position.set(x, SIGN_OFFSET_Y + signH * 0.15, BUILDING_Z + 0.8);
  awningMesh.rotation.x = -0.3;
  awningMesh.name = `awning_${index}`;
  meshes.push({
    name: `awning_${index}`,
    mesh: awningMesh,
    material: awningMat,
    emissiveTarget: 0,
    opacityTarget: 1,
    currentOpacity: 1,
  });

  return result;
}

/** Build a hanging sign. */
function buildHangingSign(
  entry: HangingSignEntry,
  x: number,
): NamedMesh[] {
  const meshes: NamedMesh[] = [];
  const sw = Math.round(entry.width * 40);
  const sh = Math.round(entry.height * 40);

  const tex = makeCanvasTexture(sw, sh, (ctx) => drawHangingSign(ctx, sw, sh, entry));
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissive: new THREE.Color(entry.colors.accent || entry.colors.fg),
    emissiveMap: tex,
    emissiveIntensity: 0,
    roughness: 0.5,
    metalness: 0.2,
    side: THREE.DoubleSide,
  });

  const geo = new THREE.PlaneGeometry(entry.width * 0.4, entry.height * 0.4);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, SIGN_OFFSET_Y + 0.5, BUILDING_Z + 0.15);
  mesh.name = `hanging_sign_${x.toFixed(1)}`;
  meshes.push({
    name: mesh.name,
    mesh,
    material: mat,
    emissiveTarget: 0.5,
    opacityTarget: 1,
    currentOpacity: 0,
  });

  return meshes;
}

/** Build a large-format advertisement / billboard. */
function buildBillboard(
  entry: AdEntry,
  x: number,
  width: number,
  height: number,
  index: number,
  animated: boolean,
): { meshes: NamedMesh[]; animatedScreens?: AnimatedScreen[] } {
  const meshes: NamedMesh[] = [];
  const result: { meshes: NamedMesh[]; animatedScreens?: AnimatedScreen[] } = { meshes };

  const tw = Math.round(width * 40);
  const th = Math.round(height * 40);

  let tex: THREE.CanvasTexture;
  let baseMat: THREE.MeshStandardMaterial;

  if (animated && entry.adType === 'led_wall') {
    // For 2025 LED walls, use dynamic texture
    const dynTex = createAnimatedLEDBillboard(tw, th, [entry]);
    tex = dynTex.texture;
    baseMat = new THREE.MeshBasicMaterial({ map: tex });

    const animScreen: AnimatedScreen = {
      drawFn: dynTex.draw,
      mesh: {} as any,
      material: baseMat,
      texture: tex,
      frameIndex: 0,
    };
    if (!result.animatedScreens) result.animatedScreens = [];
    result.animatedScreens.push(animScreen);
  } else {
    switch (entry.adType) {
      case 'hand_painted':
        tex = makeCanvasTexture(tw, th, (ctx) => drawPosterAd(ctx, tw, th, entry));
        break;
      case 'poster':
        tex = makeCanvasTexture(tw, th, (ctx) => drawPosterAd(ctx, tw, th, entry));
        break;
      case 'chrome_billboard':
        tex = makeCanvasTexture(tw, th, (ctx) => drawChromeBillboard(ctx, tw, th, entry));
        break;
      case 'neon_billboard':
        tex = makeCanvasTexture(tw, th, (ctx) => drawNeonBillboard(ctx, tw, th, entry));
        break;
      case 'printed_billboard':
        tex = makeCanvasTexture(tw, th, (ctx) => drawPrintedBillboard(ctx, tw, th, entry));
        break;
      case 'digital_screen':
        tex = makeCanvasTexture(tw, th, (ctx) => drawLEDWall(ctx, tw, th, entry));
        break;
      case 'led_wall':
        tex = makeCanvasTexture(tw, th, (ctx) => drawLEDWall(ctx, tw, th, entry));
        break;
      default:
        tex = makeCanvasTexture(tw, th, (ctx) => drawPosterAd(ctx, tw, th, entry));
    }
    baseMat = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: new THREE.Color(entry.colors.accent || entry.colors.fg),
      emissiveMap: tex,
      emissiveIntensity: 0,
      roughness: 0.4,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
  }

  const geo = new THREE.PlaneGeometry(width * 0.5, height * 0.5);
  const mesh = new THREE.Mesh(geo, baseMat);
  mesh.position.set(x, BILLBOARD_HEIGHT * 0.5, BUILDING_Z - 3);
  mesh.name = `billboard_${index}`;
  meshes.push({
    name: mesh.name,
    mesh,
    material: baseMat,
    emissiveTarget: 0.6,
    opacityTarget: 1,
    currentOpacity: 0,
  });

  // Billboard support poles
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, height * 0.5, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.7, roughness: 0.3 });
  [-1, 1].forEach((side) => {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x + side * width * 0.22, height * 0.25, BUILDING_Z - 3);
    pole.name = `pole_${index}_${side}`;
    meshes.push({
      name: pole.name,
      mesh: pole,
      material: poleMat,
      emissiveTarget: 0,
      opacityTarget: 1,
      currentOpacity: 1,
    });
  });

  return result;
}

// ─── Color helpers ───────────────────────────────────────────────────────────

function shadeColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + percent));
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}

function hexToRgb(hex: string): string {
  const num = parseInt(hex.replace('#', ''), 16);
  return `${(num >> 16) & 255},${(num >> 8) & 255},${num & 255}`;
}

/** Word-wrap text on canvas. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const words = text.split(/\s+/);
  let line = '';
  let ly = y;

  for (const word of words) {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line !== '') {
      ctx.fillText(line.trim(), x, ly);
      line = word + ' ';
      ly += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, ly);
}

// ─── Era application logic ───────────────────────────────────────────────────

function getEmissiveForEra(eraId: EraId, entryType: string): number {
  const era = ERA_DATA[eraId];
  if (!era) return 0;
  const l = era.lighting;

  switch (entryType) {
    case 'sign':
      return l.emissiveIntensity * 0.8;
    case 'window':
      return l.interiorGlow * 0.6;
    case 'billboard':
      if (eraId === '2025') return 1.0;
      if (eraId === '1985') return 0.9;
      if (eraId === '2005') return 0.7;
      if (eraId === '1965') return 0.5;
      return 0.2; // 1945
    case 'hanging_sign':
      return l.emissiveIntensity * 0.6;
    default:
      return 0;
  }
}

// ─── Public factory ──────────────────────────────────────────────────────────

export function createStorefrontsLayer(config: EraContent['storefronts']): StorefrontLayerResult {
  const group = new THREE.Group();
  group.name = 'storefronts-layer';

  // Current era state
  let currentEra: EraId = '1945';

  // Store references for applyEra
  const allMeshes: NamedMesh[] = [];
  const allAnimatedScreens: AnimatedScreen[] = [];

  /**
   * Build or rebuild the storefront scene for a given era.
   */
  function buildForEra(eraId: EraId): void {
    // Clear existing
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      // Clean up geometries/materials/textures
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => { m.dispose(); if (m.map) m.map.dispose(); });
        } else {
          child.material.dispose();
          if ((child.material as THREE.Material).map) {
            ((child.material as THREE.Material).map as THREE.CanvasTexture)?.dispose();
          }
        }
      }
    }
    allMeshes.length = 0;
    allAnimatedScreens.length = 0;

    const era = ERA_DATA[eraId];
    if (!era) return;

    const shopWidth = 4.0;
    const spacing = shopWidth + 0.5;
    const startX = -(config.count - 1) * spacing / 2;

    // ── Shops ──
    const shopEntries = era.shops.slice(0, config.count);
    for (let i = 0; i < shopEntries.length; i++) {
      const entry = shopEntries[i];
      const x = startX + i * spacing;

      const { meshes, animatedScreens } = buildShopFront(entry, x, shopWidth, i);
      meshes.forEach((m) => {
        group.add(m.mesh);
        allMeshes.push(m);
      });
      if (animatedScreens) {
        animatedScreens.forEach((a) => allAnimatedScreens.push(a));
      }
    }

    // ── Hanging signs ──
    for (const hs of era.hangingSigns) {
      const { x } = hs;
      const meshes = buildHangingSign(hs, x);
      meshes.forEach((m) => {
        group.add(m.mesh);
        allMeshes.push(m);
      });
    }

    // ── Billboards / large ads ──
    const adCount = era.ads.length;
    for (let i = 0; i < adCount; i++) {
      const ad = era.ads[i];
      const bx = (i - (adCount - 1) / 2) * BILLBOARD_X_SPACING;
      const bw = 8;
      const bh = 5;
      const { meshes, animatedScreens } = buildBillboard(ad, bx, bw, bh, i, eraId === '2025');
      meshes.forEach((m) => {
        group.add(m.mesh);
        allMeshes.push(m);
      });
      if (animatedScreens) {
        animatedScreens.forEach((a) => allAnimatedScreens.push(a));
      }
    }

    // ── Apply emissive intensities for this era ──
    applyEmissives(eraId);
  }

  function applyEmissives(eraId: EraId): void {
    const era = ERA_DATA[eraId];
    if (!era) return;

    for (const named of allMeshes) {
      const mat = named.material as THREE.MeshStandardMaterial;
      if ('emissiveIntensity' in mat) {
        const target = getEmissiveForEra(eraId, named.name.startsWith('sign_') ? 'sign'
          : named.name.startsWith('window_') ? 'window'
          : named.name.startsWith('billboard_') ? 'billboard'
          : named.name.startsWith('hanging_sign_') ? 'hanging_sign'
          : 'default');
        mat.emissiveIntensity = target;
      }
    }
  }

  // ── Initial build ──
  buildForEra('1945');
  currentEra = '1945';

  // ── Fade-in all meshes ──
  for (const named of allMeshes) {
    named.currentOpacity = 0;
    if ('opacity' in named.material) {
      (named.material as THREE.MeshStandardMaterial).opacity = 0;
    }
  }

  return {
    group,

    /**
     * Swap all signage to the target era with a brief fade transition.
     */
    applyEra(eraId: EraId): void {
      if (eraId === currentEra) return;

      // Fade out current meshes
      const fadeDuration = 400; // ms
      const startOpacity = allMeshes.every((m) => m.currentOpacity);
      for (const named of allMeshes) {
        named.opacityTarget = 0;
      }

      // After fade-out, rebuild with new era content
      setTimeout(() => {
        buildForEra(eraId);
        currentEra = eraId;

        // Fade in new meshes
        for (const named of allMeshes) {
          named.currentOpacity = 0;
          named.opacityTarget = 1;
        }
      }, fadeDuration);
    },

    /**
     * Called every frame to update animated textures (2025 LED screens).
     */
    animate(time: number): void {
      for (const screen of allAnimatedScreens) {
        try {
          screen.drawFn(screen.texture.image.getContext('2d')!, time);
          screen.texture.needsUpdate = true;
        } catch {
          // Ignore errors during animation (e.g., off-main-thread issues)
        }
      }

      // Smooth opacity transitions
      for (const named of allMeshes) {
        const diff = named.opacityTarget - named.currentOpacity;
        if (Math.abs(diff) > 0.001) {
          named.currentOpacity += diff * 0.08;
          if ('opacity' in named.material) {
            (named.material as THREE.MeshStandardMaterial).opacity = named.currentOpacity;
          }
        }
      }
    },

    /** Dispose all resources. */
    dispose(): void {
      while (group.children.length > 0) {
        const child = group.children[0];
        group.remove(child);
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => {
              m.dispose();
              if ((m as THREE.Material).map) ((m as THREE.Material).map)?.dispose();
            });
          } else {
            child.material.dispose();
            if ((child.material as THREE.Material).map) ((child.material as THREE.Material).map)?.dispose();
          }
        }
      }
      allMeshes.length = 0;
      allAnimatedScreens.length = 0;
    },
  };
}
