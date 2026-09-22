/**
 * Shared part catalogue, material palette and prop recipes.
 *
 * Everything in this file is *data plus pure maths*: no three.js, no era table,
 * no year literal, no React. The mesh builder in `PropsLayer.tsx` turns these
 * descriptors into instanced geometry, and the era tables in `tables.ts` decide
 * which recipe stands on which anchor in which period, so a period change is a
 * table edit rather than a geometry change.
 *
 * ## Local frame of a recipe
 *
 * ```
 *        -z  (toward the building / block interior)
 *         ^
 *   -x <--+--> +x   (along the street)
 *         v
 *        +z  (outward: toward the kerb and the roadway)
 * ```
 *
 * `y = 0` is the ground-contact plane of a ground prop (the sidewalk deck for
 * every street anchor and street-level prop point). Boxes, cylinders and cones
 * are authored *base-origin* (`y` runs `0 … height`); spheres and tori are
 * centre-origin. Recipe parts are therefore authored as a stack of parts going
 * up from the pavement, and every part is rotated about its own origin before
 * being translated to its `at` offset.
 *
 * ## Footprint discipline
 *
 * {@link definePropRecipe} derives the recipe's bounds, footprint, height and
 * triangle count from its parts, and rejects a recipe whose footprint does not
 * fit a sidewalk sub-band (see `MAX_GROUND_PROP_DEPTH`). Everything a prop draws
 * therefore stays inside the footprint the planner proves legal, which is what
 * makes "no prop intersects a building, the road corridor or the walking band"
 * a property of the data rather than of a hand-checked placement.
 */

import {
  MAX_GROUND_PROP_DEPTH,
  MAX_GROUND_PROP_WIDTH,
  MAX_PROP_HEIGHT,
  type DetailKind,
  type MaterialKey,
  type MaterialSpec,
  type PartDefinition,
  type PartShape,
  type PropBounds,
  type PropPart,
  type PropRecipe,
  type ResolvedPropMaterial,
  type WearProfile,
  type MaterialEraTint,
} from './types'
import type { HexColor } from '../../era'

/* ------------------------------------------------------------------------- *
 * Colour helpers
 * ------------------------------------------------------------------------- */

interface Rgb {
  readonly r: number
  readonly g: number
  readonly b: number
}

/**
 * Rounds to `digits` decimals, normalising negative zero.
 *
 * Local to this module so the recipe data stays free of layout or engine
 * imports: a recipe is authored data, not a consumer of the block.
 */
function round(value: number, digits = 3): number {
  const factor = 10 ** digits
  const rounded = Math.round(value * factor) / factor
  return Object.is(rounded, -0) ? 0 : rounded
}

