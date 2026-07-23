import { useMemo, useRef } from 'react'
import { useFrame, extend } from '@react-three/fiber'
import { ShaderMaterial, Color, BackSide } from 'three'
import { EraTheme } from '../era/theme'

// Vertex shader for a full-screen sky dome
const skyVert = `
varying vec3 vWorldPos;
void main() {
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// Fragment shader: vertical gradient with optional horizon glow
const skyFrag = `
uniform vec3 skyTop;
uniform vec3 skyBottom;
uniform float time;
varying vec3 vWorldPos;

void main() {
  float t = normalize(vWorldPos).y * 0.5 + 0.5;
  t = clamp(t, 0.0, 1.0);
  vec3 color = mix(skyBottom, skyTop, t);

  // Subtle cloud-like noise
  float n = fract(sin(dot(vWorldPos.xz, vec2(12.9898, 78.233)) + time * 0.02) * 43758.5453);
  color += n * 0.015;

  gl_FragColor = vec4(color, 1.0);
}
`

type SkyProps = {
  theme: EraTheme
}

/**
 * Procedural sky dome using a custom shader. No external textures or assets.
 * The gradient colors are driven by the era theme.
 */
export function Sky({ theme }: SkyProps) {
  const meshRef = useRef<any>(null!)

  const material = useMemo(() => {
    return new ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      uniforms: {
        skyTop: { value: theme.skyTop },
        skyBottom: { value: theme.skyBottom },
        time: { value: 0 },
      },
      side: BackSide,
      depthWrite: false,
    })
  }, [])

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.material.uniforms.time.value = state.clock.elapsedTime
      meshRef.current.material.uniforms.skyTop.value = theme.skyTop
      meshRef.current.material.uniforms.skyBottom.value = theme.skyBottom
    }
  })

  return (
    <mesh ref={meshRef} scale={[50, 50, 50]}>
      <sphereGeometry args={[1, 32, 32]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}
