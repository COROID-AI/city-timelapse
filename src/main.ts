/**
 * Main entry point - Initializes Three.js scene, renderer, camera, lighting, and core game loop
 */

import * as THREE from 'three';
import { CityScene } from './scene';
import { CameraController } from './cameraController';
import { SfxMixer } from './audio/mixer';
import type { EraId } from './eras';
import { TimelineUI } from './hud/timeline';

class CityTimelapseApp {
  private scene!: CityScene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private cameraController: CameraController;
  private sfxMixer: SfxMixer;
  private timelineUI: TimelineUI;
  private animationId: number | null = null;
  private lastTime: number = 0;
  private loadingScreen: HTMLElement;
  private isLoading: boolean = true;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
    this.renderer = this.createRenderer();
    this.cameraController = new CameraController(this.camera, this.getCanvas());
    this.sfxMixer = new SfxMixer();
    this.timelineUI = new TimelineUI();
    this.loadingScreen = this.createLoadingScreen();
    
    this.setupEventListeners();
    this.setupLighting();
  }

  private createRenderer(): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: false 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    document.body.appendChild(renderer.domElement);
    return renderer;
  }

  private createLoadingScreen(): HTMLElement {
    const loading = document.createElement('div');
    loading.id = 'loading-screen';
    loading.innerHTML = `
      <div class="loading-content">
        <h2>Loading City Timelapse...</h2>
        <div class="progress-bar">
          <div class="progress-fill" id="progress-fill"></div>
        </div>
        <div class="loading-text" id="loading-text">Initializing...</div>
      </div>
    `;
    loading.className = 'loading-screen';
    document.body.appendChild(loading);
    return loading;
  }

  private setupEventListeners(): void {
    window.addEventListener('resize', this.handleResize);
    this.timelineUI.onEraChange((eraId) => this.changeEra(eraId));
  }

  private handleResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private setupLighting(): void {
    // Directional (sun) light
    const directional = new THREE.DirectionalLight(0xFFF5E1, 0.8);
    directional.position.set(50, 100, 50);
    directional.castShadow = true;
    directional.shadow.camera.top = 100;
    directional.shadow.camera.bottom = -100;
    directional.shadow.camera.left = -100;
    directional.shadow.camera.right = 100;
    directional.shadow.mapSize.width = 2048;
    directional.shadow.mapSize.height = 2048;
  }

  private setupHud(): void {
    document.body.appendChild(this.timelineUI.getElement());
  }

  private async initialize(): Promise<void> {
    this.scene = new CityScene();
    
    // Load initial era
    await this.loadEra('1945');
    this.hideLoadingScreen();
    this.isLoading = false;
  }

  private async loadEra(eraId: EraId): Promise<void> {
    this.showLoadingScreen();
    
    const progressCallback = (progress: number, text: string) => {
      const fill = document.getElementById('progress-fill');
      const textEl = document.getElementById('loading-text');
      if (fill) fill.style.width = `${progress * 100}%`;
      if (textEl) textEl.textContent = text;
    };
    
    progressCallback(0.3, 'Loading assets...');
    await this.scene.loadEra(eraId);
    
    progressCallback(0.6, 'Setting up audio...');
    await this.sfxMixer.init();
    await this.sfxMixer.loadAllEras();
    await this.sfxMixer.setEra(eraId);
    
    progressCallback(0.9, 'Finalizing...');
    this.scene.updateSkybox(eraId);
    this.scene.updateGround(eraId);
    
    progressCallback(1, 'Ready!');
    setTimeout(() => this.hideLoadingScreen(), 300);
  }

  private showLoadingScreen(): void {
    this.loadingScreen.style.display = 'flex';
  }

  private hideLoadingScreen(): void {
    if (!this.isLoading) {
      this.loadingScreen.style.opacity = '0';
      setTimeout(() => {
        this.loadingScreen.style.display = 'none';
      }, 300);
    }
  }

  private async changeEra(eraId: EraId): Promise<void> {
    await this.loadEra(eraId);
    this.sfxMixer.playEventSound();
  }

  private getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  private animate = (time: number = 0): void => {
    const deltaTime = time - this.lastTime;
    this.lastTime = time;
    
    if (this.scene && !this.isLoading) {
      const bounds = new THREE.Vector3(-40, 1, -40);
      this.cameraController.update(deltaTime, { min: bounds, max: bounds });
    }
    
    this.renderer.render(this.scene.getScene(), this.camera);
    this.animationId = requestAnimationFrame(this.animate);
  };

  async start(): Promise<void> {
    await this.initialize();
    this.setupHud();
    this.animate();
  }

  dispose(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.scene.dispose();
    this.cameraController.dispose();
    this.sfxMixer.dispose();
    this.timelineUI.dispose();
    this.renderer.dispose();
  }
}

// Initialize app on user gesture
const initButton = document.createElement('button');
initButton.textContent = 'Enter City';
initButton.className = 'enter-button';
initButton.style.cssText = `
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 20px 40px;
  font-size: 24px;
  cursor: pointer;
  z-index: 1000;
`;

document.body.appendChild(initButton);

initButton.addEventListener('click', async () => {
  initButton.style.display = 'none';
  const app = new CityTimelapseApp();
  await app.start();
  
  // Store reference for cleanup
  (window as unknown as Record<string, unknown>).cityApp = app;
});

// Handle page unload
window.addEventListener('beforeunload', () => {
  const app = (window as unknown as Record<string, unknown>).cityApp as { dispose: () => void } | undefined;
  if (app) app.dispose();
});