import React, { useRef, useMemo, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { 
  OrbitControls, 
  Environment, 
  ContactShadows,
  Sky,
} from '@react-three/drei'
import * as THREE from 'three'

// Era configurations
const ERAS = [
  {
    year: 1945,
    name: 'Post-War',
    buildingStyle: 'art-deco',
    vehicleStyle: 'vintage',
    pedestrianStyle: '1940s',
    skyTint: '#8DA399',
    fogColor: '#a0a0c0',
  },
  {
    year: 1965,
    name: 'Modern',
    buildingStyle: 'modern',
    vehicleStyle: 'muscle',
    pedestrianStyle: '1960s',
    skyTint: '#a0b0c0',
    fogColor: '#c0c0d0',
  },
  {
    year: 1985,
    name: 'Brutalist',
    buildingStyle: 'brutalist',
    vehicleStyle: 'sedan',
    pedestrianStyle: '1980s',
    skyTint: '#7a8a9a',
    fogColor: '#9090a0',
  },
  {
    year: 2005,
    name: 'Glass',
    buildingStyle: 'glass',
    vehicleStyle: 'sedan',
    pedestrianStyle: '2000s',
    skyTint: '#a0c0e0',
    fogColor: '#d0d0e0',
  },
  {
    year: 2025,
    name: 'Contemporary',
    buildingStyle: 'contemporary',
    vehicleStyle: 'ev',
    pedestrianStyle: '2020s',
    skyTint: '#90b0d0',
    fogColor: '#c0d0e0',
  },
  {
    year: 2055,
    name: 'Futuristic',
    buildingStyle: 'futuristic',
    vehicleStyle: 'autonomous',
    pedestrianStyle: 'future',
    skyTint: '#6080a0',
    fogColor: '#8090b0',
  },
]

interface CitySceneProps {
  eraIndex: number
}

// Building component with different styles per era
function Building({ position, style, era }: { position: [number, number, number], style: string, era: number }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  
  const buildingGeometry = useMemo(() => {
    switch (style) {
      case 'art-deco':
        // Art Deco: Stepped towers, geometric patterns
        return new THREE.BoxGeometry(4, 12 + Math.random() * 8, 4)
      case 'modern':
        // Modern: Clean lines, simple forms
        return new THREE.BoxGeometry(5, 10 + Math.random() * 6, 5)
      case 'brutalist':
        // Brutalist: Massive concrete blocks, raw texture
        return new THREE.BoxGeometry(6, 15 + Math.random() * 10, 6)
      case 'glass':
        // Glass: Sleek, reflective
        return new THREE.BoxGeometry(6, 12 + Math.random() * 8, 6)
      case 'contemporary':
        // Contemporary: Mixed materials, interesting shapes
        return new THREE.BoxGeometry(5, 14 + Math.random() * 6, 5)
      case 'futuristic':
        // Futuristic: Curved, organic forms
        return new THREE.CylinderGeometry(3, 3, 18 + Math.random() * 6, 8)
      default:
        return new THREE.BoxGeometry(4, 10, 4)
    }
  }, [style])

  const buildingMaterial = useMemo(() => {
    switch (style) {
      case 'art-deco':
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color('#8B7355'),
          roughness: 0.7,
          metalness: 0.3,
        })
      case 'modern':
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color('#A0A0A0'),
          roughness: 0.6,
          metalness: 0.4,
        })
      case 'brutalist':
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color('#555555'),
          roughness: 0.9,
          metalness: 0.1,
        })
      case 'glass':
        return new THREE.MeshPhysicalMaterial({
          color: new THREE.Color('#88CCFF'),
          roughness: 0,
          metalness: 0,
          transmission: 0.8,
          thickness: 0.5,
          ior: 1.5,
        })
      case 'contemporary':
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color('#6688AA'),
          roughness: 0.5,
          metalness: 0.5,
        })
      case 'futuristic':
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color('#446688'),
          roughness: 0.2,
          metalness: 0.8,
          emissive: new THREE.Color('#113355'),
          emissiveIntensity: 0.3,
        })
      default:
        return new THREE.MeshStandardMaterial({ color: 'white' })
    }
  }, [style])

  return (
    <mesh ref={meshRef} geometry={buildingGeometry} material={buildingMaterial} position={position}>
      {/* Add details based on era */}
      {style === 'art-deco' && (
        <group position={[0, -8, 0]}>
          {Array.from({ length: 5 }).map((_, i) => (
            <mesh key={i} position={[0, i * 1.5, 0]}>
              <boxGeometry args={[3.5, 0.3, 3.5]} />
              <meshStandardMaterial color="#735C39" />
            </mesh>
          ))}
        </group>
      )}
    </mesh>
  )
}

