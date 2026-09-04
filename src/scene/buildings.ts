// Building module — era-morphing city facades with procedural window
// grids, emissive interiors, street-facing storefronts and era rooftop
// props (1945 water towers → 1965 rooftop neon signs → 1985 AC units →
// 2005 antennas/sat dishes → 2025 solar + greenery). Lit windows render
// through a mounted window material whose emissiveMap is the window-grid
// texture; the facade material stays non-emissive.
//
// Layout: the N-S road runs on the X axis around x=0 and buildings sit on
// both sides at |x| >= SIDEWALK + 4, so nothing occupies the sidewalk band
// where pedestrians and street props live. Street-facing walls are the ±x
// faces; storefront awnings/signs hang on those faces and face the road.

import * as THREE from 'three';
import type { EraId } from '../eras';
import type { AppState } from '../state';
import type { SceneModule } from './module';
import { eraIndex } from '../eras';
import { moodAt, type EraMood } from '../mood';
import { mulberry32, range } from './rand';
import { makeWindowGrid, makeTextTexture } from './textures';

const BLOCK = 120;
const SIDEWALK = 12; // sidewalk inner edge = road boundary
const BUILDING_MIN_X = SIDEWALK + 4;

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
  w: number;
  d: number;
  /** street side: +1 east of the road, -1 west. */
  side: 1 | -1;
  /** Current height envelope target (from the last mood recompute). */
  targetHeight: number;
  /** Rooftop prop resources owned by this building (for disposal). */
  propGeos: THREE.BufferGeometry[];
  propMats: THREE.Material[];
}

interface AdsSpec {
  bg: string;
  fg: string;
  accent: string;
}

const ERA_SIGNS: Record<EraId, string[]> = {
  '1945': ['WAR BONDS', 'COCA-COLA 5\u00A2', 'BAKERY'],
  '1965': ['McDONALD\u2019S', 'DRIVE-IN', 'AUTO REPAIR'],
  '1985': ['VIDEO ARCADE', 'SAVE 25%', 'LAUNDROMAT'],
  '2005': ['Apple Store', 'iPOD', 'COFFEE 24/7'],
  '2025': ['NEXUS AI', 'MARS COLONY', 'EV CHARGING'],
};

export class BuildingsModule implements SceneModule {
  readonly name = 'buildings';
  readonly group: THREE.Group = new THREE.Group();

  private buildings: Building[] = [];

  /** Cached mood-derived values — recomputed only when eraFloat moves. */
  private lastMoodT = Number.NaN;
  private cachedFacade = new THREE.Color('#8d5a3b');
  private cachedWindowColor = new THREE.Color('#f7e2b0');
  private cachedGlow = new THREE.Color('#ffc36e');
  private cachedGlowIntensity = 3;
  private cachedOccupancy = 0.7;

  constructor() {
    this.build();
  }

  private build(): void {
    const rnd = mulberry32(1337);
    const count = 14;
    for (let i = 0; i < count; i++) {
      const isEast = i % 2 === 0;
      const x = isEast
        ? BUILDING_MIN_X + range(rnd, 2, 9)
        : -(BUILDING_MIN_X + range(rnd, 2, 9));
      const zHalf = BLOCK / 2 - 12;
      const z = range(rnd, -zHalf, zHalf);
      const w = range(rnd, 8, 15);
      const d = range(rnd, 10, 16);
      const h = range(rnd, 8, 22);
      this.addBuilding(x, z, w, d, h, i);
    }
  }

  private addBuilding(x: number, z: number, w: number, d: number, h: number, index: number): void {
    const side: 1 | -1 = x > 0 ? 1 : -1;

    const facadeMat = new THREE.MeshStandardMaterial({
      color: '#8d5a3b',
      roughness: 0.86,
      metalness: 0.05,
      emissive: '#000000',
    });
    const windowMat = new THREE.MeshStandardMaterial({
      color: '#f7e2b0',
      emissive: '#ffc36e',
      emissiveIntensity: 0.8,
      roughness: 0.4,
    });

    const geom = new THREE.BoxGeometry(w, h, d);
    const mats: THREE.MeshStandardMaterial[] = [
      facadeMat, facadeMat, facadeMat, facadeMat, facadeMat, facadeMat,
    ];
    // BoxGeometry material order: [+x, -x, +y, -y, +z, -z].
    // Street wall = -x for east buildings, +x for west buildings; also put
    // windows on the opposite ±x wall so the building reads as facades.
    const streetIndex = side > 0 ? 1 : 0;
    const backIndex = side > 0 ? 0 : 1;
    mats[streetIndex] = windowMat;
    mats[backIndex] = windowMat;
    const mesh = new THREE.Mesh(geom, mats);
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
      w,
      d,
      side,
      targetHeight: h,
      propGeos: [],
      propMats: [],
    };

