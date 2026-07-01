import * as THREE from 'three';
import { Era } from './eras/types';
import { getEra } from './eras/data';
import { CityBlock } from './cityBlock';
import { CameraController } from './cameraController';
import { audioEngine } from './audio/mixer';

/** Top-level scene: renderer, lights, sky, fog, and the era cross-fading city block. */
export class SceneController {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private city: CityBlock;
  private cam: CameraController;
  private sun: THREE.DirectionalLight;
  private ambient: THREE.AmbientLight;
  private hemi: THREE.HemisphereLight;
  private fog: THREE.Fog;
  private clock = new THREE.Clock();
  private raf = 0;
  private onEraChange?: (era: Era) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.scene = new THREE.Scene();
    this.fog = new THREE.Fog('#b8a890', 60, 220);
    this.scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 600);
    this.camera.position.set(50, 40, 50);

    // Lights
    this.ambient = new THREE.AmbientLight('#ffffff', 0.35);
    this.scene.add(this.ambient);

    this.hemi = new THREE.HemisphereLight('#c9b8a0', '#3a3020', 0.5);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight('#f2d9a0', 1.2);
    this.sun.position.set(60, 90, 40);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 300;
    const sc = this.sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -80;
    sc.right = 80;
    sc.top = 80;
    sc.bottom = -80;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // City block (pre-builds all 5 eras)
    this.city = new CityBlock(this.scene);

    // Camera controller
    this.cam = new CameraController(this.camera, canvas);

    // Apply initial era (1945) visuals + audio
    this.applyEra(1945, true);

    // Resize
    window.addEventListener('resize', this.onResize);
  }

  public setOnEraChange(cb: (era: Era) => void): void {
    this.onEraChange = cb;
  }

  /** Change era: triggers cross-fade in the city block + swaps palette/audio. */
  public setEra(year: Era): void {
    this.city.setEra(year);
    this.applyEra(year, false);
    this.onEraChange?.(year);
  }

  private applyEra(year: Era, isInit: boolean): void {
    const palette = getEra(year).palette;
    this.scene.background = new THREE.Color(palette.sky);
    this.fog.color.set(palette.fog);
    this.sun.color.set(palette.sun);
    this.hemi.color.set(palette.sky);
    this.hemi.groundColor.set(palette.ground);
    if (isInit) {
      this.scene.background = new THREE.Color(palette.sky);
    }
    audioEngine.setEra(getEra(year).audio);
  }

  public setMuted(m: boolean): void {
    audioEngine.setMuted(m);
  }

  public unlockAudio(): void {
    audioEngine.unlock();
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public start(): void {
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      const elapsed = this.clock.elapsedTime;
      this.cam.update(dt);
      this.city.update(dt, elapsed);
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  public dispose(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.cam.dispose();
    this.city.dispose();
    this.renderer.dispose();
  }
}
