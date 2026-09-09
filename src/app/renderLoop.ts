/**
 * Render loop for the City Time Period Timelapse scaffold.
 *
 * Exposed contract — `startRenderLoop(canvas, callbacks): RenderLoopHandle` —
 * is consumed by every later system (scene composition, atmosphere, buildings,
 * audio, UI) and is re-owned by the compose-scene-app task. It owns the single
 * requestAnimationFrame heartbeat for the whole app, computes per-frame delta
 * time, and provides dispose semantics for clean teardown.
 */

export interface RenderLoopCallbacks {
  /**
   * Called once per animation frame with the elapsed time since the previous
   * frame, in seconds. The first frame's delta is 0; deltas are clamped to
   * non-negative values.
   */
  update: (deltaSeconds: number) => void;
  /** Optional cleanup hook invoked exactly once when the loop is disposed. */
  onDispose?: (() => void) | undefined;
}

export interface RenderLoopHandle {
  /** True while a frame is scheduled (from start until dispose). */
  readonly running: boolean;
  /** Cancels the pending frame and invokes `onDispose` exactly once. Safe to call repeatedly. */
  dispose(): void;
}

const MILLIS_PER_SECOND = 1000;

/**
 * Starts a requestAnimationFrame loop that drives `callbacks.update` with
 * delta time. The canvas is validated up front but not otherwise used by the
 * loop; it anchors the contract for later systems that pass their renderer's
 * canvas (and therefore own its lifecycle).
 */
export function startRenderLoop(
  canvas: HTMLCanvasElement,
  callbacks: RenderLoopCallbacks,
): RenderLoopHandle {
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new TypeError('startRenderLoop requires an HTMLCanvasElement as its first argument');
  }
  if (typeof callbacks.update !== 'function') {
    throw new TypeError('startRenderLoop requires an update callback');
  }

  let disposed = false;
  let running = false;
  let rafId = 0;
  // Null until the first frame so the first delta is 0, independent of clock.
  let previousTime: number | null = null;

  function frame(now: number): void {
    if (disposed) return;
    const deltaSeconds =
      previousTime === null ? 0 : Math.max(0, (now - previousTime) / MILLIS_PER_SECOND);
    previousTime = now;
    callbacks.update(deltaSeconds);
    if (disposed) return;
    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);
  running = true;

  return {
    get running(): boolean {
      return running;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      running = false;
      if (rafId !== 0) {
        cancelAnimationFrame(rafId);
      }
      callbacks.onDispose?.();
    },
  };
}