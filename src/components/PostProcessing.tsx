import React from 'react';
import { EffectComposer, Bloom, Noise, Vignette, Scanline } from '@react-three/postprocessing';

const CityPostProcessing: React.FC = React.memo(() => {
  return (
    <EffectComposer>
      <Bloom
        intensity={0.4}
        radius={0.6}
        threshold={0.85}
        mipmapBlur
      />
      <Noise opacity={0.08} />
      <Vignette offset={0.5} darkness={0.35} />
      <Scanline density={0.3} />
    </EffectComposer>
  );
});

export default CityPostProcessing;