import * as THREE from 'three';

// ── Canvas-based texture generator for building-specific materials ────
// All textures are generated at runtime via canvas — no external files.

export class BuildingTextureBuilder {
  private readonly _cache = new Map<string, THREE.CanvasTexture>();

  private getOrCreate(key: string, generator: () => HTMLCanvasElement): THREE.CanvasTexture {
    let tex = this._cache.get(key);
    if (!tex) {
      const canvas = generator();
      tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      this._cache.set(key, tex);
    }
    return tex;
  }

  // ── Limestone (classic warm beige stone) ──────────────────────────

  createLimestone(size = 256): THREE.CanvasTexture {
    return this.getOrCreate(`limestone_${size}`, () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#d4c5a0';
      ctx.fillRect(0, 0, size, size);

      // Stone block pattern
      const blockH = size / 6;
      const blockW = size / 3;
      for (let row = 0; row < 6; row++) {
        const offset = row % 2 === 0 ? 0 : blockW / 2;
        for (let col = -1; col < 4; col++) {
          const x = col * blockW + offset;
          const y = row * blockH;
          // Mortar line
          ctx.strokeStyle = '#b0a080';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, blockW, blockH);
          // Stone face with slight color variation
          const v = Math.random() * 20 - 10;
          ctx.fillStyle = `rgb(${212 + v},${197 + v},${160 + v})`;
          ctx.fillRect(x + 2, y + 2, blockW - 4, blockH - 4);
        }
      }
      return canvas;
    });
  }

  // ── Metal panel (corrugated or smooth metal cladding) ─────────────

  createMetalPanel(size = 256, tint = 0x888888): THREE.CanvasTexture {
    return this.getOrCreate(`metal_${size}_${tint.toString(16)}`, () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      const r = (tint >> 16) & 0xff;
      const g = (tint >> 8) & 0xff;
      const b = tint & 0xff;

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(0, 0, size, size);

      // Horizontal corrugation lines
      const stripeH = size / 16;
      for (let i = 0; i < 16; i++) {
        const y = i * stripeH;
        ctx.fillStyle = `rgb(${Math.max(0, r - 20)},${Math.max(0, g - 20)},${Math.max(0, b - 20)})`;
        ctx.fillRect(0, y, size, 1);
        // Highlight on top edge
        ctx.fillStyle = `rgb(${Math.min(255, r + 20)},${Math.min(255, g + 20)},${Math.min(255, b + 20)})`;
        ctx.fillRect(0, y, size, 1);
      }
      return canvas;
    });
  }

  // ── Tinted/dark glass (smoky mirror, brown, green-tinted) ─────────

  createTintedGlass(size = 256, baseColor = '#3a3a3a'): THREE.CanvasTexture {
    return this.getOrCreate(`tintedGlass_${size}_${baseColor.slice(1)}`, () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, baseColor);
      grad.addColorStop(0.5, lighten(baseColor, 0.15));
      grad.addColorStop(1, darken(baseColor, 0.1));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      // Reflection streaks
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 5; i++) {
        const x = Math.random() * size;
        const w = 3 + Math.random() * 15;
        ctx.fillRect(x, 0, w, size);
      }
      ctx.globalAlpha = 1.0;

      // Window grid
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      const gridSize = size / 6;
      for (let i = 1; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(i * gridSize, 0);
        ctx.lineTo(i * gridSize, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * gridSize);
        ctx.lineTo(size, i * gridSize);
        ctx.stroke();
      }
      return canvas;
    });
  }

  // ── EIFS (Exterior Insulation Finish System — stucco-like) ────────

  createEIFS(size = 256, color = '#c8b89a'): THREE.CanvasTexture {
    return this.getOrCreate(`eifs_${size}_${color.slice(1)}`, () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = color;
      ctx.fillRect(0, 0, size, size);

      // Stucco texture noise
      const imageData = ctx.getImageData(0, 0, size, size);
      for (let i = 0; i < imageData.data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 15;
        imageData.data[i] = clamp(imageData.data[i] + noise);
        imageData.data[i + 1] = clamp(imageData.data[i + 1] + noise);
        imageData.data[i + 2] = clamp(imageData.data[i + 2] + noise);
      }
      ctx.putImageData(imageData, 0, 0);
      return canvas;
    });
  }

  // ── Green roof (grass/vegetation layer) ───────────────────────────

  createGreenRoof(size = 256): THREE.CanvasTexture {
    return this.getOrCreate(`greenRoof_${size}`, () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#2d5a1e';
      ctx.fillRect(0, 0, size, size);

      // Grass tufts and vegetation patches
      for (let i = 0; i < 300; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const s = 1 + Math.random() * 3;
        const shade = Math.random();
        ctx.fillStyle = shade > 0.5
          ? `rgba(45,${100 + Math.random() * 60},30,0.7)`
          : `rgba(30,${80 + Math.random() * 40},20,0.6)`;
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.fill();
      }
      return canvas;
    });
  }

  // ── Solar panel surface ───────────────────────────────────────────

  createSolarPanel(size = 256): THREE.CanvasTexture {
    return this.getOrCreate(`solar_${size}`, () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#1a237e';
      ctx.fillRect(0, 0, size, size);

      // Cell grid
      const cellSize = size / 6;
      ctx.strokeStyle = '#4a5568';
      ctx.lineWidth = 2;
      for (let row = 0; row <= 6; row++) {
        ctx.beginPath();
        ctx.moveTo(0, row * cellSize);
        ctx.lineTo(size, row * cellSize);
        ctx.stroke();
      }
      for (let col = 0; col <= 6; col++) {
        ctx.beginPath();
        ctx.moveTo(col * cellSize, 0);
        ctx.lineTo(col * cellSize, size);
        ctx.stroke();
      }

      // Subtle blue sheen
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#4fc3f7';
      ctx.fillRect(0, 0, size, size);
      ctx.globalAlpha = 1.0;
      return canvas;
    });
  }

  // ── LED accent strip glow ────────────────────────────────────────

  createLEDAccent(size = 256, color = '#00ff88'): THREE.CanvasTexture {
    return this.getOrCreate(`led_${size}_${color.slice(1)}`, () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = color;
      ctx.fillRect(0, 0, size, size);

      // Glow gradient
      const grad = ctx.createLinearGradient(0, 0, 0, size);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(0.3, color);
      grad.addColorStop(0.7, color);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(0, 0, size, size);
      ctx.globalAlpha = 1.0;
      return canvas;
    });
  }
}

