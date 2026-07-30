import { useRef, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEra } from '../contexts/EraContext';
import { useAudioContext } from '../contexts/AudioContext';
import { VehicleSystem } from './vehicles';
import { PedestrianSystem } from './pedestrians';
import type { EraYear } from '../types';

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
  const eraConfig = useMemo(() => getEraConfig(year), [year]);

  return (
    <>
      <color attach="background" args={[eraConfig.background]} />
      <fog attach="fog" args={[eraConfig.fogColor, eraConfig.fogNear, eraConfig.fogFar]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={0.6} castShadow />
      <pointLight position={[0, 10, 0]} intensity={0.3} />
      {/* Scene graph root — child subsystems render beneath this */}
      <group />
      <VehicleSystem />
      <PedestrianSystem />
    </>
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

export default function CityScene() {
  return (
    <div className="city-scene-root">
      <EraSlider />
      <AudioToggle />
      <SceneGraph />
    </div>
  );
}
