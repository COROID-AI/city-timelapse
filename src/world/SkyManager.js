import * as THREE from 'three';

// Gradient sky dome (top/mid/bottom) + optional sun disc + stars for night eras.
export class SkyManager {
  constructor(scene) {
    this.scene = scene;
    this.dome = this._makeDome();
    this.scene.add(this.dome);

    this.sun = new THREE.Mesh(
      new THREE.CircleGeometry(8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, fog: false })
    );
    this.sun.renderOrder = -1;
    this.scene.add(this.sun);

    this.stars = this._makeStars();
    this.stars.visible = false;
    this.scene.add(this.stars);
  }

  _makeDome() {
    const geo = new THREE.SphereGeometry(600, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color('#000020') },
        mid: { value: new THREE.Color('#202040') },
        bottom: { value: new THREE.Color('#606080') },
      },
      vertexShader: `
        varying vec3 vPos;
        void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        varying vec3 vPos;
        uniform vec3 top; uniform vec3 mid; uniform vec3 bottom;
        void main(){
          float h = normalize(vPos).y; // -1..1
          vec3 col;
          if(h > 0.0){ col = mix(mid, top, smoothstep(0.0, 0.6, h)); }
          else { col = mix(mid, bottom, smoothstep(0.0, 0.4, -h)); }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = -2;
    return m;
  }

  _makeStars() {
    const n = 700;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 580;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.5; // upper hemisphere
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.9, fog: false });
    return new THREE.Points(geo, mat);
  }

  apply(era) {
    const s = era.sky;
    this.dome.material.uniforms.top.value.set(s.top);
    this.dome.material.uniforms.mid.value.set(s.mid);
    this.dome.material.uniforms.bottom.value.set(s.bottom);

    // Sun position
    const dir = new THREE.Vector3(...era.light.dirPos).normalize();
    this.sun.position.copy(dir.clone().multiplyScalar(420));
    this.sun.lookAt(0, 0, 0);
    this.sun.material.color.set(s.sun);
    this.sun.visible = true;

    // Stars for dark eras
    const dark = s.top;
    const lum = new THREE.Color(dark).getHSL({}).l;
    this.stars.visible = lum < 0.32;
  }

  update(dt, elapsed) {
    if (this.stars.visible) {
      this.stars.rotation.y += dt * 0.005;
    }
  }
}
