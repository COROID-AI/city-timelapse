import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import { useEraStore } from '../store/eraStore'
import { eraConfig } from '../utils/eraConfig'

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v))
}

function makeCanvasSign(textTop: string, textBottom: string, accent: string) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const ctx = c.getContext('2d')!

  const g = ctx.createLinearGradient(0, 0, 0, c.height)
  g.addColorStop(0, 'rgba(10,10,16,0.92)')
  g.addColorStop(1, 'rgba(0,0,0,0.88)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, c.width, c.height)

  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 6
  ctx.strokeRect(18, 18, c.width - 36, c.height - 36)

  ctx.shadowColor = accent
  ctx.shadowBlur = 18

  ctx.fillStyle = accent
  ctx.font = '800 54px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(textTop, c.width / 2, 92)

  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.font = '700 34px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto'
  ctx.fillText(textBottom, c.width / 2, 166)

  // scanline effect
  ctx.globalAlpha = 0.12
  ctx.fillStyle = '#000'
  for (let y = 0; y < c.height; y += 4) {
    ctx.fillRect(0, y, c.width, 1)
  }
  ctx.globalAlpha = 1

  return new THREE.CanvasTexture(c)
}

type BuildingProps = {
  x: number
  z: number
  size: { w: number; d: number; maxH: number }
  seed: number
  effectiveIndex: number
}

