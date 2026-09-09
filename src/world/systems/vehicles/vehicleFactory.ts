/**
 * Procedural 3D vehicle geometry and instanced mesh factory.
 *
 * Constructs rich, era-authentic vehicle families for all 5 eras:
 * - 1945: Rounded prewar sedans with bulbous fenders, running boards, and upright chrome grilles.
 * - 1965: Long, low midcentury cruisers with sharp rear tailfins and wrap-around chrome bumpers.
 * - 1985: Sharp angular wedge sedans, wagons, and delivery vans with black bumpers and rectangular lights.
 * - 2005: Aerodynamic curved sedans and SUVs with teardrop rooflines and clear polycarbonate lights.
 * - 2025: Sleek cyber EV crossovers, micro-pods, and delivery vans with full-width continuous LED light-bars.
 *
 * Meshes are instanced per body type / era family for maximum rendering performance.
 */

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  type Material,
} from 'three';
import type { VehicleBodyType, VehiclesEraSpec } from '../../../era/types';
import type { EraId } from '../../../era/years';

/**
 * Specification of an assembled part to merge into a composite BufferGeometry.
 */
interface GeometryPart {
  geometry: BufferGeometry;
  translation?: [number, number, number];
  rotation?: [number, number, number]; // Euler XYZ in radians
  scale?: [number, number, number];
}

/**
 * Merges multiple positioned/transformed BufferGeometries into a single BufferGeometry.
 * Safe, pure Three.js implementation with no external dependencies.
 */
export function mergeParts(parts: GeometryPart[]): BufferGeometry {
  const merged = new BufferGeometry();

  let totalVertices = 0;
  let totalIndices = 0;

  // Prepare cloned and transformed temporary geometries
  const prepared = parts.map((part) => {
    const g = part.geometry.clone();
    if (part.scale) {
      g.scale(part.scale[0], part.scale[1], part.scale[2]);
    }
    if (part.rotation) {
      g.rotateX(part.rotation[0]);
      g.rotateY(part.rotation[1]);
      g.rotateZ(part.rotation[2]);
    }
    if (part.translation) {
      g.translate(part.translation[0], part.translation[1], part.translation[2]);
    }

    const pos = g.getAttribute('position');
    const norm = g.getAttribute('normal');
    if (!norm && pos) {
      g.computeVertexNormals();
    }

    const vertCount = pos ? pos.count : 0;
    const index = g.getIndex();
    const indCount = index ? index.count : vertCount;

    totalVertices += vertCount;
    totalIndices += indCount;

    return { geom: g, vertCount, indCount };
  });

  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);
  const indices = new Uint32Array(totalIndices);

  let vertOffset = 0;
  let indexOffset = 0;

  for (const item of prepared) {
    const pos = item.geom.getAttribute('position') as BufferAttribute;
    const norm = item.geom.getAttribute('normal') as BufferAttribute;
    const ind = item.geom.getIndex();

    if (pos) {
      positions.set(pos.array, vertOffset * 3);
    }
    if (norm) {
      normals.set(norm.array, vertOffset * 3);
    }

    if (ind) {
      for (let i = 0; i < ind.count; i += 1) {
        indices[indexOffset + i] = vertOffset + ind.getX(i);
      }
      indexOffset += ind.count;
    } else {
      for (let i = 0; i < item.vertCount; i += 1) {
        indices[indexOffset + i] = vertOffset + i;
      }
      indexOffset += item.vertCount;
    }

    vertOffset += item.vertCount;
    item.geom.dispose();
  }

  merged.setAttribute('position', new BufferAttribute(positions, 3));
  merged.setAttribute('normal', new BufferAttribute(normals, 3));
  merged.setIndex(new BufferAttribute(indices, 1));

  return merged;
}

/**
 * Set of procedural geometries comprising a single vehicle body type.
 */
export interface VehicleTypeGeometries {
  body: BufferGeometry;
  glass: BufferGeometry;
  trim: BufferGeometry;
  wheels: BufferGeometry;
  headlights: BufferGeometry;
  taillights: BufferGeometry;
}

/* ------------------------------------------------------------------ */
/* Procedural geometry builders per era body type                      */
/* ------------------------------------------------------------------ */

/**
 * 1945 Vintage Prewar Sedan:
 * - Rounded bulbous fenders
 * - Side running boards
 * - Upright tall chrome grille
 * - Curved prewar cabin & trunk
 * - Standalone round bulb headlights & ruby round taillights
 */
