import { Text } from '@react-three/drei';
import { useEra } from '../contexts/EraContext';
import type { EraYear } from '../types';

// ─── Era-driven storefront configuration ─────────────────────────────

interface AwningConfig {
  color: number;
  material: string;
  width: number;
  height: number;
  curvature: number;
}

interface WindowGridConfig {
  columns: number;
  rows: number;
  glassColor: number;
  frameColor: number;
  frameWidth: number;
  paneWidth: number;
  paneHeight: number;
}

interface DoorConfig {
  material: string;
  color: number;
  width: number;
  height: number;
}

interface GoodsItemConfig {
  name: string;
  color: number;
  position: [number, number, number];
}

interface AdConfig {
  medium: string;
  text: string;
  subtitle: string;
  color: number;
  backgroundColor: number;
  width: number;
  height: number;
  emissiveIntensity: number;
}

interface StorefrontConfig {
  year: EraYear;
  facadeColor: number;
  facadeHeight: number;
  facadeWidth: number;
  facadeDepth: number;
  roofHeight: number;
  awning: AwningConfig;
  windows: WindowGridConfig;
  door: DoorConfig;
  goods: GoodsItemConfig[];
  advertisement: AdConfig;
}

const eraStorefronts: Record<EraYear, StorefrontConfig> = {
  1945: {
    year: 1945,
    facadeColor: 0x8b7d6b,
    facadeHeight: 5,
    facadeWidth: 8,
    facadeDepth: 4,
    roofHeight: 1.5,
    awning: {
      color: 0xd4a574,
      material: 'canvas',
      width: 7.5,
      height: 1.2,
      curvature: 0.3,
    },
    windows: {
      columns: 3,
      rows: 2,
      glassColor: 0x8fa8c0,
      frameColor: 0x5a4a3a,
      frameWidth: 0.08,
      paneWidth: 1.6,
      paneHeight: 1.4,
    },
    door: {
      material: 'mahogany',
      color: 0x6b3a2a,
      width: 1.2,
      height: 2.8,
    },
    goods: [
      { name: 'Canned Goods', color: 0xc0392b, position: [-2.5, 1.5, 0.01] },
      { name: 'Bread Loaf', color: 0xd4a574, position: [-0.8, 1.5, 0.01] },
      { name: 'Tea Tin', color: 0x2c3e50, position: [0.9, 1.5, 0.01] },
      { name: 'Soap Block', color: 0xecf0f1, position: [2.6, 1.5, 0.01] },
    ],
    advertisement: {
      medium: 'hand-painted sign',
      text: 'EST. 1920',
      subtitle: 'Fine Provisions & Household',
      color: 0xfff8e1,
      backgroundColor: 0x5a3a1a,
      width: 3.5,
      height: 1.0,
      emissiveIntensity: 0.15,
    },
  },
  1965: {
    year: 1965,
    facadeColor: 0xc0392b,
    facadeHeight: 6,
    facadeWidth: 9,
    facadeDepth: 4.5,
    roofHeight: 1.2,
    awning: {
      color: 0xf39c12,
      material: 'glossy plastic',
      width: 8.5,
      height: 1.4,
      curvature: 0.15,
    },
    windows: {
      columns: 4,
      rows: 2,
      glassColor: 0x5dade2,
      frameColor: 0x2c3e50,
      frameWidth: 0.06,
      paneWidth: 1.8,
      paneHeight: 1.5,
    },
    door: {
      material: 'steel-reinforced glass',
      color: 0x2c3e50,
      width: 1.4,
      height: 3.0,
    },
    goods: [
      { name: 'Soda Bottle', color: 0xe67e22, position: [-3, 1.6, 0.01] },
      { name: 'Sunscreen', color: 0xf1c40f, position: [-1.2, 1.6, 0.01] },
      { name: 'Radio', color: 0x1abc9c, position: [0.6, 1.6, 0.01] },
      { name: 'Camera', color: 0x9b59b6, position: [2.4, 1.6, 0.01] },
      { name: 'Ice Cream', color: 0xecf0f1, position: [4.0, 1.6, 0.01] },
    ],
    advertisement: {
      medium: 'neon sign',
      text: 'OPEN TONIGHT!',
      subtitle: 'Eat Drink Be Merry',
      color: 0xffffff,
      backgroundColor: 0x000000,
      width: 4.0,
      height: 1.0,
      emissiveIntensity: 1.2,
    },
  },
  1985: {
    year: 1985,
    facadeColor: 0x1a1a2e,
    facadeHeight: 7,
    facadeWidth: 10,
    facadeDepth: 5,
    roofHeight: 1.0,
    awning: {
      color: 0x00ffff,
      material: 'chrome-trimmed plastic',
      width: 9,
      height: 0.8,
      curvature: 0.1,
    },
    windows: {
      columns: 5,
      rows: 3,
      glassColor: 0x1a1a3e,
      frameColor: 0x888888,
      frameWidth: 0.05,
      paneWidth: 1.6,
      paneHeight: 1.2,
    },
    door: {
      material: 'polished chrome',
      color: 0xcccccc,
      width: 1.6,
      height: 3.2,
    },
    goods: [
      { name: 'Cassette Deck', color: 0xff00ff, position: [-4, 1.8, 0.01] },
      { name: 'Sneakers', color: 0xff0000, position: [-1.5, 1.8, 0.01] },
      { name: 'Sunglasses', color: 0xffff00, position: [1.0, 1.8, 0.01] },
      { name: 'Walkman', color: 0x00ff00, position: [3.5, 1.8, 0.01] },
    ],
    advertisement: {
      medium: 'neon sign',
      text: 'SYNTHWAVE',
      subtitle: '80s Style • Premium Beats',
      color: 0xff00ff,
      backgroundColor: 0x00001a,
      width: 4.5,
      height: 1.0,
      emissiveIntensity: 1.5,
    },
  },
  2005: {
    year: 2005,
    facadeColor: 0xd5d8dc,
    facadeHeight: 8,
    facadeWidth: 11,
    facadeDepth: 5.5,
    roofHeight: 0.8,
    awning: {
      color: 0xecf0f1,
      material: 'brushed aluminum',
      width: 10,
      height: 0.6,
      curvature: 0.05,
    },
    windows: {
      columns: 6,
      rows: 3,
      glassColor: 0xd5e8f0,
      frameColor: 0x7f8c8d,
      frameWidth: 0.04,
      paneWidth: 1.5,
      paneHeight: 1.3,
    },
    door: {
      material: 'glass & steel',
      color: 0xbdc3c7,
      width: 1.8,
      height: 3.4,
    },
    goods: [
      { name: 'MP3 Player', color: 0x3498db, position: [-4.5, 1.9, 0.01] },
      { name: 'Coffee Mug', color: 0x95a5a6, position: [-2, 1.9, 0.01] },
      { name: 'Laptop', color: 0x2c3e50, position: [0.5, 1.9, 0.01] },
      { name: 'Water Bottle', color: 0x27ae60, position: [3, 1.9, 0.01] },
      { name: 'Headphones', color: 0xe74c3c, position: [5.5, 1.9, 0.01] },
    ],
    advertisement: {
      medium: 'LED billboard',
      text: 'SAVE BIG TODAY',
      subtitle: 'Free Delivery • Click & Collect',
      color: 0x00ff88,
      backgroundColor: 0x0a0a0a,
      width: 5.0,
      height: 1.2,
      emissiveIntensity: 1.8,
    },
  },
  2025: {
    year: 2025,
    facadeColor: 0x1c1c2e,
    facadeHeight: 9,
    facadeWidth: 12,
    facadeDepth: 6,
    roofHeight: 0.6,
    awning: {
      color: 0x6c5ce7,
      material: 'adaptive OLED',
      width: 11,
      height: 0.5,
      curvature: 0.02,
    },
    windows: {
      columns: 7,
      rows: 3,
      glassColor: 0x1a1a3a,
      frameColor: 0x636e72,
      frameWidth: 0.03,
      paneWidth: 1.4,
      paneHeight: 1.2,
    },
    door: {
      material: 'smart glass',
      color: 0x636e72,
      width: 2.0,
      height: 3.6,
    },
    goods: [
      { name: 'AR Glasses', color: 0xa29bfe, position: [-5, 2.0, 0.01] },
      { name: 'Phone', color: 0xfd79a8, position: [-2.5, 2.0, 0.01] },
      { name: 'Drone', color: 0x00cec9, position: [0, 2.0, 0.01] },
      { name: 'Watch', color: 0xffeaa7, position: [2.5, 2.0, 0.01] },
      { name: 'Bot', color: 0x55efc4, position: [5, 2.0, 0.01] },
    ],
    advertisement: {
      medium: 'LED billboard',
      text: 'PERSONALIZED',
      subtitle: 'Your City • Your Style • Your Way',
      color: 0x55efc4,
      backgroundColor: 0x0d0d1a,
      width: 5.5,
      height: 1.2,
      emissiveIntensity: 2.0,
    },
  },
  2055: {
    year: 2055,
    facadeColor: 0x2d1b4e,
    facadeHeight: 12,
    facadeWidth: 14,
    facadeDepth: 7,
    roofHeight: 0.5,
    awning: {
      color: 0xe056fd,
      material: 'holographic gradient',
      width: 13,
      height: 0.4,
      curvature: 0.01,
    },
    windows: {
      columns: 8,
      rows: 4,
      glassColor: 0x2d1b4e,
      frameColor: 0x6c5ce7,
      frameWidth: 0.02,
      paneWidth: 1.3,
      paneHeight: 1.0,
    },
    door: {
      material: 'biomorphic crystal',
      color: 0xa29bfe,
      width: 2.2,
      height: 4.0,
    },
    goods: [
      { name: 'Holo-Suit', color: 0xfd79a8, position: [-5.5, 2.2, 0.01] },
      { name: 'Neuro-Link', color: 0x6c5ce7, position: [-3, 2.2, 0.01] },
      { name: 'Bio-Seed', color: 0x00f5d4, position: [-0.5, 2.2, 0.01] },
      { name: 'Crystal', color: 0xfeeafa, position: [2, 2.2, 0.01] },
      { name: 'Pod', color: 0x55efc4, position: [4.5, 2.2, 0.01] },
      { name: 'Orb', color: 0xffd700, position: [7, 2.2, 0.01] },
    ],
    advertisement: {
      medium: 'holographic projection',
      text: 'NEXUS 2055',
      subtitle: 'Spatial Computing • Living Architecture',
      color: 0xe056fd,
      backgroundColor: 0x0a0020,
      width: 6.0,
      height: 1.4,
      emissiveIntensity: 2.5,
    },
  },
};

