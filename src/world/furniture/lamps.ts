/**
 * Era lamp posts: every lamp anchor on the BlockLayout becomes one lit
 * post whose head technology and styling age with the timeline —
 * 1945 incandescent globes, 1965/1985 sodium/fluorescent cobra heads and
 * 2005/2025 LED fixtures (cobra then slim LED).
 *
 * Pure parametric data (pole/arm/head geometry, colors, glow) positioned on
 * the real furniture anchors, deterministic per seed.
 */

import type { BlockLayout, Point3D } from '../layout';
import type { ColorHex, EraId } from '../../era/types';
import { deriveSeedRng } from './street';

export type LampTech = 'incandescent' | 'sodium' | 'fluorescent' | 'led';
export type LampHeadKind = 'globe' | 'cobra' | 'teardrop' | 'slim-led';
export type PoleBaseStyle = 'fluted' | 'plain' | 'concrete' | 'tapered';
export type LampArmStyle = 'gooseneck' | 'bracket' | 'cobra' | 'vertical';

export interface LampPoleSpec {
  height: number;
  baseDiameter: number;
  topDiameter: number;
  color: ColorHex;
  baseStyle: PoleBaseStyle;
  ornate: boolean;
  graffiti: boolean;
}

export interface LampArmSpec {
  style: LampArmStyle;
  length: number;
  color: ColorHex;
}

export interface LampHeadSpec {
  tech: LampTech;
  kind: LampHeadKind;
  globeCount: number;
  color: ColorHex;
  kelvin: number;
  glow: number;
  visor: boolean;
  translucent: boolean;
}

/** One lamp post placed on its anchor. */
export interface LampPostResult {
  anchorId: string;
  position: Point3D;
  facing: number;
  /** Deterministic sub-meter jitter so posts feel hand-placed. */
  jitter: { x: number; z: number };
  styleId: string;
  pole: LampPoleSpec;
  arm: LampArmSpec;
  head: LampHeadSpec;
}

interface EraLampSpec {
  tech: LampTech;
  head: LampHeadKind;
  globeCount: number;
  poleHeight: number;
  poleBaseStyle: PoleBaseStyle;
  poleColor: ColorHex;
  ornate: boolean;
  armStyle: LampArmStyle;
  armLength: number;
  bulbColor: ColorHex;
  kelvin: number;
  glow: number;
  visor: boolean;
  translucent: boolean;
  graffitiChance: number;
}

/** Lamp hardware evolved across the five timeline stops. */
const ERA_LAMP_SPECS: Record<EraId, EraLampSpec> = {
  // 1945: ornate cast-iron, single warm incandescent globe on a gooseneck.
  1945: {
    tech: 'incandescent',
    head: 'globe',
    globeCount: 1,
    poleHeight: 5.0,
    poleBaseStyle: 'fluted',
    poleColor: '#2f2a28',
    ornate: true,
    armStyle: 'gooseneck',
    armLength: 0.9,
    bulbColor: '#ffd9a2',
    kelvin: 2700,
    glow: 0.55,
    visor: false,
    translucent: true,
    graffitiChance: 0,
  },
  // 1965: tall highway-style cobra with orange sodium vapor glow.
  1965: {
    tech: 'sodium',
    head: 'cobra',
    globeCount: 1,
    poleHeight: 7.3,
    poleBaseStyle: 'plain',
    poleColor: '#4a4a4e',
    ornate: false,
    armStyle: 'cobra',
    armLength: 1.6,
    bulbColor: '#ffb347',
    kelvin: 2200,
    glow: 0.85,
    visor: true,
    translucent: false,
    graffitiChance: 0.02,
  },
  // 1985: taller cobra, cool fluorescent white, sometimes tagged.
  1985: {
    tech: 'fluorescent',
    head: 'cobra',
    globeCount: 1,
    poleHeight: 8.0,
    poleBaseStyle: 'plain',
    poleColor: '#4f4f54',
    ornate: false,
    armStyle: 'cobra',
    armLength: 1.9,
    bulbColor: '#f2f2e8',
    kelvin: 3500,
    glow: 0.9,
    visor: true,
    translucent: false,
    graffitiChance: 0.3,
  },
  // 2005: tapered LED cobra, crisp neutral-white light.
  2005: {
    tech: 'led',
    head: 'cobra',
    globeCount: 1,
    poleHeight: 8.6,
    poleBaseStyle: 'tapered',
    poleColor: '#3c3c40',
    ornate: false,
    armStyle: 'cobra',
    armLength: 2.0,
    bulbColor: '#fff4e0',
    kelvin: 4000,
    glow: 0.92,
    visor: false,
    translucent: true,
    graffitiChance: 0.1,
  },
  // 2025: slim vertical LED teardrop, smart-city cool white.
  2025: {
    tech: 'led',
    head: 'slim-led',
    globeCount: 1,
    poleHeight: 9.1,
    poleBaseStyle: 'tapered',
    poleColor: '#40444a',
    ornate: false,
    armStyle: 'vertical',
    armLength: 0.5,
    bulbColor: '#f6fbff',
    kelvin: 5000,
    glow: 1.0,
    visor: false,
    translucent: true,
    graffitiChance: 0.02,
  },
};

/**
 * Build one lamp post for every `lamp_post` anchor. Deterministic: same
 * seed → identical jitter, graffiti and styling for every anchor.
 */
export function buildLampPosts(layout: BlockLayout, era: EraId, seed: number): LampPostResult[] {
  const spec = ERA_LAMP_SPECS[era];
  const anchors = layout.getAnchorsByKind('lamp_post');
  const results: LampPostResult[] = [];

  for (const anchor of anchors) {
    const rng = deriveSeedRng(seed, `lamps:${anchor.id}`);
    const jitter = { x: rng.range(-0.05, 0.05), z: rng.range(-0.05, 0.05) };
    const graffiti = rng.chance(spec.graffitiChance);
    results.push({
      anchorId: anchor.id,
      position: anchor.position,
      facing: anchor.facing,
      jitter,
      styleId: `${spec.tech}-${spec.head}-${era}`,
      pole: {
        height: spec.poleHeight,
        baseDiameter: spec.poleBaseStyle === 'fluted' ? 0.32 : 0.28,
        topDiameter: 0.14,
        color: graffiti ? '#6b6b6e' : spec.poleColor,
        baseStyle: spec.poleBaseStyle,
        ornate: spec.ornate,
        graffiti,
      },
      arm: {
        style: spec.armStyle,
        length: spec.armLength,
        color: spec.poleColor,
      },
      head: {
        tech: spec.tech,
        kind: spec.head,
        globeCount: spec.globeCount,
        color: spec.bulbColor,
        kelvin: spec.kelvin,
        glow: spec.glow,
        visor: spec.visor,
        translucent: spec.translucent,
      },
    });
  }
  return results;
}