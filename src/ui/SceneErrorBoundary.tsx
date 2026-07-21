import { Component, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Error boundary for render-time errors inside the Canvas subtree. Catches
// throw from R3F components and shows a clear fallback instead of a white
// screen. Includes a retry button.
// ---------------------------------------------------------------------------

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

export class SceneErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error('[SceneErrorBoundary] render-time error:', error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fallback" role="alert">
          <div className="fallback__icon">🏗️</div>
          <h2 className="fallback__title">Scene render error</h2>
          <p className="fallback__msg">
            The 3D scene hit an unexpected error while drawing.
          </p>
          {this.state.message && (
            <code className="fallback__code">{this.state.message}</code>
          )}
          <button className="fallback__btn" onClick={this.handleRetry}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
