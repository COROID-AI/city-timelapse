import { useMemo } from 'react';
import { useEra } from '../contexts/EraContext';
import type { EraYear } from '../types';

interface AtmosphereConfig {
  year: EraYear;
  fogDensity: number;
  fogColor: [number, number, number];
  skyTopColor: [number, number, number];
  skyBottomColor: [number, number, number];
  sunElevation: number;
  sunAzimuth: number;
  shadowColor: [number, number, number];
  shadowIntensity: number;
  bloomStrength: number;
  bloomRadius: number;
  ambientColor: [number, number, number];
  ambientIntensity: number;
  directionalColor: [number, number, number];
  directionalIntensity: number;
  pointLightColor: [number, number, number];
  pointLightIntensity: number;
  hazeColor: [number, number, number];
  hazeDensity: number;
}

const eraAtmosphere: Record<EraYear, AtmosphereConfig> = {
  1945: {
    year: 1945,
    fogDensity: 0.025,
    fogColor: [0.23, 0.23, 0.23],
    skyTopColor: [0.4, 0.45, 0.55],
    skyBottomColor: [0.65, 0.55, 0.4],
    sunElevation: 18,
    sunAzimuth: 210,
    shadowColor: [0.15, 0.12, 0.1],
    shadowIntensity: 0.7,
    bloomStrength: 0.3,
    bloomRadius: 0.4,
    ambientColor: [0.45, 0.4, 0.35],
    ambientIntensity: 0.35,
    directionalColor: [1.0, 0.9, 0.75],
    directionalIntensity: 0.55,
    pointLightColor: [1.0, 0.85, 0.6],
    pointLightIntensity: 0.25,
    hazeColor: [0.7, 0.55, 0.35],
    hazeDensity: 0.018,
  },
  1965: {
    year: 1965,
    fogDensity: 0.02,
    fogColor: [0.35, 0.42, 0.35],
    skyTopColor: [0.45, 0.42, 0.38],
    skyBottomColor: [0.85, 0.6, 0.35],
    sunElevation: 12,
    sunAzimuth: 240,
    shadowColor: [0.18, 0.14, 0.1],
    shadowIntensity: 0.6,
    bloomStrength: 0.35,
    bloomRadius: 0.45,
    ambientColor: [0.5, 0.42, 0.35],
    ambientIntensity: 0.35,
    directionalColor: [1.0, 0.88, 0.7],
    directionalIntensity: 0.6,
    pointLightColor: [1.0, 0.8, 0.55],
    pointLightIntensity: 0.28,
    hazeColor: [0.75, 0.55, 0.3],
    hazeDensity: 0.014,
  },
  1985: {
    year: 1985,
    fogDensity: 0.015,
    fogColor: [0.42, 0.47, 0.53],
    skyTopColor: [0.12, 0.1, 0.25],
    skyBottomColor: [0.55, 0.4, 0.5],
    sunElevation: 6,
    sunAzimuth: 270,
    shadowColor: [0.08, 0.06, 0.18],
    shadowIntensity: 0.8,
    bloomStrength: 0.8,
    bloomRadius: 0.6,
    ambientColor: [0.3, 0.28, 0.4],
    ambientIntensity: 0.3,
    directionalColor: [0.8, 0.85, 1.0],
    directionalIntensity: 0.4,
    pointLightColor: [0.3, 1.0, 0.7],
    pointLightIntensity: 0.5,
    hazeColor: [0.35, 0.25, 0.6],
    hazeDensity: 0.01,
  },
  2005: {
    year: 2005,
    fogDensity: 0.01,
    fogColor: [0.54, 0.6, 0.67],
    skyTopColor: [0.45, 0.52, 0.6],
    skyBottomColor: [0.7, 0.68, 0.65],
    sunElevation: 55,
    sunAzimuth: 180,
    shadowColor: [0.12, 0.13, 0.16],
    shadowIntensity: 0.5,
    bloomStrength: 0.35,
    bloomRadius: 0.4,
    ambientColor: [0.55, 0.55, 0.58],
    ambientIntensity: 0.4,
    directionalColor: [1.0, 0.98, 0.95],
    directionalIntensity: 0.65,
    pointLightColor: [1.0, 0.95, 0.85],
    pointLightIntensity: 0.3,
    hazeColor: [0.6, 0.55, 0.5],
    hazeDensity: 0.006,
  },
  2025: {
    year: 2025,
    fogDensity: 0.007,
    fogColor: [0.66, 0.72, 0.78],
    skyTopColor: [0.35, 0.45, 0.6],
    skyBottomColor: [0.78, 0.8, 0.82],
    sunElevation: 70,
    sunAzimuth: 200,
    shadowColor: [0.08, 0.1, 0.14],
    shadowIntensity: 0.4,
    bloomStrength: 0.4,
    bloomRadius: 0.45,
    ambientColor: [0.6, 0.62, 0.68],
    ambientIntensity: 0.45,
    directionalColor: [1.0, 0.98, 0.95],
    directionalIntensity: 0.7,
    pointLightColor: [0.7, 0.85, 1.0],
    pointLightIntensity: 0.35,
    hazeColor: [0.55, 0.6, 0.65],
    hazeDensity: 0.004,
  },
  2055: {
    year: 2055,
    fogDensity: 0.005,
    fogColor: [0.8, 0.82, 0.88],
    skyTopColor: [0.45, 0.35, 0.65],
    skyBottomColor: [0.82, 0.84, 0.9],
    sunElevation: 50,
    sunAzimuth: 160,
    shadowColor: [0.05, 0.04, 0.12],
    shadowIntensity: 0.3,
    bloomStrength: 0.6,
    bloomRadius: 0.7,
    ambientColor: [0.55, 0.5, 0.62],
    ambientIntensity: 0.5,
    directionalColor: [0.9, 0.85, 1.0],
    directionalIntensity: 0.6,
    pointLightColor: [0.4, 0.6, 1.0],
    pointLightIntensity: 0.45,
    hazeColor: [0.5, 0.45, 0.65],
    hazeDensity: 0.003,
  },
};

