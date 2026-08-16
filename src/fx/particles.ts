// ─── Ambient FX Particles — Era-Appropriate Lightweight Particle System ──
// Single parameterized Three.js Points-based particle system.
// Each era gets its own configuration for density, color, size, speed,
// and vertical distribution. No external libraries — pure Three.js built-ins.

import * as THREE from 'three';
import type { EraId } from '../eras.js';

// ── Particle config per era ─────────────────────────────────────────────

interface ParticleEraConfig {
  /** Number of particles to spawn */
  count: number;
  /** Particle base color (hex) */
  color: number;
  /** Base particle size in world units */
  size: number;
  /** Size variation range */
  sizeVariation: number;
  /** Spread radius in X-Z plane */
  spreadRadius: number;
  /** Vertical height range */
  minHeight: number;
  /** Maximum height */
  maxHeight: number;
  /** Horizontal drift speed (units/sec) */
  driftSpeed: number;
  /** Vertical oscillation amplitude */
  oscillationAmplitude: number;
  /** Oscillation frequency */
  oscillationFrequency: number;
  /** Opacity (alpha) of particles */
  opacity: number;
  /** Whether particles rise slowly (like smoke/haze) */
  rises: boolean;
  /** Rise speed if rising */
  riseSpeed: number;
}

const PARTICLE_CONFIGS: Record<EraId, ParticleEraConfig> = {
  '1945': {
    // Dust and soot motes — small, dense, warm brown-gray
    count: 300,
    color: 0x8a7a50,
    size: 0.06,
    sizeVariation: 0.04,
    spreadRadius: 50,
    minHeight: 0.5,
    maxHeight: 8,
    driftSpeed: 0.15,
    oscillationAmplitude: 0.3,
    oscillationFrequency: 0.8,
    opacity: 0.6,
    rises: false,
    riseSpeed: 0,
  },
  '1965': {
    // Warm pollen specks — medium size, golden-yellow, gentle float
    count: 150,
    color: 0xe8d060,
    size: 0.1,
    sizeVariation: 0.06,
    spreadRadius: 45,
    minHeight: 1,
    maxHeight: 10,
    driftSpeed: 0.08,
    oscillationAmplitude: 0.5,
    oscillationFrequency: 0.5,
    opacity: 0.5,
    rises: true,
    riseSpeed: 0.02,
  },
  '1985': {
    // Smog haze patches — large, sparse, gray-brown, slow drifting
    count: 60,
    color: 0x7a7060,
    size: 0.35,
    sizeVariation: 0.2,
    spreadRadius: 60,
    minHeight: 0,
    maxHeight: 6,
    driftSpeed: 0.04,
    oscillationAmplitude: 0.1,
    oscillationFrequency: 0.2,
    opacity: 0.25,
    rises: true,
    riseSpeed: 0.005,
  },
  '2005': {
    // Light dust — small-medium, sparse, light gray
    count: 80,
    color: 0xb0b0a8,
    size: 0.07,
    sizeVariation: 0.03,
    spreadRadius: 40,
    minHeight: 0.5,
    maxHeight: 7,
    driftSpeed: 0.1,
    oscillationAmplitude: 0.2,
    oscillationFrequency: 0.6,
    opacity: 0.35,
    rises: false,
    riseSpeed: 0,
  },
  '2025': {
    // Crisp air — very few particles, tiny, barely visible
    count: 20,
    color: 0xd0e8f8,
    size: 0.03,
    sizeVariation: 0.015,
    spreadRadius: 35,
    minHeight: 1,
    maxHeight: 12,
    driftSpeed: 0.05,
    oscillationAmplitude: 0.15,
    oscillationFrequency: 0.4,
    opacity: 0.15,
    rises: true,
    riseSpeed: 0.01,
  },
};

// ── Particle state ──────────────────────────────────────────────────────

interface ParticleState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  phase: number; // random phase offset for oscillation
  baseY: number;
}

// ── Texture generation ──────────────────────────────────────────────────

