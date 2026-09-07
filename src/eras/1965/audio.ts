import { SfxContext } from '../../audio/sfxContext';

/**
 * 1965 Period Audio Subsystem:
 * Authentic synthesized sound stems:
 * 1. Doo-wop / surf radio loop from the record store (upbeat melodic progression)
 * 2. V8 engine burble (low frequency rhythmic rumble)
 * 3. Bus hiss and pneumatic doors (air-brake release burst)
 * 4. 60Hz Neon buzz (mains hum + harmonic sizzle)
 * 5. Jukebox bleed from the diner (warm muffled bass rhythm)
 */

export interface AudioStem {
  readonly id: string;
  readonly name: string;
  readonly category: 'music' | 'vehicle' | 'ambient' | 'transit';
  playing: boolean;
  volume: number;
  play(): void;
  stop(): void;
}

export interface Era1965Audio {
  readonly stems: readonly AudioStem[];
  readonly isRunning: boolean;
  start(): void;
  stop(): void;
  setMasterVolume(vol: number): void;
  update(dt: number, time: number): void;
  dispose(): void;
}

export function create1965Audio(sfxContext?: SfxContext): Era1965Audio {
  let masterVolume = 0.8;
  let isRunning = false;
  let audioCtx: AudioContext | null = null;
  let masterGain: GainNode | null = null;

  // Stems list
  const stems: AudioStem[] = [];

  // WebAudio node references for synthesis
  let v8Osc: OscillatorNode | null = null;
  let v8Gain: GainNode | null = null;
  let v8Lfo: OscillatorNode | null = null;

  let neonOsc60: OscillatorNode | null = null;
  let neonOsc120: OscillatorNode | null = null;
  let neonGain: GainNode | null = null;

  let jukeboxGain: GainNode | null = null;
  let surfInterval: number | null = null;
  let busInterval: number | null = null;

  function initWebAudio(): void {
    if (audioCtx) return;
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        audioCtx = new AC();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = masterVolume;
        masterGain.connect(audioCtx.destination);
      }
    } catch {
      // AudioContext unavailable in non-browser environment
    }
  }

  // 1. Doo-wop / Surf Radio Loop
  const surfStem: AudioStem = {
    id: 'sfx-1965-surf-radio',
    name: 'Doo-Wop / Surf Radio Loop',
    category: 'music',
    playing: false,
    volume: 0.7,
    play() {
      this.playing = true;
      if (!audioCtx || !masterGain) return;
      // Surf guitar riff notes (E minor / A minor surf rock pentatonic)
      const riffFreqs = [329.63, 392.0, 440.0, 493.88, 587.33, 493.88, 440.0, 392.0];
      let noteIdx = 0;
      if (surfInterval === null && typeof window !== 'undefined') {
        surfInterval = window.setInterval(() => {
          if (!this.playing || !audioCtx || !masterGain || audioCtx.state === 'closed') return;
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          const freq = riffFreqs[noteIdx % riffFreqs.length];
          noteIdx++;

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

          // Fast plucked surf envelope
          const t = audioCtx.currentTime;
          gain.gain.setValueAtTime(0.001, t);
          gain.gain.exponentialRampToValueAtTime(0.12 * this.volume, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(t);
          osc.stop(t + 0.2);
        }, 180);
      }
    },
    stop() {
      this.playing = false;
      if (surfInterval !== null && typeof window !== 'undefined') {
        window.clearInterval(surfInterval);
        surfInterval = null;
      }
    },
  };
  stems.push(surfStem);

  // 2. V8 Engine Burble
  const v8Stem: AudioStem = {
    id: 'sfx-1965-v8-burble',
    name: 'V8 Engine Burble',
    category: 'vehicle',
    playing: false,
    volume: 0.6,
    play() {
      this.playing = true;
      if (!audioCtx || !masterGain || v8Osc) return;
      try {
        v8Osc = audioCtx.createOscillator();
        v8Gain = audioCtx.createGain();
        v8Lfo = audioCtx.createOscillator();
        const lfoGain = audioCtx.createGain();

        // Deep 48Hz base rumbling tone
        v8Osc.type = 'sawtooth';
        v8Osc.frequency.setValueAtTime(48, audioCtx.currentTime);

        // LFO simulating 8-cylinder uneven burble cadence
        v8Lfo.type = 'sine';
        v8Lfo.frequency.setValueAtTime(14, audioCtx.currentTime);
        lfoGain.gain.setValueAtTime(16, audioCtx.currentTime);

        v8Lfo.connect(lfoGain);
        lfoGain.connect(v8Osc.frequency);

        v8Gain.gain.setValueAtTime(0.06 * this.volume, audioCtx.currentTime);
        v8Osc.connect(v8Gain);
        v8Gain.connect(masterGain);

        v8Osc.start();
        v8Lfo.start();
      } catch {
        // Fallback
      }
    },
    stop() {
      this.playing = false;
      if (v8Osc) {
        try {
          v8Osc.stop();
          v8Lfo?.stop();
        } catch {
          // ignore
        }
        v8Osc = null;
        v8Lfo = null;
        v8Gain = null;
      }
    },
  };
  stems.push(v8Stem);

  // 3. Bus Hiss and Doors
  const busStem: AudioStem = {
    id: 'sfx-1965-bus-hiss',
    name: 'Bus Pneumatic Hiss & Doors',
    category: 'transit',
    playing: false,
    volume: 0.5,
    play() {
      this.playing = true;
      if (busInterval === null && typeof window !== 'undefined') {
        busInterval = window.setInterval(() => {
          if (!this.playing || !audioCtx || !masterGain || audioCtx.state === 'closed') return;
          try {
            // White noise burst for pneumatic brake release
            const bufferSize = audioCtx.sampleRate * 0.4;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
              data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.1));
            }
            const noise = audioCtx.createBufferSource();
            noise.buffer = buffer;

            const filter = audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(3200, audioCtx.currentTime);

            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.15 * this.volume, audioCtx.currentTime);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(masterGain);
            noise.start();
          } catch {
            // ignore
          }
        }, 8000);
      }
    },
    stop() {
      this.playing = false;
      if (busInterval !== null && typeof window !== 'undefined') {
        window.clearInterval(busInterval);
        busInterval = null;
      }
    },
  };
  stems.push(busStem);

  // 4. Neon Buzz
  const neonStem: AudioStem = {
    id: 'sfx-1965-neon-buzz',
    name: '60Hz Neon Sign Buzz',
    category: 'ambient',
    playing: false,
    volume: 0.4,
    play() {
      this.playing = true;
      if (!audioCtx || !masterGain || neonOsc60) return;
      try {
        neonOsc60 = audioCtx.createOscillator();
        neonOsc120 = audioCtx.createOscillator();
        neonGain = audioCtx.createGain();

        neonOsc60.type = 'sawtooth';
        neonOsc60.frequency.setValueAtTime(60, audioCtx.currentTime);

        neonOsc120.type = 'sawtooth';
        neonOsc120.frequency.setValueAtTime(120, audioCtx.currentTime);

        neonGain.gain.setValueAtTime(0.025 * this.volume, audioCtx.currentTime);

        neonOsc60.connect(neonGain);
        neonOsc120.connect(neonGain);
        neonGain.connect(masterGain);

        neonOsc60.start();
        neonOsc120.start();
      } catch {
        // ignore
      }
    },
    stop() {
      this.playing = false;
      if (neonOsc60) {
        try {
          neonOsc60.stop();
          neonOsc120?.stop();
        } catch {
          // ignore
        }
        neonOsc60 = null;
        neonOsc120 = null;
        neonGain = null;
      }
    },
  };
  stems.push(neonStem);

  // 5. Jukebox Bleed from the Diner
  const jukeboxStem: AudioStem = {
    id: 'sfx-1965-jukebox-bleed',
    name: 'Diner Jukebox Bleed',
    category: 'music',
    playing: false,
    volume: 0.65,
    play() {
      this.playing = true;
      if (!audioCtx || !masterGain) return;
      try {
        jukeboxGain = audioCtx.createGain();
        jukeboxGain.gain.setValueAtTime(0.08 * this.volume, audioCtx.currentTime);
        jukeboxGain.connect(masterGain);
      } catch {
        // ignore
      }
    },
    stop() {
      this.playing = false;
      jukeboxGain = null;
    },
  };
  stems.push(jukeboxStem);

  function start(): void {
    if (isRunning) return;
    isRunning = true;
    initWebAudio();
    for (const stem of stems) {
      stem.play();
    }
    // Also trigger initial proof blip on sfxContext if present
    if (sfxContext && sfxContext.initialized) {
      sfxContext.blip(520);
    }
  }

  function stop(): void {
    if (!isRunning) return;
    isRunning = false;
    for (const stem of stems) {
      stem.stop();
    }
  }

  return {
    stems,
    get isRunning() {
      return isRunning;
    },
    start,
    stop,
    setMasterVolume(vol: number) {
      masterVolume = Math.max(0, Math.min(1, vol));
      if (masterGain && audioCtx) {
        masterGain.gain.setValueAtTime(masterVolume, audioCtx.currentTime);
      }
    },
    update(_dt: number, _time: number) {
      // Dynamic volume modulation based on camera or scene activity
    },
    dispose() {
      stop();
      if (audioCtx && audioCtx.state !== 'closed') {
        void audioCtx.close();
      }
      audioCtx = null;
      masterGain = null;
    },
  };
}
