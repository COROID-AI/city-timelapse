/**
 * Full-race composition integration test.
 *
 * Proves the complete neon racer composes every produced factory into one
 * connected simulation and that CarState / RaceState flow through the chase
 * camera, motion-blur FX, nitrous flames, race director, and HUD over a
 * simulated 3-lap race.
 *
 * The Jest environment is plain Node (no jsdom / WebGL), so GPU surfaces are
 * handled like the rest of the suite: the AfterimagePass is mocked and a
 * minimal DOM stub backs the HUD and keyboard layers. All game systems
 * (world, player, AI, camera, FX, director, HUD) are the real modules.
 */

import * as THREE from 'three';

import { createNeonCity } from '../../src/world/neonCity';
import { createPlayerCar } from '../../src/vehicle/playerCar';
import { attachKeyboardInput } from '../../src/input/keyboard';
import { createAIRacers, type AIRacers } from '../../src/ai/aiRacers';
import { createChaseCamera, type ChaseCamera } from '../../src/camera/chaseCamera';
import {
  createMotionBlurPass,
  defaultMotionBlurOptions,
  type MotionBlurPass,
} from '../../src/postfx/motionBlur';
import { createNitrousFlames, type NitrousFlames } from '../../src/fx/nitrousFlames';
import {
  createRaceDirector,
  COUNTDOWN_SECONDS,
  TOTAL_LAPS,
  type RaceDirector,
  type RaceEntrant,
} from '../../src/race/raceDirector';
import { createHud, type Hud } from '../../src/hud/hud';
import { QUALITY, resolveQuality, QUALITY_MODES } from '../../src/config';
import type { CarState, InputState, RaceState } from '../../src/shared/types';
import { createTrack } from '../../src/world/track';

// Stable entrant ids / counts shared with the composition entrypoint. Kept
// local so the Node test does not pull in the browser-only `src/main.ts`.
const PLAYER_ID = 'player';
const PLAYER_NAME = 'You';
const AI_COUNT = 3;

// --- Mock the GPU-backed AfterimagePass so motion blur is testable in Node ---
jest.mock('three/addons/postprocessing/AfterimagePass.js', () => {
  class MockAfterimagePass {
    private _damp: number;
    disposed = false;
    constructor(damp = 0.96) {
      this._damp = damp;
    }
    set damp(v: number) {
      this._damp = v;
    }
    get damp(): number {
      return this._damp;
    }
    dispose(): void {
      this.disposed = true;
    }
  }
  return { AfterimagePass: MockAfterimagePass };
});

// `three/examples/jsm/objects/Reflector.js` is ESM-only and cannot be required
// by ts-jest's CJS transform. Mock it with a minimal Mesh (mirrors the world
// tests) so the neon-city factory stays composition-testable in Node.
jest.mock('three/examples/jsm/objects/Reflector.js', () => {
  const real = jest.requireActual('three');
  return {
    Reflector: class extends (real.Mesh as typeof THREE.Mesh) {
      constructor(geometry: unknown, options: { color?: number } = {}) {
        super(
          geometry as THREE.BufferGeometry,
          new real.MeshBasicMaterial({ color: options.color ?? 0xffffff }),
        );
        (this.material as THREE.MeshBasicMaterial).transparent = true;
        (this.material as THREE.MeshBasicMaterial).opacity = 0.75;
      }
    },
  };
});

/** Minimal DOM element stub supporting everything the HUD touches. */
function makeEl(tag: string): Record<string, unknown> {
  const el: Record<string, unknown> = {
    tagName: tag,
    className: '',
    textContent: '',
    children: [] as unknown[],
    style: {} as Record<string, string>,
    dataset: {} as Record<string, string>,
    classList: { toggle() {}, add() {}, remove() {} },
    text: undefined,
  };
  el.appendChild = (c: unknown) => {
    (el.children as unknown[]).push(c);
    return c;
  };
  el.append = (head: unknown, ...rest: unknown[]) => {
    (el.children as unknown[]).push(head, ...rest);
  };
  el.remove = () => {};
  // Canvas elements used by the wet-road normal texture need a working 2D
  // context; give them a minimal one so `createRoad` can generate the rain
  // sheen diffuse in Node.
  if (tag === 'canvas') {
    el.width = 0;
    el.height = 0;
    el.getContext = () => ({
      createImageData(w: number, h: number) {
        return { data: new Uint8ClampedArray(w * h * 4) };
      },
      putImageData() {},
    });
  }
  return el;
}

