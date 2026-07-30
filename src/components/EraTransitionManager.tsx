import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Era, EraConfig, eraConfigs } from '../data/eraData';
import * as THREE from 'three';

interface EraTransitionManagerProps {
  currentEra: Era;
  /** Target era to transition towards */
  targetEra: Era | null;
}

/**
 * EraTransitionManager: smoothly interpolates sky color, fog,
 * ambient light intensity, and sun position when the user
 * switches between city eras 1945–2055.
 * Runs inside the R3 Canvas via useFrame for correct timing.
 */
const EraTransitionManager: React.FC<EraTransitionManagerProps> = ({ currentEra, targetEra }) => {
  const { scene } = useThree();
  const animRef = useRef<number>(0);

  // Transition state stored in refs so it survives React renders
  const fromRef = useRef<EraConfig>(eraConfigs[currentEra]);
  const toRef = useRef<EraConfig>(eraConfigs[currentEra]);
  const progressRef = useRef(1); // 1 = no active transition
  const durationRef = useRef(1.2);

  // Update `to` config when target era changes
  useEffect(() => {
    if (targetEra !== null && targetEra !== currentEra) {
      fromRef.current = eraConfigs[currentEra];
      toRef.current = eraConfigs[targetEra];
      progressRef.current = 0;
      durationRef.current = 1.2;
    }
  }, [currentEra, targetEra]);

  useFrame(() => {
    if (progressRef.current >= 1) return;

    progressRef.current += 0.016 / durationRef.current;
    if (progressRef.current >= 1) {
      progressRef.current = 1;
    }

    const p = progressRef.current;
    const ease = p * p * (3 - 2 * p); // smoothstep hermite

    const from = fromRef.current;
    const to = toRef.current;

    // Interpolate sky color (all are hex numbers)
    const skyR = from.skyColor + (to.skyColor - from.skyColor) * ease;
    const skyHex = `#${Math.round(skyR).toString(16).padStart(6, '0')}`;
    scene.background = new THREE.Color(skyHex);
    scene.fog = new THREE.Fog(skyHex, 80, 350);

    // Walk lights and interpolate
    scene.traverse((child) => {
      if ('isLight' in child) {
        const light = child as THREE.Light;
        if (light.isAmbientLight) {
          light.intensity = from.ambientIntensity + (to.ambientIntensity - from.ambientIntensity) * ease;
        }
        if (light.isDirectionalLight) {
          light.position.set(
            from.sunPosition[0],
            from.sunPosition[1] + (to.sunPosition[1] - from.sunPosition[1]) * ease,
            from.sunPosition[2]
          );
          light.intensity = from.sunIntensity + (to.sunIntensity - from.sunIntensity) * ease;
        }
      }
    });
  });

  return null;
};

export default EraTransitionManager;
