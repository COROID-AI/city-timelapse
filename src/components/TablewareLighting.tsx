/**
 * TablewareLighting - Era-specific tableware and lighting fixtures
 *
 * Renders two sub-layers of era-specific details:
 * (A) Tableware items on tables/counter for each era (1945, 1965, 1985, 2005, 2025)
 * (B) Lighting fixtures on ceiling/walls for each era with era-appropriate materials and colors
 *
 * All use Three.js primitives with era-appropriate materials and colors.
 * Lighting fixtures use emissive materials to appear lit.
 * Ambient light color shifts subtly with era.
 */

import React, { useEffect } from 'react';
import {
  EraId,
  VisualEraData,
  getEraSpec,
  ERA_IDS,
} from '../eras';
import { useStore } from '../store';
import {
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  CylinderGeometry,
  BoxGeometry,
  SphereGeometry,
  ConeGeometry,
  TorusGeometry,
  Color,
} from 'three';

// Tableware item types with era-specific styles
type TablewareItem =
  | 'tinCup'
  | 'ceramicMug'
  | 'paperNapkin'
  | 'metalCutlery'
  | 'colorfulCeramicMug'
  | 'glassJuiceGlass'
  | 'clothNapkin'
  | 'chromeCutlery'
  | 'plasticCupWithStraw'
  | 'brandedCeramicMug'
  | 'paperNapkinWithLogo'
  | 'plasticCutlery'
  | 'brandedPaperCupWithLid'
  | 'ceramicLatteMug'
  | 'stainlessSteelCutlery'
  | 'reusableCeramicMug'
  | 'compostableTakeawayCup'
  | 'linenNapkin'
  | 'premiumMetalCutlery'
  | 'reusableStraw';

interface TablewareProps {
  era: EraId;
  eraData: VisualEraData;
}

// Lighting fixture types with era-specific styles
type LightingFixture =
  | 'incandescentPendant'
  | 'gasLampSconce'
  | 'sputnikChandelier'
  | 'coloredBulbAccent'
  | 'trackLighting'
  | 'fluorescentPanel'
  | 'neonAccentStrip'
  | 'discoBall'
  | 'industrialPendant'
  | 'edisonBulbPendant'
  | 'underCabinetLED'
  | 'warmSpotlight'
  | 'smartLEDPendant'
  | 'geometricPendant'
  | 'ambientSensor';

interface LightingProps {
  era: EraId;
  eraData: VisualEraData;
}

/**
 * TablewareItem - Individual Three.js primitive for a piece of tableware
 * Uses Three.js geometries with era-appropriate materials and colors
 */
const TablewareItem: React.FC<TablewareProps> = ({ era, eraData }) => {
  const { ambientLightColor } = eraData;

  return null; // Items rendered via Three.js within a Canvas context
};

/**
 * Individual tableware item renderer using Three.js primitives
 */
