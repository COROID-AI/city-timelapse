// ---------------------------------------------------------------------------
// Fallbacks — shown when WebGL is unavailable or the context is lost.
// ---------------------------------------------------------------------------

export function NoWebGLFallback({ reason }: { reason?: string }) {
  return (
    <div className="fallback" role="alert">
      <div className="fallback__icon">🚫</div>
      <h2 className="fallback__title">3D Unavailable</h2>
      <p className="fallback__msg">
        {reason ??
          'Your browser or device does not support WebGL, which is required for the 3D scene.'}
      </p>
      <p className="fallback__msg">
        Try a modern desktop browser like Chrome, Firefox, Edge, or Safari with
        hardware acceleration enabled.
      </p>
    </div>
  );
}

export function LoadingFallback() {
  return (
    <div className="loading" role="status" aria-live="polite">
      <div className="loading__spinner" aria-hidden="true" />
      <div className="loading__text">Building the city…</div>
    </div>
  );
}
