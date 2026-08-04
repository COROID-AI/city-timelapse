import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { handleModeToggleKey, isModeToggleKey, ModeSwitch } from './modeSwitch';

function keyEvent(
  type: 'keydown' | 'keyup',
  code: string,
  target: unknown = null,
  repeat = false,
): KeyboardEvent {
  return { type, code, target, repeat } as KeyboardEvent;
}

function makeFakeDom(): HTMLElement {
  const root = { addEventListener: () => {}, removeEventListener: () => {} };
  return {
    addEventListener: () => {},
    removeEventListener: () => {},
    ownerDocument: root,
    getRootNode: () => root,
    style: {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  } as unknown as HTMLElement;
}

function makeSwitch(): {
  modeSwitch: ModeSwitch;
  camera: THREE.PerspectiveCamera;
  walk: {
    isLocked: boolean;
    requestLock: ReturnType<typeof vi.fn>;
    releaseLock: ReturnType<typeof vi.fn>;
    respawn: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  onModeChange: ReturnType<typeof vi.fn>;
} {
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
  camera.position.set(0, 1.6, 78);
  const walk = {
    isLocked: false,
    requestLock: vi.fn(),
    releaseLock: vi.fn(),
    respawn: vi.fn(),
    update: vi.fn(),
  };
  const onModeChange = vi.fn();
  const modeSwitch = new ModeSwitch(camera, makeFakeDom(), walk, {
    orbitCameraPosition: new THREE.Vector3(0, 70, 130),
    orbitTarget: new THREE.Vector3(0, 0, 0),
  });
  modeSwitch.setCallbacks({ onModeChange });
  return { modeSwitch, camera, walk, onModeChange };
}

describe('ModeSwitch', () => {
  it('starts in walk mode', () => {
    const { modeSwitch } = makeSwitch();
    expect(modeSwitch.activeMode).toBe('walk');
  });

  it('toggles to orbit mode, releasing pointer lock and enabling orbit', () => {
    const { modeSwitch, walk, onModeChange } = makeSwitch();
    modeSwitch.toggle();
    expect(modeSwitch.activeMode).toBe('orbit');
    expect(walk.releaseLock).toHaveBeenCalledTimes(1);
    expect(onModeChange).toHaveBeenCalledWith('orbit');
  });

  it('toggles back to walk mode', () => {
    const { modeSwitch, onModeChange } = makeSwitch();
    modeSwitch.toggle();
    modeSwitch.toggle();
    expect(modeSwitch.activeMode).toBe('walk');
    expect(onModeChange).toHaveBeenLastCalledWith('walk');
  });

  it('falls back to orbit mode on pointer-lock errors', () => {
    const { modeSwitch, walk, onModeChange } = makeSwitch();
    modeSwitch.handlePointerLockError();
    expect(modeSwitch.activeMode).toBe('orbit');
    expect(walk.releaseLock).not.toHaveBeenCalled();
    expect(onModeChange).toHaveBeenCalledWith('orbit');
  });

  it('forceWalk returns from orbit mode but is a no-op in walk mode', () => {
    const { modeSwitch, onModeChange } = makeSwitch();
    modeSwitch.forceWalk(); // already walk: no change
    expect(modeSwitch.activeMode).toBe('walk');
    expect(onModeChange).not.toHaveBeenCalled();
    modeSwitch.handlePointerLockError();
    modeSwitch.forceWalk();
    expect(modeSwitch.activeMode).toBe('walk');
  });

  it('routes updates to the walk controller in walk mode', () => {
    const { modeSwitch, walk } = makeSwitch();
    modeSwitch.update(0.016);
    expect(walk.update).toHaveBeenCalledWith(0.016);
  });

  it('keeps the camera above ground level in orbit mode', () => {
    const { modeSwitch, camera, walk } = makeSwitch();
    modeSwitch.toggle();
    camera.position.y = 0.2; // orbit camera dragged below the ground
    modeSwitch.update(0.016);
    expect(camera.position.y).toBeGreaterThanOrEqual(1.6);
    expect(walk.update).not.toHaveBeenCalled();
  });

  it('keeps the current walk position when entering orbit mode', () => {
    const { modeSwitch, camera } = makeSwitch();
    camera.position.set(12, 1.6, -30);
    modeSwitch.toggle();
    expect(camera.position.x).toBe(12);
    expect(camera.position.z).toBe(-30);
  });
});

describe('handleModeToggleKey', () => {
  it('toggles on the R key', () => {
    const { modeSwitch } = makeSwitch();
    handleModeToggleKey(keyEvent('keydown', 'KeyR'), modeSwitch);
    expect(modeSwitch.activeMode).toBe('orbit');
  });

  it('ignores other keys and repeated keydowns', () => {
    const { modeSwitch } = makeSwitch();
    handleModeToggleKey(keyEvent('keydown', 'KeyQ'), modeSwitch);
    expect(modeSwitch.activeMode).toBe('walk');
    handleModeToggleKey(keyEvent('keydown', 'KeyR', null, true), modeSwitch);
    expect(modeSwitch.activeMode).toBe('walk');
  });

  it('ignores the toggle while typing in a text field', () => {
    const { modeSwitch } = makeSwitch();
    const fakeInput = { tagName: 'INPUT' };
    handleModeToggleKey(keyEvent('keydown', 'KeyR', fakeInput), modeSwitch);
    expect(modeSwitch.activeMode).toBe('walk');
  });

  it('isModeToggleKey recognises only the toggle key', () => {
    expect(isModeToggleKey(keyEvent('keydown', 'KeyR'))).toBe(true);
    expect(isModeToggleKey(keyEvent('keydown', 'KeyX'))).toBe(false);
  });
});
