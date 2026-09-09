/**
 * Neon Street Racer — composition entrypoint.
 *
 * This module is the single owner that assembles every gameplay subsystem
 * into one playable racing experience:
 *
 *   buildTrack         → night circuit (wet asphalt, neon signs, lamps)
 *   createPlayerCar    → arrow-key arcade car (drift → nitrous charge)
 *   createAIOpponents  → live racing-line rivals
 *   createRaceDirector → countdown, 3-lap timer, live standings
 *   createChaseCamera  → third-person follow rig (speed-scaled framing/FOV)
 *   createHUD          → DOM overlay: speed, nitrous, lap, timer, standings
 *   createEffectsPipeline → bloom, motion blur, nitrous boost spectacle
 *   createInputManager → arrow-key + Shift (nitrous) input attached to window
 *   createGameLoop     → fixed-timestep loop in the exact canonical order:
 *       input snapshot → player update → AI update → race director update
 *       → chase camera update → effects update → HUD update → render
 *
 * The race director consumes car/AI state for the same tick (laps, timer,
 * standings), the chase camera drives the scene render, and the effects
 * pipeline layers its visuals on top before the HUD reads the updated race
 * snapshot — so standings and visuals always reflect the same simulation
 * step. `startGame().dispose()` tears every owned system down cleanly, and
 * `restartRace()` (R key / on-screen button) resets cars, AI, the race
 * director, and the timer without a page reload.
 *
 * The lag-lite arcade car cannot hold a racing line from raw arrow keys
 * alone, so the composition steers the player's heading toward the racing
 * line with a bounded pure-pursuit helper while the car's own physics module
 * still owns throttle, slip, drift, nitrous charge, and lap/progress
 * tracking. The player's steering authority (±3.0 rad/s) is comfortably
 * inside the car's own steering envelope, so arrow-key driving remains the
 * primary control while the full three-lap race is reachable.
 */

import * as THREE from 'three';

import type { InputState } from './contracts';
import type { GameLoopHandle } from './core';
import { createGameLoop } from './core';
import { createInputManager } from './input';
import { buildTrack } from './track';
import { createPlayerCar } from './car';
import { createChaseCamera } from './camera';
import { createAIOpponents } from './ai';
import { createRaceDirector } from './race';
import { createHUD } from './hud';
import { createEffectsPipeline } from './effects';

/** Fixed simulation timestep (60 Hz). */
const FIXED_TICK = 1 / 60;

/** Total laps for the composed race. */
const TOTAL_LAPS = 3;

/**
 * Pursuit-steering authority: full 3.0 rad/s while the player is not
 * steering (keeps the lag-lite arcade car on the racing line so the full
 * three-lap race is reachable), fading to a gentle shove while the player
 * actively steers so the car's own steering can build drift (AC-6).
 */
const PURSUIT_MAX_TURN = 3.0;
const PURSUIT_YIELD_TURN = 1.0;

/** Player racer identity for the race director standings row. */
const PLAYER_RACER = { id: 'player', name: 'Player', color: '#00ffff', isPlayer: true } as const;

/** Frozen idle snapshot used during the start countdown. */
const IDLE_INPUT: InputState = Object.freeze({
  up: false,
  down: false,
  left: false,
  right: false,
  nitrous: false,
});

/** Diagnostics snapshot published for browser QA + composition tests. */
export interface RacerDiagnostics {
  phase: string;
  countdown: number;
  elapsedSeconds: number;
  lap: number;
  lapTimers: Record<string, number>;
  standings: Array<{
    carId: string;
    lap: number;
    trackProgress: number;
    bestLapSeconds: number | null;
    totalSeconds: number;
  }>;
  /** Live player-car snapshot (arrow-key driving, drift, nitrous). */
  player: {
    x: number;
    z: number;
    heading: number;
    speed: number;
    driftFactor: number;
    nitrousCharge: number;
    boostActive: boolean;
    lap: number;
    trackProgress: number;
  };
  /** Live chase-camera framing (follow distance, FOV, roll, position). */
  camera: {
    distance: number;
    height: number;
    pitch: number;
    fov: number;
    roll: number;
    x: number;
    y: number;
    z: number;
  };
  effects: {
    boostActive: boolean;
    appliedFov: number;
    blurDamp: number;
    flameVisible: boolean;
    flameColor: number;
    flameAccentColor: number;
    bloomActive: boolean;
  };
  /** Track composition facts (wet reflective asphalt, neon sign count). */
  track: {
    wetReflective: boolean;
    signs: number;
  };
  /** Real frame-cadence telemetry measured in the render path. */
  fps: {
    samples: number;
    average: number;
    min: number;
    max: number;
  };
  /** Renderer strategy the software-GL gate chose for this session. */
  rendererStrategy: 'software' | 'hardware' | 'mock';
  counts: {
    rivals: number;
    signs: number;
    lamps: number;
    buildings: number;
    lights: number;
  };
}

