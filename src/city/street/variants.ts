/**
 * Era variant tables and the shared street layout for the street-props module.
 *
 * Pure data — no Three.js, no DOM — so the era-variant tables can be unit
 * tested directly. Everything here is deterministic:
 *
 * - `STREET_PROP_VARIANTS` pins, for every street prop kind, exactly one
 *   variant descriptor per era stop (1945 -> 2025), including whether the
 *   prop exists in that era, its style id, and its physical height.
 * - `ROAD_SURFACE_VARIANTS` pins how the roadway and sidewalk surfaces are
 *   paved, marked, and worn per era (cobblestone gutters and hand-painted
 *   markings in 1945, patched asphalt and thermoplastic markings in the
 *   middle eras, modern paving with tactile curb edges in 2025).
 * - `STREET_LAYOUT` pins the geometry of the block corner: both road
 *   approaches, the intersection, the eight sidewalk strips, curb cap
 *   segments, crosswalks, and every prop slot (x/z/rotation). Slot
 *   positions are era-independent so props swap in place across eras —
 *   the alignment guarantee that keeps buildings, traffic, and crowds
 *   consistent with the shared slot constants in `roadway.ts`.
 */

import type { ProceduralTextureType } from '../../gfx/materials';

/** The five era stops this module builds variants for. */
export const STREET_ERAS = [1945, 1965, 1985, 2005, 2025] as const;

/** One of the five era stops. */
export type StreetEra = (typeof STREET_ERAS)[number];

/** Every street prop family this module builds. */
export type StreetPropKind =
  | 'lamp'
  | 'hydrant'
  | 'mailbox'
  | 'litterBin'
  | 'bench'
  | 'busStop'
  | 'parkingMeter'
  | 'payStation'
  | 'evCharger'
  | 'phoneBooth'
  | 'streetKiosk'
  | 'wifiPylon'
  | 'telegraphPole'
  | 'overheadWires'
  | 'treePit'
  | 'bollard'
  | 'scaffolding'
  | 'manhole'
  | 'drainGrate';

/** Stable list of every street prop kind, in documentation order. */
export const STREET_PROP_KINDS: readonly StreetPropKind[] = [
  'lamp',
  'hydrant',
  'mailbox',
  'litterBin',
  'bench',
  'busStop',
  'parkingMeter',
  'payStation',
  'evCharger',
  'phoneBooth',
  'streetKiosk',
  'wifiPylon',
  'telegraphPole',
  'overheadWires',
  'treePit',
  'bollard',
  'scaffolding',
  'manhole',
  'drainGrate',
];

/**
 * Kinds driven by the "lights" choreography stage: lamps ignite/hum and the
 * telegraph infrastructure vanishes on its own beat, after furniture swaps.
 */
export const LIGHTING_PROP_KINDS: readonly StreetPropKind[] = [
  'lamp',
  'telegraphPole',
  'overheadWires',
];

/** Kinds driven by the "fleet" choreography stage (everything else). */
export const FURNITURE_PROP_KINDS: readonly StreetPropKind[] = STREET_PROP_KINDS.filter(
  (kind) => !LIGHTING_PROP_KINDS.includes(kind),
);

/** Which surface a kind stands on: the sidewalk deck, the roadway, or overhead. */
export type StreetPropSurface = 'sidewalk' | 'road' | 'overhead';

/** Surface assignment per kind (sidewalk props stand at y=0.15, road props at y=0). */
export const PROP_SURFACE: Readonly<Record<StreetPropKind, StreetPropSurface>> = Object.freeze({
  lamp: 'sidewalk',
  hydrant: 'sidewalk',
  mailbox: 'sidewalk',
  litterBin: 'sidewalk',
  bench: 'sidewalk',
  busStop: 'sidewalk',
  parkingMeter: 'sidewalk',
  payStation: 'sidewalk',
  evCharger: 'road',
  phoneBooth: 'sidewalk',
  streetKiosk: 'sidewalk',
  wifiPylon: 'sidewalk',
  telegraphPole: 'sidewalk',
  overheadWires: 'overhead',
  treePit: 'sidewalk',
  bollard: 'sidewalk',
  scaffolding: 'sidewalk',
  manhole: 'road',
  drainGrate: 'road',
});

/** One era descriptor for a single prop kind. */
export interface StreetPropVariant {
  /** Era stop this descriptor belongs to. */
  readonly era: StreetEra;
  /** Whether the prop exists at all in this era (e.g. no EV chargers before 2025). */
  readonly present: boolean;
  /** Stable machine style id, e.g. 'gas-lantern' or 'led-column'. */
  readonly style: string;
  /** Human label for callouts and documentation. */
  readonly label: string;
  /** Height in world units above the prop's base surface. */
  readonly height: number;
  /** Fill level 0..1 of the era's trash inside litter bins. */
  readonly trashFill?: number;
  /** Number of strands carried by each overhead wire span in this era. */
  readonly wireCount?: number;
  /** Short descriptive detail used by pickable callouts. */
  readonly detail: string;
}

