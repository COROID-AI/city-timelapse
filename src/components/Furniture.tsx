import React, { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { useEraStore } from '../store/eraStore'
import { VISUAL_ERA_DATA } from '../eras'

// Helper: convert hex color string to Three.js color number
const hexToColor = (hex: string): number => {
  const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex
  return parseInt(cleanHex, 16)
}

// ============ INSTANCED MESH HELPERS ============

/**
 * Creates an InstancedMesh for repeated chair elements.
 * Preserves individual positioning/rotation via instance matrix arrays.
 */
const createInstancedChairs = (count: number, color: string, era: EraId) => {
  const geometry = new THREE.BoxGeometry(0.4, 0.45, 0.45)
  const material = new THREE.MeshStandardMaterial({ color: hexToColor(color), roughness: 0.5, metalness: 0.2 })
  const mesh = new THREE.InstancedMesh(geometry, material, count)

  // Define instance positions/rotations based on era layout
  const positions: THREE.Vector3[] = []
  const rotations: number[] = []

  // Arrange in a simple café layout
  let idx = 0
  for (let row = 0; row < 2 && idx < count; row++) {
    for (let col = 0; col < 3 && idx < count; col++) {
      const x = -0.5 + col * 0.6
      const z = -0.8 + row * 0.9
      positions.push(new THREE.Vector3(x, 0.225, z))
      rotations.push(era === '1985' ? Math.PI / 2 * col : 0) // 1985 era has rotated chairs
      idx++
    }
  }

  // Set instance matrices
  const matrix = new THREE.Matrix4()
  for (let i = 0; i < count; i++) {
    matrix.makeTranslation(positions[i].x, positions[i].y, positions[i].z)
    if (rotations[i]) {
      matrix.rotateY(rotations[i])
    }
    mesh.setMatrixAt(i, matrix)
  }
  mesh.instanceMatrix.needsUpdate = true

  return mesh
}

/**
 * Creates an InstancedMesh for table legs (4 legs per table).
 */
const createInstancedTableLegs = (tableCount: number) => {
  const geometry = new THREE.CylinderGeometry(0.08, 0.08, 0.45, 8)
  const material = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.4, metalness: 0.4 })
  const mesh = new THREE.InstancedMesh(geometry, material, tableCount * 4)

  const matrix = new THREE.Matrix4()
  let idx = 0
  for (let t = 0; t < tableCount; t++) {
    // Table position
    const baseX = -1 + t * 2.5
    const baseZ = 1

    // Four legs around the table
    const legPositions = [
      { x: -0.6, z: -0.6 }, // front-left
      { x: 0.6, z: -0.6 },  // front-right
      { x: -0.6, z: 0.6 },  // back-left
      { x: 0.6, z: 0.6 },   // back-right
    ]

    for (const lp of legPositions) {
      matrix.makeTranslation(baseX + lp.x, 0.225, baseZ + lp.z)
      mesh.setMatrixAt(idx, matrix)
      idx++
    }
  }
  mesh.instanceMatrix.needsUpdate = true

  return mesh
}

/**
 * Creates an InstancedMesh for cups on tables.
 */
const createInstancedCups = (cupCount: number, color: string) => {
  const geometry = new THREE.ConeGeometry(0.08, 0.12, 12)
  const material = new THREE.MeshStandardMaterial({ color: hexToColor(color), roughness: 0.6, metalness: 0.1 })
  const mesh = new THREE.InstancedMesh(geometry, material, cupCount)

  const matrix = new THREE.Matrix4()
  let idx = 0
  // Distribute cups around the café area
  const rows = Math.ceil(cupCount / 6)
  for (let row = 0; row < rows && idx < cupCount; row++) {
    for (let col = 0; col < 6 && idx < cupCount; col++) {
      const x = (col - 2.5) * 0.3
      const z = row * 0.4 - 1
      matrix.makeTranslation(x, 0.1, z)
      mesh.setMatrixAt(idx, matrix)
      idx++
    }
  }
  mesh.instanceMatrix.needsUpdate = true

  return mesh
}

// ============ FURNITURE COMPONENTS ============

