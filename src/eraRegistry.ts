/**
 * EraSpec type definitions and typed registry.
 *
 * This module is the single source of truth for era-specific visual data.
 * Every procedural asset builder consumes an `EraSpec` obtained from the
 * typed registry (`getEraSpec`) so that the entire scene — buildings,
 * vehicles, storefronts, ads, pedestrians, streets, textures — stays
 * consistent within a given era.
 */

// ---------------------------------------------------------------------------
// Primitive helper types
// ---------------------------------------------------------------------------

/** Opaque hex colour string, e.g. `"#aabbcc"`. */
export type HexColor = string;

// ---------------------------------------------------------------------------
// Building spec
// ---------------------------------------------------------------------------

export type BuildingStyle =
  | 'brick-walkup' // 1945
  | 'mid-century-concrete' // 1965
  | 'glass-curtain-wall' // 1985
  | 'mixed-use-glass' // 2005
  | 'eco-smart-glass'; // 2025

export type RoofType = 'flat-tar' | 'flat-parapet' | 'flat-mechanical' | 'green-roof' | 'solar-roof';

export interface BuildingSpec {
  style: BuildingStyle;
  minFloors: number;
  maxFloors: number;
  floorHeight: number;
  facadePalette: HexColor[];
  windowColor: HexColor;
  windowEmissiveColor: HexColor;
  trimColor: HexColor;
  roofType: RoofType;
  corniceLikelihood: number;
  awningLikelihood: number;
  airConditionerLikelihood: number;
  groundFloorRetailLikelihood: number;
}

// ---------------------------------------------------------------------------
// Vehicle spec
// ---------------------------------------------------------------------------

export type VehicleSilhouette =
  | 'rounded-fender-1940s'
  | 'finned-muscle-1960s'
  | 'boxy-aero-1980s'
  | 'rounded-sedan-2000s'
  | 'sleek-ev-2020s';

export type HeadlightType = 'round-bulb' | 'dual-round' | 'rectangular' | 'projector' | 'led-strip';

export interface VehicleSpec {
  silhouette: VehicleSilhouette;
  wheelRadius: number;
  wheelWidth: number;
  paintPalette: HexColor[];
  chromeLikelihood: number;
  headlightType: HeadlightType;
  headlightColor: HexColor;
  averageLength: number;
  averageHeight: number;
  averageWidth: number;
  cabinRatio: number;
  grilleStyle: 'vertical-bars' | 'horizontal-bars' | 'mesh' | 'body-color' | 'closed-panel';
}

// ---------------------------------------------------------------------------
// Signage / advertisement spec
// ---------------------------------------------------------------------------

export type SignageStyle =
  | 'hand-painted-awning'
  | 'neon-tube'
  | 'fluorescent-box'
  | 'backlit-vinyl'
  | 'led-digital';

export interface SignageSpec {
  style: SignageStyle;
  palette: HexColor[];
  fontSizes: [number, number]; // [min, max] px in canvas space
  adContent: string[];
  neonLikelihood: number;
  backlitLikelihood: number;
  maxWidth: number;
}

// ---------------------------------------------------------------------------
// Pedestrian spec
// ---------------------------------------------------------------------------

export interface PedestrianSpec {
  outfitPalette: HexColor[];
  accentPalette: HexColor[];
  skinPalette: HexColor[];
  hairPalette: HexColor[];
  hatLikelihood: number;
  hatColor: HexColor;
  bodyScale: number;
  shoulderWidth: number;
  legLength: number;
}

// ---------------------------------------------------------------------------
// Street spec
// ---------------------------------------------------------------------------

export type LampPostStyle =
  | 'cast-iron-globe' // 1945
  | 'cobra-head-mercury' // 1965
  | 'cobra-head-sodium' // 1985
  | 'shoebox-halide' // 2005
  | 'led-cobra'; // 2025

