import { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: any;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 rounded border border-destructive/20 bg-destructive/5 text-destructive">
          <div className="font-semibold">Something went wrong loading this section.</div>
          <div className="text-xs opacity-80 mt-2">{String(this.state.error?.message || this.state.error || 'Unknown error')}</div>
        </div>
      );
    }
    return this.props.children;
  }
}