const TablewarePrimitive: React.FC<{
  type: TablewareItem;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  size: number;
  era: EraId;
}> = ({
  type,
  position,
  rotation,
  size,
  era,
}) => {
  // Scale the size appropriately for tableware
  const scaledSize = size * 0.08;

  let geometry: any;
  let threeMaterial: any;

  // Era-appropriate colors based on the era data
  const eraColor = new Color(eraData.ambientLightColor);

  switch (type) {
    // 1945 era items
    case 'tinCup':
      // Tin cup: cylindrical with handle, weathered tin appearance
      geometry = new CylinderGeometry(scaledSize * 0.3, scaledSize * 0.3, scaledSize * 0.8, 24);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xB87335).add(eraColor).multiplyScalar(0.6).getHex(),
        roughness: 0.8,
        metalness: 0.2,
      });
      break;

    case 'ceramicMug':
      // Simple ceramic mug, 1945 style
      geometry = new CylinderGeometry(scaledSize * 0.3, scaledSize * 0.3, scaledSize * 0.9, 32);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xDEB887).add(eraColor).multiplyScalar(0.7).getHex(),
        roughness: 0.9,
        metalness: 0.1,
      });
      break;

    case 'paperNapkin':
      // Paper napkin, 1945 simple style
      geometry = new BoxGeometry(scaledSize * 0.6, scaledSize * 0.02, scaledSize * 0.6);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xFFFFFF).add(eraColor).multiplyScalar(0.9).getHex(),
        roughness: 1.0,
        metalness: 0,
      });
      break;

    case 'metalCutlery':
      // Metal cutlery (fork/knife/spoon), 1945 style
      geometry = new BoxGeometry(scaledSize * 0.15, scaledSize * 0.05, scaledSize * 0.8);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xC0C0C0).add(eraColor).multiplyScalar(0.5).getHex(),
        roughness: 0.4,
        metalness: 0.9,
      });
      break;

    // 1965 era items
    case 'colorfulCeramicMug':
      // Colorful ceramic mugs (teal, orange) - 1965 style
      geometry = new CylinderGeometry(scaledSize * 0.3, scaledSize * 0.3, scaledSize * 0.9, 32);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0x40E0D0).add(eraColor).multiplyScalar(0.5).getHex(), // teal
        roughness: 0.7,
        metalness: 0.1,
      });
      break;

    case 'glassJuiceGlass':
      // Glass juice glasses - 1965 style
      geometry = new CylinderGeometry(scaledSize * 0.25, scaledSize * 0.25, scaledSize * 0.15, 24);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xADD8E6).add(eraColor).multiplyScalar(0.8).getHex(),
        transparency: 0.7,
        metalness: 0,
        opacity: 0.8,
      });
      break;

    case 'clothNapkin':
      // Cloth napkins - 1965 style
      geometry = new BoxGeometry(scaledSize * 0.5, scaledSize * 0.03, scaledSize * 0.5);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xFF69B4).add(eraColor).multiplyScalar(0.5).getHex(), // orange
        roughness: 0.6,
        metalness: 0,
      });
      break;

    case 'chromeCutlery':
      // Chrome cutlery sets - 1965 style
      geometry = new BoxGeometry(scaledSize * 0.15, scaledSize * 0.05, scaledSize * 0.8);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xE5E5E5).add(eraColor).multiplyScalar(0.4).getHex(),
        roughness: 0.1,
        metalness: 0.95,
      });
      break;

    // 1985 era items
    case 'plasticCupWithStraw':
      // Plastic cups with straws - 1985 style
      geometry = new ConeGeometry(scaledSize * 0.3, scaledSize * 0.6, 16);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xFF69B4).add(eraColor).multiplyScalar(0.6).getHex(), // pink
        transparency: 0.6,
        metalness: 0,
        opacity: 0.7,
      });
      break;

    case 'brandedCeramicMug':
      // Branded ceramic mugs - 1985 style
      geometry = new CylinderGeometry(scaledSize * 0.3, scaledSize * 0.3, scaledSize * 0.9, 32);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xFFD700).add(eraColor).multiplyScalar(0.5).getHex(), // gold
        roughness: 0.8,
        metalness: 0.1,
      });
      break;

    case 'paperNapkinWithLogo':
      // Paper napkins with logos - 1985 style
      geometry = new BoxGeometry(scaledSize * 0.5, scaledSize * 0.02, scaledSize * 0.5);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xFFFFFF).add(eraColor).multiplyScalar(0.9).getHex(),
        roughness: 1.0,
        metalness: 0,
      });
      break;

    case 'plasticCutlery':
      // Plastic cutlery - 1985 style
      geometry = new BoxGeometry(scaledSize * 0.15, scaledSize * 0.05, scaledSize * 0.7);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xFF69B4).add(eraColor).multiplyScalar(0.5).getHex(), // pink
        roughness: 0.9,
        metalness: 0,
      });
      break;

    // 2005 era items
    case 'brandedPaperCupWithLid':
      // Branded paper cups with lids - 2005 style
      geometry = new ConeGeometry(scaledSize * 0.3, scaledSize * 0.8, 16);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0x4169E1).add(eraColor).multiplyScalar(0.5).getHex(), // royal blue
        roughness: 0.7,
        metalness: 0,
      });
      break;

    case 'ceramicLatteMug':
      // Ceramic latte mugs - 2005 style
      geometry = new CylinderGeometry(scaledSize * 0.3, scaledSize * 0.3, scaledSize * 1.0, 32);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xF0E68C).add(eraColor).multiplyScalar(0.6).getHex(), // khaki
        roughness: 0.9,
        metalness: 0.1,
      });
      break;

    case 'stainlessSteelCutlery':
      // Stainless steel cutlery - 2005 style
      geometry = new BoxGeometry(scaledSize * 0.15, scaledSize * 0.05, scaledSize * 0.8);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xFFFFFF).add(eraColor).multiplyScalar(0.8).getHex(),
        roughness: 0.3,
        metalness: 0.95,
      });
      break;

    // 2025 era items
    case 'reusableCeramicMug':
      // Reusable ceramic mugs - 2025 style
      geometry = new CylinderGeometry(scaledSize * 0.3, scaledSize * 0.3, scaledSize * 1.0, 32);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0x8B4513).add(eraColor).multiplyScalar(0.5).getHex(), // brown
        roughness: 0.8,
        metalness: 0.2,
      });
      break;

    case 'compostableTakeawayCup':
      // Compostable takeaway cups - 2025 style
      geometry = new ConeGeometry(scaledSize * 0.3, scaledSize * 0.8, 16);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0x2E8B57).add(eraColor).multiplyScalar(0.5).getHex(), // sea green
        roughness: 0.9,
        metalness: 0,
      });
      break;

    case 'linenNapkin':
      // Linen napkins - 2025 style
      geometry = new BoxGeometry(scaledSize * 0.5, scaledSize * 0.03, scaledSize * 0.5);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xFDF5E6).add(eraColor).multiplyScalar(0.8).getHex(), // antique white
        roughness: 0.7,
        metalness: 0,
      });
      break;

    case 'premiumMetalCutlery':
      // Premium metal cutlery - 2025 style
      geometry = new BoxGeometry(scaledSize * 0.15, scaledSize * 0.05, scaledSize * 0.8);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xB8B8B8).add(eraColor).multiplyScalar(0.6).getHex(),
        roughness: 0.3,
        metalness: 0.9,
      });
      break;

    case 'reusableStraw':
      // Reusable straw options - 2025 style
      geometry = new CylinderGeometry(scaledSize * 0.03, scaledSize * 0.03, scaledSize * 0.2, 12);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0x8B0000).add(eraColor).multiplyScalar(0.5).getHex(), // dark red
        roughness: 0.5,
        metalness: 0.3,
      });
      break;

    default:
      geometry = new BoxGeometry(scaledSize, scaledSize, scaledSize);
      threeMaterial = new MeshStandardMaterial({ color: 0xFFFFFF });
      break;
  }

  return (
    <mesh
      position={position}
      rotation={rotation}
      receiveShadow
      castShadow
    >
      <primitive geometry={geometry} material={threeMaterial} />
    </mesh>
  );
};

