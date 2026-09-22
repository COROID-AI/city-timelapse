/**
 * Era-accurate pedestrian variants: outfit silhouette recipes, props, tones,
 * heights, ages, and per-person crowd traits.
 *
 * Five era catalogs (1945 / 1965 / 1985 / 2005 / 2025) each expose exactly
 * `ARCHETYPE_SLOTS` archetypes. A pedestrian keeps the same archetype index
 * across every era, so the crowd can morph one instanced slot's geometry from
 * archetype N's 1945 silhouette straight into archetype N's 1965 silhouette
 * and onward, restyling the same person mid-stride.
 *
 * Outfit colors derive from the shared era material palettes
 * (`ProceduralGfxLibrary.getMaterialSwatch(era, 'fabric')`), mixed with the
 * archetype's historically accurate base hue and deterministic per-person
 * jitter, so outfits read as the decade while still varying across the crowd.
 */

import type { EraYear } from '../../era/timeline';
import { ProceduralGfxLibrary } from '../../gfx/materials';
import {
  SLOT_CELL_KINDS,
  box,
  cyl,
  degenerateCell,
  degenerateCells,
  type Cell,
  type FigureSlot,
  type GridSlot,
} from './figures';

// ---------------------------------------------------------------------------
// Grid size and tone libraries
// ---------------------------------------------------------------------------

/** Stable archetype slots per era; a person's slot index never changes. */
export const ARCHETYPE_SLOTS = 6;

/** Era order used for deterministic seeds and blend bookkeeping. */
export const ERA_ORDER: Readonly<Record<EraYear, number>> = Object.freeze({
  1945: 0,
  1965: 1,
  1985: 2,
  2005: 3,
  2025: 4,
});
/** Varied skin tones (hex sRGB). */
export const SKIN_TONES: readonly string[] = Object.freeze([
  '#f6d7c4',
  '#eec3a6',
  '#d9a077',
  '#c08a5e',
  '#9c6a44',
  '#7a4e30',
  '#5b3a24',
  '#3e2718',
]);

/** Varied hair tones (hex sRGB), including age greys. */
export const HAIR_TONES: readonly string[] = Object.freeze([
  '#14100e',
  '#2b1d15',
  '#432c1d',
  '#5e4027',
  '#7a5636',
  '#9c7444',
  '#b8925c',
  '#6f6b66',
  '#a9a6a1',
  '#e4dcc8',
]);

export type AgeGroup = 'child' | 'adult' | 'senior';
export const AGE_GROUPS: readonly AgeGroup[] = Object.freeze(['child', 'adult', 'senior']);

// ---------------------------------------------------------------------------
// Silhouette style vocabularies
// ---------------------------------------------------------------------------

export type TorsoStyle =
  | 'suitWideLapel'
  | 'suitNarrow'
  | 'aLineDress'
  | 'shiftDress'
  | 'turtleneck'
  | 'workJacket'
  | 'powerSuit'
  | 'powerDress'
  | 'tracksuit'
  | 'leatherJacket'
  | 'hoodie'
  | 'oversizedTee'
  | 'athleisureTop'
  | 'techFleece'
  | 'tankTop';

export type LegStyle =
  | 'suitTrouser'
  | 'straightTrouser'
  | 'slimTrouser'
  | 'tights'
  | 'bare'
  | 'goGoBoot'
  | 'powerTrouser'
  | 'trackPant'
  | 'lowRiseDenim'
  | 'baggyJean'
  | 'cargo'
  | 'legging'
  | 'jogger'
  | 'shorts';

export type ArmStyle = 'sleeve' | 'bare';

export type HairStyle =
  | 'shortWave'
  | 'crewCut'
  | 'victoryRolls'
  | 'pageboy'
  | 'beehive'
  | 'bouffant'
  | 'modMop'
  | 'sidePart'
  | 'bigHair'
  | 'feathered'
  | 'curls'
  | 'spiky'
  | 'topBun'
  | 'longLoose';

export type HatStyle = 'none' | 'fedora' | 'smallBrim' | 'pillbox' | 'newsboyCap' | 'flatCap';

export type FaceStyle = 'none' | 'mask' | 'earbuds' | 'maskEarbuds';

export type FootStyle = 'oxford' | 'pump' | 'loafer' | 'sneaker' | 'chukka';

export type PropHandStyle =
  | 'none'
  | 'newspaper'
  | 'briefcase'
  | 'flipPhone'
  | 'phoneInHand'
  | 'tote'
  | 'boombox';

export type PropBodyStyle = 'none' | 'recordBag' | 'messengerBag' | 'handbag';

const dB = (): Cell => degenerateCell('box');
const dC = (): Cell => degenerateCell('cyl');

// ---------------------------------------------------------------------------
// Torso recipes — cells: [pelvis, chest, shoulderL, shoulderR, flare,
//                        lapelL, lapelR, collar]
// ---------------------------------------------------------------------------

