/**
 * Scene and render shell for the Timelapse City app.
 *
 * Owns the minimal runtime every later domain module plugs into:
 * a Three.js scene with an empty `cityRoot` group, a lit ground plane, a
 * shadow-ready renderer, a clock-driven render loop, window resize handling,
 * and the fixed top UI overlay root reserved for the timeline slider.
 *
 * All visuals are procedural; nothing is downloaded at runtime.
 */

import * as THREE from 'three';

/** DOM id of the fixed overlay root that hosts the timeline UI. */
export const OVERLAY_ROOT_ID = 'ui-overlay';

/** Per-frame update callback: delta seconds, then elapsed seconds since start. */
export type UpdateCallback = (deltaSeconds: number, elapsedSeconds: number) => void;

/** A scene graph without any GPU resources; safe to build in unit tests. */
export interface CityScene {
  scene: THREE.Scene;
  /** Empty root group that every era/domain module will attach content to. */
  cityRoot: THREE.Group;
  /** Lit ground plane the city block sits on. */
  ground: THREE.Mesh;
}

/** Full runtime shell: renderer, camera, loop, resize handling, overlay root. */
export interface AppShell {
  readonly scene: THREE.Scene;
  readonly cityRoot: THREE.Group;
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly overlayRoot: HTMLElement;
  /** Register a per-frame updater; returns an unsubscribe function. */
  onUpdate(callback: UpdateCallback): () => void;
  /** Start the clock-driven render loop (idempotent). */
  start(): void;
  /** Pause the render loop (idempotent). */
  stop(): void;
  /** Sync renderer and camera to the current container size. */
  resize(): void;
  /** Stop the loop, detach listeners, and release GPU resources. */
  dispose(): void;
}

const GROUND_SIZE = 240;
const CAMERA_FOV = 50;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 600;
const MAX_PIXEL_RATIO = 2;

/**
 * Build the scene graph: background, fog, hemisphere + directional lighting,
 * the `cityRoot` attachment group, and the shadow-receiving ground plane.
 */
export function createCityScene(): CityScene {
  const scene = new THREE.Scene();
  const skyColor = 0x9ec7e8;
  scene.background = new THREE.Color(skyColor);
  scene.fog = new THREE.Fog(skyColor, 90, 320);

  // Empty attachment root; later tasks populate it with buildings/vehicles/etc.
  const cityRoot = new THREE.Group();
  cityRoot.name = 'cityRoot';
  scene.add(cityRoot);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x6d7a68, roughness: 0.95, metalness: 0 }),
  );
  ground.name = 'ground';
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const hemisphere = new THREE.HemisphereLight(0xdfeaff, 0x4a4438, 0.85);
  hemisphere.name = 'hemisphereLight';
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xfff3dd, 2.1);
  sun.name = 'sunLight';
  sun.position.set(60, 90, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 320;
  sun.shadow.camera.left = -120;
  sun.shadow.camera.right = 120;
  sun.shadow.camera.top = 120;
  sun.shadow.camera.bottom = -120;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  return { scene, cityRoot, ground };
}

/**
 * Create the fixed, top-of-screen overlay root reserved for the timeline
 * slider. Appended last so it stacks above the WebGL canvas.
 */
export function createOverlayRoot(host: HTMLElement, doc: Document = host.ownerDocument): HTMLElement {
  const overlay = doc.createElement('div');
  overlay.id = OVERLAY_ROOT_ID;
  overlay.className = 'ui-overlay';
  overlay.setAttribute('data-testid', 'ui-overlay-root');

  const timelineSlot = doc.createElement('div');
  timelineSlot.className = 'timeline-slot';
  timelineSlot.setAttribute('data-timeline-slot', '');
  timelineSlot.setAttribute('role', 'group');
  timelineSlot.setAttribute('aria-label', 'Timeline');
  const label = doc.createElement('span');
  label.className = 'timeline-slot__label';
  label.textContent = 'Timeline';
  timelineSlot.appendChild(label);

  overlay.appendChild(timelineSlot);
  host.appendChild(overlay);
  return overlay;
}

/**
 * Build the complete runtime shell inside `container`: shadow-ready renderer,
 * perspective camera, scene graph, resize handling, and rAF render loop.
 */
export function createAppShell(container: HTMLElement): AppShell {
  const { scene, cityRoot } = createCityScene();

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'scene-canvas';
  renderer.domElement.setAttribute('aria-label', '3D city scene');
  container.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, CAMERA_NEAR, CAMERA_FAR);
  camera.name = 'mainCamera';
  camera.position.set(26, 20, 26);
  camera.lookAt(0, 1, 0);

  const clock = new THREE.Clock(false);
  const updaters = new Set<UpdateCallback>();
  let elapsedSeconds = 0;
  let frameId = 0;
  let running = false;
  let disposed = false;

  const resize = (): void => {
    if (disposed) return;
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const handleWindowResize = (): void => resize();
  window.addEventListener('resize', handleWindowResize);
  resize();

  const frame = (): void => {
    if (!running) return;
    frameId = window.requestAnimationFrame(frame);
    const deltaSeconds = Math.min(clock.getDelta(), 0.1);
    elapsedSeconds += deltaSeconds;
    for (const update of updaters) update(deltaSeconds, elapsedSeconds);
    renderer.render(scene, camera);
  };

  const start = (): void => {
    if (disposed || running) return;
    running = true;
    clock.start();
    frame();
  };

  const stop = (): void => {
    if (!running) return;
    running = false;
    clock.stop();
    window.cancelAnimationFrame(frameId);
  };

  const onUpdate = (callback: UpdateCallback): (() => void) => {
    updaters.add(callback);
    return () => updaters.delete(callback);
  };

  const dispose = (): void => {
    if (disposed) return;
    stop();
    disposed = true;
    updaters.clear();
    window.removeEventListener('resize', handleWindowResize);
    renderer.dispose();
    renderer.domElement.remove();
  };

  const overlayRoot = createOverlayRoot(container);

  return {
    scene,
    cityRoot,
    renderer,
    camera,
    overlayRoot,
    onUpdate,
    start,
    stop,
    resize,
    dispose,
  };
}
