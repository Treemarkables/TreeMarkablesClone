import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  enabled?: boolean;
}

export function PullToRefresh({ onRefresh, children, enabled = true }: PullToRefreshProps) {
  const { pullDistance, isRefreshing, shouldTrigger, handlers } = usePullToRefresh({
    onRefresh,
    enabled,
  });

  const showIndicator = pullDistance > 0 || isRefreshing;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Pull indicator */}
      {showIndicator && (
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none z-50"
          style={{ transform: `translateY(${Math.min(pullDistance, 70) - 48}px)`, transition: isRefreshing ? 'transform 0.2s ease' : 'none' }}
        >
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-lg border border-gray-200 ${shouldTrigger ? 'text-primary' : 'text-gray-500'}`}>
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              style={{ transform: !isRefreshing ? `rotate(${Math.min(pullDistance * 4, 360)}deg)` : undefined }}
            />
            <span className="text-xs font-medium">
              {isRefreshing ? 'Refreshing…' : shouldTrigger ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </div>
        </div>
      )}

      {/* Scrollable content — touch events attached here */}
      <div
        className="h-full overflow-y-auto overflow-x-hidden overscroll-y-contain"
        style={{
          transform: isRefreshing ? 'translateY(56px)' : pullDistance > 0 ? `translateY(${Math.min(pullDistance, 70)}px)` : undefined,
          transition: isRefreshing || pullDistance === 0 ? 'transform 0.25s ease' : 'none',
        }}
        {...handlers}
      >
        {children}
      </div>
    </div>
  );
}
