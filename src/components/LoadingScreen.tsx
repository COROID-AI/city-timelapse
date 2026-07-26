export function LoadingScreen() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        color: 'rgba(255,255,255,0.92)',
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Loading city…</div>
        <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>
          Generating buildings, vehicles, and era details.
        </div>
      </div>
    </div>
  )
}
