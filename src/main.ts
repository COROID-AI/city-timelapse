/**
 * Application bootstrap for the City Time Period Timelapse scaffold.
 *
 * Named export `bootstrap` is the entrypoint contract consumed and rewritten
 * by the compose-scene-app task. It currently builds the placeholder era
 * scene: a ground grid, a block outline, and a gentle orbiting camera driven
 * by the shared render loop.
 */
import {
  BoxGeometry,
  Color,
  EdgesGeometry,
  GridHelper,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { startRenderLoop, type RenderLoopHandle } from './app/renderLoop';
import './styles/base.css';

const UP_AXIS = new Vector3(0, 1, 0);
const GROUND_EXTENT = 24;
const BLOCK_SIZE = 2.4;
const ORBIT_SPEED = 0.25; // radians per second

export interface BootstrapHandle {
  readonly renderer: WebGLRenderer | null;
  readonly loop: RenderLoopHandle;
  /** Releases the renderer, resize observers, and the render loop. */
  dispose(): void;
}

function createBlockOutline(size: number): LineSegments {
  const geometry = new EdgesGeometry(new BoxGeometry(size, size, size));
  const material = new LineBasicMaterial({ color: 0x60a5fa });
  return new LineSegments(geometry, material);
}

export function bootstrap(mount: HTMLElement): BootstrapHandle {
  if (!(mount instanceof HTMLElement)) {
    throw new TypeError('bootstrap requires an HTMLElement mount point');
  }

  const width = Math.max(1, mount.clientWidth);
  const height = Math.max(1, mount.clientHeight);

  const scene = new Scene();
  scene.background = new Color(0x0b1020);

  const camera = new PerspectiveCamera(50, width / height, 0.1, 200);
  camera.position.set(10, 7, 10);
  camera.lookAt(0, 1, 0);

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true });
  } catch {
    // Headless/software environments without WebGL still get a clean page.
    const notice = document.createElement('div');
    notice.className = 'fallback';
    notice.textContent = 'This scene needs WebGL, which is unavailable in this browser.';
    mount.replaceChildren(notice);
    return {
      renderer: null,
      loop: { running: false, dispose: () => {} },
      dispose: () => {},
    };
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  mount.replaceChildren(renderer.domElement);

  const grid = new GridHelper(GROUND_EXTENT, GROUND_EXTENT / 2, 0x60a5fa, 0x1e293b);
  scene.add(grid);

  const blockOutline = createBlockOutline(BLOCK_SIZE);
  blockOutline.position.y = BLOCK_SIZE / 2;
  scene.add(blockOutline);

  function resize(): void {
    const w = Math.max(1, mount.clientWidth);
    const h = Math.max(1, mount.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(mount);
  window.addEventListener('resize', resize);

  const loop = startRenderLoop(renderer.domElement, {
    update: (deltaSeconds) => {
      // Gentle orbit so the loop's delta time visibly drives the scene.
      camera.position.applyAxisAngle(UP_AXIS, deltaSeconds * ORBIT_SPEED);
      camera.lookAt(0, 1, 0);
      renderer.render(scene, camera);
    },
  });

  let disposed = false;

  return {
    renderer,
    loop,
    dispose() {
      if (disposed) return;
      disposed = true;
      loop.dispose();
      resizeObserver.disconnect();
      window.removeEventListener('resize', resize);
      renderer.dispose();
      mount.replaceChildren();
    },
  };
}

const root = document.querySelector<HTMLElement>('#app');
if (!root) {
  throw new Error('City Time Period Timelapse: missing #app mount element');
}
bootstrap(root);