import { Era } from '../App'

interface SkyProps {
  era: Era
}

export function Sky({ era }: SkyProps) {
  return (
    <>
      {/* Sun/Disk light source */}
      <directionalLight
        position={[0, 50, 0]}
        intensity={0.3}
        color={era === '2055' ? '#00FFFF' : era === '1945' || era === '1965' ? '#FFD700' : '#FFFACD'}
      />
      
      {/* Stars for futuristic era */}
      {era === '2055' && (
        <Stars 
          radius={100} 
          depth={50} 
          count={5000} 
          saturation={0} 
          factor={4} 
          fade 
          speed={0.5}
        />
      )}
    </>
  )
}

function Stars({ radius, depth, count, saturation, factor, fade, speed }: any) {
  // Simple star implementation using points
  // This would normally use drei's Stars component, but we'll create a custom one
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={new Float32Array(count * 3).map(() => (Math.random() - 0.5) * radius * 2)}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.5} color="#ffffff" transparent opacity={0.8} />
    </points>
  )
}