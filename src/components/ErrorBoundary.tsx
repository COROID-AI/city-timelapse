import React, { Component, ReactNode } from 'react'
import './ErrorBoundary.css'

interface Props {
  children: ReactNode
  fallback?: ReactNode
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
    console.error('3D Scene Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-container">
          <div className="error-content">
            <h2>Oops! Something went wrong</h2>
            <p>We couldn't load the 3D scene. Please refresh the page to try again.</p>
            <button onClick={() => window.location.reload()}>Reload Scene</button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}