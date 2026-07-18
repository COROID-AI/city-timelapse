import { useEra, Era } from '../contexts/EraContext'
import { useMemo } from 'react'

const roadStyle: Record<Era, string> = {
  '1945': '#2a2a2a',
  '1965': '#3a3a3a',
  '1985': '#1a1a1a',
  '2005': '#404040',
  '2025': '#353535',
  '2055': '#202030',
}

const sidewalkStyle: Record<Era, string> = {
  '1945': '#8B4513',
  '1965': '#A0522D',
  '1985': '#696969',
  '2005': '#DCDCDC',
  '2025': '#C0C0C0',
  '2055': '#404050',
}

export function Roads() {
  const { currentEra } = useEra()

  return (
    <group>
      {/* Main roads */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]} receiveShadow>
        <planeGeometry args={[60, 12]} />
        <meshStandardMaterial color={roadStyle[currentEra]} />
      </mesh>
      
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, -50]} receiveShadow>
        <planeGeometry args={[60, 12]} />
        <meshStandardMaterial color={roadStyle[currentEra]} />
      </mesh>

      {/* Sidewalks */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-32, 0.05, 0]} receiveShadow>
        <planeGeometry args={[4, 60]} />
        <meshStandardMaterial color={sidewalkStyle[currentEra]} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[32, 0.05, 0]} receiveShadow>
        <planeGeometry args={[4, 60]} />
        <meshStandardMaterial color={sidewalkStyle[currentEra]} />
      </mesh>

      {/* Crosswalks for later eras */}
      {(currentEra === '2005' || currentEra === '2025' || currentEra === '2055') && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
          <planeGeometry args={[4, 60]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.3} />
        </mesh>
      )}

      {/* Street lines */}
      {currentEra !== '1945' && (
        <>
          {Array.from({ length: 15 }).map((_, i) => (
            <mesh
              key={i}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0.11, i * 4 - 28]}
              receiveShadow
            >
              <planeGeometry args={[1, 2]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
          ))}
        </>
      )}
    </group>
  )
}