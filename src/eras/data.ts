import type { EraRecord } from './types';

/**
 * The chronologically-ordered era dataset.
 *
 * `as const` guarantees ordering is preserved and every record is narrowed to
 * the `EraRecord` shape. The explicit `readonly EraRecord[]` annotation keeps
 * downstream additions type-checked against the contract.
 */
export const ERA_LIST: readonly EraRecord[] = [
  {
    year: 1945,
    label: 'Postwar',
    description: 'Recovery-era block: low brick storefronts, sparse traffic, hand-painted signage.',
    palette: {
      sky: { name: 'hazy blue', hex: '#9bb3c4', linear: { r: 0.478, g: 0.588, b: 0.686 } },
      ground: { name: 'concrete gray', hex: '#9a958c', linear: { r: 0.345, g: 0.329, b: 0.301 } },
      facade: { name: 'brick red', hex: '#a83232', linear: { r: 0.404, g: 0.090, b: 0.090 } },
      accent: { name: 'cream', hex: '#e8dcc0', linear: { r: 0.782, g: 0.725, b: 0.600 } },
      road: { name: 'asphalt', hex: '#3a3a3a', linear: { r: 0.050, g: 0.050, b: 0.050 } },
      markings: { name: 'ivory', hex: '#e0d8c0', linear: { r: 0.729, g: 0.682, b: 0.580 } },
    },
    buildings: { min: 6, max: 14, average: 9 },
    lanes: { count: 2, width: 3.2, hasMedian: false },
    parking: { count: 6, hasLot: false },
    walk: { speed: 1.15, stride: 0.62, armSwing: 0.28, outfit: 'overcoat' },
    vehicles: [
      { variant: 'car', model: 'sedan', color: '#2b2b2b', weight: 0.7 },
      { variant: 'truck', model: 'flatbed', color: '#5b4a2f', weight: 0.3 },
    ],
    billboard: { count: 2, illuminated: false, depth: 0.2 },
    audio: { ambient: 'ambient_1945_street', accent: 'sfx_tram_bell', volume: 0.45 },
  },
  {
    year: 1965,
    label: 'Mid-Century',
    description: 'Boom years: taller concrete towers, two-lane traffic, neon creeping in.',
    palette: {
      sky: { name: 'teal noon', hex: '#7fb8c4', linear: { r: 0.376, g: 0.591, b: 0.686 } },
      ground: { name: 'aggregate gray', hex: '#8c8a84', linear: { r: 0.286, g: 0.282, b: 0.267 } },
      facade: { name: 'pale concrete', hex: '#c8c0b0', linear: { r: 0.580, g: 0.549, b: 0.478 } },
      accent: { name: 'turquoise', hex: '#2fa8a0', linear: { r: 0.114, g: 0.431, b: 0.404 } },
      road: { name: 'dark asphalt', hex: '#2e2e2e', linear: { r: 0.032, g: 0.032, b: 0.032 } },
      markings: { name: 'yellow', hex: '#e8c820', linear: { r: 0.768, g: 0.584, b: 0.095 } },
    },
    buildings: { min: 10, max: 28, average: 18 },
    lanes: { count: 4, width: 3.3, hasMedian: false },
    parking: { count: 8, hasLot: true },
    walk: { speed: 1.25, stride: 0.66, armSwing: 0.32, outfit: 'suits_and_shifts' },
    vehicles: [
      { variant: 'car', model: 'land_yacht', color: '#c8b890', weight: 0.6 },
      { variant: 'car', model: 'compact', color: '#7a1a1a', weight: 0.25 },
      { variant: 'truck', model: 'pickup', color: '#3a5a3a', weight: 0.15 },
    ],
    billboard: { count: 4, illuminated: true, depth: 0.35 },
    audio: { ambient: 'ambient_1965_traffic', accent: 'sfx_neon_hum', volume: 0.5 },
  },
  {
    year: 1985,
    label: 'Neon Decade',
    description: 'Dense commercial block, mirrored glass, heavy traffic, glowing signage.',
    palette: {
      sky: { name: 'dusk magenta', hex: '#8a5a8c', linear: { r: 0.275, g: 0.114, b: 0.298 } },
      ground: { name: 'smog gray', hex: '#7e7c78', linear: { r: 0.233, g: 0.230, b: 0.220 } },
      facade: { name: 'mirrored blue', hex: '#4a6a8c', linear: { r: 0.071, g: 0.149, b: 0.298 } },
      accent: { name: 'hot pink', hex: '#ff3a8a', linear: { r: 1.0, g: 0.067, b: 0.298 } },
      road: { name: 'worn asphalt', hex: '#262626', linear: { r: 0.024, g: 0.024, b: 0.024 } },
      markings: { name: 'reflective white', hex: '#f0f0e8', linear: { r: 0.855, g: 0.855, b: 0.800 } },
    },
    buildings: { min: 18, max: 60, average: 36 },
    lanes: { count: 6, width: 3.4, hasMedian: true },
    parking: { count: 4, hasLot: true },
    walk: { speed: 1.35, stride: 0.7, armSwing: 0.38, outfit: 'shoulder_pads' },
    vehicles: [
      { variant: 'car', model: 'box_sedan', color: '#9a9a9a', weight: 0.5 },
      { variant: 'car', model: 'hatchback', color: '#1a4a8a', weight: 0.3 },
      { variant: 'truck', model: 'delivery_van', color: '#c8c8c8', weight: 0.2 },
    ],
    billboard: { count: 8, illuminated: true, depth: 0.6 },
    audio: { ambient: 'ambient_1985_city', accent: 'sfx_neon_flicker', volume: 0.6 },
  },
  {
    year: 2005,
    label: 'Digital Boom',
    description: 'Glass-and-steel condos, SUV-heavy traffic, LED billboards, gentrified ground floor.',
    palette: {
      sky: { name: 'clear blue', hex: '#7caedb', linear: { r: 0.349, g: 0.631, b: 0.855 } },
      ground: { name: 'polished stone', hex: '#b8b4ac', linear: { r: 0.463, g: 0.443, b: 0.404 } },
      facade: { name: 'steel blue glass', hex: '#6a8aa8', linear: { r: 0.149, g: 0.267, b: 0.404 } },
      accent: { name: 'lime', hex: '#a8d820', linear: { r: 0.404, g: 0.686, b: 0.067 } },
      road: { name: 'fresh asphalt', hex: '#2a2a2a', linear: { r: 0.024, g: 0.024, b: 0.024 } },
      markings: { name: 'thermoplastic white', hex: '#f8f8f0', linear: { r: 0.902, g: 0.902, b: 0.855 } },
    },
    buildings: { min: 24, max: 90, average: 54 },
    lanes: { count: 6, width: 3.5, hasMedian: true },
    parking: { count: 2, hasLot: true },
    walk: { speed: 1.3, stride: 0.68, armSwing: 0.34, outfit: 'business_casual' },
    vehicles: [
      { variant: 'car', model: 'suv', color: '#1a1a1a', weight: 0.45 },
      { variant: 'car', model: 'sedan', color: '#c0c0c0', weight: 0.35 },
      { variant: 'car', model: 'hybrid', color: '#e8e8e8', weight: 0.15 },
      { variant: 'truck', model: 'delivery_box', color: '#3a3a8a', weight: 0.05 },
    ],
    billboard: { count: 6, illuminated: true, depth: 0.8 },
    audio: { ambient: 'ambient_2005_urban', accent: 'sfx_led_chime', volume: 0.55 },
  },
  {
    year: 2025,
    label: 'Smart City',
    description: 'Autonomous EVs, green walls, dynamic LED signage, dedicated lanes, quiet streets.',
    palette: {
      sky: { name: 'crisp azure', hex: '#6cb8e8', linear: { r: 0.233, g: 0.591, b: 0.855 } },
      ground: { name: 'permeable tan', hex: '#c4b896', linear: { r: 0.553, g: 0.490, b: 0.329 } },
      facade: { name: 'green-white', hex: '#d8e8d0', linear: { r: 0.686, g: 0.855, b: 0.631 } },
      accent: { name: 'electric cyan', hex: '#20d8e8', linear: { r: 0.067, g: 0.686, b: 0.855 } },
      road: { name: 'graphene', hex: '#1e1e1e', linear: { r: 0.018, g: 0.018, b: 0.018 } },
      markings: { name: 'led white', hex: '#ffffff', linear: { r: 1.0, g: 1.0, b: 1.0 } },
    },
    buildings: { min: 30, max: 120, average: 72 },
    lanes: { count: 4, width: 3.6, hasMedian: true },
    parking: { count: 0, hasLot: false },
    walk: { speed: 1.2, stride: 0.64, armSwing: 0.26, outfit: 'athleisure' },
    vehicles: [
      { variant: 'car', model: 'ev_pod', color: '#f0f0f0', weight: 0.5 },
      { variant: 'car', model: 'autotaxi', color: '#e8a820', weight: 0.3 },
      { variant: 'truck', model: 'cargo_bot', color: '#2a2a2a', weight: 0.2 },
    ],
    billboard: { count: 10, illuminated: true, depth: 1.0 },
    audio: { ambient: 'ambient_2025_quiet', accent: 'sfx_ev_whir', volume: 0.35 },
  },
] as const;
