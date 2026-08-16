// @ts-nocheck
/**
 * PostProcessing - Post-processing effects for the city block scene
 *
 * Features:
 * - Bloom post-processing for light sources (neon, LEDs, headlights)
 * - Vignette for cinematic framing
 * - Chromatic aberration during rapid camera movement
 * - Film grain (era-dependent: high 1945, minimal 2025)
 * - Color grading LUT that shifts per era
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { EraKey, ERAS } from './eras/eraData';

/**
 * Era-specific color grading settings
 */
export interface EraColorGrading {
  /** Name of the LUT/color scheme */
  name: string;
  /** Sepia tint strength (1945) */
  sepiaTint: number;
  /** Vibrance/saturation shift (1965 vibrant, etc.) */
  vibrance: number;
  /** Contrast adjustment */
  contrast: number;
  /** Warmth offset (positive = warmer, negative = cooler) */
  warmth: number;
  /** Bloom threshold (lower = more bloom) */
  bloomThreshold: number;
  /** Bloom intensity */
  bloomIntensity: number;
  /** Bloom radius */
  bloomRadius: number;
  /** Vignette intensity */
  vignetteIntensity: number;
  /** Film grain intensity (0-1, 1945 high, 2025 minimal) */
  grainIntensity: number;
  /** Chromatic aberration strength */
  chromaticAberration: number;
}

/**
 * PostProcessing manages all post-processing effects for the scene.
 * Handles bloom, vignette, film grain, chromatic aberration, and era-based color grading.
 */
export class PostProcessing {
  /** Three.js EffectComposer instance */
  public composer: EffectComposer;
  /** Render pass for the main scene */
  private renderPass: RenderPass;
  /** Bloom pass */
  private bloomPass: UnrealBloomPass;
  /** Vignette shader pass */
  private vignettePass: ShaderPass;
  /** Film grain pass */
  private filmPass: FilmPass;
  /** Chromatic aberration pass */
  private chromaticPass: ShaderPass;
  /** LUT adjustment shader */
  private lutPass: ShaderPass;

  /** Current era for color grading */
  private currentEra: EraKey = '2025';

