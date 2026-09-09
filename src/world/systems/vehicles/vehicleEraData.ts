/**
 * Era-specific vehicle specifications for the City Time Period Timelapse.
 *
 * Provides complete dataset configurations for all 5 eras (1945, 1965, 1985, 2005, 2025)
 * defining vehicle counts, paint palettes, lighting characteristics, speeds, and
 * authentic procedural vehicle body archetypes.
 */

import type { VehiclesEraSpec } from '../../../era/types';
import type { EraId } from '../../../era/years';

export const VEHICLES_1945: VehiclesEraSpec = {
  themeName: 'Curved Fender Coupes & Heavy Chrome Grilles',
  vehicleCount: 4,
  averageSpeed: 7.0,
  bodyColors: [
    '#18181b', // Vintage Gloss Black
    '#1e293b', // Midnight Navy
    '#451a03', // Deep Maroon / Mahogany
    '#14532d', // Hunter Dark Green
    '#713f12', // Warm Chestnut Brown
    '#292524', // Warm Charcoal
    '#3f3f46', // Gunmetal Gray
  ],
  headlightColor: '#fef3c7', // Warm incandescent tungsten bulb
  headlightIntensity: 0.8,
  taillightColor: '#991b1b', // Deep ruby glass
  exhaustEmissionRate: 0.9, // Heavy post-war exhaust
  models: [
    {
      type: 'vintage_fender_sedan',
      name: '1942 Custom Coupe',
      relativeFrequency: 0.5,
      length: 4.8,
      width: 1.9,
      height: 1.7,
    },
    {
      type: 'vintage_fender_sedan',
      name: 'Post-War Fleetline Sedan',
      relativeFrequency: 0.35,
      length: 5.0,
      width: 1.95,
      height: 1.75,
    },
    {
      type: 'vintage_fender_sedan',
      name: 'Pre-War Running-Board Woody',
      relativeFrequency: 0.15,
      length: 4.9,
      width: 1.9,
      height: 1.8,
    },
  ],
};

export const VEHICLES_1965: VehiclesEraSpec = {
  themeName: 'Tailfin Sedans & Chrome Cruiser Convertibles',
  vehicleCount: 6,
  averageSpeed: 8.5,
  bodyColors: [
    '#0284c7', // Sky / Nassau Blue
    '#dc2626', // Candy Apple Red
    '#16a34a', // Seafoam Green
    '#f8fafc', // Classic Wimbledon White
    '#ea580c', // Sunset Tangerine
    '#0d9488', // Turquoise Teal
    '#f59e0b', // Harvest Gold
  ],
  headlightColor: '#fffbeb', // Bright warm sealed-beam
  headlightIntensity: 1.0,
  taillightColor: '#dc2626', // Bright red lens
  exhaustEmissionRate: 0.7, // Leaded gasoline exhaust
  models: [
    {
      type: 'midcentury_finned_cruiser',
      name: 'Bel Air Hardtop',
      relativeFrequency: 0.45,
      length: 5.2,
      width: 2.0,
      height: 1.55,
    },
    {
      type: 'midcentury_finned_cruiser',
      name: 'Continental Fin Cruiser',
      relativeFrequency: 0.35,
      length: 5.4,
      width: 2.05,
      height: 1.5,
    },
    {
      type: 'midcentury_finned_cruiser',
      name: 'Chrome Cruiser Convertible',
      relativeFrequency: 0.2,
      length: 5.1,
      width: 1.98,
      height: 1.48,
    },
  ],
};

export const VEHICLES_1985: VehiclesEraSpec = {
  themeName: 'Angular Wedge Sedans & Boxy Hatchbacks',
  vehicleCount: 8,
  averageSpeed: 9.5,
  bodyColors: [
    '#dc2626', // Bright Rally Red
    '#e2e8f0', // Clean White
    '#0f172a', // Obsidian Black
    '#2563eb', // Electric Royal Blue
    '#ca8a04', // Metallic Gold / Ochre
    '#475569', // Slate Gray
    '#16a34a', // Forest Green
  ],
  headlightColor: '#fef08a', // Halogen rectangular bulb
  headlightIntensity: 1.2,
  taillightColor: '#ef4444', // Horizontal red bar
  exhaustEmissionRate: 0.5, // Catalytic converter emission
  models: [
    {
      type: 'angular_eighties_box',
      name: 'Sprint Turbo Hatch',
      relativeFrequency: 0.4,
      length: 4.3,
      width: 1.75,
      height: 1.4,
    },
    {
      type: 'angular_eighties_box',
      name: 'Executive Wedge Sedan',
      relativeFrequency: 0.3,
      length: 4.7,
      width: 1.8,
      height: 1.42,
    },
    {
      type: 'angular_eighties_box',
      name: 'Boxy Station Wagon',
      relativeFrequency: 0.15,
      length: 4.85,
      width: 1.8,
      height: 1.45,
    },
    {
      type: 'angular_eighties_box',
      name: 'Angular Delivery Van',
      relativeFrequency: 0.15,
      length: 4.6,
      width: 1.85,
      height: 1.95,
    },
  ],
};

