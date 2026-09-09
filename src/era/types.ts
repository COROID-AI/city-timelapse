/**
 * Shared Era and System Contracts for City Time Period Timelapse.
 *
 * Types and pure interfaces only — no THREE imports and no DOM access.
 * World systems, audio engines, and UI layers consume these contracts to drive
 * synchronized era transitions across the city block.
 */

import type { EraId } from './years';

/**
 * Timeline channel representing an active tween or static state between two eras.
 * `fromEra`: Origin era.
 * `toEra`: Target era.
 * `t`: Normalized transition progress (0.0 = completely fromEra, 1.0 = completely toEra).
 */
export interface TimelineChannel {
  /** The starting era of the current transition (or current era if static). */
  readonly fromEra: EraId;
  /** The destination era of the current transition (or current era if static). */
  readonly toEra: EraId;
  /** Normalized progress from 0 (at fromEra) to 1 (at toEra). */
  readonly t: number;
}

// ---------------------------------------------------------------------------
// 1. Buildings Era Spec
// ---------------------------------------------------------------------------

export type RoofStyle = 'mansard' | 'flat_water_tower' | 'flat_ac_units' | 'green_roof' | 'solar_spire';

export interface BuildingsEraSpec {
  /** Architectural era vibe / descriptor (e.g., 'Brick Tenements & Art Deco'). */
  readonly styleName: string;
  /** Palette of dominant facade colors (hex strings, e.g. '#7c2d12'). */
  readonly facadePalette: readonly string[];
  /** Primary window trim / frame color. */
  readonly frameColor: string;
  /** Window emissive / warm interior light color during dark periods. */
  readonly windowEmissiveColor: string;
  /** Density / probability of window illumination (0.0 to 1.0). */
  readonly windowIlluminationRate: number;
  /** Average stories / height multiplier relative to baseline (e.g. 1.0 in 1945 to 2.2 in 2025). */
  readonly heightScale: number;
  /** Dominant roof feature style for this period. */
  readonly roofStyle: RoofStyle;
  /** Whether external metal fire escapes are prominent on facades. */
  readonly fireEscapes: boolean;
  /** Facade detail density (cornices, mouldings, ledges, cladding lines). */
  readonly architecturalDetailLevel: number;
  /** Street furniture types present on the sidewalk. */
  readonly streetFurniture: readonly string[];
  /** Weathering / patina / age factor of building materials (0.0 clean modern to 1.0 weathered brick/soot). */
  readonly weatheringFactor: number;
}

// ---------------------------------------------------------------------------
// 2. Signage Era Spec
// ---------------------------------------------------------------------------

export type SignTechType =
  | 'painted_wood_metal'
  | 'neon_incandescent_bulbs'
  | 'backlit_acrylic_lightboxes'
  | 'digital_led_billboards'
  | 'holographic_oled_screens';

export interface SignItemSpec {
  readonly text: string;
  readonly category: 'storefront' | 'billboard' | 'blade' | 'rooftop';
  readonly primaryColor: string;
  readonly accentColor: string;
  readonly tech: SignTechType;
}

export interface SignageEraSpec {
  /** Primary display technology for signs in this era. */
  readonly primaryTech: SignTechType;
  /** Typography vibe descriptor (e.g., 'Vintage Art Deco Serif & Painted Lettering'). */
  readonly typographyStyle: string;
  /** Dominant neon / sign illumination palette. */
  readonly colorPalette: readonly string[];
  /** Glow intensity multiplier (0.0 for unlit painted wood to 2.5 for high-lumen digital). */
  readonly glowIntensity: number;
  /** Flicker / pulse frequency in Hz (0 for static or modern digital, 2-8 for vintage neon). */
  readonly flickerRate: number;
  /** Density of rooftop and facade signs (0.0 sparse to 1.0 dense). */
  readonly density: number;
  /** Curated collection of era-authentic sign definitions. */
  readonly signs: readonly SignItemSpec[];
}

// ---------------------------------------------------------------------------
// 3. Vehicles Era Spec
// ---------------------------------------------------------------------------

export type VehicleBodyType =
  | 'vintage_fender_sedan'
  | 'midcentury_finned_cruiser'
  | 'angular_eighties_box'
  | 'curved_two_thousands_sedan'
  | 'sleek_ev_crossover';

export interface VehicleModelSpec {
  readonly type: VehicleBodyType;
  readonly name: string;
  readonly relativeFrequency: number;
  readonly length: number;
  readonly width: number;
  readonly height: number;
}

export interface VehiclesEraSpec {
  /** Era vehicle era theme descriptor (e.g., 'Post-War Heavy Steel & Chrome'). */
  readonly themeName: string;
  /** Number of active vehicles cruising the block lanes simultaneously. */
  readonly vehicleCount: number;
  /** Average vehicle speed (world units per second). */
  readonly averageSpeed: number;
  /** Vehicle paint palette for this period. */
  readonly bodyColors: readonly string[];
  /** Headlight color (hex string, e.g. '#ffecb3' warm bulb vs '#f0f9ff' cool LED). */
  readonly headlightColor: string;
  /** Headlight intensity / beam strength. */
  readonly headlightIntensity: number;
  /** Taillight color (hex string, e.g. '#b91c1c' deep red). */
  readonly taillightColor: string;
  /** Exhaust particle emission rate (high for 1945 leaded gas, 0 for 2025 EV). */
  readonly exhaustEmissionRate: number;
  /** Vehicle body archetypes for this era. */
  readonly models: readonly VehicleModelSpec[];
}

