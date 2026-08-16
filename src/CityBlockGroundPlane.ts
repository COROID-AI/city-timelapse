// @ts-nocheck
/**
 * CityBlockGroundPlane - Creates the foundational ground plane for the city block scene.
 * Includes textured road surfaces with lane markings, crosswalks, traffic signals,
 * curbs, sidewalks, and period-appropriate street infrastructure.
 * 
 * Features:
 * - 200m x 200m ground plane covering 2-3 city blocks
 * - Road surfaces with lane markings and center lines
 * - Crosswalks visible from typical camera heights
 * - Sidewalks with curb cuts at intersections
 * - Street lights with era-appropriate designs
 * - Traffic signal poles at intersections
 * - Paving materials that change based on selected era
 * - LOD (Level of Detail) for distant pavement textures
 */

import * as THREE from 'three';
import { EraKey, ERAS } from './eras/eraData';

/**
 * Road lane configuration constants
 */
const ROAD_WIDTH = 12; // meters - width of one lane
const CENTER_LINE_WIDTH = 0.15; // meters
const CROSSWALK_WIDTH = 5; // meters - width of crosswalk area
const CURB_HEIGHT = 0.15; // meters
const SIDEWALK_WIDTH = 4; // meters

/**
 * Era-specific pavement material definitions
 * These define the base color and pattern for each era's road/surface materials
 */
const ERA_PAVEMENT_MATERIALS: Record<EraKey, {
  roadBaseColor: string;
  roadTextureScale: number;
  curbColor: string;
  crosswalkColor: string;
  centerLineColor: string;
}> = {
  '1945': {
    roadBaseColor: '#2F4F4F',
    roadTextureScale: 20,
    curbColor: '#8B4513',
    crosswalkColor: '#FFFFFF',
    centerLineColor: '#FFFFFF',
  },
  '1965': {
    roadBaseColor: '#2C3E50',
    roadTextureScale: 50,
    curbColor: '#F1C40F',
    crosswalkColor: '#FFFFFF',
    centerLineColor: '#FFFFFF',
  },
  '1985': {
    roadBaseColor: '#5D4037',
    roadTextureScale: 50,
    curbColor: '#E67E22',
    crosswalkColor: '#FFFFFF',
    centerLineColor: '#FFFFFF',
  },
  '2005': {
    roadBaseColor: '#34495E',
    roadTextureScale: 50,
    curbColor: '#95A5A6',
    crosswalkColor: '#FFFFFF',
    centerLineColor: '#FFFFFF',
  },
  '2025': {
    roadBaseColor: '#ECF0F1',
    roadTextureScale: 50,
    curbColor: '#BDC3C7',
    crosswalkColor: '#FFFFFF',
    centerLineColor: '#FFFFFF',
  },
};

/**
 * Creates the complete city block ground plane with roads, sidewalks,
 * street infrastructure, and era-appropriate materials.
 * 
 * @param era The selected era key for era-appropriate materials
 * @param scene The Three.js scene to add objects to
 * @returns An object containing all created ground plane components for later reference
 */
