/**
 * Vehicles and pedestrians module.
 * Creates era-specific vehicles (cars, drones) and pedestrians with era clothing.
 * Uses instanced meshes for performance.
 */
import * as THREE from 'three';
import type { EraId } from '../eras';
import type { AppState } from '../state';

interface VehicleSpec {
  /** Vehicle color */
  color: THREE.Color;
  /** Vehicle type: 'sedan' | 'suv' | 'hatch' | 'truck' | 'drone' */
  type: 'sedan' | 'suv' | 'hatch' | 'truck' | 'drone';
  /** Wheel color */
  wheelColor: THREE.Color;
  /** Whether vehicle has flying capability (2055) */
  flying: boolean;
}

interface PedestrianSpec {
  /** Clothing color palette */
  colors: THREE.Color[];
  /** Hat type */
  hat: 'none' | 'cap' | 'fedora' | 'bucket';
  /** Walk speed multiplier */
  walkSpeed: number;
}

const VEHICLE_SPECS: Record<EraId, VehicleSpec> = {
  '1945': { color: new THREE.Color(0x8b0000), type: 'sedan', wheelColor: new THREE.Color(0x333333), flying: false },
  '1965': { color: new THREE.Color(0xff69b4), type: 'sedan', wheelColor: new THREE.Color(0x333333), flying: false },
  '1985': { color: new THREE.Color(0x00ff00), type: 'hatch', wheelColor: new THREE.Color(0x333333), flying: false },
  '2005': { color: new THREE.Color(0x0066cc), type: 'suv', wheelColor: new THREE.Color(0x333333), flying: false },
  '2025': { color: new THREE.Color(0xffffff), type: 'sedan', wheelColor: new THREE.Color(0x333333), flying: false },
  '2055': { color: new THREE.Color(0x00ffff), type: 'drone', wheelColor: new THREE.Color(0x00ffff), flying: true },
};

const PEDESTRIAN_SPECS: Record<EraId, PedestrianSpec> = {
  '1945': { colors: [new THREE.Color(0x2c3e50), new THREE.Color(0x8b4513), new THREE.Color(0x4a2c2a)], hat: 'fedora', walkSpeed: 0.8 },
  '1965': { colors: [new THREE.Color(0xff69b4), new THREE.Color(0x0066cc), new THREE.Color(0xffd700)], hat: 'cap', walkSpeed: 1.0 },
  '1985': { colors: [new THREE.Color(0xff0066), new THREE.Color(0x00ff00), new THREE.Color(0xffff00)], hat: 'cap', walkSpeed: 1.1 },
  '2005': { colors: [new THREE.Color(0x0066cc), new THREE.Color(0x333333), new THREE.Color(0xffffff)], hat: 'none', walkSpeed: 1.2 },
  '2025': { colors: [new THREE.Color(0x333333), new THREE.Color(0xffffff), new THREE.Color(0x00aaff)], hat: 'none', walkSpeed: 1.3 },
  '2055': { colors: [new THREE.Color(0x00ffff), new THREE.Color(0xff00ff), new THREE.Color(0xffff00)], hat: 'bucket', walkSpeed: 1.0 },
};

interface VehicleInstance {
  mesh: THREE.Group;
  speed: number;
  direction: THREE.Vector3;
  lane: number;
  flyingHeight: number;
}

interface PedestrianInstance {
  mesh: THREE.Group;
  speed: number;
  direction: number;
  walkCycle: number;
  position: THREE.Vector3;
}

export class VehiclesModule {
  group: THREE.Group;
  private scene: THREE.Scene;
  private vehicles: VehicleInstance[] = [];
  private pedestrians: PedestrianInstance[] = [];
  private currentEra: EraId = '1945';

