/**
 * Vehicles for the 2025 smart-city EV era.
 *
 * White EV sedans and crossovers, e-scooters, an e-cargo bike, app-based
 * ride-share cars with window stickers, and a last-mile delivery van.
 * Traffic is dense but smooth.
 */

/** Kind of a 2025 vehicle. */
export type VehicleKind =
  | 'ev-sedan'
  | 'ev-crossover'
  | 'e-scooter'
  | 'e-cargo-bike'
  | 'ride-share'
  | 'delivery-van';

/** A 2025-era vehicle in the traffic mix. */
export interface Vehicle {
  /** Id of the vehicle. */
  id: string;
  /** Vehicle archetype. */
  kind: VehicleKind;
  /** Display name. */
  name: string;
  /** Base body colour (white EVs). */
  color: string;
  /** Whether this is a ride-share with a window sticker. */
  rideShareSticker: boolean;
  /** Whether the vehicle is electric. */
  electric: boolean;
}

/** The 2025 dense-but-smooth traffic mix. */
export const vehicles: readonly Vehicle[] = Object.freeze([
  { id: 'ev-1', kind: 'ev-sedan', name: 'White EV sedan', color: '#f2f4f6', rideShareSticker: false, electric: true },
  { id: 'ev-2', kind: 'ev-sedan', name: 'White EV sedan', color: '#eef1f4', rideShareSticker: false, electric: true },
  { id: 'ev-3', kind: 'ev-crossover', name: 'White EV crossover', color: '#f5f7f9', rideShareSticker: false, electric: true },
  { id: 'ev-4', kind: 'ev-crossover', name: 'White EV crossover', color: '#eef2f5', rideShareSticker: false, electric: true },
  { id: 'ride-1', kind: 'ride-share', name: 'Ride-share sedan', color: '#f1f3f5', rideShareSticker: true, electric: true },
  { id: 'ride-2', kind: 'ride-share', name: 'Ride-share crossover', color: '#eef1f3', rideShareSticker: true, electric: true },
  { id: 'van-1', kind: 'delivery-van', name: 'Last-mile delivery van', color: '#2f3a4d', rideShareSticker: true, electric: true },
  { id: 'scooter-1', kind: 'e-scooter', name: 'E-scooter', color: '#e8e9eb', rideShareSticker: false, electric: true },
  { id: 'scooter-2', kind: 'e-scooter', name: 'E-scooter', color: '#eef0f2', rideShareSticker: false, electric: true },
  { id: 'cargo-1', kind: 'e-cargo-bike', name: 'E-cargo bike', color: '#dce2e8', rideShareSticker: true, electric: true },
]);