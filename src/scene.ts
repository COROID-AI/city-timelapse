/**
 * Scene composer for the City Time Period Timelapse.
 *
 * This module wires together the renderer, scene graph, camera controller,
 * traffic system, pedestrian system, audio mixer, and the timeline HUD. It is
 * the central coordinator that reacts to era changes dispatched by the
 * {@link TimelineHud} and propagates them across every visual and audio layer.
 *
 * The composer is intentionally framework-agnostic — it operates on a plain
 * three.js `THREE.Scene` and `THREE.WebGLRenderer` that the bootstrap
 * (`main.ts`) creates and passes in. This separation keeps the scene logic
 * testable and decoupled from DOM bootstrap concerns.
 */

import * as THREE from 'three';
import type { EraSpec, EraId } from './eras/types.js';
import { getEra, getAllEras } from './eras/types.js';
import { getEraAssets, populateBuildings } from './assetBuilder/eras.js';
import { computeBlockLayout, lotCollisionBoxes } from './blockLayout.js';
import type { BuildingLot } from './assetBuilder/buildings.js';
import { CameraController, type CollisionBox } from './cameraController.js';
import { TrafficSystem } from './traffic.js';
import { PedestrianSystem } from './pedestrians.js';
import { SfxMixer } from './audio/mixer.js';
import { TimelineHud } from './hud/timeline.js';
import { TransitionController } from './transitionController.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration for the {@link SceneComposer}. */
export interface SceneComposerOptions {
  /** The WebGL renderer to draw with. */
  renderer: THREE.WebGLRenderer;
  /** The perspective camera. */
  camera: THREE.PerspectiveCamera;
  /** The canvas element the renderer draws onto (for camera event binding). */
  canvas: HTMLCanvasElement;
  /** Container element for the HUD (defaults to document.body). */
  hudContainer?: HTMLElement;
  /** Initial era id. Default: '1945'. */
  initialEra?: EraId;
  /** Whether to enable the audio mixer. Default: true. */
  enableAudio?: boolean;
}

// ---------------------------------------------------------------------------
// SceneComposer class
// ---------------------------------------------------------------------------

/**
 * Central scene coordinator.
 *
 * Owns the three.js scene graph and orchestrates era changes across visuals
 * (buildings, streets, traffic, pedestrians), audio (SFX mixer), and the HUD.
 *
 * The render loop is driven externally — call {@link update} once per frame and
 * {@link render} to draw.
 */
export class SceneComposer {
  // --- three.js core ---
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly scene: THREE.Scene;

  // --- subsystems ---
  private readonly cameraController: CameraController;
  private readonly traffic: TrafficSystem;
  private readonly pedestrians: PedestrianSystem;
  private readonly mixer: SfxMixer | null;
  private readonly hud: TimelineHud;
  private readonly transition: TransitionController;

  // --- block layout ---
  private readonly lots: BuildingLot[];

  // --- era state ---
  private currentEra: EraSpec;

  // --- scene groups (era content is managed by the TransitionController) ---
  private readonly blockGroup: THREE.Group;

  // --- lighting ---
  private readonly ambientLight: THREE.AmbientLight;
  private readonly sunLight: THREE.DirectionalLight;
  private readonly hemiLight: THREE.HemisphereLight;

  // --- render state ---
  private clock: THREE.Clock;
  private disposed = false;

  /** Bound resize handler. */
  private readonly _onResize = (): void => this.handleResize();

