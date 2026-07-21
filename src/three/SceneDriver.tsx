import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import { audioEngine } from '../audio/AudioEngine';

/**
 * Drives the single-scalar transition engine. Runs every frame:
 *  1. relaxes `eraFloat` toward `targetEra`
 *  2. fires an audio whoosh when the user selects a new era
 *
 * This component renders nothing — it is a frame-loop side-effect only.
 */
export function SceneDriver() {
  const prevTarget = useRef(useSceneStore.getState().targetEra);

  useFrame((_, dt) => {
    const store = useSceneStore.getState();

    // Detect an era selection change → trigger transition whoosh.
    if (store.targetEra !== prevTarget.current) {
      prevTarget.current = store.targetEra;
      if (store.sfxEnabled) audioEngine.whoosh();
    }

    // Clamp dt so a tab-switch doesn't cause a giant jump.
    store.tick(Math.min(dt, 1 / 30));
  });

  return null;
}