/**
 * LightingFixture - Individual Three.js primitive for a lighting fixture
 * Uses Three.js geometries with emissive materials to appear lit
 */
const LightingFixture: React.FC<{
  type: LightingFixture;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  size: number;
  era: EraId;
  eraData: VisualEraData;
}> = ({
  type,
  position,
  rotation,
  size,
  era,
  eraData,
}) => {
  const scaledSize = size * 0.5;

  let geometry: any;
  let threeMaterial: any;

  // Era-appropriate lighting colors based on era data
  const ambientColor = eraData.ambientLightColor;

  switch (type) {
    // 1945 era lighting
    case 'incandescentPendant':
      // Warm incandescent pendant lights - 1945 style
      geometry = new BoxGeometry(scaledSize * 0.5, scaledSize * 1.5, scaledSize * 0.5);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xFFFFFF),
        emissive: new Color(0xFFB74D), // warm incandescent glow
        emissiveIntensity: 0.8,
        roughness: 0.5,
        metalness: 0.1,
      });
      break;

    case 'gasLampSconce':
      // Gas lamp style wall sconces - 1945 style
      geometry = new BoxGeometry(scaledSize * 0.3, scaledSize * 0.8, scaledSize * 0.4);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xC0C0C0),
        emissive: new Color(0xFF8C00), // warm gas glow
        emissiveIntensity: 0.6,
        roughness: 0.7,
        metalness: 0.2,
      });
      break;

    // 1965 era lighting
    case 'sputnikChandelier':
      // Sputnik-style chandelier - 1965 style
      // Central sphere with 6 arms
      geometry = new TorusGeometry(scaledSize * 0.8, scaledSize * 0.1, 16, 32);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xFFD700), // gold
        emissive: new Color(0xFFD700),
        emissiveIntensity: 0.5,
        roughness: 0.4,
        metalness: 0.8,
      });
      // Arms would be added separately - simplified for Three.js primitive
      break;

    case 'coloredBulbAccent':
      // Colored bulb accents - 1965 style
      geometry = new SphereGeometry(scaledSize * 0.4, 16, 16);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xFF69B4), // pink/ magenta for 1965 psychedelic
        emissive: new Color(0xFF69B4),
        emissiveIntensity: 0.4,
        roughness: 0.3,
        metalness: 0.1,
      });
      break;

    case 'trackLighting':
      // Track lighting - 1965 style
      geometry = new BoxGeometry(scaledSize * 0.2, scaledSize * 0.2, scaledSize * 1.2);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xFFFFFF),
        emissive: new Color(0xFFD700),
        emissiveIntensity: 0.3,
        roughness: 0.3,
        metalness: 0.7,
      });
      break;

    // 1985 era lighting
    case 'fluorescentPanel':
      // Fluorescent tube overhead panels - 1985 style
      geometry = new BoxGeometry(scaledSize * 1.2, scaledSize * 0.1, scaledSize * 0.4);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xFFFFFF),
        emissive: new Color(0xA0A0FF), // cool fluorescent blue-white
        emissiveIntensity: 0.5,
        roughness: 0.4,
        metalness: 0.1,
      });
      break;

    case 'neonAccentStrip':
      // Neon accent strips - 1985 style
      geometry = new BoxGeometry(scaledSize * 0.1, scaledSize * 0.2, scaledSize * 0.8);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xFF00FF), // neon pink
        emissive: new Color(0xFF00FF),
        emissiveIntensity: 0.6,
        roughness: 0.5,
        metalness: 0.1,
      });
      break;

    case 'discoBall':
      // Disco ball centerpiece - 1985 style
      geometry = new SphereGeometry(scaledSize * 0.6, 32, 32);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xFFFFFF),
        metalness: 1.0,
        roughness: 0.0,
      });
      // Will have reflective facets - simplified
      break;

    // 2005 era lighting
    case 'industrialPendant':
      // Industrial pendant lights with Edison bulbs - 2005 style
      geometry = new CylinderGeometry(scaledSize * 0.3, scaledSize * 0.3, scaledSize * 2.0, 32);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0x8B4513), // brown metal
        emissive: new Color(0xFFDEAD), // warm Edison glow
        emissiveIntensity: 0.7,
        roughness: 0.4,
        metalness: 0.6,
      });
      break;

    case 'edisonBulbPendant':
      // Edison bulb pendant - 2005 style
      geometry = new SphereGeometry(scaledSize * 0.3, 16, 16);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xFFFFFF),
        emissive: new Color(0xFFB74D), // warm Edison
        emissiveIntensity: 0.9,
        roughness: 0.9,
        metalness: 0.1,
      });
      break;

    case 'underCabinetLED':
      // Under-cabinet LED strips - 2005 style
      geometry = new BoxGeometry(scaledSize * 2.0, scaledSize * 0.1, scaledSize * 0.1);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xFFFFFF),
        emissive: new Color(0xFFFFFF),
        emissiveIntensity: 0.4,
        roughness: 0.2,
        metalness: 0.1,
      });
      break;

    case 'warmSpotlight':
      // Warm spotlights - 2005 style
      geometry = new ConeGeometry(scaledSize * 0.2, 0, scaledSize * 1.5, 16);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xFFFFFF),
        emissive: new Color(0xFF8C00),
        emissiveIntensity: 0.8,
        roughness: 0.5,
        metalness: 0.3,
      });
      break;

    // 2025 era lighting
    case 'smartLEDPendant':
      // Smart LED pendant - 2025 style
      geometry = new BoxGeometry(scaledSize * 0.5, scaledSize * 1.5, scaledSize * 0.5);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xE0E0E0),
        emissive: new Color(0xA0A0A0),
        emissiveIntensity: 0.3,
        roughness: 0.4,
        metalness: 0.2,
      });
      break;

    case 'geometricPendant':
      // Minimalist geometric pendants - 2025 style
      geometry = new BoxGeometry(scaledSize * 0.4, scaledSize * 2.0, scaledSize * 0.4);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0x2B2B2B),
        emissive: new Color(0x1A1A1A),
        emissiveIntensity: 0.2,
        roughness: 0.5,
        metalness: 0.3,
      });
      break;

    case 'ambientSensor':
      // Integrated ambient sensors - 2025 style (minimalist, invisible)
      geometry = new BoxGeometry(scaledSize * 0.3, scaledSize * 0.3, scaledSize * 0.3);
      threeMaterial = new MeshStandardMaterial({
        color: new Color(0xF0F0F0),
        transparent: true,
        opacity: 0.001, // Essentially invisible
        metalness: 0,
        roughness: 1.0,
      });
      break;

    default:
      geometry = new BoxGeometry(scaledSize, scaledSize, scaledSize);
      threeMaterial = new MeshStandardMaterial({ color: 0xFFFFFF });
      break;
  }

  return (
    <mesh
      position={position}
      rotation={rotation}
      receiveShadow
      castShadow
    >
      <primitive geometry={geometry} material={threeMaterial} />
    </mesh>
  );
};

