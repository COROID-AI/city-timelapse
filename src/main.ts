import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CityScene } from './scene/CityScene';
import { UI, type BuildingCardData } from './ui/UI';
import { AudioEngine } from './audio/AudioEngine';
import { ERAS, ERA_COUNT } from './config/eras';
import './styles.css';

// ============================================================================
// Main entry — sets up Three.js renderer, camera, OrbitControls, wires the
// CityScene, UI, and AudioEngine. Runs the animation loop and handles
// raycasting, timelapse playback, and keyboard shortcuts.
// ============================================================================

class App {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private city: CityScene;
  private ui: UI;
  private audio: AudioEngine;
  private raycaster: THREE.Raycaster;
  private pointer: THREE.Vector2;
 private lastFrame: number = 0;

  // playback
  private isPlaying = false;
  private isLooping = true;
  private dwellTimer = 0;
  private dwellDuration = 2.8; // seconds to dwell on each era
  private transitionDuration = 1.4;
  private waitingForTransition = false;

  // interaction state — to distinguish click vs drag
  private pointerDownPos = new THREE.Vector2();
  private pointerDownTime = 0;
  private didDrag = false;

  constructor() {
    const root = document.getElementById('scene-root')!;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
   this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    root.appendChild(this.renderer.domElement);

    // Camera
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(48, 32, 48);
    this.camera.lookAt(0, 8, 0);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 20;
    this.controls.maxDistance = 120;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // bounded so you can't clip under ground
    this.controls.minPolarAngle = 0.15;
    this.controls.target.set(0, 8, 0);
    this.controls.autoRotateSpeed = 0.8;
    this.controls.update();

    // Scene
    this.city = new CityScene(this.renderer);

    // Audio
    this.audio = new AudioEngine();

    // Raycasting
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    // UI
    this.ui = new UI({
      onEraChange: (idx) => this.handleEraChange(idx),
      onPlayToggle: () => this.togglePlay(),
      onLoopToggle: (on) => { this.isLooping = on; this.ui.setLooping(on); },
      onSoundToggle: () => this.toggleSound(),
      onAutoRotateToggle: () => this.toggleAutoRotate(),
      onBuildingInfo: (info) => { if (!info) this.ui.hideInfo(); },
      onFirstGesture: () => this.audio.init(),
    });

    this.bindResize();
    this.bindRaycast();

    // Initial state
    this.ui.setLooping(this.isLooping);
    this.audio.setEra(ERAS[0], 0);

    // Hide loader after first frame
    requestAnimationFrame(() => {
      this.ui.hideLoader();
      this.ui.fadeHelpHint();
    });
  }

  private bindResize(): void {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  private bindRaycast(): void {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', (e) => {
      this.pointerDownPos.set(e.clientX, e.clientY);
      this.pointerDownTime = performance.now();
      this.didDrag = false;
    });
    canvas.addEventListener('pointermove', (e) => {
      const dx = e.clientX - this.pointerDownPos.x;
      const dy = e.clientY - this.pointerDownPos.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        this.didDrag = true;
      }
    });
    canvas.addEventListener('pointerup', (e) => {
      // Only raycast on click (no drag)
      if (this.didDrag) return;
      const dt = performance.now() - this.pointerDownTime;
      if (dt > 400) return; // long press, ignore

      this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.city.raycastBuilding(this.raycaster);
      if (hit) {
        const data: BuildingCardData = {
          name: hit.info.name,
          year: hit.info.year,
          style: hit.info.style,
          height: hit.info.height,
          floors: hit.info.floors,
          description: hit.info.description,
        };
        this.ui.showInfo(data);
        this.audio.playClick();
      }
    });
  }

  private handleEraChange(idx: number): void {
    this.city.setEra(idx);
    this.audio.setEra(ERAS[idx], idx);
    this.audio.playClick();
    this.ui.setEra(idx);
    // reset playback dwell
    this.dwellTimer = 0;
    this.waitingForTransition = false;
  }

  private togglePlay(): void {
    this.isPlaying = !this.isPlaying;
    this.ui.setPlaying(this.isPlaying);
    this.audio.playClick();
    if (this.isPlaying) {
      this.dwellTimer = 0;
      this.waitingForTransition = false;
    }
  }

  private toggleSound(): void {
    const on = !this.audio.isEnabled();
    this.audio.setEnabled(on);
    this.ui.setSoundOn(on);
    if (on) {
      this.audio.setEra(ERAS[this.city.eraIndex], this.city.eraIndex);
      this.audio.playClick();
    }
  }

  private toggleAutoRotate(): void {
    this.controls.autoRotate = !this.controls.autoRotate;
    this.ui.setAutoRotate(this.controls.autoRotate);
    this.audio.playClick();
  }

  private updatePlayback(dt: number): void {
    if (!this.isPlaying) return;

    if (this.city.isTransitioning) {
      this.waitingForTransition = true;
      return;
    }
    if (this.waitingForTransition) {
      this.waitingForTransition = false;
      this.dwellTimer = 0;
    }

    this.dwellTimer += dt;
    if (this.dwellTimer >= this.dwellDuration) {
      this.dwellTimer = 0;
      let next = this.city.eraIndex + 1;
      if (next >= ERA_COUNT) {
        if (this.isLooping) {
          next = 0;
        } else {
          this.isPlaying = false;
          this.ui.setPlaying(false);
          return;
        }
      }
      this.handleEraChange(next);
    }
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
   const now = performance.now() / 1000;
   const dt = this.lastFrame === 0 ? 0.016 : Math.min(now - this.lastFrame, 0.1);
   this.lastFrame = now;

    this.controls.update();
    this.city.update(dt, now, this.renderer);
    this.audio.update();
    this.updatePlayback(dt);

    this.renderer.render(this.city.scene, this.camera);
  };

  start(): void {
    this.animate();
  }
}

// Bootstrap
const app = new App();
app.start();
