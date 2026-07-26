import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, memo } from 'react';
import * as THREE from 'three';
import { BuildingStyle, EraId } from '../../types';

// Deterministic pseudo-random based on seed
const createRng = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 0x100000000;
    return state / 0x100000000;
  };
};

// Building data structure
type BuildingData = {
  id: number;
  position: [number, number, number];
  width: number;
  depth: number;
  height: number;
  segments: number;
  roofType: 'flat' | 'slanted' | 'peaked' | 'dome';
  hasFireEscape: boolean;
  hasAntenna: boolean;
  hasBalcony: boolean;
};

// Generate building layout for the city block
const generateBuildings = (buildingHeight: number, buildingDensity: number, era: EraId): BuildingData[] => {
  const buildings: BuildingData[] = [];
  const rng = createRng(42);

  // Define the block layout - a central street with buildings on both sides
  const blockWidth = 60;
  const blockDepth = 60;
  const streetWidth = 8;

  // Building rows on each side of the street
  const numRows = Math.floor(8 * buildingDensity);
  const numCols = Math.floor(6 * buildingDensity);

  let id = 0;

  // Buildings on the north side
  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      const width = 3 + rng() * 6;
      const depth = 3 + rng() * 8;
      const height = buildingHeight * (0.5 + rng() * 0.8);

      const x = -blockWidth / 2 + col * 8 + width / 2;
      const z = -streetWidth / 2 - depth / 2 - row * 2;
      const y = height / 2;

      buildings.push({
        id: id++,
        position: [x, y, z],
        width,
        depth,
        height,
        segments: Math.floor(2 + rng() * 6),
        roofType: ['flat', 'flat', 'flat', 'slanted', 'peaked', 'dome'][Math.floor(rng() * 6)] as any,
        hasFireEscape: rng() > 0.6,
        hasAntenna: rng() > 0.7,
        hasBalcony: rng() > 0.5,
      });
    }
  }

  // Buildings on the south side
  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      const width = 3 + rng() * 6;
      const depth = 3 + rng() * 8;
      const height = buildingHeight * (0.5 + rng() * 0.8);

      const x = -blockWidth / 2 + col * 8 + width / 2;
      const z = streetWidth / 2 + depth / 2 + row * 2;
      const y = height / 2;

      buildings.push({
        id: id++,
        position: [x, y, z],
        width,
        depth,
        height,
        segments: Math.floor(2 + rng() * 6),
        roofType: ['flat', 'flat', 'flat', 'slanted', 'peaked', 'dome'][Math.floor(rng() * 6)] as any,
        hasFireEscape: rng() > 0.6,
        hasAntenna: rng() > 0.7,
        hasBalcony: rng() > 0.5,
      });
    }
  }

  // Corner buildings (taller)
  const cornerPositions: [number, number, number][] = [
    [-blockWidth / 2 - 5, 0, -blockDepth / 2 - 5],
    [blockWidth / 2 + 5, 0, -blockDepth / 2 - 5],
    [-blockWidth / 2 - 5, 0, blockDepth / 2 + 5],
    [blockWidth / 2 + 5, 0, blockDepth / 2 + 5],
  ];

  for (const pos of cornerPositions) {
    const width = 8 + rng() * 4;
    const depth = 8 + rng() * 4;
    const height = buildingHeight * (0.8 + rng() * 0.4);
    buildings.push({
      id: id++,
      position: [pos[0], height / 2, pos[2]],
      width,
      depth,
      height,
      segments: Math.floor(3 + rng() * 5),
      roofType: 'flat',
      hasFireEscape: false,
      hasAntenna: true,
      hasBalcony: true,
    });
  }

  return buildings;
};

