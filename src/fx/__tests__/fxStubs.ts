/**
 * Shared GPU/test stubs for the fx pipeline.
 *
 * Provides the capabilities needed by `src/fx/*` in headless (jsdom) tests:
 * a WebGL2-capable GL stub that lets the real `WebGLRenderer` construct with
 * a HalfFloat output buffer (so `setEffects` + `toneMapping` are exercised),
 * and a minimal 2D canvas backing for the vignette canvas.
 */
import type { WebGLRenderer } from 'three';

/** Creates a GL stub shaped like a WebGL2 context. */
export function createGlStub(): Record<string, unknown> {
  const params: Record<string, number> = {
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
  };

  const gl: Record<string, unknown> = {
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
  return gl;
}

/**
 * Creates a rendering canvas whose `getContext('webgl2')` returns the GL
 * stub, so `new WebGLRenderer({ canvas, context: gl, outputBufferType })`
 * constructs in headless jsdom.
 */
export function createWebglStubCanvas(): HTMLCanvasElement {
  const gl = createGlStub();
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  canvas.getContext = (contextId: string) =>
    contextId === 'webgl2' ? gl : ((null as unknown) as WebGLRenderingContext);
  canvas.addEventListener = () => {};
  canvas.removeEventListener = () => {};
  return canvas as unknown as HTMLCanvasElement;
}

/**
 * Builds a real WebGLRenderer over the GL stub with a HalfFloat output
 * buffer — the configuration that supports tone mapping + post effects.
 */
export function createHeadlessRenderer(): WebGLRenderer {
  // Import lazily so this module stays importable without a GPU.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return new (require('three').WebGLRenderer)({
    canvas: createWebglStubCanvas(),
    context: createGlStub(),
    outputBufferType: require('three').HalfFloatType,
  }) as WebGLRenderer;
}

/** 2D context stub used by gradeShader when jsdom has no real canvas. */
export const STUB_2D = {
  fillStyle: '',
  fillRect: () => {},
  /* eslint-disable @typescript-eslint/no-empty-function */
} as unknown as CanvasRenderingContext2D;