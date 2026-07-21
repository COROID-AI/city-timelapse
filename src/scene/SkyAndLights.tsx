/**
 * Sky + lighting + fog.
 *
 * Sky is a large inverted sphere using a ShaderMaterial that blends two era
 * colors (top/bottom). Fog color tracks the sky. The key directional light
 * (single shadow caster — performance safeguard) moves its azimuth/elevation
 * per era, and an ambient hemisphere fills the shadows.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { InterpolatedEra } from "../utils/interp";

const skyVert = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const skyFrag = /* glsl */ `
  varying vec3 vWorldPos;
  uniform vec3 uTop;
  uniform vec3 uBottom;
  void main() {
    float h = clamp((vWorldPos.y + 40.0) / 200.0, 0.0, 1.0);
    gl_FragColor = vec4(mix(uBottom, uTop, h), 1.0);
  }
`;

export function SkyAndLights({
  rt,
}: {
  rt: React.RefObject<{ era: InterpolatedEra; clock: number }>;
}) {
  // Stable ShaderMaterial whose uniforms we update per frame.
  const skyMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: skyVert,
        fragmentShader: skyFrag,
        uniforms: {
          uTop: { value: new THREE.Color("#4a7ab0") },
          uBottom: { value: new THREE.Color("#dceaf5") },
        },
      }),
    []
  );

  const sunRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const ambRef = useRef<THREE.AmbientLight>(null);

  useFrame(() => {
    const e = rt.current.era;
    skyMat.uniforms.uTop!.value.copy(e.skyTop);
    skyMat.uniforms.uBottom!.value.copy(e.skyBottom);

    if (sunRef.current) {
      sunRef.current.color.copy(e.sunColor);
      sunRef.current.intensity = e.sun;
      const az = e.sunAzimuth * Math.PI * 2;
      const el = e.sunElevation * Math.PI * 0.5;
      const r = 80;
      sunRef.current.position.set(
        Math.cos(az) * Math.cos(el) * r,
        Math.sin(el) * r + 30,
        Math.sin(az) * Math.cos(el) * r
      );
    }
    if (hemiRef.current) hemiRef.current.intensity = e.ambient * 0.7;
    if (ambRef.current) ambRef.current.intensity = e.ambient * 0.4;
  });

  return (
    <group>
      <mesh material={skyMat} renderOrder={-1}>
        <sphereGeometry args={[400, 32, 16]} />
      </mesh>
      <ambientLight ref={ambRef} intensity={0.3} />
      <hemisphereLight ref={hemiRef} intensity={0.5} color="#ffffff" groundColor="#443322" />
      <directionalLight
        ref={sunRef}
        castShadow
        intensity={1.2}
        color="#fff4dc"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={250}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={90}
        shadow-camera-bottom={-90}
        shadow-bias={-0.0004}
      />
    </group>
  );
}
