import * as THREE from 'three';
import type { EraId } from '../eras.js';
import type { PedestrianParts } from './rig.js';
import type { PedestrianEraSpec } from './specs.js';

// ── Color palette helpers ─────────────────────────────────────────────

/** Pick a random color from an era palette */
export function pickColor(palette: string[]): THREE.Color {
  return new THREE.Color(palette[Math.floor(Math.random() * palette.length)]);
}

// ── Per-era outfit palettes ───────────────────────────────────────────

/** Era → list of hex colors for clothing materials */
const ERA_PALETTE: Record<EraId, { base: string[]; accent: string[]; skin: string[] }> = {
  '1945': {
    base: ['#3a3a2e', '#5c4033', '#2f2f2f', '#6b5b4e', '#4a4a5a', '#8b7d6b'],
    accent: ['#1a1a1a', '#c4a35a', '#8b0000', '#f5f0e1', '#4a5568'],
    skin: ['#ffccaa', '#deb887', '#c68642', '#8d5524'],
  },
  '1965': {
    base: ['#ff6b35', '#1a5276', '#7d3c98', '#2ecc71', '#e74c3c', '#f39c12', '#ffffff'],
    accent: ['#ff1493', '#00ced1', '#333333', '#daa520', '#800020'],
    skin: ['#ffccaa', '#deb887', '#c68642', '#8d5524', '#f5d5b8'],
  },
  '1985': {
    base: ['#0066cc', '#cc0000', '#ff00ff', '#00ff00', '#ffff00', '#ff6600', '#1a1a2e'],
    accent: ['#00ffff', '#ff0066', '#ffffff', '#333333', '#4400aa'],
    skin: ['#ffccaa', '#deb887', '#c68642', '#8d5524', '#f5d5b8'],
  },
  '2005': {
    base: ['#6b8e23', '#4169e1', '#dc143c', '#2f4f4f', '#8b008b', '#f5f5dc', '#696969'],
    accent: ['#ff69b4', '#00bfff', '#ffd700', '#333333', '#ffffff'],
    skin: ['#ffccaa', '#deb887', '#c68642', '#8d5524', '#f5d5b8'],
  },
  '2025': {
    base: ['#2d6a4f', '#1b4332', '#555555', '#1a1a2e', '#e07a5f', '#3d5a80', '#81b29a'],
    accent: ['#f2cc8f', '#e63946', '#457b9d', '#ffffff', '#2b2d42'],
    skin: ['#ffccaa', '#deb887', '#c68642', '#8d5524', '#f5d5b8'],
  },
};

// ── Era-specific accessory builders ───────────────────────────────────

/** Build a hat mesh for the pedestrian head */
function buildHat(eraId: EraId, color: THREE.Color): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  switch (eraId) {
    case '1945': {
      // Fedora — crown + brim
      const group = new THREE.Group();
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.15, 8), mat);
      crown.position.y = 0.075;
      group.add(crown);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 12), mat);
      brim.position.y = 0.01;
      group.add(brim);
      group.position.y = 0.18;
      return group as unknown as THREE.Mesh;
    }
    case '1965': {
      // Small pillbox / cloche
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      dome.position.y = 0.1;
      return dome;
    }
    case '1985': {
      // Baseball cap
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.08, 8), mat);
      top.position.y = 0.04;
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.12), mat);
      visor.position.set(0, 0.04, 0.15);
      visor.rotation.x = -0.15;
      const group = new THREE.Group();
      group.add(top, visor);
      group.position.y = 0.16;
      return group as unknown as THREE.Mesh;
    }
    case '2005': {
      // Beanie / skull cap
      const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), mat);
      beanie.position.y = 0.12;
      return beanie;
    }
    case '2025': {
      // Sports visor / minimal cap
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 6, 12), mat);
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.14;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 0.06), mat);
      strip.position.set(0, 0.14, 0.18);
      const group = new THREE.Group();
      group.add(band, strip);
      group.position.y = 0.16;
      return group as unknown as THREE.Mesh;
    }
  }
}

