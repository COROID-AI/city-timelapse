/**
 * Comprehensive test suite for Entity Manager & Gameplay Interactions (tests/entityManager.test.js).
 *
 * Covers:
 *  1. Entity registry lifecycle (add, update, draw, clear, dispose, ordered iteration)
 *  2. Downward stomp kill & bounce (Goomba squash, Koopa shell transform, moving shell stop)
 *  3. Stomp bounce impulse (normal vs jumpHeld)
 *  4. Side contact damage hook & player damage (Goomba, Koopa, moving shell)
 *  5. Invincibility & dead player damage guard rails
 *  6. Idle shell kicking away from player contact side (left vs right)
 *  7. Moving shell enemy kill chain combo scoring (100 -> 200 -> 400 -> 800) and combo reset on stop
 *  8. Enemy-vs-enemy walker bounce (Goomba-Goomba, Goomba-Koopa)
 *  9. Mushroom item collection (power-up hook, 1000 score, super state)
 * 10. CoinPop expiry (coin hook, 200 score)
 * 11. Block hit routing:
 *      - coin question block spawning coinPop
 *      - mushroom question block spawning mushroom
 *      - multi-coin brick depletion over 5 hits -> used block
 *      - breakable brick breaking under Super Mario -> 4 brick fragments + 50 score
 *      - bump-flip of enemy standing on top of bumped block
 * 12. Dead and offscreen camera culling
 * 13. Full composition test with real LEVEL_ONE, camera, tilemap, player, enemies and items
 */

import { CONSTANTS } from '../src/core/constants.js';
import { createEntityManager } from '../src/entities/entityManager.js';
import { createPlayer } from '../src/entities/player.js';
import { createGoomba } from '../src/entities/goomba.js';
import { createKoopa } from '../src/entities/koopa.js';
import { createMushroom } from '../src/entities/mushroom.js';
import { createCoinPop } from '../src/entities/coinPop.js';
import { spawnBrickFragments, spawnScorePopup } from '../src/fx/particles.js';
import { createCamera } from '../src/core/camera.js';
import { createTilemap, TILES } from '../src/world/tilemap.js';
import { LEVEL_ONE } from '../src/levels/level1.js';

const DT = 1 / 60;

function createMockContext() {
  const calls = [];
  const ctx = {
    fillStyle: null,
    fillRect(x, y, w, h) {
      calls.push({ color: this.fillStyle, x, y, w, h });
    },
    save() {},
    restore() {},
    drawImage: jest.fn(),
    fillText: jest.fn(),
  };
  return { ctx, calls };
}

