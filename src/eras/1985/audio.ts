import { SfxContext } from '../../audio/sfxContext';

/**
 * 1985 Era Audio & SFX Module
 *
 * Requirements:
 * - Synth-pop radio loop (synthesized 80s arpeggio bassline + brass chord stab / lead).
 * - Arcade beeps and coin drops (8-bit chiptune sound effects, coin drop clicks).
 * - Heavy traffic ambient rumble.
 * - Taxi horn chorus (randomized multi-tone cab honks).
 * - Helicopter flyover (low-frequency rotor chop / whoosh).
 * - Subway rumble (deep subterranean bass rumble).
 * - Seamless integration with SfxContext and programmatic WebAudio stems.
 */

export interface Era1985AudioStems {
  readonly synthPopRadio: () => void;
  readonly arcadeBeeps: () => void;
  readonly coinDrop: () => void;
  readonly heavyTraffic: () => void;
  readonly taxiHorn: () => void;
  readonly helicopterFlyover: () => void;
  readonly subwayRumble: () => void;
}

export interface Era1985Audio {
  readonly stems: Era1985AudioStems;
  readonly stemNames: readonly string[];
  playStem(name: string): void;
  startAmbience(): void;
  stopAmbience(): void;
  update(dt: number): void;
  dispose(): void;
}

