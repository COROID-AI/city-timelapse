import * as THREE from 'three';
import { WORLD, TRANSITION } from '../core/constants.js';
import { CityBlock } from './CityBlock.js';
import { setOpacity } from '../utils/materials.js';

// Drives era-to-era changes. A glowing "time wave" sweeps diagonally across the
// city; each element's opacity is a function of how far the wave front has
// progressed past its world anchor, so old content fades out and new content
// fades in, staggered by position.
export class EraTransitionManager {
  constructor(scene) {
    this.scene = scene;
    this.current = null; // { block, eraKey }
    this.incoming = null;
    this.t = 0; // 0..1 progress
    this.active = false;
    this.onComplete = null;

    // sweep direction: diagonal across the block
    this.dir = new THREE.Vector3(1, 0, 1).normalize();
    const span = WORLD.half * 1.7; // projection half-extent
    this.minProj = -span;
    this.maxProj = span;
    this.span = this.maxProj - this.minProj;
    this.band = this.span * TRANSITION.waveFade;

    this.wave = this._makeWave();
    this.wave.visible = false;
    this.scene.add(this.wave);
  }

  _makeWave() {
    const H = 200;
    const W = WORLD.half * 3;
    const geo = new THREE.PlaneGeometry(W, H);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      fog: false,
      uniforms: { color: { value: new THREE.Color('#9af6ff') }, opacity: { value: 0.0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec2 vUv; uniform vec3 color; uniform float opacity;
        void main(){
          float edge = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
          float xfade = smoothstep(1.0, 0.5, abs(vUv.x - 0.5) * 2.0);
          float core = pow(xfade, 2.0);
          gl_FragColor = vec4(color, opacity * edge * (0.35 + 0.65*core));
        }
      `,
    });
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 50;
    return m;
  }

  setInitial(era, eraKey) {
    if (this.current) {
      this.scene.remove(this.current.block.group);
      this.current.block.group.traverse(disposeNode);
    }
    const block = new CityBlock(era, eraKey);
    block.group.visible = true;
    setBlockOpacity(block, 1);
    this.scene.add(block.group);
    this.current = { block, eraKey };
  }

  getCurrentBlock() {
    return (this.current && this.current.block) || (this.incoming && this.incoming.block);
  }

  transitionTo(era, eraKey, onComplete) {
    // If a transition is mid-flight, snap old incoming to full and drop it.
    if (this.active && this.incoming) {
      this.scene.remove(this.incoming.block.group);
      this.incoming.block.group.traverse(disposeNode);
      this.incoming = null;
    }
    if (this.current && this.current.eraKey === eraKey) {
      if (onComplete) onComplete();
      return;
    }

    const block = new CityBlock(era, eraKey);
    block.group.visible = true;
    setBlockOpacity(block, 0);
    this.scene.add(block.group);
    this.incoming = { block, eraKey };
    this.t = 0;
    this.active = true;
    this.onComplete = onComplete || null;

    // color the wave to match incoming era
    const ac = era.sky.bottom;
    this.wave.material.uniforms.color.value.set(ac);
    this.wave.visible = true;
  }

  _proj(anchor) {
    return anchor.x * this.dir.x + anchor.z * this.dir.z;
  }

  _nodeFade(p, front) {
    // how much the wave has covered this node: 0 before band, 1 after band
    const d = front - p;
    return THREE.MathUtils.clamp(d / this.band, 0, 1);
  }

  update(dt, elapsed) {
    if (this.current) this.current.block.update(dt, elapsed);
    if (this.incoming) this.incoming.block.update(dt, elapsed);

    if (!this.active) return;

    this.t += dt / TRANSITION.duration;
    const eased = easeInOutCubic(Math.min(this.t, 1));
    const front = this.minProj + eased * this.span;

    // position + orient wave wall at the front
    this.wave.position.set(this.dir.x * front, 50, this.dir.z * front);
    this.wave.lookAt(this.wave.position.x + this.dir.x, 50, this.wave.position.z + this.dir.z);
    const wEnv = Math.sin(Math.min(this.t, 1) * Math.PI);
    this.wave.material.uniforms.opacity.value = 0.85 * wEnv;

    // fade each node of current (out) and incoming (in)
    if (this.current) {
      for (const n of this.current.block.fadeNodes) {
        const f = this._nodeFade(this._proj(n.anchor), front);
        setOpacity(n.obj, 1 - f);
      }
    }
    if (this.incoming) {
      for (const n of this.incoming.block.fadeNodes) {
        const f = this._nodeFade(this._proj(n.anchor), front);
        setOpacity(n.obj, f);
      }
    }

    if (this.t >= 1) {
      this._finish();
    }
  }

  _finish() {
    this.active = false;
    this.wave.visible = false;
    // finalize opacities
    if (this.incoming) {
      setBlockOpacity(this.incoming.block, 1);
    }
    if (this.current) {
      this.scene.remove(this.current.block.group);
      this.current.block.group.traverse(disposeNode);
    }
    this.current = this.incoming;
    this.incoming = null;
    const cb = this.onComplete;
    this.onComplete = null;
    if (cb) cb();
  }
}

function setBlockOpacity(block, value) {
  for (const n of block.fadeNodes) setOpacity(n.obj, value);
}

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function disposeNode(child) {
  if (child.isMesh) {
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const m of mats) m && m.dispose && m.dispose();
    if (child.geometry && child.geometry.dispose) child.geometry.dispose();
  }
}
