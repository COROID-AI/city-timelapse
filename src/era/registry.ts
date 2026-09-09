/**
 * Registry holding full specification data for all five eras: 1945, 1965, 1985, 2005, 2025.
 *
 * Types and pure data only — no THREE imports and no DOM access.
 */

import type { EraSpec, BuildingsEraSpec, SignageEraSpec, VehiclesEraSpec, PedestriansEraSpec, AtmosphereEraSpec, AudioEraSpec } from './types';
import { ERAS, type EraId } from './years';

export interface EraRegistry {
  /**
   * Retrieves the EraSpec for a given EraId. Throws if missing or incomplete.
   */
  getEra(id: EraId): EraSpec;

  /**
   * Returns all EraSpec objects in chronological order (1945 -> 2025).
   */
  getAllEras(): readonly EraSpec[];

  /**
   * Validates that all five eras are present, well-formed, and complete.
   * Returns true if valid, or throws an Error detailing the validation failure.
   */
  validate(): boolean;
}

// ---------------------------------------------------------------------------
// 1945 Era Data
// ---------------------------------------------------------------------------

const BUILDINGS_1945: BuildingsEraSpec = {
  styleName: 'Post-War Brick Tenements & Art Deco Embellishments',
  facadePalette: ['#5c2c16', '#78350f', '#451a03', '#854d0e', '#3f3f46'],
  frameColor: '#1c1917',
  windowEmissiveColor: '#fef08a',
  windowIlluminationRate: 0.5,
  heightScale: 1.0,
  roofStyle: 'mansard',
  fireEscapes: true,
  architecturalDetailLevel: 0.85,
  streetFurniture: ['cast_iron_trash_can', 'newspaper_kiosk', 'fire_hydrant_vintage'],
  weatheringFactor: 0.8,
};

const SIGNAGE_1945: SignageEraSpec = {
  primaryTech: 'painted_wood_metal',
  typographyStyle: 'Vintage Art Deco Serif & Hand-Painted Enamel',
  colorPalette: ['#b91c1c', '#1e3a8a', '#d97706', '#fef3c7', '#1c1917'],
  glowIntensity: 0.3,
  flickerRate: 1.5,
  density: 0.4,
  signs: [
    { text: 'RADIO & PHONO', category: 'storefront', primaryColor: '#d97706', accentColor: '#1c1917', tech: 'painted_wood_metal' },
    { text: 'WAR BONDS VICTORY', category: 'billboard', primaryColor: '#1e3a8a', accentColor: '#b91c1c', tech: 'painted_wood_metal' },
    { text: 'DINER', category: 'blade', primaryColor: '#b91c1c', accentColor: '#fef3c7', tech: 'neon_incandescent_bulbs' },
    { text: 'HOTEL ASTOR', category: 'rooftop', primaryColor: '#f59e0b', accentColor: '#78350f', tech: 'neon_incandescent_bulbs' },
  ],
};

const VEHICLES_1945: VehiclesEraSpec = {
  themeName: 'Curved Fender Coupes & Heavy Chrome Grilles',
  vehicleCount: 4,
  averageSpeed: 7.0,
  bodyColors: ['#18181b', '#1e293b', '#451a03', '#14532d', '#713f12'],
  headlightColor: '#fef3c7',
  headlightIntensity: 0.8,
  taillightColor: '#991b1b',
  exhaustEmissionRate: 0.9,
  models: [
    { type: 'vintage_fender_sedan', name: '1942 Custom Coupe', relativeFrequency: 0.6, length: 4.8, width: 1.9, height: 1.7 },
    { type: 'vintage_fender_sedan', name: 'Post-War Fleetline', relativeFrequency: 0.4, length: 5.0, width: 1.95, height: 1.75 },
  ],
};

