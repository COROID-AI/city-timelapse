// CityScene: owns the Three.js renderer/scene/camera, builds the block and
// drives era transitions. Everything visual is procedural; this module wires
// the era-interpolation pipeline into the render loop.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ERAS, EraConfig, interpolateEra } from './eras';
import { easeInOutCubic } from './rng';
import { Sky } from './sky';
import { Building } from './buildings';
import { Streetlight } from './streetlights';
import { Vehicle } from './vehicles';
import { Pedestrian } from './pedestrians';
import { makeRoadTexture, makeSidewalkTexture } from './procedural';

const TRANSITION_DURATION = 1.2; // seconds (acceptance: ~1.2s)
const ROAD_HALF = 50;
const ROAD_W = 8;
const SW = 4; // sidewalk half-width

export class CityScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  private readonly scene: THREE.Scene;
  private readonly sky: Sky;
  private readonly sun: THREE.DirectionalLight;
  private readonly ambient: THREE.AmbientLight;
  private readonly hemi: THREE.HemisphereLight;

  private readonly groundMat: THREE.MeshStandardMaterial;
  private readonly roadMat: THREE.MeshStandardMaterial;
  private readonly sidewalkMat: THREE.MeshStandardMaterial;

  private readonly buildings: Building[] = [];
  private readonly streetlights: Streetlight[] = [];
  private readonly vehicles: Vehicle[] = [];
  private readonly pedestrians: Pedestrian[] = [];

  private fromIndex = 0;
  private toIndex = 0;
  private progress = 1; // 0..1; 1 == settled
  private dirty = false; // actors need an era re-apply
  private lastActiveEraIndex = 0;

  private readonly clock = new THREE.Clock();

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xc9b89a, 0.012);

    this.camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );
    this.camera.position.set(46, 34, 58);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 18;
    this.controls.maxDistance = 160;
    this.controls.maxPolarAngle = Math.PI * 0.49; // keep above ground
    this.controls.target.set(0, 8, 0);
    this.controls.update();

    // ── Lights ───────────────────────────────────────────────────────────
    this.ambient = new THREE.AmbientLight(0xb9a987, 0.6);
    this.scene.add(this.ambient);

    this.hemi = new THREE.HemisphereLight(0xbcd0e0, 0x6b5a3c, 0.6);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff1d0, 1.15);
    this.sun.position.set(60, 80, 30);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 400;
    const s = this.sun.shadow.camera as THREE.OrthographicCamera;
    s.left = -80;
    s.right = 80;
    s.top = 80;
    s.bottom = -80;
    s.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // ── Sky ──────────────────────────────────────────────────────────────
    this.sky = new Sky();
    this.scene.add(this.sky.mesh);

    // ── Surfaces ────────────────────────────────────────────────────────
    this.groundMat = new THREE.MeshStandardMaterial({ color: 0x4a4030, roughness: 1 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const roadTex = makeRoadTexture();
    roadTex.repeat.set(ROAD_HALF * 2 / 6, 1);
    this.roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.95 });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, ROAD_W), this.roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    road.receiveShadow = true;
    this.scene.add(road);

    const swTex = makeSidewalkTexture();
    swTex.repeat.set(ROAD_HALF * 2 / 4, SW / 2);
    this.sidewalkMat = new THREE.MeshStandardMaterial({ map: swTex, roughness: 0.9 });
    const swN = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, SW), this.sidewalkMat);
    swN.rotation.x = -Math.PI / 2;
    swN.position.set(0, 0.02, ROAD_W / 2 + SW / 2);
    swN.receiveShadow = true;
    this.scene.add(swN);
    const swS = swN.clone();
    swS.position.z = -(ROAD_W / 2 + SW / 2);
    this.scene.add(swS);

    this.buildBlock();
    this.buildActors();

    // Prime the initial (1945) state instantly.
    this.applyResolved(true);
  }

  private buildBlock(): void {
    const slots = 6;
    const span = ROAD_HALF * 2 - 8;
    const step = span / slots;
    for (let side = 0; side < 2; side++) {
      const south = side === 0;
      const z = south ? -(ROAD_W / 2 + SW + 3.5) : ROAD_W / 2 + SW + 3.5;
      for (let i = 0; i < slots; i++) {
        const x = -ROAD_HALF + 4 + step * (i + 0.5);
        const seed = 1000 + side * 100 + i * 13;
        const width = 9 + ((seed * 7) % 5);
        const depth = 8 + ((seed * 3) % 4);
        const floors = 4 + ((seed * 5) % 7);
        const palette = (side * 2 + i) % 4;
        const b = new Building({
          pos: new THREE.Vector3(x, 0, z),
          width,
          depth,
          floors,
          paletteIndex: palette,
          seed,
          signFace: south ? '+z' : '-z',
        });
        this.buildings.push(b);
        this.scene.add(b.group);
      }
      // Streetlights along this sidewalk.
      for (let i = 0; i < 5; i++) {
        const x = -ROAD_HALF + 10 + (span - 20) * (i / 4);
        const lz = south ? -(ROAD_W / 2 + SW - 0.4) : ROAD_W / 2 + SW - 0.4;
        const lamp = new Streetlight(new THREE.Vector3(x, 0, lz), south ? 1 : -1);
        this.streetlights.push(lamp);
        this.scene.add(lamp.group);
      }
    }
  }

  private buildActors(): void {
    // Vehicles — a mix travelling both directions.
    for (let i = 0; i < 6; i++) {
      const v = new Vehicle(1 + i * 2.71828);
      v.setSpeed(5 + (i % 3) * 1.5);
      this.vehicles.push(v);
      this.scene.add(v.group);
    }
    // Pedestrians on both sidewalks.
    const swZ = [ROAD_W / 2 + SW - 1, -(ROAD_W / 2 + SW - 1)];
    for (let s = 0; s < 2; s++) {
      for (let i = 0; i < 4; i++) {
        const p = new Pedestrian(200 + s * 50 + i * 3.14159, swZ[s]);
        p.setSpeed(0.9 + (i % 3) * 0.35);
        this.pedestrians.push(p);
        this.scene.add(p.group);
      }
    }
  }

  /** Begin an animated transition to the given era index (0..4). */
  transitionTo(index: number): void {
    this.fromIndex = this.toIndex;
    this.toIndex = THREE.MathUtils.clamp(index, 0, ERAS.length - 1);
    this.progress = 0;
    this.dirty = true;
  }

  get currentIndex(): number {
    return this.toIndex;
  }

  /** Returns the current resolved (possibly mid-transition) era. */
  private resolvedEra(): EraConfig {
    if (this.fromIndex === this.toIndex || this.progress >= 1) {
      return ERAS[this.toIndex];
    }
    const t = easeInOutCubic(THREE.MathUtils.clamp(this.progress, 0, 1));
    return interpolateEra(ERAS[this.fromIndex], ERAS[this.toIndex], t);
  }

  /** Apply the continuous + discrete era state. `prime` skips the actor-dirty guard. */
  private applyResolved(prime: boolean): void {
    const era = this.resolvedEra();

    // Sky + fog
    this.sky.applyEra(era);
    (this.scene.fog as THREE.FogExp2).color.setHex(era.fog);
    (this.scene.fog as THREE.FogExp2).density = era.fogDensity;
    this.renderer.setClearColor(era.skyBottom, 1);

    // Lights
    this.sun.color.setHex(era.sunColor);
    this.sun.intensity = era.sunIntensity;
    this.sun.position.set(era.sunPos[0], era.sunPos[1], era.sunPos[2]);
    this.ambient.color.setHex(era.ambient);
    this.ambient.intensity = era.ambientIntensity;
    this.hemi.color.setHex(era.hemiSky);
    this.hemi.groundColor.setHex(era.hemiGround);
    this.hemi.intensity = era.hemiIntensity;

    // Surfaces
    this.groundMat.color.setHex(era.ground);
    this.roadMat.color.setHex(era.road);
    this.sidewalkMat.color.setHex(era.sidewalk);

    // Buildings — continuous every call.
    for (const b of this.buildings) b.applyEraContinuous(era);
    for (const l of this.streetlights) l.applyEra(era);

    // Discrete signage + actors only when transitioning (or priming).
    const activeIndex = this.progress < 0.5 ? this.fromIndex : this.toIndex;
    const activeEra = ERAS[activeIndex];
    if (prime || this.dirty || activeIndex !== this.lastActiveEraIndex) {
      this.lastActiveEraIndex = activeIndex;
      for (const b of this.buildings) b.applyEraDiscrete(activeEra);
    }

    if (prime || this.dirty) {
      const from = ERAS[this.fromIndex];
      const to = ERAS[this.toIndex];
      const t = this.progress >= 1 ? 1 : THREE.MathUtils.clamp(this.progress, 0, 1);
      for (const v of this.vehicles) v.setEra(from, to, t);
      for (const p of this.pedestrians) p.setEra(from, to, t);
    }
  }

  /** Per-frame update; call from the RAF loop. */
  update(): void {
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.progress < 1) {
      this.progress = Math.min(1, this.progress + dt / TRANSITION_DURATION);
    }

    this.applyResolved(false);

    // Clear the dirty flag once the transition has fully settled.
    if (this.progress >= 1 && this.dirty) {
      this.fromIndex = this.toIndex;
      this.dirty = false;
    }

    for (const v of this.vehicles) v.update(dt);
    for (const p of this.pedestrians) p.update(dt);

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose(): void {
    for (const b of this.buildings) b.dispose();
    for (const l of this.streetlights) l.dispose();
    for (const v of this.vehicles) v.dispose();
    this.sky.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