function v(
  era: StreetEra,
  present: boolean,
  style: string,
  label: string,
  height: number,
  detail: string,
  extra: { trashFill?: number; wireCount?: number } = {},
): StreetPropVariant {
  return { era, present, style, label, height, detail, ...extra };
}

/**
 * Era variant table: exactly five entries (1945, 1965, 1985, 2005, 2025)
 * for every street prop kind.
 */
export const STREET_PROP_VARIANTS: Readonly<
  Record<StreetPropKind, readonly StreetPropVariant[]>
> = Object.freeze({
  lamp: [
    v(1945, true, 'gas-lantern-electric-mix', 'Gas lanterns & early electric globes', 4.2,
      'Hand-tended gas lanterns stand beside newly wired electric globes on fluted cast-iron standards.'),
    v(1965, true, 'ornate-electric-globe', 'Ornate electric acorn lamps', 4.6,
      'Ornate fluted standards carry luminous acorn globes above the curb.'),
    v(1985, true, 'utilitarian-cobra-head', 'Utilitarian cobra-head lamps', 7.2,
      'Mass-produced steel cobra heads throw flat sodium light across the lanes.'),
    v(2005, true, 'streamlined-cobra', 'Streamlined aluminum luminaires', 7.6,
      'Aerodynamic aluminum luminaires with shielded reflectors top tapered steel poles.'),
    v(2025, true, 'led-column', 'Sleek LED columns', 6.0,
      'Slim LED columns with integrated smart controls replace every mechanical luminaire.'),
  ],
  hydrant: [
    v(1945, true, 'squat-cast-iron', 'Squat cast-iron hydrant', 0.75,
      'A squat, soot-darkened cast-iron hydrant with a bolted bonnet.'),
    v(1965, true, 'rounded-cap', 'Rounded-cap wet-barrel hydrant', 0.85,
      'A rounded-cap hydrant in fresh fire-engine enamel.'),
    v(1985, true, 'nfp-standard', 'Standardized NFPA hydrant', 0.9,
      'A standardized high-visibility hydrant with reflective bonnet banding.'),
    v(2005, true, 'low-profile', 'Low-profile urban hydrant', 0.85,
      'A low-profile hydrant with tamper-resistant caps.'),
    v(2025, true, 'compact-stainless', 'Compact stainless hydrant', 0.8,
      'A compact stainless-steel hydrant with a painted safety collar.'),
  ],
  mailbox: [
    v(1945, true, 'leg-mounted-drop-box', 'Leg-mounted letter box', 0.95,
      'A dark-green leg-mounted letter box with a hand-hinged door.'),
    v(1965, true, 'relay-box', 'Curbside relay box', 0.98,
      'A curbside relay box in postal blue beside the walking lane.'),
    v(1985, true, 'snub-nose-box', 'Snub-nose collection box', 0.95,
      'A snub-nose collection box with a pull-down chute.'),
    v(2005, true, 'rounded-locker', 'Rounded parcel box', 1.1,
      'A rounded parcel box with a lockable front panel.'),
    v(2025, true, 'parcel-locker', 'Smart parcel locker', 1.3,
      'A smart parcel locker with a keypad and parcel compartment grid.'),
  ],
  litterBin: [
    v(1945, true, 'wire-basket', 'Wire litter basket', 0.65, 'A wrought-iron wire basket on a pedestal.', { trashFill: 0.55 }),
    v(1965, true, 'steel-drum', 'Steel drum bin', 0.8, 'A perforated steel drum bin with a rim collar.', { trashFill: 0.6 }),
    v(1985, true, 'concrete-ring', 'Concrete ring bin', 0.75, 'A heavy concrete ring liner stuffed with overflow.', { trashFill: 0.85 }),
    v(2005, true, 'slat-bin', 'Slat-panel bin', 0.9, 'A slat-panel bin with a self-closing lid.', { trashFill: 0.6 }),
    v(2025, true, 'smart-sorting-bin', 'Smart sorting bin', 1.05, 'A sensor-equipped sorting bin, mostly empty.', { trashFill: 0.3 }),
  ],
  bench: [
    v(1945, true, 'cast-iron-timber', 'Cast-iron & timber bench', 0.85, 'An ornate cast-iron bench with worn timber slats.'),
    v(1965, true, 'bolted-steel-lumber', 'Bolted steel & lumber bench', 0.82, 'A bolted steel-frame bench with varnished lumber.'),
    v(1985, true, 'concrete-plinth', 'Concrete plinth bench', 0.78, 'A utilitarian bench anchored to a concrete plinth.'),
    v(2005, true, 'aluminum-slat', 'Aluminum slat bench', 0.84, 'A corrosion-proof aluminum slat bench.'),
    v(2025, true, 'recycled-composite', 'Recycled composite bench', 0.86, 'A backless recycled-composite bench with hidden fixings.'),
  ],
  busStop: [
    v(1945, true, 'sign-pole', 'Sign pole (no shelter)', 2.6, 'A enamel route flag on a pole; riders wait in the weather.'),
    v(1965, true, 'roofed-shelter', 'Roofed waiting shelter', 2.5, 'A steel-roofed shelter with a bench and route board.'),
    v(1985, true, 'glass-shelter', 'Glass panel shelter', 2.6, 'A tempered-glass shelter with a lit route strip.'),
    v(2005, true, 'lit-shelter', 'Backlit information shelter', 2.7, 'A shelter with a backlit arrivals panel and bench.'),
    v(2025, true, 'solar-smart-shelter', 'Solar smart shelter', 3.0, 'A solar-roofed smart shelter with a live display.'),
  ],
  parkingMeter: [
    v(1945, false, 'none', 'No parking meters', 0, 'Parking is unregulated at the curb.'),
    v(1965, true, 'post-coin-meter', 'Post-top coin meter', 1.25, 'A single-space coin meter with a glass dial head.'),
    v(1985, true, 'digital-coin-meter', 'Digital-faced coin meter', 1.3, 'A digital-faced meter with an LCD time window.'),
    v(2005, true, 'solar-pay-meter', 'Solar pay-and-display meter', 1.35, 'A solar-charged meter with a card reader.'),
    v(2025, false, 'none', 'Meters removed', 0, 'Single-space meters are gone; pay stations serve the block.'),
  ],
  payStation: [
    v(1945, false, 'none', 'No pay stations', 0, 'No pay stations exist yet.'),
    v(1965, false, 'none', 'No pay stations', 0, 'No pay stations exist yet.'),
    v(1985, false, 'none', 'No pay stations', 0, 'No pay stations exist yet.'),
    v(2005, true, 'coin-pay-station', 'Coin pay-and-display station', 1.5, 'A multi-space coin station issuing paper tickets.'),
    v(2025, true, 'app-pay-station', 'App & card pay station', 1.55, 'A contactless pay station with an illuminated display.'),
  ],
  evCharger: [
    v(1945, false, 'none', 'No EV chargers', 0, 'Curbside charging is a century away.'),
    v(1965, false, 'none', 'No EV chargers', 0, 'Curbside charging is a century away.'),
    v(1985, false, 'none', 'No EV chargers', 0, 'Curbside charging is a century away.'),
    v(2005, false, 'none', 'No EV chargers', 0, 'Curbside charging is a decade away.'),
    v(2025, true, 'dc-fast-curb-charger', 'DC fast curb charger', 1.6, 'A curbside DC charger with a holstered connector and status ring.'),
  ],
  phoneBooth: [
    v(1945, false, 'none', 'No public phone booths', 0, 'The corner pays phone has not arrived yet.'),
    v(1965, true, 'glass-panel-booth', 'Glass panel phone booth', 2.3, 'A chrome-framed glass booth with a coin handset and coil cord.'),
    v(1985, true, 'neon-top-booth', 'Neon-topped phone booth', 2.35, 'A booth crowned with a buzzing neon TELEPHONE cap.'),
    v(2005, true, 'slim-handset-booth', 'Slim handset booth', 2.3, 'A slim card-handset booth with a small directory shelf.'),
    v(2025, false, 'none', 'Booths removed', 0, 'Booths are replaced by kiosks and wifi pylons.'),
  ],
  streetKiosk: [
    v(1945, false, 'none', 'No street kiosks', 0, 'No corner kiosk yet.'),
    v(1965, false, 'none', 'No street kiosks', 0, 'No corner kiosk yet.'),
    v(1985, false, 'none', 'No street kiosks', 0, 'No corner kiosk yet.'),
    v(2005, true, 'news-kiosk', 'News & lotto kiosk', 2.4, 'A roll-down news kiosk with magazine racks and a lotto awning.'),
    v(2025, true, 'info-kiosk', 'Digital information kiosk', 2.6, 'A weatherproof information kiosk with a touchscreen map.'),
  ],
  wifiPylon: [
    v(1945, false, 'none', 'No wifi pylons', 0, 'Radio exists, but not street wifi.'),
    v(1965, false, 'none', 'No wifi pylons', 0, 'Street wifi is sixty years away.'),
    v(1985, false, 'none', 'No wifi pylons', 0, 'Street wifi is forty years away.'),
    v(2005, false, 'none', 'No wifi pylons', 0, 'Street wifi is twenty years away.'),
    v(2025, true, 'wifi-pylon', 'Public wifi pylon', 3.4, 'A glowing public wifi pylon broadcasting free mesh coverage.'),
  ],
  telegraphPole: [
    v(1945, true, 'creosote-crossarm', 'Creosote poles with double crossarms', 7.5, 'Creosote poles carry double crossarms of glass insulators.'),
    v(1965, true, 'creosote-crossarm', 'Telegraph poles with bundled services', 7.5, 'Poles bundle telephone and service drops above the curb.'),
    v(1985, true, 'reduced-crossarm', 'Thinned service poles', 7.5, 'Most spans have been cut back to a single service arm.'),
    v(2005, false, 'none', 'Poles removed', 0, 'Overhead services have moved underground.'),
    v(2025, false, 'none', 'Poles removed', 0, 'No overhead poles remain in the modern era.'),
  ],
  overheadWires: [
    v(1945, true, 'six-line-truss', 'Six-strand overhead wires', 7.2, 'Six strands sag between poles over both streets.', { wireCount: 6 }),
    v(1965, true, 'six-line-truss', 'Six-strand service wires', 7.2, 'Six strands of telephone and telegraph wire cross the block.', { wireCount: 6 }),
    v(1985, true, 'four-line', 'Reduced four-strand wires', 7.0, 'Only four strands survive as services are trimmed.', { wireCount: 4 }),
    v(2005, false, 'none', 'Wires removed', 0, 'The overhead wires have vanished underground.', { wireCount: 0 }),
    v(2025, false, 'none', 'Wires removed', 0, 'No overhead wires remain.', { wireCount: 0 }),
  ],
  treePit: [
    v(1945, true, 'iron-guard-pit', 'Iron tree guard pit', 3.6, 'A young tree rings by a wrought-iron guard in a cut pit.'),
    v(1965, true, 'guard-pit-mature', 'Guarded mature tree pit', 5.2, 'A maturing street tree inside a Victorian-style guard.'),
    v(1985, true, 'open-pit', 'Open uncompacted pit', 6.4, 'A mature tree rises from an open, compacted pit.'),
    v(2005, true, 'steel-grate', 'Steel tree grate', 7.2, 'A broad canopy stands over a flush steel grate.'),
    v(2025, true, 'bio-grate', 'Bioswale grate pit', 7.6, 'A large canopy over a permeable bio-grate feeding a rain bed.'),
  ],
  bollard: [
    v(1945, true, 'cast-iron-bollard', 'Cast-iron bollards', 0.95, 'Short cast-iron bollards guard the corner kerb.'),
    v(1965, true, 'steel-bollard', 'Painted steel bollards', 0.95, 'Painted steel bollards stand along the kerb line.'),
    v(1985, true, 'reflective-steel', 'Reflective-band bollards', 1.0, 'Steel bollards with reflective banding.'),
    v(2005, true, 'stainless-bollard', 'Stainless bollards', 1.0, 'Brushed stainless bollards with domed caps.'),
    v(2025, true, 'led-band-bollard', 'LED band bollards', 1.02, 'Bollards with an illuminated guidance band at the cap.'),
  ],
  scaffolding: [
    v(1945, true, 'timber-pole-scaffold', 'Timber pole scaffold & hoarding', 5.2, 'Lashed timber poles rise above a weathered plank hoarding.'),
    v(1965, true, 'tube-scaffold', 'Steel tube scaffold', 6.0, 'Bolted steel tube scaffold with timber planks.'),
    v(1985, true, 'tube-with-mesh', 'Scaffold with safety mesh', 7.4, 'Tube scaffold wrapped in faded safety mesh.'),
    v(2005, true, 'hoarding-and-screen', 'Hoarding & debris screen', 7.8, 'Plywood hoarding below a debris-screened scaffold.'),
    v(2025, true, 'printed-hoarding', 'Printed hoarding & screen wall', 8.2, 'A printed artwork hoarding beneath a clean screen wall.'),
  ],
  manhole: [
    v(1945, true, 'cast-iron-plate', 'Cast-iron cover', 0.03, 'A patterned cast-iron cover set flush in the road.'),
    v(1965, true, 'weighted-plate', 'Weighted utility cover', 0.03, 'A weighted utility cover with a step ring.'),
    v(1985, true, 'ductile-ring', 'Ductile iron cover', 0.03, 'A ductile iron cover with a gasketed ring.'),
    v(2005, true, 'sealed-cover', 'Sealed noiseless cover', 0.03, 'A sealed, noiseless cover with a bolt lock.'),
    v(2025, true, 'composite-cover', 'Composite smart cover', 0.03, 'A lightweight composite cover with an access tag.'),
  ],
  drainGrate: [
    v(1945, true, 'bar-gutter-grate', 'Bar gutter grate', 0.04, 'A heavy bar grate in the granite gutter.'),
    v(1965, true, 'slotted-gutter-grate', 'Slotted gutter grate', 0.04, 'A slotted cast grate at the kerb return.'),
    v(1985, true, 'hog-trough-grate', 'Deep trough grate', 0.04, 'A deep trough grate sized for heavier storms.'),
    v(2005, true, 'beveled-grate', 'Beveled safety grate', 0.04, 'A beveled anti-skate grate at the gutter line.'),
    v(2025, true, 'inlet-filter-grate', 'Filtered inlet grate', 0.04, 'A filtered inlet grate feeding the storm bed.'),
  ],
});