function Building({ x, z, size, seed, effectiveIndex }: BuildingProps) {
  const clamped = clamp(effectiveIndex, 0, eraConfig.eras.length - 1)
  const lo = Math.floor(clamped)
  const hi = Math.min(eraConfig.eras.length - 1, lo + 1)
  const t = clamped - lo
  const eraLo = eraConfig.eras[lo]
  const eraHi = eraConfig.eras[hi]

  const yearInt = clamp(Math.round(clamped), 0, eraConfig.eras.length - 1)

  const height = lerp(
    size.maxH * (0.55 + eraLo.buildings * 0.08),
    size.maxH * (0.55 + eraHi.buildings * 0.08),
    t,
  )

  const winDensity = lerp(0.35 + eraLo.buildings * 0.12, 0.38 + eraHi.buildings * 0.15, t)
  const windowEmiss = lerp(0.12 + eraLo.buildings * 0.05, 0.35 + eraHi.buildings * 0.07, t)

  const facadeBase = useMemo(() => new THREE.Color(eraLo.palette.base).lerp(new THREE.Color(eraHi.palette.base), t), [eraLo.palette.base, eraHi.palette.base, t])
  const facadeAccent = useMemo(() => new THREE.Color(eraLo.palette.accent).lerp(new THREE.Color(eraHi.palette.accent), t), [eraLo.palette.accent, eraHi.palette.accent, t])
  const windowCol = useMemo(() => new THREE.Color(eraLo.palette.windows).lerp(new THREE.Color(eraHi.palette.windows), t), [eraLo.palette.windows, eraHi.palette.windows, t])
  const signGlow = useMemo(() => new THREE.Color(eraLo.sign.glow).lerp(new THREE.Color(eraHi.sign.glow), t), [eraLo.sign.glow, eraHi.sign.glow, t])

  const signIntensity = lerp(0.0, 1.0, clamp((lo - 2) / 3 + t * 0.4, 0, 1))

  const facadeGeometry = useMemo(() => new THREE.BoxGeometry(size.w, height, size.d), [size.w, size.d, height])
  const accentBandGeometry = useMemo(
    () => new THREE.BoxGeometry(size.w * 0.98, height * 0.12, size.d * 0.12),
    [size.w, size.d, height],
  )

  const roofCylinderGeometry = useMemo(
    () => new THREE.CylinderGeometry(size.w * 0.34, size.w * 0.55, height * 0.12, 4),
    [size.w, height],
  )
  const roofConeGeometry = useMemo(() => new THREE.ConeGeometry(size.w * 0.48, height * 0.16, 4), [size.w, height])

  const windowUnitGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const signPlaneGeometry = useMemo(() => new THREE.PlaneGeometry(1.35, 0.66), [])

  const matFacade = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: facadeBase,
        roughness: 0.86,
        metalness: 0.08,
        envMapIntensity: 0.25,
      }),
    [facadeBase],
  )

  const matAccent = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: facadeAccent,
        roughness: 0.55,
        metalness: 0.2,
        emissive: facadeAccent.clone().multiplyScalar(0.25),
        emissiveIntensity: 0.08,
      }),
    [facadeAccent],
  )

  const winMat = useMemo(() => {
    const emiss = windowCol.clone().multiplyScalar(0.9)
    return new THREE.MeshStandardMaterial({
      color: windowCol,
      roughness: 0.22,
      metalness: 0.02,
      emissive: emiss,
      emissiveIntensity: windowEmiss,
    })
  }, [windowCol, windowEmiss])

  const roofKind = yearInt // stable shape per year
  const roofOpacity = roofKind <= lo ? 0.8 : 1

  const roofMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: facadeAccent,
        roughness: 0.55,
        metalness: 0.2,
        emissive: facadeAccent.clone().multiplyScalar(0.25),
        emissiveIntensity: 0.08,
        transparent: true,
        opacity: roofOpacity,
      }),
    [facadeAccent, roofOpacity],
  )

  const windowInstances = useMemo(() => {
    const countX = 5 + Math.round(winDensity * 10)
    const countY = 7 + Math.round(winDensity * 8)
    const x0 = -size.w / 2 + 0.15
    const z0 = size.d / 2 - 0.05
    const wStep = (size.w - 0.3) / (countX - 1)
    const hStep = height / (countY + 1)

    const matrices: THREE.Matrix4[] = []
    for (let ix = 0; ix < countX; ix++) {
      for (let iy = 0; iy < countY; iy++) {
        const bx = x0 + ix * wStep + (seed % 3) * 0.02
        const by = -height / 2 + (iy + 1) * hStep
        const bz = z0
        const mat = new THREE.Matrix4()
        mat.compose(
          new THREE.Vector3(bx, by, bz),
          new THREE.Quaternion(),
          new THREE.Vector3(0.07, 0.035, 0.02),
        )
        matrices.push(mat)
      }
    }
    return matrices
  }, [height, seed, size.d, size.w, winDensity])

  const instancedRef = useRef<THREE.InstancedMesh | null>(null)
  useEffect(() => {
    if (!instancedRef.current) return
    const inst = instancedRef.current
    for (let i = 0; i < windowInstances.length; i++) {
      inst.setMatrixAt(i, windowInstances[i])
    }
    inst.instanceMatrix.needsUpdate = true
  }, [windowInstances])

  const signTexture = useMemo(() => {
    if (typeof document === 'undefined') return null

    const year = eraConfig.eras[yearInt]?.year ?? eraConfig.eras[0].year
    const accent = eraConfig.eras[yearInt]?.palette.accent ?? eraConfig.eras[0].palette.accent

    const top = year <= 1965 ? 'MARKET' : year <= 1985 ? 'EATERY' : year <= 2005 ? 'CITY' : year <= 2025 ? 'NOVA' : 'FUTURE'
    const bottom = year <= 1965 ? '1945-65' : year <= 1985 ? 'SOUND & STYLE' : year <= 2005 ? 'NOW OPEN' : year <= 2025 ? 'SIGNAGE' : '2055 EDITION'

    return makeCanvasSign(top, bottom, accent)
  }, [yearInt])

  const signMaterial = useMemo(() => {
    if (!signTexture) return null
    return new THREE.MeshStandardMaterial({
      map: signTexture,
      roughness: 0.55,
      metalness: 0.06,
      emissive: signGlow,
      emissiveIntensity: 0.35 * signIntensity,
      transparent: true,
      opacity: 0.98,
    })
  }, [signGlow, signIntensity, signTexture])

  return (
    <group ref={useRef<THREE.Group | null>(null)} position={[x, 0, z]}>
      <mesh material={matFacade} geometry={facadeGeometry} position={[0, height / 2, 0]} castShadow receiveShadow />

      <mesh
        material={matAccent}
        geometry={accentBandGeometry}
        position={[0, height * 0.62, size.d / 2 - size.d * 0.06]}
      />

      {roofKind % 2 === 0 ? (
        <mesh
          material={roofMat}
          geometry={roofCylinderGeometry}
          position={[0, height + height * 0.06, 0]}
        />
      ) : (
        <mesh
          material={roofMat}
          geometry={roofConeGeometry}
          position={[0, height + height * 0.08, 0]}
        />
      )}

      <instancedMesh
        ref={instancedRef}
        args={[windowUnitGeometry, winMat, windowInstances.length]}
        frustumCulled={false}
      />

      {signMaterial ? (
        <mesh
          position={[0, height * 0.56, size.d / 2 + 0.03]}
          material={signMaterial}
          geometry={signPlaneGeometry}
        />
      ) : null}
    </group>
  )
}

