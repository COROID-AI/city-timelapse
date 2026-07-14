import * as THREE from 'three';
import type { EraConfig, SceneModule, SceneState } from '../types';
import { ERA_LIST } from '../config/eras';
import { lerpN, smoothstep } from '../util/math';
import { lerpColorInto } from '../util/color';

// Block dimensions: a 4x4 grid of building lots separated by roads.
export const BLOCK_SIZE = 100;       // total ground extent (x & z)
export const ROAD_WIDTH = 12;
export const LOTS_PER_AXIS = 4;
export const LOT_SIZE = (BLOCK_SIZE - ROAD_WIDTH * (LOTS_PER_AXIS + 1)) / LOTS_PER_AXIS;

const _c = new THREE.Color();

/**
 * Ground, roads and sidewalks. The base plane colour, road colour and
 * sidewalk colour cross-fade between eras. Lane markings and crosswalks are
 * emissive overlays whose visibility depends on the era (faint in 1945,
 * bright LED in future eras).
 */
export class GroundModule implements SceneModule {
  readonly group = new THREE.Group();

  private readonly groundMat: THREE.MeshStandardMaterial;
  private readonly roadMat: THREE.MeshStandardMaterial;
  private readonly sidewalkMat: THREE.MeshStandardMaterial;
  private readonly markingMat: THREE.MeshBasicMaterial;

  constructor() {
    this.groundMat = new THREE.MeshStandardMaterial({
      color: '#5b5042',
      roughness: 0.96,
      metalness: 0.0
    });
    this.roadMat = new THREE.MeshStandardMaterial({
      color: '#3c382f',
      roughness: 0.92,
      metalness: 0.02
    });
    this.sidewalkMat = new THREE.MeshStandardMaterial({
      color: '#8a8276',
      roughness: 0.88,
      metalness: 0.03
    });
    this.markingMat = new THREE.MeshBasicMaterial({
      color: '#ffe9b0',
      transparent: true,
      opacity: 0.5,
      fog: true
    });

    // Base ground
    const groundGeo = new THREE.PlaneGeometry(400, 400);
    const ground = new THREE.Mesh(groundGeo, this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.group.add(ground);

    // Road network: a grid of roads
    const half = BLOCK_SIZE / 2;
    const span = BLOCK_SIZE + ROAD_WIDTH;
    // Horizontal roads (run along X)
    for (let i = 0; i <= LOTS_PER_AXIS; i++) {
      const z = -half + i * (LOT_SIZE + ROAD_WIDTH) - ROAD_WIDTH / 2;
      const road = new THREE.Mesh(new THREE.PlaneGeometry(span, ROAD_WIDTH), this.roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0, z);
      road.receiveShadow = true;
      this.group.add(road);
    }
    // Vertical roads (run along Z)
    for (let i = 0; i <= LOTS_PER_AXIS; i++) {
      const x = -half + i * (LOT_SIZE + ROAD_WIDTH) - ROAD_WIDTH / 2;
      const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, span), this.roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(x, 0, 0);
      road.receiveShadow = true;
      this.group.add(road);
    }

    // Sidewalks around each lot
    for (let ix = 0; ix < LOTS_PER_AXIS; ix++) {
      for (let iz = 0; iz < LOTS_PER_AXIS; iz++) {
        const cx = lotCenter(ix);
        const cz = lotCenter(iz);
        const sw = LOT_SIZE + 2;
        const swMesh = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.3, sw), this.sidewalkMat);
        swMesh.position.set(cx, 0.15, cz);
        swMesh.receiveShadow = true;
        this.group.add(swMesh);
      }
    }

    // Central dashed lane markings (thin emissive strips)
    const markingsGroup = new THREE.Group();
    const dashGeo = new THREE.PlaneGeometry(1.6, 0.25);
    for (let i = 0; i <= LOTS_PER_AXIS; i++) {
      const z = -half + i * (LOT_SIZE + ROAD_WIDTH) - ROAD_WIDTH / 2;
      for (let x = -half + 4; x < half; x += 6) {
        const dash = new THREE.Mesh(dashGeo, this.markingMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(x, 0.02, z);
        markingsGroup.add(dash);
      }
      const x = -half + i * (LOT_SIZE + ROAD_WIDTH) - ROAD_WIDTH / 2;
      for (let z = -half + 4; z < half; z += 6) {
        const dash = new THREE.Mesh(dashGeo, this.markingMat);
        dash.rotation.x = -Math.PI / 2;
        dash.rotation.z = Math.PI / 2;
        dash.position.set(x, 0.02, z);
        markingsGroup.add(dash);
      }
    }
    this.group.add(markingsGroup);

    this.setEra(ERA_LIST[0]);
  }

  update(dt: number, state: SceneState): void {
    void dt;
    const a = ERA_LIST[state.fromIndex];
    const b = ERA_LIST[state.toIndex];
    const t = smoothstep(state.progress);
    lerpColorInto(a.groundColor, b.groundColor, t, this.groundMat.color);
    lerpColorInto(a.roadColor, b.roadColor, t, this.roadMat.color);
    lerpColorInto(a.sidewalkColor, b.sidewalkColor, t, this.sidewalkMat.color);
    // Lane markings become brighter/whiter in modern eras
    const modern = lerpN(a.year > 2000 ? 1 : 0.35, b.year > 2000 ? 1 : 0.35, t);
    this.markingMat.opacity = 0.25 + 0.4 * modern;
    lerpColorInto('#e8d8a0', '#ffffff', modern, _c);
    this.markingMat.color.copy(_c);
  }

  setEra(config: EraConfig): void {
    this.groundMat.color.set(config.groundColor).convertSRGBToLinear();
    this.roadMat.color.set(config.roadColor).convertSRGBToLinear();
    this.sidewalkMat.color.set(config.sidewalkColor).convertSRGBToLinear();
  }

  dispose(): void {
    this.groundMat.dispose();
    this.roadMat.dispose();
    this.sidewalkMat.dispose();
    this.markingMat.dispose();
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
}

/** X/Z centre coordinate for a lot index (0..LOTS_PER_AXIS-1). */
export function lotCenter(i: number): number {
  const half = BLOCK_SIZE / 2;
  return -half + ROAD_WIDTH + LOT_SIZE / 2 + i * (LOT_SIZE + ROAD_WIDTH);
}