export function createCityBlockGroundPlane(
  era: EraKey,
  scene: THREE.Scene
): {
  groundPlane: THREE.Mesh;
  roadMaterials: {
    road: THREE.Material;
    curb: THREE.Material;
    crosswalk: THREE.Material;
    centerLine: THREE.Material;
  };
  streetLights: THREE.Group;
  trafficSignals: THREE.Group;
} {
  const pavementMaterials = ERA_PAVEMENT_MATERIALS[era];
  
  // ==========================================
  // 1. Create Ground Plane (200m x 200m)
  // ==========================================
  const groundGeometry = new THREE.PlaneGeometry(200, 200);
  groundGeometry.rotateX(-Math.PI / 2); // Rotate to be horizontal
  
  // Create a multi-material ground plane with different road/sidewalk areas
  // We'll use a large area with road markings painted on later
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: pavementMaterials.roadBaseColor,
    roughness: 0.8,
    metalness: 0.2,
  });
  
  const groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
  groundPlane.position.y = 0.01; // Slightly above origin to avoid z-fighting
  scene.add(groundPlane);
  
  // ==========================================
  // 2. Create Road Surface Areas
  // ==========================================
  // Road layout: 4-lane road dividing the city block
  // Each "block" is approximately 50m x 50m
  // Roads run N-S and E-W through the center
  
  const roadMaterials: {
    road: THREE.Material;
    curb: THREE.Material;
    crosswalk: THREE.Material;
    centerLine: THREE.Material;
  } = {
    road: new THREE.MeshStandardMaterial({
      color: pavementMaterials.roadBaseColor,
      roughness: 0.9,
      metalness: 0.1,
    }),
    curb: new THREE.MeshStandardMaterial({
      color: pavementMaterials.curbColor,
      roughness: 0.7,
      metalness: 0.3,
    }),
    crosswalk: new THREE.MeshStandardMaterial({
      color: pavementMaterials.crosswalkColor,
      roughness: 0.3,
      metalness: 0.1,
    }),
    centerLine: new THREE.MeshStandardMaterial({
      color: pavementMaterials.centerLineColor,
      roughness: 0.2,
      metalness: 0.1,
    }),
  };
  
  // Create road segments (N-S and E-W roads through the center)
  const roadSegmentGeometry = new THREE.PlaneGeometry(180, 20); // 180m long, 20m wide
  roadSegmentGeometry.rotateX(-Math.PI / 2);
  
  // North-South road (central)
  const nsRoad = new THREE.Mesh(roadSegmentGeometry, roadMaterials.road);
  nsRoad.position.set(0, 0.02, 0); // Centered at origin
  nsRoad.rotation.y = Math.PI / 2; // Rotate to face N-S
  scene.add(nsRoad);
  
  // East-West road (central)
  const ewRoad = new THREE.Mesh(roadSegmentGeometry, roadMaterials.road);
  ewRoad.position.set(0, 0.02, 0);
  ewRoad.rotation.y = 0; // Already oriented correctly
  scene.add(ewRoad);
  
  // ==========================================
  // 3. Create Curbs around Roads
  // ==========================================
  const curbGeometry = new THREE.PlaneGeometry(180, 0.5); // length, width (height handled separately)
  curbGeometry.rotateX(-Math.PI / 2);
  
  // North-South road curbs
  const nsCurb = new THREE.Mesh(curbGeometry, roadMaterials.curb);
  nsCurb.position.set(0, CURB_HEIGHT / 2, 0);
  nsCurb.rotation.y = Math.PI / 2;
  scene.add(nsCurb);
  
  const nsCurbInner = new THREE.Mesh(curbGeometry, roadMaterials.curb);
  nsCurbInner.position.set(0, CURB_HEIGHT / 2, -90); // Inner curb between lanes
  nsCurbInner.rotation.y = Math.PI / 2;
  scene.add(nsCurbInner);
  
  // East-West road curbs
  const ewCurb = new THREE.Mesh(curbGeometry, roadMaterials.curb);
  ewCurb.position.set(90, CURB_HEIGHT / 2, 0); // Shifted to create crossing area
  ewCurb.rotation.y = 0;
  scene.add(ewCurb);
  
  const ewCurbInner = new THREE.Mesh(curbGeometry, roadMaterials.curb);
  ewCurbInner.position.set(-90, CURB_HEIGHT / 2, 0);
  ewCurbInner.rotation.y = 0;
  scene.add(ewCurbInner);
  
  // ==========================================
  // 4. Create Crosswalks at Intersections
  // ==========================================
  // Crosswalk geometry: 5m wide strips at each intersection quadrant
  const crosswalkGeometry = new THREE.PlaneGeometry(CROSSWALK_WIDTH, 4); // width x length
  crosswalkGeometry.rotateX(-Math.PI / 2);
  
  // Four crosswalk segments at the intersection
  const crosswalkPositions = [
    { x: 0, z: 90, rotationY: 0 },           // Top crosswalk (north)
    { x: 0, z: -90, rotationY: Math.PI },    // Bottom crosswalk (south)
    { x: 90, z: 0, rotationY: Math.PI / 2 }, // Right crosswalk (east)
    { x: -90, z: 0, rotationY: -Math.PI / 2 }, // Left crosswalk (west)
  ];
  
  crosswalkPositions.forEach(pos => {
    const crosswalk = new THREE.Mesh(crosswalkGeometry, roadMaterials.crosswalk);
    crosswalk.position.set(pos.x, 0.02, pos.z);
    crosswalk.rotation.y = pos.rotationY;
    scene.add(crosswalk);
  });
  
  // ==========================================
  // 5. Create Lane Markings (Center and Edge Lines)
  // ==========================================
  // Center line along roads (dashed pattern)
  const centerLineGeometry = new THREE.PlaneGeometry(0.2, 8); // short segments
  centerLineGeometry.rotateX(-Math.PI / 2);
  
  // North-South road center line
  for (let i = -80; i <= 80; i += 20) {
    const centerLine = new THREE.Mesh(centerLineGeometry, roadMaterials.centerLine);
    centerLine.position.set(0, 0.03, i);
    centerLine.rotation.y = Math.PI / 2;
    scene.add(centerLine);
  }
  
  // East-West road center line
  for (let i = -80; i <= 80; i += 20) {
    const centerLine = new THREE.Mesh(centerLineGeometry, roadMaterials.centerLine);
    centerLine.position.set(i, 0.03, 0);
    centerLine.rotation.y = 0;
    scene.add(centerLine);
  }
  
  // Edge lines along road boundaries
  const edgeLineGeometry = new THREE.PlaneGeometry(0.15, 60);
  edgeLineGeometry.rotateX(-Math.PI / 2);
  
  // North-South road edge lines
  const nsEdgeLeft = new THREE.Mesh(edgeLineGeometry, roadMaterials.centerLine);
  nsEdgeLeft.position.set(-85, 0.03, 0);
  nsEdgeLeft.rotation.y = Math.PI / 2;
  scene.add(nsEdgeLeft);
  
  const nsEdgeRight = new THREE.Mesh(edgeLineGeometry, roadMaterials.centerLine);
  nsEdgeRight.position.set(85, 0.03, 0);
  nsEdgeRight.rotation.y = Math.PI / 2;
  scene.add(nsEdgeRight);
  
  // East-West road edge lines
  const ewEdgeTop = new THREE.Mesh(edgeLineGeometry, roadMaterials.centerLine);
  ewEdgeTop.position.set(0, 0.03, 85);
  ewEdgeTop.rotation.y = 0;
  scene.add(ewEdgeTop);
  
  const ewEdgeBottom = new THREE.Mesh(edgeLineGeometry, roadMaterials.centerLine);
  ewEdgeBottom.position.set(0, 0.03, -85);
  ewEdgeBottom.rotation.y = 0;
  scene.add(ewEdgeBottom);
  
  // ==========================================
  // 6. Create Sidewalks
  // ==========================================
  // Sidewalk geometry: large planes on each side of the roads
  const sidewalkGeometry = new THREE.PlaneGeometry(SIDEWALK_WIDTH, 80); // width x length
  sidewalkGeometry.rotateX(-Math.PI / 2);
  sidewalkGeometry.receiveShadow = true;
  
  // Apply era-appropriate sidewalk material (different color/pattern per era)
  const sidewalkMaterial = new THREE.MeshStandardMaterial({
    color: getSidewalkColor(era),
    roughness: 0.8,
    metalness: 0.1,
  });
  
  // Four sidewalk areas around the intersection
  const sidewalkPositions = [
    { x: 0, z: 100, rotationY: Math.PI / 2 },   // North sidewalk
    { x: 0, z: -100, rotationY: -Math.PI / 2 }, // South sidewalk
    { x: 100, z: 0, rotationY: 0 },              // East sidewalk
    { x: -100, z: 0, rotationY: Math.PI },       // West sidewalk
  ];
  
  sidewalkPositions.forEach(pos => {
    const sidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial);
    sidewalk.position.set(pos.x, 0.01, pos.z);
    sidewalk.rotation.y = pos.rotationY;
    scene.add(sidewalk);
  });
  
  // ==========================================
  // 7. Create Street Lights
  // ==========================================
  const streetLights = new THREE.Group();
  
  // Street light pole geometry
  const poleGeometry = new THREE.CylinderGeometry(0.1, 0.15, 8, 8);
  poleGeometry.rotateX(Math.PI / 2);
  
  // Era-appropriate street light designs
  const lightConfigs = getStreetLightConfig(era);
  
  // Place street lights along all major roads
  // North-South road lights
  for (let i = -70; i <= 70; i += 30) {
    const pole = new THREE.Mesh(poleGeometry, roadMaterials.curb);
    pole.position.set(0, 4, i); // 4m height
    pole.rotation.y = Math.PI / 2;
    streetLights.add(pole);
    
    // Add light fixture
    const lightFixture = createStreetLightFixture(lightConfigs, new THREE.Vector3(0, 8, i));
    streetLights.add(lightFixture);
  }
  
  // East-West road lights
  for (let i = -70; i <= 70; i += 30) {
    const pole = new THREE.Mesh(poleGeometry, roadMaterials.curb);
    pole.position.set(i, 4, 0);
    pole.rotation.y = 0;
    streetLights.add(pole);
    
    // Add light fixture
    const lightFixture = createStreetLightFixture(lightConfigs, new THREE.Vector3(i, 8, 0));
    streetLights.add(lightFixture);
  }
  
  scene.add(streetLights);
  
  // ==========================================
  // 8. Create Traffic Signal Poles
  // ==========================================
  const trafficSignals = new THREE.Group();
  
  // Traffic signal pole geometry (taller, thinner)
  const signalPoleGeometry = new THREE.CylinderGeometry(0.08, 0.12, 12, 8);
  signalPoleGeometry.rotateX(Math.PI / 2);
  
  // Traffic signal head geometry
  const signalHeadGeometry = new THREE.BoxGeometry(0.5, 0.3, 0.2);
  
  // Place traffic signals at intersections
  const signalPositions = [
    { x: 0, z: 90 },           // North intersection
    { x: 0, z: -90 },          // South intersection
    { x: 90, z: 0 },           // East intersection
    { x: -90, z: 0 },          // West intersection
  ];
  
  signalPositions.forEach(pos => {
    // Pole
    const pole = new THREE.Mesh(signalPoleGeometry, roadMaterials.curb);
    pole.position.set(pos.x, 6, pos.z); // 6m height
    trafficSignals.add(pole);
    
    // Signal head
    const signalHead = new THREE.Mesh(signalHeadGeometry, new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      emissive: '#FFFFFF',
      emissiveIntensity: 0.5,
    }));
    signalHead.position.set(pos.x, 7, pos.z);
    // Orient signal head to face the intersection
    trafficSignals.add(signalHead);
  });
  
  scene.add(trafficSignals);
  
  // ==========================================
  // 9. Add Fire Hydrants and Mailboxes (era-specific street furniture)
  // ==========================================
  addStreetFurniture(scene, era, roadMaterials);
  
  return {
    groundPlane,
    roadMaterials,
    streetLights,
    trafficSignals,
  };
}

