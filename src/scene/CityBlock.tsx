import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { EraConfig, EraId } from '../app/types'

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type PatternTextureArgs = {
  w: number
  h: number
  base: string
  accent: string
  glow: number
  seed: number
}

function createPatternTexture({ w, h, base, accent, glow, seed }: PatternTextureArgs) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h

  const ctx = canvas.getContext('2d')!
  const rand = mulberry32(seed)

  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)

  const cols = 18
  const rows = 28
  const margin = 10
  const cellW = (w - margin * 2) / cols
  const cellH = (h - margin * 2) / rows

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = margin + x * cellW
      const py = margin + y * cellH

      const on = rand() > 0.52
      const flicker = (rand() - 0.5) * 0.12

      const c = on
        ? `rgba(255, 220, 160, ${Math.min(1, 0.12 + glow * 0.7 + flicker)})`
        : 'rgba(0,0,0,0.12)'

      ctx.fillStyle = c
      // window glass
      ctx.fillRect(px + cellW * 0.12, py + cellH * 0.12, cellW * 0.42, cellH * 0.68)

      // window trim / sign
      if (rand() > 0.93) {
        ctx.globalAlpha = 0.35
        ctx.fillStyle = accent
        ctx.fillRect(px + cellW * 0.60, py + cellH * 0.18, cellW * 0.22, cellH * 0.26)
        ctx.globalAlpha = 1
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.needsUpdate = true
  return tex
}

function createBuildingData(seed: number) {
  const rand = mulberry32(seed)
  const buildings: Array<{ pos: [number, number, number]; size: [number, number, number]; side: 0 | 1 | 2 | 3 }> = []

  const block = 18
  const sidewalk = 1.1
  const perimeter = block / 2

  const countPerSide = 6
  for (let side = 0 as 0 | 1 | 2 | 3; side < 4; side = (side + 1) as any) {
    for (let i = 0; i < countPerSide; i++) {
      const t = i / (countPerSide - 1)
      const gap = 0.9
      const width = 1.15 + rand() * 0.9
      const height = 2.8 + rand() * 10.5
      const depth = 1.0 + rand() * 1.7

      const along = -perimeter + 2.0 + t * (block - 4.0)

      let x = 0
      let z = 0
      if (side === 0) {
        // north
        x = along
        z = perimeter - sidewalk - depth
      } else if (side === 2) {
        // south
        x = along
        z = -perimeter + sidewalk
      } else if (side === 1) {
        // east
        z = along
        x = perimeter - sidewalk - depth
      } else {
        // west
        z = along
        x = -perimeter + sidewalk
      }

      buildings.push({
        pos: [x, height / 2, z],
        size: [width + gap, height, depth],
        side,
      })
    }
  }

  // Small storefronts on the near edge (center-ish)
  const shopCount = 4
  for (let i = 0; i < shopCount; i++) {
    const width = 1.0 + rand() * 0.8
    const depth = 0.8 + rand() * 0.9
    const height = 2.8 + rand() * 1.1
    const x = -3 + i * 2.2 + rand() * 0.3
    const z = perimeter - sidewalk - depth

    buildings.push({
      pos: [x, height / 2, z],
      size: [width, height, depth],
      side: 0,
    })
  }

  return buildings
}

