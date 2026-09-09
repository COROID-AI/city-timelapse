/**
 * Main game composition (src/game/game.js).
 *
 * Wires together the complete Super Mario Bros. engine stack:
 *  - Core: CONSTANTS, createGameLoop (fixed timestep), createInput, createCamera
 *  - World: LEVEL_ONE, createTilemap
 *  - Entities: createPlayer, createEntityManager (populated with Goombas and Koopas)
 *  - State: createGameState (TITLE, PLAYING, DYING, LEVEL_COMPLETE, GAME_OVER)
 *  - Render: layered pipeline (sky, scenery, tiles with bump offsets, entities, player, HUD, overlays)
 *
 * Implements the GameHandle contract consumed by main.js and headless integration tests.
 *
 * @module game/game
 */

import { CONSTANTS } from '../core/constants.js';
import { createGameLoop, SIM_STEP_SECONDS } from '../core/loop.js';
import { createInput } from '../core/input.js';
import { createCamera } from '../core/camera.js';
import { createTilemap, TILES } from '../world/tilemap.js';
import { LEVEL_ONE } from '../levels/level1.js';
import { createPlayer } from '../entities/player.js';
import { createGoomba } from '../entities/goomba.js';
import { createKoopa } from '../entities/koopa.js';
import { createEntityManager } from '../entities/entityManager.js';
import { createGameState, GAME_STATES } from './gameState.js';
import { drawPixels } from '../render/pixelArt.js';
import { SPRITES } from '../render/sprites/index.js';
import { drawHud } from '../ui/hud.js';
import { drawText } from '../ui/pixelFont.js';

/**
 * Default enemy placements inspired by World 1-1.
 */
export const DEFAULT_LEVEL_ONE_ENEMIES = [
  { type: 'goomba', x: 22 * 16, y: 194 },
  { type: 'goomba', x: 40 * 16, y: 194 },
  { type: 'goomba', x: 51 * 16, y: 194 },
  { type: 'goomba', x: 53 * 16, y: 194 },
  { type: 'goomba', x: 80 * 16, y: 66 },
  { type: 'goomba', x: 82 * 16, y: 66 },
  { type: 'goomba', x: 97 * 16, y: 194 },
  { type: 'goomba', x: 99 * 16, y: 194 },
  { type: 'koopa', x: 107 * 16, y: 184 },
  { type: 'goomba', x: 114 * 16, y: 194 },
  { type: 'goomba', x: 116 * 16, y: 194 },
  { type: 'goomba', x: 124 * 16, y: 194 },
  { type: 'goomba', x: 126 * 16, y: 194 },
  { type: 'goomba', x: 174 * 16, y: 194 },
  { type: 'goomba', x: 176 * 16, y: 194 },
];

/**
 * Creates and initializes the complete game instance.
 *
 * @param {object} options
 * @param {HTMLCanvasElement|object} options.canvas Canvas element or 2D context mock
 * @param {function} [options.requestFrame] Custom rAF provider for headless tests
 * @param {function} [options.cancelFrame] Custom cancelAnimationFrame provider
 * @param {object} [options.target] Keyboard event target (window or fake)
 * @param {object} [options.level=LEVEL_ONE] Level configuration
 * @param {number} [options.initialLives=3] Number of starting lives
 * @param {Array<object>} [options.enemies] Custom enemy spawn list
 * @returns {object} GameHandle
 */