const TORSO_CELLS: Record<TorsoStyle, () => Cell[]> = {
  // 1945: broad notched lapels, structured shoulders, straight hem.
  suitWideLapel: () => [
    box([0, 0.1, 0], [0.19, 0.22, 0.3]),
    box([0, 0.38, 0], [0.22, 0.35, 0.36]),
    box([0, 0.545, 0.155], [0.22, 0.08, 0.115]),
    box([0, 0.545, -0.155], [0.22, 0.08, 0.115]),
    dC(),
    box([0.115, 0.44, 0.075], [0.02, 0.22, 0.12], [0, 0, -0.35]),
    box([0.115, 0.44, -0.075], [0.02, 0.22, 0.12], [0, 0, 0.35]),
    cyl([0, 0.575, 0], [0.11, 0.13, 0.07]),
  ],
  // 1965 mod: narrow lapels, trim shoulders.
  suitNarrow: () => [
    box([0, 0.1, 0], [0.18, 0.22, 0.29]),
    box([0, 0.38, 0], [0.21, 0.35, 0.34]),
    box([0, 0.545, 0.15], [0.21, 0.07, 0.105]),
    box([0, 0.545, -0.15], [0.21, 0.07, 0.105]),
    dC(),
    box([0.112, 0.45, 0.06], [0.02, 0.18, 0.07], [0, 0, -0.22]),
    box([0.112, 0.45, -0.06], [0.02, 0.18, 0.07], [0, 0, 0.22]),
    cyl([0, 0.575, 0], [0.105, 0.12, 0.06]),
  ],
  // 1945 A-line: fitted bodice, flared skirt, cap sleeves, boat neck.
  aLineDress: () => [
    box([0, 0.12, 0], [0.17, 0.2, 0.27]),
    box([0, 0.38, 0], [0.19, 0.3, 0.3]),
    box([0, 0.52, 0.135], [0.2, 0.13, 0.095]),
    box([0, 0.52, -0.135], [0.2, 0.13, 0.095]),
    cyl([0, -0.04, 0], [0.16, 0.3, 0.44]),
    dB(),
    dB(),
    cyl([0, 0.545, 0], [0.115, 0.12, 0.045]),
  ],
  // 1965 mod shift: straight mini silhouette, cap sleeves, boat neck.
  shiftDress: () => [
    box([0, 0.1, 0], [0.17, 0.2, 0.26]),
    box([0, 0.38, 0], [0.19, 0.32, 0.31]),
    box([0, 0.525, 0.13], [0.2, 0.12, 0.09]),
    box([0, 0.525, -0.13], [0.2, 0.12, 0.09]),
    cyl([0, 0, 0], [0.155, 0.175, 0.36]),
    dB(),
    dB(),
    cyl([0, 0.545, 0], [0.125, 0.13, 0.05]),
  ],
  // 1965 beat / 1985 preppy: roll collar.
  turtleneck: () => [
    box([0, 0.1, 0], [0.18, 0.22, 0.29]),
    box([0, 0.38, 0], [0.21, 0.36, 0.34]),
    box([0, 0.545, 0.15], [0.21, 0.08, 0.105]),
    box([0, 0.545, -0.15], [0.21, 0.08, 0.105]),
    dC(),
    dB(),
    dB(),
    cyl([0, 0.585, 0], [0.095, 0.11, 0.1]),
  ],
  // 1945 utility: short field jacket with flap pockets.
  workJacket: () => [
    box([0, 0.1, 0], [0.19, 0.22, 0.3]),
    box([0, 0.37, 0], [0.22, 0.3, 0.36]),
    box([0, 0.535, 0.155], [0.22, 0.09, 0.115]),
    box([0, 0.535, -0.155], [0.22, 0.09, 0.115]),
    dC(),
    box([0.11, 0.3, 0.08], [0.02, 0.07, 0.11]),
    box([0.11, 0.3, -0.08], [0.02, 0.07, 0.11]),
    cyl([0, 0.565, 0], [0.115, 0.13, 0.05]),
  ],
  // 1985 power: exaggerated shoulder pads, sharp lapels.
  powerSuit: () => [
    box([0, 0.1, 0], [0.19, 0.22, 0.3]),
    box([0, 0.38, 0], [0.21, 0.33, 0.37]),
    box([0, 0.55, 0.175], [0.23, 0.11, 0.145]),
    box([0, 0.55, -0.175], [0.23, 0.11, 0.145]),
    dC(),
    box([0.115, 0.45, 0.07], [0.02, 0.2, 0.1], [0, 0, -0.3]),
    box([0.115, 0.45, -0.07], [0.02, 0.2, 0.1], [0, 0, 0.3]),
    cyl([0, 0.575, 0], [0.11, 0.13, 0.06]),
  ],
  // 1985 power skirt suit: pads + pencil skirt flare.
  powerDress: () => [
    box([0, 0.11, 0], [0.18, 0.2, 0.28]),
    box([0, 0.38, 0], [0.19, 0.31, 0.31]),
    box([0, 0.55, 0.17], [0.23, 0.11, 0.135]),
    box([0, 0.55, -0.17], [0.23, 0.11, 0.135]),
    cyl([0, -0.02, 0], [0.15, 0.19, 0.38]),
    dB(),
    dB(),
    cyl([0, 0.57, 0], [0.11, 0.12, 0.05]),
  ],
  // 1985 tracksuit: zip placket, stand collar, padded shoulders.
  tracksuit: () => [
    box([0, 0.1, 0], [0.19, 0.22, 0.3]),
    box([0, 0.38, 0], [0.22, 0.34, 0.36]),
    box([0, 0.545, 0.16], [0.22, 0.1, 0.12]),
    box([0, 0.545, -0.16], [0.22, 0.1, 0.12]),
    dC(),
    box([0.115, 0.38, 0], [0.02, 0.3, 0.03]),
    dB(),
    cyl([0, 0.575, 0], [0.105, 0.12, 0.07]),
  ],
  // 1985 leather: wide angled lapels, assertive shoulders.
  leatherJacket: () => [
    box([0, 0.1, 0], [0.19, 0.22, 0.3]),
    box([0, 0.38, 0], [0.22, 0.33, 0.36]),
    box([0, 0.55, 0.165], [0.23, 0.1, 0.125]),
    box([0, 0.55, -0.165], [0.23, 0.1, 0.125]),
    dC(),
    box([0.115, 0.45, 0.075], [0.02, 0.2, 0.13], [0, 0, -0.4]),
    box([0.115, 0.45, -0.075], [0.02, 0.2, 0.13], [0, 0, 0.4]),
    cyl([0, 0.57, 0], [0.115, 0.13, 0.06]),
  ],
  // 2005 hoodie: relaxed body, bunched hood behind the neck.
  hoodie: () => [
    box([0, 0.1, 0], [0.2, 0.24, 0.31]),
    box([0, 0.38, 0], [0.23, 0.36, 0.37]),
    box([0, 0.545, 0.16], [0.23, 0.1, 0.12]),
    box([0, 0.545, -0.16], [0.23, 0.1, 0.12]),
    dC(),
    box([0.12, 0.3, 0], [0.02, 0.14, 0.16]),
    dB(),
    cyl([-0.06, 0.565, 0], [0.13, 0.15, 0.11]),
  ],
  // 2005 / 1985 / 2025 boxy tee: short cap sleeves.
  oversizedTee: () => [
    box([0, 0.1, 0], [0.2, 0.2, 0.31]),
    box([0, 0.38, 0], [0.22, 0.34, 0.38]),
    box([0, 0.525, 0.15], [0.21, 0.12, 0.1]),
    box([0, 0.525, -0.15], [0.21, 0.12, 0.1]),
    dC(),
    dB(),
    dB(),
    cyl([0, 0.555, 0], [0.12, 0.125, 0.04]),
  ],
  // 2025 athleisure: fitted cropped zip top.
  athleisureTop: () => [
    box([0, 0.11, 0], [0.17, 0.18, 0.27]),
    box([0, 0.36, 0], [0.2, 0.3, 0.31]),
    box([0, 0.54, 0.145], [0.2, 0.07, 0.1]),
    box([0, 0.54, -0.145], [0.2, 0.07, 0.1]),
    dC(),
    box([0.1, 0.36, 0], [0.02, 0.24, 0.03]),
    dB(),
    cyl([0, 0.57, 0], [0.1, 0.11, 0.06]),
  ],
  // 2025 tech fleece: boxy zip with hood.
  techFleece: () => [
    box([0, 0.1, 0], [0.21, 0.24, 0.32]),
    box([0, 0.38, 0], [0.24, 0.36, 0.38]),
    box([0, 0.545, 0.165], [0.23, 0.1, 0.13]),
    box([0, 0.545, -0.165], [0.23, 0.1, 0.13]),
    dC(),
    box([0.12, 0.4, 0], [0.02, 0.28, 0.03]),
    dB(),
    cyl([-0.06, 0.565, 0], [0.13, 0.15, 0.11]),
  ],
  // 2025 tank: narrow straps, open shoulders.
  tankTop: () => [
    box([0, 0.11, 0], [0.17, 0.18, 0.27]),
    box([0, 0.36, 0], [0.18, 0.3, 0.29]),
    box([0, 0.55, 0.07], [0.16, 0.06, 0.05]),
    box([0, 0.55, -0.07], [0.16, 0.06, 0.05]),
    dC(),
    dB(),
    dB(),
    dC(),
  ],
};

// ---------------------------------------------------------------------------
// Leg recipes — cells: [thigh, shin, hem]
// ---------------------------------------------------------------------------

const LEG_CELLS: Record<LegStyle, () => Cell[]> = {
  suitTrouser: () => [
    cyl([0, -0.22, 0], [0.085, 0.082, 0.46]),
    cyl([0, -0.64, 0], [0.08, 0.078, 0.44]),
    box([0, -0.835, 0], [0.11, 0.06, 0.12]),
  ],
  straightTrouser: () => [
    cyl([0, -0.22, 0], [0.08, 0.078, 0.46]),
    cyl([0, -0.64, 0], [0.078, 0.076, 0.44]),
    box([0, -0.83, 0], [0.105, 0.05, 0.115]),
  ],
  slimTrouser: () => [
    cyl([0, -0.22, 0], [0.07, 0.064, 0.46]),
    cyl([0, -0.64, 0], [0.062, 0.056, 0.44]),
    box([0, -0.83, 0], [0.095, 0.05, 0.105]),
  ],
  tights: () => [
    cyl([0, -0.22, 0], [0.058, 0.052, 0.46]),
    cyl([0, -0.64, 0], [0.05, 0.046, 0.44]),
    dB(),
  ],
  bare: () => [
    cyl([0, -0.22, 0], [0.056, 0.05, 0.46]),
    cyl([0, -0.64, 0], [0.048, 0.044, 0.44]),
    dB(),
  ],
  // 1965 go-go: thigh-high boot with a cuff at the knee.
  goGoBoot: () => [
    cyl([0, -0.22, 0], [0.065, 0.062, 0.46]),
    cyl([0, -0.64, 0], [0.07, 0.062, 0.44]),
    box([0, -0.44, 0], [0.1, 0.05, 0.1]),
  ],
  // 1985 power: dramatic wide flare.
  powerTrouser: () => [
    cyl([0, -0.22, 0], [0.1, 0.105, 0.46]),
    cyl([0, -0.64, 0], [0.105, 0.115, 0.44]),
    box([0, -0.82, 0], [0.14, 0.05, 0.15]),
  ],
  trackPant: () => [
    cyl([0, -0.22, 0], [0.088, 0.085, 0.46]),
    cyl([0, -0.64, 0], [0.085, 0.08, 0.44]),
    box([0, -0.82, 0], [0.1, 0.055, 0.105]),
  ],
  // 2005 low-rise denim: sits below the hip, slim straight.
  lowRiseDenim: () => [
    cyl([0, -0.24, 0], [0.078, 0.074, 0.44]),
    cyl([0, -0.64, 0], [0.072, 0.07, 0.44]),
    box([0, -0.83, 0], [0.1, 0.05, 0.11]),
  ],
  baggyJean: () => [
    cyl([0, -0.22, 0], [0.095, 0.098, 0.46]),
    cyl([0, -0.64, 0], [0.096, 0.1, 0.44]),
    box([0, -0.82, 0], [0.12, 0.06, 0.13]),
  ],
  cargo: () => [
    cyl([0, -0.22, 0], [0.088, 0.092, 0.46]),
    cyl([0, -0.64, 0], [0.088, 0.09, 0.44]),
    box([0.07, -0.3, 0.075], [0.06, 0.13, 0.09]),
  ],
  legging: () => [
    cyl([0, -0.22, 0], [0.06, 0.052, 0.46]),
    cyl([0, -0.64, 0], [0.05, 0.044, 0.44]),
    dB(),
  ],
  jogger: () => [
    cyl([0, -0.22, 0], [0.08, 0.075, 0.46]),
    cyl([0, -0.64, 0], [0.07, 0.05, 0.44]),
    box([0, -0.82, 0], [0.09, 0.06, 0.095]),
  ],
  // 2025 running shorts: short thigh shell over a bare shin.
  shorts: () => [
    cyl([0, -0.13, 0], [0.082, 0.086, 0.26]),
    cyl([0, -0.55, 0], [0.05, 0.044, 0.6]),
    box([0, -0.25, 0], [0.1, 0.05, 0.11]),
  ],
};

