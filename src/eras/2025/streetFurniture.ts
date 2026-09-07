/**
 * Street furniture for the 2025 smart-city EV era.
 *
 * Modern flat-panel LED street lights with smart-city sensors, protected
 * bike lane posts, a floating bus stop with a live arrivals screen,
 * permeable-paver sidewalks, rain garden planters, and delivery robots on
 * the curb lane.
 */

import { StreetFeature } from '../../types/streetFeature';

/** Kind of a 2025 street furniture item. */
export type FurnitureKind =
  | 'led-street-light'
  | 'bike-lane-post'
  | 'floating-bus-stop'
  | 'rain-garden'
  | 'delivery-robot';

/** A 2025-era street furniture item. */
export interface StreetFurniture {
  /** Id of the furniture item. */
  id: string;
  /** Furniture archetype. */
  kind: FurnitureKind;
  /** Display name. */
  name: string;
  /** Whether the item embeds smart-city sensors. */
  smartSensors: boolean;
  /** Whether the item has a live screen. */
  liveScreen: boolean;
}

/** The 2025 street furniture set. */
export const streetFurniture: readonly StreetFurniture[] = Object.freeze([
  { id: 'light-1', kind: 'led-street-light', name: 'Flat-panel LED street light', smartSensors: true, liveScreen: false },
  { id: 'light-2', kind: 'led-street-light', name: 'Flat-panel LED street light', smartSensors: true, liveScreen: false },
  { id: 'light-3', kind: 'led-street-light', name: 'Flat-panel LED street light', smartSensors: true, liveScreen: false },
  { id: 'bike-1', kind: 'bike-lane-post', name: 'Protected bike lane post', smartSensors: false, liveScreen: false },
  { id: 'bike-2', kind: 'bike-lane-post', name: 'Protected bike lane post', smartSensors: false, liveScreen: false },
  { id: 'bus-stop', kind: 'floating-bus-stop', name: 'Floating bus stop', smartSensors: true, liveScreen: true },
  { id: 'garden-1', kind: 'rain-garden', name: 'Rain garden planter', smartSensors: false, liveScreen: false },
  { id: 'garden-2', kind: 'rain-garden', name: 'Rain garden planter', smartSensors: false, liveScreen: false },
  { id: 'robot-1', kind: 'delivery-robot', name: 'Curb delivery robot', smartSensors: true, liveScreen: false },
  { id: 'robot-2', kind: 'delivery-robot', name: 'Curb delivery robot', smartSensors: true, liveScreen: false },
]);

/**
 * Map the 2025 furniture onto the shared StreetFeature contract for
 * interoperability with the foundation renderer. The sidewalk is paved with
 * permeable pavers (encoded as a data flag on a shared feature).
 */
export function toStreetFeatures(): StreetFeature[] {
  const features: StreetFeature[] = [
    {
      kind: 'traffic_light',
      rect: { origin: { x: 4, z: 4 }, width: 0.5, depth: 0.5 },
      rotation: 0,
      eras: [2025],
      data: { furniture: 'led-street-light', smartSensors: true },
    },
    {
      kind: 'sign',
      rect: { origin: { x: -4, z: -4 }, width: 1.2, depth: 0.4 },
      rotation: 0,
      eras: [2025],
      data: { furniture: 'floating-bus-stop', liveScreen: true },
    },
    {
      kind: 'other',
      rect: { origin: { x: 2, z: -2 }, width: 0.6, depth: 0.6 },
      rotation: 0,
      eras: [2025],
      data: { furniture: 'delivery-robot', smartSensors: true },
    },
    {
      kind: 'tree_pit',
      rect: { origin: { x: -2, z: 2 }, width: 1.4, depth: 1.4 },
      rotation: 0,
      eras: [2025],
      data: { furniture: 'rain-garden' },
    },
  ];
  return features;
}

/** Permeable-paver sidewalk flag for the 2025 grade. */
export const permeablePaverSidewalk = true;