import React, { useMemo } from 'react'
import * as THREE from 'three'
import type { EraPalette } from '../eras'

interface BuildingProps {
  args: [number, number, number]
  palette: EraPalette
  index: number
  position: [number, number, number]
}

export function Building({ args: [w, h, d], palette, index, position }: BuildingProps) {
  const safeW = Math.max(0.1, w)
  const safeH = Math.max(0.1, h)
  const safeD = Math.max(0.1, d)

  const { geometry, winGeo, bodyMat, winMat } = useMemo(() => {
    const geo = new THREE.BoxGeometry(safeW, safeH, safeD)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: palette.buildingColor, roughness: 0.7, metalness: 0.3,
    })
    const winMat = new THREE.MeshStandardMaterial({
      color: palette.windowColor,
      emissive: palette.windowEmissive,
      emissiveIntensity: palette.windowEmissiveIntensity,
      roughness: 0.2,
      metalness: 0.8,
    })
    const winGeo = new THREE.PlaneGeometry(Math.max(0.01, 0.7), Math.max(0.01, 0.7))
    return { geometry: geo, winGeo, bodyMat, winMat }
  }, [safeW, safeH, safeD, palette])

  const windows = useMemo(() => {
    const cols = Math.max(1, Math.floor(safeW / 1.3))
    const rows = Math.max(1, Math.floor(safeH / 1.3))
    const spacingX = safeW / (cols + 1)
    const spacingY = safeH / (rows + 1)
    const result: Array<{ pos: THREE.Vector3; rot: THREE.Euler }> = []

    // Front face (-Z)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        result.push({
          pos: new THREE.Vector3(
            -safeW / 2 + spacingX * (c + 1),
            -safeH / 2 + spacingY * (r + 1),
            safeD / 2 + 0.02
          ),
          rot: new THREE.Euler(0, 0, 0),
        })
      }
    }
    // Back face
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        result.push({
          pos: new THREE.Vector3(
            -safeW / 2 + spacingX * (c + 1),
            -safeH / 2 + spacingY * (r + 1),
            -safeD / 2 - 0.02
          ),
          rot: new THREE.Euler(0, Math.PI, 0),
        })
      }
    }
    // Left face (-X)
    const leftCols = Math.max(1, Math.floor(cols * 0.7))
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < leftCols; c++) {
        result.push({
          pos: new THREE.Vector3(
            -safeW / 2 - 0.02,
            -safeH / 2 + spacingY * (r + 1),
            -safeD / 2 + safeD * (c + 1) / (leftCols + 1)
          ),
          rot: new THREE.Euler(0, Math.PI / 2, 0),
        })
      }
    }
    // Right face (+X)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < leftCols; c++) {
        result.push({
          pos: new THREE.Vector3(
            safeW / 2 + 0.02,
            -safeH / 2 + spacingY * (r + 1),
            -safeD / 2 + safeD * (c + 1) / (leftCols + 1)
          ),
          rot: new THREE.Euler(0, -Math.PI / 2, 0),
        })
      }
    }
    // Roof line accent lights for modern/future eras
    if (h > 25) {
      for (let c = 0; c < cols; c++) {
        result.push({
          pos: new THREE.Vector3(
            -safeW / 2 + spacingX * (c + 1),
            safeH / 2 + 0.02,
            0
          ),
          rot: new THREE.Euler(0, 0, 0),
        })
      }
    }

    return result
  }, [safeW, safeH, safeD, h])

  return (
    <group position={position}>
      <mesh castShadow receiveShadow geometry={geometry} material={bodyMat} />
      {windows.map((win, i) => (
        <mesh key={`w-${index}-${i}`} position={win.pos} rotation={win.rot}>
          <primitive attach="geometry" object={winGeo} />
          <primitive attach="material" object={winMat} />
        </mesh>
      ))}
    </group>
  )
}