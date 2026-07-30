import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useEra } from '../contexts/EraContext';
import type { EraYear } from '../types';
import * as THREE from 'three';

/* ── Era constants ── */
const ERA_YEARS: readonly EraYear[] = [1945, 1965, 1985, 2005, 2025, 2055];
const ERA_COUNT = ERA_YEARS.length;

/* ── Era-specific building visuals ── */
interface EraBuildingStyle {
  height: number;         // normalized height multiplier (base = 1)
  roofType: 'flat' | 'gable' | 'hip' | 'dome' | 'parabolic' | 'spire';
  roofHeight: number;     // extra height above core box
  facadeColor: THREE.Color;
  roughness: number;
  metalness: number;
  windowColor: THREE.Color;
  windowSize: number;     // relative window square size
  windowSpacing: number;  // horizontal spacing (0-1 of width)
  windowRows: number;     // number of distinct window rows
  signageScale: number;
  signageColor: THREE.Color;
  awningColor: THREE.Color | null;
  storeFrontHeight: number; // ground-floor height as fraction of total
}

const ERA_STYLES: Record<EraYear, EraBuildingStyle> = {
  1945: {
    height: 1,
    roofType: 'flat',
    roofHeight: 0,
    facadeColor: new THREE.Color(0x8B7355),
    roughness: 0.92,
    metalness: 0.02,
    windowColor: new THREE.Color(0xFFE4B5),
    windowSize: 0.35,
    windowSpacing: 0.2,
    windowRows: 3,
    signageScale: 0.3,
    signageColor: new THREE.Color(0xCCAA88),
    awningColor: new THREE.Color(0xD4A574),
    storeFrontHeight: 0.15,
  },
  1965: {
    height: 1.4,
    roofType: 'flat',
    roofHeight: 0.05,
    facadeColor: new THREE.Color(0xA0A0A0),
    roughness: 0.78,
    metalness: 0.08,
    windowColor: new THREE.Color(0xB0D4F1),
    windowSize: 0.45,
    windowSpacing: 0.15,
    windowRows: 4,
    signageScale: 0.5,
    signageColor: new THREE.Color(0xFF6644),
    awningColor: new THREE.Color(0xFFCC88),
    storeFrontHeight: 0.12,
  },
  1985: {
    height: 1.8,
    roofType: 'gable',
    roofHeight: 1.2,
    facadeColor: new THREE.Color(0x3A3A4A),
    roughness: 0.35,
    metalness: 0.75,
    windowColor: new THREE.Color(0x88FFEE),
    windowSize: 0.5,
    windowSpacing: 0.12,
    windowRows: 6,
    signageScale: 0.8,
    signageColor: new THREE.Color(0xFF00FF),
    awningColor: new THREE.Color(0x00FFFF),
    storeFrontHeight: 0.1,
  },
  2005: {
    height: 2.2,
    roofType: 'flat',
    roofHeight: 0.1,
    facadeColor: new THREE.Color(0xC0C8D0),
    roughness: 0.25,
    metalness: 0.65,
    windowColor: new THREE.Color(0xE0F0FF),
    windowSize: 0.55,
    windowSpacing: 0.1,
    windowRows: 7,
    signageScale: 1.0,
    signageColor: new THREE.Color(0xFFCC00),
    awningColor: null,
    storeFrontHeight: 0.08,
  },
  2025: {
    height: 2.6,
    roofType: 'parabolic',
    roofHeight: 1.5,
    facadeColor: new THREE.Color(0xAAE0F0),
    roughness: 0.08,
    metalness: 0.88,
    windowColor: new THREE.Color(0x00FFCC),
    windowSize: 0.6,
    windowSpacing: 0.08,
    windowRows: 8,
    signageScale: 1.2,
    signageColor: new THREE.Color(0x00FF88),
    awningColor: null,
    storeFrontHeight: 0.07,
  },
  2055: {
    height: 3.0,
    roofType: 'spire',
    roofHeight: 2.0,
    facadeColor: new THREE.Color(0xD0B0FF),
    roughness: 0.12,
    metalness: 0.78,
    windowColor: new THREE.Color(0xCC88FF),
    windowSize: 0.65,
    windowSpacing: 0.07,
    windowRows: 9,
    signageScale: 1.5,
    signageColor: new THREE.Color(0xFF66FF),
    awningColor: new THREE.Color(0x66FFFF),
    storeFrontHeight: 0.06,
  },
}

