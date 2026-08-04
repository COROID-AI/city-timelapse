import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CollisionBox } from '../city/types';
import { WalkControls, applyKeyEvent, readWalkInput } from './walkControls';

function keyEvent(type: 'keydown' | 'keyup', code: string, repeat = false): KeyboardEvent {
  return { type, code, repeat } as KeyboardEvent;
}

/**
 * PointerLockControls attaches listeners to `domElement.ownerDocument` in its
 * constructor. Vitest runs in the node environment (no jsdom), so tests hand
 * the controls a minimal fake DOM element instead of a real one.
 */
function makeFakeDom(): HTMLElement {
  return {
    addEventListener: () => {},
    removeEventListener: () => {},
    ownerDocument: {
      addEventListener: () => {},
      removeEventListener: () => {},
      exitPointerLock: () => {},
    },
    requestPointerLock: () => {},
  } as unknown as HTMLElement;
}

function makeControls(
  boxes: readonly CollisionBox[],
  options: ConstructorParameters<typeof WalkControls>[3] = {},
): { controls: WalkControls; camera: THREE.PerspectiveCamera } {
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
  camera.position.set(0, 1.6, 0);
  const controls = new WalkControls(camera, makeFakeDom(), boxes, options);
  return { controls, camera };
}

describe('readWalkInput', () => {
  it('maps WASD and arrow keys to movement directions', () => {
    expect(readWalkInput(keyEvent('keydown', 'KeyW'))).toMatchObject({ forward: true });
    expect(readWalkInput(keyEvent('keydown', 'ArrowUp'))).toMatchObject({ forward: true });
    expect(readWalkInput(keyEvent('keydown', 'KeyS'))).toMatchObject({ backward: true });
    expect(readWalkInput(keyEvent('keydown', 'ArrowDown'))).toMatchObject({ backward: true });
    expect(readWalkInput(keyEvent('keydown', 'KeyA'))).toMatchObject({ left: true });
    expect(readWalkInput(keyEvent('keydown', 'ArrowLeft'))).toMatchObject({ left: true });
    expect(readWalkInput(keyEvent('keydown', 'KeyD'))).toMatchObject({ right: true });
    expect(readWalkInput(keyEvent('keydown', 'ArrowRight'))).toMatchObject({ right: true });
  });

  it('releases keys on keyup and tracks sprint', () => {
    expect(readWalkInput(keyEvent('keyup', 'KeyW'))).toMatchObject({ forward: false });
    expect(readWalkInput(keyEvent('keydown', 'ShiftLeft'))).toMatchObject({ sprint: true });
    expect(readWalkInput(keyEvent('keyup', 'ShiftLeft'))).toMatchObject({ sprint: false });
  });

  it('ignores unrelated keys and repeated jumps', () => {
    expect(readWalkInput(keyEvent('keydown', 'KeyX'))).toBeNull();
    expect(readWalkInput(keyEvent('keydown', 'Space', true))).toMatchObject({ jump: false });
    expect(readWalkInput(keyEvent('keydown', 'Space'))).toMatchObject({ jump: true });
  });
});

describe('applyKeyEvent', () => {
  it('merges events into a shared input object', () => {
    const input = { forward: false, backward: false, left: false, right: false, sprint: false, jump: false };
    applyKeyEvent(input, keyEvent('keydown', 'KeyW'));
    applyKeyEvent(input, keyEvent('keydown', 'ShiftLeft'));
    expect(input.forward).toBe(true);
    expect(input.sprint).toBe(true);
    applyKeyEvent(input, keyEvent('keyup', 'KeyW'));
    expect(input.forward).toBe(false);
  });
});

describe('WalkControls movement', () => {
  const BUILDING: CollisionBox = { minX: 5, minY: 0, minZ: -5, maxX: 10, maxZ: 5, maxY: 20 };

  it('moves forward at walking speed when pointer-locked', () => {
    const { controls, camera } = makeControls([BUILDING]);
    // Camera looks toward -Z (forward is the facing direction).
    camera.lookAt(0, 1.6, -1);
    controls.pointerLock.isLocked = true;
    controls.handleKey(keyEvent('keydown', 'KeyW'));
    const start = camera.position.clone();
    controls.update(1);
    const moved = start.distanceTo(camera.position);
    expect(moved).toBeGreaterThan(2);
    expect(moved).toBeLessThanOrEqual(2.4 + 1e-6);
    // Movement happens only in the horizontal plane.
    expect(camera.position.y).toBeCloseTo(1.6, 5);
  });

  it('does not move while the pointer is not locked', () => {
    const { controls, camera } = makeControls([BUILDING]);
    controls.handleKey(keyEvent('keydown', 'KeyW'));
    const start = camera.position.clone();
    controls.update(1);
    expect(camera.position.distanceTo(start)).toBe(0);
  });

  it('sprints faster than walking', () => {
    const { controls, camera } = makeControls([BUILDING]);
    camera.lookAt(0, 1.6, -1);
    controls.pointerLock.isLocked = true;
    controls.handleKey(keyEvent('keydown', 'KeyW'));
    controls.handleKey(keyEvent('keydown', 'ShiftLeft'));
    controls.update(1);
    const sprintMoved = camera.position.distanceTo(new THREE.Vector3(0, 1.6, 0));
    expect(sprintMoved).toBeGreaterThan(2.4);
    expect(sprintMoved).toBeLessThanOrEqual(2.4 * 1.7 + 1e-6);
  });

  it('never clips into a building (collision-aware)', () => {
    const { controls, camera } = makeControls([BUILDING]);
    // Stand west of the building, face east (+X) toward it.
    camera.position.set(-5, 1.6, 0);
    camera.lookAt(0, 1.6, 0);
    controls.pointerLock.isLocked = true;
    controls.handleKey(keyEvent('keydown', 'KeyW'));
    controls.update(10); // Long run straight at the wall.
    controls.update(10);
    // Collision radius 0.5 keeps the player outside the wall at x <= 4.5.
    expect(camera.position.x).toBeLessThanOrEqual(4.5 + 1e-6);
    expect(camera.position.x).toBeGreaterThanOrEqual(-5);
    expect(camera.position.z).toBeCloseTo(0, 5);
  });

  it('supports jumping and lands back on the ground plane', () => {
    const { controls, camera } = makeControls([BUILDING], { jumpSpeed: 5, gravity: 15 });
    camera.lookAt(0, 1.6, -1);
    controls.pointerLock.isLocked = true;
    controls.handleKey(keyEvent('keydown', 'Space'));
    controls.update(1 / 60);
    expect(camera.position.y).toBeGreaterThan(1.6);
    // Run the simulation until the jump resolves back to the floor.
    let frame = 0;
    while (camera.position.y > 1.6001 && frame < 300) {
      controls.update(1 / 60);
      frame++;
    }
    expect(camera.position.y).toBeCloseTo(1.6, 5);
  });
});
