interface RoadProps {
  positions: [number, number, number][]
}

export function Road({ positions }: RoadProps) {
  return (
    <group>
      {positions.map((pos, i) => (
        <group key={`road-${i}`} position={pos}>
          {/* Road surface */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[4, 25]} />
            <meshStandardMaterial color="#2a2a2a" />
          </mesh>
          
          {/* Road markings */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <planeGeometry args={[0.2, 25]} />
            <meshStandardMaterial color="#ffff00" />
          </mesh>
        </group>
      ))}
    </group>
  )
}