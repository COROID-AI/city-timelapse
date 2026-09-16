/**
 * eraSystem.test.ts — five-era data integrity and transition state machine tests.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  ERA_DEFINITIONS,
  ERA_EVENT_NAMES,
  ERA_IDS,
  ERAS,
  TRANSITION_DURATION_SECONDS,
  EraSystem,
  getEraDefinition,
  isEraId,
  type EraId,
} from './eraSystem';

/** Slider order required by the product brief. */
const SLIDER_ORDER: readonly EraId[] = [1945, 1965, 1985, 2005, 2025];

/** Drives a system's tween to completion by ticking its clock. */
function driveToSettled(system: EraSystem, stepSeconds = 0.05, maxSteps = 500): void {
  let steps = 0;
  while (system.getState().phase === 'transitioning' && steps < maxSteps) {
    system.update(stepSeconds);
    steps += 1;
  }
}

describe('era registry', () => {
  it('exposes exactly the five eras in slider order with stable labels', () => {
    expect(ERA_IDS).toEqual(SLIDER_ORDER);
    expect(ERA_DEFINITIONS.map((era) => era.id)).toEqual(SLIDER_ORDER);
    expect(Object.keys(ERAS)).toHaveLength(5);
    for (const id of SLIDER_ORDER) {
      expect(ERAS[id]).toBeDefined();
      expect(ERAS[id].id).toBe(id);
      expect(ERAS[id].label).toBe(String(id));
    }
  });

  it('rejects any year outside the five eras (including the README 2055)', () => {
    for (const id of SLIDER_ORDER) {
      expect(isEraId(id)).toBe(true);
    }
    expect(isEraId(2055)).toBe(false);
    expect(isEraId(1900)).toBe(false);
    expect(() => getEraDefinition(2055 as unknown as EraId)).toThrow(/unknown era/i);
  });

  it('deeply freezes the registry so layers cannot mutate the shared contract', () => {
    expect(Object.isFrozen(ERAS)).toBe(true);
    expect(Object.isFrozen(ERA_DEFINITIONS)).toBe(true);
    for (const id of SLIDER_ORDER) {
      expect(Object.isFrozen(ERAS[id])).toBe(true);
      expect(Object.isFrozen(ERAS[id].palette.buildings)).toBe(true);
      expect(Object.isFrozen(ERAS[id].vehicles.types)).toBe(true);
      expect(Object.isFrozen(ERAS[id].advertisements.copy)).toBe(true);
    }
  });

  it('encodes complete period detail for every era', () => {
    for (const id of SLIDER_ORDER) {
      const era = ERAS[id];
      // palette
      expect(era.palette.buildings.length).toBeGreaterThan(0);
      expect(era.palette.accents.length).toBeGreaterThan(0);
      expect(era.palette.signs.length).toBeGreaterThan(0);
      expect(era.palette.sky).toMatch(/^#[0-9a-f]{6}$/i);
      expect(era.palette.light).toMatch(/^#[0-9a-f]{6}$/i);
      // atmosphere
      expect(era.atmosphere.lightTechnology.length).toBeGreaterThan(0);
      expect(era.atmosphere.lightTemperatureK).toBeGreaterThan(0);
      expect(era.atmosphere.fogDensity).toBeGreaterThanOrEqual(0);
      expect(era.atmosphere.sunIntensity).toBeGreaterThanOrEqual(0);
      // vehicles
      expect(era.vehicles.types.length).toBeGreaterThan(0);
      expect(era.vehicles.colors.length).toBeGreaterThan(0);
      expect(era.vehicles.density).toBeGreaterThanOrEqual(0);
      expect(era.vehicles.density).toBeLessThanOrEqual(1);
      // outfits
      expect(era.outfits.styles.length).toBeGreaterThan(0);
      expect(era.outfits.accessories.length).toBeGreaterThan(0);
      // storefronts
      expect(era.storefronts.signage.length).toBeGreaterThan(0);
      expect(era.storefronts.facade.length).toBeGreaterThan(0);
      expect(era.storefronts.shopTypes.length).toBeGreaterThan(0);
      // advertisements
      expect(era.advertisements.technology.length).toBeGreaterThan(0);
      expect(era.advertisements.copy.length).toBeGreaterThan(0);
      // SFX
      expect(era.sfx.ambient.length).toBeGreaterThan(0);
      expect(era.sfx.trafficLevel).toBeGreaterThanOrEqual(0);
      expect(era.sfx.masterLevel).toBeGreaterThan(0);
      expect(era.sfx.masterLevel).toBeLessThanOrEqual(1);
    }
  });

  it('pinpoints the era-defining period details from the brief', () => {
    // 1945 post-war austerity: brick/muted, 1940s vehicles, fedoras/overcoats,
    // painted signs + war-effort posters, incandescent light, trolley tracks.
    expect(ERAS[1945].atmosphere.lightTechnology).toBe('incandescent');
    expect(ERAS[1945].storefronts.signage).toBe('painted');
    expect(ERAS[1945].storefronts.facade).toBe('brick');
    expect(ERAS[1945].vehicles.features).toContain('trolley-tracks');
    expect(ERAS[1945].outfits.styles).toContain('fedora-overcoat');
    expect(ERAS[1945].advertisements.copy.some((c) => c.includes('WAR'))).toBe(true);
    // 1965 mid-century: pastels/chrome, tailfins/beetles, suits and dresses,
    // neon signs and marquees, fluorescent light.
    expect(ERAS[1965].atmosphere.lightTechnology).toBe('fluorescent');
    expect(ERAS[1965].storefronts.signage).toBe('neon');
    expect(ERAS[1965].vehicles.types).toContain('tailfin');
    expect(ERAS[1965].vehicles.types).toContain('beetle');
    expect(ERAS[1965].outfits.styles).toContain('tailored-suit');
    // 1985 neon-soaked night: mirrored glass, boxy sedans/taxis,
    // windbreakers/workout gear, neon + CRT billboards, sodium-vapor light.
    expect(ERAS[1985].atmosphere.lightTechnology).toBe('sodium-vapor');
    expect(ERAS[1985].advertisements.technology).toBe('crt-billboard');
    expect(ERAS[1985].vehicles.types).toContain('taxi');
    expect(ERAS[1985].vehicles.types).toContain('boxy-sedan');
    expect(ERAS[1985].outfits.styles).toContain('windbreaker');
    expect(ERAS[1985].outfits.styles).toContain('workout-gear');
    // 2005 early digital: curtain-wall glass, SUVs/sedans, cargo pants/flip
    // phones, backlit signage.
    expect(ERAS[2005].storefronts.facade).toBe('curtain-wall');
    expect(ERAS[2005].storefronts.signage).toBe('backlit');
    expect(ERAS[2005].vehicles.types).toContain('suv');
    expect(ERAS[2005].vehicles.types).toContain('sedan');
    expect(ERAS[2005].outfits.styles).toContain('cargo-pants');
    expect(ERAS[2005].outfits.accessories).toContain('flip-phone');
    // 2025 LED saturated: glass towers, EVs/e-scooters, athleisure/headphones,
    // giant LED billboards, LED street lighting, bike lane.
    expect(ERAS[2025].storefronts.facade).toBe('glass-tower');
    expect(ERAS[2025].storefronts.signage).toBe('led');
    expect(ERAS[2025].advertisements.technology).toBe('giant-led');
    expect(ERAS[2025].vehicles.power).toBe('electric');
    expect(ERAS[2025].vehicles.features).toContain('bike-lane');
    expect(ERAS[2025].outfits.styles).toContain('athleisure');
    expect(ERAS[2025].outfits.accessories).toContain('wireless-earbuds');
  });
});

describe('EraSystem transition state machine', () => {
  it('starts settled on the initial era', () => {
    const system = new EraSystem();
    expect(system.getState()).toEqual({ current: 1945, next: null, progress: 0, phase: 'idle' });
    const system1985 = new EraSystem(1985);
    expect(system1985.getState().current).toBe(1985);
  });

  it('treats same-year selection as a no-op', () => {
    const system = new EraSystem();
    const select = vi.fn();
    const transition = vi.fn();
    const settled = vi.fn();
    system.subscribe('era-select', select);
    system.subscribe('era-transition', transition);
    system.subscribe('era-settled', settled);
    system.selectEra(1945);
    expect(select).not.toHaveBeenCalled();
    expect(transition).not.toHaveBeenCalled();
    expect(settled).not.toHaveBeenCalled();
    expect(system.getState()).toEqual({ current: 1945, next: null, progress: 0, phase: 'idle' });
  });

  it('fires era-select, drives eased progress 0→1, then era-settled', () => {
    const system = new EraSystem();
    const sequence: string[] = [];
    const progresses: number[] = [];
    const selectPayloads: Array<{ from: EraId; to: EraId }> = [];
    const settledPayloads: Array<{ to: EraId }> = [];

    system.subscribe('era-select', (event) => {
      sequence.push('era-select');
      selectPayloads.push(event);
    });
    system.subscribe('era-transition', (event) => {
      sequence.push('era-transition');
      progresses.push(event.progress);
      expect(event.from).toBe(1945);
      expect(event.to).toBe(1965);
    });
    system.subscribe('era-settled', (event) => {
      sequence.push('era-settled');
      settledPayloads.push(event);
    });

    system.selectEra(1965);
    expect(selectPayloads).toEqual([{ from: 1945, to: 1965 }]);
    expect(progresses).toEqual([0]); // immediate progress-0 marker

    driveToSettled(system);
    expect(system.getState()).toEqual({ current: 1965, next: null, progress: 0, phase: 'idle' });
    expect(settledPayloads).toEqual([{ to: 1965 }]);

    // eased progress goes 0 -> 1 with intermediate steps, never backwards
    expect(progresses.length).toBeGreaterThan(2);
    for (let i = 1; i < progresses.length; i += 1) {
      expect(progresses[i]).toBeGreaterThanOrEqual(progresses[i - 1]);
    }
    expect(progresses[0]).toBe(0);
    expect(progresses[progresses.length - 1]).toBe(1);
    expect(progresses.some((p) => p > 0 && p < 1)).toBe(true);

    // event order: select first, transitions in between, settled last; one settle
    expect(sequence[0]).toBe('era-select');
    expect(sequence[sequence.length - 1]).toBe('era-settled');
    expect(sequence.filter((name) => name === 'era-settled')).toHaveLength(1);
  });

  it('is clock-driven: no ticks means no progress, one full tick settles', () => {
    const system = new EraSystem();
    const settled = vi.fn();
    system.subscribe('era-settled', settled);
    system.selectEra(2025);
    expect(system.getState()).toEqual({ current: 1945, next: 2025, progress: 0, phase: 'transitioning' });
    expect(settled).not.toHaveBeenCalled();
    system.update(TRANSITION_DURATION_SECONDS + 1);
    expect(system.getState()).toEqual({ current: 2025, next: null, progress: 0, phase: 'idle' });
    expect(settled).toHaveBeenCalledTimes(1);
    expect(settled).toHaveBeenCalledWith({ to: 2025 });
  });

  it('applies eased cubic progress on the clock', () => {
    const system = new EraSystem();
    system.selectEra(1965);
    // exactly half the duration -> eased progress 0.5
    system.update(TRANSITION_DURATION_SECONDS / 2);
    expect(system.getState().progress).toBeCloseTo(0.5, 5);
    // early ticks are damped by the easing curve
    system.update(0.1); // raw fraction 0.05 -> eased ~0.0005
    const early = system.getState();
    expect(early.progress).toBeGreaterThan(0);
    expect(early.progress).toBeLessThan(0.05);
  });

  it('retargets an in-flight transition and settles on the newest target', () => {
    const system = new EraSystem();
    const select = vi.fn();
    const settled = vi.fn();
    system.subscribe('era-select', select);
    system.subscribe('era-settled', settled);
    system.selectEra(1965);
    system.update(1); // halfway to 1965
    system.selectEra(1985);
    expect(select).toHaveBeenLastCalledWith({ from: 1945, to: 1985 });
    expect(system.getState()).toEqual({ current: 1945, next: 1985, progress: 0, phase: 'transitioning' });
    driveToSettled(system);
    expect(system.getState().current).toBe(1985);
    expect(system.getState().next).toBeNull();
    expect(settled).toHaveBeenCalledTimes(1);
    expect(settled).toHaveBeenCalledWith({ to: 1985 });
  });

  it('ignores selecting the tween target already in flight', () => {
    const system = new EraSystem();
    const select = vi.fn();
    system.subscribe('era-select', select);
    system.selectEra(1965);
    expect(select).toHaveBeenCalledTimes(1);
    system.selectEra(1965);
    expect(select).toHaveBeenCalledTimes(1);
    expect(system.getState().next).toBe(1965);
  });

  it('rejects unknown era ids at runtime', () => {
    const system = new EraSystem();
    expect(() => system.selectEra(2055 as unknown as EraId)).toThrow(/unknown era/i);
    expect(() => new EraSystem(2055 as unknown as EraId)).toThrow(/unknown era/i);
  });

  it('delivers events to all subscribers and drops unsubscribed listeners', () => {
    const system = new EraSystem();
    const a = vi.fn();
    const b = vi.fn();
    const unsubscribe = system.subscribe('era-transition', a);
    system.subscribe('era-transition', b);
    unsubscribe();
    system.selectEra(1965);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });

  it('dispose clears the bus and makes further interaction throw', () => {
    const system = new EraSystem();
    const select = vi.fn();
    system.subscribe('era-select', select);
    system.selectEra(1965);
    expect(select).toHaveBeenCalledTimes(1);
    system.dispose();
    expect(() => system.subscribe('era-select', select)).toThrow(/disposed/i);
    expect(() => system.selectEra(2005)).toThrow(/disposed/i);
    system.update(1); // inert, no throw
    expect(system.getState().current).toBe(1945);
  });

  it('publishes exactly the documented event names', () => {
    expect(ERA_EVENT_NAMES).toEqual(['era-select', 'era-transition', 'era-settled']);
  });
});