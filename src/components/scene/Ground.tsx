import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GroundStyle, EraId, lerp } from '../../types';

interface GroundProps {
  groundStyle: GroundStyle;
  buildingColor: string;
  windowLitColor: string;
  era: EraId;
  transitionProgress: number;
}

const GROUND_SIZE = 80;
const GROUND_SEGMENTS = 64;

const GroundTextureShader = ({
  groundStyle,
  buildingColor,
  windowLitColor,
  transitionProgress,
}: {
  groundStyle: GroundStyle;
  buildingColor: string;
  windowLitColor: string;
  transitionProgress: number;
}) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(() => ({
    color1: { value: new THREE.Color(buildingColor) },
    color2: { value: new THREE.Color('#333333') },
    litColor: { value: new THREE.Color(windowLitColor) },
    time: { value: 0 },
    patternScale: { value: 1.0 },
    transition: { value: 0 },
  }), []);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = clock.elapsedTime;
      materialRef.current.uniforms.color1.value.set(buildingColor);
      materialRef.current.uniforms.litColor.value.set(windowLitColor);
      materialRef.current.uniforms.transition.value = transitionProgress;
    }
  });

  const patternScale = useMemo(() => {
    switch (groundStyle) {
      case 'cobblestone': return 0.5;
      case 'asphalt': return 0.3;
      case 'painted': return 0.4;
      case 'smart': return 0.8;
      default: return 0.5;
    }
  }, [groundStyle]);

  return (
    <shaderMaterial
      ref={materialRef}
      uniforms={uniforms}
      vertexShader={/* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `}
      fragmentShader={/* glsl */ `
        uniform vec3 color1;
        uniform vec3 color2;
        uniform vec3 litColor;
        uniform float time;
        uniform float patternScale;
        uniform float transition;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        // 2D hash function
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }

        // Value noise
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        void main() {
          vec2 pos = vWorldPos.xz * patternScale;

          // Base pattern varies by style
          float pattern;
          if (patternScale < 0.4) {
            // Cobblestone / asphalt - stone-like
            vec2 stoneId = floor(pos);
            vec2 stonePos = fract(pos) - 0.5;
            float stoneDist = length(stonePos);
            float stone = smoothstep(0.4, 0.0, stoneDist - 0.1 * noise(stoneId));
            pattern = stone;
          } else if (patternScale < 0.6) {
            // Painted / marked roads
            float roadNoise = noise(pos * 2.0);
            float laneMark = step(0.92, mod(pos.y, 2.0));
            float centerLine = step(0.95, mod(pos.x, 4.0));
            pattern = 0.3 + 0.7 * roadNoise + 0.3 * laneMark + 0.2 * centerLine;
          } else {
            // Smart / futuristic - grid with glowing lines
            float grid = step(0.95, mod(pos.x, 2.0)) + step(0.95, mod(pos.y, 2.0));
            float glow = sin(time * 2.0 + pos.x * 0.5) * cos(time * 1.5 + pos.y * 0.5);
            pattern = 0.1 + 0.9 * grid + 0.3 * glow;
          }

          vec3 finalColor = mix(color2, color1, pattern);

          // Add glowing lines for smart/futuristic
          if (patternScale > 0.6) {
            float glowLines = step(0.97, mod(pos.x, 2.0)) + step(0.97, mod(pos.y, 2.0));
            finalColor = mix(finalColor, litColor, glowLines * 0.5 * (0.5 + 0.5 * sin(time)));
          }

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `}
    />
  );
};

export const Ground = ({
  groundStyle,
  buildingColor,
  windowLitColor,
  era,
  transitionProgress,
}: GroundProps) => {
  const groundRef = useRef<THREE.Mesh>(null);

  return (
    <mesh ref={groundRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE, GROUND_SEGMENTS, GROUND_SEGMENTS]} />
      <GroundTextureShader
        groundStyle={groundStyle}
        buildingColor={buildingColor}
        windowLitColor={windowLitColor}
        transitionProgress={transitionProgress}
      />
    </mesh>
  );
};