const PEDESTRIANS_1945: PedestriansEraSpec = {
  fashionStyle: 'Double-Breasted Suits, Trench Coats, Cloche Hats & Tea Dresses',
  crowdDensity: 6,
  walkSpeed: 1.2,
  outfits: [
    {
      description: 'Fedora & Trench Coat',
      topPalette: ['#78716c', '#44403c', '#292524'],
      bottomPalette: ['#44403c', '#1c1917'],
      accessories: ['fedora', 'briefcase'],
    },
    {
      description: 'Pleated Tea Dress & Wool Cardigan',
      topPalette: ['#047857', '#991b1b', '#1e3a8a'],
      bottomPalette: ['#065f46', '#7f1d1d', '#1e293b'],
      accessories: ['cloche_hat', 'leather_purse'],
    },
  ],
  propProbability: 0.65,
  typicalProps: ['folded_newspaper', 'leather_briefcase', 'umbrella', 'pocket_watch'],
};

const ATMOSPHERE_1945: AtmosphereEraSpec = {
  skyGradient: {
    zenith: '#475569',
    horizon: '#d6d3d1',
    ground: '#292524',
  },
  sunColor: '#fed7aa',
  sunIntensity: 0.85,
  sunPosition: [-12, 18, 14],
  ambientColor: '#78716c',
  ambientIntensity: 0.45,
  fogColor: '#cbd5e1',
  fogDensity: 0.018,
  streetLampColor: '#fef3c7',
  streetLampIntensity: 0.9,
  streetLampStyle: 'cast_iron_gas',
  hazeFactor: 0.75,
  colorGradeMood: 'warm_sepia',
};

const AUDIO_1945: AudioEraSpec = {
  themeTitle: 'Victory Boulevard Swing',
  genre: 'Big Band & Swing Orchestra',
  bpm: 112,
  synthProfile: 'big_band_swing',
  ambienceProfile: 'clattering_trams_horns',
  filterProfile: 'am_radio_lofi',
  hornType: 'vintage_klaxon',
};

// ---------------------------------------------------------------------------
// 1965 Era Data
// ---------------------------------------------------------------------------

const BUILDINGS_1965: BuildingsEraSpec = {
  styleName: 'Mid-Century Modern & International Style Glass/Steel Panels',
  facadePalette: ['#9ca3af', '#64748b', '#cbd5e1', '#b45309', '#0f766e'],
  frameColor: '#334155',
  windowEmissiveColor: '#fef9c3',
  windowIlluminationRate: 0.6,
  heightScale: 1.25,
  roofStyle: 'flat_water_tower',
  fireEscapes: true,
  architecturalDetailLevel: 0.6,
  streetFurniture: ['concrete_planter', 'midcentury_mailbox', 'fire_hydrant_yellow'],
  weatheringFactor: 0.5,
};

const SIGNAGE_1965: SignageEraSpec = {
  primaryTech: 'neon_incandescent_bulbs',
  typographyStyle: 'Geometric Sans-Serif & Glowing Script Neon',
  colorPalette: ['#06b6d4', '#ec4899', '#eab308', '#ef4444', '#3b82f6'],
  glowIntensity: 1.2,
  flickerRate: 3.5,
  density: 0.7,
  signs: [
    { text: 'MOTEL VACANCY', category: 'blade', primaryColor: '#06b6d4', accentColor: '#ec4899', tech: 'neon_incandescent_bulbs' },
    { text: 'HI-FI STEREO CENTER', category: 'storefront', primaryColor: '#eab308', accentColor: '#3b82f6', tech: 'backlit_acrylic_lightboxes' },
    { text: 'DRIVE-IN BURGERS', category: 'storefront', primaryColor: '#ef4444', accentColor: '#fef08a', tech: 'neon_incandescent_bulbs' },
    { text: 'KODAK COLOR FILM', category: 'billboard', primaryColor: '#f59e0b', accentColor: '#dc2626', tech: 'painted_wood_metal' },
  ],
};

