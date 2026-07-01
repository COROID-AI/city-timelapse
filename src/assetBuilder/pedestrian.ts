import * as THREE from 'three';
import { type Era, paletteFor } from './eras';

/**
 * Soft triangle budget for a single pedestrian so the scene can later instance
 * many of them without exhausting geometry throughput.
 */
export const PEDESTRIAN_MAX_TRIS = 500;

interface PedMaterials {
  readonly skin: THREE.MeshStandardMaterial;
  readonly cloth: THREE.MeshStandardMaterial;
  readonly trim: THREE.MeshStandardMaterial;
}

/** Era-specific headwear / hair attached atop the head mesh. */
function addHeadwear(
  group: THREE.Group,
  era: Era,
  mats: PedMaterials,
  headY: number,
): void {
  switch (era) {
    case 1945: {
      // fedora: brim + crown
      const brim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, 0.02, 12),
        mats.cloth,
      );
      brim.position.y = headY + 0.06;
      brim.name = 'hat_brim';
      group.add(brim);
      const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.11, 0.12, 12),
        mats.cloth,
      );
      crown.position.y = headY + 0.12;
      crown.name = 'hat_crown';
      group.add(crown);
      break;
    }
    case 1965: {
      const beanie = new THREE.Mesh(
        new THREE.SphereGeometry(0.125, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        mats.cloth,
      );
      beanie.position.y = headY + 0.02;
      beanie.name = 'beanie';
      group.add(beanie);
      break;
    }
    case 1985: {
      const hair = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        mats.trim,
      );
      hair.position.y = headY;
      hair.name = 'hair';
      group.add(hair);
      break;
    }
    case 2005: {
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.125, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        mats.cloth,
      );
      cap.position.y = headY + 0.02;
      cap.name = 'cap';
      group.add(cap);
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.02, 0.1),
        mats.cloth,
      );
      visor.position.set(0, headY + 0.02, 0.13);
      visor.name = 'cap_visor';
      group.add(visor);
      break;
    }
    case 2025: {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.02, 6, 12),
        mats.trim,
      );
      band.rotation.x = Math.PI / 2;
      band.position.y = headY;
      band.name = 'ar_band';
      group.add(band);
      break;
    }
  }
}

/**
 * Builds a low-poly pedestrian whose clothing colours and headwear change with
 * the era. Built from simple boxes + a low-segment sphere to stay well under
 * {@link PEDESTRIAN_MAX_TRIS} triangles, and sized so the whole figure fits
 * within ~2 m of height. The group origin is at the feet (y = 0) so it can be
 * dropped directly onto a sidewalk.
 */
export function makePedestrian(era: Era): THREE.Group {
  const palette = paletteFor(era);
  const group = new THREE.Group();
  group.name = 'Pedestrian';

  const mats: PedMaterials = {
    skin: new THREE.MeshStandardMaterial({ color: palette.skin, roughness: 0.8 }),
    cloth: new THREE.MeshStandardMaterial({
      color: palette.clothing,
      roughness: 0.85,
    }),
    trim: new THREE.MeshStandardMaterial({
      color: palette.accent,
      roughness: 0.7,
    }),
  };
  const trouserMat = new THREE.MeshStandardMaterial({
    color: palette.trousers,
    roughness: 0.85,
  });

  // Body segment heights (metres). Total figure ~1.92 m.
  const legH = 0.85;
  const torsoH = 0.6;
  const headR = 0.12;
  const armH = 0.55;
  const pelvisTop = legH + 0.05; // base of torso

  // Pelvis
  const pelvis = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.18, 0.22),
    trouserMat,
  );
  pelvis.position.y = pelvisTop;
  pelvis.castShadow = true;
  pelvis.name = 'pelvis';
  group.add(pelvis);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.16, legH, 0.18);
  for (const [name, sx] of [
    ['leg_L', -0.09],
    ['leg_R', 0.09],
  ] as const) {
    const leg = new THREE.Mesh(legGeo, trouserMat);
    leg.position.set(sx, legH / 2, 0);
    leg.castShadow = true;
    leg.name = name;
    group.add(leg);
  }

  // Torso
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, torsoH, 0.24),
    mats.cloth,
  );
  torso.position.y = pelvisTop + torsoH / 2 + 0.09;
  torso.castShadow = true;
  torso.name = 'torso';
  group.add(torso);

  // Arms
  const armGeo = new THREE.BoxGeometry(0.12, armH, 0.14);
  const armY = pelvisTop + torsoH + 0.04;
  for (const [name, sx] of [
    ['arm_L', -0.26],
    ['arm_R', 0.26],
  ] as const) {
    const arm = new THREE.Mesh(armGeo, mats.cloth);
    arm.position.set(sx, armY - armH / 2, 0);
    arm.castShadow = true;
    arm.name = name;
    group.add(arm);
  }

  // Head
  const headY = pelvisTop + torsoH + 0.18 + headR;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(headR, 10, 6),
    mats.skin,
  );
  head.position.y = headY;
  head.castShadow = true;
  head.name = 'head';
  group.add(head);

  addHeadwear(group, era, mats, headY);
  return group;
}
