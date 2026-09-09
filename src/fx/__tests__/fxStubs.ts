/**
 * Shared GPU/test stubs for the fx pipeline.
 *
 * Provides the capabilities needed by `src/fx/*` in headless (jsdom) tests:
 * a WebGL2-capable GL stub that lets the real `WebGLRenderer` construct with
 * a HalfFloat output buffer (so `setEffects` + `toneMapping` are exercised),
 * plus helpers to create the corresponding rendering canvas.
 */
import { HalfFloatType, WebGLRenderer } from 'three';

/** Values the WebGL renderer queries via getParameter during construction. */
const PARAM_DEFAULTS: Readonly<Record<string, number>> = Object.freeze({
  MAX_TEXTURE_IMAGE_UNITS: 16,
  MAX_VERTEX_TEXTURE_IMAGE_UNITS: 16,
  MAX_TEXTURE_SIZE: 4096,
  MAX_CUBE_MAP_TEXTURE_SIZE: 4096,
  MAX_VERTEX_ATTRIBS: 16,
  MAX_VERTEX_UNIFORM_VECTORS: 1024,
  MAX_VARYING_VECTORS: 16,
  MAX_FRAGMENT_UNIFORM_VECTORS: 1024,
  MAX_SAMPLES: 4,
  SAMPLES: 0,
  IMPLEMENTATION_COLOR_READ_FORMAT: 0,
  IMPLEMENTATION_COLOR_READ_TYPE: 0,
});

/** Loose structural shape the WebGL renderer requires from a GL context. */
export interface GlLike {
  VERSION: string;
  UNSIGNED_BYTE: number;
  HALF_FLOAT: number;
  FLOAT: number;
  RGBA: number;
  getContextAttributes(): { alpha: boolean };
  getExtension(_name: string): unknown;
  getShaderPrecisionFormat(_stage: unknown, _precision: unknown): { precision: number };
  getParameter(_name: string): unknown;
  createTexture(..._args: unknown[]): unknown;
  createBuffer(..._args: unknown[]): unknown;
}

/** Creates a GL stub shaped like a WebGL2 context. */
export function createGlStub(): GlLike {
  const params = { ...PARAM_DEFAULTS };
  return {
    VERSION: 'VERSION',
    UNSIGNED_BYTE: 0x1401,
    HALF_FLOAT: 0x140b,
    FLOAT: 0x1406,
    RGBA: 0x1908,
    getContextAttributes: () => ({ alpha: false }),
    getExtension: () => null,
    getShaderPrecisionFormat: () => ({ precision: 24 }),
    getParameter: (name: string) => (name === 'VERSION' ? 'WebGL 2.0' : params[name] ?? 0),
    createTexture: () => ({}),
    createBuffer: () => ({}),
  };
}

/**
 * Creates a rendering canvas whose `getContext('webgl2')` returns the GL
 * stub, so `new WebGLRenderer({ canvas, context: gl, outputBufferType })`
 * constructs in headless jsdom. The 2D path falls through to the DOM default
 * (the vignette uses the installed canvas 2D stub).
 */
export function createWebglStubCanvas(): HTMLCanvasElement {
  const gl = createGlStub();
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;

  // Override only the WebGL2 arm; keep the object otherwise DOM-sized by
  // casting through `unknown` (jsdom ships no real WebGLRenderingContext,
  // and the renderer only calls `canvas.getContext('webgl2', ...)`).
  const fallback: HTMLCanvasElement['getContext'] = canvas.getContext.bind(canvas);
  (canvas as unknown as { getContext: (...args: unknown[]) => unknown }).getContext = (
    ...args: unknown[]
  ): unknown => {
    const contextId = args[0] as string;
    if (contextId === 'webgl2') {
      return gl;
    }
    return fallback(...(args as [string]));
  };
  return canvas;
}

/**
 * Builds a real WebGLRenderer over the GL stub with a HalfFloat output
 * buffer — the configuration that supports tone mapping + post effects.
 */
export function createHeadlessRenderer(): WebGLRenderer {
  return new WebGLRenderer({
    canvas: createWebglStubCanvas(),
    context: createGlStub() as unknown as WebGLRenderingContext,
    outputBufferType: HalfFloatType,
  });
}