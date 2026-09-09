/**
 * Goomba enemy entity.
 *
 * Walker (14x14 hitbox) patrolling at 30px/s using applyGravity + moveAndCollide.
 * Reverses on solid wall hits and walks off ledges like classic goombas.
 *
 * stomp() transitions to a squashed state ('squashed' sprite) which removes
 * the entity from the world after 0.5s.
 */

import { Entity } from './entity.js';
import { applyGravity } from '../physics/body.js';
import { moveAndCollide } from '../collision/tileCollision.js';
import { SPRITES } from '../render/sprites/index.js';
import { drawPixels } from '../render/pixelArt.js';

const PATROL_SPEED = 30; // px/s
const SQUASH_DURATION = 0.5; // seconds
const ANIM_FRAME_TIME = 0.25; // seconds per walking animation frame

export class Goomba extends Entity {
  /**
   * @param {object} options
   * @param {number} [options.x=0]
   * @param {number} [options.y=0]
   * @param {number} [options.dir=-1] Initial direction: -1 (left) or 1 (right)
   */
  constructor({ x = 0, y = 0, dir = -1 } = {}) {
    super({
      type: 'goomba',
      x,
      y,
      w: 14,
      h: 14,
      vx: (dir >= 0 ? 1 : -1) * PATROL_SPEED,
      vy: 0,
      alive: true,
    });

    this.squashed = false;
    this.squashTimer = 0;
    this.animTimer = 0;
    this.frameIndex = 0;
  }

  /**
   * Stomp interaction: squash goomba and start removal countdown.
   *
   * @returns {{type: string, squashed: boolean}}
   */
  stomp() {
    if (this.squashed || !this.alive) {
      return { type: 'goomba', squashed: this.squashed };
    }
    this.squashed = true;
    this.squashTimer = SQUASH_DURATION;
    this.vx = 0;
    this.vy = 0;
    return { type: 'goomba', squashed: true };
  }

  /**
   * Block bump beneath goomba (e.g. brick hit).
   *
   * @param {object} [tile]
   */
  onBump(tile) {
    // If bumped from below, knock off screen or kill
    if (this.squashed || !this.alive) return;
    this.vy = -180;
    this.alive = false; // or defeated
  }

  /**
   * Update kinematics, animation and tile collision.
   *
   * @param {number} dt elapsed seconds
   * @param {object} tilemap tilemap instance
   */
  update(dt, tilemap) {
    if (!this.alive) return;

    if (this.squashed) {
      this.squashTimer -= dt;
      if (this.squashTimer <= 0) {
        this.alive = false;
      }
      return;
    }

    // Walking animation cycle
    this.animTimer += dt;
    if (this.animTimer >= ANIM_FRAME_TIME) {
      this.animTimer -= ANIM_FRAME_TIME;
      this.frameIndex = (this.frameIndex + 1) % 2;
    }

    // Apply gravity
    applyGravity(this, false, dt);

    // Resolve tile collisions
    if (tilemap) {
      const collision = moveAndCollide(this, tilemap, dt);
      if (collision.hitWall) {
        // Reverse direction on wall hit
        this.facing = -this.facing;
        this.vx = this.facing * PATROL_SPEED;
      }
    } else {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }
  }

  /**
   * Render goomba sprite.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} [camera]
   */
  draw(ctx, camera) {
    if (!this.alive) return;

    let spriteFrame;
    if (this.squashed) {
      spriteFrame = SPRITES.goomba.squashed;
    } else {
      spriteFrame = this.frameIndex === 0 ? SPRITES.goomba.walk1 : SPRITES.goomba.walk2;
    }

    if (!spriteFrame) return;

    const screenPos = camera ? camera.worldToScreen(this.x, this.y) : { x: this.x, y: this.y };

    // Bounding box is 14x14; sprite is 16x16 (or 16x8 for squashed).
    // Center horizontally: offset by -1px.
    // Align bottom: for 14x14 hitbox vs 16x16 sprite -> offset y by -2px (feet at y + 14).
    // For squashed (16x8) -> feet at y + 14, so top is y + 14 - 8 = y + 6.
    const drawX = Math.round(screenPos.x - 1);
    const drawY = Math.round(screenPos.y + (this.h - spriteFrame.height));

    drawPixels(ctx, spriteFrame, drawX, drawY);
  }
}

/**
 * Factory function to create a Goomba entity.
 *
 * @param {object} config
 * @param {number} [config.x=0]
 * @param {number} [config.y=0]
 * @param {number} [config.dir=-1]
 * @returns {Goomba}
 */
export function createGoomba(config = {}) {
  return new Goomba(config);
}

export default createGoomba;
