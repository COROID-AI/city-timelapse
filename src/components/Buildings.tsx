import { Era } from '../App'
import { useMemo } from 'react'
import { ThreeElements } from '@react-three/fiber'

interface BuildingsProps {
  era: Era
  transitionPhase: number
}

// Building data for each era
const BUILDING_CONFIGS: Record<Era, any[]> = {
  '1945': [
    { id: 1, position: [-30, 0, -40], height: 12, width: 15, depth: 10, style: 'pre-war-1' },
    { id: 2, position: [-10, 0, -40], height: 10, width: 12, depth: 8, style: 'pre-war-2' },
    { id: 3, position: [10, 0, -40], height: 15, width: 14, depth: 12, style: 'pre-war-3' },
    { id: 4, position: [30, 0, -40], height: 11, width: 16, depth: 9, style: 'pre-war-4' },
  ],
  '1965': [
    { id: 1, position: [-30, 0, -40], height: 18, width: 20, depth: 15, style: 'modernist-1' },
    { id: 2, position: [-10, 0, -40], height: 22, width: 18, depth: 14, style: 'modernist-2' },
    { id: 3, position: [10, 0, -40], height: 25, width: 22, depth: 16, style: 'modernist-3' },
    { id: 4, position: [30, 0, -40], height: 16, width: 16, depth: 12, style: 'modernist-4' },
  ],
  '1985': [
    { id: 1, position: [-30, 0, -40], height: 20, width: 20, depth: 20, style: 'commercial-1' },
    { id: 2, position: [-10, 0, -40], height: 28, width: 25, depth: 25, style: 'commercial-2' },
    { id: 3, position: [10, 0, -40], height: 35, width: 30, depth: 30, style: 'commercial-3' },
    { id: 4, position: [30, 0, -40], height: 22, width: 22, depth: 22, style: 'commercial-4' },
  ],
  '2005': [
    { id: 1, position: [-30, 0, -40], height: 25, width: 20, depth: 20, style: 'contemporary-1' },
    { id: 2, position: [-10, 0, -40], height: 32, width: 25, depth: 25, style: 'contemporary-2' },
    { id: 3, position: [10, 0, -40], height: 40, width: 30, depth: 30, style: 'contemporary-3' },
    { id: 4, position: [30, 0, -40], height: 28, width: 22, depth: 22, style: 'contemporary-4' },
  ],
  '2025': [
    { id: 1, position: [-30, 0, -40], height: 30, width: 20, depth: 20, style: 'contemporary-1' },
    { id: 2, position: [-10, 0, -40], height: 35, width: 25, depth: 25, style: 'contemporary-2' },
    { id: 3, position: [10, 0, -40], height: 45, width: 30, depth: 30, style: 'contemporary-3' },
    { id: 4, position: [30, 0, -40], height: 32, width: 22, depth: 22, style: 'contemporary-4' },
  ],
  '2055': [
    { id: 1, position: [-30, 0, -40], height: 40, width: 25, depth: 25, style: 'futuristic-1' },
    { id: 2, position: [-10, 0, -40], height: 50, width: 30, depth: 30, style: 'futuristic-2' },
    { id: 3, position: [10, 0, -40], height: 60, width: 35, depth: 35, style: 'futuristic-3' },
    { id: 4, position: [30, 0, -40], height: 45, width: 28, depth: 28, style: 'futuristic-4' },
  ],
}