const VEHICLES_1965: VehiclesEraSpec = {
  themeName: 'Tailfin Sedans & Chrome Cruiser Convertibles',
  vehicleCount: 6,
  averageSpeed: 8.5,
  bodyColors: ['#0284c7', '#dc2626', '#16a34a', '#f8fafc', '#ea580c'],
  headlightColor: '#fffbeb',
  headlightIntensity: 1.0,
  taillightColor: '#dc2626',
  exhaustEmissionRate: 0.7,
  models: [
    { type: 'midcentury_finned_cruiser', name: 'Bel Air Hardtop', relativeFrequency: 0.55, length: 5.2, width: 2.0, height: 1.55 },
    { type: 'midcentury_finned_cruiser', name: 'Continental Cruiser', relativeFrequency: 0.45, length: 5.4, width: 2.05, height: 1.5 },
  ],
};

const PEDESTRIANS_1965: PedestriansEraSpec = {
  fashionStyle: 'Mod Shift Dresses, Slim Suits, Skinny Ties & Bell-Bottom Accents',
  crowdDensity: 8,
  walkSpeed: 1.3,
  outfits: [
    {
      description: 'Slim Charcoal Suit & Skinny Tie',
      topPalette: ['#334155', '#475569', '#1e293b'],
      bottomPalette: ['#334155', '#1e293b'],
      accessories: ['sunglasses_wayfarer', 'leather_attache'],
    },
    {
      description: 'Geometric Mod Color-Block Shift Dress',
      topPalette: ['#e11d48', '#f59e0b', '#0284c7'],
      bottomPalette: ['#f8fafc', '#0f172a'],
      accessories: ['cat_eye_glasses', 'tote_bag'],
    },
  ],
  propProbability: 0.5,
  typicalProps: ['transistor_radio', 'paperback_book', 'attache_case', 'cigarette_case'],
};

const ATMOSPHERE_1965: AtmosphereEraSpec = {
  skyGradient: {
    zenith: '#38bdf8',
    horizon: '#fed7aa',
    ground: '#334155',
  },
  sunColor: '#fef08a',
  sunIntensity: 1.1,
  sunPosition: [-10, 20, 12],
  ambientColor: '#94a3b8',
  ambientIntensity: 0.55,
  fogColor: '#e2e8f0',
  fogDensity: 0.012,
  streetLampColor: '#fed7aa',
  streetLampIntensity: 1.1,
  streetLampStyle: 'curved_gooseneck',
  hazeFactor: 0.5,
  colorGradeMood: 'technicolor_warm',
};

const AUDIO_1965: AudioEraSpec = {
  themeTitle: 'Downtown Groove Express',
  genre: 'Mod Rock, Motown & Soul',
  bpm: 124,
  synthProfile: 'motown_mod_rock',
  ambienceProfile: 'rumbling_v8_chatter',
  filterProfile: 'vinyl_warmth',
  hornType: 'classic_car_horn',
};

// ---------------------------------------------------------------------------
// 1985 Era Data
// ---------------------------------------------------------------------------

const BUILDINGS_1985: BuildingsEraSpec = {
  styleName: 'Postmodernist Concrete, Mirrored Glass & Angular Facades',
  facadePalette: ['#64748b', '#475569', '#94a3b8', '#0284c7', '#be185d'],
  frameColor: '#0f172a',
  windowEmissiveColor: '#a5f3fc',
  windowIlluminationRate: 0.75,
  heightScale: 1.55,
  roofStyle: 'flat_ac_units',
  fireEscapes: false,
  architecturalDetailLevel: 0.5,
  streetFurniture: ['concrete_bollard', 'aluminum_bench', 'payphone_booth'],
  weatheringFactor: 0.35,
};

