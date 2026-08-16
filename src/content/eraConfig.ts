/**
 * Per-era content configuration schema.
 *
 * Every layer module reads from this record to know what geometry,
 * textures, and behavioural knobs to instantiate for the active era.
 */

import type { EraId } from '../eras.js';

// ─── Per-layer data shapes ──────────────────────────────────────────────

export interface BuildingConfig {
  count: number;
  averageHeight: number; // metres
  materials: string[];  // e.g. ["brick", "concrete", "glass"]
  windowDensity: number; // 0-1
}

export interface StorefrontConfig {
  count: number;
  styles: string[];     // e.g. ["neon_sign", "awning", "digital_display"]
  hasSignage: boolean;
}

export interface AdConfig {
  billboardCount: number;
  adTypes: string[];    // e.g. ["print_billboard", "digital_screen", "hand_painted"]
  animationEnabled: boolean;
}

export interface StreetConfig {
  roadWidth: number;    // metres
  sidewalkWidth: number; // metres
  surfaceMaterial: string;
  hasCrosswalks: boolean;
  streetLightType: string;

  // Era-specific furniture props (procedurally generated)
  lampPosts?: LampPostConfig[];
  sandbags?: SandbagConfig[];
  barricades?: BarricadeConfig[];
  posters?: PosterConfig[];
  phoneBooths?: PhoneBoothConfig[];
  fireHydrants?: FireHydrantConfig[];
  mailboxes?: MailboxConfig[];
  graffiti?: GraffitiConfig[];
  payphones?: PayphoneConfig[];
  busShelters?: BusShelterConfig[];
  neonClutter?: NeonClutterConfig[];
  trafficSignals?: TrafficSignalConfig[];
  bikeLaneMarkings?: BikeLaneConfig[];
  evChargingPosts?: EVChargingPostConfig[];
  sensorCameras?: SensorCameraConfig[];
  planters?: PlanterConfig[];
  digitalBusDisplays?: DigitalBusDisplayConfig[];
}

// ─── Per-era furniture sub-configs ──────────────────────────────────────

export interface LampPostConfig {
  count: number;
  spacing: number;      // metres between posts
  globeStyle: 'warm' | 'cool' | 'neon' | 'smart';
  poleColor: number;    // hex colour
  globeRadius: number;
}

export interface SandbagConfig {
  count: number;
  pilePositions: Array<{ x: number; z: number; rotationY: number }>;
}

export interface BarricadeConfig {
  count: number;
  positions: Array<{ x: number; z: number; length: number }>;
}

export interface PosterConfig {
  count: number;
  wallPositions: Array<{ x: number; z: number; text: string }>;
}

export interface PhoneBoothConfig {
  count: number;
  positions: Array<{ x: number; z: number }>;
  color: number;
}

export interface FireHydrantConfig {
  count: number;
  positions: Array<{ x: number; z: number }>;
  color: number;
}

export interface MailboxConfig {
  count: number;
  positions: Array<{ x: number; z: number }>;
  color: number;
}

export interface GraffitiConfig {
  count: number;
  wallPositions: Array<{ x: number; z: number; width: number; height: number }>;
  colors: number[];
}

export interface PayphoneConfig {
  count: number;
  positions: Array<{ x: number; z: number }>;
  color: number;
}

export interface BusShelterConfig {
  count: number;
  positions: Array<{ x: number; z: number }>;
  style: 'simple' | 'modern' | 'digital';
}

export interface NeonClutterConfig {
  count: number;
  poleDecorations: Array<{ x: number; z: number; type: string; color: number }>;
}

export interface TrafficSignalConfig {
  count: number;
  cornerPositions: Array<{ x: number; z: number }>;
}

export interface BikeLaneConfig {
  laneWidth: number;
  stripeSpacing: number;
  side: 'left' | 'right';
}

export interface EVChargingPostConfig {
  count: number;
  positions: Array<{ x: number; z: number }>;
}

export interface SensorCameraConfig {
  count: number;
  positions: Array<{ x: number; z: number; poleHeight: number }>;
}

