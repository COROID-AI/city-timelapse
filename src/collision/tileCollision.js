/**
 * Tile collision resolver — the single collision authority.
 *
 * moveAndCollide(body, tilemap, dt, hooks) advances a body through the
 * tilemap resolving contacts axis by axis (X then Y, classically) against
 * every solid tile. Terrain, stone, bricks, used blocks, ?-blocks and pipe
 * parts are treated uniformly through the tilemap's solidity API — no
 * per-tile-type geometry.
 *
 * Sub-stepping: each sub-step moves a body at most MAX_SUBSTEP_PX (8px)
 * along either axis. Because tiles are 16px wide this guarantees a body can
 * never cross a whole tile inside one step, so nothing tunnels through a
 * platform even while falling at TERMINAL_VELOCITY.
 *
 * Contact outcomes (accumulated across all sub-steps, returned as
 * { hitWall, hitHead, landed }):
 *  - Horizontal contact snaps the body flush against the tile side and
 *    reports hitWall (velocity vx is zeroed so wall-sliding stays classic).
 *  - Downward contact parks the body on top of the tile, sets body.onGround
 *    and reports landed.
 *  - Upward head contact parks the body beneath the tile underside and
 *    reports hitHead. The single nearest overlapped tile is chosen and
 *    hooks.onBlockHit(tx, ty, info) is called exactly once; the returned
 *    action is applied:
 *        'bump'  (default) -> tilemap.bumpBlock(tx, ty)
 *        'break'           -> brick turns to air and plays its bump animation
 *        'ignore'          -> tile left untouched
 *
 * Pure geometry module: no rendering, no entity logic. Entities and the
 * manager decide the game consequences of each event from the result flags
 * and the info object handed to onBlockHit.
 */

import { TILES } from '../world/tilemap.js';

/**
 * Maximum per-axis travel within a single collision sub-step (px).
 * Kept at half the 16px tile size so no step can span a full tile — this is
 * what provably prevents tunneling at TERMINAL_VELOCITY.
 */
export const MAX_SUBSTEP_PX = 8;

/** Tiny offset to treat tile edges as half-open spans (left/top inclusive). */
const EPSILON = 0.0001;

/**
 * Support tolerance (px): a body whose feet are within this distance above
 * a solid tile's top surface is still considered grounded by it. Keeps a
 * resting body rock-solid without requiring exact float equality.
 */
const SUPPORT_EPSILON = 0.75;

/**
 * True when the tile at grid coordinate (tx, ty) is solid. Out-of-bounds
 * tiles (tileAt returning null) are never solid.
 */
function solidAt(tilemap, tx, ty) {
  const code = tilemap.tileAt(tx, ty);
  return code != null && tilemap.isSolidTile(code);
}

/**
 * Resolve one sub-step of horizontal motion.
 *
 * The leading edge (the side facing the motion) is swept across every tile
 * column it crosses between the pre- and post-move positions; the first
 * solid tile found snaps the body flush against that side. Only the leading
 * edge is considered, so the body may slide along walls it merely touches.
 *
 * @returns {boolean} True when a wall contact was resolved.
 */
function resolveX(body, tilemap, stepDx) {
  if (stepDx === 0) {
    return false;
  }
  const ts = tilemap.tileSize;
  const ty0 = Math.floor(body.y / ts);
  const ty1 = Math.floor((body.y + body.h - EPSILON) / ts);

  if (stepDx > 0) {
    const oldRight = body.x + body.w;
    const newRight = oldRight + stepDx;
    const tx0 = Math.floor(oldRight / ts);
    const tx1 = Math.floor((newRight - EPSILON) / ts);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (solidAt(tilemap, tx, ty)) {
          body.x = tx * ts - body.w;
          return true;
        }
      }
    }
  } else {
    const oldLeft = body.x;
    const newLeft = oldLeft + stepDx;
    const tx0 = Math.floor(newLeft / ts);
    const tx1 = Math.floor((oldLeft - EPSILON) / ts);
    for (let ty = ty0; ty <= ty1; ty++) {
      // Descending tx: the rightmost solid tile in the crossed range is the
      // one whose right edge the leading edge actually strikes first.
      for (let tx = tx1; tx >= tx0; tx--) {
        if (solidAt(tilemap, tx, ty)) {
          body.x = (tx + 1) * ts;
          return true;
        }
      }
    }
  }
  // No wall crossed: integrate the horizontal step.
  body.x += stepDx;
  return false;
}

