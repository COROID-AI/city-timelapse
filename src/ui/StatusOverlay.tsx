/**
 * Loading + error overlays — visible in the DOM (not only in-canvas).
 * Covers: initial loading, WebGL-unavailable, context loss, generic errors.
 */

import { useAppStore } from "../state/store";

export function StatusOverlay() {
  const status = useAppStore((s) => s.status);
  const error = useAppStore((s) => s.error);
  const contextLost = useAppStore((s) => s.contextLost);

  if (contextLost) {
    return (
      <div className="overlay overlay-error" role="alert">
        <h2>Graphics context lost</h2>
        <p>Your GPU reset or the browser reclaimed the WebGL context. Reload to restore the city.</p>
        <button type="button" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="overlay overlay-loading" role="status" aria-live="polite">
        <div className="spinner" aria-hidden="true" />
        <p>Building the city…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="overlay overlay-error" role="alert">
        <h2>
          {error?.code === "webgl-unavailable" || error?.code === "webgl-error"
            ? "WebGL unavailable"
            : "Something went wrong"}
        </h2>
        <p>{error?.message ?? "An unexpected error occurred while starting the scene."}</p>
        <button type="button" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  }

  return null;
}