export function createVintageSedanGeometries(): VehicleTypeGeometries {
  // 1. Painted Body
  const bodyParts: GeometryPart[] = [
    // Main lower fuselage
    {
      geometry: new BoxGeometry(4.4, 0.6, 1.6),
      translation: [0, 0.6, 0],
    },
    // Rounded cabin
    {
      geometry: new BoxGeometry(2.0, 0.75, 1.45),
      translation: [-0.2, 1.25, 0],
    },
    // High elevated engine hood
    {
      geometry: new BoxGeometry(1.6, 0.5, 1.2),
      translation: [1.3, 0.95, 0],
    },
    // Sloped rear trunk
    {
      geometry: new BoxGeometry(1.0, 0.45, 1.4),
      translation: [-1.6, 0.9, 0],
    },
    // Left front bulbous fender
    {
      geometry: new BoxGeometry(1.4, 0.45, 0.35),
      translation: [1.2, 0.55, 0.85],
    },
    // Right front bulbous fender
    {
      geometry: new BoxGeometry(1.4, 0.45, 0.35),
      translation: [1.2, 0.55, -0.85],
    },
    // Left rear bulbous fender
    {
      geometry: new BoxGeometry(1.3, 0.45, 0.35),
      translation: [-1.3, 0.55, 0.85],
    },
    // Right rear bulbous fender
    {
      geometry: new BoxGeometry(1.3, 0.45, 0.35),
      translation: [-1.3, 0.55, -0.85],
    },
  ];

  // 2. Glass (windshield, rear oval window, side windows)
  const glassParts: GeometryPart[] = [
    // Split front windshield
    {
      geometry: new BoxGeometry(0.08, 0.45, 1.35),
      translation: [0.81, 1.26, 0],
      rotation: [0, 0, -0.2],
    },
    // Rear window
    {
      geometry: new BoxGeometry(0.08, 0.38, 1.2),
      translation: [-1.21, 1.24, 0],
      rotation: [0, 0, 0.25],
    },
    // Side glass left
    {
      geometry: new BoxGeometry(1.8, 0.4, 0.06),
      translation: [-0.2, 1.26, 0.74],
    },
    // Side glass right
    {
      geometry: new BoxGeometry(1.8, 0.4, 0.06),
      translation: [-0.2, 1.26, -0.74],
    },
  ];

  // 3. Trim: Running boards, upright chrome grille, curved bumpers
  const trimParts: GeometryPart[] = [
    // Left running board (side step connecting fenders)
    {
      geometry: new BoxGeometry(1.4, 0.08, 0.28),
      translation: [-0.05, 0.24, 0.88],
    },
    // Right running board
    {
      geometry: new BoxGeometry(1.4, 0.08, 0.28),
      translation: [-0.05, 0.24, -0.88],
    },
    // Upright vintage chrome grille
    {
      geometry: new BoxGeometry(0.12, 0.65, 0.75),
      translation: [2.22, 0.75, 0],
    },
    // Front chrome bumper
    {
      geometry: new BoxGeometry(0.15, 0.12, 1.8),
      translation: [2.3, 0.38, 0],
    },
    // Rear chrome bumper
    {
      geometry: new BoxGeometry(0.15, 0.12, 1.8),
      translation: [-2.28, 0.38, 0],
    },
  ];

  // 4. Wheels: 4 vintage dish wheels with hubcaps
  const wheelGeom = new CylinderGeometry(0.36, 0.36, 0.22, 12);
  const wheelsParts: GeometryPart[] = [
    { geometry: wheelGeom, translation: [1.3, 0.36, 0.85], rotation: [Math.PI / 2, 0, 0] },
    { geometry: wheelGeom, translation: [1.3, 0.36, -0.85], rotation: [Math.PI / 2, 0, 0] },
    { geometry: wheelGeom, translation: [-1.3, 0.36, 0.85], rotation: [Math.PI / 2, 0, 0] },
    { geometry: wheelGeom, translation: [-1.3, 0.36, -0.85], rotation: [Math.PI / 2, 0, 0] },
  ];

  // 5. Headlights: Round chrome bulb pods mounted on front fenders
  const headGeom = new CylinderGeometry(0.14, 0.14, 0.1, 10);
  const headlightsParts: GeometryPart[] = [
    { geometry: headGeom, translation: [2.18, 0.78, 0.65], rotation: [0, 0, Math.PI / 2] },
    { geometry: headGeom, translation: [2.18, 0.78, -0.65], rotation: [0, 0, Math.PI / 2] },
  ];

  // 6. Taillights: Round small ruby taillights
  const tailGeom = new CylinderGeometry(0.08, 0.08, 0.08, 8);
  const taillightsParts: GeometryPart[] = [
    { geometry: tailGeom, translation: [-2.18, 0.68, 0.72], rotation: [0, 0, Math.PI / 2] },
    { geometry: tailGeom, translation: [-2.18, 0.68, -0.72], rotation: [0, 0, Math.PI / 2] },
  ];

  return {
    body: mergeParts(bodyParts),
    glass: mergeParts(glassParts),
    trim: mergeParts(trimParts),
    wheels: mergeParts(wheelsParts),
    headlights: mergeParts(headlightsParts),
    taillights: mergeParts(taillightsParts),
  };
}