// ── Merged geometry helper ──────────────────────────────────────────
// Combines multiple geometries into one, optionally transforming each
// by a matrix so they can be positioned independently before merge.

export function mergeGeometries(
  geometries: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[],
): THREE.BufferGeometry {
  if (geometries.length === 0) {
    return new THREE.BufferGeometry();
  }
  if (geometries.length === 1) {
    return geometries[0].geo.clone();
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  let indexOffset = 0;

  for (const { geo, matrix } of geometries) {
    const posAttr = geo.getAttribute('position');
    const normAttr = geo.getAttribute('normal');
    const uvAttr = geo.getAttribute('uv');
    const idxAttr = geo.getIndex();

    const tmpVec = new THREE.Vector3();
    const tmpNorm = new THREE.Vector3();
    const tmpMat = new THREE.Matrix3().getNormalMatrix(matrix);

    for (let i = 0; i < posAttr.count; i++) {
      tmpVec.fromBufferAttribute(posAttr, i).applyMatrix4(matrix);
      positions.push(tmpVec.x, tmpVec.y, tmpVec.z);

      if (normAttr) {
        tmpNorm.fromBufferAttribute(normAttr, i).applyMatrix3(tmpMat).normalize();
        normals.push(tmpNorm.x, tmpNorm.y, tmpNorm.z);
      }

      if (uvAttr) {
        uvs.push(uvAttr.getX(i), uvAttr.getY(i));
      }
    }

    if (idxAttr) {
      for (let i = 0; i < idxAttr.count; i++) {
        indices.push(idxAttr.array[i] + indexOffset);
      }
    } else {
      for (let i = 0; i < posAttr.count; i++) {
        indices.push(indexOffset + i);
      }
    }

    indexOffset += posAttr.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length > 0) {
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  } else {
    merged.computeVertexNormals();
  }
  if (uvs.length > 0) {
    merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  }
  merged.setIndex(indices);
  return merged;
}

// ── Reusable facade builder ─────────────────────────────────────────

/**
 * Build a multi-story facade with window openings.
 * Returns an array of { geo, matrix } for merging, plus
 * separate arrays for windows, cornices, etc.
 */
export function buildFacade({
  width = 8,
  height = 12,
  depth = 0.4,
  floors = 3,
  windowCols = 4,
  windowWidth = 1.2,
  windowHeight = 1.8,
  sillHeight = 0.8,
}: {
  width?: number;
  height?: number;
  depth?: number;
  floors?: number;
  windowCols?: number;
  windowWidth?: number;
  windowHeight?: number;
  sillHeight?: number;
}): {
  wallParts: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[];
  windowMeshes: THREE.Mesh[];
  mullions: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[];
} {
  const wallParts: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
  const mullions: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
  const windowMeshes: THREE.Mesh[] = [];

  const floorHeight = height / floors;

  for (let row = 0; row < floors; row++) {
    const yBase = row * floorHeight;
    const xSpacing = width / windowCols;

    // Solid wall above windows on each floor
    const aboveWinH = floorHeight - sillHeight - windowHeight;
    if (aboveWinH > 0.05) {
      wallParts.push({
        geo: new THREE.BoxGeometry(width, aboveWinH, depth),
        matrix: new THREE.Matrix4().makeTranslation(0, yBase + sillHeight + windowHeight + aboveWinH / 2, 0),
      });
    }

    // Side walls beside windows
    const totalWindowW = windowWidth * windowCols;
    const sideWallW = (width - totalWindowW) / 2;

    if (sideWallW > 0.05) {
      // Left side wall
      wallParts.push({
        geo: new THREE.BoxGeometry(sideWallW, floorHeight, depth),
        matrix: new THREE.Matrix4().makeTranslation(
          -width / 2 + sideWallW / 2,
          yBase + floorHeight / 2,
          0,
        ),
      });
      // Right side wall
      wallParts.push({
        geo: new THREE.BoxGeometry(sideWallW, floorHeight, depth),
        matrix: new THREE.Matrix4().makeTranslation(
          width / 2 - sideWallW / 2,
          yBase + floorHeight / 2,
          0,
        ),
      });
    }

    // Mullion between windows (horizontal strip below window)
    const mullionGeo = new THREE.BoxGeometry(totalWindowW, 0.08, depth);
    mullions.push({
      geo: mullionGeo,
      matrix: new THREE.Matrix4().makeTranslation(0, yBase + sillHeight - 0.04, 0),
    });

    // Vertical mullions between each window column
    for (let col = 1; col < windowCols; col++) {
      const mx = -width / 2 + col * xSpacing;
      mullions.push({
        geo: new THREE.BoxGeometry(0.08, floorHeight - sillHeight, depth),
        matrix: new THREE.Matrix4().makeTranslation(mx, yBase + sillHeight + (floorHeight - sillHeight) / 2, 0),
      });
    }

    // Store window mesh references (filled in by caller with glass material)
    for (let col = 0; col < windowCols; col++) {
      const wx = -width / 2 + xSpacing / 2 + col * xSpacing;
      windowMeshes.push(
        new THREE.Mesh(
          new THREE.BoxGeometry(windowWidth, windowHeight, depth * 0.8),
          null as unknown as THREE.Material,
        ),
      );
      windowMeshes[windowMeshes.length - 1].position.set(wx, yBase + sillHeight + windowHeight / 2, 0);
    }
  }

  // Bottom strip below first sill
  if (sillHeight > 0.05) {
    wallParts.push({
      geo: new THREE.BoxGeometry(width, sillHeight, depth),
      matrix: new THREE.Matrix4().makeTranslation(0, sillHeight / 2, 0),
    });
  }

  return { wallParts, windowMeshes, mullions };
}

// ── Cornice builder ─────────────────────────────────────────────────

export function buildCornice({
  width,
  depth,
  style = 'classical',
}: {
  width: number;
  depth: number;
  style?: 'classical' | 'modern' | 'artdeco';
}): { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] {
  const parts: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];

  if (style === 'classical') {
    // Stepped cornice: three tiers getting narrower toward top
    const tiers = [
      { w: width + 0.6, d: depth + 0.3, h: 0.3 },
      { w: width + 0.3, d: depth + 0.15, h: 0.25 },
      { w: width + 0.1, d: depth, h: 0.2 },
    ];
    let y = 0;
    for (const t of tiers) {
      parts.push({
        geo: new THREE.BoxGeometry(t.w, t.h, t.d),
        matrix: new THREE.Matrix4().makeTranslation(0, y + t.h / 2, 0),
      });
      y += t.h;
    }
  } else if (style === 'modern') {
    // Simple flat overhang
    parts.push({
      geo: new THREE.BoxGeometry(width + 0.4, 0.2, depth + 0.3),
      matrix: new THREE.Matrix4().makeTranslation(0, 0.1, 0),
    });
  } else {
    // Art deco: stepped zigzag
    const steps = 4;
    const stepH = 0.15;
    const stepD = depth * 0.3;
    for (let i = 0; i < steps; i++) {
      const inset = i * 0.15;
      parts.push({
        geo: new THREE.BoxGeometry(width - inset * 2, stepH, depth - stepD * i),
        matrix: new THREE.Matrix4().makeTranslation(0, (i + 1) * stepH, 0),
      });
    }
  }

  return parts;
}

