/**
 * Neon Racer — full game composition entrypoint.
 *
 * This module is the single composition owner for the complete playable game.
 * It wires every produced system into one frame loop and owns `src/config.ts`
 * as the sole quality scaler:
 *
 *   world        createNeonCity      (scene)        → visual stage + track
 *   player       createPlayerCar     (spawn)        → drivable car
 *   input        attachKeyboardInput (window)       → arrow keys + boost
 *   AI           createAIRacers      (track.path)   → 3 grid rivals
 *   camera       createChaseCamera   (camera)       → damped chase + FOV
 *   post FX      createPostFxComposer(renderer,...) → motion-blur trail
 *   flames       createNitrousFlames (exhaust)      → blue-purple boost FX
 *   director     createRaceDirector  (track, grid)  → countdown/3-lap/standings
 *   HUD          createHud           (host)         → live overlay + results
 *
 * CarState / NitrousState / RaceState flow through camera, FX, director, and
 * HUD every frame. `restart()` (R key or on-screen button) tears down and
 * rebuilds the mutable race session so cars, race state, and timers reset
 * without leaking listeners, geometries, or composer render targets.
 */

import * as THREE from 'three';

import { QUALITY } from './config';
import { createNeonCity, type NeonCityWorld } from './world/neonCity';
import { createPlayerCar, type PlayerCar } from './vehicle/playerCar';
import { attachKeyboardInput, type KeyboardInput } from './input/keyboard';
import { createAIRacers, type AIRacers } from './ai/aiRacers';
import { createChaseCamera, type ChaseCamera } from './camera/chaseCamera';
import { createPostFxComposer, type PostFxComposer } from './postfx/composer';
import { createNitrousFlames, type NitrousFlames } from './fx/nitrousFlames';
import {
  createRaceDirector,
  type RaceDirector,
  type RaceEntrant,
} from './race/raceDirector';
import { createHud, type Hud, type PlayerHudState } from './hud/hud';
import type { CarState, InputState, NitrousState, RaceState } from './shared/types';
import { loopProgress, nearestWaypoint, type Waypoint } from './ai/waypointFollower';

/** Dark night backdrop shared by the clear color and ambient light. */
const NIGHT_BG = 0x05070f;

/** Stable id used for the player entrant across race-boundary lookups. */
export const PLAYER_ID = 'player';

/** Player entrant display name (shown on live / final standings). */
export const PLAYER_NAME = 'You';

/** Number of AI rivals on the start grid. */
export const AI_COUNT = 3;

/** The fully composed, running game handle. */
export interface RacerGame {
  /** The mounted WebGL canvas. */
  readonly canvas: HTMLCanvasElement;
  /** The Three.js scene. */
  readonly scene: THREE.Scene;
  /** The PerspectiveCamera used to frame the action. */
  readonly camera: THREE.PerspectiveCamera;
  /** The WebGLRenderer. */
  readonly renderer: THREE.WebGLRenderer;
  /** The underlying rAF handle (usable to cancel the loop). */
  raf: number;
  /** Create the scene/camera/player/world systems (no DOM attached yet). */
  instantiate(): RacerGame;
  /** Append the renderer canvas + HUD to `host` and start the rAF loop. */
  attach(host: HTMLElement): RacerGame;
  /** Advance the whole race by `dt` seconds and render this frame. */
  update(dt: number): void;
  /** Reset cars, race state, and timers (R key / button) without leaking. */
  restart(): void;
  /** Stop the loop, remove DOM, and release every owned resource. */
  dispose(): void;
}

/** The mutable, per-race systems torn down and rebuilt on `restart()`. */
interface RaceSystems {
  player: PlayerCar;
  keyboard: KeyboardInput;
  ai: AIRacers;
  flames: NitrousFlames;
  chase: ChaseCamera;
  composer: PostFxComposer | null;
  director: RaceDirector;
  hud: Hud;
  /** Boost intensity (0..1) fed to the chase FOV + motion blur each frame. */
  setBoost(v: number): void;
  /** Current boost intensity. */
  getBoost(): number;
  /** Player exhaust anchor refs (stable children of the player body). */
  anchors(): THREE.Object3D[];
}

