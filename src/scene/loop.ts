/**
 * Clock-driven animation loop registry.
 *
 * Consumers register tick functions that receive (dt, elapsed) each frame.
 * The loop is driven by requestAnimationFrame and delegates to a SceneEngine
 * for rendering.
 */

export type TickFn = (dt: number, elapsed: number) => void;

export class AnimationLoop {
  private _ticks: TickFn[] = [];
  private _running = false;
  private _rafId?: number;
  private _lastTime = 0;
  private _elapsed = 0;
  private _startTime = 0;

  /** Register a callback invoked every frame with (deltaTime, elapsedSeconds). */
  add(tick: TickFn): void {
    if (!this._ticks.includes(tick)) {
      this._ticks.push(tick);
    }
  }

  /** Remove a previously registered callback. */
  remove(tick: TickFn): void {
    const idx = this._ticks.indexOf(tick);
    if (idx !== -1) this._ticks.splice(idx, 1);
  }

  /** Start the loop. Does nothing if already running. */
  start(): void {
    if (this._running) return;
    this._running = true;
    this._startTime = performance.now();
    this._lastTime = this._startTime;
    this._rafId = requestAnimationFrame(this._loop);
  }

  /** Stop the loop and cancel pending frames. */
  stop(): void {
    this._running = false;
    if (this._rafId !== undefined) {
      cancelAnimationFrame(this._rafId);
      this._rafId = undefined;
    }
  }

  private _loop = (time: number) => {
    if (!this._running) return;
    this._rafId = requestAnimationFrame(this._loop);

    const prev = this._lastTime;
    this._lastTime = time;
    this._elapsed = (time - this._startTime) / 1000;
    const dt = Math.min((time - prev) / 1000, 0.1); // cap at 100 ms

    for (let i = 0; i < this._ticks.length; i++) {
      this._ticks[i](dt, this._elapsed);
    }
  };

  get running(): boolean {
    return this._running;
  }

  /** Current accumulated elapsed time in seconds. */
  get elapsed(): number {
    return this._elapsed;
  }
}