function Road({ effectiveIndex }: { effectiveIndex: number }) {
  const clamped = clamp(effectiveIndex, 0, eraConfig.eras.length - 1)
  const lo = Math.floor(clamped)
  const hi = Math.min(eraConfig.eras.length - 1, lo + 1)
  const t = clamped - lo
  const eraLo = eraConfig.eras[lo]
  const eraHi = eraConfig.eras[hi]

  const asphalt = new THREE.Color(eraLo.palette.base).lerp(new THREE.Color(eraHi.palette.base), t)
  const fog = new THREE.Color(eraLo.fog).lerp(new THREE.Color(eraHi.fog), t)

  const streetLightIntensity = lerp(0.15, 1.0, clamp((lo - 2) / 3 + t * 0.2, 0, 1))
  const streetLightColor = new THREE.Color(eraLo.streetLight).lerp(new THREE.Color(eraHi.streetLight), t)

  const groundGeometry = useMemo(() => new THREE.PlaneGeometry(55, 55, 1, 1), [])
  const laneGeometry = useMemo(() => new THREE.PlaneGeometry(50, 0.03), [])
  const lampPoleGeometry = useMemo(() => new THREE.CylinderGeometry(0.12, 0.14, 3.6, 6), [])
  const lampGlassGeometry = useMemo(() => new THREE.SphereGeometry(0.18, 12, 12), [])

  const groundMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: asphalt,
        roughness: 0.95,
        metalness: 0.02,
      }),
    [asphalt],
  )

  const laneMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(1, 1, 1),
        roughness: 0.8,
        metalness: 0.02,
        emissive: new THREE.Color(0, 0, 0),
        emissiveIntensity: 0.0,
        transparent: true,
        opacity: 0.65,
      }),
    [],
  )

  const lampPoleMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: new THREE.Color(30 / 255, 30 / 255, 35 / 255), roughness: 0.7 }),
    [],
  )

  const lampGlassMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: streetLightColor,
      emissive: streetLightColor,
      emissiveIntensity: 1.2 * streetLightIntensity,
      transparent: true,
      opacity: 0.95,
    })
  }, [streetLightColor, streetLightIntensity])

  return (
    <group>
      <mesh
        receiveShadow
        position={[0, -0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        geometry={groundGeometry}
        material={groundMaterial}
      />

      <mesh
        position={[0, 0.02, -0.5]}
        rotation={[0, 0, 0]}
        geometry={laneGeometry}
        material={laneMaterial}
      />

      {Array.from({ length: 6 }).map((_, i) => {
        const side = i % 2 === 0 ? -1 : 1
        const z = (i - 2.5) * 7
        const x = side * 10
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh castShadow geometry={lampPoleGeometry} material={lampPoleMaterial} position={[0, 1.8, 0]} />
            <mesh geometry={lampGlassGeometry} material={lampGlassMaterial} position={[0, 3.65, 0]} />
            <pointLight intensity={2.0 * streetLightIntensity} distance={10} color={fog.getStyle()} position={[0, 3.6, 0]} />
          </group>
        )
      })}
    </group>
  )
}

type VehicleProps = {
  laneX: number
  z: number
  idx: number
  effectiveIndex: number
}

function Vehicle({ laneX, z, idx, effectiveIndex }: VehicleProps) {
  const ref = useRef<THREE.Group | null>(null)
  const eraIdx = Math.round(clamp(effectiveIndex, 0, eraConfig.eras.length - 1))
  const era = eraConfig.eras[eraIdx]

  const bodyColor = era.vehicles.base
  const accent = era.vehicles.accent
  const headOn = clamp((effectiveIndex - 1) / 4, 0, 1)

  const speed = lerp(0.9, 2.2, clamp((effectiveIndex - 1) / 4, 0, 1))

  const carBodyGeometry = useMemo(() => new THREE.BoxGeometry(1.15, 0.25, 2.2), [])
  const accentGeometry = useMemo(() => new THREE.BoxGeometry(0.8, 0.16, 1.0), [])
  const headGeometry = useMemo(() => new THREE.SphereGeometry(0.09, 10, 10), [])

  const accentMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4, metalness: 0.55, emissive: accent, emissiveIntensity: 0.08 + 0.14 * headOn }),
    [accent, headOn],
  )

  const bodyMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5, metalness: 0.35 }),
    [bodyColor],
  )

  const headMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('white'),
        emissive: new THREE.Color('white'),
        emissiveIntensity: 1.0 * headOn,
      }),
    [headOn],
  )

  useFrame((_, delta) => {
    if (!ref.current) return
    const m = ref.current
    m.position.z += delta * speed * (0.55 + idx * 0.07)
    if (m.position.z > 30) m.position.z = -30
  })

  return (
    <group ref={ref} position={[laneX, 0.06, z]}>
      <mesh castShadow geometry={carBodyGeometry} material={bodyMaterial} />
      <mesh geometry={accentGeometry} material={accentMaterial} position={[0, 0.19, 0.7]} />

      <mesh geometry={headGeometry} material={headMat} position={[0.55, 0.08, 1.1]} />
      <mesh geometry={headGeometry} material={headMat} position={[-0.55, 0.08, 1.1]} />

      <pointLight intensity={0.7 * headOn} distance={9} color={accent} position={[0, 0.2, 1.0]} />
    </group>
  )
}

