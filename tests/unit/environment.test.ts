/**
 * Unit tests for the environment subsystem.
 *
 * These tests use era-data mocks (with a DOM-stubbed canvas) to prove:
 *   - fog color/density and sky colors lerp correctly through
 *     `applyEraBlend`
 *   - streetlight intensity/color lerp correctly
 *   - color grading lerps between era presets
 *   - particle opacity cross-fades between eras
 *   - the subsystem registers into the SceneRegistry and builds its groups
 *     from the era's environment payload
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Color, Group, Scene } from 'three';
import type { Mesh, Points, PointsMaterial } from 'three';
import { EnvironmentSubsystem, ENVIRONMENT_GROUP_ID } from '../../src/environment/EnvironmentSubsystem';
import { clearSubsystems, getSubsystem, listSubsystems } from '../../src/engine/SceneRegistry';
import type { EraEnvironment, EraId } from '../../src/engine/eras';
import { buildColorGrade, lerpColorGrade, applyColorGrade } from '../../src/environment/grading';
import { applySkyBlend, buildSkyState, type EraSkyState } from '../../src/environment/sky';
import { applyParticleBlend, buildParticleLayer, type EraParticleState } from '../../src/environment/particles';
import { applyLightBlend, buildStreetlightRig, collectPosts, type EraLightState } from '../../src/environment/streetlights';

/** Minimal DOM stub so procedural canvas textures can be generated. */
function stubDom(): void {
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    setLineDash: () => undefined,
    fillRect: () => undefined,
    strokeRect: () => undefined,
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    stroke: () => undefined,
    fill: () => undefined,
  };
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ctx,
        };
      }
      return {};
    },
  });
}

/** Builds a full environment payload from era-data values. */
function makeEnvironment(overrides: Partial<EraEnvironment>): EraEnvironment {
  return {
    timeOfDay: 'day',
    weather: 'clear',
    grading: 'neutral',
    skyColor: { r: 0.5, g: 0.5, b: 0.5 },
    horizonColor: { r: 0.7, g: 0.7, b: 0.7 },
    fogColor: { r: 0.6, g: 0.6, b: 0.6 },
    fogStart: 10,
    fogEnd: 60,
    haze: { color: { r: 0.5, g: 0.5, b: 0.5 }, density: 0.2, particleCount: 30 },
    streetlights: { color: { r: 1, g: 0.7, b: 0.4 }, poolColor: { r: 0.9, g: 0.6, b: 0.3 }, intensity: 0.8 },
    sun: { color: { r: 1, g: 0.9, b: 0.8 }, intensity: 1, elevationDeg: 40, azimuthDeg: 150 },
    ambientIntensity: 0.5,
    ...overrides,
  };
}

/** 1945-style payload: dim sepia dusk with coal-smoke haze. */
const ENV_1945: EraEnvironment = makeEnvironment({
  timeOfDay: 'dusk',
  grading: 'muted-sepia',
  skyColor: { r: 0.42, g: 0.4, b: 0.37 },
  horizonColor: { r: 0.56, g: 0.48, b: 0.4 },
  fogColor: { r: 0.45, g: 0.42, b: 0.38 },
  fogStart: 10,
  fogEnd: 55,
  haze: { color: { r: 0.36, g: 0.33, b: 0.3 }, density: 0.55, particleCount: 120 },
  streetlights: { color: { r: 1, g: 0.72, b: 0.42 }, poolColor: { r: 0.95, g: 0.62, b: 0.35 }, intensity: 0.9 },
  sun: { color: { r: 0.86, g: 0.78, b: 0.66 }, intensity: 0.55, elevationDeg: 14, azimuthDeg: 208 },
  ambientIntensity: 0.42,
});

/** 1985-style payload: evening sky, magenta-cyan grading, wet-street mist. */
const ENV_1985: EraEnvironment = makeEnvironment({
  timeOfDay: 'evening',
  grading: 'neon-magenta-cyan-blue',
  skyColor: { r: 0.07, g: 0.08, b: 0.17 },
  horizonColor: { r: 0.42, g: 0.16, b: 0.4 },
  fogColor: { r: 0.16, g: 0.07, b: 0.22 },
  fogStart: 6,
  fogEnd: 46,
  haze: { color: { r: 0.72, g: 0.24, b: 0.88 }, density: 0.5, particleCount: 220 },
  streetlights: { color: { r: 1, g: 0.62, b: 0.34 }, poolColor: { r: 0.9, g: 0.52, b: 0.3 }, intensity: 1.15 },
  sun: { color: { r: 0.6, g: 0.4, b: 0.58 }, intensity: 0.35, elevationDeg: 6, azimuthDeg: 236 },
  ambientIntensity: 0.3,
});

/** A sky state built from an environment payload. */
function skyState(env: EraEnvironment): EraSkyState {
  return buildSkyState(env);
}

/** A light state built from an environment payload. */
function lightState(era: EraId, env: EraEnvironment): EraLightState {
  return {
    style: (era === '1945' ? 'gas' : era === '1965' ? 'sodium' : era === '1985' ? 'hps' : era === '2005' ? 'fluorescent' : 'led'),
    color: env.streetlights.color,
    poolColor: env.streetlights.poolColor,
    intensity: env.streetlights.intensity,
  };
}

