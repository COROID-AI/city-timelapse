import { useMemo, useRef } from 'react'
import { MeshStandardMaterial, RepeatWrapping, Color, Texture } from 'three'
import { EraTheme } from '../era/theme'

type GroundProps = {
  theme: EraTheme
}

/**
 * Procedurally generates the ground plane with era-appropriate texturing.
 * Uses a canvas-drawn texture for ground detail (street markings, etc.).
 * No external assets.
 */
export function Ground({ theme }: GroundProps) {
  const meshRef = useRef<any>(null!)
  const matRef = useRef<MeshStandardMaterial>(null!)

  const texture = useMemo(() => {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    // Base ground color
    const g = theme.ground
    ctx.fillStyle = `rgb(${Math.round(g.r * 255)}, ${Math.round(g.g * 255)}, ${Math.round(g.b * 255)})`
    ctx.fillRect(0, 0, size, size)

    // Street markings (yellow/white lines)
    const lineColor = theme.streetColor.clone().lerp(new Color(1, 1, 1), 0.7)
    ctx.strokeStyle = `rgb(${Math.round(lineColor.r * 255)}, ${Math.round(lineColor.g * 255)}, ${Math.round(lineColor.b * 255)})`
    ctx.lineWidth = 3
    ctx.setLineDash([20, 30])
    ctx.beginPath()
    ctx.moveTo(0, size / 2)
    ctx.lineTo(size, size / 2)
    ctx.moveTo(size / 2, 0)
    ctx.lineTo(size / 2, size)
    ctx.stroke()

    // Crosswalk patterns for modern eras
    if (theme.year >= 2005) {
      ctx.setLineDash([8, 8])
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < 5; i++) {
        const y = 80 + i * 30
        ctx.moveTo(60, y)
        ctx.lineTo(140, y)
      }
      ctx.stroke()
    }

    // Grid texture for neo-future
    if (theme.buildingStyle === 'neoFuture') {
      ctx.strokeStyle = `rgba(${Math.round(theme.accent.r * 255)}, ${Math.round(theme.accent.g * 255)}, ${Math.round(theme.accent.b * 255)}, 0.15)`
      ctx.lineWidth = 1
      ctx.setLineDash([4, 12])
      ctx.beginPath()
      for (let i = 0; i <= 16; i++) {
        ctx.moveTo(i * 32, 0)
        ctx.lineTo(i * 32, size)
        ctx.moveTo(0, i * 32)
        ctx.lineTo(size, i * 32)
      }
      ctx.stroke()
    }

    const tex = new Texture(canvas)
    tex.wrapS = RepeatWrapping
    tex.wrapT = RepeatWrapping
    tex.repeat.set(4, 4)
    tex.anisotropy = 16
    tex.needsUpdate = true
    return tex
  }, [theme])

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[80, 80]} />
      <meshStandardMaterial map={texture} roughness={0.9} metalness={0.1} />
    </mesh>
  )
}
