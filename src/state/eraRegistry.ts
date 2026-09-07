import { EraMeta } from '../types/era';
import { EraYear } from '../types/city';

/**
 * EraRegistry: typed metadata per canonical era.
 *
 * Provides lookup by year and an ordered list of all five eras. This is the
 * single source of truth for era labels and theming hints consumed by the
 * timeline slider and placeholder renderers.
 */
export interface EraRegistry {
  /** All five eras in ascending order. */
  readonly eras: readonly EraMeta[];
  /** Look up metadata for a year. Throws if the year is not canonical. */
  get(year: EraYear): EraMeta;
  /** Look up metadata for a year, returning undefined if unknown. */
  find(year: number): EraMeta | undefined;
}

const ERA_META: readonly EraMeta[] = Object.freeze([
  {
    year: 1945,
    label: '1945',
    description: 'Post-war: brick, factories, early autos.',
    accentColor: '#b08968',
    tags: Object.freeze(['post-war', 'brick', 'industrial']),
  },
  {
    year: 1965,
    label: '1965',
    description: 'Mid-century modern boom.',
    accentColor: '#d4a373',
    tags: Object.freeze(['mid-century', 'modern', 'boom']),
  },
  {
    year: 1985,
    label: '1985',
    description: 'Neon and glass decade.',
    accentColor: '#7f9cf5',
    tags: Object.freeze(['neon', 'glass', 'retro']),
  },
  {
    year: 2005,
    label: '2005',
    description: 'Digital signage, glass towers.',
    accentColor: '#38bdf8',
    tags: Object.freeze(['digital', 'glass', 'contemporary']),
  },
  {
    year: 2025,
    label: '2025',
    description: 'Modern mixed-use, LED, sleek facades.',
    accentColor: '#a3e635',
    tags: Object.freeze(['modern', 'led', 'mixed-use']),
  },
]);

function createEraRegistry(): EraRegistry {
  const byYear = new Map<EraYear, EraMeta>();
  for (const meta of ERA_META) byYear.set(meta.year, meta);

  return {
    eras: ERA_META,
    get(year: EraYear): EraMeta {
      const meta = byYear.get(year);
      if (!meta) {
        throw new Error(`Unknown era year: ${year}`);
      }
      return meta;
    },
    find(year: number): EraMeta | undefined {
      return byYear.get(year as EraYear);
    },
  };
}

/** The shared registry instance. */
export const eraRegistry: EraRegistry = createEraRegistry();