import * as THREE from 'three';
import {
  createPlayerCar,
  DEFAULT_CAR_CONFIG,
  CAR_PHYSICS_CONFIG,
  type CarConfig,
  type PlayerCarHandle,
} from '../src/game/car';
import type { InputState, TrackData } from '../src/game/contracts';

// The `three` package ships ESM (three.module.js) that Jest's CJS runtime
// cannot require on Node 22 without custom transforms. Shim THREE classes
// for pure Node unit test execution — realistic module behavior is covered
// by the Vite/THREE build and browser runtime.
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
    set(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
    copy(v: { x: number; y: number; z: number }) {
      this.x = v.x;
      this.y = v.y;
      this.z = v.z;
      return this;
    }
    clone() {
      return new Vector3(this.x, this.y, this.z);
    }
  }

  class Euler {
    x = 0;
    y = 0;
    z = 0;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  }

  class Color {
    hex: number;
    constructor(hex = 0) {
      this.hex = typeof hex === 'number' ? hex : 0;
    }
    getHex() {
      return this.hex;
    }
  }

  class Object3D {
    position = new Vector3();
    rotation = new Euler();
    name = '';
    children: Object3D[] = [];
    add(...objs: Object3D[]) {
      this.children.push(...objs);
      return this;
    }
    traverse(callback: (child: Object3D) => void) {
      callback(this);
      for (const child of this.children) {
        child.traverse(callback);
      }
    }
    getObjectByName(name: string): Object3D | undefined {
      if (this.name === name) return this;
      for (const child of this.children) {
        const found = child.getObjectByName(name);
        if (found) return found;
      }
      return undefined;
    }
  }

  class Group extends Object3D {}

  class Mesh extends Object3D {
    geometry: { dispose?: () => void };
    material: { dispose?: () => void; color?: Color } | { dispose?: () => void }[];
    constructor(geometry?: any, material?: any) {
      super();
      this.geometry = geometry ?? { dispose: jest.fn() };
      this.material = material ?? { dispose: jest.fn() };
    }
  }

  class BoxGeometry {
    dispose = jest.fn();
    constructor(public width = 1, public height = 1, public depth = 1) {}
  }

  class CylinderGeometry {
    dispose = jest.fn();
    constructor(
      public radiusTop = 1,
      public radiusBottom = 1,
      public height = 1,
      public radialSegments = 8,
    ) {}
    rotateZ(_angle: number) {
      return this;
    }
  }

  class MeshStandardMaterial {
    color: Color;
    dispose = jest.fn();
    constructor(params: any = {}) {
      this.color = new Color(params.color ?? 0xffffff);
    }
  }

  class MeshBasicMaterial {
    color: Color;
    dispose = jest.fn();
    constructor(params: any = {}) {
      this.color = new Color(params.color ?? 0xffffff);
    }
  }

  return {
    Vector3,
    Euler,
    Color,
    Object3D,
    Group,
    Mesh,
    BoxGeometry,
    CylinderGeometry,
    MeshStandardMaterial,
    MeshBasicMaterial,
  };
});

/** Helper to create an idle input state. */
function createEmptyInput(): InputState {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    nitrous: false,
  };
}

/** Helper to simulate N physics steps at a given fixed timestep dt. */
function stepSimulation(
  car: PlayerCarHandle,
  steps: number,
  input: InputState,
  dt: number = 1 / 60,
  track?: TrackData,
): void {
  for (let i = 0; i < steps; i++) {
    car.update(dt, input, track);
  }
}

/** Helper to create a synthetic rectangular / loop TrackData. */
function createSyntheticTrack(): TrackData {
  return {
    startLine: {
      position: new THREE.Vector3(0, 0, 0),
      heading: 0, // facing +Z
    },
    // Rectangle loop: (0,0) -> (0, 100) -> (50, 100) -> (50, 0) -> (0, 0)
    waypoints: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 100),
      new THREE.Vector3(50, 0, 100),
      new THREE.Vector3(50, 0, 0),
    ],
    checkpoints: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 100),
      new THREE.Vector3(50, 0, 100),
      new THREE.Vector3(50, 0, 0),
    ],
    closed: true,
    width: 15,
  };
}