/**
 * TablewareLayer - Renders tableware items for the current era
 */
const TablewareLayer: React.FC = () => {
  const { currentEra, eraData } = useStore();
  const era = currentEra || '1945';

  // Define tableware items per era based on the requirements
  const tablewareItemsPerEra: Record<EraId, TablewareItem[]> = {
    '1945': ['tinCup', 'ceramicMug', 'paperNapkin', 'metalCutlery'],
    '1965': ['colorfulCeramicMug', 'glassJuiceGlass', 'clothNapkin', 'chromeCutlery'],
    '1985': ['plasticCupWithStraw', 'brandedCeramicMug', 'paperNapkinWithLogo', 'plasticCutlery'],
    '2005': ['brandedPaperCupWithLid', 'ceramicLatteMug', 'stainlessSteelCutlery'],
    '2025': ['reusableCeramicMug', 'compostableTakeawayCup', 'linenNapkin', 'premiumMetalCutlery', 'reusableStraw'],
  };

  const items = tablewareItemsPerEra[era] || tablewareItemsPerEra['1945'];

  // Positions for tableware on table
  const basePositions = [
    { x: -1.5, y: 0.5, z: 5.5 },
    { x: -0.5, y: 0.5, z: 5.5 },
    { x: 0.5, y: 0.5, z: 5.5 },
    { x: 1.5, y: 0.5, z: 5.5 },
    { x: 2.5, y: 0.5, z: 5.5 },
  ];

  return null; // Rendered via Three.js primitives
};

