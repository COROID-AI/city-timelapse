/** Main entry point for the City Timelapse 3D scene. Demonstrates the SceneManager initialization and render loop. Creates the city block ground plane with era-appropriate infrastructure. */

import { SceneManager } from "./scene-manager";
import { createCityBlockGroundPlane, EraKey, updateGroundPlaneEra } from "./CityBlockGroundPlane";
import { create1965Buildings } from "./1965-buildings";
import { create1945Vehicles, VINTAGE_SEDAN_PATH, STREETCAR_PATH, HORSE_WAGON_PATH, FIRE_ENGINE_PATH, MILK_TRUCK_PATH, BICYCLE_PATH } from "./vehicles";
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

// Create 1945-era vehicles
const vehiclePositions: {
  vintage_sedan?: THREE.Vector3;
  streetcar?: THREE.Vector3;
  horse_wagon?: THREE.Vector3;
  fire_engine?: THREE.Vector3;
  milk_truck?: THREE.Vector3;
  bicycle?: THREE.Vector3;
} = {
  vintage_sedan: new THREE.Vector3(-35, 0.5, -25),
  streetcar: new THREE.Vector3(-30, 0, -30),
  horse_wagon: new THREE.Vector3(-25, 0, -20),
  fire_engine: new THREE.Vector3(-20, 0, -15),
  milk_truck: new THREE.Vector3(-35, 0, -15),
  bicycle: new THREE.Vector3(-40, 0, -35),
};

const vehicles = create1945Vehicles(vehiclePositions);

// Position and add each vehicle to the scene
if (vehicles.vintage_sedan) {
  vehicles.vintage_sedan.position.set(vehiclePositions.vintage_sedan!.x, vehiclePositions.vintage_sedan!.y, vehiclePositions.vintage_sedan!.z);
  sceneManager.getScene().add(vehicles.vintage_sedan);
}

if (vehicles.streetcar) {
  vehicles.streetcar.position.set(vehiclePositions.streetcar!.x, vehiclePositions.streetcar!.y, vehiclePositions.streetcar!.z);
  sceneManager.getScene().add(vehicles.streetcar);
}

if (vehicles.horse_wagon) {
  vehicles.horse_wagon.position.set(vehiclePositions.horse_wagon!.x, vehiclePositions.horse_wagon!.y, vehiclePositions.horse_wagon!.z);
  sceneManager.getScene().add(vehicles.horse_wagon);
}

if (vehicles.fire_engine) {
  vehicles.fire_engine.position.set(vehiclePositions.fire_engine!.x, vehiclePositions.fire_engine!.y, vehiclePositions.fire_engine!.z);
  sceneManager.getScene().add(vehicles.fire_engine);
}

if (vehicles.milk_truck) {
  vehicles.milk_truck.position.set(vehiclePositions.milk_truck!.x, vehiclePositions.milk_truck!.y, vehiclePositions.milk_truck!.z);
  sceneManager.getScene().add(vehicles.milk_truck);
}

if (vehicles.bicycle) {
  vehicles.bicycle.position.set(vehiclePositions.bicycle!.x, vehiclePositions.bicycle!.y, vehiclePositions.bicycle!.z);
  sceneManager.getScene().add(vehicles.bicycle);
}

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