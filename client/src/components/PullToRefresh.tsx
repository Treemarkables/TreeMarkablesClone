import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  enabled?: boolean;
}

export function PullToRefresh({ onRefresh, children, enabled = true }: PullToRefreshProps) {
  const { pullDistance, isRefreshing, shouldTrigger } = usePullToRefresh({
    onRefresh,
    enabled
  });

  return (
    <div className="relative h-full w-full" data-pull-refresh>
      {/* Pull to refresh indicator */}
      <div 
        className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none z-50 transition-all duration-200"
        style={{
          transform: `translateY(${pullDistance - 60}px)`,
          opacity: Math.min(pullDistance / 80, 1)
        }}
      >
        <div className={`
          flex items-center gap-2 px-4 py-2 rounded-full 
          bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700
          ${shouldTrigger ? 'text-primary' : 'text-gray-500'}
        `}>
          <RefreshCw 
            className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`}
            style={{
              transform: !isRefreshing ? `rotate(${Math.min(pullDistance * 3, 360)}deg)` : undefined
            }}
          />
          <span className="text-sm font-medium">
            {isRefreshing ? 'Refreshing...' : shouldTrigger ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div 
        className="h-full overflow-auto"
        style={{
          transform: isRefreshing ? 'translateY(60px)' : `translateY(${pullDistance}px)`,
          transition: isRefreshing || pullDistance === 0 ? 'transform 0.3s ease' : 'none'
        }}
      >
        {children}
      </div>
    </div>
  );
}