// ---------------------------------------------------------------------------
// Arm recipes — cells: [upper, lower/cuff, relief]
// ---------------------------------------------------------------------------

const ARM_CELLS: Record<ArmStyle, () => Cell[]> = {
  sleeve: () => [
    box([0, -0.17, 0], [0.095, 0.36, 0.095]),
    box([0, -0.47, 0], [0.082, 0.26, 0.082]),
    cyl([0, -0.32, 0], [0.058, 0.058, 0.34]),
  ],
  bare: () => [
    box([0, -0.17, 0], [0.075, 0.36, 0.075]),
    box([0, -0.47, 0], [0.065, 0.26, 0.065]),
    dC(),
  ],
};

// ---------------------------------------------------------------------------
// Hair recipes — cells: [volume, fringe, bun]
// ---------------------------------------------------------------------------

const HAIR_CELLS: Record<HairStyle, () => Cell[]> = {
  shortWave: () => [
    cyl([-0.005, 0.17, 0], [0.098, 0.11, 0.11]),
    box([0.075, 0.21, 0], [0.05, 0.05, 0.15]),
    dC(),
  ],
  crewCut: () => [
    cyl([-0.005, 0.2, 0], [0.095, 0.102, 0.06]),
    dB(),
    dC(),
  ],
  // 1945 victory rolls.
  victoryRolls: () => [
    cyl([-0.01, 0.17, 0], [0.1, 0.11, 0.1]),
    box([0.05, 0.22, 0], [0.07, 0.055, 0.14]),
    cyl([-0.04, 0.235, 0.06], [0.035, 0.035, 0.05], [0, 0, Math.PI / 2]),
  ],
  pageboy: () => [
    cyl([-0.01, 0.155, 0], [0.1, 0.112, 0.13]),
    box([0.07, 0.215, 0], [0.045, 0.045, 0.15]),
    dC(),
  ],
  // 1965 beehive: tall conical pile.
  beehive: () => [
    cyl([-0.02, 0.24, 0], [0.055, 0.105, 0.16]),
    box([0.07, 0.205, 0], [0.05, 0.05, 0.15]),
    dC(),
  ],
  bouffant: () => [
    cyl([-0.02, 0.2, 0], [0.07, 0.11, 0.13]),
    box([0.07, 0.21, 0], [0.045, 0.05, 0.15]),
    dC(),
  ],
  modMop: () => [
    cyl([0, 0.185, 0], [0.1, 0.11, 0.115]),
    box([0.075, 0.2, 0], [0.055, 0.075, 0.16]),
    dC(),
  ],
  sidePart: () => [
    cyl([-0.005, 0.17, 0], [0.098, 0.11, 0.11]),
    box([0.07, 0.21, 0.02], [0.05, 0.05, 0.13], [0, 0, 0.2]),
    dC(),
  ],
  // 1985 big hair: wide, high, voluminous.
  bigHair: () => [
    cyl([-0.01, 0.2, 0], [0.09, 0.13, 0.15]),
    box([0.07, 0.215, 0], [0.05, 0.06, 0.15]),
    dC(),
  ],
  feathered: () => [
    cyl([-0.005, 0.18, 0], [0.085, 0.115, 0.13]),
    box([0.07, 0.21, 0], [0.05, 0.06, 0.16], [0, 0, 0.15]),
    dC(),
  ],
  curls: () => [
    cyl([-0.01, 0.175, 0], [0.1, 0.11, 0.115]),
    box([0.07, 0.21, 0], [0.05, 0.05, 0.14]),
    cyl([0, 0.13, 0.095], [0.038, 0.038, 0.05], [Math.PI / 2, 0, 0]),
  ],
  // 2005 spiky.
  spiky: () => [
    cyl([-0.005, 0.2, 0], [0.09, 0.1, 0.075]),
    box([0.04, 0.25, 0], [0.05, 0.05, 0.14], [0, 0, 0.5]),
    dC(),
  ],
  // 2025 top bun.
  topBun: () => [
    cyl([-0.005, 0.175, 0], [0.1, 0.105, 0.105]),
    dB(),
    cyl([-0.01, 0.28, 0], [0.05, 0.05, 0.055]),
  ],
  longLoose: () => [
    cyl([-0.02, 0.15, 0], [0.1, 0.11, 0.15]),
    box([0.07, 0.21, 0], [0.045, 0.05, 0.14]),
    dC(),
  ],
};

// ---------------------------------------------------------------------------
// Hat recipes — cells: [brim, crown, band]
// ---------------------------------------------------------------------------

const HAT_CELLS: Record<Exclude<HatStyle, 'none'>, () => Cell[]> = {
  // 1945 fedora: wide brim, pinched crown, ribbon band.
  fedora: () => [
    cyl([0, 0.245, 0], [0.175, 0.175, 0.016]),
    cyl([0, 0.3, 0], [0.095, 0.11, 0.105]),
    box([0, 0.262, 0], [0.215, 0.032, 0.215]),
  ],
  // 1945 women's small tilted brim hat.
  smallBrim: () => [
    cyl([0, 0.25, 0], [0.135, 0.135, 0.014], [0.12, 0, 0.1]),
    cyl([0, 0.29, 0], [0.08, 0.085, 0.085]),
    box([0, 0.262, 0], [0.175, 0.03, 0.175]),
  ],
  // 1965 pillbox: brimless round crown with a low band.
  pillbox: () => [
    dC(),
    cyl([0, 0.285, 0], [0.1, 0.107, 0.075]),
    box([0, 0.253, 0], [0.218, 0.03, 0.218]),
  ],
  // 1945 newsboy: puffy crown with a short visor.
  newsboyCap: () => [
    cyl([0.06, 0.25, 0], [0.09, 0.09, 0.02], [0.3, 0, 0]),
    cyl([-0.01, 0.27, 0], [0.1, 0.11, 0.1]),
    dB(),
  ],
  flatCap: () => [
    cyl([0.07, 0.245, 0], [0.08, 0.085, 0.018], [0.25, 0, 0]),
    cyl([0, 0.26, 0], [0.1, 0.105, 0.06], [0.1, 0, 0]),
    dB(),
  ],
};

// ---------------------------------------------------------------------------
// Face recipes — cells: [mask, strapL, strapR, earbudL, earbudR]
// ---------------------------------------------------------------------------

const FACE_CELLS: Record<Exclude<FaceStyle, 'none'>, () => Cell[]> = {
  mask: () => [
    box([0.095, 0.09, 0], [0.055, 0.075, 0.145], [0, 0, 0.08]),
    box([0.04, 0.115, 0.088], [0.11, 0.012, 0.012]),
    box([0.04, 0.115, -0.088], [0.11, 0.012, 0.012]),
    dC(),
    dC(),
  ],
  earbuds: () => [
    dB(),
    dB(),
    dB(),
    cyl([0.01, 0.13, 0.092], [0.014, 0.014, 0.022], [Math.PI / 2, 0, 0]),
    cyl([0.01, 0.13, -0.092], [0.014, 0.014, 0.022], [Math.PI / 2, 0, 0]),
  ],
  maskEarbuds: () => [
    box([0.095, 0.09, 0], [0.055, 0.075, 0.145], [0, 0, 0.08]),
    box([0.04, 0.115, 0.088], [0.11, 0.012, 0.012]),
    box([0.04, 0.115, -0.088], [0.11, 0.012, 0.012]),
    cyl([0.01, 0.13, 0.092], [0.014, 0.014, 0.022], [Math.PI / 2, 0, 0]),
    cyl([0.01, 0.13, -0.092], [0.014, 0.014, 0.022], [Math.PI / 2, 0, 0]),
  ],
};

