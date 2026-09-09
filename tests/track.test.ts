/**
 * Unit tests for the night circuit track module:
 * - Closed-loop waypoint continuity (adjacent step tolerance, last-to-first closure)
 * - Checkpoint ordering and count
 * - Wet reflective asphalt material properties (roughness, metalness, envMap)
 * - Emissive neon signs in magenta, cyan, and purple
 * - Street lamps along the circuit
 * - Dark skyline backdrop and city buildings
 * - Distance fog configuration
 * - Dispose lifecycle cleanup
 */
import * as THREE from 'three';

import { buildTrack } from '../src/game/track';

describe('Night Circuit Track Module (src/game/track.ts)', () => {
  let trackHandle: ReturnType<typeof buildTrack>;

  beforeEach(() => {
    trackHandle = buildTrack();
  });

  afterEach(() => {
    trackHandle.dispose();
  });

  describe('TrackData & Closed-Loop Waypoints', () => {
    it('provides dense closed-loop waypoints with continuous adjacent spacing', () => {
      const { waypoints, closed, width } = trackHandle.data;

      expect(closed).toBe(true);
      expect(width).toBeGreaterThanOrEqual(10);
      expect(waypoints.length).toBeGreaterThanOrEqual(200);

      // Max allowable distance between adjacent waypoints (tolerance: 6.0 meters)
      const MAX_STEP_TOLERANCE = 6.0;
      const MIN_STEP_TOLERANCE = 0.5;

      for (let i = 0; i < waypoints.length; i++) {
        const current = waypoints[i];
        const next = waypoints[(i + 1) % waypoints.length];
        const dist = current.distanceTo(next);

        expect(dist).toBeGreaterThanOrEqual(MIN_STEP_TOLERANCE);
        expect(dist).toBeLessThanOrEqual(MAX_STEP_TOLERANCE);
        // Ground plane elevation stays close to y = 0
        expect(Math.abs(current.y)).toBeLessThan(0.1);
      }
    });

    it('connects the last waypoint back to the first waypoint within step tolerance', () => {
      const { waypoints } = trackHandle.data;
      const first = waypoints[0];
      const last = waypoints[waypoints.length - 1];
      const loopClosureDistance = last.distanceTo(first);

      // Closure step should match standard waypoint spacing (~4.5m)
      expect(loopClosureDistance).toBeLessThanOrEqual(6.0);
      expect(loopClosureDistance).toBeGreaterThan(1.0);
    });

    it('provides a valid startLine pose matching the first waypoint', () => {
      const { startLine, waypoints } = trackHandle.data;

      expect(startLine).toBeDefined();
      expect(startLine.position.distanceTo(waypoints[0])).toBeCloseTo(0, 4);
      expect(Number.isFinite(startLine.heading)).toBe(true);
      // Heading in [-PI, PI]
      expect(startLine.heading).toBeGreaterThanOrEqual(-Math.PI);
      expect(startLine.heading).toBeLessThanOrEqual(Math.PI);
    });

    it('provides ordered checkpoints starting at the start line with at least 3 checkpoints', () => {
      const { checkpoints, startLine, waypoints } = trackHandle.data;

      expect(checkpoints.length).toBeGreaterThanOrEqual(3);
      expect(checkpoints.length).toBeGreaterThanOrEqual(8);

      // First checkpoint is at the start line
      expect(checkpoints[0].distanceTo(startLine.position)).toBeCloseTo(0, 4);

      // Verify checkpoints are strictly ordered along the racing line
      const wpIndices: number[] = [];
      for (const cp of checkpoints) {
        let closestIdx = -1;
        let minDist = Infinity;
        for (let i = 0; i < waypoints.length; i++) {
          const d = cp.distanceTo(waypoints[i]);
          if (d < minDist) {
            minDist = d;
            closestIdx = i;
          }
        }
        expect(minDist).toBeCloseTo(0, 2);
        wpIndices.push(closestIdx);
      }

      // Waypoint index corresponding to each checkpoint must increase monotonically
      for (let i = 1; i < wpIndices.length; i++) {
        expect(wpIndices[i]).toBeGreaterThan(wpIndices[i - 1]);
      }
    });
  });

  describe('Wet Reflective Asphalt Material', () => {
    it('asphalt material is tuned for wet ground reflections (low roughness, metalness, envMap)', () => {
      const { asphaltMaterial, envMap } = trackHandle;

      expect(asphaltMaterial).toBeDefined();
      expect(asphaltMaterial).toBeInstanceOf(THREE.MeshStandardMaterial);

      // Wet asphalt is glossy (roughness <= 0.2)
      expect(asphaltMaterial.roughness).toBeLessThanOrEqual(0.2);
      // Tuned metalness for rain-slick specular reflection
      expect(asphaltMaterial.metalness).toBeGreaterThanOrEqual(0.2);
      // High envMapIntensity for visible neon reflections
      expect(asphaltMaterial.envMapIntensity).toBeGreaterThanOrEqual(1.5);
      // Env-map assigned
      expect(asphaltMaterial.envMap).toBe(envMap);
      // Dark asphalt tone
      const hsl = { h: 0, s: 0, l: 0 };
      asphaltMaterial.color.getHSL(hsl);
      expect(hsl.l).toBeLessThan(0.2); // Dark tarmac
    });

    it('environment map is a valid equirectangular reflection texture', () => {
      const { envMap } = trackHandle;

      expect(envMap).toBeDefined();
      expect(envMap.mapping).toBe(THREE.EquirectangularReflectionMapping);
      expect(envMap.image.width).toBeGreaterThanOrEqual(64);
      expect(envMap.image.height).toBeGreaterThanOrEqual(32);
    });

    it('scene group contains road mesh and lane markings', () => {
      const { group } = trackHandle;

      const roadMesh = group.getObjectByName('WetAsphaltRoad');
      expect(roadMesh).toBeDefined();
      expect(roadMesh).toBeInstanceOf(THREE.Mesh);

      const centerDashes = group.getObjectByName('CenterLineDashes');
      expect(centerDashes).toBeDefined();

      const edgeLines = group.getObjectByName('EdgeLines');
      expect(edgeLines).toBeDefined();

      const startFinish = group.getObjectByName('StartFinishCheckeredLine');
      expect(startFinish).toBeDefined();
    });
  });

  describe('Emissive Neon Signs (Magenta, Cyan, Purple)', () => {
    it('contains at least 8 emissive neon signs along the circuit', () => {
      const { signs } = trackHandle;
      expect(signs.length).toBeGreaterThanOrEqual(8);
      expect(signs.length).toBeGreaterThanOrEqual(12);
    });

    it('neon signs feature magenta, cyan, and purple emissive materials with high intensity', () => {
      const { group } = trackHandle;

      const emissiveColors: THREE.Color[] = [];
      let foundHighIntensityEmissive = false;

      group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat && mat.emissive && (mat.emissive.r > 0 || mat.emissive.g > 0 || mat.emissive.b > 0)) {
            emissiveColors.push(mat.emissive);
            if (mat.emissiveIntensity && mat.emissiveIntensity >= 2.0) {
              foundHighIntensityEmissive = true;
            }
          }
        }
      });

      expect(emissiveColors.length).toBeGreaterThanOrEqual(8);
      expect(foundHighIntensityEmissive).toBe(true);

      // Check for presence of Magenta (high R + high B, low G)
      const hasMagenta = emissiveColors.some(
        (c) => c.r > 0.7 && c.b > 0.4 && c.g < 0.3,
      );
      // Check for presence of Cyan (high G + high B, low R)
      const hasCyan = emissiveColors.some(
        (c) => c.b > 0.8 && c.g > 0.8 && c.r < 0.2,
      );
      // Check for presence of Purple / Violet (high B, moderate/high R, low G)
      const hasPurple = emissiveColors.some(
        (c) => c.b > 0.8 && c.r > 0.4 && c.r < 0.85 && c.g < 0.2,
      );

      expect(hasMagenta).toBe(true);
      expect(hasCyan).toBe(true);
      expect(hasPurple).toBe(true);
    });

    it('neon signs have dedicated point lights illuminating surroundings', () => {
      const { lights } = trackHandle;
      const pointLights = lights.filter((l) => l instanceof THREE.PointLight);

      expect(pointLights.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe('Street Lamps & Skyline Backdrop', () => {
    it('contains street lamps along the circuit', () => {
      const { lamps } = trackHandle;
      expect(lamps.length).toBeGreaterThanOrEqual(8);
      expect(lamps.length).toBeGreaterThanOrEqual(20);
    });

    it('contains dark skyline backdrop buildings surrounding the track', () => {
      const { buildings, data } = trackHandle;
      expect(buildings.length).toBeGreaterThanOrEqual(20);
      expect(buildings.length).toBeGreaterThanOrEqual(50);

      // Ensure no building is placed on top of the track waypoints (clearance test)
      for (const building of buildings) {
        const bPos = building.position;
        for (let i = 0; i < data.waypoints.length; i += 5) {
          const wp = data.waypoints[i];
          const distXZ = Math.hypot(bPos.x - wp.x, bPos.z - wp.z);
          expect(distXZ).toBeGreaterThanOrEqual(14.0);
        }
      }
    });

    it('configures dark distance fog for night atmosphere depth', () => {
      const { fog } = trackHandle;
      expect(fog).toBeDefined();
      expect(fog).toBeInstanceOf(THREE.FogExp2);
      expect(fog.density).toBeGreaterThan(0.001);
      expect(fog.density).toBeLessThan(0.02);

      // Fog color is dark night tone
      const fogHsl = { h: 0, s: 0, l: 0 };
      fog.color.getHSL(fogHsl);
      expect(fogHsl.l).toBeLessThan(0.15);
    });
  });

  describe('Lifecycle & Dispose', () => {
    it('TrackHandle.dispose() disposes geometries, materials, textures, and clears group', () => {
      const handle = buildTrack();
      const geomDisposed = jest.fn();
      const matDisposed = jest.fn();

      // Spy on dispose methods
      handle.group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.addEventListener('dispose', geomDisposed);
        }
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.addEventListener('dispose', matDisposed));
          } else {
            mesh.material.addEventListener('dispose', matDisposed);
          }
        }
      });

      expect(handle.group.children.length).toBeGreaterThan(0);

      // Execute dispose
      handle.dispose();

      expect(geomDisposed).toHaveBeenCalled();
      expect(matDisposed).toHaveBeenCalled();
      expect(handle.group.children.length).toBe(0);

      // Second dispose call is a safe no-op
      expect(() => handle.dispose()).not.toThrow();
    });
  });
});
