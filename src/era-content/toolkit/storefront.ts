import * as THREE from 'three';

// ── Parametric interfaces ──────────────────────────────────────────

export interface StorefrontParams {
  /** Total width of the storefront */
  width?: number;
  /** Total height (ground floor) */
  height?: number;
  /** Depth of the structure */
  depth?: number;
  /** Display window ratio 0-1 */
  windowRatio?: number;
  /** Door type */
  doorType?: 'single' | 'double' | 'sliding' | 'revolving';
  /** Kick panel material/style */
  kickPanel?: 'tile' | 'metal' | 'wood' | 'marble';
  /** Awning style (false = none) */
  awning?: AwningStyle | false;
  /** Hanging sign presence */
  hangingSign?: boolean;
  /** Sign text for hanging sign */
  signText?: string;
  /** Material for display case */
  displayCaseMaterial?: 'glass' | 'mirrored' | 'opaque';
  /** Interior lighting color */
  interiorLight?: number;
  /** Condition factor 0-1 */
  condition?: number;
  /** Era-appropriate accent color */
  accentColor?: number;
}

export type AwningStyle = 'canvas' | 'stripes' | 'metal' | 'marquee';

export interface StorefrontResult {
  group: THREE.Group;
  dispose(): void;
}

// ── Helpers ────────────────────────────────────────────────────────

function makeBox(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  return new THREE.Mesh(geo, mat);
}

function hexToThree(hex: number): THREE.Color {
  return new THREE.Color(hex);
}

// ── Materials ──────────────────────────────────────────────────────

function glassMat(condition: number, tint: number = 0xaaddff): THREE.Material {
  const clarity = 0.2 + condition * 0.7;
  return new THREE.MeshPhysicalMaterial({
    color: tint,
    transparent: true,
    opacity: clarity,
    roughness: 0.02,
    metalness: 0.05,
    transmission: 0.6,
    thickness: 0.02,
  });
}

function frameMat(condition: number): THREE.Material {
  const shade = 0.15 + (1 - condition) * 0.1;
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color().setRGB(shade, shade, shade),
    roughness: 0.5,
    metalness: 0.4,
  });
}

function kickPanelMat(type: string, condition: number, accent: number): THREE.Material {
  switch (type) {
    case 'tile':
      return new THREE.MeshStandardMaterial({
        color: hexToThree(accent).multiplyScalar(0.8),
        roughness: 0.3,
        metalness: 0.1,
      });
    case 'metal':
      return new THREE.MeshStandardMaterial({
        color: 0xAAAAAA,
        roughness: 0.2,
        metalness: 0.8,
      });
    case 'wood':
      return new THREE.MeshStandardMaterial({
        color: hexToThree(accent ?? 0x6B4226).multiplyScalar(condition * 0.9 + 0.1),
        roughness: 0.7,
        metalness: 0.0,
      });
    case 'marble':
      return new THREE.MeshStandardMaterial({
        color: 0xDDDDCC,
        roughness: 0.15,
        metalness: 0.05,
      });
    default:
      return new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6 });
  }
}

// ── Door builders ──────────────────────────────────────────────────

function buildSingleDoor(width: number, height: number, condition: number): THREE.Group {
  const g = new THREE.Group();
  const doorW = width * 0.35;
  const doorH = height * 0.7;
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x5C3A1E,
    roughness: 0.6,
    metalness: 0.1,
  });
  const door = makeBox(doorW, doorH, 0.06, doorMat);
  door.position.set(0, doorH / 2, 0);
  g.add(door);
  // Glass pane in door
  const glassPane = makeBox(doorW * 0.6, doorH * 0.5, 0.02, glassMat(condition));
  glassPane.position.set(0, doorH * 0.65, 0.04);
  g.add(glassPane);
  // Handle
  const handleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.15, 8);
  const handle = new THREE.Mesh(handleGeo, frameMat(condition));
  handle.rotation.z = Math.PI / 2;
  handle.position.set(doorW / 2 - 0.08, doorH * 0.45, 0.06);
  g.add(handle);
  return g;
}

