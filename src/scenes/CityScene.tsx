import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../state';
import { ERA_DATA } from './eras';
import Buildings from './buildings';
import Vehicles from './vehicles';
import Pedestrians from './pedestrians';
import Street from './street';
import StreetLamps from './StreetLamp';
import Billboard from './billboard';
import Fences from './Fence';
import Trees from './Tree';
import Particles from './particles';
import Atmosphere from './atmosphere';

export default function CityScene({ onLoaded }: { onLoaded: () => void }) {
  const currentEra = useStore((s: any) => s.currentEra);
  const targetEra = useStore((s: any) => s.targetEra);
  const transitionProgress = useStore((s: any) => s.transitionProgress);
  const isTransitioning = useStore((s: any) => s.isTransitioning);

  const currentData = ERA_DATA[[1945, 1965, 1985, 2005, 2025, 2055][currentEra]];
  const targetData = ERA_DATA[[1945, 1965, 1985, 2005, 2025, 2055][targetEra]];

  const era = useMemo(() => {
    if (!isTransitioning) return currentData;
    const t = transitionProgress;
    const lerp = (a: number, b: number) => a + (b - a) * t;
    const lerpArr3 = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];
    return {
      year: Math.round(lerp(currentData.year, targetData.year)),
      name: t < 0.5 ? currentData.name : targetData.name,
      skyColor: lerpArr3(currentData.skyColor, targetData.skyColor),
      fogColor: lerpArr3(currentData.fogColor, targetData.fogColor),
      fogDensity: lerp(currentData.fogDensity, targetData.fogDensity),
      ambientIntensity: lerp(currentData.ambientIntensity, targetData.ambientIntensity),
      ambientColor: lerpArr3(currentData.ambientColor, targetData.ambientColor),
      sunIntensity: lerp(currentData.sunIntensity, targetData.sunIntensity),
      sunColor: lerpArr3(currentData.sunColor, targetData.sunColor),
      sunPosition: [
        lerp(currentData.sunPosition[0], targetData.sunPosition[0]),
        lerp(currentData.sunPosition[1], targetData.sunPosition[1]),
        lerp(currentData.sunPosition[2], targetData.sunPosition[2]),
      ] as [number, number, number],
      groundColor: lerpArr3(currentData.groundColor, targetData.groundColor),
      roadColor: lerpArr3(currentData.roadColor, targetData.roadColor),
      buildingStyle: t < 0.5 ? currentData.buildingStyle : targetData.buildingStyle,
      hasSnow: t < 0.5 ? currentData.hasSnow : targetData.hasSnow,
      hasRain: t < 0.5 ? currentData.hasRain : targetData.hasRain,
      hasFog: t < 0.5 ? currentData.hasFog : targetData.hasFog,
      hasStars: t < 0.5 ? currentData.hasStars : targetData.hasStars,
      starDensity: lerp(currentData.starDensity, targetData.starDensity),
      hasFlying: t < 0.5 ? currentData.hasFlying : targetData.hasFlying,
      hasHolograms: t < 0.5 ? currentData.hasHolograms : targetData.hasHolograms,
      hasElectricVehicles: t < 0.5 ? currentData.hasElectricVehicles : targetData.hasElectricVehicles,
      hasClassicCars: t < 0.5 ? currentData.hasClassicCars : targetData.hasClassicCars,
      hasMilitaryVehicles: t < 0.5 ? currentData.hasMilitaryVehicles : targetData.hasMilitaryVehicles,
      hasModernSedan: t < 0.5 ? currentData.hasModernSedan : targetData.hasModernSedan,
      hasNeonSigns: t < 0.5 ? currentData.hasNeonSigns : targetData.hasNeonSigns,
      hasDigitalBillboards: t < 0.5 ? currentData.hasDigitalBillboards : targetData.hasDigitalBillboards,
      hasHolographicAds: t < 0.5 ? currentData.hasHolographicAds : targetData.hasHolographicAds,
      streetLampStyle: t < 0.5 ? currentData.streetLampStyle : targetData.streetLampStyle,
      sidewalkStyle: t < 0.5 ? currentData.sidewalkStyle : targetData.sidewalkStyle,
      pedestrianStyle: t < 0.5 ? currentData.pedestrianStyle : targetData.pedestrianStyle,
      treeStyle: t < 0.5 ? currentData.treeStyle : targetData.treeStyle,
      fenceStyle: t < 0.5 ? currentData.fenceStyle : targetData.fenceStyle,
      billboardAdStyle: t < 0.5 ? currentData.billboardAdStyle : targetData.billboardAdStyle,
      particleType: t < 0.5 ? currentData.particleType : targetData.particleType,
    };
  }, [currentData, targetData, transitionProgress, isTransitioning, currentEra, targetEra]);

  useEffect(() => {
    onLoaded();
  }, [onLoaded]);

  return (
    <group>
      <Atmosphere era={era} />
      <Street era={era} />
      <Buildings era={era} />
      <Vehicles era={era} />
      <Pedestrians era={era} />
      <StreetLamps era={era} />
      <Billboard era={era} />
      <Fences era={era} />
      <Trees era={era} />
      <Particles era={era} />
    </group>
  );
}
