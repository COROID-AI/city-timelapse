/**
 * Audio Engine Unit Tests.
 *
 * Verifies graph construction, era layer data completeness, mute/volume APIs,
 * gesture-gated resume with a fake AudioContext, and procedural synthesis triggers.
 */

import { describe, expect, it } from 'vitest';
import { audioEraData, ERA_FILTER_CONFIGS, ERA_SOUNDSCAPES } from '../audioEraData';
import { createAudioEngine, createFakeAudioContext } from '../audioEngine';
import { createNoiseBuffer, midiToFreq } from '../synth';

describe('audioEraData completeness', () => {
  const expectedEras = ['1945', '1965', '1985', '2005', '2025'] as const;

  it('contains audio specs for all five eras', () => {
    for (const era of expectedEras) {
      const spec = audioEraData[era];
      expect(spec).toBeDefined();
      expect(spec.themeTitle).toBeTypeOf('string');
      expect(spec.genre).toBeTypeOf('string');
      expect(spec.bpm).toBeGreaterThan(0);
      expect(spec.synthProfile).toBeTypeOf('string');
      expect(spec.ambienceProfile).toBeTypeOf('string');
      expect(spec.filterProfile).toBeTypeOf('string');
      expect(spec.hornType).toBeTypeOf('string');
    }
  });

  it('has distinct era soundscapes with music tracks and ambience layers', () => {
    for (const era of expectedEras) {
      const soundscape = ERA_SOUNDSCAPES[era];
      expect(soundscape).toBeDefined();
      expect(soundscape.eraId).toBe(era);
      expect(soundscape.musicTracks.length).toBeGreaterThan(0);
      expect(soundscape.ambienceLayers.length).toBeGreaterThan(0);

      // Verify music tracks have valid notes
      for (const track of soundscape.musicTracks) {
        expect(track.notes.length).toBeGreaterThan(0);
        for (const note of track.notes) {
          expect(note.pitch).toBeGreaterThan(0);
          expect(note.duration).toBeGreaterThan(0);
          expect(note.velocity).toBeGreaterThan(0);
        }
      }
    }
  });

  it('has valid filter configurations for all profiles', () => {
    const profiles = ['am_radio_lofi', 'vinyl_warmth', 'cassette_tape_analog', 'cd_digital_clean', 'lossless_spacious'] as const;
    for (const profile of profiles) {
      const filter = ERA_FILTER_CONFIGS[profile];
      expect(filter).toBeDefined();
      expect(filter.lowCutHz).toBeGreaterThan(0);
      expect(filter.highCutHz).toBeGreaterThan(filter.lowCutHz);
      expect(filter.q).toBeGreaterThan(0);
    }
  });

  it('verifies 1945 swing loop and radio chatter specifications', () => {
    const spec = audioEraData['1945'];
    expect(spec.synthProfile).toBe('big_band_swing');
    expect(spec.ambienceProfile).toBe('clattering_trams_horns');
    expect(spec.filterProfile).toBe('am_radio_lofi');
    expect(spec.hornType).toBe('vintage_klaxon');

    const s1945 = ERA_SOUNDSCAPES['1945'];
    const trackNames = s1945.musicTracks.map((t) => t.name);
    expect(trackNames).toContain('swing_walking_bass');
    expect(trackNames).toContain('brass_stabs');
    expect(trackNames).toContain('swing_brush_hihat');

    const ambienceNames = s1945.ambienceLayers.map((a) => a.name);
    expect(ambienceNames).toContain('radio_chatter_texture');
    expect(ambienceNames).toContain('sparse_traffic');
  });

  it('verifies 1965 twangy guitar and neon buzz specifications', () => {
    const spec = audioEraData['1965'];
    expect(spec.synthProfile).toBe('motown_mod_rock');
    expect(spec.filterProfile).toBe('vinyl_warmth');
    expect(spec.hornType).toBe('classic_car_horn');

    const s1965 = ERA_SOUNDSCAPES['1965'];
    const trackNames = s1965.musicTracks.map((t) => t.name);
    expect(trackNames).toContain('twangy_guitar_lead');
    expect(trackNames).toContain('motown_bass');

    const ambienceNames = s1965.ambienceLayers.map((a) => a.name);
    expect(ambienceNames).toContain('neon_buzz');
  });

  it('verifies 1985 synthwave and arcade blips specifications', () => {
    const spec = audioEraData['1985'];
    expect(spec.synthProfile).toBe('synthwave_post_punk');
    expect(spec.filterProfile).toBe('cassette_tape_analog');
    expect(spec.hornType).toBe('electric_dual_tone');

    const s1985 = ERA_SOUNDSCAPES['1985'];
    const trackNames = s1985.musicTracks.map((t) => t.name);
    expect(trackNames).toContain('synthwave_bassline');
    expect(trackNames).toContain('synth_lead');

    const ambienceNames = s1985.ambienceLayers.map((a) => a.name);
    expect(ambienceNames).toContain('arcade_blips');
  });

  it('verifies 2005 pop pads and busy traffic specifications', () => {
    const spec = audioEraData['2005'];
    expect(spec.synthProfile).toBe('y2k_electronic_pop');
    expect(spec.filterProfile).toBe('cd_digital_clean');
    expect(spec.hornType).toBe('modern_beep');

    const s2005 = ERA_SOUNDSCAPES['2005'];
    const trackNames = s2005.musicTracks.map((t) => t.name);
    expect(trackNames).toContain('y2k_pop_pads');
    expect(trackNames).toContain('pop_electro_bass');

    const ambienceNames = s2005.ambienceLayers.map((a) => a.name);
    expect(ambienceNames).toContain('busy_traffic_hum');
  });

  it('verifies 2025 ambient electronic, quiet EV whir, and birds specifications', () => {
    const spec = audioEraData['2025'];
    expect(spec.synthProfile).toBe('modern_ambient_lofi');
    expect(spec.filterProfile).toBe('lossless_spacious');
    expect(spec.hornType).toBe('gentle_ev_chime');

    const s2025 = ERA_SOUNDSCAPES['2025'];
    const trackNames = s2025.musicTracks.map((t) => t.name);
    expect(trackNames).toContain('ambient_future_pads');
    expect(trackNames).toContain('future_sub_bass');

    const ambienceNames = s2025.ambienceLayers.map((a) => a.name);
    expect(ambienceNames).toContain('quiet_ev_whirs');
    expect(ambienceNames).toContain('birds_and_breeze');
  });
});

