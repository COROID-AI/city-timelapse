/**
 * Sky and atmosphere module.
 * Renders a gradient sky sphere with era-appropriate colors and fog.
 * Also manages particle atmosphere (dust, smog, neon flakes).
 */
import * as THREE from 'three';
import type { EraId } from '../eras';
import type { AppState } from '../state';

interface SkySpec {
  /** Sky color at zenith */
  skyTop: THREE.Color;
  /** Sky color at horizon */
  skyBottom: THREE.Color;
  /** Sun color */
  sunColor: THREE.Color;
  /** Sun intensity */
  sunIntensity: number;
  /** Fog color */
  fogColor: THREE.Color;
  /** Fog density */
  fogDensity: number;
  /** Particle color */
  particleColor: THREE.Color;
  /** Particle density (0..1) */
  particleDensity: number;
  /** Particle size */
  particleSize: number;
}

const SKY_SPECS: Record<EraId, SkySpec> = {
  '1945': {
    skyTop: new THREE.Color(0x87ceeb),
    skyBottom: new THREE.Color(0xf0e6d2),
    sunColor: new THREE.Color(0xffddaa),
    sunIntensity: 0.8,
    fogColor: new THREE.Color(0xd2b48c),
    fogDensity: 0.001,
    particleColor: new THREE.Color(0xc2b280),
    particleDensity: 0.3,
    particleSize: 0.5,
  },
  '1965': {
    skyTop: new THREE.Color(0x87ceeb),
    skyBottom: new THREE.Color(0xf0e6d2),
    sunColor: new THREE.Color(0xffeecc),
    sunIntensity: 0.9,
    fogColor: new THREE.Color(0xe0d0b0),
    fogDensity: 0.0008,
    particleColor: new THREE.Color(0xffd700),
    particleDensity: 0.2,
    particleSize: 0.4,
  },
  '1985': {
    skyTop: new THREE.Color(0x4a4a6a),
    skyBottom: new THREE.Color(0x8a6a4a),
    sunColor: new THREE.Color(0xffaa33),
    sunIntensity: 0.7,
    fogColor: new THREE.Color(0x5a4a3a),
    fogDensity: 0.002,
    particleColor: new THREE.Color(0xff0066),
    particleDensity: 0.4,
    particleSize: 0.3,
  },
  '2005': {
    skyTop: new THREE.Color(0x4a6a8a),
    skyBottom: new THREE.Color(0x8a8a6a),
    sunColor: new THREE.Color(0xffeeaa),
    sunIntensity: 0.9,
    fogColor: new THREE.Color(0x6a6a6a),
    fogDensity: 0.0015,
    particleColor: new THREE.Color(0x00aaff),
    particleDensity: 0.3,
    particleSize: 0.3,
  },
  '2025': {
    skyTop: new THREE.Color(0x3a5a7a),
    skyBottom: new THREE.Color(0x8a8a8a),
    sunColor: new THREE.Color(0xffffff),
    sunIntensity: 1.0,
    fogColor: new THREE.Color(0x7a7a7a),
    fogDensity: 0.0012,
    particleColor: new THREE.Color(0x00ffaa),
    particleDensity: 0.2,
    particleSize: 0.25,
  },
  '2055': {
    skyTop: new THREE.Color(0x0a1a2a),
    skyBottom: new THREE.Color(0x1a2a4a),
    sunColor: new THREE.Color(0x00ffff),
    sunIntensity: 1.2,
    fogColor: new THREE.Color(0x001a33),
    fogDensity: 0.003,
    particleColor: new THREE.Color(0x00ffff),
    particleDensity: 0.6,
    particleSize: 0.4,
  },
};

