import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import type { ComposedSceneHandle } from './scenes/CityScene.js';
import './styles.css';

/**
 * Browser entrypoint for the composed CityScene.
 *
 * Mounts the single composition root ({@link App}) into the `#root` div served
 * by the QA E2E harness. The scene transforms in front of the viewer as the
 * top timeline slider is driven across all five eras.
 *
 * A QA bridge is exposed on `window.__CITY_SCENE__` (live getters backed by the
 * mounted composed handle) so the E2E/regression suite can assert real
 * integrated behaviour — the AmbientAudio graph and the era store — against a
 * running browser mount, including after the scene unmounts.
 */

declare global {
  interface Window {
    /** QA bridge exposing live access to the composed scene state. */
    __CITY_SCENE__?: {
      /** Number of oscillators currently running in the AmbientAudio graph. */
      runningOscillatorCount: () => number;
      /** Whether the AudioContext is currently open. */
      audioOpen: () => boolean;
      /** The interpolated era year currently driving the scene. */
      eraYear: () => number;
    };
    /** QA: freeze the auto tween so each selected era holds steady on screen. */
    __CITY_QA_PAUSE__?: boolean;
    /** QA: unmount the composed scene through the real React teardown path. */
    __CITY_QA_UNMOUNT__?: () => void;
  }
}

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Missing #root mount container');
}

// The live handle is retained so getters stay valid after unmount (dispose
// mutates the same AudioContext instance).
let composedHandle: ComposedSceneHandle | null = null;
const root = createRoot(container);

root.render(
  <App
    onComposedReady={(handle) => {
      composedHandle = handle;
      window.__CITY_SCENE__ = {
        runningOscillatorCount: () => composedHandle?.audio.runningOscillatorCount ?? 0,
        audioOpen: () => composedHandle?.audio.hasOpenContext ?? false,
        eraYear: () => composedHandle?.store.current.year ?? -1,
      };
    }}
  />,
);

// QA helper: unmount the composed scene so its cleanup contract (audio
// dispose + AudioContext close) runs through the real React teardown path.
window.__CITY_QA_UNMOUNT__ = () => {
  root.unmount();
};