describe('Synthesis utilities', () => {
  it('converts MIDI note numbers to frequencies correctly', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 2); // A4
    expect(midiToFreq(60)).toBeCloseTo(261.63, 2); // C4
    expect(midiToFreq(57)).toBeCloseTo(220, 2); // A3
    expect(midiToFreq(81)).toBeCloseTo(880, 2); // A5
  });

  it('creates procedural noise buffers for white, pink, and brown noise', () => {
    const fakeCtx = createFakeAudioContext();
    const whiteBuf = createNoiseBuffer(fakeCtx, 'white', 0.5);
    const pinkBuf = createNoiseBuffer(fakeCtx, 'pink', 0.5);
    const brownBuf = createNoiseBuffer(fakeCtx, 'brown', 0.5);

    expect(whiteBuf.length).toBeGreaterThan(0);
    expect(pinkBuf.length).toBeGreaterThan(0);
    expect(brownBuf.length).toBeGreaterThan(0);

    const whiteData = whiteBuf.getChannelData(0);
    const pinkData = pinkBuf.getChannelData(0);
    const brownData = brownBuf.getChannelData(0);

    expect(whiteData.length).toBe(whiteBuf.length);
    expect(pinkData.length).toBe(pinkBuf.length);
    expect(brownData.length).toBe(brownBuf.length);
  });
});

