import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useEraStore } from '../lib/store';

/**
 * Bounded orbit/pan/zoom navigation with a deterministic Reset View.
 *
 * Bounds prevent the camera from going under the ground, clipping into
 * buildings, or zooming out too far. The reset action restores the default
 * camera position/target and is keyboard/touch accessible via the DOM control.
 */

const DEFAULT_POS = new THREE.Vector3(34, 26, 34);
const DEFAULT_TARGET = new THREE.Vector3(0, 4, 0);
const MIN_DIST = 12;
const MAX_DIST = 85;
const MAX_POLAR = Math.PI * 0.49; // just above horizon — never under ground

export function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const registerReset = useEraStore((s) => s.registerReset);

  // Set default camera position on mount.
  useEffect(() => {
    camera.position.copy(DEFAULT_POS);
  }, [camera]);

  // Register the reset function so the DOM "Reset View" control can call it.
  useEffect(() => {
    registerReset(() => {
      const c = controlsRef.current;
      if (!c) return;
      camera.position.copy(DEFAULT_POS);
      c.target.copy(DEFAULT_TARGET);
      c.update();
    });
    return () => registerReset(null);
  }, [camera, registerReset]);

  return (
    <OrbitControls
      ref={controlsRef}
      target={DEFAULT_TARGET}
      enableDamping
      dampingFactor={0.08}
      minDistance={MIN_DIST}
      maxDistance={MAX_DIST}
      maxPolarAngle={MAX_POLAR}
      enablePan
      panSpeed={0.8}
      rotateSpeed={0.7}
      zoomSpeed={0.9}
      screenSpacePanning={false}
      makeDefault
    />
  );
}