// Vehicle component
function Vehicle({ position, style, era }: { position: [number, number, number], style: string, era: number }) {
  const meshRef = useRef<THREE.Group>(null!)
  
  const vehicleMaterial = useMemo(() => {
    switch (style) {
      case 'vintage':
        return new THREE.MeshStandardMaterial({ color: new THREE.Color('#224466'), roughness: 0.6 })
      case 'muscle':
        return new THREE.MeshStandardMaterial({ color: new THREE.Color('#CC3333'), roughness: 0.4 })
      case 'sedan':
        return new THREE.MeshStandardMaterial({ color: new THREE.Color('#336699'), roughness: 0.5 })
      case 'ev':
        return new THREE.MeshStandardMaterial({ 
          color: new THREE.Color('#CCFF00'), 
          roughness: 0.2,
          emissive: new THREE.Color('#336600'),
          emissiveIntensity: 0.2,
        })
      case 'autonomous':
        return new THREE.MeshStandardMaterial({ 
          color: new THREE.Color('#4488FF'), 
          roughness: 0.1,
          metalness: 0.8,
        })
      default:
        return new THREE.MeshStandardMaterial({ color: 'white' })
    }
  }, [style])

  const shape = useMemo(() => {
    switch (style) {
      case 'vintage':
        return <group>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[2, 0.6, 0.8]} />
            <primitive object={vehicleMaterial} />
          </mesh>
          <mesh position={[0, 0.7, -0.2]}>
            <boxGeometry args={[1.6, 0.4, 0.4]} />
            <primitive object={vehicleMaterial} />
          </mesh>
        </group>
      case 'muscle':
        return <group>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[2.2, 0.6, 1]} />
            <primitive object={vehicleMaterial} />
          </mesh>
          <mesh position={[0.3, 0.8, -0.1]} rotation={[0, 0, -0.2]}>
            <boxGeometry args={[0.6, 0.3, 0.3]} />
            <meshStandardMaterial color="black" />
          </mesh>
        </group>
      case 'sedan':
        return <group>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[1.8, 0.5, 0.9]} />
            <primitive object={vehicleMaterial} />
          </mesh>
          <mesh position={[0, 0.6, -0.1]}>
            <boxGeometry args={[1.4, 0.3, 0.3]} />
            <primitive object={vehicleMaterial} />
          </mesh>
        </group>
      case 'ev':
        return <group>
          <mesh position={[0, 0.25, 0]}>
            <boxGeometry args={[2, 0.5, 1]} />
            <primitive object={vehicleMaterial} />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[1.6, 0.1, 0.8]} />
            <meshStandardMaterial color="#223311" roughness={0.1} metalness={0.9} />
          </mesh>
        </group>
      case 'autonomous':
        return <group>
          <mesh position={[0, 0.3, 0]}>
            <capsuleGeometry args={[0.5, 1.5, 4, 8]} />
            <primitive object={vehicleMaterial} />
          </mesh>
          <mesh position={[0, 0.6, 0]}>
            <sphereGeometry args={[0.2, 8, 8]} />
            <meshStandardMaterial color="#223344" emissive="#4488FF" emissiveIntensity={0.5} />
          </mesh>
        </group>
      default:
        return <mesh><boxGeometry args={[2, 0.5, 1]} /></mesh>
    }
  }, [style, vehicleMaterial])

  return (
    <group ref={meshRef} position={position}>
      {shape}
    </group>
  )
}

// Pedestrian component
function Pedestrian({ position, style, era }: { position: [number, number, number], style: string, era: number }) {
  const groupRef = useRef<THREE.Group>(null!)
  
  const clothingColor = useMemo(() => {
    switch (style) {
      case '1940s': return '#2A3B5C'
      case '1960s': return '#4C6B2E'
      case '1980s': return '#8B5A2B'
      case '2000s': return '#336699'
      case '2020s': return '#663399'
      case 'future': return '#00CCFF'
      default: return 'white'
    }
  }, [style])

  return (
    <group ref={groupRef} position={position}>
      {/* Body */}
      <mesh position={[0, 1.0, 0]}>
        <cylinderGeometry args={[0.2, 0.3, 1, 8]} />
        <meshStandardMaterial color={clothingColor} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.55, 0]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color="#FFD8B1" />
      </mesh>
    </group>
  )
}

