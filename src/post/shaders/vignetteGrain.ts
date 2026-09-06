/**
 * Custom full-screen vignette + film-grain post-processing shader.
 *
 * This GLSL shader is consumed by a {@link ShaderPass} in the post-processing
 * composer. It samples the previous pass's output from the `tDiffuse` texture
 * and applies two subtle, era-tunable effects:
 *
 *  - **Vignette** — darkens the frame corners with a smooth radial falloff.
 *    The `vignette` uniform is the corner-darkening amount (0–1).
 *  - **Film grain** — animated luminance noise driven by a time uniform so the
 *    grain shimmers like real film. The `grain` uniform is the amount (0–1).
 *
 * Both effects are kept subtle by design (see `src/post/presets.ts`); heavy
 * post-processing is a known cheap-look failure mode.
 */

/**
 * The shader object handed to `new ShaderPass(vignetteGrainShader)`. Uniforms
 * are mutated at runtime by the composer to apply the active era preset and
 * advance the grain animation.
 */
export const vignetteGrainShader = {
  name: 'VignetteGrainShader',

  uniforms: {
    /** The read buffer texture (previous pass output). */
    tDiffuse: { value: null },
    /** Vignette amount, 0–1. */
    vignette: { value: 0.25 },
    /** Film grain amount, 0–1. */
    grain: { value: 0.12 },
    /** Seconds since boot; advances the grain animation. */
    time: { value: 0.0 },
    /** Grain noise scale (higher = finer grain). */
    grainScale: { value: 3.0 },
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,

  fragmentShader: /* glsl */ `
    #include <common>

    uniform float vignette;
    uniform float grain;
    uniform float time;
    uniform float grainScale;

    uniform sampler2D tDiffuse;

    varying vec2 vUv;

    float luminanceOf(vec3 c) {
      return dot(c, vec3(0.299, 0.587, 0.114));
    }

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);

      // Radial falloff from the center (vUv is 0..1 across the viewport).
      vec2 centered = vUv - 0.5;
      float dist = length(centered) * 1.41421356; // normalize so corners reach ~1
      float falloff = smoothstep(0.35, 0.95, dist);
      float vig = mix(1.0, 1.0 - vignette, falloff);

      // Animated film grain: hash the pixel position plus a scrolling time
      // offset so the noise shifts frame-to-frame like real film.
      float n = rand(fract(vUv * grainScale + vec2(time * 0.6, time * 0.37)));
      float g = mix(0.0, (n - 0.5), grain);

      vec3 color = (base.rgb + g) * vig;
      gl_FragColor = vec4(color, base.a);
    }`,
};