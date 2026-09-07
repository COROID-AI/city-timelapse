
import { CityBlockLayout } from '../../layout/cityBlockLayout';

export type VehicleKind =
  | 'sedan'
  | 'suv'
  | 'hatchback'
  | 'delivery_van'
  | 'city_bus'
  | 'bike_courier';

export interface EraVehicle {
  readonly id: string;
  readonly kind: VehicleKind;
  /** Silver-gray body colour hint. */
  readonly body: string;
  /** Slower stop-and-go traffic (lower speed, frequent stops). */
  readonly stopAndGo: boolean;
}

export interface EraVehicles {
  readonly vehicles: readonly EraVehicle[];
  /** Heavier stop-and-go traffic density factor. */
  readonly trafficDensity: 'heavy';
}

const KINDS: readonly VehicleKind[] = [
  'sedan', 'suv', 'hatchback', 'delivery_van', 'city_bus', 'bike_courier',
];

export function createEra2005Vehicles(
  layout: CityBlockLayout,
): EraVehicles {

  void layout;



  const vehicles: EraVehicle[] = [];
  const bodyColors = ['#b8bcc0', '#a6aab0', '#c2c4c8', '#9a9ea4', '#8c9096'];
  KINDS.forEach((kind, i) => {
    vehicles.push({
      id: `era2005-vehicle-${i}`,
      kind,
      body: bodyColors[i % bodyColors.length],
      stopAndGo: true,
    });
  });
  return { vehicles, trafficDensity: 'heavy' };
}