/** A particle state built from an environment payload. */
function particleState(env: EraEnvironment): EraParticleState {
  return {
    color: env.haze.color,
    density: env.haze.density,
    particleCount: env.haze.particleCount,
    spreadY: 5,
    driftSpeed: 0.3,
  };
}

/** Builds a subsystem whose era data is mocked directly. */
function makeSubsystem(era: EraId, env: EraEnvironment): EnvironmentSubsystem {
  const scene = new Scene();
  const subsystem = new EnvironmentSubsystem(scene);
  subsystem.build(era);
  subsystem['eras'].set(era, env);
  return subsystem;
}

describe('EnvironmentSubsystem contract', () => {
  beforeEach(() => {
    clearSubsystems();
    stubDom();
  });

  it('registers into the SceneRegistry under the environment group id', () => {
    const scene = new Scene();
    const subsystem = new EnvironmentSubsystem(scene);
    subsystem.erect('1945');
    expect(getSubsystem(ENVIRONMENT_GROUP_ID)).toBe(subsystem);
    expect(listSubsystems()).toContain(subsystem);
    subsystem.dispose();
    clearSubsystems();
  });

  it('builds ground/road/sidewalk/streetlight/sky/particle groups from the era payload', () => {
    const scene = new Scene();
    const subsystem = new EnvironmentSubsystem(scene);
    subsystem.erect('1945');
    scene.add(subsystem.group);

    expect(subsystem.group.getObjectByName('environment-ground')).toBeDefined();
    expect(subsystem.group.getObjectByName('environment-road')).toBeDefined();
    expect(subsystem.group.getObjectByName('environment-sidewalk-north')).toBeDefined();
    expect(subsystem.group.getObjectByName('environment-streetlights')).toBeDefined();
    expect(subsystem.group.getObjectByName('environment-sky')).toBeDefined();
    expect(subsystem.group.getObjectByName('environment-particles')).toBeDefined();
    expect(scene.fog).toBe(subsystem.fog);
    subsystem.dispose();
    clearSubsystems();
  });

  it('build(era) returns the era environment payload', () => {
    const subsystem = makeSubsystem('1945', ENV_1945);
    const built = subsystem.build('1945');
    expect(built.grading).toBe('muted-sepia');
    expect(built.streetlights.intensity).toBeCloseTo(0.9);
  });
});

describe('EnvironmentSubsystem — applyEraBlend', () => {
  beforeEach(() => {
    clearSubsystems();
    stubDom();
  });

  it('lerps fog color and density over the transition', () => {
    const subsystem = makeSubsystem('1945', ENV_1945);
    subsystem['eras'].set('1985', ENV_1985);
    subsystem.erect('1945');

    subsystem.applyEraBlend('1945', '1985', 0);
    const start = subsystem.fog.color.clone();
    expect(start.r).toBeCloseTo(0.45);
    expect(start.g).toBeCloseTo(0.42);
    expect(start.b).toBeCloseTo(0.38);
    expect(subsystem.fog.near).toBeCloseTo(10);
    expect(subsystem.fog.far).toBeCloseTo(55);

    subsystem.applyEraBlend('1945', '1985', 1);
    expect(subsystem.fog.color.r).toBeCloseTo(0.16);
    expect(subsystem.fog.color.g).toBeCloseTo(0.07);
    expect(subsystem.fog.color.b).toBeCloseTo(0.22);
    expect(subsystem.fog.near).toBeCloseTo(6);
    expect(subsystem.fog.far).toBeCloseTo(46);

    subsystem.applyEraBlend('1945', '1985', 0.5);
    const mid = subsystem.fog.color;
    expect(mid.r).toBeGreaterThan(0.16);
    expect(mid.r).toBeLessThan(0.45);
    expect(mid.b).toBeGreaterThan(0.22);
    expect(mid.b).toBeLessThan(0.38);
    subsystem.dispose();
    clearSubsystems();
  });

  it('lerps sky dome colors over the transition', () => {
    const subsystem = makeSubsystem('1945', ENV_1945);
    subsystem['eras'].set('1985', ENV_1985);
    subsystem.erect('1945');

    subsystem.applyEraBlend('1945', '1985', 0);
    subsystem.applyEraBlend('1945', '1985', 1);
    // Sky dome top color reaches the 1985 zenith.
    const sky = subsystem.group.getObjectByName('environment-sky-dome') as Mesh | undefined;
    expect(sky).toBeDefined();
    subsystem.dispose();
    clearSubsystems();
  });

  it('lerps streetlight intensity and color over the transition', () => {
    const scene = new Scene();
    const subsystem = new EnvironmentSubsystem(scene);
    subsystem['eras'].set('1945', ENV_1945);
    subsystem['eras'].set('1985', ENV_1985);
    subsystem.erect('1945');

    subsystem.applyEraBlend('1945', '1985', 0);
    subsystem.applyEraBlend('1945', '1985', 1);
    subsystem.applyEraBlend('1945', '1985', 0.5);

    const rig = subsystem.group.getObjectByName('environment-streetlights') as Group;
    const posts = collectPosts(rig);
    expect(posts.length).toBeGreaterThan(0);
    const light = posts[0].light;
    expect(light.intensity).toBeGreaterThan(0.9);
    expect(light.intensity).toBeLessThan(1.15);
    expect(light.color.r).toBeCloseTo(1);
    expect(light.color.b).toBeGreaterThan(0.34);
    expect(light.color.b).toBeLessThan(0.42);
    subsystem.dispose();
    clearSubsystems();
  });

  it('cross-fades particle opacity between eras', () => {
    const subsystem = makeSubsystem('1945', ENV_1945);
    subsystem['eras'].set('1985', ENV_1985);
    subsystem.erect('1945');

    subsystem.applyEraBlend('1945', '1985', 0);
    subsystem.applyEraBlend('1945', '1985', 1);
    subsystem.applyEraBlend('1945', '1985', 0.5);

    const particles = subsystem.group.getObjectByName('environment-particles') as Points;
    const material = particles.material as PointsMaterial;
    expect(material.opacity).toBeGreaterThan(0.5);
    expect(material.opacity).toBeLessThan(0.56);
    subsystem.dispose();
    clearSubsystems();
  });

  it('lerps color grading uniforms between era presets', () => {
    const subsystem = makeSubsystem('1945', ENV_1945);
    subsystem['eras'].set('1985', ENV_1985);
    subsystem.erect('1945');

    subsystem.applyEraBlend('1945', '1985', 0);
    expect(subsystem.grade.label).toBe('muted-sepia');

    subsystem.applyEraBlend('1945', '1985', 1);
    expect(subsystem.grade.label).toBe('neon-magenta-cyan-blue');

    subsystem.applyEraBlend('1945', '1985', 0.5);
    expect(subsystem.grade.saturation).toBeGreaterThan(0.9);
    expect(subsystem.grade.saturation).toBeLessThan(1.28);
    subsystem.dispose();
    clearSubsystems();
  });
});