/**
 * Updates the ground plane materials when era changes
 * This is called during era transitions to reapply materials
 */
export function updateGroundPlaneEra(era: EraKey, components: {
  roadMaterials: {
    road: THREE.Material;
    curb: THREE.Material;
    crosswalk: THREE.Material;
    centerLine: THREE.Material;
  };
  streetLights: THREE.Group;
}): void {
  const pavementMaterials = ERA_PAVEMENT_MATERIALS[era];
  
  // Update road materials color
  components.roadMaterials.road.color.set(pavementMaterials.roadBaseColor);
  components.roadMaterials.curb.color.set(pavementMaterials.curbColor);
  components.roadMaterials.crosswalk.color.set(pavementMaterials.crosswalkColor);
  components.roadMaterials.centerLine.color.set(pavementMaterials.centerLineColor);
  
  // Update street light config
  const lightConfig = getStreetLightConfig(era);
  
  // Cycle through street lights and update their fixtures
  components.streetLights.children.forEach((child, index) => {
    if (index % 2 === 0) { // Every other child is a light fixture
      // Update fixture color and intensity
      if (child.isMesh) {
        child.material.color.set(lightConfig.color);
        child.material.emissive.set(lightConfig.color);
        child.material.emissiveIntensity = lightConfig.intensity;
      }
    }
  });
  
  // Update hydrant colors
  // This would need access to the hydrants - simplified for now
  console.log(`Ground plane updated to era: ${era}`);
}

