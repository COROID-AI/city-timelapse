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
};

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

/* ── Create a shared high-poly box geometry for morph targets ── */
function createBuildingGeometry(
  w: number,
  d: number,
  h: number,
  windowRows: number,
  windowCols: number,
): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(
    Math.max(0.1, w),
    Math.max(0.1, h),
    Math.max(0.1, d),
    Math.max(1, windowCols),
    Math.max(1, windowRows),
    1,
  );
  return geo;
}

/* ── Compute building vertex positions for a given era style ── */
function computeMorphPositions(
  baseGeo: THREE.BoxGeometry,
  style: EraBuildingStyle,
  blockWidth: number,
  blockDepth: number,
  blockBaseHeight: number,
): Float32Array {
  const positions = baseGeo.attributes.position.array.slice();
  const count = positions.length / 3;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const x = positions[i3];
    const y = positions[i3 + 1];
    const z = positions[i3 + 2];

    // Scale height
    const heightScale = style.height;
    const newY = y * heightScale;

    // Store-front section: keep lower portion at original scale
    const storeFrontH = blockBaseHeight * style.storeFrontHeight;
    if (newY < storeFrontH) {
      positions[i3 + 1] = newY;
      continue;
    }

    // Roof displacement based on roof type
    let roofDisp = 0;
    const roofBase = blockBaseHeight * style.height;
    const relY = y - storeFrontH / heightScale;

    switch (style.roofType) {
      case 'flat':
        roofDisp = style.roofHeight;
        break;
      case 'gable':
        // Gable: peak at center, sloped sides
        if (Math.abs(x) < blockWidth * 0.3) {
          roofDisp = style.roofHeight * (1 - Math.abs(x) / (blockWidth * 0.5));
        }
        break;
      case 'hip':
        // Hip roof: pyramid shape
        roofDisp = style.roofHeight * Math.max(0, 1 - (Math.abs(x) + Math.abs(z)) / (blockWidth * 0.7));
        break;
      case 'dome':
        // Semi-sphere dome
        const dx = x / (blockWidth * 0.4);
        const dz = z / (blockDepth * 0.4);
        const d2 = dx * dx + dz * dz;
        if (d2 < 1) {
          roofDisp = style.roofHeight * Math.sqrt(Math.max(0, 1 - d2));
        }
        break;
      case 'parabolic':
        // Parabolic curving roof
        roofDisp = style.roofHeight * Math.max(0, 1 - (x * x + z * z) / (blockWidth * blockDepth * 0.3));
        break;
      case 'spire':
        // Tall spire with taper
        const distFromCenter = Math.sqrt(x * x + z * z);
        const maxDist = Math.max(0.01, Math.min(blockWidth, blockDepth) * 0.4);
        const taper = Math.max(0, 1 - distFromCenter / maxDist);
        roofDisp = style.roofHeight * taper * taper;
        break;
    }

    positions[i3 + 1] = newY + roofDisp;
  }

  return new Float32Array(positions);
}

/* ── Compute morph normals (simple: recompute face normals) ── */
function computeMorphNormals(
  baseGeo: THREE.BoxGeometry,
  targetPositions: Float32Array,
): Float32Array {
  // Derive positions array, compute per-vertex normals via cross products
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
    // No index buffer — every 3 consecutive vertices is a triangle
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
  // We are at a discrete year — snap to nearest era but allow smooth visual
  // transition when year changes. t=1 means fully at 'upper'.
  return { lower: idx - 1, upper: idx, t: 1 };
}

function lerpColor(a: THREE.Color, b: THREE.Color, t: number): THREE.Color {
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
    coreGeo.morphTargetsRelative = false; // absolute positions
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

    // Set morph influences — influence on both surrounding eras
    const influences = new Array(ERA_COUNT).fill(0);
    if (lower === upper) {
      influences[lower] = 1;
    } else {
      influences[lower] = 1 - t;
      influences[upper] = t;
    }
    mesh.morphTargetInfluences = influences;
    mesh.updateMorphTargets();

    // Lerp material properties between eras
    const lowerStyle = ERA_STYLES[ERA_YEARS[lower]];
    const upperStyle = ERA_STYLES[ERA_YEARS[upper]];

    mat.color.copy(lerpColor(lowerStyle.facadeColor, upperStyle.facadeColor, t));
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

    signageMat.color.copy(lerpColor(lowerStyle.signageColor, upperStyle.signageColor, t));
    signageMat.emissive.copy(lerpColor(lowerStyle.signageColor, upperStyle.signageColor, t).multiplyScalar(0.3));
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
    color: lerpColor(lowerStyle.windowColor, upperStyle.windowColor, t),
    emissive: lerpColor(lowerStyle.windowColor, upperStyle.windowColor, t).multiplyScalar(0.4),
    roughness: 0.2,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
  }), []);

  // Re-create material color per frame
  useFrame(() => {
    const { lower: l, upper: u, t: lt } = getEraInterp(year);
    windowMat.color.copy(lerpColor(ERA_STYLES[ERA_YEARS[l]].windowColor, ERA_STYLES[ERA_YEARS[u]].windowColor, lt));
    windowMat.emissive.copy(lerpColor(ERA_STYLES[ERA_YEARS[l]].windowColor, ERA_STYLES[ERA_YEARS[u]].windowColor, lt).multiplyScalar(0.4));
    windowMat.roughness = lerpNum(ERA_STYLES[ERA_YEARS[l]].roughness, ERA_STYLES[ERA_YEARS[u]].roughness, lt) * 0.3;
    windowMat.needsUpdate = true;
  });

  const windowSize = lerpNum(lowerStyle.windowSize, upperStyle.windowSize, t);
  const rows = Math.round(lerpNum(lowerStyle.windowRows, upperStyle.windowRows, t));
  const spacing = lerpNum(lowerStyle.windowSpacing, upperStyle.windowSpacing, t);

  const windows: React.ReactElement[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = -1; col <= 1; col++) {
      if (row === Math.floor(rows / 2) && block.x === 0 && block.z === 0) continue; // skip center for street-facing variety
      windows.push(
        <mesh
          key={`win-${row}-${col}`}
          position={[
            col * block.width * spacing,
            block.height * (0.2 + row * (0.7 + row * 0.08)),
            block.depth / 2 + 0.01,
          ]}
          scale={[windowSize * block.width * 0.7, windowSize * block.height * 0.5, 0.05]}
          castShadow={row === rows - 1}
        >
          <boxGeometry args={[1, 1, 1]} />
          <primitive object={windowMat} />
        </mesh>,
      );
    }
  }

  return <group>{windows}</group>;
}

