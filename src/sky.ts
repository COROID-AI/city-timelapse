// Sky dome: a large inverted sphere whose vertex colours form a two-stop
// gradient. Fog colour is driven from the same source so the horizon blends.

import * as THREE from 'three';
import { EraConfig } from './eras';

export class Sky {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x9fb8c9) },
        bottomColor: { value: new THREE.Color(0xd9c9a8) },
        offset: { value: 0.0 },
        exponent: { value: 0.7 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos + vec3(0.0, offset, 0.0)).y;
          float t = pow(clamp(h * 0.5 + 0.5, 0.0, 1.0), exponent);
          gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
        }
      `,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), this.material);
    this.mesh.frustumCulled = false;
  }

  applyEra(state: EraConfig): void {
    (this.material.uniforms.topColor.value as THREE.Color).set(state.skyTop);
    (this.material.uniforms.bottomColor.value as THREE.Color).set(state.skyBottom);
  }

  dispose(): void {
    this.material.dispose();
    (this.mesh.geometry as THREE.BufferGeometry).dispose();
  }
}
