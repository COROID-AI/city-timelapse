import * as THREE from 'three';

/**
 * WebGLContextManager — handles WebGL context loss recovery.
 *
 * Addresses finding: "WebGL context loss on mobile devices"
 * Strategy:
 *  - Listen for webglcontextlost and webglcontextrestored events.
 *  - Prevent default on context loss to allow restoration.
 *  - On restore, dispose and recreate all GPU resources.
 *  - Provide callbacks for scene re-initialization.
 */
export class WebGLContextManager {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  private onContextLostCallbacks: (() => void)[] = [];
  private onContextRestoredCallbacks: (() => void)[] = [];
  private contextLost = false;
  private restoreTimeout: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    // Prevent the default behavior to allow context restoration
    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.contextLost = true;
      console.warn('[WebGLContextManager] Context lost. Preparing recovery...');

      // Notify all registered callbacks
      this.onContextLostCallbacks.forEach((cb) => {
        try {
          cb();
        } catch (e) {
          console.error('[WebGLContextManager] Error in context lost callback:', e);
        }
      });

      // Attempt restoration after a delay
      if (this.restoreTimeout) {
        clearTimeout(this.restoreTimeout);
      }
      this.restoreTimeout = window.setTimeout(() => {
        this.attemptRestore();
      }, 500) as unknown as number;
    });

    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      console.log('[WebGLContextManager] Context restored. Re-initializing resources...');

      this.onContextRestoredCallbacks.forEach((cb) => {
        try {
          cb();
        } catch (e) {
          console.error('[WebGLContextManager] Error in context restored callback:', e);
        }
      });
    });
  }

  /**
   * Register a callback to be called when the WebGL context is lost.
   * Use this to dispose GPU resources (textures, buffers, etc.).
   */
  onContextLost(callback: () => void): void {
    this.onContextLostCallbacks.push(callback);
  }

  /**
   * Register a callback to be called when the WebGL context is restored.
   * Use this to recreate GPU resources.
   */
  onContextRestored(callback: () => void): void {
    this.onContextRestoredCallbacks.push(callback);
  }

  private attemptRestore(): void {
    if (!this.gl) return;

    try {
      const restored = this.gl.isContextLost();
      if (restored) {
        // The browser will fire webglcontextrestored automatically
        // when the context is restored. We just need to wait.
        console.log('[WebGLContextManager] Waiting for context restoration...');
        if (this.restoreTimeout) {
          clearTimeout(this.restoreTimeout);
        }
        this.restoreTimeout = window.setTimeout(() => {
          this.attemptRestore();
        }, 1000) as unknown as number;
      }
    } catch (e) {
      console.error('[WebGLContextManager] Restore attempt failed:', e);
    }
  }

  setGLContext(gl: WebGL2RenderingContext | WebGLRenderingContext): void {
    this.gl = gl;
  }

  isContextLost(): boolean {
    return this.contextLost;
  }

  dispose(): void {
    if (this.restoreTimeout) {
      clearTimeout(this.restoreTimeout);
    }
    this.onContextLostCallbacks = [];
    this.onContextRestoredCallbacks = [];
    this.gl = null;
  }
}
