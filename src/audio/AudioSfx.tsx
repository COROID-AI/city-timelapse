import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useEraTimeline } from '../store/eraTimeline';
import { useAudio } from '../store/audio';
import { SfxMixer } from './mixer';

/**
 * Audio controller component.
 *
 * Owns a single SfxMixer instance for the lifetime of the app, subscribes it to
 * the era timeline store (crossfading the ambient beds and firing the whoosh on
 * every era change) and to the mute store (silencing all output through the
 * master gain). Advances the one-shot event scheduler each frame.
 *
 * The mixer's AudioContext is created lazily on the first user gesture
 * (pointer/keydown) to satisfy the browser autoplay policy; until then the
 * mixer simply remembers the selected era and applies it on unlock.
 *
 * Renders nothing — it is a pure side-effect wiring point.
 */
export function AudioSfx() {
  const mixerRef = useRef<SfxMixer | null>(null);

  useEffect(() => {
    const mixer = new SfxMixer({ muted: useAudio.getState().muted });
    mixerRef.current = mixer;

    // Apply the currently selected era up front.
    mixer.setEra(useEraTimeline.getState().targetEra);

    // Crossfade + whoosh whenever the target era changes.
    const unsubEra = useEraTimeline.subscribe((state, prev) => {
      if (state.targetEra !== prev.targetEra) {
        mixer.setEra(state.targetEra);
      }
    });

    // Mute/unmute through the master gain.
    const unsubMute = useAudio.subscribe((state, prev) => {
      if (state.muted !== prev.muted) {
        mixer.setMuted(state.muted);
      }
    });

    // Unlock audio on the first user gesture (autoplay policy).
    const unlock = () => mixer.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      unsubEra();
      unsubMute();
      mixer.dispose();
      mixerRef.current = null;
    };
  }, []);

  // Advance the event scheduler from the render loop.
  useFrame((_, delta) => {
    mixerRef.current?.update(Math.min(delta, 0.05));
  });

  return null;
}