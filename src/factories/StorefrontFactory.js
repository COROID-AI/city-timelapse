import * as THREE from 'three';
import { makeSign } from '../utils/canvasTextures.js';

// Ground-floor storefronts (awning + signage) on street-facing buildings.
const WORDS = ['CAFE', 'DINER', 'SHOP', 'BAR', 'GROCER', 'LAUNDROMAT', 'BAKERY', 'Tavern', 'MART', 'EATS', 'ARCADE', 'NOODLE', 'COFFEE', 'BIONIC', 'NEO'];

export class StorefrontFactory {
  constructor(era) {
    this.era = era;
    this.cfg = era.storefront;
    this.style = era.storefront.style;
  }

  create(b, rng) {
    const { group, plot } = b;
    const fg = rng.pick(this.cfg.palette);
    const bg = this.style === 'neon' || this.style === 'holo' ? '#0a0a12' : '#2a2620';
    const text = rng.pick(WORDS);
    const glow = this.style === 'neon' || this.style === 'holo' || this.style === 'led' || this.style === 'backlit';
    const { texture, aspect } = makeSign(text, fg, bg, { glow, holo: this.style === 'holo', sub: this.style === 'holo' ? 'OPEN' : null });

    const grp = new THREE.Group();
    const signW = Math.min(plot.w * 0.8, 6);
    const signH = signW / aspect;
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      emissive: glow ? new THREE.Color(fg) : new THREE.Color(0x000000),
      emissiveMap: glow ? texture : null,
      emissiveIntensity: glow ? (this.style === 'holo' ? 1.6 : 1.0) : 0,
      transparent: this.style === 'holo',
      opacity: this.style === 'holo' ? 0.9 : 1,
      roughness: 0.5,
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), mat);

    // orient toward nearest street
    const face = this._nearestFace(plot);
    const groundY = 2.4;
    if (face === 'pz') { sign.position.set(0, groundY, plot.d / 2 + 0.1); }
    else if (face === 'nz') { sign.position.set(0, groundY, -plot.d / 2 - 0.1); sign.rotation.y = Math.PI; }
    else if (face === 'px') { sign.position.set(plot.w / 2 + 0.1, groundY, 0); sign.rotation.y = Math.PI / 2; }
    else { sign.position.set(-plot.w / 2 - 0.1, groundY, 0); sign.rotation.y = -Math.PI / 2; }
    grp.add(sign);

    // awning for older eras
    if (this.style === 'painted' || this.style === 'block') {
      const awn = new THREE.Mesh(
        new THREE.PlaneGeometry(signW * 0.9, 1.6),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(rng.pick(this.cfg.palette)), roughness: 0.8, side: THREE.DoubleSide })
      );
      const ay = 4.0;
      if (face === 'pz') { awn.position.set(0, ay, plot.d / 2 + 0.8); awn.rotation.x = -Math.PI / 4; }
      else if (face === 'nz') { awn.position.set(0, ay, -plot.d / 2 - 0.8); awn.rotation.x = Math.PI / 4; awn.rotation.y = Math.PI; }
      else if (face === 'px') { awn.position.set(plot.w / 2 + 0.8, ay, 0); awn.rotation.x = -Math.PI / 4; awn.rotation.y = Math.PI / 2; }
      else { awn.position.set(-plot.w / 2 - 0.8, ay, 0); awn.rotation.x = -Math.PI / 4; awn.rotation.y = -Math.PI / 2; }
      grp.add(awn);
    }

    const anchor = new THREE.Vector3(plot.x, 0, plot.z);
    return { group: grp, anchor };
  }

  _nearestFace(plot) {
    const dx = plot.x, dz = plot.z;
    if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? 'px' : 'nx';
    return dz > 0 ? 'pz' : 'nz';
  }
}
