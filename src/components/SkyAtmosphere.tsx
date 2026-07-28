import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Mesh, ShaderMaterial, SphereGeometry, BackSide } from 'three';
import { Era } from '../state';

interface Props {
  era: Era;
}

const vertexShader = `
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform vec3 topColor;
  uniform vec3 bottomColor;
  uniform float time;
  uniform float eraIntensity;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;

  void main() {
    float h = normalize(vWorldPosition + vec3(0.0, 50.0, 0.0)).y;
    h = clamp(h, 0.0, 1.0);

    // Base gradient
    vec3 color = mix(bottomColor, topColor, h);

    // Add atmospheric scatter based on era
    vec3 scatter = vec3(0.0);
    if (eraIntensity > 0.5) {
      // Neon glow particles for future eras
      vec2 uv = vWorldPosition.xz / 100.0;
      float noise = sin(uv.x * 10.0 + time * 0.5) * cos(uv.y * 10.0 + time * 0.3);
      scatter = vec3(0.0, 0.5, 1.0) * noise * eraIntensity * 0.3;
    }

    // Sun disc
    vec3 sunDir = normalize(vec3(0.5, 0.8, 0.3));
    float sun = pow(max(dot(vNormal, sunDir), 0.0), 32.0);
    color += vec3(1.0, 0.9, 0.7) * sun * (1.0 - eraIntensity * 0.5);

    gl_FragColor = vec4(color + scatter, 1.0);
  }
`;

export function SkyAtmosphere({ era }: Props) {
  const meshRef = useRef<Mesh>(null!);

  const skyColors = useMemo(() => {
    const configs = [
      { top: '#87CEEB', bottom: '#F0E68C' }, // 1945 - dawn
      { top: '#87CEEB', bottom: '#FFB6C1' }, // 1965 - pastel
      { top: '#4682B4', bottom: '#8B4513' }, // 1985 - smog
      { top: '#4682B4', bottom: '#4169E1' }, // 2005 - modern
      { top: '#87CEEB', bottom: '#32CD32' }, // 2025 - clean
      { top: '#000080', bottom: '#00FFFF' }, // 2055 - futuristic
    ];
    return configs[era];
  }, [era]);

  const eraIntensity = useMemo(() => {
    // 0 for early eras, increases for future
    return [0, 0.2, 0.4, 0.6, 0.8, 1.0][era];
  }, [era]);

  useFrame(({ clock }) => {
    const material = meshRef.current.material as ShaderMaterial;
    if (material) {
      material.uniforms.time.value = clock.elapsedTime;
    }
  });

  const material = useMemo(() => {
    const mat = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        topColor: { value: new Color(skyColors.top) },
        bottomColor: { value: new Color(skyColors.bottom) },
        time: { value: 0 },
        eraIntensity: { value: eraIntensity },
      },
      side: 1, // BackSide
      depthWrite: false,
    });
    return mat;
  }, [skyColors, eraIntensity]);

  // Update uniforms when era changes
  material.uniforms.topColor.value.set(skyColors.top);
  material.uniforms.bottomColor.value.set(skyColors.bottom);
  material.uniforms.eraIntensity.value = eraIntensity;

  return (
    <mesh ref={meshRef} material={material} renderOrder={0}>
      <sphereGeometry args={[90, 32, 32]} />
    </mesh>
  );
}
