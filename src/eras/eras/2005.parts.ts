import * as THREE from 'three';

/**
 * Procedural geometry + canvas-texture factories for the 2005 era scene.
 *
 * Everything here is generated at runtime from code — there are no binary
 * assets. Canvas textures are created only when a DOM canvas is available
 * (browser). In headless test environments (node) the factories fall back to
 * solid-color materials so the scene graph can still be built and counted
 * without a display.
 */

/** True when a DOM canvas is available for procedural texture generation. */
export function canvasAvailable(): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof document.createElement === 'function'
  );
}

function css(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

/**
 * Build a procedural canvas texture, or return undefined when no DOM canvas
 * is available (headless test environments).
 */
export function makeCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture | undefined {
  if (!canvasAvailable()) return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  draw(ctx, width, height);
  return new THREE.CanvasTexture(canvas);
}

/** A solid-color material (fallback when no texture can be drawn). */
export function solidMaterial(color: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color });
}

/** Tag a built object with a stable kind used by tests and the sim. */
export function mark<T extends THREE.Object3D>(obj: T, kind: string): T {
  obj.userData = { ...(obj.userData ?? {}), era2005Kind: kind };
  return obj;
}

/** A textured material when a canvas texture is available, else solid. */
export function texturedMaterial(
  texture: THREE.CanvasTexture | undefined,
  fallback: number,
): THREE.MeshBasicMaterial {
  if (texture) return new THREE.MeshBasicMaterial({ color: 0xffffff, map: texture });
  return solidMaterial(fallback);
}

/** Draw a glass-curtain / punched-window facade grid. */
export function makeFacadeTexture(opts: {
  base: number;
  glass: number;
  frame: number;
  floors: number;
  cols: number;
}): THREE.CanvasTexture | undefined {
  return makeCanvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = css(opts.base);
    ctx.fillRect(0, 0, w, h);
    const floorH = h / opts.floors;
    const colW = w / opts.cols;
    for (let f = 0; f < opts.floors; f++) {
      for (let c = 0; c < opts.cols; c++) {
        ctx.fillStyle = css(opts.glass);
        ctx.fillRect(c * colW + 7, f * floorH + 9, colW - 14, floorH - 18);
        ctx.strokeStyle = css(opts.frame);
        ctx.lineWidth = 2;
        ctx.strokeRect(c * colW + 7, f * floorH + 9, colW - 14, floorH - 18);
      }
    }
  });
}

/** Draw a vinyl retail banner strip with a bold 2000s headline. */
export function makeBannerTexture(
  text: string,
  bg: number,
  fg: number,
): THREE.CanvasTexture | undefined {
  return makeCanvasTexture(256, 96, (ctx, w, h) => {
    ctx.fillStyle = css(bg);
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = css(fg);
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
  });
}

/** Draw a 2000s dot-com / graphic-design billboard. */
export function makeBillboardTexture(style: number): THREE.CanvasTexture | undefined {
  return makeCanvasTexture(512, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, style === 0 ? '#1b2a6b' : '#5b1a6b');
    grad.addColorStop(1, style === 0 ? '#2f7bd9' : '#d92f7b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText(style === 0 ? 'SURF THE NET!' : 'www.2005.com', w / 2, h / 2 - 30);
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(style === 0 ? 'dot-com boom' : 'CLICK HERE', w / 2, h / 2 + 55);
    // Graphic "swoosh" accent.
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(30, h - 40);
    ctx.quadraticCurveTo(w / 2, h - 80, w - 30, h - 30);
    ctx.stroke();
  });
}

/** A single mid-rise mixed-use building with a glass/steel facade. */
export interface BuildingSpec {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  base: number;
  glass: number;
  frame: number;
  floors: number;
  cols: number;
}

export function makeBuildingMesh(spec: BuildingSpec): THREE.Mesh {
  const texture = makeFacadeTexture(spec);
  const material = texturedMaterial(texture, spec.base);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width, spec.height, spec.depth),
    material,
  );
  mesh.position.set(spec.x, spec.height / 2, spec.z);
  return mark(mesh, 'building');
}

/** A chain-retail / coffee storefront with corporate fascia + vinyl banner. */
export interface StorefrontSpec {
  x: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  fascia: number;
  bannerText: string;
  bannerBg: number;
  bannerFg: number;
  rotationY: number;
}

export function makeStorefrontMesh(spec: StorefrontSpec): THREE.Group {
  const group = new THREE.Group();
  // Corporate fascia band.
  const fascia = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width, 1.3, 0.35),
    solidMaterial(spec.fascia),
  );
  fascia.position.set(0, spec.height - 0.65, 0);
  // Vinyl banner beneath the fascia.
  const bannerTexture = makeBannerTexture(spec.bannerText, spec.bannerBg, spec.bannerFg);
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width, 1.1, 0.12),
    texturedMaterial(bannerTexture, spec.bannerBg),
  );
  banner.position.set(0, spec.height - 1.85, 0.08);
  // Storefront glazing.
  const glazing = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width * 0.7, spec.height * 0.5, 0.1),
    solidMaterial(0x9fc4d8),
  );
  glazing.position.set(0, spec.height * 0.25, 0.18);
  group.add(fascia, banner, glazing);
  group.position.set(spec.x, 0, spec.z);
  group.rotation.set(0, spec.rotationY, 0);
  return mark(group, 'storefront');
}

