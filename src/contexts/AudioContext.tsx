import { createContext, useContext, useRef, useCallback, useState } from 'react';
import type { AudioContextType } from '../types';

const AudioContextProviderContext = createContext<AudioContextType | null>(null);

export function AudioContextProvider({ children }: { children: React.ReactNode }) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<Map<string, OscillatorNode> | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const [isMuted, setIsMuted] = useState(true);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = next ? 0 : 0.5;
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