// Storefront component
function Storefront({ position, era }: { position: [number, number, number], era: number }) {
  const signMaterial = useMemo(() => {
    const colors = ['#FF3366', '#33CCFF', '#FFCC33', '#33FF66', '#CC33FF', '#33FFCC']
    return colors[era % colors.length]
  }, [era])

  return (
    <group position={position}>
      {/* Building base */}
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[3, 4, 0.5]} />
        <meshStandardMaterial color="#334455" />
      </mesh>
      {/* Sign */}
      <mesh position={[0, 3.5, 0.3]}>
        <planeGeometry args={[2.5, 0.8]} />
        <meshBasicMaterial color={signMaterial} transparent opacity={0.8} />
      </mesh>
    </group>
  )
}

// Scene with fog and lighting
function SceneEnvironment({ eraIndex }: { eraIndex: number }) {
  const { scene } = useThree()
  
  useEffect(() => {
    const era = ERAS[eraIndex]
    scene.fog = new THREE.FogExp2(new THREE.Color(era.fogColor), 0.02)
  }, [scene, eraIndex])

  return (
    <>
      <Sky 
        distance={4200}
        sunPosition={[0, 1, 0]}
        inclination={0.5}
        azimuth={0.25}
        turbidity={10}
        rayleigh={2}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />
      <Environment preset="city" />
      
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight 
        position={[10, 10, 5]} 
        intensity={1.2} 
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight 
        position={[-10, 10, -5]} 
        intensity={0.4} 
        color="#88AAFF"
      />
    </>
  )
}

// Ground plane
function Ground() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#223322" roughness={0.9} />
      </mesh>
      <ContactShadows 
        position={[0, 0.01, 0]}
        opacity={0.4}
        scale={50}
        blur={2}
        far={10}
        resolution={1024}
      />
    </>
  )
}

// Post-processing effects using built-in Three.js capabilities
function PostFX() {
  // Simplified post-processing without external library
  // In production, could use @react-three/postprocessing with compatible versions
  return null
}

// Main scene content
function SceneContent({ eraIndex }: { eraIndex: number }) {
  const era = ERAS[eraIndex]
  
  // Generate buildings with useMemo for performance
  const buildings = useMemo(() => {
    const items = []
    for (let i = 0; i < 20; i++) {
      const x = (i % 5) * 8 - 16
      const z = Math.floor(i / 5) * 12 - 24
      items.push(
        <Building 
          key={`building-${i}`}
          position={[x, 0, z]} 
          style={era.buildingStyle} 
          era={eraIndex}
        />
      )
    }
    return items
  }, [era, eraIndex])

  // Generate vehicles
  const vehicles = useMemo(() => {
    const items = []
    for (let i = 0; i < 12; i++) {
      const x = (i % 4) * 10 - 15
      const z = (Math.floor(i / 4) * 20) - 30
      items.push(
        <Vehicle 
          key={`vehicle-${i}`}
          position={[x, 0, z]} 
          style={era.vehicleStyle} 
          era={eraIndex}
        />
      )
    }
    return items
  }, [era, eraIndex])

  // Generate pedestrians
  const pedestrians = useMemo(() => {
    const items = []
    for (let i = 0; i < 15; i++) {
      const x = (Math.random() - 0.5) * 40
      const z = (Math.random() - 0.5) * 40
      items.push(
        <Pedestrian 
          key={`pedestrian-${i}`}
          position={[x, 0, z]} 
          style={era.pedestrianStyle} 
          era={eraIndex}
        />
      )
    }
    return items
  }, [era, eraIndex])

  // Generate storefronts
  const storefronts = useMemo(() => {
    const items = []
    for (let i = 0; i < 6; i++) {
      const x = (i % 3) * 15 - 15
      const z = Math.floor(i / 3) * 15 - 10
      items.push(
        <Storefront 
          key={`storefront-${i}`}
          position={[x, 0, z]} 
          era={eraIndex}
        />
      )
    }
    return items
  }, [eraIndex])

  return (
    <>
      <SceneEnvironment eraIndex={eraIndex} />
      <Ground />
      {buildings}
      {vehicles}
      {pedestrians}
      {storefronts}
      <PostFX />
    </>
  )
}

// Main component
export default function CityScene({ eraIndex }: CitySceneProps) {
  return (
    <>
      <Canvas
        shadows
        frameloop="demand"
        camera={{ position: [0, 5, 20], fov: 60 }}
        gl={{ 
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        dpr={[1, Math.min(2, window.devicePixelRatio)]}
      >
        <SceneContent eraIndex={eraIndex} />
        <OrbitControls 
          enablePan={false}
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={Math.PI / 6}
          minDistance={10}
          maxDistance={35}
          enableDamping
          dampingFactor={0.05}
        />
      </Canvas>
    </>
  )
}