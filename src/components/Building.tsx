import React, { useRef, useMemo, useCallback, useEffect } from 'react'
import { Mesh } from 'three'
import { useFrame } from '@react-three/fiber'
import { Era } from '../contexts/EraContext'

interface BuildingProps {
  position: [number, number, number]
  size: [number, number, number]
  currentEra: Era
  transitionProgress: number
}

type BuildingStyle = {
  windows: { count: [number, number, number], style: 'colonial' | 'modern' | 'glass' | 'led' | 'hologram' }
  facade: string
  height: number
  hasFireEscape?: boolean
  hasAntenna?: boolean
  material: {
    color: string
    roughness: number
    metalness: number
  }
}

const eraStyles: Record<Era, BuildingStyle[]> = {
  '1945': [
    { windows: { count: [2, 4, 2], style: 'colonial' }, facade: 'brick', height: 1, material: { color: '#8B4513', roughness: 0.9, metalness: 0.1 } },
    { windows: { count: [3, 5, 3], style: 'colonial' }, facade: 'brick', height: 1, hasFireEscape: true, material: { color: '#A0522D', roughness: 0.85, metalness: 0.1 } },
    { windows: { count: [2, 3, 2], style: 'colonial' }, facade: 'brick', height: 0.8, material: { color: '#654321', roughness: 0.9, metalness: 0.1 } },
  ],
  '1965': [
    { windows: { count: [4, 6, 4], style: 'modern' }, facade: 'concrete', height: 1.2, material: { color: '#C0C0C0', roughness: 0.7, metalness: 0.2 } },
    { windows: { count: [5, 7, 5], style: 'modern' }, facade: 'glass', height: 1.1, material: { color: '#E0E0E0', roughness: 0.5, metalness: 0.3 } },
    { windows: { count: [3, 5, 3], style: 'modern' }, facade: 'concrete', height: 1, material: { color: '#A9A9A9', roughness: 0.7, metalness: 0.2 } },
  ],
  '1985': [
    { windows: { count: [6, 8, 6], style: 'glass' }, facade: 'glass', height: 1.5, material: { color: '#ADD8E6', roughness: 0.3, metalness: 0.4 } },
    { windows: { count: [5, 7, 5], style: 'glass' }, facade: 'glass', height: 1.4, material: { color: '#B0C4DE', roughness: 0.4, metalness: 0.3 } },
    { windows: { count: [4, 6, 4], style: 'glass' }, facade: 'glass', height: 1.3, material: { color: '#87CEEB', roughness: 0.3, metalness: 0.5 } },
  ],
  '2005': [
    { windows: { count: [8, 10, 8], style: 'glass' }, facade: 'glass', height: 1.8, material: { color: '#00BFFF', roughness: 0.2, metalness: 0.5 } },
    { windows: { count: [6, 8, 6], style: 'glass' }, facade: 'glass', height: 1.6, hasAntenna: true, material: { color: '#1E90FF', roughness: 0.25, metalness: 0.6 } },
    { windows: { count: [7, 9, 7], style: 'glass' }, facade: 'glass', height: 1.7, material: { color: '#4682B4', roughness: 0.2, metalness: 0.5 } },
  ],
  '2025': [
    { windows: { count: [10, 12, 10], style: 'led' }, facade: 'smart', height: 2, material: { color: '#2F4F4F', roughness: 0.3, metalness: 0.7 } },
    { windows: { count: [8, 10, 8], style: 'led' }, facade: 'smart', height: 1.9, hasAntenna: true, material: { color: '#3CB371', roughness: 0.25, metalness: 0.7 } },
    { windows: { count: [9, 11, 9], style: 'led' }, facade: 'smart', height: 2, material: { color: '#008080', roughness: 0.3, metalness: 0.8 } },
  ],
  '2055': [
    { windows: { count: [15, 20, 15], style: 'hologram' }, facade: 'holographic', height: 2.5, material: { color: '#4B0082', roughness: 0.1, metalness: 0.9 } },
    { windows: { count: [12, 18, 12], style: 'hologram' }, facade: 'holographic', height: 2.3, hasAntenna: true, material: { color: '#8A2BE2', roughness: 0.1, metalness: 0.8 } },
    { windows: { count: [14, 16, 14], style: 'hologram' }, facade: 'holographic', height: 2.4, material: { color: '#9400D3', roughness: 0.15, metalness: 0.85 } },
  ],
}

const ERA_ORDER: Era[] = ['1945', '1965', '1985', '2005', '2025', '2055']

function interpolateColor(a: string, b: string, t: number): string {
  const ca = parseInt(a.slice(1), 16)
  const cb = parseInt(b.slice(1), 16)
  const ar = (ca >> 16) & 0xff
  const ag = (ca >> 8) & 0xff
  const ab = ca & 0xff
  const br = (cb >> 16) & 0xff
  const bg = (cb >> 8) & 0xff
  const bb = cb & 0xff
  const cr = Math.round(ar + (br - ar) * t)
  const cg = Math.round(ag + (bg - ag) * t)
  const cb_ = Math.round(ab + (bb - ab) * t)
  const hex = ((cr << 16) | (cg << 8) | cb_).toString(16).padStart(6, '0')
  return `#${hex}`
}

