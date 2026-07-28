import { useStore } from '../state';
import { ERA_DATA } from './eras';
import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, FogExp2 } from 'three';

interface Props {
  era: any;
}

function getEraIndex(year: number): number {
  return [1945, 1965, 1985, 2005, 2025, 2055].indexOf(year);
}

export default function Atmosphere({ era }: Props) {
  const { scene } = useThree();
  const fogRef = useRef<FogExp2 | null>(null);
  const bgColorRef = useRef(new Color(0x87CEEB));
  const fogColorRef = useRef(new Color(0x888888));

  // Selector-based reactive era interpolation - avoids getState() calls in render
  const currentEra = useStore((s) => s.currentEra);
  const targetEra = useStore((s) => s.targetEra);
  const transitionProgress = useStore((s) => s.transitionProgress);
  const isTransitioning = useStore((s) => s.isTransitioning);

  // Memoize the interpolated era to avoid recreating the object every frame
  const interpolatedEra = useMemo(() => {
    if (!isTransitioning) return ERA_DATA[[1945, 1965, 1985, 2005, 2025, 2055][currentEra]];

    const currentData = ERA_DATA[[1945, 1965, 1985, 2005, 2025, 2055][currentEra]];
    const targetData = ERA_DATA[[1945, 1965, 1985, 2005, 2025, 2055][targetEra]];
    const t = transitionProgress;

    const lerp = (a: number, b: number) => a + (b - a) * t;
    const lerpArr3 = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];

    return {
      ...currentData,
      year: Math.round(lerp(currentData.year, targetData.year)),
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
      hasFog: t < 0.5 ? currentData.hasFog : targetData.hasFog,
      hasStars: t < 0.5 ? currentData.hasStars : targetData.hasStars,
      starDensity: lerp(currentData.starDensity, targetData.starDensity),
      hasFlying: t < 0.5 ? currentData.hasFlying : targetData.hasFlying,
      hasHolograms: t < 0.5 ? currentData.hasHolograms : targetData.hasHolograms,
      hasElectricVehicles: t < 0.5 ? currentData.hasElectricVehicles : targetData.hasElectricVehicles,
      hasClassicCars: t < 0.5 ? currentData.hasClassicCars : targetData.hasClassicCars,
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
  }, [currentEra, targetEra, transitionProgress, isTransitioning]);

  useFrame(() => {
    // Reuse existing FogExp2 object instead of creating new ones every frame
    const fogDensity = interpolatedEra.fogDensity;
    if (fogDensity > 0.001) {
      if (!fogRef.current) {
        fogRef.current = new FogExp2(0xffffff, 0.01);
      }
      fogColorRef.current.setRGB(...interpolatedEra.fogColor);
      fogRef.current.color.copy(fogColorRef.current);
      fogRef.current.density = fogDensity;
      scene.fog = fogRef.current;
    } else {
      scene.fog = null;
    }

    // Reuse color object instead of creating new ones every frame
    bgColorRef.current.setRGB(...interpolatedEra.skyColor);
    scene.background = bgColorRef.current;
  });

  // Convert 0–1 RGB to a Three.js hex color string
  const toHex = (c: [number, number, number]) =>
    '#' + c.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');

  return (
    <>
      <ambientLight intensity={era.ambientIntensity} color={toHex(era.ambientColor)} />
      <directionalLight position={era.sunPosition} intensity={era.sunIntensity} color={toHex(era.sunColor)} />
      <hemisphereLight color="#ffddaa" groundColor="#aabbcc" intensity={1.5} />
      <pointLight position={[0, 10, 0]} intensity={1.5} color="#ffffff" />
    </>
  );
}
