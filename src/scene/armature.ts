import * as THREE from 'three';

// ── Constants ───────────────────────────────────────────────────────
const BLOCK_SIZE = 40;              // one side of the square block in metres
const SIDEWALK_WIDTH = 3;           // width of sidewalk around block
const STREET_WIDTH = 8;             // each street lane (total intersection is wider)
const CURB_HEIGHT = 0.15;           // curb rise
const CROSSWALK_WIDTH = 4;          // crosswalk strip width across street
const LOT_COUNT_PER_SIDE = 4;       // subdivisions per block face (8+ total)
const ALLEY_WIDTH = 4;              // alley width behind buildings
const ALLEY_OFFSET = 6;             // distance from block edge to start of alley

/**
 * City-block armature: a neutral base geometry representing streets,
 * sidewalks, curbs, crosswalks, subdivided building lots, and an alley.
 * All materials are era-agnostic asphalt/concrete tones.
 *
 * Returns a THREE.Group with named children for easy layering.
 */
export function buildArmature(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'armature';

  const halfBlock = BLOCK_SIZE / 2;

  // ── Helpers ─────────────────────────────────────────────────────
  const matAsphalt = new THREE.MeshStandardMaterial({
    color: 0x3a3a3a,
    roughness: 0.9,
    metalness: 0.0,
  });

  const matConcrete = new THREE.MeshStandardMaterial({
    color: 0x9e9e9e,
    roughness: 0.85,
    metalness: 0.0,
  });

  const matCurb = new THREE.MeshStandardMaterial({
    color: 0xbdbdbd,
    roughness: 0.7,
    metalness: 0.05,
  });

  const matCrosswalk = new THREE.MeshStandardMaterial({
    color: 0xeeeeee,
    roughness: 0.8,
    metalness: 0.0,
  });

  const matGrass = new THREE.MeshStandardMaterial({
    color: 0x4a7c3f,
    roughness: 1.0,
    metalness: 0.0,
  });

  /** Create a box mesh positioned at (x, y, z) with given size. */
  function box(
    w: number, h: number, d: number,
    material: THREE.Material,
    px: number, py: number, pz: number,
    name?: string,
  ): THREE.Mesh {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(px, py, pz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (name) mesh.name = name;
    return mesh;
  }

  // ── Ground plane (subtle fill beyond streets) ───────────────────
  const groundGeo = new THREE.PlaneGeometry(BLOCK_SIZE + SIDEWALK_WIDTH * 2 + STREET_WIDTH * 2 + 20, BLOCK_SIZE + SIDEWALK_WIDTH * 2 + STREET_WIDTH * 2 + 20);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1e, roughness: 1 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -CURB_HEIGHT;
  ground.receiveShadow = true;
  ground.name = 'ground';
  group.add(ground);

  // ── Sidewalk surface (one continuous slab with cutouts for streets) ──
  // We build four sidewalk segments around the block plus inner lot surfaces.
  const sidewalkGroup = new THREE.Group();
  sidewalkGroup.name = 'sidewalks';

  // Four outer sidewalk strips (N, S, E, W)
  const swSegments = [
    // North
    { x: 0, z: halfBlock + SIDEWALK_WIDTH / 2, w: BLOCK_SIZE + STREET_WIDTH, d: SIDEWALK_WIDTH },
    // South
    { x: 0, z: -(halfBlock + SIDEWALK_WIDTH / 2), w: BLOCK_SIZE + STREET_WIDTH, d: SIDEWALK_WIDTH },
    // East
    { x: halfBlock + SIDEWALK_WIDTH / 2, z: 0, w: SIDEWALK_WIDTH, d: BLOCK_SIZE },
    // West
    { x: -(halfBlock + SIDEWALK_WIDTH / 2), z: 0, w: SIDEWALK_WIDTH, d: BLOCK_SIZE },
  ];

  for (const seg of swSegments) {
    sidewalkGroup.add(box(seg.w, CURB_HEIGHT, seg.d, matConcrete, seg.x, CURB_HEIGHT / 2, seg.z, `sidewalk_${seg.z > 0 ? 'north' : seg.z < 0 ? 'south' : seg.x > 0 ? 'east' : 'west'}`));
  }
  group.add(sidewalkGroup);

  // ── Streets ─────────────────────────────────────────────────────
  const streetsGroup = new THREE.Group();
  streetsGroup.name = 'streets';

  // Horizontal street (along X axis through center)
  const hStreet = box(STREET_WIDTH + STREET_WIDTH, 0.02, BLOCK_SIZE + STREET_WIDTH * 2, matAsphalt, 0, -0.01, 0, 'horizontal_street');
  streetsGroup.add(hStreet);

  // Vertical street (along Z axis through center)
  const vStreet = box(STREET_WIDTH + STREET_WIDTH, 0.02, BLOCK_SIZE + STREET_WIDTH * 2, matAsphalt, 0, -0.01, 0, 'vertical_street');
  streetsGroup.add(vStreet);

  // Street markings (lane divider lines)
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xf0c040, roughness: 0.6 });
  // Center dashed lines
  for (let i = -BLOCK_SIZE; i <= BLOCK_SIZE; i += 3) {
    streetsGroup.add(box(1.5, 0.005, 0.15, lineMat, 0, 0.005, i, `h_line_${i}`));
    streetsGroup.add(box(0.15, 0.005, 1.5, lineMat, i, 0.005, 0, `v_line_${i}`));
  }
  group.add(streetsGroup);

  // ── Curbs ───────────────────────────────────────────────────────
  const curbsGroup = new THREE.Group();
  curbsGroup.name = 'curbs';

  const curbHeight = CURB_HEIGHT;
  const curbThick = 0.2;

  // Outer perimeter curbs
  const curbPerimeter = [
    // North outer
    { x: 0, z: halfBlock + SIDEWALK_WIDTH + curbThick / 2, w: BLOCK_SIZE + STREET_WIDTH, d: curbThick },
    // South outer
    { x: 0, z: -(halfBlock + SIDEWALK_WIDTH + curbThick / 2), w: BLOCK_SIZE + STREET_WIDTH, d: curbThick },
    // East outer
    { x: halfBlock + SIDEWALK_WIDTH + curbThick / 2, z: 0, w: curbThick, d: BLOCK_SIZE },
    // West outer
    { x: -(halfBlock + SIDEWALK_WIDTH + curbThick / 2), z: 0, w: curbThick, d: BLOCK_SIZE },
  ];

  for (const c of curbPerimeter) {
    curbsGroup.add(box(c.w, curbHeight, c.d, matCurb, c.x, curbHeight / 2, c.z));
  }

  // Inner street-facing curbs (around the block face)
  const innerCurbs = [
    // North inner (street side)
    { x: 0, z: halfBlock + curbThick / 2, w: BLOCK_SIZE + STREET_WIDTH, d: curbThick },
    // South inner
    { x: 0, z: -(halfBlock + curbThick / 2), w: BLOCK_SIZE + STREET_WIDTH, d: curbThick },
    // East inner
    { x: halfBlock + curbThick / 2, z: 0, w: curbThick, d: BLOCK_SIZE },
    // West inner
    { x: -(halfBlock + curbThick / 2), z: 0, w: curbThick, d: BLOCK_SIZE },
  ];

  for (const c of innerCurbs) {
    curbsGroup.add(box(c.w, curbHeight, c.d, matCurb, c.x, curbHeight / 2, c.z));
  }
  group.add(curbsGroup);

  // ── Crosswalks ──────────────────────────────────────────────────
  const crosswalksGroup = new THREE.Group();
  crosswalksGroup.name = 'crosswalks';

  const stripeWidth = 0.4;
  const stripeGap = 0.6;
  const stripeLength = CROSSWALK_WIDTH;
  const crosswalkPositions = [
    // North side – horizontal street crossing
    { x: 0, z: halfBlock, rotY: Math.PI / 2 },
    { x: 0, z: -(halfBlock), rotY: Math.PI / 2 },
    // East side – vertical street crossing
    { x: halfBlock, z: 0, rotY: 0 },
    { x: -(halfBlock), z: 0, rotY: 0 },
  ];

  for (const pos of crosswalkPositions) {
    const count = Math.floor((STREET_WIDTH + STREET_WIDTH) / (stripeWidth + stripeGap));
    for (let s = 0; s < count; s++) {
      const offset = -((STREET_WIDTH + STREET_WIDTH) / 2) + s * (stripeWidth + stripeGap) + stripeWidth / 2;
      const stripeName = `crosswalk_stripe_${pos.x > 0 ? 'E' : 'W'}_${pos.z > 0 ? 'N' : 'S'}_${s}`;
      crosswalksGroup.add(box(stripeWidth, 0.005, stripeLength, matCrosswalk, pos.x + offset, 0.005, pos.z + offset, stripeName));
    }
  }
  group.add(crosswalksGroup);

  // ── Building Lots ───────────────────────────────────────────────
  const lotsGroup = new THREE.Group();
  lotsGroup.name = 'lots';

  const lotSpacing = 0.5; // gap between lots
  const lotSideSize = (BLOCK_SIZE - lotSpacing * (LOT_COUNT_PER_SIDE - 1)) / LOT_COUNT_PER_SIDE;

  // Helper to place lots on one face of the block
  function placeLotsOnFace(
    face: 'north' | 'south' | 'east' | 'west',
    startX: number, endX: number,
    startZ: number, endZ: number,
    direction: 'x' | 'z',
    setback: number, // distance from block edge inward
  ) {
    const lots: THREE.Group[] = [];
    const numLots = LOT_COUNT_PER_SIDE;
    const step = (direction === 'x' ? (endX - startX) : (endZ - startZ)) / numLots;

    for (let i = 0; i < numLots; i++) {
      const lotGroup = new THREE.Group();
      lotGroup.name = `lot_${face}_${i}`;

      if (direction === 'x') {
        const lx = startX + i * step + step / 2;
        const lz = face === 'north' ? halfBlock - setback : -(halfBlock - setback);
        const lw = step - lotSpacing;
        const ld = lotSideSize - setback;

        // Lot surface (grass/dirt)
        lotGroup.add(box(lw, 0.02, ld, matGrass, lx, 0.01, lz, `surface_${face}_${i}`));
        // Setback marker (small curb-like edge)
        lotGroup.add(box(lw, 0.05, 0.1, matCurb, lx, 0.025, lz + (face === 'north' ? ld / 2 : -ld / 2), `setback_${face}_${i}`));
      } else {
        const lz = startZ + i * step + step / 2;
        const lx = face === 'east' ? halfBlock - setback : -(halfBlock - setback);
        const lw = lotSideSize - setback;
        const ld = step - lotSpacing;

        lotGroup.add(box(lw, 0.02, ld, matGrass, lx, 0.01, lz, `surface_${face}_${i}`));
        lotGroup.add(box(0.1, 0.05, ld, matCurb, lx + (face === 'east' ? lw / 2 : -lw / 2), 0.025, lz, `setback_${face}_${i}`));
      }
      lots.push(lotGroup);
    }
    return lots;
  }

  const allLots = [
    ...placeLotsOnFace('north', -halfBlock, halfBlock, 0, 0, 'x', 4),
    ...placeLotsOnFace('south', -halfBlock, halfBlock, 0, 0, 'x', 4),
    ...placeLotsOnFace('east', 0, 0, -halfBlock, halfBlock, 'z', 4),
    ...placeLotsOnFace('west', 0, 0, -halfBlock, halfBlock, 'z', 4),
  ];

  for (const lot of allLots) {
    lotsGroup.add(lot);
  }

  lotsGroup.userData.lots = allLots;
  lotsGroup.userData.count = allLots.length; // should be LOT_COUNT_PER_SIDE * 4 = 16
  group.add(lotsGroup);

  // ── Alley ───────────────────────────────────────────────────────
  const alleyGroup = new THREE.Group();
  alleyGroup.name = 'alley';

  // Alley runs along the back of the block (behind north-side lots, going east-west)
  const alleyZ = halfBlock - ALLEY_OFFSET;
  const alleyLen = BLOCK_SIZE - ALLEY_WIDTH;

  // Alley pavement
  alleyGroup.add(box(alleyLen, 0.02, ALLEY_WIDTH, matAsphalt, 0, 0.005, alleyZ, 'alley_pavement'));

  // Alley side walls (low concrete walls)
  const wallH = 1.2;
  const wallT = 0.15;
  alleyGroup.add(box(wallT, wallH, ALLEY_WIDTH, matConcrete, -alleyLen / 2, wallH / 2, alleyZ, 'alley_wall_west'));
  alleyGroup.add(box(wallT, wallH, ALLEY_WIDTH, matConcrete, alleyLen / 2, wallH / 2, alleyZ, 'alley_wall_east'));

  // Back wall (perpendicular at far end)
  alleyGroup.add(box(ALLEY_WIDTH, wallH, wallT, matConcrete, 0, wallH / 2, alleyZ + alleyLen / 2, 'alley_wall_back'));

  group.add(alleyGroup);

  return group;
}
