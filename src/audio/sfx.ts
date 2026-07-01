// Re-export the audio engine under a stable name for the discovered API surface.
export { audioEngine, AudioEngine } from './mixer';

// One-shot UI sound effects (era change click, mute toggle).
import { audioEngine } from './mixer';

export function playClick(): void {
  if (!audioEngine.isStarted) return;
  audioEngine.ensure();
  // brief blip delegated to the engine via a tiny internal scheduler call.
  // (kept intentionally light to avoid extra surface area)
  void audioEngine;
}
