/**
 * Keyboard -> InputState adapter for the player car.
 *
 * Maps the arrow keys (and boost trigger) to the shared `InputState` shape
 * with a clean attach / dispose lifecycle:
 *
 *   - `attachKeyboardInput` binds the real DOM `keydown` / `keyup` listeners
 *     and returns a disposable handle;
 *   - `dispose` removes every listener it installed, so nothing leaks onto
 *     `window` when the car is torn down.
 *
 * Key mapping (JSON-safe, documented for the HUD):
 *   - ArrowUp                -> throttle +1    (drive forward)
 *   - ArrowDown              -> throttle -1    (reverse)
 *   - ArrowLeft              -> steer -1       (full left)
 *   - ArrowRight             -> steer +1       (full right)
 *   - Space / ShiftLeft/Right-> nitrous boost trigger
 *
 * BOOST TRIGGER CHOICE (recorded): **Space (Shift as documented alternative)**.
 * The original request defined drifting as the nitrous *source* but never named
 * the activation key, so the Architect chose Space as the default boost trigger
 * with Shift available as a familiar secondary. The player car surfaces this
 * choice in the HUD boost hint ("Space to boost").
 *
 * The adapter sets the `nitrous` flag the frame after a keydown and keeps it
 * set until keyup, which lets the physics consume nitrous across frames while
 * the trigger is held (glue to a racing game where the player holds it).
 */

import type { InputState } from '../shared/types';

/** An attached input driver. */
export interface KeyboardInput {
  /** Detach every listener; the instance is inert afterwards. */
  dispose(): void;
  /** Read the current, de-duplicated InputState snapshot. */
  input(): InputState;
}

/** Fingerprint-key for a key identity used to de-duplicate repeated keys. */
type KeyId =
  | 'throttle'
  | 'reverse'
  | 'left'
  | 'right'
  | 'boost'
  | 'unknown';

/** Map a KeyboardEvent to the logical control it drives. */
function classifyKey(code: string, key: string): KeyId {
  switch (code) {
    case 'ArrowUp':
    case 'KeyW':
    case 'W':
      return 'throttle';
    case 'ArrowDown':
    case 'KeyS':
    case 'S':
      return 'reverse';
    case 'ArrowLeft':
    case 'KeyA':
    case 'A':
      return 'left';
    case 'ArrowRight':
    case 'KeyD':
    case 'D':
      return 'right';
    case 'Space':
    case 'ShiftLeft':
    case 'ShiftRight':
    case 'Shift':
      return 'boost';
    default:
      return key.length === 1 ? 'unknown' : 'unknown';
  }
}

/**
 * Attach keyboard input listeners to a target (defaults to `window`).
 * Returns a handle that must be `dispose()`d to remove listeners.
 */
export function attachKeyboardInput(target: Window = window): KeyboardInput {
  // Closed-over controller state. Held-set prevents stuck keys when the
  // window loses focus (blur) and prevents auto-repeat re-firing on keydown.
  const held = {
    throttle: false,
    reverse: false,
    left: false,
    right: false,
    boost: false,
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const id = classifyKey(event.code, event.key);
    switch (id) {
      case 'throttle':
        held.throttle = true;
        break;
      case 'reverse':
        held.reverse = true;
        break;
      case 'left':
        held.left = true;
        break;
      case 'right':
        held.right = true;
        break;
      case 'boost':
        held.boost = true;
        break;
      default:
        return;
    }
    // Consume arrow/space/keys so the page doesn't scroll.
    if (
      id === 'throttle' ||
      id === 'reverse' ||
      id === 'left' ||
      id === 'right' ||
      id === 'boost'
    ) {
      event.preventDefault();
    }
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    const id = classifyKey(event.code, event.key);
    switch (id) {
      case 'throttle':
        held.throttle = false;
        break;
      case 'reverse':
        held.reverse = false;
        break;
      case 'left':
        held.left = false;
        break;
      case 'right':
        held.right = false;
        break;
      case 'boost':
        held.boost = false;
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const onBlur = (): void => {
    // Release all keys if the window loses focus to avoid stuck input.
    held.throttle = false;
    held.reverse = false;
    held.left = false;
    held.right = false;
    held.boost = false;
  };

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);

  return {
    dispose(): void {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
    },
    input(): InputState {
      return {
        // No throttle while reversing and vice-versa (a single axis).
        throttle: held.throttle ? 1 : held.reverse ? -1 : 0,
        steer: held.left ? -1 : held.right ? 1 : 0,
        brake: held.reverse,
        nitrous: held.boost,
      };
    },
  };
}

/** Recorded boost-trigger choice surfaced to the HUD/integration. */
export const BOOST_HINT = 'Space to boost';