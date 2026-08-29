/**
 * Sky, fog, and celestial discs for the environment subsystem.
 *
 * The sky is a large back-side sphere with a procedural fragment shader that
 * renders a vertical gradient between the era's zenith and horizon colors, a
 * sun or moon disc (with a soft halo), and — for the evening 1985 scene — a
 * star field. All colors are driven by uniforms so `applyEraBlend` can lerp
 * them continuously. Fog is a plain three.js `Fog` whose color and
 * near/far distances are also driven per era.
 */
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  Fog,
  Group,
  MathUtils,
  Mesh,
  Points,
  PointsMaterial,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import type { RgbColor } from '../engine/eras';

const clamp = MathUtils.clamp;

/** Zenith (top of dome) color for each era, as {r,g,b} in 0..1. */
export interface EraSkyPalette {
  readonly zenith: RgbColor;
  readonly horizon: RgbColor;
}

/** The sky's fog + celestial state for one era. */
export interface EraSkyState {
  readonly palette: EraSkyPalette;
  readonly fogColor: RgbColor;
  readonly fogStart: number;
  readonly fogEnd: number;
  readonly sunColor: RgbColor;
  readonly sunIntensity: number;
  readonly sunElevationDeg: number;
  readonly sunAzimuthDeg: number;
  readonly starsVisible: boolean;
}

