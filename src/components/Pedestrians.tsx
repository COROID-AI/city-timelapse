import { useEra, Era } from '../contexts/EraContext'
import { useMemo } from 'react'

const pedestrianStyles: Record<Era, {
  skinColor: string
  clothingColor: string
  hatColor: string
  hatStyle: string
}> = {
  '1945': { skinColor: '#D2B48C', clothingColor: '#2F4F4F', hatColor: '#8B4513', hatStyle: 'fedora' },
  '1965': { skinColor: '#DEB887', clothingColor: '#FF69B4', hatColor: '#FFFFFF', hatStyle: 'none' },
  '1985': { skinColor: '#D2B48C', clothingColor: '#00FF00', hatColor: '#0000FF', hatStyle: 'headband' },
  '2005': { skinColor: '#F5DEB3', clothingColor: '#4169E1', hatColor: '#000000', hatStyle: 'cap' },
  '2025': { skinColor: '#FFE4C4', clothingColor: '#FF69B4', hatColor: '#FFFFFF', hatStyle: 'hoodie' },
  '2055': { skinColor: '#E0FFFF', clothingColor: '#8A2BE2', hatColor: '#FF00FF', hatStyle: 'holographic' },
}

function Pedestrian({ position, rotation = [0, 0, 0], era }: { position: [number, number, number]; rotation?: [number, number, number]; era: Era }) {
  const style = pedestrianStyles[era]

  return (
    <group position={position} rotation={rotation}>
      {/* Body */}
      <mesh position={[0, 4, 0]} castShadow>
        <capsuleGeometry args={[0.8, 3.5, 8, 16]} />
        <meshStandardMaterial color={style.clothingColor} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 6.8, 0]} castShadow>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial color={style.skinColor} />
      </mesh>

      {/* Hat based on era */}
      {style.hatStyle === 'fedora' && (
        <mesh position={[0, 7.6, 0]} castShadow>
          <cylinderGeometry args={[0.9, 0.9, 0.5, 16]} />
          <meshStandardMaterial color={style.hatColor} />
        </mesh>
      )}

      {style.hatStyle === 'headband' && (
        <mesh position={[0, 7.4, 0]} castShadow>
          <torusGeometry args={[0.85, 0.2, 8, 16]} />
          <meshStandardMaterial
            color={style.hatColor}
            emissive={style.hatColor}
            emissiveIntensity={0.5}
          />
        </mesh>
      )}

      {style.hatStyle === 'cap' && (
        <group position={[0, 7.5, 0]}>
          <mesh position={[0, 0.2, 0]} castShadow>
            <cylinderGeometry args={[0.85, 0.85, 0.4, 16]} />
            <meshStandardMaterial color={style.hatColor} />
          </mesh>
          <mesh position={[0, 0, 0.6]} castShadow>
            <boxGeometry args={[1.7, 0.3, 0.1]} />
            <meshStandardMaterial color={style.hatColor} />
          </mesh>
        </group>
      )}

      {style.hatStyle === 'hoodie' && (
        <mesh position={[0, 7.7, 0]} castShadow>
          <sphereGeometry args={[0.9, 16, 16]} />
          <meshStandardMaterial
            color={style.hatColor}
            emissive={style.hatColor}
            emissiveIntensity={0.3}
          />
        </mesh>
      )}

      {style.hatStyle === 'holographic' && (
        <mesh position={[0, 7.8, 0]} castShadow>
          <coneGeometry args={[1, 1, 16]} />
          <meshStandardMaterial
            color={style.hatColor}
            emissive="#FF00FF"
            emissiveIntensity={0.8}
            transparent
            opacity={0.7}
          />
        </mesh>
      )}

      {/* Arms */}
      <mesh position={[1.2, 4, 0]} rotation={[0, 0, Math.PI / 8]} castShadow>
        <capsuleGeometry args={[0.3, 2, 8, 16]} />
        <meshStandardMaterial color={style.skinColor} />
      </mesh>
      <mesh position={[-1.2, 4, 0]} rotation={[0, 0, -Math.PI / 8]} castShadow>
        <capsuleGeometry args={[0.3, 2, 8, 16]} />
        <meshStandardMaterial color={style.skinColor} />
      </mesh>
    </group>
  )
}

export function Pedestrians() {
  const { currentEra } = useEra()

  const pedestrians = useMemo(() => [
    { position: [-25, 0, 25], rotation: [0, Math.PI / 4, 0] as [number, number, number] },
    { position: [25, 0, 25], rotation: [0, -Math.PI / 4, 0] as [number, number, number] },
    { position: [-20, 0, -20], rotation: [0, Math.PI / 2, 0] as [number, number, number] },
    { position: [30, 0, -20], rotation: [0, Math.PI, 0] as [number, number, number] },
    { position: [0, 0, 50], rotation: [0, Math.PI, 0] as [number, number, number] },
    { position: [-50, 0, 0], rotation: [0, 0, 0] as [number, number, number] },
    { position: [50, 0, 0], rotation: [0, 0, 0] as [number, number, number] },
    { position: [0, 0, -60], rotation: [0, 0, 0] as [number, number, number] },
  ], [currentEra])

  return (
    <group>
      {pedestrians.map((pedestrian, index) => (
        <Pedestrian
          key={index}
          position={[pedestrian.position[0], 0.1, pedestrian.position[2]]}
          rotation={pedestrian.rotation}
          era={currentEra}
        />
      ))}
    </group>
  )
}