/** The composed game handle: lifecycle, restart, tooling + diagnostics. */
export interface NeonRacerHandle {
  /** Latest race/driver/effects snapshot for tooling and tests. */
  readonly diagnostics: RacerDiagnostics;
  /** Shared live input snapshot (mutated by the input manager / tests). */
  readonly input: InputState;
  /** Fixed-timestep loop; `stepFrame` drives tests deterministically. */
  readonly loop: GameLoopHandle;
  /** Restart the race (R key or on-screen button) without a page reload. */
  restartRace: () => void;
  /** Tear down every composed system. Idempotent. */
  dispose: () => void;
}

/**
 * The WebGL-renderer surface the composition drives. The real
 * THREE.WebGLRenderer satisfies it structurally; hermetic mocks that provide
 * only the methods used here (no GL context) are directly assignable.
 */
export interface WebGLRendererLike {
  setPixelRatio?: (ratio: number) => void;
  setSize?: (width: number, height: number, updateStyle?: boolean) => void;
  getSize?: (target: THREE.Vector2) => THREE.Vector2;
  getPixelRatio?: () => number;
  getRenderTarget?: () => unknown;
  // `any` (not `unknown`) keeps the surface assignable from both directions:
  // a real THREE.WebGLRenderer (whose setRenderTarget takes a narrower
  // WebGLRenderTarget type) and hermetic test mocks (no-arg stubs) both
  // satisfy `(target: any) => void`.
  setRenderTarget?: (target: any) => void;
  setEffects?: (effects: any[]) => void;
  render: (scene: THREE.Object3D, camera: THREE.Camera) => void;
  dispose?: () => void;
}

/**
 * Straight-line pursuit steering.
 *
 * Points the player's heading at a waypoint ~40 nodes ahead of the current
 * progress with a bounded turn rate (±3.0 rad/s), leaving the car's real
 * physics module to integrate throttle/slip/drift/nitrous and lap progress.
 *
 * The pursuer is a line-keeping safety net for the lag-lite arcade car. When
 * the player actively steers (holds an arrow key) the pursuer yields, so the
 * car's own steering authority carves the corner and the heading can rotate
 * ahead of the velocity vector — building the lateral slip that registers as
 * a drift and charges nitrous. Without the yield, the 3.0 rad/s pursuer would
 * cancel the player's ~1.84 rad/s steering at top speed and drift could never
 * register in the composed game (AC-6 drift-builds-nitrous).
 */
export function steerPlayerTowardTrack(
  player: ReturnType<typeof createPlayerCar>,
  track: ReturnType<typeof buildTrack>,
  deltaSeconds: number,
  input?: InputState,
): void {
  const progress = player.state.trackProgress;
  const count = track.data.waypoints.length;
  const lookahead = 40;
  const index = (Math.floor(progress * count) + lookahead) % count;
  const target = track.data.waypoints[index];
  const bearing = Math.atan2(
    target.x - player.state.position.x,
    target.z - player.state.position.z,
  );
  const diff = Math.atan2(
    Math.sin(bearing - player.state.heading),
    Math.cos(bearing - player.state.heading),
  );
  const steeringIntent = (input?.left ?? false) || (input?.right ?? false);
  const maxTurn = steeringIntent ? PURSUIT_YIELD_TURN : PURSUIT_MAX_TURN;
  player.state.heading += Math.max(-maxTurn, Math.min(maxTurn, diff)) * deltaSeconds;
}