/** Look up one prop variant for an era. Throws for unknown kind/era pairs. */
export function propVariant(kind: StreetPropKind, era: StreetEra): StreetPropVariant {
  const list = STREET_PROP_VARIANTS[kind];
  const found = list.find((entry) => entry.era === era);
  if (!found) {
    throw new Error(`No ${kind} variant for era ${era}`);
  }
  return found;
}

/** Whether a prop kind exists in an era. */
export function isPropPresent(kind: StreetPropKind, era: StreetEra): boolean {
  return propVariant(kind, era).present;
}

/** Era eras a kind exists in (sorted ascending). */
export function erasPresent(kind: StreetPropKind): readonly StreetEra[] {
  return STREET_PROP_VARIANTS[kind].filter((entry) => entry.present).map((entry) => entry.era);
}

// ---------------------------------------------------------------------------
// Road & sidewalk surface variants
// ---------------------------------------------------------------------------

/** How the roadway is paved and worn in one era. */
export interface RoadSurfaceVariant {
  readonly era: StreetEra;
  /** Paving style of the road surface itself. */
  readonly surfaceStyle: string;
  /** True when granite cobblestone gutters edge the roadway (1945). */
  readonly cobblestoneGutter: boolean;
  /** Gutter strip width in units. */
  readonly gutterWidth: number;
  /** Marking application style. */
  readonly markingStyle: 'hand-painted' | 'thermoplastic' | 'faded-thermoplastic' | 'reflective-thermoplastic' | 'epoxy-reflective';
  /** Base marking paint color. */
  readonly markingColor: string;
  /** Paint opacity at full era weight (hand-painted markings wear thin). */
  readonly markingOpacity: number;
  /** Positional jitter applied to hand-painted markings (0 = machine-laid). */
  readonly markingJitter: number;
  /** Sidewalk paving pattern. */
  readonly sidewalkPaving: string;
  /** Procedural texture used for the sidewalk paving layer. */
  readonly sidewalkTexture: ProceduralTextureType;
  /** Sidewalk paving tint, derived from the era palette. */
  readonly sidewalkUsesMasonryColor: boolean;
  /** True when the 2025 tactile warning panels appear at kerb edges. */
  readonly tactileCurb: boolean;
  /** Crack density handed to the asphalt texture generator. */
  readonly asphaltCrackDensity: number;
  /** Number of repair patches drawn on the roadway. */
  readonly patchCount: number;
  /** Number of tar seams drawn on the roadway. */
  readonly tarSeams: number;
  /** Overall wear level 0..1 fed to texture weathering. */
  readonly wear: number;
}

