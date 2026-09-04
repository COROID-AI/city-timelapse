/**
 * City block: roads, sidewalks, building lots (facades, windows, rooftop
 * props, storefronts, billboards), lamp posts and street props.
 * Everything tween-interpolates with the continuous era float.
 */

import * as THREE from 'three';
import { lerp } from '../state';
import type { AppState } from '../state';
import { themePairAt, rgbToHex } from '../theme';
import type { Theme, Rgb } from '../theme';
import type { TextureSet } from '../textures';
import {
  createWindowTexture,
  createBrickTexture,
  createSignTexture,
  mulberry32,
} from '../textures';

export interface CityModule {
  group: THREE.Group;
  update(dt: number, state: AppState): void;
  setEra(era: number, t: number): void;
  dispose(): void;
}

interface RooftopProp {
  group: THREE.Group;
  /** Era indices 0..4 where this prop is visible. */
  eras: number[];
}

interface BuildingF {
  group: THREE.Group;
  body: THREE.Mesh;
  windowMats: THREE.MeshStandardMaterial[];
  facadeMats: THREE.MeshStandardMaterial[];
  sign: THREE.Mesh | null;
  baseHeight: number;
  eraScales: number[];
  heightScale: number;
  windowTex: THREE.CanvasTexture;
  windowEmissive: Rgb;
  windowIntensity: number;
  props: RooftopProp[];
  signMat: THREE.MeshBasicMaterial | null;
  signTex: THREE.CanvasTexture | null;
  billboardMat: THREE.MeshStandardMaterial | null;
  billboardTex: THREE.CanvasTexture | null;
  billboardGlow: number;
  flicker: number;
}

interface LampF {
  head: THREE.Mesh;
  light: THREE.PointLight;
  style: 'gas' | 'cobra' | 'sodium' | 'led';
  phase: number;
}

type LampStyle = 'gas' | 'cobra' | 'sodium' | 'led';

const GRID = 7; // lots per side
const LOT = 7; // lot width
const ROAD = 4.2; // road width between rows
const BLOCK = LOT + ROAD; // pitch

const LAMP_STYLE_BY_ERA: LampStyle[] = ['gas', 'cobra', 'sodium', 'led', 'led'];
const ERA_YEARS = [1945, 1965, 1985, 2005, 2025];

const BILLBOARD_TEXTS: string[][] = [
  ['WAR BONDS', 'VICTORY', '5¢ COLA', 'GAS'],
  ['DINER', 'MOTEL 66', 'COLA', 'CHEVY'],
  ['ARCADE', 'COLA', 'VIDEO SHOP', 'BANK'],
  ['APPLE', 'STARBUCKS', 'SUNGLASS', 'SWEET'],
  ['NEXUS AI', 'EV CHARGE', 'NEO BISTRO', 'CLOUD 9'],
];

const STOREFRONT_TEXTS: string[][] = [
  ['WAR BONDS', 'DRUGS', 'BARBER', 'VICTORY CAFE', '5¢ COLA'],
  ['DINER', 'MOTEL', 'CHEVROLET', 'NEON', 'SODA'],
  ['ARCADE', "McDONALD'S", 'VIDEO', 'BANK', 'COLA'],
  ['APPLE', 'STARBUCKS', 'SAMSUNG', 'BANK', 'GYM'],
  ['NEXUS AI', 'EV CHARGE', 'NEO BISTRO', 'CLOUD', 'GREEN'],
];