export function CityBlock({ config, eraId }: { config: EraConfig; eraId: EraId }) {
  const groupRef = useRef<THREE.Group>(null)

  const seed = useMemo(() => eraId * 1337 + 42, [eraId])
  const buildings = useMemo(() => createBuildingData(seed), [seed])

  const windowTex = useMemo(() => {
    return createPatternTexture({
      w: 512,
      h: 1024,
      base: config.palette.buildingBase,
      accent: config.palette.buildingAccent,
      glow: config.windowGlow,
      seed: seed + 7,
    })
  }, [config.palette.buildingAccent, config.palette.buildingBase, config.windowGlow, seed])

  const windowMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(config.palette.buildingBase).getHex(),
      map: windowTex,
      emissive: new THREE.Color(config.palette.neon),
      emissiveIntensity: 0.2 + config.windowGlow * 0.9,
      roughness: 0.55,
      metalness: 0.08,
    })
  }, [config.palette.buildingBase, config.palette.neon, config.windowGlow, windowTex])

  const neonVehicleColor = useMemo(() => new THREE.Color(config.palette.neon), [config.palette.neon])

  const roadMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(config.palette.road),
      roughness: 0.95 - config.roadWetness * 0.4,
      metalness: 0.15 + config.roadWetness * 0.35,
      emissive: new THREE.Color(config.palette.neon).multiplyScalar(config.roadWetness * 0.18),
      emissiveIntensity: 1,
    })
  }, [config.palette.road, config.roadWetness, config.palette.neon])

  const vehicleCount = useMemo(() => {
    const base = 32
    return Math.round(base * (0.55 + config.vehicleDensity))
  }, [config.vehicleDensity])

  const vehicleGeometry = useMemo(() => new THREE.BoxGeometry(0.9, 0.45, 1.9), [])

  const vehicleBodyMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(config.palette.vehicleBody),
      roughness: 0.72 - config.roadWetness * 0.22,
      metalness: 0.2 + config.roadWetness * 0.18,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0.0,
    })
  }, [config.palette.vehicleBody, config.roadWetness])

  const vehicleFrontMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(config.palette.vehicleAccent),
      emissive: new THREE.Color(config.palette.vehicleAccent),
      emissiveIntensity: 0.25 + config.windowGlow * 0.25,
      roughness: 0.35,
      metalness: 0.45,
      transparent: true,
      opacity: 0.92,
    })
  }, [config.palette.vehicleAccent, config.windowGlow])

  const vehicleInstances = useMemo(() => {
    const rand = mulberry32(seed + 123)
    const arr: Array<{ x: number; z: number; rotY: number; speed: number; phase: number }> = []

    const roadW = 6.2
    const zMin = -8.5
    const zMax = 8.5

    for (let i = 0; i < vehicleCount; i++) {
      const side = rand() > 0.5 ? -1 : 1
      const lane = side * (roadW * 0.2 + rand() * (roadW * 0.25))
      const z = zMin + rand() * (zMax - zMin)
      const rotY = side > 0 ? Math.PI / 2 : -Math.PI / 2
      const speed = (0.35 + rand() * 1.15) * (0.7 + config.vehicleSpeed)
      const phase = rand() * Math.PI * 2
      arr.push({ x: lane, z, rotY, speed, phase })
    }

    return arr
  }, [vehicleCount, seed, config.vehicleSpeed])

  const vehiclesRef = useRef<THREE.InstancedMesh>(null)
  const vehicleFrontRef = useRef<THREE.InstancedMesh>(null)

  const pedestriansCount = useMemo(() => {
    return Math.round(28 * (0.38 + config.pedestrianDensity))
  }, [config.pedestrianDensity])

  const pedestrianData = useMemo(() => {
    const rand = mulberry32(seed + 777)
    const arr: Array<{ x: number; z: number; phase: number; scale: number; hue: number }> = []
    const perimeter = 9

    for (let i = 0; i < pedestriansCount; i++) {
      const edge = rand() > 0.5 ? 'n' : 's'
      const x = -7 + rand() * 14
      const z = edge === 'n' ? perimeter - 1.2 : -perimeter + 1.2
      const phase = rand() * Math.PI * 2
      const scale = 0.55 + rand() * 0.7
      const hue = rand()
      arr.push({ x: x + (rand() - 0.5) * 0.3, z, phase, scale, hue })
    }

    return arr
  }, [pedestriansCount, seed])

  const pedestrianBox = useMemo(() => new THREE.BoxGeometry(0.5, 0.9, 0.35), [])

  const pedestrianMat = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.05,
      vertexColors: true,
      emissive: neonVehicleColor,
      emissiveIntensity: 0.06 + config.windowGlow * 0.06,
    })
    return mat
  }, [config.windowGlow, neonVehicleColor])

  const billboardMotion = config.billboardMotion

  useFrame((state) => {
    // Vehicles animation
    if (vehiclesRef.current) {
      const mesh = vehiclesRef.current
      const dummy = new THREE.Object3D()
      const roadSpan = 17
      for (let i = 0; i < vehicleInstances.length; i++) {
        const v = vehicleInstances[i]
        const loopZ = v.z + state.clock.getElapsedTime() * v.speed * config.vehicleSpeed
        const z = ((loopZ + 8.5) % roadSpan) - 8.5

        const yBob = 0.25 + Math.sin(v.phase + state.clock.getElapsedTime() * 2) * 0.03
        dummy.position.set(v.x, yBob, z)
        dummy.rotation.set(0, v.rotY, 0)
        const wScale = 0.85 + Math.sin(v.phase + state.clock.getElapsedTime() * 0.7) * 0.04
        dummy.scale.set(wScale, 1, 1)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true

      // Subtle emissive pulse to feel alive
      const bodyMat = mesh.material as THREE.MeshStandardMaterial
      bodyMat.emissiveIntensity = 0.05 + config.roadWetness * 0.08
    }

    if (vehicleFrontRef.current) {
      const mesh = vehicleFrontRef.current
      const dummy = new THREE.Object3D()
      for (let i = 0; i < vehicleInstances.length; i++) {
        const v = vehicleInstances[i]
        const loopZ = v.z + state.clock.getElapsedTime() * v.speed * config.vehicleSpeed
        const roadSpan = 17
        const z = ((loopZ + 8.5) % roadSpan) - 8.5

        dummy.position.set(v.x, 0.29 + Math.sin(v.phase + state.clock.getElapsedTime() * 2.5) * 0.02, z)
        dummy.rotation.set(0, v.rotY, 0)
        // Headlight overlay slightly thicker
        dummy.scale.set(0.95, 0.78, 0.92)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true

      const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(state.clock.getElapsedTime() * (1.1 + config.vehicleSpeed * 0.6)))
      ;(mesh.material as THREE.MeshStandardMaterial).emissive = neonVehicleColor
      ;(mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.25 + config.windowGlow * 0.45 * pulse
    }

    // Pedestrians animation
    const pedMesh = pedestrianRef.current
    if (pedMesh) {
      const dummy = new THREE.Object3D()
      for (let i = 0; i < pedestrianData.length; i++) {
        const p = pedestrianData[i]
        const walk = Math.sin(state.clock.getElapsedTime() * 1.1 + p.phase)
        const wobble = Math.cos(state.clock.getElapsedTime() * 0.9 + p.phase) * 0.08

        dummy.position.set(p.x + walk * 0.03, 0.3, p.z + wobble * 0.25)
        dummy.rotation.set(0, Math.PI / 2 + wobble * 0.2, 0)
        const s = p.scale
        dummy.scale.set(s, s * 1.05, s)
        dummy.updateMatrix()
        pedMesh.setMatrixAt(i, dummy.matrix)
      }
      pedMesh.instanceMatrix.needsUpdate = true

      ;(pedMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.04 + config.windowGlow * 0.08
    }

    // Billboard glow
    const billboard = groupRef.current?.getObjectByName('billboard-sign') as THREE.Mesh | null
    if (billboard) {
      const glow = 0.15 + billboardMotion * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(state.clock.getElapsedTime() * (1.2 + billboardMotion))))
      const m = billboard.material as THREE.MeshStandardMaterial
      m.emissive = new THREE.Color(config.palette.billboard)
      m.emissiveIntensity = glow
    }
  })

  const pedestrianRef = useRef<THREE.InstancedMesh>(null)

  return (
    <group ref={groupRef}>
      {/* Ground */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[22, 22]} />
        <primitive object={roadMat} attach="material" />
      </mesh>

      {/* Sidewalk */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[9.6, 64]} />
        <meshStandardMaterial
          color={new THREE.Color(config.palette.buildingBase).lerp(new THREE.Color('#b9bec8'), 0.35).getHex()}
          roughness={0.95}
          metalness={0.02}
        />
      </mesh>

      {/* Buildings */}
      {buildings.map((b, idx) => {
        const baseColor = new THREE.Color(config.palette.buildingBase)
        const accentColor = new THREE.Color(config.palette.buildingAccent)
        const color = baseColor.lerp(accentColor, 0.1 + (b.side / 3) * 0.12)

        const heightScale = 0.85 + (config.buildingScale - 0.9) * 0.5
        const scaledSize: [number, number, number] = [b.size[0], b.size[1] * heightScale, b.size[2]]
        const y = scaledSize[1] / 2

        return (
          <group key={idx}>
            <mesh castShadow position={[b.pos[0], y, b.pos[2]]}>
              <boxGeometry args={scaledSize} />
              <meshStandardMaterial
                color={color.getHex()}
                roughness={0.8 - config.buildingSaturation * 0.2}
                metalness={0.05 + config.roadWetness * 0.2}
              />
            </mesh>

            {/* Window face */}
            <mesh position={[b.pos[0], y, b.pos[2] + (b.size[2] / 2 - 0.02)]}>
              <boxGeometry args={[scaledSize[0] * 0.98, scaledSize[1] * 0.98, 0.06]} />
              <primitive object={windowMat} attach="material" />
            </mesh>

            {/* Neon trim */}
            <mesh position={[b.pos[0], y - scaledSize[1] * 0.15, b.pos[2] + scaledSize[2] * 0.51]}>
              <boxGeometry args={[scaledSize[0] * 0.9, 0.04, 0.03]} />
              <meshStandardMaterial
                color={config.palette.neon}
                emissive={config.palette.neon}
                emissiveIntensity={0.05 + config.windowGlow * 0.35}
                roughness={0.2}
                metalness={0.45}
                transparent
                opacity={0.9}
              />
            </mesh>
          </group>
        )
      })}

      {/* Billboard */}
      <group>
        <mesh position={[0, 2.8, 8.7]} rotation={[0, 0, 0]} castShadow name="billboard-sign">
          <boxGeometry args={[6.2, 1.35, 0.12]} />
          <meshStandardMaterial
            color={config.palette.billboardAlt}
            emissive={config.palette.billboard}
            emissiveIntensity={0.2 + config.windowGlow * 0.35}
            roughness={0.25}
            metalness={0.35}
          />
        </mesh>
        <mesh position={[0, 1.55, 8.75]} rotation={[0, 0, 0]} castShadow>
          <boxGeometry args={[7.1, 0.35, 0.06]} />
          <meshStandardMaterial
            color={config.palette.billboard}
            emissive={config.palette.billboard}
            emissiveIntensity={0.12 + config.billboardMotion}
            roughness={0.2}
            metalness={0.5}
          />
        </mesh>
      </group>

      {/* Vehicles */}
      <instancedMesh ref={vehiclesRef} args={[vehicleGeometry, vehicleBodyMat, vehicleCount]} castShadow receiveShadow>
        {/* instance matrices updated in useFrame */}
      </instancedMesh>
      <instancedMesh ref={vehicleFrontRef} args={[vehicleGeometry, vehicleFrontMat, vehicleCount]} castShadow={false} receiveShadow={false}>
        {/* instance matrices updated in useFrame */}
      </instancedMesh>

      {/* Pedestrians */}
      <instancedMesh
        ref={pedestrianRef}
        args={[pedestrianBox, pedestrianMat, pedestriansCount]}
        castShadow={false}
        receiveShadow={false}
      >
        {/* Set instance colors once */}
        <instancedBufferAttribute attach="instanceColor" args={[new Float32Array(pedestriansCount * 3), 3]} />
      </instancedMesh>
    </group>
  )
}