// ---------------------------------------------------------------------------
// Foot recipes — cells: [sole, upper, toe]
// ---------------------------------------------------------------------------

const FOOT_CELLS: Record<FootStyle, () => Cell[]> = {
  oxford: () => [
    box([0.025, -0.045, 0], [0.215, 0.035, 0.095]),
    box([0, -0.015, 0], [0.15, 0.055, 0.085]),
    box([0.07, 0, 0], [0.07, 0.045, 0.088]),
  ],
  pump: () => [
    box([0.02, -0.05, 0], [0.19, 0.03, 0.085]),
    box([-0.01, -0.018, 0], [0.13, 0.06, 0.075]),
    box([0.05, -0.005, 0], [0.06, 0.04, 0.075]),
  ],
  loafer: () => [
    box([0.02, -0.045, 0], [0.2, 0.032, 0.09]),
    box([0, -0.015, 0], [0.14, 0.055, 0.082]),
    box([0.06, 0, 0], [0.07, 0.042, 0.085]),
  ],
  sneaker: () => [
    box([0.025, -0.04, 0], [0.22, 0.05, 0.1]),
    box([0.005, -0.01, 0], [0.16, 0.06, 0.09]),
    box([0.075, 0, 0], [0.075, 0.05, 0.095]),
  ],
  chukka: () => [
    box([0.02, -0.045, 0], [0.21, 0.035, 0.095]),
    box([0, 0.02, 0], [0.15, 0.1, 0.085]),
    box([0.065, 0, 0], [0.07, 0.045, 0.088]),
  ],
};

// ---------------------------------------------------------------------------
// Held-prop recipes (wrist frame) — cells: [main, lid/handle, detail, w1, w2]
// ---------------------------------------------------------------------------

const PROP_HAND_CELLS: Record<Exclude<PropHandStyle, 'none'>, () => Cell[]> = {
  // 1945 folded newspaper bundle.
  newspaper: () => [
    box([0.055, -0.07, 0], [0.14, 0.1, 0.13], [0, 0, 0.15]),
    box([0.05, -0.115, 0], [0.15, 0.02, 0.14]),
    box([0.055, -0.02, 0], [0.13, 0.02, 0.12]),
    dC(),
    dC(),
  ],
  briefcase: () => [
    box([0.02, -0.22, 0], [0.05, 0.19, 0.28]),
    box([0.052, -0.2, 0], [0.01, 0.06, 0.1]),
    box([0, -0.11, 0], [0.03, 0.07, 0.16]),
    dC(),
    dC(),
  ],
  // 2005 flip phone: lower body + open flipped-up lid.
  flipPhone: () => [
    box([0.04, -0.04, 0], [0.018, 0.075, 0.045], [0, 0, -0.2]),
    box([0.045, 0.015, 0], [0.016, 0.06, 0.042], [0, 0, -0.55]),
    box([0.03, -0.045, 0], [0.006, 0.03, 0.028]),
    dC(),
    dC(),
  ],
  // 2025 slab phone held in the hand.
  phoneInHand: () => [
    box([0.04, -0.03, 0], [0.016, 0.085, 0.05], [0, 0, -0.15]),
    dB(),
    box([0.052, -0.02, 0], [0.004, 0.05, 0.034]),
    dC(),
    dC(),
  ],
  // 2025 canvas tote.
  tote: () => [
    box([0.02, -0.16, 0], [0.1, 0.2, 0.26]),
    box([0, -0.075, 0], [0.04, 0.05, 0.18]),
    dB(),
    dC(),
    dC(),
  ],
  // 1985 boombox carried by the handle.
  boombox: () => [
    box([0.11, -0.18, 0], [0.16, 0.17, 0.38]),
    box([0.11, -0.07, 0], [0.05, 0.03, 0.3]),
    box([0.19, -0.18, 0], [0.02, 0.1, 0.14]),
    cyl([0.185, -0.19, 0.12], [0.06, 0.06, 0.02], [0, 0, Math.PI / 2]),
    cyl([0.185, -0.19, -0.12], [0.06, 0.06, 0.02], [0, 0, Math.PI / 2]),
  ],
};

// ---------------------------------------------------------------------------
// Body-prop recipes (torso frame) — cells: [body, flap/handle, strap]
// ---------------------------------------------------------------------------

const PROP_BODY_CELLS: Record<Exclude<PropBodyStyle, 'none'>, () => Cell[]> = {
  // 1965 vinyl record bag carried under the arm with a shoulder strap.
  recordBag: () => [
    box([0.02, 0.02, 0.175], [0.03, 0.3, 0.31]),
    dB(),
    box([0.03, 0.28, 0.02], [0.02, 0.5, 0.05], [0.6, 0, 0.5]),
  ],
  // 2005 messenger bag with cross-body strap.
  messengerBag: () => [
    box([0.04, -0.06, 0.16], [0.1, 0.24, 0.22]),
    box([0.09, 0.05, 0.16], [0.02, 0.1, 0.23]),
    box([0.02, 0.26, 0.02], [0.02, 0.5, 0.055], [0.7, 0, 0.5]),
  ],
  handbag: () => [
    box([0, -0.03, 0.185], [0.07, 0.15, 0.17]),
    box([0, 0.06, 0.185], [0.04, 0.06, 0.13]),
    dB(),
  ],
};

// ---------------------------------------------------------------------------
// Style -> color/material role maps
// ---------------------------------------------------------------------------

const LEG_COLOR_ROLE: Readonly<Record<LegStyle, 'lower' | 'skin'>> = Object.freeze({
  suitTrouser: 'lower',
  straightTrouser: 'lower',
  slimTrouser: 'lower',
  tights: 'lower',
  bare: 'skin',
  goGoBoot: 'lower',
  powerTrouser: 'lower',
  trackPant: 'lower',
  lowRiseDenim: 'lower',
  baggyJean: 'lower',
  cargo: 'lower',
  legging: 'lower',
  jogger: 'lower',
  shorts: 'lower',
});

const ARM_COLOR_ROLE: Readonly<Record<ArmStyle, 'garment' | 'skin'>> = Object.freeze({
  sleeve: 'garment',
  bare: 'skin',
});

/** Default prop colors for styles without an archetype override. */
const PROP_DEFAULT_COLORS: Readonly<Record<string, string>> = Object.freeze({
  newspaper: '#e8e2d2',
  briefcase: '#4a3526',
  flipPhone: '#2a2d33',
  phoneInHand: '#1c1e22',
  tote: '#e6ddc9',
  boombox: '#565b66',
  recordBag: '#1e2024',
  messengerBag: '#3f4a5a',
  handbag: '#6b4a52',
  none: '#ffffff',
});

/** Material role per prop style (which procedural surface it should wear). */
export const PROP_HAND_MATERIAL_ROLE: Readonly<Record<PropHandStyle, 'fabric' | 'paper' | 'tech' | 'shoe'>> =
  Object.freeze({
    none: 'fabric',
    newspaper: 'paper',
    briefcase: 'shoe',
    flipPhone: 'tech',
    phoneInHand: 'tech',
    tote: 'fabric',
    boombox: 'tech',
  });

export const PROP_BODY_MATERIAL_ROLE: Readonly<Record<PropBodyStyle, 'fabric' | 'paper' | 'tech' | 'shoe'>> =
  Object.freeze({
    none: 'fabric',
    recordBag: 'paper',
    messengerBag: 'shoe',
    handbag: 'shoe',
  });

/** Masks and earbuds are always near-white molded plastic. */
export const FACE_ACCESSORY_COLOR = '#f4f6f8';

// ---------------------------------------------------------------------------
// Archetype catalog
// ---------------------------------------------------------------------------

export interface ArchetypeParts {
  readonly torso: TorsoStyle;
  readonly legs: LegStyle;
  readonly arms: ArmStyle;
  readonly hair: HairStyle;
  readonly hat: HatStyle;
  readonly face: FaceStyle;
  readonly foot: FootStyle;
  readonly propA: PropHandStyle;
  readonly propB: PropBodyStyle;
}

export interface ArchetypeColors {
  readonly garment: string;
  readonly lower?: string;
  readonly hat?: string;
  readonly shoe: string;
  readonly prop?: string;
  readonly propBody?: string;
}

export interface ArchetypeGait {
  /** Multiplier on the age-based cruise speed. */
  readonly speedScale: number;
  /** Multiplier on the height-derived stride length. */
  readonly strideScale: number;
  /** Multiplier on the walk bob amplitude. */
  readonly bobScale: number;
}

