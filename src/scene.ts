/**
 * CityScene — composition root for the city-timelapse scene.
 *
 * This module is the single owner of the rendered scene graph. It:
 *   - owns the WebGL renderer + clock loop,
 *   - instantiates all five era factories (buildings, vehicles, pedestrians,
 *     storefronts, advertising, streetProps, atmosphere) plus the audio layer,
 *   - drives the era-morph engine (deterministic ~0.8s eased crossfade/scale,
 *     audio crossfade via AudioManager, lighting/exposure update in the same
 *     window, and lazy disposal of non-active era groups after completion),
 *   - implements camera navigation (orbit via drag, walk mode via WASD + mouse
 *     look clamped to street level with raycast ground collision, and
 *     click-to-focus dolly on storefronts/buildings),
 *   - emits the `window.__cityTimelapse` debug handle for QA verification.
 *
 * Lifecycle contract: `bootstrap` (constructor) -> `update` (per-frame) ->
 * `dispose`. The application composition owner in `src/main.ts` wires the
 * timeline HUD `yearChange` event into `setYear`.
 */
import * as THREE from 'three';
import { eraRegistry } from './data/eraRegistry';
import type { EraKey } from './data/eraDefinition';
import { buildingsFactory } from './eras/buildings';
import { vehiclesFactory } from './eras/vehicles';
import { pedestriansFactory } from './eras/pedestrians';
import { storefrontsFactory } from './eras/storefronts';
import { advertisingFactory } from './eras/advertising';
import { streetPropsFactory } from './eras/streetProps';
import { atmosphereFactory } from './eras/atmosphere';
import { AudioManager } from './audio/audioManager';
import { PostPipeline } from './postfx/pipeline';

/** Morph transition duration in seconds (deterministic across switches). */
export const MORPH_DURATION_SECONDS = 0.8;

/** Deterministic ease-in-out cubic curve used for the morph window. */
export function easeInOutCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Debug handle exposed on `window.__cityTimelapse` for QA verification. */
export interface CityTimelapseDebugHandle {
  /** The currently active era (updates immediately on switch). */
  currentEra: EraKey;
  /** The Three.js scene (scene graph root). */
  scene: THREE.Scene;
  /** Alias of `scene` — the scene graph root for QA traversal. */
  sceneRoot: THREE.Object3D;
  /** Programmatically switch eras (same path as the timeline HUD). */
  setYear: (year: EraKey) => void;
  /** Snapshot of the morph engine state. */
  getMorphState: () => {
    active: boolean;
    from: EraKey | null;
    to: EraKey | null;
    /** Eased progress in [0,1]; 1 means the morph finished. */
    progress: number;
  };
  /** Current camera navigation mode ('orbit' | 'walk'). */
  navMode: 'orbit' | 'walk';
}

declare global {
  // eslint-disable-next-line no-var
  var __cityTimelapse: CityTimelapseDebugHandle | undefined;
}

/** Camera navigation mode. */
type NavMode = 'orbit' | 'walk';

/** Active morph transition state. */
interface MorphState {
  from: EraKey;
  to: EraKey;
  /** Accumulated transition time in seconds (deterministic). */
  elapsed: number;
  /** Fixed duration in seconds. */
  duration: number;
}

/** Active click-to-focus dolly transition. */
interface DollyState {
  fromPos: THREE.Vector3;
  fromLook: THREE.Vector3;
  endPos: THREE.Vector3;
  focus: THREE.Vector3;
  elapsed: number;
  duration: number;
}

/** Spherical offset around a look target for the orbit camera. */
function orbitOffset(yaw: number, pitch: number, distance: number): THREE.Vector3 {
  return new THREE.Vector3(
    distance * Math.cos(pitch) * Math.sin(yaw),
    distance * Math.sin(pitch),
    distance * Math.cos(pitch) * Math.cos(yaw),
  );
}

/** Camera forward (look) direction from yaw/pitch. */
function forward(yaw: number, pitch: number): THREE.Vector3 {
  return new THREE.Vector3(
    -Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch),
  );
}

