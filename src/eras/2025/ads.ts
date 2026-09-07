/**
 * Street-level advertising for the 2025 smart-city EV era.
 *
 * Full-motion LED billboard screen, QR-code posters, digital ad totems on
 * sidewalks, delivery-app decals on doors, and subtle in-window screens.
 */

/** Kind of a 2025 advertisement. */
export type AdKind =
  | 'led-billboard'
  | 'qr-poster'
  | 'ad-totem'
  | 'delivery-decal'
  | 'window-screen';

/** A 2025-era advertisement placement. */
export interface Advertisement {
  /** Id of the ad placement. */
  id: string;
  /** Ad archetype. */
  kind: AdKind;
  /** Display label. */
  label: string;
  /** Whether the ad is a full-motion screen. */
  motion: boolean;
  /** Whether the ad carries a scannable QR code. */
  qr: boolean;
}

/** The 2025 advertisement set. */
export const advertisements: readonly Advertisement[] = Object.freeze([
  {
    id: 'billboard-main',
    kind: 'led-billboard',
    label: 'Corner LED billboard',
    motion: true,
    qr: false,
  },
  {
    id: 'billboard-tower',
    kind: 'led-billboard',
    label: 'Tower LED billboard',
    motion: true,
    qr: false,
  },
  {
    id: 'poster-bus',
    kind: 'qr-poster',
    label: 'Bus stop QR poster',
    motion: false,
    qr: true,
  },
  {
    id: 'poster-totem',
    kind: 'qr-poster',
    label: 'Sidewalk QR poster',
    motion: false,
    qr: true,
  },
  {
    id: 'totem-north',
    kind: 'ad-totem',
    label: 'Digital ad totem (north)',
    motion: true,
    qr: false,
  },
  {
    id: 'totem-south',
    kind: 'ad-totem',
    label: 'Digital ad totem (south)',
    motion: true,
    qr: false,
  },
  {
    id: 'decal-roastery',
    kind: 'delivery-decal',
    label: 'Roastery delivery decal',
    motion: false,
    qr: true,
  },
  {
    id: 'window-coworking',
    kind: 'window-screen',
    label: 'Co-working in-window screen',
    motion: true,
    qr: false,
  },
]);