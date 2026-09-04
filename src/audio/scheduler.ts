/**
 * Lightweight, strict-typed metronome used by the procedural music layer.
 * Schedules sixteenth-note callbacks ahead of time using a high-resolution
 * timer; fully disposed by the mixer teardown.
 */

export type StepCallback = (at: number) => void;

const SIXTEENTH_SECONDS = 0.14; // ~137 BPM sixteenth-note spacing (107 BPM quarter)
const LOOKAHEAD_SECONDS = 0.15;

export class Scheduler {
  private readonly intervalMs: number;
  private readonly timerId: number | null = null;
  private readonly callbacks = new Set<StepCallback>();
  private running = false;
  private step = 0;
  private nextEventAt = 0;

  constructor(intervalMs = 100) {
    this.intervalMs = intervalMs;
    if (typeof window !== 'undefined' && typeof window.setInterval === 'function') {
      this.timerId = window.setInterval(() => this.tick(), intervalMs);
    }
  }

  start(from = 0): void {
    this.running = true;
    this.step = 0;
    this.nextEventAt = from;
    this.tick();
  }

  stop(): void {
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  /** Register a callback fired on every sixteenth-note; returns an unsubscribe fn. */
  onStep(callback: StepCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  dispose(): void {
    this.running = false;
    this.callbacks.clear();
    if (typeof window !== 'undefined' && this.timerId !== null) {
      window.clearInterval(this.timerId);
    }
  }

  private tick(): void {
    if (!this.running) {
      return;
    }
    const now = typeof window?.performance !== 'undefined' ? window.performance.now() / 1000 : 0;
    while (this.nextEventAt < now + LOOKAHEAD_SECONDS) {
      const at = this.nextEventAt;
      for (const cb of this.callbacks) {
        cb(at);
      }
      this.step += 1;
      this.nextEventAt += SIXTEENTH_SECONDS;
    }
  }
}