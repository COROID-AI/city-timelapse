import * as THREE from 'three';

/** Warm white tint of the sun seen through the daytime atmosphere. */
export const SUN_TINT = new THREE.Color('#fff1d6');

/**
 * Default sun direction (normalized): high in the sky from the southeast so
 * building shadows fall across the streets to the northwest.
 */
export const SUN_DIRECTION = new THREE.Vector3(0.6, 0.8, 0.35).normalize();

/** Deep daytime blue near the zenith. */
export const DAY_SKY_TOP = new THREE.Color('#2e63c4');
/** Pale blue near the horizon. */
export const DAY_SKY_HORIZON = new THREE.Color('#a9cff2');
/** Muted haze below the horizon. */
export const DAY_SKY_GROUND = new THREE.Color('#b5ad9d');

export interface SkyDomeOptions {
  /** Dome radius in world units. Default 900 (well outside the city + camera far plane). */
  radius?: number;
  /** Color at the zenith. */
  top?: THREE.Color;
  /** Color at the horizon. */
  horizon?: THREE.Color;
  /** Color below the horizon (haze). */
  ground?: THREE.Color;
  /** Direction the visible sun disc is drawn in. Defaults to SUN_DIRECTION. */
  sunDirection?: THREE.Vector3;
  /** Tint of the sun disc and halo. */
  sunColor?: THREE.Color;
  /** Higher power = tighter sun disc. Default 400. */
  sunDiscPower?: number;
  /** Higher power = tighter halo around the disc. Default 24. */
  sunHaloPower?: number;
}

const SKY_VERTEX_SHADER = /* glsl */ `
varying vec3 vWorldPosition;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uCameraPosition;
uniform vec3 uSunDirection;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunColor;
uniform float uSunDiscPower;
uniform float uSunHaloPower;

varying vec3 vWorldPosition;

void main() {
  vec3 dir = normalize(vWorldPosition - uCameraPosition);
  float height = clamp(dir.y, -1.0, 1.0);
  float t = height * 0.5 + 0.5;

  // Vertical daytime gradient: deep blue overhead, pale blue at the horizon,
  // muted haze below the horizon.
  vec3 color = height >= 0.0
    ? mix(uHorizon, uTop, pow(t, 0.55))
    : mix(uHorizon, uGround, pow(1.0 - t, 0.35));

  // Sun disc plus a soft warm halo, drawn in the direction of the sun.
  float sunAngle = dot(dir, normalize(uSunDirection));
  float disc = pow(max(sunAngle, 0.0), uSunDiscPower);
  float halo = pow(max(sunAngle, 0.0), uSunHaloPower) * 0.25;
  color += uSunColor * (disc + halo);

  gl_FragColor = vec4(color, 1.0);
}
`;

/**
 * Large gradient sky dome that surrounds the whole city. The daytime gradient
 * is computed per-fragment from the view direction, and a bright sun disc with
 * a warm halo is drawn along the same direction as the directional sun light.
 * The dome renders in the opaque pass (depthWrite off) so buildings correctly
 * occlude it while staying far behind the walkable area.
 */
export function createSkyDome(options: SkyDomeOptions = {}): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    vertexShader: SKY_VERTEX_SHADER,
    fragmentShader: SKY_FRAGMENT_SHADER,
    uniforms: {
      uCameraPosition: { value: new THREE.Vector3() },
      uSunDirection: {
        value: (options.sunDirection ?? SUN_DIRECTION).clone().normalize(),
      },
      uTop: { value: (options.top ?? DAY_SKY_TOP).clone() },
      uHorizon: { value: (options.horizon ?? DAY_SKY_HORIZON).clone() },
      uGround: { value: (options.ground ?? DAY_SKY_GROUND).clone() },
      uSunColor: { value: (options.sunColor ?? SUN_TINT).clone() },
      uSunDiscPower: { value: options.sunDiscPower ?? 400 },
      uSunHaloPower: { value: options.sunHaloPower ?? 24 },
    },
    side: THREE.BackSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(options.radius ?? 900, 32, 24),
    material,
  );
  mesh.name = 'skyDome';
  mesh.frustumCulled = false;
  return mesh;
}

/**
 * Keep the sky shader's camera uniform in sync with the view camera. Call once
 * per frame from the animation loop.
 */
export function updateSkyDome(sky: THREE.Mesh, camera: THREE.Camera): void {
  const material = sky.material as THREE.ShaderMaterial;
  (material.uniforms.uCameraPosition.value as THREE.Vector3).copy(
    camera.position,
  );
}
