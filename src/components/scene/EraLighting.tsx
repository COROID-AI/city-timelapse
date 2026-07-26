import { useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';

interface EraLightingProps {
  ambientColor: string;
  directionalColor: string;
  sunPosition: [number, number, number];
}

export const EraLighting = ({ ambientColor, directionalColor, sunPosition }: EraLightingProps) => {
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const directionalRef = useRef<THREE.DirectionalLight>(null);
  const sunMeshRef = useRef<THREE.Mesh>(null);

  const sunColor = useMemo(() => new THREE.Color(directionalColor), [directionalColor]);
  const ambientCol = useMemo(() => new THREE.Color(ambientColor), [ambientColor]);

  useFrame(() => {
    if (ambientRef.current) {
      ambientRef.current.color.lerp(ambientCol, 0.05);
    }
    if (directionalRef.current) {
      directionalRef.current.color.lerp(sunColor, 0.05);
      directionalRef.current.position.lerp(
        new THREE.Vector3(...sunPosition),
        0.05
      );
    }
    if (sunMeshRef.current) {
      sunMeshRef.current.position.lerp(new THREE.Vector3(...sunPosition).multiplyScalar(5), 0.05);
      const sunMat = sunMeshRef.current.material as THREE.MeshBasicMaterial;
      if (sunMat) {
        sunMat.color.lerp(sunColor, 0.05);
      }
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} color={ambientColor} intensity={0.6} />
      <directionalLight
        ref={directionalRef}
        color={directionalColor}
        intensity={1.5}
        position={sunPosition}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={100}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      {/* Visible sun/sun moon */}
      <mesh ref={sunMeshRef} position={[sunPosition[0] * 5, sunPosition[1] * 5, sunPosition[2] * 5]}>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshBasicMaterial
          color={directionalColor}
          toneMapped={false}
        />
      </mesh>
      {/* Hemisphere light for softer ambient */}
      <hemisphereLight
        color={ambientColor}
        groundColor={ambientColor}
        intensity={0.3}
      />
    </>
  );
};
