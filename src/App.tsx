import * as React from 'react';

import { useEraStore } from './state/eraStore.js';
import { CityScene } from './scenes/CityScene.js';
import type { ComposedSceneHandle } from './scenes/CityScene.js';

/**
 * App — the application root / composition entrypoint.
 *
 * Owns the single era selection store (`useEraStore`) and mounts the composed
 * {@link CityScene} against it. This is the ONE composition entrypoint: the
 * store is created here and handed to the scene, so the timeline slider and
 * the whole city block share a single tweened era selection.
 *
 * The scene owns every subsystem lifecycle and its cleanup contract, so the
 * app root only needs to own the store.
 *
 * `onComposedReady` is an optional browser-QA hook: when supplied it receives
 * a live handle to the composed subsystem instances once the scene mounts,
 * letting the E2E harness assert real integrated audio/era behaviour.
 */
export function App({
  onComposedReady,
}: {
  onComposedReady?: (handle: ComposedSceneHandle) => void;
} = {}): React.ReactElement {
  const store = useEraStore();
  return (
    <div className="app-root">
      <CityScene store={store} onComposedReady={onComposedReady} />
    </div>
  );
}

export default App;