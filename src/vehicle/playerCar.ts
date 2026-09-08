/**
 * Player car composer.
 *
 * Owns the mutable per-frame state (body + nitrous) and updates the animated
 * three.js mesh so the whole thing moves as one unit. This is the single place
 * the integration task wires the arrow-key input (from `../input/keyboard`)
 * into a drivable car.
 *
 * Lifecycle contract (consumed by integration-polish):
 *   `instantiate(options)` -> build body + nitrous + mesh group
 *   `update(dt, input)`    -> advance physics, nitrous, and mesh by `dt`
 *   `dispose()`            -> free the mesh group geometry/materials
 *
 * The pure simulation lives in `physics.ts` and `nitrous.ts` (jest-tested);
 * this module is the thin mutable binding layer.
 */

import * as THREE from 'three';

import type { InputState } from '../shared/types';
import {
  applyThrottle,
  defaultPhysics,
  detectDrift,
  steerByYaw,
  type ArcadePhysics,
} from './physics';
import { createCarMesh, type CarMeshOptions } from './carMesh';
import {
  consumeNitrous,
  createNitrous,
  defaultNitrous,
  type NitrousCharge,
  type NitrousTuning,
} from './nitrous';

/** Configuration for building a player car. */
export interface PlayerCarOptions extends CarMeshOptions {
  /** Override the arcade handling profile (rare; pollutes nothing shared). */
  readonly physics?: Readonly<ArcadePhysics>;
  /** Override the nitrous tune (rare; pollutes nothing shared). */
  readonly nitrous?: Readonly<NitrousTuning>;
  /** Spawn position (x, z) and heading on the track start line. */
  readonly spawn?: { x: number; z: number; yaw: number };
}

/** A fully composed, drivable player car. */
export interface PlayerCar {
  /** The animatable three.js car group (add to the scene to display). */
  readonly body: THREE.Group;
  /** Mutable kinematic state (x, z, yaw, speed, drift). */
  readonly state: {
    x: number;
    z: number;
    yaw: number;
    speed: number;
    drifting: boolean;
    slide: number;
  };
  /** Mutable nitrous state (charge, boosting, flame intensity). */
  readonly nitrous: NitrousCharge;
  /** Per-frame speed multiplier applied by nitrous while boosting (>=1). */
  readonly speedMultiplier: number;
  /** Advance the car by `dt` with the given input. */
  update(dt: number, input: InputState): void;
  /** Release mesh resources. */
  dispose(): void;
}

/**
 * Instantiate a player car and its animated mesh. Does NOT attach to the
 * scene — caller (integration) is responsible for `scene.add(player.body)`.
 */
export function createPlayerCar(
  options: PlayerCarOptions = {},
): PlayerCar {
  const physics = options.physics ?? defaultPhysics;
  const nitrous = options.nitrous ?? defaultNitrous;
  const spawn = options.spawn ?? { x: 0, z: 0, yaw: 0 };

  const body = createCarMesh(options);
  body.position.set(spawn.x, 0, spawn.z);
  body.rotation.y = spawn.yaw;

  const state = {
    x: spawn.x,
    z: spawn.z,
    yaw: spawn.yaw,
    speed: 0,
    drifting: false,
    slide: 0,
  };

  const nic: NitrousCharge = createNitrous();
  let speedMultiplier = 1;

  const update = (dt: number, input: InputState): void => {
    // 1) Throttle / brake / drag -> new forward speed.
    const speed = applyThrottle(
      state.speed,
      input.throttle,
      input.brake,
      dt,
      physics,
    );
    // 2) Speed-dependent steering.
    const yaw = steerByYaw(state.yaw, input.steer, speed, dt, physics);
    // 3) Grip / drift detection (feeds nitrous charging).
    const { drifting, slide } = detectDrift(input.steer, speed, physics);

    // 4) Integrate position along the heading (speed sign handles reverse).
    state.x += Math.sin(yaw) * speed * dt;
    state.z += Math.cos(yaw) * speed * dt;

    state.speed = speed;
    state.yaw = yaw;
    state.drifting = drifting;
    state.slide = slide;

    // 5) Nitrous: accumulate drift charge, then consume on trigger.
    nic.charge += Math.max(0, slide) * nitrous.chargeRate * dt;
    const next = consumeNitrous(nic, input.nitrous, dt, nitrous);
    nic.charge = next.charge;
    nic.boosting = next.boosting;
    nic.boostProgress = next.boostProgress;
    nic.exhaustFlame = next.exhaustFlame;
    nic.boostMultiplier = next.boostMultiplier;
    nic.ready = next.ready;
    speedMultiplier = next.boosting ? nitrous.boostMultiplier : 1;

    // 6) Push the pose onto the mesh.
    body.position.set(state.x, 0, state.z);
    body.rotation.y = state.yaw;
  };

  /** Release geometry + materials owned by the car mesh. */
  const dispose = (): void => {
    body.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else if (mesh.material) {
        mesh.material.dispose();
      }
    });
  };

  return { body, state, nitrous: nic, speedMultiplier, update, dispose };
}