export class SkyModule {
  group: THREE.Group;
  private scene: THREE.Scene;
  private skyMesh: THREE.Mesh;
  private sunMesh: THREE.Mesh;
  private particleSystem: THREE.Points;
  private particleGeometry: THREE.BufferGeometry;
  private particlePositions: Float32Array;
  private particleVelocities: THREE.Vector3[];
  private numParticles: number;
  private fog: THREE.FogExp2;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Sky sphere (inverted)
    const skyGeometry = new THREE.SphereGeometry(480, 64, 32);
    const skyMaterial = new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      vertexColors: false,
      color: 0x87ceeb,
    });
    this.skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
    this.group.add(this.skyMesh);

    // Sun sphere
    const sunGeometry = new THREE.SphereGeometry(12, 32, 16);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffddaa });
    this.sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    this.sunMesh.position.set(100, 150, -100);
    this.group.add(this.sunMesh);

    // Add sun light
    const sunLight = new THREE.DirectionalLight(0xffddaa, 0.8);
    sunLight.position.set(100, 150, -100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -150;
    sunLight.shadow.camera.right = 150;
    sunLight.shadow.camera.top = 150;
    sunLight.shadow.camera.bottom = -150;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    this.group.add(sunLight);

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.group.add(ambientLight);

    // Particle system for atmosphere
    this.numParticles = 500;
    this.particleGeometry = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(this.numParticles * 3);
    this.particleVelocities = [];

    for (let i = 0; i < this.numParticles; i++) {
      const radius = 200 + Math.random() * 200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      this.particlePositions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      this.particlePositions[i * 3 + 1] = Math.cos(phi) * radius;
      this.particlePositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
      this.particleVelocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1
        )
      );
    }

    this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xc2b280,
      size: 0.5,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
    });
    this.particleSystem = new THREE.Points(this.particleGeometry, particleMaterial);
    this.group.add(this.particleSystem);

    // Fog
    this.fog = new THREE.FogExp2(0xd2b48c, 0.001);
    this.scene.fog = this.fog;

    // Set initial era
    this.setEra('1945');
  }

  setEra(era: EraId): void {
    this.applySky(era);
  }

  /**
   * Update sky during transition between eras.
   * @param targetEra Target era
   * @param t Transition progress 0..1
   * @param fromEra Previous era
   */
  updateTransition(targetEra: EraId, t: number, fromEra: EraId): void {
    const fromSpec = SKY_SPECS[fromEra];
    const toSpec = SKY_SPECS[targetEra];

    // Interpolate sky colors
    const skyTop = fromSpec.skyTop.clone().lerp(toSpec.skyTop, t);
    // (skyBottom currently not used by the shader since we use MeshBasicMaterial)
    const sunColor = fromSpec.sunColor.clone().lerp(toSpec.sunColor, t);
    const sunIntensity = THREE.MathUtils.lerp(fromSpec.sunIntensity, toSpec.sunIntensity, t);
    const fogColor = fromSpec.fogColor.clone().lerp(toSpec.fogColor, t);
    const fogDensity = THREE.MathUtils.lerp(fromSpec.fogDensity, toSpec.fogDensity, t);
    const particleColor = fromSpec.particleColor.clone().lerp(toSpec.particleColor, t);
    const particleDensity = THREE.MathUtils.lerp(fromSpec.particleDensity, toSpec.particleDensity, t);
    const particleSize = THREE.MathUtils.lerp(fromSpec.particleSize, toSpec.particleSize, t);

    // Apply sky sphere gradient
    const skyMat = this.skyMesh.material as THREE.MeshBasicMaterial;
    skyMat.color.copy(skyTop);

    // Apply sun
    this.sunMesh.material = new THREE.MeshBasicMaterial({ color: sunColor });
    const sunLight = this.group.children.find(c => c.type === 'DirectionalLight') as THREE.DirectionalLight;
    if (sunLight) {
      sunLight.color.copy(sunColor);
      sunLight.intensity = sunIntensity;
    }

    // Apply fog
    this.fog.color.copy(fogColor);
    this.fog.density = fogDensity;

    // Apply particles
    const particleMat = this.particleSystem.material as THREE.PointsMaterial;
    particleMat.color.copy(particleColor);
    particleMat.size = particleSize;
    particleMat.opacity = 0.3 + particleDensity * 0.4;
  }

  private applySky(era: EraId): void {
    const spec = SKY_SPECS[era];
    const skyMat = this.skyMesh.material as THREE.MeshBasicMaterial;
    skyMat.color.copy(spec.skyTop);
    this.sunMesh.material = new THREE.MeshBasicMaterial({ color: spec.sunColor });
    const sunLight = this.group.children.find(c => c.type === 'DirectionalLight') as THREE.DirectionalLight;
    if (sunLight) {
      sunLight.color.copy(spec.sunColor);
      sunLight.intensity = spec.sunIntensity;
    }
    this.fog.color.copy(spec.fogColor);
    this.fog.density = spec.fogDensity;
    const particleMat = this.particleSystem.material as THREE.PointsMaterial;
    particleMat.color.copy(spec.particleColor);
    particleMat.size = spec.particleSize;
    particleMat.opacity = 0.3 + spec.particleDensity * 0.4;
  }

  update(_dt: number, _state: AppState): void {
    // Animate particles
    for (let i = 0; i < this.numParticles; i++) {
      this.particlePositions[i * 3] += this.particleVelocities[i].x;
      this.particlePositions[i * 3 + 1] += this.particleVelocities[i].y;
      this.particlePositions[i * 3 + 2] += this.particleVelocities[i].z;

      // Wrap around
      const radius = Math.sqrt(
        this.particlePositions[i * 3] ** 2 +
        this.particlePositions[i * 3 + 1] ** 2 +
        this.particlePositions[i * 3 + 2] ** 2
      );
      if (radius > 400) {
        const scale = 200 / radius;
        this.particlePositions[i * 3] *= scale;
        this.particlePositions[i * 3 + 1] *= scale;
        this.particlePositions[i * 3 + 2] *= scale;
      }
    }
    this.particleGeometry.attributes.position.needsUpdate = true;
  }

  dispose(): void {
    this.group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    this.particleGeometry.dispose();
    this.scene.remove(this.group);
  }
}
