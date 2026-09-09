/**
 * Shared base Entity class and contract.
 *
 * All active world entities (enemies, items, projectiles) adhere to the
 * interface consumed by entity-manager and the render pipeline:
 *
 *   {
 *     type,       // string identifier ('goomba', 'koopa', 'shell', etc.)
 *     x, y, w, h, // position and bounding box dimensions (world px)
 *     vx, vy,     // velocity components (px/s)
 *     alive,      // boolean; false marks entity for cleanup
 *     update(dt, tilemap),
 *     draw(ctx, camera),
 *     stomp(),
 *     onBump(tile),
 *   }
 */

export class Entity {
  /**
   * @param {object} options
   * @param {string} options.type entity type identifier
   * @param {number} [options.x=0] world x coordinate
   * @param {number} [options.y=0] world y coordinate
   * @param {number} [options.w=16] hitbox width
   * @param {number} [options.h=16] hitbox height
   * @param {number} [options.vx=0] horizontal velocity (px/s)
   * @param {number} [options.vy=0] vertical velocity (px/s)
   * @param {boolean} [options.alive=true] active lifecycle flag
   */
  constructor({
    type = 'entity',
    x = 0,
    y = 0,
    w = 16,
    h = 16,
    vx = 0,
    vy = 0,
    alive = true,
  } = {}) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.vx = vx;
    this.vy = vy;
    this.alive = alive;
    this.onGround = false;
    this.facing = vx >= 0 ? 1 : -1;
  }

  /**
   * Update entity physics, collision and state transitions.
   *
   * @param {number} dt delta time in seconds
   * @param {object} tilemap tilemap instance (for collision resolution)
   */
  update(dt, tilemap) {
    // Subclasses implement movement, physics and collision
  }

  /**
   * Render the entity onto a Canvas 2D context using camera coordinates.
   *
   * @param {CanvasRenderingContext2D} ctx Canvas 2D context
   * @param {object} [camera] optional camera handle with worldToScreen
   */
  draw(ctx, camera) {
    // Subclasses implement pixel-art sprite rendering
  }

  /**
   * Stomp interaction hook (e.g. Mario landing on top of the entity).
   *
   * @returns {any} outcome of stomp (e.g. squash, shell conversion)
   */
  stomp() {
    // Default no-op
  }

  /**
   * Block bump interaction hook (e.g. hit from beneath by a bumped tile).
   *
   * @param {object} [tile] tile info {tx, ty, tile, type}
   */
  onBump(tile) {
    // Default no-op
  }
}

export default Entity;