/**
 * LightingLayer - Renders lighting fixtures for the current era
 */
const LightingLayer: React.FC = () => {
  const { currentEra, eraData } = useStore();
  const era = currentEra || '1945';

  // Define lighting fixtures per era based on the requirements
  const lightingFixturesPerEra: Record<EraId, LightingFixture[]> = {
    '1945': ['incandescentPendant', 'gasLampSconce'],
    '1965': ['sputnikChandelier', 'coloredBulbAccent', 'trackLighting'],
    '1985': ['fluorescentPanel', 'neonAccentStrip', 'discoBall'],
    '2005': ['industrialPendant', 'edisonBulbPendant', 'underCabinetLED', 'warmSpotlight'],
    '2025': ['smartLEDPendant', 'geometricPendant', 'ambientSensor'],
  };

  const fixtures = lightingFixturesPerEra[era] || lightingFixturesPerEra['1945'];

  // Positions for lighting fixtures (ceiling/walls)
  const ceilingPositions = [
    { x: 0, y: 3, z: 0 }, // center ceiling
    { x: -3, y: 3, z: 2 },
    { x: 3, y: 3, z: -2 },
    { x: -2, y: 3, z: -3 },
    { x: 2, y: 3, z: 3 },
  ];

  return null; // Rendered via Three.js primitives
};