// ── Bay window builder ──────────────────────────────────────────────

export function buildBayWindow({
  width = 2,
  depth = 1,
  height = 2,
}: {
  width?: number;
  depth?: number;
  height?: number;
}): THREE.Group {
  const group = new THREE.Group();

  // Projecting bay box
  const bayGeo = new THREE.BoxGeometry(width, height, depth);
  const bayMesh = new THREE.Mesh(bayGeo);
  bayMesh.position.set(0, height / 2, depth / 2);
  group.add(bayMesh);

  // Small roof over bay
  const roofGeo = new THREE.ConeGeometry(Math.sqrt(width * width + depth * depth) * 0.6, 0.5, 4);
  const roofMesh = new THREE.Mesh(roofGeo);
  roofMesh.position.set(0, height + 0.25, depth / 2);
  roofMesh.rotation.y = Math.PI / 4;
  group.add(roofMesh);

  return group;
}

// ── Fire escape builder ─────────────────────────────────────────────

export function buildFireEscape({
  width = 3,
  depth = 0.6,
  floors = 3,
  floorHeight = 4,
}: {
  width?: number;
  depth?: number;
  floors?: number;
  floorHeight?: number;
}): THREE.Group {
  const group = new THREE.Group();

  // Landing platforms per floor
  for (let f = 0; f < floors; f++) {
    const y = f * floorHeight + 1;
    const platformGeo = new THREE.BoxGeometry(width, 0.1, depth);
    const platform = new THREE.Mesh(platformGeo);
    platform.position.set(0, y, 0);
    group.add(platform);

    // Railing posts
    const postGeo = new THREE.BoxGeometry(0.06, 1, 0.06);
    for (let px = -width / 2; px <= width / 2; px += width / 3) {
      const post = new THREE.Mesh(postGeo);
      post.position.set(px, y + 0.55, depth / 2);
      group.add(post);
    }
    // Top rail
    const railGeo = new THREE.BoxGeometry(width, 0.06, 0.06);
    const rail = new THREE.Mesh(railGeo);
    rail.position.set(0, y + 1.05, depth / 2);
    group.add(rail);

    // Ladder to next floor
    if (f < floors - 1) {
      const ladderY = y + floorHeight / 2;
      const ladderGeo = new THREE.BoxGeometry(0.08, floorHeight, 0.08);
      const leftRail = new THREE.Mesh(ladderGeo);
      leftRail.position.set(-width / 4, ladderY, 0);
      group.add(leftRail);
      const rightRail = new THREE.Mesh(ladderGeo);
      rightRail.position.set(width / 4, ladderY, 0);
      group.add(rightRail);

      // Steps
      const stepCount = 4;
      for (let s = 0; s <= stepCount; s++) {
        const sy = y + (s / stepCount) * floorHeight;
        const stepGeo = new THREE.BoxGeometry(width / 2, 0.05, 0.3);
        const step = new THREE.Mesh(stepGeo);
        step.position.set(0, sy, depth / 2);
        group.add(step);
      }
    }
  }

  return group;
}