const SIGNAGE_1985: SignageEraSpec = {
  primaryTech: 'backlit_acrylic_lightboxes',
  typographyStyle: 'Bold Geometric Neon, Chrome Italic & Acrylic Channel Letters',
  colorPalette: ['#ec4899', '#06b6d4', '#a855f7', '#f43f5e', '#eab308'],
  glowIntensity: 1.6,
  flickerRate: 5.0,
  density: 0.85,
  signs: [
    { text: 'VIDEO ARCADE 24H', category: 'storefront', primaryColor: '#ec4899', accentColor: '#06b6d4', tech: 'neon_incandescent_bulbs' },
    { text: 'SYNTH-TECH SOUND', category: 'storefront', primaryColor: '#06b6d4', accentColor: '#a855f7', tech: 'backlit_acrylic_lightboxes' },
    { text: 'MAX-COLA FRESH', category: 'billboard', primaryColor: '#ef4444', accentColor: '#ffffff', tech: 'backlit_acrylic_lightboxes' },
    { text: 'PLAZA CLUB', category: 'rooftop', primaryColor: '#a855f7', accentColor: '#f43f5e', tech: 'neon_incandescent_bulbs' },
  ],
};

const VEHICLES_1985: VehiclesEraSpec = {
  themeName: 'Angular Wedge Sedans & Boxy Hatchbacks',
  vehicleCount: 8,
  averageSpeed: 9.5,
  bodyColors: ['#dc2626', '#e2e8f0', '#0f172a', '#2563eb', '#ca8a04'],
  headlightColor: '#fef08a',
  headlightIntensity: 1.2,
  taillightColor: '#ef4444',
  exhaustEmissionRate: 0.5,
  models: [
    { type: 'angular_eighties_box', name: 'Sprint Turbo Hatch', relativeFrequency: 0.6, length: 4.3, width: 1.75, height: 1.4 },
    { type: 'angular_eighties_box', name: 'Executive Wedge Sedan', relativeFrequency: 0.4, length: 4.7, width: 1.8, height: 1.42 },
  ],
};

const PEDESTRIANS_1985: PedestriansEraSpec = {
  fashionStyle: 'Padded Shoulders, Acid-Wash Denim, Neon Windbreakers & High Tops',
  crowdDensity: 10,
  walkSpeed: 1.35,
  outfits: [
    {
      description: 'Power Suit with Shoulder Pads',
      topPalette: ['#1e1b4b', '#831843', '#064e3b'],
      bottomPalette: ['#1e1b4b', '#831843'],
      accessories: ['aviator_glasses', 'leather_portfolio'],
    },
    {
      description: 'Acid Wash Denim Jacket & Neon Accents',
      topPalette: ['#38bdf8', '#f43f5e', '#a855f7'],
      bottomPalette: ['#93c5fd', '#374151'],
      accessories: ['cassette_walkman', 'headphones'],
    },
  ],
  propProbability: 0.6,
  typicalProps: ['portable_cassette_walkman', 'shoulder_boombox', 'analog_camera', 'rolled_magazine'],
};

const ATMOSPHERE_1985: AtmosphereEraSpec = {
  skyGradient: {
    zenith: '#1e1b4b',
    horizon: '#f43f5e',
    ground: '#1e293b',
  },
  sunColor: '#fb923c',
  sunIntensity: 1.25,
  sunPosition: [-8, 16, 10],
  ambientColor: '#818cf8',
  ambientIntensity: 0.6,
  fogColor: '#c084fc',
  fogDensity: 0.01,
  streetLampColor: '#fed7aa',
  streetLampIntensity: 1.3,
  streetLampStyle: 'square_cobra',
  hazeFactor: 0.4,
  colorGradeMood: 'cool_contrast_80s',
};

const AUDIO_1985: AudioEraSpec = {
  themeTitle: 'Neon Grid Runners',
  genre: 'Synthwave & Post-Punk Electro',
  bpm: 120,
  synthProfile: 'synthwave_post_punk',
  ambienceProfile: 'bustling_city_hiss',
  filterProfile: 'cassette_tape_analog',
  hornType: 'electric_dual_tone',
};

