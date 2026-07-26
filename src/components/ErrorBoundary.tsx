import React from 'react'

type Props = {
  onReset?: () => void
  children: React.ReactNode
}

type State = {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch() {
    // no-op: state updated via getDerivedStateFromError
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          background: 'rgba(0,0,0,0.72)',
          color: 'rgba(255,255,255,0.92)',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
          zIndex: 50,
          textAlign: 'center',
        }}
      >
        <div>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>WebGL error</div>
          <div style={{ opacity: 0.85, marginBottom: 16, lineHeight: 1.4 }}>
            Something went wrong while rendering this scene.
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: undefined })
              this.props.onReset?.()
            }}
            style={{
              background: 'rgba(125,247,255,0.14)',
              border: '1px solid rgba(125,247,255,0.45)',
              color: 'rgba(255,255,255,0.95)',
              padding: '10px 14px',
              borderRadius: 999,
              cursor: 'pointer',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            }}
          >
            Reload scene
          </button>
        </div>
      </div>
    )
  }
}
