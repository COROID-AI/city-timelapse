import * as THREE from 'three';
import { WORLD } from '../core/constants.js';

// Ambient + hemisphere + a single shadow-casting directional light, reconfigured per era.
export class LightingManager {
  constructor(scene) {
    this.scene = scene;
    this.ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
    this.scene.add(this.hemi);
    this.dir = new THREE.DirectionalLight(0xffffff, 1.0);
    this.dir.castShadow = true;
    this.dir.shadow.mapSize.set(2048, 2048);
    const s = WORLD.half;
    this.dir.shadow.camera.left = -s;
    this.dir.shadow.camera.right = s;
    this.dir.shadow.camera.top = s;
    this.dir.shadow.camera.bottom = -s;
    this.dir.shadow.camera.near = 1;
    this.dir.shadow.camera.far = 400;
    this.dir.shadow.bias = -0.0004;
    this.dir.shadow.normalBias = 0.04;
    this.scene.add(this.dir);
    this.scene.add(this.dir.target);
  }

  apply(era) {
    const l = era.light;
    this.ambient.color.set(l.ambientColor);
    this.ambient.intensity = l.ambient;
    this.hemi.color.set(l.hemiSky);
    this.hemi.groundColor.set(l.hemiGround);
    this.hemi.intensity = l.hemi;
    this.dir.color.set(l.dirColor);
    this.dir.intensity = l.dir;
    this.dir.position.set(...l.dirPos);
    this.dir.target.position.set(0, 0, 0);
    this.dir.target.updateMatrixWorld();
  }
}
