
import { CityBlockLayout } from '../../layout/cityBlockLayout';
import { LotAnchor } from '../../layout/lotAnchors';

export interface BuildingCladding {
 readonly material: string;
 readonly r: number;
 readonly g: number;
 readonly b: number;
}

export interface RooftopFeature {
 readonly kind: 'satellite_dish' | 'antenna' | 'ac_unit';
 readonly positionX: number;
 readonly positionZ: number;
}

export interface EraBuilding {
 readonly id: string;
 readonly lotIndex: number;
 readonly type:
 | 'glass_stone_condo'
 | 'office_conversion'
 | 'midrise_residential'
 | 'brick_walkup'
 | 'storefront_system'
 | 'construction_hoarding';
 readonly cladding: readonly BuildingCladding[];
 readonly height: number;
 readonly rooftop: readonly RooftopFeature[];
 readonly balconies: boolean;
}

export const ERA_2005_BUILDING_TYPES = [
 'glass_stone_condo',
 'office_conversion',
 'midrise_residential',
 'brick_walkup',
 'storefront_system',
 'construction_hoarding',
] as const;

export function createEra2005Buildings(
 layout: CityBlockLayout,
): EraBuilding[] {
 const buildings: EraBuilding[] = [];
 const count = layout.lots.length;
 for (let i = 0; i < count; i++) {
 const lot = layout.lots[i];
 const base = pickBuildingType(i, count);
 buildings.push(buildForLot(i, lot, base));
 }
 return buildings;
}

function pickBuildingType(index: number, count: number): EraBuilding['type'] {
 if (index === 4) return 'midrise_residential';
 if (index === count - 1) return 'construction_hoarding';
 if (index % 4 === 0) return 'glass_stone_condo';
 if (index % 4 === 1) return 'office_conversion';
 if (index % 4 === 2) return 'storefront_system';
 return 'brick_walkup';
}

function buildForLot(
 index: number,
 _lot: LotAnchor,
 type: EraBuilding['type'],
): EraBuilding {
 const roof: RooftopFeature[] = [];
 const balconies = type === 'midrise_residential' || type === 'glass_stone_condo';
 let height = 14;
 let cladding: BuildingCladding[] = [];

 if (type === 'glass_stone_condo') {
 height = 18;
 cladding = [
 band('glass', 0.62, 0.68, 0.72),
 band('stone', 0.78, 0.8, 0.82),
 ];
 roof.push({ kind: 'satellite_dish', positionX: 2.5, positionZ: 2.5 });
 roof.push({ kind: 'ac_unit', positionX: -2.5, positionZ: -2.5 });
 } else if (type === 'office_conversion') {
 height = 16;
 cladding = [
 band('glass', 0.6, 0.66, 0.7),
 band('aluminum', 0.7, 0.72, 0.75),
 ];
 roof.push({ kind: 'satellite_dish', positionX: 2, positionZ: -3 });
 } else if (type === 'midrise_residential') {
 height = 22;
 cladding = [
 band('stone', 0.78, 0.8, 0.82),
 band('glass', 0.62, 0.68, 0.72),
 ];
 roof.push({ kind: 'satellite_dish', positionX: 3, positionZ: 3 });
 roof.push({ kind: 'satellite_dish', positionX: -3, positionZ: -3 });
 roof.push({ kind: 'antenna', positionX: 0, positionZ: 0 });
 } else if (type === 'brick_walkup') {
 height = 12;
 cladding = [
 band('brick', 0.55, 0.36, 0.28),
 band('stucco', 0.84, 0.8, 0.74),
 ];
 roof.push({ kind: 'satellite_dish', positionX: 1.5, positionZ: 1.5 });
 } else if (type === 'storefront_system') {
 height = 9;
 cladding = [
 band('aluminum', 0.7, 0.72, 0.75),
 band('glass', 0.62, 0.68, 0.72),
 ];
 roof.push({ kind: 'ac_unit', positionX: 0, positionZ: 2 });
 } else {
 height = 4;
 cladding = [
 band('hoarding', 0.3, 0.32, 0.36),
 ];
 }

 return {
 id: `era2005-building-${index}`,
 lotIndex: index,
 type,
 cladding,
 height,
 rooftop: roof,
 balconies,
 };
}

function band(material: string, r: number, g: number, b: number): BuildingCladding {
 return { material, r, g, b };
}