// ── Storefront builder (ground-floor retail) ────────────────────────

export function buildStorefront({
  width = 8,
  height = 4,
  glassHeight = 3,
}: {
  width?: number;
  height?: number;
  glassHeight?: number;
}): {
  solidParts: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[];
  glassPanels: THREE.Mesh[];
} {
  const solidParts: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
  const glassPanels: THREE.Mesh[] = [];

  const transomH = height - glassHeight;

  // Transom (solid band above storefront glass)
  if (transomH > 0.05) {
    solidParts.push({
      geo: new THREE.BoxGeometry(width, transomH, 0.3),
      matrix: new THREE.Matrix4().makeTranslation(0, glassHeight + transomH / 2, 0),
    });
  }

  // Solid sides
  const awningWidth = 0.8;
  solidParts.push({
    geo: new THREE.BoxGeometry(awningWidth, height, 0.3),
    matrix: new THREE.Matrix4().makeTranslation(-width / 2 + awningWidth / 2, height / 2, 0),
  });
  solidParts.push({
    geo: new THREE.BoxGeometry(awningWidth, height, 0.3),
    matrix: new THREE.Matrix4().makeTranslation(width / 2 - awningWidth / 2, height / 2, 0),
  });

  // Glass panels (two large panes)
  const paneW = (width - awningWidth * 2) / 2;
  for (let i = 0; i < 2; i++) {
    const paneGeo = new THREE.BoxGeometry(paneW - 0.1, glassHeight - 0.1, 0.15);
    const pane = new THREE.Mesh(paneGeo);
    pane.position.set(
      -width / 2 + awningWidth + paneW / 2 + i * paneW,
      glassHeight / 2,
      0.1,
    );
    glassPanels.push(pane);
  }

  return { solidParts, glassPanels };
}

