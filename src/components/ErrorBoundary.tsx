import React, { Component, ReactNode } from 'react'
import { useStore } from '../lib/store'

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

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>3D Scene Error</h2>
          <p>Something went wrong rendering the city scene.</p>
          {this.state.error && (
            <p style={{ fontSize: '12px', opacity: 0.7 }}>
              {this.state.error.message}
            </p>
          )}
          <button onClick={this.handleReset}>Reload Scene</button>
        </div>
      )
    }

    return this.props.children
  }
}