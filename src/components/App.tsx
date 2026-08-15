import React, { ReactElement, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useResize } from '@react-three/drei';
import { GridHelper } from 'three';
import { TimelineSlider } from './TimelineSlider';
import { AtmosphereSystem } from '../systems/AtmosphereSystem';
import { TablewareLighting } from './TablewareLighting';
import { Patrons } from './Patrons';
import { CafeShell } from './CafeShell';

// Loading indicator component shown during initial scene build-out
const LoadingIndicator: React.FC = () => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(20, 20, 20, 0.8)',
        backdropFilter: 'blur(8px)',
        '-webkit-backdrop-filter': 'blur(8px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '16px',
        zIndex: 999,
        color: 'white',
      }}
    >
      <div style={{ fontSize: '24px' }}>Loading scene...</div>
      <div
        style={{
          border: '3px solid #ffd700',
          borderTop: '3px solid transparent',
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <p style={{ margin: '0' }} style={{ fontSize: '14px' }}>
        Initializing time periods...
      </p>
    </div>
  );
};

/* Keyframe for spin animation */
const spin = `
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

export const App: React.FC = (): ReactElement => {
  // Resize hook from drei - handles canvas responsiveness
  useResize();

  useEffect(() => {
    // Document body overflow hidden to prevent scrollbars
    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
    document.body.style.padding = '0';

    return () => {
      document.body.style.overflow = '';
      document.body.style.margin = '';
      document.body.style.padding = '';
    };
  }, []);

  return (
    <>
      <LoadingIndicator />

      <Canvas
        style={{
          width: '100%',
          height: '100%',
        }}
      >
        {/* OrbitControls with constrained navigation */}
        <OrbitControls
          enableDamping={true}
          dampingFactor={0.08}
          minDistance={1.5}
          maxDistance={15}
          minPolarAngle={Math.PI / 6} // Prevents camera from clipping through floor
          maxPolarAngle={(5 * Math.PI) / 6} // Prevents camera from going below the floor/ground
          enablePan={false}
          screenSpacePanning={false}
        />

        {/* Grid helper for spatial grounding */}
        <GridHelper size={10} color="0x444444" divideCount={10} opacity={0.5} />

        {/* Era-specific fog + lighting temperature + ambient color */}
        <AtmosphereSystem />

        {/* Café interior shell - permanent architectural container */}
        <CafeShell />

        {/* Era-specific tableware and lighting fixtures */}
        <TablewareLighting />

        {/* Era-specific patron figures */}
        <Patrons />

        {/* Timeline slider for era selection */}
        <TimelineSlider />
      </Canvas>
    </>
  );
};