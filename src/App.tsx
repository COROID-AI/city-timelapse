import { Canvas } from '@react-three/fiber';

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'fixed',
    inset: 0,
    overflow: 'hidden',
  },
};

export default function App() {
  return (
    <div style={styles.root}>
      <Canvas
        camera={{ position: [0, 8, 18], fov: 60 }}
        gl={{ antialias: true }}
      />
    </div>
  );
}