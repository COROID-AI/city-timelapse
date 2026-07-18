import * as THREE from 'three'

declare module '@react-three/fiber' {
  interface ThreeElements {
    meshStandardMaterial: any
    meshBasicMaterial: any
    pointsMaterial: any
    meshPhongMaterial: any
    meshPhysicalMaterial: any
    bufferAttribute: any
  }
}