/**
 * src/content/buildings/details.ts — era-specific attachable construction detail.
 *
 * Construction detail (scaffolding, billboards, rooftop water tanks, satellite
 * dishes, AC units, neon signs, digital screens, solar arrays, green walls) is
 * modeled as *era-specific attachable anchor meshes*: each detail is a small
 * procedural THREE.Group that attaches to one of the shared anchor groups
 * (doorway / window / shelf) via the group's local space. When an era changes,
 * the detail layer disposes the previous era's groups and builds the next
 * era's groups on the SAME anchor groups — no orphaned meshes, no hardcoded
 * era logic (all kinds/labels/counts come from BuildingDetailSpec).
 */

import * as THREE from 'three';

import { buildLabelTexture } from './materials';
import type {
  BuildingDetailSpec,
  BuildingPlotSpec,
  EraAnchorSet,
} from '../../eras';

export interface DetailBuildContext {
  /** Shared anchor slot the detail attaches to. */
  anchor: keyof EraAnchorSet;
  /** Declarative plot spec for the current era. */
  plot: BuildingPlotSpec;
  /** Shared per-era anchor dimensions (doorway/window/shelf). */
  eraAnchors: EraAnchorSet;
  /** Label texture cache (billboards/screens/neon). */
  labels: Map<string, THREE.Texture>;
  /** Default billboard copy for the era. */
  defaultLabel: string;
  /** Emissive color for accent neon/screens. */
  accent: string;
}

/**
 * Build a mesh group for one declarative detail. The group is added directly
 * into the shared anchor group's local space by the caller.
 */
