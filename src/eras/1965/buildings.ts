import { Object3D } from 'three';
import { CityBlockLayout } from '../../layout/cityBlockLayout';
import { ERA_1965_PALETTE } from './palette';
import { STOREFRONT_SIGNS_1965, createBox, createSignBand } from './textures';
import {
  StorefrontInstance,
  createApplianceStorefront,
  createDinerStorefront,
  createLaundromatStorefront,
  createRecordStorefront,
  createTobacconistStorefront,
} from './storefronts';

/**
 * 1965 Architecture Module:
 * 10 distinct buildings on the 10 lot anchors:
 * - Brick low-rises renovated with new metal/porcelain panel facades (aqua, coral, butter yellow)
 * - Mid-century modern glass curtain-wall infill replacing war gaps (mullions, tinted glass)
 * - Googie-style cantilevered canopy on corner diner with boomerang angles & neon
 * - Plastic illuminated sign bands above storefronts
 * - Detailed rooftops with cooling towers, air-handling units, television antennas
 */

export interface Building1965 {
  readonly lotIndex: number;
  readonly name: string;
  readonly style: 'googie_diner' | 'renovated_enamel' | 'glass_curtain_wall' | 'renovated_brick';
  readonly height: number;
  readonly root: Object3D;
  readonly storefront?: StorefrontInstance;
}

/**
 * Creates rooftop details (antenna mast, AC units, vents, elevator penthouse).
 */
function createRooftopDetails(w: number, d: number, roofY: number): Object3D {
  const root = new Object3D();

  // Elevator penthouse
  const penthouse = createBox(w * 0.35, 2.2, d * 0.3, 0x4a4e69, 0, roofY + 1.1, 0);
  root.add(penthouse);

  // Air conditioning condenser units
  const ac1 = createBox(1.6, 1.2, 1.4, 0x9a8c98, w * 0.25, roofY + 0.6, d * 0.2);
  const ac2 = createBox(1.2, 0.9, 1.2, 0x9a8c98, -w * 0.25, roofY + 0.45, -d * 0.2);
  root.add(ac1, ac2);

  // TV / Radio antenna mast (tall slender mast)
  const mast = createBox(0.08, 4.0, 0.08, ERA_1965_PALETTE.architecture.chromeTrim, 0, roofY + 4.2, 0);
  const crossbar1 = createBox(1.6, 0.06, 0.06, ERA_1965_PALETTE.architecture.chromeTrim, 0, roofY + 4.8, 0);
  const crossbar2 = createBox(1.2, 0.06, 0.06, ERA_1965_PALETTE.architecture.chromeTrim, 0, roofY + 5.5, 0);
  root.add(mast, crossbar1, crossbar2);

  // Parapet wall around roof perimeter
  const parapetFront = createBox(w, 0.6, 0.2, 0x333333, 0, roofY + 0.3, d / 2 - 0.1);
  const parapetBack = createBox(w, 0.6, 0.2, 0x333333, 0, roofY + 0.3, -d / 2 + 0.1);
  const parapetLeft = createBox(0.2, 0.6, d, 0x333333, -w / 2 + 0.1, roofY + 0.3, 0);
  const parapetRight = createBox(0.2, 0.6, d, 0x333333, w / 2 - 0.1, roofY + 0.3, 0);
  root.add(parapetFront, parapetBack, parapetLeft, parapetRight);

  return root;
}

/**
 * Creates windows with mid-century modern proportions, aluminum mullions, and horizontal sun visors.
 */