export function createCity(textures: TextureSet): CityModule {
  const group = new THREE.Group();
  group.name = 'city';
  const rnd = mulberry32(0xc17dc17d);

  const buildings: BuildingF[] = [];
  const lamps: LampF[] = [];

  const cityHalf = (GRID * BLOCK) / 2;

  /* ================= shared geometry ================= */
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const planeGeo = new THREE.PlaneGeometry(1, 1);
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 10);

  /* ================= roads & sidewalks ================= */
  const asphaltMat = new THREE.MeshStandardMaterial({
    map: textures.asphalt,
    roughness: 0.92,
    metalness: 0.02,
  });
  const street = new THREE.Mesh(
    new THREE.PlaneGeometry(GRID * BLOCK + 10, GRID * BLOCK + 10),
    asphaltMat,
  );
  street.rotation.x = -Math.PI / 2;
  street.receiveShadow = true;
  group.add(street);

  const sideMat = new THREE.MeshStandardMaterial({
    color: '#9a9490',
    roughness: 0.88,
  });
  const sideGeo = new THREE.BoxGeometry(1.3, 0.16, 1);
  for (let i = 0; i <= GRID; i++) {
    const axis = i * BLOCK - cityHalf;
    // horizontal road borders (running along X)
    for (let s = -1; s <= GRID; s++) {
      const seg = new THREE.Mesh(sideGeo, sideMat);
      seg.scale.set(1, 1, BLOCK);
      seg.position.set(axis, 0.09, s * BLOCK);
      group.add(seg);
    }
    // vertical road borders
    for (let s = -1; s <= GRID; s++) {
      const seg = new THREE.Mesh(sideGeo, sideMat);
      seg.scale.set(1, 1, BLOCK);
      seg.rotation.y = Math.PI / 2;
      seg.position.set(s * BLOCK, 0.09, axis);
      group.add(seg);
    }
  }

  // road centre lines
  const lineMat = new THREE.MeshBasicMaterial({
    color: '#e8e4da',
    transparent: true,
    opacity: 0.7,
  });
  const lineGeo = new THREE.BoxGeometry(0.12, 0.02, 1);
  for (let i = 1; i < GRID; i++) {
    const x = i * BLOCK - (GRID * BLOCK) / 2;
    for (let k = 0; k < GRID + 2; k++) {
      const l1 = new THREE.Mesh(lineGeo, lineMat);
      l1.scale.z = BLOCK;
      l1.position.set(x, 0.02, (k - (GRID + 1) / 2) * BLOCK);
      group.add(l1);
      const l2 = new THREE.Mesh(lineGeo, lineMat);
      l2.scale.z = BLOCK;
      l2.rotation.y = Math.PI / 2;
      l2.position.set((k - (GRID + 1) / 2) * BLOCK, 0.02, x);
      group.add(l2);
    }
  }

  /* ================= buildings ================= */
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      // leave every third cross-cell empty as an alley / park strip
      if ((r + c) % 3 === 2) continue;
      const x = r * BLOCK - (GRID * BLOCK) / 2 + BLOCK / 2;
      const z = c * BLOCK - (GRID * BLOCK) / 2 + BLOCK / 2;
      buildings.push(makeBuilding(x, z, r + c));
    }
  }

  function makeBuilding(x: number, z: number, seed: number): BuildingF {
    const g = new THREE.Group();
    const w = LOT;
    const d = LOT;
    const localRnd = mulberry32(0x5eed0000 + seed * 7919);

    const windowTex = createWindowTexture({
      facade: '#34363c',
      frame: '#202226',
      glass: '#141e26',
      emissive: '#ffcf9a',
      lit: 0.5,
      columns: 5,
      rows: 9,
    });
    const windowMat = new THREE.MeshStandardMaterial({
      map: windowTex,
      emissive: '#ffcf9a',
      emissiveIntensity: 0.55,
      roughness: 0.4,
      metalness: 0.15,
    });
    const facadeMat = new THREE.MeshStandardMaterial({
      color: '#7c4a38',
      roughness: 0.9,
      metalness: 0.02,
    });
    facadeMat.map = createBrickTexture({ base: '#7c4a38', mortar: '#38291f' });

    // box material array: [+x, -x, +y, -y, +z, -z]
    const body = new THREE.Mesh(boxGeo, [
      facadeMat,
      facadeMat,
      facadeMat,
      facadeMat,
      windowMat,
      windowMat,
    ]);
    body.scale.set(w, 1, d);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    const growth = 0.85 + localRnd() * 0.5;
    const eraScales = [1, 1.18 + localRnd() * 0.1, 1.5 * growth, 1.9 * growth, 2.3 * growth];

    // storefront canopy
    const storefrontMat = new THREE.MeshStandardMaterial({
      color: '#3a2a20',
      roughness: 0.5,
      metalness: 0.1,
    });
    const canopy = new THREE.Mesh(boxGeo, storefrontMat);
    canopy.scale.set(w * 0.92, 0.14, 0.5);
    canopy.position.set(0, 2.3, d * 0.5 + 0.02);
    g.add(canopy);

    // sign above the entrance (CanvasTexture text)
    const signTex = createSignTexture({
      text: STOREFRONT_TEXTS[0][Math.floor(localRnd() * STOREFRONT_TEXTS[0].length)],
      bg: '#2b2b2f',
      fg: '#ffd9a0',
      accent: '#c96f2a',
      glow: 1.2,
    });
    const signMat = new THREE.MeshBasicMaterial({ map: signTex });
    const sign = new THREE.Mesh(planeGeo, signMat);
    sign.scale.set(w * 0.8, 0.85, 1);
    sign.position.set(0, 3.4, d * 0.51 + 0.03);
    g.add(sign);

    // billboard on a subset of rooftops
    let billboardMat: THREE.MeshStandardMaterial | null = null;
    let billboardTex: THREE.CanvasTexture | null = null;
    if (localRnd() < 0.5) {
      billboardTex = createSignTexture({
        text: BILLBOARD_TEXTS[0][Math.floor(localRnd() * BILLBOARD_TEXTS[0].length)],
        bg: '#111318',
        fg: '#ffffff',
        accent: '#ff5f9e',
        glow: 1.6,
        sub: 'since 1945',
      });
      billboardMat = new THREE.MeshStandardMaterial({
        map: billboardTex,
        emissive: '#ffffff',
        emissiveIntensity: 1.4,
        roughness: 0.6,
      });
      const frame = new THREE.Mesh(
        boxGeo,
        new THREE.MeshStandardMaterial({ color: '#26262c', roughness: 0.5 }),
      );
      frame.scale.set(7.4, 2.7, 0.35);
      frame.position.set((localRnd() - 0.5) * 2, 0, (localRnd() - 0.5) * 2);
      g.add(frame);
      const sign = new THREE.Mesh(planeGeo, billboardMat);
      sign.scale.set(7, 2.4, 1);
      sign.position.set(frame.position.x, frame.position.y, frame.position.z + 0.2);
      g.add(sign);
    }

    // rooftop props
    const waterTower = makeWaterTower(localRnd() * 0.4, localRnd() * 0.7, [0]);
    const hvacG = makeRooftopBox(1.1 + localRnd() * 0.4, 0.6, 0.9, -1.6, 0, [1, 2, 3]);
    const antennaG = makeRooftopCyl(0.07, 4.5, 0.8, -0.4, [0, 1]);
    const solarG = makeSolar(localRnd() * 1.2, 1.2 + localRnd() * 0.6, [4]);
    const patio = makePatio(0.6 + localRnd(), 2.0 + localRnd(), [4]);
    const props: RooftopProp[] = [waterTower, hvacG, antennaG, solarG, patio];

    const block: BuildingF = {
      group: g,
      body,
      windowMats: [windowMat],
      facadeMats: [facadeMat],
      sign,
      baseHeight: 7 + localRnd() * 5,
      eraScales,
      heightScale: 1,
      windowTex,
      windowEmissive: { r: 1, g: 0.81, b: 0.6 },
      windowIntensity: 0.55,
      props,
      signMat,
      signTex,
      billboardMat,
      billboardTex,
      billboardGlow: 1.4,
      flicker: localRnd(),
    };

    g.position.set(x, 0, z);
    // rotate so the +z storefront faces the nearest road axis
    g.rotation.y = seed % 2 === 0 ? 0 : Math.PI / 2;
    group.add(g);
    return block;
  }

  function makeWaterTower(x: number, z: number, eras: number[]): RooftopProp {
    const grp = new THREE.Group();
    const legMat = new THREE.MeshStandardMaterial({ color: '#5a4a38', roughness: 0.9 });
    const tankMat = new THREE.MeshStandardMaterial({ color: '#6b5136', roughness: 0.85 });
    const legs = new THREE.Mesh(cylGeo, legMat);
    legs.scale.set(0.16, 1.4, 0.16);
    legs.position.y = 0.7;
    grp.add(legs);
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 1.1, 10),
      tankMat,
    );
    tank.position.y = 1.7;
    grp.add(tank);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 0.5, 10),
      tankMat,
    );
    cone.position.y = 2.5;
    grp.add(cone);
    // decayed look: slight tilt
    grp.rotation.z = (rnd() - 0.5) * 0.06;
    grp.position.set(x, 0.1, z);
    grp.visible = false;
    return { group: grp, eras };
  }

  function makeRooftopBox(
    w: number,
    h: number,
    d: number,
    x: number,
    z: number,
    eras: number[],
  ): RooftopProp {
    const m = new THREE.Mesh(
      boxGeo,
      new THREE.MeshStandardMaterial({ color: '#6a6a6e', roughness: 0.6, metalness: 0.4 }),
    );
    m.scale.set(w, h, d);
    m.position.set(x, h / 2 + 0.1, z);
    const grp = new THREE.Group();
    grp.add(m);
    grp.visible = false;
    return { group: grp, eras };
  }

  function makeRooftopCyl(
    radius: number,
    h: number,
    x: number,
    z: number,
    eras: number[],
  ): RooftopProp {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, h, 6),
      new THREE.MeshStandardMaterial({ color: '#777', metalness: 0.8, roughness: 0.5 }),
    );
    m.position.set(x, 1 + h / 3, z);
    const grp = new THREE.Group();
    grp.add(m);
    const cross = new THREE.Mesh(
      boxGeo,
      new THREE.MeshStandardMaterial({ color: '#888' }),
    );
    cross.scale.set(0.08, 2.2, 0.08);
    cross.position.set(x, 1 + h * 0.8, z);
    grp.add(cross);
    grp.visible = false;
    return { group: grp, eras };
  }

  function makeSolar(x: number, z: number, eras: number[]): RooftopProp {
    const m = new THREE.Mesh(
      boxGeo,
      new THREE.MeshStandardMaterial({ color: '#1e3a66', metalness: 0.5, roughness: 0.35 }),
    );
    m.scale.set(1.6, 0.1, 1.0);
    m.position.set(x, 0.1, z);
    m.rotation.z = 0.15;
    const grp = new THREE.Group();
    grp.add(m);
    grp.visible = false;
    return { group: grp, eras };
  }

  function makePatio(x: number, z: number, eras: number[]): RooftopProp {
    const m = new THREE.Mesh(
      boxGeo,
      new THREE.MeshStandardMaterial({ color: '#2d5a36', roughness: 1 }),
    );
    m.scale.set(2.6, 0.06, 1.8);
    m.position.set(x, 0.04, z);
    const grp = new THREE.Group();
    grp.add(m);
    grp.visible = false;
    return { group: grp, eras };
  }

  /* ================= lamps ================= */
  const lampMat = new THREE.MeshStandardMaterial({
    color: '#232327',
    roughness: 0.4,
    metalness: 0.7,
  });
  const headGeos: Record<LampStyle, THREE.BufferGeometry> = {
    gas: new THREE.SphereGeometry(0.7, 10, 8),
    cobra: new THREE.SphereGeometry(0.55, 10, 8),
    sodium: new THREE.BoxGeometry(1.3, 0.35, 0.55),
    led: new THREE.BoxGeometry(0.95, 0.14, 0.32),
  };
  const lamppositions: [number, number][] = [];
  for (let k = 0; k < GRID + 1; k++) {
    lamppositions.push([3, k * BLOCK - cityHalf]);
    lamppositions.push([0, k * BLOCK - cityHalf]);
  }
  for (const [x, z] of lamppositions) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(cylGeo, lampMat);
    pole.scale.set(0.16, 5.2, 0.16);
    pole.position.y = 2.6;
    g.add(pole);
    const head = new THREE.Mesh(headGeos.gas, lampMat);
    head.position.y = 5.3;
    g.add(head);
    const light = new THREE.PointLight('#ffd08a', 1.8, 14, 2);
    light.position.y = 5.3;
    g.add(light);
    g.position.set(x, 0, z);
    group.add(g);
    lamps.push({ head, light, style: 'gas', phase: rnd() * Math.PI * 2 });
  }

  /* ================= benches / hydrants / trees ================= */
  const benchMat = new THREE.MeshStandardMaterial({ color: '#5a4632', roughness: 0.85 });
  {
    const seat = new THREE.Mesh(boxGeo, benchMat);
    seat.scale.set(1.6, 0.1, 0.5);
    seat.position.y = 0.45;
    const back = new THREE.Mesh(boxGeo, benchMat);
    back.scale.set(1.6, 0.5, 0.08);
    back.position.set(0, 0.72, -0.21);
    const group2 = new THREE.Group();
    group2.add(seat, back);
    group2.position.set(cityHalf - 2.2, 0, -cityHalf / 2);
    group.add(group2);
  }

  const hydrantMat = new THREE.MeshStandardMaterial({
    color: '#c8342a',
    metalness: 0.3,
    roughness: 0.5,
  });
  const hydrant = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.8, 8), hydrantMat);
  hydrant.position.set(cityHalf - 1.2, 0.4, -cityHalf / 2 - 1.4);
  group.add(hydrant);

  const trunkMat = new THREE.MeshStandardMaterial({ color: '#5c4426', roughness: 1 });
  const foliageMat = new THREE.MeshStandardMaterial({ color: '#3f7a3c', roughness: 1 });
  for (let i = 0; i < 6; i++) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(cylGeo, trunkMat);
    trunk.scale.set(0.22, 1.8 + (i % 2), 0.22);
    trunk.position.y = 1;
    tree.add(trunk);
    const foliage = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), foliageMat);
    foliage.position.y = 2.8;
    tree.add(foliage);
    tree.position.set(-cityHalf + 4 + i * 7, 0, cityHalf - 2);
    group.add(tree);
  }

  /* ================= era application ================= */
  let lastEraIdx = -1;

  function applyEraTheme(theme: Theme): void {
    asphaltMat.color.set(rgbToHex(theme.ground.asphalt));
    sideMat.color.set(rgbToHex(theme.ground.sidewalk));
    lineMat.color.set(rgbToHex(theme.ground.roadLine));
  }

  function applyBuildingEra(b: BuildingF, idx: number, theme: Theme): void {
    const winTex = createWindowTexture({
      facade: '#34363c',
      frame: '#202226',
      glass: '#1b2a33',
      emissive: rgbToHex(theme.building.windowEmissive),
      lit: theme.building.windowLit,
      columns: 5,
      rows: 12,
    });
    b.windowTex.dispose();
    b.windowTex = winTex;
    for (const wm of b.windowMats) {
      wm.map = winTex;
      wm.emissive.set(rgbToHex(theme.building.windowEmissive));
      wm.emissiveIntensity = theme.building.windowIntensity;
      wm.needsUpdate = true;
    }
    b.windowEmissive = theme.building.windowEmissive;
    b.windowIntensity = theme.building.windowIntensity;

    // facade tint
    const wall = theme.building.facades[idx % theme.building.facades.length];
    for (const fm of b.facadeMats) {
      fm.color.set(rgbToHex(wall));
      fm.needsUpdate = true;
    }

    // storefront sign text
    if (b.signTex && b.sign) {
      const texts = STOREFRONT_TEXTS[idx];
      const text = texts[Math.floor(rnd() * texts.length)];
      b.signTex.dispose();
      b.signTex = createSignTexture({
        text,
        bg: '#232327',
        fg: rgbToHex(theme.building.windowEmissive),
        accent: rgbToHex(theme.billboard.accent),
        glow: 1.2,
      });
      b.signMat!.map = b.signTex;
      b.signMat!.needsUpdate = true;
    }

    // billboard
    if (b.billboardMat && b.billboardTex && b.billboardMat.map) {
      const texts = BILLBOARD_TEXTS[idx];
      const text = texts[Math.floor(rnd() * texts.length)];
      b.billboardTex.dispose();
      b.billboardTex = createSignTexture({
        text,
        bg: '#101218',
        fg: '#ffffff',
        accent: rgbToHex(theme.billboard.accent),
        glow: 1.8,
        sub: `EST ${ERA_YEARS[idx]}`,
      });
      b.billboardMat.map = b.billboardTex;
      b.billboardMat.emissive.set(rgbToHex(theme.billboard.accent));
      b.billboardMat.needsUpdate = true;
      b.billboardGlow = theme.billboard.glow;
    }

    // rooftop props visibility
    for (const p of b.props) {
      p.group.visible = p.eras.includes(idx);
    }
  }

  /* ==== update ==== */
  function update(dt: number, state: AppState): void {
    const pair = themePairAt(state.eraFloat);
    const themeB = pair.b;
    const idx = Math.round(state.eraFloat);
    if (idx !== lastEraIdx) {
      lastEraIdx = idx;
      for (const b of buildings) applyBuildingEra(b, idx, themeB);
    }
    applyEraTheme(themeB);

    // continuous building scale tween
    for (const b of buildings) {
      const target = b.eraScales[idx];
      const k = 1 - Math.pow(0.0001, dt);
      b.heightScale = lerp(b.heightScale, target, k);
      const h = b.baseHeight * b.heightScale;
      b.body.scale.y = h;
      b.body.position.y = h / 2 + 0.08;
      for (const wm of b.windowMats) {
        wm.emissiveIntensity = lerp(b.windowIntensity, themeB.building.windowIntensity, k);
      }
      // roof follows the building top
      for (const p of b.props) {
        p.group.position.y = h - 0.1;
      }
      // billboard pulse
      if (b.billboardMat) {
        b.billboardMat.emissiveIntensity =
          b.billboardGlow + Math.sin(state.elapsed * 1.1 + b.flicker * 7) * 0.35;
      }
    }

    // lamps
    const style = LAMP_STYLE_BY_ERA[idx];
    for (const lp of lamps) {
      if (lp.style !== style) {
        lp.style = style;
        lp.head.geometry = headGeos[style];
        lp.head.scale.set(1, 1, 1);
        if (style === 'gas') {
          lp.head.position.y = 5.4;
          lp.head.rotation.y = 0;
        } else if (style === 'cobra') {
          lp.head.position.y = 5.45;
          lp.head.rotation.y = 0.9;
        } else {
          lp.head.position.y = 5.5;
          lp.head.rotation.y = 0;
        }
      }
      lp.light.color.set(rgbToHex(themeB.lamp.color));
      const flicker =
        style === 'gas' && state.eraFloat < 0.5
          ? 0.85 + Math.sin(state.elapsed * 6 + lp.phase) * 0.14
          : 1;
      lp.light.intensity = themeB.lamp.intensity * flicker;
      lp.light.distance = themeB.lamp.distance;
    }
  }

  function setEra(): void {}

  function dispose(): void {
    for (const b of buildings) {
      b.windowTex.dispose();
      if (b.signTex) b.signTex.dispose();
      if (b.billboardTex) b.billboardTex.dispose();
      for (const wm of b.windowMats) wm.dispose();
      for (const fm of b.facadeMats) fm.dispose();
    }
    asphaltMat.dispose();
    sideMat.dispose();
    lineMat.dispose();
    lampMat.dispose();
    group.removeFromParent();
  }

  return { group, update, setEra, dispose };
}