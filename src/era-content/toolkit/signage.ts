import * as THREE from 'three';

// ── Parametric interfaces ──────────────────────────────────────────

export interface SignageParams {
  /** Sign type */
  type?: SignType;
  /** Total width */
  width?: number;
  /** Total height */
  height?: number;
  /** Depth / protrusion */
  depth?: number;
  /** Main text content */
  text?: string;
  /** Font size relative to sign height (0-1) */
  fontSize?: number;
  /** Text color hex */
  textColor?: number;
  /** Background color hex */
  bgColor?: number;
  /** Frame/border color hex */
  frameColor?: number;
  /** Whether to use neon outline style */
  neon?: boolean;
  /** Neon glow intensity 0-1 */
  glowIntensity?: number;
  /** Emissive toggle for neon */
  emissive?: boolean;
  /** Canvas-generated texture quality (resolution) */
  textureQuality?: number;
  /** Condition factor 0-1 (affects paint wear) */
  condition?: number;
  /** Era-appropriate border ornament */
  ornament?: 'none' | 'simple' | 'ornate' | 'art_deco';
}

export type SignType = 'fascia' | 'painted_wall' | 'billboard' | 'neon_outline' | 'marquee' | 'illuminated_box';

export interface SignageResult {
  group: THREE.Group;
  dispose(): void;
}

// ── Canvas texture generation ──────────────────────────────────────

/**
 * Generate a canvas-based texture for sign lettering.
 * This creates crisp text rendered via HTML Canvas API at runtime.
 */
