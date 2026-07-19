import React, { useRef, useEffect, useMemo } from 'react'
import { gsap } from 'gsap'

interface GroundProps {
  era: number
}

export const Ground: React.FC<GroundProps> = ({ era }) => {
  const meshRef = useRef<any>(null!)
  const groundColor = useMemo(() => getGroundColor(era), [era])

  // Animate ground color on era change
  useEffect(() => {
    if (meshRef.current) {
      gsap.to(meshRef.current.material, {
        color: groundColor,
        duration: 1.5,
        ease: 'power2.inOut',
      })
    }
  }, [era, groundColor])

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial color={groundColor} />
    </mesh>
  )
}

function getGroundColor(era: number): string {
  if (era <= 1965) return '#8B4513' // Dirt/brown for older eras
  if (era <= 1985) return '#2F4F4F' // Asphalt
  if (era <= 2005) return '#228B22' // Green/asphalt
  if (era <= 2025) return '#3CB371' // Sustainable green
  return '#4169E1' // Future blue-tech ground
}