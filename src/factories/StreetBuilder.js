import * as THREE from 'three';
import { WORLD, ROAD_HALF, BLOCK_INNER, COLORS } from '../core/constants.js';
import { makeAsphalt, makeSidewalk, makeGround } from '../utils/canvasTextures.js';

// Builds the static ground, roads, sidewalks and lane markings. Shared across
// eras but tinted per-era, so it lives outside the per-era content groups and
// the transition manager recolors it. Returns the group + the tintable meshes.
export class StreetBuilder {
  constructor(era) {
    this.era = era;
    this.group = new THREE.Group();
    this.tintables = []; // meshes whose color we recolor on era change
    this._build();
  }

  _build() {
    const H = WORLD.half;
    const rw = WORLD.roadWidth;

    // Ground base
    const groundMat = new THREE.MeshStandardMaterial({
      map: makeGround(),
      color: 0xffffff,
      roughness: 1,
      metalness: 0,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(H * 2, H * 2), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.group.add(ground);

    // Asphalt crossroads (two strips)
    const asphalt = makeAsphalt();
    const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, color: 0xffffff, roughness: 0.95 });
    const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(rw, H * 2), roadMat);
    roadNS.rotation.x = -Math.PI / 2;
    roadNS.position.y = 0.01;
    roadNS.receiveShadow = true;
    this.group.add(roadNS);
    const roadEW = roadNS.clone();
    roadEW.rotation.z = Math.PI / 2;
    roadEW.material = roadMat;
    this.group.add(roadEW);

    // Center double-yellow lines along each road
    const lineMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(COLORS.asphaltLine), emissive: new THREE.Color(COLORS.asphaltLine), emissiveIntensity: 0.05, roughness: 0.6 });
    const lineNSa = new THREE.Mesh(new THREE.PlaneGeometry(0.3, H * 2), lineMat);
    lineNSa.rotation.x = -Math.PI / 2;
    lineNSa.position.set(-0.45, 0.02, 0);
    this.group.add(lineNSa);
    const lineNSb = lineNSa.clone(); lineNSb.position.x = 0.45; this.group.add(lineNSb);
    const lineEWa = new THREE.Mesh(new THREE.PlaneGeometry(H * 2, 0.3), lineMat);
    lineEWa.rotation.x = -Math.PI / 2;
    lineEWa.position.set(0, 0.02, -0.45);
    this.group.add(lineEWa);
    const lineEWb = lineEWa.clone(); lineEWb.position.z = 0.45; this.group.add(lineEWb);

    // Sidewalks: 4 strips around the crossroads
    const swMat = new THREE.MeshStandardMaterial({ map: makeSidewalk(), color: 0xffffff, roughness: 0.9 });
    const sw = WORLD.sidewalkWidth;
    const mk = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, d), swMat);
      m.position.set(x, 0.2, z);
      m.receiveShadow = true;
      this.group.add(m);
    };
    // along NS road, both sides, full length
    mk(sw * 2, H * 2, ROAD_HALF + sw, 0);
    mk(sw * 2, H * 2, -(ROAD_HALF + sw), 0);
    mk(H * 2, sw * 2, 0, ROAD_HALF + sw);
    mk(H * 2, sw * 2, 0, -(ROAD_HALF + sw));
  }
}
