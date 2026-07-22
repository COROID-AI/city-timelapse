// ============================================================
//  CITY BUILDER — procedural block, buildings, roads, props
//  Builds a deterministic city block and supports era morphing.
// ============================================================
import * as THREE from 'three';
import { makeRng, pick, randInt, rand, chance, disposeObject } from './util.js';
import { makeBuildingFacade, makeRoadTexture, makeSidewalkTexture, makeGroundTexture, makeNeonSign, shade } from './materials.js';

// Block layout constants
export const BLOCK = {
  size: 60,            // full block edge
  roadW: 12,           // road width
  sidewalkW: 4,        // sidewalk width
};

// A single plot where a building can stand
const PLOTS = [
  // quadrant plots (x,z center, w,d footprint)
  { x: -16, z: -16, w: 22, d: 22, id: 0 },
  { x: 16, z: -16, w: 22, d: 22, id: 1 },
  { x: -16, z: 16, w: 22, d: 22, id: 2 },
  { x: 16, z: 16, w: 22, d: 22, id: 3 },
];

const STREET_LIGHT_POSITIONS = [
  { x: 0, z: -BLOCK.size / 2 + 3 },
  { x: 0, z: BLOCK.size / 2 - 3 },
  { x: -BLOCK.size / 2 + 3, z: 0 },
  { x: BLOCK.size / 2 - 3, z: 0 },
];

const TREE_POSITIONS = [
  { x: -8, z: -8 }, { x: 8, z: -8 }, { x: -8, z: 8 }, { x: 8, z: 8 },
  { x: -22, z: 0 }, { x: 22, z: 0 }, { x: 0, z: -22 }, { x: 0, z: 22 },
];

export class CityBuilder {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'City';
    scene.add(this.group);

