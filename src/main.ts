/**
 * Minimal Vite dev entry proving a runnable WebGL shell.
 *
 * Owns the canvas mount, renderer/camera/controls lifecycle, resize handling
 * and global disposal. Scene content arrives in later tasks — this shell only
 * proves three.js imports and renders a non-empty scene.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ERA_REGISTRY } from './eras';

function supportsWebGL2(): boolean {
  try {
    const probe = document.createElement('canvas');
    return Boolean(probe.getContext('webgl2'));
  } catch {
    return false;
  }
}

function showFatalFallback(message: string): void {
  const el = document.createElement('div');
  el.className = 'shell-error';
  el.textContent = message;
  document.body.appendChild(el);
}

function mountShell(): void {
  const container = document.querySelector('#app');
  if (!(container instanceof HTMLElement)) {
    showFatalFallback('City Era Timelapse: missing #app mount point.');
    return;
  }
  if (!supportsWebGL2()) {
    showFatalFallback('City Era Timelapse requires a WebGL2-capable browser.');
    return;
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hud = document.createElement('div');
  hud.className = 'shell-hud';
  hud.innerHTML =
    'City Era Timelapse · WebGL shell ready · eras ' +
    `<strong>${ERA_REGISTRY.map((era) => era.id).join(' → ')}</strong>`;
  container.appendChild(hud);

  const canvas = document.createElement('canvas');
  container.appendChild(canvas);

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (error) {
    showFatalFallback(`WebGL initialization failed: ${String(error)}`);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x10141d);
  scene.fog = new THREE.Fog(0x10141d, 60, 220);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600);
  camera.position.set(26, 18, 30);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(0, 2, 0);

  const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x30271e, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe6bd, 1.4);
  sun.position.set(30, 42, 18);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(140, 64),
    new THREE.MeshStandardMaterial({ color: 0x232a36, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const grid = new THREE.GridHelper(280, 56, 0x3c4a61, 0x2a3342);
  grid.position.y = 0.01;
  scene.add(grid);

  // Placeholder city block: deterministic pseudo-random building masses so the
  // scene is visibly non-empty before real era content lands.
  const blockMat = new THREE.MeshStandardMaterial({ color: 0x8a93a6, roughness: 0.7, metalness: 0.15 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xf2b134, roughness: 0.5, metalness: 0.35 });
  const group = new THREE.Group();
  let seed = 20250822;
  const rand = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 30; i++) {
    const w = 3 + rand() * 4;
    const d = 3 + rand() * 4;
    const h = 4 + rand() * 22;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      i % 6 === 0 ? accentMat : blockMat,
    );
    const gx = (i % 6) - 2.5;
    const gz = Math.floor(i / 6) - 2;
    mesh.position.set(gx * 9 + w * 0.2, h / 2, gz * 9 + d * 0.2);
    group.add(mesh);
  }
  scene.add(group);

  const resize = (): void => {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  };
  resize();

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  window.addEventListener('resize', resize);

  const timer = new THREE.Timer();
  renderer.setAnimationLoop((time) => {
    timer.update(time);
    const dt = timer.getDelta();
    if (!prefersReducedMotion) {
      group.rotation.y += dt * 0.05;
    }
    controls.update();
    renderer.render(scene, camera);
  });

  const dispose = (): void => {
    renderer.setAnimationLoop(null);
    resizeObserver.disconnect();
    window.removeEventListener('resize', resize);
    controls.dispose();
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const material of materials) material.dispose();
      }
    });
    grid.dispose();
    renderer.dispose();
    canvas.remove();
    hud.remove();
  };
  window.addEventListener('pagehide', dispose, { once: true });
}

mountShell();
