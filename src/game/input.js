// Pure keyboard input state for the game. No DOM dependency for the core,
// so `node --test` can verify the mapping headlessly. `attach(window)` wires
// real listeners only when the module is used in the browser.

const KEY_MAP = {
  ArrowUp: 'throttle',
  ArrowDown: 'brake',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ' ': 'handbrake',
  Shift: 'nitro',
  KeyX: 'nitro',
};

// Keys we must prevent default page scrolling / browser behaviors for.
const GAME_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  ' ',
]);

export class KeyboardState {
  constructor() {
    this.state = {
      throttle: false,
      brake: false,
      left: false,
      right: false,
      handbrake: false,
      nitro: false,
    };
  }

  /**
   * Map a KeyboardEvent-like object ({ code }) to a named control. Returns
   * void; mutates internal state. Ignores repeat keydowns (idempotent).
   */
  handleKeyDown(evt) {
    const control = KEY_MAP[evt.code];
    if (!control) return;
    if (evt.repeat) return;
    this.state[control] = true;
    this._prevent(evt);
  }

  handleKeyUp(evt) {
    const control = KEY_MAP[evt.code];
    if (!control) return;
    this.state[control] = false;
    this._prevent(evt);
  }

  /** Clear all held keys (e.g. on window blur). */
  reset() {
    for (const key of Object.keys(this.state)) this.state[key] = false;
  }

  _prevent(evt) {
    if (GAME_KEYS.has(evt.code) && evt.preventDefault) evt.preventDefault();
  }

  /** Destroy listeners attached with attach(). */
  detach() {
    if (this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup', this._onKeyUp);
      window.removeEventListener('blur', this._onBlur);
      this._onKeyDown = this._onKeyUp = this._onBlur = null;
    }
  }

  /** Wire DOM listeners. Returns this for chaining. */
  attach(windowObj) {
    this._onKeyDown = (e) => this.handleKeyDown(e);
    this._onKeyUp = (e) => this.handleKeyUp(e);
    this._onBlur = () => this.reset();
    windowObj.addEventListener('keydown', this._onKeyDown);
    windowObj.addEventListener('keyup', this._onKeyUp);
    windowObj.addEventListener('blur', this._onBlur);
    return this;
  }
}

/** Derived convenience booleans used by the physics loop. */
export function controlsFromState(state, config) {
  void config;
  const steer = (state.right ? 1 : 0) - (state.left ? 1 : 0);
  return {
    throttle: state.throttle,
    brake: state.brake,
    handbrake: state.handbrake,
    steer,
    // Nitro only counts if the car is actually asking for it and has charge.
    nitroRequested: state.nitro,
  };
}