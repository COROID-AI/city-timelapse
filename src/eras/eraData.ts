import * as THREE from 'three';

export interface EraData {
  year: number
  primaryColors: string[]
  ambientLightColor: string
  ambientLightIntensity: number
  fogDensity: number
  fogColor: string
  buildingStyles: BuildingStyle[]
  vehicleTypes: string[]
  pedestrianPalette: PedestrianOutfit[]
  storefrontTemplates: StorefrontTemplate[]
  signageStyle: SignageStyle
  streetFurniture: StreetFurniture[]
  ambientAudioTrack: string
  dayCycleHour: number
  directionalLightHorizontalAngle: number  // Hours from south, 0-24 mapped to 0-360 degrees
  directionalLightVerticalAngle: number    // Elevation angle, 0-90 degrees (positive = up)
}

export type EraKey = '1945' | '1965' | '1985' | '2005' | '2025'

export interface BuildingStyle {
  name: string
  description: string
  roofType: 'flat' | 'pitched' | 'dome' | 'gabled'
  facadeMaterial: 'brick' | 'concrete' | 'glass' | 'steel' | 'wood'
  windowStyle: 'small' | 'medium' | 'large' | 'floor_to_ceiling'
  architecturalDetails: string[]
}

export interface VehicleType {
  name: string
  era: string
  description: string
}

export interface PedestrianOutfit {
  name: string
  description: string
  dominantColors: string[]
}

export interface StorefrontTemplate {
  name: string
  description: string
  windowType: 'display' | 'access' | 'combo'
  signageMount: 'awned' | 'wall-mounted' | 'projecting'
}

export interface SignageStyle {
  font: 'serif' | 'sans' | 'deco' | 'retro'
  colors: string[]
  illumination: 'gas' | 'electric' | 'led' | 'neon'
  typicalText: string
}

export interface StreetFurniture {
  name: string
  era: string
  description: string
}

/** Era vehicle definitions for each decade */
const ERA_VEHICLE_DEFINITIONS: Record<string, { vehicleTypes: string[] }> = {
  '1985': {
    vehicleTypes: ['boxy_sedan', 'sport_coupe', 'minivan', 'delivery_truck', 'city_bus', 'taxi_cab', 'hybrid_concept']
  },
  '1945': {
    vehicleTypes: ['vintage_sedan', 'streetcar', 'horse_wagon', 'fire_engine']
  },
  '1965': {
    vehicleTypes: ['classic_car', 'truck', 'bus', 'vintage_bus']
  },
  '2005': {
    vehicleTypes: ['sedan', 'ev']
  },
  '2025': {
    vehicleTypes: ['ev', 'autonomous', 'drone']
  }
}

/** Get vehicle types for a given era */
export function getEraVehicleTypes(era: EraKey): string[] {
  return ERA_VEHICLE_DEFINITIONS[era]?.vehicleTypes || []
}

/** Era data snapshots for transition engine */
export interface EraDataSnapshot {
  ambientLightColor: string
  ambientLightIntensity: number
  fogDensity: number
  fogColor: string
  directionalLightHorizontalAngle: number
  directionalLightVerticalAngle: number
  buildingBaseColor: string
  buildingEmissive: string
  pedestrianDominantColors: string[]
  vehicleTypes: string[]
  storefrontTemplateCount: number
  signageIllumination: string
}

/** Apply era-specific styles to the scene based on selected year. Updates background color and logs the era being applied. @param scene Three.js scene to update @param year The selected year (1945, 1965, 1985, 2005, 2025) */
export function applyEraStyle(scene: THREE.Scene, year: number): void {
  const era = ERAS[year as keyof typeof ERAS]
  if (!era) return

  // Update scene background color based on era
  scene.background = new THREE.Color(
    parseInt(era.colors.sky.replace('#', ''), 16) / 255,
    parseInt(era.colors.sky.replace('#', ''), 16) / 255,
    parseInt(era.colors.sky.replace('#', ''), 16) / 255
  )

  // Remove existing era-specific objects from previous transitions
  scene.traverse((child) => {
    if (child.userData?.isEraObject) {
      child.geometry.dispose()
      child.material.dispose()
      scene.remove(child)
    }
  })

  // Log the era being applied
  console.log(`Applied era: ${era.name} - ${era.description}`)
}

const ROAD_WIDTH = 12 // meters - width of one lane
const CENTER_LINE_WIDTH = 0.15 // meters
const CROSSWALK_WIDTH = 5 // meters - width of crosswalk area
const CURB_HEIGHT = 0.15 // meters
const SIDEWALK_WIDTH = 4 // meters

/** Era-specific pavement material definitions */
const ERA_PAVEMENT_MATERIALS: Record<EraKey, {
  roadBaseColor: string
  roadTextureScale: number
  curbColor: string
  crosswalkColor: string
  centerLineColor: string
}> = {
  '1945': {
    roadBaseColor: '#2F4F4F',
    roadTextureScale: 20,
    curbColor: '#8B4513',
    crosswalkColor: '#FFFFFF',
    centerLineColor: '#FFFFFF'
  },
  '1965': {
    roadBaseColor: '#2C3E50',
    roadTextureScale: 50,
    curbColor: '#F1C40F',
    crosswalkColor: '#FFFFFF',
    centerLineColor: '#FFFFFF'
  },
  '1985': {
    roadBaseColor: '#5D4037',
    roadTextureScale: 50,
    curbColor: '#E67E22',
    crosswalkColor: '#FFFFFF',
    centerLineColor: '#FFFFFF'
  },
  '2005': {
    roadBaseColor: '#34495E',
    roadTextureScale: 50,
    curbColor: '#95A5A6',
    crosswalkColor: '#FFFFFF',
    centerLineColor: '#FFFFFF'
  },
  '2025': {
    roadBaseColor: '#ECF0F1',
    roadTextureScale: 50,
    curbColor: '#BDC3C7',
    crosswalkColor: '#FFFFFF',
    centerLineColor: '#FFFFFF'
  },
}

