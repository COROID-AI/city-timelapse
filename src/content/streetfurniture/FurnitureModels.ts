/**
 * src/content/streetfurniture/FurnitureModels.ts - procedural street furniture.
 *
 * Every lamp, traffic light, bench, hydrant, bin, bus stop, payphone,
 * newsstand, tree and planter is assembled from primitive BufferGeometry
 * (boxes, cylinders, spheres) and merged per material channel. No external
 * models or textures - all geometry procedural, all colours come from the
 * declarative StreetFurnitureSpec in src/eras.ts.
 *
 * Model families evolve with the eras:
 *   lamps     gaslight (1945) -> sodium mast (1965) -> cobra head (1985) ->
 *             LED shoebox (2005) -> smart pole (2025)
 *   payphones 1945-1985 only (absent from the 2005/2025 specs)
 *   trees     formal elm -> round maple -> London plane -> compact modern ->
 *             smart green; planters appear from 1985 onward
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import type { StreetFurnitureModelId } from '../../eras';

/** Main colour channels for one furniture rig. */
export interface FurniturePalette {
  color: string;
  accentColor: string;
}

/** Merged geometry channels for one furniture rig. */
export interface FurnitureGeometrySet {
  main: THREE.BufferGeometry;
  accent: THREE.BufferGeometry;
  /** Optional lettered fascia (empty geometry when a model has none). */
  panel: THREE.BufferGeometry;
}

type GeomList = THREE.BufferGeometry[];

/** Box part at local offset. */
function bx(w: number, h: number, d: number, x = 0, y = 0, z = 0): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}

/** Cylinder part aligned with Y. */
function cy(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  x = 0,
  y = 0,
  z = 0,
  radialSegments = 10,
): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments).translate(
    x,
    y,
    z,
  );
}

/** Sphere part at local offset. */
function sp(radius: number, x = 0, y = 0, z = 0): THREE.BufferGeometry {
  return new THREE.SphereGeometry(radius, 10, 8).translate(x, y, z);
}

/** Merge a channel list; falls back to an empty geometry. */
function merge(list: GeomList): THREE.BufferGeometry {
  const nonEmpty = list.filter((g) => (g.attributes.position?.count ?? 0) > 0);
  if (nonEmpty.length === 0) {
    for (const g of list) {
      g.dispose();
    }
    return new THREE.BufferGeometry();
  }
  const merged = mergeGeometries(nonEmpty, false);
  for (const g of list) {
    g.dispose();
  }
  return merged ?? new THREE.BufferGeometry();
}

/** Empty geometry channel (used when a model has no lettered panel). */
export function emptyGeometry(): THREE.BufferGeometry {
  return new THREE.BufferGeometry();
}

/** Main merged channels usually lack a panel; helper returns that triple. */
function channels(main: GeomList, accent: GeomList): FurnitureGeometrySet {
  return { main: merge(main), accent: merge(accent), panel: emptyGeometry() };
}

// ---------------------------------------------------------------------------
// Piece builders - each returns the three merged channels for a model id.
// ---------------------------------------------------------------------------

function buildLamp(id: StreetFurnitureModelId): FurnitureGeometrySet {
  const main: GeomList = [];
  const accent: GeomList = [];
  switch (id) {
    case 'lamppost-gas-1945': {
      main.push(bx(0.34, 0.5, 0.34, 0, 0.25, 0));
      main.push(cy(0.09, 0.12, 3.4, 0, 2.3, 0));
      main.push(cy(0.05, 0.05, 0.8, 0.2, 4.35, 0));
      accent.push(sp(0.16, 0.2, 4.85, 0));
      accent.push(cy(0.08, 0.08, 0.12, 0.2, 4.72, 0));
      break;
    }
    case 'lamppost-sodium-1965': {
      main.push(cy(0.07, 0.1, 4.4, 0, 2.2, 0));
      main.push(cy(0.16, 0.16, 0.28, 0, 4.42, 0));
      accent.push(bx(0.3, 0.16, 0.5, 0, 4.6, 0));
      break;
    }
    case 'lamppost-cobra-1985': {
      main.push(cy(0.06, 0.1, 4.6, 0, 2.3, 0));
      accent.push(cy(0.05, 0.05, 1.0, 0.35, 4.62, 0.08));
      accent.push(bx(0.2, 0.14, 0.62, 0.75, 4.9, 0.14));
      accent.push(bx(0.32, 0.12, 0.2, 0.75, 4.96, 0.14));
      break;
    }
    case 'lamppost-led-2005': {
      main.push(cy(0.045, 0.07, 4.6, 0, 2.3, 0));
      main.push(bx(0.3, 0.18, 0.1, 0, 4.9, 0));
      accent.push(bx(0.24, 0.1, 0.08, 0, 5.0, 0));
      break;
    }
    case 'lamppost-smart-2025': {
      main.push(cy(0.05, 0.09, 4.8, 0, 2.4, 0));
      main.push(bx(0.22, 0.26, 0.22, 0, 5.05, 0));
      accent.push(bx(0.3, 0.08, 0.12, 0, 5.28, 0));
      accent.push(sp(0.07, 0.24, 5.5, 0));
      break;
    }
    default:
      break;
  }
  return channels(main, accent);
}