// ---------------------------------------------------------------------------
// 2005 Era Data
// ---------------------------------------------------------------------------

const BUILDINGS_2005: BuildingsEraSpec = {
  styleName: 'High-Tech Modernism, Curtain Walls & Composite Cladding',
  facadePalette: ['#475569', '#334155', '#e2e8f0', '#0369a1', '#15803d'],
  frameColor: '#64748b',
  windowEmissiveColor: '#e0f2fe',
  windowIlluminationRate: 0.85,
  heightScale: 1.85,
  roofStyle: 'green_roof',
  fireEscapes: false,
  architecturalDetailLevel: 0.7,
  streetFurniture: ['stainless_bollard', 'glass_bus_shelter', 'digital_parking_meter'],
  weatheringFactor: 0.15,
};

const SIGNAGE_2005: SignageEraSpec = {
  primaryTech: 'digital_led_billboards',
  typographyStyle: 'Clean Minimalist Sans, Glossy Vector & LED Matrices',
  colorPalette: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ffffff'],
  glowIntensity: 1.9,
  flickerRate: 0,
  density: 0.9,
  signs: [
    { text: 'CYBER-CAFE & BROADBAND', category: 'storefront', primaryColor: '#3b82f6', accentColor: '#ffffff', tech: 'backlit_acrylic_lightboxes' },
    { text: 'SMART PHONE WIRELESS', category: 'storefront', primaryColor: '#10b981', accentColor: '#0f172a', tech: 'digital_led_billboards' },
    { text: 'GLOBAL TECH MEDIA', category: 'billboard', primaryColor: '#f59e0b', accentColor: '#1e3a8a', tech: 'digital_led_billboards' },
    { text: 'METRO EXCHANGE', category: 'rooftop', primaryColor: '#ffffff', accentColor: '#0284c7', tech: 'digital_led_billboards' },
  ],
};

const VEHICLES_2005: VehiclesEraSpec = {
  themeName: 'Aerodynamic Curvature & Compact Crossovers',
  vehicleCount: 9,
  averageSpeed: 10.0,
  bodyColors: ['#94a3b8', '#1e293b', '#dc2626', '#2563eb', '#f1f5f9'],
  headlightColor: '#f8fafc',
  headlightIntensity: 1.4,
  taillightColor: '#dc2626',
  exhaustEmissionRate: 0.3,
  models: [
    { type: 'curved_two_thousands_sedan', name: 'Aero 4-Door Hybrid', relativeFrequency: 0.6, length: 4.5, width: 1.8, height: 1.48 },
    { type: 'curved_two_thousands_sedan', name: 'Urban Compact Crossover', relativeFrequency: 0.4, length: 4.4, width: 1.82, height: 1.6 },
  ],
};

const PEDESTRIANS_2005: PedestriansEraSpec = {
  fashionStyle: 'Low-Rise Denim, Cargo Pants, Track Jackets, Flip Phones & MP3 Players',
  crowdDensity: 11,
  walkSpeed: 1.4,
  outfits: [
    {
      description: 'Sporty Track Jacket & Cargo Pants',
      topPalette: ['#1e3a8a', '#047857', '#b91c1c'],
      bottomPalette: ['#64748b', '#475569'],
      accessories: ['messenger_bag', 'flip_phone'],
    },
    {
      description: 'Fitted Tee & Layered Hoodie',
      topPalette: ['#f43f5e', '#3b82f6', '#10b981'],
      bottomPalette: ['#3b82f6', '#1e293b'],
      accessories: ['wired_earbuds', 'backpack'],
    },
  ],
  propProbability: 0.75,
  typicalProps: ['flip_phone', 'white_earbud_mp3', 'takeout_coffee_cup', 'messenger_bag'],
};