export function Building({ position, size, currentEra, transitionProgress }: BuildingProps) {
  const meshRef = useRef<Mesh>(null!)
  const styleIndex = (position[0] + position[2] * 3) % 3
  const prevEraRef = useRef<Era>(currentEra)

  const getInterpolatedStyle = useCallback((progress: number) => {
    const fromIndex = ERA_ORDER.indexOf(prevEraRef.current)
    const toIndex = ERA_ORDER.indexOf(currentEra)
    
    if (fromIndex === toIndex || progress >= 1) {
      return eraStyles[currentEra][styleIndex]
    }

    const fromEra = ERA_ORDER[fromIndex] as Era
    const toEra = ERA_ORDER[toIndex] as Era
    const fromStyle = eraStyles[fromEra][styleIndex]
    const toStyle = eraStyles[toEra][styleIndex]

    return {
      windows: {
        count: [
          Math.round(fromStyle.windows.count[0] + (toStyle.windows.count[0] - fromStyle.windows.count[0]) * progress),
          Math.round(fromStyle.windows.count[1] + (toStyle.windows.count[1] - fromStyle.windows.count[1]) * progress),
          Math.round(fromStyle.windows.count[2] + (toStyle.windows.count[2] - fromStyle.windows.count[2]) * progress),
        ],
        style: progress > 0.5 ? toStyle.windows.style : fromStyle.windows.style
      },
      facade: progress > 0.5 ? toStyle.facade : fromStyle.facade,
      height: fromStyle.height + (toStyle.height - fromStyle.height) * progress,
      hasFireEscape: progress < 0.3 ? fromStyle.hasFireEscape : toStyle.hasFireEscape,
      hasAntenna: progress > 0.7 ? toStyle.hasAntenna : fromStyle.hasAntenna,
      material: {
        color: interpolateColor(fromStyle.material.color, toStyle.material.color, progress),
        roughness: fromStyle.material.roughness + (toStyle.material.roughness - fromStyle.material.roughness) * progress,
        metalness: fromStyle.material.metalness + (toStyle.material.metalness - fromStyle.material.metalness) * progress,
      }
    }
  }, [currentEra, styleIndex])

  const style = useMemo(() => {
    return getInterpolatedStyle(transitionProgress)
  }, [currentEra, transitionProgress, getInterpolatedStyle])

  useFrame(() => {
    if (meshRef.current && !style.hasAntenna) {
      const scale = 1 + Math.sin(Date.now() * 0.001) * 0.001
      meshRef.current.scale.y = style.height * scale
    }
  })

  useEffect(() => {
    prevEraRef.current = currentEra
  }, [currentEra])

  const [width, height, depth] = size
  const windowWidth = 0.8
  const windowHeight = 1.2
  const windowDepth = 0.1

  return (
    <group position={position}>
      <mesh ref={meshRef} receiveShadow castShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial 
          color={style.material.color} 
          roughness={style.material.roughness}
          metalness={style.material.metalness}
        />
      </mesh>
      
      {style.windows.count[1] > 0 && (
        <group position={[0, 0, depth / 2 + 0.01]}>
          {Array.from({ length: style.windows.count[1] }).map((_, y) =>
            Array.from({ length: style.windows.count[0] }).map((_, x) => (
              <mesh 
                key={`${x}-${y}`} 
                position={[
                  -width / 2 + (x + 0.5) * (width / style.windows.count[0]),
                  height / 2 - (y + 0.5) * (height / style.windows.count[1]),
                  0
                ]}
              >
                <boxGeometry args={[windowWidth, windowHeight, windowDepth]} />
                <meshStandardMaterial 
                  color={getWindowColor(style.windows.style)}
                  emissive={getWindowEmissive(style.windows.style)}
                  emissiveIntensity={style.windows.style === 'hologram' ? 0.8 : 0}
                />
              </mesh>
            ))
          )}
        </group>
      )}

      {style.hasFireEscape && (
        <mesh position={[width / 2 + 0.2, 0, 0]}>
          <boxGeometry args={[0.3, height * 0.8, 0.3]} />
          <meshStandardMaterial color="#555555" roughness={0.8} />
        </mesh>
      )}

      {style.hasAntenna && (
        <mesh position={[0, height / 2 + 1.5, 0]}>
          <cylinderGeometry args={[0.1, 0.2, 3]} />
          <meshStandardMaterial color="#333333" metalness={0.9} roughness={0.2} />
        </mesh>
      )}
    </group>
  )
}

function getWindowColor(style: string): string {
  switch (style) {
    case 'colonial': return '#ADD8E6'
    case 'modern': return '#87CEFA'
    case 'glass': return '#FFFFFF'
    case 'led': return '#00FFFF'
    case 'hologram': return '#9400D3'
    default: return '#FFFFFF'
  }
}

function getWindowEmissive(style: string): string {
  return style === 'hologram' ? '#9400D3' : '#000000'
}