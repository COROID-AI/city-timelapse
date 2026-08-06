import * as THREE from 'three';

/**
 * A brief full-screen "time-warp" overlay used to mask the actual content swap
 * of an era transition. It renders a radial wipe that expands from the center
 * to cover the viewport, then recedes, giving the impression that the city
 * "transforms in front of your eyes".
 *
 * The overlay is attached to the camera so it always sits in front of the
 * scene regardless of camera motion.
 */

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uProgress;
uniform float uIntensity;
uniform float uAspect;
uniform vec3 uColor;

const float PI = 3.141592653589793;

void main() {
  // Aspect-corrected screen-space coordinate (half-height = 0.5 units).
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  float dist = length(p);
  float maxDist = length(vec2(uAspect * 0.5, 0.5));

  // Radial wipe radius grows to full coverage then recedes.
  float s = sin(uProgress * PI);
  float r = maxDist * pow(s, 0.6);

  float inside = smoothstep(r + 0.04, r - 0.04, dist);
  float edge = 1.0 - smoothstep(0.0, 0.08, abs(dist - r));

  vec3 col = mix(uColor, vec3(1.0, 1.0, 1.0), edge * 0.7);
  float alpha = (inside * 0.92 + edge * 0.25) * uIntensity;

  gl_FragColor = vec4(col, alpha);
}
`;

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * Intensity envelope for the overlay over the normalized transition time `t`.
 * Ramps up, holds opaque across the swap window, then fades away.
 */
export function overlayEnvelope(t: number): number {
  const up = clamp01((t - 0.3) / (0.45 - 0.3));
  const upE = up * up * up;
  const down = clamp01((t - 0.68) / (0.88 - 0.68));
  const downE = 1 - (1 - down) * (1 - down) * (1 - down);
  return Math.min(upE, downE);
}

export class TransitionOverlay {
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly camera: THREE.PerspectiveCamera;
  private aspect: number;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.aspect = camera.aspect || 1;

    const geometry = new THREE.PlaneGeometry(2, 2);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uProgress: { value: 0 },
        uIntensity: { value: 0 },
        uAspect: { value: this.aspect },
        uColor: { value: new THREE.Color(0x0b1020) },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.name = 'era-transition-overlay';
    this.mesh.renderOrder = 999;
    this.mesh.frustumCulled = false;
    this.mesh.position.z = -0.6;
    this.mesh.visible = false;
    this.applyScale();
    camera.add(this.mesh);
  }

  private applyScale(): void {
    this.mesh.scale.set(this.aspect * 1.3, 1.3, 1);
  }

  /** Synchronize the overlay with the current camera aspect ratio. */
  setAspect(aspect: number): void {
    if (aspect !== this.aspect) {
      this.aspect = aspect;
      this.material.uniforms.uAspect.value = aspect;
      this.applyScale();
    }
  }

  /** Begin a transition sweep. */
  begin(): void {
    this.material.uniforms.uProgress.value = 0;
    this.material.uniforms.uIntensity.value = 0;
    this.mesh.visible = false;
  }

  /** Advance the overlay for normalized transition time `t` (0..1). */
  update(t: number): void {
    this.material.uniforms.uProgress.value = t;
    const intensity = overlayEnvelope(t);
    this.material.uniforms.uIntensity.value = intensity;
    this.mesh.visible = intensity > 0.001;
  }

  /** End the transition sweep and hide the overlay. */
  end(): void {
    this.mesh.visible = false;
    this.material.uniforms.uIntensity.value = 0;
    this.material.uniforms.uProgress.value = 0;
  }

  dispose(): void {
    this.camera.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