export interface PlanterConfig {
  count: number;
  positions: Array<{ x: number; z: number }>;
  plantType: 'bush' | 'tree' | 'flower';
}

export interface DigitalBusDisplayConfig {
  count: number;
  positions: Array<{ x: number; z: number }>;
  showRoute: boolean;
}

export interface VehicleConfig {
  totalCount: number;
  types: string[];      // e.g. ["sedan", "truck", "bus", "bicycle"]
  movementSpeed: number; // world-units per second
}

export interface PedestrianConfig {
  totalCount: number;
  outfitStyles: string[];
  walkingSpeed: number;
}

// ─── Atmosphere / sky / lighting config ─────────────────────────────────

export interface SkyGradient {
  /** Horizon colour (hex integer). */
  horizonColor: number;
  /** Zenith (top-of-sky) colour (hex integer). */
  zenithColor: number;
  /** Optional third band — middle sky colour (hex integer), undefined for simple two-stop gradient. */
  midColor?: number;
  /** Mid-band height factor 0–1 (applied only when midColor is set). Default 0.5. */
  midFactor?: number;
}

export interface SunDirection {
  /** Normalised x component. */
  x: number;
  /** Normalised y component (positive = above horizon). */
  y: number;
  /** Normalised z component. */
  z: number;
  /** Sun colour (hex integer). */
  color: number;
}

export interface AtmosphereSettings {
  /** Vertical sky colour gradient. */
  sky: SkyGradient;
  /** Exponential fog density (0 = none, ~0.008–0.02 typical). */
  fogDensity: number;
  /** Fog colour (hex integer). */
  fogColor: number;
  /** Sun position & colour. */
  sun: SunDirection;
  /** Upward hemisphere light colour (hex integer). */
  hemiSkyColor: number;
  /** Downward hemisphere light colour (hex integer). */
  hemiGroundColor: number;
  /** Hemisphere light intensity. */
  hemiIntensity: number;
  /** Directional sun light intensity. */
  dirIntensity: number;
}

// ─── EraContent — one typed shape per era ───────────────────────────────

export interface EraContent {
  id: EraId;
  buildings: BuildingConfig;
  storefronts: StorefrontConfig;
  ads: AdConfig;
  street: StreetConfig;
  vehicles: VehicleConfig;
  pedestrians: PedestrianConfig;
  atmosphere: AtmosphereSettings;
}

// ─── Default record with all five eras present ──────────────────────────