/** Era-by-era roadway and sidewalk surfacing. */
export const ROAD_SURFACE_VARIANTS: Readonly<Record<StreetEra, RoadSurfaceVariant>> = Object.freeze({
  1945: {
    era: 1945,
    surfaceStyle: 'worn-asphalt-with-cobblestone-edges',
    cobblestoneGutter: true,
    gutterWidth: 0.9,
    markingStyle: 'hand-painted',
    markingColor: '#e6dcc0',
    markingOpacity: 0.78,
    markingJitter: 0.09,
    sidewalkPaving: 'bluestone-flags',
    sidewalkTexture: 'stone',
    sidewalkUsesMasonryColor: true,
    tactileCurb: false,
    asphaltCrackDensity: 0.85,
    patchCount: 2,
    tarSeams: 6,
    wear: 0.72,
  },
  1965: {
    era: 1965,
    surfaceStyle: 'patched-asphalt',
    cobblestoneGutter: false,
    gutterWidth: 0.55,
    markingStyle: 'thermoplastic',
    markingColor: '#f4d23c',
    markingOpacity: 0.96,
    markingJitter: 0,
    sidewalkPaving: 'poured-concrete-slabs',
    sidewalkTexture: 'concrete',
    sidewalkUsesMasonryColor: true,
    tactileCurb: false,
    asphaltCrackDensity: 0.35,
    patchCount: 6,
    tarSeams: 4,
    wear: 0.42,
  },
  1985: {
    era: 1985,
    surfaceStyle: 'cracked-and-patched-asphalt',
    cobblestoneGutter: false,
    gutterWidth: 0.55,
    markingStyle: 'faded-thermoplastic',
    markingColor: '#e9bd2f',
    markingOpacity: 0.84,
    markingJitter: 0.015,
    sidewalkPaving: 'scored-concrete',
    sidewalkTexture: 'concrete',
    sidewalkUsesMasonryColor: true,
    tactileCurb: false,
    asphaltCrackDensity: 0.75,
    patchCount: 9,
    tarSeams: 7,
    wear: 0.62,
  },
  2005: {
    era: 2005,
    surfaceStyle: 'resurfaced-blacktop',
    cobblestoneGutter: false,
    gutterWidth: 0.55,
    markingStyle: 'reflective-thermoplastic',
    markingColor: '#f7e04a',
    markingOpacity: 1,
    markingJitter: 0,
    sidewalkPaving: 'paver-blocks',
    sidewalkTexture: 'stone',
    sidewalkUsesMasonryColor: true,
    tactileCurb: false,
    asphaltCrackDensity: 0.2,
    patchCount: 3,
    tarSeams: 2,
    wear: 0.28,
  },
  2025: {
    era: 2025,
    surfaceStyle: 'modern-porous-asphalt',
    cobblestoneGutter: false,
    gutterWidth: 0.5,
    markingStyle: 'epoxy-reflective',
    markingColor: '#fbf3d8',
    markingOpacity: 1,
    markingJitter: 0,
    sidewalkPaving: 'large-format-pavers-with-tactile-edges',
    sidewalkTexture: 'concrete',
    sidewalkUsesMasonryColor: true,
    tactileCurb: true,
    asphaltCrackDensity: 0.08,
    patchCount: 0,
    tarSeams: 0,
    wear: 0.1,
  },
});

