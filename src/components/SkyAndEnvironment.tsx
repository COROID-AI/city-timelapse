import { useMemo } from 'react'
import { Color } from 'three'
import { useEraConfig } from '../hooks/useEraConfig'

interface SkyAndEnvironmentProps {
  era: number
}

export function SkyAndEnvironment({ era }: SkyAndEnvironmentProps) {
  const { config } = useEraConfig(era)
  
  const skyColor = useMemo(() => new Color(config.skyColor), [config.skyColor])
  const fogColor = useMemo(() => new Color(config.fogColor), [config.fogColor])

  return (
    <>
      <color attach="background" args={[skyColor]} />
      <fog attach="fog" args={[fogColor, 100, 300]} />
      
      {/* Sky gradient based on era */}
      <mesh scale={500}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial 
          side={2} // BackSide
          color={skyColor}
        />
      </mesh>
    </>
  )
}