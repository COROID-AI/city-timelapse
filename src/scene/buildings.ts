// Building module — instanced, era-morphing city facades with procedural
// window grids, emissive interiors, storefronts and era rooftop props.

import * as THREE from 'three';
import type { EraId } from '../eras';
import type { AppState } from '../state';
import type { SceneModule } from './module';
import { getEraSpec } from '../eras';
import { moodAt, getMood } from '../mood';
import { mulberry32, range } from './rand';
import { makeWindowGrid, makeTextTexture } from './textures';

const BLOCK = 120;
const SIDEWALK = 12; // distance from road center to building front

interface Building {
  mesh: THREE.Mesh;
  windowMat: THREE.MeshStandardMaterial;
  emissiveTex: THREE.CanvasTexture | null;
  mapTex: THREE.CanvasTexture | null;
  facadeMat: THREE.MeshStandardMaterial;
  baseHeight: number;
  rowh: number;
  baseOffset: number;
  props: THREE.Group;
  storefront: THREE.Group | null;
  seed: number;
}

interface AdsSpec {
  bg: string;
  fg: string;
  accent: string;
}

export class BuildingsModule implements SceneModule {
  readonly name = 'buildings';
  readonly group: THREE.Group = new THREE.Group();

  private buildings: Building[] = [];
  private propsMaterials: THREE.Material[] = [];
  private adTextures: THREE.Texture[] = [];

  constructor() {
    this.build();
  }

  private build(): void {
    const rnd = mulberry32(1337);
    const count = 14;
    for (let i = 0; i < count; i++) {
      const isEast = i % 2 === 0;
      const x = isEast ? SIDEWALK + 2 : -(SIDEWALK + 2);
      const zHalf = BLOCK / 2 - 10;
      const z = range(rnd, -zHalf, zHalf);
      const w = range(rnd, 8, 15);
      const d = range(rnd, 8, 14);
      const h = range(rnd, 8, 22);
      this.addBuilding(x, z, w, d, h, i);
    }
  }

  private addBuilding(x: number, z: number, w: number, d: number, h: number, index: number): void {
    const rowUnits = Math.max(2, Math.round(w / 2.6));
    const colUnits = Math.max(2, Math.round(d / 2.6));
    const facadeMat = new THREE.MeshStandardMaterial({
      color: '#8d5a3b',
      roughness: 0.86,
      metalness: 0.05,
    });
    const windowMat = new THREE.MeshStandardMaterial({
      color: '#f7e2b0',
      emissive: '#ffc36e',
      emissiveIntensity: 0.8,
      roughness: 0.4,
    });

    const geom = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geom, [facadeMat, facadeMat, facadeMat, facadeMat, facadeMat, facadeMat]);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    const props = new THREE.Group();
    props.position.set(x, h, z);
    this.group.add(props);

    const b: Building = {
      mesh,
      windowMat,
      emissiveTex: null,
      mapTex: null,
      facadeMat,
      baseHeight: h,
      rowh: h,
      baseOffset: 0,
      props,
      storefront: null,
      seed: index + 1,
    };

    // Storefront (front face toward street).
    const sf = this.makeStorefront(x, z, w, index);
    if (sf) b.storefront = sf;

