import { setupScene, SceneManager } from './scene.js';
import { createCameraController, CameraController } from './cameraController.js';
import { createTimelineUI, TimelineUI } from './hud/timeline.js';

/**
 * Main application entry point for the City Time Period Timelapse
 */
class CityTimelapseApp {
  public sceneManager: SceneManager;
  private cameraController: CameraController;
  private timelineUI: TimelineUI;
  private animationId: number | null = null;
  private lastTime: number = 0;

  constructor() {
    this.sceneManager = setupScene();
    this.cameraController = createCameraController(
      this.sceneManager.camera,
      this.sceneManager.renderer.domElement
    );
    this.timelineUI = createTimelineUI((eraId) => {
      this.sceneManager.setEra(eraId);
    });
  }

  start() {
    this.lastTime = performance.now();
    this.animate();
    // Also trigger an immediate render after a short delay to ensure canvas is populated
    setTimeout(() => {
      this.sceneManager.render(0);
    }, 100);
    // And another render after load to ensure content is captured
    window.addEventListener('load', () => {
      this.sceneManager.render(0);
    }, { once: true });
  }

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);
    
    const now = performance.now();
    const deltaTime = (now - this.lastTime) / 1000; // Convert to seconds
    this.lastTime = now;
    
    this.cameraController.update();
    this.sceneManager.render(deltaTime);
  };

  dispose() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    this.cameraController.dispose();
    this.sceneManager.dispose();
    this.timelineUI.dispose();
  }
}

// Initialize app immediately
const app = new CityTimelapseApp();

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  app.start();
});

// Also start immediately if DOM is already ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(() => app.start(), 0);
}

// Handle window resize
window.addEventListener('resize', () => {
  app.sceneManager.handleResize();
});

export { CityTimelapseApp };