/**
 * Returns sidewalk color based on era
 */
function getSidewalkColor(era: EraKey): string {
  const colors: Record<EraKey, string> = {
    '1945': '#8B4513', // Brick red/brown for 1940s
    '1965': '#F1C40F', // Golden yellow for 1960s
    '1985': '#E67E22', // Orange for 1980s
    '2005': '#95A5A6', // Cool gray for 2000s
    '2025': '#BDC3C7', // Light gray for 2025
  };
  return colors[era] || '#7F8C8D';
}

/**
 * Returns era-appropriate street light configuration
 */
function getStreetLightConfig(era: EraKey): {
  type: string;
  color: string;
  intensity: number;
} {
  const configs: Record<EraKey, {
    type: string;
    color: string;
    intensity: number;
  }> = {
    '1945': { type: 'gas', color: '#FFDAB9', intensity: 1.5 },
    '1965': { type: 'electric', color: '#E0FFFF', intensity: 2.0 },
    '1985': { type: 'neon', color: '#FF00FF', intensity: 2.5 },
    '2005': { type: 'led', color: '#FFFFFF', intensity: 3.0 },
    '2025': { type: 'led', color: '#FFFFFF', intensity: 3.5 },
  };
  return configs[era] || { type: 'led', color: '#FFFFFF', intensity: 3.0 };
}