describe('Player Car Module', () => {
  describe('Physics Tuning Config Export', () => {
    it('exports DEFAULT_CAR_CONFIG and CAR_PHYSICS_CONFIG with all required tuning parameters', () => {
      expect(DEFAULT_CAR_CONFIG).toBeDefined();
      expect(CAR_PHYSICS_CONFIG).toBe(DEFAULT_CAR_CONFIG);

      // Core tuning parameters
      expect(typeof DEFAULT_CAR_CONFIG.acceleration).toBe('number');
      expect(DEFAULT_CAR_CONFIG.acceleration).toBeGreaterThan(0);

      expect(typeof DEFAULT_CAR_CONFIG.braking).toBe('number');
      expect(DEFAULT_CAR_CONFIG.braking).toBeGreaterThan(0);

      expect(typeof DEFAULT_CAR_CONFIG.grip).toBe('number');
      expect(DEFAULT_CAR_CONFIG.grip).toBeGreaterThan(0);

      expect(typeof DEFAULT_CAR_CONFIG.driftGrip).toBe('number');
      expect(DEFAULT_CAR_CONFIG.driftGrip).toBeLessThan(DEFAULT_CAR_CONFIG.grip);

      expect(typeof DEFAULT_CAR_CONFIG.driftThreshold).toBe('number');
      expect(DEFAULT_CAR_CONFIG.driftThreshold).toBeGreaterThan(0);
      expect(DEFAULT_CAR_CONFIG.driftThreshold).toBeLessThan(1);

      expect(typeof DEFAULT_CAR_CONFIG.nitrousGainRate).toBe('number');
      expect(DEFAULT_CAR_CONFIG.nitrousGainRate).toBeGreaterThan(0);

      expect(typeof DEFAULT_CAR_CONFIG.nitrousConsumeRate).toBe('number');
      expect(DEFAULT_CAR_CONFIG.nitrousConsumeRate).toBeGreaterThan(0);

      expect(typeof DEFAULT_CAR_CONFIG.boostMultiplier).toBe('number');
      expect(DEFAULT_CAR_CONFIG.boostMultiplier).toBeGreaterThan(1);

      expect(typeof DEFAULT_CAR_CONFIG.maxSpeed).toBe('number');
      expect(typeof DEFAULT_CAR_CONFIG.boostMaxSpeed).toBe('number');
      expect(DEFAULT_CAR_CONFIG.boostMaxSpeed).toBeGreaterThan(DEFAULT_CAR_CONFIG.maxSpeed);

      expect(typeof DEFAULT_CAR_CONFIG.boostAcceleration).toBe('number');
      expect(DEFAULT_CAR_CONFIG.boostAcceleration).toBeGreaterThan(
        DEFAULT_CAR_CONFIG.acceleration,
      );
    });

    it('allows overriding tuning configuration per instance', () => {
      const customConfig: Partial<CarConfig> = {
        acceleration: 99.0,
        maxSpeed: 120.0,
      };
      const car = createPlayerCar({ config: customConfig });
      expect(car.config.acceleration).toBe(99.0);
      expect(car.config.maxSpeed).toBe(120.0);
      expect(car.config.braking).toBe(DEFAULT_CAR_CONFIG.braking);
      car.dispose();
    });
  });

  describe('CarHandle and CarState Structure', () => {
    it('returns a CarHandle conforming to the contracts specification', () => {
      const initialPos = new THREE.Vector3(10, 0, 20);
      const car = createPlayerCar({
        initialPose: { position: initialPos, heading: 0.5 },
      });

      // CarHandle requirements: state and mesh
      expect(car.state).toBeDefined();
      expect(car.mesh).toBeDefined();
      expect(car.mesh).toBeInstanceOf(THREE.Object3D);

      // CarState shape validation
      expect(car.state.position).toBeInstanceOf(THREE.Vector3);
      expect(car.state.position.x).toBeCloseTo(10);
      expect(car.state.position.z).toBeCloseTo(20);
      expect(car.state.heading).toBeCloseTo(0.5);
      expect(car.state.speed).toBe(0);
      expect(car.state.driftFactor).toBe(0);
      expect(car.state.nitrousCharge).toBe(0);
      expect(car.state.boostActive).toBe(false);
      expect(car.state.lap).toBe(1);
      expect(car.state.trackProgress).toBe(0);

      // Mesh synchronization
      expect(car.mesh.position.x).toBeCloseTo(10);
      expect(car.mesh.position.z).toBeCloseTo(20);
      expect(car.mesh.rotation.y).toBeCloseTo(0.5);

      car.dispose();
    });

    it('creates low-poly car mesh with glowing head/taillights and exhaust anchors', () => {
      const car = createPlayerCar();
      const mesh = car.mesh;

      // Check for named sub-objects
      const body = mesh.getObjectByName('car-body');
      const cabin = mesh.getObjectByName('car-cabin');
      const spoiler = mesh.getObjectByName('car-spoiler');
      const headlightL = mesh.getObjectByName('headlight-left');
      const headlightR = mesh.getObjectByName('headlight-right');
      const taillightL = mesh.getObjectByName('taillight-left');
      const taillightR = mesh.getObjectByName('taillight-right');
      const underglow = mesh.getObjectByName('car-underglow');
      const exhaustL = mesh.getObjectByName('exhaust-left');
      const exhaustR = mesh.getObjectByName('exhaust-right');

      expect(body).toBeDefined();
      expect(cabin).toBeDefined();
      expect(spoiler).toBeDefined();
      expect(headlightL).toBeDefined();
      expect(headlightR).toBeDefined();
      expect(taillightL).toBeDefined();
      expect(taillightR).toBeDefined();
      expect(underglow).toBeDefined();
      expect(exhaustL).toBeDefined();
      expect(exhaustR).toBeDefined();

      // Check materials on headlights and taillights
      if (headlightL instanceof THREE.Mesh) {
        expect((headlightL.material as any).color.getHex()).toBe(0x00ffff);
      }
      if (taillightL instanceof THREE.Mesh) {
        expect((taillightL.material as any).color.getHex()).toBe(0xff0055);
      }

      car.dispose();
    });

    it('reset() restores car pose and resets speed, drift, boost', () => {
      const car = createPlayerCar();
      const input = createEmptyInput();
      input.up = true;
      input.right = true;

      stepSimulation(car, 60, input);
      expect(car.state.speed).toBeGreaterThan(10);

      car.reset({ position: new THREE.Vector3(5, 0, 5), heading: 1.2 });
      expect(car.state.speed).toBe(0);
      expect(car.state.position.x).toBe(5);
      expect(car.state.position.z).toBe(5);
      expect(car.state.heading).toBe(1.2);
      expect(car.state.driftFactor).toBe(0);
      expect(car.state.boostActive).toBe(false);

      car.dispose();
    });
  });

  describe('Arrow-key Physics: Acceleration, Braking, and Reverse Curves', () => {
    it('accelerates forward along heading when ArrowUp is pressed', () => {
      const car = createPlayerCar({
        initialPose: { position: new THREE.Vector3(0, 0, 0), heading: 0 },
      });
      const input = createEmptyInput();
      input.up = true;

      // Step 60 frames (1 second)
      stepSimulation(car, 60, input, 1 / 60);

      // Speed should have increased by ~ acceleration * 1.0s
      expect(car.state.speed).toBeGreaterThan(20);
      expect(car.state.speed).toBeLessThanOrEqual(DEFAULT_CAR_CONFIG.maxSpeed);

      // Since heading is 0 (+Z forward), z position should advance forward
      expect(car.state.position.z).toBeGreaterThan(10);
      expect(car.state.position.x).toBeCloseTo(0, 1);

      // Continue accelerating to top speed
      stepSimulation(car, 180, input, 1 / 60);
      expect(car.state.speed).toBeCloseTo(DEFAULT_CAR_CONFIG.maxSpeed, 1);

      car.dispose();
    });

    it('brakes to 0 when ArrowDown is pressed while moving forward', () => {
      const car = createPlayerCar();
      const input = createEmptyInput();
      input.up = true;

      // Build up speed
      stepSimulation(car, 60, input, 1 / 60);
      const movingSpeed = car.state.speed;
      expect(movingSpeed).toBeGreaterThan(20);

      // Now apply brake (ArrowDown)
      input.up = false;
      input.down = true;

      // Brake for 30 frames (~0.5s)
      stepSimulation(car, 30, input, 1 / 60);
      expect(car.state.speed).toBeLessThan(movingSpeed);

      // Continue braking until stopped
      stepSimulation(car, 60, input, 1 / 60);
      // Since down was kept pressed, it will transition into reverse gear
      expect(car.state.speed).toBeLessThanOrEqual(0);

      car.dispose();
    });

    it('accelerates in reverse when ArrowDown is pressed from rest', () => {
      const car = createPlayerCar();
      const input = createEmptyInput();
      input.down = true;

      // From 0 speed, holding down reverses the car
      stepSimulation(car, 30, input, 1 / 60);
      expect(car.state.speed).toBeLessThan(0);

      // Continue reversing to top reverse speed
      stepSimulation(car, 120, input, 1 / 60);
      expect(car.state.speed).toBeGreaterThanOrEqual(-DEFAULT_CAR_CONFIG.maxReverseSpeed);
      expect(car.state.speed).toBeCloseTo(-DEFAULT_CAR_CONFIG.maxReverseSpeed, 0);

      // Position should move backwards (-Z)
      expect(car.state.position.z).toBeLessThan(0);

      car.dispose();
    });

    it('coasts to rest under drag when no keys are pressed', () => {
      const car = createPlayerCar();
      const input = createEmptyInput();
      input.up = true;

      // Build up speed
      stepSimulation(car, 30, input, 1 / 60);
      const initialSpeed = car.state.speed;
      expect(initialSpeed).toBeGreaterThan(10);

      // Release all throttle/brakes
      input.up = false;
      stepSimulation(car, 60, input, 1 / 60);
      expect(car.state.speed).toBeLessThan(initialSpeed);

      // Coast for several seconds until stopped
      stepSimulation(car, 300, input, 1 / 60);
      expect(car.state.speed).toBe(0);

      car.dispose();
    });
  });

  describe('Speed-Sensitive Steering Rate', () => {
    it('does not turn car heading when stationary (speed = 0)', () => {
      const car = createPlayerCar();
      const input = createEmptyInput();
      input.right = true;

      stepSimulation(car, 60, input, 1 / 60);

      // Stationary car cannot rotate in place
      expect(car.state.heading).toBe(0);
      expect(car.mesh.rotation.y).toBe(0);

      car.dispose();
    });

    it('steers left and right with correct sign at driving speeds', () => {
      const carRight = createPlayerCar();
      const carLeft = createPlayerCar();

      const inputRight = createEmptyInput();
      inputRight.up = true;
      inputRight.right = true;

      const inputLeft = createEmptyInput();
      inputLeft.up = true;
      inputLeft.left = true;

      stepSimulation(carRight, 30, inputRight, 1 / 60);
      stepSimulation(carLeft, 30, inputLeft, 1 / 60);

      // Right turn increases heading, left turn decreases heading
      expect(carRight.state.heading).toBeGreaterThan(0);
      expect(carLeft.state.heading).toBeLessThan(0);

      carRight.dispose();
      carLeft.dispose();
    });

    it('exhibits speed-sensitive steering rate (lower turn rate at very high speeds vs moderate speeds)', () => {
      // Car A at moderate speed (e.g. ~15 m/s)
      const carModerate = createPlayerCar();
      const inputModThrottle = createEmptyInput();
      inputModThrottle.up = true;
      stepSimulation(carModerate, 30, inputModThrottle, 1 / 60);
      const modSpeed = carModerate.state.speed;

      // Car B at high speed (~50 m/s)
      const carFast = createPlayerCar();
      const inputFastThrottle = createEmptyInput();
      inputFastThrottle.up = true;
      stepSimulation(carFast, 120, inputFastThrottle, 1 / 60);
      const fastSpeed = carFast.state.speed;
      expect(fastSpeed).toBeGreaterThan(modSpeed * 1.5);

      // Now apply 1 second of right steer to both with fixed throttle
      const inputSteer = createEmptyInput();
      inputSteer.right = true;

      const modHeadingBefore = carModerate.state.heading;
      carModerate.update(1 / 60, inputSteer);
      const modHeadingRate = Math.abs(carModerate.state.heading - modHeadingBefore);

      const fastHeadingBefore = carFast.state.heading;
      carFast.update(1 / 60, inputSteer);
      const fastHeadingRate = Math.abs(carFast.state.heading - fastHeadingBefore);

      // At fast speed, highSpeedSensitivity reduces steering rate for stability
      expect(fastHeadingRate).toBeLessThan(modHeadingRate);

      carModerate.dispose();
      carFast.dispose();
    });

    it('inverts steering direction when in reverse gear', () => {
      const car = createPlayerCar();
      const input = createEmptyInput();
      input.down = true; // Reverse
      stepSimulation(car, 30, input, 1 / 60);
      expect(car.state.speed).toBeLessThan(0);

      input.right = true;
      stepSimulation(car, 10, input, 1 / 60);

      // Turning wheel right while reversing turns heading in reverse kinematics
      expect(car.state.heading).toBeLessThan(0);

      car.dispose();
    });
  });

  describe('Drift Detection and Nitrous Charge Accumulation', () => {
    it('does not register drift or gain nitrous while driving in a straight line', () => {
      const car = createPlayerCar();
      const input = createEmptyInput();
      input.up = true;

      stepSimulation(car, 120, input, 1 / 60);

      expect(car.state.speed).toBeGreaterThan(30);
      expect(car.state.driftFactor).toBe(0);
      expect(car.state.nitrousCharge).toBe(0);

      car.dispose();
    });

    it('detects sustained lateral slip as drift and accumulates nitrous charge toward 1.0', () => {
      const car = createPlayerCar();
      const input = createEmptyInput();

      // First build up speed
      input.up = true;
      stepSimulation(car, 60, input, 1 / 60);
      expect(car.state.speed).toBeGreaterThan(25);

      // Now initiate hard continuous turn to induce lateral slip
      input.right = true;
      let maxDriftObserved = 0;

      // Simulate sustained drifting over 2-3 seconds
      for (let i = 0; i < 180; i++) {
        car.update(1 / 60, input);
        if (car.state.driftFactor > maxDriftObserved) {
          maxDriftObserved = car.state.driftFactor;
        }
      }

      // Drift should have triggered
      expect(maxDriftObserved).toBeGreaterThan(0.2);
      expect(car.state.driftFactor).toBeGreaterThanOrEqual(0);
      expect(car.state.driftFactor).toBeLessThanOrEqual(1);

      // Nitrous charge should have accumulated
      expect(car.state.nitrousCharge).toBeGreaterThan(0.1);
      expect(car.state.nitrousCharge).toBeLessThanOrEqual(1.0);

      // Continue drifting to verify clamp at 1.0
      for (let i = 0; i < 300; i++) {
        car.update(1 / 60, input);
      }
      expect(car.state.nitrousCharge).toBeCloseTo(1.0, 2);

      car.dispose();
    });

    it('recovers grip and decays driftFactor when steering is released', () => {
      const car = createPlayerCar();
      const input = createEmptyInput();
      input.up = true;
      input.right = true;

      // Build drift
      stepSimulation(car, 90, input, 1 / 60);
      expect(car.state.driftFactor).toBeGreaterThan(0);

      // Release steering, drive straight to allow grip to recover
      input.right = false;
      stepSimulation(car, 60, input, 1 / 60);

      // Grip recovers, driftFactor returns to 0
      expect(car.state.driftFactor).toBe(0);

      car.dispose();
    });
  });

  describe('Nitrous Boost: Surge, Acceleration, and Charge Consumption', () => {
    it('activates boost and consumes charge when Shift is pressed with charge > 0', () => {
      const car = createPlayerCar();
      // Give initial nitrous charge
      car.state.nitrousCharge = 0.8;

      const input = createEmptyInput();
      input.up = true;
      input.nitrous = true;

      stepSimulation(car, 30, input, 1 / 60); // 0.5 seconds

      expect(car.state.boostActive).toBe(true);
      // Nitrous should be consumed at ~ nitrousConsumeRate * 0.5s = 0.4 * 0.5 = 0.20
      expect(car.state.nitrousCharge).toBeLessThan(0.8);
      expect(car.state.nitrousCharge).toBeCloseTo(
        0.8 - DEFAULT_CAR_CONFIG.nitrousConsumeRate * 0.5,
        1,
      );

      car.dispose();
    });

    it('produces a measurable top-speed and acceleration surge compared to unboosted car', () => {
      const normalCar = createPlayerCar();
      const boostedCar = createPlayerCar();
      boostedCar.state.nitrousCharge = 1.0;

      const normalInput = createEmptyInput();
      normalInput.up = true;

      const boostInput = createEmptyInput();
      boostInput.up = true;
      boostInput.nitrous = true;

      // 1. Check acceleration difference over first 60 frames (1 second)
      stepSimulation(normalCar, 60, normalInput, 1 / 60);
      stepSimulation(boostedCar, 60, boostInput, 1 / 60);

      expect(boostedCar.state.speed).toBeGreaterThan(normalCar.state.speed * 1.1);

      // 2. Continue to top speeds
      boostedCar.state.nitrousCharge = 1.0; // keep full
      stepSimulation(normalCar, 180, normalInput, 1 / 60);
      stepSimulation(boostedCar, 180, boostInput, 1 / 60);

      expect(normalCar.state.speed).toBeCloseTo(DEFAULT_CAR_CONFIG.maxSpeed, 1);
      expect(boostedCar.state.speed).toBeGreaterThan(DEFAULT_CAR_CONFIG.maxSpeed);
      expect(boostedCar.state.speed).toBeCloseTo(DEFAULT_CAR_CONFIG.boostMaxSpeed, 1);

      normalCar.dispose();
      boostedCar.dispose();
    });

    it('deactivates boost when nitrousCharge depletes to 0 and bleeds speed back to maxSpeed', () => {
      const car = createPlayerCar();
      car.state.nitrousCharge = 0.05; // tiny charge

      const input = createEmptyInput();
      input.up = true;
      input.nitrous = true;

      // Run until charge is fully spent
      stepSimulation(car, 30, input, 1 / 60);

      expect(car.state.nitrousCharge).toBe(0);
      expect(car.state.boostActive).toBe(false);

      car.dispose();
    });

    it('does not activate boost if nitrousCharge is 0', () => {
      const car = createPlayerCar();
      expect(car.state.nitrousCharge).toBe(0);

      const input = createEmptyInput();
      input.up = true;
      input.nitrous = true;

      car.update(1 / 60, input);

      expect(car.state.boostActive).toBe(false);

      car.dispose();
    });
  });

  describe('Track Progress & Lap Counting along TrackData', () => {
    it('advances trackProgress monotonically forward along synthetic TrackData', () => {
      const track = createSyntheticTrack();
      const car = createPlayerCar({
        track,
        initialPose: { position: new THREE.Vector3(0, 0, 0), heading: 0 },
      });

      const input = createEmptyInput();
      input.up = true; // Drive straight forward along +Z from (0,0,0) to (0,0,100)

      let prevProgress = car.state.trackProgress;
      expect(prevProgress).toBeCloseTo(0, 2);

      for (let i = 0; i < 90; i++) {
        car.update(1 / 60, input);
        const currentProgress = car.state.trackProgress;
        expect(currentProgress).toBeGreaterThanOrEqual(prevProgress);
        expect(currentProgress).toBeLessThan(1.0);
        prevProgress = currentProgress;
      }

      // Total track length is 100 + 50 + 100 + 50 = 300
      // Driving forward for 1.5s yields trackProgress ~ 31m / 300m ~ 0.10
      expect(car.state.trackProgress).toBeGreaterThan(0.05);

      car.dispose();
    });

    it('increments lap counter when crossing the start/finish line forward', () => {
      const track = createSyntheticTrack();
      const car = createPlayerCar({ track });

      // Simulate car near the end of the lap: heading back to (0,0,0) along segment (50,0,0) -> (0,0,0)
      car.state.position.set(5, 0, 0); // ~98% around track
      car.state.heading = -Math.PI / 2; // Facing -X towards (0,0,0)
      car.update(1 / 60, createEmptyInput());

      const progressBeforeFinish = car.state.trackProgress;
      expect(progressBeforeFinish).toBeGreaterThan(0.9);
      expect(car.state.lap).toBe(1);

      // Now drive forward across finish line past (0,0,0) onto segment 0 (0,0,0) -> (0,0,100)
      car.state.position.set(0, 0, 5);
      car.update(1 / 60, createEmptyInput());

      expect(car.state.trackProgress).toBeLessThan(0.1);
      expect(car.state.lap).toBe(2);

      car.dispose();
    });
  });

  describe('Lifecycle and Disposal', () => {
    it('handles dispose cleanly without throwing and releases geometries', () => {
      const car = createPlayerCar();
      expect(() => car.dispose()).not.toThrow();

      // Subsequent updates should be inert
      const stateBefore = { ...car.state };
      const input = createEmptyInput();
      input.up = true;
      car.update(1 / 60, input);

      expect(car.state.speed).toBe(stateBefore.speed);
    });
  });
});