/** Install a minimal DOM + window shim for the HUD / keyboard layers. */
function installDomShim(): {
  root: Record<string, unknown>;
  win: { listeners: Record<string, ((e: unknown) => void)[]> };
} {
  const root = makeEl('div');
  const win = {
    listeners: {} as Record<string, ((e: unknown) => void)[]>,
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      (win.listeners[type] ??= []).push(fn);
    },
    removeEventListener: (type: string, fn: (e: unknown) => void) => {
      win.listeners[type] = (win.listeners[type] ?? []).filter((f) => f !== fn);
    },
  };
  (globalThis as Record<string, unknown>).document = {
    createElement: (t: string) => makeEl(t),
    body: makeEl('body'),
  };
  (globalThis as Record<string, unknown>).window = win;
  return { root: root as HTMLElement, win };
}

/** Derive the player CarState from an on-track position (lap counted here). */
function playerCarFor(
  id: string,
  pos: THREE.Vector3,
  tangent: THREE.Vector3,
  lap: number,
  speed: number,
): CarState {
  return {
    id,
    position: [pos.x, 0, pos.z],
    yaw: Math.atan2(tangent.x, tangent.z),
    speed,
    lap,
    waypointIndex: 0,
  };
}

describe('full-race composition: world × player × AI × camera × FX × director × HUD', () => {
  const { root, win } = installDomShim();
  const track = createTrack();
  const PATH = track.path;

  // 1) World.
  const scene = new THREE.Scene();
  const world = createNeonCity(scene);
  expect(world.group).toBeInstanceOf(THREE.Group);
  expect(world.track.path.loop).toBe(true);

  // 2) Player car.
  const start = world.track.startLine;
  const yaw = Math.atan2(start.tangent.x, start.tangent.z);
  const player = createPlayerCar({
    spawn: { x: start.position.x, z: start.position.z, yaw },
  });
  scene.add(player.body);

  // 3) Keyboard input.
  const keyboard = attachKeyboardInput(win as unknown as Window);

  // 4) 3 AI rivals.
  const ai = createAIRacers(PATH, AI_COUNT);
  for (const racer of ai.racers) scene.add(racer.body);

  // 5) Chase camera bound to a real PerspectiveCamera.
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 2000);
  let boostIntensity = 0;
  const chase: ChaseCamera = createChaseCamera(camera, {
    getBoost: () => boostIntensity,
  });

  // 6) Motion blur pass.
  const blur: MotionBlurPass = createMotionBlurPass();

  // 7) Nitrous flames on the player's exhaust anchors.
  const anchorL = player.body.getObjectByName('exhaustLeft');
  const anchorR = player.body.getObjectByName('exhaustRight');
  const anchors = [anchorL, anchorR].filter(
    (a): a is THREE.Object3D => a !== null && a !== undefined,
  );
  const flames: NitrousFlames = createNitrousFlames(anchors, {
    maxParticles: QUALITY.flameParticles,
  });
  scene.add(flames.points);

  // 8) Race director over the shared grid.
  const entrants: RaceEntrant[] = [
    { id: PLAYER_ID, name: PLAYER_NAME },
    ...ai.racers.map((r) => ({ id: r.id, name: r.name })),
  ];
  const director: RaceDirector = createRaceDirector(PATH, entrants);

  // 9) HUD backed by the DOM shim.
  const hud: Hud = createHud(root as HTMLElement);

  const boost = () => boostIntensity;
  const scoreInput = (): InputState => ({ throttle: 0, steer: 0, brake: false, nitrous: false });

  it('inspects the quality scaler defaults', () => {
    expect(QUALITY.pixelRatioCap).toBeGreaterThanOrEqual(1);
    expect(typeof QUALITY.motionBlur).toBe('boolean');
    expect(QUALITY.flameParticles).toBeGreaterThanOrEqual(8);
    expect(QUALITY_MODES).toContain(resolveQuality('high').mode);
  });

  it('steps countdown → racing via the director', () => {
    const dt = 1 / 60;
    const playerCar = playerCarFor(PLAYER_ID, start.position, start.tangent, 0, 0);
    for (let i = 0; i < Math.ceil((COUNTDOWN_SECONDS + 0.5) / dt); i++) {
      director.update(dt, [playerCar, ...ai.racers.map((r) => ai.getState(r.index) as CarState)]);
      player.update(dt, scoreInput());
      ai.update(dt, { x: player.state.x, z: player.state.z, lap: 0 });
    }
    expect(director.getState().phase).toBe('racing');
  });

  it('runs a full 3-lap race with live standings, FX, camera, and HUD flowing', () => {
    const dt = 1 / 60;
    let lapT = 0;
    const stepsPerLap = 240;
    const totalFrames = stepsPerLap * TOTAL_LAPS + 30;
    let fovSeen = 60;
    let dampAtSpeed = defaultMotionBlurOptions.idleDamp;

    for (let f = 0; f < totalFrames; f++) {
      lapT += 1 / stepsPerLap;
      const t = lapT % 1;
      const pos = track.getPoint(t);
      const tangent = track.getTangent(t);
      const lap = Math.floor(lapT);

      // Drive the player mesh + state around the loop so camera/FX follow.
      player.body.position.set(pos.x, 0, pos.z);
      player.state.x = pos.x;
      player.state.z = pos.z;
      player.state.yaw = Math.atan2(tangent.x, tangent.z);
      player.state.speed = 55;

      // AI rubber-band to the simulated player.
      ai.update(dt, { x: pos.x, z: pos.z, lap });

      const playerCar = playerCarFor(PLAYER_ID, pos, tangent, lap, player.state.speed);
      const carStates: CarState[] = [
        playerCar,
        ...ai.racers.map((r) => ai.getState(r.index) as CarState),
      ];

      // Race director consumes all entrant states every frame.
      director.update(dt, carStates);

      // FX intensity: boost hard during the simulated final stretch.
      const boosting = f > totalFrames - 90;
      boostIntensity = boosting ? 1 : 0;

      // Chase camera follows the player (speed + boost FOV).
      chase.update(
        { position: [pos.x, 0, pos.z], yaw: playerCar.yaw, speed: playerCar.speed },
        dt,
      );
      fovSeen = Math.max(fovSeen, chase.getFov());

      // Motion blur scales with speed + boost.
      blur.update(playerCar.speed, boostIntensity, dt);
      dampAtSpeed = Math.min(dampAtSpeed, blur.getDamp());

      // Nitrous flames receive the player's boost intensity.
      flames.update({ active: boosting, intensity: boostIntensity }, anchors, dt);

      // HUD renders the same RaceState + player snapshot.
      hud.update(director.getState(), {
        car: playerCar,
        nitrous: {
          active: boosting,
          reserve: player.nitrous.charge,
          boost: 1.55,
          cooldown: 0,
        },
      });
    }

    const race: RaceState = director.getState();
    expect(race.phase).toBe('finished');
    expect(race.totalLaps).toBe(TOTAL_LAPS);
    expect(race.standings).toHaveLength(AI_COUNT + 1);

    // Player registered as the classified 3-lap finisher for its own standings row.
    const playerRow = race.standings.find((s) => s.carId === PLAYER_ID);
    expect(playerRow?.lap).toBe(TOTAL_LAPS);
    expect(race.lapTimes[PLAYER_ID]?.length).toBe(TOTAL_LAPS);

    // Wide-angle FOV packed in from the speed + boost chase profile.
    expect(fovSeen).toBeGreaterThan(60);

    // Motion blur trail strengthened (lower damp) at speed + boost.
    expect(dampAtSpeed).toBeLessThan(defaultMotionBlurOptions.idleDamp);
  });

  it('disposes every composed system without throwing', () => {
    expect(() => {
      player.dispose();
      ai.dispose();
      flames.dispose();
      blur.dispose();
      director.dispose();
      keyboard.dispose();
      hud.dispose();
      world.dispose();
    }).not.toThrow();
  });
});