// ── Rooftop: water tower ────────────────────────────────────────────

export function buildWaterTower({
  tankRadius = 1.2,
  tankHeight = 1.8,
  legHeight = 2.5,
}: {
  tankRadius?: number;
  tankHeight?: number;
  legHeight?: number;
}): THREE.Group {
  const group = new THREE.Group();

  // Tank body
  const tankGeo = new THREE.CylinderGeometry(tankRadius, tankRadius, tankHeight, 16);
  const tank = new THREE.Mesh(tankGeo);
  tank.position.y = legHeight + tankHeight / 2;
  group.add(tank);

  // Tank dome
  const domeGeo = new THREE.SphereGeometry(tankRadius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = new THREE.Mesh(domeGeo);
  dome.position.y = legHeight + tankHeight;
  group.add(dome);

  // Legs (4 legs)
  const legGeo = new THREE.CylinderGeometry(0.06, 0.06, legHeight, 6);
  const legPositions = [
    [-tankRadius * 0.6, -tankRadius * 0.6],
    [tankRadius * 0.6, -tankRadius * 0.6],
    [-tankRadius * 0.6, tankRadius * 0.6],
    [tankRadius * 0.6, tankRadius * 0.6],
  ];
  for (const [lx, lz] of legPositions) {
    const leg = new THREE.Mesh(legGeo);
    leg.position.set(lx, legHeight / 2, lz);
    group.add(leg);
  }

  // Ladder on side
  const ladderGeo = new THREE.CylinderGeometry(0.03, 0.03, legHeight, 4);
  const ladder = new THREE.Mesh(ladderGeo);
  ladder.position.set(tankRadius + 0.1, legHeight / 2, 0);
  group.add(ladder);

  return group;
}

// ── Rooftop: TV antenna ─────────────────────────────────────────────

export function buildTVAntenna({
  height = 4,
  elements = 5,
}: {
  height?: number;
  elements?: number;
}): THREE.Group {
  const group = new THREE.Group();

  // Mast
  const mastGeo = new THREE.CylinderGeometry(0.04, 0.06, height, 6);
  const mast = new THREE.Mesh(mastGeo);
  mast.position.y = height / 2;
  group.add(mast);

  // Yagi elements
  for (let i = 0; i < elements; i++) {
    const elemH = 0.3 + (elements - i) * 0.15;
    const elemGeo = new THREE.CylinderGeometry(0.02, 0.02, elemH, 4);
    const elem = new THREE.Mesh(elemGeo);
    elem.position.set(0, height * 0.4 + i * 0.4, 0);
    elem.rotation.z = Math.PI / 2;
    group.add(elem);
  }

  // Cross arm
  const armGeo = new THREE.CylinderGeometry(0.02, 0.02, elements * 0.6, 4);
  const arm = new THREE.Mesh(armGeo);
  arm.position.set(0, height * 0.4, 0);
  arm.rotation.x = Math.PI / 2;
  group.add(arm);

  return group;
}

// ── Rooftop: satellite dish ─────────────────────────────────────────

export function buildSatelliteDish({
  diameter = 1.0,
}: {
  diameter?: number;
}): THREE.Group {
  const group = new THREE.Group();

  // Dish (half sphere)
  const dishGeo = new THREE.SphereGeometry(diameter / 2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const dish = new THREE.Mesh(dishGeo);
  dish.rotation.x = -Math.PI / 6; // tilt up
  dish.position.y = 0;
  group.add(dish);

  // Feed arm
  const armGeo = new THREE.CylinderGeometry(0.015, 0.015, diameter * 0.6, 4);
  const arm = new THREE.Mesh(armGeo);
  arm.position.set(0, diameter * 0.25, diameter * 0.15);
  arm.rotation.x = -Math.PI / 6;
  group.add(arm);

  // Feed tip
  const tipGeo = new THREE.SphereGeometry(0.04, 6, 6);
  const tip = new THREE.Mesh(tipGeo);
  tip.position.set(0, diameter * 0.45, diameter * 0.25);
  group.add(tip);

  // Mount pole
  const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6);
  const pole = new THREE.Mesh(poleGeo);
  pole.position.y = -0.4;
  group.add(pole);

  return group;
}

// ── Rooftop: AC unit ────────────────────────────────────────────────

export function buildACUnit({
  width = 1.0,
  depth = 1.0,
  height = 0.8,
}: {
  width?: number;
  depth?: number;
  height?: number;
}): THREE.Group {
  const group = new THREE.Group();

  // Housing
  const housingGeo = new THREE.BoxGeometry(width, height, depth);
  const housing = new THREE.Mesh(housingGeo);
  group.add(housing);

  // Fan grille (top)
  const fanGeo = new THREE.CylinderGeometry(width * 0.35, width * 0.35, 0.05, 12);
  const fan = new THREE.Mesh(fanGeo);
  fan.position.y = height / 2 + 0.025;
  group.add(fan);

  // Vents on sides
  const ventGeo = new THREE.BoxGeometry(0.05, height * 0.6, depth * 0.7);
  const vent = new THREE.Mesh(ventGeo);
  vent.position.set(width / 2 + 0.025, 0, 0);
  group.add(vent);

  return group;
}

// ── Rooftop: AC bank (multiple units) ───────────────────────────────

export function buildACBank({
  count = 3,
  unitWidth = 1.2,
  unitDepth = 1.0,
  unitHeight = 0.8,
  spacing = 0.3,
}: {
  count?: number;
  unitWidth?: number;
  unitDepth?: number;
  unitHeight?: number;
  spacing?: number;
}): THREE.Group {
  const group = new THREE.Group();

  for (let i = 0; i < count; i++) {
    const unit = buildACUnit({ width: unitWidth, depth: unitDepth, height: unitHeight });
    unit.position.set((i - (count - 1) / 2) * (unitWidth + spacing), 0, 0);
    group.add(unit);
  }

  return group;
}

// ── Rooftop: solar panel array ──────────────────────────────────────

export function buildSolarArray({
  panels = 4,
  panelW = 1.6,
  panelH = 1.0,
  tilt = 20,
}: {
  panels?: number;
  panelW?: number;
  panelH?: number;
  tilt?: number;
}): THREE.Group {
  const group = new THREE.Group();

  const tiltRad = (tilt * Math.PI) / 180;

  for (let i = 0; i < panels; i++) {
    const panelGroup = new THREE.Group();

    // Panel surface
    const surfGeo = new THREE.BoxGeometry(panelW, 0.05, panelH);
    const surf = new THREE.Mesh(surfGeo);
    panelGroup.add(surf);

    // Frame edges
    const frameGeoH = new THREE.BoxGeometry(panelW + 0.06, 0.04, 0.04);
    const frameTop = new THREE.Mesh(frameGeoH);
    frameTop.position.set(0, 0.02, panelH / 2 + 0.01);
    panelGroup.add(frameTop);
    const frameBot = new THREE.Mesh(frameGeoH);
    frameBot.position.set(0, 0.02, -panelH / 2 - 0.01);
    panelGroup.add(frameBot);

    // Support legs
    const legGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4);
    const legFront = new THREE.Mesh(legGeo);
    legFront.position.set(0, -0.15, panelH / 2 - 0.1);
    panelGroup.add(legFront);
    const legBack = new THREE.Mesh(legGeo);
    legBack.position.set(0, -0.15, -panelH / 2 + 0.1);
    panelGroup.add(legBack);

    // Tilt the whole panel
    panelGroup.rotation.x = -tiltRad;
    panelGroup.position.set((i - (panels - 1) / 2) * (panelW + 0.2), 0.3, 0);
    group.add(panelGroup);
  }

  return group;
}

