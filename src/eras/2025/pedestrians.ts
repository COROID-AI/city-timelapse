/**
 * Pedestrians for the 2025 smart-city EV era.
 *
 * Athleisure and tech-casual wear, wireless earbuds, pedestrians scanning QR
 * posters, food couriers with insulated backpacks, dog walkers, and remote
 * workers with laptops at cafe patios. High pedestrian density.
 */

/** Kind of a 2025 pedestrian. */
export type PedestrianKind =
  | 'athleisure'
  | 'tech-casual'
  | 'qr-scanner'
  | 'food-courier'
  | 'dog-walker'
  | 'remote-worker';

/** A 2025-era pedestrian. */
export interface Pedestrian {
  /** Id of the pedestrian. */
  id: string;
  /** Pedestrian archetype. */
  kind: PedestrianKind;
  /** Display label. */
  label: string;
  /** Whether wearing wireless earbuds. */
  earbuds: boolean;
  /** Whether carrying a phone scanning a QR poster. */
  scanningQr: boolean;
  /** Whether carrying a delivery backpack. */
  backpack: boolean;
}

/** The 2025 high-density pedestrian set. */
export const pedestrians: readonly Pedestrian[] = Object.freeze([
  { id: 'p1', kind: 'athleisure', label: 'Athleisure jogger', earbuds: true, scanningQr: false, backpack: false },
  { id: 'p2', kind: 'athleisure', label: 'Athleisure commuter', earbuds: true, scanningQr: false, backpack: false },
  { id: 'p3', kind: 'tech-casual', label: 'Tech-casual worker', earbuds: true, scanningQr: false, backpack: false },
  { id: 'p4', kind: 'tech-casual', label: 'Tech-casual student', earbuds: true, scanningQr: false, backpack: false },
  { id: 'p5', kind: 'qr-scanner', label: 'QR poster scanner', earbuds: true, scanningQr: true, backpack: false },
  { id: 'p6', kind: 'qr-scanner', label: 'QR poster scanner', earbuds: true, scanningQr: true, backpack: false },
  { id: 'p7', kind: 'food-courier', label: 'Food courier', earbuds: false, scanningQr: false, backpack: true },
  { id: 'p8', kind: 'food-courier', label: 'Food courier', earbuds: false, scanningQr: false, backpack: true },
  { id: 'p9', kind: 'dog-walker', label: 'Dog walker', earbuds: true, scanningQr: false, backpack: false },
  { id: 'p10', kind: 'remote-worker', label: 'Remote worker', earbuds: true, scanningQr: false, backpack: false },
  { id: 'p11', kind: 'remote-worker', label: 'Remote worker', earbuds: true, scanningQr: false, backpack: false },
  { id: 'p12', kind: 'tech-casual', label: 'Tech-casual shopper', earbuds: true, scanningQr: false, backpack: false },
]);