/** Look up the roadway/sidewalk surfacing for an era. */
export function roadSurfaceVariant(era: StreetEra): RoadSurfaceVariant {
  return ROAD_SURFACE_VARIANTS[era];
}

// ---------------------------------------------------------------------------
// Shared street layout (block corner: two crossing streets)
// ---------------------------------------------------------------------------

/** Axis-aligned rectangle in street space. */
export interface StreetRect {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
}

/** One prop placement slot; positions are identical in every era. */
export interface StreetSlot extends StreetRect {
  /** Placement x (center). */
  readonly x: number;
  /** Placement z (center). */
  readonly z: number;
  /** Rotation around +Y in radians (0 faces the main street's roadway, -z). */
  readonly rot?: number;
  /** Optional longitudinal length for section props such as scaffolding. */
  readonly length?: number;
}

function slot(x: number, z: number, rot?: number, extra: { length?: number } = {}): StreetSlot {
  return { x, z, ...(rot !== undefined ? { rot } : {}), ...extra, x0: x, x1: x, z0: z, z1: z };
}

const MAIN = { z0: -12, z1: 0, x0: -48, x1: 48 } as const;
const CROSS = { x0: -12, x1: 0, z0: -48, z1: 48 } as const;
const INTERSECTION = { x0: -12, x1: 0, z0: -12, z1: 0 } as const;

