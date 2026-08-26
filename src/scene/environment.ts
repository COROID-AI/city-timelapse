import * as THREE from 'three';
import { getEraConfig, type EraId } from '../eras';
import { BLOCK_LAYOUT } from './blockLayout';

/**
 * Environment + lighting module.
 *
 * Owns the ground plane, block boundaries, streets and sidewalks that every
 * other subsystem attaches to, plus the era-reactive sky, sun, ambient light
 * and fog. All continuous values (colors, intensities, fog density, sun
 * elevation) are interpolated from the era store's shared transition progress,
 * so the whole scene atmosphere morphs smoothly between eras.
 *
 * Scene module contract: exposes `group`, `update(dt, state)`, `setEra(era, t)`
 * and `dispose()`. It does not start its own render loop.
 */

/** Ease a normalized 0..1 value with smoothstep. */
function easeInOut(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

/** Linear interpolation between two numbers. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpolate between two hex colors and return a THREE.Color. */
function lerpColor(from: string, to: string, t: number, out: THREE.Color): THREE.Color {
  const a = new THREE.Color(from);
  const b = new THREE.Color(to);
  return out.copy(a).lerp(b, t);
}

/** A vertical gradient sky rendered on a large inverted sphere. */
class SkyDome {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private top: THREE.Color;
  private bottom: THREE.Color;

  constructor() {
    this.top = new THREE.Color('#8a8a9a');
    this.bottom = new THREE.Color('#d9c9a8');

    this.material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: this.top },
        uBottom: { value: this.bottom },
        uOffset: { value: 0.0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop;
        uniform vec3 uBottom;
        uniform float uOffset;
        varying vec3 vWorld;
        void main() {
          float h = normalize(vWorld).y * 0.5 + 0.5;
          h = clamp(h + uOffset, 0.0, 1.0);
          vec3 col = mix(uBottom, uTop, pow(h, 1.2));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    const geo = new THREE.SphereGeometry(900, 32, 16);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'sky-dome';
  }

  setColors(top: THREE.Color, bottom: THREE.Color): void {
    this.top.copy(top);
    this.bottom.copy(bottom);
    this.material.uniforms.uTop.value.copy(this.top);
    this.material.uniforms.uBottom.value.copy(this.bottom);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

/** A flat quad mesh used for the block parcel. */
class GroundPlate {
  readonly mesh: THREE.Mesh;
  private material: THREE.MeshStandardMaterial;

  constructor(width: number, depth: number, color: string, roughness: number, metalness: number, y: number) {
    this.material = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
    });
    const geo = new THREE.PlaneGeometry(width, depth);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = y;
    this.mesh.receiveShadow = true;
  }

  setColor(color: THREE.Color): void {
    this.material.color.copy(color);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

/** A flat square ring (outer square with an inner square hole), e.g. sidewalk. */
class RingPlate {
  readonly mesh: THREE.Mesh;
  private material: THREE.MeshStandardMaterial;

  constructor(outerHalf: number, innerHalf: number, color: string, roughness: number, metalness: number, y: number) {
    this.material = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      side: THREE.DoubleSide,
    });

    const shape = new THREE.Shape();
    shape.moveTo(-outerHalf, -outerHalf);
    shape.lineTo(outerHalf, -outerHalf);
    shape.lineTo(outerHalf, outerHalf);
    shape.lineTo(-outerHalf, outerHalf);
    shape.closePath();

    const hole = new THREE.Path();
    hole.moveTo(-innerHalf, -innerHalf);
    hole.lineTo(innerHalf, -innerHalf);
    hole.lineTo(innerHalf, innerHalf);
    hole.lineTo(-innerHalf, innerHalf);
    hole.closePath();
    shape.holes.push(hole);

    const geo = new THREE.ShapeGeometry(shape);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = y;
    this.mesh.receiveShadow = true;
  }

  setColor(color: THREE.Color): void {
    this.material.color.copy(color);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

export interface EnvironmentState {
  /** Normalized 0..1 transition progress between current and target era. */
  transitionProgress: number;
  currentEra: EraId;
  targetEra: EraId;
}

export class Environment {
  readonly group: THREE.Group;
  private sky: SkyDome;

  // Lights
  private ambient: THREE.AmbientLight;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;

  // Ground plates
  private plaza: GroundPlate;
  private sidewalk: RingPlate;
  private street: RingPlate;

  // Era-reactive colors kept for interpolation.
  private tmpA: THREE.Color;
  private tmpB: THREE.Color;

  private disposed = false;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'environment';

    const { blockHalf, sidewalkOuter, streetOuter, groundY } = BLOCK_LAYOUT;

    // Block parcel.
    this.plaza = new GroundPlate(blockHalf * 2, blockHalf * 2, '#7a6a52', 0.95, 0.02, groundY - 0.02);
    // Sidewalk band between block edge and street inner edge.
    this.sidewalk = new RingPlate(sidewalkOuter, blockHalf, '#a89a82', 0.9, 0.02, groundY + 0.005);
    // Street ring outside the sidewalk.
    this.street = new RingPlate(streetOuter, sidewalkOuter, '#3a362e', 0.85, 0.05, groundY + 0.01);

    this.group.add(this.plaza.mesh, this.sidewalk.mesh, this.street.mesh);
    this.addRoadMarkings();

    // Sky dome.
    this.sky = new SkyDome();
    this.group.add(this.sky.mesh);

    // Lights.
    this.ambient = new THREE.AmbientLight('#d9c9a8', 0.5);
    this.sun = new THREE.DirectionalLight('#ffd9a0', 0.9);
    this.sun.position.set(40, 60, 30);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -80;
    this.sun.shadow.camera.right = 80;
    this.sun.shadow.camera.top = 80;
    this.sun.shadow.camera.bottom = -80;
    this.sun.shadow.camera.far = 200;
    this.hemi = new THREE.HemisphereLight('#c0d8e8', '#3a362e', 0.4);
    this.hemi.position.set(0, 1, 0);

    this.group.add(this.ambient, this.sun, this.hemi);

    this.tmpA = new THREE.Color();
    this.tmpB = new THREE.Color();

    // Initial era (1945) applied directly.
    this.applyEra('1945');
  }

  /**
   * Add lane dashes and crosswalks so the streets/sidewalks read clearly.
   * Road markings are static white geometry, not era-reactive.
   */
  private addRoadMarkings(): void {
    const { blockHalf, sidewalkOuter, streetOuter, groundY } = BLOCK_LAYOUT;
    const streetWidth = streetOuter - sidewalkOuter;
    const markings = new THREE.Group();
    markings.name = 'road-markings';

    const dashMat = new THREE.MeshBasicMaterial({ color: '#e8e4d8' });
    const crossMat = new THREE.MeshStandardMaterial({ color: '#d8d4c8' });

    // Center lane divider dashes on each side.
    const dashLength = 2.4;
    const dashGap = 2.6;
    const streetLength = blockHalf * 2 + streetOuter * 2;
    const halfLen = streetLength / 2;
    const center = sidewalkOuter + streetWidth / 2;

    const makeDash = (orientation: 'x' | 'z', fixed: number) => {
      for (let d = -halfLen; d < halfLen; d += dashLength + dashGap) {
        const geo = new THREE.PlaneGeometry(
          orientation === 'x' ? dashLength : 0.22,
          orientation === 'z' ? dashLength : 0.22,
        );
        const mesh = new THREE.Mesh(geo, dashMat);
        mesh.rotation.x = -Math.PI / 2;
        if (orientation === 'x') {
          mesh.position.set(d, groundY + 0.015, fixed);
        } else {
          mesh.position.set(fixed, groundY + 0.015, d);
        }
        markings.add(mesh);
      }
    };

    makeDash('x', -center);
    makeDash('x', center);
    makeDash('z', -center);
    makeDash('z', center);

    // Crosswalks at the four block corners, spanning across each street.
    const crossWidth = 2.2;
    const streetInner = sidewalkOuter;
    const crossSpan = streetOuter - streetInner; // across the street width
    const corners = [-sidewalkOuter, sidewalkOuter];
    for (const cx of corners) {
      for (const cz of corners) {
        // Horizontal crosswalk across the north/south streets (along X),
        // positioned just inside the corner.
        const geoH = new THREE.PlaneGeometry(crossSpan, crossWidth);
        const h = new THREE.Mesh(geoH, crossMat);
        h.rotation.x = -Math.PI / 2;
        h.position.set(cx, groundY + 0.016, cz);
        markings.add(h);
        // Vertical crosswalk across the east/west streets (along Z).
        const geoV = new THREE.PlaneGeometry(crossWidth, crossSpan);
        const v = new THREE.Mesh(geoV, crossMat);
        v.rotation.x = -Math.PI / 2;
        v.position.set(cz, groundY + 0.016, cx);
        markings.add(v);
      }
    }

    this.group.add(markings);
  }

  /** Apply a fully-resolved era config directly (construction / settle). */
  private applyEra(id: EraId): void {
    const cfg = getEraConfig(id);
    const { lighting, atmosphere } = cfg;

    this.ambient.color.set(lighting.dayTone);
    this.ambient.intensity = lighting.ambientIntensity;

    this.sun.color.set(lighting.sunColor);
    this.sun.intensity = lighting.sunIntensity;
    const elevation = Math.sin(lighting.timeOfDay * Math.PI);
    this.sun.position.set(40, 20 + elevation * 55, 20);

    this.hemi.color.set(atmosphere.skyGradientBottom);
    this.hemi.groundColor.set(atmosphere.groundColor);
    this.hemi.intensity = lerp(0.3, 0.8, lighting.ambientIntensity);

    this.tmpA.set(atmosphere.skyGradientTop);
    this.tmpB.set(atmosphere.skyGradientBottom);
    this.sky.setColors(this.tmpA, this.tmpB);

    this.plaza.setColor(new THREE.Color(atmosphere.groundColor));
    this.sidewalk.setColor(new THREE.Color(atmosphere.sidewalkColor));
    this.street.setColor(new THREE.Color(atmosphere.streetColor));
  }

  /**
   * Blend between two eras by the eased transition progress. Called every frame
   * so lighting and atmosphere interpolate smoothly with the shared clock.
   */
  setEra(current: EraId, target: EraId, progress: number): void {
    if (this.disposed) return;
    if (progress >= 1) {
      this.applyEra(target);
      return;
    }
    const t = easeInOut(progress);
    const from = getEraConfig(current);
    const to = getEraConfig(target);

    this.ambient.intensity = lerp(from.lighting.ambientIntensity, to.lighting.ambientIntensity, t);
    lerpColor(from.lighting.dayTone, to.lighting.dayTone, t, this.tmpA);
    this.ambient.color.copy(this.tmpA);

    this.sun.intensity = lerp(from.lighting.sunIntensity, to.lighting.sunIntensity, t);
    lerpColor(from.lighting.sunColor, to.lighting.sunColor, t, this.tmpA);
    this.sun.color.copy(this.tmpA);
    const elevFrom = Math.sin(from.lighting.timeOfDay * Math.PI);
    const elevTo = Math.sin(to.lighting.timeOfDay * Math.PI);
    const elev = lerp(elevFrom, elevTo, t);
    this.sun.position.set(30, 20 + elev * 55, 20);

    this.hemi.intensity = lerp(0.3, 0.8, this.ambient.intensity);

    lerpColor(from.atmosphere.skyGradientTop, to.atmosphere.skyGradientTop, t, this.tmpA);
    lerpColor(from.atmosphere.skyGradientBottom, to.atmosphere.skyGradientBottom, t, this.tmpB);
    this.sky.setColors(this.tmpA, this.tmpB);

    lerpColor(from.atmosphere.groundColor, to.atmosphere.groundColor, t, this.tmpA);
    this.plaza.setColor(this.tmpA);
    lerpColor(from.atmosphere.sidewalkColor, to.atmosphere.sidewalkColor, t, this.tmpA);
    this.sidewalk.setColor(this.tmpA);
    lerpColor(from.atmosphere.streetColor, to.atmosphere.streetColor, t, this.tmpA);
    this.street.setColor(this.tmpA);
  }

  /** Apply fog to a scene (called by the composition root). */
  applyFog(scene: THREE.Scene, current: EraId, target: EraId, progress: number): void {
    if (this.disposed) return;
    const t = easeInOut(progress);
    const from = getEraConfig(current);
    const to = getEraConfig(target);
    lerpColor(from.atmosphere.fogColor, to.atmosphere.fogColor, t, this.tmpA);
    const density = lerp(from.atmosphere.haze, to.atmosphere.haze, t);

    if (!scene.fog) {
      scene.fog = new THREE.FogExp2(this.tmpA.getStyle(), 0.004);
    }
    const fog = scene.fog as THREE.FogExp2;
    fog.color.copy(this.tmpA);
    fog.density = 0.002 + density * 0.02;
  }

  /** Called each frame by the composition root. */
  update(_dt: number, state: EnvironmentState): void {
    this.setEra(state.currentEra, state.targetEra, state.transitionProgress);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.sky.dispose();
    this.plaza.dispose();
    this.sidewalk.dispose();
    this.street.dispose();
  }
}