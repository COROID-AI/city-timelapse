import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BUILDING_LOTS } from '../data/buildings';
import { sampleBuilding } from '../engine/sceneSampler';
import { getFacadeTextures } from '../engine/textures';
import type { BuildingStyle, BuildingLot } from '../types';
import { TMP } from '../engine/sharedResources';

// ---------------------------------------------------------------------------
// Single building — its height morphs continuously across eras; its facade
// material reskins (color + window texture) per frame. Windows use a shared
// instanced mesh for lit-window glow at night.
// ---------------------------------------------------------------------------

// Pre-load facade textures for every style (shared across all buildings).
const FACADE_TEX: Record<BuildingStyle, ReturnType<typeof getFacadeTextures>> = {
  brick: getFacadeTextures('brick'),
  artdeco: getFacadeTextures('artdeco'),
  concrete: getFacadeTextures('concrete'),
  glass: getFacadeTextures('glass'),
  green: getFacadeTextures('green'),
  future: getFacadeTextures('future'),
};

function Building({ lot }: { lot: BuildingLot }) {
  const groupRef = useRef<THREE.Group>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const roofRef = useRef<THREE.Mesh>(null);

  // One material per building — updated in place per frame. This is the
  // minimum needed: we never create new materials during transitions.
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: 0.6,
        metalness: 0.1,
      }),
    [],
  );
  const roofMat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.7 }),
    [],
  );

  // Window-glow instanced mesh — one quad per window, lit at night.
  // We pre-allocate a generous max count and hide unused instances.
  const WIN_PER_FACE = 24;
  const WIN_FACES = 4;
  const WIN_MAX = WIN_PER_FACE * WIN_FACES;
  const winInstRef = useRef<THREE.InstancedMesh>(null);
  const winGeom = useMemo(() => new THREE.PlaneGeometry(0.8, 1.0), []);
  const winMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  // Antenna
  const antennaRef = useRef<THREE.Mesh>(null);

  // Billboard (rooftop signage)
  const billboardRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const eraFloat = useSceneStore.getState().eraFloat;
    const b = sampleBuilding(eraFloat, lot);

    // Scale the shell to the interpolated height (the geometry is a unit box,
    // so scale.y = height and position.y = height/2).
    const h = b.height;
    if (shellRef.current) {
      shellRef.current.scale.set(lot.size[0], h, lot.size[1]);
      shellRef.current.position.y = h / 2;
    }
    if (roofRef.current) {
      roofRef.current.scale.set(lot.size[0] * 1.05, 1, lot.size[1] * 1.05);
      roofRef.current.position.y = h + 0.3;
    }

    // Swap facade textures based on the current style.
    const ft = FACADE_TEX[b.style];
    mat.map = ft.map;
    mat.emissiveMap = ft.emissive;
    mat.color.setRGB(...b.facadeColor);
    mat.emissive.setRGB(...b.windowEmissive);
    mat.emissiveIntensity = b.windowGlow * 1.5;
    mat.needsUpdate = true;

    // Roof
    roofMat.color.setRGB(...b.roofColor);

    // Windows — update positions and visibility based on height + density.
    if (winInstRef.current) {
      const winMesh = winInstRef.current;
      const floors = Math.max(2, Math.floor(h / 3.5));
      const cols = Math.max(2, Math.floor(lot.size[0] / 2.5));
      let idx = 0;
      const halfW = lot.size[0] / 2;
      const halfD = lot.size[1] / 2;
      const winH = 1.4;
      const offset = 0.05; // push slightly out of the facade

      for (let floor = 0; floor < floors && idx < WIN_MAX; floor++) {
        // Deterministic lit pattern per floor
        const litRow = ((floor * 7919) % 100) / 100;
        const y = 2.5 + floor * 3.2;
        if (y > h - 1.5) break;
        for (let col = 0; col < cols && idx < WIN_MAX; col++) {
          const isLit = ((floor * 31 + col * 17 + 7) % 100) / 100 > 0.5 - b.windowDensity * 0.3;
          if (!isLit) continue;

          const xPos = -halfW + 1.5 + col * (lot.size[0] - 3) / Math.max(1, cols - 1);

          // Front face
          TMP.matrix.makeRotationY(0);
          TMP.matrix.setPosition(xPos, y, halfD + offset);
          winMesh.setMatrixAt(idx, TMP.matrix);
          idx++;

          if (idx >= WIN_MAX) break;
          // Back face
          TMP.matrix.makeRotationY(Math.PI);
          TMP.matrix.setPosition(xPos, y, -halfD - offset);
          winMesh.setMatrixAt(idx, TMP.matrix);
          idx++;

          if (idx >= WIN_MAX) break;
          // Left face (along Z)
          TMP.matrix.makeRotationY(-Math.PI / 2);
          TMP.matrix.setPosition(-halfW - offset, y, xPos * (lot.size[1] / lot.size[0]));
          winMesh.setMatrixAt(idx, TMP.matrix);
          idx++;

          if (idx >= WIN_MAX) break;
          // Right face
          TMP.matrix.makeRotationY(Math.PI / 2);
          TMP.matrix.setPosition(halfW + offset, y, xPos * (lot.size[1] / lot.size[0]));
          winMesh.setMatrixAt(idx, TMP.matrix);
          idx++;
        }
      }
      winMesh.count = idx;
      winMesh.instanceMatrix.needsUpdate = true;
      winMat.color.setRGB(...b.windowEmissive);
      winMat.opacity = b.windowGlow;
    }

    // Antenna visibility (crossfade via scale)
    const b0 = lot.eras[Math.floor(eraFloat)];
    const bNext = lot.eras[Math.min(5, Math.floor(eraFloat) + 1)];
    const hasAntenna = b.hasAntenna;
    if (antennaRef.current) {
      antennaRef.current.visible = hasAntenna;
      if (hasAntenna) {
        antennaRef.current.position.y = h + 3;
        antennaRef.current.scale.y = 1 + (b.height - b0.height) * 0.01;
        antennaRef.current.rotation.z = Math.sin(eraFloat * 3) * 0.02;
      }
    }
    void bNext;

    // Billboard visibility
    if (billboardRef.current) {
      billboardRef.current.visible = b.hasBillboard;
      if (b.hasBillboard) {
        billboardRef.current.position.y = h + 5;
      }
    }
  });

  return (
    <group ref={groupRef} position={[lot.position[0], 0, lot.position[1]]} rotation-y={lot.rotation}>
      {/* Building shell */}
      <mesh ref={shellRef} castShadow receiveShadow material={mat}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>

      {/* Roof slab */}
      <mesh ref={roofRef} castShadow material={roofMat}>
        <boxGeometry args={[1, 0.6, 1]} />
      </mesh>

      {/* Window glow instances */}
      <instancedMesh
        ref={winInstRef}
        args={[winGeom, winMat, WIN_MAX]}
        frustumCulled={false}
      />

      {/* Rooftop antenna */}
      <mesh ref={antennaRef} castShadow>
        <cylinderGeometry args={[0.05, 0.1, 6, 6]} />
        <meshStandardMaterial color="#888" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Rooftop billboard */}
      <group ref={billboardRef}>
        <BuildingBillboard lotId={lot.id} />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Rooftop billboard — picks era-appropriate signage and crossfades.
