/** Canonical, ordered timeline data shared by the scene, UI, and audio layers. */
export const ERA_IDS = ['1945', '1965', '1985', '2005', '2025', '2055'] as const;
export type EraId = (typeof ERA_IDS)[number];

export interface WorldConfig {
  architecturalStyle: string;
  buildingDensity: number;
  materials: readonly string[];
  roadSurface: string;
  vehicleProfile: string;
}

export interface AtmosphereConfig {
  sky: string;
  horizon: string;
  fog: string;
  fogDensity: number;
  weather: string;
}

export interface PopulationConfig {
  density: number;
  fashion: string;
  palette: readonly string[];
  mobility: string;
}

export interface SignageConfig {
  typography: string;
  materials: string;
  illumination: string;
  motifs: readonly string[];
}

export interface AudioConfig {
  ambient: string;
  traffic: string;
  events: readonly string[];
  music: string;
}

/** Parameters used by the procedural sound generator. */
export interface SfxEraData {
  ambientTone: number;
  ambientHarmonics: readonly number[];
  ambientNoise: number;
  ambientFilter: number;
  trafficProfile: number;
  trafficPitch: number;
  eventTypes: readonly string[];
  musicStyle: string;
  musicNotes: readonly number[];
}

export interface EraConfiguration {
  world: WorldConfig;
  atmosphere: AtmosphereConfig;
  population: PopulationConfig;
  signage: SignageConfig;
  audio: AudioConfig;
}

export interface EraSpec {
  id: EraId;
  year: number;
  label: string;
  description: string;
  config: EraConfiguration;
}

export interface TransitionProgress {
  from: EraId;
  to: EraId;
  /** Normalized progress in the inclusive [0, 1] range. */
  progress: number;
  isTransitioning: boolean;
}

const makeEra = (
  id: EraId,
  label: string,
  description: string,
  world: WorldConfig,
  atmosphere: AtmosphereConfig,
  population: PopulationConfig,
  signage: SignageConfig,
  audio: AudioConfig,
): EraSpec => ({ id, year: Number(id), label, description, config: { world, atmosphere, population, signage, audio } });

