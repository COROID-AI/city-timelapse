/**
 * SfxContext: minimal placeholder WebAudio hook.
 *
 * Initializes an AudioContext on the first user gesture (click/keydown/touch)
 * and exposes a tiny beep for proving the audio path works.
 */
export interface SfxContext {
  /** Whether the AudioContext has been initialized. */
  readonly initialized: boolean;
  /** Play a short placeholder blip. Safe to call before init (no-op). */
  blip(freq?: number): void;
  /** Dispose: close the AudioContext and detach gesture listeners. */
  dispose(): void;
}

export function createSfxContext(): SfxContext {
  let ctx: AudioContext | null = null;
  let inited = false;
  const gestureTypes = ['click', 'keydown', 'touchstart', 'pointerdown'];

  function init(): void {
    if (inited) return;
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        ctx = new AC();
        inited = true;
      }
    } catch {
      inited = false;
    }
  }

  function blip(freq = 440): void {
    if (!ctx || ctx.state === 'closed') return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(t + 0.12);
  }

  const onGesture = () => {
    if (!inited) {
      init();
    }
  };

  for (const type of gestureTypes) {
    window.addEventListener(type, onGesture);
  }

  return {
    get initialized() {
      return inited;
    },
    blip,
    dispose() {
      for (const type of gestureTypes) {
        window.removeEventListener(type, onGesture);
      }
      if (ctx && ctx.state !== 'closed') {
        void ctx.close();
      }
      ctx = null;
    },
  };
}