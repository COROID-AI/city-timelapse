
import { CityBlockLayout } from '../../layout/cityBlockLayout';

export type FurnitureKind =
  | 'led_street_light'
  | 'bus_shelter'
  | 'bike_rack'
  | 'newspaper_box'
  | 'public_trash_bin'
  | 'fire_hydrant'
  | 'street_tree_planter';

export interface EraFurniture {
  readonly id: string;
  readonly kind: FurnitureKind;
  readonly label: string;
}

export interface EraStreetFurniture {
  readonly furniture: readonly EraFurniture[];
}

const FURNITURE: readonly [FurnitureKind, string][] = [
  ['led_street_light', 'Cool-white LED-prototype street light'],
  ['bus_shelter', 'Bus shelter with ad panels'],
  ['bike_rack', 'Bike rack'],
  ['newspaper_box', 'Curbside newspaper box'],
  ['public_trash_bin', 'Large public trash bin'],
  ['fire_hydrant', 'Fire hydrant'],
  ['street_tree_planter', 'Street tree in planter'],
];

export function createEra2005StreetFurniture(
  _layout: CityBlockLayout,
): EraStreetFurniture {




  const furniture: EraFurniture[] = [];
  FURNITURE.forEach(([kind, label], i) => {
    furniture.push({ id: `era2005-furniture-${i}`, kind, label });
  });
  return { furniture };
}
