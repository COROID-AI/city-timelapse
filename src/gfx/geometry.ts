/**
 * Procedural geometry builders for high-detail architectural elements.
 *
 * Produces clean, parameterized `THREE.BufferGeometry` instances for:
 * - Beveled boxes (plinths, stones, ledges, panels)
 * - Window grids / multi-pane mullion frames
 * - Decorative cornices and friezes
 * - Structural lintels, sills, and pediments
 * - Multi-tier fire escapes with stairs, landings, and railings
 * - Balconies with balusters and decorative railings
 * - Multi-panel doors, transoms, and frame assemblies
 * - Roof accessories (HVAC units, industrial vents, water towers, skylights, chimneys)
 *
 * All geometries are domain-agnostic, generate correct normals/UVs, and are
 * optimized for repeated reuse and instancing across building facades and props.
 */

import * as THREE from 'three';

/** Merge multiple BufferGeometries into a single BufferGeometry. */
export function mergeBufferGeometries(geometries: readonly THREE.BufferGeometry[]): THREE.BufferGeometry {
  const valid = geometries.filter((g) => g && g.getAttribute('position'));
  if (valid.length === 0) {
    return new THREE.BufferGeometry();
  }
  if (valid.length === 1) {
    return valid[0].clone();
  }

  let totalPositions = 0;
  let totalNormals = 0;
  let totalUvs = 0;
  let totalIndices = 0;

  for (const geom of valid) {
    const pos = geom.getAttribute('position');
    totalPositions += pos ? pos.count * pos.itemSize : 0;
    const norm = geom.getAttribute('normal');
    totalNormals += norm ? norm.count * norm.itemSize : 0;
    const uv = geom.getAttribute('uv');
    totalUvs += uv ? uv.count * uv.itemSize : 0;
    if (geom.index) {
      totalIndices += geom.index.count;
    } else if (pos) {
      totalIndices += pos.count;
    }
  }

  const mergedPos = new Float32Array(totalPositions);
  const mergedNorm = new Float32Array(totalNormals);
  const mergedUv = new Float32Array(totalUvs);
  const mergedIndex = totalPositions / 3 > 65535 ? new Uint32Array(totalIndices) : new Uint16Array(totalIndices);

  let posOffset = 0;
  let normOffset = 0;
  let uvOffset = 0;
  let indexOffset = 0;
  let vertexOffset = 0;

  for (const geom of valid) {
    const pos = geom.getAttribute('position');
    if (!pos) continue;

    mergedPos.set(pos.array, posOffset);
    posOffset += pos.count * pos.itemSize;

    const norm = geom.getAttribute('normal');
    if (norm) {
      mergedNorm.set(norm.array, normOffset);
      normOffset += norm.count * norm.itemSize;
    }

    const uv = geom.getAttribute('uv');
    if (uv) {
      mergedUv.set(uv.array, uvOffset);
      uvOffset += uv.count * uv.itemSize;
    }

    if (geom.index) {
      for (let i = 0; i < geom.index.count; i++) {
        mergedIndex[indexOffset++] = geom.index.getX(i) + vertexOffset;
      }
    } else {
      for (let i = 0; i < pos.count; i++) {
        mergedIndex[indexOffset++] = i + vertexOffset;
      }
    }

    vertexOffset += pos.count;
  }

  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
  if (totalNormals > 0) {
    result.setAttribute('normal', new THREE.BufferAttribute(mergedNorm, 3));
  } else {
    result.computeVertexNormals();
  }
  if (totalUvs > 0) {
    result.setAttribute('uv', new THREE.BufferAttribute(mergedUv, 2));
  }
  result.setIndex(new THREE.BufferAttribute(mergedIndex, 1));
  return result;
}

// ---------------------------------------------------------------------------
// 1. Beveled Box
// ---------------------------------------------------------------------------

export interface BeveledBoxOptions {
  width?: number;
  height?: number;
  depth?: number;
  bevelSize?: number;
  bevelSegments?: number;
}

/**
 * Creates a box with beveled edges using a 2D rounded shape extruded along depth.
 */
