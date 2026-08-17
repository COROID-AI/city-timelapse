import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import type { EraInfo } from '../eras/types';

interface SkyDomeProps {
  era: EraInfo;
}

export function SkyDome({ era }: SkyDomeProps) {
  const skyRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (skyRef.current && skyRef.current.material) {
      const mat = skyRef.current.material as any;
      if (mat.uniforms) {
        mat.uniforms.topColor.value.set(era.skyTop);
        mat.uniforms.bottomColor.value.set(era.skyBottom);
      }
    }
  });

  return (
    <group>
      {/* Sky dome */}
      <mesh ref={skyRef} rotation={[0, 0, 0]}>
        <sphereGeometry args={[200, 32, 32]} />
        <shaderMaterial
          side={THREE.BackSide}
          depthWrite={false}
          uniforms={{
            topColor: { value: new THREE.Color(era.skyTop) },
            bottomColor: { value: new THREE.Color(era.skyBottom) },
            offset: { value: 20 },
            exponent: { value: 0.4 },
          }}
          vertexShader={`
            varying vec3 vWorldPosition;
            void main() {
              vec4 worldPos = modelMatrix * vec4(position, 1.0);
              vWorldPosition = worldPos.xyz;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            void main() {
              float h = normalize(vWorldPosition + offset).y;
              gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
            }
          `}
        />
      </mesh>

      {/* Stars for night-era scenes */}
      {['1985', '2055'].includes(era.year.toString()) && <Stars />}

      {/* Clouds for daytime eras */}
      {!['1985', '2055'].includes(era.year.toString()) && <Clouds />}
    </group>
  );
}

function Stars() {
  const points = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i < 500 * 3; i++) {
      pts.push((Math.random() - 0.5) * 300);
    }
    return pts;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={500}
          array={new Float32Array(points)}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.5} color="#ffffff" transparent opacity={0.8} sizeAttenuation />
    </points>
  );
}

function Clouds() {
  return (
    <group>
      {[...Array(8)].map((_, i) => (
        <Cloud key={i} index={i} />
      ))}
    </group>
  );
}

function Cloud({ index }: { index: number }) {
  const ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.x += 0.005;
    if (ref.current.position.x > 100) ref.current.position.x = -100;
  });

  return (
    <group ref={ref} position={[index * 25 - 100, 30 + Math.sin(index) * 5, -30 + index * 8]}>
      <mesh>
        <sphereGeometry args={[5, 8, 8]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.7} roughness={1} />
      </mesh>
      <mesh position={[4, -1, 0]}>
        <sphereGeometry args={[4, 8, 8]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.7} roughness={1} />
      </mesh>
      <mesh position={[-3, 0.5, 1]}>
        <sphereGeometry args={[3.5, 8, 8]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.7} roughness={1} />
      </mesh>
    </group>
  );
}
