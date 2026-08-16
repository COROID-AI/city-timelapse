/**
 * SceneManager - Core Three.js scene, camera, renderer, and render loop management.
 * 
 * Owns the Three.js scene graph, camera rig, and continuous render loop.
 * Supports dynamic camera repositioning for era transitions and proper disposal
 * when switching eras to prevent memory leaks.
 */

import * as THREE from "three";

export interface SceneManagerConfig {
  /** Horizontal field of view in degrees (default: 75) */
  fov?: number;
  /** Camera position Z distance (default: 100) */
  cameraZ?: number;
  /** Whether antialiasing is enabled (default: true) */
  antialias?: boolean;
  /** Whether shadow maps are enabled (default: true) */
  shadows?: boolean;
  /** Physical width of the renderer in pixels (default: window innerWidth) */
  width?: number;
  /** Physical height of the renderer in pixels (default: window innerHeight) */
  height?: number;
}

export class SceneManager {
  /** Three.js WebGL renderer instance */
  public renderer: THREE.WebGLRenderer;

  /** Three.js PerspectiveCamera instance */
  public camera: THREE.PerspectiveCamera;

  /** Three.js Scene instance */
  public scene: THREE.Scene;

  /** Internal render loop timestamp */
  private lastTimestamp: number = 0;

  /** Delta time in seconds between frames */
  private deltaTime: number = 0;

  /** Callback invoked each render frame */
  private renderCallback: ((delta: number) => void) | null = null;

  /** Era transition flag - when true, renderer will be disposed on next reset */
  private disposed: boolean = false;

  /**
   * Creates a new SceneManager instance.
   * @param config Configuration options
   * @param container DOM element or ID to attach the canvas to
   */
  constructor(config: SceneManagerConfig = {}, container: HTMLElement | string) {
    // Initialize core Three.js objects
    this.scene = new THREE.Scene();

    // Configure renderer with defaults from config or window
    const antialias = config.antialias !== undefined ? config.antialias : true;
    this.renderer = new THREE.WebGLRenderer({
      antialias,
    });
    const renderWidth = config.width ?? window.innerWidth;
    const renderHeight = config.height ?? window.innerHeight;
    this.renderer.setSize(renderWidth, renderHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Tone mapping: ACES Filmic
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // Shadow maps configuration
    const enableShadows = config.shadows !== undefined ? config.shadows : true;
    if (enableShadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    // Configure camera with defaults
    const fov = config.fov ?? 75;
    const cameraZ = config.cameraZ ?? 100;
    const aspectRatio = renderWidth / renderHeight;
    this.camera = new THREE.PerspectiveCamera(
      fov,
      aspectRatio,
      0.1,
      1000
    );

    // Default orbit-ready position looking at city block center
    this.camera.position.set(0, 50, cameraZ);
    this.camera.lookAt(0, 0, 0);

    // Camera is positioned for orbit-around-origin intuition;
    // controls management (e.g., OrbitControls) is the caller's responsibility.

    // Add fog for depth cueing
    this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.001);

    // Add a simple skybox/background
    this.setupSkybox();

    // Attach renderer to container
    if (typeof container === "string") {
      const el = document.getElementById(container);
      if (el) {
        el.appendChild(this.renderer.domElement);
      }
    } else if (container instanceof HTMLElement) {
      container.appendChild(this.renderer.domElement);
    }

    // Setup resize listener
    window.addEventListener("resize", () => this.onWindowResize());

    // Initialize last timestamp for render loop
    this.lastTimestamp = performance.now();
  }

  /**
   * Sets up a simple skybox using a large sphere with embedded textures.
   * In a production scenario, this would use a proper cube map.
   */
  private setupSkybox(): void {
    const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
    // Invert the sphere so the texture faces inward
    skyGeometry.scale(-1, 1, 1);

    const skyMaterial = new THREE.MeshBasicMaterial({
      map: new THREE.TextureLoader().load("/textures/sky.jpg"),
      side: THREE.BackSide,
    });

    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    this.scene.add(sky);
  }

  /**
   * Initialize the render loop.
   * @param callback Function called each frame with delta time in seconds
   */
  public init(callback: (delta: number) => void): void {
    this.renderCallback = callback;
    this.lastTimestamp = performance.now();
    this.renderLoop();
  }

  /**
   * Main render loop using requestAnimationFrame.
   * Calculates delta time and invokes the render callback.
   */
  private renderLoop = (timestamp: number = performance.now()): void => {
    this.deltaTime = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;

    // Invoke user callback if provided
    if (this.renderCallback) {
      this.renderCallback(this.deltaTime);
    }

    // Render the scene
    this.renderer.render(this.scene, this.camera);

    // Continue the loop
    requestAnimationFrame(this.renderLoop);
  };

  /**
   * Render a single frame (useful for non-loop scenarios).
   */
  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Update renderer size and camera aspect ratio when the container resizes.
   * @param width New width in pixels
   * @param height New height in pixels
   */
  public resize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Internal handler for window resize events */
  private onWindowResize(): void {
    const renderWidth = window.innerWidth;
    const renderHeight = window.innerHeight;
    this.resize(renderWidth, renderHeight);
  }

  /**
   * Set camera position to a new location.
   * Useful for era transitions and dynamic repositioning.
   * @param x X coordinate
   * @param y Y coordinate
   * @param z Z coordinate
   * @param lookAt Optional target to look at; defaults to city block center (0,0,0)
   */
  public setCameraPosition(x: number, y: number, z: number, lookAt?: THREE.Vector3): void {
    this.camera.position.set(x, y, z);
    this.camera.lookAt(lookAt ?? new THREE.Vector3(0, 0, 0));
  }

  /**
   * Get the Three.js Scene instance for adding era-specific objects.
   * @returns Three.js Scene
   */
  public getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * Get the Three.js Camera instance.
   * @returns Three.js PerspectiveCamera
   */
  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * Get the Three.js Renderer instance.
   * @returns Three.WebGLRenderer
   */
  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  /**
   * Dispose the renderer and release resources.
   * Call when switching eras to prevent memory leaks.
   */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    // Remove event listeners
    window.removeEventListener("resize", () => this.onWindowResize());

    // Dispose renderer resources
    this.renderer.dispose();

    // Clear the scene
    this.scene.clear();

    // DOM removal
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }

    // Null out references
    this.renderer = {} as THREE.WebGLRenderer;
    this.camera = {} as THREE.PerspectiveCamera;
    this.scene = {} as THREE.Scene;
    this.renderCallback = null;
  }
}