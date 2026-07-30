import React, { useState, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { Era, eraConfigs, eraYears } from './data/eraData';
import CityScene from './components/CityScene';
import TimelineSlider from './components/TimelineSlider';
import AudioManager from './components/AudioManager';
import EraTransitionManager from './components/EraTransitionManager';
import './App.css';

function App() {
  const [era, setEra] = useState<Era>(1945);
  const [targetEra, setTargetEra] = useState<Era | null>(null);
  const config = eraConfigs[era];

  const handleEraChange = useCallback((year: Era) => {
    if (year !== era) {
      setTargetEra(year);
      // Finalize after transition will complete
      setTimeout(() => {
        setEra(year);
        setTargetEra(null);
      }, 1200);
    }
  }, [era]);

  const skyColor = useMemo(() => `#${config.skyColor.toString(16).padStart(6, '0')}`, [config.skyColor]);

  return (
    <div className="app-container">
      <Canvas
        shadows
        camera={{ position: [60, 40, 60], fov: 50, near: 0.1, far: 500 }}
        gl={{ antialias: true, toneMapping: 2, toneMappingExposure: 1.2 }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = 2; // PCFSoftShadowMap
        }}
      >
        <color attach="background" args={[skyColor]} />
        <fog attach="fog" args={[skyColor, 80, 350]} />

        <ambientLight intensity={config.ambientIntensity} color={`#${config.ambientColor.map(c => Math.round(c * 255).toString(16).padStart(2,'0')).join('')}`} />
        <directionalLight
          intensity={config.sunIntensity}
          color={`#${config.sunColor.toString(16).padStart(6, '0')}`}
          position={config.sunPosition}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={0.5}
          shadow-camera-far={300}
          shadow-camera-left={-80}
          shadow-camera-right={80}
          shadow-camera-top={80}
          shadow-camera-bottom={-80}
        />
        <pointLight position={[0, 30, 0]} intensity={0.3} />
        <spotLight
          position={[20, 40, 20]}
          angle={0.3}
          penumbra={0.5}
          intensity={0.4}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />

        <EraTransitionManager currentEra={era} targetEra={targetEra} />
        <CityScene era={era} config={config} />

        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={15}
          maxDistance={200}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, 10, 0]}
        />

        <Environment preset="city" />
      </Canvas>

      <TimelineSlider currentEra={era} onEraChange={handleEraChange} years={eraYears} />
      <AudioManager era={era} />
      <div className="era-label">{config.label}</div>
    </div>
  );
}

export default App;
