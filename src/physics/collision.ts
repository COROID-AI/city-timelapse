/**
 * Collision Detection - Simple collision detection to prevent camera from moving through buildings and objects
 */

import * as THREE from 'three';

export interface Collider {
  position: THREE.Vector3;
  size: THREE.Vector3;
}

export class CollisionSystem {
  private colliders: Collider[] = [];

  /**
   * Add colliders to the system
   */
  addCollider(collider: Collider): void {
    this.colliders.push(collider);
  }

  /**
   * Check and resolve camera position against all colliders
   */
  checkCollision(position: THREE.Vector3, radius: number = 1.7): THREE.Vector3 {
    const safePosition = position.clone();
    
    // Check world bounds
    safePosition.x = THREE.MathUtils.clamp(safePosition.x, -40, 40);
    safePosition.y = THREE.MathUtils.clamp(safePosition.y, 1, 20);
    safePosition.z = THREE.MathUtils.clamp(safePosition.z, -40, 20);
    
    // Check against colliders
    for (const collider of this.colliders) {
      const distance = safePosition.distanceTo(collider.position);
      const minDist = Math.sqrt(
        (collider.size.x / 2 + radius) ** 2 +
        (collider.size.z / 2 + radius) ** 2
      );
      
      if (distance < minDist) {
        // Push camera away from collider
        const dir = safePosition.clone().sub(collider.position).normalize();
        safePosition.add(dir.multiplyScalar(minDist - distance + 0.1));
      }
    }
    
    return safePosition;
  }

  /**
   * Clear all colliders
   */
  clear(): void {
    this.colliders = [];
  }

  /**
   * Get colliders list
   */
  getColliders(): Collider[] {
    return this.colliders;
  }
}