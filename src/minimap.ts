/**
 * MiniMap - Compact top-down overlay showing current position and viewing direction
 *
 * Features:
 * - Top-down view of the city block
 * - Position indicator showing camera location
 - Viewing direction arrow showing camera orientation
 * - Compact corner placement (does not obstruct main view)
 * - Era-aware (different colors/styles per era)
 * - Update in real-time with camera position
 */
import * as THREE from 'three';

/**
 * MiniMap configuration options
 */
export interface MiniMapConfig {
  /** Map size in pixels (square) */
  size?: number;
  /** Map corner placement: "tl"=top-left, "tr"=top-right, "bl"=bottom-left, "br"=bottom-right */
  position?: string;
  /** Opacity of the map (0-1) */
  opacity?: number;
  /** Whether to show the position indicator */
  showPosition?: boolean;
  /** Whether to show the viewing direction */
  showDirection?: boolean;
  /** Era-specific map colors */
  eraColors?: Map<string, string>;
}

/**
 * MiniMap renders a compact top-down overlay view of the city block.
 * Shows the camera's current position and viewing direction.
 */
export class MiniMap {
  /** HTML container element for the mini-map */
  public container: HTMLDivElement;
  /** Three.js renderer for the mini-map scene */
  private mapRenderer: THREE.WebGLRenderer;
  /** Three.js scene for the mini-map */
  private mapScene: THREE.Scene;
  /** Three.js camera for the mini-map (orthographic) */
  private mapCamera: THREE.OrthographicCamera;
  /** Indicator mesh showing camera position */
  private positionIndicator: THREE.Mesh;
  /** Arrow mesh showing camera viewing direction */
  private directionArrow: THREE.Mesh;
  /** Current era for color styling */
  private currentEra: string = '2025';
  /** Map size */
  private mapSize: number = 200;
  /** Map opacity */
  private opacity: number = 0.8;

  constructor(container: HTMLDivElement, config: MiniMapConfig = {}) {
    // Apply configuration
    this.mapSize = config.size ?? 200;
    this.position = config.position ?? 'br';
    this.opacity = config.opacity ?? 0.8;
    this.showPosition = config.showPosition ?? true;
    this.showDirection = config.showDirection ?? true;
    this.eraColors = config.eraColors ?? new Map();

    // Create container
    this.container = document.createElement('div');
    this.container.style.position = 'absolute';
    this.container.style.pointerEvents = 'none';
    this.container.style.zIndex = '100';
    this.container.style.width = `${this.mapSize}px`;
    this.container.style.height = `${this.mapSize}px`;

    // Set position corner
    this.updatePositionStyles();

    // Create mini-map Three.js scene
    this.mapScene = new THREE.Scene();
    this.mapScene.background = new THREE.Color(0x87CEEB // sky blue
    );

    // Create orthographic camera for top-down view
    this.mapCamera = new THREE.OrthographicCamera(
      -this.mapSize / 2,
      this.mapSize / 2,
      this.mapSize / 2,
      -this.mapSize / 2,
      0.1,
      1000
    );
    this.mapCamera.position.set(0, 100, 0);
    this.mapCamera.lookAt(0, 0, 0);

    // Create position indicator (small sphere)
    const indicatorGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const indicatorMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 1.0
    });
    this.positionIndicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
    this.positionIndicator.position.set(0, 0.5, 0);
    this.mapScene.add(this.positionIndicator);

    // Create direction arrow (small cone)
    const arrowGeometry = new THREE.ConeGeometry(0.5, 1.5, 16);
    const arrowMaterial = new THREE.MeshBasicMaterial({
      color: 0x0000ff,
      transparent: true,
      opacity: 1.0
    });
    this.directionArrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    this.directionArrow.rotation.x = -Math.PI / 2; // Lie flat
    this.directionArrow.position.set(0, 0.5, 0);
    this.mapScene.add(this.directionArrow);

    // Add mini-map renderer
    this.mapRenderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true
    });
    this.mapRenderer.setSize(this.mapSize, this.mapSize);
    this.mapRenderer.setPixelRatio(1);
    this.mapRenderer.autoClear = false;

    // Add renderer DOM element to container
    this.container.appendChild(this.mapRenderer.domElement);

    // Set up resize handling
    window.addEventListener('resize', () => this.onWindowResize());
  }

  /** Update position corner styles */
  private updatePositionStyles(): void {
    switch (this.position) {
      case 'tl':
        this.container.style.top = '10px';
        this.container.style.left = '10px';
        break;
      case 'tr':
        this.container.style.top = '10px';
        this.container.style.right = '10px';
        break;
      case 'bl':
        this.container.style.bottom = '10px';
        this.container.style.left = '10px';
        break;
      case 'br':
      default:
        this.container.style.bottom = '10px';
        this.container.style.right = '10px';
        break;
    }
  }

  /** On window resize - update map renderer size */
  private onWindowResize(): void {
    this.mapRenderer.setSize(this.mapSize, this.mapSize);
  }

  /** Update the mini-map era styling */
  public updateEra(eraKey: string): void {
    this.currentEra = eraKey;

    // Update colors based on era
    const eraColors = this.eraColors.get(eraKey);
    if (eraColors) {
      if (this.positionIndicator.material) {
        // Could update position indicator color
        // this.positionIndicator.material.color.set(eraColors.positionColor);
      }
      if (this.directionArrow.material) {
        // this.directionArrow.material.color.set(eraColors.directionColor);
      }
    } else {
      // Default colors based on era
      this.updateDefaultEraColors(eraKey);
    }
  }

  /** Update default era colors */
  private updateDefaultEraColors(eraKey: string): void {
    let positionColor = 0xff0000; // red default
    let directionColor = 0x0000ff; // blue default

    switch (eraKey) {
      case '1945':
        positionColor = 0x8B4513; // brown sepia
        directionColor = 0xCD853F; // lighter brown
        break;
      case '1965':
        positionColor = 0xFF6B6B; // vibrant red
        directionColor = 0x4ECDC4; // turquoise
        break;
      case '1985':
        positionColor = 0x9B59B6; // purple
        directionColor = 0xF1C40F; // yellow
        break;
      case '2005':
        positionColor = 0x3498DB; // blue
        directionColor = 0xE74C3C; // red accent
        break;
      case '2025':
      default:
        positionColor = 0x2C3E50; // dark blue
        directionColor = 0xECF0F1; // light gray/blue
        break;
    }

    if (this.positionIndicator.material) {
      this.positionIndicator.material.color.set(positionColor);
    }
    if (this.directionArrow.material) {
      this.directionArrow.material.color.set(directionColor);
    }
  }

  /** Update position indicator based on camera position */
  public updateCameraPosition(position: THREE.Vector3, target: THREE.Vector3): void {
    // Convert 3D world position to 2D mini-map coordinates
    // Project the position onto the mini-map plane

    // Simple approach: use the x and z coordinates (ignore y/height)
    const mapX = position.x;
    const mapZ = position.z;

    // Update position indicator
    this.positionIndicator.position.set(mapX, 0.5, mapZ);

    // Calculate direction to look at target
    const direction = target.clone().sub(position);
    const angle = Math.atan2(direction.x, direction.z);

    // Update direction arrow rotation
    this.directionArrow.rotation.z = angle;
  }

  /** Render the mini-map scene */
  public render(deltaTime: number): void {
    // Render the mini-map scene from top-down view
    this.mapRenderer.render(this.mapScene, this.mapCamera);
  }

  /** Resize the mini-map */
  public resize(): void {
    this.mapRenderer.setSize(this.mapSize, this.mapSize);
  }
}