export interface StreetSpec {
  asphaltColor: HexColor;
  asphaltCrackiness: number;
  sidewalkColor: HexColor;
  sidewalkSeamSpacing: number;
  curbColor: HexColor;
  curbHeight: number;
  lampPostStyle: LampPostStyle;
  lampPostColor: HexColor;
  lampGlowColor: HexColor;
  lampGlowIntensity: number;
  laneMarkings: boolean;
  laneMarkingColor: HexColor;
  laneMarkingStyle: 'solid-white' | 'dashed-yellow' | 'dashed-white' | 'double-yellow';
  hasBikeLane: boolean;
  trafficLightStyle: 'pendulum' | 'mast-arm' | 'mast-arm-led';
}

// ---------------------------------------------------------------------------
// Sky / atmosphere spec
// ---------------------------------------------------------------------------

export interface SkySpec {
  topColor: HexColor;
  bottomColor: HexColor;
  fogColor: HexColor;
  fogNear: number;
  fogFar: number;
  ambientColor: HexColor;
  ambientIntensity: number;
  sunColor: HexColor;
  sunIntensity: number;
}

// ---------------------------------------------------------------------------
// Audio spec (used by audio system downstream)
// ---------------------------------------------------------------------------

export interface AudioSpec {
  ambientType: 'jazz-street' | 'radio-pop' | 'synth-urban' | 'pop-electronic' | 'ambient-ev';
  trafficVolume: number;
  crowdVolume: number;
  sfxPalette: string[];
}

// ---------------------------------------------------------------------------
// Top-level EraSpec
// ---------------------------------------------------------------------------

export interface EraSpec {
  eraId: string;
  year: number;
  label: string;
  description: string;
  buildings: BuildingSpec;
  vehicles: VehicleSpec;
  signage: SignageSpec;
  pedestrians: PedestrianSpec;
  streets: StreetSpec;
  sky: SkySpec;
  audio: AudioSpec;
}

// ---------------------------------------------------------------------------
// Era definitions — the five time periods
// ---------------------------------------------------------------------------

/** Canonical list of era IDs in chronological order. */
export const ERA_ORDER = ['1945', '1965', '1985', '2005', '2025'] as const;

/** Union type of all valid era IDs. */
export type EraId = (typeof ERA_ORDER)[number];

const ERA_1945: EraSpec = {
  eraId: '1945',
  year: 1945,
  label: 'Post-War 1945',
  description: 'Brick walk-ups, rounded-fender cars, hand-painted storefronts, fedoras and overcoats.',
  buildings: {
    style: 'brick-walkup',
    minFloors: 3,
    maxFloors: 7,
    floorHeight: 3.2,
    facadePalette: ['#8b4513', '#a0522d', '#6b4423', '#7a5230', '#9e6b4a', '#5c4033'],
    windowColor: '#3a4a5a',
    windowEmissiveColor: '#ffdd88',
    trimColor: '#c4b59a',
    roofType: 'flat-tar',
    corniceLikelihood: 0.8,
    awningLikelihood: 0.6,
    airConditionerLikelihood: 0.0,
    groundFloorRetailLikelihood: 0.7,
  },
  vehicles: {
    silhouette: 'rounded-fender-1940s',
    wheelRadius: 0.42,
    wheelWidth: 0.18,
    paintPalette: ['#1a1a1a', '#2b3a2b', '#4a2020', '#3a3025', '#5a5045', '#1c2530'],
    chromeLikelihood: 0.9,
    headlightType: 'round-bulb',
    headlightColor: '#fff0c0',
    averageLength: 4.7,
    averageHeight: 1.7,
    averageWidth: 1.9,
    cabinRatio: 0.45,
    grilleStyle: 'vertical-bars',
  },
  signage: {
    style: 'hand-painted-awning',
    palette: ['#c4a04a', '#8b3a3a', '#2b4a6b', '#3a5a3a', '#6b4a2b', '#cc8833'],
    fontSizes: [28, 44],
    adContent: ['FRESH BREAD', 'DINER', 'GENERAL STORE', 'BAKERY', 'BARBER SHOP', 'PHARMACY', 'HOTEL', 'TAILOR', '5¢ COFFEE', 'APPLIANCES'],
    neonLikelihood: 0.15,
    backlitLikelihood: 0.0,
    maxWidth: 3.5,
  },
  pedestrians: {
    outfitPalette: ['#3a3a3a', '#4a4030', '#5a5045', '#2b3a2b', '#4a3a2a', '#3a4a5a', '#6b5a4a', '#2a2a2a'],
    accentPalette: ['#8b3a3a', '#c4a04a', '#2b4a6b', '#3a5a3a'],
    skinPalette: ['#e0b080', '#c89868', '#a67848', '#8b5e3c', '#f0c8a0', '#d4a878'],
    hairPalette: ['#2a1a0a', '#3a2a15', '#4a3520', '#5a4a30', '#6a5a35', '#1a1a1a'],
    hatLikelihood: 0.65,
    hatColor: '#3a3025',
    bodyScale: 1.0,
    shoulderWidth: 0.42,
    legLength: 0.85,
  },
  streets: {
    asphaltColor: '#4a4a48',
    asphaltCrackiness: 0.4,
    sidewalkColor: '#b0a89c',
    sidewalkSeamSpacing: 1.5,
    curbColor: '#9a9288',
    curbHeight: 0.18,
    lampPostStyle: 'cast-iron-globe',
    lampPostColor: '#2a2a2a',
    lampGlowColor: '#ffdd88',
    lampGlowIntensity: 0.6,
    laneMarkings: true,
    laneMarkingColor: '#e8e0d0',
    laneMarkingStyle: 'solid-white',
    hasBikeLane: false,
    trafficLightStyle: 'pendulum',
  },
  sky: {
    topColor: '#5a7088',
    bottomColor: '#c8b89a',
    fogColor: '#b0a890',
    fogNear: 40,
    fogFar: 160,
    ambientColor: '#a0a098',
    ambientIntensity: 0.55,
    sunColor: '#fff0d0',
    sunIntensity: 0.9,
  },
  audio: {
    ambientType: 'jazz-street',
    trafficVolume: 0.3,
    crowdVolume: 0.5,
    sfxPalette: ['horn-1940s', 'engine-idle-1940s', 'footstep', 'streetcar'],
  },
};

