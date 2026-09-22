/**
 * Era-aware callout content for the composed city block.
 *
 * The navigation module owns the callout PANEL; this module owns its
 * CONTENT. `createEraCalloutProvider` returns the `CalloutContentProvider`
 * the navigation module invokes on every click-to-focus, resolving each
 * registered pickable id back to its content module and merging:
 *
 * - the current era story (year name, accent, and narrative copy owned here),
 * - real per-era content from the content modules: building treatments
 *   (`ERA_TREATMENTS` + lot massing), storefront brands/treatments
 *   (`bayInfo[year]`), vehicle fleet specs, street prop era presence, and
 *   crowd outfit labels.
 *
 * Because the year is read at click time, the SAME object raises different
 * text in different eras — looking at things reveals the time story.
 */

import type { CalloutContent, CalloutContentProvider } from '../controls/navigation';
import { nearestEraYear, type EraYear } from '../era/timeline';
import { ERA_TREATMENTS, type BuildingsModule } from './buildings/index';
import {
  isPropPresent,
  type StreetPickableDescriptor,
  type StreetPropsModule,
} from './street/index';
import type { StorefrontsModule, StorefrontTreatmentInfo } from './storefronts/index';
import type { VehiclesModule } from './vehicles/index';
import type { PedestriansModule } from './pedestrians/index';

/* -------------------------------------------------------------------------- */
/* Era story (owned by this content module)                                    */
/* -------------------------------------------------------------------------- */

/** Narrative + presentation for one era stop, used by every callout. */
export interface EraCalloutStory {
  readonly year: EraYear;
  /** Display name, matching the timeline HUD. */
  readonly name: string;
  /** Accent color, matching the timeline HUD. */
  readonly accent: string;
  /** One-line era summary — the base description of every callout. */
  readonly summary: string;
  /** What era-accurate architecture looks like on this block. */
  readonly architecture: string;
  /** What era-accurate street life looks like on this block. */
  readonly streetLife: string;
}

/** The five era stories, keyed by the shared era stops. */
export const ERA_CALLOUT_STORIES: Readonly<Record<EraYear, EraCalloutStory>> = Object.freeze({
  1945: {
    year: 1945,
    name: 'Postwar Rebuild',
    accent: '#e6b25e',
    summary: 'Soot-lined masonry, hand-painted signs, and prewar sedans rebuilding after the war.',
    architecture:
      'Steel-framed masonry blocks wear deep dentiled cornices, timber shopfronts, transom doors, and iron fire escapes.',
    streetLife:
      'Early electric lamps, construction scaffolds, and crowds in hats and long coats hurry past enamel-plate shop signs.',
  },
  1965: {
    year: 1965,
    name: 'Mid-Century Boom',
    accent: '#57d6c0',
    summary: 'Cleaned pastel masonry, chrome-trimmed sedans, and the first neon-lit diners of the boom.',
    architecture:
      'Facade bays gain pastel panel treatments, wider glass, gold-leaf transoms, and flat parapet lines under water tanks.',
    streetLife:
      'Bright new street lamps, phone booths, and shoppers in suits and shift dresses browse channel-letter shopfronts.',
  },
  1985: {
    year: 1985,
    name: 'Neon Decade',
    accent: '#ff5ea8',
    summary: 'Smog-orange afternoons, tube neon, arcade glow, and boxy traffic humming through the corner.',
    architecture:
      'Masonry darkens under soot while window air conditioners, backlit box signs, and rooftop billboards spread across the bays.',
    streetLife:
      'Pay phones and bus shelters sit under buzzing neon tubes as crowds in Members Only jackets pass muscle cars and taxis.',
  },
  2005: {
    year: 2005,
    name: 'Digital Dawn',
    accent: '#5aa9ff',
    summary: 'Crisp air, backlit plastic signage, scrolling tickers, and a mixed fleet of taxis and compacts.',
    architecture:
      'Curtain-wall glass tops rise over rebuilt storefronts with push-through letters, menu boards, and window tickers.',
    streetLife:
      'Pay stations and bus stop flags line clean paving while crowds with headsets and shopping bags cross under LED faces.',
  },
  2025: {
    year: 2025,
    name: 'Near Future',
    accent: '#a084ff',
    summary: 'Clear green-tinged skies, LED media facades, EV charging, and quiet electric traffic.',
    architecture:
      'Solar arrays and green terraces crown glass-and-steel towers whose storefronts mix LED matrices with planted fronts.',
    streetLife:
      'EV chargers and smart kiosks hum beside wifi pylons while a crowd dressed for a connected, walkable city crosses the block.',
  },
});

/** Story for any year, clamped to the nearest era stop. */
export function eraStoryFor(year: number): EraCalloutStory {
  return ERA_CALLOUT_STORIES[nearestEraYear(year)];
}

/* -------------------------------------------------------------------------- */
/* Content-module vocabularies                                                 */
/* -------------------------------------------------------------------------- */

