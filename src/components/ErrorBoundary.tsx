import React, { Component, ReactNode } from 'react'
import './ErrorBoundary.css'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('WebGL Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-content">
            <h2>3D Scene Error</h2>
            <p>Unable to initialize WebGL scene.</p>
            <p className="error-details">{this.state.error?.message || 'Unknown error'}</p>
            <button onClick={() => window.location.reload()}>Reload Scene</button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}