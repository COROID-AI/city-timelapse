/**
 * Era-specific storefronts and advertisements for the City Time Period
 * Timelapse.
 *
 * This module owns everything storefront-signage and advertising related for
 * all five canonical eras (1945, 1965, 1985, 2005, 2025):
 *
 *   - It generates every sign, poster, menu board and billboard as a
 *     procedural canvas texture (no external asset files) and registers each
 *     under a stable key in the shared {@link assetRegistry}.
 *   - It registers a fully-typed {@link StorefrontConfig} and
 *     {@link AdvertisementConfig} for every era year into the shared
 *     foundation era registry, merging only the `storefronts` and
 *     `advertisements` fields so it composes with the sibling content modules
 *     (buildings, vehicles, pedestrians, ...).
 *   - It provides {@link createEraStorefronts}, a self-contained scene helper
 *     that places the registered signage on ground-floor facades and on
 *     elevated billboard positions, and cycles the 2025 LED/OLEAD billboards
 *     through multiple ad frames so the advertising feels alive.
 *
 * Wire the storefront system into the scene (for example from main.ts) with:
 *
 *   const storefronts = createEraStorefronts(scene);
 *   // in the animation loop:
 *   storefronts.update(delta);
 *   // on era switch (keyboard hotkeys 1-5):
 *   storefronts.setEra(year);
 *   // on teardown:
 *   storefronts.dispose();
 */
import * as THREE from 'three';
import { assetRegistry } from '../core/assetRegistry';
import { eraRegistry } from '../eras';
import type {
  AdvertisementConfig,
  AssetKey,
  EraConfig,
  EraYear,
  HexColor,
  Normalized,
  StorefrontConfig,
} from '../eras';
import { seededFromString } from '../core/prng';

/* ------------------------------------------------------------------ *
 * Canvas texture helpers
 * ------------------------------------------------------------------ */

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';

/**
 * Create an offscreen 2D canvas and hand it (plus its context) to a draw
 * callback, then wrap the result in a registered {@link THREE.CanvasTexture}.
 */
function registerCanvasTexture(
  key: AssetKey,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error(`Unable to obtain 2D context for texture "${key}"`);
  }
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  assetRegistry.registerTexture(key, texture);
  return texture;
}

/** Fill the whole canvas with a solid color. */
function fill(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
}

/** Draw centered text with an optional letter-spacing (for art-deco / neon). */
function centerText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  font: string,
  color: string,
  spacing = 0,
): void {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  if (spacing !== 0) {
    // Manually place each glyph to emulate wide art-deco / LED tracking.
    const widths = [...text].map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
    let x = cx - total / 2 + widths[0] / 2;
    [...text].forEach((ch, i) => {
      ctx.fillText(ch, x, cy);
      x += widths[i] + spacing;
    });
  } else {
    ctx.fillText(text, cx, cy);
  }
}

/* ------------------------------------------------------------------ *
 * 1945 — hand-painted signs, art-deco lettering, war-era posters,
 *         bakery & diner shopfronts.
 * ------------------------------------------------------------------ */