/**
 * Resolve one sub-step of downward motion: the falling feet sweep the rows
 * crossed between the old and new bottom edges. The first solid row lands
 * the body flush on top of it.
 *
 * @returns {boolean} True when the body landed.
 */
function resolveYDown(body, tilemap, stepDy) {
  const ts = tilemap.tileSize;
  const oldBottom = body.y + body.h;
  const newBottom = oldBottom + stepDy;
  const ty0 = Math.floor(oldBottom / ts);
  const ty1 = Math.floor((newBottom - EPSILON) / ts);
  const tx0 = Math.floor(body.x / ts);
  const tx1 = Math.floor((body.x + body.w - EPSILON) / ts);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (solidAt(tilemap, tx, ty)) {
        body.y = ty * ts - body.h;
        return true;
      }
    }
  }
  // No floor crossed: integrate the downward step.
  body.y += stepDy;
  return false;
}

/**
 * Picks the single nearest solid tile among columns (txStart..txEnd) of row
 * `ty`: the tile whose horizontal span most overlaps the body's current
 * x-range. Ties resolve to the leftmost column for determinism.
 *
 * @returns {{tx: number, ty: number}|null} The chosen tile, or null.
 */
function nearestOverlappedTile(tilemap, body, txStart, txEnd, ty) {
  const ts = tilemap.tileSize;
  let best = null;
  let bestOverlap = -1;
  for (let tx = txStart; tx <= txEnd; tx++) {
    if (!solidAt(tilemap, tx, ty)) {
      continue;
    }
    const overlap = Math.min(body.x + body.w, (tx + 1) * ts)
      - Math.max(body.x, tx * ts);
    if (overlap > bestOverlap
      || (overlap === bestOverlap && (best === null || tx < best.tx))) {
      best = { tx, ty };
      bestOverlap = overlap;
    }
  }
  return best;
}

/**
 * Resolve one sub-step of upward motion: the head sweeps the rows crossed
 * between the old and new top edges; the first solid row found parks the
 * body flush beneath it. The single nearest overlapped tile in that row is
 * returned so the caller can fire the block-hit event exactly once.
 *
 * @returns {{tx: number, ty: number}|null} The hit tile, or null.
 */
function resolveYUp(body, tilemap, stepDy) {
  const ts = tilemap.tileSize;
  const oldTop = body.y;
  const newTop = oldTop + stepDy;
  const ty0 = Math.floor(newTop / ts);
  const ty1 = Math.floor((oldTop - EPSILON) / ts);
  const tx0 = Math.floor(body.x / ts);
  const tx1 = Math.floor((body.x + body.w - EPSILON) / ts);
  // Descending ty: the solid row closest to the old (pre-move) top edge is
  // the one the head actually strikes first while rising.
  for (let ty = ty1; ty >= ty0; ty--) {
    const tile = nearestOverlappedTile(tilemap, body, tx0, tx1, ty);
    if (tile) {
      body.y = (tile.ty + 1) * ts;
      return tile;
    }
  }
  // No ceiling crossed: integrate the upward step.
  body.y += stepDy;
  return null;
}

/**
 * Fire the block-hit protocol for a head impact: call
 * hooks.onBlockHit(tx, ty, info) exactly once and apply the returned action
 * ('bump' by default, 'break', or 'ignore').
 */
