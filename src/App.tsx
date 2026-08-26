import { Canvas } from '@react-three/fiber';
import { TimelineSlider } from './components/TimelineSlider';
import { SceneRoot } from './scene/SceneRoot';

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'fixed',
    inset: 0,
    overflow: 'hidden',
  },
};

/**
 * Application shell. The 3D scene (owned by the composition root SceneRoot) is
 * mounted beneath the top timeline slider. The slider sits at the top of the
 * viewport and drives the shared era timeline store.
 */
export function App() {
  return (
    <div style={styles.root}>
      <TimelineSlider />
      <Canvas
        camera={{ position: [0, 26, 60], fov: 60 }}
        gl={{ antialias: true }}
        shadows
      >
        <SceneRoot />
      </Canvas>
    </div>
  );
}