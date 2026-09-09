/**
 * Sprite inventory — single aggregate of every palette string-map frame.
 *
 * Each frame is a plain object:
 *   {
 *     palette: { '<char>': '#rrggbb', ... },  // '.' is transparent
 *     width:   <number>,                      // row length in characters
 *     height:  <number>,                      // number of rows
 *     rows:    [ '<string>', ... ],           // one character per pixel
 *   }
 *
 * The full inventory (frame-name registry) consumed by entities, HUD,
 * tilemap and game-state composition lives under SPRITES. Groups:
 *
 * - marioSmall  idle / walk1-3 / jump / skid / death / flagSlide (16x16)
 * - marioSuper  idle / walk1-3 / jump / skid / flagSlide (16x32)
 * - goomba      walk1 / walk2 / squashed (16x8)
 * - koopa       walk1 / walk2 / shell (16x10)
 * - mushroom    default (16x16)
 * - coin        spin1-4 (16x16)
 * - tiles       ground, brick, usedBlock, question1-3, pipeTopLeft/Right,
 *               pipeBodyLeft/Right, flagpole, flag, castle (80x80)
 * - scenery     cloud, hill, bush
 *
 * Standard tile frames are 16x16 and align to the fixed 16px TILE_SIZE grid;
 * super Mario is 16x32 to match its taller hitbox. All art is original
 * approximation art in the classic style — zero image files.
 */
import { marioSmall } from './marioSmall.js';
import { marioSuper } from './marioSuper.js';
import { goomba } from './goomba.js';
import { koopa } from './koopa.js';
import { items } from './items.js';
import { tiles } from './tiles.js';
import { scenery } from './scenery.js';

export const SPRITES = {
  marioSmall,
  marioSuper,
  goomba,
  koopa,
  items,
  tiles,
  scenery,
};

/** Convenience accessor with a default frame (first in insertion order). */
export function getFrame(group, name) {
  const frame = SPRITES[group] && SPRITES[group][name];
  if (!frame) {
    throw new Error(`Unknown sprite frame: ${group}.${name}`);
  }
  return frame;
}

export default SPRITES;