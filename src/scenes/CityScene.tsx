import { useRef, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer } from '@react-three/postprocessing';
import { Bloom } from '@react-three/postprocessing';
import { Vignette } from '@react-three/postprocessing';
import { useEra } from '../contexts/EraContext';
import { useAudioContext } from '../contexts/AudioContext';
import { useSfx } from '../hooks/useSfx';
import { AtmosphereSystem } from './atmosphere';
import { BuildingSystem } from './buildings';
import { PedestrianSystem } from './pedestrians';
import { StorefrontSystem } from './storefronts';
import { VehicleSystem } from './vehicles';
import type { EraYear } from '../types';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const bl = Math.round(lerp(ab, bb, t));
  return (r << 16) | (g << 8) | bl;
}

const ERA_ORDER: EraYear[] = [1945, 1965, 1985, 2005, 2025, 2055];

function interpolateEraData(year: EraYear) {
  const idx = ERA_ORDER.indexOf(year);
  const lo = ERA_ORDER[Math.max(0, idx)];
  const hi = ERA_ORDER[Math.min(ERA_ORDER.length - 1, idx + 1)];
  const t = lo === hi ? 0 : (year - lo) / (hi - lo);
  const loFog = getEraConfig(lo);
  const hiFog = getEraConfig(hi);
  return {
    fogColor: lerpColor(loFog.fogColor, hiFog.fogColor, t),
    fogNear: lerp(loFog.fogNear, hiFog.fogNear, t),
    fogFar: lerp(loFog.fogFar, hiFog.fogFar, t),
    background: lerpColor(loFog.background, hiFog.background, t),
    t,
    lo,
    hi,
  };
}

function getEraConfig(year: EraYear) {
  switch (year) {
    case 1945:
      return { fogColor: 0x3a3a3a, fogNear: 20, fogFar: 80, background: 0x2a2a2a };
    case 1965:
      return { fogColor: 0x5a6a5a, fogNear: 20, fogFar: 100, background: 0x4a5a4a };
    case 1985:
      return { fogColor: 0x6a7a8a, fogNear: 20, fogFar: 120, background: 0x5a6a7a };
    case 2005:
      return { fogColor: 0x8a9aaa, fogNear: 20, fogFar: 140, background: 0x7a8a9a };
    case 2025:
      return { fogColor: 0xaabbcc, fogNear: 20, fogFar: 160, background: 0x9aabbc };
    case 2055:
      return { fogColor: 0xccddee, fogNear: 20, fogFar: 200, background: 0xbbcdde };
  }
}

function SceneContent() {
  const { year } = useEra();
  const eraBlend = useMemo(() => interpolateEraData(year), [year]);

  return (
    <>
      <color attach="background" args={[eraBlend.background]} />
      <fog attach="fog" args={[eraBlend.fogColor, eraBlend.fogNear, eraBlend.fogFar]} />
      <ambientLight intensity={0.3} />
      <AtmosphereSystem year={year} eraBlend={eraBlend} />
      <BuildingSystem year={year} eraBlendT={eraBlend.t} loEra={eraBlend.lo} hiEra={eraBlend.hi} />
      <VehicleSystem year={year} />
      <StorefrontSystem year={year} />
      <PedestrianSystem year={year} />
    </>
  );
}

function PostProcessing({ year }: { year: EraYear }) {
  const eraBlend = useMemo(() => interpolateEraData(year), [year]);

  return (
    <EffectComposer>
      <Bloom
        strength={0.3}
        radius={0.4}
        threshold={0.6}
      />
      <Vignette offset={0.3} darkness={0.4} />
    </EffectComposer>
  );
}

function SceneGraph() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Expose the scene-graph root container so child subsystems can mount into it
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => {
      // R3F Canvas handles its own renderer resize; this observer exists
      // so external consumers can react to container size changes if needed.
    });
    ro.observe(container);
    return () => { ro.disconnect(); };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
      }}
    >
      <Canvas
        shadows
        dpr={window.devicePixelRatio}
        camera={{ position: [30, 20, 30], fov: 60, near: 0.1, far: 1000 }}
        gl={{ powerPreference: 'high-performance', antialias: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <SceneContent />
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          minDistance={5}
          maxDistance={200}
          maxPolarAngle={Math.PI / 2.05}
          enablePan
          enableZoom
          enableRotate
        />
      </Canvas>
    </div>
  );
}

const YEARS: EraYear[] = [1945, 1965, 1985, 2005, 2025, 2055];

function EraSlider() {
  const { year, setYear } = useEra();

  return (
    <div className="era-slider-container">
      <div className="era-slider">
        {YEARS.map((y) => (
          <button
            key={y}
            className={`era-btn ${year === y ? 'era-btn-active' : ''}`}
            onClick={() => setYear(y)}
            aria-label={`Select year ${y}`}
          >
            {y}
          </button>
        ))}
      </div>
      <span className="era-label">{year}</span>
    </div>
  );
}

function AudioToggle() {
  const { isMuted, toggleMute } = useAudioContext();

  return (
    <button
      className={`audio-toggle ${isMuted ? 'audio-toggle-muted' : 'audio-toggle-unmuted'}`}
      onClick={toggleMute}
      aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
    >
      {isMuted ? '🔇 SFX Off' : '🔊 SFX On'}
    </button>
  );
}

function SfxController() {
  const { year } = useEra();
  const { audioContextRef, gainNodeRef, isMuted } = useAudioContext();
  const { startSfx, stopSfx, transitionSfx, prevEraRef } = useSfx();

  useEffect(() => {
    if (isMuted) return;
    const ctx = audioContextRef.current;
    const outputGain = gainNodeRef.current;
    if (!ctx || !outputGain) return;
    const prev = prevEraRef.current;
    if (prev === null) {
      startSfx(ctx, year, outputGain);
    } else if (prev !== year) {
      transitionSfx(ctx, prev, year, 0.6);
    }
    return () => {
      stopSfx();
    };
  }, [year, audioContextRef, gainNodeRef, startSfx, stopSfx, transitionSfx, prevEraRef, isMuted]);

  return null;
}

export default function CityScene() {
  return (
    <div className="city-scene-root">
      <EraSlider />
      <AudioToggle />
      <SfxController />
      <SceneGraph />
    </div>
  );
}