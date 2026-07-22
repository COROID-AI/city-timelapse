// ============================================================
//  SKY & ATMOSPHERE — gradient skydome, sun, fog, stars
//  Smoothly transitions between era lighting moods.
// ============================================================
import * as THREE from 'three';
import { damp, dampColor, lerp, clamp, makeRng } from './util.js';

export class SkySystem {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    // Gradient sky via large inverted sphere with shader
    const skyGeo = new THREE.SphereGeometry(400, 32, 16);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color('#3a6a9a') },
        midColor: { value: new THREE.Color('#5a8acc') },
        bottomColor: { value: new THREE.Color('#2a3a6a') },
        sunPos: { value: new THREE.Vector3(0.5, 0.3, 0.5) },
        sunColor: { value: new THREE.Color('#fff5e8') },
        starStrength: { value: 0.0 },
        time: { value: 0 },
      },
      vertexShader: /* glsl */`
        varying vec3 vWorldPos;
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 bottomColor;
        uniform vec3 sunPos;
        uniform vec3 sunColor;
        uniform float starStrength;
        uniform float time;
        varying vec3 vWorldPos;
        // hash for stars
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        void main(){
          vec3 dir = normalize(vWorldPos);
          float h = clamp(dir.y, -0.2, 1.0);
          // gradient: bottom->mid->top
          vec3 col;
          if(h < 0.25){
            col = mix(bottomColor, midColor, smoothstep(-0.2, 0.25, h));
          } else {
            col = mix(midColor, topColor, smoothstep(0.25, 0.8, h));
          }
          // sun glow
          float sd = max(dot(dir, normalize(sunPos)), 0.0);
          col += sunColor * pow(sd, 64.0) * 1.2;       // sun disk
          col += sunColor * pow(sd, 6.0) * 0.18;        // broad glow
          // horizon haze
          col = mix(col, bottomColor*1.2, pow(1.0-abs(h), 8.0)*0.5);
          // stars (only visible at night / dark eras)
          if(starStrength > 0.01){
            vec2 suv = dir.xz / max(abs(dir.y), 0.05) * 3.0;
            float s = hash(floor(suv));
            float star = step(0.992, s) * (0.6 + 0.4*sin(time*3.0 + s*100.0));
            col += vec3(star) * starStrength;
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(skyGeo, this.skyMat);
    this.sky.name = 'Sky';
    scene.add(this.sky);

    // Sun mesh (visible disc)
    const sunGeo = new THREE.SphereGeometry(8, 24, 24);
    this.sunMat = new THREE.MeshBasicMaterial({ color: 0xfff5e8, transparent: true, opacity: 0.0 });
    this.sun = new THREE.Mesh(sunGeo, this.sunMat);
    scene.add(this.sun);
    // sun glow sprite
    const glowTex = this._glowTexture();
    this.sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff5e8, transparent: true, blending: THREE.AdditiveBlending, opacity: 0.0, depthWrite: false }));
    this.sunGlow.scale.set(120, 120, 1);
    scene.add(this.sunGlow);

    // Moon for night
    this.moonMat = new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.0 });
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(5, 24, 24), this.moonMat);
    scene.add(this.moon);

    // Fog
    this.scene.fog = new THREE.FogExp2(0x5a8acc, 0.006);

    // Lights
    this.sunLight = new THREE.DirectionalLight(0xfff5e8, 1.5);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 200;
    this.sunLight.shadow.camera.left = -45;
    this.sunLight.shadow.camera.right = 45;
    this.sunLight.shadow.camera.top = 45;
    this.sunLight.shadow.camera.bottom = -45;
    this.sunLight.shadow.bias = -0.0004;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    this.ambientLight = new THREE.HemisphereLight(0x9ab0c8, 0x4a4030, 0.7);
    scene.add(this.ambientLight);

    // Clouds (a few sprites)
    this.clouds = [];
    const cloudTex = this._cloudTexture();
    for (let i = 0; i < 7; i++) {
      const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.5, depthWrite: false }));
      c.scale.set(rand(makeRng(i), 60, 110), rand(makeRng(i + 1), 20, 40), 1);
      c.position.set(rand(makeRng(i + 2), -120, 120), rand(makeRng(i + 3), 60, 95), rand(makeRng(i + 4), -120, 120));
      c.userData.speed = rand(makeRng(i + 5), 0.3, 0.9);
      scene.add(c);
      this.clouds.push(c);
    }

    this._target = null;
    this._isNight = false;
    this.reducedMotion = false;
  }

  setReducedMotion(v) { this.reducedMotion = v; }

  _glowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.2, 'rgba(255,240,200,0.6)');
    g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  _cloudTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const ctx = c.getContext('2d');
    const rng = makeRng(99);
    for (let i = 0; i < 14; i++) {
      const x = rng() * 256, y = 64 + (rng() - 0.5) * 40, r = 20 + rng() * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.7)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // Set target mood from era + day/night
  setEra(era, isNight) {
    this._isNight = isNight;
    const p = era.palette;
    if (isNight) {
      // night palette derived from era sky (darkened)
      this._target = {
        top: this._darken(p.sky[2], 0.5),
        mid: this._darken(p.sky[1], 0.55),
        bottom: this._darken(p.sky[0], 0.5),
        sunElev: -8, sunAz: era.sun.azimuth,
        sunColor: '#9ab4ff', sunInt: 0.15,
        ambSky: '#2a3a5a', ambGround: '#1a1820', ambInt: 0.35,
        star: era.id === 1985 ? 0.0 : 0.8,
        fogColor: this._darken(p.fog, 0.4), fogDensity: p.fogDensity * 1.3,
        sunOpacity: 0, glowOpacity: 0,
        moonOpacity: 0.9,
      };
    } else {
      this._target = {
        top: p.sky[2],
        mid: p.sky[1],
        bottom: p.sky[0],
        sunElev: era.sun.elevation, sunAz: era.sun.azimuth,
        sunColor: era.sun.color, sunInt: era.sun.intensity,
        ambSky: era.ambient.color, ambGround: p.ground, ambInt: era.ambient.intensity,
        star: 0.0,
        fogColor: p.fog, fogDensity: p.fogDensity,
        sunOpacity: 1, glowOpacity: 0.7,
        moonOpacity: 0,
      };
    }
  }

  _darken(hex, f) {
    const c = new THREE.Color(hex);
    c.multiplyScalar(f);
    return '#' + c.getHexString();
  }

  setNight(n) { this._isNight = n; }

  update(dt, elapsed) {
    this.skyMat.uniforms.time.value = elapsed;
    if (!this._target) return;
    const t = this._target;
    // reduced-motion: snap instantly to target (no animated transition)
    const L = this.reducedMotion ? 1000 : 1.8;

    dampColor(this.skyMat.uniforms.topColor.value, t.top, L, dt);
    dampColor(this.skyMat.uniforms.midColor.value, t.mid, L, dt);
    dampColor(this.skyMat.uniforms.bottomColor.value, t.bottom, L, dt);
    dampColor(this.skyMat.uniforms.sunColor.value, t.sunColor, L, dt);
    this.skyMat.uniforms.starStrength.value = damp(this.skyMat.uniforms.starStrength.value, t.star, L, dt);

    // sun position from elevation+azimuth
    const elev = THREE.MathUtils.degToRad(t.sunElev);
    const az = THREE.MathUtils.degToRad(t.sunAz);
    const sunDir = new THREE.Vector3(
      Math.cos(elev) * Math.cos(az),
      Math.sin(elev),
      Math.cos(elev) * Math.sin(az)
    );
    this.skyMat.uniforms.sunPos.value.copy(sunDir);
    const sunWorld = sunDir.clone().multiplyScalar(180);
    this.sun.position.copy(sunWorld);
    this.sunGlow.position.copy(sunWorld);
    this.sunLight.position.copy(sunDir.clone().multiplyScalar(60).add(new THREE.Vector3(0, 0, 0)));
    this.sunLight.target.position.set(0, 0, 0);

    damp(this.sunMat.opacity, 1, L, dt); // not used; track separately
    this.sunMat.opacity = damp(this.sunMat.opacity, t.sunOpacity, L, dt);
    this.sunGlow.material.opacity = damp(this.sunGlow.material.opacity, t.glowOpacity, L, dt);
    dampColor(this.sunGlow.material.color, t.sunColor, L, dt);
    this.moonMat.opacity = damp(this.moonMat.opacity, t.moonOpacity, L, dt);
    this.moon.position.set(-sunWorld.x * 0.6, Math.abs(sunWorld.y) + 40, -sunWorld.z * 0.6);

    // light intensity & color
    this.sunLight.intensity = damp(this.sunLight.intensity, t.sunInt, L, dt);
    dampColor(this.sunLight.color, t.sunColor, L, dt);
    dampColor(this.ambientLight.color, t.ambSky, L, dt);
    dampColor(this.ambientLight.groundColor, t.ambGround, L, dt);
    this.ambientLight.intensity = damp(this.ambientLight.intensity, t.ambInt, L, dt);

    // fog
    dampColor(this.scene.fog.color, t.fogColor, L, dt);
    this.scene.fog.density = damp(this.scene.fog.density, t.fogDensity, L, dt);

    // move clouds (disabled under reduced-motion)
    if (!this.reducedMotion) {
      this.clouds.forEach((c, i) => {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > 140) c.position.x = -140;
      });
    }
    this.clouds.forEach((c) => {
      c.material.opacity = damp(c.material.opacity, this._isNight ? 0.2 : 0.5, L, dt);
    });
  }
}

function rand(rng, a, b) { return a + rng() * (b - a); }
