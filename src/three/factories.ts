/**
 * Module-scope shared geometry + a couple of singleton materials. Created once,
 * never per-frame. The driver updates the sky/ground material uniforms each
 * frame to interpolate the continuous scene config.
 */
import * as THREE from 'three'

/** Unit box; per-instance transforms supply size. */
export const boxGeo = new THREE.BoxGeometry(1, 1, 1)
/** Unit plane. */
export const planeGeo = new THREE.PlaneGeometry(1, 1)
/** Unit cylinder (radius 0.5, height 1). */
export const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 10)
/** Thin box for sign panels / billboards. */
export const panelGeo = new THREE.BoxGeometry(1, 1, 0.12)

/** Gradient sky material. Driver writes topColor/bottomColor each frame. */
export const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    topColor: { value: new THREE.Color(0x4a5a6a) },
    bottomColor: { value: new THREE.Color(0xc89a5a) },
    offset: { value: 10 },
    exponent: { value: 0.7 },
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
    varying vec3 vWorld;
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform float offset;
    uniform float exponent;
    void main() {
      vec3 dir = normalize(vWorld + vec3(0.0, offset, 0.0));
      float h = max(dir.y, 0.0);
      float t = pow(h, exponent);
      gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
    }
  `,
})

/** Ground material. Driver writes .color each frame. */
export const groundMat = new THREE.MeshStandardMaterial({
  color: 0x555048,
  roughness: 0.96,
  metalness: 0.0,
})

/** Asphalt road material (static dark). */
export const roadMat = new THREE.MeshStandardMaterial({
  color: 0x1c1d20,
  roughness: 0.9,
  metalness: 0.0,
})
