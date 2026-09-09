/**
 * Headless test stubs and fixtures for City Time Period Timelapse.
 *
 * Provides WebGLRenderer mock, fake WebAudio context, and 2D canvas context stubs
 * so sceneApp and composition test suites can execute in Node / jsdom without
 * a real GPU or audio hardware.
 */

import type { Camera, Object3D, Scene, WebGLRenderer } from 'three';
import { createFakeAudioContext } from '../audio/audioEngine';

/**
 * 2D Canvas context mock preventing jsdom crashes when procedural textures render.
 */
export const STUB_2D_CONTEXT = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  font: '10px sans-serif',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  shadowColor: '',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  globalAlpha: 1.0,
  globalCompositeOperation: 'source-over',
  fill: () => {},
  stroke: () => {},
  fillRect: () => {},
  clearRect: () => {},
  strokeRect: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  arc: () => {},
  arcTo: () => {},
  ellipse: () => {},
  bezierCurveTo: () => {},
  quadraticCurveTo: () => {},
  rect: () => {},
  closePath: () => {},
  fillText: () => {},
  strokeText: () => {},
  measureText: (text: string) => ({
    width: text.length * 8,
    actualBoundingBoxAscent: 10,
    actualBoundingBoxDescent: 2,
    actualBoundingBoxLeft: 0,
    actualBoundingBoxRight: text.length * 8,
    fontBoundingBoxAscent: 10,
    fontBoundingBoxDescent: 2,
  }),
  save: () => {},
  restore: () => {},
  translate: () => {},
  rotate: () => {},
  scale: () => {},
  setTransform: () => {},
  resetTransform: () => {},
  clip: () => {},
  createLinearGradient: () => ({ addColorStop: () => {} }),
  createRadialGradient: () => ({ addColorStop: () => {} }),
  createPattern: () => null,
  drawImage: () => {},
  putImageData: () => {},
  getImageData: (_sx: number, _sy: number, sw: number, sh: number) => ({
    width: sw,
    height: sh,
    data: new Uint8ClampedArray(sw * sh * 4),
    colorSpace: 'srgb',
  }),
  createImageData: (w: number, h: number) => ({
    width: w,
    height: h,
    data: new Uint8ClampedArray(w * h * 4),
    colorSpace: 'srgb',
  }),
  setLineDash: () => {},
  getLineDash: () => [],
} as unknown as CanvasRenderingContext2D;

let originalGetContext: typeof HTMLCanvasElement.prototype.getContext | null = null;

/**
 * Installs a global stub on HTMLCanvasElement.prototype.getContext to return
 * STUB_2D_CONTEXT for '2d' context requests.
 * Returns a restoration function.
 */
export function installCanvas2DStub(): () => void {
  if (typeof HTMLCanvasElement === 'undefined') {
    return () => {};
  }
  if (!originalGetContext) {
    originalGetContext = HTMLCanvasElement.prototype.getContext;
  }
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    contextId: string,
    ...args: unknown[]
  ) {
    if (contextId === '2d') {
      return STUB_2D_CONTEXT;
    }
    if (originalGetContext) {
      return (originalGetContext as Function).apply(this, [contextId, ...args]);
    }
    return null;
  } as typeof HTMLCanvasElement.prototype.getContext;

  return () => {
    restoreCanvas2DStub();
  };
}

/**
 * Restores the original HTMLCanvasElement.prototype.getContext.
 */
export function restoreCanvas2DStub(): void {
  if (originalGetContext && typeof HTMLCanvasElement !== 'undefined') {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    originalGetContext = null;
  }
}

export interface StubRendererOptions {
  width?: number;
  height?: number;
  pixelRatio?: number;
}

/**
 * Creates a lightweight stub WebGLRenderer suitable for headless execution.
 */
export function createStubRenderer(
  canvas?: HTMLCanvasElement,
  options: StubRendererOptions = {},
): WebGLRenderer {
  const domElement = canvas ?? (typeof document !== 'undefined' ? document.createElement('canvas') : ({} as HTMLCanvasElement));
  let width = options.width ?? 800;
  let height = options.height ?? 600;
  let pixelRatio = options.pixelRatio ?? 1;
  let renderCallCount = 0;
  let disposed = false;

  const stub = {
    domElement,
    shadowMap: {
      enabled: false,
      type: 0,
      autoUpdate: true,
      needsUpdate: false,
    },
    toneMapping: 0,
    toneMappingExposure: 1.0,
    outputColorSpace: 'srgb',
    autoClear: true,
    autoClearColor: true,
    autoClearDepth: true,
    autoClearStencil: true,

    info: {
      render: {
        get calls() {
          return renderCallCount;
        },
        frame: 0,
        lines: 0,
        points: 0,
        triangles: 0,
      },
      memory: {
        geometries: 0,
        textures: 0,
      },
      programs: null,
      autoReset: true,
      reset: () => {},
    },

    capabilities: {
      isWebGL2: true,
      maxTextures: 16,
      maxVertexTextures: 16,
      maxTextureSize: 4096,
      maxCubemapSize: 4096,
      maxAttributes: 16,
      maxVertexUniforms: 1024,
      maxVaryings: 16,
      maxFragmentUniforms: 1024,
      vertexTextures: true,
      floatFragmentTextures: true,
      floatVertexTextures: true,
      logarithmicDepthBuffer: false,
      precision: 'highp',
    },

    setSize(w: number, h: number, _updateStyle = false): void {
      width = Math.max(1, w);
      height = Math.max(1, h);
      domElement.width = width * pixelRatio;
      domElement.height = height * pixelRatio;
    },

    getSize(target: { width: number; height: number }): { width: number; height: number } {
      target.width = width;
      target.height = height;
      return target;
    },

    getPixelRatio(): number {
      return pixelRatio;
    },

    setPixelRatio(ratio: number): void {
      pixelRatio = Math.max(0.1, ratio);
      domElement.width = width * pixelRatio;
      domElement.height = height * pixelRatio;
    },

    setClearColor(_color: unknown, _alpha?: number): void {},
    getClearColor: () => ({ r: 0, g: 0, b: 0, getHex: () => 0 }),
    getClearAlpha: () => 1,
    setClearAlpha: () => {},

    setViewport: () => {},
    getViewport: (target: { x: number; y: number; width: number; height: number }) => {
      target.x = 0;
      target.y = 0;
      target.width = width;
      target.height = height;
      return target;
    },

    setScissor: () => {},
    setScissorTest: () => {},

    clear: () => {},
    clearColor: () => {},
    clearDepth: () => {},
    clearStencil: () => {},

    render(_scene: Scene | Object3D, _camera: Camera): void {
      if (disposed) return;
      renderCallCount += 1;
    },

    getContext(): WebGLRenderingContext | null {
      return null;
    },

    dispose(): void {
      disposed = true;
    },

    // Introspection helper for assertions
    _getRenderCalls(): number {
      return renderCallCount;
    },
    _isDisposed(): boolean {
      return disposed;
    },
  };

  return stub as unknown as WebGLRenderer;
}

/**
 * Re-exports the fake AudioContext creator for convenient headless setups.
 */
export { createFakeAudioContext as createStubAudioContext };
