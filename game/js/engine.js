/**
 * Game engine: fixed-timestep requestAnimationFrame loop, input state, and a
 * GameObject registry with update/draw lifecycle and start/stop/dispose.
 *
 * The engine is dependency-injected (requestAnimationFrame, cancelAnimationFrame,
 * and the canvas context) so it is fully testable under Jest without a real DOM.
 */

import {
  FIXED_TIMESTEP_MS,
  MAX_FRAME_STEPS,
} from './constants.js';

/**
 * Engine class. Construct with injected dependencies for testability.
 *
 * @example
 * const engine = new Engine({
 *   raf: requestAnimationFrame,
 *   caf: cancelAnimationFrame,
 *   getContext: () => canvas.getContext('2d'),
 * });
 * engine.start();
 * engine.stop();
 */
export class Engine {
  /**
   * @param {object} options - Dependency injections.
   * @param {Function} options.raf - requestAnimationFrame-compatible callback (frameTime) => id.
   * @param {Function} options.caf - cancelAnimationFrame-compatible (id) => void.
   * @param {() => CanvasRenderingContext2D} options.getContext - Returns the 2D context to draw on.
   */
  constructor({ raf, caf, getContext }) {
    this.raf = raf;
    this.caf = caf;
    this.getContext = getContext;

    /** @type {boolean} Whether the loop is currently running. */
    this.running = false;
    /** @type {number|null} Active requestAnimationFrame handle. */
    this.frameId = null;
    /** @type {number} Wall-clock timestamp of the previous frame (ms). */
    this.lastTime = null;
    /** @type {number} Accumulated fixed-step time in ms. */
    this.accumulator = 0;
    /** @type {number} Total fixed simulation steps executed since start. */
    this.tick = 0;

    /** @type {Set<object>} Registered GameObjects. */
    this.objects = new Set();

    /** Keyboard input state keyed by event.code. */
    this.keys = new Set();

    this._onKeyDown = (e) => {
      this.keys.add(e.code);
      e.preventDefault();
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
    };
  }

  /** Whether the given key code is currently held. */
  isDown(code) {
    return this.keys.has(code);
  }

  /** Register a GameObject (object with optional update/updateFixed/draw). */
  add(obj) {
    if (obj && typeof obj.onAdd === 'function') obj.onAdd(this);
    this.objects.add(obj);
    return obj;
  }

  /** Remove a GameObject from the registry. */
  remove(obj) {
    this.objects.delete(obj);
    return obj;
  }

  /** Advance the simulation by a single fixed step. */
  step() {
    this.tick += 1;
    for (const obj of this.objects) {
      if (obj && typeof obj.update === 'function') obj.update(this, FIXED_TIMESTEP_MS);
    }
  }

  /** Render every registered GameObject to the canvas. */
  draw() {
    const ctx = this.getContext();
    for (const obj of this.objects) {
      if (obj && typeof obj.draw === 'function') obj.draw(ctx, this);
    }
  }

  /**
   * The requestAnimationFrame callback. Accumulates elapsed time and runs a
   * fixed number of fixed-timestep updates before rendering.
   *
   * @param {number} frameTime - High-resolution timestamp in ms.
   */
  frame(frameTime) {
    if (!this.running) return;

    if (this.lastTime === null) {
      this.lastTime = frameTime;
      // First frame only records the base timestamp; no simulation step yet.
      this.draw();
      this.frameId = this.raf(this.frame.bind(this));
      return;
    }
    const delta = Math.min(frameTime - this.lastTime, 250); // clamp long gaps
    this.lastTime = frameTime;
    this.accumulator += delta;

    let steps = 0;
    while (this.accumulator >= FIXED_TIMESTEP_MS && steps < MAX_FRAME_STEPS) {
      this.step();
      this.accumulator -= FIXED_TIMESTEP_MS;
      steps += 1;
    }
    if (steps === MAX_FRAME_STEPS) {
      this.accumulator = 0; // drop backlog to avoid the spiral of death
    }

    this.draw();
    this.frameId = this.raf(this.frame.bind(this));
  }

  /** Start the game loop. No-op if already running. */
  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = null;
    this.accumulator = 0;
    this._bindInput();
    this.frameId = this.raf(this.frame.bind(this));
  }

  /** Stop the game loop and detach input listeners. */
  stop() {
    if (!this.running) return;
    this.running = false;
    if (this.frameId != null) {
      this.caf(this.frameId);
      this.frameId = null;
    }
    this._unbindInput();
  }

  /** Bind keyboard listeners to the window. */
  _bindInput() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  /** Detach keyboard listeners from the window. */
  _unbindInput() {
    if (typeof window === 'undefined') return;
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }

  /** Fully tear down the engine: stop the loop and clear the registry. */
  dispose() {
    this.stop();
    this.objects.clear();
    this.keys.clear();
  }
}

/** Convenience factory returning a ready-to-use Engine. */
export function createEngine({ raf, caf, getContext }) {
  return new Engine({ raf, caf, getContext });
}

export default Engine;