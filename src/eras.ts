/**
 * src/eras.ts
 * ----------------------------------------------------------------------------
 * Shared era data model + asset registry for the "City Timelapse 1945-2055"
 * scene.
 *
 * This file is the single source of truth for the era *contract*. Every
 * downstream system (building / vehicle / storefront / pedestrian asset
 * builders, the procedural audio mixer, and the particle system) reads the
 * tokens defined here. Nothing in this file imports a builder, audio, or
 * particle module — those modules consume this contract, never the reverse.
 *
 * Phase: "Era data model, asset registry, and timeline binding"
 * ----------------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------
// Primitive value types
// ---------------------------------------------------------------------------

/**
 * The six selectable years on the timeline slider, in chronological order.
 * Used as the canonical key for every era lookup across the codebase.
 */
export type EraId = '1945' | '1965' | '1985' | '2005' | '2025' | '2055';

/**
 * Hex color literal in the form `#rrggbb`. Enforced at compile time via a
 * template-literal type so registry entries cannot silently drop the `#`.
 * Downstream renderers (e.g. three.js) can pass these straight to `Color.set`.
 */
export type ColorHex = `#${string}`;

/**
 * Inclusive numeric range that builders sample from to add variety between
 * neighbouring instances of the same era (e.g. two 1965 buildings do not need
 * identical metalness). `min` <= `max`.
 */
export interface NumericRange {
  readonly min: number;
  readonly max: number;
}

/**
 * Named sky / atmosphere lookups the scene manager resolves into fog, gradient
 * sky and sun positioning. Four visual moods span the timeline.
 */
export type SkyPreset =
  | 'clear' // crisp daytime, blue gradient
  | 'haze' // milky, low-contrast, pollution/soot
  | 'overcast' // flat grey, diffuse
  | 'night-neon'; // dusk/night with emissive glow

// ---------------------------------------------------------------------------
// Identifier registries consumed by downstream tasks
// ---------------------------------------------------------------------------
//
// These string unions are the *contract* the audio and particle tasks must
// match. They are intentionally declared here (in the shared data model) rather
// than inside `audio/sfx.ts` or `particleSystem.ts`, because the era registry
// must be able to reference them without depending on those modules.

/**
 * Procedural audio "bed" ids (ambient + traffic + music character). Resolved by
 * `audio/mixer.ts` and `audio/sfx.ts` in downstream tasks.
 */
export type AudioBedId =
  | 'jazz-1945' // warm acoustic swing, muffled horns
  | 'motown-1965' // bright soul, vinyl crackle, chrome optimism
  | 'synthwave-1985' // neon-era pads, gated drums, FM bass
  | 'pop-2005' // compressed radio pop, hip-hop low-end, early EDM
  | 'electronic-2025' // clean ambient-electronic, sparse, hi-fi
  | 'ambient-2055'; // cinematic sci-fi drones, generative textures

/**
 * Particle / atmosphere effect ids. Resolved by `particleSystem.ts` in a
 * downstream task.
 */
export type ParticlePresetId =
  | 'smoke-ash-1945' // coal smoke + drifting ash
  | 'dust-pollen-1965' // golden dust motes + light pollen
  | 'neon-haze-1985' // low urban smog back-lit by neon
  | 'smog-drizzle-2005' // grey smog + light drizzle
  | 'clean-haze-2025' // faint clean-air haze + fine mist
  | 'bionano-2055'; // floating nano-motes + soft light shafts

// ---------------------------------------------------------------------------
// Composite descriptor sub-structures
// ---------------------------------------------------------------------------

/**
 * Five-color palette (plus ground) that drives sky, fog, lighting and accent
 * materials for an era. Every value is a `#rrggbb` literal.
 */
export interface EraPalette {
  /** Top-of-dome sky gradient color. */
  readonly sky: ColorHex;
  /** Exponential fog tint. */
  readonly fog: ColorHex;
  /** Directional sun / key-light color. */
  readonly sun: ColorHex;
  /** Ambient hemisphere fill color. */
  readonly ambient: ColorHex;
  /** Hero accent — signage glow, vehicle trim, UI highlight. */
  readonly accent: ColorHex;
  /** Road / ground plane base color. */
  readonly ground: ColorHex;
}

/**
 * PBR hints describing the *range* of surface qualities for an era. Builders
 * pick values inside these ranges so a block looks coherent without every
 * instance being identical.
 */
