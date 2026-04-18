import { useRef, useState, useCallback } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  maxPullDistance?: number;
  enabled?: boolean;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 70,
  maxPullDistance = 120,
  enabled = true,
}: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const isRefreshingRef = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled || isRefreshingRef.current) return;
    const scrollEl = e.currentTarget as HTMLElement;
    if (scrollEl.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, [enabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled || !isPulling.current || isRefreshingRef.current) return;
    const scrollEl = e.currentTarget as HTMLElement;
    if (scrollEl.scrollTop > 0) {
      isPulling.current = false;
      setPullDistance(0);
      return;
    }
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }
    // Logarithmic resistance so it feels natural
    const resistance = Math.min(Math.log1p(delta) * 20, maxPullDistance);
    setPullDistance(resistance);
  }, [enabled, maxPullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!enabled || !isPulling.current) return;
    isPulling.current = false;

    if (pullDistance >= threshold && !isRefreshingRef.current) {
      isRefreshingRef.current = true;
      setIsRefreshing(true);
      setPullDistance(threshold);
      try {
        await onRefresh();
      } finally {
        setTimeout(() => {
          isRefreshingRef.current = false;
          setIsRefreshing(false);
          setPullDistance(0);
        }, 400);
      }
    } else {
      setPullDistance(0);
    }
    touchStartY.current = 0;
  }, [enabled, pullDistance, threshold, onRefresh]);

  return {
    pullDistance,
    isRefreshing,
    isPulling: pullDistance > 0,
    shouldTrigger: pullDistance >= threshold,
    handlers: { onTouchStart: handleTouchStart, onTouchMove: handleTouchMove, onTouchEnd: handleTouchEnd },
  };
}
