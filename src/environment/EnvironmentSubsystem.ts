/**
 * EnvironmentSubsystem — sky, fog, ground, roads, sidewalks, streetlight rig,
 * color grading, and weather particles.
 *
 * Implements the `EraScopedSubsystem` contract from the SceneRegistry and
 * registers itself under groupId `'environment'`. The subsystem owns one
 * Three.js group containing the ground apron, road ring, sidewalks, curb
 * edges, streetlight rig, sky dome with sun/moon/star field, and the ambient
 * weather particle layer. It also owns the scene's `Fog` and the era's color
 * grading state, which the foundation renderer can plug into as uniforms.
 *
 * Era payloads come from the authored `TimeEra.environment` data (or the
 * local 2025 fallback). `applyEraBlend(fromEra, toEra, t)` lerps fog
 * color/density, sky dome colors, streetlight intensity+color, color grading
 * uniforms, and cross-fades particle opacity over the transition.
 *
 * Ground/road/sidewalk extents are derived from the shared
 * `src/config/paths.ts` block-extent config so camera, buildings, and
 * environment agree on the footprint. Ground, road, sidewalk, and curb
 * textures are procedural canvas textures generated at runtime.
 */
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
} from 'three';
import type { EraId, EraEnvironment, RgbColor } from '../engine/eras';
import { register } from '../engine/SceneRegistry';
import type { EraScopedSubsystem } from '../engine/SceneRegistry';
import { getEnvironmentForEra } from './eraEnvironment';
import {
  applyColorGrade,
  buildColorGrade,
  lerpColorGrade,
  type ColorGradeState,
} from './grading';
import {
  GROUND_HALF_EXTENT,
  GROUND_Y,
  ROAD_OUTER_X,
  ROAD_OUTER_Z,
  ROAD_Y,
  SIDEWALK_OUTER_X,
  SIDEWALK_OUTER_Z,
  SIDEWALK_WIDTH,
  SIDEWALK_Y,
} from './layout';
import {
  applyParticleBlend,
  applyParticleState,
  buildParticleLayer,
  disposeParticleLayer,
  updateParticleLayer,
  type EraParticleState,
  type ParticleLayer,
} from './particles';
import {
  applySkyBlend,
  applySkyState,
  buildSkyGroup,
  buildSkyState,
  sunDirection,
  SKY_DOME_RADIUS,
  type EraSkyState,
} from './sky';
import {
  applyLightBlend,
  applyLightState,
  buildStreetlightRig,
  type EraLightState,
  type StreetlightStyle,
} from './streetlights';
import {
  generateAsphaltTexture,
  generateConcreteTexture,
  generateCurbTexture,
  paintLaneMarkings,
  type LaneMarkingStyle,
  type ProceduralSurfaceTexture,
} from './textures';

const clamp = MathUtils.clamp;

/** Registry id for this subsystem. */
export const ENVIRONMENT_GROUP_ID = 'environment';

/** Style of lane markings painted per era. */
const LANE_STYLE_BY_ERA: Record<EraId, LaneMarkingStyle> = {
  '1945': 'none',
  '1965': 'dashed',
  '1985': 'center',
  '2005': 'center-double',
  '2025': 'center-double',
};

/** Streetlight fixture style per era. */
const LIGHT_STYLE_BY_ERA: Record<EraId, StreetlightStyle> = {
  '1945': 'gas',
  '1965': 'sodium',
  '1985': 'hps',
  '2005': 'fluorescent',
  '2025': 'led',
};

/** Number of lamp posts around the block. */
const LAMP_COUNT = 8;

/** Ambient weather particle parameters per era. */
const PARTICLE_STATE_BY_ERA: Record<EraId, EraParticleState> = {
  '1945': { color: { r: 0.36, g: 0.33, b: 0.3 }, density: 0.55, particleCount: 120, spreadY: 5.5, driftSpeed: 0.3 },
  '1965': { color: { r: 0.62, g: 0.6, b: 0.56 }, density: 0.1, particleCount: 24, spreadY: 4.5, driftSpeed: 0.2 },
  '1985': { color: { r: 0.72, g: 0.24, b: 0.88 }, density: 0.5, particleCount: 220, spreadY: 3.5, driftSpeed: 0.4 },
  '2005': { color: { r: 0.82, g: 0.85, b: 0.87 }, density: 0.28, particleCount: 160, spreadY: 6, driftSpeed: 0.25 },
  '2025': { color: { r: 0.85, g: 0.88, b: 0.9 }, density: 0.04, particleCount: 12, spreadY: 6, driftSpeed: 0.15 },
};

