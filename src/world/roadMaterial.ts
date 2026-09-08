/**
 * Wet, reflective road surface for the neon city.
 *
 * The road uses three cooperating layers:
 *   1. A low-roughness / low-metalness PBR asphalt mesh that catches
 *      environment reflections (night sky + neon emissives).
 *   2. A `Reflector` plane layered just above it that renders a true planar
 *      reflection of the night sky and neon signs onto the road sheen.
 *   3. A subtle rain-sheen normal variation that animates over time so the
 *      "wet street" reads as a live surface, not a static mirror.
 *
 * The reflector budget is one render pass per frame, which is kept modest for
 * the integration/QA stage.
 */

import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { ROAD_HALF_WIDTH } from './track';

/** Road surface PBR parameters (wet asphalt). */
const ASPHALT_COLOR = 0x232934;
const ASPHALT_ROUGHNESS = 0.28;
const ASPHALT_METALNESS = 0.35;

/** Reflector sheen: opacity of the planar reflection overlay. */
const REFLECTOR_OPACITY = 0.75;
/** Reflector tint — cool blue at night, keeps neon colors vivid. */
const REFLECTOR_COLOR = 0x1a2a44;

/** Rain-sheen normal variation amplitude. */
const RAIN_AMP = 0.15;
/** Rain-sheen scroll speed along z (world units / second). */
const RAIN_SPEED = 3.2;

/**
 * Built road surface. `reflector` and `asphalt` are meshes added to the
 * scene; `update(dt)` scrolls the rain normal map without allocating.
 */
export interface RoadSurface {
  /** Low-roughness PBR asphalt mesh (ground truth surface). */
  readonly asphalt: THREE.Mesh;
  /** Planar `Reflector` that renders the night sky / neon reflections. */
  readonly reflector: THREE.Mesh;
  /** Advance the rain sheen by `dt` seconds (allocation-free). */
  update(dt: number): void;
  /** Release GPU resources owned by the surface. */
  dispose(): void;
}

/**
 * Build the wet reflective road for a circuit of the given length.
 * @param length Total arc length of the loop (drives the ribbon extent).
 */
export function createRoad(length: number): RoadSurface {
  // Ground-truth asphalt ribbon. Low roughness + low metalness lets the
  // standard PBR path pick up environment light and emissive neon spill.
  const asphaltGeo = new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2, length);
  const asphaltMat = new THREE.MeshStandardMaterial({
    color: ASPHALT_COLOR,
    roughness: ASPHALT_ROUGHNESS,
    metalness: ASPHALT_METALNESS,
  });
  const asphalt = new THREE.Mesh(asphaltGeo, asphaltMat);
  asphalt.rotation.x = -Math.PI / 2;

  // Planar reflector laid just above the asphalt so the night sky and neon
  // signs visibly reflect. We lerp the built-in `color` (which the reflector
  // overlays onto the scene) toward a cooled tint and keep opacity modest.
  const reflector = new Reflector(asphaltGeo, {
    clipBias: 0.003,
    textureWidth: 512,
    textureHeight: 512,
    color: REFLECTOR_COLOR,
  });
  reflector.position.y = 0.02;
  reflector.rotation.x = -Math.PI / 2;
  (reflector.material as THREE.Material).transparent = true;
  (reflector.material as THREE.Material).opacity = REFLECTOR_OPACITY;

  // Rain-sheen normal variation. A small repeating noise texture is scrolled
  // over the frame so the wet surface shimmers subtly as the car passes.
  // Guard for headless environments (node tests) where `document` is absent.
  let rainCanvas: HTMLCanvasElement | undefined;
  if (typeof document !== 'undefined') {
    rainCanvas = document.createElement('canvas');
  }
  const rainCanvasSafe = rainCanvas ?? null;
  if (rainCanvasSafe) {
    rainCanvasSafe.width = 256;
    rainCanvasSafe.height = 256;
    const ctx = rainCanvasSafe.getContext('2d');
    if (ctx) {
      const img = ctx.createImageData(rainCanvasSafe.width, rainCanvasSafe.height);
      const data = img.data;
      for (let i = 0; i < data.length; i += 4) {
        const n = (i / 4) * 0.618 + Math.floor(i / 4) * 0.271;
        const v = 128 + Math.sin(n) * 40;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = 255;
        data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }
  }
  const rainTexture = rainCanvasSafe
    ? new THREE.CanvasTexture(rainCanvasSafe)
    : new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
  rainTexture.wrapS = THREE.RepeatWrapping;
  rainTexture.wrapT = THREE.RepeatWrapping;
  rainTexture.repeat.set(1, 6);

  const rainMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    normalMap: rainTexture,
    normalScale: new THREE.Vector2(RAIN_AMP, RAIN_AMP),
    roughness: 0.5,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const rainMesh = new THREE.Mesh(asphaltGeo, rainMat);
  rainMesh.rotation.x = -Math.PI / 2;
  rainMesh.position.y = 0.035;

  return {
    asphalt,
    reflector,
    update(dt) {
      rainTexture.offset.y -= dt * RAIN_SPEED;
    },
    dispose() {
      asphaltGeo.dispose();
      asphaltMat.dispose();
      rainTexture.dispose();
      rainMat.dispose();
      (reflector.material as THREE.Material).dispose();
    },
  };
}