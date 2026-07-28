/**
 * Buildings module.
 * Creates a city block of buildings with era-specific facades,
 * window grids (instanced), and rooftop props.
 */
import * as THREE from 'three';
import type { EraId } from '../eras';
import type { AppState } from '../state';

interface BuildingSpec {
  /** Facade color */
  color: THREE.Color;
  /** Window emissive color */
  windowEmissive: THREE.Color;
  /** Window emissive intensity */
  windowIntensity: number;
  /** Base building height */
  height: number;
  /** Height variation */
  heightVariation: number;
  /** Rooftop prop type */
  roofProp: 'water_tower' | 'ac_units' | 'antennas' | 'sat_dishes' | 'led_signs' | 'greenery' | 'solar';
  /** Material roughness */
  roughness: number;
  /** Material metalness */
  metalness: number;
}

const BUILDING_SPECS: Record<EraId, BuildingSpec> = {
  '1945': {
    color: new THREE.Color(0x8b5a2b),
    windowEmissive: new THREE.Color(0xffdd88),
    windowIntensity: 0.3,
    height: 12,
    heightVariation: 4,
    roofProp: 'water_tower',
    roughness: 0.85,
    metalness: 0.1,
  },
  '1965': {
    color: new THREE.Color(0xd4a574),
    windowEmissive: new THREE.Color(0xffffaa),
    windowIntensity: 0.4,
    height: 16,
    heightVariation: 6,
    roofProp: 'ac_units',
    roughness: 0.75,
    metalness: 0.2,
  },
  '1985': {
    color: new THREE.Color(0x5a5a6a),
    windowEmissive: new THREE.Color(0xff0066),
    windowIntensity: 0.6,
    height: 20,
    heightVariation: 8,
    roofProp: 'antennas',
    roughness: 0.6,
    metalness: 0.4,
  },
  '2005': {
    color: new THREE.Color(0x3a5a7a),
    windowEmissive: new THREE.Color(0x00aaff),
    windowIntensity: 0.7,
    height: 24,
    heightVariation: 10,
    roofProp: 'sat_dishes',
    roughness: 0.3,
    metalness: 0.7,
  },
  '2025': {
    color: new THREE.Color(0x4a4a4a),
    windowEmissive: new THREE.Color(0x00ffaa),
    windowIntensity: 0.8,
    height: 26,
    heightVariation: 10,
    roofProp: 'led_signs',
    roughness: 0.2,
    metalness: 0.8,
  },
  '2055': {
    color: new THREE.Color(0x0a2a3a),
    windowEmissive: new THREE.Color(0x00ffff),
    windowIntensity: 1.0,
    height: 30,
    heightVariation: 12,
    roofProp: 'greenery',
    roughness: 0.1,
    metalness: 0.9,
  },
};

interface BuildingInstance {
  mesh: THREE.Mesh;
  windows: THREE.InstancedMesh;
  roofProp: THREE.Group | null;
  baseHeight: number;
  width: number;
  depth: number;
}

export class BuildingsModule {
  group: THREE.Group;
  private scene: THREE.Scene;
  private buildings: BuildingInstance[] = [];

