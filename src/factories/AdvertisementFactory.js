import * as THREE from 'three';
import { makeSign } from '../utils/canvasTextures.js';

// Rooftop / wall advertisements. Holographic floating panels for future eras.
const ADS = ['COLA', 'TV', 'RADIO', 'ENERGY', 'FLY', 'MESH', 'QUANTUM', 'NEO-TOKYO', 'SKYLINE', 'CHASE', 'TRUST', 'AERO', 'CYBER', 'FUSION'];

export class AdvertisementFactory {
  constructor(era) {
    this.era = era;
    this.cfg = era.ad;
    this.style = era.ad.style;
  }

  create(b, rng) {
    const { group, plot } = b;
    const baseHeight = group.userData.baseHeight || 20;
    const fg = rng.pick(this.cfg.palette);
    const text = rng.pick(ADS);
    const isHolo = this.style === 'holo';
    const glow = this.style !== 'painted';
    const bg = isHolo ? '#04060a' : '#15121a';
    const { texture, aspect } = makeSign(text, fg, bg, { glow, holo: isHolo, big: true });

    const grp = new THREE.Group();
    const w = Math.min(plot.w * 0.9, 7);
    const h = w / aspect;
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      emissive: glow ? new THREE.Color(fg) : new THREE.Color(0x000000),
      emissiveMap: glow ? texture : null,
      emissiveIntensity: glow ? (isHolo ? 1.8 : 1.1) : 0,
      transparent: isHolo,
      opacity: isHolo ? 0.85 : 1,
      side: THREE.DoubleSide,
      roughness: 0.4,
    });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);

    if (this.style === 'painted') {
      // wall poster mid-height
      const face = plot.x > 0 ? 'px' : 'nx';
      if (face === 'px') { panel.position.set(plot.w / 2 + 0.1, baseHeight * 0.5, 0); panel.rotation.y = Math.PI / 2; }
      else { panel.position.set(-plot.w / 2 - 0.1, baseHeight * 0.5, 0); panel.rotation.y = -Math.PI / 2; }
    } else {
      // rooftop billboard
      panel.position.set(0, baseHeight + h / 2 + 0.5, 0);
      panel.rotation.y = rng.range(0, Math.PI);
      if (isHolo) {
        // floating holo panel hovering above roof, bobbing
        panel.position.y = baseHeight + 4;
      }
      // support poles for billboards
      if (!isHolo) {
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.5, roughness: 0.5 });
        for (const sx of [-1, 1]) {
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 6), poleMat);
          pole.position.set(sx * w * 0.35, baseHeight + 1.5, 0);
          grp.add(pole);
        }
      }
    }
    grp.add(panel);

    if (isHolo) {
      const baseY = baseHeight + 4;
      const update = (dt, elapsed) => { panel.position.y = baseY + Math.sin(elapsed * 1.2 + plot.x) * 0.5; panel.rotation.y += dt * 0.3; };
      grp.userData.holoUpdate = update;
    }

    const anchor = new THREE.Vector3(plot.x, 0, plot.z);
    return { group: grp, anchor };
  }
}
