import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useSceneStore } from '../store/useSceneStore';
import { sampleSky } from '../engine/sceneSampler';
import { TMP } from '../engine/sharedResources';

// ---------------------------------------------------------------------------
// Sky dome shader — vertical gradient from horizon to zenith, not affected by
// fog so distant buildings fade seamlessly into the fog colour.
// ---------------------------------------------------------------------------
const skyVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFrag = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform float uCloudiness;
  varying vec3 vDir;

  // cheap hash noise for cloud streaks near the horizon
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    float h = clamp(vDir.y, 0.0, 1.0);
    float t = pow(h, 0.6);
    vec3 col = mix(uHorizon, uTop, t);

    // wispy clouds near horizon
    if (uCloudiness > 0.01 && h < 0.45) {
      vec2 uv = vDir.xz / (vDir.y + 0.15);
      float n = noise(uv * 3.0) * noise(uv * 7.0);
      float cloud = smoothstep(0.3, 0.7, n) * uCloudiness * (1.0 - h * 2.5);
      col = mix(col, col * 1.3 + vec3(0.1), cloud * 0.5);
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function Environment() {
  const { scene, gl } = useThree();

  const skyMat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color(0.2, 0.4, 0.7) },
        uHorizon: { value: new THREE.Color(0.8, 0.8, 0.7) },
        uCloudiness: { value: 0.4 },
      },
    });
    return m;
  }, []);

  const fog = useMemo(() => new THREE.Fog(0x808080, 40, 130), []);

  // Stars
  const starsGeom = useMemo(() => {
    const N = 1500;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // distribute on upper hemisphere of a large sphere
      const u = Math.random();
      const v = Math.random() * 0.5 + 0.05; // upper half
      const theta = u * Math.PI * 2;
      const phi = Math.acos(1 - 2 * v);
      const r = 400;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  const starsMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 1.8,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
      }),
    [],
  );

  // Sun + lights
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const ambRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);

  // assign fog to scene
  useEffect(() => {
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);

  useFrame(() => {
    const eraFloat = useSceneStore.getState().eraFloat;
    const sky = sampleSky(eraFloat);

    // sky dome
    skyMat.uniforms.uTop.value.setRGB(...sky.topColor);
    skyMat.uniforms.uHorizon.value.setRGB(...sky.horizonColor);
    skyMat.uniforms.uCloudiness.value = sky.cloudiness;

    // fog
    fog.color.setRGB(...sky.fogColor);
    fog.near = sky.fogNear;
    fog.far = sky.fogFar;

    // exposure
    gl.toneMappingExposure = sky.exposure;

    // sun
    if (sunRef.current) {
      const p = sky.sunPosition;
      sunRef.current.position.set(p[0] * 100, p[1] * 100, p[2] * 100);
      sunRef.current.color.setRGB(...sky.sunColor);
      sunRef.current.intensity = sky.sunIntensity;
    }
    if (ambRef.current) {
      ambRef.current.color.setRGB(...sky.ambientColor);
      ambRef.current.intensity = sky.ambientIntensity;
    }
    if (hemiRef.current) {
      hemiRef.current.color.setRGB(...sky.hemiSkyColor);
      hemiRef.current.groundColor.setRGB(...sky.hemiGroundColor);
      hemiRef.current.intensity = sky.hemiIntensity;
    }

    // stars
    starsMat.opacity = sky.starIntensity;
  });

  return (
    <>
      {/* Sky dome */}
      <mesh material={skyMat} renderOrder={-2} frustumCulled={false}>
        <sphereGeometry args={[500, 32, 16]} />
      </mesh>

      {/* Stars */}
      <points geometry={starsGeom} material={starsMat} renderOrder={-1} frustumCulled={false} />

      {/* Lights */}
      <directionalLight ref={sunRef} intensity={1.5} castShadow position={[50, 60, 30]}>
        <orthographicCamera attach="shadow-camera" args={[-60, 60, 60, -60, 0.1, 300]} />
      </directionalLight>
      <ambientLight ref={ambRef} intensity={0.5} />
      <hemisphereLight ref={hemiRef} intensity={0.5} />
    </>
  );
}
