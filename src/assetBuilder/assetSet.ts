/**
 * AssetSet - Complete era configuration with all building, vehicle, pedestrian, and storefront assets
 */

import type { EraId } from '../eras';
import { BuildingFactory, type Building } from './building';
import { VehicleFactory, type Vehicle } from './vehicle';
import { PedestrianFactory, type Pedestrian } from './pedestrian';
import { StorefrontFactory, type Storefront } from './storefront';

export interface AssetConfig {
  eraId: EraId;
  buildingCount: number;
  vehicleCount: number;
  pedestrianCount: number;
  storefrontCount: number;
}

export class AssetSet {
  private buildingFactory: BuildingFactory;
  private vehicleFactory: VehicleFactory;
  private pedestrianFactory: PedestrianFactory;
  private storefrontFactory: StorefrontFactory;
  
  public readonly buildings: Building[] = [];
  public readonly vehicles: Vehicle[] = [];
  public readonly pedestrians: Pedestrian[] = [];
  public readonly storefronts: Storefront[] = [];

  constructor(private config: AssetConfig) {
    this.buildingFactory = new BuildingFactory(config.eraId);
    this.vehicleFactory = new VehicleFactory(config.eraId);
    this.pedestrianFactory = new PedestrianFactory(config.eraId);
    this.storefrontFactory = new StorefrontFactory(config.eraId);
  }

  /**
   * Generate all assets for this era configuration
   */
  build(): this {
    // Generate buildings along the street
    for (let i = 0; i < this.config.buildingCount; i++) {
      this.buildings.push(this.buildingFactory.create({
        position: { x: (i - (this.config.buildingCount - 1) / 2) * 20, y: 0, z: 0 },
        height: 10 + Math.random() * 15,
        buildingType: i % 3
      }));
    }

    // Generate vehicles on the road
    for (let i = 0; i < this.config.vehicleCount; i++) {
      this.vehicles.push(this.vehicleFactory.create({
        position: { x: (i - (this.config.vehicleCount - 1) / 2) * 8, y: 0, z: -5 },
        rotation: i % 2 === 0 ? 0 : Math.PI
      }));
    }

    // Generate pedestrians on sidewalks
    for (let i = 0; i < this.config.pedestrianCount; i++) {
      this.pedestrians.push(this.pedestrianFactory.create({
        position: { x: (Math.random() - 0.5) * 40, y: 0, z: 5 + Math.random() * 10 }
      }));
    }

    // Generate storefronts
    for (let i = 0; i < this.config.storefrontCount; i++) {
      this.storefronts.push(this.storefrontFactory.create({
        position: { x: (i - (this.config.storefrontCount - 1) / 2) * 25, y: 0, z: -2 },
        storeType: i % 4
      }));
    }

    return this;
  }

  /**
   * Get all Three.js objects for this asset set
   */
  getObjects(): THREE.Object3D[] {
    const objects: THREE.Object3D[] = [];
    this.buildings.forEach(b => objects.push(b.mesh));
    this.vehicles.forEach(v => objects.push(v.mesh));
    this.pedestrians.forEach(p => objects.push(p.mesh));
    this.storefronts.forEach(s => objects.push(s.mesh));
    return objects;
  }

  /**
   * Clean up all assets
   */
  dispose(): void {
    this.buildings.forEach(b => b.mesh.geometry.dispose());
    this.vehicles.forEach(v => v.mesh.geometry.dispose());
    this.pedestrians.forEach(p => p.mesh.geometry.dispose());
    this.storefronts.forEach(s => s.mesh.geometry.dispose());
  }
}