const ATMOSPHERE_2005: AtmosphereEraSpec = {
  skyGradient: {
    zenith: '#0284c7',
    horizon: '#bae6fd',
    ground: '#1e293b',
  },
  sunColor: '#fffbeb',
  sunIntensity: 1.3,
  sunPosition: [-6, 22, 8],
  ambientColor: '#bae6fd',
  ambientIntensity: 0.65,
  fogColor: '#e0f2fe',
  fogDensity: 0.008,
  streetLampColor: '#f8fafc',
  streetLampIntensity: 1.4,
  streetLampStyle: 'modern_pole',
  hazeFactor: 0.25,
  colorGradeMood: 'digital_crisp_00s',
};

const AUDIO_2005: AudioEraSpec = {
  themeTitle: 'Millennium Digital Pulse',
  genre: 'Y2K Electronic Pop & Nu-Jazz',
  bpm: 128,
  synthProfile: 'y2k_electronic_pop',
  ambienceProfile: 'traffic_dense_sirens',
  filterProfile: 'cd_digital_clean',
  hornType: 'modern_beep',
};

// ---------------------------------------------------------------------------
// 2025 Era Data
// ---------------------------------------------------------------------------

const BUILDINGS_2025: BuildingsEraSpec = {
  styleName: 'Eco-Futuristic Vertical Gardens, Smart Glass & Photovoltaic Spreading',
  facadePalette: ['#0f172a', '#1e293b', '#334155', '#10b981', '#06b6d4'],
  frameColor: '#0f172a',
  windowEmissiveColor: '#f0fdf4',
  windowIlluminationRate: 0.9,
  heightScale: 2.2,
  roofStyle: 'solar_spire',
  fireEscapes: false,
  architecturalDetailLevel: 0.9,
  streetFurniture: ['smart_bike_dock', 'ev_charging_hub', 'digital_wayfinding_kiosk'],
  weatheringFactor: 0.05,
};

const SIGNAGE_2025: SignageEraSpec = {
  primaryTech: 'holographic_oled_screens',
  typographyStyle: 'Ultra-Minimalist Variable Sans & Dynamic Holographic Micro-Motion',
  colorPalette: ['#38bdf8', '#34d399', '#a78bfa', '#f472b6', '#ffffff'],
  glowIntensity: 2.4,
  flickerRate: 0,
  density: 0.95,
  signs: [
    { text: 'QUANTUM BIOLABS', category: 'storefront', primaryColor: '#34d399', accentColor: '#0f172a', tech: 'holographic_oled_screens' },
    { text: 'AURA MOBILITY EV', category: 'storefront', primaryColor: '#38bdf8', accentColor: '#ffffff', tech: 'holographic_oled_screens' },
    { text: 'SYNAPSE CLOUD AR', category: 'billboard', primaryColor: '#a78bfa', accentColor: '#34d399', tech: 'holographic_oled_screens' },
    { text: 'SOLARIS TOWER', category: 'rooftop', primaryColor: '#38bdf8', accentColor: '#f472b6', tech: 'holographic_oled_screens' },
  ],
};

const VEHICLES_2025: VehiclesEraSpec = {
  themeName: 'Autonomous Electric Pods & Sleek Cyber Crossovers',
  vehicleCount: 10,
  averageSpeed: 11.0,
  bodyColors: ['#0f172a', '#f8fafc', '#0284c7', '#10b981', '#475569'],
  headlightColor: '#e0f2fe',
  headlightIntensity: 1.6,
  taillightColor: '#f43f5e',
  exhaustEmissionRate: 0.0,
  models: [
    { type: 'sleek_ev_crossover', name: 'Aero EV Cyber Cruiser', relativeFrequency: 0.65, length: 4.8, width: 1.95, height: 1.45 },
    { type: 'sleek_ev_crossover', name: 'Autonomous Micro-Pod', relativeFrequency: 0.35, length: 3.2, width: 1.6, height: 1.7 },
  ],
};