/** Material vocabulary taken straight from the live era treatment table. */
type BuildingMaterial = (typeof ERA_TREATMENTS)[EraYear]['wallCategory'];

/** Human words for the shared gfx material categories used on facades. */
const MATERIAL_WORDS: Readonly<Record<BuildingMaterial, string>> = {
  masonryConcrete: 'painted masonry',
  metal: 'metal panel',
  glass: 'glass curtain wall',
  wood: 'timber',
  fabric: 'fabric canopy',
  paintSignage: 'hand-painted signage',
  neonEmissive: 'neon-lit trim',
  asphaltStone: 'asphalt and stone',
  grimeSoil: 'soot-worn',
};

function materialWord(category: BuildingMaterial): string {
  return MATERIAL_WORDS[category] ?? category;
}

/** `wedge-fabric` → `wedge fabric`; safe for any module string. */
function humanize(value: string): string {
  return value.replace(/[-_]/g, ' ');
}

/** One chip summarizing whichever rooftop world the era leaves behind. */
function roofLine(roof: (typeof ERA_TREATMENTS)[EraYear]['roof']): string {
  if (roof.solarArrays) return 'rooftop solar arrays';
  if (roof.greenTerrace) return 'planted green terrace';
  if (roof.hvacUnits > 0) return `rooftop: ${roof.hvacUnits} HVAC unit${roof.hvacUnits > 1 ? 's' : ''}`;
  if (roof.waterTanks > 0) return `rooftop: ${roof.waterTanks} water tank${roof.waterTanks > 1 ? 's' : ''}`;
  if (roof.satelliteDishes > 0) return `rooftop dishes ×${roof.satelliteDishes}`;
  if (roof.billboard) return 'rooftop billboard rig';
  return 'working brick roof';
}

/* -------------------------------------------------------------------------- */
/* Provider                                                                    */
/* -------------------------------------------------------------------------- */

/** One storefront row module, keyed by the row id embedded in pickable ids. */
export interface StorefrontRowSource {
  /** Row id, e.g. `south-line-9-run-0`. */
  readonly id: string;
  /** The storefronts module mounted on that row. */
  readonly module: StorefrontsModule;
}

/** Everything the provider needs to turn a pickable id into era copy. */
export interface EraCalloutSources {
  /** Current timeline year (read at click time — this is the era awareness). */
  currentYear(): EraYear;
  readonly buildings: BuildingsModule;
  readonly storefrontRows: readonly StorefrontRowSource[];
  readonly vehicles: VehiclesModule;
  readonly street: StreetPropsModule;
  readonly crowd: PedestriansModule;
}

/** Split `storefront:<piece>@<rowId>` into its piece id and row id. */
function splitStorefrontId(id: string): { pieceId: string; rowId: string } | null {
  const at = id.lastIndexOf('@');
  if (at === -1) return null;
  return { pieceId: id.slice(0, at), rowId: id.slice(at + 1) };
}

/** Content for one storefront piece, era-aware via `bayInfo[year]`. */
function storefrontContent(
  pieceId: string,
  row: StorefrontRowSource,
  story: EraCalloutStory,
): CalloutContent {
  const year = story.year;
  const bayInfo = row.module.bayInfo;
  const bayMatch = /bay-(\d+)$/.exec(pieceId);
  const treatmentsFor = (): StorefrontTreatmentInfo | null => {
    if (bayMatch) {
      const info = bayInfo.find((bay) => bay.id === `bay-${bayMatch[1]}`);
      return info ? info.treatments[year] : null;
    }
    return bayInfo.length > 0 ? bayInfo[0].treatments[year] : null;
  };
  const treatment = treatmentsFor();

  if (bayMatch && treatment) {
    const info = bayInfo.find((bay) => bay.id === `bay-${bayMatch[1]}`);
    return {
      title: `${treatment.brand} storefront`,
      eyebrow: `${year} · ${story.name}`,
      description:
        `“${treatment.tagline}” ${story.summary} In ${year} this bay wears a ` +
        `${humanize(treatment.fasciaSign)} fascia sign over a ${humanize(treatment.awning)} ` +
        `treatment with a ${humanize(treatment.windowDisplay)} window display.`,
      facts: [
        `fascia: ${humanize(treatment.fasciaSign)}`,
        `awning: ${humanize(treatment.awning)}`,
        `window: ${humanize(treatment.windowDisplay)}`,
        treatment.bladeSign ? `blade sign: ${humanize(treatment.bladeSign)}` : `transom: ${humanize(treatment.transomSign)}`,
        info ? `${info.x.toFixed(0)}, ${info.z.toFixed(0)} on the block grid` : 'ground-floor bay',
      ].filter((fact): fact is string => fact !== null),
      accent: story.accent,
    };
  }

  // Row-level pieces: poster wall, billboards, kiosk, newsstand.
  const title = pieceId.includes('poster')
    ? 'Poster wall'
    : pieceId.includes('billboard-rooftop')
      ? 'Rooftop billboard'
      : pieceId.includes('billboard-wall')
        ? 'Wall billboard'
        : pieceId.includes('kiosk')
          ? 'Advertising kiosk'
          : pieceId.includes('newsstand')
            ? 'Newsstand rack'
            : 'Street furniture';
  const eraProp = pieceId.includes('kiosk')
    ? treatment?.kiosk
    : pieceId.includes('newsstand')
      ? treatment?.newsstand
      : treatment?.billboard;

  return {
    title,
    eyebrow: `${year} · ${story.name}`,
    description: `${story.streetLife} In ${year} this ${humanize(title.toLowerCase())} carries ${
      eraProp ? humanize(eraProp) : 'the era’s campaign'
    } artwork.`,
    facts: [
      eraProp ? `artwork: ${humanize(eraProp)}` : `era: ${year}`,
      treatment ? `bay brand: ${treatment.brand}` : 'row-level signage',
      'morphs with the signage stage',
    ],
    accent: story.accent,
  };
}

