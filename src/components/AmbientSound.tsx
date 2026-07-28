import { useEffect, useRef } from 'react';
import { Era } from '../state';

interface Props {
  era: Era;
}

export function AmbientSound({ era }: Props) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<Map<string, AudioScheduledSourceNode>>(new Map());
  const gainNodesRef = useRef<Map<string, GainNode>>(new Map());
  const startedRef = useRef(false);

  useEffect(() => {
    const startAudio = () => {
      if (startedRef.current) return;
      startedRef.current = true;

      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContext();
      } catch (e) {
        console.warn('Web Audio API not supported');
        return;
      }

      document.removeEventListener('click', startAudio);
      document.removeEventListener('keydown', startAudio);
    };

    document.addEventListener('click', startAudio);
    document.addEventListener('keydown', startAudio);

    return () => {
      document.removeEventListener('click', startAudio);
      document.removeEventListener('keydown', startAudio);
    };
  }, []);

  useEffect(() => {
    if (!startedRef.current || !audioContextRef.current) return;

    const ctx = audioContextRef.current;
    const eraSounds = [
      { freq: 220, type: 'sine' as OscillatorType, volume: 0.15 },
      { freq: 440, type: 'sine' as OscillatorType, volume: 0.12 },
      { freq: 330, type: 'square' as OscillatorType, volume: 0.10 },
      { freq: 523, type: 'sine' as OscillatorType, volume: 0.08 },
      { freq: 660, type: 'sine' as OscillatorType, volume: 0.06 },
      { freq: 880, type: 'sine' as OscillatorType, volume: 0.05 },
    ];

    const config = eraSounds[era];

    oscillatorsRef.current.forEach((osc) => {
      try { osc.stop(); } catch {}
    });
    oscillatorsRef.current.clear();
    gainNodesRef.current.forEach((gain) => gain.disconnect());
    gainNodesRef.current.clear();

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = config.type;
    osc.frequency.value = config.freq;
    gainNode.gain.value = config.volume;

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    oscillatorsRef.current.set('ambient', osc);
    gainNodesRef.current.set('ambient', gainNode);

    if (era >= 2) {
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.03;

      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(0.5, [0, 0.2, 0.4, 0.6, 0.8, 1.0][era]);
      }

      const noiseBufferSource = ctx.createBufferSource();
      noiseBufferSource.buffer = buffer;
      noiseBufferSource.loop = true;
      noiseBufferSource.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noiseBufferSource.start();

      oscillatorsRef.current.set('noise', noiseBufferSource);
      gainNodesRef.current.set('noise', noiseGain);
    }

    return () => {
      oscillatorsRef.current.forEach((osc) => {
        try { osc.stop(); } catch {}
      });
      oscillatorsRef.current.clear();
      gainNodesRef.current.forEach((gain) => gain.disconnect());
      gainNodesRef.current.clear();
    };
  }, [era]);

  useEffect(() => {
    const handleMute = () => {
      gainNodesRef.current.forEach((gain) => {
        gain.gain.value = gain.gain.value > 0 ? 0 : 0.05;
      });
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') {
        handleMute();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return null;
}