export interface MaterialHints {
  /** 0-1 metalness range (brick ~0.0, chrome ~1.0). */
  readonly metalness: NumericRange;
  /** 0-1 roughness range (polished glass ~0.05, soot ~0.95). */
  readonly roughness: NumericRange;
  /** 0-1 emissive-intensity range (matte signage ~0.0, neon ~1.0). */
  readonly emissive: NumericRange;
}

/**
 * Scalar lighting parameters layered on top of the palette colors so the scene
 * manager can tune intensity/density per era without touching palette hues.
 */
export interface EraLighting {
  /** Exponential fog density (higher = thicker air). */
  readonly fogDensity: number;
  /** Directional sun light intensity. */
  readonly sunIntensity: number;
  /** Ambient / hemisphere light intensity. */
  readonly ambientIntensity: number;
}

/**
 * Free-form, human-readable stylistic notes. These carry the "visual/sonic
 * notes" from the era brief so builders and designers have explicit guidance
 * next to the machine-readable tokens.
 */
export interface EraNotes {
  /** Dominant architectural language of the period. */
  readonly architecture: string;
  /** Vehicle archetypes on the street. */
  readonly vehicles: string;
  /** Storefront + advertisement styling. */
  readonly signage: string;
  /** Pedestrian fashion / silhouette notes. */
  readonly fashion: string;
}

/**
 * Per-builder variant ids that the asset builders resolve into geometry /
 * texture sets. Declared as plain strings (not imported from the builder
 * modules) so the data model stays free of builder/audio/particle imports.
 */
export interface AssetBundle {
  /** Building builder variant id. */
  readonly building: string;
  /** Vehicle builder variant id. */
  readonly vehicle: string;
  /** Storefront builder variant id. */
  readonly storefront: string;
  /** Pedestrian builder variant id. */
  readonly pedestrian: string;
  /** Shared props / street-furniture set id. */
  readonly props: string;
}

// ---------------------------------------------------------------------------
// Top-level descriptor
// ---------------------------------------------------------------------------

/**
 * Complete description of a single era on the timeline. This is the type every
 * era-aware consumer (scene manager, builders, mixer, particles) programs
 * against.
 *
 * Required coverage (acceptance criteria):
 *  - {@link palette}         — sky/fog/sun/ambient/accent (+ ground)
 *  - {@link skyPreset}       — clear / haze / overcast / night-neon
 *  - {@link materialHints}   — metalness / roughness / emissive ranges
 *  - {@link audioBed}        — id consumed by `audio/sfx.ts`
 *  - {@link particlePreset}  — id consumed by `particleSystem.ts`
 *  - {@link assetBundle}     — per-builder variant ids
 */
export interface EraDescriptor {
  /** Canonical era key (matches the timeline slider value). */
  readonly id: EraId;
  /** Numeric year for display and ordering. */
  readonly year: number;
  /** Human label, e.g. "1945 — Post-War Reconstruction". */
  readonly label: string;
  /** One-line summary used by the timeline UI. */
  readonly tagline: string;
  /** Five-color (+ ground) palette. */
  readonly palette: EraPalette;
  /** Sky / atmosphere mood. */
  readonly skyPreset: SkyPreset;
  /** PBR surface ranges for builders. */
  readonly materialHints: MaterialHints;
  /** Scalar lighting parameters. */
  readonly lighting: EraLighting;
  /** Procedural audio bed id. */
  readonly audioBed: AudioBedId;
  /** Particle / atmosphere effect id. */
  readonly particlePreset: ParticlePresetId;
  /** Per-builder asset variant ids. */
  readonly assetBundle: AssetBundle;
  /** Stylistic design notes for builders/designers. */
  readonly notes: EraNotes;
}

// ---------------------------------------------------------------------------
// Era registry — exactly 6 entries in chronological order
// ---------------------------------------------------------------------------
//
// Visual / sonic notes honored per era (from the parent plan brief):
//
//  1945 — Post-War Reconstruction
//    Post-war brick & stone, soot-stained facades, propeller aircraft and
//    early automobiles, hand-painted sepia signage, jazz SFX, coal smoke +
//    drifting ash particles.
//
//  1965 — Mid-Century Boom
//    Glass & marble towers, bold neon signage, chrome muscle cars, Motown SFX,
//    golden dust motes + pollen particles.
//
//  1985 — Neon Decade
//    Mirrored glass skyscrapers, dense neon signage, boxy cars + early
//    imports, synthwave SFX, low urban smog back-lit by neon particles.
//
//  2005 — Digital Metropolis
//    Steel + glass high-rises, LED billboards, SUVs + early hybrids, compressed
//    radio pop / early-EDM SFX, grey smog + light drizzle particles.
//
//  2025 — Eco-Smart City
//    Sustainable facades, green roofs, EVs + autonomous pods, clean ambient-
//    electronic SFX, faint clean-air haze + fine mist particles.
//
//  2055 — Future Vision
//    Parametric towers, holographic signage, maglev + drones, cinematic sci-fi
//    drone SFX, floating nano-motes + soft light shafts.
// ---------------------------------------------------------------------------

