import * as THREE from 'three';
import {
  createAIOpponents,
  createDefaultTrack,
  buildTrackGeometry,
  sampleTrackAtDistance,
  findClosestTrackDistance,
  normalizeAngle,
  createPrng,
  DEFAULT_RIVAL_PROFILES,
  DEFAULT_RUBBER_BANDING,
} from '../src/game/ai';
import type { TrackData, CarState } from '../src/game/contracts';

// Mock Three.js for Jest CJS environment without native ESM support for 'three'
jest.mock('three', () => {
  class Vector3 {
    x: number;
    y: number;
    z: number;

    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }

    copy(v: Vector3): this {
      this.x = v.x;
      this.y = v.y;
      this.z = v.z;
      return this;
    }

    set(x: number, y: number, z: number): this {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }

    clone(): Vector3 {
      return new Vector3(this.x, this.y, this.z);
    }

    add(v: Vector3): this {
      this.x += v.x;
      this.y += v.y;
      this.z += v.z;
      return this;
    }

    distanceTo(v: Vector3): number {
      const dx = this.x - v.x;
      const dy = this.y - v.y;
      const dz = this.z - v.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    length(): number {
      return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }
  }

  class Object3D {
    name = '';
    position = new Vector3();
    rotation = { x: 0, y: 0, z: 0 };
    children: Object3D[] = [];
    parent: Object3D | null = null;
    isMesh = false;

    add(...children: Object3D[]): this {
      for (const child of children) {
        child.parent = this;
        this.children.push(child);
      }
      return this;
    }

    remove(...children: Object3D[]): this {
      for (const child of children) {
        const idx = this.children.indexOf(child);
        if (idx !== -1) {
          child.parent = null;
          this.children.splice(idx, 1);
        }
      }
      return this;
    }

    traverse(callback: (child: Object3D) => void): void {
      callback(this);
      for (const child of this.children) {
        child.traverse(callback);
      }
    }
  }

  class Group extends Object3D {}

  class Mesh extends Object3D {
    geometry: { dispose: () => void };
    material: { dispose: () => void } | { dispose: () => void }[];
    isMesh = true;

    constructor(
      geometry = { dispose: () => {} },
      material: { dispose: () => void } | { dispose: () => void }[] = { dispose: () => {} },
    ) {
      super();
      this.geometry = geometry;
      this.material = material;
    }
  }

  class BoxGeometry {
    dispose = jest.fn();
  }

  class CylinderGeometry {
    dispose = jest.fn();
  }

  class MeshStandardMaterial {
    dispose = jest.fn();
    color: unknown;
    constructor(params?: unknown) {
      this.color = params;
    }
  }

  class MeshBasicMaterial {
    dispose = jest.fn();
    color: unknown;
    constructor(params?: unknown) {
      this.color = params;
    }
  }

  class Color {
    constructor(public hex: number = 0) {}
  }

  return {
    Vector3,
    Object3D,
    Group,
    Mesh,
    BoxGeometry,
    CylinderGeometry,
    MeshStandardMaterial,
    MeshBasicMaterial,
    Color,
  };
});

