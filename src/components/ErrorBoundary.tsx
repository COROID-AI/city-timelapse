import React, { Component, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
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

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('WebGL Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/20 glass-panel m-4">
          <div className="text-center p-6">
            <h2 className="text-2xl font-bold text-red-400 mb-4">3D Scene Error</h2>
            <p className="text-gray-300 mb-4">Unable to initialize WebGL scene.</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors"
            >
              Reload Scene
            </button>
            {this.state.error && (
              <p className="text-xs text-gray-500 mt-4">{this.state.error.message}</p>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}