function buildDoubleDoor(width: number, height: number, condition: number): THREE.Group {
  const g = new THREE.Group();
  const halfW = width * 0.3;
  const doorH = height * 0.7;
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x5C3A1E, roughness: 0.6, metalness: 0.1 });

  for (const side of [-1, 1]) {
    const door = makeBox(halfW, doorH, 0.05, doorMat);
    door.position.set(side * halfW / 2, doorH / 2, 0);
    g.add(door);
    const glass = makeBox(halfW * 0.7, doorH * 0.45, 0.02, glassMat(condition));
    glass.position.set(side * halfW / 2, doorH * 0.65, 0.03);
    g.add(glass);
  }
  return g;
}

function buildSlidingDoor(width: number, height: number, condition: number): THREE.Group {
  const g = new THREE.Group();
  const doorW = width * 0.45;
  const doorH = height * 0.75;
  const frame = frameMat(condition);
  // Track
  const track = makeBox(width * 0.9, 0.04, 0.04, frame);
  track.position.set(0, doorH + 0.02, 0);
  g.add(track);
  // Glass panels
  for (const side of [-1, 1]) {
    const panel = makeBox(doorW, doorH, 0.02, glassMat(condition));
    panel.position.set(side * doorW * 0.55, doorH / 2, 0);
    g.add(panel);
    const border = makeBox(doorW, doorH, 0.03, frame);
    border.position.copy(panel.position);
    g.add(border);
  }
  return g;
}

function buildRevolvingDoor(width: number, height: number, condition: number): THREE.Group {
  const g = new THREE.Group();
  const radius = width * 0.2;
  const doorH = height * 0.7;
  const frame = frameMat(condition);
  // Cylinder housing
  const housingGeo = new THREE.CylinderGeometry(radius + 0.1, radius + 0.1, doorH, 24, 1, true);
  const housing = new THREE.Mesh(housingGeo, frame);
  housing.position.y = doorH / 2;
  g.add(housing);
  // Four revolving panels
  const panelMat = glassMat(condition);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const panelGeo = new THREE.PlaneGeometry(radius * 0.9, doorH * 0.9);
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.set(Math.cos(angle) * radius * 0.45, doorH / 2, Math.sin(angle) * radius * 0.45);
    panel.rotation.y = -angle;
    g.add(panel);
  }
  return g;
}

// ── Main entry point ───────────────────────────────────────────────

/**
 * Generate a parametric storefront (shopfront bay).
 */