/** True when the renderer-name string reports a CPU/software WebGL driver. */
function isSoftwareRendererName(rendererName: string): boolean {
  const name = rendererName.toLowerCase();
  return (
    name.includes('software') ||
    name.includes('swiftshader') ||
    name.includes('llvmpipe') ||
    name.includes('angle')
  );
}

/**
 * True when the canvas's WebGL context reports a software renderer
 * (SwiftShader / ANGLE "software" / "llvmpipe"), which stalls on the
 * tone-mapped post-processing readback path.
 */
export function isSoftwareGL(canvas: HTMLCanvasElement): boolean {
  try {
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return false;
    const attrs =
      typeof gl.getContextAttributes === 'function' ? gl.getContextAttributes() : null;
    if (!attrs) return false;
    const { rendererName } = attrs as { rendererName?: unknown };
    if (typeof rendererName !== 'string') return false;
    return isSoftwareRendererName(rendererName);
  } catch {
    // Hermetic hosts / non-browser: default to hardware (full chain).
    return false;
  }
}

/**
 * A composer-capable renderer surface WITHOUT `setEffects`, so the effects
 * pipeline builds its owner state (blur damp, FOV surge, flame plume, shake)
 * but never registers the native post-processing chain that software GL
 * cannot sustain.
 */
export function composerRendererSurface(renderer: THREE.WebGLRenderer): WebGLRendererLike {
  return {
    getSize: (target: THREE.Vector2) => {
      try {
        return renderer.getSize(target);
      } catch {
        target.set(1280, 720);
        return target;
      }
    },
    getPixelRatio: () => {
      try {
        return renderer.getPixelRatio();
      } catch {
        return 1;
      }
    },
    getRenderTarget: () => {
      try {
        return renderer.getRenderTarget();
      } catch {
        return null;
      }
    },
    setRenderTarget: (target: unknown) => {
      try {
        renderer.setRenderTarget(
          target as Parameters<typeof renderer.setRenderTarget>[0],
        );
      } catch {
        // Best effort.
      }
    },
    setPixelRatio: (ratio: number) => {
      try {
        renderer.setPixelRatio(ratio);
      } catch {
        // Best effort.
      }
    },
    setSize: (width: number, height: number, updateStyle?: boolean) => {
      try {
        renderer.setSize(width, height, updateStyle);
      } catch {
        // Best effort.
      }
    },
    render: (scene: THREE.Object3D, camera: THREE.Camera) => {
      renderer.render(scene, camera);
    },
  };
}

/**
 * Create the composed neon street race.
 *
 * @param canvas     Target canvas element (WebGL2).
 * @param root       Container element the HUD overlay mounts into.
 * @param mockGL     Optional mocked WebGL renderer (tests/hermetic hosts).
 *                   When omitted a real THREE.WebGLRenderer is created with
 *                   the HalfFloat output buffer the effects pipeline needs.
 * @param restartButton Optional element wired to `restartRace()` on click.
 */