/**
 * 1965 Midcentury Finned Chrome Cruiser:
 * - Sharp rising rear tailfins
 * - Long low wide proportions
 * - Wide horizontal chrome grille & wrap-around bumpers
 * - Dual chrome headlights & bullet tailfin lights
 */
export function createMidcenturyCruiserGeometries(): VehicleTypeGeometries {
  // 1. Painted Body
  const bodyParts: GeometryPart[] = [
    // Low wide lower body
    {
      geometry: new BoxGeometry(5.2, 0.52, 1.9),
      translation: [0, 0.56, 0],
    },
    // Midcentury canopy / greenhouse
    {
      geometry: new BoxGeometry(2.3, 0.62, 1.6),
      translation: [-0.2, 1.12, 0],
    },
    // Left rear tailfin (rising sharp fin)
    {
      geometry: new BoxGeometry(1.6, 0.38, 0.18),
      translation: [-1.8, 0.95, 0.88],
      rotation: [0, 0, 0.12],
    },
    // Right rear tailfin
    {
      geometry: new BoxGeometry(1.6, 0.38, 0.18),
      translation: [-1.8, 0.95, -0.88],
      rotation: [0, 0, 0.12],
    },
  ];

  // 2. Glass
  const glassParts: GeometryPart[] = [
    // Wrap-around front windshield
    {
      geometry: new BoxGeometry(0.08, 0.5, 1.52),
      translation: [0.96, 1.12, 0],
      rotation: [0, 0, -0.32],
    },
    // Panoramic rear window
    {
      geometry: new BoxGeometry(0.08, 0.48, 1.5),
      translation: [-1.36, 1.1, 0],
      rotation: [0, 0, 0.35],
    },
    // Side glass
    {
      geometry: new BoxGeometry(2.1, 0.42, 0.05),
      translation: [-0.2, 1.12, 0.81],
    },
    {
      geometry: new BoxGeometry(2.1, 0.42, 0.05),
      translation: [-0.2, 1.12, -0.81],
    },
  ];

  // 3. Trim: Heavy chrome grille, wrap-around bumpers, fin chrome strips
  const trimParts: GeometryPart[] = [
    // Wide horizontal front chrome grille
    {
      geometry: new BoxGeometry(0.12, 0.38, 1.7),
      translation: [2.62, 0.58, 0],
    },
    // Front wrap-around chrome bumper
    {
      geometry: new BoxGeometry(0.18, 0.18, 1.96),
      translation: [2.65, 0.4, 0],
    },
    // Rear wrap-around chrome bumper
    {
      geometry: new BoxGeometry(0.18, 0.18, 1.96),
      translation: [-2.65, 0.4, 0],
    },
    // Left fin chrome crest
    {
      geometry: new BoxGeometry(1.5, 0.04, 0.08),
      translation: [-1.8, 1.14, 0.88],
    },
    // Right fin chrome crest
    {
      geometry: new BoxGeometry(1.5, 0.04, 0.08),
      translation: [-1.8, 1.14, -0.88],
    },
  ];

  // 4. Wheels: 4 wide cruiser wheels with chrome hubcaps
  const wheelGeom = new CylinderGeometry(0.35, 0.35, 0.24, 12);
  const wheelsParts: GeometryPart[] = [
    { geometry: wheelGeom, translation: [1.55, 0.35, 0.92], rotation: [Math.PI / 2, 0, 0] },
    { geometry: wheelGeom, translation: [1.55, 0.35, -0.92], rotation: [Math.PI / 2, 0, 0] },
    { geometry: wheelGeom, translation: [-1.55, 0.35, 0.92], rotation: [Math.PI / 2, 0, 0] },
    { geometry: wheelGeom, translation: [-1.55, 0.35, -0.92], rotation: [Math.PI / 2, 0, 0] },
  ];

  // 5. Headlights: Dual round chrome bezels on left and right
  const headGeom = new CylinderGeometry(0.11, 0.11, 0.08, 10);
  const headlightsParts: GeometryPart[] = [
    { geometry: headGeom, translation: [2.63, 0.65, 0.65], rotation: [0, 0, Math.PI / 2] },
    { geometry: headGeom, translation: [2.63, 0.65, 0.82], rotation: [0, 0, Math.PI / 2] },
    { geometry: headGeom, translation: [2.63, 0.65, -0.65], rotation: [0, 0, Math.PI / 2] },
    { geometry: headGeom, translation: [2.63, 0.65, -0.82], rotation: [0, 0, Math.PI / 2] },
  ];

  // 6. Taillights: Pointed bullet red lenses in tailfin trailing edge
  const tailGeom = new CylinderGeometry(0.09, 0.09, 0.1, 8);
  const taillightsParts: GeometryPart[] = [
    { geometry: tailGeom, translation: [-2.62, 0.98, 0.88], rotation: [0, 0, Math.PI / 2] },
    { geometry: tailGeom, translation: [-2.62, 0.98, -0.88], rotation: [0, 0, Math.PI / 2] },
  ];

  return {
    body: mergeParts(bodyParts),
    glass: mergeParts(glassParts),
    trim: mergeParts(trimParts),
    wheels: mergeParts(wheelsParts),
    headlights: mergeParts(headlightsParts),
    taillights: mergeParts(taillightsParts),
  };
}