/** Builds the sky mesh, celestial discs, and star field into one group. */
export function buildSkyGroup(state: EraSkyState, radius: number): Group {
  const group = new Group();
  group.name = 'environment-sky';

  // --- Gradient dome -------------------------------------------------------
  const skyMaterial = new ShaderMaterial({
    name: 'environment-sky-gradient',
    side: BackSide,
    depthWrite: false,
    uniforms: {
      uTopColor: { value: new Color().setRGB(state.palette.zenith.r, state.palette.zenith.g, state.palette.zenith.b) },
      uBottomColor: {
        value: new Color().setRGB(state.palette.horizon.r, state.palette.horizon.g, state.palette.horizon.b),
      },
      uOffset: { value: 12 },
      uExponent: { value: 0.85 },
      uSunColor: { value: new Color().setRGB(state.sunColor.r, state.sunColor.g, state.sunColor.b) },
      uMoonColor: { value: new Color().setRGB(0.75, 0.78, 0.86) },
      uSunIntensity: { value: state.sunIntensity },
      uSunDirection: { value: sunDirection(state.sunElevationDeg, state.sunAzimuthDeg) },
      uShowStars: { value: state.starsVisible ? 1 : 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTopColor;
      uniform vec3 uBottomColor;
      uniform float uOffset;
      uniform float uExponent;
      uniform vec3 uSunColor;
      uniform vec3 uMoonColor;
      uniform float uSunIntensity;
      uniform vec3 uSunDirection;
      uniform float uShowStars;
      varying vec3 vWorldPosition;

      float hash13(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.zyx + 31.32);
        return fract((p.x + p.y) * p.z);
      }

      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, uOffset, 0.0)).y;
        float t = clamp(pow(max(h, 0.0), uExponent), 0.0, 1.0);
        vec3 color = mix(uBottomColor, uTopColor, t);

        vec3 dir = normalize(vWorldPosition);
        float sunDot = max(dot(dir, uSunDirection), 0.0);
        float disc = smoothstep(0.9991, 0.9995, sunDot);
        float halo = pow(sunDot, 180.0) * 0.55;
        color += (uSunColor * uSunIntensity) * (disc * 1.6 + halo);

        // Moon disc: cool white, smaller, only relevant at night.
        float moonDot = max(dot(dir, normalize(-uSunDirection)), 0.0);
        float moonDisc = smoothstep(0.99925, 0.9995, moonDot);
        color += uMoonColor * uSunIntensity * moonDisc * 0.8;

        // Stars: hash-based, only visible at night (1985 evening scene).
        if (uShowStars > 0.5) {
          vec3 sp = dir * 400.0;
          vec3 cell = floor(sp);
          vec3 f = fract(sp);
          vec3 c = cell + 0.5;
          float star = step(0.9975, hash13(c));
          float tw = 0.6 + 0.4 * sin(c.x * 12.9898 + c.y * 78.233 + c.z * 37.719);
          color += vec3(0.85, 0.88, 1.0) * star * tw * 0.9;
        }

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  const sky = new Mesh(new SphereGeometry(radius, 32, 24), skyMaterial);
  sky.name = 'environment-sky-dome';
  group.add(sky);

  // --- Sun / moon disc meshes ----------------------------------------------
  // A flat emissive disc billboarded toward the camera; the shader halo
  // already adds the glow, this gives a solid core to the disc.
  const discMaterial = new ShaderMaterial({
    name: 'environment-sun-moon-disc',
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: new Color().setRGB(state.sunColor.r, state.sunColor.g, state.sunColor.b) },
      uIntensity: { value: state.sunIntensity },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec2 vUv;
      void main() {
        float d = distance(vUv, vec2(0.5));
        float a = smoothstep(0.5, 0.42, d);
        vec3 col = uColor * uIntensity * 1.8;
        gl_FragColor = vec4(col, a * clamp(uIntensity, 0.0, 1.0));
      }
    `,
  });

  const sunDisc = new Mesh(new SphereGeometry(0.55, 16, 12), discMaterial);
  sunDisc.name = 'environment-sun-disc';
  sunDisc.position.copy(sunDirection(state.sunElevationDeg, state.sunAzimuthDeg).multiplyScalar(radius * 0.92));
  group.add(sunDisc);

  const moonDisc = new Mesh(new SphereGeometry(0.34, 16, 12), discMaterial.clone());
  moonDisc.name = 'environment-moon-disc';
  moonDisc.position
    .copy(sunDirection(state.sunElevationDeg, state.sunAzimuthDeg).multiplyScalar(-1))
    .multiplyScalar(radius * 0.92);
  (moonDisc.material as ShaderMaterial).uniforms.uColor.value.setRGB(0.75, 0.78, 0.86);
  group.add(moonDisc);

  // --- Star field (evening 1985 scene) -------------------------------------
  const starCount = 260;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = radius * 0.97;
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.85;
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeometry = new BufferGeometry();
  starGeometry.setAttribute('position', new BufferAttribute(starPositions, 3));
  const stars = new Points(
    starGeometry,
    new PointsMaterial({
      color: 0xcfd6ff,
      size: 0.09,
      sizeAttenuation: true,
      transparent: true,
      opacity: state.starsVisible ? 1 : 0,
      depthWrite: false,
    }),
  );
  stars.name = 'environment-stars';
  stars.visible = state.starsVisible;
  group.add(stars);

  return group;
}

/**
 * Returns a reference to the sky dome mesh inside a sky group, or undefined.
 */
export function findSkyDome(group: Group): Mesh | undefined {
  return group.getObjectByName('environment-sky-dome') as Mesh | undefined;
}

/** Returns the star points object inside a sky group, or undefined. */
export function findStars(group: Group): Points | undefined {
  return group.getObjectByName('environment-stars') as Points | undefined;
}

/**
 * Applies a sky state to the group's materials and fog. Used both for the
 * initial build and (through `applySkyBlend`) for era transitions.
 */
export function applySkyState(group: Group, state: EraSkyState, fog: Fog): void {
  const sky = findSkyDome(group);
  if (sky) {
    const material = sky.material as ShaderMaterial;
    material.uniforms.uTopColor.value.setRGB(state.palette.zenith.r, state.palette.zenith.g, state.palette.zenith.b);
    material.uniforms.uBottomColor.value.setRGB(
      state.palette.horizon.r,
      state.palette.horizon.g,
      state.palette.horizon.b,
    );
    material.uniforms.uSunColor.value.setRGB(state.sunColor.r, state.sunColor.g, state.sunColor.b);
    material.uniforms.uSunIntensity.value = state.sunIntensity;
    material.uniforms.uSunDirection.value.copy(sunDirection(state.sunElevationDeg, state.sunAzimuthDeg));
    material.uniforms.uShowStars.value = state.starsVisible ? 1 : 0;
    (material.uniforms.uMoonColor.value as Color).setRGB(0.75, 0.78, 0.86);
  }
  const sun = group.getObjectByName('environment-sun-disc');
  if (sun) {
    const material = (sun as Mesh).material as ShaderMaterial;
    material.uniforms.uColor.value.setRGB(state.sunColor.r, state.sunColor.g, state.sunColor.b);
    material.uniforms.uIntensity.value = state.sunIntensity;
    sun.position.copy(sunDirection(state.sunElevationDeg, state.sunAzimuthDeg).multiplyScalar(50 * 0.92));
  }
  const moon = group.getObjectByName('environment-moon-disc');
  if (moon) {
    moon.position
      .copy(sunDirection(state.sunElevationDeg, state.sunAzimuthDeg).multiplyScalar(-1))
      .multiplyScalar(50 * 0.92);
  }
  const stars = findStars(group);
  if (stars) {
    stars.visible = state.starsVisible;
    (stars.material as PointsMaterial).opacity = state.starsVisible ? 1 : 0;
  }
  fog.color.setRGB(state.fogColor.r, state.fogColor.g, state.fogColor.b);
  fog.near = state.fogStart;
  fog.far = state.fogEnd;
}

/**
 * Lerps two sky states at progress `t` (0 = from, 1 = to) and writes the
 * result into the group's materials and the given fog object.
 */
export function applySkyBlend(group: Group, from: EraSkyState, to: EraSkyState, t: number, fog: Fog): void {
  const k = clamp(t, 0, 1);
  const sky = findSkyDome(group);
  if (sky) {
    const material = sky.material as ShaderMaterial;
    material.uniforms.uTopColor.value.lerpColors(
      colorFrom(from.palette.zenith),
      colorFrom(to.palette.zenith),
      k,
    );
    material.uniforms.uBottomColor.value.lerpColors(
      colorFrom(from.palette.horizon),
      colorFrom(to.palette.horizon),
      k,
    );
    material.uniforms.uSunColor.value.lerpColors(colorFrom(from.sunColor), colorFrom(to.sunColor), k);
    material.uniforms.uSunIntensity.value = MathUtils.lerp(from.sunIntensity, to.sunIntensity, k);
    material.uniforms.uSunDirection.value
      .copy(sunDirection(from.sunElevationDeg, from.sunAzimuthDeg))
      .lerp(sunDirection(to.sunElevationDeg, to.sunAzimuthDeg), k)
      .normalize();
    material.uniforms.uShowStars.value = from.starsVisible || to.starsVisible ? 1 : 0;
  }
  const stars = findStars(group);
  if (stars) {
    const targetVisible = to.starsVisible;
    const fromOpacity = from.starsVisible ? 1 : 0;
    const toOpacity = targetVisible ? 1 : 0;
    const opacity = MathUtils.lerp(fromOpacity, toOpacity, k);
    stars.visible = opacity > 0.01;
    (stars.material as PointsMaterial).opacity = opacity;
  }
  fog.color.lerpColors(colorFrom(from.fogColor), colorFrom(to.fogColor), k);
  fog.near = MathUtils.lerp(from.fogStart, to.fogStart, k);
  fog.far = MathUtils.lerp(from.fogEnd, to.fogEnd, k);
}

/** Converts a {r,g,b} 0..1 record into a three.js Color. */
export function colorFrom(rgb: RgbColor): Color {
  return new Color().setRGB(rgb.r, rgb.g, rgb.b);
}

/** Computes the world-space direction of the sun from elevation/azimuth. */
export function sunDirection(elevationDeg: number, azimuthDeg: number): Vector3 {
  const elevation = MathUtils.degToRad(elevationDeg);
  const azimuth = MathUtils.degToRad(azimuthDeg);
  return new Vector3(
    Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
    Math.cos(elevation) * Math.cos(azimuth),
  ).normalize();
}

/** Builds the fog object used by the whole environment subsystem. */
export function createEnvironmentFog(state: EraSkyState): Fog {
  return new Fog(
    new Color().setRGB(state.fogColor.r, state.fogColor.g, state.fogColor.b),
    state.fogStart,
    state.fogEnd,
  );
}

/**
 * Builds a sky state from the era's environment payload, deriving the zenith
 * color from the payload's sky color and the star visibility from the
 * era's time of day.
 */
export function buildSkyState(
  env: {
    readonly skyColor: RgbColor;
    readonly horizonColor: RgbColor;
    readonly fogColor: RgbColor;
    readonly fogStart: number;
    readonly fogEnd: number;
    readonly timeOfDay: string;
    readonly sun: { readonly color: RgbColor; readonly intensity: number; readonly elevationDeg: number; readonly azimuthDeg: number };
  },
): EraSkyState {
  const starsVisible = /evening|night/i.test(env.timeOfDay);
  return {
    palette: { zenith: env.skyColor, horizon: env.horizonColor },
    fogColor: env.fogColor,
    fogStart: env.fogStart,
    fogEnd: env.fogEnd,
    sunColor: env.sun.color,
    sunIntensity: env.sun.intensity,
    sunElevationDeg: env.sun.elevationDeg,
    sunAzimuthDeg: env.sun.azimuthDeg,
    starsVisible,
  };
}

/** Sphere radius used by the sky dome (matches camera far plane). */
export const SKY_DOME_RADIUS = 50;