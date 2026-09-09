/**
 * Entity manager & gameplay interactions layer (src/entities/entityManager.js).
 *
 * Owns the active entity registry and resolves gameplay interactions:
 *  - Lifecycle: add, update, draw, clear, dispose
 *  - Culling: removes entities that are dead or left of camera.x
 *  - Enemy-vs-enemy resolution: bounces overlapping walkers apart
 *  - Moving shells: kill other enemies with chained combo scoring (100→200→400→800)
 *  - Player-vs-entity resolution:
 *      - Downward overlap (player.vy > 0 and previous bottom <= entity.top + 4):
 *        stomp() + player.bounce(jumpHeld) + 100 score popup
 *      - Side contact with enemies/moving shells: hooks.onPlayerDamaged() & player.damage()
 *      - Idle shells: kicked away from contact side via shell.kick(dir)
 *      - Mushroom item: onCollect() -> hooks.onPowerUp() + 1000 score
 *      - Coin pop: expiry -> hooks.onCoin() + 200 score
 *  - Block-hit routing (hooks.onBlockHit):
 *      - Breaks brick on super player -> spawns 4 brick fragments + 50 score
 *      - Bumps block -> spawns coinPop or mushroom above the tile
 *      - Flips / kills enemies standing on the bumped tile
 */

import { createMushroom } from './mushroom.js';
import { createCoinPop } from './coinPop.js';
import { spawnBrickFragments, spawnScorePopup } from '../fx/particles.js';
import { CONSTANTS } from '../core/constants.js';

const COMBO_SCORES = [100, 200, 400, 800];
const WALKER_PATROL_SPEED = 30;

/**
 * Checks AABB overlap between two bodies/entities.
 */
function isOverlapping(a, b) {
  if (!a || !b) return false;
  const aX = a.x ?? a.body?.x ?? 0;
  const aY = a.y ?? a.body?.y ?? 0;
  const aW = a.w ?? a.body?.w ?? 0;
  const aH = a.h ?? a.body?.h ?? 0;

  const bX = b.x ?? b.body?.x ?? 0;
  const bY = b.y ?? b.body?.y ?? 0;
  const bW = b.w ?? b.body?.w ?? 0;
  const bH = b.h ?? b.body?.h ?? 0;

  return (
    aX < bX + bW &&
    aX + aW > bX &&
    aY < bY + bH &&
    aY + aH > bY
  );
}

/**
 * Helper to identify entity categories.
 */
function isShell(entity) {
  return Boolean(entity && (entity.isShell || entity.type === 'shell'));
}

function isMovingShell(entity) {
  return isShell(entity) && Math.abs(entity.vx || 0) > 0;
}

function isIdleShell(entity) {
  return isShell(entity) && Math.abs(entity.vx || 0) === 0;
}

function isWalker(entity) {
  if (!entity || !entity.alive) return false;
  if (entity.squashed) return false;
  if (isShell(entity)) return false;
  return entity.type === 'goomba' || entity.type === 'koopa';
}

function isEnemy(entity) {
  if (!entity || !entity.alive) return false;
  return entity.type === 'goomba' || entity.type === 'koopa' || isShell(entity);
}

/**
 * Creates an entity manager instance.
 *
 * @param {object} options
 * @param {object} [options.tilemap] Tilemap instance for collision & block bumps
 * @param {object} [options.camera] Camera instance for culling & rendering
 * @param {object} [options.hooks] Gameplay event callbacks
 * @param {function} [options.hooks.onScore] (score: number) => void
 * @param {function} [options.hooks.onCoin] () => void
 * @param {function} [options.hooks.onPlayerDamaged] () => void
 * @param {function} [options.hooks.onPowerUp] (type: string) => void
 * @param {function} [options.hooks.onBlockHit] (tx: number, ty: number, info: object) => string
 * @returns {object} EntityManagerHandle
 */