/* ── Building config (from atmosphere/plan feature) ── */
interface BuildingConfig {
  minHeight: number;
  maxHeight: number;
  minWidth: number;
  maxWidth: number;
  facadeColor: number;
  facadeMetalness: number;
  facadeRoughness: number;
  roofType: 'flat' | 'pitched' | 'domed' | 'modern';
  windowColor: number;
  windowRatio: number;
  material: 'masonry' | 'concrete' | 'glass' | 'composite';
}

const eraBuildings: Record<EraYear, BuildingConfig> = {
  1945: {
    minHeight: 2, maxHeight: 5,
    minWidth: 4, maxWidth: 8,
    facadeColor: 0x8b7d6b, facadeMetalness: 0.05, facadeRoughness: 0.95,
    roofType: 'pitched', windowColor: 0x8fa8c0, windowRatio: 0.35, material: 'masonry',
  },
  1965: {
    minHeight: 3, maxHeight: 8,
    minWidth: 5, maxWidth: 10,
    facadeColor: 0x7a8a7a, facadeMetalness: 0.1, facadeRoughness: 0.85,
    roofType: 'flat', windowColor: 0x8fa8c0, windowRatio: 0.45, material: 'concrete',
  },
  1985: {
    minHeight: 5, maxHeight: 15,
    minWidth: 6, maxWidth: 12,
    facadeColor: 0x9a9aaa, facadeMetalness: 0.35, facadeRoughness: 0.55,
    roofType: 'flat', windowColor: 0x4a6a8a, windowRatio: 0.55, material: 'glass',
  },
  2005: {
    minHeight: 8, maxHeight: 25,
    minWidth: 8, maxWidth: 16,
    facadeColor: 0xb0c0c0, facadeMetalness: 0.55, facadeRoughness: 0.35,
    roofType: 'modern', windowColor: 0x3a5a7a, windowRatio: 0.65, material: 'glass',
  },
  2025: {
    minHeight: 10, maxHeight: 35,
    minWidth: 10, maxWidth: 20,
    facadeColor: 0xc0d0e0, facadeMetalness: 0.65, facadeRoughness: 0.25,
    roofType: 'modern', windowColor: 0x2a4a6a, windowRatio: 0.75, material: 'composite',
  },
  2055: {
    minHeight: 15, maxHeight: 60,
    minWidth: 12, maxWidth: 25,
    facadeColor: 0xd0e0f0, facadeMetalness: 0.8, facadeRoughness: 0.15,
    roofType: 'modern', windowColor: 0x1a3a5a, windowRatio: 0.85, material: 'composite',
  },
}

function hashCoord(x: number, z: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(a + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/* ── Building block layout ── */
interface BuildingBlock {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
}

/* ── Generate 8 buildings in a city block ── */
function buildBlockLayout(): BuildingBlock[] {
  const blocks: BuildingBlock[] = [];
  const gridSize = 3; // 3×3 grid with center gap
  const spacing = 5.5;
  const offset = -(gridSize - 1) * spacing / 2;

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      // Skip center block for a street
      if (row === 1 && col === 1) continue;
      blocks.push({
        x: offset + col * spacing,
        z: offset + row * spacing,
        width: 3.5 + Math.random() * 1.5,
        depth: 3.5 + Math.random() * 1.5,
        height: 0.8 + Math.random() * 0.6, // base height factor
      });
    }
  }
  return blocks;
}