function buildTrafficLight(id: StreetFurnitureModelId): FurnitureGeometrySet {
  const main: GeomList = [];
  const accent: GeomList = [];
  if (id === 'traffic-light-1945') {
    main.push(cy(0.05, 0.07, 4.3, 0, 2.15, 0));
    main.push(bx(0.42, 1.15, 0.3, 0, 4.78, 0));
    accent.push(sp(0.07, 0, 4.3, 0.2));
  } else if (id === 'traffic-light-1965') {
    main.push(cy(0.05, 0.08, 4.4, 0, 2.2, 0));
    main.push(bx(0.34, 0.9, 0.28, 0, 4.68, 0));
    accent.push(sp(0.06, 0, 4.4, 0.18));
  } else if (id === 'traffic-light-1985') {
    main.push(cy(0.05, 0.08, 4.5, 0, 2.25, 0));
    main.push(bx(0.3, 1.0, 0.26, 0, 4.8, 0));
    accent.push(sp(0.06, 0, 4.5, 0.16));
  } else if (id === 'traffic-light-2005' || id === 'traffic-light-2025') {
    main.push(cy(0.05, 0.08, 4.6, 0, 2.3, 0));
    main.push(bx(0.28, 1.0, 0.24, 0, 4.85, 0));
    accent.push(bx(0.18, 0.16, 0.06, 0, 5.15, 0));
  }
  return channels(main, accent);
}

function buildBench(id: StreetFurnitureModelId): FurnitureGeometrySet {
  const main: GeomList = [];
  const accent: GeomList = [];
  switch (id) {
    case 'bench-wood-1945': {
      main.push(bx(0.08, 0.08, 1.5, -0.72, 0.42, 0));
      main.push(bx(0.08, 0.08, 1.5, 0.72, 0.42, 0));
      main.push(bx(1.6, 0.06, 0.28, 0, 0.78, 0));
      main.push(bx(1.6, 0.4, 0.06, 0, 0.42, -0.7));
      accent.push(bx(1.6, 0.06, 0.16, 0, 0.92, 0.1));
      break;
    }
    case 'bench-midcentury-1965': {
      main.push(bx(1.5, 0.06, 0.32, 0, 0.46, 0));
      main.push(bx(1.5, 0.05, 0.24, 0, 0.34, 0));
      accent.push(bx(0.06, 0.34, 1.2, -0.66, 0.2, 0));
      accent.push(bx(0.06, 0.34, 1.2, 0.66, 0.2, 0));
      break;
    }
    case 'bench-metal-1985': {
      main.push(bx(0.1, 0.1, 1.3, -0.62, 0.4, 0));
      main.push(bx(0.1, 0.1, 1.3, 0.62, 0.4, 0));
      main.push(bx(1.42, 0.07, 0.3, 0, 0.5, 0));
      accent.push(bx(1.42, 0.07, 0.22, 0, 0.36, 0.05));
      break;
    }
    case 'bench-modern-2005': {
      main.push(bx(1.5, 0.06, 0.4, 0, 0.48, 0));
      main.push(bx(0.5, 0.04, 0.4, -0.45, 0.31, 0));
      main.push(bx(0.5, 0.04, 0.4, 0.45, 0.31, 0));
      accent.push(bx(0.6, 0.3, 0.1, -0.42, 0.22, 0));
      accent.push(bx(0.6, 0.3, 0.1, 0.42, 0.22, 0));
      break;
    }
    case 'bench-smart-2025': {
      main.push(bx(1.6, 0.06, 0.36, 0, 0.52, 0));
      main.push(bx(0.34, 0.42, 0.3, 0, 0.24, 0));
      accent.push(bx(0.3, 0.08, 0.16, 0, 0.5, 0.12));
      accent.push(bx(0.12, 0.3, 0.12, -0.62, 0.22, 0));
      accent.push(bx(0.12, 0.3, 0.12, 0.62, 0.22, 0));
      break;
    }
    default:
      break;
  }
  return channels(main, accent);
}