type PedestrianProps = {
  x: number
  z: number
  idx: number
  effectiveIndex: number
}

function Pedestrian({ x, z, idx, effectiveIndex }: PedestrianProps) {
  const ref = useRef<THREE.Group | null>(null)

  const eraIdx = Math.round(clamp(effectiveIndex, 0, eraConfig.eras.length - 1))
  const era = eraConfig.eras[eraIdx]

  const outfit = era.pedestrians.base
  const accent = era.pedestrians.accent

  const bobAmp = lerp(0.03, 0.06, clamp((effectiveIndex - 1) / 4, 0, 1))

  const legGeometry = useMemo(() => new THREE.CylinderGeometry(0.05, 0.06, 0.32, 8), [])
  const torsoGeometry = useMemo(() => new THREE.CapsuleGeometry(0.12, 0.28, 8, 16), [])
  const headGeometry = useMemo(() => new THREE.SphereGeometry(0.12, 16, 16), [])
  const scarfGeometry = useMemo(() => new THREE.TorusGeometry(0.11, 0.02, 10, 30), [])

  const legMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(20 / 255, 20 / 255, 25 / 255), roughness: 0.95 }), [])
  const torsoMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: outfit, roughness: 0.8, metalness: 0.05 }), [outfit])
  const headMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#f2d1b8').getStyle(), roughness: 0.95 }),
    [],
  )
  const scarfMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.1 }),
    [accent],
  )

  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.position.x = x + Math.sin((idx + effectiveIndex) * 0.7 + performance.now() * 0.001) * 0.03
    ref.current.position.z += delta * (0.35 + idx * 0.03)
    if (ref.current.position.z > 28) ref.current.position.z = -28
    ref.current.rotation.y = Math.sin(performance.now() * 0.001 + idx) * 0.08
    ref.current.position.y = 0.0 + Math.sin(performance.now() * 0.004 + idx) * bobAmp
  })

  return (
    <group ref={ref} position={[x, 0, z]}>
      <mesh geometry={legGeometry} material={legMaterial} position={[0.07, 0.16, 0]} castShadow />
      <mesh geometry={legGeometry} material={legMaterial} position={[-0.07, 0.16, 0]} castShadow />

      <mesh geometry={torsoGeometry} material={torsoMaterial} position={[0, 0.45, 0]} castShadow />
      <mesh geometry={headGeometry} material={headMaterial} position={[0, 0.65, 0]} castShadow />

      <mesh
        geometry={scarfGeometry}
        material={scarfMaterial}
        position={[0.02, 0.58, 0.08]}
        rotation={[Math.PI / 2, 0, 0]}
      />
    </group>
  )
}

