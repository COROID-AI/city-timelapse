import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

interface WeatherEffectsProps {
  hasRain: boolean;
  hasSnow: boolean;
  transitionProgress: number;
}

export const WeatherEffects = ({ hasRain, hasSnow, transitionProgress }: WeatherEffectsProps) => {
  const rainRef = useRef<THREE.Points>(null);
  const snowRef = useRef<THREE.Points>(null);

  const rainCount = 1000;
  const snowCount = 500;

  const rainGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(rainCount * 3);
    const velocities = new Float32Array(rainCount * 3);

    for (let i = 0; i < rainCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = Math.random() * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;

      velocities[i * 3] = (Math.random() - 0.5) * 0.5;
      velocities[i * 3 + 1] = -Math.random() * 10 - 5;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    return geometry;
  }, []);

  const snowGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(snowCount * 3);
    const velocities = new Float32Array(snowCount * 3);

    for (let i = 0; i < snowCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = Math.random() * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;

      velocities[i * 3] = (Math.random() - 0.5) * 0.5;
      velocities[i * 3 + 1] = -Math.random() * 2 - 0.5;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    return geometry;
  }, []);

  const rainMaterial = useMemo(() => {
    return new THREE.PointsMaterial({
      color: '#88CCFF',
      size: 0.15,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
      depthWrite: false,
    });
  }, []);

  const snowMaterial = useMemo(() => {
    return new THREE.PointsMaterial({
      color: '#FFFFFF',
      size: 0.3,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
      depthWrite: false,
    });
  }, []);

  useFrame((state, delta) => {
    const intensity = transitionProgress > 0 ? transitionProgress : 0;

    if (rainRef.current && hasRain) {
      rainRef.current.visible = true;
      (rainRef.current.material as THREE.PointsMaterial).opacity = 0.6 * intensity;

      const positions = rainRef.current.geometry.attributes.position.array as Float32Array;
      const velocities = rainRef.current.geometry.attributes.velocity.array as Float32Array;

      for (let i = 0; i < rainCount; i++) {
        positions[i * 3] += velocities[i * 3] * delta * 60;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * delta * 60;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * delta * 60;

        // Reset when below ground
        if (positions[i * 3 + 1] < -5) {
          positions[i * 3] = (Math.random() - 0.5) * 80;
          positions[i * 3 + 1] = 40;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
        }
      }

      rainRef.current.geometry.attributes.position.needsUpdate = true;
    } else if (rainRef.current) {
      rainRef.current.visible = false;
    }

    if (snowRef.current && hasSnow) {
      snowRef.current.visible = true;
      (snowRef.current.material as THREE.PointsMaterial).opacity = 0.8 * intensity;

      const positions = snowRef.current.geometry.attributes.position.array as Float32Array;
      const velocities = snowRef.current.geometry.attributes.velocity.array as Float32Array;

      for (let i = 0; i < snowCount; i++) {
        positions[i * 3] += velocities[i * 3] * delta * 60;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * delta * 60;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * delta * 60;

        // Reset when below ground
        if (positions[i * 3 + 1] < -5) {
          positions[i * 3] = (Math.random() - 0.5) * 80;
          positions[i * 3 + 1] = 40;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
        }
      }

      snowRef.current.geometry.attributes.position.needsUpdate = true;
    } else if (snowRef.current) {
      snowRef.current.visible = false;
    }
  });

  return (
    <>
      <points ref={rainRef} geometry={rainGeometry} material={rainMaterial} />
      <points ref={snowRef} geometry={snowGeometry} material={snowMaterial} />
    </>
  );
};
