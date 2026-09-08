import type { InputState } from './contracts';

/** Options for the input manager. */
export interface InputManagerOptions {
  /**
   * Event target the key listeners are attached to. Defaults to `window`
   * when it exists (browser). Inject a stub in tests / non-DOM targets.
   */
  target?: EventTarget;
}

/** The input-manager handle. */
export interface InputManagerHandle {
  /** Live input snapshot mutated by the attached listeners. */
  readonly input: InputState;
  /** True while the key listeners are currently attached. */
  readonly attached: boolean;
  /** Attach listeners (idempotent). */
  attach: () => void;
  /** Detach every listener and reset all keys. */
  dispose: () => void;
}

/** Arrow key -> InputState field mapping. */
const ARROW_KEY_FIELDS: Readonly<Record<string, keyof InputState>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/**
 * Create the arrow-key + Shift input manager.
 *
 * Maps ArrowUp/ArrowDown/ArrowLeft/ArrowRight and Shift (nitrous) into a
 * single live `InputState` object shared with the game loop.
 *
 * @param options Event target override (for tests / non-browser hosts).
 */
export function createInputManager(
  options: InputManagerOptions = {},
): InputManagerHandle {
  const input: InputState = {
    up: false,
    down: false,
    left: false,
    right: false,
    nitrous: false,
  };

  let target: EventTarget | null = options.target ?? null;
  let attached = false;

  const resetInput = () => {
    input.up = false;
    input.down = false;
    input.left = false;
    input.right = false;
    input.nitrous = false;
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Shift') {
      input.nitrous = true;
      return;
    }
    const field = ARROW_KEY_FIELDS[event.key];
    if (field !== undefined) {
      input[field] = true;
      // Prevent the page from scrolling along with the arrow keys.
      event.preventDefault();
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (event.key === 'Shift') {
      input.nitrous = false;
      return;
    }
    const field = ARROW_KEY_FIELDS[event.key];
    if (field !== undefined) {
      input[field] = false;
    }
  };

  // Any focus loss clears held keys so they never stick.
  const onBlur = () => {
    resetInput();
  };

  const attach = (): void => {
    if (attached) return;
    if (target === null) {
      target =
        typeof window !== 'undefined' && typeof window.addEventListener === 'function'
          ? window
          : null;
    }
    if (target === null) {
      throw new Error(
        'createInputManager: no event target available; pass options.target in non-DOM hosts',
      );
    }
    target.addEventListener('keydown', onKeyDown as EventListener);
    target.addEventListener('keyup', onKeyUp as EventListener);
    target.addEventListener('blur', onBlur);
    attached = true;
  };

  const dispose = (): void => {
    if (!attached || target === null) return;
    target.removeEventListener('keydown', onKeyDown as EventListener);
    target.removeEventListener('keyup', onKeyUp as EventListener);
    target.removeEventListener('blur', onBlur);
    resetInput();
    attached = false;
  };

  return {
    get input() {
      return input;
    },
    get attached() {
      return attached;
    },
    attach,
    dispose,
  };
}