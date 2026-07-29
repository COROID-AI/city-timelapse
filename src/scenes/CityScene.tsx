import React, { useRef, useMemo, useEffect, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useAppStore } from '../state'
import { ERA_PALETTES, ERA_BUILDINGS, type EraId, ERA_IDS } from '../eras'
import { Ground } from './Ground'
import { Building } from './Building'
import { StreetLights } from './StreetLights'
import { Vehicles } from './Vehicles'
import { Pedestrians } from './pedestrians'
import { Skylight } from './Skylight'
import { createAmbientSound } from '../audio/mixer'
import { disposeAudio } from '../audio/mixer'

export function CityScene() {
  const { eraId, audioMuted } = useAppStore()
  const eraIndex = ERA_IDS.indexOf(eraId)
  const blockRef = useRef<THREE.Group>(null)
  const audioStarted = useRef(false)

  // Initialize audio on first user interaction
  const handleInitAudio = useCallback(() => {
    if (audioStarted.current) return
    audioStarted.current = true
    createAmbientSound(eraId)
    window.removeEventListener('pointerdown', handleInitAudio)
    window.removeEventListener('keydown', handleInitAudio)
  }, [eraId])

  useEffect(() => {
    window.addEventListener('pointerdown', handleInitAudio)
    window.addEventListener('keydown', handleInitAudio)
    return () => {
      window.removeEventListener('pointerdown', handleInitAudio)
      window.removeEventListener('keydown', handleInitAudio)
      disposeAudio()
    }
  }, [handleInitAudio])

  useFrame((_, delta) => {
    if (blockRef.current) {
      blockRef.current.rotation.y += delta * 0.02
    }
  })

  const palette = useMemo(() => ERA_PALETTES[eraId], [eraId])
  const buildingDef = useMemo(() => ERA_BUILDINGS[eraId], [eraId])

  const buildings = useMemo(() => {
    const list: Array<{ x: number; z: number; w: number; d: number; h: number; idx: number }> = []
    const { width: bw, depth: bd, minHeight, maxHeight, setbackMin, setbackMax } = buildingDef
    const positions = [
      { x: -18, z: -18 }, { x: -18, z: -10 }, { x: -18, z: 0 }, { x: -18, z: 10 }, { x: -18, z: 18 },
      { x: 18, z: -18 }, { x: 18, z: -10 }, { x: 18, z: 0 }, { x: 18, z: 10 }, { x: 18, z: 18 },
      { x: -10, z: -18 }, { x: -10, z: -10 }, { x: -10, z: 10 }, { x: -10, z: 18 },
      { x: 10, z: -18 }, { x: 10, z: -10 }, { x: 10, z: 10 }, { x: 10, z: 18 },
    ]
    let idx = 0
    for (const pos of positions) {
      const setBack = setbackMin + Math.random() * (setbackMax - setbackMin)
      const w = bw + (Math.random() - 0.5) * 2
      const d = bd + (Math.random() - 0.5) * 2
      const h = minHeight + Math.random() * (maxHeight - minHeight)
      list.push({
        x: pos.x + (Math.random() - 0.5) * setBack * 2,
        z: pos.z + (Math.random() - 0.5) * setBack * 2,
        w, d, h, idx: idx++,
      })
    }
    for (let i = 0; i < 4; i++) {
      list.push({
        x: (Math.random() - 0.5) * 24,
        z: (Math.random() - 0.5) * 24,
        w: bw + 4 + Math.random() * 6,
        d: bd + 4 + Math.random() * 6,
        h: maxHeight + Math.random() * 15,
        idx: idx++,
      })
    }
    return list
  }, [eraId, buildingDef])

  const lights = useMemo(() => {
    const positions: Array<[number, number]> = []
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const r = 22
      positions.push([Math.cos(angle) * r, Math.sin(angle) * r])
    }
    return positions
  }, [])

  return (
    <group ref={blockRef}>
      <Ground palette={palette} />
      {buildings.map((b) => (
        <Building key={`b-${b.idx}`} position={[b.x, b.h / 2, b.z]} args={[b.w, b.h, b.d]} palette={palette} index={b.idx} />
      ))}
      <StreetLights positions={lights} palette={palette} />
      <Vehicles palette={palette} />
      <Pedestrians palette={palette} count={eraIndex >= 3 ? 40 : eraIndex >= 1 ? 20 : 8} />
      <Skylight palette={palette} />
    </group>
  )
}