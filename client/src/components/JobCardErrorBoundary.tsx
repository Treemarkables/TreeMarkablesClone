import { Component, ReactNode, createElement, Fragment } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, X, Loader2 } from 'lucide-react';
import {
  isChunkLoadError,
  canAttemptReload,
  requestStaleBundleReload,
} from '@/lib/staleChunkReload';

interface Props {
  children: ReactNode;
  onClose?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  resetKey: number;
  recovering: boolean;
}

export class JobCardErrorBoundary extends Component<Props, State> {
  private capturedComponentStack: string = '';

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, resetKey: 0, recovering: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Chunk-load failures during a deploy rollout recover via a hard reload
    // (the top-level ErrorBoundary pattern) — show a calm "Updating" state
    // instead of the error card while it lands.
    return {
      hasError: true,
      error,
      recovering: isChunkLoadError(error) && canAttemptReload(),
    };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    // IMPORTANT: Do NOT call setState here — calling setState in componentDidCatch
    // triggers another render cycle, which causes an infinite loop when the error
    // is itself a "Maximum update depth exceeded" error.
    this.capturedComponentStack = errorInfo.componentStack || '';

    // Stale-bundle recovery first: lazy-loaded job-card chunks fail through
    // Suspense into THIS boundary (the top-level one never sees them), and
    // React caches the rejected import — remounting can never fix it, only a
    // reload can. Skip logging while retrying; it's a deploy artifact.
    if (isChunkLoadError(error) && requestStaleBundleReload() === 'reloading') {
      return;
    }

    // Persist to localStorage for diagnosis
    try {
      localStorage.setItem('lastJobCardCrash', JSON.stringify({
        message: error.message,
        stack: error.stack?.substring(0, 2000),
        componentStack: this.capturedComponentStack.substring(0, 3000),
        url: window.location.href,
        timestamp: new Date().toISOString(),
      }));
    } catch (_) {}

    // Fire-and-forget server log
    try {
      fetch('/api/client-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          componentStack: this.capturedComponentStack,
          url: window.location.href,
          userAgent: navigator.userAgent,
          context: 'JobCardErrorBoundary',
        }),
      }).catch(() => {});
    } catch (_) {}
  }

  handleRetry = () => {
    // React lazy() caches a failed import's rejection, so remounting after a
    // chunk error just re-throws — only a full reload can fetch the chunk.
    if (isChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }
    this.capturedComponentStack = '';
    // Increment resetKey so we get a fresh Fragment with a different key,
    // which forces React to fully unmount and remount the children.
    this.setState(prev => ({
      hasError: false,
      error: null,
      resetKey: prev.resetKey + 1,
      recovering: false,
    }));
  };

  handleClose = () => {
    this.capturedComponentStack = '';
    this.setState(prev => ({ hasError: false, error: null, resetKey: prev.resetKey + 1 }));
    this.props.onClose?.();
  };

  render() {
    if (this.state.hasError && this.state.recovering) {
      // A stale-bundle reload is in flight — calm screen, not the error card.
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg m-4 text-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-gray-500">Updating to the latest version…</p>
        </div>
      );
    }

    if (this.state.hasError) {
      const stack = this.capturedComponentStack
        .split('\n')
        .filter(l => l.trim())
        .slice(0, 8)
        .join('\n');

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
                {stack ? `\n\n${stack}` : ''}
              </pre>
            </details>
          )}
        </div>
      );
    }

    // Use a keyed Fragment to force full child remount on retry.
    // This avoids adding any DOM nodes that could interfere with child component layout.
    return createElement(Fragment, { key: this.state.resetKey }, this.props.children);
  }
}
