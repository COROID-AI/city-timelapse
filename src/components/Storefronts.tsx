import { Era } from '../App'
import { useMemo } from 'react'

interface StorefrontsProps {
  era: Era
  transitionPhase: number
}

// Storefront configurations for each era
const STOREFRONT_CONFIGS: Record<Era, any[]> = {
  '1945': [
    { id: 1, position: [5, 0, -38], width: 10, height: 8, type: 'newspaper' },
    { id: 2, position: [25, 0, -38], width: 8, height: 6, type: 'diner' },
    { id: 3, position: [-20, 0, -38], width: 12, height: 7, type: 'general-store' },
  ],
  '1965': [
    { id: 1, position: [5, 0, -38], width: 12, height: 10, type: 'record-shop' },
    { id: 2, position: [25, 0, -38], width: 10, height: 8, type: 'boutique' },
    { id: 3, position: [-20, 0, -38], width: 12, height: 9, type: 'cafe' },
  ],
  '1985': [
    { id: 1, position: [5, 0, -38], width: 15, height: 12, type: 'electronics' },
    { id: 2, position: [25, 0, -38], width: 12, height: 10, type: 'fashion' },
    { id: 3, position: [-20, 0, -38], width: 18, height: 14, type: 'mall' },
  ],
  '2005': [
    { id: 1, position: [5, 0, -38], width: 15, height: 12, type: 'tech-store' },
    { id: 2, position: [25, 0, -38], width: 12, height: 10, type: 'cafe' },
    { id: 3, position: [-20, 0, -38], width: 20, height: 14, type: 'chain' },
  ],
  '2025': [
    { id: 1, position: [5, 0, -38], width: 15, height: 12, type: 'smart-shop' },
    { id: 2, position: [25, 0, -38], width: 12, height: 10, type: 'delivery' },
    { id: 3, position: [-20, 0, -38], width: 20, height: 14, type: 'app-store' },
  ],
  '2055': [
    { id: 1, position: [5, 0, -38], width: 15, height: 12, type: 'holo-shop' },
    { id: 2, position: [25, 0, -38], width: 12, height: 10, type: 'neuro-shop' },
    { id: 3, position: [-20, 0, -38], width: 20, height: 14, type: 'teleport-hub' },
  ],
}

export function Storefronts({ era, transitionPhase }: StorefrontsProps) {
  const storefronts = useMemo(() => STOREFRONT_CONFIGS[era], [era])

  return (
    <group>
      {storefronts.map((storefront) => (
        <Storefront 
          key={storefront.id} 
          config={storefront} 
          era={era}
        />
      ))}
    </group>
  )
}

function Storefront({ config, era }: { config: any, era: Era }) {
  const { position, width, height, type } = config

  return (
    <group position={position as [number, number, number]}>
      {type === 'newspaper' && <NewspaperStand width={width} height={height} season={era} />}
      {type === 'diner' && <Diner width={width} height={height} season={era} />}
      {type === 'general-store' && <GeneralStore width={width} height={height} season={era} />}
      {type === 'record-shop' && <RecordShop width={width} height={height} season={era} />}
      {type === 'boutique' && <Boutique width={width} height={height} season={era} />}
      {type === 'cafe' && <Cafe width={width} height={height} season={era} />}
      {type === 'electronics' && <ElectronicsStore width={width} height={height} season={era} />}
      {type === 'fashion' && <FashionStore width={width} height={height} season={era} />}
      {type === 'mall' && <MallEntrance width={width} height={height} season={era} />}
      {type === 'tech-store' && <TechStore width={width} height={height} season={era} />}
      {type === 'chain' && <ChainStore width={width} height={height} season={era} />}
      {type === 'smart-shop' && <SmartShop width={width} height={height} season={era} />}
      {type === 'delivery' && <DeliveryPoint width={width} height={height} season={era} />}
      {type === 'app-store' && <AppStore width={width} height={height} season={era} />}
      {type === 'holo-shop' && <HoloShop width={width} height={height} season={era} />}
      {type === 'neuro-shop' && <NeuroShop width={width} height={height} season={era} />}
      {type === 'teleport-hub' && <TeleportHub width={width} height={height} season={era} />}
    </group>
  )
}

