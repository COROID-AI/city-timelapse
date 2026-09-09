/**
 * Controllable hero entity (Mario) supporting small and super states,
 * horizontal movement with inertia/skid, variable jumps, damage/power-up,
 * bounce, death animation/pit checks, and flagpole slide.
 *
 * Implements the PlayerHandle contract consumed by entity-manager and
 * game-states composition.
 *
 * @module entities/player
 */

import { CONSTANTS } from '../core/constants.js';
import { createBody, updateHorizontal, applyJump, applyGravity } from '../physics/body.js';
import { moveAndCollide } from '../collision/tileCollision.js';
import { drawPixels } from '../render/pixelArt.js';
import { SPRITES } from '../render/sprites/index.js';

const HITBOX = {
  small: { w: 12, h: 14 },
  super: { w: 12, h: 27 },
};

const INVINCIBLE_DURATION = 2.0; // seconds of invincibility after taking damage
const BLINK_INTERVAL = 4; // blink every other 4 frames during invincibility

const DEATH_HOP_INITIAL_DELAY = 0.2; // brief freeze before hop
const DEATH_HOP_VELOCITY = -260; // upward impulse on death hop
const DEATH_GRAVITY = 700; // gravity applied during death hop
const DEATH_DURATION = 2.5; // full death animation before calling onDeath
const FLAG_SLIDE_SPEED = 100; // downward slide speed on flagpole

const STOMP_BOUNCE_NORMAL = -180; // bounce impulse when jump not held
const STOMP_BOUNCE_HELD = -300; // bounce impulse when jump is held

const WALK_ANIM_SPEED = 12; // animation rate scaling for walking frames

/**
 * Creates a controllable Player entity.
 *
 * @param {object} options
 * @param {number} [options.x=0] Initial world X position.
 * @param {number} [options.y=0] Initial world Y position.
 * @param {object} [options.hooks] Callbacks: onBlockHit(tx, ty, info), onDeath().
 * @returns {object} PlayerHandle
 */
