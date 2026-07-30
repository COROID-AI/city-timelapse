import React, { useRef, useEffect, useCallback } from 'react';
import { Era } from '../data/eraData';

interface AudioManagerProps {
  era: Era;
}

/**
 * AudioManager: Browser-compatible era-adjacent Web Audio ambient sound.
 * Requires user gesture to start (autoplay policy). Shows a visible
 * click-to-start overlay on first interaction per finding eb80/3.
 */
const AudioManager: React.FC<AudioManagerProps> = React.memo(({ era }) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const startedRef = useRef(false);
  const oscillatorsRef = useRef<{ osc: OscillatorNode; osc2: OscillatorNode; gain: GainNode; gain2: GainNode } | null>(null);

  const isAudioSupported = typeof window !== 'undefined' && (() => {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    return typeof AC === 'function';
  })();

  const buildSoundscape = useCallback((ctx: AudioContext) => {
    // If already running, stop first
    if (oscillatorsRef.current) {
      oscillatorsRef.current.osc.stop();
      oscillatorsRef.current.osc2.stop();
      oscillatorsRef.current = null;
    }

    const frequencies: Record<Era, number> = {
      1945: 110,
      1965: 130,
      1985: 165,
      2005: 196,
      2025: 220,
      2055: 261,
    };
    const freq = frequencies[era] || 130;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.value = freq;
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start();

    // Second layer for richer ambient
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = freq * 0.5;
    const gain2 = ctx.createGain();
    gain2.gain.value = 0;
    gain2.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start();

    oscillatorsRef.current = { osc, osc2, gain, gain2 };
  }, [era]);

  const handleStart = useCallback(() => {
    if (!isAudioSupported || startedRef.current) return;
    startedRef.current = true;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (typeof AudioCtx !== 'function') return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      buildSoundscape(audioCtx);
    } catch {
      // Gracefully fail if audio is not available
    }
  }, [isAudioSupported, buildSoundscape]);

  useEffect(() => {
    // Rebuild soundscape when era changes (only if already started)
    if (startedRef.current && audioContextRef.current && audioContextRef.current.state !== 'closed') {
      buildSoundscape(audioContextRef.current);
    }
    return () => {
      // Cleanup on unmount
      if (oscillatorsRef.current) {
        try {
          oscillatorsRef.current.osc.stop();
          oscillatorsRef.current.osc2.stop();
        } catch { /* already stopped */ }
        oscillatorsRef.current = null;
      }
    };
  }, [buildSoundscape]);

  // Browser does not support Web Audio API
  if (!isAudioSupported) {
    return null;
  }

  return (
    <div className="audio-overlay" onClick={handleStart} role="button" aria-label="Activate ambient audio" tabIndex={0}>
      {!startedRef.current && (
        <div className="audio-start-prompt">
          <span className="audio-icon" aria-hidden="true">🔊</span>
          <span>Click to Enable Audio</span>
        </div>
      )}
    </div>
  );
});

export default AudioManager;