export const ERAS = {
  '1945': {
    year: 1945,
    primaryColors: ['#8B4513', '#CD853F', '#2F4F4F'],
    ambientLightColor: '#FFDAB9',
    ambientLightIntensity: 1.5,
    fogDensity: 0.004,
    fogColor: '#6B8E23',
    buildingStyles: [
      {
        name: 'prewar',
        description: 'Art Deco and early modernist',
        roofType: 'flat',
        facadeMaterial: 'brick',
        windowStyle: 'small',
        architecturalDetails: ['cornices', 'pilasters', 'ornate moldings']
      },
      {
        name: 'industrial',
        description: 'Post-war reconstruction',
        roofType: 'flat',
        facadeMaterial: 'concrete',
        windowStyle: 'medium',
        architecturalDetails: ['steel beams', 'large windows', 'fire escapes']
      }
    ],
    vehicleTypes: ['vintage_sedan', 'truck', 'streetcar', 'horse_wagon', 'milk_truck', 'fire_engine', 'bicycle'],
    eraSpecificData: {
      description: '1940s era with Art Deco and post-war design'
    }
  },
  '1965': {
    year: 1965,
    primaryColors: ['#1A5E99', '#F1C40F', '#E67E22', '#2C3E50'],
    ambientLightColor: '#E0F7FA',
    ambientLightIntensity: 1.8,
    fogDensity: 0.005,
    fogColor: '#7F8C8D',
    buildingStyles: [
      {
        name: 'renovated_brick',
        description: 'Renovated brick with modern storefronts',
        roofType: 'flat',
        facadeMaterial: 'brick',
        windowStyle: 'large',
        architecturalDetails: ['concrete additions', 'air conditioning units', 'neon tube signs']
      },
      {
        name: 'mid_rise_office',
        description: 'Mid-rise office building (2-3 stories) with horizontal window banding',
        roofType: 'flat',
        facadeMaterial: 'concrete',
        windowStyle: 'floor_to_ceiling',
        architecturalDetails: ['horizontal window bands', 'aluminum framing', 'signage mounting']
      },
      {
        name: 'diner',
        description: 'Diner with classic chrome trim and neon sign',
        roofType: 'flat',
        facadeMaterial: 'steel',
        windowStyle: 'large',
        architecturalDetails: ['chrome trim', 'neon tube signs', 'printed vinyl signage']
      },
      {
        name: 'department_store',
        description: 'Department store with large display windows',
        roofType: 'flat',
        facadeMaterial: 'glass',
        windowStyle: 'floor_to_ceiling',
        architecturalDetails: ['large display windows', 'printed vinyl signage', 'aluminum framing']
      }
    ],
    vehicleTypes: ['classic_car', 'truck', 'bus', 'vintage_bus'],
    eraSpecificData: {
      description: '1960s era with chrome and neon design'
    }
  },
  '1985': {
    year: 1985,
    primaryColors: ['#5D4037', '#E67E22', '#ECF0F1'],
    ambientLightColor: '#F5D6C1',
    ambientLightIntensity: 1.2,
    fogDensity: 0.006,
    fogColor: '#964B00',
    buildingStyles: [
      {
        name: 'postmodern',
        description: 'Postmodern commercial',
        roofType: 'flat',
        facadeMaterial: 'concrete',
        windowStyle: 'medium',
        architecturalDetails: ['decorative panels', 'colored glass', 'atrium']
      },
      {
        name: 'retail_park',
        description: 'Strip retail development',
        roofType: 'pitched',
        facadeMaterial: 'wood',
        windowStyle: 'large',
        architecturalDetails: ['canopy', 'signage panels', 'parking']
      },
      {
        name: 'brutalist',
        description: 'Brutalist concrete architecture',
        roofType: 'flat',
        facadeMaterial: 'concrete',
        windowStyle: 'medium',
        architecturalDetails: ['exposed concrete', 'geometric forms', 'massive scale']
      },
      {
        name: 'retail',
        description: '1980s retail with neon trim',
        roofType: 'flat',
        facadeMaterial: 'concrete',
        windowStyle: 'large',
        architecturalDetails: ['window displays', 'neon strips', 'awning']
      },
      {
        name: 'glass_curtain',
        description: '1985 glass curtain wall',
        roofType: 'flat',
        facadeMaterial: 'glass',
        windowStyle: 'floor_to_ceiling',
        architecturalDetails: ['aluminum framing', 'spandrel panels', 'reflective coating', 'environment map']
      },
      {
        name: 'retail_restoration',
        description: '1985 brick restoration w',
      },
      {
        name: 'mixed_use',
        description: 'Mixed-use development',
        roofType: 'flat',
        facadeMaterial: 'concrete',
        windowStyle: 'medium',
        architecturalDetails: ['balconies', 'signage', 'green roof']
      },
      {
        name: 'converted_warehouse',
        description: 'Industrial-chic converted warehouse',
        roofType: 'flat',
        facadeMaterial: 'weathered_brick',
        windowStyle: 'large',
        architecturalDetails: ['preserved structural beams', 'loft conversions', 'solar panels', 'green roof']
      },
      {
        name: 'boutique_hotel',
        description: 'Boutique hotel with modern facade',
        roofType: 'flat',
        facadeMaterial: 'concrete_and_glass',
        windowStyle: 'floor_to_ceiling',
        architecturalDetails: ['automated sliding doors', 'balconies', 'solar panels', 'green roof']
      },
      {
        name: 'coffee_shop',
        description: 'Coffee shop chain with outdoor seating',
        roofType: 'flat',
        facadeMaterial: 'stucco',
        windowStyle: 'display',
        architecturalDetails: ['outdoor seating', 'digital menu board', 'automated doors', 'umbrellas']
      },
      {
        name: 'tech_startup',
        description: 'Tech startup office with glass entrance',
        roofType: 'flat',
        facadeMaterial: 'glass_and_steel',
        windowStyle: 'large',
        architecturalDetails: ['glass entrance', 'digital displays', 'solar panels', 'green roof']
      }
    ],
    eraSpecificData: {
      description: '1985-era vehicles reflecting the decade\'s shift toward aerodynamic efficiency, Japanese market influence, and the birth of the minivan segment'
    },
    vehicleTypes: ['boxy_sedan', 'sport_coupe', 'minivan', 'delivery_truck', 'city_bus', 'taxi_cab', 'hybrid_concept']
  },
  '2005': {
    year: 2005,
    primaryColors: ['#34495E', '#95A5A6'],
    ambientLightColor: '#ECF0F1',
    ambientLightIntensity: 1.0,
    fogDensity: 0.003,
    fogColor: '#2C3E50',
    buildingStyles: [
      {
        name: 'sustainable',
        description: 'Sustainable modular construction',
        roofType: 'flat',
        facadeMaterial: 'recycled_glass',
        windowStyle: 'floor_to_ceiling',
        architecturalDetails: ['living walls', 'solar panels', 'rainwater collection']
      },
      {
        name: 'smart_city',
        description: 'Smart glass and steel tower',
        roofType: 'flat',
        facadeMaterial: 'glass_and_steel',
        windowStyle: 'floor_to_ceiling',
        architecturalDetails: ['interactive facade', 'digital displays', 'energy monitoring']
      },
      {
        name: 'neo_brutalist',
        description: 'Neo-brutalist concrete with programmable LEDs',
        roofType: 'flat',
        facadeMaterial: 'concrete',
        windowStyle: 'medium',
        architecturalDetails: ['programmable LED strips', 'geometric cutouts', 'sensory lighting']
      }
    ],
    vehicleTypes: ['ev', 'autonomous', 'drone'],
    eraSpecificData: {
      description: '2000s era with sustainable and smart city design'
    }
  },
  '2025': {
    year: 2025,
    primaryColors: ['#2C3E50', '#E67E22', '#F1C40F'],
    ambientLightColor: '#ECF0F1',
    ambientLightIntensity: 1.0,
    fogDensity: 0.003,
    fogColor: '#2C3E50',
    buildingStyles: [
      {
        name: 'sustainable',
        description: 'Sustainable modular construction',
        roofType: 'flat',
        facadeMaterial: 'recycled_glass',
        windowStyle: 'floor_to_ceiling',
        architecturalDetails: ['living walls', 'solar panels', 'rainwater collection']
      },
      {
        name: 'smart_city',
        description: 'Smart glass and steel tower',
        roofType: 'flat',
        facadeMaterial: 'glass_and_steel',
        windowStyle: 'floor_to_ceiling',
        architecturalDetails: ['interactive facade', 'digital displays', 'energy monitoring']
      },
      {
        name: 'neo_brutalist',
        description: 'Neo-brutalist concrete with programmable LEDs',
        roofType: 'flat',
        facadeMaterial: 'concrete',
        windowStyle: 'medium',
        architecturalDetails: ['programmable LED strips', 'geometric cutouts', 'sensory lighting']
      }
    ],
    vehicleTypes: ['ev', 'autonomous', 'drone'],
    eraSpecificData: {
      description: '2025-era sustainable smart city'
    }
  }
};