export function createGame({
  canvas,
  requestFrame,
  cancelFrame,
  target,
  level = LEVEL_ONE,
  initialLives = 3,
  enemies = null,
} = {}) {
  if (!canvas) {
    throw new Error('createGame requires a canvas or context target');
  }

  const ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : canvas;

  // 1. Input controller
  let inputTarget = target;
  if (!inputTarget && typeof window !== 'undefined') {
    inputTarget = window;
  }
  if (!inputTarget) {
    inputTarget = {
      addEventListener() {},
      removeEventListener() {},
    };
  }
  const input = createInput({ target: inputTarget });

  // 2. Game state machine
  const gameState = createGameState({
    level,
    initialLives,
  });

  // 3. Tilemap & Camera setup
  const tileSize = level.tileSize || CONSTANTS.TILE_SIZE || 16;
  const levelPixelWidth = level.width * tileSize;
  const levelPixelHeight = level.height * tileSize;

  let tilemap = createTilemap(level.gridRows, { tileSize });
  let camera = createCamera({
    viewportWidth: CONSTANTS.VIEWPORT_WIDTH,
    viewportHeight: CONSTANTS.VIEWPORT_HEIGHT,
    levelWidth: levelPixelWidth,
    levelHeight: levelPixelHeight,
  });

  // Flagpole parameters
  const flagPixelX = level.flagPixelX ?? (level.flagX ? level.flagX * tileSize : 198 * tileSize);
  const castlePixelX = level.castlePixelX ?? (level.castleX ? level.castleX * tileSize : 204 * tileSize);
  let flagY = 2 * tileSize; // top of the pole

  let animTimer = 0;

  // 4. Entity Manager setup
  const entityManager = createEntityManager({
    tilemap,
    camera,
    hooks: {
      onScore: (score) => gameState.addScore(score),
      onCoin: () => gameState.addCoin(1),
      onPlayerDamaged: () => {
        if (player.powerState === 'small' && !player.isInvincible()) {
          gameState.beginDeath();
        }
      },
    },
  });

  // Helper to spawn enemy instances
  function spawnEnemies() {
    const enemyDefs = enemies || DEFAULT_LEVEL_ONE_ENEMIES;
    for (const def of enemyDefs) {
      if (def.type === 'koopa') {
        entityManager.add(createKoopa({ x: def.x, y: def.y, dir: def.dir ?? -1, isShell: def.isShell ?? false }));
      } else {
        entityManager.add(createGoomba({ x: def.x, y: def.y, dir: def.dir ?? -1 }));
      }
    }
  }

  // 5. Player instance
  let player = null;

  function handlePlayerDeath() {
    gameState.onDeathAnimationComplete();
    if (gameState.state === GAME_STATES.PLAYING) {
      // Respawn with remaining life
      resetWorld(false);
    }
  }

  function initPlayer(spawnX = level.spawn.x, spawnY = level.spawn.y) {
    player = createPlayer({
      x: spawnX,
      y: spawnY,
      hooks: {
        onBlockHit: (tx, ty, info) => entityManager.handleBlockHit(tx, ty, info),
        onDeath: handlePlayerDeath,
      },
    });
  }

  function resetWorld(fullReset = true) {
    if (fullReset) {
      tilemap = createTilemap(level.gridRows, { tileSize });
      entityManager.tilemap = tilemap;
    }
    camera = createCamera({
      viewportWidth: CONSTANTS.VIEWPORT_WIDTH,
      viewportHeight: CONSTANTS.VIEWPORT_HEIGHT,
      levelWidth: levelPixelWidth,
      levelHeight: levelPixelHeight,
    });
    entityManager.camera = camera;
    entityManager.clear();
    spawnEnemies();
    flagY = 2 * tileSize;
    initPlayer(level.spawn.x, level.spawn.y);
  }

  // Initial population
  resetWorld(true);

  // 6. Simulation step (fixed timestep)
  function update(dt = SIM_STEP_SECONDS) {
    animTimer += dt;

    // Handle Start action (Enter key) on Title / Game Over / Level Complete
    if (input.wasPressed('start')) {
      if (
        gameState.state === GAME_STATES.TITLE ||
        gameState.state === GAME_STATES.GAME_OVER ||
        gameState.state === GAME_STATES.LEVEL_COMPLETE
      ) {
        gameState.pressStart();
        resetWorld(true);
      }
    }

    // Advance state machine clock
    const clockStatus = gameState.update(dt);
    if (clockStatus === 'timeout' && player.state !== 'dead') {
      player.die();
      gameState.beginDeath();
    }

    const state = gameState.state;

    // --- PLAYING STATE ---
    if (state === GAME_STATES.PLAYING) {
      const flagPhase = gameState.flagPhase;

      if (flagPhase === 'none') {
        // Normal gameplay
        player.update(dt, input, tilemap);
        camera.follow(player.body.x);
        entityManager.update(dt, player, input);

        // Check if player died during physics/hazard update
        if (player.state === 'dead') {
          gameState.beginDeath();
        }

        // Check flagpole contact
        if (player.body.x + player.body.w >= flagPixelX && player.state !== 'dead') {
          player.setFlagSlide(flagPixelX);
          gameState.beginFlagSequence();
        }
      } else if (flagPhase === 'slide') {
        // Flagpole sliding animation
        player.update(dt, null, tilemap);
        flagY = Math.min(11 * tileSize, Math.max(2 * tileSize, player.body.y));

        // Slide lands on ground / base block
        if (player.body.onGround || player.body.y >= 12 * tileSize - player.body.h) {
          gameState.flagSlideLanded();
          player.clearFlagSlide?.();
          // Step Mario to the right side of the pole for the castle walk
          player.body.x = flagPixelX + 8;
          player.body.vx = 60;
          player.body.facing = 1;
        }
      } else if (flagPhase === 'walk') {
        // Auto-walking right to the castle
        const autoWalkInput = {
          isDown: (action) => action === 'right',
          wasPressed: () => false,
        };
        player.update(dt, autoWalkInput, tilemap);
        camera.follow(player.body.x);
        entityManager.update(dt, player, autoWalkInput);

        // Reached castle entrance
        if (player.body.x >= castlePixelX + 8) {
          gameState.completeFlagWalk();
        }
      }
    } else if (state === GAME_STATES.DYING) {
      // Death animation playing out
      player.update(dt, null, tilemap);
      entityManager.update(dt, null, null);
    } else {
      // TITLE, GAME_OVER, LEVEL_COMPLETE
      tilemap.update(dt);
      entityManager.update(dt, null, null);
    }

    input.endFrame();
  }

  // 7. Render pipeline (layered)
  function render() {
    if (!ctx) return;

    // Layer 1: Sky fill
    ctx.fillStyle = CONSTANTS.COLORS.sky;
    ctx.fillRect(0, 0, CONSTANTS.VIEWPORT_WIDTH, CONSTANTS.VIEWPORT_HEIGHT);

    // Layer 2: Scenery (clouds, hills, bushes)
    if (level.scenery) {
      // Clouds
      if (Array.isArray(level.scenery.clouds)) {
        for (const cloud of level.scenery.clouds) {
          const screen = camera.worldToScreen(cloud.x, cloud.y);
          const count = cloud.type === 'triple' ? 3 : (cloud.type === 'double' ? 2 : 1);
          for (let i = 0; i < count; i++) {
            const sx = screen.x + i * 16;
            if (sx + 16 >= 0 && sx < CONSTANTS.VIEWPORT_WIDTH) {
              drawPixels(ctx, SPRITES.scenery.cloud, Math.round(sx), Math.round(screen.y));
            }
          }
        }
      }
      // Hills
      if (Array.isArray(level.scenery.hills)) {
        for (const hill of level.scenery.hills) {
          const screen = camera.worldToScreen(hill.x, hill.y);
          const count = hill.type === 'large' ? 3 : 1;
          for (let i = 0; i < count; i++) {
            const sx = screen.x + i * 16;
            if (sx + 16 >= 0 && sx < CONSTANTS.VIEWPORT_WIDTH) {
              drawPixels(ctx, SPRITES.scenery.hill, Math.round(sx), Math.round(screen.y));
            }
          }
        }
      }
      // Bushes
      if (Array.isArray(level.scenery.bushes)) {
        for (const bush of level.scenery.bushes) {
          const screen = camera.worldToScreen(bush.x, bush.y);
          const count = bush.type === 'triple' ? 3 : (bush.type === 'double' ? 2 : 1);
          for (let i = 0; i < count; i++) {
            const sx = screen.x + i * 16;
            if (sx + 16 >= 0 && sx < CONSTANTS.VIEWPORT_WIDTH) {
              drawPixels(ctx, SPRITES.scenery.bush, Math.round(sx), Math.round(screen.y));
            }
          }
        }
      }
    }

    // Layer 3: Castle facade (80x80 backdrop at cols 202-206, rows 8-12)
    const castleScreen = camera.worldToScreen(202 * tileSize, 8 * tileSize);
    if (castleScreen.x + 80 >= 0 && castleScreen.x < CONSTANTS.VIEWPORT_WIDTH) {
      drawPixels(ctx, SPRITES.tiles.castle, Math.round(castleScreen.x), Math.round(castleScreen.y));
    }

    // Layer 4: Tiles with bump offsets
    const minTx = Math.max(0, Math.floor(camera.x / tileSize));
    const maxTx = Math.min(tilemap.width - 1, Math.ceil((camera.x + CONSTANTS.VIEWPORT_WIDTH) / tileSize));
    const minTy = 0;
    const maxTy = tilemap.height - 1;

    // Shimmering question block animation frame
    const qCycle = Math.floor(animTimer * 4) % 3;
    const questionSprite =
      qCycle === 0 ? SPRITES.tiles.question1 : (qCycle === 1 ? SPRITES.tiles.question2 : SPRITES.tiles.question3);

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        const code = tilemap.tileAt(tx, ty);
        if (!code || code === ' ' || code === 'C') continue;

        let sprite = null;
        switch (code) {
          case 'X':
          case '#':
            sprite = SPRITES.tiles.ground;
            break;
          case 'B':
          case 'm':
            sprite = SPRITES.tiles.brick;
            break;
          case '?':
          case 'M':
            sprite = questionSprite;
            break;
          case 'U':
            sprite = SPRITES.tiles.usedBlock;
            break;
          case '[':
            sprite = SPRITES.tiles.pipeTopLeft;
            break;
          case ']':
            sprite = SPRITES.tiles.pipeTopRight;
            break;
          case '{':
            sprite = SPRITES.tiles.pipeBodyLeft;
            break;
          case '}':
            sprite = SPRITES.tiles.pipeBodyRight;
            break;
          case 'F':
            sprite = SPRITES.tiles.flagpole;
            break;
          default:
            break;
        }

        if (sprite) {
          const bumpY = tilemap.getBumpOffset(tx, ty);
          const screen = camera.worldToScreen(tx * tileSize, ty * tileSize + bumpY);
          drawPixels(ctx, sprite, Math.round(screen.x), Math.round(screen.y));
        }
      }
    }

    // Flagpole flag
    const flagScreen = camera.worldToScreen(flagPixelX - 8, flagY);
    if (flagScreen.x + 16 >= 0 && flagScreen.x < CONSTANTS.VIEWPORT_WIDTH) {
      drawPixels(ctx, SPRITES.tiles.flag, Math.round(flagScreen.x), Math.round(flagScreen.y));
    }

    // Layer 5: Entities & Particles (Goombas, Koopas, shells, mushrooms, coinPops, fragments, popups)
    entityManager.draw(ctx, camera);

    // Layer 6: Player
    if (gameState.state !== GAME_STATES.TITLE) {
      player.draw(ctx, camera);
    }

    // Layer 7: Overlays (Title / Game Over / Level Complete)
    if (gameState.state === GAME_STATES.TITLE) {
      drawText(ctx, 'SUPER MARIO BROS', 68, 70, { color: '#ffffff' });
      drawText(ctx, 'PRESS ENTER TO PLAY', 56, 120, { color: '#ffffff' });
      drawText(ctx, '©2026 FACTORY', 86, 160, { color: '#ffffff' });
    } else if (gameState.state === GAME_STATES.GAME_OVER) {
      drawText(ctx, 'GAME OVER', 100, 100, { color: '#ffffff' });
      drawText(ctx, 'PRESS ENTER', 94, 130, { color: '#ffffff' });
    } else if (gameState.state === GAME_STATES.LEVEL_COMPLETE) {
      drawText(ctx, 'COURSE CLEAR!', 88, 70, { color: '#ffffff' });
      drawText(ctx, 'PRESS ENTER', 94, 120, { color: '#ffffff' });
    }

    // Layer 8: HUD (MARIO 000000  ©00  WORLD 1-1  TIME 400  ×3)
    drawHud(ctx, gameState.stats);
  }

  // 8. Fixed-timestep game loop
  const loop = createGameLoop({
    update: () => update(SIM_STEP_SECONDS),
    render,
    requestFrame,
    cancelFrame,
  });

  function start() {
    input.attach();
    loop.start();
  }

  function stop() {
    loop.stop();
    input.detach();
  }

  function dispose() {
    stop();
    loop.dispose?.();
    entityManager.dispose?.();
  }

  return {
    get state() {
      return gameState.state;
    },
    get stats() {
      return gameState.stats;
    },
    get player() {
      return player;
    },
    get camera() {
      return camera;
    },
    get tilemap() {
      return tilemap;
    },
    get entityManager() {
      return entityManager;
    },
    get gameState() {
      return gameState;
    },
    get input() {
      return input;
    },
    get loop() {
      return loop;
    },
    update,
    render,
    start,
    stop,
    dispose,
  };
}

export default createGame;
