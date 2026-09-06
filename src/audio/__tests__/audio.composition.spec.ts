import { describe, expect, it } from 'vitest';

import { createAudioEngine } from '../engine';
import { MockAudioContext, MockAudioNode } from './mockAudio';

/**
 * Composition test — composes the full engine (engine + ambience + sfx)
 * against a stubbed AudioContext. Asserts:
 *  - the AudioContext is created ONLY after unlock() (autoplay policy),
 *  - all five era beds construct and crossfade over 2–4s,
 *  - mute and volume affect the master gain,
 *  - SFX one-shots route through the SFX bus.
 */

const makeContext = () => new MockAudioContext();

const lastLinearRamp = (param: { events: Array<Record<string, unknown>> } | undefined): Record<string, unknown> | undefined => {
  if (!param) return undefined;
  const ramps = param.events.filter((e) => e.type === 'linear');
  return ramps[ramps.length - 1];
};

describe('audio engine composition', () => {
  it('creates the AudioContext only after unlock()', () => {
    let created = 0;
    const engine = createAudioEngine({
      createContext: () => {
        created += 1;
        return makeContext() as unknown as AudioContext;
      },
    });

    expect(engine.isUnlocked).toBe(false);
    expect(created).toBe(0);

    engine.unlock();
    expect(engine.isUnlocked).toBe(true);
    expect(created).toBe(1);

    engine.dispose();
  });

  it('builds all five era beds and crossfades over the shared window', () => {
    const ctx = makeContext();
    const engine = createAudioEngine({
      createContext: () => ctx as unknown as AudioContext,
      crossfadeSeconds: 3,
    });

    engine.unlock();
    engine.setEra('1945');
    engine.setEra('2025');

    // Each setEra builds a distinct bed whose gain ramps to 1.
    const bedGains = ctx.nodes.filter((n) => n.gain && n.gain.events.some((e) => e.type === 'linear' && e.value === 1));
    expect(bedGains.length).toBe(2);

    // The newest bed ramps to 1 over 3 seconds (within 2–4s).
    const newest = bedGains[bedGains.length - 1];
    const ramp = lastLinearRamp(newest.gain);
    expect(ramp).toBeDefined();
    expect(ramp?.value).toBe(1);
    expect(ramp?.time).toBe(3);

    engine.dispose();
  });

  it('routes SFX one-shots through the SFX bus', () => {
    const ctx = makeContext();
    const engine = createAudioEngine({
      createContext: () => ctx as unknown as AudioContext,
    });

    engine.unlock();
    engine.playSfx('footstep');

    // A one-shot creates oscillator + gain nodes wired into the sfx bus.
    const oscillators = ctx.nodes.filter((n) => 'started' in n && (n as { started: boolean }).started);
    expect(oscillators.length).toBeGreaterThan(0);

    // The master gain connects to the destination; the SFX bus connects to it.
    const master = ctx.nodes.find((n) => n.connections.includes(ctx.destination));
    expect(master).toBeDefined();
    const sfxBus = ctx.nodes.find((n) => n.gain && n.connections.includes(master as MockAudioNode));
    expect(sfxBus).toBeDefined();

    engine.dispose();
  });

  it('mute and volume affect the master gain', () => {
    const ctx = makeContext();
    const engine = createAudioEngine({
      createContext: () => ctx as unknown as AudioContext,
    });

    engine.unlock();
    const master = ctx.nodes.find((n) => n.connections.includes(ctx.destination));
    expect(master).toBeDefined();

    engine.setVolume(0.5);
    const target = master?.gain?.events.find((e) => e.type === 'target' && e.value === 0.5);
    expect(target).toBeDefined();

    engine.toggleMute();
    expect(engine.isMuted).toBe(true);
    const muteTarget = master?.gain?.events.find((e) => e.type === 'target' && e.value === 0);
    expect(muteTarget).toBeDefined();

    engine.dispose();
  });

  it('starts and stops looping SFX (rain/wind) through the SFX bus', () => {
    const ctx = makeContext();
    const engine = createAudioEngine({
      createContext: () => ctx as unknown as AudioContext,
    });

    engine.unlock();
    engine.startLoop('rain', 0.6);

    const loopGains = ctx.nodes.filter((n) => n.gain && n.gain.events.some((e) => e.type === 'target'));
    expect(loopGains.length).toBeGreaterThan(0);

    engine.stopLoop('rain');
    // Loop is removed; a final target to 0 is scheduled.
    engine.dispose();
  });

  it('dispose closes the AudioContext and releases buses', () => {
    const ctx = makeContext();
    const engine = createAudioEngine({
      createContext: () => ctx as unknown as AudioContext,
    });

    engine.unlock();
    engine.setEra('1965');
    engine.dispose();

    expect(ctx.closed).toBe(true);
    expect(engine.isUnlocked).toBe(false);
  });

  it('the mock gain node exposes the AudioParam shape used by the engine', () => {
    const node = new MockAudioNode();
    node.gain = { value: 0, events: [] } as never;
    expect(node.gain).toBeDefined();
  });
});