export const ALL_ERAS: readonly EraDescriptor[] = [
  {
    id: '1945',
    year: 1945,
    label: '1945 — Post-War Reconstruction',
    tagline: 'Brick, soot and sepia: a city rebuilding.',
    palette: {
      sky: '#b8a890',
      fog: '#9a8a72',
      sun: '#e8d2a0',
      ambient: '#b0a088',
      accent: '#c0884a',
      ground: '#6b6256',
    },
    skyPreset: 'haze',
    materialHints: {
      metalness: { min: 0.0, max: 0.1 },
      roughness: { min: 0.75, max: 0.98 },
      emissive: { min: 0.0, max: 0.05 },
    },
    lighting: {
      fogDensity: 0.018,
      sunIntensity: 1.0,
      ambientIntensity: 0.55,
    },
    audioBed: 'jazz-1945',
    particlePreset: 'smoke-ash-1945',
    assetBundle: {
      building: 'brick-soot-stone',
      vehicle: 'prop-aircraft-vintage-auto',
      storefront: 'handpainted-sepia-signage',
      pedestrian: 'tailored-suits-fedora-frock',
      props: 'cast-iron-lamp-cobble',
    },
    notes: {
      architecture:
        'Low-rise brick and carved stone facades, soot-stained, sash windows, '
        + 'water towers on rooftops, bomb-site gaps between buildings.',
      vehicles:
        'Rounded propeller-driven aircraft overhead, early bulbous automobiles '
        + 'and delivery trucks, horse-drawn carts still present.',
      signage:
        'Hand-painted sepia and cream shopfronts, gold-leaf lettering, '
        + 'incandescent bulb marquees, simple flat advertisements.',
      fashion:
        'Men in tailored three-piece suits and fedoras; women in A-line coats, '
        + 'frocks and pillbox hats; muted wool and cotton palettes.',
    },
  },
  {
    id: '1965',
    year: 1965,
    label: '1965 — Mid-Century Boom',
    tagline: 'Glass, marble and chrome optimism.',
    palette: {
      sky: '#8fb8d8',
      fog: '#b0c4d8',
      sun: '#fff0d0',
      ambient: '#a8c0d0',
      accent: '#e85a4a',
      ground: '#5c5f5a',
    },
    skyPreset: 'clear',
    materialHints: {
      metalness: { min: 0.2, max: 0.7 },
      roughness: { min: 0.15, max: 0.5 },
      emissive: { min: 0.2, max: 0.6 },
    },
    lighting: {
      fogDensity: 0.006,
      sunIntensity: 1.4,
      ambientIntensity: 0.65,
    },
    audioBed: 'motown-1965',
    particlePreset: 'dust-pollen-1965',
    assetBundle: {
      building: 'glass-marble-curtain-wall',
      vehicle: 'chrome-muscle-sedan',
      storefront: 'bold-neon-signage',
      pedestrian: 'shift-dresses-turtleneck',
      props: 'gooseneck-lamp-terrazzo',
    },
    notes: {
      architecture:
        'Mid-century glass-and-marble curtain walls, clean geometric lines, '
        + 'pilotis and plazas, gold-anodized trim, space-age curves.',
      vehicles:
        'Chrome-bumper muscle cars, finned sedans, boxy trucks and the first '
        + 'compact imports; glossy lacquer paint.',
      signage:
        'Bold neon tube signage in warm primaries, backlit acrylic panels, '
        + 'Googie-style starbursts and arrows.',
      fashion:
        'Women in shift dresses, minis and turtlenecks; men in slim '
        + 'lapel suits; bold block colors and geometric prints.',
    },
  },
  {
    id: '1985',
    year: 1985,
    label: '1985 — Neon Decade',
    tagline: 'Mirrored glass and electric nights.',
    palette: {
      sky: '#5a4a7a',
      fog: '#4a3a6a',
      sun: '#ff9adb',
      ambient: '#6a5a8a',
      accent: '#ff2ec8',
      ground: '#3a3340',
    },
    skyPreset: 'night-neon',
    materialHints: {
      metalness: { min: 0.4, max: 0.9 },
      roughness: { min: 0.05, max: 0.35 },
      emissive: { min: 0.4, max: 0.95 },
    },
    lighting: {
      fogDensity: 0.014,
      sunIntensity: 0.7,
      ambientIntensity: 0.7,
    },
    audioBed: 'synthwave-1985',
    particlePreset: 'neon-haze-1985',
    assetBundle: {
      building: 'mirrored-glass-postmodern',
      vehicle: 'boxy-sedan-import',
      storefront: 'dense-neon-led-matrix',
      pedestrian: 'shoulder-pad-denim',
      props: 'neon-tube-sleek-bench',
    },
    notes: {
      architecture:
        'Mirrored-glass skyscrapers, postmodern pastiche, granite cladding, '
        + 'recessed plazas, bright neon pylon signage at street level.',
      vehicles:
        'Boxy aerodynamic sedans, rising Japanese imports, early hatchbacks '
        + 'and minivans; flat solid colors and wire-wheel hubcaps.',
      signage:
        'Dense neon and early LED matrix displays, blinking marquee boards, '
        + 'magenta/cyan tube lighting, cassette-era storefronts.',
      fashion:
        'Shoulder-padded power suits, acid-wash denim, big hair, leg warmers '
        + 'and Members Only jackets; high-contrast neon accents.',
    },
  },
  {
    id: '2005',
    year: 2005,
    label: '2005 — Digital Metropolis',
    tagline: 'Steel, glass and the always-on glow.',
    palette: {
      sky: '#8a92a0',
      fog: '#9aa0aa',
      sun: '#f0e8d8',
      ambient: '#9098a4',
      accent: '#2aa0e8',
      ground: '#4a4d52',
    },
    skyPreset: 'overcast',
    materialHints: {
      metalness: { min: 0.3, max: 0.85 },
      roughness: { min: 0.1, max: 0.45 },
      emissive: { min: 0.3, max: 0.8 },
    },
    lighting: {
      fogDensity: 0.01,
      sunIntensity: 1.1,
      ambientIntensity: 0.7,
    },
    audioBed: 'pop-2005',
    particlePreset: 'smog-drizzle-2005',
    assetBundle: {
      building: 'steel-glass-highrise',
      vehicle: 'suv-hybrid-sedan',
      storefront: 'led-billboard-digital-ad',
      pedestrian: 'low-rise-denim-hoodie',
      props: 'steel-bollard-glass-bus-shelter',
    },
    notes: {
      architecture:
        'Steel-and-glass high-rises, curtain-wall condos, exposed concrete '
        + 'cores, rooftop HVAC, large LED billboards wrapping facades.',
      vehicles:
        'SUVs and crossovers dominate, early hybrids, rounded aero sedans and '
        + 'compact cars; metallic and pearl finishes.',
      signage:
        'Full-motion LED billboards, digital menu boards, backlit vinyl '
        + 'banners, early smartphone-era storefront branding.',
      fashion:
        'Low-rise denim, logo tees, hoodies, trucker hats and early skinny '
        + 'jeans; casual layered streetwear dominates.',
    },
  },
  {
    id: '2025',
    year: 2025,
    label: '2025 — Eco-Smart City',
    tagline: 'Sustainable facades and silent streets.',
    palette: {
      sky: '#9ec4c8',
      fog: '#b4d0d2',
      sun: '#fff4e0',
      ambient: '#a8c8cc',
      accent: '#3ad8a0',
      ground: '#46524c',
    },
    skyPreset: 'clear',
    materialHints: {
      metalness: { min: 0.15, max: 0.6 },
      roughness: { min: 0.2, max: 0.6 },
      emissive: { min: 0.2, max: 0.7 },
    },
    lighting: {
      fogDensity: 0.007,
      sunIntensity: 1.3,
      ambientIntensity: 0.75,
    },
    audioBed: 'electronic-2025',
    particlePreset: 'clean-haze-2025',
    assetBundle: {
      building: 'sustainable-facade-green-roof',
      vehicle: 'ev-autonomous-pod',
      storefront: 'oled-wrap-eink-ad',
      pedestrian: 'athleisure-techwear',
      props: 'solar-lamp-green-bench',
    },
    notes: {
      architecture:
        'Sustainable facades with vertical gardens and green roofs, '
        + 'photovoltaic skins, adaptive shading louvers, modular prefab panels.',
      vehicles:
        'Silent EVs and autonomous pods, electric buses, e-bikes and scooters; '
        + 'camera/sensor clusters replace grillework.',
      signage:
        'OLED wraparound displays, e-ink price boards, projection-mapped ads, '
        + 'AR-triggered posters and minimalist matte branding.',
      fashion:
        'Athleisure and techwear with recycled fabrics, smart watches, '
        + 'minimalist silhouettes, muted eco-tones with reflective trim.',
    },
  },
  {
    id: '2055',
    year: 2055,
    label: '2055 — Future Vision',
    tagline: 'Parametric towers and holographic skies.',
    palette: {
      sky: '#2a3a5a',
      fog: '#3a4a6a',
      sun: '#a0c8ff',
      ambient: '#4a5a7a',
      accent: '#00f0ff',
      ground: '#2c3038',
    },
    skyPreset: 'night-neon',
    materialHints: {
      metalness: { min: 0.5, max: 0.95 },
      roughness: { min: 0.02, max: 0.3 },
      emissive: { min: 0.5, max: 1.0 },
    },
    lighting: {
      fogDensity: 0.009,
      sunIntensity: 0.85,
      ambientIntensity: 0.8,
    },
    audioBed: 'ambient-2055',
    particlePreset: 'bionano-2055',
    assetBundle: {
      building: 'parametric-tower-holographic',
      vehicle: 'maglev-drone-pod',
      storefront: 'holographic-projection-ad',
      pedestrian: 'smart-fabric-utility-wear',
      props: 'hologram-kiosk-light-bridge',
    },
    notes: {
      architecture:
        'Parametrically optimized towers, organic curved shells, self-repairing '
        + 'composites, integrated vertical farms and sky-bridges.',
      vehicles:
        'Maglev pods, delivery drones, personal flying taxis and autonomous '
        + 'shuttles; glowing undercarriage accents, seamless hulls.',
      signage:
        'Full holographic projections, volumetric displays and reactive AR '
        + 'layers; advertising is spatial and often eye-tracked.',
      fashion:
        'Smart-fabric utility wear with embedded lighting, modular exoskeleton '
        + 'accents, form-fitting suits in deep blues and cyan glows.',
    },
  },
] as const;