/** Builds an era's sky state from its environment payload. */
function skyStateFor(env: EraEnvironment): EraSkyState {
  return buildSkyState(env);
}

/** Builds an era's light state from its environment payload. */
function lightStateFor(era: EraId, env: EraEnvironment): EraLightState {
  return {
    style: LIGHT_STYLE_BY_ERA[era],
    color: env.streetlights.color,
    poolColor: env.streetlights.poolColor,
    intensity: env.streetlights.intensity,
  };
}

/** Builds an era's particle state from its environment payload. */
function particleStateFor(env: EraEnvironment): EraParticleState {
  return {
    color: env.haze.color,
    density: env.haze.density,
    particleCount: env.haze.particleCount,
    spreadY: 5,
    driftSpeed: 0.3,
  };
}

/** Builds an era's color grade from its environment payload. */
function gradeStateFor(env: EraEnvironment): ColorGradeState {
  return buildColorGrade(env.grading);
}

/** Ground group plus the road texture (so lane markings can be repainted). */
interface GroundBuild {
  readonly group: Group;
  readonly roadTexture: ProceduralSurfaceTexture;
}

/** Builds the ground plane, road ring, sidewalks, and curb edges. */
function buildGroundGroup(): GroundBuild {
  const group = new Group();
  group.name = 'environment-ground';

  const groundTexture = generateAsphaltTexture();
  const roadTexture = generateAsphaltTexture();
  const sidewalkTexture = generateConcreteTexture();
  const curbTexture = generateCurbTexture();

  // Ground apron (asphalt/concrete) under everything.
  const ground = new Mesh(
    new PlaneGeometry(GROUND_HALF_EXTENT * 2, GROUND_HALF_EXTENT * 2, 1, 1),
    new MeshStandardMaterial({
      map: groundTexture.texture,
      color: 0x8a8a8a,
      roughness: 0.92,
      metalness: 0,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = GROUND_Y;
  ground.name = 'environment-ground-plane';
  group.add(ground);

  // Road ring around the block+sidewalk (asphalt with lane markings).
  const road = new Mesh(
    new PlaneGeometry(ROAD_OUTER_X * 2, ROAD_OUTER_Z * 2, 1, 1),
    new MeshStandardMaterial({
      map: roadTexture.texture,
      color: 0x5a5f64,
      roughness: 0.88,
      metalness: 0,
    }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.y = ROAD_Y;
  road.name = 'environment-road';
  group.add(road);

  // Sidewalk bands along the four block edges (raised above the road).
  const sidewalkMaterial = new MeshStandardMaterial({
    map: sidewalkTexture.texture,
    color: 0xa8a29a,
    roughness: 0.85,
  });
  const bandWidthX = SIDEWALK_OUTER_X * 2;
  const bandDepthX = SIDEWALK_WIDTH;
  const bandWidthZ = SIDEWALK_OUTER_Z * 2;
  const bandDepthZ = SIDEWALK_WIDTH;

  const sidewalkTop = new Mesh(new PlaneGeometry(bandWidthX, bandDepthX), sidewalkMaterial);
  sidewalkTop.rotation.x = -Math.PI / 2;
  sidewalkTop.position.set(0, SIDEWALK_Y, SIDEWALK_OUTER_Z);
  sidewalkTop.name = 'environment-sidewalk-north';
  group.add(sidewalkTop);

  const sidewalkBottom = new Mesh(new PlaneGeometry(bandWidthX, bandDepthX), sidewalkMaterial);
  sidewalkBottom.rotation.x = -Math.PI / 2;
  sidewalkBottom.position.set(0, SIDEWALK_Y, -SIDEWALK_OUTER_Z);
  sidewalkBottom.name = 'environment-sidewalk-south';
  group.add(sidewalkBottom);

  const sidewalkEast = new Mesh(new PlaneGeometry(bandDepthZ, bandWidthZ), sidewalkMaterial);
  sidewalkEast.rotation.x = -Math.PI / 2;
  sidewalkEast.position.set(SIDEWALK_OUTER_X, SIDEWALK_Y, 0);
  sidewalkEast.name = 'environment-sidewalk-east';
  group.add(sidewalkEast);

  const sidewalkWest = new Mesh(new PlaneGeometry(bandDepthZ, bandWidthZ), sidewalkMaterial);
  sidewalkWest.rotation.x = -Math.PI / 2;
  sidewalkWest.position.set(-SIDEWALK_OUTER_X, SIDEWALK_Y, 0);
  sidewalkWest.name = 'environment-sidewalk-west';
  group.add(sidewalkWest);

  // Curb edges: thin raised boxes on the outer sidewalk edges.
  const curbMaterial = new MeshStandardMaterial({ map: curbTexture.texture, color: 0x6f6b64, roughness: 0.9 });
  const curbN = new Mesh(new BoxGeometry(bandWidthX, 0.08, 0.25), curbMaterial);
  curbN.position.set(0, 0.1, SIDEWALK_OUTER_Z + 0.12);
  curbN.name = 'environment-curb-north';
  group.add(curbN);
  const curbS = new Mesh(new BoxGeometry(bandWidthX, 0.08, 0.25), curbMaterial);
  curbS.position.set(0, 0.1, -SIDEWALK_OUTER_Z - 0.12);
  curbS.name = 'environment-curb-south';
  group.add(curbS);
  const curbE = new Mesh(new BoxGeometry(0.25, 0.08, bandWidthZ), curbMaterial);
  curbE.position.set(SIDEWALK_OUTER_X + 0.12, 0.1, 0);
  curbE.name = 'environment-curb-east';
  group.add(curbE);
  const curbW = new Mesh(new BoxGeometry(0.25, 0.08, bandWidthZ), curbMaterial);
  curbW.position.set(-SIDEWALK_OUTER_X - 0.12, 0.1, 0);
  curbW.name = 'environment-curb-west';
  group.add(curbW);

  return { group, roadTexture };
}

/** Builds the sun key light, hemisphere fill, and ambient light. */
function buildLights(env: EraEnvironment): { sun: DirectionalLight; hemisphere: HemisphereLight; ambient: AmbientLight } {
  const sun = new DirectionalLight(
    new Color().setRGB(env.sun.color.r, env.sun.color.g, env.sun.color.b),
    env.sun.intensity,
  );
  sun.name = 'environment-sun-light';
  sun.position.copy(sunDirection(env.sun.elevationDeg, env.sun.azimuthDeg).multiplyScalar(18));

  const hemisphere = new HemisphereLight(0xbdd8ff, 0x22303f, 0.5);
  hemisphere.name = 'environment-hemisphere-light';

  const ambient = new AmbientLight(0xffffff, env.ambientIntensity);
  ambient.name = 'environment-ambient-light';

  return { sun, hemisphere, ambient };
}

/**
 * The environment subsystem. Create one instance, call `erect()` to build
 * every group from the active era's payload, then register it with the
 * SceneRegistry (erect() does this automatically).
 */
export class EnvironmentSubsystem implements EraScopedSubsystem {
  readonly groupId = ENVIRONMENT_GROUP_ID;
  /** Root group added to the primary scene. */
  readonly group = new Group();
  /** Fog owned by this subsystem; the scene must be configured to use it. */
  readonly fog = new Fog(0x444444, 8, 60);
  /** Current color grade (uniform-driven; renderer can plug into it). */
  grade: ColorGradeState = buildColorGrade('neutral');

  private readonly scene: Scene;
  private readonly eras = new Map<EraId, EraEnvironment>();
  private skyGroup: Group | undefined;
  private lights: { sun: DirectionalLight; hemisphere: HemisphereLight; ambient: AmbientLight } | undefined;
  private streetlightRig: Group | undefined;
  private groundGroup: Group | undefined;
  private particles: ParticleLayer | undefined;
  private roadTexture: ProceduralSurfaceTexture | undefined;
  private currentEra: EraId = '1945';
  private disposed = false;

  constructor(scene: Scene) {
    this.scene = scene;
    this.group.name = 'environment';
  }

  /** Builds and stores the era's environment payload. */
  build(era: EraId): EraEnvironment {
    const env = getEnvironmentForEra(era);
    this.eras.set(era, env);
    return env;
  }

  /**
   * Erects the subsystem: builds all groups from the active era's payload,
   * configures the scene's fog and background, and registers the subsystem.
   * Safe to call multiple times (rebuilds in place).
   */
  erect(activeEra: EraId = '1945'): void {
    const env = this.build(activeEra);
    this.currentEra = activeEra;
    this.clearGroup();

    // Sky + fog.
    const skyState = skyStateFor(env);
    this.skyGroup = buildSkyGroup(skyState, SKY_DOME_RADIUS);
    this.group.add(this.skyGroup);
    this.fog.color.setRGB(skyState.fogColor.r, skyState.fogColor.g, skyState.fogColor.b);
    this.fog.near = skyState.fogStart;
    this.fog.far = skyState.fogEnd;

    // Ground, road, sidewalks, curbs.
    const ground = buildGroundGroup();
    this.groundGroup = ground.group;
    this.roadTexture = ground.roadTexture;
    this.group.add(this.groundGroup);

    // Streetlights.
    this.streetlightRig = buildStreetlightRig(lightStateFor(activeEra, env), LAMP_COUNT);
    this.group.add(this.streetlightRig);

    // Lights.
    this.lights = buildLights(env);
    this.group.add(this.lights.sun);
    this.group.add(this.lights.hemisphere);
    this.group.add(this.lights.ambient);

    // Particles.
    this.particles = buildParticleLayer(particleStateFor(env), {
      x: ROAD_OUTER_X + 2,
      z: ROAD_OUTER_Z + 2,
    });
    this.group.add(this.particles.points);

    // Grade.
    this.grade = gradeStateFor(env);

    // Paint the era's lane markings onto the road canvas.
    paintLaneMarkings(this.roadTexture, LANE_STYLE_BY_ERA[activeEra]);

    this.applyToScene(env);
    register(this);
  }

  /** Applies the environment to the scene (fog, background, sky, lights). */
  private applyToScene(env: EraEnvironment): void {
    this.scene.fog = this.fog;
    this.scene.background = new Color().setRGB(env.skyColor.r, env.skyColor.g, env.skyColor.b);
    if (this.skyGroup) {
      applySkyState(this.skyGroup, skyStateFor(env), this.fog);
    }
    if (this.lights) {
      this.lights.sun.color.setRGB(env.sun.color.r, env.sun.color.g, env.sun.color.b);
      this.lights.sun.intensity = env.sun.intensity;
      this.lights.sun.position.copy(sunDirection(env.sun.elevationDeg, env.sun.azimuthDeg).multiplyScalar(18));
      this.lights.ambient.intensity = env.ambientIntensity;
    }
    if (this.streetlightRig) {
      applyLightState(this.streetlightRig, lightStateFor(this.currentEra, env));
    }
    if (this.particles) {
      applyParticleState(this.particles, particleStateFor(env));
    }
  }

  /**
   * Blends the subsystem from one era's state to another at progress `t`
   * (0 = from, 1 = to). Lerps fog, sky colors, streetlight intensity+color,
   * color grading uniforms, and cross-fades particle opacity.
   */
  applyEraBlend(fromEra: EraId, toEra: EraId, t: number): void {
    const from = this.eras.get(fromEra) ?? getEnvironmentForEra(fromEra);
    const to = this.eras.get(toEra) ?? getEnvironmentForEra(toEra);
    const k = clamp(t, 0, 1);

    // Fog + sky.
    if (this.skyGroup) {
      applySkyBlend(this.skyGroup, skyStateFor(from), skyStateFor(to), k, this.fog);
    }

    // Streetlights.
    if (this.streetlightRig) {
      applyLightBlend(this.streetlightRig, lightStateFor(fromEra, from), lightStateFor(toEra, to), k);
    }

    // Color grading.
    this.grade = lerpColorGrade(gradeStateFor(from), gradeStateFor(to), k);

    // Particles cross-fade.
    if (this.particles) {
      applyParticleBlend(this.particles, particleStateFor(from), particleStateFor(to), k);
    }

    // Scene background + sun light follow the blend.
    this.scene.background = new Color().lerpColors(
      new Color().setRGB(from.skyColor.r, from.skyColor.g, from.skyColor.b),
      new Color().setRGB(to.skyColor.r, to.skyColor.g, to.skyColor.b),
      k,
    );
    if (this.lights) {
      this.lights.sun.color.lerpColors(
        new Color().setRGB(from.sun.color.r, from.sun.color.g, from.sun.color.b),
        new Color().setRGB(to.sun.color.r, to.sun.color.g, to.sun.color.b),
        k,
      );
      this.lights.sun.intensity = MathUtils.lerp(from.sun.intensity, to.sun.intensity, k);
      this.lights.ambient.intensity = MathUtils.lerp(from.ambientIntensity, to.ambientIntensity, k);
    }

    // Repaint lane markings at the midpoint so the road surface swaps once.
    if (this.roadTexture && k >= 0.5 && this.currentEra !== toEra) {
      paintLaneMarkings(this.roadTexture, LANE_STYLE_BY_ERA[toEra]);
      this.currentEra = toEra;
    }
  }

  /** Advances per-frame animation (particle drift). */
  update(deltaSec: number): void {
    if (this.particles) {
      updateParticleLayer(this.particles, deltaSec, { x: ROAD_OUTER_X + 2, z: ROAD_OUTER_Z + 2 });
    }
  }

  /**
   * Applies the era to the subsystem without a transition (used by the
   * composition root when the active era changes instantly).
   */
  setEra(era: EraId): void {
    const env = this.build(era);
    this.currentEra = era;
    this.applyToScene(env);
  }

  /** Releases GPU/CPU resources. */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.particles) {
      disposeParticleLayer(this.particles);
    }
    this.clearGroup();
    this.eras.clear();
  }

  /** Removes every child of the root group and disposes its materials. */
  private clearGroup(): void {
    for (const child of [...this.group.children]) {
      this.group.remove(child);
      this.disposeObject(child);
    }
  }

  /** Disposes an object's geometry and material (recursively for groups). */
  private disposeObject(object: unknown): void {
    if (!object || typeof object !== 'object') {
      return;
    }
    const obj = object as { children?: unknown[]; geometry?: { dispose(): void }; material?: unknown };
    if (obj.children) {
      for (const child of obj.children) {
        this.disposeObject(child);
      }
    }
    if (obj.geometry) {
      obj.geometry.dispose();
    }
    if (obj.material) {
      const material = obj.material as { dispose(): void } | Array<{ dispose(): void }>;
      if (Array.isArray(material)) {
        for (const m of material) m.dispose();
      } else {
        material.dispose();
      }
    }
  }
}

/** Creates and erects the environment subsystem, returning the instance. */
export function createEnvironmentSubsystem(scene: Scene, activeEra: EraId = '1945'): EnvironmentSubsystem {
  const subsystem = new EnvironmentSubsystem(scene);
  subsystem.erect(activeEra);
  return subsystem;
}

/** Shared singleton for the composition root. */
let environmentSubsystem: EnvironmentSubsystem | undefined;

/** Returns the shared environment subsystem, creating it if needed. */
export function getEnvironmentSubsystem(scene: Scene, activeEra: EraId = '1945'): EnvironmentSubsystem {
  if (!environmentSubsystem) {
    environmentSubsystem = createEnvironmentSubsystem(scene, activeEra);
  }
  return environmentSubsystem;
}

/** Releases the shared singleton (tests / HMR). */
export function resetEnvironmentSubsystem(): void {
  environmentSubsystem?.dispose();
  environmentSubsystem = undefined;
}

/** Applies a color grade to an RGB value (pure helper for tests). */
export function gradeColor(grade: ColorGradeState, rgb: RgbColor): { r: number; g: number; b: number } {
  return applyColorGrade(grade, rgb);
}