function draw1945(): void {
  // Hand-painted bakery sign on a weathered board.
  registerCanvasTexture('sign-1945-bakery', 512, 192, (ctx, w, h) => {
    fill(ctx, w, h, '#7a5a36');
    ctx.strokeStyle = '#4e3a22';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.strokeStyle = '#e7d9b0';
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, w - 36, h - 36);
    centerText(ctx, "BROWN'S BAKERY", w / 2, h / 2 - 22, `bold 54px ${SERIF}`, '#f5e6c4');
    centerText(ctx, 'FRESH BREAD DAILY', w / 2, h / 2 + 30, `28px ${SERIF}`, '#f0dcae');
    // Wheat stalks.
    ctx.strokeStyle = '#d9b45a';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const x = w / 2 + (i - 1) * 90;
      ctx.beginPath();
      ctx.moveTo(x, h - 30);
      ctx.quadraticCurveTo(x + 6, h - 60, x + 2, h - 84);
      ctx.stroke();
    }
  });

  // Hand-painted diner sign.
  registerCanvasTexture('sign-1945-diner', 512, 192, (ctx, w, h) => {
    fill(ctx, w, h, '#3e5c8a');
    ctx.strokeStyle = '#2a3f61';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    centerText(ctx, "JOE'S DINER", w / 2, h / 2 - 24, `bold 58px ${SERIF}`, '#ffe9c4');
    centerText(ctx, 'HOME COOKED MEALS', w / 2, h / 2 + 30, `26px ${SERIF}`, '#f4d9a8');
    // Plate underline.
    ctx.fillStyle = '#ffe9c4';
    ctx.beginPath();
    ctx.ellipse(w / 2, h - 26, 52, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Art-deco hotel sign: gold lettering with stepped deco borders.
  registerCanvasTexture('sign-1945-deco', 512, 224, (ctx, w, h) => {
    fill(ctx, w, h, '#1c2430');
    ctx.strokeStyle = '#c9a24b';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    // Stepped deco corner motifs.
    ctx.strokeStyle = '#c9a24b';
    for (const [x, y] of [
      [30, 30],
      [w - 30, 30],
      [30, h - 30],
      [w - 30, h - 30],
    ] as const) {
      ctx.strokeRect(x - 14, y - 14, 28, 28);
      ctx.strokeRect(x - 7, y - 7, 14, 14);
    }
    centerText(ctx, 'HOTEL', w / 2, h / 2 - 44, `bold 34px ${SERIF}`, '#c9a24b', 14);
    centerText(ctx, 'ROYALE', w / 2, h / 2 + 16, `bold 62px ${SERIF}`, '#e6c878', 10);
    centerText(ctx, '★ 1929 ★', w / 2, h / 2 + 68, `20px ${SERIF}`, '#c9a24b', 8);
  });

  // Hardware / general store.
  registerCanvasTexture('sign-1945-hardware', 512, 160, (ctx, w, h) => {
    fill(ctx, w, h, '#5b5148');
    ctx.strokeStyle = '#3d3530';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    centerText(ctx, 'ACME HARDWARE', w / 2, h / 2, `bold 52px ${SERIF}`, '#f0e6cf');
  });

  registerCanvasTexture('sign-1945-general', 512, 160, (ctx, w, h) => {
    fill(ctx, w, h, '#3f6b4f');
    ctx.strokeStyle = '#2a4a37';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    centerText(ctx, 'GENERAL STORE', w / 2, h / 2, `bold 50px ${SERIF}`, '#f3ead2');
  });

  // War-era poster billboards.
  registerCanvasTexture('billboard-1945-war', 512, 256, (ctx, w, h) => {
    fill(ctx, w, h, '#8a2f2f');
    ctx.strokeStyle = '#f5e6c4';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    centerText(ctx, 'BUY WAR BONDS', w / 2, h / 2 - 30, `bold 52px ${SERIF}`, '#fff3d6');
    centerText(ctx, '★ FOR VICTORY ★', w / 2, h / 2 + 34, `26px ${SERIF}`, '#ffd98a', 6);
    centerText(ctx, 'U.S. TREASURY', w / 2, h - 30, `18px ${SERIF}`, '#f5e6c4');
  });

  registerCanvasTexture('billboard-1945-cola', 512, 256, (ctx, w, h) => {
    fill(ctx, w, h, '#b8d4e8');
    ctx.strokeStyle = '#1c2a3a';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    centerText(ctx, 'DRINK', w / 2, h / 2 - 60, `bold 40px ${SERIF}`, '#1c2a3a');
    centerText(ctx, 'COLA', w / 2, h / 2 + 6, `bold 84px ${SERIF}`, '#b03030');
    centerText(ctx, 'ICE COLD · 5¢', w / 2, h / 2 + 76, `24px ${SERIF}`, '#1c2a3a');
  });
}

/* ------------------------------------------------------------------ *
 * 1965 — neon signs, mid-century fonts, grocery & department-store
 *         signage.
 * ------------------------------------------------------------------ */

/** Draw a glowing neon tube sign (soft halo + bright core). */
function neonSign(
  key: AssetKey,
  text: string,
  sub: string,
  glow: string,
  core: string,
  bg: string,
): void {
  registerCanvasTexture(key, 512, 192, (ctx, w, h) => {
    fill(ctx, w, h, bg);
    ctx.shadowColor = glow;
    ctx.shadowBlur = 24;
    centerText(ctx, text, w / 2, h / 2 - 22, `bold 66px ${SANS}`, glow);
    ctx.shadowBlur = 8;
    centerText(ctx, text, w / 2, h / 2 - 22, `bold 66px ${SANS}`, core);
    ctx.shadowBlur = 0;
    if (sub) {
      centerText(ctx, sub, w / 2, h / 2 + 40, `24px ${SANS}`, '#e8e8ea');
    }
  });
}

function draw1965(): void {
  neonSign('sign-1965-motel', 'MOTEL', 'VACANCY', '#ff5a8a', '#ffffff', '#1a1220');
  neonSign('sign-1965-cafe', 'CAFE', 'OPEN 24 HRS', '#ffd23f', '#fff8e0', '#201510');
  neonSign('sign-1965-diner', 'DINER', 'COFFEE · PIE', '#4fd8ff', '#eafcff', '#101820');

  // Department store.
  registerCanvasTexture('sign-1965-dept', 640, 192, (ctx, w, h) => {
    fill(ctx, w, h, '#24405c');
    ctx.strokeStyle = '#c9a24b';
    ctx.lineWidth = 4;
    ctx.strokeRect(12, 12, w - 24, h - 24);
    centerText(ctx, 'MAYFAIR', w / 2, h / 2 - 30, `bold 56px ${SANS}`, '#f2ead8');
    centerText(ctx, 'DEPARTMENT STORE', w / 2, h / 2 + 30, `28px ${SANS}`, '#d8cfa8');
  });

  // Supermarket.
  registerCanvasTexture('sign-1965-market', 640, 192, (ctx, w, h) => {
    fill(ctx, w, h, '#2e7d4f');
    ctx.strokeStyle = '#1f5a37';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    centerText(ctx, 'SUPER MARKET', w / 2, h / 2 - 24, `bold 60px ${SANS}`, '#fff6e0');
    centerText(ctx, 'FRESH · LOW PRICES', w / 2, h / 2 + 34, `24px ${SANS}`, '#e3f2dc');
  });

  // Service station.
  registerCanvasTexture('sign-1965-service', 512, 160, (ctx, w, h) => {
    fill(ctx, w, h, '#1f5aa8');
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    centerText(ctx, 'SERVICE', w / 2, h / 2, `bold 58px ${SANS}`, '#ffffff');
  });

  // Mid-century billboards.
  registerCanvasTexture('billboard-1965-jet', 512, 256, (ctx, w, h) => {
    fill(ctx, w, h, '#d8e2ec');
    ctx.strokeStyle = '#24405c';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    centerText(ctx, 'FLY THE JETS', w / 2, h / 2 - 30, `bold 52px ${SANS}`, '#24405c');
    centerText(ctx, 'NOW TO ALL 50 STATES', w / 2, h / 2 + 30, `24px ${SANS}`, '#3a5a7a');
    // Little jet glyph.
    ctx.fillStyle = '#b03030';
    ctx.beginPath();
    ctx.ellipse(w / 2, h - 40, 60, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w / 2 + 60, h - 40);
    ctx.lineTo(w / 2 + 96, h - 52);
    ctx.lineTo(w / 2 + 96, h - 28);
    ctx.closePath();
    ctx.fill();
  });

  registerCanvasTexture('billboard-1965-car', 512, 256, (ctx, w, h) => {
    fill(ctx, w, h, '#e9e2cf');
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    centerText(ctx, 'NEW 1965 CARS', w / 2, h / 2 - 30, `bold 50px ${SANS}`, '#2a2a2a');
    centerText(ctx, 'SEE YOUR DEALER TODAY', w / 2, h / 2 + 34, `24px ${SANS}`, '#6a5a2a');
  });
}

/* ------------------------------------------------------------------ *
 * 1985 — backlit plastic signage, cassette / arcade / movie
 *         advertising, bold colors.
 * ------------------------------------------------------------------ */

function draw1985(): void {
  // Neon marquee arcade.
  registerCanvasTexture('sign-1985-arcade', 512, 192, (ctx, w, h) => {
    fill(ctx, w, h, '#1a0f2e');
    ctx.shadowColor = '#ff2fd6';
    ctx.shadowBlur = 20;
    centerText(ctx, 'ARCADE', w / 2, h / 2 - 20, `bold 74px ${SANS}`, '#ff2fd6');
    ctx.shadowBlur = 0;
    centerText(ctx, 'PLAY · WIN · REPLAY', w / 2, h / 2 + 42, `22px ${SANS}`, '#ffd23f');
  });

  // Movie theater marquee.
  registerCanvasTexture('sign-1985-cinema', 512, 192, (ctx, w, h) => {
    fill(ctx, w, h, '#101010');
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.shadowColor = '#ffd23f';
    ctx.shadowBlur = 14;
    centerText(ctx, 'CINEMA', w / 2, h / 2 - 22, `bold 70px ${SANS}`, '#ffd23f');
    ctx.shadowBlur = 0;
    centerText(ctx, 'NOW SHOWING', w / 2, h / 2 + 40, `22px ${SANS}`, '#ffffff');
  });

  // Video / cassette rental.
  registerCanvasTexture('sign-1985-video', 512, 160, (ctx, w, h) => {
    fill(ctx, w, h, '#2a2a72');
    ctx.strokeStyle = '#ff3b3b';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    centerText(ctx, 'VIDEO RENTALS', w / 2, h / 2, `bold 48px ${SANS}`, '#ffffff');
    centerText(ctx, 'VHS', 60, h / 2, `bold 30px ${SANS}`, '#ffd23f');
    centerText(ctx, 'BETA', w - 60, h / 2, `bold 30px ${SANS}`, '#ffd23f');
  });

  // Backlit plastic burger & pizza.
  registerCanvasTexture('sign-1985-burger', 512, 192, (ctx, w, h) => {
    fill(ctx, w, h, '#d23b2a');
    ctx.shadowColor = '#ff9a6a';
    ctx.shadowBlur = 18;
    centerText(ctx, 'BURGER', w / 2, h / 2 - 24, `bold 72px ${SANS}`, '#fff0da');
    ctx.shadowBlur = 0;
    centerText(ctx, 'CHAR-BROILED', w / 2, h / 2 + 40, `24px ${SANS}`, '#ffe9c4');
  });

  registerCanvasTexture('sign-1985-pizza', 512, 192, (ctx, w, h) => {
    fill(ctx, w, h, '#1f7a3d');
    ctx.shadowColor = '#9aff8a';
    ctx.shadowBlur = 18;
    centerText(ctx, 'PIZZA', w / 2, h / 2 - 24, `bold 78px ${SANS}`, '#fffbe0');
    ctx.shadowBlur = 0;
    centerText(ctx, 'HOT & FRESH', w / 2, h / 2 + 42, `24px ${SANS}`, '#eaffd9');
  });

  // Bold 80s billboards.
  registerCanvasTexture('billboard-1985-cassette', 512, 256, (ctx, w, h) => {
    fill(ctx, w, h, '#e01b5d');
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    centerText(ctx, 'CASSETTE TAPES', w / 2, h / 2 - 30, `bold 46px ${SANS}`, '#ffffff');
    centerText(ctx, 'REWIND · REPLAY', w / 2, h / 2 + 30, `26px ${SANS}`, '#ffe9b0');
  });

  registerCanvasTexture('billboard-1985-movie', 512, 256, (ctx, w, h) => {
    fill(ctx, w, h, '#1c1c3a');
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    centerText(ctx, 'NOW SHOWING', w / 2, h / 2 - 46, `bold 52px ${SANS}`, '#ffd23f');
    centerText(ctx, 'BLAST FROM', w / 2, h / 2 + 10, `bold 40px ${SANS}`, '#ffffff');
    centerText(ctx, 'THE PAST', w / 2, h / 2 + 62, `bold 40px ${SANS}`, '#ffffff');
  });

  registerCanvasTexture('billboard-1985-arcade', 512, 256, (ctx, w, h) => {
    fill(ctx, w, h, '#0f2e6a');
    ctx.shadowColor = '#2fd6ff';
    ctx.shadowBlur = 20;
    centerText(ctx, 'INSERT COIN', w / 2, h / 2 - 40, `bold 50px ${SANS}`, '#2fd6ff');
    ctx.shadowBlur = 0;
    centerText(ctx, '25¢ · 3 PLAYS', w / 2, h / 2 + 30, `30px ${SANS}`, '#ffd23f');
    centerText(ctx, 'HIGH SCORE WINS', w / 2, h / 2 + 74, `22px ${SANS}`, '#ffffff');
  });
}

/* ------------------------------------------------------------------ *
 * 2005 — digital-style light-box signage, big-box / coffee-chain
 *         storefronts, flat-panel ads.
 * ------------------------------------------------------------------ */

/** Draw a clean, evenly-lit translucent light-box sign. */
function lightBox(
  key: AssetKey,
  text: string,
  sub: string,
  bg: string,
  textColor: string,
): void {
  registerCanvasTexture(key, 512, 192, (ctx, w, h) => {
    fill(ctx, w, h, '#eef1f4');
    ctx.strokeStyle = '#b8c0c8';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    // Even "backlit" wash.
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(0, 0, w, h);
    centerText(ctx, text, w / 2, h / 2 - 24, `bold 64px ${SANS}`, textColor);
    if (sub) {
      centerText(ctx, sub, w / 2, h / 2 + 36, `24px ${SANS}`, '#5a636c');
    }
    void bg;
  });
}

function draw2005(): void {
  lightBox('sign-2005-coffee', 'COFFEE', 'ESPRESSO · LATTE', '#fff', '#2f2f2f');
  lightBox('sign-2005-megamart', 'MEGA MART', 'EVERYDAY LOW PRICES', '#fff', '#1f5aa8');
  lightBox('sign-2005-pharmacy', 'PHARMACY', 'OPEN 24 HOURS', '#fff', '#1f8a4c');
  lightBox('sign-2005-bank', 'BANK', 'MEMBER FDIC', '#fff', '#8a5a1f');
  lightBox('sign-2005-wireless', 'WIRELESS', 'NEW PHONES', '#fff', '#5a3a8a');

  // Flat-panel / big-box billboards.
  registerCanvasTexture('billboard-2005-mart', 512, 256, (ctx, w, h) => {
    fill(ctx, w, h, '#1f5aa8');
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    centerText(ctx, 'MEGA MART', w / 2, h / 2 - 34, `bold 56px ${SANS}`, '#ffffff');
    centerText(ctx, 'BIG SALE · THIS WEEK', w / 2, h / 2 + 28, `26px ${SANS}`, '#ffe9b0');
  });

  registerCanvasTexture('billboard-2005-phone', 512, 256, (ctx, w, h) => {
    fill(ctx, w, h, '#2a2a3a');
    ctx.strokeStyle = '#2fd6ff';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    centerText(ctx, 'NEW PHONE PLAN', w / 2, h / 2 - 34, `bold 50px ${SANS}`, '#2fd6ff');
    centerText(ctx, 'UNLIMITED TALK & TEXT', w / 2, h / 2 + 34, `26px ${SANS}`, '#e8e8f0');
  });
}

/* ------------------------------------------------------------------ *
 * 2025 — OLED / LED dynamic billboards, digital menu boards,
 *         rideshare & delivery-app ads with animated cycling content.
 * ------------------------------------------------------------------ */

/** Draw a vivid OLED/LED ad frame with a glowing gradient wash. */
function ledAd(
  key: AssetKey,
  headline: string,
  sub: string,
  accent: string,
  bg: string,
): void {
  registerCanvasTexture(key, 512, 256, (ctx, w, h) => {
    fill(ctx, w, h, bg);
    // Subtle OLED glow gradient.
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, 'rgba(255,255,255,0.12)');
    grad.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.shadowColor = accent;
    ctx.shadowBlur = 18;
    centerText(ctx, headline, w / 2, h / 2 - 34, `bold 56px ${SANS}`, accent);
    ctx.shadowBlur = 0;
    centerText(ctx, sub, w / 2, h / 2 + 30, `26px ${SANS}`, '#ffffff');
    centerText(ctx, '● LIVE ●', w / 2, h - 26, `18px ${SANS}`, accent);
  });
}

function draw2025(): void {
  // Digital menu board with rows of items.
  registerCanvasTexture('sign-2025-menu', 512, 320, (ctx, w, h) => {
    fill(ctx, w, h, '#0c1116');
    ctx.strokeStyle = '#2fd6ff';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    centerText(ctx, 'DIGITAL MENU', w / 2, 38, `bold 34px ${SANS}`, '#2fd6ff');
    const rows: Array<[string, string]> = [
      ['Espresso', '$3.50'],
      ['Latte', '$4.75'],
      ['Cold Brew', '$4.25'],
      ['Matcha', '$5.00'],
    ];
    ctx.font = `28px ${SANS}`;
    ctx.textBaseline = 'middle';
    rows.forEach(([name, price], i) => {
      const y = 96 + i * 56;
      ctx.fillStyle = '#eafcff';
      ctx.textAlign = 'left';
      ctx.fillText(name, 48, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(price, w - 48, y);
    });
  });

  ledAd('sign-2025-rideshare', 'RIDESHARE', 'RIDE IN MINUTES', '#66e0ff', '#0b1f33');
  ledAd('sign-2025-delivery', 'DELIVER NOW', 'HOT MEALS AT YOUR DOOR', '#ff8a3a', '#2b1208');
  ledAd('sign-2025-fitness', 'FITNESS', 'OPEN 24/7', '#7bff9a', '#0b2416');

  // Multiple billboard frames so the 2025 helper can cycle between them.
  ledAd('billboard-2025-rideshare', 'RIDESHARE', 'RIDE IN MINUTES', '#66e0ff', '#0b1f33');
  ledAd('billboard-2025-delivery', 'DELIVER NOW', 'HOT MEALS AT YOUR DOOR', '#ff8a3a', '#2b1208');
  ledAd('billboard-2025-stream', 'STREAM IT', 'BINGE TONIGHT', '#b06bff', '#1c0b2e');
  ledAd('billboard-2025-menu', 'MENU LIVE', 'ORDER AHEAD', '#7bff9a', '#0b2416');
}

/* ------------------------------------------------------------------ *
 * Era profiles + registry registration
 * ------------------------------------------------------------------ */

interface EraStorefrontProfile {
  year: EraYear;
  enabled: boolean;
  signTextures: AssetKey[];
  awningPalette: HexColor[];
  displayBrightness: Normalized;
}

interface EraAdvertisementProfile {
  year: EraYear;
  billboards: AssetKey[];
  neon: boolean;
  neonPalette: HexColor[];
  count: number;
}

/** Per-era storefront signage (ground-floor facades). */
const ERA_STOREFRONT_PROFILES: Record<EraYear, EraStorefrontProfile> = {
  1945: {
    year: 1945,
    enabled: true,
    signTextures: [
      'sign-1945-bakery',
      'sign-1945-diner',
      'sign-1945-deco',
      'sign-1945-hardware',
      'sign-1945-general',
    ],
    awningPalette: [0x8a2f2f, 0x2f4f6b, 0x6b4f2f, 0x3f6b4f],
    displayBrightness: 0.25,
  },
  1965: {
    year: 1965,
    enabled: true,
    signTextures: [
      'sign-1965-motel',
      'sign-1965-cafe',
      'sign-1965-diner',
      'sign-1965-dept',
      'sign-1965-market',
      'sign-1965-service',
    ],
    awningPalette: [0x1f5aa8, 0xd23b2a, 0x2e7d4f, 0xd8a000],
    displayBrightness: 0.4,
  },
  1985: {
    year: 1985,
    enabled: true,
    signTextures: [
      'sign-1985-arcade',
      'sign-1985-cinema',
      'sign-1985-video',
      'sign-1985-burger',
      'sign-1985-pizza',
    ],
    awningPalette: [0xe01b5d, 0x2fd6ff, 0xffd23f, 0x1f7a3d],
    displayBrightness: 0.6,
  },
  2005: {
    year: 2005,
    enabled: true,
    signTextures: [
      'sign-2005-coffee',
      'sign-2005-megamart',
      'sign-2005-pharmacy',
      'sign-2005-bank',
      'sign-2005-wireless',
    ],
    awningPalette: [0x1f5aa8, 0x5a3a8a, 0x1f8a4c, 0x8a5a1f],
    displayBrightness: 0.75,
  },
  2025: {
    year: 2025,
    enabled: true,
    signTextures: [
      'sign-2025-menu',
      'sign-2025-rideshare',
      'sign-2025-delivery',
      'sign-2025-fitness',
    ],
    awningPalette: [0x66e0ff, 0xff8a3a, 0x7bff9a, 0xb06bff],
    displayBrightness: 1.0,
  },
};

/** Per-era advertising (elevated billboards + neon). */
const ERA_ADVERTISEMENT_PROFILES: Record<EraYear, EraAdvertisementProfile> = {
  1945: {
    year: 1945,
    billboards: ['billboard-1945-war', 'billboard-1945-cola'],
    neon: false,
    neonPalette: [],
    count: 2,
  },
  1965: {
    year: 1965,
    billboards: ['billboard-1965-jet', 'billboard-1965-car'],
    neon: true,
    neonPalette: [0xff5a8a, 0xffd23f, 0x4fd8ff],
    count: 3,
  },
  1985: {
    year: 1985,
    billboards: ['billboard-1985-cassette', 'billboard-1985-movie', 'billboard-1985-arcade'],
    neon: true,
    neonPalette: [0xff2fd6, 0xffd23f, 0x2fd6ff],
    count: 4,
  },
  2005: {
    year: 2005,
    billboards: ['billboard-2005-mart', 'billboard-2005-phone'],
    neon: false,
    neonPalette: [],
    count: 3,
  },
  2025: {
    year: 2025,
    billboards: [
      'billboard-2025-rideshare',
      'billboard-2025-delivery',
      'billboard-2025-stream',
      'billboard-2025-menu',
    ],
    neon: true,
    neonPalette: [0x66e0ff, 0xff8a3a, 0x7bff9a, 0xb06bff],
    count: 5,
  },
};

/** Read-only views of the era profiles for introspection/tests. */
export const STOREFRONT_PROFILES: Readonly<Record<EraYear, EraStorefrontProfile>> =
  ERA_STOREFRONT_PROFILES;
export const ADVERTISEMENT_PROFILES: Readonly<Record<EraYear, EraAdvertisementProfile>> =
  ERA_ADVERTISEMENT_PROFILES;

function buildStorefrontConfig(profile: EraStorefrontProfile): StorefrontConfig {
  return {
    enabled: profile.enabled,
    signTextures: profile.signTextures,
    awningPalette: profile.awningPalette,
    displayBrightness: profile.displayBrightness,
  };
}

function buildAdvertisementConfig(profile: EraAdvertisementProfile): AdvertisementConfig {
  return {
    billboards: profile.billboards,
    neon: profile.neon,
    neonPalette: profile.neonPalette,
    count: profile.count,
  };
}

/**
 * Merge storefronts + advertisements into the shared era registry, preserving
 * any other fields (buildings, vehicles, ...) that sibling modules register.
 */
function registerEraContent(
  year: EraYear,
  storefronts: StorefrontConfig,
  advertisements: AdvertisementConfig,
): void {
  const existing: Partial<EraConfig> = eraRegistry[year] ?? {};
  eraRegistry[year] = { ...existing, storefronts, advertisements } as EraConfig;
}

// Generate all canvas textures up front so they can be resolved by key.
draw1945();
draw1965();
draw1985();
draw2005();
draw2025();

// Register era-appropriate storefronts and advertisements for all five years.
for (const year of [1945, 1965, 1985, 2005, 2025] as const) {
  registerEraContent(
    year,
    buildStorefrontConfig(ERA_STOREFRONT_PROFILES[year]),
    buildAdvertisementConfig(ERA_ADVERTISEMENT_PROFILES[year]),
  );
}

/* ------------------------------------------------------------------ *
 * Scene placement helper
 * ------------------------------------------------------------------ */

export interface EraStorefrontsOptions {
  /** Initial era to render (default 2025). */
  era?: EraYear;
  /** Distance of the storefront facade row from the origin (default 14). */
  facadeZ?: number;
  /** Deterministic seed for reproducible placement variety. */
  seed?: string;
  /** Billboard cycle speed in frames per second (2025 only). */
  cycleSpeed?: number;
}

export interface EraStorefrontsHandle {
  /** Rebuild the signage for the given era year. */
  setEra(year: EraYear): void;
  /** The era currently rendered. */
  getEra(): EraYear;
  /** Advance billboard animation. Call every frame. */
  update(delta: number): void;
  /** Remove all signage and release GPU resources. */
  dispose(): void;
}

/**
 * Create a self-contained storefront + billboard system that places the
 * era-appropriate canvas textures on ground-floor facades and on elevated
 * billboard positions. In 2025 the billboards cycle through multiple ad
 * frames so the advertising reads as animated / dynamic.
 */
export function createEraStorefronts(
  scene: THREE.Scene,
  options: EraStorefrontsOptions = {},
): EraStorefrontsHandle {
  const facadeZ = options.facadeZ ?? 14;
  const seed = options.seed ?? 'storefronts';
  const cycleSpeed = options.cycleSpeed ?? 1.2;

  const container = new THREE.Group();
  container.name = 'era-storefronts';
  scene.add(container);

  let currentYear: EraYear = options.era ?? 2025;
  const billboardMeshes: THREE.Mesh[] = [];
  const billboardFrames: THREE.Texture[][] = [];
  const billboardPhases: number[] = [];

  function matFor(key: AssetKey): THREE.MeshStandardMaterial {
    const texture = assetRegistry.getTexture<THREE.Texture>(key);
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.55,
      metalness: 0.05,
    });
  }

  function addSign(key: AssetKey, w: number, h: number, x: number, y: number): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), matFor(key));
    mesh.position.set(x, y, facadeZ);
    mesh.rotation.y = Math.PI;
    mesh.castShadow = true;
    container.add(mesh);
    return mesh;
  }

  function addBillboard(
    key: AssetKey,
    w: number,
    h: number,
    x: number,
    y: number,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), matFor(key));
    mesh.position.set(x, y, facadeZ + 2);
    mesh.rotation.y = Math.PI;
    mesh.castShadow = true;
    container.add(mesh);
    return mesh;
  }

  function buildFor(year: EraYear): void {
    // Clear previous geometry.
    for (const mesh of billboardMeshes) {
      container.remove(mesh);
      mesh.geometry.dispose();
      const material = mesh.material as THREE.MeshStandardMaterial | undefined;
      material?.dispose();
    }
    billboardMeshes.length = 0;
    billboardFrames.length = 0;
    billboardPhases.length = 0;
    // Remove any leftover signage meshes.
    const leftovers = container.children.filter((child) => child !== undefined);
    for (const child of leftovers) {
      container.remove(child);
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else if (material) material.dispose();
    }

    const prng = seededFromString(`${seed}:${year}`);
    const storefront = ERA_STOREFRONT_PROFILES[year];
    const ads = ERA_ADVERTISEMENT_PROFILES[year];

    // Ground-floor facade signs, spaced along the facade row.
    const signCount = Math.min(storefront.signTextures.length, 6);
    const spacing = 3.2;
    const startX = -((signCount - 1) * spacing) / 2;
    for (let i = 0; i < signCount; i++) {
      const key = storefront.signTextures[i % storefront.signTextures.length];
      const x = startX + i * spacing + prng.range(-0.25, 0.25);
      addSign(key, 2.6, 0.95, x, 2.6);
    }

    // Elevated billboard positions.
    const billboardCount = Math.min(ads.count, 3);
    const bbSpacing = 6.5;
    const bbStartX = -((billboardCount - 1) * bbSpacing) / 2;
    for (let i = 0; i < billboardCount; i++) {
      const keys = ads.billboards;
      const baseKey = keys[i % keys.length];
      const x = bbStartX + i * bbSpacing;
      const y = 6.5 + (i % 2) * 1.2;
      const mesh = addBillboard(baseKey, 4.6, 2.3, x, y);
      billboardMeshes.push(mesh);

      // For 2025, give each billboard a set of frames to cycle through.
      if (year === 2025) {
        const frames = ads.billboards
          .map((k) => assetRegistry.getTexture<THREE.Texture>(k))
          .filter((t): t is THREE.Texture => t !== undefined);
        billboardFrames.push(frames);
        billboardPhases.push(prng.range(0, 100));
      } else {
        const single = assetRegistry.getTexture<THREE.Texture>(baseKey);
        billboardFrames.push(single ? [single] : []);
        billboardPhases.push(0);
      }
    }
  }

  buildFor(currentYear);

  function update(delta: number): void {
    if (currentYear !== 2025) {
      return;
    }
    for (let i = 0; i < billboardMeshes.length; i++) {
      const frames = billboardFrames[i];
      if (!frames || frames.length < 2) {
        continue;
      }
      billboardPhases[i] += delta * cycleSpeed;
      const idx = Math.floor(billboardPhases[i]) % frames.length;
      const texture = frames[idx];
      if (texture) {
        const material = billboardMeshes[i].material as THREE.MeshStandardMaterial;
        material.map = texture;
        material.needsUpdate = true;
      }
    }
  }

  function dispose(): void {
    container.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) {
        material.forEach((m) => m.dispose());
      } else if (material) {
        material.dispose();
      }
    });
    scene.remove(container);
  }

  return {
    setEra(year: EraYear): void {
      currentYear = year;
      buildFor(year);
    },
    getEra: () => currentYear,
    update,
    dispose,
  };
}
