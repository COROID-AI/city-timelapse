import * as THREE from 'three';
import type { EraConfig } from '../types';
import { toColor } from '../three-helpers';

/**
 * Procedural gradient sky dome, sun disc + light, exponential fog, stars,
 * and simple billboard clouds. Everything is driven by the blended EraConfig.
 */
export class Sky {
  group = new THREE.Group();

  sun: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
  hemi: THREE.HemisphereLight;

  private skyMat: THREE.ShaderMaterial;
  private sunMesh: THREE.Mesh;
  private sunMat: THREE.MeshBasicMaterial;
  private stars: THREE.Points;
  private starsMat: THREE.PointsMaterial;
  private cloudGroup = new THREE.Group();
  private cloudMats: THREE.SpriteMaterial[] = [];

  constructor() {
    // --- Gradient sky dome ---
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x5a6b8c) },
        bottomColor: { value: new THREE.Color(0xcab29a) },
        offset: { value: 8 },
        exponent: { value: 0.7 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos + vec3(0.0, offset, 0.0)).y;
          float t = pow(max(h, 0.0), exponent);
          gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
        }
      `,
    });
    const skyGeo = new THREE.SphereGeometry(300, 32, 16);
    const sky = new THREE.Mesh(skyGeo, this.skyMat);
    this.group.add(sky);

    // --- Sun disc ---
    this.sunMat = new THREE.MeshBasicMaterial({
      color: 0xffaa55,
      fog: false,
      toneMapped: false,
    });
    const sunGeo = new THREE.CircleGeometry(8, 24);
    this.sunMesh = new THREE.Mesh(sunGeo, this.sunMat);
    this.group.add(this.sunMesh);

    // --- Lights ---
    this.sun = new THREE.DirectionalLight(0xffaa55, 1.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 200;
    const sc = this.sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -55;
    sc.right = 55;
    sc.top = 55;
    sc.bottom = -55;
    this.sun.shadow.bias = -0.0004;
    this.group.add(this.sun);
    this.group.add(this.sun.target);

    this.ambient = new THREE.AmbientLight(0x556677, 0.5);
    this.group.add(this.ambient);

    this.hemi = new THREE.HemisphereLight(0x88aaff, 0x443322, 0.5);
    this.group.add(this.hemi);

    // --- Stars ---
    const starCount = 1200;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      // distribute on upper hemisphere of the sky dome
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.85 + 0.05); // bias upward
      const r = 280;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starsMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.4,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      fog: false,
      depthWrite: false,
    });
    this.stars = new THREE.Points(starGeo, this.starsMat);
    this.group.add(this.stars);

    // --- Clouds (billboard sprites) ---
    const cloudTex = this.makeCloudTexture();
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.SpriteMaterial({
        map: cloudTex,
        transparent: true,
        opacity: 0.6,
        fog: true,
        depthWrite: false,
      });
      this.cloudMats.push(mat);
      const sprite = new THREE.Sprite(mat);
      const ang = (i / 14) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 120 + Math.random() * 100;
      sprite.position.set(
        Math.cos(ang) * dist,
        55 + Math.random() * 30,
        Math.sin(ang) * dist,
      );
      const scl = 40 + Math.random() * 35;
      sprite.scale.set(scl, scl * 0.5, 1);
      this.cloudGroup.add(sprite);
    }
    this.group.add(this.cloudGroup);
  }

  private cloudTex?: THREE.CanvasTexture;
  private makeCloudTexture(): THREE.CanvasTexture {
    if (this.cloudTex) return this.cloudTex;
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    // Several overlapping soft blobs
    for (let i = 0; i < 6; i++) {
      const cx = size * (0.3 + Math.random() * 0.4);
      const cy = size * (0.4 + Math.random() * 0.2);
      const r = size * (0.12 + Math.random() * 0.12);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, 'rgba(255,255,255,0.5)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }
    this.cloudTex = new THREE.CanvasTexture(canvas);
    this.cloudTex.colorSpace = THREE.SRGBColorSpace;
    return this.cloudTex;
  }

  update(cfg: EraConfig, time: number): void {
    // Sky gradient
    this.skyMat.uniforms.topColor.value.copy(toColor(cfg.skyTop));
    this.skyMat.uniforms.bottomColor.value.copy(toColor(cfg.skyBottom));

    // Sun position from azimuth/elevation
    const az = (cfg.sunAzimuth * Math.PI) / 180;
    const el = (cfg.sunElevation * Math.PI) / 180;
    const dist = 150;
    const sx = Math.cos(el) * Math.cos(az) * dist;
    const sy = Math.sin(el) * dist;
    const sz = Math.cos(el) * Math.sin(az) * dist;
    this.sun.position.set(sx, sy, sz);
    this.sun.target.position.set(0, 0, 0);
    this.sun.color.copy(toColor(cfg.sunColor));
    this.sun.intensity = cfg.sunIntensity;

    // Sun disc faces camera-ish; position it along the light direction
    this.sunMesh.position.set(sx * 0.85, sy * 0.85, sz * 0.85);
    this.sunMesh.lookAt(0, 0, 0);
    this.sunMat.color.copy(toColor(cfg.sunColor));

    // Ambient / hemi
    this.ambient.color.copy(toColor(cfg.ambientColor));
    this.ambient.intensity = cfg.ambientIntensity;
    this.hemi.color.copy(toColor(cfg.hemiSky));
    this.hemi.groundColor.copy(toColor(cfg.hemiGround));
    this.hemi.intensity = cfg.hemiIntensity;

    // Stars
    this.starsMat.opacity = cfg.starsIntensity;
    this.stars.rotation.y = time * 0.005;

    // Clouds
    const cloudOp = cfg.cloudiness * 0.7;
    for (const m of this.cloudMats) m.opacity = cloudOp;
    this.cloudGroup.rotation.y = time * 0.003;
  }

  /** Exponential fog colour/density must be applied on the scene itself. */
  applyFog(scene: THREE.Scene, cfg: EraConfig): void {
    if (!scene.fog || !(scene.fog instanceof THREE.FogExp2)) {
      scene.fog = new THREE.FogExp2(0x000000, 0.01);
    }
    const fog = scene.fog as THREE.FogExp2;
    fog.color.copy(toColor(cfg.fogColor));
    fog.density = cfg.fogDensity;
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
        o.geometry.dispose();
      }
    });
    this.skyMat.dispose();
    this.sunMat.dispose();
    this.starsMat.dispose();
    this.cloudTex?.dispose();
    for (const m of this.cloudMats) m.dispose();
  }
}