/**
 * 1985 Angular Box Sedan / Hatch / Wagon:
 * - Crisp geometric rectangular panels
 * - Black plastic bumpers and side protection moldings
 * - Flush rectangular sealed-beam headlights
 * - Full-width horizontal rectangular segmented taillight bar
 */
export function createAngularBoxGeometries(): VehicleTypeGeometries {
  // 1. Painted Body
  const bodyParts: GeometryPart[] = [
    // Sharp lower box
    {
      geometry: new BoxGeometry(4.5, 0.55, 1.76),
      translation: [0, 0.58, 0],
    },
    // Wedge engine hood
    {
      geometry: new BoxGeometry(1.5, 0.35, 1.65),
      translation: [1.2, 0.78, 0],
      rotation: [0, 0, -0.06],
    },
    // Rectangular greenhouse cabin
    {
      geometry: new BoxGeometry(2.1, 0.65, 1.52),
      translation: [-0.3, 1.15, 0],
    },
    // Square rear trunk / hatch
    {
      geometry: new BoxGeometry(0.8, 0.38, 1.65),
      translation: [-1.7, 0.76, 0],
    },
  ];

  // 2. Glass: Flat angular windows
  const glassParts: GeometryPart[] = [
    // Sloped flat front windshield
    {
      geometry: new BoxGeometry(0.06, 0.55, 1.44),
      translation: [0.76, 1.16, 0],
      rotation: [0, 0, -0.45],
    },
    // Steep rectangular rear window
    {
      geometry: new BoxGeometry(0.06, 0.52, 1.44),
      translation: [-1.36, 1.14, 0],
      rotation: [0, 0, 0.4],
    },
    // Side windows
    {
      geometry: new BoxGeometry(1.9, 0.44, 0.05),
      translation: [-0.3, 1.16, 0.77],
    },
    {
      geometry: new BoxGeometry(1.9, 0.44, 0.05),
      translation: [-0.3, 1.16, -0.77],
    },
  ];

  // 3. Trim: Black urethane bumpers, side rub-strips, black pillar frame
  const trimParts: GeometryPart[] = [
    // Front black plastic bumper
    {
      geometry: new BoxGeometry(0.2, 0.22, 1.82),
      translation: [2.32, 0.44, 0],
    },
    // Rear black plastic bumper
    {
      geometry: new BoxGeometry(0.2, 0.22, 1.82),
      translation: [-2.32, 0.44, 0],
    },
    // Left side protective rub-strip
    {
      geometry: new BoxGeometry(3.6, 0.08, 0.06),
      translation: [0, 0.56, 0.89],
    },
    // Right side protective rub-strip
    {
      geometry: new BoxGeometry(3.6, 0.08, 0.06),
      translation: [0, 0.56, -0.89],
    },
    // Black front grille
    {
      geometry: new BoxGeometry(0.06, 0.22, 0.8),
      translation: [2.28, 0.68, 0],
    },
  ];

  // 4. Wheels: 4 angular turbine alloy wheels
  const wheelGeom = new CylinderGeometry(0.33, 0.33, 0.22, 12);
  const wheelsParts: GeometryPart[] = [
    { geometry: wheelGeom, translation: [1.35, 0.33, 0.86], rotation: [Math.PI / 2, 0, 0] },
    { geometry: wheelGeom, translation: [1.35, 0.33, -0.86], rotation: [Math.PI / 2, 0, 0] },
    { geometry: wheelGeom, translation: [-1.35, 0.33, 0.86], rotation: [Math.PI / 2, 0, 0] },
    { geometry: wheelGeom, translation: [-1.35, 0.33, -0.86], rotation: [Math.PI / 2, 0, 0] },
  ];

  // 5. Headlights: Rectangular flush sealed-beam headlights
  const headGeom = new BoxGeometry(0.08, 0.18, 0.42);
  const headlightsParts: GeometryPart[] = [
    { geometry: headGeom, translation: [2.28, 0.68, 0.62] },
    { geometry: headGeom, translation: [2.28, 0.68, -0.62] },
  ];

  // 6. Taillights: Wide rectangular red/amber taillight bar
  const tailGeom = new BoxGeometry(0.08, 0.18, 0.72);
  const taillightsParts: GeometryPart[] = [
    { geometry: tailGeom, translation: [-2.28, 0.7, 0.48] },
    { geometry: tailGeom, translation: [-2.28, 0.7, -0.48] },
  ];

  return {
    body: mergeParts(bodyParts),
    glass: mergeParts(glassParts),
    trim: mergeParts(trimParts),
    wheels: mergeParts(wheelsParts),
    headlights: mergeParts(headlightsParts),
    taillights: mergeParts(taillightsParts),
  };
}

