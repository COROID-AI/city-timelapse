import React, { useEffect, useRef, useState } from 'react';
import { Era, ERA_MUSIC } from '../App';
import './AudioManager.css';

interface AudioManagerProps {
  currentEra: Era;
}

// AudioManager creates ambient soundscapes that change with the era.
// Since we can't easily bundle real audio files, we use the Web Audio API
// to generate procedural ambient sounds that match each era's mood.
export function AudioManager({ currentEra }: AudioManagerProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<Map<string, OscillatorNode>>(new Map());
  const gainNodesRef = useRef<Map<string, GainNode>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.3);

  useEffect(() => {
    // Initialize audio context on user interaction
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
    };

    document.addEventListener('click', initAudio);
    document.addEventListener('keydown', initAudio);

    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
    };
  }, []);

  useEffect(() => {
    if (!audioContextRef.current || isMuted) return;

    const ctx = audioContextRef.current;

    // Stop existing oscillators
    oscillatorsRef.current.forEach((osc) => {
      try {
        osc.stop();
      } catch {}
    });
    oscillatorsRef.current.clear();
    gainNodesRef.current.clear();

    // Create ambient sound based on era
    const createAmbientSound = () => {
      const eraConfig = getEraSoundConfig(currentEra);

      // Base ambient tone (low frequency drone)
      const baseOsc = ctx.createOscillator();
      const baseGain = ctx.createGain();
      baseOsc.type = 'sine';
      baseOsc.frequency.value = eraConfig.baseFreq;
      baseGain.gain.value = volume * 0.15;
      baseOsc.connect(baseGain);
      baseGain.connect(ctx.destination);
      baseOsc.start();

      oscillatorsRef.current.set('base', baseOsc);
      gainNodesRef.current.set('base', baseGain);

      // Era-specific sound layers
      if (eraConfig.hasRhythm) {
        // Rhythmic clicking (like a clock or machinery)
        const rhythmGain = ctx.createGain();
        rhythmGain.gain.value = volume * 0.1;
        rhythmGain.connect(ctx.destination);
        gainNodesRef.current.set('rhythm', rhythmGain);

        const rhythmInterval = setInterval(() => {
          if (!audioContextRef.current || isMuted) return;
          const click = ctx.createOscillator();
          const clickGain = ctx.createGain();
          click.type = 'sine';
          click.frequency.value = 200 + Math.random() * 200;
          clickGain.gain.value = volume * 0.05;
          click.connect(clickGain);
          clickGain.connect(ctx.destination);
          click.start();
          click.stop(ctx.currentTime + 0.05);
        }, eraConfig.rhythmInterval);

        return () => clearInterval(rhythmInterval);
      }

      if (eraConfig.hasWind) {
        // Wind-like white noise
        const windGain = ctx.createGain();
        windGain.gain.value = volume * 0.1;
        windGain.connect(ctx.destination);
        gainNodesRef.current.set('wind', windGain);

        // Create noise buffer
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        noise.connect(windGain);
        noise.start();

        oscillatorsRef.current.set('wind', noise as any);
      }

      if (eraConfig.hasHighFreq) {
        // High-frequency electronic tones
        const highOsc = ctx.createOscillator();
        const highGain = ctx.createGain();
        highOsc.type = 'sine';
        highOsc.frequency.value = eraConfig.highFreq;
        highGain.gain.value = volume * 0.08;
        highOsc.connect(highGain);
        highGain.connect(ctx.destination);
        highOsc.start();

        oscillatorsRef.current.set('high', highOsc);
        gainNodesRef.current.set('high', highGain);
      }
    };

    const cleanup = createAmbientSound();

    return () => {
      if (cleanup) cleanup();
      oscillatorsRef.current.forEach((osc) => {
        try {
          osc.stop();
        } catch {}
      });
      oscillatorsRef.current.clear();
      gainNodesRef.current.clear();
    };
  }, [currentEra, isMuted, volume]);

  return (
    <div className="audio-manager">
      <button
        className="audio-toggle"
        onClick={() => setIsMuted(!isMuted)}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? '🔇' : '🔊'}
      </button>
      <div className="audio-info">
        <span className="audio-era">{ERA_MUSIC[currentEra]}</span>
      </div>
    </div>
  );
}

function getEraSoundConfig(era: Era) {
  const configs: Record<Era, {
    baseFreq: number;
    hasRhythm: boolean;
    rhythmInterval: number;
    hasWind: boolean;
    hasHighFreq: boolean;
    highFreq: number;
  }> = {
    '1945': { baseFreq: 110, hasRhythm: true, rhythmInterval: 800, hasWind: false, hasHighFreq: false, highFreq: 0 },
    '1965': { baseFreq: 130, hasRhythm: true, rhythmInterval: 500, hasWind: false, hasHighFreq: false, highFreq: 0 },
    '1985': { baseFreq: 146, hasRhythm: true, rhythmInterval: 300, hasWind: false, hasHighFreq: true, highFreq: 880 },
    '2005': { baseFreq: 164, hasRhythm: false, rhythmInterval: 0, hasWind: true, hasHighFreq: true, highFreq: 1046 },
    '2025': { baseFreq: 174, hasRhythm: false, rhythmInterval: 0, hasWind: true, hasHighFreq: true, highFreq: 1200 },
    '2055': { baseFreq: 196, hasRhythm: true, rhythmInterval: 200, hasWind: true, hasHighFreq: true, highFreq: 1400 },
  };
  return configs[era];
}