function buildHydrant(id: StreetFurnitureModelId): FurnitureGeometrySet {
  const main: GeomList = [];
  const accent: GeomList = [];
  if (id === 'hydrant-1945' || id === 'hydrant-1965') {
    // Classic round-top fire hydrant.
    main.push(cy(0.11, 0.13, 0.5, 0, 0.28, 0));
    main.push(sp(0.13, 0, 0.62, 0));
    accent.push(cy(0.05, 0.05, 0.3, 0.16, 0.42, 0));
    accent.push(cy(0.05, 0.05, 0.3, -0.16, 0.42, 0));
  } else if (id === 'hydrant-1985' || id === 'hydrant-2005') {
    // Taller modern barrel with side outlet bosses.
    main.push(cy(0.12, 0.15, 0.62, 0, 0.34, 0));
    main.push(cy(0.14, 0.14, 0.1, 0, 0.66, 0));
    accent.push(cy(0.06, 0.06, 0.16, 0.2, 0.5, 0));
    accent.push(cy(0.06, 0.06, 0.16, -0.2, 0.5, 0));
  } else {
    // 2025 slim utility hydrant with reflective band.
    main.push(cy(0.1, 0.14, 0.68, 0, 0.36, 0));
    main.push(cy(0.12, 0.12, 0.08, 0, 0.7, 0));
    accent.push(bx(0.34, 0.05, 0.34, 0, 0.5, 0));
  }
  return channels(main, accent);
}

function buildBin(id: StreetFurnitureModelId): FurnitureGeometrySet {
  const main: GeomList = [];
  const accent: GeomList = [];
  switch (id) {
    case 'bin-cast-1945': {
      main.push(cy(0.22, 0.2, 0.5, 0, 0.26, 0, 12));
      main.push(cy(0.24, 0.24, 0.06, 0, 0.02, 0, 12));
      break;
    }
    case 'bin-wire-1965': {
      main.push(cy(0.24, 0.22, 0.46, 0, 0.24, 0, 12));
      main.push(cy(0.27, 0.27, 0.05, 0, 0.48, 0, 12));
      break;
    }
    case 'bin-metal-1985': {
      main.push(cy(0.2, 0.2, 0.55, 0, 0.28, 0));
      accent.push(bx(0.4, 0.08, 0.02, 0, 0.36, 0.16));
      break;
    }
    case 'bin-plastic-2005': {
      main.push(cy(0.2, 0.18, 0.6, 0, 0.31, 0));
      accent.push(bx(0.02, 0.3, 0.3, 0.18, 0.36, 0));
      break;
    }
    case 'bin-split-2025': {
      main.push(bx(0.46, 0.55, 0.3, 0, 0.28, 0));
      main.push(bx(0.48, 0.06, 0.32, 0, 0.55, 0));
      accent.push(bx(0.2, 0.4, 0.28, -0.12, 0.28, 0.04));
      break;
    }
    default:
      break;
  }
  return channels(main, accent);
}

