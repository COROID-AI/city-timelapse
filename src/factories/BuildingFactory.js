import * as THREE from 'three';
import { BUILD } from '../core/constants.js';
import { makeFacade, makeRoof } from '../utils/canvasTextures.js';

// Creates a single building as a THREE.Group. Uses ONE shared facade texture
// per era and tiles windows via per-building UV coordinates (no texture cloning),
// keeping memory and GPU upload cost flat regardless of building count.
export class BuildingFactory {
  constructor(era) {
    this.era = era;
    this.b = era.building;
    const src = makeFacade(this.b.style, {
      wall: this.b.palette[0],
      wall2: this.b.palette[1] || this.b.palette[0],
      window: this.b.window,
      frame: this.b.frame,
      neon: this.b.neon,
    });
    this._map = src.map; // shared across all buildings
    this._emissiveMap = src.emissive || null;
    const roofTex = makeRoof(this.b.roofColor);
    roofTex.repeat.set(2, 2);
    this._wallMat = new THREE.MeshStandardMaterial({
      map: this._map,
      color: 0xffffff,
      roughness: 0.72,
      metalness: 0.18,
      emissive: this.b.neon ? new THREE.Color(this.b.neon.color) : new THREE.Color(0x000000),
      emissiveMap: this._emissiveMap,
      emissiveIntensity: this.b.neon ? this.b.neon.intensity : 0,
    });
    this._roofMat = new THREE.MeshStandardMaterial({ map: roofTex, color: 0xffffff, roughness: 0.95, metalness: 0.0 });
    this._bottomMat = new THREE.MeshStandardMaterial({ color: this.b.roofColor, roughness: 0.9 });
    // All 6 face materials reference shared material instances.
    this._mats = [this._wallMat, this._wallMat, this._roofMat, this._bottomMat, this._wallMat, this._wallMat];
    this._geoCache = new Map();
  }

  _boxGeo(w, h, d) {
    const rw = Math.round(w * 2) / 2;
    const rh = Math.round(h);
    const rd = Math.round(d * 2) / 2;
    const key = `${rw}_${rh}_${rd}`;
    let g = this._geoCache.get(key);
    if (!g) {
      g = new THREE.BoxGeometry(rw, rh, rd);
      this._tileUVs(g, rw, rh, rd);
      this._geoCache.set(key, g);
    }
    return g;
  }

  // Scale per-face UVs so the facade tile repeats to match bay/floor counts.
  // BoxGeometry face order: px(0-3) nx(4-7) py(8-11) ny(12-15) pz(16-19) nz(20-23).
  _tileUVs(geo, w, h, d) {
    const uv = geo.attributes.uv;
    const arr = uv.array;
    const tSide = Math.max(1, d / BUILD.bayWidth);
    const tFront = Math.max(1, w / BUILD.bayWidth);
    const tVert = Math.max(1, h / BUILD.floorHeight);
    for (let i = 0; i < 8; i++) { // px + nx
      arr[i * 2] *= tSide;
      arr[i * 2 + 1] *= tVert;
    }
    for (let i = 16; i < 24; i++) { // pz + nz
      arr[i * 2] *= tFront;
      arr[i * 2 + 1] *= tVert;
    }
    uv.needsUpdate = true;
  }

  create(plot, rng) {
    const { x, z, w, d } = plot;
    const height = rng.range(this.b.minHeight, this.b.maxHeight);
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const body = new THREE.Mesh(this._boxGeo(w, height, d), this._mats);
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    this._addRoofDetail(group, w, height, d, rng);

    group.userData.baseHeight = height;
    return group;
  }

  _addRoofDetail(group, w, h, d, rng) {
    const style = this.b.style;
    const roofY = h + 0.4;
    if (style === 'brick') {
      // water tank / chimney
      if (rng.chance(0.5)) {
        const tank = new THREE.Mesh(
          new THREE.CylinderGeometry(1.6, 1.6, 2.4, 10),
          new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 })
        );
        tank.position.set(rng.range(-w / 4, w / 4), roofY + 1.2, rng.range(-d / 4, d / 4));
        tank.castShadow = true;
        group.add(tank);
      }
    } else if (style === 'concrete' || style === 'glassModern' || style === 'mixed') {
      // rooftop mechanical box + parapet
      const box = new THREE.Mesh(
        this._boxGeo(w * 0.3, 2, d * 0.3),
        new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.9 })
      );
      box.position.set(rng.range(-w / 5, w / 5), roofY + 1, rng.range(-d / 5, d / 5));
      box.castShadow = true;
      group.add(box);
      // antenna
      if (rng.chance(0.4)) {
        const ant = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.12, 6, 6),
          new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.6, roughness: 0.4 })
        );
        ant.position.set(w * 0.3, roofY + 3, -d * 0.2);
        group.add(ant);
      }
    } else if (style === 'glass80s') {
      // neon roof sign
      if (rng.chance(0.6)) {
        const c = rng.pick(this.b.neon.colors);
        const sign = new THREE.Mesh(
          this._boxGeo(w * 0.5, 3, 0.4),
          new THREE.MeshStandardMaterial({ color: new THREE.Color(c), emissive: new THREE.Color(c), emissiveIntensity: 1.6, roughness: 0.4 })
        );
        sign.position.set(0, roofY + 1.6, d / 2 - 0.2);
        group.add(sign);
      }
    } else if (style === 'future') {
      // spire + glowing cap
      const spire = new THREE.Mesh(
        new THREE.ConeGeometry(Math.min(w, d) * 0.18, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x0a1320, emissive: new THREE.Color(this.b.neon.color), emissiveIntensity: 0.8, metalness: 0.7, roughness: 0.3 })
      );
      spire.position.set(0, roofY + 4, 0);
      group.add(spire);
      // glowing ring
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(Math.min(w, d) * 0.35, 0.18, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(this.b.neon.color), emissiveIntensity: 1.8 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, roofY + 1, 0);
      group.add(ring);
    }
  }
}
