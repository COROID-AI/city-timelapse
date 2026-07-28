import { useRef, useEffect, useState } from 'react';
import { useStore } from './state';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import CityScene from './scenes/CityScene';
import TimelineSlider from './ui/TimelineSlider';
import EraInfo from './ui/EraInfo';
import LoadingScreen from './ui/LoadingScreen';

export default function App() {
  const isLoaded = useStore((s: any) => s.isLoaded);
  const setLoaded = useStore((s: any) => s.setLoaded);
  const [showUI, setShowUI] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoaded(true);
      const showTimer = setTimeout(() => setShowUI(true), 500);
      return () => clearTimeout(showTimer);
    }, 2500);
    return () => clearTimeout(timer);
  }, [setLoaded]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {!isLoaded && <LoadingScreen />}
      <Canvas
        shadows
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        camera={{ position: [25, 18, 25], fov: 55, near: 0.5, far: 500 }}
        style={{ opacity: isLoaded ? 1 : 0, transition: 'opacity 1s ease' }}
        exposure={1.2}
      >
        <CityScene onLoaded={() => {}} />
        <OrbitControls
          target={[0, 4, 0]}
          maxPolarAngle={Math.PI / 2.1}
          minPolarAngle={0.2}
          minDistance={10}
          maxDistance={80}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.6}
          zoomSpeed={1.2}
          panSpeed={0.8}
        />
        <PerspectiveCamera makeDefault position={[25, 18, 25]} fov={55} />
      </Canvas>
      {showUI && (
        <>
          <TimelineSlider />
          <EraInfo />
        </>
      )}
    </div>
  );
}
