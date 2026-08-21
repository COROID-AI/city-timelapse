import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TimelineController } from './core/TimelineController';
import { initTimelineStrip } from './ui/timelineStrip';

/** Device pixel ratios above this are wasted GPU work. */
const MAX_PIXEL_RATIO = 2;

function hasWebGL2(): boolean {
  try {
    const probe = document.createElement('canvas');
    return Boolean(probe.getContext('webgl2'));
  } catch {
    return false;
  }
}

function revealFallback(): void {
  document.getElementById('webgl-fallback')?.removeAttribute('hidden');
}

/** Gradient sky dome; a large back-faced sphere with a vertical ramp. */
function createSkyDome(scene: THREE.Scene): void {
  const geometry = new THREE.SphereGeometry(900, 32, 20);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uZenith: { value: new THREE.Color('#4f7fb8') },
      uHorizon: { value: new THREE.Color('#e2d5b8') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        float gradient = pow(clamp(h, 0.0, 1.0), 0.55);
        gl_FragColor = vec4(mix(uHorizon, uZenith, gradient), 1.0);
      }
    `,
  });
  const dome = new THREE.Mesh(geometry, material);
  dome.name = 'sky-dome';
  scene.add(dome);
}

/** Ambient + key directional (shadowed) + cool fill lighting rig. */
function createLightRig(scene: THREE.Scene): void {
  const ambient = new THREE.AmbientLight('#cdd9ef', 0.55);
  ambient.name = 'ambient-rig';

  const sun = new THREE.DirectionalLight('#fff1d0', 2.6);
  sun.position.set(52, 78, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 260;
  sun.shadow.camera.left = -110;
  sun.shadow.camera.right = 110;
  sun.shadow.camera.top = 110;
  sun.shadow.camera.bottom = -110;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.name = 'sun-key';

  const fill = new THREE.DirectionalLight('#a9bff0', 0.5);
  fill.position.set(-40, 26, -34);
  fill.name = 'sky-fill';

  scene.add(ambient, sun, fill);
}

/** Ground plane, central block plaza and a faint survey grid. */
function createGround(scene: THREE.Scene): void {
  const terrain = new THREE.Mesh(
    new THREE.PlaneGeometry(640, 640),
    new THREE.MeshStandardMaterial({ color: '#77855f', roughness: 1, metalness: 0 }),
  );
  terrain.rotation.x = -Math.PI / 2;
  terrain.receiveShadow = true;
  terrain.name = 'ground-plane';

  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(46, 56),
    new THREE.MeshStandardMaterial({ color: '#3b3f47', roughness: 0.94, metalness: 0 }),
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.02;
  plaza.receiveShadow = true;
  plaza.name = 'block-plaza';

  const grid = new THREE.GridHelper(360, 72, '#ffffff', '#ffffff');
  grid.position.y = 0.04;
  grid.material.transparent = true;
  grid.material.opacity = 0.05;
  grid.material.depthWrite = false;
  grid.name = 'survey-grid';

  scene.add(terrain, plaza, grid);
}

function bootstrap(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#scene-canvas');
  if (!canvas) {
    throw new Error('main: #scene-canvas not found');
  }
  if (!hasWebGL2()) {
    revealFallback();
    return;
  }

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
  } catch (error) {
    console.error('main: WebGL initialization failed', error);
    revealFallback();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#ddd0b4', 0.0026);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 3000);
  camera.position.set(34, 20, 40);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 4, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 10;
  controls.maxDistance = 260;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.update();

  createSkyDome(scene);
  createLightRig(scene);
  createGround(scene);

  const resize = (): void => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(document.body);
  window.addEventListener('resize', resize);
  resize();

  const controller = new TimelineController({ initialEra: '1945' });
  const strip = initTimelineStrip(controller);

  const timer = new THREE.Timer();
  timer.connect(document);
  renderer.setAnimationLoop((time) => {
    timer.update(time);
    const delta = Math.min(timer.getDelta(), 0.1);
    controller.update(delta);
    controls.update();
    renderer.render(scene, camera);
  });

  const teardown = (): void => {
    renderer.setAnimationLoop(null);
    resizeObserver.disconnect();
    window.removeEventListener('resize', resize);
    strip.dispose();
    controller.dispose();
    controls.dispose();
    timer.disconnect();
    timer.dispose();
    scene.traverse((object) => {
      const candidate = object as Partial<THREE.Mesh>;
      candidate.geometry?.dispose();
      const material = candidate.material;
      if (Array.isArray(material)) {
        for (const entry of material) {
          entry.dispose();
        }
      } else {
        material?.dispose();
      }
    });
    renderer.dispose();
  };
  window.addEventListener('pagehide', teardown, { once: true });
}

bootstrap();
