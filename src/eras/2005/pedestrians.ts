
import { CityBlockLayout } from '../../layout/cityBlockLayout';

export type PedestrianArchetype =
  | 'casual_lowrise'
  | 'business_casual'
  | 'ipod_earbuds'
  | 'flip_phone'
  | 'parent_stroller'
  | 'messenger_bag';

export interface EraPedestrian {
  readonly id: string;
  readonly archetype: PedestrianArchetype;
  readonly label: string;
}

export interface EraPedestrians {
  readonly pedestrians: readonly EraPedestrian[];
  /** Busy pedestrian density. */
  readonly density: 'busy';
}

const PEDESTRIANS: readonly [PedestrianArchetype, string][] = [
  ['casual_lowrise', 'Casual low-rise jeans and graphic tee'],
  ['business_casual', 'Business casual'],
  ['ipod_earbuds', 'iPod-era white earbuds'],
  ['flip_phone', 'Flip phone in hand'],
  ['parent_stroller', 'Parent with stroller'],
  ['messenger_bag', 'Messenger bag'],
];

export function createEra2005Pedestrians(
  _layout: CityBlockLayout,
): EraPedestrians {




  const pedestrians: EraPedestrian[] = [];
  PEDESTRIANS.forEach(([archetype, label], i) => {
    pedestrians.push({ id: `era2005-pedestrian-${i}`, archetype, label });
  });
  return { pedestrians, density: 'busy' };
}
