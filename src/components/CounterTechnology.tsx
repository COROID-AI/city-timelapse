import React from 'react'
import { useEraStore } from '../store/eraStore'
import { EraId } from '../eras'

// @react-three/fiber doesn't export a `Group` component in all versions.
// We only need the JSX `group` node, so we provide a small compatibility
// wrapper and keep the existing JSX markup intact.
const Group: React.FC<any> = (props) => <group {...props} />

/**
 * CounterTechnology - Renders era-appropriate payment and POS technology
 * at the café counter based on currentEra.
 *
 * Each era displays distinctly different equipment:
 * - 1945: Manual wooden cash register with keys, paper receipts, coin slots, bell ring
 * - 1965: Electronic dot-matrix till, magnetic stripe card reader, paper receipt printer, calculator
 * - 1985: CRT monitor POS terminal, barcode scanner, credit card swipe machine, thermal receipt printer
 * - 2005: Flat-screen touchscreen POS system, chip card reader, early contactless NFC pad, digital menu display
 * - 2025: Tablet-based POS, wireless contactless payment terminals (Apple Pay/Google Pay/NFC symbols),
 *         QR code ordering stations, digital tip jar screen, smart inventory display
 *
 * Uses Three.js primitives only - no external model imports.
 * Screen elements use emissive materials with era-appropriate colors.
 */

// ------------------------------------------------------------
// 2025: Simple contactless icon primitives (no textures/models)
// ------------------------------------------------------------