/** A large roadside / roof-mounted billboard. */
export function makeBillboardMesh(
  style: number,
  x: number,
  y: number,
  z: number,
  rotationY: number,
  pole: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const w = 18;
  const h = 9;
  const texture = makeBillboardTexture(style);
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, 0.5),
    texturedMaterial(texture, 0xffffff),
  );
  panel.position.set(0, 0, 0);
  group.add(panel);
  if (pole) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, h * 0.55, 0.5),
      solidMaterial(0x666666),
    );
    post.position.set(0, -h * 0.5 - (h * 0.55) / 2, 0);
    group.add(post);
  }
  group.position.set(x, y, z);
  group.rotation.set(0, rotationY, 0);
  return mark(group, 'billboard');
}

/** Vehicle body types available in the 2005 fleet. */
export type VehicleKind = 'sedan' | 'suv' | 'hatchback' | 'van';

/** Build a procedural early-2000s vehicle (silver/black/grey palette). */
export function makeVehicleMesh(kind: VehicleKind, color: number): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.2, 1.9), solidMaterial(color));
  body.position.set(0, 0.7, 0);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 1.7), solidMaterial(0x9fb6c9));
  glass.position.set(-0.2, 1.2, 0);
  group.add(body, glass);
  // Wheels.
  const wheelMat = solidMaterial(0x111111);
  for (const [wx, wz] of [[-1.5, 0.95], [1.5, 0.95], [-1.5, -0.95], [1.5, -0.95]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 12), wheelMat);
    wheel.rotation.set(0, 0, Math.PI / 2);
    wheel.position.set(wx, 0.34, wz);
    group.add(wheel);
  }
  // Kind-specific silhouette accents.
  if (kind === 'suv') {
    group.scale.set(1.15, 1.2, 1.15);
  } else if (kind === 'van') {
    group.scale.set(1.25, 1.28, 1.0);
  } else if (kind === 'hatchback') {
    group.scale.set(0.92, 0.9, 0.95);
  }
  return mark(group, 'vehicle');
}

/** Pedestrian outfit variant (2000s casual fashion). */
export interface PedestrianOutfit {
  shirt: number;
  pants: number;
  skin: number;
  hair: number;
  hoodie: boolean;
  flipPhone: boolean;
}

/** Build a small procedural 2000s pedestrian (baggy jeans, tees, hoodies). */
export function makePedestrianMesh(outfit: PedestrianOutfit): THREE.Group {
  const group = new THREE.Group();
  const skin = solidMaterial(outfit.skin);
  const legH = 0.9;
  const legW = 0.17; // baggy jeans
  const legMat = solidMaterial(outfit.pants);
  const lLeg = new THREE.Mesh(new THREE.BoxGeometry(legW, legH, legW), legMat);
  lLeg.position.set(-0.09, legH / 2, 0);
  const rLeg = new THREE.Mesh(new THREE.BoxGeometry(legW, legH, legW), legMat);
  rLeg.position.set(0.09, legH / 2, 0);
  const torsoMat = outfit.hoodie ? solidMaterial(outfit.pants) : solidMaterial(outfit.shirt);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.62, 0.22), torsoMat);
  torso.position.set(0, legH + 0.31, 0);
  const armMat = outfit.hoodie ? torsoMat : skin;
  const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.55, 0.09), armMat);
  lArm.position.set(-0.22, legH + 0.28, 0);
  const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.55, 0.09), armMat);
  rArm.position.set(0.22, legH + 0.28, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), skin);
  head.position.set(0, legH + 0.62 + 0.12, 0);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.26), solidMaterial(outfit.hair));
  hair.position.set(0, legH + 0.62 + 0.25, 0);
  group.add(lLeg, rLeg, torso, lArm, rArm, head, hair);
  if (outfit.flipPhone) {
    const phone = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.13, 0.04), solidMaterial(0x222222));
    phone.position.set(0.26, legH + 0.62 + 0.1, 0);
    group.add(phone);
  }
  return mark(group, 'pedestrian');
}

/** A glass bus shelter with a side ad panel. */
export function makeBusShelterMesh(x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.6, 0.12), solidMaterial(0x3a3f44));
  frame.position.set(0, 1.3, 0);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.12, 1.3), solidMaterial(0x555555));
  roof.position.set(0, 2.66, 0);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(4.3, 1.6, 0.05), solidMaterial(0x9fc4d8));
  glass.position.set(0, 1.4, -0.02);
  const ad = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 0.06), solidMaterial(0xd9e6f2));
  ad.position.set(0, 1.0, 0.02);
  group.add(frame, roof, glass, ad);
  group.position.set(x, 0, z);
  return mark(group, 'bus-shelter');
}