function createMidCenturyWindowGrid(
  w: number,
  h: number,
  stories: number,
  cols: number,
  startY: number,
  wallZ: number,
): Object3D {
  const root = new Object3D();
  const storyHeight = h / stories;
  const colWidth = w / cols;

  for (let s = 0; s < stories; s++) {
    const y = startY + s * storyHeight + storyHeight * 0.5;
    // Horizontal aluminum spandrel / sun visor band
    const visor = createBox(
      w * 0.95,
      0.15,
      0.4,
      ERA_1965_PALETTE.architecture.chromeTrim,
      0,
      y + storyHeight * 0.38,
      wallZ + 0.15,
    );
    root.add(visor);

    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + (c + 0.5) * colWidth;
      // Window glass pane
      const pane = createBox(
        colWidth * 0.75,
        storyHeight * 0.6,
        0.05,
        0x70d6ff,
        x,
        y,
        wallZ + 0.02,
      );
      // Aluminum window frame
      const frame = createBox(
        colWidth * 0.8,
        storyHeight * 0.65,
        0.04,
        0x2b2d42,
        x,
        y,
        wallZ + 0.01,
      );
      root.add(frame, pane);
    }
  }

  return root;
}

/**
 * Lot 0: Corner Googie Diner with sweeping aerodynamic cantilevered roof canopy.
 */
function createGoogieDinerBuilding(w: number, d: number): { root: Object3D; storefront: StorefrontInstance } {
  const root = new Object3D();
  const h = 7.0;

  // Main diner building body
  const body = createBox(w, h, d, ERA_1965_PALETTE.architecture.brickWarmRed, 0, h / 2, 0);
  root.add(body);

  // Exterior Porcelain Enamel lower wainscot (aqua turquoise)
  const wainscot = createBox(
    w + 0.1,
    1.2,
    d + 0.1,
    ERA_1965_PALETTE.architecture.renovatedEnamelAqua,
    0,
    0.6,
    0,
  );
  root.add(wainscot);

  // Iconic Googie cantilevered upward-sloping aerodynamic roof canopy
  // Canopy sweeps forward and upward over the sidewalk
  const canopy = createBox(
    w + 2.5,
    0.5,
    d + 3.0,
    ERA_1965_PALETTE.architecture.googieCanopyWhite,
    0,
    h + 0.6,
    1.0,
  );
  canopy.rotation.x = -0.06; // upward cant
  root.add(canopy);

  // Googie Boomerang / Arrow roof pylons and neon edge trim
  const pylon = createBox(
    0.5,
    4.2,
    0.5,
    ERA_1965_PALETTE.architecture.googieAccentOrange,
    -w / 2 + 1.0,
    h + 2.0,
    d / 2 + 1.5,
  );
  pylon.rotation.z = -0.15; // angled Googie pylon
  const pylonStar = createBox(
    1.2,
    1.2,
    0.1,
    ERA_1965_PALETTE.architecture.renovatedEnamelYellow,
    -w / 2 + 0.8,
    h + 4.0,
    d / 2 + 1.5,
  );
  root.add(pylon, pylonStar);

  // Sign band
  const signDesc = STOREFRONT_SIGNS_1965[0];
  const sign = createSignBand(w * 0.85, 1.2, signDesc);
  sign.position.set(0, 4.2, d / 2 + 0.2);
  root.add(sign);

  // Storefront interior
  const storefront = createDinerStorefront();
  storefront.root.position.set(0, 0, d / 2 - 1.8);
  root.add(storefront.root);

  return { root, storefront };
}

/**
 * Lot 1: Renovated 3-Story Low-Rise with Aqua Porcelain Enamel Facade (Record Store).
 */