/** Generate a soft radial gradient texture for particles (no image files) */
function createParticleTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
  gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.3)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// ── Main class ──────────────────────────────────────────────────────────

export interface AmbientParticlesOptions {
  /** Scene to add particles to */
  scene: THREE.Scene;
  /** Initial era */
  initialEra: EraId;
}

export class AmbientParticles {
  private readonly _scene: THREE.Scene;
  private _currentEra: EraId;
  private _targetEra: EraId | null = null;
  private _blendProgress = 1;

  private _particleSystem!: THREE.Points;
  private _states: ParticleState[] = [];
  private _config: ParticleEraConfig;
  private _texture: THREE.Texture;

  // Animation
  private _lastTime = 0;
  private _running = false;
  private _animFrameId: number | null = null;

  constructor(options: AmbientParticlesOptions) {
    this._scene = options.scene;
    this._currentEra = options.initialEra;
    this._config = PARTICLE_CONFIGS[options.initialEra];

    // Create shared particle texture
    this._texture = createParticleTexture();

    // Build particle system
    this._buildParticles(this._config);

    // Subscribe to era changes
    document.addEventListener('erachange', this._onEraChange.bind(this));
  }

  private _onEraChange = (e: Event): void => {
    const detail = (e as CustomEvent).detail;
    if (!detail || !detail.eraId) return;

    const newEra = detail.eraId as EraId;
    if (newEra === this._currentEra) return;

    this._targetEra = newEra;
    this._blendProgress = 0;
  };

  /**
   * Build or rebuild the particle system with given config.
   */
  private _buildParticles(config: ParticleEraConfig): void {
    const count = config.count;

    // Dispose old geometry if exists
    if (this._particleSystem) {
      this._particleSystem.geometry.dispose();
      this._scene.remove(this._particleSystem);
    }

    // Allocate buffers
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const states: ParticleState[] = [];

    const baseColor = new THREE.Color(config.color);

    for (let i = 0; i < count; i++) {
      // Random position within spread radius
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * config.spreadRadius;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = config.minHeight + Math.random() * (config.maxHeight - config.minHeight);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Color with slight variation
      const variation = (Math.random() - 0.5) * 0.15;
      colors[i * 3] = Math.max(0, Math.min(1, baseColor.r + variation));
      colors[i * 3 + 1] = Math.max(0, Math.min(1, baseColor.g + variation));
      colors[i * 3 + 2] = Math.max(0, Math.min(1, baseColor.b + variation));

      // Size with variation
      sizes[i] = config.size + (Math.random() - 0.5) * config.sizeVariation;

      // Particle state
      states.push({
        position: new THREE.Vector3(x, y, z),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * config.driftSpeed,
          config.rises ? config.riseSpeed : 0,
          (Math.random() - 0.5) * config.driftSpeed,
        ),
        phase: Math.random() * Math.PI * 2,
        baseY: y,
      });
    }