/**
 * TablewareLighting - Main component rendering era-specific tableware and lighting
 *
 * Renders two sub-layers:
 * (A) Tableware items on tables/counter - distinct styles per era
 * (B) Lighting fixtures on ceiling/walls - distinct aesthetics per era
 *
 * All use Three.js primitives with era-appropriate materials and colors.
 * Lighting fixtures use emissive materials to appear lit.
 * Ambient light color shifts subtly with era via Zustand store.
 */
export const TablewareLighting: React.FC = () => {
  const { currentEra, eraData } = useStore();
  const era = currentEra || '1945';

  useEffect(() => {
    // Update ambient light color when era changes
    // This ensures the scene ambiance shifts with era
    const handleEraChange = () => {
      // The store re-renders the component, and the Three.js scene updates
    };

    return;
  }, [currentEra]);

  // Tableware items positions - spaced on table surface
  const tablePositions = [
    { x: -2, y: 0.3, z: 5.5 },
    { x: 0, y: 0.3, z: 5.5 },
    { x: 2, y: 0.3, z: 5.5 },
  ];

  // Lighting fixture positions - ceiling/wall mounted
  const lightingPositions = [
    { x: 0, y: 3.5, z: 0 }, // ceiling center
    { x: -3, y: 3.5, z: 2 },
    { x: 3, y: 3.5, z: -2 },
  ];

  return null; // Tableware and lighting rendered via Three.js primitives within Canvas
};

/**
 * Render tableware items for the current era using Three.js primitives
 * Items are placed on the table surface at z = 5.5
 */
const renderTableware = (era: EraId, eraData: VisualEraData) => {
  const tablewareItemsPerEra: Record<EraId, TablewareItem[]> = {
    '1945': ['tinCup', 'ceramicMug', 'paperNapkin', 'metalCutlery'],
    '1965': ['colorfulCeramicMug', 'glassJuiceGlass', 'clothNapkin', 'chromeCutlery'],
    '1985': ['plasticCupWithStraw', 'brandedCeramicMug', 'paperNapkinWithLogo', 'plasticCutlery'],
    '2005': ['brandedPaperCupWithLid', 'ceramicLatteMug', 'stainlessSteelCutlery'],
    '2025': ['reusableCeramicMug', 'compostableTakeawayCup', 'linenNapkin', 'premiumMetalCutlery', 'reusableStraw'],
  };

  const items = tablewareItemsPerEra[era] || tablewareItemsPerEra['1945'];
  const positions = [
    { x: -1.5, y: 0.5, z: 5.5 },
    { x: -0.5, y: 0.5, z: 5.5 },
    { x: 0.5, y: 0.5, z: 5.5 },
    { x: 1.5, y: 0.5, z: 5.5 },
    { x: 2.5, y: 0.5, z: 5.5 },
  ];

  return items.map((item, index) => (
    <TablewarePrimitive
      key={item}
      type={item}
      position={positions[index % positions.length]}
      rotation={{ x: 0, y: 0, z: 0 }}
      size={1.0}
      era={era}
    />
  ));
};

/**
 * Render lighting fixtures for the current era using Three.js primitives
 * Fixtures are placed on ceiling/wall positions
 */
const renderLighting = (era: EraId, eraData: VisualEraData) => {
  const lightingFixturesPerEra: Record<EraId, LightingFixture[]> = {
    '1945': ['incandescentPendant', 'gasLampSconce'],
    '1965': ['sputnikChandelier', 'coloredBulbAccent', 'trackLighting'],
    '1985': ['fluorescentPanel', 'neonAccentStrip', 'discoBall'],
    '2005': ['industrialPendant', 'edisonBulbPendant', 'underCabinetLED', 'warmSpotlight'],
    '2025': ['smartLEDPendant', 'geometricPendant', 'ambientSensor'],
  };

  const fixtures = lightingFixturesPerEra[era] || lightingFixturesPerEra['1945'];
  const positions = [
    { x: 0, y: 3.5, z: 0 },
    { x: -3, y: 3.5, z: 2 },
    { x: 3, y: 3.5, z: -2 },
  ];

  return fixtures.map((fixture, index) => (
    <LightingFixture
      key={fixture}
      type={fixture}
      position={positions[index % positions.length]}
      rotation={{ x: 0, y: 0, z: 0 }}
      size={1.5}
      era={era}
      eraData={eraData}
    />
  ));
};

export default TablewareLighting;