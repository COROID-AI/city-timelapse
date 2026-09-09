/**
 * Classic NES HUD — the permanent status line across the top of the
 * 256px viewport.
 *
 * Layout (left to right) mirrors Super Mario Bros.:
 *
 *   MARIO 001234 ©07  WORLD 1-1  TIME 300  ×3
 *
 * - 'MARIO' label + 6-digit zero-padded score,
 * - coin icon (real coin sprite) + '×NN' coin counter,
 * - 'WORLD 1-1' level label,
 * - 'TIME NNN' timer,
 * - '×N' lives counter.
 *
 * Every region is drawn through drawText() (5x7 pixel font, fillRect only)
 * and the coin icon through drawPixels() (the real coin spin frame), so the
 * HUD never touches ctx.fillText and keeps the zero-image art invariant.
 * All region baselines derive from HUD_LAYOUT/HUD_REGIONS (the tests read
 * those same exports), and the whole line fits inside VIEWPORT_WIDTH.
 */
import { drawText } from './pixelFont.js';
import { drawPixels } from '../render/pixelArt.js';
import { SPRITES } from '../render/sprites/index.js';
import { CONSTANTS } from '../core/constants.js';

/** Horizontal advance of one 5x7 glyph — mirrors pixelFont's GLYPH_ADVANCE. */
const GLYPH = 6;

const VIEWPORT_WIDTH = CONSTANTS.VIEWPORT_WIDTH;

/** Spacing / alignment knobs for the five HUD regions. */
export const HUD_LAYOUT = {
  left: 3, // left margin of the whole HUD line
  top: 1, // top edge of the glyph row
  // Region gap derived from the fixed viewport: 256 / 51 = 5px.
  gap: Math.max(4, Math.floor(VIEWPORT_WIDTH / 51)),
  scoreDigits: 6,
  coinsDigits: 2,
  timeDigits: 3,
  coinScale: 1, // coin icon drawn at 1x so the 16px frame fits the small row
};

/** The label, mirrored from the NES top bar. */
const PLAYER_LABEL = 'MARIO';

/** Real coin sprite reused for the HUD icon (zero extra assets). */
const COIN_FRAME = SPRITES.items.coin.spin1;

/**
 * Region x-baselines, derived once from HUD_LAYOUT so drawHud() and its
 * tests always agree. Verified run width (gap=5, 256px viewport):
 *   label      3..73    (MARIO + 6-digit score)
 *   coin icon  80..95
 *   '×NN'     101..117
 *   'WORLD 1-1' 124..176
 *   'TIME NNN' 183..229
 *   '×N'      236..246  -> right edge 246 < 256 ✓
 *
 * @type {{labelX: number, coinIconX: number, coinsTextX: number,
 *         worldX: number, timeX: number, livesX: number}}
 */
export const HUD_REGIONS = (() => {
  const { left, gap, scoreDigits, coinsDigits, timeDigits, coinScale } = HUD_LAYOUT;
  const labelX = left; // 'MARIO 001234' (left-aligned)
  const coinIconX = labelX + (PLAYER_LABEL.length + 1 + scoreDigits) * GLYPH + gap;
  const coinsTextX = coinIconX + COIN_FRAME.width * coinScale + gap; // '×NN'
  const worldX = coinsTextX + (1 + coinsDigits) * GLYPH + gap; // 'WORLD 1-1'
  const timeX = worldX + (5 + 1 + 3) * GLYPH + gap; // 'TIME NNN'
  const livesX = timeX + (4 + 1 + timeDigits) * GLYPH + gap; // '×N'
  return { labelX, coinIconX, coinsTextX, worldX, timeX, livesX };
})();

/**
 * Draw the full HUD line.
 *
 * @param {CanvasRenderingContext2D} ctx 2D canvas context (method fillRect).
 * @param {GameStats} stats              game stats to render, matching the
 *   GameStats contract: {score, coins, world, time, lives}.
 * @returns {void}
 */
export function drawHud(ctx, stats) {
  const s = stats || {};
  const score = Math.max(0, Math.trunc(Number(s.score) || 0));
  const coins = Math.max(0, Math.trunc(Number(s.coins) || 0));
  const time = Math.max(0, Math.trunc(Number(s.time) || 0));
  const lives = Math.max(0, Math.trunc(Number(s.lives) || 0));
  const world = (s.world && String(s.world)) || '1-1';

  // Zero-padded counters: scores 000000, coins 00, time 000. Huge values
  // wrap to the fixed digit window (slice(-n)) so the five regions never
  // collide and the whole line keeps fitting the 256px viewport.
  const scoreText = String(score).padStart(HUD_LAYOUT.scoreDigits, '0').slice(-HUD_LAYOUT.scoreDigits);
  const coinText = String(coins).padStart(HUD_LAYOUT.coinsDigits, '0').slice(-HUD_LAYOUT.coinsDigits);
  const timeText = String(time).padStart(HUD_LAYOUT.timeDigits, '0').slice(-HUD_LAYOUT.timeDigits);

  const { top } = HUD_LAYOUT;
  const R = HUD_REGIONS;

  // --- 'MARIO' + 6-digit score ---
  drawText(ctx, `${PLAYER_LABEL} ${scoreText}`, R.labelX, top);

  // --- coin icon + ×NN ---
  drawPixels(ctx, COIN_FRAME, R.coinIconX, top, { scale: HUD_LAYOUT.coinScale });
  drawText(ctx, `×${coinText}`, R.coinsTextX, top);

  // --- WORLD 1-1 ---
  drawText(ctx, `WORLD ${world}`, R.worldX, top);

  // --- TIME NNN ---
  drawText(ctx, `TIME ${timeText}`, R.timeX, top);

  // --- lives ×N ---
  drawText(ctx, `×${lives}`, R.livesX, top);
}

export default drawHud;