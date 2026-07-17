/**
 * Scene lights. Refs are forwarded so the SceneDriver can update colour,
 * intensity and position each frame from the continuous scene config.
 *
 * The refs are created in <Scene> and passed in; we attach them directly to the
 * light JSX elements so the driver reads the live instances via `.current`.
 */
import type { RefObject } from 'react'
import * as THREE from 'three'
import { EXTENT } from './layout'

export interface LightRefs {
  sun: RefObject<THREE.DirectionalLight | null>
  ambient: RefObject<THREE.HemisphereLight | null>
}

export function Lights({ refs }: { refs: LightRefs }) {
  return (
    <>
      <hemisphereLight ref={refs.ambient} args={[0x9a8a6a, 0x6a5a44, 0.5]} />
      <directionalLight
        ref={refs.sun}
        color={0xffd9a0}
        intensity={1.7}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={200}
        shadow-camera-left={-EXTENT}
        shadow-camera-right={EXTENT}
        shadow-camera-top={EXTENT}
        shadow-camera-bottom={-EXTENT}
        shadow-bias={-0.0004}
      />
    </>
  )
}
