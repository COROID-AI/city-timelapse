import React from 'react'
import { useEraStore } from '../store/eraStore'
import type { EraId } from '../eras'

type HairStyle =
  | 'hat'
  | 'headscarf'
  | 'short_cut'
  | 'afro'
  | 'beehive'
  | 'mullet'
  | 'perm'
  | 'high_top_fade'
  | 'spiked'
  | 'bob'
  | 'buzz'
  | 'pony'
  | 'undercut'
  | 'long_woven'

type OutfitStyle =
  | 'suit_hat'
  | 'dress_apron_headscarf'
  | 'overalls_cap'
  | 'coat_hat_newspaper'
  | 'mod_dress_vinyl'
  | 'jeans_tee_afro'
  | 'psychedelic_shirt_newspaper'
  | 'power_suit_brick_phone'
  | 'leather_jacket_walkman'
  | 'tracksuit_mullet_phone'
  | 'hoodie_flip_phone'
  | 'graphic_tee_ipod'
  | 'casual_modern_laptop_flip'
  | 'athleisure_smartphone'
  | 'minimalist_smartwatch_tablet'
  | 'tech_wear_smartphone_earbuds'

type AccessoryType =
  | 'newspaper'
  | 'pipe'
  | 'vinylRecord'
  | 'brickPhone'
  | 'walkman'
  | 'flipPhone'
  | 'laptop'
  | 'ipod'
  | 'smartphone'
  | 'earbuds'
  | 'smartwatch'
  | 'tablet'