/** Parses `#rrggbb` (or `#rgb`); falls back to mid grey on malformed input. */
export function parseHexColour(value: string): Rgb {
  const hex = value.trim().replace(/^#/, '')
  if (hex.length === 3) {
    const r = Number.parseInt(hex[0] ?? '8', 16)
    const g = Number.parseInt(hex[1] ?? '8', 16)
    const b = Number.parseInt(hex[2] ?? '8', 16)
    return { r: r * 17, g: g * 17, b: b * 17 }
  }
  if (hex.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(hex)) {
    return { r: 128, g: 128, b: 128 }
  }
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return value < 0 ? 0 : value > 1 ? 1 : value
}

/** Serialises an RGB triple back to `#rrggbb`. */
export function toHexColour({ r, g, b }: Rgb): HexColor {
  const channel = (value: number): string =>
    Math.round(clamp01(value / 255) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

/** Linear blend of two colours; `amount` is clamped into 0..1. */
export function mixColours(from: Rgb, to: Rgb, amount: number): Rgb {
  const t = clamp01(amount)
  return {
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t,
  }
}

/** Scales a colour's channels; used for grime, fading and shadowing. */
export function scaleColour(colour: Rgb, factor: number): Rgb {
  return { r: colour.r * factor, g: colour.g * factor, b: colour.b * factor }
}

/** Mixes toward grey to knock the saturation out of a faded surface. */
function desaturate(colour: Rgb, amount: number): Rgb {
  const luminance = 0.2126 * colour.r + 0.7152 * colour.g + 0.0722 * colour.b
  return mixColours(colour, { r: luminance, g: luminance, b: luminance }, amount)
}

/* ------------------------------------------------------------------------- *
 * Material palette
 * ------------------------------------------------------------------------- */

/** Rust the weathered ferrous materials bloom towards. */
const RUST_COLOUR = parseHexColour('#6c3a1e')

/** Soot the grime pass mixes in. */
const GRIME_COLOUR = parseHexColour('#191a18')

/** Chalky bleached tone the fade pass mixes in. */
const FADE_COLOUR = parseHexColour('#cfc8b6')

function tint(channel: MaterialEraTint['channel'], amount: number): MaterialEraTint {
  return { channel, amount }
}

/**
 * One record per {@link MaterialKey}. `emissiveColour: null` means "take the
 * period's artificial-light colour from the era registry", which is how lamps,
 * neon and screens follow the era's lighting data without hard-coding colour.
 */
export const MATERIAL_SPECS: Readonly<Record<MaterialKey, MaterialSpec>> = {
  'cast-iron': {
    key: 'cast-iron',
    label: 'Cast iron',
    colour: '#2b2c2a',
    roughness: 0.62,
    metalness: 0.55,
    emissive: 0,
    emissiveColour: null,
    opacity: 1,
    eraTint: tint('streetFurniture', 0.35),
    grimeSensitivity: 0.85,
  },
  'painted-steel': {
    key: 'painted-steel',
    label: 'Painted steel',
    colour: '#40564a',
    roughness: 0.5,
    metalness: 0.32,
    emissive: 0,
    emissiveColour: null,
    opacity: 1,
    eraTint: tint('streetFurniture', 0.45),
    grimeSensitivity: 0.7,
  },
  'galvanised-steel': {
    key: 'galvanised-steel',
    label: 'Galvanised steel',
    colour: '#8d949c',
    roughness: 0.42,
    metalness: 0.72,
    emissive: 0,
    emissiveColour: null,
    opacity: 1,
    eraTint: tint('streetFurniture', 0.2),
    grimeSensitivity: 0.5,
  },
  chrome: {
    key: 'chrome',
    label: 'Chrome',
    colour: '#c9ced4',
    roughness: 0.18,
    metalness: 0.95,
    emissive: 0,
    emissiveColour: null,
    opacity: 1,
    eraTint: tint('accent', 0.12),
    grimeSensitivity: 0.35,
  },
  aluminium: {
    key: 'aluminium',
    label: 'Aluminium',
    colour: '#a8adb3',
    roughness: 0.35,
    metalness: 0.8,
    emissive: 0,
    emissiveColour: null,
    opacity: 1,
    eraTint: tint('streetFurniture', 0.15),
    grimeSensitivity: 0.45,
  },
  enamel: {
    key: 'enamel',
    label: 'Enamel',
    colour: '#e8e3d6',
    roughness: 0.3,
    metalness: 0.1,
    emissive: 0,
    emissiveColour: null,
    opacity: 1,
    eraTint: tint('buildingAccent', 0.25),
    grimeSensitivity: 0.6,
  },
  copper: {
    key: 'copper',
    label: 'Copper',
    colour: '#8a5a3b',
    roughness: 0.45,
    metalness: 0.7,
    emissive: 0,
    emissiveColour: null,
    opacity: 1,
    eraTint: tint('streetFurniture', 0.3),
    grimeSensitivity: 0.6,
  },
  glass: {
    key: 'glass',
    label: 'Glass',
    colour: '#b8c6c2',
    roughness: 0.1,
    metalness: 0.1,
    emissive: 0,
    emissiveColour: null,
    opacity: 0.42,
    eraTint: tint('windowGlass', 0.5),
    grimeSensitivity: 0.4,
  },
  'lamp-glass': {
    key: 'lamp-glass',
    label: 'Lamp glass',
    colour: '#ffe6b0',
    roughness: 0.2,
    metalness: 0,
    emissive: 0.9,
    emissiveColour: null,
    opacity: 1,
    eraTint: null,
    grimeSensitivity: 0.25,
  },
  'led-diffuser': {
    key: 'led-diffuser',
    label: 'LED diffuser',
    colour: '#e9f2ff',
    roughness: 0.25,
    metalness: 0,
    emissive: 0.85,
    emissiveColour: null,
    opacity: 1,
    eraTint: null,
    grimeSensitivity: 0.2,
  },
  'signal-lens-red': {
    key: 'signal-lens-red',
    label: 'Red lens',
    colour: '#7a1f1c',
    roughness: 0.25,
    metalness: 0,
    emissive: 0.55,
    emissiveColour: '#ff3b2f',
    opacity: 1,
    eraTint: null,
    grimeSensitivity: 0.3,
  },
  'signal-lens-amber': {
    key: 'signal-lens-amber',
    label: 'Amber lens',
    colour: '#7a5410',
    roughness: 0.25,
    metalness: 0,
    emissive: 0.5,
    emissiveColour: '#ffb02e',
    opacity: 1,
    eraTint: null,
    grimeSensitivity: 0.3,
  },
  'signal-lens-green': {
    key: 'signal-lens-green',
    label: 'Green lens',
    colour: '#1f5c33',
    roughness: 0.25,
    metalness: 0,
    emissive: 0.5,
    emissiveColour: '#4ade80',
    opacity: 1,
    eraTint: null,
    grimeSensitivity: 0.3,
  },
  'screen-glass': {
    key: 'screen-glass',
    label: 'Screen glass',
    colour: '#1d2a33',
    roughness: 0.12,
    metalness: 0.2,
    emissive: 0.5,
    emissiveColour: null,
    opacity: 1,
    eraTint: null,
    grimeSensitivity: 0.35,
  },
  'neon-tube': {
    key: 'neon-tube',
    label: 'Neon tube',
    colour: '#ff4f9a',
    roughness: 0.2,
    metalness: 0,
    emissive: 0.95,
    emissiveColour: null,
    opacity: 1,
    eraTint: tint('accent', 0.6),
    grimeSensitivity: 0.3,
  },
  concrete: {
    key: 'concrete',
    label: 'Concrete',
    colour: '#9d9a92',
    roughness: 0.9,
    metalness: 0.02,
    emissive: 0,
    emissiveColour: null,
    opacity: 1,
    eraTint: tint('sidewalk', 0.5),
    grimeSensitivity: 0.8,
  },
  granite: {
    key: 'granite',
    label: 'Granite',
    colour: '#8a8781',
    roughness: 0.85,
    metalness: 0.02,
    emissive: 0,
    emissiveColour: null,
    opacity: 1,
    eraTint: tint('sidewalk', 0.4),
    grimeSensitivity: 0.7,
  },
  timber: {
    key: 'timber',
    label: 'Timber',
    colour: '#6b5236',
    roughness: 0.85,
    metalness: 0.02,
    emissive: 0,
    emissiveColour: null,
    opacity: 1,
    eraTint: tint('storefrontBody', 0.3),
    grimeSensitivity: 0.7,
  },
  rubber: {
    key: 'rubber',
    label: 'Rubber',
    colour: '#26282b',
    roughness: 0.9,
    metalness: 0.05,
    emissive: 0,
    emissiveColour: null,
    opacity: 1,
    eraTint: null,
    grimeSensitivity: 0.6,
  },
  plastic: {
    key: 'plastic',
    label: 'Plastic',
    colour: '#4d5a63',
    roughness: 0.6,
    metalness: 0.1,
    emissive: 0,
    emissiveColour: null,
    opacity: 1,
    eraTint: tint('streetFurniture', 0.3),
    grimeSensitivity: 0.55,
  },
  canvas: {
    key: 'canvas',
    label: 'Canvas',
    colour: '#b9a887',
    roughness: 0.95,
    metalness: 0,
    emissive: 0,
    emissiveColour: null,
    opacity: 1,
    eraTint: tint('storefrontSign', 0.4),
    grimeSensitivity: 0.7,
  },
  paper: {
    key: 'paper',
    label: 'Paper',
    colour: '#d9d2bd',
    roughness: 0.95,
    metalness: 0,
    emissive: 0,
    emissiveColour: null,
    opacity: 1,
    eraTint: tint('storefrontSign', 0.25),
    grimeSensitivity: 0.5,
  },
  'paint-marking': {
    key: 'paint-marking',
    label: 'Marking paint',
    colour: '#e8e4d8',
    roughness: 0.75,
    metalness: 0,
    emissive: 0,
    emissiveColour: null,
    opacity: 1,
    eraTint: tint('roadMarking', 0.4),
    grimeSensitivity: 0.6,
  },
  'asphalt-patch': {
    key: 'asphalt-patch',
    label: 'Asphalt patch',
    colour: '#4a4c50',
    roughness: 0.95,
    metalness: 0,
    emissive: 0,
    emissiveColour: null,
    opacity: 1,
    eraTint: tint('roadSurface', 0.5),
    grimeSensitivity: 0.75,
  },
  'graffiti-paint': {
    key: 'graffiti-paint',
    label: 'Graffiti paint',
    colour: '#e05a8a',
    roughness: 0.55,
    metalness: 0.05,
    emissive: 0,
    emissiveColour: null,
    opacity: 1,
    eraTint: tint('accent', 0.5),
    grimeSensitivity: 0.4,
  },
  'reflective-film': {
    key: 'reflective-film',
    label: 'Reflective film',
    colour: '#d8e4ea',
    roughness: 0.3,
    metalness: 0.3,
    emissive: 0.35,
    emissiveColour: '#eaf6ff',
    opacity: 1,
    eraTint: null,
    grimeSensitivity: 0.3,
  },
  'leaf-litter': {
    key: 'leaf-litter',
    label: 'Leaf litter',
    colour: '#8a6a34',
    roughness: 0.95,
    metalness: 0,
    emissive: 0,
    emissiveColour: null,
    opacity: 1,
    eraTint: tint('accent', 0.2),
    grimeSensitivity: 0.6,
  },
  snow: {
    key: 'snow',
    label: 'Snow and grit',
    colour: '#e8eef2',
    roughness: 0.8,
    metalness: 0,
    emissive: 0,
    emissiveColour: null,
    opacity: 1,
    eraTint: null,
    grimeSensitivity: 0.4,
  },
}

/** Every material key, in catalogue order. */
export const PALETTE_MATERIAL_KEYS: readonly MaterialKey[] = Object.keys(MATERIAL_SPECS) as MaterialKey[]

/* ------------------------------------------------------------------------- *
 * Wear resolution
 * ------------------------------------------------------------------------- */

/**
 * Applies one era's wear profile to a material.
 *
 * Both the era's palette and its condition show here: the base colour is mixed
 * toward the palette channel the material declares, then rust, fading, grime and
 * graffiti are layered on in a fixed order so the result is deterministic.
 */
export function resolveMaterial(
  spec: MaterialSpec,
  palette: Readonly<Record<MaterialEraTint['channel'], HexColor>>,
  wear: WearProfile,
  artificialLightColour: HexColor,
): ResolvedPropMaterial {
  let colour = parseHexColour(spec.colour)
  if (spec.eraTint !== null) {
    const paletteColour = palette[spec.eraTint.channel]
    colour = mixColours(colour, parseHexColour(paletteColour), spec.eraTint.amount)
  }

  const sensitivity = spec.grimeSensitivity
  const rust = clamp01(wear.rust * sensitivity * (spec.metalness > 0.4 ? 1 : 0.3))
  if (rust > 0) {
    colour = mixColours(colour, RUST_COLOUR, rust * 0.45)
  }

  const fade = clamp01(wear.fade * sensitivity)
  if (fade > 0) {
    colour = desaturate(mixColours(colour, FADE_COLOUR, fade * 0.35), fade * 0.3)
  }

  const grime = clamp01(wear.grime * sensitivity)
  const chips = clamp01(wear.chips * sensitivity)
  colour = scaleColour(mixColours(colour, GRIME_COLOUR, grime * 0.4), 1 - 0.12 * chips)

  const graffiti = clamp01(wear.graffiti * sensitivity)
  if (graffiti > 0.35 && spec.metalness < 0.6) {
    colour = mixColours(colour, parseHexColour(MATERIAL_SPECS['graffiti-paint'].colour), (graffiti - 0.35) * 0.6)
  }

  return {
    key: spec.key,
    colour: toHexColour(colour),
    roughness: clamp01(spec.roughness + grime * 0.15),
    metalness: spec.metalness,
    emissive: spec.emissive,
    emissiveColour: spec.emissiveColour ?? artificialLightColour,
    opacity: spec.opacity,
  }
}

/** Resolves a whole era's prop palette; the props runtime caches the result. */
export function resolveMaterialPalette(
  palette: Readonly<Record<MaterialEraTint['channel'], HexColor>>,
  wear: WearProfile,
  artificialLightColour: HexColor,
): Readonly<Record<MaterialKey, ResolvedPropMaterial>> {
  const resolved = {} as Record<MaterialKey, ResolvedPropMaterial>
  for (const key of PALETTE_MATERIAL_KEYS) {
    resolved[key] = resolveMaterial(MATERIAL_SPECS[key], palette, wear, artificialLightColour)
  }
  return resolved
}

/** Merges an era's wear profile with a per-prop override. */
export function mergeWear(base: WearProfile, override: Partial<WearProfile> | undefined): WearProfile {
  if (override === undefined) {
    return base
  }
  return {
    level: override.level ?? base.level,
    grime: clamp01(override.grime ?? base.grime),
    chips: clamp01(override.chips ?? base.chips),
    rust: clamp01(override.rust ?? base.rust),
    fade: clamp01(override.fade ?? base.fade),
    graffiti: clamp01(override.graffiti ?? base.graffiti),
  }
}

/* ------------------------------------------------------------------------- *
 * Part catalogue
 * ------------------------------------------------------------------------- */

function part(id: string, label: string, shape: PartShape, detail: DetailKind): PartDefinition {
  return { id, label, shape, detail }
}

/**
 * Shared primitives. Sizes are metres in the recipe's local frame (see the
 * module comment); every recipe composes its mesh out of these, which is what
 * lets the builder instance repeats and keep the draw-call count flat.
 */
export const PARTS: readonly PartDefinition[] = [
  /* Posts, plinths and lamp furniture -------------------------------------- */
  part('post-plinth', 'Post plinth', { kind: 'box', size: [0.46, 0.12, 0.46] }, 'lamp-post'),
  part('post-shaft-low', 'Low post shaft', { kind: 'cylinder', radius: 0.075, height: 3.6, segments: 8 }, 'lamp-post'),
  part('post-shaft-mid', 'Mid post shaft', { kind: 'cylinder', radius: 0.085, height: 5.2, segments: 8 }, 'lamp-post'),
  part('post-shaft-tall', 'Tall post shaft', { kind: 'cylinder', radius: 0.095, height: 6.4, segments: 8 }, 'lamp-post'),
  part('post-shaft-smart', 'Smart pole shaft', { kind: 'cylinder', radius: 0.11, height: 6.2, segments: 10 }, 'lamp-post'),
  part('lamp-arm', 'Lamp arm', { kind: 'box', size: [0.07, 0.07, 0.55] }, 'lamp-head'),
  part('lamp-arm-short', 'Short lamp arm', { kind: 'box', size: [0.06, 0.06, 0.3] }, 'lamp-head'),
  part('lamp-crossbar', 'Lamp crossbar', { kind: 'box', size: [1.05, 0.07, 0.07] }, 'lamp-head'),
  part('lamp-crown', 'Lantern crown', { kind: 'cone', radius: 0.34, height: 0.34, segments: 8 }, 'lamp-head'),
  part('lamp-acorn', 'Acorn luminaire', { kind: 'sphere', radius: 0.24, segments: 10 }, 'lamp-head'),
  part('lamp-cobra', 'Cobra head shell', { kind: 'box', size: [0.7, 0.18, 0.34] }, 'lamp-head'),
  part('lamp-panel', 'LED panel shell', { kind: 'box', size: [0.66, 0.1, 0.3] }, 'lamp-head'),
  part('lamp-glass-globe', 'Globe glass', { kind: 'sphere', radius: 0.19, segments: 10 }, 'lamp-glass'),
  part('lamp-glass-panel', 'Panel glass', { kind: 'box', size: [0.56, 0.05, 0.22] }, 'lamp-glass'),
  part('lamp-glass-tube', 'Glass tube', { kind: 'box', size: [0.2, 0.46, 0.2] }, 'lamp-glass'),
  part('lamp-banner', 'Post banner', { kind: 'box', size: [0.46, 0.9, 0.03] }, 'sign-face'),

  /* Signals ---------------------------------------------------------------- */
  part('signal-pole', 'Signal pole', { kind: 'cylinder', radius: 0.075, height: 4.6, segments: 8 }, 'signal-pole'),
  part('signal-mast', 'Signal mast arm', { kind: 'box', size: [3.0, 0.08, 0.08] }, 'signal-pole'),
  part('signal-box-manual', 'Manual signal box', { kind: 'box', size: [0.34, 0.5, 0.26] }, 'signal-head'),
  part('signal-box-three', 'Three-lamp body', { kind: 'box', size: [0.36, 1.0, 0.28] }, 'signal-head'),
  part('signal-box-black', 'Black signal body', { kind: 'box', size: [0.4, 1.15, 0.32] }, 'signal-head'),
  part('signal-head-led', 'LED signal head', { kind: 'box', size: [0.5, 0.34, 0.28] }, 'signal-head'),
  part('signal-ped-box', 'Pedestrian signal box', { kind: 'box', size: [0.3, 0.36, 0.16] }, 'signal-head'),
  part('signal-lens', 'Signal lens', { kind: 'sphere', radius: 0.075, segments: 8 }, 'signal-lens'),
  part('signal-lens-led', 'LED lens', { kind: 'box', size: [0.14, 0.14, 0.03] }, 'signal-lens'),
  part('signal-bell', 'Signal bell', { kind: 'cylinder', radius: 0.13, height: 0.14, segments: 8 }, 'signal-head'),
  part('signal-cabinet', 'Signal control cabinet', { kind: 'box', size: [0.62, 1.1, 0.6] }, 'signal-cabinet'),
  part('signal-camera', 'Signal camera', { kind: 'box', size: [0.14, 0.14, 0.26] }, 'camera'),

  /* Hydrants --------------------------------------------------------------- */
  part('hydrant-barrel', 'Hydrant barrel', { kind: 'cylinder', radius: 0.16, height: 0.62, segments: 8 }, 'hydrant-body'),
  part('hydrant-collar', 'Hydrant collar', { kind: 'cylinder', radius: 0.2, height: 0.08, segments: 8 }, 'hydrant-body'),
  part('hydrant-cap', 'Hydrant cap', { kind: 'cone', radius: 0.19, height: 0.2, segments: 8 }, 'hydrant-body'),
  part('hydrant-arm', 'Hydrant outlet', { kind: 'box', size: [0.32, 0.07, 0.07] }, 'hydrant-body'),
  part('hydrant-band', 'Reflective band', { kind: 'box', size: [0.34, 0.05, 0.34] }, 'hydrant-body'),
  part('hydrant-sensor', 'Hydrant sensor', { kind: 'box', size: [0.16, 0.2, 0.14] }, 'utility-fitting'),

  /* Drains, grates and facade detail --------------------------------------- */
  part('grate', 'Gutter grate', { kind: 'box', size: [0.62, 0.05, 0.4] }, 'grate'),
  part('drain-frame', 'Drain frame', { kind: 'box', size: [0.72, 0.04, 0.5] }, 'drain'),
  part('wall-vent', 'Wall vent', { kind: 'box', size: [0.36, 0.28, 0.16] }, 'vent'),
  part('roof-vent', 'Roof vent', { kind: 'cylinder', radius: 0.28, height: 0.5, segments: 8 }, 'vent'),
  part('drainpipe', 'Drainpipe', { kind: 'cylinder', radius: 0.07, height: 3.8, segments: 6 }, 'drainpipe'),
  part('drainpipe-boot', 'Drainpipe boot', { kind: 'cylinder', radius: 0.075, height: 0.4, segments: 6 }, 'drainpipe'),
  part('ac-unit', 'Wall AC unit', { kind: 'box', size: [0.8, 0.56, 0.44] }, 'ac-unit'),
  part('ac-bracket', 'AC bracket', { kind: 'box', size: [0.5, 0.06, 0.44] }, 'ac-unit'),
  part('signage-pole', 'Signage pole', { kind: 'cylinder', radius: 0.045, height: 2.6, segments: 6 }, 'signage-pole'),
  part('sign-face', 'Sign face', { kind: 'box', size: [0.5, 0.34, 0.04] }, 'sign-face'),
  part('sign-arrow', 'Arrow sign face', { kind: 'box', size: [0.7, 0.3, 0.06] }, 'sign-face'),
  part('neon-arrow', 'Neon arrow tube', { kind: 'box', size: [0.6, 0.22, 0.05] }, 'sign-face'),
  part('neon-palm', 'Neon palm tube', { kind: 'box', size: [0.5, 0.9, 0.06] }, 'sign-face'),
  part('awning-frame', 'Awning frame', { kind: 'box', size: [2.6, 0.08, 0.08] }, 'awning-frame'),
  part('awning-rail', 'Awning rail', { kind: 'box', size: [2.6, 0.06, 0.9] }, 'awning-frame'),
  part('awning-post', 'Awning post', { kind: 'cylinder', radius: 0.05, height: 2.4, segments: 6 }, 'awning-frame'),

  /* Seating, bins, bollards and kiosks ------------------------------------- */
  part('bench-seat', 'Bench seat', { kind: 'box', size: [1.8, 0.09, 0.46] }, 'seating'),
  part('bench-back', 'Bench back', { kind: 'box', size: [1.8, 0.4, 0.08] }, 'seating'),
  part('bench-leg', 'Bench leg', { kind: 'box', size: [0.08, 0.42, 0.42] }, 'seating'),
  part('parklet-deck', 'Parklet deck', { kind: 'box', size: [2.4, 0.14, 0.98] }, 'platform'),
  part('planter-tub', 'Planter tub', { kind: 'box', size: [1.1, 0.55, 0.7] }, 'planter'),
  part('planter-shrub', 'Planter shrub', { kind: 'sphere', radius: 0.32, segments: 8 }, 'planter'),
  part('bollard-body', 'Bollard body', { kind: 'cylinder', radius: 0.11, height: 0.92, segments: 8 }, 'bollard'),
  part('bollard-cap', 'Bollard cap', { kind: 'sphere', radius: 0.12, segments: 8 }, 'bollard'),
  part('bin-body', 'Bin body', { kind: 'cylinder', radius: 0.24, height: 0.78, segments: 10 }, 'bin'),
  part('bin-lid', 'Bin lid', { kind: 'cylinder', radius: 0.26, height: 0.07, segments: 10 }, 'bin'),
  part('bin-post', 'Bin post', { kind: 'cylinder', radius: 0.05, height: 1.1, segments: 6 }, 'bin'),
  part('mailbox-body', 'Mailbox body', { kind: 'box', size: [0.44, 0.66, 0.4] }, 'clutter'),
  part('mailbox-hood', 'Mailbox hood', { kind: 'box', size: [0.48, 0.14, 0.44] }, 'clutter'),
  part('mailbox-leg', 'Mailbox leg', { kind: 'cylinder', radius: 0.05, height: 0.95, segments: 6 }, 'clutter'),
  part('booth-shell', 'Phone booth shell', { kind: 'box', size: [0.95, 2.25, 0.9] }, 'booth'),
  part('booth-glass', 'Phone booth glass', { kind: 'box', size: [0.78, 1.25, 0.84] }, 'booth'),
  part('booth-sign', 'Phone booth sign', { kind: 'box', size: [0.6, 0.3, 0.06] }, 'sign-face'),
  part('payphone-shell', 'Payphone row shell', { kind: 'box', size: [1.7, 2.3, 0.8] }, 'booth'),
  part('payphone-hood', 'Payphone row hood', { kind: 'box', size: [1.9, 0.12, 0.9] }, 'booth'),
  part('payphone-unit', 'Payphone unit', { kind: 'box', size: [0.34, 0.5, 0.2] }, 'booth'),
  part('stand-body', 'Newsstand body', { kind: 'box', size: [1.7, 1.5, 0.95] }, 'stand'),
  part('stand-canopy', 'Newsstand canopy', { kind: 'box', size: [2.0, 0.09, 1.0] }, 'stand'),
  part('stand-shelf', 'Newsstand shelf', { kind: 'box', size: [1.7, 0.07, 0.5] }, 'stand'),
  part('stand-frame', 'Newsstand frame', { kind: 'box', size: [0.08, 1.6, 0.08] }, 'stand'),
  part('meter-head', 'Parking meter head', { kind: 'box', size: [0.18, 0.32, 0.15] }, 'meter'),
  part('meter-pole', 'Parking meter pole', { kind: 'cylinder', radius: 0.04, height: 1.15, segments: 6 }, 'meter'),
  part('meter-clock', 'Parking meter dial', { kind: 'box', size: [0.14, 0.12, 0.16] }, 'meter'),
  part('kiosk-shell', 'Kiosk shell', { kind: 'box', size: [0.95, 1.8, 0.62] }, 'kiosk'),
  part('kiosk-screen', 'Kiosk screen', { kind: 'box', size: [0.6, 0.44, 0.05] }, 'screen'),
  part('kiosk-side', 'Kiosk side panel', { kind: 'box', size: [0.2, 1.7, 0.05] }, 'kiosk'),
  part('atm-shell', 'ATM shell', { kind: 'box', size: [0.9, 1.75, 0.6] }, 'kiosk'),
  part('atm-screen', 'ATM screen', { kind: 'box', size: [0.58, 0.42, 0.05] }, 'screen'),
  part('atm-hood', 'ATM hood', { kind: 'box', size: [0.98, 0.12, 0.7] }, 'kiosk'),
  part('shelter-roof', 'Shelter roof', { kind: 'box', size: [3.4, 0.12, 0.98] }, 'shelter'),
  part('shelter-post', 'Shelter post', { kind: 'cylinder', radius: 0.06, height: 2.4, segments: 6 }, 'shelter'),
  part('shelter-panel', 'Shelter panel', { kind: 'box', size: [2.0, 1.5, 0.06] }, 'shelter'),
  part('shelter-bench', 'Shelter bench', { kind: 'box', size: [2.2, 0.08, 0.42] }, 'seating'),
  part('shelter-ad-panel', 'Shelter advertisement', { kind: 'box', size: [0.9, 1.6, 0.08] }, 'screen'),
  part('news-box', 'Newspaper box', { kind: 'box', size: [0.42, 0.72, 0.4] }, 'kiosk'),
  part('rack-hoop', 'Bike rack hoop', { kind: 'torus', radius: 0.4, tube: 0.035, segments: 12 }, 'rack'),
  part('rack-rail', 'Bike rack rail', { kind: 'box', size: [1.3, 0.06, 0.06] }, 'rack'),
  part('scooter-deck', 'Scooter deck', { kind: 'box', size: [0.85, 0.09, 0.2] }, 'rack'),
  part('scooter-stem', 'Scooter stem', { kind: 'cylinder', radius: 0.03, height: 1.0, segments: 6 }, 'rack'),
  part('scooter-bars', 'Scooter bars', { kind: 'box', size: [0.5, 0.04, 0.04] }, 'rack'),
  part('dock-rail', 'Scooter dock rail', { kind: 'box', size: [1.15, 0.1, 0.66] }, 'rack'),
  part('charger-body', 'Charger body', { kind: 'box', size: [0.42, 1.25, 0.3] }, 'charger'),
  part('charger-head', 'Charger head', { kind: 'box', size: [0.16, 0.4, 0.16] }, 'charger'),
  part('charger-screen', 'Charger screen', { kind: 'box', size: [0.24, 0.3, 0.05] }, 'screen'),
  part('cabinet-body', 'Utility cabinet', { kind: 'box', size: [0.9, 1.2, 0.55] }, 'cabinet'),
  part('cabinet-lid', 'Cabinet lid', { kind: 'box', size: [0.96, 0.07, 0.6] }, 'cabinet'),
  part('camera-post', 'Camera post', { kind: 'cylinder', radius: 0.05, height: 3.2, segments: 6 }, 'camera'),
  part('camera-body', 'Camera body', { kind: 'box', size: [0.16, 0.16, 0.36] }, 'camera'),
  part('camera-mount', 'Camera mount', { kind: 'box', size: [0.08, 0.08, 0.24] }, 'camera'),
  part('dumpster-body', 'Dumpster body', { kind: 'box', size: [1.8, 1.1, 0.95] }, 'bin'),
  part('dumpster-lid', 'Dumpster lid', { kind: 'box', size: [1.86, 0.12, 0.5] }, 'bin'),
  part('dumpster-wheel', 'Dumpster wheel', { kind: 'box', size: [0.08, 0.18, 0.18] }, 'bin'),
  part('barrier-panel', 'Barrier panel', { kind: 'box', size: [2.4, 0.9, 0.07] }, 'barrier'),
  part('barrier-leg', 'Barrier leg', { kind: 'box', size: [0.09, 1.0, 0.09] }, 'barrier'),
  part('barrier-light', 'Barrier lamp', { kind: 'sphere', radius: 0.09, segments: 8 }, 'barrier'),
  part('crate', 'Crate', { kind: 'box', size: [0.34, 0.28, 0.34] }, 'crate'),
  part('cart-bed', 'Handcart bed', { kind: 'box', size: [1.3, 0.36, 0.72] }, 'cart'),
  part('cart-handle', 'Handcart handle', { kind: 'cylinder', radius: 0.035, height: 0.9, segments: 6 }, 'cart'),
  part('cart-handle-bar', 'Handcart handle bar', { kind: 'box', size: [0.06, 0.08, 0.5] }, 'cart'),
  part('cart-wheel', 'Handcart wheel', { kind: 'box', size: [0.07, 0.46, 0.46] }, 'cart'),
  part('chute-hatch', 'Coal chute hatch', { kind: 'box', size: [0.56, 0.05, 0.5] }, 'patch'),
  part('chute-lip', 'Coal chute lip', { kind: 'box', size: [0.66, 0.1, 0.14] }, 'patch'),
  part('horse-post', 'Hitching post', { kind: 'cylinder', radius: 0.06, height: 0.85, segments: 6 }, 'clutter'),
  part('horse-ring', 'Hitching ring', { kind: 'torus', radius: 0.09, tube: 0.02, segments: 10 }, 'clutter'),
  part('patch-slab', 'Pavement patch', { kind: 'box', size: [1.4, 0.03, 0.9] }, 'patch'),
  part('litter-bit', 'Litter', { kind: 'box', size: [0.14, 0.06, 0.11] }, 'clutter'),
  part('litter-paper', 'Paper litter', { kind: 'box', size: [0.2, 0.02, 0.16] }, 'clutter'),
  part('newspaper', 'Folded newspaper', { kind: 'box', size: [0.3, 0.02, 0.4] }, 'clutter'),
  part('boom-box', 'Boom box', { kind: 'box', size: [0.5, 0.26, 0.2] }, 'clutter'),
  part('boom-crate', 'Boom box crate', { kind: 'box', size: [0.4, 0.3, 0.36] }, 'crate'),
  part('pile-cone', 'Grit pile', { kind: 'cone', radius: 0.55, height: 0.32, segments: 10 }, 'pile'),
  part('pile-mound', 'Leaf pile', { kind: 'sphere', radius: 0.44, segments: 8 }, 'pile'),
  part('sensor-kiosk', 'Sensor cabinet', { kind: 'box', size: [0.5, 1.15, 0.4] }, 'cabinet'),
  part('sensor-head', 'Sensor head', { kind: 'box', size: [0.24, 0.26, 0.22] }, 'utility-fitting'),
  part('small-cell', 'Small cell', { kind: 'box', size: [0.3, 0.7, 0.3] }, 'utility-fitting'),
  part('pole-bracket', 'Pole bracket', { kind: 'box', size: [0.26, 0.07, 0.07] }, 'utility-fitting'),
  part('pole-sign-plate', 'Pole sign plate', { kind: 'box', size: [0.5, 0.34, 0.03] }, 'sign-face'),
  part('transformer-drum', 'Transformer drum', { kind: 'cylinder', radius: 0.34, height: 0.85, segments: 10 }, 'utility-fitting'),
  part('fuse-box', 'Fuse box', { kind: 'box', size: [0.3, 0.5, 0.24] }, 'utility-fitting'),
  part('cable-bundle', 'Cable bundle', { kind: 'cylinder', radius: 0.05, height: 1.4, segments: 6 }, 'utility-fitting'),
  part('cable-drop', 'Cable drop', { kind: 'cylinder', radius: 0.035, height: 2.2, segments: 6 }, 'utility-fitting'),
  part('utility-pole', 'Utility pole', { kind: 'cylinder', radius: 0.06, height: 9, segments: 8 }, 'utility-fitting'),
  part('roof-chimney', 'Chimney stack', { kind: 'box', size: [0.8, 1.6, 0.8] }, 'roof-detail'),
  part('roof-hatch', 'Roof hatch', { kind: 'box', size: [1.0, 0.22, 1.0] }, 'roof-detail'),
  part('roof-ac', 'Roof AC unit', { kind: 'box', size: [1.1, 0.8, 0.9] }, 'roof-detail'),
  part('roof-tank', 'Roof water tank', { kind: 'cylinder', radius: 0.9, height: 1.6, segments: 12 }, 'roof-detail'),
  part('roof-tank-leg', 'Tank leg', { kind: 'box', size: [0.16, 0.9, 0.16] }, 'roof-detail'),
  part('roof-solar', 'Solar panel', { kind: 'box', size: [1.7, 0.07, 1.05] }, 'roof-detail'),
  part('roof-parapet-box', 'Parapet plant box', { kind: 'box', size: [0.9, 0.6, 0.6] }, 'roof-detail'),
]

/** Part catalogue indexed by id. */
export const PART_BY_ID: Readonly<Record<string, PartDefinition>> = Object.fromEntries(
  PARTS.map((definition) => [definition.id, definition]),
)

/** Every part id the catalogue defines, sorted. */
export const PART_IDS: readonly string[] = PARTS.map((definition) => definition.id)

/* ------------------------------------------------------------------------- *
 * Shape maths
 * ------------------------------------------------------------------------- */

/** Default radial segment count of curved primitives when a part omits one. */
export const DEFAULT_SEGMENTS = 8

/** Default tube-segment count of a torus. */
export const DEFAULT_TUBE_SEGMENTS = 6

/**
 * Triangles one instance of a shape occupies, matching the mesh builder's
 * segment counts exactly so the plan can budget before anything is built.
 */
export function shapeTriangles(shape: PartShape): number {
  switch (shape.kind) {
    case 'box':
      return 12
    case 'cylinder': {
      const segments = shape.segments ?? DEFAULT_SEGMENTS
      return segments * 4
    }
    case 'cone': {
      const segments = shape.segments ?? DEFAULT_SEGMENTS
      return segments * 3
    }
    case 'sphere': {
      const segments = shape.segments ?? DEFAULT_SEGMENTS
      const rows = Math.max(4, Math.round(segments * 0.75))
      return rows * segments * 2 - segments * 2
    }
    case 'torus': {
      const segments = shape.segments ?? 12
      return segments * DEFAULT_TUBE_SEGMENTS * 2
    }
  }
}

/** Local axis-aligned extent of a shape, before rotation and translation. */
export function shapeExtent(shape: PartShape): { min: PropBoundsMutable; max: PropBoundsMutable } {
  switch (shape.kind) {
    case 'box':
      return {
        min: { x: -shape.size[0] / 2, y: 0, z: -shape.size[2] / 2 },
        max: { x: shape.size[0] / 2, y: shape.size[1], z: shape.size[2] / 2 },
      }
    case 'cylinder':
    case 'cone':
      return {
        min: { x: -shape.radius, y: 0, z: -shape.radius },
        max: { x: shape.radius, y: shape.height, z: shape.radius },
      }
    case 'sphere':
      return {
        min: { x: -shape.radius, y: -shape.radius, z: -shape.radius },
        max: { x: shape.radius, y: shape.radius, z: shape.radius },
      }
    case 'torus': {
      const extent = shape.radius + shape.tube
      return {
        min: { x: -extent, y: -shape.tube, z: -extent },
        max: { x: extent, y: shape.tube, z: extent },
      }
    }
  }
}

interface PropBoundsMutable {
  x: number
  y: number
  z: number
}

/** Rotation matrix of an XYZ Euler triple, matching three.js' `Euler` order. */
function rotationMatrix(rotate: readonly [number, number, number]): number[] {
  const [rx, ry, rz] = rotate
  const cx = Math.cos(rx)
  const sx = Math.sin(rx)
  const cy = Math.cos(ry)
  const sy = Math.sin(ry)
  const cz = Math.cos(rz)
  const sz = Math.sin(rz)
  // R = Rx * Ry * Rz, the composition three.js applies for order 'XYZ'.
  return [
    cy * cz,
    -cy * sz,
    sy,
    cx * sz + sx * sy * cz,
    cx * cz - sx * sy * sz,
    -sx * cy,
    sx * sz - cx * sy * cz,
    sx * cz + cx * sy * sz,
    cx * cy,
  ]
}

/** Axis-aligned bounds of one part in the recipe's local frame. */
export function partBounds(partInstance: PropPart): PropBounds {
  const definition = PART_BY_ID[partInstance.part]
  if (definition === undefined) {
    throw new RangeError(`Unknown part ${partInstance.part}`)
  }
  const extent = shapeExtent(definition.shape)
  const scale = partInstance.scale ?? [1, 1, 1]
  const rotation = partInstance.rotate ?? [0, 0, 0]
  const matrix = rotationMatrix(rotation)
  const corners: Array<readonly [number, number, number]> = []
  for (const x of [extent.min.x, extent.max.x]) {
    for (const y of [extent.min.y, extent.max.y]) {
      for (const z of [extent.min.z, extent.max.z]) {
        const sx = x * (scale[0] ?? 1)
        const sy = y * (scale[1] ?? 1)
        const sz = z * (scale[2] ?? 1)
        corners.push([
          (matrix[0] ?? 1) * sx + (matrix[1] ?? 0) * sy + (matrix[2] ?? 0) * sz,
          (matrix[3] ?? 0) * sx + (matrix[4] ?? 1) * sy + (matrix[5] ?? 0) * sz,
          (matrix[6] ?? 0) * sx + (matrix[7] ?? 0) * sy + (matrix[8] ?? 1) * sz,
        ])
      }
    }
  }
  const xs = corners.map((corner) => corner[0] + partInstance.at[0])
  const ys = corners.map((corner) => corner[1] + partInstance.at[1])
  const zs = corners.map((corner) => corner[2] + partInstance.at[2])
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  }
}

/** Union of a list of bounds. */
export function unionBounds(bounds: readonly PropBounds[]): PropBounds {
  if (bounds.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 }
  }
  return bounds.reduce((accumulated, current) => ({
    minX: Math.min(accumulated.minX, current.minX),
    maxX: Math.max(accumulated.maxX, current.maxX),
    minY: Math.min(accumulated.minY, current.minY),
    maxY: Math.max(accumulated.maxY, current.maxY),
    minZ: Math.min(accumulated.minZ, current.minZ),
    maxZ: Math.max(accumulated.maxZ, current.maxZ),
  }))
}

/* ------------------------------------------------------------------------- *
 * Recipe definition
 * ------------------------------------------------------------------------- */

/** One problem found in the hand-authored recipe data. */
export interface PropRecipeIssue {
  readonly recipeId: string
  readonly code: 'no-parts' | 'unknown-part' | 'too-deep' | 'too-wide' | 'too-tall' | 'below-contact'
  readonly message: string
}

/**
 * Every problem found while completing the catalogue, in catalogue order.
 *
 * `definePropRecipe` records issues here as the recipes are authored, and the
 * unit suite asserts the list is empty, so a recipe that could not be placed
 * legally can never slip through to the renderer unnoticed.
 */
export const RECIPE_ISSUES: PropRecipeIssue[] = []

/** Throws with a readable report when any recipe is invalid. */
export function assertRecipesValid(): void {
  if (RECIPE_ISSUES.length === 0) {
    return
  }
  const report = RECIPE_ISSUES.map((issue) => `${issue.recipeId}: ${issue.message}`).join('\n')
  throw new RangeError(`Invalid prop recipes:\n${report}`)
}

/** Authoring shape of a recipe; the derived fields are filled in for you. */
export interface PropRecipeSpec {
  readonly id: string
  readonly label: string
  readonly category: PropRecipe['category']
  readonly slot: PropRecipe['slot']
  readonly mount: PropRecipe['mount']
  readonly facing: PropRecipe['facing']
  readonly parts: readonly PropPart[]
  readonly lamp?: PropRecipe['lamp']
  /** Contact point pinned to the legal station; defaults to the footprint centre. */
  readonly contact?: readonly [number, number, number]
  /** Scale jitter range; defaults to ±5 %. */
  readonly scaleRange?: readonly [number, number]
  readonly wearSensitivity?: number
  readonly tags?: readonly string[]
  readonly notes: string
}

/**
 * Validates and completes a recipe.
 *
 * Derives the bounds, footprint, height, material palette and triangle count,
 * and refuses data the planner could not place legally: an unknown part, a
 * ground prop deeper than a sidewalk sub-band, a prop wider than the block's
 * widest legal footprint, or one taller than {@link MAX_PROP_HEIGHT}.
 *
 * Problems are collected in {@link RECIPE_ISSUES} rather than thrown, so the
 * unit suite can report every offending recipe in one run and the browser
 * harness still boots while the catalogue is being authored.
 */
export function definePropRecipe(spec: PropRecipeSpec): PropRecipe {
  if (spec.parts.length === 0) {
    RECIPE_ISSUES.push({ recipeId: spec.id, code: 'no-parts', message: 'Recipe has no parts' })
  }
  for (const instance of spec.parts) {
    if (PART_BY_ID[instance.part] === undefined) {
      RECIPE_ISSUES.push({
        recipeId: spec.id,
        code: 'unknown-part',
        message: `Recipe references unknown part ${instance.part}`,
      })
    }
  }
  const knownParts = spec.parts.filter((instance) => PART_BY_ID[instance.part] !== undefined)
  const partBoundsList = knownParts.map(partBounds)
  const bounds = unionBounds(partBoundsList)
  const width = bounds.maxX - bounds.minX
  const depth = bounds.maxZ - bounds.minZ
  // Height is measured from the contact plane, so a part that hangs below it
  // (the mast of a pole-top fitting) still counts towards the prop's size.
  const height = bounds.maxY - Math.min(0, bounds.minY)
  const triangles = knownParts.reduce((total, instance) => {
    const definition = PART_BY_ID[instance.part] as PartDefinition
    const scaled = instance.scale ?? [1, 1, 1]
    const factor = Math.abs(scaled[0] ?? 1) * Math.abs(scaled[1] ?? 1) * Math.abs(scaled[2] ?? 1)
    return total + Math.round(shapeTriangles(definition.shape) * factor)
  }, 0)

  if (spec.mount === 'ground' || spec.mount === 'kerb' || spec.mount === 'facade') {
    if (depth > MAX_GROUND_PROP_DEPTH + 1e-6) {
      RECIPE_ISSUES.push({
        recipeId: spec.id,
        code: 'too-deep',
        message: `Recipe is ${depth.toFixed(2)} m deep; a sidewalk sub-band fits ${MAX_GROUND_PROP_DEPTH.toFixed(2)} m`,
      })
    }
    if (width > MAX_GROUND_PROP_WIDTH + 1e-6) {
      RECIPE_ISSUES.push({
        recipeId: spec.id,
        code: 'too-wide',
        message: `Recipe is ${width.toFixed(2)} m wide, above ${MAX_GROUND_PROP_WIDTH} m`,
      })
    }
    if (bounds.minY < -0.02) {
      RECIPE_ISSUES.push({
        recipeId: spec.id,
        code: 'below-contact',
        message: `Recipe dips ${bounds.minY.toFixed(2)} m below its contact plane`,
      })
    }
  }
  if (height > MAX_PROP_HEIGHT) {
    RECIPE_ISSUES.push({
      recipeId: spec.id,
      code: 'too-tall',
      message: `Recipe is ${height.toFixed(2)} m tall, above ${MAX_PROP_HEIGHT} m`,
    })
  }

  const materials = [...new Set(spec.parts.map((instance) => instance.material))].sort()
  const contact = spec.contact ?? [
    round((bounds.minX + bounds.maxX) / 2),
    0,
    round((bounds.minZ + bounds.maxZ) / 2),
  ]
  return {
    id: spec.id,
    label: spec.label,
    category: spec.category,
    slot: spec.slot,
    mount: spec.mount,
    facing: spec.facing,
    parts: spec.parts,
    materials,
    bounds,
    contact,
    scaleRange: spec.scaleRange ?? [0.95, 1.05],
    footprint: { width, depth },
    height,
    triangles,
    lamp: spec.lamp ?? null,
    wearSensitivity: spec.wearSensitivity ?? 0.6,
    tags: spec.tags ?? [],
    notes: spec.notes,
  }
}

/* ------------------------------------------------------------------------- *
 * Recipe authoring helpers
 * ------------------------------------------------------------------------- */

/** Compact part-instance builder: `p('crate', 'timber', [0, 0.14, 0])`. */
function p(
  partId: string,
  material: MaterialKey,
  at: readonly [number, number, number],
  extra: Partial<Pick<PropPart, 'rotate' | 'scale' | 'detail'>> = {},
): PropPart {
  return { part: partId, material, at, ...extra }
}

/** Part id used by the gutter detail every kerb prop carries. */
const GUTTER = 'grate'

/* ------------------------------------------------------------------------- *
 * The catalogue
 * ------------------------------------------------------------------------- */

const RECIPE_LIST: readonly PropRecipe[] = [
  /* --------------------------------------------------------------------- *
   * Lighting: the most visible period marker on the block
   * --------------------------------------------------------------------- */
  definePropRecipe({
    id: 'cast-iron-lamp',
    label: 'Cast-iron gas lamp',
    category: 'lighting',
    slot: 'light-post',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.8,
    tags: ['gas', 'twin-lantern', 'period-signature'],
    notes:
      'Fluted cast-iron post with a twin-lantern crossbar, fluted plinth and the gutter grate that always sits at the foot of a kerb post.',
    lamp: {
      technology: 'gas',
      glassMaterial: 'lamp-glass',
      baseEmissive: 1.15,
      glowRadius: 0.3,
      lightOffset: [0, 4.05, 0],
    },
    parts: [
      p('post-plinth', 'cast-iron', [0, 0.06, 0]),
      p('post-shaft-low', 'cast-iron', [0, 0.12, 0]),
      p('lamp-crossbar', 'cast-iron', [0, 3.68, 0]),
      p('lamp-crown', 'cast-iron', [-0.42, 3.75, 0]),
      p('lamp-crown', 'cast-iron', [0.42, 3.75, 0]),
      p('lamp-glass-globe', 'lamp-glass', [-0.42, 3.94, 0]),
      p('lamp-glass-globe', 'lamp-glass', [0.42, 3.94, 0]),
      p(GUTTER, 'cast-iron', [0.3, 0.03, 0.24]),
      p('drain-frame', 'cast-iron', [0.3, 0.02, 0.24], { detail: 'drain' }),
    ],
  }),
  definePropRecipe({
    id: 'early-electric-lamp',
    label: 'Early electric lamp',
    category: 'lighting',
    slot: 'light-post',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.7,
    tags: ['incandescent', 'acorn', 'period-signature'],
    notes: 'The first electric replacement for the gas lantern: shorter post, cast bracket and a single acorn luminaire over the kerb.',
    lamp: {
      technology: 'incandescent',
      glassMaterial: 'lamp-glass',
      baseEmissive: 1,
      glowRadius: 0.26,
      lightOffset: [0, 3.95, 0.34],
    },
    parts: [
      p('post-plinth', 'cast-iron', [0, 0.06, 0]),
      p('post-shaft-low', 'cast-iron', [0, 0.12, 0]),
      p('lamp-arm', 'cast-iron', [0, 3.74, 0.245]),
      p('lamp-acorn', 'enamel', [0, 3.86, 0.44]),
      p('lamp-glass-globe', 'lamp-glass', [0, 3.64, 0.44]),
      p(GUTTER, 'cast-iron', [-0.3, 0.03, 0.22]),
    ],
  }),
  definePropRecipe({
    id: 'incandescent-lamp',
    label: 'Incandescent street lamp',
    category: 'lighting',
    slot: 'light-post',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.55,
    tags: ['incandescent', 'banner'],
    notes: 'Mid-century chrome-and-enamel post with a swan-neck arm, acorn luminaire and a civic banner on the shaft.',
    lamp: {
      technology: 'incandescent',
      glassMaterial: 'lamp-glass',
      baseEmissive: 1.05,
      glowRadius: 0.28,
      lightOffset: [0, 4.55, 0],
    },
    parts: [
      p('post-plinth', 'galvanised-steel', [0, 0.06, 0]),
      p('post-shaft-mid', 'galvanised-steel', [0, 0.12, 0]),
      p('lamp-arm-short', 'chrome', [0, 5.12, 0.15]),
      p('lamp-acorn', 'chrome', [0, 5.18, 0.3]),
      p('lamp-banner', 'canvas', [0, 2.9, 0.09]),
      p(GUTTER, 'cast-iron', [0.34, 0.03, 0.2]),
    ],
  }),
  definePropRecipe({
    id: 'sodium-lamp',
    label: 'High-pressure sodium lamp',
    category: 'lighting',
    slot: 'light-post',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.5,
    tags: ['sodium', 'cobra-head'],
    notes: 'Tall galvanised column with a cobra head and a rectangular sodium glass panel: the orange-lit street of the late century.',
    lamp: {
      technology: 'mercury-sodium',
      glassMaterial: 'lamp-glass',
      baseEmissive: 1.2,
      glowRadius: 0.34,
      lightOffset: [0, 6.2, 0.28],
    },
    parts: [
      p('post-plinth', 'galvanised-steel', [0, 0.06, 0]),
      p('post-shaft-tall', 'galvanised-steel', [0, 0.12, 0]),
      p('lamp-arm', 'galvanised-steel', [0, 6.14, 0.245]),
      p('lamp-cobra', 'galvanised-steel', [0, 6.0, 0.5]),
      p('lamp-glass-panel', 'lamp-glass', [0, 5.9, 0.5]),
      p(GUTTER, 'cast-iron', [-0.34, 0.03, 0.2]),
    ],
  }),
  definePropRecipe({
    id: 'led-lamp',
    label: 'LED street lamp',
    category: 'lighting',
    slot: 'light-post',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.35,
    tags: ['led', 'efficient'],
    notes: 'Slimmer column carrying a flat LED luminaire with a diffuser panel and a white-light cut-off over the kerb.',
    lamp: {
      technology: 'led',
      glassMaterial: 'led-diffuser',
      baseEmissive: 1.1,
      glowRadius: 0.26,
      lightOffset: [0, 5.85, 0.26],
    },
    parts: [
      p('post-plinth', 'aluminium', [0, 0.06, 0]),
      p('post-shaft-mid', 'aluminium', [0, 0.12, 0]),
      p('lamp-arm', 'aluminium', [0, 5.8, 0.2]),
      p('lamp-panel', 'aluminium', [0, 5.7, 0.44]),
      p('lamp-glass-panel', 'led-diffuser', [0, 5.62, 0.44], { detail: 'lamp-glass' }),
      p(GUTTER, 'galvanised-steel', [0.3, 0.03, 0.2]),
    ],
  }),
  definePropRecipe({
    id: 'smart-pole',
    label: 'Smart pole',
    category: 'lighting',
    slot: 'light-post',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.25,
    tags: ['led', 'small-cell', 'sensor', 'period-signature'],
    notes:
      'LED lighting, small-cell radio, air sensor and wayfinding plate stacked on one aluminium pole: the 2020s street mast.',
    lamp: {
      technology: 'smart-pole',
      glassMaterial: 'led-diffuser',
      baseEmissive: 1.15,
      glowRadius: 0.24,
      lightOffset: [0, 6.55, 0.24],
    },
    parts: [
      p('post-plinth', 'aluminium', [0, 0.06, 0]),
      p('post-shaft-smart', 'aluminium', [0, 0.12, 0]),
      p('lamp-arm', 'aluminium', [0, 6.42, 0.2]),
      p('lamp-panel', 'aluminium', [0, 6.32, 0.4]),
      p('lamp-glass-panel', 'led-diffuser', [0, 6.24, 0.4], { detail: 'lamp-glass' }),
      p('small-cell', 'aluminium', [0, 5.0, 0.15], { detail: 'utility-fitting' }),
      p('sensor-head', 'plastic', [0, 4.3, 0.15], { detail: 'utility-fitting' }),
      p('pole-sign-plate', 'reflective-film', [0, 2.5, 0.12]),
      p('lamp-banner', 'canvas', [0, 3.6, 0.12]),
      p(GUTTER, 'aluminium', [-0.3, 0.03, 0.2]),
    ],
  }),

  /* --------------------------------------------------------------------- *
   * Traffic signals
   * --------------------------------------------------------------------- */
  definePropRecipe({
    id: 'manual-signal-box',
    label: 'Manual signal box',
    category: 'signals',
    slot: 'signal-head',
    mount: 'ground',
    facing: 'along-street',
    contact: [0, 0, 0],
    wearSensitivity: 0.75,
    tags: ['manual', 'period-signature'],
    notes:
      'Cast-iron pediment post carrying a hand-swung signal box and its bell; the box and its lens face down the street towards oncoming traffic, while an enamel plate on the block side faces pedestrians.',
    lamp: null,
    parts: [
      p('post-plinth', 'cast-iron', [0, 0.06, 0]),
      p('post-shaft-low', 'cast-iron', [0, 0.12, 0]),
      p('signal-box-manual', 'cast-iron', [-0.2, 3.75, 0], {
        rotate: [0, Math.PI / 2, 0],
        detail: 'signal-head',
      }),
      p('signal-lens', 'signal-lens-red', [-0.34, 3.75, 0], { detail: 'signal-lens' }),
      p('signal-bell', 'cast-iron', [-0.2, 3.61, 0], { detail: 'signal-head' }),
      p('signal-ped-box', 'enamel', [0, 2.6, -0.12]),
      p('pole-sign-plate', 'paint-marking', [0, 3.2, -0.1]),
    ],
  }),
  definePropRecipe({
    id: 'traffic-light-1960s',
    label: 'Three-lamp traffic signal',
    category: 'signals',
    slot: 'signal-head',
    mount: 'ground',
    facing: 'along-street',
    contact: [0, 0, 0],
    wearSensitivity: 0.6,
    tags: ['three-lamp', 'incandescent'],
    notes:
      'Painted-steel post with a vertical three-lamp head whose lenses face down the street, plus a pedestrian signal on the block side.',
    lamp: null,
    parts: [
      p('post-plinth', 'painted-steel', [0, 0.06, 0]),
      p('post-shaft-mid', 'painted-steel', [0, 0.12, 0]),
      p('signal-box-three', 'painted-steel', [-0.2, 3.75, 0], {
        rotate: [0, Math.PI / 2, 0],
        detail: 'signal-head',
      }),
      p('signal-lens', 'signal-lens-red', [-0.36, 4.35, 0], { detail: 'signal-lens' }),
      p('signal-lens', 'signal-lens-amber', [-0.36, 3.85, 0], { detail: 'signal-lens' }),
      p('signal-lens', 'signal-lens-green', [-0.36, 3.35, 0], { detail: 'signal-lens' }),
      p('signal-ped-box', 'painted-steel', [0, 2.5, -0.12]),
      p('pole-bracket', 'painted-steel', [0, 3.05, -0.1]),
    ],
  }),
  definePropRecipe({
    id: 'black-box-signal',
    label: 'Black-box signal with control cabinet',
    category: 'signals',
    slot: 'signal-head',
    mount: 'ground',
    facing: 'along-street',
    contact: [0, 0, 0],
    wearSensitivity: 0.7,
    tags: ['three-lamp', 'cabinet', 'tagged'],
    notes: 'The late-century black head with deep hoods, plus the corner control cabinet and its grimy pad that every junction got.',
    lamp: null,
    parts: [
      p('post-plinth', 'galvanised-steel', [0, 0.06, 0]),
      p('post-shaft-mid', 'galvanised-steel', [0, 0.12, 0]),
      p('signal-box-black', 'painted-steel', [-0.22, 3.85, 0], {
        rotate: [0, Math.PI / 2, 0],
        detail: 'signal-head',
      }),
      p('signal-lens', 'signal-lens-red', [-0.4, 4.65, 0], { detail: 'signal-lens' }),
      p('signal-lens', 'signal-lens-amber', [-0.4, 4.15, 0], { detail: 'signal-lens' }),
      p('signal-lens', 'signal-lens-green', [-0.4, 3.65, 0], { detail: 'signal-lens' }),
      p('signal-cabinet', 'galvanised-steel', [-0.55, 0, 0.12], { detail: 'signal-cabinet' }),
      p('signal-ped-box', 'painted-steel', [0, 2.45, -0.12]),
      p('patch-slab', 'asphalt-patch', [0.55, 0.02, 0.2], { detail: 'patch' }),
    ],
  }),
  definePropRecipe({
    id: 'led-signal',
    label: 'LED mast-arm signal',
    category: 'signals',
    slot: 'signal-head',
    mount: 'ground',
    facing: 'along-street',
    contact: [0, 0, 0],
    wearSensitivity: 0.4,
    tags: ['led', 'mast-arm', 'camera'],
    notes:
      'Galvanised pole with a mast arm running along the kerb, a horizontal LED head turned to face oncoming traffic and the enforcement camera above it.',
    lamp: null,
    parts: [
      p('post-plinth', 'galvanised-steel', [0, 0.06, 0]),
      p('post-shaft-tall', 'galvanised-steel', [0, 0.12, 0]),
      p('signal-mast', 'galvanised-steel', [1.5, 5.9, 0]),
      p('signal-head-led', 'aluminium', [2.95, 5.72, 0], {
        rotate: [0, Math.PI / 2, 0],
        detail: 'signal-head',
      }),
      p('signal-lens-led', 'signal-lens-red', [2.79, 5.72, -0.15], {
        rotate: [0, Math.PI / 2, 0],
        detail: 'signal-lens',
      }),
      p('signal-lens-led', 'signal-lens-amber', [2.79, 5.72, 0], {
        rotate: [0, Math.PI / 2, 0],
        detail: 'signal-lens',
      }),
      p('signal-lens-led', 'signal-lens-green', [2.79, 5.72, 0.15], {
        rotate: [0, Math.PI / 2, 0],
        detail: 'signal-lens',
      }),
      p('signal-camera', 'aluminium', [0.24, 6.15, -0.05], { detail: 'camera' }),
      p('signal-ped-box', 'aluminium', [0, 2.6, -0.12]),
    ],
  }),
  definePropRecipe({
    id: 'smart-signal',
    label: 'Smart junction signal',
    category: 'signals',
    slot: 'signal-head',
    mount: 'ground',
    facing: 'along-street',
    contact: [0, 0, 0],
    wearSensitivity: 0.3,
    tags: ['led', 'mast-arm', 'camera', 'sensor', 'period-signature'],
    notes: 'Mast-arm signal with LED head, detection camera, air sensor and a reflective plate for the junction of the 2020s.',
    lamp: null,
    parts: [
      p('post-plinth', 'aluminium', [0, 0.06, 0]),
      p('post-shaft-smart', 'aluminium', [0, 0.12, 0]),
      p('signal-mast', 'aluminium', [1.5, 5.95, 0]),
      p('signal-head-led', 'aluminium', [2.95, 5.78, 0], {
        rotate: [0, Math.PI / 2, 0],
        detail: 'signal-head',
      }),
      p('signal-lens-led', 'signal-lens-red', [2.79, 5.78, -0.15], {
        rotate: [0, Math.PI / 2, 0],
        detail: 'signal-lens',
      }),
      p('signal-lens-led', 'signal-lens-amber', [2.79, 5.78, 0], {
        rotate: [0, Math.PI / 2, 0],
        detail: 'signal-lens',
      }),
      p('signal-lens-led', 'signal-lens-green', [2.79, 5.78, 0.15], {
        rotate: [0, Math.PI / 2, 0],
        detail: 'signal-lens',
      }),
      p('signal-camera', 'aluminium', [0.24, 6.3, -0.05], { detail: 'camera' }),
      p('sensor-head', 'plastic', [0.24, 5.5, -0.1], { detail: 'utility-fitting' }),
      p('pole-sign-plate', 'reflective-film', [0, 2.4, -0.1]),
      p('signal-ped-box', 'aluminium', [0, 2.9, -0.12]),
    ],
  }),

  /* --------------------------------------------------------------------- *
   * Hydrants: one per street, always present, always period-specific
   * --------------------------------------------------------------------- */
  definePropRecipe({
    id: 'fire-hydrant',
    label: 'Cast-iron fire hydrant',
    category: 'utility',
    slot: 'hydrant',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.85,
    tags: ['cast-iron', 'period-signature'],
    notes: 'Heavy cast-iron wet-barrel hydrant with two side outlets and a cap: the wartime kerb fixture.',
    parts: [
      p('hydrant-collar', 'cast-iron', [0, 0.04, 0]),
      p('hydrant-barrel', 'cast-iron', [0, 0.08, 0]),
      p('hydrant-arm', 'cast-iron', [0.14, 0.45, 0]),
      p('hydrant-arm', 'cast-iron', [-0.14, 0.45, 0]),
      p('hydrant-cap', 'cast-iron', [0, 0.7, 0]),
      p(GUTTER, 'cast-iron', [0, 0.03, 0.24]),
    ],
  }),
  definePropRecipe({
    id: 'dry-barrel-hydrant',
    label: 'Dry-barrel hydrant',
    category: 'utility',
    slot: 'hydrant',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.55,
    tags: ['dry-barrel', 'painted'],
    notes: 'Post-war dry-barrel hydrant with a break-away flange and a painted collar.',
    parts: [
      p('hydrant-collar', 'painted-steel', [0, 0.04, 0]),
      p('hydrant-barrel', 'painted-steel', [0, 0.08, 0]),
      p('hydrant-arm', 'painted-steel', [0.14, 0.42, 0]),
      p('hydrant-arm', 'painted-steel', [-0.14, 0.42, 0]),
      p('hydrant-cap', 'painted-steel', [0, 0.7, 0]),
      p('hydrant-band', 'reflective-film', [0, 0.5, 0], { detail: 'hydrant-body' }),
    ],
  }),
  definePropRecipe({
    id: 'painted-hydrant',
    label: 'Painted low hydrant',
    category: 'utility',
    slot: 'hydrant',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.75,
    tags: ['low-profile', 'tagged'],
    notes: 'Short painted barrel with a single outlet, chipped enamel and the litter that collects around it.',
    parts: [
      p('hydrant-collar', 'painted-steel', [0, 0.04, 0]),
      p('hydrant-barrel', 'painted-steel', [0, 0.08, 0]),
      p('hydrant-arm', 'painted-steel', [0.14, 0.4, 0]),
      p('hydrant-cap', 'painted-steel', [0, 0.68, 0]),
      p('litter-bit', 'paper', [0.34, 0.03, 0.24]),
    ],
  }),
  definePropRecipe({
    id: 'modern-hydrant',
    label: 'Modern kerb hydrant',
    category: 'utility',
    slot: 'hydrant',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.35,
    tags: ['aluminium', 'reflective'],
    notes: 'Aluminium hydrant with a reflective band and a clean tamper-proof cap, sized for the modern sidewalk.',
    parts: [
      p('hydrant-collar', 'aluminium', [0, 0.04, 0]),
      p('hydrant-barrel', 'aluminium', [0, 0.08, 0]),
      p('hydrant-arm', 'aluminium', [0.14, 0.42, 0]),
      p('hydrant-arm', 'aluminium', [-0.14, 0.42, 0]),
      p('hydrant-cap', 'aluminium', [0, 0.7, 0]),
      p('hydrant-band', 'reflective-film', [0, 0.52, 0], { detail: 'hydrant-body' }),
      p(GUTTER, 'galvanised-steel', [0, 0.03, 0.26]),
    ],
  }),
  definePropRecipe({
    id: 'smart-hydrant',
    label: 'Monitored smart hydrant',
    category: 'utility',
    slot: 'hydrant',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.25,
    tags: ['sensor', 'period-signature'],
    notes: 'Hydrant with a pressure and tamper sensor, reflective band and a brushed aluminium body.',
    parts: [
      p('hydrant-collar', 'aluminium', [0, 0.04, 0]),
      p('hydrant-barrel', 'aluminium', [0, 0.08, 0]),
      p('hydrant-arm', 'aluminium', [0.14, 0.44, 0]),
      p('hydrant-arm', 'aluminium', [-0.14, 0.44, 0]),
      p('hydrant-cap', 'aluminium', [0, 0.72, 0]),
      p('hydrant-band', 'reflective-film', [0, 0.54, 0], { detail: 'hydrant-body' }),
      p('hydrant-sensor', 'plastic', [0, 0.76, 0.1], { detail: 'utility-fitting' }),
    ],
  }),

  /* --------------------------------------------------------------------- *
   * Pole-top utility fittings
   * --------------------------------------------------------------------- */
  definePropRecipe({
    id: 'utility-transformer',
    label: 'Overhead transformer',
    category: 'utility',
    slot: 'utility-endpoint',
    mount: 'pole-top',
    facing: 'outward',
    wearSensitivity: 0.8,
    tags: ['transformer', 'overhead'],
    notes: 'Transformer drum, fuse cut-out and slack cable cluster hanging from the pole top: the wartime overhead run.',
    contact: [0, 0, 0],
    parts: [
      p('utility-pole', 'cast-iron', [0, -9, 0]),
      p('transformer-drum', 'cast-iron', [0, -0.9, -0.2]),
      p('pole-bracket', 'cast-iron', [0, -0.12, -0.12]),
      p('fuse-box', 'cast-iron', [0.24, -0.55, -0.14]),
      p('cable-bundle', 'rubber', [0.7, -2.8, -0.18], { rotate: [0, 0, Math.PI / 2] }),
      p('cable-drop', 'rubber', [0.16, -2.4, -0.16]),
    ],
  }),
  definePropRecipe({
    id: 'utility-cable-arm',
    label: 'Cable arm and street plate',
    category: 'utility',
    slot: 'utility-endpoint',
    mount: 'pole-top',
    facing: 'outward',
    wearSensitivity: 0.6,
    tags: ['overhead', 'signage'],
    notes: 'Insulated cable arm with a dropper and the street name plate bolted to the pole.',
    contact: [0, 0, 0],
    parts: [
      p('utility-pole', 'galvanised-steel', [0, -9, 0]),
      p('pole-bracket', 'galvanised-steel', [0, -0.12, -0.12]),
      p('cable-bundle', 'rubber', [0.7, -2.7, -0.16], { rotate: [0, 0, Math.PI / 2] }),
      p('cable-drop', 'rubber', [-0.18, -2.5, -0.16]),
      p('pole-sign-plate', 'enamel', [0, -0.7, -0.1]),
      p('lamp-banner', 'canvas', [0, -1.6, -0.1]),
    ],
  }),
  definePropRecipe({
    id: 'utility-fuse-panel',
    label: 'Fuse panel and cable run',
    category: 'utility',
    slot: 'utility-endpoint',
    mount: 'pole-top',
    facing: 'outward',
    wearSensitivity: 0.7,
    tags: ['fuse', 'overhead', 'tagged'],
    notes: 'Grimy fuse housing, split cable bundle and a tagged dropper: the patched-up overhead of the mid-eighties.',
    contact: [0, 0, 0],
    parts: [
      p('utility-pole', 'galvanised-steel', [0, -9, 0]),
      p('fuse-box', 'galvanised-steel', [0, -0.55, -0.14]),
      p('pole-bracket', 'galvanised-steel', [0, -0.12, -0.12]),
      p('cable-bundle', 'rubber', [0.7, -2.6, -0.16], { rotate: [0, 0, Math.PI / 2] }),
      p('cable-drop', 'rubber', [0.2, -2.4, -0.16]),
      p('cabinet-lid', 'galvanised-steel', [0, -1.05, -0.14], { detail: 'cabinet' }),
    ],
  }),
  definePropRecipe({
    id: 'utility-fibre-box',
    label: 'Fibre distribution box',
    category: 'utility',
    slot: 'utility-endpoint',
    mount: 'pole-top',
    facing: 'outward',
    wearSensitivity: 0.45,
    tags: ['fibre', 'overhead'],
    notes: 'Sealed fibre distribution box with a tidy cable drop replacing the old copper run.',
    contact: [0, 0, 0],
    parts: [
      p('utility-pole', 'aluminium', [0, -9, 0]),
      p('fuse-box', 'aluminium', [0, -0.55, -0.14]),
      p('pole-bracket', 'aluminium', [0, -0.12, -0.12]),
      p('cable-bundle', 'rubber', [0.7, -2.5, -0.16], { rotate: [0, 0, Math.PI / 2] }),
      p('cable-drop', 'rubber', [-0.16, -2.4, -0.16]),
      p('pole-sign-plate', 'reflective-film', [0, -0.85, -0.1]),
    ],
  }),
  definePropRecipe({
    id: 'air-quality-sensor',
    label: 'Air-quality sensor head',
    category: 'utility',
    slot: 'utility-endpoint',
    mount: 'pole-top',
    facing: 'outward',
    wearSensitivity: 0.25,
    tags: ['sensor', 'small-cell', 'period-signature'],
    notes: 'Sensor head, small-cell radio and a short cable drop on the pole top of the 2020s.',
    contact: [0, 0, 0],
    parts: [
      p('utility-pole', 'aluminium', [0, -9, 0]),
      p('sensor-head', 'plastic', [0, -0.68, -0.12]),
      p('small-cell', 'aluminium', [0, -1.5, -0.12]),
      p('pole-bracket', 'aluminium', [0, -0.12, -0.12]),
      p('cable-drop', 'rubber', [0.18, -2.4, -0.14]),
    ],
  }),

  /* --------------------------------------------------------------------- *
   * Rooftop service detail
   * --------------------------------------------------------------------- */
  definePropRecipe({
    id: 'roof-chimney-stack',
    label: 'Chimney stack and vents',
    category: 'utility',
    slot: 'rooftop-detail',
    mount: 'roof',
    facing: 'along-street',
    wearSensitivity: 0.9,
    tags: ['chimney', 'period-signature'],
    notes: 'Brick chimney stack with soot-blackened top and two roof vents: the skyline of the coal era.',
    parts: [
      p('roof-chimney', 'concrete', [0, 0, 0], { detail: 'roof-detail' }),
      p('roof-vent', 'galvanised-steel', [1.2, 0, 0.6]),
      p('roof-vent', 'galvanised-steel', [-1.1, 0, -0.7]),
    ],
  }),
  definePropRecipe({
    id: 'roof-water-tank',
    label: 'Roof water tank',
    category: 'utility',
    slot: 'rooftop-detail',
    mount: 'roof',
    facing: 'along-street',
    wearSensitivity: 0.7,
    tags: ['tank', 'vent'],
    notes: 'Timber-and-steel water tank on legs with a vent beside it: the post-war roof plant.',
    parts: [
      p('roof-tank', 'galvanised-steel', [0, 0.9, 0]),
      p('roof-tank-leg', 'timber', [0.7, 0, 0.7]),
      p('roof-tank-leg', 'timber', [-0.7, 0, 0.7]),
      p('roof-tank-leg', 'timber', [0.7, 0, -0.7]),
      p('roof-vent', 'galvanised-steel', [-1.3, 0, 0.4]),
    ],
  }),
  definePropRecipe({
    id: 'roof-ac-bank',
    label: 'Rooftop AC bank',
    category: 'utility',
    slot: 'rooftop-detail',
    mount: 'roof',
    facing: 'along-street',
    wearSensitivity: 0.6,
    tags: ['ac', 'plant'],
    notes: 'Two condenser units, a vent and a parapet box: the first wave of rooftop air conditioning.',
    parts: [
      p('roof-ac', 'galvanised-steel', [-0.7, 0, 0]),
      p('roof-ac', 'galvanised-steel', [0.7, 0, 0.1]),
      p('roof-vent', 'galvanised-steel', [0, 0, -0.9]),
      p('roof-parapet-box', 'galvanised-steel', [-1.4, 0, -0.6]),
      p('cable-drop', 'rubber', [0, 0, 0.4], { detail: 'utility-fitting' }),
    ],
  }),
  definePropRecipe({
    id: 'roof-mech-cluster',
    label: 'Rooftop mechanical cluster',
    category: 'utility',
    slot: 'rooftop-detail',
    mount: 'roof',
    facing: 'along-street',
    wearSensitivity: 0.45,
    tags: ['ac', 'hatch'],
    notes: 'Roof AC, access hatch and vent grille: the service cluster of the 2000s block.',
    parts: [
      p('roof-ac', 'aluminium', [0.6, 0, 0.1]),
      p('roof-hatch', 'aluminium', [-0.9, 0, 0.2]),
      p('roof-vent', 'galvanised-steel', [0, 0, -0.9]),
      p('roof-parapet-box', 'aluminium', [-0.4, 0, -0.8]),
    ],
  }),
  definePropRecipe({
    id: 'roof-solar-array',
    label: 'Rooftop solar array',
    category: 'utility',
    slot: 'rooftop-detail',
    mount: 'roof',
    facing: 'along-street',
    wearSensitivity: 0.2,
    tags: ['solar', 'hatch', 'period-signature'],
    notes: 'Two solar panels beside the roof hatch and vent: the electrified roof of the 2020s.',
    parts: [
      p('roof-solar', 'aluminium', [-1.0, 0, 0.2]),
      p('roof-solar', 'aluminium', [1.0, 0, 0.2]),
      p('roof-hatch', 'aluminium', [0, 0, -0.8]),
      p('roof-vent', 'aluminium', [-0.2, 0, 0.8]),
    ],
  }),

  /* --------------------------------------------------------------------- *
   * 1945 street furniture
   * --------------------------------------------------------------------- */
  definePropRecipe({
    id: 'news-stand',
    label: 'Corner newsstand',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.8,
    tags: ['kiosk', 'period-signature'],
    notes: 'Timber newsstand with a canvas canopy, shelf of papers and a frame the vendor ties down at night.',
    parts: [
      p('stand-body', 'timber', [0, 0, -0.05], { scale: [1, 1, 0.72] }),
      p('stand-canopy', 'canvas', [0, 1.62, 0.1], { scale: [0.9, 1, 0.55] }),
      p('stand-shelf', 'timber', [0, 0.9, 0.4], { scale: [0.95, 1, 0.55] }),
      p('stand-frame', 'timber', [0.8, 0, 0.34]),
      p('stand-frame', 'timber', [-0.8, 0, 0.34]),
      p('newspaper', 'paper', [0.3, 0.97, 0.36]),
      p('litter-bit', 'paper', [-0.6, 0.03, 0.3]),
    ],
  }),
  definePropRecipe({
    id: 'milk-crate',
    label: 'Stacked milk crates',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.7,
    tags: ['crate', 'delivery'],
    notes: 'Three crates stacked outside a shop door with paper litter at the base.',
    parts: [
      p('crate', 'timber', [-0.18, 0, 0.1]),
      p('crate', 'timber', [0.18, 0, 0.1]),
      p('crate', 'timber', [0, 0.28, 0.1]),
      p('litter-paper', 'paper', [0.3, 0.02, 0.3]),
    ],
  }),
  definePropRecipe({
    id: 'coal-chute',
    label: 'Coal chute hatch',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'inward',
    wearSensitivity: 0.95,
    tags: ['hatch', 'period-signature'],
    notes: 'Cast-iron coal chute flush with the pavement, its lip proud of the surface and soot around the seams.',
    parts: [
      p('chute-hatch', 'cast-iron', [0, 0.02, 0.2]),
      p('chute-lip', 'cast-iron', [0, 0.04, 0.36], { detail: 'patch' }),
      p('patch-slab', 'asphalt-patch', [0, 0.01, -0.1], { detail: 'patch' }),
      p('litter-bit', 'paper', [-0.3, 0.03, 0.2]),
    ],
  }),
  definePropRecipe({
    id: 'pushcart',
    label: 'Delivery pushcart',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'along-street',
    wearSensitivity: 0.85,
    tags: ['cart', 'delivery'],
    notes: 'Handcart parked against the kerb: timber bed, two wheels, a crate of goods and a dropped handle.',
    parts: [
      p('cart-bed', 'timber', [0, 0.42, 0], { scale: [1, 1, 0.6] }),
      p('cart-wheel', 'timber', [-0.42, 0, 0.22], { scale: [1, 0.8, 0.8] }),
      p('cart-wheel', 'timber', [0.42, 0, 0.22], { scale: [1, 0.8, 0.8] }),
      p('cart-handle-bar', 'timber', [0, 0.5, 0.45]),
      p('crate', 'timber', [0.1, 0.78, 0]),
    ],
  }),
  definePropRecipe({
    id: 'hitching-post',
    label: 'Hitching post',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.9,
    tags: ['horse', 'period-signature'],
    notes: 'Cast-iron hitching post with an iron ring, still in the kerb long after the last horse cart.',
    parts: [
      p('horse-post', 'cast-iron', [0, 0, 0.1]),
      p('horse-ring', 'cast-iron', [0, 0.62, 0.2], { rotate: [Math.PI / 2, 0, 0], detail: 'clutter' }),
      p('litter-bit', 'paper', [0.2, 0.03, 0.3]),
    ],
  }),
  definePropRecipe({
    id: 'mailbox-cast-iron',
    label: 'Cast-iron pillar box',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.8,
    tags: ['mailbox', 'period-signature'],
    notes: 'Fluted cast-iron pillar box with a hooded slot and a painted base band.',
    parts: [
      p('mailbox-leg', 'cast-iron', [0, 0, 0.12]),
      p('mailbox-body', 'cast-iron', [0, 0.95, 0.12]),
      p('mailbox-hood', 'cast-iron', [0, 1.61, 0.12]),
      p('pole-sign-plate', 'enamel', [0, 1.35, 0.24], { detail: 'sign-face' }),
    ],
  }),

  /* --------------------------------------------------------------------- *
   * 1965 street furniture
   * --------------------------------------------------------------------- */
  definePropRecipe({
    id: 'telephone-booth',
    label: 'Telephone booth',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.5,
    tags: ['booth', 'period-signature'],
    notes: 'Glass-and-enamel booth with a lit sign panel above the door: the phone box of the mid-century pavement.',
    parts: [
      p('booth-shell', 'painted-steel', [0, 0, 0]),
      p('booth-glass', 'glass', [0, 0.5, 0.03]),
      p('booth-sign', 'enamel', [0, 2.3, 0.12], { detail: 'sign-face' }),
      p(GUTTER, 'galvanised-steel', [0.3, 0.03, 0.2]),
    ],
  }),
  definePropRecipe({
    id: 'bus-shelter',
    label: 'Bus shelter',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.55,
    tags: ['shelter', 'seating'],
    notes: 'Cantilevered shelter with two glazed posts, a bench and a timetabled side panel.',
    parts: [
      p('shelter-roof', 'painted-steel', [0, 2.35, 0.06]),
      p('shelter-post', 'galvanised-steel', [-1.5, 0, 0.2]),
      p('shelter-post', 'galvanised-steel', [1.5, 0, 0.2]),
      p('shelter-panel', 'glass', [-1.35, 0.6, 0.4], { scale: [0.75, 1, 1], detail: 'shelter' }),
      p('shelter-bench', 'timber', [0, 0.45, 0.3]),
      p(GUTTER, 'cast-iron', [-0.6, 0.03, 0.16]),
    ],
  }),
  definePropRecipe({
    id: 'parking-meter',
    label: 'Parking meter',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.6,
    tags: ['meter', 'period-signature'],
    notes: 'Twin-head parking meter with a chrome dial on a slim pole at the kerb.',
    parts: [
      p('meter-pole', 'galvanised-steel', [0, 0, 0.16]),
      p('meter-head', 'chrome', [0, 1.15, 0.16]),
      p('meter-clock', 'screen-glass', [0, 1.24, 0.24], { detail: 'meter' }),
      p(GUTTER, 'galvanised-steel', [-0.24, 0.03, 0.24]),
    ],
  }),
  definePropRecipe({
    id: 'neon-arrow-sign',
    label: 'Neon arrow sign',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.45,
    tags: ['neon', 'signage'],
    notes: 'Projecting arrow sign with a neon tube outline on a slim pole: shopfront advertising of the mid-century.',
    lamp: {
      technology: 'incandescent',
      glassMaterial: 'neon-tube',
      baseEmissive: 0.6,
      glowRadius: 0.3,
      lightOffset: [0, 2.5, 0.1],
    },
    parts: [
      p('signage-pole', 'painted-steel', [0, 0, 0.16]),
      p('sign-arrow', 'painted-steel', [0, 2.4, 0.16]),
      p('neon-arrow', 'neon-tube', [0, 2.4, 0.2]),
    ],
  }),

  /* --------------------------------------------------------------------- *
   * 1985 street furniture
   * --------------------------------------------------------------------- */
  definePropRecipe({
    id: 'payphone',
    label: 'Payphone row',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.8,
    tags: ['booth', 'period-signature', 'tagged'],
    notes: 'Three-unit open payphone row under a hood, tagged and grimy: the pavement phone bank of the eighties.',
    parts: [
      p('payphone-shell', 'painted-steel', [0, 0, 0]),
      p('payphone-hood', 'painted-steel', [0, 2.3, 0.05]),
      p('payphone-unit', 'painted-steel', [-0.5, 0.85, 0.5], { detail: 'booth' }),
      p('payphone-unit', 'painted-steel', [0, 0.85, 0.5], { detail: 'booth' }),
      p('payphone-unit', 'painted-steel', [0.5, 0.85, 0.5], { detail: 'booth' }),
      p('litter-bit', 'paper', [0.7, 0.03, 0.4]),
    ],
  }),
  definePropRecipe({
    id: 'graffiti-mailbox',
    label: 'Graffiti-covered mailbox',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.95,
    tags: ['mailbox', 'tagged', 'period-signature'],
    notes: 'Battered mailbox with a tagged painted body, dented hood and a litter-strewn base.',
    parts: [
      p('mailbox-leg', 'painted-steel', [0, 0, 0.12]),
      p('mailbox-body', 'painted-steel', [0, 0.95, 0.12]),
      p('mailbox-hood', 'painted-steel', [0, 1.61, 0.12]),
      p('litter-bit', 'paper', [-0.3, 0.03, 0.34]),
      p('litter-paper', 'paper', [0.26, 0.02, 0.3]),
    ],
  }),
  definePropRecipe({
    id: 'dumpster',
    label: 'Kerb dumpster',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'along-street',
    wearSensitivity: 0.85,
    tags: ['bin', 'service', 'period-signature'],
    notes: 'Steel dumpster on castors with a propped lid and tagged panels parked on the kerb.',
    parts: [
      p('dumpster-body', 'painted-steel', [0, 0.2, 0]),
      p('dumpster-lid', 'painted-steel', [0, 1.36, -0.2]),
      p('dumpster-wheel', 'rubber', [-0.6, 0, 0.4]),
      p('dumpster-wheel', 'rubber', [0.6, 0, 0.4]),
      p('litter-bit', 'paper', [0.8, 0.03, 0.4]),
    ],
  }),
  definePropRecipe({
    id: 'boom-box',
    label: 'Boom box on a crate',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.7,
    tags: ['clutter', 'music', 'period-signature'],
    notes: 'Boom box propped on a milk crate outside a shop, cable trailing and litter beside it.',
    parts: [
      p('boom-crate', 'plastic', [0, 0, 0.2]),
      p('boom-box', 'plastic', [0, 0.34, 0.16]),
      p('cable-drop', 'rubber', [0.24, 0.02, 0.3], { detail: 'utility-fitting' }),
      p('litter-bit', 'paper', [-0.28, 0.03, 0.3]),
    ],
  }),
  definePropRecipe({
    id: 'bmx-rack',
    label: 'BMX rack',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.7,
    tags: ['rack', 'period-signature'],
    notes: 'Two steel hoops and a cross rail where BMXs are chained against the kerb.',
    parts: [
      p('rack-hoop', 'galvanised-steel', [-0.55, 0.44, 0.2], { rotate: [Math.PI / 2, 0, 0], detail: 'rack' }),
      p('rack-hoop', 'galvanised-steel', [0.55, 0.44, 0.2], { rotate: [Math.PI / 2, 0, 0], detail: 'rack' }),
      p('rack-rail', 'galvanised-steel', [0, 0.14, 0.34], { detail: 'rack' }),
      p(GUTTER, 'galvanised-steel', [-0.3, 0.03, 0.24]),
    ],
  }),
  definePropRecipe({
    id: 'neon-palm-sign',
    label: 'Neon palm sign',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.5,
    tags: ['neon', 'signage', 'period-signature'],
    notes: 'Pole-mounted neon palm silhouette above a printed fascia sign: eighties nightlife advertising.',
    lamp: {
      technology: 'incandescent',
      glassMaterial: 'neon-tube',
      baseEmissive: 0.75,
      glowRadius: 0.42,
      lightOffset: [0, 3.3, 0.14],
    },
    parts: [
      p('signage-pole', 'painted-steel', [0, 0, 0.18]),
      p('neon-palm', 'neon-tube', [0, 2.9, 0.18]),
      p('sign-face', 'enamel', [0, 1.9, 0.18]),
      p(GUTTER, 'galvanised-steel', [0.26, 0.03, 0.24]),
    ],
  }),

  /* --------------------------------------------------------------------- *
   * 2005 street furniture
   * --------------------------------------------------------------------- */
  definePropRecipe({
    id: 'bus-shelter-ad',
    label: 'Shelter with advertisement panel',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.4,
    tags: ['shelter', 'advertising'],
    notes: 'Shelter with a glazed advertising panel, bench and aluminium frame.',
    lamp: {
      technology: 'led',
      glassMaterial: 'screen-glass',
      baseEmissive: 0.4,
      glowRadius: 0.5,
      lightOffset: [1.2, 1.6, 0.5],
    },
    parts: [
      p('shelter-roof', 'aluminium', [0, 2.4, 0.06]),
      p('shelter-post', 'aluminium', [-1.5, 0, 0.2]),
      p('shelter-post', 'aluminium', [1.5, 0, 0.2]),
      p('shelter-ad-panel', 'screen-glass', [1.2, 0.6, 0.42], { detail: 'screen' }),
      p('shelter-bench', 'aluminium', [0, 0.5, 0.3]),
      p(GUTTER, 'galvanised-steel', [0.4, 0.03, 0.16]),
    ],
  }),
  definePropRecipe({
    id: 'parking-kiosk',
    label: 'Parking kiosk',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.35,
    tags: ['kiosk', 'screen', 'period-signature'],
    notes: 'Ticket kiosk with a lit screen and a side panel of instructions at the kerb.',
    lamp: {
      technology: 'led',
      glassMaterial: 'screen-glass',
      baseEmissive: 0.45,
      glowRadius: 0.3,
      lightOffset: [0, 1.5, 0.3],
    },
    parts: [
      p('kiosk-shell', 'galvanised-steel', [0, 0, 0]),
      p('kiosk-screen', 'screen-glass', [0, 1.35, 0.28], { detail: 'screen' }),
      p('kiosk-side', 'galvanised-steel', [0.5, 0, 0.3]),
      p(GUTTER, 'galvanised-steel', [-0.3, 0.03, 0.24]),
    ],
  }),
  definePropRecipe({
    id: 'security-camera',
    label: 'Security camera post',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.35,
    tags: ['camera', 'surveillance'],
    notes: 'Slim camera post with a bracket and body aimed along the pavement.',
    parts: [
      p('camera-post', 'galvanised-steel', [0, 0, 0.16]),
      p('camera-mount', 'aluminium', [0, 3.2, 0.3], { detail: 'camera' }),
      p('camera-body', 'aluminium', [0, 3.24, 0.48], { detail: 'camera' }),
      p(GUTTER, 'galvanised-steel', [0.24, 0.03, 0.24]),
    ],
  }),
  definePropRecipe({
    id: 'bike-rack',
    label: 'Sheffield bike rack',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.35,
    tags: ['rack', 'cycling'],
    notes: 'Three stainless hoops on a rail, the standard cycle stand of the 2000s.',
    parts: [
      p('rack-hoop', 'aluminium', [-0.6, 0.44, 0.2], { rotate: [Math.PI / 2, 0, 0], detail: 'rack' }),
      p('rack-hoop', 'aluminium', [0, 0.44, 0.2], { rotate: [Math.PI / 2, 0, 0], detail: 'rack' }),
      p('rack-hoop', 'aluminium', [0.6, 0.44, 0.2], { rotate: [Math.PI / 2, 0, 0], detail: 'rack' }),
      p('rack-rail', 'aluminium', [0, 0.12, 0.34], { detail: 'rack' }),
    ],
  }),
  definePropRecipe({
    id: 'atm',
    label: 'Street ATM',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.3,
    tags: ['kiosk', 'screen', 'period-signature'],
    notes: 'Free-standing ATM with a lit screen, hooded head and a small footprint on the pavement.',
    lamp: {
      technology: 'led',
      glassMaterial: 'screen-glass',
      baseEmissive: 0.55,
      glowRadius: 0.34,
      lightOffset: [0, 1.75, 0.34],
    },
    parts: [
      p('atm-shell', 'painted-steel', [0, 0, 0.1]),
      p('atm-screen', 'screen-glass', [0, 1.35, 0.42], { detail: 'screen' }),
      p('atm-hood', 'aluminium', [0, 1.85, 0.32]),
      p(GUTTER, 'galvanised-steel', [-0.3, 0.03, 0.24]),
    ],
  }),
  definePropRecipe({
    id: 'street-bench',
    label: 'Street bench',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.45,
    tags: ['seating'],
    notes: 'Slatted bench with a back and cast feet, set against the facade.',
    parts: [
      p('bench-leg', 'cast-iron', [-0.7, 0, 0.26]),
      p('bench-leg', 'cast-iron', [0.7, 0, 0.26]),
      p('bench-seat', 'timber', [0, 0.42, 0.26]),
      p('bench-back', 'timber', [0, 0.7, 0.05]),
    ],
  }),

  /* --------------------------------------------------------------------- *
   * Shared furniture: bins, bollards, barriers, kiosks
   * --------------------------------------------------------------------- */
  definePropRecipe({
    id: 'litter-bin',
    label: 'Litter bin',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.7,
    tags: ['bin'],
    notes: 'Post-mounted litter bin with a lid and a scatter of litter: in every era, in every condition.',
    parts: [
      p('bin-post', 'galvanised-steel', [0, 0, 0.24]),
      p('bin-body', 'painted-steel', [0, 0.25, 0.24]),
      p('bin-lid', 'painted-steel', [0, 1.03, 0.24]),
      p('litter-bit', 'paper', [-0.3, 0.03, 0.34]),
    ],
  }),
  definePropRecipe({
    id: 'bollard',
    label: 'Street bollard',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.5,
    tags: ['bollard'],
    notes: 'Cast bollard with a domed cap and a reflective band, guarding the kerb edge.',
    parts: [
      p('bollard-body', 'cast-iron', [0, 0, 0.24]),
      p('bollard-cap', 'cast-iron', [0, 0.94, 0.24]),
      p('hydrant-band', 'reflective-film', [0, 0.72, 0.24], { detail: 'bollard' }),
    ],
  }),
  definePropRecipe({
    id: 'construction-barrier',
    label: 'Construction barrier',
    category: 'clutter',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'along-street',
    wearSensitivity: 0.75,
    tags: ['barrier', 'works', 'period-signature'],
    notes: 'Two-leg works barrier with lamp caps and a litter-strewn base: temporary street clutter.',
    parts: [
      p('barrier-panel', 'plastic', [0, 0.35, 0.2]),
      p('barrier-leg', 'galvanised-steel', [-1.1, 0, 0.2]),
      p('barrier-leg', 'galvanised-steel', [1.1, 0, 0.2]),
      p('barrier-light', 'signal-lens-amber', [-1.1, 1.08, 0.2], { detail: 'barrier' }),
      p('barrier-light', 'signal-lens-amber', [1.1, 1.08, 0.2], { detail: 'barrier' }),
      p('litter-bit', 'paper', [0.5, 0.03, 0.32]),
    ],
  }),

  /* --------------------------------------------------------------------- *
   * 2025 street furniture
   * --------------------------------------------------------------------- */
  definePropRecipe({
    id: 'ev-charger',
    label: 'EV charger',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.2,
    tags: ['charger', 'period-signature'],
    notes: 'Kerb charger column with a holstered cable head and a lit payment screen.',
    lamp: {
      technology: 'led',
      glassMaterial: 'screen-glass',
      baseEmissive: 0.5,
      glowRadius: 0.24,
      lightOffset: [0, 1.25, 0.28],
    },
    parts: [
      p('charger-body', 'painted-steel', [0, 0, 0.16]),
      p('charger-screen', 'screen-glass', [0, 1.05, 0.32], { detail: 'screen' }),
      p('charger-head', 'aluminium', [0.24, 0.75, 0.24]),
      p('cable-drop', 'rubber', [-0.2, 0.4, 0.26], { detail: 'utility-fitting' }),
    ],
  }),
  definePropRecipe({
    id: 'e-scooter-rack',
    label: 'E-scooter dock',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.2,
    tags: ['rack', 'micromobility', 'period-signature'],
    notes: 'Docking rail with two parked e-scooters leaning at the kerb.',
    parts: [
      p('dock-rail', 'aluminium', [0, 0, 0.24]),
      p('scooter-deck', 'aluminium', [-0.24, 0.14, 0.3]),
      p('scooter-stem', 'aluminium', [-0.6, 0.2, 0.3]),
      p('scooter-bars', 'rubber', [-0.6, 1.2, 0.3], { detail: 'rack' }),
      p('scooter-deck', 'aluminium', [0.3, 0.14, 0.28]),
      p('scooter-stem', 'aluminium', [0.64, 0.2, 0.28]),
      p('scooter-bars', 'rubber', [0.64, 1.2, 0.28], { detail: 'rack' }),
    ],
  }),
  definePropRecipe({
    id: 'parklet-bench',
    label: 'Parklet bench',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.25,
    tags: ['seating', 'platform', 'period-signature'],
    notes: 'Timber parklet deck with a bench and back: the pavement terrace of the 2020s.',
    parts: [
      p('parklet-deck', 'timber', [0, 0, 0.02], { scale: [1, 1, 0.9] }),
      p('bench-seat', 'timber', [0, 0.42, 0.28]),
      p('bench-back', 'timber', [0, 0.7, 0.1]),
      p('planter-shrub', 'leaf-litter', [-1.35, 0.42, 0.1], { detail: 'planter' }),
    ],
  }),
  definePropRecipe({
    id: 'smart-bus-shelter',
    label: 'Smart bus shelter',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.2,
    tags: ['shelter', 'screen', 'period-signature'],
    notes: 'Shelter with a real-time information screen, lit advertising panel, bench and cycle rail.',
    lamp: {
      technology: 'led',
      glassMaterial: 'screen-glass',
      baseEmissive: 0.55,
      glowRadius: 0.5,
      lightOffset: [0, 2.3, 0.3],
    },
    parts: [
      p('shelter-roof', 'aluminium', [0, 2.45, 0.06]),
      p('shelter-post', 'aluminium', [-1.5, 0, 0.2]),
      p('shelter-post', 'aluminium', [1.5, 0, 0.2]),
      p('shelter-ad-panel', 'screen-glass', [1.2, 0.6, 0.42], { detail: 'screen' }),
      p('kiosk-screen', 'screen-glass', [-0.9, 1.6, 0.22], { detail: 'screen' }),
      p('shelter-bench', 'aluminium', [0, 0.5, 0.3]),
      p('shelter-roof', 'aluminium', [0, 2.52, 0.02], { scale: [0.6, 0.3, 0.9], detail: 'roof-detail' }),
    ],
  }),
  definePropRecipe({
    id: 'planter',
    label: 'Street planter',
    category: 'furniture',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.3,
    tags: ['planter', 'greening'],
    notes: 'Concrete planter with a clipped shrub, part of the pavement greening programme.',
    parts: [
      p('planter-tub', 'concrete', [0, 0, 0.12]),
      p('planter-shrub', 'leaf-litter', [0, 0.68, 0.12]),
      p('planter-shrub', 'leaf-litter', [0.3, 0.62, 0.24], { scale: [0.6, 0.6, 0.6], detail: 'planter' }),
    ],
  }),

  /* --------------------------------------------------------------------- *
   * Persistent facade and pavement detail
   * --------------------------------------------------------------------- */
  definePropRecipe({
    id: 'facade-detail-cluster',
    label: 'Facade detail cluster',
    category: 'clutter',
    slot: 'street-furniture',
    mount: 'facade',
    facing: 'outward',
    wearSensitivity: 0.8,
    tags: ['detail', 'drainpipe', 'vent', 'awning', 'signage', 'patch'],
    notes:
      'The small persistent detail of a shopfront: drainpipe and boot against the facade, wall vent, signage pole with its plate, awning frame over the pavement and a patched slab underfoot.',
    parts: [
      p('drainpipe', 'cast-iron', [-1.1, 0.2, 0.08]),
      p('drainpipe-boot', 'cast-iron', [-1.1, 0, 0.14]),
      p('wall-vent', 'galvanised-steel', [0.2, 1.4, 0.06]),
      p('signage-pole', 'painted-steel', [0.75, 0, 0.16]),
      p('sign-face', 'enamel', [0.75, 2.4, 0.17]),
      p('awning-frame', 'painted-steel', [-0.2, 2.85, 0.3]),
      p('awning-post', 'painted-steel', [0.9, 0, 0.3]),
      p('patch-slab', 'concrete', [0.3, 0.02, 0.2], { detail: 'patch' }),
      p('litter-bit', 'paper', [-0.4, 0.03, 0.3]),
    ],
  }),
  definePropRecipe({
    id: 'facade-detail-ac-cluster',
    label: 'Facade detail with AC',
    category: 'clutter',
    slot: 'street-furniture',
    mount: 'facade',
    facing: 'outward',
    wearSensitivity: 0.75,
    tags: ['detail', 'drainpipe', 'vent', 'ac-unit', 'awning', 'patch'],
    notes:
      'Facade cluster with the wall-mounted AC unit and its bracket added under the vent, plus the tagged drainage and signage detail of a busy block.',
    parts: [
      p('drainpipe', 'cast-iron', [-1.15, 0.2, 0.08]),
      p('drainpipe-boot', 'galvanised-steel', [-1.15, 0, 0.14]),
      p('wall-vent', 'galvanised-steel', [-0.5, 1.5, 0.06]),
      p('ac-bracket', 'galvanised-steel', [0.35, 2.1, 0.14]),
      p('ac-unit', 'galvanised-steel', [0.35, 2.16, 0.2], { detail: 'ac-unit' }),
      p('signage-pole', 'galvanised-steel', [0.95, 0, 0.16]),
      p('sign-face', 'enamel', [0.95, 2.4, 0.17]),
      p('awning-frame', 'painted-steel', [-0.2, 2.85, 0.3]),
      p('patch-slab', 'asphalt-patch', [0.3, 0.02, 0.2], { detail: 'patch' }),
      p('litter-bit', 'paper', [0.5, 0.03, 0.3]),
    ],
  }),
  definePropRecipe({
    id: 'pavement-patch',
    label: 'Patched pavement',
    category: 'clutter',
    slot: 'street-furniture',
    mount: 'ground',
    facing: 'along-street',
    wearSensitivity: 0.9,
    tags: ['patch', 'drain', 'detail'],
    notes:
      'Utility trench patch with a kerb drain and litter: the repair work every period leaves on the pavement.',
    parts: [
      p('patch-slab', 'asphalt-patch', [0, 0.02, 0.2]),
      p('drain-frame', 'cast-iron', [0, 0.02, 0.5], { detail: 'drain' }),
      p(GUTTER, 'cast-iron', [0, 0.03, 0.5]),
      p('litter-paper', 'paper', [-0.5, 0.02, 0.3]),
    ],
  }),

  /* --------------------------------------------------------------------- *
   * Corner clutter and seasonal piles: one set per era
   * --------------------------------------------------------------------- */
  definePropRecipe({
    id: 'corner-clutter-1945',
    label: 'Wartime corner clutter',
    category: 'clutter',
    slot: 'corner-clutter',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.9,
    tags: ['clutter', 'period-signature', 'pile'],
    notes: 'Delivered crates, an ash pile and the litter of a wartime corner.',
    parts: [
      p('crate', 'timber', [-0.3, 0, 0.15]),
      p('crate', 'timber', [0.05, 0, 0.15]),
      p('crate', 'timber', [-0.12, 0.28, 0.19]),
      p('pile-cone', 'concrete', [0.5, 0, 0.2], { scale: [0.7, 1, 0.7], detail: 'pile' }),
      p('litter-paper', 'paper', [-0.5, 0.02, 0.3]),
    ],
  }),
  definePropRecipe({
    id: 'corner-clutter-1965',
    label: 'Newspaper box corner',
    category: 'clutter',
    slot: 'corner-clutter',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.7,
    tags: ['clutter', 'period-signature', 'kiosk'],
    notes: 'Two newspaper boxes and a leaf pile at the crossing corner.',
    parts: [
      p('news-box', 'painted-steel', [-0.3, 0, 0.2]),
      p('news-box', 'painted-steel', [0.2, 0, 0.24]),
      p('pile-mound', 'leaf-litter', [0.5, 0.31, 0.36], { scale: [0.7, 0.7, 0.7], detail: 'pile' }),
      p('litter-paper', 'paper', [-0.6, 0.02, 0.36]),
    ],
  }),
  definePropRecipe({
    id: 'corner-clutter-1985',
    label: 'Roadworks corner',
    category: 'clutter',
    slot: 'corner-clutter',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.85,
    tags: ['clutter', 'barrier', 'period-signature'],
    notes: 'Fenced-off works corner: barrier, lamp caps, grit pile and tagged litter.',
    parts: [
      p('barrier-panel', 'plastic', [0, 0.35, 0.24]),
      p('barrier-light', 'signal-lens-amber', [-0.9, 1.08, 0.24], { detail: 'barrier' }),
      p('barrier-light', 'signal-lens-amber', [0.9, 1.08, 0.24], { detail: 'barrier' }),
      p('pile-cone', 'snow', [0.42, 0, 0.3], { scale: [0.7, 1, 0.7], detail: 'pile' }),
      p('litter-bit', 'paper', [-0.4, 0.03, 0.4]),
    ],
  }),
  definePropRecipe({
    id: 'corner-clutter-2005',
    label: 'Utility corner cluster',
    category: 'clutter',
    slot: 'corner-clutter',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.5,
    tags: ['clutter', 'cabinet', 'camera'],
    notes: 'Utility cabinet, camera post, a swept leaf pile and litter at the pedestrian crossing corner.',
    parts: [
      p('cabinet-body', 'galvanised-steel', [-0.5, 0, 0.2]),
      p('cabinet-lid', 'galvanised-steel', [-0.5, 1.2, 0.2], { detail: 'cabinet' }),
      p('camera-post', 'aluminium', [0.6, 0, 0.24]),
      p('camera-body', 'aluminium', [0.6, 3.2, 0.38], { detail: 'camera' }),
      p('pile-mound', 'leaf-litter', [0.1, 0.31, 0.4], { scale: [0.7, 0.7, 0.7], detail: 'pile' }),
      p('litter-paper', 'paper', [-0.1, 0.02, 0.4]),
    ],
  }),
  definePropRecipe({
    id: 'corner-clutter-2025',
    label: 'Micromobility corner',
    category: 'clutter',
    slot: 'corner-clutter',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.25,
    tags: ['clutter', 'micromobility', 'period-signature'],
    notes: 'Parked e-scooters, a recycling pile and a patched corner of the 2020s.',
    parts: [
      p('scooter-deck', 'aluminium', [-0.4, 0.14, 0.24]),
      p('scooter-stem', 'aluminium', [-0.75, 0.2, 0.24]),
      p('scooter-deck', 'aluminium', [0.35, 0.14, 0.3]),
      p('scooter-stem', 'aluminium', [0.7, 0.2, 0.3]),
      p('pile-mound', 'leaf-litter', [-0.1, 0.31, 0.4], { scale: [0.7, 0.7, 0.7], detail: 'pile' }),
      p('patch-slab', 'concrete', [0.5, 0.02, 0.4], { detail: 'patch' }),
    ],
  }),
  definePropRecipe({
    id: 'corner-litter-patch',
    label: 'Corner litter and patch',
    category: 'clutter',
    slot: 'corner-clutter',
    mount: 'ground',
    facing: 'outward',
    wearSensitivity: 0.8,
    tags: ['clutter', 'patch', 'litter'],
    notes: 'The corner detail that never changes: a patched slab, swept litter and a kerb drain.',
    parts: [
      p('patch-slab', 'concrete', [0, 0.02, 0.24]),
      p('drain-frame', 'cast-iron', [0, 0.02, 0.52], { detail: 'drain' }),
      p(GUTTER, 'cast-iron', [0.05, 0.03, 0.52]),
      p('litter-bit', 'paper', [-0.4, 0.03, 0.34]),
      p('litter-paper', 'paper', [0.4, 0.02, 0.3]),
    ],
  }),
]

/** Every recipe, indexed by id. */
export const PROP_RECIPES: Readonly<Record<string, PropRecipe>> = Object.fromEntries(
  RECIPE_LIST.map((recipe) => [recipe.id, recipe]),
)

/** Recipe ids, sorted, for stable iteration. */
export const PROP_IDS: readonly string[] = RECIPE_LIST.map((recipe) => recipe.id).sort()

/** The recipes of one anchor slot. */
export function propsForSlot(slot: PropRecipe['slot']): readonly PropRecipe[] {
  return RECIPE_LIST.filter((recipe) => recipe.slot === slot)
}

/** The recipes of one category. */
export function propsForCategory(category: PropRecipe['category']): readonly PropRecipe[] {
  return RECIPE_LIST.filter((recipe) => recipe.category === category)
}

/** Looks one recipe up, throwing a useful error when it is unknown. */
export function getPropRecipe(id: string): PropRecipe {
  const recipe = PROP_RECIPES[id]
  if (recipe === undefined) {
    throw new RangeError(`Unknown prop recipe ${id}`)
  }
  return recipe
}

/** The detail census one recipe contributes to a plan. */
export function recipeDetail(recipe: PropRecipe): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const instance of recipe.parts) {
    const definition = PART_BY_ID[instance.part]
    const detail = instance.detail ?? definition?.detail ?? 'clutter'
    counts[detail] = (counts[detail] ?? 0) + 1
  }
  return counts
}

/**
 * Palette slice the wear pass reads.
 *
 * It is the era palette keyed by channel name, which is exactly what
 * `EraDefinition.palette` already is — the alias exists so this module does not
 * have to import the era type just to name the record.
 */
export type PropPaletteSample = Readonly<Record<MaterialEraTint['channel'], HexColor>>
