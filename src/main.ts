import * as THREE from 'three';
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
    this.animate();
  }

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);
    this.cameraController.update();
    this.sceneManager.render();
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

// Initialize app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new CityTimelapseApp();
  app.start();

  // Handle window resize
  window.addEventListener('resize', () => {
    app.sceneManager.handleResize();
  });
});

export { CityTimelapseApp };