// ---------------------------------------------------------------------------
import { crossfadedSignage } from '../engine/sceneSampler';
import { useSceneStore } from '../store/useSceneStore';
import { getSignageTexture } from '../engine/textures';
import { eraOpacity } from '../engine/eraSampler';
import { ERAS } from '../data/eras';

function BuildingBillboard({ lotId }: { lotId: string }) {
  // Each lot gets a deterministic sign pick per era.
  const picks = useMemo(() => {
    const seed = lotId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return ERAS.map((era, ei) => {
      const idx = (seed + ei * 7) % era.signage.length;
      return era.signage[idx];
    });
  }, [lotId]);

  const billMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        opacity: 0,
      }),
    [],
  );

  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const eraFloat = useSceneStore.getState().eraFloat;
    const lowerEra = Math.floor(eraFloat);
    const upperEra = Math.min(5, lowerEra + 1);
    const t = eraFloat - lowerEra;
    const sign = t < 0.5 ? picks[lowerEra] : picks[upperEra];

    billMat.map = getSignageTexture(sign);
    billMat.color.setRGB(1, 1, 1);
    // crossfade opacity: blend of lower+upper signs
    const loOpacity = eraOpacity(eraFloat, lowerEra) * 0.9;
    const upOpacity = lowerEra !== upperEra ? eraOpacity(eraFloat, upperEra) * 0.9 : 0;
    billMat.opacity = Math.max(loOpacity, upOpacity);
    billMat.needsUpdate = true;

    if (meshRef.current) {
      meshRef.current.rotation.y += 0.003;
    }
  });

  return (
    <mesh ref={meshRef} material={billMat}>
      <planeGeometry args={[8, 4]} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// All buildings
// ---------------------------------------------------------------------------
export function Buildings() {
  return (
    <group>
      {BUILDING_LOTS.map((lot) => (
        <Building key={lot.id} lot={lot} />
      ))}
    </group>
  );
}
