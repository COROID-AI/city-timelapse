import * as THREE from 'three';
import { PostProcessing, type PostProcessingOptions } from '../postprocessing/postProcessing';

export interface SceneHandle {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Active post-processing pipeline (null when disabled). */
  postProcessing: PostProcessing | null;
  resize: () => void;
  /** Render the scene — through post-processing when enabled, else direct. */
  render: () => void;
  dispose: () => void;
}

export interface CreateCitySceneOptions {
  /**
   * Enable post-processing (tone mapping + subtle bloom). Default true.
   * Set to false to keep the renderer path light for low-end devices.
   */
  postProcessing?: boolean;
  /** Optional post-processing tuning (strength, radius, threshold, exposure). */
  postProcessingOptions?: PostProcessingOptions;
}

/**
 * Detect whether the active WebGL context is a software rasterizer (e.g.
 * SwiftShader / llvmpipe). Software renderers are dramatically slower per
 * frame, so we reduce the render cost (resolution, shadow map size) to keep
 * the page responsive — while real GPUs keep the full high-end quality.
 */
function isSoftwareRenderer(renderer: THREE.WebGLRenderer): boolean {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) {
      return false;
    }
    const name = String(
      gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ??
        gl.getParameter(gl.RENDERER),
    ).toLowerCase();
    return (
      name.includes('swiftshader') ||
      name.includes('llvmpipe') ||
      name.includes('software')
    );
  } catch {
    return false;
  }
}

/**
 * Create the city scene foundation: renderer, camera, lights, and (when
 * enabled) the post-processing pipeline. Era-specific content is added later
 * by the era-transition engine; this foundation only provides a runnable,
 * inspectable stage.
 *
 * The neutral placeholder ground / "no era loaded" disc are intentionally NOT
 * added here: the era environment always supplies its own ground planes, and
 * a coplanar placeholder would z-fight with them (an integration seam).
 */
export function createCityScene(
  container: HTMLElement,
  options: CreateCitySceneOptions = {},
): SceneHandle {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  const software = isSoftwareRenderer(renderer);
  // Cap the pixel ratio. Under software rendering (SwiftShader) the per-frame
  // cost scales with the number of pixels, so we force 1x to keep RAF frames
  // fast (which also keeps DOM controls immediately clickable). On real GPUs
  // we keep up to 2x for a crisp high-DPI image.
  renderer.setPixelRatio(
    software ? 1 : Math.min(window.devicePixelRatio || 1, 2),
  );
  renderer.setSize(container.clientWidth, container.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // ACES filmic tone mapping for a cinematic, high-end look (applied by the
  // post-processing OutputPass when enabled, and by the renderer otherwise).
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = options.postProcessingOptions?.exposure ?? 1.0;
  // Shadow mapping re-renders the whole scene from the light's perspective on
  // every frame — effectively a second full render pass. Under software
  // rendering (SwiftShader) this keeps the main thread so busy that RAF frames
  // are too slow for the page to settle. We keep real-time shadows on GPU
  // renderers but disable them under software rendering for interactivity.
  renderer.shadowMap.enabled = !software;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  // Under software rendering, render into a smaller internal buffer (the DOM
  // canvas is still styled to fill the container, so it is simply upscaled).
  // This cuts the per-frame cost dramatically, letting the page settle and
  // become interactive quickly.
  if (software) {
    const scale = 0.4;
    renderer.setSize(
      Math.max(1, Math.floor(container.clientWidth * scale)),
      Math.max(1, Math.floor(container.clientHeight * scale)),
      false,
    );
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87a9c4);

  const camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight,
    0.1,
    2000,
  );
  camera.position.set(30, 22, 40);
  camera.lookAt(0, 0, 0);

  // Neutral foundation lighting. The era environment adds its own per-era
  // sun + ambient/hemisphere fill on top of this.
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff2d9, 1.6);
  sun.position.set(40, 60, 25);
  sun.castShadow = !software;
  sun.shadow.mapSize.set(software ? 128 : 1024, software ? 128 : 1024);
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 200;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);

  // Optional post-processing pipeline. Under software rendering (SwiftShader)
  // we skip the multi-pass bloom composer entirely — the per-frame cost of
  // several full-screen passes keeps the main thread so busy that RAF frames
  // are too slow for the page to settle and become clickable. On real GPUs we
  // keep the full high-end bloom pipeline. Tone mapping + shadows still apply
  // via the renderer's direct path, so the scene keeps its cinematic look.
  const postProcessing =
    options.postProcessing === false || software
      ? null
      : new PostProcessing(renderer, scene, camera, options.postProcessingOptions);

  const handle: SceneHandle = {
    renderer,
    scene,
    camera,
    postProcessing,
    resize() {
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      postProcessing?.setSize(width, height);
    },
    render() {
      if (postProcessing) {
        postProcessing.render();
      } else {
        renderer.render(scene, camera);
      }
    },
    dispose() {
      renderer.setAnimationLoop(null);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        const material = mesh.material as
          | THREE.Material
          | THREE.Material[]
          | undefined;
        if (Array.isArray(material)) {
          material.forEach((m) => m.dispose());
        } else if (material) {
          material.dispose();
        }
      });
      postProcessing?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };

  return handle;
}
