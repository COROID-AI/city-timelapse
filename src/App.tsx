import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Environment, Stats, Html, Loader } from '@react-three/drei';
import * as THREE from 'three';
import { Era, ERAS, getEraByYear } from './eras';
import { TimelineSlider } from './ui/TimelineSlider';
import { CityScene } from './scene/CityScene';
import { AudioManager } from './audio/AudioManager';
import { WebGLContextManager } from './webgl/WebGLContextManager';
import { PerformanceManager, PerformanceSettings } from './performance/PerformanceManager';
import { EraTransitionManager } from './transitions/EraTransitionManager';

function App() {
  const [currentYear, setCurrentYear] = useState(2025);
  const [era, setEra] = useState(getEraByYear(2025));
  const [progress, setProgress] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionProgress, setTransitionProgress] = useState(1);
  const [performance, setPerformance] = useState<PerformanceSettings | null>(null);
  const [audioManager, setAudioManager] = useState<AudioManager | null>(null);
  const [webglManager, setWebGLContextManager] = useState<WebGLContextManager | null>(null);
  const [canvasKey, setCanvasKey] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const recoveryInProgressRef = useRef(false);

  const transitionManagerRef = useRef<EraTransitionManager | null>(null);
  const performanceManagerRef = useRef<PerformanceManager | null>(null);
  const audioManagerRef = useRef<AudioManager | null>(null);
  const webglManagerRef = useRef<WebGLContextManager | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize managers on mount
  useEffect(() => {
    // Audio manager will be initialized after the audio listener is created
    // WebGL context manager will be initialized after canvas is available

    // Performance manager
    const perfManager = new PerformanceManager((settings) => {
      setPerformance(settings);
    });
    performanceManagerRef.current = perfManager;
    setPerformance(perfManager.getSettings());

    // Era transition manager
    const transitionMgr = new EraTransitionManager(ERAS.findIndex((e) => e.year === 2025));
    transitionManagerRef.current = transitionMgr;

    transitionMgr.subscribe((era, prog) => {
      setEra(era);
      setProgress(prog);
      setTransitionProgress(prog);
      setIsTransitioning(prog < 1);
    });

    // Audio unlock on user gesture
    const handleUserGesture = async () => {
      if (audioManagerRef.current && !audioUnlocked) {
        const unlocked = await audioManagerRef.current.unlock();
        if (unlocked) {
          setAudioUnlocked(true);
          // Generate procedural sounds
          generateSounds(audioManagerRef.current);
        }
      }
    };

    const handleFirstInteraction = () => {
      handleUserGesture();
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('keydown', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
      transitionMgr.dispose();
    };
  }, []);

  // Generate procedural sounds for SFX
  const generateSounds = useCallback((audioMgr: AudioManager) => {
    // City ambient sounds (procedural)
    audioMgr.generateSound('city_ambient_1945', 'pink', 3.0);
    audioMgr.generateSound('city_ambient_1965', 'pink', 3.0);
    audioMgr.generateSound('city_ambient_1985', 'pink', 3.0);
    audioMgr.generateSound('city_ambient_2005', 'pink', 3.0);
    audioMgr.generateSound('city_ambient_2025', 'pink', 3.0);
    audioMgr.generateSound('city_ambient_2055', 'pink', 3.0);

    // UI sounds
    audioMgr.generateSound('ui_click', 'click', 0.1);
    audioMgr.generateSound('ui_hover', 'click', 0.05);
    audioMgr.generateSound('transition_start', 'tone', 0.5);
    audioMgr.generateSound('transition_end', 'tone', 0.5);

    // Vehicle sounds
    audioMgr.generateSound('vehicle_pass', 'white', 1.0);
  }, []);

  // Handle year change from slider
  const handleYearChange = useCallback((year: number) => {
    setCurrentYear(year);
    transitionManagerRef.current?.setTargetEra(year);

    // Play transition SFX
    if (audioManagerRef.current && audioUnlocked) {
      audioManagerRef.current.playSFX('ui_click', 0.3);
    }
  }, [audioUnlocked]);

  // Initialize audio and WebGL managers after scene is ready
  const handleSceneReady = useCallback(() => {
    setSceneReady(true);
  }, []);

  // Handle canvas creation for WebGL context management
  const handleCanvasCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    const canvas = gl.domElement;
    canvasRef.current = canvas;

    // Initialize WebGL context manager
    // Dispose previous manager (if any)
    webglManagerRef.current?.dispose();
    const webglMgr = new WebGLContextManager(canvas);
    webglMgr.setGLContext(gl.getContext());
    webglMgr.onContextLost(() => {
      console.warn('[App] WebGL context lost — disposing resources');
      recoveryInProgressRef.current = true;
      setSceneReady(false);
    });
    webglMgr.onContextRestored(() => {
      console.log('[App] WebGL context restored — re-initializing');
      if (!recoveryInProgressRef.current) return;
      recoveryInProgressRef.current = false;
      // Force a full Canvas remount to recreate all GPU resources.
      // This is more robust than partial disposal/reinit for complex
      // R3F scenes.
      setCanvasKey((k) => k + 1);
    });
    webglManagerRef.current = webglMgr;
    setWebGLContextManager(webglMgr);

    // Initialize audio manager with the scene's audio listener
    // (The audio listener is created inside the Canvas via useThree)
  }, []);

  // Performance monitoring
  const PerformanceMonitor = () => {
    const { clock } = useThree();
    const lastTime = useRef(0);

    useFrame(() => {
      const elapsed = clock.elapsedTime;
      if (elapsed - lastTime.current > 0.1) {
        const delta = (elapsed - lastTime.current) * 1000;
        performanceManagerRef.current?.update(delta);
        lastTime.current = elapsed;
      }
    });

    return null;
  };

  // Audio listener setup component
  const AudioSetup = () => {
    const { camera, scene } = useThree();
    const listenerRef = useRef<THREE.AudioListener | null>(null);

    useEffect(() => {
      const listener = new THREE.AudioListener();
      camera.add(listener);
      listenerRef.current = listener;

      const audioMgr = new AudioManager(listener);
      audioManagerRef.current = audioMgr;
      setAudioManager(audioMgr);

      // If already unlocked (e.g., from a previous interaction), generate sounds
      if (audioMgr.isUnlocked()) {
        generateSounds(audioMgr);
      }

      return () => {
        if (listenerRef.current) {
          camera.remove(listenerRef.current);
        }
        audioMgr.dispose();
      };
    }, [camera, generateSounds]);

    return null;
  };

  return (
    <div className="app-container">
      {/* Timeline Slider */}
      <div className="ui-overlay">
        <TimelineSlider
          currentYear={currentYear}
          onYearChange={handleYearChange}
          isTransitioning={isTransitioning}
          transitionProgress={transitionProgress}
          eras={ERAS}
        />
      </div>

      {/* Audio unlock prompt */}
      {!audioUnlocked && (
        <div className="audio-prompt">
          <button
            onClick={async () => {
              if (audioManagerRef.current) {
                const unlocked = await audioManagerRef.current.unlock();
                if (unlocked) {
                  generateSounds(audioManagerRef.current);
                  setAudioUnlocked(true);
                }
              }
            }}
            className="audio-unlock-btn"
          >
            Click to enable sound
          </button>
        </div>
      )}

      {/* 3D Scene */}
      <Canvas
        key={canvasKey}
        camera={{ position: [30, 20, 30], fov: 60 }}
        gl={{
          antialias: true,
          alpha: false,
          stencil: false,
          depth: true,
          preserveDrawingBuffer: false,
          powerPreference: 'high-performance',
        }}
        onCreated={handleCanvasCreated}
        onPointerMissed={() => {}}
      >
        <Suspense fallback={null}>
          <Environment
            preset="city"
            environmentIntensity={0.5}
          />
          <PerformanceMonitor />
          <AudioSetup />

          {performance && audioManager && (
            <CityScene
              era={era}
              progress={progress}
              performance={performance}
              audioManager={audioManager}
              webglManager={webglManager!}
              onSceneReady={handleSceneReady}
            />
          )}
        </Suspense>
      </Canvas>

      {/* Loading overlay */}
      {!sceneReady && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <div className="loading-text">Building city...</div>
        </div>
      )}

      {/* Stats overlay (development only) */}
      {import.meta.env.DEV && performance && (
        <div className="stats-overlay">
          <div>FPS: {performanceManagerRef.current?.getCurrentFPS().toFixed(0) || '—'}</div>
          <div>Tier: {performance.tier}</div>
          <div>Buildings: {performance.maxBuildings}</div>
          <div>Vehicles: {performance.maxVehicles}</div>
          <div>Pedestrians: {performance.maxPedestrians}</div>
          <div>Quality: {performance.usePostProcessing ? 'High' : performance.useShadows ? 'Medium' : 'Low'}</div>
        </div>
      )}
    </div>
  );
}

export default App;
