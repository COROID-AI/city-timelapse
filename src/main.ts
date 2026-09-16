import './styles.css';

import {
  AmbientLight,
  BoxGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  WebGLRenderer,
} from 'three';
import { BLOCK_BOUNDS, LOT_EXTENTS, ROAD, SIDEWALK } from './core/blockLayout';
import { SceneRuntime, type RendererLike, type SceneLayer } from './core/sceneRuntime';

/**
 * Minimal boot for the city block timelapse shell.
 *
 * Owned by t11-app-integration: this file is replaced during final
 * composition. It wires the HUD canvas to the headless SceneRuntime and
 * registers one placeholder layer so the dev server renders an actual scene
 * inside the HUD shell with the top bar reserved for the era timeline slider.
 */

const ERA_MARKER_COLORS = [0x6b4a3a, 0x4c5f3a, 0x39506b, 0x5d3a6b];

function showFatalError(message: string): void {
  const overlay = document.querySelector<HTMLElement>('#hud-overlay');
  const messageEl = document.querySelector<HTMLElement>('#hud-message');
  overlay?.classList.add('is-error');
  if (messageEl) messageEl.textContent = `WebGL unavailable — ${message}`;
}

function createPlaceholderLayer(): SceneLayer {
  return {
    id: 'placeholder',
    createRoot() {
      const root = new Group();

      // Building-lot slab.
      const lotSlab = new Mesh(
        new BoxGeometry(BLOCK_BOUNDS.width, 0.5, BLOCK_BOUNDS.depth),
        new MeshStandardMaterial({ color: 0x232e38, roughness: 0.95 }),
      );
      lotSlab.position.y = -0.25;
      root.add(lotSlab);

      // Sidewalk ring, using the shared layout contract.
      const sidewalkMaterial = new MeshStandardMaterial({ color: 0x57616b, roughness: 0.85 });
      for (const side of [SIDEWALK.north, SIDEWALK.east, SIDEWALK.south, SIDEWALK.west]) {
        const slab = new Mesh(new BoxGeometry(side.width, 0.4, side.depth), sidewalkMaterial);
        slab.position.set((side.minX + side.maxX) / 2, 0.2, (side.minZ + side.maxZ) / 2);
        root.add(slab);
      }

      // Road ring with one band per side.
      const roadMaterial = new MeshStandardMaterial({ color: 0x2a3038, roughness: 0.9 });
      for (const band of [ROAD.north, ROAD.east, ROAD.south, ROAD.west]) {
        const slab = new Mesh(new BoxGeometry(band.width, 0.3, band.depth), roadMaterial);
        slab.position.set((band.minX + band.maxX) / 2, 0.02, (band.minZ + band.maxZ) / 2);
        root.add(slab);
      }

      // One box per lot so era layers have an obvious anchor.
      Object.values(LOT_EXTENTS).forEach((lot, index) => {
        const marker = new Mesh(
          new BoxGeometry(lot.width * 0.7, 6 + index * 2, lot.depth * 0.7),
          new MeshStandardMaterial({
            color: ERA_MARKER_COLORS[index % ERA_MARKER_COLORS.length],
            roughness: 0.8,
          }),
        );
        marker.position.set(lot.centerX, 3 + index, lot.centerZ);
        root.add(marker);
      });

      return root;
    },
  };
}

function boot(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#scene-canvas');
  if (!canvas) throw new Error('Missing #scene-canvas element in the HUD shell.');

  let webgl: WebGLRenderer;
  try {
    webgl = new WebGLRenderer({ canvas, antialias: true });
  } catch (error) {
    showFatalError(error instanceof Error ? error.message : String(error));
    return;
  }

  // Keep the runtime WebGL-agnostic: adapt WebGLRenderer to RendererLike and
  // let CSS own layout (setSize(updateStyle = false)).
  const adapter: RendererLike = {
    domElement: canvas,
    setSize: (width, height) => webgl.setSize(width, height, false),
    render: (scene, camera) => webgl.render(scene, camera),
    dispose: () => webgl.dispose(),
  };

  const runtime = new SceneRuntime({ renderer: adapter });

  const lights = new Group();
  lights.add(new AmbientLight(0xffffff, 0.6));
  const sun = new DirectionalLight(0xfff2df, 2.4);
  sun.position.set(80, 140, 70);
  lights.add(sun);
  runtime.scene.add(lights);

  runtime.attachLayer(createPlaceholderLayer());
  runtime.resize(canvas.clientWidth || 960, canvas.clientHeight || 640);
  runtime.start();

  window.addEventListener('resize', () => runtime.resize());
  window.addEventListener('beforeunload', () => runtime.dispose());
}

boot();