// Single building component with detailed facade
const Building = memo(({
  data,
  buildingStyle,
  buildingColor,
  windowColor,
  windowLitColor,
  era,
  transitionProgress,
}: {
  data: BuildingData;
  buildingStyle: BuildingStyle;
  buildingColor: string;
  windowColor: string;
  windowLitColor: string;
  era: EraId;
  transitionProgress: number;
}) => {
  const meshRef = useRef<THREE.Group>(null);
  const windowMaterialRef = useRef<THREE.ShaderMaterial>(null);

  // Window lit state - flicker for neon eras
  const litWindows = useMemo(() => {
    const windows: boolean[] = [];
    const totalWindows = Math.floor(data.segments * 4 * (data.height / 3));
    for (let i = 0; i < totalWindows; i++) {
      windows.push(Math.random() > 0.3);
    }
    return windows;
  }, [data]);

  useFrame(({ clock }) => {
    if (windowMaterialRef.current && (buildingStyle === 'neon' || buildingStyle === 'smart' || buildingStyle === 'futuristic')) {
      const flicker = 0.9 + 0.1 * Math.sin(clock.elapsedTime * 3 + data.id);
      windowMaterialRef.current.uniforms.emissiveIntensity.value = flicker;
    }
  });

  // Building material based on era style
  const buildingMaterial = useMemo(() => {
    const color = new THREE.Color(buildingColor);
    return new THREE.MeshStandardMaterial({
      color,
      roughness: buildingStyle === 'glass' ? 0.1 : 0.8,
      metalness: buildingStyle === 'glass' ? 0.7 : 0.2,
      transparent: buildingStyle === 'glass' || buildingStyle === 'futuristic',
      opacity: buildingStyle === 'glass' ? 0.7 : 1.0,
    });
  }, [buildingColor, buildingStyle]);

  // Window material
  const windowMat = useMemo(() => {
    const baseColor = new THREE.Color(windowColor);
    const litColor = new THREE.Color(windowLitColor);
    return new THREE.ShaderMaterial({
      uniforms: {
        unlitColor: { value: baseColor },
        litColor: { value: litColor },
        time: { value: 0 },
        litPattern: { value: 1.0 },
        emissiveIntensity: { value: 1.0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
          vUv = uv;
          vNormal = normal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 unlitColor;
        uniform vec3 litColor;
        uniform float time;
        uniform float emissiveIntensity;
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
          // Window grid pattern
          vec2 grid = fract(vUv * vec2(8.0, max(4.0, floor(vUv.y * 20.0))));
          float window = step(0.1, grid.x) * step(0.1, grid.y) * step(grid.x, 0.9) * step(grid.y, 0.9);

          // Random lit pattern
          float lit = mod(floor(vUv.x * 8.0) + floor(vUv.y * 20.0), 3.0);
          float isLit = step(0.5, lit);

          // Neon flicker for later eras
          float neon = sin(time * 5.0 + vUv.x * 10.0 + vUv.y * 10.0) * 0.5 + 0.5;

          vec3 color = mix(unlitColor, litColor, isLit * (0.7 + 0.3 * neon) * emissiveIntensity);
          gl_FragColor = vec4(color, window);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });
  }, [windowColor, windowLitColor]);

  useFrame(({ clock }) => {
    windowMat.uniforms.time.value = clock.elapsedTime;
  });

  // Generate building geometry
  const buildingGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const w = data.width / 2;
    const d = data.depth / 2;
    shape.moveTo(-w, -d);
    shape.lineTo(w, -d);
    shape.lineTo(w, d);
    shape.lineTo(-w, d);
    shape.lineTo(-w, -d);

    const extrudeSettings = {
      depth: data.height,
      bevelEnabled: false,
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, [data]);

  // Generate windows as a separate geometry
  const windowGeometry = useMemo(() => {
    const group = new THREE.Group();
    const windowSize = 0.4;
    const windowSpacing = data.width / Math.max(2, data.segments);

    // Front and back windows
    for (let i = 0; i < data.segments; i++) {
      for (let j = 0; j < Math.floor(data.height / 3); j++) {
        const x = -data.width / 2 + (i + 0.5) * windowSpacing;
        const y = 1 + j * 3;

        // Front window
        const geo = new THREE.PlaneGeometry(windowSize, windowSize * 1.5);
        geo.rotateY(0);
        geo.translate(x, y, data.depth / 2 + 0.01);
        group.add(new THREE.Mesh(geo));

        // Back window
        const geo2 = new THREE.PlaneGeometry(windowSize, windowSize * 1.5);
        geo2.rotateY(Math.PI);
        geo2.translate(x, y, -data.depth / 2 - 0.01);
        group.add(new THREE.Mesh(geo2));
      }
    }

    // Side windows
    for (let j = 0; j < Math.floor(data.height / 3); j++) {
      const y = 1 + j * 3;

      const geoL = new THREE.PlaneGeometry(windowSize, windowSize * 1.5);
      geoL.rotateY(Math.PI / 2);
      geoL.translate(-data.width / 2 - 0.01, y, 0);
      group.add(new THREE.Mesh(geoL));

      const geoR = new THREE.PlaneGeometry(windowSize, windowSize * 1.5);
      geoR.rotateY(-Math.PI / 2);
      geoR.translate(data.width / 2 + 0.01, y, 0);
      group.add(new THREE.Mesh(geoR));
    }

    return group;
  }, [data]);

  // Roof details
  const renderRoofDetails = () => {
    const details: THREE.Object3D[] = [];
    const topY = data.height;

    if (data.hasAntenna) {
      const antennaGeo = new THREE.CylinderGeometry(0.05, 0.05, 2, 8);
      const antennaMat = new THREE.MeshStandardMaterial({ color: '#ff0000', emissive: '#ff0000', emissiveIntensity: 0.5 });
      const antenna = new THREE.Mesh(antennaGeo, antennaMat);
      antenna.position.set(data.width / 3, topY + 1, data.depth / 3);
      details.push(antenna);

      // Antenna tip light
      const tipGeo = new THREE.SphereGeometry(0.1, 8, 8);
      const tipMat = new THREE.MeshStandardMaterial({ color: '#ff4444', emissive: '#ff4444', emissiveIntensity: 1 });
      const tip = new THREE.Mesh(tipGeo, tipMat);
      tip.position.set(data.width / 3, topY + 2.1, data.depth / 3);
      details.push(tip);
    }

    if (data.hasFireEscape) {
      const fireEscapeMat = new THREE.MeshStandardMaterial({ color: '#555555', metalness: 0.8 });
      const railGeo = new THREE.CylinderGeometry(0.05, 0.05, data.width * 0.8, 8);
      const rail = new THREE.Mesh(railGeo, fireEscapeMat);
      rail.position.set(0, topY - 2, data.depth / 2 + 0.1);
      details.push(rail);
    }

    if (data.hasBalcony) {
      const balconyMat = new THREE.MeshStandardMaterial({ color: '#444444', metalness: 0.6 });
      const balconyGeo = new THREE.RingGeometry(0.5, 1.2, 8);
      const balcony = new THREE.Mesh(balconyGeo, balconyMat);
      balcony.position.set(data.width / 3, topY - 4, data.depth / 2 + 0.1);
      balcony.rotation.x = -Math.PI / 2;
      details.push(balcony);
    }

    return details;
  };

  return (
    <group ref={meshRef} position={data.position} castShadow receiveShadow>
      <mesh geometry={buildingGeometry} material={buildingMaterial} />

      {/* Windows */}
      {windowGeometry.children.map((child, i) => (
        <mesh
          key={`window-${data.id}-${i}`}
          geometry={(child as THREE.Mesh).geometry}
          material={windowMat}
          position={child.position}
          rotation={child.rotation}
        />
      ))}

      {/* Roof details */}
      {renderRoofDetails().map((detail, i) => (
        <primitive key={`roof-${data.id}-${i}`} object={detail} />
      ))}
    </group>
  );
});

export const BuildingGroup = ({
  buildingStyle,
  buildingColor,
  windowColor,
  windowLitColor,
  buildingHeight,
  buildingDensity,
  era,
  transitionProgress,
}: {
  buildingStyle: BuildingStyle;
  buildingColor: string;
  windowColor: string;
  windowLitColor: string;
  buildingHeight: number;
  buildingDensity: number;
  era: EraId;
  transitionProgress: number;
}) => {
  const buildings = useMemo(
    () => generateBuildings(buildingHeight, buildingDensity, era),
    [buildingHeight, buildingDensity, era]
  );

  return (
    <group>
      {buildings.map((building) => (
        <Building
          key={building.id}
          data={building}
          buildingStyle={buildingStyle}
          buildingColor={buildingColor}
          windowColor={windowColor}
          windowLitColor={windowLitColor}
          era={era}
          transitionProgress={transitionProgress}
        />
      ))}
    </group>
  );
};