const ContactlessNfcIcon = ({ color = 0x00aaff }: { color?: number }) => (
  <group>
    {/* Central wave */}
    <mesh>
      <torusGeometry args={[0.06, 0.004, 10, 24, Math.PI]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
      <rotation z={Math.PI / 2} />
    </mesh>
    {/* Outer waves */}
    <mesh>
      <torusGeometry args={[0.09, 0.004, 10, 24, Math.PI]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      <rotation z={Math.PI / 2} />
    </mesh>
    <mesh>
      <torusGeometry args={[0.09, 0.004, 10, 24, Math.PI]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      <rotation z={Math.PI / 2} />
      <rotation y={Math.PI} />
    </mesh>
  </group>
)

const ApplePayMark = ({ color = 0xffffff }: { color?: number }) => (
  <group>
    {/* leaf */}
    <mesh rotation={[0, 0, Math.PI / 2]}>
      <sphereGeometry args={[0.02, 16, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      
    </mesh>
    <mesh rotation={[0, 0, Math.PI / 2]}>
      <sphereGeometry args={[0.018, 16, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      
    </mesh>
    {/* stem */}
    <mesh>
      <cylinderGeometry args={[0.004, 0.004, 0.05]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} />
      
    </mesh>
    {/* small bite notch hint */}
    <mesh>
      <boxGeometry args={[0.016, 0.006, 0.006]} />
      <meshStandardMaterial color={0x000000} transparent opacity={0.35} />
      
    </mesh>
  </group>
)

const GooglePayMark = ({ color = 0x00c853 }: { color?: number }) => (
  <group>
    {/* G arc */}
    <mesh>
      <torusGeometry args={[0.055, 0.006, 14, 28, (Math.PI * 2) * 0.74]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
    </mesh>
    {/* G inner bar */}
    <mesh>
      <boxGeometry args={[0.02, 0.012, 0.006]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      
    </mesh>
  </group>
)

const CounterTechnology = ({ era }: { era?: EraId }) => {
  const { currentEra } = useEraStore()
  const activeEra = era || currentEra || '1945'

  // Render era-specific technology equipment on the counter
  switch (activeEra) {
    case '1945': {
      return (
        <Group position={[0, 1.225, 5.5]}>
          {/* Base/body: wooden cash register */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.6, 0.25, 0.4]} />
            <meshStandardMaterial
              color={0x8b5a2b}
              roughness={0.6}
              metalness={0.1}
            />
          </mesh>

          {/* Drawer unit */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.5, 0.15, 0.3]} />
            <meshStandardMaterial
              color={0x5d4037}
              roughness={0.5}
              metalness={0.15}
            />
          </mesh>

          {/* Keys on top panel */}
          {Array.from({ length: 12 }, (_, i) => (
            <mesh key={i} castShadow receiveShadow>
              <boxGeometry args={[0.04, 0.04, 0.08]} />
              <meshStandardMaterial
                color={0xffffff}
                roughness={0.8}
                metalness={0.3}
              />
              
            </mesh>
          ))}

          {/* Coin slot */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.3, 0.03, 0.2]} />
            <meshStandardMaterial color={0xffffff} roughness={0.3} />
            
          </mesh>

          {/* Paper roll holder */}
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.1, 0.15, 0.4]} />
            <meshStandardMaterial color={0x8b5a2b} roughness={0.7} />
            
          </mesh>

          {/* Bell mechanism */}
          <mesh castShadow receiveShadow>
            <sphereGeometry args={[0.08]} />
            <meshStandardMaterial color={0xffffff} roughness={0.5} />
            
            <cylinderGeometry args={[0.02, 0.02, 0.3]} />
            <meshStandardMaterial color={0xffffff} roughness={0.5} />
            
          </mesh>
        </Group>
      )
    }
    case '1965': {
      return (
        <Group position={[0, 1.2, 5.5]}>
          {/* Main till body: sleek electronic design */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.5, 0.2, 0.35]} />
            <meshStandardMaterial
              color={0x2c3e50}
              roughness={0.5}
              metalness={0.2}
            />
          </mesh>

          {/* Dot-matrix display section */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.5, 0.1, 0.2]} />
            <meshStandardMaterial
              color={0x1a1a1a}
              emissive={0x2a2a2a}
              emissiveIntensity={0.5}
              roughness={0.3}
            />
          </mesh>

          {/* Dot matrix grid pattern on display */}
          {Array.from({ length: 100 }, (_, i) => (
            <mesh key={i} castShadow receiveShadow>
              <boxGeometry args={[0.02, 0.02, 0.02]} />
              <meshStandardMaterial color={0x00ff00} emissive={0x00ff00} emissiveIntensity={0.3} />
              
            </mesh>
          ))}

          {/* Magnetic stripe card reader */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.45, 0.05, 0.15]} />
            <meshStandardMaterial color={0x34495e} roughness={0.4} metalness={0.3} />
            
          </mesh>

          {/* Card swipe slot */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.35, 0.03, 0.1]} />
            <meshStandardMaterial color={0xffffff} roughness={0.3} />
            
          </mesh>

          {/* Paper receipt printer */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.4, 0.1, 0.2]} />
            <meshStandardMaterial color={0x2c3e50} roughness={0.5} metalness={0.2} />
            
          </mesh>

          {/* Paper rolls */}
          {Array.from({ length: 20 }, (_, i) => (
            <mesh key={i} castShadow receiveShadow>
              <boxGeometry args={[0.03, 0.01, 0.15]} />
              <meshStandardMaterial color={0x000000} roughness={0.5} />
              
            </mesh>
          ))}

          {/* Basic calculator */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.25, 0.1, 0.15]} />
            <meshStandardMaterial color={0xecf0f1} roughness={0.4} />
            
          </mesh>

          {/* Calculator buttons */}
          {Array.from({ length: 16 }, (_, i) => (
            <mesh key={i} castShadow receiveShadow>
              <boxGeometry args={[0.04, 0.04, 0.04]} />
              <meshStandardMaterial color={0x2c3e50} emissive={0x2c3e50} emissiveIntensity={0.2} />
              
            </mesh>
          ))}
        </Group>
      )
    }
    case '1985': {
      return (
        <Group position={[0, 1.275, 5.5]}>
          {/* CRT monitor frame */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.5, 0.35, 0.4]} />
            <meshStandardMaterial
              color={0x444444}
              roughness={0.4}
              metalness={0.1}
            />
          </mesh>

          {/* CRT screen with amber glow */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.45, 0.3, 0.3]} />
            <meshStandardMaterial
              color={0x000000}
              emissive={0xffa500}
              emissiveIntensity={0.4}
              roughness={0.3}
            />
          </mesh>

          {/* Scan lines effect */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.46, 0.01, 0.31]} />
            <meshStandardMaterial color={0x333333} transparency={0.3} opacity={0.3} />
          </mesh>

          {/* Barcode scanner (top) */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.3, 0.08, 0.15]} />
            <meshStandardMaterial color={0x333333} roughness={0.5} metalness={0.3} />
            
          </mesh>

          {/* Laser window */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.2, 0.03, 0.1]} />
            <meshStandardMaterial color={0x555555} roughness={0.3} />
            
          </mesh>

          {/* Credit card swipe machine */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.35, 0.12, 0.2]} />
            <meshStandardMaterial color={0x2c3e50} roughness={0.5} metalness={0.3} />
            
          </mesh>

          {/* Card slot */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.25, 0.05, 0.1]} />
            <meshStandardMaterial color={0xffffff} roughness={0.3} />
            
          </mesh>

          {/* Thermal receipt printer */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.35, 0.15, 0.25]} />
            <meshStandardMaterial color={0x333333} roughness={0.5} metalness={0.2} />
            
          </mesh>

          {/* Paper rolls */}
          {Array.from({ length: 15 }, (_, i) => (
            <mesh key={i} castShadow receiveShadow>
              <boxGeometry args={[0.03, 0.015, 0.2]} />
              <meshStandardMaterial color={0x000000} roughness={0.5} />
              
            </mesh>
          ))}
        </Group>
      )
    }
    case '2005': {
      return (
        <Group position={[0, 1.2, 5.5]}>
          {/* Main POS terminal base */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.5, 0.2, 0.3]} />
            <meshStandardMaterial
              color={0xecf0f1}
              roughness={0.5}
              metalness={0.1}
            />
          </mesh>

          {/* Flat LCD touchscreen */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.45, 0.25, 0.1]} />
            <meshStandardMaterial
              color={0x1a1a2e}
              emissive={0xffffff}
              emissiveIntensity={0.3}
              roughness={0.2}
            />
          </mesh>

          {/* Menu items on digital display */}
          {Array.from({ length: 4 }, (_, i) => (
            <mesh key={i} castShadow receiveShadow>
              <boxGeometry args={[0.08, 0.04, 0.02]} />
              <meshStandardMaterial color={0x00ff00} emissive={0x00ff00} emissiveIntensity={0.1} />
              
            </mesh>
          ))}

          {/* Chip card reader */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.3, 0.1, 0.15]} />
            <meshStandardMaterial color={0x34495e} roughness={0.4} metalness={0.3} />
            
          </mesh>

          {/* Contactless NFC pad */}
          <mesh castShadow receiveShadow>
            <circleGeometry args={[0.15]} />
            <meshStandardMaterial
              color={0x3498db}
              emissive={0x3498db}
              emissiveIntensity={0.2}
              roughness={0.3}
            />
            
          </mesh>

          {/* Early contactless symbol */}
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} castShadow receiveShadow>
              <circleGeometry args={[0.03]} />
              <meshStandardMaterial color={0xffffff} />
              
            </mesh>
          ))}

          {/* Digital menu display overlay */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.35, 0.1, 0.05]} />
            <meshStandardMaterial color={0x1a1a2e} opacity={0.8} transparent={true} />
            
          </mesh>
        </Group>
      )
    }
    case '2025': {
      return (
        <Group position={[0, 1.25, 5.5]}>
          {/* Sleek tablet POS unit */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.4, 0.3, 0.15]} />
            <meshStandardMaterial
              color={0x2c3e50}
              roughness={0.3}
              metalness={0.1}
            />
          </mesh>

          {/* High-res touchscreen display */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.35, 0.25, 0.05]} />
            <meshStandardMaterial
              color={0x1a1a2e}
              emissive={0xffffff}
              emissiveIntensity={0.4}
              roughness={0.1}
            />
          </mesh>

          {/* Digital menu items scrolling on display */}
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} castShadow receiveShadow>
              <boxGeometry args={[0.06, 0.03, 0.01]} />
              <meshStandardMaterial color={0x00d4ff} emissive={0x00d4ff} emissiveIntensity={0.1} />
              
            </mesh>
          ))}

          {/* Wireless contactless payment terminals (icons recognizable) */}
          <group>
            {/* Apple Pay terminal */}
            <mesh castShadow receiveShadow position={[-0.06, 0.05, 0.2]}>
              <sphereGeometry args={[0.095]} />
              <meshStandardMaterial color={0x3498db} emissive={0x3498db} emissiveIntensity={0.35} roughness={0.2} />
              <group position={[0, 0, 0.03]}>
                <ApplePayMark color={0xffffff} />
              </group>
            </mesh>

            {/* Google Pay terminal */}
            <mesh castShadow receiveShadow position={[0.14, 0.05, 0.2]}>
              <sphereGeometry args={[0.095]} />
              <meshStandardMaterial color={0x3498db} emissive={0x3498db} emissiveIntensity={0.35} roughness={0.2} />
              <group position={[0, 0, 0.03]}>
                <GooglePayMark color={0x00c853} />
              </group>
            </mesh>

            {/* NFC terminal */}
            <mesh castShadow receiveShadow position={[0.02, 0.05, 0.34]}>
              <sphereGeometry args={[0.09]} />
              <meshStandardMaterial color={0x3498db} emissive={0x3498db} emissiveIntensity={0.35} roughness={0.2} />
              <group position={[0, 0, 0.03]}>
                <ContactlessNfcIcon color={0x00aaff} />
              </group>
            </mesh>
          </group>

          {/* QR code ordering station */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.2, 0.2, 0.05]} />
            <meshStandardMaterial
              color={0xecf0f1}
              emissive={0x3498db}
              emissiveIntensity={0.2}
              roughness={0.3}
            />
            
          </mesh>

          {/* QR pattern squares */}
          {Array.from({ length: 36 }, (_, i) => (
            <mesh key={i} castShadow receiveShadow>
              <boxGeometry args={[0.02, 0.02, 0.01]} />
              <meshStandardMaterial color={0x2c3e50} />
              
            </mesh>
          ))}

          {/* Digital tip jar screen */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.2, 0.15, 0.08]} />
            <meshStandardMaterial
              color={0x1a1a2e}
              emissive={0x00ff88}
              emissiveIntensity={0.3}
              roughness={0.2}
            />
            
          </mesh>

          {/* Tip amount buttons */}
          {Array.from({ length: 3 }, (_, i) => (
            <mesh key={i} castShadow receiveShadow>
              <boxGeometry args={[0.08, 0.04, 0.03]} />
              <meshStandardMaterial color={0x00ff88} emissive={0x00ff88} emissiveIntensity={0.1} />
              
            </mesh>
          ))}

          {/* Smart inventory display */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.15, 0.1, 0.03]} />
            <meshStandardMaterial color={0x3498db} opacity={0.6} transparent={true} />
            
          </mesh>
        </Group>
      )
    }
    default: {
      return (
        <Group>
          {/* Base/body: wooden cash register */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.6, 0.25, 0.4]} />
            <meshStandardMaterial
              color={0x8b5a2b}
              roughness={0.6}
              metalness={0.1}
            />
          </mesh>

          {/* Drawer unit */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.5, 0.15, 0.3]} />
            <meshStandardMaterial
              color={0x5d4037}
              roughness={0.5}
              metalness={0.15}
            />
          </mesh>

          {/* Keys on top panel */}
          {Array.from({ length: 12 }, (_, i) => (
            <mesh key={i} castShadow receiveShadow>
              <boxGeometry args={[0.04, 0.04, 0.08]} />
              <meshStandardMaterial
                color={0xffffff}
                roughness={0.8}
                metalness={0.3}
              />
              
            </mesh>
          ))}

          {/* Coin slot */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.3, 0.03, 0.2]} />
            <meshStandardMaterial color={0xffffff} roughness={0.3} />
            
          </mesh>

          {/* Paper roll holder */}
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.1, 0.15, 0.4]} />
            <meshStandardMaterial color={0x8b5a2b} roughness={0.7} />
            
          </mesh>

          {/* Bell mechanism */}
          <mesh castShadow receiveShadow>
            <sphereGeometry args={[0.08]} />
            <meshStandardMaterial color={0xffffff} roughness={0.5} />
            
            <cylinderGeometry args={[0.02, 0.02, 0.3]} />
            <meshStandardMaterial color={0xffffff} roughness={0.5} />
            
          </mesh>
        </Group>
      )
    }
  }
}

export { CounterTechnology }