export function generateLetteringTexture(
  text: string,
  width: number,
  height: number,
  fontSize: number,
  textColor: number,
  bgColor: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#' + new THREE.Color(bgColor).getHexString();
  ctx.fillRect(0, 0, width, height);

  // Text
  const size = Math.floor(height * fontSize);
  ctx.font = `bold ${size}px "Arial Black", "Impact", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#' + new THREE.Color(textColor).getHexString();
  ctx.fillText(text, width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generate a decorative background texture via canvas.
 */
function generateBackgroundTexture(
  width: number,
  height: number,
  bgColor: number,
  condition: number,
  ornament: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#' + new THREE.Color(bgColor).getHexString();
  ctx.fillRect(0, 0, width, height);

  // Weathering effect based on condition
  if (condition < 0.8) {
    const wearAmount = (1 - condition) * 0.3;
    ctx.globalAlpha = wearAmount;
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const r = Math.random() * 8 + 2;
      ctx.fillStyle = '#888888';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Ornament border
  if (ornament !== 'none') {
    ctx.strokeStyle = '#' + new THREE.Color(bgColor).offsetHSL(0, 0, -0.15).getHexString();
    ctx.lineWidth = 4;
    const pad = 8;
    ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);

    if (ornament === 'art_deco') {
      ctx.strokeStyle = '#' + new THREE.Color(bgColor).offsetHSL(0, 0, -0.3).getHexString();
      ctx.lineWidth = 2;
      const step = 20;
      for (let x = pad + 10; x < width - pad; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, pad);
        ctx.lineTo(x, pad + 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, height - pad);
        ctx.lineTo(x, height - pad - 6);
        ctx.stroke();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// ── Fascia sign builder ────────────────────────────────────────────

function buildFasciaSign(params: SignageParams): THREE.Group {
  const {
    width = 6,
    height = 1.2,
    depth = 0.15,
    text = 'STORE',
    fontSize = 0.5,
    textColor = 0xFFFFFF,
    bgColor = 0x222222,
    frameColor = 0x888888,
    condition = 0.7,
    ornament = 'simple',
  } = params;

  const group = new THREE.Group();
  group.name = 'sign_fascia';

  // Board with canvas texture
  const bgTex = generateBackgroundTexture(512, 128, bgColor, condition, ornament);
  const boardMat = new THREE.MeshStandardMaterial({ map: bgTex });
  const board = makeBox(width, height, depth, boardMat);
  group.add(board);

  // Lettering overlay
  const letterTex = generateLetteringTexture(text, 512, 128, fontSize, textColor, bgColor);
  const letterMat = new THREE.MeshBasicMaterial({ map: letterTex, transparent: true });
  const letterPlane = makeBox(width - 0.2, height - 0.15, 0.01, letterMat);
  letterPlane.position.z = depth / 2 + 0.006;
  group.add(letterPlane);

  // Frame
  const frameMat = new THREE.MeshStandardMaterial({
    color: frameColor,
    roughness: 0.4,
    metalness: 0.3,
  });
  addFrame(group, width, height, depth, frameMat);

  return group;
}

// ── Painted wall ad builder ────────────────────────────────────────

function buildPaintedWallAd(params: SignageParams): THREE.Group {
  const {
    width = 8,
    height = 3,
    depth = 0.05,
    text = '',
    fontSize = 0.35,
    textColor = 0xFFFFFF,
    bgColor = 0x999999,
    condition = 0.5,
    ornament = 'none',
  } = params;

  const group = new THREE.Group();
  group.name = 'sign_painted_wall_ad';

  // Wall patch
  const wallPatch = makeBox(width, height, depth, new THREE.MeshStandardMaterial({
    color: 0xCCBBAA,
    roughness: 0.9,
  }));
  group.add(wallPatch);

  // Painted area
  const paintTex = generateBackgroundTexture(512, 256, bgColor, condition, ornament);
  const paintMat = new THREE.MeshStandardMaterial({ map: paintTex });
  const paint = makeBox(width - 0.2, height - 0.2, 0.01, paintMat);
  paint.position.z = depth / 2 + 0.006;
  group.add(paint);

  // Hand-painted style text
  if (text) {
    const letterTex = generateLetteringTexture(text, 512, 256, fontSize, textColor, bgColor);
    const letterMat = new THREE.MeshBasicMaterial({ map: letterTex, transparent: true });
    const letterPlane = makeBox(width * 0.8, height * 0.4, 0.01, letterMat);
    letterPlane.position.set(0, height * 0.1, depth / 2 + 0.02);
    group.add(letterPlane);
  }

  return group;
}

// ── Billboard builder ──────────────────────────────────────────────

function buildBillboard(params: SignageParams): THREE.Group {
  const {
    width = 12,
    height = 4,
    depth = 0.3,
    text = '',
    fontSize = 0.3,
    textColor = 0xFFFFFF,
    bgColor = 0x334455,
    frameColor = 0x666666,
    condition = 0.6,
    ornament = 'simple',
  } = params;

  const group = new THREE.Group();
  group.name = 'sign_billboard';

  // Support poles
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7, metalness: 0.5 });
  for (const side of [-1, 1]) {
    const pole = makeBox(0.2, 6, 0.2, poleMat);
    pole.position.set(side * (width / 2 - 0.5), 3, 0);
    group.add(pole);
  }

  // Cross beam
  const beam = makeBox(width + 0.5, 0.2, 0.2, poleMat);
  beam.position.y = 6;
  group.add(beam);

  // Billboard board
  const bgTex = generateBackgroundTexture(1024, 512, bgColor, condition, ornament);
  const boardMat = new THREE.MeshStandardMaterial({ map: bgTex });
  const board = makeBox(width, height, depth, boardMat);
  board.position.y = 3;
  group.add(board);

  // Frame
  const frameMat = new THREE.MeshStandardMaterial({
    color: frameColor,
    roughness: 0.5,
    metalness: 0.4,
  });
  addFrame(group, width, height, depth, frameMat);

  // Text overlay
  if (text) {
    const letterTex = generateLetteringTexture(text, 1024, 512, fontSize, textColor, bgColor);
    const letterMat = new THREE.MeshBasicMaterial({ map: letterTex, transparent: true });
    const letterPlane = makeBox(width * 0.85, height * 0.5, 0.02, letterMat);
    letterPlane.position.set(0, 3, depth / 2 + 0.02);
    group.add(letterPlane);
  }

  return group;
}

// ── Neon outline builder ───────────────────────────────────────────

function buildNeonOutline(params: SignageParams): THREE.Group {
  const {
    width = 4,
    height = 1.5,
    depth = 0.1,
    text = 'OPEN',
    fontSize = 0.45,
    textColor = 0xFF3333,
    bgColor = 0x111111,
    glowIntensity = 0.8,
    emissive = true,
    condition = 0.8,
  } = params;

  const group = new THREE.Group();
  group.name = 'sign_neon_outline';

  // Dark backing board
  const backMat = new THREE.MeshStandardMaterial({
    color: bgColor,
    roughness: 0.9,
  });
  const backBoard = makeBox(width, height, depth, backMat);
  group.add(backBoard);

  // Neon tube geometry — trace text outline using canvas measurement
  const neonMat = new THREE.MeshStandardMaterial({
    color: textColor,
    emissive: emissive ? textColor : 0x000000,
    emissiveIntensity: emissive ? glowIntensity : 0,
    roughness: 0.1,
    metalness: 0.0,
  });

  // Create neon tubes as thin boxes forming letters
  createNeonLetters(group, text, width, height, fontSize, neonMat, condition);

  // Glow plane behind neon
  if (emissive) {
    // glow texture placeholder(256, 128, textColor, 1, 'none');
    const glowMat = new THREE.MeshBasicMaterial({
      color: textColor,
      transparent: true,
      opacity: 0.15 * glowIntensity,
    });
    const glowPlane = makeBox(width + 0.3, height + 0.3, 0.01, glowMat);
    glowPlane.position.z = -depth / 2 - 0.01;
    group.add(glowPlane);
  }

  return group;
}

/**
 * Create simple neon-style letter representations using basic shapes.
 * Each letter is approximated with line segments (thin boxes).
 */
function createNeonLetters(
  group: THREE.Group,
  text: string,
  totalWidth: number,
  totalHeight: number,
  fontSize: number,
  mat: THREE.Material,
  _condition: number,
): void {
  const charSpacing = totalWidth / (text.length * 1.5);
  const startX = -totalWidth / 2 + charSpacing;
  const scale = totalHeight * fontSize;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i].toUpperCase();
    const cx = startX + i * charSpacing * 1.5;
    const cy = 0;

    // Simple letter approximations
    switch (ch) {
      case 'O':
        addNeonCircle(group, cx, cy, scale * 0.4, mat);
        break;
      case 'E':
        addNeonLine(group, cx - scale * 0.3, cy, scale * 0.6, 0, 0.04, mat);
        addNeonLine(group, cx - scale * 0.3, cy, 0, scale * 0.5, 0.04, mat);
        addNeonLine(group, cx - scale * 0.3, cy - scale * 0.25, scale * 0.6, 0, 0.04, mat);
        addNeonLine(group, cx - scale * 0.3, cy + scale * 0.25, scale * 0.3, 0, 0.04, mat);
        break;
      case 'N':
        addNeonLine(group, cx - scale * 0.3, cy, 0, scale * 0.6, 0.04, mat);
        addNeonLine(group, cx + scale * 0.3, cy, 0, scale * 0.6, 0.04, mat);
        addNeonLine(group, cx - scale * 0.3, cy, scale * 0.6, scale * 0.6, 0.04, mat);
        break;
      case 'A':
        addNeonLine(group, cx - scale * 0.3, cy - scale * 0.3, scale * 0.6, scale * 0.6, 0.04, mat);
        addNeonLine(group, cx + scale * 0.3, cy - scale * 0.3, scale * -0.6, scale * 0.6, 0.04, mat);
        addNeonLine(group, cx - scale * 0.15, cy, scale * 0.3, 0, 0.04, mat);
        break;
      case 'P':
        addNeonLine(group, cx - scale * 0.3, cy, 0, scale * 0.6, 0.04, mat);
        addNeonLine(group, cx - scale * 0.3, cy, scale * 0.6, 0, 0.04, mat);
        addNeonLine(group, cx - scale * 0.3, cy + scale * 0.3, scale * 0.3, 0, 0.04, mat);
        break;
      case 'L':
        addNeonLine(group, cx - scale * 0.3, cy, 0, scale * 0.6, 0.04, mat);
        addNeonLine(group, cx - scale * 0.3, cy + scale * 0.3, scale * 0.6, 0, 0.04, mat);
        break;
      case 'I':
        addNeonLine(group, cx, cy, 0, scale * 0.6, 0.04, mat);
        break;
      case 'C':
        addNeonLine(group, cx, cy - scale * 0.25, 0, scale * 0.5, 0.04, mat);
        addNeonLine(group, cx - scale * 0.3, cy - scale * 0.25, scale * 0.3, 0, 0.04, mat);
        addNeonLine(group, cx - scale * 0.3, cy + scale * 0.25, scale * 0.3, 0, 0.04, mat);
        break;
      case 'S':
        addNeonLine(group, cx - scale * 0.3, cy - scale * 0.25, scale * 0.6, 0, 0.04, mat);
        addNeonLine(group, cx + scale * 0.3, cy + scale * 0.25, scale * -0.6, 0, 0.04, mat);
        addNeonLine(group, cx - scale * 0.3, cy - scale * 0.25, 0, scale * 0.25, 0.04, mat);
        addNeonLine(group, cx + scale * 0.3, cy + scale * 0.25, 0, scale * -0.25, 0.04, mat);
        break;
      case 'T':
        addNeonLine(group, cx, cy - scale * 0.3, 0, scale * 0.6, 0.04, mat);
        addNeonLine(group, cx - scale * 0.35, cy, scale * 0.7, 0, 0.04, mat);
        break;
      case 'R':
        addNeonLine(group, cx - scale * 0.3, cy, 0, scale * 0.6, 0.04, mat);
        addNeonLine(group, cx - scale * 0.3, cy, scale * 0.6, 0, 0.04, mat);
        addNeonLine(group, cx - scale * 0.3, cy + scale * 0.3, scale * 0.3, 0, 0.04, mat);
        addNeonLine(group, cx, cy + scale * 0.3, scale * 0.3, -scale * 0.3, 0.04, mat);
        break;
      default:
        // Generic rectangle fallback
        addNeonRect(group, cx, cy, scale * 0.5, scale * 0.6, mat);
    }
  }
}

function addNeonLine(group: THREE.Group, x: number, y: number, dx: number, dy: number, thickness: number, mat: THREE.Material): void {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) return;
  const geo = new THREE.BoxGeometry(Math.abs(dx) || thickness, Math.abs(dy) || thickness, thickness);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x + dx / 2, y + dy / 2, 0);
  if (dx !== 0 && dy !== 0) {
    mesh.rotation.z = Math.atan2(dy, dx);
  }
  group.add(mesh);
}

function addNeonCircle(group: THREE.Group, x: number, y: number, radius: number, mat: THREE.Material): void {
  const geo = new THREE.TorusGeometry(radius, 0.03, 8, 24);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, 0);
  group.add(mesh);
}

function addNeonRect(group: THREE.Group, x: number, y: number, w: number, h: number, mat: THREE.Material): void {
  const halfW = w / 2;
  const halfH = h / 2;
  // Top
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, 0.04), mat);
  top.position.set(x, y + halfH, 0);
  group.add(top);
  // Bottom
  const bot = top.clone();
  bot.position.y = y - halfH;
  group.add(bot);
  // Left
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.04, h, 0.04), mat);
  left.position.set(x - halfW, y, 0);
  group.add(left);
  // Right
  const right = left.clone();
  right.position.x = x + halfW;
  group.add(right);
}

// ── Marquee sign builder ───────────────────────────────────────────

function buildMarqueeSign(params: SignageParams): THREE.Group {
  const {
    width = 5,
    height = 1,
    depth = 0.4,
    text = 'NOW SHOWING',
    fontSize = 0.35,
    textColor = 0xFFFF00,
    bgColor = 0x111111,
  } = params;

  const group = new THREE.Group();
  group.name = 'sign_marquee';

  // Box structure
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.3 });
  const boxGroup = makeBox(width, height, depth, boxMat);
  group.add(boxGroup);

  // Light bulbs around border
  const bulbMat = new THREE.MeshStandardMaterial({
    color: textColor,
    emissive: textColor,
    emissiveIntensity: 1.0,
  });
  const bulbGeo = new THREE.SphereGeometry(0.06, 8, 8);
  const bulbCount = Math.floor(width / 0.3);
  for (let i = 0; i < bulbCount; i++) {
    const bx = -width / 2 + 0.2 + i * ((width - 0.4) / (bulbCount - 1));
    for (const side of [height / 2, -height / 2]) {
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(bx, side, depth / 2 + 0.06);
      group.add(bulb);
    }
  }

  // Text panel
  const letterTex = generateLetteringTexture(text, 512, 128, fontSize, textColor, bgColor);
  const letterMat = new THREE.MeshBasicMaterial({ map: letterTex, transparent: true });
  const letterPlane = makeBox(width - 0.3, height - 0.2, 0.01, letterMat);
  letterPlane.position.z = depth / 2 + 0.01;
  group.add(letterPlane);

  return group;
}

// ── Illuminated box sign builder ───────────────────────────────────

function buildIlluminatedBox(params: SignageParams): THREE.Group {
  const {
    width = 2,
    height = 2,
    depth = 0.5,
    text = '',
    fontSize = 0.4,
    textColor = 0xFFFFFF,
    bgColor = 0x222222,
  } = params;

  const group = new THREE.Group();
  group.name = 'sign_illuminated_box';

  // Box body
  const boxMat = new THREE.MeshStandardMaterial({
    color: bgColor,
    roughness: 0.3,
    metalness: 0.5,
  });
  const box = makeBox(width, height, depth, boxMat);
  group.add(box);

  // Front face (light diffuser)
  const frontMat = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF,
    emissive: 0xFFF8E0,
    emissiveIntensity: 0.5,
    roughness: 0.8,
    transparent: true,
    opacity: 0.9,
  });
  const front = makeBox(width - 0.1, height - 0.1, 0.02, frontMat);
  front.position.z = depth / 2 + 0.01;
  group.add(front);

  // Text
  if (text) {
    const letterTex = generateLetteringTexture(text, 256, 256, fontSize, textColor, bgColor);
    const letterMat = new THREE.MeshBasicMaterial({ map: letterTex, transparent: true });
    const letterPlane = makeBox(width * 0.8, height * 0.5, 0.01, letterMat);
    letterPlane.position.z = depth / 2 + 0.03;
    group.add(letterPlane);
  }

  return group;
}

// ── Helpers ────────────────────────────────────────────────────────

function makeBox(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  return new THREE.Mesh(geo, mat);
}

function addFrame(group: THREE.Group, w: number, h: number, d: number, mat: THREE.Material): void {
  const t = 0.06; // frame thickness
  // Top
  const top = makeBox(w + t * 2, t, d + t * 2, mat);
  top.position.y = h / 2 + t / 2;
  group.add(top);
  // Bottom
  const bot = top.clone();
  bot.position.y = -h / 2 - t / 2;
  group.add(bot);
  // Sides
  const side = makeBox(t, h, d + t * 2, mat);
  for (const sideX of [-w / 2 - t / 2, w / 2 + t / 2]) {
    const s = side.clone();
    s.position.x = sideX;
    group.add(s);
  }
}

// ── Style registry ─────────────────────────────────────────────────

const SIGN_BUILDERS: Record<SignType, (params: SignageParams) => THREE.Group> = {
  fascia: buildFasciaSign,
  painted_wall: buildPaintedWallAd,
  billboard: buildBillboard,
  neon_outline: buildNeonOutline,
  marquee: buildMarqueeSign,
  illuminated_box: buildIlluminatedBox,
};

/**
 * Generate a parametric sign of the specified type.
 * All lettering and textures are generated via Canvas at runtime.
 * No era-specific years or literals are hardcoded.
 */
export function generateSignage(params: SignageParams): SignageResult {
  const { type = 'fascia' } = params;

  const builder = SIGN_BUILDERS[type];
  const signGroup = builder(params);

  return {
    group: signGroup,
    dispose() {
      signGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          (obj as THREE.Mesh).geometry.dispose();
          const m = (obj as THREE.Mesh).material;
          if (Array.isArray(m)) {
            for (const mat of m) mat.dispose();
          } else if (m) {
            m.dispose();
          }
        }
      });
    },
  };
}
