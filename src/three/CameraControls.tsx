import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useSceneStore } from '../store/useSceneStore';

// ---------------------------------------------------------------------------
// Bounded OrbitControls — prevents going under ground, runaway zoom, and
// losing the scene. Also implements camera reset and auto-rotate.
// ---------------------------------------------------------------------------

// The "home" camera position — a good 3/4 view of the block.
const HOME_POS = new THREE.Vector3(45, 32, 55);
const HOME_TARGET = new THREE.Vector3(0, 12, 0);

export function CameraControls() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const cameraResetToken = useSceneStore((s) => s.cameraResetToken);
  const autoRotate = useSceneStore((s) => s.autoRotate);
  const reducedMotion = useSceneStore((s) => s.reducedMotion);

  // Initialise camera at the home position.
  useEffect(() => {
    camera.position.copy(HOME_POS);
    camera.lookAt(HOME_TARGET);
  }, [camera]);

  // Camera reset — animated ease back to home.
  useEffect(() => {
    if (cameraResetToken === 0) return;
    const controls = controlsRef.current;
    if (!controls) return;
    // Snap-teleport for reduced motion, otherwise animate.
    if (reducedMotion) {
      camera.position.copy(HOME_POS);
      controls.target.copy(HOME_TARGET);
      controls.update();
      return;
    }
    // Animate over ~0.6s
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const duration = 600;
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - t0;
      const t = Math.min(1, elapsed / duration);
      const e = 1 - Math.pow(1 - t, 3); // ease-out cubic
      camera.position.lerpVectors(startPos, HOME_POS, e);
      controls.target.lerpVectors(startTarget, HOME_TARGET, e);
      controls.update();
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cameraResetToken, camera, reducedMotion]);

  return (
    <OrbitControls
      ref={controlsRef}
      target={HOME_TARGET}
      // Bounded polar angle: can't go below horizon (0.1 rad) or fully top-down.
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI / 2 - 0.05}
      // Bounded zoom
      minDistance={18}
      maxDistance={120}
      // Pan bounds — keep target inside the block
      enablePan
      // Auto-rotate (disabled in reduced motion)
      autoRotate={autoRotate && !reducedMotion}
      autoRotateSpeed={0.4}
      enableDamping
      dampingFactor={0.08}
      makeDefault
    />
  );
}

// ---------------------------------------------------------------------------
// Pan limiter — clamp the OrbitControls target to the block area so panning
// can't drag the camera target off into the void.
// ---------------------------------------------------------------------------
export function PanLimiter() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { controls } = useThree() as unknown as { controls: OrbitControlsImpl | null };

  useFrame(() => {
    const c = controlsRef.current ?? controls;
    if (!c) return;
    // Clamp target within a box around the block
    const LIMIT = 25;
    c.target.x = THREE.MathUtils.clamp(c.target.x, -LIMIT, LIMIT);
    c.target.z = THREE.MathUtils.clamp(c.target.z, -LIMIT, LIMIT);
    c.target.y = THREE.MathUtils.clamp(c.target.y, 0, 40);
  });

  return null;
}
