import React from 'react'

type Props = { children: React.ReactNode; fallback?: React.ReactNode }

type State = { hasError: boolean; error?: unknown }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error }
  }

  componentDidCatch() {
    // No-op: real telemetry could be added here.
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div role="alert" style={{ padding: 16, color: 'white', background: '#1b1b1b' }}>
            WebGL failed to initialize. Please try reloading.
          </div>
        )
      )
    }

    return this.props.children
  }
  
}
