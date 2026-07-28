import { useRef, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';

// Preload all GLTF models if any in the future
export function usePreloadAssets() {
  // Currently all assets are procedural - no GLTF needed
  return null;
}
