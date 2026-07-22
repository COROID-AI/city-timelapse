// @ts-nocheck
import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stats, Environment, Html, Loader } from '@react-three/drei';
import { CityBlock } from './components/CityBlock';
import { TimelineSlider } from './components/TimelineSlider';
import { HUD } from './components/HUD';
import { AudioManager } from './components/AudioManager';
import { PostProcessing } from './components/PostProcessing';
import { LoadingScreen } from './components/LoadingScreen';
import './App.css';

export type Era = '1945' | '1965' | '1985' | '2005' | '2025' | '2055';

export const ERAS: Era[] = ['1945', '1965', '1985', '2005', '2025', '2055'];

export const ERA_LABELS: Record<Era, string> = {
  '1945': 'Post-War Reconstruction',
  '1965': 'Urban Renewal',
  '1985': 'Modernization',
  '2005': 'Digital Age',
  '2025': 'Smart City',
  '2055': 'Neo-Futurism',
};

export const ERA_COLORS: Record<Era, string> = {
  '1945': '#8B4513',
  '1965': '#FF6B35',
  '1985': '#4ECDC4',
  '2005': '#45B7D1',
  '2025': '#96CEB4',
  '2055': '#DDA0DD',
};

export const ERA_MUSIC: Record<Era, string> = {
  '1945': 'swing',
  '1965': 'rock',
  '1985': 'synthwave',
  '2005': 'ambient',
  '2025': 'electronic',
  '2055': 'cyberpunk',
};

// Hook that manages era transitions with smooth progress values.
// Must be called inside the Canvas (uses useFrame).
function useEraTransition(initialEra: Era) {
  const [currentEra, setCurrentEra] = useState<Era>(initialEra);
  const [targetEra, setTargetEra] = useState<Era>(initialEra);
  const [fromEra, setFromEra] = useState<Era | null>(null);
  const [progress, setProgress] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const startTimeRef = useRef<number>(0);

  const transitionDuration = 2000;

  const transition = useCallback((newEra: Era) => {
    if (newEra === currentEra) return;
    setFromEra(currentEra);
    setTargetEra(newEra);
    setIsTransitioning(true);
    startTimeRef.current = 0;
  }, [currentEra]);

  useFrame(() => {
    if (!isTransitioning) return;

    if (startTimeRef.current === 0) {
      startTimeRef.current = Date.now();
    }

    const elapsed = Date.now() - startTimeRef.current;
    const t = Math.min(elapsed / transitionDuration, 1);

    const eased = t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;

    setProgress(eased);

    if (t >= 1) {
      setCurrentEra(targetEra);
      setIsTransitioning(false);
      setFromEra(null);
      setProgress(0);
      startTimeRef.current = 0;
    }
  });

  return {
    currentEra,
    targetEra,
    fromEra,
    eraProgress: progress,
    isTransitioning,
    transition,
  };
}

// Scene component that lives inside Canvas and manages era transitions
function Scene({
  onEraChange,
  onTransitionChange,
  onProgressChange,
  onCurrentEraChange,
}: {
  onEraChange: (era: Era) => void;
  onTransitionChange: (v: boolean) => void;
  onProgressChange: (v: number) => void;
  onCurrentEraChange: (era: Era) => void;
}) {
  const { currentEra, eraProgress, isTransitioning, transition } = useEraTransition('1945');

  // Sync parent state
  useEffect(() => {
    onCurrentEraChange(currentEra);
  }, [currentEra, onCurrentEraChange]);

  useEffect(() => {
    onTransitionChange(isTransitioning);
  }, [isTransitioning, onTransitionChange]);

  useEffect(() => {
    onProgressChange(eraProgress);
  }, [eraProgress, onProgressChange]);

  const handleEraChange = useCallback((era: Era) => {
    if (era === currentEra) return;
    onEraChange(era);
    transition(era);
  }, [currentEra, transition, onEraChange]);

  return (
    <>
      <color attach="background" args={['#000000']} />
      <Suspense fallback={null}>
        <Environment preset="sunset" />
        <ambientLight intensity={0.4} color="#ffffff" />
        <directionalLight
          castShadow
          position={[20, 40, 20]}
          intensity={1.5}
          color="#fff5e6"
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={100}
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={30}
          shadow-camera-bottom={-30}
        />
        <hemisphereLight
          color="#fff5e6"
          groundColor="#808080"
          intensity={0.5}
          position={[0, 100, 0]}
        />

        <PostProcessing currentEra={currentEra} />

        <CityBlock
          currentEra={currentEra}
          eraProgress={eraProgress}
          isTransitioning={isTransitioning}
        />

        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={0.1}
          enablePan={true}
          panSpeed={0.5}
          zoomSpeed={0.8}
          minDistance={15}
          maxDistance={120}
        />
      </Suspense>
    </>
  );
}

function App() {
  const [currentEra, setCurrentEra] = useState<Era>('1945');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [eraProgress, setEraProgress] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const canvasRef = useRef<any>(null);

  const handleEraChange = (era: Era) => {
    if (era === currentEra) return;
    setCurrentEra(era);
  };

  const handleCurrentEraChange = (era: Era) => {
    setCurrentEra(era);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const idx = ERAS.indexOf(currentEra);
      if (e.key === 'ArrowRight' && idx < ERAS.length - 1) {
        handleEraChange(ERAS[idx + 1]);
      }
      if (e.key === 'ArrowLeft' && idx > 0) {
        handleEraChange(ERAS[idx - 1]);
      }
      if (e.key === ' ') {
        setShowStats((s) => !s);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentEra]);

  return (
    <div className="app-container">
      <LoadingScreen />

      <TimelineSlider
        currentEra={currentEra}
        onEraChange={handleEraChange}
        isTransitioning={isTransitioning}
      />

      <HUD currentEra={currentEra} eraLabel={ERA_LABELS[currentEra]} />

      <AudioManager currentEra={currentEra} />

      <Canvas
        ref={canvasRef}
        camera={{ position: [30, 20, 40], fov: 60 }}
        gl={{
          antialias: true,
          alpha: false,
          stencil: false,
          depth: true,
          preserveDrawingBuffer: true,
        }}
      >
        <Scene
          onEraChange={handleEraChange}
          onTransitionChange={setIsTransitioning}
          onProgressChange={setEraProgress}
          onCurrentEraChange={handleCurrentEraChange}
        />
        {showStats && <Stats />}
      </Canvas>

      <Loader />
    </div>
  );
}

export default App;