export function createBeveledBoxGeometry(options: BeveledBoxOptions = {}): THREE.BufferGeometry {
  const {
    width = 1,
    height = 1,
    depth = 1,
    bevelSize = 0.04,
    bevelSegments = 2,
  } = options;

  const effectiveBevel = Math.min(bevelSize, width * 0.25, height * 0.25, depth * 0.25);
  const halfW = width / 2;
  const halfH = height / 2;

  const shape = new THREE.Shape();
  shape.moveTo(-halfW + effectiveBevel, -halfH);
  shape.lineTo(halfW - effectiveBevel, -halfH);
  shape.quadraticCurveTo(halfW, -halfH, halfW, -halfH + effectiveBevel);
  shape.lineTo(halfW, halfH - effectiveBevel);
  shape.quadraticCurveTo(halfW, halfH, halfW - effectiveBevel, halfH);
  shape.lineTo(-halfW + effectiveBevel, halfH);
  shape.quadraticCurveTo(-halfW, halfH, -halfW, halfH - effectiveBevel);
  shape.lineTo(-halfW, -halfH + effectiveBevel);
  shape.quadraticCurveTo(-halfW, -halfH, -halfW + effectiveBevel, -halfH);

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: Math.max(0.001, depth - effectiveBevel * 2),
    bevelEnabled: effectiveBevel > 0.001,
    bevelSegments,
    steps: 1,
    bevelSize: effectiveBevel,
    bevelThickness: effectiveBevel,
  };

  const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geom.center();
  return geom;
}

// ---------------------------------------------------------------------------
// 2. Window Grid Geometry
// ---------------------------------------------------------------------------

export interface WindowGridOptions {
  width?: number;
  height?: number;
  depth?: number;
  rows?: number;
  columns?: number;
  frameThickness?: number;
  mullionThickness?: number;
  glassInset?: number;
  includeGlass?: boolean;
}

/**
 * Builds a multi-pane architectural window assembly: outer frame, horizontal/vertical
 * mullions, and an optional embedded glass quad.
 */
export function createWindowGridGeometry(options: WindowGridOptions = {}): THREE.BufferGeometry {
  const {
    width = 1.2,
    height = 1.8,
    depth = 0.1,
    rows = 3,
    columns = 2,
    frameThickness = 0.06,
    mullionThickness = 0.03,
    includeGlass = true,
  } = options;

  const parts: THREE.BufferGeometry[] = [];

  // Top frame bar
  const topBar = new THREE.BoxGeometry(width, frameThickness, depth);
  topBar.translate(0, height / 2 - frameThickness / 2, 0);
  parts.push(topBar);

  // Bottom sill bar
  const bottomBar = new THREE.BoxGeometry(width, frameThickness, depth * 1.3);
  bottomBar.translate(0, -height / 2 + frameThickness / 2, depth * 0.15);
  parts.push(bottomBar);

  // Left jamb
  const innerH = Math.max(0.01, height - frameThickness * 2);
  const leftJamb = new THREE.BoxGeometry(frameThickness, innerH, depth);
  leftJamb.translate(-width / 2 + frameThickness / 2, 0, 0);
  parts.push(leftJamb);

  // Right jamb
  const rightJamb = new THREE.BoxGeometry(frameThickness, innerH, depth);
  rightJamb.translate(width / 2 - frameThickness / 2, 0, 0);
  parts.push(rightJamb);

  const innerW = Math.max(0.01, width - frameThickness * 2);
  const mullionDepth = depth * 0.75;

  // Horizontal mullions
  if (rows > 1) {
    const rowStep = innerH / rows;
    for (let r = 1; r < rows; r++) {
      const y = -innerH / 2 + r * rowStep;
      const hBar = new THREE.BoxGeometry(innerW, mullionThickness, mullionDepth);
      hBar.translate(0, y, 0);
      parts.push(hBar);
    }
  }

  // Vertical mullions
  if (columns > 1) {
    const colStep = innerW / columns;
    for (let c = 1; c < columns; c++) {
      const x = -innerW / 2 + c * colStep;
      const vBar = new THREE.BoxGeometry(mullionThickness, innerH, mullionDepth);
      vBar.translate(x, 0, 0);
      parts.push(vBar);
    }
  }

  // Optional glass plane
  if (includeGlass) {
    const glass = new THREE.PlaneGeometry(innerW, innerH);
    // Plane defaults to facing +Z
    glass.translate(0, 0, 0);
    parts.push(glass);
  }

  return mergeBufferGeometries(parts);
}

