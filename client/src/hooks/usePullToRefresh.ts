import { useCallback, useEffect, useRef, useState } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  maxPullDistance?: number;
  enabled?: boolean;
}

// How far the content sits down while the spinner is showing.
const REFRESH_HOLD_PX = 56;
// Spinner never disappears instantly — matches UIRefreshControl's settle.
const MIN_SPINNER_MS = 500;
// The finger must move this far vertically before we commit to a pull,
// so taps and horizontal swipes never twitch the content.
const INTENT_SLOP_PX = 8;
const SETTLE_EASING = 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)';

// iOS-style rubber band: the content tracks the finger at ~half speed from
// the very first pixel and asymptotically approaches `max`. (The previous
// log1p curve had a slope of ~20 at zero — a 2px finger move flung the
// content ~25px, which is what made the pull feel jumpy and erratic.)
const DAMPING = 0.5;
function rubberBand(delta: number, max: number) {
  return (DAMPING * delta * max) / (max + DAMPING * delta);
}

// True if anything between the touch target and the pull container is
// scrolled away from its top — pulling then must scroll that inner list,
// not reveal the refresh spinner.
function hasScrolledAncestor(target: EventTarget | null, container: HTMLElement) {
  let el = target instanceof Element ? target : null;
  while (el && el !== container) {
    if (el.scrollTop > 0) return true;
    el = el.parentElement;
  }
  return container.scrollTop > 0;
}

/**
 * iOS-feel pull-to-refresh. Perf-critical parts run outside React: touch
 * listeners are attached natively (non-passive, so we can preventDefault the
 * native overscroll bounce that otherwise fights the transform) and the
 * pull position is written straight to the DOM inside requestAnimationFrame —
 * no re-render per touchmove.
 *
 * Attach `scrollRef` to the scrollable content (it receives the translateY)
 * and `indicatorRef` to the spinner wrapper (receives translateY + opacity,
 * plus a `--ptr-rotate` CSS var and a `data-armed` attribute while pulled
 * past the threshold).
 */
export function usePullToRefresh({
  onRefresh,
  // Dampened px; with maxPullDistance 180 this triggers after ~180px of
  // finger travel — about what the native iOS gesture asks for.
  threshold = 60,
  maxPullDistance = 180,
  enabled = true,
}: UsePullToRefreshOptions) {
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const indicatorRef = useRef<HTMLElement | null>(null);
  const scrollRef = useCallback((node: HTMLElement | null) => setScrollEl(node), []);

  // Live values the stable listeners read through refs.
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const phase = useRef<'idle' | 'tracking' | 'pulling' | 'refreshing'>('idle');
  const startX = useRef(0);
  const startY = useRef(0);
  const distance = useRef(0);
  const raf = useRef(0);

  useEffect(() => {
    if (!scrollEl || !enabled) return;
    const el = scrollEl;

    const paint = () => {
      raf.current = 0;
      const d = distance.current;
      el.style.transition = 'none';
      el.style.transform = d > 0 ? `translate3d(0, ${d}px, 0)` : '';
      const ind = indicatorRef.current;
      if (ind) {
        const progress = Math.min(d / threshold, 1);
        ind.style.transition = 'none';
        ind.style.opacity = String(progress);
        ind.style.transform = `translate3d(0, ${d - 44}px, 0) scale(${0.6 + 0.4 * progress})`;
        ind.style.setProperty('--ptr-rotate', `${d * 2.5}deg`);
        if (progress >= 1) ind.setAttribute('data-armed', 'true');
        else ind.removeAttribute('data-armed');
      }
    };

    const schedule = () => {
      if (!raf.current) raf.current = requestAnimationFrame(paint);
    };

    const settleTo = (y: number, showSpinner: boolean) => {
      if (raf.current) {
        cancelAnimationFrame(raf.current);
        raf.current = 0;
      }
      el.style.transition = SETTLE_EASING;
      el.style.transform = y > 0 ? `translate3d(0, ${y}px, 0)` : '';
      const ind = indicatorRef.current;
      if (ind) {
        ind.style.transition = `${SETTLE_EASING}, opacity 0.25s ease`;
        ind.style.opacity = showSpinner ? '1' : '0';
        ind.style.transform = showSpinner
          ? `translate3d(0, ${y - 44}px, 0) scale(1)`
          : 'translate3d(0, -44px, 0) scale(0.6)';
        if (!showSpinner) ind.removeAttribute('data-armed');
      }
    };

    const finishRefresh = () => {
      settleTo(0, false);
      phase.current = 'idle';
      distance.current = 0;
      setIsRefreshing(false);
    };

    const trigger = async () => {
      phase.current = 'refreshing';
      setIsRefreshing(true);
      settleTo(REFRESH_HOLD_PX, true);
      const shownAt = Date.now();
      try {
        await onRefreshRef.current();
      } finally {
        const remaining = Math.max(0, MIN_SPINNER_MS - (Date.now() - shownAt));
        setTimeout(finishRefresh, remaining);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (phase.current === 'refreshing') return;
      phase.current = 'tracking';
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      distance.current = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (phase.current === 'idle' || phase.current === 'refreshing') return;
      // Something closer to the touch (e.g. a drag-and-drop handle) owns this
      // gesture — never fight it with a pull.
      if (e.defaultPrevented && phase.current === 'tracking') {
        phase.current = 'idle';
        return;
      }
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;

      if (phase.current === 'tracking') {
        // Anything scrolled between finger and container? Follow the finger's
        // baseline so a scroll-to-top-then-keep-dragging gesture flows straight
        // into the pull with no jump — exactly like iOS.
        if (hasScrolledAncestor(e.target, el)) {
          startX.current = x;
          startY.current = y;
          return;
        }
        const dx = x - startX.current;
        const dy = y - startY.current;
        if (dy < INTENT_SLOP_PX) {
          if (dy < 0) {
            // Scrolling down the page — stand down for this gesture.
            phase.current = 'idle';
          }
          return;
        }
        if (Math.abs(dx) > dy) {
          // Horizontal gesture (carousel/slider) — stand down.
          phase.current = 'idle';
          return;
        }
        phase.current = 'pulling';
        startY.current = y - 1; // carry a hair of the move into the pull
      }

      const delta = y - startY.current;
      if (delta <= 0) {
        // Pushed back past the origin — hand control back to native scroll.
        phase.current = 'tracking';
        startY.current = y;
        distance.current = 0;
        schedule();
        return;
      }
      // We own this gesture: stop the native overscroll bounce from
      // compounding with our transform (the other source of jumpiness).
      e.preventDefault();
      distance.current = rubberBand(delta, maxPullDistance);
      schedule();
    };

    const onTouchEnd = () => {
      if (phase.current === 'pulling' && distance.current >= threshold) {
        trigger();
        return;
      }
      if (phase.current !== 'refreshing') {
        phase.current = 'idle';
        if (distance.current > 0) {
          distance.current = 0;
          settleTo(0, false);
        }
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      if (raf.current) cancelAnimationFrame(raf.current);
      el.style.transform = '';
      el.style.transition = '';
    };
  }, [scrollEl, enabled, threshold, maxPullDistance]);

  return { scrollRef, indicatorRef, isRefreshing };
}