const PEDESTRIANS_2025: PedestriansEraSpec = {
  fashionStyle: 'Athleisure, Technical Waterproof Outerwear, Minimalist Tailoring & Smart Glass',
  crowdDensity: 12,
  walkSpeed: 1.45,
  outfits: [
    {
      description: 'Technical Outerwear & Minimalist Monochromatic Athleisure',
      topPalette: ['#0f172a', '#f8fafc', '#334155', '#0d9488'],
      bottomPalette: ['#0f172a', '#1e293b'],
      accessories: ['smart_ar_glasses', 'smartwatch'],
    },
    {
      description: 'Oversized Eco-Linen Blazer & Tailored Trousers',
      topPalette: ['#d6d3d1', '#78716c', '#0284c7'],
      bottomPalette: ['#d6d3d1', '#292524'],
      accessories: ['wireless_headband', 'smartphone'],
    },
  ],
  propProbability: 0.9,
  typicalProps: ['bezel_less_smartphone', 'smart_glasses', 'hydro_flask', 'electric_scooter'],
};

const ATMOSPHERE_2025: AtmosphereEraSpec = {
  skyGradient: {
    zenith: '#0369a1',
    horizon: '#7dd3fc',
    ground: '#0f172a',
  },
  sunColor: '#ffffff',
  sunIntensity: 1.4,
  sunPosition: [-4, 24, 6],
  ambientColor: '#e0f2fe',
  ambientIntensity: 0.75,
  fogColor: '#f0f9ff',
  fogDensity: 0.005,
  streetLampColor: '#e0f2fe',
  streetLampIntensity: 1.6,
  streetLampStyle: 'smart_led_spire',
  hazeFactor: 0.1,
  colorGradeMood: 'hdr_vibrant_modern',
};

const AUDIO_2025: AudioEraSpec = {
  themeTitle: 'Solar City Future Sound',
  genre: 'Modern Ambient Lo-Fi & Hyper-Spatial Beats',
  bpm: 116,
  synthProfile: 'modern_ambient_lofi',
  ambienceProfile: 'quiet_ev_hum_breeze',
  filterProfile: 'lossless_spacious',
  hornType: 'gentle_ev_chime',
};

// ---------------------------------------------------------------------------
// Unified Eras Dictionary
// ---------------------------------------------------------------------------

const ERA_SPECS: Record<EraId, EraSpec> = {
  '1945': {
    id: '1945',
    year: 1945,
    label: '1945',
    subtitle: 'Post-War Dawn',
    summary: 'Heavy masonry tenements, vintage fender coupes, big band swing, and warm incandescent glow.',
    buildings: BUILDINGS_1945,
    signage: SIGNAGE_1945,
    vehicles: VEHICLES_1945,
    pedestrians: PEDESTRIANS_1945,
    atmosphere: ATMOSPHERE_1945,
    audio: AUDIO_1945,
  },
  '1965': {
    id: '1965',
    year: 1965,
    label: '1965',
    subtitle: 'Mid-Century Boom',
    summary: 'Chrome tailfins, mod shift dresses, vibrant glowing neon, and vibrant Motown rhythms.',
    buildings: BUILDINGS_1965,
    signage: SIGNAGE_1965,
    vehicles: VEHICLES_1965,
    pedestrians: PEDESTRIANS_1965,
    atmosphere: ATMOSPHERE_1965,
    audio: AUDIO_1965,
  },
  '1985': {
    id: '1985',
    year: 1985,
    label: '1985',
    subtitle: 'Neon Horizon',
    summary: 'Postmodern mirrored glass, synthwave pulses, boxy turbo sedans, and backlit acrylics.',
    buildings: BUILDINGS_1985,
    signage: SIGNAGE_1985,
    vehicles: VEHICLES_1985,
    pedestrians: PEDESTRIANS_1985,
    atmosphere: ATMOSPHERE_1985,
    audio: AUDIO_1985,
  },
  '2005': {
    id: '2005',
    year: 2005,
    label: '2005',
    subtitle: 'Millennium Turn',
    summary: 'High-tech glass towers, digital LED screens, aerodynamic hybrids, and Y2K pop energy.',
    buildings: BUILDINGS_2005,
    signage: SIGNAGE_2005,
    vehicles: VEHICLES_2005,
    pedestrians: PEDESTRIANS_2005,
    atmosphere: ATMOSPHERE_2005,
    audio: AUDIO_2005,
  },
  '2025': {
    id: '2025',
    year: 2025,
    label: '2025',
    subtitle: 'Eco-Smart Future',
    summary: 'Vertical greenery, autonomous electric pods, holographic screens, and spatial ambient sound.',
    buildings: BUILDINGS_2025,
    signage: SIGNAGE_2025,
    vehicles: VEHICLES_2025,
    pedestrians: PEDESTRIANS_2025,
    atmosphere: ATMOSPHERE_2025,
    audio: AUDIO_2025,
  },
};

