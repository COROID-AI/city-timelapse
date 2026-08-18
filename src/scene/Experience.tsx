import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { getEra, getAllEras } from '../eras/config';
import { CameraRig } from './CameraRig';
import { Ground } from './Ground';
import { CityBlock } from './CityBlock';
import { Lighting } from './Lighting';
import { SkyDome } from './SkyDome';
import { Vehicles } from './Vehicles';
import { Pedestrians } from './Pedestrians';
import { StreetFurniture } from './StreetFurniture';
import { Effects } from './Effects';
import { LoadingScreen } from '../ui/LoadingScreen';
import { ErrorFallback } from '../ui/ErrorFallback';

export function Experience() {
  const currentEraKey = useStore(state => state.currentEra);
  const selectedEraKey = useStore(state => state.selectedEra);
  const transitioning = useStore(state => state.transitioning);

  // Resolve effective era for rendering
  const [renderEra, setRenderEra] = useState(getEra(currentEraKey));
  const prevEra = getEra(currentEraKey);
  const targetEra = selectedEraKey ? getEra(selectedEraKey) : prevEra;

  useEffect(() => {
    if (transitioning && selectedEraKey) {
      const startTime = performance.now();
      const duration = 2500;
      const animate = () => {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        // Simple lerp to target
        setRenderEra(targetEra);
        if (t < 1) requestAnimationFrame(animate);
        else {
          useStore.setState({ currentEra: selectedEraKey, transitioning: false });
        }
      };
      requestAnimationFrame(animate);
    }
  }, [transitioning, selectedEraKey, targetEra]);

  return (
    <>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [30, 20, 30], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        style={{ position: 'absolute', inset: 0 }}
        onError={(e) => {
          console.error('Three.js canvas error:', e);
        }}
      >
        <Suspense fallback={<LoadingScreen />}>
          <color attach="background" args={['#0a0a0f']} />
          <fog attach="fog" args={[renderEra.fogColor, renderEra.fogDensity * 80, renderEra.fogDensity * 200]} />

          <SkyDome era={renderEra} />
          <Lighting era={renderEra} />
          <Ground era={renderEra} />
          <CityBlock era={renderEra} />
          <Vehicles era={renderEra} />
          <Pedestrians era={renderEra} />
          <StreetFurniture era={renderEra} />
          <Effects era={renderEra} />
          <CameraRig initialPosition={[30, 20, 30]} target={[0, 3, 0]} />
        </Suspense>
      </Canvas>
    </>
  );
}
