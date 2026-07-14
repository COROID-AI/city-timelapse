import * as THREE from 'three';

// Manages a ~1.5-2s crossfade between an outgoing CityBlock and an incoming
// one by animating material opacity and group scale. Handles multi-material
// meshes and shared materials (a material may appear in both blocks; we track
// per-block opacity targets).
export class TransitionManager {
  constructor(scene) {
    this.scene = scene;
    this.current = null;     // { block, eraIndex }
    this.duration = 1.8;     // seconds
    this.active = null;      // { outgoing, incoming, t, onDone }
  }

  // Set the initial block with no transition.
  setInitial(block) {
    if (this.current) this.scene.remove(this.current.block);
    this.current = { block, eraIndex: block.userData.eraIndex };
    this.scene.add(block);
    block.position.set(0, 0, 0);
    block.scale.setScalar(1);
    block.traverse((c) => { if (c.isMesh) this._setVisible(c, true); });
  }

  // Begin a crossfade to a new block.
  transitionTo(newBlock, onDone) {
    if (!this.current) { this.setInitial(newBlock); if (onDone) onDone(); return; }
    const outgoing = this.current.block;
    const incoming = newBlock;

    // Place incoming slightly scaled and fade in.
    // Start fully transparent to avoid a one-frame flash at full opacity.
    this._setBlockOpacity(newBlock, 0);
    incoming.scale.setScalar(0.96);
    incoming.position.set(0, 0, 0);
    this.scene.add(incoming);
    incoming.traverse((c) => { if (c.isMesh) this._setVisible(c, true); });

    this.active = { outgoing, incoming, t: 0, onDone };
  }

  update(dt) {
    if (!this.active) return;
    const a = this.active;
    a.t += dt;
    const p = Math.min(1, a.t / this.duration);
    const eased = easeInOutCubic(p);

    // outgoing fades out, sinks slightly
    this._setBlockOpacity(a.outgoing, 1 - eased);
    a.outgoing.scale.setScalar(THREE.MathUtils.lerp(1, 0.94, eased));
    a.outgoing.position.y = THREE.MathUtils.lerp(0, -1.2, eased);

    // incoming fades in, rises slightly
    this._setBlockOpacity(a.incoming, eased);
    a.incoming.scale.setScalar(THREE.MathUtils.lerp(0.96, 1, eased));
    a.incoming.position.y = THREE.MathUtils.lerp(1.2, 0, eased);

    if (p >= 1) {
      this.scene.remove(a.outgoing);
      this._disposeBlock(a.outgoing);
      this._resetBlockOpacity(a.incoming);
      this.current = { block: a.incoming, eraIndex: a.incoming.userData.eraIndex };
      a.incoming.scale.setScalar(1);
      a.incoming.position.y = 0;
      const cb = a.onDone;
      this.active = null;
      if (cb) cb();
    }
  }

  get currentBlock() { return this.current ? this.current.block : null; }
  get currentEraIndex() { return this.current ? this.current.eraIndex : 0; }
  get isTransitioning() { return this.active !== null; }

  // --- internals ---
  _setBlockOpacity(block, opacity) {
    const mats = block.userData.allMaterials;
    if (!mats) return;
    for (let i = 0; i < mats.length; i++) {
      const m = mats[i];
      m.transparent = true;
      // preserve holographic semi-transparent finish cap
      const cap = (m.userData && m.userData.origOpacity !== undefined) ? m.userData.origOpacity : 1;
      m.opacity = Math.min(opacity, cap);
      m.depthWrite = m.opacity > 0.9 && cap >= 1;
      m.needsUpdate = true;
    }
  }

  _resetBlockOpacity(block) {
    const mats = block.userData.allMaterials;
    if (!mats) return;
    for (let i = 0; i < mats.length; i++) {
      const m = mats[i];
      if (m.userData && m.userData.origOpacity !== undefined) {
        m.opacity = m.userData.origOpacity;
        m.transparent = true;
      } else {
        m.opacity = 1;
        m.transparent = false;
      }
      m.depthWrite = true;
      m.needsUpdate = true;
    }
  }

  _setVisible(mesh, visible) {
    mesh.visible = true; // keep visible during fade so opacity shows
  }

  _disposeBlock(block) {
    block.traverse((c) => {
      if (c.isMesh && c.geometry) c.geometry.dispose();
    });
  }
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Mark a material as a "finish" material that should remain semi-transparent
// after a transition (e.g. holographic). Call when building such materials.
export function markFinishMaterial(material, opacity) {
  material.userData = material.userData || {};
  material.userData.origOpacity = opacity;
}