export interface BehaviorWeights {
  readonly walk: number;
  readonly windowShop: number;
  readonly chatter: number;
  readonly idle: number;
}

export interface CrowdArchetype {
  readonly key: string;
  readonly label: string;
  /** Era-identity vocabulary asserted by tests and shown in pickables. */
  readonly tags: readonly string[];
  readonly parts: ArchetypeParts;
  readonly colors: ArchetypeColors;
  readonly gait: ArchetypeGait;
  readonly behaviors: BehaviorWeights;
}

const WALK_HEAVY: BehaviorWeights = Object.freeze({ walk: 0.7, windowShop: 0.1, chatter: 0.12, idle: 0.08 });
const STROLL: BehaviorWeights = Object.freeze({ walk: 0.62, windowShop: 0.16, chatter: 0.14, idle: 0.08 });
const PURPOSE: BehaviorWeights = Object.freeze({ walk: 0.76, windowShop: 0.07, chatter: 0.09, idle: 0.08 });
const LEISURE: BehaviorWeights = Object.freeze({ walk: 0.6, windowShop: 0.17, chatter: 0.15, idle: 0.08 });

/**
 * Six archetypes per era. The archetype index is a person's stable identity:
 * era N and era N+1 entries at the same index are the same individual
 * restyled, which is what makes mid-stride era morphs read as an outfit
 * change rather than a crowd swap.
 */