function buildBusStop(id: StreetFurnitureModelId): FurnitureGeometrySet {
  const main: GeomList = [];
  const accent: GeomList = [];
  if (id === 'busstop-1945') {
    // Enamel "BUS STOP" pole and flag.
    main.push(cy(0.06, 0.08, 2.5, 0, 1.25, 0));
    accent.push(bx(0.1, 0.5, 0.04, 0, 2.6, 0));
  } else if (id === 'busstop-1965') {
    // Framed glass shelter with flat roof.
    main.push(bx(1.9, 1.9, 0.06, 0, 0.98, 0));
    main.push(bx(0.06, 1.9, 0.5, -0.95, 0.98, 0.22));
    main.push(bx(1.9, 0.06, 0.5, 0, 1.92, 0.22));
    accent.push(bx(1.9, 0.09, 0.52, 0, 2.02, 0.22));
    main.push(bx(0.08, 0.08, 0.5, 0.9, 0.98, 0.22));
    main.push(bx(0.08, 0.08, 0.5, -0.9, 0.98, 0.22));
  } else if (id === 'busstop-1985') {
    // Sheltered bench with curved canopy.
    main.push(cy(0.05, 0.06, 2.6, 0, 1.3, 0));
    main.push(bx(1.5, 0.06, 0.4, 0, 0.44, 0.6));
    accent.push(bx(1.7, 0.05, 0.8, 0, 2.2, 0.4));
    main.push(bx(1.7, 0.06, 0.1, 0, 1.2, 0.4));
  } else if (id === 'busstop-2005' || id === 'busstop-2025') {
    // Modern glass shelter with LED-lit band.
    main.push(bx(2.1, 2.1, 0.06, 0, 1.05, 0));
    main.push(bx(0.06, 2.1, 0.6, -1.0, 1.05, 0.25));
    main.push(bx(2.1, 2.1, 0.6, 0, 1.05, 0.5));
    accent.push(bx(2.0, 0.08, 0.6, 0, 2.16, 0.25));
  }
  return channels(main, accent);
}

function buildPayphone(id: StreetFurnitureModelId): FurnitureGeometrySet {
  const main: GeomList = [];
  const accent: GeomList = [];
  if (id === 'payphone-1945' || id === 'payphone-1965') {
    main.push(cy(0.09, 0.1, 2.6, 0, 1.3, 0));
    main.push(bx(0.36, 0.5, 0.22, 0, 1.58, 0.14));
    accent.push(bx(0.28, 0.3, 0.08, 0, 1.58, 0.3));
    accent.push(bx(0.12, 0.04, 0.06, 0, 1.72, 0.3));
  } else {
    // 1985 glass walk-in booth.
    main.push(bx(0.7, 2.2, 0.7, 0, 1.1, 0));
    main.push(bx(0.78, 2.26, 0.78, 0, 1.13, 0));
    accent.push(bx(0.06, 0.4, 0.5, 0, 1.9, 0.12));
    accent.push(bx(0.04, 0.08, 0.3, -0.18, 1.75, 0.22));
  }
  return channels(main, accent);
}

function buildNewsstand(id: StreetFurnitureModelId): FurnitureGeometrySet {
  const main: GeomList = [];
  const accent: GeomList = [];
  if (id === 'newsstand-1945') {
    // Wood kiosk with paper racks.
    main.push(bx(0.9, 0.9, 0.6, 0, 0.45, 0));
    main.push(bx(0.95, 0.06, 0.66, 0, 0.92, 0));
    accent.push(bx(0.8, 0.22, 0.18, 0, 0.72, 0.34));
    accent.push(bx(0.04, 0.8, 0.3, -0.45, 0.4, 0.08));
  } else if (id === 'newsstand-1965') {
    // Mid-century metal frame with display shelf and awning.
    main.push(bx(0.9, 0.72, 0.55, 0, 0.36, 0));
    main.push(bx(0.95, 0.05, 0.6, 0, 0.74, 0));
    accent.push(bx(1.0, 0.04, 0.7, 0, 0.86, 0));
    accent.push(bx(0.8, 0.18, 0.14, 0, 0.6, 0.32));
  } else if (id === 'newsstand-1985') {
    // Brick/concrete kiosk with red striped awning.
    main.push(bx(0.95, 0.85, 0.6, 0, 0.43, 0));
    main.push(bx(1.0, 0.06, 0.66, 0, 0.88, 0));
    accent.push(bx(1.05, 0.05, 0.7, 0, 1.0, 0));
    accent.push(bx(0.85, 0.2, 0.16, 0, 0.68, 0.33));
  } else if (id === 'newsstand-2005') {
    // Modern retail kiosk with side rack and head-height canopy.
    main.push(bx(0.85, 0.78, 0.5, 0, 0.39, 0));
    main.push(bx(0.9, 0.05, 0.55, 0, 0.8, 0));
    accent.push(bx(0.4, 0.26, 0.1, 0.28, 0.66, 0.24));
    accent.push(bx(0.92, 0.04, 0.58, 0, 0.92, 0));
  } else {
    // 2025 compact smart kiosk with display screen.
    main.push(bx(0.8, 0.74, 0.46, 0, 0.37, 0));
    main.push(bx(0.84, 0.05, 0.5, 0, 0.76, 0));
    accent.push(bx(0.34, 0.2, 0.05, 0, 0.68, 0.24));
    accent.push(bx(0.1, 0.5, 0.1, 0.32, 0.68, 0.16));
  }
  return channels(main, accent);
}