describe('AudioEngine', () => {
  it('instantiates cleanly with fake context and starts suspended', () => {
    const fakeCtx = createFakeAudioContext();
    const engine = createAudioEngine({
      contextFactory: () => fakeCtx,
      masterVolume: 0.75,
      ambienceVolume: 0.8,
      musicVolume: 0.6,
      sfxVolume: 0.9,
    });

    expect(engine.isSuspended()).toBe(true);
    expect(engine.getVolume()).toBe(0.75);
    expect(engine.getBusVolume('ambience')).toBe(0.8);
    expect(engine.getBusVolume('music')).toBe(0.6);
    expect(engine.getBusVolume('sfx')).toBe(0.9);
    expect(engine.isMuted()).toBe(false);

    engine.dispose();
  });

  it('resumes on user gesture via resume() API', async () => {
    const fakeCtx = createFakeAudioContext();
    const engine = createAudioEngine({
      contextFactory: () => fakeCtx,
    });

    expect(engine.isSuspended()).toBe(true);
    await engine.resume();
    expect(engine.isSuspended()).toBe(false);
    expect(fakeCtx.state).toBe('running');

    engine.dispose();
  });

  it('resumes on DOM event when autoResumeOnGesture is enabled', async () => {
    const fakeCtx = createFakeAudioContext();
    const engine = createAudioEngine({
      contextFactory: () => fakeCtx,
      autoResumeOnGesture: true,
    });

    expect(engine.isSuspended()).toBe(true);

    // Simulate click event
    window.dispatchEvent(new Event('click'));
    // Wait for microtask resolution
    await Promise.resolve();

    expect(engine.isSuspended()).toBe(false);
    expect(fakeCtx.state).toBe('running');

    engine.dispose();
  });

  it('manages mute and volume HUD APIs correctly', () => {
    const fakeCtx = createFakeAudioContext();
    const engine = createAudioEngine({
      contextFactory: () => fakeCtx,
    });

    expect(engine.isMuted()).toBe(false);
    engine.setMuted(true);
    expect(engine.isMuted()).toBe(true);

    engine.setVolume(0.5);
    expect(engine.getVolume()).toBe(0.5);

    // Bus volume controls
    engine.setBusVolume('ambience', 0.4);
    expect(engine.getBusVolume('ambience')).toBe(0.4);

    engine.setBusVolume('music', 0.35);
    expect(engine.getBusVolume('music')).toBe(0.35);

    engine.setBusVolume('sfx', 0.95);
    expect(engine.getBusVolume('sfx')).toBe(0.95);

    engine.setMuted(false);
    expect(engine.isMuted()).toBe(false);

    engine.dispose();
  });

  it('calculates era weights and crossfades during update()', () => {
    const fakeCtx = createFakeAudioContext();
    const engine = createAudioEngine({
      contextFactory: () => fakeCtx,
    });

    engine.attach();

    // Initial static state: 1945
    engine.update({ fromEra: '1945', toEra: '1945', t: 0 }, 0.016);
    let weights = engine.getEraWeights();
    expect(weights['1945']).toBe(1.0);
    expect(weights['1965']).toBe(0.0);

    // Midpoint crossfade: 1945 -> 1965 at t = 0.5
    engine.update({ fromEra: '1945', toEra: '1965', t: 0.5 }, 0.016);
    weights = engine.getEraWeights();
    expect(weights['1945']).toBeCloseTo(0.5, 3);
    expect(weights['1965']).toBeCloseTo(0.5, 3);
    expect(weights['1985']).toBe(0);

    // Completed transition to 1985
    engine.update({ fromEra: '1985', toEra: '1985', t: 0 }, 0.016);
    weights = engine.getEraWeights();
    expect(weights['1985']).toBe(1.0);
    expect(weights['1945']).toBe(0);

    engine.dispose();
  });

  it('triggers procedural SFX methods without throwing', () => {
    const fakeCtx = createFakeAudioContext();
    const engine = createAudioEngine({
      contextFactory: () => fakeCtx,
    });

    expect(() => {
      engine.triggerWhoosh(1.0);
      engine.triggerCarPassBy({ direction: 'left-to-right', speed: 1.2 });
      engine.triggerCarPassBy({ direction: 'right-to-left', speed: 0.8 });
      engine.triggerHorn('vintage_klaxon');
      engine.triggerHorn('classic_car_horn');
      engine.triggerHorn('electric_dual_tone');
      engine.triggerHorn('modern_beep');
      engine.triggerHorn('gentle_ev_chime');
    }).not.toThrow();

    engine.dispose();
  });

  it('disposes cleanly and idempotently', () => {
    const fakeCtx = createFakeAudioContext();
    const engine = createAudioEngine({
      contextFactory: () => fakeCtx,
    });

    expect(() => {
      engine.dispose();
      // Calling dispose again should be safe
      engine.dispose();
    }).not.toThrow();
  });

  it('handles default creation when no factory provided in test environment', () => {
    const engine = createAudioEngine();
    expect(engine).toBeDefined();
    expect(engine.getVolume()).toBeGreaterThan(0);
    engine.dispose();
  });
});
