/**
 * Renderer lifecycle for the application.
 *
 * The composition root (src/main.ts) is the only caller of `bootRenderer()`.
 * The returned renderer owns the WebGL context and animation loop; scene
 * modules never touch it directly.
 */
import {
  ACESFilmicToneMapping,
  SRGBColorSpace,
  WebGLRenderer,
  type ColorSpace,
} from 'three';

export interface BootedRenderer {
  /** The live renderer instance (also returned by renderer.render). */
  renderer: WebGLRenderer;
  /** Replaces the renderer's animation loop callback. */
  setAnimationLoop: (callback: (timeMs: number) => void) => void;
  /** Releases GPU resources and stops the loop. */
  dispose: () => void;
}

const TONE_MAPPING_EXPOSURE = 1.0;

/**
 * Creates a WebGL2 renderer sized to the mount element and appends its
 * canvas to the mount point. Configures tone mapping and color management
 * once here so downstream scene tasks inherit a consistent look.
 */
export function bootRenderer(mount: HTMLElement, options: { colorSpace?: ColorSpace } = {}): BootedRenderer {
  const colorSpace: ColorSpace = options.colorSpace ?? SRGBColorSpace;
  const width = mount.clientWidth || 1;
  const height = mount.clientHeight || 1;

  const renderer = new WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.outputColorSpace = colorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;

  mount.appendChild(renderer.domElement);

  const setAnimationLoop = (callback: (timeMs: number) => void): void => {
    renderer.setAnimationLoop((timeMs: number) => callback(timeMs));
  };

  const dispose = (): void => {
    renderer.setAnimationLoop(null);
    renderer.dispose();
    renderer.domElement.remove();
  };

  return { renderer, setAnimationLoop, dispose };
}