interface PatronConfig {
  position: { x: number; y: number; z: number }
  rotationY: number
  scale: number
  hair: HairStyle
  outfit: OutfitStyle
  colors: {
    skin: string
    hair: string
    primary: string
    secondary: string
    accent?: string
  }
  accessories: AccessoryType[]
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

const Hair: React.FC<{ style: HairStyle; color: string; scale: number }> = ({ style, color, scale }) => {
  // Base head center (relative to head group)
  const headY = 0
  switch (style) {
    case 'hat':
      return (
        <group>
          {/* hat crown */}
          <mesh position={[0, headY + 0.19 * scale, 0]}>
            <cylinderGeometry args={[0.14 * scale, 0.16 * scale, 0.06 * scale, 16]} />
            <meshStandardMaterial color={color} roughness={0.5} metalness={0.05} />
          </mesh>
          {/* hat brim */}
          <mesh position={[0, headY + 0.155 * scale, 0]} rotation={[0, 0, 0]}>
            <cylinderGeometry args={[0.19 * scale, 0.2 * scale, 0.02 * scale, 24]} />
            <meshStandardMaterial color={color} roughness={0.6} metalness={0.05} />
          </mesh>
        </group>
      )

    case 'headscarf':
      return (
        <group>
          {/* scarf drape */}
          <mesh position={[0, headY + 0.05 * scale, 0]} rotation={[0.2, 0, 0]}>
            <sphereGeometry args={[0.16 * scale, 14, 14]} />
            <meshStandardMaterial color={color} roughness={0.9} metalness={0} transparent opacity={0.95} />
          </mesh>
        </group>
      )

    case 'short_cut':
      return (
        <group>
          <mesh position={[0, headY + 0.18 * scale, 0]}>
            <sphereGeometry args={[0.1 * scale, 14, 14]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
        </group>
      )

    case 'afro':
      return (
        <group>
          <mesh position={[0, headY + 0.18 * scale, 0]}>
            <sphereGeometry args={[0.14 * scale, 16, 16]} />
            <meshStandardMaterial color={color} roughness={0.75} />
          </mesh>
        </group>
      )

    case 'beehive':
      return (
        <group>
          <mesh position={[0, headY + 0.18 * scale, 0]}>
            <coneGeometry args={[0.11 * scale, 0.14 * scale, 18]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
        </group>
      )

    case 'mullet':
      return (
        <group>
          {/* front short */}
          <mesh position={[0, headY + 0.19 * scale, 0.04 * scale]}>
            <boxGeometry args={[0.18 * scale, 0.12 * scale, 0.12 * scale]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
          {/* back longer */}
          <mesh position={[0, headY + 0.16 * scale, -0.08 * scale]}>
            <boxGeometry args={[0.2 * scale, 0.1 * scale, 0.24 * scale]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
        </group>
      )

    case 'perm':
      return (
        <group>
          <mesh position={[0, headY + 0.18 * scale, 0]}>
            <sphereGeometry args={[0.14 * scale, 14, 14]} />
            <meshStandardMaterial color={color} roughness={0.65} />
          </mesh>
          {/* curly side bumps */}
          {[
            { x: -0.1, z: 0.06 },
            { x: 0.1, z: 0.06 },
            { x: -0.09, z: -0.06 },
            { x: 0.09, z: -0.06 },
          ].map((p, i) => (
            <mesh key={i} position={[p.x * scale, headY + 0.15 * scale, p.z * scale]}>
              <sphereGeometry args={[0.06 * scale, 10, 10]} />
              <meshStandardMaterial color={color} roughness={0.6} />
            </mesh>
          ))}
        </group>
      )

    case 'high_top_fade':
      return (
        <group>
          <mesh position={[0, headY + 0.23 * scale, 0]}>
            <cylinderGeometry args={[0.1 * scale, 0.12 * scale, 0.16 * scale, 14]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
        </group>
      )

    case 'spiked':
      return (
        <group>
          <mesh position={[0, headY + 0.14 * scale, 0]}>
            <sphereGeometry args={[0.08 * scale, 12, 12]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
          {/* spikes */}
          {[-1, -0.5, 0, 0.5, 1].map((t, i) => (
            <mesh key={i} position={[t * 0.06 * scale, headY + 0.26 * scale, (0.02 + i * 0.01) * scale]} rotation={[0, 0, 0]}>
              <boxGeometry args={[0.03 * scale, 0.08 * scale, 0.03 * scale]} />
              <meshStandardMaterial color={color} roughness={0.6} />
            </mesh>
          ))}
        </group>
      )

    case 'bob':
      return (
        <group>
          <mesh position={[0, headY + 0.18 * scale, 0.02 * scale]}>
            <boxGeometry args={[0.22 * scale, 0.1 * scale, 0.14 * scale]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
          <mesh position={[0, headY + 0.2 * scale, -0.01 * scale]}>
            <sphereGeometry args={[0.11 * scale, 12, 12]} />
            <meshStandardMaterial color={color} roughness={0.75} />
          </mesh>
        </group>
      )

    case 'buzz':
      return (
        <group>
          <mesh position={[0, headY + 0.2 * scale, 0]}>
            <sphereGeometry args={[0.095 * scale, 12, 12]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
        </group>
      )

    case 'pony':
      return (
        <group>
          <mesh position={[0, headY + 0.18 * scale, 0]}>
            <sphereGeometry args={[0.12 * scale, 14, 14]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
          {/* pony tail */}
          <mesh position={[0.05 * scale, headY + 0.14 * scale, -0.12 * scale]} rotation={[0, 0, 0]}>
            <cylinderGeometry args={[0.03 * scale, 0.03 * scale, 0.22 * scale, 10]} />
            <meshStandardMaterial color={color} roughness={0.65} />
          </mesh>
        </group>
      )

    case 'undercut':
      return (
        <group>
          {/* shaved sides */}
          <mesh position={[0, headY + 0.12 * scale, 0]}>
            <sphereGeometry args={[0.1 * scale, 12, 12]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
          {/* longer top */}
          <mesh position={[0, headY + 0.24 * scale, 0]}>
            <boxGeometry args={[0.18 * scale, 0.06 * scale, 0.18 * scale]} />
            <meshStandardMaterial color={color} roughness={0.65} />
          </mesh>
        </group>
      )

    case 'long_woven':
      return (
        <group>
          <mesh position={[0, headY + 0.2 * scale, 0]}>
            <sphereGeometry args={[0.11 * scale, 14, 14]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
          <mesh position={[0, headY + 0.09 * scale, -0.15 * scale]}>
            <boxGeometry args={[0.18 * scale, 0.18 * scale, 0.26 * scale]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
        </group>
      )

    default:
      return null
  }
}

const Accessory: React.FC<{
  type: AccessoryType
  secondary: string
  accent?: string
  scale: number
}> = ({ type, secondary, accent, scale }) => {
  const s = scale

  switch (type) {
    case 'newspaper':
      return (
        <group>
          <mesh position={[0.26 * s, 0.62 * s, 0.12 * s]} rotation={[0.1, 0, -0.25]}>
            <boxGeometry args={[0.18 * s, 0.04 * s, 0.26 * s]} />
            <meshStandardMaterial color={secondary} roughness={0.9} />
          </mesh>
          <mesh position={[0.27 * s, 0.63 * s, 0.22 * s]}>
            <boxGeometry args={[0.16 * s, 0.01 * s, 0.2 * s]} />
            <meshStandardMaterial color={'#ffffff'} roughness={1} />
          </mesh>
        </group>
      )

    case 'pipe':
      return (
        <group>
          {/* pipe stem */}
          <mesh position={[0.17 * s, 0.93 * s, 0.21 * s]} rotation={[0.3, 0, -0.2]}>
            <cylinderGeometry args={[0.01 * s, 0.015 * s, 0.18 * s, 10]} />
            <meshStandardMaterial color={'#3b2b1f'} roughness={0.6} />
          </mesh>
          {/* pipe bowl */}
          <mesh position={[0.13 * s, 0.89 * s, 0.2 * s]}>
            <sphereGeometry args={[0.03 * s, 12, 12]} />
            <meshStandardMaterial color={'#2a1f16'} roughness={0.55} />
          </mesh>
          {/* smoke */}
          <mesh position={[0.12 * s, 1.0 * s, 0.26 * s]}>
            <coneGeometry args={[0.03 * s, 0.1 * s, 8]} />
            <meshStandardMaterial color={'#d0d0d0'} transparent opacity={0.7} roughness={1} />
          </mesh>
        </group>
      )

    case 'vinylRecord':
      return (
        <group>
          <mesh position={[-0.22 * s, 0.57 * s, 0.12 * s]} rotation={[0, 0.8, 0]}>
            <torusGeometry args={[0.095 * s, 0.015 * s, 12, 18]} />
            <meshStandardMaterial color={'#111111'} roughness={0.35} metalness={0.2} />
          </mesh>
          <mesh position={[-0.22 * s, 0.57 * s, 0.12 * s]}>
            <ringGeometry args={[0.055 * s, 0.065 * s, 20]} />
            <meshStandardMaterial color={'#444444'} roughness={0.6} />
          </mesh>
        </group>
      )

    case 'brickPhone':
      return (
        <group>
          <mesh position={[0.25 * s, 0.58 * s, 0.13 * s]} rotation={[0, 0, -0.25]}>
            <boxGeometry args={[0.08 * s, 0.12 * s, 0.02 * s]} />
            <meshStandardMaterial color={'#202020'} roughness={0.6} metalness={0.2} />
          </mesh>
          <mesh position={[0.255 * s, 0.59 * s, 0.132 * s]}>
            <boxGeometry args={[0.06 * s, 0.09 * s, 0.01 * s]} />
            <meshBasicMaterial color={'#2a7fff'} />
          </mesh>
          <mesh position={[0.285 * s, 0.67 * s, 0.14 * s]}>
            <boxGeometry args={[0.02 * s, 0.02 * s, 0.02 * s]} />
            <meshStandardMaterial color={'#4a4a4a'} roughness={0.4} />
          </mesh>
        </group>
      )

    case 'walkman':
      return (
        <group>
          {/* headphones */}
          <mesh position={[0, 1.01 * s, 0.01 * s]} rotation={[0, 0, 0]}>
            <cylinderGeometry args={[0.16 * s, 0.16 * s, 0.02 * s, 10]} />
            <meshStandardMaterial color={'#1f1f1f'} roughness={0.5} />
          </mesh>
          <mesh position={[-0.17 * s, 1.0 * s, 0.02 * s]}>
            <boxGeometry args={[0.04 * s, 0.05 * s, 0.02 * s]} />
            <meshStandardMaterial color={'#1f1f1f'} roughness={0.5} />
          </mesh>
          <mesh position={[0.17 * s, 1.0 * s, 0.02 * s]}>
            <boxGeometry args={[0.04 * s, 0.05 * s, 0.02 * s]} />
            <meshStandardMaterial color={'#1f1f1f'} roughness={0.5} />
          </mesh>
          {/* walkman body */}
          <mesh position={[0.0 * s, 0.34 * s, 0.16 * s]} rotation={[0.15, 0, 0]}>
            <boxGeometry args={[0.22 * s, 0.05 * s, 0.11 * s]} />
            <meshStandardMaterial color={accent || '#00ffff'} roughness={0.45} metalness={0.2} />
          </mesh>
          <mesh position={[0.05 * s, 0.34 * s, 0.2 * s]}>
            <boxGeometry args={[0.04 * s, 0.02 * s, 0.03 * s]} />
            <meshBasicMaterial color={'#ffffff'} />
          </mesh>
        </group>
      )

    case 'flipPhone':
      return (
        <group>
          {/* outer clamshell */}
          <mesh position={[0.26 * s, 0.58 * s, 0.13 * s]} rotation={[0, 0, -0.25]}>
            <boxGeometry args={[0.09 * s, 0.12 * s, 0.03 * s]} />
            <meshStandardMaterial color={'#303030'} roughness={0.6} metalness={0.15} />
          </mesh>
          {/* screen */}
          <mesh position={[0.26 * s, 0.60 * s, 0.14 * s]}>
            <boxGeometry args={[0.06 * s, 0.08 * s, 0.012 * s]} />
            <meshBasicMaterial color={'#1d7dff'} />
          </mesh>
          {/* hinge line */}
          <mesh position={[0.21 * s, 0.62 * s, 0.145 * s]}>
            <boxGeometry args={[0.03 * s, 0.01 * s, 0.02 * s]} />
            <meshStandardMaterial color={'#121212'} roughness={0.7} />
          </mesh>
        </group>
      )

    case 'laptop':
      return (
        <group>
          {/* open laptop */}
          <mesh position={[-0.05 * s, 0.47 * s, 0.22 * s]} rotation={[0.15, 0.1, 0]}>
            <boxGeometry args={[0.22 * s, 0.03 * s, 0.14 * s]} />
            <meshStandardMaterial color={'#121212'} roughness={0.4} metalness={0.15} />
          </mesh>
          <mesh position={[-0.05 * s, 0.53 * s, 0.24 * s]} rotation={[0.15, 0.1, 0]}>
            <boxGeometry args={[0.18 * s, 0.02 * s, 0.12 * s]} />
            <meshBasicMaterial color={'#0f1b2e'} />
          </mesh>
          {/* screen glow */}
          <mesh position={[-0.05 * s, 0.535 * s, 0.24 * s]}>
            <boxGeometry args={[0.16 * s, 0.016 * s, 0.1 * s]} />
            <meshBasicMaterial color={'#4aa3ff'} transparent opacity={0.25} />
          </mesh>
        </group>
      )

    case 'ipod':
      return (
        <group>
          {/* iPod rectangle */}
          <mesh position={[0.18 * s, 0.49 * s, 0.22 * s]} rotation={[0.08, 0, -0.2]}>
            <boxGeometry args={[0.08 * s, 0.12 * s, 0.02 * s]} />
            <meshStandardMaterial color={'#6c6c6c'} roughness={0.5} metalness={0.1} />
          </mesh>
          <mesh position={[0.18 * s, 0.49 * s, 0.221 * s]}>
            <sphereGeometry args={[0.015 * s, 10, 10]} />
            <meshStandardMaterial color={'#2b2b2b'} roughness={0.5} />
          </mesh>
          {/* earbuds */}
          <mesh position={[-0.1 * s, 0.93 * s, 0.1 * s]}>
            <sphereGeometry args={[0.02 * s, 10, 10]} />
            <meshStandardMaterial color={'#e0e0e0'} roughness={0.8} />
          </mesh>
          <mesh position={[0.1 * s, 0.93 * s, 0.1 * s]}>
            <sphereGeometry args={[0.02 * s, 10, 10]} />
            <meshStandardMaterial color={'#e0e0e0'} roughness={0.8} />
          </mesh>
          <mesh position={[0.0 * s, 0.9 * s, 0.09 * s]} rotation={[0, 0, 0]}>
            <cylinderGeometry args={[0.004 * s, 0.004 * s, 0.12 * s, 8]} />
            <meshStandardMaterial color={accent || '#1e90ff'} roughness={0.8} />
          </mesh>
        </group>
      )

    case 'smartphone':
      return (
        <group>
          <mesh position={[0.28 * s, 0.6 * s, 0.13 * s]} rotation={[0, 0, -0.25]}>
            <boxGeometry args={[0.07 * s, 0.12 * s, 0.01 * s]} />
            <meshStandardMaterial color={'#0b0b0b'} roughness={0.4} metalness={0.2} />
          </mesh>
          <mesh position={[0.285 * s, 0.61 * s, 0.131 * s]}>
            <boxGeometry args={[0.045 * s, 0.085 * s, 0.006 * s]} />
            <meshBasicMaterial color={accent || '#35d6ff'} />
          </mesh>
          <mesh position={[0.3 * s, 0.73 * s, 0.135 * s]}>
            <sphereGeometry args={[0.005 * s, 8, 8]} />
            <meshStandardMaterial color={'#2c2c2c'} roughness={0.5} />
          </mesh>
        </group>
      )

    case 'earbuds':
      return (
        <group>
          <mesh position={[-0.12 * s, 0.95 * s, 0.1 * s]}>
            <sphereGeometry args={[0.016 * s, 10, 10]} />
            <meshStandardMaterial color={'#f3f3f3'} roughness={0.7} />
          </mesh>
          <mesh position={[0.12 * s, 0.95 * s, 0.1 * s]}>
            <sphereGeometry args={[0.016 * s, 10, 10]} />
            <meshStandardMaterial color={'#f3f3f3'} roughness={0.7} />
          </mesh>
          <mesh position={[0.0 * s, 0.93 * s, 0.085 * s]}>
            <cylinderGeometry args={[0.004 * s, 0.004 * s, 0.12 * s, 8]} />
            <meshStandardMaterial color={accent || '#a6a6a6'} roughness={0.8} />
          </mesh>
        </group>
      )

    case 'smartwatch':
      return (
        <group>
          {/* left wrist watch */}
          <mesh position={[-0.18 * s, 0.52 * s, 0.12 * s]} rotation={[0, 0, 0.25]}>
            <boxGeometry args={[0.05 * s, 0.03 * s, 0.012 * s]} />
            <meshStandardMaterial color={'#111111'} roughness={0.5} metalness={0.35} />
          </mesh>
          <mesh position={[-0.176 * s, 0.52 * s, 0.121 * s]}>
            <boxGeometry args={[0.04 * s, 0.02 * s, 0.006 * s]} />
            <meshBasicMaterial color={accent || '#53ff9a'} />
          </mesh>
        </group>
      )

    case 'tablet':
      return (
        <group>
          <mesh position={[0.0 * s, 0.46 * s, 0.23 * s]} rotation={[0.12, 0.0, 0.0]}>
            <boxGeometry args={[0.22 * s, 0.03 * s, 0.14 * s]} />
            <meshStandardMaterial color={'#0a0a0a'} roughness={0.5} metalness={0.1} />
          </mesh>
          <mesh position={[0.0 * s, 0.47 * s, 0.245 * s]}>
            <boxGeometry args={[0.2 * s, 0.02 * s, 0.125 * s]} />
            <meshBasicMaterial color={accent || '#2f9bff'} />
          </mesh>
        </group>
      )

    default:
      return null
  }
}

const PatronFigure: React.FC<{ config: PatronConfig }> = ({ config }) => {
  const { position, rotationY, scale, colors, hair, accessories, outfit } = config

  const s = clamp(scale, 0.65, 1.35)

  // Body proportions
  const feetY = position.y
  const legH = 0.25 * s
  const hipY = feetY + legH
  const torsoH = 0.55 * s
  const torsoW = outfit.includes('dress') || outfit.includes('hoodie') ? 0.3 * s : 0.28 * s
  const shoulderW = outfit === 'power_suit_brick_phone' || outfit === 'tracksuit_mullet_phone' ? 0.34 * s : 0.32 * s
  const headR = 0.12 * s

  const leftArmX = -0.22 * s
  const rightArmX = 0.22 * s

  const pantsFlared = outfit === 'jeans_tee_afro' || outfit === 'mod_dress_vinyl'

  const primary = colors.primary
  const secondary = colors.secondary
  const accent = colors.accent

  return (
    <group position={[position.x, 0, position.z]} rotation={[0, rotationY, 0]} scale={[s, s, s]}>
      {/* Legs */}
      <mesh position={[0, feetY + legH / 2, 0.02 * s]}>
        <boxGeometry args={[0.12 * (pantsFlared ? 1.15 : 1), legH, 0.18 * (pantsFlared ? 1.15 : 1)]} />
        <meshStandardMaterial color={primary} roughness={0.75} metalness={0.05} />
      </mesh>
      <mesh position={[0.12 * s, feetY + legH / 2, 0.02 * s]}>
        <boxGeometry args={[0.12 * (pantsFlared ? 1.15 : 1), legH, 0.18 * (pantsFlared ? 1.15 : 1)]} />
        <meshStandardMaterial color={primary} roughness={0.75} metalness={0.05} />
      </mesh>

      {/* Torso / outfit silhouette */}
      {outfit === 'dress_apron_headscarf' || outfit === 'mod_dress_vinyl' ? (
        <>
          <mesh position={[0, hipY + torsoH * 0.45, 0]}>
            <boxGeometry args={[torsoW, torsoH, 0.22 * s]} />
            <meshStandardMaterial color={primary} roughness={0.7} metalness={0.04} />
          </mesh>
          {/* apron */}
          <mesh position={[0, hipY + torsoH * 0.38, 0.12 * s]}>
            <boxGeometry args={[torsoW * 0.55, torsoH * 0.55, 0.08 * s]} />
            <meshStandardMaterial color={secondary} roughness={0.9} metalness={0} />
          </mesh>
          {/* skirt hint */}
          <mesh position={[0, hipY + torsoH * 0.7, 0.01 * s]}>
            <boxGeometry args={[torsoW * 1.12, torsoH * 0.55, 0.24 * s]} />
            <meshStandardMaterial color={primary} roughness={0.72} metalness={0.02} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, hipY + torsoH / 2, 0]}>
            <boxGeometry args={[shoulderW, torsoH, 0.22 * s]} />
            <meshStandardMaterial color={primary} roughness={0.65} metalness={0.05} />
          </mesh>
          {/* collar / jacket panel */}
          <mesh position={[0, hipY + torsoH * 0.72, 0.11 * s]}>
            <boxGeometry args={[shoulderW * 0.65, 0.07 * s, 0.08 * s]} />
            <meshStandardMaterial color={secondary} roughness={0.6} metalness={0.1} />
          </mesh>
          {/* details by outfit */}
          {outfit === 'power_suit_brick_phone' || outfit === 'tracksuit_mullet_phone' ? (
            <>
              {/* shoulder pads */}
              <mesh position={[-shoulderW * 0.42, hipY + torsoH * 0.78, 0.03 * s]}>
                <boxGeometry args={[0.12 * s, 0.08 * s, 0.08 * s]} />
                <meshStandardMaterial color={secondary} roughness={0.45} metalness={0.3} />
              </mesh>
              <mesh position={[shoulderW * 0.42, hipY + torsoH * 0.78, 0.03 * s]}>
                <boxGeometry args={[0.12 * s, 0.08 * s, 0.08 * s]} />
                <meshStandardMaterial color={secondary} roughness={0.45} metalness={0.3} />
              </mesh>
            </>
          ) : null}
        </>
      )}

      {/* Arms */}
      <mesh position={[leftArmX, hipY + torsoH * 0.55, 0.08 * s]} rotation={[0, 0, 0.1]}>
        <boxGeometry args={[0.06 * s, torsoH * 0.45, 0.1 * s]} />
        <meshStandardMaterial color={secondary} roughness={0.8} metalness={0.02} />
      </mesh>
      <mesh position={[rightArmX, hipY + torsoH * 0.55, 0.08 * s]} rotation={[0, 0, -0.1]}>
        <boxGeometry args={[0.06 * s, torsoH * 0.45, 0.1 * s]} />
        <meshStandardMaterial color={secondary} roughness={0.8} metalness={0.02} />
      </mesh>

      {/* Head */}
      <mesh position={[0, hipY + torsoH + headR, 0]}>
        <sphereGeometry args={[headR, 18, 18]} />
        <meshStandardMaterial color={colors.skin} roughness={0.85} metalness={0.02} />
      </mesh>
      {/* Hair overlay */}
      <group position={[0, hipY + torsoH + headR, 0]}>
        <Hair style={hair} color={colors.hair} scale={s} />
      </group>

      {/* Accessories */}
      {accessories.map((acc, i) => (
        <Accessory
          key={acc + i}
          type={acc}
          secondary={secondary}
          accent={accent}
          scale={s}
        />
      ))}

      {/* Slight standing pose accent */}
      <mesh position={[0, hipY + 0.02 * s, -0.12 * s]}>
        <boxGeometry args={[0.08 * s, 0.03 * s, 0.12 * s]} />
        <meshStandardMaterial color={outfit === 'dress_apron_headscarf' ? secondary : '#1b1b1b'} roughness={1} opacity={0} transparent />
      </mesh>
    </group>
  )
}

const getPatronConfigsForEra = (era: EraId): PatronConfig[] => {
  // Positions are in café-local meter-ish units within an 8m × 12m footprint.
  switch (era) {
    case '1945':
      return [
        {
          position: { x: -2.2, y: 0, z: 1.6 },
          rotationY: 0.6,
          scale: 1.0,
          hair: 'hat',
          outfit: 'suit_hat',
          colors: { skin: '#f2c7a2', hair: '#3b2b1f', primary: '#1f2a44', secondary: '#d9c27a', accent: '#b87335' },
          accessories: ['newspaper', 'pipe'],
        },
        {
          position: { x: 0.9, y: 0, z: 2.1 },
          rotationY: -0.3,
          scale: 1.0,
          hair: 'headscarf',
          outfit: 'dress_apron_headscarf',
          colors: { skin: '#e9b995', hair: '#2c1f17', primary: '#7b2f2f', secondary: '#f5f5f0', accent: '#6b4f2a' },
          accessories: [],
        },
        {
          position: { x: 2.35, y: 0, z: 1.0 },
          rotationY: 1.0,
          scale: 0.95,
          hair: 'hat',
          outfit: 'overalls_cap',
          colors: { skin: '#f2c7a2', hair: '#2b1f15', primary: '#2f4b5a', secondary: '#d0d0d0', accent: '#8b4513' },
          accessories: ['newspaper'],
        },
        {
          position: { x: -0.6, y: 0, z: 0.5 },
          rotationY: -1.0,
          scale: 0.98,
          hair: 'hat',
          outfit: 'coat_hat_newspaper',
          colors: { skin: '#deb38f', hair: '#3b2b1f', primary: '#4b3b32', secondary: '#e7e0d0', accent: '#b87335' },
          accessories: ['newspaper'],
        },
      ]

    case '1965':
      return [
        {
          position: { x: -2.6, y: 0, z: 0.9 },
          rotationY: 0.8,
          scale: 1.02,
          hair: 'beehive',
          outfit: 'mod_dress_vinyl',
          colors: { skin: '#e9b995', hair: '#2a1a12', primary: '#ff44cc', secondary: '#7bdff2', accent: '#ffd700' },
          accessories: ['vinylRecord'],
        },
        {
          position: { x: -0.8, y: 0, z: 2.0 },
          rotationY: -0.2,
          scale: 1.0,
          hair: 'afro',
          outfit: 'jeans_tee_afro',
          colors: { skin: '#caa27a', hair: '#0f0f0f', primary: '#0088ff', secondary: '#ffd700', accent: '#ff66aa' },
          accessories: ['newspaper'],
        },
        {
          position: { x: 1.9, y: 0, z: 1.25 },
          rotationY: 1.1,
          scale: 0.98,
          hair: 'short_cut',
          outfit: 'psychedelic_shirt_newspaper',
          colors: { skin: '#f2c7a2', hair: '#2b1f15', primary: '#7a3cff', secondary: '#d9c27a', accent: '#33ff99' },
          accessories: ['newspaper'],
        },
        {
          position: { x: 0.2, y: 0, z: 0.7 },
          rotationY: -1.2,
          scale: 0.94,
          hair: 'afro',
          outfit: 'jeans_tee_afro',
          colors: { skin: '#caa27a', hair: '#0f0f0f', primary: '#ff6600', secondary: '#ffffff', accent: '#0088ff' },
          accessories: ['vinylRecord'],
        },
      ]

    case '1985':
      return [
        {
          position: { x: -2.3, y: 0, z: 1.2 },
          rotationY: 0.6,
          scale: 1.02,
          hair: 'mullet',
          outfit: 'power_suit_brick_phone',
          colors: { skin: '#f2c7a2', hair: '#111111', primary: '#111111', secondary: '#00ffff', accent: '#00ff00' },
          accessories: ['brickPhone'],
        },
        {
          position: { x: 0.8, y: 0, z: 2.2 },
          rotationY: -0.3,
          scale: 1.0,
          hair: 'perm',
          outfit: 'leather_jacket_walkman',
          colors: { skin: '#e7b892', hair: '#2a1a12', primary: '#2a2a2a', secondary: '#ff00ff', accent: '#00ffff' },
          accessories: ['walkman', 'brickPhone', 'flipPhone'],
        },
        {
          position: { x: 2.35, y: 0, z: 0.85 },
          rotationY: 1.1,
          scale: 0.98,
          hair: 'mullet',
          outfit: 'tracksuit_mullet_phone',
          colors: { skin: '#caa27a', hair: '#0f0f0f', primary: '#00ff00', secondary: '#111111', accent: '#ff44cc' },
          accessories: ['brickPhone'],
        },
      ]

    case '2005':
      return [
        {
          position: { x: -2.1, y: 0, z: 1.1 },
          rotationY: 0.65,
          scale: 1.02,
          hair: 'bob',
          outfit: 'hoodie_flip_phone',
          colors: { skin: '#e9b995', hair: '#1f1f1f', primary: '#2b2b2b', secondary: '#6c8cff', accent: '#ff66aa' },
          accessories: ['flipPhone'],
        },
        {
          position: { x: 0.9, y: 0, z: 2.1 },
          rotationY: -0.25,
          scale: 1.0,
          hair: 'bob',
          outfit: 'graphic_tee_ipod',
          colors: { skin: '#f2c7a2', hair: '#2b1f15', primary: '#4169E1', secondary: '#ffffff', accent: '#ff69b4' },
          accessories: ['ipod'],
        },
        {
          position: { x: 2.2, y: 0, z: 1.0 },
          rotationY: 1.05,
          scale: 0.98,
          hair: 'bob',
          outfit: 'casual_modern_laptop_flip',
          colors: { skin: '#deb38f', hair: '#3b2b1f', primary: '#6b6b6b', secondary: '#d9c27a', accent: '#4aa3ff' },
          accessories: ['laptop', 'flipPhone'],
        },
        {
          position: { x: -0.2, y: 0, z: 0.6 },
          rotationY: -1.2,
          scale: 0.94,
          hair: 'bob',
          outfit: 'hoodie_flip_phone',
          colors: { skin: '#e7b892', hair: '#2a1a12', primary: '#1f2937', secondary: '#22c55e', accent: '#fbbf24' },
          accessories: ['flipPhone'],
        },
      ]

    case '2025':
      return [
        {
          position: { x: -2.4, y: 0, z: 1.25 },
          rotationY: 0.7,
          scale: 1.02,
          hair: 'pony',
          outfit: 'athleisure_smartphone',
          colors: { skin: '#e9b995', hair: '#141414', primary: '#3b82f6', secondary: '#e5e7eb', accent: '#35d6ff' },
          accessories: ['smartphone', 'earbuds'],
        },
        {
          position: { x: 0.95, y: 0, z: 2.15 },
          rotationY: -0.35,
          scale: 1.0,
          hair: 'undercut',
          outfit: 'minimalist_smartwatch_tablet',
          colors: { skin: '#f2c7a2', hair: '#111111', primary: '#d1d5db', secondary: '#111827', accent: '#53ff9a' },
          accessories: ['smartwatch', 'tablet'],
        },
        {
          position: { x: 2.25, y: 0, z: 0.9 },
          rotationY: 1.05,
          scale: 0.98,
          hair: 'long_woven',
          outfit: 'tech_wear_smartphone_earbuds',
          colors: { skin: '#caa27a', hair: '#2a1a12', primary: '#0f766e', secondary: '#e5e7eb', accent: '#2f9bff' },
          accessories: ['smartphone', 'earbuds', 'laptop'],
        },
        {
          position: { x: -0.3, y: 0, z: 0.6 },
          rotationY: -1.1,
          scale: 0.94,
          hair: 'buzz',
          outfit: 'athleisure_smartphone',
          colors: { skin: '#deb38f', hair: '#0f0f0f', primary: '#ef4444', secondary: '#ffffff', accent: '#35d6ff' },
          accessories: ['smartphone', 'smartwatch'],
        },
      ]

    default:
      return []
  }
}

export const Patrons: React.FC = () => {
  const currentEra = (useEraStore as any)((state: any) => state.currentEra) as EraId
  const configs = getPatronConfigsForEra(currentEra)

  return (
    <group>
      {configs.map((config, idx) => (
        <PatronFigure key={currentEra + '-patron-' + idx} config={config} />
      ))}
    </group>
  )
}