/** Create wider lanes with painted turn arrows on road surface */
export function createWiderLanesWithTurnArrows(era: EraKey, scene: THREE.Scene): void {
  const pavementMaterials = ERA_PAVEMENT_MATERIALS[era];
  if (!pavementMaterials) return;

  // Road color
  const roadColor = new THREE.Color(pavementMaterials.roadBaseColor);

  // Create road surface material
  const roadMaterial = new THREE.MeshStandardMaterial({
    color: roadColor,
    roughness: 0.8,
    metalness: 0.2
  });

  // Create the road plane (200m x 20m - wider than standard)
  const roadGeometry = new THREE.PlaneGeometry(200, 20);
  roadGeometry.rotateX(-Math.PI / 2);
  const road = new THREE.Mesh(roadGeometry, roadMaterial);
  road.position.y = 0.01;
  scene.add(road);

  // Paint turn arrows on the road surface
  const turnArrowColor = new THREE.Color('#FFFFFF');
  const arrowMaterial = new THREE.MeshStandardMaterial({
    color: turnArrowColor,
    roughness: 0.9,
    metalness: 0.1
  });

  // Paint ">" turn arrows every 20 meters along the road
  const arrowSize = 4; // meters
  const arrowSpacing = 25; // meters between arrows
  const numArrows = Math.floor(200 / arrowSpacing);

  for (let i = 0; i < numArrows; i++) {
    const arrowX = -100 + (i * arrowSpacing) + arrowSize / 2; // Center the road at X=0
    
    // Create a simple triangular arrow shape
    const arrowGeometry = new THREE.PlaneGeometry(arrowSize, arrowSize * 1.5);
    arrowGeometry.rotateX(-Math.PI / 2);
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.position.set(arrowX, 0.02, 10); // Position on road at Z=10
    arrow.rotation.z = Math.PI; // Point in positive Z direction
    scene.add(arrow);

    // Create reverse arrow on other lane
    const reverseArrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    reverseArrow.position.set(arrowX, 0.02, -10); // Position on road at Z=-10
    reverseArrow.rotation.z = 0; // Point in negative Z direction
    scene.add(reverseArrow);
  }

  // Create center line
  const centerLineGeometry = new THREE.PlaneGeometry(200, CENTER_LINE_WIDTH);
  centerLineGeometry.rotateX(-Math.PI / 2);
  const centerLineMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(pavementMaterials.centerLineColor),
    roughness: 0.9,
    metalness: 0.1
  });
  const centerLine = new THREE.Mesh(centerLineGeometry, centerLineMaterial);
  centerLine.position.y = 0.02;
  centerLine.position.z = 10; // Center line at one side
  scene.add(centerLine);

  // Create crosswalk areas at intervals
  const crosswalkColor = new THREE.Color(pavementMaterials.crosswalkColor);
  const crosswalkMaterial = new THREE.MeshStandardMaterial({
    color: crosswalkColor,
    roughness: 0.8,
    metalness: 0.1
  });

  // Crosswalk every 50 meters
  const crosswalkLength = 8; // meters
  const crosswalkSpacing = 50; // meters
  const numCrosswalks = Math.floor(200 / crosswalkSpacing);

  for (let i = 0; i < numCrosswalks; i++) {
    const cwX = -100 + (i * crosswalkSpacing) + crosswalkLength / 2;
    
    const crosswalkGeometry = new THREE.PlaneGeometry(crosswalkLength, CROSSWALK_WIDTH);
    crosswalkGeometry.rotateX(-Math.PI / 2);
    const crosswalk = new THREE.Mesh(crosswalkGeometry, crosswalkMaterial);
    crosswalk.position.set(cwX, 0.02, 0);
    scene.add(crosswalk);
  }
}

/** Create toll booth structure on connecting bridge */
export function createTollBoothOnBridge(bridgeZ: number, scene: THREE.Scene): void {
  // Toll booth base
  const baseGeometry = new THREE.BoxGeometry(4, 0.5, 4);
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#5D4037'),
    roughness: 0.7,
    metalness: 0.3
  });
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  base.position.set(0, 0.25, bridgeZ);
  scene.add(base);

  // Toll booth pillars
  const pillarGeometry = new THREE.BoxGeometry(0.5, 3, 0.5);
  const pillarMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#E67E22'),
    roughness: 0.5,
    metalness: 0.8
  });

  // Four corners
  const pillarPositions = [
    { x: -2, z: bridgeZ },
    { x: 2, z: bridgeZ }
  ];

  pillarPositions.forEach(pos => {
    const leftPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    leftPillar.position.set(pos.x, 1.5, pos.z);
    scene.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    rightPillar.position.set(-pos.x, 1.5, pos.z);
    scene.add(rightPillar);
  });

  // Toll booth roof
  const roofGeometry = new THREE.BoxGeometry(4, 0.3, 3);
  const roofMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#8B4513'),
    roughness: 0.8,
    metalness: 0.1
  });
  const roof = new THREE.Mesh(roofGeometry, roofMaterial);
  roof.position.set(0, 3.15, bridgeZ);
  scene.add(roof);

  // Toll gate arms
  const armGeometry = new THREE.BoxGeometry(8, 0.2, 0.2);
  const armMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#C0C0C0'),
    roughness: 0.5,
    metalness: 0.9
  });

  const leftArm = new THREE.Mesh(armGeometry, armMaterial);
  leftArm.position.set(-4, 1.5, bridgeZ);
  scene.add(leftArm);

  const rightArm = new THREE.Mesh(armGeometry, armMaterial);
  rightArm.position.set(4, 1.5, bridgeZ);
  scene.add(rightArm);

  // Toll booth signage
  const signGeometry = new THREE.BoxGeometry(1, 1, 0.2);
  const signMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#FFFFFF'),
    roughness: 0.3,
    metalness: 0.5
  });
  const sign = new THREE.Mesh(signGeometry, signMaterial);
  sign.position.set(0, 3.6, bridgeZ);
  scene.add(sign);
}