export const VEHICLES_2005: VehiclesEraSpec = {
  themeName: 'Aerodynamic Curvature & Compact Crossovers',
  vehicleCount: 9,
  averageSpeed: 10.0,
  bodyColors: [
    '#94a3b8', // Silver Metallic
    '#1e293b', // Deep Midnight Blue
    '#dc2626', // Crimson Red
    '#2563eb', // Cobalt Blue
    '#f1f5f9', // Pearl White
    '#334155', // Anthracite Charcoal
    '#e2e8f0', // Light Platinum
  ],
  headlightColor: '#f8fafc', // Clean high-intensity discharge (HID)
  headlightIntensity: 1.4,
  taillightColor: '#dc2626', // Triangular cluster red
  exhaustEmissionRate: 0.3, // Modern low-emission standard
  models: [
    {
      type: 'curved_two_thousands_sedan',
      name: 'Aero 4-Door Hybrid',
      relativeFrequency: 0.45,
      length: 4.5,
      width: 1.8,
      height: 1.48,
    },
    {
      type: 'curved_two_thousands_sedan',
      name: 'Urban Compact SUV Crossover',
      relativeFrequency: 0.35,
      length: 4.4,
      width: 1.82,
      height: 1.65,
    },
    {
      type: 'curved_two_thousands_sedan',
      name: 'Curved Family Touring Sedan',
      relativeFrequency: 0.2,
      length: 4.65,
      width: 1.82,
      height: 1.45,
    },
  ],
};

export const VEHICLES_2025: VehiclesEraSpec = {
  themeName: 'Autonomous Electric Pods & Sleek Cyber Crossovers',
  vehicleCount: 10,
  averageSpeed: 11.0,
  bodyColors: [
    '#0f172a', // Cyber Midnight Matte
    '#f8fafc', // Arctic Glacier White
    '#0284c7', // Cyan Electric Blue
    '#10b981', // Eco Emerald Green
    '#475569', // Satin Titanium Slate
    '#38bdf8', // Neon Sky Blue
    '#6366f1', // Electric Indigo
  ],
  headlightColor: '#e0f2fe', // Ultra-bright cool LED matrix
  headlightIntensity: 1.6,
  taillightColor: '#f43f5e', // Vibrant full-width laser LED neon
  exhaustEmissionRate: 0.0, // Zero emissions (all electric)
  models: [
    {
      type: 'sleek_ev_crossover',
      name: 'Aero EV Cyber Cruiser',
      relativeFrequency: 0.45,
      length: 4.8,
      width: 1.95,
      height: 1.45,
    },
    {
      type: 'sleek_ev_crossover',
      name: 'Autonomous Micro-Pod',
      relativeFrequency: 0.25,
      length: 3.2,
      width: 1.6,
      height: 1.7,
    },
    {
      type: 'sleek_ev_crossover',
      name: 'Electric Urban Delivery Van',
      relativeFrequency: 0.15,
      length: 4.9,
      width: 1.9,
      height: 2.0,
    },
    {
      type: 'sleek_ev_crossover',
      name: 'Cyber Commuter Scooter',
      relativeFrequency: 0.15,
      length: 1.8,
      width: 0.8,
      height: 1.3,
    },
  ],
};

/**
 * Record mapping each era ID to its authoritative VehiclesEraSpec.
 */
export const vehicleEraData: Record<EraId, VehiclesEraSpec> = {
  '1945': VEHICLES_1945,
  '1965': VEHICLES_1965,
  '1985': VEHICLES_1985,
  '2005': VEHICLES_2005,
  '2025': VEHICLES_2025,
};

/**
 * Helper to retrieve era vehicle spec safely.
 */
export function getVehicleEraSpec(era: EraId): VehiclesEraSpec {
  const spec = vehicleEraData[era];
  if (!spec) {
    throw new Error(`Unknown era identifier for vehicles spec: ${era}`);
  }
  return spec;
}
