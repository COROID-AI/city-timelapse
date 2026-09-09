/**
 * Audio Era Specifications and Soundscape Layer Definitions.
 *
 * Provides procedural audio definitions, musical arrangements, and ambience
 * profiles for each of the five eras (1945, 1965, 1985, 2005, 2025).
 *
 * Types and pure data only — no binary assets, no external audio files.
 */

import type { AudioEraSpec } from '../era/types';
import type { EraId } from '../era/years';

/**
 * Standard AudioEraSpec definitions per era matching the master registry.
 */
export const audioEraData: Record<EraId, AudioEraSpec> = {
  '1945': {
    themeTitle: 'Victory Boulevard Swing',
    genre: 'Big Band & Swing Orchestra',
    bpm: 112,
    synthProfile: 'big_band_swing',
    ambienceProfile: 'clattering_trams_horns',
    filterProfile: 'am_radio_lofi',
    hornType: 'vintage_klaxon',
  },
  '1965': {
    themeTitle: 'Downtown Groove Express',
    genre: 'Mod Rock, Motown & Soul',
    bpm: 124,
    synthProfile: 'motown_mod_rock',
    ambienceProfile: 'rumbling_v8_chatter',
    filterProfile: 'vinyl_warmth',
    hornType: 'classic_car_horn',
  },
  '1985': {
    themeTitle: 'Neon Grid Runners',
    genre: 'Synthwave & Post-Punk Electro',
    bpm: 120,
    synthProfile: 'synthwave_post_punk',
    ambienceProfile: 'bustling_city_hiss',
    filterProfile: 'cassette_tape_analog',
    hornType: 'electric_dual_tone',
  },
  '2005': {
    themeTitle: 'Millennium Digital Pulse',
    genre: 'Y2K Electronic Pop & Nu-Jazz',
    bpm: 128,
    synthProfile: 'y2k_electronic_pop',
    ambienceProfile: 'traffic_dense_sirens',
    filterProfile: 'cd_digital_clean',
    hornType: 'modern_beep',
  },
  '2025': {
    themeTitle: 'Solar City Future Sound',
    genre: 'Modern Ambient Lo-Fi & Hyper-Spatial Beats',
    bpm: 116,
    synthProfile: 'modern_ambient_lofi',
    ambienceProfile: 'quiet_ev_hum_breeze',
    filterProfile: 'lossless_spacious',
    hornType: 'gentle_ev_chime',
  },
};

/**
 * Filter configuration for era master lo-fi/hi-fi post processing.
 */
export interface EraFilterConfig {
  readonly profile: AudioEraSpec['filterProfile'];
  readonly lowCutHz: number;
  readonly highCutHz: number;
  readonly peakHz?: number;
  readonly peakGainDb?: number;
  readonly q: number;
}

export const ERA_FILTER_CONFIGS: Record<AudioEraSpec['filterProfile'], EraFilterConfig> = {
  am_radio_lofi: {
    profile: 'am_radio_lofi',
    lowCutHz: 380,
    highCutHz: 3400,
    peakHz: 1600,
    peakGainDb: 4,
    q: 1.2,
  },
  vinyl_warmth: {
    profile: 'vinyl_warmth',
    lowCutHz: 55,
    highCutHz: 7500,
    peakHz: 250,
    peakGainDb: 2.5,
    q: 0.7,
  },
  cassette_tape_analog: {
    profile: 'cassette_tape_analog',
    lowCutHz: 40,
    highCutHz: 10500,
    peakHz: 3200,
    peakGainDb: 1.5,
    q: 0.8,
  },
  cd_digital_clean: {
    profile: 'cd_digital_clean',
    lowCutHz: 25,
    highCutHz: 18000,
    peakHz: 4500,
    peakGainDb: 0,
    q: 0.7,
  },
  lossless_spacious: {
    profile: 'lossless_spacious',
    lowCutHz: 20,
    highCutHz: 20000,
    peakHz: 8000,
    peakGainDb: 1.0,
    q: 0.5,
  },
};

/**
 * Ambience layer specification for an era soundscape.
 */
export interface AmbienceLayerSpec {
  readonly name: string;
  readonly type: 'noise' | 'texture' | 'procedural_events' | 'drone';
  readonly baseVolume: number;
  readonly noiseType?: 'white' | 'pink' | 'brown';
  readonly filterType?: BiquadFilterType;
  readonly filterFreq?: number;
  readonly filterQ?: number;
  readonly modulationHz?: number;
  readonly description: string;
}

/**
 * Procedural music loop pattern definition.
 */
export interface NoteEvent {
  /** Beat offset within the measure (0-indexed, in quarter notes). */
  readonly beat: number;
  /** Duration in quarter notes. */
  readonly duration: number;
  /** MIDI note number or frequency in Hz. */
  readonly pitch: number;
  /** Velocity / relative gain (0.0 to 1.0). */
  readonly velocity: number;
}

