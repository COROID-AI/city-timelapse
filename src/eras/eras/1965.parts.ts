import * as THREE from 'three';

import { BLOCK, CURB, SIDEWALK, STREET } from '../../layout';

/**
 * Procedural geometry + canvas helpers shared by the 1965 era module.
 *
 * Everything here is generated from primitives (boxes, cylinders, cones,
 * spheres) and hand-drawn canvas textures so the repository stays free of
 * binary assets. The helpers are intentionally small and side-effect free:
 * they only build geometry into a caller-supplied parent group.
 */

/** World-space street band used to place props, vehicles and markings. */
export const STREET_GEOM = Object.freeze({
  /** Half of the street width (each side of the block centre). */
  halfWidth: STREET.width / 2,
  /** Distance from the block centre to the inner curb edge. */
  innerEdge: BLOCK.depth / 2 + SIDEWALK.width + CURB.depth,
});

/** Mid-century 1960s accent palette (hex strings). */
export const PALETTE = Object.freeze({
  /** Turquoise / aqua — the signature 60s colour. */
  turquoise: '#3fb9b0',
  /** Sunburst yellow. */
  yellow: '#f2c14e',
  /** Coral / salmon. */
  coral: '#ef7f5c',
  /** Mint cream. */
  mint: '#d8efe0',
  /** Deep teal. */
  teal: '#1f6f6a',
  /** Chrome silver. */
  chrome: '#cfd6dd',
  /** Hot pink (Motel sign). */
  pink: '#f06292',
  /** Retro orange. */
  orange: '#e8862e',
  /** Cream / off-white. */
  cream: '#f6f1e2',
  /** Ink navy for asphalt. */
  asphalt: '#3a3f47',
});

/** Convert a hex string to a THREE.Color. */
export function hexColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

/**
 * A labelled, walkable hotspot. Mirrors the InteractivePoint contract but
 * carries the extra meshes so the caller can attach them to the scene.
 */
export interface Hotspot {
  id: string;
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  label?: string;
  meshes: THREE.Mesh[];
}

/**
 * Build a canvas texture from a drawing callback. Returns a MeshStandardMaterial
 * whose map contains the canvas texture so it can be applied to a UV-mapped mesh.
 */
export function makeCanvasMaterial(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial();
  // In headless (node) test environments there is no DOM canvas; fall back to
  // a plain material so the scene graph still builds and can be asserted.
  if (typeof document === 'undefined') {
    return material;
  }
  const canvas = document.createElement('canvas') as HTMLCanvasElement;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    draw(ctx, width, height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  material.map = texture;
  return material;
}

/** A thin box mesh (helper to keep call sites compact). */
export function box(
  w: number,
  h: number,
  d: number,
  color: string,
): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: hexColor(color) }),
  );
}

/** Position a mesh at (x, y, z) and attach it to a parent. */
export function place(parent: THREE.Object3D, mesh: THREE.Mesh, x: number, y: number, z: number): THREE.Mesh {
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/** A vertical cylinder used for poles, meters, lamp standards and posts. */
export function pole(
  radius: number,
  height: number,
  color: string,
  segments = 8,
): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, segments),
    new THREE.MeshStandardMaterial({ color: hexColor(color) }),
  );
}

/** A small sphere used for lamp globes and bumper details. */
export function orb(radius: number, color: string): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 8, 6),
    new THREE.MeshStandardMaterial({ color: hexColor(color) }),
  );
}

/** A cone used for googie roof spikes (rocket accents). */
export function spike(radius: number, height: number, color: string): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.ConeGeometry(radius, height, 8),
    new THREE.MeshStandardMaterial({ color: hexColor(color) }),
  );
}

/**
 * Draw a neon strip sign texture: a rounded backer with the label text and a
 * glowing neon underline. Returns a material with the canvas texture applied.
 */
export function neonSignMaterial(
  label: string,
  neonColor: string = PALETTE.pink,
  backer: string = PALETTE.cream,
): THREE.MeshStandardMaterial {
  return makeCanvasMaterial(256, 96, (ctx, w, h) => {
    ctx.fillStyle = backer;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#c9c2b0';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    // Label in a mid-century sans-serif feel.
    ctx.fillStyle = '#2f2a26';
    ctx.font = 'bold 44px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, h / 2 - 8);

    // Neon underline tube.
    ctx.strokeStyle = neonColor;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(24, h - 22);
    ctx.lineTo(w - 24, h - 22);
    ctx.stroke();

    // Glow halo.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, h - 22);
    ctx.lineTo(w - 30, h - 22);
    ctx.stroke();
  });
}

