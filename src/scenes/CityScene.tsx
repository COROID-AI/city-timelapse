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

  // Audio context and oscillators for ambient era-appropriate sounds
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Initialize audio on first user interaction (autoplay policy)
  useEffect(() => {
    const initAudio = async () => {
      if (audioContextRef.current) return;
      
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = ctx;
        
        // Create master gain node
        const gain = ctx.createGain();
        gain.gain.value = 0.05; // Low ambient volume
        gain.connect(ctx.destination);
        gainNodeRef.current = gain;

        // Create ambient oscillators based on current era
        createAmbientSound(ctx, gain, currentEra, oscillatorsRef);
      } catch (e) {
        console.warn('Audio initialization failed:', e);
      }
    };

    // Initialize on first user interaction
    const handler = () => {
      initAudio();
      window.removeEventListener('click', handler);
      window.removeEventListener('keydown', handler);
    };
    window.addEventListener('click', handler);
    window.addEventListener('keydown', handler);

    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('keydown', handler);
    };
  }, [currentEra]);

  // Update ambient sound when era changes
  useEffect(() => {
    if (audioContextRef.current && gainNodeRef.current) {
      // Stop and disconnect existing oscillators
      oscillatorsRef.current.forEach(osc => {
        try { osc.stop(); osc.disconnect(); } catch { /* already stopped */ }
      });
      oscillatorsRef.current = [];
      
      // Create new ambient sound for new era
      createAmbientSound(audioContextRef.current, gainNodeRef.current, currentEra, oscillatorsRef);
    }
  }, [currentEra]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      // Stop and disconnect all oscillators
      oscillatorsRef.current.forEach(osc => {
        try { osc.stop(); osc.disconnect(); } catch { /* already stopped */ }
      });
      oscillatorsRef.current = [];

      // Close audio context
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch { /* already closed */ }
        audioContextRef.current = null;
      }
      gainNodeRef.current = null;
    };
  }, []);

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

// Create era-appropriate ambient sound
function createAmbientSound(ctx: AudioContext, gain: GainNode, eraIndex: number, oscillatorsRef: React.MutableRefObject<OscillatorNode[]>) {
  const eraYears = [1945, 1965, 1985, 2005, 2025, 2055];
  const year = eraYears[eraIndex];
  
  // Define frequencies for each era's ambient feel
  const eraFreqs: Record<number, number[]> = {
    1945: [60, 120, 180],      // Low hum - post-war industrial
    1965: [110, 220, 330],     // Mid-century hum
    1985: [150, 300, 600],     // Neon buzz
    2005: [200, 400, 800],     // Digital hum
    2025: [250, 500, 1000],    // Smart city
    2055: [300, 600, 1200],    // Futuristic
  };
  
  const freqs = eraFreqs[year] || [110, 220, 330];
  
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = freq;
    oscGain.gain.value = 0.3 / (i + 1); // Decreasing volume for harmonics
    
    osc.connect(oscGain);
    oscGain.connect(gain);
    osc.start();
    
    oscillatorsRef.current.push(osc);
  });
}
