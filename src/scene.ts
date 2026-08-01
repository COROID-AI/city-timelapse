/**
 * Scene shell for the city timelapse.
 *
 * Owns the {@link THREE.WebGLRenderer}, {@link THREE.Scene}, camera, lighting
 * and the ground plane. It exposes a small controller whose `updateEra` method
 * hot-swaps the palette-driven properties (fog color, light colors, ground
 * material color) and enforces the z-fighting-safe render policy declared on
 * the {@link EraContent} bundle.
 *
 * No time-progression logic lives here — the timeline module drives era
 * transitions and calls `updateEra` whenever the era changes.
 */

import * as THREE from 'three';

import type { Era, EraContent } from './eras/types';
import { buildEraAssets } from './assetBuilder/eras';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Controller returned by {@link createScene}. */
export interface SceneController {
  /** The underlying THREE.Scene (read-only surface). */
  readonly scene: THREE.Scene;
  /** The camera looking at the city block. */
  readonly camera: THREE.PerspectiveCamera;
  /** The renderer bound to the supplied canvas. */
  readonly renderer: THREE.WebGLRenderer;
  /** The ground plane mesh, so callers can attach road/marking decals above it. */
  readonly ground: THREE.Mesh;
  /** Group holding marking/road decal meshes that must respect the render policy. */
  readonly markings: THREE.Group;
  /** The era currently displayed. */
  readonly era: Era;
  /**
   * Hot-swap the displayed era. Updates fog, lighting and ground appearance,
   * and re-applies the render policy's renderOrder values to the ground and
   * marking group.
   */
  updateEra: (content: EraContent) => void;
  /** Render one frame. */
  render: () => void;
  /** Release GPU resources. */
  dispose: () => void;
}

// ---------------------------------------------------------------------------
// Scene factory
// ---------------------------------------------------------------------------

/**
 * Create the THREE.Scene shell bound to the given canvas.
 *
 * Sets up a WebGL renderer (antialias + sRGB), a perspective camera, fog,
 * hemisphere + directional lighting tuned to the first era, and a ground plane
 * whose `renderOrder` is driven by the era's {@link RenderPolicy}. Call
 * `controller.updateEra(content)` whenever the timeline changes era.
 *
 * @param canvas       The HTML canvas the renderer paints into.
 * @param initialEra   Optional era to initialise with (defaults to 1945).
   The initial asset bundle is built via {@link buildEraAssets}.
 * @returns A {@link SceneController} exposing the scene graph and `updateEra`.
 */
export function createScene(
  canvas: HTMLCanvasElement,
  initialEra: Era = 1945,
): SceneController {
  // ------------------------------------------------------------------
  // Renderer
  // ------------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // ------------------------------------------------------------------
  // Scene + fog
  // ------------------------------------------------------------------
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x9fb6c9, 60, 400);

  // ------------------------------------------------------------------
  // Camera
  // ------------------------------------------------------------------
  const camera = new THREE.PerspectiveCamera(
    55,
    canvas.clientWidth / canvas.clientHeight || 1,
    0.1,
    1000,
  );
  camera.position.set(0, 45, 90);
  camera.lookAt(0, 0, 0);

  // ------------------------------------------------------------------
  // Lighting
  // ------------------------------------------------------------------
  // Hemisphere light gives a soft sky/ground ambient gradient; the directional
  // light simulates the sun. Both are re-tinted on era change.
  const hemisphere = new THREE.HemisphereLight(0x9fb6c9, 0x8a8276, 0.9);
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(60, 100, 40);
  scene.add(sun);

  // ------------------------------------------------------------------
  // Ground plane
  // ------------------------------------------------------------------
  // The ground sits at renderOrder 0 (driven by renderPolicy.groundRenderOrder).
  // Road markings / decals are parented to a dedicated group whose children
  // carry higher renderOrders plus polygon offset — keeping everything
  // z-fighting-free. The plane itself uses polygonOffset so any coplanar road
  // mesh above it can be biased cleanly.
  const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a8276,
    roughness: 0.95,
    metalness: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: 0,
    polygonOffsetUnits: 0,
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2; // lay flat, normal pointing +Y
  ground.renderOrder = 0;
  scene.add(ground);

  /** Group for road/marking decal meshes; renderOrder is enforced per-child. */
  const markings = new THREE.Group();
  markings.name = 'markings';
  scene.add(markings);

  // ------------------------------------------------------------------
  // Internal state
  // ------------------------------------------------------------------
  let currentEra: Era = initialEra;

  // ------------------------------------------------------------------
  // Era update
  // ------------------------------------------------------------------

  /**
   * Apply an {@link EraContent} bundle to the scene.
   *
   * Updates fog color, hemisphere light gradient, sun color, ground material
   * color, and enforces the bundle's {@link RenderPolicy} renderOrder on the
   * ground plane and the markings group.
   */
  function updateEra(content: EraContent): void {
    currentEra = content.era;

    const { palette, renderPolicy } = content;

    // --- Fog: blend toward the sky color so distant geometry fades out. ---
    const skyColor = new THREE.Color(palette.sky);
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(skyColor);
    }
    scene.background = skyColor;

    // --- Lighting: tint hemi (sky→ground) and sun toward the palette. ---
    hemisphere.color.copy(skyColor);
    hemisphere.groundColor.copy(new THREE.Color(palette.ground));

    // Sun leans toward the accent color so the era's mood reads in highlights.
    const accentColor = new THREE.Color(palette.accent);
    const sunColor = new THREE.Color(palette.sky).lerp(accentColor, 0.25);
    sun.color.copy(sunColor);

    // --- Ground: recolor the base plane from the era ground palette. ---
    groundMaterial.color.copy(new THREE.Color(palette.ground));

    // --- Render policy: enforce z-fighting-safe ordering. ---
    // Ground plane is the lowest layer; markings draw above it.
    ground.renderOrder = renderPolicy.groundRenderOrder;
    groundMaterial.polygonOffset = true;
    groundMaterial.polygonOffsetFactor = renderPolicy.decalPolygonOffsetFactor;
    groundMaterial.polygonOffsetUnits = renderPolicy.decalPolygonOffsetUnits;
    groundMaterial.needsUpdate = true;

    // The markings group itself sits at the marking renderOrder; individual
    // decal children carry their own per-mesh renderOrder + polygonOffset as
    // declared by the street builder's RenderHint.
    markings.renderOrder = renderPolicy.markingRenderOrder;
    for (const child of markings.children) {
      // Bump any child that did not set an explicit renderOrder to the policy's
      // marking baseline so it always draws above the ground.
      if (child.renderOrder <= renderPolicy.groundRenderOrder) {
        child.renderOrder = renderPolicy.markingRenderOrder;
      }
    }
  }

  // ------------------------------------------------------------------
  // Render + dispose
  // ------------------------------------------------------------------

  function render(): void {
    renderer.render(scene, camera);
  }

  function dispose(): void {
    groundGeometry.dispose();
    groundMaterial.dispose();
    renderer.dispose();
  }

  // ------------------------------------------------------------------
  // Initial era
  // ------------------------------------------------------------------
  updateEra(buildEraAssets(initialEra));

  return {
    scene,
    camera,
    renderer,
    ground,
    markings,
    get era() {
      return currentEra;
    },
    updateEra,
    render,
    dispose,
  };
}