// ---------------------------------------------------------------------------
// 3. Cornice Geometry
// ---------------------------------------------------------------------------

export interface CorniceOptions {
  width?: number;
  height?: number;
  depth?: number;
  tiers?: number;
  dentils?: boolean;
  dentilCount?: number;
  corbelSpacing?: number;
}

/**
 * Builds a classical/modern building cornice with tiered ledges and optional dentils/corbels.
 */
export function createCorniceGeometry(options: CorniceOptions = {}): THREE.BufferGeometry {
  const {
    width = 4.0,
    height = 0.6,
    depth = 0.5,
    tiers = 3,
    dentils = true,
    dentilCount = 16,
  } = options;

  const parts: THREE.BufferGeometry[] = [];
  const tierH = height / Math.max(1, tiers);

  // Stepped tiers projecting outward
  for (let i = 0; i < tiers; i++) {
    const frac = (i + 1) / tiers;
    const tierW = width + frac * 0.1;
    const tierD = (depth * (i + 1)) / tiers;
    const tierY = -height / 2 + (i + 0.5) * tierH;
    const tierZ = (tierD - depth) / 2 + (depth * frac) / 2;

    const block = new THREE.BoxGeometry(tierW, tierH * 0.95, tierD);
    block.translate(0, tierY, tierZ);
    parts.push(block);
  }

  // Optional dentil frieze on the middle tier
  if (dentils && dentilCount > 0) {
    const dentilW = Math.max(0.04, (width * 0.7) / (dentilCount * 2));
    const dentilH = tierH * 0.45;
    const dentilD = depth * 0.35;
    const startX = -width / 2 + dentilW * 1.5;
    const stepX = (width - dentilW * 3) / Math.max(1, dentilCount - 1);
    const dentilY = 0;
    const dentilZ = depth * 0.15;

    for (let d = 0; d < dentilCount; d++) {
      const dentil = new THREE.BoxGeometry(dentilW, dentilH, dentilD);
      dentil.translate(startX + d * stepX, dentilY, dentilZ);
      parts.push(dentil);
    }
  }

  return mergeBufferGeometries(parts);
}

// ---------------------------------------------------------------------------
// 4. Lintel & Sill Geometry
// ---------------------------------------------------------------------------

export interface LintelOptions {
  width?: number;
  height?: number;
  depth?: number;
  keystone?: boolean;
  pediment?: 'none' | 'triangular' | 'segmental';
  sillBevel?: boolean;
}

/**
 * Builds decorative window/door lintels, pediments, and sill assemblies.
 */
