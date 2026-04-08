import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

interface Props {
  children: ReactNode;
  onClose?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string;
  resetKey: number;
}

export class JobCardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: '', resetKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    const stack = errorInfo.componentStack || '';
    this.setState({ componentStack: stack });

    // Save to localStorage so it survives a page reload and can be inspected later
    try {
      localStorage.setItem('lastJobCardCrash', JSON.stringify({
        message: error.message,
        stack: error.stack?.substring(0, 2000),
        componentStack: stack.substring(0, 3000),
        url: window.location.href,
        timestamp: new Date().toISOString(),
      }));
    } catch (_) {}

    // Also attempt server-side logging
    try {
      fetch('/api/client-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          componentStack: stack,
          url: window.location.href,
          userAgent: navigator.userAgent,
          context: 'JobCardErrorBoundary',
        }),
      }).catch(() => {});
    } catch (_) {}
  }

  handleRetry = () => {
    // Increment resetKey to force full remount of the job card tree
    this.setState(prev => ({
      hasError: false,
      error: null,
      componentStack: '',
      resetKey: prev.resetKey + 1,
    }));
  };

  handleClose = () => {
    this.setState({ hasError: false, error: null, componentStack: '', resetKey: this.state.resetKey + 1 });
    this.props.onClose?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg border border-red-100 m-4 text-center gap-4">
          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">Job card couldn't load</h3>
            <p className="text-sm text-gray-500">Your data is safe. Tap "Try Again" to reload this job.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={this.handleRetry} size="sm">
              <RefreshCw className="w-4 h-4 mr-1" />
              Try Again
            </Button>
            {this.props.onClose && (
              <Button onClick={this.handleClose} variant="outline" size="sm">
                <X className="w-4 h-4 mr-1" />
                Close
              </Button>
            )}
          </div>
          {this.state.error && (
            <details className="text-left w-full">
              <summary className="text-xs text-gray-400 cursor-pointer">Technical details</summary>
              <pre className="text-xs text-red-500 mt-2 overflow-auto max-h-32 bg-gray-50 p-2 rounded whitespace-pre-wrap">
                {this.state.error.message}
                {'\n\n'}
                {this.state.componentStack.substring(0, 800)}
              </pre>
            </details>
          )}
        </div>
      );
    }

    // Use resetKey to force full remount after a retry — clears all internal state
    return (
      <div key={this.state.resetKey} style={{ display: 'contents' }}>
        {this.props.children}
      </div>
    );
  }
}