    this.buildings.push(b);
    this.setEra('1945');
    void rowUnits;
    void colUnits;
    void d;
  }

  private makeStorefront(x: number, z: number, w: number, index: number): THREE.Group | null {
    // Only add awnings + sign plane toward the street on some buildings.
    if (index % 3 === 0) return null;
    const g = new THREE.Group();
    const awningGeo = new THREE.BoxGeometry(w * 0.8, 0.12, 2.4);
    const awningMat = new THREE.MeshStandardMaterial({ color: '#c26', roughness: 0.6 });
    const awning = new THREE.Mesh(awningGeo, awningMat);
    awning.position.set(0, 3.1, 1.2);
    g.add(awning);
    const signGeo = new THREE.PlaneGeometry(w * 0.9, 1.6);
    const signMat = new THREE.MeshStandardMaterial({ color: '#123c63' });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, 4.2, 1.3);
    g.add(sign);
    g.position.set(x, 0, z + 0.05);
    this.group.add(g);
    this.propsMaterials.push(awningMat, signMat);
    return g;
  }

  setEra(era: EraId): void {
    const mood = getMood(era);
    const spec = getEraSpec(era);
    const ads: AdsSpec = { bg: mood.posterBg, fg: mood.posterFg, accent: mood.posterAccent };
    for (const b of this.buildings) {
      this.applyBuildingMood(b, mood, ads);
      this.rebuildWindows(b, mood);
      this.rebuildStorefrontText(b, era);
    }
    void spec;
  }

  private applyBuildingMood(b: Building, mood: ReturnType<typeof getMood>, ads: AdsSpec): void {
    const bs = mood.building;
    b.facadeMat.color.set(bs.facade);
    (b.facadeMat as THREE.MeshStandardMaterial).emissive?.set('#000000');
    b.windowMat.color.set(bs.windowColor);
    b.windowMat.emissive.set(bs.windowGlow);
    b.windowMat.emissiveIntensity = bs.windowGlowIntensity;
    void ads;
  }

  private rebuildWindows(b: Building, mood: ReturnType<typeof getMood>): void {
    const rows = Math.max(3, Math.round(b.baseHeight / 2.2));
    const cols = Math.max(3, Math.round(Math.sqrt((b.mesh.geometry as THREE.BoxGeometry).parameters.width) * 2));
    const litRatio = mood.building.occupancy;
    const pair = makeWindowGrid(
      mood.building.facade,
      mood.building.windowColor,
      rows,
      cols,
      litRatio,
    );
    b.windowMat.map = pair.map;
    b.windowMat.emissiveMap = pair.emissive;
    b.windowMat.needsUpdate = true;
    if (b.mapTex) b.mapTex.dispose();
    if (b.emissiveTex) b.emissiveTex.dispose();
    b.mapTex = pair.map;
    b.emissiveTex = pair.emissive;
    // Apply the window texture to all six faces if the geometry has material index 1.
    const mats = b.mesh.material as THREE.MeshStandardMaterial[];
    for (const m of mats) {
      if (m === b.windowMat) continue;
      m.map = pair.map;
      m.emissiveMap = pair.emissive;
      m.needsUpdate = true;
    }
  }

  private rebuildStorefrontText(b: Building, era: EraId): void {
    if (!b.storefront) return;
    const sign = b.storefront.children[1] as THREE.Mesh;
    const mood = getMood(era);
    const texts: Record<EraId, string[]> = {
      '1945': ['WAR BONDS', 'COCA-COLA 5¢'],
      '1965': ['McDONALD\u2019S', 'DRIVE-IN'],
      '1985': ['VIDEO ARCADE', 'SAVE 25%'],
      '2005': ['Apple Store', 'iPOD'],
      '2025': ['NEXUS AI', 'MARS COLONY'],
    };
    const list = texts[era] || ['SHOP'];
    const text = list[Math.abs(b.seed) % list.length];
    const tex = makeTextTexture(
      [{ text, fontSize: 96, color: mood.posterFg, bold: true }],
      mood.posterBg,
      512,
      160,
    );
    const mat = sign.material as THREE.MeshStandardMaterial;
    if (mat.map) mat.map.dispose();
    mat.map = tex;
    mat.color.set(mood.posterBg);
    mat.emissive.set(mood.posterAccent);
    mat.emissiveIntensity = 0.4;
    mat.needsUpdate = true;
    this.adTextures.push(tex);
  }

  update(_dt: number, state: AppState): void {
    const mood = moodAt(state.eraFloat);
    for (const b of this.buildings) {
      // Height tween toward the era's target envelope
      const targetH = b.baseHeight * (mood.building.maxHeight / 64 + 0.7);
      const cur = b.mesh.scale.y;
      const next = cur + (targetH - cur) * 0.035;
      b.mesh.scale.y = next;
      // Windows: modulate emissive intensity with occupancy + emissiveBoost
      const lit = mood.building.occupancy * mood.building.emissiveBoost;
      b.windowMat.emissiveIntensity = mood.building.windowGlowIntensity * (0.6 + lit * 0.8);
      b.facadeMat.color.copy(new THREE.Color(mood.building.facade));
      (b.facadeMat as THREE.MeshStandardMaterial).emissive?.set('#000000');
    }
    void _dt;
  }

  dispose(): void {
    for (const b of this.buildings) {
      b.mesh.geometry.dispose();
      (b.mesh.material as THREE.Material[]).forEach((m) => m.dispose());
      b.mapTex?.dispose();
      b.emissiveTex?.dispose();
      b.props?.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    }
    this.propsMaterials.forEach((m) => m.dispose());
    this.adTextures.forEach((t) => t.dispose());
  }
}