export interface MusicTrackSpec {
  readonly name: string;
  readonly instrument: 'bass' | 'chords' | 'lead' | 'drums' | 'texture';
  readonly waveform: OscillatorType;
  readonly attack: number;
  readonly decay: number;
  readonly sustain: number;
  readonly release: number;
  readonly filterCutoff?: number;
  readonly notes: readonly NoteEvent[];
}

export interface EraSoundscapePreset {
  readonly eraId: EraId;
  readonly spec: AudioEraSpec;
  readonly loopLengthBeats: number;
  readonly filter: EraFilterConfig;
  readonly musicTracks: readonly MusicTrackSpec[];
  readonly ambienceLayers: readonly AmbienceLayerSpec[];
}

/**
 * Complete procedural era soundscape definitions.
 */
export const ERA_SOUNDSCAPES: Record<EraId, EraSoundscapePreset> = {
  '1945': {
    eraId: '1945',
    spec: audioEraData['1945'],
    loopLengthBeats: 16, // 4 bars of 4/4 swing
    filter: ERA_FILTER_CONFIGS.am_radio_lofi,
    musicTracks: [
      // 1945: Swing walking bass (F - A - Bb - B - C - D - Eb - E)
      {
        name: 'swing_walking_bass',
        instrument: 'bass',
        waveform: 'triangle',
        attack: 0.02,
        decay: 0.15,
        sustain: 0.7,
        release: 0.08,
        filterCutoff: 400,
        notes: [
          { beat: 0, duration: 0.8, pitch: 41, velocity: 0.8 },   // F1
          { beat: 1, duration: 0.8, pitch: 45, velocity: 0.75 },  // A1
          { beat: 2, duration: 0.8, pitch: 46, velocity: 0.8 },   // Bb1
          { beat: 3, duration: 0.8, pitch: 47, velocity: 0.75 },  // B1
          { beat: 4, duration: 0.8, pitch: 48, velocity: 0.8 },   // C2
          { beat: 5, duration: 0.8, pitch: 50, velocity: 0.75 },  // D2
          { beat: 6, duration: 0.8, pitch: 51, velocity: 0.8 },   // Eb2
          { beat: 7, duration: 0.8, pitch: 52, velocity: 0.75 },  // E2
          { beat: 8, duration: 0.8, pitch: 41, velocity: 0.8 },   // F1
          { beat: 9, duration: 0.8, pitch: 45, velocity: 0.75 },  // A1
          { beat: 10, duration: 0.8, pitch: 46, velocity: 0.8 },  // Bb1
          { beat: 11, duration: 0.8, pitch: 48, velocity: 0.75 }, // C2
          { beat: 12, duration: 0.8, pitch: 53, velocity: 0.8 },  // F2
          { beat: 13, duration: 0.8, pitch: 50, velocity: 0.75 }, // D2
          { beat: 14, duration: 0.8, pitch: 48, velocity: 0.8 },  // C2
          { beat: 15, duration: 0.8, pitch: 46, velocity: 0.75 }, // Bb1
        ],
      },
      // 1945: Big band brass chord stabs on offbeats
      {
        name: 'brass_stabs',
        instrument: 'chords',
        waveform: 'sawtooth',
        attack: 0.03,
        decay: 0.2,
        sustain: 0.4,
        release: 0.12,
        filterCutoff: 1800,
        notes: [
          // F6 chord stabs on upbeat & beat 2/4
          { beat: 1.5, duration: 0.35, pitch: 65, velocity: 0.65 }, // F4
          { beat: 1.5, duration: 0.35, pitch: 69, velocity: 0.6 },  // A4
          { beat: 1.5, duration: 0.35, pitch: 72, velocity: 0.6 },  // C5
          { beat: 1.5, duration: 0.35, pitch: 74, velocity: 0.55 }, // D5

          { beat: 3.5, duration: 0.35, pitch: 65, velocity: 0.65 },
          { beat: 3.5, duration: 0.35, pitch: 69, velocity: 0.6 },
          { beat: 3.5, duration: 0.35, pitch: 72, velocity: 0.6 },

          { beat: 5.5, duration: 0.35, pitch: 63, velocity: 0.65 }, // Eb4
          { beat: 5.5, duration: 0.35, pitch: 67, velocity: 0.6 },  // G4
          { beat: 5.5, duration: 0.35, pitch: 70, velocity: 0.6 },  // Bb4

          { beat: 7.5, duration: 0.35, pitch: 65, velocity: 0.7 },
          { beat: 7.5, duration: 0.35, pitch: 69, velocity: 0.65 },
          { beat: 7.5, duration: 0.35, pitch: 72, velocity: 0.65 },

          { beat: 9.5, duration: 0.35, pitch: 65, velocity: 0.65 },
          { beat: 11.5, duration: 0.35, pitch: 65, velocity: 0.65 },
          { beat: 13.5, duration: 0.35, pitch: 63, velocity: 0.65 },
          { beat: 15.0, duration: 0.5, pitch: 65, velocity: 0.75 },
        ],
      },
      // 1945: Swing hi-hat brush pattern (swing 8ths: 0, 0.66, 1.0, 1.66...)
      {
        name: 'swing_brush_hihat',
        instrument: 'drums',
        waveform: 'square',
        attack: 0.005,
        decay: 0.06,
        sustain: 0.0,
        release: 0.03,
        filterCutoff: 3000,
        notes: [
          { beat: 0, duration: 0.1, pitch: 84, velocity: 0.4 },
          { beat: 0.66, duration: 0.1, pitch: 84, velocity: 0.6 },
          { beat: 1.0, duration: 0.1, pitch: 84, velocity: 0.5 },
          { beat: 1.66, duration: 0.1, pitch: 84, velocity: 0.7 },
          { beat: 2.0, duration: 0.1, pitch: 84, velocity: 0.4 },
          { beat: 2.66, duration: 0.1, pitch: 84, velocity: 0.6 },
          { beat: 3.0, duration: 0.1, pitch: 84, velocity: 0.5 },
          { beat: 3.66, duration: 0.1, pitch: 84, velocity: 0.7 },
          { beat: 4.0, duration: 0.1, pitch: 84, velocity: 0.4 },
          { beat: 4.66, duration: 0.1, pitch: 84, velocity: 0.6 },
          { beat: 5.0, duration: 0.1, pitch: 84, velocity: 0.5 },
          { beat: 5.66, duration: 0.1, pitch: 84, velocity: 0.7 },
          { beat: 6.0, duration: 0.1, pitch: 84, velocity: 0.4 },
          { beat: 6.66, duration: 0.1, pitch: 84, velocity: 0.6 },
          { beat: 7.0, duration: 0.1, pitch: 84, velocity: 0.5 },
          { beat: 7.66, duration: 0.1, pitch: 84, velocity: 0.7 },
          { beat: 8.0, duration: 0.1, pitch: 84, velocity: 0.4 },
          { beat: 8.66, duration: 0.1, pitch: 84, velocity: 0.6 },
          { beat: 9.0, duration: 0.1, pitch: 84, velocity: 0.5 },
          { beat: 9.66, duration: 0.1, pitch: 84, velocity: 0.7 },
          { beat: 10.0, duration: 0.1, pitch: 84, velocity: 0.4 },
          { beat: 10.66, duration: 0.1, pitch: 84, velocity: 0.6 },
          { beat: 11.0, duration: 0.1, pitch: 84, velocity: 0.5 },
          { beat: 11.66, duration: 0.1, pitch: 84, velocity: 0.7 },
          { beat: 12.0, duration: 0.1, pitch: 84, velocity: 0.4 },
          { beat: 12.66, duration: 0.1, pitch: 84, velocity: 0.6 },
          { beat: 13.0, duration: 0.1, pitch: 84, velocity: 0.5 },
          { beat: 13.66, duration: 0.1, pitch: 84, velocity: 0.7 },
          { beat: 14.0, duration: 0.1, pitch: 84, velocity: 0.4 },
          { beat: 14.66, duration: 0.1, pitch: 84, velocity: 0.6 },
          { beat: 15.0, duration: 0.1, pitch: 84, velocity: 0.5 },
          { beat: 15.66, duration: 0.1, pitch: 84, velocity: 0.7 },
        ],
      },
    ],
    ambienceLayers: [
      {
        name: 'radio_chatter_texture',
        type: 'texture',
        baseVolume: 0.35,
        noiseType: 'pink',
        filterType: 'bandpass',
        filterFreq: 1200,
        filterQ: 3.0,
        modulationHz: 4.5,
        description: 'AM radio static and rhythmic vocal formant grain',
      },
      {
        name: 'sparse_traffic',
        type: 'noise',
        baseVolume: 0.4,
        noiseType: 'brown',
        filterType: 'lowpass',
        filterFreq: 220,
        filterQ: 0.8,
        modulationHz: 0.8,
        description: 'Sparse vintage fender engine chug and cobblestone rumble',
      },
    ],
  },

  '1965': {
    eraId: '1965',
    spec: audioEraData['1965'],
    loopLengthBeats: 16, // 4 bars at 124 BPM
    filter: ERA_FILTER_CONFIGS.vinyl_warmth,
    musicTracks: [
      // 1965: Twangy guitar mod rock riff (bright, punchy, pentatonic in E)
      {
        name: 'twangy_guitar_lead',
        instrument: 'lead',
        waveform: 'sawtooth',
        attack: 0.015,
        decay: 0.18,
        sustain: 0.3,
        release: 0.1,
        filterCutoff: 2800,
        notes: [
          { beat: 0, duration: 0.4, pitch: 64, velocity: 0.8 },    // E4
          { beat: 0.5, duration: 0.4, pitch: 64, velocity: 0.6 },  // E4
          { beat: 1.0, duration: 0.4, pitch: 67, velocity: 0.75 }, // G4
          { beat: 1.5, duration: 0.4, pitch: 69, velocity: 0.85 }, // A4
          { beat: 2.0, duration: 0.8, pitch: 71, velocity: 0.9 },  // B4
          { beat: 3.0, duration: 0.4, pitch: 69, velocity: 0.7 },  // A4
          { beat: 3.5, duration: 0.4, pitch: 67, velocity: 0.75 }, // G4
          { beat: 4.0, duration: 0.4, pitch: 64, velocity: 0.85 }, // E4
          { beat: 5.0, duration: 0.4, pitch: 62, velocity: 0.7 },  // D4
          { beat: 5.5, duration: 0.4, pitch: 64, velocity: 0.8 },  // E4
          { beat: 6.0, duration: 0.8, pitch: 67, velocity: 0.85 }, // G4
          { beat: 7.0, duration: 0.8, pitch: 64, velocity: 0.9 },  // E4
          { beat: 8.0, duration: 0.4, pitch: 64, velocity: 0.8 },  // E4
          { beat: 8.5, duration: 0.4, pitch: 67, velocity: 0.7 },  // G4
          { beat: 9.0, duration: 0.4, pitch: 69, velocity: 0.8 },  // A4
          { beat: 9.5, duration: 0.4, pitch: 71, velocity: 0.85 }, // B4
          { beat: 10.0, duration: 0.8, pitch: 74, velocity: 0.9 }, // D5
          { beat: 11.0, duration: 0.4, pitch: 71, velocity: 0.75 },// B4
          { beat: 11.5, duration: 0.4, pitch: 69, velocity: 0.7 }, // A4
          { beat: 12.0, duration: 0.8, pitch: 67, velocity: 0.8 }, // G4
          { beat: 13.0, duration: 0.8, pitch: 64, velocity: 0.85 },// E4
          { beat: 14.0, duration: 0.8, pitch: 62, velocity: 0.75 },// D4
          { beat: 15.0, duration: 0.8, pitch: 64, velocity: 0.95 },// E4
        ],
      },
      // 1965: Motown rhythm bass groove
      {
        name: 'motown_bass',
        instrument: 'bass',
        waveform: 'triangle',
        attack: 0.02,
        decay: 0.12,
        sustain: 0.6,
        release: 0.06,
        filterCutoff: 500,
        notes: [
          { beat: 0, duration: 0.6, pitch: 40, velocity: 0.85 },   // E1
          { beat: 1.0, duration: 0.3, pitch: 40, velocity: 0.7 },  // E1
          { beat: 1.5, duration: 0.3, pitch: 43, velocity: 0.75 }, // G1
          { beat: 2.0, duration: 0.6, pitch: 45, velocity: 0.85 }, // A1
          { beat: 3.0, duration: 0.6, pitch: 47, velocity: 0.8 },  // B1
          { beat: 4.0, duration: 0.6, pitch: 40, velocity: 0.85 }, // E1
          { beat: 5.0, duration: 0.3, pitch: 40, velocity: 0.7 },
          { beat: 5.5, duration: 0.3, pitch: 43, velocity: 0.75 },
          { beat: 6.0, duration: 0.6, pitch: 45, velocity: 0.85 },
          { beat: 7.0, duration: 0.6, pitch: 47, velocity: 0.8 },
          { beat: 8.0, duration: 0.6, pitch: 45, velocity: 0.85 }, // A1
          { beat: 9.0, duration: 0.3, pitch: 45, velocity: 0.7 },
          { beat: 9.5, duration: 0.3, pitch: 48, velocity: 0.75 }, // C2
          { beat: 10.0, duration: 0.6, pitch: 50, velocity: 0.85 },// D2
          { beat: 11.0, duration: 0.6, pitch: 47, velocity: 0.8 }, // B1
          { beat: 12.0, duration: 0.6, pitch: 40, velocity: 0.85 },// E1
          { beat: 13.0, duration: 0.3, pitch: 40, velocity: 0.7 },
          { beat: 14.0, duration: 0.6, pitch: 47, velocity: 0.85 },// B1
          { beat: 15.0, duration: 0.6, pitch: 40, velocity: 0.9 }, // E1
        ],
      },
    ],
    ambienceLayers: [
      {
        name: 'neon_buzz',
        type: 'texture',
        baseVolume: 0.3,
        noiseType: 'white',
        filterType: 'bandpass',
        filterFreq: 120, // 60Hz harmonic buzz
        filterQ: 8.0,
        modulationHz: 3.5,
        description: 'Vibrant neon tube electrical hum with flickering transformer pulse',
      },
      {
        name: 'v8_cruiser_rumble',
        type: 'noise',
        baseVolume: 0.45,
        noiseType: 'brown',
        filterType: 'lowpass',
        filterFreq: 320,
        filterQ: 1.0,
        modulationHz: 1.2,
        description: 'Mid-century V8 cruiser engines and tire roll',
      },
    ],
  },

  '1985': {
    eraId: '1985',
    spec: audioEraData['1985'],
    loopLengthBeats: 16, // 4 bars at 120 BPM
    filter: ERA_FILTER_CONFIGS.cassette_tape_analog,
    musicTracks: [
      // 1985: Synthwave rolling 16th-note bassline in A minor
      {
        name: 'synthwave_bassline',
        instrument: 'bass',
        waveform: 'sawtooth',
        attack: 0.01,
        decay: 0.09,
        sustain: 0.2,
        release: 0.05,
        filterCutoff: 1200,
        notes: [
          // Bar 1: A minor (Am)
          { beat: 0, duration: 0.2, pitch: 45, velocity: 0.85 },   // A1
          { beat: 0.25, duration: 0.2, pitch: 45, velocity: 0.6 },
          { beat: 0.5, duration: 0.2, pitch: 57, velocity: 0.75 },  // A2
          { beat: 0.75, duration: 0.2, pitch: 45, velocity: 0.6 },
          { beat: 1.0, duration: 0.2, pitch: 45, velocity: 0.8 },
          { beat: 1.25, duration: 0.2, pitch: 45, velocity: 0.6 },
          { beat: 1.5, duration: 0.2, pitch: 57, velocity: 0.75 },
          { beat: 1.75, duration: 0.2, pitch: 45, velocity: 0.6 },
          { beat: 2.0, duration: 0.2, pitch: 45, velocity: 0.85 },
          { beat: 2.25, duration: 0.2, pitch: 45, velocity: 0.6 },
          { beat: 2.5, duration: 0.2, pitch: 57, velocity: 0.75 },
          { beat: 2.75, duration: 0.2, pitch: 45, velocity: 0.6 },
          { beat: 3.0, duration: 0.2, pitch: 48, velocity: 0.8 },   // C2
          { beat: 3.25, duration: 0.2, pitch: 48, velocity: 0.6 },
          { beat: 3.5, duration: 0.2, pitch: 50, velocity: 0.75 },  // D2
          { beat: 3.75, duration: 0.2, pitch: 52, velocity: 0.6 },  // E2

          // Bar 2: F major (F)
          { beat: 4.0, duration: 0.2, pitch: 41, velocity: 0.85 },  // F1
          { beat: 4.25, duration: 0.2, pitch: 41, velocity: 0.6 },
          { beat: 4.5, duration: 0.2, pitch: 53, velocity: 0.75 },  // F2
          { beat: 4.75, duration: 0.2, pitch: 41, velocity: 0.6 },
          { beat: 5.0, duration: 0.2, pitch: 41, velocity: 0.8 },
          { beat: 5.25, duration: 0.2, pitch: 41, velocity: 0.6 },
          { beat: 5.5, duration: 0.2, pitch: 53, velocity: 0.75 },
          { beat: 5.75, duration: 0.2, pitch: 41, velocity: 0.6 },
          { beat: 6.0, duration: 0.2, pitch: 41, velocity: 0.85 },
          { beat: 6.25, duration: 0.2, pitch: 41, velocity: 0.6 },
          { beat: 6.5, duration: 0.2, pitch: 53, velocity: 0.75 },
          { beat: 6.75, duration: 0.2, pitch: 41, velocity: 0.6 },
          { beat: 7.0, duration: 0.2, pitch: 43, velocity: 0.8 },   // G1
          { beat: 7.25, duration: 0.2, pitch: 43, velocity: 0.6 },
          { beat: 7.5, duration: 0.2, pitch: 47, velocity: 0.75 },  // B1
          { beat: 7.75, duration: 0.2, pitch: 48, velocity: 0.6 },  // C2

          // Bar 3: G major (G)
          { beat: 8.0, duration: 0.2, pitch: 43, velocity: 0.85 },  // G1
          { beat: 8.25, duration: 0.2, pitch: 43, velocity: 0.6 },
          { beat: 8.5, duration: 0.2, pitch: 55, velocity: 0.75 },  // G2
          { beat: 8.75, duration: 0.2, pitch: 43, velocity: 0.6 },
          { beat: 9.0, duration: 0.2, pitch: 43, velocity: 0.8 },
          { beat: 9.25, duration: 0.2, pitch: 43, velocity: 0.6 },
          { beat: 9.5, duration: 0.2, pitch: 55, velocity: 0.75 },
          { beat: 9.75, duration: 0.2, pitch: 43, velocity: 0.6 },
          { beat: 10.0, duration: 0.2, pitch: 43, velocity: 0.85 },
          { beat: 10.25, duration: 0.2, pitch: 43, velocity: 0.6 },
          { beat: 10.5, duration: 0.2, pitch: 55, velocity: 0.75 },
          { beat: 10.75, duration: 0.2, pitch: 43, velocity: 0.6 },
          { beat: 11.0, duration: 0.2, pitch: 45, velocity: 0.8 },  // A1
          { beat: 11.25, duration: 0.2, pitch: 47, velocity: 0.6 }, // B1
          { beat: 11.5, duration: 0.2, pitch: 48, velocity: 0.75 }, // C2
          { beat: 11.75, duration: 0.2, pitch: 50, velocity: 0.6 }, // D2

          // Bar 4: E minor (Em)
          { beat: 12.0, duration: 0.2, pitch: 40, velocity: 0.85 }, // E1
          { beat: 12.25, duration: 0.2, pitch: 40, velocity: 0.6 },
          { beat: 12.5, duration: 0.2, pitch: 52, velocity: 0.75 }, // E2
          { beat: 12.75, duration: 0.2, pitch: 40, velocity: 0.6 },
          { beat: 13.0, duration: 0.2, pitch: 40, velocity: 0.8 },
          { beat: 13.25, duration: 0.2, pitch: 40, velocity: 0.6 },
          { beat: 13.5, duration: 0.2, pitch: 52, velocity: 0.75 },
          { beat: 13.75, duration: 0.2, pitch: 40, velocity: 0.6 },
          { beat: 14.0, duration: 0.2, pitch: 47, velocity: 0.85 }, // B1
          { beat: 14.25, duration: 0.2, pitch: 47, velocity: 0.6 },
          { beat: 14.5, duration: 0.2, pitch: 50, velocity: 0.75 }, // D2
          { beat: 14.75, duration: 0.2, pitch: 52, velocity: 0.6 }, // E2
          { beat: 15.0, duration: 0.2, pitch: 55, velocity: 0.85 }, // G2
          { beat: 15.25, duration: 0.2, pitch: 57, velocity: 0.8 }, // A2
          { beat: 15.5, duration: 0.2, pitch: 59, velocity: 0.85 }, // B2
          { beat: 15.75, duration: 0.2, pitch: 60, velocity: 0.9 },  // C3
        ],
      },
      // 1985: Synth lead melody (square wave with chorus feel)
      {
        name: 'synth_lead',
        instrument: 'lead',
        waveform: 'square',
        attack: 0.02,
        decay: 0.15,
        sustain: 0.5,
        release: 0.12,
        filterCutoff: 3200,
        notes: [
          { beat: 0.5, duration: 0.8, pitch: 69, velocity: 0.8 },   // A4
          { beat: 1.5, duration: 0.8, pitch: 72, velocity: 0.85 },  // C5
          { beat: 2.5, duration: 1.2, pitch: 76, velocity: 0.9 },   // E5
          { beat: 4.5, duration: 0.8, pitch: 77, velocity: 0.85 },  // F5
          { beat: 5.5, duration: 0.8, pitch: 76, velocity: 0.8 },   // E5
          { beat: 6.5, duration: 1.2, pitch: 72, velocity: 0.85 },  // C5
          { beat: 8.5, duration: 0.8, pitch: 74, velocity: 0.85 },  // D5
          { beat: 9.5, duration: 0.8, pitch: 76, velocity: 0.8 },   // E5
          { beat: 10.5, duration: 1.2, pitch: 71, velocity: 0.85 }, // B4
          { beat: 12.5, duration: 0.8, pitch: 69, velocity: 0.85 }, // A4
          { beat: 13.5, duration: 0.8, pitch: 71, velocity: 0.8 },  // B4
          { beat: 14.5, duration: 1.2, pitch: 69, velocity: 0.9 },  // A4
        ],
      },
    ],
    ambienceLayers: [
      {
        name: 'arcade_blips',
        type: 'procedural_events',
        baseVolume: 0.35,
        noiseType: 'white',
        filterType: 'bandpass',
        filterFreq: 2400,
        filterQ: 5.0,
        modulationHz: 6.0,
        description: 'Random 8-bit FM arcade bleeps, synth beeps and video game chatter',
      },
      {
        name: 'eighties_city_hiss',
        type: 'noise',
        baseVolume: 0.4,
        noiseType: 'pink',
        filterType: 'bandpass',
        filterFreq: 850,
        filterQ: 1.5,
        modulationHz: 2.0,
        description: 'Dense 80s urban traffic rumble, air brakes and crosswalk beepers',
      },
    ],
  },

  '2005': {
    eraId: '2005',
    spec: audioEraData['2005'],
    loopLengthBeats: 16, // 4 bars at 128 BPM
    filter: ERA_FILTER_CONFIGS.cd_digital_clean,
    musicTracks: [
      // 2005: Lush pop supersaw / sine pads (C - G - Am - F)
      {
        name: 'y2k_pop_pads',
        instrument: 'chords',
        waveform: 'sawtooth',
        attack: 0.08,
        decay: 0.25,
        sustain: 0.75,
        release: 0.25,
        filterCutoff: 2400,
        notes: [
          // Bar 1: C major (C4 - E4 - G4)
          { beat: 0, duration: 3.8, pitch: 60, velocity: 0.7 },
          { beat: 0, duration: 3.8, pitch: 64, velocity: 0.65 },
          { beat: 0, duration: 3.8, pitch: 67, velocity: 0.65 },

          // Bar 2: G major (B3 - D4 - G4)
          { beat: 4.0, duration: 3.8, pitch: 59, velocity: 0.7 },
          { beat: 4.0, duration: 3.8, pitch: 62, velocity: 0.65 },
          { beat: 4.0, duration: 3.8, pitch: 67, velocity: 0.65 },

          // Bar 3: A minor (A3 - C4 - E4)
          { beat: 8.0, duration: 3.8, pitch: 57, velocity: 0.7 },
          { beat: 8.0, duration: 3.8, pitch: 60, velocity: 0.65 },
          { beat: 8.0, duration: 3.8, pitch: 64, velocity: 0.65 },

          // Bar 4: F major (F3 - A3 - C4)
          { beat: 12.0, duration: 3.8, pitch: 53, velocity: 0.75 },
          { beat: 12.0, duration: 3.8, pitch: 57, velocity: 0.7 },
          { beat: 12.0, duration: 3.8, pitch: 60, velocity: 0.7 },
        ],
      },
      // 2005: Fast 4-on-the-floor electro pop bassline
      {
        name: 'pop_electro_bass',
        instrument: 'bass',
        waveform: 'square',
        attack: 0.01,
        decay: 0.12,
        sustain: 0.4,
        release: 0.05,
        filterCutoff: 900,
        notes: [
          { beat: 0, duration: 0.4, pitch: 36, velocity: 0.9 },   // C1
          { beat: 0.5, duration: 0.3, pitch: 48, velocity: 0.7 }, // C2
          { beat: 1.0, duration: 0.4, pitch: 36, velocity: 0.85 },
          { beat: 1.5, duration: 0.3, pitch: 48, velocity: 0.7 },
          { beat: 2.0, duration: 0.4, pitch: 36, velocity: 0.9 },
          { beat: 2.5, duration: 0.3, pitch: 48, velocity: 0.7 },
          { beat: 3.0, duration: 0.4, pitch: 36, velocity: 0.85 },
          { beat: 3.5, duration: 0.3, pitch: 48, velocity: 0.75 },

          { beat: 4.0, duration: 0.4, pitch: 35, velocity: 0.9 }, // B0
          { beat: 4.5, duration: 0.3, pitch: 47, velocity: 0.7 },
          { beat: 5.0, duration: 0.4, pitch: 35, velocity: 0.85 },
          { beat: 5.5, duration: 0.3, pitch: 47, velocity: 0.7 },
          { beat: 6.0, duration: 0.4, pitch: 35, velocity: 0.9 },
          { beat: 6.5, duration: 0.3, pitch: 47, velocity: 0.7 },
          { beat: 7.0, duration: 0.4, pitch: 35, velocity: 0.85 },
          { beat: 7.5, duration: 0.3, pitch: 47, velocity: 0.75 },

          { beat: 8.0, duration: 0.4, pitch: 33, velocity: 0.9 }, // A0
          { beat: 8.5, duration: 0.3, pitch: 45, velocity: 0.7 },
          { beat: 9.0, duration: 0.4, pitch: 33, velocity: 0.85 },
          { beat: 9.5, duration: 0.3, pitch: 45, velocity: 0.7 },
          { beat: 10.0, duration: 0.4, pitch: 33, velocity: 0.9 },
          { beat: 10.5, duration: 0.3, pitch: 45, velocity: 0.7 },
          { beat: 11.0, duration: 0.4, pitch: 33, velocity: 0.85 },
          { beat: 11.5, duration: 0.3, pitch: 45, velocity: 0.75 },

          { beat: 12.0, duration: 0.4, pitch: 29, velocity: 0.9 }, // F0
          { beat: 12.5, duration: 0.3, pitch: 41, velocity: 0.7 },
          { beat: 13.0, duration: 0.4, pitch: 29, velocity: 0.85 },
          { beat: 13.5, duration: 0.3, pitch: 41, velocity: 0.7 },
          { beat: 14.0, duration: 0.4, pitch: 29, velocity: 0.9 },
          { beat: 14.5, duration: 0.3, pitch: 41, velocity: 0.7 },
          { beat: 15.0, duration: 0.4, pitch: 31, velocity: 0.85 },// G0
          { beat: 15.5, duration: 0.3, pitch: 35, velocity: 0.8 }, // B0
        ],
      },
    ],
    ambienceLayers: [
      {
        name: 'busy_traffic_hum',
        type: 'noise',
        baseVolume: 0.5,
        noiseType: 'pink',
        filterType: 'bandpass',
        filterFreq: 450,
        filterQ: 0.9,
        modulationHz: 0.4,
        description: 'Busy 2000s metropolitan multi-lane traffic roar and tire friction',
      },
      {
        name: 'distance_city_pulse',
        type: 'drone',
        baseVolume: 0.3,
        noiseType: 'brown',
        filterType: 'lowpass',
        filterFreq: 180,
        filterQ: 1.2,
        modulationHz: 0.2,
        description: 'Continuous HVAC and subways low-frequency city pulse',
      },
    ],
  },

  '2025': {
    eraId: '2025',
    spec: audioEraData['2025'],
    loopLengthBeats: 16, // 4 bars at 116 BPM
    filter: ERA_FILTER_CONFIGS.lossless_spacious,
    musicTracks: [
      // 2025: Ambient electronic spatial chords (Dmaj9 - Bm9 - Gmaj7#11 - Asus4)
      {
        name: 'ambient_future_pads',
        instrument: 'chords',
        waveform: 'sine',
        attack: 0.2,
        decay: 0.5,
        sustain: 0.85,
        release: 0.4,
        filterCutoff: 4000,
        notes: [
          // Dmaj9 (D3, F#3, A3, C#4, E4)
          { beat: 0, duration: 3.9, pitch: 50, velocity: 0.6 },
          { beat: 0, duration: 3.9, pitch: 54, velocity: 0.55 },
          { beat: 0, duration: 3.9, pitch: 57, velocity: 0.55 },
          { beat: 0, duration: 3.9, pitch: 61, velocity: 0.5 },
          { beat: 0, duration: 3.9, pitch: 64, velocity: 0.5 },

          // Bm9 (B2, D3, F#3, A3, C#4)
          { beat: 4.0, duration: 3.9, pitch: 47, velocity: 0.6 },
          { beat: 4.0, duration: 3.9, pitch: 50, velocity: 0.55 },
          { beat: 4.0, duration: 3.9, pitch: 54, velocity: 0.55 },
          { beat: 4.0, duration: 3.9, pitch: 57, velocity: 0.5 },
          { beat: 4.0, duration: 3.9, pitch: 61, velocity: 0.5 },

          // Gmaj7 (G2, B2, D3, F#3)
          { beat: 8.0, duration: 3.9, pitch: 43, velocity: 0.6 },
          { beat: 8.0, duration: 3.9, pitch: 47, velocity: 0.55 },
          { beat: 8.0, duration: 3.9, pitch: 50, velocity: 0.55 },
          { beat: 8.0, duration: 3.9, pitch: 54, velocity: 0.5 },

          // Asus4 (A2, D3, E3, A3)
          { beat: 12.0, duration: 3.9, pitch: 45, velocity: 0.6 },
          { beat: 12.0, duration: 3.9, pitch: 50, velocity: 0.55 },
          { beat: 12.0, duration: 3.9, pitch: 52, velocity: 0.55 },
          { beat: 12.0, duration: 3.9, pitch: 57, velocity: 0.5 },
        ],
      },
      // 2025: Sub-bass warm drone pulses
      {
        name: 'future_sub_bass',
        instrument: 'bass',
        waveform: 'sine',
        attack: 0.1,
        decay: 0.3,
        sustain: 0.8,
        release: 0.3,
        filterCutoff: 180,
        notes: [
          { beat: 0, duration: 3.6, pitch: 38, velocity: 0.8 },   // D1
          { beat: 4.0, duration: 3.6, pitch: 35, velocity: 0.8 }, // B0
          { beat: 8.0, duration: 3.6, pitch: 31, velocity: 0.8 }, // G0
          { beat: 12.0, duration: 3.6, pitch: 33, velocity: 0.8 },// A0
        ],
      },
      // 2025: Spatial generative chime blips
      {
        name: 'spatial_chimes',
        instrument: 'lead',
        waveform: 'triangle',
        attack: 0.02,
        decay: 0.3,
        sustain: 0.1,
        release: 0.3,
        filterCutoff: 5500,
        notes: [
          { beat: 1.5, duration: 0.5, pitch: 73, velocity: 0.5 }, // C#5
          { beat: 3.0, duration: 0.5, pitch: 76, velocity: 0.55 },// E5
          { beat: 5.5, duration: 0.5, pitch: 81, velocity: 0.5 }, // A5
          { beat: 7.0, duration: 0.5, pitch: 78, velocity: 0.55 },// F#5
          { beat: 9.5, duration: 0.5, pitch: 74, velocity: 0.5 }, // D5
          { beat: 11.0, duration: 0.5, pitch: 78, velocity: 0.55 },// F#5
          { beat: 13.5, duration: 0.5, pitch: 81, velocity: 0.6 },// A5
          { beat: 15.0, duration: 0.5, pitch: 85, velocity: 0.65 },// C#6
        ],
      },
    ],
    ambienceLayers: [
      {
        name: 'quiet_ev_whirs',
        type: 'texture',
        baseVolume: 0.3,
        noiseType: 'pink',
        filterType: 'bandpass',
        filterFreq: 520,
        filterQ: 4.0,
        modulationHz: 0.3,
        description: 'Smooth magnetic levitation / electric vehicle whirs and aero glides',
      },
      {
        name: 'birds_and_breeze',
        type: 'procedural_events',
        baseVolume: 0.35,
        noiseType: 'white',
        filterType: 'highpass',
        filterFreq: 2200,
        filterQ: 1.0,
        modulationHz: 0.15,
        description: 'Lush rooftop garden bird chirps and clean breeze',
      },
    ],
  },
};