/* ── Building geometry utilities ── */
function createBuildingGeometry(
  width: number,
  depth: number,
  height: number,
  windowRows: number,
  windowCols: number,
): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(width, height, depth, windowCols, windowRows, 1);
  const pos = geo.attributes.position;
  const blockWidth = width / windowCols;
  const blockDepth = depth / 1;
  const blockHeight = height / windowRows;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const col = Math.floor((x / blockWidth) + windowCols / 2);
    const row = Math.floor((y / blockHeight) + windowRows / 2);
    const isWindow = col >= 0 && col < windowCols && row >= 0 && row < windowRows;

    if (isWindow) {
      const wx = (col - windowCols / 2 + 0.5) * blockWidth;
      const wy = (row - windowRows / 2 + 0.5) * blockHeight;
      const wobbleX = (Math.random() - 0.5) * blockWidth * 0.3;
      const wobbleY = (Math.random() - 0.5) * blockHeight * 0.3;
      pos.setX(i, wx + wobbleX);
      pos.setY(i, wy + wobbleY);
    }
  }

  geo.computeVertexNormals();
  return geo;
}

/* ── Morph target position computation ── */
function computeMorphPositions(
  baseGeo: THREE.BoxGeometry,
  style: EraBuildingStyle,
  blockWidth: number,
  blockDepth: number,
  blockHeight: number,
): Float32Array {
  const positions = baseGeo.attributes.position.array.slice();
  const posAttr = baseGeo.attributes.position;

  for (let i = 0; i < posAttr.count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];

    let newY = y;

    const roofDisp = computeRoofDisp(style.roofType, x, z, blockWidth, blockDepth, style.roofHeight);

    newY += roofDisp;

    positions[i * 3 + 1] = newY;
  }

  return new Float32Array(positions);
}

function computeRoofDisp(
  roofType: string,
  x: number,
  z: number,
  blockWidth: number,
  blockDepth: number,
  roofHeight: number,
): number {
  let roofDisp = 0;

  switch (roofType) {
    case 'flat':
      roofDisp = 0;
      break;
    case 'gable':
      const gableSlope = 0.3;
      roofDisp = Math.max(0, roofHeight * (1 - Math.abs(x) / (blockWidth * 0.5))) * gableSlope;
      break;
    case 'hip':
      const hipDist = Math.max(Math.abs(x) / (blockWidth * 0.5), Math.abs(z) / (blockDepth * 0.5));
      roofDisp = Math.max(0, roofHeight * (1 - hipDist));
      break;
    case 'dome':
      const dx = x / (blockWidth * 0.4);
      const dz = z / (blockDepth * 0.4);
      const d2 = dx * dx + dz * dz;
      if (d2 < 1) {
        roofDisp = roofHeight * Math.sqrt(Math.max(0, 1 - d2));
      }
      break;
    case 'parabolic':
      roofDisp = roofHeight * Math.max(0, 1 - (x * x + z * z) / (blockWidth * blockDepth * 0.3));
      break;
    case 'spire':
      const distFromCenter = Math.sqrt(x * x + z * z);
      const maxDist = Math.max(0.01, Math.min(blockWidth, blockDepth) * 0.4);
      const taper = Math.max(0, 1 - distFromCenter / maxDist);
      roofDisp = roofHeight * taper * taper;
      break;
  }

  return roofDisp;
}

