export type Era = {
  year: number;
  label: string;
  color: string;
  fogColor: string;
  ambient: number;
  groundColor: string;
  buildingStyle: 'brick' | 'concrete' | 'glass';
  trafficDensity: number;
  pedestrianDensity: number;
  signage: 'neon' | 'led' | 'paper' | 'digital';
  vegetation: 'sparse' | 'moderate' | 'abundant';
  roadMarkings: 'solid' | 'dashed' | 'digital';
};

export const ERAS: Era[] = [
  {
    year: 1945,
    label: 'Post-War',
    color: '#8b4513',
    fogColor: '#d2b48c',
    ambient: 0.35,
    groundColor: '#5d4037',
    buildingStyle: 'brick',
    trafficDensity: 0.2,
    pedestrianDensity: 0.3,
    signage: 'paper',
    vegetation: 'sparse',
    roadMarkings: 'solid',
  },
  {
    year: 1965,
    label: 'Sixties',
    color: '#a0522d',
    fogColor: '#e0c9a6',
    ambient: 0.4,
    groundColor: '#6d4c41',
    buildingStyle: 'concrete',
    trafficDensity: 0.4,
    pedestrianDensity: 0.4,
    signage: 'neon',
    vegetation: 'moderate',
    roadMarkings: 'solid',
  },
  {
    year: 1985,
    label: 'Eighties',
    color: '#c19a6b',
    fogColor: '#f0e6d2',
    ambient: 0.45,
    groundColor: '#795548',
    buildingStyle: 'concrete',
    trafficDensity: 0.6,
    pedestrianDensity: 0.5,
    signage: 'neon',
    vegetation: 'moderate',
    roadMarkings: 'dashed',
  },
  {
    year: 2005,
    label: 'Noughties',
    color: '#d7ccc8',
    fogColor: '#ffffff',
    ambient: 0.5,
    groundColor: '#8d6e63',
    buildingStyle: 'glass',
    trafficDensity: 0.8,
    pedestrianDensity: 0.7,
    signage: 'led',
    vegetation: 'moderate',
    roadMarkings: 'dashed',
  },
  {
    year: 2025,
    label: 'Present',
    color: '#eceff1',
    fogColor: '#ffffff',
    ambient: 0.55,
    groundColor: '#9575cd',
    buildingStyle: 'glass',
    trafficDensity: 0.9,
    pedestrianDensity: 0.8,
    signage: 'digital',
    vegetation: 'abundant',
    roadMarkings: 'digital',
  },
  {
    year: 2055,
    label: 'Future',
    color: '#bb86fc',
    fogColor: '#000000',
    ambient: 0.6,
    groundColor: '#424242',
    buildingStyle: 'glass',
    trafficDensity: 0.3,
    pedestrianDensity: 0.4,
    signage: 'digital',
    vegetation: 'abundant',
    roadMarkings: 'digital',
  },
];

export const YEAR_OPTIONS = ERAS.map((e) => e.year);

export function getEraByYear(year: number): Era {
  return ERAS.find((e) => e.year === year) ?? ERAS[0];
}

export function getEraIndex(year: number): number {
  return ERAS.findIndex((e) => e.year === year);
}

export function lerpEras(from: Era, to: Era, t: number): Era {
  const lerp = (a: number, b: number) => a + (b - a) * t;
  const lerpStr = (a: string, b: string) => {
    const ah = parseInt(a.slice(1), 16);
    const bh = parseInt(b.slice(1), 16);
    const r = Math.round((ah >> 16) + (((bh >> 16) & 0xff) - (ah >> 16)) * t) & 0xff;
    const g = Math.round((ah >> 8) + (((bh >> 8) & 0xff) - (ah >> 8)) * t) & 0xff;
    const bb = Math.round((ah & 0xff) + ((bh & 0xff) - (ah & 0xff)) * t) & 0xff;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bb.toString(16).padStart(2, '0')}`;
  };
  return {
    year: Math.round(lerp(from.year, to.year)),
    label: to.label,
    color: lerpStr(from.color, to.color),
    fogColor: lerpStr(from.fogColor, to.fogColor),
    ambient: lerp(from.ambient, to.ambient),
    groundColor: lerpStr(from.groundColor, to.groundColor),
    buildingStyle: t >= 0.5 ? to.buildingStyle : from.buildingStyle,
    trafficDensity: lerp(from.trafficDensity, to.trafficDensity),
    pedestrianDensity: lerp(from.pedestrianDensity, to.pedestrianDensity),
    signage: t >= 0.5 ? to.signage : from.signage,
    vegetation: t >= 0.5 ? to.vegetation : from.vegetation,
    roadMarkings: t >= 0.5 ? to.roadMarkings : from.roadMarkings,
  };
}
