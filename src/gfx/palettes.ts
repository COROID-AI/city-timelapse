/**
 * Era material palettes for the Timelapse City procedural graphics library.
 *
 * Provides shared color, roughness, metalness, and weathering/grime definitions
 * for every timeline year (1945, 1965, 1985, 2005, 2025). The palettes give
 * the whole scene its visual era identity and are consumed across buildings,
 * storefronts, signage, vehicles, and outfits.
 */

/** Years addressable by the timeline slider; each maps to a full era palette. */
export const ERA_YEARS = [1945, 1965, 1985, 2005, 2025] as const;
export type EraYear = (typeof ERA_YEARS)[number];

/** Required material categories covered across all five eras. */
export const MATERIAL_CATEGORIES = [
  'masonryConcrete',
  'metal',
  'glass',
  'wood',
  'fabric',
  'paintSignage',
  'neonEmissive',
  'asphaltStone',
  'grimeSoil',
] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

/** Physical and era-specific properties for a single material category. */
export interface MaterialSwatch {
  /** Hex color string (#rrggbb). */
  readonly color: string;
  /** Physical surface roughness in the range [0, 1]. */
  readonly roughness: number;
  /** Physical metalness in the range [0, 1]. */
  readonly metalness: number;
  /** Era dirt/soot/wear level in [0, 1]; feeds texture generator weathering. */
  readonly grime: number;
  /** Optional emissive glow color (#rrggbb). */
  readonly emissive?: string;
  /** Emissive intensity multiplier (>= 0). */
  readonly emissiveIntensity?: number;
  /** Architectural / historical provenance note. */
  readonly note: string;
}

export type SignageStyle =
  | 'hand-painted'
  | 'painted-enamel'
  | 'neon-tube'
  | 'backlit-plastic'
  | 'led-panel';

export type EmissiveCharacter =
  | 'incandescent'
  | 'neon'
  | 'fluorescent-neon'
  | 'backlit-acrylic'
  | 'led';

/** Complete era palette covering all material categories and dominant character. */
export interface EraPalette {
  readonly year: EraYear;
  readonly name: string;
  readonly description: string;
  /** Dominant accent color (#rrggbb) used for era branding and vehicles. */
  readonly accent: string;
  readonly signageStyle: SignageStyle;
  readonly emissiveCharacter: EmissiveCharacter;
  /** Overall default weathering multiplier in [0, 1]. */
  readonly defaultWeathering: number;
  readonly materials: Readonly<Record<MaterialCategory, MaterialSwatch>>;
}

/**
 * Five authoritative era palettes:
 * - 1945: Soot-stained warm red brick, wrought iron, amber glass, hand-painted signage.
 * - 1965: Stucco & pastel plastics, mirror chrome, aqua-cast glass, turquoise enamel.
 * - 1985: Raw gray concrete, anodized steel, smoky glass, bold magenta/cyan neon.
 * - 2005: Precast panels, low-E blue curtain wall, aluminum, white backlit acrylic.
 * - 2025: Clean white rainscreen, low-iron green glass, brushed stainless, cool-white LED.
 */