const BUILDING_STYLES: Record<string, {
  baseColor: string
  windowColor: string
  windowPattern: string
  roofStyle: string
}> = {
  'pre-war-1': { baseColor: '#8B4513', windowColor: '#FFE4B5', windowPattern: 'grid', roofStyle: 'flat' },
  'pre-war-2': { baseColor: '#A0522D', windowColor: '#F5DEB3', windowPattern: 'grid', roofStyle: 'flat' },
  'pre-war-3': { baseColor: '#CD853F', windowColor: '#FFE4B5', windowPattern: 'grid', roofStyle: 'flat' },
  'pre-war-4': { baseColor: '#8B6914', windowColor: '#F5DEB3', windowPattern: 'grid', roofStyle: 'flat' },
  'modernist-1': { baseColor: '#2F4F4F', windowColor: '#87CEEB', windowPattern: 'curtain-wall', roofStyle: 'flat' },
  'modernist-2': { baseColor: '#36454F', windowColor: '#87CEFA', windowPattern: 'curtain-wall', roofStyle: 'flat' },
  'modernist-3': { baseColor: '#2C3930', windowColor: '#B0E0E6', windowPattern: 'curtain-wall', roofStyle: 'flat' },
  'modernist-4': { baseColor: '#355E3B', windowColor: '#E0FFFF', windowPattern: 'curtain-wall', roofStyle: 'flat' },
  'commercial-1': { baseColor: '#4682B4', windowColor: '#FFFFFF', windowPattern: 'strip-mall', roofStyle: 'flat' },
  'commercial-2': { baseColor: '#4169E1', windowColor: '#F0F8FF', windowPattern: 'strip-mall', roofStyle: 'flat' },
  'commercial-3': { baseColor: '#6495ED', windowColor: '#E6E6FA', windowPattern: 'strip-mall', roofStyle: 'flat' },
  'commercial-4': { baseColor: '#1E90FF', windowColor: '#FFFFFF', windowPattern: 'strip-mall', roofStyle: 'flat' },
  'contemporary-1': { baseColor: '#2D3748', windowColor: '#E2E8F0', windowPattern: 'mixed', roofStyle: 'green' },
  'contemporary-2': { baseColor: '#4A5568', windowColor: '#CBD5E0', windowPattern: 'mixed', roofStyle: 'green' },
  'contemporary-3': { baseColor: '#718096', windowColor: '#EDF2F7', windowPattern: 'mixed', roofStyle: 'green' },
  'contemporary-4': { baseColor: '#A0AEC0', windowColor: '#F7FAFC', windowPattern: 'mixed', roofStyle: 'green' },
  'futuristic-1': { baseColor: '#00FFFF', windowColor: '#FFFFFF', windowPattern: 'smart-glass', roofStyle: 'solar' },
  'futuristic-2': { baseColor: '#00BFFF', windowColor: '#E0FFFF', windowPattern: 'smart-glass', roofStyle: 'solar' },
  'futuristic-3': { baseColor: '#00CED1', windowColor: '#AFEEEE', windowPattern: 'smart-glass', roofStyle: 'solar' },
  'futuristic-4': { baseColor: '#00FFFF', windowColor: '#FFFFFF', windowPattern: 'smart-glass', roofStyle: 'solar' },
}

export function Buildings({ era, transitionPhase }: BuildingsProps) {
  const buildings = useMemo(() => BUILDING_CONFIGS[era], [era])

  return (
    <group>
      {buildings.map((building) => (
        <Building 
          key={building.id} 
          config={building} 
          style={BUILDING_STYLES[building.style]}
          era={era}
          transitionPhase={transitionPhase}
        />
      ))}
    </group>
  )
}