    this.buildings = [];     // { mesh, plot, eraData, baseY, targetY }
    this.props = [];         // trees, lights, etc
    this.signs = [];         // emissive neon signs { mesh, material, eraColor }
    this.billboards = [];    // digital billboards
    this.lights = [];        // dynamic era lights (point/spot)
    this.dynamicLights = []; // era point lights to swap
    this.facades = [];       // building facade data for window flicker
    this.skyObjects = [];    // drones, etc
    this.groundMesh = null;
    this.roadMeshes = [];
    this.sidewalkMeshes = [];
  }

  // ---- Build static infrastructure (ground, roads, sidewalks) ----
  buildBase() {
    // Ground plane
    const groundTex = makeGroundTexture(2025);
    groundTex.repeat.set(8, 8);
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.y = -0.02;
    this.groundMesh.receiveShadow = true;
    this.group.add(this.groundMesh);

    // Roads: cross pattern through center
    const roadTex = makeRoadTexture(2025);
    roadTex.repeat.set(1, 5);
    const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.9 });
    // N-S road
    const nsRoad = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK.roadW, BLOCK.size + BLOCK.roadW), roadMat);
    nsRoad.rotation.x = -Math.PI / 2;
    nsRoad.position.set(0, 0, 0);
    nsRoad.receiveShadow = true;
    this.group.add(nsRoad); this.roadMeshes.push(nsRoad);
    // E-W road
    const ewRoadTex = roadTex.clone(); ewRoadTex.needsUpdate = true;
    ewRoadTex.repeat.set(5, 1);
    const ewRoad = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK.size + BLOCK.roadW, BLOCK.roadW), roadMat.clone());
    ewRoad.material.map = ewRoadTex;
    ewRoad.rotation.x = -Math.PI / 2;
    ewRoad.position.set(0, 0, 0);
    ewRoad.receiveShadow = true;
    this.group.add(ewRoad); this.roadMeshes.push(ewRoad);

    // Sidewalks: ring around block perimeter (4 strips)
    const swTex = makeSidewalkTexture(2025);
    swTex.repeat.set(8, 1);
    const swMat = new THREE.MeshStandardMaterial({ map: swTex, roughness: 0.95 });
    const half = BLOCK.size / 2;
    const swStrips = [
      { x: 0, z: -half + BLOCK.sidewalkW / 2, w: BLOCK.size, d: BLOCK.sidewalkW },
      { x: 0, z: half - BLOCK.sidewalkW / 2, w: BLOCK.size, d: BLOCK.sidewalkW },
      { x: -half + BLOCK.sidewalkW / 2, z: 0, w: BLOCK.sidewalkW, d: BLOCK.size },
      { x: half - BLOCK.sidewalkW / 2, z: 0, w: BLOCK.sidewalkW, d: BLOCK.size },
    ];
    swStrips.forEach(s => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(s.w, 0.3, s.d), swMat);
      m.position.set(s.x, 0.15, s.z);
      m.receiveShadow = true;
      this.group.add(m); this.sidewalkMeshes.push(m);
    });

    // Corner curbs (raised pads where buildings sit)
    PLOTS.forEach(p => {
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(p.w + 1, 0.5, p.d + 1),
        new THREE.MeshStandardMaterial({ color: 0x555a62, roughness: 0.9 })
      );
      pad.position.set(p.x, 0.25, p.z);
      pad.receiveShadow = true;
      this.group.add(pad);
    });
  }

  // ---- Build all buildings for an era (fresh) ----
  buildEra(era, isNight) {
    this.clearEraContent();
    const rng = makeRng(era.id * 99 + 1);
    PLOTS.forEach((plot, i) => {
      const b = this._makeBuilding(plot, era, rng, i, isNight);
      this.buildings.push(b);
      this.group.add(b.group);
    });

    // Street props
    this._buildStreetLights(era);
    this._buildTrees(era);
    this._buildBillboards(era);
    this._buildSkyProps(era);

    this.applyRoadTextures(era);
  }

  applyRoadTextures(era) {
    const roadTex = makeRoadTexture(era.id);
    const swTex = makeSidewalkTexture(era.id);
    swTex.repeat.set(8, 1);
    this.roadMeshes.forEach((m, i) => {
      const t = roadTex.clone(); t.needsUpdate = true;
      t.repeat.set(...(i === 0 ? [1, 5] : [5, 1]));
      m.material.map = t;
      m.material.needsUpdate = true;
    });
    this.sidewalkMeshes.forEach(m => { m.material.map = swTex; m.material.needsUpdate = true; });
    // ground
    const gt = makeGroundTexture(era.id); gt.repeat.set(8, 8);
    this.groundMesh.material.map = gt; this.groundMesh.material.needsUpdate = true;
  }

  // ---- Construct a single building ----
  _makeBuilding(plot, era, rng, idx, isNight) {
    const group = new THREE.Group();
    group.position.set(plot.x, 0.5, plot.z);

    // height grows with era modernity (with variation)
    const heightFactor = { 1945: 1.0, 1965: 1.4, 1985: 1.8, 2005: 2.2, 2025: 2.6, 2055: 3.0 }[era.id] || 2;
    const floors = Math.max(3, Math.floor(rand(rng, 4, 9) * heightFactor));
    const floorH = 3.2;
    const totalH = floors * floorH;

    // footprint slightly smaller than plot with random inset
    const inset = rand(rng, 2, 5);
    const fw = plot.w - inset;
    const fd = plot.d - inset;

    // style by era
    let style;
    if (era.id <= 1965) style = pick(rng, ['brick', 'brick', 'concrete']);
    else if (era.id <= 2005) style = pick(rng, ['concrete', 'glass', 'concrete']);
    else style = 'glass';

    const baseColor = pick(rng, era.palette.building);
    const accent = era.palette.buildingAccent;
    const cols = randInt(rng, 3, 5);
    const rows = floors;

    const { map, emissive } = makeBuildingFacade({
      seed: era.id * 1000 + idx * 17,
      baseColor, accentColor: accent,
      winOn: era.palette.windowOn, winOff: era.palette.windowOff,
      cols, rows, style, eraId: era.id,
      litRate: isNight ? 0.6 : 0.18,
    });
    map.repeat.set(1, 1);

    const mat = new THREE.MeshStandardMaterial({
      map, emissiveMap: emissive,
      emissive: new THREE.Color(isNight ? 0xffffff : 0x000000),
      emissiveIntensity: isNight ? 1.2 : 0,
      roughness: style === 'glass' ? 0.25 : 0.85,
      metalness: style === 'glass' ? 0.4 : 0.05,
    });

    const geo = new THREE.BoxGeometry(fw, totalH, fd);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = totalH / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Rooftop details
    this._addRoofDetails(group, fw, fd, totalH, era, rng, style);

    // Neon / accent sign on the facade (era >= 1965)
    if (era.id >= 1965 && chance(rng, 0.8)) {
      this._addNeonSign(group, fw, totalH, fd, era, rng);
    }

    // Ground-floor entrance glow
    if (chance(rng, 0.6)) {
      const doorGeo = new THREE.PlaneGeometry(2, 3);
      const doorMat = new THREE.MeshBasicMaterial({ color: era.palette.windowOn, transparent: true, opacity: 0.85 });
      const door = new THREE.Mesh(doorGeo, doorMat);
      door.position.set(0, 1.5, fd / 2 + 0.02);
      group.add(door);
    }

    return {
      group, mesh, plot, era, floors, totalH, style,
      material: mat, facadeMap: map, facadeEmissive: emissive,
    };
  }

  _addRoofDetails(group, fw, fd, totalH, era, rng, style) {
    // water tower (older eras)
    if (era.id <= 1985 && chance(rng, 0.6)) {
      const wt = new THREE.Group();
      const legs = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 2.5, 6),
        new THREE.MeshStandardMaterial({ color: 0x44392a, roughness: 0.9 })
      );
      legs.position.y = 1.25;
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.4, 1.8, 12),
        new THREE.MeshStandardMaterial({ color: 0x6a5a44, roughness: 0.9 })
      );
      tank.position.y = 3.4;
      wt.add(legs, tank);
      wt.position.set(rand(rng, -fw / 4, fw / 4), totalH, rand(rng, -fd / 4, fd / 4));
      wt.castShadow = true;
      group.add(wt);
    }
    // AC units (mid eras)
    if (era.id >= 1985 && era.id <= 2025 && chance(rng, 0.7)) {
      for (let i = 0; i < randInt(rng, 1, 3); i++) {
        const ac = new THREE.Mesh(
          new THREE.BoxGeometry(rand(rng, 1.5, 3), 0.8, rand(rng, 1.5, 3)),
          new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.7, metalness: 0.3 })
        );
        ac.position.set(rand(rng, -fw / 3, fw / 3), totalH + 0.4, rand(rng, -fd / 3, fd / 3));
        ac.castShadow = true;
        group.add(ac);
      }
    }
    // Solar panels + green roof (future)
    if (era.id >= 2005) {
      const panelCount = era.id >= 2055 ? 8 : 4;
      for (let i = 0; i < panelCount; i++) {
        const panel = new THREE.Mesh(
          new THREE.BoxGeometry(2.5, 0.15, 1.6),
          new THREE.MeshStandardMaterial({
            color: era.id >= 2055 ? 0x0a2a3a : 0x1a2a4a,
            roughness: 0.3, metalness: 0.6,
            emissive: era.id >= 2055 ? 0x0a4a3a : 0x000000, emissiveIntensity: 0.2,
          })
        );
        panel.rotation.x = -0.3;
        panel.position.set(rand(rng, -fw / 3, fw / 3), totalH + 0.3, rand(rng, -fd / 3, fd / 3));
        panel.castShadow = true;
        group.add(panel);
      }
    }
    // antenna / spire
    if (chance(rng, 0.4)) {
      const spire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.2, rand(rng, 3, 7), 6),
        new THREE.MeshStandardMaterial({ color: 0x8a8f98, roughness: 0.5, metalness: 0.6 })
      );
      spire.position.set(0, totalH + 3, 0);
      group.add(spire);
      // red beacon
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff2a2a })
      );
      beacon.position.set(0, totalH + 6.5, 0);
      beacon.userData.blink = true;
      group.add(beacon);
      this.facades.push({ beacon });
    }
    // vertical farm / green wall (future)
    if (era.id >= 2055 && chance(rng, 0.7)) {
      const gw = new THREE.Mesh(
        new THREE.BoxGeometry(fw * 0.9, totalH * 0.7, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x2a5a44, roughness: 0.9, emissive: 0x0a3a22, emissiveIntensity: 0.15 })
      );
      gw.position.set(0, totalH * 0.45, fd / 2 + 0.25);
      group.add(gw);
    }
  }

  _addNeonSign(group, fw, totalH, fd, era, rng) {
    const words = {
      1965: ['MOTEL', 'DINER', 'OPEN', 'CAFE'],
      1985: ['NEON', 'ARCADE', 'CLUB', 'CYBER'],
      2005: ['CAFE', 'WIFI', 'OPEN', '24/7'],
      2025: ['NEXUS', 'SYNC', 'ECHO', 'FLUX'],
      2055: ['QUANTUM', 'AETHER', 'BIO', 'GENESIS'],
    }[era.id];
    if (!words) return;
    const word = pick(rng, words);
    const color = pick(rng, era.palette.neon);
    const tex = makeNeonSign(word, color, era.id + word.charCodeAt(0));
    const w = rand(rng, 6, Math.min(12, fw * 0.8));
    const h = w * 0.25;
    const signGeo = new THREE.PlaneGeometry(w, h);
    const signMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(rand(rng, -fw / 4, fw / 4), rand(rng, totalH * 0.3, totalH * 0.7), fd / 2 + 0.1);
    group.add(sign);
    this.signs.push({ mesh: sign, color, eraId: era.id, flicker: chance(rng, 0.3) });
  }

  // ---- Street lights ----
  _buildStreetLights(era) {
    const lampColor = new THREE.Color(era.palette.lamp);
    STREET_LIGHT_POSITIONS.forEach((pos, i) => {
      const g = new THREE.Group();
      // pole
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.18, 6, 8),
        new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.6, metalness: 0.5 })
      );
      pole.position.y = 3; pole.castShadow = true;
      g.add(pole);
      // arm
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 1.5, 6),
        new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.6 })
      );
      arm.rotation.z = Math.PI / 2;
      arm.position.set(0.75, 5.8, 0);
      g.add(arm);
      // lamp head
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 10, 10),
        new THREE.MeshBasicMaterial({ color: lampColor })
      );
      head.position.set(1.5, 5.7, 0);
      g.add(head);
      // future: floating ring light
      if (era.id >= 2055) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.8, 0.06, 8, 24),
          new THREE.MeshBasicMaterial({ color: lampColor })
        );
        ring.position.set(1.5, 5.7, 0);
        ring.rotation.x = Math.PI / 2;
        g.add(ring);
      }
      g.position.set(pos.x, 0.3, pos.z);
      g.rotation.y = (i * Math.PI) / 2;
      this.group.add(g);
      this.props.push({ mesh: g, type: 'lamp', headColor: head.material });

      // point light (only at night or dim eras)
      const pl = new THREE.PointLight(lampColor, era.id === 1985 ? 1.5 : 0.8, 18, 1.6);
      pl.position.set(pos.x + 1.5, 5.7, pos.z);
      this.group.add(pl);
      this.dynamicLights.push(pl);
    });
  }

  // ---- Trees / foliage ----
  _buildTrees(era) {
    const leafColor = new THREE.Color(pick(makeRng(era.id * 5), era.palette.foliage));
    TREE_POSITIONS.forEach(pos => {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.3, 2.5, 6),
        new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 0.9 })
      );
      trunk.position.y = 1.25; trunk.castShadow = true;
      g.add(trunk);
      // canopy
      const canopyH = era.id >= 2055 ? 1.0 : 0.85;
      const canopy = new THREE.Mesh(
        new THREE.IcosahedronGeometry(rand(makeRng(pos.x + pos.z), 1.3, 1.7), 1),
        new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.9, flatShading: true })
      );
      canopy.position.y = 3; canopy.scale.y = canopyH; canopy.castShadow = true;
      g.add(canopy);
      g.position.set(pos.x, 0.3, pos.z);
      // future: glowing bio foliage
      if (era.id >= 2055) {
        canopy.material.emissive = new THREE.Color(0x1a4a3a);
        canopy.material.emissiveIntensity = 0.3;
      }
      this.group.add(g);
      this.props.push({ mesh: g, type: 'tree', leafMat: canopy.material });
    });
  }

  // ---- Billboards ----
  _buildBillboards(era) {
    if (era.id < 2005) return;
    const positions = [
      { x: -BLOCK.size / 2 + 2, z: -BLOCK.size / 2 + 8 },
      { x: BLOCK.size / 2 - 2, z: BLOCK.size / 2 - 8 },
    ];
    positions.forEach((pos, i) => {
      const g = new THREE.Group();
      // support pole
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.3, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.7, metalness: 0.4 })
      );
      pole.position.y = 4;
      g.add(pole);
      // screen
      const color = pick(makeRng(era.id + i), era.palette.neon);
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(5, 3),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.95 })
      );
      screen.position.set(0, 9, 0.4);
      g.add(screen);
      // glowing back panel
      const back = new THREE.Mesh(
        new THREE.PlaneGeometry(5.4, 3.4),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.2 })
      );
      back.position.set(0, 9, 0.35);
      g.add(back);
      g.position.set(pos.x, 0.3, pos.z);
      this.group.add(g);
      this.billboards.push({ mesh: g, screen, color, baseColor: color });
    });
  }

  // ---- Sky props: drones (2025+), blimps (1965-2005), stars ----
  _buildSkyProps(era) {
    if (era.id >= 2025) {
      // drones
      for (let i = 0; i < (era.id >= 2055 ? 5 : 3); i++) {
        const d = this._makeDrone(era);
        d.position.set(rand(makeRng(i + era.id), -25, 25), rand(makeRng(i), 18, 32), rand(makeRng(i + 9), -25, 25));
        d.userData.orbitR = rand(makeRng(i + 3), 12, 28);
        d.userData.orbitA = rand(makeRng(i + 5), 0, Math.PI * 2);
        d.userData.orbitS = rand(makeRng(i + 7), 0.1, 0.3) * (Math.random() < 0.5 ? 1 : -1);
        d.userData.bob = rand(makeRng(i + 11), 0, 6);
        this.group.add(d);
        this.skyObjects.push({ mesh: d, type: 'drone' });
      }
    } else if (era.id >= 1965 && era.id <= 2005) {
      // blimp
      const blimp = this._makeBlimp(era);
      blimp.position.set(-30, 28, 0);
      blimp.userData.pathT = 0;
      this.group.add(blimp);
      this.skyObjects.push({ mesh: blimp, type: 'blimp' });
    }
  }

  _makeDrone(era) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.2, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.6 })
    );
    g.add(body);
    const led = new THREE.Color(pick(makeRng(Math.random()), era.palette.neon));
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.5, 4),
        new THREE.MeshStandardMaterial({ color: 0x2a2a2a })
      );
      arm.rotation.z = Math.PI / 2;
      arm.rotation.y = (i / 4) * Math.PI * 2;
      arm.position.set(Math.cos(i / 4 * Math.PI * 2) * 0.3, 0, Math.sin(i / 4 * Math.PI * 2) * 0.3);
      g.add(arm);
      const rotor = new THREE.Mesh(
        new THREE.CircleGeometry(0.25, 8),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
      );
      rotor.rotation.x = -Math.PI / 2;
      rotor.position.set(Math.cos(i / 4 * Math.PI * 2) * 0.5, 0.1, Math.sin(i / 4 * Math.PI * 2) * 0.5);
      g.add(rotor);
    }
    // LED
    const light = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 6, 6),
      new THREE.MeshBasicMaterial({ color: led })
    );
    light.position.y = -0.1;
    light.userData.blink = true;
    g.add(light);
    return g;
  }

  _makeBlimp(era) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(2, 16, 10),
      new THREE.MeshStandardMaterial({ color: pick(makeRng(era.id), era.palette.vehicle), roughness: 0.6, metalness: 0.2 })
    );
    body.scale.set(3, 1, 1.2);
    body.castShadow = true;
    g.add(body);
    // gondola
    const gon = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.5, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7 })
    );
    gon.position.y = -1.5;
    g.add(gon);
    return g;
  }

  // ---- Clear era-specific content (keep base) ----
  clearEraContent() {
    const toRemove = [...this.buildings, ...this.props.map(p => ({ group: p.mesh })), ...this.billboards, ...this.skyObjects.map(s => ({ group: s.mesh }))];
    // collect all groups/meshes added per era
    this._disposeList(this.buildings.map(b => b.group));
    this._disposeList(this.props.map(p => p.mesh));
    this._disposeList(this.billboards.map(b => b.mesh));
    this._disposeList(this.skyObjects.map(s => s.mesh));
    this.dynamicLights.forEach(l => { this.group.remove(l); l.dispose && l.dispose(); });
    this.buildings = []; this.props = []; this.signs = []; this.billboards = [];
    this.dynamicLights = []; this.facades = []; this.skyObjects = [];
  }

  _disposeList(list) {
    list.forEach(obj => {
      this.group.remove(obj);
      disposeObject(obj);
    });
  }

  // ---- Update per-frame (flicker, blink, drones) ----
  update(dt, elapsed, isNight) {
    // sign flicker
    this.signs.forEach((s, i) => {
      if (s.flicker) {
        s.mesh.material.opacity = 0.7 + Math.sin(elapsed * 12 + i) * 0.15 + (Math.random() < 0.02 ? -0.5 : 0);
        s.mesh.material.opacity = Math.max(0.2, s.mesh.material.opacity);
      }
    });
    // beacons blink
    this.facades.forEach(f => {
      if (f.beacon) {
        f.beacon.material.color.setHex((Math.floor(elapsed * 1.5) % 2 === 0) ? 0xff2a2a : 0x440000);
      }
    });
    // billboards cycle color
    this.billboards.forEach((b, i) => {
      const t = (elapsed * 0.3 + i * 0.5) % 1;
      const c = new THREE.Color(b.baseColor);
      c.offsetHSL(t * 0.3, 0, 0);
      b.screen.material.color.copy(c);
    });
    // sky objects
    this.skyObjects.forEach(s => {
      if (s.type === 'drone') {
        const m = s.mesh;
        m.userData.orbitA += m.userData.orbitS * dt;
        m.position.x = Math.cos(m.userData.orbitA) * m.userData.orbitR;
        m.position.z = Math.sin(m.userData.orbitA) * m.userData.orbitR;
        m.position.y += Math.sin(elapsed * 2 + m.userData.bob) * 0.02;
        m.rotation.y = -m.userData.orbitA + Math.PI / 2;
        m.children.forEach(ch => { if (ch.userData.blink) ch.material.opacity = (Math.floor(elapsed * 4) % 2) ? 1 : 0.3; });
      } else if (s.type === 'blimp') {
        s.mesh.position.x = -30 + ((elapsed * 1.5) % 60);
        s.mesh.rotation.y = Math.PI / 2;
      }
    });
  }
}