function createRenovatedEnamelBuilding(
  w: number,
  d: number,
  signIndex: number,
  enamelColor: number,
  storefrontCreator: () => StorefrontInstance,
): { root: Object3D; storefront: StorefrontInstance } {
  const root = new Object3D();
  const h = 12.0;

  // Brick structure
  const body = createBox(w, h, d, ERA_1965_PALETTE.architecture.brickTerracotta, 0, h / 2, 0);
  root.add(body);

  // Modern enamel facade cladding on upper 2 stories
  const facadePanel = createBox(
    w * 0.98,
    h * 0.65,
    0.15,
    enamelColor,
    0,
    h * 0.62,
    d / 2 + 0.08,
  );
  root.add(facadePanel);

  // Modern horizontal ribbon windows
  const windows = createMidCenturyWindowGrid(w * 0.85, 6.0, 2, 4, 4.5, d / 2 + 0.12);
  root.add(windows);

  // Sign band
  const signDesc = STOREFRONT_SIGNS_1965[signIndex] || STOREFRONT_SIGNS_1965[1];
  const sign = createSignBand(w * 0.9, 1.2, signDesc);
  sign.position.set(0, 3.8, d / 2 + 0.2);
  root.add(sign);

  // Rooftop details
  const roof = createRooftopDetails(w, d, h);
  root.add(roof);

  // Storefront
  const storefront = storefrontCreator();
  storefront.root.position.set(0, 0, d / 2 - 1.8);
  root.add(storefront.root);

  return { root, storefront };
}

/**
 * Lot 2 / Lot 7: Mid-Century Modern Glass Curtain-Wall Infill.
 * Sleek steel/aluminum mullions, tinted blue-green curtain glass replacing war gaps.
 */
function createGlassCurtainWallBuilding(
  w: number,
  d: number,
  stories = 4,
): { root: Object3D; storefront?: StorefrontInstance } {
  const root = new Object3D();
  const h = stories * 3.6;

  // Core structure
  const core = createBox(
    w * 0.92,
    h,
    d * 0.92,
    ERA_1965_PALETTE.architecture.curtainWallSteel,
    0,
    h / 2,
    0,
  );
  root.add(core);

  // Glass Curtain Wall Facade grid
  const glassFacade = createBox(
    w,
    h,
    0.1,
    ERA_1965_PALETTE.architecture.curtainWallGlass,
    0,
    h / 2,
    d / 2 + 0.05,
  );
  root.add(glassFacade);

  // Vertical steel mullions
  const mullionCount = 6;
  for (let m = 0; m <= mullionCount; m++) {
    const mx = -w / 2 + (m * w) / mullionCount;
    const mullion = createBox(
      0.12,
      h,
      0.2,
      ERA_1965_PALETTE.architecture.chromeTrim,
      mx,
      h / 2,
      d / 2 + 0.12,
    );
    root.add(mullion);
  }

  // Horizontal spandrel floor bands
  for (let s = 1; s < stories; s++) {
    const sy = s * 3.6;
    const spandrel = createBox(
      w + 0.05,
      0.7,
      0.25,
      0x1d3557,
      0,
      sy,
      d / 2 + 0.1,
    );
    root.add(spandrel);
  }

  // Ground floor modern lobby canopy
  const canopy = createBox(
    w * 0.6,
    0.2,
    2.5,
    ERA_1965_PALETTE.architecture.chromeTrim,
    0,
    3.4,
    d / 2 + 1.2,
  );
  root.add(canopy);

  // Sign band
  const signDesc = STOREFRONT_SIGNS_1965[2];
  const sign = createSignBand(w * 0.8, 1.0, signDesc);
  sign.position.set(0, 3.8, d / 2 + 0.2);
  root.add(sign);

  // Rooftop details
  const roof = createRooftopDetails(w, d, h);
  root.add(roof);

  return { root };
}

/**
 * Builds all 10 buildings corresponding to the 10 layout lot anchors.
 */