// ── Rooftop: green roof ─────────────────────────────────────────────

export function buildGreenRoof({
  width = 8,
  depth = 6,
}: {
  width?: number;
  depth?: number;
}): THREE.Group {
  const group = new THREE.Group();

  // Soil/base layer
  const soilGeo = new THREE.BoxGeometry(width, 0.3, depth);
  const soil = new THREE.Mesh(soilGeo);
  soil.position.y = 0.15;
  group.add(soil);

  // Vegetation clusters (low bushes/plants)
  const bushCount = 12;
  for (let i = 0; i < bushCount; i++) {
    const bx = (Math.random() - 0.5) * (width - 1);
    const bz = (Math.random() - 0.5) * (depth - 1);
    const br = 0.3 + Math.random() * 0.5;
    const bushGeo = new THREE.SphereGeometry(br, 8, 6);
    const bush = new THREE.Mesh(bushGeo);
    bush.position.set(bx, 0.3 + br * 0.6, bz);
    group.add(bush);
  }

  // Small trees
  const treeCount = 2;
  for (let i = 0; i < treeCount; i++) {
    const tx = (Math.random() - 0.5) * (width - 2);
    const tz = (Math.random() - 0.5) * (depth - 2);
    const trunkGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.5, 6);
    const trunk = new THREE.Mesh(trunkGeo);
    trunk.position.set(tx, 1.05, tz);
    group.add(trunk);

    const canopyGeo = new THREE.SphereGeometry(0.8, 8, 6);
    const canopy = new THREE.Mesh(canopyGeo);
    canopy.position.set(tx, 2.1, tz);
    group.add(canopy);
  }

  return group;
}