/**
 * Create the era-aware callout provider wired into the navigation module.
 * The same descriptor returns different content as the year changes because
 * the year is resolved at click time.
 */
export function createEraCalloutProvider(sources: EraCalloutSources): CalloutContentProvider {
  return (descriptor): CalloutContent => {
    const story = eraStoryFor(sources.currentYear());
    const year = story.year;
    const base = {
      eyebrow: `${year} · ${story.name}`,
      accent: story.accent,
    };

    if (descriptor.id.startsWith('building:')) {
      const building = sources.buildings.pickables.find((pick) => pick.id === descriptor.id);
      const record = sources.buildings.buildings.find((entry) => entry.id === building?.buildingId);
      if (building && record) {
        const treatment = ERA_TREATMENTS[year];
        const bayCount = record.bays.length;
        return {
          title: building.buildingName,
          ...base,
          description:
            `${story.architecture} In ${year}, ${building.buildingName} wears ` +
            `${materialWord(treatment.wallCategory)} walls with ${materialWord(treatment.topCategory)} ` +
            `upper stories and ${humanize(treatment.awning)} shopfront hoods.`,
          facts: [
            `${year}: ${Math.round(record.lot.massing[year])} m to the roof`,
            `${bayCount} storefront bay slots`,
            `${treatment.window.rows}×${treatment.window.columns}-pane windows`,
            treatment.fireEscape ? 'iron fire escapes' : 'no fire escapes',
            roofLine(treatment.roof),
            record.lot.ghostSign && year === 1945 ? '1945 ghost sign overhead' : null,
          ].filter((fact): fact is string => fact !== null),
        };
      }
    }

    if (descriptor.id.startsWith('storefront:')) {
      const split = splitStorefrontId(descriptor.id);
      const row = split ? sources.storefrontRows.find((entry) => entry.id === split.rowId) : undefined;
      if (split && row) return storefrontContent(split.pieceId, row, story);
    }

    if (descriptor.id.startsWith('vehicle:')) {
      const vehicle = sources.vehicles.describePick(descriptor.object);
      if (vehicle) {
        return {
          title: vehicle.title,
          ...base,
          description: `${vehicle.description} ${story.streetLife}`,
          facts: [
            ...vehicle.facts,
            Number(vehicle.eyebrow) === year
              ? `${year} fleet standard`
              : `first rolled in ${vehicle.eyebrow}, still running in ${year}`,
          ],
        };
      }
    }

    if (descriptor.id.startsWith('street:')) {
      const prop: StreetPickableDescriptor | undefined = sources.street.pickables.find(
        (pick) => pick.id === descriptor.id,
      );
      if (prop) {
        const present = isPropPresent(prop.kind, year);
        return {
          title: prop.label,
          ...base,
          description: `${story.streetLife} ${present ? 'This prop belongs' : 'This prop does not belong'} to the ${year} street.`,
          facts: [
            `prop: ${prop.kind.replace(/([A-Z])/g, ' $1').toLowerCase()}`,
            present ? `standing in ${year}` : `absent in ${year}`,
            `common in ${prop.eras.join(', ')}`,
          ],
        };
      }
    }

    if (descriptor.id.startsWith('crowd:')) {
      const stats = sources.crowd.getStats();
      const representatives = sources.crowd
        .getPickables()
        .filter((pick) => pick.representative)
        .slice(0, 2);
      return {
        title: 'The crowd',
        ...base,
        description: `${story.streetLife} Every walker is dressed for ${year}.`,
        facts: [
          `${stats.pedestrians} pedestrians`,
          ...representatives.map((pick) => pick.archetypeLabel),
          `outfits morph in the crowd stage`,
        ],
      };
    }

    return {
      title: descriptor.id,
      ...base,
      description: story.summary,
    };
  };
}
