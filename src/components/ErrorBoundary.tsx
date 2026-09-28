import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Top-level render-failure guard. Without it, any exception thrown while
 * rendering (a malformed persisted record, a shape change a Dexie upgrade
 * missed) unmounts the whole tree and leaves a blank white page with no
 * recovery path.
 */
export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleHome = () => {
    this.setState({ error: null });
    window.location.href = '/';
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d120d] text-[#e8e4d8] p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-sm opacity-80">
            The conservatory hit an unexpected error. Your data is stored locally and has not been lost.
          </p>
          <pre className="text-xs text-left bg-black/40 rounded-lg p-3 overflow-auto max-h-40 opacity-70">
            {this.state.error.message}
          </pre>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg bg-[#3e5c3a] hover:bg-[#4a6d46] transition-colors"
            >
              Reload
            </button>
            <button
              onClick={this.handleHome}
              className="px-4 py-2 rounded-lg border border-white/20 hover:bg-white/10 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
