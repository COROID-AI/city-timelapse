import * as THREE from 'three';

import type { EraId, EraSpec } from './eras';

/** The scene systems owned by the procedural city block. */
export interface CityWorld {
  readonly transitionProgress: number;
  readonly selectedEraId: EraId;
  readonly qualityTier: CityQualityTier;
  updateEra(era: EraSpec): void;
  update(deltaSeconds: number): void;
  dispose(): void;
}

/** Density preset used to keep the camera responsive on constrained devices. */
export type CityQualityTier = 'high' | 'balanced' | 'low';

export interface CityWorldOptions {
  qualityTier?: CityQualityTier;
  reducedMotion?: boolean;
}

type Side = -1 | 1;

interface BuildingRecord {
  readonly shell: THREE.Mesh;
  readonly windows: THREE.InstancedMesh;
  readonly interiors: THREE.InstancedMesh;
  readonly storefront: THREE.Group;
  readonly storefrontPanel: THREE.Mesh;
  readonly display: THREE.Mesh;
  readonly door: THREE.Mesh;
  readonly awning: THREE.Mesh;
  readonly sign: SignRecord;
  readonly billboard: SignRecord;
  readonly x: number;
  readonly z: number;
  readonly side: Side;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
}

interface SignRecord {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshStandardMaterial;
  readonly canvas: HTMLCanvasElement;
  readonly texture: THREE.CanvasTexture;
  readonly width: number;
  readonly height: number;
  readonly kind: 'storefront' | 'advertisement';
  readonly index: number;
}

interface VehicleRecord {
  readonly group: THREE.Group;
  readonly body: THREE.Mesh;
  readonly window: THREE.Mesh;
  readonly roof: THREE.Mesh;
  readonly wheels: THREE.Mesh[];
  readonly light: THREE.Mesh;
  readonly lane: number;
  readonly seed: number;
  z: number;
}

interface PedestrianRecord {
  readonly group: THREE.Group;
  readonly body: THREE.Mesh;
  readonly head: THREE.Mesh;
  readonly leftLeg: THREE.Mesh;
  readonly rightLeg: THREE.Mesh;
  readonly leftArm: THREE.Mesh;
  readonly rightArm: THREE.Mesh;
  readonly side: Side;
  readonly seed: number;
  z: number;
  readonly baseX: number;
}

interface VisualProfile {
  readonly heightScale: number;
  readonly widthScale: number;
  readonly windowColor: string;
  readonly trimColor: string;
  readonly roadColor: string;
  readonly vehicleStyle: 'postwar' | 'modernist' | 'neon' | 'digital' | 'electric' | 'autonomous';
  readonly pedestrianScale: number;
  readonly foliageColor: string;
  readonly lampColor: string;
  readonly signageGlow: number;
}

interface EraVisualState {
  readonly era: EraSpec;
  readonly profile: VisualProfile;
  readonly buildingColors: THREE.Color[];
  readonly populationColors: THREE.Color[];
  readonly vehicleColors: THREE.Color[];
  readonly accent: THREE.Color;
  readonly windowColor: THREE.Color;
  readonly interiorColor: THREE.Color;
  readonly roadColor: THREE.Color;
  readonly foliageColor: THREE.Color;
  readonly lampColor: THREE.Color;
  readonly sky: THREE.Color;
  readonly fog: THREE.Color;
  readonly buildingDensity: number;
  readonly fogDensity: number;
}

const BUILDING_SITES = [
  { x: -7.9, z: -5.9, side: 1 as Side, width: 4.8, depth: 5.0, height: 5.4 },
  { x: -7.7, z: 0.9, side: 1 as Side, width: 5.0, depth: 5.0, height: 6.2 },
  { x: -7.5, z: 6.7, side: 1 as Side, width: 4.7, depth: 4.0, height: 4.7 },
  { x: 7.9, z: -5.7, side: -1 as Side, width: 4.8, depth: 5.0, height: 6.0 },
  { x: 7.7, z: 0.9, side: -1 as Side, width: 5.0, depth: 5.0, height: 5.2 },
  { x: 7.5, z: 6.6, side: -1 as Side, width: 4.7, depth: 4.0, height: 7.0 },
] as const;

const PALETTE_COLORS: Record<string, string> = {
  ink: '#20252c',
  cream: '#e6d7b9',
  'signal red': '#c7493f',
  'petrol blue': '#1d526b',
  'sun yellow': '#e4b64d',
  'warm white': '#f3e9d3',
  cobalt: '#3154a3',
  magenta: '#c74489',
  'concrete grey': '#8e9398',
  graphite: '#38434c',
  'electric blue': '#37a9d7',
  lime: '#a6bc55',
  slate: '#53636d',
  amber: '#dc9853',
  'digital cyan': '#52d5da',
  'deep violet': '#4a3475',
  'solar gold': '#e9bd58',
  'holographic cyan': '#82e9e1',
};

const MATERIAL_COLORS: Record<string, string> = {
  'red brick': '#7d473d',
  'cast iron': '#303438',
  timber: '#826147',
  'exposed concrete': '#8b8f8d',
  chrome: '#aab8ba',
  'colored glass': '#2f6d7e',
  'reflective glass': '#477083',
  'pink granite': '#9d6666',
  'painted steel': '#445268',
  'curtain wall glass': '#3c6574',
  'galvanized steel': '#84949a',
  'painted render': '#ac947d',
  'low-iron glass': '#7aa4a3',
  'recycled brick': '#895c4a',
  'cross-laminated timber': '#b0835e',
  'bio-ceramic': '#748d96',
  'photovoltaic glass': '#274e72',
  'living canopy': '#426a55',
};

const ROAD_COLORS: Record<string, string> = {
  asphalt: '#1a2025',
  patched: '#252a2b',
  'permeable paving': '#4d5651',
  'water-sensitive': '#3c5558',
};