/**
 * 2005 Aerodynamic Curved Sedan & SUV:
 * - Rounded teardrop jellybean curvature
 * - Smooth integrated bumper fascias
 * - Swept-back clear polycarbonate headlights
 * - Triangular/trapezoidal modern red taillight clusters
 */
export function createCurvedSedanGeometries(): VehicleTypeGeometries {
  // 1. Painted Body
  const bodyParts: GeometryPart[] = [
    // Aerodynamic rounded lower chassis
    {
      geometry: new BoxGeometry(4.55, 0.58, 1.82),
      translation: [0, 0.58, 0],
    },
    // Sloped curved front nose
    {
      geometry: new BoxGeometry(1.3, 0.38, 1.72),
      translation: [1.3, 0.74, 0],
      rotation: [0, 0, -0.15],
    },
    // Teardrop curved greenhouse
    {
      geometry: new BoxGeometry(2.3, 0.68, 1.56),
      translation: [-0.15, 1.18, 0],
    },
    // Curved aerodynamic trunk
    {
      geometry: new BoxGeometry(1.0, 0.35, 1.7),
      translation: [-1.6, 0.75, 0],
      rotation: [0, 0, 0.12],
    },
  ];

  // 2. Glass: Curved tinted aerodynamic greenhouse
  const glassParts: GeometryPart[] = [
    // Swept front windshield
    {
      geometry: new BoxGeometry(0.06, 0.62, 1.48),
      translation: [0.95, 1.18, 0],
      rotation: [0, 0, -0.55],
    },
    // Swept rear rear glass
    {
      geometry: new BoxGeometry(0.06, 0.58, 1.46),
      translation: [-1.25, 1.16, 0],
      rotation: [0, 0, 0.5],
    },
    // Side windows
    {
      geometry: new BoxGeometry(2.1, 0.46, 0.05),
      translation: [-0.15, 1.18, 0.79],
    },
    {
      geometry: new BoxGeometry(2.1, 0.46, 0.05),
      translation: [-0.15, 1.18, -0.79],
    },
  ];

  // 3. Trim: Subdued lower aero valance and side mirrors
  const trimParts: GeometryPart[] = [
    // Lower front air dam / grille
    {
      geometry: new BoxGeometry(0.12, 0.18, 1.1),
      translation: [2.28, 0.38, 0],
    },
    // Left side mirror
    {
      geometry: new BoxGeometry(0.15, 0.1, 0.18),
      translation: [0.85, 0.95, 0.92],
    },
    // Right side mirror
    {
      geometry: new BoxGeometry(0.15, 0.1, 0.18),
      translation: [0.85, 0.95, -0.92],
    },
    // Rear lower diffuser lip
    {
      geometry: new BoxGeometry(0.12, 0.14, 1.4),
      translation: [-2.28, 0.36, 0],
    },
  ];

  // 4. Wheels: 4 modern 5-spoke alloy wheels
  const wheelGeom = new CylinderGeometry(0.34, 0.34, 0.22, 14);
  const wheelsParts: GeometryPart[] = [
    { geometry: wheelGeom, translation: [1.4, 0.34, 0.89], rotation: [Math.PI / 2, 0, 0] },
    { geometry: wheelGeom, translation: [1.4, 0.34, -0.89], rotation: [Math.PI / 2, 0, 0] },
    { geometry: wheelGeom, translation: [-1.4, 0.34, 0.89], rotation: [Math.PI / 2, 0, 0] },
    { geometry: wheelGeom, translation: [-1.4, 0.34, -0.89], rotation: [Math.PI / 2, 0, 0] },
  ];

  // 5. Headlights: Swept aerodynamic polycarbonate pods
  const headGeom = new BoxGeometry(0.2, 0.16, 0.44);
  const headlightsParts: GeometryPart[] = [
    { geometry: headGeom, translation: [2.22, 0.65, 0.64], rotation: [0, 0.2, -0.1] },
    { geometry: headGeom, translation: [2.22, 0.65, -0.64], rotation: [0, -0.2, -0.1] },
  ];

  // 6. Taillights: Swept triangular / trapezoidal modern red clusters
  const tailGeom = new BoxGeometry(0.16, 0.2, 0.38);
  const taillightsParts: GeometryPart[] = [
    { geometry: tailGeom, translation: [-2.24, 0.68, 0.68], rotation: [0, -0.15, 0.1] },
    { geometry: tailGeom, translation: [-2.24, 0.68, -0.68], rotation: [0, 0.15, 0.1] },
  ];

  return {
    body: mergeParts(bodyParts),
    glass: mergeParts(glassParts),
    trim: mergeParts(trimParts),
    wheels: mergeParts(wheelsParts),
    headlights: mergeParts(headlightsParts),
    taillights: mergeParts(taillightsParts),
  };
}