  // Shared geometry
  private buildingGeometry: THREE.BoxGeometry;
  private windowGeometry: THREE.PlaneGeometry;
  private windowMaterial: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Shared geometry for buildings
    this.buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.windowGeometry = new THREE.PlaneGeometry(0.8, 0.8);
    this.windowMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffaa,
      emissive: 0xffffaa,
      emissiveIntensity: 0.4,
      side: THREE.DoubleSide,
    });

    this.generateBuildings();
    this.setEra('1945');
  }

  private generateBuildings(): void {
    // City block: 5x5 grid of buildings with a central park/empty space
    const blockSize = 40;
    const gridSize = 5;
    const spacing = blockSize / gridSize;

    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        // Skip center for a small plaza
        if (x === 2 && z === 2) continue;

        const width = 4 + Math.random() * 4;
        const depth = 4 + Math.random() * 4;
        const height = 12 + Math.random() * 8;

        const posX = (x - gridSize / 2) * spacing + spacing / 2;
        const posZ = (z - gridSize / 2) * spacing + spacing / 2;

        // Building mesh
        const geometry = this.buildingGeometry.clone();
        geometry.scale(width, height, depth);
        const material = new THREE.MeshStandardMaterial({
          color: 0x8b5a2b,
          roughness: 0.85,
          metalness: 0.1,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(posX, height / 2, posZ);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.group.add(mesh);

        // Windows (instanced)
        const numWindowsX = Math.floor(width * 1.5);
        const numWindowsY = Math.floor(height * 1.2);
        const numWindowsZ = Math.max(1, Math.floor(depth * 0.5));
        const numWindows = numWindowsX * numWindowsY * numWindowsZ * 2; // front + back

        const windowInstances = new THREE.InstancedMesh(
          this.windowGeometry,
          this.windowMaterial,
          numWindows
        );

        let idx = 0;
        const windowW = width / numWindowsX;
        const windowH = height / numWindowsY;

        for (let face = 0; face < 2; face++) {
          for (let wy = 0; wy < numWindowsY; wy++) {
            for (let wx = 0; wx < numWindowsX; wx++) {
              const matrix = new THREE.Matrix4();
              const wpx = posX - width / 2 + wx * windowW + windowW / 2;
              const wpy = height / 2 + wy * windowH - height / 2 + windowH / 2;
              const wpz = posZ + (face === 0 ? depth / 2 + 0.01 : -depth / 2 - 0.01);

              matrix.setPosition(wpx, wpy, wpz);
              if (face === 1) {
                matrix.premultiply(new THREE.Matrix4().makeRotationY(Math.PI));
              }
              windowInstances.setMatrixAt(idx, matrix);
              idx++;
            }
          }
        }

        this.group.add(windowInstances);

        // Rooftop prop
        const roofProp = this.createRoofProp('water_tower', posX, height, posZ);
        this.group.add(roofProp);

        this.buildings.push({
          mesh,
          windows: windowInstances,
          roofProp,
          baseHeight: height,
          width,
          depth,
        });
      }
    }
  }

  private createRoofProp(type: string, x: number, y: number, z: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const propMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.8 });

    switch (type) {
      case 'water_tower': {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 4, 16), propMat);
        body.position.y = 2;
        const tank = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 16), propMat);
        tank.position.y = 5;
        group.add(body, tank);
        break;
      }
      case 'ac_units': {
        for (let i = 0; i < 3; i++) {
          const unit = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), propMat);
          unit.position.set(-2 + i * 2, 0.5, 0);
          group.add(unit);
        }
        break;
      }
      case 'antennas': {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 8), propMat);
        pole.position.y = 1.5;
        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2, 8), propMat);
        antenna.position.y = 4;
        antenna.rotation.z = Math.PI / 6;
        group.add(pole, antenna);
        break;
      }
      case 'sat_dishes': {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2, 8), propMat);
        pole.position.y = 1;
        const dish = new THREE.Mesh(
          new THREE.ConeGeometry(1.5, 0.5, 16, 1),
          propMat
        );
        dish.position.y = 2;
        dish.rotation.z = Math.PI / 4;
        group.add(pole, dish);
        break;
      }
      case 'led_signs': {
        const sign = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 0.2), new THREE.MeshStandardMaterial({
          color: 0x00aaff,
          emissive: 0x00aaff,
          emissiveIntensity: 0.8,
        }));
        sign.position.y = 0.5;
        group.add(sign);
        break;
      }
      case 'greenery': {
        const planter = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 1, 16), new THREE.MeshStandardMaterial({ color: 0x5d4037 }));
        const plants = new THREE.Mesh(new THREE.SphereGeometry(1.8, 16, 16), new THREE.MeshStandardMaterial({ color: 0x2e7d32 }));
        plants.position.y = 1;
        group.add(planter, plants);
        break;
      }
      case 'solar': {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 2), new THREE.MeshStandardMaterial({ color: 0x1a237e }));
        panel.position.y = 0.5;
        group.add(panel);
        break;
      }
    }

    return group;
  }

  setEra(era: EraId): void {
    this.applyEra(era);
  }

  updateTransition(targetEra: EraId, t: number, fromEra: EraId): void {
    const fromSpec = BUILDING_SPECS[fromEra];
    const toSpec = BUILDING_SPECS[targetEra];

    for (const building of this.buildings) {
      // Interpolate facade color
      const color = fromSpec.color.clone().lerp(toSpec.color, t);
      const mat = building.mesh.material as THREE.MeshStandardMaterial;
      mat.color.copy(color);
      mat.roughness = THREE.MathUtils.lerp(fromSpec.roughness, toSpec.roughness, t);
      mat.metalness = THREE.MathUtils.lerp(fromSpec.metalness, toSpec.metalness, t);

      // Interpolate height
      const fromHeight = fromSpec.height + building.baseHeight * 0;
      const toHeight = toSpec.height + building.baseHeight * 0;
      const newHeight = THREE.MathUtils.lerp(fromHeight, toHeight, t);
      building.mesh.scale.y = newHeight / building.baseHeight;
      building.mesh.position.y = newHeight / 2;

      // Interpolate window emissive
      const windowColor = fromSpec.windowEmissive.clone().lerp(toSpec.windowEmissive, t);
      const windowIntensity = THREE.MathUtils.lerp(fromSpec.windowIntensity, toSpec.windowIntensity, t);
      const windowMat = building.windows.material as THREE.MeshStandardMaterial;
      windowMat.color.copy(windowColor);
      windowMat.emissive.copy(windowColor);
      windowMat.emissiveIntensity = windowIntensity;

      // Update rooftop prop
      if (building.roofProp) {
        this.group.remove(building.roofProp);
        building.roofProp = this.createRoofProp(toSpec.roofProp, building.mesh.position.x, newHeight, building.mesh.position.z);
        this.group.add(building.roofProp);
      }
    }
  }

  private applyEra(era: EraId): void {
    const spec = BUILDING_SPECS[era];
    for (const building of this.buildings) {
      const mat = building.mesh.material as THREE.MeshStandardMaterial;
      mat.color.copy(spec.color);
      mat.roughness = spec.roughness;
      mat.metalness = spec.metalness;

      const height = spec.height + (building.baseHeight - 12);
      building.mesh.scale.y = height / building.baseHeight;
      building.mesh.position.y = height / 2;

      const windowMat = building.windows.material as THREE.MeshStandardMaterial;
      windowMat.color.copy(spec.windowEmissive);
      windowMat.emissive.copy(spec.windowEmissive);
      windowMat.emissiveIntensity = spec.windowIntensity;

      if (building.roofProp) {
        this.group.remove(building.roofProp);
        building.roofProp = this.createRoofProp(spec.roofProp, building.mesh.position.x, height, building.mesh.position.z);
        this.group.add(building.roofProp);
      }
    }
  }

  update(_dt: number, _state: AppState): void {
    // Buildings don't need per-frame updates unless transitioning
    // Window emissive flicker for realism
    for (const building of this.buildings) {
      const windowMat = building.windows.material as THREE.MeshStandardMaterial;
      if (windowMat.emissiveIntensity > 0) {
        const flicker = 1 + (Math.random() - 0.5) * 0.05;
        windowMat.emissiveIntensity = windowMat.emissiveIntensity * 0.95 + (windowMat.emissiveIntensity * flicker) * 0.05;
      }
    }
  }

  dispose(): void {
    this.buildingGeometry.dispose();
    this.windowGeometry.dispose();
    this.windowMaterial.dispose();
    this.group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    this.scene.remove(this.group);
  }
}
