import React, { ReactElement } from 'react'
import { Mesh } from 'three'
import { BoxGeometry, PlaneGeometry, MeshStandardMaterial, MeshBasicMaterial } from 'three'
import { CounterTechnology } from './CounterTechnology'

export const CafeShell: React.FC = (): ReactElement => {
  return (
    <>
      {/* Floor: 8m × 12m, rotated -90° on X axis to lie in XZ plane */}
      <Mesh rotation={{ x: -Math.PI / 2 }}>
        <PlaneGeometry args={[8, 12]} />
        <MeshStandardMaterial color="#8B4513" />
      </Mesh>

      {/* Ceiling: 8m × 12m footprint at y=3.5m */}
      <Mesh>
        <PlaneGeometry args={[8, 12]} />
        <position y={3.5} />
        <MeshStandardMaterial color="#D2B48C" />
      </Mesh>

      {/* Front wall: two BoxGeometry pieces with 0.9m door opening center-left */}
      {/* Left wall part: from x=-4 to x=-0.45 (width 3.55m) */}
      <Mesh>
        <BoxGeometry args={[3.55, 3.5, 0.2]} />
        <position x={-2.275} y={0} z={-6} />
        <MeshStandardMaterial color="#8B4513" />
      </Mesh>

      {/* Right wall part: from x=0.45 to x=4 (width 3.55m) */}
      <Mesh>
        <BoxGeometry args={[3.55, 3.5, 0.2]} />
        <position x={2.275} y={0} z={-6} />
        <MeshStandardMaterial color="#8B4513" />
      </Mesh>

      {/* Left wall: 1.2m × 3.5m × 0.2m depth */}
      <Mesh>
        <BoxGeometry args={[1.2, 3.5, 0.2]} />
        <position x={-4} y={0} z={0} />
        <MeshStandardMaterial color="#8B4513" />
      </Mesh>

      {/* Right wall: 1.2m × 3.5m × 0.2m depth */}
      <Mesh>
        <BoxGeometry args={[1.2, 3.5, 0.2]} />
        <position x={4} y={0} z={0} />
        <MeshStandardMaterial color="#8B4513" />
      </Mesh>

      {/* Window frames on left and right walls with semi-transparent glass */}
      {/* Left window frame: thin BoxGeometry */}
      <Mesh>
        <BoxGeometry args={[0.1, 1.5, 0.1]} />
        <position x={-4} y={2.25} z={0.05} />
        <MeshStandardMaterial color="#000000" />
      </Mesh>

      {/* Right window frame: thin BoxGeometry */}
      <Mesh>
        <BoxGeometry args={[0.1, 1.5, 0.1]} />
        <position x={4} y={2.25} z={0.05} />
        <MeshStandardMaterial color="#000000" />
      </Mesh>

      {/* Left window glass: semi-transparent plane */}
      <Mesh>
        <PlaneGeometry args={[0.8, 1.5]} />
        <position x={-4} y={2.25} z={0.1} />
        <MeshBasicMaterial transparent opacity={0.3} color="#0000ffff" />
      </Mesh>

      {/* Right window glass: semi-transparent plane */}
      <Mesh>
        <PlaneGeometry args={[0.8, 1.5]} />
        <position x={4} y={2.25} z={0.1} />
        <MeshBasicMaterial transparent opacity={0.3} color="#0000ffff" />
      </Mesh>

      {/* Counter base along back wall: 4m × 1.1m high × 0.7m deep */}
      {/* Top surface at y=1.1m, flat and unobstructed for equipment placement */}
      <Mesh>
        <BoxGeometry args={[4, 1.1, 0.7]} />
        <position x={0} y={0.55} z={5.35} />
        <MeshStandardMaterial color="#A0522D" />
      </Mesh>

      {/* Era-specific counter payment & POS technology */}
      <CounterTechnology />
    </>
  )
}