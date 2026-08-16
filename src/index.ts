/** Main entry point for the City Timelapse 3D scene. Demonstrates the SceneManager initialization and render loop. Creates the city block ground plane with era-appropriate infrastructure. */

import { SceneManager } from "./scene-manager";
import { createCityBlockGroundPlane, EraKey, updateGroundPlaneEra } from "./CityBlockGroundPlane";

// Create SceneManager instance attached to the document body
const sceneManager = new SceneManager({
  // AC acceptance criteria: antialiasing=true, toneMapping=ACESFilmicToneMapping
  antialias: true,
  shadows: true,

  // Configure camera defaults for orbit-ready position looking at city block center
  fov: 75,
  cameraZ: 150,
},
"document.body");

// Create the city block ground plane with era-appropriate materials
const era: EraKey = '2025' as EraKey; // Default to 2025 era
const groundComponents = createCityBlockGroundPlane(era, sceneManager.getScene());

// Set up the render loop callback
sceneManager.init((delta) => {
  // This is where era-specific updates would happen each frame
  // For now, just log the delta time
  // console.log(`Frame rendered with delta: ${delta.toFixed(3)}s`);
});

// Handle era transitions - reposition camera and dispose old resources
function switchEra(newEra: EraKey) {
  // Update the ground plane materials for the new era
  updateGroundPlaneEra(newEra, groundComponents);
  console.log(`Switched to era: ${newEra}`);
}

// Initial camera position verification
console.log("Camera position:", sceneManager.getCamera().position);
console.log("Scene fog:", sceneManager.getScene().fog);
console.log("Renderer tone mapping:", sceneManager.getRenderer().toneMapping);
console.log("Renderer shadow map type:", sceneManager.getRenderer().shadowMap.type);