/** Exactly the six timeline eras, in chronological order. */
export const ERA_REGISTRY = [
  makeEra('1945', 'Postwar modernity', 'Brick façades and trolley wires at dusk.',
    { architecturalStyle: 'streamline modern and postwar brick', buildingDensity: 0.56, materials: ['red brick', 'cast iron', 'timber'], roadSurface: 'patched asphalt and granite curb', vehicleProfile: 'postwar sedans and delivery lorries' },
    { sky: '#1c2b3b', horizon: '#c28b62', fog: '#80675a', fogDensity: 0.008, weather: 'coal-softened evening air' },
    { density: 0.38, fashion: 'tailored wool coats and workwear', palette: ['ink', 'cream', 'signal red'], mobility: 'walking, bicycles, and trolley stops' },
    { typography: 'painted serif and enamel lettering', materials: 'painted wood and porcelain enamel', illumination: 'incandescent window glow', motifs: ['radio', 'cinema', 'local grocer'] },
    { ambient: 'tube-radio hush and distant trolley hum', traffic: 'low-speed mechanical engines', events: ['tram bell', 'bicycle bell', 'shop door chime'], music: 'swing quartet' }),
  makeEra('1965', 'Bright new city', 'Bold colors, chrome, and a confident rush toward tomorrow.',
    { architecturalStyle: 'mid-century civic towers and low-rise shops', buildingDensity: 0.62, materials: ['exposed concrete', 'chrome', 'colored glass'], roadSurface: 'fresh asphalt and painted lanes', vehicleProfile: 'chrome-heavy compact cars and buses' },
    { sky: '#18344b', horizon: '#f0a86b', fog: '#738894', fogDensity: 0.007, weather: 'clear summer haze' },
    { density: 0.48, fashion: 'mod tailoring and patterned dresses', palette: ['petrol blue', 'sun yellow', 'warm white'], mobility: 'bus commuters and pedestrian plazas' },
    { typography: 'geometric sans serif and neon tubing', materials: 'backlit acrylic and brushed aluminum', illumination: 'colored fluorescent bands', motifs: ['space-age appliances', 'motor cars', 'record shops'] },
    { ambient: 'fluorescent buzz and plaza fountain', traffic: 'light buses and compact engines', events: ['bus brake hiss', 'payphone ring', 'crossing signal'], music: 'soul and early electronic pop' }),
  makeEra('1985', 'Electric decade', 'Glass, synths, and saturated light reshape the block.',
    { architecturalStyle: 'postmodern offices and renovated storefronts', buildingDensity: 0.7, materials: ['reflective glass', 'pink granite', 'painted steel'], roadSurface: 'dark asphalt with reflective markings', vehicleProfile: 'boxy hatchbacks, taxis, and vans' },
    { sky: '#101d3e', horizon: '#d45b77', fog: '#3d4c73', fogDensity: 0.006, weather: 'humid neon twilight' },
    { density: 0.57, fashion: 'denim, power tailoring, and bright trainers', palette: ['cobalt', 'magenta', 'concrete grey'], mobility: 'taxis, arcades, and cassette commuters' },
    { typography: 'condensed display type and pixel lettering', materials: 'perspex, vinyl, and mirrored glass', illumination: 'neon tubes and CRT flicker', motifs: ['video rental', 'arcade', 'personal computers'] },
    { ambient: 'air-conditioning drone and arcade bleed', traffic: 'busy petrol engines and taxi radios', events: ['arcade attract tone', 'taxi horn', 'camera shutter'], music: 'analog synth and drum machine' }),
  makeEra('2005', 'Always connected', 'Glass retail, global brands, and the first smartphone glow.',
    { architecturalStyle: 'mixed-use glass redevelopment and loft conversions', buildingDensity: 0.78, materials: ['curtain wall glass', 'galvanized steel', 'painted render'], roadSurface: 'marked asphalt with curbside parking', vehicleProfile: 'hybrids, SUVs, and articulated buses' },
    { sky: '#152844', horizon: '#ee906b', fog: '#617286', fogDensity: 0.005, weather: 'post-rain urban clarity' },
    { density: 0.67, fashion: 'streetwear, office casual, and messenger bags', palette: ['graphite', 'electric blue', 'lime'], mobility: 'rail, buses, and cycling lanes' },
    { typography: 'web-inspired sans serif and LED billboards', materials: 'vinyl wrap, LED panels, and composite', illumination: 'cool LED and storefront halogen', motifs: ['mobile plans', 'social networks', 'coffee chains'] },
    { ambient: 'HVAC, laptop fans, and pedestrian murmur', traffic: 'dense combustion traffic with hybrid whine', events: ['crosswalk chirp', 'flip-phone ring', 'bus kneel hiss'], music: 'indie rock and compressed dance' }),
  makeEra('2025', 'Responsive city', 'Living façades, quiet mobility, and a block tuned by data.',
    { architecturalStyle: 'adaptive mixed-use infill and green retrofits', buildingDensity: 0.84, materials: ['low-iron glass', 'recycled brick', 'cross-laminated timber'], roadSurface: 'permeable paving and protected cycle lane', vehicleProfile: 'electric cars, e-bikes, and autonomous shuttles' },
    { sky: '#0d2038', horizon: '#d38f78', fog: '#4f6f78', fogDensity: 0.004, weather: 'clean air after a light shower' },
    { density: 0.74, fashion: 'layered technical fabrics and expressive basics', palette: ['slate', 'amber', 'digital cyan'], mobility: 'micromobility, rideshare, and outdoor workspaces' },
    { typography: 'variable sans serif and dynamic wayfinding', materials: 'e-ink, recycled composite, and projection film', illumination: 'adaptive screens and edge light', motifs: ['clean energy', 'local platforms', 'community market'] },
    { ambient: 'leafy plaza, ventilation, and soft notification tones', traffic: 'quiet electric drivetrains and tire wash', events: ['bike bell', 'delivery robot chirp', 'shuttle tone'], music: 'ambient electronica and global radio' }),
  makeEra('2055', 'Luminous commons', 'A climate-adapted district where architecture and atmosphere flow together.',
    { architecturalStyle: 'carbon-positive arcologies and reconfigurable commons', buildingDensity: 0.91, materials: ['bio-ceramic', 'photovoltaic glass', 'living canopy'], roadSurface: 'water-sensitive plaza and transit ribbons', vehicleProfile: 'shared autonomous pods and aerial logistics' },
    { sky: '#121b3f', horizon: '#b46be0', fog: '#443b78', fogDensity: 0.003, weather: 'violet-blue evening with managed mist' },
    { density: 0.81, fashion: 'adaptive garments and luminous civic badges', palette: ['deep violet', 'solar gold', 'holographic cyan'], mobility: 'autonomous transit and elevated walkways' },
    { typography: 'spatial type and multilingual light fields', materials: 'programmable glass and responsive bioplastic', illumination: 'holographic projection and solar edge light', motifs: ['circular exchange', 'orbital weather', 'neighborhood AI'] },
    { ambient: 'photonic canopy, filtered wind, and civic soundscape', traffic: 'near-silent electric transit and aerial rotors', events: ['wayfinding pulse', 'pod arrival tone', 'rain catch'], music: 'generative spatial music' }),
] as const satisfies readonly EraSpec[];


