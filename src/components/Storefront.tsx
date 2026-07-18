import React, { useMemo } from 'react'
import * as THREE from 'three'
import { EraStyles } from '../lib/eraStyles'

interface StorefrontProps {
  position: [number, number, number]
  rotation: [number, number, number]
  width: number
  height: number
  eraStyles: EraStyles
}

export function Storefront({ position, rotation, width, height, eraStyles }: StorefrontProps) {
  const storeStyles = useMemo(() => {
    const adColors = eraStyles.advertisementStyles.colors
    const adFont = eraStyles.advertisementStyles.fonts[0]
    
    // Create advertisement canvas
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 128
    const ctx = canvas.getContext('2d')!
    
    // Clear with transparent background
    ctx.clearRect(0, 0, 256, 128)
    
    // Draw advertisement based on era
    switch (eraStyles.architecturalStyle) {
      case 'traditional':
        // 1945 - Hand-painted signs
        ctx.fillStyle = adColors[0]
        ctx.font = 'bold 20px ' + adFont
        ctx.fillText('Diner', 80, 40)
        ctx.fillText('Restaurant', 50, 70)
        ctx.strokeStyle = '#8B4513'
        ctx.lineWidth = 4
        ctx.strokeRect(5, 5, 246, 118)
        break
      
      case 'modernist':
        // 1965 - Bold geometric signs
        ctx.fillStyle = adColors[1]
        ctx.font = 'bold 24px ' + adFont
        ctx.fillText('MALL', 90, 50)
        ctx.fillStyle = adColors[2]
        ctx.fillText('SHOP', 90, 80)
        break
      
      case 'brutalist':
        // 1985 - Neon grid signs
        ctx.fillStyle = adColors[0]
        ctx.font = 'bold 28px ' + adFont
        ctx.fillText('VIDEO', 70, 45)
        ctx.fillText('STORE', 70, 80)
        // Grid pattern background
        ctx.strokeStyle = adColors[2]
        for (let i = 0; i < 256; i += 20) {
          ctx.beginPath()
          ctx.moveTo(i, 0)
          ctx.lineTo(i, 128)
          ctx.stroke()
        }
        break
      
      case 'postmodern':
        // 2005 - Digital screen style
        ctx.fillStyle = adColors[0]
        ctx.font = 'bold 22px ' + adFont
        ctx.fillText('ELECTRONICS', 40, 45)
        ctx.fillStyle = adColors[2]
        ctx.fillText('Tech World', 60, 75)
        // Pixelated effect
        ctx.strokeStyle = '#FFFFFF'
        ctx.strokeRect(10, 10, 236, 108)
        break
      
      case 'contemporary':
        // 2025 - Minimalist digital
        ctx.fillStyle = adColors[0]
        ctx.font = 'bold 26px ' + adFont
        ctx.textAlign = 'center'
        ctx.fillText('CAFÉ', 128, 50)
        ctx.fillStyle = adColors[2]
        ctx.font = '16px ' + adFont
        ctx.fillText('Organic Coffee', 128, 75)
        break
      
      case 'futuristic':
        // 2055 - Holographic display
        ctx.fillStyle = adColors[0]
        ctx.font = 'bold 24px ' + adFont
        ctx.textAlign = 'center'
        ctx.fillText('NEURAL', 128, 45)
        ctx.fillStyle = adColors[2]
        ctx.font = '20px ' + adFont
        ctx.fillText('COFFEE', 128, 70)
        ctx.fillStyle = adColors[3] || adColors[0]
        ctx.font = '12px ' + adFont
        ctx.fillText('AI BARISTA', 128, 90)
        break
    }
    
    const texture = new THREE.CanvasTexture(canvas)
    return texture
  }, [eraStyles])

  const buildingStyle = useMemo(() => {
    switch (eraStyles.architecturalStyle) {
      case 'traditional':
        return (
          <group>
            {/* Simple storefront with large windows */}
            <mesh castShadow>
              <boxGeometry args={[width, height, 1]} />
              <meshStandardMaterial color={eraStyles.buildingColors[0]} />
            </mesh>
            {/* Large glass windows */}
            <mesh position={[0, 0, 0.6]}>
              <boxGeometry args={[width - 0.5, height - 2, 0.3]} />
              <meshStandardMaterial color={eraStyles.windowColors[0]} transparent opacity={0.7} />
            </mesh>
            {/* Signage */}
            <mesh position={[0, height / 2 + 1, 0.5]}>
              <planeGeometry args={[width, 2]} />
              <meshBasicMaterial map={storeStyles} />
            </mesh>
          </group>
        )

      case 'modernist':
        return (
          <group>
            <mesh castShadow>
              <boxGeometry args={[width, height, 1]} />
              <meshStandardMaterial color={eraStyles.buildingColors[0]} />
            </mesh>
            {/* Large glass curtain wall */}
            <mesh position={[0, 0, 0.6]}>
              <boxGeometry args={[width - 0.2, height - 1, 0.4]} />
              <meshStandardMaterial color={eraStyles.windowColors[0]} transparent opacity={0.5} />
            </mesh>
            <mesh position={[0, height / 2 + 0.5, 0.7]}>
              <planeGeometry args={[width, 1.5]} />
              <meshBasicMaterial map={storeStyles} />
            </mesh>
          </group>
        )

      case 'brutalist':
        return (
          <group>
            <mesh castShadow>
              <boxGeometry args={[width, height, 1]} />
              <meshStandardMaterial color={eraStyles.buildingColors[0]} />
            </mesh>
            {/* Dark recessed windows */}
            {Array.from({ length: Math.floor(width) }).map((_, i) => (
              <group key={i}>
                <mesh position={[
                  -width / 2 + (i + 1) * (width / (Math.floor(width) + 1)),
                  0,
                  0.6
                ]}>
                  <boxGeometry args={[0.6, height - 3, 0.5]} />
                  <meshStandardMaterial color={eraStyles.windowColors[1]} />
                </mesh>
              </group>
            ))}
            <mesh position={[0, height / 2 + 1, 0.6]}>
              <planeGeometry args={[width - 0.5, 2]} />
              <meshBasicMaterial map={storeStyles} />
            </mesh>
          </group>
        )

      case 'postmodern':
        return (
          <group>
            <mesh castShadow>
              <boxGeometry args={[width, height, 1]} />
              <meshStandardMaterial color={eraStyles.buildingColors[0]} />
            </mesh>
            {/* Mixed window sizes */}
            <mesh position={[0, 0, 0.7]}>
              <boxGeometry args={[width - 0.3, height - 1, 0.4]} />
              <meshStandardMaterial color={eraStyles.windowColors[0]} transparent opacity={0.6} />
            </mesh>
            {/* Decorative awning */}
            <mesh position={[0, height / 2 + 0.3, 0]}>
              <boxGeometry args={[width + 0.5, 0.2, 0.1]} />
              <meshStandardMaterial color={eraStyles.buildingColors[1]} />
            </mesh>
            <mesh position={[0, height / 2 + 2, 0.8]}>
              <planeGeometry args={[width, 1.5]} />
              <meshBasicMaterial map={storeStyles} />
            </mesh>
          </group>
        )

      case 'contemporary':
        return (
          <group>
            <mesh castShadow>
              <boxGeometry args={[width, height, 1]} />
              <meshStandardMaterial color={eraStyles.buildingColors[0]} />
            </mesh>
            {/* Glass with metal frame */}
            <mesh position={[0, 0, 0.7]}>
              <boxGeometry args={[width - 0.1, height - 0.5, 0.3]} />
              <meshStandardMaterial color={eraStyles.windowColors[0]} transparent opacity={0.4} />
            </mesh>
            {/* Modern signage */}
            <mesh position={[0, height / 2 + 1, 0.8]}>
              <planeGeometry args={[width - 1, 2]} />
              <meshBasicMaterial map={storeStyles} />
            </mesh>
          </group>
        )

      case 'futuristic':
        return (
          <group>
            <mesh castShadow>
              <boxGeometry args={[width, height, 1]} />
              <meshStandardMaterial 
                color={eraStyles.buildingColors[0]}
                emissive={eraStyles.buildingColors[0]}
                emissiveIntensity={0.1}
              />
            </mesh>
            {/* Holographic display windows */}
            <mesh position={[0, 0, 0.8]}>
              <boxGeometry args={[width - 0.2, height - 1, 0.4]} />
              <meshStandardMaterial 
                color={eraStyles.windowColors[0]} 
                emissive={eraStyles.windowColors[0]}
                emissiveIntensity={0.3}
                transparent
                opacity={0.7}
              />
            </mesh>
            {/* Holographic signage */}
            <mesh position={[0, height / 2 + 1, 0.9]}>
              <planeGeometry args={[width - 0.5, 2]} />
              <meshBasicMaterial 
                map={storeStyles}
                transparent
              />
            </mesh>
            {/* LED strip accent */}
            <mesh position={[0, -height / 2 + 0.5, 0]}>
              <boxGeometry args={[width + 0.2, 0.1, 0.05]} />
              <meshStandardMaterial 
                color={eraStyles.windowColors[2] || '#00BCD4'}
                emissive={eraStyles.windowColors[2] || '#00BCD4'}
                emissiveIntensity={0.5}
              />
            </mesh>
          </group>
        )
    }
  }, [width, height, eraStyles, storeStyles])

  return (
    <group position={position} rotation={rotation}>
      {buildingStyle}
    </group>
  )
}