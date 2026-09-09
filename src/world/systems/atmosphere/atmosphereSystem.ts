/**
 * Unified atmosphere and lighting system for City Time Period Timelapse.
 *
 * Implements the `EraSystem` lifecycle contract:
 * - `attach(context)`: Builds and attaches the sky dome, street lamps,
 *   ambient instanced particle cloud, distance fog, and ambient/key light rigs.
 * - `update(channel, deltaSeconds)`: Continuously interpolates every atmospheric
 *   parameter (sky gradient, sun/key light, fog, street lamps, motes/particles,
 *   ACES exposure/grade) between eras.
 * - `dispose()`: Idempotently releases all geometries, materials, instances,
 *   and detaches from the parent scene.
 *
 * Consumes:
 * - `BlockLayout` from `src/world/layout/types.ts` (lamp anchors & bounds)
 * - `AtmosphereEraSpec` from `src/era/types.ts`
 * - `easeInOut` + `lerpNumber` + `lerpColor` from `src/era/transition.ts`
 *
 * Produced export:
 * - `createAtmosphereSystem(layout): AtmosphereEraSystem`
 */

import {
  BoxGeometry,
  FogExp2,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Vector3,
  type Object3D,
  type Scene,
  type WebGLRenderer,
} from 'three';
import type { EraSystem, TimelineChannel } from '../../../era/types';
import type { BlockLayout } from '../../layout/types';

import {
  atmosphereEraData,
  GOLDEN_HOUR_GRADE,
  type GradeSpec,
} from './atmosphereEraData';
import { interpolateEraAtmosphere, toThreeColor } from './interpolation';
import { createLampSystem, type LampEraSystem } from './lamps';
import { createSkySystem, type SkyEraSystem, type SunState } from './sky';

/** Maximum instanced particle count across all eras. */
export const MAX_PARTICLES = 160;

/** Bounding box where ambient particles drift over the city block. */
const PARTICLE_BOUNDS = {
  minX: -6,
  maxX: 36,
  minY: 0.2,
  maxY: 14.0,
  minZ: -14,
  maxZ: 24,
};

export interface ParticleState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
}

export interface AtmosphereContext {
  scene: (Scene & Object3D) | Object3D | undefined;
  renderer?: WebGLRenderer | undefined;
}

export interface AtmosphereEraSystem extends EraSystem<AtmosphereContext> {
  readonly rootGroup: Group | null;
  readonly skySystem: SkyEraSystem;
  readonly lampSystem: LampEraSystem;
  readonly grade: GradeSpec;
  readonly currentSun: SunState;
  readonly currentFogColor: number;
  readonly currentFogDensity: number;
  readonly currentAmbientColor: number;
  readonly currentAmbientIntensity: number;
  readonly currentHazeFactor: number;
  readonly activeParticleCount: number;
  readonly isAttached: boolean;
  readonly isDisposed: boolean;
}

/** Seeded deterministic particle positions & velocities */
function initParticles(count: number): ParticleState[] {
  const particles: ParticleState[] = [];
  const xSpan = PARTICLE_BOUNDS.maxX - PARTICLE_BOUNDS.minX;
  const ySpan = PARTICLE_BOUNDS.maxY - PARTICLE_BOUNDS.minY;
  const zSpan = PARTICLE_BOUNDS.maxZ - PARTICLE_BOUNDS.minZ;

  for (let i = 0; i < count; i += 1) {
    // Deterministic pseudo-random distribution
    const s1 = Math.sin(i * 12.9898 + 78.233);
    const s2 = Math.cos(i * 4.1414 + 13.371);
    const s3 = Math.sin(i * 93.939 + 42.424);

    const u = (s1 - Math.floor(s1));
    const v = (s2 - Math.floor(s2));
    const w = (s3 - Math.floor(s3));

    particles.push({
      x: PARTICLE_BOUNDS.minX + u * xSpan,
      y: PARTICLE_BOUNDS.minY + v * ySpan,
      z: PARTICLE_BOUNDS.minZ + w * zSpan,
      vx: (Math.sin(i * 1.5) * 0.4 + 0.3) * 0.5,
      vy: (Math.cos(i * 2.1) * 0.15 - 0.05) * 0.4,
      vz: (Math.sin(i * 3.3) * 0.3) * 0.5,
      size: 0.05,
    });
  }

  return particles;
}