/** Build the mutable race systems fresh for a new race session. */
function buildRaceSystems(
  host: HTMLElement,
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
  world: NeonCityWorld,
): RaceSystems {
  const trackPath = world.track.path;
  const start = world.track.startLine;

  // Player spawns on the start/finish line (grid slot 0), facing race forward.
  const yaw = Math.atan2(start.tangent.x, start.tangent.z);
  const player = createPlayerCar({
    spawn: { x: start.position.x, z: start.position.z, yaw },
  });
  scene.add(player.body);

  const keyboard = attachKeyboardInput();

  // 3 AI rivals spawned on the staggered grid ahead of the line.
  const ai = createAIRacers(trackPath, AI_COUNT);
  for (const racer of ai.racers) scene.add(racer.body);

  // Boost intensity for the chase camera's wide-angle kick (updated per frame).
  let boostIntensity = 0;

  const chase = createChaseCamera(camera, { getBoost: () => boostIntensity });

  // Motion-blur trail only when the quality budget allows it.
  const composer = QUALITY.motionBlur
    ? createPostFxComposer(renderer, scene, camera, {
        pixelRatio: QUALITY.pixelRatioCap,
      })
    : null;

  // Blue-purple nitrous flames hang on the player's two exhaust anchors.
  const anchors = (): THREE.Object3D[] => {
    const body = player.body;
    const l = body.getObjectByName('exhaustLeft');
    const r = body.getObjectByName('exhaustRight');
    return [l, r].filter((a): a is THREE.Object3D => a !== null && a !== undefined);
  };
  const flames = createNitrousFlames(anchors(), {
    maxParticles: QUALITY.flameParticles,
  });
  scene.add(flames.points);

  // Race director over the shared grid (player + AI).
  const entrants: RaceEntrant[] = [
    { id: PLAYER_ID, name: PLAYER_NAME },
    ...ai.racers.map((r) => ({ id: r.id, name: r.name })),
  ];
  const director = createRaceDirector(trackPath, entrants);

  const hud = createHud(host);

  return {
    player,
    keyboard,
    ai,
    flames,
    chase,
    composer,
    director,
    hud,
    setBoost: (v: number) => {
      boostIntensity = v;
    },
    getBoost: () => boostIntensity,
    anchors,
  };
}

/** The concrete composed game instance. */
class NeonRacerGame implements RacerGame {
  readonly canvas: HTMLCanvasElement;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  raf = 0;

  private readonly host: HTMLElement;
  private ss: RaceSystems;
  private readonly world: NeonCityWorld;
  private readonly clock = new THREE.Clock();
  private elapsed = 0;
  private mounted = false;
  /** Player lap counting across the loop boundary (informational CarState). */
  private playerLapCount = 0;
  private lastPlayerProgress = 0;

  private readonly onRestartKey = (e: KeyboardEvent): void => {
    if (e.code === 'KeyR' || e.key === 'r' || e.key === 'R') this.restart();
  };
  private readonly onResize = (): void => {
    this.updateSize();
  };
  private restartButton: HTMLButtonElement | null = null;

  constructor(host: HTMLElement) {
    this.host = host;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(NIGHT_BG);
    this.scene.fog = new THREE.Fog(NIGHT_BG, 80, 320);

    this.camera = new THREE.PerspectiveCamera(
      60,
      this.viewportW() / this.viewportH(),
      0.1,
      2000,
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: QUALITY.antialias,
      powerPreference: 'high-performance',
    });
    const cappedDpr = Math.min(this.viewportDpr(), QUALITY.pixelRatioCap);
    this.renderer.setPixelRatio(cappedDpr);
    this.renderer.setSize(this.viewportW(), this.viewportH());
    this.canvas = this.renderer.domElement;

    this.world = createNeonCity(this.scene);
    this.scene.add(this.world.group);

