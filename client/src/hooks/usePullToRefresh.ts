import { useEffect, useRef, useState } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  maxPullDistance?: number;
  enabled?: boolean;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPullDistance = 150,
  enabled = true
}: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef<number>(0);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let currentScrollContainer: HTMLElement | null = null;

    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      currentScrollContainer = target.closest('[data-pull-refresh]') as HTMLElement;
      
      if (!currentScrollContainer) return;

      // Only start tracking if at the top of scroll
      if (currentScrollContainer.scrollTop === 0) {
        touchStartY.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!currentScrollContainer || touchStartY.current === 0) return;

      const touchY = e.touches[0].clientY;
      const pullDist = touchY - touchStartY.current;

      // Only track downward pulls when at top of scroll
      if (pullDist > 0 && currentScrollContainer.scrollTop === 0) {
        // Prevent default scroll behavior
        e.preventDefault();
        
        // Apply resistance curve (gets harder to pull further down)
        const resistance = Math.min(pullDist / 2, maxPullDistance);
        setPullDistance(resistance);
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(threshold);
        
        try {
          await onRefresh();
        } finally {
          setTimeout(() => {
            setIsRefreshing(false);
            setPullDistance(0);
          }, 500);
        }
      } else {
        setPullDistance(0);
      }
      
      touchStartY.current = 0;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, onRefresh, pullDistance, threshold, maxPullDistance, isRefreshing]);

  return {
    pullDistance,
    isRefreshing,
    isPulling: pullDistance > 0,
    shouldTrigger: pullDistance >= threshold
  };
}
