import { describe, expect, it } from 'vitest';
import type { EraId } from '../eras/types';
import { AudioBus } from './AudioBus';
import type { AudioBusBackend, EraChannelKind } from './AudioBus';

class RecordingBackend implements AudioBusBackend {
  readonly events: string[] = [];

  createChannel(eraId: EraId, kind: EraChannelKind): void {
    this.events.push(`create:${eraId}:${kind}`);
  }

  setLevel(eraId: EraId, kind: EraChannelKind, level: number): void {
    this.events.push(`level:${eraId}:${kind}:${level.toFixed(4)}`);
  }

  setMasterVolume(volume: number): void {
    this.events.push(`master:${volume.toFixed(4)}`);
  }

  removeChannel(eraId: EraId, kind: EraChannelKind): void {
    this.events.push(`remove:${eraId}:${kind}`);
  }

  dispose(): void {
    this.events.push('dispose');
  }

  levelsFor(eraId: EraId, kind: EraChannelKind): number[] {
    return this.events
      .filter((event) => event.startsWith(`level:${eraId}:${kind}:`))
      .map((event) => Number.parseFloat(event.split(':')[3]));
  }
}

describe('AudioBus', () => {
  it('registers per-era ambience and sfx channels with descriptor levels', () => {
    const backend = new RecordingBackend();
    const bus = new AudioBus({ backend });
    bus.registerEra('1945', { ambience: 0.5, sfx: 0.25, data: { droneHz: [110, 220] } });
    bus.registerEra('2025'); // defaults to 1/1

    expect(backend.events.filter((event) => event.startsWith('create:'))).toEqual([
      'create:1945:ambience',
      'create:1945:sfx',
      'create:2025:ambience',
      'create:2025:sfx',
    ]);
    expect(bus.registeredEras).toEqual(['1945', '2025']);
    expect(bus.getDescriptor('1945')).toMatchObject({ ambience: 0.5, sfx: 0.25 });
    expect(bus.getDescriptor('2025')).toMatchObject({});
  });

  it('fades channels toward base * weight * master through bounded ramps', () => {
    const bus = new AudioBus();
    bus.registerEra('1945', { ambience: 0.5 });
    bus.registerEra('2025', { ambience: 1 });

    bus.applyEraWeights({ '1945': 1, '2025': 0 });

    // Silent channel with weight 0 stays silent.
    expect(bus.getLevel('2025', 'ambience')).toBe(0);

    bus.update(0.01); // partial progress through the 0.08s ramp
    const partial = bus.getLevel('1945', 'ambience');
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(0.5);

    bus.update(1); // ramp completes
    expect(bus.getLevel('1945', 'ambience')).toBeCloseTo(0.5, 5);
    expect(bus.getLevel('2025', 'ambience')).toBeCloseTo(0, 5);
  });

  it('accepts Map or Record weight inputs and ignores unknown eras', () => {
    const bus = new AudioBus();
    bus.registerEra('1965', { ambience: 1 });

    const map = new Map<EraId, number>();
    map.set('1965', 1);
    bus.applyEraWeights(map);
    bus.update(1);
    expect(bus.getLevel('1965', 'ambience')).toBeCloseTo(1, 5);

    bus.applyEraWeights({ '1965': 0, '1945': 1 }); // '1945' has no channels
    bus.update(1);
    expect(bus.getLevel('1965', 'ambience')).toBeCloseTo(0, 5);
  });

  it('clamps out-of-range weights and levels', () => {
    const bus = new AudioBus();
    bus.registerEra('2005', { ambience: 2, sfx: -3 });
    bus.applyEraWeights({ '2005': 5 });
    bus.update(1);

    expect(bus.getLevel('2005', 'ambience')).toBeCloseTo(1, 5);
    expect(bus.getLevel('2005', 'sfx')).toBeCloseTo(0, 5);
  });

  it('fadeChannel ramps to an absolute level over its own duration', () => {
    const bus = new AudioBus();
    bus.registerEra('1985', { ambience: 1 });
    bus.applyEraWeights({ '1985': 1 });
    bus.update(1);
    expect(bus.getLevel('1985', 'ambience')).toBeCloseTo(1, 5);

    bus.fadeChannel('1985', 'ambience', 0, 0.2);
    bus.update(0.1); // halfway
    expect(bus.getLevel('1985', 'ambience')).toBeCloseTo(0.5, 5);
    bus.update(0.1);
    expect(bus.getLevel('1985', 'ambience')).toBeCloseTo(0, 5);
  });

  it('scales delivered levels by the master volume', () => {
    const backend = new RecordingBackend();
    const bus = new AudioBus({ backend });
    bus.registerEra('2025', { ambience: 0.5 });
    bus.applyEraWeights({ '2025': 1 });
    bus.update(1);
    expect(bus.getLevel('2025', 'ambience')).toBeCloseTo(0.5, 5);

    bus.setMasterVolume(0.5);
    expect(backend.events).toContain('master:0.5000');
    bus.update(1);
    expect(bus.getLevel('2025', 'ambience')).toBeCloseTo(0.25, 5);
  });

  it('only forwards levels to the backend once a channel produces sound', () => {
    const backend = new RecordingBackend();
    const bus = new AudioBus({ backend });
    bus.registerEra('1945');
    bus.applyEraWeights({ '1945': 0 });
    bus.update(1);
    expect(backend.levelsFor('1945', 'ambience')).toEqual([]);

    bus.applyEraWeights({ '1945': 1 });
    bus.update(1);
    const levels = backend.levelsFor('1945', 'ambience');
    expect(levels.length).toBeGreaterThan(0);
    expect(levels[levels.length - 1]).toBeCloseTo(1, 4);
  });

  it('re-registration updates base levels without resetting channel state', () => {
    const bus = new AudioBus();
    bus.registerEra('1965', { ambience: 0.4 });
    bus.applyEraWeights({ '1965': 1 });
    bus.update(1);
    expect(bus.getLevel('1965', 'ambience')).toBeCloseTo(0.4, 5);

    bus.registerEra('1965', { ambience: 0.8 });
    bus.update(1);
    expect(bus.getLevel('1965', 'ambience')).toBeCloseTo(0.8, 5);
    expect(bus.registeredEras).toEqual(['1965']);
  });

  it('unregisterEra removes both channels and drops descriptors', () => {
    const bus = new AudioBus();
    bus.registerEra('1985', { ambience: 0.7, data: { events: ['horn'] } });
    expect(bus.hasEra('1985')).toBe(true);

    bus.unregisterEra('1985');
    expect(bus.hasEra('1985')).toBe(false);
    expect(bus.registeredEras).toEqual([]);
    expect(bus.getDescriptor('1985')).toBeUndefined();
    expect(() => bus.getLevel('1985', 'ambience')).toThrow(/no "ambience" channel/);
    expect(() => bus.unregisterEra('1985')).not.toThrow(); // idempotent
  });

  it('rejects unknown era ids and reports snapshot levels', () => {
    const bus = new AudioBus();
    expect(() => bus.registerEra('1995' as EraId)).toThrow(TypeError);

    bus.registerEra('1945', { ambience: 0.5, sfx: 0.5 });
    bus.applyEraWeights({ '1945': 1 });
    bus.update(1);

    expect(bus.snapshotLevels()).toMatchObject({
      '1945': { ambience: expect.closeTo(0.5, 4), sfx: expect.closeTo(0.5, 4) },
    });
  });

  it('dispose clears channels and notifies the backend once', () => {
    const backend = new RecordingBackend();
    const bus = new AudioBus({ backend });
    bus.registerEra('2025');
    bus.dispose();

    expect(backend.events).toContain('dispose');
    expect(bus.registeredEras).toEqual([]);
    expect(bus.getDescriptor('2025')).toBeUndefined();
  });
});