/** Horizontal heading used for WASD movement. */
function forwardHorizontal(yaw: number): THREE.Vector3 {
  return new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
}

/** Right vector (screen right) for WASD strafing. */
function rightVector(yaw: number): THREE.Vector3 {
  return new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
}

/** Options for constructing a CityScene. */
export interface CitySceneOptions {
  /** Host element that receives the renderer canvas. */
  container: HTMLElement;
  /** Host element that receives the audio toggle button. */
  hudHost: HTMLElement;
  /** Initial era (defaults to the earliest, 1945). */
  initialYear?: EraKey;
}

/**
 * The city-timelapse composition root.
 *
 * `bootstrap` happens in the constructor (renderer, factories, audio, camera,
 * debug handle); `update(delta)` is called every frame by the clock loop;
 * `dispose()` tears everything down.
 */
export class CityScene {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly clock: THREE.Clock;
  readonly audio: AudioManager;
  /** Post-processing pipeline (bloom + era grade/grain/vignette). */
  readonly postfx: PostPipeline;

  private readonly container: HTMLElement;
  private readonly groundMesh: THREE.Mesh;

  // Era factories (each consumed read-only via its exported factory).
  private readonly buildings = buildingsFactory();
  private readonly vehicles = vehiclesFactory();
  private readonly pedestrians = pedestriansFactory();
  private readonly storefronts = storefrontsFactory();
  private readonly advertising = advertisingFactory();
  private readonly streetProps: ReturnType<typeof streetPropsFactory>;
  private readonly atmosphere: ReturnType<typeof atmosphereFactory>;

  /** Current active era (drives window.__cityTimelapse). */
  private currentEra: EraKey;
  /** Active morph transition (null when idle). */
  private morph: MorphState | null = null;
  /** Eased morph progress in [0,1] (drives the postfx grade blend). */
  private morphProgress = 1;
  /** Content roots scaled during the morph settle (current era's content). */
  private contentRoots: THREE.Object3D[] = [];

  // Camera navigation state.
  private navMode: NavMode = 'orbit';
  private yaw = 0.0;
  private pitch = 0.35;
  private orbitDistance = 26;
  private readonly orbitTarget = new THREE.Vector3(0, 2, 0);
  private readonly walkPos = new THREE.Vector3(0, 0, 26);
  private readonly eyeHeight = 1.7;
  private readonly keys = new Set<string>();
  private dragging = false;
  private lastPointer = { x: 0, y: 0 };
  private dolly: DollyState | null = null;

  // DOM / listeners for teardown.
  private readonly walkButton: HTMLButtonElement;
  private readonly walkHint: HTMLDivElement;
  private readonly pointerDown: (e: PointerEvent) => void;
  private readonly pointerMove: (e: PointerEvent) => void;
  private readonly pointerUp: (e: PointerEvent) => void;
  private readonly keyDown: (e: KeyboardEvent) => void;
  private readonly keyUp: (e: KeyboardEvent) => void;
  private readonly wheel: (e: WheelEvent) => void;
  private disposed = false;

  constructor(options: CitySceneOptions) {
    this.container = options.container;
    this.currentEra = options.initialYear ?? 1945;

    // --- Renderer + scene + camera -------------------------------------
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0e13);

