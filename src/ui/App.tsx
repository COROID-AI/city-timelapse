/**
 * App — composes the 3D Scene with the DOM UI overlay.
 *
 * Also installs global gesture handling so the first user interaction unlocks
 * audio (browsers block AudioContext until a gesture), and detects
 * WebGL-unavailability up front so we can show a DOM error instead of a blank
 * canvas.
 */

import { useEffect, useRef } from "react";
import { Scene } from "../scene/Scene";
import { Timeline } from "./Timeline";
import { Hud } from "./Hud";
import { StatusOverlay } from "./StatusOverlay";
import { useAppStore } from "../state/store";
import { audioEngine } from "../audio/AudioEngine";
import { eraState } from "../runtime/eraState";
import { ERA_YEARS } from "../data/eras";

export function App() {
  const setStatus = useAppStore((s) => s.setStatus);
  const setError = useAppStore((s) => s.setError);
  const resetViewRef = useRef<() => void>(() => {});

  // Detect WebGL availability before mounting the Canvas.
  useEffect(() => {
    const ok = (() => {
      try {
        const canvas = document.createElement("canvas");
        return !!(
          window.WebGLRenderingContext &&
          (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
        );
      } catch {
        return false;
      }
    })();
    if (!ok) {
      setError("webgl-unavailable", "WebGL is not available in this browser.");
    }
  }, [setError]);

  // Unlock audio on the first user gesture anywhere in the document.
  useEffect(() => {
    const unlock = () => {
      if (!audioEngine.started) {
        audioEngine.init();
        useAppStore.getState().markAudioStarted();
      }
    };
    const opts = { once: true } as const;
    window.addEventListener("pointerdown", unlock, opts);
    window.addEventListener("keydown", unlock, opts);
    window.addEventListener("touchstart", unlock, opts);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  return (
    <div className="app">
      <Scene onReady={() => setStatus("ready")} resetViewRef={resetViewRef} />
      <div className="ui-layer">
        <Timeline />
        <Hud onResetCamera={() => resetViewRef.current()} />
        <YearWatermark />
      </div>
      <StatusOverlay />
    </div>
  );
}

/** Big translucent year readout anchored bottom-center; tracks the eased era. */
function YearWatermark() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (ref.current) {
        const nearest = Math.round(eraState.eraFloat);
        ref.current.textContent = String(ERA_YEARS[nearest] ?? "");
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <div ref={ref} className="year-watermark" aria-hidden="true" />;
}