export function createLintelGeometry(options: LintelOptions = {}): THREE.BufferGeometry {
  const {
    width = 1.4,
    height = 0.25,
    depth = 0.18,
    keystone = true,
    pediment = 'none',
  } = options;

  const parts: THREE.BufferGeometry[] = [];

  // Main lintel beam
  const beam = new THREE.BoxGeometry(width, height, depth);
  parts.push(beam);

  // Decorative keystone in the center
  if (keystone) {
    const kWidthTop = height * 0.9;
    const kWidthBot = height * 0.6;
    const kHeight = height * 1.35;
    const kDepth = depth * 1.25;

    const shape = new THREE.Shape();
    shape.moveTo(-kWidthBot / 2, -kHeight / 2);
    shape.lineTo(kWidthBot / 2, -kHeight / 2);
    shape.lineTo(kWidthTop / 2, kHeight / 2);
    shape.lineTo(-kWidthTop / 2, kHeight / 2);
    shape.closePath();

    const keystoneGeom = new THREE.ExtrudeGeometry(shape, {
      depth: kDepth,
      bevelEnabled: false,
    });
    keystoneGeom.center();
    keystoneGeom.translate(0, height * 0.1, depth * 0.05);
    parts.push(keystoneGeom);
  }

  // Optional triangular or segmental pediment on top
  if (pediment === 'triangular') {
    const pedHeight = height * 1.2;
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(0, pedHeight);
    shape.closePath();

    const pedGeom = new THREE.ExtrudeGeometry(shape, {
      depth: depth * 0.9,
      bevelEnabled: false,
    });
    pedGeom.center();
    pedGeom.translate(0, height / 2 + pedHeight / 2, 0);
    parts.push(pedGeom);
  } else if (pediment === 'segmental') {
    const pedHeight = height * 0.9;
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.quadraticCurveTo(0, pedHeight * 1.8, -width / 2, 0);

    const pedGeom = new THREE.ExtrudeGeometry(shape, {
      depth: depth * 0.9,
      bevelEnabled: false,
    });
    pedGeom.center();
    pedGeom.translate(0, height / 2 + pedHeight / 2, 0);
    parts.push(pedGeom);
  }

  return mergeBufferGeometries(parts);
}

// ---------------------------------------------------------------------------
// 5. Fire Escape Geometry
// ---------------------------------------------------------------------------

export interface FireEscapeOptions {
  width?: number;
  depth?: number;
  heightPerStory?: number;
  stories?: number;
  railingHeight?: number;
  slatSpacing?: number;
}

/**
 * Builds multi-tier architectural iron fire escape assemblies with grated landings,
 * perimeter railings, vertical drop ladders, and inter-floor stairs.
 */
export function createFireEscapeGeometry(options: FireEscapeOptions = {}): THREE.BufferGeometry {
  const {
    width = 2.2,
    depth = 0.9,
    heightPerStory = 2.8,
    stories = 2,
    railingHeight = 0.85,
  } = options;

  const parts: THREE.BufferGeometry[] = [];
  const barThick = 0.025;

  for (let s = 0; s < stories; s++) {
    const storyY = s * heightPerStory;

    // Platform grating frame
    const frameW = width;
    const frameD = depth;
    const frameH = 0.04;

    // Outer frame perimeter
    const outerPlat = new THREE.BoxGeometry(frameW, frameH, frameD);
    outerPlat.translate(0, storyY, frameD / 2);
    parts.push(outerPlat);

    // Platform support brackets underneath
    const bracketCount = 3;
    for (let b = 0; b < bracketCount; b++) {
      const bx = -frameW / 2 + (b / (bracketCount - 1)) * frameW;
      const bracket = new THREE.BoxGeometry(barThick * 1.5, 0.4, frameD);
      bracket.translate(bx, storyY - 0.2, frameD / 2);
      parts.push(bracket);
    }

    // Railing posts
    const postPositions = [
      [-frameW / 2, frameD],
      [frameW / 2, frameD],
      [-frameW / 2, 0.05],
      [frameW / 2, 0.05],
      [0, frameD],
    ];

    for (const [px, pz] of postPositions) {
      const post = new THREE.BoxGeometry(barThick, railingHeight, barThick);
      post.translate(px, storyY + railingHeight / 2, pz);
      parts.push(post);
    }

    // Top railing bar
    const topFrontRail = new THREE.BoxGeometry(frameW, barThick, barThick);
    topFrontRail.translate(0, storyY + railingHeight, frameD);
    parts.push(topFrontRail);

    const sideRailL = new THREE.BoxGeometry(barThick, barThick, frameD);
    sideRailL.translate(-frameW / 2, storyY + railingHeight, frameD / 2);
    parts.push(sideRailL);

    const sideRailR = new THREE.BoxGeometry(barThick, barThick, frameD);
    sideRailR.translate(frameW / 2, storyY + railingHeight, frameD / 2);
    parts.push(sideRailR);

    // Mid-rail bar
    const midFrontRail = new THREE.BoxGeometry(frameW, barThick, barThick);
    midFrontRail.translate(0, storyY + railingHeight * 0.5, frameD);
    parts.push(midFrontRail);

    // Slanted stair flight connecting to next story
    if (s < stories - 1) {
      const stairW = 0.55;
      const stairL = Math.sqrt(Math.pow(frameW * 0.7, 2) + Math.pow(heightPerStory, 2));
      const stairAngle = Math.atan2(heightPerStory, frameW * 0.7);

      const stairStringer = new THREE.BoxGeometry(stairL, 0.08, 0.02);
      stairStringer.rotateZ(stairAngle);
      stairStringer.translate(0, storyY + heightPerStory / 2, frameD * 0.4);
      parts.push(stairStringer);

      const stairStringer2 = stairStringer.clone();
      stairStringer2.translate(0, 0, stairW);
      parts.push(stairStringer2);

      // Treads
      const treadCount = 10;
      for (let t = 0; t < treadCount; t++) {
        const frac = (t + 0.5) / treadCount;
        const tx = -frameW * 0.35 + frac * frameW * 0.7;
        const ty = storyY + frac * heightPerStory;
        const tread = new THREE.BoxGeometry(0.18, 0.02, stairW);
        tread.translate(tx, ty, frameD * 0.4 + stairW / 2);
        parts.push(tread);
      }
    }
  }

  // Drop ladder at lowest story
  const ladderH = heightPerStory * 0.8;
  const ladderW = 0.4;
  const ladderL = new THREE.BoxGeometry(barThick, ladderH, barThick);
  ladderL.translate(-ladderW / 2, ladderH / 2 - heightPerStory * 0.6, depth);
  parts.push(ladderL);

  const ladderR = new THREE.BoxGeometry(barThick, ladderH, barThick);
  ladderR.translate(ladderW / 2, ladderH / 2 - heightPerStory * 0.6, depth);
  parts.push(ladderR);

  const rungCount = 6;
  for (let r = 0; r < rungCount; r++) {
    const rungY = -heightPerStory * 0.6 + (r + 0.5) * (ladderH / rungCount);
    const rung = new THREE.BoxGeometry(ladderW, barThick * 0.8, barThick * 0.8);
    rung.translate(0, rungY, depth);
    parts.push(rung);
  }

  return mergeBufferGeometries(parts);
}

