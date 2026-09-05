/**
 * src/content/buildings/materials.ts — procedural material/texture builders.
 *
 * All building materials are generated from canvas textures and Three color
 * constants — no external model or texture files. The material language
 * (brick / glass / precast / concrete / curtain / timber) is selected
 * declaratively from the BuildingEraSpec in src/eras.ts and applied here.
 * Window glow (era-specific emissive color/intensity) is also declarative.
 */

import * as THREE from 'three';

import { createLabelTexture } from '../../assets';
import type { BuildingFacadeKind, BuildingPlotSpec } from '../../eras';

export interface BuildingGlow {
  /** Emissive color of the era's window glow (from BuildingEraSpec). */
  color: string;
  /** Emissive intensity of the era's window glow. */
  intensity: number;
}

export interface BuildingMaterialSet {
  /** Facade material (envelope mesh). */
  facade: THREE.MeshStandardMaterial;
  /** Glowing window material (window grid mesh). */
  windows: THREE.MeshStandardMaterial;
  /** Trim/parapet material. */
  trim: THREE.MeshStandardMaterial;
  /** Generic neutral material for registration meshes. */
  neutral: THREE.MeshStandardMaterial;
}

/** Facade color per material language (used by every era). */
const FACADE_COLORS: Record<BuildingFacadeKind, number> = {
  brick: 0x8a4a32,
  glass: 0x22303c,
  precast: 0xb7bfc4,
  concrete: 0x70777f,
  curtain: 0x24303c,
  timber: 0x8a6b4f,
};

/** Slightly darker spandrel accent per language. */
const SPANDREL_COLORS: Record<BuildingFacadeKind, number> = {
  brick: 0x6f3a26,
  glass: 0x182028,
  precast: 0x9aa4a9,
  concrete: 0x565c63,
  curtain: 0x18222e,
  timber: 0x6f5439,
};

/** Build one material set for a plot and era glow. Both are declarative data. */
export function buildBuildingMaterials(
  plot: BuildingPlotSpec,
  glow: BuildingGlow,
): BuildingMaterialSet {
  const facadeKind = plot.facade;
  const facadeColor = plot.facadeColor
    ? new THREE.Color(plot.facadeColor).getHex()
    : FACADE_COLORS[facadeKind];

  const facade = new THREE.MeshStandardMaterial({
    color: facadeColor,
    roughness: facadeKind === 'glass' || facadeKind === 'curtain' ? 0.25 : 0.92,
    metalness: facadeKind === 'glass' || facadeKind === 'curtain' ? 0.6 : 0.06,
  });

  const windows = new THREE.MeshStandardMaterial({
    color: 0xbfd8ff,
    emissive: new THREE.Color(glow.color),
    emissiveIntensity: glow.intensity,
    roughness: 0.3,
    metalness: 0.35,
    transparent: true,
    opacity: 0.78,
  });

  const trim = new THREE.MeshStandardMaterial({
    color: SPANDREL_COLORS[facadeKind],
    roughness: 0.7,
    metalness: 0.1,
  });

  const neutral = new THREE.MeshStandardMaterial({
    color: 0x8f9aa8,
    roughness: 0.8,
    metalness: 0.12,
  });

  return { facade, windows, trim, neutral };
}

/** Create a labeled billboard/screen texture from declarative data. */
export function buildLabelTexture(
  label: string,
  options: { fill?: string; size?: number } = {},
): THREE.Texture {
  // CanvasTexture factory requires a DOM 2D context, which doesn't exist in
  // the node test environment. Fall back to a procedural DataTexture so the
  // building module can be constructed headlessly (tests, SSR, CI).
  if (typeof document === 'undefined' || !document.createElement) {
    const size = options.size ?? 256;
    const data = new Uint8Array(size * size * 4);
    const c = new THREE.Color(options.fill ?? '#ffffff');
    for (let i = 0; i < size * size; i += 1) {
      const isText = i % 64 < 16;
      data[i * 4] = isText ? Math.round(c.r * 255) : 24;
      data[i * 4 + 1] = isText ? Math.round(c.g * 255) : 28;
      data[i * 4 + 2] = isText ? Math.round(c.b * 255) : 34;
      data[i * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, size, size);
    tex.needsUpdate = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  return createLabelTexture(label, options);
}

/** Dispose every material in a set. */
export function disposeMaterialSet(set: BuildingMaterialSet): void {
  set.facade.dispose();
  set.windows.dispose();
  set.trim.dispose();
  set.neutral.dispose();
}