/* ── Pedestrian and street elements ── */
function StreetsAndPedestrians() {
  const { year } = useEra();

  // Street planes
  const streetMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(ERA_YEARS.includes(year) ? 0x555555 : 0x444444),
    roughness: 0.85,
    metalness: 0.05,
  }), []);

  // Ground plane that receives shadows
  const groundGeo = useMemo(() => new THREE.PlaneGeometry(100, 100), []);

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
        geometry={groundGeo}
        material={streetMat}
      />
      {/* Street markings — era-dependent */}
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 0.15]} />
        <meshBasicMaterial color={0xCCCCCC} transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

/* ── Era-aware directional light for shadows ── */
function EraShadowLight() {
  const { year } = useEra();
  const lightRef = useRef<THREE.DirectionalLight>(null);

  useFrame(() => {
    const light = lightRef.current;
    if (!light) return;

    switch (year) {
      case 1945: // Late afternoon golden hour — low sun
        light.position.set(15, 8, 10);
        light.intensity = 1.2;
        light.color.set(0xFFD090);
        break;
      case 1965: // Sunset deep amber
        light.position.set(18, 5, 12);
        light.intensity = 1.4;
        light.color.set(0xFFAA44);
        break;
      case 1985: // Twilight neon bloom
        light.position.set(10, 12, 5);
        light.intensity = 0.5;
        light.color.set(0x8A6AFF);
        break;
      case 2005: // Overcast midday — soft, even
        light.position.set(10, 25, 10);
        light.intensity = 0.8;
        light.color.set(0xCCCCDD);
        break;
      case 2025: // Clear noon — sharp shadows
        light.position.set(5, 30, 8);
        light.intensity = 1.3;
        light.color.set(0xFFFFFF);
        break;
      case 2055: // High sun with cirrus
        light.position.set(8, 28, 6);
        light.intensity = 1.2;
        light.color.set(0xDDDDFF);
        break;
    }
    light.castShadow = true;
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
    light.shadow.camera.left = -40;
    light.shadow.camera.right = 40;
    light.shadow.camera.top = 40;
    light.shadow.camera.bottom = -40;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 120;
    light.shadow.bias = -0.001;
    light.shadow.normalBias = 0.02;
  });

  return (
    <directionalLight ref={lightRef} castShadow />
  );
}

/* ── Ambient + fill lights per era ── */
function EraAmbientLight() {
  const { year } = useEra();

  const ambient = useMemo(() => new THREE.AmbientLight(0x404040, 0.4), []);
  const fill = useMemo(() => new THREE.PointLight(0xFFFFFF, 0.15, 80), []);

  useFrame(() => {
    switch (year) {
      case 1945:
        ambient.intensity = 0.3;
        ambient.color.set(0xFFCC88);
        fill.position.set(0, 8, 0);
        fill.intensity = 0.2;
        fill.color.set(0xFFCC66);
        break;
      case 1965:
        ambient.intensity = 0.35;
        ambient.color.set(0xFFDDAA);
        fill.position.set(0, 10, 0);
        fill.intensity = 0.25;
        fill.color.set(0xFFBB88);
        break;
      case 1985:
        ambient.intensity = 0.15;
        ambient.color.set(0x6644AA);
        fill.position.set(0, 12, 0);
        fill.intensity = 0.3;
        fill.color.set(0xFF00FF);
        break;
      case 2005:
        ambient.intensity = 0.4;
        ambient.color.set(0xCCCCCC);
        fill.position.set(0, 10, 0);
        fill.intensity = 0.2;
        fill.color.set(0xFFFFFF);
        break;
      case 2025:
        ambient.intensity = 0.45;
        ambient.color.set(0xCCEEFF);
        fill.position.set(0, 10, 0);
        fill.intensity = 0.2;
        fill.color.set(0x00CCFF);
        break;
      case 2055:
        ambient.intensity = 0.35;
        ambient.color.set(0xAA88FF);
        fill.position.set(0, 10, 0);
        fill.intensity = 0.25;
        fill.color.set(0xCC88FF);
        break;
    }
  });

  return (
    <>
      <primitive object={ambient} />
      <primitive object={fill} />
    </>
  );
}

/* ═══════════════════════════════════════════
   BuildingGroup — renders the full city block
   ═══════════════════════════════════════════ */
export function BuildingGroup() {
  const blocks = useMemo(() => buildBlockLayout(), []);

  return (
    <group>
      <EraShadowLight />
      <EraAmbientLight />
      <StreetsAndPedestrians />
      {blocks.map((block, i) => (
        <BuildingMesh key={`bldg-${i}`} block={block} />
      ))}
      {blocks.map((block, i) => (
        <BuildingWindows key={`win-${i}`} block={block} />
      ))}
    </group>
  );
}