/** Create 1985-era boxy sedan vehicle */
export function createBoxySedan(position: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(position);
  group.userData.isEraObject = true;
  group.userData.vehicleType = 'boxy_sedan';
  group.userData.era = '1985';

  // Boxy sedan body - two-tone paint scheme
  const bodyColor1 = new THREE.Color(0x5D4037); // Dark brown
  const bodyColor2 = new THREE.Color(0xECF0F1); // Light tan/white top
  const bodyGeometry = new THREE.BoxGeometry(4.5, 1.4, 2.2);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor1,
    roughness: 0.3,
    metalness: 0.7
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0.7;
  group.add(body);

  // Lighten top portion of body (two-tone effect)
  const topBodyGeometry = new THREE.BoxGeometry(4.5, 0.6, 2.2);
  const topBodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor2,
    roughness: 0.3,
    metalness: 0.5
  });
  const topBody = new THREE.Mesh(topBodyGeometry, topBodyMaterial);
  topBody.position.y = 1.0;
  group.add(topBody);

  // Chrome bumpers - front
  const bumperGeometry = new THREE.BoxGeometry(0.4, 0.2, 0.1);
  const bumperMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xC0C0C0), // Chrome silver
    roughness: 0.1,
    metalness: 0.9
  });
  const frontBumper = new THREE.Mesh(bumperGeometry, bumperMaterial);
  frontBumper.position.set(2.3, 0.1, 0);
  group.add(frontBumper);

  // Chrome bumpers - rear
  const rearBumper = new THREE.Mesh(bumperGeometry, bumperMaterial);
  rearBumper.position.set(-2.3, 0.1, 0);
  group.add(rearBumper);

  // Wheel covers - alloy wheels visible
  const wheelRadius = 0.7;
  const wheelWidth = 0.25;
  const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 24).rotateX(-Math.PI / 2);
  const wheelCenterCapGeometry = new THREE.CircleGeometry(0.2, 16);
  const wheelCenterCapMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x5D4037), // Dark center cap
    roughness: 0.5,
    metalness: 0.8
  });
  const wheelRimMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xE67E22), // Orange accent
    roughness: 0.3,
    metalness: 0.7
  });

  // Front left wheel with alloy rim
  const frontLeftWheel = new THREE.Mesh(wheelGeometry, wheelRimMaterial);
  frontLeftWheel.position.set(2, 0.4, 1);
  group.add(frontLeftWheel);

  // Front wheel center cap
  const frontLeftCenterCap = new THREE.Mesh(wheelCenterCapGeometry, wheelCenterCapMaterial);
  frontLeftCenterCap.position.set(2, 0.5, 1);
  group.add(frontLeftCenterCap);

  // Front right wheel with alloy rim
  const frontRightWheel = new THREE.Mesh(wheelGeometry, wheelRimMaterial);
  frontRightWheel.position.set(2, 0.4, -1);
  group.add(frontRightWheel);

  // Front right wheel center cap
  const frontRightCenterCap = new THREE.Mesh(wheelCenterCapGeometry, wheelCenterCapMaterial);
  frontRightCenterCap.position.set(2, 0.5, -1);
  group.add(frontRightCenterCap);

  // Rear left wheel with alloy rim
  const rearLeftWheel = new THREE.Mesh(wheelGeometry, wheelRimMaterial);
  rearLeftWheel.position.set(-2, 0.4, 1);
  group.add(rearLeftWheel);

  // Rear left wheel center cap
  const rearLeftCenterCap = new THREE.Mesh(wheelCenterCapGeometry, wheelCenterCapMaterial);
  rearLeftCenterCap.position.set(-2, 0.5, 1);
  group.add(rearLeftCenterCap);

  // Rear right wheel with alloy rim
  const rearRightWheel = new THREE.Mesh(wheelGeometry, wheelRimMaterial);
  rearRightWheel.position.set(-2, 0.4, -1);
  group.add(rearRightWheel);

  // Rear right wheel center cap
  const rearRightCenterCap = new THREE.Mesh(wheelCenterCapGeometry, wheelCenterCapMaterial);
  rearRightCenterCap.position.set(-2, 0.5, -1);
  group.add(rearRightCenterCap);

  // Angular body lines (side trim lines)
  const lineGeometry = new THREE.BoxGeometry(0.05, 1.2, 0.1);
  const lineMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xE67E22), // Orange accent line
    roughness: 0.9,
    metalness: 0.3
  });

  // Front side line
  const frontSideLine = new THREE.Mesh(lineGeometry, lineMaterial);
  frontSideLine.position.set(2.5, 0.6, 0.8);
  frontSideLine.rotation.z = 0.3;
  group.add(frontSideLine);

  // Rear side line
  const rearSideLine = new THREE.Mesh(lineGeometry, lineMaterial);
  rearSideLine.position.set(-2.5, 0.6, -0.8);
  rearSideLine.rotation.z = -0.3;
  group.add(rearSideLine);

  // Roof line accent
  const roofLine = new THREE.Mesh(lineGeometry, lineMaterial);
  roofLine.position.set(0, 1.3, 0);
  roofLine.rotation.z = Math.PI / 4;
  group.add(roofLine);

  return group;
}

/** Create 1985-era sport coupe with pop-up headlights (animated) */
export function createSportCoupe(position: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(position);
  group.userData.isEraObject = true;
  group.userData.vehicleType = 'sport_coupe';
  group.userData.era = '1985';
  group.userData.popupHeadlightState = 'closed'; // 'open' or 'closed'
  group.userData.popupHeadlightAngle = 0;

  // Sport coupe body - vibrant two-tone paint
  const bodyColor1 = new THREE.Color(0xE67E22); // Orange
  const bodyColor2 = new THREE.Color(0x2C3E50); // Dark blue roof
  const bodyGeometry = new THREE.BoxGeometry(4.2, 1.3, 2.0);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor1,
    roughness: 0.3,
    metalness: 0.8
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0.65;
  group.add(body);

  // Dark roof section
  const roofGeometry = new THREE.BoxGeometry(4.2, 0.5, 2.0);
  const roofMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor2,
    roughness: 0.3,
    metalness: 0.8
  });
  const roof = new THREE.Mesh(roofGeometry, roofMaterial);
  roof.position.y = 1.05;
  group.add(roof);

  // Pop-up headlights - animated
  const headlightGeometry = new THREE.BoxGeometry(0.6, 0.3, 0.5);
  const headlightClosedMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x5D4037),
    roughness: 0.5,
    metalness: 0.3
  });
  const headlightOpenMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xFFFFFF),
    roughness: 0.1,
    metalness: 0.8
  });

  // Left headlight housing
  const leftHeadlightHousing = new THREE.Mesh(headlightGeometry, headlightClosedMaterial);
  leftHeadlightHousing.position.set(2.1, 0.45, 0.8);
  group.add(leftHeadlightHousing);

  // Right headlight housing
  const rightHeadlightHousing = new THREE.Mesh(headlightGeometry, headlightClosedMaterial);
  rightHeadlightHousing.position.set(2.1, 0.45, -0.8);
  group.add(rightHeadlightHousing);

  // Pop-up headlight mechanisms (visible when open)
  const popupMechanismGeometry = new THREE.BoxGeometry(0.3, 0.15, 0.3);
  const popupMechanismMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xC0C0C0),
    roughness: 0.3,
    metalness: 0.7
  });

  // Left popup mechanism
  const leftPopupMechanism = new THREE.Mesh(popupMechanismGeometry, popupMechanismMaterial);
  leftPopupMechanism.position.set(2.1, 0.5, 0.8);
  leftPopupMechanism.rotation.x = group.userData.popupHeadlightAngle;
  group.add(leftPopupMechanism);

  // Right popup mechanism
  const rightPopupMechanism = new THREE.Mesh(popupMechanismGeometry, popupMechanismMaterial);
  rightPopupMechanism.position.set(2.1, 0.5, -0.8);
  rightPopupMechanism.rotation.x = group.userData.popupHeadlightAngle;
  group.add(rightPopupMechanism);

  // Alloy wheels
  const wheelRadius = 0.65;
  const wheelWidth = 0.22;
  const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 24).rotateX(-Math.PI / 2);
  const wheelRimMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x2C3E50),
    roughness: 0.3,
    metalness: 0.8
  });
  const wheelCenterCapGeometry = new THREE.CircleGeometry(0.18, 16);
  const wheelCenterCapMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xE67E22),
    roughness: 0.5,
    metalness: 0.8
  });

  // Front left wheel
  const frontLeftWheel = new THREE.Mesh(wheelGeometry, wheelRimMaterial);
  frontLeftWheel.position.set(1.8, 0.4, 0.9);
  group.add(frontLeftWheel);

  // Front left center cap
  const frontLeftCenterCap = new THREE.Mesh(wheelCenterCapGeometry, wheelCenterCapMaterial);
  frontLeftCenterCap.position.set(1.8, 0.5, 0.9);
  group.add(frontLeftCenterCap);

  // Front right wheel
  const frontRightWheel = new THREE.Mesh(wheelGeometry, wheelRimMaterial);
  frontRightWheel.position.set(1.8, 0.4, -0.9);
  group.add(frontRightWheel);

  // Front right center cap
  const frontRightCenterCap = new THREE.Mesh(wheelCenterCapGeometry, wheelCenterCapMaterial);
  frontRightCenterCap.position.set(1.8, 0.5, -0.9);
  group.add(frontRightCenterCap);

  // Rear left wheel
  const rearLeftWheel = new THREE.Mesh(wheelGeometry, wheelRimMaterial);
  rearLeftWheel.position.set(-1.8, 0.4, 0.9);
  group.add(rearLeftWheel);

  // Rear left center cap
  const rearLeftCenterCap = new THREE.Mesh(wheelCenterCapGeometry, wheelCenterCapMaterial);
  rearLeftCenterCap.position.set(-1.8, 0.5, 0.9);
  group.add(rearLeftCenterCap);

  // Rear right wheel
  const rearRightWheel = new THREE.Mesh(wheelGeometry, wheelRimMaterial);
  rearRightWheel.position.set(-1.8, 0.4, -0.9);
  group.add(rearRightWheel);

  // Rear right center cap
  const rearRightCenterCap = new THREE.Mesh(wheelCenterCapGeometry, wheelCenterCapMaterial);
  rearRightCenterCap.position.set(-1.8, 0.5, -0.9);
  group.add(rearRightCenterCap);

  // Sporty side body lines
  const lineGeometry = new THREE.BoxGeometry(0.04, 1.0, 0.1);
  const lineMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xFFFFFF),
    roughness: 0.9,
    metalness: 0.3
  });

  // Side line 1
  const sideLine1 = new THREE.Mesh(lineGeometry, lineMaterial);
  sideLine1.position.set(1.5, 0.7, 0.5);
  sideLine1.rotation.z = 0.2;
  group.add(sideLine1);

  // Side line 2
  const sideLine2 = new THREE.Mesh(lineGeometry, lineMaterial);
  sideLine2.position.set(1.5, 0.7, -0.5);
  sideLine2.rotation.z = -0.2;
  group.add(sideLine2);

  // Rear side line
  const rearSideLine = new THREE.Mesh(lineGeometry, lineMaterial);
  rearSideLine.position.set(-1.5, 0.7, 0);
  rearSideLine.rotation.z = Math.PI / 6;
  group.add(rearSideLine);

  return group;
}

