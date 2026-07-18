import { useEra, Era } from '../contexts/EraContext'
import { useMemo } from 'react'

const adStyles: Record<Era, { color: string; emissive: boolean }> = {
  '1945': { color: '#4a2a1a', emissive: false },
  '1965': { color: '#0066CC', emissive: false },
  '1985': { color: '#FF1493', emissive: true },
  '2005': { color: '#32CD32', emissive: true },
  '2025': { color: '#1E90FF', emissive: true },
  '2055': { color: '#FF69B4', emissive: true },
}

function Advertisement({ position, era }: { position: [number, number, number]; era: Era }) {
  const style = adStyles[era]

  return (
    <group position={position}>
      {/* Billboard pole */}
      <mesh position={[0, 10, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 20]} />
        <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Billboard sign */}
      <mesh position={[0, 15, 0]} castShadow>
        <planeGeometry args={[15, 5]} />
        <meshStandardMaterial
          color={style.color}
          emissive={style.emissive ? style.color : '#000000'}
          emissiveIntensity={style.emissive ? 0.5 : 0}
        />
      </mesh>
    </group>
  )
}

export function Billboards() {
  const { currentEra } = useEra()

  const billboards = useMemo(() => [
    { position: [-50, 0, -10] },
    { position: [55, 0, -10] },
    { position: [0, 0, 0] },
  ], [currentEra])

  return (
    <group>
      {billboards.map((billboard, index) => (
        <Advertisement
          key={index}
          position={[billboard.position[0], 0.1, billboard.position[2]]}
          era={currentEra}
        />
      ))}
    </group>
  )
}