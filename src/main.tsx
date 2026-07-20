import React from 'react';
import ReactDOM from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { CityScene } from './components/CityScene';
import { TimelineSlider } from './components/TimelineSlider';
import { EraInfo } from './components/EraInfo';
import { EraProvider } from './contexts/EraContext';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <EraProvider>
      <div className="app-container">
        <Canvas camera={{ position: [0, 5, 15], fov: 60 }}>
          <color attach="background" args={['#87CEEB']} />
          <ambientLight intensity={0.6} />
          <directionalLight 
            position={[10, 20, 10]} 
            intensity={1.2}
          />
          <CityScene />
        </Canvas>
        <TimelineSlider />
        <EraInfo />
      </div>
    </EraProvider>
  </React.StrictMode>
);