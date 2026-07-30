import { createContext, useContext, useRef, useCallback, useState, useEffect } from 'react';
import type { AudioContextType } from '../types';

const AudioContextProviderContext = createContext<AudioContextType | null>(null);

export function AudioContextProvider({ children }: { children: React.ReactNode }) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<Map<string, OscillatorNode> | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const [isMuted, setIsMuted] = useState(true);

  const ensureAudioContext = useCallback(async () => {
    if (audioContextRef.current && gainNodeRef.current) return;
    const ctx = new AudioContext();
    const masterGain = ctx.createGain();
    masterGain.gain.value = isMuted ? 0 : 0.5;
    masterGain.connect(ctx.destination);
    audioContextRef.current = ctx;
    gainNodeRef.current = masterGain;
    try {
      await ctx.resume();
    } catch {
      // ignore resume errors
    }
  }, [isMuted]);

  useEffect(() => {
    return () => {
      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      gainNodeRef.current = null;
      oscillatorsRef.current = null;
      try {
        void ctx?.close();
      } catch {
        // ignore
      }
    };
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next) {
        // Muting: keep context alive but silence output
        if (gainNodeRef.current) gainNodeRef.current.gain.value = 0;
      } else {
        // Unmuting: create/resume AudioContext on user gesture
        void ensureAudioContext();
        if (gainNodeRef.current) gainNodeRef.current.gain.value = 0.5;
      }
      return next;
    });
  }, []);

  const value: AudioContextType = {
    audioContextRef,
    oscillatorsRef,
    gainNodeRef,
    isMuted,
    toggleMute,
  };

  return (
    <AudioContextProviderContext.Provider value={value}>
      {children}
    </AudioContextProviderContext.Provider>
  );
}

export function useAudioContext() {
  const ctx = useContext(AudioContextProviderContext);
  if (!ctx) {
    throw new Error('useAudioContext must be used within AudioContextProvider');
  }
  return ctx;
}