/** Animate pop-up headlights on a sport coupe */
export function animateSportCoupeHeadlights(coupe: THREE.Group, open: boolean): void {
  if (!coupe.userData || coupe.userData.vehicleType !== 'sport_coupe') return;

  const targetAngle = open ? Math.PI / 4 : 0;
  const duration = 500; // ms
  const startTime = performance.now();
  const housing = coupe.getObjectByName('leftHeadlightHousing') || coupe.children.find(c => c.position.z > 0 && c.position.x > 2);

  // Animate both headlight housings and mechanisms
  coupe.userData.popupHeadlightState = open ? 'open' : 'closed';
  coupe.userData.popupHeadlightAngle = targetAngle;

  // Update all headlight-related meshes
  coupe.traverse((child) => {
    if (child.isMesh && child.material) {
      if (child.name && (child.name.includes('Headlight') || child.name.includes('popup'))) {
        if (open) {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xFFFFFF),
            roughness: 0.1,
            metalness: 0.8
          });
        } else {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0x5D4037),
            roughness: 0.5,
            metalness: 0.3
          });
        }
      }
    }
  });
}

/** Create 1985-era minivan with sliding side door */
export function createMinivan(position: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(position);
  group.userData.isEraObject = true;
  group.userData.vehicleType = 'minivan';
  group.userData.era = '1985';

  // Minivan body - light color with panel accents
  const bodyColor = new THREE.Color(0xECF0F1); // Light silver/white
  const bodyGeometry = new THREE.BoxGeometry(5.5, 1.6, 2.5);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.3,
    metalness: 0.5
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0.8;
  group.add(body);

  // Side sliding door area - slightly different panel
  const doorGeometry = new THREE.BoxGeometry(0.8, 1.4, 2.5);
  const doorMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x5D4037),
    roughness: 0.3,
    metalness: 0.5
  });
  const sideDoor = new THREE.Mesh(doorGeometry, doorMaterial);
  sideDoor.position.set(2.6, 0.7, 0);
  group.add(sideDoor);

  // Rear sliding door
  const rearDoorGeometry = new THREE.BoxGeometry(0.8, 1.4, 2.5);
  const rearDoor = new THREE.Mesh(rearDoorGeometry, doorMaterial);
  rearDoor.position.set(-2.6, 0.7, 0);
  group.add(rearDoor);

  // Roof rack
  const rackGeometry = new THREE.BoxGeometry(5.5, 0.1, 0.3);
  const rackMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x8B4513),
    roughness: 0.5,
    metalness: 0.5
  });
  const roofRack = new THREE.Mesh(rackGeometry, rackMaterial);
  roofRack.position.y = 1.55;
  group.add(roofRack);

  // Sliding door handle
  const handleGeometry = new THREE.BoxGeometry(0.1, 0.3, 0.2);
  const handleMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xC0C0C0),
    roughness: 0.3,
    metalness: 0.8
  });
  const doorHandle = new THREE.Mesh(handleGeometry, handleMaterial);
  doorHandle.position.set(2.7, 0.85, 0.1);
  group.add(doorHandle);

  // Rear window wiper (characteristic 1985 feature)
  const wiperGeometry = new THREE.BoxGeometry(0.3, 0.1, 0.05);
  const wiperMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xC0C0C0),
    roughness: 0.5,
    metalness: 0.8
  });
  const rearWiper = new THREE.Mesh(wiperGeometry, wiperMaterial);
  rearWiper.position.set(-2.8, 0.8, 1.3);
  rearWiper.rotation.z = -0.3;
  group.add(rearWiper);

  // Alloy wheels
  const wheelRadius = 0.8;
  const wheelWidth = 0.28;
  const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 24).rotateX(-Math.PI / 2);
  const wheelRimMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x2C3E50),
    roughness: 0.3,
    metalness: 0.9
  });
  const wheelCenterCapGeometry = new THREE.CircleGeometry(0.22, 16);
  const wheelCenterCapMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xECF0F1),
    roughness: 0.5,
    metalness: 0.8
  });

  // Front left wheel
  const frontLeftWheel = new THREE.Mesh(wheelGeometry, wheelRimMaterial);
  frontLeftWheel.position.set(2.5, 0.5, 1.3);
  group.add(frontLeftWheel);

  // Front left center cap
  const frontLeftCenterCap = new THREE.Mesh(wheelCenterCapGeometry, wheelCenterCapMaterial);
  frontLeftCenterCap.position.set(2.5, 0.6, 1.3);
  group.add(frontLeftCenterCap);

  // Front right wheel
  const frontRightWheel = new THREE.Mesh(wheelGeometry, wheelRimMaterial);
  frontRightWheel.position.set(2.5, 0.5, -1.3);
  group.add(frontRightWheel);

  // Front right center cap
  const frontRightCenterCap = new THREE.Mesh(wheelCenterCapGeometry, wheelCenterCapMaterial);
  frontRightCenterCap.position.set(2.5, 0.6, -1.3);
  group.add(frontRightCenterCap);

  // Rear left wheel
  const rearLeftWheel = new THREE.Mesh(wheelGeometry, wheelRimMaterial);
  rearLeftWheel.position.set(-2.5, 0.5, 1.3);
  group.add(rearLeftWheel);

  // Rear left center cap
  const rearLeftCenterCap = new THREE.Mesh(wheelCenterCapGeometry, wheelCenterCapMaterial);
  rearLeftCenterCap.position.set(-2.5, 0.6, 1.3);
  group.add(rearLeftCenterCap);

  // Rear right wheel
  const rearRightWheel = new THREE.Mesh(wheelGeometry, wheelRimMaterial);
  rearRightWheel.position.set(-2.5, 0.5, -1.3);
  group.add(rearRightWheel);

  // Rear right center cap
  const rearRightCenterCap = new THREE.Mesh(wheelCenterCapGeometry, wheelCenterCapMaterial);
  rearRightCenterCap.position.set(-2.5, 0.6, -1.3);
  group.add(rearRightCenterCap);

  // Side window trim
  const windowTrimGeometry = new THREE.BoxGeometry(0.05, 1.2, 0.1);
  const windowTrimMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xE67E22),
    roughness: 0.9,
    metalness: 0.3
  });

  // Front side window trim
  const frontWindowTrim = new THREE.Mesh(windowTrimMaterial, windowTrimGeometry);
  frontWindowTrim.position.set(2.8, 0.8, 0);
  group.add(frontWindowTrim);

  // Rear side window trim
  const rearWindowTrim = new THREE.Mesh(windowTrimMaterial, windowTrimGeometry);
  rearWindowTrim.position.set(-2.8, 0.8, 0);
  group.add(rearWindowTrim);

  return group;
}

