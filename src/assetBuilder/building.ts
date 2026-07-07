import * as THREE from 'three';
import type { EraId } from '../eras.js';

/**
 * Building configuration for era-specific architectural styles
 */
export interface BuildingConfig {
  position: [number, number, number];
  eraId: EraId;
  buildingType: 'residential' | 'commercial' | 'industrial' | 'skyscraper';
}

/**
 * Era-specific building styles
 */
const BUILDING_STYLES: Record<EraId, {
  heightRange: [number, number];
  colors: number[];
  windowStyles: string[];
  architecturalFeatures: string[];
}> = {
  '1945': {
    heightRange: [4, 8],
    colors: [0x8B4513, 0xCD853F, 0xA0522D, 0x654321],
    windowStyles: ['small-pane', 'double-hung', 'bay-window'],
    architecturalFeatures: ['brick-facade', 'fire-escape', 'ornate-cornice', 'awnings']
  },
  '1965': {
    heightRange: [6, 12],
    colors: [0x9370DB, 0x4169E1, 0x8B008B, 0x2F4F4F],
    windowStyles: ['large-pane', 'casement', 'picture-window'],
    architecturalFeatures: ['modern-brick', 'mid-century-modern', 'flat-roof', 'minimal-ornamentation']
  },
  '1985': {
    heightRange: [10, 20],
    colors: [0x2F4F4F, 0x708090, 0x778899, 0x2C3539],
    windowStyles: ['glass-curtain', 'reflective-glass', 'strip-windows'],
    architecturalFeatures: ['glass-façade', 'steel-frame', 'concrete', 'geometric-patterns']
  },
  '2005': {
    heightRange: [15, 30],
    colors: [0x000080, 0x87CEEB, 0xFFFFFF, 0xC0C0C0],
    windowStyles: ['floor-to-ceiling', 'energy-efficient', 'smart-glass'],
    architecturalFeatures: ['postmodern', 'mixed-materials', 'curtain-wall', 'LED-facade']
  },
  '2025': {
    heightRange: [20, 40],
    colors: [0x00CED1, 0x1E90FF, 0x87CEFA, 0x98FB98],
    windowStyles: ['smart-glass', 'electrochromic', 'transparent-solar'],
    architecturalFeatures: ['biophilic', 'smart-surfaces', 'carbon-fiber', 'dynamic-facade']
  }
};

/**
 * Creates a building mesh with era-appropriate architectural style
 */
export function createBuilding(config: BuildingConfig): THREE.Group {
  const group = new THREE.Group();
  const styles = BUILDING_STYLES[config.eraId];
  const [minHeight, maxHeight] = styles.heightRange;
  const height = minHeight + Math.random() * (maxHeight - minHeight);
  const width = 8 + Math.random() * 4;
  const depth = 8 + Math.random() * 4;

  // Main building structure
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(styles.colors[Math.floor(Math.random() * styles.colors.length)]),
    roughness: 0.7,
    metalness: 0.3
  });

  const building = new THREE.Mesh(geometry, material);
  building.position.y = height / 2;
  building.castShadow = true;
  building.receiveShadow = true;
  group.add(building);

  // Add era-specific architectural details
  addArchitecturalDetails(group, building, config.eraId, width, height, depth, styles);

  // Position the building
  group.position.set(config.position[0], config.position[1], config.position[2]);

  // Store metadata
  group.userData = {
    eraId: config.eraId,
    buildingType: config.buildingType,
    selectable: true
  };

  return group;
}

/**
 * Adds era-specific architectural details to a building
 */
function addArchitecturalDetails(
  group: THREE.Group,
  building: THREE.Mesh,
  eraId: EraId,
  width: number,
  height: number,
  depth: number,
  styles: typeof BUILDING_STYLES[EraId]
): void {
  const features = styles.architecturalFeatures;

  // Add windows based on era style
  if (features.includes('brick-facade') || features.includes('modern-brick')) {
    addBrickFacadeDetails(group, width, height, depth);
  } else if (features.includes('glass-façade') || features.includes('curtain-wall')) {
    addGlassFacadeDetails(group, width, height, depth, eraId);
  } else if (features.includes('biophilic')) {
    addBiophilicFacadeDetails(group, width, height, depth);
  }

  // Add fire escapes for 1945-1965
  if (features.includes('fire-escape') && eraId !== '1985' && eraId !== '2005' && eraId !== '2025') {
    addFireEscape(group, width, height);
  }

  // Add awnings for earlier eras
  if (features.includes('awnings') && eraId === '1945') {
    addAwning(group, width, height);
  }
}