/* ── Compute morph normals (simple: recompute face normals) ── */
function computeMorphNormals(
  baseGeo: THREE.BoxGeometry,
  targetPositions: Float32Array,
): Float32Array {
  const positions = targetPositions;
  const count = positions.length / 3;
  const normals = new Float32Array(count * 3);
  const indexArr = baseGeo.index?.array;

  if (indexArr) {
    for (let i = 0; i < indexArr.length; i += 3) {
      const a = indexArr[i] * 3;
      const b = indexArr[i + 1] * 3;
      const c = indexArr[i + 2] * 3;

      const ax = positions[a], ay = positions[a + 1], az = positions[a + 2];
      const bx = positions[b], by = positions[b + 1], bz = positions[b + 2];
      const cx = positions[c], cy = positions[c + 1], cz = positions[c + 2];

      const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
      const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
      const nx = e1y * e2z - e1z * e2y;
      const ny = e1z * e2x - e1x * e2z;
      const nz = e1x * e2y - e1y * e2x;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

      normals[a] += nx / len;
      normals[a + 1] += ny / len;
      normals[a + 2] += nz / len;
      normals[b] += nx / len;
      normals[b + 1] += ny / len;
      normals[b + 2] += nz / len;
      normals[c] += nx / len;
      normals[c + 1] += ny / len;
      normals[c + 2] += nz / len;
    }
  } else {
    for (let i = 0; i < count; i += 3) {
      const a = i * 3;
      const b = (i + 1) * 3;
      const c = (i + 2) * 3;

      const ax = positions[a], ay = positions[a + 1], az = positions[a + 2];
      const bx = positions[b], by = positions[b + 1], bz = positions[b + 2];
      const cx = positions[c], cy = positions[c + 1], cz = positions[c + 2];

      const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
      const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
      const nx = e1y * e2z - e1z * e2y;
      const ny = e1z * e2x - e1x * e2z;
      const nz = e1x * e2y - e1y * e2x;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

      for (let j = 0; j < 3; j++) {
        normals[a + j] = nx / len;
        normals[b + j] = nx / len;
        normals[c + j] = nx / len;
      }
    }
  }

  return normals;
}

/* ── Interpolation utilities ── */
function getEraInterp(year: EraYear): { lower: number; upper: number; t: number } {
  const idx = ERA_YEARS.indexOf(year);
  if (idx < 0) return { lower: 0, upper: 0, t: 0 };
  if (idx === 0) return { lower: 0, upper: 0, t: 0 };
  if (idx === ERA_COUNT - 1) return { lower: idx - 1, upper: idx, t: 1 };
  return { lower: idx - 1, upper: idx, t: 1 };
}

function lerpColor3(a: THREE.Color, b: THREE.Color, t: number): THREE.Color {
  return new THREE.Color(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t,
  );
}

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/* ── Building mesh component with morph targets ── */
interface BuildingProps {
  block: BuildingBlock;
}

