import { EraId } from '../eras';

/**
 * Street layout description
 */
export interface StreetLayout {
  /** Road width in meters */
  roadWidth: number;
  /** Number of lanes */
  lanes: number;
  /** Sidewalk width in meters */
  sidewalkWidth: number;
  /** Whether street has parking */
  hasParking: boolean;
  /** Whether street has bike lane */
  hasBikeLane: boolean;
}

/**
 * Returns street layout and props for the given era
 * @param era The era ID
 * @returns Object containing layout and prop model paths
 */
export function getStreetAssetsForEra(era: EraId): {
  layout: StreetLayout;
  props: string[];
} {
  // Base layout that gets adjusted per era
  const baseLayout: StreetLayout = {
    roadWidth: 10,
    lanes: 2,
    sidewalkWidth: 2,
    hasParking: false,
    hasBikeLane: false,
  };

  // Era-specific layouts and props
  switch (era) {
    case '1945': {
      // Post-War Era: narrower roads, minimal sidewalks, no bike lanes
      const layout: StreetLayout = {
        ...baseLayout,
        roadWidth: 9,
        lanes: 2,
        sidewalkWidth: 1.5,
        hasParking: true, // parallel parking
        hasBikeLane: false,
      };
      const props = [
        'props/lamppost_1945',
        'props/bench_1945',
        'props/trashcan_1945',
        'props/firehydrant_1945',
        'props/sign_stop_1945',
      ];
      return { layout, props };
    }
    case '1965': {
      // Swinging Sixties: wider roads, more lanes, some parking
      const layout: StreetLayout = {
        ...baseLayout,
        roadWidth: 12,
        lanes: 2,
        sidewalkWidth: 2,
        hasParking: true,
        hasBikeLane: false,
      };
      const props = [
        'props/lamppost_1965',
        'props/bench_1965',
        'props/trashcan_1965',
        'props/firehydrant_1965',
        'props/sign_stop_1965',
        'props/busstop_1965',
      ];
      return { layout, props };
    }
    case '1985': {
      // Neon Eighties: wider roads, possible bike lanes emerging
      const layout: StreetLayout = {
        ...baseLayout,
        roadWidth: 13,
        lanes: 2,
        sidewalkWidth: 2,
        hasParking: true,
        hasBikeLane: true, // early bike lanes
      };
      const props = [
        'props/lamppost_1985',
        'props/bench_1985',
        'props/trashcan_1985',
        'props/firehydrant_1985',
        'props/sign_stop_1985',
        'props/trafficlight_1985',
        'props/busstop_1985',
      ];
      return { layout, props };
    }
    case '2005': {
      // Digital Dawn: standard modern streets
      const layout: StreetLayout = {
        ...baseLayout,
        roadWidth: 14,
        lanes: 2,
        sidewalkWidth: 2.5,
        hasParking: true,
        hasBikeLane: true,
      };
      const props = [
        'props/lamppost_modern',
        'props/bench_modern',
        'props/trashcan_modern',
        'props/firehydrant_modern',
        'props/sign_stop_modern',
        'props/trafficlight_modern',
        'props/busstop_modern',
        'props/bikerack',
      ];
      return { layout, props };
    }
    case '2025': {
      // Near Future: wider sidewalks, bike lanes, EV charging
      const layout: StreetLayout = {
        ...baseLayout,
        roadWidth: 14,
        lanes: 2,
        sidewalkWidth: 3,
        hasParking: true, // but with EV spots
        hasBikeLane: true,
      };
      const props = [
        'props/lamppost_future',
        'props/bench_future',
        'props/trashcan_future',
        'props/firehydrant_future',
        'props/sign_stop_future',
        'props/trafficlight_future',
        'props/busstop_future',
        'props/bikerack',
        'props/evcharger',
        'props/informationkiosk',
      ];
      return { layout, props };
    }
    default:
      throw new Error(`Unknown era: ${era}`);
  }
}