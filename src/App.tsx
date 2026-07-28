import React, { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats } from '@react-three/drei';
import { useEraStore, ERAS } from './state';
import { TimelineSlider } from './components/TimelineSlider';
import { CityBlock } from './components/CityBlock';
import { SkyAtmosphere } from './components/SkyAtmosphere';
import { AmbientSound } from './components/AmbientSound';
import './style.css';

export default function App() {
  const selectedEra = useEraStore((s) => s.selectedEra);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="app-container">
      <TimelineSlider />
      <Canvas
        camera={{ position: [0, 12, 30], fov: 60, near: 0.1, far: 500 }}
        gl={{ antialias: true, alpha: false, stencil: false, depth: true }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#000000']} />
        <fog attach="fog" args={['#000000', 20, 200]} />

        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={30}
          shadow-camera-bottom={-30}
        />

        <Suspense fallback={null}>
          <CityBlock era={selectedEra} />
          <SkyAtmosphere era={selectedEra} />
        </Suspense>

        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={5}
          maxDistance={100}
          maxPolarAngle={Math.PI / 2 - 0.1}
        />

        {mounted && <Stats />}
      </Canvas>

      <div className="era-label">
        {ERAS[selectedEra].year}
      </div>

      <AmbientSound era={selectedEra} />
    </div>
  );
}