function Building({ config, style, era, transitionPhase }: { 
  config: any 
  style: any 
  era: Era 
  transitionPhase: number 
}) {
  const { height, width, depth, position } = config

  return (
    <group position={position as [number, number, number]}>
      {/* Main building */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={style.baseColor} />
      </mesh>

      {/* Windows - conditionally rendered based on pattern */}
      {style.windowPattern === 'grid' && (
        <WindowGrid width={width} height={height} depth={depth} windowColor={style.windowColor} />
      )}
      {style.windowPattern === 'curtain-wall' && (
        <CurtainWallWindows width={width} height={height} depth={depth} windowColor={style.windowColor} />
      )}
      {style.windowPattern === 'strip-mall' && (
        <StripMallWindows width={width} height={height} depth={depth} windowColor={style.windowColor} />
      )}
      {style.windowPattern === 'mixed' && (
        <MixedWindows width={width} height={height} depth={depth} windowColor={style.windowColor} />
      )}
      {style.windowPattern === 'smart-glass' && (
        <SmartGlassWindows width={width} height={height} depth={depth} windowColor={style.windowColor} />
      )}

      {/* Roof details */}
      {style.roofStyle === 'flat' && (
        <RoofDetail type="flat" width={width} depth={depth} era={era} />
      )}
      {style.roofStyle === 'green' && (
        <RoofDetail type="green" width={width} depth={depth} era={era} />
      )}
      {style.roofStyle === 'solar' && (
        <RoofDetail type="solar" width={width} depth={depth} era={era} />
      )}
    </group>
  )
}

function WindowGrid({ width, height, depth, windowColor }: any) {
  const windows: JSX.Element[] = []
  
  for (let y = 1; y < height; y += 2) {
    for (let x = -width/2 + 0.5; x < width/2; x += 1.5) {
      windows.push(
        <mesh key={`${x}-${y}`} position={[x, y, depth/2 + 0.01]}>
          <planeGeometry args={[0.8, 0.8]} />
          <meshStandardMaterial color={windowColor} emissive={windowColor} emissiveIntensity={0.3} />
        </mesh>
      )
    }
  }
  
  return <group>{windows}</group>
}

function CurtainWallWindows({ width, height, depth, windowColor }: any) {
  return (
    <group>
      {Array.from({ length: 20 }).map((_, i) => (
        <group key={i}>
          <mesh position={[-width/2 + 0.1, height/2 - i * 2, depth/2 + 0.02]}>
            <boxGeometry args={[0.2, 1.5, 0.1]} />
            <meshStandardMaterial color="#C0C0C0" />
          </mesh>
          <mesh position={[-width/2 + 0.1, height/2 - i * 2, depth/2 + 0.15]}>
            <planeGeometry args={[width - 0.2, 1.4]} />
            <meshStandardMaterial color={windowColor} emissive={windowColor} emissiveIntensity={0.2} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function StripMallWindows({ width, height, depth, windowColor }: any) {
  return (
    <group>
      {Array.from({ length: Math.floor(width / 4) - 2 }).map((_, x) => (
        <group key={x} position={[-width/2 + 4 + x * 4, 2, depth/2 + 0.01]}>
          <mesh position={[0, 2, 0]}>
            <planeGeometry args={[3.5, 4]} />
            <meshStandardMaterial color="#FFFFFF" />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <planeGeometry args={[3.5, 2]} />
            <meshStandardMaterial color={windowColor} emissive={windowColor} emissiveIntensity={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function MixedWindows({ width, height, depth, windowColor }: any) {
  return (
    <group>
      {Array.from({ length: 6 }).map((_, i) => (
        <WindowsSection 
          key={i} 
          xOffset={i * width / 6 - width/2 + width/12}
          height={height} 
          depth={depth} 
          windowColor={windowColor}
          variant={i % 3}
        />
      ))}
    </group>
  )
}

function WindowsSection({ xOffset, height, depth, windowColor, variant }: any) {
  const patterns = [
    Array.from({ length: 12 }).map((_, row) => ({
      y: height/2 - row * 2,
      w: 3,
      h: 1.5
    })),
    Array.from({ length: 18 }).map((_, row) => ({
      y: height/2 - row * 1.5,
      w: 2,
      h: 1.2
    })),
    Array.from({ length: 24 }).map((_, row) => ({
      y: height/2 - row * 1.2,
      w: 1.5,
      h: 1
    })),
  ]
  
  return (
    <group position={[xOffset, 0, depth/2 + 0.01]}>
      {patterns[variant].map((win: any, i: number) => (
        <mesh key={i} position={[0, win.y, 0]}>
          <planeGeometry args={[win.w, win.h]} />
          <meshStandardMaterial color={windowColor} emissive={windowColor} emissiveIntensity={0.4} />
        </mesh>
      ))}
    </group>
  )
}

function SmartGlassWindows({ width, height, depth, windowColor }: any) {
  return (
    <group>
      {Array.from({ length: 40 }).map((_, i) => (
        <mesh 
          key={i} 
          position={[
            -width/2 + 1 + (i % 8) * (width - 2) / 7,
            height/2 - Math.floor(i / 8) * 2.5,
            depth/2 + 0.02
          ]}
        >
          <planeGeometry args={[2, 2]} />
          <meshStandardMaterial 
            color={windowColor} 
            emissive={windowColor} 
            emissiveIntensity={0.8}
            transparent
            opacity={0.7}
          />
        </mesh>
      ))}
    </group>
  )
}

function RoofDetail({ type, width, depth, era }: { type: string, width: number, depth: number, era: Era }) {
  if (type === 'flat') {
    return (
      <group position={[0, 1, 0]}>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[width, 1, depth]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
        {era === '1985' && Array.from({ length: 6 }).map((_, i) => (
          <mesh key={i} position={[
            -width/2 + 2 + i * (width - 4) / 5,
            1,
            -depth/2 + 2
          ]} rotation-x={-0.3}>
            <planeGeometry args={[2, 3]} />
            <meshStandardMaterial color="#FF4500" emissive="#FF4500" emissiveIntensity={0.5} />
          </mesh>
        ))}
      </group>
    )
  }
  
  if (type === 'green') {
    return (
      <group position={[0, 1.5, 0]}>
        <mesh>
          <boxGeometry args={[width, 0.5, depth]} />
          <meshStandardMaterial color="#228B22" />
        </mesh>
      </group>
    )
  }
  
  if (type === 'solar') {
    return (
      <group position={[0, 2, 0]}>
        {Array.from({ length: 20 }).map((_, i) => (
          <SolarPanel 
            key={i} 
            x={-width/2 + 2 + (i % 5) * (width - 4) / 4}
            z={-depth/2 + 2 + Math.floor(i / 5) * (depth - 4) / 3}
          />
        ))}
      </group>
    )
  }
  
  return null
}

function SolarPanel({ x, z }: { x: number, z: number }) {
  return (
    <mesh position={[x, 0.2, z]} rotation-x={-0.3}>
      <boxGeometry args={[4, 0.1, 2]} />
      <meshStandardMaterial color="#00CED1" emissive="#00FFFF" emissiveIntensity={0.5} />
    </mesh>
  )
}