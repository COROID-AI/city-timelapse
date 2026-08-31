/**
 * Scene compositor: owns the primary Scene, background/fog and the city
 * module groups. Follows the ownership contract: no renderer, camera, or loop
 * here — main.ts owns those and calls update/setEra/dispose.
 */

import * as THREE from 'three';
import { getEraSegment, type AppState } from '../state';
import { type EraId } from '../eras';
import { createCityEnvironment } from './environment';
import { createBuildings } from './buildings';
import { createVehicles } from './vehicles';
import { createPedestrians } from './pedestrians';
import { createAtmosphere } from './atmosphere';

export interface CityScene {
  readonly scene: THREE.Scene;
  readonly atmosphere: ReturnType<typeof createAtmosphere>;
  update(dt: number, state: AppState): void;
  setEra(era: EraId, t: number): void;
  dispose(): void;
}

const ERA_IDS: EraId[] = ['1945', '1965', '1985', '2005', '2025'];

export function createCityScene(): CityScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#b8a888');
  scene.fog = new THREE.Fog('#c8b89a', 40, 150);

  const environment = createCityEnvironment();
  const buildings = createBuildings();
  const vehicles = createVehicles();
  const pedestrians = createPedestrians();
  const atmosphere = createAtmosphere();

  scene.add(atmosphere.group);
  scene.add(environment.group);
  scene.add(buildings.group);
  scene.add(vehicles.group);
  scene.add(pedestrians.group);

  const env: CityScene = {
    scene,
    atmosphere,
    update(dt: number, state: AppState): void {
      environment.update(dt, state);
      buildings.update(dt, state);
      vehicles.update(dt, state);
      pedestrians.update(dt, state);
      atmosphere.update(dt, state);

      // Follow the era for fog
      const seg = getEraSegment(state.eraIndex);
      const loFog = ATMOS_FOG_COLORS[ERA_IDS[seg.lo]];
      const hiFog = ATMOS_FOG_COLORS[ERA_IDS[seg.hi]];
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.color.copy(new THREE.Color(loFog)).lerp(new THREE.Color(hiFog), seg.t);
      }
    },
    setEra(era: EraId, t: number): void {
      environment.setEra(era, t);
      buildings.setEra(era, t);
      vehicles.setEra(era, t);
      pedestrians.setEra(era, t);
      atmosphere.setEra(era, t);
    },
    dispose(): void {
      environment.dispose();
      buildings.dispose();
      vehicles.dispose();
      pedestrians.dispose();
      atmosphere.dispose();
      scene.clear();
    },
  };
  return env;
}

const ATMOS_FOG_COLORS: Record<EraId, string> = {
  '1945': '#c8b89a',
  '1965': '#d8d8d0',
  '1985': '#9a9090',
  '2005': '#808a92',
  '2025': '#3a4a5a',
};