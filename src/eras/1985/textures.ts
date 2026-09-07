import { BoxGeometry, Mesh, MeshStandardMaterial, Object3D } from 'three';
import { applyColorHex } from './palette';

/**
 * Textures & visual detail helpers for 1985 era content.
 *
 * Provides procedural geometric pattern builders and styling helpers
 * for 80s aesthetic elements:
 * - Hand-lettered VHS posters
 * - Arcade cabinet screens and glowing marquees
 * - Backlit billboard panels
 * - Neon sign letters and tubes
 * - Smog / grime banding on brick facades
 * - Fire escapes with zigzag stairs and safety railings
 * - HVAC fans and water tower slats
 * - Cassette tapes, boomboxes, and flyers
 */

export function createColoredBox(
  w: number,
  h: number,
  d: number,
  hexColor: string,
  pos?: { x: number; y: number; z: number },
  rot?: { x?: number; y?: number; z?: number },
): Mesh {
  const geom = new BoxGeometry(w, h, d);
  const mat = new MeshStandardMaterial();
  applyColorHex(mat.color, hexColor);
  const mesh = new Mesh(geom, mat);
  if (pos) {
    mesh.position.set(pos.x, pos.y, pos.z);
  }
  if (rot) {
    if (rot.x !== undefined) mesh.rotation.x = rot.x;
    if (rot.y !== undefined) mesh.rotation.y = rot.y;
    if (rot.z !== undefined) mesh.rotation.z = rot.z;
  }
  return mesh;
}

/** Builds an illuminated 80s neon tube / letter segment */
export function createNeonSegment(
  w: number,
  h: number,
  d: number,
  hexColor: string,
  pos: { x: number; y: number; z: number },
): Mesh {
  const mesh = createColoredBox(w, h, d, hexColor, pos);
  return mesh;
}

/** Builds a fire escape flight with landings and zigzag stairs */
export function createFireEscape(
  floorCount: number,
  floorHeight: number,
  width = 2.4,
  depth = 1.2,
): Object3D {
  const escape = new Object3D();
  const ironColor = '#242528';
  const railColor = '#303236';

  for (let f = 1; f <= floorCount; f++) {
    const y = f * floorHeight;
    // Platform grating
    const platform = createColoredBox(width, 0.08, depth, ironColor, {
      x: 0,
      y,
      z: depth / 2,
    });
    escape.add(platform);

    // Platform Railing (front, left, right)
    const railFront = createColoredBox(width, 0.7, 0.04, railColor, {
      x: 0,
      y: y + 0.35,
      z: depth - 0.02,
    });
    const railLeft = createColoredBox(0.04, 0.7, depth, railColor, {
      x: -width / 2 + 0.02,
      y: y + 0.35,
      z: depth / 2,
    });
    const railRight = createColoredBox(0.04, 0.7, depth, railColor, {
      x: width / 2 - 0.02,
      y: y + 0.35,
      z: depth / 2,
    });
    escape.add(railFront, railLeft, railRight);

    // Diagonal ladder / stair to lower floor
    if (f > 1) {
      const stairAngle = (f % 2 === 0 ? 0.35 : -0.35);
      const stair = createColoredBox(
        0.5,
        floorHeight * 1.15,
        0.1,
        ironColor,
        {
          x: (f % 2 === 0 ? 0.4 : -0.4),
          y: y - floorHeight / 2,
          z: depth * 0.4,
        },
        { z: stairAngle },
      );
      escape.add(stair);
    }
  }

  return escape;
}