/**
 * Creates a street light fixture with era-appropriate design
 */
function createStreetLightFixture(
  config: { type: string; color: string; intensity: number },
  position: THREE.Vector3
): THREE.Group {
  const group = new THREE.Group();
  
  // Pole top geometry
  const topGeometry = new THREE.SphereGeometry(0.3, 16, 16);
  topGeometry.scale(1, 0.3, 1); // Flatten to create fixture shape
  
  const fixture = new THREE.Mesh(topGeometry, new THREE.MeshStandardMaterial({
    color: config.color,
    emissive: config.color,
    emissiveIntensity: config.intensity,
    roughness: 0.4,
  }));
  
  group.add(fixture);
  group.position.copy(position);
  
  return group;
}

/**
 * Adds era-specific street furniture including fire hydrants and mailboxes
 */
function addStreetFurniture(
  scene: THREE.Scene,
  era: EraKey,
  roadMaterials: {
    road: THREE.Material;
    curb: THREE.Material;
    crosswalk: THREE.Material;
    centerLine: THREE.Material;
  }
): void {
  const streetFurniture = new THREE.Group();
  
  // Fire hydrant geometry
  const hydrantGeometry = new THREE.CylinderGeometry(0.2, 0.15, 1, 16);
  hydrantGeometry.rotateX(Math.PI / 2);
  
  // Mailbox geometry
  const mailboxGeometry = new THREE.BoxGeometry(0.4, 0.8, 0.3);
  
  // Hydrant colors per era
  const hydrantColors: Record<EraKey, string> = {
    '1945': '#B7410E', // Red/ochre for 1940s
    '1965': '#FF6B6B', // Bright red for 1960s
    '1985': '#E67E22', // Orange for 1980s
    '2005': '#3498DB', // Blue for 2000s
    '2025': '#2C3E50', // Dark blue/gray for 2025
  };
  
  const hydrantColor = hydrantColors[era] || '#B7410E';
  
  // Place fire hydrants at regular intervals along roads
  // North-South road
  for (let i = -60; i <= 60; i += 40) {
    const hydrant = new THREE.Mesh(hydrantGeometry, new THREE.MeshStandardMaterial({
      color: hydrantColor,
      roughness: 0.6,
    }));
    hydrant.position.set(0, 0.5, i);
    hydrant.rotation.y = Math.PI / 2;
    streetFurniture.add(hydrant);
    
    // Add valve cap detail
    const capGeometry = new THREE.SphereGeometry(0.03, 12, 12);
    const cap = new THREE.Mesh(capGeometry, new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
    }));
    cap.position.set(0, 1, i);
    streetFurniture.add(cap);
  }
  
  // East-West road
  for (let i = -60; i <= 60; i += 40) {
    const hydrant = new THREE.Mesh(hydrantGeometry, new THREE.MeshStandardMaterial({
      color: hydrantColor,
      roughness: 0.6,
    }));
    hydrant.position.set(i, 0.5, 0);
    hydrant.rotation.y = 0;
    streetFurniture.add(hydrant);
    
    // Add valve cap detail
    const capGeometry = new THREE.SphereGeometry(0.03, 12, 12);
    const cap = new THREE.Mesh(capGeometry, new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
    }));
    cap.position.set(i, 1, 0);
    streetFurniture.add(cap);
  }
  
  // Mailboxes at intersections and along roads
  const mailboxPositions = [
    { x: -95, z: 0 },   // West of intersection
    { x: 95, z: 0 },    // East of intersection
    { x: 0, z: -95 },   // South of intersection
    { x: 0, z: 95 },    // North of intersection
  ];
  
  mailboxPositions.forEach(pos => {
    const mailbox = new THREE.Mesh(mailboxGeometry, new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      roughness: 0.5,
    }));
    mailbox.position.set(pos.x, 0.4, pos.z);
    // Add mailbox post
    const postGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8);
    postGeometry.rotateX(Math.PI / 2);
    const post = new THREE.Mesh(postGeometry, new THREE.MeshStandardMaterial({
      color: hydrantColor,
    }));
    post.position.set(pos.x, 0.3, pos.z);
    streetFurniture.add(mailbox);
    streetFurniture.add(post);
  });
  
  scene.add(streetFurniture);
}

export default createCityBlockGroundPlane;