/** Build a coat / outerwear piece on the torso */
function buildCoat(eraId: EraId, color: THREE.Color): THREE.Group {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
  const coat = new THREE.Group();
  const width = 0.36;
  const height = 0.65;
  const depth = 0.24;

  if (eraId === '1945') {
    // Overcoat — longer, reaches mid-thigh
    const overcoatGeo = new THREE.BoxGeometry(width + 0.04, height + 0.3, depth + 0.04);
    const overcoat = new THREE.Mesh(overcoatGeo, mat);
    overcoat.position.y = 0.05;
    coat.add(overcoat);
  } else if (eraId === '1985') {
    // Denim jacket — shorter, boxy
    const jacketGeo = new THREE.BoxGeometry(width + 0.06, height * 0.7, depth + 0.06);
    const jacket = new THREE.Mesh(jacketGeo, mat);
    jacket.position.y = 0.05;
    coat.add(jacket);
    // Shoulder pads
    const padL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.12), mat);
    padL.position.set(-width / 2 - 0.02, height / 2 + 0.02, 0);
    coat.add(padL);
    const padR = padL.clone();
    padR.position.x = width / 2 + 0.02;
    coat.add(padR);
  } else if (eraId === '2025') {
    // Down jacket — puffy, oversized
    const pufferGeo = new THREE.BoxGeometry(width + 0.1, height + 0.1, depth + 0.1);
    const puffer = new THREE.Mesh(pufferGeo, mat);
    puffer.position.y = 0.05;
    coat.add(puffer);
    // Hood
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    hood.position.set(0, height / 2 + 0.05, -0.05);
    coat.add(hood);
  } else {
    // Standard jacket for 1965 / 2005
    const jacketGeo = new THREE.BoxGeometry(width + 0.04, height * 0.75, depth + 0.04);
    const jacket = new THREE.Mesh(jacketGeo, mat);
    jacket.position.y = 0.05;
    coat.add(jacket);
  }
  return coat;
}

/** Build a prop mesh for standing clusters */
function buildProp(propType: string, color: THREE.Color): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  switch (propType) {
    case 'newspaper': {
      const paper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.01, 0.28), mat);
      paper.rotation.x = -Math.PI / 2 + 0.3;
      paper.position.set(0, -0.15, 0.15);
      return paper;
    }
    case 'boombox': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.12), mat);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), mat);
      handle.rotation.z = Math.PI / 2;
      handle.position.y = 0.12;
      const speaker = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 8), new THREE.MeshStandardMaterial({ color: 0x222222 }));
      speaker.rotation.x = Math.PI / 2;
      speaker.position.set(0.08, 0, 0.07);
      const group = new THREE.Group();
      group.add(body, handle, speaker);
      group.position.set(0, -0.25, 0.1);
      return group as unknown as THREE.Mesh;
    }
    case 'flip_phone': {
      const phone = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.12), mat);
      phone.position.set(0, -0.1, 0.2);
      return phone;
    }
    case 'smartphone_in_hand': {
      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, 0.1), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x334466, emissiveIntensity: 0.3 }));
      screen.position.set(0, -0.05, 0.22);
      return screen;
    }
    default: {
      // Generic small accessory
      return new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), mat);
    }
  }
}

// ── Big hair silhouette (1985) ────────────────────────────────────────

function buildBigHair(headMesh: THREE.Mesh, color: THREE.Color): void {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  // Voluminous sphere around head
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), mat);
  hair.scale.set(1, 1.15, 1);
  hair.position.y = 0.03;
  headMesh.parent?.add(hair);
}

// ── Outfit application ────────────────────────────────────────────────

export interface AppliedOutfit {
  /** Meshes added by this outfit (for cleanup) */
  meshes: THREE.Object3D[];
}

/**
 * Apply era-appropriate clothing, colors, and accessories to a pedestrian rig.
 * Returns all extra meshes so they can be disposed during era swaps.
 */
