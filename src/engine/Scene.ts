/**
 * Boot scene: a minimal but real three.js scene (ground, sky, city block,
 * and ambient light) that renders at least one frame so the loading overlay
 * can be dismissed. Era-specific visuals are NOT built here; they belong to
 * their own tasks in later phases and register through the SceneRegistry.
 */
import {
  AmbientLight,
  BackSide,
  BoxGeometry,
  Color,
  DirectionalLight,
  Fog,
  GridHelper,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  SphereGeometry,
} from 'three';

/** Directional light that casts the "sun" across the block. */
const SUN_POSITION = { x: 12, y: 18, z: 8 };

/**
 * Builds the boot scene. The returned scene is added to by downstream
 * modules via `SceneRegistry`; it renders a ground plane, a low-poly city
 * block, a sky dome, and ambient light so the first frame is meaningful.
 */
export function createBootScene(): Scene {
  const scene = new Scene();
  scene.background = new Color(0x18233b); // deep night-blue sky
  scene.fog = new Fog(0x18233b, 24, 60);

  // Ground plane (the street level the city sits on).
  const ground = new Mesh(
    new PlaneGeometry(60, 60),
    new MeshStandardMaterial({ color: 0x333a44, roughness: 0.9 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Low-poly sky dome so the horizon reads as sky rather than void.
  const sky = new Mesh(
    new SphereGeometry(50, 16, 12),
    new MeshStandardMaterial({ color: 0x1b2a4a, roughness: 1, side: BackSide }),
  );
  scene.add(sky);

  // A simple city block: a cluster of boxes. This is only a placeholder —
  // real per-era buildings are built by the buildings task.
  const blockGroup = new Group();
  const buildingMaterial = new MeshStandardMaterial({ color: 0x2c3b52, roughness: 0.85 });
  const layouts: Array<[number, number, number]> = [
    [2, 1.6, 2],
    [2.4, 2.2, 2.4],
    [1.8, 1.2, 1.8],
    [2.2, 3.0, 2.2],
    [1.6, 2.6, 1.6],
    [2.0, 2.0, 2.0],
  ];
  const positions: Array<[number, number]> = [
    [-2.6, -2.2],
    [0.4, -2.4],
    [2.8, -2.0],
    [-2.2, 0.6],
    [0.2, 0.8],
    [2.4, 1.0],
  ];
  for (let i = 0; i < layouts.length; i += 1) {
    const [w, h, d] = layouts[i];
    const [px, pz] = positions[i];
    const box = new Mesh(new BoxGeometry(w, h, d), buildingMaterial);
    box.position.set(px, h / 2, pz);
    blockGroup.add(box);
  }
  scene.add(blockGroup);

  // Street grid lines so camera motion reads against the ground.
  const grid = new GridHelper(40, 20, 0x4a5566, 0x2c3442);
  grid.position.y = 0.02;
  scene.add(grid);

  // Lighting: soft ambient + hemisphere fill + directional sun.
  const ambient = new AmbientLight(0xffffff, 0.35);
  scene.add(ambient);

  const hemisphere = new HemisphereLight(0xbdd8ff, 0x22303f, 0.5);
  scene.add(hemisphere);

  const sun = new DirectionalLight(0xfff2dd, 1.1);
  sun.position.set(SUN_POSITION.x, SUN_POSITION.y, SUN_POSITION.z);
  scene.add(sun);

  return scene;
}