  constructor(options: SceneComposerOptions) {
    this.renderer = options.renderer;
    this.camera = options.camera;
    this.scene = new THREE.Scene();

    const initialId = options.initialEra ?? '1945';
    this.currentEra = getEra(initialId);

    // Compute the static block layout
    this.lots = computeBlockLayout();

    // Container group for the current era's block contents
    this.blockGroup = new THREE.Group();
    this.blockGroup.name = 'block';
    this.scene.add(this.blockGroup);

    // --- Lighting setup ---
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xddeeff, 0x808080, 0.5);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff5e0, 0.9);
    this.sunLight.position.set(30, 50, 20);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 200;
    const shadowCam = this.sunLight.shadow.camera as THREE.OrthographicCamera;
    shadowCam.left = -40;
    shadowCam.right = 40;
    shadowCam.top = 40;
    shadowCam.bottom = -40;
    this.scene.add(this.sunLight);

    // --- Sky ---
    this.scene.background = new THREE.Color(0x87a8c8);
    this.scene.fog = new THREE.Fog(0x87a8c8, 60, 150);

    // --- Subsystems ---
    this.cameraController = new CameraController(this.camera, {
      domElement: options.canvas,
      blockHalfExtent: 20,
      groundSize: 100,
    });
    // Set collision boxes from the building lots
    const boxes = lotCollisionBoxes(this.lots);
    this.cameraController.setCollisionBoxes(boxes as CollisionBox[]);

    this.traffic = new TrafficSystem(this.scene);
    this.pedestrians = new PedestrianSystem(this.scene);

    if (options.enableAudio ?? true) {
      this.mixer = new SfxMixer();
    } else {
      this.mixer = null;
    }

    // --- Transition controller ---
    // Wired to the HUD's era-change callback so every slider move triggers a
    // smooth crossfade instead of a hard snap.
    this.transition = new TransitionController({
      blockGroup: this.blockGroup,
      lots: this.lots,
      ambientLight: this.ambientLight,
      sunLight: this.sunLight,
      skyColor: this.scene.background as THREE.Color,
      fogColor: this.scene.fog ? (this.scene.fog as THREE.Fog).color : null,
      traffic: this.traffic,
      pedestrians: this.pedestrians,
      mixer: this.mixer,
    });

    // --- HUD ---
    this.hud = new TimelineHud({
      container: options.hudContainer,
      initialEra: initialId,
    });

    // Wire HUD era changes through the transition controller for smooth
    // crossfades instead of hard snaps.
    this.hud.onEraChange((_eraId, era, _prev) => {
      void _prev;
      this.currentEra = era;
      this.transition.beginTransition(era);
    });

    // --- Clock ---
    this.clock = new THREE.Clock();

    // --- Resize ---
    window.addEventListener('resize', this._onResize);

    // Apply the initial era instantly (no transition on startup).
    this.transition.setEra(this.currentEra);

    // Pre-generate all era assets to avoid hitches on first switch
    this.pregenerateAssets();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** The underlying three.js scene. */
  get threeScene(): THREE.Scene {
    return this.scene;
  }

  /** The current era spec. */
  get era(): EraSpec {
    return this.currentEra;
  }

  /** The camera controller. */
  get cameraCtl(): CameraController {
    return this.cameraController;
  }

  /** The timeline HUD. */
  get timelineHud(): TimelineHud {
    return this.hud;
  }

  /**
   * Per-frame update: advance the clock, update all subsystems, and sync the
   * camera.
   *
   * @returns The delta time in seconds.
   */
  update(): number {
    if (this.disposed) return 0;
    const dt = this.clock.getDelta();

    this.cameraController.update(dt);
    this.traffic.update(dt);
    this.pedestrians.update(dt);
    if (this.mixer) this.mixer.update(dt);

    // Advance any in-progress era transition (building/street crossfade,
    // lighting interpolation).
    this.transition.update(dt);

    return dt;
  }

  /** Render the current frame. */
  render(): void {
    if (this.disposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Programmatically switch to a specific era (also updates the HUD slider).
   * @param eraId  The era to switch to.
   */
  setEra(eraId: EraId): void {
    this.hud.setEra(eraId);
  }

  /** Resume audio (call after a user gesture to satisfy autoplay policy). */
  resumeAudio(): void {
    if (this.mixer) void this.mixer.resume();
  }

  /** Dispose all resources and remove event listeners. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    window.removeEventListener('resize', this._onResize);

    this.transition.dispose();
    this.traffic.dispose();
    this.pedestrians.dispose();
    this.cameraController.dispose();
    this.hud.dispose();
    if (this.mixer) this.mixer.dispose();

    // Dispose scene geometry
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose());
      } else if (mat) {
        mat.dispose();
      }
    });

    this.renderer.dispose();
  }

  // -------------------------------------------------------------------------
  // Private: asset pre-generation
  // -------------------------------------------------------------------------

  /**
   * Pre-generate assets for all eras to avoid frame hitches when the user
   * first switches to each era.
   *
   * This preloads the full asset set (textures, streets, vehicles,
   * pedestrians) **and** the era-specific buildings (which require the lot
   * layout). After this runs, every era switch is a cache hit and the slider
   * responds instantly.
   */
  private pregenerateAssets(): void {
    const allEras = getAllEras();
    for (const era of allEras) {
      // Preload textures, streets, vehicles, and pedestrians.
      getEraAssets(era);
      // Preload buildings for this era's lots (cached as templates).
      populateBuildings(era, this.lots);
    }
  }

  // -------------------------------------------------------------------------
  // Private: helpers
  // -------------------------------------------------------------------------

  /** Handle window resize: update camera aspect and renderer size. */
  private handleResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