/**
 * 2025 Autonomous Cyber EV Crossover & Micro-Pod:
 * - Minimalist cyber fastback monovolume silhouette
 * - Full continuous panoramic glass canopy
 * - Ultra-thin continuous horizontal front LED light bar
 * - Ultra-thin continuous horizontal rear laser neon blade light bar
 * - Flush aero-disc cyber wheels
 */
export function createSleekEVGeometries(): VehicleTypeGeometries {
  // 1. Painted Body
  const bodyParts: GeometryPart[] = [
    // Flush cyber aerodynamic underbody
    {
      geometry: new BoxGeometry(4.8, 0.62, 1.94),
      translation: [0, 0.58, 0],
    },
    // Cyber fastback greenhouse arch
    {
      geometry: new BoxGeometry(3.0, 0.65, 1.62),
      translation: [-0.2, 1.15, 0],
    },
    // Integrated rear aero spoiler wing
    {
      geometry: new BoxGeometry(0.45, 0.08, 1.8),
      translation: [-2.2, 0.95, 0],
    },
  ];

  // 2. Glass: Full continuous panoramic dark solar glass canopy
  const glassParts: GeometryPart[] = [
    // Continuous front-to-roof canopy
    {
      geometry: new BoxGeometry(3.2, 0.06, 1.48),
      translation: [-0.1, 1.48, 0],
    },
    // Front windshield rake
    {
      geometry: new BoxGeometry(0.06, 0.72, 1.5),
      translation: [1.25, 1.12, 0],
      rotation: [0, 0, -0.68],
    },
    // Rear cyber fastback glass
    {
      geometry: new BoxGeometry(0.06, 0.78, 1.46),
      translation: [-1.45, 1.12, 0],
      rotation: [0, 0, 0.62],
    },
    // Side flush windows
    {
      geometry: new BoxGeometry(2.8, 0.48, 0.05),
      translation: [-0.2, 1.16, 0.82],
    },
    {
      geometry: new BoxGeometry(2.8, 0.48, 0.05),
      translation: [-0.2, 1.16, -0.82],
    },
  ];

  // 3. Trim: Gloss black cyber splitters, flush handles, aero diffusers
  const trimParts: GeometryPart[] = [
    // Front cyber chin splitter
    {
      geometry: new BoxGeometry(0.18, 0.1, 1.88),
      translation: [2.38, 0.32, 0],
    },
    // Rear cyber aero diffuser
    {
      geometry: new BoxGeometry(0.24, 0.12, 1.88),
      translation: [-2.36, 0.34, 0],
    },
    // Side cyber skirts
    {
      geometry: new BoxGeometry(3.6, 0.08, 0.08),
      translation: [0, 0.32, 0.96],
    },
    {
      geometry: new BoxGeometry(3.6, 0.08, 0.08),
      translation: [0, 0.32, -0.96],
    },
  ];

  // 4. Wheels: 4 flush aero-disc cyber wheels
  const wheelGeom = new CylinderGeometry(0.36, 0.36, 0.24, 16);
  const wheelsParts: GeometryPart[] = [
    { geometry: wheelGeom, translation: [1.45, 0.36, 0.94], rotation: [Math.PI / 2, 0, 0] },
    { geometry: wheelGeom, translation: [1.45, 0.36, -0.94], rotation: [Math.PI / 2, 0, 0] },
    { geometry: wheelGeom, translation: [-1.45, 0.36, 0.94], rotation: [Math.PI / 2, 0, 0] },
    { geometry: wheelGeom, translation: [-1.45, 0.36, -0.94], rotation: [Math.PI / 2, 0, 0] },
  ];

  // 5. Headlights: Ultra-thin continuous horizontal front LED light-bar
  const headGeom = new BoxGeometry(0.08, 0.08, 1.76);
  const headlightsParts: GeometryPart[] = [
    { geometry: headGeom, translation: [2.41, 0.68, 0] },
  ];

  // 6. Taillights: Ultra-thin continuous horizontal rear neon laser LED blade
  const tailGeom = new BoxGeometry(0.08, 0.08, 1.76);
  const taillightsParts: GeometryPart[] = [
    { geometry: tailGeom, translation: [-2.41, 0.72, 0] },
  ];

  return {
    body: mergeParts(bodyParts),
    glass: mergeParts(glassParts),
    trim: mergeParts(trimParts),
    wheels: mergeParts(wheelsParts),
    headlights: mergeParts(headlightsParts),
    taillights: mergeParts(taillightsParts),
  };
}

