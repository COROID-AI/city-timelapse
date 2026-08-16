import * as THREE from 'three';
import { TextureFactory } from '../util/textures.js';

// ── City-block ground/street layout ───────────────────────────────────
// One city block (sidewalk + buildings) surrounded by streets on all 4 sides.
// Layout dimensions (meters):
//   Street width: 10 m each side
//   Block interior: 60 × 60 m
//   Sidewalk: 2 m border around block interior

const STREET_WIDTH = 10;
const BLOCK_SIZE = 60;
const SIDEWALK_WIDTH = 2;
const TOTAL_EXTENT = BLOCK_SIZE + STREET_WIDTH * 2; // 80 m

export function buildGround(scene: THREE.Scene, textures: TextureFactory): void {
  // ── Road surfaces (one continuous plane for the street grid) ──────
  const roadMat = new THREE.MeshStandardMaterial({
    map: textures.createAsphalt(),
    roughness: 0.9,
    metalness: 0.0,
  });

  // Full ground plane large enough to cover the whole extent
  const groundGeo = new THREE.PlaneGeometry(TOTAL_EXTENT, TOTAL_EXTENT);
  const ground = new THREE.Mesh(groundGeo, roadMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ── Sidewalk pads ─────────────────────────────────────────────────
  const swMat = new THREE.MeshStandardMaterial({
    map: textures.createConcrete(),
    roughness: 0.85,
    metalness: 0.0,
  });

  // Four sidewalk strips around the inner block
  const swPositions = [
    // top strip
    { x: 0, z: -TOTAL_EXTENT / 2 + SIDEWALK_WIDTH / 2, w: TOTAL_EXTENT, d: SIDEWALK_WIDTH },
    // bottom strip
    { x: 0, z: TOTAL_EXTENT / 2 - SIDEWALK_WIDTH / 2, w: TOTAL_EXTENT, d: SIDEWALK_WIDTH },
    // left strip
    { x: -TOTAL_EXTENT / 2 + SIDEWALK_WIDTH / 2, z: 0, w: SIDEWALK_WIDTH, d: BLOCK_SIZE },
    // right strip
    { x: TOTAL_EXTENT / 2 - SIDEWALK_WIDTH / 2, z: 0, w: SIDEWALK_WIDTH, d: BLOCK_SIZE },
  ];

  for (const s of swPositions) {
    const geo = new THREE.PlaneGeometry(s.w, s.d);
    const mesh = new THREE.Mesh(geo, swMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(s.x, 0.01, s.z); // slightly above road to avoid z-fight
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // ── Block interior (grass/paved area where buildings sit) ─────────
  const blockMat = new THREE.MeshStandardMaterial({
    color: 0x7a9e6d,
    roughness: 0.95,
    metalness: 0.0,
  });
  const blockGeo = new THREE.PlaneGeometry(BLOCK_SIZE, BLOCK_SIZE);
  const block = new THREE.Mesh(blockGeo, blockMat);
  block.rotation.x = -Math.PI / 2;
  block.position.y = 0.02;
  block.receiveShadow = true;
  scene.add(block);

  // ── Curb lines (thin raised edges between sidewalk and road) ──────
  const curbMat = new THREE.MeshStandardMaterial({
    color: 0xaaaaaa,
    roughness: 0.7,
    metalness: 0.1,
  });

  const curbThickness = 0.3;
  const halfBlock = BLOCK_SIZE / 2;
  const curbSegments = [
    // top curb
    { x: 0, z: -halfBlock, w: BLOCK_SIZE + curbThickness, h: curbThickness },
    // bottom curb
    { x: 0, z: halfBlock, w: BLOCK_SIZE + curbThickness, h: curbThickness },
    // left curb
    { x: -halfBlock, z: 0, w: curbThickness, h: BLOCK_SIZE },
    // right curb
    { x: halfBlock, z: 0, w: curbThickness, h: BLOCK_SIZE },
  ];

  for (const c of curbSegments) {
    const geo = new THREE.BoxGeometry(c.w, 0.15, c.h);
    const mesh = new THREE.Mesh(geo, curbMat);
    mesh.position.set(c.x, 0.075, c.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // ── Center lines on roads ─────────────────────────────────────────
  const lineMat = new THREE.MeshStandardMaterial({
    color: 0xffdd44,
    roughness: 0.6,
    metalness: 0.0,
  });

  // Horizontal center line
  const hLineGeo = new THREE.PlaneGeometry(TOTAL_EXTENT, 0.2);
  const hLine = new THREE.Mesh(hLineGeo, lineMat);
  hLine.rotation.x = -Math.PI / 2;
  hLine.position.set(0, 0.03, 0);
  scene.add(hLine);

  // Vertical center line
  const vLineGeo = new THREE.PlaneGeometry(0.2, TOTAL_EXTENT);
  const vLine = new THREE.Mesh(vLineGeo, lineMat);
  vLine.rotation.x = -Math.PI / 2;
  vLine.position.set(0, 0.03, 0);
  scene.add(vLine);

  // ── Crosswalks at each intersection ───────────────────────────────
  const crosswalkMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.8,
    metalness: 0.0,
  });

  const crosswalkY = 0.035;
  const cwSize = 4;
  const cwStripeW = 0.5;
  const cwStripeGap = 1.0;

  for (const [cx, cz] of [
    [-halfBlock - STREET_WIDTH / 2, -halfBlock],
    [halfBlock + STREET_WIDTH / 2, -halfBlock],
    [-halfBlock - STREET_WIDTH / 2, halfBlock],
    [halfBlock + STREET_WIDTH / 2, halfBlock],
  ]) {
    // horizontal stripes
    for (let i = 0; i < 5; i++) {
      const stripeGeo = new THREE.PlaneGeometry(cwStripeW, cwSize);
      const stripe = new THREE.Mesh(stripeGeo, crosswalkMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(cx - cwSize / 2 + i * (cwStripeW + cwStripeGap), crosswalkY, cz);
      scene.add(stripe);
    }
  }

  // ── Simple building placeholders (low-poly boxes on the block) ────
  const buildingCount = 4;
  const spacing = BLOCK_SIZE / (buildingCount + 1);
  const bWidth = spacing * 0.7;
  const bDepth = spacing * 0.7;

  for (let i = 0; i < buildingCount; i++) {
    for (let j = 0; j < buildingCount; j++) {
      if (Math.random() < 0.25) continue; // some gaps for variety

      const height = 4 + Math.random() * 16;
      const geo = new THREE.BoxGeometry(bWidth, height, bDepth);
      const facadeMat = new THREE.MeshStandardMaterial({
        map: textures.createBrick(),
        roughness: 0.85,
        metalness: 0.05,
      });
      const building = new THREE.Mesh(geo, facadeMat);
      building.position.set(
        -halfBlock + spacing * (i + 1),
        height / 2,
        -halfBlock + spacing * (j + 1),
      );
      building.castShadow = true;
      building.receiveShadow = true;
      scene.add(building);
    }
  }
}
