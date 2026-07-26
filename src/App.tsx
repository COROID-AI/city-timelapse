import { Canvas } from '@react-three/fiber';
import { Stats } from '@react-three/drei';
import { Suspense } from 'react';
import { TimelineProvider, useTimeline } from './context/TimelineContext';
import { TimelineSlider } from './components/TimelineSlider';
import { EraInfoPanel } from './components/EraInfoPanel';
import { NavHelp } from './components/NavHelp';
import { CityScene } from './components/CityScene';
import './App.css';

function SceneWithStats() {
  return (
    <>
      <CityScene />
      <Stats />
    </>
  );
}

export default function App() {
  return (
    <TimelineProvider>
      <div className="app">
        <TimelineSlider />
        <EraInfoPanel />
        <NavHelp />
        <Canvas
          camera={{ position: [20, 20, 25], fov: 60, near: 0.1, far: 200 }}
          gl={{
            antialias: true,
            alpha: false,
            stencil: false,
            depth: true,
            powerPreference: 'high-performance',
          }}
          dpr={[1, 1.5]}
        >
          <Suspense fallback={null}>
            <SceneWithStats />
          </Suspense>
        </Canvas>
      </div>
    </TimelineProvider>
  );
}