const defaultEras: Record<EraId, EraContent> = {
  '1945': {
    id: '1945',
    buildings: {
      count: 8,
      averageHeight: 12,
      materials: ['brick', 'stone', 'wood'],
      windowDensity: 0.4,
    },
    storefronts: {
      count: 6,
      styles: ['awning', 'hand_painted_sign'],
      hasSignage: true,
    },
    ads: {
      billboardCount: 2,
      adTypes: ['hand_painted', 'newspaper_clipping'],
      animationEnabled: false,
    },
    street: {
      roadWidth: 8,
      sidewalkWidth: 2,
      surfaceMaterial: 'cobblestone',
      hasCrosswalks: false,
      streetLightType: 'gas_lamp',
      lampPosts: [
        { count: 6, spacing: 10, globeStyle: 'warm', poleColor: 0x3d2b1f, globeRadius: 0.3 },
      ],
      sandbags: [
        {
          count: 4,
          pilePositions: [
            { x: -8, z: 5, rotationY: 0.2 },
            { x: 8, z: 5, rotationY: -0.3 },
            { x: -12, z: 4, rotationY: 0.1 },
            { x: 12, z: 4, rotationY: -0.1 },
          ],
        },
      ],
      barricades: [
        {
          count: 3,
          positions: [
            { x: -6, z: 6, length: 3 },
            { x: 6, z: 6, length: 2.5 },
            { x: 0, z: 7, length: 4 },
          ],
        },
      ],
      posters: [
        {
          count: 5,
          wallPositions: [
            { x: -15, z: 3.5, text: 'WAR BONDS' },
            { x: -5, z: 3.5, text: 'VICTORY GARDEN' },
            { x: 5, z: 3.5, text: 'BLACKOUT DRILLS' },
            { x: 15, z: 3.5, text: 'RACE FOR SAFETY' },
            { x: -10, z: 3.5, text: 'BUY STAMPS' },
          ],
        },
      ],
    },
    vehicles: {
      totalCount: 5,
      types: ['vintage_car', 'truck', 'bicycle'],
      movementSpeed: 1.5,
    },
    pedestrians: {
      totalCount: 12,
      outfitStyles: ['1940s_suit', 'apron_dress', 'fedora'],
      walkingSpeed: 1.0,
    },
    atmosphere: {
      sky: {
        horizonColor: 0xc4a882,
        zenithColor: 0x8a7d6b,
      },
      fogDensity: 0.012,
      fogColor: 0xbfa882,
      sun: { x: 0.6, y: 0.35, z: 0.7, color: 0xd4b896 },
      hemiSkyColor: 0x9e8e76,
      hemiGroundColor: 0x4a4238,
      hemiIntensity: 0.45,
      dirIntensity: 0.55,
    },
  },
  '1965': {
    id: '1965',
    buildings: {
      count: 10,
      averageHeight: 18,
      materials: ['brick', 'concrete', 'glass'],
      windowDensity: 0.55,
    },
    storefronts: {
      count: 8,
      styles: ['neon_sign', 'awning', 'plate_glass'],
      hasSignage: true,
    },
    ads: {
      billboardCount: 3,
      adTypes: ['neon_billboard', 'poster_wall'],
      animationEnabled: false,
    },
    street: {
      roadWidth: 10,
      sidewalkWidth: 2.5,
      surfaceMaterial: 'asphalt',
      hasCrosswalks: true,
      streetLightType: 'fluorescent_tube',
      lampPosts: [
        { count: 8, spacing: 7.5, globeStyle: 'cool', poleColor: 0x4a4a4a, globeRadius: 0.2 },
      ],
      phoneBooths: [
        {
          count: 2,
          positions: [
            { x: -10, z: 4 },
            { x: 10, z: 4 },
          ],
          color: 0x1a3c6e,
        },
      ],
      fireHydrants: [
        {
          count: 3,
          positions: [
            { x: -8, z: 4 },
            { x: 0, z: 4 },
            { x: 8, z: 4 },
          ],
          color: 0xcc0000,
        },
      ],
      mailboxes: [
        {
          count: 4,
          positions: [
            { x: -12, z: 4 },
            { x: -4, z: 4 },
            { x: 4, z: 4 },
            { x: 12, z: 4 },
          ],
          color: 0x1a5276,
        },
      ],
    },
    vehicles: {
      totalCount: 12,
      types: ['classic_sedan', 'convertible', 'delivery_truck', 'bicycle'],
      movementSpeed: 2.5,
    },
    pedestrians: {
      totalCount: 20,
      outfitStyles: ['mod_suit', 'flower_power', 'casual_60s'],
      walkingSpeed: 1.2,
    },
    atmosphere: {
      sky: {
        horizonColor: 0xd4e8f0,
        zenithColor: 0x3a8fd4,
      },
      fogDensity: 0.004,
      fogColor: 0xe8dcc8,
      sun: { x: 0.4, y: 0.75, z: 0.5, color: 0xfff0c0 },
      hemiSkyColor: 0x87ceeb,
      hemiGroundColor: 0x6b8e4e,
      hemiIntensity: 0.6,
      dirIntensity: 1.1,
    },
  },
  '1985': {
    id: '1985',
    buildings: {
      count: 12,
      averageHeight: 25,
      materials: ['brick', 'steel', 'glass', 'concrete'],
      windowDensity: 0.65,
    },
    storefronts: {
      count: 10,
      styles: ['neon_sign', 'digital_display', 'graffiti_wall'],
      hasSignage: true,
    },
    ads: {
      billboardCount: 4,
      adTypes: ['neon_billboard', 'graffiti_tag', 'cassette_ad'],
      animationEnabled: true,
    },
    street: {
      roadWidth: 12,
      sidewalkWidth: 3,
      surfaceMaterial: 'asphalt',
      hasCrosswalks: true,
      streetLightType: 'sodium_vapor',
      lampPosts: [
        { count: 8, spacing: 7.5, globeStyle: 'neon', poleColor: 0x666666, globeRadius: 0.25 },
      ],
      graffiti: [
        {
          count: 4,
          wallPositions: [
            { x: -14, z: 3.5, width: 3, height: 1.5 },
            { x: -6, z: 3.5, width: 2.5, height: 1.2 },
            { x: 6, z: 3.5, width: 3, height: 1.5 },
            { x: 14, z: 3.5, width: 2, height: 1 },
          ],
          colors: [0xff00ff, 0x00ffff, 0xffff00, 0xff6600],
        },
      ],
      payphones: [
        {
          count: 2,
          positions: [
            { x: -8, z: 4 },
            { x: 8, z: 4 },
          ],
          color: 0x2c2c2c,
        },
      ],
      busShelters: [
        {
          count: 2,
          positions: [
            { x: -10, z: 4.5 },
            { x: 10, z: 4.5 },
          ],
          style: 'simple',
        },
      ],
      neonClutter: [
        {
          count: 6,
          poleDecorations: [
            { x: -10, z: 4, type: 'neon_tube', color: 0xff0066 },
            { x: -5, z: 4, type: 'neon_sign', color: 0x00ffcc },
            { x: 0, z: 4, type: 'neon_tube', color: 0xffaa00 },
            { x: 5, z: 4, type: 'neon_sign', color: 0x00aaff },
            { x: 10, z: 4, type: 'neon_tube', color: 0xff00ff },
            { x: 15, z: 4, type: 'neon_sign', color: 0x00ff66 },
          ],
        },
      ],
    },
    vehicles: {
      totalCount: 18,
      types: ['sports_car', 'minivan', 'taxi', 'motorcycle', 'bicycle'],
      movementSpeed: 3.0,
    },
    pedestrians: {
      totalCount: 30,
      outfitStyles: ['power_suit', 'punk', 'athleisure'],
      walkingSpeed: 1.4,
    },
    atmosphere: {
      sky: {
        horizonColor: 0xff9944,
        zenithColor: 0x2a1533,
      },
      fogDensity: 0.015,
      fogColor: 0xcc8844,
      sun: { x: 0.85, y: 0.15, z: 0.5, color: 0xffaa44 },
      hemiSkyColor: 0xdd7733,
      hemiGroundColor: 0x3a2a1a,
      hemiIntensity: 0.5,
      dirIntensity: 0.8,
    },
  },
  '2005': {
    id: '2005',
    buildings: {
      count: 14,
      averageHeight: 35,
      materials: ['glass', 'steel', 'concrete', 'stone_facade'],
      windowDensity: 0.75,
    },
    storefronts: {
      count: 12,
      styles: ['digital_display', 'glass_front', 'branded_sign'],
      hasSignage: true,
    },
    ads: {
      billboardCount: 5,
      adTypes: ['digital_screen', 'wraparound_banner', 'storefront_branding'],
      animationEnabled: true,
    },
    street: {
      roadWidth: 14,
      sidewalkWidth: 3.5,
      surfaceMaterial: 'asphalt',
      hasCrosswalks: true,
      streetLightType: 'led_panel',
      lampPosts: [
        { count: 10, spacing: 6, globeStyle: 'smart', poleColor: 0x888888, globeRadius: 0.15 },
      ],
      trafficSignals: [
        {
          count: 4,
          cornerPositions: [
            { x: -16, z: 7 },
            { x: 16, z: 7 },
            { x: -16, z: -7 },
            { x: 16, z: -7 },
          ],
        },
      ],
      bikeLaneMarkings: [
        { laneWidth: 1.5, stripeSpacing: 2, side: 'right' },
      ],
      busShelters: [
        {
          count: 2,
          positions: [
            { x: -10, z: 5 },
            { x: 10, z: 5 },
          ],
          style: 'modern',
        },
      ],
    },
    vehicles: {
      totalCount: 25,
      types: ['sedan', 'suv', 'hybrid', 'taxi', 'bus', 'bicycle'],
      movementSpeed: 3.5,
    },
    pedestrians: {
      totalCount: 40,
      outfitStyles: ['business_casual', 'tech_start-up', 'jeans_and_tee'],
      walkingSpeed: 1.5,
    },
    atmosphere: {
      sky: {
        horizonColor: 0xaab8c4,
        zenithColor: 0x6a7a8a,
      },
      fogDensity: 0.006,
      fogColor: 0x9aaabc,
      sun: { x: 0.3, y: 0.6, z: 0.7, color: 0xddeeff },
      hemiSkyColor: 0x99aabb,
      hemiGroundColor: 0x556677,
      hemiIntensity: 0.55,
      dirIntensity: 0.7,
    },
  },
  '2025': {
    id: '2025',
    buildings: {
      count: 16,
      averageHeight: 50,
      materials: ['smart_glass', 'timber', 'recycled_composite', 'steel'],
      windowDensity: 0.85,
    },
    storefronts: {
      count: 14,
      styles: ['augmented_window', 'holographic_sign', 'interactive_display'],
      hasSignage: true,
    },
    ads: {
      billboardCount: 6,
      adTypes: ['holographic_projection', 'dynamic_led_wall', 'ar_overlay'],
      animationEnabled: true,
    },
    street: {
      roadWidth: 16,
      sidewalkWidth: 4,
      surfaceMaterial: 'permeable_paver',
      hasCrosswalks: true,
      streetLightType: 'smart_led_smart_sensor',
      lampPosts: [
        { count: 12, spacing: 5, globeStyle: 'smart', poleColor: 0x999999, globeRadius: 0.12 },
      ],
      evChargingPosts: [
        {
          count: 3,
          positions: [
            { x: -8, z: 5 },
            { x: 0, z: 5 },
            { x: 8, z: 5 },
          ],
        },
      ],
      sensorCameras: [
        {
          count: 4,
          positions: [
            { x: -16, z: 7, poleHeight: 4 },
            { x: 16, z: 7, poleHeight: 4 },
            { x: -16, z: -7, poleHeight: 4 },
            { x: 16, z: -7, poleHeight: 4 },
          ],
        },
      ],
      planters: [
        {
          count: 6,
          positions: [
            { x: -12, z: 5 },
            { x: -4, z: 5 },
            { x: 4, z: 5 },
            { x: 12, z: 5 },
            { x: -8, z: -5 },
            { x: 8, z: -5 },
          ],
          plantType: 'bush',
        },
      ],
      digitalBusDisplays: [
        {
          count: 2,
          positions: [
            { x: -10, z: 5 },
            { x: 10, z: 5 },
          ],
          showRoute: true,
        },
      ],
      busShelters: [
        {
          count: 2,
          positions: [
            { x: -10, z: 5 },
            { x: 10, z: 5 },
          ],
          style: 'digital',
        },
      ],
    },
    vehicles: {
      totalCount: 20,
      types: ['autonomous_shuttle', 'ev_sedan', 'cargo_bot', 'drone_deliverer'],
      movementSpeed: 2.0,
    },
    pedestrians: {
      totalCount: 35,
      outfitStyles: ['smart_wear', 'sustainable_fashion', 'adaptive_clothing'],
      walkingSpeed: 1.3,
    },
    atmosphere: {
      sky: {
        horizonColor: 0xc8ddf0,
        zenithColor: 0x2266bb,
      },
      fogDensity: 0.002,
      fogColor: 0xdde8f0,
      sun: { x: 0.25, y: 0.8, z: 0.55, color: 0xffffff },
      hemiSkyColor: 0x88bbee,
      hemiGroundColor: 0x557755,
      hemiIntensity: 0.7,
      dirIntensity: 1.3,
    },
  },
};

export default defaultEras;