// ---------------------------------------------------------------------------
// 6. Balcony Geometry
// ---------------------------------------------------------------------------

export interface BalconyOptions {
  width?: number;
  depth?: number;
  height?: number;
  slabThickness?: number;
  balusterCount?: number;
  style?: 'classic-iron' | 'modern-glass' | 'concrete-parapet';
}

/**
 * Builds detailed cantilevered or supported building balconies with railings.
 */
export function createBalconyGeometry(options: BalconyOptions = {}): THREE.BufferGeometry {
  const {
    width = 2.4,
    depth = 1.0,
    height = 0.9,
    slabThickness = 0.12,
    balusterCount = 12,
    style = 'classic-iron',
  } = options;

  const parts: THREE.BufferGeometry[] = [];

  // Balcony base floor slab
  const slab = new THREE.BoxGeometry(width, slabThickness, depth);
  slab.translate(0, -slabThickness / 2, depth / 2);
  parts.push(slab);

  // Decorative corbels / support consoles underneath
  const corbelW = 0.1;
  const corbelH = 0.3;
  const corbelD = depth * 0.75;
  const corbelL = new THREE.BoxGeometry(corbelW, corbelH, corbelD);
  corbelL.translate(-width * 0.4, -slabThickness - corbelH / 2, corbelD / 2);
  parts.push(corbelL);

  const corbelR = new THREE.BoxGeometry(corbelW, corbelH, corbelD);
  corbelR.translate(width * 0.4, -slabThickness - corbelH / 2, corbelD / 2);
  parts.push(corbelR);

  if (style === 'concrete-parapet') {
    // Solid parapet walls
    const wallThick = 0.08;
    const frontWall = new THREE.BoxGeometry(width, height, wallThick);
    frontWall.translate(0, height / 2, depth - wallThick / 2);
    parts.push(frontWall);

    const leftWall = new THREE.BoxGeometry(wallThick, height, depth);
    leftWall.translate(-width / 2 + wallThick / 2, height / 2, depth / 2);
    parts.push(leftWall);

    const rightWall = new THREE.BoxGeometry(wallThick, height, depth);
    rightWall.translate(width / 2 - wallThick / 2, height / 2, depth / 2);
    parts.push(rightWall);
  } else if (style === 'modern-glass') {
    // Top handrail
    const handrail = new THREE.BoxGeometry(width, 0.04, 0.04);
    handrail.translate(0, height, depth);
    parts.push(handrail);

    // Glass panel
    const glassPane = new THREE.BoxGeometry(width * 0.96, height * 0.85, 0.02);
    glassPane.translate(0, height * 0.45, depth);
    parts.push(glassPane);
  } else {
    // Classic iron balustrade
    const barThick = 0.03;
    const topRail = new THREE.BoxGeometry(width, barThick, barThick);
    topRail.translate(0, height, depth);
    parts.push(topRail);

    const botRail = new THREE.BoxGeometry(width, barThick, barThick);
    botRail.translate(0, barThick, depth);
    parts.push(botRail);

    const sideRailL = new THREE.BoxGeometry(barThick, barThick, depth);
    sideRailL.translate(-width / 2, height, depth / 2);
    parts.push(sideRailL);

    const sideRailR = new THREE.BoxGeometry(barThick, barThick, depth);
    sideRailR.translate(width / 2, height, depth / 2);
    parts.push(sideRailR);

    // Balusters
    const innerW = width - 0.1;
    for (let i = 0; i < balusterCount; i++) {
      const bx = -innerW / 2 + (i / Math.max(1, balusterCount - 1)) * innerW;
      const baluster = new THREE.CylinderGeometry(0.012, 0.012, height - barThick * 2, 6);
      baluster.translate(bx, height / 2, depth);
      parts.push(baluster);
    }
  }

  return mergeBufferGeometries(parts);
}