  /** Previous frame time for chromatic aberration detection */
  private prevTime: number = 0;
  /** Flag for rapid camera movement */
  private isMovingFast: boolean = false;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number
  ) {
    // Create the EffectComposer
    this.composer = new EffectComposer(renderer, new THREE.Vector2(width, height));

    // Set size for the composer
    this.composer.setSize(width, height);

    // Add RenderPass - renders the scene
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // Add Bloom Pass - for emissive elements (neon, LEDs, headlights)
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      ERAS['2025'].bloomIntensity ?? 1.5,
      ERAS['2025'].bloomThreshold ?? 0.4,
      ERAS['2025'].bloomRadius ?? 0.85
    );
    this.composer.addPass(this.bloomPass);

    // Add Vignette - for cinematic framing
    this.vignettePass = this.createVignettePass();
    this.composer.addPass(this.vignettePass);

    // Add Film Pass - for film grain (era-dependent)
    this.filmPass = new FilmPass(
      new THREE.Vector2(width, height),
      0,           // contrast
      0,           // scanline intensity
      ERAS['2025'].grainIntensity ?? 0.1  // grain intensity
    );
    // Set film grain to disable for now (will be updated per era)
    this.filmPass.enabled = false;
    this.composer.addPass(this.filmPass);

    // Add Chromatic Aberration pass - subtle during rapid movement
    this.chromaticPass = new ShaderPass(
      this.createChromaticAberrationShader()
    );
    this.chromaticPass.enabled = false;
    this.composer.addPass(this.chromaticPass);

    // Add LUT/Color grading pass
    this.lutPass = this.createColorGradingPass();
    this.composer.addPass(this.lutPass);

    // Add SMAA anti-aliasing for cleaner edges
    this.composer.addPass(new SMAAPass(
      new THREE.Vector2(width, height),
      1920,        // width threshold
      1080         // height threshold
    ));

    // Initialize with 2025 era settings
    this.updateEra('2025');
  }

  /** Create vignette shader pass */
  private createVignettePass(): ShaderPass {
    const vertexShader = /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = /* glsl */`
      varying vec2 vUv;
      uniform float intensity;
      void main() {
        vec4 color = texture2D( color, vUv );
        float vignette = 1.0 - length(vUv - 0.5) * 2.0 * intensity;
        gl_FragColor = vec4(color.rgb * vignette, color.a);
      }
    `;

    return new ShaderPass({
      vertexShader,
      fragmentShader,
      uniforms: {
        intensity: { value: 0.35 }  // default vignette intensity
      }
    });
  }

  /** Create chromatic aberration shader */
  private createChromaticAberrationShader(): THREE.ShaderMaterial {
    const vertexShader = /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = /* glsl */`
      varying vec2 vUv;
      uniform float amount;
      void main() {
        // Split RGB channels slightly to create chromatic aberration
        vec4 color;
        
        // Get texture sample at offset for red channel
        float offset = amount * 0.25;
        vec3 rgb = texture2D( color, vUv + vec2(offset, 0.0) ).rgb;
        
        // Blue channel offset in opposite direction
        rgb += texture2D( color, vUv - vec2(offset, 0.0) ).rgb - rgb;
        
        // Green channel stays centered
        color = vec4(rgb, texture2D( color, vUv ).a);
        
        gl_FragColor = color;
      }
    `;

    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        amount: { value: 0.0 }
      }
    });
  }

  /** Create color grading/LUT shader pass for era-based color shifts */
  private createColorGradingPass(): ShaderPass {
    const vertexShader = /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = /* glsl */`
      varying vec2 vUv;
      uniform float sepiaTint;
      uniform float vibrance;
      uniform float contrast;
      uniform float warmth;
      void main() {
        vec4 color = texture2D( color, vUv );
        
        // Apply sepia tint for 1945 era
        float sepia = sepiaTint;
        vec3 sepiaTone = color.rgb * vec3(1.0, 0.95, 0.85) * sepia + color.rgb * vec3(0.0, 0.05, 0.1) * (1.0 - sepia);
        
        // Apply warmth shift
        vec3 warmed = mix(vec3(0.0, 0.0, 0.0), sepiaTone, abs(warmth));
        if (warmth > 0.0) {
          warmed = mix(color.rgb, sepiaTone, warmth);
        } else {
          warmed = mix(color.rgb, sepiaTone, 1.0 + warmth);
        }
        
        // Apply vibrance (preserve highlights, boost mid-saturation)
        float avgLum = (warmed.r + warmed.g + warmed.b) / 3.0;
        float vibrancy = vibrance;
        vec3 desaturated = vec3(avgLum);
        vec3 finalColor = mix(desaturated, warmed, vibrancy);
        
        // Apply contrast
        finalColor = finalColor * contrast;
        
        gl_FragColor = vec4(finalColor, color.a);
      }
    `;

    return new ShaderPass({
      vertexShader,
      fragmentShader,
      uniforms: {
        sepiaTint: { value: 0.0 },
        vibrance: { value: 1.0 },
        contrast: { value: 1.0 },
        warmth: { value: 0.0 }
      }
    });
  }

  /** Create the chromatic aberration shader material */
  private createChromaticAberrationMaterial(): THREE.ShaderMaterial {
    const vertexShader = /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = /* glsl */`
      varying vec2 vUv;
      uniform float amount;
      uniform float time;
      void main() {
        // Subtle chromatic aberration based on velocity
        float aberration = amount * 0.1;
        
        vec4 colorR = texture2D( color, vUv + vec3(aberration, 0.0, 0.0) );
        vec4 colorG = texture2D( color, vUv );
        vec4 colorB = texture2D( color, vUv + vec3(-aberration, 0.0, 0.0) );
        
        gl_FragColor = vec4(colorR.rgb + colorB.rgb - colorG.rgb, colorG.a);
      }
    `;

    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        amount: { value: 0.0 },
        time: { value: 0.0 }
      }
    });
  }

  /** Update post-processing effects based on the current era */
  public updateEra(eraKey: EraKey): void {
    this.currentEra = eraKey;

    if (!ERAS[eraKey]) return;

    const era = ERAS[eraKey];

    // Update bloom parameters with defaults
    if (this.bloomPass) {
      this.bloomPass.strength = 1.5;  // default intensity
      this.bloomPass.threshold = 0.4; // default threshold
      this.bloomPass.radius = 0.85;   // default radius
    }

    // Update vignette intensity with default
    if (this.vignettePass) {
      this.vignettePass.uniforms.intensity.value = 0.35; // default vignette intensity
    }

    // Update film grain intensity (high 1945, minimal 2025)
    if (this.filmPass) {
      const grainIntensity = eraKey === '1945' ? 0.8 : 0.01;
      this.filmPass.grainIntensity = grainIntensity;
      this.filmPass.enabled = grainIntensity > 0;
    }

    // Update color grading parameters
    if (this.lutPass) {
      // Set era-appropriate color grading using defaults
      let sepiaTint = 0;
      let vibrance = 1.0;
      let contrast = 1.0;
      let warmth = 0.0;

      switch (eraKey) {
        case '1945':
          sepiaTint = 1.0;  // Strong sepia tint
          vibrance = 0.7;   // Desaturated
          contrast = 1.1;
          warmth = 0.3;     // Warm
          break;
        case '1965':
          sepiaTint = 0.0;
          vibrance = 1.4;   // Vibrant
          contrast = 1.2;
          warmth = 0.1;
          break;
        case '1985':
          sepiaTint = 0.0;
          vibrance = 1.2;
          contrast = 1.3;
          warmth = -0.1;    // Slightly cool
          break;
        case '2005':
          sepiaTint = 0.0;
          vibrance = 1.0;
          contrast = 1.0;
          warmth = 0.0;
          break;
        case '2025':
        default:
          sepiaTint = 0.0;
          vibrance = 1.0;
          contrast = 1.0;
          warmth = 0.0;
          break;
      }

      this.lutPass.uniforms.sepiaTint.value = sepiaTint;
      this.lutPass.uniforms.vibrance.value = vibrance;
      this.lutPass.uniforms.contrast.value = contrast;
      this.lutPass.uniforms.warmth.value = warmth;
    }

    // Update chromatic aberration based on era
    if (this.chromaticPass) {
      // No chromatic aberration by default in era settings
      this.chromaticPass.uniforms.amount.value = 0.0;
      this.chromaticPass.enabled = false;
    }
  }

  /** Update chromatic aberration based on camera movement speed */
  public updateChromaticAberration(deltaTime: number): void {
    // Detect rapid camera movement
    const movementSpeed = deltaTime * 100; // rough estimate

    if (movementSpeed > 10) { // threshold for "fast" movement
      this.isMovingFast = true;
    } else {
      this.isMovingFast = false;
    }

    // Apply chromatic aberration when moving fast
    if (this.isMovingFast) {
      const fastAberration = 0.15; // stronger effect during fast movement
      this.chromaticPass.uniforms.amount.value = fastAberration;
      this.chromaticPass.enabled = true;
    } else {
      // Fade out aberration when movement slows
      const current = this.chromaticPass.uniforms.amount.value;
      this.chromaticPass.uniforms.amount.value = Math.max(0, current - 0.05);
      if (this.chromaticPass.uniforms.amount.value === 0) {
        this.chromaticPass.enabled = false;
      }
    }
  }

  /** Render the scene with all post-processing effects */
  public render(deltaTime: number): void {
    // Update chromatic aberration based on movement
    this.updateChromaticAberration(deltaTime);

    // Render the scene with post-processing
    this.composer.render();
  }

  /** Resize the post-processing composer */
  public resize(width: number, height: number): void {
    this.composer.setSize(width, height);
    if (this.bloomPass) {
      this.bloomPass.setSize(width, height);
    }
    if (this.vignettePass) {
      this.vignettePass.uniforms.intensity.value = this.vignettePass.uniforms.intensity.value; // recalculate
    }
    if (this.filmPass) {
      this.filmPass.setSize(width, height);
    }
    if (this.chromaticPass) {
      this.chromaticPass.setSize(width, height);
    }
    if (this.lutPass) {
      this.lutPass.setSize(width, height);
    }
  }
}