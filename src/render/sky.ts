import { Mesh, MeshStandardMaterial, Scene, SphereGeometry } from 'three';

/**
 * Sky: a simple gradient sky dome plus a sun disc. Shifts tint with the
 * time-of-day preview slider.
 */
export interface Sky {
  /** The sky dome mesh. */
  readonly dome: Mesh;
  /** The sun disc mesh. */
  readonly sunDisc: Mesh;
  /** Update sky tint for time-of-day in [0, 1]. */
  update(timeOfDay: number): void;
}

export function createSky(scene: Scene): Sky {
  const dome = new Mesh(new SphereGeometry(600, 16, 8), new MeshStandardMaterial());
  dome.material.color.setRGB(0.4, 0.6, 0.9);

  const sunDisc = new Mesh(new SphereGeometry(20, 16, 8), new MeshStandardMaterial());
  sunDisc.material.color.setRGB(1, 0.9, 0.5);
  sunDisc.position.set(150, 180, -120);

  scene.add(dome, sunDisc);

  const sky: Sky = {
    dome,
    sunDisc,
    update(timeOfDay: number) {
      const t = Math.max(0, Math.min(1, timeOfDay));
      const night = Math.abs(t - 0.5) * 2;
      const dayF = 1 - night;
      dome.material.color.setRGB(
        0.1 + 0.3 * dayF,
        0.15 + 0.45 * dayF,
        0.25 + 0.65 * dayF,
      );
      sunDisc.material.color.setRGB(
        1.0,
        0.6 + 0.4 * dayF,
        0.2 + 0.3 * dayF,
      );
    },
  };
  sky.update(0.5);
  return sky;
}