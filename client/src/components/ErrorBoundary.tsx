import { Component, ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import {
  isChunkLoadError,
  canAttemptReload,
  requestStaleBundleReload,
} from '@/lib/staleChunkReload';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  recovering: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  private capturedComponentStack: string = '';

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, recovering: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // recovering === "a stale-bundle reload is coming (possibly after a short
    // delay while a deploy finishes rolling out)", so render a calm "Updating"
    // screen instead of the scary error card until it lands.
    return {
      hasError: true,
      error,
      recovering: isChunkLoadError(error) && canAttemptReload(),
    };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    // IMPORTANT: Do NOT call setState here — it triggers another render cycle
    // which can cause infinite loops when the error itself is a maximum-update-depth error.
    // Instead, store the component stack in a class property.
    this.capturedComponentStack = errorInfo.componentStack || '';

    // Stale-bundle recovery FIRST. These import failures surface through
    // Suspense into this boundary, so the global window 'error' /
    // 'unhandledrejection' handlers in main.tsx never see them — we have to
    // trigger the reload here. Skip Sentry/server logging while retrying:
    // it's a deploy artifact, not a code bug. If the retry ladder is
    // exhausted ('gave-up'), fall through and report — a chunk that's still
    // missing after several spaced reloads is a real problem worth logging.
    if (isChunkLoadError(error) && requestStaleBundleReload() === 'reloading') {
      return;
    }

    // Report to Sentry with the React component stack as extra context.
    // No-op when VITE_SENTRY_DSN is unset (Sentry.init was skipped).
    try {
      Sentry.captureException(error, {
        contexts: {
          react: { componentStack: this.capturedComponentStack },
        },
      });
    } catch (_) {}

    // Persist to localStorage for post-reload diagnosis
    try {
      localStorage.setItem('lastAppCrash', JSON.stringify({
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
        }),
      }).catch(() => {});
    } catch (_) {}
  }

  handleReload = () => {
    window.location.reload();
  };

  handleRetry = () => {
    // React lazy() caches a failed import's rejection, so re-rendering after a
    // chunk error just re-throws — only a full reload can fetch the chunk.
    if (isChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }
    this.capturedComponentStack = '';
    this.setState({ hasError: false, error: null, recovering: false });
  };

  handleGoHome = () => {
    window.location.href = '/dispatch';
  };

  render() {
    if (this.state.hasError) {
      // Stale-bundle reload is in flight — show a calm "updating" screen for the
      // split second before the hard reload swaps in the fresh app. Avoids
      // flashing the scary error card on a routine post-deploy chunk miss.
      if (this.state.recovering) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-orange-600 mx-auto mb-3 animate-spin" />
              <p className="text-gray-600">Updating to the latest version…</p>
            </div>
          </div>
        );
      }

      if (this.props.fallback) {
        return this.props.fallback;
      }

      const stackLines = this.capturedComponentStack
        .split('\n')
        .filter(l => l.trim())
        .slice(0, 12)
        .join('\n');

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-orange-600" />
              </div>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Something went wrong
            </h2>

            <p className="text-gray-600 mb-6">
              Don't worry — your data is safe. Try one of these options to get back on track.
            </p>

            <div className="space-y-3">
              <Button
                onClick={this.handleRetry}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>

              <Button
                onClick={this.handleGoHome}
                variant="outline"
                className="w-full"
              >
                Go to Dispatch Board
              </Button>

              <Button
                onClick={this.handleReload}
                variant="ghost"
                className="w-full text-gray-500"
              >
                Reload App
              </Button>
            </div>

            {this.state.error && (
              <details className="mt-6 text-left" open>
                <summary className="text-xs font-medium text-gray-500 cursor-pointer mb-2">
                  Error details (share this to get help)
                </summary>
                <div className="bg-gray-50 rounded p-3 text-xs overflow-auto max-h-48 space-y-2">
                  <p className="font-mono text-red-600 break-all">{this.state.error.message}</p>
                  {stackLines && (
                    <pre className="font-mono text-gray-500 whitespace-pre-wrap text-[10px] leading-relaxed">
                      {stackLines}
                    </pre>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