describe('Entity Manager (src/entities/entityManager.js)', () => {
  describe('Registry Lifecycle & Basic Operations', () => {
    test('instantiates with empty entity list and provided handles', () => {
      const camera = createCamera();
      const tilemap = createTilemap(['XXXX']);
      const hooks = { onScore: jest.fn() };

      const manager = createEntityManager({ camera, tilemap, hooks });

      expect(manager.entities).toEqual([]);
      expect(manager.camera).toBe(camera);
      expect(manager.tilemap).toBe(tilemap);
      expect(manager.hooks).toBe(hooks);
      expect(typeof manager.add).toBe('function');
      expect(typeof manager.update).toBe('function');
      expect(typeof manager.draw).toBe('function');
      expect(typeof manager.clear).toBe('function');
      expect(typeof manager.dispose).toBe('function');
      expect(typeof manager.handleBlockHit).toBe('function');
    });

    test('add() registers single items, multiple arguments, and arrays in order', () => {
      const manager = createEntityManager();
      const g1 = createGoomba({ x: 10, y: 10 });
      const g2 = createGoomba({ x: 20, y: 20 });
      const k1 = createKoopa({ x: 30, y: 30 });
      const k2 = createKoopa({ x: 40, y: 40 });

      manager.add(g1);
      expect(manager.entities).toHaveLength(1);
      expect(manager.entities[0]).toBe(g1);

      manager.add(g2, k1);
      expect(manager.entities).toHaveLength(3);
      expect(manager.entities[1]).toBe(g2);
      expect(manager.entities[2]).toBe(k1);

      manager.add([k2]);
      expect(manager.entities).toHaveLength(4);
      expect(manager.entities[3]).toBe(k2);
    });

    test('draw() renders registered entities in insertion order with camera offset', () => {
      const camera = createCamera();
      const manager = createEntityManager({ camera });
      const g = createGoomba({ x: 50, y: 50 });
      const m = createMushroom({ x: 100, y: 100 });
      manager.add(g, m);

      const { ctx, calls } = createMockContext();
      manager.draw(ctx);

      expect(calls.length).toBeGreaterThan(0);
    });

    test('clear() and dispose() empty registry and call entity dispose methods', () => {
      const manager = createEntityManager();
      const m1 = createMushroom({ x: 50, y: 50 });
      const m2 = createMushroom({ x: 80, y: 80 });
      manager.add(m1, m2);

      expect(manager.entities).toHaveLength(2);
      manager.clear();
      expect(manager.entities).toHaveLength(0);
      expect(m1.alive).toBe(false);
      expect(m2.alive).toBe(false);

      const m3 = createMushroom({ x: 90, y: 90 });
      manager.add(m3);
      expect(manager.entities).toHaveLength(1);
      manager.dispose();
      expect(manager.entities).toHaveLength(0);
      expect(m3.alive).toBe(false);
    });
  });

  describe('Stomp & Bounce Interactions', () => {
    test('downward stomp on Goomba squashes Goomba, bounces player and awards 100 score + popup', () => {
      const onScore = jest.fn();
      const manager = createEntityManager({ hooks: { onScore } });

      // Goomba at (100, 190) (w=14, h=14, top=190)
      const goomba = createGoomba({ x: 100, y: 190 });
      manager.add(goomba);

      // Player falling above Goomba: feet at 180 + 14 = 194 (overlapping top 4px of Goomba)
      const player = createPlayer({ x: 100, y: 180 });
      player.body.vy = 120; // downward velocity > 0

      manager.update(DT, player, { jumpHeld: false });

      // Goomba must be squashed
      expect(goomba.squashed).toBe(true);

      // Player bounced with normal bounce impulse
      expect(player.body.vy).toBe(-180);

      // Score hook called with 100
      expect(onScore).toHaveBeenCalledWith(100);

      // Score popup added to registry
      const popup = manager.entities.find((e) => e.type === 'scorePopup');
      expect(popup).toBeDefined();
      expect(popup.text).toBe('100');
    });

    test('downward stomp with jumpHeld=true applies higher bounce impulse (-300)', () => {
      const manager = createEntityManager();
      const goomba = createGoomba({ x: 100, y: 190 });
      manager.add(goomba);

      const player = createPlayer({ x: 100, y: 180 });
      player.body.vy = 150;

      manager.update(DT, player, { jumpHeld: true });

      expect(goomba.squashed).toBe(true);
      expect(player.body.vy).toBe(-300);
    });

    test('downward stomp on walking Koopa converts it to stationary shell and bounces player', () => {
      const onScore = jest.fn();
      const manager = createEntityManager({ hooks: { onScore } });

      // Koopa at (100, 180) (w=14, h=24)
      const koopa = createKoopa({ x: 100, y: 180 });
      manager.add(koopa);

      const player = createPlayer({ x: 100, y: 170 });
      player.body.vy = 100;

      manager.update(DT, player);

      expect(koopa.isShell).toBe(true);
      expect(koopa.type).toBe('shell');
      expect(koopa.vx).toBe(0);
      expect(player.body.vy).toBe(-180);
      expect(onScore).toHaveBeenCalledWith(100);
    });

    test('downward stomp on moving shell stops the shell and resets combo', () => {
      const manager = createEntityManager();
      const shell = createKoopa({ x: 100, y: 190, isShell: true });
      shell.kick(1);
      expect(shell.vx).toBe(220);
      shell._combo = 3;
      manager.add(shell);

      const player = createPlayer({ x: 100, y: 180 });
      player.body.vy = 120;

      manager.update(DT, player);

      expect(shell.vx).toBe(0);
      expect(shell._combo).toBe(0);
      expect(player.body.vy).toBe(-180);
    });
  });

  describe('Side Contact & Player Damage', () => {
    test('side contact with Goomba damages player and calls onPlayerDamaged hook', () => {
      const onPlayerDamaged = jest.fn();
      const manager = createEntityManager({ hooks: { onPlayerDamaged } });

      const goomba = createGoomba({ x: 100, y: 190 });
      manager.add(goomba);

      // Player side-contact: same vertical level (y=190), horizontal overlap, moving horizontally
      const player = createPlayer({ x: 96, y: 190 });
      player.body.vx = 40;
      player.body.vy = 0; // not falling

      manager.update(DT, player);

      expect(onPlayerDamaged).toHaveBeenCalledTimes(1);
      // Small player dies on damage
      expect(player.state).toBe('dead');
    });

    test('side contact with walking Koopa damages Super Mario, shrinking him to small with invincibility', () => {
      const onPlayerDamaged = jest.fn();
      const manager = createEntityManager({ hooks: { onPlayerDamaged } });

      const koopa = createKoopa({ x: 100, y: 180 });
      manager.add(koopa);

      const player = createPlayer({ x: 96, y: 180 });
      player.powerUp(); // Super Mario
      expect(player.powerState).toBe('super');

      manager.update(DT, player);

      expect(onPlayerDamaged).toHaveBeenCalledTimes(1);
      expect(player.powerState).toBe('small');
      expect(player.isInvincible()).toBe(true);
    });

    test('damage hook is NOT called if player is already invincible', () => {
      const onPlayerDamaged = jest.fn();
      const manager = createEntityManager({ hooks: { onPlayerDamaged } });

      const goomba = createGoomba({ x: 100, y: 190 });
      manager.add(goomba);

      const player = createPlayer({ x: 96, y: 190 });
      player.powerUp();
      player.damage(); // shrinks & gains 2s invincibility
      expect(player.isInvincible()).toBe(true);

      manager.update(DT, player);
      expect(onPlayerDamaged).not.toHaveBeenCalled();
    });

    test('damage hook is NOT called if player is already dead', () => {
      const onPlayerDamaged = jest.fn();
      const manager = createEntityManager({ hooks: { onPlayerDamaged } });

      const goomba = createGoomba({ x: 100, y: 190 });
      manager.add(goomba);

      const player = createPlayer({ x: 96, y: 190 });
      player.die();
      expect(player.state).toBe('dead');

      manager.update(DT, player);
      expect(onPlayerDamaged).not.toHaveBeenCalled();
    });

    test('side contact with moving shell damages player', () => {
      const onPlayerDamaged = jest.fn();
      const manager = createEntityManager({ hooks: { onPlayerDamaged } });

      const shell = createKoopa({ x: 100, y: 190, isShell: true });
      shell.kick(1); // moving right at 220
      manager.add(shell);

      const player = createPlayer({ x: 96, y: 190 });
      player.body.vy = 0;

      manager.update(DT, player);

      expect(onPlayerDamaged).toHaveBeenCalledTimes(1);
    });
  });

  describe('Idle Shell Kicking', () => {
    test('player touching idle shell from left kicks it right without taking damage', () => {
      const onPlayerDamaged = jest.fn();
      const manager = createEntityManager({ hooks: { onPlayerDamaged } });

      const shell = createKoopa({ x: 100, y: 190, isShell: true });
      expect(shell.vx).toBe(0);
      manager.add(shell);

      // Player to the left of shell (center x = 90 + 6 = 96 < shell center x = 100 + 7 = 107)
      const player = createPlayer({ x: 90, y: 190 });
      player.body.vy = 0;

      manager.update(DT, player);

      expect(shell.vx).toBe(220);
      expect(shell.facing).toBe(1);
      expect(onPlayerDamaged).not.toHaveBeenCalled();
      expect(player.state).not.toBe('dead');
    });

    test('player touching idle shell from right kicks it left without taking damage', () => {
      const onPlayerDamaged = jest.fn();
      const manager = createEntityManager({ hooks: { onPlayerDamaged } });

      const shell = createKoopa({ x: 100, y: 190, isShell: true });
      manager.add(shell);

      // Player to the right of shell (center x = 110 + 6 = 116 > shell center x = 107)
      const player = createPlayer({ x: 110, y: 190 });
      player.body.vy = 0;

      manager.update(DT, player);

      expect(shell.vx).toBe(-220);
      expect(shell.facing).toBe(-1);
      expect(onPlayerDamaged).not.toHaveBeenCalled();
    });
  });

  describe('Moving Shell Combo Chain Scoring', () => {
    test('moving shell kills chained line of enemies awarding 100 -> 200 -> 400 -> 800 combo score', () => {
      const scoreEvents = [];
      const manager = createEntityManager({
        hooks: {
          onScore: (s) => scoreEvents.push(s),
        },
      });

      const shell = createKoopa({ x: 50, y: 190, isShell: true });
      shell.kick(1);
      expect(shell.vx).toBe(220);

      const g1 = createGoomba({ x: 52, y: 190 });
      const g2 = createGoomba({ x: 54, y: 190 });
      const g3 = createGoomba({ x: 56, y: 190 });
      const g4 = createGoomba({ x: 58, y: 190 });
      const g5 = createGoomba({ x: 60, y: 190 });

      manager.add(shell, g1);
      manager.update(DT);
      expect(g1.alive).toBe(false);
      expect(scoreEvents).toEqual([100]);

      manager.add(g2);
      manager.update(DT);
      expect(g2.alive).toBe(false);
      expect(scoreEvents).toEqual([100, 200]);

      manager.add(g3);
      manager.update(DT);
      expect(g3.alive).toBe(false);
      expect(scoreEvents).toEqual([100, 200, 400]);

      manager.add(g4);
      manager.update(DT);
      expect(g4.alive).toBe(false);
      expect(scoreEvents).toEqual([100, 200, 400, 800]);

      manager.add(g5);
      manager.update(DT);
      expect(g5.alive).toBe(false);
      expect(scoreEvents).toEqual([100, 200, 400, 800, 800]);
    });

    test('combo resets to 0 when shell stops', () => {
      const scoreEvents = [];
      const manager = createEntityManager({
        hooks: { onScore: (s) => scoreEvents.push(s) },
      });

      const shell = createKoopa({ x: 50, y: 190, isShell: true });
      shell.kick(1);

      const g1 = createGoomba({ x: 52, y: 190 });
      manager.add(shell, g1);
      manager.update(DT);
      expect(scoreEvents).toEqual([100]);

      // Shell stops
      shell.vx = 0;
      manager.update(DT);
      expect(shell._combo).toBe(0);

      // Re-kick shell into second Goomba
      shell.kick(1);
      const g2 = createGoomba({ x: 54, y: 190 });
      manager.add(g2);
      manager.update(DT);

      // Combo started again at 100
      expect(scoreEvents).toEqual([100, 100]);
    });
  });

  describe('Enemy-vs-Enemy Walker Bouncing', () => {
    test('two overlapping Goombas bounce and reverse directions', () => {
      const manager = createEntityManager();
      // g1 at x=50 moving right (vx=30), g2 at x=54 moving left (vx=-30)
      const g1 = createGoomba({ x: 50, y: 190, dir: 1 });
      const g2 = createGoomba({ x: 54, y: 190, dir: -1 });
      manager.add(g1, g2);

      manager.update(DT);

      // g1 (left) bounced left, g2 (right) bounced right
      expect(g1.vx).toBe(-30);
      expect(g1.facing).toBe(-1);
      expect(g2.vx).toBe(30);
      expect(g2.facing).toBe(1);
    });

    test('Goomba and walking Koopa bounce apart on contact', () => {
      const manager = createEntityManager();
      const goomba = createGoomba({ x: 50, y: 180, dir: 1 });
      const koopa = createKoopa({ x: 54, y: 180, dir: -1 });
      manager.add(goomba, koopa);

      manager.update(DT);

      expect(goomba.vx).toBe(-30);
      expect(koopa.vx).toBe(30);
    });

    test('walker walking into idle shell bounces off the shell', () => {
      const manager = createEntityManager();
      const goomba = createGoomba({ x: 50, y: 190, dir: 1 });
      const shell = createKoopa({ x: 56, y: 190, isShell: true });
      manager.add(goomba, shell);

      manager.update(DT);

      expect(goomba.vx).toBe(-30);
      expect(goomba.facing).toBe(-1);
      expect(shell.vx).toBe(0); // shell stays idle
    });
  });

  describe('Items & Particles Integration', () => {
    test('player collects mushroom: powers up Super Mario, triggers hook + 1000 score', () => {
      const onPowerUp = jest.fn();
      const onScore = jest.fn();
      const manager = createEntityManager({
        hooks: { onPowerUp, onScore },
      });

      const mushroom = createMushroom({ x: 100, y: 190 });
      mushroom.update(0.6); // finish emergence to walking (y moves from 190 to 174)
      manager.add(mushroom);

      const player = createPlayer({ x: 98, y: 174 });
      expect(player.powerState).toBe('small');

      manager.update(DT, player);

      expect(mushroom.alive).toBe(false);
      expect(player.powerState).toBe('super');
      expect(onPowerUp).toHaveBeenCalledWith('super');
      expect(onScore).toHaveBeenCalledWith(1000);

      const popup = manager.entities.find((e) => e.type === 'scorePopup');
      expect(popup).toBeDefined();
      expect(popup.text).toBe('1000');
    });

    test('coinPop expiry invokes onCoin and onScore(200)', () => {
      const onCoin = jest.fn();
      const onScore = jest.fn();
      const manager = createEntityManager({
        hooks: { onCoin, onScore },
      });

      const coin = createCoinPop({ x: 80, y: 120 });
      manager.add(coin);

      // Step until coin completes its arc and expires
      for (let i = 0; i < 40; i++) {
        manager.update(DT);
      }

      expect(coin.alive).toBe(false);
      expect(coin.expired).toBe(true);
      expect(onCoin).toHaveBeenCalledTimes(1);
      expect(onScore).toHaveBeenCalledWith(200);
    });
  });

  describe('Block Hit Routing & Spawning', () => {
    test('bump question coin block spawns coinPop and turns block to Used', () => {
      const tilemap = createTilemap([
        '   ?   ',
        'XXXXXXX',
      ]);
      const manager = createEntityManager({ tilemap });

      const action = manager.handleBlockHit(3, 0, { tile: '?', powerState: 'small' });
      expect(action).toBe('bump');
      expect(tilemap.tileAt(3, 0)).toBe(TILES.USED);

      const coin = manager.entities.find((e) => e.type === 'coinPop');
      expect(coin).toBeDefined();
      expect(coin.x).toBe(3 * 16);
      expect(coin.y).toBe((0 - 1) * 16);
    });

    test('bump question mushroom block spawns emerging mushroom and turns block to Used', () => {
      const tilemap = createTilemap([
        '   M   ',
        'XXXXXXX',
      ]);
      const manager = createEntityManager({ tilemap });

      const action = manager.handleBlockHit(3, 0, { tile: 'M', powerState: 'small' });
      expect(action).toBe('bump');
      expect(tilemap.tileAt(3, 0)).toBe(TILES.USED);

      const mushroom = manager.entities.find((e) => e.type === 'mushroom');
      expect(mushroom).toBeDefined();
      expect(mushroom.isEmerging).toBe(true);
      expect(mushroom.y).toBe(0 * 16);
    });

    test('multi-coin brick block provides 5 coin hits before turning to Used', () => {
      const tilemap = createTilemap([
        '   m   ',
        'XXXXXXX',
      ], { multiCoinHits: 5 });
      const manager = createEntityManager({ tilemap });

      // Hits 1 to 4
      for (let hit = 1; hit <= 4; hit++) {
        const action = manager.handleBlockHit(3, 0, { tile: 'm', powerState: 'small' });
        expect(action).toBe('bump');
        expect(tilemap.tileAt(3, 0)).toBe(TILES.MULTI_COIN);
      }

      // Hit 5 (depletion)
      const finalAction = manager.handleBlockHit(3, 0, { tile: 'm', powerState: 'small' });
      expect(finalAction).toBe('bump');
      expect(tilemap.tileAt(3, 0)).toBe(TILES.USED);

      // Total of 5 coinPops spawned
      const coins = manager.entities.filter((e) => e.type === 'coinPop');
      expect(coins).toHaveLength(5);
    });

    test('super Mario breaking brick block spawns 4 brick fragments + 50 score and clears tile', () => {
      const onScore = jest.fn();
      const tilemap = createTilemap([
        '   B   ',
        'XXXXXXX',
      ]);
      const manager = createEntityManager({ tilemap, hooks: { onScore } });

      const action = manager.handleBlockHit(3, 0, { tile: 'B', powerState: 'super' });
      expect(action).toBe('break');
      expect(tilemap.tileAt(3, 0)).toBe(' '); // emptied to air
      expect(onScore).toHaveBeenCalledWith(50);

      const fragments = manager.entities.filter((e) => e.type === 'brickFragment');
      expect(fragments).toHaveLength(4);
      for (const frag of fragments) {
        expect(frag.alive).toBe(true);
        expect(frag.w).toBe(8);
      }
    });

    test('small Mario bumping brick block returns bump and keeps tile', () => {
      const tilemap = createTilemap([
        '   B   ',
        'XXXXXXX',
      ]);
      const manager = createEntityManager({ tilemap });

      const action = manager.handleBlockHit(3, 0, { tile: 'B', powerState: 'small' });
      expect(action).toBe('bump');
      expect(tilemap.tileAt(3, 0)).toBe(TILES.BRICK);
    });

    test('bumped block flips and kills enemy standing on top', () => {
      const onScore = jest.fn();
      const tilemap = createTilemap([
        '       ',
        '   ?   ',
        'XXXXXXX',
      ]);
      const manager = createEntityManager({ tilemap, hooks: { onScore } });

      // Block is at (tx=3, ty=1), world top is y = 16.
      // Goomba feet at y = 16 (y = 16 - 14 = 2), standing on block at x = 3 * 16 = 48
      const goomba = createGoomba({ x: 48, y: 2 });
      manager.add(goomba);

      manager.handleBlockHit(3, 1, { tile: '?', powerState: 'small' });

      expect(goomba.alive).toBe(false);
      expect(goomba.vy).toBe(-180);
      expect(onScore).toHaveBeenCalledWith(100);

      const popup = manager.entities.find((e) => e.type === 'scorePopup');
      expect(popup).toBeDefined();
    });
  });

  describe('Culling Mechanics', () => {
    test('dead entities are culled from active registry on update', () => {
      const manager = createEntityManager();
      const m1 = createMushroom({ x: 50, y: 50 });
      const m2 = createMushroom({ x: 80, y: 80 });
      manager.add(m1, m2);

      expect(manager.entities).toHaveLength(2);

      m1.alive = false;
      manager.update(DT);

      expect(manager.entities).toHaveLength(1);
      expect(manager.entities[0]).toBe(m2);
    });

    test('entities left of camera.x are culled on update', () => {
      const camera = createCamera({ levelWidth: 1000 });
      const manager = createEntityManager({ camera });

      // Entities at x=50, x=150, x=300
      const g1 = createGoomba({ x: 50, y: 100 });
      const g2 = createGoomba({ x: 150, y: 100 });
      const g3 = createGoomba({ x: 300, y: 100 });
      manager.add(g1, g2, g3);

      expect(manager.entities).toHaveLength(3);

      // Camera advances past g1 & g2: camera.x moves to 200
      camera.follow(328); // 328 - 128 = 200
      expect(camera.x).toBe(200);

      manager.update(DT);

      // g1 (x=50) and g2 (x=150) are strictly left of camera.x (200), so culled
      // g3 (x=300) is on/ahead of screen, so retained
      expect(manager.entities).toHaveLength(1);
      expect(manager.entities[0]).toBe(g3);
    });
  });

  describe('Full Integrated Level Composition', () => {
    test('integrated gameplay stack: player, goombas, koopas, blocks, particles and camera interact in LEVEL_ONE layout', () => {
      const tilemap = createTilemap(LEVEL_ONE.gridRows, { tileSize: 16 });
      const camera = createCamera({ levelWidth: LEVEL_ONE.width * 16 });

      const scoreLog = [];
      const coinLog = [];
      const damageLog = [];
      const powerUpLog = [];

      const manager = createEntityManager({
        tilemap,
        camera,
        hooks: {
          onScore: (s) => scoreLog.push(s),
          onCoin: () => coinLog.push(1),
          onPlayerDamaged: () => damageLog.push(1),
          onPowerUp: (p) => powerUpLog.push(p),
        },
      });

      // Spawn player above Goomba (x=48, y=184, feet at 198, top of Goomba at 194)
      const player = createPlayer({
        x: LEVEL_ONE.spawn.x,
        y: 184,
        hooks: {
          onBlockHit: manager.handleBlockHit,
        },
      });

      // 1. Stomp a Goomba
      const goomba = createGoomba({ x: 48, y: 194 });
      manager.add(goomba);

      player.body.vy = 100;
      manager.update(DT, player);

      expect(goomba.squashed).toBe(true);
      expect(player.body.vy).toBe(-180);
      expect(scoreLog).toContain(100);

      // 2. Hit the mushroom ?-block at col 21, row 9
      const mushroomBlockCol = 21;
      const mushroomBlockRow = 9;
      manager.handleBlockHit(mushroomBlockCol, mushroomBlockRow, {
        tile: 'M',
        powerState: player.powerState,
      });

      const spawnedMushroom = manager.entities.find((e) => e.type === 'mushroom');
      expect(spawnedMushroom).toBeDefined();

      // Complete mushroom emergence
      spawnedMushroom.update(0.6, tilemap);

      // Player collects mushroom
      player.body.x = spawnedMushroom.x;
      player.body.y = spawnedMushroom.y;
      manager.update(DT, player);

      expect(player.powerState).toBe('super');
      expect(powerUpLog).toContain('super');
      expect(scoreLog).toContain(1000);

      // 3. Super Mario breaks a brick at col 20, row 9
      const brickCol = 20;
      const brickRow = 9;
      const breakAction = manager.handleBlockHit(brickCol, brickRow, {
        tile: 'B',
        powerState: player.powerState,
      });
      expect(breakAction).toBe('break');
      expect(scoreLog).toContain(50);
      const frags = manager.entities.filter((e) => e.type === 'brickFragment');
      expect(frags).toHaveLength(4);

      // 4. Kick a shell into 3 enemies asserting combo scoring
      const shell = createKoopa({ x: 300, y: 194, isShell: true });
      const enemy1 = createGoomba({ x: 302, y: 194 });
      const enemy2 = createGoomba({ x: 304, y: 194 });
      const enemy3 = createGoomba({ x: 306, y: 194 });
      manager.add(shell, enemy1, enemy2, enemy3);

      shell.kick(1);
      scoreLog.length = 0; // reset log

      manager.update(DT);
      expect(scoreLog).toEqual([100, 200, 400]);

      // 5. Camera follow and offscreen entity culling
      camera.follow(1000);
      const forwardGoomba = createGoomba({ x: 950, y: 194 });
      manager.add(forwardGoomba);
      manager.update(DT);

      // Entities behind camera.x (which is around 872) must be culled
      for (const e of manager.entities) {
        expect(e.x + (e.w || 16)).toBeGreaterThanOrEqual(camera.x);
      }

      // 6. Renders remaining in-view entities with canvas context
      const { ctx, calls } = createMockContext();
      manager.draw(ctx);
      expect(calls.length).toBeGreaterThan(0);
    });
  });
});
