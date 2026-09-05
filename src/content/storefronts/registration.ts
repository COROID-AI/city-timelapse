/**
 * src/content/storefronts/messages.ts — shared anchor-registration adapter.
 *
 * Both the storefront and advertising modules attach their meshes to the
 * foundation's three shared morph anchors (doorway/window/shelf). Each anchor
 * slot is a GPU vertex-morph box whose per-era pose is driven by the shared
 * MorphEngine timeline; content meshes register themselves as *followers* of
 * those slots so that when the engine lerps anchor dimensions/position the
 * storefront and ad geometry follows along (texture swaps stay synchronous
 * and cacheable — no rebuilds during a transition).
 *
 * A follower stores the slot key, the mesh it belongs to, and a scale bias.
 * The MorphEngine looks these up by slot name during era transitions.
 */

import type { EraAnchorSet, EraId } from '../../eras';

export type AnchorSlotKey = keyof EraAnchorSet;

/** A content mesh that tracks a shared anchor slot's pose. */
export interface AnchorFollower {
  slot: AnchorSlotKey;
  meshName: string;
  /** Extra scale applied to the slot box when placing the mesh. */
  bias: { x: number; y: number; z: number };
}

/** The full registry one era module exposes to the morph layer. */
export interface EraAnchorRegistration {
  era: EraId;
  followers: AnchorFollower[];
}

/** All slot keys in a fixed order (contract parity across eras). */
export const ANCHOR_SLOT_KEYS: readonly AnchorSlotKey[] = ['doorway', 'window', 'shelf'];

/** Build a follower registration for a named mesh on a named slot. */
export function registerFollower(
  slot: AnchorSlotKey,
  meshName: string,
  bias: { x: number; y: number; z: number } = { x: 1, y: 1, z: 1 },
): AnchorFollower {
  return { slot, meshName, bias };
}

/** Validate that a registration uses only the shared contract slots. */
export function isValidFollowerRegistration(
  registration: AnchorFollower,
): boolean {
  return ANCHOR_SLOT_KEYS.includes(registration.slot);
}