/**
 * Draw a vintage billboard: a coloured field, a bold headline, a subtitle and
 * a period graphic bar. Fully procedural.
 */
export function billboardMaterial(
  headline: string,
  subtitle: string,
  field: string = PALETTE.coral,
  accent: string = PALETTE.yellow,
): THREE.MeshStandardMaterial {
  return makeCanvasMaterial(512, 256, (ctx, w, h) => {
    ctx.fillStyle = field;
    ctx.fillRect(0, 0, w, h);

    // Period graphic band.
    ctx.fillStyle = accent;
    ctx.fillRect(0, h - 56, w, 56);

    ctx.fillStyle = '#fff7ea';
    ctx.font = 'bold 64px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(headline, w / 2, h / 2 - 30);

    ctx.fillStyle = '#2f2a26';
    ctx.font = 'italic 34px Georgia, serif';
    ctx.fillText(subtitle, w / 2, h / 2 + 40);

    ctx.fillStyle = '#2f2a26';
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.fillText('EST. 1965', w / 2, h - 24);
  });
}

/** A stripe texture for asphalt lane markings (dashed centre line). */
export function laneStripeMaterial(): THREE.MeshStandardMaterial {
  return makeCanvasMaterial(256, 128, (ctx, w, h) => {
    ctx.fillStyle = PALETTE.asphalt;
    ctx.fillRect(0, 0, w, h);
    // Dashed white centre line.
    ctx.fillStyle = '#f0ead6';
    for (let x = 0; x < w; x += 48) {
      ctx.fillRect(x + 8, h / 2 - 6, 24, 12);
    }
  });
}

/** A zebra-crossing stripe texture (white on asphalt). */
export function crosswalkMaterial(): THREE.MeshStandardMaterial {
  return makeCanvasMaterial(256, 128, (ctx, w, h) => {
    ctx.fillStyle = PALETTE.asphalt;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f0ead6';
    const bar = 22;
    for (let x = 0; x < w; x += bar * 2) {
      ctx.fillRect(x, 0, bar, h);
    }
  });
}

/**
 * A single mid-century pedestrian figure built from primitives. `outfit` holds
 * the colourway (suit jacket, trousers, skin, hair, and a dress alternative).
 */
export interface Outfit {
  /** Jacket / dress main colour. */
  top: string;
  /** Trousers / skirt colour. */
  bottom: string;
  /** Skin tone. */
  skin: string;
  /** Hair colour. */
  hair: string;
}

/** Build a pedestrian figure centred at the origin, facing +z. */
export function buildPedestrian(
  outfit: Outfit,
  variant: 'suit' | 'dress' | 'skirt',
): THREE.Group {
  const figure = new THREE.Group();

  const skin = hexColor(outfit.skin);
  const skinMat = () => new THREE.MeshStandardMaterial({ color: skin });

  // Legs.
  const leg = () =>
    new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.62, 0.18),
      new THREE.MeshStandardMaterial({ color: hexColor(outfit.bottom) }),
    );
  const leftLeg = leg();
  leftLeg.position.set(-0.1, 0.31, 0);
  const rightLeg = leg();
  rightLeg.position.set(0.1, 0.31, 0);
  figure.add(leftLeg, rightLeg);

  // Torso.
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.5, 0.24),
    new THREE.MeshStandardMaterial({ color: hexColor(outfit.top) }),
  );
  torso.position.set(0, 0.93, 0);
  figure.add(torso);

  // Arms.
  const arm = () =>
    new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.42, 0.14),
      new THREE.MeshStandardMaterial({ color: hexColor(outfit.top) }),
    );
  const leftArm = arm();
  leftArm.position.set(-0.28, 0.9, 0);
  const rightArm = arm();
  rightArm.position.set(0.28, 0.9, 0);
  figure.add(leftArm, rightArm);

  // Head.
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), skinMat());
  head.position.set(0, 1.48, 0);
  figure.add(head);

  // Hair.
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: hexColor(outfit.hair) }));
  hair.position.set(0, 1.58, 0);
  hair.scale.set(1, 0.55, 1);
  figure.add(hair);

  // Necktie for suit variant.
  if (variant === 'suit') {
    const tie = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.28, 0.02),
      new THREE.MeshStandardMaterial({ color: hexColor(PALETTE.coral) }),
    );
    tie.position.set(0, 0.82, 0.13);
    figure.add(tie);
  }

  // Skirt flare for dress/skirt variants.
  if (variant === 'dress' || variant === 'skirt') {
    const skirt = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.34, 10),
      new THREE.MeshStandardMaterial({ color: hexColor(outfit.bottom) }),
    );
    skirt.position.set(0, 0.68, 0);
    skirt.scale.set(1, 1, 1);
    figure.add(skirt);
  }

  return figure;
}

