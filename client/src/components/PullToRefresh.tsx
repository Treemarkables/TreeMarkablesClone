import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  enabled?: boolean;
  /** Extra classes for the outer (clipping) wrapper. */
  className?: string;
  /** Extra classes for the scrollable content element. */
  contentClassName?: string;
}

/**
 * iOS-style pull-to-refresh: a lone spinner circle that fades/scales in as
 * you pull and spins while refreshing. All motion is driven directly on the
 * DOM by usePullToRefresh (no per-frame re-renders), so the pull tracks the
 * finger smoothly like the native iPhone gesture.
 */
export function PullToRefresh({ onRefresh, children, enabled = true, className, contentClassName }: PullToRefreshProps) {
  const { scrollRef, indicatorRef, isRefreshing } = usePullToRefresh({ onRefresh, enabled });

  return (
    <div className={`relative h-full w-full overflow-hidden ${className ?? ''}`}>
      {/* Spinner — always mounted so its first frame never pops in; the hook
          drives opacity/position/rotation and sets data-armed past the threshold */}
      <div
        ref={indicatorRef as React.MutableRefObject<HTMLDivElement | null>}
        className="group absolute inset-x-0 top-0 z-50 flex justify-center pointer-events-none"
        style={{ opacity: 0, transform: 'translate3d(0, -44px, 0) scale(0.6)' }}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <RefreshCw
            className={`h-4 w-4 text-gray-400 group-data-[armed]:text-primary ${isRefreshing ? 'animate-spin text-primary' : ''}`}
            style={isRefreshing ? undefined : { transform: 'rotate(var(--ptr-rotate, 0deg))' }}
          />
        </div>
      </div>

      {/* Scrollable content — the hook translates this element while pulling.
          overscroll-y-none keeps the native rubber-band from fighting the pull. */}
      <div
        ref={scrollRef}
        className={`h-full overflow-y-auto overflow-x-hidden overscroll-y-none ${contentClassName ?? ''}`}
      >
        {children}
      </div>
    </div>
  );
}