/** Create 1985-era delivery truck with bold corporate-style branding */
export function createDeliveryTruck(position: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(position);
  group.userData.isEraObject = true;
  group.userData.vehicleType = 'delivery_truck';
  group.userData.era = '1985';

  // Delivery truck body - corporate colors (FedEx-style red and blue)
  const bodyColorRed = new THREE.Color(0xC0392B);
  const bodyColorBlue = new THREE.Color(0x2980B9);
  const bodyGeometry = new THREE.BoxGeometry(6, 2.2, 3.0);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColorRed,
    roughness: 0.3,
    metalness: 0.7
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 1.1;
  group.add(body);

  // Blue panel on sides (corporate branding area)
  const sidePanelGeometry = new THREE.BoxGeometry(0.3, 2.0, 2.8);
  const sidePanelMaterial = new THREE.MeshStandardMaterial({
    color: bodyColorBlue,
    roughness: 0.3,
    metalness: 0.7
  });
  const leftSidePanel = new THREE.Mesh(sidePanelGeometry, sidePanelMaterial);
  leftSidePanel.position.set(-2.8, 1.0, 0);
  group.add(leftSidePanel);

  const rightSidePanel = new THREE.Mesh(sidePanelGeometry, sidePanelMaterial);
  rightSidePanel.position.set(2.8, 1.0, 0);
  group.add(rightSidePanel);

  // Bold "DELIVERY" text area on rear (left blank for texturing flexibility)
  const rearPanelGeometry = new THREE.BoxGeometry(1.5, 0.8, 0.2);
  const rearPanelMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xECF0F1),
    roughness: 0.5,
    metalness: 0.3
  });
  const rearPanel = new THREE.Mesh(rearPanelGeometry, rearPanelMaterial);
  rearPanel.position.set(0, 1.2, -1.4);
  group.add(rearPanel);

  // Front grille area
  const grilleGeometry = new THREE.BoxGeometry(1.2, 0.5, 0.3);
  const grilleMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xECF0F1),
    roughness: 0.5,
    metalness: 0.5
  });
  const grille = new THREE.Mesh(grilleGeometry, grilleMaterial);
  grille.position.set(2.8, 1.1, 0);
  group.add(grille);

  // Chrome bumper front
  const bumperGeometry = new THREE.BoxGeometry(0.5, 0.2, 0.1);
  const bumperMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xC0C0C0),
    roughness: 0.1,
    metalness: 0.9
  });
  const frontBumper = new THREE.Mesh(bumperGeometry, bumperMaterial);
  frontBumper.position.set(3.1, 0.1, 0);
  group.add(frontBumper);

  // Chrome bumper rear
  const rearBumper = new THREE.Mesh(bumperGeometry, bumperMaterial);
  rearBumper.position.set(-3.1, 0.1, 0);
  group.add(rearBumper);

  // Alloy wheels visible on premium vehicle
  const wheelRadius = 0.9;
  const wheelWidth = 0.3;
  const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 24).rotateX(-Math.PI / 2);
  const wheelRimMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xE67E22),
    roughness: 0.3,
    metalness: 0.9
  });
  const wheelCenterCapGeometry = new THREE.CircleGeometry(0.25, 16);
  const wheelCenterCapMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xC0392B),
    roughness: 0.5,
    metalness: 0.8
  });

  // Front left wheel
  const frontLeftWheel = new THREE.Mesh(wheelGeometry, wheelRimMaterial);
  frontLeftWheel.position.set(3.2, 0.6, 1.5);
  group.add(frontLeftWheel);

  // Front left center cap
  const frontLeftCenterCap = new THREE.Mesh(wheelCenterCapGeometry, wheelCenterCapMaterial);
  frontLeftCenterCap.position.set(3.2, 0.7, 1.5);
  group.add(frontLeftCenterCap);

  // Front right wheel
  const frontRightWheel = new THREE.Mesh(wheelGeometry, wheelRimMaterial);
  frontRightWheel.position.set(3.2, 0.6, -1.5);
  group.add(frontRightWheel);

  // Front right center cap
  const frontRightCenterCap = new THREE.Mesh(wheelCenterCapGeometry, wheelCenterCapMaterial);
  frontRightCenterCap.position.set(3.2, 0.7, -1.5);
  group.add(frontRightCenterCap);

  // Rear left wheel
  const rearLeftWheel = new THREE.Mesh(wheelGeometry, wheelRimMaterial);
  rearLeftWheel.position.set(-3.2, 0.6, 1.5);
  group.add(rearLeftWheel);

  // Rear left center cap
  const rearLeftCenterCap = new THREE.Mesh(wheelCenterCapGeometry, wheelCenterCapMaterial);
  rearLeftCenterCap.position.set(-3.2, 0.7, 1.5);
  group.add(rearLeftCenterCap);

  // Rear right wheel
  const rearRightWheel = new THREE.Mesh(wheelGeometry, wheelRimMaterial);
  rearRightWheel.position.set(-3.2, 0.6, -1.5);
  group.add(rearRightWheel);

  // Rear right center cap
  const rearRightCenterCap = new THREE.Mesh(wheelCenterCapGeometry, wheelCenterCapMaterial);
  rearRightCenterCap.position.set(-3.2, 0.7, -1.5);
  group.add(rearRightCenterCap);

  // Front and rear cargo lights
  const lightGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.2, 8);
  lightGeometry.rotateX(-Math.PI / 2);
  const lightMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xFF0000),
    roughness: 0.3,
    metalness: 0.5
  });

  // Front left cargo light
  const frontLeftLight = new THREE.Mesh(lightGeometry, lightMaterial);
  frontLeftLight.position.set(3.3, 0.3, 1.6);
  group.add(frontLeftLight);

  // Front right cargo light
  const frontRightLight = new THREE.Mesh(lightGeometry, lightMaterial);
  frontRightLight.position.set(3.3, 0.3, -1.6);
  group.add(frontRightLight);

  // Rear left cargo light
  const rearLeftLight = new THREE.Mesh(lightGeometry, lightMaterial);
  rearLeftLight.position.set(-3.3, 0.3, 1.6);
  group.add(rearLeftLight);

  // Rear right cargo light
  const rearRightLight = new THREE.Mesh(lightGeometry, lightMaterial);
  rearRightLight.position.set(-3.3, 0.3, -1.6);
  group.add(rearRightLight);

  // Side stripe decoration
  const stripeGeometry = new THREE.BoxGeometry(5.8, 0.08, 0.1);
  const stripeMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xF1C40F),
    roughness: 0.7,
    metalness: 0.2
  });

  // Top side stripe
  const topStripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
  topStripe.position.y = 1.95;
  topStripe.position.z = 0.1;
  group.add(topStripe);

  return group;
}

