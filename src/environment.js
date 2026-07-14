import * as THREE from 'three';
import { shadeColor } from './textures.js';

// Ground plane + roads + sidewalks for a block.
export function makeEnvironment(era) {
  const g = new THREE.Group();
  const matSet = new Set();
  function reg(m) { matSet.add(m); return m; }

  // ground / lot
  const groundMat = reg(new THREE.MeshStandardMaterial({ color: era.ground.ground, roughness: 0.95, metalness: 0.0, transparent: true }));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true;
  g.add(ground);

  // roads: a cross through the centre
  const roadMat = reg(new THREE.MeshStandardMaterial({ color: era.ground.road, roughness: 0.9, metalness: 0.0, transparent: true }));
  const roadX = new THREE.Mesh(new THREE.PlaneGeometry(220, 12), roadMat);
  roadX.rotation.x = -Math.PI / 2; roadX.position.y = 0; roadX.receiveShadow = true; g.add(roadX);
  const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(12, 220), roadMat);
  roadZ.rotation.x = -Math.PI / 2; roadZ.position.y = 0; roadZ.receiveShadow = true; g.add(roadZ);

  // center intersection (slightly different)
  const interMat = reg(new THREE.MeshStandardMaterial({ color: shadeColor(era.ground.road, 8), roughness: 0.9, transparent: true }));
  const inter = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), interMat);
  inter.rotation.x = -Math.PI / 2; inter.position.y = 0.01; inter.receiveShadow = true; g.add(inter);

  // road centre lines (emissive dashes)
  const lineMat = reg(new THREE.MeshStandardMaterial({
    color: era.ground.line, emissive: era.ground.line,
    emissiveIntensity: era.night ? 2.5 : 0.2, roughness: 0.5, transparent: true
  }));
  for (let i = -90; i <= 90; i += 6) {
    const dx = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.25), lineMat);
    dx.rotation.x = -Math.PI / 2; dx.position.set(i, 0.02, 0); g.add(dx);
    const dz = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 3), lineMat);
    dz.rotation.x = -Math.PI / 2; dz.position.set(0, 0.02, i); g.add(dz);
  }

  // sidewalks bordering the roads on 4 quadrant blocks
  const swMat = reg(new THREE.MeshStandardMaterial({ color: era.ground.sidewalk, roughness: 0.9, transparent: true }));
  const swCurbMat = reg(new THREE.MeshStandardMaterial({ color: shadeColor(era.ground.sidewalk, -25), roughness: 0.95, transparent: true }));
  const quadrants = [
    { cx: 30, cz: 30, sign: [1, 1] },
    { cx: -30, cz: 30, sign: [-1, 1] },
    { cx: 30, cz: -30, sign: [1, -1] },
    { cx: -30, cz: -30, sign: [-1, -1] }
  ];
  for (const q of quadrants) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(48, 0.2, 48), swMat);
    sw.position.set(q.cx, 0.1, q.cz); sw.receiveShadow = true; g.add(sw);
    // curb edge facing the road
    const curb1 = new THREE.Mesh(new THREE.BoxGeometry(48, 0.3, 0.3), swCurbMat);
    curb1.position.set(q.cx, 0.15, q.cz - 24 * q.sign[1]); g.add(curb1);
    const curb2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 48), swCurbMat);
    curb2.position.set(q.cx - 24 * q.sign[0], 0.15, q.cz); g.add(curb2);
  }

  g.userData.materials = [...matSet];
  return g;
}

// Build a sky dome with a vertical gradient and optional starfield.
export function makeSky(era) {
  const geo = new THREE.SphereGeometry(300, 32, 16);
  const uniforms = {
    topColor: { value: new THREE.Color(era.sky.top) },
    bottomColor: { value: new THREE.Color(era.sky.bottom) },
    offset: { value: 30 },
    exponent: { value: 0.7 },
    stars: { value: era.starfield ? 1 : 0 }
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    transparent: true,
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      uniform float stars;
      varying vec3 vWorldPosition;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        float t = pow(max(h, 0.0), exponent);
        vec3 col = mix(bottomColor, topColor, t);
        if (stars > 0.5) {
          vec2 uv = vWorldPosition.xz * 0.5;
          float s = step(0.9975, hash(floor(uv)));
          float s2 = step(0.997, hash(floor(uv * 1.7) + 13.0));
          col += vec3(max(s, s2)) * smoothstep(0.0, 0.4, h);
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.userData.material = mat;
  sky.userData.uniforms = uniforms;
  return sky;
}

// Update an existing sky's colors/flags for a new era.
export function updateSky(sky, era) {
  const u = sky.userData.uniforms;
  u.topColor.value.set(era.sky.top);
  u.bottomColor.value.set(era.sky.bottom);
  u.stars.value = era.starfield ? 1 : 0;
}
