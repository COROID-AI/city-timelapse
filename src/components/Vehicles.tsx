import { useEra, Era } from '../contexts/EraContext'
import { useMemo } from 'react'

function Vehicle({ position, rotation = [0, 0, 0], era }: { position: [number, number, number]; rotation?: [number, number, number]; era: Era }) {
  const vehicleStyles: Record<Era, { bodyColor: string; roofColor: string }> = {
    '1945': { bodyColor: '#8B0000', roofColor: '#4a2a1a' },
    '1965': { bodyColor: '#0066CC', roofColor: '#004499' },
    '1985': { bodyColor: '#FFD700', roofColor: '#FFD700' },
    '2005': { bodyColor: '#1E90FF', roofColor: '#FFFFFF' },
    '2025': { bodyColor: '#32CD32', roofColor: '#32CD32' },
    '2055': { bodyColor: '#FF69B4', roofColor: '#00FFFF' },
  }

  const style = vehicleStyles[era]

  return (
    <group position={position} rotation={rotation}>
      {/* Main body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={era === '1945' ? [8, 4, 16] : era === '2055' ? [6, 4, 12] : [6, 4, 14]} />
        <meshStandardMaterial
          color={style.bodyColor}
          metalness={era === '2055' ? 0.8 : 0.4}
          roughness={era === '2055' ? 0.2 : 0.6}
          emissive={style.bodyColor}
          emissiveIntensity={era === '2055' ? 0.3 : 0}
        />
      </mesh>

      {/* Roof/Cabin */}
      <mesh position={[0, 2.5, -2]} castShadow>
        <boxGeometry args={era === '1945' ? [6, 3, 6] : era === '2055' ? [4, 2, 6] : [5, 3, 5]} />
        <meshStandardMaterial color={style.roofColor} />
      </mesh>

      {/* Wheels */}
      {era !== '2055' && (
        <>
          {[-3, 3].map((x, i) =>
            [-6, 6].map((z, j) => (
              <mesh key={`${i}-${j}`} position={[x, 1, z]} castShadow>
                <cylinderGeometry args={[1.5, 1.5, 1, 16]} />
                <meshStandardMaterial color="#333333" metalness={0.8} />
              </mesh>
            ))
          )}
        </>
      )}

      {/* Flying vehicle propellers (2055) */}
      {era === '2055' && (
        <>
          <mesh position={[0, -0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[3, 4, 8]} />
            <meshBasicMaterial color="#00FFFF" transparent opacity={0.7} side={2} />
          </mesh>
          <mesh position={[0, -0.3, 0]}>
            <sphereGeometry args={[2, 16, 16]} />
            <meshStandardMaterial color={style.bodyColor} emissive="#00FFFF" emissiveIntensity={0.5} />
          </mesh>
        </>
      )}
    </group>
  )
}

export function Vehicles() {
  const { currentEra } = useEra()

  const vehicles = useMemo(() => [
    { position: [-10, 0, 20], rotation: [0, Math.PI / 2, 0] as [number, number, number] },
    { position: [10, 0, 20], rotation: [0, Math.PI / 2, 0] as [number, number, number] },
    { position: [-10, 0, -30], rotation: [0, -Math.PI / 2, 0] as [number, number, number] },
    { position: [10, 0, -30], rotation: [0, -Math.PI / 2, 0] as [number, number, number] },
    { position: [0, 0, -80], rotation: [0, 0, 0] as [number, number, number] },
    { position: [-40, 0, -10], rotation: [0, 0, 0] as [number, number, number] },
    { position: [40, 0, -10], rotation: [0, Math.PI, 0] as [number, number, number] },
  ], [currentEra])

  return (
    <group>
      {vehicles.map((vehicle, index) => (
        <Vehicle
          key={index}
          position={[vehicle.position[0], 1.5, vehicle.position[2]]}
          rotation={vehicle.rotation}
          era={currentEra}
        />
      ))}
    </group>
  )
}