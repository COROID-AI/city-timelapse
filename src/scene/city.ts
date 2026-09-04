/**
 * Primary scene composition: owns every era-driven module and maps the
 * continuous era float into each module's update. Owns no renderer, camera
 * or animation loop — those belong to the composition root (src/main.ts).
 */
import { Group } from 'three';
import { AppState } from '../state';
import { Environment } from './sky';
import { Ground } from './streets';
import { Buildings } from './buildings';
import { Vehicles } from './vehicles';
import { Pedestrians } from './pedestrians';
import { StreetProps } from './streetProps';
import { Billboards } from './billboards';

export class CityScene {
  readonly group = new Group();
  private readonly environment: Environment;
  private readonly ground: Ground;
  private readonly buildings: Buildings;
  private readonly vehicles: Vehicles;
  private readonly pedestrians: Pedestrians;
  private readonly street: StreetProps;
  private readonly billboards: Billboards;

  constructor() {
    this.environment = new Environment();
    this.ground = new Ground();
    this.buildings = new Buildings();
    this.vehicles = new Vehicles();
    this.pedestrians = new Pedestrians();
    this.street = new StreetProps();
    this.billboards = new Billboards();

    this.group.add(this.environment.group);
    this.group.add(this.ground.group);
    this.group.add(this.buildings.group);
    this.group.add(this.vehicles.group);
    this.group.add(this.pedestrians.group);
    this.group.add(this.street.group);
    this.group.add(this.billboards.group);
  }

  /** Advance every module with the current app state. */
  update(dt: number, state: AppState): void {
    this.environment.update(dt, state);
    this.ground.update(state);
    this.buildings.update(state);
    this.vehicles.update(dt, state);
    this.pedestrians.update(dt, state);
    this.street.update(state);
    this.billboards.update(state);
  }

  dispose(): void {
    this.environment.dispose();
    this.ground.dispose();
    this.buildings.dispose();
    this.vehicles.dispose();
    this.pedestrians.dispose();
    this.street.dispose();
    this.billboards.dispose();
  }
}