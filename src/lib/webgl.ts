/**
 * Detect whether the current browser can create a usable WebGL context.
 * Used to surface an accessible fallback when WebGL is unavailable.
 */
export function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    return !!gl && typeof gl.getParameter === 'function';
  } catch {
    return false;
  }
}
