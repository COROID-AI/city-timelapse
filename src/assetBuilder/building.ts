import * as THREE from 'three';
import type { EraId } from '../eras.js';
import type { AssetBuilder, BuildingConfig as IBuildingConfig } from './assetSet.js';

/**
 * Building configuration for era-specific architectural styles
 * Implements BaseAssetConfig with building-specific properties
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
 * Implements AssetBuilder<BuildingConfig>
 */
export const buildingBuilder: AssetBuilder<BuildingConfig> = {
  create(config: BuildingConfig): THREE.Group {
    return createBuilding(config);
  },
  getEraId(asset: THREE.Group): EraId | undefined {
    return asset.userData?.eraId;
  },
  getAssetType(): string {
    return 'building';
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
 * Adds brick facade window details with varied window styles for 1945-1965
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
    // Vary window style based on floor for visual richness
    const isBayWindow = f % 3 === 1;
    const isDoubleHung = f % 3 === 0;
    
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (isBayWindow) {
          // Create bay window projection
          const bayGeometry = new THREE.BoxGeometry(1.5, 1.5, 1);
          const bay = new THREE.Mesh(bayGeometry, windowMaterial);
          bay.position.set(
            -width / 2 + 1 + c * 2,
            f * 2 + 1.5,
            -depth / 2 + 1 + r * 2 + 0.3
          );
          group.add(bay);
        } else {
          const window = new THREE.Mesh(windowGeometry, windowMaterial);
          window.position.set(
            -width / 2 + 1 + c * 2,
            f * 2 + 1.5,
            -depth / 2 + 1 + r * 2
          );
          group.add(window);
        }
        
        // Add window sill for double-hung style
        if (isDoubleHung) {
          const sillGeometry = new THREE.BoxGeometry(1.2, 0.2, 0.1);
          const sillMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B4513,
            roughness: 0.7
          });
          const sill = new THREE.Mesh(sillGeometry, sillMaterial);
          sill.position.set(
            -width / 2 + 1 + c * 2,
            f * 2 + 0.9,
            -depth / 2 + 1.1 + r * 2
          );
          group.add(sill);
        }
      }
    }
  }
}

/**
 * Adds glass facade details with varied styles per era
 */
function addGlassFacadeDetails(group: THREE.Group, width: number, height: number, depth: number, eraId: EraId): void {
  if (eraId === '1985') {
    // 1985: Reflective glass strips with corporate grid pattern
    const stripGeometry = new THREE.BoxGeometry(0.3, height * 0.9, depth);
    const stripMaterial = new THREE.MeshStandardMaterial({
      color: 0x87CEEB,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.4
    });

    const strips = Math.floor(width / 2);
    for (let s = 0; s < strips; s++) {
      const strip = new THREE.Mesh(stripGeometry, stripMaterial);
      strip.position.set(-width / 2 + 1 + s * 2, height / 2, 0);
      strip.castShadow = true;
      group.add(strip);
    }
    
    // Add frame details
    const frameGeometry = new THREE.BoxGeometry(width, 0.2, 0.1);
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.5,
      metalness: 0.7
    });
    
    const frameHoriz = new THREE.Mesh(frameGeometry, frameMaterial);
    frameHoriz.position.set(0, height - 2, depth / 2 + 0.05);
    group.add(frameHoriz);
    
    // Add vertical mullions
    const mullionGeometry = new THREE.BoxGeometry(0.15, height * 0.8, 0.15);
    for (let m = 0; m < 5; m++) {
      const mullion = new THREE.Mesh(mullionGeometry, frameMaterial);
      mullion.position.set(-width / 2 + m * width / 4, height / 2, depth / 2 + 0.1);
      group.add(mullion);
    }
  } else {
    // 2005/2025: Smart glass with LED accents
    const stripGeometry = new THREE.BoxGeometry(0.5, height * 0.9, depth);
    const stripMaterial = new THREE.MeshStandardMaterial({
      color: 0x87CEEB,
      roughness: 0.05,
      metalness: 0.95,
      transparent: true,
      opacity: 0.2
    });

    const strips = Math.floor(width / 2);
    for (let s = 0; s < strips; s++) {
      const strip = new THREE.Mesh(stripGeometry, stripMaterial);
      strip.position.set(-width / 2 + 1 + s * 2, height / 2, 0);
      strip.castShadow = true;
      group.add(strip);
      
      // Add LED strip accent for 2005+
      if (eraId === '2025') {
        const ledGeometry = new THREE.BoxGeometry(0.05, 0.5, 0.05);
        const ledMaterial = new THREE.MeshStandardMaterial({
          color: 0x00CED1,
          emissive: 0x00CED1,
          roughness: 0.1,
          metalness: 0.9
        });
        
        for (let l = 0; l < 3; l++) {
          const led = new THREE.Mesh(ledGeometry, ledMaterial);
          led.position.set(-width / 2 + 1 + s * 2, 3 + l * 3, depth / 2 + 0.03);
          group.add(led);
        }
      }
    }
  }
}

/**
 * Adds biophilic facade details for future era
 */
function addBiophilicFacadeDetails(group: THREE.Group, width: number, height: number, depth: number): void {
  // Add living wall panels with varied heights
  const panelGeometry = new THREE.BoxGeometry(width * 0.8, height * 0.3, 0.5);
  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0x98FB98,
    roughness: 0.6,
    metalness: 0.2,
    emissive: 0x98FB98,
    emissiveIntensity: 0.3
  });

  for (let p = 0; p < 5; p++) {
    const panel = new THREE.Mesh(panelGeometry, panelMaterial);
    panel.position.set(0, 3 + p * 8, depth / 2 + 0.25);
    group.add(panel);
    
    // Add glowing accent to each panel
    const accentGeometry = new THREE.BoxGeometry(width * 0.8, 0.3, 0.1);
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: 0x00CED1,
      emissive: 0x00CED1,
      roughness: 0.1,
      metalness: 0.8
    });
    const accent = new THREE.Mesh(accentGeometry, accentMaterial);
    accent.position.set(0, 3 + p * 8, depth / 2 + 0.5);
    group.add(accent);
  }

  // Add integrated LED strips along the top
  const ledGeometry = new THREE.BoxGeometry(width, 0.2, 0.1);
  const ledMaterial = new THREE.MeshStandardMaterial({
    color: 0x00CED1,
    emissive: 0x00CED1,
    roughness: 0.1,
    metalness: 0.9
  });

  const ledStrip = new THREE.Mesh(ledGeometry, ledMaterial);
  ledStrip.position.set(0, height - 1, depth / 2 + 0.1);
  group.add(ledStrip);
  
  // Add holographic projections
  const holoGeometry = new THREE.PlaneGeometry(3, 5);
  const holoMaterial = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF,
    emissive: 0x00CED1,
    roughness: 0.1,
    metalness: 0.8,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide
  });
  
  for (let h = 0; h < 3; h++) {
    const holo = new THREE.Mesh(holoGeometry, holoMaterial);
    holo.position.set(-width / 3 + h * width / 3, height / 2, depth / 2 + 0.6);
    group.add(holo);
  }
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