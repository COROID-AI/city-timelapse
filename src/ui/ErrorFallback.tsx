export function ErrorFallback({ error }: { error?: Error }) {
  return (
    <div className="error-fallback">
      <h2>⚠️ Renderer Unavailable</h2>
      <p>{error?.message || 'Could not initialize the 3D scene.'}</p>
      <p>Please check your browser and try again.</p>
      <button onClick={() => window.location.reload()}>Reload</button>
    </div>
  );
}