export const ERA_ARCHETYPES: Readonly<Record<EraYear, readonly CrowdArchetype[]>> = Object.freeze({
  1945: [
    {
      key: 'wartime-commuter',
      label: 'Wartime commuter in fedora',
      tags: ['fedora', 'wide-lapel-suit', 'newspaper-bundle', 'wool-suit'],
      parts: {
        torso: 'suitWideLapel',
        legs: 'suitTrouser',
        arms: 'sleeve',
        hair: 'shortWave',
        hat: 'fedora',
        face: 'none',
        foot: 'oxford',
        propA: 'newspaper',
        propB: 'none',
      },
      colors: { garment: '#3d4453', hat: '#514a41', shoe: '#23201c' },
      gait: { speedScale: 1.02, strideScale: 1, bobScale: 1 },
      behaviors: WALK_HEAVY,
    },
    {
      key: 'file-clerk',
      label: 'File clerk with briefcase',
      tags: ['fedora', 'wide-lapel-suit', 'briefcase', 'wool-suit'],
      parts: {
        torso: 'suitWideLapel',
        legs: 'straightTrouser',
        arms: 'sleeve',
        hair: 'sidePart',
        hat: 'fedora',
        face: 'none',
        foot: 'oxford',
        propA: 'briefcase',
        propB: 'none',
      },
      colors: { garment: '#5b4b39', hat: '#463c33', shoe: '#2b241d', prop: '#4a3526' },
      gait: { speedScale: 1.05, strideScale: 0.98, bobScale: 0.95 },
      behaviors: PURPOSE,
    },
    {
      key: 'aline-social',
      label: 'A-line dress with wide-brim hat',
      tags: ['a-line-dress', 'wide-brim-hat', 'handbag', 'victory-rolls'],
      parts: {
        torso: 'aLineDress',
        legs: 'tights',
        arms: 'bare',
        hair: 'victoryRolls',
        hat: 'smallBrim',
        face: 'none',
        foot: 'pump',
        propA: 'none',
        propB: 'handbag',
      },
      colors: { garment: '#b9878d', lower: '#d8c5b4', hat: '#8e7f74', shoe: '#2d2622', propBody: '#6d4f45' },
      gait: { speedScale: 0.92, strideScale: 0.82, bobScale: 0.9 },
      behaviors: STROLL,
    },
    {
      key: 'aline-stroller',
      label: 'A-line dress on a afternoon stroll',
      tags: ['a-line-dress', 'printed-dress'],
      parts: {
        torso: 'aLineDress',
        legs: 'bare',
        arms: 'bare',
        hair: 'pageboy',
        hat: 'none',
        face: 'none',
        foot: 'pump',
        propA: 'none',
        propB: 'none',
      },
      colors: { garment: '#7d9fa6', shoe: '#33302b' },
      gait: { speedScale: 0.95, strideScale: 0.86, bobScale: 0.95 },
      behaviors: STROLL,
    },
    {
      key: 'war-worker',
      label: 'Utility-jacket war worker',
      tags: ['newsboy-cap', 'utility-jacket', 'workwear'],
      parts: {
        torso: 'workJacket',
        legs: 'straightTrouser',
        arms: 'sleeve',
        hair: 'crewCut',
        hat: 'newsboyCap',
        face: 'none',
        foot: 'chukka',
        propA: 'none',
        propB: 'none',
      },
      colors: { garment: '#6d6a53', lower: '#4f4b3d', hat: '#4c4738', shoe: '#2c2820' },
      gait: { speedScale: 1.12, strideScale: 1.08, bobScale: 1.1 },
      behaviors: PURPOSE,
    },
    {
      key: 'aline-shopgirl',
      label: 'Shopgirl in printed A-line dress',
      tags: ['a-line-dress', 'handbag', 'printed-dress'],
      parts: {
        torso: 'aLineDress',
        legs: 'tights',
        arms: 'bare',
        hair: 'longLoose',
        hat: 'none',
        face: 'none',
        foot: 'pump',
        propA: 'none',
        propB: 'handbag',
      },
      colors: { garment: '#8a9a70', lower: '#cfc4b2', shoe: '#312a24', propBody: '#7a5d4e' },
      gait: { speedScale: 0.93, strideScale: 0.84, bobScale: 0.88 },
      behaviors: LEISURE,
    },
  ],
  1965: [
    {
      key: 'mod-shift-white',
      label: 'Mod shift dress and pillbox hat',
      tags: ['mod-shift', 'pillbox-hat', 'beehive-hair'],
      parts: {
        torso: 'shiftDress',
        legs: 'tights',
        arms: 'bare',
        hair: 'beehive',
        hat: 'pillbox',
        face: 'none',
        foot: 'pump',
        propA: 'none',
        propB: 'handbag',
      },
      colors: { garment: '#f1eee4', lower: '#f4f2ea', hat: '#f6f4ee', shoe: '#282521', propBody: '#d9d2c4' },
      gait: { speedScale: 0.95, strideScale: 0.84, bobScale: 0.95 },
      behaviors: STROLL,
    },
    {
      key: 'go-go-dancer',
      label: 'Go-go boots and bold shift',
      tags: ['mod-shift', 'go-go-boots', 'pillbox-hat'],
      parts: {
        torso: 'shiftDress',
        legs: 'goGoBoot',
        arms: 'bare',
        hair: 'bouffant',
        hat: 'pillbox',
        face: 'none',
        foot: 'pump',
        propA: 'none',
        propB: 'none',
      },
      colors: { garment: '#e85aa0', lower: '#f6f4ee', hat: '#f2efe6', shoe: '#f6f4ee' },
      gait: { speedScale: 1.06, strideScale: 0.9, bobScale: 1.05 },
      behaviors: LEISURE,
    },
    {
      key: 'narrow-suit-beat',
      label: 'Narrow-lapel suit with record bag',
      tags: ['narrow-suit', 'record-bag', 'mod-mop'],
      parts: {
        torso: 'suitNarrow',
        legs: 'slimTrouser',
        arms: 'sleeve',
        hair: 'modMop',
        hat: 'none',
        face: 'none',
        foot: 'loafer',
        propA: 'none',
        propB: 'recordBag',
      },
      colors: { garment: '#454a56', lower: '#3f4450', shoe: '#1f1d1b', propBody: '#212327' },
      gait: { speedScale: 1.04, strideScale: 0.96, bobScale: 1 },
      behaviors: WALK_HEAVY,
    },
    {
      key: 'turtleneck-intellectual',
      label: 'Turtleneck minimalists with record bag',
      tags: ['turtleneck', 'record-bag', 'minimal-mod'],
      parts: {
        torso: 'turtleneck',
        legs: 'slimTrouser',
        arms: 'sleeve',
        hair: 'sidePart',
        hat: 'none',
        face: 'none',
        foot: 'loafer',
        propA: 'none',
        propB: 'recordBag',
      },
      colors: { garment: '#23252b', lower: '#33363e', shoe: '#1d1b19', propBody: '#2b2d31' },
      gait: { speedScale: 0.98, strideScale: 0.9, bobScale: 0.92 },
      behaviors: PURPOSE,
    },
    {
      key: 'pillbox-lady',
      label: 'Mint shift with pillbox hat',
      tags: ['mod-shift', 'pillbox-hat', 'handbag'],
      parts: {
        torso: 'shiftDress',
        legs: 'tights',
        arms: 'bare',
        hair: 'bouffant',
        hat: 'pillbox',
        face: 'none',
        foot: 'pump',
        propA: 'none',
        propB: 'handbag',
      },
      colors: { garment: '#8ed3c6', lower: '#eee9dd', hat: '#f4f1e8', shoe: '#2a2622', propBody: '#c8b79a' },
      gait: { speedScale: 0.94, strideScale: 0.83, bobScale: 0.9 },
      behaviors: STROLL,
    },
    {
      key: 'mod-trainee',
      label: 'Teal narrow suit mod trainee',
      tags: ['narrow-suit', 'mod-mop'],
      parts: {
        torso: 'suitNarrow',
        legs: 'slimTrouser',
        arms: 'sleeve',
        hair: 'modMop',
        hat: 'none',
        face: 'none',
        foot: 'loafer',
        propA: 'none',
        propB: 'none',
      },
      colors: { garment: '#3f6f6b', lower: '#3a4a50', shoe: '#22201e' },
      gait: { speedScale: 1.08, strideScale: 1, bobScale: 1.05 },
      behaviors: WALK_HEAVY,
    },
  ],
  1985: [
    {
      key: 'power-executive',
      label: 'Power-suit executive',
      tags: ['power-shoulders', 'big-hair', 'briefcase', 'power-suit'],
      parts: {
        torso: 'powerSuit',
        legs: 'powerTrouser',
        arms: 'sleeve',
        hair: 'bigHair',
        hat: 'none',
        face: 'none',
        foot: 'loafer',
        propA: 'briefcase',
        propB: 'none',
      },
      colors: { garment: '#3a55c8', lower: '#3550be', shoe: '#1e1c1a', prop: '#2e2a26' },
      gait: { speedScale: 1.05, strideScale: 1, bobScale: 1.05 },
      behaviors: PURPOSE,
    },
    {
      key: 'aerobics-tracksuit',
      label: 'Neon tracksuit carrying a boombox',
      tags: ['tracksuit', 'boombox', 'big-hair', 'neon-sport'],
      parts: {
        torso: 'tracksuit',
        legs: 'trackPant',
        arms: 'sleeve',
        hair: 'bigHair',
        hat: 'none',
        face: 'none',
        foot: 'sneaker',
        propA: 'boombox',
        propB: 'none',
      },
      colors: { garment: '#ff2e88', lower: '#ff4f97', shoe: '#f2f0ea', prop: '#565b66' },
      gait: { speedScale: 1.14, strideScale: 1.08, bobScale: 1.15 },
      behaviors: LEISURE,
    },
    {
      key: 'leather-rocker',
      label: 'Leather jacket over stone-wash denim',
      tags: ['leather-jacket', 'stone-wash-denim', 'feathered-hair'],
      parts: {
        torso: 'leatherJacket',
        legs: 'baggyJean',
        arms: 'sleeve',
        hair: 'feathered',
        hat: 'none',
        face: 'none',
        foot: 'chukka',
        propA: 'none',
        propB: 'none',
      },
      colors: { garment: '#1d1c1b', lower: '#7b8ca4', shoe: '#26221f' },
      gait: { speedScale: 1.08, strideScale: 1.02, bobScale: 1.05 },
      behaviors: WALK_HEAVY,
    },
    {
      key: 'power-skirt-suit',
      label: 'Power skirt suit',
      tags: ['power-shoulders', 'big-hair', 'pencil-skirt'],
      parts: {
        torso: 'powerDress',
        legs: 'tights',
        arms: 'sleeve',
        hair: 'bigHair',
        hat: 'none',
        face: 'none',
        foot: 'pump',
        propA: 'none',
        propB: 'handbag',
      },
      colors: { garment: '#c8347f', lower: '#2c2a30', shoe: '#211f1d', propBody: '#7b3f52' },
      gait: { speedScale: 0.97, strideScale: 0.87, bobScale: 0.92 },
      behaviors: STROLL,
    },
    {
      key: 'tracksuit-jogger',
      label: 'Cyan tracksuit jogger',
      tags: ['tracksuit', 'bright-colors', 'sneakers'],
      parts: {
        torso: 'tracksuit',
        legs: 'trackPant',
        arms: 'sleeve',
        hair: 'curls',
        hat: 'none',
        face: 'none',
        foot: 'sneaker',
        propA: 'none',
        propB: 'none',
      },
      colors: { garment: '#2fd4ff', lower: '#37d9ff', shoe: '#f4f4f0' },
      gait: { speedScale: 1.16, strideScale: 1.1, bobScale: 1.18 },
      behaviors: LEISURE,
    },
    {
      key: 'street-dancer',
      label: 'Oversized tee street dancer',
      tags: ['oversized-tee', 'stone-wash-denim', 'street-dance'],
      parts: {
        torso: 'oversizedTee',
        legs: 'baggyJean',
        arms: 'bare',
        hair: 'curls',
        hat: 'none',
        face: 'none',
        foot: 'sneaker',
        propA: 'none',
        propB: 'recordBag',
      },
      colors: { garment: '#e8d44d', lower: '#5f6f85', shoe: '#f0eee8', propBody: '#23252a' },
      gait: { speedScale: 1.1, strideScale: 1.05, bobScale: 1.1 },
      behaviors: WALK_HEAVY,
    },
  ],
  2005: [
    {
      key: 'campus-hoodie',
      label: 'Hoodie over low-rise denim',
      tags: ['hoodie', 'low-rise-denim', 'flip-phone', 'messenger-bag'],
      parts: {
        torso: 'hoodie',
        legs: 'lowRiseDenim',
        arms: 'sleeve',
        hair: 'spiky',
        hat: 'none',
        face: 'none',
        foot: 'sneaker',
        propA: 'flipPhone',
        propB: 'messengerBag',
      },
      colors: { garment: '#8d9096', lower: '#4d6d95', shoe: '#f1f0ec', prop: '#2a2d33', propBody: '#3f4a5a' },
      gait: { speedScale: 1.02, strideScale: 0.95, bobScale: 1 },
      behaviors: WALK_HEAVY,
    },
    {
      key: 'low-rise-tee',
      label: 'Oversized tee and low-rise denim',
      tags: ['oversized-tee', 'low-rise-denim'],
      parts: {
        torso: 'oversizedTee',
        legs: 'lowRiseDenim',
        arms: 'bare',
        hair: 'longLoose',
        hat: 'none',
        face: 'none',
        foot: 'sneaker',
        propA: 'none',
        propB: 'none',
      },
      colors: { garment: '#c9c2b4', lower: '#5b7ba6', shoe: '#f2f1ed' },
      gait: { speedScale: 1, strideScale: 0.93, bobScale: 0.95 },
      behaviors: STROLL,
    },
    {
      key: 'baggy-skater',
      label: 'Baggy-jean skater',
      tags: ['baggy-jeans', 'messenger-bag', 'sneakers'],
      parts: {
        torso: 'oversizedTee',
        legs: 'baggyJean',
        arms: 'bare',
        hair: 'sidePart',
        hat: 'none',
        face: 'none',
        foot: 'sneaker',
        propA: 'none',
        propB: 'messengerBag',
      },
      colors: { garment: '#3a5f8a', lower: '#6a7686', shoe: '#eceae4', propBody: '#4a5462' },
      gait: { speedScale: 1.1, strideScale: 1.06, bobScale: 1.12 },
      behaviors: LEISURE,
    },
    {
      key: 'zip-hoodie-commuter',
      label: 'Navy hoodie and cargo commuter',
      tags: ['hoodie', 'flip-phone', 'messenger-bag', 'cargo-pants'],
      parts: {
        torso: 'hoodie',
        legs: 'cargo',
        arms: 'sleeve',
        hair: 'crewCut',
        hat: 'none',
        face: 'none',
        foot: 'sneaker',
        propA: 'flipPhone',
        propB: 'messengerBag',
      },
      colors: { garment: '#2f4f6f', lower: '#5c604f', shoe: '#33302b', prop: '#2a2d33', propBody: '#39414d' },
      gait: { speedScale: 1.06, strideScale: 1, bobScale: 1.02 },
      behaviors: PURPOSE,
    },
    {
      key: 'denim-trucker',
      label: 'Denim jacket, double denim',
      tags: ['denim-jacket', 'low-rise-denim', 'flip-phone'],
      parts: {
        torso: 'workJacket',
        legs: 'lowRiseDenim',
        arms: 'sleeve',
        hair: 'sidePart',
        hat: 'none',
        face: 'none',
        foot: 'sneaker',
        propA: 'flipPhone',
        propB: 'none',
      },
      colors: { garment: '#54739b', lower: '#4b6a8e', shoe: '#e9e7e1', prop: '#2a2d33' },
      gait: { speedScale: 1.04, strideScale: 0.97, bobScale: 1 },
      behaviors: WALK_HEAVY,
    },
    {
      key: 'off-duty-tank',
      label: 'Off-duty tank and low-rise denim',
      tags: ['low-rise-denim', 'tank-top', 'tote'],
      parts: {
        torso: 'tankTop',
        legs: 'lowRiseDenim',
        arms: 'bare',
        hair: 'topBun',
        hat: 'none',
        face: 'none',
        foot: 'sneaker',
        propA: 'tote',
        propB: 'none',
      },
      colors: { garment: '#e5e0d5', lower: '#4a6788', shoe: '#f2f1ed', prop: '#e2d8c2' },
      gait: { speedScale: 0.98, strideScale: 0.9, bobScale: 0.92 },
      behaviors: STROLL,
    },
  ],
  2025: [
    {
      key: 'gym-athleisure',
      label: 'Athleisure set with mask and earbuds',
      tags: ['athleisure', 'face-mask', 'earbuds', 'phone-in-hand', 'leggings'],
      parts: {
        torso: 'athleisureTop',
        legs: 'legging',
        arms: 'sleeve',
        hair: 'topBun',
        hat: 'none',
        face: 'maskEarbuds',
        foot: 'sneaker',
        propA: 'phoneInHand',
        propB: 'none',
      },
      colors: { garment: '#24272c', lower: '#24272c', shoe: '#e8e8e4', prop: '#1c1e22' },
      gait: { speedScale: 1.08, strideScale: 1, bobScale: 1.05 },
      behaviors: WALK_HEAVY,
    },
    {
      key: 'tech-fleece-local',
      label: 'Tech fleece with canvas tote',
      tags: ['tech-fleece', 'tote-bag', 'face-mask', 'joggers'],
      parts: {
        torso: 'techFleece',
        legs: 'jogger',
        arms: 'sleeve',
        hair: 'crewCut',
        hat: 'none',
        face: 'mask',
        foot: 'sneaker',
        propA: 'tote',
        propB: 'none',
      },
      colors: { garment: '#9aa3ad', lower: '#8f98a2', shoe: '#f0efeb', prop: '#e4dac4' },
      gait: { speedScale: 1, strideScale: 0.94, bobScale: 0.95 },
      behaviors: STROLL,
    },
    {
      key: 'morning-runner',
      label: 'Runner with earbuds',
      tags: ['athleisure', 'earbuds', 'running-shorts', 'sneakers'],
      parts: {
        torso: 'tankTop',
        legs: 'shorts',
        arms: 'bare',
        hair: 'topBun',
        hat: 'none',
        face: 'earbuds',
        foot: 'sneaker',
        propA: 'none',
        propB: 'none',
      },
      colors: { garment: '#d94f7a', lower: '#2b2f36', shoe: '#f4f3ef' },
      gait: { speedScale: 1.22, strideScale: 1.14, bobScale: 1.25 },
      behaviors: PURPOSE,
    },
    {
      key: 'remote-worker',
      label: 'Sage athleisure remote worker',
      tags: ['athleisure', 'tote-bag', 'face-mask', 'joggers'],
      parts: {
        torso: 'athleisureTop',
        legs: 'jogger',
        arms: 'sleeve',
        hair: 'longLoose',
        hat: 'none',
        face: 'mask',
        foot: 'sneaker',
        propA: 'tote',
        propB: 'none',
      },
      colors: { garment: '#b6c9a8', lower: '#a9bda0', shoe: '#efeee9', prop: '#e6dcc6' },
      gait: { speedScale: 0.99, strideScale: 0.92, bobScale: 0.92 },
      behaviors: LEISURE,
    },
    {
      key: 'street-casual',
      label: 'Casual tee with phone and earbuds',
      tags: ['phone-in-hand', 'earbuds', 'leggings'],
      parts: {
        torso: 'oversizedTee',
        legs: 'legging',
        arms: 'bare',
        hair: 'spiky',
        hat: 'none',
        face: 'earbuds',
        foot: 'sneaker',
        propA: 'phoneInHand',
        propB: 'none',
      },
      colors: { garment: '#d8d3c8', lower: '#3c4046', shoe: '#f2f1ed', prop: '#1c1e22' },
      gait: { speedScale: 1.06, strideScale: 0.98, bobScale: 1.02 },
      behaviors: STROLL,
    },
    {
      key: 'mask-commuter',
      label: 'Masked tech-fleece commuter',
      tags: ['face-mask', 'phone-in-hand', 'tech-fleece'],
      parts: {
        torso: 'techFleece',
        legs: 'jogger',
        arms: 'sleeve',
        hair: 'sidePart',
        hat: 'none',
        face: 'mask',
        foot: 'sneaker',
        propA: 'phoneInHand',
        propB: 'handbag',
      },
      colors: { garment: '#31363d', lower: '#2d3238', shoe: '#e6e5e1', prop: '#1c1e22', propBody: '#5a4f47' },
      gait: { speedScale: 1.03, strideScale: 0.96, bobScale: 1 },
      behaviors: PURPOSE,
    },
  ],
});

