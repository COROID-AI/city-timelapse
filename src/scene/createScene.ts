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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // ACES filmic tone mapping for a cinematic, high-end look (applied by the
  // post-processing OutputPass when enabled, and by the renderer otherwise).
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = options.postProcessingOptions?.exposure ?? 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

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
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
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

  // Optional post-processing pipeline.
  const postProcessing =
    options.postProcessing === false
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
