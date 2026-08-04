import * as THREE from 'three';
import { SUN_DIRECTION, SUN_TINT } from './sky';

export interface SunLightOptions {
  /** Direction the light shines from (normalized internally). Default SUN_DIRECTION. */
  direction?: THREE.Vector3;
  /** Light intensity. Default 2.0 (physically-correct units in r155+). */
  intensity?: number;
  /** Light color. Default warm white SUN_TINT. */
  color?: THREE.Color;
  /** Distance from the origin the light is placed along `direction`. Default 170. */
  distance?: number;
  /** Shadow map resolution (square). Default 2048. */
  shadowMapSize?: number;
  /** Half-extent of the orthographic shadow camera (left/right/top/bottom). Default 170. */
  shadowBounds?: number;
  /** Shadow depth bias (negative pushes shadowed surfaces toward the light). */
  shadowBias?: number;
  /** Normal bias to suppress acne on large flat surfaces. */
  shadowNormalBias?: number;
}

/**
 * Directional 'sun' light with a tuned shadow camera. The orthographic shadow
 * frustum defaults to ±170 world units so the whole 5x5 city block grid
 * (half-extent 125) plus its streets, sidewalks and long afternoon shadows stay
 * inside the shadow map.
 */
export function createSunLight(options: SunLightOptions = {}): THREE.DirectionalLight {
  const direction = (options.direction ?? SUN_DIRECTION).clone().normalize();
  const distance = options.distance ?? 170;

  const light = new THREE.DirectionalLight(
    options.color ?? SUN_TINT,
    options.intensity ?? 2.0,
  );
  light.name = 'sunLight';
  light.position.copy(direction).multiplyScalar(distance);
  light.castShadow = true;

  const shadow = light.shadow;
  const mapSize = options.shadowMapSize ?? 2048;
  shadow.mapSize.set(mapSize, mapSize);

  const bounds = options.shadowBounds ?? 170;
  shadow.camera.left = -bounds;
  shadow.camera.right = bounds;
  shadow.camera.top = bounds;
  shadow.camera.bottom = -bounds;
  shadow.camera.near = 10;
  shadow.camera.far = 400;

  shadow.bias = options.shadowBias ?? -0.0005;
  shadow.normalBias = options.shadowNormalBias ?? 0.35;

  return light;
}