// ── Chimney builder ─────────────────────────────────────────────────

export function buildChimney({
  width = 0.6,
  depth = 0.6,
  height = 2,
}: {
  width?: number;
  depth?: number;
  height?: number;
}): THREE.Group {
  const group = new THREE.Group();

  const chimneyGeo = new THREE.BoxGeometry(width, height, depth);
  const chimney = new THREE.Mesh(chimneyGeo);
  chimney.position.y = height / 2;
  group.add(chimney);

  // Clay pot on top
  const potGeo = new THREE.CylinderGeometry(width * 0.45, width * 0.5, 0.4, 8);
  const pot = new THREE.Mesh(potGeo);
  pot.position.y = height + 0.2;
  group.add(pot);

  return group;
}

// ── Helipad (for modern towers) ─────────────────────────────────────

export function buildHelipad({
  diameter = 5,
}: {
  diameter?: number;
}): THREE.Group {
  const group = new THREE.Group();

  // Pad surface
  const padGeo = new THREE.CylinderGeometry(diameter / 2, diameter / 2, 0.1, 32);
  const pad = new THREE.Mesh(padGeo);
  group.add(pad);

  // H circle
  const ringGeo = new THREE.TorusGeometry(diameter / 3, 0.05, 8, 32);
  const ring = new THREE.Mesh(ringGeo);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.06;
  group.add(ring);

  // Edge markers
  const markerCount = 8;
  const markerGeo = new THREE.BoxGeometry(0.2, 0.1, 0.2);
  for (let i = 0; i < markerCount; i++) {
    const angle = (i / markerCount) * Math.PI * 2;
    const marker = new THREE.Mesh(markerGeo);
    marker.position.set(
      Math.cos(angle) * (diameter / 2 - 0.3),
      0.05,
      Math.sin(angle) * (diameter / 2 - 0.3),
    );
    group.add(marker);
  }

  return group;
}

// ── Light helpers ───────────────────────────────────────────────────

function lighten(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${clamp(r + Math.round(amount * (255 - r)))},${clamp(g + Math.round(amount * (255 - g)))},${clamp(b + Math.round(amount * (255 - b)))})`;
}

function darken(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${clamp(Math.round(r * (1 - amount)))},${clamp(Math.round(g * (1 - amount)))},${clamp(Math.round(b * (1 - amount)))})`;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}