/**
 * Returns the procedural geometries for a given VehicleBodyType.
 */
export function createGeometriesForBodyType(type: VehicleBodyType): VehicleTypeGeometries {
  switch (type) {
    case 'vintage_fender_sedan':
      return createVintageSedanGeometries();
    case 'midcentury_finned_cruiser':
      return createMidcenturyCruiserGeometries();
    case 'angular_eighties_box':
      return createAngularBoxGeometries();
    case 'curved_two_thousands_sedan':
      return createCurvedSedanGeometries();
    case 'sleek_ev_crossover':
    default:
      return createSleekEVGeometries();
  }
}

/* ------------------------------------------------------------------ */
/* Instanced Vehicle Mesh Family Manager                               */
/* ------------------------------------------------------------------ */

export interface VehicleInstanceFamily {
  readonly eraId: EraId;
  readonly bodyType: VehicleBodyType;
  readonly group: Group;
  readonly capacity: number;
  setInstance(index: number, matrix: Matrix4, colorHex: string | number): void;
  hideInstance(index: number): void;
  updateLightStyles(spec: VehiclesEraSpec): void;
  commit(): void;
  dispose(): void;
}

/**
 * Creates an instanced mesh family for a given era and body type.
 * Automatically configures bloom-friendly emissive lighting and paint materials.
 */