    this.ss = buildRaceSystems(
      host,
      this.scene,
      this.renderer,
      this.camera,
      this.world,
    );
    // Snap the chase camera onto the player's grid pose for a clean boot frame.
    this.ss.chase.reset(this.playerTarget());
  }

  private viewportW(): number {
    return this.host.clientWidth || window.innerWidth || 800;
  }

  private viewportH(): number {
    return this.host.clientHeight || window.innerHeight || 600;
  }

  private viewportDpr(): number {
    return window.devicePixelRatio || 1;
  }

  /** Build the player-target snapshot for the chase camera. */
  private playerTarget(): { position: [number, number, number]; yaw: number; speed: number } {
    const p = this.ss.player;
    return { position: [p.state.x, 0, p.state.z], yaw: p.state.yaw, speed: p.state.speed };
  }

  /** Fractional loop progress of the player within its current lap. */
  private playerProgress(): number {
    const p = this.ss.player;
    const pos: Waypoint = [p.state.x, 0, p.state.z];
    const pts = this.world.track.path.points as readonly Waypoint[];
    return loopProgress(pts, pos);
  }

  /** Build the player's CarState snapshot, advancing its lap on loop wrap. */
  private playerCarState(): CarState {
    const p = this.ss.player;
    const progress = this.playerProgress();
    if (this.lastPlayerProgress > 0.9 && progress < 0.1) {
      this.playerLapCount += 1;
    }
    this.lastPlayerProgress = progress;
    const pts = this.world.track.path.points as readonly Waypoint[];
    const waypointIndex = nearestWaypoint(pts, [p.state.x, 0, p.state.z] as Waypoint);
    return {
      id: PLAYER_ID,
      position: [p.state.x, 0, p.state.z],
      yaw: p.state.yaw,
      speed: p.state.speed,
      lap: this.playerLapCount,
      waypointIndex,
    };
  }

  instantiate(): RacerGame {
    return this;
  }

  attach(host: HTMLElement): RacerGame {
    if (this.mounted) return this;
    this.mounted = true;
    host.appendChild(this.canvas);

    // On-screen restart affordance (bottom-center), independent of the HUD.
    this.restartButton = document.createElement('button');
    this.restartButton.textContent = '↻ Restart (R)';
    this.restartButton.type = 'button';
    Object.assign(this.restartButton.style, {
      position: 'fixed',
      bottom: '14px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '30',
      padding: '6px 16px',
      borderRadius: '18px',
      border: '1px solid #3ce6ff',
      background: 'rgba(5,10,22,0.72)',
      color: '#aef3ff',
      font: '600 13px system-ui, sans-serif',
      cursor: 'pointer',
    });
    this.restartButton.addEventListener('click', () => this.restart());
    document.body.appendChild(this.restartButton);

    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onRestartKey);

    this.updateSize();
    this.raf = requestAnimationFrame(this.frame);
    return this;
  }

  /** The rAF tick: advance the world by `dt` and render a frame. */
  private readonly frame = (): void => {
    this.raf = requestAnimationFrame(this.frame);
    this.update(this.clock.getDelta());
  };

  private updateSize(): void {
    const w = this.viewportW();
    const h = this.viewportH();
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /**
   * Advance the complete simulated race by `dt` seconds and render one frame.
   * This is the single funnel where CarState/RaceState flow into the camera,
   * post FX, race director, and HUD.
   */
  update(dt: number): void {
    this.elapsed += dt;

    // --- World: flicker + rain sheen animation ------------------------------
    this.world.update(dt, this.elapsed);

    // --- Player: arrow-key drive + drift-charged nitrous --------------------
    const input: InputState = this.ss.keyboard.input();
    this.ss.player.update(dt, input);

    // --- AI: steer rivals around the loop, rubber-banding to the player -----
    this.ss.ai.update(dt, {
      x: this.ss.player.state.x,
      z: this.ss.player.state.z,
      lap: this.playerLapCount,
    });

    // --- CarState snapshots for every entrant -------------------------------
    const playerState = this.playerCarState();
    const aiStates = this.ss.ai.racers.map((r) => this.ss.ai.getState(r.index) as CarState);
    const carStates: CarState[] = [playerState, ...aiStates];

    // --- Race director: countdown, 3-lap timing, live standings --------------
    this.ss.director.update(dt, carStates);
    const race: RaceState = this.ss.director.getState();

    // --- Boost intensity drives wide FOV + stronger blur + exhaust flames ----
    const boosting = this.ss.player.nitrous.boosting;
    const boostIntensity = boosting ? 1 : 0;
    this.ss.setBoost(boostIntensity);

    // --- Chase camera: damped follow + speed/boost wide-angle FOV -----------
    this.ss.chase.update(this.playerTarget(), dt);

    // --- Nitrous flames: spawn blue-purple exhaust while boosting -----------
    this.ss.flames.update(
      { active: boosting, intensity: this.ss.player.nitrous.exhaustFlame },
      this.ss.anchors(),
      dt,
    );

    // --- Post FX: scale motion blur from speed + boost, then render ---------
    if (this.ss.composer) {
      this.ss.composer.updateFrom(
        { speed: playerState.speed, boost: boostIntensity },
        dt,
      );
      this.ss.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    // --- HUD: live standings, clock, nitrous bar, countdown, results --------
    this.ss.hud.update(race, this.playerHudState(playerState, boosting));
  }

  /** Aggregate the player snapshot the HUD renders. */
  private playerHudState(car: CarState, boosting: boolean): PlayerHudState {
    const n = this.ss.player.nitrous;
    const nitrous: NitrousState = {
      active: boosting,
      reserve: Math.min(1, Math.max(0, n.charge)),
      boost: n.boostMultiplier,
      cooldown: 0,
    };
    return { car, nitrous };
  }

  /**
   * Reset every mutable race system. The world/scene/renderer/camera persist;
   * the dynamic systems are disposed and rebuilt so no listeners, geometries,
   * or composer render targets leak across restarts.
   */
  restart(): void {
    const old = this.ss;
    // Release GPU + DOM + listeners owned by the old session, in dependency
    // order (pop the dynamic meshes off the scene before disposing meshes).
    this.scene.remove(old.player.body);
    for (const racer of old.ai.racers) this.scene.remove(racer.body);
    this.scene.remove(old.flames.points);

    old.player.dispose();
    old.ai.dispose();
    old.flames.dispose();
    if (old.composer) old.composer.dispose();
    old.director.dispose();
    old.hud.dispose();
    old.keyboard.dispose();

    // Player lap counters reset so the restarted race starts clean on lap 0.
    this.playerLapCount = 0;
    this.lastPlayerProgress = 0;

    // Rebuild a fresh race session from the start grid.
    this.ss = buildRaceSystems(
      this.host,
      this.scene,
      this.renderer,
      this.camera,
      this.world,
    );
    this.ss.chase.reset(this.playerTarget());
  }

  /** Stop the loop, remove DOM, and release every owned resource. */
  dispose(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onRestartKey);
    if (this.restartButton) {
      this.restartButton.remove();
      this.restartButton = null;
    }

    for (const racer of this.ss.ai.racers) this.scene.remove(racer.body);
    this.scene.remove(this.ss.player.body);
    this.scene.remove(this.ss.flames.points);

    this.ss.player.dispose();
    this.ss.ai.dispose();
    this.ss.flames.dispose();
    if (this.ss.composer) this.ss.composer.dispose();
    this.ss.director.dispose();
    this.ss.hud.dispose();
    this.ss.keyboard.dispose();
    this.world.dispose();
    this.renderer.dispose();
    this.canvas.remove();
    this.mounted = false;
  }
}

/**
 * Boot the full game into an explicit `host` element (`#app` by default).
 * The rAF loop runs automatically once attached.
 */
export function bootstrap(host?: HTMLElement): RacerGame {
  const el = host ?? document.getElementById('app') ?? undefined;
  if (!el) throw new Error('bootstrap: no host element found');
  const game = new NeonRacerGame(el);
  game.attach(el);
  return game;
}

// Self-boot when this module is loaded directly as the Vite entrypoint.
bootstrap();