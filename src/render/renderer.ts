import { BoxGeometry, Mesh, MeshStandardMaterial, Scene } from 'three';
import { CityBlockLayout } from '../layout/cityBlockLayout';
import { BuildingShell } from '../types/buildingShell';
import { createLightRig, LightRig } from './lighting';
import { createSky, Sky } from './sky';

/**
 * Renderer: builds the placeholder Three.js scene.
 *
 * Proves the pipeline end-to-end: flat ground, streets/sidewalks, grey box
 * building shells per lot, and the light rig. The vehicle is added by the app
 * assembler.
 */
export interface Renderer {
  /** The Three.js scene. */
  readonly scene: Scene;
  /** The ground mesh. */
  readonly ground: Mesh;
  /** The building shell meshes, one per lot. */
  readonly shellMeshes: Mesh[];
  /** The light rig (drives setTimeOfDay). */
  readonly light: LightRig;
  /** The sky (drives time-of-day tinting). */
  readonly sky: Sky;
  /** Placeholder: re-tint shells for a new era. */
  setEra(era: number): void;
}

function rectMesh(
  scene: Scene,
  originX: number,
  originZ: number,
  w: number,
  d: number,
  y: number,
  color: [number, number, number],
): Mesh {
  const mesh = new Mesh(new BoxGeometry(w, 0.2, d), new MeshStandardMaterial());
  mesh.material.color.setRGB(color[0], color[1], color[2]);
  mesh.position.set(originX + w / 2, y, originZ + d / 2);
  scene.add(mesh);
  return mesh;
}

export function createRenderer(
  layout: CityBlockLayout,
  shells: BuildingShell[],
): Renderer {
  const scene = new Scene();

  // Ground plane.
  const ground = rectMesh(
    scene,
    layout.ground.origin.x,
    layout.ground.origin.z,
    layout.ground.width,
    layout.ground.depth,
    0,
    [0.22, 0.24, 0.2],
  );

  // Streets (dark asphalt).
  for (const street of layout.streets) {
    rectMesh(scene, street.rect.origin.x, street.rect.origin.z, street.rect.width, street.rect.depth, 0.01, [0.12, 0.12, 0.13]);
  }
  // Cross street.
  const cs = layout.crossStreet;
  rectMesh(scene, cs.rect.origin.x, cs.rect.origin.z, cs.rect.width, cs.rect.depth, 0.01, [0.12, 0.12, 0.13]);
  // Intersection.
  rectMesh(scene, layout.intersection.rect.origin.x, layout.intersection.rect.origin.z, layout.intersection.rect.width, layout.intersection.rect.depth, 0.011, [0.1, 0.1, 0.11]);
  // Sidewalks (lighter).
  for (const sw of layout.sidewalks) {
    rectMesh(scene, sw.rect.origin.x, sw.rect.origin.z, sw.rect.width, sw.rect.depth, 0.012, [0.55, 0.55, 0.55]);
  }

  // Building shells.
  const shellMeshes: Mesh[] = [];
  for (const shell of shells) {
    const mesh = new Mesh(
      new BoxGeometry(shell.rect.width, shell.height, shell.rect.depth),
      new MeshStandardMaterial(),
    );
    mesh.material.color.setRGB(0.55, 0.55, 0.56);
    mesh.position.set(
      shell.rect.origin.x + shell.rect.width / 2,
      shell.height / 2,
      shell.rect.origin.z + shell.rect.depth / 2,
    );
    scene.add(mesh);
    shellMeshes.push(mesh);
  }

  // Light rig + sky.
  const light = createLightRig(scene);
  const sky = createSky(scene);

  return {
    scene,
    ground,
    shellMeshes,
    light,
    sky,
    setEra(era: number) {
      const f = 0.85 + ((era % 100) / 100) * 0.3;
      for (const m of shellMeshes) {
        m.material.color.setRGB(0.55 * f, 0.55 * f, 0.56 * f);
      }
    },
  };
}