export function createEntityManager({ tilemap = null, camera = null, hooks = {} } = {}) {
  let entityRegistry = [];
  let playerPrevBottom = null;

  /**
   * Adds one or more entities to the registry.
   *
   * @param {...object|object[]} items Entity instance(s) or array
   */
  function add(...items) {
    for (const item of items) {
      if (Array.isArray(item)) {
        add(...item);
      } else if (item && typeof item === 'object') {
        entityRegistry.push(item);
      }
    }
  }

  /**
   * Flips / kills any enemies standing directly on top of tile (tx, ty).
   *
   * @param {number} tx Tile column
   * @param {number} ty Tile row
   */
  function flipEnemiesOnBlock(tx, ty) {
    const tileSize = tilemap?.tileSize ?? CONSTANTS.TILE_SIZE ?? 16;
    const blockTopY = ty * tileSize;
    const blockLeftX = tx * tileSize;
    const blockRightX = (tx + 1) * tileSize;

    for (const entity of entityRegistry) {
      if (!entity || !entity.alive || !isEnemy(entity)) continue;

      const entityFeet = entity.y + entity.h;
      const entityLeft = entity.x;
      const entityRight = entity.x + entity.w;

      const horizOverlap = entityRight > blockLeftX && entityLeft < blockRightX;
      const onTop = Math.abs(entityFeet - blockTopY) <= 4 || (entityFeet >= blockTopY - 4 && entityFeet <= blockTopY + 4);

      if (horizOverlap && onTop) {
        if (typeof entity.onBump === 'function') {
          entity.onBump({ tx, ty });
        } else {
          entity.vy = -180;
          entity.alive = false;
        }

        // Award score & popup for bump-flip kill
        if (typeof hooks.onScore === 'function') {
          hooks.onScore(100);
        }
        const popup = spawnScorePopup(100, entity.x, entity.y);
        add(popup);
      }
    }
  }

  /**
   * Handles a head-hit on a block at (tx, ty) with tile collision info.
   *
   * @param {number} tx Tile column
   * @param {number} ty Tile row
   * @param {object} [info] Collision context (tile, powerState, etc.)
   * @returns {'break'|'bump'|'ignore'} Action applied
   */
  function handleBlockHit(tx, ty, info = {}) {
    const tileSize = tilemap?.tileSize ?? CONSTANTS.TILE_SIZE ?? 16;
    const tileCode = info.tile ?? tilemap?.tileAt?.(tx, ty);
    const powerState = info.powerState;

    // Super Mario breaking a breakable brick block
    if (tileCode === 'B' && powerState === 'super') {
      const fragments = spawnBrickFragments(tx * tileSize, ty * tileSize);
      add(fragments);

      if (typeof hooks.onScore === 'function') {
        hooks.onScore(50);
      }

      if (tilemap) {
        tilemap.bumpBlock?.(tx, ty);
        tilemap.setTile?.(tx, ty, ' ');
      }

      flipEnemiesOnBlock(tx, ty);

      if (typeof hooks.onBlockHit === 'function') {
        hooks.onBlockHit(tx, ty, { ...info, action: 'break' });
      }

      return 'break';
    }

    // Normal block bump (? block, mushroom block, multi-coin block, or small Mario brick)
    let bumpResult = null;
    if (tilemap && typeof tilemap.bumpBlock === 'function') {
      bumpResult = tilemap.bumpBlock(tx, ty);
    }

    if (bumpResult) {
      if (bumpResult.type === 'coin' || bumpResult.type === 'multi') {
        const coin = createCoinPop({ x: tx * tileSize, y: (ty - 1) * tileSize });
        add(coin);
      } else if (bumpResult.type === 'mushroom') {
        const mushroom = createMushroom({ x: tx * tileSize + 1, y: ty * tileSize });
        add(mushroom);
      }
    }

    flipEnemiesOnBlock(tx, ty);

    if (typeof hooks.onBlockHit === 'function') {
      hooks.onBlockHit(tx, ty, { ...info, bumpResult, action: 'bump' });
    }

    return 'bump';
  }

  /**
   * Updates entity physics, interactions and culls dead/offscreen entities.
   *
   * @param {number} dt Delta time in seconds
   * @param {object} [player] Player entity handle
   * @param {object} [input] Input controller handle or state
   */
  function update(dt, player = null, input = null) {
    if (dt <= 0) return;

    // 1. Update tilemap bump animations
    if (tilemap && typeof tilemap.updateBumpAnimations === 'function') {
      tilemap.updateBumpAnimations(dt);
    } else if (tilemap && typeof tilemap.update === 'function') {
      tilemap.update(dt);
    }

    const spawnedThisFrame = [];

    // 2. Update all active entities
    for (let i = 0; i < entityRegistry.length; i++) {
      const entity = entityRegistry[i];
      if (!entity || !entity.alive) continue;

      const res = entity.update?.(dt, tilemap);

      // Check coin pop expiry
      if (entity.type === 'coinPop' && (entity.expired || (res && res.expired))) {
        if (typeof hooks.onCoin === 'function') {
          hooks.onCoin();
        }
        if (typeof hooks.onScore === 'function') {
          hooks.onScore(res?.score ?? 200);
        }
      }

      // If a shell came to a stop, reset its kill combo
      if (isShell(entity) && Math.abs(entity.vx || 0) === 0) {
        entity._combo = 0;
      }
    }

    // 3. Resolve Enemy-vs-Enemy interactions
    const count = entityRegistry.length;
    for (let i = 0; i < count; i++) {
      const eA = entityRegistry[i];
      if (!eA || !eA.alive) continue;

      for (let j = i + 1; j < count; j++) {
        const eB = entityRegistry[j];
        if (!eB || !eB.alive) continue;

        if (!isOverlapping(eA, eB)) continue;

        // Case A: Moving shell vs other enemy (Goomba, Koopa, or idle shell)
        if (isMovingShell(eA) && isEnemy(eB) && !isMovingShell(eB)) {
          eB.alive = false;
          if (typeof eB.onBump === 'function') {
            eB.onBump();
          }
          eB.alive = false;

          const comboIdx = eA._combo || 0;
          const score = COMBO_SCORES[Math.min(comboIdx, COMBO_SCORES.length - 1)];
          eA._combo = comboIdx + 1;

          if (typeof hooks.onScore === 'function') {
            hooks.onScore(score);
          }
          const popup = spawnScorePopup(score, eB.x, eB.y);
          spawnedThisFrame.push(popup);
          continue;
        }

        if (isMovingShell(eB) && isEnemy(eA) && !isMovingShell(eA)) {
          eA.alive = false;
          if (typeof eA.onBump === 'function') {
            eA.onBump();
          }
          eA.alive = false;

          const comboIdx = eB._combo || 0;
          const score = COMBO_SCORES[Math.min(comboIdx, COMBO_SCORES.length - 1)];
          eB._combo = comboIdx + 1;

          if (typeof hooks.onScore === 'function') {
            hooks.onScore(score);
          }
          const popup = spawnScorePopup(score, eA.x, eA.y);
          spawnedThisFrame.push(popup);
          continue;
        }

        // Case B: Two moving shells collide -> bounce apart
        if (isMovingShell(eA) && isMovingShell(eB)) {
          if (eA.x <= eB.x) {
            eA.facing = -1;
            eA.vx = -Math.abs(eA.vx);
            eB.facing = 1;
            eB.vx = Math.abs(eB.vx);
          } else {
            eA.facing = 1;
            eA.vx = Math.abs(eA.vx);
            eB.facing = -1;
            eB.vx = -Math.abs(eB.vx);
          }
          continue;
        }

        // Case C: Walker vs Walker -> bounce apart
        if (isWalker(eA) && isWalker(eB)) {
          const speedA = Math.abs(eA.vx) || WALKER_PATROL_SPEED;
          const speedB = Math.abs(eB.vx) || WALKER_PATROL_SPEED;

          if (eA.x <= eB.x) {
            eA.facing = -1;
            eA.vx = -speedA;
            eB.facing = 1;
            eB.vx = speedB;
          } else {
            eA.facing = 1;
            eA.vx = speedA;
            eB.facing = -1;
            eB.vx = -speedB;
          }
          continue;
        }

        // Case D: Walker vs Idle shell -> walker reverses
        if (isWalker(eA) && isIdleShell(eB)) {
          const speedA = Math.abs(eA.vx) || WALKER_PATROL_SPEED;
          eA.facing = eA.x <= eB.x ? -1 : 1;
          eA.vx = eA.facing * speedA;
          continue;
        }
        if (isWalker(eB) && isIdleShell(eA)) {
          const speedB = Math.abs(eB.vx) || WALKER_PATROL_SPEED;
          eB.facing = eB.x <= eA.x ? -1 : 1;
          eB.vx = eB.facing * speedB;
          continue;
        }
      }
    }

    // 4. Resolve Player-vs-Entity interactions
    if (player) {
      const pBody = player.body || player;
      const pVy = pBody.vy || 0;
      const pBottom = pBody.y + pBody.h;
      const calculatedPrevBottom = pBottom - pVy * dt;
      const prevBottom = playerPrevBottom != null ? playerPrevBottom : calculatedPrevBottom;

      const jumpHeld = Boolean(
        input?.jumpHeld ??
        (typeof input?.isDown === 'function' ? input.isDown('jump') : false)
      );

      for (let i = 0; i < entityRegistry.length; i++) {
        const entity = entityRegistry[i];
        if (!entity || !entity.alive) continue;
        if (entity.squashed) continue;

        if (!isOverlapping(pBody, entity)) continue;

        // Subcase A: Mushroom item collection
        if (entity.type === 'mushroom') {
          const result = entity.onCollect ? entity.onCollect() : { score: 1000, powerup: 'super' };
          entity.alive = false;

          player.powerUp?.();

          if (typeof hooks.onPowerUp === 'function') {
            hooks.onPowerUp(result.powerup || 'super');
          }
          const score = result.score || 1000;
          if (typeof hooks.onScore === 'function') {
            hooks.onScore(score);
          }
          const popup = spawnScorePopup(score, entity.x, entity.y);
          spawnedThisFrame.push(popup);
          continue;
        }

        // Subcase B: Coins and particles don't hurt player
        if (entity.type === 'coinPop' || entity.type === 'brickFragment' || entity.type === 'scorePopup') {
          continue;
        }

        // Subcase C: Enemies (Goomba, Koopa, Shell)
        if (isEnemy(entity)) {
          // Downward stomp condition: falling + previous bottom above entity top + 4
          const isStomp = pVy > 0 && (prevBottom <= entity.y + 4 || calculatedPrevBottom <= entity.y + 4);

          if (isStomp) {
            entity.stomp?.();
            player.bounce?.(jumpHeld);

            if (typeof hooks.onScore === 'function') {
              hooks.onScore(100);
            }
            const popup = spawnScorePopup(100, entity.x, entity.y);
            spawnedThisFrame.push(popup);

            if (isShell(entity)) {
              entity._combo = 0;
            }
          } else {
            // Side / non-stomp contact
            if (isShell(entity)) {
              if (Math.abs(entity.vx || 0) === 0) {
                // Idle shell: kick away from player's contact side
                const playerCenterX = pBody.x + pBody.w / 2;
                const shellCenterX = entity.x + entity.w / 2;
                const kickDir = playerCenterX <= shellCenterX ? 1 : -1;
                entity.kick?.(kickDir);
                entity._combo = 0;
              } else {
                // Moving shell damages player
                const isInvincible = player.isInvincible ? player.isInvincible() : false;
                if (!isInvincible && player.state !== 'dead') {
                  if (typeof hooks.onPlayerDamaged === 'function') {
                    hooks.onPlayerDamaged();
                  }
                  player.damage?.();
                }
              }
            } else {
              // Regular enemy damages player
              const isInvincible = player.isInvincible ? player.isInvincible() : false;
              if (!isInvincible && player.state !== 'dead') {
                if (typeof hooks.onPlayerDamaged === 'function') {
                  hooks.onPlayerDamaged();
                }
                player.damage?.();
              }
            }
          }
        }
      }

      // Record current frame's bottom for next frame stomp evaluation
      playerPrevBottom = pBody.y + pBody.h;
    }

    // 5. Append newly spawned popups / entities
    if (spawnedThisFrame.length > 0) {
      add(spawnedThisFrame);
    }

    // 6. Culling: remove entities that are dead or left of camera.x
    const camX = camera ? camera.x : 0;
    entityRegistry = entityRegistry.filter((entity) => {
      if (!entity || !entity.alive) {
        entity?.dispose?.();
        return false;
      }

      // Check if entity is left of camera.x
      if (camera && typeof camera.x === 'number') {
        const rightEdge = entity.x + (entity.w || 16);
        if (rightEdge < camX) {
          entity.dispose?.();
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Renders all active entities in order.
   *
   * @param {CanvasRenderingContext2D} ctx Canvas 2D context
   * @param {object} [overrideCamera] Optional camera override
   */
  function draw(ctx, overrideCamera = null) {
    if (!ctx) return;
    const activeCamera = overrideCamera || camera;
    for (let i = 0; i < entityRegistry.length; i++) {
      const entity = entityRegistry[i];
      if (entity && entity.alive && typeof entity.draw === 'function') {
        entity.draw(ctx, activeCamera);
      }
    }
  }

  /**
   * Disposes of and clears all registered entities.
   */
  function clear() {
    for (const entity of entityRegistry) {
      entity?.dispose?.();
    }
    entityRegistry = [];
    playerPrevBottom = null;
  }

  function dispose() {
    clear();
  }

  return {
    get entities() {
      return entityRegistry;
    },
    get camera() {
      return camera;
    },
    set camera(val) {
      camera = val;
    },
    get tilemap() {
      return tilemap;
    },
    set tilemap(val) {
      tilemap = val;
    },
    get hooks() {
      return hooks;
    },
    add,
    update,
    draw,
    clear,
    dispose,
    handleBlockHit,
    onBlockHit: handleBlockHit,
  };
}

export default createEntityManager;
