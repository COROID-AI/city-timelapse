/**
 * Semantic keyboard input with edge detection.
 *
 * Physical keys are mapped onto semantic gameplay actions so entity and
 * game-state logic can reason about "jump" or "run" instead of key codes:
 *
 *   left  ← ArrowLeft, A
 *   right ← ArrowRight, D
 *   down  ← ArrowDown, S
 *   jump  ← Space, ArrowUp, W, Z
 *   run   ← Shift (either modifier), X
 *   start ← Enter, P
 *
 * The module attaches its handlers to an injectable event target (in
 * production the window, in tests a plain object that receives synthetic
 * KeyboardEvents), so it works headlessly under Node with no DOM.
 *
 * Edge detection: `wasPressed(action)` is true only once per distinct press
 * (the transition from "nothing held" to "held") and is cleared by
 * `endFrame()`. `isDown(action)` reflects the raw held state. Tracked keys
 * are kept per physical key so two keys mapped to the same action (W + Z
 * for jump) can be released independently and OS auto-repeat keydown events
 * do not desynchronize the held state.
 *
 * Game keys have preventDefault() invoked on keydown so the browser never
 * scrolls the page or triggers its built-in shortcuts while the game has
 * focus.
 *
 * @module core/input
 */

/**
 * Maps a keyboard event to a gameplay action, or null when the key is not a
 * game key.
 *
 * Prefers KeyboardEvent.code (physical key) so the mapping stays
 * layout-independent (WASD still works on AZERTY hardware), and falls back to
 * KeyboardEvent.key for synthetic events that only carry a legacy value.
 *
 * @param {object} event A KeyboardEvent-like object exposing code/key (and
 *                       preventDefault for the handlers).
 * @returns {?string} Semantic action, or null for non-game keys.
 */
export function actionForKey(event) {
  const code = typeof event.code === 'string' ? event.code : null;
  if (code !== null) {
    switch (code) {
      case 'ArrowLeft':
        return 'left';
      case 'ArrowRight':
        return 'right';
      case 'ArrowDown':
        return 'down';
      case 'ArrowUp':
      case 'Space':
      case 'KeyW':
      case 'KeyZ':
        return 'jump';
      case 'ShiftLeft':
      case 'ShiftRight':
      case 'KeyX':
        return 'run';
      case 'Enter':
      case 'KeyP':
        return 'start';
      default:
        break;
    }
  }

  const key = typeof event.key === 'string' ? event.key : '';
  switch (key) {
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return 'left';
    case 'ArrowRight':
    case 'd':
    case 'D':
      return 'right';
    case 'ArrowDown':
    case 's':
    case 'S':
      return 'down';
    case 'ArrowUp':
    case ' ':
    case 'w':
    case 'W':
    case 'z':
    case 'Z':
      return 'jump';
    case 'Shift':
    case 'x':
    case 'X':
      return 'run';
    case 'Enter':
    case 'p':
    case 'P':
      return 'start';
    default:
      return null;
  }
}

/**
 * Stable identity for the physical key behind an event. Two down/up events
 * that refer to the same physical key must share an identity so their held
 * state can be tracked independently of other keys mapped to the same action.
 */
function keyIdentity(event) {
  if (typeof event.code === 'string' && event.code.length > 0) return event.code;
  if (typeof event.key === 'string' && event.key.length > 0) return event.key;
  return '';
}

/**
 * Create a semantic input mapper attached to an event target.
 *
 * @param {object} [options]
 * @param {object} [options.target] Injectable event target implementing
 *                                  addEventListener(type, handler) and
 *                                  removeEventListener(type, handler)
 *                                  (window in production, a fake in tests).
 * @returns {{
 *   isDown: function(string): boolean,
 *   wasPressed: function(string): boolean,
 *   endFrame: function(): void,
 *   attach: function(): void,
 *   detach: function(): void
 * }} The input handle consumed by the game-states composition.
 */
export function createInput({ target } = {}) {
  if (target === undefined) target = typeof window !== 'undefined' ? window : null;
  if (target === null) {
    throw new Error(
      'createInput: no event target available — inject a target in tests or run in a browser',
    );
  }

  /** action -> Set of physical key identities currently held. */
  const keysDown = Object.create(null);
  /** action -> true when a fresh press edge is pending this input frame. */
  const pressed = Object.create(null);

  function onKeyDown(event) {
    const action = actionForKey(event);
    if (action === null) return;
    const identity = keyIdentity(event);
    const set = keysDown[action] ?? (keysDown[action] = new Set());
    if (set.size === 0) pressed[action] = true;
    set.add(identity);
    if (typeof event.preventDefault === 'function') event.preventDefault();
  }

  function onKeyUp(event) {
    const action = actionForKey(event);
    if (action === null) return;
    const set = keysDown[action];
    if (set !== undefined) set.delete(keyIdentity(event));
    if (typeof event.preventDefault === 'function') event.preventDefault();
  }

  function onBlur() {
    // Focus loss can swallow the matching keyup: clear held state so the
    // player never gets a permanently stuck action (e.g. endlessly running).
    for (const action of Object.keys(keysDown)) keysDown[action] = new Set();
  }

  let attached = false;

  function attach() {
    if (attached) return;
    attached = true;
    target.addEventListener('keydown', onKeyDown);
    target.addEventListener('keyup', onKeyUp);
    target.addEventListener('blur', onBlur);
  }

  function detach() {
    if (!attached) return;
    attached = false;
    target.removeEventListener('keydown', onKeyDown);
    target.removeEventListener('keyup', onKeyUp);
    target.removeEventListener('blur', onBlur);
  }

  /** Query the raw held state for a semantic action. */
  function isDown(action) {
    const set = keysDown[action];
    return set !== undefined && set.size > 0;
  }

  /** Edge query: true only for the input frame in which the action began. */
  function wasPressed(action) {
    return pressed[action] === true;
  }

  /** End the current input frame: clears every pending press edge. */
  function endFrame() {
    for (const action of Object.keys(pressed)) pressed[action] = false;
  }

  return { isDown, wasPressed, endFrame, attach, detach };
}