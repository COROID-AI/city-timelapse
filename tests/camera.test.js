/**
 * Classic forward-scrolling camera tests (src/core/camera.js).
 *
 * These tests prove the four load-bearing behaviors of the camera:
 *   1. The exposed handle API: x, y, follow(targetX), worldToScreen(x, y).
 *   2. The midpoint dead-zone threshold: follow() only advances when the
 *      target passes the vertical center line of the viewport.
 *   3. Hard clamps at both level edges ([0, levelWidth - viewportWidth]).
 *   4. The classic forward-only lock: the camera never scrolls left of the
 *      furthest x it has reached.
 *
 * The final test composes the camera with the real LEVEL_ONE data
 * (212 tiles / 3392 px wide vs a 256 px viewport) exactly as the
 * game-states composition will consume it for render translation.
 */
import { createCamera } from '../src/core/camera.js';
import { CONSTANTS } from '../src/core/constants.js';
import { LEVEL_ONE } from '../src/levels/level1.js';

describe('classic forward-scrolling camera (src/core/camera.js)', () => {
  const VIEWPORT_W = 256;
  const VIEWPORT_H = 240;
  const LEVEL_W = 3392;
  const LEVEL_H = 240;
  const MAX_X = LEVEL_W - VIEWPORT_W; // 3136
  const MID_X = VIEWPORT_W / 2; // 128; right edge of the camera's dead zone

  /** Default camera sized to the real level + viewport dims. */
  function makeCamera() {
    return createCamera({
      viewportWidth: VIEWPORT_W,
      viewportHeight: VIEWPORT_H,
      levelWidth: LEVEL_W,
      levelHeight: LEVEL_H,
    });
  }

  test('exposes the CameraHandle contract: x, y, follow, worldToScreen', () => {
    const camera = makeCamera();
    expect(typeof camera.follow).toBe('function');
    expect(typeof camera.worldToScreen).toBe('function');
  });

  test('starts at the top-left of the level (x=0, y=0)', () => {
    const camera = makeCamera();
    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);
  });

  test('follow() applies the midpoint threshold (dead zone) before moving', () => {
    const camera = makeCamera();

    // Target exactly on the viewport's vertical center line: dead zone edge,
    // camera must not move yet.
    camera.follow(MID_X);
    expect(camera.x).toBe(0);

    // Target inside the left buffer: still within the dead zone, no scroll.
    camera.follow(50);
    expect(camera.x).toBe(0);

    // Target one pixel past the midpoint: camera advances.
    const advanced = camera.follow(MID_X + 1);
    expect(advanced).toBe(camera); // follow returns the handle for chaining
    expect(camera.x).toBe(1);
  });

  test('follow() pins the target at the midpoint once it crosses', () => {
    const camera = makeCamera();
    camera.follow(MID_X + 100);
    expect(camera.x).toBe(100); // target - viewportWidth / 2
  });

  test('clamps to the left edge: target left of the viewport never moves x below 0', () => {
    const camera = makeCamera();
    // Seed a rightward scroll first so a left clamp attempt is meaningful.
    camera.follow(MID_X + 400);
    expect(camera.x).toBe(400);

    // In dead zone: forward-only lock already keeps x at 400.
    camera.follow(0);
    camera.follow(-50);
    expect(camera.x).toBe(400);
  });

  test('clamps to the right level edge at levelWidth - viewportWidth', () => {
    const camera = makeCamera();

    // Target beyond the clamp: camX must stop exactly at maxX.
    camera.follow(MAX_X + MID_X + 500);
    expect(camera.x).toBe(MAX_X);
    expect(camera.x).toBe(LEVEL_W - VIEWPORT_W);
  });

  test('never scrolls left of the furthest x reached (forward-only lock)', () => {
    const camera = makeCamera();

    camera.follow(MID_X + 500); // scroll right to x = 500
    expect(camera.x).toBe(500);

    // Attempts to move left — even targets far behind the current view —
    // must leave the camera exactly where it was.
    camera.follow(400);
    camera.follow(100);
    camera.follow(0);
    expect(camera.x).toBe(500);

    // A further rightward advance still works and raises the lock point.
    camera.follow(MID_X + 700);
    expect(camera.x).toBe(700);

    // And the new furthest point is also locked against retreat.
    camera.follow(600);
    camera.follow(200);
    expect(camera.x).toBe(700);
  });

  test('worldToScreen maps world coordinates into viewport space', () => {
    const camera = makeCamera();
    camera.follow(MID_X + 100); // x = 100

    expect(camera.worldToScreen(100, 0)).toEqual({ x: 0, y: 0 });
    expect(camera.worldToScreen(100 + 8, 192)).toEqual({ x: 8, y: 192 });
  });

  test('defaults to the shared CONSTANTS viewport dimensions', () => {
    const camera = createCamera({ levelWidth: 512, levelHeight: 240 });
    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);
    // 512 - 256 (CONSTANTS.VIEWPORT_WIDTH)
    camera.follow(128 + 256);
    expect(camera.x).toBe(256);
  });

  test('vertical offset is fixed at the top of the level (classic SMB)', () => {
    const camera = createCamera({
      viewportWidth: 256,
      viewportHeight: 240,
      levelWidth: 3392,
      levelHeight: 480, // taller than the viewport: still no vertical scroll
    });
    camera.follow(MID_X + 100);
    expect(camera.y).toBe(0);
    expect(camera.worldToScreen(100, 240)).toEqual({ x: 0, y: 240 });
  });

  test('integrated: follows a player-like target across real LEVEL_ONE', () => {
    const camera = createCamera({
      viewportWidth: CONSTANTS.VIEWPORT_WIDTH,
      viewportHeight: CONSTANTS.VIEWPORT_HEIGHT,
      levelWidth: LEVEL_ONE.width * LEVEL_ONE.tileSize, // 3392
      levelHeight: LEVEL_ONE.height * LEVEL_ONE.tileSize, // 240
    });

    const levelMaxX =
      LEVEL_ONE.width * LEVEL_ONE.tileSize - CONSTANTS.VIEWPORT_WIDTH;

    // Player spawn (x=48) sits inside the dead zone: no scroll at first.
    const spawn = LEVEL_ONE.spawn;
    camera.follow(spawn.x);
    expect(camera.x).toBe(0);

    // The player walks right across the whole level. Camera tracks with the
    // midpoint threshold and clamps at the right edge, exactly as the render
    // pipeline will follow the player. A 16px-wide player can stand with its
    // left edge near the level's right edge (x up to 3392 - 16), far enough
    // past levelMaxX + midX that the clamp fully engages at levelMaxX.
    for (let x = 48; x <= LEVEL_ONE.width * LEVEL_ONE.tileSize - 16; x += 1) {
      camera.follow(x);
    }
    expect(camera.x).toBe(levelMaxX); // flag at 3168 is on screen
    expect(camera.worldToScreen(LEVEL_ONE.flagPixelX, LEVEL_ONE.spawn.y).x).toBe(
      LEVEL_ONE.flagPixelX - levelMaxX
    );

    // Walking back left (e.g. after touching the flagpole, as in SMB) must
    // never scroll the viewport left.
    camera.follow(LEVEL_ONE.flagPixelX - 1920);
    camera.follow(0);
    expect(camera.x).toBe(levelMaxX);
  });
});