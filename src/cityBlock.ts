import * as THREE from 'three';

/** Total square footprint of the city block. */
const BLOCK_SIZE = 60;
/** Width of the cross-shaped road running through the block. */
const ROAD_WIDTH = 12;

/**
 * Builds the static base geometry of the city block: a ground plane, two
 * intersecting streets, and four corner quadrants each carrying a raised
 * sidewalk slab and a building-plot foundation. Returns the created group so
 * downstream tasks can query or extend it.
 */
export function createCityBlock(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  group.name = 'CityBlock';

  // ---- Ground ----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(BLOCK_SIZE, BLOCK_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x355233 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'Ground';
  group.add(ground);

  // ---- Streets (horizontal + vertical cross) ----
  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x26262b });

  const streetHorizontal = new THREE.Mesh(
    new THREE.PlaneGeometry(BLOCK_SIZE, ROAD_WIDTH),
    roadMaterial,
  );
  streetHorizontal.rotation.x = -Math.PI / 2;
  streetHorizontal.position.y = 0.02;
  streetHorizontal.receiveShadow = true;
  streetHorizontal.name = 'StreetHorizontal';
  group.add(streetHorizontal);

  const streetVertical = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_WIDTH, BLOCK_SIZE),
    roadMaterial,
  );
  streetVertical.rotation.x = -Math.PI / 2;
  streetVertical.position.y = 0.02;
  streetVertical.receiveShadow = true;
  streetVertical.name = 'StreetVertical';
  group.add(streetVertical);

  // ---- Four quadrant plots with sidewalks + building foundations ----
  const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: 0x9b9b9b });
  const plotMaterial = new THREE.MeshStandardMaterial({ color: 0x6d5d4b });

  const inner = ROAD_WIDTH / 2;
  const outer = BLOCK_SIZE / 2;
  const quadrantHalf = (outer - inner) / 2;
  const quadrantCenter = inner + quadrantHalf;
  const sidewalkSize = quadrantHalf * 2;
  const plotSize = sidewalkSize * 0.82;

  const signs = [1, -1];
  let plotIndex = 0;
  for (const sx of signs) {
    for (const sz of signs) {
      const cx = sx * quadrantCenter;
      const cz = sz * quadrantCenter;

      // Raised sidewalk slab for the whole quadrant.
      const sidewalk = new THREE.Mesh(
        new THREE.BoxGeometry(sidewalkSize, 0.4, sidewalkSize),
        sidewalkMaterial,
      );
      sidewalk.position.set(cx, 0.2, cz);
      sidewalk.castShadow = true;
      sidewalk.receiveShadow = true;
      sidewalk.name = `Sidewalk_${plotIndex}`;
      group.add(sidewalk);

      // Inset building-plot foundation (placeholder for era-specific buildings).
      const plot = new THREE.Mesh(
        new THREE.BoxGeometry(plotSize, 0.45, plotSize),
        plotMaterial,
      );
      plot.position.set(cx, 0.42, cz);
      plot.receiveShadow = true;
      plot.name = `Plot_${plotIndex}`;
      group.add(plot);

      plotIndex += 1;
    }
  }

  scene.add(group);
  return group;
}
