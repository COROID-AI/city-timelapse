import { useEffect, useRef } from 'react';
import { ensureSfxManager, resetSfxManager } from '../scenes/sfx';
import type { EraYear, SfxManagerRef } from '../types';

export function useSfx() {
  const sfxManagerRef = useRef<SfxManagerRef | null>(null);
  const prevEraRef = useRef<EraYear | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    sfxManagerRef.current = ensureSfxManager();
    return () => {
      sfxManagerRef.current?.stop();
      resetSfxManager();
      sfxManagerRef.current = null;
      audioContextRef.current = null;
    };
  }, []);

  function startSfx(audioContext: AudioContext, era: EraYear, outputGain: GainNode): void {
    if (!sfxManagerRef.current) return;
    audioContextRef.current = audioContext;
    sfxManagerRef.current.start(audioContext, era, outputGain);
    prevEraRef.current = era;
  }

  function stopSfx(): void {
    sfxManagerRef.current?.stop();
  }

  function transitionSfx(audioContext: AudioContext, from: EraYear, to: EraYear, durationSeconds: number): void {
    if (!sfxManagerRef.current) return;
    audioContextRef.current = audioContext;
    sfxManagerRef.current.transition(audioContext, from, to, durationSeconds);
    prevEraRef.current = to;
  }

  function getCurrentContext(): AudioContext | null {
    return sfxManagerRef.current?.getCurrentContext() ?? null;
  }

  return {
    startSfx,
    stopSfx,
    transitionSfx,
    getCurrentContext,
    prevEraRef,
    audioContextRef,
  };
}