    const sf = this.makeStorefront(x, z, w, d, index, side);
    if (sf) b.storefront = sf;

    this.buildings.push(b);
    this.setEra('1945');
  }

  private makeStorefront(
    x: number,
    z: number,
    w: number,
    d: number,
    index: number,
    side: 1 | -1,
  ): THREE.Group | null {
    if (index % 3 === 0) return null;
    const g = new THREE.Group();
    // Origin sits just outside the street wall.
    const outward = side > 0 ? -1 : 1;
    g.position.set(x + (side > 0 ? -d / 2 : d / 2), 0, z);

    const awningMat = new THREE.MeshStandardMaterial({ color: '#c26', roughness: 0.6 });
    // Awning slab protrudes toward the road along X (width runs along Z).
    const awning = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, w * 0.85), awningMat);
    awning.position.set(outward * 0.85, 3.1, 0);
    g.add(awning);

    const signMat = new THREE.MeshStandardMaterial({ color: '#123c63' });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, 1.6), signMat);
    sign.position.set(outward * 0.12, 4.3, 0);
    if (side > 0) sign.rotation.y = -Math.PI / 2; // normal -x (faces road)
    else sign.rotation.y = Math.PI / 2; // normal +x
    g.add(sign);
    this.group.add(g);
    return g;
  }

  setEra(era: EraId): void {
    const mood = moodAt(eraIndex(era));
    const ads: AdsSpec = { bg: mood.posterBg, fg: mood.posterFg, accent: mood.posterAccent };
    for (const b of this.buildings) {
      this.applyBuildingMood(b, mood, ads);
      this.rebuildWindows(b, mood);
      this.rebuildStorefrontText(b, era, mood);
      this.rebuildProps(b, era);
    }
  }

  private applyBuildingMood(b: Building, mood: EraMood, ads: AdsSpec): void {
    const bs = mood.building;
    b.facadeMat.color.set(bs.facade);
    b.windowMat.color.set(bs.windowColor);
    b.windowMat.emissive.set(bs.windowGlow);
    b.windowMat.emissiveIntensity = bs.windowGlowIntensity;
    void ads;
  }

  private rebuildWindows(b: Building, mood: EraMood): void {
    const bs = mood.building;
    const rows = Math.max(3, Math.round(b.baseHeight / 2.2));
    const cols = Math.max(3, Math.round(Math.sqrt(b.w) * 2));
    const pair = makeWindowGrid(bs.facade, bs.windowColor, rows, cols, bs.occupancy);
    b.windowMat.map = pair.map;
    b.windowMat.emissiveMap = pair.emissive;
    b.windowMat.needsUpdate = true;
    if (b.mapTex) b.mapTex.dispose();
    if (b.emissiveTex) b.emissiveTex.dispose();
    b.mapTex = pair.map;
    b.emissiveTex = pair.emissive;
  }

  private rebuildStorefrontText(b: Building, era: EraId, mood: EraMood): void {
    if (!b.storefront) return;
    const sign = b.storefront.children[1] as THREE.Mesh;
    const list = ERA_SIGNS[era] || ['SHOP'];
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
  }

  // ---- Rooftop props per era ----
  private rebuildProps(b: Building, era: EraId): void {
    for (const g of b.propGeos) g.dispose();
    for (const m of b.propMats) m.dispose();
    b.propGeos.length = 0;
    b.propMats.length = 0;
    while (b.props.children.length) {
      b.props.remove(b.props.children[0]);
    }

    const cx = 0;
    const cz = 0;
    const bw = Math.min(6, b.w * 0.6);
    switch (era) {
      case '1945': {
        // Water tower: legs + cylinder tank + cone roof.
        const legGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.4, 5);
        const legMat = new THREE.MeshStandardMaterial({ color: '#3c3128', roughness: 0.9 });
        const tankGeo = new THREE.CylinderGeometry(1.3, 1.5, 2.1, 12);
        const tankMat = new THREE.MeshStandardMaterial({ color: '#6b4f37', roughness: 0.7, metalness: 0.35 });
        const roofGeo = new THREE.ConeGeometry(1.7, 0.9, 12);
        const roofMat = new THREE.MeshStandardMaterial({ color: '#4a372a', roughness: 0.6, metalness: 0.4 });
        for (const [lx, lz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]] as const) {
          const leg = new THREE.Mesh(legGeo, legMat);
          leg.position.set(cx + lx, 0.7, cz + lz);
          b.props.add(leg);
        }
        const tank = new THREE.Mesh(tankGeo, tankMat);
        tank.position.set(cx, 2.1, cz);
        b.props.add(tank);
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(cx, 3.3, cz);
        b.props.add(roof);
        b.propGeos.push(legGeo, tankGeo, roofGeo);
        b.propMats.push(legMat, tankMat, roofMat);
        break;
      }
      case '1965': {
        // Rooftop neon sign + fins.
        const boxGeo = new THREE.BoxGeometry(bw, 1.0, 0.35);
        const boxMat = new THREE.MeshStandardMaterial({
          color: '#20242e',
          emissive: '#ff5f7a',
          emissiveIntensity: 1.4,
          roughness: 0.5,
          metalness: 0.4,
        });
        const signBox = new THREE.Mesh(boxGeo, boxMat);
        signBox.position.set(cx, 1.4, cz);
        b.props.add(signBox);
        const finGeo = new THREE.BoxGeometry(1.6, 1.6, 0.12);
        const finMat = new THREE.MeshStandardMaterial({
          color: '#c23b4e',
          emissive: '#ffb0c0',
          emissiveIntensity: 0.5,
          roughness: 0.6,
        });
        const fin = new THREE.Mesh(finGeo, finMat);
        fin.position.set(cx + bw * 0.45, 1.6, cz);
        b.props.add(fin);
        b.propGeos.push(boxGeo, finGeo);
        b.propMats.push(boxMat, finMat);
        break;
      }
      case '1985': {
        // AC units on the roof + short antenna mast.
        const unitGeo = new THREE.BoxGeometry(1.4, 0.7, 1.1);
        const unitMat = new THREE.MeshStandardMaterial({ color: '#c7cbd2', roughness: 0.65, metalness: 0.15 });
        const fanGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.12, 10);
        const fanMat = new THREE.MeshStandardMaterial({ color: '#3a3d44', roughness: 0.5 });
        for (let i = 0; i < 3; i++) {
          const u = new THREE.Mesh(unitGeo, unitMat);
          u.position.set(cx + (i - 1) * 1.8, 0.45, cz + (i % 2 === 0 ? -0.8 : 0.8));
          b.props.add(u);
          const fan = new THREE.Mesh(fanGeo, fanMat);
          fan.position.set(u.position.x, u.position.y + 0.42, u.position.z);
          fan.rotation.z = Math.PI / 2;
          b.props.add(fan);
        }
        const mastGeo = new THREE.CylinderGeometry(0.05, 0.08, 3.4, 6);
        const mastMat = new THREE.MeshStandardMaterial({ color: '#6a6f78', roughness: 0.5, metalness: 0.6 });
        const mast = new THREE.Mesh(mastGeo, mastMat);
        mast.position.set(cx - bw * 0.5, 1.9, cz);
        b.props.add(mast);
        b.propGeos.push(unitGeo, fanGeo, mastGeo);
        b.propMats.push(unitMat, fanMat, mastMat);
        break;
      }
      case '2005': {
        // Satellite dish + antenna mast + HVAC rack.
        const dishGeo = new THREE.SphereGeometry(0.75, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const dishMat = new THREE.MeshStandardMaterial({ color: '#dfe3ea', roughness: 0.25, metalness: 0.5, side: THREE.DoubleSide });
        const dish = new THREE.Mesh(dishGeo, dishMat);
        dish.position.set(cx + 1.6, 1.5, cz);
        dish.rotation.x = 0.4;
        b.props.add(dish);
        const mastGeo = new THREE.CylinderGeometry(0.05, 0.07, 3.0, 6);
        const mastMat = new THREE.MeshStandardMaterial({ color: '#5b6068', roughness: 0.5, metalness: 0.55 });
        const mast = new THREE.Mesh(mastGeo, mastMat);
        mast.position.set(cx - bw * 0.45, 1.8, cz);
        b.props.add(mast);
        const rackGeo = new THREE.BoxGeometry(bw * 0.8, 0.9, 1.6);
        const rackMat = new THREE.MeshStandardMaterial({ color: '#8b919a', roughness: 0.55, metalness: 0.2 });
        const rack = new THREE.Mesh(rackGeo, rackMat);
        rack.position.set(cx, 0.6, cz);
        b.props.add(rack);
        b.propGeos.push(dishGeo, mastGeo, rackGeo);
        b.propMats.push(dishMat, mastMat, rackMat);
        break;
      }
      case '2025': {
        // Solar panels + green roof planter.
        const panelGeo = new THREE.BoxGeometry(bw * 0.9, 0.08, 2.2);
        const panelMat = new THREE.MeshStandardMaterial({
          color: '#14203a',
          emissive: '#3f6fe0',
          emissiveIntensity: 0.35,
          roughness: 0.35,
          metalness: 0.5,
        });
        for (let i = 0; i < 3; i++) {
          const p = new THREE.Mesh(panelGeo, panelMat);
          p.position.set(cx, 0.7, cz + (i - 1) * 1.8);
          p.rotation.x = -0.12;
          b.props.add(p);
        }
        const planterGeo = new THREE.BoxGeometry(bw, 0.5, 1.4);
        const planterMat = new THREE.MeshStandardMaterial({ color: '#2f4a2f', roughness: 1 });
        const planter = new THREE.Mesh(planterGeo, planterMat);
        planter.position.set(cx - bw * 0.7, 0.45, cz + 0.6);
        b.props.add(planter);
        const bushGeo = new THREE.IcosahedronGeometry(0.7, 1);
        const bushMat = new THREE.MeshStandardMaterial({ color: '#3f8f59', roughness: 0.9 });
        const bush = new THREE.Mesh(bushGeo, bushMat);
        bush.position.set(cx - bw * 0.7, 1.05, cz + 0.6);
        bush.scale.set(1, 0.8, 1);
        b.props.add(bush);
        b.propGeos.push(panelGeo, planterGeo, bushGeo);
        b.propMats.push(panelMat, planterMat, bushMat);
        break;
      }
    }
  }

  update(dt: number, state: AppState): void {
    const ft = state.eraFloat;
    if (ft !== this.lastMoodT) {
      this.lastMoodT = ft;
      const mood = moodAt(ft);
      const bs = mood.building;
      this.cachedFacade.set(bs.facade);
      this.cachedWindowColor.set(bs.windowColor);
      this.cachedGlow.set(bs.windowGlow);
      this.cachedGlowIntensity = bs.windowGlowIntensity;
      this.cachedOccupancy = bs.occupancy;
      const hf = bs.maxHeight / 64 + 0.7;
      for (const b of this.buildings) b.targetHeight = b.baseHeight * hf;
    }

    // Continuous per-frame glow: windowMat carries the emissiveMap, so the
    // emissive color multiplies the map (lit windows bright, frames dark).
    const bloom = 0.6 + this.cachedOccupancy * 0.8;
    for (const b of this.buildings) {
      const cur = b.mesh.scale.y;
      const k = 1 - Math.exp(-dt * 2.2);
      const next = cur + (b.targetHeight - cur) * k;
      b.mesh.scale.y = next;
      // Re-root the rooftop props on the moving roofline.
      b.props.position.y = b.baseHeight * next;

      b.windowMat.color.copy(this.cachedWindowColor);
      b.windowMat.emissive.copy(this.cachedGlow);
      b.windowMat.emissiveIntensity = this.cachedGlowIntensity * bloom;
      b.facadeMat.color.copy(this.cachedFacade);
    }
  }

  dispose(): void {
    for (const b of this.buildings) {
      b.mesh.geometry.dispose();
      (b.mesh.material as THREE.Material[]).forEach((m) => m.dispose());
      b.mapTex?.dispose();
      b.emissiveTex?.dispose();
      b.propGeos.forEach((g) => g.dispose());
      b.propMats.forEach((m) => m.dispose());
      b.storefront?.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material;
          if (Array.isArray(m)) {
            m.forEach((x) => {
              x.map?.dispose();
              x.dispose();
            });
          } else {
            m.map?.dispose();
            m.dispose();
          }
        }
      });
    }
  }
}