function buildTree(id: StreetFurnitureModelId): FurnitureGeometrySet {
  const main: GeomList = [];
  const accent: GeomList = [];
  if (id === 'tree-1945') {
    // Formal elm: high trunk, rounded crown.
    main.push(cy(0.09, 0.14, 2.2, 0, 1.1, 0));
    main.push(sp(0.9, 0, 2.9, 0));
    accent.push(sp(0.75, 0, 2.85, 0.18));
  } else if (id === 'tree-1965') {
    // Round maple with lower branching.
    main.push(cy(0.07, 0.12, 2.0, 0, 1.0, 0));
    main.push(sp(0.95, 0, 2.5, 0));
    accent.push(sp(0.75, 0, 2.45, 0.16));
  } else if (id === 'tree-1985') {
    // London plane, taller crown.
    main.push(cy(0.08, 0.13, 2.5, 0, 1.25, 0));
    main.push(sp(1.05, 0, 3.2, 0));
    accent.push(sp(0.8, 0, 3.18, 0.2));
  } else if (id === 'tree-2005') {
    // Compact modern street tree.
    main.push(cy(0.06, 0.1, 1.8, 0, 0.9, 0));
    main.push(sp(0.85, 0, 2.2, 0));
    accent.push(sp(0.65, 0, 2.16, 0.14));
  } else {
    // 2025 smart-green tree with planter ring.
    main.push(cy(0.07, 0.11, 2.1, 0, 1.05, 0));
    main.push(sp(0.95, 0, 2.6, 0));
    accent.push(bx(0.5, 0.06, 0.5, 0, 0.04, 0));
    accent.push(sp(0.7, 0, 2.56, 0.18));
  }
  return channels(main, accent);
}

function buildPlanter(id: StreetFurnitureModelId): FurnitureGeometrySet {
  const main: GeomList = [];
  const accent: GeomList = [];
  if (id === 'planter-1985') {
    main.push(bx(0.6, 0.5, 0.6, 0, 0.25, 0));
    accent.push(cy(0.22, 0.22, 0.5, 0, 0.85, 0));
  } else if (id === 'planter-2005') {
    main.push(cy(0.3, 0.24, 0.5, 0, 0.25, 0, 12));
    accent.push(sp(0.26, 0, 0.72, 0));
  } else {
    // 2025 modular planter with green cap.
    main.push(bx(0.65, 0.45, 0.65, 0, 0.23, 0));
    accent.push(cy(0.2, 0.2, 0.6, 0, 0.9, 0));
  }
  return channels(main, accent);
}

/** Build the three merged geometry channels for one furniture model id. */
export function buildFurnitureGeometry(id: StreetFurnitureModelId): FurnitureGeometrySet {
  if (id.startsWith('lamppost')) {
    return buildLamp(id);
  }
  if (id.startsWith('traffic')) {
    return buildTrafficLight(id);
  }
  if (id.startsWith('bench')) {
    return buildBench(id);
  }
  if (id.startsWith('hydrant')) {
    return buildHydrant(id);
  }
  if (id.startsWith('bin')) {
    return buildBin(id);
  }
  if (id.startsWith('busstop')) {
    return buildBusStop(id);
  }
  if (id.startsWith('payphone')) {
    return buildPayphone(id);
  }
  if (id.startsWith('newsstand')) {
    return buildNewsstand(id);
  }
  if (id.startsWith('tree')) {
    return buildTree(id);
  }
  if (id.startsWith('planter')) {
    return buildPlanter(id);
  }
  return {
    main: emptyGeometry(),
    accent: emptyGeometry(),
    panel: emptyGeometry(),
  };
}
