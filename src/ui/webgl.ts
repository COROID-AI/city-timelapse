// ---------------------------------------------------------------------------
// WebGL capability detection — used to decide whether to mount the 3D Canvas
// or show the no-WebGL fallback. Returns a boolean and a reason.
// ---------------------------------------------------------------------------

export type WebGLSupport = { supported: boolean; reason?: string };

export function detectWebGL(): WebGLSupport {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) {
      return {
        supported: false,
        reason:
          'Your browser or device does not support WebGL, which is required for the 3D scene.',
      };
    }
    return { supported: true };
  } catch {
    return {
      supported: false,
      reason: 'WebGL could not be initialised on this device.',
    };
  }
}

/** True if the user's OS reports a reduced-motion preference. */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
