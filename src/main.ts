/** Main entry point for the City Timelapse 3D scene. Demonstrates the SceneManager initialization and render loop. Creates the city block ground plane with era-appropriate infrastructure. */

import { SceneManager } from "./scene-manager";
import { createCityBlockGroundPlane, EraKey, updateGroundPlaneEra } from "./CityBlockGroundPlane";
import { create1965Buildings } from "./1965-buildings";
import { MiniMap } from "./minimap";

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

// Initialize mini-map with 2025 era
const minimapContainer = document.createElement('div');
minimapContainer.style.position = 'fixed';
minimapContainer.style.bottom = '20px';
minimapContainer.style.right = '20px';
minimapContainer.style.width = '200px';
minimapContainer.style.height = '200px';
minimapContainer.style.background = 'rgba(0,0,0,0.5)';
document.body.appendChild(minimapContainer);
const minimap = new MiniMap(minimapContainer, {
  size: 200,
  position: 'br',
  opacity: 0.8,
  showPosition: true,
  showDirection: true,
});
minimap.updateEra('2025');

// Initialize 1965 era buildings
const buildings1965 = create1965Buildings(sceneManager.getScene());
buildings1965.position.set(0, 0, 0); // Position at city block center
sceneManager.getScene().add(buildings1965);

// Set up the render loop callback
sceneManager.init((delta) => {
  // This is where era-specific updates would happen each frame
});

// Handle era transitions - reposition camera and dispose old resources
function switchEra(newEra: EraKey) {
  // Update the ground plane materials for the new era
  updateGroundPlaneEra(newEra, groundComponents);
  minimap.updateEra(newEra);
  console.log(`Switched to era: ${newEra}`);
}

// Initial camera position verification
console.log("Camera position:", sceneManager.getCamera().position);
console.log("Scene fog:", sceneManager.getScene().fog);
console.log("Renderer tone mapping:", sceneManager.getRenderer().toneMapping);
console.log("Renderer shadow map type:", sceneManager.getRenderer().shadowMap.type);