export const ERA_PALETTES: Readonly<Record<EraYear, EraPalette>> = Object.freeze({
  1945: {
    year: 1945,
    name: 'Wartime Soot & Hand-Painted Signs',
    description:
      'Coal-smoke patina, warm red brick, wavy amber cylinder glass, hand-lettered enamel signboards, and warm incandescent bulbs.',
    accent: '#a83b2b',
    signageStyle: 'hand-painted',
    emissiveCharacter: 'incandescent',
    defaultWeathering: 0.65,
    materials: {
      masonryConcrete: {
        color: '#6e4a38',
        roughness: 0.92,
        metalness: 0,
        grime: 0.7,
        note: 'Warm red brick darkened by decades of coal and rail smoke.',
      },
      metal: {
        color: '#4c4a46',
        roughness: 0.55,
        metalness: 0.7,
        grime: 0.6,
        note: 'Black wrought iron, structural steel, and soot-dulled fire escapes.',
      },
      glass: {
        color: '#e6dcc0',
        roughness: 0.18,
        metalness: 0,
        grime: 0.45,
        note: 'Thick wavy amber cylinder glass, hazed by industrial soot.',
      },
      wood: {
        color: '#5b4130',
        roughness: 0.8,
        metalness: 0,
        grime: 0.55,
        note: 'Dark-stained oak and walnut storefront frames and sash.',
      },
      fabric: {
        color: '#7c2f2a',
        roughness: 0.95,
        metalness: 0,
        grime: 0.5,
        note: 'Heavy woven wool-blend and oxblood canvas awnings.',
      },
      paintSignage: {
        color: '#a8452f',
        roughness: 0.5,
        metalness: 0,
        grime: 0.55,
        note: 'Hand-lettered oil-enamel signboard paint on aged cream ground.',
      },
      neonEmissive: {
        color: '#ffb45c',
        roughness: 0.4,
        metalness: 0,
        grime: 0.4,
        emissive: '#ff9a3c',
        emissiveIntensity: 0.8,
        note: 'Bare warm incandescent bulbs and early amber neon tubes.',
      },
      asphaltStone: {
        color: '#33312e',
        roughness: 0.95,
        metalness: 0,
        grime: 0.6,
        note: 'Granite sett cobblestones and coal-tar road binder.',
      },
      grimeSoil: {
        color: '#191512',
        roughness: 1.0,
        metalness: 0,
        grime: 0.8,
        note: 'Dense coal soot and horse-era street grime.',
      },
    },
  },

  1965: {
    year: 1965,
    name: 'Pastel Plastics & Chrome',
    description:
      'Optimistic mid-century pastel finishes, mirror-polished chrome trim, aqua-tinted flat glass, and bright enamel storefronts.',
    accent: '#3fb7c6',
    signageStyle: 'painted-enamel',
    emissiveCharacter: 'neon',
    defaultWeathering: 0.22,
    materials: {
      masonryConcrete: {
        color: '#cbbfa8',
        roughness: 0.85,
        metalness: 0,
        grime: 0.2,
        note: 'Pale limestone stucco and clean mid-century aggregate trim.',
      },
      metal: {
        color: '#d7dade',
        roughness: 0.12,
        metalness: 0.95,
        grime: 0.1,
        note: 'Mirror-polished chrome automotive and storefront moldings.',
      },
      glass: {
        color: '#dfeaec',
        roughness: 0.06,
        metalness: 0,
        grime: 0.15,
        note: 'Clear plate glass with a faint aqua-cyan tint.',
      },
      wood: {
        color: '#c08f5b',
        roughness: 0.6,
        metalness: 0,
        grime: 0.15,
        note: 'Warm blond oak, teak, and plywood interior/exterior panels.',
      },
      fabric: {
        color: '#f4a8b8',
        roughness: 0.9,
        metalness: 0,
        grime: 0.12,
        note: 'Pastel pink, coral, and mint canvas awnings and vinyl fabrics.',
      },
      paintSignage: {
        color: '#46b3c4',
        roughness: 0.4,
        metalness: 0,
        grime: 0.14,
        note: 'High-gloss enamel paint in turquoise, coral, and cream.',
      },
      neonEmissive: {
        color: '#ff6fb1',
        roughness: 0.35,
        metalness: 0,
        grime: 0.15,
        emissive: '#ff5fa8',
        emissiveIntensity: 1.4,
        note: 'Slim pastel pink and turquoise neon tubes.',
      },
      asphaltStone: {
        color: '#4a4a4c',
        roughness: 0.92,
        metalness: 0,
        grime: 0.18,
        note: 'Smooth modern asphalt paving and terrazzo crosswalks.',
      },
      grimeSoil: {
        color: '#3a352c',
        roughness: 1.0,
        metalness: 0,
        grime: 0.22,
        note: 'Light street dust and mild automotive exhaust haze.',
      },
    },
  },

  1985: {
    year: 1985,
    name: 'Concrete, Neon & Bold Color',
    description:
      'Raw brutalist concrete, blue-gray painted steel, smoky spandrel glass, hot magenta neon, and high-energy primary signage.',
    accent: '#e33fa0',
    signageStyle: 'neon-tube',
    emissiveCharacter: 'fluorescent-neon',
    defaultWeathering: 0.42,
    materials: {
      masonryConcrete: {
        color: '#9c9a92',
        roughness: 0.9,
        metalness: 0,
        grime: 0.45,
        note: 'Board-formed raw concrete and gray split-face masonry block.',
      },
      metal: {
        color: '#7d848c',
        roughness: 0.45,
        metalness: 0.6,
        grime: 0.35,
        note: 'Blue-gray painted structural steel and dark anodized aluminum.',
      },
      glass: {
        color: '#8fa2ad',
        roughness: 0.1,
        metalness: 0,
        grime: 0.3,
        note: 'Smoky gray-tinted spandrel glass with slight bronze reflectiveness.',
      },
      wood: {
        color: '#8a6a42',
        roughness: 0.65,
        metalness: 0,
        grime: 0.3,
        note: 'Medium-oak laminate and dark wood storefront accents.',
      },
      fabric: {
        color: '#e05a2b',
        roughness: 0.85,
        metalness: 0,
        grime: 0.25,
        note: 'Bold safety-orange, teal, and magenta striped canvas awnings.',
      },
      paintSignage: {
        color: '#e8b71d',
        roughness: 0.5,
        metalness: 0,
        grime: 0.3,
        note: 'Bold primary yellow and red gloss enamel fascia signboards.',
      },
      neonEmissive: {
        color: '#ff2d95',
        roughness: 0.3,
        metalness: 0,
        grime: 0.2,
        emissive: '#ff35a0',
        emissiveIntensity: 2.2,
        note: 'High-intensity magenta and cyan neon outline signage.',
      },
      asphaltStone: {
        color: '#3e4045',
        roughness: 0.95,
        metalness: 0,
        grime: 0.45,
        note: 'Coarse aggregate asphalt with traffic-worn markings.',
      },
      grimeSoil: {
        color: '#23211d',
        roughness: 1.0,
        metalness: 0,
        grime: 0.5,
        note: 'Heavy diesel exhaust soot and urban street grime.',
      },
    },
  },

  2005: {
    year: 2005,
    name: 'Blue Glass & Backlit Plastic',
    description:
      'Reflective blue low-E curtain wall, precast concrete panels, anodized aluminum frames, and white backlit acrylic signboxes.',
    accent: '#2f74c9',
    signageStyle: 'backlit-plastic',
    emissiveCharacter: 'backlit-acrylic',
    defaultWeathering: 0.25,
    materials: {
      masonryConcrete: {
        color: '#b8b9bc',
        roughness: 0.7,
        metalness: 0,
        grime: 0.25,
        note: 'Smooth light-gray precast architectural concrete panels.',
      },
      metal: {
        color: '#a9b0b8',
        roughness: 0.3,
        metalness: 0.85,
        grime: 0.2,
        note: 'Clear-anodized aluminum mullions and metallic rainscreen panels.',
      },
      glass: {
        color: '#5b9bd8',
        roughness: 0.05,
        metalness: 0.05,
        grime: 0.12,
        note: 'Deep blue reflective low-E corporate curtain-wall glazing.',
      },
      wood: {
        color: '#8a6f55',
        roughness: 0.6,
        metalness: 0,
        grime: 0.2,
        note: 'Medium-toned engineered oak veneer and composite louvers.',
      },
      fabric: {
        color: '#31557e',
        roughness: 0.88,
        metalness: 0,
        grime: 0.2,
        note: 'Corporate navy canvas awnings and vinyl street banners.',
      },
      paintSignage: {
        color: '#ece7db',
        roughness: 0.35,
        metalness: 0,
        grime: 0.15,
        note: 'Printed vinyl graphics over warm-white acrylic lightbox faces.',
      },
      neonEmissive: {
        color: '#cfe6ff',
        roughness: 0.3,
        metalness: 0,
        grime: 0.12,
        emissive: '#bcdcff',
        emissiveIntensity: 1.6,
        note: 'Backlit translucent white-blue acrylic channel letters.',
      },
      asphaltStone: {
        color: '#46474b',
        roughness: 0.94,
        metalness: 0,
        grime: 0.25,
        note: 'Resurfaced blacktop asphalt with granite curb accents.',
      },
      grimeSoil: {
        color: '#2e2b26',
        roughness: 1.0,
        metalness: 0,
        grime: 0.3,
        note: 'Moderate urban road grime and tire dust.',
      },
    },
  },

  2025: {
    year: 2025,
    name: 'Clean White, Green Glass & LED',
    description:
      'Matte white rainscreens, high-performance green-tinted low-iron glass, brushed stainless steel, and crisp cool-white LED emissives.',
    accent: '#49d3a6',
    signageStyle: 'led-panel',
    emissiveCharacter: 'led',
    defaultWeathering: 0.1,
    materials: {
      masonryConcrete: {
        color: '#f0efe9',
        roughness: 0.6,
        metalness: 0,
        grime: 0.08,
        note: 'Clean white fiber-cement and fair-faced architectural concrete.',
      },
      metal: {
        color: '#c2c7cc',
        roughness: 0.32,
        metalness: 0.9,
        grime: 0.05,
        note: 'Brushed stainless steel and satin-anodized architectural aluminum.',
      },
      glass: {
        color: '#7ec8ad',
        roughness: 0.04,
        metalness: 0.05,
        grime: 0.06,
        note: 'Low-iron high-performance glazing with crisp emerald-green undertone.',
      },
      wood: {
        color: '#9c6f45',
        roughness: 0.55,
        metalness: 0,
        grime: 0.1,
        note: 'Thermally modified warm timber rainscreen battens.',
      },
      fabric: {
        color: '#4e7a63',
        roughness: 0.85,
        metalness: 0,
        grime: 0.08,
        note: 'Technical sage-green architectural tension textiles.',
      },
      paintSignage: {
        color: '#f7f8f6',
        roughness: 0.45,
        metalness: 0,
        grime: 0.06,
        note: 'Matte powder-coated white signage with micro-printed typography.',
      },
      neonEmissive: {
        color: '#dfe9e4',
        roughness: 0.3,
        metalness: 0,
        grime: 0.05,
        emissive: '#eafff6',
        emissiveIntensity: 2.6,
        note: 'High-CRI cool-white edge-lit LED panels and linear accents.',
      },
      asphaltStone: {
        color: '#4a4d51',
        roughness: 0.9,
        metalness: 0,
        grime: 0.12,
        note: 'Porous eco-asphalt paving and saw-cut basalt pavers.',
      },
      grimeSoil: {
        color: '#3b3a34',
        roughness: 1.0,
        metalness: 0,
        grime: 0.1,
        note: 'Minimal rain-washed urban soil and clean curbs.',
      },
    },
  },
});

/** Check whether a value is one of the five supported era years. */
export function isEraYear(value: unknown): value is EraYear {
  return typeof value === 'number' && (ERA_YEARS as readonly number[]).includes(value);
}

/** Retrieve the full palette for a given era year; throws if year is invalid. */
export function getEraPalette(year: number): EraPalette {
  if (!isEraYear(year)) {
    throw new Error(
      `[gfx-palettes] unknown era year ${year}; expected one of ${ERA_YEARS.join(', ')}`,
    );
  }
  return ERA_PALETTES[year];
}

/** List all five era palettes in ascending chronological order. */
export function listEraPalettes(): readonly EraPalette[] {
  return ERA_YEARS.map((year) => ERA_PALETTES[year]);
}

/** Convenience helper to fetch a specific material swatch for an era. */
export function getMaterialSwatch(
  year: EraYear,
  category: MaterialCategory,
): MaterialSwatch {
  return ERA_PALETTES[year].materials[category];
}