// ---------------------------------------------------------------------------
// 4. Pedestrians Era Spec
// ---------------------------------------------------------------------------

export interface PedestrianOutfitSpec {
  readonly description: string;
  readonly topPalette: readonly string[];
  readonly bottomPalette: readonly string[];
  readonly accessories: readonly string[];
}

export interface PedestriansEraSpec {
  /** Era fashion descriptor (e.g., 'Tailored Suits, Trench Coats & Fedoras'). */
  readonly fashionStyle: string;
  /** Number of active pedestrians on sidewalks and crosswalks. */
  readonly crowdDensity: number;
  /** Average walking speed (world units per second). */
  readonly walkSpeed: number;
  /** Representative outfit palettes and accessories for this era. */
  readonly outfits: readonly PedestrianOutfitSpec[];
  /** Probability of pedestrians holding an era-appropriate hand prop (0.0 to 1.0). */
  readonly propProbability: number;
  /** Typical props carried in this era (e.g., 'newspaper', 'briefcase', 'walkman', 'smartphone'). */
  readonly typicalProps: readonly string[];
}

// ---------------------------------------------------------------------------
// 5. Atmosphere Era Spec
// ---------------------------------------------------------------------------

export interface ColorGradient3 {
  readonly zenith: string;
  readonly horizon: string;
  readonly ground: string;
}

export interface AtmosphereEraSpec {
  /** Sky gradient colors (zenith, horizon, ground reflection). */
  readonly skyGradient: ColorGradient3;
  /** Sun / primary directional light color. */
  readonly sunColor: string;
  /** Sun light intensity. */
  readonly sunIntensity: number;
  /** Sun direction vector [x, y, z] (normalized). */
  readonly sunPosition: readonly [number, number, number];
  /** Ambient light color. */
  readonly ambientColor: string;
  /** Ambient light intensity. */
  readonly ambientIntensity: number;
  /** Distance fog color. */
  readonly fogColor: string;
  /** Fog density factor. */
  readonly fogDensity: number;
  /** Street lamp light color (warm gas/tungsten to crisp LED). */
  readonly streetLampColor: string;
  /** Street lamp intensity. */
  readonly streetLampIntensity: number;
  /** Street lamp pole design style. */
  readonly streetLampStyle: 'cast_iron_gas' | 'curved_gooseneck' | 'square_cobra' | 'modern_pole' | 'smart_led_spire';
  /** Air pollution / particulate haze factor (0.0 crystal clean to 1.0 heavy industrial smog). */
  readonly hazeFactor: number;
  /** Post-processing / color grade mood (e.g., 'warm_sepia', 'technicolor_warm', 'cool_contrast_80s', 'digital_crisp_00s', 'hdr_vibrant_modern'). */
  readonly colorGradeMood: string;
}

// ---------------------------------------------------------------------------
// 6. Audio Era Spec
// ---------------------------------------------------------------------------

export interface AudioEraSpec {
  /** Soundtrack / era musical theme title. */
  readonly themeTitle: string;
  /** Music genre descriptor. */
  readonly genre: string;
  /** Representative tempo in beats per minute. */
  readonly bpm: number;
  /** Base synth/instrument profile identifier. */
  readonly synthProfile: 'big_band_swing' | 'motown_mod_rock' | 'synthwave_post_punk' | 'y2k_electronic_pop' | 'modern_ambient_lofi';
  /** Street ambience profile identifier. */
  readonly ambienceProfile: 'clattering_trams_horns' | 'rumbling_v8_chatter' | 'bustling_city_hiss' | 'traffic_dense_sirens' | 'quiet_ev_hum_breeze';
  /** Audio filter type (frequency cutoffs / lo-fi simulation). */
  readonly filterProfile: 'am_radio_lofi' | 'vinyl_warmth' | 'cassette_tape_analog' | 'cd_digital_clean' | 'lossless_spacious';
  /** Horn honk sound archetype. */
  readonly hornType: 'vintage_klaxon' | 'classic_car_horn' | 'electric_dual_tone' | 'modern_beep' | 'gentle_ev_chime';
}

// ---------------------------------------------------------------------------
// Combined Era Specification
// ---------------------------------------------------------------------------

export interface EraSpec {
  readonly id: EraId;
  readonly year: number;
  readonly label: string;
  readonly subtitle: string;
  readonly summary: string;
  readonly buildings: BuildingsEraSpec;
  readonly signage: SignageEraSpec;
  readonly vehicles: VehiclesEraSpec;
  readonly pedestrians: PedestriansEraSpec;
  readonly atmosphere: AtmosphereEraSpec;
  readonly audio: AudioEraSpec;
}

// ---------------------------------------------------------------------------
// Era System Lifecycle Contract
// ---------------------------------------------------------------------------

/**
 * Lifecycle contract implemented by world, audio, and UI systems.
 * Systems attach once to their subsystem context, react to timeline channel updates
 * on every animation tick, and cleanly dispose their resources.
 */
export interface EraSystem<P = unknown> {
  /**
   * Initializes and attaches the system to its rendering/audio/UI context.
   * May be synchronous or asynchronous.
   */
  attach(context: P): void | Promise<void>;

  /**
   * Updates system state for the current frame given the interpolated timeline channel
   * and the frame delta time in seconds.
   */
  update(channel: TimelineChannel, deltaSeconds: number): void;

  /**
   * Tears down geometries, materials, audio nodes, listeners, or DOM elements.
   * Must be idempotent and safe to call repeatedly.
   */
  dispose(): void;
}