/**
 * Adds brick facade window details
 */
function addBrickFacadeDetails(group: THREE.Group, width: number, height: number, depth: number): void {
  const windowGeometry = new THREE.BoxGeometry(1, 1.5, 0.2);
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0xADD8E6,
    roughness: 0.3,
    metalness: 0.6
  });

  const floors = Math.floor(height / 2);
  const cols = Math.floor(width / 2);
  const rows = Math.floor(depth / 2);

  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const window = new THREE.Mesh(windowGeometry, windowMaterial);
        window.position.set(
          -width / 2 + 1 + c * 2,
          f * 2 + 1.5,
          -depth / 2 + 1 + r * 2
        );
        group.add(window);
      }
    }
  }
}

/**
 * Adds glass facade details
 */
function addGlassFacadeDetails(group: THREE.Group, width: number, height: number, depth: number, eraId: EraId): void {
  const stripWidth = eraId === '1985' ? 0.3 : 0.5;
  const stripGeometry = new THREE.BoxGeometry(stripWidth, height * 0.9, depth);
  const stripMaterial = new THREE.MeshStandardMaterial({
    color: 0x87CEEB,
    roughness: 0.1,
    metalness: 0.9,
    transparent: true,
    opacity: eraId === '1985' ? 0.4 : 0.3
  });

  const strips = Math.floor(width / 2);
  for (let s = 0; s < strips; s++) {
    const strip = new THREE.Mesh(stripGeometry, stripMaterial);
    strip.position.set(-width / 2 + 1 + s * 2, height / 2, 0);
    strip.castShadow = true;
    group.add(strip);
  }
}

/**
 * Adds biophilic facade details for future era
 */
function addBiophilicFacadeDetails(group: THREE.Group, width: number, height: number, depth: number): void {
  // Add living wall panels
  const panelGeometry = new THREE.BoxGeometry(width * 0.8, height * 0.3, 0.5);
  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0x98FB98,
    roughness: 0.6,
    metalness: 0.2
  });

  for (let p = 0; p < 3; p++) {
    const panel = new THREE.Mesh(panelGeometry, panelMaterial);
    panel.position.set(0, 5 + p * 10, depth / 2 + 0.25);
    group.add(panel);
  }

  // Add integrated LED strips
  const ledGeometry = new THREE.BoxGeometry(width, 0.2, 0.1);
  const ledMaterial = new THREE.MeshStandardMaterial({
    color: 0x00CED1,
    emissive: 0x00CED1,
    roughness: 0.3
  });

  const ledStrip = new THREE.Mesh(ledGeometry, ledMaterial);
  ledStrip.position.set(0, height - 2, depth / 2 + 0.1);
  group.add(ledStrip);
}

/**
 * Adds fire escape for historical eras
 */
function addFireEscape(group: THREE.Group, width: number, height: number): void {
  const ladderGeometry = new THREE.CylinderGeometry(0.1, 0.1, 2);
  const platformGeometry = new THREE.BoxGeometry(2, 0.1, 2);
  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0x808080,
    roughness: 0.5,
    metalness: 0.8
  });

  const platforms = Math.floor(height / 3);
  for (let p = 0; p < platforms; p++) {
    const platform = new THREE.Mesh(platformGeometry, metalMaterial);
    platform.position.set(width / 2 + 1, p * 3 + 1.5, 0);
    group.add(platform);

    const ladder = new THREE.Mesh(ladderGeometry, metalMaterial);
    ladder.position.set(width / 2 + 1, p * 3 + 3, 0);
    group.add(ladder);
  }
}

/**
 * Adds awning for 1945 era storefronts
 */
function addAwning(group: THREE.Group, width: number, height: number): void {
  const awningGeometry = new THREE.BoxGeometry(width * 0.6, 0.2, 0.1);
  const awningMaterial = new THREE.MeshStandardMaterial({
    color: 0x8B4513,
    roughness: 0.8
  });

  const awning = new THREE.Mesh(awningGeometry, awningMaterial);
  awning.position.set(0, height * 0.3, width / 2 + 0.5);
  group.add(awning);
}