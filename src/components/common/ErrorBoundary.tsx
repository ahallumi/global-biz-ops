import { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: any;
  componentStack?: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    console.error('Component stack:', errorInfo?.componentStack);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      cause: error?.cause,
    });
    this.setState({ error, componentStack: errorInfo?.componentStack });
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="p-4 rounded border border-destructive/20 bg-destructive/5 text-destructive">
          <div className="font-semibold">Something went wrong loading this section.</div>
          <div className="text-xs opacity-80 mt-2">{String(this.state.error?.message || this.state.error || 'Unknown error')}</div>
          {this.state.componentStack && (
            <pre className="mt-2 text-[10px] opacity-70 whitespace-pre-wrap">
              {this.state.componentStack}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
