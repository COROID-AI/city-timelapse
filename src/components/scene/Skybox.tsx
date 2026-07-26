import { useThree } from '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';

interface SkyboxProps {
  skyColor: string;
}

export const Skybox = ({ skyColor }: SkyboxProps) => {
  const { gl } = useThree();
  const skyMeshRef = useRef<THREE.Mesh>(null);

  const skyMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        skyColor: { value: new THREE.Color(skyColor) },
        time: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 skyColor;
        uniform float time;
        varying vec3 vWorldPosition;
        void main() {
          vec3 dir = normalize(vWorldPosition);
          float gradient = pow(dir.y + 0.2, 2.0);
          vec3 color = mix(skyColor * 0.3, skyColor, gradient);
          // Add subtle cloud-like noise
          float noise = sin(dir.x * 10.0 + time * 0.1) * cos(dir.z * 10.0 + time * 0.05) * 0.05;
          color += noise;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
  }, [skyColor]);

  useFrame(({ clock }) => {
    skyMaterial.uniforms.time.value = clock.elapsedTime;
    skyMaterial.uniforms.skyColor.value.set(skyColor);
  });

  return (
    <mesh ref={skyMeshRef} scale={[200, 200, 200]}>
      <sphereGeometry args={[1, 32, 32]} />
      <primitive object={skyMaterial} attach="material" />
    </mesh>
  );
};
