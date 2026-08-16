/**
 * Main entry point for the City Timelapse 3D scene.
 * Demonstrates the SceneManager initialization and render loop.
 */

import { SceneManager } from "./scene-manager";

// Create SceneManager instance attached to the document body
const sceneManager = new SceneManager(
  {
    // AC acceptance criteria: antialiasing=true, toneMapping=ACESFilmicToneMapping
    antialias: true,
    shadows: true,

    // Configure camera defaults for orbit-ready position looking at city block center
    fov: 75,
    cameraZ: 150,
  },
  "document.body"
);

// Set up the render loop callback
sceneManager.init((delta) => {
  // This is where era-specific updates would happen each frame
  // For now, just log the delta time
  // console.log(`Frame rendered with delta: ${delta.toFixed(3)}s`);
});

// Handle era transitions - reposition camera and dispose old resources
function switchEra(era: "1945" | "1965" | "1985" | "2005" | "2025" | "2055") {
  // Dispose the previous renderer/resources before switching
  sceneManager.dispose();

  // Recreate SceneManager for the new era
  // Note: In a real app, we'd preserve the scene and just update objects
  const newSceneManager = new SceneManager(
    {
      antialias: true,
      shadows: true,
      fov: 75,
      cameraZ: 150,
    },
    "document.body"
  );

  // Set up new render loop
  newSceneManager.init((delta) => {
    // Era-specific per-frame logic here
  });

  console.log(`Switched to era: ${era}`);
}

// Example: Set camera position for a specific era
function repositionCameraForEra(era: "1945" | "1965" | "1985" | "2005" | "2025" | "2055") {
  // Camera stays at default orbit-ready position, but could be repositioned
  // based on the era's expected view
  sceneManager.setCameraPosition(0, 50, 150);
  console.log(`Camera repositioned for era: ${era}`);
}

// Expose API for era transitions
(window as any).switchEra = switchEra;
(window as any).repositionCameraForEra = repositionCameraForEra;

// Initial camera position verification
console.log("Camera position:", sceneManager.getCamera().position);
console.log("Scene fog:", sceneManager.getScene().fog);
console.log("Renderer tone mapping:", sceneManager.getRenderer().toneMapping);
console.log("Renderer shadow map type:", sceneManager.getRenderer().shadowMap.type);