/** A street planter with foliage. */
export function makePlanterMesh(x: number, z: number, rotationY = 0): THREE.Group {
  const group = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 1.2), solidMaterial(0x6b4a2f));
  box.position.set(0, 0.35, 0);
  const foliage = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 1.3), solidMaterial(0x3f7d2a));
  foliage.position.set(0, 0.72, 0);
  group.add(box, foliage);
  group.position.set(x, 0, z);
  group.rotation.set(0, rotationY, 0);
  return mark(group, 'planter');
}

/** A U-loop bike rack. */
export function makeBikeRackMesh(x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  const metal = solidMaterial(0x333333);
  for (let i = -1; i <= 1; i++) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.06, 8, 12), metal);
    loop.position.set(i * 0.5, 0.5, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), metal);
    leg.position.set(i * 0.5, 0.25, 0);
    group.add(loop, leg);
  }
  group.position.set(x, 0, z);
  return mark(group, 'bike-rack');
}

/** A small newspaper box. */
export function makeNewspaperBoxMesh(x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.4), solidMaterial(0x2b6bb0));
  body.position.set(0, 0.4, 0);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.06), solidMaterial(0x111111));
  slot.position.set(0, 0.72, 0.2);
  group.add(body, slot);
  group.position.set(x, 0, z);
  return mark(group, 'newspaper-box');
}

/** A modern traffic camera on a pole. */
export function makeTrafficCameraMesh(x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.0, 0.2), solidMaterial(0x555555));
  pole.position.set(0, 2.0, 0);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 1.4), solidMaterial(0x555555));
  arm.position.set(0, 3.9, -0.6);
  const cam = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.5), solidMaterial(0x222222));
  cam.position.set(0, 3.9, -1.1);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 10), solidMaterial(0x1a1a1a));
    lens.rotation.set(Math.PI / 2, 0, 0);
  lens.position.set(0, 3.9, -1.35);
  group.add(pole, arm, cam, lens);
  group.position.set(x, 0, z);
  return mark(group, 'traffic-camera');
}

/** A modern traffic signal head on a pole. */
export function makeTrafficSignalMesh(x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.4, 0.18), solidMaterial(0x444444));
  pole.position.set(0, 2.2, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3, 0.35), solidMaterial(0x222222));
  head.position.set(0, 4.0, 0);
  const lightColors = [0xd22630, 0xf2b018, 0x2e9e46];
  for (let i = 0; i < 3; i++) {
    const light = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.04, 12),
      solidMaterial(lightColors[i]),
    );
    light.rotation.set(-Math.PI / 2, 0, 0);
    light.position.set(0, 0.42 - i * 0.42, 0.18);
    head.add(light);
  }
  group.add(pole, head);
  group.position.set(x, 0, z);
  return mark(group, 'traffic-signal');
}

/**
 * Thermoplastic road markings: yellow center lines, dashed white lane
 * dividers, and crosswalk stripes on the streets surrounding the block.
 */
export function makeRoadMarkingMeshes(): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  const white = solidMaterial(0xe9e9e9);
  const yellow = solidMaterial(0xd8a820);
  const bands: Array<{ cx: number; cz: number; alongX: boolean }> = [
    { cx: 0, cz: -72, alongX: true },
    { cx: 0, cz: 72, alongX: true },
    { cx: -72, cz: 0, alongX: false },
    { cx: 72, cz: 0, alongX: false },
  ];
  for (const band of bands) {
    const center = new THREE.Mesh(
      new THREE.BoxGeometry(band.alongX ? 116 : 0.3, 0.02, band.alongX ? 0.3 : 116),
      yellow,
    );
    center.position.set(band.cx, 0.012, band.cz);
    meshes.push(mark(center, 'road-marking'));
    for (let t = -52; t < 52; t += 8) {
      const dash = new THREE.Mesh(
        new THREE.BoxGeometry(band.alongX ? 3.2 : 0.25, 0.02, band.alongX ? 0.25 : 3.2),
        white,
      );
      if (band.alongX) {
        dash.position.set(t, 0.012, band.cz + 2.6);
      } else {
        dash.position.set(band.cx + 2.6, 0.012, t);
      }
      meshes.push(mark(dash, 'road-marking'));
    }
  }
  const corners: Array<{ x: number; z: number }> = [
    { x: -60, z: -60 },
    { x: 60, z: -60 },
    { x: -60, z: 60 },
    { x: 60, z: 60 },
  ];
  for (const c of corners) {
    for (let i = 0; i < 6; i++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 3.2), white);
      stripe.position.set(c.x - 1.5 + i * 0.6, 0.012, c.z);
      meshes.push(mark(stripe, 'road-marking'));
    }
  }
  return meshes;
}