export function CityScene() {
  const { effectiveIndex } = useEraStore((s) => ({
    effectiveIndex: s.fromIndex + (s.toIndex - s.fromIndex) * s.progress,
  }))

  const clamped = clamp(effectiveIndex, 0, eraConfig.eras.length - 1)
  const lo = Math.floor(clamped)
  const hi = Math.min(eraConfig.eras.length - 1, lo + 1)
  const t = clamped - lo
  const eraLo = eraConfig.eras[lo]
  const eraHi = eraConfig.eras[hi]

  const sceneFog = useMemo(() => new THREE.Color(eraLo.fog).lerp(new THREE.Color(eraHi.fog), t), [eraLo.fog, eraHi.fog, t])

  const dots = useMemo(() => {
    const seed = 42
    const count = 120
    const points: { p: THREE.Vector3; s: number }[] = []
    for (let i = 0; i < count; i++) {
      const r1 = (i * 9301 + seed) % 233280
      const r2 = (i * 49297 + seed) % 233280
      const r3 = (i * 233280 + seed) % 233280
      const u = r1 / 233280
      const v = r2 / 233280
      const w = r3 / 233280
      const theta = 2 * Math.PI * u
      const phi = Math.acos(2 * v - 1)
      const radius = lerp(22, 28, w)
      const px = radius * Math.sin(phi) * Math.cos(theta)
      const py = lerp(6, 18, v)
      const pz = radius * Math.sin(phi) * Math.sin(theta)
      points.push({ p: new THREE.Vector3(px, py, pz), s: lerp(0.015, 0.05, w) })
    }
    return points
  }, [])

  const hemiSky = useMemo(() => new THREE.Color(eraLo.sky).lerp(new THREE.Color(eraHi.sky), t), [eraLo.sky, eraHi.sky, t])

  const hemiGround = useMemo(() => new THREE.Color('#02030a'), [])

  const dirIntensity = lerp(0.9, 0.25, clamp((clamped - 1) / 4, 0, 1))
  const ambientIntensity = lerp(0.45, 0.85, clamp((clamped - 2) / 3, 0, 1))

  const laterEraGlow = clamp((lo - 2) / 2, 0, 1)

  return (
    <group>
      <color attach="background" args={[hemiSky]} />
      <fog attach="fog" args={[sceneFog, 18, 55]} />

      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[90, 36, 24]} />
        <meshBasicMaterial side={THREE.BackSide} color={hemiSky} transparent opacity={0.88} />
      </mesh>

      <hemisphereLight intensity={ambientIntensity} color={hemiSky} groundColor={hemiGround} />
      <directionalLight
        castShadow
        intensity={dirIntensity}
        position={[8, 18, 9]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />

      <ambientLight intensity={0.25} />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.45}
        zoomSpeed={0.75}
        panSpeed={0.65}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={7}
        maxDistance={42}
      />

      <Road effectiveIndex={effectiveIndex} />

      <group>
        {[
          { x: -14, z: -16, w: 6.2, d: 3.1, h: 9.2, seed: 1 },
          { x: -10, z: -6, w: 5.3, d: 2.6, h: 8.4, seed: 2 },
          { x: -15, z: 5, w: 6.6, d: 3.0, h: 10.2, seed: 3 },
          { x: 11, z: -16, w: 5.6, d: 2.7, h: 8.7, seed: 4 },
          { x: 14, z: -5, w: 6.0, d: 2.9, h: 9.6, seed: 5 },
          { x: 10, z: 7, w: 5.2, d: 2.5, h: 8.0, seed: 6 },
        ].map((b, i) => (
          <Building key={i} x={b.x} z={b.z} seed={b.seed} effectiveIndex={effectiveIndex} size={{ w: b.w, d: b.d, maxH: b.h }} />
        ))}
      </group>

      <group>
        {[
          { laneX: -2.4, z: -18, idx: 1 },
          { laneX: -0.8, z: 2, idx: 2 },
          { laneX: 0.8, z: -4, idx: 3 },
          { laneX: 2.4, z: 18, idx: 4 },
        ].map((v, i) => (
          <Vehicle key={i} laneX={v.laneX} z={v.z} idx={v.idx} effectiveIndex={effectiveIndex} />
        ))}
      </group>

      <group>
        {[
          { x: -8.2, z: -22, idx: 1 },
          { x: -9.0, z: -5, idx: 2 },
          { x: -7.7, z: 10, idx: 3 },
          { x: 7.7, z: -18, idx: 4 },
          { x: 8.4, z: 0, idx: 5 },
          { x: 7.2, z: 14, idx: 6 },
        ].map((p, i) => (
          <Pedestrian key={i} x={p.x} z={p.z} idx={p.idx} effectiveIndex={effectiveIndex} />
        ))}
      </group>

      <group>
        {dots.map((d, i) => (
          <mesh key={i} position={d.p}>
            <sphereGeometry args={[d.s, 6, 6]} />
            <meshBasicMaterial
              color={new THREE.Color('#bdf3ff')}
              transparent
              opacity={0.55 * laterEraGlow}
            />
          </mesh>
        ))}
      </group>

      <EffectComposer multisampling={4}>
        <Bloom intensity={lerp(0.5, 1.4, clamp((clamped - 2) / 3, 0, 1))} luminanceThreshold={0.2} luminanceSmoothing={0.08} />
        <Noise opacity={0.08} />
        <Vignette eskil={false} offset={0.22} darkness={0.65} />
      </EffectComposer>

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <planeGeometry args={[52, 52]} />
        <meshStandardMaterial
          color={new THREE.Color(120 / 255, 160 / 255, 255 / 255)}
          transparent
          opacity={lerp(0.08, 0.22, clamp((clamped - 1) / 4, 0, 1))}
          roughness={1}
          metalness={0.0}
        />
      </mesh>
    </group>
  )
}