/** Per-era outfit vocabulary the acceptance criteria require at a glance. */
export const ERA_REQUIRED_TAGS: Readonly<Record<EraYear, readonly string[]>> = Object.freeze({
  1945: ['fedora', 'wide-lapel-suit', 'a-line-dress', 'newspaper-bundle'],
  1965: ['mod-shift', 'pillbox-hat', 'beehive-hair', 'record-bag'],
  1985: ['power-shoulders', 'tracksuit', 'boombox', 'leather-jacket', 'big-hair'],
  2005: ['low-rise-denim', 'hoodie', 'flip-phone', 'messenger-bag'],
  2025: ['athleisure', 'face-mask', 'earbuds', 'phone-in-hand', 'tote-bag'],
});

// ---------------------------------------------------------------------------
// Cell resolution
// ---------------------------------------------------------------------------

/** The archetype a person occupies in a given era (index stays stable). */
export function archetypeAt(era: EraYear, archetypeIndex: number): CrowdArchetype {
  const list = ERA_ARCHETYPES[era];
  return list[archetypeIndex % list.length];
}

/** Build the cell list an archetype uses in one grid slot. */
export function cellsForSlot(archetype: CrowdArchetype, slot: GridSlot): Cell[] {
  const parts = archetype.parts;
  switch (slot) {
    case 'torso':
      return TORSO_CELLS[parts.torso]();
    case 'legL':
    case 'legR':
      return LEG_CELLS[parts.legs]();
    case 'armL':
    case 'armR':
      return ARM_CELLS[parts.arms]();
    case 'hair':
      return HAIR_CELLS[parts.hair]();
    case 'hat':
      return parts.hat === 'none'
        ? degenerateCells(SLOT_CELL_KINDS.hat)
        : HAT_CELLS[parts.hat]();
    case 'face':
      return parts.face === 'none'
        ? degenerateCells(SLOT_CELL_KINDS.face)
        : FACE_CELLS[parts.face]();
    case 'footL':
    case 'footR':
      return FOOT_CELLS[parts.foot]();
    case 'propA':
      return parts.propA === 'none'
        ? degenerateCells(SLOT_CELL_KINDS.propA)
        : PROP_HAND_CELLS[parts.propA]();
    case 'propB':
      return parts.propB === 'none'
        ? degenerateCells(SLOT_CELL_KINDS.propB)
        : PROP_BODY_CELLS[parts.propB]();
    default: {
      const exhaustive: never = slot;
      throw new Error(`Unknown grid slot: ${String(exhaustive)}`);
    }
  }
}

/** All five eras' cells for one (slot, archetype) pair, ready to morph. */
export function eraCellsForSlot(
  slot: GridSlot,
  archetypeIndex: number,
): Record<EraYear, Cell[]> {
  return {
    1945: cellsForSlot(archetypeAt(1945, archetypeIndex), slot),
    1965: cellsForSlot(archetypeAt(1965, archetypeIndex), slot),
    1985: cellsForSlot(archetypeAt(1985, archetypeIndex), slot),
    2005: cellsForSlot(archetypeAt(2005, archetypeIndex), slot),
    2025: cellsForSlot(archetypeAt(2025, archetypeIndex), slot),
  };
}

// ---------------------------------------------------------------------------
// Color resolution (era palette + archetype + deterministic person jitter)
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function toHex2(n: number): string {
  const v = Math.max(0, Math.min(255, Math.round(n)));
  return v.toString(16).padStart(2, '0');
}

