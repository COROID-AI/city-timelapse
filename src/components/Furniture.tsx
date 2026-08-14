import React, { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { useEraStore } from '../store/eraStore'
import { VISUAL_ERA_DATA } from '../eras'

// Stool component - simple wooden stool
const Stool = ({ color }: { color: string }) => (
  <mesh castShadow receiveShadow>
    <cylinderGeometry args={[0.3, 0.3, 0.45]} />
    <meshStandardMaterial color={hexToColor(color)} roughness={0.7} metalness={0.1} />
    <position y={0.225} />
  </mesh>
)

// Simple wooden table - box geometry
const SimpleTable = ({ color }: { color: string }) => (
  <mesh castShadow receiveShadow>
    <boxGeometry args={[1.2, 0.75, 1.2]} />
    <meshStandardMaterial color={hexToColor(color)} roughness={0.6} metalness={0.1} />
    <position y={0.375} />
  </mesh>
)

// Metal-frame chair
const MetalChair = ({ color }: { color: string }) => (
  <mesh castShadow receiveShadow>
    <boxGeometry args={[0.4, 0.4, 0.45]} />
    <meshStandardMaterial color={hexToColor(color)} roughness={0.5} metalness={0.2} />
    <position y={0.225} />

    {/* Four legs */}
    {['front-left', 'front-right', 'back-left', 'back-right'].map((leg, i) => {
      const xOffset = i % 2 === 0 ? -0.18 : 0.18
      const zOffset = Math.floor(i / 2) === 0 ? -0.2 : 0.2
      return (
        <mesh key={`leg-${i}`}>
          <cylinderGeometry args={[0.08, 0.08, 0.45]} />
          <meshStandardMaterial color={hexToColor(color)} roughness={0.4} metalness={0.4} />
          <position x={xOffset} y={0.225} z={zOffset} />
        </mesh>
      )
    })}
  </mesh>
)

// Mid-century modern chair - molded plastic
const MidCenturyChair = ({ color }: { color: string }) => (
  <mesh castShadow receiveShadow>
    <boxGeometry args={[0.45, 0.5, 0.4]} />
    <meshStandardMaterial color={hexToColor(color)} roughness={0.5} metalness={0.1} />
    <position y={0.25} />

    {/* Four tapered metal legs */}
    {['front-left', 'front-right', 'back-left', 'back-right'].map((leg, i) => {
      const xOffset = i % 2 === 0 ? -0.2 : 0.2
      const zOffset = Math.floor(i / 2) === 0 ? -0.2 : 0.2
      return (
        <mesh key={`mc-leg-${i}`}>
          <cylinderGeometry args={[0.05, 0.1, 0.45]} />
          <meshStandardMaterial color={hexToColor(color)} roughness={0.3} metalness={0.5} />
          <position x={xOffset} y={0.225} z={zOffset} />
        </mesh>
      )
    })}
  </mesh>
)

// Booth seat - bench style
const BoothBench = ({ color }: { color: string }) => (
  <mesh castShadow receiveShadow>
    <boxGeometry args={[2.0, 0.4, 0.45]} />
    <meshStandardMaterial color={hexToColor(color)} roughness={0.6} metalness={0.1} />
    <position y={0.225} />
  </mesh>
)

// Table with neon edge lighting
const NeonTable = ({ color }: { color: string }) => (
  <mesh castShadow receiveShadow>
    <boxGeometry args={[1.4, 0.7, 1.4]} />
    <meshStandardMaterial color={hexToColor(color)} roughness={0.5} emissive={0x111111} emissiveIntensity={0.2} />
    <position y={0.35} />

    {/* Neon edge strip around perimeter - four sides */}
    <mesh>
      <boxGeometry args={[1.4, 0.04, 1.4]} />
      <meshStandardMaterial color={0xff00ff} roughness={0.1} />
      <position x={0} z={0.7} y={0.37} />
    </mesh>
    <mesh>
      <boxGeometry args={[1.4, 0.04, 1.4]} />
      <meshStandardMaterial color={0xff00ff} roughness={0.1} />
      <position x={0} z={-0.7} y={0.37} />
    </mesh>
    <mesh>
      <boxGeometry args={[0.14, 0.04, 1.4]} />
      <meshStandardMaterial color={0xff00ff} roughness={0.1} />
      <position x={-0.7} z={0} y={0.37} />
    </mesh>
    <mesh>
      <boxGeometry args={[0.14, 0.04, 1.4]} />
      <meshStandardMaterial color={0xff00ff} roughness={0.1} />
      <position x={0.7} z={0} y={0.37} />
    </mesh>
  </mesh>
)

// Faux-wood paneling detail
const FauxWoodPaneling = ({ color }: { color: string }) => (
  <mesh castShadow receiveShadow>
    <boxGeometry args={[2.5, 2.5, 0.1]} />
    <meshStandardMaterial color={hexToColor(color)} roughness={0.9} />
    <position x={0} y={1.25} z={0} />
  </mesh>
)

// Disco ball accent
const DiscoBall = ({ color }: { color: string }) => (
  <mesh castShadow receiveShadow>
    <sphereGeometry args={[0.3]} />
    <meshStandardMaterial color={hexToColor(color)} roughness={0.1} shininess={100} />
    <position y={0.45} />
  </mesh>
)

// Formica-topped table
const FormicaTable = ({ color }: { color: string }) => (
  <mesh castShadow receiveShadow>
    <boxGeometry args={[1.2, 0.75, 1.2]} />
    <meshStandardMaterial color={hexToColor(color)} roughness={0.5} />
    <position y={0.375} />

    {/* Formica pattern lines */}
    {['line1', 'line2', 'line3'].map((line, i) => (
      <mesh key={`formica-${line}`}>
        <boxGeometry args={[1.2, 0.02, 1.2]} />
        <meshStandardMaterial color={0xeeeeee} roughness={0.3} />
        <position y={0.375 + 0.04 * (i + 1)} />
      </mesh>
    ))}
  </mesh>
)

// Red vinyl bucket seat
const RedVinylSeat = ({ color }: { color: string }) => (
  <mesh castShadow receiveShadow>
    <boxGeometry args={[0.45, 0.5, 0.4]} />
    <meshStandardMaterial color={hexToColor(color)} roughness={0.7} />
    <position y={0.25} />

    {/* Four legs */}
    {['front-left', 'front-right', 'back-left', 'back-right'].map((leg, i) => {
      const xOffset = i % 2 === 0 ? -0.2 : 0.2
      const zOffset = Math.floor(i / 2) === 0 ? -0.2 : 0.2
      return (
        <mesh key={`rv-leg-${i}`}>
          <cylinderGeometry args={[0.08, 0.08, 0.45]} />
          <meshStandardMaterial color={hexToColor(color)} roughness={0.3} metalness={0.4} />
          <position x={xOffset} y={0.225} z={zOffset} />
        </mesh>
      )
    })}
  </mesh>
)

// Clean wooden table - modern minimalist
const ModernTable = ({ color }: { color: string }) => (
  <mesh castShadow receiveShadow>
    <boxGeometry args={[1.0, 0.6, 1.0]} />
    <meshStandardMaterial color={hexToColor(color)} roughness={0.4} metalness={0.2} />
    <position y={0.3} />
  </mesh>
)

// Upholstered armchair - neutral tone
const NeutralArmchair = ({ color }: { color: string }) => (
  <mesh castShadow receiveShadow>
    {/* Seat back */}
    <boxGeometry args={[0.5, 0.6, 0.5]} />
    <meshStandardMaterial color={hexToColor(color)} roughness={0.5} />
    <position y={0.3} />

    {/* Seat cushion */}
    <boxGeometry args={[0.45, 0.35, 0.4]} />
    <meshStandardMaterial color={hexToColor(color)} roughness={0.6} />
    <position y={0.175} />

    {/* Armrests - four positions */}
    {['fl', 'fr', 'bl', 'br'].map((arm, i) => {
      const armPositions = {
        fl: { x: 0.2, z: 0.2 },
        fr: { x: 0.2, z: -0.2 },
        bl: { x: -0.2, z: 0.2 },
        br: { x: -0.2, z: -0.2 },
      }
      const pos = armPositions[arm]
      return (
        <mesh key={`arm-${i}`}>
          <boxGeometry args={[0.15, 0.2, 0.4]} />
          <meshStandardMaterial color={hexToColor(color)} roughness={0.5} />
          <position x={pos.x} y={0.25} z={pos.z} />
        </mesh>
      )
    })}
  </mesh>
)

// Hanging pendant light
const PendantLight = ({ color }: { color: string }) => (
  <mesh castShadow receiveShadow>
    <sphereGeometry args={[0.15]} />
    <meshStandardMaterial color={hexToColor(color)} emissive={0xffffff} emissiveIntensity={2} />
    <position y={0.8} />

    {/* Cord */}
    <cylinderGeometry args={[0.02, 0.02, 0.6]} />
    <meshStandardMaterial color={0x333333} roughness={0.8} />
    <position x={0} y={0.5} z={0} />
  </mesh>
)

// Helper: convert hex color string to Three.js color number
const hexToColor = (hex: string): number => {
  const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex
  return parseInt(cleanHex, 16)
}

export const Furniture: React.FC = () => {
  const { currentEra } = useStore()

  useEffect(() => {
    console.log('Furniture component - current era:', currentEra)
  }, [currentEra])

  const eraData = VISUAL_ERA_DATA[currentEra]

  if (!eraData) return null

  // Furniture arrangement constants (in meter units, consistent with CafeShell)
  const layout = {
    counterDistanceFromWall: 5.35,
    tableSpacing: 2.5,
    mainAreaOffset: { x: 0, z: -2 },
    boothWallZ: -3.5,
    boothXPositions: [-3, -1, 1, 3],
  }

  // Generate furniture based on era
  const furnitureElements: JSX.Element[] = []

  switch (currentEra) {
    case '1945': {
      // Simple wooden stools at counter
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2
        const radius = 1.5
        furnitureElements.push(
          <Stool
            key={i}
            color='#8B5A2B'
            position={{ x: radius * Math.cos(angle), y: 0.225, z: radius * Math.sin(angle) + 5 }}
          />
        )
      }

      // Basic wooden tables
      for (let i = 0; i < 4; i++) {
        const x = (i % 2) * 2
        const z = Math.floor(i / 2) * 2 + 3
        furnitureElements.push(
          <SimpleTable
            key={i}
            color='#DEB887'
            position={{ x, y: 0.375, z }}
          />
        )
      }

      // Metal-frame chairs around tables
      for (let i = 0; i < 8; i++) {
        const x = (i % 2 === 0 ? -1.2 : 1.2)
        const z = Math.floor(i / 2) * 2 + 3
        furnitureElements.push(
          <MetalChair
            key={i}
            color='#C0C0C0'
            position={{ x, y: 0.225, z }}
          />
        )
      }
      break
    }

    case '1965': {
      // Mid-century modern: molded plastic chairs in bright colors
      for (let i = 0; i < 6; i++) {
        const x = (i % 2 === 0 ? -1 : 1) * 1.5
        const z = Math.floor(i / 2) * 2 + 4
        const color = i % 2 === 0 ? '#FF6600' : '#0088FF' // orange or teal
        furnitureElements.push(
          <MidCenturyChair
            key={i}
            color={color}
            position={{ x, y: 0.25, z }}
          />
        )
      }

      // Teak wood tables
      for (let i = 0; i < 4; i++) {
        const x = (i % 2 === 0 ? -1.5 : 1.5)
        const z = Math.floor(i / 2) * 2 + 4
        furnitureElements.push(
          <SimpleTable
            key={i}
            color='#D2691E' // teak wood tone
            position={{ x, y: 0.375, z }}
          />
        )
      }

      // Retro booth seating along side walls
      for (const wallX of layout.boothXPositions) {
        for (let i = 0; i < 2; i++) {
          const z = layout.boothWallZ
          furnitureElements.push(
            <BoothBench
              key={i}
              color='#FF66AA' // vinyl upholstery pink/red
              position={{ x: wallX, y: 0.225, z }}
            />
          )
        }
      }

      // Chrome accents - decorative spheres
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 2
        furnitureElements.push(
          <mesh key={`chrome-${i}`}>
            <sphereGeometry args={[0.15]} />
            <meshStandardMaterial color={0xFFFFFF} roughness={0.1} metalness={0.9} />
            <position x={x} y={0.3} z={4} />
          </mesh>
        )
      }
      break
    }

    case '1985': {
      // Boomer-era: laminate tables with neon edge lighting
      for (let i = 0; i < 4; i++) {
        const x = (i % 2 === 0 ? -1.5 : 1.5)
        const z = Math.floor(i / 2) * 2 + 5
        furnitureElements.push(
          <NeonTable
            key={i}
            color='#8B0000' // burgundy base with neon edges
            position={{ x, y: 0.35, z }}
          />
        )
      }

      // Padded vinyl chairs in burgundy/navy
      for (let i = 0; i < 8; i++) {
        const x = (i % 2 === 0 ? -1 : 1) * 1.2
        const z = Math.floor(i / 2) * 2 + 5
        const color = i % 2 === 0 ? '#8B0000' : '#000080' // burgundy or navy
        furnitureElements.push(
          <RedVinylSeat
            key={i}
            color={color}
            position={{ x, y: 0.25, z }}
          />
        )
      }

      // Faux-wood paneling details
      for (let i = 0; i < 2; i++) {
        const x = (i - 0.5) * 3
        furnitureElements.push(
          <FauxWoodPaneling color='#A0522D' />
        )
      }

      // Disco ball accent
      furnitureElements.push(
        <DiscoBall color='#FFFFFF' />
      )
      break
    }

    case '2005': {
      // Casual diner revival: Formica-topped tables, red vinyl bucket seats
      for (let i = 0; i < 4; i++) {
        const x = (i % 2 === 0 ? -1 : 1) * 1.5
        const z = Math.floor(i / 2) * 2 + 4
        furnitureElements.push(
          <FormicaTable
            key={i}
            color='#FF0000'
            position={{ x, y: 0.375, z }}
          />
        )
      }

      // Red vinyl bucket seats
      for (let i = 0; i < 8; i++) {
        const x = (i % 2 === 0 ? -1 : 1) * 1.2
        const z = Math.floor(i / 2) * 2 + 4
        furnitureElements.push(
          <RedVinylSeat
            key={i}
            color='#FF0000'
            position={{ x, y: 0.25, z }}
          />
        )
      }

      // Chrome trim accents
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2
        const radius = 3.5
        furnitureElements.push(
          <mesh key={`diner-chrome-${i}`}>
            <cylinderGeometry args={[0.02, 0.02, 0.8]} />
            <meshStandardMaterial color={0xFFFFFF} roughness={0.1} metalness={0.9} />
            <position x={radius * Math.cos(angle)} y={0.4} z={radius * Math.sin(angle) + 4} />
          </mesh>
        )
      }

      // Jukebox-style element (cube with button pattern)
      furnitureElements.push(
        <mesh key='jukebox'>
          <boxGeometry args={[0.6, 0.6, 0.6]} />
          <meshStandardMaterial color={0x000000} roughness={0.3} />
          <position x={0} y={0.3} z={4.5} />

          {/* Button grid - 2 rows x 3 columns */}
          {[0, 1].map((r) => {
            return [0, 1, 2].map((c) => {
              return (
                <mesh key={`jukebox-btn-${r}-${c}`}>
                  <sphereGeometry args={[0.08]} />
                  <meshStandardMaterial color={0xFFFFFF} />
                  <position x={c * 0.2 - 0.2} y={0.45} z={r * 0.2 + 0.1} />
                </mesh>
              )
            })
          })}
        </mesh>
      )
      break
    }

    case '2025': {
      // Modern minimalist: clean-lined wooden tables, upholstered armchairs
      for (let i = 0; i < 4; i++) {
        const x = (i % 2 === 0 ? -1 : 1) * 1.5
        const z = Math.floor(i / 2) * 2 + 5
        furnitureElements.push(
          <ModernTable
            key={i}
            color='#C0C0C0'
            position={{ x, y: 0.3, z }}
          />
        )
      }

      // Upholstered armchairs in neutral tones
      for (let i = 0; i < 4; i++) {
        const x = (i % 2 === 0 ? -1.5 : 1.5)
        const z = 7
        const neutralColor = i % 2 === 0 ? '#8B8982' : '#D3D3D3'
        furnitureElements.push(
          <NeutralArmchair
            key={i}
            color={neutralColor}
            position={{ x, y: 0.3, z }}
          />
        )
      }

      // Hanging pendant lights as table accents
      for (let i = 0; i < 4; i++) {
        const x = (i % 2 === 0 ? -1 : 1) * 1.5
        const z = 8.5
        furnitureElements.push(
          <PendantLight
            key={i}
            color='#FFFFFF'
            position={{ x, y: 0.8, z }}
          />
        )
      }
      break
    }
  }

  return <> {furnitureElements} </>
}