function applyBlockHit(tile, tilemap, hooks) {
  const { tx, ty } = tile;
  const code = tilemap.tileAt(tx, ty);
  const entry = tilemap.getBlockContents ? tilemap.getBlockContents(tx, ty) : null;
  const info = {
    tx,
    ty,
    tile: code,
    type: entry ? entry.type : null,
  };

  let action = 'bump';
  if (hooks && typeof hooks.onBlockHit === 'function') {
    action = hooks.onBlockHit(tx, ty, info);
  }
  if (action !== 'break' && action !== 'ignore') {
    action = 'bump';
  }

  if (action === 'break') {
    // Breakable brick: keep the bump bounce, then turn the tile to air so
    // the brick fragment/particle layer (owned by entities) can animate it.
    tilemap.bumpBlock(tx, ty);
    tilemap.setTile(tx, ty, TILES.EMPTY);
    if (entry) {
      entry.depleted = true;
      entry.hitsRemaining = 0;
    }
  } else if (action === 'ignore') {
    // Leave the tile exactly as it was.
  } else {
    tilemap.bumpBlock(tx, ty);
  }
}

/**
 * True when a solid tile directly supports the body's feet right now. Used
 * at the end of the frame to keep onGround honest: a body resting on ground
 * stays grounded; one that walked off a ledge detaches.
 */
function isSupportedByGround(body, tilemap) {
  const ts = tilemap.tileSize;
  const feet = body.y + body.h;
  const ty = Math.floor((feet + SUPPORT_EPSILON) / ts);
  const tx0 = Math.floor(body.x / ts);
  const tx1 = Math.floor((body.x + body.w - EPSILON) / ts);
  for (let tx = tx0; tx <= tx1; tx++) {
    if (solidAt(tilemap, tx, ty)) {
      return true;
    }
  }
  return false;
}

/**
 * Advance a body through the tilemap for one frame, resolving tile
 * collisions X-then-Y per sub-step.
 *
 * @param {object} body Body produced by createBody (x, y, w, h, vx, vy).
 *   Position and velocities are mutated in place; onGround is refreshed.
 * @param {object} tilemap Tilemap instance (createTilemap output) exposing
 *   tileSize, tileAt, isSolidTile, setTile, getBlockContents and bumpBlock.
 * @param {number} dt Frame duration in seconds.
 * @param {object} [hooks] Optional callbacks; only onBlockHit is consumed.
 * @param {function} [hooks.onBlockHit] (tx, ty, info) -> 'bump'|'break'|'ignore'.
 * @returns {{hitWall: boolean, hitHead: boolean, landed: boolean}}
 *   One flag per axis contact that occurred this frame.
 */
export function moveAndCollide(body, tilemap, dt, hooks) {
  const result = { hitWall: false, hitHead: false, landed: false };
  hooks = hooks || {};

  if (dt <= 0) {
    // Non-positive frame: nothing moves and no contacts are reported, so
    // callers can safely call with dt=0 while keeping the body intact.
    return result;
  }

  // Split the frame into equal sub-steps small enough that neither axis
  // can ever cross a whole tile (see MAX_SUBSTEP_PX).
  const farthest = Math.max(Math.abs(body.vx * dt), Math.abs(body.vy * dt));
  const stepCount = Math.max(1, Math.ceil(farthest / MAX_SUBSTEP_PX));
  const stepDt = dt / stepCount;

  for (let step = 0; step < stepCount; step++) {
    // X axis first, then Y — axis-separated resolution, so wall hits and
    // head bumps resolve independently and wall-sliding stays classic.
    const stepDx = body.vx * stepDt;
    if (stepDx !== 0 && resolveX(body, tilemap, stepDx)) {
      body.vx = 0;
      result.hitWall = true;
    }

    const stepDy = body.vy * stepDt;
    if (stepDy !== 0) {
      if (stepDy > 0) {
        if (resolveYDown(body, tilemap, stepDy)) {
          body.vy = 0;
          body.onGround = true;
          result.landed = true;
        }
      } else {
        const tile = resolveYUp(body, tilemap, stepDy);
        if (tile) {
          body.vy = 0;
          result.hitHead = true;
          applyBlockHit(tile, tilemap, hooks);
        }
      }
    }
  }

  // End of frame: refresh onGround from actual support so a resting body
  // stays grounded while one that left a ledge detaches.
  body.onGround = isSupportedByGround(body, tilemap);

  return result;
}