    // Create geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Shader material for soft circular particles with alpha
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: this._texture },
        uOpacity: { value: config.opacity },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uOpacity;
        uniform float uPixelRatio;

        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uPixelRatio * (200.0 / -mvPosition.z);
          gl_PointSize = max(gl_PointSize, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          vAlpha = uOpacity;
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vec4 texel = texture2D(uTexture, gl_PointCoord);
          gl_FragColor = vec4(vColor, vAlpha * texel.a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this._particleSystem = new THREE.Points(geometry, material);
    this._particleSystem.frustumCulled = false;
    this._scene.add(this._particleSystem);

    this._states = states;
  }

  // ── Frame update ─────────────────────────────────────────────────────

  /**
   * Update particles for the current frame.
   * Call from animation loop.
   */
  update(delta: number): void {
    if (!this._running) return;
    if (delta <= 0) return;

    this._lastTime += delta;

    // Handle era transition blend
    if (this._targetEra !== null && this._blendProgress < 1) {
      this._blendProgress = Math.min(1, this._blendProgress + delta * 0.8);
      if (this._blendProgress >= 1) {
        this._currentEra = this._targetEra!;
        this._targetEra = null;
        // Rebuild with new config
        this._config = PARTICLE_CONFIGS[this._currentEra];
        this._buildParticles(this._config);
      }
    }

    const config = this._config;
    const time = this._lastTime;
    const posAttr = this._particleSystem.geometry.getAttribute('position');
    const colAttr = this._particleSystem.geometry.getAttribute('color');
    const sizeAttr = this._particleSystem.geometry.getAttribute('size');

    const baseColor = new THREE.Color(config.color);

    for (let i = 0; i < this._states.length; i++) {
      const state = this._states[i];
      const idx = i * 3;

      // Drift
      state.position.x += state.velocity.x * delta;
      state.position.z += state.velocity.z * delta;

      // Rise
      if (config.rises) {
        state.position.y += state.velocity.y * delta;
      }

      // Oscillation
      const osc = Math.sin(time * config.oscillationFrequency + state.phase)
        * config.oscillationAmplitude;
      state.position.y += osc * delta * 0.5;

      // Wrap around spread radius
      const dist = Math.sqrt(state.position.x ** 2 + state.position.z ** 2);
      if (dist > config.spreadRadius) {
        const angle = Math.atan2(state.position.z, state.position.x);
        state.position.x = Math.cos(angle) * config.spreadRadius * 0.5;
        state.position.z = Math.sin(angle) * config.spreadRadius * 0.5;
      }

      // Reset if too high (for rising particles)
      if (config.rises && state.position.y > config.maxHeight + 2) {
        state.position.y = config.minHeight;
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.sqrt(Math.random()) * config.spreadRadius;
        state.position.x = Math.cos(angle) * radius;
        state.position.z = Math.sin(angle) * radius;
      }

      // Update buffer
      posAttr.array[idx] = state.position.x;
      posAttr.array[idx + 1] = state.position.y;
      posAttr.array[idx + 2] = state.position.z;

      // Slight color variation over time
      const colorVar = (Math.sin(time * 0.3 + state.phase) * 0.05);
      colAttr.array[idx] = Math.max(0, Math.min(1, baseColor.r + colorVar));
      colAttr.array[idx + 1] = Math.max(0, Math.min(1, baseColor.g + colorVar));
      colAttr.array[idx + 2] = Math.max(0, Math.min(1, baseColor.b + colorVar));

      sizeAttr.array[i] = config.size + (Math.random() * 0.001 - 0.0005);
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
  }

  /** Start the particle animation loop */
  start(): void {
    if (this._running) return;
    this._running = true;
    this._animate();
  }

  private _animate = (): void => {
    if (!this._running) return;
    this._animFrameId = requestAnimationFrame(this._animate);

    // Use a fixed delta approximation since we don't have access to clock here
    // The host app should call update() directly each frame instead
    this.update(0.016); // ~60fps default
  };

  /**
   * Manually update with a delta time.
   * Preferred over auto-looping for integration control.
   */
  setAutoUpdate(enabled: boolean): void {
    if (enabled && !this._running) {
      this.start();
    } else if (!enabled && this._running) {
      this._running = false;
      if (this._animFrameId !== null) {
        cancelAnimationFrame(this._animFrameId);
        this._animFrameId = null;
      }
    }
  }

  // ── Query helpers ────────────────────────────────────────────────────

  getCurrentEra(): EraId {
    return this._currentEra;
  }

  getTargetEra(): EraId | null {
    return this._targetEra;
  }

  getBlendProgress(): number {
    return this._blendProgress;
  }

  getConfig(): ParticleEraConfig {
    return this._config;
  }

  get particleSystem(): THREE.Points | null {
    return this._particleSystem;
  }

  // ── Cleanup ──────────────────────────────────────────────────────────

  dispose(): void {
    this.setAutoUpdate(false);
    document.removeEventListener('erachange', this._onEraChange as EventListener);

    if (this._particleSystem) {
      this._particleSystem.geometry.dispose();
      if (this._particleSystem.material instanceof THREE.Material) {
        this._particleSystem.material.dispose();
      }
      this._scene.remove(this._particleSystem);
    }

    this._texture.dispose();
  }
}
