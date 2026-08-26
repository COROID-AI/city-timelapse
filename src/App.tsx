import { Canvas } from '@react-three/fiber';
import { TimelineSlider } from './components/TimelineSlider';

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'fixed',
    inset: 0,
    overflow: 'hidden',
  },
};

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
        camera={{ position: [0, 8, 18], fov: 60 }}
        gl={{ antialias: true }}
      />
    </div>
  );
}