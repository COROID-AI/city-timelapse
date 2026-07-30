import React from 'react';
import * as THREE from 'three';
import { EraConfig } from '../data/eraData';

interface StorefrontProps {
  position: [number, number, number];
  width: number;
  config: EraConfig;
  seed: number;
}

const Storefront: React.FC<StorefrontProps> = React.memo(({ position, width, config, seed }) => {
  const numWindows = Math.max(2, Math.floor(width / 2));
  const windowSpacing = width / (numWindows + 1);

  return (
    <group position={position}>
      {/* Store base */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <boxGeometry args={[width, 2.4, 1.5]} />
        <meshStandardMaterial color={config.storefrontColor} roughness={0.6} metalness={0.2} />
      </mesh>
      {/* Awning for post-1985 */}
      {config.year >= 1985 && (
        <mesh position={[0, 2.6, 0]}>
          <boxGeometry args={[width + 0.5, 0.15, 0.3]} />
          <meshStandardMaterial color={config.storefrontSignColor} roughness={0.5} flatShading />
        </mesh>
      )}
      {/* Storefront windows */}
      {config.year >= 1965 && Array.from({ length: numWindows }, (_, i) => (
        <mesh key={`sw-${i}`} position={[-(numWindows - 1) * windowSpacing / 2 + i * windowSpacing, 1.8, 0.76]}>
          <boxGeometry args={[0.5, 1.0, 0.05]} />
          <meshStandardMaterial
            color={0x88bbdd}
            emissive={config.storefrontSignColor}
            emissiveIntensity={0.4}
            roughness={0.1}
          />
        </mesh>
      ))}
      {/* Neon sign for future eras */}
      {config.year >= 2025 && (
        <mesh position={[0, 3.2, 0]}>
          <boxGeometry args={[width * 0.7, 0.3, 0.04]} />
          <meshStandardMaterial
            color={config.storefrontSignColor}
            emissive={config.storefrontSignColor}
            emissiveIntensity={1.0}
          />
        </mesh>
      )}
      {/* Door */}
      <mesh position={[0, 0.8, 0.76]}>
        <boxGeometry args={[0.6, 1.6, 0.05]} />
        <meshStandardMaterial color={0x332211} roughness={0.8} />
      </mesh>
    </group>
  );
});

export default Storefront;