// ─── Advertisement Component ───────────────────────────────────────

function Advertisement({ ad }: { ad: AdConfig }) {
  return (
    <group position={[0, 0, ad.width / 2 + 0.02]}>
      {/* Back panel */}
      <mesh>
        <planeGeometry args={[ad.width, ad.height]} />
        <meshStandardMaterial
          color={ad.backgroundColor}
          roughness={0.5}
          metalness={0.3}
          emissive={ad.backgroundColor}
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Primary ad text — readable per era */}
      <Text
        position={[0, ad.height * 0.15, 0.02]}
        fontSize={ad.height * 0.35}
        color={ad.color}
        anchorX="center"
        anchorY="middle"
        maxWidth={ad.width - 0.2}
        lineHeight={1.2}
      >
        {ad.text}
      </Text>

      {/* Subtitle */}
      <Text
        position={[0, -ad.height * 0.2, 0.02]}
        fontSize={ad.height * 0.2}
        color={ad.color}
        anchorX="center"
        anchorY="middle"
        maxWidth={ad.width - 0.2}
        lineHeight={1.2}
      >
        {ad.subtitle}
      </Text>

      {/* Medium indicator */}
      <Text
        position={[0, -ad.height * 0.45, 0.02]}
        fontSize={ad.height * 0.15}
        color={ad.color}
        anchorX="center"
        anchorY="middle"
      >
        {`[${ad.medium}]`}
      </Text>
    </group>
  );
}

