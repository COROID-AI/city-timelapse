import React, { Component, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('WebGL Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="absolute inset-0 bg-red-900/90 flex flex-col items-center justify-center z-100">
          <h2 className="text-red-300 text-2xl font-bold mb-4">
            WebGL Error Occurred
          </h2>
          <p className="text-red-200 mb-4 max-w-md text-center">
            {this.state.error?.message || 'Unable to render 3D scene'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-6 py-2 bg-red-500 text-white rounded hover:bg-red-400 transition-colors"
          >
            Try Again
          </button>
          <p className="text-gray-400 text-sm mt-4">
            Please ensure your browser supports WebGL and your graphics drivers are up to date.
          </p>
        </div>
      )
    }

    return this.props.children
  }
}