/**
 * Validates the completeness and structural correctness of an EraSpec.
 */
function validateEraSpec(spec: EraSpec): void {
  if (!spec) throw new Error('Missing EraSpec definition');
  if (!ERAS.includes(spec.id)) throw new Error(`Invalid era ID: ${spec.id}`);
  if (typeof spec.year !== 'number' || Number.isNaN(spec.year)) throw new Error(`Invalid year for era ${spec.id}`);

  // Buildings validation
  const b = spec.buildings;
  if (!b.styleName || !Array.isArray(b.facadePalette) || b.facadePalette.length === 0) {
    throw new Error(`Era ${spec.id} missing complete buildings spec`);
  }
  if (typeof b.heightScale !== 'number' || b.heightScale <= 0) {
    throw new Error(`Era ${spec.id} invalid heightScale`);
  }

  // Signage validation
  const s = spec.signage;
  if (!s.primaryTech || !s.typographyStyle || !Array.isArray(s.signs) || s.signs.length === 0) {
    throw new Error(`Era ${spec.id} missing complete signage spec`);
  }

  // Vehicles validation
  const v = spec.vehicles;
  if (!v.themeName || !Array.isArray(v.models) || v.models.length === 0 || typeof v.vehicleCount !== 'number') {
    throw new Error(`Era ${spec.id} missing complete vehicles spec`);
  }

  // Pedestrians validation
  const p = spec.pedestrians;
  if (!p.fashionStyle || !Array.isArray(p.outfits) || p.outfits.length === 0 || typeof p.crowdDensity !== 'number') {
    throw new Error(`Era ${spec.id} missing complete pedestrians spec`);
  }

  // Atmosphere validation
  const a = spec.atmosphere;
  if (!a.skyGradient || !a.skyGradient.zenith || !a.skyGradient.horizon || !a.sunColor) {
    throw new Error(`Era ${spec.id} missing complete atmosphere spec`);
  }

  // Audio validation
  const au = spec.audio;
  if (!au.themeTitle || !au.genre || typeof au.bpm !== 'number' || !au.synthProfile) {
    throw new Error(`Era ${spec.id} missing complete audio spec`);
  }
}

/**
 * Factory function creating an EraRegistry instance.
 */
export function createEraRegistry(): EraRegistry {
  return {
    getEra(id: EraId): EraSpec {
      const spec = ERA_SPECS[id];
      if (!spec) {
        throw new Error(`Unknown EraId: ${id}`);
      }
      return spec;
    },

    getAllEras(): readonly EraSpec[] {
      return ERAS.map((id) => ERA_SPECS[id]);
    },

    validate(): boolean {
      for (const eraId of ERAS) {
        const spec = ERA_SPECS[eraId];
        if (!spec) {
          throw new Error(`EraRegistry missing required era: ${eraId}`);
        }
        validateEraSpec(spec);
      }
      return true;
    },
  };
}

/**
 * Singleton instance of the era registry for direct access if needed.
 */
export const eraRegistry: EraRegistry = createEraRegistry();
