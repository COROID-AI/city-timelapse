import type { WebGLRenderer } from 'three';

/**
 * Shared holder for the active WebGLRenderer so DOM-overlay components (the
 * performance HUD) can read draw-call / memory stats without being mounted
 * inside the R3F Canvas. Set by the scene composition root once the renderer
 * is available; read by the HUD for profiling.
 */
export const rendererHolder: { gl: WebGLRenderer | null } = { gl: null };