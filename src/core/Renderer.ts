import * as THREE from "three";
import WebGL from "three/addons/capabilities/WebGL.js";

export interface RendererHandle {
  readonly renderer: THREE.WebGLRenderer;
  readonly domElement: HTMLCanvasElement;
}

/**
 * Create a correctly-configured WebGL2 renderer, or return null if WebGL2 is
 * unavailable. Color management (sRGB output + ACESFilmic tone mapping) is set
 * up here so all content is authored in linear working space.
 */
export function createRenderer(container: HTMLElement): RendererHandle | null {
  if (!WebGL.isWebGL2Available()) {
    return null;
  }
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      stencil: false,
    });
  } catch {
    return null;
  }

  renderer.setClearColor(0x0a0e16, 1);
  // Correct color management: ACESFilmic tone mapping + sRGB output.
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // Soft shadows for depth cues.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  // Cap pixel ratio for performance.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const domElement = renderer.domElement;
  domElement.setAttribute("aria-label", "City era timelapse 3D view");
  domElement.tabIndex = 0;
  container.appendChild(domElement);

  return { renderer, domElement };
}

export function disposeRenderer(handle: RendererHandle): void {
  const { renderer, domElement } = handle;
  renderer.setAnimationLoop(null);
  renderer.dispose();
  if (domElement.parentElement) {
    domElement.parentElement.removeChild(domElement);
  }
}
