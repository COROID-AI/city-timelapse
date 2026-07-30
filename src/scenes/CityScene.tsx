import { useRef, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer } from '@react-three/postprocessing';
import { Bloom } from '@react-three/postprocessing';
import { Vignette } from '@react-three/postprocessing';
import { useEra } from '../contexts/EraContext';
import { useAudioContext } from '../contexts/AudioContext';
import { useSfx } from '../hooks/useSfx';
import { EraTransitionProvider, useEraTransition, interpolateEraData } from './transitions';
import { AtmosphereSystem } from './atmosphere';
import { BuildingSystem } from './buildings';
import { PedestrianSystem } from './pedestrians';
import { StorefrontSystem } from './storefronts';
import { VehicleSystem } from './vehicles';
import type { EraYear } from '../types';
import TimelineSlider from '../ui/TimelineSlider';

function SceneContent() {
  const { fromYear, toYear, easedProgress } = useEraTransition();
  const eraBlend = useMemo(
    () => interpolateEraData(fromYear, toYear, easedProgress),
    [fromYear, toYear, easedProgress]
  );

  return (
    <>
      <color attach="background" args={[eraBlend.background]} />
      <fog attach="fog" args={[eraBlend.fogColor, eraBlend.fogNear, eraBlend.fogFar]} />
      <ambientLight intensity={0.3} />
      <AtmosphereSystem year={toYear} eraBlend={eraBlend} />
      <BuildingSystem year={toYear} eraBlendT={eraBlend.t} loEra={eraBlend.lo} hiEra={eraBlend.hi} />
      <VehicleSystem
        year={toYear}
        transitionFromYear={eraBlend.lo}
        transitionToYear={eraBlend.hi}
        transitionT={eraBlend.t}
      />
      <StorefrontSystem
        year={toYear}
        transitionFromYear={eraBlend.lo}
        transitionToYear={eraBlend.hi}
        transitionT={eraBlend.t}
      />
      <PedestrianSystem
        year={toYear}
        transitionFromYear={eraBlend.lo}
        transitionToYear={eraBlend.hi}
        transitionT={eraBlend.t}
      />
    </>
  );
}

function PostProcessing() {
  return (
    <EffectComposer>
      <Bloom strength={0.3} radius={0.4} threshold={0.6} />
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
        <EraTransitionProvider>
          <SceneContent />
        </EraTransitionProvider>
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

function EraSlider() {
  return <TimelineSlider />;
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