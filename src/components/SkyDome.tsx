import React, { useMemo } from 'react';
import * as THREE from 'three';

interface SkyDomeProps {
  color: number;
}

const vertexShader = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = `
  uniform vec3 fogColor;
  void main() {
    gl_FragColor = vec4(fogColor, 1.0);
  }
`;

const SkyDome: React.FC<SkyDomeProps> = React.memo(({ color }) => {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        fogColor: { value: new THREE.Color(color) },
      },
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      fog: false,
      depthWrite: true,
    });
  }, [color]);

  return (
    <mesh position={[0, -5, 0]} scale={[200, 200, 200]}>
      <sphereGeometry args={[100, 64, 32]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
});

export default SkyDome;
