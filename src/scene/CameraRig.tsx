import { OrbitControls } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';

interface CameraRigProps {
  initialPosition?: [number, number, number];
  target?: [number, number, number];
}

export function CameraRig({ initialPosition = [30, 20, 30], target = [0, 3, 0] }: CameraRigProps) {
  const controlsRef = useRef<any>(null);

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={new THREE.Vector3(...target)}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={5}
        maxDistance={100}
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
        panSpeed={0.5}
        zoomSpeed={0.8}
      />
    </>
  );
}
