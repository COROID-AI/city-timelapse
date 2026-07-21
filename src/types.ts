// Shared domain types for the city timelapse.
// Colors are always linear-ish RGB tuples in the 0..1 range so they can be
// lerped directly. Positions are [x, y, z] unless noted.

export type Vec3 = [number, number, number];

export type RGB = Vec3;

// ---------------------------------------------------------------------------
// Sky / lighting / atmosphere
// ---------------------------------------------------------------------------
export type SkyEra = {
  topColor: RGB;
  horizonColor: RGB;
  fogColor: RGB;
  fogNear: number;
  fogFar: number;
  sunPosition: Vec3;
  sunColor: RGB;
  sunIntensity: number;
  ambientColor: RGB;
  ambientIntensity: number;
  hemiSkyColor: RGB;
  hemiGroundColor: RGB;
  hemiIntensity: number;
  /** 0..1 visibility of a star field (used for dusk/night eras). */
  starIntensity: number;
  /** 0..1 — drives procedural cloud opacity. */
  cloudiness: number;
  /** exposure multiplier applied via postprocessing tone mapping. */
  exposure: number;
};

// ---------------------------------------------------------------------------
// Ground / street surfaces
// ---------------------------------------------------------------------------
export type GroundEra = {
  roadColor: RGB;
  sidewalkColor: RGB;
  grassColor: RGB;
  /** 0..1 wetness — boosts reflectivity of the road. */
  wetness: number;
};

// ---------------------------------------------------------------------------
// Buildings — each lot keeps a row of per-era properties that interpolate
// continuously (height morphs, facades reskin) rather than crossfading whole
// meshes. This is the visually richest and most performant approach.
// ---------------------------------------------------------------------------
export type BuildingStyle =
  | 'brick'
  | 'artdeco'
  | 'concrete'
  | 'glass'
  | 'green'
  | 'future';

export type BuildingEraProps = {
  /** metres */
  height: number;
  facadeColor: RGB;
  roofColor: RGB;
  /** window glass tint */
  windowColor: RGB;
  /** lit-window emissive colour at dusk/night */
  windowEmissive: RGB;
  /** 0..1 — fraction of the facade covered in windows */
  windowDensity: number;
  /** emissive strength of windows (0 by day, >0 at dusk/night) */
  windowGlow: number;
  style: BuildingStyle;
  /** rooftop billboard / antenna presence */
  hasAntenna: boolean;
  hasBillboard: boolean;
};

export type BuildingLot = {
  id: string;
  /** ground position [x, z] */
  position: [number, number];
  /** footprint [width, depth] in metres */
  size: [number, number];
  /** Y rotation in radians */
  rotation: number;
  /** exactly ERA_COUNT (6) entries, index aligned to eras */
  eras: BuildingEraProps[];
};

// ---------------------------------------------------------------------------
// Discrete, crossfaded content (vehicles / pedestrians / signage / props).
// These are rendered per-era and opacity-crossfaded between the two bracketing
// eras, because their silhouettes change too much to morph.
// ---------------------------------------------------------------------------
export type VehicleDef = {
  bodyColor: RGB;
  roofColor: RGB;
  /** relative scale of the whole vehicle */
  scale: number;
  /** silhouette archetype rendered procedurally */
  shape: 'classic' | 'muscle' | 'box' | 'suv' | 'ev' | 'pod';
  /** m/s along the lane */
  speed: number;
};

export type PedestrianDef = {
  /** shirt / torso colour */
  shirtColor: RGB;
  /** trousers / lower colour */
  pantsColor: RGB;
  /** hair / hat colour */
  hairColor: RGB;
  /** relative body scale */
  scale: number;
  /** archetype drives proportions */
  build: 'suit' | 'mod' | 'casual' | 'modern' | 'athleisure' | 'future';
};

export type SignageDef = {
  /** short label drawn onto the billboard canvas */
  text: string;
  background: RGB;
  foreground: RGB;
  /** neon/led glow strength */
  glow: number;
  /** billboard rendering style */
  style: 'painted' | 'neon' | 'crt' | 'led' | 'hologram';
};

export type StreetPropEra = {
  lampColor: RGB;
  lampIntensity: number;
  lampStyle: 'gas' | 'globe' | 'cobra' | 'led' | 'smart';
  benchColor: RGB;
  treeFoliage: RGB;
  treeDensity: number;
};

// ---------------------------------------------------------------------------
// Ambient audio — procedurally synthesised, no external files.
// ---------------------------------------------------------------------------
export type AmbientAudioDef = {
  /** base oscillator type for the drone bed */
  drone: number[];
  /** pink-noise-ish rumble level 0..1 */
  rumble: number;
  /** periodic transient level (engine passes / footsteps) 0..1 */
  transient: number;
  /** master ambient gain 0..1 */
  gain: number;
};

// ---------------------------------------------------------------------------
// A complete era definition (one of six).
// ---------------------------------------------------------------------------
export type EraData = {
  index: number;
  year: number;
  label: string;
  name: string;
  blurb: string;
  sky: SkyEra;
  ground: GroundEra;
  vehicles: VehicleDef[];
  pedestrians: PedestrianDef[];
  signage: SignageDef[];
  streetProp: StreetPropEra;
  ambient: AmbientAudioDef;
};