const ERA_1965: EraSpec = {
  eraId: '1965',
  year: 1965,
  label: 'Mid-Century 1965',
  description: 'Concrete mid-rises, finned muscle cars, neon signage, mod fashion and bell-bottoms.',
  buildings: {
    style: 'mid-century-concrete',
    minFloors: 4,
    maxFloors: 14,
    floorHeight: 3.0,
    facadePalette: ['#b8b0a0', '#a89888', '#988878', '#c0b8a8', '#8a7a6a', '#d0c8b8'],
    windowColor: '#4a6080',
    windowEmissiveColor: '#ffe8a0',
    trimColor: '#6a6a6a',
    roofType: 'flat-parapet',
    corniceLikelihood: 0.3,
    awningLikelihood: 0.4,
    airConditionerLikelihood: 0.3,
    groundFloorRetailLikelihood: 0.75,
  },
  vehicles: {
    silhouette: 'finned-muscle-1960s',
    wheelRadius: 0.40,
    wheelWidth: 0.20,
    paintPalette: ['#cc2020', '#2050cc', '#e0e0e0', '#ffd040', '#2a8a3a', '#1a1a1a', '#cc6620', '#3060a0'],
    chromeLikelihood: 0.7,
    headlightType: 'dual-round',
    headlightColor: '#fff5d0',
    averageLength: 5.2,
    averageHeight: 1.4,
    averageWidth: 2.0,
    cabinRatio: 0.40,
    grilleStyle: 'horizontal-bars',
  },
  signage: {
    style: 'neon-tube',
    palette: ['#ff3060', '#30ff60', '#60a0ff', '#ffff30', '#ff60ff', '#30ffff', '#ff8030'],
    fontSizes: [30, 52],
    adContent: ['GAS 29¢', 'MOTEL', 'DINER', 'CINEMA', 'AUTO PARTS', 'RECORDS', 'ICE CREAM', 'BARBER', 'LIQUOR', 'LAUNDROMAT', 'GO-GO', 'DRIVE-IN'],
    neonLikelihood: 0.7,
    backlitLikelihood: 0.1,
    maxWidth: 4.0,
  },
  pedestrians: {
    outfitPalette: ['#3a5a8a', '#8a3a3a', '#5a5a5a', '#3a3a3a', '#6a4a2a', '#4a6a3a', '#2a4a6a', '#8a6a4a', '#c0c0c0'],
    accentPalette: ['#ff3060', '#ffd040', '#30ff60', '#60a0ff'],
    skinPalette: ['#e0b080', '#c89868', '#a67848', '#8b5e3c', '#f0c8a0', '#d4a878', '#6b4828'],
    hairPalette: ['#2a1a0a', '#3a2a15', '#5a4a30', '#8a6a3a', '#1a1a1a', '#a04020'],
    hatLikelihood: 0.2,
    hatColor: '#3a3a3a',
    bodyScale: 1.02,
    shoulderWidth: 0.44,
    legLength: 0.88,
  },
  streets: {
    asphaltColor: '#3e3e3c',
    asphaltCrackiness: 0.3,
    sidewalkColor: '#a8a098',
    sidewalkSeamSpacing: 2.0,
    curbColor: '#888880',
    curbHeight: 0.16,
    lampPostStyle: 'cobra-head-mercury',
    lampPostColor: '#3a3a3a',
    lampGlowColor: '#a0c0e0',
    lampGlowIntensity: 0.5,
    laneMarkings: true,
    laneMarkingColor: '#f0e8a0',
    laneMarkingStyle: 'dashed-yellow',
    hasBikeLane: false,
    trafficLightStyle: 'mast-arm',
  },
  sky: {
    topColor: '#4a80c0',
    bottomColor: '#a8c8e0',
    fogColor: '#b0c8d8',
    fogNear: 50,
    fogFar: 200,
    ambientColor: '#90a0b0',
    ambientIntensity: 0.6,
    sunColor: '#fff8e8',
    sunIntensity: 1.0,
  },
  audio: {
    ambientType: 'radio-pop',
    trafficVolume: 0.4,
    crowdVolume: 0.4,
    sfxPalette: ['horn-1960s', 'engine-v8', 'radio-music', 'chatter'],
  },
};