// Shared slot lists referenced both by the dedicated layout entries and by
// `propSlots`, so the frozen layout needs no post-construction patching.
const MANHOLE_SLOTS: readonly StreetSlot[] = Object.freeze([
  slot(8, -6), slot(-24, -6), slot(-6, 14), slot(-6, -26),
]);
const DRAIN_SLOTS: readonly StreetSlot[] = Object.freeze([
  slot(6, -0.55, 0),
  slot(-18, -0.55, 0),
  slot(24, -11.45, 0),
  slot(-30, -11.45, 0),
  slot(-0.55, 12, Math.PI / 2),
  slot(-11.45, 18, Math.PI / 2),
  slot(-0.55, -24, Math.PI / 2),
]);
const TELEGRAPH_POLE_SLOTS: readonly StreetSlot[] = Object.freeze([
  slot(9, 1.1), slot(33, 1.1), slot(-21, 1.1),
  slot(9, -13.1, Math.PI), slot(33, -13.1, Math.PI), slot(-21, -13.1, Math.PI),
  slot(1.1, 9, Math.PI / 2), slot(1.1, 33, Math.PI / 2), slot(1.1, -21, Math.PI / 2),
  slot(-13.1, 9, -Math.PI / 2), slot(-13.1, 33, -Math.PI / 2), slot(-13.1, -21, -Math.PI / 2),
]);