/** Builds rooftop water tower (wooden cylindrical tank on steel scaffold) */
export function createWaterTower(height = 6, radius = 1.8): Object3D {
  const root = new Object3D();
  const stiltColor = '#2b2d30';
  const woodColor = '#4a3828';
  const bandColor = '#1c1c1c';
  const roofColor = '#362a1e';

  // 4 Legs
  const legH = height * 0.55;
  const legW = 0.15;
  const spread = radius * 0.8;
  const legs = [
    { x: -spread, z: -spread },
    { x: spread, z: -spread },
    { x: -spread, z: spread },
    { x: spread, z: spread },
  ];

  for (const l of legs) {
    const leg = createColoredBox(legW, legH, legW, stiltColor, {
      x: l.x,
      y: legH / 2,
      z: l.z,
    });
    root.add(leg);
  }

  // Cross braces
  const brace1 = createColoredBox(spread * 2, 0.08, 0.08, stiltColor, {
    x: 0,
    y: legH * 0.4,
    z: spread,
  });
  const brace2 = createColoredBox(spread * 2, 0.08, 0.08, stiltColor, {
    x: 0,
    y: legH * 0.4,
    z: -spread,
  });
  root.add(brace1, brace2);

  // Platform
  const plat = createColoredBox(radius * 2.2, 0.15, radius * 2.2, stiltColor, {
    x: 0,
    y: legH + 0.08,
    z: 0,
  });
  root.add(plat);

  // Tank body (multi-sided box approximation for stability)
  const tankH = height * 0.4;
  const tankY = legH + 0.15 + tankH / 2;
  const tankMain = createColoredBox(radius * 1.8, tankH, radius * 1.8, woodColor, {
    x: 0,
    y: tankY,
    z: 0,
  });
  const tankAngle = createColoredBox(
    radius * 1.8,
    tankH,
    radius * 1.8,
    woodColor,
    { x: 0, y: tankY, z: 0 },
    { y: Math.PI / 4 },
  );
  root.add(tankMain, tankAngle);

  // Metal hoops
  const hoop1 = createColoredBox(radius * 1.85, 0.08, radius * 1.85, bandColor, {
    x: 0,
    y: tankY - tankH * 0.25,
    z: 0,
  });
  const hoop2 = createColoredBox(radius * 1.85, 0.08, radius * 1.85, bandColor, {
    x: 0,
    y: tankY + tankH * 0.25,
    z: 0,
  });
  root.add(hoop1, hoop2);

  // Conical/Pyramidal roof
  const roof = createColoredBox(radius * 1.9, 0.7, radius * 1.9, roofColor, {
    x: 0,
    y: tankY + tankH / 2 + 0.35,
    z: 0,
  });
  root.add(roof);

  return root;
}

/** Builds commercial rooftop HVAC chiller unit with fans and ducts */
export function createRooftopHVAC(width = 3.2, height = 1.6, depth = 2.2): Object3D {
  const root = new Object3D();
  const metalColor = '#686f78';
  const ventColor = '#2d3033';
  const rustColor = '#5e4334';

  // Base cabinet
  const cabinet = createColoredBox(width, height, depth, metalColor, {
    x: 0,
    y: height / 2,
    z: 0,
  });
  root.add(cabinet);

  // Louver side vents
  const louverFront = createColoredBox(width * 0.85, height * 0.6, 0.05, ventColor, {
    x: 0,
    y: height / 2,
    z: depth / 2 + 0.02,
  });
  const louverBack = createColoredBox(width * 0.85, height * 0.6, 0.05, ventColor, {
    x: 0,
    y: height / 2,
    z: -depth / 2 - 0.02,
  });
  root.add(louverFront, louverBack);

  // Top fan cowlings
  const fan1 = createColoredBox(width * 0.35, 0.3, width * 0.35, ventColor, {
    x: -width * 0.25,
    y: height + 0.15,
    z: 0,
  });
  const fan2 = createColoredBox(width * 0.35, 0.3, width * 0.35, ventColor, {
    x: width * 0.25,
    y: height + 0.15,
    z: 0,
  });
  root.add(fan1, fan2);

  // Duct pipe
  const duct = createColoredBox(0.4, height * 0.8, 0.4, rustColor, {
    x: width / 2 + 0.2,
    y: height * 0.4,
    z: 0,
  });
  root.add(duct);

  return root;
}
