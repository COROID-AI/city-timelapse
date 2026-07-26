import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, memo } from 'react';
import * as THREE from 'three';
import { AdStyle, EraId } from '../../types';

type AdData = {
  id: number;
  position: [number, number, number];
  normal: [number, number, number];
  buildingId: number;
  text: string;
  color: string;
};

const createRng = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 0x100000000;
    return state / 0x100000000;
  };
};

const AD_TEXTS = [
  'COCA-COLA', 'PEPSI', 'MCDONALD\'S', 'SHELL', 'FORD', 'IBM',
  'AT&T', 'DISNEY', 'NIKE', 'APPLE', 'TESLA', 'NETFLIX',
  'META', 'AMAZON', 'GOOGLE', 'MICROSOFT', 'NOKIA', 'SONY',
  'COCA-COLA', 'Coca-Cola', 'PEPSI', 'PEPSI', 'MCDONALD\'S',
];

const AD_COLORS: Record<AdStyle, string[]> = {
  poster: ['#8D6E63', '#A1887F', '#BCAAA4', '#D7CCC8'],
  neon: ['#FF0000', '#00FF00', '#FFFF00', '#FF00FF', '#00FFFF'],
  digital: ['#00E5FF', '#FF4081', '#7C4DFF', '#FFD700', '#30FF00'],
  holo: ['#FF00FF', '#00FFFF', '#FFFF00', '#FF6600', '#9D4DFF'],
};

const generateAds = (count: number, adStyle: AdStyle): AdData[] => {
  const ads: AdData[] = [];
  const rng = createRng(300);

  // Ads are placed on building facades
  const buildingPositions: { pos: [number, number, number]; normal: [number, number, number] }[] = [
    { pos: [-20, 8, -15], normal: [0, 0, 1] },
    { pos: [20, 12, -15], normal: [0, 0, 1] },
    { pos: [-25, 15, 10], normal: [0, 0, -1] },
    { pos: [25, 10, 10], normal: [0, 0, -1] },
    { pos: [-30, 20, 0], normal: [1, 0, 0] },
    { pos: [30, 18, 0], normal: [-1, 0, 0] },
    { pos: [0, 14, -25], normal: [0, 1, 0] },
    { pos: [0, 16, 25], normal: [0, -1, 0] },
    { pos: [-15, 6, -20], normal: [0, 0, 1] },
    { pos: [15, 9, -20], normal: [0, 0, 1] },
    { pos: [-18, 11, 15], normal: [0, 0, -1] },
    { pos: [18, 13, 15], normal: [0, 0, -1] },
  ];

  for (let i = 0; i < Math.min(count, buildingPositions.length); i++) {
    const bp = buildingPositions[i];
    const colors = AD_COLORS[adStyle];
    ads.push({
      id: i,
      position: bp.pos,
      normal: bp.normal,
      buildingId: i,
      text: AD_TEXTS[Math.floor(rng() * AD_TEXTS.length)],
      color: colors[Math.floor(rng() * colors.length)],
    });
  }

  return ads;
};

const AdSign = memo(({
  data,
  adStyle,
  windowLitColor,
  transitionProgress,
}: {
  data: AdData;
  adStyle: AdStyle;
  windowLitColor: string;
  transitionProgress: number;
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  const adColor = useMemo(() => new THREE.Color(data.color), [data.color]);
  const litColor = useMemo(() => new THREE.Color(windowLitColor), [windowLitColor]);

  // Rotate normal to face outward
  const rotation = useMemo(() => {
    const [nx, ny, nz] = data.normal;
    if (nx !== 0) {
      return [0, nx > 0 ? Math.PI / 2 : -Math.PI / 2, 0] as [number, number, number];
    }
    if (nz !== 0) {
      return [0, nz > 0 ? 0 : Math.PI, 0] as [number, number, number];
    }
    if (ny !== 0) {
      return [ny > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0] as [number, number, number];
    }
    return [0, 0, 0] as [number, number, number];
  }, [data.normal]);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      if (adStyle === 'neon' || adStyle === 'holo') {
        const flicker = 0.7 + 0.3 * Math.sin(clock.elapsedTime * 3 + data.id);
        materialRef.current.emissiveIntensity = flicker;
      } else if (adStyle === 'digital') {
        const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 2 + data.id);
        materialRef.current.emissiveIntensity = pulse;
      } else {
        materialRef.current.emissiveIntensity = 0.3;
      }
    }
  });

  // Ad geometry based on style
  const adGeometry = useMemo(() => {
    if (adStyle === 'holo') {
      return new THREE.RingGeometry(0.8, 1.2, 32);
    }
    return new THREE.PlaneGeometry(2, 1.2);
  }, [adStyle]);

  const adMaterial = useMemo(() => {
    const baseColor = adStyle === 'holo' ? litColor.clone().lerp(adColor, 0.5) : adColor.clone();
    const emissiveColor = adStyle === 'neon' || adStyle === 'holo' || adStyle === 'digital' ? baseColor : new THREE.Color(0x000000);
    return new THREE.MeshStandardMaterial({
      color: baseColor,
      emissive: emissiveColor,
      emissiveIntensity: adStyle === 'neon' || adStyle === 'holo' ? 0.8 : adStyle === 'digital' ? 0.5 : 0.3,
      roughness: 0.3,
      metalness: 0.7,
      transparent: adStyle === 'holo',
      opacity: adStyle === 'holo' ? 0.7 : 1.0,
      depthWrite: adStyle !== 'holo',
      side: THREE.DoubleSide,
    });
  }, [adStyle, adColor, litColor]);

  return (
    <group position={data.position} rotation={rotation}>
      <mesh
        ref={meshRef}
        geometry={adGeometry}
        material={adMaterial}
        castShadow
      />

      {/* Glow effect for neon/holo ads */}
      {(adStyle === 'neon' || adStyle === 'holo') && (
        <mesh geometry={adGeometry} position={[0, 0, -0.01]}>
          <meshBasicMaterial
            color={adColor}
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Holographic projection effect */}
      {adStyle === 'holo' && (
        <mesh geometry={new THREE.RingGeometry(1.3, 1.5, 32)} position={[0, 0, -0.1]}>
          <meshBasicMaterial
            color={litColor}
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
});

export const AdManager = ({
  adStyle,
  adCount,
  windowLitColor,
  era,
  transitionProgress,
}: {
  adStyle: AdStyle;
  adCount: number;
  windowLitColor: string;
  era: EraId;
  transitionProgress: number;
}) => {
  const ads = useMemo(
    () => generateAds(adCount, adStyle),
    [adCount, adStyle]
  );

  return (
    <group>
      {ads.map((ad) => (
        <AdSign
          key={ad.id}
          data={ad}
          adStyle={adStyle}
          windowLitColor={windowLitColor}
          transitionProgress={transitionProgress}
        />
      ))}
    </group>
  );
};
