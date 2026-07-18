import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BackSide,
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  ShaderMaterial,
  Vector3,
} from 'three';
import { useSceneState } from './scene-state';

/**
 * Atmosphere: sky gradient, scene fog, and the three dynamic lights (sun
 * directional, hemisphere, ambient). Every parameter is interpolated from the
 * shared scene state each frame; the sun's direction is derived from the era's
 * azimuth/elevation. Renderer exposure is updated too. All mutation is in-place.
 */

const SUN_TARGET = new Vector3(0, 0, 0);

export function Atmosphere() {
  const state = useSceneState();
  const { scene, gl } = useThree();

  // Sky gradient material (large inverted sphere). Created once.
  const skyMat = useMemo(() => {
    return new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new Color(0x9aa6b0) },
        horizonColor: { value: new Color(0xcbb489) },
        offset: { value: 12 },
        exponent: { value: 0.7 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
          float f = pow(max(h, 0.0), exponent);
          vec3 col = mix(horizonColor, topColor, f);
          // sun glow near the horizon
          float sunGlow = pow(max(0.0, 1.0 - abs(h)), 6.0);
          col += horizonColor * sunGlow * 0.3;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
  }, []);

  const skyRef = useRef<Mesh>(null);

  // Fog — created once, mutated in place.
  const fog = useMemo(() => new Fog(0xcbb489, 30, 150), []);

  // Lights — created once via declarative JSX but driven by refs.
  const sunRef = useRef<DirectionalLight>(null);
  const hemiRef = useRef<HemisphereLight>(null);
  const ambRef = useRef<AmbientLight>(null);

  // Attach fog once.
  useMemo(() => {
    scene.fog = fog;
  }, [scene, fog]);

  useFrame(() => {
    const t = state;

    // Sky
    skyMat.uniforms.topColor.value.copy(t.topColor);
    skyMat.uniforms.horizonColor.value.copy(t.horizonColor);

    // Fog
    fog.color.copy(t.horizonColor);
    fog.near = t.fogNear;
    fog.far = t.fogFar;

    // Sun direction from azimuth/elevation (spherical → cartesian).
    const r = 1;
    const el = t.sunElevation;
    const az = t.sunAzimuth;
    const cosEl = Math.cos(el);
    const sx = cosEl * Math.sin(az) * r;
    const sy = Math.sin(el) * r;
    const sz = cosEl * Math.cos(az) * r;
    if (sunRef.current) {
      sunRef.current.position.set(sx * 60, sy * 60, sz * 60);
      sunRef.current.target.position.set(SUN_TARGET.x, SUN_TARGET.y, SUN_TARGET.z);
      sunRef.current.target.updateMatrixWorld();
      sunRef.current.color.copy(t.sunColor);
      sunRef.current.intensity = t.sunIntensity;
    }
    if (hemiRef.current) {
      hemiRef.current.color.copy(t.hemiSkyColor);
      hemiRef.current.groundColor.copy(t.hemiGroundColor);
      hemiRef.current.intensity = t.hemiIntensity;
    }
    if (ambRef.current) {
      ambRef.current.color.copy(t.ambientColor);
      ambRef.current.intensity = t.ambientIntensity;
    }

    // Renderer exposure (color grading).
    gl.toneMappingExposure = t.exposure;
  });

  return (
    <>
      <mesh ref={skyRef} material={skyMat} scale={[400, 400, 400]}>
        <sphereGeometry args={[1, 32, 16]} />
      </mesh>
      <ambientLight ref={ambRef} />
      <hemisphereLight ref={hemiRef} />
      <directionalLight
        ref={sunRef}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={200}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-bias={-0.0004}
      />
    </>
  );
}
