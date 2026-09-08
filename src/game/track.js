// Track: closed CatmullRomCurve3 circuit with dense sampling for progress
// projection, road ribbon geometry, wet overlay, lane markings, barrier
// strips, buildings with emissive window textures, and neon signage.

import * as THREE from 'three';
import { buildNeonSign, makeBuildingWindows } from './effects.js';
import { CONFIG } from './config.js';

export class Track {
  constructor() {
    const pts = CONFIG.track.points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    this.curve = new THREE.CatmullRomCurve3(pts, /*closed=*/ true, 'centripetal', 0.5);
    this.halfWidth = CONFIG.track.halfWidth;
    this.group = new THREE.Group();
    this.neons = [];

    // Dense projection table.
    this.samples = [];
    const N = 512;
    this.totalLength = this.curve.getLength();
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const p = this.curve.getPointAt(t);
      this.samples.push({ t, x: p.x, z: p.z });
    }
    // Lookup from nearest sample -> fraction.
    this.projStep = 1 / N;
  }

  /** Route fraction (0..1) of the nearest dense sample for a world position. */
  routeFracFor(pos) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < this.samples.length; i++) {
      const s = this.samples[i];
      const dx = s.x - pos.x;
      const dz = s.z - pos.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return this.samples[best].t;
  }

  /** World point on the centerline at fraction t, optionally laterally offset. */
  pointAt(t, lateral = 0) {
    const p = this.curve.getPointAt(((t % 1) + 1) % 1);
    const dir = this.tangentAt(t);
    // Perpendicular (right-handed) of the forward tangent.
    return {
      x: p.x + dir.z * lateral,
      z: p.z - dir.x * lateral,
    };
  }

  tangentAt(t) {
    const dir = this.curve.getTangentAt(((t % 1) + 1) % 1);
    return { x: dir.x, z: dir.z };
  }

  headingAt(t) {
    const dir = this.tangentAt(t);
    return Math.atan2(dir.x, dir.z); // matches car heading convention
  }

  /** Rough corner sharpness (radians of tangent turn over a lookahead arc). */
  cornerSharpnessAt(t) {
    const a = this.tangentAt(t);
    const b = this.tangentAt((t + 0.06) % 1);
    let diff = Math.abs(Math.atan2(a.x * b.z - a.z * b.x, a.x * b.x + a.z * b.z));
    return diff;
  }

  /** Lateral offset (signed, world units) of pos relative to the centerline. */
  lateralOffsetOf(pos) {
    const t = this.routeFracFor(pos);
    const c = this.curve.getPointAt(t);
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const dir = this.tangentAt(t);
    return Math.sign(dx * dir.z - dz * dir.x) * Math.hypot(dx, dz);
  }

  build() {
    this._buildRoad();
    this._buildBarriers();
    this._buildStartLine();
    this._buildBuildings();
    this._buildNeonSigns();
    this._buildStreetLights();
    return this.group;
  }

  _buildRoad() {
    const N = 256;
    const road = new THREE.BufferGeometry();
    const positions = [];
    const uvs = [];
    const idx = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const cen = this.curve.getPointAt(t);
      const dir = this.tangentAt(t);
      const px = dir.z;
      const pz = -dir.x;
      positions.push(cen.x + px * this.halfWidth, 0.02, cen.z + pz * this.halfWidth);
      positions.push(cen.x - px * this.halfWidth, 0.02, cen.z - pz * this.halfWidth);
      uvs.push(i / N, 1, i / N, 0);
      if (i < N) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    road.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    road.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    road.setIndex(idx);
    road.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x2b2b33,
      roughness: 0.45,
      metalness: 0.6,
      transparent: true,
      opacity: 0.9,
    });
    const mesh = new THREE.Mesh(road, mat);
    mesh.receiveShadow = true;

    // Lane markings.
    const markGeo = new THREE.BufferGeometry();
    const mpos = [];
    const midx = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const cen = this.curve.getPointAt(t);
      const dir = this.tangentAt(t);
      const px = dir.z;
      const pz = -dir.x;
      mpos.push(cen.x + px * 1.5, 0.03, cen.z + pz * 1.5);
      mpos.push(cen.x - px * 1.5, 0.03, cen.z - pz * 1.5);
      if (i < N) {
        const a = i * 2;
        midx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    markGeo.setAttribute('position', new THREE.Float32BufferAttribute(mpos, 3));
    markGeo.setIndex(midx);
    markGeo.computeVertexNormals();
    const markMat = new THREE.MeshBasicMaterial({
      color: 0xcfd6ff,
      transparent: true,
      opacity: 0.85,
    });
    const marks = new THREE.Mesh(markGeo, markMat);
    this.group.add(mesh, marks);
  }

  _buildBarriers() {
    const N = 120;
    const barrierMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      emissive: 0x39ffd0,
      emissiveIntensity: 1.4,
    });
    for (const side of [1, -1]) {
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const cen = this.curve.getPointAt(t);
        const dir = this.tangentAt(t);
        const px = dir.z;
        const pz = -dir.x;
        const off = this.halfWidth + 1.2;
        pts.push(new THREE.Vector3(cen.x + px * off * side, 0.3, cen.z + pz * off * side));
      }
      const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
      const geo = new THREE.TubeGeometry(curve, 160, 0.35, 8, true);
      const mesh = new THREE.Mesh(geo, barrierMat);
      this.group.add(mesh);
    }
  }

  _buildStartLine() {
    const start = this.curve.getPointAt(0);
    const dir = this.tangentAt(0);
    const px = dir.z;
    const pz = -dir.x;
    const pattern = new THREE.MeshStandardMaterial({
      color: 0x111118,
      transparent: true,
      opacity: 0.6,
    });
    const geo = new THREE.PlaneGeometry(this.halfWidth * 2, 1.4);
    const mesh = new THREE.Mesh(geo, pattern);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -Math.atan2(dir.x, dir.z);
    mesh.position.set(start.x, 0.04, start.z);
    this.group.add(mesh);

    const gate = new THREE.Mesh(
      new THREE.BoxGeometry(this.halfWidth * 2 + 3, 2.2, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x0a0a10, emissive: 0xff2d92, emissiveIntensity: 0.8 }),
    );
    gate.position.set(start.x, 2.6, start.z);
    gate.rotation.y = Math.atan2(dir.x, dir.z);
    this.group.add(gate);
  }

  _buildBuildings() {
    const rng = this._mulberry(42);
    const buildingMatCache = new Map();
    const N = 14;
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const cen = this.curve.getPointAt(t);
      const off = CONFIG.track.halfWidth + 10 + rng() * 22;
      const side = rng() > 0.5 ? 1 : -1;
      const dims = {
        w: 12 + rng() * 14,
        h: 16 + rng() * 34,
        d: 12 + rng() * 14,
      };
      const key = Math.round(dims.h / 6);
      let mat = buildingMatCache.get(key);
      if (!mat) {
        const tex = makeBuildingWindows(dims.h);
        const newMat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 0.6 });
        mat = newMat;
        buildingMatCache.set(key, newMat);
      }
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(dims.w, dims.h, dims.d), mat);
      mesh.position.set(cen.x + (side === 1 ? dims.w / 2 + off : -dims.w / 2 - off), dims.h / 2, cen.z + (rng() - 0.5) * 8);
      mesh.rotation.y = rng() * Math.PI;
      this.group.add(mesh);
    }
  }

  _buildNeonSigns() {
    const signTemplates = [
      { text: 'NEON', color: 0xff2d92 },
      { text: 'DRIFT', color: 0x00e5ff },
      { text: 'NITRO', color: 0x7c4dff },
      { text: '24/7', color: 0x27ff9a },
      { text: 'CAFE', color: 0xffc400 },
      { text: 'GARAGE', color: 0xff6b1a },
      { text: 'SPEED', color: 0xff2d92 },
      { text: 'RACER', color: 0x00e5ff },
    ];
    const N = 8;
    for (let i = 0; i < N; i++) {
      const t = (i / N + 0.03) % 1;
      const cen = this.curve.getPointAt(t);
      const off = CONFIG.track.halfWidth + 5;
      const side = i % 2 === 0 ? 1 : -1;
      const tmpl = signTemplates[i % signTemplates.length];
      const sign = buildNeonSign(tmpl.text, tmpl.color);
      sign.position.set(cen.x + side * off, 7 + (i % 3) * 3.5, cen.z);
      sign.rotation.y = side === 1 ? Math.atan2(this.tangentAt(t).x, this.tangentAt(t).z) : Math.atan2(-this.tangentAt(t).x, -this.tangentAt(t).z);
      this.group.add(sign);
      this.neons.push(sign);
    }
  }

  _buildStreetLights() {
    const N = 10;
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const cen = this.curve.getPointAt(t);
      const off = CONFIG.track.halfWidth + 0.6;
      for (const side of [1, -1]) {
        const group = new THREE.Group();
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.16, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0x333344, metalness: 0.8, roughness: 0.4 }),
        );
        pole.position.y = 4;
        group.add(pole);
        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.5, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xffffff }),
        );
        head.position.set(0, 8.2, 0);
        group.add(head);
        const dir = this.tangentAt(t);
        group.position.set(cen.x + dir.z * off * side, 0, cen.z - dir.x * off * side);
        this.group.add(group);
      }
    }
  }

  // Deterministic PRNG so neon/buildings don't shuffle per frame.
  _mulberry(seed) {
    let a = seed;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
}