// ---------------------------------------------------------------------------
// 7. Door Geometry
// ---------------------------------------------------------------------------

export interface DoorOptions {
  width?: number;
  height?: number;
  depth?: number;
  panels?: number;
  transom?: boolean;
  transomHeight?: number;
  handle?: boolean;
  doubleDoor?: boolean;
}

/**
 * Builds entry door assemblies with molded panels, casing trim, kickplates,
 * optional transoms, and hardware handles.
 */
export function createDoorGeometry(options: DoorOptions = {}): THREE.BufferGeometry {
  const {
    width = 1.0,
    height = 2.2,
    depth = 0.08,
    panels = 4,
    transom = true,
    transomHeight = 0.45,
    handle = true,
    doubleDoor = false,
  } = options;

  const parts: THREE.BufferGeometry[] = [];
  const casingThick = 0.08;
  const leafHeight = transom ? height - transomHeight : height;
  const leafWidth = doubleDoor ? width / 2 - 0.01 : width;

  // Outer casing / jamb frame
  const totalH = height;
  const jambL = new THREE.BoxGeometry(casingThick, totalH, depth * 1.2);
  jambL.translate(-width / 2 - casingThick / 2, totalH / 2, 0);
  parts.push(jambL);

  const jambR = new THREE.BoxGeometry(casingThick, totalH, depth * 1.2);
  jambR.translate(width / 2 + casingThick / 2, totalH / 2, 0);
  parts.push(jambR);

  const head = new THREE.BoxGeometry(width + casingThick * 2, casingThick, depth * 1.2);
  head.translate(0, totalH + casingThick / 2, 0);
  parts.push(head);

  // Transom bar and glass
  if (transom) {
    const transomBar = new THREE.BoxGeometry(width, 0.05, depth);
    transomBar.translate(0, leafHeight, 0);
    parts.push(transomBar);

    const transomGlass = new THREE.PlaneGeometry(width * 0.95, transomHeight * 0.85);
    transomGlass.translate(0, leafHeight + transomHeight / 2, 0);
    parts.push(transomGlass);
  }

  // Door leaf builder
  const buildLeaf = (centerX: number, w: number) => {
    // Leaf body
    const leaf = new THREE.BoxGeometry(w, leafHeight, depth);
    leaf.translate(centerX, leafHeight / 2, 0);
    parts.push(leaf);

    // Recessed panels
    if (panels > 0) {
      const panelCols = doubleDoor ? 1 : 2;
      const panelRows = Math.ceil(panels / panelCols);
      const margin = 0.08;
      const pWidth = (w - margin * (panelCols + 1)) / panelCols;
      const pHeight = (leafHeight - margin * (panelRows + 1)) / panelRows;

      for (let r = 0; r < panelRows; r++) {
        for (let c = 0; c < panelCols; c++) {
          const px = centerX - w / 2 + margin + c * (pWidth + margin) + pWidth / 2;
          const py = margin + r * (pHeight + margin) + pHeight / 2;
          const panelBevel = new THREE.BoxGeometry(pWidth, pHeight, depth * 0.3);
          panelBevel.translate(px, py, depth * 0.4);
          parts.push(panelBevel);
        }
      }
    }

    // Hardware handle
    if (handle) {
      const handleSide = centerX > 0 ? -1 : 1;
      const handleX = centerX + handleSide * (w * 0.38);
      const handleY = leafHeight * 0.48;

      const handlePlate = new THREE.BoxGeometry(0.03, 0.14, 0.015);
      handlePlate.translate(handleX, handleY, depth / 2 + 0.01);
      parts.push(handlePlate);

      const lever = new THREE.CylinderGeometry(0.01, 0.01, 0.08, 8);
      lever.rotateZ(Math.PI / 2);
      lever.translate(handleX + handleSide * 0.03, handleY, depth / 2 + 0.03);
      parts.push(lever);
    }
  };

  if (doubleDoor) {
    buildLeaf(-width / 4, leafWidth);
    buildLeaf(width / 4, leafWidth);
  } else {
    buildLeaf(0, leafWidth);
  }

  return mergeBufferGeometries(parts);
}

