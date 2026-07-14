import * as THREE from 'three';
import { ERAS, ERA_COUNT, type EraConfig } from '../config/eras';
import { Sky } from './Sky';
import { buildCityBuildings, type BuildingInfo } from './Buildings';
import { buildVehicles, buildPedestrians, buildGround, type Vehicle, type Pedestrian } from './Entities';
import { clamp } from '../utils/math';

// ============================================================================
// CityScene — owns the Three.js scene graph and orchestrates the ~1.4s
// crossfade between eras. Builds era groups (buildings/vehicles/peds/ground)
// and swaps them with opacity fades. Exposes per-frame update + raycast.
// ============================================================================

interface EraGroup {
  buildings: THREE.Group;
  vehicles: THREE.Group;
  pedestrians: THREE.Group;
  ground: THREE.Group;
  vehicleList: Vehicle[];
  pedList: Pedestrian[];
  buildingInfos: { mesh: THREE.Object3D; info: BuildingInfo }[];
}

export class CityScene {
  readonly scene: THREE.Scene;
  readonly sky: Sky;

  private eraGroups: EraGroup[] = [];
  private currentEra = 0;
  private prevEra = 0;
  private transT = 1;
  private transDur = 1.4;
  private transStart = 0;
  private transitioning = false;

  // For continuous sky/env interpolation we hold target era
  private targetEra = 0;

  constructor(renderer: THREE.WebGLRenderer) {
    this.scene = new THREE.Scene();
    const first = ERAS[0];
    this.scene.fog = new THREE.Fog(first.env.fogColor, first.env.fogNear, first.env.fogFar);

    this.sky = new Sky(first.env);
    this.scene.add(this.sky.group);

    // sun shadow camera config
    const sun = this.sky.sunLight;
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 300;
    const sc = sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -60;
    sc.right = 60;
    sc.top = 60;
    sc.bottom = -60;
    sun.shadow.bias = -0.0005;

    // Build all 6 era groups upfront (hidden except current)
    for (let i = 0; i < ERA_COUNT; i++) {
      const eg = this.buildEraGroup(ERAS[i], i);
      this.setSceneOpacity(eg, i === 0 ? 1 : 0);
      eg.buildings.visible = i === 0;
      eg.vehicles.visible = i === 0;
      eg.pedestrians.visible = i === 0;
      eg.ground.visible = i === 0;
      this.scene.add(eg.buildings, eg.vehicles, eg.pedestrians, eg.ground);
      this.eraGroups.push(eg);
    }

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = first.env.exposure;
  }

  private buildEraGroup(era: EraConfig, eraIndex: number): EraGroup {
    const { group: buildings, buildings: buildingInfos } = buildCityBuildings(era, eraIndex);
    const vehicles = buildVehicles(era, eraIndex);
    const pedestrians = buildPedestrians(era, eraIndex);
    const ground = buildGround(era);

    const vehicleList: Vehicle[] = (vehicles.userData.vehicles as Vehicle[]) || [];
    const pedList: Pedestrian[] = (pedestrians.userData.pedestrians as Pedestrian[]) || [];

    return { buildings, vehicles, pedestrians, ground, vehicleList, pedList, buildingInfos };
  }

  get eraIndex(): number {
    return this.currentEra;
  }

  get isTransitioning(): boolean {
    return this.transitioning;
  }

  get transitionProgress(): number {
    return this.transT;
  }

  // Switch to a new era with crossfade
  setEra(index: number, immediate = false): void {
    const target = clamp(index, 0, ERA_COUNT - 1);
    if (target === this.currentEra && !immediate) return;
    this.prevEra = this.currentEra;
    this.targetEra = target;
    if (immediate) {
      this.finishImmediate(target);
      return;
    }
    this.currentEra = target;
    this.transT = 0;
    this.transitioning = true;
    this.transStart = performance.now() / 1000;

    // show target group
    const eg = this.eraGroups[target];
    eg.buildings.visible = true;
    eg.vehicles.visible = true;
    eg.pedestrians.visible = true;
    eg.ground.visible = true;

    // start sky transition
    this.sky.transitionTo(ERAS[target].env);
  }

