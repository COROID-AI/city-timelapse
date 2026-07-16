import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export const FilmGrain: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null!)

  const shaderMaterial = useMemo(() => {
    const noiseSize = 256
    const noiseData = new Uint8Array(3 * noiseSize * noiseSize)
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 255
    }
    const noiseTexture = new THREE.DataTexture(noiseData, noiseSize, noiseSize, THREE.RGBFormat)
    noiseTexture.needsUpdate = true

    return new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null as unknown as THREE.Texture },
        tNoise: { value: noiseTexture },
        noiseScale: { value: 1.0 },
        time: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D tNoise;
        uniform float noiseScale;
        uniform float time;
        varying vec2 vUv;
        
        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          vec2 noiseUv = vUv * noiseScale + time;
          vec3 noise = texture2D(tNoise, noiseUv).rgb;
          color.rgb += (noise - 0.5) * 0.05;
          gl_FragColor = color;
        }
      `,
    })
  }, [])

  useFrame(({ clock }) => {
    if (shaderMaterial.uniforms) {
      shaderMaterial.uniforms.time.value = clock.getElapsedTime()
    }
  })

  return (
    <mesh ref={meshRef} position={[0, 0, 1]} scale={[2, 2, 1]}>
      <planeGeometry args={[2, 2]} />
      <primitive object={shaderMaterial} attach="material" />
    </mesh>
  )
}