export function createPlayer({ x = 0, y = 0, hooks = {} } = {}) {
  let powerState = 'small'; // 'small' | 'super'
  let state = 'idle'; // 'idle' | 'walk' | 'skid' | 'jump' | 'fall' | 'dead' | 'flagSlide'

  const body = createBody({
    x,
    y,
    w: HITBOX.small.w,
    h: HITBOX.small.h,
  });

  let invincibilityTimer = 0;
  let frameCounter = 0;
  let animTimer = 0;
  let walkFrameIndex = 0; // 0, 1, 2 -> walk1, walk2, walk3

  let deathTimer = 0;
  let deathHopApplied = false;
  let deathFired = false;

  let flagSlideLocked = false;
  let flagX = 0;

  /**
   * Triggers player damage.
   * - Ignored if invincible or already dead.
   * - If super: shrinks to small and gains 2s invincibility.
   * - If small: kills the player.
   */
  function damage() {
    if (state === 'dead') return;
    if (isInvincible()) return;

    if (powerState === 'super') {
      powerState = 'small';
      const feetY = body.y + body.h;
      body.w = HITBOX.small.w;
      body.h = HITBOX.small.h;
      body.y = feetY - body.h;
      invincibilityTimer = INVINCIBLE_DURATION;
    } else {
      die();
    }
  }

  /**
   * Grows the player from small to super form.
   */
  function powerUp() {
    if (state === 'dead') return;
    if (powerState === 'small') {
      powerState = 'super';
      const feetY = body.y + body.h;
      body.w = HITBOX.super.w;
      body.h = HITBOX.super.h;
      body.y = feetY - body.h;
    }
  }

  /**
   * Applies stomp bounce velocity.
   *
   * @param {boolean} [jumpHeld=false] Higher bounce when jump key is held.
   */
  function bounce(jumpHeld = false) {
    if (state === 'dead') return;
    body.vy = jumpHeld ? STOMP_BOUNCE_HELD : STOMP_BOUNCE_NORMAL;
    body.onGround = false;
  }

  /**
   * Kills the player, starting the death animation.
   */
  function die() {
    if (state === 'dead') return;
    state = 'dead';
    body.vx = 0;
    body.vy = 0;
    body.onGround = false;
    deathTimer = 0;
    deathHopApplied = false;
    deathFired = false;
  }

  /**
   * Locks the player to the flagpole for the finish sequence.
   *
   * @param {number} poleX Center X position of the flagpole.
   */
  function setFlagSlide(poleX) {
    if (state === 'dead') return;
    state = 'flagSlide';
    flagSlideLocked = true;
    flagX = poleX;
    body.vx = 0;
    body.vy = 0;
    body.facing = 1;
    // Align body X so Mario is holding the pole
    body.x = poleX - 4;
  }

  /**
   * Returns true if the player is currently invincible.
   *
   * @returns {boolean}
   */
  function isInvincible() {
    return invincibilityTimer > 0;
  }

  /**
   * Pass-through block hit hook that augments block info with player powerState.
   */
  function handleBlockHit(tx, ty, info) {
    if (hooks && typeof hooks.onBlockHit === 'function') {
      return hooks.onBlockHit(tx, ty, { ...info, powerState });
    }
    // Default behavior if not overridden:
    // small bumps; super breaks bricks and bumps others
    if (info && info.tile === 'B') {
      return powerState === 'super' ? 'break' : 'bump';
    }
    return 'bump';
  }

  /**
   * Updates player physics, collision, state and timers.
   *
   * @param {number} dt Delta time in seconds.
   * @param {object} [input] Input controller with isDown / wasPressed methods.
   * @param {object} [tilemap] Tilemap instance for collision resolution.
   */
  function update(dt, input, tilemap) {
    frameCounter++;

    if (invincibilityTimer > 0) {
      invincibilityTimer = Math.max(0, invincibilityTimer - dt);
    }

    const pitLine = tilemap
      ? tilemap.pixelHeight ?? (tilemap.height ? tilemap.height * tilemap.tileSize : CONSTANTS.VIEWPORT_HEIGHT)
      : CONSTANTS.VIEWPORT_HEIGHT;

    // --- DEAD STATE ---
    if (state === 'dead') {
      deathTimer += dt;
      if (deathTimer > DEATH_HOP_INITIAL_DELAY) {
        if (!deathHopApplied) {
          body.vy = DEATH_HOP_VELOCITY;
          deathHopApplied = true;
        }
        body.vy = Math.min(body.vy + DEATH_GRAVITY * dt, CONSTANTS.PHYSICS.TERMINAL_VELOCITY);
        body.y += body.vy * dt;
      }

      if ((deathTimer >= DEATH_DURATION || body.y > pitLine + 32) && !deathFired) {
        deathFired = true;
        if (typeof hooks.onDeath === 'function') {
          hooks.onDeath();
        }
      }
      return;
    }

    // Check pit fall while alive (only when tilemap is provided)
    if (tilemap && body.y > pitLine) {
      die();
      return;
    }

    // --- FLAGPOLE SLIDE STATE ---
    if (state === 'flagSlide') {
      body.vx = 0;
      body.x = flagX - 4;
      body.vy = FLAG_SLIDE_SPEED;
      if (tilemap) {
        moveAndCollide(body, tilemap, dt, { onBlockHit: handleBlockHit });
      } else {
        body.y += body.vy * dt;
      }
      return;
    }

    // --- NORMAL GAMEPLAY STATE ---
    const leftHeld = input ? input.isDown('left') : false;
    const rightHeld = input ? input.isDown('right') : false;
    const runHeld = input ? input.isDown('run') : false;
    const jumpPressed = input ? input.wasPressed('jump') : false;
    const jumpHeld = input ? input.isDown('jump') : false;

    let moveDir = 0;
    if (leftHeld && !rightHeld) moveDir = -1;
    else if (rightHeld && !leftHeld) moveDir = 1;

    // 1. Horizontal movement
    updateHorizontal(body, { moveDir, runHeld }, dt);

    // 2. Jump
    if (jumpPressed) {
      applyJump(body);
    }

    // 3. Gravity
    applyGravity(body, jumpHeld, dt);

    // 4. Tile collision resolution
    if (tilemap) {
      moveAndCollide(body, tilemap, dt, { onBlockHit: handleBlockHit });
    } else {
      body.x += body.vx * dt;
      body.y += body.vy * dt;
    }

    // 5. State / Animation determination
    const reversing = body.vx !== 0 && moveDir !== 0 && Math.sign(body.vx) !== moveDir;

    if (!body.onGround) {
      if (body.vy < 0) {
        state = 'jump';
      } else {
        state = 'fall';
      }
    } else if (reversing && Math.abs(body.vx) > 10) {
      state = 'skid';
    } else if (Math.abs(body.vx) > 1) {
      state = 'walk';
      animTimer += Math.abs(body.vx) * dt * 0.1 * WALK_ANIM_SPEED;
      walkFrameIndex = Math.floor(animTimer) % 3;
    } else {
      state = 'idle';
      animTimer = 0;
      walkFrameIndex = 0;
    }
  }

  /**
   * Draws the player sprite onto the canvas context.
   *
   * @param {CanvasRenderingContext2D} ctx 2D rendering context.
   * @param {object} [camera] Optional camera with worldToScreen() or {x, y} offset.
   */
  function draw(ctx, camera) {
    if (!ctx) return;

    // Invincibility flicker: skip draw every other 4 frames
    if (isInvincible() && state !== 'dead') {
      if (Math.floor(frameCounter / BLINK_INTERVAL) % 2 === 1) {
        return;
      }
    }

    let screenX = body.x;
    let screenY = body.y;

    if (camera) {
      if (typeof camera.worldToScreen === 'function') {
        const p = camera.worldToScreen(body.x, body.y);
        screenX = p.x;
        screenY = p.y;
      } else {
        screenX = body.x - (camera.x || 0);
        screenY = body.y - (camera.y || 0);
      }
    }

    const spriteGroup = powerState === 'super' ? SPRITES.marioSuper : SPRITES.marioSmall;

    let frameName = 'idle';
    if (state === 'dead') {
      frameName = 'death';
    } else if (state === 'flagSlide') {
      frameName = 'flagSlide';
    } else if (state === 'jump' || state === 'fall') {
      frameName = 'jump';
    } else if (state === 'skid') {
      frameName = 'skid';
    } else if (state === 'walk') {
      frameName = `walk${walkFrameIndex + 1}`;
    } else {
      frameName = 'idle';
    }

    const frame = (spriteGroup && spriteGroup[frameName]) || SPRITES.marioSmall.idle;
    const flipX = body.facing === -1;

    // Sprite alignment:
    // Small Mario sprite is 16x16, body hitbox is 12x14.
    // Super Mario sprite is 16x32, body hitbox is 12x27.
    // Align sprite bottom with hitbox bottom, and center horizontally (offset -2px).
    const drawX = Math.round(screenX - (frame.width - body.w) / 2);
    const drawY = Math.round(screenY - (frame.height - body.h));

    drawPixels(ctx, frame, drawX, drawY, { scale: 1, flipX });
  }

  return {
    body,
    get state() {
      return state;
    },
    get powerState() {
      return powerState;
    },
    update,
    draw,
    damage,
    powerUp,
    bounce,
    die,
    setFlagSlide,
    isInvincible,
  };
}

export default createPlayer;