// ---------------------------------------------------------------------------
// 8. Roof Accessory Geometry (HVAC, Vent, Water Tower, Skylight, Parapet Cap)
// ---------------------------------------------------------------------------

export type RoofAccessoryType = 'hvac' | 'vent' | 'water-tower' | 'skylight' | 'chimney';

export interface RoofAccessoryOptions {
  type?: RoofAccessoryType;
  scale?: number;
}

/**
 * Builds procedural rooftop infrastructure: commercial HVAC cooling units,
 * industrial exhaust vents, rooftop wooden water towers, skylights, and chimneys.
 */
export function createRoofAccessoryGeometry(options: RoofAccessoryOptions = {}): THREE.BufferGeometry {
  const { type = 'hvac', scale = 1.0 } = options;
  const parts: THREE.BufferGeometry[] = [];

  switch (type) {
    case 'hvac': {
      // Large rooftop AC chiller unit
      const bodyW = 2.2 * scale;
      const bodyH = 1.2 * scale;
      const bodyD = 1.4 * scale;

      const mainBox = new THREE.BoxGeometry(bodyW, bodyH, bodyD);
      mainBox.translate(0, bodyH / 2, 0);
      parts.push(mainBox);

      // Fan grille shroud on top
      const shroudR = 0.45 * scale;
      const shroudH = 0.2 * scale;
      const shroud = new THREE.CylinderGeometry(shroudR, shroudR, shroudH, 16);
      shroud.translate(bodyW * 0.22, bodyH + shroudH / 2, 0);
      parts.push(shroud);

      // Second smaller fan shroud
      const shroud2 = shroud.clone();
      shroud2.translate(-bodyW * 0.44, 0, 0);
      parts.push(shroud2);

      // Support rails underneath
      const rail1 = new THREE.BoxGeometry(bodyW * 1.1, 0.1 * scale, 0.1 * scale);
      rail1.translate(0, 0.05 * scale, bodyD * 0.4);
      parts.push(rail1);

      const rail2 = rail1.clone();
      rail2.translate(0, 0, -bodyD * 0.8);
      parts.push(rail2);
      break;
    }

    case 'vent': {
      // Industrial gooseneck / mushroom roof vent
      const stemR = 0.15 * scale;
      const stemH = 0.8 * scale;
      const stem = new THREE.CylinderGeometry(stemR, stemR, stemH, 12);
      stem.translate(0, stemH / 2, 0);
      parts.push(stem);

      // Mushroom cap
      const capR = 0.38 * scale;
      const capH = 0.18 * scale;
      const cap = new THREE.ConeGeometry(capR, capH, 16);
      cap.translate(0, stemH + capH / 2, 0);
      parts.push(cap);

      // Flange base
      const baseR = 0.28 * scale;
      const baseH = 0.05 * scale;
      const base = new THREE.CylinderGeometry(baseR, baseR, baseH, 12);
      base.translate(0, baseH / 2, 0);
      parts.push(base);
      break;
    }

    case 'water-tower': {
      // Cylindrical wood stave water tank on steel trestle
      const tankR = 1.1 * scale;
      const tankH = 2.0 * scale;
      const legH = 2.4 * scale;

      // 4 Leg steel trestle
      const legPositions = [
        [-tankR * 0.8, -tankR * 0.8],
        [tankR * 0.8, -tankR * 0.8],
        [-tankR * 0.8, tankR * 0.8],
        [tankR * 0.8, tankR * 0.8],
      ];

      for (const [lx, lz] of legPositions) {
        const leg = new THREE.BoxGeometry(0.08 * scale, legH, 0.08 * scale);
        leg.translate(lx, legH / 2, lz);
        parts.push(leg);
      }

      // Cross braces
      const braceH = 0.04 * scale;
      const braceRing = new THREE.BoxGeometry(tankR * 1.7, braceH, tankR * 1.7);
      braceRing.translate(0, legH * 0.5, 0);
      parts.push(braceRing);

      // Wood tank barrel
      const tank = new THREE.CylinderGeometry(tankR, tankR, tankH, 20);
      tank.translate(0, legH + tankH / 2, 0);
      parts.push(tank);

      // Conical roof
      const roofH = 0.9 * scale;
      const roof = new THREE.ConeGeometry(tankR * 1.12, roofH, 20);
      roof.translate(0, legH + tankH + roofH / 2, 0);
      parts.push(roof);
      break;
    }

    case 'skylight': {
      // Pitched glass skylight
      const sW = 1.8 * scale;
      const sL = 2.6 * scale;
      const sH = 0.6 * scale;
      const curbH = 0.2 * scale;

      const curb = new THREE.BoxGeometry(sW, curbH, sL);
      curb.translate(0, curbH / 2, 0);
      parts.push(curb);

      const shape = new THREE.Shape();
      shape.moveTo(-sW / 2, 0);
      shape.lineTo(sW / 2, 0);
      shape.lineTo(0, sH);
      shape.closePath();

      const prism = new THREE.ExtrudeGeometry(shape, { depth: sL * 0.96, bevelEnabled: false });
      prism.center();
      prism.translate(0, curbH + sH / 2, 0);
      parts.push(prism);
      break;
    }

    case 'chimney': {
      // Brick chimney stack with stone cap and flue pots
      const cW = 0.7 * scale;
      const cH = 1.8 * scale;
      const cD = 0.7 * scale;

      const stack = new THREE.BoxGeometry(cW, cH, cD);
      stack.translate(0, cH / 2, 0);
      parts.push(stack);

      // Stone crown
      const cap = new THREE.BoxGeometry(cW * 1.2, 0.1 * scale, cD * 1.2);
      cap.translate(0, cH + 0.05 * scale, 0);
      parts.push(cap);

      // Clay flue pot
      const potR = 0.12 * scale;
      const potH = 0.35 * scale;
      const pot = new THREE.CylinderGeometry(potR * 0.85, potR, potH, 12);
      pot.translate(0, cH + 0.1 * scale + potH / 2, 0);
      parts.push(pot);
      break;
    }
  }

  return mergeBufferGeometries(parts);
}