const ERA_1985: EraSpec = {
  eraId: '1985',
  year: 1985,
  label: 'Neon Era 1985',
  description: 'Glass curtain-wall towers, boxy sedans, fluorescent signage, shoulder pads and big hair.',
  buildings: {
    style: 'glass-curtain-wall',
    minFloors: 8,
    maxFloors: 22,
    floorHeight: 3.5,
    facadePalette: ['#5a7080', '#6a8090', '#4a6070', '#7a90a0', '#506878', '#809098'],
    windowColor: '#2a4060',
    windowEmissiveColor: '#ffe0a0',
    trimColor: '#4a4a4a',
    roofType: 'flat-mechanical',
    corniceLikelihood: 0.1,
    awningLikelihood: 0.3,
    airConditionerLikelihood: 0.7,
    groundFloorRetailLikelihood: 0.65,
  },
  vehicles: {
    silhouette: 'boxy-aero-1980s',
    wheelRadius: 0.36,
    wheelWidth: 0.16,
    paintPalette: ['#8a8a8a', '#202020', '#3a4a6a', '#6a2020', '#2a5a3a', '#b0b0b0', '#3a3a3a', '#503060', '#c0a030'],
    chromeLikelihood: 0.3,
    headlightType: 'rectangular',
    headlightColor: '#fff8e0',
    averageLength: 4.6,
    averageHeight: 1.4,
    averageWidth: 1.8,
    cabinRatio: 0.50,
    grilleStyle: 'mesh',
  },
  signage: {
    style: 'fluorescent-box',
    palette: ['#ff2040', '#20ff40', '#2040ff', '#ffff20', '#ff20ff', '#20ffff', '#ff8020', '#8020ff'],
    fontSizes: [32, 56],
    adContent: ['VIDEO RENTAL', 'ARCADE', 'PIZZA', 'CHECK CASHING', 'ELECTRONICS', 'VHS TAPES', 'CELLULAR', 'COMPUTERS', 'FAST FOOD', 'GYM', 'TANNING', 'ROLLER SKATE'],
    neonLikelihood: 0.5,
    backlitLikelihood: 0.6,
    maxWidth: 4.5,
  },
  pedestrians: {
    outfitPalette: ['#ff4080', '#4080ff', '#80ff40', '#ff8040', '#8040ff', '#40ff80', '#ffffff', '#4040ff', '#ff4040', '#808080'],
    accentPalette: ['#ffff00', '#ff00ff', '#00ffff', '#ff4040'],
    skinPalette: ['#e0b080', '#c89868', '#a67848', '#8b5e3c', '#f0c8a0', '#d4a878', '#6b4828'],
    hairPalette: ['#2a1a0a', '#3a2a15', '#5a4a30', '#8a6a3a', '#1a1a1a', '#c04020', '#e0c020'],
    hatLikelihood: 0.1,
    hatColor: '#ff4080',
    bodyScale: 1.05,
    shoulderWidth: 0.50,
    legLength: 0.90,
  },
  streets: {
    asphaltColor: '#353533',
    asphaltCrackiness: 0.25,
    sidewalkColor: '#9a928a',
    sidewalkSeamSpacing: 2.5,
    curbColor: '#7a7268',
    curbHeight: 0.15,
    lampPostStyle: 'cobra-head-sodium',
    lampPostColor: '#3a3a3a',
    lampGlowColor: '#ffa830',
    lampGlowIntensity: 0.65,
    laneMarkings: true,
    laneMarkingColor: '#e8d040',
    laneMarkingStyle: 'dashed-yellow',
    hasBikeLane: false,
    trafficLightStyle: 'mast-arm',
  },
  sky: {
    topColor: '#5a6878',
    bottomColor: '#d09868',
    fogColor: '#c89878',
    fogNear: 45,
    fogFar: 180,
    ambientColor: '#a09890',
    ambientIntensity: 0.5,
    sunColor: '#ffe0b0',
    sunIntensity: 0.85,
  },
  audio: {
    ambientType: 'synth-urban',
    trafficVolume: 0.5,
    crowdVolume: 0.35,
    sfxPalette: ['horn-1980s', 'engine-4cyl', 'arcade-beep', 'boombox'],
  },
};