export function applyOutfit(
  parts: PedestrianParts,
  eraId: EraId,
  outfitIndex: number,
  _spec: PedestrianEraSpec,
): AppliedOutfit {
  const palette = ERA_PALETTE[eraId];
  const meshes: THREE.Object3D[] = [];
  // deterministic per-individual variation seed
  void (outfitIndex * 7 + eraId.charCodeAt(0) * 31);

  // Skin tone
  const skinColor = pickColor(palette.skin);
  (parts.head as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 });

  // Base clothing color (torso)
  const baseColor = pickColor(palette.base);
  (parts.torso as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.75 });

  // Arm material matches torso
  const armMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.75 });
  parts.leftArm.children.forEach((c) => { (c as THREE.Mesh).material = armMat; });
  parts.rightArm.children.forEach((c) => { (c as THREE.Mesh).material = armMat; });

  // Leg color varies slightly
  const legColor = pickColor(palette.base);
  const legMat = new THREE.MeshStandardMaterial({ color: legColor, roughness: 0.8 });
  parts.leftLeg.children.forEach((c) => { (c as THREE.Mesh).material = legMat; });
  parts.rightLeg.children.forEach((c) => { (c as THREE.Mesh).material = legMat; });

  // Era-specific accessories
  switch (eraId) {
    case '1945': {
      // Hat (fedora/bowler)
      const hatColor = pickColor(palette.accent);
      const hat = buildHat(eraId, hatColor);
      hat.position.copy(parts.head.position);
      hat.position.y += 0.16;
      parts.root.add(hat);
      meshes.push(hat);

      // Overcoat
      const coatColor = pickColor(palette.accent);
      const coat = buildCoat(eraId, coatColor);
      coat.position.copy(parts.torso.position);
      parts.root.add(coat);
      meshes.push(coat);
      break;
    }
    case '1965': {
      // Skinny tie accent on torso
      const tieColor = pickColor(palette.accent);
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.02), new THREE.MeshStandardMaterial({ color: tieColor, roughness: 0.6 }));
      tie.position.set(0, 0.75, 0.2 / 2 + 0.01);
      parts.root.add(tie);
      meshes.push(tie);

      // Bold print on dress (accent stripe on torso)
      const otherColors = palette.base.filter((_, i) => i % 2 === outfitIndex % 2);
      const printColor = pickColor(otherColors.length > 0 ? otherColors : palette.base);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.15, 0.22), new THREE.MeshStandardMaterial({ color: printColor, roughness: 0.7 }));
      stripe.position.set(0, 0.85, 0);
      parts.root.add(stripe);
      meshes.push(stripe);
      break;
    }
    case '1985': {
      // Big hair
      buildBigHair(parts.head, pickColor(palette.accent));

      // Denim jacket or tracksuit
      const jacketColor = pickColor(palette.base);
      const coat = buildCoat(eraId, jacketColor);
      coat.position.copy(parts.torso.position);
      parts.root.add(coat);
      meshes.push(coat);

      // Neon accent stripe
      const neonColor = pickColor(palette.accent);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.22), new THREE.MeshStandardMaterial({ color: neonColor, emissive: neonColor, emissiveIntensity: 0.2 }));
      stripe.position.set(0, 1.0, 0.11);
      parts.root.add(stripe);
      meshes.push(stripe);
      break;
    }
    case '2005': {
      // Graphic tee accent
      const teeAccent = pickColor(palette.accent);
      const graphic = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.01), new THREE.MeshStandardMaterial({ color: teeAccent, roughness: 0.6 }));
      graphic.position.set(0, 0.9, 0.11);
      parts.root.add(graphic);
      meshes.push(graphic);

      // Low-rise waistband line
      const waistColor = pickColor(palette.base);
      const waistBand = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.22), new THREE.MeshStandardMaterial({ color: waistColor, roughness: 0.75 }));
      waistBand.position.set(0, 0.58, 0);
      parts.root.add(waistBand);
      meshes.push(waistBand);
      break;
    }
    case '2025': {
      // Backpack
      const packColor = pickColor(palette.base);
      const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.35, 0.12), new THREE.MeshStandardMaterial({ color: packColor, roughness: 0.7 }));
      backpack.position.set(0, 0.9, -0.16);
      parts.root.add(backpack);
      meshes.push(backpack);

      // Strap lines
      const strapMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
      const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.02), strapMat);
      strapL.position.set(-0.06, 0.9, -0.1);
      parts.root.add(strapL);
      meshes.push(strapL);
      const strapR = strapL.clone();
      strapR.position.x = 0.06;
      parts.root.add(strapR);
      meshes.push(strapR);

      // Down jacket
      const jacketColor = pickColor(palette.base);
      const coat = buildCoat(eraId, jacketColor);
      coat.position.copy(parts.torso.position);
      parts.root.add(coat);
      meshes.push(coat);
      break;
    }
  }

  return { meshes };
}

/**
 * Attach a cluster prop to a pedestrian standing in a talking group.
 * Props are held at hand level, positioned near the torso front.
 */
export function attachClusterProp(
  parts: PedestrianParts,
  propType: string,
  color: THREE.Color,
): THREE.Object3D {
  const prop = buildProp(propType, color);
  // Position near hands — depends on pose but roughly chest-level forward
  prop.position.set(
    (Math.random() - 0.5) * 0.1,
    0.8,
    0.2 / 2 + 0.1,
  );
  parts.root.add(prop);
  return prop;
}
