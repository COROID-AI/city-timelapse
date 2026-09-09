/**
 * Smoke test proving the shared game constants load under Node (no DOM).
 *
 * src/core/constants.js is a plain ESM module with zero runtime
 * dependencies; babel-jest transforms the import so Jest can load it
 * headlessly. This test also pins the exact values the later gameplay
 * tasks depend on.
 */
import { CONSTANTS } from '../src/core/constants.js';

describe('shared game constants', () => {
  test('exposes the fixed tile and viewport sizes', () => {
    expect(CONSTANTS.TILE_SIZE).toBe(16);
    expect(CONSTANTS.VIEWPORT_WIDTH).toBe(256);
    expect(CONSTANTS.VIEWPORT_HEIGHT).toBe(240);
    expect(CONSTANTS.SCALE).toBe(3);
  });

  test('exposes the sky color for the page background', () => {
    expect(CONSTANTS.COLORS.sky).toBe('#5c94fc');
  });

  test('pins the exact PHYSICS tuning values (px/s and px/s^2)', () => {
    expect(CONSTANTS.PHYSICS).toEqual({
      WALK_MAX: 90,
      RUN_MAX: 160,
      ACCEL: 450,
      FRICTION: 550,
      SKID_DECEL: 1000,
      JUMP_VELOCITY: -300,
      JUMP_SPEED_BONUS: -40,
      GRAVITY_HOLD: 700,
      GRAVITY_RELEASE: 1600,
      TERMINAL_VELOCITY: 270,
    });
  });

  test('exports each physics constant as a top-level named number', () => {
    for (const key of Object.keys(CONSTANTS.PHYSICS)) {
      expect(typeof CONSTANTS.PHYSICS[key]).toBe('number');
    }
  });
});