    this.camera = new THREE.PerspectiveCamera(
      60,
      this.container.clientWidth / Math.max(1, this.container.clientHeight),
      0.1,
      2000,
    );
    this.camera.position.set(0, 8, 24);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      canvas: this.container.querySelector('canvas') ?? undefined,
    });
    // FPS floor: cap the device pixel ratio at 2.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    if (!this.renderer.domElement.parentElement) {
      this.container.appendChild(this.renderer.domElement);
    }

    // --- Post-processing pipeline (bloom + era grade/grain/vignette) ----
    this.postfx = new PostPipeline();
    this.postfx.bootstrap(this.renderer, this.scene, this.camera);
    this.postfx.setSize(this.container.clientWidth, this.container.clientHeight);

    // --- Ground plane (raycast collision target + visual base) ---------
    this.groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: 0x8a7f6d, roughness: 0.9 }),
    );
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.name = 'ground';
    this.scene.add(this.groundMesh);

    // --- Audio + atmosphere (lighting/exposure) ------------------------
    this.audio = new AudioManager({ host: options.hudHost, initialYear: this.currentEra });
    this.atmosphere = atmosphereFactory({ scene: this.scene, camera: this.camera, renderer: this.renderer });
    this.scene.add(this.atmosphere.group);

    // --- Era factories (all instantiated up front, ready for swap) -----
    const eraDef = eraRegistry[this.currentEra];
    this.buildings.bootstrap(this.scene, eraDef);
    this.vehicles.bootstrap(this.scene, eraDef);
    this.pedestrians.bootstrap(this.scene, eraDef);
    this.storefronts.bootstrap(this.scene);
    this.advertising.bootstrap(this.scene);
    this.streetProps = streetPropsFactory(this.scene);

    this.clock = new THREE.Clock();
    this.contentRoots = this.collectContentRoots();

    // --- Camera navigation listeners -----------------------------------
    this.pointerDown = (e: PointerEvent) => this.onPointerDown(e);
    this.pointerMove = (e: PointerEvent) => this.onPointerMove(e);
    this.pointerUp = (e: PointerEvent) => this.onPointerUp(e);
    this.keyDown = (e: KeyboardEvent) => this.onKeyDown(e);
    this.keyUp = (e: KeyboardEvent) => this.onKeyUp(e);
    this.wheel = (e: WheelEvent) => this.onWheel(e);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.pointerDown);
    canvas.addEventListener('pointermove', this.pointerMove);
    canvas.addEventListener('pointerup', this.pointerUp);
    canvas.addEventListener('pointerleave', this.pointerUp);
    canvas.addEventListener('wheel', this.wheel, { passive: false });
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);

    // --- Walk-mode toggle button + hint overlay ------------------------
    this.walkButton = document.createElement('button');
    this.walkButton.type = 'button';
    this.walkButton.className = 'walk-toggle';
    this.walkButton.setAttribute('aria-pressed', 'false');
    this.walkButton.setAttribute('aria-label', 'Toggle walk mode');
    this.walkButton.title = 'Toggle walk mode (M)';
    this.walkButton.textContent = 'Walk mode (M)';
    this.walkButton.style.cssText =
      'position:fixed;left:16px;bottom:16px;z-index:20;padding:8px 14px;' +
      'border-radius:8px;border:1px solid rgba(255,255,255,0.35);' +
      'background:rgba(10,14,20,0.72);color:#e8e8e8;font-size:13px;cursor:pointer;' +
      'backdrop-filter:blur(6px);box-shadow:0 4px 18px rgba(0,0,0,0.45);';
    this.walkButton.addEventListener('click', () => this.toggleWalkMode());
    this.container.appendChild(this.walkButton);

    this.walkHint = document.createElement('div');
    this.walkHint.className = 'walk-hint';
    this.walkHint.style.cssText =
      'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:20;' +
      'background:rgba(10,14,20,0.72);color:#e8e8e8;font-size:12px;padding:6px 12px;' +
      'border-radius:6px;pointer-events:none;display:none;backdrop-filter:blur(6px);';
    this.walkHint.textContent = 'WASD to move · drag to look · click a building to focus';
    this.container.appendChild(this.walkHint);

    // --- Debug handle ---------------------------------------------------
    this.publishDebugHandle();
  }

  /** Current active era. */
  get year(): EraKey {
    return this.currentEra;
  }

  /** Current camera navigation mode. */
  get mode(): NavMode {
    return this.navMode;
  }

  /** The scene graph root (for QA traversal). */
  get sceneRoot(): THREE.Object3D {
    return this.scene;
  }

  /**
   * Switch the active era and start a deterministic eased morph.
   * Subsystems swap via their factory `update` lifecycle; lighting/exposure
   * and audio crossfade over the same ~0.8s window; content "settles" with an
   * eased scale pulse for one continuous transition.
   */
  setYear(year: EraKey): void {
    if (this.disposed) {
      return;
    }
    const from = this.currentEra;
    if (year === from) {
      return;
    }
    // Reflect the selection immediately for the debug handle / QA.
    this.currentEra = year;
    const eraDef = eraRegistry[year];

    // Swap each era subsystem's content via its lifecycle `update` hook.
    this.buildings.update(eraDef);
    this.storefronts.update(year);
    this.advertising.update(year);
    this.streetProps.update(year);
    this.vehicles.update(0, eraDef);
    this.pedestrians.update(0, eraDef);

    // Lighting/exposure crossfade (atmosphere) + audio crossfade in the same window.
    this.atmosphere.update(year);
    this.audio.setEra(year);

    // Start the deterministic morph window.
    this.morph = { from, to: year, elapsed: 0, duration: MORPH_DURATION_SECONDS };
    this.morphProgress = 0;
    this.contentRoots = this.collectContentRoots();
  }

  /** Update the current era (used by the timeline HUD wiring). */
  update(year: EraKey): void {
    this.setYear(year);
  }

  /**
   * Per-frame update. Advances the morph, atmosphere crossfade, animated
   * street life, camera navigation, then renders.
   */
  tick(delta: number): void {
    if (this.disposed) {
      return;
    }
    // Advance animated street life (rebuilds only when the era changed).
    const eraDef = eraRegistry[this.currentEra];
    this.vehicles.update(delta, eraDef);
    this.pedestrians.update(delta, eraDef);

    // Advance lighting/exposure crossfade each frame.
    this.atmosphere.tick(delta);

    // Advance the morph window (content scale settle).
    this.updateMorph(delta);

    // Advance camera navigation (orbit / walk / dolly).
    this.updateNavigation(delta);

    // Render through the post-processing pipeline (bloom + era grade).
    this.postfx.update(this.currentEra, this.morphProgress, delta);
  }

  /** Toggle between orbit and walk navigation modes. */
  toggleWalkMode(): void {
    this.navMode = this.navMode === 'orbit' ? 'walk' : 'orbit';
    this.walkButton.textContent = this.navMode === 'walk' ? 'Orbit mode (M)' : 'Walk mode (M)';
    this.walkButton.setAttribute('aria-pressed', String(this.navMode === 'walk'));
    this.walkHint.style.display = this.navMode === 'walk' ? 'block' : 'none';
  }

  /** Dispose all resources: factories, audio, atmosphere, listeners, DOM. */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.pointerDown);
    canvas.removeEventListener('pointermove', this.pointerMove);
    canvas.removeEventListener('pointerup', this.pointerUp);
    canvas.removeEventListener('pointerleave', this.pointerUp);
    canvas.removeEventListener('wheel', this.wheel);
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);

    this.buildings.dispose();
    this.vehicles.dispose();
    this.pedestrians.dispose();
    this.storefronts.dispose();
    this.advertising.dispose();
    this.streetProps.dispose();
    this.atmosphere.dispose();
    this.audio.dispose();
    this.postfx.dispose();

    this.walkButton.remove();
    this.walkHint.remove();
    this.morph = null;
    this.dolly = null;
    this.contentRoots = [];
    if (typeof window.__cityTimelapse !== 'undefined') {
      window.__cityTimelapse = undefined;
    }
  }

  // -----------------------------------------------------------------------
  // Morph engine
  // -----------------------------------------------------------------------

  private updateMorph(delta: number): void {
    if (!this.morph) {
      return;
    }
    this.morph.elapsed += delta;
    const tRaw = Math.min(1, this.morph.elapsed / this.morph.duration);
    const eased = easeInOutCubic(tRaw);
    // Expose eased progress to the postfx grade blend.
    this.morphProgress = eased;

    // Content "settle": scale from 1.07 -> 1.0 across the eased window.
    const scale = 1 + 0.07 * (1 - eased);
    for (const root of this.contentRoots) {
      root.scale.setScalar(scale);
    }

    if (tRaw >= 1) {
      this.finalizeMorph();
    }
  }

  /** End the morph: restore scale and lazily dispose non-active era groups. */
  private finalizeMorph(): void {
    for (const root of this.contentRoots) {
      root.scale.setScalar(1);
    }
    // The era factories rebuild in place on `update`, which detaches and
    // releases the previous era's geometry (no orphaned objects). This step
    // additionally drops our retained references so stale groups are GC-able.
    this.contentRoots = this.collectContentRoots();
    this.morph = null;
    this.morphProgress = 1;
  }

  /** Collect the current era's content root groups for morph scaling. */
  private collectContentRoots(): THREE.Object3D[] {
    const roots: THREE.Object3D[] = [];
    if (this.buildings.root) {
      roots.push(this.buildings.root);
    }
    if (this.vehicles.root) {
      roots.push(this.vehicles.root);
    }
    if (this.pedestrians.root) {
      roots.push(this.pedestrians.root);
    }
    if (this.streetProps.group) {
      roots.push(this.streetProps.group);
    }
    for (const rig of this.storefronts.rigs) {
      roots.push(rig.group);
    }
    for (const rig of this.advertising.rigs) {
      roots.push(rig.group);
    }
    return roots;
  }

  // -----------------------------------------------------------------------
  // Camera navigation
  // -----------------------------------------------------------------------

  private onPointerDown(e: PointerEvent): void {
    this.dragging = true;
    this.lastPointer = { x: e.clientX, y: e.clientY };
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.dragging) {
      return;
    }
    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.yaw -= dx * 0.005;
    this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch - dy * 0.005));
  }

  private onPointerUp(e: PointerEvent): void {
    const moved = Math.hypot(e.clientX - this.lastPointer.x, e.clientY - this.lastPointer.y);
    const wasClick = this.dragging && moved < 6;
    this.dragging = false;
    if (wasClick) {
      this.focusAt(e);
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.orbitDistance = Math.max(4, Math.min(60, this.orbitDistance + e.deltaY * 0.05));
  }

  private onKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      return;
    }
    const key = e.key.toLowerCase();
    if (key === 'm' && !e.repeat) {
      this.toggleWalkMode();
      return;
    }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      e.preventDefault();
    }
    this.keys.add(key);
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.key.toLowerCase());
  }

  private updateNavigation(delta: number): void {
    // Dolly focus transition takes precedence.
    if (this.dolly) {
      this.dolly.elapsed += delta;
      const p = easeInOutCubic(Math.min(1, this.dolly.elapsed / this.dolly.duration));
      const pos = this.dolly.fromPos.clone().lerp(this.dolly.endPos, p);
      const look = this.dolly.fromLook.clone().lerp(this.dolly.focus, p);
      this.camera.position.copy(pos);
      this.camera.lookAt(look.x, look.y, look.z);
      if (this.dolly.elapsed >= this.dolly.duration) {
        this.dolly = null;
      }
      return;
    }

    if (this.navMode === 'walk') {
      this.updateWalk(delta);
    } else {
      this.applyOrbitCamera();
    }
  }

  private applyOrbitCamera(): void {
    const off = orbitOffset(this.yaw, this.pitch, this.orbitDistance);
    this.camera.position.set(
      this.orbitTarget.x + off.x,
      this.orbitTarget.y + off.y,
      this.orbitTarget.z + off.z,
    );
    this.camera.lookAt(this.orbitTarget.x, this.orbitTarget.y, this.orbitTarget.z);
  }

  private updateWalk(delta: number): void {
    const speed = 8;
    const fwd = forwardHorizontal(this.yaw);
    const right = rightVector(this.yaw);

    let dx = 0;
    let dz = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) {
      dx += fwd.x * speed * delta;
      dz += fwd.z * speed * delta;
    }
    if (this.keys.has('s') || this.keys.has('arrowdown')) {
      dx -= fwd.x * speed * delta;
      dz -= fwd.z * speed * delta;
    }
    if (this.keys.has('a') || this.keys.has('arrowleft')) {
      dx -= right.x * speed * delta;
      dz -= right.z * speed * delta;
    }
    if (this.keys.has('d') || this.keys.has('arrowright')) {
      dx += right.x * speed * delta;
      dz += right.z * speed * delta;
    }

    const candidateX = Math.max(-54, Math.min(54, this.walkPos.x + dx));
    const candidateZ = Math.max(-54, Math.min(54, this.walkPos.z + dz));

    // Raycast ground collision: if the candidate cell sits over a building
    // (non-ground hit), block movement so we don't clip through geometry.
    const probe = this.raycastDown(candidateX, candidateZ);
    if (probe.isGround) {
      this.walkPos.x = candidateX;
      this.walkPos.z = candidateZ;
      this.walkPos.y = probe.y;
    }

    this.camera.position.set(this.walkPos.x, this.walkPos.y + this.eyeHeight, this.walkPos.z);
    const f = forward(this.yaw, this.pitch);
    this.camera.lookAt(
      this.walkPos.x + f.x,
      this.walkPos.y + this.eyeHeight + f.y,
      this.walkPos.z + f.z,
    );
  }

  /** Cast a ray straight down and report the nearest hit's ground/obstacle state. */
  private raycastDown(x: number, z: number): { y: number; isGround: boolean } {
    const origin = new THREE.Vector3(x, 80, z);
    const direction = new THREE.Vector3(0, -1, 0);
    const raycaster = new THREE.Raycaster(origin, direction, 0.1, 200);
    const hits = raycaster.intersectObjects(this.scene.children, true);
    if (hits.length === 0) {
      return { y: 0, isGround: true };
    }
    const first = hits[0];
    return { y: first.point.y, isGround: first.object === this.groundMesh };
  }

  /** Click-to-focus: raycast from cursor and dolly toward the nearest focusable hit. */
  private focusAt(e: PointerEvent): void {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
    const coords = new THREE.Vector2(nx, ny);

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(coords, this.camera);
    const hits = raycaster.intersectObjects(this.scene.children, true);
    if (hits.length === 0) {
      return;
    }
    const hit = hits[0];
    if (!this.isFocusable(hit.object)) {
      return;
    }
    this.startDolly(hit.point);
  }

  /** Whether a raycast hit belongs to a storefront or building (focusable). */
  private isFocusable(object: THREE.Object3D): boolean {
    for (let o: THREE.Object3D | null = object; o; o = o.parent) {
      if (o === this.buildings.root) {
        return true;
      }
      for (const rig of this.storefronts.rigs) {
        if (o === rig.group) {
          return true;
        }
      }
    }
    return false;
  }

  /** Begin a smooth dolly that brings the camera toward `focus`. */
  private startDolly(focus: THREE.Vector3): void {
    const fromPos = this.camera.position.clone();
    const fromLook = this.camera.position.clone().add(forward(this.yaw, this.pitch));
    const dir = forward(this.yaw, this.pitch);
    const endPos = focus.clone().addScaledVector(dir, -4.5);
    this.dolly = {
      fromPos,
      fromLook,
      endPos,
      focus: focus.clone(),
      elapsed: 0,
      duration: 0.6,
    };
  }

  // -----------------------------------------------------------------------
  // Debug handle
  // -----------------------------------------------------------------------

  private publishDebugHandle(): void {
    const self = this;
    window.__cityTimelapse = {
      get currentEra() {
        return self.currentEra;
      },
      get scene() {
        return self.scene;
      },
      get sceneRoot() {
        return self.scene;
      },
      setYear: (year: EraKey) => self.setYear(year),
      getMorphState: () => {
        const m = self.morph;
        return {
          active: m !== null,
          from: m ? m.from : null,
          to: m ? m.to : null,
          progress: m ? Math.min(1, m.elapsed / m.duration) : 1,
        };
      },
      get navMode() {
        return self.navMode;
      },
    };
  }
}