import React, { Component, ReactNode } from 'react'
import { isWebGLAvailable } from '../lib/webgl-check'

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
        <div className="w-full h-full flex items-center justify-center bg-gray-900">
          <div className="text-center p-8 max-w-md">
            <h1 className="text-3xl font-bold text-red-400 mb-4">Rendering Error</h1>
            <p className="text-gray-300 mb-6">
              {!isWebGLAvailable()
                ? 'Your browser does not support WebGL. Please try a modern browser like Chrome, Firefox, or Safari.'
                : 'Failed to initialize the 3D scene. Please refresh the page.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Reload Scene
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}