export function createAtmosphereSystem(layout: BlockLayout): AtmosphereEraSystem {
  let rootGroup: Group | null = null;
  let attachedScene: Object3D | null = null;
  let fogInstance: FogExp2 | null = null;

  const skySystem = createSkySystem();
  const lampSystem = createLampSystem(layout);

  // Instanced ambient particles
  let particleMesh: InstancedMesh | null = null;
  let particleGeo: BoxGeometry | null = null;
  let particleMat: MeshBasicMaterial | null = null;
  const particles = initParticles(MAX_PARTICLES);
  const tempMatrix = new Matrix4();
  const tempScale = new Vector3();
  const zeroScale = new Vector3(0, 0, 0);

  // Current interpolated state values
  let currentFogColor = 0xcbd5e1;
  let currentFogDensity = 0.018;
  let currentAmbientColor = 0x78716c;
  let currentAmbientIntensity = 0.45;
  let currentHazeFactor = 0.75;
  let activeParticleCount = 110;

  let isAttached = false;
  let isDisposed = false;

  const system: AtmosphereEraSystem = {
    get rootGroup(): Group | null {
      return rootGroup;
    },

    get skySystem(): SkyEraSystem {
      return skySystem;
    },

    get lampSystem(): LampEraSystem {
      return lampSystem;
    },

    get grade(): GradeSpec {
      return GOLDEN_HOUR_GRADE;
    },

    get currentSun(): SunState {
      return skySystem.sun;
    },

    get currentFogColor(): number {
      return currentFogColor;
    },

    get currentFogDensity(): number {
      return currentFogDensity;
    },

    get currentAmbientColor(): number {
      return currentAmbientColor;
    },

    get currentAmbientIntensity(): number {
      return currentAmbientIntensity;
    },

    get currentHazeFactor(): number {
      return currentHazeFactor;
    },

    get activeParticleCount(): number {
      return activeParticleCount;
    },

    get isAttached(): boolean {
      return isAttached;
    },

    get isDisposed(): boolean {
      return isDisposed;
    },

    attach(context: AtmosphereContext): void {
      if (isDisposed || isAttached) return;

      rootGroup = new Group();
      rootGroup.name = 'world-atmosphere-system';

      // 1. Attach sky subsystem
      skySystem.attach({ scene: rootGroup });

      // 2. Attach street lamps subsystem
      lampSystem.attach({ scene: rootGroup });

      // 3. Build ambient particles instanced mesh
      particleGeo = new BoxGeometry(1, 1, 1);
      particleMat = new MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.65,
      });
      particleMesh = new InstancedMesh(particleGeo, particleMat, MAX_PARTICLES);
      particleMesh.name = 'atmosphere-particles';
      rootGroup.add(particleMesh);

      // 4. Attach to scene and setup fog if scene supports it
      if (context.scene) {
        attachedScene = context.scene;
        attachedScene.add(rootGroup);

        if ('fog' in attachedScene) {
          fogInstance = new FogExp2(currentFogColor, currentFogDensity);
          attachedScene.fog = fogInstance;
        }
      }

      isAttached = true;

      // Seed initial 1945 state
      this.update({ fromEra: '1945', toEra: '1945', t: 0 }, 0);
    },

    update(channel: TimelineChannel, deltaSeconds: number): void {
      if (isDisposed || !isAttached) return;

      const from = atmosphereEraData[channel.fromEra] ?? atmosphereEraData['1945'];
      const to = atmosphereEraData[channel.toEra] ?? atmosphereEraData['1945'];
      const spec = interpolateEraAtmosphere(from, to, channel.t);

      // 1. Update Subsystems
      skySystem.update(channel, deltaSeconds);
      lampSystem.update(channel, deltaSeconds);

      // 2. Update Fog
      const fogColorObj = toThreeColor(spec.fogColor);
      currentFogColor = fogColorObj.getHex();
      currentFogDensity = spec.fogDensity;

      if (fogInstance) {
        fogInstance.color.copy(fogColorObj);
        fogInstance.density = currentFogDensity;
      }

      // 3. Update Ambient Light values
      const ambientColorObj = toThreeColor(spec.ambientColor);
      currentAmbientColor = ambientColorObj.getHex();
      currentAmbientIntensity = spec.ambientIntensity;
      currentHazeFactor = spec.hazeFactor;

      // 4. Update Particle Cloud (counts, speeds, styles)
      const fromP = from.particles;
      const toP = to.particles;
      const count = Math.round(fromP.count + (toP.count - fromP.count) * channel.t);
      activeParticleCount = Math.max(0, Math.min(MAX_PARTICLES, count));

      const particleSize = fromP.size + (toP.size - fromP.size) * channel.t;
      const particleSpeed = fromP.speed + (toP.speed - fromP.speed) * channel.t;
      const pColorObj = toThreeColor(spec.fogColor).lerp(toThreeColor(fromP.color), 0.5);

      if (particleMesh) {
        const xSpan = PARTICLE_BOUNDS.maxX - PARTICLE_BOUNDS.minX;
        const ySpan = PARTICLE_BOUNDS.maxY - PARTICLE_BOUNDS.minY;
        const zSpan = PARTICLE_BOUNDS.maxZ - PARTICLE_BOUNDS.minZ;

        for (let i = 0; i < MAX_PARTICLES; i += 1) {
          if (i < activeParticleCount) {
            const p = particles[i];

            // Advance particle drift
            p.x += p.vx * particleSpeed * deltaSeconds;
            p.y += p.vy * particleSpeed * deltaSeconds;
            p.z += p.vz * particleSpeed * deltaSeconds;

            // Wrap within bounds
            if (p.x > PARTICLE_BOUNDS.maxX) p.x -= xSpan;
            if (p.x < PARTICLE_BOUNDS.minX) p.x += xSpan;
            if (p.y > PARTICLE_BOUNDS.maxY) p.y -= ySpan;
            if (p.y < PARTICLE_BOUNDS.minY) p.y += ySpan;
            if (p.z > PARTICLE_BOUNDS.maxZ) p.z -= zSpan;
            if (p.z < PARTICLE_BOUNDS.minZ) p.z += zSpan;

            tempMatrix.makeTranslation(p.x, p.y, p.z);
            tempScale.set(particleSize, particleSize, particleSize);
            tempMatrix.scale(tempScale);
            particleMesh.setMatrixAt(i, tempMatrix);
            particleMesh.setColorAt(i, pColorObj);
          } else {
            // Hide inactive particles below ground
            tempMatrix.makeTranslation(0, -100, 0);
            tempMatrix.scale(zeroScale);
            particleMesh.setMatrixAt(i, tempMatrix);
          }
        }

        particleMesh.instanceMatrix.needsUpdate = true;
        if (particleMesh.instanceColor) {
          particleMesh.instanceColor.needsUpdate = true;
        }
      }
    },

    dispose(): void {
      if (isDisposed) return;
      isDisposed = true;
      isAttached = false;

      // 1. Dispose subsystems
      skySystem.dispose();
      lampSystem.dispose();

      // 2. Dispose particles
      if (particleMesh) {
        if (particleMesh.parent) {
          particleMesh.parent.remove(particleMesh);
        }
        particleMesh.dispose();
        particleMesh = null;
      }
      if (particleGeo) {
        particleGeo.dispose();
        particleGeo = null;
      }
      if (particleMat) {
        particleMat.dispose();
        particleMat = null;
      }

      // 3. Detach fog
      if (attachedScene && 'fog' in attachedScene && attachedScene.fog === fogInstance) {
        attachedScene.fog = null;
      }
      fogInstance = null;

      // 4. Detach root group
      if (rootGroup?.parent) {
        rootGroup.parent.remove(rootGroup);
      }
      rootGroup = null;
      attachedScene = null;
    },
  };

  return system;
}