export function generateStorefront(params: StorefrontParams): StorefrontResult {
  const {
    width = 4,
    height = 3.5,
    depth = 0.4,
    windowRatio = 0.6,
    doorType = 'single',
    kickPanel = 'tile',
    awning = false,
    hangingSign = false,
    interiorLight = 0xffeecc,
    condition = 0.7,
    accentColor = 0xCD853F,
  } = params;

  const group = new THREE.Group();
  group.name = 'storefront';

  const doorWidth = width * (1 - windowRatio);
  const windowWidth = width * windowRatio;
  const kickHeight = height * 0.2;
  const frame = frameMat(condition);

  // ── Back wall ──────────────────────────────────────────────────
  const backWall = makeBox(width, height, depth, new THREE.MeshStandardMaterial({
    color: 0xF5F0E8,
    roughness: 0.8,
  }));
  backWall.position.set(0, height / 2, -depth / 2);
  group.add(backWall);

  // ── Display windows ────────────────────────────────────────────
  const winX = (doorType === 'double') ? width / 4 : width / 2 - doorWidth / 2 - windowWidth / 2;
  const dispWin = makeBox(windowWidth, height - kickHeight - 0.2, 0.03, glassMat(condition));
  dispWin.position.set(winX, kickHeight + (height - kickHeight - 0.2) / 2 + 0.1, depth / 2);
  group.add(dispWin);
  // Window frame
  const winFrameTop = makeBox(windowWidth + 0.1, 0.06, 0.06, frame);
  winFrameTop.position.set(winX, height - 0.03, depth / 2);
  group.add(winFrameTop);
  const winFrameBot = makeBox(windowWidth + 0.1, 0.06, 0.06, frame);
  winFrameBot.position.set(winX, kickHeight + 0.03, depth / 2);
  group.add(winFrameBot);
  const winFrameSideL = makeBox(0.06, height - kickHeight - 0.16, 0.06, frame);
  winFrameSideL.position.set(winX - windowWidth / 2 - 0.03, kickHeight + (height - kickHeight - 0.16) / 2 + 0.1, depth / 2);
  group.add(winFrameSideL);
  const winFrameSideR = winFrameSideL.clone();
  winFrameSideR.position.x = winX + windowWidth / 2 + 0.03;
  group.add(winFrameSideR);

  // ── Kick panel ─────────────────────────────────────────────────
  const kickMat = kickPanelMat(kickPanel, condition, accentColor);
  const kick = makeBox(width, kickHeight, depth + 0.02, kickMat);
  kick.position.set(0, kickHeight / 2, depth / 2);
  group.add(kick);

  // ── Door ───────────────────────────────────────────────────────
  let doorGroup: THREE.Group | null = null;
  switch (doorType) {
    case 'single':
      doorGroup = buildSingleDoor(doorWidth, height, condition);
      break;
    case 'double':
      doorGroup = buildDoubleDoor(doorWidth, height, condition);
      break;
    case 'sliding':
      doorGroup = buildSlidingDoor(doorWidth, height, condition);
      break;
    case 'revolving':
      doorGroup = buildRevolvingDoor(doorWidth, height, condition);
      break;
  }
  if (doorGroup) {
    const doorX = (doorType === 'double') ? 0 : winX + windowWidth + doorWidth / 2;
    doorGroup.position.set(doorX, 0, depth / 2);
    group.add(doorGroup);
  }

  // ── Awning ─────────────────────────────────────────────────────
  if (awning) {
    const awningExt = 1.2;
    let awningMat: THREE.Material;
    switch (awning) {
      case 'canvas':
        awningMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.8, side: THREE.DoubleSide });
        break;
      case 'stripes':
        awningMat = new THREE.MeshStandardMaterial({ color: 0xCC3333, roughness: 0.7, side: THREE.DoubleSide });
        break;
      case 'metal':
        awningMat = new THREE.MeshStandardMaterial({ color: 0xBBBBA0, roughness: 0.3, metalness: 0.7 });
        break;
      case 'marquee':
        awningMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.2, metalness: 0.5, emissive: 0x332200 });
        break;
      default:
        awningMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    }
    const awningGeo = new THREE.PlaneGeometry(width, awningExt);
    const awningMesh = new THREE.Mesh(awningGeo, awningMat);
    awningMesh.rotation.x = -Math.PI / 6;
    awningMesh.position.set(0, height * 0.85, depth / 2 + awningExt / 2 * Math.cos(Math.PI / 6));
    group.add(awningMesh);
  }

  // ── Hanging sign ───────────────────────────────────────────────
  if (hangingSign) {
    const signGroup = new THREE.Group();
    // Sign board
    const signW = width * 0.4;
    const signH = 0.6;
    const signBoard = makeBox(signW, signH, 0.05, new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.5,
    }));
    signGroup.add(signBoard);
    // Brackets
    for (const side of [-1, 1]) {
      const bracket = makeBox(0.04, 0.4, 0.04, frame);
      bracket.position.set(side * signW / 2, signH / 2 + 0.2, 0);
      signGroup.add(bracket);
    }
    signGroup.position.set(0, height + 0.5, depth / 2 + 0.3);
    group.add(signGroup);
  }

  // ── Interior light glow ────────────────────────────────────────
  const lightPlane = makeBox(windowWidth * 0.9, (height - kickHeight - 0.2) * 0.9, 0.01, new THREE.MeshBasicMaterial({
    color: interiorLight,
    transparent: true,
    opacity: 0.15,
  }));
  lightPlane.position.set(winX, kickHeight + (height - kickHeight - 0.2) / 2 + 0.1, depth / 2 - 0.05);
  group.add(lightPlane);

  // ── Dispose ────────────────────────────────────────────────────
  return {
    group,
    dispose() {
      group.traverse((obj) => {
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