const ERA_2005: EraSpec = {
  eraId: '2005',
  year: 2005,
  label: 'Modern 2005',
  description: 'Mixed-use glass towers, rounded sedans and SUVs, backlit vinyl signage, casual fashion.',
  buildings: {
    style: 'mixed-use-glass',
    minFloors: 6,
    maxFloors: 28,
    floorHeight: 3.6,
    facadePalette: ['#6a7a88', '#7a8a98', '#5a6a78', '#8a9aa8', '#606870', '#90a0a8'],
    windowColor: '#3a5060',
    windowEmissiveColor: '#fff0c8',
    trimColor: '#5a5a5a',
    roofType: 'flat-mechanical',
    corniceLikelihood: 0.05,
    awningLikelihood: 0.35,
    airConditionerLikelihood: 0.85,
    groundFloorRetailLikelihood: 0.8,
  },
  vehicles: {
    silhouette: 'rounded-sedan-2000s',
    wheelRadius: 0.34,
    wheelWidth: 0.17,
    paintPalette: ['#c0c0c0', '#e0e0e0', '#303030', '#404040', '#2a3a5a', '#5a2020', '#3a5a3a', '#a0a0a0', '#2a2a2a', '#505050'],
    chromeLikelihood: 0.1,
    headlightType: 'projector',
    headlightColor: '#ffffff',
    averageLength: 4.5,
    averageHeight: 1.5,
    averageWidth: 1.85,
    cabinRatio: 0.48,
    grilleStyle: 'horizontal-bars',
  },
  signage: {
    style: 'backlit-vinyl',
    palette: ['#ff6020', '#2060ff', '#20aa40', '#ff2040', '#aa2060', '#208080', '#606060', '#ffaa20'],
    fontSizes: [28, 48],
    adContent: ['COFFEE', 'PHARMACY', 'BANK', 'PHONE STORE', 'FITNESS', 'SUSHI', 'CONVENIENCE', 'WIRELESS', 'DENTAL', 'REAL ESTATE', 'BAGELS', 'DELI'],
    neonLikelihood: 0.2,
    backlitLikelihood: 0.8,
    maxWidth: 5.0,
  },
  pedestrians: {
    outfitPalette: ['#2a4a6a', '#4a4a4a', '#6a6a6a', '#8a3a2a', '#3a5a3a', '#5a5a8a', '#2a2a2a', '#7a6a5a', '#3a3a5a', '#6a5a3a'],
    accentPalette: ['#ff6020', '#2060ff', '#20aa40', '#ff2040'],
    skinPalette: ['#e0b080', '#c89868', '#a67848', '#8b5e3c', '#f0c8a0', '#d4a878', '#6b4828', '#4a3018'],
    hairPalette: ['#2a1a0a', '#3a2a15', '#5a4a30', '#1a1a1a', '#8a6a3a', '#c0a060'],
    hatLikelihood: 0.15,
    hatColor: '#3a3a3a',
    bodyScale: 1.08,
    shoulderWidth: 0.46,
    legLength: 0.92,
  },
  streets: {
    asphaltColor: '#2e2e2c',
    asphaltCrackiness: 0.15,
    sidewalkColor: '#908888',
    sidewalkSeamSpacing: 3.0,
    curbColor: '#6a6258',
    curbHeight: 0.14,
    lampPostStyle: 'shoebox-halide',
    lampPostColor: '#4a4a4a',
    lampGlowColor: '#fff0d0',
    lampGlowIntensity: 0.7,
    laneMarkings: true,
    laneMarkingColor: '#f0f0e0',
    laneMarkingStyle: 'dashed-white',
    hasBikeLane: true,
    trafficLightStyle: 'mast-arm-led',
  },
  sky: {
    topColor: '#3a78c0',
    bottomColor: '#b0d0e8',
    fogColor: '#b8d0e0',
    fogNear: 60,
    fogFar: 240,
    ambientColor: '#8090a0',
    ambientIntensity: 0.65,
    sunColor: '#fff8f0',
    sunIntensity: 1.05,
  },
  audio: {
    ambientType: 'pop-electronic',
    trafficVolume: 0.55,
    crowdVolume: 0.3,
    sfxPalette: ['horn-2000s', 'engine-hybrid', 'phone-ring', 'chatter-distant'],
  },
};

