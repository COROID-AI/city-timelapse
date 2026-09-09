/**
 * Koopa Troopa enemy entity and Shell state mechanics.
 *
 * Walker (14x24 hitbox) patrolling at 30px/s using applyGravity + moveAndCollide.
 * Reverses on solid wall hits and walks off ledges like classic goombas.
 *
 * koopa.stomp() converts to a 14x14 shell state (type: 'shell').
 * shell.kick(dir) sets |vx| = 220 in the given direction.
 * When a moving shell hits a solid wall, it bounces (reverses vx).
 * A second stomp on a moving shell stops it (vx = 0).
 * No shell wake timer (simplification per design contract).
 */

import { Entity } from './entity.js';
import { applyGravity } from '../physics/body.js';
import { moveAndCollide } from '../collision/tileCollision.js';
import { SPRITES } from '../render/sprites/index.js';
import { drawPixels } from '../render/pixelArt.js';

const PATROL_SPEED = 30; // px/s
const SHELL_SPEED = 220; // px/s
const ANIM_FRAME_TIME = 0.25; // seconds per walking animation frame

export class Koopa extends Entity {
  /**
   * @param {object} options
   * @param {number} [options.x=0]
   * @param {number} [options.y=0]
   * @param {number} [options.dir=-1] Initial direction: -1 (left) or 1 (right)
   * @param {boolean} [options.isShell=false] Whether entity spawns directly as shell
   */
  constructor({ x = 0, y = 0, dir = -1, isShell = false } = {}) {
    super({
      type: isShell ? 'shell' : 'koopa',
      x,
      y,
      w: 14,
      h: isShell ? 14 : 24,
      vx: isShell ? 0 : (dir >= 0 ? 1 : -1) * PATROL_SPEED,
      vy: 0,
      alive: true,
    });

    this.isShell = isShell;
    this.animTimer = 0;
    this.frameIndex = 0;
  }

  /**
   * Stomp interaction:
   * - If walking koopa: transforms into a stationary 14x14 shell (type: 'shell').
   * - If stationary shell: kicks or remains stopped depending on caller / kick.
   * - If moving shell: stops the shell (vx = 0).
   *
   * @returns {{type: string, isShell: boolean, moving: boolean}}
   */
  stomp() {
    if (!this.alive) {
      return { type: this.type, isShell: this.isShell, moving: false };
    }

    if (!this.isShell) {
      // Transition from Koopa (14x24) to Shell (14x14).
      // Align bottom so shell rests on the ground.
      this.isShell = true;
      this.type = 'shell';
      this.y += (24 - 14); // lower top edge so feet stay at ground level
      this.h = 14;
      this.vx = 0;
      this.vy = 0;
      return { type: 'shell', isShell: true, moving: false };
    }

    // It is already a shell.
    if (Math.abs(this.vx) > 0) {
      // Moving shell: second stomp stops it.
      this.vx = 0;
      return { type: 'shell', isShell: true, moving: false };
    }

    // Stationary shell: stomp returns stationary shell state (caller / manager can kick it if desired).
    return { type: 'shell', isShell: true, moving: false };
  }

  /**
   * Kick the shell in the specified direction.
   *
   * @param {-1|1|number} dir Direction to kick (-1 for left, 1 for right). If 0, defaults to facing.
   */
  kick(dir) {
    if (!this.isShell) {
      // Force conversion to shell if kicked directly
      this.isShell = true;
      this.type = 'shell';
      this.y += (this.h - 14);
      this.h = 14;
    }

    const direction = dir !== 0 ? Math.sign(dir) : this.facing;
    const finalDir = direction !== 0 ? direction : 1;
    this.facing = finalDir;
    this.vx = finalDir * SHELL_SPEED;
  }

  /**
   * Block bump beneath koopa/shell.
   *
   * @param {object} [tile]
   */
  onBump(tile) {
    if (!this.alive) return;
    this.vy = -180;
    // If not a shell, convert to shell or defeat
    if (!this.isShell) {
      this.isShell = true;
      this.type = 'shell';
      this.y += (this.h - 14);
      this.h = 14;
      this.vx = 0;
    }
  }

  /**
   * Update kinematics, animation, tile collision and wall bounces.
   *
   * @param {number} dt elapsed seconds
   * @param {object} tilemap tilemap instance
   */
  update(dt, tilemap) {
    if (!this.alive) return;

    if (!this.isShell) {
      // Walking animation cycle
      this.animTimer += dt;
      if (this.animTimer >= ANIM_FRAME_TIME) {
        this.animTimer -= ANIM_FRAME_TIME;
        this.frameIndex = (this.frameIndex + 1) % 2;
      }
    }

    // Apply gravity
    applyGravity(this, false, dt);

    // Track intended moving speed for shell bounce or patrol reversal
    const currentSpeed = Math.abs(this.vx);

    // Resolve tile collisions
    if (tilemap) {
      const collision = moveAndCollide(this, tilemap, dt);
      if (collision.hitWall) {
        // Reverse direction on wall hit
        this.facing = -this.facing;
        if (this.isShell) {
          // Moving shell bounces off walls at SHELL_SPEED (or previous speed)
          const bounceSpeed = currentSpeed > 0 ? currentSpeed : SHELL_SPEED;
          this.vx = this.facing * bounceSpeed;
        } else {
          // Walker reverses at patrol speed
          this.vx = this.facing * PATROL_SPEED;
        }
      }
    } else {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }
  }

  /**
   * Render koopa or shell sprite.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} [camera]
   */
  draw(ctx, camera) {
    if (!this.alive) return;

    let spriteFrame;
    if (this.isShell) {
      spriteFrame = SPRITES.koopa.shell;
    } else {
      spriteFrame = this.frameIndex === 0 ? SPRITES.koopa.walk1 : SPRITES.koopa.walk2;
    }

    if (!spriteFrame) return;

    const screenPos = camera ? camera.worldToScreen(this.x, this.y) : { x: this.x, y: this.y };

    // Koopa walk sprite is 16x16, hitbox is 14x24 (sprite drawn aligned with bottom of hitbox).
    // Koopa shell sprite is 16x10, hitbox is 14x14 (sprite drawn aligned with bottom of hitbox).
    // Facing: walk facing left (dir < 0) uses flipX=false (default sprite faces left),
    // facing right (dir > 0) uses flipX=true.
    const flipX = this.facing > 0;
    const drawX = Math.round(screenPos.x - 1);
    const drawY = Math.round(screenPos.y + (this.h - spriteFrame.height));

    drawPixels(ctx, spriteFrame, drawX, drawY, { flipX });
  }
}

/**
 * Factory function to create a Koopa entity.
 *
 * @param {object} config
 * @param {number} [config.x=0]
 * @param {number} [config.y=0]
 * @param {number} [config.dir=-1]
 * @param {boolean} [config.isShell=false]
 * @returns {Koopa}
 */
export function createKoopa(config = {}) {
  return new Koopa(config);
}

export default createKoopa;