/** Helper to construct a synthetic circular test track. */
function createSyntheticTestTrack(radius = 100, pointCount = 64): TrackData {
  const waypoints: THREE.Vector3[] = [];
  for (let i = 0; i < pointCount; i++) {
    const angle = (i / pointCount) * Math.PI * 2;
    waypoints.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  return {
    startLine: {
      position: new THREE.Vector3(radius, 0, 0),
      heading: Math.PI / 2, // Heading in +Z direction
    },
    waypoints,
    checkpoints: [
      new THREE.Vector3(radius, 0, 0),
      new THREE.Vector3(0, 0, radius),
      new THREE.Vector3(-radius, 0, 0),
      new THREE.Vector3(0, 0, -radius),
    ],
    closed: true,
    width: 14,
  };
}

describe('AI Opponents Module', () => {
  const DT = 1 / 60;

  describe('Contract and Spawning', () => {
    it('exposes default rival profiles and rubber banding configs', () => {
      expect(DEFAULT_RIVAL_PROFILES).toHaveLength(3);
      expect(DEFAULT_RUBBER_BANDING.enabled).toBe(true);
      expect(DEFAULT_RUBBER_BANDING.minSpeedFactor).toBeLessThan(1.0);
      expect(DEFAULT_RUBBER_BANDING.maxSpeedFactor).toBeGreaterThan(1.0);
    });

    it('spawns 3 rival cars with distinct neon paint and handles', () => {
      const track = createSyntheticTestTrack();
      const ai = createAIOpponents(track);

      expect(ai.rivals).toHaveLength(3);
      expect(ai.group).toBeDefined();
      expect(ai.group.children.length).toBe(3);

      const colors = ai.rivals.map((r) => r.colorHex);
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(3);
      expect(colors).toContain('#ff007f'); // Blaze (Magenta)
      expect(colors).toContain('#00f0ff'); // Apex (Cyan)
      expect(colors).toContain('#ffb700'); // Viper (Amber)

      for (const rival of ai.rivals) {
        // CarState conformance
        expect(rival.state).toBeDefined();
        expect(rival.state.position).toBeInstanceOf(THREE.Vector3);
        expect(typeof rival.state.heading).toBe('number');
        expect(typeof rival.state.speed).toBe('number');
        expect(typeof rival.state.driftFactor).toBe('number');
        expect(typeof rival.state.nitrousCharge).toBe('number');
        expect(typeof rival.state.boostActive).toBe('boolean');
        expect(typeof rival.state.lap).toBe('number');
        expect(typeof rival.state.trackProgress).toBe('number');

        // AIState conformance
        expect(rival.aiState).toBeDefined();
        expect(typeof rival.aiState.aggression).toBe('number');
        expect(rival.aiState.aggression).toBeGreaterThanOrEqual(0);
        expect(rival.aiState.aggression).toBeLessThanOrEqual(1);
        expect(typeof rival.aiState.targetWaypoint).toBe('number');
        expect(typeof rival.aiState.steeringError).toBe('number');

        // CarHandle mesh conformance
        expect(rival.mesh).toBeDefined();
      }
    });

    it('positions rivals on a staggered starting grid with lateral lane offsets', () => {
      const track = createSyntheticTestTrack();
      const ai = createAIOpponents(track);

      const [r1, r2, r3] = ai.rivals;
      expect(r1.profile.laneOffset).toBe(-2.0); // Left lane
      expect(r2.profile.laneOffset).toBe(2.0);  // Right lane
      expect(r3.profile.laneOffset).toBe(0.0);  // Center lane

      // Verify staggered starting positions do not stack on top of each other
      const pos1 = r1.state.position;
      const pos2 = r2.state.position;
      const pos3 = r3.state.position;

      expect(pos1.distanceTo(pos2)).toBeGreaterThan(2.0);
      expect(pos2.distanceTo(pos3)).toBeGreaterThan(2.0);
      expect(pos1.distanceTo(pos3)).toBeGreaterThan(2.0);
    });
  });

  describe('Racing-Line Following and Pure Pursuit', () => {
    it('keeps rivals near the racing line respecting their lane offsets', () => {
      const track = createSyntheticTestTrack(100, 64);
      const geom = buildTrackGeometry(track);
      const ai = createAIOpponents(track, {
        rubberBanding: { enabled: false },
        seed: 100,
      });

      // Simulate 500 steps (~8.3 seconds)
      for (let step = 0; step < 500; step++) {
        ai.update(DT);
      }

      for (const rival of ai.rivals) {
        // Car should have moved significantly
        expect(rival.state.speed).toBeGreaterThan(15);

        // Find distance to track centerline
        const closest = findClosestTrackDistance(geom, rival.state.position);

        // Lateral distance to centerline should stay close to expected lane offset
        const expectedOffset = Math.abs(rival.profile.laneOffset);
        // On a circular track of radius 100, radius with offset is 98..102 -> distance to 100 is ~2m
        expect(closest.lateralError).toBeLessThan(track.width / 2);
        // Stays within bounded distance of lane offset (within 2.5m tolerance from lane target)
        expect(Math.abs(closest.lateralError - expectedOffset)).toBeLessThan(2.5);

        // Target waypoint index is valid
        expect(rival.aiState.targetWaypoint).toBeGreaterThanOrEqual(0);
        expect(rival.aiState.targetWaypoint).toBeLessThan(track.waypoints.length);

        // Mesh matches car state
        expect(rival.mesh.position.x).toBeCloseTo(rival.state.position.x, 2);
        expect(rival.mesh.position.z).toBeCloseTo(rival.state.position.z, 2);
        expect(rival.mesh.rotation.y).toBeCloseTo(rival.state.heading, 2);
      }
    });
  });

  describe('Monotonic Progress and Lap Completion', () => {
    it('advances trackProgress and lap monotonically forward', () => {
      const track = createSyntheticTestTrack(80, 64);
      const ai = createAIOpponents(track, {
        rubberBanding: { enabled: false },
        seed: 777,
      });

      let prevLaps = ai.rivals.map((r) => r.state.lap);

      // Simulate 1200 steps (20 seconds)
      for (let step = 0; step < 1200; step++) {
        ai.update(DT);

        for (let i = 0; i < ai.rivals.length; i++) {
          const rival = ai.rivals[i];
          const lap = rival.state.lap;
          const progress = rival.state.trackProgress;

          // Lap must be >= 1 and monotonically non-decreasing
          expect(lap).toBeGreaterThanOrEqual(prevLaps[i]);
          prevLaps[i] = lap;

          // Progress is strictly in [0, 1)
          expect(progress).toBeGreaterThanOrEqual(0);
          expect(progress).toBeLessThan(1.0);
        }
      }
    });

    it('rivals complete a lap within expected time window on a synthetic track', () => {
      const radius = 80;
      const track = createSyntheticTestTrack(radius, 64);
      const ai = createAIOpponents(track, {
        rubberBanding: { enabled: false },
        seed: 42,
      });

      let lap1CompletionTimes: (number | null)[] = [null, null, null];
      let elapsedTime = 0;

      // Simulate up to 40 seconds (2400 steps)
      for (let step = 0; step < 2400; step++) {
        ai.update(DT);
        elapsedTime += DT;

        for (let i = 0; i < ai.rivals.length; i++) {
          if (lap1CompletionTimes[i] === null && ai.rivals[i].state.lap >= 2) {
            lap1CompletionTimes[i] = elapsedTime;
          }
        }

        if (lap1CompletionTimes.every((t) => t !== null)) {
          break;
        }
      }

      // All 3 rivals must have completed lap 1
      for (let i = 0; i < 3; i++) {
        const time = lap1CompletionTimes[i];
        expect(time).not.toBeNull();
        // For ~502m track and speeds 30-38 m/s with starting acceleration:
        // Expected lap completion time window is between 12 and 26 seconds
        expect(time!).toBeGreaterThan(12.0);
        expect(time!).toBeLessThan(26.0);
      }
    });
  });

  describe('Pace Profiles Differentiation', () => {
    it('creates distinct top-speed and acceleration behavior among rivals', () => {
      const track = createSyntheticTestTrack(200, 64);
      const ai = createAIOpponents(track, {
        rubberBanding: { enabled: false },
        seed: 42,
      });

      const [blaze, apex, viper] = ai.rivals;

      // Initial profiles
      expect(blaze.profile.topSpeed).toBe(38);
      expect(apex.profile.topSpeed).toBe(35);
      expect(viper.profile.topSpeed).toBe(32);

      expect(blaze.profile.acceleration).toBe(12);
      expect(apex.profile.acceleration).toBe(14);
      expect(viper.profile.acceleration).toBe(10);

      // Run straight-ish acceleration for 3 seconds (180 ticks)
      for (let step = 0; step < 180; step++) {
        ai.update(DT);
      }

      // Apex has highest initial acceleration (14), Blaze has highest top speed (38)
      // Both should be faster than Viper (topSpeed 32, accel 10)
      expect(blaze.state.speed).toBeGreaterThan(viper.state.speed);
      expect(apex.state.speed).toBeGreaterThan(viper.state.speed);

      // Run until top speeds stabilize (~15 seconds)
      for (let step = 0; step < 720; step++) {
        ai.update(DT);
      }

      // Blaze should have higher max speed on large radius track than Viper
      expect(blaze.state.speed).toBeGreaterThan(viper.state.speed + 3.0);
    });
  });

  describe('Rubber-Banding Bounds', () => {
    it('nudges rival pace upward when player is ahead, bounded by maxSpeedFactor', () => {
      const track = createSyntheticTestTrack(100, 64);
      const ai = createAIOpponents(track, {
        rubberBanding: {
          enabled: true,
          minSpeedFactor: 0.8,
          maxSpeedFactor: 1.25,
          catchUpDistance: 50,
          leadDistance: 50,
        },
        seed: 42,
      });

      const rival = ai.rivals[0]; // Blaze, base topSpeed 38

      // Player is far ahead (lap 2, progress 0.5)
      const mockPlayer: CarState = {
        position: new THREE.Vector3(0, 0, 100),
        heading: 0,
        speed: 40,
        driftFactor: 0,
        nitrousCharge: 1,
        boostActive: false,
        lap: 2,
        trackProgress: 0.5,
      };

      // Advance for 10 seconds with player ahead
      for (let step = 0; step < 600; step++) {
        ai.update(DT, { track, player: mockPlayer });
      }

      // Blaze's speed should boost above base topSpeed (38), but never exceed 38 * 1.25 = 47.5
      expect(rival.state.speed).toBeGreaterThan(38.0);
      expect(rival.state.speed).toBeLessThanOrEqual(38.0 * 1.25 + 0.5);
    });

    it('slows rival pace when player is far behind, bounded by minSpeedFactor', () => {
      const track = createSyntheticTestTrack(100, 64);
      const ai = createAIOpponents(track, {
        rubberBanding: {
          enabled: true,
          minSpeedFactor: 0.75,
          maxSpeedFactor: 1.25,
          catchUpDistance: 50,
          leadDistance: 50,
        },
        seed: 42,
      });

      const rival = ai.rivals[0]; // Blaze, base topSpeed 38

      // Player is far behind (lap 1, progress 0.0) while rival is advancing
      const mockPlayer: CarState = {
        position: new THREE.Vector3(100, 0, 0),
        heading: 0,
        speed: 10,
        driftFactor: 0,
        nitrousCharge: 1,
        boostActive: false,
        lap: 1,
        trackProgress: 0.0,
      };

      // Advance rival for 15 seconds
      for (let step = 0; step < 900; step++) {
        ai.update(DT, { track, player: mockPlayer });
      }

      // Rival should be slowed by rubber-banding down toward 38 * 0.75 = 28.5
      expect(rival.state.speed).toBeLessThan(38.0);
      expect(rival.state.speed).toBeGreaterThanOrEqual(38.0 * 0.75 * 0.6); // Considering cornering factor
    });

    it('respects rubber-banding disabled option', () => {
      const track = createSyntheticTestTrack(100, 64);
      const ai = createAIOpponents(track, {
        rubberBanding: { enabled: false },
        seed: 42,
      });

      const mockPlayer: CarState = {
        position: new THREE.Vector3(0, 0, 100),
        heading: 0,
        speed: 40,
        driftFactor: 0,
        nitrousCharge: 1,
        boostActive: false,
        lap: 10,
        trackProgress: 0.9,
      };

      for (let step = 0; step < 600; step++) {
        ai.update(DT, { track, player: mockPlayer });
      }

      const blaze = ai.rivals[0];
      // When disabled, Blaze should not exceed base top speed 38
      expect(blaze.state.speed).toBeLessThanOrEqual(38.01);
    });
  });

  describe('Reset and Dispose Lifecycle', () => {
    it('resets rivals back to starting positions on reset()', () => {
      const track = createSyntheticTestTrack(100, 64);
      const ai = createAIOpponents(track);

      const initialPos0 = ai.rivals[0].state.position.clone();

      // Run for 300 steps
      for (let step = 0; step < 300; step++) {
        ai.update(DT);
      }

      expect(ai.rivals[0].state.position.distanceTo(initialPos0)).toBeGreaterThan(10);
      expect(ai.rivals[0].state.speed).toBeGreaterThan(10);

      // Reset
      ai.reset(track);

      expect(ai.rivals[0].state.speed).toBe(0);
      expect(ai.rivals[0].state.lap).toBe(1);
      expect(ai.rivals[0].state.position.x).toBeCloseTo(initialPos0.x, 1);
      expect(ai.rivals[0].state.position.z).toBeCloseTo(initialPos0.z, 1);
    });

    it('disposes cleanly and ceases updates', () => {
      const track = createSyntheticTestTrack(100, 64);
      const ai = createAIOpponents(track);

      expect(() => ai.dispose()).not.toThrow();
      expect(ai.group.children.length).toBe(0);

      const posBefore = ai.rivals[0]?.state.position.clone();
      ai.update(DT);
      // No updates occur when disposed
      if (posBefore) {
        expect(ai.rivals[0].state.position.x).toBe(posBefore.x);
      }
    });
  });

  describe('Deterministic Seeded Behavior', () => {
    it('produces identical trajectories with the same seed', () => {
      const track = createSyntheticTestTrack(100, 64);
      const ai1 = createAIOpponents(track, { seed: 12345 });
      const ai2 = createAIOpponents(track, { seed: 12345 });

      for (let step = 0; step < 300; step++) {
        ai1.update(DT);
        ai2.update(DT);
      }

      for (let i = 0; i < 3; i++) {
        expect(ai1.rivals[i].state.position.x).toBeCloseTo(ai2.rivals[i].state.position.x, 4);
        expect(ai1.rivals[i].state.position.z).toBeCloseTo(ai2.rivals[i].state.position.z, 4);
        expect(ai1.rivals[i].state.heading).toBeCloseTo(ai2.rivals[i].state.heading, 4);
        expect(ai1.rivals[i].state.speed).toBeCloseTo(ai2.rivals[i].state.speed, 4);
      }
    });
  });

  describe('Track Geometry & Math Utilities', () => {
    it('normalizeAngle clamps angles into [-PI, PI]', () => {
      expect(normalizeAngle(0)).toBeCloseTo(0);
      expect(normalizeAngle(Math.PI)).toBeCloseTo(Math.PI);
      expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
      expect(normalizeAngle(-3 * Math.PI)).toBeCloseTo(-Math.PI);
      expect(normalizeAngle(Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    });

    it('createPrng produces consistent pseudo-random values', () => {
      const rng1 = createPrng(99);
      const rng2 = createPrng(99);
      for (let i = 0; i < 20; i++) {
        expect(rng1()).toBe(rng2());
      }
    });

    it('buildTrackGeometry calculates valid segment lengths and cumulative distances', () => {
      const track = createDefaultTrack();
      const geom = buildTrackGeometry(track);
      expect(geom.totalLength).toBeGreaterThan(100);
      expect(geom.segmentLengths.length).toBe(track.waypoints.length);
      expect(geom.cumulativeDistances[0]).toBe(0);
    });

    it('sampleTrackAtDistance samples points along the track with lane offset', () => {
      const track = createSyntheticTestTrack(100, 32);
      const geom = buildTrackGeometry(track);
      const sampleCenter = sampleTrackAtDistance(geom, 50, 0);
      const sampleLeft = sampleTrackAtDistance(geom, 50, -2);
      const sampleRight = sampleTrackAtDistance(geom, 50, 2);

      expect(sampleCenter.position).toBeDefined();
      expect(sampleLeft.position.distanceTo(sampleCenter.position)).toBeCloseTo(2.0, 1);
      expect(sampleRight.position.distanceTo(sampleCenter.position)).toBeCloseTo(2.0, 1);
    });
  });
});