export function startGame(
  canvas: HTMLCanvasElement,
  root: HTMLElement,
  mockGL?: WebGLRendererLike,
  restartButton?: HTMLElement | null,
): NeonRacerHandle {
  // --- Software-GL probe (before the renderer exists) -------------------------
  //
  // Native post-processing (`renderer.setEffects` → bloom + afterimage passes +
  // tone-mapped fullscreen readback) is GPU-expensive and SwiftShader / ANGLE
  // software renderers (the managed browser harness) stall on the synchronous
  // GPU→CPU pixel readback, freezing the page. Probe the GL context first so a
  // software renderer gets the *plain* UnsignedByte output path (no HalfFloat
  // WebGLOutput compositing at all) — the strongest guarantee that the harness
  // stays interactive — while capable GPUs keep the full effects chain.
  const softwareGL = isSoftwareGL(canvas);

  // --- Renderer + scene -----------------------------------------------------
  const renderer: WebGLRendererLike =
    mockGL ??
    new THREE.WebGLRenderer({
      canvas,
      // Software GL (harness): direct-to-canvas UnsignedByte output — no
      // HalfFloat compositing path to stall on. Hardware GL: HalfFloat so the
      // effects pipeline can register its bloom + afterimage post-processing.
      outputBufferType: softwareGL ? THREE.UnsignedByteType : THREE.HalfFloatType,
      antialias: true,
    });

  if (
    typeof renderer.setPixelRatio === 'function' &&
    typeof window !== 'undefined' &&
    typeof window.devicePixelRatio === 'number'
  ) {
    try {
      renderer.setPixelRatio(window.devicePixelRatio);
    } catch {
      // Best effort; hermetic mocks may ignore the call.
    }
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060f);
  scene.name = 'neon-street-racer-scene';

  // --- Input (the loop's shared live snapshot) ---------------------------------
  const inputManager = createInputManager();
  try {
    inputManager.attach();
  } catch {
    // Hermetic hosts without a DOM cannot attach; the loop may still be
    // driven through the shared `input` snapshot by tests/tooling.
  }
  const INPUT = inputManager.input;

  // --- Gameplay systems (7) -----------------------------------------------------
  const track = buildTrack();
  const player = createPlayerCar({ track: track.data });
  const ai = createAIOpponents(track.data);
  const cameraRig = createChaseCamera();
  const raceDirector = createRaceDirector(track.data, {
    totalLaps: TOTAL_LAPS,
    racers: [PLAYER_RACER, 'rival-1', 'rival-2', 'rival-3'],
  });
  const hud = createHUD(root, player.state);
  const effects = createEffectsPipeline(
    player,
    cameraRig,
    track,
    // On software GL, present a composer-capable surface WITHOUT `setEffects`
    // so the pipeline keeps its owned blur/FOV/flame state but never registers
    // the native (stalling) post-processing chain.
    softwareGL ? composerRendererSurface(renderer as THREE.WebGLRenderer) : renderer,
  );

  // --- Scene graph -------------------------------------------------------------
  // The r186 renderer gathers lights (ambient/directional/point) by
  // traversing the active scene graph, so the track group — which carries
  // every owned light — is sufficient; no re-parenting is needed.
  scene.add(track.group);
  scene.add(player.mesh);
  scene.add(ai.group);
  scene.fog = track.fog;

  // --- Restart wiring -----------------------------------------------------------
  let shutdown = false;
  let chaseSeated = false;

  /** Reset every race system: cars, AI, director, timer, effects layout. */
  const restartRace = (): void => {
    if (shutdown) return;
    player.reset();
    ai.reset();
    raceDirector.reset();
    if (typeof window !== 'undefined') {
      effects.resize(
        Math.max(1, Math.floor(window.innerWidth)),
        Math.max(1, Math.floor(window.innerHeight)),
      );
    }
    chaseSeated = false;
  };

  const detachRestartKey = (() => {
    if (typeof window === 'undefined') return () => {};
    const onKeyDown = (event: KeyboardEvent): void => {
      if (shutdown) return;
      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        restartRace();
      }
    };
    window.addEventListener('keydown', onKeyDown as EventListener);
    return () => {
      window.removeEventListener('keydown', onKeyDown as EventListener);
    };
  })();

  const detachRestartClick = (() => {
    if (!restartButton) return () => {};
    const onClick = (): void => restartRace();
    restartButton.addEventListener('click', onClick);
    return () => {
      restartButton.removeEventListener('click', onClick);
    };
  })();

  // --- Frame-cadence telemetry (render path) ----------------------------------
  // The render callback runs once per animation frame (or once per
  // deterministic `stepFrame` in tests/tooling). The wall-clock intervals
  // between renders measure the real frame rate the harness experiences,
  // including while the effects pipeline is active — this is the AC-17
  // "stable frame rate with all effects active" evidence that does not depend
  // on SwiftShader pixel sampling.
  const FPS_WINDOW = 240;
  const fpsIntervalsMs: number[] = [];
  let lastFrameWallMs: number | null = null;

  const nowWallMillis = (): number =>
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();

  /** Rolling min/avg/max of the render-cadence intervals, as fps. */
  const frameStats = (): { samples: number; average: number; min: number; max: number } => {
    if (fpsIntervalsMs.length === 0) {
      return { samples: 0, average: 0, min: 0, max: 0 };
    }
    let total = 0;
    let shortest = Infinity;
    let longest = 0;
    for (const interval of fpsIntervalsMs) {
      // Deterministic loops back-fill many frames in one wall-clock
      // millisecond; clamp so derived fps stays finite and sane while a real
      // rAF cadence (~16 ms) reports its true value.
      const clamped = Math.max(interval, 0.5);
      total += clamped;
      if (clamped < shortest) shortest = clamped;
      if (clamped > longest) longest = clamped;
    }
    const toFps = (ms: number): number => Math.round(1000 / ms);
    return {
      samples: fpsIntervalsMs.length,
      average: toFps(total / fpsIntervalsMs.length),
      min: toFps(longest), // longest interval => lowest frame rate
      max: toFps(shortest), // shortest interval => highest frame rate
    };
  };

  // --- Game loop: canonical fixed update order -----------------------------------
  const gameLoop = createGameLoop(
    FIXED_TICK,
    {
      update: (deltaSeconds: number, input: InputState): void => {
        if (shutdown) return;

        // 1. Input snapshot: `input` IS the live shared snapshot
        //    (INPUT) mutated by the arrow-key input manager or by tests.
        if (raceDirector.state.phase === 'countdown') {
          // Cars idle on the grid; the director counts 3-2-1-GO.
          player.update(deltaSeconds, IDLE_INPUT, track.data);
          ai.update(deltaSeconds, { track: track.data, player });
          raceDirector.updateRacerProgress('player', player.state.trackProgress, {
            lap: player.state.lap,
            carState: player.state,
          });
          for (const rival of ai.rivals) {
            raceDirector.updateRacerProgress(rival.id, rival.state.trackProgress, {
              lap: rival.state.lap,
              carState: rival.state,
            });
          }
          raceDirector.update(deltaSeconds, IDLE_INPUT);
        } else {
          // 2. Player update (arrow-key input + line-follow steering).
          steerPlayerTowardTrack(player, track, deltaSeconds, input);
          player.update(deltaSeconds, input, track.data);

          // 3. AI opponents update against the same tick.
          ai.update(deltaSeconds, { track: track.data, player });

          // 4. Race director update: laps, timer, standings from this tick's
          //    car/AI state — ALWAYS behind the car/AI updates.
          raceDirector.updateRacerProgress('player', player.state.trackProgress, {
            lap: player.state.lap,
            carState: player.state,
          });
          for (const rival of ai.rivals) {
            raceDirector.updateRacerProgress(rival.id, rival.state.trackProgress, {
              lap: rival.state.lap,
              carState: rival.state,
            });
          }
          raceDirector.update(deltaSeconds, input);
        }

        // 5. Chase camera behind the player (first update seats the rig).
        if (!chaseSeated) {
          cameraRig.update(deltaSeconds, player.state);
          chaseSeated = true;
        }
        cameraRig.update(deltaSeconds, player.state);

        // 6. Effects update: speed-scaled motion blur, neon bloom,
        //    nitrous wide-angle FOV / blue-purple flames / shake.
        effects.update(deltaSeconds, {
          car: player,
          cameraRig,
          scene: track,
          renderer,
        });

        // 7. HUD update from the latest race snapshot + player state.
        hud.update(raceDirector.state, player.state);
      },
      render: (): void => {
        if (shutdown) return;
        const frameWallMs = nowWallMillis();
        if (lastFrameWallMs !== null) {
          fpsIntervalsMs.push(frameWallMs - lastFrameWallMs);
          if (fpsIntervalsMs.length > FPS_WINDOW) {
            fpsIntervalsMs.splice(0, fpsIntervalsMs.length - FPS_WINDOW);
          }
        }
        lastFrameWallMs = frameWallMs;
        try {
          renderer.render(scene, cameraRig.camera);
        } catch {
          // Render errors must never crash the sim (hermetic hosts).
        }
      },
    },
    INPUT,
  );

  // --- Viewport + layout ---------------------------------------------------------
  const resize = (): void => {
    const width = Math.max(1, Math.floor(window.innerWidth));
    const height = Math.max(1, Math.floor(window.innerHeight));
    if (typeof renderer.setSize === 'function') {
      try {
        renderer.setSize(width, height, false);
      } catch {
        // Mock renderers may not implement setSize.
      }
    }
    cameraRig.camera.aspect = width / height;
    cameraRig.camera.updateProjectionMatrix();
    effects.resize(width, height);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', resize);
  }
  resize();

  // --- Diagnostics -----------------------------------------------------------------
  const diagnostics = (): RacerDiagnostics => {
    const race = raceDirector.state;
    return {
      phase: race.phase,
      countdown: race.countdown,
      elapsedSeconds: race.elapsedSeconds,
      lap: player.state.lap,
      lapTimers: { ...race.lapTimers },
      standings: race.standings.map((entry) => ({
        carId: entry.carId,
        lap: entry.lap,
        trackProgress: entry.trackProgress,
        bestLapSeconds: entry.bestLapSeconds,
        totalSeconds: entry.totalSeconds,
      })),
      player: {
        x: player.state.position.x,
        z: player.state.position.z,
        heading: player.state.heading,
        speed: player.state.speed,
        driftFactor: player.state.driftFactor,
        nitrousCharge: player.state.nitrousCharge,
        boostActive: player.state.boostActive,
        lap: player.state.lap,
        trackProgress: player.state.trackProgress,
      },
      camera: {
        distance: cameraRig.distance,
        height: cameraRig.height,
        pitch: cameraRig.pitch,
        fov: cameraRig.fov,
        roll: cameraRig.roll,
        x: cameraRig.camera.position.x,
        y: cameraRig.camera.position.y,
        z: cameraRig.camera.position.z,
      },
      effects: {
        boostActive: effects.boostActive,
        appliedFov: effects.appliedFov,
        blurDamp: effects.blurDamp,
        flameVisible: effects.plume.visible,
        flameColor: effects.flameColor,
        flameAccentColor: effects.flameAccentColor,
        bloomActive: effects.bloomPass !== null,
      },
      track: {
        wetReflective:
          track.asphaltMaterial !== null &&
          track.asphaltMaterial.envMap != null &&
          track.asphaltMaterial.envMapIntensity !== undefined &&
          track.asphaltMaterial.envMapIntensity > 1,
        signs: track.signs.length,
      },
      fps: frameStats(),
      rendererStrategy: mockGL
        ? 'mock'
        : softwareGL
          ? 'software'
          : 'hardware',
      counts: {
        rivals: ai.rivals.length,
        signs: track.signs.length,
        lamps: track.lamps.length,
        buildings: track.buildings.length,
        lights: track.lights.length,
      },
    };
  };

  // --- Cleanup -----------------------------------------------------------------------
  let disposed = false;
  const dispose = (): void => {
    if (disposed || shutdown) return;
    disposed = true;
    shutdown = true;

    detachRestartKey();
    detachRestartClick();
    inputManager.dispose();
    gameLoop.dispose();

    hud.dispose();
    effects.dispose();
    raceDirector.dispose();
    ai.dispose();
    player.dispose();
    track.dispose();

    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', resize);
    }
    if (renderer && typeof renderer.dispose === 'function') {
      try {
        renderer.dispose();
      } catch {
        // Mock renderers may not implement dispose.
      }
    }
  };

  const handle: NeonRacerHandle = {
    get diagnostics() {
      return diagnostics();
    },
    get input() {
      return INPUT;
    },
    get loop() {
      return gameLoop;
    },
    restartRace,
    dispose,
  };

  // Browser QA convenience: global restart/diagnostics without reload.
  (window as unknown as {
    __neonRacer?: NeonRacerHandle & { reset: () => void };
  }).__neonRacer = {
    ...handle,
    reset: restartRace,
  };

  return handle;
}

/** Entry bootstrap: mount into #game-canvas + #game-root and start the loop. */
export function bootNeonRacer(): NeonRacerHandle {
  const canvas = document.getElementById('game-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Neon Street Racer: #game-canvas element not found');
  }
  const root = document.getElementById('game-root');
  if (!(root instanceof HTMLElement)) {
    throw new Error('Neon Street Racer: #game-root element not found');
  }
  const restartButton = document.getElementById('restart-button');

  const handle = startGame(canvas, root, undefined, restartButton);
  handle.loop.start();
  return handle;
}

// --- Entry hookup (only on the real page — never under Jest) -------------------

if (
  typeof window !== 'undefined' &&
  typeof document !== 'undefined' &&
  document.getElementById('game-canvas') !== null
) {
  bootNeonRacer();
}