// 1945 Storefronts
function NewspaperStand({ width, height, season }: any) {
  return (
    <group>
      <mesh position={[0, height/2, 0.5]}>
        <boxGeometry args={[width, height, 1]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <mesh position={[0, height/2 + 0.5, 0]}>
        <planeGeometry args={[6, 2]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      <mesh position={[0, height/2 + 0.8, 0]}>
        <planeGeometry args={[width - 1, 1]} />
        <meshStandardMaterial color="#FF0000" />
      </mesh>
    </group>
  )
}

function Diner({ width, height, season }: any) {
  return (
    <group>
      <mesh position={[0, height/2, 0.5]}>
        <boxGeometry args={[width, height, 1]} />
        <meshStandardMaterial color="#FFA500" />
      </mesh>
      <mesh position={[0, height/2 + 1, 0]}>
        <circleGeometry args={[1.5, 16]} />
        <meshStandardMaterial color="#FFFF00" emissive="#FFFF00" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, height/2 + 0.5, 0]}>
        <planeGeometry args={[width - 1, 2]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
    </group>
  )
}

function GeneralStore({ width, height, season }: any) {
  return (
    <group>
      <mesh position={[0, height/2, 0.5]}>
        <boxGeometry args={[width, height, 1]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <mesh position={[0, height/2 + 0.5, 0]}>
        <planeGeometry args={[width - 1, 1.5]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
    </group>
  )
}

// 1965 Storefronts
function RecordShop({ width, height, season }: any) {
  return (
    <group>
      <mesh position={[0, height/2, 0.5]}>
        <boxGeometry args={[width, height, 1]} />
        <meshStandardMaterial color="#2F4F4F" />
      </mesh>
      <mesh position={[0, height/2 + 0.8, 0]}>
        <planeGeometry args={[4, 3]} />
        <meshStandardMaterial color="#FF0000" emissive="#FF0000" emissiveIntensity={0.4} />
      </mesh>
    </group>
  )
}

function Boutique({ width, height, season }: any) {
  return (
    <group>
      <mesh position={[0, height/2, 0.5]}>
        <boxGeometry args={[width, height, 1]} />
        <meshStandardMaterial color="#9370DB" />
      </mesh>
      <mesh position={[0, height/2 + 0.5, 0]}>
        <planeGeometry args={[width - 1, 2]} />
        <meshStandardMaterial color="#FFFFFF" opacity={0.8} transparent />
      </mesh>
    </group>
  )
}

// 1985 Storefronts
function Cafe({ width, height, season }: any) {
  return (
    <group>
      <mesh position={[0, height/2, 0.5]}>
        <boxGeometry args={[width, height, 1]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <mesh position={[0, height/2 + 0.6, 0]}>
        <planeGeometry args={[6, 3]} />
        <meshStandardMaterial color="#FF0000" emissive="#FF0000" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[-2, height/2 - 0.5, 0]}>
        <planeGeometry args={[2, 1]} />
        <meshStandardMaterial color="#FFFF00" />
      </mesh>
    </group>
  )
}

function ElectronicsStore({ width, height, season }: any) {
  return (
    <group>
      <mesh position={[0, height/2, 0.5]}>
        <boxGeometry args={[width, height, 1]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
      <mesh position={[0, height/2 + 0.7, 0]}>
        <planeGeometry args={[width - 1, 2]} />
        <meshStandardMaterial color="#00FF00" emissive="#00FF00" emissiveIntensity={0.8} />
      </mesh>
    </group>
  )
}

function FashionStore({ width, height, season }: any) {
  return (
    <group>
      <mesh position={[0, height/2, 0.5]}>
        <boxGeometry args={[width, height, 1]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      <mesh position={[0, height/2 + 0.6, 0]}>
        <planeGeometry args={[4, 2]} />
        <meshStandardMaterial color="#FF69B4" />
      </mesh>
    </group>
  )
}

function MallEntrance({ width, height, season }: any) {
  return (
    <group>
      <mesh position={[0, height/2, 0.5]}>
        <boxGeometry args={[width, height, 1]} />
        <meshStandardMaterial color="#808080" />
      </mesh>
      <mesh position={[0, height/2 + 0.5, 0]}>
        <planeGeometry args={[width - 1, 2]} />
        <meshStandardMaterial color="#FFFF00" emissive="#FFFF00" emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
}

// 2005-2025 Storefronts
function TechStore({ width, height, season }: any) {
  return (
    <group>
      <mesh position={[0, height/2, 0.5]}>
        <boxGeometry args={[width, height, 1]} />
        <meshStandardMaterial color="#2D3748" />
      </mesh>
      <mesh position={[0, height/2 + 0.6, 0]}>
        <planeGeometry args={[5, 2]} />
        <meshStandardMaterial color="#4FD1C5" emissive="#4FD1C5" emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}

function ChainStore({ width, height, season }: any) {
  return (
    <group>
      <mesh position={[0, height/2, 0.5]}>
        <boxGeometry args={[width, height, 1]} />
        <meshStandardMaterial color="#0000FF" />
      </mesh>
      <mesh position={[0, height/2 + 0.5, 0]}>
        <planeGeometry args={[width - 1, 2]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
    </group>
  )
}

// 2025-2055 Storefronts
function SmartShop({ width, height, season }: any) {
  return (
    <group>
      <mesh position={[0, height/2, 0.5]}>
        <boxGeometry args={[width, height, 1]} />
        <meshStandardMaterial color="#2D3748" emissive="#4FD1C5" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0, height/2 + 0.5, 0]}>
        <planeGeometry args={[width - 1, 2]} />
        <meshStandardMaterial color="#00BFFF" emissive="#00BFFF" emissiveIntensity={0.8} />
      </mesh>
    </group>
  )
}

function DeliveryPoint({ width, height, season }: any) {
  return (
    <group>
      <mesh position={[0, height/2, 0.5]}>
        <boxGeometry args={[width, height, 1]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      <mesh position={[0, height/2 - 0.5, 0]}>
        <boxGeometry args={[4, 2, 0.5]} />
        <meshStandardMaterial color="#4FD1C5" emissive="#4FD1C5" emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
}

function AppStore({ width, height, season }: any) {
  return (
    <group>
      <mesh position={[0, height/2, 0.5]}>
        <boxGeometry args={[width, height, 1]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      <mesh position={[0, height/2 + 0.5, 0]}>
        <planeGeometry args={[width - 2, 2]} />
        <meshStandardMaterial color="#0000FF" emissive="#0000FF" emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}

// 2055 Futuristic Storefronts
function HoloShop({ width, height, season }: any) {
  return (
    <group>
      <mesh position={[0, height/2, 0.5]}>
        <boxGeometry args={[width, height, 1]} />
        <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={0.6} transparent opacity={0.7} />
      </mesh>
      <HoloSign position={[0, height/2 + 0.8, 0]} />
    </group>
  )
}

function NeuroShop({ width, height, season }: any) {
  return (
    <group>
      <mesh position={[0, height/2, 0.5]}>
        <boxGeometry args={[width, height, 1]} />
        <meshStandardMaterial color="#FF00FF" emissive="#FF00FF" emissiveIntensity={0.5} transparent opacity={0.8} />
      </mesh>
      <HoloSign position={[0, height/2 + 0.6, 0]} color="#FF00FF" />
    </group>
  )
}

function TeleportHub({ width, height, season }: any) {
  return (
    <group>
      <mesh position={[0, height/2, 0.5]}>
        <boxGeometry args={[width, height, 1]} />
        <meshStandardMaterial color="#FFFF00" emissive="#FFFF00" emissiveIntensity={0.6} transparent opacity={0.7} />
      </mesh>
      <TeleportPad position={[0, height/2 - 0.5, 0]} />
    </group>
  )
}

function HoloSign({ position, color = '#00FFFF' }: any) {
  return (
    <group position={position}>
      <mesh>
        <planeGeometry args={[6, 2]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 0.01, 0]}>
        <ringGeometry args={[2.5, 3, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} side={2} />
      </mesh>
    </group>
  )
}

function TeleportPad({ position }: any) {
  return (
    <group position={position}>
      <mesh rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1, 2, 24]} />
        <meshStandardMaterial color="#FFFF00" emissive="#FFFF00" emissiveIntensity={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.5, 1, 24]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.8} />
      </mesh>
    </group>
  )
}