  // Shared geometries
  private carBodyGeometry: THREE.BoxGeometry;
  private carRoofGeometry: THREE.BoxGeometry;
  private wheelGeometry: THREE.CylinderGeometry;
  private droneGeometry: THREE.SphereGeometry;
  private dronePropGeometry: THREE.PlaneGeometry;
  private pedestrianGeometry: THREE.BoxGeometry;
  private hatGeometry: THREE.BoxGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Shared geometries
    this.carBodyGeometry = new THREE.BoxGeometry(4, 1.2, 1.8);
    this.carRoofGeometry = new THREE.BoxGeometry(2, 1, 1.6);
    this.wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16);
    this.droneGeometry = new THREE.SphereGeometry(0.8, 16, 16);
    this.dronePropGeometry = new THREE.PlaneGeometry(3, 0.1);
    this.pedestrianGeometry = new THREE.BoxGeometry(0.4, 1.6, 0.2);
    this.hatGeometry = new THREE.BoxGeometry(0.6, 0.3, 0.5);

    this.generateVehicles();
    this.generatePedestrians();
    this.setEra('1945');
  }

  private generateVehicles(): void {
    const numVehicles = 15;
    const roadWidth = 30;
    const blockLength = 40;

    for (let i = 0; i < numVehicles; i++) {
      const vehicle = this.createVehicle('1945');
      const lane = i % 4;
      const side = Math.floor(i / 4) % 2; // 0 = north-south, 1 = east-west

      let x, z, y;
      if (side === 0) {
        // North-south road
        x = -roadWidth / 2 + (lane * roadWidth / 4) + roadWidth / 8;
        z = -blockLength / 2 + (i % 8) * (blockLength / 8);
        y = 0.8;
      } else {
        // East-west road
        z = -roadWidth / 2 + (lane * roadWidth / 4) + roadWidth / 8;
        x = -blockLength / 2 + (i % 8) * (blockLength / 8);
        y = 0.8;
      }

      vehicle.mesh.position.set(x, y, z);
      vehicle.speed = 2 + Math.random() * 3;
      vehicle.direction = new THREE.Vector3(
        side === 0 ? 0 : (Math.random() > 0.5 ? 1 : -1),
        0,
        side === 0 ? (Math.random() > 0.5 ? 1 : -1) : 0
      ).normalize();
      vehicle.lane = lane;
      vehicle.flyingHeight = 0;

      this.group.add(vehicle.mesh);
      this.vehicles.push(vehicle);
    }
  }

  private createVehicle(era: EraId): VehicleInstance {
    const spec = VEHICLE_SPECS[era];
    const group = new THREE.Group();

    if (spec.type === 'drone') {
      // Flying drone
      const bodyMat = new THREE.MeshStandardMaterial({ color: spec.color, emissive: spec.color, emissiveIntensity: 0.5 });
      const body = new THREE.Mesh(this.droneGeometry, bodyMat);
      group.add(body);

      // Propellers
      for (let i = 0; i < 4; i++) {
        const prop = new THREE.Mesh(this.dronePropGeometry, new THREE.MeshStandardMaterial({ color: 0x888888 }));
        prop.rotation.x = (i * Math.PI) / 2;
        prop.position.set(0, 0.8, 0);
        group.add(prop);
      }
    } else {
      // Ground vehicle
      const bodyMat = new THREE.MeshStandardMaterial({ color: spec.color });
      const body = new THREE.Mesh(this.carBodyGeometry, bodyMat);
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      // Roof
      const roofMat = new THREE.MeshStandardMaterial({ color: spec.color });
      const roof = new THREE.Mesh(this.carRoofGeometry, roofMat);
      roof.position.y = 1;
      group.add(roof);

      // Wheels
      const wheelMat = new THREE.MeshStandardMaterial({ color: spec.wheelColor });
      const wheelPositions = [
        [-1.5, -0.6, 1.0], [1.5, -0.6, 1.0],
        [-1.5, -0.6, -1.0], [1.5, -0.6, -1.0]
      ];
      for (const pos of wheelPositions) {
        const wheel = new THREE.Mesh(this.wheelGeometry, wheelMat);
        wheel.position.set(pos[0], pos[1], pos[2]);
        wheel.rotation.z = Math.PI / 2;
        wheel.castShadow = true;
        group.add(wheel);
      }
    }

    return {
      mesh: group,
      speed: 0,
      direction: new THREE.Vector3(),
      lane: 0,
      flyingHeight: 0,
    };
  }

  private generatePedestrians(): void {
    const numPedestrians = 20;
    const sidewalkWidth = 5;
    const blockLength = 40;

    for (let i = 0; i < numPedestrians; i++) {
      const ped = this.createPedestrian('1945');
      const side = i % 4;

      let x, z;
      if (side < 2) {
        x = -blockLength / 2 - sidewalkWidth / 2 + (i % 2) * sidewalkWidth;
        z = -blockLength / 2 + (i * blockLength / numPedestrians) * 2;
      } else {
        z = -blockLength / 2 - sidewalkWidth / 2 + (i % 2) * sidewalkWidth;
        x = -blockLength / 2 + (i * blockLength / numPedestrians) * 2;
      }

      ped.position.set(x, 0.8, z);
      ped.direction = side < 2 ? 0 : Math.PI / 2;
      ped.walkCycle = Math.random() * Math.PI * 2;
      ped.speed = 0.5 + Math.random() * 0.5;

      this.group.add(ped.mesh);
      this.pedestrians.push(ped);
    }
  }

  private createPedestrian(era: EraId): PedestrianInstance {
    const spec = PEDESTRIAN_SPECS[era];
    const group = new THREE.Group();

    // Body
    const color = spec.colors[Math.floor(Math.random() * spec.colors.length)];
    const bodyMat = new THREE.MeshStandardMaterial({ color });
    const body = new THREE.Mesh(this.pedestrianGeometry, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Hat
    if (spec.hat !== 'none') {
      const hatMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
      const hat = new THREE.Mesh(this.hatGeometry, hatMat);
      hat.position.y = 0.9;
      group.add(hat);
    }

    return {
      mesh: group,
      speed: 0,
      direction: 0,
      walkCycle: 0,
      position: new THREE.Vector3(),
    };
  }

  setEra(era: EraId): void {
    this.currentEra = era;
    this.applyEra(era);
  }

  updateTransition(targetEra: EraId, t: number, fromEra: EraId): void {
    // Crossfade vehicle/pedestrian palette colors.
    const fromVehicleSpec = VEHICLE_SPECS[fromEra];
    const toVehicleSpec = VEHICLE_SPECS[targetEra];
    const fromPedSpec = PEDESTRIAN_SPECS[fromEra];
    const toPedSpec = PEDESTRIAN_SPECS[targetEra];

    // Update vehicle colors
    for (const vehicle of this.vehicles) {
      const color = fromVehicleSpec.color.clone().lerp(toVehicleSpec.color, t);
      vehicle.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshStandardMaterial;
          mat.color.copy(color);
          if (mat.emissive) mat.emissive.copy(color);
        }
      });
    }

    // Update pedestrian colors (use first palette color for smooth transition)
    for (const ped of this.pedestrians) {
      const color = fromPedSpec.colors[0].clone().lerp(toPedSpec.colors[0], t);
      ped.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshStandardMaterial;
          mat.color.copy(color);
        }
      });
    }
  }

  private applyEra(era: EraId): void {
    const vehicleSpec = VEHICLE_SPECS[era];
    const pedSpec = PEDESTRIAN_SPECS[era];

    for (const vehicle of this.vehicles) {
      const color = vehicleSpec.color.clone();
      vehicle.mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshStandardMaterial;
          mat.color.copy(color);
          if (mat.emissive) {
            mat.emissive.copy(color);
          }
        }
      });
    }

    for (const ped of this.pedestrians) {
      const color = pedSpec.colors[Math.floor(Math.random() * pedSpec.colors.length)];
      ped.mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshStandardMaterial;
          mat.color.copy(color);
        }
      });
    }
  }

  update(dt: number, _state: AppState): void {
    const eraSpec = VEHICLE_SPECS[this.currentEra];
    const pedSpec = PEDESTRIAN_SPECS[this.currentEra];

    // Update vehicles
    for (const vehicle of this.vehicles) {
      if (eraSpec.flying) {
        // Flying drones
        vehicle.flyingHeight += dt * 0.2;
        vehicle.mesh.position.y = 3 + Math.sin(vehicle.flyingHeight) * 2;
        vehicle.mesh.rotation.y += dt * 2;
      } else {
        // Ground vehicles
        vehicle.mesh.position.addScaledVector(vehicle.direction, vehicle.speed * dt);
        // Rotate wheels
        vehicle.mesh.children.forEach((child, i) => {
          if (child instanceof THREE.Mesh && i > 1) {
            child.rotation.z += dt * vehicle.speed;
          }
        });
      }

      // Wrap around
      if (Math.abs(vehicle.mesh.position.x) > 50 || Math.abs(vehicle.mesh.position.z) > 50) {
        vehicle.mesh.position.set(
          (Math.random() - 0.5) * 20,
          eraSpec.flying ? 5 : 0.8,
          (Math.random() - 0.5) * 20
        );
      }
    }

    // Update pedestrians
    for (const ped of this.pedestrians) {
      const moveX = Math.cos(ped.direction) * pedSpec.walkSpeed * dt;
      const moveZ = Math.sin(ped.direction) * pedSpec.walkSpeed * dt;
      ped.position.x += moveX;
      ped.position.z += moveZ;
      ped.mesh.position.copy(ped.position);

      // Walk cycle animation
      ped.walkCycle += dt * pedSpec.walkSpeed * 3;
      const bounce = Math.sin(ped.walkCycle) * 0.05;
      ped.mesh.position.y = 0.8 + bounce;

      // Wrap around
      if (Math.abs(ped.position.x) > 25 || Math.abs(ped.position.z) > 25) {
        ped.position.set(
          (Math.random() - 0.5) * 20,
          0.8,
          (Math.random() - 0.5) * 20
        );
        ped.direction = Math.random() * Math.PI * 2;
      }
    }
  }

  dispose(): void {
    this.carBodyGeometry.dispose();
    this.carRoofGeometry.dispose();
    this.wheelGeometry.dispose();
    this.droneGeometry.dispose();
    this.dronePropGeometry.dispose();
    this.pedestrianGeometry.dispose();
    this.hatGeometry.dispose();
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