/** A chrome-laden 1962-style sedan built from primitives. */
export function buildSedan(color: string): THREE.Group {
  const car = new THREE.Group();
  const chrome = hexColor(PALETTE.chrome);
  const chromeMat = () => new THREE.MeshStandardMaterial({ color: chrome });
  const bodyMat = () => new THREE.MeshStandardMaterial({ color: hexColor(color) });

  // Body.
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 3.6), bodyMat());
  body.position.set(0, 0.6, 0);
  car.add(body);

  // Cabin / roof.
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 1.9), chromeMat());
  cab.position.set(0, 1.08, -0.25);
  car.add(cab);

  // Chrome bumpers.
  const bumper = (z: number) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 0.12), chromeMat());
    b.position.set(0, 0.45, z);
    car.add(b);
  };
  bumper(1.82);
  bumper(-1.82);

  // Fenders (front).
  const fender = (x: number, z: number) => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.9), bodyMat());
    f.position.set(x, 0.5, z);
    car.add(f);
  };
  fender(0.72, 1.25);
  fender(-0.72, 1.25);

  // Wheels.
  const wheel = (x: number, z: number) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.16, 12), chromeMat());
    w.rotation.set(0, 0, Math.PI / 2);
    w.position.set(x, 0.3, z);
    car.add(w);
  };
  wheel(0.72, 1.1);
  wheel(-0.72, 1.1);
  wheel(0.72, -1.1);
  wheel(-0.72, -1.1);

  // Headlights.
  const light = (x: number) => {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshStandardMaterial({ color: hexColor('#fff7ea') }));
    l.position.set(x, 0.55, 1.82);
    car.add(l);
  };
  light(0.5);
  light(-0.5);

  return car;
}

/** A 1960s station wagon (longer roof, wood-trim sides). */
export function buildStationWagon(color: string): THREE.Group {
  const car = new THREE.Group();
  const chrome = hexColor(PALETTE.chrome);
  const chromeMat = () => new THREE.MeshStandardMaterial({ color: chrome });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 4.1), new THREE.MeshStandardMaterial({ color: hexColor(color) }));
  body.position.set(0, 0.6, 0);
  car.add(body);

  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 2.5), chromeMat());
  cab.position.set(0, 1.1, -0.4);
  car.add(cab);

  // Wood side trim.
  const trim = (x: number) => {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 3.4), new THREE.MeshStandardMaterial({ color: hexColor('#8a6a3a') }));
    t.position.set(x, 0.62, 0.15);
    car.add(t);
  };
  trim(0.9);
  trim(-0.9);

  const bumper = (z: number) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 0.12), chromeMat());
    b.position.set(0, 0.45, z);
    car.add(b);
  };
  bumper(2.05);
  bumper(-2.05);

  const wheel = (x: number, z: number) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.16, 12), chromeMat());
    w.rotation.set(0, 0, Math.PI / 2);
    w.position.set(x, 0.3, z);
    car.add(w);
  };
  wheel(0.72, 1.25);
  wheel(-0.72, 1.25);
  wheel(0.72, -1.25);
  wheel(-0.72, -1.25);

  return car;
}

/** A chrome 1960s motorbike (scooter-style). */
export function buildMotorbike(color: string): THREE.Group {
  const bike = new THREE.Group();
  const chrome = hexColor(PALETTE.chrome);
  const chromeMat = () => new THREE.MeshStandardMaterial({ color: chrome });

  // Wheels.
  const wheel = (z: number) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 12), chromeMat());
    w.rotation.set(0, 0, Math.PI / 2);
    w.position.set(0, 0.34, z);
    bike.add(w);
  };
  wheel(0.7);
  wheel(-0.7);

  // Frame / tank.
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.32, 0.7), new THREE.MeshStandardMaterial({ color: hexColor(color) }));
  tank.position.set(0, 0.62, 0.1);
  bike.add(tank);

  // Seat.
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.6), new THREE.MeshStandardMaterial({ color: hexColor('#2f2a26') }));
  seat.position.set(0, 0.78, -0.25);
  bike.add(seat);

  // Handlebars.
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6), chromeMat());
  bar.rotation.set(0, 0, Math.PI / 2);
  bar.position.set(0, 1.0, 0.55);
  bike.add(bar);

  // Headlamp.
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: hexColor('#fff7ea') }));
  lamp.position.set(0, 0.8, 0.75);
  bike.add(lamp);

  return bike;
}