  private finishImmediate(target: number): void {
    const prev = this.eraGroups[this.currentEra];
    this.setSceneOpacity(prev, 0);
    prev.buildings.visible = false;
    prev.vehicles.visible = false;
    prev.pedestrians.visible = false;
    prev.ground.visible = false;

    const eg = this.eraGroups[target];
    eg.buildings.visible = true;
    eg.vehicles.visible = true;
    eg.pedestrians.visible = true;
    eg.ground.visible = true;
    this.setSceneOpacity(eg, 1);

    this.currentEra = target;
    this.transitioning = false;
    this.transT = 1;
    this.sky.transitionTo(ERAS[target].env);
    // snap sky
    this.sky.update(performance.now() / 1000 + 10);
  }

  update(dt: number, now: number, renderer: THREE.WebGLRenderer): void {
    // transition crossfade
    if (this.transitioning) {
      const elapsed = now - this.transStart;
      this.transT = clamp(elapsed / this.transDur, 0, 1);
      const e = this.transT * this.transT * (3 - 2 * this.transT);
      const prev = this.eraGroups[this.prevEra];
      const cur = this.eraGroups[this.currentEra];
      this.setSceneOpacity(prev, 1 - e);
      this.setSceneOpacity(cur, e);

      if (this.transT >= 1) {
        prev.buildings.visible = false;
        prev.vehicles.visible = false;
        prev.pedestrians.visible = false;
        prev.ground.visible = false;
        this.transitioning = false;
      }
    }

    // sky/env interpolation
    this.sky.update(now);
    const env = this.sky.currentEnv;
    const fog = this.scene.fog as THREE.Fog;
    if (fog) {
      fog.color.set(env.fogColor);
      fog.near = env.fogNear;
      fog.far = env.fogFar;
    }
    renderer.toneMappingExposure = env.exposure;

    // animate vehicles + pedestrians for ALL visible era groups
    for (let i = 0; i < this.eraGroups.length; i++) {
      const eg = this.eraGroups[i];
      if (!eg.vehicles.visible) continue;
      const factor = this.groupOpacity(eg);
      if (factor <= 0.001) continue;
      const time = now;
      for (const v of eg.vehicleList) v.update(dt, time);
      for (const p of eg.pedList) p.update(dt, time);
    }
  }

  // Raycast against current era's building bodies
  raycastBuilding(raycaster: THREE.Raycaster): { mesh: THREE.Object3D; info: BuildingInfo } | null {
    const eg = this.eraGroups[this.currentEra];
    const meshes: THREE.Object3D[] = [];
    eg.buildings.traverse((o) => {
      if (o.userData.isBuilding && o instanceof THREE.Mesh) meshes.push(o);
    });
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;
    // climb to the group with buildingInfo
    let obj: THREE.Object3D | null = hits[0].object;
    while (obj && !obj.userData.buildingInfo) obj = obj.parent;
    if (obj && obj.userData.buildingInfo) {
      return { mesh: obj, info: obj.userData.buildingInfo as BuildingInfo };
    }
    return null;
  }

  // ---- opacity helpers ----------------------------------------------------
  private setSceneOpacity(eg: EraGroup, opacity: number): void {
    eg.buildings.traverse((o) => this.setMatOpacity(o, opacity));
    eg.vehicles.traverse((o) => this.setMatOpacity(o, opacity));
    eg.pedestrians.traverse((o) => this.setMatOpacity(o, opacity));
    eg.ground.traverse((o) => this.setMatOpacity(o, opacity));
  }

  private groupOpacity(_eg: EraGroup): number {
    return this.transitioning
      ? this.currentEra === this.eraGroups.indexOf(_eg)
        ? this.transT
        : 1 - this.transT
      : 1;
  }

  private setMatOpacity(obj: THREE.Object3D, opacity: number): void {
    const m = obj as THREE.Mesh;
    if (m.material) {
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) {
        for (const mm of mat) {
          (mm as THREE.Material).transparent = true;
          ((mm as any).opacity) = opacity;
        }
      } else {
        (mat as any).transparent = true;
        (mat as any).opacity = opacity;
      }
    }
  }
}
