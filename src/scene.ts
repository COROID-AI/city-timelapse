import * as THREE from 'three';

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  dispose: () => void;
}

/**
 * Creates the core Three.js stage: a perspective camera, a WebGL renderer with
 * soft shadows, a three-light rig (ambient + hemisphere + directional sun), and
 * a self-running requestAnimationFrame render loop. Handles viewport resizing
 * and full cleanup via the returned `dispose` function.
 */
export function createScene(container: HTMLElement): SceneContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fb4d6);
  scene.fog = new THREE.Fog(0x8fb4d6, 80, 240);

  const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / container.clientHeight,
    0.1,
    1000,
  );
  camera.position.set(48, 42, 58);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // ---- Lighting rig ----
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a5a3a, 0.5);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 1.05);
  sun.position.set(40, 64, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 220;
  scene.add(sun);

  // ---- Resize handling ----
  const onResize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };
  window.addEventListener('resize', onResize);

  // ---- Render loop ----
  let animationId = 0;
  const animate = () => {
    animationId = requestAnimationFrame(animate);
    renderer.render(scene, camera);
  };
  animate();

  const dispose = () => {
    cancelAnimationFrame(animationId);
    window.removeEventListener('resize', onResize);
    renderer.dispose();
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  };

  return { scene, camera, renderer, dispose };
}