// ─── Storefront Facade ─────────────────────────────────────────────

function StorefrontFacade({ config }: { config: StorefrontConfig }) {
  const awningY = config.facadeHeight + config.roofHeight;
  const windowTop = awningY - 0.3;
  const windowBottom = 0.5;
  const windowStep = (windowTop - windowBottom) / config.windows.rows;

  return (
    <group>
      {/* Main facade wall */}
      <mesh position={[0, config.facadeHeight / 2, 0]}>
        <boxGeometry args={[config.facadeWidth, config.facadeHeight, config.facadeDepth]} />
        <meshStandardMaterial
          color={config.facadeColor}
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>

      {/* Roof cap */}
      <mesh position={[0, config.facadeHeight + config.roofHeight / 2, 0]}>
        <boxGeometry args={[config.facadeWidth + 0.2, config.roofHeight, config.facadeDepth + 0.2]} />
        <meshStandardMaterial
          color={config.facadeColor}
          roughness={0.5}
          metalness={0.3}
        />
      </mesh>

      {/* Awning */}
      <mesh position={[0, awningY + config.awning.height / 2, config.facadeDepth / 2 + 0.05]}>
        <boxGeometry args={[config.awning.width, config.awning.height, 0.08]} />
        <meshStandardMaterial
          color={config.awning.color}
          roughness={0.4}
          metalness={0.2}
          emissive={config.awning.color}
          emissiveIntensity={0.1}
        />
      </mesh>

      {/* Windows */}
      {Array.from({ length: config.windows.columns }).map((_, colIdx) =>
        Array.from({ length: config.windows.rows }).map((_, rowIdx) => {
          const x =
            -config.facadeWidth / 2 +
            (colIdx + 0.5) * (config.facadeWidth / config.windows.columns);
          const y =
            windowBottom +
            (rowIdx + 0.5) * windowStep;
          return (
            <mesh
              key={`win-${colIdx}-${rowIdx}`}
              position={[x, y, config.facadeDepth / 2 + 0.01]}
            >
              <planeGeometry
                args={[
                  config.windows.paneWidth - config.windows.frameWidth * 2,
                  config.windows.paneHeight - config.windows.frameWidth * 2,
                ]}
              />
              <meshStandardMaterial
                color={config.windows.glassColor}
                roughness={0.1}
                metalness={0.5}
                transparent
                opacity={0.7}
              />
            </mesh>
          );
        })
      )}

      {/* Door */}
      <mesh position={[0, config.door.height / 2, config.facadeDepth / 2 + 0.02]}>
        <boxGeometry args={[config.door.width, config.door.height, 0.06]} />
        <meshStandardMaterial
          color={config.door.color}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>

      {/* Visible goods on shelves */}
      {config.goods.map((item, idx) => (
        <mesh key={`goods-${idx}`} position={item.position}>
          <boxGeometry args={[0.3, 0.2, 0.3]} />
          <meshStandardMaterial
            color={item.color}
            roughness={0.4}
            metalness={0.3}
            emissive={item.color}
            emissiveIntensity={0.05}
          />
        </mesh>
      ))}

      {/* Advertisement mounted above awning */}
      <Advertisement ad={config.advertisement} />
    </group>
  );
}

// ─── StorefrontRow: a row of storefronts along a street ────────────

interface StorefrontRowProps {
  count?: number;
  spacing?: number;
  yOffset?: number;
}

function StorefrontRow({ count = 6, spacing = 10, yOffset = 0 }: StorefrontRowProps) {
  const { year } = useEra();

  return (
    <group position={[0, yOffset, 0]}>
      {Array.from({ length: count }).map((_, idx) => {
        const config = eraStorefronts[year];
        const xOffset = (idx - (count - 1) / 2) * spacing;
        return (
          <group key={`storefront-${idx}`} position={[xOffset, 0, 0]}>
            <StorefrontFacade config={config} />
          </group>
        );
      })}
    </group>
  );
}

// ─── StorefrontSystem: the main entry point for the storefront subsystem ────

export function StorefrontSystem() {
  return (
    <group>
      <StorefrontRow count={6} spacing={10} yOffset={0} />
    </group>
  );
}