interface EraBlend {
  fogColor: number;
  fogNear: number;
  fogFar: number;
  background: number;
  t: number;
  lo: EraYear;
  hi: EraYear;
}

function lerpVec3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function lerpEraConfig(lo: AtmosphereConfig, hi: AtmosphereConfig, t: number): AtmosphereConfig {
  return {
    year: lo.year,
    fogDensity: lo.fogDensity + (hi.fogDensity - lo.fogDensity) * t,
    fogColor: lerpVec3(lo.fogColor, hi.fogColor, t) as [number, number, number],
    skyTopColor: lerpVec3(lo.skyTopColor, hi.skyTopColor, t) as [number, number, number],
    skyBottomColor: lerpVec3(lo.skyBottomColor, hi.skyBottomColor, t) as [number, number, number],
    sunElevation: lo.sunElevation + (hi.sunElevation - lo.sunElevation) * t,
    sunAzimuth: lo.sunAzimuth + (hi.sunAzimuth - lo.sunAzimuth) * t,
    shadowColor: lerpVec3(lo.shadowColor, hi.shadowColor, t) as [number, number, number],
    shadowIntensity: lo.shadowIntensity + (hi.shadowIntensity - lo.shadowIntensity) * t,
    bloomStrength: lo.bloomStrength + (hi.bloomStrength - lo.bloomStrength) * t,
    bloomRadius: lo.bloomRadius + (hi.bloomRadius - lo.bloomRadius) * t,
    ambientColor: lerpVec3(lo.ambientColor, hi.ambientColor, t) as [number, number, number],
    ambientIntensity: lo.ambientIntensity + (hi.ambientIntensity - lo.ambientIntensity) * t,
    directionalColor: lerpVec3(lo.directionalColor, hi.directionalColor, t) as [number, number, number],
    directionalIntensity: lo.directionalIntensity + (hi.directionalIntensity - lo.directionalIntensity) * t,
    pointLightColor: lerpVec3(lo.pointLightColor, hi.pointLightColor, t) as [number, number, number],
    pointLightIntensity: lo.pointLightIntensity + (hi.pointLightIntensity - lo.pointLightIntensity) * t,
    hazeColor: lerpVec3(lo.hazeColor, hi.hazeColor, t) as [number, number, number],
    hazeDensity: lo.hazeDensity + (hi.hazeDensity - lo.hazeDensity) * t,
  };
}

export interface AtmosphereSystemProps {
  year: EraYear;
  eraBlend: EraBlend;
}

export function AtmosphereSystem({ year, eraBlend }: AtmosphereSystemProps) {
  const cfg = useMemo(() => {
    const lo = eraAtmosphere[eraBlend.lo];
    const hi = eraAtmosphere[eraBlend.hi];
    return lerpEraConfig(lo, hi, eraBlend.t);
  }, [eraBlend]);

  // Convert spherical sun position to Cartesian
  const sunPos = useMemo(() => {
    const elRad = (cfg.sunElevation * Math.PI) / 180;
    const azRad = (cfg.sunAzimuth * Math.PI) / 180;
    const dist = 40;
    return [
      Math.cos(elRad) * Math.sin(azRad) * dist,
      Math.sin(elRad) * dist,
      Math.cos(elRad) * Math.cos(azRad) * dist,
    ];
  }, [cfg.sunElevation, cfg.sunAzimuth]);

  return (
    <group name="atmosphere">
      {/* Sky dome */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[250, 32, 32]} />
        <meshBasicMaterial side={2} color={cfg.skyTopColor} />
      </mesh>
      {/* Sky gradient using two overlapping spheres */}
      <mesh position={[0, -2, 0]}>
        <sphereGeometry args={[248, 32, 32]} />
        <meshBasicMaterial side={2} color={cfg.skyBottomColor} />
      </mesh>

      {/* Fog overlay via dense atmospheric plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, 0]}>
        <planeGeometry args={[600, 600]} />
        <meshBasicMaterial
          color={cfg.hazeColor}
          transparent
          // Clamp haze overlay so it doesn't fully wash out the scene.
          // (AI evidence previously showed only dark terrain without era details.)
          opacity={Math.min(1, cfg.hazeDensity * 35)}
          depthWrite={false}
        />
      </mesh>

      {/* Sun directional light — position driven by time-of-day per era */}
      <directionalLight
        position={sunPos as [number, number, number]}
        intensity={cfg.directionalIntensity}
        color={cfg.directionalColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={200}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      >
        <orthographicCamera attach="shadow-camera" args={[-80, 80, 80, -80, 0.1, 200]} />
      </directionalLight>

      {/* Ambient light — warmer/cooler per era */}
      <ambientLight intensity={cfg.ambientIntensity} color={cfg.ambientColor} />

      {/* Point fill light — atmospheric spill */}
      <pointLight
        position={[0, 15, 0]}
        intensity={cfg.pointLightIntensity}
        color={cfg.pointLightColor}
        distance={100}
      />

    </group>
  );
}

export default AtmosphereSystem;