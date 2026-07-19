import { Era } from '../App'

interface GroundProps {
  era: Era
}

export function Ground({ era }: GroundProps) {
  const roadColor = era === '1945' || era === '1965' 
    ? '#4a4a4a' 
    : era === '1985' 
      ? '#2a2a2a' 
      : era === '2005' 
        ? '#1a1a1a' 
        : era === '2025' 
          ? '#0f0f0f' 
          : '#00ffff'

  const grassColor = era === '2055' ? '#00ff88' : '#228B22'

  return (
    <>
      {/* Main ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#333333" />
      </mesh>

      {/* Road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[30, 120]} />
        <meshStandardMaterial color={roadColor} />
      </mesh>

      {/* Sidewalks */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-20, 0.02, 0]} receiveShadow>
        <planeGeometry args={[10, 120]} />
        <meshStandardMaterial color="#555555" />
      </mesh>
      
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[20, 0.02, 0]} receiveShadow>
        <planeGeometry args={[10, 120]} />
        <meshStandardMaterial color="#555555" />
      </mesh>

      {/* Grass areas */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-35, 0.01, 0]} receiveShadow>
        <planeGeometry args={[50, 120]} />
        <meshStandardMaterial color={grassColor} opacity={0.8} transparent />
      </mesh>
      
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[35, 0.01, 0]} receiveShadow>
        <planeGeometry args={[50, 120]} />
        <meshStandardMaterial color={grassColor} opacity={0.8} transparent />
      </mesh>

      {/* Road markings */}
      {era !== '2055' && (
        <RoadMarkings era={era} />
      )}
    </>
  )
}

function RoadMarkings({ era }: { era: Era }) {
  return (
    <>
      {/* Center line */}
      {Array.from({ length: 20 }).map((_, i) => (
        <mesh key={i} position={[0, 0.02, -50 + i * 5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.3, 2]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      ))}
      
      {/* Crosswalk */}
      {era !== '1945' && (
        <group position={[-15, 0.02, 25]}>
          {Array.from({ length: 8 }).map((_, i) => (
            <mesh key={i} position={[0, 0, i * 2 - 7]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.8, 1.5]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
          ))}
        </group>
      )}
    </>
  )
}