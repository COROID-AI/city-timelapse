import { useFrame } from '@react-three/fiber';
import { useSceneStore } from '../store/useSceneStore';
import { sampleAmbient } from '../engine/sceneSampler';
import { audioEngine } from '../audio/AudioEngine';

// ---------------------------------------------------------------------------
// A no-render component that pushes the sampled ambient audio params to the
// AudioEngine every frame so the soundscape morphs continuously with the era.
// ---------------------------------------------------------------------------
export function AudioDriver() {
  useFrame(() => {
    const { sfxEnabled, eraFloat } = useSceneStore.getState();
    if (!sfxEnabled) return;
    const amb = sampleAmbient(eraFloat);
    audioEngine.updateAmbient(amb);
  });
  return null;
}