/** Audio identity for each timeline stop; all sounds are synthesized offline. */
export const SFX_ERA_DATA: Record<EraId, SfxEraData> = {
  '1945': { ambientTone: 92, ambientHarmonics: [1, 2, 3], ambientNoise: 0.24, ambientFilter: 760, trafficProfile: 0.28, trafficPitch: 74, eventTypes: ['tram-bell', 'bicycle-bell', 'shop-chime'], musicStyle: 'swing quartet', musicNotes: [196, 247, 294, 392] },
  '1965': { ambientTone: 128, ambientHarmonics: [1, 2, 4], ambientNoise: 0.2, ambientFilter: 1100, trafficProfile: 0.43, trafficPitch: 104, eventTypes: ['bus-hiss', 'payphone-ring', 'crossing-signal'], musicStyle: 'soul and early electronic pop', musicNotes: [220, 277, 330, 440] },
  '1985': { ambientTone: 184, ambientHarmonics: [1, 2, 5], ambientNoise: 0.18, ambientFilter: 1700, trafficProfile: 0.68, trafficPitch: 128, eventTypes: ['arcade-tone', 'taxi-horn', 'camera-shutter'], musicStyle: 'analog synth and drum machine', musicNotes: [165, 208, 247, 330] },
  '2005': { ambientTone: 226, ambientHarmonics: [1, 3, 6], ambientNoise: 0.16, ambientFilter: 2200, trafficProfile: 0.78, trafficPitch: 156, eventTypes: ['crosswalk-chirp', 'phone-ring', 'bus-kneel'], musicStyle: 'indie rock and compressed dance', musicNotes: [147, 185, 220, 294] },
  '2025': { ambientTone: 294, ambientHarmonics: [1, 2, 6], ambientNoise: 0.13, ambientFilter: 2800, trafficProfile: 0.42, trafficPitch: 196, eventTypes: ['bike-bell', 'delivery-chirp', 'shuttle-tone'], musicStyle: 'ambient electronica and global radio', musicNotes: [196, 247, 311, 415] },
  '2055': { ambientTone: 392, ambientHarmonics: [1, 3, 5, 8], ambientNoise: 0.1, ambientFilter: 3600, trafficProfile: 0.2, trafficPitch: 248, eventTypes: ['wayfinding-pulse', 'pod-arrival', 'rain-catch'], musicStyle: 'generative spatial music', musicNotes: [131, 196, 262, 392] },
};

export function getEraSpec(id: EraId): EraSpec {
  const spec = ERA_REGISTRY.find((candidate) => candidate.id === id);
  if (!spec) throw new Error(`Unknown era: ${id}`);
  return spec;
}