// Stool component - simple wooden stool
const Stool = ({ color }: { color: string }) => (
  <mesh castShadow receiveShadow>
    <cylinderGeometry args={[0.3, 0.3, 0.45]} />
    <meshStandardMaterial color={hexToColor(color)} roughness={0.7} metalness={0.1} />
    <position y={0.225} />
  </mesh>
)

// Simple wooden table - box geometry
const SimpleTable = ({ color }: { color: string }) => (
  <mesh castShadow receiveShadow>
    <boxGeometry args={[1.2, 0.75, 1.2]} />
    <meshStandardMaterial color={hexToColor(color)} roughness={0.6} metalness={0.1} />
    <position y={0.375} />
  </mesh>
)

// Metal-frame chair - NOW INSTANCED
const MetalChair = ({ color }: { color: string }, count: number = 20) => {
  const { scene } = useThree()
  const instancedMesh = createInstancedChairs(count, color, useEraStore.getState().currentEra as EraId)
  return instancedMesh
}

// Mid-century modern chair - NOW INSTANCED
const MidCenturyChair = ({ color }: { color: string }, count: number = 20) => {
  const { scene } = useThree()
  const instancedMesh = createInstancedChairs(count, color, useEraStore.getState().currentEra as EraId)
  // Apply mid-century specific rotation
  instancedMesh.rotation.y = Math.PI / 4
  return instancedMesh
}

// Booth seat - bench style (non-instanced, unique per booth)
const BoothBench = ({ color }: { color: string }) => (
  <mesh castShadow receiveShadow>
    <boxGeometry args={[2.0, 0.4, 0.45]} />
    <meshStandardMaterial color={hexToColor(color)} roughness={0.6} metalness={0.1} />
    <position y={0.225} />
  </mesh>
)

// Table with neon edge lighting - with instanced legs
const NeonTable = ({ color }: { color: string }, legCount: number = 4) => {
  const tableTop = (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[1.4, 0.7, 1.4]} />
      <meshStandardMaterial color={hexToColor(color)} roughness={0.5} emissive={0x111111} emissiveIntensity={0.2} />
      <position y={0.35} />
    </mesh>
  )

  const tableLegs = createInstancedTableLegs(1) // 1 table with 4 legs

  return <>[tableTop, tableLegs]</>
}

// Faux-wood paneling detail (non-instanced, unique detail)
const FauxWoodPaneling = ({ color }: { color: string }) => (
  <mesh castShadow receiveShadow>
    <boxGeometry args={[2.5, 2.5, 0.1]} />
    <meshStandardMaterial color={hexToColor(color)} roughness={0.9} />
    <position x={0} y={1.25} z={0} />
  </mesh>
)

// Disco ball accent (non-instanced, unique)
const DiscoBall = ({ color }: { color: string }) => (
  <mesh castShadow receiveShadow>
    <sphereGeometry args={[0.3]} />
    <meshStandardMaterial color={0xffd700} roughness={0.1} metalness={0.9} />
  </mesh>
)

// ============ ERA-SPECIFIC FURNITURE RENDERERS ============

const EraFurniture: React.FC = () => {
  const currentEra = useEraStore(s => s.currentEra) as EraId
  const eraData = VISUAL_ERA_DATA[currentEra]

  // Chair counts per era
  const chairCounts = {
    '1945': 16,
    '1965': 18,
    '1985': 20,
    '2005': 15,
    '2025': 12,
  }

  const cupCounts = {
    '1945': 8,
    '1965': 10,
    '1985': 12,
    '2005': 15,
    '2025': 18,
  }

  const cupsInstanced = currentEra === '2025' ? createInstancedCups(cupCounts[currentEra] || 18, '#ffe4b5') : null

  return (
    <>
      <MetalChair color={eraData.tablewareStyle === 'china_plates' ? '#8B4513' : '#c0c0c0'} count={chairCounts[currentEra] || 16} />
      <MidCenturyChair color={eraData.tablewareStyle === 'plastic_colored' ? '#ff44cc' : '#e0e0e0'} count={chairCounts[currentEra] || 16} />
      <NeonTable color={eraData.ambientLightColor || '#ffffff'} legCount={4} />
      {cupsInstanced}
    </>
  )
}

export { MetalChair, MidCenturyChair, SimpleTable, BoothBench, NeonTable, FauxWoodPaneling, DiscoBall, EraFurniture }