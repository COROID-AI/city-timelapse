import React, { useMemo } from 'react'
import * as THREE from 'three'
import { EraStyles } from '../lib/eraStyles'

interface GroundProps {
  eraStyles: EraStyles
}

export function Ground({ eraStyles }: GroundProps) {
  const roadTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext('2d')!
    
    ctx.fillStyle = eraStyles.roadColor
    ctx.fillRect(0, 0, 512, 512)
    
    ctx.strokeStyle = eraStyles.roadLineColor
    ctx.lineWidth = 4
    ctx.setLineDash([20, 15])
    ctx.beginPath()
    ctx.moveTo(0, 256)
    ctx.lineTo(512, 256)
    ctx.stroke()
    
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(4, 4)
    return texture
  }, [eraStyles])

  return (
    <>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color={eraStyles.groundColor} />
      </mesh>

      {/* Road - horizontal */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-25, 0.01, 0]} receiveShadow>
        <planeGeometry args={[60, 8]} />
        <meshStandardMaterial map={roadTexture} />
      </mesh>

      {/* Road - vertical */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -25]} receiveShadow>
        <planeGeometry args={[8, 60]} />
        <meshStandardMaterial map={roadTexture} />
      </mesh>
    </>
  )
}