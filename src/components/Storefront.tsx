import React, { useRef, useEffect, useState } from 'react';
import { Era } from '../contexts/EraContext';
import * as THREE from 'three';

interface StorefrontProps {
  id: string;
  x: number;
  z: number;
  era: Era;
}

export const Storefront: React.FC<StorefrontProps> = ({ id, x, z, era }) => {
  const [scale, setScale] = useState(0.5);

  // Animate storefront appearance
  useEffect(() => {
    setScale(0.5);
    
    const startTime = Date.now();
    const duration = 1500;
    const delay = 500;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed < delay) {
        requestAnimationFrame(animate);
        return;
      }
      
      const progress = Math.min((elapsed - delay) / duration, 1);
      const newScale = 0.5 + progress * 0.5;
      setScale(newScale);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    const timeoutId = setTimeout(animate, 0);
    return () => clearTimeout(timeoutId);
  }, [era]);

  return (
    <group scale={[scale, scale, scale]} position={[x, 0, z]}>
      {era === 1945 && <ArtDecoStorefront />}
      {era === 1965 && <MidCenturyStorefront />}
      {era === 1985 && <BrutalistStorefront />}
      {era === 2005 && <ModernStorefront />}
      {era === 2025 && <ContemporaryStorefront />}
      {era === 2055 && <FutureStorefront />}
    </group>
  );
};

// 1945 Art Deco Storefront
const ArtDecoStorefront: React.FC = () => (
  <group position={[0, 4, 4.5]}>
    {/* Building base */}
    <mesh>
      <boxGeometry args={[5, 8, 0.5]} />
      <meshBasicMaterial color="#8B7355" />
    </mesh>
    {/* Display windows */}
    <mesh position={[0, 3, 4.3]}>
      <boxGeometry args={[4, 2, 0.2]} />
      <meshBasicMaterial color="#4A90E2" />
    </mesh>
    {/* Entry door */}
    <mesh position={[0, 1, 4.3]}>
      <boxGeometry args={[1.5, 2.5, 0.3]} />
      <meshBasicMaterial color="#8B4513" />
    </mesh>
    {/* Signage - neon style */}
    <mesh position={[0, 6.5, 4.3]}>
      <boxGeometry args={[3, 0.5, 0.1]} />
      <meshBasicMaterial color="#FF69B4" />
    </mesh>
    {/* Decorative elements */}
    <mesh position={[0, 5.5, 4.3]}>
      <boxGeometry args={[0.2, 1, 0.1]} />
      <meshBasicMaterial color="#FFD700" />
    </mesh>
  </group>
);

// 1965 Mid-Century Storefront
const MidCenturyStorefront: React.FC = () => (
  <group position={[0, 6, 5.5]}>
    {/* Large glass panel */}
    <mesh>
      <boxGeometry args={[6, 12, 0.3]} />
      <meshBasicMaterial color="#87CEEB" />
    </mesh>
    {/* Modern signage */}
    <mesh position={[0, 8, 4.85]}>
      <boxGeometry args={[4, 1, 0.1]} />
      <meshBasicMaterial color="#FF4500" />
    </mesh>
    {/* Geometric patterns */}
    <mesh position={[0, 5, 4.85]}>
      <boxGeometry args={[3, 2, 0.1]} />
      <meshBasicMaterial color="#FFFF00" />
    </mesh>
  </group>
);

// 1985 Brutalist Storefront
const BrutalistStorefront: React.FC = () => (
  <group position={[0, 10, 6.5]}>
    {/* Raw concrete */}
    <mesh>
      <boxGeometry args={[8, 20, 0.5]} />
      <meshBasicMaterial color="#718096" />
    </mesh>
    {/* Small windows */}
    {[-2.5, 0, 2.5].map((y, i) => (
      <mesh key={i} position={[0, y, 4.3]}>
        <boxGeometry args={[3, 1.5, 0.2]} />
        <meshBasicMaterial color="#2D3748" />
      </mesh>
    ))}
    {/* Minimalist signage */}
    <mesh position={[0, 12, 4.3]}>
      <boxGeometry args={[4, 0.8, 0.1]} />
      <meshBasicMaterial color="#FFFFFF" />
    </mesh>
  </group>
);

// 2005 Modern Storefront
const ModernStorefront: React.FC = () => (
  <group position={[0, 15, 8]}>
    {/* Glass and steel */}
    <mesh>
      <boxGeometry args={[10, 30, 0.3]} />
      <meshBasicMaterial color="#E2E8F0" />
    </mesh>
    {/* LED display */}
    <mesh position={[0, 18, 7.85]}>
      <boxGeometry args={[5, 2, 0.1]} />
      <meshBasicMaterial color="#00FFAA" />
    </mesh>
    {/* Glass doors */}
    {[-1.5, 1.5].map((x, i) => (
      <mesh key={i} position={[x, 6, 7.85]}>
        <boxGeometry args={[2, 4, 0.2]} />
        <meshBasicMaterial color="#87CEEB" />
      </mesh>
    ))}
  </group>
);

// 2025 Contemporary Storefront
const ContemporaryStorefront: React.FC = () => (
  <group position={[0, 12, 7]}>
    {/* Mixed-use - residential above */}
    <mesh>
      <boxGeometry args={[12, 24, 0.3]} />
      <meshBasicMaterial color="#90EE90" />
    </mesh>
    {/* Green wall */}
    <mesh position={[0, 10, 7.15]}>
      <boxGeometry args={[8, 8, 0.1]} />
      <meshBasicMaterial color="#228B22" />
    </mesh>
    {/* Modern digital signage */}
    <mesh position={[0, 16, 7.15]}>
      <boxGeometry args={[6, 1.5, 0.05]} />
      <meshBasicMaterial color="#FFFFFF" />
    </mesh>
  </group>
);

// 2055 Future Storefront
const FutureStorefront: React.FC = () => (
  <group position={[0, 25, 5]}>
    {/* Holographic structure */}
    <mesh>
      <boxGeometry args={[8, 50, 0.5]} />
      <meshBasicMaterial color="#00BFFF" />
    </mesh>
    {/* Hologram displays */}
    <mesh position={[0, 35, 5.3]}>
      <boxGeometry args={[4, 3, 0.1]} />
      <meshBasicMaterial color="#00FFFF" />
    </mesh>
    {/* Floating shop displays */}
    {[15, 25, 35].map((y, i) => (
      <mesh key={i} position={[0, y, 5.2]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial color="#FF69B4" />
      </mesh>
    ))}
  </group>
);