function BuildingMesh({ block }: BuildingProps) {
  const { year } = useEra();
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  const coreGeo = useMemo(() => {
    const windowCols = 4;
    const windowRows = 6;
    return createBuildingGeometry(block.width, block.depth, 1, windowRows, windowCols);
  }, [block.width, block.depth]);

  // Pre-compute morph targets for each era
  const morphAttrs = useMemo(() => {
    const positions: THREE.BufferAttribute[] = [];
    const normals: THREE.BufferAttribute[] = [];

    for (const eraYear of ERA_YEARS) {
      const style = ERA_STYLES[eraYear];
      const targetPos = computeMorphPositions(coreGeo, style, block.width, block.depth, block.height);
      const targetNorm = computeMorphNormals(coreGeo, targetPos);

      const posAttr = new THREE.BufferAttribute(targetPos, 3);
      posAttr.name = `era-${eraYear}-position`;
      positions.push(posAttr);

      const normAttr = new THREE.BufferAttribute(targetNorm, 3);
      normAttr.name = `era-${eraYear}-normal`;
      normals.push(normAttr);
    }

    return { positions, normals };
  }, [coreGeo, block.width, block.depth, block.height]);

  // Attach morph attributes once
  useEffect(() => {
    coreGeo.morphAttributes.position = morphAttrs.positions;
    coreGeo.morphAttributes.normal = morphAttrs.normals;
    coreGeo.morphAttributes.position.forEach((attr) => {
      attr.needsUpdate = true;
    });
    coreGeo.morphAttributes.normal.forEach((attr) => {
      attr.needsUpdate = true;
    });
    coreGeo.morphTargetsRelative = false;
    coreGeo.computeBoundingSphere();
  }, [coreGeo, morphAttrs]);

  // Material that lerps between eras
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: ERA_STYLES[ERA_YEARS[0]].facadeColor.clone(),
      roughness: ERA_STYLES[ERA_YEARS[0]].roughness,
      metalness: ERA_STYLES[ERA_YEARS[0]].metalness,
      transparent: true,
      opacity: 0.95,
    });
  }, []);

  // Animate morph influences + material per frame
  useFrame(() => {
    const mesh = meshRef.current;
    const mat = material;
    if (!mesh) return;

    const { lower, upper, t } = getEraInterp(year);

    const influences = new Array(ERA_COUNT).fill(0);
    if (lower === upper) {
      influences[lower] = 1;
    } else {
      influences[lower] = 1 - t;
      influences[upper] = t;
    }
    mesh.morphTargetInfluences = influences;
    mesh.updateMorphTargets();

    const lowerStyle = ERA_STYLES[ERA_YEARS[lower]];
    const upperStyle = ERA_STYLES[ERA_YEARS[upper]];

    mat.color.copy(lerpColor3(lowerStyle.facadeColor, upperStyle.facadeColor, t));
    mat.roughness = lerpNum(lowerStyle.roughness, upperStyle.roughness, t);
    mat.metalness = lerpNum(lowerStyle.metalness, upperStyle.metalness, t);
    mat.needsUpdate = true;
  });

  // Store-front and signage sub-meshes
  const storeFrontMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x222233),
    roughness: 0.6,
    metalness: 0.2,
  }), []);

  const signageMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: ERA_STYLES[ERA_YEARS[0]].signageColor.clone(),
    roughness: 0.4,
    metalness: 0.3,
    emissive: ERA_STYLES[ERA_YEARS[0]].signageColor.clone().multiplyScalar(0.3),
  }), []);

  // Update signage / store-front material per frame
  useFrame(() => {
    const { lower, upper, t } = getEraInterp(year);
    const lowerStyle = ERA_STYLES[ERA_YEARS[lower]];
    const upperStyle = ERA_STYLES[ERA_YEARS[upper]];

    signageMat.color.copy(lerpColor3(lowerStyle.signageColor, upperStyle.signageColor, t));
    signageMat.emissive.copy(lerpColor3(lowerStyle.signageColor, upperStyle.signageColor, t).multiplyScalar(0.3));
    signageMat.needsUpdate = true;
  });

  return (
    <group ref={groupRef} position={[block.x, 0, block.z]} castShadow receiveShadow>
      {/* Main building body with morph targets */}
      <mesh
        ref={meshRef}
        geometry={coreGeo}
        material={material}
        castShadow
        receiveShadow
      />
      {/* Storefront (ground floor) */}
      <mesh
        position={[0, block.height * ERA_STYLES[ERA_YEARS[0]].storeFrontHeight / 2, 0]}
        scale={[block.width, block.height * ERA_STYLES[ERA_YEARS[0]].storeFrontHeight, block.depth]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={storeFrontMat} />
      </mesh>
      {/* Signage on façade */}
      <mesh
        position={[0, block.height * ERA_STYLES[ERA_YEARS[0]].height * 2.2, block.depth / 2 + 0.05]}
        scale={[block.width * 0.8, block.height * 0.3, 0.05]}
        castShadow={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={signageMat} />
      </mesh>
      {/* Awning above storefront */}
      {ERA_STYLES[ERA_YEARS[0]].awningColor && (
        <mesh
          position={[0, block.height * ERA_STYLES[ERA_YEARS[0]].storeFrontHeight + 0.05, block.depth / 2 + 0.02]}
          scale={[block.width * 1.05, 0.05, block.depth * 0.9]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <primitive object={new THREE.MeshStandardMaterial({
            color: ERA_STYLES[ERA_YEARS[0]].awningColor!,
            roughness: 0.7,
            metalness: 0.1,
          })} />
        </mesh>
      )}
    </group>
  );
}

/* ── Window light strips for nighttime / era glow ── */
function BuildingWindows({ block }: { block: BuildingBlock }) {
  const { year } = useEra();
  const { lower, upper, t } = getEraInterp(year);
  const lowerStyle = ERA_STYLES[ERA_YEARS[lower]];
  const upperStyle = ERA_STYLES[ERA_YEARS[upper]];

  const windowMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: lerpColor3(lowerStyle.windowColor, upperStyle.windowColor, t),
    emissive: lerpColor3(lowerStyle.windowColor, upperStyle.windowColor, t).multiplyScalar(0.4),
    roughness: 0.2,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
  }), []);

  // Re-create material color per frame
  useFrame(() => {
    const { lower, upper, t } = getEraInterp(year);
    const lowerStyle = ERA_STYLES[ERA_YEARS[lower]];
    const upperStyle = ERA_STYLES[ERA_YEARS[upper]];
    windowMat.color.copy(lerpColor3(lowerStyle.windowColor, upperStyle.windowColor, t));
    windowMat.emissive.copy(lerpColor3(lowerStyle.windowColor, upperStyle.windowColor, t).multiplyScalar(0.4));
    windowMat.needsUpdate = true;
  });

  return (
    <group position={[block.x, 0, block.z]}>
      {/* Simple window plane on front face */}
      <mesh
        position={[0, block.height * 0.5, block.depth / 2 + 0.02]}
        scale={[block.width * 0.8, block.height * 0.6, 1]}
      >
        <planeGeometry args={[1, 1]} />
        <primitive object={windowMat} />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════
   BuildingGroup — renders the full city block
   ═══════════════════════════════════════════ */
export function BuildingGroup() {
  const blocks = useMemo(() => buildBlockLayout(), []);

  return (
    <group>
      {blocks.map((block, i) => (
        <BuildingMesh key={`bldg-${i}`} block={block} />
      ))}
      {blocks.map((block, i) => (
        <BuildingWindows key={`win-${i}`} block={block} />
      ))}
    </group>
  );
}

/* ── BuildingSystem (grid-based, for atmosphere/plan integration) ── */
interface BuildingBlock_ {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  config: BuildingConfig;
}

interface BuildingSystemProps {
  year?: EraYear;
  eraBlendT?: number;
  loEra?: EraYear;
  hiEra?: EraYear;
}

export function BuildingSystem({ year: yearProp, eraBlendT, loEra, hiEra }: BuildingSystemProps) {
  const { year } = useEra();

  const effectiveYear = yearProp ?? year;
  const hasTransition = loEra !== undefined && hiEra !== undefined && eraBlendT !== undefined && loEra !== hiEra;

  const renderBuildingsForConfig = (cfg: BuildingConfig, fadeOpacity: number, scale: number) => {
    const blocks = buildBlocks(cfg);
    return (
      <group
        name="buildings-morph"
        scale={[scale, scale, scale]}
        // Slightly prefer deterministic ordering during crossfade; meshes handle ordering.
      >
        {blocks.map((block, i) => (
          <group key={`building-${cfg.facadeColor}-${i}`} name={`building-${i}`}>
            <mesh position={[block.x, block.height / 2, block.z]} castShadow receiveShadow>
              <boxGeometry args={[block.width, block.height, block.depth]} />
              <meshStandardMaterial
                color={block.config.facadeColor}
                metalness={block.config.facadeMetalness}
                roughness={block.config.facadeRoughness}
                transparent
                opacity={fadeOpacity}
              />
            </mesh>

            {/* Roof variants */}
            {block.config.roofType === 'pitched' && (
              <mesh position={[block.x, block.height + 0.5, block.z]}>
                <coneGeometry args={[block.width * 0.6, 1.2, 4]} />
                <meshStandardMaterial color={0x555555} roughness={0.9} transparent opacity={fadeOpacity} />
              </mesh>
            )}
            {block.config.roofType === 'domed' && (
              <mesh position={[block.x, block.height + 0.3, block.z]}>
                <sphereGeometry args={[block.width * 0.35, 16, 12]} />
                <meshStandardMaterial color={0x555555} roughness={0.8} transparent opacity={fadeOpacity} />
              </mesh>
            )}
            {block.config.roofType === 'flat' && block.height > 6 && (
              <mesh position={[block.x, block.height + 0.12, block.z]}>
                <boxGeometry args={[block.width * 0.9, 0.25, block.depth * 0.9]} />
                <meshStandardMaterial color={0x444444} roughness={0.7} transparent opacity={fadeOpacity} />
              </mesh>
            )}
            {block.config.roofType === 'modern' && block.height > 8 && (
              <>
                <mesh position={[block.x, block.height + 0.15, block.z]}>
                  <boxGeometry args={[block.width * 0.95, 0.3, block.depth * 0.95]} />
                  <meshStandardMaterial color={0x333333} roughness={0.6} transparent opacity={fadeOpacity} />
                </mesh>
                <mesh position={[block.x, block.height + 0.3, block.z]}>
                  <boxGeometry args={[block.width * 0.3, 1.5, block.depth * 0.3]} />
                  <meshStandardMaterial color={0x224466} metalness={0.8} roughness={0.2} transparent opacity={fadeOpacity} />
                </mesh>
              </>
            )}

            {/* Windows */}
            {block.config.windowRatio > 0 && block.height > 2 && block.config.windowRatio > 0.2 && (
              <group>
                {Array.from({ length: Math.max(1, Math.round(block.config.windowRatio * 3)) }, (_, row) => {
                  const wy = (row + 0.5) * (block.height / (Math.round(block.config.windowRatio * 3) + 1));
                  return (
                    <mesh
                      key={`win-${cfg.facadeColor}-${i}-${row}`}
                      position={[block.x, wy, block.z + block.depth / 2 + 0.01]}
                    >
                      <planeGeometry args={[block.width * 0.85, block.height * block.config.windowRatio * 0.22]} />
                      <meshStandardMaterial
                        color={block.config.windowColor}
                        emissive={block.config.windowColor}
                        emissiveIntensity={0.3}
                        metalness={0.5}
                        transparent
                        opacity={fadeOpacity}
                      />
                    </mesh>
                  );
                })}
              </group>
            )}
          </group>
        ))}

        {/* Glow layer */}
        {blocks.map((block, i) => (
          <group key={`bldg-glow-${cfg.facadeColor}-${i}`} name={`building-glow-${i}`}>
            <mesh position={[block.x, block.height / 2, block.z]} castShadow={false} receiveShadow={false}>
              <boxGeometry args={[block.width, block.height, block.depth]} />
              <meshStandardMaterial
                color={block.config.facadeColor}
                metalness={0.9}
                roughness={0.1}
                transparent
                opacity={0.08 * fadeOpacity}
              />
            </mesh>
          </group>
        ))}
      </group>
    );
  };

  const buildBlocks = (cfg: BuildingConfig) => {
    const result: BuildingBlock_[] = [];
    const gridSize = 35;
    for (let x = -gridSize; x <= gridSize; x += 6) {
      for (let z = -gridSize; z <= gridSize; z += 6) {
        const h = hashCoord(x, z);
        if (h < 0.25) continue;
        const width = cfg.minWidth + (cfg.maxWidth - cfg.minWidth) * hashCoord(x + 1, z);
        const depth = width * (0.5 + hashCoord(x, z + 1) * 0.5);
        const height = cfg.minHeight + (cfg.maxHeight - cfg.minHeight) * h;
        result.push({ x, z, width, depth, height, config: cfg });
      }
    }
    return result;
  };

  if (!hasTransition) {
    const cfg = eraBuildings[effectiveYear];
    // No transition: render fully opaque at 1.0 scale
    return renderBuildingsForConfig(cfg, 1, 1);
  }

  const t = Math.max(0, Math.min(1, eraBlendT ?? 0));
  const fromCfg = eraBuildings[loEra!];
  const toCfg = eraBuildings[hiEra!];

  // Buildings scale/opacity morph
  const fromOpacity = 1 - t;
  const toOpacity = t;
  const fromScale = 0.985 + (1 - t) * 0.015;
  const toScale = 0.985 + t * 0.015;

  return (
    <group name="buildings">
      {renderBuildingsForConfig(fromCfg, fromOpacity, fromScale)}
      {renderBuildingsForConfig(toCfg, toOpacity, toScale)}
    </group>
  );
}

export default BuildingSystem;