/** Linear sRGB mix of two hex colors. */
export function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const k = Math.max(0, Math.min(1, t));
  return `#${toHex2(ca[0] + (cb[0] - ca[0]) * k)}${toHex2(ca[1] + (cb[1] - ca[1]) * k)}${toHex2(
    ca[2] + (cb[2] - ca[2]) * k,
  )}`;
}

/** Deterministic [-1, 1] noise from an integer seed (no allocation). */
function hashNoise(seed: number): number {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return ((x >>> 0) / 4294967296) * 2 - 1;
}

function slotSeed(slot: string): number {
  let h = 0;
  for (let i = 0; i < slot.length; i++) h = (h * 31 + slot.charCodeAt(i)) | 0;
  return h;
}

/** Per-person, per-slot, per-era tonal jitter so no two garments match exactly. */
export function jitterHex(hex: string, seed: number, amount = 12): string {
  const [r, g, b] = hexToRgb(hex);
  return `#${toHex2(r + hashNoise(seed) * amount)}${toHex2(
    g + hashNoise(seed + 0x9e37) * amount,
  )}${toHex2(b + hashNoise(seed + 0x85eb) * amount)}`;
}

/** The era fabric swatch color from the shared material palettes. */
export function eraFabricColor(era: EraYear): string {
  return ProceduralGfxLibrary.getMaterialSwatch(era, 'fabric').color;
}

const SLOT_PALETTE_MIX: Readonly<Partial<Record<FigureSlot, number>>> = Object.freeze({
  torso: 0.18,
  armL: 0.18,
  armR: 0.18,
  legL: 0.18,
  legR: 0.18,
  hat: 0.14,
  footL: 0.12,
  footR: 0.12,
  propA: 0.1,
  propB: 0.1,
});

/** Identity inputs color resolution needs for one pedestrian. */
export interface OutfitIdentity {
  readonly index: number;
  readonly archetypeIndex: number;
  readonly skinTone: string;
  readonly hairTone: string;
}

/**
 * Resolve the instance color of one slot for one pedestrian in one era:
 * skin/hair tones are personal constants; garment colors blend the
 * archetype's era-true hue with the shared era fabric swatch, then take a
 * deterministic per-person jitter. Pure and exported so tests can recompute
 * the exact expected instance color from the real palette library.
 */
export function resolveOutfitColor(id: OutfitIdentity, era: EraYear, slot: FigureSlot): string {
  if (slot === 'head' || slot === 'handL' || slot === 'handR') return id.skinTone;
  if (slot === 'hair') return id.hairTone;
  if (slot === 'face') return FACE_ACCESSORY_COLOR;

  const arch = archetypeAt(era, id.archetypeIndex);
  const parts = arch.parts;

  if (slot === 'armL' || slot === 'armR') {
    if (ARM_COLOR_ROLE[parts.arms] === 'skin') return id.skinTone;
  }
  if (slot === 'legL' || slot === 'legR') {
    if (LEG_COLOR_ROLE[parts.legs] === 'skin') return id.skinTone;
  }

  let base: string;
  let mix = 0.15;
  switch (slot) {
    case 'torso':
      base = arch.colors.garment;
      mix = SLOT_PALETTE_MIX.torso as number;
      break;
    case 'armL':
    case 'armR':
      base = arch.colors.garment;
      mix = SLOT_PALETTE_MIX.armL as number;
      break;
    case 'legL':
    case 'legR':
      base = arch.colors.lower ?? arch.colors.garment;
      mix = SLOT_PALETTE_MIX.legL as number;
      break;
    case 'hat':
      base = arch.colors.hat ?? arch.colors.garment;
      mix = SLOT_PALETTE_MIX.hat as number;
      break;
    case 'footL':
    case 'footR':
      base = arch.colors.shoe;
      mix = SLOT_PALETTE_MIX.footL as number;
      break;
    case 'propA':
      base = arch.colors.prop ?? PROP_DEFAULT_COLORS[parts.propA] ?? '#ffffff';
      mix = SLOT_PALETTE_MIX.propA as number;
      break;
    case 'propB':
      base = arch.colors.propBody ?? PROP_DEFAULT_COLORS[parts.propB] ?? '#ffffff';
      mix = SLOT_PALETTE_MIX.propB as number;
      break;
    default:
      base = arch.colors.garment;
  }

  const paletteColor = eraFabricColor(era);
  const tinted = mixHex(base, paletteColor, mix);
  const seed =
    id.index * 131 + slotSeed(slot) * 17 + ERA_ORDER[era] * 7 + id.archetypeIndex * 3 + 1;
  return jitterHex(tinted, seed, slot === 'propA' || slot === 'propB' ? 10 : 13);
}

// ---------------------------------------------------------------------------
// Per-person crowd traits
// ---------------------------------------------------------------------------

const AGE_SPEED: Readonly<Record<AgeGroup, readonly [number, number]>> = Object.freeze({
  child: [1.05, 1.4],
  adult: [1.0, 1.5],
  senior: [0.7, 0.98],
});

const AGE_HEIGHT: Readonly<Record<AgeGroup, readonly [number, number]>> = Object.freeze({
  child: [1.15, 1.38],
  adult: [1.57, 1.88],
  senior: [1.5, 1.74],
});

export interface CrowdTraits extends OutfitIdentity {
  readonly heightM: number;
  readonly ageGroup: AgeGroup;
  /** Open-sidewalk cruise speed in m/s. */
  readonly cruiseSpeed: number;
  /** Meters per full gait cycle (two steps). */
  readonly strideLength: number;
  /** Leg swing amplitude in radians. */
  readonly strideAmp: number;
  /** Arm swing amplitude in radians. */
  readonly armAmp: number;
  readonly bobAmp: number;
  readonly swayAmp: number;
  /** Constant forward lean in radians (seniors stoop). */
  readonly leanBase: number;
  /** Static perpendicular offset from the path centerline, meters (<= 0.3). */
  readonly lateralOffset: number;
  readonly behaviors: BehaviorWeights;
}

function ageForIndex(index: number): AgeGroup {
  const m = index % 10;
  if (m < 2) return 'child';
  if (m >= 8) return 'senior';
  return 'adult';
}

/**
 * Deterministic crowd traits: stable archetype slot, round-robin skin and
 * hair tones, age distribution with child/senior presence, and gait
 * parameters varied by age, archetype, and PRNG draws.
 */
export function createCrowdTraits(count: number, seed: number): CrowdTraits[] {
  const rng = ProceduralGfxLibrary.createPRNG(seed);
  const n = Math.max(1, count);
  const skinRot = rng.rangeInt(0, SKIN_TONES.length - 1);
  const hairRot = rng.rangeInt(0, HAIR_TONES.length - 1);
  const traits: CrowdTraits[] = [];

  for (let i = 0; i < n; i++) {
    const archetypeIndex = i % ARCHETYPE_SLOTS;
    const arch = archetypeAt(1945, archetypeIndex);
    const ageGroup = ageForIndex(i);
    const skinTone = SKIN_TONES[(i + skinRot) % SKIN_TONES.length];
    const hairTone = HAIR_TONES[(i * 3 + hairRot) % HAIR_TONES.length];

    const heightRange = AGE_HEIGHT[ageGroup];
    const heightM = round(rng.range(heightRange[0], heightRange[1]), 2);

    const speedRange = AGE_SPEED[ageGroup];
    const cruiseSpeed = round(
      rng.range(speedRange[0], speedRange[1]) * arch.gait.speedScale,
      3,
    );

    const strideLength = round(
      0.72 * (heightM / 1.75) * arch.gait.strideScale,
      3,
    );

    const strideAmp =
      ageGroup === 'child'
        ? round(rng.range(0.56, 0.64), 3)
        : ageGroup === 'senior'
          ? round(rng.range(0.38, 0.46), 3)
          : round(rng.range(0.46, 0.6), 3);

    traits.push({
      index: i,
      archetypeIndex,
      skinTone,
      hairTone,
      heightM,
      ageGroup,
      cruiseSpeed,
      strideLength,
      strideAmp,
      armAmp: round(strideAmp * 0.8, 3),
      bobAmp: round(0.017 * (heightM / 1.75) * arch.gait.bobScale, 4),
      swayAmp: round(0.022 * (heightM / 1.75), 4),
      leanBase: ageGroup === 'senior' ? round(rng.range(0.07, 0.11), 3) : round(rng.range(0.01, 0.04), 3),
      lateralOffset: round(rng.range(-0.3, 0.3), 3),
      behaviors: arch.behaviors,
    });
  }
  return traits;
}

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}
