import { useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { TimelineSlider } from './components/TimelineSlider';
import { Buildings } from './city/buildings';
import { useEraTimeline } from './store/eraTimeline';

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'fixed',
    inset: 0,
    overflow: 'hidden',
  },
};

/**
 * Drives the shared era timeline transition clock each frame and forwards it to
 * the building subsystem so heights, materials and windows morph in sync.
 */
function Scene() {
  const buildings = useMemo(() => new Buildings(), []);
  useEffect(() => () => buildings.dispose(), [buildings]);

  useFrame((_, delta) => {
    useEraTimeline.getState().transitionTick(delta);
    buildings.update(delta);
  });

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[12, 24, 14]} intensity={1.4} />
      <primitive object={buildings.group} />
      <OrbitControls enableDamping target={[0, 8, 0]} />
    </>
  );
}

/**
 * Application shell. The 3D scene (owned by the composition root later) is
 * mounted beneath the top timeline slider. The slider sits at the top of the
 * viewport and drives the shared era timeline store.
 */
export function App() {
  return (
    <div style={styles.root}>
      <TimelineSlider />
      <Canvas
        camera={{ position: [0, 22, 42], fov: 60 }}
        gl={{ antialias: true }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}