const smoothStep = (value: number): number => {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

const tokenColor = (token: string, fallback: string): THREE.Color => {
  const normalized = token.trim().toLowerCase();
  const value = PALETTE_COLORS[normalized] ?? MATERIAL_COLORS[normalized] ?? fallback;
  const cssColor = value.startsWith('#') ? value : `#${value}`;
  return new THREE.Color(cssColor);
};

const configColor = (token: string, fallback: string): THREE.Color => tokenColor(token, fallback);

const canvasColor = (token: string, fallback: string): string => {
  const normalized = token.trim().toLowerCase();
  return PALETTE_COLORS[normalized] ?? MATERIAL_COLORS[normalized] ?? (token.startsWith('#') ? token : fallback);
};

const averageColors = (tokens: readonly string[], fallback: string): THREE.Color => {
  if (tokens.length === 0) return new THREE.Color(fallback);
  const result = new THREE.Color(0, 0, 0);
  tokens.forEach((token) => result.add(tokenColor(token, fallback)));
  return result.multiplyScalar(1 / tokens.length);
};

const styleForEra = (era: EraSpec): VisualProfile => {
  switch (era.id) {
    case '1945':
      return {
        heightScale: 0.88,
        widthScale: 0.98,
        windowColor: '#d7b276',
        trimColor: '#9f4739',
        roadColor: '#252a2b',
        vehicleStyle: 'postwar',
        pedestrianScale: 0.93,
        foliageColor: '#3e5b46',
        lampColor: '#ffbd78',
        signageGlow: 0.45,
      };
    case '1965':
      return {
        heightScale: 0.98,
        widthScale: 1.02,
        windowColor: '#73a8b1',
        trimColor: '#e2ac46',
        roadColor: '#20272a',
        vehicleStyle: 'modernist',
        pedestrianScale: 0.98,
        foliageColor: '#52734e',
        lampColor: '#ffe3a0',
        signageGlow: 0.75,
      };
    case '1985':
      return {
        heightScale: 1.07,
        widthScale: 1.03,
        windowColor: '#5269ac',
        trimColor: '#d13d86',
        roadColor: '#151b24',
        vehicleStyle: 'neon',
        pedestrianScale: 1,
        foliageColor: '#3d604e',
        lampColor: '#e975da',
        signageGlow: 1.35,
      };
    case '2005':
      return {
        heightScale: 1.16,
        widthScale: 1.05,
        windowColor: '#6092a8',
        trimColor: '#79a7bd',
        roadColor: '#1b2329',
        vehicleStyle: 'digital',
        pedestrianScale: 1.02,
        foliageColor: '#4f7359',
        lampColor: '#a7d7e6',
        signageGlow: 1.05,
      };
    case '2025':
      return {
        heightScale: 1.22,
        widthScale: 1.08,
        windowColor: '#4f7e86',
        trimColor: '#46b5ae',
        roadColor: '#304348',
        vehicleStyle: 'electric',
        pedestrianScale: 1.04,
        foliageColor: '#5b8c60',
        lampColor: '#a7f0d1',
        signageGlow: 0.95,
      };
    case '2055':
      return {
        heightScale: 1.34,
        widthScale: 1.1,
        windowColor: '#5175a1',
        trimColor: '#82e9e1',
        roadColor: '#3c5558',
        vehicleStyle: 'autonomous',
        pedestrianScale: 1.08,
        foliageColor: '#548b71',
        lampColor: '#8be8ff',
        signageGlow: 1.55,
      };
  }
};

class ProceduralCityWorld implements CityWorld {
  readonly root = new THREE.Group();
  get selectedEraId(): EraId { return this.targetState.era.id; }

  private readonly scene: THREE.Scene;
  readonly qualityTier: CityQualityTier;
  private readonly buildingGroup = new THREE.Group();
  private readonly streetGroup = new THREE.Group();
  private readonly vehicleGroup = new THREE.Group();
  private readonly pedestrianGroup = new THREE.Group();
  private readonly foliageGroup = new THREE.Group();
  private readonly lightGroup = new THREE.Group();
  private readonly sharedBox = new THREE.BoxGeometry(1, 1, 1);
  private readonly sharedWindow = new THREE.PlaneGeometry(0.58, 0.78);
  private readonly sharedInterior = new THREE.PlaneGeometry(0.48, 0.64);
  private readonly sharedWheel = new THREE.CylinderGeometry(0.28, 0.28, 0.16, 12);
  private readonly sharedBody = new THREE.CylinderGeometry(0.13, 0.16, 0.72, 8);
  private readonly sharedHead = new THREE.SphereGeometry(0.16, 10, 8);
  private readonly sharedArm = new THREE.CylinderGeometry(0.055, 0.055, 0.46, 6);
  private readonly sharedFoliage = new THREE.IcosahedronGeometry(0.75, 1);
  private readonly sharedTrunk = new THREE.CylinderGeometry(0.11, 0.16, 1.1, 8);
  private readonly sharedLamp = new THREE.SphereGeometry(0.14, 10, 8);
  private readonly sharedMark = new THREE.BoxGeometry(0.09, 0.018, 1.15);
  private readonly sharedStripe = new THREE.BoxGeometry(0.45, 0.022, 0.12);
  private readonly sharedGlassMaterial = new THREE.MeshStandardMaterial({
    color: '#426672',
    roughness: 0.18,
    metalness: 0.25,
  });
  private readonly sharedInteriorMaterial = new THREE.MeshStandardMaterial({
    color: '#bd8553',
    roughness: 0.6,
    emissive: '#2b1710',
    emissiveIntensity: 0.3,
  });
  private readonly buildings: BuildingRecord[] = [];
  private readonly signs: SignRecord[] = [];
  private readonly vehicles: VehicleRecord[] = [];
  private readonly pedestrians: PedestrianRecord[] = [];
  private readonly vehicleLimit: number;
  private readonly pedestrianLimit: number;
  private readonly foliageLimit: number;
  private readonly reducedMotion: boolean;
  private readonly foliageMaterials = new THREE.MeshStandardMaterial({ color: '#4f7359', roughness: 0.92 });
  private readonly trunkMaterial = new THREE.MeshStandardMaterial({ color: '#5b4837', roughness: 0.94 });
  private readonly roadMaterial = new THREE.MeshStandardMaterial({ color: '#1a2025', roughness: 0.9 });
  private readonly laneMaterial = new THREE.MeshStandardMaterial({ color: '#e3c780', roughness: 0.7 });
  private readonly sidewalkMaterial = new THREE.MeshStandardMaterial({ color: '#667077', roughness: 0.85 });
  private readonly groundMaterial = new THREE.MeshStandardMaterial({ color: '#27342f', roughness: 0.94 });
  private readonly sun = new THREE.DirectionalLight('#ffd2a1', 2.8);
  private readonly hemisphere = new THREE.HemisphereLight('#9eb4d3', '#15202d', 1.15);
  private readonly streetLights: THREE.PointLight[] = [];
  private readonly reusableMaterials: THREE.Material[] = [];
  private readonly matrixHelper = new THREE.Object3D();
  private readonly windowTint = new THREE.Color();
  private readonly interiorTint = new THREE.Color();
  private readonly headTint = new THREE.Color();
  private readonly targetBackground = new THREE.Color();
  private readonly targetFog = new THREE.Color();
  private currentState: EraVisualState;
  private targetState: EraVisualState;
  private transitionFrom: EraVisualState;
  private transitionElapsed = 0;
  private readonly transitionDuration: number;
  private readonly maxDelta = 0.08;
  private elapsed = 0;
  private disposed = false;

  constructor(scene: THREE.Scene, initialEra: EraSpec, options: CityWorldOptions = {}) {
    this.scene = scene;
    this.qualityTier = options.qualityTier ?? 'high';
    this.reducedMotion = options.reducedMotion ?? false;
    this.transitionDuration = this.reducedMotion ? 0.08 : 1.6;
    const density = this.qualityTier === 'high' ? 1 : this.qualityTier === 'balanced' ? 0.75 : 0.5;
    this.vehicleLimit = Math.max(3, Math.round(8 * density));
    this.pedestrianLimit = Math.max(8, Math.round(24 * density));
    this.foliageLimit = Math.max(6, Math.round(12 * density));
    this.currentState = this.createState(initialEra);
    this.targetState = this.currentState;
    this.transitionFrom = this.currentState;
    this.root.name = 'Luna procedural city block';
    this.root.add(this.streetGroup, this.buildingGroup, this.vehicleGroup, this.pedestrianGroup, this.foliageGroup, this.lightGroup);
    this.scene.add(this.root);
    this.createStreet();
    this.createBuildings();
    this.createVehicles();
    this.createPedestrians();
    this.createFoliageAndFurniture();
    this.createLighting();
    this.updateSigns(initialEra);
    this.applyState(this.currentState, this.currentState, 1);
  }

  get transitionProgress(): number {
    return THREE.MathUtils.clamp(this.transitionElapsed / this.transitionDuration, 0, 1);
  }

  updateEra(era: EraSpec): void {
    if (this.disposed || era.id === this.targetState.era.id) return;

    // Scrubbing can interrupt an in-flight transition. Capture the actual
    // interpolated scene first so the next transition starts from what the
    // visitor sees rather than from a stale era snapshot.
    if (this.currentState.era.id !== this.targetState.era.id) {
      const progress = smoothStep(this.transitionProgress);
      this.applyState(this.transitionFrom, this.targetState, progress);
      this.currentState = this.blendState(this.transitionFrom, this.targetState, progress);
    }
    this.transitionFrom = this.currentState;
    this.targetState = this.createState(era);
    this.transitionElapsed = 0;
    this.updateSigns(era);
    this.updatePedestrianTargets(this.transitionFrom, this.targetState, 0);
    this.updateVehicleTargets(this.transitionFrom, this.targetState, 0);
  }

  update(deltaSeconds: number): void {
    if (this.disposed) return;
    const delta = THREE.MathUtils.clamp(deltaSeconds, 0, this.maxDelta);
    this.elapsed += delta;
    if (this.currentState.era.id !== this.targetState.era.id) {
      this.transitionElapsed = Math.min(this.transitionDuration, this.transitionElapsed + delta);
      const progress = smoothStep(this.transitionProgress);
      this.applyState(this.transitionFrom, this.targetState, progress);
      if (this.transitionProgress >= 1) this.currentState = this.targetState;
    }
    this.animateVehicles(delta);
    this.animatePedestrians(delta);
    this.animateLights();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.scene.fog = null;
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh && object.geometry !== this.sharedBox) object.geometry.dispose();
    });
    this.signs.forEach((sign) => {
      sign.texture.dispose();
      sign.material.dispose();
    });
    this.reusableMaterials.forEach((material) => material.dispose());
    this.sharedBox.dispose();
    this.sharedWindow.dispose();
    this.sharedInterior.dispose();
    this.sharedWheel.dispose();
    this.sharedBody.dispose();
    this.sharedHead.dispose();
    this.sharedArm.dispose();
    this.sharedFoliage.dispose();
    this.sharedTrunk.dispose();
    this.sharedLamp.dispose();
    this.sharedMark.dispose();
    this.sharedStripe.dispose();
  }

  private createState(era: EraSpec): EraVisualState {
    const profile = styleForEra(era);
    const materials = era.config.world.materials;
    const buildingColors = BUILDING_SITES.map((_, index) => tokenColor(materials[index % Math.max(1, materials.length)] ?? 'render', '#6e7374'));
    const palette = era.config.population.palette;
    const accent = averageColors(palette, profile.trimColor);
    const populationColors = Array.from({ length: 24 }, (_, index) => tokenColor(palette[index % Math.max(1, palette.length)] ?? '#53636d', '#53636d'));
    const windowColor = tokenColor(profile.windowColor, '#476d78');
    const interiorColor = averageColors([profile.lampColor, ...palette], '#bb8757');
    const roadToken = era.config.world.roadSurface.toLowerCase();
    const roadKey = Object.keys(ROAD_COLORS).find((key) => roadToken.includes(key)) ?? 'asphalt';
    return {
      era,
      profile,
      buildingColors,
      populationColors,
      vehicleColors: populationColors.map((color) => color.clone()),
      accent: tokenColor(profile.trimColor, accent.getHexString()),
      windowColor,
      interiorColor,
      roadColor: tokenColor(ROAD_COLORS[roadKey] ?? '#1a2025', '#1a2025'),
      foliageColor: tokenColor(profile.foliageColor, '#4f7359'),
      lampColor: tokenColor(profile.lampColor, '#ffcf8a'),
      sky: configColor(era.config.atmosphere.sky, '#152844'),
      fog: configColor(era.config.atmosphere.fog, '#617286'),
      buildingDensity: era.config.world.buildingDensity,
      fogDensity: era.config.atmosphere.fogDensity,
    };
  }

  private blendState(from: EraVisualState, to: EraVisualState, progress: number): EraVisualState {
    const t = THREE.MathUtils.clamp(progress, 0, 1);
    const blendColors = (fromColors: readonly THREE.Color[], toColors: readonly THREE.Color[]): THREE.Color[] =>
      toColors.map((color, index) => fromColors[index]?.clone().lerp(color, t) ?? color.clone());
    return {
      era: to.era,
      profile: {
        ...to.profile,
        heightScale: THREE.MathUtils.lerp(from.profile.heightScale, to.profile.heightScale, t),
        widthScale: THREE.MathUtils.lerp(from.profile.widthScale, to.profile.widthScale, t),
        pedestrianScale: THREE.MathUtils.lerp(from.profile.pedestrianScale, to.profile.pedestrianScale, t),
        signageGlow: THREE.MathUtils.lerp(from.profile.signageGlow, to.profile.signageGlow, t),
        vehicleStyle: t < 0.5 ? from.profile.vehicleStyle : to.profile.vehicleStyle,
      },
      buildingColors: blendColors(from.buildingColors, to.buildingColors),
      populationColors: blendColors(from.populationColors, to.populationColors),
      vehicleColors: blendColors(from.vehicleColors, to.vehicleColors),
      accent: from.accent.clone().lerp(to.accent, t),
      windowColor: from.windowColor.clone().lerp(to.windowColor, t),
      interiorColor: from.interiorColor.clone().lerp(to.interiorColor, t),
      roadColor: from.roadColor.clone().lerp(to.roadColor, t),
      foliageColor: from.foliageColor.clone().lerp(to.foliageColor, t),
      lampColor: from.lampColor.clone().lerp(to.lampColor, t),
      sky: from.sky.clone().lerp(to.sky, t),
      fog: from.fog.clone().lerp(to.fog, t),
      buildingDensity: THREE.MathUtils.lerp(from.buildingDensity, to.buildingDensity, t),
      fogDensity: THREE.MathUtils.lerp(from.fogDensity, to.fogDensity, t),
    };
  }

  private createStreet(): void {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 28), this.groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.04;
    ground.receiveShadow = true;
    ground.name = 'contiguous city block ground';
    this.streetGroup.add(ground);

    const road = new THREE.Mesh(new THREE.PlaneGeometry(7, 28), this.roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0;
    road.receiveShadow = true;
    road.name = 'two-way street';
    this.streetGroup.add(road);

    [-5.05, 5.05].forEach((x) => {
      const sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 28), this.sidewalkMaterial);
      sidewalk.rotation.x = -Math.PI / 2;
      sidewalk.position.set(x, 0.035, 0);
      sidewalk.receiveShadow = true;
      this.streetGroup.add(sidewalk);
      const curb = new THREE.Mesh(this.sharedBox, this.sidewalkMaterial);
      curb.position.set(x > 0 ? -3.62 : 3.62, 0.13, 0);
      curb.scale.set(0.18, 0.18, 28);
      curb.receiveShadow = true;
      this.streetGroup.add(curb);
    });

    const laneMarks = new THREE.InstancedMesh(this.sharedMark, this.laneMaterial, 32);
    for (let index = 0; index < 32; index += 1) {
      const lane = index % 2 === 0 ? -1.6 : 1.6;
      this.matrixHelper.position.set(lane, 0.06, -13 + Math.floor(index / 2) * 1.7);
      this.matrixHelper.rotation.set(0, 0, 0);
      this.matrixHelper.scale.set(1, 1, 1);
      this.matrixHelper.updateMatrix();
      laneMarks.setMatrixAt(index, this.matrixHelper.matrix);
    }
    laneMarks.name = 'reused lane markings';
    laneMarks.instanceMatrix.needsUpdate = true;
    this.streetGroup.add(laneMarks);

    const crossing = new THREE.InstancedMesh(this.sharedStripe, this.laneMaterial, 18);
    for (let index = 0; index < 18; index += 1) {
      this.matrixHelper.position.set(-3.1 + (index % 9) * 0.78, 0.07, index < 9 ? -1.2 : 1.2);
      this.matrixHelper.updateMatrix();
      crossing.setMatrixAt(index, this.matrixHelper.matrix);
    }
    crossing.name = 'crosswalk reuse pool';
    crossing.instanceMatrix.needsUpdate = true;
    this.streetGroup.add(crossing);

    const cycleLane = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 28), new THREE.MeshStandardMaterial({ color: '#426b69', roughness: 0.85 }));
    cycleLane.rotation.x = -Math.PI / 2;
    cycleLane.position.set(3.0, 0.075, 0);
    this.streetGroup.add(cycleLane);
    this.reusableMaterials.push(cycleLane.material as THREE.Material);
  }

  private createBuildings(): void {
    BUILDING_SITES.forEach((site, index) => {
      const shellMaterial = new THREE.MeshStandardMaterial({ color: '#777b7b', roughness: 0.74, metalness: 0.04 });
      const shell = new THREE.Mesh(this.sharedBox, shellMaterial);
      shell.castShadow = true;
      shell.receiveShadow = true;
      shell.name = `building shell ${index + 1}`;

      const windows = new THREE.InstancedMesh(this.sharedWindow, this.sharedGlassMaterial, 48);
      const interiors = new THREE.InstancedMesh(this.sharedInterior, this.sharedInteriorMaterial, 48);
      windows.castShadow = false;
      windows.name = `facade windows ${index + 1}`;
      interiors.name = `lit interior cues ${index + 1}`;
      const storefront = this.createStorefront(index);
      const sign = this.createSign('storefront', index);
      const billboard = this.createSign('advertisement', index);
      storefront.add(sign.mesh);
      const billboardGroup = new THREE.Group();
      billboardGroup.name = `advertising board ${index + 1}`;
      billboardGroup.add(billboard.mesh);
      this.buildingGroup.add(shell, windows, interiors, storefront, billboardGroup);
      this.signs.push(sign, billboard);

      const record: BuildingRecord = {
        shell,
        windows,
        interiors,
        storefront,
        storefrontPanel: storefront.children[0] as THREE.Mesh,
        display: storefront.children[1] as THREE.Mesh,
        door: storefront.children[2] as THREE.Mesh,
        awning: storefront.children[3] as THREE.Mesh,
        sign,
        billboard,
        x: site.x,
        z: site.z,
        side: site.side,
        width: site.width,
        depth: site.depth,
        height: site.height,
      };
      this.buildings.push(record);
    });
  }

  private createStorefront(index: number): THREE.Group {
    const group = new THREE.Group();
    group.name = `readable storefront ${index + 1}`;
    const panel = new THREE.Mesh(this.sharedBox, new THREE.MeshStandardMaterial({ color: '#61474a', roughness: 0.54 }));
    const display = new THREE.Mesh(this.sharedBox, new THREE.MeshStandardMaterial({ color: '#26383b', roughness: 0.2, metalness: 0.22 }));
    const door = new THREE.Mesh(this.sharedBox, new THREE.MeshStandardMaterial({ color: '#273137', roughness: 0.3, metalness: 0.24 }));
    const awning = new THREE.Mesh(this.sharedBox, new THREE.MeshStandardMaterial({ color: '#bd7659', roughness: 0.72 }));
    [panel, display, door, awning].forEach((mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      this.reusableMaterials.push(mesh.material as THREE.Material);
    });
    return group;
  }

  private createSign(kind: SignRecord['kind'], index: number): SignRecord {
    const canvas = document.createElement('canvas');
    canvas.width = kind === 'advertisement' ? 768 : 512;
    canvas.height = kind === 'advertisement' ? 256 : 192;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.38, emissive: '#180f0d', emissiveIntensity: 0.45, map: texture });
    const mesh = new THREE.Mesh(this.sharedBox, material);
    mesh.castShadow = true;
    mesh.name = kind === 'advertisement' ? `era advertisement ${index + 1}` : `storefront identity ${index + 1}`;
    const sign: SignRecord = { mesh, material, canvas, texture, width: kind === 'advertisement' ? 2.8 : 2.5, height: kind === 'advertisement' ? 1.05 : 0.62, kind, index };
    this.reusableMaterials.push(material);
    return sign;
  }

  private updateSigns(era: EraSpec): void {
    const motifs = era.config.signage.motifs;
    this.signs.forEach((sign) => {
      const context = sign.canvas.getContext('2d');
      if (!context) return;
      const isAdvertisement = sign.kind === 'advertisement';
      const motif = motifs[sign.index % Math.max(1, motifs.length)] ?? 'neighborhood';
      const next = motifs[(sign.index + 1) % Math.max(1, motifs.length)] ?? motif;
      context.fillStyle = isAdvertisement ? canvasColor(era.config.atmosphere.sky, '#152844') : '#211e22';
      context.fillRect(0, 0, sign.canvas.width, sign.canvas.height);
      context.fillStyle = isAdvertisement
        ? canvasColor(era.config.atmosphere.horizon, '#d38f78')
        : canvasColor(era.config.population.palette[sign.index % Math.max(1, era.config.population.palette.length)] ?? '#e6d7b9', '#e6d7b9');
      context.fillRect(12, 12, sign.canvas.width - 24, sign.canvas.height - 24);
      context.fillStyle = isAdvertisement ? '#101722' : '#fcf2d8';
      context.font = `700 ${isAdvertisement ? 37 : 30}px ${era.config.signage.typography.includes('serif') ? 'Georgia' : 'Arial'}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(isAdvertisement ? `LUNA ${era.year}` : motif.toUpperCase(), sign.canvas.width / 2, sign.canvas.height / 2 - 16);
      context.font = `600 ${isAdvertisement ? 18 : 15}px Arial`;
      context.fillText(isAdvertisement ? next.toUpperCase() : era.config.signage.illumination.toUpperCase(), sign.canvas.width / 2, sign.canvas.height / 2 + 25);
      sign.texture.needsUpdate = true;
      sign.material.emissive.set(canvasColor(era.config.atmosphere.horizon, '#d38f78'));
      sign.material.emissiveIntensity = era.config.signage.illumination.includes('neon') || era.id === '2055' ? 1.15 : 0.45;
    });
  }

  private createVehicles(): void {
    const windowMaterial = new THREE.MeshStandardMaterial({ color: '#263f4e', roughness: 0.12, metalness: 0.42 });
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: '#161a1d', roughness: 0.86 });
    const lightMaterial = new THREE.MeshStandardMaterial({ color: '#fff1bb', emissive: '#ffbd70', emissiveIntensity: 1.2 });
    this.reusableMaterials.push(windowMaterial, wheelMaterial, lightMaterial);
    for (let index = 0; index < this.vehicleLimit; index += 1) {
      const group = new THREE.Group();
      group.name = `traffic pool vehicle ${index + 1}`;
      const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#a45c4f', roughness: 0.45, metalness: 0.28 });
      this.reusableMaterials.push(bodyMaterial);
      const body = new THREE.Mesh(this.sharedBox, bodyMaterial);
      const window = new THREE.Mesh(this.sharedBox, windowMaterial);
      const roof = new THREE.Mesh(this.sharedBox, bodyMaterial);
      const light = new THREE.Mesh(this.sharedBox, lightMaterial);
      const wheels = [0, 1, 2, 3].map(() => new THREE.Mesh(this.sharedWheel, wheelMaterial));
      wheels.forEach((wheel) => {
        wheel.rotation.z = Math.PI / 2;
        group.add(wheel);
      });
      group.add(body, window, roof, light);
      const lane = index % 2 === 0 ? -1 : 1;
      const z = -12 + index * 3.15;
      group.position.set(lane * 1.6, 0.28, z);
      group.castShadow = true;
      this.vehicleGroup.add(group);
      this.vehicles.push({ group, body, window, roof, wheels, light, lane, seed: index * 0.67 + 1, z });
    }
  }

  private createPedestrians(): void {
    const skinMaterial = new THREE.MeshStandardMaterial({ color: '#c68462', roughness: 0.72 });
    const shoeMaterial = new THREE.MeshStandardMaterial({ color: '#20252b', roughness: 0.84 });
    this.reusableMaterials.push(skinMaterial, shoeMaterial);
    for (let index = 0; index < this.pedestrianLimit; index += 1) {
      const group = new THREE.Group();
      group.name = `pooled pedestrian ${index + 1}`;
      const outfitMaterial = new THREE.MeshStandardMaterial({ color: '#344554', roughness: 0.76 });
      this.reusableMaterials.push(outfitMaterial);
      const body = new THREE.Mesh(this.sharedBody, outfitMaterial);
      const head = new THREE.Mesh(this.sharedHead, skinMaterial);
      const leftLeg = new THREE.Mesh(this.sharedArm, shoeMaterial);
      const rightLeg = new THREE.Mesh(this.sharedArm, shoeMaterial);
      const leftArm = new THREE.Mesh(this.sharedArm, outfitMaterial);
      const rightArm = new THREE.Mesh(this.sharedArm, outfitMaterial);
      leftLeg.position.x = -0.075;
      rightLeg.position.x = 0.075;
      leftArm.position.set(-0.2, 0.06, 0);
      rightArm.position.set(0.2, 0.06, 0);
      leftArm.rotation.z = -0.18;
      rightArm.rotation.z = 0.18;
      head.position.y = 0.56;
      body.position.y = 0.29;
      leftLeg.position.y = -0.1;
      rightLeg.position.y = -0.1;
      group.add(body, head, leftLeg, rightLeg, leftArm, rightArm);
      const side: Side = index % 2 === 0 ? 1 : -1;
      const baseX = side * (4.55 + (index % 3) * 0.18);
      const z = -12.5 + (index * 1.13) % 25;
      group.position.set(baseX, 0.16, z);
      group.scale.setScalar(0.92 + (index % 4) * 0.04);
      group.castShadow = true;
      this.pedestrianGroup.add(group);
      this.pedestrians.push({ group, body, head, leftLeg, rightLeg, leftArm, rightArm, side, seed: index * 0.41, z, baseX });
    }
  }

  private createFoliageAndFurniture(): void {
    const foliage = new THREE.InstancedMesh(this.sharedFoliage, this.foliageMaterials, this.foliageLimit);
    const trunks = new THREE.InstancedMesh(this.sharedTrunk, this.trunkMaterial, this.foliageLimit);
    for (let index = 0; index < this.foliageLimit; index += 1) {
      const side = index % 2 === 0 ? 1 : -1;
      const z = -11.5 + Math.floor(index / 2) * 4.6;
      this.matrixHelper.position.set(side * (5.7 + (index % 3) * 0.35), 1.28, z);
      this.matrixHelper.scale.setScalar(0.72 + (index % 4) * 0.08);
      this.matrixHelper.updateMatrix();
      foliage.setMatrixAt(index, this.matrixHelper.matrix);
      this.matrixHelper.position.y = 0.57;
      this.matrixHelper.scale.set(0.8, 1, 0.8);
      this.matrixHelper.updateMatrix();
      trunks.setMatrixAt(index, this.matrixHelper.matrix);
    }
    foliage.name = 'instanced street trees';
    trunks.name = 'instanced tree trunks';
    foliage.instanceMatrix.needsUpdate = true;
    trunks.instanceMatrix.needsUpdate = true;
    this.foliageGroup.add(foliage, trunks);

    const benchMaterial = new THREE.MeshStandardMaterial({ color: '#7d5d45', roughness: 0.82 });
    const bench = new THREE.InstancedMesh(this.sharedBox, benchMaterial, 6);
    for (let index = 0; index < 6; index += 1) {
      this.matrixHelper.position.set(index % 2 === 0 ? -5.15 : 5.15, 0.35, -9 + Math.floor(index / 2) * 7);
      this.matrixHelper.scale.set(1.25, 0.15, 0.38);
      this.matrixHelper.updateMatrix();
      bench.setMatrixAt(index, this.matrixHelper.matrix);
    }
    bench.name = 'reused sidewalk benches';
    bench.instanceMatrix.needsUpdate = true;
    this.foliageGroup.add(bench);
    this.reusableMaterials.push(benchMaterial);
  }

  private createLighting(): void {
    this.sun.position.set(-7, 12, 8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.lightGroup.add(this.sun, this.hemisphere);
    for (let index = 0; index < 8; index += 1) {
      const light = new THREE.PointLight('#ffbf79', 0.65, 5.2, 2);
      const side = index % 2 === 0 ? 1 : -1;
      light.position.set(side * 3.95, 2.95, -11 + Math.floor(index / 2) * 7.2);
      this.streetLights.push(light);
      const globe = new THREE.Mesh(this.sharedLamp, new THREE.MeshStandardMaterial({ color: '#ffcf8a', emissive: '#ffb45f', emissiveIntensity: 1.4 }));
      globe.position.copy(light.position);
      this.lightGroup.add(light, globe);
      this.reusableMaterials.push(globe.material as THREE.Material);
    }
  }

  private applyState(from: EraVisualState, to: EraVisualState, progress: number): void {
    const t = THREE.MathUtils.clamp(progress, 0, 1);
    const buildingCount = this.buildings.length;
    this.buildings.forEach((building, index) => {
      const fromDimensions = this.dimensionsFor(from, index);
      const toDimensions = this.dimensionsFor(to, index);
      const width = THREE.MathUtils.lerp(fromDimensions.width, toDimensions.width, t);
      const height = THREE.MathUtils.lerp(fromDimensions.height, toDimensions.height, t);
      const depth = THREE.MathUtils.lerp(fromDimensions.depth, toDimensions.depth, t);
      building.shell.position.set(building.x, height / 2, building.z);
      building.shell.scale.set(width, height, depth);
      const shellMaterial = building.shell.material as THREE.MeshStandardMaterial;
      shellMaterial.color.lerpColors(from.buildingColors[index % buildingCount], to.buildingColors[index % buildingCount], t);
      shellMaterial.roughness = to.era.id === '2055' ? 0.38 : 0.7;
      this.updateWindows(building, width, height, depth, from, to, t);
      this.updateStorefront(building, width, height, from, to, t);
      const billboardX = building.x + building.side * (width / 2 + 0.09);
      building.billboard.mesh.position.set(billboardX, height * 0.7, building.z + building.side * 0.02);
      building.billboard.mesh.rotation.y = building.side * Math.PI / 2;
      building.billboard.mesh.scale.set(building.billboard.height, building.billboard.height, building.billboard.width);
      building.billboard.material.emissiveIntensity = THREE.MathUtils.lerp(from.profile.signageGlow, to.profile.signageGlow, t);
    });
    this.roadMaterial.color.lerpColors(from.roadColor, to.roadColor, t);
    this.sidewalkMaterial.color.lerpColors(from.accent, to.accent, t).multiplyScalar(0.46);
    this.groundMaterial.color.lerpColors(from.foliageColor, to.foliageColor, t).multiplyScalar(0.5);
    this.foliageMaterials.color.lerpColors(from.foliageColor, to.foliageColor, t);
    this.sharedGlassMaterial.color.lerpColors(from.windowColor, to.windowColor, t);
    this.sharedInteriorMaterial.color.lerpColors(from.interiorColor, to.interiorColor, t);
    this.sharedInteriorMaterial.emissive.lerpColors(from.lampColor, to.lampColor, t).multiplyScalar(0.24);
    this.laneMaterial.color.lerpColors(from.accent, to.accent, t);
    this.targetBackground.copy(from.sky).lerp(to.sky, t);
    this.scene.background = this.targetBackground;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.targetFog.copy(from.fog).lerp(to.fog, t);
      this.scene.fog.color.copy(this.targetFog);
      this.scene.fog.density = THREE.MathUtils.lerp(from.fogDensity, to.fogDensity, t);
    } else {
      this.targetFog.copy(from.fog).lerp(to.fog, t);
      const fog = new THREE.FogExp2(this.targetFog.clone(), THREE.MathUtils.lerp(from.fogDensity, to.fogDensity, t));
      this.scene.fog = fog;
    }
    this.sun.color.copy(from.lampColor).lerp(to.lampColor, t);
    this.sun.intensity = THREE.MathUtils.lerp(2.2, 3.6, t);
    this.hemisphere.color.copy(from.sky).lerp(to.sky, t);
    this.hemisphere.groundColor.copy(from.foliageColor).lerp(to.foliageColor, t);
    this.updatePedestrianTargets(from, to, t);
    this.updateVehicleTargets(from, to, t);
  }

  private dimensionsFor(state: EraVisualState, index: number): { width: number; depth: number; height: number } {
    const site = BUILDING_SITES[index];
    const floorVariation = 1 + ((index % 3) - 1) * 0.035;
    return {
      width: site.width * state.profile.widthScale,
      depth: site.depth * (0.96 + state.era.config.world.buildingDensity * 0.12),
      height: site.height * state.profile.heightScale * floorVariation,
    };
  }

  private updateWindows(building: BuildingRecord, width: number, height: number, depth: number, from: EraVisualState, to: EraVisualState, progress: number): void {
    const rows = Math.min(8, Math.max(3, Math.round(height / 1.05)));
    const columns = 6;
    this.windowTint.copy(from.windowColor).lerp(to.windowColor, progress);
    this.interiorTint.copy(from.interiorColor).lerp(to.interiorColor, progress);
    this.sharedGlassMaterial.color.copy(this.windowTint);
    this.sharedInteriorMaterial.color.copy(this.interiorTint);
    for (let index = 0; index < 48; index += 1) {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const visible = row < rows;
      this.matrixHelper.position.set(0, -20, 0);
      this.matrixHelper.scale.setScalar(visible ? 1 : 0);
      if (visible) {
        const z = building.z - width * 0.37 + (column / (columns - 1)) * width * 0.74;
        const x = building.x + building.side * (width / 2 + 0.025);
        this.matrixHelper.position.set(x, 0.78 + row * 0.92, z);
        this.matrixHelper.rotation.set(0, building.side * Math.PI / 2, 0);
        this.matrixHelper.scale.set(1, 1, 1);
      }
      this.matrixHelper.updateMatrix();
      building.windows.setMatrixAt(index, this.matrixHelper.matrix);
      this.matrixHelper.position.x -= building.side * 0.035;
      this.matrixHelper.updateMatrix();
      building.interiors.setMatrixAt(index, this.matrixHelper.matrix);
    }
    building.windows.instanceMatrix.needsUpdate = true;
    building.interiors.instanceMatrix.needsUpdate = true;
    void depth;
  }

  private updateStorefront(building: BuildingRecord, width: number, height: number, from: EraVisualState, to: EraVisualState, progress: number): void {
    const frontX = building.x + building.side * (width / 2 + 0.04);
    building.storefront.position.set(frontX, 0, building.z + building.side * 0.04);
    building.storefront.rotation.y = building.side * Math.PI / 2;
    building.storefrontPanel.position.set(0, 1.03, 0);
    building.storefrontPanel.scale.set(0.14, 2.06, Math.min(2.65, width * 0.7));
    building.display.position.set(-0.08, 1.06, -0.42);
    building.display.scale.set(0.1, 1.38, Math.min(1.35, width * 0.34));
    building.door.position.set(-0.08, 0.92, 0.68);
    building.door.scale.set(0.11, 1.8, 0.7);
    building.awning.position.set(-0.12, 2.14, 0);
    building.awning.scale.set(0.28, 0.13, Math.min(2.8, width * 0.74));
    const panelMaterial = building.storefrontPanel.material as THREE.MeshStandardMaterial;
    panelMaterial.color.lerpColors(from.accent, to.accent, progress);
    const displayMaterial = building.display.material as THREE.MeshStandardMaterial;
    displayMaterial.color.lerpColors(from.windowColor, to.windowColor, progress);
    const awningMaterial = building.awning.material as THREE.MeshStandardMaterial;
    awningMaterial.color.lerpColors(from.accent, to.accent, progress);
    building.sign.mesh.position.set(0, 2.56, 0);
    building.sign.mesh.rotation.set(0, 0, 0);
    building.sign.mesh.scale.set(0.16, building.sign.height, building.sign.width);
    building.sign.material.emissiveIntensity = THREE.MathUtils.lerp(from.profile.signageGlow, to.profile.signageGlow, progress);
    void height;
  }

  private updateVehicleTargets(from: EraVisualState, to: EraVisualState, progress: number): void {
    const fromStyle = this.vehicleMetrics(from.profile.vehicleStyle);
    const toStyle = this.vehicleMetrics(to.profile.vehicleStyle);
    this.vehicles.forEach((vehicle, index) => {
      const bodyMaterial = vehicle.body.material as THREE.MeshStandardMaterial;
      const fromColor = tokenColor(from.era.config.population.palette[index % Math.max(1, from.era.config.population.palette.length)] ?? '#a45c4f', '#a45c4f');
      const toColor = tokenColor(to.era.config.population.palette[index % Math.max(1, to.era.config.population.palette.length)] ?? '#4a7785', '#4a7785');
      bodyMaterial.color.lerpColors(fromColor, toColor, progress);
      const width = THREE.MathUtils.lerp(fromStyle.width, toStyle.width, progress);
      const length = THREE.MathUtils.lerp(fromStyle.length, toStyle.length, progress);
      const bodyHeight = THREE.MathUtils.lerp(fromStyle.height, toStyle.height, progress);
      vehicle.body.position.set(0, bodyHeight, 0);
      vehicle.body.scale.set(width, bodyHeight * 1.7, length);
      vehicle.window.position.set(0, bodyHeight * 1.55, -length * 0.04);
      vehicle.window.scale.set(width * 0.78, bodyHeight * 0.6, length * 0.45);
      vehicle.roof.position.set(0, bodyHeight * 2.05, 0);
      vehicle.roof.scale.set(width * (toStyle.bus ? 1.06 : 0.72), 0.1, length * (toStyle.bus ? 0.94 : 0.58));
      vehicle.light.position.set(0, bodyHeight * 0.82, length * 0.51);
      vehicle.light.scale.set(width * 0.25, bodyHeight * 0.22, 0.06);
      vehicle.wheels.forEach((wheel, wheelIndex) => {
        wheel.position.set(wheelIndex % 2 === 0 ? -width * 0.46 : width * 0.46, 0.25, wheelIndex < 2 ? -length * 0.34 : length * 0.34);
        wheel.scale.setScalar(toStyle.bus ? 1.18 : 0.86);
      });
      vehicle.group.position.y = THREE.MathUtils.lerp(fromStyle.hover ? 1.4 : 0.28, toStyle.hover ? 1.4 : 0.28, progress);
      vehicle.group.userData['vehicleStyle'] = to.profile.vehicleStyle;
    });
  }

  private vehicleMetrics(style: VisualProfile['vehicleStyle']): { width: number; length: number; height: number; bus: boolean; hover: boolean } {
    switch (style) {
      case 'postwar': return { width: 1.18, length: 2.35, height: 0.38, bus: false, hover: false };
      case 'modernist': return { width: 1.3, length: 3.2, height: 0.46, bus: true, hover: false };
      case 'neon': return { width: 1.22, length: 2.7, height: 0.42, bus: false, hover: false };
      case 'digital': return { width: 1.42, length: 3.5, height: 0.5, bus: true, hover: false };
      case 'electric': return { width: 1.32, length: 2.8, height: 0.44, bus: false, hover: false };
      case 'autonomous': return { width: 1.38, length: 2.4, height: 0.34, bus: false, hover: true };
    }
  }

  private animateVehicles(delta: number): void {
    this.vehicles.forEach((vehicle, index) => {
      const speed = (0.52 + (index % 3) * 0.13) * (vehicle.lane > 0 ? 1 : -1);
      vehicle.z += speed * delta;
      if (vehicle.z > 14) vehicle.z = -14;
      if (vehicle.z < -14) vehicle.z = 14;
      vehicle.group.position.z = vehicle.z;
      vehicle.group.rotation.y = vehicle.lane > 0 ? Math.PI : 0;
    });
  }

  private updatePedestrianTargets(from: EraVisualState, to: EraVisualState, progress: number): void {
    const fromPalette = from.era.config.population.palette;
    const toPalette = to.era.config.population.palette;
    this.pedestrians.forEach((pedestrian, index) => {
      const fromColor = tokenColor(fromPalette[index % Math.max(1, fromPalette.length)] ?? '#344554', '#344554');
      const toColor = tokenColor(toPalette[index % Math.max(1, toPalette.length)] ?? '#53636d', '#53636d');
      (pedestrian.body.material as THREE.MeshStandardMaterial).color.lerpColors(fromColor, toColor, progress);
      (pedestrian.leftArm.material as THREE.MeshStandardMaterial).color.lerpColors(fromColor, toColor, progress);
      const headFrom = from.era.id === '1945' ? '#bd8062' : '#c58d6f';
      const headTo = to.era.id === '2055' ? '#e0ae87' : '#d39a74';
      this.headTint.set(headFrom).lerp(new THREE.Color(headTo), progress);
      (pedestrian.head.material as THREE.MeshStandardMaterial).color.copy(this.headTint);
      const silhouette = THREE.MathUtils.lerp(from.profile.pedestrianScale, to.profile.pedestrianScale, progress);
      pedestrian.group.scale.set(silhouette, silhouette * (to.era.id === '2055' ? 1.08 : 1), silhouette);
      pedestrian.group.userData['fashion'] = to.era.config.population.fashion;
      pedestrian.group.userData['mobility'] = to.era.config.population.mobility;
    });
  }

  private animatePedestrians(delta: number): void {
    this.pedestrians.forEach((pedestrian) => {
      pedestrian.z += pedestrian.side * delta * (0.18 + (pedestrian.seed % 0.2));
      if (pedestrian.z > 14) pedestrian.z = -14;
      if (pedestrian.z < -14) pedestrian.z = 14;
      pedestrian.group.position.z = pedestrian.z;
      const stride = Math.sin(this.elapsed * 5.2 + pedestrian.seed) * 0.34;
      pedestrian.leftLeg.rotation.z = stride;
      pedestrian.rightLeg.rotation.z = -stride;
      pedestrian.leftArm.rotation.z = -stride * 0.75 - 0.18;
      pedestrian.rightArm.rotation.z = stride * 0.75 + 0.18;
    });
  }

  private animateLights(): void {
    const pulse = 0.92 + Math.sin(this.elapsed * 2.1) * 0.06;
    this.streetLights.forEach((light, index) => {
      light.intensity = (0.48 + (index % 2) * 0.08) * pulse;
    });
  }
}

export function createCityWorld(scene: THREE.Scene, initialEra: EraSpec, options: CityWorldOptions = {}): CityWorld {
  return new ProceduralCityWorld(scene, initialEra, options);
}
