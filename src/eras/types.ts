export interface EraInfo {
  year: number;
  name: string;
  description: string;
  skyTop: string;
  skyBottom: string;
  fogColor: string;
  fogDensity: number;
  ambientIntensity: number;
  sunIntensity: number;
  sunColor: string;
  groundColor: string;
  roadColor: string;
  sidewalkColor: string;
  buildingBaseColors: string[];
  windowEmissive: string;
  neonAccent: string;
  vehicleStyle: string;
  pedestrianOutfit: string;
  adTheme: string;
  billboardContent: string;
  treeType: string;
  streetLightColor: string;
  specialEffects: string[];
}

export type EraKey = '1945' | '1965' | '1985' | '2005' | '2025' | '2055';

export const ERA_ORDER: EraKey[] = ['1945', '1965', '1985', '2005', '2025', '2055'];

export function getEraIndex(key: EraKey): number {
  return ERA_ORDER.indexOf(key);
}

export function getAdjacentEra(key: EraKey, dir: -1 | 1): EraKey | null {
  const idx = getEraIndex(key);
  const next = idx + dir;
  if (next < 0 || next >= ERA_ORDER.length) return null;
  return ERA_ORDER[next];
}