const ERA_2025: EraSpec = {
  eraId: '2025',
  year: 2025,
  label: 'Contemporary 2025',
  description: 'Eco smart-glass towers, sleek EVs, LED digital signage, athleisure and tech wear.',
  buildings: {
    style: 'eco-smart-glass',
    minFloors: 8,
    maxFloors: 32,
    floorHeight: 3.8,
    facadePalette: ['#506878', '#607888', '#405868', '#708898', '#485860', '#809098'],
    windowColor: '#2a4050',
    windowEmissiveColor: '#e8f0ff',
    trimColor: '#3a3a3a',
    roofType: 'solar-roof',
    corniceLikelihood: 0.0,
    awningLikelihood: 0.2,
    airConditionerLikelihood: 0.9,
    groundFloorRetailLikelihood: 0.85,
  },
  vehicles: {
    silhouette: 'sleek-ev-2020s',
    wheelRadius: 0.33,
    wheelWidth: 0.18,
    paintPalette: ['#f0f0f0', '#e0e0e0', '#1a1a1a', '#2a2a2a', '#3a4a5a', '#5a5a5a', '#c0c0c0', '#2a3a3a'],
    chromeLikelihood: 0.0,
    headlightType: 'led-strip',
    headlightColor: '#e8f0ff',
    averageLength: 4.7,
    averageHeight: 1.5,
    averageWidth: 1.95,
    cabinRatio: 0.52,
    grilleStyle: 'closed-panel',
  },
  signage: {
    style: 'led-digital',
    palette: ['#00e0ff', '#ff0060', '#00ff80', '#ffe000', '#6000ff', '#ff6000', '#ffffff', '#0080ff'],
    fontSizes: [26, 50],
    adContent: ['COFFEE', 'EV CHARGING', 'SMART HOME', 'DELIVERY', 'FITNESS', 'SUSHI', 'PHARMACY', 'E-BIKES', 'CLOUD', 'AI LAB', 'KOMBUCHA', 'BIOTECH'],
    neonLikelihood: 0.05,
    backlitLikelihood: 0.4,
    maxWidth: 5.5,
  },
  pedestrians: {
    outfitPalette: ['#1a1a1a', '#2a2a2a', '#3a3a3a', '#4a4a4a', '#2a3a4a', '#3a4a3a', '#5a4a3a', '#1a2a3a', '#4a3a2a', '#ffffff'],
    accentPalette: ['#00e0ff', '#ff0060', '#00ff80', '#ffe000'],
    skinPalette: ['#e0b080', '#c89868', '#a67848', '#8b5e3c', '#f0c8a0', '#d4a878', '#6b4828', '#4a3018'],
    hairPalette: ['#2a1a0a', '#3a2a15', '#5a4a30', '#1a1a1a', '#8a6a3a', '#c0a060', '#5a3a8a'],
    hatLikelihood: 0.25,
    hatColor: '#1a1a1a',
    bodyScale: 1.10,
    shoulderWidth: 0.48,
    legLength: 0.93,
  },
  streets: {
    asphaltColor: '#282826',
    asphaltCrackiness: 0.08,
    sidewalkColor: '#888078',
    sidewalkSeamSpacing: 3.5,
    curbColor: '#5a5248',
    curbHeight: 0.13,
    lampPostStyle: 'led-cobra',
    lampPostColor: '#3a3a3a',
    lampGlowColor: '#e8f0ff',
    lampGlowIntensity: 0.75,
    laneMarkings: true,
    laneMarkingColor: '#f8f8f0',
    laneMarkingStyle: 'dashed-white',
    hasBikeLane: true,
    trafficLightStyle: 'mast-arm-led',
  },
  sky: {
    topColor: '#2a70c8',
    bottomColor: '#b8e0f0',
    fogColor: '#b0d8e8',
    fogNear: 70,
    fogFar: 280,
    ambientColor: '#708898',
    ambientIntensity: 0.7,
    sunColor: '#fffaf0',
    sunIntensity: 1.1,
  },
  audio: {
    ambientType: 'ambient-ev',
    trafficVolume: 0.3,
    crowdVolume: 0.25,
    sfxPalette: ['ev-hum', 'notification-chime', 'scooter-beep', 'chatter-distant'],
  },
};