/** Create 1985-era city bus with air suspension */
export function createCityBus(position: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(position);
  group.userData.isEraObject = true;
  group.userData.vehicleType = 'city_bus';
  group.userData.era = '1985';

  // City bus body - yellow with white trim
  const busBodyColor = new THREE.Color(0xF1C40F); // Yellow
  const busTrimColor = new THREE.Color(0xECF0F1); // White
  const busBodyGeometry = new THREE.BoxGeometry(8, 2.5, 3.5);
  const busBodyMaterial = new THREE.MeshStandardMaterial({
    color: busBodyColor,
    roughness: 0.3,
    metalness: 0.5
  });
  const busBody = new THREE.Mesh(busBodyGeometry, busBodyMaterial);
  busBody.position.y = 1.25;
  group.add(busBody);

  // Bus window windows - darker tint
  const windowGeometry = new THREE.BoxGeometry(0.6, 1.2, 0.2);
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x2C3E50),
    transparent: true,
    opacity: 0.4
  });

  // Bus windows (multiple rows)
  for (let row = 0; row < 4; row++) {
    for (let seat = 0; seat < 3; seat++) {
      const window = new THREE.Mesh(windowGeometry, windowMaterial);
      window.position.set(
        0,
        1.4 + row * 0.5,
        (seat - 1) * 0.7
      );
      group.add(window);
    }
  }

  // Air suspension indicator (characteristic 1985 feature)
  const suspensionGeometry = new THREE.BoxGeometry(0.5, 0.3, 0.2);
  const suspensionMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x8B4513),
    roughness: 0.5,
    metalness: 0.5
  });
  const airSuspension = new THREE.Mesh(suspensionGeometry, suspensionMaterial);
  airSuspension.position.set(0, 0.3, 0);
  group.add(airSuspension);

  // Front bumper
  const bumperGeometry = new THREE.BoxGeometry(0.8, 0.3, 0.2);
  const bumperMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xC0C0C0),
    roughness: 0.1,
    metalness: 0.9
  });
  const frontBumper = new THREE.Mesh(bumperGeometry, bumperMaterial);
  frontBumper.position.set(4, 0.15, 0);
  group.add(frontBumper);

  // Rear bumper
  const rearBumper = new THREE.Mesh(bumperGeometry, bumperMaterial);
  rearBumper.position.set(-4, 0.15, 0);
  group.add(rearBumper);

  // Rear window wiper
  const wiperGeometry = new THREE.BoxGeometry(0.5, 0.1, 0.05);
  const wiperMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xC0C0C0),
    roughness: 0.5,
    metalness: 0.8
  });
  const rearWiper = new THREE.Mesh(wiperGeometry, wiperMaterial);
  rearWiper.position.set(-4.2, 1.0, 1.8);
  rearWiper.rotation.z = -0.2;
  group.add(rearWiper);

  // Alloy wheels
  const wheelRadius = 0.85;
  const wheelWidth = 0.3;
  const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 24).rotateX(-Math.PI / 2);
  const wheelRimMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x2C3E50),
    roughness: 0.3,
    metalness: 0.9
  });
  const wheelCenterCapGeometry = new THREE.CircleGeometry(0.25, 16);
  const wheelCenterCapMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xF1C40F),
    roughness: 0.5,
    metalness: 0.8
  });

  // Four wheels
  const wheelPositions = [
    { x: 3, z: 1.7 },
    { x: 3, z: -1.7 },
    { x: -3, z: 1.7 },
    { x: -3, z: -1.7 }
  ];

  wheelPositions.forEach((pos, i) => {
    const wheel = new THREE.Mesh(wheelGeometry, wheelRimMaterial);
    wheel.position.set(pos.x, 0.6, pos.z);
    group.add(wheel);

    const centerCap = new THREE.Mesh(wheelCenterCapGeometry, wheelCenterCapMaterial);
    centerCap.position.set(pos.x, 0.7, pos.z);
    group.add(centerCap);
  });

  // Side emergency exit door
  const doorGeometry = new THREE.BoxGeometry(0.6, 1.8, 0.2);
  const doorMaterial = new THREE.MeshStandardMaterial({
    color: busBodyColor,
    roughness: 0.3,
    metalness: 0.5
  });
  const emergencyDoor = new THREE.Mesh(doorGeometry, doorMaterial);
  emergencyDoor.position.set(3.5, 0.9, 0);
  group.add(emergencyDoor);

  // Destination sign on front
  const signGeometry = new THREE.BoxGeometry(1.5, 0.4, 0.1);
  const signMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xECF0F1),
    roughness: 0.3,
    metalness: 0.5
  });
  const destinationSign = new THREE.Mesh(signGeometry, signMaterial);
  destinationSign.position.set(4.3, 1.4, 0);
  group.add(destinationSign);

  return group;
}