/** The corner layout: roads, sidewalks, curbs, crosswalks, and prop slots. */
export const STREET_LAYOUT = Object.freeze({
  /** Main street runs along +X; its road band spans z in [-12, 0]. */
  mainRoad: MAIN,
  /** Cross street runs along +Z; its road band spans x in [-12, 0]. */
  crossRoad: CROSS,
  /** Shared intersection square where the two streets meet. */
  intersection: INTERSECTION,
  /**
   * Five road quads that tile the streets without overlap, so era surfacing
   * layers never overlap each other (no self z-fighting inside one era).
   */
  roadPieces: Object.freeze([
    { name: 'mainWest', x0: -48, x1: -12, z0: -12, z1: 0 },
    { name: 'mainEast', x0: 0, x1: 48, z0: -12, z1: 0 },
    { name: 'intersection', ...INTERSECTION },
    { name: 'crossNorth', x0: -12, x1: 0, z0: 0, z1: 48 },
    { name: 'crossSouth', x0: -12, x1: 0, z0: -48, z1: -12 },
  ]),
  /**
   * Eight sidewalk strips (top at y=0.15). Each quadrant is an L of two
   * strips that never overlap; the north-east quadrant is the hero block.
   */
  sidewalkStrips: Object.freeze([
    { name: 'mainNorthEast', x0: 0, x1: 48, z0: 0, z1: 3 },
    { name: 'crossEastNorth', x0: 0, x1: 3, z0: 3, z1: 48 },
    { name: 'mainNorthWest', x0: -48, x1: -12, z0: 0, z1: 3 },
    { name: 'crossWestNorth', x0: -15, x1: -12, z0: 3, z1: 48 },
    { name: 'mainSouthWest', x0: -48, x1: -12, z0: -15, z1: -12 },
    { name: 'crossWestSouth', x0: -15, x1: -12, z0: -48, z1: -15 },
    { name: 'mainSouthEast', x0: 0, x1: 48, z0: -15, z1: -12 },
    { name: 'crossEastSouth', x0: 0, x1: 3, z0: -48, z1: -15 },
  ]),
  /**
   * Twelve granite curb cap segments (thin rects sitting on the deck edge,
   * 0.34 wide, top slightly proud of the paving).
   */
  curbSegments: Object.freeze([
    { x0: 0, x1: 48, z0: 0.005, z1: 0.345 },
    { x0: 0.005, x1: 0.345, z0: 0, z1: 3 },
    { x0: -48, x1: -12, z0: 0.005, z1: 0.345 },
    { x0: -12.345, x1: -12.005, z0: 0, z1: 3 },
    { x0: -12.345, x1: -12.005, z0: 3, z1: 48 },
    { x0: 0, x1: 48, z0: -12.345, z1: -12.005 },
    { x0: 0.005, x1: 0.345, z0: -15, z1: -12 },
    { x0: 0.005, x1: 0.345, z0: -48, z1: -15 },
    { x0: -48, x1: -12, z0: -12.345, z1: -12.005 },
    { x0: -12.345, x1: -12.005, z0: -15, z1: -12 },
    { x0: -12.345, x1: -12.005, z0: -48, z1: -15 },
    { x0: 0.005, x1: 0.345, z0: 3, z1: 48 },
  ]),
  /** Zebra crossing fields, one per approach. */
  crosswalks: Object.freeze([
    { x0: 1.5, x1: 4.5, z0: -12, z1: 0 },
    { x0: -4.5, x1: -1.5, z0: -12, z1: 0 },
    { x0: -12, x1: 0, z0: 1.5, z1: 4.5 },
    { x0: -12, x1: 0, z0: -4.5, z1: -1.5 },
  ]),
  /** Tactile warning panel fields shown only in 2025 (at both kerb ramps). */
  tactilePanels: Object.freeze([
    { x0: 1.4, x1: 4.6, z0: 0.4, z1: 1.1 },
    { x0: 0.4, x1: 1.1, z0: 1.4, z1: 4.6 },
  ]),
  /** Manhole covers (road surface). */
  manholeSlots: MANHOLE_SLOTS,
  /** Drain grates at the gutter line; rot aligns the grate with its kerb. */
  drainSlots: DRAIN_SLOTS,
  /** Telegraph pole slots (sidewalk, near the kerb). */
  telegraphPoleSlots: TELEGRAPH_POLE_SLOTS,
  /** Overhead wire spans as pole-top to pole-top pairs. */
  wireSpans: Object.freeze([
    { ax: 9, az: 1.1, bx: 9, bz: -13.1 },
    { ax: 33, az: 1.1, bx: 33, bz: -13.1 },
    { ax: -21, az: 1.1, bx: -21, bz: -13.1 },
    { ax: 9, az: 1.1, bx: 33, bz: 1.1 },
    { ax: -21, az: 1.1, bx: 9, bz: 1.1 },
    { ax: 9, az: -13.1, bx: 33, bz: -13.1 },
    { ax: -21, az: -13.1, bx: 9, bz: -13.1 },
    { ax: 1.1, az: 9, bx: -13.1, bz: 9 },
    { ax: 1.1, az: 33, bx: -13.1, bz: 33 },
    { ax: 1.1, az: -21, bx: -13.1, bz: -21 },
    { ax: 1.1, az: 9, bx: 1.1, bz: 33 },
    { ax: 1.1, az: -21, bx: 1.1, bz: 9 },
    { ax: -13.1, az: 9, bx: -13.1, bz: 33 },
    { ax: -13.1, az: -21, bx: -13.1, bz: 9 },
  ]),
  /**
   * Prop slots per kind. Slots are pinned at 6-unit bay boundaries wherever
   * possible so street furniture aligns with the storefront bay rhythm.
   */
  propSlots: Object.freeze({
    lamp: Object.freeze([
      slot(6, 1.5), slot(18, 1.5), slot(30, 1.5), slot(42, 1.5), slot(-30, 1.5),
      slot(12, -13.5, Math.PI), slot(36, -13.5, Math.PI), slot(-24, -13.5, Math.PI),
      slot(1.5, 12, Math.PI / 2), slot(1.5, 24, Math.PI / 2), slot(1.5, 36, Math.PI / 2),
      slot(-13.5, 18, -Math.PI / 2), slot(1.5, -24, Math.PI / 2), slot(-13.5, -30, -Math.PI / 2),
    ]),
    hydrant: Object.freeze([slot(9, 0.6), slot(-21, 0.6), slot(15, -12.6, Math.PI), slot(0.6, 15, Math.PI / 2)]),
    mailbox: Object.freeze([slot(24, 0.6), slot(30, -12.6, Math.PI), slot(0.6, 30, Math.PI / 2), slot(-12.6, 21, -Math.PI / 2)]),
    litterBin: Object.freeze([
      slot(12, 0.7), slot(36, 0.7), slot(-36, 0.7),
      slot(21, -12.7, Math.PI), slot(6, -12.7, Math.PI),
      slot(0.7, 18, Math.PI / 2), slot(0.7, 33, Math.PI / 2), slot(-12.7, 12, -Math.PI / 2),
    ]),
    bench: Object.freeze([
      slot(24, 2.0), slot(-33, 2.0), slot(27, -14.0, Math.PI),
      slot(2.0, 27, Math.PI / 2), slot(-14.0, 9, -Math.PI / 2),
    ]),
    busStop: Object.freeze([slot(14, 2.1), slot(2.1, 9, Math.PI / 2)]),
    parkingMeter: Object.freeze([
      slot(6, 0.35), slot(12, 0.35), slot(18, 0.35), slot(24, 0.35),
      slot(30, 0.35), slot(36, 0.35), slot(42, 0.35),
      slot(9, -12.35, Math.PI), slot(21, -12.35, Math.PI), slot(33, -12.35, Math.PI),
      slot(0.35, 6, Math.PI / 2), slot(0.35, 12, Math.PI / 2), slot(0.35, 18, Math.PI / 2),
      slot(0.35, 24, Math.PI / 2), slot(0.35, 30, Math.PI / 2), slot(0.35, 36, Math.PI / 2),
      slot(-12.35, 9, -Math.PI / 2), slot(-12.35, 21, -Math.PI / 2), slot(-12.35, 33, -Math.PI / 2),
    ]),
    payStation: Object.freeze([
      slot(15, 0.45), slot(27, -12.45, Math.PI),
      slot(0.45, 15, Math.PI / 2), slot(-12.45, 27, -Math.PI / 2),
    ]),
    evCharger: Object.freeze([
      slot(12, -0.6), slot(30, -0.6), slot(18, -11.4, Math.PI),
      slot(-0.6, 12, Math.PI / 2), slot(-11.4, 24, -Math.PI / 2),
    ]),
    phoneBooth: Object.freeze([
      slot(5.5, 1.9), slot(-27, 1.9), slot(33, -13.9, Math.PI), slot(1.9, 39, Math.PI / 2),
    ]),
    streetKiosk: Object.freeze([
      slot(8.5, 2.4), slot(-24, 2.4), slot(24, -14.4, Math.PI), slot(2.4, 33, Math.PI / 2),
    ]),
    wifiPylon: Object.freeze([
      slot(3.6, 0.8), slot(12, -12.8, Math.PI), slot(0.8, 3.6, Math.PI / 2), slot(-12.8, 12, -Math.PI / 2),
    ]),
    telegraphPole: TELEGRAPH_POLE_SLOTS,
    overheadWires: Object.freeze([]),
    treePit: Object.freeze([
      slot(15, 2.25), slot(36, 2.25), slot(-36, 2.25),
      slot(6, -14.4, Math.PI), slot(30, -14.4, Math.PI), slot(-30, -14.4, Math.PI),
      slot(2.25, 18, Math.PI / 2), slot(2.25, 30, Math.PI / 2), slot(2.25, -24, Math.PI / 2),
      slot(-14.4, 24, -Math.PI / 2), slot(-14.4, -36, -Math.PI / 2),
    ]),
    bollard: Object.freeze([
      slot(0.6, 0.42), slot(1.9, 0.42), slot(45, 0.42), slot(46.3, 0.42),
      slot(2, -12.42, Math.PI), slot(3.3, -12.42, Math.PI),
      slot(0.42, 3.6, Math.PI / 2), slot(0.42, 4.9, Math.PI / 2), slot(0.42, 46, Math.PI / 2),
      slot(-12.42, 3.6, -Math.PI / 2), slot(-12.42, 4.9, -Math.PI / 2), slot(-12.42, 46, -Math.PI / 2),
    ]),
    scaffolding: Object.freeze([
      slot(26, 2.65, 0, { length: 12 }),
      slot(2.65, 41, Math.PI / 2, { length: 10 }),
    ]),
    manhole: MANHOLE_SLOTS,
    drainGrate: DRAIN_SLOTS,
  }) as Readonly<Record<StreetPropKind, readonly StreetSlot[]>>,
});

/** Slots for one prop kind (era-independent positions). */
export function slotsFor(kind: StreetPropKind): readonly StreetSlot[] {
  return STREET_LAYOUT.propSlots[kind];
}
