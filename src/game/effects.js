// Visual effects helpers: canvas-generated neon sign / building window
// textures, the wet-road reflector ground, nitrous exhaust flames + particle
// trail, and speed-line streaks.

import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { CONFIG } from './config.js';

/** Draw a text onto a canvas texture and return a THREE.CanvasTexture. */
function makeTextTexture(text, colorHex, opts = {}) {
  const width = opts.width ?? 128;
  const height = opts.height ?? 64;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const font = `${opts.fontSize ?? 42}px 'Arial Black', Arial, sans-serif`;
  ctx.font = font;
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = 16;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.fillStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
  ctx.strokeText(text, width / 2, height / 2);
  ctx.fillText(text, width / 2, height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A self-contained neon sign box with emissive canvas text and flicker hook. */
export function buildNeonSign(text, colorHex) {
  const tex = makeTextTexture(text, colorHex, { width: 192, height: 96, fontSize: 56 });
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    toneMapped: false,
    color: 0xffffff,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), mat);
  mesh.userData.mat = mat;
  mesh.userData.texture = tex;
  mesh.userData.baseIntensity = 1;
  return mesh;
}

/** Tint a neon mat toward its base color with ×0 token flattening per call. */
export function flickerNeon(signMesh, time) {
  const m = signMesh.userData.mat;
  if (!m) return;
  const flicker = 0.82 + 0.18 * Math.sin(time * 13 + signMesh.position.x) * Math.sin(time * 7.3 + signMesh.position.z);
  m.opacity = Math.min(1, flicker);
}

/** Canvas-generated emissive window grid for a building of given height. */
export function makeBuildingWindows(height) {
  const rows = Math.max(4, Math.round(height / 5));
  const cols = 6;
  const w = 256;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0b0b12';
  ctx.fillRect(0, 0, w, h);
  const rng = seedRandom(7);
  const cellW = w / cols;
  const cellH = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = rng() > 0.35;
      ctx.fillStyle = lit
        ? `rgba(255, ${200 + Math.floor(rng() * 55)}, ${180 + Math.floor(rng() * 40)}, 0.8)`
        : 'rgba(30,30,45,0.9)';
      ctx.fillRect(c * cellW + 3, r * cellH + 3, cellW - 6, cellH - 6);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function seedRandom(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The wet reflective ground: a Reflector mirror plane underneath a translucent
 * dark asphalt overlay so objects (neon, lights) visibly reflect with a wet tint.
 */
export function createWetGround(width = 400, depth = 400) {
  const group = new THREE.Group();

  const reflector = new Reflector(width, depth, {
    clipBias: 0.003,
    textureWidth: CONFIG.track.reflectTexture,
    textureHeight: CONFIG.track.reflectTexture,
    color: 0x26262c,
    recursive: false,
  });
  reflector.position.y = 0;
  reflector.rotation.x = -Math.PI / 2;
  group.add(reflector);

  // Translucent dark asphalt overlay on top so the mirror isn't too bright.
  const overlayGeo = new THREE.PlaneGeometry(width, depth);
  const overlayMat = new THREE.MeshBasicMaterial({
    color: 0x05050a,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const overlay = new THREE.Mesh(overlayGeo, overlayMat);
  overlay.rotation.x = -Math.PI / 2;
  overlay.position.y = 0.01;
  group.add(overlay);

  return group;
}

/** Nitrous exhaust flame cones; scale pulses when active. */
export function createExhaustFlames(carMesh) {
  const group = new THREE.Group();
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x8a5cff,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const conical = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 2.2, 10, 1, true),
    flameMat,
  );
  conical.rotation.x = -Math.PI / 2; // point backward
  conical.position.z = 1.1;
  conical.position.y = 0.35;
  group.add(conical);
  // Blue-purple second layer.
  const flame2 = new THREE.Mesh(
    new THREE.ConeGeometry(0.75, 1.0, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x3f7bff,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  flame2.rotation.x = -Math.PI / 2;
  flame2.position.z = 0.5;
  flame2.position.y = 0.3;
  group.add(flame2);
  group.traverse((o) => {
    if (o.isMesh) o.userData.isFlame = true;
  });
  group.name = 'exhaust';
  group.visible = false;
  carMesh.add(group);
  return group;
}

/** Additive particle trail emitted from the car rear while boosting. */
export function createParticleTrail(size = 80) {
  const count = size;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const mat = new THREE.PointsMaterial({
    size: 0.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.userData = { cursor: 0, count, positions, sizes };
  points.visible = false;
  points.frustumCulled = false;
  return points;
}

/** Speed-line streaks overlay (simple additive lines radiating outward). */
export function createSpeedLines(scene, count = 40) {
  const group = new THREE.Group();
  const positions = new Float32Array(count * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({
    color: 0x88bbff,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  group.add(lines);
  group.name = 'speedlines';
  group.visible = false;
  scene.add(group);
  return { group, geo, mat };
}