// ---------------------------------------------------------------------------
// Lookups & ordering helpers
// ---------------------------------------------------------------------------

/**
 * Ordered list of every {@link EraId}, in chronological order. Guaranteed to
 * match the slider's option list and the order of {@link ALL_ERAS}.
 */
export const ERA_IDS: readonly EraId[] = ALL_ERAS.map((era) => era.id);

/**
 * Fast lookup table: `EraId -> EraDescriptor`. Pre-computed once so hot
 * timeline paths (e.g. slider scrubbing) never scan the array.
 */
export const ERA_BY_ID: Readonly<Record<EraId, EraDescriptor>> =
  Object.freeze(
    Object.fromEntries(ALL_ERAS.map((era) => [era.id, era])),
  ) as Readonly<Record<EraId, EraDescriptor>>;

/**
 * Resolve a single era descriptor by its id. Throws a typed error for unknown
 * ids so callers fail loudly rather than silently rendering the wrong era.
 */
export function getEraDescriptor(id: EraId): EraDescriptor {
  const descriptor = ERA_BY_ID[id];
  if (!descriptor) {
    throw new Error(`[eras] Unknown EraId: "${id}". Known ids: ${ERA_IDS.join(', ')}.`);
  }
  return descriptor;
}

/**
 * Return the index (0-based) of an era within the timeline, useful for the
 * slider position and for computing transition progress between neighbours.
 */
export function getEraIndex(id: EraId): number {
  const index = ERA_IDS.indexOf(id);
  if (index < 0) {
    throw new Error(`[eras] Unknown EraId: "${id}". Known ids: ${ERA_IDS.join(', ')}.`);
  }
  return index;
}

/**
 * Return the era that immediately precedes the given one on the timeline, or
 * `undefined` for the earliest era (1945).
 */
export function getPreviousEra(id: EraId): EraDescriptor | undefined {
  const index = getEraIndex(id);
  return index > 0 ? ALL_ERAS[index - 1] : undefined;
}

/**
 * Return the era that immediately follows the given one on the timeline, or
 * `undefined` for the latest era (2055).
 */
export function getNextEra(id: EraId): EraDescriptor | undefined {
  const index = getEraIndex(id);
  return index >= 0 && index < ALL_ERAS.length - 1 ? ALL_ERAS[index + 1] : undefined;
}
