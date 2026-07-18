import React, { useMemo } from 'react'

type Era = '1945' | '1965' | '1985' | '2005' | '2025' | '2055'

interface StorefrontsProps {
  eraA: Era
  eraB: Era
  blendT: number
}

export function Storefronts({ eraA, eraB, blendT }: StorefrontsProps) {
  return (
    <group>
      <StorefrontsForEra era={eraA} opacity={1 - blendT} />
      <StorefrontsForEra era={eraB} opacity={blendT} />
    </group>
  )
}

function StorefrontsForEra({ era, opacity }: { era: Era; opacity: number }) {
  return (
    <group opacity={opacity}>
      <Storefront position={[-40, 0, -20]} width={15} height={10} era={era} name="General Store" type={0} />
      <Storefront position={[0, 0, -20]} width={20} height={15} era={era} name="Diner" type={1} />
      <Storefront position={[-20, 0, 0]} width={18} height={35} era={era} name="Department Store" type={0} />
      <Storefront position={[45, 0, 0]} width={12} height={20} era={era} name="Electronics" type={1} />
      <Storefront position={[-45, 0, 20]} width={25} height={10} era={era} name="Market" type={2} />
    </group>
  )
}

interface StorefrontProps {
  position: [number, number, number]
  width: number
  height: number
  era: Era
  name: string
  type: number
}

function Storefront({ position, width, height, era, name, type }: StorefrontProps) {
  const signColor = useMemo(() => {
    const colors: Record<Era, string[]> = {
      '1945': ['#8B0000', '#2F4F4F', '#FFD700'],
      '1965': ['#FF1493', '#00CED1', '#FFD700'],
      '1985': ['#00CED1', '#FF69B4', '#1E90FF'],
      '2005': ['#00BFFF', '#32CD32', '#FF6347'],
      '2025': ['#9370DB', '#32CD32', '#4682B4'],
      '2055': ['#00FFFF', '#9932CC', '#4169E1'],
    }
    return colors[era][type % 3]
  }, [era, type])

  const storefrontGlass = era === '2055' || era === '2025' || era === '2005'

  return (
    <group position={position}>
      <mesh position={[0, height / 2, width / 2 + 0.01]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          color={signColor}
          transparent
          opacity={storefrontGlass ? 0.8 : 0.9}
          emissive={signColor}
          emissiveIntensity={era === '2055' ? 0.5 : 0.3}
        />
      </mesh>

      {Array.from({ length: Math.floor(width / 3) }).map((_, i) => (
        <mesh key={i} position={[-width / 2 + 2 + i * 3, 0, width / 2 + 0.02]}>
          <planeGeometry args={[2, 2]} />
          <meshStandardMaterial color="#FFF" opacity={0.6} transparent />
        </mesh>
      ))}

      {era !== '1945' && (
        <mesh position={[0, height - 1, width / 2 + 0.01]}>
          <planeGeometry args={[width * 0.6, 2]} />
          <meshStandardMaterial color={signColor} emissive={signColor} emissiveIntensity={0.5} transparent opacity={0.95} />
        </mesh>
      )}

      {era === '1945' && <SignBanner position={[-width / 4, height - 2, width / 2 + 0.02]} text={name.toUpperCase()} color="#FFD700" />}
      {era === '1965' && <SignNeon position={[-width / 4, height - 2, width / 2 + 0.02]} text="DRIVE-IN" color="#FF69B4" />}
      {era === '2055' && <HologramSign position={[0, height + 1, width / 2 + 0.5]} text={name} />}
    </group>
  )
}

function SignBanner({ position, text, color }: { position: [number, number, number]; text: string; color: string }) {
  return (
    <group position={position}>
      <mesh>
        <planeGeometry args={[1.5, 0.5]} />
        <meshBasicMaterial color={color} transparent opacity={0.95} />
      </mesh>
    </group>
  )
}

function SignNeon({ position, color }: { position: [number, number, number]; text: string; color: string }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[2, 0.3, 0.1]} />
        <meshStandardMaterial color="#333" emissive={color} emissiveIntensity={0.6} transparent opacity={0.95} />
      </mesh>
    </group>
  )
}

function HologramSign({ position, text }: { position: [number, number, number]; text: string }) {
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.5, 0.5, 0.1, 16, 1, true]} />
        <meshBasicMaterial color="#00FFFF" opacity={0.3} transparent side={2} />
      </mesh>
      <pointLight position={[0, 0, 0]} intensity={0.5} color="#00FFFF" distance={5} />
    </group>
  )
}
