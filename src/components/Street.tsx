import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { gsap } from 'gsap'
import * as THREE from 'three'
import type { Era } from '../App'

interface StreetProps {
  era: Era
}

export const Street: React.FC<StreetProps> = ({ era }) => {
  const streetRef = useRef<THREE.Group>(null!)
  const prevEraRef = useRef<Era>(era)

  const streetSettings = useMemo(() => {
    return {
      1945: {
        color: '#404040',
        lineColor: '#ffff00',
        lineWidth: 0.3,
        hasSidewalk: true,
      },
      1965: {
        color: '#303030',
        lineColor: '#ffffff',
        lineWidth: 0.2,
        hasSidewalk: true,
      },
      1985: {
        color: '#202020',
        lineColor: '#00ffff',
        lineWidth: 0.2,
        hasSidewalk: true,
        hasNeon: true,
      },
      2005: {
        color: '#353535',
        lineColor: '#ffffff',
        lineWidth: 0.25,
        hasSidewalk: true,
        hasLaneMarkers: true,
      },
      2025: {
        color: '#383838',
        lineColor: '#ffffff',
        lineWidth: 0.25,
        hasSidewalk: true,
        hasLaneMarkers: true,
      },
      2055: {
        color: '#101020',
        lineColor: '#00ffff',
        lineWidth: 0.15,
        hasSidewalk: true,
        hasGlow: true,
      },
    }[era]
  }, [era])

  // Animate street changes
  useFrame(() => {
    if (prevEraRef.current !== era && streetRef.current) {
      gsap.to(streetRef.current.scale, {
        x: 1.02,
        y: 1.02,
        z: 1.02,
        duration: 0.5,
        yoyo: true,
        repeat: 1,
      })
    }
    prevEraRef.current = era
  })

  return (
    <group ref={streetRef}>
      {/* Main street */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 20]} />
        <meshStandardMaterial color={streetSettings.color} roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Road markings - center line */}
      {streetSettings.hasLaneMarkers !== false && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <planeGeometry args={[200, streetSettings.lineWidth]} />
          <meshStandardMaterial
            color={streetSettings.lineColor}
            emissive={era === 2055 ? streetSettings.lineColor : '#000000'}
            emissiveIntensity={era === 2055 ? 0.5 : 0}
          />
        </mesh>
      )}

      {/* Sidewalk */}
      {streetSettings.hasSidewalk && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-90, 0.02, 0]}>
            <planeGeometry args={[20, 100]} />
            <meshStandardMaterial color="#505050" roughness={0.9} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[90, 0.02, 0]}>
            <planeGeometry args={[20, 100]} />
            <meshStandardMaterial color="#505050" roughness={0.9} />
          </mesh>
        </>
      )}

      {/* Crosswalk */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 40]}>
        <planeGeometry args={[6, 12]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {/* Street details - benches, lights, etc. */}
      {Array.from({ length: 10 }).map((_, i) => (
        <StreetDetail
          key={i}
          position={[-80 + i * 18, 0, -5]}
          era={era}
          index={i}
        />
      ))}
    </group>
  )
}

interface StreetDetailProps {
  position: [number, number, number]
  era: Era
  index: number
}

interface DetailSettings {
  lampPost: boolean
  bench: boolean
  neon: boolean
  holo: boolean
  color: string
}

const StreetDetail: React.FC<StreetDetailProps> = ({ position, era, index }) => {
  const detailSettings: DetailSettings = {
    1945: { lampPost: true, bench: true, neon: false, holo: false, color: '#8b4513' },
    1965: { lampPost: true, bench: true, neon: false, holo: false, color: '#654321' },
    1985: { lampPost: true, bench: false, neon: true, holo: false, color: '#00ffff' },
    2005: { lampPost: true, bench: true, neon: false, holo: false, color: '#444444' },
    2025: { lampPost: true, bench: true, neon: false, holo: false, color: '#555555' },
    2055: { lampPost: true, bench: false, neon: false, holo: true, color: '#00ffff' },
  }[era]

  return (
    <group position={position}>
      {/* Lamp post */}
      {detailSettings.lampPost && (
        <group>
          <mesh position={[0, 4, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.15, 8]} />
            <meshStandardMaterial color="#444" />
          </mesh>
          <mesh position={[0, 8.5, 0]} castShadow>
            <sphereGeometry args={[0.5, 16, 16]} />
            <meshStandardMaterial
              color={detailSettings.color}
              emissive={detailSettings.neon || detailSettings.holo ? detailSettings.color : '#000000'}
              emissiveIntensity={detailSettings.holo ? 1 : detailSettings.neon ? 0.5 : 0}
            />
          </mesh>
        </group>
      )}

      {/* Bench */}
      {detailSettings.bench && (
        <group position={[0, 0.5, 0]}>
          <mesh>
            <boxGeometry args={[2, 0.2, 0.6]} />
            <meshStandardMaterial color={detailSettings.color} />
          </mesh>
          <mesh position={[0, 0.4, -0.4]}>
            <boxGeometry args={[2, 0.1, 0.1]} />
            <meshStandardMaterial color={detailSettings.color} />
          </mesh>
          <mesh position={[0, 0.4, 0.4]}>
            <boxGeometry args={[2, 0.1, 0.1]} />
            <meshStandardMaterial color={detailSettings.color} />
          </mesh>
        </group>
      )}
    </group>
  )
}