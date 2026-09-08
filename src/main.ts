/**
 * Foundation entrypoint for the neon-racer game.
 *
 * Boots a Three.js WebGLRenderer with a dark night background and a
 * dt-driven requestAnimationFrame update loop, plus full-viewport
 * window-resize handling.
 *
 * Lifecycle contract (consumed by integration-polish):
 *   `instantiate()`  -> create the scene, camera, renderer, and mounts
 *   `attach(host)`   -> add the renderer canvas to a DOM host element
 *   `update(dt)`     -> advance the world by `dt` seconds and render a frame
 *   `dispose()`      -> release the loop, renderer, and event listeners
 *
 * Later race systems (cars, track, camera, HUD) hook into `update(dt)` so the
 * single rAF loop stays the frame authority.
 */
import * as THREE from 'three';

/** A mounted, running neon-racer game instance. */
export interface RacerApp {
  /** The mounted WebGL canvas. */
  readonly canvas: HTMLCanvasElement;
  /** The Three.js scene. */
  readonly scene: THREE.Scene;
  /** The PerspectiveCamera used to frame the action. */
  readonly camera: THREE.PerspectiveCamera;
  /** The WebGLRenderer. */
  readonly renderer: THREE.WebGLRenderer;
  /** The underlying rAF handle (usable to cancel the loop). */
  readonly raf: number;
  /** Create the scene/camera/renderer (no DOM attached yet). */
  instantiate(): RacerApp;
  /** Append the renderer canvas to `host` and start the rAF loop. */
  attach(host: HTMLElement): RacerApp;
  /** Advance the world by `dt` seconds and render this frame. */
  update(dt: number): void;
  /** Stop the loop, release resources, and leave no listeners behind. */
  dispose(): void;
}

/** Dark night backdrop shared by the clear color and ambient light. */
const NIGHT_BG = 0x05070f;

/** Build a minimal static night street scene worth rendering this milestone. */
function buildScene(container: THREE.Object3D): void {
  // Ambient fill so shapes stay visible against the near-black sky.
  const ambient = new THREE.AmbientLight(0x334466, 0.6);
  container.add(ambient);

  // A cool directional "moonlight" giving the road some shading.
  const moon = new THREE.DirectionalLight(0xaac4ff, 1.2);
  moon.position.set(20, 40, 10);
  container.add(moon);

  // Simple flat roadway plane laid along the ground.
  const roadGeo = new THREE.PlaneGeometry(80, 400);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x1a2030,
    roughness: 0.9,
    metalness: 0.1,
  });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.z = -160;
  container.add(road);

  // Neon accent strips along the road edges to sell the night aesthetic.
  const stripMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
  const stripGeo = new THREE.BoxGeometry(0.6, 0.1, 400);
  for (const side of [-1, 1]) {
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(side * 40, 0.1, -160);
    container.add(strip);
  }
}

/**
 * Concrete game instance. Keeps the loop, resize listener, and scene tightly
 * owned so `dispose()` is a single, complete teardown.
 */
class NeonRacerApp implements RacerApp {
  readonly canvas: HTMLCanvasElement;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  raf = 0;

  private readonly clock = new THREE.Clock();
  private mounted = false;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(NIGHT_BG);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      2000,
    );
    this.camera.position.set(0, 40, 24);
    this.camera.lookAt(0, 0, -140);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.canvas = this.renderer.domElement;

    buildScene(this.scene);
  }

  /** Stub to satisfy the interface: construction already instantiates. */
  instantiate(): RacerApp {
    return this;
  }

  /** Append the canvas to `host`, sync size, and start the rAF loop. */
  attach(host: HTMLElement): RacerApp {
    if (this.mounted) {
      return this;
    }
    this.mounted = true;
    host.appendChild(this.canvas);
    this.updateSize();
    window.addEventListener('resize', this.onResize);
    this.raf = requestAnimationFrame(this.frame);
    return this;
  }

  /** The rAF tick: advance the world by `dt` and render a frame. */
  private readonly frame = (): void => {
    this.raf = requestAnimationFrame(this.frame);
    this.update(this.clock.getDelta());
  };

  /** Keep the camera and renderer matched to the current viewport. */
  private readonly onResize = (): void => {
    this.updateSize();
  };

  private updateSize(): void {
    const { innerWidth, innerHeight } = window;
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  /**
   * Advance the world by `dt` seconds and render this frame.
   * This is the integration point for the full race simulation (cars, track,
   * camera, HUD). This milestone keeps the scene static but honors `dt`.
   */
  update(dt: number): void {
    void dt;
    this.renderer.render(this.scene, this.camera);
  }

  /** Stop the loop, remove the canvas, and drop all listeners. */
  dispose(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    this.canvas.remove();
    this.mounted = false;
  }
}

/**
 * Boot the app into `#app` (or an explicit host) and hand back the instance.
 * The rAF loop runs automatically once attached; late-joining race systems
 * can still be driven through `update()` by mutating the scene.
 */
export function bootstrap(): RacerApp {
  const app = new NeonRacerApp();
  const host = document.getElementById('app');
  if (host) {
    app.attach(host);
  }
  return app;
}

// Self-boot when this module is loaded directly as the Vite entrypoint.
bootstrap();