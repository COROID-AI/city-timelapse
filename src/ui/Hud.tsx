/**
 * HUD: audio toggle, reset-camera button, reduced-motion toggle, help text.
 * All controls are real DOM buttons (keyboard + touch friendly).
 */

import { useAppStore } from "../state/store";
import { audioEngine } from "../audio/AudioEngine";

export function Hud({ onResetCamera }: { onResetCamera: () => void }) {
  const audioEnabled = useAppStore((s) => s.audioEnabled);
  const audioStarted = useAppStore((s) => s.audioStarted);
  const toggleAudio = useAppStore((s) => s.toggleAudio);
  const markAudioStarted = useAppStore((s) => s.markAudioStarted);
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const setReducedMotion = useAppStore((s) => s.setReducedMotion);

  return (
    <div className="hud">
      <button
        type="button"
        className="hud-btn"
        aria-pressed={audioEnabled}
        onClick={() => {
          // First click also unlocks audio (user gesture).
          if (!audioStarted) {
            audioEngine.init();
            markAudioStarted();
          }
          toggleAudio();
          audioEngine.setEnabled(!audioEnabled);
        }}
      >
        {audioEnabled ? "🔊 Sound On" : "🔇 Sound Off"}
      </button>
      <button
        type="button"
        className="hud-btn"
        aria-pressed={reducedMotion}
        onClick={() => setReducedMotion(!reducedMotion)}
        title="Snap era transitions instantly"
      >
        {reducedMotion ? "蜗 Reduced Motion" : "↺ Reduced Motion"}
      </button>
      <button type="button" className="hud-btn" onClick={onResetCamera} title="Reset camera">
        🎯 Reset View
      </button>
      <p className="hud-help">
        Drag to orbit · Right/Shift-drag to pan · Scroll to zoom · ← → keys change era
      </p>
    </div>
  );
}