export function buildDetail(
  spec: BuildingDetailSpec,
  ctx: DetailBuildContext,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `detail-${spec.kind}-${spec.anchor}`;

  const anchorH = ctx.eraAnchors[ctx.anchor].height || 1;
  const anchorW = ctx.eraAnchors[ctx.anchor].width || 1;
  const z = 0;
  const accentColor = spec.color ?? ctx.accent;

  switch (spec.kind) {
    case 'billboard': {
      const texture = getLabelTexture(ctx, spec.label ?? ctx.defaultLabel, accentColor);
      const mat = new THREE.MeshStandardMaterial({
        map: texture,
        emissive: new THREE.Color(accentColor),
        emissiveIntensity: 0.2,
        roughness: 0.55,
        metalness: 0.1,
      });
      const width = anchorW * 0.9;
      const height = 1.0;
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.14, height + 0.14, 0.06),
        new THREE.MeshStandardMaterial({
          color: 0x3a3a3a,
          roughness: 0.6,
          metalness: 0.3,
        }),
      );
      frame.position.set(0, anchorH + 0.35, z + 0.02);
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, 0.04),
        mat,
      );
      board.position.set(0, anchorH + 0.35, z + 0.06);
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, anchorH + 0.55, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x44403a, roughness: 0.8, metalness: 0.05 }),
      );
      post.position.set(0, (anchorH + 0.5) / 2, z);
      group.add(frame, board, post);
      group.userData.disposeList = [mat, frame.material, board.material, post.material, texture];
      break;
    }

    case 'scaffold': {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xb87333,
        roughness: 0.75,
        metalness: 0.1,
      });
      const h = Math.min(6, anchorH * 1.9);
      const half = Math.min(1.4, anchorW * 0.5 + 0.15);
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const) {
        const pole = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, 0.08), mat);
        pole.position.set(sx * half, h / 2, sz * (anchorW * 0.25));
        group.add(pole);
      }
      for (let tier = 1; tier <= 3; tier += 1) {
        const tie = new THREE.Mesh(
          new THREE.BoxGeometry(half * 2 + 0.08, 0.05, anchorW * 0.5 + 0.08),
          mat,
        );
        tie.position.set(0, (h / 4) * tier, 0);
        group.add(tie);
      }
      group.userData.disposeList = [mat];
      break;
    }

    case 'canopy': {
      const mat = new THREE.MeshStandardMaterial({ color: 0x5c4a30, roughness: 0.8 });
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(anchorW, 0.06, 0.5),
        mat,
      );
      canopy.position.set(0, 0.22, z + 0.22);
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(anchorW, 0.03, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xc9b38a, roughness: 0.8 }),
      );
      stripe.position.set(0, 0.24, z + 0.22);
      group.add(canopy, stripe);
      group.userData.disposeList = [mat, stripe.material];
      break;
    }

    case 'water_tank': {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x8a7a55,
        roughness: 0.85,
        metalness: 0.25,
      });
      const r = 0.45;
      const legs = new THREE.MeshStandardMaterial({ color: 0x4a4030, roughness: 0.8 });
      const tankGeo = new THREE.CylinderGeometry(r, r, 0.4, 12);
      const tank = new THREE.Mesh(tankGeo, mat);
      tank.position.set(0, anchorH + 0.2, z);
      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.12, 8),
        new THREE.MeshStandardMaterial({ color: 0x5a5040, roughness: 0.8 }),
      );
      cap.position.set(0, anchorH + 0.52, z);
      group.add(tank, cap);
      for (let i = 0; i < 4; i += 1) {
        const angle = (i / 4) * Math.PI * 2;
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), legs);
        leg.position.set(Math.cos(angle) * 0.3, anchorH - 0.15, Math.sin(angle) * 0.3);
        group.add(leg);
      }
      group.userData.disposeList = [mat, legs, cap.material, tankGeo];
      break;
    }

    case 'satellite_dish': {
      const dishMat = new THREE.MeshStandardMaterial({
        color: 0xdfe6ea,
        roughness: 0.35,
        metalness: 0.2,
      });
      const dish = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), dishMat);
      dish.rotation.x = Math.PI;
      dish.position.set(0.2, anchorH + 0.15, z + 0.1);
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.15, 6),
        new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4 }),
      );
      arm.position.set(0.2, anchorH + 0.28, z + 0.12);
      group.add(dish, arm);
      group.userData.disposeList = [dishMat, arm.material];
      break;
    }

    case 'ac_unit': {
      const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.55, metalness: 0.3 });
      const count = spec.count ?? 1;
      for (let i = 0; i < count; i += 1) {
        const unit = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.2, 0.18),
          i % 2 === 0
            ? mat
            : new THREE.MeshStandardMaterial({ color: 0x9aa2ac, roughness: 0.6, metalness: 0.25 }),
        );
        unit.position.set(
          -anchorW * 0.4 + i * 0.35,
          0,
          z + 0.06 + (i % 2) * 0.02,
        );
        group.add(unit);
      }
      group.userData.disposeList = [mat];
      break;
    }

    case 'neon_sign': {
      const text = spec.label ?? ctx.defaultLabel;
      const texture = getLabelTexture(ctx, text, accentColor);
      const mat = new THREE.MeshStandardMaterial({
        map: texture,
        emissive: new THREE.Color(accentColor),
        emissiveIntensity: 2.4,
        roughness: 0.2,
        metalness: 0.1,
        transparent: true,
        opacity: 0.95,
      });
      const board = new THREE.Mesh(new THREE.BoxGeometry(anchorW * 0.75, 0.5, 0.06), mat);
      board.position.set(0, anchorH + 0.25, z + 0.05);
      const mount = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 1.0, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.7 }),
      );
      mount.position.set(0, anchorH + 0.25, z - 0.02);
      group.add(board, mount);
      group.userData.disposeList = [mat, mount.material, texture];
      break;
    }

    case 'screen': {
      const text = spec.label ?? ctx.defaultLabel;
      const texture = getLabelTexture(ctx, text, accentColor);
      const mat = new THREE.MeshStandardMaterial({
        map: texture,
        emissive: new THREE.Color(accentColor),
        emissiveIntensity: 1.6,
        roughness: 0.35,
        metalness: 0.15,
        transparent: true,
        opacity: 0.95,
      });
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(anchorW * 0.85, 0.65, 0.05),
        mat,
      );
      board.position.set(0, anchorH + 0.3, z + 0.07);
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(anchorW * 0.85 + 0.1, 0.75, 0.04),
        new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.4, metalness: 0.6 }),
      );
      frame.position.set(0, anchorH + 0.3, z + 0.05);
      group.add(board, frame);
      group.userData.disposeList = [mat, frame.material, texture];
      break;
    }

    case 'solar_panel': {
      const panelMat = new THREE.MeshStandardMaterial({
        color: 0x16324b,
        roughness: 0.4,
        metalness: 0.7,
        emissive: new THREE.Color(0x0a1f33),
        emissiveIntensity: 0.4,
      });
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x8a939c, roughness: 0.5, metalness: 0.5 });
      const count = spec.count ?? 4;
      const span = Math.min(4.5, anchorW * 2.2);
      for (let i = 0; i < count; i += 1) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.28), panelMat);
        panel.position.set(
          -span / 2 + (span / count) * (i + 0.5),
          anchorH + 0.12,
          z + 0.28,
        );
        panel.rotation.x = -0.4;
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1 + (i % 3) * 0.02, 0.04), frameMat);
        leg.position.set(panel.position.x, anchorH + 0.06, z + 0.24);
        group.add(panel, leg);
      }
      group.userData.disposeList = [panelMat, frameMat];
      break;
    }

    case 'green_wall': {
      const leafMat = new THREE.MeshStandardMaterial({
        color: 0x2e7d4f,
        roughness: 0.85,
        metalness: 0.05,
      });
      const mat = new THREE.MeshStandardMaterial({ color: 0x3a5c3a, roughness: 0.9 });
      const count = Math.min(9, Math.max(2, Math.round(anchorW * 2)));
      for (let i = 0; i < count; i += 1) {
        const offY = (i * 7.3) % 2.4;
        const cell = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.2, 0.06),
          i % 3 === 0 ? leafMat : mat,
        );
        cell.position.set(
          -anchorW / 2 + 0.12 + (i % 4) * (anchorW / 4),
          offY,
          z + 0.02,
        );
        group.add(cell);
      }
      group.userData.disposeList = [leafMat, mat];
      break;
    }

    default:
      break;
  }

  return group;
}

/** Get (and cache) a label texture for a detail. */
function getLabelTexture(
  ctx: DetailBuildContext,
  text: string,
  fill: string,
): THREE.Texture {
  const key = `${fill}:${text}`;
  let texture = ctx.labels.get(key);
  if (!texture) {
    texture = buildLabelTexture(text, { fill, size: 256 });
    ctx.labels.set(key, texture);
  }
  return texture;
}

/** Dispose a detail group and every material/texture it created. */
export function disposeDetailGroup(group: THREE.Group): void {
  const list = (group.userData.disposeList as Array<THREE.Material | THREE.Texture> | undefined) ?? [];
  for (const item of list) {
    item.dispose();
  }
  group.clear();
}