/** A mid-century streetlight: tapered pole, arm and a globe. */
export function buildStreetlight(): THREE.Group {
  const light = new THREE.Group();
  const dark = hexColor('#2f2a26');
  const darkMat = () => new THREE.MeshStandardMaterial({ color: dark });

  const post = pole(0.12, 4.6, '#2f2a26');
  post.position.set(0, 2.3, 0);
  light.add(post);

  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6), darkMat());
  arm.rotation.set(0, 0, Math.PI / 2);
  arm.position.set(0.8, 4.55, 0);
  light.add(arm);

  const globe = orb(0.28, PALETTE.cream);
  globe.position.set(1.62, 4.35, 0);
  light.add(globe);

  return light;
}

/** A parking meter: pole + head with a small coin window. */
export function buildParkingMeter(): THREE.Group {
  const meter = new THREE.Group();
  const post = pole(0.05, 1.5, '#2f2a26');
  post.position.set(0, 0.75, 0);
  meter.add(post);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 0.12), new THREE.MeshStandardMaterial({ color: hexColor(PALETTE.chrome) }));
  head.position.set(0, 1.55, 0);
  meter.add(head);

  const dial = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: hexColor('#fff7ea') }));
  dial.position.set(0, 1.62, 0.07);
  meter.add(dial);

  return meter;
}

/** A phone booth: frame, glass, door and a small handset detail. */
export function buildPhoneBooth(): THREE.Group {
  const booth = new THREE.Group();
  const frameMat = () => new THREE.MeshStandardMaterial({ color: hexColor(PALETTE.coral) });
  const glassMat = () => new THREE.MeshStandardMaterial({ color: hexColor('#bfe8e0') });

  // Corner posts.
  const post = (x: number, z: number) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.3, 0.12), frameMat());
    p.position.set(x, 1.15, z);
    booth.add(p);
  };
  post(0.4, 0.28);
  post(-0.4, 0.28);
  post(0.4, -0.28);
  post(-0.4, -0.28);

  // Glass panels.
  const glass = (w: number, d: number, x: number, z: number) => {
    const g = new THREE.Mesh(new THREE.BoxGeometry(w, 2.1, d), glassMat());
    g.position.set(x, 1.1, z);
    booth.add(g);
  };
  glass(0.68, 0.05, 0, 0.28); // front
  glass(0.68, 0.05, 0, -0.28); // back
  glass(0.05, 0.56, 0.4, 0); // side
  glass(0.05, 0.56, -0.4, 0); // side

  // Roof.
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.7), frameMat());
  roof.position.set(0, 2.35, 0);
  booth.add(roof);

  // Internal handset detail.
  const phone = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: hexColor('#2f2a26') }));
  phone.position.set(0.2, 0.9, 0.24);
  booth.add(phone);

  return booth;
}

/** A mailbox: rounded blue postbox on a short post. */
export function buildMailbox(): THREE.Group {
  const box = new THREE.Group();
  const post = pole(0.05, 0.7, '#2f2a26');
  post.position.set(0, 0.35, 0);
  box.add(post);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 12), new THREE.MeshStandardMaterial({ color: hexColor('#2b5b9e') }));
  body.position.set(0, 1.0, 0);
  box.add(body);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshStandardMaterial({ color: hexColor('#2b5b9e') }));
  cap.position.set(0, 1.5, 0);
  cap.scale.set(1, 0.7, 1);
  box.add(cap);

  return box;
}

/** A bus stop: pole, sign board and a bench. */
export function buildBusStop(): THREE.Group {
  const stop = new THREE.Group();
  const post = pole(0.08, 2.4, '#2f2a26');
  post.position.set(0, 1.2, 0);
  stop.add(post);

  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.06), new THREE.MeshStandardMaterial({ color: hexColor(PALETTE.yellow) }));
  sign.position.set(0, 2.2, 0);
  stop.add(sign);

  // Bench.
  const bench = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: hexColor('#2f2a26') }));
  bench.position.set(1.0, 0.45, 0);
  stop.add(bench);
  const leg = (x: number) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.4), new THREE.MeshStandardMaterial({ color: hexColor('#2f2a26') }));
    l.position.set(x, 0.2, 0);
    stop.add(l);
  };
  leg(0.4);
  leg(1.6);

  return stop;
}