/** Create 1985-era taxi cab with checkerboard pattern */
export function createTaxiCab(position: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(position);
  group.userData.isEraObject = true;
  group.userData.vehicleType = 'taxi_cab';
  group.userData.era = '1985';

  // Taxi cab body - traditional yellow with checkerboard pattern
  const taxiBodyColor = new THREE.Color(0xF1C40F); // Yellow
  const bodyGeometry = new THREE.BoxGeometry(4.5, 1.5, 2.2);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: taxiBodyColor,
    roughness: 0.3,
    metalness: 0.7
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0.75;
  group.add(body);

  // Checkerboard pattern on taxi roof
  const checkerSize = 0.25; // meters
  const roofGeometry = new THREE.BoxGeometry(4.5, 0.3, 2.2);
  const roofMaterial = new THREE.MeshStandardMaterial({
    roughness: 0.3,
    metalness: 0.5
  });

  // Create checkerboard texture effect using multiple meshes
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 8; j++) {
      const checkerX = -2.2 + (i * (checkerSize * 2 + 0.05));
      const checkerZ = -1.1 + (j * (checkerSize * 2 + 0.05));

      // Alternate checkerboard pattern
      if ((i + j) % 2 === 0) {
        const checkerGeometry = new THREE.BoxGeometry(checkerSize, 0.25, checkerSize);
        const checkerMaterial = new THREE.MeshStandardMaterial({
          color: new THREE.Color(0x2C3E50) // Black checker
        });
        const checker = new THREE.Mesh(checkerGeometry, checkerMaterial);
        checker.position.set(checkerX, 0.45, checkerZ);
        group.add(checker);
      }
    }
  }

  // Chrome bumpers
  const bumperGeometry = new THREE.BoxGeometry(0.3, 0.2, 0.1);
  const bumperMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xC0C0C0),
    roughness: 0.1,
    metalness: 0.9
  });

  const frontBumper = new THREE.Mesh(bumperGeometry, bumperMaterial);
  frontBumper.position.set(2.2, 0.1, 0);
  group.add(frontBumper);

  const rearBumper = new THREE.Mesh(bumperGeometry, bumperMaterial);
  rearBumper.position.set(-2.2, 0.1, 0);
  group.add(rearBumper);

  // Alloy wheels
  const wheelRadius = 0.6;
  const wheelWidth = 0.2;
  const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 24).rotateX(-Math.PI / 2);
  const wheelRimMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x2C3E50),
    roughness: 0.3,
    metalness: 0.8
  });
  const wheelCenterCapGeometry = new THREE.CircleGeometry(0.15, 16);
  const wheelCenterCapMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xF1C40F),
    roughness: 0.5,
    metalness: 0.8
  });

  // Front left wheel
  const frontLeftWheel = new THREE.Mesh(wheelGeometry, wheelRimMaterial);
  frontLeftWheel.position.set(1.8, 0.4, 1.0);
  group.add(frontLeftWheel);

  // Front left center cap
  const frontLeftCenterCap = new THREE.Mesh(wheelCenterCapGeometry, wheelCenterCapMaterial);
  frontLeftCenterCap.position.set(1.8, 0.5, 1.0);
  group.add(frontLeftCenterCap);

  // Front right wheel
  const frontRightWheel = new THREE.Mesh(wheelGeometry, wheelRimMaterial);
  frontRightWheel.position.set(1.8, 0.4, -1.0);
  group.add(frontRightWheel);

  // Front right center cap
  const frontRightCenterCap = new THREE.Mesh(wheelCenterCapGeometry, wheelCenterCapMaterial);
  frontRightCenterCap.position.set(1.8, 0.5, -1.0);
  group.add(frontRightCenterCap);

  // Rear left wheel
  const rearLeftWheel = new THREE.Mesh(wheelGeometry, wheelRimMaterial);
  rearLeftWheel.position.set(-1.8, 0.4, 1.0);
  group.add(rearLeftWheel);

  // Rear left center cap
  const rearLeftCenterCap = new THREE.Mesh(wheelCenterCapGeometry, wheelCenterCapMaterial);
  rearLeftCenterCap.position.set(-1.8, 0.5, 1.0);
  group.add(rearLeftCenterCap);

  // Rear right wheel
  const rearRightWheel = new THREE.Mesh(wheelGeometry, wheelRimMaterial);
  rearRightWheel.position.set(-1.8, 0.4, -1.0);
  group.add(rearRightWheel);

  // Rear right center cap
  const rearRightCenterCap = new THREE.Mesh(wheelCenterCapGeometry, wheelCenterCapMaterial);
  rearRightCenterCap.position.set(-1.8, 0.5, -1.0);
  group.add(rearRightCenterCap);

  // Taxi roof light (checkerboard pattern top)
  const roofLightGeometry = new THREE.BoxGeometry(0.5, 0.3, 1.5);
  const roofLightMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xFF0000),
    roughness: 0.5,
    metalness: 0.5
  });
  const roofLight = new THREE.Mesh(roofLightGeometry, roofLightMaterial);
  roofLight.position.set(0, 1.2, 0);
  group.add(roofLight);

  return group;
}

/** Create 1985-era hybrid concept vehicle */
export function createHybridConcept(position: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(position);
  group.userData.isEraObject = true;
  group.userData.vehicleType = 'hybrid_concept';
  group.userData.era = '1985';

  // Hybrid concept body - futuristic aerodynamic design
  const bodyColor = new THREE.Color(0x8E44AD); // Purple/indigo
  const bodyGeometry = new THREE.BoxGeometry(4.0, 1.2, 2.5);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.4,
    metalness: 0.6
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0.6;
  group.add(body);

  // Aerodynamic body lines
  const lineGeometry = new THREE.BoxGeometry(0.05, 1.0, 0.1);
  const lineMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xF1C40F),
    roughness: 0.9,
    metalness: 0.3
  });

  // Front aerodynamic line
  const frontLine = new THREE.Mesh(lineGeometry, lineMaterial);
  frontLine.position.set(2.0, 0.6, 0.8);
  frontLine.rotation.z = 0.2;
  group.add(frontLine);

  // Rear aerodynamic line
  const rearLine = new THREE.Mesh(lineGeometry, lineMaterial);
  rearLine.position.set(-2.0, 0.6, -0.8);
  rearLine.rotation.z = -0.2;
  group.add(rearLine);

  // Roof aerodynamic line
  const roofLine = new THREE.Mesh(lineGeometry, lineMaterial);
  roofLine.position.set(0, 1.0, 0);
  roofLine.rotation.z = Math.PI / 4;
  group.add(roofLine);

  // Wheel fairings (hybrid efficiency feature)
  const wheelRadius = 0.55;
  const wheelWidth = 0.18;
  const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 24).rotateX(-Math.PI / 2);
  const fairingMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.5,
    metalness: 0.5
  });
  const wheelRimMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xF1C40F),
    roughness: 0.3,
    metalness: 0.8
  });
  const wheelCenterCapGeometry = new THREE.CircleGeometry(0.15, 16);
  const wheelCenterCapMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x8E44AD),
    roughness: 0.5,
    metalness: 0.8
  });

  // Four wheels with fairings
  const wheelPositions = [
    { x: 1.8, z: 1.2 },
    { x: 1.8, z: -1.2 },
    { x: -1.8, z: 1.2 },
    { x: -1.8, z: -1.2 }
  ];

  wheelPositions.forEach((pos, i) => {
    // Wheel rim
    const wheel = new THREE.Mesh(wheelGeometry, wheelRimMaterial);
    wheel.position.set(pos.x, 0.4, pos.z);
    group.add(wheel);

    // Wheel center cap
    const centerCap = new THREE.Mesh(wheelCenterCapGeometry, wheelCenterCapMaterial);
    centerCap.position.set(pos.x, 0.5, pos.z);
    group.add(centerCap);

    // Wheel fairing
    const fairingGeometry = new THREE.BoxGeometry(wheelRadius * 2 + 0.1, 0.15, wheelRadius * 2 + 0.1);
    const fairing = new THREE.Mesh(fairingGeometry, fairingMaterial);
    fairing.position.set(pos.x, 0.55, pos.z);
    fairing.rotation.z = Math.PI / 4;
    group.add(fairing);
  });

  // Rear window wiper
  const wiperGeometry = new THREE.BoxGeometry(0.3, 0.1, 0.05);
  const wiperMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xC0C0C0),
    roughness: 0.5,
    metalness: 0.8
  });
  const rearWiper = new THREE.Mesh(wiperGeometry, wiperMaterial);
  rearWiper.position.set(-2.0, 0.7, 1.3);
  rearWiper.rotation.z = -0.3;
  group.add(rearWiper);

  // Front grille with hybrid badge area
  const grilleGeometry = new THREE.BoxGeometry(0.8, 0.3, 0.2);
  const grilleMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xECF0F1),
    roughness: 0.3,
    metalness: 0.5
  });
  const grille = new THREE.Mesh(grilleGeometry, grilleMaterial);
  grille.position.set(2.0, 0.55, 0);
  group.add(grille);

  return group;
}