// ---------------------------------------------------------------------------
// Typed registry
// ---------------------------------------------------------------------------

/** Internal map of eraId → EraSpec. */
const ERA_SPECS: Record<EraId, EraSpec> = {
  '1945': ERA_1945,
  '1965': ERA_1965,
  '1985': ERA_1985,
  '2005': ERA_2005,
  '2025': ERA_2025,
};

/**
 * Retrieve the {@link EraSpec} for a given era ID from the typed registry.
 *
 * @throws if `eraId` is not a recognised era.
 */
export function getEraSpec(eraId: string): EraSpec {
  const spec = ERA_SPECS[eraId as EraId];
  if (!spec) {
    throw new Error(`Unknown eraId "${eraId}". Valid eras: ${ERA_ORDER.join(', ')}`);
  }
  return spec;
}

/** Array of all {@link EraSpec}s in chronological order. */
export const ALL_ERA_SPECS: readonly EraSpec[] = ERA_ORDER.map((id) => ERA_SPECS[id]);

/** Type guard: is `value` a valid {@link EraId}? */
export function isEraId(value: string): value is EraId {
  return (ERA_ORDER as readonly string[]).includes(value);
}

/** Find the EraId that comes before `eraId`, wrapping to the last if at the start. */
export function previousEra(eraId: EraId): EraId {
  const idx = ERA_ORDER.indexOf(eraId);
  return ERA_ORDER[(idx - 1 + ERA_ORDER.length) % ERA_ORDER.length] as EraId;
}

/** Find the EraId that comes after `eraId`, wrapping to the first if at the end. */
export function nextEra(eraId: EraId): EraId {
  const idx = ERA_ORDER.indexOf(eraId);
  return ERA_ORDER[(idx + 1) % ERA_ORDER.length] as EraId;
}