describe('environment math helpers', () => {
  it('lerpColorGrade interpolates matrix, offset, saturation, temperature', () => {
    const from = buildColorGrade('muted-sepia');
    const to = buildColorGrade('neon-magenta-cyan-blue');
    const mid = lerpColorGrade(from, to, 0.5);
    expect(mid.matrix.length).toBe(9);
    expect(mid.offset.length).toBe(3);
    expect(mid.saturation).toBeCloseTo((0.9 + 1.28) / 2);
    expect(mid.temperature).toBeCloseTo((0.35 + -0.2) / 2);
  });

  it('applyColorGrade shifts sepia toward warm and neutral keeps identity', () => {
    const sepia = buildColorGrade('muted-sepia');
    const neutral = buildColorGrade('neutral');
    const white = { r: 1, g: 1, b: 1 };
    const sepiaOut = applyColorGrade(sepia, white);
    expect(sepiaOut.r).toBeGreaterThan(sepiaOut.b);
    const neutralOut = applyColorGrade(neutral, white);
    expect(neutralOut.r).toBeCloseTo(1, 3);
    expect(neutralOut.g).toBeCloseTo(1, 3);
    expect(neutralOut.b).toBeCloseTo(1, 3);
  });

  it('applySkyBlend lerps fog color and sky colors', () => {
    const from = skyState(ENV_1945);
    const to = skyState(ENV_1985);
    const group = new Group();
    // A bare group: applySkyBlend is a no-op on missing meshes but still
    // writes the fog object.
    const fog = { color: new Color(), near: 0, far: 0 };
    applySkyBlend(group, from, to, 0.5, fog as never);
    expect(fog.color.r).toBeGreaterThan(0.16);
    expect(fog.color.r).toBeLessThan(0.45);
    expect(fog.near).toBeCloseTo(8);
    expect(fog.far).toBeCloseTo(50.5);
  });

  it('applyLightBlend lerps intensity and color', () => {
    const from = lightState('1945', ENV_1945);
    const to = lightState('1985', ENV_1985);
    const rig = buildStreetlightRig(from, 4);
    applyLightBlend(rig, from, to, 0.5);
    const posts = collectPosts(rig);
    expect(posts.length).toBe(4);
    expect(posts[0].light.intensity).toBeCloseTo(1.025);
    expect(posts[0].light.color.b).toBeGreaterThan(0.34);
    expect(posts[0].light.color.b).toBeLessThan(0.42);
  });

  it('applyParticleBlend cross-fades opacity', () => {
    const from = particleState(ENV_1945);
    const to = particleState(ENV_1985);
    const layer = buildParticleLayer(from, { x: 10, z: 10 });
    expect(layer.material.opacity).toBeCloseTo(0.55);
    applyParticleBlend(layer, from, to, 0.5);
    expect(layer.material.opacity).toBeCloseTo(0.525);
    applyParticleBlend(layer, from, to, 1);
    expect(layer.material.opacity).toBeCloseTo(0.5);
    expect(layer.points.visible).toBe(true);
  });
});