export function create1985Audio(sfxContext?: SfxContext): Era1985Audio {
  let ctx: AudioContext | null = null;
  let isRunning = false;
  let synthTimer: ReturnType<typeof setInterval> | null = null;

  function getAudioContext(): AudioContext | null {
    if (ctx && ctx.state !== 'closed') return ctx;
    try {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        ctx = new AC();
      }
    } catch {
      ctx = null;
    }
    return ctx;
  }

  // 1. Synth-pop radio loop (80s analog synth arpeggio pattern: Dm -> F -> C -> Bb)
  function synthPopRadio(): void {
    const ac = getAudioContext();
    if (!ac || ac.state === 'closed') {
      sfxContext?.blip(587.33); // D5
      return;
    }
    const t = ac.currentTime;
    const notes = [293.66, 349.23, 440.0, 523.25, 440.0, 349.23, 392.0, 329.63]; // D4, F4, A4, C5, A4, F4, G4, E4
    notes.forEach((freq, idx) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t + idx * 0.12);

      // 80s Lowpass filter envelope for classic synth-bass snap
      const filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, t + idx * 0.12);
      filter.frequency.exponentialRampToValueAtTime(300, t + idx * 0.12 + 0.1);

      gain.gain.setValueAtTime(0.04, t + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.12 + 0.11);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ac.destination);

      osc.start(t + idx * 0.12);
      osc.stop(t + idx * 0.12 + 0.12);
    });
  }

  // 2. Arcade beeps (8-bit chiptune sound effect)
  function arcadeBeeps(): void {
    const ac = getAudioContext();
    if (!ac || ac.state === 'closed') {
      sfxContext?.blip(880);
      return;
    }
    const t = ac.currentTime;
    const freqs = [440, 660, 880, 1320];
    freqs.forEach((freq, idx) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t + idx * 0.05);

      gain.gain.setValueAtTime(0.03, t + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 0.045);

      osc.connect(gain);
      gain.connect(ac.destination);

      osc.start(t + idx * 0.05);
      osc.stop(t + idx * 0.05 + 0.05);
    });
  }

  // 3. Coin drop (metallic arcade coin drop click)
  function coinDrop(): void {
    const ac = getAudioContext();
    if (!ac || ac.state === 'closed') {
      sfxContext?.blip(1760);
      return;
    }
    const t = ac.currentTime;
    [1800, 2400].forEach((freq, idx) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.08);

      gain.gain.setValueAtTime(0.05, t + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.07);

      osc.connect(gain);
      gain.connect(ac.destination);

      osc.start(t + idx * 0.08);
      osc.stop(t + idx * 0.08 + 0.08);
    });
  }

  // 4. Heavy traffic ambient rumble
  function heavyTraffic(): void {
    const ac = getAudioContext();
    if (!ac || ac.state === 'closed') {
      sfxContext?.blip(120);
      return;
    }
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const filter = ac.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(75, t);
    osc.frequency.linearRampToValueAtTime(85, t + 1.5);
    osc.frequency.linearRampToValueAtTime(70, t + 3.0);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(150, t);

    gain.gain.setValueAtTime(0.04, t);
    gain.gain.linearRampToValueAtTime(0.06, t + 1.5);
    gain.gain.linearRampToValueAtTime(0.001, t + 3.0);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);

    osc.start(t);
    osc.stop(t + 3.0);
  }

  // 5. Taxi horn chorus (multi-tone city cab honks)
  function taxiHorn(): void {
    const ac = getAudioContext();
    if (!ac || ac.state === 'closed') {
      sfxContext?.blip(349);
      return;
    }
    const t = ac.currentTime;
    // Dual tone 392Hz (G4) & 494Hz (B4) typical car horn interval
    [392.0, 493.88].forEach((freq) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.04, t);
      gain.gain.setValueAtTime(0.04, t + 0.28);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(gain);
      gain.connect(ac.destination);

      osc.start(t);
      osc.stop(t + 0.35);
    });
  }

  // 6. Helicopter flyover (low frequency rotor chop modulation)
  function helicopterFlyover(): void {
    const ac = getAudioContext();
    if (!ac || ac.state === 'closed') {
      sfxContext?.blip(60);
      return;
    }
    const t = ac.currentTime;
    const duration = 2.4;

    const osc = ac.createOscillator();
    const chopper = ac.createOscillator();
    const chopGain = ac.createGain();
    const mainGain = ac.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(55, t);

    chopper.type = 'square';
    chopper.frequency.setValueAtTime(16, t); // 16 Hz rotor blade chop

    chopGain.gain.setValueAtTime(0.5, t);
    chopper.connect(chopGain.gain);

    mainGain.gain.setValueAtTime(0.01, t);
    mainGain.gain.linearRampToValueAtTime(0.05, t + duration * 0.4);
    mainGain.gain.linearRampToValueAtTime(0.001, t + duration);

    osc.connect(chopGain);
    chopGain.connect(mainGain);
    mainGain.connect(ac.destination);

    osc.start(t);
    chopper.start(t);
    osc.stop(t + duration);
    chopper.stop(t + duration);
  }

  // 7. Subway rumble (deep subterranean bass rumble)
  function subwayRumble(): void {
    const ac = getAudioContext();
    if (!ac || ac.state === 'closed') {
      sfxContext?.blip(40);
      return;
    }
    const t = ac.currentTime;
    const duration = 3.5;

    const osc = ac.createOscillator();
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(32, t);
    osc.frequency.linearRampToValueAtTime(45, t + duration * 0.5);
    osc.frequency.linearRampToValueAtTime(28, t + duration);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(80, t);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.06, t + duration * 0.5);
    gain.gain.linearRampToValueAtTime(0.001, t + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);

    osc.start(t);
    osc.stop(t + duration);
  }

  const stems: Era1985AudioStems = {
    synthPopRadio,
    arcadeBeeps,
    coinDrop,
    heavyTraffic,
    taxiHorn,
    helicopterFlyover,
    subwayRumble,
  };

  const stemNames = Object.keys(stems) as readonly string[];

  let timeAccumulator = 0;

  return {
    stems,
    stemNames,
    playStem(name: string) {
      const fn = stems[name as keyof Era1985AudioStems];
      if (fn) fn();
    },
    startAmbience() {
      if (isRunning) return;
      isRunning = true;
      // Start periodic radio/traffic/horn ambience
      synthPopRadio();
      synthTimer = setInterval(() => {
        if (!isRunning) return;
        synthPopRadio();
      }, 3500);
    },
    stopAmbience() {
      isRunning = false;
      if (synthTimer) {
        clearInterval(synthTimer);
        synthTimer = null;
      }
    },
    update(dt: number) {
      if (!isRunning) return;
      timeAccumulator += dt;
      // Trigger random street SFX periodically
      if (timeAccumulator > 8.0) {
        timeAccumulator = 0;
        const roll = Math.random();
        if (roll < 0.3) taxiHorn();
        else if (roll < 0.55) arcadeBeeps();
        else if (roll < 0.75) coinDrop();
        else if (roll < 0.9) helicopterFlyover();
        else subwayRumble();
      }
    },
    dispose() {
      this.stopAmbience();
      if (ctx && ctx.state !== 'closed') {
        void ctx.close();
      }
      ctx = null;
    },
  };
}
