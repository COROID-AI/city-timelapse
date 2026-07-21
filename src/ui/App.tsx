import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Scene } from '../three/Scene';
import { CameraControls, PanLimiter } from '../three/CameraControls';
import { Hud } from './Hud';
import { SceneErrorBoundary } from './SceneErrorBoundary';
import { NoWebGLFallback, LoadingFallback } from './Fallbacks';
import { detectWebGL, prefersReducedMotion } from './webgl';
import { useSceneStore } from '../store/useSceneStore';

// ---------------------------------------------------------------------------
// App shell — mounts the R3F Canvas inside an error boundary, with a loading
// state shown until the renderer is ready, and clear fallbacks for WebGL
// unavailability and context loss.
// ---------------------------------------------------------------------------

export function App() {
  const [webgl] = useState(() => detectWebGL());
  const [contextLost, setContextLost] = useState(false);
  const [ready, setReady] = useState(false);

  const setReducedMotion = useSceneStore((s) => s.setReducedMotion);

  // Respect the OS reduced-motion preference on mount + when it changes.
  useEffect(() => {
    if (!prefersReducedMotion()) return;
    setReducedMotion(true);

    let mql: MediaQueryList | null = null;
    try {
      mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      mql.addEventListener('change', onChange);
      return () => mql?.removeEventListener('change', onChange);
    } catch {
      return;
    }
  }, [setReducedMotion]);

  const handleCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    // Cap device pixel ratio for performance (acceptance criteria).
    gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.1;

    // Context-loss handling
    const canvas = gl.domElement;
    const onLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    canvas.addEventListener('webglcontextlost', onLost);

    setReady(true);
  }, []);

  // --- Render paths ---

  // No WebGL → clear fallback
  if (!webgl.supported) {
    return <NoWebGLFallback reason={webgl.reason} />;
  }

  // Context lost → clear fallback with reload
  if (contextLost) {
    return (
      <div className="fallback" role="alert">
        <div className="fallback__icon">⚡</div>
        <h2 className="fallback__title">Graphics context lost</h2>
        <p className="fallback__msg">
          The WebGL context was lost (this can happen after GPU resets or long
          tab inactivity). Reload to restore the scene.
        </p>
        <button className="fallback__btn" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <SceneErrorBoundary>
        <Canvas
          shadows="percentage"
          dpr={[1, 1.75]}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            alpha: false,
            stencil: false,
            depth: true,
          }}
          camera={{ fov: 50, near: 0.1, far: 1000, position: [45, 32, 55] }}
          onCreated={handleCreated}
        >
          <Suspense fallback={null}>
            <Scene />
            <CameraControls />
            <PanLimiter />
          </Suspense>
        </Canvas>
      </SceneErrorBoundary>

      {/* Loading overlay shown until the Canvas renderer is ready */}
      {!ready && <LoadingFallback />}

      <Hud />
    </div>
  );
}
