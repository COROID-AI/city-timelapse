import { useEra } from '../contexts/EraContext'

export function Sky() {
  const { currentEra } = useEra()

  const getSkyColor = () => {
    switch (currentEra) {
      case '1945':
        return '#87CEEB' // Classic blue
      case '1965':
        return '#FFD700' // Golden hour
      case '1985':
        return '#C0C0C0' // Overcast
      case '2005':
        return '#87CEFA' // Clear blue
      case '2025':
        return '#B0E0E6' // Light sky blue
      case '2055':
        return '#4169E1' // Futuristic twilight
      default:
        return '#87CEEB'
    }
  }

  return (
    <group>
      {/* Sky mesh */}
      <mesh position={[0, -1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <sphereGeometry args={[1000, 32, 32]} />
        <meshBasicMaterial
          color={getSkyColor()}
          side={2}
        />
      </mesh>

      {/* Sun based on era */}
      {currentEra !== '2055' && (
        <mesh position={[150, 200, 100]}>
          <sphereGeometry args={[50, 32, 32]} />
          <meshBasicMaterial
            color={currentEra === '1965' ? '#FFA500' : '#FFFF00'}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}

      {/* Futuristic sky objects (2055) */}
      {currentEra === '2055' && (
        <>
          {/* Multiple moons/satellites */}
          <mesh position={[100, 150, 50]}>
            <sphereGeometry args={[20, 16, 16]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
          {/* Distant city lights */}
          <pointLight
            position={[0, 50, -200]}
            color="#00FFFF"
            intensity={0.3}
            distance={300}
          />
        </>
      )}
    </group>
  )
}