export function create1965Buildings(layout: CityBlockLayout): {
  buildings: Building1965[];
  root: Object3D;
} {
  const root = new Object3D();
  const buildings: Building1965[] = [];

  layout.lots.forEach((lot, i) => {
    const w = lot.width - 1.5;
    const d = lot.depth - 1.5;
    let bldg: { root: Object3D; storefront?: StorefrontInstance };
    let style: Building1965['style'] = 'renovated_enamel';
    let name = `Building Lot ${i}`;
    let height = 12.0;

    switch (i) {
      case 0:
        // Corner Googie Diner
        bldg = createGoogieDinerBuilding(w, d);
        style = 'googie_diner';
        name = 'Sunny Side Googie Diner';
        height = 7.0;
        break;
      case 1:
        // Renovated Aqua Enamel - Record Store
        bldg = createRenovatedEnamelBuilding(
          w,
          d,
          1,
          ERA_1965_PALETTE.architecture.renovatedEnamelAqua,
          createRecordStorefront,
        );
        style = 'renovated_enamel';
        name = 'Groove & Spin Record Store Block';
        height = 12.0;
        break;
      case 2:
        // Mid-century Glass Curtain Wall Infill
        bldg = createGlassCurtainWallBuilding(w, d, 4);
        style = 'glass_curtain_wall';
        name = 'Modern Tower Plaza Infill';
        height = 14.4;
        break;
      case 3:
        // Renovated Yellow Enamel - TV & Appliance Shop
        bldg = createRenovatedEnamelBuilding(
          w,
          d,
          3,
          ERA_1965_PALETTE.architecture.renovatedEnamelYellow,
          createApplianceStorefront,
        );
        style = 'renovated_enamel';
        name = 'Electro-Vision Appliance & TV Store';
        height = 12.0;
        break;
      case 4:
        // East Corner Commercial - Tobacconist & Rooftop Billboard base
        bldg = createRenovatedEnamelBuilding(
          w,
          d,
          4,
          ERA_1965_PALETTE.architecture.renovatedEnamelCoral,
          createTobacconistStorefront,
        );
        style = 'renovated_brick';
        name = 'Apex Tobacconist Commercial Block';
        height = 14.0;
        break;
      case 5:
        // South-west Corner - Laundromat
        bldg = createRenovatedEnamelBuilding(
          w,
          d,
          5,
          ERA_1965_PALETTE.architecture.renovatedEnamelMint,
          createLaundromatStorefront,
        );
        style = 'renovated_enamel';
        name = 'Speedy Wash Laundromat';
        height = 9.0;
        break;
      case 6:
        // Renovated Brick & Sun Louver Office
        bldg = createRenovatedEnamelBuilding(
          w,
          d,
          2,
          ERA_1965_PALETTE.architecture.brickWarmRed,
          createRecordStorefront,
        );
        style = 'renovated_brick';
        name = 'Midland Sun-Louver Chambers';
        height = 11.0;
        break;
      case 7:
        // Glass Curtain Wall Infill (Lot 7)
        bldg = createGlassCurtainWallBuilding(w, d, 5);
        style = 'glass_curtain_wall';
        name = 'Centennial Modern Glass Center';
        height = 18.0;
        break;
      case 8:
        // Renovated Coral Enamel Low-Rise
        bldg = createRenovatedEnamelBuilding(
          w,
          d,
          1,
          ERA_1965_PALETTE.architecture.renovatedEnamelCoral,
          createApplianceStorefront,
        );
        style = 'renovated_enamel';
        name = 'Pacific Enamel Pavilion';
        height = 11.5;
        break;
      case 9:
      default:
        // South-East Corner Commercial Flagship
        bldg = createRenovatedEnamelBuilding(
          w,
          d,
          0,
          ERA_1965_PALETTE.architecture.renovatedEnamelAqua,
          createTobacconistStorefront,
        );
        style = 'renovated_enamel';
        name = 'Metro Modern Commercial Center';
        height = 13.5;
        break;
    }

    // Position and rotate according to lot anchor
    const pos = lot.transform(lot.width / 2, 0, lot.depth / 2);
    bldg.root.position.set(pos.x, pos.y, pos.z);
    bldg.root.rotation.y = (lot.rotation * Math.PI) / 180;

    root.add(bldg.root);
    buildings.push({
      lotIndex: i,
      name,
      style,
      height,
      root: bldg.root,
      storefront: bldg.storefront,
    });
  });

  return { buildings, root };
}