export function createVehicleInstanceFamily(
  eraId: EraId,
  bodyType: VehicleBodyType,
  spec: VehiclesEraSpec,
  capacity = 32,
): VehicleInstanceFamily {
  const geoms = createGeometriesForBodyType(bodyType);
  const materials: Material[] = [];

  // Materials
  const bodyMaterial = new MeshStandardMaterial({
    roughness: 0.35,
    metalness: 0.25,
  });
  materials.push(bodyMaterial);

  const glassMaterial = new MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.1,
    metalness: 0.9,
    transparent: true,
    opacity: 0.85,
  });
  materials.push(glassMaterial);

  const trimMaterial = new MeshStandardMaterial({
    color: eraId === '1945' || eraId === '1965' ? 0xe2e8f0 : 0x1c1917,
    roughness: eraId === '1945' || eraId === '1965' ? 0.15 : 0.8,
    metalness: eraId === '1945' || eraId === '1965' ? 0.9 : 0.1,
  });
  materials.push(trimMaterial);

  const wheelsMaterial = new MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.85,
    metalness: 0.15,
  });
  materials.push(wheelsMaterial);

  const headlightsMaterial = new MeshStandardMaterial({
    color: 0xffffff,
    emissive: new Color(spec.headlightColor),
    emissiveIntensity: spec.headlightIntensity * 2.2,
    roughness: 0.1,
  });
  materials.push(headlightsMaterial);

  const taillightsMaterial = new MeshStandardMaterial({
    color: 0x880000,
    emissive: new Color(spec.taillightColor),
    emissiveIntensity: 2.0,
    roughness: 0.1,
  });
  materials.push(taillightsMaterial);

  // Instanced Meshes
  const bodyMesh = new InstancedMesh(geoms.body, bodyMaterial, capacity);
  const glassMesh = new InstancedMesh(geoms.glass, glassMaterial, capacity);
  const trimMesh = new InstancedMesh(geoms.trim, trimMaterial, capacity);
  const wheelsMesh = new InstancedMesh(geoms.wheels, wheelsMaterial, capacity);
  const headlightsMesh = new InstancedMesh(geoms.headlights, headlightsMaterial, capacity);
  const taillightsMesh = new InstancedMesh(geoms.taillights, taillightsMaterial, capacity);

  bodyMesh.name = `vehicles-${eraId}-body`;
  glassMesh.name = `vehicles-${eraId}-glass`;
  trimMesh.name = `vehicles-${eraId}-trim`;
  wheelsMesh.name = `vehicles-${eraId}-wheels`;
  headlightsMesh.name = `vehicles-${eraId}-headlights`;
  taillightsMesh.name = `vehicles-${eraId}-taillights`;

  const group = new Group();
  group.name = `vehicle-family-${eraId}-${bodyType}`;
  group.add(bodyMesh, glassMesh, trimMesh, wheelsMesh, headlightsMesh, taillightsMesh);

  // Initialize all instances offscreen
  const hiddenMatrix = new Matrix4().makeScale(0, 0, 0);
  const tempColor = new Color(0xffffff);

  for (let i = 0; i < capacity; i += 1) {
    bodyMesh.setMatrixAt(i, hiddenMatrix);
    glassMesh.setMatrixAt(i, hiddenMatrix);
    trimMesh.setMatrixAt(i, hiddenMatrix);
    wheelsMesh.setMatrixAt(i, hiddenMatrix);
    headlightsMesh.setMatrixAt(i, hiddenMatrix);
    taillightsMesh.setMatrixAt(i, hiddenMatrix);

    bodyMesh.setColorAt(i, tempColor);
  }

  bodyMesh.instanceMatrix.needsUpdate = true;
  glassMesh.instanceMatrix.needsUpdate = true;
  trimMesh.instanceMatrix.needsUpdate = true;
  wheelsMesh.instanceMatrix.needsUpdate = true;
  headlightsMesh.instanceMatrix.needsUpdate = true;
  taillightsMesh.instanceMatrix.needsUpdate = true;
  if (bodyMesh.instanceColor) bodyMesh.instanceColor.needsUpdate = true;

  return {
    eraId,
    bodyType,
    group,
    capacity,

    setInstance(index: number, matrix: Matrix4, colorHex: string | number): void {
      if (index < 0 || index >= capacity) return;
      bodyMesh.setMatrixAt(index, matrix);
      glassMesh.setMatrixAt(index, matrix);
      trimMesh.setMatrixAt(index, matrix);
      wheelsMesh.setMatrixAt(index, matrix);
      headlightsMesh.setMatrixAt(index, matrix);
      taillightsMesh.setMatrixAt(index, matrix);

      tempColor.set(colorHex);
      bodyMesh.setColorAt(index, tempColor);
    },

    hideInstance(index: number): void {
      if (index < 0 || index >= capacity) return;
      bodyMesh.setMatrixAt(index, hiddenMatrix);
      glassMesh.setMatrixAt(index, hiddenMatrix);
      trimMesh.setMatrixAt(index, hiddenMatrix);
      wheelsMesh.setMatrixAt(index, hiddenMatrix);
      headlightsMesh.setMatrixAt(index, hiddenMatrix);
      taillightsMesh.setMatrixAt(index, hiddenMatrix);
    },

    updateLightStyles(eraSpec: VehiclesEraSpec): void {
      headlightsMaterial.emissive.set(eraSpec.headlightColor);
      headlightsMaterial.emissiveIntensity = eraSpec.headlightIntensity * 2.2;
      taillightsMaterial.emissive.set(eraSpec.taillightColor);
      taillightsMaterial.emissiveIntensity = 2.0;
    },

    commit(): void {
      bodyMesh.instanceMatrix.needsUpdate = true;
      glassMesh.instanceMatrix.needsUpdate = true;
      trimMesh.instanceMatrix.needsUpdate = true;
      wheelsMesh.instanceMatrix.needsUpdate = true;
      headlightsMesh.instanceMatrix.needsUpdate = true;
      taillightsMesh.instanceMatrix.needsUpdate = true;
      if (bodyMesh.instanceColor) bodyMesh.instanceColor.needsUpdate = true;
    },

    dispose(): void {
      geoms.body.dispose();
      geoms.glass.dispose();
      geoms.trim.dispose();
      geoms.wheels.dispose();
      geoms.headlights.dispose();
      geoms.taillights.dispose();

      for (const mat of materials) {
        mat.dispose();
      }

      if (group.parent) {
        group.parent.remove(group);
      }
    },
  };
}
