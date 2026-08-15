import React from 'react';
import * as THREE from 'three';
import { CounterTechnology } from './CounterTechnology';

/** CafeShell - Café architectural shell - permanent container
 * Renders the café floor, walls, windows, and counter structure.
 * Era-independent architectural container that wraps era-specific
 * tableware and patron equipment via CounterTechnology.
 *
 * The shell provides:
 * - Floor plane (8m × 12m in XZ plane)
 * - Ceiling at y=3.5m
 * - Four walls forming the café boundary
 * - Window frames and glass on left and right walls
 * - Counter base along back wall
 * - Era-specific CounterTechnology component for POS equipment
 */

export const CafeShell: React.FC = () => {
  return (
    <>

      {/* Floor: 8m × 12m, rotated -90° on X axis to lie in XZ plane */}
      <mesh rotation={{ x: -Math.PI / 2 }}>
        {/* @ts-ignore */}
        <planeGeometry args={[8, 12]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Ceiling: 8m × 12m footprint at y=3.5m */}
      <mesh>
        {/* @ts-ignore */}
        <planeGeometry args={[8, 12]} />
        <position y={3.5} />
        <meshStandardMaterial color="#D2B48C" />
      </mesh>

      {/* Front wall: two BoxGeometry pieces with 0.9m door opening center-left */}
      {/* Left wall part: from x=-4 to x=-0.45 (width 3.55m) */}
      <mesh>
        {/* @ts-ignore */}
        <boxGeometry args={[3.55, 3.5, 0.2]} />
        <position x={-2.275} y={0} z={-6} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Right wall part: from x=0.45 to x=4 (width 3.55m) */}
      <mesh>
        {/* @ts-ignore */}
        <boxGeometry args={[3.55, 3.5, 0.2]} />
        <position x={2.275} y={0} z={-6} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Left wall: 1.2m × 3.5m × 0.2m depth */}
      <mesh>
        {/* @ts-ignore */}
        <boxGeometry args={[1.2, 3.5, 0.2]} />
        <position x={-4} y={0} z={0} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Right wall: 1.2m × 3.5m × 0.2m depth */}
      <mesh>
        {/* @ts-ignore */}
        <boxGeometry args={[1.2, 3.5, 0.2]} />
        <position x={4} y={0} z={0} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Window frames on left and right walls with semi-transparent glass */}
      {/* Left window frame: thin BoxGeometry */}
      <mesh>
        {/* @ts-ignore */}
        <boxGeometry args={[0.1, 1.5, 0.1]} />
        <position x={-4} y={2.25} z={0.05} />
        <meshStandardMaterial color="#000000" />
      </mesh>

      {/* Right window frame: thin BoxGeometry */}
      <mesh>
        {/* @ts-ignore */}
        <boxGeometry args={[0.1, 1.5, 0.1]} />
        <position x={4} y={2.25} z={0.05} />
        <meshStandardMaterial color="#000000" />
      </mesh>

      {/* Left window glass: semi-transparent plane */}
      <mesh>
        {/* @ts-ignore */}
        <planeGeometry args={[0.8, 1.5]} />
        <position x={-4} y={2.25} z={0.1} />
        <meshBasicMaterial transparent opacity={0.3} color="#0000ffff" />
      </mesh>

      {/* Right window glass: semi-transparent plane */}
      <mesh>
        {/* @ts-ignore */}
        <planeGeometry args={[0.8, 1.5]} />
        <position x={4} y={2.25} z={0.1} />
        <meshBasicMaterial transparent opacity={0.3} color="#0000ffff" />
      </mesh>

      {/* Counter base along back wall: 4m × 1.1m high × 0.7m deep */}
      {/* Top surface at y=1.1m, flat and unobstructed for equipment placement */}
      <mesh>
        {/* @ts-ignore */}
        <boxGeometry args={[4, 1.1, 0.7]} />
        <position x={0} y={0.55} z={5.35} />
        <meshStandardMaterial color="#A0522D" />
      </mesh>

      {/* Era-specific counter payment & POS technology */}
      <CounterTechnology />
    </>
  )
}